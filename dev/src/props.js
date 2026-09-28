// ─── Furniture & prop builders. Each one adds batched geometry plus nav/interaction data. ──
const perchNames = {};
function roundTable(x, z, r = 0.45, h = 0.75) {
  B.add(G.cyl(r, r, 0.035, 32), 'walnut', mat(x, h - 0.0175, z));
  B.add(G.cyl(0.035, 0.035, h - 0.06, 12), 'black', mat(x, (h - 0.06) / 2 + 0.03, z));
  B.add(G.cyl(0.22, 0.26, 0.03, 24), 'black', mat(x, 0.015, z));
  addObstacle({ type: 'circle', x, z, r: r, top: h, kind: 'table', name: 'table' });
  addInteractBox('A café table', x, h - 0.02, z, r * 2, 0.05, r * 2, () => hoverOnly());
  return { x, z, r, h };
}
function squareTable(x, z, w = 0.8, h = 0.75, ry = 0) {
  const f = mat(x, 0, z, ry);
  B.add(G.rbox(w, 0.04, w, 0.01), 'walnut', f.clone().multiply(mat(0, h - 0.02, 0)));
  B.add(G.box(w - 0.12, 0.08, w - 0.12), 'darkwood', f.clone().multiply(mat(0, h - 0.08, 0)));
  const o = w / 2 - 0.05; [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(([lx, lz]) => B.add(G.box(0.05, h - 0.04, 0.05), 'walnut', f.clone().multiply(mat(lx, (h - 0.04) / 2, lz))));
  addObstacle({ type: 'box', x0: x - w / 2, x1: x + w / 2, z0: z - w / 2, z1: z + w / 2, top: h, kind: 'table' });
  return { x, z, w, h };
}
function addInteractBox(label, x, y, z, w, h, d, onClick, extra = {}) {
  const mesh = new THREE.Mesh(G.box(w, h, d), new THREE.MeshBasicMaterial({ visible: false })); mesh.position.set(x, y, z); if (extra.ry) mesh.rotation.y = extra.ry;
  W.scene.add(mesh); return addInteract({ label, mesh, onClick, ...extra });
}
const hoverOnly = () => {};

function chair(x, z, ry = 0, { seatKey = 'chairSeat', cushion = true } = {}) {
  const f = mat(x, 0, z, ry); const sh = 0.45;
  B.add(G.cyl(0.21, 0.19, 0.035, 24), 'walnut', f.clone().multiply(mat(0, sh - 0.0175, 0)));
  if (cushion) B.add(G.lathe([[0, 0], [0.17, 0], [0.19, 0.015], [0.185, 0.035], [0.15, 0.045], [0, 0.048]], 24), seatKey, f.clone().multiply(mat(0, sh, 0)));
  const legs = [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]];
  legs.forEach(([lx, lz]) => B.add(G.cyl(0.016, 0.02, sh - 0.03, 8), 'walnut', f.clone().multiply(mat(lx * 1.05, (sh - 0.03) / 2, lz * 1.05, 0, { rx: -lz * 0.18, rz: lx * 0.18 }))));
  // stretchers
  B.add(G.cyl(0.01, 0.01, 0.3, 6), 'walnut', f.clone().multiply(mat(0, 0.18, -0.15, 0, { rz: Math.PI / 2 })));
  B.add(G.cyl(0.01, 0.01, 0.3, 6), 'walnut', f.clone().multiply(mat(0, 0.18, 0.15, 0, { rz: Math.PI / 2 })));
  // bentwood back: two leaning posts, two solid steam-bent hoops and three spindles (all solid tubes — no open shells)
  B.add(G.cyl(0.016, 0.019, 0.52, 10), 'walnut', f.clone().multiply(mat(-0.145, sh + 0.25, -0.15, 0, { rx: 0.12 })));
  B.add(G.cyl(0.016, 0.019, 0.52, 10), 'walnut', f.clone().multiply(mat(0.145, sh + 0.25, -0.15, 0, { rx: 0.12 })));
  const hoop = (y, zc) => B.add(G.torus(0.16, 0.016, 8, 22, Math.PI * 0.7), 'walnut', f.clone().multiply(mat(0, y, zc, Math.PI * 0.15, { rx: -Math.PI / 2 })));
  hoop(sh + 0.5, -0.12); hoop(sh + 0.3, -0.115);
  [-0.08, 0, 0.08].forEach(sx => B.add(G.cyl(0.009, 0.009, 0.2, 6), 'walnut', f.clone().multiply(mat(sx, sh + 0.4, -0.12 - Math.sqrt(0.16 * 0.16 - sx * sx), 0, { rx: 0.1 }))));
  addObstacle({ type: 'box', x0: x - 0.22, x1: x + 0.22, z0: z - 0.22, z1: z + 0.22, top: sh + 0.03, kind: 'chair' });
  const fwd = { x: Math.sin(ry), z: Math.cos(ry) };   // chair faces local +Z
  const p = addPerch({ name: 'a chair', kind: 'chair', x, z, hw: 0.14, hd: 0.14, y: sh + 0.03, comfort: 0.55, ry, approach: [{ x: x + fwd.x * 0.6, z: z + fwd.z * 0.6 }, { x: x - fwd.z * 0.6, z: z + fwd.x * 0.6 }, { x: x + fwd.z * 0.6, z: z - fwd.x * 0.6 }] });
  addInteractBox('Sit here', x, sh, z, 0.42, 0.1, 0.42, () => sitPlayer(x, z, ry, sh), { ry, kind: 'seat', perch: p });
  return p;
}
function barStool(x, z, sh = 0.72) {
  B.add(G.cyl(0.18, 0.17, 0.04, 20), 'walnut', mat(x, sh - 0.02, z));
  B.add(G.cyl(0.17, 0.17, 0.025, 20), 'leather', mat(x, sh + 0.012, z));
  [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]].forEach(([lx, lz]) => B.add(G.cyl(0.012, 0.014, sh - 0.04, 8), 'black', mat(x + lx * 1.15, (sh - 0.04) / 2, z + lz * 1.15, 0, { rx: -lz * 1.2, rz: lx * 1.2 })));
  B.add(G.torus(0.15, 0.008, 6, 20), 'black', mat(x, 0.24, z, 0, { rx: Math.PI / 2 }));
  addObstacle({ type: 'circle', x, z, r: 0.19, top: sh + 0.03, kind: 'stool' });
  return addPerch({ name: 'a bar stool', kind: 'stool', x, z, hw: 0.11, hd: 0.11, y: sh + 0.03, comfort: 0.4, view: 0.2, approach: [{ x, z: z + 0.55 }, { x: x - 0.55, z }, { x: x + 0.55, z }] });
}
function couch(x, z, ry = 0, len = 2.2, { fabric = 'velvet', name = 'the velvet couch' } = {}) {
  const f = mat(x, 0, z, ry); const depth = 0.9, sh = 0.44;
  B.add(G.rbox(len, 0.3, depth, 0.03), 'darkwood', f.clone().multiply(mat(0, 0.17, 0)));
  const cw = (len - 0.5) / 2;
  [-1, 1].forEach(s => { B.add(G.rbox(cw - 0.02, 0.18, depth - 0.3, 0.06, 4), fabric, f.clone().multiply(mat(s * cw / 2, sh - 0.09, 0.1))); B.add(G.rbox(cw - 0.02, 0.5, 0.18, 0.06, 4), fabric, f.clone().multiply(mat(s * cw / 2, sh + 0.22, -depth / 2 + 0.16, 0, { rx: -0.12 }))); });
  [-1, 1].forEach(s => B.add(G.rbox(0.25, 0.6, depth, 0.05, 4), fabric, f.clone().multiply(mat(s * (len / 2 - 0.125), 0.32, 0))));
  B.add(G.rbox(len, 0.45, 0.14, 0.03), 'darkwood', f.clone().multiply(mat(0, 0.5, -depth / 2 + 0.05)));
  [[-len / 2 + 0.1, -depth / 2 + 0.1], [len / 2 - 0.1, -depth / 2 + 0.1], [-len / 2 + 0.1, depth / 2 - 0.1], [len / 2 - 0.1, depth / 2 - 0.1]].forEach(([lx, lz]) => B.add(G.cyl(0.03, 0.02, 0.06, 8), 'black', f.clone().multiply(mat(lx, 0.03, lz))));
  // throw cushions
  B.add(G.rbox(0.36, 0.36, 0.1, 0.04, 4), 'fabricRose', f.clone().multiply(mat(-len / 2 + 0.5, sh + 0.2, -depth / 2 + 0.3, 0, { rx: -0.25, rz: 0.15 })));
  B.add(G.rbox(0.34, 0.34, 0.1, 0.04, 4), 'fabricCream', f.clone().multiply(mat(len / 2 - 0.45, sh + 0.19, -depth / 2 + 0.3, 0, { rx: -0.3, rz: -0.1 })));
  const c = Math.cos(ry), s = Math.sin(ry);
  const hw = Math.abs(c) * len / 2 + Math.abs(s) * depth / 2, hd = Math.abs(s) * len / 2 + Math.abs(c) * depth / 2;   // AABB of rotated couch
  addObstacle({ type: 'box', x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, top: sh, kind: 'couch' });
  const fwd = { x: Math.sin(ry), z: Math.cos(ry) };   // couch faces local +Z
  const seatHW = Math.abs(c) * (len / 2 - 0.45) + Math.abs(s) * 0.22, seatHD = Math.abs(s) * (len / 2 - 0.45) + Math.abs(c) * 0.22;
  const p = addPerch({ name, kind: 'couch', x: x + fwd.x * 0.08, z: z + fwd.z * 0.08, hw: seatHW, hd: seatHD, y: sh, comfort: 0.95, ry, scratch: true,
    approach: [{ x: x + fwd.x * 0.85, z: z + fwd.z * 0.85 }, { x: x + fwd.x * 0.85 - fwd.z * 0.6, z: z + fwd.z * 0.85 + fwd.x * 0.6 }, { x: x + fwd.x * 0.85 + fwd.z * 0.6, z: z + fwd.z * 0.85 - fwd.x * 0.6 }] });
  addInteractBox('Sit on the couch', x + fwd.x * 0.1, sh, z + fwd.z * 0.1, len - 0.5, 0.12, depth - 0.3, () => sitPlayer(x + fwd.x * 0.12, z + fwd.z * 0.12, ry, sh), { ry, kind: 'seat', perch: p });
  return p;
}
function armchair(x, z, ry = 0) { return couch(x, z, ry, 1.15, { fabric: 'fabricSage', name: 'the reading armchair' }); }

