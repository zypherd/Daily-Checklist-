// ─── Navigation: occupancy grid + A*, obstacles, perches, collision helpers ──
const NAV = { cell: 0.15, w: 0, h: 0, grid: null, cost: null };
const CAT_R = 0.17;                          // cat body radius for planning

function addObstacle(o) { o.top = o.top ?? 1; W.obstacles.push(o); return o; }   // {type:'box',x0,x1,z0,z1,top} | {type:'circle',x,z,r,top}
function addPerch(p) {
  p.id = p.id || ('perch' + W.perches.length); p.links = p.links || []; p.occupants = new Set();
  p.comfort = p.comfort ?? 0.4; p.warmth = p.warmth ?? 0; p.view = p.view ?? 0; p.hw = p.hw ?? 0.2; p.hd = p.hd ?? 0.2; p.y = p.y ?? 0;
  p.approach = p.approach || [{ x: p.x, z: p.z + p.hd + 0.45 }];
  W.perches.push(p); return p;
}
function addInteract(i) { W.interactables.push(i); if (i.mesh) { i.mesh.userData.interact = i; } return i; }
const perchById = id => W.perches.find(p => p.id === id);

function buildNavGrid() {
  const cell = NAV.cell; NAV.w = Math.ceil(ROOM.w / cell); NAV.h = Math.ceil(ROOM.d / cell);
  const grid = new Uint8Array(NAV.w * NAV.h);       // 1 = blocked
  const cost = new Float32Array(NAV.w * NAV.h).fill(1);
  const pad = CAT_R + 0.04;
  for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) {
    const x = ROOM.x0 + (i + 0.5) * cell, z = ROOM.z0 + (j + 0.5) * cell;
    let blocked = x < ROOM.x0 + pad + 0.1 || x > ROOM.x1 - pad - 0.1 || z < ROOM.z0 + pad + 0.1 || z > ROOM.z1 - pad - 0.1;
    let near = false;
    for (const o of W.obstacles) {
      if (o.top < 0.12) continue;                       // things a cat simply steps over (rugs, mats)
      if (o.passable) continue;
      if (o.type === 'circle') { const d = Math.hypot(x - o.x, z - o.z); if (d < o.r + pad) blocked = true; else if (d < o.r + pad + 0.3) near = true; }
      else { const dx = Math.max(o.x0 - x, 0, x - o.x1), dz = Math.max(o.z0 - z, 0, z - o.z1); const d = Math.hypot(dx, dz); if (d < pad) blocked = true; else if (d < pad + 0.3) near = true; }
    }
    grid[j * NAV.w + i] = blocked ? 1 : 0; cost[j * NAV.w + i] = near ? 1.6 : 1;   // cats prefer a little clearance from furniture
  }
  NAV.grid = grid; NAV.cost = cost;
}
const toCell = (x, z) => [clamp(Math.floor((x - ROOM.x0) / NAV.cell), 0, NAV.w - 1), clamp(Math.floor((z - ROOM.z0) / NAV.cell), 0, NAV.h - 1)];
const cellCenter = (i, j) => [ROOM.x0 + (i + 0.5) * NAV.cell, ROOM.z0 + (j + 0.5) * NAV.cell];
const isFree = (i, j) => i >= 0 && j >= 0 && i < NAV.w && j < NAV.h && NAV.grid[j * NAV.w + i] === 0;
function nearestFree(x, z) {
  const [ci, cj] = toCell(x, z); if (isFree(ci, cj)) return [ci, cj];
  for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (isFree(ci + di, cj + dj)) return [ci + di, cj + dj]; }
  return null;
}
function randomFreePoint(minDistFrom = null, minDist = 1.5) {
  for (let k = 0; k < 40; k++) {
    const i = randi(0, NAV.w - 1), j = randi(0, NAV.h - 1);
    if (!isFree(i, j)) continue; const [x, z] = cellCenter(i, j);
    if (minDistFrom && dist2(x, z, minDistFrom.x, minDistFrom.z) < minDist) continue;
    return { x, z };
  }
  return { x: 0, z: 0 };
}

