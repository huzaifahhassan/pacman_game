// Used by bank_dstar.js (Q9). build_eval.py puts this file in front of the bank.
// A JavaScript twin of your DStarLite, the GridBelief sensor model and Pacman's walk, plus the helpers the questions need.
// Cells are numbered i = y * W + x with y growing upward (like Pacman). Neighbours come in the order of GridBelief.neighbors: up, down, right, left.
const { esc, codeHTML, lineOf, textOf, parseMaze, drawGrid, canvasHTML } = H;
const O = (html, ok, why) => ({ html, ok: !!ok, why: why || '' });
const C = (s) => '<code>' + s + '</code>';
const INF = Infinity;
const fm = (v) => (v === INF ? '∞' : String(v));
const keyStr = (k) => '[' + fm(k[0]) + ', ' + fm(k[1]) + ']';
const cmpKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
const cid = (x, y) => x + ',' + y;
const ptS = (x, y) => '(' + x + ', ' + y + ')';

const nbCache = {};
function nbTable(W, Hh) {
  const key = W + 'x' + Hh; if (nbCache[key]) return nbCache[key];
  const t = [];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const a = [];
    if (y + 1 < Hh) a.push((y + 1) * W + x);        // up
    if (y > 0) a.push((y - 1) * W + x);             // down
    if (x + 1 < W) a.push(y * W + x + 1);           // right
    if (x > 0) a.push(y * W + x - 1);               // left
    t.push(a);
  }
  return (nbCache[key] = t);
}
const manh = (W, a, b) => Math.abs((a % W) - (b % W)) + Math.abs(((a / W) | 0) - ((b / W) | 0));
function bfsDist(W, Hh, walls, src) {
  const d = new Int32Array(W * Hh).fill(-1), nb = nbTable(W, Hh), q = [src]; d[src] = 0;
  for (let i = 0; i < q.length; i++) for (const v of nb[q[i]]) if (!walls[v] && d[v] < 0) { d[v] = d[q[i]] + 1; q.push(v); }
  return d;
}

// ---------------------------------------------------------------- what Pacman knows (GridBelief)
class Belief {
  constructor(W, Hh, truth, radius) { this.W = W; this.H = Hh; this.truth = truth; this.r = radius; this.known = new Uint8Array(W * Hh); this.nb = nbTable(W, Hh); }
  nbrs(i) { return this.nb[i]; }
  cost(u, v) { return this.known[u] || this.known[v] ? INF : 1; }
  isKnownWall(i) { return !!this.known[i]; }
  sense(i) {                                         // reveal the walls in the square window around cell i; returns the newly found ones, column by column
    const W = this.W, x = i % W, y = (i - x) / W, found = [];
    for (let dx = -this.r; dx <= this.r; dx++) for (let dy = -this.r; dy <= this.r; dy++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) continue;
      const c = ny * W + nx; if (this.truth[c] && !this.known[c]) { this.known[c] = 1; found.push(c); }
    }
    return found;
  }
}

// ---------------------------------------------------------------- the open list: one entry per vertex, smallest key first, ties first in first out
class Open {
  constructor() { this.m = new Map(); this.c = 0; }
  get size() { return this.m.size; }
  has(s) { return this.m.has(s); }
  insert(s, k) { this.m.set(s, { k, n: this.c++ }); }
  remove(s) { this.m.delete(s); }
  best() { let bs = -1, be = null; for (const [s, e] of this.m) { if (be === null) { bs = s; be = e; continue; } const c = cmpKey(e.k, be.k); if (c < 0 || (c === 0 && e.n < be.n)) { bs = s; be = e; } } return be ? { s: bs, k: be.k } : null; }
  topKey() { const b = this.best(); return b ? b.k : [INF, INF]; }
  sorted() { return Array.from(this.m, ([s, e]) => ({ s, k: e.k, n: e.n })).sort((a, b) => cmpKey(a.k, b.k) || a.n - b.n); }
}

