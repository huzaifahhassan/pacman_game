// Shared by bank_food.js (Q7) and bank_closestdot.js (Q8). build_eval.py puts this file in front of the bank.
// A JavaScript twin of FoodSearchProblem, your A*, the candidate food heuristics and the closest-dot agent, plus the helpers the questions need.
// State = { x, y, f } where f is a bit mask over gr.dots (bit i set = dot i is still uneaten); dots are listed the way Grid.asList() lists them.
const { esc, fmt, codeHTML, lineOf, textOf, parseMaze, drawGrid, canvasHTML } = H;
const O = (html, ok, why) => ({ html, ok: !!ok, why: why || '' });
const C = (s) => '<code>' + s + '</code>';

// ---------------------------------------------------------------- the maze and the problem
const FDIRS = [[0, 1, 'N', 'North'], [0, -1, 'S', 'South'], [1, 0, 'E', 'East'], [-1, 0, 'W', 'West']];     // the order the successors are tried
const man = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const cid = (x, y) => x + ',' + y;
const ptS = (x, y) => '(' + x + ', ' + y + ')';
const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
function foodMaze(rows) {
  const gr = parseMaze(rows), dots = [], idx = {};
  for (let x = 0; x < gr.W; x++) for (let y = 0; y < gr.H; y++) if (rows[gr.H - 1 - y][x] === '.') { idx[cid(x, y)] = dots.length; dots.push([x, y]); }
  gr.dots = dots; gr.dotIdx = idx; gr.rows = rows;
  return gr;
}
const fStart = (gr) => ({ x: gr.start[0], y: gr.start[1], f: gr.dots.length ? (1 << gr.dots.length) - 1 : 0 });
const fGoal = (st) => st.f === 0;
const fKey = (gr, s) => s.f * gr.W * gr.H + s.y * gr.W + s.x;
const dotsLeft = (gr, st) => gr.dots.filter((d, i) => st.f & (1 << i));
function fSucc(gr, st) {
  const out = [];
  for (const d of FDIRS) {
    const nx = st.x + d[0], ny = st.y + d[1]; if (gr.wall[nx][ny]) continue;
    let f = st.f; const i = gr.dotIdx[cid(nx, ny)]; if (i !== undefined) f &= ~(1 << i);
    out.push({ st: { x: nx, y: ny, f }, a: d[2], c: 1 });
  }
  return out;
}
// walking distance (steps around the walls) from cell p to every cell
function distMap(gr, p) {
  gr._d = gr._d || {}; const k = cid(p[0], p[1]); if (gr._d[k]) return gr._d[k];
  const d = new Int32Array(gr.W * gr.H).fill(-1), q = [p[0] + p[1] * gr.W]; d[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const id = q[i], x = id % gr.W, y = (id - x) / gr.W;
    for (const dd of FDIRS) { const nx = x + dd[0], ny = y + dd[1]; if (gr.wall[nx][ny] || d[nx + ny * gr.W] >= 0) continue; d[nx + ny * gr.W] = d[id] + 1; q.push(nx + ny * gr.W); }
  }
  return (gr._d[k] = d);
}
const wdist = (gr, a, b) => distMap(gr, a)[b[0] + b[1] * gr.W];
const openCells = (gr) => { const a = []; for (let x = 0; x < gr.W; x++) for (let y = 0; y < gr.H; y++) if (!gr.wall[x][y]) a.push([x, y]); return a; };
const openNbrs = (gr, p) => FDIRS.filter((d) => !gr.wall[p[0] + d[0]][p[1] + d[1]]);
const withStart = (gr, pos) => Object.assign({}, gr, { start: pos.slice() });

