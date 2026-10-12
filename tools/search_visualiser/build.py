"""
Build the search step visualiser page (DFS, BFS and UCS) from your own search/search.py.

    python tools/search_visualiser/build.py
    python tools/search_visualiser/build.py --out some/where.html
    python tools/search_visualiser/build.py --search-dir path/to/search

It runs depthFirstSearch, breadthFirstSearch and uniformCostSearch on a few mazes under
sys.settrace, records the container (stack, queue or priority queue), path, cost and visited set
at every meaningful line, and inlines that recording into template.html. The default output is
tools/search_visualiser/out/search_visualiser.html (git-ignored); open it in a browser.
Nothing in search/ is modified. Standard library only.

An algorithm that is not implemented yet (or raises) is skipped with a note, so the page still
builds with whatever works. time.sleep calls and prints inside your functions are silenced while
recording, so debugging aids in your code do not slow this down.

Lines in the code panel are labelled by matching their source text (the *_PATTERNS lists below).
If you restructure a function and a line is no longer recognised, this script says so and the
page falls back to a generic "Executed line N" for it. Re-run it after you change a function: the
page is a recording, not a live view.

Note: the output contains your solution code, so do not share or publish it.
"""
import argparse
import contextlib
import datetime
import io
import json
import math
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_SEARCH_DIR = HERE.parents[1] / "search"
DIRLETTER = {"North": "N", "South": "S", "East": "E", "West": "W"}

# (key, layout file, step-cost function or None for unit cost, note shown on the maze button)
STAY_EAST = lambda pos: .5 ** pos[0]        # what StayEastSearchAgent charges per step
STAY_WEST = lambda pos: 2 ** pos[0]         # what StayWestSearchAgent charges per step
PLAIN_MAZES = [(m, m, None, "") for m in ("tinyMaze", "mediumMaze", "bigMaze")]
UCS_MAZES = [
    ("tinyMaze", "tinyMaze", None, "unit cost"),
    ("mediumMaze", "mediumMaze", None, "unit cost"),
    ("mediumMaze+east", "mediumMaze", STAY_EAST, "cost .5^x (StayEast)"),
    ("mediumMaze+west", "mediumMaze", STAY_WEST, "cost 2^x (StayWest)"),
    ("mediumDottedMaze", "mediumDottedMaze", STAY_EAST, "StayEastSearchAgent"),
    ("mediumScaryMaze", "mediumScaryMaze", STAY_WEST, "StayWestSearchAgent"),
]

# Source text (whitespace around commas normalised) of each line -> the role the page gives it.
# 'ignore' lines (prints, sleeps) are neither recorded nor shown.
IGNORE = [(r"^print\(.*\)$", "ignore"), (r"^time\.sleep\(.*\)$", "ignore")]

DFS_PATTERNS = IGNORE + [
    (r"^to_visit = util\.Stack\(\)$", "init_stack"),
    (r"^to_visit\.push\(\(problem\.getStartState\(\), \[\].*\)\)$", "push_start"),
    (r"^visited = set\(\)$", "init_visited"),
    (r"^while not to_visit\.isEmpty\(\):$", "while"),
    (r"^current_state, path(, \w+)? = to_visit\.pop\(\)$", "pop"),
    (r"^if current_state in visited:$", "check_visited"),
    (r"^continue$", "skip"),
    (r"^if problem\.isGoalState\(current_state\):$", "goal_test"),
    (r"^return path$", "return_path"),
    (r"^visited\.add\(current_state\)$", "mark"),
    (r"^for successor, action, \w+ in problem\.getSuccessors\(current_state\):$", "for_succ"),
    (r"^if successor not in visited.*:$", "check_succ"),
    (r"^to_visit\.push\(\(successor, path \+ \[action\].*\)\)$", "push_succ"),
    (r"^return \[\]$", "return_empty"),
]

