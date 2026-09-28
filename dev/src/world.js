// ─── World assembly: layout, toys & simple physics, steam, bird, pedestrians, ambient life ──
function buildWorld() {
  buildRoom(); buildSky(); buildExterior(); buildLights();
  const { x0, x1, z0, z1 } = ROOM;
  W.explorePoints = [];
  const explore = (x, z, label, fx, fz) => W.explorePoints.push({ x, z, label, fx, fz });
  // rugs & doormat
  rug(-2.4, 0.6, 3.4, 2.6); rug(4.4, 0.3, 2.8, 2.9);
  const mat_ = new THREE.Mesh(G.plane(1.1, 0.7), M.fabricSage); mat_.rotation.x = -Math.PI / 2; mat_.position.set(-2.9, 0.005, 4.0); mat_.receiveShadow = true; W.scene.add(mat_);
  // the bar
  buildBar();
  buildTaskBoard(3.0, 1.6, z0 + 0.0);
  // console under the task board
  B.add(G.box(1.5, 0.05, 0.42), 'walnut', mat(3.0, 0.78, z0 + 0.25)); B.add(G.box(1.4, 0.72, 0.38), 'darkwood', mat(3.0, 0.38, z0 + 0.25));
  [[2.5, 0.8], [3.5, 0.8]].forEach(([x, y]) => B.add(G.box(0.02, 0.6, 0.36), 'walnut', mat(x, 0.4, z0 + 0.25)));
  cup(2.55, 0.805, z0 + 0.3, true, 'ceramic'); plant(3.45, z0 + 0.25, 'fern', 0.7, { potKey: 'potWhite', y: 0.805, obstacle: false });
  BNS.add(G.box(0.3, 0.22, 0.02), 'paper', mat(3.0, 0.92, z0 + 0.14, 0, { rx: -0.2 }));   // a postcard
  addObstacle({ type: 'box', x0: 2.25, x1: 3.75, z0: z0, z1: z0 + 0.46, top: 0.8, kind: 'console' });
  addInteractBox('A stack of postcards from regulars', 3.0, 0.5, z0 + 0.25, 1.5, 0.8, 0.45, hoverOnly);
  explore(3.0, z0 + 0.95, 'the postcards on the console', 3.0, z0);
  // tables & chairs
  roundTable(-2.4, 0.6); chair(-2.4, 1.45, Math.PI); chair(-2.4, -0.25, 0); chair(-3.25, 0.6, Math.PI / 2, { seatKey: 'fabricRose' });
  cup(-2.2, 0.75, 0.7, true, 'ceramicRose'); cup(-2.6, 0.75, 0.45, false, 'ceramic');
  BNS.add(G.box(0.2, 0.025, 0.14), 'fabricSage', mat(-2.45, 0.762, 0.35, 0.3));
  squareTable(1.1, 1.4); chair(1.1, 2.2, Math.PI); chair(0.3, 1.4, Math.PI / 2); cup(1.2, 0.75, 1.3, true); BNS.add(G.box(0.24, 0.02, 0.32), 'paper', mat(0.95, 0.76, 1.55, -0.2));
  squareTable(1.1, -1.5); chair(1.1, -0.7, Math.PI); chair(1.9, -1.5, -Math.PI / 2, { seatKey: 'fabricSage' }); cup(1.0, 0.75, -1.4, false, 'ceramicRose'); BNS.add(G.lathe([[0, 0], [0.05, 0], [0.055, 0.12], [0.03, 0.13], [0, 0.13]], 12), 'glassCase', mat(1.3, 0.75, -1.65));
  roundTable(-4.4, 0.0, 0.42); chair(-4.4, 0.8, Math.PI); chair(-3.6, 0.0, -Math.PI / 2); cup(-4.3, 0.75, 0.1, true);
  // window bar along the big front-right window
  B.add(G.rbox(2.8, 0.04, 0.35, 0.01), 'walnut', mat(3.7, 1.05, z1 - 0.3)); [2.5, 4.9].forEach(x => B.add(G.box(0.05, 0.05, 0.3), 'black', mat(x, 1.0, z1 - 0.3)));
  [2.5, 4.9].forEach(x => B.add(G.box(0.05, 0.25, 0.05), 'black', mat(x, 0.9, z1 - 0.12)));
  addObstacle({ type: 'box', x0: 2.3, x1: 5.1, z0: z1 - 0.5, z1: z1, top: 1.07, kind: 'ledge' });
  const ledge = addPerch({ id: 'ledge', name: 'the window bar', kind: 'ledge', x: 3.7, z: z1 - 0.3, hw: 1.2, hd: 0.12, y: 1.07, comfort: 0.5, view: 1.0, warmth: 0.3, approach: [{ x: 3.0, z: z1 - 1.1 }, { x: 4.4, z: z1 - 1.1 }] });
  [2.9, 3.8, 4.7].forEach(x => { const st = barStool(x, z1 - 0.95); st.links.push('ledge'); ledge.links.push(st.id); st.view = 0.6; });
  cup(4.4, 1.07, z1 - 0.28, true, 'ceramicRose', true);
  // left window: radiator + sill + cushion + fern
  radiator(-5.75, 1.7, Math.PI / 2, 1.7);
  addObstacle({ type: 'box', x0: x0, x1: x0 + 0.4, z0: 0.2, z1: 3.2, top: 0.72, kind: 'sill' });
  addPerch({ id: 'sill', name: 'the sunny window sill', kind: 'sill', x: x0 + 0.2, z: 1.9, hw: 0.1, hd: 1.0, y: 0.72, comfort: 0.75, view: 1.0, warmth: 0.55, favorite: 'smoke', approach: [{ x: x0 + 0.85, z: 1.5 }, { x: x0 + 0.85, z: 2.4 }] });
  windowCushion(x0 + 0.2, 0.72, 2.3, 0.28, 0.5); plant(x0 + 0.2, 0.55, 'fern', 0.75, { potKey: 'potWhite', y: 0.72, obstacle: false });
  explore(x0 + 0.7, 1.2, 'the warm radiator', x0, 1.2);
  // couch nook on the right
  couch(5.4, 0.3, -Math.PI / 2, 2.2); coffeeTable(4.25, 0.3, 0); armchair(5.15, -2.2, -Math.PI / 2 + 0.55);
  bookshelf(x1 - 0.18, 3.0, -Math.PI / 2, 1.6, 2.0);
  explore(5.3, 3.0, 'the bookshelf', x1, 3.0);
  plant(5.35, 4.05, 'monstera', 1.15); explore(4.8, 3.6, 'the monstera', 5.35, 4.05);
  plant(-1.9, 4.05, 'snake', 1.0); explore(-1.9, 3.5, 'the snake plant by the door', -1.9, 4.05);
  plant(-5.35, -2.55, 'monstera', 0.95); explore(-4.9, -2.2, 'the monstera by the bar', -5.35, -2.55);
  // door area
  coatRack(-4.4, 4.05); explore(-4.0, 3.6, 'the coat rack', -4.4, 4.05); explore(-2.9, 3.6, 'the doormat', -2.9, 4.4);
  aFrameSign(-2.0, z1 + 1.0, 0.2);
  // cat furniture
  catTree(-5.2, 3.75); catBed(1.5, -3.55, { warmth: 0.7 }); explore(-1.5, -2.6, 'the service bell', -1.5, -3.3); explore(-0.4, -2.6, 'the pastry case', -0.4, -3.4);
  // wall art & clock
  const right = mat(x1, 0, z0, -Math.PI / 2), back = mat(x0, 0, z0, 0), left = mat(x0, 0, z1, Math.PI / 2);   // right: local x = z - z0 ; left: local x = z1 - z
  wallArt(right, 4.8, 1.85, 0, 0.95, 0.68); wallArt(right, 2.3, 1.7, 3, 0.6, 0.45); wallArt(right, 3.15, 1.75, 1, 0.5, 0.38);
  wallArt(back, 10.9, 1.55, 2, 0.6, 0.45); wallArt(left, 7.6, 1.8, 1, 0.7, 0.52); wallArt(left, 6.1, 1.65, 0, 0.6, 0.44);
  wallClock(back, 7.4, 2.35);
  // ceiling fans (slow, always turning) and brass wall sconces
  W.fans = []; [[-0.6, -1.3], [3.4, 1.6]].forEach(([fx, fz]) => { const g = new THREE.Group(); g.position.set(fx, ROOM.h - 0.02, fz); const rod = new THREE.Mesh(G.cyl(0.02, 0.02, 0.35, 8), M.black); rod.position.y = -0.17; g.add(rod); const motor = new THREE.Mesh(G.cyl(0.12, 0.1, 0.14, 16), M.black); motor.position.y = -0.4; g.add(motor); const hub = new THREE.Group(); hub.position.y = -0.46; g.add(hub); for (let i = 0; i < 4; i++) { const bl = new THREE.Mesh(G.box(0.62, 0.012, 0.13), M.walnut); bl.position.set(0.42, 0, 0); bl.rotation.z = -0.14; const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 2; arm.add(bl); hub.add(arm); bl.castShadow = true; } W.scene.add(g); W.fans.push(hub); });
  const sconce = (frameM, lx, ly) => { const f = frameM.clone().multiply(mat(lx, ly, 0.02)); B.add(G.box(0.08, 0.16, 0.03), 'brass', f.clone().multiply(mat(0, 0, 0.015))); B.add(G.cyl(0.012, 0.012, 0.16, 8), 'brass', f.clone().multiply(mat(0, 0.1, 0.1, 0, { rx: -Math.PI / 2 }))); const sh = new THREE.Mesh(G.cyl(0.05, 0.09, 0.13, 20, true), M.shade); sh.applyMatrix4(f.clone().multiply(mat(0, 0.16, 0.16))); W.scene.add(sh); const b = new THREE.Mesh(G.sph(0.028, 10, 8), M.bulb); b.applyMatrix4(f.clone().multiply(mat(0, 0.13, 0.16))); W.scene.add(b); };
  sconce(right, 6.1, 1.75); sconce(right, 1.2, 1.75); sconce(back, 10.2, 1.9); sconce(left, 5.2, 1.85);
  // light switch by the door
  B.add(G.box(0.08, 0.12, 0.015), 'trim', mat(-1.75, 1.25, z1 - 0.01)); const sw = new THREE.Mesh(G.box(0.03, 0.05, 0.02), M.trim); sw.position.set(-1.75, 1.25, z1 - 0.02); W.scene.add(sw); W.switchMesh = sw;
  addInteract({ label: 'Light switch', mesh: sw, onClick: () => toggleLights() });
  addInteractBox('Light switch', -1.75, 1.25, z1 - 0.02, 0.1, 0.14, 0.05, () => toggleLights());
  // toys
  spawnToy('ball', 0.2, 0.15, 'toyBall'); spawnToy('ball', -1.2, 2.7, 'toyBall2'); spawnToy('mouse', 3.6, 1.7, 'toyMouse');
  // merge static geometry
  B.build(W.scene); BNS.build(W.scene, { shadow: false });
  buildSteam(); buildBird(); buildNPCs();
  // soft contact shadows under the furniture (cheap ambient occlusion)
  W.obstacles.forEach(o => { if (o.passable || o.kind === 'backbar' || o.kind === 'sill' || o.kind === 'ledge') return; const w = o.type === 'circle' ? o.r * 2.6 : (o.x1 - o.x0) * 1.35, d = o.type === 'circle' ? o.r * 2.6 : (o.z1 - o.z0) * 1.35; const cx = o.type === 'circle' ? o.x : (o.x0 + o.x1) / 2, cz = o.type === 'circle' ? o.z : (o.z0 + o.z1) / 2; const b = new THREE.Mesh(G.plane(w, d), M.blobAO); b.rotation.x = -Math.PI / 2; b.position.set(cx, 0.003, cz); b.renderOrder = 1; W.scene.add(b); });
}

