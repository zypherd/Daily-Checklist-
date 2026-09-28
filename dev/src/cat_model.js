// ─── Procedural cat: jointed skeleton, fur materials, pose blending & gait ───
// Poses are parameter sets; the model damps every joint toward its target each frame, then layers
// the locomotion cycle, tail dynamics, breathing, blinks and head tracking on top.

const BASE_POSE = {
  bodyY: 0.235, bodyPitch: 0, bodyRoll: 0, neckPitch: 0.25, headPitch: -0.1, headYaw: 0, headRoll: 0,
  FL_hip: -0.05, FL_knee: 0.12, FL_paw: -0.05, FL_spread: 0, FR_hip: -0.05, FR_knee: 0.12, FR_paw: -0.05, FR_spread: 0,
  BL_hip: 0.5, BL_knee: -1.0, BL_foot: 0.55, BL_spread: 0, BR_hip: 0.5, BR_knee: -1.0, BR_foot: 0.55, BR_spread: 0,
  tailBase: -0.7, tailCurl: 0.08, tailSway: 0.15, tailYaw: 0, earPitch: 0, earSpread: 0, eyeOpen: 1, crouch: 0,
};
const POSES = {
  stand: {},
  walk: { neckPitch: 0.2, headPitch: -0.05, tailBase: 0.9, tailCurl: 0.12, tailSway: 0.25 },
  trot: { neckPitch: 0.15, headPitch: 0.0, tailBase: 0.6, tailCurl: 0.1, tailSway: 0.35, bodyY: 0.24 },
  run: { neckPitch: 0.05, headPitch: 0.05, tailBase: -0.2, tailCurl: 0.05, tailSway: 0.2, bodyY: 0.235 },
  stalk: { bodyY: 0.15, neckPitch: -0.1, headPitch: 0.15, tailBase: -0.9, tailCurl: 0.05, tailSway: 0.6, FL_hip: 0.3, FL_knee: 0.9, FR_hip: 0.3, FR_knee: 0.9, BL_hip: 1.0, BL_knee: -1.7, BL_foot: 0.8, BR_hip: 1.0, BR_knee: -1.7, BR_foot: 0.8, earPitch: 0.1 },
  sit: { bodyY: 0.2, bodyPitch: 0.55, neckPitch: -0.15, headPitch: -0.1, FL_hip: -0.45, FL_knee: 0.05, FL_paw: -0.1, FR_hip: -0.45, FR_knee: 0.05, FR_paw: -0.1, BL_hip: 1.55, BL_knee: -2.5, BL_foot: 1.0, BL_spread: 0.35, BR_hip: 1.55, BR_knee: -2.5, BR_foot: 1.0, BR_spread: 0.35, tailBase: -1.5, tailCurl: 0.35, tailYaw: 0.9, tailSway: 0.1 },
  loaf: { bodyY: 0.13, bodyPitch: 0.12, neckPitch: 0.05, headPitch: -0.15, FL_hip: 1.3, FL_knee: 2.3, FL_paw: 0.5, FR_hip: 1.3, FR_knee: 2.3, FR_paw: 0.5, BL_hip: 1.6, BL_knee: -2.6, BL_foot: 1.1, BL_spread: 0.5, BR_hip: 1.6, BR_knee: -2.6, BR_foot: 1.1, BR_spread: 0.5, tailBase: -1.3, tailCurl: 0.45, tailYaw: 1.2, tailSway: 0.05, crouch: 1 },
  sleep: { bodyY: 0.115, bodyPitch: 0.02, bodyRoll: 0.35, neckPitch: -0.25, headPitch: 0.35, headYaw: 0.9, headRoll: 0.5, FL_hip: 1.2, FL_knee: 2.4, FL_paw: 0.6, FR_hip: 1.5, FR_knee: 2.2, FR_paw: 0.6, BL_hip: 1.7, BL_knee: -2.7, BL_foot: 1.2, BL_spread: 0.6, BR_hip: 1.4, BR_knee: -2.5, BR_foot: 1.0, BR_spread: 0.8, tailBase: -1.4, tailCurl: 0.5, tailYaw: 1.5, tailSway: 0.02, earPitch: 0.15, eyeOpen: 0, crouch: 1 },
  lieSide: { bodyY: 0.1, bodyRoll: 1.2, bodyPitch: 0.05, neckPitch: 0.1, headPitch: 0.1, headRoll: 0.3, FL_hip: 0.5, FL_knee: 0.9, FR_hip: 0.9, FR_knee: 1.2, BL_hip: 0.9, BL_knee: -1.6, BL_foot: 0.7, BR_hip: 1.1, BR_knee: -1.9, BR_foot: 0.8, tailBase: -0.4, tailCurl: 0.2, tailSway: 0.3, eyeOpen: 0.4 },
  stretch: { bodyY: 0.2, bodyPitch: -0.35, neckPitch: 0.1, headPitch: 0.05, FL_hip: 0.95, FL_knee: 0.05, FL_paw: 0.2, FR_hip: 0.95, FR_knee: 0.05, FR_paw: 0.2, BL_hip: 0.35, BL_knee: -0.5, BL_foot: 0.25, BR_hip: 0.35, BR_knee: -0.5, BR_foot: 0.25, tailBase: 1.1, tailCurl: 0.12, tailSway: 0.15 },
  groom: { bodyY: 0.2, bodyPitch: 0.5, neckPitch: -0.6, headPitch: 0.6, headYaw: 0.5, headRoll: 0.2, FL_hip: -0.45, FL_knee: 0.05, FR_hip: 0.9, FR_knee: 1.6, FR_paw: 0.3, BL_hip: 1.55, BL_knee: -2.5, BL_foot: 1.0, BL_spread: 0.35, BR_hip: 1.4, BR_knee: -2.4, BR_foot: 1.0, BR_spread: 0.9, tailBase: -1.4, tailCurl: 0.3, tailYaw: 0.8, tailSway: 0.08 },
  scratch: { bodyY: 0.3, bodyPitch: 1.05, neckPitch: -0.45, headPitch: -0.15, FL_hip: 1.6, FL_knee: 0.05, FL_paw: 0.9, FR_hip: 1.75, FR_knee: 0.05, FR_paw: 0.9, BL_hip: 0.6, BL_knee: -1.0, BL_foot: 0.6, BR_hip: 0.6, BR_knee: -1.0, BR_foot: 0.6, tailBase: -0.6, tailCurl: 0.1, tailSway: 0.4 },
  crouch: { bodyY: 0.15, bodyPitch: -0.05, neckPitch: 0.2, headPitch: 0.1, FL_hip: 0.35, FL_knee: 1.0, FL_paw: -0.4, FR_hip: 0.35, FR_knee: 1.0, FR_paw: -0.4, BL_hip: 1.1, BL_knee: -1.9, BL_foot: 0.9, BR_hip: 1.1, BR_knee: -1.9, BR_foot: 0.9, tailBase: -0.5, tailSway: 0.5, earPitch: 0.05, crouch: 0.6 },
  jumpUp: { bodyY: 0.25, bodyPitch: 0.5, neckPitch: 0.1, headPitch: -0.2, FL_hip: 1.1, FL_knee: 1.2, FL_paw: -0.4, FR_hip: 1.1, FR_knee: 1.2, FR_paw: -0.4, BL_hip: -0.4, BL_knee: -0.2, BL_foot: 0.4, BR_hip: -0.4, BR_knee: -0.2, BR_foot: 0.4, tailBase: -0.4, tailCurl: 0.05, tailSway: 0.1 },
  jumpDown: { bodyY: 0.25, bodyPitch: -0.45, neckPitch: 0.3, headPitch: 0.1, FL_hip: 0.9, FL_knee: 0.2, FL_paw: 0.0, FR_hip: 0.9, FR_knee: 0.2, FR_paw: 0.0, BL_hip: 0.1, BL_knee: -0.4, BL_foot: 0.3, BR_hip: 0.1, BR_knee: -0.4, BR_foot: 0.3, tailBase: 0.6, tailCurl: 0.05, tailSway: 0.1 },
  land: { bodyY: 0.16, bodyPitch: -0.1, neckPitch: 0.25, FL_hip: 0.2, FL_knee: 1.1, FL_paw: -0.5, FR_hip: 0.2, FR_knee: 1.1, FR_paw: -0.5, BL_hip: 1.2, BL_knee: -2.0, BL_foot: 0.9, BR_hip: 1.2, BR_knee: -2.0, BR_foot: 0.9, tailBase: 0.3, tailSway: 0.3, crouch: 0.5 },
  bat: { bodyY: 0.2, bodyPitch: 0.2, neckPitch: -0.1, headPitch: 0.35, FL_hip: 1.4, FL_knee: 0.3, FL_paw: 0.2, FR_hip: -0.3, FR_knee: 0.5, FR_paw: -0.2, BL_hip: 1.2, BL_knee: -2.0, BL_foot: 0.9, BR_hip: 1.2, BR_knee: -2.0, BR_foot: 0.9, tailBase: 0.2, tailSway: 0.8, earPitch: 0.05 },
  pounceReady: { bodyY: 0.13, bodyPitch: -0.1, neckPitch: 0.25, headPitch: 0.1, FL_hip: 0.5, FL_knee: 1.3, FL_paw: -0.5, FR_hip: 0.5, FR_knee: 1.3, FR_paw: -0.5, BL_hip: 1.3, BL_knee: -2.3, BL_foot: 1.0, BR_hip: 1.3, BR_knee: -2.3, BR_foot: 1.0, tailBase: -0.6, tailSway: 1.2, earPitch: 0.05, crouch: 0.8 },
  alert: { neckPitch: 0.45, headPitch: -0.15, bodyY: 0.245, tailBase: 0.2, tailSway: 0.4, earPitch: -0.1 },
  sniff: { neckPitch: -0.3, headPitch: 0.5, bodyY: 0.22, FL_hip: 0.15, FR_hip: 0.15, tailBase: 0.5, tailSway: 0.2 },
};