function coffeeTable(x, z, ry = 0) {
  const f = mat(x, 0, z, ry);
  B.add(G.rbox(1.0, 0.035, 0.55, 0.01), 'oak', f.clone().multiply(mat(0, 0.4, 0)));
  B.add(G.box(0.9, 0.02, 0.45), 'oak', f.clone().multiply(mat(0, 0.14, 0)));
  [[-0.42, -0.2], [0.42, -0.2], [-0.42, 0.2], [0.42, 0.2]].forEach(([lx, lz]) => B.add(G.cyl(0.02, 0.025, 0.4, 8), 'black', f.clone().multiply(mat(lx, 0.2, lz, 0, { rx: -lz * 0.15, rz: lx * 0.15 }))));
  // stacked books & a cup
  B.add(G.box(0.22, 0.03, 0.16), 'fabricRose', f.clone().multiply(mat(-0.25, 0.435, 0.05, 0.1)));
  B.add(G.box(0.2, 0.025, 0.15), 'fabricSage', f.clone().multiply(mat(-0.25, 0.462, 0.05, -0.15)));
  B.add(G.box(0.18, 0.02, 0.13), 'paper', f.clone().multiply(mat(-0.25, 0.485, 0.05, 0.05)));
  cup(x + 0.25 * Math.cos(ry), 0.42, z - 0.25 * Math.sin(ry), true, 'ceramicRose');
  addObstacle({ type: 'box', x0: x - 0.5, x1: x + 0.5, z0: z - 0.28, z1: z + 0.28, top: 0.42, kind: 'table' });
  addInteractBox('Books & a rose latte', x, 0.45, z, 1.0, 0.12, 0.55, hoverOnly, { ry });
}
function cup(x, y, z, steaming = true, key = 'ceramic', withSaucer = true) {
  if (withSaucer) BNS.add(G.cyl(0.075, 0.06, 0.008, 20), key, mat(x, y + 0.004, z));
  BNS.add(G.lathe([[0.0, 0.0], [0.035, 0.0], [0.04, 0.01], [0.045, 0.06], [0.047, 0.075], [0.043, 0.075], [0.041, 0.065], [0.036, 0.012], [0.0, 0.012]], 20), key, mat(x, y + 0.008, z));
  BNS.add(G.torus(0.022, 0.006, 6, 12, Math.PI), key, mat(x + 0.05, y + 0.045, z, 0, { rz: -Math.PI / 2 }));
  BNS.add(G.cyl(0.04, 0.04, 0.004, 16), 'coffee', mat(x, y + 0.072, z));
  if (steaming) W.steamers.push({ x, y: y + 0.09, z, next: 0 });
}
function pendantsAreLights() {}

