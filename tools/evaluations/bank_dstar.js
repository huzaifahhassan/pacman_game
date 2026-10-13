// Q9: D* Lite. The D* Lite engine (dstar_engine.js) is placed in front of this file by build_eval.py.
// Every answer key comes from that engine, which build_eval.py checked against YOUR real DStarLite on 16 mazes (Pacman's whole path,
// the vertices popped in every episode and their order, km, totals). The numbers about wrong copies of your code were measured by running
// a modified copy of your class on 120 random mazes.

// ---------------------------------------------------------------- helpers for this bank
const G = (name) => H.DATA.golden.find((g) => g.name === name);
const MUT = () => H.DATA.mutants;
const arrow = (a, b) => a + ' → ' + b;
const ordinal = (n) => n.toLocaleString('en-US');

// ---------------------------------------------------------------- the map
const parts = [
  { id: 'idea', group: 'idea', label: 'Repair instead of replan', review: 'After a wall appears, A* forgets everything and searches again. D* Lite keeps g and rhs from earlier and repairs only the vertices whose distance to the goal changed.' },
  { id: 'free', group: 'idea', label: 'Freespace assumption and the sensor', review: 'Pacman starts with no walls in his belief (unseen cells count as open). His sensor reveals the walls in a square window around him; each new wall changes some edge costs.' },
  { id: 'back', group: 'idea', label: 'Why it searches backward', review: 'The search runs from the goal, so g(s) means the distance from s to the goal. The goal never moves, so those numbers stay right when Pacman walks.' },
  { id: 'g', group: 'numbers', label: 'g: what a vertex remembers', review: 'g(s) is the distance to the goal that the vertex last wrote down. Missing entries mean infinity.' },
  { id: 'rhs', group: 'numbers', label: 'rhs: what its neighbours say now', review: 'rhs(s) = the smallest of (cost to a neighbour + that neighbour\'s g). The goal is special: its rhs is fixed at 0.' },
  { id: 'cons', group: 'numbers', label: 'Consistent, over and under', review: 'g = rhs is consistent. g > rhs is overconsistent (good news: a shorter way exists). g < rhs is underconsistent (bad news: the old route is gone).' },
  { id: 'key', group: 'queue', label: 'The key (k1, k2)', review: 'k1 = min(g, rhs) + h(s_start, s) + km and k2 = min(g, rhs). The most optimistic distance, plus a guess to Pacman, plus the km offset.' },
  { id: 'order', group: 'queue', label: 'Which vertex goes first', review: 'Keys are compared like words in a dictionary: smaller k1 first, and on equal k1 the smaller k2 (the vertex nearer the goal).' },
  { id: 'km', group: 'queue', label: 'km', review: 'km grows by h(s_last, s_start) every time Pacman has moved and then finds a change. It keeps the old keys in U valid lower bounds.' },
  { id: 'stop', group: 'queue', label: 'When the repair loop stops', review: 'The loop runs while the top key is smaller than Pacman\'s own key or Pacman\'s vertex is inconsistent. Everything else in U is not needed yet.' },
  { id: 'init', group: 'code', label: 'initialize()', review: 'Empty U, km = 0, every g and rhs infinite, rhs(goal) = 0, and the goal goes into U. It is inconsistent, so the search starts from it.' },
  { id: 'uv', group: 'code', label: 'updateVertex(u)', review: 'Recompute rhs (never for the goal), remove u from U, and put it back with a fresh key only if g and rhs disagree.' },
  { id: 'csp', group: 'code', label: 'computeShortestPath(): the branches', review: 'Pop the top vertex. Stale key: put it back with the fresh key. g > rhs: g := rhs and update the neighbours. Otherwise: g := infinity and update the vertex and its neighbours.' },
  { id: 'edges', group: 'code', label: 'updateEdgeCosts()', review: 'Add h(s_last, s_start) to km, remember the position, call updateVertex for each changed cell and its neighbours, then run the repair loop.' },
  { id: 'next', group: 'code', label: 'nextStep()', review: 'No search: step to the neighbour with the smallest cost + g (first one on a tie). None at the goal or when g of Pacman\'s vertex is infinity.' },
  { id: 'eff', group: 'check', label: 'Counting expansions', review: 'The autograder counts pops. D* Lite pops far fewer vertices than replanning A* because each repair touches only what the new wall changed.' }
];
const groups = [{ id: 'idea', label: 'The idea', arrow: true }, { id: 'numbers', label: 'The numbers', arrow: true }, { id: 'queue', label: 'The queue and its keys', arrow: true }, { id: 'code', label: 'Your methods', arrow: true }, { id: 'check', label: 'How well it works', arrow: false }];