// ─── Toys: light rigid-ish bodies (gravity, bounce, rolling friction, walls & furniture) ──
function spawnToy(kind, x, z, matKey) {
  const r = kind === 'ball' ? 0.035 : 0.03;
  let mesh; if (kind === 'ball') { mesh = new THREE.Mesh(G.sph(r, 16, 12), M[matKey]); }
  else { mesh = new THREE.Group(); const body = new THREE.Mesh(G.sph(r, 12, 9), M.toyMouse); body.scale.set(1.6, 0.8, 1); mesh.add(body); const ear = new THREE.Mesh(G.sph(0.012, 8, 6), M.pastryPink); ear.position.set(0.03, 0.02, 0.012); mesh.add(ear); const ear2 = ear.clone(); ear2.position.z = -0.012; mesh.add(ear2); const tail = new THREE.Mesh(G.cyl(0.003, 0.003, 0.08, 5), M.black); tail.position.set(-0.07, 0, 0); tail.rotation.z = Math.PI / 2; mesh.add(tail); }
  mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.toy = true; } });
  W.scene.add(mesh); const t = { kind, mesh, x, y: r, z, vx: 0, vy: 0, vz: 0, r, rest: kind === 'ball' ? 0.45 : 0.12, friction: kind === 'ball' ? 0.55 : 3.5, lastHit: -10, spin: new THREE.Vector3() };
  mesh.userData.toyObj = t; W.toys.push(t); return t;
}
function updateToys(dt) {
  for (const t of W.toys) {
    t.vy -= 9.8 * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
    // support surface: floor or furniture tops (only while roughly above them)
    const top = surfaceHeightAt(t.x, t.z); const floorY = (t.y - t.r < top + 0.05 && t.vy <= 0 && top < t.y + 0.1) ? top : 0;
    if (t.y - t.r < floorY) { t.y = floorY + t.r; if (t.vy < -0.3) { t.vy = -t.vy * t.rest; if (Math.abs(t.vy) > 0.4) playSfx('toyBounce', t, 0.4); } else t.vy = 0;
      const f = Math.exp(-t.friction * dt); t.vx *= f; t.vz *= f; if (Math.hypot(t.vx, t.vz) < 0.02) { t.vx = t.vz = 0; } }
    // walls
    const m = 0.15 + t.r; if (t.x < ROOM.x0 + m) { t.x = ROOM.x0 + m; t.vx = Math.abs(t.vx) * 0.5; } if (t.x > ROOM.x1 - m) { t.x = ROOM.x1 - m; t.vx = -Math.abs(t.vx) * 0.5; } if (t.z < ROOM.z0 + m) { t.z = ROOM.z0 + m; t.vz = Math.abs(t.vz) * 0.5; } if (t.z > ROOM.z1 - m) { t.z = ROOM.z1 - m; t.vz = -Math.abs(t.vz) * 0.5; }
    // furniture (only when below its top)
    if (t.y - t.r < 0.9) { const [nx, nz] = resolveCircle(t.x, t.z, t.r, { minTop: t.y + 0.02 }); if (nx !== t.x || nz !== t.z) { const dx = nx - t.x, dz = nz - t.z; const l = Math.hypot(dx, dz) || 1; const vn = (t.vx * dx + t.vz * dz) / l; if (vn < 0) { t.vx -= dx / l * vn * 1.5; t.vz -= dz / l * vn * 1.5; } t.x = nx; t.z = nz; } }
    t.mesh.position.set(t.x, t.y, t.z);
    const sp = Math.hypot(t.vx, t.vz); if (sp > 0.01) { if (t.kind === 'ball') { const axis = new THREE.Vector3(t.vz, 0, -t.vx).normalize(); t.mesh.rotateOnWorldAxis(axis, sp * dt / t.r); } else { t.mesh.rotation.y = damp(t.mesh.rotation.y, Math.atan2(-t.vz, t.vx) + Math.PI, 8, dt); } }
  }
  // treats
  if (W.treats) for (let i = W.treats.length - 1; i >= 0; i--) { const tr = W.treats[i]; if (tr.eaten || W.time - tr.t0 > 120) { W.scene.remove(tr.mesh); W.treats.splice(i, 1); continue; } if (!tr.landed) { tr.vy -= 9.8 * dt; tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.z += tr.vz * dt; tr.mesh.rotation.x += dt * 8; if (tr.y < 0.012) { tr.y = 0.012; tr.landed = true; tr.mesh.rotation.set(0, rand(TAU), 0); playSfx('toyBounce', tr, 0.3); emitEvent({ type: 'treat', x: tr.x, z: tr.z, salience: 0.95, treat: tr, label: 'a treat tossed from the bar' }); } tr.mesh.position.set(tr.x, tr.y, tr.z); } }
}
function tossToy(t, from, dir, power = 2.5) { t.x = from.x; t.y = from.y; t.z = from.z; t.vx = dir.x * power; t.vz = dir.z * power; t.vy = 1.6 + dir.y * power; t.lastHit = W.time; setTimeout(() => emitEvent({ type: 'toy', x: t.x, z: t.z, salience: 0.8, toy: t, label: 'a toy you threw' }), 500); }
function tossTreat(target) {
  W.treats = W.treats || []; const from = { x: -1.3, y: 1.15, z: -3.0 }; const to = target || { x: rand(-3.5, 0.5), z: rand(-2.3, -0.3) };
  const mesh = new THREE.Mesh(G.sph(0.022, 10, 8), M.pastry); mesh.scale.set(1.7, 0.5, 1); mesh.castShadow = true; mesh.position.set(from.x, from.y, from.z); W.scene.add(mesh);
  const T = 0.8; const tr = { mesh, x: from.x, y: from.y, z: from.z, vx: (to.x - from.x) / T, vz: (to.z - from.z) / T, vy: (0 - from.y + 0.5 * 9.8 * T * T) / T, landed: false, eaten: false, t0: W.time };
  W.treats.push(tr); return tr;
}