function bookshelf(x, z, ry = 0, w = 1.6, h = 2.0, d = 0.32) {
  const f = mat(x, 0, z, ry);
  B.add(G.box(0.03, h, d), 'walnut', f.clone().multiply(mat(-w / 2 + 0.015, h / 2, 0)));
  B.add(G.box(0.03, h, d), 'walnut', f.clone().multiply(mat(w / 2 - 0.015, h / 2, 0)));
  B.add(G.box(w, 0.03, d), 'walnut', f.clone().multiply(mat(0, h - 0.015, 0)));
  B.add(G.box(w, 0.06, d), 'walnut', f.clone().multiply(mat(0, 0.03, 0)));
  B.add(G.box(w, h, 0.02), 'darkwood', f.clone().multiply(mat(0, h / 2, -d / 2 + 0.01)));
  const shelves = 4;
  for (let i = 1; i < shelves; i++) B.add(G.box(w - 0.06, 0.025, d - 0.02), 'walnut', f.clone().multiply(mat(0, (h - 0.1) * i / shelves + 0.05, 0)));
  for (let i = 0; i < shelves; i++) {
    const y0 = i === 0 ? 0.06 : (h - 0.1) * i / shelves + 0.06; const sh = (h - 0.1) / shelves - 0.05;
    if (i === 2) { // display shelf: a plant, a teapot & a cat figurine instead of books
      BNS.add(G.lathe([[0, 0], [0.06, 0], [0.07, 0.08], [0.05, 0.1], [0, 0.1]], 16), 'potWhite', f.clone().multiply(mat(-w / 2 + 0.25, y0, 0)));
      BNS.add(G.sph(0.09, 10, 8), 'foliage', f.clone().multiply(mat(-w / 2 + 0.25, y0 + 0.16, 0)));
      BNS.add(G.sph(0.08, 16, 12), 'ceramicRose', f.clone().multiply(mat(0.1, y0 + 0.08, 0)));
      BNS.add(G.cyl(0.02, 0.05, 0.08, 10), 'ceramicRose', f.clone().multiply(mat(0.2, y0 + 0.1, 0, 0, { rz: -0.9 })));
      BNS.add(G.box(0.3, 0.2, 0.02), 'paper', f.clone().multiply(mat(0.45, y0 + 0.1, -0.05, 0, { rx: -0.15 })));
      continue;
    }
    const bw = w - 0.12 - (i === 1 ? 0.5 : 0);
    const m = new THREE.Mesh(G.box(bw, sh, d - 0.08), M.books[i % M.books.length]); m.applyMatrix4(f.clone().multiply(mat(-(w - 0.12 - bw) / 2, y0 + sh / 2, -0.02))); m.castShadow = false; m.receiveShadow = true; W.scene.add(m);
    if (i === 1) { BNS.add(G.box(0.14, 0.2, 0.14), 'fabricCream', f.clone().multiply(mat(w / 2 - 0.3, y0 + 0.1, 0, 0.3))); }
  }
  const c = Math.cos(ry), s = Math.sin(ry); const hw = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, hd = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
  addObstacle({ type: 'box', x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, top: h, kind: 'shelf' });
  addInteractBox('The café library — poetry, coffee books, and a cat figurine', x, h / 2, z, w, h, d, hoverOnly, { ry });
}