const CAT_SPECS = {
  marmalade: { name: 'Marmalade', breed: 'Orange tabby', fur: { base: [214, 128, 58], dark: [168, 84, 30], belly: [246, 224, 190], stripes: 9, stripeStrength: 0.85, mottle: 6, seed: 11 }, eye: '#c9a53a', collar: 0x2f6fbf, size: 1.06, swatch: '#d68a3c', pupil: 0.24 },
  smoke: { name: 'Smoke', breed: 'Russian blue mix', fur: { base: [118, 122, 132], dark: [90, 92, 100], belly: [150, 152, 160], mottle: 10, seed: 22 }, eye: '#7fb46a', collar: 0xd9c46a, size: 1.1, swatch: '#7a7e88', pupil: 0.2 },
  onyx: { name: 'Onyx', breed: 'Black shorthair', fur: { base: [24, 22, 26], dark: [16, 14, 18], belly: [34, 30, 36], mottle: 5, seed: 33 }, eye: '#e4c33a', collar: 0xc93b3b, size: 0.98, swatch: '#1c1a1e', pupil: 0.3, sheenColor: 0x6a5a70 },
  pearl: { name: 'Pearl', breed: 'White & grey bicolour', fur: { base: [244, 240, 234], dark: [130, 130, 136], belly: [248, 246, 242], patches: true, patchColor: [128, 128, 134], patchLevel: 0.14, mottle: 4, seed: 44 }, eye: '#5aa0d9', collar: 0xe07aa0, size: 0.94, swatch: '#e8e4dd', pupil: 0.24 },
  mochi: { name: 'Mochi', breed: 'Seal-point Siamese', fur: { base: [236, 222, 200], dark: [200, 180, 150], belly: [246, 240, 228], mottle: 4, seed: 55 }, points: [78, 52, 44], eye: '#6ec1e8', collar: 0x7a5cc9, size: 0.96, swatch: '#e6d6bd', pupil: 0.22, slim: true },
};

