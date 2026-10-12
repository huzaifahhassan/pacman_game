// Shared by bank_corners.js (Q5) and bank_cornersheur.js (Q6). build_eval.py puts this file in front of the bank.
// It is a JavaScript twin of your CornersProblem, BFS and A*, plus the helpers the questions need (random mazes, heuristic audits, drawing).
// State = { x, y, un } where `un` lists the corners still to visit as indices into self.corners: 0=(1,1) SW, 1=(1,top) NW, 2=(right,1) SE, 3=(right,top) NE.
const { esc, fmt, codeHTML, lineOf, textOf, parseMaze, drawGrid, canvasHTML } = H;
const O = (html, ok, why) => ({ html, ok: !!ok, why: why || '' });
const C = (s) => '<code>' + s + '</code>';

// ---------------------------------------------------------------- the problem
const CN = ['SW', 'NW', 'SE', 'NE'];
const CDIRS = [[0, 1, 'N', 'North'], [0, -1, 'S', 'South'], [1, 0, 'E', 'East'], [-1, 0, 'W', 'West']];     // the order getSuccessors tries them
const cornersOf = (gr) => [[1, 1], [1, gr.H - 2], [gr.W - 2, 1], [gr.W - 2, gr.H - 2]];
const man = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const ckey = (s) => s.x + ',' + s.y + ':' + s.un.join('');
const cid = (x, y) => x + ',' + y;
const ptS = (x, y) => '(' + x + ', ' + y + ')';
const unRepr = (gr, un) => { const cs = cornersOf(gr), items = un.map((i) => ptS(cs[i][0], cs[i][1])); return !items.length ? '()' : '(' + items.join(', ') + (items.length === 1 ? ',' : '') + ')'; };
const stRepr = (gr, st) => '(' + ptS(st.x, st.y) + ', ' + unRepr(gr, st.un) + ')';
const cnames = (un) => un.map((i) => CN[i]).join(', ') || 'none';
const withStart = (gr, pos) => Object.assign({}, gr, { start: pos.slice() });

function cStart(gr, o) {
  o = o || {}; const cs = cornersOf(gr), p = o.pos || gr.start, un = [];
  cs.forEach((c, i) => { if (o.keepStartCorner || !(c[0] === p[0] && c[1] === p[1])) un.push(i); });
  return { x: p[0], y: p[1], un };
}
const cGoal = (st) => st.un.length === 0;
function cSucc(gr, st, o) {
  o = o || {}; const cs = cornersOf(gr), res = [];
  for (const d of CDIRS) {
    const nx = st.x + d[0], ny = st.y + d[1];
    if (nx < 0 || ny < 0 || nx >= gr.W || ny >= gr.H) continue;
    if (!o.ignoreWalls && gr.wall[nx][ny]) continue;
    const at = o.lateRemove ? [st.x, st.y] : [nx, ny];
    res.push({ st: { x: nx, y: ny, un: o.neverRemove ? st.un.slice() : st.un.filter((i) => !(cs[i][0] === at[0] && cs[i][1] === at[1])) }, a: d[2], c: 1 });
  }
  return res;
}

// breadth-first search written like yours: a state is marked when it is queued, the goal is tested when it is popped.
function cBFS(gr, o) {
  o = o || {}; const start = o.start || cStart(gr, o), isGoal = o.isGoal || cGoal;
  const seen = new Set([ckey(start)]), q = [{ st: start, path: '' }], order = [];
  for (let head = 0; head < q.length; head++) {
    const e = q[head];
    if (isGoal(e.st)) return { found: true, path: e.path, cost: e.path.length, expanded: order.length, order, seen: seen.size, goal: e.st };
    order.push(e.st);
    cSucc(gr, e.st, o).forEach((s) => { const k = ckey(s.st); if (!seen.has(k)) { seen.add(k); q.push({ st: s.st, path: e.path + s.a }); } });
  }
  return { found: false, path: '', cost: null, expanded: order.length, order, seen: seen.size };
}