BFS_PATTERNS = IGNORE + [
    (r"^visited = set\(\)$", "init_visited"),
    (r"^path = \[\]$", "init_path"),
    (r"^to_visit = util\.Queue\(\)$", "init_stack"),
    (r"^current_state = problem\.getStartState\(\)$", "set_start"),
    (r"^goal_reached = False$", "init_flag"),
    (r"^while not goal_reached:$", "while"),
    (r"^successors = problem\.getSuccessors\(current_state\)$", "expand"),
    (r"^for successor, action, \w+ in successors:$", "for_succ"),
    (r"^if successor not in visited.*:$", "check_succ"),
    (r"^to_visit\.push\(\(successor, path \+ \[action\].*\)\)$", "push_succ"),
    (r"^visited\.add\(current_state\)$", "mark"),
    (r"^current_state_action = to_visit\.pop\(\)$", "pop"),
    (r"^current_state = current_state_action\[0\]$", "take_state"),
    (r"^current_action = current_state_action\[1\]$", "take_path"),
    (r"^path = current_action$", "set_path"),
    (r"^if problem\.isGoalState\(current_state\):$", "goal_test"),
    (r"^goal_reached = True$", "set_flag"),
    (r"^return path$", "return_path"),
]

UCS_PATTERNS = IGNORE + [
    (r"^to_visit = util\.PriorityQueue\(\)$", "init_stack"),
    (r"^to_visit\.push\(\(problem\.getStartState\(\), \[\].*\)$", "push_start"),
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
    (r"^to_visit\.push\(\(successor, path \+ \[action\].*\)$", "push_succ"),
    (r"^return \[\]$", "return_empty"),
]

# 'arrive' = the roles after which Pacman's marker moves to a new state
ALGOS = {
    "dfs": {"label": "DFS", "func": "depthFirstSearch", "container": "stack", "arrive": ["pop"], "patterns": DFS_PATTERNS, "mazes": PLAIN_MAZES},
    "bfs": {"label": "BFS", "func": "breadthFirstSearch", "container": "queue", "arrive": ["set_start", "take_state"], "patterns": BFS_PATTERNS, "mazes": PLAIN_MAZES},
    "ucs": {"label": "UCS", "func": "uniformCostSearch", "container": "pq", "arrive": ["pop"], "patterns": UCS_PATTERNS, "mazes": UCS_MAZES},
}


def normalise(text):
    text = re.sub(r"\s+", " ", text.strip())
    return re.sub(r" ?, ?", ", ", text)


def num(x):
    """JSON-friendly number: ints stay ints, floats are rounded."""
    return x if isinstance(x, int) else round(x, 6)


def read_function(src_lines, spec):
    """Return (def_ln, roles, code): roles maps file line number -> role, code is the list shown in the panel."""
    def_ln = next((i for i, l in enumerate(src_lines, 1) if l.startswith("def " + spec["func"])), None)
    if def_ln is None:
        raise LookupError("def %s not found in search.py" % spec["func"])
    end_ln = next((i for i, l in enumerate(src_lines, 1) if i > def_ln and l.startswith("def ")), len(src_lines) + 1)
    marker_ln = next((i for i, l in enumerate(src_lines, 1) if i > def_ln and "*** YOUR CODE HERE ***" in l), def_ln)
    roles, code = {}, []
    for ln in range(def_ln + 1, end_ln):
        text = src_lines[ln - 1].rstrip()
        stripped = text.strip()
        if ln <= marker_ln or not stripped or stripped.startswith("#"):
            continue                                  # docstring, comments and blanks are not shown
        norm = normalise(stripped)
        role = next((r for pat, r in spec["patterns"] if re.match(pat, norm)), "other")
        roles[ln] = role
        if role != "ignore":
            code.append([ln, text[4:] if text.startswith("    ") else text, role])
    seen = set(roles.values())
    missing = {r for _, r in spec["patterns"] if r != "ignore"} - seen
    if missing:
        print("note: %s: no line matched role(s) %s; the page will show a generic label for them." % (spec["func"], sorted(missing)))
    unknown = [c[0] for c in code if c[2] == "other"]
    if unknown:
        print("note: %s: unrecognised line(s) %s will show as 'Executed line N'." % (spec["func"], unknown))
    return def_ln, roles, code


