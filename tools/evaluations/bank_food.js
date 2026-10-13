// Q7: foodHeuristic. The food engine (food_engine.js) is placed in front of this file by build_eval.py.
// Every answer key comes from that engine, which build_eval.py checked against your real foodHeuristic and aStarSearch on trickySearch
// and 14 random mazes, and which audits other heuristics on the very maze a question shows.

// ---------------------------------------------------------------- helpers for this bank
const THRESHOLDS = [15000, 12000, 9000, 7000];                     // the autograder's expansion thresholds on trickySearch
const passed = (n) => THRESHOLDS.filter((t) => n <= t).length;
let trickyMemo = null;
function tricky() {                                                // A* on trickySearch with several heuristics, measured once
  if (trickyMemo) return trickyMemo;
  const gr = getMaze('trickySearch'), res = {};
  ['zero', 'count', 'near', 'max', 'maxmaze', 'pair', 'summaze', 'twice'].forEach((k) => { const r = fAStar(gr, FH[k].f); res[k] = { exp: r.expanded, cost: r.cost, calls: r.calls }; });
  return (trickyMemo = { gr, res });
}
const dotObjs = (list) => list.map((d) => ({ x: d[0], y: d[1], r: 0.2 }));
const walkAndMan = (gr, st) => dotsLeft(gr, st).map((d) => ({ d, walk: fromHere(gr, st, d), man: man([st.x, st.y], d) }));
const HDESC = {
  zero: 'the null heuristic: no information about the dots', count: 'counts the dots left, one step each', near: 'looks only at the nearest dot, ignoring walls',
  nearmaze: 'looks only at the nearest dot, by walking', max: 'looks only at the farthest dot, ignoring walls', maxmaze: 'looks only at the farthest dot, by walking around the walls',
  pair: 'takes the two dots that are farthest apart and adds the way to the nearer one', summaze: 'adds up the walking distance to every dot', twice: 'doubles the walking distance to the farthest dot'
};

// ---------------------------------------------------------------- the map
const parts = [
  { id: 'adm', group: 'rules', label: 'Admissible', review: 'Admissible means h(state) never exceeds the true cost of eating all the food from that state. To audit a heuristic, compare it with the real cost to go.' },
  { id: 'cons', group: 'rules', label: 'Consistent', review: 'Consistent means h(A) <= cost(A to B) + h(B) on every step. With unit steps h may fall by at most 1 per step. It implies admissible.' },
  { id: 'zero', group: 'rules', label: 'Zero at goals, positive elsewhere', review: 'No food left means nothing to pay for, so h must be 0. While food remains h should be positive: h = 0 is legal but gives A* no help.' },
  { id: 'relax', group: 'idea', label: 'Relaxed problem: reach the farthest dot', review: 'Your heuristic is the exact cost of an easier job: only reach the farthest dot. Every real plan has to do that too, so it costs at least as much.' },
  { id: 'maze', group: 'idea', label: 'Walking distance, not Manhattan', review: 'Walls make real walks longer than Manhattan distances. Walking distance (found by BFS) is closer to the truth and still never too high.' },
  { id: 'farthest', group: 'idea', label: 'Why the maximum, not the sum', review: 'One walk can serve several dots at once, so adding distances counts shared stretches several times and overestimates. The farthest single dot never does.' },
  { id: 'goal0', group: 'code', label: 'The "return 0" lines', review: 'No food left: return 0. (Without those lines the loop would not run and farthest would still be 0.)' },
  { id: 'bfs', group: 'code', label: 'walkingDistances (BFS)', review: 'A queue gives a breadth-first search: the first time a cell is reached is by a shortest walk. The distances dictionary doubles as the visited set.' },
  { id: 'cache', group: 'code', label: 'Storing distances in heuristicInfo', review: 'The heuristic runs for every generated state, but the walking distances depend only on the walls. Work them out once per dot and look them up afterwards.' },
  { id: 'state', group: 'problem', label: 'The food search state', review: 'A state is (Pacman position, food grid). The grid is the memory of what is left, so the goal test (no food) and the heuristic can use it.' },
  { id: 'size', group: 'problem', label: 'Size of the state space', review: 'Up to (open cells) x 2^(dots) states: each cell with each subset of the dots. That grows fast, which is why a good heuristic matters.' },
  { id: 'expand', group: 'astar', label: 'Fewer expansions', review: 'A better admissible and consistent heuristic means fewer expansions (apart from ties). trickySearch: 16688 with h = 0, 4137 with yours.' },
  { id: 'cand', group: 'astar', label: 'Judging other heuristics', review: 'Audit a candidate with two questions: does it ever exceed the true cost to go (admissible)? Does it ever fall by more than 1 in a step (consistent)?' },
  { id: 'trade', group: 'astar', label: 'Better estimate against cost per call', review: 'A closer estimate expands fewer states but may cost more per call. Caching the walking distances keeps your heuristic cheap.' }
];
const groups = [{ id: 'rules', label: 'The rules a heuristic must follow', arrow: true }, { id: 'idea', label: 'Where your idea comes from', arrow: true }, { id: 'code', label: 'Your code, line by line', arrow: true }, { id: 'problem', label: 'The food problem', arrow: true }, { id: 'astar', label: 'Using it inside A*', arrow: false }];

