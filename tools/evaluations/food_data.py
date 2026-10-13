"""
The Python side of the two Food evaluations (Q7 foodHeuristic, Q8 ClosestDotSearchAgent). Used by build_eval.py.

  * reads the lines of YOUR walkingDistances / foodHeuristic (Q7) and ClosestDotSearchAgent / AnyFoodSearchProblem (Q8) from
    search/searchAgents.py, with a role for each line, so the "read your own code" questions can point at them;
  * runs YOUR real code on many mazes and records what it does. The page re-runs its JavaScript engine on the same mazes
    and shows whether the two agree.
      Q7: the heuristic value at many states, A* cost and expansions (your aStarSearch + your foodHeuristic), h = 0 expansions.
      Q8: the first path to the closest dot, the goal test on every cell, the whole agent's total cost and order of eating.

Nothing in search/ is modified. Standard library only.
"""
import contextlib
import datetime
import json
import os
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import corners_data as cd                                   # noqa: E402  (read_lines, strip_comment, the quiet stdout trick)

FOOD_PATTERNS = [
    (r"^def walkingDistances\(source, walls\):$", "def_walk"),
    (r"^distances = \{source: 0\}$", "w_init"),
    (r"^queue = util\.Queue\(\)$", "w_queue"),
    (r"^queue\.push\(source\)$", "w_pushsrc"),
    (r"^while not queue\.isEmpty\(\):$", "w_while"),
    (r"^x, y = queue\.pop\(\)$", "w_pop"),
    (r"^for dx, dy in \[\(0, 1\), \(0, -1\), \(1, 0\), \(-1, 0\)\]:$", "w_for"),
    (r"^neighbour = \(x \+ dx, y \+ dy\)$", "w_nb"),
    (r"^if not walls\[neighbour\[0\]\]\[neighbour\[1\]\] and neighbour not in distances:$", "w_if"),
    (r"^distances\[neighbour\] = distances\[\(x, y\)\] \+ 1$", "w_set"),
    (r"^queue\.push\(neighbour\)$", "w_push"),
    (r"^return distances$", "w_return"),
    (r"^def foodHeuristic\(.*\):$", "def_food"),
    (r"^position, foodGrid = state$", "h_unpack"),
    (r"^food = foodGrid\.asList\(\)$", "h_food"),
    (r"^if len\(food\) == 0:$", "h_goal_if"),
    (r"^return 0$", "h_goal_ret"),
    (r"^farthest = 0$", "h_init"),
    (r"^for dot in food:$", "h_for"),
    (r"^if dot not in problem\.heuristicInfo:$", "h_cache_if"),
    (r"^problem\.heuristicInfo\[dot\] = walkingDistances\(dot, problem\.walls\)$", "h_cache_set"),
    (r"^farthest = max\(farthest, problem\.heuristicInfo\[dot\]\[position\]\)$", "h_max"),
    (r"^return farthest$", "h_return"),
]
CLOSEST_PATTERNS = [
    (r"^def registerInitialState\(self, state\):$", "def_reg"),
    (r"^self\.actions = \[\]$", "r_init"),
    (r"^currentState = state$", "r_cur"),
    (r"^while\(currentState\.getFood\(\)\.count\(\) > 0\):$", "r_while"),
    (r"^nextPathSegment = self\.findPathToClosestDot\(currentState\).*$", "r_find"),
    (r"^self\.actions \+= nextPathSegment$", "r_add"),
    (r"^for action in nextPathSegment:$", "r_for"),
    (r"^legal = currentState\.getLegalActions\(\)$", "r_legal"),
    (r"^if action not in legal:$", "r_ill"),
    (r"^t = \(str\(action\), str\(currentState\)\)$", "r_t"),
    (r"^raise Exception\(.*\)$", "r_raise"),
    (r"^currentState = currentState\.generateSuccessor\(0, action\)$", "r_move"),
    (r"^self\.actionIndex = 0$", "r_idx"),
    (r"^print\('Path found with cost %d\.' % len\(self\.actions\)\)$", "r_print"),
    (r"^def findPathToClosestDot\(self, gameState.*\):$", "def_find"),
    (r"^startPosition = gameState\.getPacmanPosition\(\)$", "f_start"),
    (r"^food = gameState\.getFood\(\)$", "f_food"),
    (r"^walls = gameState\.getWalls\(\)$", "f_walls"),
    (r"^problem = AnyFoodSearchProblem\(gameState\)$", "f_problem"),
    (r"^return search\.uniformCostSearch\(problem\)$", "find_ret"),
    (r"^def isGoalState\(self, state.*\):$", "def_goal"),
    (r"^x, ?y ?= state$", "g_xy"),
    (r"^return self\.food\[x\]\[y\]$", "g_ret"),
]