function furMaterial(spec, points = false) {
  const canvas = furTexture(points ? { ...spec.fur, base: spec.points, dark: spec.points, belly: spec.points, stripes: 0, patches: false } : spec.fur);
  const tex = toTexture(canvas, { repeat: [1, 1] });
  const base = points ? spec.points : spec.fur.base;
  const sheen = new THREE.Color(spec.sheenColor ?? (base[0] + base[1] + base[2] > 500 ? 0xffffff : 0xffffff)).multiplyScalar(0.9);
  const light = base[0] + base[1] + base[2] > 450;
  const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.92, metalness: 0, sheen: light ? 0.35 : 0.8, sheenRoughness: 0.8, sheenColor: sheen, envMapIntensity: light ? 0.25 : 0.4 });
  m.userData.hookKey = 'fur'; m.userData.fuzz = new THREE.Color(light ? 0xffffff : (spec.sheenColor ?? 0xffffff)).multiplyScalar(light ? 0.18 : 0.28);
  m.onBeforeCompile = (shader) => {   // soft, back-lit fur fringe along the silhouette
    shader.uniforms.fuzzColor = { value: m.userData.fuzz };
    shader.fragmentShader = shader.fragmentShader.replace('uniform vec3 diffuse;', 'uniform vec3 diffuse; uniform vec3 fuzzColor;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  { float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6); diffuseColor.rgb = diffuseColor.rgb * (1.0 + fr * 0.55) + fuzzColor * fr; }');
  };
  return m;
}