// ---------------------------------------------------------------- how long the evaluation is
const QUICK = true;
const CORE = ['f-steps', 'f-state', 'f-size', 'f-null', 'f-calc-max', 'f-which-farthest', 'f-adm-why', 'f-cons-why', 'f-sum-bad', 'f-goal-line', 'f-bfs-code', 'f-cache', 'f-symmetric', 'f-bug-sum', 'f-bug-manh', 'f-rank', 'f-autograder', 'f-pair', 'f-cand-adm', 'f-rules'];

// ---------------------------------------------------------------- the questions
const questions = [
  { id: 'f-steps', title: 'Put the heuristic in order', parts: ['goal0', 'cache', 'farthest'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'These are the steps of <code>foodHeuristic</code>, shuffled. Click them in the order the function performs them.',
      items: [
        'Take the state apart: ' + C('position, foodGrid = state') + '.',
        'List the dots still on the board: ' + C('food = foodGrid.asList()') + '.',
        'If that list is empty, return 0 at once.',
        'Start with ' + C('farthest = 0') + '.',
        'For one dot: if its walking distances are not in ' + C('problem.heuristicInfo') + ' yet, run ' + C('walkingDistances(dot, problem.walls)') + ' and store the result.',
        'Look up how far Pacman is from that dot and keep the larger of that and ' + C('farthest') + '.',
        'After the last dot, return ' + C('farthest') + '.'],
      hints: ['A goal state leaves the function early, before any dot is looked at.', 'The distances for a dot must exist before they are looked up.'],
      explain: 'In your code: the early return is lines ' + lineOf('h_goal_if') + ' to ' + lineOf('h_goal_ret') + ', farthest starts on line ' + lineOf('h_init') + ', the distances are stored on lines ' + lineOf('h_cache_if') + ' and ' + lineOf('h_cache_set') + ', the maximum is kept on line ' + lineOf('h_max') + ' and the result is returned on line ' + lineOf('h_return') + '.' }) },

  { id: 'f-state', title: 'What is a food search state?', parts: ['state'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'In <code>FoodSearchProblem</code> the search state is a tuple. What does it hold?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_unpack'] }); },
      options: [O('Pacman\'s position and a Grid that says which cells still hold food: ' + C('(position, foodGrid)'), true, 'The grid is the memory of what is left to eat. Without it the search could not tell when it is finished.'),
        O('Only Pacman\'s position, like in Q1 to Q4', false, 'Then two situations with different food left would look identical.'),
        O('Pacman\'s position and the list of moves made so far', false, 'The path is kept next to the state by the search, not inside it.'),
        O('Pacman\'s position and the number of dots left', false, 'The count is not enough: which dots are left matters for what remains to be done.')],
      hints: ['What must the search remember so that it can recognise a goal?'], explain: 'Line ' + lineOf('h_unpack') + ' of your heuristic takes the state apart into exactly these two parts.' }) },

  { id: 'f-size', title: 'How big can the state space be?', parts: ['size', 'state'], level: 1,
    gen: (r) => { const gr = fRandMaze(r, { dots: r.int(3, 6) }), N = openCells(gr).length, d = gr.dots.length;
      return { type: 'numeric', answer: N * Math.pow(2, d), tol: 0,
        prompt: 'A state is a cell together with the set of dots still on the board. This maze has <b>' + N + '</b> open cells and <b>' + d + '</b> dots. <b>What is the largest number of different states there could be?</b>',
        visual: (el) => fBoard(el, gr, {}, ''),
        hints: ['How many subsets does a set of ' + d + ' dots have?'], explain: N + ' cells × 2^' + d + ' = ' + N + ' × ' + Math.pow(2, d) + ' = ' + (N * Math.pow(2, d)) + '. trickySearch has 60 cells and 13 dots: 60 × 8192 = 491,520 states, which is why a good heuristic matters.' }; } },

  { id: 'f-null', title: 'What if h were 0?', parts: ['expand', 'zero', 'size'], level: 1,
    gen: () => { const t = tricky().res; const pts = (n) => passed(n);
      return { type: 'mc', demoTitle: 'The autograder\'s expansion thresholds (15000, 12000, 9000, 7000)',
        prompt: 'Suppose <code>foodHeuristic</code> simply returned <b>0</b> for every state. <b>What would A* do on <code>trickySearch</code>?</b> (60 open cells and 13 dots: up to 491,520 states.)',
        options: [O('Still return an optimal plan, but expand far more states (' + t.zero.exp + ' instead of ' + t.maxmaze.exp + ' with yours), because it behaves like uniform cost search', true, 'h = 0 is admissible and consistent, so the plan is right; it just gives no guidance.'),
          O('Return a plan that is not optimal', false, 'h = 0 never overestimates, so A* stays optimal.'),
          O('Crash, because h must be positive for non-goal states', false, 'Zero is allowed; it only fails the autograder\'s non-triviality check.'),
          O('Expand fewer states, because there is less arithmetic', false, 'Arithmetic does not reduce expansions; information does.')],
        hints: ['With h = 0 the priority is just g.'],
        demo: (el) => { el.innerHTML = '<div class="res bad" style="font-size:.9rem">h = 0: <b>' + t.zero.exp + '</b> expansions, passes <b>' + pts(t.zero.exp) + '</b> of the 4 thresholds.</div><div class="res ok" style="font-size:.9rem">Your heuristic: <b>' + t.maxmaze.exp + '</b> expansions, passes <b>' + pts(t.maxmaze.exp) + '</b> of the 4 thresholds.</div>'; },
        explain: 'The plan costs ' + t.zero.cost + ' either way. Only the amount of searching changes.' }; } },

  { id: 'f-calc-max', title: 'Compute the heuristic by hand', parts: ['farthest', 'maze', 'relax'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: 3, walls: r.int(4, 7) }), st = fStart(gr), w = walkAndMan(gr, st), mw = Math.max.apply(null, w.map((x) => x.walk)), mm = Math.max.apply(null, w.map((x) => x.man)); return { gr, st, w, mw, mm }; }, (x) => x.mw !== x.mm && x.w.filter((v) => v.walk === x.mw).length === 1, 100), gr = pick.gr;
      return { type: 'numeric', answer: pick.mw, tol: 0, unit: 'steps',
        prompt: 'Pacman is at <b>' + ptS(pick.st.x, pick.st.y) + '</b> and the dots are at ' + pick.w.map((x) => ptS(x.d[0], x.d[1])).join(', ') + '. <b>What does <code>foodHeuristic</code> return for this state?</b> Count the real steps around the walls.',
        visual: (el) => { fBoard(el, gr, {}, 'The state'); el.insertAdjacentHTML('beforeend', codeHTML({ mark: ['h_max'] })); },
        hints: ['For every dot find the walking distance from Pacman. Keep the largest.', 'Manhattan distance is wrong where walls are in the way.'],
        explain: pick.w.map((x) => ptS(x.d[0], x.d[1]) + ': walk ' + x.walk + ' (Manhattan ' + x.man + ')').join('; ') + '. The largest walking distance is ' + pick.mw + '.' }; } },

  { id: 'f-which-farthest', title: 'Which dot does the heuristic use?', parts: ['farthest', 'maze'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: 4, walls: r.int(4, 7) }), st = fStart(gr), w = walkAndMan(gr, st), mw = Math.max.apply(null, w.map((x) => x.walk)), mm = Math.max.apply(null, w.map((x) => x.man)); return { gr, w, mw, mm }; },
        (x) => x.w.filter((v) => v.walk === x.mw).length === 1 && x.w.filter((v) => v.man === x.mm).length === 1 && x.w.find((v) => v.walk === x.mw).man !== x.mm, 150), gr = pick.gr, far = pick.w.find((v) => v.walk === pick.mw);
      return { type: 'cells', pick: 'nodes', max: 1, grid: gr, cs: 24, label: 'Maze', answer: [cid(far.d[0], far.d[1])],
        drawOpts: () => ({ hidePellet: true, pac: gr.start, dots: dotObjs(gr.dots) }),
        prompt: 'Your heuristic keeps the <b>largest</b> value of ' + C('problem.heuristicInfo[dot][position]') + ' over all dots. <b>Click the dot whose walking distance decides the value at this state.</b> (The farthest dot by walking, which is not always the farthest on the map.)',
        hints: ['Measure each dot by walking around the walls, not in a straight line.'],
        explain: pick.w.map((x) => ptS(x.d[0], x.d[1]) + ': walk ' + x.walk + ', Manhattan ' + x.man).join('; ') + '. The deciding dot is ' + ptS(far.d[0], far.d[1]) + '.' }; } },

  { id: 'f-adm-why', title: 'Why it never overestimates', parts: ['relax', 'adm'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Why is the walking distance to the <b>farthest dot</b> never more than the real cost of eating all the food?',
      options: [O('Any real plan has to walk to that dot as well, so it costs at least that much; the heuristic is the exact cost of the easier job "reach only that dot"', true, 'An easier version of a problem can only cost less or the same: this is the relaxation argument.'),
        O('Because BFS always returns the cheapest plan to eat everything', false, 'The BFS only measures one walk between two cells.'),
        O('Because distances in a maze are always whole numbers', false, 'That has nothing to do with it.'),
        O('Because the farthest dot is eaten first in an optimal plan', false, 'Often it is eaten last. The argument does not need an order.')],
      hints: ['What does every plan that eats all the dots have to do, including this one dot?'], explain: 'This is how you design a heuristic: drop part of the job, solve what is left exactly, and the answer is a lower bound.' }) },

  { id: 'f-cons-why', title: 'Why it is consistent', parts: ['cons'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'Why can the heuristic fall by <b>at most 1</b> in one step, even when the step eats a dot?',
      options: [O('One step changes the walking distance to any fixed dot by at most 1. If the farthest dot is the one eaten, Pacman was one step from it, so the estimate was only 1', true, 'Either the same dot still decides the value (it changed by at most 1) or it was eaten while Pacman was next to it.'),
        O('Because it is admissible, and admissible heuristics are always consistent', false, 'Admissible does not imply consistent.'),
        O('Because the distances are cached in heuristicInfo and never change', false, 'Caching explains speed, not consistency.'),
        O('Because eating a dot cannot change which dot is the farthest', false, 'It can: when the farthest dot is eaten, another dot takes over.')],
      hints: ['Two cases: the deciding dot is still there after the step, or it was just eaten.'], explain: 'Consistency is what makes the visited set in your A* safe: the first time a state is expanded its cost is already the cheapest.' }) },

  { id: 'f-sum-bad', title: 'Adding the distances up', parts: ['farthest', 'adm', 'cand'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: r.int(4, 5) }), st = fStart(gr); return { gr, st, sum: FH.summaze.f(st, gr), t: trueCost(gr, st) }; }, (x) => x.sum - x.t >= 3, 100), gr = pick.gr, real = fAStar(gr, FH.pair.f);
      return { type: 'mc', demoTitle: 'The real plan',
        prompt: 'A classmate returns the <b>sum</b> of the walking distances to every dot. For the state on the board that is <b>' + pick.sum + '</b>, while the cheapest real plan eats all the food in only <b>' + pick.t + '</b> steps. <b>What does this show?</b>',
        visual: (el) => fBoard(el, gr, {}, 'The state'),
        options: [O('The heuristic is not admissible: it overestimates because one walk can serve several dots, but the sum pays for the shared stretch several times', true, 'Dots in the same direction are reached on the way to each other.'),
          O('It is fine: a heuristic may be larger than the real cost', false, 'That is exactly what admissible forbids.'),
          O('It is admissible: every single distance is', false, 'Each term is a lower bound, but their sum is not.'),
          O('The real plan is unlucky; a better plan costs ' + pick.sum, false, 'The real plan is the cheapest possible.')],
        hints: ['Can one walk reach two dots that lie in the same direction?'],
        demo: (el) => demoPair(el, [{ title: 'The cheapest real plan', gr, opts: { path: real.path }, ok: true, text: stepsWord(pick.t) }, { title: 'The sum of distances', gr, opts: {}, ok: false, text: 'claims <b>' + pick.sum + '</b>: ' + (pick.sum - pick.t) + ' too many' }]),
        explain: 'sum = ' + pick.sum + ' > real cost ' + pick.t + '. A* with this heuristic can return a plan that is not optimal.' }; } },

  { id: 'f-goal-line', title: 'Why return 0 at a goal?', parts: ['zero', 'goal0'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Lines ' + lineOf('h_goal_if') + ' and ' + lineOf('h_goal_ret') + ' return 0 when no food is left. <b>What does that make sure?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_goal_if', 'h_goal_ret'] }); },
      options: [O('That h is 0 at every goal state (nothing is left to eat, so a positive estimate would overestimate). While food remains, the farthest dot is at least 1 step away, so h is positive there', true, 'The autograder checks both: h(goal) = 0 and h > 0 elsewhere.'),
        O('That h is consistent', false, 'Consistency comes from the way the distance is measured.'),
        O('That the function is faster for every state', false, 'It only shortcuts goal states.'),
        O('That A* stops at this state', false, 'A* stops because ' + C('isGoalState') + ' is True.')],
      hints: ['What is the true cost of eating the food when no food is left?'], explain: 'Without any dot left the loop would not run at all, and farthest would still be 0. The early return just makes the rule visible.' }) },

  { id: 'f-bfs-code', title: 'Read walkingDistances', parts: ['bfs', 'maze'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: 'Study your helper <code>walkingDistances</code>. <b>Tick every true statement.</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['w_queue', 'w_pop', 'w_if', 'w_set', 'w_return'] }); },
      options: [O('A queue (first in, first out) makes it a breadth-first search, so the first time a cell is reached is by a shortest walk', true, 'Cells are reached in order of distance.'),
        O('The dictionary ' + C('distances') + ' is also the visited set: a cell already in it is not queued again', true, 'That is the ' + C('neighbour not in distances') + ' part of line ' + lineOf('w_if') + '.'),
        O('Walls are skipped by the test ' + C('walls[neighbour[0]][neighbour[1]]'), true, 'A wall cell is never entered.'),
        O('It returns the distance to one dot only', false, 'It returns a dictionary with the distance from the source to EVERY reachable cell.'),
        O('The distances change as dots are eaten', false, 'They depend only on the walls.'),
        O('It measures Manhattan distance', false, 'It counts real steps around the walls.')],
      hints: ['Check every claim against the actual line.'], explain: 'One call gives the walking distance from a dot to the whole maze.' }) },

  { id: 'f-cache', title: 'Why store the distances?', parts: ['cache', 'trade'], level: 2,
    gen: () => { const t = tricky(), n = t.gr.dots.length;
      return { type: 'mc',
        prompt: 'On <code>trickySearch</code> your heuristic is called <b>' + t.res.maxmaze.calls + '</b> times during one A* run, but <code>walkingDistances</code> runs only <b>' + n + '</b> times (once per dot). <b>Why is that possible?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_cache_if', 'h_cache_set'] }); },
        options: [O('The walking distances from a dot depend only on the walls, which never change, so the result is kept in problem.heuristicInfo and later calls only look it up', true, 'The distances are the same in every state; only WHICH dots are left changes.'),
          O('Python caches every function call automatically', false, 'It does not; the dictionary is what stores the result.'),
          O('The first call works out the answer for every possible state', false, 'It only works out distances, not heuristic values.'),
          O('A* calls the heuristic only for dots, not for states', false, 'It calls it once per generated state.')],
        hints: ['What can change between two calls of the heuristic, and what cannot?'], explain: 'Without the cache every call would run a BFS for every dot left: far slower, same answers.' }; } },

  { id: 'f-symmetric', title: 'From the dot to Pacman', parts: ['bfs', 'cache'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'The BFS starts at the <b>dot</b>, but line ' + lineOf('h_max') + ' reads ' + C('problem.heuristicInfo[dot][position]') + ' as "how far is <b>Pacman</b> from the dot". <b>Why is that valid?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['w_pushsrc', 'h_max'] }); },
      options: [O('A walk can be walked backwards: every step can be undone, so the distance from the dot to Pacman equals the distance from Pacman to the dot', true, 'The maze is an undirected graph. One BFS per dot is enough for every Pacman position.'),
        O('Because ' + C('position') + ' is always the source of the BFS', false, 'The source is the dot.'),
        O('Because BFS always gives symmetric answers whatever the graph', false, 'It does here only because every move can be reversed.'),
        O('It is not valid; the heuristic is therefore inadmissible', false, 'It is valid.')],
      hints: ['If you can walk from A to B in 7 steps, how many steps does the way back take?'], explain: 'One BFS per dot (not per Pacman position) is what keeps the heuristic cheap.' }) },

  { id: 'f-bug-sum', title: 'The maximum becomes a sum', parts: ['farthest', 'adm'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: r.int(4, 5) }), st = fStart(gr); return { gr, st, sum: FH.summaze.f(st, gr), t: trueCost(gr, st) }; }, (x) => x.sum - x.t >= 3, 100);
      return { type: 'mc',
        prompt: 'A classmate changes line ' + lineOf('h_max') + ' to <code>farthest += ...</code> (shown), so every dot\'s distance is added. <b>What does the function become?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { h_max: 'farthest += problem.heuristicInfo[dot][position]' } }); },
        options: [O('The sum of the walking distances to all dots: it can exceed the real cost, so it is no longer admissible', true, 'At one example state it returns ' + pick.sum + ' although the real cost is only ' + pick.t + '.'),
          O('The same heuristic as before, written differently', false, 'A maximum and a sum differ as soon as there are two dots.'),
          O('A stronger heuristic that is still admissible', false, 'Stronger would be fine, but this one overshoots.'),
          O('A crash: you cannot add to farthest', false, 'It runs; it is just wrong.')],
        hints: ['One walk can serve several dots.'], explain: 'Line ' + lineOf('h_max') + ' with max() keeps the single farthest distance, which is a lower bound.' }; } },

  { id: 'f-bug-manh', title: 'Manhattan instead of walking', parts: ['maze', 'expand', 'trade'], level: 2,
    gen: () => { const t = tricky().res;
      return { type: 'mc',
        prompt: 'A classmate skips the BFS and uses the Manhattan distance <code>abs(position[0] - dot[0]) + abs(position[1] - dot[1])</code> on line ' + lineOf('h_max') + ' (shown). <b>What happens on <code>trickySearch</code>?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { h_max: 'farthest = max(farthest, abs(position[0] - dot[0]) + abs(position[1] - dot[1]))' } }); },
        options: [O('It is still admissible and consistent (a Manhattan distance never exceeds a walk) but weaker: A* expands ' + t.max.exp + ' states instead of ' + t.maxmaze.exp + ', passing ' + passed(t.max.exp) + ' of the 4 thresholds instead of all 4', true, 'Straight lines ignore the walls, so the estimate is lower and the search wider.'),
          O('It becomes inadmissible', false, 'A walk is never shorter than the Manhattan distance, so it stays a lower bound.'),
          O('It is faster and just as good', false, 'Each call is cheaper, but ' + t.max.exp + ' expansions are far more than ' + t.maxmaze.exp + '.'),
          O('A* returns a plan that is not optimal', false, 'The plan is optimal (cost ' + t.max.cost + '); only the work changes.')],
        hints: ['Is a straight-line distance ever longer than the real walk?'], explain: 'The BFS and the cache are what make the estimate close to the truth.' }; } },

  { id: 'f-rank', title: 'Rank the heuristics by work', parts: ['expand', 'cand'], level: 3,
    gen: () => { const t = tricky(), ks = ['zero', 'near', 'max', 'maxmaze', 'pair'], order = ks.map((k) => ({ k, n: t.res[k].exp })).sort((a, b) => a.n - b.n);
      return { type: 'order',
        prompt: 'A* runs on <code>trickySearch</code> with five admissible, consistent heuristics. <b>Click them from the one that expands the FEWEST states to the one that expands the MOST.</b> (The counts are on the next screen.)',
        items: order.map((x) => '<b>' + esc(FH[x.k].name) + '</b>: ' + HDESC[x.k]),
        hints: ['A heuristic that is larger at every state (and still admissible) expands no more states.', 'Walking distances are never shorter than Manhattan ones.'],
        explain: 'Measured expansions: ' + order.map((x) => FH[x.k].name + ': ' + x.n).join('; ') + '. Each heuristic in the list is at least as large as the next one at every state, so it knows at least as much.' }; } },

  { id: 'f-autograder', title: 'Which earn full marks?', parts: ['expand', 'cand', 'adm'], level: 2,
    gen: (r) => { const t = tricky().res, pool = ['zero', 'count', 'near', 'max', 'maxmaze', 'pair', 'summaze', 'twice'], legit = { zero: true, count: true, near: true, max: true, maxmaze: true, pair: true, summaze: false, twice: false };
      const chosen = r.shuffle(pool).slice(0, 5), earns = (k) => legit[k] && t[k].exp <= 7000;
      if (!chosen.some(earns)) chosen[0] = 'maxmaze';
      if (!chosen.some((k) => !earns(k))) chosen[1] = 'zero';
      return { type: 'multi',
        prompt: 'On <code>trickySearch</code> the autograder gives full marks when A* expands <b>at most 7000</b> states (thresholds 15000, 12000, 9000, 7000). Sanity tests only accept a heuristic that is non-trivial, admissible and consistent. <b>Tick every heuristic below that is a correct heuristic AND passes all four thresholds.</b>',
        options: chosen.map((k) => O('<b>' + esc(FH[k].name) + '</b>: ' + HDESC[k], earns(k), !legit[k] ? 'It expands only ' + t[k].exp + ' states, but it overestimates (not admissible), so it is not a correct heuristic.' : t[k].exp <= 7000 ? 'Correct, and ' + t[k].exp + ' expansions pass every threshold.' : 'Correct, but ' + t[k].exp + ' expansions pass only ' + passed(t[k].exp) + ' of the 4 thresholds.')),
        hints: ['Two conditions must both hold: a correct heuristic, and at most 7000 expansions.'],
        explain: 'Measured on trickySearch: ' + pool.map((k) => FH[k].name + ': ' + t[k].exp + (legit[k] ? '' : ' (not admissible)')).join('; ') + '. Yours expands ' + t.maxmaze.exp + '.' }; } },

  { id: 'f-pair', title: 'A stronger heuristic', parts: ['cand', 'trade', 'relax'], level: 3,
    gen: () => { const t = tricky().res;
      return { type: 'mc',
        prompt: 'Take the two dots that are <b>farthest apart</b> (by walking), a and b. Any plan must visit both, so it costs at least <b>(walk to the nearer of the two) + (walk between them)</b>. Using the largest such value over all pairs expands only <b>' + t.pair.exp + '</b> states on <code>trickySearch</code> against <b>' + t.maxmaze.exp + '</b> for yours. <b>What is the catch?</b>',
        options: [O('It is still admissible, but every call compares all pairs of dots (more work per call and more code); the saving in expansions is far larger than that cost on this maze', true, 'The relaxed job "visit these two dots" is harder than "reach one dot", so its cost is closer to the truth.'),
          O('It is not admissible: it adds two distances', false, 'It is a true lower bound: the plan really must walk from the nearer dot to the other.'),
          O('It expands more states, because the numbers are bigger', false, 'Bigger admissible values mean fewer expansions.'),
          O('There is no catch', false, 'Each call is more expensive and the code longer.')],
        hints: ['What must every plan do about both of these dots?'], explain: 'Yours is the simplest safe heuristic; this one trades extra work per call for far fewer expansions.' }; } },

  { id: 'f-cand-adm', title: 'Which candidates are admissible?', parts: ['cand', 'adm'], level: 2,
    gen: (r) => { const theory = { zero: true, count: true, near: true, max: true, maxmaze: true, pair: true, summaze: false, twice: false };
      const chosen = r.shuffle(Object.keys(theory)).slice(0, 5);
      if (!chosen.some((k) => theory[k])) chosen[0] = 'maxmaze';
      if (!chosen.some((k) => !theory[k])) chosen[1] = 'summaze';
      const pick = find(r, () => { const gr = fRandMaze(r, { W: r.int(7, 9), H: r.int(6, 7), dots: r.int(3, 4) }); return { gr, a: chosen.map((k) => fAudit(gr, FH[k].f)) }; }, (x) => chosen.every((k, i) => x.a[i].admissible === theory[k]), 40), gr = pick.gr;
      return { type: 'multi',
        prompt: 'Five classmates propose a heuristic for this maze. <b>Tick every one that is admissible</b> (never above the true cost to go, at any reachable state).',
        visual: (el) => fBoard(el, gr, {}, 'The maze'),
        options: chosen.map((k, i) => { const a = pick.a[i], ok = a.admissible; return O('<b>' + esc(FH[k].name) + '</b>: ' + HDESC[k], ok, ok ? 'Admissible: never above the true cost at any of the ' + a.states + ' reachable states.' : 'Overestimates at ' + a.notAdmissible + ' of ' + a.states + ' states, for example h = ' + a.over.h + ' where the real cost is ' + a.over.t + '.'); }),
        hints: ['Test each on a small example: can it ever be bigger than the real cost?'], explain: 'The answer keys come from checking every one of these heuristics at every reachable state of this maze.' }; } },

  { id: 'f-rules', title: 'Rules every heuristic must follow', parts: ['zero', 'adm', 'cons'], level: 1,
    gen: () => ({ type: 'multi',
      prompt: 'For A* with a visited set to be optimal, which of these must a heuristic satisfy? <b>Tick every one.</b>',
      options: [O('It is never negative', true, 'A negative estimate has no meaning.'), O('It is 0 at every goal state', true, 'Nothing is left to eat there.'),
        O('It never exceeds the true cost to go (admissible)', true, 'Otherwise A* may skip the optimal route.'), O('It never drops by more than the step cost in one step (consistent)', true, 'That is what makes the visited set safe.'),
        O('It is strictly positive everywhere', false, 'It must be 0 at goals.'), O('It always returns a whole number', false, 'Not required.'), O('It drops by exactly 1 on every step', false, 'Only "at most the step cost" is required.')],
      hints: ['Four of these are rules, three are not.'], explain: 'Your heuristic satisfies all four rules, and it is positive whenever food remains.' }) }
];