// A* written like yours: priority g + h, ties first-in-first-out, visited on pop, goal on pop. h = 0 is uniform cost search.
function fAStar(gr, h, o) {
  o = o || {}; const start = o.start || fStart(gr), hh = (s) => h(s, gr);
  const heap = []; let seq = 0;
  const less = (a, b) => a.p < b.p || (a.p === b.p && a.n < b.n);
  const swap = (i, j) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t; };
  const push = (e) => { e.n = seq++; heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (less(heap[i], heap[p])) { swap(i, p); i = p; } else break; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; swap(i, m); i = m; } } return top; };
  push({ st: start, g: 0, path: '', p: hh(start) });
  const visited = new Set(); let expanded = 0, calls = 1;
  while (heap.length) {
    const e = pop(), k = fKey(gr, e.st);
    if (visited.has(k)) continue;
    if (fGoal(e.st)) return { found: true, path: e.path, cost: e.g, expanded, calls };
    visited.add(k); expanded++;
    fSucc(gr, e.st).forEach((s) => { if (!visited.has(fKey(gr, s.st))) { calls++; push({ st: s.st, g: e.g + 1, path: e.path + s.a, p: e.g + 1 + hh(s.st) }); } });
  }
  return { found: false, path: '', cost: null, expanded, calls };
}

// every state reachable from the start (only for small mazes) and the exact cost to finish from each
function fReach(gr) {
  if (gr._reach) return gr._reach;
  const start = fStart(gr), map = new Map([[fKey(gr, start), start]]), adj = new Map(), q = [start];
  for (let i = 0; i < q.length; i++) {
    const st = q[i], outs = [];
    fSucc(gr, st).forEach((s) => { const k = fKey(gr, s.st); outs.push(k); if (!map.has(k)) { map.set(k, s.st); q.push(s.st); } });
    adj.set(fKey(gr, st), outs);
  }
  return (gr._reach = { map, adj });
}
function fCostToGo(gr) {
  if (gr._ctg) return gr._ctg;
  const R = fReach(gr), rev = new Map(), d = new Map(), q = [];
  R.adj.forEach((outs, k) => outs.forEach((t) => { if (!rev.has(t)) rev.set(t, []); rev.get(t).push(k); }));
  R.map.forEach((st, k) => { if (fGoal(st)) { d.set(k, 0); q.push(k); } });
  for (let i = 0; i < q.length; i++) { const k = q[i]; (rev.get(k) || []).forEach((p) => { if (!d.has(p)) { d.set(p, d.get(k) + 1); q.push(p); } }); }
  return (gr._ctg = { reach: R, ctg: d });
}