// ---------------------------------------------------------------- D* Lite, written like your dStarLite.py
class Lite {
  constructor(bel, goal, start) {
    this.bel = bel; this.W = bel.W; this.sGoal = goal; this.sStart = start; this.sLast = start; this.km = 0; this.pops = 0; this.popped = [];
    this.initialize();
  }
  h(a, b) { return manh(this.W, a, b); }
  initialize() { const n = this.bel.W * this.bel.H; this.U = new Open(); this.km = 0; this.g = new Array(n).fill(INF); this.rhs = new Array(n).fill(INF); this.rhs[this.sGoal] = 0; this.U.insert(this.sGoal, this.calculateKey(this.sGoal)); }
  calculateKey(s) { const smaller = Math.min(this.g[s], this.rhs[s]); return [smaller + this.h(this.sStart, s) + this.km, smaller]; }
  updateVertex(u) {
    if (u !== this.sGoal) { let best = INF; for (const s of this.bel.nbrs(u)) best = Math.min(best, this.bel.cost(u, s) + this.g[s]); this.rhs[u] = best; }
    this.U.remove(u);
    if (this.g[u] !== this.rhs[u]) this.U.insert(u, this.calculateKey(u));
  }
  needsWork(force) { if (!this.U.size) return false; if (force) return true; return cmpKey(this.U.topKey(), this.calculateKey(this.sStart)) < 0 || this.rhs[this.sStart] !== this.g[this.sStart]; }
  step(force) {                                      // one pass of the computeShortestPath loop, or null when the loop is over (force: ignore the stopping rule)
    if (!this.needsWork(force)) return null;
    const top = this.U.best(), u = top.s, kOld = top.k; this.U.remove(u); this.pops++; this.popped.push(u);
    const kNew = this.calculateKey(u), ev = { u, kOld, kNew, g0: this.g[u], rhs0: this.rhs[u], kind: '' };
    if (cmpKey(kOld, kNew) < 0) { this.U.insert(u, kNew); ev.kind = 'stale'; }
    else if (this.g[u] > this.rhs[u]) { this.g[u] = this.rhs[u]; ev.kind = 'over'; for (const s of this.bel.nbrs(u)) this.updateVertex(s); }
    else { this.g[u] = INF; ev.kind = 'under'; this.updateVertex(u); for (const s of this.bel.nbrs(u)) this.updateVertex(s); }
    return ev;
  }
  computeShortestPath() { while (this.step()) { /* keep repairing */ } }
  flood() { while (this.step(true)) { /* solve every reachable vertex, ignoring the stopping rule */ } }
  edgesChanged(cells) {                              // the first half of updateEdgeCosts: km, s_last and the updateVertex calls
    const before = this.km; this.km += this.h(this.sLast, this.sStart); this.sLast = this.sStart;
    for (const w of cells) { this.updateVertex(w); for (const s of this.bel.nbrs(w)) this.updateVertex(s); }
    return { before, after: this.km };
  }
  updateEdgeCosts(cells) { this.edgesChanged(cells); this.computeShortestPath(); }
  nextStep() {
    if (this.sStart === this.sGoal || this.g[this.sStart] === INF) return -1;
    let best = -1, bc = INF;
    for (const s of this.bel.nbrs(this.sStart)) { const c = this.bel.cost(this.sStart, s) + this.g[s]; if (c < bc) { best = s; bc = c; } }
    return best;
  }
}

// ---------------------------------------------------------------- Pacman walking through a hidden maze, exactly like the autograder's loop
function runDStar(rows, radius) {
  const gr = parseMaze(rows), W = gr.W, Hh = gr.H, truth = new Uint8Array(W * Hh);
  for (let x = 0; x < W; x++) for (let y = 0; y < Hh; y++) truth[y * W + x] = gr.wall[x][y] ? 1 : 0;
  const start = gr.start[1] * W + gr.start[0], goal = gr.goal[1] * W + gr.goal[0];
  const bel = new Belief(W, Hh, truth, radius); bel.sense(start);
  const L = new Lite(bel, goal, start), episodes = [];
  const rec = (found, run) => { const p0 = L.pops, h0 = L.popped.length; run(); episodes.push({ found, pops: L.pops - p0, popped: L.popped.slice(h0) }); };
  rec(0, () => L.computeShortestPath());
  let pos = start; const path = [pos];
  for (let guard = 0; guard < 4000; guard++) {
    if (pos === goal) break;
    const nx = L.nextStep(); if (nx < 0) break;
    pos = nx; L.sStart = pos; path.push(pos);
    const found = bel.sense(pos); if (found.length) rec(found.length, () => L.updateEdgeCosts(found));
  }
  return { W, H: Hh, path, episodes, km: L.km, total: L.pops, reached: pos === goal };
}
const xy = (W, i) => [i % W, (i / W) | 0];

