// ─── The player's character: a procedural, jointed young woman (5'4", slim, curly dark-red hair, blue eyes) ──
const OUTFITS = {
  casual: { name: 'Casual — black yoga pants, white crop top' },
  work: { name: 'Work — button-up shirt & slacks' },
};
const SLACK_COLORS = { beige: 0xcdb99a, black: 0x1c1b1e, blue: 0x2c4a7a, pink: 0xe6a3b8 };
const SHIRT_COLORS = { white: 0xf7f5f2, cream: 0xf0e6d2, lightblue: 0xbdd3ea, black: 0x1a191c };

class Avatar {
  constructor() {
    this.height = 1.63;
    this.group = new THREE.Group(); this.group.name = 'avatar';
    this.mats = {
      skin: new THREE.MeshPhysicalMaterial({ color: 0xe9bda3, roughness: 0.62, sheen: 0.25, sheenRoughness: 0.9, sheenColor: new THREE.Color(0xffd7c2), envMapIntensity: 0.4 }),
      hair: new THREE.MeshPhysicalMaterial({ color: 0x7a2419, roughness: 0.5, sheen: 0.9, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xb0402c), envMapIntensity: 0.5 }),
      top: new THREE.MeshStandardMaterial({ color: 0xf8f6f3, roughness: 0.85 }),
      pants: new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color(0x444), sheenRoughness: 0.6 }),
      shirt: new THREE.MeshStandardMaterial({ color: 0xf7f5f2, roughness: 0.8 }),
      slacks: new THREE.MeshStandardMaterial({ color: 0xcdb99a, roughness: 0.85 }),
      shoe: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.55 }),
      shoeWork: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.35, metalness: 0.1 }),
      lips: new THREE.MeshStandardMaterial({ color: 0xc86a72, roughness: 0.45 }),
      brow: new THREE.MeshStandardMaterial({ color: 0x4a1710, roughness: 0.9 }),
      eye: new THREE.MeshStandardMaterial({ map: eyeTexture('#3b7fd4', 0.62), roughness: 0.12, envMapIntensity: 1.3 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf5f0ea, roughness: 0.4 }),
      button: new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.3, metalness: 0.2 }),
    };
    this.meshes = []; this.outfitParts = { casual: [], work: [] };
    this.build();
    this.meshes.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    this.blob = new THREE.Mesh(G.plane(0.7, 0.7), M.blob.clone()); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.004; this.blob.material.opacity = 0.45; this.group.add(this.blob);
    this.phase = 0; this.gait = 0; this.breath = 0; this.blink = 0; this.nextBlink = 3; this.pose = 'stand'; this.lean = 0;
    this.outfit = 'casual'; this.slack = 'beige'; this.shirt = 'white';
    try { const saved = JSON.parse(store.getItem('cafe_outfit') || 'null'); if (saved) { this.outfit = saved.outfit || 'casual'; this.slack = saved.slack || 'beige'; this.shirt = saved.shirt || 'white'; } } catch (e) {}
    this.applyOutfit();
  }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); this.meshes.push(m); return m; }
  build() {
    const K = this.mats;
    // hips / pelvis
    this.hips = new THREE.Group(); this.hips.position.y = 0.93; this.group.add(this.hips);
    const pelvis = this.mesh(G.rbox(0.31, 0.2, 0.2, 0.07, 4), K.pants, this.hips, 0, 0.02, 0); this.outfitParts.casual.push(pelvis);
    const pelvisW = this.mesh(G.rbox(0.325, 0.21, 0.215, 0.07, 4), K.slacks, this.hips, 0, 0.02, 0); this.outfitParts.work.push(pelvisW);
    // legs
    this.legs = {};
    [-1, 1].forEach(s => {
      const hip = new THREE.Group(); hip.position.set(s * 0.085, -0.04, 0); this.hips.add(hip);
      const thigh = this.mesh(G.cap(0.068, 0.34, 12), K.pants, hip, 0, -0.2, 0); this.outfitParts.casual.push(thigh);
      const thighW = this.mesh(G.cap(0.078, 0.34, 12), K.slacks, hip, 0, -0.2, 0); this.outfitParts.work.push(thighW);
      const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
      const shin = this.mesh(G.cap(0.052, 0.32, 12), K.pants, knee, 0, -0.19, 0); this.outfitParts.casual.push(shin);
      const shinW = this.mesh(G.cap(0.066, 0.32, 12), K.slacks, knee, 0, -0.19, 0); this.outfitParts.work.push(shinW);
      const ankle = new THREE.Group(); ankle.position.y = -0.4; knee.add(ankle);
      this.mesh(G.cap(0.04, 0.03, 8), K.skin, ankle, 0, 0.0, 0);
      const shoe = this.mesh(G.rbox(0.09, 0.07, 0.25, 0.03, 4), K.shoe, ankle, 0, -0.045, 0.04); this.outfitParts.casual.push(shoe);
      const flat = this.mesh(G.rbox(0.085, 0.05, 0.245, 0.02, 4), K.shoeWork, ankle, 0, -0.055, 0.04); this.outfitParts.work.push(flat);
      this.legs[s < 0 ? 'L' : 'R'] = { hip, knee, ankle };
    });
    // torso
    this.spine = new THREE.Group(); this.spine.position.y = 0.1; this.hips.add(this.spine);
    const torsoProf = [[0.0, 0.0], [0.145, 0.0], [0.13, 0.1], [0.125, 0.16], [0.14, 0.24], [0.155, 0.31], [0.15, 0.38], [0.12, 0.43], [0.0, 0.45]];
    const torso = this.mesh(G.lathe(torsoProf, 24), K.skin, this.spine); torso.scale.set(1.08, 1, 0.7);
    const top = this.mesh(G.lathe([[0.0, 0.2], [0.135, 0.2], [0.145, 0.26], [0.162, 0.32], [0.158, 0.38], [0.126, 0.43], [0.0, 0.44]], 24), K.top, this.spine); top.scale.set(1.09, 1, 0.72); this.outfitParts.casual.push(top);
    const waistband = this.mesh(G.cyl(0.155, 0.16, 0.05, 24), K.pants, this.spine, 0, 0.02, 0); waistband.scale.set(1.05, 1, 0.72); this.outfitParts.casual.push(waistband);
    const shirt = this.mesh(G.lathe([[0.0, -0.02], [0.152, -0.02], [0.138, 0.1], [0.133, 0.16], [0.148, 0.24], [0.163, 0.31], [0.158, 0.38], [0.128, 0.43], [0.0, 0.45]], 24), K.shirt, this.spine); shirt.scale.set(1.1, 1, 0.74); this.outfitParts.work.push(shirt);
    const belt = this.mesh(G.cyl(0.158, 0.162, 0.045, 24), K.slacks, this.spine, 0, -0.01, 0); belt.scale.set(1.07, 1, 0.74); this.outfitParts.work.push(belt);
    // buttons + collar + placket for the work shirt
    for (let i = 0; i < 6; i++) { const b = this.mesh(G.sph(0.008, 8, 6), K.button, this.spine, 0, 0.05 + i * 0.065, 0.113 + (i > 3 ? 0.006 : 0.0)); b.castShadow = false; this.outfitParts.work.push(b); }
    const placket = this.mesh(G.box(0.03, 0.4, 0.006), K.shirt, this.spine, 0, 0.22, 0.114); placket.castShadow = false; this.outfitParts.work.push(placket);
    [-1, 1].forEach(s => { const c = this.mesh(G.box(0.07, 0.06, 0.012), K.shirt, this.spine, s * 0.05, 0.445, 0.06, -0.5, s * 0.5, s * 0.25); this.outfitParts.work.push(c); });
    // arms
    this.arms = {};
    [-1, 1].forEach(s => {
      const sh = new THREE.Group(); sh.position.set(s * 0.19, 0.4, 0); this.spine.add(sh);
      this.mesh(G.sph(0.05, 12, 10), K.skin, sh, 0, 0.0, 0);
      const shSleeve = this.mesh(G.sph(0.056, 12, 10), K.shirt, sh, 0, 0.005, 0); this.outfitParts.work.push(shSleeve);
      const upper = this.mesh(G.cap(0.04, 0.22, 10), K.skin, sh, 0, -0.15, 0);
      const upperS = this.mesh(G.cap(0.048, 0.22, 10), K.shirt, sh, 0, -0.15, 0); this.outfitParts.work.push(upperS);
      const elbow = new THREE.Group(); elbow.position.y = -0.29; sh.add(elbow);
      const fore = this.mesh(G.cap(0.034, 0.2, 10), K.skin, elbow, 0, -0.13, 0);
      const foreS = this.mesh(G.cap(0.042, 0.19, 10), K.shirt, elbow, 0, -0.125, 0); this.outfitParts.work.push(foreS);
      const hand = this.mesh(G.sph(0.038, 10, 8), K.skin, elbow, 0, -0.27, 0.01); hand.scale.set(0.8, 1.2, 0.5);
      this.arms[s < 0 ? 'L' : 'R'] = { sh, elbow };
    });
    // neck + head
    this.neck = new THREE.Group(); this.neck.position.y = 0.44; this.spine.add(this.neck);
    this.mesh(G.cyl(0.045, 0.055, 0.1, 12), K.skin, this.neck, 0, 0.04, 0);
    this.head = new THREE.Group(); this.head.position.y = 0.13; this.neck.add(this.head);
    const skull = this.mesh(G.sph(0.1, 28, 22), K.skin, this.head, 0, 0.0, 0); skull.scale.set(0.9, 1.08, 0.95);
    this.mesh(G.sph(0.062, 16, 12), K.skin, this.head, 0, -0.06, 0.03).scale.set(1.05, 0.9, 0.9);      // jaw / chin
    [-1, 1].forEach(s => this.mesh(G.sph(0.022, 10, 8), K.skin, this.head, s * 0.088, -0.005, 0.0).scale.set(0.5, 1, 0.8));   // ears
    const nose = this.mesh(G.sph(0.013, 10, 8), K.skin, this.head, 0, -0.012, 0.094); nose.scale.set(0.8, 1.4, 1); nose.castShadow = false;
    this.eyes = [];
    [-1, 1].forEach(s => {
      const e = this.mesh(G.sph(0.0155, 18, 14), K.eye, this.head, s * 0.034, 0.018, 0.078, 0, -Math.PI / 2, 0); e.castShadow = false; this.eyes.push(e);
      const lid = this.mesh(G.sph(0.0168, 12, 8), K.skin, this.head, s * 0.034, 0.019, 0.077); lid.scale.set(1, 0.001, 1); lid.castShadow = false; e.userData.lid = lid;
      const brow = this.mesh(G.box(0.042, 0.007, 0.008), K.brow, this.head, s * 0.036, 0.046, 0.087, 0, 0, s * 0.12); brow.castShadow = false;
      const lash = this.mesh(G.box(0.03, 0.003, 0.004), K.brow, this.head, s * 0.034, 0.033, 0.089); lash.castShadow = false;
    });
    const lipU = this.mesh(G.sph(0.02, 12, 8), K.lips, this.head, 0, -0.05, 0.085); lipU.scale.set(1.2, 0.35, 0.5); lipU.castShadow = false;
    const lipL = this.mesh(G.sph(0.017, 12, 8), K.lips, this.head, 0, -0.06, 0.084); lipL.scale.set(1.1, 0.4, 0.5); lipL.castShadow = false;
    // curly hair: a scalp cap plus a cloud of curls that fall to the shoulders
    this.hair = new THREE.Group(); this.head.add(this.hair);
    const cap = this.mesh(G.sph(0.104, 24, 18), K.hair, this.hair, 0, 0.012, -0.012); cap.scale.set(0.95, 1.04, 1.0);
    const N = makeNoise(77); let ci = 0; const curlGeos = [];
    const curl = (x, y, z, r) => { const g = G.sph(r, 8, 6); g.applyMatrix4(mat(x, y, z, N.n2(ci, 3), { rx: N.n2(ci, 2), rz: N.n2(ci, 4), sy: 0.85 + N.n2(ci, 1) * 0.2 })); curlGeos.push(g); ci++; };
    for (let i = 0; i < 190; i++) {           // crown & sides
      const a = rand(TAU), t = rand(0.05, 1); const el = Math.acos(1 - t * 0.9);   // from top down to just above the face
      const r = 0.11; let x = Math.sin(el) * Math.cos(a) * r * 0.95, y = Math.cos(el) * r * 1.05 + 0.01, z = Math.sin(el) * Math.sin(a) * r * 1.0 - 0.01;
      if (z > 0.06 && y < 0.055) continue;   // keep the face clear
      curl(x, y, z, rand(0.013, 0.022));
    }
    for (let i = 0; i < 52; i++) {            // ringlets falling to the shoulders
      const a = rand(-0.2, 1.2) * Math.PI + Math.PI * 0.9; const rr = 0.095 + rand(0, 0.03);
      let x = Math.cos(a) * rr, z = Math.sin(a) * rr - 0.02; const len = rand(0.14, 0.3); let y = -0.02; const n = Math.floor(len / 0.03);
      for (let k = 0; k < n; k++) { curl(x + N.n2(i, k) * 0.018, y - k * 0.03, z + N.n2(k, i) * 0.018, rand(0.012, 0.02)); }
    }
    const curls = new THREE.Mesh(mergeGeometries(curlGeos, false), K.hair); this.hair.add(curls); this.meshes.push(curls);   // one draw call for all the curls
  }
  applyOutfit() {
    this.outfitParts.casual.forEach(m => m.visible = this.outfit === 'casual');
    this.outfitParts.work.forEach(m => m.visible = this.outfit === 'work');
    this.mats.slacks.color.setHex(SLACK_COLORS[this.slack] || SLACK_COLORS.beige);
    this.mats.shirt.color.setHex(SHIRT_COLORS[this.shirt] || SHIRT_COLORS.white);
    try { store.setItem('cafe_outfit', JSON.stringify({ outfit: this.outfit, slack: this.slack, shirt: this.shirt })); } catch (e) {}
  }
  setOutfit(outfit, slack, shirt) { if (outfit) this.outfit = outfit; if (slack) this.slack = slack; if (shirt) this.shirt = shirt; this.applyOutfit(); }
  // state: { speed, moving, seated, crouch, headYaw, headPitch, hideHead }
  animate(dt, s) {
    const stride = s.speed > 2.4 ? 1.45 : 1.1; if (s.moving) this.phase = (this.phase + (s.speed / stride) * dt) % 1;
    this.gait = damp(this.gait, s.moving ? 1 : 0, 8, dt); this.breath += dt * 1.4;
    const ph = this.phase * TAU, g = this.gait; const run = s.speed > 2.4;
    const legA = (run ? 0.85 : 0.55) * g, armA = (run ? 0.8 : 0.4) * g, kneeA = (run ? 1.3 : 0.9) * g;
    const L = this.legs, A = this.arms;
    if (s.seated) {
      this.hips.position.y = damp(this.hips.position.y, s.seatH + 0.1, 8, dt);
      for (const k of ['L', 'R']) { L[k].hip.rotation.x = damp(L[k].hip.rotation.x, -1.5, 8, dt); L[k].knee.rotation.x = damp(L[k].knee.rotation.x, 1.5, 8, dt); L[k].ankle.rotation.x = damp(L[k].ankle.rotation.x, 0, 8, dt); A[k].sh.rotation.x = damp(A[k].sh.rotation.x, -0.55, 8, dt); A[k].elbow.rotation.x = damp(A[k].elbow.rotation.x, -1.0, 8, dt); }
      this.spine.rotation.x = damp(this.spine.rotation.x, -0.06, 8, dt); this.spine.rotation.y = 0;
    } else {
      const crouchY = s.crouch ? 0.62 : 0.93; const bob = Math.abs(Math.sin(ph)) * (run ? 0.045 : 0.022) * g;
      this.hips.position.y = damp(this.hips.position.y, crouchY + bob + Math.sin(this.breath) * 0.002, 12, dt);
      const swing = Math.sin(ph);
      ['L', 'R'].forEach((k, i) => {
        const sg = i === 0 ? 1 : -1; const f = ph + (i === 0 ? 0 : Math.PI);
        const hipT = Math.sin(f) * legA + (s.crouch ? -0.9 : 0); const kneeT = Math.max(0, -Math.sin(f - 0.6)) * kneeA + (s.crouch ? 1.6 : 0.03) + (1 - g) * 0.02;
        L[k].hip.rotation.x = damp(L[k].hip.rotation.x, hipT, 14, dt); L[k].knee.rotation.x = damp(L[k].knee.rotation.x, kneeT, 14, dt); L[k].ankle.rotation.x = damp(L[k].ankle.rotation.x, -hipT * 0.4 - kneeT * 0.3 + (s.crouch ? 0.5 : 0), 12, dt);
        A[k].sh.rotation.x = damp(A[k].sh.rotation.x, -Math.sin(f) * armA + 0.05, 12, dt); A[k].sh.rotation.z = damp(A[k].sh.rotation.z, sg * (0.1 + (run ? 0.15 : 0)), 6, dt);
        A[k].elbow.rotation.x = damp(A[k].elbow.rotation.x, -(0.25 + (run ? 0.9 : 0.15) * g + Math.max(0, -Math.sin(f)) * 0.5 * g), 12, dt);
      });
      this.spine.rotation.x = damp(this.spine.rotation.x, (run ? -0.18 : -0.03) * g + (s.crouch ? 0.25 : 0), 8, dt);
      this.spine.rotation.y = damp(this.spine.rotation.y, -swing * 0.08 * g, 8, dt);
      this.spine.rotation.z = damp(this.spine.rotation.z, (1 - g) * Math.sin(this.breath * 0.5) * 0.012, 4, dt);
    }
    this.head.rotation.set(damp(this.head.rotation.x, -(s.headPitch || 0) * 0.5, 10, dt), damp(this.head.rotation.y, clamp(s.headYaw || 0, -1.1, 1.1), 10, dt), 0);
    this.neck.rotation.y = damp(this.neck.rotation.y, clamp((s.headYaw || 0) * 0.4, -0.5, 0.5), 10, dt);
    // hair bounce
    this.hair.rotation.x = Math.sin(ph * 2) * 0.02 * g; this.hair.position.y = -Math.abs(Math.sin(ph)) * 0.006 * g;
    // blink
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = rand(2.5, 6); } this.blink = Math.max(0, this.blink - dt * 8); const open = 1 - Math.sin(this.blink * Math.PI);
    this.eyes.forEach(e => { e.scale.set(1, Math.max(0.05, open), 1); e.userData.lid.scale.set(1, 1 - open + 0.001, 1); });
    this.head.visible = !s.hideHead;
  }
}