def record(layout_name, cost_fn, note, mods, roles, func):
    """Run the real function on one layout and return its recording."""
    layout, pacman, search, searchAgents = mods
    fn = getattr(search, func)
    code_obj = fn.__code__
    step_cost = cost_fn or (lambda pos: 1)

    def new_problem():
        gs = pacman.GameState()
        gs.initialize(layout.getLayout(layout_name), 0)
        return searchAgents.PositionSearchProblem(gs, step_cost, (1, 1), None, False, False)

    prob = new_problem()
    walls = prob.walls
    W, H = walls.width, walls.height

    calls = []                      # every getSuccessors call, so the page can show what it returned
    orig = prob.getSuccessors
    def wrapped(state):
        res = orig(state)
        calls.append([list(state), [[s[0][0], s[0][1], DIRLETTER[s[1]]] for s in res]])
        return res
    prob.getSuccessors = wrapped

    def pathstr(path):
        return "".join(DIRLETTER[a] for a in path)

    entries, entry_key, id_cache, keepalive = [], {}, {}, []   # interned container entries: [x, y, "NNEW..", cost?]
    def intern(obj, prio=None):
        eid = id_cache.get(id(obj))
        if eid is None:
            state, path = obj[0], obj[1]
            key = (state, pathstr(path))
            eid = entry_key.get(key)
            if eid is None:
                eid = len(entries)
                entries.append([state[0], state[1], key[1]] + ([num(prio)] if prio is not None else []))
                entry_key[key] = eid
            id_cache[id(obj)] = eid
            keepalive.append(obj)   # keep the object alive so its id() is never reused
        return eid

    paths, path_key = [], {}        # interned strings for the `path` variable
    def path_id(s):
        if s not in path_key:
            path_key[s] = len(paths)
            paths.append(s)
        return path_key[s]

    events, visited_order, visited_seen = [], [], set()

    def snapshot(frame, kind):
        ln = frame.f_lineno
        if ln not in roles:
            return                  # the no-op "*** YOUR CODE HERE ***" string and anything outside the function body
        role = roles[ln]
        if kind == "line" and role in ("while", "ignore"):
            return                  # the loop test and debugging aids carry no information
        loc = frame.f_locals
        box = loc.get("to_visit")
        stack = []
        if box is not None:
            if hasattr(box, "heap"):    # util.PriorityQueue: the entry that pops next is the smallest (priority, count)
                ordered = sorted(box.heap, key=lambda t: (t[0], t[1]), reverse=True)
                stack = [intern(t[2], t[0]) for t in ordered]
            else:                       # util.Stack / util.Queue: the last list item pops next
                stack = [intern(o) for o in box.list]
        vis = loc.get("visited")
        if vis is not None and len(vis) > len(visited_order):
            for s in vis:
                if s not in visited_seen:
                    visited_seen.add(s)
                    visited_order.append(list(s))
        ev = {"r": "done" if kind == "return" else role, "l": ln, "k": stack,
              "v": len(visited_order), "n": len(calls)}
        if loc.get("current_state") is not None:
            ev["cs"] = list(loc["current_state"])
        if loc.get("path") is not None:
            ev["p"] = path_id(pathstr(loc["path"]))
        if loc.get("current_state_action") is not None:       # BFS: the entry just popped
            ev["pe"] = intern(loc["current_state_action"])
        if isinstance(loc.get("cost"), (int, float)):         # UCS: total cost of `path`
            ev["g"] = num(loc["cost"])
        if role in ("check_succ", "add_cost", "push_succ") and "successor" in loc:
            ev["s"] = list(loc["successor"])
            ev["a"] = DIRLETTER[loc["action"]]
            if isinstance(loc.get("step_cost"), (int, float)):
                ev["sc"] = num(loc["step_cost"])
            if isinstance(loc.get("new_cost"), (int, float)):
                ev["tc"] = num(loc["new_cost"])
        events.append(ev)

    def local_tracer(frame, event, arg):
        if event == "line":
            snapshot(frame, "line")
        elif event == "return":
            snapshot(frame, "return")
        return local_tracer

    def global_tracer(frame, event, arg):
        return local_tracer if event == "call" and frame.f_code is code_obj else None

    real_sleep = time.sleep
    time.sleep = lambda s: None     # debugging pauses in the student's code must not slow the recording
    sys.settrace(global_tracer)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            path = fn(prob)
    finally:
        sys.settrace(None)
        time.sleep = real_sleep

    # sanity: the traced run equals an untraced run, and the plan really is a legal path to the goal
    prob2 = new_problem()
    with contextlib.redirect_stdout(io.StringIO()):
        time.sleep = lambda s: None
        try:
            plain = fn(prob2)
        finally:
            time.sleep = real_sleep
    assert plain == path and prob2._expanded == prob._expanded, "tracing changed the result"
    total_cost = prob.getCostOfActions(path)
    x, y = prob.getStartState()
    for a in path:                  # legality is checked against the walls: a real cost can exceed getCostOfActions' 999999 sentinel
        dx, dy = {"North": (0, 1), "South": (0, -1), "East": (1, 0), "West": (-1, 0)}[a]
        x, y = x + dx, y + dy
        assert not walls[x][y], "the returned actions walk into a wall"
    assert (x, y) == tuple(prob.goal), "the returned actions do not end at the goal"

    rows = ["".join("#" if walls[x][H - 1 - r] else "." for x in range(W)) for r in range(H)]
    out = {
        "w": W, "h": H, "walls": rows, "title": layout_name, "note": note,
        "start": list(prob.getStartState()), "goal": list(prob.goal),
        "entries": entries, "paths": paths, "visited": visited_order, "calls": calls,
        "ev": events, "solution": pathstr(path),
        "stats": {"expanded": prob._expanded, "pathLen": len(path), "cost": num(total_cost),
                  "maxStack": max(len(e["k"]) for e in events), "steps": len(events)},
    }
    if cost_fn is not None:         # per-cell step cost as log10, so the page can tint the cost landscape
        cm = [[None if walls[x][H - 1 - r] else round(math.log10(step_cost((x, H - 1 - r))), 2) for x in range(W)] for r in range(H)]
        vals = [v for row in cm for v in row if v is not None]
        if vals and max(vals) > min(vals):
            out["cm"] = cm
    return out


