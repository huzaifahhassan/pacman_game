"""
Build the four teacher evaluations (UCS, A*, CornersProblem, corners heuristic) from your own code in search/.

    python tools/evaluations/build_eval.py                 # writes tools/evaluations/out/<name>_evaluation.html for all four
    python tools/evaluations/build_eval.py --only ucs      # ucs | astar | corners | cornersheur
    python tools/evaluations/build_eval.py --search-dir path/to/search --out-dir some/folder

What goes into each page:
  * your real code (uniformCostSearch / aStarSearch from search.py, CornersProblem / cornersHeuristic from searchAgents.py),
    used for the "read your own code" questions;
  * a reference engine in JavaScript that produces every answer key, plus GOLDEN cases on which your real Python was run:
    the page re-runs its engine on them and shows whether the two agree.
    UCS and A*: random graphs (path, cost and expansion order). Corners: mazes (start state, successors, goal test, state
    count, BFS and A* cost and expansions, heuristic values); see corners_data.py.
Nothing in search/ is modified. Standard library only. The output contains your solution code: do not share or publish it.
"""
import argparse
import datetime
import heapq
import json
import os
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "tools" / "search_visualiser"))
sys.path.insert(0, str(HERE))
import build as vis_build                                   # noqa: E402  (reuses the line-role patterns and function reader)

ASTAR_PATTERNS = vis_build.IGNORE + [
    (r"^start_state = problem\.getStartState\(\)$", "get_start"),
    (r"^to_visit = util\.PriorityQueue\(\)$", "init_stack"),
    (r"^to_visit\.push\(\(start_state, \[\], 0\), heuristic\(start_state, problem\)\)$", "push_start"),
    (r"^visited = set\(\)$", "init_visited"),
    (r"^while not to_visit\.isEmpty\(\):$", "while"),
    (r"^current_state, path, \w+ = to_visit\.pop\(\)$", "pop"),
    (r"^if current_state in visited:$", "check_visited"),
    (r"^continue$", "skip"),
    (r"^if problem\.isGoalState\(current_state\):$", "goal_test"),
    (r"^return path$", "return_path"),
    (r"^visited\.add\(current_state\)$", "mark"),
    (r"^for successor, action, \w+ in problem\.getSuccessors\(current_state\):$", "for_succ"),
    (r"^if successor not in visited.*:$", "check_succ"),
    (r"^new_cost = cost \+ step_cost$", "add_cost"),
    (r"^priority = new_cost \+ heuristic\(successor, problem\)$", "add_h"),
    (r"^to_visit\.push\(\(successor, path \+ \[action\].*\), priority\)$", "push_succ"),
    (r"^return \[\]$", "return_empty"),
]

ALGOS = {
    "ucs": {"func": "uniformCostSearch", "bank": "bank_ucs.js", "out": "ucs_evaluation.html", "title": "UCS Evaluation", "patterns": vis_build.UCS_PATTERNS},
    "astar": {"func": "aStarSearch", "bank": "bank_astar.js", "out": "astar_evaluation.html", "title": "A* Evaluation", "patterns": ASTAR_PATTERNS},
    # Q5 and Q6: built by corners_data.py (they read searchAgents.py and run your CornersProblem on mazes)
    "corners": {"kind": "corners", "func": "CornersProblem", "bank": "bank_corners.js", "out": "corners_evaluation.html", "title": "Corners Problem Evaluation"},
    "cornersheur": {"kind": "corners", "func": "cornersHeuristic", "bank": "bank_cornersheur.js", "out": "cornersheur_evaluation.html", "title": "Corners Heuristic Evaluation"},
}
MAZES = ["tinyMaze", "smallMaze", "mediumMaze", "openMaze"]


class GraphProblem:
    """A small directed graph with per-edge costs, shaped like a SearchProblem (the student's code only calls these methods)."""
    def __init__(self, n, edges, start, goal):
        self.adj, self.w = {i: [] for i in range(n)}, {}
        for k, (u, v, w) in enumerate(edges):
            a = "e%d" % k
            self.adj[u].append((v, a, w))
            self.w[(u, a)] = (v, w)
        self.start, self.goal = start, goal

    def getStartState(self): return self.start
    def isGoalState(self, s): return s == self.goal
    def getSuccessors(self, s): return list(self.adj[s])


def reverse_dist(n, edges, goal, scale=1.0):
    radj = {i: [] for i in range(n)}
    for u, v, w in edges:
        radj[v].append((u, w * scale))
    dist, pq = {goal: 0.0}, [(0.0, goal)]
    while pq:
        d, v = heapq.heappop(pq)
        if d > dist.get(v, float("inf")):
            continue
        for u, w in radj[v]:
            if d + w < dist.get(u, float("inf")):
                dist[u] = d + w
                heapq.heappush(pq, (d + w, u))
    return dist


