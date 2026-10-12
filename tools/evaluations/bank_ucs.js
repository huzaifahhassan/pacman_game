const { esc, fmt, mkGraph, bestFirst, trueDist, gSVG, heapHTML, codeHTML, lineOf, textOf, openField, gridSearch, drawGrid, canvasHTML } = H;
const O = (html, ok, why) => ({ html, ok: !!ok, why: why || '' });
const C = (s) => '<code>' + s + '</code>';
const L = (role) => 'line ' + lineOf(role);
const wrapV = (inner) => '<div style="flex:1 1 440px;min-width:0">' + inner + '</div>';

// ---------------------------------------------------------------- graph templates
const POS7 = { S: [44, 130], A: [160, 46], B: [160, 130], C: [160, 214], D: [290, 74], E: [290, 186], G: [396, 130] };
const TPL = {
  ladder: { pos: POS7, edges: [['S', 'A'], ['S', 'B'], ['S', 'C'], ['A', 'D'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['D', 'G'], ['E', 'G']] },
  dup: { pos: { S: [44, 130], A: [150, 48], B: [150, 212], C: [276, 130], G: [396, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'G'], ['C', 'G']] },
  early: { pos: { S: [50, 130], A: [160, 50], B: [280, 50], G: [396, 130] }, edges: [['S', 'G'], ['S', 'A'], ['A', 'B'], ['B', 'G']] },
  later: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'B'], ['B', 'G']] },
  cycle: { pos: { S: [50, 130], A: [170, 52], B: [290, 52], G: [396, 130] }, edges: [['S', 'A'], ['A', 'B'], ['B', 'S'], ['B', 'G']] },
  ign: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'G'], ['B', 'G']] },
  neg: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'G'], ['B', 'A']] },
  tieAB: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'G'], ['B', 'G']] },
  tieBA: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'B'], ['S', 'A'], ['B', 'G'], ['A', 'G']] }
};
const WEB_POS = { S: [44, 130], A: [150, 46], B: [150, 214], C: [280, 130], D: [280, 214], G: [396, 60] };
const WEB_PAIRS = [['S', 'A'], ['S', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'G'], ['D', 'G']];
function webGraph(ws) { const edges = [], w = []; WEB_PAIRS.forEach((p, i) => { edges.push([p[0], p[1]], [p[1], p[0]]); w.push(ws[i], ws[i]); }); return mkGraph({ pos: WEB_POS, edges }, w); }

// pick random weights until the check passes (so every generated question has the property it is meant to teach)
function find(r, make, check, tries) { let last; for (let t = 0; t < (tries || 300); t++) { const g = make(r); const run = bestFirst(g, {}); last = { g, run }; if (check(g, run)) return last; } return last; }
const ladderG = (r, lo, hi) => mkGraph(TPL.ladder, TPL.ladder.edges.map(() => r.int(lo || 1, hi || 7)));
const dupG = (r) => mkGraph(TPL.dup, TPL.dup.edges.map(() => r.int(1, 6)));
const webG = (r) => webGraph(WEB_PAIRS.map(() => r.int(1, 6)));
const entryName = (e) => '(' + e.s + ', cost ' + fmt(e.g) + ')';
const byInsertion = (list) => list.slice().sort((a, b) => a.seq - b.seq);
const pathCostOnGrid = (gr, path) => { let x = gr.start[0], y = gr.start[1], c = 0; for (const a of path) { const d = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[a]; x += d[0]; y += d[1]; c += gr.cost[x][y]; } return c; };

function demoPair(el, g, A, B) {
  el.innerHTML = '<div class="pair">' + [A, B].map((x, i) => '<div><h5>' + x.title + '</h5>' + gSVG(g, { path: x.run.path, uid: 'd' + i + (x.uid || ''), label: x.title }) + '<div class="res ' + (x.ok ? 'ok' : 'bad') + '">' + x.text + '</div></div>').join('') + '</div>';
}
const runText = (run, opt) => (run.found ? 'Path <b>' + esc(run.path.join(' → ')) + '</b>, cost <b>' + fmt(run.cost) + '</b>' + (opt !== undefined ? (Math.abs(run.cost - opt) < 1e-9 ? ' ✓ optimal' : ' ✗ (the optimum is ' + fmt(opt) + ')') : '') : 'no path found');
const optimum = (g) => bestFirst(g, {}).cost;

// ---------------------------------------------------------------- grid helpers for the maze questions
function swampField(r) {
  for (let t = 0; t < 200; t++) {
    const gr = openField(22, 11, []); gr.start = [2, 5]; gr.goal = [19, 5];
    const x0 = r.int(7, 9), x1 = x0 + r.int(4, 6), y0 = r.int(2, 3), y1 = r.int(7, 8);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) gr.cost[x][y] = 9;
    const b = gridSearch(gr, 'bfs'), u = gridSearch(gr, 'ucs');
    if (u.cost < pathCostOnGrid(gr, b.path) - 5) return { gr, bfs: b, ucs: u, box: [x0, x1, y0, y1] };
  }
  const gr = openField(22, 11, []); gr.start = [2, 5]; gr.goal = [19, 5];
  for (let x = 8; x <= 13; x++) for (let y = 2; y <= 8; y++) gr.cost[x][y] = 9;
  return { gr, bfs: gridSearch(gr, 'bfs'), ucs: gridSearch(gr, 'ucs'), box: [8, 13, 2, 8] };
}
function shapeField(r) {
  const gr = openField(26, 13, [{ x: 12, y0: 3, y1: 9 }]); gr.start = [3, 6]; gr.goal = [22, 6];
  const x0 = r.int(5, 7), x1 = x0 + r.int(2, 3);
  for (let x = x0; x <= x1; x++) for (let y = 2; y <= 10; y++) gr.cost[x][y] = 9;
  return gr;
}

// ---------------------------------------------------------------- the bank
const parts = [
  { id: 'setup', group: 'setup', label: 'Heap, entries and visited set', review: 'Re-read how the start entry (state, path, cost) is pushed and what visited holds. Everything the search needs travels inside the entry.' },
  { id: 'pop', group: 'loop', label: 'Pop the cheapest entry', review: 'Practise predicting the next pop from a heap table: the lowest cost wins, wherever it was pushed from.' },
  { id: 'stale', group: 'loop', label: 'Skip stale duplicates', review: 'A state can be in the heap twice. The cheaper copy pops first and expands; the later copy is skipped by the visited check.' },
  { id: 'goal', group: 'loop', label: 'Goal test, on pop', review: 'The goal is tested when an entry is popped, never when it is pushed, because a cheaper route might still be waiting.' },
  { id: 'mark', group: 'loop', label: 'Mark visited (expand)', review: 'A state enters visited when it is popped and expanded, not when it is pushed. That is what lets a cheaper route still get in.' },
  { id: 'succ', group: 'loop', label: 'Generate successors', review: 'Work through which states get expanded and in what order; getSuccessors lists the neighbours in a fixed order.' },
  { id: 'filter', group: 'loop', label: 'Skip visited successors', review: 'Only visited successors are skipped. A successor that is merely waiting in the heap must still be pushed.' },
  { id: 'cost', group: 'loop', label: 'Add up cost and path', review: 'new_cost = cost + step_cost accumulates along the path. Priority is the total so far, never the last step alone.' },
  { id: 'push', group: 'loop', label: 'Push with priority', review: 'Each push carries (successor, path + [action], new_cost) and uses new_cost as the priority. path + [action] makes a fresh list.' },
  { id: 'fail', group: 'exit', label: 'Heap empty: no solution', review: 'If the heap empties, no path exists and the function returns []. visited is what makes that finish on cyclic graphs.' },
  { id: 'ties', group: 'theory', label: 'Ties and the count', review: 'Equal priorities pop in the order they were pushed (the count in util.PriorityQueue). That decides which of two equal routes you get.' },
  { id: 'optimal', group: 'theory', label: 'Why it is optimal', review: 'Cheapest-first popping plus the goal test on pop means any cheaper route would already have been popped. It needs non-negative costs.' },
  { id: 'constant', group: 'theory', label: 'Constant vs variable cost', review: 'With constant costs UCS orders entries by arrival, so it IS BFS. With variable costs it may take more moves to pay less.' },
  { id: 'structure', group: 'theory', label: 'Data structures (util)', review: 'util.PriorityQueue stores (priority, count, item): the count gives FIFO ties and stops Python comparing items.' }
];
const groups = [{ id: 'setup', label: 'Set up', arrow: true }, { id: 'loop', label: 'The loop: repeat until the goal is popped', arrow: true }, { id: 'exit', label: 'If the heap runs empty', arrow: false }, { id: 'theory', label: 'Ideas behind it', arrow: false }];