// ---------------------------------------------------------------- heuristics (state, gr) -> number
const fromHere = (gr, s, d) => distMap(gr, d)[s.x + s.y * gr.W];            // walking distance from Pacman to dot d (the same as from d to Pacman)
const FH = {
  zero: { name: 'always 0', f: () => 0 },
  count: { name: 'number of dots left', f: (s) => popcount(s.f) },
  near: { name: 'Manhattan distance to the nearest dot', f: (s, gr) => { const l = dotsLeft(gr, s); return l.length ? Math.min.apply(null, l.map((d) => man([s.x, s.y], d))) : 0; } },
  max: { name: 'Manhattan distance to the farthest dot', f: (s, gr) => { const l = dotsLeft(gr, s); return l.length ? Math.max.apply(null, l.map((d) => man([s.x, s.y], d))) : 0; } },
  nearmaze: { name: 'walking distance to the nearest dot', f: (s, gr) => { const l = dotsLeft(gr, s); return l.length ? Math.min.apply(null, l.map((d) => fromHere(gr, s, d))) : 0; } },
  maxmaze: { name: 'walking distance to the farthest dot (your code)', f: (s, gr) => { let m = 0; dotsLeft(gr, s).forEach((d) => { m = Math.max(m, fromHere(gr, s, d)); }); return m; } },
  pair: { name: 'farthest pair of dots (walking distances)', f: (s, gr) => {
    const l = dotsLeft(gr, s); if (!l.length) return 0;
    let best = 0; l.forEach((d) => { best = Math.max(best, fromHere(gr, s, d)); });
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) best = Math.max(best, Math.min(fromHere(gr, s, l[i]), fromHere(gr, s, l[j])) + wdist(gr, l[i], l[j]));
    return best; } },
  summaze: { name: 'sum of walking distances to every dot', f: (s, gr) => { let t = 0; dotsLeft(gr, s).forEach((d) => { t += fromHere(gr, s, d); }); return t; } },
  twice: { name: 'twice the walking distance to the farthest dot', f: (s, gr) => 2 * FH.maxmaze.f(s, gr) }
};
// measure a heuristic over every reachable state (small mazes only)
function fAudit(gr, hf) {
  const c = fCostToGo(gr), R = c.reach; let adm = 0, cons = 0, neg = 0, goalBad = 0, nonTriv = 0, edges = 0, worst = null, over = null;
  const hv = new Map(); R.map.forEach((st, k) => hv.set(k, hf(st, gr)));
  R.map.forEach((st, k) => {
    const h = hv.get(k);
    if (h < 0) neg++;
    if (fGoal(st)) { if (h !== 0) goalBad++; } else if (h <= 0) nonTriv++;
    if (c.ctg.has(k) && h > c.ctg.get(k)) { adm++; if (!over || h - c.ctg.get(k) > over.h - over.t) over = { st, h, t: c.ctg.get(k) }; }
    (R.adj.get(k) || []).forEach((t) => { edges++; if (h - hv.get(t) > 1) { cons++; if (!worst) worst = { from: st, to: R.map.get(t), hf: h, ht: hv.get(t) }; } });
  });
  return { states: R.map.size, edges, notAdmissible: adm, notConsistent: cons, negative: neg, goalNonZero: goalBad, trivial: nonTriv, admissible: adm === 0, consistent: cons === 0, worst, over };
}
const trueCost = (gr, st) => { const c = fCostToGo(gr), k = fKey(gr, st); return c.ctg.has(k) ? c.ctg.get(k) : fAStar(gr, FH.pair.f, { start: st }).cost; };

// ---------------------------------------------------------------- the closest-dot agent
// the search AnyFoodSearchProblem + uniformCostSearch performs: breadth-first over positions, goal tested when popped (ties in the order N, S, E, W)
function anyFoodPath(gr, pos, foodSet) {
  const seen = new Set([cid(pos[0], pos[1])]), q = [{ p: pos, path: '' }];
  for (let h = 0; h < q.length; h++) {
    const e = q[h];
    if (foodSet.has(cid(e.p[0], e.p[1]))) return { path: e.path, target: e.p, seen: seen.size };
    for (const d of FDIRS) { const nx = e.p[0] + d[0], ny = e.p[1] + d[1]; if (gr.wall[nx][ny] || seen.has(cid(nx, ny))) continue; seen.add(cid(nx, ny)); q.push({ p: [nx, ny], path: e.path + d[2] }); }
  }
  return { path: '', target: null, seen: seen.size };
}
// the same problem solved with depthFirstSearch (a stack: the successor pushed last, West, is popped first)
function anyFoodDFS(gr, pos, foodSet) {
  const visited = new Set(), stack = [{ p: pos, path: '' }];
  while (stack.length) {
    const e = stack.pop(), k = cid(e.p[0], e.p[1]);
    if (visited.has(k)) continue;
    if (foodSet.has(k)) return { path: e.path, target: e.p };
    visited.add(k);
    for (const d of FDIRS) { const nx = e.p[0] + d[0], ny = e.p[1] + d[1]; if (gr.wall[nx][ny] || visited.has(cid(nx, ny))) continue; stack.push({ p: [nx, ny], path: e.path + d[2] }); }
  }
  return { path: '', target: null };
}
function agentRun(gr, o) {
  o = o || {}; const food = new Set(gr.dots.map((d) => cid(d[0], d[1])));
  let pos = (o.pos || gr.start).slice(), actions = '', order = [], segs = [];
  while (food.size) {
    const r = anyFoodPath(gr, pos, food); if (!r.target) break;
    segs.push({ from: pos.slice(), path: r.path, target: r.target });
    for (const a of r.path) { const d = FDIRS.find((q) => q[2] === a); pos = [pos[0] + d[0], pos[1] + d[1]]; if (food.has(cid(pos[0], pos[1]))) { food.delete(cid(pos[0], pos[1])); order.push(pos.slice()); } }
    actions += r.path;
  }
  return { actions, total: actions.length, order, segs, left: food.size };
}
// the plan as the list of cells it walks through, from a start cell
function walkCells(gr, pos, path) { const pts = [pos.slice()]; let x = pos[0], y = pos[1]; for (const a of path) { const d = FDIRS.find((q) => q[2] === a); x += d[0]; y += d[1]; pts.push([x, y]); } return pts; }

