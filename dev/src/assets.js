// ─── Real-world asset pack (optional): captured skies, scanned PBR textures, scanned furniture ──
// Everything here streams in *after* the procedural world is up. If assets/ is missing (or a file fails),
// the procedural version simply stays — the café never depends on the pack. See dev/fetch_assets.py.
const ASSETS = { base: 'assets/', manifest: null, enabled: true, tex: {}, placements: {}, loaded: 0, total: 0, failed: 0, fallbackQueue: [], fallbackTimer: 0, modelsDone: false };
let GLTFLoader, DRACOLoader;
window.Cafe3D.ASSETS = ASSETS;

async function loadAssetManifest() {
  try {
    const q = new URLSearchParams(location.search); if (q.has('noassets')) { ASSETS.enabled = false; return null; }
    if (location.protocol === 'file:') { ASSETS.enabled = false; return null; }   // fetch() cannot read local files
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(ASSETS.base + 'manifest.json', { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    ASSETS.manifest = await r.json(); return ASSETS.manifest;
  } catch (e) { console.warn('café: no real-world asset pack (' + (e && e.message ? e.message : e) + ') — procedural world only'); ASSETS.enabled = false; ASSETS.manifest = null; return null; }
}
const hasTex = id => !!(ASSETS.manifest && ASSETS.manifest.textures && ASSETS.manifest.textures[id]);
const hasModel = id => !!(ASSETS.manifest && ASSETS.manifest.models && ASSETS.manifest.models[id]);
const hasSky = () => !!(ASSETS.manifest && ASSETS.manifest.sky && ASSETS.manifest.sky.frames && ASSETS.manifest.sky.frames.length > 1);
function assetTick(ok) { ASSETS.loaded++; if (!ok) ASSETS.failed++; }

// ── planar "box mapping" in world units so a scanned 2 m texture is 2 m on every wall, table and floor ──
const _wuvV = () => new THREE.Vector3();
function worldUV(geom, size = 1, matrix = null) {
  const pos = geom.attributes.position, nor = geom.attributes.normal; if (!pos) return;
  const n = pos.count; const uv = new Float32Array(n * 2); const p = _wuvV(), nn = _wuvV(); const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i); if (matrix) p.applyMatrix4(matrix);
    if (nor) { nn.fromBufferAttribute(nor, i); if (nm) nn.applyMatrix3(nm); } else nn.set(0, 1, 0);
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z); let u, v;
    if (ay >= ax && ay >= az) { u = p.x; v = p.z; } else if (ax >= az) { u = p.z; v = p.y; } else { u = p.x; v = p.y; }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function applyWorldUV(mesh) {   // for meshes placed with .position/.rotation (geometry stays local; UVs come from world space)
  const m = mesh.material; if (!m || Array.isArray(m) || !m.userData.worldUV) return;
  mesh.updateMatrixWorld(true); worldUV(mesh.geometry, m.userData.worldUV, mesh.matrixWorld);
}

// ── scanned texture sets: diffuse / GL normal / AO-roughness-metal, swapped into the procedural material as they arrive ──
function assetTexture(id, map, { srgb = false, repeat = [1, 1], aniso = 8, cb = null } = {}) {
  const key = `${id}/${map}/${repeat[0]},${repeat[1]}`; if (ASSETS.tex[key]) return ASSETS.tex[key];
  ASSETS.total++;
  const t = new THREE.TextureLoader().load(ASSETS.base + 'tex/' + id + '/' + map + '.webp', tex => { assetTick(true); if (cb) cb(tex); }, undefined, () => { assetTick(false); console.warn('café: texture failed', id, map); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (W.renderer) t.anisotropy = Math.min(aniso, W.renderer.capabilities.getMaxAnisotropy());
  ASSETS.tex[key] = t; return t;
}
// upgradeMaterial(M.floor, 'oak_wood_planks', { world: true }) — `world` = box-map in metres (needs the geometry built afterwards);
// otherwise `repeat` tiles the mesh's own UVs. Returns true when the pack has the texture.
function upgradeMaterial(m, id, { world = false, repeat = null, color = null, normalScale = 1, roughness = 1, ao = 1, metal = false, aniso = 8, sizeScale = 1 } = {}) {
  if (!m || !hasTex(id)) return false;
  const info = ASSETS.manifest.textures[id]; const size = (info.size || 1) * sizeScale;
  if (world) m.userData.worldUV = size;
  const rep = world ? [1, 1] : (repeat || [1, 1]);
  // keep the procedural maps sane in case a file never arrives (world UVs would otherwise tile them per metre)
  if (world) for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k] && m[k].isTexture) m[k].repeat.set(1, 1);
  const tint = color != null ? new THREE.Color(color) : new THREE.Color(0xffffff);
  assetTexture(id, 'diff', { srgb: true, repeat: rep, aniso, cb: t => { m.map = t; m.color.copy(tint); m.needsUpdate = true; } });
  if (info.maps.includes('nor')) assetTexture(id, 'nor', { repeat: rep, aniso, cb: t => { m.normalMap = t; m.normalMapType = THREE.TangentSpaceNormalMap; if (!m.normalScale) m.normalScale = new THREE.Vector2(); m.normalScale.set(normalScale, normalScale); m.needsUpdate = true; } });
  if (info.maps.includes('arm')) assetTexture(id, 'arm', { repeat: rep, aniso, cb: t => { m.roughnessMap = t; m.roughness = roughness; m.aoMap = t; m.aoMapIntensity = ao; if (metal) { m.metalnessMap = t; m.metalness = 1; } m.needsUpdate = true; } });
  return true;
}

// ── scanned models: placed as GPU instances, fitted to the footprint the procedural furniture had (so nav, perches and seats still line up) ──
// placeModel('dining_chair_02', x, 0, z, ry, { fit: { w: 0.5, d: 0.55, h: 0.95 }, fallback: () => chairGeometry(BL, ...) })
function placeModel(id, x, y, z, ry = 0, opts = {}) {
  if (!hasModel(id)) return null;   // caller builds the procedural version right away; `fallback` only runs if the file fails later
  const pl = { id, x, y, z, ry, ...opts }; (ASSETS.placements[id] ||= []).push(pl); return pl;
}
// move one placed model after the fact (ceiling fans spin, for example): recomputes its instance matrices
function updateModelPlacement(p, { ry = p.ry, x = p.x, y = p.y, z = p.z } = {}) {
  if (!p.meshes || !p.fitSize) return; p.ry = ry; p.x = x; p.y = y; p.z = z;
  const pm = placementMatrix(p, p.fitSize, p.fitCenter, MODEL_ADJ[p.id] || {});
  for (const inst of p.meshes) { const sub = inst.userData.sub; for (let j = 0; j < sub.length; j++) inst.setMatrixAt(p.instIndex * sub.length + j, pm.clone().multiply(sub[j])); inst.instanceMatrix.needsUpdate = true; }
}
const MODEL_ADJ = {   // per-model corrections learned from the scans: extra yaw so "front" faces local +Z, anchor tweaks
  dining_chair_02: { yaw: Math.PI }, bar_chair_round_01: { yaw: 0 }, Sofa_01: { yaw: 0 }, ArmChair_01: { yaw: 0 }, outdoor_table_chair_set_01: { yaw: 0 },
  mid_century_lounge_chair: { yaw: 0 }, CashRegister_01: { yaw: 0 }, standing_chalkboard_01: { yaw: 0 }, fancy_picture_frame_01: { yaw: 0 }, wooden_bookshelf_worn: { yaw: 0 },
};
async function loadModelLoaders() {
  if (GLTFLoader) return;
  const [g, d] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]);
  GLTFLoader = g.GLTFLoader; DRACOLoader = d.DRACOLoader;
}
async function loadPlacedModels() {
  const ids = Object.keys(ASSETS.placements); if (!ids.length || !ASSETS.enabled) { ASSETS.modelsDone = true; return; }
  try { await loadModelLoaders(); } catch (e) { console.warn('café: model loaders unavailable', e); ids.forEach(id => runFallbacks(id)); ASSETS.modelsDone = true; return; }
  const draco = new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/'); draco.setDecoderConfig({ type: 'js' });
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  ASSETS.total += ids.length;
  await Promise.all(ids.map(id => new Promise(res => {
    loader.load(ASSETS.base + ASSETS.manifest.models[id].file, gltf => { try { instantiateModel(id, gltf); assetTick(true); } catch (e) { console.warn('café: model instancing failed', id, e); runFallbacks(id); assetTick(false); } res(); },
      undefined, err => { console.warn('café: model failed', id, err && err.message); runFallbacks(id); assetTick(false); res(); });
  })));
  ASSETS.modelsDone = true; if (POST && POST.csm) applyCSM(W.scene);
}
function runFallbacks(id) { for (const p of ASSETS.placements[id] || []) if (p.fallback) { ASSETS.fallbackQueue.push(p.fallback); } scheduleFallbackBuild(); }
function scheduleFallbackBuild() {   // procedural stand-ins are batched together once the failures have settled
  clearTimeout(ASSETS.fallbackTimer); ASSETS.fallbackTimer = setTimeout(() => { const q = ASSETS.fallbackQueue; ASSETS.fallbackQueue = []; if (!q.length) return; for (const fn of q) { try { fn(); } catch (e) { console.warn(e); } } BL.build(W.scene); BLNS.build(W.scene, { shadow: false }); if (POST && POST.csm) applyCSM(W.scene); }, 50);
}
function instantiateModel(id, gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size); const center = new THREE.Vector3(); box.getCenter(center);
  const adj = MODEL_ADJ[id] || {}; const list = ASSETS.placements[id];
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  // group placements by tint (each tint needs its own material)
  const groups = {}; list.forEach((p, i) => { const k = p.tint != null ? String(p.tint) : '-'; (groups[k] ||= []).push(p); });
  const parentOf = p => p.parent || W.scene;
  for (const k in groups) {
    const plist = groups[k]; const byParent = new Map(); plist.forEach(p => { const par = parentOf(p); if (!byParent.has(par)) byParent.set(par, []); byParent.get(par).push(p); });
    for (const [parent, pls] of byParent) {
      pls.forEach((p, pi) => { p.fitSize = size; p.fitCenter = center; p.instIndex = pi; });
      const mats = pls.map(p => placementMatrix(p, size, center, adj));
      for (const mesh of meshes) {
        let mat = mesh.material; if (Array.isArray(mat)) mat = mat[0];
        if (k !== '-') { mat = mat.clone(); mat.color.multiply(new THREE.Color(pls[0].tint)); }
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (mat[key]) mat[key].anisotropy = Math.min(8, W.renderer.capabilities.getMaxAnisotropy());
        if (mat.transparent && mat.opacity >= 1 && !mat.alphaMap) { mat.transparent = false; mat.alphaTest = 0.5; }   // scanned leaves: alpha-tested, not sorted transparency
        mat.envMapIntensity = pls[0].envMapIntensity ?? 0.8;
        const sub = []; if (mesh.isInstancedMesh) { const im = new THREE.Matrix4(); for (let j = 0; j < mesh.count; j++) { mesh.getMatrixAt(j, im); sub.push(mesh.matrixWorld.clone().multiply(im)); } } else sub.push(mesh.matrixWorld.clone());
        const inst = new THREE.InstancedMesh(mesh.geometry, mat, mats.length * sub.length); let n = 0;
        for (const pm of mats) for (const sm of sub) inst.setMatrixAt(n++, pm.clone().multiply(sm));
        inst.instanceMatrix.needsUpdate = true; inst.castShadow = pls[0].shadow !== false; inst.receiveShadow = true; inst.name = 'model:' + id; inst.frustumCulled = false;
        inst.userData.modelId = id; inst.userData.sub = sub; if (pls[0].noAO) inst.userData.noAO = true;
        parent.add(inst); pls.forEach(p => { (p.meshes ||= []).push(inst); });
      }
    }
  }
  list.forEach(p => { if (p.onPlaced) p.onPlaced(p, size, center); });
}
function placementMatrix(p, size, center, adj) {
  // fit: uniform scale so the model fits inside {w,d,h} (any subset); `scale` overrides; `stretch` allows non-uniform fitting
  let sx = 1, sy = 1, sz = 1;
  if (p.scale) { sx = sy = sz = p.scale; }
  else if (p.fit) {
    const f = p.fit; const cands = []; if (f.w) cands.push(f.w / (size.x || 1)); if (f.d) cands.push(f.d / (size.z || 1)); if (f.h) cands.push(f.h / (size.y || 1));
    const s = cands.length ? Math.min(...cands) : 1;
    if (p.stretch) { sx = f.w ? f.w / size.x : s; sz = f.d ? f.d / size.z : s; sy = f.h ? f.h / size.y : s; } else sx = sy = sz = s;
  }
  const align = p.align || 'floor'; const ay = align === 'floor' ? -(center.y - size.y / 2) : align === 'ceiling' ? -(center.y + size.y / 2) : -center.y;
  const m = new THREE.Matrix4();
  m.makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationY(p.ry + (adj.yaw || 0) + (p.yaw || 0))).multiply(new THREE.Matrix4().makeScale(sx, sy, sz)).multiply(new THREE.Matrix4().makeTranslation(-center.x, ay, -center.z));
  if (p.offset) m.premultiply(new THREE.Matrix4().makeTranslation(p.offset[0], p.offset[1], p.offset[2]));
  return m;
}
let BL, BLNS;   // late batchers for procedural fallbacks (built after the world)

