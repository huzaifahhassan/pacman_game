// Q6: cornersHeuristic. The corners engine (corners_engine.js) is placed in front of this file by build_eval.py.
// Every answer key comes from that engine, which build_eval.py checked against your real cornersHeuristic on 16 mazes
// and which measures other heuristics (admissible? consistent? how many A* expansions?) on the very maze a question shows.

// ---------------------------------------------------------------- helpers for this bank
const hOf = (gr, st) => HEUR.tour.f(st, gr);
const orderWords = (order) => order.map((i) => cornerWord(i)).join(', then ');
const cornerAt = (gr, i) => ptS(cornersOf(gr)[i][0], cornersOf(gr)[i][1]);
function randState(r, gr, k) {                          // Pacman on a plain cell, k corners still to visit
  const pos = r.pick(openList(gr).filter((p) => !isCorner(gr, p)));
  return { x: pos[0], y: pos[1], un: r.shuffle([0, 1, 2, 3]).slice(0, k).sort((a, b) => a - b) };
}
const legPts = (gr, pos, order) => { const cs = cornersOf(gr); let here = pos; const pts = [pos.slice()]; order.forEach((i) => { const b = cs[i]; pts.push([b[0], here[1]], b.slice()); here = b; }); return pts; };      // straight legs through the walls
const heatOf = (run) => { const counts = {}, heat = {}; run.order.forEach((s) => { const k = cid(s.x, s.y); counts[k] = (counts[k] || 0) + 1; }); Object.keys(counts).forEach((k) => { heat[k] = counts[k] / 16; }); return heat; };
const stateBoard = (el, gr, st, cap, extra) => cBoard(el, gr, Object.assign({ pos: [st.x, st.y], un: st.un }, extra || {}), cap);
function firstViolation(gr, hf) {                       // how often does hf overestimate, and the worst example
  const c = cCostToGo(gr); let ex = null, n = 0;
  c.reach.map.forEach((st, k) => { const h = hf(st, gr); if (c.ctg.has(k) && h > c.ctg.get(k)) { n++; if (!ex || h - c.ctg.get(k) > ex.h - ex.t) ex = { st, h, t: c.ctg.get(k) }; } });
  return { n, ex, total: c.reach.map.size };
}
function overshootState(r, gr, hf, minGap, minCorners) {   // a reachable state where hf is at least minGap above the true cost
  const c = cCostToGo(gr), list = [];
  c.reach.map.forEach((st, k) => { if (st.un.length >= (minCorners || 2)) { const h = hf(st, gr), t = c.ctg.get(k); if (h - t >= minGap) list.push({ st, h, t }); } });
  return list.length ? r.pick(list) : null;
}
const nameOf = (k) => HEUR[k].name;
const HDESC = {
  tour: 'tries every order of the unvisited corners, with Manhattan legs, and keeps the shortest', zero: 'the null heuristic: no information about the corners at all', count: 'counts the unvisited corners, one step each', near: 'looks only at the nearest unvisited corner and ignores the others',
  max: 'looks only at the farthest unvisited corner and ignores the others', sum: 'adds up the distance from Pacman to every unvisited corner', twice: 'doubles the best Manhattan tour', worst: 'keeps the longest ordering instead of the shortest',
  maxmaze: 'walks around the walls to the corner that is farthest by walking', tourmaze: 'like your tour, but every leg is the real walking distance around the walls'
};

// ---------------------------------------------------------------- how long the evaluation is
// QUICK keeps the 20 questions below, chosen so that every part of the map still gets at least two. Set it to false to get all 39.
const QUICK = true;
const CORE = ['h-steps', 'h-adm-vs-cons', 'h-leg-calc', 'h-best-order', 'h-goal-need', 'h-zero-prop', 'h-f-goal', 'h-relax-why', 'h-unused-lines', 'h-manh-click', 'h-gap-ok', 'h-cand-adm', 'h-cons-spot', 'h-fvalues', 'h-f-start', 'h-null', 'h-heat-pick', 'h-better-h', 'h-bug-min', 'h-autograder'];

// ---------------------------------------------------------------- the map
const parts = [
  { id: 'adm', group: 'rules', label: 'Admissible', review: 'Admissible means h(state) never exceeds the true cost of the cheapest plan from that state. To audit a heuristic, compare it with the real cost to go.' },
  { id: 'cons', group: 'rules', label: 'Consistent', review: 'Consistent means h(A) <= cost(A to B) + h(B) for every step A to B. With unit steps the value may fall by at most 1 per step. It implies admissible.' },
  { id: 'zero', group: 'rules', label: 'Zero at goals, never negative', review: 'A goal state needs no more steps, so h must be 0 there; and h can never be negative. h = 0 everywhere is legal but gives A* no help.' },
  { id: 'relax', group: 'idea', label: 'Relaxed problem: remove the walls', review: 'Your heuristic solves an easier version of the problem exactly: the same maze with every wall removed. Real plans are also plans there, so they cost at least as much.' },
  { id: 'manh', group: 'idea', label: 'Manhattan distance', review: 'Without walls the cheapest way between two cells is |x1 - x2| + |y1 - y2|. Walls can only make the real walk longer, never shorter.' },
  { id: 'tour', group: 'idea', label: 'Best order of the corners', review: 'The corners must all be visited, in some order. The cheapest order is the shortest tour; with at most four corners there are at most 24 orders to try.' },
  { id: 'goal0', group: 'code', label: 'The "return 0" lines', review: 'At a goal the tuple is empty and the function returns 0. (Without those lines the loop would also give 0, because the only ordering of nothing is the empty one.)' },
  { id: 'perm', group: 'code', label: 'Loop over every ordering', review: 'itertools.permutations(unvisited) yields every ordering: k corners give k! of them (1, 2, 6, 24).' },
  { id: 'leg', group: 'code', label: 'Add up one ordering, leg by leg', review: 'For one ordering: start at the position with tour = 0, add the Manhattan distance of each leg and move "here" to the corner just reached.' },
  { id: 'best', group: 'code', label: 'Keep the shortest ordering', review: 'best_tour keeps the smallest tour found so far (strictly smaller replaces it). Keeping the longest or the first would break admissibility.' },
  { id: 'cand', group: 'compare', label: 'Judging other heuristics', review: 'Audit a candidate with two questions: does it ever exceed the true cost to go (admissible)? Does it ever fall by more than 1 in a step (consistent)?' },
  { id: 'gap', group: 'compare', label: 'Where walls make it optimistic', review: 'The heuristic ignores walls, so around walls it underestimates. That is allowed (admissible) but costs extra search work.' },
  { id: 'trade', group: 'compare', label: 'Better estimate against cost per call', review: 'A closer-to-the-truth heuristic expands fewer states but costs more per call. Your tour is a good balance: cheap to compute and far better than 0.' },
  { id: 'fpath', group: 'astar', label: 'f = g + h along a path', review: 'A* sorts by f = g + h. For a consistent heuristic f never decreases along a path, starts at h(start) and equals the plan cost at the goal.' },
  { id: 'expand', group: 'astar', label: 'Fewer expansions', review: 'A better admissible and consistent heuristic means fewer expansions (apart from ties in f). With h = 0, A* expands like UCS (mediumCorners: 1966 against 741 with yours).' }
];
const groups = [{ id: 'rules', label: 'The rules a heuristic must follow', arrow: true }, { id: 'idea', label: 'Where your idea comes from', arrow: true }, { id: 'code', label: 'Your code, line by line', arrow: true }, { id: 'compare', label: 'Comparing heuristics', arrow: false }, { id: 'astar', label: 'Using it inside A*', arrow: false }];