def collect(search_dir):
    """Record every algorithm that works and return the data blob for the page."""
    search_dir = Path(search_dir).resolve()
    os.chdir(search_dir)            # layout.getLayout reads layouts/ relative to the working directory
    sys.path.insert(0, str(search_dir))
    sys.dont_write_bytecode = True
    import layout, pacman, search, searchAgents       # noqa: E401 (imports need the path set up above)
    src = (search_dir / "search.py").read_text(encoding="utf8").splitlines()

    algos = {}
    for key, spec in ALGOS.items():
        try:
            def_ln, roles, code = read_function(src, spec)
            layouts = {}
            for lkey, lname, cost_fn, note in spec["mazes"]:
                layouts[lkey] = record(lname, cost_fn, note, (layout, pacman, search, searchAgents), roles, spec["func"])
                r = layouts[lkey]
                s = r["stats"]
                print("%s %-17s %-22s %5d steps, %3d expansions, path %3d, cost %-12s deepest %s %2d"
                      % (spec["label"], lkey, note or "", s["steps"], s["expanded"], s["pathLen"], s["cost"], spec["container"], s["maxStack"]))
        except (Exception, SystemExit) as e:    # util.raiseNotDefined() exits; a broken function raises
            why = "not implemented yet" if isinstance(e, SystemExit) else "%s: %s" % (type(e).__name__, e)
            print("skipped %s (%s): %s" % (spec["label"], spec["func"], why))
            continue
        algos[key] = {"label": spec["label"], "func": spec["func"], "container": spec["container"], "arrive": spec["arrive"],
                      "meta": {"file": "search/search.py", "first": def_ln, "last": max(c[0] for c in code),
                               "generated": datetime.date.today().isoformat()},
                      "code": code, "layouts": layouts}
    if not algos:
        sys.exit("No algorithm could be recorded. Fix depthFirstSearch / breadthFirstSearch / uniformCostSearch first "
                 "(python autograder.py -q q1, -q q2, -q q3), then re-run.")
    return {"algos": algos}


def render(data, init):
    tpl = (HERE / "template.html").read_text(encoding="utf8")
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    return tpl.replace("/*__DATA__*/null", blob).replace("/*__INIT__*/null", json.dumps(init))


def main():
    ap = argparse.ArgumentParser(description="Build the search step visualiser from search/search.py")
    ap.add_argument("--search-dir", default=str(DEFAULT_SEARCH_DIR), help="folder holding search.py (default: ./search)")
    ap.add_argument("--out", default=str(HERE / "out" / "search_visualiser.html"), help="output HTML file")
    args = ap.parse_args()

    data = collect(args.search_dir)
    first_algo = next(iter(data["algos"]))
    first_maze = next(iter(data["algos"][first_algo]["layouts"]))
    html = render(data, {"algo": first_algo, "layout": first_maze, "rest": True})
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf8")
    print("wrote %s (%d KB)" % (out, len(html.encode("utf8")) // 1024))


if __name__ == "__main__":
    main()
