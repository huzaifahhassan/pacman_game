"""
The Python side of the two Corners evaluations (Q5 CornersProblem, Q6 cornersHeuristic). Used by build_eval.py.

  * reads the lines of YOUR CornersProblem / cornersHeuristic from search/searchAgents.py, with a role for each line, so the
    "read your own code" questions can point at them;
  * runs YOUR CornersProblem, breadthFirstSearch, aStarSearch and cornersHeuristic on many mazes (the two provided ones and
    random ones) and records what they do. The page re-runs its JavaScript engine on the same mazes and shows whether the two agree.

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
sys.path.insert(0, str(HERE.parents[1] / "tools" / "search_visualiser"))
import build as vis_build                                   # noqa: E402  (its normalise() is reused for matching lines)

# roles for the lines of CornersProblem (Q5); trailing comments are stripped before matching
CORNERS_PATTERNS = [
    (r"^def getStartState\(self\):$", "def_start"),
    (r"^unvisited = tuple\(c for c in self\.corners if c != self\.startingPosition\)$", "start_un"),
    (r"^return \(self\.startingPosition, unvisited\)$", "start_ret"),
    (r"^def isGoalState\(self, state.*\):$", "def_goal"),
    (r"^return len\(state\[1\]\) == 0$", "goal_ret"),
    (r"^def getSuccessors\(self, state.*\):$", "def_succ"),
    (r"^successors = \[\]$", "succ_init"),
    (r"^for action in \[Directions\.NORTH, Directions\.SOUTH, Directions\.EAST, Directions\.WEST\]:$", "succ_for"),
    (r"^position, unvisited = state$", "succ_unpack"),
    (r"^x, ?y ?= position$", "succ_xy"),
    (r"^dx, dy = Actions\.directionToVector\(action\)$", "succ_vec"),
    (r"^nextx, nexty = int\(x \+ dx\), int\(y \+ dy\)$", "succ_next"),
    (r"^if self\.walls\[nextx\]\[nexty\]:$", "succ_wall"),
    (r"^continue$", "succ_continue"),
    (r"^next_position = \(nextx, nexty\)$", "succ_nextpos"),
    (r"^next_unvisited = tuple\(c for c in unvisited if c != next_position\)$", "succ_nextun"),
    (r"^successors\.append\(\(\(next_position, next_unvisited\), action, 1\)\)$", "succ_append"),
    (r"^self\._expanded \+= 1$", "succ_count"),
    (r"^return successors$", "succ_return"),
]
# roles for the lines of cornersHeuristic (Q6)
HEUR_PATTERNS = [
    (r"^corners = problem\.corners$", "h_given1"),
    (r"^walls = problem\.walls$", "h_given2"),
    (r"^position, unvisited = state$", "h_unpack"),
    (r"^if len\(unvisited\) == 0:$", "h_goal_if"),
    (r"^return 0$", "h_goal_ret"),
    (r"^best_tour = None$", "h_best_init"),
    (r"^for order in itertools\.permutations\(unvisited\):$", "h_perm"),
    (r"^tour = 0$", "h_tour0"),
    (r"^here = position$", "h_here"),
    (r"^for corner in order:$", "h_for"),
    (r"^tour \+= util\.manhattanDistance\(here, corner\)$", "h_add"),
    (r"^here = corner$", "h_move"),
    (r"^if best_tour is None or tour < best_tour:$", "h_cmp"),
    (r"^best_tour = tour$", "h_set"),
    (r"^return best_tour$", "h_return"),
]


def strip_comment(text):
    return re.sub(r"\s+#.*$", "", text.strip())


def read_lines(src_lines, first_ln, last_ln, patterns, dedent):
    """Code lines first_ln..last_ln of the file as [ln, text, role]; docstrings, comment lines, blanks and the starter marker are dropped."""
    out, in_doc = [], False
    for ln in range(first_ln, last_ln + 1):
        text = src_lines[ln - 1].rstrip()
        stripped = text.strip()
        if in_doc:
            in_doc = '"""' not in stripped
            continue
        if stripped.startswith('"""'):
            in_doc = stripped.count('"""') < 2
            continue
        if not stripped or stripped.startswith("#") or stripped == '"*** YOUR CODE HERE ***"':
            continue
        norm = vis_build.normalise(strip_comment(stripped))
        role = next((r for pat, r in patterns if re.match(pat, norm)), "other")
        out.append([ln, text[dedent:] if text.startswith(" " * dedent) else text, role])
    return out