def method_lines(src, cls, name, patterns):
    """The code lines of one method of a class in searchAgents.py (def line included, indentation reduced by 4)."""
    c = next(i for i, l in enumerate(src, 1) if l.startswith("class " + cls))
    end = next((i for i, l in enumerate(src, 1) if i > c and l and not l[0].isspace() and not l.startswith("#")), len(src) + 1) - 1
    d = next(i for i, l in enumerate(src, 1) if c < i <= end and l.startswith("    def " + name))
    e = next((i for i, l in enumerate(src, 1) if i > d and (l.startswith("    def ") or (l and not l[0].isspace()))), end + 1) - 1
    return cd.read_lines(src, d, e, patterns, 4)


def function_lines(src, name, patterns):
    d = next(i for i, l in enumerate(src, 1) if l.startswith("def " + name))
    e = next((i for i, l in enumerate(src, 1) if i > d and l and not l[0].isspace()), len(src) + 1) - 1
    return cd.read_lines(src, d, e, patterns, 0)


def code_for(src, func):
    if func == "foodHeuristic":
        return function_lines(src, "walkingDistances", FOOD_PATTERNS) + function_lines(src, "foodHeuristic", FOOD_PATTERNS)
    return (method_lines(src, "ClosestDotSearchAgent", "registerInitialState", CLOSEST_PATTERNS)
            + method_lines(src, "ClosestDotSearchAgent", "findPathToClosestDot", CLOSEST_PATTERNS)
            + method_lines(src, "AnyFoodSearchProblem", "isGoalState", CLOSEST_PATTERNS))


# ---------------------------------------------------------------- random mazes
def rand_food_maze(rng, W=None, H=None, nfood=None, nwalls=None, dots_max=5):
    """A random connected walled maze with Pacman and some dots, as rows of the .lay format."""
    while True:
        W_, H_ = W or rng.randint(5, 8), H or rng.randint(5, 7)
        g = [["%" if x in (0, W_ - 1) or r in (0, H_ - 1) else " " for x in range(W_)] for r in range(H_)]
        for _ in range(rng.randint(0, 5) if nwalls is None else nwalls):
            g[rng.randint(1, H_ - 2)][rng.randint(1, W_ - 2)] = "%"
        cells = [(x, r) for r in range(1, H_ - 1) for x in range(1, W_ - 1) if g[r][x] == " "]
        if len(cells) < 3:
            continue
        seen, todo = {cells[0]}, [cells[0]]
        while todo:
            x, r = todo.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = (x + dx, r + dy)
                if g[nb[1]][nb[0]] != "%" and nb not in seen:
                    seen.add(nb)
                    todo.append(nb)
        if len(seen) != len(cells):
            continue
        n = min(rng.randint(1, dots_max) if nfood is None else nfood, len(cells) - 2)
        pick = rng.sample(cells, n + 1)
        g[pick[0][1]][pick[0][0]] = "P"
        for x, r in pick[1:]:
            g[r][x] = "."
        return ["".join(row) for row in g]


def lay_rows(search_dir, name):
    return [l.rstrip("\r\n") for l in (search_dir / "layouts" / (name + ".lay")).read_text(encoding="utf8").splitlines() if l.strip()]


_GOLDEN = {}


def _modules(search_dir):
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    import game                                            # noqa: E401
    import layout                                          # noqa: E401
    import pacman                                          # noqa: E401
    import search                                          # noqa: E401
    import searchAgents                                    # noqa: E401
    return game, layout, pacman, search, searchAgents


class Null:
    def write(self, s): return len(s)
    def flush(self): pass


def quiet(fn, *a):
    with contextlib.redirect_stdout(Null()):
        return fn(*a)


def golden_food(search_dir):
    """Q7: run YOUR foodHeuristic inside YOUR aStarSearch on trickySearch and on random small mazes."""
    key = ("food", str(search_dir))
    if key in _GOLDEN:
        return _GOLDEN[key]
    game, layout, pacman, search, SA = _modules(search_dir)

    def state_of(rows):
        gs = pacman.GameState()
        gs.initialize(layout.Layout(list(rows)), 0)
        return gs

    def grid(gs, dots):
        g = game.Grid(gs.getWalls().width, gs.getWalls().height, False)
        for x, y in dots:
            g[x][y] = True
        return g

    rng = random.Random(81)
    mazes = [("trickySearch", lay_rows(search_dir, "trickySearch"))] + [("random %d" % (k + 1), rand_food_maze(rng)) for k in range(14)]
    out = []
    for name, rows in mazes:
        gs = state_of(rows)
        p = quiet(SA.FoodSearchProblem, gs)
        start = p.getStartState()
        pa = SA.FoodSearchProblem(gs)
        path = quiet(search.aStarSearch, pa, SA.foodHeuristic)
        pu = SA.FoodSearchProblem(gs)
        quiet(search.aStarSearch, pu, search.nullHeuristic)
        item = {"name": name, "rows": rows, "astar": {"cost": len(path), "expanded": pa._expanded}, "ucs": {"expanded": pu._expanded}}
        samples, nreach = [], None
        if name != "trickySearch":                                  # small mazes: every reachable state is known
            e = SA.FoodSearchProblem(gs)
            seen, todo = {start}, [start]
            while todo:
                for t, _, _ in e.getSuccessors(todo.pop()):
                    if t not in seen:
                        seen.add(t)
                        todo.append(t)
            nreach = len(seen)
            pool = list(seen)
            rng.shuffle(pool)
            picks = pool[:30] + [start]
        else:                                                       # trickySearch: the states along the optimal plan
            picks, cur = [start], start
            for a in path:
                cur = next(t for t, act, _ in SA.FoodSearchProblem(gs).getSuccessors(cur) if act == a)
                picks.append(cur)
        for pos, food in picks:
            samples.append({"pos": list(pos), "dots": [list(d) for d in food.asList()], "h": SA.foodHeuristic((pos, food), p)})
        item["nreach"], item["samples"] = nreach, samples
        out.append(item)
        print("   golden %-14s a* %6d expanded (h=0: %6d), cost %d" % (name, pa._expanded, pu._expanded, len(path)))
    _GOLDEN[key] = out
    return out