// A* on the grid with 8-connectivity, then string-pulled into a smooth waypoint list.
function findPath(sx, sz, tx, tz) {
  const s = nearestFree(sx, sz), t = nearestFree(tx, tz); if (!s || !t) return null;
  const W_ = NAV.w, H_ = NAV.h, N = W_ * H_;
  const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const si = s[1] * W_ + s[0], ti = t[1] * W_ + t[0];
  const h = (i) => { const x = i % W_, y = (i / W_) | 0; const dx = Math.abs(x - t[0]), dy = Math.abs(y - t[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  g[si] = 0; f[si] = h(si);
  const open = [si]; let iter = 0;                                     // binary heap
  const push = (i) => { open.push(i); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (f[open[p]] <= f[open[k]]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
  const pop = () => { const top = open[0]; const last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < open.length && f[open[l]] < f[open[m]]) m = l; if (r < open.length && f[open[r]] < f[open[m]]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (open.length && iter++ < 20000) {
    const cur = pop(); if (cur === ti) break; if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % W_, cy = (cur / W_) | 0;
    for (const [dx, dy, c] of dirs) {
      const nx = cx + dx, ny = cy + dy; if (!isFree(nx, ny)) continue;
      if (dx && dy && (!isFree(cx + dx, cy) || !isFree(cx, cy + dy))) continue;   // no corner cutting
      const ni = ny * W_ + nx; if (closed[ni]) continue;
      const ng = g[cur] + c * NAV.cost[ni]; if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + h(ni); came[ni] = cur; push(ni); }
    }
  }
  if (came[ti] === -1 && ti !== si) return null;
  const cells = []; let c = ti; while (c !== -1) { cells.push(c); c = came[c]; } cells.reverse();
  // string pulling
  const pts = cells.map(i => cellCenter(i % W_, (i / W_) | 0));
  const out = [pts[0]]; let a = 0;
  while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !lineFree(pts[a], pts[b])) b--; out.push(pts[b]); a = b; }
  out[out.length - 1] = [tx, tz];
  if (out.length > 1 && dist2(out[0][0], out[0][1], out[1][0], out[1][1]) < 0.1) out.shift();
  return out.map(p => ({ x: p[0], z: p[1] }));
}
function lineFree(a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (NAV.cell * 0.5)) + 1;
  for (let k = 0; k <= n; k++) { const t = k / n; const [i, j] = toCell(lerp(a[0], b[0], t), lerp(a[1], b[1], t)); if (!isFree(i, j)) return false; }
  return true;
}

// push a circle (x,z,r) out of obstacles & walls; returns corrected position. `ignoreTop` lets a cat standing on furniture ignore it.
function resolveCircle(x, z, r, { minTop = 0.12, ignore = null } = {}) {
  x = clamp(x, ROOM.x0 + r + 0.05, ROOM.x1 - r - 0.05); z = clamp(z, ROOM.z0 + r + 0.05, ROOM.z1 - r - 0.05);
  for (const o of W.obstacles) {
    if (o.top < minTop || o.passable || o === ignore) continue;
    if (o.type === 'circle') { const dx = x - o.x, dz = z - o.z; const d = Math.hypot(dx, dz) || 0.001; const min = o.r + r; if (d < min) { x = o.x + dx / d * min; z = o.z + dz / d * min; } }
    else {
      const cx = clamp(x, o.x0, o.x1), cz = clamp(z, o.z0, o.z1); const dx = x - cx, dz = z - cz; const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 0.0001) { x = cx + dx / d * r; z = cz + dz / d * r; }
        else { // inside: push out along the smallest penetration axis
          const px = Math.min(x - o.x0, o.x1 - x), pz = Math.min(z - o.z0, o.z1 - z);
          if (px < pz) x = (x - o.x0 < o.x1 - x) ? o.x0 - r : o.x1 + r; else z = (z - o.z0 < o.z1 - z) ? o.z0 - r : o.z1 + r;
        }
      }
    }
  }
  return [x, z];
}
// height of the highest obstacle top under a point (for furniture surfaces), 0 = floor
function surfaceHeightAt(x, z) {
  let top = 0;
  for (const o of W.obstacles) { if (o.passable) continue; const inside = o.type === 'circle' ? Math.hypot(x - o.x, z - o.z) <= o.r : (x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1); if (inside && o.top > top) top = o.top; }
  return top;
}