function plant(x, z, kind = 'monstera', scale = 1, { potKey = 'pot', y = 0, obstacle = true } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
  const potR = kind === 'fern' ? 0.11 : kind === 'snake' ? 0.14 : 0.19;
  BNS.add(G.lathe([[0, 0], [potR * 0.8, 0], [potR, 0.32 * potR / 0.19], [potR * 1.05, 0.34 * potR / 0.19], [potR * 0.95, 0.34 * potR / 0.19], [potR * 0.9, 0.3 * potR / 0.19], [0, 0.3 * potR / 0.19]], 20), potKey, mat(x, y, z, 0, { sx: scale, sy: scale, sz: scale }));
  const soilY = 0.3 * potR / 0.19;
  BNS.add(G.cyl(potR * 0.9, potR * 0.9, 0.02, 16), 'soil', mat(x, y + soilY * scale, z, 0, { sx: scale, sy: scale, sz: scale }));
  const leafMat = kind === 'fern' ? M.leafFern : kind === 'snake' ? M.leafSnake : M.leafMonstera;
  const n = kind === 'fern' ? 14 : kind === 'snake' ? 9 : 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(0.3); const tilt = kind === 'snake' ? rand(0.05, 0.25) : kind === 'fern' ? rand(0.6, 1.1) : rand(0.25, 0.7);
    const size = kind === 'fern' ? rand(0.25, 0.4) : kind === 'snake' ? rand(0.5, 0.9) : rand(0.45, 0.7);
    const leaf = new THREE.Mesh(G.plane(size * (kind === 'snake' ? 0.35 : 0.8), size), leafMat);
    const stem = new THREE.Group(); stem.position.set(0, soilY, 0); stem.rotation.y = a; stem.rotation.x = -tilt;
    leaf.position.set(0, size / 2 + (kind === 'monstera' ? 0.25 : 0.05), 0); leaf.rotation.y = rand(-0.2, 0.2);
    if (kind === 'monstera') { const st = new THREE.Mesh(G.cyl(0.006, 0.008, 0.3, 5), M.trunk); st.position.set(0, 0.15, 0); stem.add(st); }
    leaf.castShadow = true; leaf.receiveShadow = true; stem.add(leaf); stem.userData.sway = rand(TAU); stem.userData.baseX = stem.rotation.x; g.add(stem);
  }
  W.scene.add(g); W.plants = W.plants || []; W.plants.push(g);
  if (obstacle) addObstacle({ type: 'circle', x, z, r: potR * scale + 0.05, top: 0.3, kind: 'plant' });
  addInteractBox(kind === 'monstera' ? 'Monstera (the cats are not allowed to chew it)' : kind === 'fern' ? 'Boston fern' : 'Snake plant', x, y + 0.5 * scale, z, potR * 2.4 * scale, 1.0 * scale, potR * 2.4 * scale, () => { g.userData.rustle = 1; playSfx('rustle', { x, y, z }); }, {});
  return g;
}

function rug(x, z, w, d, ry = 0) { const m = new THREE.Mesh(G.plane(w, d), M.rug); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.006, z); m.receiveShadow = true; W.scene.add(m); }

function wallArt(frameM, lx, ly, kind, w = 0.7, h = 0.52) {
  const f = frameM.clone().multiply(mat(lx, ly, 0.02));
  B.add(G.box(w + 0.06, h + 0.06, 0.03), 'frame', f.clone().multiply(mat(0, 0, 0.015)));
  const m = new THREE.Mesh(G.plane(w, h), M.art[kind]); m.applyMatrix4(f.clone().multiply(mat(0, 0, 0.032))); W.scene.add(m);
}
function radiator(x, z, ry = 0, len = 1.2) {
  const f = mat(x, 0, z, ry); const n = Math.floor(len / 0.08);
  for (let i = 0; i < n; i++) B.add(G.box(0.05, 0.55, 0.12), 'radiator', f.clone().multiply(mat(-len / 2 + 0.04 + i * 0.08, 0.38, 0)));
  B.add(G.box(len, 0.03, 0.03), 'radiator', f.clone().multiply(mat(0, 0.62, 0))); B.add(G.box(len, 0.03, 0.03), 'radiator', f.clone().multiply(mat(0, 0.14, 0)));
  B.add(G.cyl(0.02, 0.02, 0.15, 8), 'brass', f.clone().multiply(mat(-len / 2 - 0.02, 0.3, 0, 0, { rz: Math.PI / 2 })));
  const c = Math.cos(ry), s = Math.sin(ry); const hw = Math.abs(c) * len / 2 + Math.abs(s) * 0.08, hd = Math.abs(s) * len / 2 + Math.abs(c) * 0.08;
  addObstacle({ type: 'box', x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, top: 0.66, kind: 'radiator' });
  addInteractBox('A warm radiator — prime cat real estate', x, 0.35, z, len, 0.6, 0.14, hoverOnly, { ry });
}
function windowCushion(x, y, z, w = 0.5, d = 0.28, key = 'fabricRose') { B.add(G.rbox(w, 0.06, d, 0.025, 4), key, mat(x, y + 0.03, z)); }