// ─── Steam sprites ─────────────────────────────────────────────────────────────
function buildSteam() { W.steamPool = []; for (let i = 0; i < 140; i++) { const s = new THREE.Sprite(M.steam.clone()); s.visible = false; s.userData.life = 0; W.scene.add(s); W.steamPool.push(s); } }
function updateSteam(dt) {
  for (const em of W.steamers) { em.next -= dt; const rate = em.machine ? (W.machine.brewing > 0 ? 0.05 : 0.6) : 0.28; if (em.next < 0) { em.next = rate * rand(0.7, 1.3); const s = W.steamPool.find(p => !p.visible); if (s) { s.visible = true; s.userData.life = 0; s.userData.dur = rand(1.8, 2.8); s.userData.x = em.x + rand(-0.01, 0.01); s.userData.z = em.z + rand(-0.01, 0.01); s.userData.y = em.y; s.userData.sw = rand(TAU); s.userData.big = em.machine && W.machine.brewing > 0; } } }
  for (const s of W.steamPool) { if (!s.visible) continue; const u = s.userData; u.life += dt; const k = u.life / u.dur; if (k >= 1) { s.visible = false; continue; } const rise = u.big ? 0.35 : 0.18; s.position.set(u.x + Math.sin(u.sw + k * 4) * 0.02 * k, u.y + k * rise, u.z + Math.cos(u.sw + k * 3) * 0.02 * k); const sc = (0.05 + k * (u.big ? 0.3 : 0.12)); s.scale.set(sc, sc * 1.3, 1); s.material.opacity = (u.big ? 0.5 : 0.28) * Math.sin(k * Math.PI) * (W.isNight ? 0.6 : 1); }
}

