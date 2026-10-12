const { esc, fmt, mkGraph, bestFirst, trueDist, checkH, niceH, gSVG, heapHTML, codeHTML, lineOf, textOf, parseMaze, openField, gridSearch, drawGrid, canvasHTML } = H;
const O = (html, ok, why) => ({ html, ok: !!ok, why: why || '' });
const C = (s) => '<code>' + s + '</code>';
const wrapV = (inner) => '<div style="flex:1 1 440px;min-width:0">' + inner + '</div>';

// ---------------------------------------------------------------- graph templates
const POS7 = { S: [44, 130], A: [160, 46], B: [160, 130], C: [160, 214], D: [290, 74], E: [290, 186], G: [396, 130] };
const TPL = {
  ladder: { pos: POS7, edges: [['S', 'A'], ['S', 'B'], ['S', 'C'], ['A', 'D'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['D', 'G'], ['E', 'G']] },
  early: { pos: { S: [50, 130], A: [160, 50], B: [280, 50], G: [396, 130] }, edges: [['S', 'G'], ['S', 'A'], ['A', 'B'], ['B', 'G']] },
  later: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'B'], ['B', 'G']] },
  greedy: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'G'], ['B', 'G']] },
  inc: { pos: { S: [50, 130], A: [210, 46], B: [210, 214], G: [390, 130] }, edges: [['S', 'A'], ['S', 'B'], ['A', 'B'], ['A', 'G'], ['B', 'G'], ['B', 'A']] },
  // the autograder's astar_1_graph_heuristic test, edge for edge
  auto: { pos: { S: [44, 130], A: [160, 46], B: [160, 214], C: [290, 46], D: [290, 214], G: [396, 130] },
    edges: [['S', 'A'], ['S', 'B'], ['S', 'D'], ['A', 'C'], ['A', 'S'], ['B', 'D'], ['B', 'S'], ['C', 'A'], ['C', 'D'], ['C', 'G'], ['D', 'B'], ['D', 'C'], ['D', 'G'], ['D', 'S']] }
};
const AUTO_W = [2, 3, 5, 3, 2, 4, 3, 3, 1, 2, 4, 1, 5, 5];
const AUTO_H = { S: 6, A: 2.5, B: 5.25, C: 1.125, D: 1.0625, G: 0 };
const WEB_POS = { S: [44, 130], A: [150, 46], B: [150, 214], C: [280, 130], D: [280, 214], G: [396, 60] };
const WEB_PAIRS = [['S', 'A'], ['S', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'G'], ['D', 'G']];
function webGraph(ws) { const edges = [], w = []; WEB_PAIRS.forEach((p, i) => { edges.push([p[0], p[1]], [p[1], p[0]]); w.push(ws[i], ws[i]); }); return mkGraph({ pos: WEB_POS, edges }, w); }

const withH = (g, alpha) => { g.h = niceH(g, alpha); return g; };
function find(r, make, check, tries) { let last; for (let t = 0; t < (tries || 300); t++) { const g = make(r); const run = bestFirst(g, { kind: 'astar' }); last = { g, run }; if (check(g, run)) return last; } return last; }
const ladderG = (r) => withH(mkGraph(TPL.ladder, TPL.ladder.edges.map(() => r.int(1, 7))), r.pick([0.5, 0.75]));
const webG = (r) => withH(webGraph(WEB_PAIRS.map(() => r.int(1, 6))), r.pick([0.5, 0.75]));
const byInsertion = (list) => list.slice().sort((a, b) => a.seq - b.seq);
const hAnnot = (g) => { const a = {}; Object.keys(g.pos).forEach((n) => { a[n] = ['h=' + fmt(g.h[n])]; }); return a; };
const pathCostOnGrid = (gr, path) => { let x = gr.start[0], y = gr.start[1], c = 0; for (const a of path) { const d = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[a]; x += d[0]; y += d[1]; c += gr.cost[x][y]; } return c; };
const manh = (gr) => (x, y) => Math.abs(x - gr.goal[0]) + Math.abs(y - gr.goal[1]);
function gridDist(gr) { const W = gr.W, d = new Array(W * gr.H).fill(Infinity), q = [gr.goal[0] + gr.goal[1] * W]; d[q[0]] = 0; for (let i = 0; i < q.length; i++) { const id = q[i], x = id % W, y = (id - x) / W; for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dd[0], ny = y + dd[1]; if (gr.wall[nx][ny] || d[nx + ny * W] !== Infinity) continue; d[nx + ny * W] = d[id] + 1; q.push(nx + ny * W); } } return (x, y) => d[x + y * W]; }

function demoPair(el, g, A, B) {
  el.innerHTML = '<div class="pair">' + [A, B].map((x, i) => '<div><h5>' + x.title + '</h5>' + gSVG(g, { path: x.run.path, uid: 'd' + i + (x.uid || ''), label: x.title, annot: x.annot }) + '<div class="res ' + (x.ok ? 'ok' : 'bad') + '">' + x.text + '</div></div>').join('') + '</div>';
}
const runText = (run, opt) => (run.found ? 'Path <b>' + esc(run.path.join(' → ')) + '</b>, cost <b>' + fmt(run.cost) + '</b>' + (opt !== undefined ? (Math.abs(run.cost - opt) < 1e-9 ? ' ✓ optimal' : ' ✗ (the optimum is ' + fmt(opt) + ')') : '') : 'no path found');
const optimum = (g) => bestFirst(Object.assign({}, g, { h: null }), { kind: 'ucs' }).cost;

function shapeField(r) {
  const gr = openField(26, 13, [{ x: 12, y0: 3, y1: 9 }]); gr.start = [3, 6]; gr.goal = [22, 6];
  return gr;
}
function rankField(r) {
  for (let t = 0; t < 120; t++) {
    const wx = r.int(9, 13), a = r.int(2, 4), b = r.int(8, 10), gr = openField(26, 13, [{ x: wx, y0: a, y1: b }, { x: wx + 4, y0: 1, y1: r.int(5, 7) }]); gr.start = [3, 6]; gr.goal = [22, 6];
    const hs = [['perfect heuristic (exact cost to go)', gridDist(gr)], ['Manhattan distance', manh(gr)], ['Euclidean distance', (x, y) => Math.sqrt((x - gr.goal[0]) ** 2 + (y - gr.goal[1]) ** 2)], ['null heuristic (h = 0)', () => 0]];
    const res = hs.map((x) => ({ name: x[0], n: gridSearch(gr, 'astar', { h: x[1] }).order.length }));
    if (res[0].n < res[1].n && res[1].n < res[2].n && res[2].n < res[3].n) return { gr, res };
  }
  const gr = shapeField(r), hs = [['perfect heuristic (exact cost to go)', gridDist(gr)], ['Manhattan distance', manh(gr)], ['Euclidean distance', (x, y) => Math.sqrt((x - gr.goal[0]) ** 2 + (y - gr.goal[1]) ** 2)], ['null heuristic (h = 0)', () => 0]];
  return { gr, res: hs.map((x) => ({ name: x[0], n: gridSearch(gr, 'astar', { h: x[1] }).order.length })) };
}

