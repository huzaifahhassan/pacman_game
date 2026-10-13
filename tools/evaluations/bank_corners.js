// Q5: CornersProblem. The corners engine (corners_engine.js) is placed in front of this file by build_eval.py.
// Every answer key comes from that engine, which build_eval.py checked against your real CornersProblem, BFS and A* on 16 mazes.

// ---------------------------------------------------------------- helpers for this bank
function countVisitOrder(gr) {                         // reachable states if the state kept the corners VISITED, in the order they were visited
  const cs = cornersOf(gr), key = (s) => s.x + ',' + s.y + ':' + s.v.join('');
  const hit = (x, y, v) => { const i = cs.findIndex((c) => c[0] === x && c[1] === y); return i >= 0 && v.indexOf(i) < 0 ? v.concat(i) : v; };
  const s0 = { x: gr.start[0], y: gr.start[1], v: hit(gr.start[0], gr.start[1], []) }, seen = new Set([key(s0)]), q = [s0];
  for (let i = 0; i < q.length; i++) for (const d of CDIRS) {
    const nx = q[i].x + d[0], ny = q[i].y + d[1]; if (gr.wall[nx][ny]) continue;
    const s = { x: nx, y: ny, v: hit(nx, ny, q[i].v) }; if (!seen.has(key(s))) { seen.add(key(s)); q.push(s); }
  }
  return seen.size;
}
// BFS where the "memory" lives in the problem object and is shared by every branch (the classmate's bug)
function globalMemoryBFS(gr) {
  const cs = cornersOf(gr), found = new Set(), seen = new Set([gr.start.join()]), q = [{ p: gr.start, path: '' }];
  for (let head = 0; head < q.length; head++) {
    const e = q[head];
    if (found.size === 4) return { path: e.path, ok: true };
    for (const d of CDIRS) {
      const nx = e.p[0] + d[0], ny = e.p[1] + d[1]; if (gr.wall[nx][ny]) continue;
      const i = cs.findIndex((c) => c[0] === nx && c[1] === ny); if (i >= 0) found.add(i);
      if (!seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push({ p: [nx, ny], path: e.path + d[2] }); }
    }
  }
  return { path: '', ok: false };
}

// ---------------------------------------------------------------- how long the evaluation is
// QUICK keeps the 20 questions below, chosen so that every part of the map still gets at least two. Set it to false to get all 41.
const QUICK = true;
const CORE = ['k-steps', 'k-why-pos', 'k-whats-in', 'k-start-corner', 'k-goal-multi', 'k-wall-click', 'k-succ-count', 'k-corner-step', 'k-trace-path', 'k-code-succ', 'k-order-equal', 'k-order-tuple', 'k-global-memory', 'k-impossible', 'k-layers', 'k-dup-count', 'k-bfs-wave', 'k-nearest-first', 'k-best-order', 'k-goal-count'];

// ---------------------------------------------------------------- the map
const parts = [
  { id: 'need', group: 'idea', label: 'Why position is not enough', review: 'The same cell can be a very different situation: with four corners left or with none. The state must hold the memory that decides what work remains.' },
  { id: 'content', group: 'idea', label: 'What goes in the state', review: 'A state is (position, tuple of unvisited corners). Walls, ghosts, score and the path so far do not belong in it.' },
  { id: 'form', group: 'idea', label: 'Tuple: hashable and immutable', review: 'States go into sets and dictionaries, so they must be hashable. Tuples are; lists are not, and a tuple cannot be changed behind the search\'s back.' },
  { id: 'order', group: 'idea', label: 'Same corners, same tuple', review: 'Tuples compare in order, so the unvisited corners must always be listed in the order of self.corners. Your filter over unvisited keeps that order.' },
  { id: 'lean', group: 'idea', label: 'Keep out what never changes', review: 'Constant things (walls, corner coordinates) live in the problem object. Putting extra detail in the state makes equal situations look different.' },
  { id: 'start', group: 'methods', label: 'getStartState', review: 'Start = (startingPosition, every corner except the one Pacman stands on). A corner under Pacman already counts as visited.' },
  { id: 'goal', group: 'methods', label: 'isGoalState', review: 'Goal = no corners left in the tuple, wherever Pacman stands. Standing on a corner is not enough.' },
  { id: 'wall', group: 'methods', label: 'getSuccessors: legal moves', review: 'Try North, South, East, West in that order and skip any move whose next cell is a wall.' },
  { id: 'corner', group: 'methods', label: 'getSuccessors: touching a corner', review: 'Compute the next position first, then drop it from the unvisited corners if it is one. Using the old position would tick the corner off one step late.' },
  { id: 'fresh', group: 'methods', label: 'A new tuple each time', review: 'Build a new tuple for every successor. Never change the parent\'s tuple, and never keep the memory on the problem object: branches would share it.' },
  { id: 'cost', group: 'methods', label: 'Step cost and expansions', review: 'Every move costs 1. The autograder counts how many times getSuccessors runs (the line you must not change).' },
  { id: 'size', group: 'space', label: 'Counting states', review: 'Up to (open cells) × 2^4 states: each cell combined with each subset of the four corners.' },
  { id: 'reach', group: 'space', label: 'Which states can occur', review: 'Some combinations never happen, for instance standing on a corner that is still marked unvisited.' },
  { id: 'layers', group: 'space', label: 'Corners only drop out', review: 'A step can remove a corner from the tuple but nothing puts it back, so the number of corners left never goes up along a path.' },
  { id: 'dup', group: 'search', label: 'Same cell, different state', review: 'The search compares whole states. Reaching a cell again with a different set of corners left is new territory.' },
  { id: 'goals', group: 'search', label: 'Many goal states', review: 'There is no single goal cell: every state with an empty tuple is a goal, one per cell Pacman may end on.' },
  { id: 'bfs', group: 'search', label: 'BFS finds the shortest tour', review: 'Every step costs 1, so the first goal BFS pops is reached by the fewest steps: the shortest walk that touches all four corners.' },
  { id: 'trap', group: 'search', label: 'Why nearest-first is not enough', review: 'Always going to the nearest corner can force a long walk back at the end. The search compares complete tours instead.' }
];
const groups = [{ id: 'idea', label: 'The idea: what a state remembers', arrow: true }, { id: 'methods', label: 'Your three methods', arrow: true }, { id: 'space', label: 'The state space', arrow: true }, { id: 'search', label: 'Searching it', arrow: false }];

