"""
The Python side of the Q9 evaluation (D* Lite). Used by build_eval.py.

  * reads the lines of YOUR DStarLite methods from search/dStarLite.py, with a role for each line, so the "read your own code" questions
    can point at them;
  * runs YOUR real DStarLite the way the autograder does (a sensor reveals walls, Pacman walks, updateEdgeCosts after every discovery) on
    the provided mazes and on random ones, and records Pacman's path, the vertices popped in every planning episode, km and the totals.
    The page re-runs its JavaScript engine on the same mazes and shows whether the two agree;
  * measures what a few realistic one-line mistakes do to YOUR code (a modified copy of your class, 120 random mazes).

Nothing in search/ is modified. Standard library only.
"""
import collections
import contextlib
import datetime
import io
import json
import os
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import corners_data as cd                                   # noqa: E402  (read_lines, strip_comment)
import food_data as fd                                      # noqa: E402  (method_lines)

CSP_RENAME = {"csp_for": ["csp_over_for", "csp_under_for"], "csp_upd_s": ["csp_over_upd", "csp_under_upd"]}
PATTERNS = {
    "calculateKey": [
        (r"^def calculateKey\(self, s\):$", "def_key"),
        (r"^smaller = min\(self\.getG\(s\), self\.getRhs\(s\)\)$", "key_smaller"),
        (r"^return \(smaller \+ self\.h\(self\.sStart, s\) \+ self\.km, smaller\)$", "key_ret"),
    ],
    "initialize": [
        (r"^def initialize\(self\):$", "def_init"),
        (r"^self\.U = util\.DStarLitePriorityQueue\(\)$", "init_U"),
        (r"^self\.km = 0$", "init_km"),
        (r"^self\.g = \{\}$", "init_g"),
        (r"^self\.rhs = \{\}$", "init_rhs"),
        (r"^self\.rhs\[self\.sGoal\] = 0$", "init_goal"),
        (r"^self\.U\.insert\(self\.sGoal, self\.calculateKey\(self\.sGoal\)\)$", "init_insert"),
    ],
    "updateVertex": [
        (r"^def updateVertex\(self, u\):$", "def_uv"),
        (r"^if u != self\.sGoal:$", "uv_if"),
        (r"^best = INF$", "uv_best"),
        (r"^for s in self\.belief\.neighbors\(u\):$", "uv_for"),
        (r"^best = min\(best, self\.belief\.cost\(u, s\) \+ self\.getG\(s\)\)$", "uv_min"),
        (r"^self\.rhs\[u\] = best$", "uv_rhs"),
        (r"^self\.U\.remove\(u\)$", "uv_remove"),
        (r"^if self\.getG\(u\) != self\.getRhs\(u\):$", "uv_ifg"),
        (r"^self\.U\.insert\(u, self\.calculateKey\(u\)\)$", "uv_insert"),
    ],
    "computeShortestPath": [
        (r"^def computeShortestPath\(self\):$", "def_csp"),
        (r"^while self\.U\.topKey\(\) < self\.calculateKey\(self\.sStart\) or self\.getRhs\(self\.sStart\) != self\.getG\(self\.sStart\):$", "csp_while"),
        (r"^k_old = self\.U\.topKey\(\)$", "csp_kold"),
        (r"^u = self\.U\.pop\(\)$", "csp_pop"),
        (r"^k_new = self\.calculateKey\(u\)$", "csp_knew"),
        (r"^if k_old < k_new:$", "csp_if_stale"),
        (r"^self\.U\.insert\(u, k_new\)$", "csp_reinsert"),
        (r"^elif self\.getG\(u\) > self\.getRhs\(u\):$", "csp_over"),
        (r"^self\.g\[u\] = self\.getRhs\(u\)$", "csp_over_set"),
        (r"^for s in self\.belief\.neighbors\(u\):$", "csp_for"),
        (r"^self\.updateVertex\(s\)$", "csp_upd_s"),
        (r"^else:$", "csp_else"),
        (r"^self\.g\[u\] = INF$", "csp_under_set"),
        (r"^self\.updateVertex\(u\)$", "csp_under_upd_u"),
    ],
    "nextStep": [
        (r"^def nextStep\(self\):$", "def_next"),
        (r"^if self\.sStart == self\.sGoal or self\.getG\(self\.sStart\) == INF:$", "next_if"),
        (r"^return None$", "next_none"),
        (r"^best, bestCost = None, INF$", "next_init"),
        (r"^for s in self\.belief\.neighbors\(self\.sStart\):$", "next_for"),
        (r"^cost = self\.belief\.cost\(self\.sStart, s\) \+ self\.getG\(s\)$", "next_cost"),
        (r"^if cost < bestCost:$", "next_cmp"),
        (r"^best, bestCost = s, cost$", "next_set"),
        (r"^return best$", "next_ret"),
    ],
    "updateEdgeCosts": [
        (r"^def updateEdgeCosts\(self, changedCells\):$", "def_uec"),
        (r"^self\.km \+= self\.h\(self\.sLast, self\.sStart\)$", "uec_km"),
        (r"^self\.sLast = self\.sStart$", "uec_last"),
        (r"^for w in changedCells:$", "uec_for"),
        (r"^self\.updateVertex\(w\)$", "uec_upd_w"),
        (r"^for s in self\.belief\.neighbors\(w\):$", "uec_nfor"),
        (r"^self\.updateVertex\(s\)$", "uec_upd_n"),
        (r"^self\.computeShortestPath\(\)$", "uec_csp"),
    ],
}
ORDER = ["calculateKey", "initialize", "updateVertex", "computeShortestPath", "nextStep", "updateEdgeCosts"]


