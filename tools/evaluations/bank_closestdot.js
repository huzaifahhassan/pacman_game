// Q8: ClosestDotSearchAgent and AnyFoodSearchProblem. The food engine (food_engine.js) is placed in front of this file by build_eval.py.
// Every answer key comes from that engine, which build_eval.py checked against your real agent on 19 mazes: the first path, what depthFirstSearch
// would return, the goal test on every cell, the total cost (mediumSearch 171, bigSearch 350) and the order the dots are eaten.

// ---------------------------------------------------------------- helpers for this bank
const dotObjs = (list) => list.map((d) => ({ x: d[0], y: d[1], r: 0.2 }));
const foodSetOf = (gr) => new Set(gr.dots.map((d) => cid(d[0], d[1])));
const nearestList = (gr, pos, cells) => cells.map((d) => ({ d, w: wdist(gr, pos, d), m: man(pos, d) }));
const minOf = (list, key) => Math.min.apply(null, list.map((x) => x[key]));
function noTies(gr) {                                          // does the agent have one clear nearest dot at every step?
  let pos = gr.start.slice(); const left = gr.dots.slice();
  while (left.length) {
    const l = nearestList(gr, pos, left), mw = minOf(l, 'w'); if (l.filter((x) => x.w === mw).length !== 1) return false;
    const t = l.find((x) => x.w === mw).d; pos = t; left.splice(left.findIndex((d) => d[0] === t[0] && d[1] === t[1]), 1);
  }
  return true;
}
const HDESC = { pair: 'the exact optimum, found with A* and a strong heuristic' };

// ---------------------------------------------------------------- the map
const parts = [
  { id: 'any', group: 'problem', label: 'AnyFoodSearchProblem: a position', review: 'The state is only Pacman\'s position. The food does not change during one search, so the goal test can read it from a fixed grid.' },
  { id: 'goal', group: 'problem', label: 'isGoalState: any dot', review: 'A cell is a goal when it holds a dot: return self.food[x][y]. There are as many goals as there are dots.' },
  { id: 'food', group: 'problem', label: 'The food grid of this problem', review: 'self.food is the food grid of the game state the problem was built from. Moving Pacman makes a new game state with its own grid, so this one never changes.' },
  { id: 'inherit', group: 'problem', label: 'What it inherits', review: 'AnyFoodSearchProblem gets getStartState, getSuccessors and getCostOfActions from PositionSearchProblem. Only the goal test is replaced.' },
  { id: 'ucs', group: 'find', label: 'Why uniform cost search', review: 'Every step costs 1, so uniform cost search expands cells in order of distance and the first goal it pops is a closest dot.' },
  { id: 'shortest', group: 'find', label: 'A shortest path to the nearest dot', review: 'The path returned is a shortest path to a nearest dot. If two dots tie, the one reached first in the order North, South, East, West wins.' },
  { id: 'choice', group: 'find', label: 'Why not DFS or your BFS', review: 'DFS returns a path to some dot, often a long one. Your BFS finds a shortest path too but prints debug lines on every step.' },
  { id: 'loop', group: 'agent', label: 'The loop in registerInitialState', review: 'Find a path to the closest dot, walk it (which eats the dot), then search again, until no food is left.' },
  { id: 'fresh', group: 'agent', label: 'A new problem for every search', review: 'A new AnyFoodSearchProblem is built from the current game state each time, because the food and Pacman\'s position have changed.' },
  { id: 'cost', group: 'agent', label: 'The total path cost', review: '"Path found with cost N" is the number of actions in all the segments together.' },
  { id: 'greedy', group: 'greedy', label: 'Closest-dot-first is not always best', review: 'Always walking to the nearest dot is a greedy choice. It can leave stragglers far apart, so the total can be larger than the optimum.' },
  { id: 'compare', group: 'greedy', label: 'Compared with the optimal plan', review: 'The truly optimal eat-everything plan needs the food in the state: FoodSearchProblem with A* and a good heuristic (Q7).' },
  { id: 'grader', group: 'greedy', label: 'What the autograder checks', review: 'ClosestDotTest compares only the length of the first path with the length of a shortest path, so any shortest path to any closest dot passes.' }
];
const groups = [{ id: 'problem', label: 'The problem you define', arrow: true }, { id: 'find', label: 'Finding the closest dot', arrow: true }, { id: 'agent', label: 'The agent that repeats it', arrow: true }, { id: 'greedy', label: 'How good is it?', arrow: false }];