// ---------------------------------------------------------------- the questions
const questions = [
  { id: 'l-steps', title: 'The main loop, in order', parts: ['idea', 'free', 'edges', 'csp', 'next'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'Pacman walks through a maze whose walls he cannot see. These are the things that happen in D* Lite, shuffled. Click them in the order they happen: the first plan, then one trip round the loop.',
      items: [
        'Plan once at the start: ' + C('initialize()') + ', then ' + C('computeShortestPath()') + ' (the freespace assumption: every unseen cell counts as open).',
        'Pacman steps to the neighbour with the smallest ' + C('cost + g') + ' (' + C('nextStep()') + ').',
        'His sensor reveals the walls around his new cell.',
        'If new walls were found: add to ' + C('km') + ' the Manhattan distance between where he stood at the last change and where he stands now, then remember this position.',
        'Call ' + C('updateVertex') + ' on every vertex whose rhs a new wall can change.',
        'Run ' + C('computeShortestPath()') + ' again, which repairs only what the changes broke.'],
      hints: ['The first plan is made before Pacman moves at all.', 'km and the remembered position are updated before the vertices are.'],
      explain: 'In your code: the step is the loop over neighbours in nextStep (line ' + lineOf('next_cost') + '), km is updated on line ' + lineOf('uec_km') + ', the vertices are updated on lines ' + lineOf('uec_upd_w') + ' and ' + lineOf('uec_upd_n') + ' and the repair loop runs on line ' + lineOf('uec_csp') + '. The sensor and the walking are done by the agent, not by your class.' }) },

  { id: 'l-why', title: 'Why not just run A* again?', parts: ['idea', 'eff'], level: 1,
    gen: () => { const b = G('bigMaze'), m = G('mediumMaze');
      return { type: 'mc',
        prompt: 'A replanning A* agent searches again from scratch whenever a new wall blocks its plan. <b>What does your D* Lite do instead?</b> Vertices taken off the queue over a whole walk, measured with your code:',
        visual: (el) => { el.innerHTML = '<div class="tablewrap"><table class="heap"><caption>Vertices expanded, whole walk</caption><thead><tr><th>maze</th><th>replanning A*</th><th>D* Lite</th></tr></thead><tbody><tr><td>mediumMaze</td><td>' + ordinal(m.astar.total) + '</td><td>' + ordinal(m.total) + '</td></tr><tr><td>bigMaze</td><td>' + ordinal(b.astar.total) + '</td><td>' + ordinal(b.total) + '</td></tr></tbody></table></div>'; },
        options: [O('It keeps the g and rhs values from earlier plans and repairs only the vertices whose distance to the goal changed', true, 'Most of the old distances are still right after one new wall, so there is no need to compute them again.'),
          O('It also searches from scratch, but with a better heuristic', false, 'The heuristic is the same Manhattan distance. The saving comes from reusing old work.'),
          O('It ignores walls that are not on Pacman\'s current path', false, 'It processes every change; most of them simply need no repair.'),
          O('It stops looking at walls after the first plan', false, 'Every newly discovered wall triggers updateEdgeCosts.')],
        hints: ['What has A* thrown away after each replan that D* Lite keeps?'], explain: 'On bigMaze D* Lite takes ' + (b.astar.total / b.total).toFixed(1) + ' times fewer vertices off the queue than replanning A*.' }; } },

  { id: 'l-back', title: 'Why search from the goal?', parts: ['back', 'g'], level: 2,
    gen: (r) => { const sc = mkScene(r, { dens: 0.18 }), p = pathCells(sc), nx = p[1], W = sc.W, Hh = sc.H;
      const fwd0 = bfsDist(W, Hh, sc.walls, sc.robot), fwd1 = bfsDist(W, Hh, sc.walls, nx);
      let n = 0, changed = 0; for (let i = 0; i < W * Hh; i++) if (!sc.walls[i] && fwd0[i] >= 0) { n++; if (fwd0[i] !== fwd1[i]) changed++; }
      return { type: 'mc', demoTitle: 'One step later',
        prompt: 'Pacman is the yellow shape and the dot is the goal. LPA* searches <b>forward</b> from the start. D* Lite searches <b>backward</b> from the goal, so g(s) means the distance from s <b>to the goal</b>. <b>Why does that suit a robot that is walking?</b>',
        visual: (el) => lBoard(el, sc, { showRhs: false, queue: false, tint: false }, 'g = distance to the goal, for every cell'),
        options: [O('The goal does not move, so a distance to the goal stays right when Pacman steps. A distance from Pacman would be wrong for almost every vertex after one step', true, 'D* Lite keeps its numbers between steps because they do not depend on where Pacman is.'),
          O('Searching from the goal is faster in every maze', false, 'The direction does not change the size of the search by itself.'),
          O('A search that starts at Pacman cannot see walls', false, 'Both directions use the same belief.'),
          O('The heuristic only works when it points from the goal', false, 'The heuristic h(s_start, s) is symmetric.')],
        hints: ['After Pacman takes one step, which one of the two kinds of distance changes for almost every cell?'],
        demo: (el) => { el.innerHTML = '<div class="res ok" style="font-size:.92rem">After one step, distances measured <b>from Pacman</b> change for <b>' + changed + ' of ' + n + '</b> cells. Distances measured <b>to the goal</b> change for <b>0 of ' + n + '</b>.</div>'; },
        explain: 'Parity alone makes every forward distance change by 1 after a step. The backward numbers are untouched until a wall actually changes something.' }; } },

  { id: 'l-free', title: 'What does the sensor reveal?', parts: ['free'], level: 2,
    gen: (r) => { const pick = find(r, () => { const sc = mkScene(r, { W: 9, H: 7, dens: 0.32, robotCols: 5, goalCols: 1, minDist: 3 }); if (!sc) return null; const rad = r.int(1, 2), x0 = sc.robot % sc.W, y0 = (sc.robot / sc.W) | 0, ans = [], near = [];
          for (let dx = -rad - 1; dx <= rad + 1; dx++) for (let dy = -rad - 1; dy <= rad + 1; dy++) { const nx = x0 + dx, ny = y0 + dy; if (nx < 0 || ny < 0 || nx >= sc.W || ny >= sc.H || (dx === 0 && dy === 0)) continue; if (!sc.walls[ny * sc.W + nx]) continue; if (Math.abs(dx) <= rad && Math.abs(dy) <= rad) ans.push({ i: ny * sc.W + nx, diag: dx !== 0 && dy !== 0 }); else near.push(ny * sc.W + nx); }
          return { sc, rad, ans, near }; }, (x) => x.ans.length >= 2 && x.ans.some((a) => a.diag) && x.near.length >= 1, 300), sc = pick.sc;
      return { type: 'cells', pick: 'nodes', allowWalls: true, grid: sceneGr(sc), cs: 40, label: 'Maze', answer: pick.ans.map((a) => cid(a.i % sc.W, (a.i / sc.W) | 0)),
        drawOpts: () => sceneDraw(sc, { showG: false, showRhs: false, queue: false, tint: false, cs: 40, pacR: 0.3, hidePellet: true }),
        prompt: 'Pacman has just arrived at the yellow shape. His sensor radius is <b>' + pick.rad + '</b>: it reveals the true contents of every cell in the <b>square window</b> that reaches ' + pick.rad + ' cells from him in both directions (diagonals included). <b>Click every wall he discovers with this look.</b>',
        hints: ['A radius of 1 gives a 3 × 3 window, a radius of 2 gives 5 × 5.', 'The corner cells of the window count too.'],
        audit: () => { const [x0, y0] = xy(sc.W, sc.robot), out = []; for (let i = 0; i < sc.W * sc.H; i++) { const [x, y] = xy(sc.W, i); if (sc.walls[i] && Math.max(Math.abs(x - x0), Math.abs(y - y0)) <= pick.rad && i !== sc.robot) out.push(cid(x, y)); } return out; },
        explain: 'He discovers ' + pick.ans.length + ' wall' + (pick.ans.length === 1 ? '' : 's') + '. Walls just outside the window stay unknown, and he plans as if those cells were open (the freespace assumption).' }; } },

  { id: 'l-g-rhs', title: 'g against rhs', parts: ['g', 'rhs', 'back'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Which sentence describes <b>g</b> and <b>rhs</b> of a vertex in D* Lite correctly?',
      visual: (el) => { el.innerHTML = codeOf(['updateVertex'], { mark: ['uv_min', 'uv_rhs'] }); },
      options: [O('g is the distance to the goal that the vertex last wrote down. rhs is one step plus the smallest g among its neighbours, worked out now', true, 'g is a memory. rhs is a fresh look at what the neighbours currently say.'),
        O('g is the cost from Pacman to the vertex and rhs is the heuristic', false, 'The search runs from the goal, and rhs is not a heuristic.'),
        O('g is the cost so far and rhs is the guess of what is left, as in A*', false, 'That describes g and h in A*. rhs is a second opinion about g.'),
        O('g and rhs are two names for the same number', false, 'They agree only when the vertex is consistent.')],
      hints: ['Look at lines ' + lineOf('uv_min') + ' and ' + lineOf('uv_rhs') + ': what is added up and what is stored?'], explain: 'When a wall changes the maze, rhs changes at once for the vertices next to it, while g keeps the old value until the vertex is repaired. The gap between them is how D* Lite finds out what to fix.' }) },

  { id: 'l-bad-good', title: 'Bad news or good news?', parts: ['cons', 'edges'], level: 2,
    gen: (r) => { const appear = r() < 0.5;
      const pick = find(r, () => { const sc = mkScene(r, { dens: appear ? 0.15 : 0.27 }); if (!sc) return null; let cell = -1;
          if (appear) { const p = pathCells(sc).slice(1, -1); if (p.length) cell = r.pick(p); } else { const ws = []; for (let i = 0; i < sc.W * sc.H; i++) if (sc.walls[i] && sc.bel.nbrs(i).filter((n) => !sc.walls[n]).length >= 2) ws.push(i); if (ws.length) cell = r.pick(ws); }
          return { sc, cell }; }, (x) => x.cell >= 0, 200), before = pick.sc, after = cloneScene(before); toggleWall(after, [pick.cell]);
      const bad = inconsistent(after), kinds = { over: 0, under: 0 }; bad.forEach((i) => { kinds[statusOf(after.lite, i)]++; });
      const [cx, cy] = xy(before.W, pick.cell), word = appear ? 'underconsistent' : 'overconsistent';
      return { type: 'mc', demoTitle: 'Right after the change, before any repair',
        prompt: appear ? 'The cell outlined in white lies on Pacman\'s best route and has just been discovered to be a <b>wall</b>. <b>What kind of disagreement between g and rhs appears?</b>' : 'The wall outlined in white has just turned out to be <b>open</b> (a door opens). <b>What kind of disagreement between g and rhs appears?</b>',
        visual: (el) => lBoard(el, before, { marks: { [cid(cx, cy)]: 'sel' }, queue: false }, LEGEND),
        options: [O(appear ? 'Only underconsistent vertices (g &lt; rhs): the old distances are too optimistic' : 'Only overconsistent vertices (g &gt; rhs): a shorter way now exists', true, appear ? 'Their rhs rises while g still holds the old, smaller number. Bad news.' : 'Their rhs drops below the g they remember. Good news.'),
          O(appear ? 'Only overconsistent vertices (g &gt; rhs)' : 'Only underconsistent vertices (g &lt; rhs)', false, appear ? 'A wall can only make routes longer, so rhs can only go up.' : 'Opening a cell can only make routes shorter, so rhs can only go down.'),
          O('Both kinds, depending on the vertex', false, 'One change in one direction produces one kind of news.'),
          O('None: g and rhs stay equal until Pacman moves', false, 'updateVertex recomputes rhs straight away, so they disagree at once.')],
        hints: ['Does the change make routes longer or shorter?'],
        demo: (el) => lBoard(el, after, { marks: { [cid(cx, cy)]: 'sel' } }, 'Now ' + bad.length + (bad.length === 1 ? ' vertex disagrees: ' : ' vertices disagree: ') + kinds.under + ' underconsistent (red), ' + kinds.over + ' overconsistent (green).'),
        audit: () => (kinds.over && kinds.under ? 'both' : kinds.over ? 'over' : kinds.under ? 'under' : 'none'),
        explain: 'Only ' + word + ' vertices appear here. In updateVertex the rhs is recomputed from the neighbours, which immediately differs from the old g.' }; } },

  { id: 'l-key-calc', title: 'Work out k1', parts: ['key'], level: 1,
    gen: (r) => { const over = r() < 0.5, base = r.int(2, 11), other = r() < 0.2 ? INF : base + r.int(1, 5), g = over ? other : base, rhs = over ? base : other, h = r.int(1, 9), km = r.int(0, 4), m = Math.min(g, rhs);
      return { type: 'numeric', answer: m + h + km, tol: 0,
        prompt: 'A vertex in U has <b>g = ' + fm(g) + '</b> and <b>rhs = ' + fm(rhs) + '</b>. Pacman is <b>h = ' + h + '</b> steps (Manhattan) away from it, and <b>km = ' + km + '</b>. <b>What is k1 of its key?</b>',
        visual: (el) => { el.innerHTML = codeOf(['calculateKey'], { mark: ['key_smaller', 'key_ret'] }); },
        hints: ['First take the smaller of g and rhs.', 'k1 adds h and km to that.'],
        explain: 'min(' + fm(g) + ', ' + fm(rhs) + ') = ' + m + ', so k1 = ' + m + ' + ' + h + ' + ' + km + ' = ' + (m + h + km) + ' and k2 = ' + m + '. The key is ' + keyStr([m + h + km, m]) + '.' }; } },

  { id: 'l-key-order', title: 'Order the vertices by key', parts: ['order', 'key'], level: 2,
    gen: (r) => { const pick = find(r, () => { const km = r.int(0, 3), vs = ['A', 'B', 'C', 'D'].map((n) => { const over = r() < 0.5, base = r.int(2, 9), other = base + r.int(1, 4), g = over ? other : base, rhs = over ? base : other, h = r.int(0, 8); return { n, g, rhs, h, k: [Math.min(g, rhs) + h + km, Math.min(g, rhs)] }; }); return { km, vs }; },
        (x) => { const s = x.vs.slice().sort((a, b) => cmpKey(a.k, b.k)); return s.every((v, i) => i === 0 || cmpKey(s[i - 1].k, v.k) !== 0) && s.some((v, i) => i && s[i - 1].k[0] === v.k[0]); }, 400), sorted = pick.vs.slice().sort((a, b) => cmpKey(a.k, b.k));
      return { type: 'order',
        prompt: 'Four vertices are waiting in U, and <b>km = ' + pick.km + '</b>. Here are their numbers (h is the Manhattan distance to Pacman). <b>Click them in the order they will be popped, first one first.</b> Two of them tie on k1.',
        items: sorted.map((v) => '<b>Vertex ' + v.n + '</b>: g = ' + fm(v.g) + ', rhs = ' + fm(v.rhs) + ', h = ' + v.h),
        hints: ['Work out [k1, k2] for each vertex.', 'Compare k1 first. Only on a tie does k2 decide.'],
        explain: 'Keys: ' + pick.vs.map((v) => v.n + ' ' + keyStr(v.k)).join(', ') + '. Smallest first: ' + sorted.map((v) => v.n).join(', ') + '.' }; } },

  { id: 'l-first-pop', title: 'Which vertex is popped first?', parts: ['order', 'key'], level: 3,
    gen: (r) => { const pick = find(r, () => { const sc = mkScene(r, { dens: 0.2 }); if (!sc) return null; const p = pathCells(sc).slice(1, -1); if (!p.length) return null; const cell = r.pick(p), pre = cloneScene(sc); toggleWall(sc, [cell]); const U = sc.lite.U.sorted(); return { sc, cell, U, pre }; },
        (x) => x.U.length >= 3 && x.U.length <= 8 && cmpKey(x.U[0].k, x.U[1].k) !== 0, 300), sc = pick.sc, [cx, cy] = xy(sc.W, pick.cell), first = pick.U[0];
      return { type: 'cells', pick: 'nodes', max: 1, allowWalls: true, grid: sceneGr(sc), cs: 46, label: 'Maze', answer: [cid(xy(sc.W, first.s)[0], xy(sc.W, first.s)[1])],
        drawOpts: () => sceneDraw(sc, { cs: 46, tint: false, extraLabels: [{ x: cx, y: cy, text: 'new', at: 'bl', color: '#ffffff', size: 11 }] }),
        prompt: 'A wall was just found at the cell marked <b>new</b>. The vertices with an amber dot are in U. <b>km = 0</b> and h is the Manhattan distance to Pacman (the yellow shape). <b>Click the vertex that computeShortestPath pops first.</b> (Blue top left: g. Amber bottom right: rhs.)',
        hints: ['For each dotted vertex compute k1 = min(g, rhs) + h + km, and take the smallest.', 'On a tie in k1, the smaller min(g, rhs) wins.'],
        audit: () => { const t = cloneScene(pick.pre); toggleWall(t, [pick.cell]); t.lite.computeShortestPath(); const [x, y] = xy(t.W, t.lite.popped[0]); return [cid(x, y)]; },
        explain: 'Keys in U, smallest first: ' + pick.U.slice(0, 6).map((e) => ptS(...xy(sc.W, e.s)) + ' ' + keyStr(e.k)).join('; ') + '.' }; } },

  { id: 'l-km-calc', title: 'How far does km move?', parts: ['km', 'edges'], level: 2,
    gen: (r) => { const pick = find(r, () => { const sc = mkScene(r, { W: 9, H: 6, dens: 0.24, minDist: 3 }); if (!sc) return null; const open = []; for (let i = 0; i < sc.W * sc.H; i++) if (!sc.walls[i]) open.push(i); const a = r.pick(open), b = r.pick(open); return { sc, a, b, m: manh(sc.W, a, b), d: bfsDist(sc.W, sc.H, sc.walls, a)[b] }; }, (x) => x.m >= 3 && x.d >= x.m + 2, 400), sc = pick.sc, km0 = r.int(0, 5);
      sc.robot = pick.b;
      return { type: 'numeric', answer: km0 + pick.m, tol: 0,
        prompt: 'Pacman stood at the dashed circle when the last change was found, and he has walked to the yellow shape. Now he finds a new wall. Before <code>updateEdgeCosts</code> runs, <b>km = ' + km0 + '</b>. <b>What is km after the call?</b>',
        visual: (el) => { lBoard(el, sc, { showG: false, showRhs: false, queue: false, tint: false, last: pick.a, cs: 40 }, 'dashed circle: where Pacman was at the last change'); el.insertAdjacentHTML('beforeend', codeOf(['updateEdgeCosts'], { mark: ['uec_km', 'uec_last'] })); },
        hints: ['Look at line ' + lineOf('uec_km') + ': what is added to km?', 'h is the Manhattan distance between the two positions.'],
        audit: () => { const t = cloneScene(sc); t.lite.km = km0; t.lite.sLast = pick.a; t.lite.sStart = pick.b; t.lite.updateEdgeCosts([]); return t.lite.km; },
        explain: 'km grows by h(s_last, s_start) = |' + (pick.a % sc.W) + ' − ' + (pick.b % sc.W) + '| + |' + ((pick.a / sc.W) | 0) + ' − ' + ((pick.b / sc.W) | 0) + '| = ' + pick.m + ', so km = ' + km0 + ' + ' + pick.m + ' = ' + (km0 + pick.m) + '. It is the straight-line distance, not the number of steps walked (here the walls force at least ' + pick.d + ' steps).' }; } },

  { id: 'l-stale', title: 'An out-of-date key', parts: ['csp', 'km'], level: 2,
    gen: (r) => { const a = r.int(8, 14), b = r.int(3, 9), d = r.int(2, 6), g = b + r.int(1, 3);
      return { type: 'mc',
        prompt: 'A vertex u is popped. Its key in U was <b>' + keyStr([a, b]) + '</b>, but <code>calculateKey(u)</code> now gives <b>' + keyStr([a + d, b]) + '</b> (Pacman has moved since the key was made). Its g is ' + g + ' and its rhs is ' + b + '. <b>What does computeShortestPath do with u?</b>',
        visual: (el) => { el.innerHTML = codeOf(['computeShortestPath'], { mark: ['csp_kold', 'csp_knew', 'csp_if_stale', 'csp_reinsert'] }); },
        options: [O('It puts u back into U with the fresh key. Nothing else changes: g and rhs stay as they are and no neighbour is touched. The pop still counts', true, 'The stale test comes first. A key that is too small is only a lower bound, so the vertex is simply re-queued where it really belongs.'),
          O('It sets g := rhs and updates the neighbours, because g > rhs', false, 'That branch is only reached if the key is NOT stale.'),
          O('It sets g := ∞ and updates u and its neighbours', false, 'That is the underconsistent branch.'),
          O('It stops, because the key grew', false, 'The loop only stops when the top key is not smaller than Pacman\'s key and his vertex is consistent.')],
        hints: ['Which comparison does the first if of the loop make?'], explain: 'Line ' + lineOf('csp_if_stale') + ' compares k_old with k_new. Here k_old &lt; k_new, so line ' + lineOf('csp_reinsert') + ' re-queues u. This is the lazy fix that km makes possible.' }; } },

  { id: 'l-init', title: 'After initialize()', parts: ['init', 'rhs', 'cons'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: 'Your <code>initialize()</code> has just run. <b>Tick every statement that is true right after it.</b>',
      visual: (el) => { el.innerHTML = codeOf(['initialize'], { mark: ['init_goal', 'init_insert'] }); },
      options: [O('U holds exactly one vertex: the goal', true, 'Everything else is still unknown (g = rhs = ∞), so nothing else is inconsistent.'),
        O('rhs(goal) = 0 but g(goal) = ∞, so the goal is overconsistent', true, 'g > rhs: that is what makes it worth expanding.'),
        O('km is 0', true, 'Pacman has not walked yet.'),
        O('g(goal) = 0, so the goal is already consistent', false, 'Only rhs is set. g is set when the goal is popped.'),
        O('rhs of every vertex is 0', false, 'Every rhs except the goal\'s is infinity.'),
        O('U holds every vertex of the maze', false, 'Only inconsistent vertices wait in U.'),
        O('the search starts from Pacman\'s vertex', false, 'It starts from the goal and spreads backward.')],
      hints: ['Which numbers does initialize set, and which does it leave at infinity?'], explain: 'Line ' + lineOf('init_goal') + ' makes rhs(goal) = 0 and line ' + lineOf('init_insert') + ' queues the goal. The first computeShortestPath then spreads outward from it.' }) },

  { id: 'l-uv-code', title: 'Read updateVertex', parts: ['uv', 'rhs'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: 'Study your <code>updateVertex</code>. <b>Tick every true statement.</b>',
      visual: (el) => { el.innerHTML = codeOf(['updateVertex'], { mark: ['uv_if', 'uv_min', 'uv_remove', 'uv_ifg'] }); },
      options: [O('The goal\'s rhs is never recomputed: the guard on line ' + lineOf('uv_if') + ' skips it', true, 'The goal is the one vertex whose rhs is fixed at 0.'),
        O('A neighbour that is a wall contributes ∞ to the minimum', true, 'belief.cost(u, s) is infinity if either end is a known wall.'),
        O('u is removed from U first, so it can never be queued twice or keep an old key', true, 'Then it is put back only if g and rhs disagree.'),
        O('u is put back into U only when g and rhs differ', true, 'A consistent vertex has nothing left to do.'),
        O('updateVertex changes g(u)', false, 'It only changes rhs. g is changed by computeShortestPath.'),
        O('updateVertex pops vertices from U', false, 'Popping is done only in computeShortestPath, which is what the autograder counts.')],
      hints: ['Which of the two numbers does this method write?'], explain: 'updateVertex is the only place rhs is recomputed. It never touches g.' }) },

  { id: 'l-csp-branches', title: 'Which branch runs?', parts: ['csp', 'cons'], level: 2,
    gen: (r) => { const kind = r.pick(['stale', 'over', 'under']), a = r.int(8, 14), b = r.int(3, 9), d = r.int(1, 4);
      const g = kind === 'over' ? b + d : kind === 'under' ? b : b + d, rhs = kind === 'over' ? b : kind === 'under' ? (r() < 0.3 ? INF : b + d) : b, kNew = kind === 'stale' ? [a + d + 1, b] : [a, b];
      const names = { stale: 'The stale-key branch: put u back into U with the fresh key', over: 'The overconsistent branch: g := rhs, then update the neighbours', under: 'The underconsistent branch: g := ∞, then update u and its neighbours' };
      return { type: 'mc',
        prompt: 'A vertex u is popped. Its stored key was <b>' + keyStr([a, b]) + '</b> and <code>calculateKey(u)</code> now gives <b>' + keyStr(kNew) + '</b>. Its <b>g = ' + fm(g) + '</b> and <b>rhs = ' + fm(rhs) + '</b>. <b>Which branch of computeShortestPath runs for u?</b>',
        visual: (el) => { el.innerHTML = codeOf(['computeShortestPath'], { mark: ['csp_if_stale', 'csp_over', 'csp_else'] }); },
        options: ['stale', 'over', 'under'].map((k) => O(names[k], k === kind, k === kind ? (k === 'stale' ? 'k_old &lt; k_new, and that test comes first, whatever g and rhs say.' : k === 'over' ? 'The key is up to date and g &gt; rhs.' : 'The key is up to date and g &lt; rhs: bad news.') : 'Not this one.')),
        hints: ['The loop tests the stale key first, then g &gt; rhs, and the rest goes to the last branch.'],
        explain: 'Order of the tests in your loop: line ' + lineOf('csp_if_stale') + ' (stale key), line ' + lineOf('csp_over') + ' (g &gt; rhs), line ' + lineOf('csp_else') + ' (everything else, so g &lt; rhs).' }; } },

  { id: 'l-stop', title: 'Does the loop go on?', parts: ['stop', 'key'], level: 2,
    gen: (r) => { const kind = r.pick(['top', 'stop', 'incons']), R = r.int(5, 12), km = r.int(0, 3), key = [R + km, R];
      const top = kind === 'top' ? [R + km - r.int(1, 2), r.int(2, R)] : kind === 'stop' ? [R + km + r.int(0, 2), R + r.int(0, 2)] : [R + km + r.int(1, 2), R + r.int(0, 3)];
      const rg = kind === 'incons' ? R + 2 : R;
      return { type: 'mc',
        prompt: 'Pacman\'s vertex has <b>g = ' + R + '</b> and <b>rhs = ' + fm(rg) + '</b>, and km is ' + km + ', so his own key is <b>' + keyStr(key.map((v, i) => (i === 0 ? Math.min(R, rg) + km : Math.min(R, rg)))) + '</b>. The smallest key in U is <b>' + keyStr(top) + '</b>. <b>Does computeShortestPath pop another vertex?</b>',
        visual: (el) => { el.innerHTML = codeOf(['computeShortestPath'], { mark: ['csp_while'] }); },
        options: [O('Yes: the top key is smaller than Pacman\'s key', kind === 'top', kind === 'top' ? 'That vertex could still change his route.' : 'Compare them again: this top key is not smaller.'),
          O('Yes: Pacman\'s own vertex is inconsistent (g ≠ rhs)', kind === 'incons', kind === 'incons' ? 'The second half of the loop condition keeps it going until his own vertex agrees with its neighbours.' : 'His g and rhs are equal here.'),
          O('No: the loop ends', kind === 'stop', kind === 'stop' ? 'The top key is not smaller and his vertex is consistent: nothing in U can improve his route.' : 'One of the two conditions still holds.')],
        hints: ['The loop runs while the top key is smaller than his key, OR his vertex is inconsistent.'],
        explain: 'Line ' + lineOf('csp_while') + ' has two conditions joined by or. Whatever remains in U after the loop ends is simply not needed yet.' }; } },

  { id: 'l-which-update', title: 'Which vertices does a new wall touch?', parts: ['edges', 'rhs'], level: 2,
    gen: (r) => { const pick = find(r, () => { const sc = mkScene(r, { dens: 0.26 }); if (!sc) return null; const c = []; for (let i = 0; i < sc.W * sc.H; i++) if (!sc.walls[i] && i !== sc.robot && i !== sc.goal) { const open = sc.bel.nbrs(i).filter((n) => !sc.walls[n]); if (open.length >= 2) c.push({ i, open }); } return c.length ? { sc, w: r.pick(c), pre: cloneScene(sc) } : null; }, (x) => !!x, 100), sc = pick.sc, w = pick.w.i, ans = [w].concat(pick.w.open); sc.walls[w] = 1;
      const [wx, wy] = xy(sc.W, w), pre = pick.pre;
      return { type: 'cells', pick: 'nodes', allowWalls: true, grid: sceneGr(sc), cs: 46, label: 'Maze', answer: ans.map((i) => cid(xy(sc.W, i)[0], xy(sc.W, i)[1])),
        drawOpts: () => sceneDraw(sc, { showG: false, showRhs: false, queue: false, tint: false, cs: 46, extraLabels: [{ x: wx, y: wy, text: 'new', at: 'tl', color: '#ffffff', size: 11 }] }),
        prompt: 'The cell marked <b>new</b> has just been discovered to be a wall. <b>Click every vertex that <code>updateEdgeCosts</code> must call <code>updateVertex</code> on</b> because of it. (Leave out cells that were already walls.)',
        visual: (el) => { el.innerHTML = codeOf(['updateEdgeCosts'], { mark: ['uec_upd_w', 'uec_upd_n'] }); },
        hints: ['Moves into the wall and out of the wall now cost ∞. Who asks the wall a question, and who answers it?', 'A neighbour that is itself a wall already has rhs = ∞ and does not change.'],
        audit: () => { const d = bfsDist(pre.W, pre.H, pre.walls, pre.goal), out = []; for (let i = 0; i < pre.W * pre.H; i++) { if (i === pre.goal) continue; let best = INF; for (const n of pre.bel.nbrs(i)) if (!sc.walls[i] && !sc.walls[n] && d[n] >= 0) best = Math.min(best, 1 + d[n]); const old = pre.walls[i] ? INF : (d[i] < 0 ? INF : d[i]); if (best !== old) { const [x, y] = xy(sc.W, i); out.push(cid(x, y)); } } return out; },
        explain: 'The wall itself (its rhs becomes ∞) and its open neighbours (their best neighbour may have been the wall) are the vertices affected. In your code that is the pair of calls on lines ' + lineOf('uec_upd_w') + ' and ' + lineOf('uec_upd_n') + '.' }; } },

  { id: 'l-nextstep', title: 'Where does Pacman step?', parts: ['next'], level: 2,
    gen: (r) => { const pick = find(r, () => { const sc = mkScene(r, { dens: 0.2 }); if (!sc) return null; const L = sc.lite, fin = sc.bel.nbrs(sc.robot).filter((n) => !sc.walls[n] && L.g[n] !== INF); return { sc, fin, nx: L.nextStep(), vals: fin.map((n) => 1 + L.g[n]) }; },
        (x) => x.fin.length >= 2 && x.nx >= 0 && x.vals.filter((v) => v === Math.min.apply(null, x.vals)).length >= (r() < 0.5 ? 2 : 1), 300), sc = pick.sc, L = sc.lite, [rx, ry] = xy(sc.W, sc.robot);
      const lst = [['up', 0, 1], ['down', 0, -1], ['right', 1, 0], ['left', -1, 0]].map(([nm, dx, dy]) => { const x = rx + dx, y = ry + dy; if (x < 0 || y < 0 || x >= sc.W || y >= sc.H) return null; const i = y * sc.W + x; return nm + ' ' + (sc.walls[i] ? '∞ (wall)' : 1 + L.g[i]); }).filter(Boolean).join(', ');
      return { type: 'cells', pick: 'nodes', max: 1, grid: sceneGr(sc), cs: 46, label: 'Maze', answer: [cid(xy(sc.W, pick.nx)[0], xy(sc.W, pick.nx)[1])],
        drawOpts: () => sceneDraw(sc, { showRhs: false, queue: false, tint: false, cs: 46 }),
        prompt: 'Pacman stands on the yellow shape and every g (blue) is final. <code>nextStep()</code> returns the neighbour with the smallest <b>cost + g</b>. If two tie, the <b>first</b> in the order <b>up, down, right, left</b> wins. <b>Click the cell he moves to.</b>',
        visual: (el) => { el.innerHTML = codeOf(['nextStep'], { mark: ['next_cost', 'next_cmp'] }); },
        hints: ['A wall costs ∞. Add one step to the g of each open neighbour.', 'The test is a strict &lt;, so a later neighbour with an equal value does not replace the first.'],
        audit: () => { const d = bfsDist(sc.W, sc.H, sc.walls, sc.goal); let best = -1, bv = INF; for (const n of sc.bel.nbrs(sc.robot)) if (!sc.walls[n] && d[n] >= 0 && 1 + d[n] < bv) { best = n; bv = 1 + d[n]; } const [x, y] = xy(sc.W, best); return [cid(x, y)]; },
        explain: 'cost + g of the neighbours: ' + lst + '. The smallest, first in the order up, down, right, left, is at ' + ptS(...xy(sc.W, pick.nx)) + '.' }; } },

  { id: 'l-eff', title: 'What the pop counter says', parts: ['eff'], level: 2,
    gen: () => { const m = G('mediumMaze'), b = G('bigMaze');
      return { type: 'mc',
        prompt: 'The autograder counts every <code>pop()</code> of the queue. On <code>bigMaze</code> your D* Lite pops <b>' + ordinal(b.total) + '</b> vertices in total, while a replanning A* agent expands <b>' + ordinal(b.astar.total) + '</b>. (On mediumMaze: ' + ordinal(m.total) + ' against ' + ordinal(m.astar.total) + '.) <b>Why is the difference so big?</b>',
        options: [O('Each time a wall breaks A*\'s plan it searches the whole way again. D* Lite repairs only the vertices whose distance to the goal changed, and most of the maze is unaffected by one wall', true, 'The saving is paid for by keeping g and rhs between replans.'),
          O('D* Lite finds much shorter paths', false, 'Both reach the goal in about the same number of steps.'),
          O('A* is not admissible when walls are unknown', false, 'It stays admissible; it just repeats work.'),
          O('D* Lite ignores most walls', false, 'It reacts to every wall; most need little or no repair.')],
        hints: ['Count what A* does every time its plan is blocked.'], explain: 'Your D* Lite did ' + (b.episodes.length - 1) + ' replanning episodes on bigMaze, with ' + (b.total - b.episodes[0].pops) + ' pops after the first plan.' }; } },

  { id: 'l-bug-goal', title: 'Recomputing the goal\'s rhs', parts: ['uv', 'init'], level: 3,
    gen: () => { const m = MUT().goalRecompute;
      return { type: 'mc',
        prompt: 'A classmate removes the guard <code>if u != self.sGoal</code> from <code>updateVertex</code> (struck out), so rhs is recomputed for <b>every</b> vertex, the goal included. <b>What happens?</b>',
        visual: (el) => { el.innerHTML = codeOf(['updateVertex'], { remove: ['uv_if'] }); },
        options: [O('The goal\'s rhs is overwritten with "one step plus the best neighbour g" instead of staying 0, so the distances stop being measured from the goal and come out wrong', true, 'In a test of your code with this change, the autograder-style checks (g and rhs where Pacman stands, nextStep, reaching the goal) failed in ' + m.wrong + ' of ' + (m.ok + m.wrong) + ' random mazes.'),
          O('Nothing changes: the neighbours of the goal always give 0', false, 'Their g is at least 1 by the time they are set, so the goal\'s rhs would become 2 or more.'),
          O('It only makes the search a little slower', false, 'The distances themselves go wrong.'),
          O('It crashes with an exception', false, 'It runs; it just returns wrong numbers.')],
        hints: ['What is the one fixed fact the whole search is built on?'], explain: 'rhs(goal) = 0 is the anchor of every distance. updateVertex must never recompute it, which is what the guard on line ' + lineOf('uv_if') + ' does.' }; } },

  { id: 'l-bug-clause', title: 'Only half the stopping rule', parts: ['stop', 'csp'], level: 3,
    gen: () => { const m = MUT().noRhsClause;
      return { type: 'mc',
        prompt: 'A classmate shortens the loop condition to <code>while self.U.topKey() &lt; self.calculateKey(self.sStart):</code> and drops the part about Pacman\'s vertex being inconsistent. <b>What goes wrong?</b>',
        visual: (el) => { el.innerHTML = codeOf(['computeShortestPath'], { replace: { csp_while: 'while self.U.topKey() < self.calculateKey(self.sStart):' } }); },
        options: [O('The loop can stop while Pacman\'s own vertex still disagrees with its neighbours, so g(s_start) is left wrong', true, 'In a test of your code with this change, the autograder-style checks (g and rhs where Pacman stands, nextStep, reaching the goal) failed in ' + m.wrong + ' of ' + (m.ok + m.wrong) + ' random mazes.'),
          O('Nothing: an inconsistent start vertex always has a smaller key than everything in U', false, 'Keys can be larger than his own key while his vertex is still inconsistent.'),
          O('The loop never stops', false, 'It stops sooner, not later.'),
          O('It only does extra pops', false, 'It does fewer pops and gets the answer wrong.')],
        hints: ['When the top key is not smaller than his key, can his own vertex still be inconsistent?'], explain: 'Both halves of line ' + lineOf('csp_while') + ' are needed: a smaller top key, or an inconsistent start vertex.' }; } }
];

return {
  algo: 'dstar', func: 'DStarLite', title: 'D* Lite Evaluation', subtitle: 'A teacher\'s check: do you really know how your D* Lite works?',
  welcomeTitle: 'Let\'s see what you really know about D* Lite',
  intro: '<p class="prompt">The autograder checks that g and rhs of Pacman\'s vertex are right after every replan and counts pops. It does not check that you know <b>why</b> the numbers behave as they do. I will test the idea (repair instead of replan, searching backward), g, rhs and the three states of a vertex, the key and km, every method of your class, and what small mistakes do, using <b>your own code</b> and a model of the algorithm that was checked against your real planner on 16 mazes.</p>',
  handsOn: '<li>You do things by hand: click the walls the sensor reveals, work out keys on a board, say which vertex is popped first, find which vertices a new wall touches, follow nextStep and see what wrong copies of your code do.</li>',
  mapTitle: 'Map of D* Lite', mapNote: 'Every box is a part of the algorithm: the idea, the numbers, the queue and its keys, your methods and how well it works. It fills in as you are tested on it. Click a box to see only its questions.',
  codeFile: 'search/dStarLite.py', selfCheck: dstarSelfCheck, engine: dstarEngine(),
  minPerPart: 2, groups, parts, questions
};