function coatRack(x, z) {
  B.add(G.cyl(0.02, 0.025, 1.8, 10), 'walnut', mat(x, 0.9, z)); B.add(G.cyl(0.16, 0.18, 0.03, 16), 'walnut', mat(x, 0.015, z));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; B.add(G.cyl(0.012, 0.012, 0.16, 6), 'walnut', mat(x + Math.sin(a) * 0.08, 1.72, z + Math.cos(a) * 0.08, a, { rx: 1.2 })); }
  B.add(G.rbox(0.28, 0.5, 0.12, 0.04, 3), 'fabricSage', mat(x + 0.06, 1.42, z + 0.06, 0.6, { rz: 0.1 }));   // a coat
  addObstacle({ type: 'circle', x, z, r: 0.2, top: 1.8, kind: 'rack' });
}
function aFrameSign(x, z, ry) {
  const f = mat(x, 0, z, ry);
  [-1, 1].forEach(s => { B.add(G.box(0.5, 0.7, 0.02), 'darkwood', f.clone().multiply(mat(0, 0.36, s * 0.12, 0, { rx: s * 0.3 }))); });
  const [c, ctx] = canvas2d(256, 320); ctx.fillStyle = '#20241f'; ctx.fillRect(0, 0, 256, 320); chalkText(ctx, 'today', 128, 70, 44, '#f4c2cf', 'DM Serif Display, serif', 'center'); chalkText(ctx, 'rose latte  5', 128, 140, 28, '#f1eadc', 'Inter, sans-serif', 'center'); chalkText(ctx, 'cardamom bun  4', 128, 185, 28, '#f1eadc', 'Inter, sans-serif', 'center'); chalkText(ctx, '5 cats ♥ free', 128, 260, 30, '#f1eadc', 'DM Serif Display, serif', 'center');
  const m = new THREE.Mesh(G.plane(0.42, 0.55), new THREE.MeshStandardMaterial({ map: toTexture(c, { aniso: false }), roughness: 0.95 })); m.applyMatrix4(f.clone().multiply(mat(0, 0.36, 0.135, 0, { rx: 0.3 }))); W.scene.add(m);
  addObstacle({ type: 'box', x0: x - 0.28, x1: x + 0.28, z0: z - 0.28, z1: z + 0.28, top: 0.7, kind: 'sign' });
}
function wallClock(frameM, lx, ly) {
  const f = frameM.clone().multiply(mat(lx, ly, 0.03));
  B.add(G.cyl(0.19, 0.19, 0.04, 32), 'darkwood', f.clone().multiply(mat(0, 0, 0, 0, { rx: Math.PI / 2 })));
  BNS.add(G.cyl(0.165, 0.165, 0.005, 32), 'paper', f.clone().multiply(mat(0, 0, 0.02, 0, { rx: Math.PI / 2 })));
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; BNS.add(G.box(0.012, i % 3 ? 0.02 : 0.035, 0.004), 'black', f.clone().multiply(mat(Math.sin(a) * 0.14, Math.cos(a) * 0.14, 0.024, 0, { rz: -a }))); }
  const hands = new THREE.Group(); hands.applyMatrix4(f.clone().multiply(mat(0, 0, 0.028)));
  const hh = new THREE.Mesh(G.box(0.012, 0.09, 0.004), M.black); hh.position.y = 0.04; const hg = new THREE.Group(); hg.add(hh);
  const mh = new THREE.Mesh(G.box(0.008, 0.13, 0.004), M.black); mh.position.y = 0.06; const mg = new THREE.Group(); mg.add(mh); mg.position.z = 0.005;
  hands.add(hg, mg); W.scene.add(hands); W.wallClock = { h: hg, m: mg };
}