// ── captured skies: 13 pure-sky HDRIs of one location through a day, blended by the game clock ──
const SKY = { ready: false, frames: [], tex: [], a: 0, b: 1, t: 0, exposure: {}, lastTidy: 0, loading: false, sun: null, moon: null };
window.Cafe3D.SKY = SKY;
const SKY_EXPOSURE = { night: 0.009, dawn: 0.05, sunrise: 0.13, morning: 0.62, mid_morning: 0.9, noon: 1.3, afternoon: 1.25, late_afternoon: 0.55, sunset: 0.2, dusk_1: 0.05, dusk_2: 0.045, moonrise: 0.026, moon_noon: 0.03 };
function loadSkyPack() {
  if (!hasSky() || SKY.loading) return; SKY.loading = true;
  const S = ASSETS.manifest.sky; SKY.frames = S.frames.slice().sort((a, b) => a.hour - b.hour); SKY.vLo = 0.5 - S.margin / S.height;
  let pending = SKY.frames.length; ASSETS.total += pending;
  SKY.frames.forEach((f, i) => {
    const t = new THREE.TextureLoader().load(ASSETS.base + f.file, () => { assetTick(true); if (--pending === 0) skyPackReady(); }, undefined, () => { assetTick(false); console.warn('café: sky frame failed', f.id); f.failed = true; if (--pending === 0) skyPackReady(); });
    t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = true;
    f.tex = t; f.exposure = SKY_EXPOSURE[f.id] ?? 1;
  });
}
function skyPackReady() {
  SKY.frames = SKY.frames.filter(f => !f.failed); if (SKY.frames.length < 2 || !W.sky) return;
  SKY.ready = true; const u = W.sky.material.uniforms; u.useHDRI.value = 1; u.vLo.value = SKY.vLo;
  if (W.clouds) W.clouds.forEach(c => c.visible = false);   // the photographs bring their own clouds
  updateDaylight(); if (typeof updateEnvironment === 'function') updateEnvironment(true);
  showToast && showToast('☀️ Real skies loaded — captured through a full day');
}
// interpolation state for the current game hour: frames a→b and blend t, plus sun/moon elevation and sky colours
function skyState(hour) {
  const F = SKY.frames; const n = F.length; let i = n - 1;
  for (let k = 0; k < n; k++) { if (F[k].hour <= hour) i = k; }
  const a = F[i], b = F[(i + 1) % n]; let span = b.hour - a.hour; if (span <= 0) span += 24; let dt = hour - a.hour; if (dt < 0) dt += 24;
  const t = clamp(dt / span, 0, 1); const ts = t * t * (3 - 2 * t);
  const sunEl = f => f.kind === 'sun' ? f.bodyEl : f.kind === 'dawn' || f.kind === 'dusk' ? -4 : -25;
  const moonEl = f => f.kind === 'moon' ? f.bodyEl : null;
  const mix3 = (p, q) => [lerp(p[0] * a.exposure, q[0] * b.exposure, ts), lerp(p[1] * a.exposure, q[1] * b.exposure, ts), lerp(p[2] * a.exposure, q[2] * b.exposure, ts)];
  const mA = moonEl(a), mB = moonEl(b); const moon = mA != null || mB != null ? lerp(mA ?? -10, mB ?? -10, ts) : null;
  return { i, a, b, t: ts, sunEl: lerp(sunEl(a), sunEl(b), ts), moonEl: moon, moonVis: lerp(mA != null ? 1 : 0, mB != null ? 1 : 0, ts), horizon: mix3(a.horizon, b.horizon), zenith: mix3(a.zenith, b.zenith), mean: mix3(a.mean, b.mean) };
}
// apply the two frames to the sky shader; azimuth of the sun (or moon / glow) in each frame is rotated onto ours
function applySkyFrames(st, sunAzim, moonAzim) {
  const u = W.sky.material.uniforms; const F = SKY.frames; const bodyAz = f => f.bodyAz * Math.PI / 180;
  const azFor = f => (f.kind === 'moon' ? moonAzim : sunAzim);
  const rot = f => (Math.PI - azFor(f)) - bodyAz(f);   // our azimuth convention: a = atan(x, -z); the sun direction (sin(az), ·, cos(az)) has a = π − az
  u.tA.value = st.a.tex; u.tB.value = st.b.tex; u.mixAB.value = st.t; u.rotA.value = rot(st.a); u.rotB.value = rot(st.b);
  u.scaleA.value = st.a.scale * st.a.exposure; u.scaleB.value = st.b.scale * st.b.exposure;
  // keep only the frames around "now" resident on the GPU
  if (W.time - SKY.lastTidy > 5) { SKY.lastTidy = W.time; const keep = new Set([st.i, (st.i + 1) % F.length, (st.i + 2) % F.length]); F.forEach((f, k) => { if (!keep.has(k) && f.tex && f.tex.image) f.tex.dispose(); }); }
}

// ── boot glue: called once the world is live ──
async function startAssetStreaming() {
  if (!ASSETS.enabled || !ASSETS.manifest) return;
  BL = new Batcher(); BLNS = new Batcher();
  loadSkyPack();
  await loadPlacedModels();
}
function assetProgressText() {
  if (!ASSETS.enabled || !ASSETS.manifest || !ASSETS.total) return '';
  if (ASSETS.loaded >= ASSETS.total) return '';
  return `streaming real-world detail ${Math.round(100 * ASSETS.loaded / ASSETS.total)}%`;
}