// ---------------------------------------------------------------- the questions
const questions = [
  // ---------------------------------------------------------------- the shape of it
  { id: 'k-steps', title: 'Put one expansion in order', parts: ['start', 'goal', 'wall', 'corner', 'fresh', 'dup'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'These are the things that happen when BFS works on <code>CornersProblem</code>, shuffled. Click them in the order they happen, from the start of the search to one state being fully expanded.',
      items: [
        C('getStartState') + ' builds ' + C('(startingPosition, unvisited)') + ' where the tuple holds every corner Pacman is not standing on.',
        'BFS takes the next state from the queue and asks ' + C('isGoalState') + ': is ' + C('len(state[1]) == 0') + '?',
        C('getSuccessors') + ' takes the state apart: ' + C('position, unvisited = state') + ', then ' + C('x, y = position') + '.',
        'For one action (North, South, East, West) it computes ' + C('nextx, nexty') + ' and skips the action if that cell is a wall.',
        'It builds ' + C('next_position') + ' and a NEW tuple ' + C('next_unvisited') + ' without that position, in case it is a corner.',
        'It appends ' + C('((next_position, next_unvisited), action, 1)') + ' to the list it will return.',
        'BFS keeps each returned state it has not seen before (the whole state, tuple included) and queues it.'],
      hints: ['The start state exists before anything is popped.', 'The goal test happens right after a state is popped, before it is expanded.'],
      explain: 'In your code: the start state is built on lines ' + lineOf('start_un') + ' to ' + lineOf('start_ret') + ', the goal test is line ' + lineOf('goal_ret') + ', the unpacking is on lines ' + lineOf('succ_unpack') + ' and ' + lineOf('succ_xy') + ', the wall check is line ' + lineOf('succ_wall') + ', the new tuple is line ' + lineOf('succ_nextun') + ' and the triple is added on line ' + lineOf('succ_append') + '.' }) },

  { id: 'k-why-pos', title: 'Two pictures, one cell', parts: ['need', 'content'], level: 1,
    gen: (r) => { const gr = mazeFor(r), cells = openList(gr).filter((p) => !isCorner(gr, p)), pos = r.pick(cells), keep = r.int(0, 3);
      return { type: 'mc',
        prompt: 'Pacman stands on the <b>same cell</b> in both pictures. A solver whose state is <b>only Pacman\'s position</b> (like in the earlier questions) cannot tell the pictures apart. <b>What goes wrong for the Corners problem?</b>',
        visual: (el) => { cBoard(el, gr, { pos, un: [0, 1, 2, 3] }, 'Left: no corner touched yet'); cBoard(el, gr, { pos, un: [keep] }, 'Right: three corners already touched'); },
        options: [O('It cannot tell how much work is left, so it cannot know when the goal has been reached', true, 'Left still needs four corners, right needs one. The position alone says nothing about that.'),
          O('Nothing: the position fully decides what Pacman does next', false, 'Where Pacman should go next depends on which corners are still waiting.'),
          O('The walls are different in the two pictures', false, 'Same maze, same walls. Only the corners differ.'),
          O('A position cannot be stored in a set because tuples of numbers are not hashable', false, 'A tuple of ints is hashable. That is not the problem.')],
        hints: ['Count the corners each picture still needs.'], explain: 'The extra memory is exactly what the state must add: which corners are still unvisited.' }; } },

  { id: 'k-whats-in', title: 'What belongs in the state?', parts: ['content', 'lean'], level: 1,
    gen: () => ({ type: 'multi',
      prompt: 'Your state is <code>(position, unvisited)</code>. <b>Tick every item that belongs in the state.</b> The rest is either constant or tracked somewhere else.',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['succ_unpack'] }); },
      options: [O('Pacman\'s position', true, 'It decides which moves are possible.'), O('Which corners are still unvisited', true, 'This is the memory that makes the goal checkable.'),
        O('The walls of the maze', false, 'They never change, so they live once in the problem object (' + C('self.walls') + ', used on line ' + lineOf('succ_wall') + ').'),
        O('The list of moves made so far', false, 'BFS keeps the path next to each state in the queue. Inside the state it would make every state unique.'),
        O('The score and the ghosts', false, 'They do not change which plan is shortest for this problem.'),
        O('How many steps have been taken', false, 'That is the cost, which the search tracks. In the state it would make equal situations look different.')],
      hints: ['Ask: does this change what the best remaining plan is, and does it differ between states?'], explain: 'A good state holds the least information that still lets you finish the job.' }) },

  { id: 'k-corner-cells', title: 'Where are the corners?', parts: ['content', 'start'], level: 1,
    gen: (r) => { const gr = mazeFor(r, { segs: r.int(3, 5) }), cs = cornersOf(gr);
      return { type: 'cells', pick: 'nodes', grid: gr, cs: 24, label: 'Maze', answer: cs.map((c) => cid(c[0], c[1])), explainShow: true,
        drawOpts: () => ({ hidePellet: true, pac: null, dots: [] }),
        prompt: 'In <code>CornersProblem.__init__</code> the corners are <code>((1,1), (1,top), (right,1), (right,top))</code> with <code>top = height − 2</code> and <code>right = width − 2</code>. Coordinates start at the <b>bottom-left</b> of the board. <b>Click the four cells that <code>self.corners</code> holds for this ' + gr.W + ' × ' + gr.H + ' maze.</b>',
        hints: ['The outer ring is the border wall, so the first open row and column are number 1.', 'Width ' + gr.W + ' means the last open column is ' + (gr.W - 2) + '. Height ' + gr.H + ' means the top open row is ' + (gr.H - 2) + '.'],
        explain: 'The corners are ' + cs.map((c) => ptS(c[0], c[1])).join(', ') + '. They are always the inner corners, whatever walls stand inside the maze.' }; } },

  // ---------------------------------------------------------------- getStartState
  { id: 'k-start-repr', title: 'What does getStartState return?', parts: ['start', 'form', 'content'], level: 1,
    gen: (r) => { const gr = mazeFor(r), cs = cornersOf(gr), pos = gr.start, all = [0, 1, 2, 3];
      const lst = '(' + ptS(pos[0], pos[1]) + ', [' + all.map((i) => ptS(cs[i][0], cs[i][1])).join(', ') + '])';
      return { type: 'mc',
        prompt: 'Pacman starts at <b>' + ptS(pos[0], pos[1]) + '</b>, which is not a corner. <b>What does your <code>getStartState()</code> return?</b>',
        visual: (el) => { cBoard(el, gr, { un: all }, 'The maze at the start'); el.insertAdjacentHTML('beforeend', codeHTML({ mark: ['start_un', 'start_ret'] })); },
        options: [O(C(stR(gr, pos[0], pos[1], all)), true, 'Position first, then all four corners, in the order of ' + C('self.corners') + '.'),
          O(C(stR(gr, pos[0], pos[1], [1, 2, 3])), false, 'That treats the bottom-left corner as already visited, but Pacman is not standing on it.'),
          O(C(stR(gr, pos[0], pos[1], [])), false, 'An empty tuple means every corner is done. This would be a goal state before the search starts.'),
          O(C(ptS(pos[0], pos[1])), false, 'Only the position. The state must also hold the unvisited corners.'),
          O(C(lst), false, 'A list inside the state cannot be hashed, so it could not be put in ' + C('visited') + '.')],
        hints: ['Which corners is Pacman standing on right now?'], explain: 'Line ' + lineOf('start_un') + ' keeps every corner that is not the starting position; line ' + lineOf('start_ret') + ' pairs it with the position.' }; } },

  { id: 'k-start-corner', title: 'Starting on a corner', parts: ['start', 'order'], level: 2,
    gen: (r) => { const sc = r.int(0, 3), gr = cRandMaze(r, { startCorner: sc }), cs = cornersOf(gr), pos = gr.start, rest = [0, 1, 2, 3].filter((i) => i !== sc);
      return { type: 'mc',
        prompt: 'This time Pacman starts <b>on</b> the ' + cornerWord(sc) + ' corner ' + ptS(pos[0], pos[1]) + '. <b>What does <code>getStartState()</code> return?</b>',
        visual: (el) => { cBoard(el, gr, { un: rest }, 'Pacman is standing on one corner already'); el.insertAdjacentHTML('beforeend', codeHTML({ mark: ['start_un'] })); },
        options: [O(C(stR(gr, pos[0], pos[1], rest)), true, 'The corner under Pacman is ticked off at once; the other three keep their order from ' + C('self.corners') + '.'),
          O(C(stR(gr, pos[0], pos[1], [0, 1, 2, 3])), false, 'Then Pacman would have to step off and come back to collect a corner he is already on.'),
          O(C(stR(gr, pos[0], pos[1], rest.slice().reverse())), false, 'Same corners, but in a different order. Tuples compare in order, so this is a different state from the same situation reached later.'),
          O(C(stR(gr, pos[0], pos[1], [])), false, 'Three corners are still unvisited.')],
        hints: ['Compare line ' + lineOf('start_un') + ': which corner does ' + C('c != self.startingPosition') + ' leave out?'], explain: 'Because of ' + C('c != self.startingPosition') + ', the corner Pacman stands on is never in the tuple, and the filter keeps the original order.' }; } },

  { id: 'k-start-bug', title: 'Forgetting the corner under Pacman', parts: ['start', 'corner'], level: 3,
    gen: (r) => { const pick = find(r, () => { const sc = r.int(0, 3), gr = cRandMaze(r, { startCorner: sc }); return { gr, good: cBFS(gr), bad: cBFS(gr, { keepStartCorner: true }) }; }, (x) => x.bad.cost > x.good.cost, 60), gr = pick.gr, pos = gr.start;
      return { type: 'mc', demoTitle: 'Same maze, two start states',
        prompt: 'A classmate writes line ' + lineOf('start_un') + ' as shown (all four corners, always). Pacman starts <b>on</b> a corner. <b>What does BFS do?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { start_un: 'unvisited = self.corners' } }); },
        options: [O('It still returns a legal plan, but a longer one: Pacman has to leave the corner and step back on it to "collect" it', true, 'The start state claims a corner is unvisited although Pacman is on it. Only stepping onto it again removes it.'),
          O('It crashes with an error in ' + C('getSuccessors'), false, 'Nothing illegal happens; the tuple just has one corner too many.'),
          O('It makes no difference at all', false, 'Run the demo: the plan gets longer.'),
          O('It returns a shorter plan', false, 'The buggy problem asks for more work, never less.')],
        hints: ['Is the corner under Pacman in the tuple? When is it removed?'],
        demo: (el) => demoPair(el, [{ title: 'Correct start state', gr: withStart(gr, pos), opts: { path: pick.good.path, un: [0, 1, 2, 3].filter((i) => !(cornersOf(gr)[i][0] === pos[0] && cornersOf(gr)[i][1] === pos[1])) }, ok: true, text: 'plan of ' + stepsWord(pick.good.cost) },
          { title: 'Start state keeps all four', gr: withStart(gr, pos), opts: { path: pick.bad.path }, ok: false, text: 'plan of ' + stepsWord(pick.bad.cost) + ' (' + (pick.bad.cost - pick.good.cost) + ' extra)' }]),
        explain: 'The correct plan costs ' + pick.good.cost + ' and the buggy one ' + pick.bad.cost + '. The filter ' + C('c != self.startingPosition') + ' is what prevents the extra trip.' }; } },

  // ---------------------------------------------------------------- isGoalState
  { id: 'k-goal-multi', title: 'Which states are goals?', parts: ['goal', 'goals'], level: 1,
    gen: (r) => { const gr = mazeFor(r), cs = cornersOf(gr), cells = openList(gr).filter((p) => !isCorner(gr, p)), mid = r.pick(cells), c0 = r.int(0, 3), c1 = (c0 + r.int(1, 3)) % 4;
      const mk = (x, y, un) => C(stR(gr, x, y, un));
      return { type: 'multi',
        prompt: 'Your <code>isGoalState</code> is shown. <b>Tick every state below that it answers True for.</b>',
        visual: (el) => { el.innerHTML = codeHTML({ mark: ['goal_ret'] }); },
        options: [O(mk(mid[0], mid[1], []) + ' (Pacman in the middle of the maze, nothing left)', true, 'The tuple is empty, so no corner is left. Where Pacman stands does not matter.'),
          O(mk(cs[c0][0], cs[c0][1], []) + ' (on a corner, nothing left)', true, 'Empty tuple again.'),
          O(mk(cs[c0][0], cs[c0][1], [c1]) + ' (on a corner, one corner left)', false, 'One corner is still in the tuple, so the job is not finished.'),
          O(mk(mid[0], mid[1], [0, 1, 2, 3]) + ' (four corners left)', false, 'Nothing has been visited yet.'),
          O(mk(cs[c1][0], cs[c1][1], [c0, (c0 + 2) % 4 === c1 ? (c0 + 3) % 4 : (c0 + 2) % 4].sort((a, b) => a - b)) + ' (on a corner, two others left)', false, 'Standing on a corner is not what makes a state a goal.')],
        hints: ['Look only at the second half of the state.'], explain: 'Line ' + lineOf('goal_ret') + ' only looks at ' + C('state[1]') + ', the tuple of unvisited corners.' }; } },

  { id: 'k-goal-bug', title: 'A goal test that stops too soon', parts: ['goal', 'goals'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); const bad = cBFS(gr, { isGoal: (s) => cornersOf(gr).some((c) => c[0] === s.x && c[1] === s.y) }), good = cBFS(gr); return { gr, bad, good }; }, (x) => touchOrder(x.gr, x.gr.start, x.bad.path).order.length < 4, 40), gr = pick.gr;
      return { type: 'mc', demoTitle: 'Where each plan walks',
        prompt: 'A classmate writes the goal test shown. <b>What does BFS return?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { goal_ret: 'return state[0] in self.corners' } }); },
        options: [O('A plan to the nearest corner: it stops as soon as Pacman stands on any corner, with the other corners untouched', true, 'Being on a corner is not the same as having visited all four.'),
          O('The same plan as before: the check is equivalent', false, 'It only asks where Pacman is, not what he has done.'),
          O('An error, because ' + C('state[0]') + ' is not a corner', false, 'It runs fine; it just accepts the wrong states.'),
          O('A plan that visits every corner twice', false, 'It stops far earlier than that.')],
        hints: ['Which part of the state does the buggy line look at? Which part holds the memory?'],
        demo: (el) => demoPair(el, [{ title: 'Buggy goal test', gr: withStart(gr, gr.start), opts: { path: pick.bad.path }, ok: false, text: 'stops after ' + stepsWord(pick.bad.cost) + ', touching ' + touchOrder(gr, gr.start, pick.bad.path).order.length + ' of 4 corners' },
          { title: 'Your goal test', gr: withStart(gr, gr.start), opts: { path: pick.good.path }, ok: true, text: stepsWord(pick.good.cost) + ', touching all 4 corners' }]),
        explain: 'Your line ' + lineOf('goal_ret') + ' only becomes True when the unvisited tuple is empty.' }; } },

  { id: 'k-goals-many', title: 'How many goal states?', parts: ['goals', 'goal'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'In Q1 to Q4 the problem had <b>one</b> goal: the cell with the pellet. How many goal states does <code>CornersProblem</code> have?',
      options: [O('Many: every state whose tuple is empty, with Pacman standing on any open cell', true, 'The goal is "all four corners visited", not "Pacman is at a particular cell".'),
        O('Exactly one: the last corner Pacman reaches', false, 'The last corner is not fixed in advance, and Pacman may stand elsewhere when he finishes.'),
        O('Four: one per corner', false, 'Standing on a corner is not enough to be a goal.'),
        O('None: the problem has no goal state, only a goal test', false, 'The goal test is what defines the goal states. There are many of them.')],
      hints: ['What does the tuple look like at the goal? What is left free?'], explain: 'A goal state is (anywhere, ()). There is one for every open cell.' }) },

  { id: 'k-goal-count', title: 'Count the goal states', parts: ['goals', 'layers', 'size'], level: 2,
    gen: (r) => { const gr = mazeFor(r), N = openCells(gr), R = cReach(gr); let goals = 0; R.map.forEach((s) => { if (cGoal(s)) goals++; });
      return { type: 'numeric', answer: goals, tol: 0,
        prompt: 'This maze has <b>' + N + '</b> open cells and every open cell can be reached. <b>How many goal states does the Corners problem have here?</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, ''),
        hints: ['A goal state has an empty tuple. Where can Pacman be standing when he finishes?'],
        explain: 'One goal state per open cell: ' + goals + '. Pacman can finish anywhere, because after the last corner he may keep walking.' }; } },

  // ---------------------------------------------------------------- getSuccessors
  { id: 'k-wall-click', title: 'Which moves are legal?', parts: ['wall'], level: 1,
    gen: (r) => { const gr = mazeFor(r), spots = openList(gr).filter((p) => { const n = openNbrs(gr, p).length; return n >= 2 && n <= 3; }), pos = r.pick(spots), ans = openNbrs(gr, pos).map((d) => cid(pos[0] + d[0], pos[1] + d[1]));
      return { type: 'cells', pick: 'nodes', grid: gr, cs: 24, label: 'Maze', answer: ans,
        drawOpts: () => ({ hidePellet: true, pac: pos, dots: dotsFor(gr, [0, 1, 2, 3]) }),
        prompt: 'Pacman is on the highlighted cell. <b>Click every cell that is the position of one of the triples <code>getSuccessors</code> returns.</b>',
        hints: ['Check the four neighbours one by one: line ' + lineOf('succ_wall') + ' skips the ones that are walls.'],
        explain: 'Pacman has ' + ans.length + ' legal moves from ' + ptS(pos[0], pos[1]) + '. The other neighbours are walls, so ' + C('continue') + ' skips them.' }; } },

  { id: 'k-succ-order', title: 'In what order are they listed?', parts: ['wall', 'dup'], level: 2,
    gen: (r) => { const gr = mazeFor(r), spots = openList(gr).filter((p) => openNbrs(gr, p).length >= 3), pos = r.pick(spots), nb = openNbrs(gr, pos), ans = nb.map((d) => cid(pos[0] + d[0], pos[1] + d[1]));
      return { type: 'cells', pick: 'seq', max: ans.length, grid: gr, cs: 24, label: 'Maze', answer: ans,
        drawOpts: () => ({ hidePellet: true, pac: pos, dots: dotsFor(gr, [0, 1, 2, 3]) }),
        prompt: 'Pacman is on the highlighted cell. Look at the <code>for action in [...]</code> line of your <code>getSuccessors</code>. <b>Click the neighbouring cells in the order the successors appear in the returned list.</b>',
        visual: (el) => { el.innerHTML = codeHTML({ mark: ['succ_for'] }); },
        hints: ['Your list is North, South, East, West. North is up, South is down.'],
        explain: 'The order is ' + nb.map((d) => d[3]).join(', ') + '. This order decides which states enter the BFS queue first, so it decides the exact plan that is returned among equally short ones.' }; } },

  { id: 'k-succ-count', title: 'How many triples come back?', parts: ['wall', 'cost'], level: 1,
    gen: (r) => { const gr = mazeFor(r), pos = r.pick(openList(gr)), n = openNbrs(gr, pos).length;
      return { type: 'numeric', answer: n, tol: 0,
        prompt: 'Pacman stands where the board shows. <b>How many triples does <code>getSuccessors</code> return for a state with Pacman here?</b>',
        visual: (el) => cBoard(el, gr, { pos, un: [0, 1, 2, 3] }, ''),
        hints: ['One triple per legal move.'], explain: ptS(pos[0], pos[1]) + ' has ' + n + ' open neighbour' + (n === 1 ? '' : 's') + '. Each legal move gives one triple with step cost 1.' }; } },

  { id: 'k-triple', title: 'What does one triple look like?', parts: ['fresh', 'cost', 'content'], level: 1,
    gen: (r) => { const gr = mazeFor(r), pos = r.pick(openList(gr)), un = r.pick(subsetsOf(4).filter((s) => s.length >= 2)), nb = openNbrs(gr, pos), d = r.pick(nb), nx = pos[0] + d[0], ny = pos[1] + d[1], cs = cornersOf(gr);
      const nun = un.filter((i) => !(cs[i][0] === nx && cs[i][1] === ny)), good = '(' + stR(gr, nx, ny, nun) + ", '" + d[3] + "', 1)";
      return { type: 'mc',
        prompt: 'From the state <code>' + esc(stR(gr, pos[0], pos[1], un)) + '</code> the action <b>' + d[3] + '</b> is legal. <b>Which triple does <code>getSuccessors</code> put in its list for that action?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ mark: ['succ_append'] }); },
        options: [O(C(esc(good)), true, 'A triple: (the whole successor STATE, the action, the step cost).'),
          O(C(esc('(' + ptS(nx, ny) + ", '" + d[3] + "', 1)")), false, 'The successor must be a full state, tuple included, not just the new position.'),
          O(C(esc('(' + stR(gr, nx, ny, nun) + ", 1, '" + d[3] + "')")), false, 'The order is (state, action, cost).'),
          O(C(esc('(' + ptS(nx, ny) + ', ' + unRepr(gr, nun) + ", '" + d[3] + "', 1)")), false, 'That is four items. The position and the tuple must be wrapped together as one state.')],
        hints: ['Look at line ' + lineOf('succ_append') + ': count the parentheses.'], explain: 'Line ' + lineOf('succ_append') + ' builds ' + C('((next_position, next_unvisited), action, 1)') + '.' }; } },

  { id: 'k-corner-step', title: 'Step onto a corner', parts: ['corner', 'fresh'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), cs = cornersOf(gr), ci = r.int(0, 3), c = cs[ci], dirs = openNbrs(gr, c); const d = r.pick(dirs); return { gr, ci, c, d, from: [c[0] + d[0], c[1] + d[1]] }; }, (x) => !isCorner(x.gr, x.from), 80), gr = pick.gr, cs = cornersOf(gr), un = [pick.ci].concat(r.shuffle([0, 1, 2, 3].filter((i) => i !== pick.ci)).slice(0, r.int(1, 3))).sort((a, b) => a - b);
      const move = CDIRS.find((q) => q[0] === -pick.d[0] && q[1] === -pick.d[1]), nun = un.filter((i) => i !== pick.ci), other = un.filter((i) => i !== pick.ci)[0], from = pick.from;
      const wrongKeep = stR(gr, pick.c[0], pick.c[1], un), wrongOther = stR(gr, pick.c[0], pick.c[1], un.filter((i) => i !== other)), wrongPos = stR(gr, from[0], from[1], nun);
      return { type: 'mc',
        prompt: 'Pacman is at ' + ptS(from[0], from[1]) + ' and the state is <code>' + esc(stR(gr, from[0], from[1], un)) + '</code>. He takes the action <b>' + move[3] + '</b>, which lands on the ' + cornerWord(pick.ci) + ' corner. <b>What is the successor state?</b>',
        visual: (el) => { cBoard(el, gr, { pos: from, un }, 'Pacman, with the corners still to do'); el.insertAdjacentHTML('beforeend', codeHTML({ mark: ['succ_nextpos', 'succ_nextun'] })); },
        options: [O(C(esc(stR(gr, pick.c[0], pick.c[1], nun))), true, 'The position moves, and the corner Pacman just stepped on is dropped.'),
          O(C(esc(wrongKeep)), false, 'The corner is still listed, although Pacman is standing on it.'),
          O(C(esc(wrongOther)), false, 'This drops the wrong corner: the filter removes the one equal to ' + C('next_position') + ', not just any.'),
          O(C(esc(wrongPos)), false, 'The corner is dropped but the position did not move.')],
        hints: ['Two things change: the position and the tuple. Which corner is equal to next_position?'], explain: 'Line ' + lineOf('succ_nextun') + ' keeps every corner c with ' + C('c != next_position') + ', so exactly the corner stepped on disappears.' }; } },

  { id: 'k-trace-path', title: 'Which corners are left after this walk?', parts: ['corner', 'content', 'layers'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), k = r.int(1, 3), order = r.shuffle([0, 1, 2, 3]).slice(0, k); return { gr, order, path: tourPlan(gr, gr.start, order) }; }, (x) => { const t = touchOrder(x.gr, x.gr.start, x.path).order; return t.length >= 1 && t.length <= 3 && x.path.length >= 6; }, 80), gr = pick.gr;
      const touched = touchOrder(gr, gr.start, pick.path).order, left = [0, 1, 2, 3].filter((i) => touched.indexOf(i) < 0), cs = cornersOf(gr);
      return { type: 'multi',
        prompt: 'Pacman starts at the yellow shape and walks the whole <b>line</b> drawn on the board. <b>Tick every corner that is still in the unvisited tuple at the end.</b> (Passing through a corner counts as visiting it.)',
        visual: (el) => { cBoard(el, gr, { path: pick.path, un: [0, 1, 2, 3] }, 'The walk, ' + pick.path.length + ' steps'); },
        options: [0, 1, 2, 3].map((i) => O('the ' + cornerWord(i) + ' corner ' + ptS(cs[i][0], cs[i][1]), left.indexOf(i) >= 0, left.indexOf(i) >= 0 ? 'The walk never touches it, so it is still in the tuple.' : 'The walk passes through it, so it was removed from the tuple.')),
        hints: ['Follow the line with your finger and note every corner it crosses.'], explain: 'The walk touches ' + (touched.length ? touched.map((i) => cornerWord(i)).join(', ') : 'no corner') + '. Unvisited at the end: ' + (left.length ? left.map((i) => cornerWord(i)).join(', ') : 'none') + '.' }; } },

  { id: 'k-code-succ', title: 'Read getSuccessors', parts: ['wall', 'corner', 'cost', 'fresh'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: 'Study your <code>getSuccessors</code>. <b>Tick every true statement.</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['succ_for', 'succ_wall', 'succ_continue', 'succ_nextun', 'succ_append'] }); },
      options: [O(C('continue') + ' skips only the action that hits a wall; the loop goes on with the next action', true, 'It ends this pass of the ' + C('for') + ' loop, not the function.'),
        O(C('position, unvisited = state') + ' takes the state apart; ' + C('x, y = position') + ' then takes the position apart', true, 'Two levels of unpacking, because the state holds a position and a tuple.'),
        O('At most four triples are returned, one per action', true, 'There are only four actions in the list.'),
        O(C('self.walls[nextx][nexty]') + ' is True when the next cell is OPEN', false, 'It is True for a wall; that is why the line says ' + C('continue') + '.'),
        O('The step cost is bigger when the move lands on a corner', false, 'The cost is always 1.'),
        O(C('next_unvisited') + ' can hold more corners than ' + C('unvisited'), false, 'It is a filtered copy: it can only be equal or shorter.')],
      hints: ['Check every claim against the actual line.'], explain: 'Each line has a single job: legal moves, new position, new tuple, one triple.' }) },

  { id: 'k-expanded', title: 'What is "nodes expanded"?', parts: ['cost'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'The autograder prints <code>Search nodes expanded: N</code>. In your code, what does <b>N</b> count?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['succ_count'] }); },
      options: [O('How many times <code>getSuccessors</code> has been called: the line marked runs once per call', true, 'Each call corresponds to one state being expanded.'),
        O('How many states were put in the queue', false, 'Pushes are not counted; only calls to getSuccessors are.'),
        O('The number of steps in the plan', false, 'That is the plan length, printed separately.'),
        O('How many corners were visited', false, 'Unrelated to the counter.')],
      hints: ['Where does the counter change?'], explain: 'Line ' + lineOf('succ_count') + ' is marked "DO NOT CHANGE" because the autograder reads that counter.' }) },

  // ---------------------------------------------------------------- tuples
  { id: 'k-form-tuple', title: 'Why a tuple?', parts: ['form', 'dup'], level: 1,
    gen: () => ({ type: 'multi',
      prompt: 'The unvisited corners are kept in a <b>tuple</b>, not a list. <b>Tick every true reason.</b>',
      options: [O('A tuple is hashable, so a whole state can be stored in the ' + C('visited') + ' set', true, 'A set needs hashable members. A list inside a state would make the state unhashable.'),
        O('A tuple cannot be changed in place, so a successor cannot accidentally alter its parent', true, 'Everything a state holds stays what it was when it was made.'),
        O('Two equal tuples compare equal, so the search can recognise the same state reached by two routes', true, 'That is how duplicates are found.'),
        O('Lists cannot hold coordinate pairs', false, 'They can. That is not the reason.'),
        O('util.Queue only accepts tuples', false, 'It accepts any object.'),
        O('Tuples are always faster than lists', false, 'Not the point, and not always true.')],
      hints: ['Think about what the search does with a state: remember it, compare it, hand it on.'], explain: 'Your code builds each tuple with ' + C('tuple(... for ...)') + ' on lines ' + lineOf('start_un') + ' and ' + lineOf('succ_nextun') + '.' }) },

  { id: 'k-list-error', title: 'A list inside the state', parts: ['form', 'fresh'], level: 2,
    gen: () => ({ type: 'mc', demoTitle: 'What Python says',
      prompt: 'A classmate builds the unvisited corners as <b>lists</b> in both places (shown). BFS then reaches <code>visited.add(current_state)</code> or tests <code>successor not in visited</code>. <b>What happens?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ replace: { start_un: 'unvisited = [c for c in self.corners if c != self.startingPosition]', succ_nextun: 'next_unvisited = [c for c in unvisited if c != next_position]' } }); },
      options: [O('A TypeError: unhashable type: \'list\', because a state that contains a list cannot be hashed', true, 'Sets and dict keys need hashable members. A tuple containing a list is not hashable.'),
        O('Nothing. Lists and tuples behave the same inside a set', false, 'Lists are mutable and therefore unhashable.'),
        O('It works, only slower', false, 'It fails at the first set operation.'),
        O('An IndexError in the filter', false, 'The filter itself is fine; the failure comes from hashing the state.')],
      hints: ['What does a set do to a member before it stores it?'],
      demo: (el) => { el.innerHTML = '<pre style="margin:0;padding:10px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font:12.5px/1.6 var(--font-mono);overflow-x:auto;max-width:100%">&gt;&gt;&gt; visited = set()\n&gt;&gt;&gt; visited.add(((3, 3), [(1, 1), (1, 5)]))\nTypeError: unhashable type: \'list\'</pre>'; },
      explain: 'This is why the state uses ' + C('tuple(...)') + ': the same filter, but the result can be hashed.' }) },

  { id: 'k-order-tuple', title: 'Which successor state is built?', parts: ['order', 'content', 'form'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), pair = r.shuffle([0, 1, 2, 3]).slice(0, 2); return { gr, left: pair.slice().sort((a, b) => a - b), first: pair[0], second: pair[1] }; }, () => true, 1), gr = pick.gr, pos = gr.start, L = pick.left, cs = cornersOf(gr);
      const done = [0, 1, 2, 3].filter((i) => L.indexOf(i) < 0);
      const lcorners = (list) => stR(gr, pos[0], pos[1], list);
      return { type: 'mc',
        prompt: 'A move has just brought Pacman onto the cell <b>' + ptS(pos[0], pos[1]) + '</b>, so <code>next_position</code> is ' + ptS(pos[0], pos[1]) + '. After that move the corners still to visit are the ' + cornerWord(L[1]) + ' and the ' + cornerWord(L[0]) + ' ones (in that order of mention). <b>Which successor state, <code>(next_position, next_unvisited)</code>, does your <code>getSuccessors</code> build for this move?</b> Pay attention to the order of the two corners.',
        visual: (el) => { cBoard(el, gr, { un: L }, 'Done: ' + done.map((i) => cornerWord(i)).join(' and ') + '. Still to do: ' + L.map((i) => cornerWord(i)).join(' and ')); },
        options: [O(C(esc(lcorners(L))), true, 'Always in the order of ' + C('self.corners') + ' (SW, NW, SE, NE): the filter keeps that order.'),
          O(C(esc(lcorners(L.slice().reverse()))), false, 'Same corners in the other order. Tuples compare in order, so this would be a different state.'),
          O(C(esc(lcorners(done))), false, 'That lists the corners already done. The tuple holds what is LEFT.'),
          O(C(esc('(' + ptS(pos[0], pos[1]) + ', [' + L.map((i) => ptS(cs[i][0], cs[i][1])).join(', ') + '])')), false, 'A list instead of a tuple: not hashable.')],
        hints: ['The tuple is made by filtering ' + C('unvisited') + '. In which order does the filter walk through it?'], explain: 'The start tuple follows ' + C('self.corners') + ' and the filter on line ' + lineOf('succ_nextun') + ' only removes items, so the order never changes.' }; } },

  { id: 'k-order-equal', title: 'Same corners, other order', parts: ['order', 'dup', 'form'], level: 2,
    gen: (r) => { const gr = mazeFor(r), pos = r.pick(openList(gr).filter((p) => !isCorner(gr, p))), pair = r.shuffle([0, 1, 2, 3]).slice(0, 2).sort((a, b) => a - b);
      return { type: 'mc',
        prompt: 'Two states:<br><code>' + esc(stR(gr, pos[0], pos[1], pair)) + '</code><br><code>' + esc(stR(gr, pos[0], pos[1], pair.slice().reverse())) + '</code><br><b>Does the <code>visited</code> set treat them as the same state?</b>',
        options: [O('No. Tuples compare in order, so they are two different states', true, 'That is why your code never reorders the corners: one situation must always produce one tuple.'),
          O('Yes. They hold the same corners', false, 'That would be true for sets or frozensets, not for tuples.'),
          O('Yes, because the positions are equal', false, 'The whole state is compared, not just the first part.'),
          O('Python raises an error comparing them', false, 'Comparing tuples never errors here.')],
        hints: ['Is (1, 2) equal to (2, 1) in Python?'], explain: 'If the order could vary, the same situation would look like several different states and BFS would explore it several times.' }; } },

  { id: 'k-visit-order', title: 'Remembering the order of visits', parts: ['order', 'size'], level: 3,
    gen: (r) => { const gr = r.int(0, 1) ? getMaze('tinyCorners') : mazeFor(r), mine = cReach(gr).map.size, other = countVisitOrder(gr);
      return { type: 'mc', demoTitle: 'Count the states both ways',
        prompt: 'Another design keeps the corners <b>already visited, in the order they were visited</b>, instead of the corners still to visit. <b>How does the number of reachable states compare with yours?</b>',
        options: [O('Larger: every visiting order counts as a different state, so one set of corners can appear in several ways', true, 'There are 65 ordered ways to have visited some of four corners, against only 16 subsets.'),
          O('Smaller: remembering the order prunes states', false, 'It cannot prune; it distinguishes more.'),
          O('Identical: the same information is stored', false, 'The order is extra information the problem does not need.'),
          O('The search stops working', false, 'It would still be correct, only slower.')],
        hints: ['In how many orders can three corners be visited? Does the future depend on that order?'],
        demo: (el) => { el.innerHTML = '<div class="demo" style="border:0;padding:0"><div class="res ok" style="font-size:.9rem">Your representation (corners left, as a set in a fixed order): <b>' + mine + '</b> reachable states on this maze.</div><div class="res bad" style="font-size:.9rem">Visited corners in visiting order: <b>' + other + '</b> reachable states (' + (other / mine).toFixed(1) + ' times as many).</div></div>'; },
        explain: 'The order in which corners were visited has no effect on what is left to do, so storing it only multiplies states for nothing.' }; } },

  { id: 'k-global-memory', title: 'Memory kept on the problem object', parts: ['need', 'lean', 'fresh'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); return { gr, run: globalMemoryBFS(gr) }; }, (x) => x.run.ok && touchOrder(x.gr, x.gr.start, x.run.path).order.length < 4, 60), gr = pick.gr, good = cBFS(gr), touched = touchOrder(gr, gr.start, pick.run.path).order.length;
      return { type: 'mc', demoTitle: 'The plan this version returns',
        prompt: 'A classmate keeps the state as just the position and stores the corners found so far in a set on the problem object (<code>self.found</code>), as shown. <b>What is wrong?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { start_un: 'self.found = set()   # corners seen so far', start_ret: 'return self.startingPosition', goal_ret: 'return len(self.found) == 4', succ_nextun: 'if next_position in self.corners: self.found.add(next_position)', succ_append: 'successors.append((next_position, action, 1))' } }); },
        options: [O('The set is shared by every branch the search explores, so a corner found in one branch counts for all of them; the goal can be declared on a route that never visited every corner', true, 'The memory belongs to a route, so it must travel inside the state. A set on the problem object belongs to the whole search.'),
          O('Nothing: it is equivalent and cheaper', false, 'Try it: the demo returns a plan that does not visit every corner.'),
          O('Python forbids setting attributes on self inside a method', false, 'It is allowed; that is not the problem.'),
          O('It works, but the plan visits every corner twice', false, 'It does not even visit every corner.')],
        hints: ['BFS explores many routes. Whose memory is a set kept on self?'],
        demo: (el) => demoPair(el, [{ title: 'Memory on the problem object', gr: withStart(gr, gr.start), opts: { path: pick.run.path }, ok: false, text: stepsWord(pick.run.path.length) + ', touches only ' + touched + ' of 4 corners' },
          { title: 'Your design (memory in the state)', gr: withStart(gr, gr.start), opts: { path: good.path }, ok: true, text: stepsWord(good.cost) + ', touches all 4 corners' }]),
        explain: 'This is the main reason the unvisited corners are part of the state: each route carries its own memory.' }; } },

  // ---------------------------------------------------------------- state space
  { id: 'k-size-bound', title: 'How big can the state space be?', parts: ['size'], level: 1,
    gen: (r) => { const gr = mazeFor(r), N = openCells(gr);
      return { type: 'numeric', answer: N * 16, tol: 0,
        prompt: 'This maze has <b>' + N + '</b> open cells. A state is a cell together with a subset of the four corners. <b>What is the largest number of different states there could be?</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, ''),
        hints: ['How many subsets does a set of four corners have?'], explain: 'Each of the ' + N + ' cells can be combined with each of the 2^4 = 16 subsets: ' + N + ' × 16 = ' + (N * 16) + '. Reachable states are fewer, as the next questions show.' }; } },

  { id: 'k-impossible', title: 'Combinations that never happen', parts: ['reach', 'size'], level: 2,
    gen: (r) => { const gr = r.int(0, 1) ? getMaze('tinyCorners') : mazeFor(r), N = openCells(gr), reach = cReach(gr).map.size;
      return { type: 'numeric', answer: 32, tol: 0, demoTitle: 'The bound against the real count',
        prompt: 'Some of the cell × subset combinations can never occur. For example, Pacman cannot stand on the bottom-left corner while that corner is still in the unvisited tuple, because stepping on it removes it. <b>Counting all four corner cells, how many such impossible combinations are there?</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, ''),
        hints: ['For one corner cell: how many subsets of the OTHER three corners plus this one? Only half of the 16 subsets contain it.'],
        demo: (el) => { el.innerHTML = '<div class="res ok" style="font-size:.9rem">This maze: ' + N + ' cells × 16 = <b>' + (N * 16) + '</b>. Reachable states counted by the engine: <b>' + reach + '</b>. ' + (N * 16 - reach === 32 ? 'The gap is exactly these <b>32</b>.' : 'The gap is ' + (N * 16 - reach) + ': the 32 impossible ones and some more caused by this maze\'s dead ends.') + '</div>'; },
        explain: 'Each corner cell pairs with 8 subsets that contain that same corner, and those 8 never happen. 4 corners × 8 = 32.' }; } },

  { id: 'k-reach-which', title: 'Which states can really occur?', parts: ['reach', 'content'], level: 2,
    gen: (r) => { const gr = mazeFor(r), R = cReach(gr), cs = cornersOf(gr), c = r.int(0, 3), cells = openList(gr).filter((p) => !isCorner(gr, p)), mid = r.pick(cells), walls = [];
      for (let x = 1; x < gr.W - 1; x++) for (let y = 1; y < gr.H - 1; y++) if (gr.wall[x][y]) walls.push([x, y]);
      const wcell = walls.length ? r.pick(walls) : [0, 0], stOn = { x: cs[c][0], y: cs[c][1], un: [c] }, stOff = { x: cs[c][0], y: cs[c][1], un: [0, 1, 2, 3].filter((i) => i !== c) }, stMid = { x: mid[0], y: mid[1], un: [] }, stWall = { x: wcell[0], y: wcell[1], un: [0, 1, 2, 3] };
      const items = [[stOn, 'Standing on the ' + cornerWord(c) + ' corner while it is still unvisited'], [stOff, 'Standing on the ' + cornerWord(c) + ' corner with the other three still to do'], [stMid, 'In the middle of the maze with all four corners done'], [stWall, 'On a wall cell with four corners left']];
      return { type: 'multi',
        prompt: 'Which of these states can occur during a search from the start state of this maze? <b>Tick every one that can.</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, ''),
        options: items.map((it) => { const ok = R.map.has(ckey(it[0])); return O(it[1] + ': <code>' + esc(stRepr(gr, it[0])) + '</code>', ok, ok ? 'It can occur: there is a route to it.' : (it[0].un.indexOf(c) >= 0 && it[0].x === cs[c][0] && it[0].y === cs[c][1] ? 'Stepping onto a corner removes it, so this combination is impossible.' : 'Pacman can never stand on a wall.')); }),
        hints: ['A corner cell is entered by walking onto it. What happens to the tuple at that moment?'], explain: 'Reachable means some sequence of legal moves leads there from the start state.' }; } },

  { id: 'k-layers', title: 'Can a corner come back?', parts: ['layers', 'reach'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'During a search, can a path go from a state with <b>two</b> corners left to a state with <b>three</b> corners left?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['succ_nextun'] }); },
      options: [O('Never: a step can only remove a corner from the tuple; nothing puts one back', true, 'The filter only keeps or drops. So along any path the number of corners left never increases.'),
        O('Yes, when Pacman walks away from a corner he visited', false, 'Leaving a corner does not undo the visit.'),
        O('Yes, when BFS backtracks', false, 'BFS does not undo actions; each state is its own entry in the queue.'),
        O('Only in mazes with loops', false, 'Loops return to the same cell, but the tuple still cannot grow.')],
      hints: ['Look at line ' + lineOf('succ_nextun') + ': can the new tuple be longer than the old one?'], explain: 'This one-way property splits the state space into five layers (4, 3, 2, 1, 0 corners left). The search only ever moves down through them.' }) },

  { id: 'k-bfs-depth', title: 'How deep is the first layer change?', parts: ['layers', 'bfs'], level: 2,
    gen: (r) => { const gr = mazeFor(r), cs = cornersOf(gr), d = Math.min.apply(null, cs.map((c) => mdist(gr, gr.start, c)));
      return { type: 'numeric', answer: d, tol: 0, unit: 'steps',
        prompt: 'BFS starts with four corners unvisited. After how many steps does it first create a state with only <b>three</b> corners left? (That happens the first time Pacman can touch any corner.)',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, ''),
        hints: ['Count the walking distance to the closest corner. Walls block, so do not just use the straight-line gap.'], explain: 'The nearest corner is ' + d + ' steps away, so the first state with three corners left sits at depth ' + d + '.' }; } },

  // ---------------------------------------------------------------- searching it
  { id: 'k-dup-cell', title: 'Back to the same cell', parts: ['dup', 'need'], level: 1,
    gen: (r) => { const gr = mazeFor(r), pos = r.pick(openList(gr).filter((p) => !isCorner(gr, p))), a = [0, 1, 2, 3], b = r.pick([[0, 3], [1, 2], [2], [1]]);
      return { type: 'mc',
        prompt: 'BFS is expanding states. It has already seen <code>' + esc(stR(gr, pos[0], pos[1], a)) + '</code>. Now a successor <code>' + esc(stR(gr, pos[0], pos[1], b)) + '</code> appears: same cell, fewer corners left. <b>Does BFS skip it as "already seen"?</b>',
        options: [O('No. The whole state is compared and the tuples differ, so this is new territory', true, 'The second visit has done more of the job, so it is a different situation.'),
          O('Yes. Same position means same state', false, 'Position is only half of the state.'),
          O('Yes, but only if the queue is empty', false, 'The check does not depend on the queue size.'),
          O('It depends on which comes first in the queue', false, 'Equality of states is all that matters.')],
        hints: ['What does ' + C('successor not in visited') + ' compare?'], explain: 'This is the reason BFS can expand the same cell up to 16 times: once for each distinct tuple.' }; } },

  { id: 'k-dup-count', title: 'How many states at one cell?', parts: ['dup', 'size', 'reach'], level: 2,
    gen: (r) => { const onCorner = r.int(0, 2) === 0, theory = onCorner ? 8 : 16;
      const pick = find(r, () => { const gr = mazeFor(r), cs = cornersOf(gr), R = cReach(gr), cell = onCorner ? r.pick(cs) : r.pick(openList(gr).filter((p) => !isCorner(gr, p))); let n = 0; R.map.forEach((s) => { if (s.x === cell[0] && s.y === cell[1]) n++; }); return { gr, cell, n }; }, (x) => x.n === theory, 60);
      const gr = pick.gr, cell = pick.cell, n = pick.n;
      return { type: 'numeric', answer: n, tol: 0,
        prompt: 'Look at the highlighted cell' + (onCorner ? ' (it is a <b>corner</b>)' : ' (it is <b>not</b> a corner)') + '. <b>How many different states, over all subsets of corners, can have Pacman standing here?</b>',
        visual: (el) => cBoard(el, gr, { pos: cell, un: [0, 1, 2, 3] }, ''),
        hints: onCorner ? ['A subset is allowed only if it does not contain this corner itself.'] : ['Every subset of the four corners can be left, one state each.'],
        explain: onCorner ? 'A corner cell can only hold states in which that corner is already done: 2^3 = 8 subsets of the other corners.' : 'A plain cell can be combined with any of the 2^4 = 16 subsets (in this maze every one of them is reachable).' }; } },

  { id: 'k-bfs-medium', title: 'More expansions than cells', parts: ['size', 'dup', 'bfs'], level: 2,
    gen: () => { const gr = getMaze('mediumCorners'), N = openCells(gr), run = cBFS(gr);
      return { type: 'mc',
        prompt: 'On <code>mediumCorners</code> your BFS expands <b>' + run.expanded + '</b> states, but the maze has only <b>' + N + '</b> open cells. <b>How can it expand more states than there are cells?</b>',
        visual: (el) => cBoard(el, gr, { cs: 10, un: [0, 1, 2, 3] }, 'mediumCorners'),
        options: [O('A cell is expanded again for each different set of corners left; up to 16 different states stand on one cell', true, 'A state is a cell and a set of corners, so one cell can be expanded many times.'),
          O('BFS has a bug that revisits states', false, 'Each state is expanded at most once.'),
          O('The walls are counted as cells', false, 'They are not.'),
          O('Each state is expanded twice, once in each direction', false, 'BFS expands every state once.')],
        hints: ['Compare the number of expansions with cells × 16.'], explain: run.expanded + ' / ' + N + ' is about ' + (run.expanded / N).toFixed(1) + ' expansions per cell, below the limit of 16 because BFS stops when it first reaches a goal state.' }; } },

  { id: 'k-bfs-wave', title: 'Where does BFS look?', parts: ['bfs', 'size', 'layers'], level: 2,
    gen: (r) => { const gr = mazeFor(r), cs = cornersOf(gr), run = cBFS(gr), heat = {}, counts = {};
      run.order.forEach((s) => { const k = cid(s.x, s.y); counts[k] = (counts[k] || 0) + 1; });
      Object.keys(counts).forEach((k) => { heat[k] = counts[k] / 16; });
      const near = Math.min.apply(null, cs.map((c) => mdist(gr, gr.start, c))), disc = {}; openList(gr).forEach((p) => { if (mdist(gr, gr.start, p) <= near) disc[cid(p[0], p[1])] = 0.9; });
      const line = {}; planPts(gr, gr.start, run.path).forEach((p) => { line[cid(p[0], p[1])] = 0.9; });
      const dotsOnly = {}; cs.forEach((c) => { dotsOnly[cid(c[0], c[1])] = 0.9; });
      const mk = (h) => (cv) => cDraw(cv, gr, { cs: 11, heat: h, un: [0, 1, 2, 3] });
      const cands = [{ k: 'right', h: heat, t: 'Almost the whole maze is shaded: BFS has to reach every corner, so its wave grows until it has done a full tour.' }, { k: 'disc', h: disc, t: 'This is what BFS would look like if one corner were the goal. Here the goal needs all four.' }, { k: 'line', h: line, t: 'BFS does not know the route in advance; it only discovers it by growing everywhere.' }, { k: 'dots', h: dotsOnly, t: 'BFS expands cells all over the maze, not only the four corners.' }];
      return { type: 'mc', visualOptions: true,
        prompt: 'The shading shows where the expanded states stood (darker means more expansions on that cell) at the moment your BFS pops its first goal state in this maze. <b>Which picture is it?</b>',
        options: r.shuffle(cands).map((x) => { const o = O('<canvas class="board"></canvas>', x.k === 'right', x.t); o.draw = mk(x.h); return o; }),
        hints: ['The goal is "all four corners visited". How far does the wave have to travel?'], explain: 'BFS expanded ' + run.expanded + ' states while building a ' + run.cost + '-step tour: it explores every state closer than the goal.' }; } },

  { id: 'k-bfs-why', title: 'Why BFS and not UCS?', parts: ['bfs', 'cost'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'The assignment asks for <b>breadth-first search</b> on <code>CornersProblem</code> and expects the <b>shortest</b> plan. Why does BFS give the cheapest plan here?',
      options: [O('Every step costs 1, so the plan with the fewest steps is the cheapest, and BFS reaches goal states in order of number of steps', true, 'With equal step costs BFS and UCS behave the same.'),
        O('BFS always returns the cheapest plan, whatever the costs', false, 'It returns the fewest steps. That is the same as cheapest only when every step costs the same.'),
        O('BFS cannot get stuck in loops, unlike UCS', false, 'Both use a visited set.'),
        O('The corners are always close to the start', false, 'Distance has nothing to do with it.')],
      hints: ['What would change if a step to a corner cost 5?'], explain: 'Line ' + lineOf('succ_append') + ' sets the step cost to 1 for every move.' }) },

  { id: 'k-nearest-first', title: 'Always go to the nearest corner?', parts: ['trap', 'bfs'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); const all = tours(gr, gr.start, [0, 1, 2, 3], mdist), best = bestOf(all), cs = cornersOf(gr); let rest = [0, 1, 2, 3], here = gr.start, t = 0, order = [];
        while (rest.length) { let bi = 0; rest.forEach((i, k) => { if (mdist(gr, here, cs[i]) < mdist(gr, here, cs[rest[bi]])) bi = k; }); t += mdist(gr, here, cs[rest[bi]]); here = cs[rest[bi]]; order.push(rest[bi]); rest.splice(bi, 1); }
        return { gr, best, greedy: { cost: t, order } }; }, (x) => x.greedy.cost > x.best.cost, 150), gr = pick.gr;
      return { type: 'mc', demoTitle: 'Two ways round the same maze',
        prompt: 'A classmate says: "No search needed. Walk to the nearest unvisited corner, then to the nearest one from there, and so on." <b>Does that always give the shortest tour?</b> (This maze is one where it does not.)',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, 'The maze'),
        options: [O('No. The nearest corner first can leave you far from the rest, so a longer first leg can make the whole tour shorter', true, 'Choosing locally is not the same as choosing the best complete tour.'),
          O('Yes, because every leg is the shortest possible', false, 'Each leg is shortest, the sum is not necessarily.'),
          O('Yes, but only in mazes without walls', false, 'It can fail in an empty room too.'),
          O('No, but only because of ties', false, 'It fails even when every choice is unambiguous.')],
        hints: ['Compare the total of the nearest-first walk with other orders of the same four corners.'],
        demo: (el) => demoPair(el, [{ title: 'Nearest corner first', gr: withStart(gr, gr.start), opts: { path: tourPlan(gr, gr.start, pick.greedy.order) }, ok: false, text: stepsWord(pick.greedy.cost) },
          { title: 'Best order (what BFS finds)', gr: withStart(gr, gr.start), opts: { path: tourPlan(gr, gr.start, pick.best.order) }, ok: true, text: stepsWord(pick.best.cost) }]),
        explain: 'BFS tries every order implicitly, since it explores all states by number of steps, so it cannot be fooled by a locally attractive first move.' }; } },

  { id: 'k-best-order', title: 'Find the best order', parts: ['bfs', 'trap', 'goals'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); return { gr, all: tours(gr, gr.start, [0, 1, 2, 3], mdist) }; }, (x) => uniqueBest(x.all), 150), gr = pick.gr, best = bestOf(pick.all);
      return { type: 'cells', pick: 'seq', max: 4, grid: gr, cs: 24, label: 'Maze', answer: idsOf(gr, best.order),
        drawOpts: () => ({ hidePellet: true, dots: dotsFor(gr, [0, 1, 2, 3]) }),
        prompt: 'Your BFS returns the shortest plan that touches all four corners. <b>Click the four corners in the order that plan visits them.</b> Count walking distances, walls included.',
        hints: ['Try the first corner that looks nearest, then compare it with going the other way round.', 'There are 24 orders, but most are clearly long: tours usually go round the edge.'],
        explain: 'The shortest tour visits ' + best.order.map((i) => cornerWord(i)).join(', then ') + ' and takes ' + best.cost + ' steps. BFS finds it without being told the order.' }; } },

  { id: 'k-open-room', title: 'The shortest tour of an empty room', parts: ['bfs', 'trap'], level: 3,
    gen: (r) => { const W = r.int(8, 12), Hh = r.int(6, 9), gr = cRandMaze(r, { W, H: Hh, segs: 0, startCorner: 0 }), run = cBFS(gr), a = W - 3, b = Hh - 3;
      return { type: 'numeric', answer: run.cost, tol: 0, unit: 'steps',
        prompt: 'The room below has no inner walls and Pacman starts on the bottom-left corner. <b>How many steps does the shortest plan have that touches all four corners?</b>',
        visual: (el) => cBoard(el, gr, { un: [1, 2, 3] }, 'Pacman starts on a corner: ' + (W - 2) + ' × ' + (Hh - 2) + ' open cells'),
        hints: ['Going round the edge is best. There are two directions.', 'The corners are ' + a + ' steps apart horizontally and ' + b + ' steps apart vertically.'],
        explain: 'Two ways: ' + (a + 2 * b) + ' (up, across, down) or ' + (2 * a + b) + ' (across, up, back). The shorter is ' + run.cost + '.' }; } },

  // ---------------------------------------------------------------- bugs in your own code
  { id: 'k-bug-wall', title: 'The wall check is missing', parts: ['wall'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r, { segs: 5 }); return { gr, run: cBFS(gr, { ignoreWalls: true }) }; }, (x) => !walkOK(x.gr, x.gr.start, x.run.path), 40), gr = pick.gr;
      return { type: 'mc', demoTitle: 'The plan this version returns',
        prompt: 'Imagine the two lines for the wall check are deleted (shown struck out). <b>What happens?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ remove: ['succ_wall', 'succ_continue'] }); },
        options: [O('Pacman may move into walls: BFS returns a short plan that cuts through the maze walls and is not a legal plan', true, 'Without the check, every neighbour counts as a legal move. The autograder would reject the plan.'),
          O('Nothing: BFS never tries to enter walls on its own', false, 'The only thing that keeps the search out of walls is that check.'),
          O('The search becomes slower but the answer stays the same', false, 'The answer changes because illegal shortcuts are allowed.'),
          O('An IndexError at the first wall', false, 'The border walls make every index valid.')],
        hints: ['Which lines say a move is not allowed?'],
        demo: (el) => demoPair(el, [{ title: 'No wall check', gr: withStart(gr, gr.start), opts: { path: pick.run.path }, ok: false, text: stepsWord(pick.run.path.length) + ' and the path crosses walls' }, { title: 'Your code', gr: withStart(gr, gr.start), opts: { path: cBFS(gr).path }, ok: true, text: stepsWord(cBFS(gr).cost) + ', every move legal' }]),
        explain: 'Lines ' + lineOf('succ_wall') + ' and ' + lineOf('succ_continue') + ' are the whole definition of a legal move.' }; } },

  { id: 'k-bug-never', title: 'The corner is never removed', parts: ['corner', 'goal'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'A classmate changes the line that builds the new tuple to the version shown (the tuple stays as it was). <b>What happens to BFS?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ replace: { succ_nextun: 'next_unvisited = unvisited' } }); },
      options: [O('No state ever has an empty tuple, so no goal is found: BFS explores every state and runs out of queue (your BFS would crash popping an empty queue)', true, 'The goal test needs an empty tuple, and nothing ever empties it.'),
        O('BFS returns a plan after visiting one corner', false, 'It would need the tuple to shrink for that.'),
        O('BFS returns the same plan as before', false, 'The goal can never be reached.'),
        O('The plan is longer than needed', false, 'There is no plan at all.')],
      hints: ['Think about line ' + lineOf('goal_ret') + ' and what the tuple would look like at every state.'], explain: 'Line ' + lineOf('succ_nextun') + ' is the only place where the tuple shrinks, so it is the only way a goal state is ever reached.' }) },

  { id: 'k-bug-late', title: 'The corner is removed one step late', parts: ['corner'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); return { gr, good: cBFS(gr), late: cBFS(gr, { lateRemove: true }) }; }, (x) => x.late.found, 20), gr = pick.gr, pos = gr.start;
      return { type: 'mc', demoTitle: 'Same maze, both versions',
        prompt: 'A classmate computes the new tuple with the <b>old</b> position (shown) instead of the new one. <b>What happens?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { succ_nextun: 'next_unvisited = tuple(c for c in unvisited if c != position)' } }); },
        options: [O('The plan is still legal but one step longer: a corner is ticked off only when Pacman leaves it', true, 'The last corner must be stepped on and then left before the tuple empties.'),
          O('The plan is exactly the same', false, 'The goal now comes one step later.'),
          O('The plan is shorter by one step', false, 'The delayed removal never helps.'),
          O('BFS finds no plan', false, 'It still finds one, one step longer.')],
        hints: ['When does ' + C('position') + ' equal a corner: when Pacman arrives, or when he leaves?'],
        demo: (el) => demoPair(el, [{ title: 'Your code', gr: withStart(gr, pos), opts: { path: pick.good.path }, ok: true, text: stepsWord(pick.good.cost) }, { title: 'Removed one step late', gr: withStart(gr, pos), opts: { path: pick.late.path }, ok: false, text: stepsWord(pick.late.cost) + ' (' + (pick.late.cost - pick.good.cost) + ' more)' }]),
        explain: 'Using ' + C('next_position') + ' (line ' + lineOf('succ_nextun') + ') removes a corner at the moment Pacman arrives.' }; } }
];

return {
  algo: 'corners', func: 'CornersProblem', title: 'Corners Problem Evaluation', subtitle: 'A teacher\'s check: do you really know why your CornersProblem works?',
  welcomeTitle: 'Let\'s see what you really know about the Corners problem',
  intro: '<p class="prompt">Passing the autograder shows the three methods return the right things. It does not show that you understand why the state holds what it holds, or what the search does with it. I will test the idea (what a state must remember), every line of your three methods, the size of the state space and what BFS does with it, using <b>your own code</b> and your own maze rules.</p>',
  handsOn: '<li>You do things by hand: click legal moves on a maze, trace a walk, say which corners are left, count states, find the best tour, and spot what a wrong copy of your code does.</li>',
  mapTitle: 'Map of the Corners problem', mapNote: 'Every box is a part of the problem: the idea, your three methods, the state space and the search. It fills in as you are tested on it. Click a box to see only its questions.',
  codeFile: 'search/searchAgents.py', selfCheck: cornersSelfCheck, engine: cornersEngine(), countVisitOrder, tourPlan, walkPath,
  minPerPart: 2, groups, parts, questions: QUICK ? questions.filter((q) => CORE.indexOf(q.id) >= 0) : questions
};