// ─── The espresso bar ─────────────────────────────────────────────────────────
function buildBar() {
  const x0 = -5.7, x1 = 0.7, zf = -2.95, zb = -3.55, h = 0.95;   // counter from x0..x1, front face at zf (0.55 m walkway behind it)
  const cx = (x0 + x1) / 2, len = x1 - x0;
  B.add(G.rbox(len + 0.1, 0.05, zf - zb + 0.15, 0.01), 'walnut', mat(cx, h - 0.025, (zf + zb) / 2 + 0.02));
  B.add(G.box(len, h - 0.05, zf - zb), 'darkwood', mat(cx, (h - 0.05) / 2, (zf + zb) / 2));
  for (let x = x0 + 0.08; x < x1; x += 0.12) B.add(G.box(0.06, h - 0.15, 0.03), 'walnut', mat(x, (h - 0.15) / 2 + 0.05, zf + 0.015));   // vertical slats
  B.add(G.cyl(0.018, 0.018, len - 0.2, 8), 'brass', mat(cx, 0.18, zf + 0.22, 0, { rz: Math.PI / 2 }));                            // brass foot rail
  for (let x = x0 + 0.4; x < x1; x += 1.5) B.add(G.box(0.03, 0.03, 0.22), 'brass', mat(x, 0.18, zf + 0.11));
  addObstacle({ type: 'box', x0, x1, z0: zb - 0.2, z1: zf, top: h, kind: 'bar' });
  addObstacle({ type: 'box', x0: x0, x1: x1, z0: ROOM.z0, z1: zb - 0.2, top: 2.6, kind: 'backbar', passable: false });
  // back bar: tiles, shelves with jars/cups/bottles, fridge-ish cabinet
  const tiles = new THREE.Mesh(G.plane(len + 0.2, 1.4), M.tile); tiles.position.set(cx, 1.6, ROOM.z0 + 0.01); tiles.receiveShadow = true; W.scene.add(tiles);
  B.add(G.box(len, 0.9, 0.4), 'darkwood', mat(cx, 0.45, ROOM.z0 + 0.2));
  B.add(G.box(len + 0.05, 0.04, 0.45), 'walnut', mat(cx, 0.92, ROOM.z0 + 0.225));
  [1.55, 2.05].forEach(y => B.add(G.box(len - 0.3, 0.035, 0.3), 'walnut', mat(cx, y, ROOM.z0 + 0.15)));
  for (let i = 0; i < 14; i++) { const x = x0 + 0.3 + i * 0.45; const jar = i % 3; if (jar === 0) BNS.add(G.cyl(0.06, 0.06, 0.2, 12), 'glassCase', mat(x, 1.67, ROOM.z0 + 0.15)); else if (jar === 1) BNS.add(G.lathe([[0, 0], [0.04, 0], [0.045, 0.16], [0.02, 0.2], [0.018, 0.28], [0, 0.28]], 12), i % 2 ? 'ceramicRose' : 'coffee', mat(x, 1.57, ROOM.z0 + 0.15)); else BNS.add(G.box(0.12, 0.16, 0.08), 'pot', mat(x, 1.65, ROOM.z0 + 0.15)); }
  for (let i = 0; i < 16; i++) cup(x0 + 0.35 + i * 0.38, 2.07, ROOM.z0 + 0.15, false, i % 4 === 0 ? 'ceramicRose' : 'ceramic', false);
  // chalk menu board above
  B.add(G.box(3.3, 2.1, 0.05), 'frame', mat(-2.3, 2.6, ROOM.z0 + 0.03));
  const menu = new THREE.Mesh(G.plane(3.15, 1.95), M.chalk); menu.position.set(-2.3, 2.6, ROOM.z0 + 0.06); W.scene.add(menu);
  addInteractBox('The menu — rose latte is the house special', -2.3, 2.6, ROOM.z0 + 0.06, 3.2, 2.0, 0.1, hoverOnly);
  // espresso machine (a two-group lever machine)
  const mx = -3.4, mz = -3.32;
  B.add(G.rbox(0.9, 0.42, 0.5, 0.02), 'steel', mat(mx, h + 0.21, mz));
  B.add(G.box(0.9, 0.06, 0.5), 'black', mat(mx, h + 0.03, mz));
  B.add(G.rbox(0.94, 0.06, 0.54, 0.02), 'steel', mat(mx, h + 0.45, mz));
  B.add(G.box(0.86, 0.12, 0.1), 'black', mat(mx, h + 0.18, mz + 0.27));
  [-0.22, 0.22].forEach(dx => { B.add(G.cyl(0.06, 0.06, 0.1, 16), 'steelDark', mat(mx + dx, h + 0.1, mz + 0.24)); B.add(G.cyl(0.05, 0.05, 0.04, 16), 'steel', mat(mx + dx, h + 0.05, mz + 0.24)); B.add(G.cyl(0.02, 0.02, 0.24, 8), 'black', mat(mx + dx, h + 0.06, mz + 0.4, 0, { rx: Math.PI / 2 })); B.add(G.cyl(0.025, 0.025, 0.3, 10), 'walnut', mat(mx + dx, h + 0.55, mz + 0.05, 0, { rx: -0.6 })); });   // portafilters & levers
  B.add(G.cyl(0.03, 0.03, 0.02, 16), 'paper', mat(mx, h + 0.28, mz + 0.26, 0, { rx: Math.PI / 2 }));   // gauge
  B.add(G.cyl(0.008, 0.008, 0.3, 6), 'steel', mat(mx + 0.5, h + 0.2, mz + 0.2, 0, { rx: 0.9 }));       // steam wand
  const light = new THREE.Mesh(G.sph(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff5522, emissiveIntensity: 2 })); light.position.set(mx - 0.38, h + 0.32, mz + 0.26); W.scene.add(light);
  for (let i = 0; i < 6; i++) cup(mx - 0.3 + i * 0.12, h + 0.48, mz - 0.1, false, 'ceramic', false);
  W.machine = { x: mx, y: h + 0.2, z: mz, brewing: 0, drip: null };
  W.steamers.push({ x: mx + 0.5, y: h + 0.36, z: mz + 0.32, next: 0, machine: true });
  addInteractBox('Espresso machine — click to pull a shot', mx, h + 0.25, mz, 0.95, 0.5, 0.55, () => brewEspresso(), { kind: 'machine' });
  // grinder
  B.add(G.box(0.16, 0.3, 0.2), 'black', mat(-2.55, h + 0.15, mz + 0.05)); B.add(G.cyl(0.07, 0.05, 0.16, 16), 'glassCase', mat(-2.55, h + 0.38, mz + 0.05)); B.add(G.cyl(0.05, 0.05, 0.05, 12), 'coffee', mat(-2.55, h + 0.33, mz + 0.05));
  // pastry case
  B.add(G.box(1.0, 0.03, 0.5), 'walnut', mat(-0.4, h + 0.015, mz + 0.05));
  const pc = new THREE.Mesh(G.box(1.0, 0.36, 0.5), M.glassCase); pc.position.set(-0.4, h + 0.21, mz + 0.05); W.scene.add(pc);
  B.add(G.box(1.0, 0.02, 0.5), 'walnut', mat(-0.4, h + 0.4, mz + 0.05));
  for (let i = 0; i < 4; i++) { BNS.add(G.torus(0.045, 0.02, 8, 12), 'pastry', mat(-0.8 + i * 0.26, h + 0.08, mz + 0.05, 0, { rx: Math.PI / 2 })); BNS.add(G.rbox(0.1, 0.05, 0.08, 0.02, 3), i % 2 ? 'pastryPink' : 'pastry', mat(-0.8 + i * 0.26, h + 0.1, mz - 0.12)); }
  addInteractBox('Pastry case — cardamom buns, rose macarons', -0.4, h + 0.2, mz + 0.05, 1.0, 0.4, 0.5, hoverOnly);
  // counter clutter: bell, tip jar, napkins, small plant, register
  B.add(G.sph(0.045, 16, 10), 'brass', mat(-1.5, h + 0.02, zf - 0.25)); B.add(G.cyl(0.055, 0.055, 0.01, 16), 'black', mat(-1.5, h + 0.005, zf - 0.25)); B.add(G.cyl(0.008, 0.008, 0.03, 6), 'brass', mat(-1.5, h + 0.07, zf - 0.25));
  W.bell = { x: -1.5, y: h + 0.05, z: zf - 0.25, ring: 0 };
  addInteractBox('Service bell — ring for a barista', -1.5, h + 0.05, zf - 0.25, 0.14, 0.12, 0.14, () => ringBell(true));
  B.add(G.cyl(0.05, 0.05, 0.14, 12), 'glassCase', mat(-1.1, h + 0.07, zf - 0.25)); BNS.add(G.box(0.08, 0.03, 0.02), 'paper', mat(-1.1, h + 0.06, zf - 0.25, 0.4));
  BNS.add(G.box(0.12, 0.06, 0.12), 'ceramic', mat(-1.9, h + 0.03, zf - 0.25)); BNS.add(G.box(0.1, 0.05, 0.1), 'paper', mat(-1.9, h + 0.085, zf - 0.25));
  B.add(G.rbox(0.32, 0.22, 0.26, 0.02), 'black', mat(0.1, h + 0.11, zb + 0.25)); B.add(G.box(0.26, 0.18, 0.01), 'bWindow', mat(0.1, h + 0.16, zb + 0.39, 0, { rx: -0.35 }));
  plant(-5.2, zb + 0.3, 'fern', 0.8, { potKey: 'potWhite', y: h, obstacle: false });
  cup(-2.1, h, zf - 0.3, true, 'ceramicRose');
  // bar stools along the counter
  [-4.6, -3.4, -2.2].forEach(x => barStool(x, zf + 0.5));
}