// A* written like yours: priority g + h, ties first-in-first-out, visited on pop, goal on pop.
function cAStar(gr, h, o) {
  o = o || {}; const start = o.start || cStart(gr, o), hh = (s) => h(s, gr);
  const heap = []; let seq = 0;
  const less = (a, b) => a.p < b.p || (a.p === b.p && a.n < b.n);
  const swap = (i, j) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t; };
  const push = (e) => { e.n = seq++; heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (less(heap[i], heap[p])) { swap(i, p); i = p; } else break; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; swap(i, m); i = m; } } return top; };
  push({ st: start, g: 0, path: '', p: hh(start) });
  const visited = new Set(), order = [];
  while (heap.length) {
    const e = pop();
    if (visited.has(ckey(e.st))) continue;
    if (cGoal(e.st)) return { found: true, path: e.path, cost: e.g, expanded: order.length, order };
    visited.add(ckey(e.st)); order.push(e.st);
    cSucc(gr, e.st, o).forEach((s) => { if (!visited.has(ckey(s.st))) push({ st: s.st, g: e.g + 1, path: e.path + s.a, p: e.g + 1 + hh(s.st) }); });
  }
  return { found: false, path: '', cost: null, expanded: order.length, order };
}

// every state reachable from the start (the goal is not a stopping point here) and the exact cost to finish from each of them
function cReach(gr, o) {
  const start = (o && o.start) || cStart(gr, o), map = new Map([[ckey(start), start]]), adj = new Map(), q = [start];
  for (let i = 0; i < q.length; i++) {
    const st = q[i], outs = [];
    cSucc(gr, st, o).forEach((s) => { const k = ckey(s.st); outs.push(k); if (!map.has(k)) { map.set(k, s.st); q.push(s.st); } });
    adj.set(ckey(st), outs);
  }
  return { map, adj, start };
}
function cCostToGo(gr) {
  if (gr._ctg) return gr._ctg;
  const R = cReach(gr), rev = new Map(), d = new Map(), q = [];
  R.adj.forEach((outs, k) => outs.forEach((t) => { if (!rev.has(t)) rev.set(t, []); rev.get(t).push(k); }));
  R.map.forEach((st, k) => { if (cGoal(st)) { d.set(k, 0); q.push(k); } });
  for (let i = 0; i < q.length; i++) { const k = q[i]; (rev.get(k) || []).forEach((p) => { if (!d.has(p)) { d.set(p, d.get(k) + 1); q.push(p); } }); }
  gr._ctg = { reach: R, ctg: d };
  return gr._ctg;
}
const trueCost = (gr, st) => { const k = ckey(st), c = cCostToGo(gr); return c.ctg.has(k) ? c.ctg.get(k) : cBFS(gr, { start: st }).cost; };
const openCells = (gr) => { let n = 0; for (let x = 0; x < gr.W; x++) for (let y = 0; y < gr.H; y++) if (!gr.wall[x][y]) n++; return n; };

// ---------------------------------------------------------------- distances and tours
function distFrom(gr, p) {
  gr._d = gr._d || {}; const k = p[0] + ',' + p[1]; if (gr._d[k]) return gr._d[k];
  const d = new Int32Array(gr.W * gr.H).fill(-1), q = [p[0] + p[1] * gr.W]; d[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const id = q[i], x = id % gr.W, y = (id - x) / gr.W;
    for (const dd of CDIRS) { const nx = x + dd[0], ny = y + dd[1]; if (gr.wall[nx][ny] || d[nx + ny * gr.W] >= 0) continue; d[nx + ny * gr.W] = d[id] + 1; q.push(nx + ny * gr.W); }
  }
  return (gr._d[k] = d);
}
const mdist = (gr, a, b) => distFrom(gr, a)[b[0] + b[1] * gr.W];
function perms(arr) {                       // same order as itertools.permutations
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => { perms(arr.slice(0, i).concat(arr.slice(i + 1))).forEach((p) => out.push([x].concat(p))); });
  return out;
}
// all orders of visiting the corners `un` from `pos`, with the cost of each order under the distance function `dist(gr, a, b)`
function tourCost(gr, pos, order, dist) { const cs = cornersOf(gr); let t = 0, here = pos; order.forEach((i) => { t += dist(gr, here, cs[i]); here = cs[i]; }); return t; }
function tours(gr, pos, un, dist) { return perms(un).map((order) => ({ order, cost: tourCost(gr, pos, order, dist) })); }
const manDist = (gr, a, b) => man(a, b);
const bestOf = (list) => { let b = null; list.forEach((x) => { if (b === null || x.cost < b.cost) b = x; }); return b; };       // strict <, so the first best wins, as in your code
const uniqueBest = (list) => { const b = bestOf(list); return list.filter((x) => x.cost === b.cost).length === 1; };
// the order in which a plan first touches each corner
function touchOrder(gr, pos, path) {
  const cs = cornersOf(gr), seen = [], pts = [pos.slice()]; let x = pos[0], y = pos[1];
  const hit = () => { cs.forEach((c, i) => { if (c[0] === x && c[1] === y && seen.indexOf(i) < 0) seen.push(i); }); };
  hit();
  for (const a of path) { const d = CDIRS.find((q) => q[2] === a); x += d[0]; y += d[1]; pts.push([x, y]); hit(); }
  return { order: seen, pts };
}
function walkOK(gr, pos, path) { let x = pos[0], y = pos[1]; for (const a of path) { const d = CDIRS.find((q) => q[2] === a); x += d[0]; y += d[1]; if (gr.wall[x][y]) return false; } return true; }

