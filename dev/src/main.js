// ─── Boot ─────────────────────────────────────────────────────────────────────
async function bootCafe() {
  if (!document.body.classList.contains('mode-3d')) return;
  const t0 = performance.now();
  try {
    loadStatus('Loading the 3D engine…', 5);
    const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('Three.js download timed out')), ms));
    const [three, bgu, renv, rbg] = await Promise.race([Promise.all([import('three'), import('three/addons/utils/BufferGeometryUtils.js'), import('three/addons/environments/RoomEnvironment.js'), import('three/addons/geometries/RoundedBoxGeometry.js')]), timeout(25000)]);
    THREE = three; mergeGeometries = bgu.mergeGeometries; RoomEnvironment = renv.RoomEnvironment; RoundedBoxGeometry = rbg.RoundedBoxGeometry;
    const container = document.getElementById('cafe3d');
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    W.renderer = renderer; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    W.scene = new THREE.Scene(); W.scene.fog = new THREE.Fog(0xdcd3c2, 28, 90);
    W.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 120);
    const pmrem = new THREE.PMREMGenerator(renderer); W.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; W.scene.environmentIntensity = 0.45; pmrem.dispose();
    W.clock = new THREE.Clock();
    loadStatus('Sanding the floorboards…', 20); await nextFrame(); await buildMaterials();
    loadStatus('Arranging the furniture…', 45); await nextFrame(); buildWorld();
    loadStatus('Mapping the floor for the cats…', 65); await nextFrame(); buildNavGrid();
    loadStatus('Waking up the cats…', 78); await nextFrame();
    const starts = [['marmalade', { x: 0.2, z: 2.6 }], ['smoke', { perch: 'sill' }], ['onyx', { x: -1.6, z: 3.3 }], ['pearl', { x: 3.4, z: -0.6 }], ['mochi', { perch: 'tree3' }]];
    for (const [k, s] of starts) { const c = new Cat(k, s.x ?? 0, s.z ?? 0); if (s.perch) { const p = perchById(s.perch); if (p) { c.perch = p; p.occupants.add(c); c.x = p.x; c.z = p.z; c.y = p.y; c.syncTransform(); } } c.heading = rand(TAU); W.cats.push(c); }
    document.getElementById('hud-cats').textContent = W.cats.length + ' cats';
    loadStatus('Pulling the first shot…', 92); await nextFrame();
    setupPlayer(); setupUI(); updateDaylight(); updateCamLabel(); hint(); refreshTaskBoard();
    window.addEventListener('resize', onResize);
    W.active = true; window.Cafe3D.active = true;
    renderer.setAnimationLoop(frame);
    loadStatus('Welcome in.', 100);
    setTimeout(() => { const ld = document.getElementById('cafe-loading'); if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 900); } }, 350);
    console.log('The Rose Teacup ready in', Math.round(performance.now() - t0), 'ms');
  } catch (err) {
    console.error(err);
    try { if (W.renderer) { W.renderer.setAnimationLoop(null); W.renderer.dispose(); W.renderer.domElement.remove(); } } catch (e) {}
    if (typeof enterClassicMode === 'function') enterClassicMode(err && err.message ? err.message : String(err));
  }
}
function onResize() { if (!W.renderer) return; W.camera.aspect = window.innerWidth / window.innerHeight; W.camera.updateProjectionMatrix(); W.renderer.setSize(window.innerWidth, window.innerHeight); }
let slowFrames = 0, frameCount = 0;
function frame() { stepFrame(Math.min(0.05, W.clock.getDelta())); }
window.Cafe3D.step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepFrame(dt); };
function stepFrame(dt) {
  W.dt = dt; W.time += dt; frameCount++;
  W.dayTime = (W.dayTime + W.daySpeed * dt) % 24;   // daySpeed = game-hours per real second
  updateDaylight();
  for (const c of W.cats) c.update(dt);
  updateToys(dt); updateSteam(dt); updateBird(dt); updatePedestrians(dt); updateAmbient(dt);
  updatePlayer(dt); updateAudioListener(); updateUI(dt);
  if (W.ceilingGroup) W.ceilingGroup.visible = W.camera.position.y < ROOM.h + 0.05;
  // adaptive quality: if the machine struggles, drop resolution & shadow size once
  if (frameCount > 120 && W.quality === 'high') { if (dt > 0.04) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1); if (slowFrames > 90) { W.quality = 'medium'; W.renderer.setPixelRatio(1); W.sun.shadow.mapSize.set(1024, 1024); W.sun.shadow.map && W.sun.shadow.map.dispose(); W.sun.shadow.map = null; console.log('café: switched to medium quality'); } }
  W.renderer.render(W.scene, W.camera);
}
bootCafe();