// ---------------------------------------------------------------- the bank
const parts = [
  { id: 'setup', group: 'setup', label: 'Heap, h(start) and visited', review: 'Re-read how the start entry is pushed: cost 0, priority h(start). Every entry carries (state, path, g); the priority is f.' },
  { id: 'pop', group: 'loop', label: 'Pop the lowest f', review: 'The heap pops the lowest f = g + h, which is not always the lowest g. Practise reading a heap table with g and h columns.' },
  { id: 'stale', group: 'loop', label: 'Skip stale duplicates', review: 'A state can be queued twice. The lower-f copy pops first and expands; the later copy is skipped by the visited check.' },
  { id: 'goal', group: 'loop', label: 'Goal test, on pop', review: 'Test the goal when an entry is popped, not when it is pushed: a cheaper route may still be queued.' },
  { id: 'mark', group: 'loop', label: 'Mark visited (expand)', review: 'A state enters visited when it is popped and expanded. That is why a cheaper route can still be pushed while a state is only queued.' },
  { id: 'succ', group: 'loop', label: 'Generate successors', review: 'Practise predicting the order of expansion; getSuccessors lists neighbours in a fixed order.' },
  { id: 'filter', group: 'loop', label: 'Skip visited successors', review: 'Only visited successors are skipped. A successor merely waiting in the heap must still be pushed.' },
  { id: 'cost', group: 'loop', label: 'Add up g', review: 'new_cost = cost + step_cost is g, the real cost so far. It is never replaced by h.' },
  { id: 'heur', group: 'loop', label: 'Ask the heuristic: h', review: 'h(successor, problem) is called once for every pushed successor and estimates the cost still to go from that successor.' },
  { id: 'push', group: 'loop', label: 'Push with f = g + h', review: 'The priority is new_cost + heuristic(successor, problem). The entry still stores g (new_cost), not f.' },
  { id: 'fail', group: 'exit', label: 'Heap empty: no solution', review: 'If the heap empties no path exists and the function returns []. The start being the goal returns [] with no expansions.' },
  { id: 'admissible', group: 'theory', label: 'Admissible heuristics', review: 'Admissible means h(n) never exceeds the true cost from n to the goal. Compute true costs from the goal backwards when auditing.' },
  { id: 'consistent', group: 'theory', label: 'Consistent heuristics', review: 'Consistent means h(u) <= cost(u, v) + h(v) on every edge. It implies admissible and makes f never decrease along a path.' },
  { id: 'inconsistent', group: 'theory', label: 'When consistency fails', review: 'With an admissible but inconsistent heuristic, graph-search A* can expand a state with a non-optimal g and return a costlier path.' },
  { id: 'nullcase', group: 'theory', label: 'h = 0 is UCS', review: 'With h = 0 the priority is just g, so A* behaves exactly like uniform cost search.' },
  { id: 'greedy', group: 'theory', label: 'Greedy vs A*', review: 'Greedy best-first uses only h. It is fast but gives no optimality guarantee; A* adds g, which is what makes it optimal.' },
  { id: 'quality', group: 'theory', label: 'Heuristic quality and work', review: 'A better-informed admissible heuristic (closer to the true cost) expands fewer states. Perfect h expands about the path; h = 0 expands like UCS.' },
  { id: 'ties', group: 'theory', label: 'Ties in f', review: 'Equal f values pop in the order they were pushed (first in, first out) in your code.' }
];
const groups = [{ id: 'setup', label: 'Set up', arrow: true }, { id: 'loop', label: 'The loop: repeat until the goal is popped', arrow: true }, { id: 'exit', label: 'If the heap runs empty', arrow: false }, { id: 'theory', label: 'Ideas behind it', arrow: false }];