// ---------------------------------------------------------------- the questions
const questions = [
  // ---------------------------------------------------------------- the shape of it
  { id: 'h-steps', title: 'Put the heuristic in order', parts: ['goal0', 'perm', 'leg', 'best', 'tour'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'These are the steps of <code>cornersHeuristic</code>, shuffled. Click them in the order the function performs them.',
      items: [
        'Take the state apart: ' + C('position, unvisited = state') + '.',
        'If no corner is left (' + C('len(unvisited) == 0') + '), return 0 at once.',
        'Start with ' + C('best_tour = None') + ': no tour has been found yet.',
        'Take the next ordering of the unvisited corners from ' + C('itertools.permutations(unvisited)') + '.',
        'For that ordering set ' + C('tour = 0') + ' and ' + C('here = position') + '.',
        'For each corner of the ordering add ' + C('manhattanDistance(here, corner)') + ' to ' + C('tour') + ' and move ' + C('here') + ' to that corner.',
        'If this tour is shorter than ' + C('best_tour') + ' (or none exists yet), remember it.',
        'After every ordering has been tried, return ' + C('best_tour') + '.'],
      hints: ['The function can leave early for a goal state, before any ordering is tried.', 'One ordering is completely added up before the next one starts.'],
      explain: 'In your code: the early return is lines ' + lineOf('h_goal_if') + ' to ' + lineOf('h_goal_ret') + ', the loop over orderings is line ' + lineOf('h_perm') + ', the legs are added on line ' + lineOf('h_add') + ', the best tour is kept on lines ' + lineOf('h_cmp') + ' and ' + lineOf('h_set') + ' and the answer is returned on line ' + lineOf('h_return') + '.' }) },

  { id: 'h-what', title: 'What does h estimate?', parts: ['adm', 'relax'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'A* calls <code>cornersHeuristic(state, problem)</code> for every state it generates. What is the number supposed to estimate?',
      options: [O('The number of steps still needed from this state to touch every corner that is still unvisited', true, 'The cost to go: what is left to pay. The cost already paid is g.'),
        O('The number of steps Pacman has already walked', false, 'That is g, which A* keeps itself.'),
        O('The number of corners still unvisited', false, 'That is one possible (weak) heuristic, but it counts corners, not steps.'),
        O('The number of states A* will still expand', false, 'It estimates a cost in steps, not an amount of work.')],
      hints: ['f = g + h. g is behind you; h is ahead of you.'], explain: 'h looks ahead: the cost of finishing the job from here.' }) },

  { id: 'h-adm-def', title: 'Admissible: the definition', parts: ['adm'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Which statement defines an <b>admissible</b> heuristic?',
      options: [O('h(state) is never larger than the true cost of the cheapest plan from that state to a goal', true, 'It may underestimate, never overestimate.'),
        O('h(state) is exactly the cost of the cheapest plan', false, 'That would be a perfect heuristic. Admissible only asks for a lower bound.'),
        O('h never increases from one state to the next', false, 'That is a different (and not required) property.'),
        O('h(state) is never negative', false, 'A heuristic must be non-negative, but that alone does not make it admissible.')],
      hints: ['Think "optimistic, never pessimistic".'], explain: 'Admissibility is what makes A* return an optimal plan when it searches without a visited set.' }) },

  { id: 'h-cons-def', title: 'Consistent: the definition', parts: ['cons'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Which statement defines a <b>consistent</b> heuristic? (A step from A to B costs c.)',
      options: [O('For every step from A to B: h(A) ≤ c + h(B)', true, 'The estimate may not drop by more than the cost of the step you just paid for.'),
        O('For every step from A to B: h(A) ≤ h(B)', false, 'That would forbid h from falling as you approach the goal.'),
        O('For every step from A to B: h(A) = c + h(B)', false, 'That is the perfect heuristic. Consistency only asks for ≤.'),
        O('h(goal) = 0 and h is never negative', false, 'Those are necessary rules but do not make a heuristic consistent.')],
      hints: ['In your Corners problem every step costs 1. How much may h fall in one step?'], explain: 'With unit steps, consistent means: h falls by at most 1 per step.' }) },

  { id: 'h-adm-vs-cons', title: 'Admissible and consistent', parts: ['adm', 'cons'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Which statement about the two properties is true (with h = 0 at goals)?',
      options: [O('A consistent heuristic is always admissible, but an admissible one can fail to be consistent', true, 'Consistency chains along any path down to the goal and so forces h ≤ true cost. The reverse can fail.'),
        O('An admissible heuristic is always consistent', false, 'Not so: an admissible heuristic can drop by more than the step cost.'),
        O('They are two names for the same property', false, 'They differ, and the difference matters for graph search.'),
        O('A heuristic can be consistent and still overestimate', false, 'Consistent plus h(goal)=0 forces admissible.')],
      hints: ['Add the consistency inequality along a whole optimal path.'], explain: 'Consistency is the stronger property. A* with a visited set (yours) needs it to be sure the first time a state is expanded is the cheapest.' }) },

  // ---------------------------------------------------------------- by hand
  { id: 'h-leg-calc', title: 'Add up one ordering', parts: ['leg', 'manh'], level: 1,
    gen: (r) => { const gr = mazeFor(r), st = randState(r, gr, 3), order = r.shuffle(st.un.slice()), cs = cornersOf(gr), total = tourCost(gr, [st.x, st.y], order, manDist);
      return { type: 'numeric', answer: total, tol: 0, unit: 'steps',
        prompt: 'Pacman is at <b>' + ptS(st.x, st.y) + '</b>. Three corners are still unvisited. Consider the ordering <b>' + order.map((i) => cornerWord(i) + ' ' + cornerAt(gr, i)).join(' → ') + '</b> (numbered on the board). <b>What does the inner loop of your heuristic compute for this one ordering?</b> (Manhattan distances, walls ignored.)',
        visual: (el) => { stateBoard(el, gr, st, 'Corners numbered in the order of this tour', { labels: order.map((i, k) => ({ x: cs[i][0], y: cs[i][1], text: String(k + 1) })) }); el.insertAdjacentHTML('beforeend', codeHTML({ mark: ['h_tour0', 'h_here', 'h_for', 'h_add', 'h_move'] })); },
        hints: ['First leg: from Pacman to corner 1. Then from corner 1 to corner 2, and so on.', 'Each leg is |x1 − x2| + |y1 − y2|.'],
        explain: 'Legs: ' + (function () { let here = [st.x, st.y], parts2 = []; order.forEach((i) => { parts2.push(man(here, cs[i])); here = cs[i]; }); return parts2.join(' + ') + ' = ' + total; })() + '.' }; } },

  { id: 'h-calc-best', title: 'Compute the heuristic by hand', parts: ['best', 'tour', 'perm'], level: 2,
    gen: (r) => { const gr = mazeFor(r), k = r.int(2, 3), st = randState(r, gr, k), all = tours(gr, [st.x, st.y], st.un, manDist), best = bestOf(all);
      return { type: 'numeric', answer: best.cost, tol: 0, unit: 'steps',
        prompt: 'Pacman is at <b>' + ptS(st.x, st.y) + '</b> and <b>' + k + '</b> corners are unvisited: ' + st.un.map((i) => cornerWord(i) + ' ' + cornerAt(gr, i)).join(', ') + '. <b>What does <code>cornersHeuristic</code> return for this state?</b>',
        visual: (el) => stateBoard(el, gr, st, 'The state'),
        hints: ['There are ' + all.length + ' orderings to try. Add up the Manhattan legs of each.', 'Keep the smallest total.'],
        explain: all.map((t) => orderWords(t.order) + ' = ' + t.cost).join('; ') + '. The smallest is ' + best.cost + '.' }; } },

  { id: 'h-best-order', title: 'Which ordering wins?', parts: ['best', 'perm', 'tour'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), st = randState(r, gr, 3); return { gr, st, all: tours(gr, [st.x, st.y], st.un, manDist) }; }, (x) => uniqueBest(x.all), 100), gr = pick.gr, st = pick.st, best = bestOf(pick.all);
      return { type: 'cells', pick: 'seq', max: 3, grid: gr, cs: 24, label: 'Maze', answer: idsOf(gr, best.order),
        drawOpts: () => ({ hidePellet: true, pac: [st.x, st.y], dots: dotsFor(gr, st.un) }),
        prompt: 'Pacman is at ' + ptS(st.x, st.y) + ' and the three <b>filled</b> corners are unvisited. Your function tries every ordering with Manhattan legs. <b>Click the three corners in the order of the ordering that <code>best_tour</code> ends up keeping.</b>',
        hints: ['Compute the total for each of the 6 orderings, or reason which corners belong next to each other.'],
        explain: pick.all.map((t) => orderWords(t.order) + ' = ' + t.cost).join('; ') + '. The best is ' + orderWords(best.order) + ' with ' + best.cost + '.' }; } },

  { id: 'h-perm-count', title: 'How many orderings?', parts: ['perm'], level: 1,
    gen: (r) => { const k = r.int(2, 4), gr = mazeFor(r), st = randState(r, gr, k), f = [1, 1, 2, 6, 24][k];
      return { type: 'numeric', answer: f, tol: 0,
        prompt: k + ' corners are unvisited (the filled dots). <b>How many orderings does <code>itertools.permutations(unvisited)</code> produce?</b>',
        visual: (el) => stateBoard(el, gr, st, ''),
        hints: ['Choose the first corner, then the second, and so on.'], explain: k + '! = ' + f + ' orderings. With the maximum of four corners that is 24, which is why trying all of them is cheap.' }; } },

  { id: 'h-ops-count', title: 'How much work is one call?', parts: ['leg', 'perm', 'trade'], level: 2,
    gen: (r) => { const k = r.int(2, 4), f = [1, 1, 2, 6, 24][k];
      return { type: 'numeric', answer: k * f, tol: 0,
        prompt: 'The state has <b>' + k + '</b> unvisited corners. <b>How many times is <code>util.manhattanDistance</code> called during one call of <code>cornersHeuristic</code>?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_perm', 'h_for', 'h_add'] }); },
        hints: ['Every ordering has one leg per corner.'], explain: k + '! orderings × ' + k + ' legs each = ' + f + ' × ' + k + ' = ' + (k * f) + '. At most 96 small additions per call.' }; } },

  { id: 'h-onecorner', title: 'Only one corner left', parts: ['perm', 'best', 'manh'], level: 1,
    gen: (r) => { const gr = mazeFor(r), st = randState(r, gr, 1), c = cornersOf(gr)[st.un[0]];
      return { type: 'numeric', answer: man([st.x, st.y], c), tol: 0, unit: 'steps',
        prompt: 'Only the ' + cornerWord(st.un[0]) + ' corner ' + ptS(c[0], c[1]) + ' is left and Pacman is at ' + ptS(st.x, st.y) + '. <b>What does your heuristic return?</b>',
        visual: (el) => stateBoard(el, gr, st, ''),
        hints: ['How many orderings does one corner have?'], explain: 'One corner has a single ordering, so the tour is just one leg: |' + st.x + ' − ' + c[0] + '| + |' + st.y + ' − ' + c[1] + '| = ' + man([st.x, st.y], c) + '.' }; } },

  // ---------------------------------------------------------------- the rules
  { id: 'h-goal-line', title: 'Why return 0 at a goal?', parts: ['goal0', 'zero'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Lines ' + lineOf('h_goal_if') + ' and ' + lineOf('h_goal_ret') + ' say: if no corner is left, return 0. <b>What does that make sure?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_goal_if', 'h_goal_ret'] }); },
      options: [O('That h is 0 at every goal state: nothing is left to do, so the estimate must be 0 (a positive value would overestimate)', true, 'The true cost from a goal state is 0, and an admissible heuristic can never exceed it.'),
        O('That the function is faster for every state', false, 'It only shortcuts goal states.'),
        O('That h becomes consistent', false, 'Consistency comes from the way the tour is built, not from this line.'),
        O('That A* stops when it pops that state', false, 'A* stops because ' + C('isGoalState') + ' is True, not because of h.')],
      hints: ['What is the true cost from a goal state?'], explain: 'A heuristic must be 0 at goals. Here that is the tuple being empty.' }) },

  { id: 'h-goal-need', title: 'Is the early return needed?', parts: ['goal0', 'perm'], level: 3,
    gen: () => ({ type: 'mc', demoTitle: 'What Python does with an empty tuple',
      prompt: 'Imagine lines ' + lineOf('h_goal_if') + ' and ' + lineOf('h_goal_ret') + ' are deleted (struck out). A goal state is passed in, with <code>unvisited = ()</code>. <b>What does the function return?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ remove: ['h_goal_if', 'h_goal_ret'] }); },
      options: [O('Still 0: the only ordering of no corners is the empty one, whose tour is 0, so best_tour becomes 0', true, 'The early return is a shortcut that makes the rule visible; the loop already gives 0.'),
        O('None, because the loop body never runs', false, 'It runs exactly once, with an empty ordering.'),
        O('It crashes: permutations of an empty tuple raises an error', false, 'It does not: it yields one empty ordering.'),
        O('Infinity, because there is no tour', false, 'The empty tour has length 0.')],
      hints: ['How many orderings does itertools.permutations(()) give?'],
      demo: (el) => { el.innerHTML = '<pre style="margin:0;padding:10px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font:12.5px/1.6 var(--font-mono);overflow-x:auto;max-width:100%">&gt;&gt;&gt; import itertools\n&gt;&gt;&gt; list(itertools.permutations(()))\n[()]</pre>'; },
      explain: 'One ordering, the empty one: tour = 0, best_tour = 0, return 0.' }) },

  { id: 'h-zero-prop', title: 'Rules every heuristic must follow', parts: ['zero', 'adm', 'cons'], level: 1,
    gen: () => ({ type: 'multi',
      prompt: 'For A* with a visited set to be optimal, which of these must a heuristic satisfy? <b>Tick every one.</b>',
      options: [O('It is never negative', true, 'A negative estimate has no meaning and breaks the other rules.'), O('It is 0 at every goal state', true, 'Nothing is left to do there.'),
        O('It never exceeds the true cost to go (admissible)', true, 'Otherwise A* may skip the optimal route.'), O('It never drops by more than the step cost in one step (consistent)', true, 'That is what makes the visited set safe.'),
        O('It is strictly positive everywhere', false, 'It must be 0 at goals.'), O('It always returns a whole number', false, 'Not required.'), O('It drops by exactly 1 on every step', false, 'Only "at most the step cost" is required.')],
      hints: ['Four of these are rules, three are not.'], explain: 'Admissible, consistent, 0 at goals and never negative: those are the four rules. Your tour satisfies all of them.' }) },

  // ---------------------------------------------------------------- the idea
  { id: 'h-relax', title: 'The easier problem behind your heuristic', parts: ['relax', 'manh'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Your heuristic is the exact answer to an <b>easier</b> version of the Corners problem. Which one?',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_add'] }); },
      options: [O('The same maze with every wall removed, where moving between two cells costs their Manhattan distance', true, 'Remove the walls and the cheapest tour is exactly your best_tour.'),
        O('A maze in which the corners must be visited in a fixed order', false, 'Your code tries every order.'),
        O('A maze with only one corner', false, 'All the unvisited corners are counted.'),
        O('The same maze with the ghosts removed', false, 'There are no ghosts in this problem.')],
      hints: ['What does util.manhattanDistance ignore?'], explain: 'A relaxed problem drops a rule (here: walls). Its exact cost is a natural heuristic for the real problem.' }) },

  { id: 'h-relax-why', title: 'Why it never overestimates', parts: ['relax', 'adm'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Why does solving the wall-free version exactly give a heuristic that <b>never overestimates</b>?',
      options: [O('Every real plan is also a legal plan in the wall-free maze, so the cheapest wall-free plan costs at most as much as the cheapest real plan', true, 'Fewer rules means more plans, so the minimum can only go down.'),
        O('Manhattan distances are always whole numbers', false, 'That has nothing to do with it.'),
        O('Walls only ever make a path shorter', false, 'Walls make paths longer or equal.'),
        O('The heuristic is computed before the walls exist', false, 'Walls are fixed from the start.')],
      hints: ['More legal moves can only make the cheapest plan cheaper or equal.'], explain: 'This "relaxation" argument is the standard way to design admissible heuristics.' }) },

  { id: 'h-unused-lines', title: 'The two lines you do not use', parts: ['relax', 'manh', 'trade'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'The starter code gives you <code>corners = problem.corners</code> and <code>walls = problem.walls</code>. Your heuristic uses <b>neither</b> (the corners come from the state). <b>Is ignoring <code>walls</code> a mistake?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['h_given1', 'h_given2'] }); },
      options: [O('No: ignoring the walls is exactly the relaxation. Using them (for example real walking distances) would give a better estimate, but costs more to compute', true, 'The starter lines are offered, not required. Your choice trades some accuracy for speed and simplicity.'),
        O('Yes: without the walls the heuristic is inadmissible', false, 'Removing walls can only shrink the estimate, so it stays admissible.'),
        O('Yes: the autograder rejects heuristics that do not read the walls', false, 'It only checks the properties and the expansion count.'),
        O('No: the walls are already inside the state', false, 'They are not in the state; they are in the problem.')],
      hints: ['Does the missing information make the estimate bigger or smaller?'], explain: 'Your heuristic is cheap and still far better than 0. Both unused lines are simply not needed.' }) },

  // ---------------------------------------------------------------- the gap
  { id: 'h-manh-click', title: 'Where do walls matter?', parts: ['gap', 'manh'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r, { segs: r.int(3, 5) }), cs = cornersOf(gr); return { gr, ans: [0, 1, 2, 3].filter((i) => mdist(gr, gr.start, cs[i]) > man(gr.start, cs[i])) }; }, (x) => x.ans.length >= 1 && x.ans.length <= 3, 80), gr = pick.gr, cs = cornersOf(gr);
      return { type: 'cells', pick: 'nodes', grid: gr, cs: 24, label: 'Maze', answer: pick.ans.map((i) => cid(cs[i][0], cs[i][1])),
        drawOpts: () => ({ hidePellet: true, pac: gr.start, dots: dotsFor(gr, [0, 1, 2, 3]) }),
        prompt: 'Your heuristic measures each leg with the Manhattan distance. <b>Click every corner for which the real walking distance from Pacman is longer than the Manhattan distance</b> (so a wall is in the way).',
        hints: ['Manhattan = |dx| + |dy|. Count the real route around the walls and compare.'],
        explain: [0, 1, 2, 3].map((i) => cornerWord(i) + ': Manhattan ' + man(gr.start, cs[i]) + ', walking ' + mdist(gr, gr.start, cs[i])).join('; ') + '.' }; } },

  { id: 'h-gap-numeric', title: 'How far off is Manhattan?', parts: ['gap', 'manh'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r, { segs: r.int(3, 5) }), ci = r.int(0, 3), c = cornersOf(gr)[ci]; return { gr, ci, gap: mdist(gr, gr.start, c) - man(gr.start, c) }; }, (x) => x.gap >= 2, 100), gr = pick.gr, c = cornersOf(gr)[pick.ci];
      return { type: 'numeric', answer: pick.gap, tol: 0, unit: 'extra steps',
        prompt: 'Pacman wants to reach the ' + cornerWord(pick.ci) + ' corner ' + ptS(c[0], c[1]) + ' (the only filled dot). <b>How many more steps does the real walk need than the Manhattan distance?</b>',
        visual: (el) => cBoard(el, gr, { un: [pick.ci] }, ''),
        hints: ['Compute Manhattan first. Then count the real walking steps around the walls.'], explain: 'Manhattan ' + man(gr.start, c) + ', real walk ' + mdist(gr, gr.start, c) + ': ' + pick.gap + ' extra steps forced by the walls.' }; } },

  { id: 'h-gap-ok', title: 'Heuristic below the real cost', parts: ['gap', 'adm'], level: 1,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r, { segs: r.int(3, 5) }), st = randState(r, gr, r.int(3, 4)); return { gr, st, h: hOf(gr, st), t: trueCost(gr, st) }; }, (x) => x.t - x.h >= 4, 100), gr = pick.gr, st = pick.st, best = bestOf(tours(gr, [st.x, st.y], st.un, manDist)), real = cBFS(gr, { start: st });
      return { type: 'mc', demoTitle: 'The real plan against the wall-free tour',
        prompt: 'For the state on the board your heuristic returns <b>' + pick.h + '</b>, but the cheapest real plan takes <b>' + pick.t + '</b> steps. <b>Is something wrong?</b>',
        visual: (el) => stateBoard(el, gr, st, 'The state'),
        options: [O('No. An admissible heuristic must be at most the real cost. Being lower only means A* has some extra searching to do', true, 'The walls make the real plan longer than the wall-free tour. That gap is allowed.'),
          O('Yes. The heuristic must equal the real cost', false, 'Only a perfect heuristic does, and that would need the answer in advance.'),
          O('Yes. The heuristic is higher than it should be', false, 'It is lower than the real cost, which is the safe direction.'),
          O('Yes. It breaks consistency', false, 'Consistency is about steps, and a constant gap does not break it.')],
        hints: ['Which of the two numbers is the lower bound?'],
        demo: (el) => demoPair(el, [{ title: 'Cheapest real plan', gr: withStart(gr, [st.x, st.y]), opts: { path: real.path, un: st.un }, ok: true, text: stepsWord(pick.t) + ' (around the walls)' },
          { title: 'Wall-free tour (the heuristic)', gr: withStart(gr, [st.x, st.y]), opts: { lines: [{ pts: legPts(gr, [st.x, st.y], best.order), dash: true, color: '#2fd8cf' }], un: st.un }, ok: true, text: stepsWord(pick.h) + ' (straight legs through the walls)' }]),
        explain: 'Heuristic ' + pick.h + ' ≤ real cost ' + pick.t + ': admissible. The difference is where the walls bite.' }; } },

  // ---------------------------------------------------------------- judging heuristics
  { id: 'h-cand-adm', title: 'Which candidates are admissible?', parts: ['cand', 'adm'], level: 2,
    gen: (r) => { const theory = { tour: true, max: true, near: true, count: true, maxmaze: true, sum: false, twice: false, worst: false };
      const chosen = r.shuffle(Object.keys(theory)).slice(0, 5);
      if (!chosen.some((k) => theory[k])) chosen[0] = 'tour';
      if (!chosen.some((k) => !theory[k])) chosen[1] = 'sum';
      const pick = find(r, () => { const gr = cRandMaze(r, { W: r.int(9, 11), H: r.int(7, 8), segs: r.int(3, 4) }); return { gr, v: chosen.map((k) => firstViolation(gr, HEUR[k].f)) }; }, (x) => chosen.every((k, i) => (x.v[i].n === 0) === theory[k]), 40), gr = pick.gr;
      return { type: 'multi',
        prompt: 'Five classmates propose a heuristic for this maze. <b>Tick every one that is admissible</b> (never above the true cost to go at any reachable state).',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, 'The maze'),
        options: chosen.map((k, i) => { const v = pick.v[i], ok = v.n === 0; return O('<b>' + esc(nameOf(k)) + '</b>: ' + HDESC[k], ok, ok ? 'Admissible: never above the true cost, at any of the ' + v.total + ' reachable states.' : 'Overestimates at ' + v.n + ' of ' + v.total + ' states, for example at ' + esc(stRepr(gr, v.ex.st)) + ': h = ' + v.ex.h + ' but the real cost is ' + v.ex.t + '.'); }),
        hints: ['Test each on a small example: can it ever be bigger than the real walk?', 'Adding up distances to several corners counts shared stretches more than once.'],
        explain: 'The answer keys come from checking every one of these heuristics at every reachable state of this maze.' }; } },

  { id: 'h-cand-cons', title: 'Admissible but not consistent', parts: ['cons', 'adm', 'cand'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = cRandMaze(r, { W: r.int(9, 11), H: r.int(7, 8), segs: r.int(2, 4) }); return { gr, a: cAudit(gr, HEUR.oddzero.f) }; }, (x) => x.a.admissible && !x.a.consistent && x.a.worst && x.a.worst.hf - x.a.worst.ht >= 3, 40), gr = pick.gr, w = pick.a.worst;
      return { type: 'mc', demoTitle: 'The step where it breaks',
        prompt: 'A classmate returns <b>your tour value when Pacman\'s x coordinate is even, and 0 when it is odd</b>. <b>Which properties does this heuristic have?</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, 'The maze'),
        options: [O('Admissible (never above your tour, which never exceeds the real cost) but not consistent (it can fall from a big value to 0 in one step)', true, 'Zero is a lower bound, so it stays admissible. The sudden fall breaks consistency.'),
          O('Both admissible and consistent', false, 'The value can fall by much more than 1 in a single step.'),
          O('Consistent but not admissible', false, 'Consistent with h(goal)=0 would force admissible; here it is the other way round.'),
          O('Neither', false, 'It is never above the true cost.')],
        hints: ['Look at two neighbouring cells, one with x even and one with x odd.'],
        demo: (el) => demoPair(el, [{ title: 'State A: h = ' + w.hf, gr: withStart(gr, [w.from.x, w.from.y]), opts: { un: w.from.un }, ok: true, text: 'x = ' + w.from.x + ' is even, h = <b>' + w.hf + '</b>' }, { title: 'State B (one step later): h = ' + w.ht, gr: withStart(gr, [w.to.x, w.to.y]), opts: { un: w.to.un }, ok: false, text: 'x = ' + w.to.x + ' is odd, h = <b>' + w.ht + '</b>: it fell by ' + (w.hf - w.ht) + ' in one step of cost 1' }]),
        explain: 'Consistency needs h(A) ≤ 1 + h(B). Here ' + w.hf + ' > 1 + ' + w.ht + '.' }; } },

  { id: 'h-cons-spot', title: 'Spot the inconsistent step', parts: ['cons'], level: 1,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), run = cBFS(gr); const sts = [cStart(gr)]; let cur = sts[0]; for (const a of run.path) { const nx = cSucc(gr, cur).find((s) => s.a === a); cur = nx.st; sts.push(cur); }
        const hs = sts.map((s) => hOf(gr, s)).slice(0, 8); return { gr, hs }; }, (x) => x.hs.length === 8 && x.hs.slice(1, 6).some((h) => h >= 5), 80), gr = pick.gr, hs = pick.hs.slice();
      const cand = []; for (let i = 1; i <= 5; i++) if (hs[i] >= 5) cand.push(i); const bi = r.pick(cand), d = r.int(3, 4); hs[bi + 1] = hs[bi] - d;
      const steps = [0, 1, 2, 3, 4, 5, 6].filter((i) => i !== bi); const wrongs = r.shuffle(steps).slice(0, 3), idx = [bi].concat(wrongs).sort((a, b) => a - b);
      return { type: 'mc',
        prompt: 'Here are the values of a heuristic for the first states on a real plan (every step costs 1). <b>Exactly one step breaks consistency. Which one?</b>',
        visual: (el) => { el.innerHTML = heapHTML(hs.map((h, i) => ({ s: 'state ' + i, h })), { cols: ['h'], noNext: true, caption: 'h along the plan' }); },
        options: idx.map((i) => O('The step from state ' + i + ' to state ' + (i + 1), i === bi, i === bi ? 'h goes from ' + hs[i] + ' to ' + hs[i + 1] + ': it falls by ' + (hs[i] - hs[i + 1]) + ' in a step that costs 1, so h(A) > 1 + h(B).' : (hs[i + 1] >= hs[i] ? 'h goes from ' + hs[i] + ' to ' + hs[i + 1] + ': it does not fall, so nothing breaks (consistency allows h to rise).' : 'h goes from ' + hs[i] + ' to ' + hs[i + 1] + ': it falls by ' + (hs[i] - hs[i + 1]) + ', at most the step cost, so it is fine.'))),
        hints: ['Look for a fall of more than 1.'], explain: 'Consistency forbids a drop larger than the step cost. Rises are allowed.' }; } },

  // ---------------------------------------------------------------- using it in A*
  { id: 'h-fvalues', title: 'f along the optimal plan', parts: ['fpath', 'cons'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), run = cBFS(gr); const sts = [cStart(gr)]; let cur = sts[0]; for (const a of run.path) { cur = cSucc(gr, cur).find((s) => s.a === a).st; sts.push(cur); } return { gr, run, sts }; }, (x) => x.run.cost >= 10 && x.run.cost <= 22, 60), gr = pick.gr, N = pick.run.cost;
      const rows = pick.sts.map((s, i) => ({ s: 'state ' + i, g: i, h: hOf(gr, s), pri: i + hOf(gr, s) }));
      return { type: 'mc',
        prompt: 'A* follows the optimal plan below (' + N + ' steps). The table gives g, your h and f = g + h for every state on it. <b>Which statement about f is true?</b>',
        visual: (el) => { el.innerHTML = heapHTML(rows, { cols: ['g', 'h', 'pri'], priLabel: 'f = g + h', noNext: true, caption: 'Along the optimal plan' }); },
        options: [O('f never decreases along the plan, and at the goal f equals the plan cost (' + N + ')', true, 'With a consistent heuristic f is non-decreasing, and at the goal h = 0 so f = g = the cost.'),
          O('f is the same at every state', false, 'That only happens with a perfect heuristic. Yours underestimates, so f grows.'),
          O('f falls as Pacman gets closer to the goal', false, 'h falls but g rises by at least as much, so f does not fall.'),
          O('f at the goal is 0', false, 'g is the whole cost by then; only h is 0.')],
        hints: ['Each step adds 1 to g and takes at most 1 from h.'], explain: 'f starts at h(start) = ' + rows[0].pri + ' and ends at ' + rows[rows.length - 1].pri + '. In between it never goes down.' }; } },

  { id: 'h-f-start', title: 'The first priority', parts: ['fpath', 'tour'], level: 2,
    gen: (r) => { const gr = cRandMaze(r, { startCorner: r.int(0, 3) }), st = cStart(gr), all = tours(gr, [st.x, st.y], st.un, manDist), best = bestOf(all);
      return { type: 'numeric', answer: best.cost, tol: 0, unit: '',
        prompt: 'Pacman starts <b>on a corner</b> ' + ptS(st.x, st.y) + '. The first thing <code>aStarSearch</code> does is push the start state with priority <code>heuristic(start_state, problem)</code>. <b>What priority is that, using your <code>cornersHeuristic</code>?</b>',
        visual: (el) => stateBoard(el, gr, st, 'Three corners are left'),
        hints: ['g = 0 at the start, so f = h. How many orderings of three corners are there?'],
        explain: all.map((t) => orderWords(t.order) + ' = ' + t.cost).join('; ') + '. The first priority is ' + best.cost + '.' }; } },

  { id: 'h-f-goal', title: 'f at the goal', parts: ['fpath', 'zero'], level: 1,
    gen: (r) => { const gr = mazeFor(r), run = cAStar(gr, HEUR.tour.f);
      return { type: 'numeric', answer: run.cost, tol: 0,
        prompt: 'A* with your heuristic finds a plan of <b>' + run.cost + '</b> steps on this maze. <b>When the goal state is popped, what is its f = g + h?</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, ''),
        hints: ['What are g and h at the goal?'], explain: 'g = ' + run.cost + ' (the whole plan) and h = 0 (nothing is left), so f = ' + run.cost + '.' }; } },

  { id: 'h-null', title: 'What if h were 0?', parts: ['expand', 'zero'], level: 1,
    gen: () => { const gr = getMaze('mediumCorners'), z = cAStar(gr, HEUR.zero.f), t = cAStar(gr, HEUR.tour.f);
      return { type: 'mc', demoTitle: 'Where A* looked on mediumCorners',
        prompt: 'Suppose <code>cornersHeuristic</code> simply returned <b>0</b> for every state. <b>What would A* do on <code>mediumCorners</code>?</b>',
        options: [O('Still return an optimal plan, but expand far more states (' + z.expanded + ' instead of ' + t.expanded + ' with yours), because it behaves like uniform cost search', true, 'h = 0 is admissible and consistent, so the answer is right; it just gives no guidance.'),
          O('Return a plan that is not optimal', false, 'h = 0 never overestimates, so A* stays optimal.'),
          O('Crash, because h must be positive for non-goal states', false, 'Zero is allowed everywhere.'),
          O('Expand fewer states, because a simpler heuristic is faster', false, 'It expands more: it has no information about the corners.')],
        hints: ['With h = 0 the priority is just g.'],
        demo: (el) => demoPair(el, [{ title: 'h = 0', gr, opts: { cs: 9, heat: heatOf(z), noPac: false }, ok: false, text: '<b>' + z.expanded + '</b> expansions' }, { title: 'Your heuristic', gr, opts: { cs: 9, heat: heatOf(t) }, ok: true, text: '<b>' + t.expanded + '</b> expansions' }]),
        explain: 'Darker cells are expanded more often. With h = 0 the search spreads over the whole maze; yours leans towards the unfinished corners.' }; } },

  { id: 'h-heat-pick', title: 'Which picture is yours?', parts: ['expand', 'cand', 'tour'], level: 3,
    gen: (r) => { const ks = ['zero', 'max', 'tour', 'tourmaze'];
      const pick = find(r, () => { const gr = cRandMaze(r, { W: r.int(11, 13), H: r.int(8, 9), segs: r.int(3, 5) }); return { gr, runs: ks.map((k) => cAStar(gr, HEUR[k].f)) }; }, (x) => x.runs[0].expanded > x.runs[1].expanded && x.runs[1].expanded > x.runs[2].expanded && x.runs[2].expanded > x.runs[3].expanded, 60), gr = pick.gr;
      const tex = { zero: 'h = 0: no guidance at all, the widest search.', max: 'Distance to the farthest corner ignores the other corners, so it guides less than yours.', tour: 'Yours: the best tour guides well; only the walls it ignores leave some extra search.', tourmaze: 'Walking distances know about the walls, so this heuristic is even closer to the truth and expands even less.' };
      return { type: 'mc', visualOptions: true,
        prompt: 'The pictures show where A* expanded states on the same maze with four different heuristics (darker = expanded more often): h = 0, distance to the farthest corner, <b>your best Manhattan tour</b>, and the best tour with real walking distances. <b>Which picture is yours?</b>',
        options: r.shuffle(ks.map((k, i) => { const o = O('<canvas class="board"></canvas>', k === 'tour', tex[k] + ' (' + pick.runs[i].expanded + ' expansions)'); o.draw = (cv) => cDraw(cv, gr, { cs: 10, heat: heatOf(pick.runs[i]), un: [0, 1, 2, 3] }); return o; })),
        hints: ['A better-informed heuristic expands fewer states. Rank the four by how much they know.', 'Yours knows about all the corners but not about the walls.'],
        explain: 'Expansions: ' + ks.map((k, i) => HEUR[k].name + ': ' + pick.runs[i].expanded).join('; ') + '.' }; } },

  { id: 'h-rank', title: 'Rank the heuristics by work', parts: ['expand', 'cand'], level: 3,
    gen: (r) => { const ks = ['zero', 'near', 'max', 'tour', 'tourmaze'];
      const pick = find(r, () => { const gr = cRandMaze(r, { W: r.int(11, 13), H: r.int(8, 9), segs: r.int(3, 5) }); return { gr, runs: ks.map((k) => cAStar(gr, HEUR[k].f)) }; }, (x) => x.runs.every((run, i) => i === 0 || run.expanded < x.runs[i - 1].expanded), 80), gr = pick.gr;
      const order = ks.map((k, i) => ({ k, n: pick.runs[i].expanded })).sort((a, b) => a.n - b.n);
      return { type: 'order',
        prompt: 'A* runs on the maze below with five different admissible, consistent heuristics. <b>Click them from the one that expands the FEWEST states to the one that expands the MOST.</b> (The measured counts are on the next screen.)',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, 'The maze'),
        items: order.map((x) => '<b>' + esc(nameOf(x.k)) + '</b>: ' + HDESC[x.k]),
        hints: ['A heuristic that is larger everywhere (but still admissible) expands no more states.', 'Real walking distances are never smaller than Manhattan distances.'],
        explain: 'Measured expansions: ' + order.map((x) => nameOf(x.k) + ': ' + x.n).join('; ') + '. Each heuristic in the list is at least as large as the next one at every state (and still admissible), so it knows at least as much and, apart from ties in f, does not expand more.' }; } },

  { id: 'h-autograder', title: 'Which earn full marks?', parts: ['expand', 'cand', 'adm'], level: 2,
    gen: (r) => { const gr = getMaze('mediumCorners'), pool = ['zero', 'count', 'near', 'max', 'maxmaze', 'tour', 'tourmaze', 'sum'];
      const meas = {}; pool.forEach((k) => { const a = cAudit(gr, HEUR[k].f); meas[k] = { exp: cAStar(gr, HEUR[k].f).expanded, legit: a.admissible && a.consistent }; });
      const chosen = r.shuffle(pool).slice(0, 5), earns = (k) => meas[k].legit && meas[k].exp <= 1200;
      if (!chosen.some(earns)) chosen[0] = 'tour';
      if (!chosen.some((k) => !earns(k))) chosen[1] = 'zero';
      return { type: 'multi',
        prompt: 'The autograder\'s expansion test gives <b>3 points</b> when A* expands at most <b>1200</b> states on <code>mediumCorners</code> (at most 1600 gives 2 points, at most 2000 gives 1). Separate sanity tests only accept a heuristic that is non-trivial, admissible and consistent. <b>Tick every heuristic below that is a correct (admissible and consistent) heuristic AND reaches the 3-point expansion level.</b>',
        options: chosen.map((k) => O('<b>' + esc(nameOf(k)) + '</b>: ' + HDESC[k], earns(k), !meas[k].legit ? 'It expands only ' + meas[k].exp + ' states, but it is not admissible or not consistent, so it is not a correct heuristic. Fewer expansions are worthless if the plan can be wrong.' : meas[k].exp <= 1200 ? 'Admissible and consistent, and it expands ' + meas[k].exp + ' states, at most 1200: all 3 points.' : 'Admissible and consistent, but it expands ' + meas[k].exp + ' states, above 1200: not all 3 points.')),
        hints: ['Two conditions must both hold: a correct heuristic, and at most 1200 expansions.'],
        explain: 'Measured on mediumCorners: ' + pool.map((k) => nameOf(k) + ': ' + meas[k].exp + (meas[k].legit ? '' : ' (not admissible/consistent)')).join('; ') + '. Your tour expands 741.' }; } },

  { id: 'h-trade-time', title: 'Is one call too expensive?', parts: ['trade', 'expand'], level: 2,
    gen: () => { const gr = getMaze('mediumCorners'), z = cAStar(gr, HEUR.zero.f), t = cAStar(gr, HEUR.tour.f);
      return { type: 'mc',
        prompt: 'Each call to your heuristic does up to 96 small additions, while h = 0 does none. Yet on <code>mediumCorners</code> A* expands <b>' + t.expanded + '</b> states with yours and <b>' + z.expanded + '</b> with h = 0. <b>Why is the extra work per call worth it?</b>',
        options: [O('The few hundred states it saves each cost a whole getSuccessors call plus queue work, far more than the 96 additions a heuristic call costs', true, 'Cutting expansions by about ' + Math.round(100 * (1 - t.expanded / z.expanded)) + '% easily pays for the extra arithmetic.'),
          O('It is not worth it: a heuristic always makes A* slower in total', false, 'A good heuristic is the whole point of A*.'),
          O('The heuristic calls are free in Python', false, 'They are not free, just cheap compared with what they save.'),
          O('Because 96 is smaller than ' + z.expanded, false, 'The comparison is about work saved, not about those two numbers.')],
        hints: ['Count the work: heuristic calls versus expansions avoided.'], explain: 'Your heuristic is a good trade: cheap to compute and large savings. Real walking distances save even more states but need extra set-up.' }; } },

  { id: 'h-better-h', title: 'A better estimate: real distances', parts: ['trade', 'relax', 'cand'], level: 3,
    gen: () => { const gr = getMaze('mediumCorners'), t = cAStar(gr, HEUR.tour.f), m = cAStar(gr, HEUR.tourmaze.f);
      return { type: 'mc',
        prompt: 'Instead of Manhattan legs, a classmate measures each leg with the <b>real walking distance</b> between corners (precomputed with BFS), still trying every ordering. On <code>mediumCorners</code> A* then expands <b>' + m.expanded + '</b> states instead of <b>' + t.expanded + '</b>. <b>What is the catch?</b>',
        options: [O('It stays admissible and consistent, but you need extra code and a table of walking distances before the search; the estimate is better but costs more to set up', true, 'It relaxes a smaller part of the problem (it keeps the walls), so it is closer to the truth.'),
          O('It is no longer admissible, because real distances are larger than Manhattan ones', false, 'A real distance is still a true cost, so it never exceeds the cheapest real plan.'),
          O('A* expands more states, because the numbers are bigger', false, 'Bigger admissible values mean fewer expansions (apart from ties).'),
          O('There is no catch: it is better in every way', false, 'It needs extra set-up (and the walls must be read from the problem).')],
        hints: ['Is a real walking distance ever larger than the cheapest real plan?'], explain: 'This is the usual trade-off in heuristic design: fewer expansions against a heavier heuristic.' }; } },

  // ---------------------------------------------------------------- wrong candidates
  { id: 'h-sum-bad', title: 'Adding the distances up', parts: ['cand', 'adm'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); const x = overshootState(r, gr, HEUR.sum.f, 3, 3); return { gr, x }; }, (x) => !!x.x, 80), gr = pick.gr, o = pick.x, st = o.st, real = cBFS(gr, { start: st });
      return { type: 'mc', demoTitle: 'The real plan for that state',
        prompt: 'A classmate returns the <b>sum</b> of the Manhattan distances from Pacman to each unvisited corner. For the state on the board that is <b>' + o.h + '</b>, while the cheapest real plan has only <b>' + o.t + '</b> steps. <b>What does this show?</b>',
        visual: (el) => stateBoard(el, gr, st, 'The state'),
        options: [O('The heuristic is not admissible: it overestimates because it counts the shared part of the walk once for each corner', true, 'One walk can reach several corners that lie in the same direction, but the sum pays for the common stretch several times.'),
          O('It is fine: a heuristic is allowed to be larger than the real cost', false, 'That is exactly what admissible forbids.'),
          O('It is admissible and the real plan is just unlucky', false, 'The real plan is the cheapest possible.'),
          O('It is admissible because every Manhattan distance is', false, 'Each term is, but their sum is not.')],
        hints: ['One trip can serve several corners that are in the same direction.'],
        demo: (el) => demoPair(el, [{ title: 'Cheapest real plan', gr: withStart(gr, [st.x, st.y]), opts: { path: real.path, un: st.un }, ok: true, text: stepsWord(o.t) }, { title: 'The sum of distances', gr: withStart(gr, [st.x, st.y]), opts: { un: st.un }, ok: false, text: 'claims <b>' + o.h + '</b>: ' + (o.h - o.t) + ' too many' }]),
        explain: 'sum = ' + o.h + ' > real cost ' + o.t + '. A* with this heuristic can return a plan that is not optimal.' }; } },

  { id: 'h-max-vs-tour', title: 'Farthest corner against best tour', parts: ['cand', 'expand', 'tour'], level: 2,
    gen: (r) => { const gr = cRandMaze(r, { W: r.int(9, 11), H: r.int(7, 8), segs: r.int(3, 4) }), R = cReach(gr); let ge = 0, gt = 0, n = 0; R.map.forEach((st) => { n++; const a = HEUR.tour.f(st, gr), b = HEUR.max.f(st, gr); if (a >= b) ge++; if (a > b) gt++; });
      return { type: 'mc', demoTitle: 'Checked at every state of this maze',
        prompt: 'Two admissible, consistent heuristics: <b>(A)</b> the Manhattan distance to the farthest unvisited corner, and <b>(B)</b> your best Manhattan tour. <b>How do they compare, and what follows for A*?</b>',
        visual: (el) => cBoard(el, gr, { un: [0, 1, 2, 3] }, 'The maze'),
        options: [O('B is at least as large as A at every state (the tour must reach the farthest corner and more), so A* with B expands no more states than with A (apart from ties in f)', true, 'When one admissible heuristic is never below another, it is at least as informed.'),
          O('A is at least as large as B, so A* with A expands fewer states', false, 'The tour includes the trip to the farthest corner, so it is the larger one.'),
          O('They are always equal', false, 'The tour is often strictly larger.'),
          O('A is better because it is cheaper to compute, whatever the cost in expansions', false, 'Cheaper to compute, but it guides the search less.')],
        hints: ['Does the tour have to travel at least as far as the farthest corner?'],
        demo: (el) => { el.innerHTML = '<div class="res ok" style="font-size:.9rem">Over all <b>' + n + '</b> reachable states of this maze: tour ≥ farthest corner at <b>' + ge + '</b>, tour strictly larger at <b>' + gt + '</b>.</div>'; },
        explain: 'A heuristic that is larger everywhere (and still admissible) dominates the other: it never expands more.' }; } },

  // ---------------------------------------------------------------- consistency of yours
  { id: 'h-cons-proof', title: 'Why yours is consistent', parts: ['cons', 'relax', 'tour'], level: 3,
    gen: () => { const gr = getMaze('tinyCorners'), a = cAudit(gr, HEUR.tour.f), b = cAudit(gr, HEUR.oddzero.f);
      return { type: 'mc', demoTitle: 'Audit of every state of tinyCorners',
        prompt: 'The autograder checks that your heuristic is consistent along a real plan. <b>Why can you be sure that your best Manhattan tour is consistent?</b>',
        options: [O('It is the exact cost of the wall-free problem, and a real step is also a legal step there, so the cost to go can fall by at most the 1 step just taken', true, 'Optimal cost to go in any problem is consistent; yours is the optimal cost to go of the relaxed problem.'),
          O('Because it is admissible', false, 'Admissible does not imply consistent.'),
          O('Because Manhattan distance is symmetric', false, 'Symmetry is not the reason.'),
          O('Because all the numbers are integers', false, 'Integers can still drop by more than 1.')],
        hints: ['The exact cost to go of any problem satisfies h(A) ≤ c + h(B). Which problem is yours exact for?'],
        demo: (el) => { el.innerHTML = '<div class="res ok" style="font-size:.9rem">Your heuristic on <b>tinyCorners</b>: checked at <b>' + a.states + '</b> states and <b>' + a.edges + '</b> steps. Overestimates: <b>' + a.notAdmissible + '</b>. Falls by more than 1: <b>' + a.notConsistent + '</b>.</div><div class="res bad" style="font-size:.9rem">The "0 when x is odd" heuristic: overestimates <b>' + b.notAdmissible + '</b> times and falls by more than 1 in <b>' + b.notConsistent + '</b> steps.</div>'; },
        explain: 'The relaxed problem has fewer rules, so its optimal cost to go is a lower bound (admissible), and it satisfies the one-step inequality (consistent).' }; } },

  // ---------------------------------------------------------------- bugs in your own code
  { id: 'h-bug-min', title: 'The longest tour instead of the shortest', parts: ['best', 'adm'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); return { gr, x: overshootState(r, gr, HEUR.worst.f, 3, 3) }; }, (x) => !!x.x, 80), gr = pick.gr, o = pick.x, st = o.st, good = hOf(gr, st);
      return { type: 'mc', demoTitle: 'One state, three numbers',
        prompt: 'A classmate changes the comparison on line ' + lineOf('h_cmp') + ' to <code>tour > best_tour</code> (shown). <b>What does the function return now?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { h_cmp: 'if best_tour is None or tour > best_tour:' } }); },
        options: [O('The LONGEST Manhattan tour, which can exceed the real cost: the heuristic is no longer admissible', true, 'Keeping the maximum overestimates; admissibility needs the minimum.'),
          O('The same value as before', false, 'Only the shortest ordering was right; now the longest is kept.'),
          O('An error, because best_tour is None at the start', false, 'The None check is still there.'),
          O('A slower function that gives the same plans', false, 'The plans can be non-optimal.')],
        hints: ['Which ordering does ' + C('>') + ' keep?'],
        demo: (el) => { el.innerHTML = '<div class="res ok" style="font-size:.9rem">At the state ' + esc(stRepr(gr, st)) + ': your tour = <b>' + good + '</b>; the real cost to finish = <b>' + o.t + '</b>; the buggy version returns <b>' + o.h + '</b> (' + (o.h - o.t) + ' too many).</div>'; },
        explain: 'Line ' + lineOf('h_cmp') + ' with < keeps the smallest tour, which is what makes the estimate a lower bound.' }; } },

  { id: 'h-bug-reset', title: 'The tour is not reset', parts: ['leg', 'best', 'perm'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r), st = randState(r, gr, 3); return { gr, st }; }, (x) => { const f = HEUR.fixed.f(x.st, x.gr), b = hOf(x.gr, x.st); return f > b; }, 80), gr = pick.gr, st = pick.st, first = HEUR.fixed.f(st, gr), good = hOf(gr, st);
      return { type: 'mc', demoTitle: 'The state below',
        prompt: 'A classmate moves <code>tour = 0</code> and <code>here = position</code> out of the loop over orderings (shown). <b>What does the function return?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ remove: ['h_tour0', 'h_here'], replace: { h_best_init: 'best_tour = None; tour = 0; here = position   # moved out of the loop' } }); },
        options: [O('Only the first ordering is added up correctly. Later orderings start from the old total and the old position, so they are never smaller: the function returns the FIRST ordering\'s length, not the shortest', true, 'tour keeps growing across orderings, so no later tour can beat the first.'),
          O('The same value as before', false, 'The totals are no longer reset for each ordering.'),
          O('An error, because here is undefined', false, 'It is defined once, before the loop.'),
          O('Always 0', false, 'tour grows; it never resets to 0.')],
        hints: ['After the first ordering, what do ' + C('tour') + ' and ' + C('here') + ' start from?'],
        demo: (el) => { el.innerHTML = '<div class="res ok" style="font-size:.9rem">At ' + esc(stRepr(gr, st)) + ': the shortest tour is <b>' + good + '</b>, but the first ordering ' + orderWords(st.un) + ' costs <b>' + first + '</b>, and that is what the buggy version returns.</div>'; },
        explain: 'Each ordering must start fresh: lines ' + lineOf('h_tour0') + ' and ' + lineOf('h_here') + ' sit INSIDE the loop for that reason.' }; } },

  { id: 'h-bug-dist', title: 'Measuring every leg from Pacman', parts: ['leg', 'adm'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); return { gr, x: overshootState(r, gr, HEUR.sum.f, 3, 3) }; }, (x) => !!x.x, 80), gr = pick.gr, o = pick.x, st = o.st;
      return { type: 'mc',
        prompt: 'A classmate writes <code>tour += util.manhattanDistance(position, corner)</code> on line ' + lineOf('h_add') + ' (shown), always measuring from Pacman and not from the previous corner. <b>What does this become?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { h_add: 'tour += util.manhattanDistance(position, corner)' } }); },
        options: [O('The same total for every ordering, the SUM of distances from Pacman to each corner, which can overshoot the real cost: not admissible', true, 'The order no longer matters, and the sum counts shared stretches several times.'),
          O('The same heuristic as yours, written differently', false, 'The legs no longer chain from corner to corner.'),
          O('Only the first leg is wrong; the others are fine', false, 'Every leg is measured from the wrong point.'),
          O('Consistent but not admissible', false, 'It is neither: the sum also falls too fast.')],
        hints: ['What does ' + C('here') + ' do in your code, and what happens without it?'],
        explain: 'For example at ' + esc(stRepr(gr, st)) + ' the sum is ' + o.h + ' but the real cost is only ' + o.t + '.' }; } },

  { id: 'h-bug-order', title: 'One ordering only', parts: ['perm', 'adm'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = mazeFor(r); return { gr, x: overshootState(r, gr, HEUR.fixed.f, 2, 3) }; }, (x) => !!x.x, 100), gr = pick.gr, o = pick.x, st = o.st, good = hOf(gr, st);
      return { type: 'mc',
        prompt: 'To save time, a classmate replaces the loop header with <code>for order in [unvisited]:</code> (shown): a single "ordering", the tuple exactly as stored. <b>What is the effect?</b>',
        visual: (el) => { el.innerHTML = codeHTML({ replace: { h_perm: 'for order in [unvisited]:' } }); },
        options: [O('It only measures one fixed ordering, which may be a long one: the heuristic can exceed the real cost, so it is not admissible', true, 'Only the minimum over every ordering is a lower bound.'),
          O('Nothing changes, since the stored order is always the best', false, 'The stored order follows self.corners, which has nothing to do with distances.'),
          O('It becomes more accurate', false, 'It becomes larger and can overshoot.'),
          O('A TypeError, since unvisited is not iterable twice', false, 'It runs; it is just wrong.')],
        hints: ['Is the corner order of self.corners usually the shortest tour?'],
        explain: 'At ' + esc(stRepr(gr, st)) + ' that single ordering costs ' + o.h + ' but the real cost is ' + o.t + ' (the true best Manhattan tour is ' + good + ').' }; } },
];

