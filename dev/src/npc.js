// ─── Non-player people: the barista behind the bar, beach-goers on the shore, sunbathers under the huts, a gull flock ──
const NPC = { people: [], sitters: [], gulls: [], barista: null };
const LOOKS = [
  { sex: 'f', height: 1.66, skin: 0xd9a888, hairColor: 0x2b1a12, hairSheen: 0x6a4a34, hairStyle: 'longwave', eyes: '#4a3a2a', outfits: ['swim'], swim: 0xe0507a },
  { sex: 'm', height: 1.8, skin: 0xc98f6a, hairColor: 0x1a1210, hairSheen: 0x4a3a30, hairStyle: 'short', eyes: '#3a2a20', outfits: ['swim'], swim: 0x2e5aa8 },
  { sex: 'f', height: 1.62, skin: 0xf0d2bd, hairColor: 0xd9b26a, hairSheen: 0xfff0b0, hairStyle: 'ponytail', eyes: '#5f8fd0', outfits: ['coverup'], coverup: 0xf6efe2 },
  { sex: 'm', height: 1.76, skin: 0x8a5a3c, hairColor: 0x120d0b, hairSheen: 0x3a2a24, hairStyle: 'short', eyes: '#2a1a12', outfits: ['coverup'], coverup: 0xbfe0ea },
  { sex: 'f', height: 1.7, skin: 0xe6b89a, hairColor: 0x6a2a18, hairSheen: 0xc2603a, hairStyle: 'bun', eyes: '#5a7a3a', outfits: ['swim'], swim: 0x111111 },
  { sex: 'm', height: 1.72, skin: 0xe8c4a8, hairColor: 0x8a7a6a, hairSheen: 0xcfc2b2, hairStyle: 'short', eyes: '#4a6a9a', outfits: ['swim'], swim: 0xe8a33a },
  { sex: 'f', height: 1.64, skin: 0xb87a55, hairColor: 0x1e120e, hairSheen: 0x5a3a2a, hairStyle: 'longwave', eyes: '#2a1a12', outfits: ['coverup'], coverup: 0xf4d9c6 },
  { sex: 'f', height: 1.68, skin: 0xf2d8c6, hairColor: 0xb8442a, hairSheen: 0xf08a5a, hairStyle: 'ponytail', eyes: '#3a8a5a', outfits: ['swim'], swim: 0xf3f0ea },
];
function buildNPCs() {
  // the barista: dark hair in a bun, black tee, green apron — works the bar
  const b = new Humanoid({ sex: 'f', height: 1.68, skin: 0xd8a682, hairColor: 0x24160f, hairSheen: 0x6a4a36, hairStyle: 'bun', eyes: '#4a3520', brows: 0x1a100a, outfits: ['barista'], apron: 0x2e3d31, tee: 0x1c1b1e, seed: 3 });
  b.group.position.set(-3.0, 0, -3.83); W.scene.add(b.group);
  NPC.barista = { h: b, x: -3.0, z: -3.83, tx: -3.0, heading: 0, state: 'wipe', t: rand(4, 8), speed: 0 };
  // beach-goers strolling the shore, the terrace and the pool deck; each walks back and forth with pauses
  const routes = [{ y: EXT.sandY, z: () => EXT.shoreZ - rand(2.5, 6), x0: -52, x1: 52 }, { y: EXT.sandY, z: () => EXT.shoreZ - rand(2.5, 6), x0: -52, x1: 52 }, { y: 0, z: () => rand(6.2, 8.6), x0: -15, x1: 15 }, { y: 0, z: () => rand(17.2, 18.8), x0: -9, x1: 11 }, { y: EXT.sandY, z: () => EXT.shoreZ - rand(2.5, 6), x0: -52, x1: 52 }, { y: 0, z: () => rand(6.2, 8.6), x0: -15, x1: 15 }];
  routes.forEach((r, i) => { const look = LOOKS[i % LOOKS.length]; const h = new Humanoid({ ...look, seed: 11 + i, hairCards: 90 }); const z = r.z(); const x = rand(r.x0, r.x1); h.group.position.set(x, r.y, z); W.scene.add(h.group); NPC.people.push({ h, x, z, y: r.y, x0: r.x0, x1: r.x1, dir: Math.random() < 0.5 ? 1 : -1, speed: rand(0.75, 1.25), heading: 0, pause: 0, t: rand(5, 20), route: r }); });
  // sunbathers reclining on loungers under the huts
  const huts = EXT.huts.slice().sort(() => Math.random() - 0.5).slice(0, 6);
  huts.forEach((hut, i) => { const look = LOOKS[(i + 3) % LOOKS.length]; const h = new Humanoid({ ...look, outfits: ['swim'], seed: 40 + i, hairCards: 70 }); const side = i % 2 ? 0.55 : -0.55; const c = Math.cos(hut.ry), s = Math.sin(hut.ry); const lx = side * hut.scale, lz = 0.05 * hut.scale; h.group.position.set(hut.x + lx * c + lz * s, hut.y + 0.4 * hut.scale, hut.z - lx * s + lz * c); h.group.rotation.y = hut.ry; W.scene.add(h.group); NPC.sitters.push({ h, t: rand(0, 10), look: null }); });
  // gulls
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); const body = new THREE.Mesh(G.cap(0.05, 0.16, 8), M.gull); body.rotation.z = Math.PI / 2; g.add(body); const head = new THREE.Mesh(G.sph(0.045, 8, 6), M.gull); head.position.set(0.12, 0.02, 0); g.add(head);
    const beak = new THREE.Mesh(G.cyl(0.001, 0.012, 0.05, 5), M.brass); beak.position.set(0.17, 0.015, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
    const wings = [-1, 1].map(s => { const p = new THREE.Group(); const w = new THREE.Mesh(G.plane(0.24, 0.55), M.gullWing); w.rotation.x = -Math.PI / 2; w.position.z = s * 0.28; p.add(w); g.add(p); p.userData.s = s; return p; });
    W.scene.add(g); NPC.gulls.push({ g, wings, cx: rand(-30, 30), cz: EXT.shoreZ + rand(6, 40), r: rand(8, 22), h: rand(6, 16), a: rand(TAU), w: rand(0.12, 0.25) * (Math.random() < 0.5 ? 1 : -1), flap: rand(TAU), glide: 0 });
  }
  applyCSM(W.scene);
}
function updateNPCs(dt) {
  const t = W.time;
  // ── barista
  const B = NPC.barista; if (B) {
    B.t -= dt; const brewing = W.machine && W.machine.brewing > 0;
    if (brewing && B.state !== 'brew') { B.state = 'brew'; B.tx = W.machine.x + 0.1; }
    else if (!brewing && B.state === 'brew') { B.state = 'serve'; B.tx = -2.6; B.t = 3; }
    else if (B.state === 'serve' && B.t < 0) { B.state = 'idle'; B.t = rand(3, 6); }
    else if (B.state === 'idle' && B.t < 0) { B.state = pick(['wipe', 'idle', 'wander']); B.t = rand(4, 10); if (B.state === 'wander') B.tx = rand(-5.2, 0.2); }
    else if ((B.state === 'wipe' || B.state === 'wander') && B.t < 0) { B.state = 'idle'; B.t = rand(2, 5); if (Math.random() < 0.5) B.tx = rand(-4.6, -1.2); }
    const dx = B.tx - B.x; const moving = Math.abs(dx) > 0.05; B.speed = damp(B.speed, moving ? 0.8 : 0, 8, dt); if (moving) B.x += Math.sign(dx) * Math.min(Math.abs(dx), B.speed * dt);
    const wantHeading = moving ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (B.state === 'brew' ? Math.PI : 0);
    B.heading += clamp(wrapAngle(wantHeading - B.heading), -6 * dt, 6 * dt);
    B.h.group.position.set(B.x, 0, B.z); B.h.group.rotation.y = B.heading;
    const near = W.playerPos && dist2(W.playerPos.x, W.playerPos.z, B.x, B.z) < 3.2 && !moving && B.state !== 'brew';
    B.h.animate(dt, { speed: B.speed, moving, arms: B.state === 'wipe' ? 'wipe' : B.state === 'brew' || B.state === 'serve' ? 'hold' : 'idle', lookAt: near ? W.playerPos.clone() : (B.state === 'idle' && W.cats.length ? new THREE.Vector3(W.cats[Math.floor(t / 7) % W.cats.length].x, 0.3, W.cats[Math.floor(t / 7) % W.cats.length].z) : null) });
  }
  // ── walkers
  for (const p of NPC.people) {
    p.t -= dt;
    if (p.pause > 0) { p.pause -= dt; p.h.animate(dt, { speed: 0, moving: false, lookAt: new THREE.Vector3(p.x + rand(-1, 1) * 0.01, p.y + 1.4, EXT.shoreZ + 60) }); continue; }
    if (p.t < 0) { p.t = rand(8, 25); if (Math.random() < 0.5) { p.pause = rand(3, 9); p.heading = 0; continue; } else p.dir *= -1; }
    p.x += p.dir * p.speed * dt; if (p.x > p.x1) { p.x = p.x1; p.dir = -1; } if (p.x < p.x0) { p.x = p.x0; p.dir = 1; }
    const wantH = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; p.heading += clamp(wrapAngle(wantH - p.heading), -4 * dt, 4 * dt);
    p.h.group.position.set(p.x, p.y, p.z); p.h.group.rotation.y = p.heading; p.h.animate(dt, { speed: p.speed, moving: true });
  }
  // ── sunbathers: reclined, the odd glance around
  for (const s of NPC.sitters) { s.t -= dt; if (s.t < 0) { s.t = rand(4, 12); s.look = Math.random() < 0.5 ? null : new THREE.Vector3(rand(-20, 20), 3, EXT.shoreZ + 30); } s.h.animate(dt, { speed: 0, moving: false, seated: true, recline: true, seatH: 0.02, lookAt: s.look }); }
  // ── gulls: lazy circles over the water, gliding with bursts of flapping
  for (const g of NPC.gulls) {
    g.a += g.w * dt; const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r * 0.6, y = g.h + Math.sin(t * 0.3 + g.a) * 1.2;
    const dir = new THREE.Vector3(-Math.sin(g.a) * g.w, 0, Math.cos(g.a) * g.w * 0.6).normalize(); g.g.position.set(x, y, z); g.g.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2 + (g.w < 0 ? Math.PI : 0); g.g.rotation.z = g.w * 0.8;
    g.glide -= dt; if (g.glide < -2) g.glide = rand(1.5, 4); const flapping = g.glide > 0; g.flap += dt * (flapping ? 9 : 0.5);
    g.wings.forEach(w => w.rotation.x = (flapping ? Math.sin(g.flap) * 0.55 : 0.12 + Math.sin(g.flap) * 0.04) * w.userData.s);
  }
}