// ---------------------------------------------------------------- small scenes for the questions: a grid whose walls are all known and whose distances are all solved
function mkScene(r, o) {
  o = o || {}; const W = o.W || 8, Hh = o.H || 5;
  for (let t = 0; t < 500; t++) {
    const walls = new Uint8Array(W * Hh), dens = o.dens === undefined ? 0.14 + r() * 0.1 : o.dens;
    for (let i = 0; i < W * Hh; i++) walls[i] = r() < dens ? 1 : 0;
    const robot = r.int(0, Hh - 1) * W + r.int(0, o.robotCols || 1), goal = r.int(0, Hh - 1) * W + r.int(W - 1 - (o.goalCols || 1), W - 1);
    walls[robot] = 0; walls[goal] = 0;
    const d = bfsDist(W, Hh, walls, goal); if (d[robot] < (o.minDist || 4)) continue;
    return buildScene(W, Hh, walls, robot, goal);
  }
  return null;
}
function buildScene(W, Hh, walls, robot, goal) {      // a scene from its parts; the distances are solved for every vertex
  const nb = nbTable(W, Hh), bel = { W, H: Hh, known: walls, nbrs: (i) => nb[i], cost: (u, v) => (walls[u] || walls[v] ? INF : 1), isKnownWall: (i) => !!walls[i] };
  const lite = new Lite(bel, goal, robot); lite.computeShortestPath(); lite.flood(); lite.popped = []; lite.pops = 0;
  return { W, H: Hh, walls, bel, lite, robot, goal };
}
const cloneScene = (sc) => buildScene(sc.W, sc.H, sc.walls.slice(), sc.robot, sc.goal);
const cellOk = (sc, i) => !sc.walls[i];
function pathCells(sc) { const L = sc.lite, p = [sc.robot]; let c = sc.robot, guard = 0; const saved = L.sStart; L.sStart = sc.robot; while (c !== sc.goal && guard++ < 200) { L.sStart = c; const nx = L.nextStep(); if (nx < 0) break; p.push(nx); c = nx; } L.sStart = saved; return p; }
function toggleWall(sc, cells) { cells.forEach((c) => { sc.walls[c] = sc.walls[c] ? 0 : 1; }); return sc.lite.edgesChanged(cells); }   // changes the maze and does the first half of updateEdgeCosts; the repair loop is left to the caller
const statusOf = (L, i) => (L.g[i] === L.rhs[i] ? 'ok' : L.g[i] > L.rhs[i] ? 'over' : 'under');
function inconsistent(sc) { const out = []; for (let i = 0; i < sc.W * sc.H; i++) if (sc.lite.g[i] !== sc.lite.rhs[i]) out.push(i); return out; }