// ---------------------------------------------------------------- the questions
const questions = [
  { id: 'd-steps', title: 'One round of the agent, in order', parts: ['loop', 'fresh', 'cost'], level: 1,
    gen: () => ({ type: 'order',
      prompt: 'These are the things <code>ClosestDotSearchAgent.registerInitialState</code> does, shuffled. Click them in the order they happen.',
      items: [
        'The loop starts: ' + C('while(currentState.getFood().count() > 0)') + ' says there are still dots to eat.',
        'It calls ' + C('self.findPathToClosestDot(currentState)') + ' and gets a list of actions to the closest dot.',
        'The segment is added to the plan: ' + C('self.actions += nextPathSegment') + '.',
        'For each action it checks that the move is legal, and raises an Exception if it is not.',
        'It applies the action to the game state with ' + C('generateSuccessor(0, action)') + ', which eats the dot at the end of the segment.',
        'The loop condition is checked again on the new food grid. When no food is left the loop ends.',
        'It prints ' + C('Path found with cost') + ' with the total number of actions.'],
      hints: ['The search happens before any move is made.', 'The printed cost can only be known when the loop is over.'],
      explain: 'In the code: the loop is line ' + lineOf('r_while') + ', the search call line ' + lineOf('r_find') + ', the plan grows on line ' + lineOf('r_add') + ', the legality check is line ' + lineOf('r_ill') + ', the move is line ' + lineOf('r_move') + ' and the cost is printed on line ' + lineOf('r_print') + '. Your part is the call on line ' + lineOf('find_ret') + ' and the goal test on line ' + lineOf('g_ret') + '.' }) },

  { id: 'd-any-state', title: 'What is the state here?', parts: ['any', 'inherit'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Q7\'s <code>FoodSearchProblem</code> had states <code>(position, foodGrid)</code>. What is a state of <b><code>AnyFoodSearchProblem</code></b>?',
      options: [O('Only Pacman\'s position, a pair (x, y), exactly like in PositionSearchProblem', true, 'The problem inherits its state, successors and costs from PositionSearchProblem. Only the goal test is new.'),
        O('The same (position, foodGrid) pair as in Q7', false, 'This problem does not track the food as it changes; it looks at one fixed grid.'),
        O('A list of the dots still to eat', false, 'The dots are read from self.food, they are not part of the state.'),
        O('The path walked so far', false, 'The path is kept by the search, not by the state.')],
      hints: ['Look at the first line of isGoalState: what does it take apart?'], explain: 'Line ' + lineOf('g_xy') + ' takes the state apart into just x and y.' }) },

  { id: 'd-goal-click', title: 'Which cells are goals?', parts: ['goal', 'food'], level: 1,
    gen: (r) => { const gr = fRandMaze(r, { dots: r.int(4, 6), walls: r.int(3, 6) }), k = r.int(0, gr.dots.length - 1), e = gr.dots[k], present = gr.dots.filter((d, i) => i !== k);
      return { type: 'cells', pick: 'nodes', grid: gr, cs: 24, label: 'Maze', answer: present.map((d) => cid(d[0], d[1])),
        drawOpts: () => ({ hidePellet: true, pac: e, dots: dotObjs(present) }),
        prompt: 'Pacman has just eaten the dot he is standing on. The agent now builds a <b>new</b> <code>AnyFoodSearchProblem</code> from this game state. <b>Click every cell where its <code>isGoalState</code> returns True.</b>',
        visual: (el) => { el.innerHTML = codeHTML({ mark: ['g_ret'] }); },
        hints: ['Your goal test reads the food grid of the game state it was built from.'],
        explain: 'The goals are the ' + present.length + ' dots still on the board. The cell ' + ptS(e[0], e[1]) + ' held the dot Pacman just ate, so it is no longer a goal: that is why the next search never returns an empty path.' }; } },

  { id: 'd-goal-bug', title: 'A goal test copied from Q7', parts: ['goal', 'food', 'loop'], level: 3,
    gen: () => ({ type: 'mc',
      prompt: 'A classmate reuses the goal test of the food problem: <code>return self.food.count() == 0</code> (shown). <b>What happens when the agent runs?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ replace: { g_ret: 'return self.food.count() == 0' } }); },
      options: [O('The goal is never True during a search (the food grid does not change while searching), so UCS explores the whole maze, finds nothing and returns an empty path; the agent then keeps asking forever', true, 'In this problem the state is only a position, so nothing in the search can ever eat a dot.'),
        O('It still finds the closest dot', false, 'The test no longer mentions dots at specific cells.'),
        O('It finds a path that eats every dot at once', false, 'That would need the food in the state, as in Q7.'),
        O('It raises an error', false, 'It runs; it just never succeeds.')],
      hints: ['During one search, can self.food ever become empty?'], explain: 'An empty path leaves the game state unchanged, so the loop on line ' + lineOf('r_while') + ' sees the same food again and never ends.' }) },

  { id: 'd-food-frozen', title: 'Does self.food change while searching?', parts: ['food', 'any'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'During ONE call of <code>findPathToClosestDot</code> the search imagines Pacman walking over many cells, some of them dots. <b>Does <code>self.food</code> change while it searches?</b>',
      options: [O('No. It is the food grid of the game state the problem was built from; imagined moves do not touch it, and the real agent makes a NEW game state (with its own grid) each time it moves', true, 'So the goal test gives the same answer for a cell throughout one search.'),
        O('Yes, each dot is erased as the search passes over it', false, 'The state of this problem is only a position; the search never edits the grid.'),
        O('Yes, but only for the dot that is found', false, 'Nothing is erased during a search.'),
        O('It is rebuilt from scratch for every cell the search expands', false, 'It is created once, in the constructor.')],
      hints: ['What is in the state of this problem?'], explain: 'This is why a plain position is enough as a state here, and why a new problem is needed after each real move.' }) },

  { id: 'd-inherit', title: 'What comes from PositionSearchProblem?', parts: ['inherit', 'any'], level: 2,
    gen: () => ({ type: 'multi',
      prompt: '<code>class AnyFoodSearchProblem(PositionSearchProblem)</code> writes only an <code>__init__</code> and <code>isGoalState</code>. <b>Tick everything it gets without any extra code.</b>',
      options: [O(C('getStartState') + ': returns the starting position', true, 'Set by __init__ as self.startState.'),
        O(C('getSuccessors') + ': the legal moves North, South, East, West, each with step cost from ' + C('costFn'), true, 'Walls are checked there, and ' + C('costFn') + ' is set to 1 in __init__.'),
        O(C('getCostOfActions') + ': the cost of a list of moves', true, 'It is inherited too.'),
        O(C('isGoalState') + ' as written in PositionSearchProblem', false, 'The inherited version compares with one fixed goal cell. This class replaces it.'),
        O('A food grid inside the state', false, 'The state is only a position.'),
        O('A heuristic', false, 'Heuristics are separate functions, passed to A*.')],
      hints: ['Which methods does the class define itself?'], explain: 'That is why the whole problem definition is one goal test.' }) },

  { id: 'd-nearest-click', title: 'Which dot will it walk to?', parts: ['ucs', 'shortest'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: 4, walls: r.int(4, 7) }), l = nearestList(gr, gr.start, gr.dots); return { gr, l, mw: minOf(l, 'w'), mm: minOf(l, 'm') }; },
        (x) => x.l.filter((v) => v.w === x.mw).length === 1 && x.l.filter((v) => v.m === x.mm).length === 1 && x.l.find((v) => v.w === x.mw).m !== x.mm, 150), gr = pick.gr, near = pick.l.find((v) => v.w === pick.mw);
      return { type: 'cells', pick: 'nodes', max: 1, grid: gr, cs: 24, label: 'Maze', answer: [cid(near.d[0], near.d[1])],
        drawOpts: () => ({ hidePellet: true, pac: gr.start, dots: dotObjs(gr.dots) }),
        prompt: 'The agent starts a search from Pacman\'s cell. <b>Click the dot that <code>findPathToClosestDot</code> will walk to.</b> (Closest means fewest steps around the walls.)',
        hints: ['Count real steps around the walls, not the straight-line gap.'],
        explain: pick.l.map((x) => ptS(x.d[0], x.d[1]) + ': walk ' + x.w + ', Manhattan ' + x.m).join('; ') + '. The closest by walking is ' + ptS(near.d[0], near.d[1]) + '.' }; } },

  { id: 'd-ties', title: 'Two dots at the same distance', parts: ['shortest', 'ucs', 'grader'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: r.int(4, 5), walls: r.int(2, 5) }), l = nearestList(gr, gr.start, gr.dots), mw = minOf(l, 'w'); return { gr, l, mw, tied: l.filter((v) => v.w === mw) }; }, (x) => x.tied.length === 2, 200), gr = pick.gr, res = anyFoodPath(gr, gr.start, foodSetOf(gr));
      return { type: 'cells', pick: 'nodes', max: 1, grid: gr, cs: 24, label: 'Maze', answer: [cid(res.target[0], res.target[1])],
        drawOpts: () => ({ hidePellet: true, pac: gr.start, dots: dotObjs(gr.dots) }),
        prompt: 'Two dots are at the same shortest distance from Pacman. Uniform cost search expands cells in order of distance, and equal distances leave the queue in the order they were pushed (first in, first out). Successors are tried in the order <b>North, South, East, West</b>. <b>Click the dot your agent walks to.</b>',
        hints: ['Imagine the search spreading outwards one step at a time, trying North, South, East, West from each cell in turn.', 'The dot reached first in that order is the one popped first.'],
        explain: 'The agent walks ' + res.path.split('').map((a) => ({ N: 'North', S: 'South', E: 'East', W: 'West' })[a]).join(', ') + ' to ' + ptS(res.target[0], res.target[1]) + '. Note the autograder only checks the LENGTH of the path, so either tied dot would pass its test.' }; } },

  { id: 'd-why-ucs', title: 'Why uniform cost search finds the closest dot', parts: ['ucs', 'shortest'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Line ' + lineOf('find_ret') + ' is <code>return search.uniformCostSearch(problem)</code>. <b>Why does that return a path to the closest dot?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['f_problem', 'find_ret'] }); },
      options: [O('Every step costs 1, so UCS expands cells in order of distance from Pacman, and it stops at the first goal it pops: a dot no other dot is closer than', true, 'The first goal popped has the smallest cost of any goal.'),
        O('UCS looks at all the dots first and picks the nearest', false, 'It knows nothing about the dots until it reaches one.'),
        O('UCS always returns the path with the most dots on it', false, 'It does not count dots.'),
        O('Because the problem is built from the start state', false, 'Where the search starts does not make it return the closest goal.')],
      hints: ['What does UCS pop first: the cheapest or the most recent?'], explain: 'With all step costs equal, UCS and BFS behave the same.' }) },

  { id: 'd-choice-dfs', title: 'What if it used DFS?', parts: ['choice', 'shortest'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { W: r.int(8, 11), H: r.int(6, 8), dots: r.int(3, 5), walls: r.int(2, 5) }), food = foodSetOf(gr); return { gr, ucs: anyFoodPath(gr, gr.start, food), dfs: anyFoodDFS(gr, gr.start, food) }; }, (x) => x.dfs.path.length - x.ucs.path.length >= 3, 150), gr = pick.gr;
      return { type: 'mc', demoTitle: 'The same search, two algorithms',
        prompt: 'A classmate leaves the default <b>depth-first search</b> in <code>findPathToClosestDot</code>. <b>What does the agent do?</b>',
        options: [O('It still reaches a dot, but not necessarily the closest one, and the path can be much longer than a shortest path', true, 'DFS goes deep first and takes the first dot it happens upon.'),
          O('It finds the closest dot, because any search stops at the first goal', false, 'The first goal DFS reaches is not the nearest one.'),
          O('It never finds a dot', false, 'DFS is complete on a finite maze: it finds some dot.'),
          O('It returns an illegal path', false, 'The path is legal, only long.')],
        hints: ['DFS follows one branch as far as it can before trying another.'],
        demo: (el) => demoPair(el, [{ title: 'Uniform cost search', gr, opts: { path: pick.ucs.path }, ok: true, text: stepsWord(pick.ucs.path.length) + ' to the closest dot' }, { title: 'Depth-first search', gr, opts: { path: pick.dfs.path }, ok: false, text: stepsWord(pick.dfs.path.length) + ' to a dot' }]),
        explain: 'Both end on a dot. Only uniform cost search (or BFS) guarantees the closest one.' }; } },

  { id: 'd-choice-bfs', title: 'Why UCS and not your BFS?', parts: ['choice', 'ucs'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Your own <code>breadthFirstSearch</code> would also find a shortest path here. Why is <code>uniformCostSearch</code> the better choice for this agent?',
      options: [O('Your BFS prints debug lines on every step, and this agent runs a new search for every dot, so the console would be flooded; UCS is silent and returns a path of the same length', true, 'The agent may search more than a hundred times on a big maze.'),
        O('BFS cannot be used when the problem has no heuristic', false, 'BFS never needs a heuristic.'),
        O('BFS returns a longer path than UCS', false, 'With all steps costing 1 they return paths of the same length.'),
        O('UCS finds the dot with the most food nearby', false, 'It only looks at distance.')],
      hints: ['How many times does the agent call the search on bigSearch?'], explain: 'On bigSearch the agent searches once for each of its 221 dots.' }) },

  { id: 'd-start-spot', title: 'Where does the next search start?', parts: ['loop', 'goal'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'After a segment, Pacman stands on the cell where he just ate a dot, and the agent searches again from there. <b>Why can <code>findPathToClosestDot</code> never return an empty path in that situation?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['r_move', 'g_ret'] }); },
      options: [O('The dot under Pacman has been eaten, so his own cell is not a goal in the new problem; the nearest goal is at least one step away', true, 'The new problem is built from the new game state, whose food grid no longer has that dot.'),
        O('The search skips the start state on purpose', false, 'UCS does test the start state; it simply is not a goal here.'),
        O('Because UCS cannot return an empty list', false, 'It returns an empty list when the start is a goal.'),
        O('Because the agent adds one extra step to every segment', false, 'No extra steps are added.')],
      hints: ['Which food grid does the new problem read?'], explain: 'If the start cell WERE a goal, UCS would return an empty path and the loop on line ' + lineOf('r_while') + ' would never end.' }) },

  { id: 'd-fresh', title: 'A new problem each time', parts: ['fresh', 'food'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Line ' + lineOf('f_problem') + ' builds a <b>new</b> <code>AnyFoodSearchProblem(gameState)</code> on every call. <b>Why not build it once and reuse it?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['f_problem'] }); },
      options: [O('The problem stores the food grid and Pacman\'s position from the moment it is built; after the agent moves and eats a dot both are out of date, so a fresh problem is needed', true, 'Each search must start from the current game state.'),
        O('Because a problem object can only be used for one expansion', false, 'It can be expanded many times.'),
        O('To reset the number of expanded nodes for the autograder', false, 'That is a side effect, not the reason.'),
        O('Because Python deletes objects after a function returns', false, 'It does not matter; the point is the stale data.')],
      hints: ['What does the constructor copy from the game state?'], explain: 'The food and the start position are taken in __init__, so the problem cannot see later changes.' }) },

  { id: 'd-trace', title: 'In which order are the dots eaten?', parts: ['loop', 'greedy', 'shortest'], level: 3,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: r.int(4, 5), walls: r.int(3, 6) }); return { gr, run: agentRun(gr) }; }, (x) => noTies(x.gr), 200), gr = pick.gr, order = pick.run.order;
      return { type: 'cells', pick: 'seq', max: order.length, grid: gr, cs: 24, label: 'Maze', answer: order.map((p) => cid(p[0], p[1])),
        drawOpts: () => ({ hidePellet: true, pac: gr.start, dots: dotObjs(gr.dots) }),
        prompt: 'The agent always walks to the dot that is closest <b>from where it stands now</b>, eats it, then searches again. <b>Click the dots in the order the agent eats them.</b> (At every step there is one clear nearest dot.)',
        hints: ['Start from Pacman: which dot is nearest by walking? Then forget Pacman\'s old place and measure from that dot.'],
        explain: 'The agent eats ' + order.map((p) => ptS(p[0], p[1])).join(', then ') + ' and walks ' + pick.run.total + ' steps in all.' }; } },

  { id: 'd-cost-numeric', title: 'What cost will it print?', parts: ['cost', 'loop', 'greedy'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: r.int(3, 4), walls: r.int(2, 5) }); return { gr, run: agentRun(gr) }; }, (x) => noTies(x.gr), 200), gr = pick.gr;
      return { type: 'numeric', answer: pick.run.total, tol: 0, unit: 'steps',
        prompt: 'The agent runs on this maze, always eating the closest dot first. <b>What number will <code>Path found with cost N.</code> print?</b>',
        visual: (el) => fBoard(el, gr, {}, ''),
        hints: ['Add up the lengths of the segments: Pacman to the first dot, then to the next closest, and so on.'],
        explain: 'Segments: ' + pick.run.segs.map((s) => s.path.length).join(' + ') + ' = ' + pick.run.total + '.' }; } },

  { id: 'd-cost-print', title: 'What does "cost" count?', parts: ['cost'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'The agent prints <code>Path found with cost 350.</code> on <code>bigSearch</code>. <b>What is 350?</b>',
      visual: (el) => { el.innerHTML = codeHTML({ mark: ['r_add', 'r_print'] }); },
      options: [O('The total number of actions in all the segments together: ' + C('len(self.actions)'), true, 'Each segment is a shortest walk to the next dot; the plan is all of them in a row.'),
        O('The number of dots eaten', false, 'bigSearch has 221 dots.'),
        O('The number of search nodes expanded', false, 'Expansions are counted by the problems, not printed here.'),
        O('The length of the longest single segment', false, 'It is the sum, not the maximum.')],
      hints: ['What is the list self.actions?'], explain: 'Line ' + lineOf('r_print') + ' prints the length of the whole plan.' }) },

  { id: 'd-greedy-opt', title: 'Is closest-first the cheapest?', parts: ['greedy', 'compare'], level: 2,
    gen: (r) => { const pick = find(r, () => { const gr = fRandMaze(r, { dots: r.int(4, 6), walls: r.int(3, 7) }); return { gr, run: agentRun(gr), opt: fAStar(gr, FH.pair.f) }; }, (x) => x.run.total > x.opt.cost, 150), gr = pick.gr;
      return { type: 'mc', demoTitle: 'Two plans for the same maze',
        prompt: 'A classmate says: "Eating the closest dot each time must give the cheapest way to eat everything." <b>Is that right?</b> (On this maze the agent walks <b>' + pick.run.total + '</b> steps.)',
        visual: (el) => fBoard(el, gr, {}, 'The maze'),
        options: [O('No. A choice that is best right now can leave dots far apart for later; a cheaper plan exists (' + pick.opt.cost + ' steps here)', true, 'Closest-first is a greedy rule: it never looks ahead.'),
          O('Yes: every segment is a shortest path, so the total is shortest', false, 'Each segment is shortest, the sum of segments is not necessarily.'),
          O('Yes, as long as there are no ties', false, 'It can be suboptimal even with no ties at all.'),
          O('No, but only because the autograder counts differently', false, 'It is about the plan itself.')],
        hints: ['Compare the greedy route with a plan that thinks about the whole tour.'],
        demo: (el) => demoPair(el, [{ title: 'Closest dot first (your agent)', gr, opts: { path: pick.run.actions }, ok: false, text: stepsWord(pick.run.total) }, { title: 'The cheapest way to eat everything', gr, opts: { path: pick.opt.path }, ok: true, text: stepsWord(pick.opt.cost) }]),
        explain: 'The assignment calls the agent "suboptimal": it is fast, but it does not search over all the food at once.' }; } },

  { id: 'd-greedy-always', title: 'Does greedy ever work?', parts: ['greedy'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'Which statement about "always go to the closest dot" is true?',
      options: [O('It is optimal on some mazes (for example dots lined up in a row from where Pacman starts) but nothing guarantees it, and on others it costs more than the best plan', true, 'It is a rule of thumb, not an algorithm with a guarantee.'),
        O('It is optimal on every maze', false, 'There are mazes where it is clearly worse.'),
        O('It is never optimal', false, 'Sometimes the greedy order happens to be the best order.'),
        O('It is optimal whenever each step costs 1', false, 'Unit costs make each SEGMENT shortest, not the whole tour.')],
      hints: ['Think of one example where it works and one where it does not.'], explain: 'That is why the assignment asks you to compare it with the optimal search from Q7.' }) },

  { id: 'd-why-q7', title: 'How to find the cheapest plan', parts: ['compare', 'any'], level: 2,
    gen: () => ({ type: 'mc',
      prompt: 'Which formulation can find the <b>truly cheapest</b> plan that eats all the dots?',
      options: [O('FoodSearchProblem solved by A* with a good heuristic (Q7): its state holds the food grid, so the search can plan the whole tour', true, 'The state must remember which dots are eaten.'),
        O('AnyFoodSearchProblem solved by A* with a better heuristic', false, 'Its state is only a position: it cannot remember what has been eaten, and its goal is just any dot.'),
        O('AnyFoodSearchProblem solved by BFS, repeated until the food is gone', false, 'That is exactly the closest-dot agent.'),
        O('Running UCS twice on the same problem', false, 'It would return the same path.')],
      hints: ['What must the state remember so the search can plan across dots?'], explain: 'Q7 gives the search the whole picture; Q8 trades optimality for speed.' }) },

  { id: 'd-grader', title: 'What does the autograder check?', parts: ['grader', 'shortest'], level: 1,
    gen: () => ({ type: 'mc',
      prompt: 'The autograder\'s <code>ClosestDotTest</code> calls <code>findPathToClosestDot</code> on a starting game state. <b>What does it compare?</b>',
      options: [O('Only the LENGTH of the returned path with the length of a shortest path to the closest dot', true, 'So any shortest path to any closest dot passes, and a path to a farther dot fails.'),
        O('The exact list of actions with a stored list', false, 'Ties could then fail a correct answer; only the length is compared.'),
        O('The total cost printed by the whole agent', false, 'That is not what the test calls.'),
        O('Whether all the food is eaten at the end', false, 'The test only looks at the first segment.')],
      hints: ['Which of these would punish a correct answer when two dots tie?'], explain: 'The test has 13 mazes and all of them must pass for the 3 points.' }) }
];

return {
  algo: 'closestdot', func: 'ClosestDotSearchAgent', title: 'Closest Dot Evaluation', subtitle: 'A teacher\'s check: do you really know how your closest-dot agent works?',
  welcomeTitle: 'Let\'s see what you really know about the closest-dot agent',
  intro: '<p class="prompt">The autograder checks the length of one path. It does not check that you know <b>why</b> a goal test on a position is enough, why uniform cost search returns the closest dot, how the agent repeats the search, or why the result can be more expensive than the best plan. I will test all of that, using <b>your own code</b> and a model of the agent that was checked against your real one on 19 mazes.</p>',
  handsOn: '<li>You do things by hand: click the goal cells, pick the dot the agent walks to, break ties, trace the order the dots are eaten, work out the total cost and spot what a wrong copy of your code does.</li>',
  mapTitle: 'Map of the closest-dot agent', mapNote: 'Every box is a part of the agent: the problem you define, how the closest dot is found, the loop around it and how good the result is. It fills in as you are tested on it. Click a box to see only its questions.',
  codeFile: 'search/searchAgents.py', selfCheck: closestSelfCheck, engine: foodEngine(),
  minPerPart: 2, groups, parts, questions
};