// ─── The task board (your checklist lives on the wall) ───────────────────────
function buildTaskBoard(x, y, z) {
  const w = 1.3, h = 1.0;
  B.add(G.box(w + 0.1, h + 0.1, 0.05), 'oak', mat(x, y, z + 0.025));
  B.add(G.box(w + 0.1, 0.05, 0.12), 'oak', mat(x, y - h / 2 - 0.02, z + 0.06));    // chalk ledge
  BNS.add(G.cyl(0.01, 0.01, 0.07, 8), 'paper', mat(x - 0.3, y - h / 2 + 0.01, z + 0.08, 0, { rz: Math.PI / 2 }));
  BNS.add(G.cyl(0.01, 0.01, 0.06, 8), 'ceramicRose', mat(x - 0.1, y - h / 2 + 0.01, z + 0.08, 0, { rz: Math.PI / 2 }));
  const [c, ctx] = canvas2d(1024, 800); W.boardCanvas = c; W.boardCtx = ctx; drawTaskBoard(ctx, 1024, 800);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; W.boardTex = tex;
  const m = new THREE.Mesh(G.plane(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })); m.position.set(x, y, z + 0.052); W.scene.add(m);
  addInteract({ label: 'Today\'s task board — click to open your checklist', mesh: m, onClick: () => openPanel(true), kind: 'board' });
  // small brass picture light above it
  B.add(G.cyl(0.02, 0.02, 0.5, 10), 'brass', mat(x, y + h / 2 + 0.16, z + 0.12, 0, { rz: Math.PI / 2 })); B.add(G.box(0.03, 0.03, 0.14), 'brass', mat(x, y + h / 2 + 0.16, z + 0.06));
  const pl = new THREE.PointLight(0xffe0b0, 1.5, 2.2, 2); pl.position.set(x, y + h / 2 + 0.1, z + 0.25); W.scene.add(pl); W.pendants.push(pl);
}
function refreshTaskBoard() { if (!W.boardCtx) return; drawTaskBoard(W.boardCtx, 1024, 800); W.boardTex.needsUpdate = true; }