const questions = [
  // ---------------------------------------------------------------- 1: the shape of the algorithm
  { id: 'u-steps', title: 'Put the algorithm in order', parts: ['setup', 'pop', 'stale', 'goal', 'mark', 'succ', 'filter', 'cost', 'push', 'fail'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'These are the steps of <code>uniformCostSearch</code>, shuffled. Click them in the order the algorithm performs them.',
      items: [
        'Push the start entry ' + C('(start, [], 0)') + ' with priority 0, and create an empty ' + C('visited') + ' set.',
        'While the heap is not empty: pop the cheapest entry ' + C('(state, path, cost)') + '.',
        'If ' + C('state') + ' is already in ' + C('visited') + ', skip this entry.',
        'If ' + C('state') + ' is the goal, return ' + C('path') + '.',
        'Add ' + C('state') + ' to ' + C('visited') + '.',
        'For each successor that is not visited: ' + C('new_cost = cost + step_cost') + '.',
        'Push ' + C('(successor, path + [action], new_cost)') + ' with priority ' + C('new_cost') + '.',
        'When the loop ends because the heap is empty, return ' + C('[]') + '.'],
      hints: ['The goal test and the visited check both come before the successors are generated.', 'Cost is added up before the push, because the priority is the new cost.'],
      explain: 'In your code: setup is lines ' + lineOf('init_stack') + '–' + lineOf('init_visited') + ', the pop is line ' + lineOf('pop') + ', the stale check ' + lineOf('check_visited') + ', the goal test ' + lineOf('goal_test') + ', marking visited line ' + lineOf('mark') + ', and the successor loop starts at line ' + lineOf('for_succ') + '.' }) },

  { id: 'u-entry', title: 'What is in a heap entry?', parts: ['setup', 'structure'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Look at how your code pushes the start state onto the heap.',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['push_start'] }); },
      options: [
        O('One tuple ' + C('(state, path, cost)'), true, 'The path travels inside the entry (so no parent pointers are needed) and the cost is stored because ' + C('pop()') + ' returns only the item, not its priority.'),
        O('Only the ' + C('state') + '; the path is rebuilt afterwards from parent pointers', false, 'That is a valid design, but not yours: your code has no parent pointers. The path is carried along and extended by ' + C('path + [action]') + ' on every push.'),
        O(C('(state, cost)') + '; the path is recovered by walking ' + C('visited'), false, C('visited') + ' is a plain set of states: it remembers nothing about order or actions.'),
        O(C('(state, h)') + ' where h is a heuristic estimate', false, 'UCS has no heuristic; that belongs to A*. Here the only number is the cost so far.')],
      hints: ['Ask what ' + C('return path') + ' needs at the very end.'], explain: 'Each entry is a self-contained snapshot: where we are, how we got here, and what it cost.' }) },

  { id: 'u-priority', title: 'What decides the next pop?', parts: ['pop', 'push', 'cost'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Your heap pops one entry at a time. Which number decides which entry comes out first?',
      options: [
        O('The total cost ' + C('g') + ' from the start to that state along that entry\'s path', true, 'This is what makes it <b>uniform cost</b> search: always extend the cheapest path found so far.'),
        O('The cost of the last step only', false, 'That would grab whichever edge is locally cheapest and ignore what it took to get there. One of the later bug questions shows it failing.'),
        O('The number of moves so far (the length of the path)', false, 'Ordering by number of moves is BFS. UCS matches BFS only when every step costs the same.'),
        O('The straight-line distance to the goal', false, 'That is a heuristic. Using it alone is greedy search; adding it to the cost is A*.')],
      hints: ['Look at the second argument of ' + C('to_visit.push') + ' on line ' + lineOf('push_succ') + '.'],
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['add_cost', 'push_succ'] }); }, explain: 'The priority is ' + C('new_cost') + ', the full path cost, so the heap is always ordered by the cheapest route found so far.' }) },

  { id: 'u-zero', title: 'Why does 0 appear twice?', parts: ['setup', 'structure'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Line ' + lineOf('push_start') + ' is <code>' + esc(textOf('push_start')) + '</code>. Why is there a <code>0</code> inside the tuple <i>and</i> a <code>0</code> after it?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['push_start'] }); },
      options: [
        O('The first is the cost stored in the entry (nothing spent yet); the second is the priority the heap sorts by', true, 'Both equal 0 only for the start. Later pushes use new_cost for both, as on line ' + lineOf('push_succ') + '.'),
        O('Both are the same variable, written twice by accident', false, 'They play different roles: one is data inside the item, the other is the sort key used by ' + C('util.PriorityQueue') + '.'),
        O('The first is the length of the path and the second is the cost', false, 'The path is the empty list ' + C('[]') + ' in the middle; the first number is not a length.'),
        O('The second 0 is the heuristic value of the start', false, 'There is no heuristic in UCS.')],
      hints: ['Remember what ' + C('pop()') + ' returns: only the item, not the priority.'], explain: 'Item and priority are separate on purpose. You need the cost inside the item because you can never read the priority back out.' }) },

  { id: 'u-visited', title: 'What does visited hold?', parts: ['mark', 'filter'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'At any moment while your function runs, what is in the set <code>visited</code>?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['init_visited', 'mark'] }); },
      options: [
        O('Every state that has been popped and expanded', true, 'It is filled on line ' + lineOf('mark') + ', right after the stale check and the goal test pass.'),
        O('Every state that has ever been pushed onto the heap', false, 'States are added when they are expanded, not when they are queued. A state can be queued many times before it is ever expanded.'),
        O('The states on the cheapest path found so far', false, 'visited has no idea which path is best; it only records "already expanded".'),
        O('The goal state once it has been seen', false, 'The goal is never added: it is returned as soon as it is popped.')],
      hints: ['Find the single line that calls ' + C('visited.add') + ' and read what surrounds it.'], explain: 'visited means "already expanded", and the first expansion of a state is always with its cheapest cost.' }) },

  { id: 'u-count', title: 'Why does the heap store a count?', parts: ['structure', 'ties'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: C('util.PriorityQueue.push') + ' stores <code>(priority, count, item)</code> in its heap. Why is <code>count</code> there?',
      options: [
        O('Equal priorities are popped in the order they were pushed, and Python never has to compare two items', true, 'Tuples compare left to right; the always-different count settles every tie, so the item (which may hold lists and tuples) is never compared.'),
        O('It counts how many entries are in the queue so that ' + C('isEmpty') + ' is fast', false, C('isEmpty') + ' just checks the length of the heap list.'),
        O('It makes the heap fully sorted instead of partly sorted', false, 'A heap is only partly ordered; count does nothing about that.'),
        O('It stops the same item being pushed twice', false, 'Duplicates are perfectly allowed, which is the whole point of the stale check.')],
      hints: ['Think about what happens when two pushes have exactly the same priority.'], explain: 'This is why your UCS gives the same answer as BFS on constant costs, and why ties are first in, first out.' }) },

  // ---------------------------------------------------------------- 2: tracing by hand
  { id: 'u-next', title: 'Which state is popped next?', parts: ['pop', 'push'], level: 1,
    gen: (r) => {
      const { g, run } = find(r, (rr) => ladderG(rr), (gg, rn) => rn.found && !rn.ties && rn.steps.length >= 6);
      const cand = run.steps.map((s, i) => i).filter((i) => i >= 1 && i <= 4 && run.steps[i].expanded && run.steps[i].before.length >= 2);
      const k = cand.length ? cand[r.int(0, cand.length - 1)] : 1, st = run.steps[k], seen = new Set(); for (let i = 0; i < k; i++) if (run.steps[i].expanded) seen.add(run.steps[i].entry.s);
      return { type: 'nodes', pick: 'nodes', max: 1, graph: g, answer: [st.entry.s], label: 'Graph with edge costs',
        prompt: 'UCS is partway through this graph. The heap is shown (in the order entries were pushed, not sorted). Click the <b>state that is popped next</b>.',
        graphOpts: () => ({ visited: seen }),
        visual: (el) => { el.innerHTML = '<div>' + heapHTML(byInsertion(st.before), { cols: ['g', 'path'], noNext: true, caption: 'Heap entries (pushed order)' }) + '<p class="cap">In the graph below, green states are already expanded (in ' + C('visited') + ').</p></div>'; },
        hints: ['Read the cost column and find the smallest.', 'The cost is the total from S along that entry\'s path.'],
        explain: 'The smallest cost in the heap is ' + fmt(st.entry.g) + ', on the entry for ' + C(st.entry.s) + ' (path ' + esc(st.entry.path.join(' → ')) + '). The heap always pops the cheapest entry, wherever it came from.' }; } },

  { id: 'u-pushes', title: 'Which entries get pushed?', parts: ['push', 'filter', 'cost', 'succ'], level: 2,
    gen: (r) => {
      let pick = null;
      for (let t = 0; t < 300 && !pick; t++) {
        const g = webG(r), run = bestFirst(g, {});
        if (!run.found || run.ties) continue;
        const k = run.steps.findIndex((s, i) => i >= 2 && s.expanded && s.pushes.some((p) => p.skipped === 'visited') && s.pushes.some((p) => !p.skipped));
        if (k >= 0) pick = { g, run, k };
      }
      const { g, run, k } = pick, st = run.steps[k], pushed = st.pushes.filter((p) => !p.skipped), skipped = st.pushes.filter((p) => p.skipped === 'visited');
      const opts = [];
      pushed.forEach((p) => opts.push(O(C(entryName(p)), true, 'cost = ' + fmt(st.entry.g) + ' + ' + fmt(p.g - st.entry.g) + ' = ' + fmt(p.g) + ', and ' + p.s + ' is not visited yet.')));
      skipped.forEach((p) => opts.push(O(C('(' + p.s + ', …)'), false, p.s + ' is already in visited, so ' + C('if successor not in visited') + ' skips it.')));
      pushed.forEach((p) => opts.push(O(C('(' + p.s + ', cost ' + fmt(p.g - st.entry.g) + ')'), false, 'That is just the step cost. The entry must carry the total from the start: ' + fmt(p.g) + '.')));
      const ex = st.entry;
      return { type: 'multi', graph: g, prompt: 'State ' + C(ex.s) + ' has just been popped with cost ' + fmt(ex.g) + ' and is being expanded. States already in visited are green. <b>Tick every entry your code pushes.</b>',
        visual: (el) => { const vis = new Set(st.visited); el.innerHTML = wrapV(gSVG(g, { visited: vis, current: ex.s, uid: 'p', label: 'Graph' })) + '<p class="cap" style="flex:1 1 100%">Edges are two-way here, like corridors in a maze.</p>'; },
        options: opts, hints: ['A successor that is already visited is not pushed.', 'The cost on a pushed entry is the cost of the popped entry plus the step.'],
        explain: 'Your loop on lines ' + lineOf('for_succ') + '–' + lineOf('push_succ') + ' skips visited successors and pushes the rest with ' + C('new_cost = cost + step_cost') + '.' }; } },

  { id: 'u-newcost', title: 'What cost goes on the new entry?', parts: ['cost', 'push'], level: 1,
    gen: (r) => {
      const { g, run } = find(r, (rr) => ladderG(rr), (gg, rn) => rn.found && rn.steps.length >= 4);
      const st = run.steps.find((s) => s.expanded && s.entry.s !== 'S' && s.pushes.some((p) => !p.skipped)), pu = st.pushes.find((p) => !p.skipped);
      return { type: 'numeric', answer: pu.g, tol: 0, graph: g,
        prompt: 'State ' + C(st.entry.s) + ' is popped with <b>cost ' + fmt(st.entry.g) + '</b>. The edge ' + C(st.entry.s + ' → ' + pu.s) + ' costs <b>' + fmt(pu.g - st.entry.g) + '</b>. What is <code>new_cost</code> for the entry pushed for ' + C(pu.s) + '?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { current: st.entry.s, uid: 'n', label: 'Graph' })) + '<div>' + codeHTML({ mark: ['add_cost'] }) + '</div>'; },
        hints: ['Look at line ' + lineOf('add_cost') + '.'], explain: C('new_cost = cost + step_cost') + ' = ' + fmt(st.entry.g) + ' + ' + fmt(pu.g - st.entry.g) + ' = <b>' + fmt(pu.g) + '</b>. The same number is the priority.' }; } },

  { id: 'u-order', title: 'In what order are states expanded?', parts: ['pop', 'succ', 'mark'], level: 2,
    gen: (r) => {
      const { g, run } = find(r, (rr) => ladderG(rr), (gg, rn) => rn.found && !rn.ties && rn.order.length >= 5);
      const ans = run.order.slice(0, 4);
      return { type: 'nodes', pick: 'seq', max: 4, graph: g, answer: ans, label: 'Graph',
        prompt: 'Run UCS on this graph from S. Click the <b>first four states that get expanded</b>, in order (S is the first). Edge costs are on the arrows.',
        hints: ['Expand S, then keep expanding the cheapest state that is waiting.', 'Write down the heap after each expansion.'],
        explain: 'Expansion order: ' + esc(run.order.join(', ')) + ' (the goal G is returned when popped, never expanded). Each time, the cheapest entry in the heap is expanded next.' }; } },

  { id: 'u-path', title: 'Which path does UCS return?', parts: ['goal', 'cost', 'optimal'], level: 2,
    gen: (r) => {
      const { g, run } = find(r, (rr) => ladderG(rr), (gg, rn) => rn.found && !rn.ties && rn.path.length >= 4 && rn.stale === 0);
      return { type: 'nodes', pick: 'seq', max: run.path.length, graph: g, answer: run.path, label: 'Graph',
        prompt: 'Click the <b>path UCS returns</b>, from S to G, in order. Every node on the path counts, so click S first.',
        hints: ['Cost is the total of the edge weights on the path.', 'The path with the fewest edges is not always the cheapest.'],
        explain: 'The cheapest path is ' + esc(run.path.join(' → ')) + ' with total cost ' + fmt(run.cost) + '.' }; } },

  { id: 'u-count-expansions', title: 'How many states are expanded?', parts: ['goal', 'mark', 'pop'], level: 2,
    gen: (r) => {
      const { g, run } = find(r, (rr) => ladderG(rr), (gg, rn) => rn.found && !rn.ties && rn.expansions >= 4);
      return { type: 'numeric', answer: run.expansions, tol: 0, graph: g,
        prompt: 'UCS runs on this graph until it returns. <b>How many states are expanded</b> (added to visited) before it returns? The goal is returned when popped, so it does not count.',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'c', label: 'Graph' })); },
        hints: ['List the expansion order first, then count.'], explain: 'Expanded: ' + esc(run.order.join(', ')) + ' = ' + run.expansions + ' states. The goal was popped next and returned.' }; } },

  { id: 'u-stale-what', title: 'A popped state is already visited', parts: ['stale', 'pop'], level: 2,
    gen: (r) => {
      const { g, run } = find(r, dupG, (gg, rn) => rn.found && rn.stale >= 1 && !rn.ties);
      const si = run.steps.findIndex((s) => s.stale), st = run.steps[si], first = run.steps.find((s) => s.expanded && s.entry.s === st.entry.s);
      return { type: 'mc', graph: g,
        prompt: 'Your heap pops the entry <b>' + C(entryName(st.entry)) + '</b>, but ' + C(st.entry.s) + ' is already in <code>visited</code> (it was expanded earlier with cost ' + fmt(first.entry.g) + ').',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { visited: new Set(st.visited), current: st.entry.s, uid: 's', label: 'Graph' })) + '<div>' + codeHTML({ mark: ['check_visited', 'skip'] }) + '</div>'; },
        options: [
          O('It skips the entry with ' + C('continue') + ' and goes on to the next pop', true, 'The first copy came out of the heap earlier because it was cheaper, so this one is a worse duplicate. Skipping it is safe and cheap.'),
          O('It expands ' + C(st.entry.s) + ' again using the new cost', false, 'That would redo work, and the new cost is higher (' + fmt(st.entry.g) + ' vs ' + fmt(first.entry.g) + ').'),
          O('It returns the path of that entry', false, 'Only the goal test returns a path, and ' + C(st.entry.s) + ' is not the goal.'),
          O('It replaces the old cost in visited with the new one', false, C('visited') + ' is a set of states and holds no costs.')],
        hints: ['Compare the two costs for the same state.'], explain: 'Lines ' + lineOf('check_visited') + '–' + lineOf('skip') + ': <code>if current_state in visited: continue</code>.' }; } },

  { id: 'u-stale-count', title: 'How many stale entries are skipped?', parts: ['stale', 'push', 'filter'], level: 3,
    gen: (r) => {
      const { g, run } = find(r, dupG, (gg, rn) => rn.found && rn.stale >= 1 && rn.stale <= 3 && !rn.ties);
      return { type: 'numeric', answer: run.stale, tol: 0, graph: g,
        prompt: 'Run UCS on this graph to the end. During the run, <b>how many popped entries are stale duplicates</b> that get skipped by the visited check?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'k', label: 'Graph' })); },
        hints: ['A state is pushed once for every unvisited route that reaches it before it is expanded.', 'Trace the heap and watch for a state that appears twice.'],
        explain: run.stale + ' stale entr' + (run.stale === 1 ? 'y was' : 'ies were') + ' popped and skipped. The run popped ' + run.pops + ' entries in all and expanded ' + run.expansions + ' states.' }; } },

  { id: 'u-twice', title: 'Why can a state be in the heap twice?', parts: ['push', 'filter', 'stale'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Your code never checks whether a successor is already waiting in the heap. So the same state can sit in the heap twice, with different costs. Why is that fine?',
      options: [
        O('A cheaper route may be found after a dearer one was queued. The cheaper entry pops first; the later one is skipped when it comes out', true, 'That is the whole design: keep every route, take them cheapest-first, and ignore the ones that arrive too late.'),
        O('It is a bug that happens to be harmless, and a careful implementation would prevent it', false, 'Preventing it (skipping already-queued states) can lose the cheaper route. A later question demonstrates it.'),
        O('Both entries are expanded, so the state is visited twice for extra safety', false, 'Only the first is expanded; the second is dropped by the visited check.'),
        O('The heap merges the two entries automatically', false, C('util.PriorityQueue.push') + ' never merges; ' + C('update') + ' exists but your code does not use it.')],
      hints: ['Think about which of the two entries comes out of the heap first.'], explain: 'Duplicates are cheap; losing the cheaper route is not.' }) },

  { id: 'u-pushcount', title: 'How many pushes in total?', parts: ['push', 'filter', 'succ', 'setup'], level: 3,
    gen: (r) => {
      const { g, run } = find(r, webG, (gg, rn) => rn.found && !rn.ties && rn.steps.length >= 6 && rn.steps.length <= 14);
      let n = 1; run.steps.forEach((s) => { n += s.pushes.filter((p) => !p.skipped).length; });
      return { type: 'numeric', answer: n, tol: 0, graph: g,
        prompt: 'Run UCS on this graph to the end. <b>How many entries are pushed onto the heap in total</b>, counting the start entry?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'pc', label: 'Graph' })) + '<p class="cap" style="flex:1 1 100%">Edges are two-way. Remember: visited successors are not pushed, queued ones are.</p>'; },
        hints: ['For every expanded state, count its unvisited successors at that moment.'], explain: 'Total pushes: ' + n + '. Expanded ' + run.expansions + ' states: ' + esc(run.order.join(', ')) + '.' }; } },

  // ---------------------------------------------------------------- 3: ties
  { id: 'u-tie-fifo', title: 'Two entries cost the same', parts: ['ties', 'structure', 'pop'], level: 1,
    gen: (r) => {
      const a = r.int(3, 6), mk = (s, g, seq, path) => ({ s, g, pri: g, seq, path });
      const ent = [mk('B', a + 2, 0, ['S', 'B']), mk('A', a, 1, ['S', 'A']), mk('C', a, 2, ['S', 'C']), mk('D', a + 3, 3, ['S', 'D'])];
      return { type: 'mc',
        prompt: 'The heap below holds four entries. The two cheapest, ' + C('A') + ' and ' + C('C') + ', both cost ' + a + '. <b>Which of them is popped first?</b>',
        visual: (el) => { el.innerHTML = heapHTML(ent, { cols: ['seq', 'g', 'path'], noNext: true, caption: 'Heap entries' }); },
        options: [O('A, because it was pushed earlier (pushed #2)', true, 'Equal priorities are broken by the count, which increases with every push: first in, first out.'), O('C, because it was pushed later', false, 'Later pushes have a bigger count, so they lose ties.'), O('Whichever comes first alphabetically', false, 'States are never compared; the count settles it.'), O('It is random', false, 'It is completely deterministic: the same input always gives the same output.')],
        hints: ['Look at the pushed # column.'], explain: 'priority ties → smaller count wins → the earlier push is popped first.' }; } },

  { id: 'u-tie-path', title: 'Two equally cheap routes', parts: ['ties', 'goal', 'push'], level: 3,
    gen: (r) => {
      const first = r.pick(['A', 'B']), tpl = first === 'A' ? TPL.tieAB : TPL.tieBA, w = r.int(2, 4), w2 = r.int(2, 4), ws = [w, w, w2, w2];
      const g = mkGraph(tpl, ws), run = bestFirst(g, {});
      const other = first === 'A' ? 'B' : 'A';
      return { type: 'mc', graph: g,
        prompt: 'Both routes to G cost ' + fmt(w + w2) + '. The successor list of S puts <b>' + first + ' first</b>, then ' + other + '. <b>Which path does your UCS return?</b>',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 't', label: 'Two equal routes' })); },
        options: [O('S → ' + first + ' → G', first === run.path[1], 'Entries for ' + first + ' and ' + other + ' tie at cost ' + w + ' and ' + first + ' was pushed first, so it is popped and expanded first. Its entry for G (pushed first) then wins the next tie too.'), O('S → ' + other + ' → G', other === run.path[1], 'That route is equally cheap, but it was pushed second, so it loses the tie at every step.'), O('Both, returned as a list of two paths', false, 'The function returns exactly one path.'), O('It depends on the random seed', false, 'Nothing here is random.')],
        hints: ['Trace the heap: which entry is pushed first, and what does the count do?'], explain: 'Tie-breaking is first in, first out all the way down: ' + esc(run.path.join(' → ')) + '.' }; } },

  // ---------------------------------------------------------------- 4: goal test and termination
  { id: 'u-goal-why', title: 'Why test the goal on pop?', parts: ['goal', 'optimal'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Your code tests <code>isGoalState</code> on line ' + lineOf('goal_test') + ', right after popping, and not when it pushes a successor. Why?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['pop', 'goal_test', 'return_path'] }); },
      options: [
        O('The popped entry is the cheapest in the heap. If it is the goal, no cheaper route can still be waiting', true, 'A route found at push time is only a candidate; a cheaper one may still be queued. At pop time nothing in the heap is cheaper.'),
        O('It makes the code shorter', false, 'The reason is correctness, not brevity.'),
        O('' + C('isGoalState') + ' can only be called on states that came out of the heap', false, 'It can be called on any state; the problem class has no such restriction.'),
        O('Pushing the goal would crash ' + C('util.PriorityQueue'), false, 'The heap does not care what a state is.')],
      hints: ['Think about the autograder test called goalAtDequeue.'], explain: 'Testing the goal on push would return the first route found, not the cheapest one.' }) },

  { id: 'u-bug-goalpush', title: 'Spot the bug: goal test on push', parts: ['goal', 'optimal', 'push'], level: 2,
    gen: () => { const g = mkGraph(TPL.early, [10, 1, 1, 1]);
      return { type: 'mc', graph: g, demoTitle: 'Run both versions on this graph',
        prompt: 'A classmate moves the goal test: instead of testing the popped state, they return as soon as a <b>pushed</b> successor is the goal. What goes wrong?',
        visual: (el) => { el.innerHTML = codeHTML({ remove: ['goal_test', 'return_path'], replace: { add_cost: 'new_cost = cost + step_cost\n if problem.isGoalState(successor): return path + [action]' } }); },
        options: [O('It can return a costlier path: the first route that reaches the goal is not necessarily the cheapest', true, 'A cheap route may still be sitting in the heap while an expensive direct edge to the goal is found first.'), O('It never finds the goal at all', false, 'It finds a goal, just not necessarily the best one.'), O('It runs forever on cycles', false, 'The visited set still stops cycles; the issue is the answer, not termination.'), O('Nothing: the answer is the same', false, 'Run the demo and compare.')],
        hints: ['Imagine an expensive edge straight from S to the goal.'],
        demo: (el) => { const good = bestFirst(g, {}), bad = bestFirst(g, { goalOnPush: true }); demoPair(el, g, { title: 'Your version (goal test on pop)', run: good, ok: true, text: runText(good, good.cost) }, { title: 'Goal test on push', run: bad, ok: false, text: runText(bad, good.cost) }); },
        explain: 'On this graph the direct edge S → G costs 10, so it is found first. The cheaper route S → A → B → G costs 3 but is still being built. Testing on pop returns 3.' }; } },

  { id: 'u-start-goal', title: 'The start is already the goal', parts: ['goal', 'fail', 'pop'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Suppose <code>problem.getStartState()</code> already satisfies <code>isGoalState</code>. What does your <code>uniformCostSearch</code> return, and how many states does it expand?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['push_start', 'pop', 'goal_test', 'return_path'] }); },
      options: [O('It returns ' + C('[]') + ' and expands nothing', true, 'The start entry is popped first, passes the stale check, and the goal test succeeds before ' + C('visited.add') + ' or any expansion happens. Its path is the empty list.'), O('It returns ' + C('[]') + ' after expanding the start once', false, 'The goal test (line ' + lineOf('goal_test') + ') comes before the expansion (line ' + lineOf('mark') + ').'), O('It returns ' + C('None'), false, 'It returns the entry\'s path, which is the empty list.'), O('It raises an exception because the heap has no successors', false, 'Nothing is ever asked of the heap beyond the first pop.')],
      hints: ['Follow the very first pop through lines ' + lineOf('check_visited') + ' to ' + lineOf('return_path') + '.'], explain: 'Zero expansions, empty path: exactly what a goal-at-the-start should give.' }) },

  { id: 'u-nopath', title: 'No route exists', parts: ['fail', 'mark'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'The goal is walled off, so no path exists. What does your function do?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['while', 'mark', 'return_empty'] }); },
      options: [O('It expands every reachable state once, the heap runs empty, and it returns ' + C('[]'), true, 'visited stops any state being expanded twice, so the heap can only shrink to empty, and line ' + lineOf('return_empty') + ' runs.'), O('It loops forever', false, 'It would without the visited set (see the bug question), but your visited check guarantees every reachable state is expanded at most once.'), O('It raises an ' + C('IndexError') + ' when it pops an empty heap', false, 'The loop condition ' + C('while not to_visit.isEmpty()') + ' stops before popping an empty heap.'), O('It returns the path to the closest reachable state', false, 'Nothing like that is tracked.')],
      hints: ['What ends the while loop, and what follows it?'], explain: 'Termination is guaranteed by finiteness plus the visited set: each state is expanded at most once.' }) },

  // ---------------------------------------------------------------- 5: bugs
  { id: 'u-bug-novisited', title: 'Spot the bug: no visited set', parts: ['mark', 'stale', 'filter', 'fail'], level: 2,
    gen: () => { const g = mkGraph(TPL.cycle, [1, 1, 1, 5]), gDead = mkGraph({ pos: TPL.cycle.pos, edges: TPL.cycle.edges.slice(0, 3) }, [1, 1, 1]);
      return { type: 'mc', demoTitle: 'Count the expansions',
        prompt: 'A classmate deletes every use of <code>visited</code> (the stale check, the successor filter and the add). The graph contains a cycle S → A → B → S. What happens?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'nv', label: 'Cycle' })) + '<div>' + codeHTML({ remove: ['check_visited', 'skip', 'mark'], replace: { check_succ: 'if True:' } }) + '</div>'; },
        options: [O('States are expanded again and again around the cycle. It wastes work when a path exists and never stops when none does', true, 'Without visited nothing remembers that S, A, B were already expanded, so their entries keep coming back with ever larger costs.'), O('It returns a cheaper path than before', false, 'Costs only grow around a cycle, so it cannot find a cheaper path by going round again.'), O('Nothing: the priority queue already prevents repeats', false, 'The heap orders entries; it has no memory of expanded states.'), O('It crashes on the first pop', false, 'It runs fine for a while, which is what makes the bug sneaky.')],
        hints: ['Follow S → A → B → S and ask what stops S being expanded again.'],
        demo: (el) => { const ok = bestFirst(g, {}), noV = bestFirst(g, { noVisited: true, maxPops: 400 }), dead = bestFirst(gDead, { noVisited: true, maxPops: 60 });
          el.innerHTML = '<div class="pair"><div><h5>Goal reachable (S → … → G exists)</h5><div class="res ok">With visited: <b>' + ok.expansions + ' expansions</b>.</div><div class="res bad">Without visited: <b>' + noV.expansions + ' expansions</b> for the same answer (cost ' + fmt(noV.cost) + ').</div></div><div><h5>Goal NOT reachable (edge B → G removed)</h5><div class="res bad">Without visited: still going after <b>' + dead.pops + ' pops</b>. I stopped it there; it would never end.</div></div></div>'; },
        explain: 'visited is what makes the search finite on graphs with cycles, and what keeps the work proportional to the number of states.' }; } },

  { id: 'u-bug-visitedpush', title: 'Spot the bug: visited marked on push', parts: ['mark', 'filter', 'optimal'], level: 3,
    gen: () => { const g = mkGraph(TPL.later, [1, 5, 1, 1]);
      return { type: 'mc', graph: g, demoTitle: 'Run both versions on this graph',
        prompt: 'A classmate adds a state to <code>visited</code> the moment it is <b>pushed</b>, not when it is popped, so a queued state is never pushed again. On this graph, what is the effect?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'vp', label: 'Graph' })) + '<div>' + codeHTML({ remove: ['mark'], replace: { push_succ: 'to_visit.push((successor, path + [action], new_cost), new_cost)\n visited.add(successor)' } }) + '</div>'; },
        options: [O('A state is locked in with the first cost it is queued at. A cheaper route found later is thrown away, so the answer can be too expensive', true, 'S queues B at cost 5 directly. Then A is expanded and finds B at cost 2, but B is "visited" so that cheaper route is never pushed.'), O('It is just faster and always as good', false, 'Faster, yes. As good, no: run the demo.'), O('It loops forever', false, 'It terminates; it just gives a worse answer.'), O('It only matters when step costs are equal', false, 'With equal costs the first route found is the cheapest, so it is harmless there. The bug needs different costs.')],
        hints: ['At what point does the cheaper route to B appear, and what has already happened to B?'],
        demo: (el) => { const good = bestFirst(g, {}), bad = bestFirst(g, { skipIfQueued: true }); demoPair(el, g, { title: 'Your version (visited on expand)', run: good, ok: true, text: runText(good, good.cost) }, { title: 'Visited on push', run: bad, ok: false, text: runText(bad, good.cost) }); },
        explain: 'Marking visited on pop means the cheapest route to each state is the one that gets expanded, because the cheapest entry always pops first.' }; } },

  { id: 'u-skip-queued', title: 'Your BFS idea, in UCS', parts: ['filter', 'mark', 'optimal', 'constant'], level: 3,
    gen: (r) => ({ type: 'multi',
      prompt: 'In BFS you used the idea <i>"skip a successor that is already waiting in the queue"</i>. <b>Tick every true statement</b> about that idea.',
      options: [
        O('In BFS it is safe: states are reached in order of distance, so the first time a state is queued is also the cheapest', true, 'BFS pops in nondecreasing depth, so the first route to a state is a fewest-moves route.'),
        O('In UCS on a graph where each <i>edge</i> has its own cost, it is safe', false, 'Not safe: a state can be queued by a dear edge first and reached by a cheaper route later. Two parallel edges of cost 5 then 2 already break it.'),
        O('In UCS on a maze, where the cost belongs to the <i>cell you step into</i>, it happens to be safe', true, 'Entering a cell costs the same from any neighbour, so the parent popped earliest (smallest g) gives the smallest new g. The first discovery is the cheapest.'),
        O('Your ' + C('uniformCostSearch') + ' uses this shortcut', false, 'It pushes every unvisited successor, even if one is already queued, and skips the stale copy later.')],
      demoTitle: 'Where the idea breaks',
      demo: (el) => { const g = mkGraph(TPL.later, [1, 5, 1, 1]), good = bestFirst(g, {}), bad = bestFirst(g, { skipIfQueued: true }); demoPair(el, g, { title: 'Correct UCS', run: good, ok: true, text: runText(good, good.cost) }, { title: 'Skip successors already queued', run: bad, ok: false, text: runText(bad, good.cost) }); },
      hints: ['The question is whether the first route found to a state is always the cheapest one.'], explain: 'This is why BFS can skip queued states and UCS must not in general. In mazes it is safe only because of how the cost is defined.' }) },

  { id: 'u-bug-ignorecost', title: 'Spot the bug: priority is the step cost', parts: ['cost', 'push', 'optimal'], level: 3,
    gen: () => { const g = mkGraph(TPL.ign, [1, 4, 6, 5]);
      return { type: 'mc', graph: g, demoTitle: 'Run both versions on this graph',
        prompt: 'A classmate pushes with <code>step_cost</code> as the priority instead of <code>new_cost</code>. What is wrong?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'ic', label: 'Graph' })) + '<div>' + codeHTML({ replace: { push_succ: 'to_visit.push((successor, path + [action], new_cost), step_cost)' } }) + '</div>'; },
        options: [O('The heap now orders by the last edge only, forgetting what it cost to get there, so it can return a costlier path', true, 'The entry for G via B has the smallest last edge (5) so it pops first, even though that route costs 9 in total.'), O('Nothing: the cost is still stored in the entry', false, 'The stored cost is not what orders the heap; the priority is.'), O('It becomes BFS', false, 'BFS orders by number of moves, not by the last edge.'), O('It becomes A*', false, 'There is no heuristic involved.')],
        hints: ['Which number does the heap sort by, and what does it leave out?'],
        demo: (el) => { const good = bestFirst(g, {}), bad = bestFirst(g, { ignoreCost: true }); demoPair(el, g, { title: 'priority = new_cost (yours)', run: good, ok: true, text: runText(good, good.cost) }, { title: 'priority = step_cost', run: bad, ok: false, text: runText(bad, good.cost) }); },
        explain: 'Uniform cost means ordering by the <b>path</b> cost g, not by one edge.' }; } },

  { id: 'u-negative', title: 'What UCS needs from the costs', parts: ['optimal', 'cost', 'goal'], level: 3,
    gen: () => { const g = mkGraph(TPL.neg, [1, 2, 4, -3]);
      return { type: 'mc', graph: g, demoTitle: 'Run UCS on this graph',
        prompt: 'This graph has one negative edge, B → A with cost −3. Which assumption about step costs does UCS rely on, and what happens here?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { uid: 'ng', label: 'Graph with a negative edge' })); },
        options: [O('Step costs must not be negative, so extending a path can never make it cheaper. Here UCS returns a path that is not the cheapest', true, 'S → B → A → G costs 2 − 3 + 4 = 3, but A was already expanded at cost 1 before the cheaper route through B was seen, so UCS answers 5.'), O('Step costs must all be equal. Here UCS fails because they are not', false, 'UCS works with unequal costs; that is its point.'), O('Costs must be integers, which they are, so UCS is correct here', false, 'Integers are not the issue; the sign is.'), O('There is no assumption: UCS is optimal on every graph', false, 'It needs non-negative costs. The demo shows a failure.')],
        hints: ['Once a state is expanded, UCS assumes it can never be reached more cheaply.'],
        demo: (el) => { const bad = bestFirst(g, {}); const best = 3; demoPair(el, g, { title: 'UCS with the negative edge', run: bad, ok: false, text: runText(bad, best) }, { title: 'The true cheapest path', run: { path: ['S', 'B', 'A', 'G'], found: true, cost: 3 }, ok: true, text: 'Path <b>S → B → A → G</b>, cost <b>3</b>' }); },
        explain: 'Non-negative costs are what make "the cheapest entry in the heap" final.' }; } },

  // ---------------------------------------------------------------- 6: constant vs variable
  { id: 'u-const1', title: 'Every step costs 1', parts: ['constant', 'ties'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'In a maze every step costs exactly 1. Your <code>uniformCostSearch</code> then behaves like which algorithm you wrote earlier?',
      options: [O('Breadth-first search', true, 'With equal step costs, the cheapest entry is the one with the fewest moves, and ties pop first in, first out, exactly like a queue.'), O('Depth-first search', false, 'DFS follows the newest entry, not the cheapest.'), O('A* with the Manhattan heuristic', false, 'A* adds a heuristic; UCS has none.'), O('A completely different search with no relation', false, 'On unit costs UCS and BFS even expand the same number of states.')],
      hints: ['What is the cheapest entry when every edge costs 1?'], explain: 'Both expanded 269 states on mediumMaze in the autograder.' }) },

  { id: 'u-const7', title: 'Every step costs 7', parts: ['constant', 'cost'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Now every step costs <b>7</b> instead of 1. Do you have to change anything in <code>uniformCostSearch</code>, and what does it return?',
      options: [O('Nothing changes. It returns the same path as for cost 1, and the path cost is 7 times the number of moves', true, 'Every priority is just 7 times bigger; the order of entries is unchanged.'), O('You must divide all costs by 7 first, or it returns wrong answers', false, 'UCS is happy with any constant.'), O('It stops being optimal, so you should switch to BFS', false, 'It stays optimal; BFS would find the same path, which is the point.'), O('It returns a longer path', false, 'It returns the same fewest-moves path.')],
      hints: ['Does multiplying every priority by 7 change which entry is the smallest?'], explain: 'This is the "constant or variable" idea: the same function handles both.' }) },

  { id: 'u-maze-route', title: 'Cheaper is not shorter', parts: ['cost', 'optimal', 'constant'], level: 2,
    gen: (r) => { const f = swampField(r), [x0, x1] = f.box;
      return { type: 'mc', demoTitle: 'The two routes, side by side',
        prompt: 'The purple patch is a swamp where each step costs <b>9</b> (everywhere else costs 1). Pacman starts on the left and the pellet is on the right. A straight line crosses the swamp. <b>Which route does UCS return?</b>',
        visual: (el) => { el.innerHTML = canvasHTML('cvA') + '<p class="cap" style="flex:1 1 100%">Brighter purple = more expensive cell. Swamp columns ' + x0 + ' to ' + x1 + '.</p>'; drawGrid(el.querySelector('#cvA'), f.gr, { cs: 20, tint: true }); },
        options: [O('The longer route around the swamp, because it costs less in total', true, 'Crossing costs about 9 per swamp cell. Walking around adds a few moves at cost 1 each, which is much cheaper.'), O('The straight route through the swamp, because it has the fewest moves', false, 'Fewest moves is what BFS minimises. UCS minimises total cost.'), O('Either one: they cost the same', false, 'Run the demo to see the totals.'), O('UCS refuses to cross cells costing more than 1', false, 'It crosses them if that is the cheapest way.')],
        hints: ['Add up the cost of crossing the swamp compared with walking around it.'],
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>BFS: fewest moves</h5>' + canvasHTML('dA') + '<div class="res bad"><b>' + f.bfs.path.length + ' moves</b>, cost <b>' + pathCostOnGrid(f.gr, f.bfs.path) + '</b></div></div><div><h5>UCS: cheapest</h5>' + canvasHTML('dB') + '<div class="res ok"><b>' + f.ucs.path.length + ' moves</b>, cost <b>' + f.ucs.cost + '</b></div></div></div>'; drawGrid(el.querySelector('#dA'), f.gr, { cs: 10, tint: true, path: f.bfs.path }); drawGrid(el.querySelector('#dB'), f.gr, { cs: 10, tint: true, path: f.ucs.path }); },
        explain: 'With variable costs UCS will take more moves to pay less. With constant costs it can not, which is why it matches BFS there.' }; } },

  { id: 'u-sumcost', title: 'Add up a path', parts: ['cost', 'optimal'], level: 1,
    gen: (r) => {
      const { g, run } = find(r, (rr) => ladderG(rr), (gg, rn) => rn.found && rn.path.length >= 4);
      const p = run.path;
      return { type: 'numeric', answer: run.cost, tol: 0, graph: g,
        prompt: 'UCS returns the path ' + C(p.join(' → ')) + '. <b>What is its total cost?</b>',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { path: p, uid: 'sc', label: 'Graph with the path in green' })); },
        hints: ['Add the weights of the edges along the green path.'], explain: 'Total = ' + p.slice(0, -1).map((n, i) => fmt(g.edges.find((e) => e.u === n && e.v === p[i + 1]).w)).join(' + ') + ' = <b>' + fmt(run.cost) + '</b>.' }; } },

  // ---------------------------------------------------------------- 7: why it works and how it looks
  { id: 'u-optimal-why', title: 'Why is the first goal pop optimal?', parts: ['optimal', 'goal', 'pop'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'When the goal entry is finally popped, why is its path guaranteed to be a cheapest path?',
      options: [O('Entries are popped in nondecreasing cost, so any cheaper route to the goal would already have been popped first', true, 'Costs never decrease along a path (non-negative steps), so a cheaper route would have had its entry come out before this one.'), O('Because UCS tries every path and keeps the best', false, 'It never enumerates all paths; it stops at the first goal pop.'), O('Because it uses a heuristic that points at the goal', false, 'UCS has no heuristic.'), O('Because the goal is the last state in the graph', false, 'Position in the graph is irrelevant.')],
      hints: ['Think about what would have to be true of a cheaper route\'s entries.'], explain: 'Cheapest-first + goal test on pop + non-negative costs = optimal.' }) },

  { id: 'u-shape', title: 'Which picture is UCS?', parts: ['optimal', 'constant', 'pop'], level: 3,
    gen: (r) => { const gr = shapeField(r), algos = [['bfs', 'BFS (ignores costs)'], ['dfs', 'DFS'], ['ucs', 'UCS'], ['astar', 'A* with Manhattan']];
      const runs = algos.map((a) => ({ k: a[0], label: a[1], res: gridSearch(gr, a[0]) })), target = 'ucs';
      return { type: 'mc', visualOptions: true, fixedOrder: false,
        prompt: 'Each picture shows the cells (red) that one search had expanded when it found the pellet, on the same maze. The purple band is expensive (cost 9). <b>Which picture is UCS?</b>',
        options: runs.map((x) => { const o = O('<canvas class="board"></canvas>', x.k === target, x.k === 'ucs' ? 'UCS spreads out like a wave of equal cost, and avoids the expensive band.' : x.k === 'bfs' ? 'BFS spreads by number of moves, so it floods straight through the expensive band. It has no idea about costs.' : x.k === 'dfs' ? 'DFS dives down one corridor and backtracks: a long snake, not a wave.' : 'A* leans towards the goal because the heuristic pulls it there. UCS has no such pull.'); o.draw = (cv) => drawGrid(cv, gr, { cs: 7, tint: true, order: x.res.order, path: x.res.path }); return o; }),
        hints: ['UCS spreads in all directions but cheapest-first, so the expensive band is entered late.'], explain: 'UCS expands every cell cheaper than the goal. The band is expensive, so it is reached later and covered less than BFS covers it.' }; } },

  { id: 'u-bfs-same', title: 'BFS and UCS look identical', parts: ['constant', 'ties', 'optimal'], level: 2,
    gen: (r) => { const gr = openField(22, 11, [{ x: 11, y0: 2, y1: 8 }]); gr.start = [3, 5]; gr.goal = [18, 5];
      const b = gridSearch(gr, 'bfs'), u = gridSearch(gr, 'ucs');
      return { type: 'mc',
        prompt: 'On this unit-cost maze the cells expanded by BFS (left) and UCS (right) are exactly the same, in the same order. Why?',
        visual: (el) => { el.innerHTML = '<div><h5 style="margin:0 0 4px">BFS</h5>' + canvasHTML('cb') + '</div><div><h5 style="margin:0 0 4px">UCS</h5>' + canvasHTML('cu') + '</div>'; drawGrid(el.querySelector('#cb'), gr, { cs: 10, order: b.order, path: b.path }); drawGrid(el.querySelector('#cu'), gr, { cs: 10, order: u.order, path: u.path }); },
        options: [O('With equal step costs the cheapest entry is the one with the fewest moves, and ties pop first in, first out. UCS reduces to BFS', true, 'Both expanded ' + b.order.length + ' cells here.'), O('UCS secretly calls BFS when it detects equal costs', false, 'The code has no such branch; the behaviour just falls out of the ordering.'), O('It is a coincidence of this particular maze', false, 'It happens on every maze with constant step cost.'), O('Both ignore the costs, so they ignore the maze too', false, 'Neither ignores walls. The point is that on unit costs "cheapest" and "fewest moves" mean the same.')],
        hints: ['Which entry is cheapest when every step costs 1?'], explain: 'The autograder agrees: UCS and BFS both expand 269 states on mediumMaze.' }; } },

  { id: 'u-facts', title: 'True or false about UCS', parts: ['optimal', 'structure', 'constant'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: '<b>Tick every statement that is true</b> about your <code>uniformCostSearch</code>.',
      options: [O('It is Dijkstra\'s algorithm, stopped when the goal is popped', true, 'Same idea: always settle the cheapest unexpanded state next.'), O('Before it returns, it has expanded every state whose cost is below the optimal cost', true, 'Anything cheaper than the goal pops first, so it is expanded before the goal is popped.'), O('It needs a heuristic to find an optimal path', false, 'No heuristic is involved at all.'), O('It still finds the cheapest path when some step costs are negative', false, 'Non-negative costs are required.'), O('It looks in the direction of the goal and ignores the rest', false, 'It has no sense of direction: it spreads out evenly by cost, which is why A* exists.')],
      hints: ['Two are about what UCS guarantees; the other three describe other algorithms.'], explain: 'UCS is optimal and complete for non-negative costs, with no sense of direction.' }) },

  // ---------------------------------------------------------------- 8: reading and changing your own code
  { id: 'u-alias', title: 'Shared lists in the path', parts: ['push', 'cost', 'structure'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'Line ' + lineOf('push_succ') + ' builds the new path with <code>path + [action]</code>. A classmate "optimises" it to <code>path.append(action)</code> and pushes <code>path</code>. What goes wrong?',
      visual: (el) => { el.innerHTML = codeHTML({ replace: { push_succ: 'path.append(action); to_visit.push((successor, path, new_cost), new_cost)' } }); },
      demoTitle: 'Watch the lists',
      options: [O('Every entry pushed from the same parent shares ONE list object, so their paths overwrite each other', true, C('+') + ' makes a fresh list for each entry; ' + C('append') + ' mutates the one list they all point to.'), O('Nothing: append is just a faster way to write the same thing', false, 'It is faster, but it changes the shared list instead of creating a new one.'), O('It raises a ' + C('TypeError'), false, 'It runs; the answers are just wrong.'), O('The priority becomes wrong', false, 'The priority is untouched; the paths are what break.')],
      hints: ['How many entries are pushed from one parent, and how many list objects are there?'],
      demo: (el) => { const shared = []; const bad = ['N', 'E', 'S'].map((a) => { shared.push(a); return shared; }); const good = ['N', 'E', 'S'].map((a) => [].concat([], [a]));
        el.innerHTML = '<div class="pair"><div><h5>path + [action] (yours)</h5><div class="res ok">entry for N: <b>' + esc(JSON.stringify(good[0])) + '</b><br>entry for E: <b>' + esc(JSON.stringify(good[1])) + '</b><br>entry for S: <b>' + esc(JSON.stringify(good[2])) + '</b></div></div><div><h5>path.append(action)</h5><div class="res bad">entry for N: <b>' + esc(JSON.stringify(bad[0])) + '</b><br>entry for E: <b>' + esc(JSON.stringify(bad[1])) + '</b><br>entry for S: <b>' + esc(JSON.stringify(bad[2])) + '</b><br>all three are the same list</div></div></div>'; },
      explain: 'Three successors of one state would each get the path [N, E, S]. This kind of aliasing bug is why you build a new list per entry.' }) },

  { id: 'u-continue', title: 'What if continue became return?', parts: ['stale', 'fail', 'goal'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'A classmate changes <code>continue</code> on line ' + lineOf('skip') + ' into <code>return []</code>. What breaks?',
      visual: (el) => { el.innerHTML = codeHTML({ replace: { skip: 'return []' } }); },
      options: [O('The first stale duplicate ends the whole search with "no path", even though the heap still holds good entries', true, 'A stale entry only means "this copy is not needed", not "the search is over".'), O('Nothing: stale entries mean the search is finished', false, 'Stale entries are routine; most runs pop several.'), O('It returns the best path so far', false, 'It returns the empty list, which means "no path".'), O('It only matters when the graph has no cycles', false, 'Stale entries can appear on acyclic graphs too.')],
      hints: ['What does ' + C('continue') + ' do inside a while loop?'], explain: C('continue') + ' moves on to the next heap entry; ' + C('return []') + ' abandons everything.' }) },

  { id: 'u-return-empty', title: 'When does return [] run?', parts: ['fail', 'succ'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'The last line of your function is <code>return []</code> (line ' + lineOf('return_empty') + '). When does it run?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['while', 'return_empty'] }); },
      options: [O('Only when the while loop finishes because the heap is empty: no goal was reachable', true, 'Whenever a goal is found the function has already returned its path from inside the loop.'), O('At the end of every successful search, after the path is returned', false, 'A function stops at the first ' + C('return') + '.'), O('Whenever the start state is visited', false, 'Nothing special happens to the start.'), O('When a stale entry is popped', false, 'Stale entries use ' + C('continue') + '.')],
      hints: ['What ends a while loop that has no break and no return?'], explain: 'It is the "heap ran dry" exit.' }) }
];

return {
  algo: 'ucs', func: 'uniformCostSearch', title: 'UCS Evaluation', subtitle: 'A teacher\'s check: do you really know how your uniformCostSearch works?',
  welcomeTitle: 'Let\'s see what you really know about Uniform Cost Search',
  intro: '<p class="prompt">Passing the autograder shows the code works. It does not show you understand it. In this evaluation I will test every part of the algorithm, using <b>your own code</b>, until I am sure you can explain each line and predict what it does.</p>',
  minPerPart: 2, groups, parts, questions
};