// ---------------------------------------------------------------- heuristics (state, gr) -> number
const nearestChain = (gr, s, dist) => { const cs = cornersOf(gr); let rest = s.un.slice(), here = [s.x, s.y], t = 0; while (rest.length) { let bi = 0; rest.forEach((i, k) => { if (dist(gr, here, cs[i]) < dist(gr, here, cs[rest[bi]])) bi = k; }); t += dist(gr, here, cs[rest[bi]]); here = cs[rest[bi]]; rest.splice(bi, 1); } return t; };
const perCorner = (gr, s, dist) => s.un.map((i) => dist(gr, [s.x, s.y], cornersOf(gr)[i]));
const HEUR = {
  tour: { name: 'best Manhattan tour (your code)', f: (s, gr) => (s.un.length ? bestOf(tours(gr, [s.x, s.y], s.un, manDist)).cost : 0) },
  zero: { name: 'always 0', f: () => 0 },
  count: { name: 'number of corners left', f: (s) => s.un.length },
  near: { name: 'Manhattan to the nearest corner only', f: (s, gr) => (s.un.length ? Math.min.apply(null, perCorner(gr, s, manDist)) : 0) },
  max: { name: 'Manhattan to the farthest corner', f: (s, gr) => (s.un.length ? Math.max.apply(null, perCorner(gr, s, manDist)) : 0) },
  sum: { name: 'sum of Manhattan to every corner', f: (s, gr) => perCorner(gr, s, manDist).reduce((a, b) => a + b, 0) },
  chain: { name: 'nearest-corner-next chain (Manhattan)', f: (s, gr) => nearestChain(gr, s, manDist) },
  twice: { name: '2 × the best Manhattan tour', f: (s, gr) => 2 * HEUR.tour.f(s, gr) },
  maxmaze: { name: 'real walking distance to the farthest corner', f: (s, gr) => (s.un.length ? Math.max.apply(null, perCorner(gr, s, mdist)) : 0) },
  tourmaze: { name: 'best tour using real walking distances', f: (s, gr) => (s.un.length ? bestOf(tours(gr, [s.x, s.y], s.un, mdist)).cost : 0) },
  fixed: { name: 'one fixed order (no permutations)', f: (s, gr) => tourCost(gr, [s.x, s.y], s.un, manDist) },
  worst: { name: 'the LONGEST Manhattan tour', f: (s, gr) => (s.un.length ? Math.max.apply(null, tours(gr, [s.x, s.y], s.un, manDist).map((t) => t.cost)) : 0) },
  oddzero: { name: 'the tour, but 0 whenever x is odd', f: (s, gr) => (s.x % 2 ? 0 : HEUR.tour.f(s, gr)) }
};
// measure a heuristic over every reachable state
function cAudit(gr, hf) {
  const c = cCostToGo(gr), R = c.reach; let adm = 0, cons = 0, neg = 0, goalBad = 0, edges = 0, worst = null;
  const hv = new Map(); R.map.forEach((st, k) => hv.set(k, hf(st, gr)));
  R.map.forEach((st, k) => {
    const h = hv.get(k);
    if (h < 0) neg++;
    if (cGoal(st) && h !== 0) goalBad++;
    if (c.ctg.has(k) && h > c.ctg.get(k)) adm++;
    (R.adj.get(k) || []).forEach((t) => { edges++; if (h - hv.get(t) > 1) { cons++; if (!worst) worst = { from: st, to: R.map.get(t), hf: h, ht: hv.get(t) }; } });
  });
  return { states: R.map.size, edges, notAdmissible: adm, notConsistent: cons, negative: neg, goalNonZero: goalBad, admissible: adm === 0, consistent: cons === 0, worst };
}
const expansions = (gr, hf) => cAStar(gr, hf.f || hf).expanded;