// ─── A bird that visits the outside window ledge ─────────────────────────────
function buildBird() {
  const g = new THREE.Group(); const body = new THREE.Mesh(G.sph(0.05, 10, 8), M.gull); body.scale.set(1.6, 1, 1); g.add(body);
  const head = new THREE.Mesh(G.sph(0.032, 10, 8), M.gull); head.position.set(0.07, 0.04, 0); g.add(head);
  const beak = new THREE.Mesh(G.cyl(0.001, 0.008, 0.025, 5), M.brass); beak.position.set(0.095, 0.03, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  const tail = new THREE.Mesh(G.box(0.06, 0.008, 0.04), M.gullWing); tail.position.set(-0.07, 0.01, 0); g.add(tail);
  const wings = [-1, 1].map(s => { const w = new THREE.Mesh(G.plane(0.12, 0.06), M.gullWing); w.rotation.x = -Math.PI / 2; const p = new THREE.Group(); p.position.set(0, 0.02, s * 0.03); w.position.z = s * 0.045; p.add(w); g.add(p); p.userData.s = s; return p; });
  g.visible = false; W.scene.add(g);
  W.bird = { g, wings, state: 'away', t: rand(20, 45), landed: false, pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), hopT: 0 };
}
function updateBird(dt) {
  const b = W.bird; b.t -= dt;
  if (b.state === 'away') { if (b.t < 0) { b.state = 'arrive'; b.t = 0; const lx = rand(-3.3, -1.0) + (Math.random() < 0.5 ? 0 : 5.0); b.to.set(lx, 0.9, ROOM.z1 + 0.42); b.from.set(lx + rand(-6, 6), 4 + rand(0, 3), ROOM.z1 + 9); b.g.visible = true; b.flap = 1; } return; }
  if (b.state === 'arrive') { b.t += dt; const k = smoothstep(0, 1, b.t / 2.4); b.pos.lerpVectors(b.from, b.to, k); b.pos.y += Math.sin(k * Math.PI) * 0.6; b.g.position.copy(b.pos); b.g.rotation.y = Math.atan2(b.to.x - b.from.x, 0) + (b.to.x < b.from.x ? Math.PI : 0); b.g.rotation.y = b.to.x < b.from.x ? Math.PI : 0; if (k >= 1) { b.state = 'perched'; b.landed = true; b.t = rand(10, 28); b.hopT = 1; emitEvent({ type: 'bird', x: b.to.x, z: ROOM.z1 - 0.6, salience: 0.75, label: 'a bird on the window ledge' }); playSfx('chirp', b); } }
  else if (b.state === 'perched') {
    b.hopT -= dt; b.g.rotation.y = damp(b.g.rotation.y, b.face || 0, 6, dt);
    if (b.hopT < 0) { b.hopT = rand(0.8, 3); if (Math.random() < 0.5) { b.hop = 0.25; b.to.x = clamp(b.to.x + rand(-0.15, 0.15), -3.4, 5.2); b.face = Math.random() < 0.5 ? 0 : Math.PI; } if (Math.random() < 0.35) playSfx('chirp', b); }
    if (b.hop > 0) { b.hop -= dt; b.pos.x = damp(b.pos.x, b.to.x, 10, dt); b.pos.y = 0.9 + Math.sin(clamp(b.hop / 0.25, 0, 1) * Math.PI) * 0.06; } else b.pos.y = 0.9 + Math.sin(W.time * 12) * 0.003;
    b.g.position.copy(b.pos); b.g.rotation.x = Math.sin(W.time * 1.7) * 0.05;
    // scared off by a cat right at the window or the end of its visit
    const scared = W.cats.some(c => c.perch && (c.perch.id === 'ledge') && Math.abs(c.x - b.pos.x) < 1.2 && c.speed > 0.05) ;
    if (b.t < 0 || scared) { b.state = 'leave'; b.landed = false; b.t = 0; b.from.copy(b.pos); b.to.set(b.pos.x + rand(-5, 5), 6, ROOM.z1 + 10); playSfx('flutter', b); }
  }
  else if (b.state === 'leave') { b.t += dt; const k = b.t / 2.2; b.pos.lerpVectors(b.from, b.to, smoothstep(0, 1, k)); b.g.position.copy(b.pos); if (k >= 1) { b.state = 'away'; b.g.visible = false; b.t = rand(35, 110); } }
  const flapping = b.state === 'arrive' || b.state === 'leave' || b.hop > 0; b.wings.forEach(w => { w.rotation.x = flapping ? Math.sin(W.time * 34) * 0.9 * w.userData.s : damp(w.rotation.x, 0.15 * w.userData.s, 8, dt); });
}