// ─── Cat furniture ────────────────────────────────────────────────────────────
function catTree(x, z) {
  const f = mat(x, 0, z, 0);
  B.add(G.rbox(0.9, 0.05, 0.7, 0.01), 'carpetGray', f.clone().multiply(mat(0, 0.025, 0)));
  const post = (lx, lz, y0, y1) => B.add(G.cyl(0.055, 0.055, y1 - y0, 12), 'sisal', f.clone().multiply(mat(lx, (y0 + y1) / 2, lz)));
  const platform = (lx, ly, lz, w, d, key = 'carpetGray') => B.add(G.rbox(w, 0.05, d, 0.015), key, f.clone().multiply(mat(lx, ly, lz)));
  post(-0.28, 0.15, 0.05, 0.5); platform(-0.28, 0.52, 0.15, 0.42, 0.36);
  post(0.25, -0.1, 0.05, 0.9); platform(0.25, 0.92, -0.1, 0.45, 0.4);
  post(-0.2, -0.15, 0.55, 1.3); platform(-0.2, 1.32, -0.15, 0.48, 0.42, 'fabricRose');
  // cubby house on the base
  B.add(G.box(0.36, 0.34, 0.32), 'carpetGray', f.clone().multiply(mat(0.2, 0.22, 0.2)));
  B.add(G.cyl(0.11, 0.11, 0.05, 20), 'black', f.clone().multiply(mat(0.2, 0.2, 0.37, 0, { rx: Math.PI / 2 })));
  // a dangling toy from the top platform
  const string = new THREE.Mesh(G.cyl(0.003, 0.003, 0.3, 4), M.black); string.position.set(x + 0.02, 1.15, z - 0.35); W.scene.add(string);
  const ball = new THREE.Mesh(G.sph(0.03, 10, 8), M.toyBall2); ball.position.set(x + 0.02, 1.0, z - 0.35); W.scene.add(ball); W.danglers = [{ string, ball, x: x + 0.02, y: 1.3, z: z - 0.35, len: 0.3, ang: 0, vel: 0 }];
  addObstacle({ type: 'box', x0: x - 0.45, x1: x + 0.45, z0: z - 0.35, z1: z + 0.35, top: 1.34, kind: 'cattree' });
  const t1 = addPerch({ id: 'tree1', name: 'the cat tree (low tier)', kind: 'tree', x: x - 0.28, z: z + 0.15, hw: 0.16, hd: 0.13, y: 0.545, comfort: 0.6, scratch: true, approach: [{ x: x - 0.28, z: z + 0.7 }, { x: x - 0.75, z: z + 0.2 }] });
  const t2 = addPerch({ id: 'tree2', name: 'the cat tree (middle tier)', kind: 'tree', x: x + 0.25, z: z - 0.1, hw: 0.17, hd: 0.15, y: 0.945, comfort: 0.65, view: 0.4, approach: [{ x: x + 0.25, z: z + 0.65 }, { x: x + 0.75, z: z - 0.1 }] });
  const t3 = addPerch({ id: 'tree3', name: 'the top of the cat tree', kind: 'tree', x: x - 0.2, z: z - 0.15, hw: 0.18, hd: 0.15, y: 1.345, comfort: 0.8, view: 0.9, approach: [] });
  t1.links.push('tree2'); t2.links.push('tree1', 'tree3'); t3.links.push('tree2');
  addPerch({ id: 'cubby', name: 'the cubby house roof', kind: 'tree', x: x + 0.2, z: z + 0.2, hw: 0.14, hd: 0.12, y: 0.39, comfort: 0.5, approach: [{ x: x + 0.2, z: z + 0.7 }] });
  addInteractBox('The cat tree — sisal posts, three tiers, one very popular top platform', x, 0.7, z, 0.9, 1.4, 0.7, hoverOnly);
}
function catBed(x, z, { warmth = 0.7, name = 'the cat bed by the bar' } = {}) {
  B.add(G.torus(0.24, 0.07, 10, 24), 'fabricRose', mat(x, 0.06, z, 0, { rx: Math.PI / 2 }));
  B.add(G.cyl(0.24, 0.24, 0.05, 24), 'fabricCream', mat(x, 0.03, z));
  addObstacle({ type: 'circle', x, z, r: 0.32, top: 0.1, kind: 'bed', passable: true });
  return addPerch({ id: 'bed', name, kind: 'bed', x, z, hw: 0.12, hd: 0.12, y: 0.06, comfort: 1.0, warmth, approach: [{ x, z: z + 0.5 }, { x: x + 0.5, z }] });
}