class CatModel {
  constructor(spec) {
    this.spec = spec; this.size = spec.size || 1;
    this.matBody = furMaterial(spec); this.matPoint = spec.points ? furMaterial(spec, true) : this.matBody;
    this.eyeMat = new THREE.MeshStandardMaterial({ map: eyeTexture(spec.eye, spec.pupil || 0.22), roughness: 0.15, metalness: 0.05, envMapIntensity: 1.2 });
    this.pink = new THREE.MeshStandardMaterial({ color: 0xd98ca0, roughness: 0.6 });
    this.group = new THREE.Group(); this.group.name = 'cat:' + spec.name;
    this.body = new THREE.Group(); this.group.add(this.body); this.body.scale.setScalar(this.size);
    this.meshes = [];
    this.buildBody(); this.buildHead(); this.buildLegs(); this.buildTail(); this.buildCollar();
    this.meshes.forEach(m => { m.castShadow = true; m.receiveShadow = true; m.userData.cat = this; });
    // contact shadow blob
    this.blob = new THREE.Mesh(G.plane(0.55 * this.size, 0.4 * this.size), M.blob.clone()); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.004; this.blob.renderOrder = 2; this.group.add(this.blob);
    this.pose = { ...BASE_POSE }; this.target = { ...BASE_POSE }; this.poseName = 'stand';
    this.gaitPhase = 0; this.gaitWeight = 0; this.gaitStyle = 'walk'; this.speedFactor = 0;
    this.blink = 0; this.nextBlink = rand(2, 6); this.earTwitch = [0, 0]; this.nextTwitch = rand(3, 9); this.tailT = rand(100); this.breath = rand(TAU);
    this.lookYaw = 0; this.lookPitch = 0; this.lookTarget = null; this.lookWeight = 0;
    this.pawAnim = 0; this.headBob = 0;
  }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); this.meshes.push(m); return m; }
  buildBody() {
    const slim = this.spec.slim ? 0.92 : 1;
    const prof = [[0, -0.225], [0.045, -0.215], [0.08, -0.17], [0.092, -0.09], [0.096, 0.0], [0.092, 0.09], [0.088, 0.15], [0.07, 0.195], [0.035, 0.22], [0, 0.225]];
    const torso = this.mesh(G.lathe(prof, 28), this.matBody, this.body, 0, 0, 0, Math.PI / 2, 0, 0); torso.scale.set(0.94 * slim, 1, 1.0);
    this.torso = torso;
    this.mesh(G.sph(0.082, 20, 14), this.matBody, this.body, 0, 0.012, 0.13).scale.set(0.95 * slim, 0.95, 1.05);   // shoulders
    this.mesh(G.sph(0.084, 20, 14), this.matBody, this.body, 0, 0.012, -0.145).scale.set(1.0 * slim, 0.95, 1.0);  // hips
  }
  buildHead() {
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.055, 0.19); this.body.add(this.neck);
    this.mesh(G.cap(0.042, 0.06, 10), this.matBody, this.neck, 0, 0.02, 0.03, Math.PI / 2 - 0.5, 0, 0);
    this.head = new THREE.Group(); this.head.position.set(0, 0.06, 0.07); this.neck.add(this.head);
    const skull = this.mesh(G.sph(0.064, 24, 18), this.spec.points ? this.matPoint : this.matBody, this.head); skull.scale.set(1.0, 0.93, 0.98);
    if (this.spec.points) this.mesh(G.sph(0.06, 20, 14), this.matBody, this.head, 0, 0.012, -0.012).scale.set(1.0, 0.9, 0.95);  // lighter crown blends the mask
    const muz = this.mesh(G.sph(0.035, 16, 12), this.matPoint, this.head, 0, -0.018, 0.052); muz.scale.set(1.25, 0.8, 0.9);
    this.mesh(G.sph(0.03, 14, 10), this.matPoint, this.head, -0.024, -0.03, 0.042).scale.set(1, 0.8, 0.9);     // cheeks / jaw
    this.mesh(G.sph(0.03, 14, 10), this.matPoint, this.head, 0.024, -0.03, 0.042).scale.set(1, 0.8, 0.9);
    this.mesh(G.sph(0.028, 14, 10), this.matPoint, this.head, 0, -0.04, 0.035).scale.set(1.1, 0.7, 1);        // chin
    const nose = this.mesh(G.cyl(0.001, 0.011, 0.012, 3), this.pink, this.head, 0, -0.006, 0.086, Math.PI, 0, 0); nose.scale.set(1.3, 1, 0.7);
    this.eyes = [];
    [-1, 1].forEach(s => {
      const e = this.mesh(G.sph(0.0145, 18, 14), this.eyeMat, this.head, s * 0.027, 0.012, 0.047, 0, -Math.PI / 2 + s * 0.35, 0); e.castShadow = false; this.eyes.push(e);
      const lid = this.mesh(G.sph(0.0158, 14, 10, ), this.spec.points ? this.matPoint : this.matBody, this.head, s * 0.027, 0.013, 0.046); lid.scale.set(1, 0.001, 1); lid.castShadow = false; e.userData.lid = lid;
    });
    // ears
    this.ears = [];
    [-1, 1].forEach(s => {
      const eg = new THREE.Group(); eg.position.set(s * 0.038, 0.045, -0.008); eg.rotation.set(-0.15, 0, -s * 0.45); this.head.add(eg);
      const outer = this.mesh(G.cyl(0.002, 0.03, 0.06, 5), this.matPoint, eg, 0, 0.03, 0); outer.scale.set(1, 1, 0.55);
      const inner = this.mesh(G.cyl(0.001, 0.02, 0.045, 5), this.pink, eg, 0, 0.026, 0.006); inner.scale.set(1, 1, 0.4); inner.castShadow = false;
      eg.userData.s = s; this.ears.push(eg);
    });
    // whiskers
    const wm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }); const pts = [];
    [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) { const y = -0.014 + i * 0.008, a = (i - 1) * 0.25; pts.push(new THREE.Vector3(s * 0.02, y, 0.07), new THREE.Vector3(s * (0.02 + 0.075 * Math.cos(a)), y - 0.01 + Math.sin(a) * 0.04, 0.06 + 0.02 * Math.sin(a))); } });
    const wl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), wm); this.head.add(wl);
  }
  buildLegs() {
    this.legs = {};
    const mk = (name, x, z, front) => {
      const hip = new THREE.Group(); hip.position.set(x, -0.015, z); this.body.add(hip);
      const spread = new THREE.Group(); hip.add(spread);
      const upperLen = front ? 0.1 : 0.11, lowerLen = front ? 0.09 : 0.11;
      const upperR = front ? 0.03 : 0.037, lowerR = front ? 0.024 : 0.027;
      this.mesh(G.cap(upperR, upperLen, 10), front ? this.matPoint : this.matBody, spread, 0, -upperLen / 2, 0);
      if (!front) this.mesh(G.sph(0.05, 14, 10), this.matBody, spread, 0, -0.02, -0.01).scale.set(0.8, 1.1, 1.0);   // thigh mass
      const knee = new THREE.Group(); knee.position.set(0, -upperLen - 0.005, 0); spread.add(knee);
      this.mesh(G.cap(lowerR, lowerLen, 10), this.matPoint, knee, 0, -lowerLen / 2, 0);
      const foot = new THREE.Group(); foot.position.set(0, -lowerLen - 0.005, 0); knee.add(foot);
      if (!front) this.mesh(G.cap(0.022, 0.05, 8), this.matPoint, foot, 0, -0.03, 0.0);
      const pawG = new THREE.Group(); pawG.position.set(0, front ? -0.012 : -0.06, 0); foot.add(pawG);
      const paw = this.mesh(G.sph(0.027, 12, 9), this.matPoint, pawG, 0, -0.006, 0.012); paw.scale.set(1.05, 0.6, 1.35);
      this.legs[name] = { hip, spread, knee, foot, pawG, front, side: Math.sign(x) };
    };
    mk('FL', -0.058, 0.135, true); mk('FR', 0.058, 0.135, true); mk('BL', -0.062, -0.135, false); mk('BR', 0.062, -0.135, false);
  }
  buildTail() {
    this.tailBase = new THREE.Group(); this.tailBase.position.set(0, 0.03, -0.215); this.body.add(this.tailBase);
    this.tailSegs = []; let parent = this.tailBase; const n = 8;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(); g.position.set(0, 0, i === 0 ? 0 : -0.042); parent.add(g);
      const r = lerp(0.019, 0.009, i / (n - 1)); this.mesh(G.cap(r, 0.04, 8), i > 2 ? this.matPoint : this.matBody, g, 0, 0, -0.021, Math.PI / 2, 0, 0);
      this.tailSegs.push(g); parent = g;
    }
  }
  buildCollar() {
    const col = new THREE.Mesh(G.torus(0.058, 0.007, 8, 24), new THREE.MeshStandardMaterial({ color: this.spec.collar, roughness: 0.6 })); col.position.set(0, 0.035, 0.035); col.rotation.x = Math.PI / 2 - 0.4; this.neck.add(col);
    const bell = new THREE.Mesh(G.sph(0.011, 10, 8), M.brass); bell.position.set(0, -0.02, 0.08); this.neck.add(bell);
  }
  setPose(name, overrides) { this.poseName = name; const p = POSES[name] || {}; for (const k in BASE_POSE) this.target[k] = (overrides && k in overrides) ? overrides[k] : (k in p ? p[k] : BASE_POSE[k]); }
  setPoseImmediate(name) { this.setPose(name); Object.assign(this.pose, this.target); }
  // called every frame by Cat.update with the locomotion state
  animate(dt, { speed = 0, maxSpeed = 1, moving = false, mood = 'calm', airborne = false, onSurface = true } = {}) {
    const p = this.pose, t = this.target; const rate = airborne ? 9 : 6;
    for (const k in t) p[k] = damp(p[k], t[k], k === 'eyeOpen' ? 14 : rate, dt);
    // ── gait
    const s = this.size; const want = moving ? 1 : 0; this.gaitWeight = damp(this.gaitWeight, want, 6, dt);
    const style = speed > 1.5 ? 'run' : speed > 0.85 ? 'trot' : 'walk'; this.gaitStyle = style;
    const stride = style === 'run' ? 0.62 : style === 'trot' ? 0.5 : 0.42;   // metres per cycle
    if (moving) this.gaitPhase = (this.gaitPhase + (speed / (stride * s)) * dt) % 1; else if (this.gaitWeight > 0.05) { this.gaitPhase = (this.gaitPhase + dt * 0.8) % 1; }
    const gw = this.gaitWeight; const ph = this.gaitPhase;
    const amp = (style === 'run' ? 0.7 : style === 'trot' ? 0.55 : 0.42) * gw, lift = (style === 'run' ? 1.2 : 0.8) * gw;
    // walk: lateral sequence LH, LF, RH, RF ; trot/run: diagonal pairs
    const offs = style === 'walk' ? { BL: 0, FL: 0.25, BR: 0.5, FR: 0.75 } : style === 'trot' ? { BL: 0, FR: 0.05, BR: 0.5, FL: 0.55 } : { BL: 0, BR: 0.12, FL: 0.55, FR: 0.67 };
    const legAnim = {};
    for (const n of ['FL', 'FR', 'BL', 'BR']) {
      const f = (ph + offs[n]) % 1; const swing = f > 0.55 ? Math.sin(((f - 0.55) / 0.45) * Math.PI) : 0;      // swing phase lifts the leg
      const hipSwing = Math.cos(f * TAU) * amp;   // forward at touchdown
      legAnim[n] = { hip: hipSwing, knee: swing * lift, front: n[0] === 'F' };
    }
    const bob = gw * (style === 'run' ? 0.02 : 0.008) * Math.sin(ph * TAU * 2 + 0.5), roll = gw * 0.04 * Math.sin(ph * TAU);
    const pitchG = gw * (style === 'run' ? 0.14 * Math.sin(ph * TAU) : 0.02 * Math.sin(ph * TAU * 2));
    // ── body
    this.breath += dt * (mood === 'sleepy' ? 1.6 : 2.6); const breathe = Math.sin(this.breath) * (p.crouch > 0.5 ? 0.012 : 0.006);
    this.body.position.set(0, (p.bodyY + bob) * s, 0); this.body.rotation.set(-(p.bodyPitch + pitchG), 0, p.bodyRoll + roll);
    this.torso.scale.set(0.94 * (this.spec.slim ? 0.92 : 1) + breathe * 2, 1 + breathe, 1);
    this.neck.rotation.set(-p.neckPitch - pitchG * 0.5, 0, 0);
    // head: pose + look-at
    const lookW = this.lookWeight = damp(this.lookWeight, this.lookTarget ? 1 : 0, 4, dt);
    if (this.lookTarget) { const local = this.neck.worldToLocal(this.lookTarget.clone()); const yaw = Math.atan2(local.x, local.z), pitch = Math.atan2(local.y - 0.06, Math.hypot(local.x, local.z)); this.lookYaw = damp(this.lookYaw, clamp(yaw, -1.3, 1.3), 5, dt); this.lookPitch = damp(this.lookPitch, clamp(pitch, -0.7, 0.6), 5, dt); }
    else { this.lookYaw = damp(this.lookYaw, 0, 3, dt); this.lookPitch = damp(this.lookPitch, 0, 3, dt); }
    this.headBob = gw * 0.05 * Math.sin(ph * TAU * 2 + 1.5);
    this.head.rotation.set(-p.headPitch - this.lookPitch * lookW + this.headBob, p.headYaw + this.lookYaw * lookW, p.headRoll);
    // ── legs
    for (const n in this.legs) {
      const L = this.legs[n], a = legAnim[n];
      const hip = p[n + '_hip'] + a.hip, knee = p[n + '_knee'] + (L.front ? a.knee : -a.knee);
      L.hip.rotation.set(hip, 0, 0); L.spread.rotation.set(0, 0, -L.side * p[n + '_spread']);
      L.knee.rotation.set(knee, 0, 0);
      if (L.front) { L.foot.rotation.set(0, 0, 0); L.pawG.rotation.set(-(hip + knee) * 0.7 + p[n + '_paw'], 0, 0); }
      else { L.foot.rotation.set(p[n + '_foot'] + a.knee * 0.4, 0, 0); L.pawG.rotation.set(-(hip + knee + p[n + '_foot']) * 0.8, 0, 0); }
    }
    // ── tail: base pitch + curl along segments + sway wave
    this.tailT += dt * (mood === 'agitated' ? 5 : mood === 'playful' ? 3.2 : 1.2);
    const sw = p.tailSway * (mood === 'agitated' ? 2.2 : 1) * s;
    this.tailBase.rotation.set(-p.tailBase, p.tailYaw, 0);
    const n = this.tailSegs.length;
    for (let i = 0; i < n; i++) {
      const g = this.tailSegs[i]; const k = i / (n - 1);
      const curl = p.tailCurl * (0.5 + k); const wave = Math.sin(this.tailT - i * 0.55) * sw * (0.15 + k * 0.85) * 0.5;
      const flick = (i > n - 4) ? Math.sin(this.tailT * 1.7 + 2) * 0.12 * (mood === 'calm' ? 1 : 0.4) : 0;
      g.rotation.set(-curl * 0.9 + (i === 0 ? 0 : 0), wave + flick, 0);
    }
    // ── ears
    this.nextTwitch -= dt; if (this.nextTwitch < 0) { this.earTwitch[randi(0, 1)] = 1; this.nextTwitch = rand(2, 8); }
    this.ears.forEach((eg, i) => { this.earTwitch[i] = Math.max(0, this.earTwitch[i] - dt * 6); const tw = Math.sin(this.earTwitch[i] * Math.PI) * 0.5; eg.rotation.set(-0.15 - p.earPitch * 1.6 + tw * 0.4, tw * eg.userData.s * 0.5 + this.lookYaw * lookW * 0.25, -eg.userData.s * (0.45 + p.earPitch * 0.9 + p.earSpread)); });
    // ── eyes: blink + pose eyeOpen
    this.nextBlink -= dt; if (this.nextBlink < 0 && p.eyeOpen > 0.5) { this.blink = 1; this.nextBlink = rand(2.5, 7); }
    this.blink = Math.max(0, this.blink - dt * 7); const open = p.eyeOpen * (1 - Math.sin(this.blink * Math.PI));
    this.eyes.forEach(e => { e.scale.set(1, Math.max(0.05, open), 1); e.userData.lid.scale.set(1, 1 - open + 0.001, 1); });
    // ── contact shadow: fades when airborne
    this.blob.material.opacity = airborne ? 0.15 : (0.35 + 0.25 * (1 - p.crouch));
    this.blob.scale.setScalar(p.crouch > 0.5 ? 1.15 : 1);
  }
}