return {
  algo: 'food', func: 'foodHeuristic', title: 'Food Heuristic Evaluation', subtitle: 'A teacher\'s check: do you really know why your foodHeuristic works?',
  welcomeTitle: 'Let\'s see what you really know about the food heuristic',
  intro: '<p class="prompt">The autograder checks that your heuristic is admissible, consistent and expands few enough states on <code>trickySearch</code>. It does not check that you know <b>why</b>. I will test the rules a heuristic must follow, the idea of reaching only the farthest dot, every line of your code, the food search state, and how your heuristic compares with others, using <b>your own code</b> and an engine that audits heuristics on real mazes.</p>',
  handsOn: '<li>You do things by hand: compute the heuristic for a state, find the dot that decides it, count states, audit other heuristics, rank them by the work A* does and find what a wrong copy of your code returns.</li>',
  mapTitle: 'Map of the food heuristic', mapNote: 'Every box is a part of the heuristic: the rules, where the idea comes from, your code, the food problem and its use in A*. It fills in as you are tested on it. Click a box to see only its questions.',
  codeFile: 'search/searchAgents.py', selfCheck: foodSelfCheck, engine: foodEngine(), tricky,
  minPerPart: 2, groups, parts, questions: QUICK ? questions.filter((q) => CORE.indexOf(q.id) >= 0) : questions
};