def code_for(src):
    lines = []
    for name in ORDER:
        part = fd.method_lines(src, "DStarLite", name, PATTERNS[name])
        seen = collections.Counter()
        for ln, text, role in part:
            if role in CSP_RENAME:                                 # the same text appears twice: the first is the overconsistent branch, the second the underconsistent
                names, i = CSP_RENAME[role], seen[role]
                seen[role] += 1
                role = names[min(i, len(names) - 1)]
            lines.append({"ln": ln, "text": text, "role": role, "m": name})
    return lines


# ---------------------------------------------------------------- worlds
def rand_world(rng, W=None, H=None):
    """Random walled maze as layout rows with Pacman ('P') and the food ('.'), border walls, at least a few open cells."""
    while True:
        w, h = W or rng.randint(8, 18), H or rng.randint(6, 11)
        dens = rng.uniform(0.12, 0.35)
        g = [["%" if x in (0, w - 1) or r in (0, h - 1) or rng.random() < dens else " " for x in range(w)] for r in range(h)]
        free = [(x, r) for r in range(1, h - 1) for x in range(1, w - 1) if g[r][x] == " "]
        if len(free) < 4:
            continue
        (sx, sr), (gx, gr) = rng.sample(free, 2)
        g[sr][sx], g[gr][gx] = "P", "."
        return ["".join(r) for r in g]


def lay_rows(search_dir, name):
    return [l.rstrip("\r\n") for l in (search_dir / "layouts" / (name + ".lay")).read_text(encoding="utf8").splitlines() if l.strip()]


_CACHE = {}


def _mods(search_dir):
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    import game, layout, search, util, dStarLite, dStarLiteAgents      # noqa: E401
    return game, layout, search, util, dStarLite, dStarLiteAgents


class Null:
    def write(self, s): return len(s)
    def flush(self): pass