def golden_closest(search_dir):
    """Q8: run YOUR ClosestDotSearchAgent on provided and random mazes."""
    key = ("closest", str(search_dir))
    if key in _GOLDEN:
        return _GOLDEN[key]
    game, layout, pacman, search, SA = _modules(search_dir)
    rng = random.Random(83)
    mazes = [(n, lay_rows(search_dir, n)) for n in ("testSearch", "tinySearch", "smallSearch", "mediumSearch", "bigSearch")]
    mazes += [("random %d" % (k + 1), rand_food_maze(rng, nfood=rng.randint(2, 7), dots_max=8)) for k in range(14)]
    out = []
    for name, rows in mazes:
        gs = pacman.GameState()
        gs.initialize(layout.Layout(list(rows)), 0)
        agent = quiet(SA.ClosestDotSearchAgent)
        first = quiet(agent.findPathToClosestDot, gs)
        dfs = quiet(search.depthFirstSearch, SA.AnyFoodSearchProblem(gs))          # what your DFS would do on the same problem
        prob = SA.AnyFoodSearchProblem(gs)
        W, H = gs.getWalls().width, gs.getWalls().height
        goals = [[x, y] for x in range(W) for y in range(H) if not gs.getWalls()[x][y] and prob.isGoalState((x, y))]
        agent2 = quiet(SA.ClosestDotSearchAgent)
        quiet(agent2.registerInitialState, gs)
        cur, order = gs, []
        for a in agent2.actions:
            before = cur.getFood().count()
            cur = cur.generateSuccessor(0, a)
            if cur.getFood().count() < before:
                order.append(list(cur.getPacmanPosition()))
        out.append({"name": name, "rows": rows, "first": list(first), "dfs": list(dfs), "goals": goals, "total": len(agent2.actions), "order": order})
        print("   golden %-14s %3d dots, total cost %3d, first segment %d steps" % (name, len(goals), len(agent2.actions), len(first)))
    _GOLDEN[key] = out
    return out


def build_food(spec, algo, search_dir, out_dir):
    """Write one Food evaluation page. spec comes from build_eval.ALGOS."""
    search_dir = Path(search_dir).resolve()
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    src = (search_dir / "searchAgents.py").read_text(encoding="utf8").splitlines()
    code = code_for(src, spec["func"])
    unknown = [c[0] for c in code if c[2] == "other"]
    if unknown:
        print("note: %s: unrecognised line(s) %s will show as generic lines." % (spec["func"], unknown))
    lines = [{"ln": c[0], "text": c[1], "role": c[2]} for c in code]
    names = ("trickySearch", "testSearch", "tinySearch", "smallSearch", "mediumSearch", "bigSearch")
    mazes = {m: lay_rows(search_dir, m) for m in names}
    gold = golden_food(search_dir) if spec["func"] == "foodHeuristic" else golden_closest(search_dir)
    data = {"algo": algo, "code": {"lines": lines, "first": lines[0]["ln"], "last": lines[-1]["ln"], "generated": datetime.date.today().isoformat()},
            "golden": gold, "mazes": mazes}
    tpl = (HERE / "eval_template.html").read_text(encoding="utf8")
    engine = (HERE / "food_engine.js").read_text(encoding="utf8")
    bank = (HERE / spec["bank"]).read_text(encoding="utf8")
    assert "</script" not in (engine + bank).lower(), "bank must not contain a closing script tag"
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.replace("__TITLE__", spec["title"]).replace("/*__DATA__*/null", blob).replace("/*__BANK__*/", engine + "\n" + bank)
    out = Path(out_dir) / spec["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf8")
    print("%-10s -> %s  (%d KB, %d code lines, %d golden mazes)" % (algo, out, len(html.encode("utf8")) // 1024, len(lines), len(gold)))
    return out