def golden_graphs(search, kind, count=60, seed=2026):
    """Random graphs on which the student's REAL function is run; the page re-runs its own engine on the same graphs."""
    rng = random.Random(seed)
    out = []
    while len(out) < count:
        n = rng.randint(3, 9)
        edges = [[rng.randrange(n), rng.randrange(n), rng.choice([0.5, 1, 1, 2, 3, 5, 8])] for _ in range(rng.randint(3, n * 3))]
        start, goal = rng.randrange(n), rng.randrange(n)
        if start == goal:
            continue
        h = None
        if kind == "astar":
            d = reverse_dist(n, edges, goal, rng.choice([0.5, 0.9, 1.0]))
            mode = rng.choice(["consistent", "random", "zero"])
            if mode == "consistent":
                h = [d.get(i, 0) for i in range(n)]
            elif mode == "zero":
                h = [0] * n
            else:
                h = [rng.choice([0, 0.5, 1, 2, 4, 7]) for _ in range(n)]       # may be inadmissible and inconsistent: the engine must still agree
        prob = GraphProblem(n, edges, start, goal)
        fn = getattr(search, "aStarSearch" if kind == "astar" else "uniformCostSearch")
        path = fn(prob, (lambda s, p, h=h: h[s])) if kind == "astar" else fn(prob)
        order = []
        # replay the same run to record the expansion order (the student's function does not expose it)
        orig = prob.getSuccessors
        prob2 = GraphProblem(n, edges, start, goal)
        prob2.getSuccessors = lambda s, o=prob2.getSuccessors: (order.append(s), o(s))[1]
        path2 = fn(prob2, (lambda s, p, h=h: h[s])) if kind == "astar" else fn(prob2)
        assert path == path2
        found = bool(path) and prob.getStartState() != prob.goal
        states, cost = [start], 0
        s = start
        for a in path:
            s2, w = prob.w[(s, a)]
            states.append(s2)
            cost += w
            s = s2
        out.append({"n": n, "edges": edges, "start": start, "goal": goal, "h": h, "found": found,
                    "path": states if found else [], "cost": cost if found else None, "order": order})
    return out


def build(algo, search_dir, out_dir):
    spec = ALGOS[algo]
    if spec.get("kind") == "corners":
        import corners_data                                    # noqa: E401  (Q5 and Q6 read searchAgents.py instead of search.py)
        return corners_data.build_corners(spec, algo, search_dir, out_dir)
    search_dir = Path(search_dir).resolve()
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    import search                                        # noqa: E401

    src = (search_dir / "search.py").read_text(encoding="utf8").splitlines()
    def_ln, roles, code = vis_build.read_function(src, {"func": spec["func"], "patterns": spec["patterns"]})
    lines = [{"ln": c[0], "text": c[1], "role": c[2]} for c in code]
    end = max(l["ln"] for l in lines if l["role"] == "return_empty")          # aStarSearch is the last function: do not pull in the aliases below it
    lines = [l for l in lines if l["ln"] <= end]
    gold = golden_graphs(search, "astar" if algo == "astar" else "ucs")
    mazes = {}
    for m in MAZES:
        mazes[m] = [l.rstrip("\r\n") for l in (search_dir / "layouts" / (m + ".lay")).read_text(encoding="utf8").splitlines() if l.strip()]
    data = {"algo": algo, "code": {"lines": lines, "first": def_ln, "last": max(l["ln"] for l in lines), "generated": datetime.date.today().isoformat()},
            "golden": gold, "mazes": mazes}
    tpl = (HERE / "eval_template.html").read_text(encoding="utf8")
    bank = (HERE / spec["bank"]).read_text(encoding="utf8")
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.replace("__TITLE__", spec["title"]).replace("/*__DATA__*/null", blob).replace("/*__BANK__*/", bank)
    assert "</script" not in bank.lower(), "bank must not contain a closing script tag"
    out = Path(out_dir) / spec["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf8")
    print("%-5s -> %s  (%d KB, %d code lines, %d golden graphs)" % (algo, out, len(html.encode("utf8")) // 1024, len(lines), len(gold)))
    return out


def main():
    ap = argparse.ArgumentParser(description="Build the UCS, A*, Corners problem and Corners heuristic teacher evaluations")
    ap.add_argument("--search-dir", default=str(REPO / "search"))
    ap.add_argument("--out-dir", default=str(HERE / "out"))
    ap.add_argument("--only", choices=list(ALGOS), default=None)
    args = ap.parse_args()
    for algo in ([args.only] if args.only else list(ALGOS)):
        if not (HERE / ALGOS[algo]["bank"]).exists():
            print("%s bank not written yet: skipped" % algo)
            continue
        build(algo, args.search_dir, args.out_dir)


if __name__ == "__main__":
    main()