def run_dstar(M, rows, radius, cls=None, check=False):
    """The autograder's loop on one maze. Returns a record of what happened (and, with check=True, whether every episode matched BFS)."""
    game, layout, search, util, dStarLite, agents = M
    INF = float("inf")
    lay = layout.Layout(list(rows))
    start, goal = lay.agentPositions[0][1], lay.food.asList()[0]
    belief = agents.GridBelief(lay.walls, radius)
    belief.sense(start)
    util.DStarLitePriorityQueue.resetCounters()
    planner = (cls or dStarLite.DStarLite)(belief, start, goal)
    hist = util.DStarLitePriorityQueue

    def bfs(pos):
        dist = {goal: 0} if not belief.isKnownWall(goal) else {}
        q = collections.deque(dist)
        while q:
            u = q.popleft()
            for n in belief.neighbors(u):
                if n not in dist and belief.cost(u, n) < INF:
                    dist[n] = dist[u] + 1
                    q.append(n)
        return dist

    def episode(found):
        h0, p0 = len(hist.poppedHistory), hist.totalPops
        if found is None:
            planner.computeShortestPath()
        else:
            planner.updateEdgeCosts(found)
        return {"found": 0 if found is None else len(found), "pops": hist.totalPops - p0, "popped": [list(c) for c in hist.poppedHistory[h0:]]}

    episodes = [episode(None)]
    pos, path, status = start, [list(start)], "ok"
    while True:
        true = bfs(pos).get(pos, INF)
        if check and (planner.getG(pos) != true or planner.getRhs(pos) != true):
            status = "wrong g"
            break
        if pos == goal:
            break
        nxt = planner.nextStep()
        if nxt is None:
            if check and true != INF:
                status = "bad nextStep"
            break
        if check and (true == INF or bfs(pos).get(nxt, INF) + 1 != true):
            status = "bad nextStep"
            break
        pos = nxt
        planner.sStart = pos
        path.append(list(pos))
        found = belief.sense(pos)
        if found:
            episodes.append(episode(found))
        if len(path) > 4000:
            status = "no finish"
            break
    return {"path": path, "episodes": episodes, "km": planner.km, "total": hist.totalPops, "reached": pos == goal, "status": status,
            "gStart": None if planner.getG(start) == INF else planner.getG(start)}


def replanning_astar_total(M, rows, radius):
    """What the provided ReplanningAStarAgent does (your aStarSearch, replanning when a new wall blocks the plan): total expansions."""
    game, layout, search, util, dStarLite, agents = M
    lay = layout.Layout(list(rows))
    start, goal = lay.agentPositions[0][1], lay.food.asList()[0]
    belief = agents.GridBelief(lay.walls, radius)
    belief.sense(start)
    total, replans = 0, -1

    def plan(pos):
        nonlocal total, replans
        problem = agents.BeliefPositionProblem(belief, pos, goal)
        with contextlib.redirect_stdout(Null()):
            acts = search.aStarSearch(problem, lambda s, p=None: dStarLite.gridHeuristic(s, goal)) or []
        total += problem._expanded
        replans += 1
        cells, c = [], pos
        for a in acts:
            dx, dy = game.Actions.directionToVector(a)
            c = (int(c[0] + dx), int(c[1] + dy))
            cells.append(c)
        return cells

    pos, cells = start, plan(start)
    while pos != goal and cells:
        pos = cells.pop(0)
        found = belief.sense(pos)
        if found and set(found) & set(cells):
            cells = plan(pos)
    return {"total": total, "replans": replans}


def golden_dstar(search_dir):
    key = ("dstar", str(search_dir))
    if key in _CACHE:
        return _CACHE[key]
    M = _mods(search_dir)
    rng = random.Random(97)
    mazes = [(n, lay_rows(search_dir, n), r) for n, r in (("tinyMaze", 1), ("dstarCup", 1), ("smallMaze", 1), ("dstarSpiral", 2), ("dstarDoors", 1),
                                                          ("mediumMaze", 1), ("dstarNoPath", 1), ("bigMaze", 1))]
    mazes += [("random %d" % (k + 1), rand_world(rng, rng.randint(9, 14), rng.randint(7, 9)), rng.choice([1, 1, 2])) for k in range(8)]
    out = []
    for name, rows, radius in mazes:
        rec = run_dstar(M, rows, radius)
        item = {"name": name, "rows": rows, "radius": radius, "path": rec["path"], "km": rec["km"], "total": rec["total"], "reached": rec["reached"],
                "gStart": rec["gStart"], "episodes": [{"found": e["found"], "pops": e["pops"], "popped": e["popped"] if rec["total"] <= 2500 else None} for e in rec["episodes"]]}
        if rec["reached"]:
            item["astar"] = replanning_astar_total(M, rows, radius)
        out.append(item)
        print("   golden %-12s radius %d: %4d steps, %3d episodes, %5d pops, km %d%s" % (name, radius, len(rec["path"]) - 1, len(rec["episodes"]), rec["total"], rec["km"],
                                                                                   (", replanning A* %d" % item["astar"]["total"]) if "astar" in item else ", goal unreachable"))
    _CACHE[key] = out
    return out