// ─── Passers-by on the sidewalk ───────────────────────────────────────────────
function buildPedestrians() {
  const cols = [0xf2d6c2, 0x7fb7d9, 0xe98f7a, 0xf6e6b4, 0x9ad0b0, 0xf0f0f0];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); const c = cols[i % cols.length]; const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const torso = new THREE.Mesh(G.cap(0.16, 0.5, 8), m); torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(G.sph(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b39a, roughness: 0.8 })); head.position.y = 1.62; g.add(head);
    const legs = [-1, 1].map(s => { const l = new THREE.Mesh(G.cap(0.07, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.9 })); const p = new THREE.Group(); p.position.set(s * 0.09, 0.85, 0); l.position.y = -0.35; p.add(l); g.add(p); return p; });
    const arms = [-1, 1].map(s => { const a = new THREE.Mesh(G.cap(0.05, 0.5, 6), m); const p = new THREE.Group(); p.position.set(s * 0.24, 1.35, 0); a.position.y = -0.28; p.add(a); g.add(p); return p; });
    if (i % 2) { const bag = new THREE.Mesh(G.box(0.22, 0.28, 0.1), new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.8 })); bag.position.set(-0.3, 0.95, 0); g.add(bag); }
    g.visible = false; W.scene.add(g);
    W.pedestrians.push({ g, legs, arms, active: false, t: rand(5, 40) * (i + 1) * 0.5, dir: 1, speed: rand(0.9, 1.4), pos: new THREE.Vector3(), phase: rand(TAU) });
  }
}
function updatePedestrians(dt) {
  for (const p of W.pedestrians) {
    if (!p.active) { p.t -= dt; if (p.t < 0) { p.active = true; p.dir = Math.random() < 0.5 ? 1 : -1; const side = Math.random() < 0.3 ? 'left' : Math.random() < 0.5 ? 'deck' : 'shore'; p.side = side; const lim = side === 'shore' ? 60 : 16; p.lim = lim; if (side === 'deck') p.pos.set(-lim * p.dir, 0, ROOM.z1 + rand(2.0, 4.0)); else if (side === 'shore') p.pos.set(-lim * p.dir, 0, EXT.shoreZ - rand(2, 5)); else p.pos.set(ROOM.x0 - rand(1.2, 2.8), 0, -15 * p.dir); p.g.visible = true; p.speed = rand(0.8, 1.4); } continue; }
    if (p.side !== 'left') { p.pos.x += p.dir * p.speed * dt; p.g.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; if (Math.abs(p.pos.x) > p.lim) { p.active = false; p.g.visible = false; p.t = rand(10, 40); } }
    else { p.pos.z += p.dir * p.speed * dt; p.g.rotation.y = p.dir > 0 ? 0 : Math.PI; if (Math.abs(p.pos.z) > 16) { p.active = false; p.g.visible = false; p.t = rand(12, 50); } }
    p.phase += dt * p.speed * 4.2; p.legs.forEach((l, i) => l.rotation.x = Math.sin(p.phase + i * Math.PI) * 0.5); p.arms.forEach((a, i) => a.rotation.x = Math.sin(p.phase + i * Math.PI + Math.PI) * 0.35);
    p.g.position.copy(p.pos); p.g.position.y = Math.abs(Math.sin(p.phase)) * 0.03;
  }
}

