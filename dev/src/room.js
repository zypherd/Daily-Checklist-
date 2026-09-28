// ─── Materials, static batching, room shell, lighting, sky ───────────────────
const M = {};          // shared materials
const ROOM = { w: 12, d: 9, h: 3.2, x0: -6, x1: 6, z0: -4.5, z1: 4.5 };

const _m4 = () => new THREE.Matrix4();
function mat(x = 0, y = 0, z = 0, ry = 0, { rx = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  return _m4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}
class Batcher {
  constructor() { this.groups = {}; this.count = 0; }
  add(geom, key, m, { uv = 'auto' } = {}) { const g = geom.index ? geom.toNonIndexed() : geom.clone(); g.applyMatrix4(m); if (uv !== 'keep' && M[key] && M[key].userData.worldUV) worldUV(g, M[key].userData.worldUV); (this.groups[key] ||= []).push(g); this.count++; }
  build(parent, { shadow = true } = {}) {
    for (const key in this.groups) {
      const merged = mergeGeometries(this.groups[key], false); if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, M[key]); mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.name = 'batch:' + key;
      parent.add(mesh);
    }
    this.groups = {};
  }
}
const B = new Batcher();        // static, shadow-casting furniture
const BNS = new Batcher();      // static, no shadow casting (small clutter)

// geometry cache
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  sph: (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs),
  cap: (r, l, seg = 8) => new THREE.CapsuleGeometry(r, l, 4, seg),
  rbox: (w, h, d, r = 0.02, s = 3) => new RoundedBoxGeometry(w, h, d, s, r),
  plane: (w, h) => new THREE.PlaneGeometry(w, h),
  torus: (r, t, rs = 8, ts = 24, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  lathe: (pts, seg = 24) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg),
};
let RoundedBoxGeometry;