// ---------------------------------------------------------------- random mazes
function fRandMaze(r, o) {
  o = o || {};
  for (let t = 0; t < 600; t++) {
    const W = o.W || r.int(7, 11), Hh = o.H || r.int(6, 8), g = [];
    for (let ry = 0; ry < Hh; ry++) { g.push([]); for (let x = 0; x < W; x++) g[ry].push(x === 0 || ry === 0 || x === W - 1 || ry === Hh - 1 ? '%' : ' '); }
    const nw = o.walls === undefined ? r.int(2, 6) : o.walls;
    for (let k = 0; k < nw; k++) { const horiz = r.int(0, 1) === 0, len = r.int(1, 3), x0 = r.int(1, W - 2), y0 = r.int(1, Hh - 2); for (let i = 0; i < len; i++) { const x = horiz ? x0 + i : x0, y = horiz ? y0 : y0 + i; if (x > 0 && x < W - 1 && y > 0 && y < Hh - 1) g[y][x] = '%'; } }
    const cells = []; for (let ry = 1; ry < Hh - 1; ry++) for (let x = 1; x < W - 1; x++) if (g[ry][x] === ' ') cells.push([x, ry]);
    const nd = o.dots === undefined ? r.int(3, 6) : o.dots;
    if (cells.length < nd + 3) continue;
    const seen = new Set([cells[0].join()]), q = [cells[0]];
    for (let i = 0; i < q.length; i++) for (const d of FDIRS) { const nx = q[i][0] + d[0], ny = q[i][1] - d[1]; if (g[ny][nx] === '%' || seen.has(nx + ',' + ny)) continue; seen.add(nx + ',' + ny); q.push([nx, ny]); }
    if (seen.size !== cells.length) continue;
    const pick = r.shuffle(cells).slice(0, nd + 1);
    g[pick[0][1]][pick[0][0]] = 'P';
    for (let i = 1; i < pick.length; i++) g[pick[i][1]][pick[i][0]] = '.';
    return foodMaze(g.map((row) => row.join('')));
  }
  return foodMaze(['%%%%%%%%%', '%.  P  .%', '%       %', '%.     .%', '%%%%%%%%%']);
}