def corners_code(src_lines, func):
    """The code shown on a Corners page: three methods of CornersProblem (Q5) or the body of cornersHeuristic (Q6)."""
    if func == "CornersProblem":
        cls = next(i for i, l in enumerate(src_lines, 1) if l.startswith("class CornersProblem"))
        end = next((i for i, l in enumerate(src_lines, 1) if i > cls and l and not l[0].isspace() and not l.startswith("#")), len(src_lines) + 1) - 1
        lines = []
        for name in ("getStartState", "isGoalState", "getSuccessors"):
            d = next(i for i, l in enumerate(src_lines, 1) if cls < i <= end and l.startswith("    def " + name))
            e = next((i for i, l in enumerate(src_lines, 1) if i > d and (l.startswith("    def ") or (l and not l[0].isspace()))), end + 1) - 1
            lines += read_lines(src_lines, d, e, CORNERS_PATTERNS, 4)
        return lines
    d = next(i for i, l in enumerate(src_lines, 1) if l.startswith("def cornersHeuristic"))
    e = next((i for i, l in enumerate(src_lines, 1) if i > d and l and not l[0].isspace()), len(src_lines) + 1) - 1
    return read_lines(src_lines, d + 1, e, HEUR_PATTERNS, 4)


def rand_corner_maze(rng, start_corner=None):
    """A random walled maze with all four corners open and carrying food, the way the real corner layouts look."""
    while True:
        W, Hh = rng.randint(7, 13), rng.randint(6, 9)
        g = [["%" if x in (0, W - 1) or ry in (0, Hh - 1) else " " for x in range(W)] for ry in range(Hh)]
        for _ in range(rng.randint(2, 5)):
            horiz = rng.random() < 0.5
            ln = rng.randint(2, max(2, (W - 5) if horiz else (Hh - 4)))
            x0, y0 = rng.randint(2, max(2, W - 3)), rng.randint(2, max(2, Hh - 3))
            for i in range(ln):
                x, y = (x0 + i, y0) if horiz else (x0, y0 + i)
                if 0 < x < W - 1 and 0 < y < Hh - 1:
                    g[y][x] = "%"
        for ry in (1, Hh - 2):
            for x in (1, W - 2):
                g[ry][x] = "."
        cells = [(x, ry) for ry in range(Hh) for x in range(W) if g[ry][x] != "%"]
        seen, todo = {cells[0]}, [cells[0]]
        while todo:
            x, ry = todo.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = (x + dx, ry + dy)
                if g[nb[1]][nb[0]] != "%" and nb not in seen:
                    seen.add(nb)
                    todo.append(nb)
        if len(seen) != len(cells):
            continue
        if start_corner is None:
            x, ry = rng.choice([c for c in cells if g[c[1]][c[0]] == " "])
        else:
            x, ry = (1 if start_corner < 2 else W - 2), (Hh - 2 if start_corner % 2 == 0 else 1)
        g[ry][x] = "P"
        return ["".join(r) for r in g]


_GOLDEN = {}