// ---------------------------------------------------------------- drawing: g (blue, top left) and rhs (amber, bottom right) in every cell
const COL_G = '#8fb4ff', COL_R = '#ffc766', COL_Q = '#f2b955', COL_W = '#e8edfb';
function sceneGr(sc) {
  const wall = [], cost = []; for (let x = 0; x < sc.W; x++) { wall.push([]); cost.push([]); for (let y = 0; y < sc.H; y++) { wall[x].push(!!sc.walls[y * sc.W + x]); cost[x].push(wall[x][y] ? null : 1); } }
  const g = xy(sc.W, sc.goal), s = xy(sc.W, sc.robot);
  return { W: sc.W, H: sc.H, wall, cost, start: s, goal: g };
}
function sceneDraw(sc, o) {                           // options for drawGrid; o: { showG, showRhs, queue, tint, cs, marks, extraLabels, last }
  o = o || {}; const L = sc.lite, labels = [], tints = {}, inU = new Set(L.U.sorted().map((e) => e.s));
  for (let i = 0; i < sc.W * sc.H; i++) {
    const [x, y] = xy(sc.W, i), interesting = !sc.walls[i] || inU.has(i) || L.g[i] !== INF || L.rhs[i] !== INF;
    if (!interesting) continue;
    if (o.showG !== false) labels.push({ x, y, text: fm(L.g[i]), at: 'tl', color: COL_G });
    if (o.showRhs !== false) labels.push({ x, y, text: fm(L.rhs[i]), at: 'br', color: COL_R });
    if (o.queue !== false && inU.has(i)) labels.push({ x, y, text: '●', at: 'tr', color: COL_Q, size: Math.round((o.cs || 46) * 0.4) });
    if (o.tint !== false && L.g[i] !== L.rhs[i]) tints[cid(x, y)] = L.g[i] > L.rhs[i] ? 'over' : 'under';
  }
  (o.extraLabels || []).forEach((l) => labels.push(l));
  const dots = o.last !== undefined ? [{ x: xy(sc.W, o.last)[0], y: xy(sc.W, o.last)[1], hollow: true, r: 0.36 }] : [];
  const out = { cs: o.cs || 46, pac: xy(sc.W, sc.robot), pacR: o.pacR || 0.2, pelletR: 0.13, labels, tints, dots };
  if (o.hidePellet) out.hidePellet = true;
  if (o.marks) out.marks = o.marks;                    // only when given, so the student's own picks are not overwritten
  return out;
}
let boardN = 0;
function lBoard(el, sc, o, cap) {
  const id = 'lbd' + (++boardN), box = document.createElement('div');
  box.innerHTML = canvasHTML(id) + (cap ? '<p class="cap">' + cap + '</p>' : '');
  el.appendChild(box); drawGrid(box.querySelector('#' + id), sceneGr(sc), sceneDraw(sc, o)); return box;
}
const LEGEND = 'blue number top left: g · amber number bottom right: rhs · green tint: g > rhs · red tint: g < rhs · dot top right: in U';
let demoN = 0;
function demoPair(el, items) {
  const n = ++demoN;
  el.innerHTML = '<div class="pair">' + items.map((x, i) => '<div><h5>' + x.title + '</h5>' + canvasHTML('dp' + n + '_' + i) + '<div class="res ' + (x.ok ? 'ok' : 'bad') + '">' + x.text + '</div></div>').join('') + '</div>';
  items.forEach((x, i) => drawGrid(el.querySelector('#dp' + n + '_' + i), sceneGr(x.sc), sceneDraw(x.sc, x.o)));
}
function find(r, make, ok, tries) { let last; for (let t = 0; t < (tries || 200); t++) { last = make(r); if (last && ok(last)) return last; } H.findFails = (H.findFails || 0) + 1; return last; }
function codeOf(methods, o) {                         // your code, only the methods named
  const all = H.DATA.code.lines; H.DATA.code.lines = all.filter((l) => methods.indexOf(l.m) >= 0);
  try { return codeHTML(o); } finally { H.DATA.code.lines = all; }
}
const dstarEngine = () => ({ buildScene, cloneScene, Lite, Belief, Open, runDStar, mkScene, toggleWall, pathCells, statusOf, inconsistent, bfsDist, nbTable, manh, cmpKey, sceneGr, sceneDraw, xy });

// ---------------------------------------------------------------- does this engine agree with YOUR Python?
function dstarSelfCheck(DATA) {
  let ok = 0, total = 0;
  (DATA.golden || []).forEach((m) => {
    total++; const run = runDStar(m.rows, m.radius), W = run.W; let good = true;
    const same = (a, b) => a.length === b.length && a.every((c, i) => c[0] === b[i][0] && c[1] === b[i][1]);
    if (run.total !== m.total || run.km !== m.km || run.reached !== m.reached || run.episodes.length !== m.episodes.length) good = false;
    if (good && !same(run.path.map((i) => xy(W, i)), m.path)) good = false;
    if (good) m.episodes.forEach((e, k) => { const mine = run.episodes[k]; if (mine.pops !== e.pops || mine.found !== e.found) good = false; else if (e.popped && !same(mine.popped.map((i) => xy(W, i)), e.popped)) good = false; });
    if (good) ok++;
  });
  return { ok, total, what: 'mazes', same: 'Pacman\'s whole path, the vertices popped in every planning episode and their order, km and the total number of expansions' };
}