// ─── Small ambient systems ────────────────────────────────────────────────────
function updateAmbient(dt) {
  updateExterior(dt);
  // plants sway
  if (W.plants) for (const g of W.plants) { const rus = g.userData.rustle || 0; if (rus > 0) g.userData.rustle = Math.max(0, rus - dt * 0.9); g.children.forEach(st => { st.rotation.x = st.userData.baseX + Math.sin(W.time * 0.9 + st.userData.sway) * 0.025 + Math.sin(W.time * 14 + st.userData.sway) * 0.12 * rus; st.rotation.z = Math.sin(W.time * 0.7 + st.userData.sway * 2) * 0.02 + Math.sin(W.time * 17 + st.userData.sway) * 0.1 * rus; }); }
  if (W.treeCanopies) W.treeCanopies.forEach((c, i) => { c.position.x += Math.sin(W.time * 0.8 + i) * 0.0006; c.rotation.z = Math.sin(W.time * 0.6 + i) * 0.03; });
  // dangling toy pendulum
  if (W.danglers) for (const d of W.danglers) { d.vel += (-9.8 / d.len * Math.sin(d.ang) - d.vel * 0.35) * dt; d.ang += d.vel * dt; d.ball.position.set(d.x + Math.sin(d.ang) * d.len, d.y - Math.cos(d.ang) * d.len, d.z); d.string.position.set(d.x + Math.sin(d.ang) * d.len / 2, d.y - Math.cos(d.ang) * d.len / 2, d.z); d.string.rotation.z = -d.ang; }
  if (W.fans) W.fans.forEach((h, i) => { h.rotation.y += dt * (W.lightsOn ? 2.6 : 0.9) * (i ? 1 : -1); });
  // clock
  if (W.wallClock) { const h = W.dayTime % 12, m = (W.dayTime % 1) * 60; W.wallClock.h.rotation.z = -(h / 12) * TAU; W.wallClock.m.rotation.z = -(m / 60) * TAU; }
  // espresso machine
  if (W.machine && W.machine.brewing > 0) { W.machine.brewing -= dt; if (W.machine.brewing <= 0) { playSfx('cupSet', W.machine); showToast('☕ A fresh cortado is waiting on the bar'); W.steamers.push({ x: -2.6, y: 1.04, z: -3.15, next: 0, temp: W.time + 70 }); cup(-2.6, 0.95, -3.15, false, 'ceramic'); BNS.build(W.scene, { shadow: false }); } }
  for (let i = W.steamers.length - 1; i >= 0; i--) if (W.steamers[i].temp && W.time > W.steamers[i].temp) W.steamers.splice(i, 1);
  // bell dome bounce (visual): handled by sfx only (batched geometry)
  // sun-patch marker for debugging is intentionally absent
}
function brewEspresso() { if (W.machine.brewing > 0) return; W.machine.brewing = 4.5; playSfx('espresso', W.machine); showToast('Pulling a shot…'); emitEvent({ type: 'sound', x: W.machine.x, z: W.machine.z + 1.2, salience: 0.55, label: 'the espresso machine' }); }
function ringBell(manual) { playSfx('bell', W.bell); emitEvent({ type: 'sound', x: W.bell.x, z: W.bell.z + 0.8, salience: manual ? 0.6 : 0.45, label: 'the service bell' }); if (manual) showToast('🔔 Ding! The cats look up.'); }
function toggleLights() { W.lightsOn = !W.lightsOn; if (W.switchMesh) W.switchMesh.position.y = W.lightsOn ? 1.27 : 1.23; playSfx('click', { x: -1.75, y: 1.25, z: ROOM.z1 }); showToast(W.lightsOn ? 'Lights on' : 'Lights off — the café goes moody'); }