async function buildMaterials() {
  const yieldFrame = async (msg, pct) => { loadStatus(msg, pct); await nextFrame(); };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  const floor = woodTexture({ hue: 30, sat: 44, light: 40, planks: 6, size: 512, seed: 3 });
  M.floor = phys({ map: toTexture(floor.map, { repeat: [9, 7] }), normalMap: toTexture(floor.normal, { repeat: [9, 7], srgb: false }), roughnessMap: toTexture(floor.rough, { repeat: [9, 7], srgb: false }), roughness: 0.62, metalness: 0.0, envMapIntensity: 0.7, clearcoat: 0.28, clearcoatRoughness: 0.42 });
  M.floor.normalScale = new THREE.Vector2(0.8, 0.8);
  await yieldFrame('Oiling the walnut tables…', 26);
  const walnut = woodTexture({ hue: 22, sat: 38, light: 26, planks: 3, size: 256, seed: 12, grain: 1.4 });
  M.walnut = phys({ map: toTexture(walnut.map), normalMap: toTexture(walnut.normal, { srgb: false }), roughness: 0.48, metalness: 0.0, envMapIntensity: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  M.walnut.normalScale = new THREE.Vector2(0.35, 0.35);
  const oak = woodTexture({ hue: 34, sat: 40, light: 52, planks: 4, size: 256, seed: 21 });
  M.oak = phys({ map: toTexture(oak.map), normalMap: toTexture(oak.normal, { srgb: false }), roughness: 0.55, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.45 });
  M.oak.normalScale = new THREE.Vector2(0.3, 0.3);
  const dark = woodTexture({ hue: 18, sat: 30, light: 16, planks: 2, size: 256, seed: 8 });
  M.darkwood = std({ map: toTexture(dark.map), roughness: 0.6, metalness: 0.03 });
  await yieldFrame('Plastering the walls…', 32);
  const plaster = plasterTexture({ r: 232, g: 220, b: 204, amount: 9 });
  M.wall = std({ map: toTexture(plaster.map, { repeat: [3, 1.5] }), normalMap: toTexture(plaster.normal, { repeat: [3, 1.5], srgb: false }), roughness: 0.95, metalness: 0, side: THREE.FrontSide });
  M.wall.normalScale = new THREE.Vector2(0.4, 0.4);
  const plaster2 = plasterTexture({ r: 88, g: 62, b: 70, amount: 6, seed: 17 });   // accent wall (dusty plum) behind the bar
  M.wallAccent = std({ map: toTexture(plaster2.map, { repeat: [3, 1.5] }), normalMap: toTexture(plaster2.normal, { repeat: [3, 1.5], srgb: false }), roughness: 0.92 });
  await yieldFrame('Hanging the pendant lights…', 38);
  M.ceiling = std({ color: 0xf1ebe1, roughness: 0.95, side: THREE.FrontSide });
  M.trim = std({ color: 0xf4efe6, roughness: 0.6 });
  M.tile = std({ map: toTexture(tileTexture(), { repeat: [2.5, 1.2] }), roughness: 0.25, metalness: 0.05, envMapIntensity: 0.8 });
  M.steel = std({ color: 0xd4d7db, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.4 });
  M.steelDark = std({ color: 0x55585c, metalness: 0.85, roughness: 0.4 });
  M.black = std({ color: 0x1b1a1c, metalness: 0.4, roughness: 0.5 });
  M.brass = std({ color: 0xc9a25a, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.4 });
  M.ceramic = phys({ color: 0xf4f0ea, roughness: 0.25, metalness: 0.0, envMapIntensity: 0.8, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  M.ceramicRose = phys({ color: 0xe6a9b8, roughness: 0.25, metalness: 0.0, envMapIntensity: 0.8, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  M.coffee = std({ color: 0x3b2418, roughness: 0.15, metalness: 0.05 });
  M.latte = std({ color: 0xc9a27e, roughness: 0.4 });
  const fab = (r, g, b, seed) => { const c = fabricTexture({ r, g, b, seed }); const m = phys({ map: toTexture(c, { repeat: [3, 3] }), normalMap: toTexture(heightToNormal(c, 1.2), { repeat: [3, 3], srgb: false }), roughness: 0.95, sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color(r / 255, g / 255, b / 255).lerp(new THREE.Color(1, 1, 1), 0.3) }); m.normalScale = new THREE.Vector2(0.5, 0.5); return m; };
  M.fabricRose = fab(196, 128, 140, 9); M.fabricSage = fab(132, 148, 122, 2); M.fabricCream = fab(222, 208, 186, 4);
  M.leather = phys({ color: 0x5b3a2a, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.5, normalMap: toTexture(heightToNormal(fabricTexture({ r: 90, g: 60, b: 40, weave: 5, seed: 21 }), 0.6), { repeat: [4, 4], srgb: false }) }); M.leather.normalScale = new THREE.Vector2(0.25, 0.25);
  M.velvet = phys({ color: 0x6b3c50, roughness: 0.9, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc07898), normalMap: toTexture(heightToNormal(fabricTexture({ r: 100, g: 60, b: 80, weave: 2, seed: 12 }), 0.8), { repeat: [6, 6], srgb: false }) }); M.velvet.normalScale = new THREE.Vector2(0.35, 0.35);
  M.rug = std({ map: toTexture(rugTexture(), { aniso: true }), roughness: 1 });
  M.sisal = std({ map: toTexture(fabricTexture({ r: 190, g: 160, b: 110, weave: 2, seed: 6 }), { repeat: [4, 1] }), roughness: 1 });
  M.carpetGray = std({ map: toTexture(fabricTexture({ r: 120, g: 118, b: 118, weave: 2, seed: 3 }), { repeat: [2, 2] }), roughness: 1 });
  M.pot = std({ color: 0xb9744e, roughness: 0.8 });
  M.potWhite = std({ color: 0xece6dc, roughness: 0.5 });
  M.soil = std({ color: 0x2e2118, roughness: 1 });
  M.leafMonstera = std({ map: leafTexture('monstera'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  M.leafFern = std({ map: leafTexture('fern'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  M.leafSnake = std({ map: leafTexture('snake'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  M.glass = phys({ color: 0xe8f0f4, transparent: true, opacity: 0.14, roughness: 0.03, metalness: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false, reflectivity: 1, clearcoat: 1, clearcoatRoughness: 0.02 });
  M.glassCase = phys({ color: 0xe8eef0, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.05, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false });
  M.bulb = std({ color: 0xfff1d6, emissive: 0xffc98a, emissiveIntensity: 2.2, roughness: 0.3 });
  M.bulbOff = std({ color: 0xd8d2c8, roughness: 0.3 });
  M.shade = std({ color: 0x2c2a2e, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  M.shadeInner = std({ color: 0xf0d9b8, emissive: 0xf5c78a, emissiveIntensity: 0.35, side: THREE.BackSide });
  M.chalk = std({ map: menuBoardTexture(), roughness: 0.95 });
  M.paper = std({ color: 0xf6f1e8, roughness: 0.9 });
  M.books = [0, 1, 2, 3].map(i => std({ map: bookSpinesTexture(i + 1), roughness: 0.85 }));
  M.art = [0, 1, 2, 3].map(i => std({ map: paintingTexture(i), roughness: 0.7 }));
  M.frame = std({ color: 0x2a221c, roughness: 0.5, metalness: 0.1 });
  M.pastry = std({ color: 0xc9853f, roughness: 0.7 });
  M.pastryPink = std({ color: 0xe8a0b4, roughness: 0.5 });
  M.radiator = std({ color: 0xe9e4da, roughness: 0.4, metalness: 0.3 });
  M.toyBall = std({ color: 0xe25f6f, roughness: 0.6 });
  M.toyBall2 = std({ color: 0x5fa8e2, roughness: 0.6 });
  M.toyMouse = phys({ color: 0x9a9a9a, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xdddddd) });
  M.chairSeat = M.leather;
  M.sidewalk = std({ color: 0xb9b3aa, roughness: 0.95 });
  M.road = std({ color: 0x4a4a4c, roughness: 0.95 });
  M.building = [std({ color: 0xa9705a, roughness: 0.9 }), std({ color: 0xd9cfc0, roughness: 0.9 }), std({ color: 0x7d8a92, roughness: 0.9 })];
  M.bWindow = std({ color: 0x8fb0c8, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.2, metalness: 0.4 });
  M.trunk = std({ color: 0x5a4030, roughness: 0.95 });
  M.foliage = std({ color: 0x4f8a3e, roughness: 0.9 });
  M.lamp = std({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6 });
  M.blob = new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.55 });
  M.blobAO = new THREE.MeshBasicMaterial({ map: radialTexture(128, 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false, opacity: 0.5 });
  M.steam = new THREE.SpriteMaterial({ map: radialTexture(64, 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, opacity: 0.35 });
  M.person = std({ color: 0x334, roughness: 0.9 });
  M.bird = std({ color: 0x8b5a3c, roughness: 0.9 });
  M.birdWing = std({ color: 0x6f4530, roughness: 0.9, side: THREE.DoubleSide });
  M.sign = std({ color: 0x24211f, roughness: 0.8 });
  upgradeInteriorMaterials();
}
// scanned textures replace the procedural ones as they stream in (see assets.js); `world` box-maps in metres
function upgradeInteriorMaterials() {
  if (!ASSETS.enabled || !ASSETS.manifest) return;
  upgradeMaterial(M.floor, 'oak_wood_planks', { world: true, sizeScale: 1.35, normalScale: 0.7, roughness: 0.85, aniso: 16 }); M.floor.clearcoat = 0.18;
  upgradeMaterial(M.walnut, 'wood_table_001', { world: true, normalScale: 0.5, roughness: 0.75 }); M.walnut.clearcoat = 0.25;
  upgradeMaterial(M.oak, 'oak_veneer_01', { world: true, normalScale: 0.4, roughness: 0.85 });
  upgradeMaterial(M.darkwood, 'dark_wooden_planks', { world: true, normalScale: 0.6, roughness: 0.9, color: 0xb9a48c });
  upgradeMaterial(M.wall, 'beige_wall_001', { world: true, sizeScale: 1.2, normalScale: 0.5, roughness: 1, color: 0xfff1e0, ao: 0.6 });
  upgradeMaterial(M.wallAccent, 'plastered_wall_04', { world: true, normalScale: 0.6, roughness: 1, color: 0x9a7484, ao: 0.6 });
  upgradeMaterial(M.ceiling, 'plastered_wall_03', { world: true, normalScale: 0.3, roughness: 1, color: 0xfffaf3, ao: 0.35 });
  upgradeMaterial(M.tile, 'long_white_tiles', { world: true, sizeScale: 0.7, normalScale: 0.6, roughness: 0.6 }); M.tile.envMapIntensity = 0.9;
  upgradeMaterial(M.velvet, 'velour_velvet', { world: true, sizeScale: 1.4, normalScale: 0.5, roughness: 1, color: 0x8b4a68 });
  upgradeMaterial(M.fabricRose, 'rough_linen', { world: true, sizeScale: 1.2, normalScale: 0.6, roughness: 1, color: 0xd8969f });
  upgradeMaterial(M.fabricSage, 'cotton_jersey', { world: true, sizeScale: 1.2, normalScale: 0.5, roughness: 1, color: 0xa4b89a });
  upgradeMaterial(M.fabricCream, 'curly_teddy_natural', { world: true, normalScale: 0.6, roughness: 1, color: 0xf2e6d4 });
  upgradeMaterial(M.leather, 'brown_leather', { world: true, sizeScale: 1.5, normalScale: 0.5, roughness: 0.85 }); M.leather.clearcoat = 0.15;
  upgradeMaterial(M.sisal, 'hessian_230', { world: true, sizeScale: 0.8, normalScale: 0.8, roughness: 1, color: 0xd6b98c });
  upgradeMaterial(M.carpetGray, 'terry_cloth', { world: true, normalScale: 0.6, roughness: 1, color: 0x8f8c8a });
}

function rugTexture() {
  const [c, ctx] = canvas2d(512, 512); const N = makeNoise(41);
  ctx.fillStyle = '#8a5a5f'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#d9c1a8'; ctx.lineWidth = 8; ctx.strokeRect(24, 24, 464, 464); ctx.lineWidth = 3; ctx.strokeRect(44, 44, 424, 424);
  ctx.fillStyle = '#d9c1a8';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { ctx.save(); ctx.translate(90 + i * 66, 90 + j * 66); ctx.rotate(Math.PI / 4); ctx.fillRect(-14, -14, 28, 28); ctx.fillStyle = '#8a5a5f'; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = '#d9c1a8'; ctx.restore(); }
  const img = ctx.getImageData(0, 0, 512, 512); for (let i = 0; i < img.data.length; i += 4) { const x = (i / 4) % 512, y = Math.floor(i / 4 / 512); const n = N.n2(x * 0.5, y * 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0); return c;
}

// ─── Room shell ───────────────────────────────────────────────────────────────
// Wall with openings: `len` along local X, openings are [from,to,bottom,top] in local X / height.
function wallSegments(len, h, openings, thick, key, frame) {
  // frame: matrix placing local origin (left end of the wall at floor level), local +X along the wall, +Z pointing into the room
  const add = (x0, x1, y0, y1) => { if (x1 - x0 <= 0.001 || y1 - y0 <= 0.001) return; B.add(G.box(x1 - x0, y1 - y0, thick), key, frame.clone().multiply(mat((x0 + x1) / 2, (y0 + y1) / 2, -thick / 2))); };
  const xs = [0, ...openings.flatMap(o => [o[0], o[1]]), len];
  for (let i = 0; i < xs.length - 1; i += 2) add(xs[i], xs[i + 1], 0, h);                 // solid piers
  openings.forEach(o => { add(o[0], o[1], 0, o[2]); add(o[0], o[1], o[3], h); });          // below sill / above lintel
}

function windowFrame(frame, x0, x1, y0, y1, { mullionsX = 2, mullionsY = 1, sillDepth = 0.12, key = 'trim' } = {}) {
  const w = x1 - x0, h = y1 - y0, t = 0.06, d = 0.1;
  const f = frame.clone().multiply(mat((x0 + x1) / 2, (y0 + y1) / 2, 0));
  B.add(G.box(w + 2 * t, t, d), key, f.clone().multiply(mat(0, h / 2 + t / 2, 0)));
  B.add(G.box(w + 2 * t, t, d), key, f.clone().multiply(mat(0, -h / 2 - t / 2, 0)));
  B.add(G.box(t, h, d), key, f.clone().multiply(mat(-w / 2 - t / 2, 0, 0)));
  B.add(G.box(t, h, d), key, f.clone().multiply(mat(w / 2 + t / 2, 0, 0)));
  for (let i = 1; i <= mullionsX; i++) B.add(G.box(0.035, h, 0.05), key, f.clone().multiply(mat(-w / 2 + (w / (mullionsX + 1)) * i, 0, 0)));
  for (let i = 1; i <= mullionsY; i++) B.add(G.box(w, 0.035, 0.05), key, f.clone().multiply(mat(0, -h / 2 + (h / (mullionsY + 1)) * i, 0)));
  // interior sill ledge
  B.add(G.box(w + 0.3, 0.04, sillDepth + 0.1), 'oak', f.clone().multiply(mat(0, -h / 2 - 0.02, (sillDepth + 0.1) / 2 - 0.05)));
  // glass pane (dynamic mesh so it can be transparent & unbatched)
  const glass = new THREE.Mesh(G.plane(w, h), M.glass); glass.applyMatrix4(f); glass.renderOrder = 5; W.scene.add(glass);
}

function buildRoom() {
  const { w, d, h, x0, x1, z0, z1 } = ROOM;
  // floor
  const floor = new THREE.Mesh(G.plane(w + 0.2, d + 0.2), M.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; W.scene.add(floor); applyWorldUV(floor);
  // ceiling (faces down; invisible from above so the orbit camera can peek in)
  const cg = new THREE.Group(); cg.name = 'ceiling'; W.ceilingGroup = cg; W.scene.add(cg);
  const ceil = new THREE.Mesh(G.plane(w, d), M.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; ceil.receiveShadow = true; cg.add(ceil); applyWorldUV(ceil);
  for (let x = -4; x <= 4; x += 2) { const beam = new THREE.Mesh(G.box(0.16, 0.22, d), M.darkwood); beam.position.set(x, h - 0.11, 0); beam.castShadow = true; beam.receiveShadow = true; cg.add(beam); }   // ceiling beams (hidden in the overhead view)
  const thick = 0.25;
  // front wall (z = z1), local +X = world -X so that +Z(local) points into the room: rotate PI around Y
  const front = mat(x1, 0, z1, Math.PI);
  const winF = [[0.8, 3.8, 0.85, 2.75], [4.4, 7.4, 0.85, 2.75], [8.4, 9.4, 0, 2.5]];   // two big windows + a glass door (local x from right corner)
  wallSegments(w, h, winF, thick, 'wall', front);
  windowFrame(front, 0.8, 3.8, 0.85, 2.75, { mullionsX: 2, mullionsY: 1 });
  windowFrame(front, 4.4, 7.4, 0.85, 2.75, { mullionsX: 2, mullionsY: 1 });
  buildDoor(front, 8.4, 9.4, 2.5);
  // back wall (z = z0), local +X = world +X
  const back = mat(x0, 0, z0, 0);
  wallSegments(w, h, [], thick, 'wallAccent', back);
  // left wall (x = x0): ry = +PI/2 → local +X = world -Z (origin at the front corner), local +Z = world +X (into the room)
  const left = mat(x0, 0, z1, Math.PI / 2);
  wallSegments(d, h, [[1.3, 4.3, 0.7, 2.6]], thick, 'wall', left);          // window at world z ∈ [0.2, 3.2]
  windowFrame(left, 1.3, 4.3, 0.7, 2.6, { mullionsX: 2, mullionsY: 1, sillDepth: 0.28 });
  // right wall (x = x1): ry = -PI/2 → local +X = world +Z (origin at the back corner), local +Z = world -X
  const right = mat(x1, 0, z0, -Math.PI / 2);
  wallSegments(d, h, [], thick, 'wall', right);
  // baseboards & crown
  const bb = (len, m) => { B.add(G.box(len, 0.12, 0.02), 'trim', m.clone().multiply(mat(len / 2, 0.06, 0.01))); B.add(G.box(len, 0.08, 0.03), 'trim', m.clone().multiply(mat(len / 2, h - 0.04, 0.015))); };
  bb(w, back); bb(d, right); bb(d, left); bb(w, front);
  // the walls are solid for the player (she can leave through the front door); the cats' grid ignores these
  const wallBox = (ax0, ax1, az0, az1) => addObstacle({ type: 'box', x0: ax0, x1: ax1, z0: az0, z1: az1, top: h, kind: 'wall', playerOnly: true });
  const doorX0 = x1 - 9.4, doorX1 = x1 - 8.4;   // door opening (see buildDoor's local coordinates)
  wallBox(x0 - 0.45, doorX0, z1 - 0.06, z1 + 0.4); wallBox(doorX1, x1 + 0.45, z1 - 0.06, z1 + 0.4);
  wallBox(x0 - 0.45, x1 + 0.45, z0 - 0.4, z0 + 0.06); wallBox(x0 - 0.45, x0 + 0.06, z0 - 0.4, z1 + 0.4); wallBox(x1 - 0.06, x1 + 0.45, z0 - 0.4, z1 + 0.4);
}

function buildDoor(frame, x0, x1, top) {
  const w = x1 - x0; const f = frame.clone().multiply(mat((x0 + x1) / 2, 0, 0));
  B.add(G.box(w + 0.16, 0.08, 0.14), 'trim', f.clone().multiply(mat(0, top + 0.04, 0)));
  B.add(G.box(0.08, top, 0.14), 'trim', f.clone().multiply(mat(-w / 2 - 0.04, top / 2, 0)));
  B.add(G.box(0.08, top, 0.14), 'trim', f.clone().multiply(mat(w / 2 + 0.04, top / 2, 0)));
  // door leaf: dark frame + glass, hung on a pivot so it swings open (outward) when you walk up to it
  const pivot = new THREE.Group(); f.clone().multiply(mat(w / 2, 0, 0)).decompose(pivot.position, pivot.quaternion, pivot.scale); W.scene.add(pivot);
  const swing = new THREE.Group(); pivot.add(swing); const cx = -w / 2;
  const part = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; swing.add(me); if (m.userData.worldUV) { me.updateMatrixWorld(true); worldUV(me.geometry, m.userData.worldUV, me.matrixWorld); } return me; };
  part(G.box(w - 0.02, 0.08, 0.06), M.darkwood, cx, top - 0.06, 0);
  part(G.box(w - 0.02, 0.5, 0.06), M.darkwood, cx, 0.25, 0);
  part(G.box(0.08, top, 0.06), M.darkwood, cx - w / 2 + 0.05, top / 2, 0);
  part(G.box(0.08, top, 0.06), M.darkwood, cx + w / 2 - 0.05, top / 2, 0);
  part(G.cyl(0.015, 0.015, 0.3, 8), M.brass, cx + w / 2 - 0.16, 1.05, 0.06); part(G.cyl(0.015, 0.015, 0.3, 8), M.brass, cx + w / 2 - 0.16, 1.05, -0.06);
  const glass = new THREE.Mesh(G.plane(w - 0.2, top - 0.6), M.glass); glass.position.set(cx, 0.5 + (top - 0.6) / 2, 0); swing.add(glass);
  // hanging OPEN sign
  const sign = new THREE.Mesh(G.box(0.3, 0.16, 0.01), M.sign); sign.position.set(cx, 1.75, 0.04); swing.add(sign);
  const [c, ctx] = canvas2d(256, 128); ctx.fillStyle = '#24211f'; ctx.fillRect(0, 0, 256, 128); chalkText(ctx, 'OPEN', 128, 84, 64, '#f4c2cf', 'DM Serif Display, serif', 'center');
  const lab = new THREE.Mesh(G.plane(0.28, 0.14), new THREE.MeshBasicMaterial({ map: toTexture(c, { aniso: false }) })); lab.position.set(cx, 1.75, 0.046); swing.add(lab);
  const hinge = new THREE.Vector3().setFromMatrixPosition(f); W.door = { swing, open: 0, x: hinge.x, z: hinge.z, w };
}

// ─── Sky & exterior ───────────────────────────────────────────────────────────
function buildSky() {
  const geo = new THREE.SphereGeometry(80, 48, 24);
  // Two modes in one shader: a procedural gradient sky (always available) and, once the asset pack streams in,
  // two captured pure-sky photographs (tA → tB) blended by the game clock. The photos are stored gamma-1/4 with a
  // per-frame scale (see dev/fetch_assets.py), rotated so their sun sits where our sun is; the sun disc itself is
  // drawn here so the clipped sun in the photo, the shadows and the lens flare all agree.
  const mat_ = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { topColor: { value: new THREE.Color(0x5f8fd0) }, horizonColor: { value: new THREE.Color(0xdcd3c2) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(0xfff0d0) }, night: { value: 0 },
      useHDRI: { value: 0 }, tA: { value: null }, tB: { value: null }, mixAB: { value: 0 }, rotA: { value: 0 }, rotB: { value: 0 }, scaleA: { value: 1 }, scaleB: { value: 1 }, vLo: { value: 0.4375 }, sunVis: { value: 1 }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, moonVis: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor, horizonColor, sunDir, sunColor, moonDir; uniform float night, useHDRI, mixAB, rotA, rotB, scaleA, scaleB, vLo, sunVis, moonVis; uniform sampler2D tA, tB; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      vec3 sampleSky(sampler2D t, float rot, float scale, float a, float v){ vec2 uv = vec2(0.5 + (a - rot) / 6.28318530718, v); vec3 c = texture2D(t, uv).rgb; c = c * c; c = c * c; return c * scale; }
      void main(){ vec3 dir = normalize(vDir); vec3 col;
        if (useHDRI > 0.5) {
          float el = asin(clamp(dir.y, -1.0, 1.0)); float v = clamp((0.5 + el / 3.14159265359 - vLo) / (1.0 - vLo), 0.0, 1.0);
          float a = atan(dir.x, -dir.z);
          col = mix(sampleSky(tA, rotA, scaleA, a, v), sampleSky(tB, rotB, scaleB, a, v), mixAB);
          col = mix(horizonColor, col, smoothstep(-0.035, 0.015, dir.y));
        } else {
          float t = clamp(dir.y, 0.0, 1.0); col = mix(horizonColor, topColor, pow(t, 0.55));
          if (night > 0.02) { vec2 p = floor(dir.xz / max(dir.y, 0.05) * 60.0); float st = step(0.997, hash(p)) * night * t; col += vec3(st); }
        }
        float s = max(dot(dir, sunDir), 0.0); float horizonDim = smoothstep(-0.06, 0.03, sunDir.y);
        col += sunColor * (pow(s, 2200.0) * 9.0 + pow(s, 160.0) * 0.9 + pow(s, 7.0) * 0.14) * sunVis * horizonDim;
        float m = max(dot(dir, moonDir), 0.0); col += vec3(0.85, 0.9, 1.0) * (pow(m, 6000.0) * 2.2 + pow(m, 300.0) * 0.08) * moonVis;
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat_); sky.name = 'sky'; W.sky = sky; W.scene.add(sky);
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function buildLights() {
  const sun = new THREE.DirectionalLight(0xffffff, 3.2); sun.castShadow = true;
  sun.shadow.mapSize.set(W.quality === 'high' ? 2048 : 1024, W.quality === 'high' ? 2048 : 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 8; sc.bottom = -8;
  sun.target.position.set(0, 0, 0); W.sun = sun;   // not added to the scene: the cascaded-shadow lights (post.js) mirror it
  W.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x6b5240, 0.55); W.scene.add(W.hemi);
  W.ambient = new THREE.AmbientLight(0xffe6c8, 0.12); W.scene.add(W.ambient);
  // pendant point lights (no shadows — cheap)
  const spots = [[-2.5, 2.05, 0.5], [1.0, 2.05, 1.2], [1.0, 2.05, -1.6], [-2.6, 2.1, -3.2], [4.9, 2.05, 0.2]];
  spots.forEach(([x, y, z]) => {
    const p = new THREE.PointLight(0xffc98a, 6, 7, 2); p.position.set(x, y - 0.1, z); W.scene.add(p); W.pendants.push(p);
    const procedural = (Bt) => {   // cord + shade + bulb
      Bt.add(G.cyl(0.006, 0.006, 3.2 - y - 0.1, 6), 'black', mat(x, (3.2 + y + 0.1) / 2, z));
      Bt.add(G.cyl(0.015, 0.015, 0.04, 10), 'black', mat(x, 3.19, z));
      const shade = new THREE.Mesh(G.cyl(0.07, 0.19, 0.2, 24, true), M.shade); shade.position.set(x, y + 0.1, z); W.scene.add(shade);
      const inner = new THREE.Mesh(G.cyl(0.068, 0.188, 0.2, 24, true), M.shadeInner); inner.position.copy(shade.position); W.scene.add(inner); p.userData.inner = inner;
    };
    const bulb = new THREE.Mesh(G.sph(0.035, 12, 8), M.bulb); bulb.position.set(x, y + 0.02, z); W.scene.add(bulb); p.userData.bulb = bulb;
    // scanned pendant (white dome on a cord) hangs from the ceiling down to the procedural shade height
    if (hasModel('modern_ceiling_lamp_01')) placeModel('modern_ceiling_lamp_01', x, ROOM.h - 0.01, z, 0, { align: 'ceiling', fit: { h: ROOM.h - y + 0.12 }, fallback: () => procedural(BL), shadow: false }); else procedural(B);
  });
  // espresso-bar strip light under the back-bar shelves
  const strip = new THREE.PointLight(0xffd9a8, 2, 3.5, 2); strip.position.set(-2.5, 1.85, -4.2); W.scene.add(strip); W.pendants.push(strip);
}

// time-of-day → sun position, colours, interior lights
function updateDaylight() {
  const t = W.dayTime;                                   // 0..24
  const dayT = clamp((t - 6.0) / 13.5, 0, 1);            // 06:00 → 19:30
  const azim = lerp(-1.05, 1.05, dayT);                  // sweeps from east (left) to west (right), always through the front windows
  let elev = Math.sin(dayT * Math.PI) * 1.05;            // radians above horizon (procedural sky: max ~60°)
  const st = SKY.ready ? skyState(t) : null;             // captured skies: the sun sits where the photograph has it
  if (st) elev = st.sunEl * Math.PI / 180;
  const sunDir = new THREE.Vector3(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev));
  const up = smoothstep(-0.02, 0.15, Math.sin(elev));
  const golden = 1 - smoothstep(0.05, 0.45, Math.sin(elev));
  // the moon (only with the captured skies): rises in the east around 20:00, crosses high after midnight
  let moonDir = null, moonVis = 0;
  if (st && st.moonEl != null) { const mAz = lerp(-1.05, 1.05, clamp(((t + 4) % 24) / 9, 0, 1)); const mEl = st.moonEl * Math.PI / 180; moonDir = new THREE.Vector3(Math.sin(mAz) * Math.cos(mEl), Math.sin(mEl), Math.cos(mAz) * Math.cos(mEl)); moonVis = st.moonVis * smoothstep(-0.05, 0.1, Math.sin(mEl)); }
  // one shadow-casting light: the sun by day, the moon by night
  const useMoon = moonDir && up < 0.05 && moonVis > 0.02;
  const lightDir = useMoon ? moonDir : sunDir;
  W.sun.position.copy(lightDir).multiplyScalar(22); W.sun.intensity = useMoon ? 0.3 * moonVis : 3.4 * up;
  if (useMoon) W.sun.color.set(0x9fb4e6); else W.sun.color.setHSL(0.09 - golden * 0.03, 0.55 * golden + 0.1, 0.95 - golden * 0.25);
  if (W.csm) { W.csm.lightDirection.copy(lightDir).negate(); W.csm.lights.forEach(l => { l.intensity = W.sun.intensity; l.color.copy(W.sun.color); }); }
  const night = 1 - up;
  if (st) {
    // ambient light, fog and the horizon come from the photographs themselves (exposed linear radiance)
    const mean = st.mean, hor = st.horizon, zen = st.zenith; const lum = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]; const mx = Math.max(mean[0], mean[1], mean[2], 1e-4);
    W.hemi.intensity = clamp(lum * 1.7 + 0.03, 0.04, 0.6); W.hemi.color.setRGB(mean[0] / mx, mean[1] / mx, mean[2] / mx); W.hemi.groundColor.setRGB(0.6, 0.5, 0.38);
    W.ambient.intensity = 0.015 + 0.045 * up;
    W.scene.environmentIntensity = 1.0;
    // the sand under the environment probe reflects the sky and the sun (so the floor bounce follows the day, and goes dark at night)
    const sunE = W.sun.intensity * Math.max(sunDir.y, 0) / Math.PI * (useMoon ? 0 : 1); W.groundRadiance = (W.groundRadiance || new THREE.Color()).setRGB(0.8 * (mean[0] + sunE), 0.75 * (mean[1] + sunE * 0.95), 0.62 * (mean[2] + sunE * 0.85));
    const u = W.sky.material.uniforms; u.sunDir.value.copy(sunDir); u.sunColor.value.setHSL(0.09 - golden * 0.03, 0.55 * golden + 0.1, 0.95 - golden * 0.25); u.sunVis.value = 1; u.night.value = night;
    u.horizonColor.value.setRGB(hor[0], hor[1], hor[2]); u.topColor.value.setRGB(zen[0], zen[1], zen[2]);
    if (moonDir) u.moonDir.value.copy(moonDir); u.moonVis.value = moonVis;
    applySkyFrames(st, azim, moonDir ? Math.atan2(moonDir.x, moonDir.z) : azim);
    if (W.scene.fog) W.scene.fog.color.copy(u.horizonColor.value);
  } else {
    W.hemi.intensity = 0.12 + 0.3 * up; W.hemi.color.setHSL(0.6, 0.5, 0.75 - night * 0.4); W.hemi.groundColor.setHSL(0.08, 0.4, 0.3 - night * 0.15);
    W.ambient.intensity = 0.02 + 0.05 * up;
    W.scene.environmentIntensity = 0.12 + 0.45 * up;        // the sky env-map 'skylight' fades with the daylight
    if (W.sky) { const u = W.sky.material.uniforms; u.sunDir.value.copy(sunDir); u.topColor.value.setHSL(0.6 - golden * 0.03, 0.6 - night * 0.3, lerp(0.05, 0.5, up) - golden * 0.14 * up); u.horizonColor.value.setHSL(0.075 - golden * 0.045, 0.3 + golden * 0.62 * up, lerp(0.1, 0.8, up) - golden * 0.18 * up); u.sunColor.value.copy(W.sun.color); u.night.value = night; u.sunVis.value = 1; u.moonVis.value = 0; }
    if (W.scene.fog) W.scene.fog.color.copy(W.sky.material.uniforms.horizonColor.value);
  }
  // interior lights: on when it's dim or when the switch is on
  const want = W.lightsOn ? 1 : 0; const dim = 0.3 + 0.7 * (1 - up);
  W.pendants.forEach(p => { p.intensity = damp(p.intensity, want * dim * (p.userData.bulb ? 5.5 : 2.2), 3, W.dt); if (p.userData.bulb) { p.userData.bulb.material = want ? M.bulb : M.bulbOff; } });
  M.bulb.emissiveIntensity = 1.2 + 1.5 * dim;
  M.shadeInner.emissiveIntensity = want ? 0.15 + 0.35 * dim : 0;
  if (W.exteriorWindows) M.bWindow.emissiveIntensity = night * 1.0;
  // sun patch on the floor: where the ray through the middle of the big front window lands (used by the sun-loving cat)
  if (sunDir.y > 0.08) {
    const wx = -3.7 + azim * 1.5, wy = 1.8, wz = ROOM.z1;   // window centre-ish
    const k = wy / sunDir.y; const px = wx - sunDir.x * k, pz = wz - sunDir.z * k;
    W.sunPatch.x = clamp(px, ROOM.x0 + 0.6, ROOM.x1 - 0.6); W.sunPatch.z = clamp(pz, ROOM.z0 + 0.8, ROOM.z1 - 0.8); W.sunPatch.valid = up > 0.5 && pz > ROOM.z0 + 0.8;
  } else W.sunPatch.valid = false;
  W.isNight = night > 0.5;
}
