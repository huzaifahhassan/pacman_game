"""
Build the UCS Test Lab page from your own search/search.py.

    python tools/search_visualiser/build_lab.py
    python tools/search_visualiser/build_lab.py --out some/where.html
    python tools/search_visualiser/build_lab.py --search-dir path/to/search

It runs your real uniformCostSearch on 8 mazes x 7 step-cost models (56 cases, constant and variable
costs alike) and judges every run against an independent Dijkstra written here:

    optimal          the cost UCS found equals the true optimum
    legal            the returned actions never hit a wall and end at the goal
    cheapest first   the costs of popped heap entries never decrease
    expanded once    no state is expanded twice
    goal on pop      the goal is returned when popped, never expanded
    matches BFS      constant-cost models only: same number of expansions as your breadthFirstSearch

The result is inlined into lab_template.html. The default output is
tools/search_visualiser/out/ucs_test_lab.html (git-ignored). Nothing in search/ is modified.
Standard library only. The output contains your solution logic, so do not share or publish it.
"""
import argparse
import contextlib
import datetime
import heapq
import io
import itertools
import json
import math
import os
import sys
import time
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_SEARCH_DIR = HERE.parents[1] / "search"
INF = float("inf")
MAZES = ["tinyMaze", "smallMaze", "mediumMaze", "bigMaze", "openMaze", "contoursMaze", "mediumDottedMaze", "mediumScaryMaze"]
DIRLETTER = {"North": "N", "South": "S", "East": "E", "West": "W"}
VEC = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0)}

# step-cost models: cost of ENTERING cell (x, y), exactly like the costFn of a PositionSearchProblem
MODELS = [
    ("c1", "constant 1", "every step costs 1", lambda x, y, W, H: 1),
    ("c7", "constant 7", "every step costs 7", lambda x, y, W, H: 7),
    ("east", "east cheap", ".5^x (StayEast)", lambda x, y, W, H: .5 ** x),
    ("west", "west cheap", "2^x (StayWest)", lambda x, y, W, H: 2 ** x),
    ("band", "dear band", "25 in the middle third", lambda x, y, W, H: 25 if W // 3 <= x < 2 * W // 3 else 1),
    ("rand", "random", "1 to 7 per cell", lambda x, y, W, H: 1 + zlib.crc32(("%d,%d" % (x, y)).encode()) % 7),
    ("rows", "dear rows", "6 on even rows, else 1", lambda x, y, W, H: 6 if y % 2 == 0 else 1),
]


def num(x):
    return x if isinstance(x, int) else round(x, 9)


def close(a, b):
    return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12)


def reference(walls, start, goal, cost):
    """Independent Dijkstra. Neighbours are scanned W, E, S, N, deliberately not the student's N, S, E, W order."""
    tie = itertools.count()
    best, parent, pq = {start: 0}, {}, [(0, next(tie), start)]
    while pq:
        c, _, s = heapq.heappop(pq)
        if c > best.get(s, INF):
            continue
        if s == goal:
            break
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            n = (s[0] + dx, s[1] + dy)
            if walls[n[0]][n[1]]:
                continue
            nc = c + cost[n]
            if nc < best.get(n, INF):
                best[n], parent[n] = nc, s
                heapq.heappush(pq, (nc, next(tie), n))
    if goal not in best:
        return INF, ""
    letters, s = [], goal
    while s != start:
        p = parent[s]
        letters.append({(0, 1): "N", (0, -1): "S", (1, 0): "E", (-1, 0): "W"}[(s[0] - p[0], s[1] - p[1])])
        s = p
    return best[goal], "".join(reversed(letters))