// ---------------------------------------------------------------- random mazes with the four corners open
function cRandMaze(r, o) {
  o = o || {};
  for (let t = 0; t < 600; t++) {
    const W = o.W || r.int(10, 13), Hh = o.H || r.int(7, 9), g = [];
    for (let ry = 0; ry < Hh; ry++) { g.push([]); for (let x = 0; x < W; x++) g[ry].push(x === 0 || ry === 0 || x === W - 1 || ry === Hh - 1 ? '%' : ' '); }
    const nseg = o.segs === undefined ? r.int(3, 5) : o.segs;
    for (let k = 0; k < nseg; k++) {
      const horiz = r.int(0, 1) === 0, len = r.int(2, horiz ? Math.max(2, W - 5) : Math.max(2, Hh - 4)), x0 = r.int(2, W - 3), y0 = r.int(2, Hh - 3);
      for (let i = 0; i < len; i++) { const x = horiz ? x0 + i : x0, y = horiz ? y0 : y0 + i; if (x > 0 && x < W - 1 && y > 0 && y < Hh - 1) g[y][x] = '%'; }
    }
    const crow = [1, Hh - 2], ccol = [1, W - 2];
    crow.forEach((ry) => ccol.forEach((x) => { g[ry][x] = '.'; }));
    const cells = []; for (let ry = 0; ry < Hh; ry++) for (let x = 0; x < W; x++) if (g[ry][x] !== '%') cells.push([x, ry]);
    const seen = new Set([cells[0][0] + ',' + cells[0][1]]), q = [cells[0]];
    for (let i = 0; i < q.length; i++) for (const d of CDIRS) { const nx = q[i][0] + d[0], ny = q[i][1] - d[1]; if (g[ny][nx] === '%' || seen.has(nx + ',' + ny)) continue; seen.add(nx + ',' + ny); q.push([nx, ny]); }
    if (seen.size !== cells.length) continue;
    if (o.minCells && cells.length < o.minCells) continue;
    const spots = cells.filter((c) => g[c[1]][c[0]] === ' ');
    let pc;
    if (o.startCorner !== undefined) { const ry = crow[o.startCorner % 2 === 0 ? 1 : 0], x = ccol[o.startCorner < 2 ? 0 : 1]; pc = [x, ry]; }
    else pc = o.startAnywhere ? r.pick(cells) : r.pick(spots);
    g[pc[1]][pc[0]] = 'P';
    if (o.noStartCorner && ((pc[0] === 1 || pc[0] === W - 2) && (pc[1] === 1 || pc[1] === Hh - 2))) continue;
    return parseMaze(g.map((row) => row.join('')));
  }
  return parseMaze(['%%%%%%%%%%', '%.      .%', '%        %', '%   P    %', '%        %', '%.      .%', '%%%%%%%%%%']);
}

// ---------------------------------------------------------------- drawing
function cDraw(cv, gr, o) {
  o = o || {}; const cs = cornersOf(gr), un = o.un || [0, 1, 2, 3];
  const opts = Object.assign({ cs: 20, hidePellet: true, dots: cs.map((c, i) => ({ x: c[0], y: c[1], hollow: un.indexOf(i) < 0 })) }, o);
  opts.pac = o.noPac ? null : (o.pos || gr.start);
  drawGrid(cv, gr, opts);
}
let boardN = 0;
function cBoard(el, gr, o, cap) {              // adds a labelled board to an element and draws it
  const id = 'cbd' + (++boardN), box = document.createElement('div');
  box.innerHTML = canvasHTML(id) + (cap ? '<p class="cap">' + cap + '</p>' : '');
  el.appendChild(box); cDraw(box.querySelector('#' + id), gr, o); return box;
}
const planPts = (gr, pos, path) => touchOrder(gr, pos, path).pts;
const noteRun = (run) => (run.found ? '<b>' + run.cost + '</b> steps' : 'no plan');

// ---------------------------------------------------------------- does this engine agree with YOUR Python?
// DATA.golden holds what your real CornersProblem / breadthFirstSearch / aStarSearch / cornersHeuristic did on 16 mazes.
function cornersSelfCheck(DATA) {
  let ok = 0, total = 0;
  (DATA.golden || []).forEach((m) => {
    const gr = parseMaze(m.rows), cs = cornersOf(gr);
    const toSt = (s) => ({ x: s[0][0], y: s[0][1], un: s[1].map((c) => cs.findIndex((q) => q[0] === c[0] && q[1] === c[1])) });
    let good = true;
    if (ckey(cStart(gr)) !== ckey(toSt(m.start))) good = false;
    if (cReach(gr).map.size !== m.nreach) good = false;
    m.samples.forEach((smp) => {
      const st = toSt(smp.s), mine = cSucc(gr, st);
      if (mine.length !== smp.out.length) good = false;
      else mine.forEach((s, i) => { const o = smp.out[i]; if (ckey(s.st) !== ckey(toSt(o[0])) || s.a !== o[1][0] || s.c !== o[2]) good = false; });
      if (cGoal(st) !== smp.goal) good = false;
      if (HEUR.tour.f(st, gr) !== smp.h) good = false;
    });
    const b = cBFS(gr), a = cAStar(gr, HEUR.tour.f);
    if (b.cost !== m.bfs.cost || b.expanded !== m.bfs.expanded) good = false;
    if (a.cost !== m.astar.cost || a.expanded !== m.astar.expanded) good = false;
    total++; if (good) ok++;
  });
  return { ok, total, what: 'mazes', same: 'start state, every successor in order, goal test, number of reachable states, BFS and A* cost and expansions, heuristic values' };
}