return {
  algo: 'cornersheur', func: 'cornersHeuristic', title: 'Corners Heuristic Evaluation', subtitle: 'A teacher\'s check: do you really know why your cornersHeuristic is a good heuristic?',
  welcomeTitle: 'Let\'s see what you really know about the corners heuristic',
  intro: '<p class="prompt">The autograder checks that your heuristic is admissible, consistent and expands few enough states. It does not check that you know <b>why</b>. I will test the rules a heuristic must follow, the idea of removing the walls, every line of your code, how it compares with other heuristics, and how it behaves inside A*, using <b>your own code</b> and a measuring engine that audits heuristics on real mazes.</p>',
  handsOn: '<li>You do things by hand: compute the heuristic for a state, find the best order of corners on a maze, spot where walls matter, audit other heuristics, rank them by the work A* does and find what a wrong copy of your code returns.</li>',
  mapTitle: 'Map of the corners heuristic', mapNote: 'Every box is a part of the heuristic: the rules, where the idea comes from, your code, comparisons and its use in A*. It fills in as you are tested on it. Click a box to see only its questions.',
  codeFile: 'search/searchAgents.py', selfCheck: cornersSelfCheck, engine: cornersEngine(),
  minPerPart: 2, groups, parts, questions: QUICK ? questions.filter((q) => CORE.indexOf(q.id) >= 0) : questions
};