def collect(search_dir):
    search_dir = Path(search_dir).resolve()
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    import util, layout, pacman, search, searchAgents       # noqa: E401

    def state(name):
        gs = pacman.GameState()
        gs.initialize(layout.getLayout(name), 0)
        return gs

    def quiet(fn, *a):
        real_sleep = time.sleep
        time.sleep = lambda s: None
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                return fn(*a)
        finally:
            time.sleep = real_sleep

    mazes, cases = {}, {}
    tally = {}
    for name in MAZES:
        gs = state(name)
        walls = gs.getWalls()
        W, H = walls.width, walls.height
        start, goal = gs.getPacmanPosition(), (1, 1)
        assert start != goal and not walls[goal[0]][goal[1]], "%s: unusable start/goal" % name
        mazes[name] = {"w": W, "h": H, "start": list(start), "goal": list(goal),
                       "walls": ["".join("#" if walls[x][H - 1 - r] else "." for x in range(W)) for r in range(H)]}
        cases[name] = {}
        # your BFS on the same maze (it ignores costs): used for the constant-cost "matches BFS" check
        bfs_prob = searchAgents.PositionSearchProblem(gs, lambda p: 1, goal, None, False, False)
        try:
            quiet(search.breadthFirstSearch, bfs_prob)
            bfs_expanded = bfs_prob._expanded
        except BaseException:
            bfs_expanded = None

        for mkey, mlabel, _note, fn in MODELS:
            cost = {(x, y): fn(x, y, W, H) for x in range(W) for y in range(H) if not walls[x][y]}
            prob = searchAgents.PositionSearchProblem(gs, lambda pos, cost=cost: cost[(pos[0], pos[1])], goal, None, False, False)

            pops, exp_order, ecost = [], [], []
            orig_pop, orig_succ = util.PriorityQueue.pop, prob.getSuccessors

            def item_cost(item):
                if isinstance(item, tuple) and len(item) >= 3 and isinstance(item[2], (int, float)):
                    return item[2]
                return prob.getCostOfActions(item[1])        # fallback if the entry layout changes

            def spy_pop(self, orig_pop=orig_pop):
                item = orig_pop(self)
                pops.append(item_cost(item))
                return item
            def spy_succ(s, orig_succ=orig_succ):
                exp_order.append(tuple(s))
                ecost.append(pops[-1] if pops else 0)
                return orig_succ(s)
            util.PriorityQueue.pop, prob.getSuccessors = spy_pop, spy_succ
            try:
                path = quiet(search.uniformCostSearch, prob)
            finally:
                util.PriorityQueue.pop = orig_pop
            actions = "".join(DIRLETTER[a] for a in path)

            opt, ref_path = reference(walls, start, goal, cost)
            x, y = start
            legal = True
            for a in actions:
                dx, dy = VEC[a]
                x, y = x + dx, y + dy
                if walls[x][y]:
                    legal = False
                    break
            legal = legal and (x, y) == goal
            found = sum(cost[c] for c in _cells(start, actions)) if legal else None
            checks = {
                "optimal": legal and close(found, opt),
                "legal": legal,
                "cheapest_first": all(pops[i] <= pops[i + 1] * (1 + 1e-12) + 1e-12 for i in range(len(pops) - 1)),
                "expanded_once": len(exp_order) == len(set(exp_order)),
                "goal_on_pop": goal not in exp_order,
            }
            if mkey in ("c1", "c7") and bfs_expanded is not None:
                checks["matches_bfs"] = prob._expanded == bfs_expanded
            for k, v in checks.items():
                t = tally.setdefault(k, [0, 0])
                t[1] += 1
                t[0] += 1 if v else 0
            cases[name][mkey] = {
                "cc": [[None if walls[x][H - 1 - r] else cost[(x, H - 1 - r)] for x in range(W)] for r in range(H)],   # exact: the page re-runs UCS on these
                "cost": num(found) if found is not None else None, "opt": num(opt), "path": actions, "ref": ref_path,
                "exp": prob._expanded, "order": [x + y * W for x, y in exp_order], "ecost": [num(c) for c in ecost],
                "dups": max(0, len(pops) - len(exp_order) - 1), "checks": checks, "bfs": bfs_expanded if mkey in ("c1", "c7") else None,
            }
            bad = [k for k, v in checks.items() if not v]
            print("%-17s %-5s cost %-14s optimum %-14s expanded %4d  %s"
                  % (name, mkey, num(found) if found is not None else "ILLEGAL", num(opt), prob._expanded, "ok" if not bad else "FAIL " + ",".join(bad)))

    return {"meta": {"file": "search/search.py", "generated": datetime.date.today().isoformat()},
            "models": [{"key": k, "label": l, "note": n} for k, l, n, _ in MODELS],
            "mazes": mazes, "cases": cases, "tally": tally}


def _cells(start, actions):
    x, y = start
    for a in actions:
        dx, dy = VEC[a]
        x, y = x + dx, y + dy
        yield (x, y)


def render(data):
    tpl = (HERE / "lab_template.html").read_text(encoding="utf8")
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    assert "/*__LAB__*/null" in tpl
    return tpl.replace("/*__LAB__*/null", blob)


def main():
    ap = argparse.ArgumentParser(description="Build the UCS Test Lab from search/search.py")
    ap.add_argument("--search-dir", default=str(DEFAULT_SEARCH_DIR), help="folder holding search.py (default: ./search)")
    ap.add_argument("--out", default=str(HERE / "out" / "ucs_test_lab.html"), help="output HTML file")
    args = ap.parse_args()
    try:
        data = collect(args.search_dir)
    except SystemExit as e:
        if e.code in (0, 1, None):
            sys.exit("uniformCostSearch is not implemented yet (or exited). Finish Q3 first, then re-run.")
        raise
    print("tally:", {k: "%d/%d" % tuple(v) for k, v in data["tally"].items()})
    html = render(data)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf8")
    print("wrote %s (%d KB)" % (out, len(html.encode("utf8")) // 1024))


if __name__ == "__main__":
    main()