// ---------------------------------------------------------------- helpers shared by both Corners banks
const mazeCache = {};
const getMaze = (n) => mazeCache[n] || (mazeCache[n] = parseMaze(H.DATA.mazes[n]));      // parsed once: the audits cache their results on the maze object
const openList = (gr) => { const a = []; for (let x = 0; x < gr.W; x++) for (let y = 0; y < gr.H; y++) if (!gr.wall[x][y]) a.push([x, y]); return a; };
const isCorner = (gr, p) => cornersOf(gr).some((c) => c[0] === p[0] && c[1] === p[1]);
const openNbrs = (gr, p) => CDIRS.filter((d) => !gr.wall[p[0] + d[0]][p[1] + d[1]]);
function find(r, make, ok, tries) { let last; for (let t = 0; t < (tries || 150); t++) { last = make(r); if (ok(last)) return last; } H.findFails = (H.findFails || 0) + 1; return last; }
function walkPath(gr, a, b) {                          // shortest list of actions from cell a to cell b
  const W = gr.W, prev = new Map([[a[0] + a[1] * W, null]]), q = [a];
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (p[0] === b[0] && p[1] === b[1]) break;
    for (const d of CDIRS) { const nx = p[0] + d[0], ny = p[1] + d[1], id = nx + ny * W; if (gr.wall[nx][ny] || prev.has(id)) continue; prev.set(id, { from: p, a: d[2] }); q.push([nx, ny]); }
  }
  let s = '', cur = b;
  for (;;) { const e = prev.get(cur[0] + cur[1] * W); if (!e) break; s = e.a + s; cur = e.from; }
  return s;
}
const tourPlan = (gr, pos, order) => { const cs = cornersOf(gr); let here = pos, s = ''; order.forEach((i) => { s += walkPath(gr, here, cs[i]); here = cs[i]; }); return s; };
const idsOf = (gr, order) => order.map((i) => cid(cornersOf(gr)[i][0], cornersOf(gr)[i][1]));
const cornerWord = (i) => ['bottom-left', 'top-left', 'bottom-right', 'top-right'][i];
const stR = (gr, x, y, un) => stRepr(gr, { x, y, un });
const subsetsOf = (n) => { const out = []; for (let m = 0; m < (1 << n); m++) { const s = []; for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(i); out.push(s); } return out; };
const dotsFor = (gr, un) => cornersOf(gr).map((c, i) => ({ x: c[0], y: c[1], hollow: un.indexOf(i) < 0 }));
let demoN = 0;
function demoPair(el, items) {                         // two boards side by side, each with a caption line
  const n = ++demoN;
  el.innerHTML = '<div class="pair">' + items.map((x, i) => '<div><h5>' + x.title + '</h5>' + canvasHTML('dp' + n + '_' + i) + '<div class="res ' + (x.ok ? 'ok' : 'bad') + '">' + x.text + '</div></div>').join('') + '</div>';
  items.forEach((x, i) => cDraw(el.querySelector('#dp' + n + '_' + i), x.gr, x.opts));
}
// a maze with Pacman on a plain cell, picked so that the corners are all different from the start
const mazeFor = (r, o) => cRandMaze(r, Object.assign({ noStartCorner: true }, o || {}));
const stepsWord = (n) => '<b>' + n + '</b> ' + (n === 1 ? 'step' : 'steps');

// the pieces the checks in tools/evaluations (and nothing else) need from outside
const cornersEngine = () => ({ cornersOf, cStart, cGoal, cSucc, cBFS, cAStar, cReach, cCostToGo, trueCost, tours, bestOf, uniqueBest, touchOrder, mdist, manDist, HEUR, cAudit, cRandMaze, openCells, perms, expansions, stRepr, ckey });