// ---------------------------------------------------------------- drawing
function fDraw(cv, gr, o) {
  o = o || {}; const opts = Object.assign({}, o), present = o.dots || gr.dots;
  opts.cs = o.cs || 20; opts.hidePellet = true;
  opts.dots = present.map((d) => ({ x: d[0], y: d[1], r: o.dotR || 0.2 }));
  opts.pac = o.noPac ? null : (o.pos || gr.start);
  drawGrid(cv, gr, opts);
}
let boardN = 0;
function fBoard(el, gr, o, cap) {
  const id = 'fbd' + (++boardN), box = document.createElement('div');
  box.innerHTML = canvasHTML(id) + (cap ? '<p class="cap">' + cap + '</p>' : '');
  el.appendChild(box); fDraw(box.querySelector('#' + id), gr, o); return box;
}
let demoN = 0;
function demoPair(el, items) {                         // boards side by side, each with a caption line
  const n = ++demoN;
  el.innerHTML = '<div class="pair">' + items.map((x, i) => '<div><h5>' + x.title + '</h5>' + canvasHTML('dp' + n + '_' + i) + '<div class="res ' + (x.ok ? 'ok' : 'bad') + '">' + x.text + '</div></div>').join('') + '</div>';
  items.forEach((x, i) => fDraw(el.querySelector('#dp' + n + '_' + i), x.gr, x.opts));
}
const mazeCache = {};
const getMaze = (n) => mazeCache[n] || (mazeCache[n] = foodMaze(H.DATA.mazes[n]));
function find(r, make, ok, tries) { let last; for (let t = 0; t < (tries || 150); t++) { last = make(r); if (ok(last)) return last; } H.findFails = (H.findFails || 0) + 1; return last; }
const stepsWord = (n) => '<b>' + n + '</b> ' + (n === 1 ? 'step' : 'steps');
const dotsHere = (gr, st) => dotsLeft(gr, st);
const foodEngine = () => ({ foodMaze, fStart, fGoal, fSucc, fAStar, fReach, fCostToGo, fAudit, trueCost, FH, distMap, wdist, dotsLeft, man, anyFoodPath, anyFoodDFS, agentRun, walkCells, fRandMaze, openCells, fKey, popcount });

// ---------------------------------------------------------------- does this engine agree with YOUR Python? (Q7)
function foodSelfCheck(DATA) {
  let ok = 0, total = 0;
  (DATA.golden || []).forEach((m) => {
    const gr = foodMaze(m.rows); let good = true;
    const mask = (dots) => { let f = 0; dots.forEach((d) => { f |= 1 << gr.dotIdx[cid(d[0], d[1])]; }); return f; };
    if (m.nreach !== null && fReach(gr).map.size !== m.nreach) good = false;
    m.samples.forEach((s) => { if (FH.maxmaze.f({ x: s.pos[0], y: s.pos[1], f: mask(s.dots) }, gr) !== s.h) good = false; });
    const a = fAStar(gr, FH.maxmaze.f), u = fAStar(gr, FH.zero.f);
    if (a.cost !== m.astar.cost || a.expanded !== m.astar.expanded || u.expanded !== m.ucs.expanded) good = false;
    total++; if (good) ok++;
  });
  return { ok, total, what: 'mazes', same: 'heuristic value at every sampled state, number of reachable states, A* cost and expansions with your heuristic, expansions with h = 0' };
}
// ---------------------------------------------------------------- does this engine agree with YOUR Python? (Q8)
function closestSelfCheck(DATA) {
  let ok = 0, total = 0;
  (DATA.golden || []).forEach((m) => {
    const gr = foodMaze(m.rows); let good = true;
    const food = new Set(gr.dots.map((d) => cid(d[0], d[1])));
    const first = anyFoodPath(gr, gr.start, food).path;
    if (first !== m.first.map((a) => a[0]).join('')) good = false;
    if (anyFoodDFS(gr, gr.start, food).path !== m.dfs.map((a) => a[0]).join('')) good = false;
    const goals = openCells(gr).filter((p) => food.has(cid(p[0], p[1]))).map((p) => cid(p[0], p[1])).join(' ');
    if (goals !== m.goals.map((p) => cid(p[0], p[1])).join(' ')) good = false;
    const run = agentRun(gr);
    if (run.total !== m.total || run.order.map((p) => cid(p[0], p[1])).join(' ') !== m.order.map((p) => cid(p[0], p[1])).join(' ')) good = false;
    total++; if (good) ok++;
  });
  return { ok, total, what: 'mazes', same: 'first path to the closest dot (and what depthFirstSearch would return), goal test on every cell, total cost and the order the dots are eaten' };
}