def golden_corners(search_dir):
    """Run YOUR CornersProblem, breadthFirstSearch, aStarSearch and cornersHeuristic on many mazes and record what they do."""
    key = str(search_dir)
    if key in _GOLDEN:
        return _GOLDEN[key]
    import layout                                          # noqa: E401
    import pacman                                          # noqa: E401
    import search                                          # noqa: E401
    import searchAgents                                    # noqa: E401

    class Null:
        def write(self, s): return len(s)
        def flush(self): pass

    def quiet(fn, *a):                                     # your breadthFirstSearch prints a lot: keep the console clean
        with contextlib.redirect_stdout(Null()):
            return fn(*a)

    def problem(rows):
        gs = pacman.GameState()
        gs.initialize(layout.Layout(list(rows)), 0)
        return quiet(searchAgents.CornersProblem, gs)

    def lay(name):
        return [l.rstrip("\r\n") for l in (search_dir / "layouts" / (name + ".lay")).read_text(encoding="utf8").splitlines() if l.strip()]

    rng = random.Random(55)
    mazes = [("tinyCorners", lay("tinyCorners")), ("mediumCorners", lay("mediumCorners"))]
    for k in range(14):
        mazes.append(("random %d" % (k + 1), rand_corner_maze(rng, start_corner=(k % 4) if k % 3 == 0 else None)))
    out = []
    for name, rows in mazes:
        p = problem(rows)
        start = p.getStartState()
        states, todo = {start}, [start]
        while todo:                                         # every reachable state, found with YOUR getSuccessors
            for t, _, _ in p.getSuccessors(todo.pop()):
                if t not in states:
                    states.add(t)
                    todo.append(t)
        pool = sorted(states)
        picks = rng.sample(pool, min(24, len(pool))) + [s for s in pool if p.isGoalState(s)][:3] + [start]
        samples = [{"s": s, "out": p.getSuccessors(s), "goal": bool(p.isGoalState(s)), "h": searchAgents.cornersHeuristic(s, p)} for s in picks]
        pb = problem(rows)
        path_b = quiet(search.breadthFirstSearch, pb)
        pa = problem(rows)
        path_a = quiet(search.aStarSearch, pa, searchAgents.cornersHeuristic)
        out.append({"name": name, "rows": rows, "start": start, "nreach": len(states), "samples": samples,
                    "bfs": {"cost": len(path_b), "expanded": pb._expanded}, "astar": {"cost": len(path_a), "expanded": pa._expanded}})
        print("   golden %-14s %4d states, bfs %4d expanded, a* %4d expanded" % (name, len(states), pb._expanded, pa._expanded))
    _GOLDEN[key] = out
    return out


def build_corners(spec, algo, search_dir, out_dir):
    """Write one Corners evaluation page. spec comes from build_eval.ALGOS."""
    search_dir = Path(search_dir).resolve()
    os.chdir(search_dir)
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    src = (search_dir / "searchAgents.py").read_text(encoding="utf8").splitlines()
    code = corners_code(src, spec["func"])
    unknown = [c[0] for c in code if c[2] == "other"]
    if unknown:
        print("note: %s: unrecognised line(s) %s will show as generic lines." % (spec["func"], unknown))
    lines = [{"ln": c[0], "text": c[1], "role": c[2]} for c in code]
    mazes = {m: [l.rstrip("\r\n") for l in (search_dir / "layouts" / (m + ".lay")).read_text(encoding="utf8").splitlines() if l.strip()]
             for m in ("tinyCorners", "mediumCorners")}
    gold = golden_corners(search_dir)
    data = {"algo": algo, "code": {"lines": lines, "first": lines[0]["ln"], "last": lines[-1]["ln"], "generated": datetime.date.today().isoformat()},
            "golden": gold, "mazes": mazes}
    tpl = (HERE / "eval_template.html").read_text(encoding="utf8")
    engine = (HERE / "corners_engine.js").read_text(encoding="utf8")
    bank = (HERE / spec["bank"]).read_text(encoding="utf8")
    assert "</script" not in (engine + bank).lower(), "bank must not contain a closing script tag"
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.replace("__TITLE__", spec["title"]).replace("/*__DATA__*/null", blob).replace("/*__BANK__*/", engine + "\n" + bank)
    out = Path(out_dir) / spec["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf8")
    print("%-11s -> %s  (%d KB, %d code lines, %d golden mazes)" % (algo, out, len(html.encode("utf8")) // 1024, len(lines), len(gold)))
    return out