def mutants(search_dir):
    """What realistic one-line mistakes do to YOUR code: a modified copy of your class on 120 random mazes."""
    key = ("mutants", str(search_dir))
    if key in _CACHE:
        return _CACHE[key]
    M = _mods(search_dir)
    game, layout, search, util, dStarLite, agents = M
    INF = dStarLite.INF
    D = dStarLite.DStarLite

    class NoKm(D):
        def updateEdgeCosts(self, changedCells):
            self.sLast = self.sStart
            for w in changedCells:
                self.updateVertex(w)
                for s in self.belief.neighbors(w):
                    self.updateVertex(s)
            self.computeShortestPath()

    class NoRemove(D):
        def updateVertex(self, u):
            if u != self.sGoal:
                best = INF
                for s in self.belief.neighbors(u):
                    best = min(best, self.belief.cost(u, s) + self.getG(s))
                self.rhs[u] = best
            if self.getG(u) != self.getRhs(u):
                self.U.insert(u, self.calculateKey(u))

    class GoalRecompute(D):
        def updateVertex(self, u):
            best = INF
            for s in self.belief.neighbors(u):
                best = min(best, self.belief.cost(u, s) + self.getG(s))
            self.rhs[u] = best
            self.U.remove(u)
            if self.getG(u) != self.getRhs(u):
                self.U.insert(u, self.calculateKey(u))

    class NoRhsClause(D):
        def computeShortestPath(self):
            while self.U.topKey() < self.calculateKey(self.sStart):
                k_old = self.U.topKey()
                u = self.U.pop()
                k_new = self.calculateKey(u)
                if k_old < k_new:
                    self.U.insert(u, k_new)
                elif self.getG(u) > self.getRhs(u):
                    self.g[u] = self.getRhs(u)
                    for s in self.belief.neighbors(u):
                        self.updateVertex(s)
                else:
                    self.g[u] = INF
                    self.updateVertex(u)
                    for s in self.belief.neighbors(u):
                        self.updateVertex(s)

    rng = random.Random(4242)
    worlds = []
    while len(worlds) < 120:
        rows = rand_world(rng, rng.randint(8, 18), rng.randint(6, 11))
        worlds.append((rows, rng.choice([1, 1, 2])))
    out = {}
    for name, cls in (("base", D), ("noKm", NoKm), ("noRemove", NoRemove), ("goalRecompute", GoalRecompute), ("noRhsClause", NoRhsClause)):
        ok = wrong = pops = 0
        for rows, radius in worlds:
            try:
                rec = run_dstar(M, rows, radius, cls=cls, check=True)
                status, total = rec["status"], rec["total"]
            except Exception:
                status, total = "exception", 0
            if status == "ok":
                ok += 1
                pops += total
            else:
                wrong += 1
        out[name] = {"ok": ok, "wrong": wrong, "pops": pops, "n": len(worlds)}
    print("   mutants:", {k: (v["ok"], v["wrong"], v["pops"]) for k, v in out.items()})
    _CACHE[key] = out
    return out


def build_dstar(spec, algo, search_dir, out_dir):
    search_dir = Path(search_dir).resolve()
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    src = (search_dir / "dStarLite.py").read_text(encoding="utf8").splitlines()
    lines = code_for(src)
    unknown = [l["ln"] for l in lines if l["role"] == "other"]
    if unknown:
        print("note: dStarLite: unrecognised line(s) %s will show as generic lines." % unknown)
    data = {"algo": algo, "code": {"lines": lines, "first": lines[0]["ln"], "last": lines[-1]["ln"], "generated": datetime.date.today().isoformat()},
            "golden": golden_dstar(search_dir), "mutants": mutants(search_dir), "mazes": {}}
    tpl = (HERE / "eval_template.html").read_text(encoding="utf8")
    engine = (HERE / "dstar_engine.js").read_text(encoding="utf8")
    bank = (HERE / spec["bank"]).read_text(encoding="utf8")
    assert "</script" not in (engine + bank).lower(), "bank must not contain a closing script tag"
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.replace("__TITLE__", spec["title"]).replace("/*__DATA__*/null", blob).replace("/*__BANK__*/", engine + "\n" + bank)
    out = Path(out_dir) / spec["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf8")
    print("%-10s -> %s  (%d KB, %d code lines, %d golden mazes)" % (algo, out, len(html.encode("utf8")) // 1024, len(lines), len(data["golden"])))
    return out
