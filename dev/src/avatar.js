// ─── Humanoid: procedural people with a sculpted head. The player is modelled on the reference photo: a slim 5'4"
// woman, fair warm skin, long thick wavy burgundy hair swept behind one ear with a pink plumeria, blue eyes, thin arched
// auburn brows and a soft smile. The same builder makes the barista and the beach-goers. ──
const SLACK_COLORS = { beige: 0xcdb99a, black: 0x1c1b1e, blue: 0x2c4a7a, pink: 0xe6a3b8 };
const SHIRT_COLORS = { white: 0xf7f5f2, cream: 0xf0e6d2, lightblue: 0xbdd3ea, black: 0x1a191c };
const PLAYER_LOOK = { sex: 'f', height: 1.63, skin: 0xefc7ab, hairColor: 0x4a1120, hairSheen: 0xb0303e, hairStyle: 'longwave', hairSweep: -1, eyes: '#4d8bd8', brows: 0x3a1210, lips: 0xc25f68, blush: 0.2, flower: true, earrings: true, slim: 1, outfits: ['casual', 'work', 'beach'], seed: 2 };

// ── head sculpting: a sphere pushed and pulled into a face ─────────────────────
function sculptHead(geo, look) {
  const f = look.sex === 'f'; const pos = geo.attributes.position; const o = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const ops = [
    { p: [0, -0.098, 0.04], r: 0.04, k: f ? 0.012 : 0.016 },            // chin
    { p: [0, -0.06, 0.088], r: 0.03, k: 0.005 },                         // mouth mound
    { p: [0, 0.048, 0.088], r: 0.07, k: f ? 0.004 : 0.008 },             // brow ridge
    { p: [-0.035, 0.022, 0.088], r: 0.03, k: -0.011 }, { p: [0.035, 0.022, 0.088], r: 0.03, k: -0.011 },   // eye sockets
    { p: [-0.064, -0.006, 0.05], r: 0.04, k: f ? 0.011 : 0.008 }, { p: [0.064, -0.006, 0.05], r: 0.04, k: f ? 0.011 : 0.008 },   // cheekbones
    { p: [-0.052, -0.045, 0.06], r: 0.03, k: -0.006 }, { p: [0.052, -0.045, 0.06], r: 0.03, k: -0.006 },   // under-cheek hollows
    { p: [-0.08, 0.035, 0.03], r: 0.035, k: -0.006 }, { p: [0.08, 0.035, 0.03], r: 0.035, k: -0.006 },     // temples
    { p: [0, 0.07, 0.075], r: 0.05, k: -0.004 },                         // forehead flatten
    { p: [0, 0.012, -0.095], r: 0.07, k: 0.009 },                        // occipital
    { p: [0, 0.008, 0.096], r: 0.022, k: 0.006, dir: [0, 0, 1] },        // nose root
  ];
  for (let i = 0; i < pos.count; i++) {
    o.fromBufferAttribute(pos, i); n.copy(o).normalize(); v.copy(o);
    const jaw = smoothstep(-0.005, -0.105, o.y); v.x *= 1 - (f ? 0.4 : 0.28) * jaw; v.z *= 1 - 0.1 * jaw * (o.z > 0 ? 1 : 0.4);   // jaw tapers to the chin
    const top = smoothstep(0.05, 0.11, o.y); v.x *= 1 - 0.06 * top;                                                              // rounder crown
    for (const op of ops) { const d = Math.hypot(o.x - op.p[0], o.y - op.p[1], o.z - op.p[2]); if (d < op.r) { const w = smoothstep(op.r, 0, d); if (op.dir) v.addScaledVector(new THREE.Vector3(...op.dir).normalize(), op.k * w); else v.addScaledVector(n, op.k * w); } }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
// uv of a head-local direction on the base sphere (Three's sphere: face centre (0,0,1) → u = 0.25, v = 0.5)
function headUV(x, y, z) { const r = Math.hypot(x, y, z); const theta = Math.acos(clamp(y / r, -1, 1)); const phi = Math.atan2(z, -x); return [((phi / TAU) + 1) % 1, theta / Math.PI]; }
function skinTexture(look) {
  const S = 1024; const [c, ctx] = canvas2d(S, S); const N = makeNoise(look.seed || 7);
  const base = new THREE.Color(look.skin); const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const n = N.fbm(x / 70, y / 70, 3) * 7 + N.n2(x * 0.9, y * 0.9) * 3; const warm = smoothstep(0.35, 0.65, y / S) * 2; const i = (y * S + x) * 4; img.data[i] = clamp(base.r * 255 + n + warm, 0, 255); img.data[i + 1] = clamp(base.g * 255 + n, 0, 255); img.data[i + 2] = clamp(base.b * 255 + n - warm * 0.5, 0, 255); img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const sx = look.sex === 'f' ? 0.84 : 0.9, sy = look.sex === 'f' ? 1.12 : 1.08, sz = 0.94;   // the head sphere is scaled before sculpting; UVs belong to the unit sphere
  const P = (x, y, z) => { const [u, v] = headUV(x / sx, y / sy, z / sz); return [u * S, v * S]; };
  const soft = (x, y, rx, ry, color, alpha) => { const g = ctx.createRadialGradient(x, y, 0, x, y, 1); ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.translate(-x, -y); const gr = ctx.createRadialGradient(x, y, 0, x, y, 1); gr.addColorStop(0, color.replace(')', ',' + alpha + ')').replace('rgb(', 'rgba(')); gr.addColorStop(1, color.replace(')', ',0)').replace('rgb(', 'rgba(')); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 1, 0, TAU); ctx.fill(); ctx.restore(); };
  const [ex, ey] = P(0.035, 0.02, 0.085); const [lx] = P(-0.035, 0.02, 0.085); const cx = (ex + lx) / 2;
  const f = look.sex === 'f'; const blush = look.blush ?? 0.15;
  // cheeks & warmth
  soft(ex + 18, ey + 62, 70, 52, 'rgb(225,120,112)', blush); soft(lx - 18, ey + 62, 70, 52, 'rgb(225,120,112)', blush); soft(cx, ey - 30, 90, 40, 'rgb(255,240,225)', 0.18);
  // eye sockets: a little depth, then the lash line
  for (const x of [ex, lx]) { soft(x, ey, 30, 16, 'rgb(120,60,55)', f ? 0.28 : 0.18); soft(x, ey - 6, 22, 5, 'rgb(40,15,15)', f ? 0.45 : 0.3); }
  // brows: thin, arched, tapered
  const bc = '#' + new THREE.Color(look.brows).getHexString(); ctx.strokeStyle = bc; ctx.lineCap = 'round'; ctx.shadowColor = bc; ctx.shadowBlur = 3;
  for (const [x, s] of [[ex, 1], [lx, -1]]) { for (let k = 0; k < 4; k++) { ctx.lineWidth = (f ? 4.2 : 6) - k * 0.6; ctx.beginPath(); ctx.moveTo(x - s * 12, ey - 26 + k * 1.2); ctx.quadraticCurveTo(x + s * 10, ey - 40 + k, x + s * 36, ey - 26 + k * 2); ctx.stroke(); } }
  ctx.shadowBlur = 0;
  // nose shading
  const [nx, ny] = P(0, -0.02, 0.1); soft(nx - 14, ny - 10, 6, 26, 'rgb(150,80,70)', 0.18); soft(nx + 14, ny - 10, 6, 26, 'rgb(150,80,70)', 0.18); soft(nx, ny + 18, 14, 6, 'rgb(150,80,70)', 0.22); soft(nx, ny - 2, 7, 14, 'rgb(255,235,220)', 0.25);
  // lips with a soft smile
  const [mx, my] = P(0, -0.052, 0.088); const lipc = '#' + new THREE.Color(look.lips).getHexString(); const w = f ? 34 : 30;
  ctx.fillStyle = lipc; ctx.beginPath(); ctx.moveTo(mx - w, my); ctx.quadraticCurveTo(mx - w * 0.45, my - 13, mx - 6, my - 7); ctx.quadraticCurveTo(mx, my - 4, mx + 6, my - 7); ctx.quadraticCurveTo(mx + w * 0.45, my - 13, mx + w, my); ctx.quadraticCurveTo(mx, my + 20, mx - w, my); ctx.fill();
  ctx.strokeStyle = 'rgba(90,30,35,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(mx - w, my - 1); ctx.quadraticCurveTo(mx, my + 5, mx + w, my - 1); ctx.stroke();
  soft(mx, my + 8, 16, 5, 'rgb(255,220,215)', 0.25);
  if (!f) soft(mx, my + 40, 60, 30, 'rgb(90,60,50)', 0.12);   // hint of stubble shadow on the men
  return toTexture(c, { aniso: true });
}
function hairFiberTexture(seed = 3) {
  const [c, ctx] = canvas2d(256, 1024); ctx.clearRect(0, 0, 256, 1024); const N = makeNoise(seed);
  for (let i = 0; i < 420; i++) {
    const x0 = rand(0, 256); const w = rand(1.4, 4.2); const tone = 105 + Math.abs(N.n2(i, 1)) * 150; const end = 0.7 + Math.abs(N.n2(i, 2)) * 0.3;   // fibres stop at different lengths → wispy tips
    ctx.strokeStyle = `rgba(${tone},${tone * 0.92},${tone * 0.9},${0.85 + Math.abs(N.n2(i, 3)) * 0.15})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, 0);
    for (let y = 0; y <= 1024 * end; y += 32) ctx.lineTo(x0 + Math.sin(y * 0.01 + i) * 4 + N.n2(i, y * 0.02) * 3, y); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.flipY = false;   // v = 0 is the root (canvas top, fully covered); tips thin out
  return t;
}
function petalTexture() { const [c, ctx] = canvas2d(64, 64); ctx.clearRect(0, 0, 64, 64); const g = ctx.createLinearGradient(32, 64, 32, 0); g.addColorStop(0, '#ffe07a'); g.addColorStop(0.35, '#fff3f2'); g.addColorStop(1, '#f6a6c1'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(32, 30, 20, 30, 0, 0, TAU); ctx.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

class Humanoid {
  constructor(look) {
    this.look = Object.assign({ sex: 'f', height: 1.63, skin: 0xe8b99b, hairColor: 0x3a2418, hairSheen: 0x7a5236, hairStyle: 'short', hairSweep: 0, eyes: '#5a7a4a', brows: 0x2a1a12, lips: 0xb8666a, blush: 0.12, outfits: ['casual'], swim: 0xd94f6c, apron: 0x2f3b2f, tee: 0x1d1d20, coverup: 0xf3ecdf, slim: 0, seed: 7 }, look);
    const L = this.look; this.group = new THREE.Group(); this.group.scale.setScalar(L.height / 1.63); this.f = L.sex === 'f';
    const phys = o => new THREE.MeshPhysicalMaterial(o), std = o => new THREE.MeshStandardMaterial(o);
    this.mats = {
      skin: phys({ color: L.skin, roughness: 0.58, sheen: 0.35, sheenRoughness: 0.85, sheenColor: new THREE.Color(L.skin).lerp(new THREE.Color(0xffd0b8), 0.5), envMapIntensity: 0.35, clearcoat: 0.05, clearcoatRoughness: 0.6 }),
      face: phys({ map: skinTexture(L), roughness: 0.55, sheen: 0.35, sheenRoughness: 0.85, sheenColor: new THREE.Color(L.skin).lerp(new THREE.Color(0xffd0b8), 0.5), envMapIntensity: 0.35, clearcoat: 0.08, clearcoatRoughness: 0.5 }),
      hair: phys({ color: new THREE.Color(L.hairColor).multiplyScalar(0.75), roughness: 0.92, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color(L.hairSheen), envMapIntensity: 0.15 }),   // matte under-hair beneath the cards
      hairCard: phys({ map: hairFiberTexture(L.seed), color: L.hairColor, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.48, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(L.hairSheen), envMapIntensity: 0.45 }),
      brow: std({ color: L.brows, roughness: 0.9 }), lips: phys({ color: L.lips, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      eye: std({ map: eyeTexture(L.eyes, 0.5, 0.27), roughness: 0.08, envMapIntensity: 1.5 }), white: std({ color: 0xf4f2ee, roughness: 0.5 }), gold: std({ color: 0xd8b25c, metalness: 0.9, roughness: 0.25 }),
      top: std({ color: 0xfaf8f5, roughness: 0.92 }), pants: phys({ color: 0x131315, roughness: 0.68, sheen: 0.45, sheenColor: new THREE.Color(0x555), sheenRoughness: 0.55 }),
      shirt: std({ color: 0xf7f5f2, roughness: 0.8 }), slacks: std({ color: 0xcdb99a, roughness: 0.86 }), shoe: std({ color: 0xf4f2ee, roughness: 0.5 }), sole: std({ color: 0xe6e2da, roughness: 0.8 }), shoeWork: std({ color: 0x1a1a1c, roughness: 0.32, metalness: 0.08 }),
      swim: std({ color: L.swim, roughness: 0.75 }), coverup: std({ color: L.coverup, roughness: 0.92 }), tee: std({ color: L.tee, roughness: 0.9 }), apron: std({ color: L.apron, roughness: 0.9 }), jeans: std({ color: 0x3a4f78, roughness: 0.9 }), sandal: std({ color: 0x5a3a24, roughness: 0.8 }),
      dress: phys({ color: 0x151517, roughness: 0.75, sheen: 0.4, sheenColor: new THREE.Color(0x444), sheenRoughness: 0.6 }), petal: std({ map: petalTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }),
    };
    this.meshes = []; this.parts = {}; this.outfit = L.outfits[0]; this.slack = 'beige'; this.shirt = 'white';
    this.build(); this.buildHair(L.hairStyle);
    this.meshes.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    this.blob = new THREE.Mesh(G.plane(0.7, 0.7), M.blob.clone()); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.004; this.blob.material.opacity = 0.4; this.blob.userData.noAO = true; this.group.add(this.blob);
    this.phase = 0; this.gait = 0; this.breath = rand(TAU); this.blink = 0; this.nextBlink = rand(2, 5); this.shiftT = rand(3, 8); this.shift = 0; this.shiftTarget = 0; this.lookTarget = null; this.lookW = 0; this.lookYaw = 0; this.lookPitch = 0;
    this.applyOutfit();
  }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, part = null) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); this.meshes.push(m); if (part) (this.parts[part] ||= []).push(m); return m; }
  build() {
    const K = this.mats, f = this.f, w = f ? 1 - 0.04 * this.look.slim : 1.16, sl = this.look.slim;
    // ── pelvis & legs
    this.hips = new THREE.Group(); this.hips.position.y = 0.93; this.group.add(this.hips);
    this.mesh(G.rbox(0.29 * w, 0.2, 0.18, 0.075, 4), K.skin, this.hips, 0, 0.02, 0);
    [-1, 1].forEach(s => this.mesh(G.sph(0.072, 12, 10), K.skin, this.hips, s * 0.072 * w, -0.03, -0.058).scale.set(1, 0.9, 0.85));
    this.mesh(G.rbox(0.305 * w, 0.21, 0.195, 0.075, 4), K.pants, this.hips, 0, 0.02, 0, 0, 0, 0, 'casual'); [-1, 1].forEach(s => this.mesh(G.sph(0.079, 12, 10), K.pants, this.hips, s * 0.072 * w, -0.03, -0.058, 0, 0, 0, 'casual').scale.set(1, 0.9, 0.85));
    for (const [part, key] of [['work', 'slacks'], ['swim', 'swim'], ['coverup', 'coverup'], ['barista', 'jeans'], ['beach', 'dress']]) [-1, 1].forEach(s => this.mesh(G.sph(0.079, 12, 10), K[key], this.hips, s * 0.072 * w, -0.03, -0.058, 0, 0, 0, part).scale.set(1, 0.9, 0.85));
    this.mesh(G.rbox(0.32 * w, 0.215, 0.21, 0.075, 4), K.slacks, this.hips, 0, 0.02, 0, 0, 0, 0, 'work');
    this.mesh(G.rbox(0.31 * w, 0.2, 0.2, 0.075, 4), K.swim, this.hips, 0, 0.0, 0, 0, 0, 0, 'swim');
    this.mesh(G.rbox(0.315 * w, 0.215, 0.205, 0.075, 4), K.coverup, this.hips, 0, 0.02, 0, 0, 0, 0, 'coverup');
    this.mesh(G.rbox(0.315 * w, 0.215, 0.205, 0.075, 4), K.jeans, this.hips, 0, 0.02, 0, 0, 0, 0, 'barista');
    this.mesh(G.rbox(0.315 * w, 0.24, 0.205, 0.075, 4), K.dress, this.hips, 0, 0.0, 0, 0, 0, 0, 'beach');
    this.legs = {};
    [-1, 1].forEach(s => {
      const hip = new THREE.Group(); hip.position.set(s * 0.083 * w, -0.04, 0); this.hips.add(hip);
      const thighR = (f ? 0.062 : 0.07) - 0.004 * sl, shinR = (f ? 0.046 : 0.052) - 0.003 * sl;
      this.mesh(G.cap(thighR, 0.34, 12), K.skin, hip, 0, -0.2, 0); this.mesh(G.sph(thighR * 1.02, 10, 8), K.skin, hip, 0, -0.05, 0).scale.set(1, 1.25, 1);
      this.mesh(G.cap(thighR + 0.011, 0.35, 12), K.pants, hip, 0, -0.2, 0, 0, 0, 0, 'casual'); this.mesh(G.cap(thighR + 0.02, 0.35, 12), K.slacks, hip, 0, -0.2, 0, 0, 0, 0, 'work'); this.mesh(G.cap(thighR + 0.018, 0.35, 12), K.jeans, hip, 0, -0.2, 0, 0, 0, 0, 'barista');
      this.mesh(G.cap(thighR + 0.012, 0.16, 12), K.coverup, hip, 0, -0.1, 0, 0, 0, 0, 'coverup'); if (!f) this.mesh(G.cap(thighR + 0.012, 0.14, 12), K.swim, hip, 0, -0.09, 0, 0, 0, 0, 'swim');
      this.mesh(G.cap(thighR + 0.014, 0.1, 12), K.dress, hip, 0, -0.06, 0, 0, 0, 0, 'beach');
      const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
      this.mesh(G.sph(shinR * 0.98, 10, 8), K.skin, knee, 0, 0.0, 0.004);
      this.mesh(G.cap(shinR, 0.32, 12), K.skin, knee, 0, -0.19, 0); this.mesh(G.sph(shinR * 1.02, 10, 8), K.skin, knee, 0, -0.12, -0.015).scale.set(0.9, 1.5, 1);
      this.mesh(G.cap(shinR + 0.012, 0.34, 12), K.pants, knee, 0, -0.17, 0, 0, 0, 0, 'casual'); this.mesh(G.cap(shinR + 0.022, 0.34, 12), K.slacks, knee, 0, -0.17, 0, 0, 0, 0, 'work'); this.mesh(G.cap(shinR + 0.02, 0.34, 12), K.jeans, knee, 0, -0.17, 0, 0, 0, 0, 'barista');
      const ankle = new THREE.Group(); ankle.position.y = -0.4; knee.add(ankle);
      this.mesh(G.cap(0.034, 0.03, 8), K.skin, ankle);
      for (const part of ['swim', 'coverup', 'beach']) { this.mesh(G.rbox(0.082, 0.045, 0.235, 0.02, 4), K.skin, ankle, 0, -0.06, 0.05, 0, 0, 0, part); this.mesh(G.box(0.088, 0.012, 0.245), K.sandal, ankle, 0, -0.082, 0.05, 0, 0, 0, part); }
      this.mesh(G.rbox(0.09, 0.07, 0.255, 0.03, 4), K.shoe, ankle, 0, -0.05, 0.05, 0, 0, 0, 'casual'); this.mesh(G.rbox(0.094, 0.022, 0.26, 0.01, 3), K.sole, ankle, 0, -0.082, 0.05, 0, 0, 0, 'casual');
      this.mesh(G.rbox(0.086, 0.05, 0.245, 0.02, 4), K.shoeWork, ankle, 0, -0.06, 0.05, 0, 0, 0, 'work'); this.mesh(G.rbox(0.088, 0.06, 0.255, 0.02, 4), K.shoeWork, ankle, 0, -0.055, 0.05, 0, 0, 0, 'barista');
      this.legs[s < 0 ? 'L' : 'R'] = { hip, knee, ankle };
    });
    // ── torso
    this.spine = new THREE.Group(); this.spine.position.y = 0.1; this.hips.add(this.spine);
    const prof = f ? [[0, 0], [0.148, 0], [0.144, 0.05], [0.12, 0.13], [0.114, 0.17], [0.128, 0.22], [0.146, 0.28], [0.15, 0.33], [0.148, 0.37], [0.136, 0.41], [0.075, 0.44], [0, 0.45]]
                   : [[0, 0], [0.16, 0], [0.155, 0.06], [0.148, 0.14], [0.15, 0.2], [0.162, 0.27], [0.175, 0.33], [0.18, 0.37], [0.165, 0.41], [0.08, 0.44], [0, 0.45]];
    const torso = this.mesh(G.lathe(prof, 28), K.skin, this.spine); torso.scale.set(1.05 * w, 1, 0.66); this.torso = torso;
    if (f) [-1, 1].forEach(s => this.mesh(G.sph(0.044, 14, 12), K.skin, this.spine, s * 0.048, 0.305, 0.064).scale.set(1, 0.92, 0.8));
    [-1, 1].forEach(s => this.mesh(G.sph(0.046, 12, 10), K.skin, this.spine, s * 0.15 * w, 0.4, 0).scale.set(1.15, 0.75, 1));
    this.mesh(G.sph(0.1, 14, 10), K.skin, this.spine, 0, 0.42, -0.02).scale.set(1.45 * w, 0.3, 0.7);
    [-1, 1].forEach(s => this.mesh(G.cap(0.008, 0.1, 6), K.skin, this.spine, s * 0.07, 0.425, 0.05, 0, 0, s * 1.35));   // collarbones
    const cloth = (p, key, part, sx = 1.06 * w, sz = 0.7) => { const m = this.mesh(G.lathe(p, 28), K[key], this.spine, 0, 0, 0, 0, 0, 0, part); m.scale.set(sx, 1, sz); return m; };
    cloth([[0, 0.19], [0.128, 0.19], [0.136, 0.24], [0.156, 0.3], [0.162, 0.34], [0.156, 0.39], [0.127, 0.415], [0, 0.415]], 'top', 'casual', 1.09 * w, 0.82);
    [-1, 1].forEach(s => this.mesh(G.box(0.022, 0.006, 0.17), K.top, this.spine, s * 0.072, 0.455, -0.01, 0, 0, s * 0.12, 'casual'));
    this.mesh(G.cyl(0.148, 0.154, 0.06, 28), K.pants, this.spine, 0, 0.025, 0, 0, 0, 0, 'casual').scale.set(1.06 * w, 1, 0.7);
    if (f) for (const part of ['casual', 'beach']) { this.mesh(G.torus(0.055, 0.0025, 6, 28), K.gold, this.spine, 0, 0.415, 0.03, Math.PI / 2 - 0.35, 0, 0, part).castShadow = false; this.mesh(G.sph(0.008, 8, 6), K.gold, this.spine, 0, 0.36, 0.083, 0, 0, 0, part).scale.set(1, 1.3, 0.5); }
    cloth([[0, -0.03], [0.152, -0.03], [0.146, 0.05], [0.126, 0.13], [0.12, 0.17], [0.134, 0.22], [0.152, 0.28], [0.157, 0.33], [0.154, 0.37], [0.141, 0.41], [0.08, 0.445], [0, 0.45]], 'shirt', 'work', 1.08 * w, 0.72);
    this.mesh(G.cyl(0.154, 0.158, 0.045, 28), K.slacks, this.spine, 0, -0.012, 0, 0, 0, 0, 'work').scale.set(1.08 * w, 1, 0.72);
    this.mesh(G.cyl(0.157, 0.157, 0.03, 28), K.shoeWork, this.spine, 0, -0.012, 0, 0, 0, 0, 'work').scale.set(1.085 * w, 1, 0.725);
    for (let i = 0; i < 6; i++) { const b = this.mesh(G.sph(0.0075, 8, 6), K.white, this.spine, 0, 0.05 + i * 0.066, 0.109 + (i >= 3 ? 0.008 : 0), 0, 0, 0, 'work'); b.castShadow = false; }
    this.mesh(G.box(0.028, 0.4, 0.006), K.shirt, this.spine, 0, 0.22, 0.11, 0, 0, 0, 'work').castShadow = false;
    [-1, 1].forEach(s => this.mesh(G.box(0.075, 0.06, 0.012), K.shirt, this.spine, s * 0.055, 0.45, 0.06, -0.55, s * 0.55, s * 0.2, 'work'));
    // beach: fitted black tank dress (as in the photo)
    cloth([[0, -0.03], [0.152, -0.03], [0.146, 0.05], [0.124, 0.13], [0.118, 0.17], [0.132, 0.22], [0.15, 0.28], [0.154, 0.33], [0.15, 0.37], [0.13, 0.4], [0, 0.4]], 'dress', 'beach', 1.08 * w, 0.76);
    [-1, 1].forEach(s => this.mesh(G.box(0.03, 0.006, 0.17), K.dress, this.spine, s * 0.07, 0.455, -0.01, 0, 0, s * 0.12, 'beach'));
    if (f) { [-1, 1].forEach(s => this.mesh(G.sph(0.05, 14, 12), K.swim, this.spine, s * 0.048, 0.305, 0.064, 0, 0, 0, 'swim').scale.set(1, 0.92, 0.82)); this.mesh(G.torus(0.136, 0.006, 6, 28), K.swim, this.spine, 0, 0.3, 0, Math.PI / 2, 0, 0, 'swim').scale.set(1.05, 0.7, 1); [-1, 1].forEach(s => this.mesh(G.cap(0.006, 0.12, 6), K.swim, this.spine, s * 0.06, 0.4, 0.02, 0.3, 0, s * 0.1, 'swim')); }
    cloth([[0, 0.02], [0.17, 0.02], [0.165, 0.12], [0.16, 0.22], [0.168, 0.3], [0.17, 0.37], [0.15, 0.42], [0.08, 0.445], [0, 0.45]], 'coverup', 'coverup', 1.1 * w, 0.78);
    cloth([[0, 0.02], [0.152, 0.02], [0.144, 0.12], [0.13, 0.17], [0.144, 0.24], [0.156, 0.31], [0.156, 0.37], [0.138, 0.41], [0.08, 0.445], [0, 0.45]], 'tee', 'barista', 1.07 * w, 0.72);
    this.mesh(G.rbox(0.28 * w, 0.62, 0.012, 0.01, 2), K.apron, this.spine, 0, 0.06, 0.125, 0, 0, 0, 'barista'); this.mesh(G.rbox(0.2 * w, 0.2, 0.012, 0.01, 2), K.apron, this.spine, 0, 0.36, 0.12, 0, 0, 0, 'barista');
    this.mesh(G.torus(0.07, 0.004, 6, 20, Math.PI), K.apron, this.spine, 0, 0.46, 0.02, -Math.PI / 2 + 0.2, 0, 0, 'barista');
    // ── arms
    this.arms = {};
    [-1, 1].forEach(s => {
      const sh = new THREE.Group(); sh.position.set(s * 0.172 * w, 0.4, 0); this.spine.add(sh);
      const ur = (f ? 0.034 : 0.044) - 0.002 * sl, fr = (f ? 0.029 : 0.036) - 0.002 * sl;
      this.mesh(G.sph(ur * 1.2, 12, 10), K.skin, sh, 0, 0, 0); this.mesh(G.cap(ur, 0.22, 10), K.skin, sh, 0, -0.15, 0);
      this.mesh(G.cap(ur + 0.009, 0.23, 10), K.shirt, sh, 0, -0.145, 0, 0, 0, 0, 'work'); this.mesh(G.sph(ur * 1.45, 12, 10), K.shirt, sh, 0, 0.003, 0, 0, 0, 0, 'work');
      this.mesh(G.cap(ur + 0.012, 0.1, 10), K.coverup, sh, 0, -0.08, 0, 0, 0, 0, 'coverup'); this.mesh(G.sph(ur * 1.5, 12, 10), K.coverup, sh, 0, 0.003, 0, 0, 0, 0, 'coverup');
      this.mesh(G.cap(ur + 0.008, 0.07, 10), K.tee, sh, 0, -0.06, 0, 0, 0, 0, 'barista'); this.mesh(G.sph(ur * 1.45, 12, 10), K.tee, sh, 0, 0.003, 0, 0, 0, 0, 'barista');
      const elbow = new THREE.Group(); elbow.position.y = -0.29; sh.add(elbow);
      this.mesh(G.sph(fr * 1.15, 10, 8), K.skin, elbow); this.mesh(G.cap(fr, 0.2, 10), K.skin, elbow, 0, -0.13, 0);
      this.mesh(G.cap(fr + 0.009, 0.19, 10), K.shirt, elbow, 0, -0.125, 0, 0, 0, 0, 'work');
      const wrist = new THREE.Group(); wrist.position.y = -0.26; elbow.add(wrist);
      this.mesh(G.rbox(0.066, 0.082, 0.022, 0.01, 3), K.skin, wrist, 0, -0.045, 0.004);
      for (let k = 0; k < 4; k++) this.mesh(G.cap(0.007, 0.05, 6), K.skin, wrist, -0.024 + k * 0.016, -0.112, 0.004, 0.08, 0, 0);
      this.mesh(G.cap(0.0075, 0.036, 6), K.skin, wrist, s * -0.038, -0.06, 0.012, 0.3, 0, s * 0.9);
      this.arms[s < 0 ? 'L' : 'R'] = { sh, elbow, wrist };
    });
    // ── neck & sculpted head
    this.neck = new THREE.Group(); this.neck.position.y = 0.44; this.spine.add(this.neck);
    this.mesh(G.cyl(0.042, 0.054, 0.11, 14), K.skin, this.neck, 0, 0.045, 0);
    this.head = new THREE.Group(); this.head.position.y = 0.132; this.neck.add(this.head);
    const hg = new THREE.SphereGeometry(0.1, 72, 54); hg.scale(f ? 0.84 : 0.9, f ? 1.12 : 1.08, 0.94); sculptHead(hg, this.look);
    const skull = this.mesh(hg, K.face, this.head, 0, 0.005, -0.002); this.skull = skull;
    this.eyes = [];
    [-1, 1].forEach(s => {
      const e = this.mesh(G.sph(0.0148, 20, 16), K.eye, this.head, s * 0.034, 0.024, 0.069, 0, -Math.PI / 2 + s * 0.1, 0); e.castShadow = false; this.eyes.push(e);
      const lid = this.mesh(new THREE.SphereGeometry(0.016, 16, 8, 0, TAU, 0, Math.PI * 0.5), K.face, this.head, s * 0.034, 0.024, 0.068, -0.5, 0, 0); lid.castShadow = false; e.userData.lid = lid;
      const lidLow = this.mesh(new THREE.SphereGeometry(0.0156, 16, 6, 0, TAU, Math.PI * 0.72, Math.PI * 0.28), K.face, this.head, s * 0.034, 0.024, 0.068, 0.5, 0, 0); lidLow.castShadow = false;
      const lash = this.mesh(G.torus(0.0154, 0.0013, 4, 16, Math.PI), K.brow, this.head, s * 0.034, 0.027, 0.078, 0.5, 0, 0); lash.castShadow = false;
    });
    const bridge = this.mesh(G.cap(0.0068, 0.018, 8), K.face, this.head, 0, 0.002, 0.0905, 0.22, 0, 0); bridge.scale.set(0.9, 1, 0.7); bridge.castShadow = false;
    const tip = this.mesh(G.sph(0.0084, 12, 10), K.face, this.head, 0, -0.019, 0.0955); tip.scale.set(0.95, 0.85, 0.85); tip.castShadow = false;
    [-1, 1].forEach(s => { const n = this.mesh(G.sph(0.0058, 10, 8), K.face, this.head, s * 0.0095, -0.0225, 0.0905); n.scale.set(1, 0.8, 0.9); n.castShadow = false; });
    [-1, 1].forEach(s => { const u = this.mesh(G.sph(0.0085, 12, 8), K.lips, this.head, s * 0.0065, -0.05, 0.0865); u.scale.set(1.2, 0.45, 0.5); u.castShadow = false; });
    const low = this.mesh(G.sph(0.0115, 12, 8), K.lips, this.head, 0, -0.06, 0.085); low.scale.set(1.3, 0.5, 0.5); low.castShadow = false;
    [-1, 1].forEach(s => { const ear = this.mesh(G.sph(0.02, 12, 8), K.skin, this.head, s * 0.086, -0.005, -0.01); ear.scale.set(0.35, 1.05, 0.75); if (this.look.earrings) this.mesh(G.sph(0.0035, 8, 6), K.gold, this.head, s * 0.09, -0.024, -0.008).castShadow = false; });
    if (this.look.flower) {   // pink plumeria behind the ear on the swept side
      const fl = new THREE.Group(); const side = this.look.hairSweep || -1; fl.position.set(side * 0.085, 0.03, 0.012); fl.rotation.set(0.2, side * 1.35, 0); this.head.add(fl);
      const petals = []; for (let i = 0; i < 5; i++) { const pg = new THREE.PlaneGeometry(0.028, 0.044, 1, 3); const pa = pg.attributes.position; for (let k = 0; k < pa.count; k++) { const yy = pa.getY(k); pa.setZ(k, -Math.pow((yy + 0.022) / 0.044, 2) * 0.012 + Math.abs(pa.getX(k)) * 0.15); } pg.translate(0, 0.026, 0); pg.rotateX(-0.35); pg.rotateY(i * TAU / 5); petals.push(pg); }
      const pm = new THREE.Mesh(mergeGeometries(petals, false), K.petal); pm.castShadow = false; fl.add(pm); this.meshes.push(pm);
      const centre = new THREE.Mesh(G.sph(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf5c74a, roughness: 0.8 })); centre.position.y = 0.008; fl.add(centre);
    }
  }
  buildHair(style) {
    this.hair = new THREE.Group(); this.head.add(this.hair); const K = this.mats; const f = this.f;
    if (style === 'none') return;
    const capBack = this.mesh(new THREE.SphereGeometry(0.1, 28, 20, Math.PI * 0.82, Math.PI * 1.36, 0, Math.PI * 0.62), K.hair, this.hair, 0, 0.012, -0.01); capBack.scale.set(f ? 0.905 : 0.94, 1.09, 0.99);
    const capTop = this.mesh(new THREE.SphereGeometry(0.1, 28, 12, Math.PI * 0.18, Math.PI * 0.64, 0, Math.PI * 0.3), K.hair, this.hair, 0, 0.012, -0.01); capTop.scale.set(f ? 0.905 : 0.94, 1.09, 0.99);
    if (style === 'short') { this.mesh(new THREE.SphereGeometry(0.104, 24, 16, Math.PI * 0.82, Math.PI * 1.36, 0, Math.PI * 0.6), K.hair, this.hair, 0, 0.014, -0.014).scale.set(0.95, 1.05, 1.02); return; }
    if (style === 'bun') { this.mesh(G.sph(0.048, 14, 12), K.hair, this.hair, 0, 0.06, -0.09); }
    const sweep = this.look.hairSweep || 0;   // -1: hair tucked behind the left ear, falls forward on the right
    if (style === 'longwave') this.buildHairCurtain(sweep || -1);   // the sculpted hair volume: cap-hugging at the top, flaring over the shoulders
    const N = makeNoise(this.look.seed || 5); const R = 0.1; const side = (i) => (i % 2 ? 1 : -1);
    const inner = [], outer = [];
    // a hair card: a ribbon following the strand path, facing outward from the head, carrying the fibre texture
    const ribbon = (pts, w0, w1, segs = 26, twist = 0) => {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.55); const n = segs + 1; const pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), uv = new Float32Array(n * 4); const idx = [];
      const p = new THREE.Vector3(), tg = new THREE.Vector3(), out = new THREE.Vector3(), sd = new THREE.Vector3();
      for (let j = 0; j < n; j++) { const t = j / segs; curve.getPointAt(t, p); curve.getTangentAt(t, tg); out.set(p.x, 0, p.z + 0.01); if (out.lengthSq() < 1e-6) out.set(0, 0, 1); out.normalize(); sd.crossVectors(tg, out).normalize(); if (twist) { const cs = Math.cos(twist), sn = Math.sin(twist); const b = new THREE.Vector3().crossVectors(tg, sd); sd.multiplyScalar(cs).addScaledVector(b, sn).normalize(); } const w = lerp(w0, w1, t) * 0.5;
        pos.set([p.x - sd.x * w, p.y - sd.y * w, p.z - sd.z * w, p.x + sd.x * w, p.y + sd.y * w, p.z + sd.z * w], j * 6); nor.set([out.x, out.y, out.z, out.x, out.y, out.z], j * 6); uv.set([0, t, 1, t], j * 4);
        if (j < segs) idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
    };
    const taperTube = (pts, r0, r1, segs = 26) => ribbon(pts, r0 * 6, r1 * 6, segs);
    const count = style === 'longwave' ? (this.look.hairCards || 110) : style === 'ponytail' ? 26 : 34;
    for (let i = 0; i < count; i++) {
      const sd = side(i); const t = ((i >> 1) + 0.5) / (count / 2); const layer = (i % 4 < 2) ? inner : outer;
      const tucked = style === 'longwave' && sd === sweep;
      const phi0 = 0.08 + t * 2.98 + N.n2(i, 1) * 0.06;
      let phi1 = phi0 < 1.0 ? 1.0 + phi0 * 0.35 : phi0; if (tucked && phi1 < 2.05) phi1 = 2.05 + (phi1 - 1.0) * 0.5;
      const theta0 = 0.08 + Math.abs(N.n2(i, 2)) * 0.22;
      const pts = []; const rr = R + 0.012 + Math.abs(N.n2(i, 3)) * (layer === outer ? 0.04 : 0.024);
      for (let k = 0; k <= 8; k++) { const q = k / 8; const th = theta0 + q * (1.5 - theta0); const phi = phi0 + (phi1 - phi0) * Math.pow(q, 0.7); pts.push(new THREE.Vector3(sd * rr * Math.sin(th) * Math.sin(phi), rr * Math.cos(th) + 0.014, rr * Math.sin(th) * Math.cos(phi) - 0.012)); }
      const last = pts[pts.length - 1]; const len = style === 'longwave' ? (0.42 + Math.abs(N.n2(i, 4)) * 0.2 + t * 0.05) : style === 'ponytail' ? 0.0 : 0.16 + Math.abs(N.n2(i, 4)) * 0.08;
      const front = !tucked && phi1 < 1.5, back = phi1 > 2.0; const steps = Math.max(2, Math.round(len / 0.035)); const ph = N.n2(i, 5) * TAU; const amp = 0.018 + Math.abs(N.n2(i, 7)) * 0.02; const freq = 1.1 + Math.abs(N.n2(i, 8)) * 0.6;
      const dirx = sd * Math.sin(phi1), dirz = Math.cos(phi1);
      for (let k = 1; k <= steps; k++) {
        const u = k / steps; const y = last.y - u * len * (0.98 + 0.06 * Math.sin(u * 3 + ph)); const flare = 0.012 + u * u * 0.055 + (front ? 0.015 * u : 0);
        const wave = Math.sin(u * TAU * freq + ph) * (amp * (0.25 + u)) + Math.sin(u * TAU * 3.1 + ph * 1.7) * 0.006 * u; const wz = Math.cos(u * TAU * freq * 0.8 + ph * 0.7) * 0.016 * u;
        let x = last.x + dirx * flare + wave * dirz * 0.85, z = last.z + dirz * flare * (back ? 1.1 : 0.6) + wave * -dirx * 0.85 + wz;
        if (front) { x = sd * Math.max(Math.abs(x), 0.078 + u * 0.03); z = clamp(z, -0.01, 0.085 - u * 0.02); }
        if (tucked) { x = sd * Math.max(Math.abs(x), 0.06 + u * 0.04); z = Math.min(z, -0.03 - u * 0.02); }
        pts.push(new THREE.Vector3(x, y, z));
      }
      if (style === 'longwave' && steps > 2) { const e = pts[pts.length - 1]; e.x += dirx * 0.035; e.z += (front ? 0.025 : -0.015); }
      const w0 = 0.012 + Math.abs(N.n2(i, 6)) * 0.01; layer.push(ribbon(pts, w0, w0 * 0.5, 26, N.n2(i, 12) * 0.9));
    }
    if (style === 'ponytail') { const pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push(new THREE.Vector3(Math.sin(u * 6) * 0.02, 0.03 - u * 0.36, -0.1 - Math.sin(u * Math.PI) * 0.09)); } inner.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 8, false)); inner.push(new THREE.SphereGeometry(0.04, 12, 10).translate(0, 0.03, -0.1)); }
    if (style === 'longwave') {
      for (let i = 0; i < 8; i++) { const sd = side(i); if (sd === sweep && i > 1) continue; const pts = []; const a0 = 0.15 + (i >> 1) * 0.12; for (let k = 0; k <= 7; k++) { const u = k / 7; const th = 0.25 + u * 1.25; const phi = sd * (a0 + u * 0.7); pts.push(new THREE.Vector3((R + 0.014) * Math.sin(th) * Math.sin(phi) + sd * u * u * 0.02, (R + 0.014) * Math.cos(th) + 0.014 - u * u * 0.06, (R + 0.014) * Math.sin(th) * Math.cos(phi) - 0.006 + u * 0.01)); } outer.push(ribbon(pts, 0.016, 0.008, 14, N.n2(i, 13) * 0.5)); }
      for (let i = 0; i < 30; i++) {   // flyaways: thin strands lifting off the mass
        const sd = side(i); const pts = []; const phi = 0.9 + Math.abs(N.n2(i, 9)) * 2.0; const y0 = 0.02 - Math.abs(N.n2(i, 10)) * 0.25; const rr = R + 0.03 + Math.abs(N.n2(i, 11)) * 0.04;
        for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(new THREE.Vector3(sd * (rr + u * 0.02 + Math.sin(u * 5 + i) * 0.01) * Math.sin(phi), y0 - u * 0.2, rr * Math.cos(phi) - 0.02 + Math.sin(u * 4 + i * 2) * 0.012)); }
        outer.push(ribbon(pts, 0.012, 0.006, 10));
      }
    }
    const outerMat = K.hairCard.clone(); outerMat.color.copy(K.hairCard.color).lerp(new THREE.Color(this.look.hairSheen), 0.3); outerMat.sheenColor.copy(new THREE.Color(this.look.hairSheen)).lerp(new THREE.Color(0xff9a70), 0.3); outerMat.userData.hookKey = 'hair';
    K.hairCard.userData.hookKey = 'hair';
    if (inner.length) { const hm = new THREE.Mesh(mergeGeometries(inner, false), K.hairCard); hm.castShadow = true; hm.receiveShadow = true; this.hair.add(hm); this.meshes.push(hm); }
    if (outer.length) { const hm = new THREE.Mesh(mergeGeometries(outer, false), outerMat); hm.castShadow = true; hm.receiveShadow = true; this.hair.add(hm); this.meshes.push(hm); }
  }
  buildHairCurtain(sweep) {
    const N = makeNoise((this.look.seed || 5) + 100); const rows = 52, cols = 72; const K = this.mats;
    const pos = [], col = [], uv = [], idx = []; const base = new THREE.Color(this.look.hairColor), tip = new THREE.Color(this.look.hairSheen);
    const span = 1.02 * Math.PI, start = sweep * 0.6 * Math.PI;   // begins behind the tucked ear, wraps round the back, ends beside the face on the other side
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols; const phi = start + sweep * u * span;
        const tEnd = 1 - Math.abs(N.n2(u * 9, 3)) * 0.2; const tt = Math.min(t, tEnd);                     // ragged, uneven ends
        const flare = smoothstep(0.05, 0.5, tt) * 0.052 + smoothstep(0.45, 1, tt) * 0.02;
        let r = 0.094 + flare;
        r += Math.sin(tt * TAU * 1.35 + phi * 1.6 + N.n2(3, 1) * 2) * 0.013 * (0.25 + tt);                 // long S-waves
        r += Math.sin(phi * 58 + tt * 9) * 0.0028 + N.n2(u * 34, tt * 15) * 0.0045;                        // strand grooves
        const front = Math.cos(phi) > 0.2; const y = 0.06 - tt * 0.62 - tt * tt * 0.02 + (front ? tt * 0.02 : 0);
        let x = r * Math.sin(phi), z = r * Math.cos(phi) - 0.012 - (front ? 0 : tt * 0.02);
        if (front) z += tt * 0.03;                                                                         // the loose side drapes forward over the collarbone
        pos.push(x, y, z); uv.push(u, tt); const c = base.clone().lerp(tip, 0.06 + tt * 0.24 + Math.max(0, N.n2(u * 12, 7)) * 0.2); col.push(c.r, c.g, c.b);   // deep burgundy, red where light catches the waves
        if (j < rows && i < cols) { const a = j * (cols + 1) + i; idx.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(this.look.hairSheen), clearcoat: 0.18, clearcoatRoughness: 0.45, envMapIntensity: 0.4, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; this.hair.add(mesh); this.meshes.push(mesh); K.curtain = m;
  }
  applyOutfit() {
    for (const p in this.parts) this.parts[p].forEach(m => m.visible = (p === this.outfit));
    this.mats.slacks.color.setHex(SLACK_COLORS[this.slack] || SLACK_COLORS.beige); this.mats.shirt.color.setHex(SHIRT_COLORS[this.shirt] || SHIRT_COLORS.white);
  }
  setOutfit(outfit, slack, shirt) { if (outfit) this.outfit = outfit; if (slack) this.slack = slack; if (shirt) this.shirt = shirt; this.applyOutfit(); }
  animate(dt, s) {
    const stride = s.speed > 2.4 ? 1.5 : 1.15; if (s.moving) this.phase = (this.phase + (s.speed / stride) * dt) % 1;
    this.gait = damp(this.gait, s.moving ? 1 : 0, 8, dt); this.breath += dt * 1.3;
    const ph = this.phase * TAU, g = this.gait, run = s.speed > 2.4; const L = this.legs, A = this.arms;
    const legA = (run ? 0.85 : 0.5) * g, armA = (run ? 0.75 : 0.32) * g, kneeA = (run ? 1.3 : 0.85) * g;
    this.shiftT -= dt; if (this.shiftT < 0 && !s.moving && !s.seated) { this.shiftT = rand(3, 9); this.shiftTarget = pick([-1, 0, 1]) * 0.6; } if (s.moving) this.shiftTarget = 0; this.shift = damp(this.shift, this.shiftTarget, 1.5, dt);
    if (s.seated) {
      this.hips.position.set(0, damp(this.hips.position.y, s.seatH + 0.1, 8, dt), 0.02);
      for (const k of ['L', 'R']) { L[k].hip.rotation.x = damp(L[k].hip.rotation.x, s.recline ? -1.35 : -1.5, 8, dt); L[k].knee.rotation.x = damp(L[k].knee.rotation.x, s.recline ? 0.2 : 1.5, 8, dt); L[k].ankle.rotation.x = damp(L[k].ankle.rotation.x, 0, 8, dt); A[k].sh.rotation.x = damp(A[k].sh.rotation.x, -0.5, 8, dt); A[k].sh.rotation.z = damp(A[k].sh.rotation.z, (k === 'L' ? 1 : -1) * 0.12, 8, dt); A[k].elbow.rotation.x = damp(A[k].elbow.rotation.x, -1.05, 8, dt); }
      this.spine.rotation.set(damp(this.spine.rotation.x, s.recline ? -0.62 : -0.05, 8, dt), 0, 0);
    } else {
      const crouchY = s.crouch ? 0.62 : 0.93; const bob = Math.abs(Math.sin(ph)) * (run ? 0.045 : 0.02) * g;
      this.hips.position.set(damp(this.hips.position.x, this.shift * 0.025 + Math.sin(ph) * 0.012 * g, 6, dt), damp(this.hips.position.y, crouchY + bob + Math.sin(this.breath) * 0.002, 12, dt), 0);
      this.hips.rotation.z = damp(this.hips.rotation.z, -Math.sin(ph) * 0.05 * g + this.shift * 0.04, 6, dt);
      ['L', 'R'].forEach((k, i) => {
        const sg = i === 0 ? 1 : -1; const f2 = ph + (i === 0 ? 0 : Math.PI);
        const hipT = Math.sin(f2) * legA + (s.crouch ? -0.9 : 0) + (!s.moving ? this.shift * sg * 0.05 : 0); const kneeT = Math.max(0, -Math.sin(f2 - 0.6)) * kneeA + (s.crouch ? 1.6 : 0.04) + (!s.moving && this.shift * sg > 0 ? 0.08 : 0);
        L[k].hip.rotation.x = damp(L[k].hip.rotation.x, hipT, 14, dt); L[k].hip.rotation.z = damp(L[k].hip.rotation.z, -this.hips.rotation.z * 0.5, 8, dt); L[k].knee.rotation.x = damp(L[k].knee.rotation.x, kneeT, 14, dt); L[k].ankle.rotation.x = damp(L[k].ankle.rotation.x, -hipT * 0.35 - kneeT * 0.3 + (s.crouch ? 0.5 : 0) + Math.max(0, Math.sin(f2 + 0.9)) * 0.25 * g, 12, dt);
        if (s.arms === 'wipe') { A[k].sh.rotation.x = damp(A[k].sh.rotation.x, k === 'R' ? -0.62 + Math.sin(W.time * 3.5) * 0.18 : -0.3, 8, dt); A[k].sh.rotation.z = damp(A[k].sh.rotation.z, sg * 0.2 + (k === 'R' ? Math.cos(W.time * 3.5) * 0.2 : 0), 8, dt); A[k].elbow.rotation.x = damp(A[k].elbow.rotation.x, k === 'R' ? -0.55 : -0.45, 8, dt); }
        else if (s.arms === 'hold') { A[k].sh.rotation.x = damp(A[k].sh.rotation.x, -0.9, 8, dt); A[k].sh.rotation.z = damp(A[k].sh.rotation.z, sg * 0.12, 8, dt); A[k].elbow.rotation.x = damp(A[k].elbow.rotation.x, -1.5, 8, dt); }
        else { A[k].sh.rotation.x = damp(A[k].sh.rotation.x, -Math.sin(f2) * armA + 0.05, 12, dt); A[k].sh.rotation.z = damp(A[k].sh.rotation.z, sg * (0.1 + (run ? 0.15 : 0)) + this.shift * 0.02, 6, dt); A[k].elbow.rotation.x = damp(A[k].elbow.rotation.x, -(0.22 + (run ? 0.9 : 0.18) * g + Math.max(0, -Math.sin(f2)) * 0.45 * g), 12, dt); }
      });
      this.spine.rotation.x = damp(this.spine.rotation.x, (run ? -0.18 : -0.03) * g + (s.crouch ? 0.25 : 0), 8, dt);
      this.spine.rotation.y = damp(this.spine.rotation.y, -Math.sin(ph) * 0.09 * g, 8, dt);
      this.spine.rotation.z = damp(this.spine.rotation.z, (1 - g) * Math.sin(this.breath * 0.5) * 0.01 - this.shift * 0.05, 4, dt);
    }
    let hy = s.headYaw || 0, hp = s.headPitch || 0;
    if (s.lookAt) { const local = this.neck.worldToLocal(s.lookAt.clone()); const yaw = Math.atan2(local.x, local.z), pitch = Math.atan2(local.y - 0.14, Math.hypot(local.x, local.z)); this.lookYaw = damp(this.lookYaw, clamp(yaw, -1.2, 1.2), 5, dt); this.lookPitch = damp(this.lookPitch, clamp(pitch, -0.6, 0.6), 5, dt); this.lookW = damp(this.lookW, 1, 4, dt); } else this.lookW = damp(this.lookW, 0, 4, dt);
    hy += this.lookYaw * this.lookW; hp -= this.lookPitch * this.lookW;
    this.head.rotation.set(damp(this.head.rotation.x, -hp * 0.55, 10, dt), damp(this.head.rotation.y, clamp(hy, -1.1, 1.1) * 0.65, 10, dt), damp(this.head.rotation.z, this.shift * 0.03, 4, dt));
    this.neck.rotation.y = damp(this.neck.rotation.y, clamp(hy, -1.1, 1.1) * 0.35, 10, dt);
    this.torso.scale.y = 1 + Math.sin(this.breath) * 0.006;
    this.hair.rotation.x = Math.sin(ph * 2) * 0.02 * g + Math.sin(this.breath * 0.7) * 0.004; this.hair.position.y = -Math.abs(Math.sin(ph)) * 0.006 * g;
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = rand(2.5, 6); } this.blink = Math.max(0, this.blink - dt * 8); const open = 1 - Math.sin(this.blink * Math.PI);
    this.eyes.forEach(e => { e.userData.lid.rotation.x = -0.5 - (1 - open) * 1.2; });
    this.head.visible = !s.hideHead;
  }
}
class Avatar extends Humanoid {
  constructor() {
    super(PLAYER_LOOK);
    try { const saved = JSON.parse(store.getItem('cafe_outfit') || 'null'); if (saved) { this.outfit = saved.outfit || 'casual'; this.slack = saved.slack || 'beige'; this.shirt = saved.shirt || 'white'; } } catch (e) {}
    this.applyOutfit();
  }
  applyOutfit() { super.applyOutfit(); try { store.setItem('cafe_outfit', JSON.stringify({ outfit: this.outfit, slack: this.slack, shirt: this.shirt })); } catch (e) {} }
}