const questions = [
  // ---------------------------------------------------------------- 1: the shape of the algorithm
  { id: 'a-steps', title: 'Put the algorithm in order', parts: ['setup', 'pop', 'stale', 'goal', 'mark', 'succ', 'filter', 'cost', 'heur', 'push', 'fail'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'These are the steps of <code>aStarSearch</code>, shuffled. Click them in the order the algorithm performs them.',
      items: [
        'Compute ' + C('h(start)') + ' and push ' + C('(start, [], 0)') + ' with that priority; create an empty ' + C('visited') + ' set.',
        'While the heap is not empty: pop the entry with the lowest ' + C('f') + '.',
        'If its state is already in ' + C('visited') + ', skip the entry.',
        'If its state is the goal, return its ' + C('path') + '.',
        'Add the state to ' + C('visited') + '.',
        'For each unvisited successor: ' + C('new_cost = cost + step_cost') + '.',
        'Ask the heuristic for the successor and form ' + C('priority = new_cost + h(successor)') + '.',
        'Push ' + C('(successor, path + [action], new_cost)') + ' with that priority.',
        'When the loop ends because the heap is empty, return ' + C('[]') + '.'],
      hints: ['The priority needs g first, then h; only then can the entry be pushed.', 'The goal test and the visited check come before successors are generated.'],
      explain: 'In your code: the start push is line ' + lineOf('push_start') + ', the pop line ' + lineOf('pop') + ', the stale check ' + lineOf('check_visited') + ', the goal test ' + lineOf('goal_test') + ', visited.add ' + lineOf('mark') + ', g is computed on ' + lineOf('add_cost') + ', f on ' + lineOf('add_h') + ' and the push is line ' + lineOf('push_succ') + '.' }) },

  { id: 'a-priority', title: 'What is the priority of an entry?', parts: ['push', 'heur', 'cost'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Look at how your code pushes a successor. What number is the <b>priority</b> that the heap sorts by?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['add_cost', 'add_h', 'push_succ'] }); },
      options: [
        O(C('f = g + h') + ': the cost so far plus the heuristic estimate for the successor', true, 'g is ' + C('new_cost') + ' and h is ' + C('heuristic(successor, problem)') + '. Together they estimate the cost of the best path that goes through this state.'),
        O(C('g') + ' only, the cost so far', false, 'That is uniform cost search. It ignores the goal entirely.'),
        O(C('h') + ' only, the heuristic estimate', false, 'That is greedy best-first search. It is fast but not optimal.'),
        O('The step cost of the last move', false, 'Neither A* nor UCS sorts by a single edge.')],
      hints: ['Read line ' + lineOf('add_h') + '.'], explain: 'A* is "uniform cost search plus a guess about the remaining cost".' }) },

  { id: 'a-hmeaning', title: 'What does h(n) estimate?', parts: ['heur', 'admissible'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'The heuristic function takes a state and returns a number. What is that number supposed to estimate?',
      options: [O('The cost still to go: from this state to the nearest goal', true, 'g is the cost already paid; h is a guess about what is left.'), O('The cost already paid to reach this state from the start', false, 'That is g, which your code keeps in ' + C('cost') + ' and ' + C('new_cost') + '.'), O('The number of states A* will still expand', false, 'It estimates a cost, not an amount of work.'), O('The total cost of the whole path from start to goal', false, 'That would be f = g + h, built from the two parts.')],
      hints: ['Think of g as "behind me" and h as "ahead of me".'], explain: 'f = g + h is the estimated cost of the whole path through a state.' }) },

  { id: 'a-code-addh', title: 'Read the heuristic line', parts: ['heur', 'push'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: 'Line ' + lineOf('add_h') + ' of your code is <code>' + esc(textOf('add_h')) + '</code>. <b>Tick every true statement.</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['add_h'] }); },
      options: [
        O('The heuristic is evaluated for the successor, because the entry being pushed represents that state', true, 'f must describe the entry being pushed, so it needs the successor\'s h.'),
        O(C('problem') + ' is passed so a heuristic can look things up, for example ' + C('manhattanHeuristic') + ' reads ' + C('problem.goal'), true, 'The heuristic knows the state; the problem tells it where the goal is.'),
        O('The ' + C('g') + ' in the sum is ' + C('step_cost'), false, 'g is ' + C('new_cost') + ' = cost so far + this step.'),
        O('The heuristic is called once for every entry that is popped', false, 'It is called once for every successor that is pushed (and once for the start).')],
      hints: ['Look at what is added, and at what is passed to the heuristic.'], explain: 'This line is the only place the heuristic is used inside the loop.' }) },

  { id: 'a-code-start', title: 'Why h(start) on the first push?', parts: ['setup', 'heur'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Line ' + lineOf('push_start') + ' is <code>' + esc(textOf('push_start')) + '</code>. Why is the priority <code>heuristic(start_state, problem)</code> and not just 0?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['get_start', 'push_start'] }); },
      options: [O('Every entry\'s priority is f = g + h. For the start g = 0, so f = h(start). It keeps the rule uniform', true, 'With only one entry in the heap the value cannot change the order, but writing it this way keeps the invariant "priority = g + h" true for every entry.'), O('Without it the start would be popped last', false, 'It is the only entry, so it is popped first whatever its priority.'), O('The heuristic of the start must be 0 for A* to work', false, 'It is whatever the heuristic says. Only the goal must have h = 0 for the usual guarantees.'), O('It stores the heuristic so the goal test can use it', false, 'The goal test uses ' + C('isGoalState') + ', not the heuristic.')],
      hints: ['What would "g + h" be for the very first entry?'], explain: 'Item and priority are separate: the item holds (state, path, g), the priority holds f.' }) },

  { id: 'a-fvalue', title: 'Work out f', parts: ['cost', 'heur', 'push'], level: 1,
    gen: (r) => { const g0 = r.int(2, 8), st = r.int(1, 5), hh = r.int(1, 9) / 2;
      return { type: 'numeric', answer: g0 + st + hh, tol: 0,
        prompt: 'An entry with <b>cost ' + g0 + '</b> is popped and expanded. A successor is reached by a step costing <b>' + st + '</b>, and <code>heuristic(successor, problem)</code> returns <b>' + fmt(hh) + '</b>. What <b>priority</b> does the new entry get?',
        hints: ['new_cost first, then add h.'], explain: C('new_cost = ' + g0 + ' + ' + st + ' = ' + (g0 + st)) + ', then ' + C('priority = ' + (g0 + st) + ' + ' + fmt(hh) + ' = ' + fmt(g0 + st + hh)) + '. The entry itself stores cost ' + (g0 + st) + ', not the priority.' }; } },

  // ---------------------------------------------------------------- 2: tracing
  { id: 'a-next', title: 'Which state is popped next?', parts: ['pop', 'push', 'heur'], level: 2,
    gen: (r) => {
      let pick = null;
      for (let t = 0; t < 400 && !pick; t++) {
        const g = ladderG(r), run = bestFirst(g, { kind: 'astar' });
        if (!run.found || run.ties) continue;
        const k = run.steps.findIndex((s, i) => i >= 1 && i <= 4 && s.expanded && s.before.length >= 3 && s.before.slice().sort((a, b) => a.g - b.g)[0].s !== s.entry.s);
        if (k >= 0) pick = { g, run, k };
      }
      if (!pick) { const g = ladderG(r), run = bestFirst(g, { kind: 'astar' }); pick = { g, run, k: 1 }; }
      const { g, run, k } = pick, st = run.steps[k], seen = new Set(); for (let i = 0; i < k; i++) if (run.steps[i].expanded) seen.add(run.steps[i].entry.s);
      return { type: 'nodes', pick: 'nodes', max: 1, graph: g, answer: [st.entry.s], label: 'Graph with edge costs and heuristic values',
        graphOpts: () => ({ visited: seen, annot: hAnnot(g) }),
        prompt: 'A* is partway through this graph. The heap is shown with each entry\'s <b>g</b> and <b>h</b> (in the order entries were pushed, not sorted). Click the <b>state that is popped next</b>.',
        visual: (el) => { el.innerHTML = '<div>' + heapHTML(byInsertion(st.before), { cols: ['g', 'h', 'path'], noNext: true, caption: 'Heap entries (pushed order)' }) + '<p class="cap">Under each node in the graph below you see its h value. Green states are already expanded.</p></div>'; },
        hints: ['The heap pops the lowest f = g + h, not the lowest g.', 'Add the g and h columns for each entry.'],
        explain: 'Popped: ' + C(st.entry.s) + ' with f = ' + fmt(st.entry.g) + ' + ' + fmt(st.entry.h) + ' = ' + fmt(st.entry.pri) + '. The entry with the smallest g is not the one popped here: the heuristic changes the order.' }; } },

  { id: 'a-pushes', title: 'Which entries get pushed, and with what priority?', parts: ['push', 'heur', 'cost', 'filter', 'succ'], level: 2,
    gen: (r) => {
      let pick = null;
      for (let t = 0; t < 300 && !pick; t++) {
        const g = webG(r), run = bestFirst(g, { kind: 'astar' });
        if (!run.found || run.ties) continue;
        const k = run.steps.findIndex((s, i) => i >= 2 && s.expanded && s.pushes.some((p) => p.skipped === 'visited') && s.pushes.some((p) => !p.skipped));
        if (k >= 0) pick = { g, run, k };
      }
      const { g, run, k } = pick, st = run.steps[k], pushed = st.pushes.filter((p) => !p.skipped), skipped = st.pushes.filter((p) => p.skipped === 'visited'), ex = st.entry;
      const opts = [];
      pushed.forEach((p) => opts.push(O(C('(' + p.s + ', cost ' + fmt(p.g) + ', priority ' + fmt(p.pri) + ')'), true, 'g = ' + fmt(ex.g) + ' + ' + fmt(p.g - ex.g) + ' = ' + fmt(p.g) + ', h(' + p.s + ') = ' + fmt(p.h) + ', so f = ' + fmt(p.pri) + '.')));
      skipped.forEach((p) => opts.push(O(C('(' + p.s + ', …)'), false, p.s + ' is already visited, so it is skipped.')));
      pushed.forEach((p) => opts.push(O(C('(' + p.s + ', cost ' + fmt(p.g) + ', priority ' + fmt(p.g) + ')'), false, 'That priority leaves out h. It is what UCS would use.')));
      return { type: 'multi', graph: g, prompt: 'State ' + C(ex.s) + ' has just been popped with cost ' + fmt(ex.g) + ' and is being expanded. The h value of each state is shown under it; green states are already visited. <b>Tick every entry your code pushes, with the right priority.</b>',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { visited: new Set(st.visited), current: ex.s, annot: hAnnot(g), uid: 'p', label: 'Graph' })) + '<p class="cap" style="flex:1 1 100%">Edges are two-way, like corridors in a maze.</p>'; },
        options: opts, hints: ['Skip visited successors. For the others, g first, then add h.'], explain: 'Lines ' + lineOf('for_succ') + '–' + lineOf('push_succ') + ': each unvisited successor gets ' + C('new_cost') + ', then ' + C('priority = new_cost + h') + '.' }; } },

  { id: 'a-order', title: 'In what order are states expanded?', parts: ['pop', 'succ', 'mark', 'heur'], level: 2,
    gen: (r) => {
      const { g, run } = find(r, ladderG, (gg, rn) => rn.found && !rn.ties && rn.order.length >= 5);
      const ucs = bestFirst(Object.assign({}, g, { h: null }), { kind: 'ucs' });
      return { type: 'nodes', pick: 'seq', max: 4, graph: g, answer: run.order.slice(0, 4), label: 'Graph', graphOpts: () => ({ annot: hAnnot(g) }),
        prompt: 'Run A* on this graph from S. The h values are under the nodes. Click the <b>first four states that get expanded</b>, in order (S first).',
        hints: ['Expand S, then keep expanding the entry with the lowest f = g + h.'],
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>A* (this question)</h5><div class="res ok">expanded: <b>' + esc(run.order.join(', ')) + '</b><br>' + run.expansions + ' expansions</div></div><div><h5>UCS on the same graph</h5><div class="res bad">expanded: <b>' + esc(ucs.order.join(', ')) + '</b><br>' + ucs.expansions + ' expansions</div></div></div>'; }, demoTitle: 'Compare with UCS',
        explain: 'Expansion order: ' + esc(run.order.join(', ')) + '. The heuristic pulls the search towards the goal, so the order differs from plain UCS.' }; } },

  { id: 'a-path', title: 'Which path does A* return?', parts: ['goal', 'cost', 'push'], level: 2,
    gen: (r) => {
      const { g, run } = find(r, ladderG, (gg, rn) => rn.found && !rn.ties && rn.path.length >= 4);
      return { type: 'nodes', pick: 'seq', max: run.path.length, graph: g, answer: run.path, label: 'Graph', graphOpts: () => ({ annot: hAnnot(g) }),
        prompt: 'Click the <b>path A* returns</b>, from S to G, in order. The heuristic is admissible and consistent here.',
        hints: ['With an admissible, consistent heuristic the path is a cheapest path.'],
        explain: 'The cheapest path is ' + esc(run.path.join(' → ')) + ', cost ' + fmt(run.cost) + '. A good heuristic changes how much work A* does, not which cost it finds.' }; } },

  { id: 'a-expansions', title: 'How much work does A* do?', parts: ['goal', 'mark', 'quality'], level: 3,
    gen: (r) => {
      const { g, run } = find(r, ladderG, (gg, rn) => rn.found && !rn.ties && rn.expansions >= 3);
      const ucs = bestFirst(Object.assign({}, g, { h: null }), { kind: 'ucs' });
      return { type: 'numeric', answer: run.expansions, tol: 0, graph: g,
        prompt: 'Run A* on this graph to the end. <b>How many states are expanded</b> before it returns? (The goal is returned when popped, so it does not count.)',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { annot: hAnnot(g), uid: 'x', label: 'Graph' })); },
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>A*</h5><div class="res ok"><b>' + run.expansions + '</b> expansions: ' + esc(run.order.join(', ')) + '</div></div><div><h5>UCS (h = 0)</h5><div class="res bad"><b>' + ucs.expansions + '</b> expansions: ' + esc(ucs.order.join(', ')) + '</div></div></div>'; }, demoTitle: 'Compare with UCS',
        hints: ['List the expansion order first, then count.'], explain: 'A* expanded ' + run.order.join(', ') + ' = ' + run.expansions + ' states; UCS would expand ' + ucs.expansions + '.' }; } },

  { id: 'a-stale', title: 'A popped state is already visited', parts: ['stale', 'pop'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Your heap pops an entry for state <code>X</code>, but <code>X</code> is already in <code>visited</code>. What does your <code>aStarSearch</code> do with it?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['check_visited', 'skip'] }); },
      options: [O('Skips it with ' + C('continue') + ' and pops the next entry', true, 'X was expanded earlier from a lower-f entry, so this copy is a worse duplicate.'), O('Expands X again with the new g', false, 'That would redo work and could replace a better g with a worse one.'), O('Returns its path, since X was reached twice', false, 'Only the goal test returns a path.'), O('Raises an error', false, 'Stale entries are normal and handled quietly.')],
      hints: ['Think about which copy of X came out of the heap first.'], explain: 'Lines ' + lineOf('check_visited') + '–' + lineOf('skip') + ' discard stale duplicates.' }) },

  { id: 'a-start-goal', title: 'The start is already the goal', parts: ['goal', 'fail', 'setup'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Suppose the start state already satisfies <code>isGoalState</code>. What does <code>aStarSearch</code> return, and how many states does it expand?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['push_start', 'pop', 'goal_test', 'return_path'] }); },
      options: [O(C('[]') + ' and no expansions at all', true, 'The start entry is popped first and the goal test succeeds before ' + C('visited.add') + ' or any expansion.'), O(C('[]') + ' after expanding the start once', false, 'The goal test (line ' + lineOf('goal_test') + ') comes before the expansion.'), O(C('None'), false, 'It returns the entry\'s path: an empty list.'), O('It raises an error because there is nothing to search', false, 'The first pop works normally.')],
      hints: ['Follow the first pop through the goal test.'], explain: 'Zero expansions and an empty path: exactly right.' }) },

  { id: 'a-nopath', title: 'No route exists', parts: ['fail', 'mark'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'The goal is walled off. What does <code>aStarSearch</code> do?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['while', 'mark', 'return_empty'] }); },
      options: [O('It expands every reachable state once, the heap empties, and it returns ' + C('[]'), true, 'visited stops any state being expanded twice, so the heap can only shrink to empty.'), O('It loops forever because the heuristic keeps pointing at the goal', false, 'The heuristic only orders the heap. Termination comes from visited.'), O('It returns the path to the state with the smallest h', false, 'Nothing like that is tracked.'), O('It raises an IndexError', false, 'The while condition stops before popping an empty heap.')],
      hints: ['What ends the while loop?'], explain: 'Finiteness plus visited guarantees termination, even if the heuristic is wrong.' }) },

  // ---------------------------------------------------------------- 3: heuristics, admissible and consistent
  { id: 'a-audit-adm', title: 'Audit a heuristic: admissible?', parts: ['admissible', 'heur'], level: 3,
    gen: (r) => {
      let g = null, chk = null;
      for (let t = 0; t < 200; t++) {
        const base = mkGraph(TPL.ladder, TPL.ladder.edges.map(() => r.int(1, 6))), d = trueDist(base);
        if (d.S === Infinity) continue;
        const h = niceH(base, 0.5), cand = ['A', 'B', 'C', 'D', 'E'].filter((n) => d[n] !== Infinity), bad = r.shuffle(cand).slice(0, r.int(1, 2));
        bad.forEach((n) => { h[n] = d[n] + r.int(1, 3); });
        base.h = h; chk = checkH(base); if (chk.inadm.length >= 1) { g = base; break; }
      }
      if (!g) { g = mkGraph(TPL.ladder, [2, 3, 4, 2, 3, 3, 2, 2, 3]); g.h = niceH(g, 0.5); g.h.A = trueDist(g).A + 2; chk = checkH(g); }
      return { type: 'nodes', pick: 'nodes', graph: g, answer: chk.inadm, label: 'Graph with heuristic values', graphOpts: () => ({ annot: hAnnot(g) }),
        prompt: 'The heuristic values are printed under the nodes. <b>Click every node where the heuristic is NOT admissible</b>, that is, where h is bigger than the true cheapest cost from that node to G.',
        hints: ['For each node, work out the cheapest cost to G by hand and compare with h.', 'G itself has h = 0 and true cost 0, so it is fine.'],
        explain: 'True costs to G: ' + esc(Object.keys(chk.d).filter((n) => chk.d[n] !== Infinity).map((n) => n + '=' + fmt(chk.d[n])).join(', ')) + '. Not admissible (h too big): ' + esc(chk.inadm.join(', ')) + '.' }; } },

  { id: 'a-audit-cons', title: 'Audit a heuristic: consistent?', parts: ['consistent', 'admissible'], level: 3,
    gen: (r) => {
      let g = null, chk = null;
      for (let t = 0; t < 300; t++) {
        const base = mkGraph(TPL.ladder, TPL.ladder.edges.map(() => r.int(1, 5))), d = trueDist(base);
        if (d.S === Infinity) continue;
        const h = {}; Object.keys(base.pos).forEach((n) => { h[n] = d[n] === Infinity ? 0 : d[n]; });
        const mids = ['A', 'B', 'C', 'D', 'E'].filter((n) => d[n] !== Infinity && d[n] >= 2), lower = r.shuffle(mids).slice(0, r.int(1, 2));
        lower.forEach((n) => { h[n] = Math.max(0, d[n] - r.int(2, 3)); });
        base.h = h; chk = checkH(base);
        if (chk.admissible && chk.incons.length >= 1 && chk.incons.length <= 3) { g = base; break; }
      }
      if (!g) { g = mkGraph(TPL.ladder, [2, 3, 4, 2, 3, 3, 2, 2, 3]); const d = trueDist(g); g.h = {}; Object.keys(g.pos).forEach((n) => { g.h[n] = d[n]; }); g.h.D = 0; chk = checkH(g); }
      return { type: 'nodes', pick: 'edges', graph: g, answer: chk.incons, label: 'Graph with heuristic values',
        graphOpts: () => ({ annot: hAnnot(g) }),
        prompt: 'This heuristic is admissible. Consistency needs <code>h(u) ≤ cost(u, v) + h(v)</code> on <b>every edge</b> u → v. <b>Click every edge where consistency FAILS.</b>',
        hints: ['Check each edge: is h(u) bigger than the edge cost plus h(v)?', 'Only edges leading into a node whose h was lowered can fail.'],
        explain: 'Edges that break the rule: ' + esc(chk.incons.map((e) => { const [u, v] = e.split('>'); const w = g.edges.find((x) => x.u === u && x.v === v).w; return u + '→' + v + ' (h(' + u + ')=' + fmt(g.h[u]) + ' > ' + fmt(w) + ' + h(' + v + ')=' + fmt(w + g.h[v]) + ')'; }).join('; ')) + '. A heuristic can be admissible and still inconsistent.' }; } },

  { id: 'a-adm-vs-cons', title: 'Admissible versus consistent', parts: ['admissible', 'consistent'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Which statement about admissible and consistent heuristics is correct? (Assume <code>h(goal) = 0</code>.)',
      options: [O('Every consistent heuristic is admissible, but an admissible heuristic can be inconsistent', true, 'Consistency chains along any path to the goal and gives h(n) ≤ true cost. The reverse fails: an admissible h can drop faster than the edge cost along some edge.'), O('Every admissible heuristic is consistent', false, 'Not so: the audit question, and the inconsistent demo later, are admissible but not consistent.'), O('They are the same property under different names', false, 'Consistency is strictly stronger.'), O('Consistent means h never changes between two states', false, 'It means h can drop by at most the edge cost along an edge.')],
      hints: ['Which one implies the other?'], explain: 'consistent ⇒ admissible, not the other way round.' }) },

  { id: 'a-grid-heur', title: 'Admissible heuristics on a maze', parts: ['admissible', 'quality'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: 'In a maze, Pacman moves one cell North, South, East or West, and every step costs 1. <b>Tick every heuristic that is admissible</b> for reaching the pellet.',
      options: [O('Manhattan distance |dx| + |dy|', true, 'It is exactly the length of the shortest path if there were no walls, so walls can only make the real cost bigger.'), O('Euclidean (straight-line) distance', true, 'It is never more than Manhattan, so it is never more than the real cost.'), O('max(|dx|, |dy|)', true, 'It is never more than Manhattan.'), O('2 × Manhattan distance', false, 'In an open maze the real cost is exactly Manhattan, so this overestimates.'), O('Manhattan distance plus the number of walls in the maze', false, 'It can exceed the real cost, which is not affected by far-away walls.')],
      hints: ['An admissible h can never be larger than the real cost, even in an empty maze.'], explain: 'Smaller is always safe for admissibility; bigger is risky. The question is how close to the real cost you can get without exceeding it.' }) },

  { id: 'a-plain-manhattan', title: 'Plain Manhattan with cheap steps', parts: ['admissible', 'heur'], level: 3,
    gen: () => { const gr = parseMaze(H.DATA.mazes.smallMaze); for (let x = 0; x < gr.W; x++) for (let y = 0; y < gr.H; y++) if (!gr.wall[x][y]) gr.cost[x][y] = Math.pow(0.5, x);
      const hm = manh(gr), a = gridSearch(gr, 'astar', { h: hm }), u = gridSearch(gr, 'ucs');
      return { type: 'mc', demoTitle: 'The same maze, two searches',
        prompt: 'Suppose step costs are not all 1: entering a cell in column x costs <code>0.5^x</code> (very cheap on the east side). Your A* uses the plain <code>manhattanHeuristic</code>, which counts cells. Is it still admissible?',
        options: [O('No. A move can cost much less than 1, so counting cells overestimates the true cost and A* may return a costlier path', true, 'Manhattan assumes every step costs at least 1. When steps cost less, h can exceed the real cost-to-go.'), O('Yes, Manhattan distance is always admissible', false, 'It is admissible only when every step costs at least 1.'), O('Yes, but only on mazes without walls', false, 'Walls are not the issue; the step costs are.'), O('It stops being a heuristic and A* crashes', false, 'It runs fine; it just loses the optimality guarantee.')],
        hints: ['Compare "number of cells to cross" with what crossing them could cost.'],
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>A* with plain Manhattan</h5>' + canvasHTML('pm1') + '<div class="res bad">cost <b>' + fmt(a.cost) + '</b>, expanded <b>' + a.order.length + '</b></div></div><div><h5>UCS (the true optimum)</h5>' + canvasHTML('pm2') + '<div class="res ok">cost <b>' + fmt(u.cost) + '</b>, expanded <b>' + u.order.length + '</b></div></div></div>'; drawGrid(el.querySelector('#pm1'), gr, { cs: 11, tint: true, path: a.path, order: a.order }); drawGrid(el.querySelector('#pm2'), gr, { cs: 11, tint: true, path: u.path, order: u.order }); },
        explain: 'The fix is to scale the heuristic by the smallest step cost, so it stays a lower bound. This is the same issue the autograder avoids by using unit costs for the Manhattan tests.' }; } },

  // ---------------------------------------------------------------- 4: special cases and bugs
  { id: 'a-null', title: 'A* with h = 0', parts: ['nullcase', 'push'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'You call <code>aStarSearch(problem, nullHeuristic)</code>, where <code>nullHeuristic</code> returns 0 for every state. Which algorithm does your code now behave like?',
      options: [O('Uniform cost search: the priority is just g', true, 'f = g + 0 = g. In your two functions the code differs only by the ' + C('+ heuristic(...)') + ' term.'), O('Breadth-first search, always', false, 'BFS is the special case of UCS with equal step costs.'), O('Greedy best-first search', false, 'Greedy uses h alone, which would be 0 for everything and give no ordering at all.'), O('Depth-first search', false, 'DFS uses a stack and no priority.')],
      hints: ['Substitute h = 0 into f = g + h.'], explain: 'This is why the autograder expands the same states for A* with h = 0 and for UCS.' }) },

  { id: 'a-greedy-def', title: 'What if the priority is only h?', parts: ['greedy', 'push'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'A search that always expands the entry with the <b>smallest h alone</b> (ignoring g) is called...',
      options: [O('Greedy best-first search: fast, but with no guarantee of an optimal path', true, 'It chases whatever looks closest to the goal, without counting what it has already paid.'), O('A*, because it uses a heuristic', false, 'A* adds g to h. Without g it loses its guarantee.'), O('Uniform cost search', false, 'UCS uses g alone.'), O('Breadth-first search', false, 'BFS orders by number of moves.')],
      hints: ['Which half of f = g + h is missing?'], explain: 'greedy: h only; UCS: g only; A*: g + h.' }) },

  { id: 'a-bug-greedy', title: 'Spot the bug: priority is h only', parts: ['greedy', 'push', 'cost'], level: 3,
    gen: () => { const g = mkGraph(TPL.greedy, [1, 4, 8, 3]); g.h = { S: 2, A: 1, B: 3, G: 0 };
      return { type: 'mc', graph: g, demoTitle: 'Run both versions on this graph',
        prompt: 'A classmate changes line ' + lineOf('add_h') + ' to <code>priority = heuristic(successor, problem)</code>. On this graph, what goes wrong?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { annot: hAnnot(g), uid: 'gr', label: 'Graph' })) + '<div>' + codeHTML({ replace: { add_h: 'priority = heuristic(successor, problem)' } }) + '</div>'; },
        options: [O('It becomes greedy search: it follows the smallest h and can return a costlier path', true, 'A looks closest to the goal (h=1), so greedy goes S → A → G for cost 9 even though S → B → G costs only 7.'), O('Nothing: A* with h only is still optimal', false, 'Run the demo and compare.'), O('It becomes UCS', false, 'UCS drops h, not g.'), O('It loops forever', false, 'It terminates; the answer is just worse.')],
        hints: ['Which entry has the smallest h at each pop, and what did it cost to get there?'],
        demo: (el) => { const good = bestFirst(g, { kind: 'astar' }), bad = bestFirst(g, { kind: 'greedy' }); demoPair(el, g, { title: 'A* (yours): f = g + h', run: good, ok: true, text: runText(good, good.cost), annot: hAnnot(g) }, { title: 'Greedy: priority = h', run: bad, ok: false, text: runText(bad, good.cost), annot: hAnnot(g) }); },
        explain: 'Without g the search has no idea how much it has already paid.' }; } },

  { id: 'a-bug-noh', title: 'Spot the bug: h is forgotten', parts: ['nullcase', 'quality', 'heur'], level: 2,
    gen: () => { const gr = parseMaze(H.DATA.mazes.mediumMaze), a = gridSearch(gr, 'astar', { h: manh(gr) }), u = gridSearch(gr, 'ucs');
      return { type: 'mc', demoTitle: 'The same maze, two searches',
        prompt: 'A classmate changes line ' + lineOf('add_h') + ' to <code>priority = new_cost</code> (the heuristic is no longer used). On <code>mediumMaze</code>, what is the effect?',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { add_h: 'priority = new_cost' } }); },
        options: [O('Still optimal, but it is now UCS: it expands more states', true, 'Dropping h removes the guidance, not the correctness.'), O('The path becomes suboptimal', false, 'UCS is optimal. Only the amount of work changes.'), O('It returns no path', false, 'It finds the goal as usual.'), O('Nothing at all changes', false, 'The number of expanded states changes noticeably.')],
        hints: ['What does the code reduce to when h is always ignored?'],
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>A* with Manhattan</h5>' + canvasHTML('nh1') + '<div class="res ok"><b>' + a.order.length + ' expansions</b>, cost ' + a.cost + '</div></div><div><h5>priority = new_cost (UCS)</h5>' + canvasHTML('nh2') + '<div class="res bad"><b>' + u.order.length + ' expansions</b>, cost ' + u.cost + '</div></div></div>'; drawGrid(el.querySelector('#nh1'), gr, { cs: 9, order: a.order, path: a.path }); drawGrid(el.querySelector('#nh2'), gr, { cs: 9, order: u.order, path: u.path }); },
        explain: 'On mediumMaze A* expands ' + a.order.length + ' states and UCS ' + u.order.length + '. The autograder\'s expected node count for this test is 221.' }; } },

  { id: 'a-bug-hparent', title: 'Spot the bug: heuristic of the wrong state', parts: ['heur', 'push', 'pop'], level: 3,
    gen: (r) => {
      let pick = null;
      for (let t = 0; t < 400 && !pick; t++) {
        const g = ladderG(r), good = bestFirst(g, { kind: 'astar' }), bad = bestFirst(g, { kind: 'astar', hOfParent: true });
        if (good.found && bad.found && good.order.join() !== bad.order.join()) pick = { g, good, bad };
      }
      if (!pick) { const g = ladderG(r); pick = { g, good: bestFirst(g, { kind: 'astar' }), bad: bestFirst(g, { kind: 'astar', hOfParent: true }) }; }
      const { g, good, bad } = pick;
      return { type: 'mc', demoTitle: 'Compare the two runs',
        prompt: 'A classmate changes line ' + lineOf('add_h') + ' to <code>priority = new_cost + heuristic(current_state, problem)</code>, using the heuristic of the state being <b>expanded</b>. What is wrong?',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { add_h: 'priority = new_cost + heuristic(current_state, problem)' } }); },
        options: [O('Every successor of one parent now gets the same h, so the heuristic no longer tells them apart and the search drifts away from A*', true, 'f has to describe the entry being pushed. With the parent\'s h it describes the parent, so all its children are ranked by g alone.'), O('Nothing: the parent\'s h is as good as the child\'s', false, 'It is a different number and gives a different search. The demo shows the expansion orders differ.'), O('It makes the heuristic inadmissible', false, 'The heuristic is unchanged; it is applied to the wrong state.'), O('It only matters at the goal', false, 'It changes the order of every expansion.')],
        hints: ['Which state does the new entry represent?'],
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>h of the successor (yours)</h5><div class="res ok">expanded <b>' + esc(good.order.join(', ')) + '</b><br>cost ' + fmt(good.cost) + '</div></div><div><h5>h of the parent</h5><div class="res ' + (bad.cost > good.cost + 1e-9 || bad.order.join() !== good.order.join() ? 'bad' : 'ok') + '">expanded <b>' + esc(bad.order.join(', ')) + '</b><br>cost ' + fmt(bad.cost) + (bad.cost > good.cost + 1e-9 ? ' (costlier!)' : '') + '</div></div></div>'; },
        explain: 'The heuristic belongs to the state being pushed.' }; } },

  { id: 'a-bug-goalpush', title: 'Spot the bug: goal test on push', parts: ['goal', 'push', 'heur'], level: 2,
    gen: () => { const g = mkGraph(TPL.early, [10, 1, 1, 1]); g.h = { S: 2, A: 1, B: 1, G: 0 };
      return { type: 'mc', graph: g, demoTitle: 'Run both versions on this graph',
        prompt: 'A classmate returns as soon as a <b>pushed</b> successor is the goal, instead of testing the popped state. A* has a good heuristic, so can it still go wrong?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { annot: hAnnot(g), uid: 'ga', label: 'Graph' })) + '<div>' + codeHTML({ remove: ['goal_test', 'return_path'], replace: { add_cost: 'new_cost = cost + step_cost\n if problem.isGoalState(successor): return path + [action]' } }) + '</div>'; },
        options: [O('Yes: the first route found to the goal is not always the cheapest, whatever the heuristic', true, 'The expensive direct edge S → G is found immediately, while the cheap route is still unexplored.'), O('No: a good heuristic guarantees the first goal found is optimal', false, 'The guarantee comes from popping the goal, not from finding it.'), O('No, because A* never pushes the goal early', false, 'It pushes the goal as soon as it is a successor.'), O('It only matters for UCS', false, 'It matters for every best-first search.')],
        hints: ['Which edge reaches G first, and is it the cheapest route?'],
        demo: (el) => { const good = bestFirst(g, { kind: 'astar' }), bad = bestFirst(g, { kind: 'astar', goalOnPush: true }); demoPair(el, g, { title: 'Goal test on pop (yours)', run: good, ok: true, text: runText(good, good.cost), annot: hAnnot(g) }, { title: 'Goal test on push', run: bad, ok: false, text: runText(bad, good.cost), annot: hAnnot(g) }); },
        explain: 'This is the autograder\'s astar_3_goalAtDequeue test in disguise.' }; } },

  { id: 'a-skip-queued', title: 'Your BFS idea, in A*', parts: ['filter', 'mark', 'stale'], level: 3,
    gen: () => ({ type: 'multi',
      prompt: 'In BFS you skipped successors that were already waiting in the queue. <b>Tick every true statement</b> about doing that in A*.',
      options: [O('It can lose a cheaper route: a state queued early with a higher g is never given the lower g found later', true, 'The route with the lower g is never pushed, so the state is expanded with a worse path.'), O('It is safe whenever the heuristic is consistent', false, 'Consistency does not rescue it: the demo uses a consistent heuristic and still fails.'), O('Your ' + C('aStarSearch') + ' does not do it: it pushes every unvisited successor and skips stale copies when popped', true, 'That is the safe design, and why the stale check on line ' + lineOf('check_visited') + ' exists.'), O('It is harmless because the lower-f entry always comes out first anyway', false, 'The lower-g entry was never pushed, so there is nothing to come out.')],
      demoTitle: 'Where the idea breaks (consistent heuristic)',
      demo: (el) => { const g = mkGraph(TPL.later, [1, 5, 1, 1]); g.h = { S: 2, A: 1, B: 1, G: 0 }; const good = bestFirst(g, { kind: 'astar' }), bad = bestFirst(g, { kind: 'astar', skipIfQueued: true }); demoPair(el, g, { title: 'Your A* (push every unvisited successor)', run: good, ok: true, text: runText(good, good.cost), annot: hAnnot(g) }, { title: 'Skip successors already queued', run: bad, ok: false, text: runText(bad, good.cost), annot: hAnnot(g) }); },
      hints: ['Think about a state queued by an expensive edge before a cheaper route to it is found.'], explain: 'The consistent heuristic here is h = {S:2, A:1, B:1, G:0}. The idea fails anyway.' }) },

  // ---------------------------------------------------------------- 5: the theory of heuristics
  { id: 'a-consistent-meaning', title: 'What consistency says', parts: ['consistent'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'In plain words, what does <code>h(u) ≤ cost(u, v) + h(v)</code> on every edge u → v tell you?',
      options: [O('Moving along an edge can lower the estimate by at most the cost of that edge: the estimate never "jumps down" faster than you pay', true, 'It is the triangle inequality for the heuristic.'), O('h must increase along every edge', false, 'It may increase, stay the same or decrease a little.'), O('h must equal the true cost-to-go', false, 'That is the perfect heuristic; consistency only needs the inequality.'), O('Every edge costs the same', false, 'Edge costs are arbitrary.')],
      hints: ['Rewrite it as h(u) − h(v) ≤ cost(u, v).'], explain: 'A consistent estimate cannot "teleport": dropping by more than the edge cost would mean the estimate was too hopeful before the step.' }) },

  { id: 'a-consistent-why', title: 'What consistency buys', parts: ['consistent', 'goal'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'Your A* never re-opens a state once it is in <code>visited</code>. What is it about a <b>consistent</b> heuristic that makes that safe?',
      options: [O('f never decreases along any path, so the first time a state is expanded its g is already the cheapest; a later route cannot beat it', true, 'That is why the first goal pop is optimal and why visited states never need revisiting.'), O('A consistent heuristic makes every state have h = 0', false, 'It does not change the values, only how they relate along edges.'), O('A consistent heuristic means the goal is always found first', false, 'Order of discovery is not what is guaranteed.'), O('Nothing: visited is always safe whatever the heuristic', false, 'With an inconsistent heuristic it can cause a suboptimal answer.')],
      hints: ['What happens to f along a path if h can drop by more than the step cost?'], explain: 'Consistency is the property graph-search A* quietly relies on.' }) },

  { id: 'a-dominance', title: 'A better-informed heuristic', parts: ['quality', 'admissible'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'Two heuristics are both admissible and consistent, and <code>h2(n) ≥ h1(n)</code> for every state. Which statement is right?',
      options: [O('A* with h2 never expands more states than A* with h1 (ignoring ties): the bigger admissible estimate prunes more', true, 'Both are lower bounds on the true cost; the closer one to the truth rules out more states.'), O('A* with h1 expands fewer states, since smaller numbers are safer', false, 'Smaller is safer for admissibility but gives less guidance, so more states are expanded.'), O('They always expand exactly the same states', false, 'The extra information matters.'), O('A* with h2 may return a costlier path', false, 'Both are admissible and consistent, so both are optimal.')],
      hints: ['h = 0 is the weakest admissible heuristic. How much does A* with it expand?'], explain: 'Quality of the heuristic means "as large as possible while staying admissible".' }) },

  { id: 'a-rank', title: 'Rank the heuristics by work', parts: ['quality', 'nullcase', 'admissible'], level: 3,
    gen: (r) => { const f = rankField(r), items = f.res.map((x) => x.name + '');
      return { type: 'order',
        prompt: 'On this maze (unit steps), A* is run with four different heuristics. Click them in order from the <b>fewest states expanded</b> to the <b>most</b>.',
        visual: (el) => { el.innerHTML = canvasHTML('rk'); drawGrid(el.querySelector('#rk'), f.gr, { cs: 14 }); },
        items, hints: ['Which heuristic knows the most? Which knows nothing?', 'Euclidean distance is never bigger than Manhattan distance.'],
        explain: 'Counts: ' + f.res.map((x) => x.name + ' = ' + x.n).join(', ') + '. The better the estimate (while staying admissible), the fewer states are expanded.' }; } },

  { id: 'a-shape', title: 'Which picture is A*?', parts: ['quality', 'greedy', 'nullcase'], level: 3,
    gen: (r) => { const gr = shapeField(r), algos = [['dfs', 'DFS'], ['ucs', 'UCS'], ['greedy', 'Greedy'], ['astar', 'A* with Manhattan']];
      const runs = algos.map((a) => ({ k: a[0], res: gridSearch(gr, a[0]) }));
      return { type: 'mc', visualOptions: true,
        prompt: 'Each picture shows the cells (red) that one search had expanded when it found the pellet, on the same unit-cost maze with one wall. <b>Which picture is A* with the Manhattan heuristic?</b>',
        options: runs.map((x) => { const o = O('<canvas class="board"></canvas>', x.k === 'astar', x.k === 'astar' ? 'A* leans towards the goal but still covers what it must to stay optimal, and it goes round the wall.' : x.k === 'ucs' ? 'UCS spreads in all directions equally, a wave: no pull towards the goal.' : x.k === 'greedy' ? 'Greedy charges straight at the goal and only gets round the wall by luck: very narrow, not optimal in general.' : 'DFS dives down corridors: a long snake, nothing like a cone.'); o.draw = (cv) => drawGrid(cv, gr, { cs: 7, order: x.res.order, path: x.res.path }); return o; }),
        hints: ['A* is pulled towards the goal but not as narrowly as greedy.'], explain: 'UCS: a circle. Greedy: a thin line. A*: a cone aimed at the goal.' }; } },

  { id: 'a-manhattan-calc', title: 'Compute the Manhattan heuristic', parts: ['heur', 'admissible'], level: 1,
    gen: (r) => { const gr = openField(20, 10, []); gr.start = [r.int(2, 6), r.int(2, 7)]; gr.goal = [r.int(12, 18), r.int(1, 8)];
      return { type: 'numeric', answer: Math.abs(gr.start[0] - gr.goal[0]) + Math.abs(gr.start[1] - gr.goal[1]), tol: 0,
        prompt: 'Pacman is at <b>(' + gr.start[0] + ', ' + gr.start[1] + ')</b> and the pellet is at <b>(' + gr.goal[0] + ', ' + gr.goal[1] + ')</b>. What does <code>manhattanHeuristic</code> return for Pacman\'s cell?',
        visual: (el) => { el.innerHTML = canvasHTML('mc'); drawGrid(el.querySelector('#mc'), gr, { cs: 16 }); },
        hints: ['|x1 − x2| + |y1 − y2|'], explain: '|' + gr.start[0] + ' − ' + gr.goal[0] + '| + |' + gr.start[1] + ' − ' + gr.goal[1] + '| = ' + (Math.abs(gr.start[0] - gr.goal[0]) + Math.abs(gr.start[1] - gr.goal[1])) + '.' }; } },

  { id: 'a-tie-fifo', title: 'Two entries with the same f', parts: ['ties', 'pop'], level: 1,
    gen: (r) => { const f = r.int(6, 10);
      const ent = [{ s: 'B', g: f - 1, h: 2, pri: f + 1, seq: 0, path: ['S', 'B'] }, { s: 'A', g: f - 3, h: 3, pri: f, seq: 1, path: ['S', 'A'] },
        { s: 'C', g: f - 4, h: 4, pri: f, seq: 2, path: ['S', 'C'] }, { s: 'D', g: f - 2, h: 3, pri: f + 1, seq: 3, path: ['S', 'D'] }];
      return { type: 'mc',
        prompt: 'The heap below has two entries with the lowest priority <b>' + f + '</b>: states A and C. <b>Which is popped first in your code?</b>',
        visual: (el) => { el.innerHTML = heapHTML(ent, { cols: ['seq', 'g', 'h', 'pri'], noNext: true, caption: 'Heap entries' }); },
        options: [O('A, because it was pushed earlier (pushed #2)', true, 'util.PriorityQueue breaks ties with an increasing counter: first in, first out.'), O('C, because its g is bigger (it is closer to the goal)', false, 'That is a clever tie-break some implementations use, but yours does not.'), O('C, because it was pushed later', false, 'Later pushes lose ties.'), O('Random', false, 'It is deterministic.')],
        hints: ['Look at the pushed # column.'], explain: 'Equal priorities leave the heap in the order they went in.' }; } },

  { id: 'a-ties', title: 'Better tie-breaking', parts: ['ties', 'quality'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'Many entries often share the same f. A known improvement is to break ties in favour of the entry with the <b>larger g</b> (equivalently, the smaller h). Why does that help?',
      options: [O('It prefers entries closer to the goal, so A* tends to expand fewer states before reaching it. The result stays optimal', true, 'Among equal-f entries, the one with larger g has used up more of its budget, so it is deeper towards the goal.'), O('It makes the answer cheaper', false, 'Optimal cost is the same; only the work changes.'), O('It is required for A* to be correct', false, 'A* is correct with any tie-breaking.'), O('Your code already does this', false, 'Your code breaks ties first in, first out.')],
      hints: ['Both choices give an optimal path. What changes?'], explain: 'Tie-breaking only affects efficiency, never optimality.' }) },

  // ---------------------------------------------------------------- 6: when consistency fails
  { id: 'a-autograder', title: 'Predict the autograder\'s own test', parts: ['inconsistent', 'pop', 'heur'], level: 3,
    gen: () => { const g = mkGraph(TPL.auto, AUTO_W); g.h = AUTO_H; const run = bestFirst(g, { kind: 'astar' });
      return { type: 'nodes', pick: 'seq', max: 4, graph: g, answer: run.order.slice(0, 4), label: 'The autograder graph', graphOpts: () => ({ annot: hAnnot(g) }),
        prompt: 'This is the graph from the autograder test <code>astar_1_graph_heuristic</code>, with its heuristic values under the nodes. The heuristic is <b>not</b> consistent. <b>Click the first four states A* expands, in order.</b>',
        hints: ['Always take the lowest f = g + h. Watch D: its h is tiny.', 'Duplicates of a state can sit in the heap with different costs.'],
        demo: (el) => { el.innerHTML = '<div class="tablewrap"><table class="heap"><caption>Pops, in order</caption><thead><tr><th>#</th><th>popped</th><th>g</th><th>h</th><th>f</th><th>what happened</th></tr></thead><tbody>' + run.steps.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + s.entry.s + '</td><td>' + fmt(s.entry.g) + '</td><td>' + fmt(s.entry.h) + '</td><td>' + fmt(s.entry.pri) + '</td><td style="font-family:var(--font-ui)">' + (s.goal ? 'goal: return the path' : s.stale ? 'stale: skipped' : 'expanded') + '</td></tr>').join('') + '</tbody></table></div><p class="cap" style="flex:1 1 100%">The returned path is ' + esc(run.path.join(' → ')) + ' with cost ' + fmt(run.cost) + '. Your code passes this test.</p>'; }, demoTitle: 'The full run',
        explain: 'Expansion order: ' + esc(run.order.join(', ')) + '; path ' + esc(run.path.join(' → ')) + ', cost ' + fmt(run.cost) + '. The heuristic is inconsistent (for example h(S) = 6 but the edge S → A costs 2 and h(A) = 2.5), yet this run is still optimal.' }; } },

  { id: 'a-inconsistent-demo', title: 'Admissible but inconsistent', parts: ['inconsistent', 'admissible', 'consistent'], level: 3,
    gen: () => { const g = mkGraph(TPL.inc, [1, 3, 1, 5, 2, 1]); g.h = { S: 3, A: 3, B: 0, G: 0 }; const chk = checkH(g);
      return { type: 'mc', graph: g, demoTitle: 'Run A* on this graph',
        prompt: 'This heuristic is admissible but not consistent (h(A) = 3 but A → B costs 1 and h(B) = 0). Your A* never re-opens visited states. Is the returned path guaranteed to be optimal?',
        visual: (el) => { el.innerHTML = wrapV(gSVG(g, { annot: hAnnot(g), uid: 'ic', label: 'Graph' })); },
        options: [O('No. B is expanded first with g = 3, and by the time the cheaper route via A is found, B is already visited, so the cost-5 path S → B → G is returned instead of the cost-4 path', true, 'An inconsistent heuristic can make a state look so promising that it is expanded with a non-optimal g.'), O('Yes: admissible is enough for A* to be optimal', false, 'Admissibility is enough for tree search, or for graph search that re-opens states. Not for graph search with a visited set.'), O('Yes, because the heuristic never overestimates', false, 'That is exactly admissibility, which is not the missing property.'), O('No, but only because the graph has a cycle', false, 'The cycle is not the cause; the inconsistency is.')],
        hints: ['Trace the first few pops. Which state looks best at first, and what is its g?'],
        demo: (el) => { const good = bestFirst(g, { kind: 'ucs' }), bad = bestFirst(g, { kind: 'astar' }); demoPair(el, g, { title: 'The true optimum', run: good, ok: true, text: runText(good, good.cost) }, { title: 'A* (graph search, no re-opening)', run: bad, ok: false, text: runText(bad, good.cost), annot: hAnnot(g) }); },
        explain: 'Consistency is what makes "visited" safe. Without it you must re-open states or repair the heuristic.' }; } },

  { id: 'a-fix-reopen', title: 'Fixing an inconsistent heuristic', parts: ['inconsistent', 'mark'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'You must use an admissible but inconsistent heuristic and still want an optimal path. Which change to graph-search A* repairs it?',
      options: [O('Allow a visited state to be expanded again if a cheaper g to it is found (re-open it)', true, 'Then the cheaper route is never lost, at the cost of some repeated work.'), O('Test the goal when pushing instead of popping', false, 'That makes things worse, as an earlier question showed.'), O('Skip successors that are already queued', false, 'That throws away cheaper routes.'), O('Multiply the heuristic by 2', false, 'That makes it inadmissible, which breaks optimality.')],
      hints: ['What is the harm of the visited set when h is inconsistent?'], explain: 'Alternatively, use a consistent heuristic, which needs no repair.' }) },

  { id: 'a-inadmissible', title: 'An inadmissible heuristic', parts: ['admissible', 'quality', 'greedy'], level: 3,
    gen: () => { const gr = parseMaze(H.DATA.mazes.openMaze), hm = manh(gr), a = gridSearch(gr, 'astar', { h: (x, y) => 3 * hm(x, y) }), u = gridSearch(gr, 'ucs');
      return { type: 'mc', demoTitle: 'The same maze, two searches',
        prompt: 'A classmate replaces the heuristic with <b>3 × Manhattan distance</b>, which overestimates. On <code>openMaze</code>, what can happen?',
        options: [O('A* becomes much faster but can return a costlier path, because the overestimates push it to commit early', true, 'Overestimating makes it greedy-like: fewer expansions, no optimality guarantee.'), O('Nothing: A* stays optimal and just as fast', false, 'Run the demo and compare.'), O('A* becomes slower but stays optimal', false, 'Overestimating speeds it up.'), O('A* returns no path', false, 'It still finds the goal.')],
        hints: ['Overestimating pushes the search towards "looks closest" and away from "is cheapest".'],
        demo: (el) => { el.innerHTML = '<div class="pair"><div><h5>A* with 3 × Manhattan</h5>' + canvasHTML('ia1') + '<div class="res ' + (a.cost > u.cost ? 'bad' : 'ok') + '">cost <b>' + a.cost + '</b>, expanded <b>' + a.order.length + '</b></div></div><div><h5>UCS (the true optimum)</h5>' + canvasHTML('ia2') + '<div class="res ok">cost <b>' + u.cost + '</b>, expanded <b>' + u.order.length + '</b></div></div></div>'; drawGrid(el.querySelector('#ia1'), gr, { cs: 7, order: a.order, path: a.path }); drawGrid(el.querySelector('#ia2'), gr, { cs: 7, order: u.order, path: u.path }); },
        explain: 'Speed from an overestimate is paid for with the optimality guarantee.' }; } }
];

return {
  algo: 'astar', func: 'aStarSearch', title: 'A* Evaluation', subtitle: 'A teacher\'s check: do you really know how your aStarSearch works?',
  welcomeTitle: 'Let\'s see what you really know about A* search',
  intro: '<p class="prompt">A* is Uniform Cost Search with one extra idea: a guess about the remaining cost. Passing the autograder shows the code works, not that you understand what the guess does. I will test every part of the loop and every property of the heuristic, using <b>your own code</b>, until I am sure you can explain each line and predict what it does.</p>',
  minPerPart: 2, groups, parts, questions
};
