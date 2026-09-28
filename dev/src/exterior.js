// ─── Outside: a beach resort — deck, pool, white sand, thatched huts, palms, ocean & the towers ──
const EXT = { deckZ0: ROOM.z1, deckZ1: 9.5, poolZ0: 10.4, poolZ1: 16.6, poolX0: -4.5, poolX1: 7.0, sandZ0: 19.5, sandY: -1.2, shoreZ: 31, palms: [], torches: [], huts: [] };

// height of the ground under a walker: the terrace and pool paving sit at 0, the beach a step below, joined by the stairs at x ≈ 1.2
function groundY(x, z) {
  if (z > 19.6 && x > -0.45 && x < 2.85) { const i = Math.floor((z - 19.6) / 0.45); return i > 4 ? EXT.sandY : -0.24 * Math.min(i, 4); }
  if (z > 20.1 || x < -13.5) return EXT.sandY;
  return 0;
}
function frondTexture() {
  const [c, ctx] = canvas2d(256, 512); ctx.clearRect(0, 0, 256, 512); ctx.translate(0, 512); ctx.scale(1, -1);
  for (let i = 0; i < 84; i++) { const y = 10 + i * 5.9; const len = 124 * Math.sin(Math.min(1, (i + 5) / 34) * Math.PI * 0.5) * (1 - i / 92); const g = ctx.createLinearGradient(128, y, 128 + len, y); g.addColorStop(0, '#4a8a2c'); g.addColorStop(0.6, '#5ea63a'); g.addColorStop(1, '#b7d76a'); ctx.strokeStyle = g; ctx.lineWidth = 7.5; ctx.lineCap = 'round'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(128, y); ctx.lineTo(128 + s * len, y + 26 + i * 0.35); ctx.stroke(); }); }
  ctx.strokeStyle = '#7a8f3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(128, 512); ctx.lineTo(128, 6); ctx.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function thatchTexture() {
  const [c, ctx] = canvas2d(512, 512); const N = makeNoise(91); const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const streak = N.n2(x * 0.9, y * 0.04) * 22 + N.fbm(x / 40, y / 40, 3) * 18; const row = Math.sin(y * 0.25) * 8; const base = [176 + streak + row, 140 + streak * 0.9 + row, 88 + streak * 0.6 + row]; const i = (y * 512 + x) * 4; img.data[i] = clamp(base[0], 0, 255); img.data[i + 1] = clamp(base[1], 0, 255); img.data[i + 2] = clamp(base[2], 0, 255); img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0); return toTexture(c, { repeat: [3, 2] });
}
function sandTexture() {
  const [c, ctx] = canvas2d(512, 512); const N = makeNoise(53); const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const n = N.fbm(x / 90, y / 90, 4) * 10 + N.n2(x * 1.7, y * 1.7) * 7; const i = (y * 512 + x) * 4; img.data[i] = clamp(243 + n, 0, 255); img.data[i + 1] = clamp(236 + n, 0, 255); img.data[i + 2] = clamp(220 + n, 0, 255); img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0); return toTexture(c, { repeat: [40, 12] });
}
function stoneTexture() {
  const [c, ctx] = canvas2d(512, 256); ctx.fillStyle = '#8d7b66'; ctx.fillRect(0, 0, 512, 256); const N = makeNoise(63);
  let y = 0; while (y < 256) { const h = 14 + Math.floor(Math.abs(N.n2(y, 1)) * 18); let x = -20; while (x < 512) { const w = 40 + Math.floor(Math.abs(N.n2(x, y)) * 80); const l = 120 + N.fbm(x / 50, y / 50, 2) * 60; ctx.fillStyle = `rgb(${l + 60},${l + 30},${l})`; ctx.fillRect(x + 2, y + 2, w - 3, h - 3); x += w; } y += h; }
  return toTexture(c, { repeat: [2, 1] });
}
function cloudTexture() { const [c, ctx] = canvas2d(256, 128); for (let i = 0; i < 14; i++) { const g = ctx.createRadialGradient(40 + i * 14 + rand(-8, 8), 70 + rand(-14, 14), 4, 40 + i * 14, 70, 34 + rand(0, 14)); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

const WATER_VERT = `#include <fog_pars_vertex>
uniform float time, scale, amp, shoreZ, isPool; varying vec3 vW; varying float vH;
float wave(vec2 p, float t){ return sin(p.x*0.7+p.y*0.45+t*1.2)*0.5 + sin(p.x*1.6-p.y*1.1+t*1.9)*0.28 + sin(p.y*3.1+p.x*0.8+t*2.7)*0.14 + sin(p.x*5.3+p.y*4.1+t*3.4)*0.07; }
float swell(vec2 p, float t){ return sin(p.y*0.25 - t*0.9 + sin(p.x*0.07)*1.5) * 0.7 + sin(p.y*0.11 - t*0.5 + p.x*0.03) * 0.3; }
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float depthFade = (1.0 - isPool) * smoothstep(0.0, 6.0, wp.z - shoreZ);
  float h = (wave(wp.xz * scale, time) * 0.35 + swell(wp.xz, time)) * amp * depthFade;
  wp.y += h; vW = wp.xyz; vH = h;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = `#include <fog_pars_fragment>
uniform float time, scale, shoreZ, isPool, amp, ambient; uniform vec3 sunDir, camPos, shallow, deep, sunColor, skyColor; varying vec3 vW; varying float vH;
float wave(vec2 p, float t){ return sin(p.x*0.7+p.y*0.45+t*1.2)*0.5 + sin(p.x*1.6-p.y*1.1+t*1.9)*0.28 + sin(p.y*3.1+p.x*0.8+t*2.7)*0.14 + sin(p.x*5.3+p.y*4.1+t*3.4)*0.07; }
float swell(vec2 p, float t){ return sin(p.y*0.25 - t*0.9 + sin(p.x*0.07)*1.5) * 0.7 + sin(p.y*0.11 - t*0.5 + p.x*0.03) * 0.3; }
void main(){ vec2 p = vW.xz * scale; float e = 0.08; float h0 = wave(p, time), hx = wave(p + vec2(e, 0.0), time), hz = wave(p + vec2(0.0, e), time);
  float se = 0.5; float s0 = swell(vW.xz, time), sx = swell(vW.xz + vec2(se, 0.0), time), sz = swell(vW.xz + vec2(0.0, se), time); float df = (1.0 - isPool) * smoothstep(0.0, 6.0, vW.z - shoreZ) * amp;
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.05 - (sx - s0) / se * df * 1.2, 1.0, -(hz - h0) / e * 0.05 - (sz - s0) / se * df * 1.2));
  vec3 V = normalize(camPos - vW); float ndv = max(dot(n, V), 0.0); float fres = pow(1.0 - ndv, 3.0);
  float d = length(vW.xz - camPos.xz); vec3 base = mix(shallow, deep, smoothstep(3.0, 70.0, d) * (1.0 - isPool * 0.7)) * ambient;
  vec3 R = reflect(-normalize(sunDir), n); float rv = max(dot(R, V), 0.0); float spec = pow(rv, 300.0) * 3.5 + pow(rv, 20.0) * 0.22;
  vec3 col = mix(base, skyColor, 0.12 + fres * 0.55) + sunColor * spec * clamp(sunDir.y * 4.0, 0.0, 1.0);
  float foam = (1.0 - isPool) * smoothstep(3.0, 0.0, abs(vW.z - shoreZ - 0.9 * sin(time * 0.6 + vW.x * 0.25))) * (0.35 + 0.65 * step(0.6, fract(h0 * 0.8 + vW.x * 0.11 + time * 0.04)));
  float crest = (1.0 - isPool) * smoothstep(0.55, 0.95, s0) * smoothstep(0.2, 1.0, df) * smoothstep(20.0, 4.0, vW.z - shoreZ) * (0.5 + 0.5 * step(0.5, fract(h0 * 1.3 + vW.x * 0.3)));   // breaking crests near the shore
  col = mix(col, vec3(0.96, 0.97, 0.98), clamp(foam * 0.75 + crest * 0.6, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0 - isPool * 0.42);
  #include <fog_fragment>
}`;
function waterMaterial(pool) {
  return new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true, transparent: !!pool, depthWrite: !pool, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, ambient: { value: 1 }, scale: { value: pool ? 2.2 : 0.35 }, amp: { value: pool ? 0.0 : 0.16 }, shoreZ: { value: EXT.shoreZ }, isPool: { value: pool ? 1 : 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, camPos: { value: new THREE.Vector3() },
    shallow: { value: new THREE.Color(pool ? 0x4fd0e0 : 0x5fd6d0) }, deep: { value: new THREE.Color(pool ? 0x1f9ec0 : 0x1a6fa6) }, sunColor: { value: new THREE.Color(0xfff2d0) }, skyColor: { value: new THREE.Color(0xbfd8ee) } }]) });
}

const BX = new Batcher();   // static exterior geometry, merged per material
const m4c = (pos, quat, sc = 1) => new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(sc, sc, sc));
function palmTree(x, z, { h = 6.5, lean = 0.18, dir = rand(TAU), scale = 1, y = 0 } = {}) {
  const segs = 9; let px = 0, py = y, pz = 0; const lx = Math.sin(dir) * lean, lz = Math.cos(dir) * lean;
  addObstacle({ type: 'circle', x, z, r: 0.24 * scale, top: 3, kind: 'palm', playerOnly: true });
  for (let i = 0; i < segs; i++) {
    const t = i / segs, t2 = (i + 1) / segs; const r0 = lerp(0.2, 0.11, t) * scale, r1 = lerp(0.2, 0.11, t2) * scale;
    const x0 = lx * h * t * t, x1 = lx * h * t2 * t2, z0 = lz * h * t * t, z1 = lz * h * t2 * t2; const y0 = y + t * h, y1 = y + t2 * h;
    const dirv = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0); const len = dirv.length(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirv.clone().normalize());
    BX.add(G.cyl(r1, r0, len + 0.05, 10), 'palmTrunk', m4c(new THREE.Vector3(x + (x0 + x1) / 2, (y0 + y1) / 2, z + (z0 + z1) / 2), q)); px = x1; py = y1; pz = z1;
  }
  // crown: fronds merged into one mesh so the whole crown can sway as a unit
  const parts = []; const n = 18;
  for (let i = 0; i < n + 3; i++) {
    const dead = i >= n; const yaw = (i / n) * TAU + rand(-0.2, 0.2); const rise = dead ? -1.35 : rand(-0.05, 0.55); const bend = dead ? 0.25 : rand(0.28, 0.5);
    const len = (dead ? 2.0 : rand(2.4, 3.2)) * scale; const g = new THREE.PlaneGeometry(0.95 * scale, len, 1, 10); const pa = g.attributes.position;
    for (let k = 0; k < pa.count; k++) { const u = (pa.getY(k) + len / 2) / len; const x = pa.getX(k); pa.setXYZ(k, x * (1 - u * 0.35), len * u, -bend * u * u * len * 1.1 + Math.abs(x) * 0.25 * u); }   // arch outward then droop, leaflets cupping
    g.computeVertexNormals(); g.applyMatrix4(mat(0, 0, 0, 0, { rx: -Math.PI / 2 + rise })); g.applyMatrix4(mat(0, dead ? -0.1 : 0, 0, yaw)); if (dead) g.applyMatrix4(mat(0, 0, 0, 0, { sx: 0.8, sy: 0.8, sz: 0.8 }));
    parts.push(g);
  }
  const crown = new THREE.Mesh(mergeGeometries(parts, false), M.frond); crown.position.set(x + px, py, z + pz); crown.castShadow = true; crown.userData = { sway: rand(TAU) }; W.scene.add(crown); EXT.palms.push(crown);
  BX.add(G.sph(0.22 * scale, 10, 8), 'palmBoot', mat(x + px, py - 0.05, z + pz, 0, { sy: 1.3 }));
  for (let i = 0; i < 4; i++) BX.add(G.sph(0.09 * scale, 8, 6), 'coconut', mat(x + px + rand(-0.15, 0.15), py - 0.12, z + pz + rand(-0.15, 0.15)));
}
function tikiHut(x, z, ry = 0, scale = 1, y = 0) {
  const f = mat(x, y, z, ry, { sx: scale, sy: scale, sz: scale }); EXT.huts.push({ x, y, z, ry, scale });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { BX.add(G.cyl(0.07, 0.08, 2.3, 8), 'palmTrunk', f.clone().multiply(mat(a, 1.15, b))); const p = new THREE.Vector3(a, 0, b).applyMatrix4(f); addObstacle({ type: 'circle', x: p.x, z: p.z, r: 0.12, top: 2.3, kind: 'post', playerOnly: true }); });
  const tp = new THREE.Vector3(0, 0, -0.3).applyMatrix4(f); addObstacle({ type: 'circle', x: tp.x, z: tp.z, r: 0.3, top: 0.5, kind: 'huttable', playerOnly: true });
  BX.add(G.cyl(0.05, 0.05, 2.3, 6), 'palmTrunk', f.clone().multiply(mat(0, 2.35, 0, 0, { rx: Math.PI / 2 }))); BX.add(G.cyl(0.05, 0.05, 2.3, 6), 'palmTrunk', f.clone().multiply(mat(0, 2.35, 0, Math.PI / 2, { rx: Math.PI / 2 })));
  BX.add(new THREE.ConeGeometry(2.1, 1.25, 4, 1), 'thatch', f.clone().multiply(mat(0, 2.95, 0, Math.PI / 4)));
  BX.add(new THREE.ConeGeometry(2.05, 1.2, 4, 1, true), 'thatchDark', f.clone().multiply(mat(0, 2.93, 0, Math.PI / 4)));
  BX.add(new THREE.CylinderGeometry(2.15, 2.25, 0.22, 4, 1, true), 'thatch', f.clone().multiply(mat(0, 2.3, 0, Math.PI / 4)));
  loungeChair(f, -0.55, 0.2, 0); loungeChair(f, 0.55, 0.2, 0); BX.add(G.cyl(0.25, 0.25, 0.04, 12), 'darkwood', f.clone().multiply(mat(0, 0.45, -0.3))); BX.add(G.cyl(0.03, 0.03, 0.45, 6), 'darkwood', f.clone().multiply(mat(0, 0.22, -0.3)));
}
function loungeChair(f, x, z, ry) {
  const c = f.clone().multiply(mat(x, 0, z, ry)); const lc = new THREE.Vector3(0, 0, 0).applyMatrix4(c); addObstacle({ type: 'circle', x: lc.x, z: lc.z, r: 0.55, top: 0.6, kind: 'lounger', playerOnly: true });
  BX.add(G.rbox(0.62, 0.09, 1.3, 0.03), 'lounger', c.clone().multiply(mat(0, 0.36, 0.2))); BX.add(G.rbox(0.62, 0.09, 0.7, 0.03), 'lounger', c.clone().multiply(mat(0, 0.6, -0.55, 0, { rx: -0.75 })));
  [[-0.27, 0.7], [0.27, 0.7], [-0.27, -0.3], [0.27, -0.3]].forEach(([lx, lz]) => BX.add(G.box(0.05, 0.32, 0.05), 'darkwood', c.clone().multiply(mat(lx, 0.16, lz))));
}
function umbrella(f, x, z) { const c = f.clone().multiply(mat(x, 0, z)); BX.add(G.cyl(0.03, 0.03, 2.4, 8), 'steelDark', c.clone().multiply(mat(0, 1.2, 0))); BX.add(new THREE.ConeGeometry(1.25, 0.45, 10, 1), 'umbrella', c.clone().multiply(mat(0, 2.3, 0))); }
function towerBuilding(x, z, w, d, floors, ry = 0) {
  const f = mat(x, 0, z, ry); const fh = 3.1, h = floors * fh;
  BX.add(G.box(w, h, d), 'tower', f.clone().multiply(mat(0, h / 2, 0))); BX.add(G.box(w + 0.6, 0.5, d + 0.6), 'towerTrim', f.clone().multiply(mat(0, h + 0.25, 0)));
  for (let fl = 1; fl < floors; fl++) {
    BX.add(G.rbox(w + 0.5, 0.18, 1.1, 0.06), 'towerTrim', f.clone().multiply(mat(0, fl * fh + 0.2, d / 2 + 0.55))); BX.add(G.box(w - 1.2, 2.2, 0.06), 'bWindow', f.clone().multiply(mat(0, fl * fh + 1.5, d / 2 + 0.03))); BX.add(G.box(w + 0.5, 0.9, 0.04), 'towerRail', f.clone().multiply(mat(0, fl * fh + 0.75, d / 2 + 1.1)));
    BX.add(G.rbox(1.1, 0.18, d + 0.5, 0.06), 'towerTrim', f.clone().multiply(mat(-w / 2 - 0.55, fl * fh + 0.2, 0))); BX.add(G.box(0.06, 2.2, d - 1.2), 'bWindow', f.clone().multiply(mat(-w / 2 - 0.03, fl * fh + 1.5, 0))); BX.add(G.box(0.04, 0.9, d + 0.5), 'towerRail', f.clone().multiply(mat(-w / 2 - 1.1, fl * fh + 0.75, 0)));
  }
  W.exteriorWindows = W.exteriorWindows || [true];
}
function planter(x0, x1, z, { depth = 0.6, h = 0.55 } = {}) {
  const w = x1 - x0, cx = (x0 + x1) / 2; addObstacle({ type: 'box', x0, x1, z0: z - depth / 2, z1: z + depth / 2, top: h + 0.4, kind: 'planter', playerOnly: true }); BX.add(G.box(w, h, depth), 'stone', mat(cx, h / 2, z)); BX.add(G.rbox(w - 0.2, 0.45, depth - 0.15, 0.12, 4), 'hedge', mat(cx, h + 0.2, z));
  for (let i = 0; i < w * 22; i++) BX.add(G.sph(0.022, 6, 5), Math.random() < 0.72 ? 'flowerPink' : 'flowerWhite', mat(x0 + 0.15 + rand(0, w - 0.3), h + 0.36 + rand(0, 0.16), z + rand(-depth / 2 + 0.1, depth / 2 - 0.1)));
  for (let i = 0; i < w * 14; i++) BX.add(G.sph(0.035, 6, 5), 'hedge', mat(x0 + 0.15 + rand(0, w - 0.3), h + 0.3 + rand(0, 0.14), z + rand(-depth / 2 + 0.08, depth / 2 - 0.08), 0, { sy: 0.5 }));
}
function palapa(x, z) {   // thatched entrance canopy on four posts
  const f = mat(x, 0, z, 0);
  [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]].forEach(([a, b]) => { BX.add(G.cyl(0.09, 0.1, 2.9, 10), 'palmTrunk', f.clone().multiply(mat(a, 1.45, b))); addObstacle({ type: 'circle', x: x + a, z: z + b, r: 0.13, top: 2.9, kind: 'post', playerOnly: true }); });
  BX.add(new THREE.ConeGeometry(2.4, 1.5, 4, 1), 'thatch', f.clone().multiply(mat(0, 3.55, 0, Math.PI / 4, { sz: 0.75 }))); BX.add(new THREE.ConeGeometry(2.35, 1.45, 4, 1, true), 'thatchDark', f.clone().multiply(mat(0, 3.53, 0, Math.PI / 4, { sz: 0.75 })));
  BX.add(new THREE.CylinderGeometry(2.45, 2.55, 0.24, 4, 1, true), 'thatch', f.clone().multiply(mat(0, 2.85, 0, Math.PI / 4, { sz: 0.75 })));
  BX.add(G.cyl(0.06, 0.06, 2.6, 6), 'palmTrunk', f.clone().multiply(mat(0, 2.95, 0.9, 0, { rz: Math.PI / 2 }))); BX.add(G.cyl(0.06, 0.06, 2.6, 6), 'palmTrunk', f.clone().multiply(mat(0, 2.95, -0.9, 0, { rz: Math.PI / 2 })));
}
function tikiTorch(x, z) { addObstacle({ type: 'circle', x, z, r: 0.1, top: 1.8, kind: 'torch', playerOnly: true }); BX.add(G.cyl(0.03, 0.04, 1.8, 6), 'palmTrunk', mat(x, 0.9, z)); BX.add(G.cyl(0.08, 0.05, 0.2, 8), 'black', mat(x, 1.85, z)); const flame = new THREE.Mesh(G.sph(0.07, 8, 6), M.bulbOff); flame.position.set(x, 2.0, z); flame.scale.set(1, 1.6, 1); W.scene.add(flame); EXT.torches.push(flame); return flame; }

function buildExteriorMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.sand = std({ map: sandTexture(), roughness: 1 });
  M.wetSand = std({ color: 0xcdbfa6, roughness: 0.6 });
  M.deck = std({ map: toTexture(woodTexture({ hue: 30, sat: 30, light: 48, planks: 8, size: 512, seed: 41 }).map, { repeat: [10, 3] }), roughness: 0.75 });
  M.pavers = std({ color: 0xe4d8c6, roughness: 0.9 });
  M.stone = std({ map: stoneTexture(), roughness: 0.9 });
  M.poolCoping = std({ color: 0xf1e9dc, roughness: 0.7 });
  M.poolBasin = std({ color: 0x8fd6e6, roughness: 0.6 });
  M.caustic = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 }, strength: { value: 0.35 } }, vertexShader: `varying vec2 vP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`, fragmentShader: `uniform float time, strength; varying vec2 vP; void main(){ vec2 p = vP * 1.6; float a = sin(p.x * 2.1 + time * 1.1) * sin(p.y * 1.7 - time * 1.3) + 0.5 * sin((p.x + p.y) * 3.3 + time * 0.7) + 0.35 * sin(p.x * 5.1 - p.y * 4.3 - time * 1.9); float c = pow(clamp(abs(a), 0.0, 1.0), 3.5); gl_FragColor = vec4(vec3(0.9, 1.0, 1.0) * c * strength, 1.0); }` });
  M.hedge = std({ color: 0x2f6a2c, roughness: 0.95 });
  M.flowerPink = std({ color: 0xe86fa0, roughness: 0.7, emissive: 0x3a0f22, emissiveIntensity: 0.3 });
  M.flowerWhite = std({ color: 0xf7f2f5, roughness: 0.7 });
  M.palmTrunk = std({ map: toTexture(woodTexture({ hue: 28, sat: 22, light: 40, planks: 1, size: 256, seed: 66, vertical: true, grain: 0.3 }).map, { repeat: [1, 3] }), roughness: 0.95 });
  M.frond = std({ map: frondTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.65, color: 0xf0f6e8 });
  M.palmBoot = std({ color: 0x6b5a3a, roughness: 1 });
  M.coconut = std({ color: 0x6b4a2b, roughness: 0.9 });
  M.thatch = std({ map: thatchTexture(), roughness: 1, side: THREE.DoubleSide });
  M.thatchDark = std({ color: 0x5a4324, roughness: 1, side: THREE.BackSide });
  M.lounger = std({ color: 0x3e2a1c, roughness: 0.8 });
  M.tower = std({ color: 0xf1e7d6, roughness: 0.85 });
  M.towerTrim = std({ color: 0xfaf6ef, roughness: 0.7 });
  M.stucco = std({ map: toTexture(plasterTexture({ r: 246, g: 240, b: 228, amount: 7, seed: 29 }).map, { repeat: [4, 2] }), roughness: 0.9 });
  M.water = waterMaterial(false); M.poolWater = waterMaterial(true);
  M.cloud = new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.85, fog: false });
  M.gull = std({ color: 0xf4f4f2, roughness: 0.9 }); M.gullWing = std({ color: 0xa9adb3, roughness: 0.9, side: THREE.DoubleSide });
  M.umbrella = std({ color: 0xc9603a, roughness: 0.85, side: THREE.DoubleSide }); M.towerRail = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  upgradeExteriorMaterials();
}
function upgradeExteriorMaterials() {   // scanned surfaces for the resort (see assets.js); `world` = box-mapped in metres
  if (!ASSETS.enabled || !ASSETS.manifest) return;
  upgradeMaterial(M.sand, 'aerial_beach_01', { world: true, sizeScale: 0.13, normalScale: 1.1, roughness: 1, color: 0xf6ead6, aniso: 16 });
  upgradeMaterial(M.wetSand, 'damp_beach_sand', { world: true, sizeScale: 1.5, normalScale: 0.6, roughness: 0.55, color: 0xd9ccb4, aniso: 16 });
  upgradeMaterial(M.deck, 'wood_floor_deck', { world: true, sizeScale: 1.3, normalScale: 0.7, roughness: 0.9, aniso: 16 });
  upgradeMaterial(M.pavers, 'concrete_pavers_02', { world: true, sizeScale: 1.1, normalScale: 0.7, roughness: 1, color: 0xf0e6d6, aniso: 16 });
  upgradeMaterial(M.stone, 'coral_stone_wall', { world: true, normalScale: 1.0, roughness: 1 });
  upgradeMaterial(M.stucco, 'beige_wall_001', { world: true, normalScale: 0.6, roughness: 1, color: 0xfbf3e6 });
  upgradeMaterial(M.tower, 'beige_wall_001', { world: true, sizeScale: 2.5, normalScale: 0.5, roughness: 1, color: 0xf6ecda });
  upgradeMaterial(M.poolCoping, 'patio_tiles', { world: true, normalScale: 0.6, roughness: 0.9, color: 0xf7ece0 });
  upgradeMaterial(M.poolBasin, 'blue_floor_tiles_01', { world: true, sizeScale: 0.5, normalScale: 0.5, roughness: 0.5, color: 0xbfe8f0 });
  upgradeMaterial(M.lounger, 'dark_wooden_planks', { world: true, sizeScale: 0.6, normalScale: 0.5, roughness: 0.9, color: 0xb59a7a });
  upgradeMaterial(M.thatch, 'reed_roof_04', { repeat: [5, 1.4], normalScale: 0.9, roughness: 1 });
  upgradeMaterial(M.palmTrunk, 'palm_tree_bark', { repeat: [1, 1.5], normalScale: 0.9, roughness: 1 });
  upgradeMaterial(M.umbrella, 'rough_linen', { repeat: [8, 1.5], normalScale: 0.5, roughness: 1, color: 0xe8b07a });
}

function buildExterior() {
  buildExteriorMaterials();
  const { x0, x1, z1 } = ROOM; const addm = (geo, m, x, y, z, ry = 0, shadow = false, rx = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, 0); me.receiveShadow = true; me.castShadow = shadow; W.scene.add(me); applyWorldUV(me); return me; };
  // wooden deck wrapping the café front and left side, then pavers around the pool
  addm(G.box(32, 0.06, EXT.deckZ1 - EXT.deckZ0 + 0.3), M.deck, 0, 0.0, (EXT.deckZ0 + EXT.deckZ1) / 2 + 0.15);
  addm(G.box(7, 0.06, 20), M.deck, x0 - 3.5, 0.0, 0);
  addm(G.box(40, 0.05, EXT.sandZ0 - EXT.deckZ1), M.pavers, 0, -0.01, (EXT.deckZ1 + EXT.sandZ0) / 2);
  // the café seen from outside: warm-white stucco cladding with the window and door openings, a roof and a thatched entrance canopy
  const T = 0.25 + 0.08; const frontX = mat(x1 + 0.4, 0, z1 + T, Math.PI), leftX = mat(x0 - T, 0, z1 + 0.4, Math.PI / 2), rightX = mat(x1 + T, 0, ROOM.z0 - 0.4, -Math.PI / 2), backX = mat(x0 - 0.4, 0, ROOM.z0 - T, 0);
  // ground under the whole resort (the beach is a level lower, beyond the retaining wall)
  addm(G.plane(313, 330), M.sand, 143.4, -0.045, EXT.sandZ0 - 165, 0, false, -Math.PI / 2);
  const shell = (frame, len, openings) => { const add = (a, b, y0, y1) => { if (b - a > 0.001 && y1 - y0 > 0.001) BX.add(G.box(b - a, y1 - y0, 0.08), 'stucco', frame.clone().multiply(mat((a + b) / 2, (y0 + y1) / 2, -0.04))); }; const xs = [0, ...openings.flatMap(o => [o[0], o[1]]), len]; for (let i = 0; i < xs.length - 1; i += 2) add(xs[i], xs[i + 1], 0, ROOM.h + 0.35); openings.forEach(o => { add(o[0], o[1], 0, o[2]); add(o[0], o[1], o[3], ROOM.h + 0.35); }); };
  shell(frontX, ROOM.w + 0.8, [[1.2, 4.2, 0.85, 2.75], [4.8, 7.8, 0.85, 2.75], [8.8, 9.8, 0, 2.5]]); shell(leftX, ROOM.d + 0.8, [[1.7, 4.7, 0.7, 2.6]]); shell(rightX, ROOM.d + 0.8, []); shell(backX, ROOM.w + 0.8, []);
  const roof = new THREE.Mesh(G.box(ROOM.w + 0.9, 0.3, ROOM.d + 0.9), M.stucco); roof.position.set(0, ROOM.h + 0.3, 0); roof.castShadow = true; W.ceilingGroup.add(roof);
  const parapet = new THREE.Mesh(G.box(ROOM.w + 1.0, 0.12, ROOM.d + 1.0), M.towerTrim); parapet.position.set(0, ROOM.h + 0.5, 0); W.ceilingGroup.add(parapet);
  palapa(-2.9, z1 + 1.35);
  // flower planters under the windows and along the deck edge
  planter(-1.5, 1.8, z1 + 0.65); planter(2.3, 5.4, z1 + 0.65); planter(x0 - 1.1, x0 - 0.3, 1.6, { depth: 3.4 }); planter(-8, -5, EXT.deckZ1 - 0.4); planter(6.2, 9.5, EXT.deckZ1 - 0.4);
  [-9, -4, 2, 8].forEach(x => tikiTorch(x, EXT.deckZ1 + 0.3));
  // pool
  const pw = EXT.poolX1 - EXT.poolX0, pd = EXT.poolZ1 - EXT.poolZ0, pcx = (EXT.poolX0 + EXT.poolX1) / 2, pcz = (EXT.poolZ0 + EXT.poolZ1) / 2;
  addm(G.box(pw + 1.2, 0.12, pd + 1.2), M.poolCoping, pcx, 0.06, pcz);
  addObstacle({ type: 'box', x0: EXT.poolX0, x1: EXT.poolX1, z0: EXT.poolZ0, z1: EXT.poolZ1, top: 0.5, kind: 'pool', playerOnly: true });
  addm(G.box(pw + 0.02, 0.5, pd + 0.02), M.poolBasin, pcx, -0.25, pcz).receiveShadow = true;
  const caus = addm(G.plane(pw - 0.05, pd - 0.05), M.caustic, pcx, 0.005, pcz); caus.rotation.x = -Math.PI / 2; caus.userData.noAO = true;
  const pool = addm(G.plane(pw, pd), M.poolWater, pcx, 0.04, pcz); pool.rotation.x = -Math.PI / 2; pool.receiveShadow = false; pool.renderOrder = 3;
  BX.add(G.torus(0.25, 0.025, 8, 16, Math.PI), 'steel', mat(EXT.poolX1 - 0.3, 0.3, pcz, 0, { rz: Math.PI, rx: 0 })); [EXT.poolX1 - 0.55, EXT.poolX1 - 0.05].forEach(lx => BX.add(G.cyl(0.025, 0.025, 1.1, 8), 'steel', mat(lx, -0.2, pcz)));   // pool ladder
  const I = mat(0, 0, 0);
  for (let i = 0; i < 6; i++) { loungeChair(I, EXT.poolX0 + 0.8 + i * 2.0, EXT.poolZ0 - 1.5, Math.PI); loungeChair(I, EXT.poolX0 + 0.8 + i * 2.0, EXT.poolZ1 + 1.5, 0); if (i % 2) { umbrella(I, EXT.poolX0 + 0.8 + i * 2.0 - 1.0, EXT.poolZ0 - 1.9); umbrella(I, EXT.poolX0 + 0.8 + i * 2.0 - 1.0, EXT.poolZ1 + 1.9); } }
  // palms around the deck & pool
  [[-8.5, 6.5], [-2.5, 9.9], [8.5, 9.6], [-6.5, 17.5], [9.5, 12.5], [9.0, 17.8], [-9.5, 12], [x0 - 2.5, -3.5], [x0 - 4.5, 2.5], [x0 - 2.2, 7.5], [-12.5, 8.5], [12.5, 7.5]].forEach(([x, z]) => palmTree(x, z, { h: rand(5, 7.5), lean: rand(0.1, 0.28) }));
  // the beach sits a step below the terrace: retaining wall, steps, white sand, wet sand and the ocean
  const sy = EXT.sandY;
  BX.add(G.box(60, 1.3, 0.5), 'stone', mat(0, sy + 0.65, EXT.sandZ0 + 0.25));
  addObstacle({ type: 'box', x0: -30, x1: -0.45, z0: EXT.sandZ0 - 0.05, z1: EXT.sandZ0 + 0.55, top: 1.3, kind: 'wall', playerOnly: true }); addObstacle({ type: 'box', x0: 2.85, x1: 30, z0: EXT.sandZ0 - 0.05, z1: EXT.sandZ0 + 0.55, top: 1.3, kind: 'wall', playerOnly: true });
  addObstacle({ type: 'box', x0: -13.6, x1: -12.9, z0: -35, z1: 35, top: 1.3, kind: 'wall', playerOnly: true });
  for (let i = 0; i < 5; i++) BX.add(G.box(3.2, 0.24, 0.45), 'poolCoping', mat(1.2, sy + 1.2 - i * 0.24 - 0.12, EXT.sandZ0 + 0.5 + i * 0.45));
  addm(G.plane(260, EXT.shoreZ - EXT.sandZ0 + 4), M.sand, 0, sy, (EXT.sandZ0 + EXT.shoreZ) / 2 + 1, 0, false, -Math.PI / 2);
  addm(G.plane(260, 3.5), M.wetSand, 0, sy + 0.004, EXT.shoreZ - 1.3, 0, false, -Math.PI / 2);
  const ocean = addm(new THREE.PlaneGeometry(320, 110, 220, 90), M.water, 0, sy + 0.008, EXT.shoreZ + 53); ocean.rotation.x = -Math.PI / 2; ocean.receiveShadow = false; ocean.frustumCulled = false; W.ocean = ocean;   // subdivided near water (real swell)
  const far = addm(G.plane(1400, 900), M.water, 0, sy + 0.0, EXT.shoreZ + 106 + 450); far.rotation.x = -Math.PI / 2; far.receiveShadow = false;
  BX.add(G.box(70, 1.3, 0.5), 'stone', mat(x0 - 7.25 - 35 + 35, sy + 0.65, 0).multiply(mat(0, 0, 0, Math.PI / 2)));  // wall along the left side of the deck
  addm(G.plane(70, 40), M.sand, x0 - 42, sy, 0, 0, false, -Math.PI / 2);
  // thatched huts in rows like the resort beach, with loungers
  for (let r = 0; r < 2; r++) for (let i = -6; i <= 6; i++) { const x = i * 6.2 + (r % 2) * 3.1 + rand(-0.5, 0.5), z = 22.5 + r * 5.2 + rand(-0.6, 0.6); if (Math.abs(x) < 2 && r === 0) continue; tikiHut(x, z, rand(-0.2, 0.2), 0.95, sy); }
  for (let i = 0; i < 16; i++) palmTree(rand(-45, 45), rand(20.5, 22.5), { h: rand(4.5, 7), lean: rand(0.1, 0.3), y: sy });
  for (let i = 0; i < 8; i++) palmTree(x0 - rand(8, 40), rand(-12, 12), { h: rand(4.5, 7), lean: rand(0.1, 0.3), y: sy });
  // resort towers on either side
  towerBuilding(19, 11, 12, 13, 13); towerBuilding(-24, 2, 11, 16, 11, 0);
  addObstacle({ type: 'box', x0: 12.5, x1: 25.5, z0: 4, z1: 18, top: 40, kind: 'tower', playerOnly: true });
  buildExteriorProps(sy);
  BX.build(W.scene, { shadow: true });
  // clouds
  W.clouds = []; for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(M.cloud.clone()); s.position.set(rand(-160, 160), rand(28, 60), 120 + rand(0, 160)); const sc = rand(40, 90); s.scale.set(sc, sc * 0.45, 1); W.scene.add(s); W.clouds.push(s); }
}
// scanned props around the resort (only when the asset pack is present — nothing here has a procedural twin)
function buildExteriorProps(sy) {
  const { x0, z1 } = ROOM;
  // bistro sets on the terrace (walkable obstacles), lantern lamps along the deck edge, a lifebuoy by the pool
  [[-6.6, 7.3, 0.35], [4.3, 7.7, -0.4], [10.2, 7.1, 0.9]].forEach(([x, z, ry]) => { if (placeModel('outdoor_table_chair_set_01', x, 0.03, z, ry, { fit: { h: 0.86 } })) { const c = Math.cos(ry), s = Math.sin(ry); const hw = Math.abs(c) * 0.95 + Math.abs(s) * 0.45, hd = Math.abs(s) * 0.95 + Math.abs(c) * 0.45; addObstacle({ type: 'box', x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, top: 0.75, kind: 'bistro' }); } });
  EXT.lamps = [];
  [[-12.5, EXT.deckZ1 - 0.35], [-1.0, EXT.deckZ1 - 0.35], [5.2, EXT.deckZ1 - 0.35], [12.5, EXT.deckZ1 - 0.35], [x0 - 6.8, -6], [x0 - 6.8, 5]].forEach(([x, z]) => {
    if (!placeModel('street_lamp_02', x, 0.03, z, 0, { fit: { h: 2.3 } })) return;
    addObstacle({ type: 'circle', x, z, r: 0.22, top: 2.3, kind: 'lamp' });
    const l = new THREE.PointLight(0xffc27a, 0, 9, 2); l.position.set(x, 2.05, z); W.scene.add(l); EXT.lamps.push(l);
  });
  placeModel('lifebuoy', EXT.poolX1 + 1.3, 1.25, EXT.poolZ0 - 0.9, Math.PI / 2, { align: 'center', fit: { h: 0.75 } }); BX.add(G.cyl(0.04, 0.045, 1.7, 8), 'darkwood', mat(EXT.poolX1 + 1.3, 0.85, EXT.poolZ0 - 0.9));
  placeModel('wicker_basket_01', EXT.poolX0 - 0.2, 0.06, EXT.poolZ1 + 2.6, 0.3, { fit: { h: 0.34 }, shadow: false });
  // on the beach: a stone fire pit in the gap between the huts (lit at night), lanterns on every hut table, a wooden pier out over the water
  if (placeModel('stone_fire_pit', 0, sy, 23.6, 0, { fit: { w: 1.6 } })) {
    const light = new THREE.PointLight(0xff9a3c, 0, 14, 2); light.position.set(0, sy + 0.6, 23.6); W.scene.add(light);
    const flames = [0, 1, 2].map(i => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(64, 'rgba(255,190,90,1)', 'rgba(255,90,20,0)'), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, fog: false })); s.position.set(rand(-0.15, 0.15), sy + 0.55, 23.6 + rand(-0.15, 0.15)); s.scale.set(0.5, 0.9, 1); s.visible = false; W.scene.add(s); return s; });
    EXT.fire = { light, flames };
    for (let i = 0; i < 5; i++) BX.add(G.cyl(0.06, 0.07, 0.6, 7), 'palmTrunk', mat(rand(-0.5, 0.5), sy + 0.28, 23.6 + rand(-0.4, 0.4), rand(TAU), { rx: rand(-0.5, 0.5), rz: rand(-0.5, 0.5) }));   // logs
    addObstacle({ type: 'circle', x: 0, z: 23.6, r: 0.9, top: 0.4, kind: 'firepit' });
  }
  EXT.huts.forEach(h => { const f = mat(h.x, h.y, h.z, h.ry, { sx: h.scale, sy: h.scale, sz: h.scale }); const p = new THREE.Vector3(0, 0.47, -0.3).applyMatrix4(f); placeModel('Lantern_01', p.x, p.y, p.z, h.ry + rand(-0.5, 0.5), { fit: { h: 0.3 }, shadow: false }); });
  placeModel('modular_wooden_pier', -21, sy - 0.05, EXT.shoreZ + 4, 0, { fit: { w: 3.4 }, shadow: true });
}
function updateExterior(dt) {
  const t = W.time; const sd = W.sun.position.clone().normalize(); const cam = W.camera.position;
  if (M.caustic) M.caustic.uniforms.time.value = t;
  const waterLight = clamp(0.05 + W.hemi.intensity * 1.9 + clamp(sd.y * 3, 0, 1) * 0.45, 0.05, 1);
  for (const mtl of [M.water, M.poolWater]) { const u = mtl.uniforms; u.time.value = t; u.ambient.value = waterLight; u.sunDir.value.copy(sd); u.camPos.value.copy(cam); u.sunColor.value.copy(W.sun.color); if (W.sky) u.skyColor.value.copy(W.sky.material.uniforms.horizonColor.value).lerp(W.sky.material.uniforms.topColor.value, 0.35); }
  EXT.palms.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.7 + c.userData.sway) * 0.03; c.rotation.x = Math.cos(t * 0.5 + c.userData.sway) * 0.025; });
  if (W.clouds) W.clouds.forEach((c, i) => { c.position.x += dt * (0.4 + i * 0.05); if (c.position.x > 200) c.position.x = -200; });
  const night = W.isNight ? 1 : 0; EXT.torches.forEach(f => { f.material = night ? M.bulb : M.bulbOff; f.scale.y = night ? 1.6 + Math.sin(t * 9 + f.position.x) * 0.25 : 1.2; });
}
