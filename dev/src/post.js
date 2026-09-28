// ─── Rendering pipeline: cascaded shadows, ambient occlusion, bloom, sky reflections, light shafts, flare ──
let EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, SMAAPass, ShaderPass, CSM;
window.Cafe3D.POST = window.Cafe3D.POST || null;
const POST = window.Cafe3D.POST = { composer: null, gtao: null, bloom: null, final: null, smaa: null, csm: null, envScene: null, envAt: -99, envDay: -99, shafts: [], flare: null, quality: 'ultra', pmrem: null, slow: 0, occluders: [] };

async function loadPostModules() {
  const [ec, rp, gt, ub, op, sm, sp, csm] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'), import('three/addons/postprocessing/GTAOPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js'), import('three/addons/postprocessing/SMAAPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'), import('three/addons/csm/CSM.js')]);
  EffectComposer = ec.EffectComposer; RenderPass = rp.RenderPass; GTAOPass = gt.GTAOPass; UnrealBloomPass = ub.UnrealBloomPass; OutputPass = op.OutputPass; SMAAPass = sm.SMAAPass; ShaderPass = sp.ShaderPass; CSM = csm.CSM;
}

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.26 }, grain: { value: 0.022 }, aberration: { value: 0.0005 }, warmth: { value: 0.03 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain, aberration, warmth; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 ca = d * aberration * r2 * 8.0; vec3 col; col.r = texture2D(tDiffuse, vUv + ca).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, vUv - ca).b;
      col = mix(col, col * vec3(1.0 + warmth, 1.0, 1.0 - warmth * 0.6), 0.6);                      // gentle warm grade
      float lum = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(lum), col, 1.06);          // a touch of saturation
      col *= 1.0 - vignette * smoothstep(0.25, 1.2, r2 * 2.6);
      float n = hash(vUv * 1000.0 + fract(time) * 100.0) - 0.5; col += n * grain * (1.0 - lum * 0.6);
      gl_FragColor = vec4(col, 1.0); }`,
};

// ── cascaded shadow maps: one sun, three cascades, crisp near the camera and still present on the far beach
function setupCSM() {
  const csm = new CSM({ maxFar: 110, cascades: 3, mode: 'practical', parent: W.scene, shadowMapSize: W.quality === 'high' ? 2048 : 1024, lightDirection: new THREE.Vector3(0, -1, -0.4).normalize(), camera: W.camera, lightIntensity: 3, lightMargin: 40, lightNear: 1, lightFar: 400 });
  csm.fade = true; csm.updateFrustums();
  csm.lights.forEach(l => { l.shadow.bias = -0.00025; l.shadow.normalBias = 0.025; l.shadow.radius = 2; });
  POST.csm = csm; W.csm = csm;
}
function applyCSM(root) {   // patch every lit material once so the cascades blend correctly
  if (!POST.csm) return; const seen = new Set();
  root.traverse(o => { if (!o.isMesh && !o.isSprite) return; const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) { if (!m || seen.has(m) || m.userData.csm || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue; const prev = m.onBeforeCompile; POST.csm.setupMaterial(m); const csmHook = m.onBeforeCompile; if (prev && prev !== csmHook) m.onBeforeCompile = (shader, renderer) => { prev(shader, renderer); csmHook(shader, renderer); }; m.customProgramCacheKey = () => (m.userData.hookKey || 'std') + ':csm'; m.userData.csm = true; m.needsUpdate = true; seen.add(m); } });
}

// ── the environment map is the actual sky, re-baked as the sun moves (reflections & ambient follow the time of day)
function setupEnvironment() {
  POST.pmrem = new THREE.PMREMGenerator(W.renderer); POST.pmrem.compileEquirectangularShader();
  const s = new THREE.Scene(); const sky = new THREE.Mesh(W.sky.geometry, W.sky.material); s.add(sky);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshBasicMaterial({ color: 0xcdbfa6 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; s.add(ground); POST.envGround = ground;
  POST.envScene = s; updateEnvironment(true);
}
function updateEnvironment(force) {
  if (!POST.envScene) return; const now = performance.now();
  if (!force && (now - POST.envAt < 4000 || Math.abs(W.dayTime - POST.envDay) < 0.08)) return;
  POST.envAt = now; POST.envDay = W.dayTime;
  if (W.groundRadiance && POST.envGround) POST.envGround.material.color.copy(W.groundRadiance);
  const old = W.scene.environment; const rt = POST.pmrem.fromScene(POST.envScene, 0, 0.1, 900); W.scene.environment = rt.texture; if (old) old.dispose();
}

// ── composer
function setupComposer() {
  const r = W.renderer; const w = window.innerWidth, h = window.innerHeight; const dpr = r.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(Math.floor(w * dpr), Math.floor(h * dpr), { type: THREE.HalfFloatType, samples: POST.quality === 'medium' ? 0 : 4 });
  const composer = new EffectComposer(r, rt); composer.setPixelRatio(dpr); composer.setSize(w, h);
  composer.addPass(new RenderPass(W.scene, W.camera));
  const gtao = new GTAOPass(W.scene, W.camera, w, h); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.95;
  gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1, thickness: 1, scale: 1.1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  // glass, light shafts, sprites and other transparent things must not be rasterised into the AO depth/normal buffer
  const origOverride = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => { origOverride(); W.scene.traverse(o => { if (o.isSprite || (o.material && !Array.isArray(o.material) && o.material.transparent) || o.userData.noAO) o.visible = false; }); };
  gtao.normalMaterial.side = THREE.DoubleSide;   // fronds, thatch undersides and umbrellas seen from behind get correct normals
  gtao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(ROOM.x0 - 0.5, -0.2, ROOM.z0 - 0.5), new THREE.Vector3(ROOM.x1 + 0.5, ROOM.h + 0.3, ROOM.z1 + 0.5)));   // occlusion only inside the café (far depth is too imprecise)
  gtao.enabled = POST.quality === 'ultra'; composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const final = new ShaderPass(FinalShader); composer.addPass(final);
  const smaa = new SMAAPass(w * dpr, h * dpr); smaa.enabled = POST.quality === 'medium'; composer.addPass(smaa);
  POST.composer = composer; POST.gtao = gtao; POST.bloom = bloom; POST.final = final; POST.smaa = smaa;
}
function resizePost() { if (!POST.composer) return; const w = window.innerWidth, h = window.innerHeight, dpr = W.renderer.getPixelRatio(); POST.composer.setPixelRatio(dpr); POST.composer.setSize(w, h); POST.gtao.setSize(w, h); POST.bloom.setSize(w, h); POST.smaa.setSize(w * dpr, h * dpr); }
function setQuality(q) {
  POST.quality = q; const r = W.renderer; r.setPixelRatio(q === 'medium' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  if (POST.composer) { POST.composer.dispose && POST.composer.dispose(); setupComposer(); }
  if (POST.csm) POST.csm.lights.forEach(l => { const s = q === 'ultra' ? 2048 : q === 'high' ? 1536 : 1024; if (l.shadow.mapSize.x !== s) { l.shadow.mapSize.set(s, s); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } } });
  const b = document.getElementById('btn-quality'); if (b) b.innerHTML = `✨ ${q[0].toUpperCase() + q.slice(1)} <span class="kbd">Q</span>`;
}
function cycleQuality() { const order = ['ultra', 'high', 'medium']; setQuality(order[(order.indexOf(POST.quality) + 1) % order.length]); showToast('Graphics: ' + POST.quality + (POST.quality === 'ultra' ? ' (ambient occlusion on)' : POST.quality === 'high' ? ' (no ambient occlusion)' : ' (lighter)')); }

// ── sun light shafts through the windows + dust motes drifting in them
function makeShaft(corners, into) {          // corners: 4 world points of the window (bl, br, tr, tl); into: unit normal pointing into the room
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(8 * 3); const uv = new Float32Array(8 * 2);
  // 8 vertices: window quad (0-3) + floor quad (4-7); side faces connect them
  const idx = [0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  for (let i = 0; i < 4; i++) { uv[i * 2] = i % 2; uv[i * 2 + 1] = 0; uv[(i + 4) * 2] = i % 2; uv[(i + 4) * 2 + 1] = 1; }
  const [c, ctx] = canvas2d(4, 256); const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const mat_ = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xffe9c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat_); mesh.frustumCulled = false; mesh.renderOrder = 8; W.scene.add(mesh);
  // motes
  const n = 260; const mp = new Float32Array(n * 3); const seeds = []; for (let i = 0; i < n; i++) seeds.push({ u: Math.random(), v: Math.random(), t: Math.random(), du: rand(-0.02, 0.02), dv: rand(-0.02, 0.02), dt: rand(0.004, 0.016), ph: rand(TAU) });
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: radialTexture(32, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: 0xfff1d6, size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  motes.frustumCulled = false; motes.renderOrder = 9; W.scene.add(motes);
  const shaft = { corners, into, mesh, motes, seeds, floor: corners.map(c => c.clone()) }; POST.shafts.push(shaft); return shaft;
}
function updateShafts(dt) {
  const sunDir = W.sun.position.clone().normalize(); const dir = sunDir.clone().negate();   // direction the light travels
  const up = clamp(sunDir.y * 6, 0, 1); const camF = new THREE.Vector3(); W.camera.getWorldDirection(camF);
  const toward = 0.45 + 0.55 * Math.pow(Math.max(0, camF.dot(sunDir)), 2);                   // brighter when looking into the light
  for (const s of POST.shafts) {
    const enter = dir.dot(s.into); const strength = enter > 0.08 && dir.y < -0.05 ? up * smoothstep(0.08, 0.45, enter) * toward * W.sun.intensity / 3.4 : 0;
    s.mesh.material.opacity = damp(s.mesh.material.opacity, strength * 0.075, 4, dt); s.motes.material.opacity = damp(s.motes.material.opacity, strength * 0.55, 4, dt);
    s.mesh.material.color.copy(W.sun.color).lerp(new THREE.Color(0xffe9c4), 0.4);
    if (s.mesh.material.opacity < 0.002) { s.mesh.visible = false; s.motes.visible = false; continue; } s.mesh.visible = true; s.motes.visible = true;
    const pos = s.mesh.geometry.attributes.position.array;
    for (let i = 0; i < 4; i++) { const c = s.corners[i]; const L = Math.min(11, (c.y - 0.02) / -dir.y); const f = c.clone().addScaledVector(dir, L); s.floor[i].copy(f); pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z; pos[(i + 4) * 3] = f.x; pos[(i + 4) * 3 + 1] = f.y; pos[(i + 4) * 3 + 2] = f.z; }
    s.mesh.geometry.attributes.position.needsUpdate = true; s.mesh.geometry.computeBoundingSphere();
    const mp = s.motes.geometry.attributes.position.array; const [bl, br, tr, tl] = s.corners, [fbl, fbr, ftr, ftl] = s.floor; const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    s.seeds.forEach((m, i) => { m.t += m.dt * dt * 6; if (m.t > 1) m.t -= 1; m.u = (m.u + m.du * dt + Math.sin(W.time * 0.7 + m.ph) * 0.0006 + 1) % 1; m.v = (m.v + m.dv * dt + Math.cos(W.time * 0.5 + m.ph) * 0.0006 + 1) % 1;
      tmp.lerpVectors(bl, br, m.u).lerp(new THREE.Vector3().lerpVectors(tl, tr, m.u), m.v); tmp2.lerpVectors(fbl, fbr, m.u).lerp(new THREE.Vector3().lerpVectors(ftl, ftr, m.u), m.v); tmp.lerp(tmp2, m.t);
      mp[i * 3] = tmp.x; mp[i * 3 + 1] = tmp.y; mp[i * 3 + 2] = tmp.z; });
    s.motes.geometry.attributes.position.needsUpdate = true;
  }
}

// ── lens flare: a soft sun glow at the sun and a few ghosts mirrored through the screen centre; hidden when the sun is occluded
function setupFlare() {
  const glowTex = radialTexture(256, 'rgba(255,240,210,1)', 'rgba(255,240,210,0)');
  const ringTex = (() => { const [c, ctx] = canvas2d(128, 128); const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.35)'); g.addColorStop(0.9, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mk = (tex, scale, color, opacity) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false })); s.scale.set(scale, scale, 1); s.renderOrder = 20; W.scene.add(s); return s; };
  const glow = mk(glowTex, 1.4, 0xfff4dc, 0.9);
  const ghosts = [[0.35, 0.12, 0xffd7a8, 0.18], [0.55, 0.06, 0xa8d8ff, 0.14], [0.8, 0.22, 0xffb0a0, 0.08], [1.25, 0.09, 0xd8ffd0, 0.1], [1.6, 0.3, 0xffe0c0, 0.05]].map(([t, sc, col, op]) => ({ s: mk(ringTex, sc, col, op), t, op }));
  POST.flare = { glow, ghosts, vis: 0, lastRay: 0, ray: new THREE.Raycaster() };
}
function updateFlare(dt) {
  const F = POST.flare; if (!F) return; const cam = W.camera; const sunDir = W.sun.position.clone().normalize();
  const camF = new THREE.Vector3(); cam.getWorldDirection(camF); const facing = camF.dot(sunDir);
  let want = 0;
  if (facing > 0.2 && sunDir.y > -0.02) {
    const now = performance.now();
    if (now - F.lastRay > 120) { F.lastRay = now; F.ray.set(cam.position, sunDir); F.ray.far = 200; const hits = F.ray.intersectObjects(POST.occluders, false); F.blocked = hits.length > 0; }
    if (!F.blocked) { const sunNdc = new THREE.Vector3().copy(sunDir).multiplyScalar(100).add(cam.position).project(cam); if (Math.abs(sunNdc.x) < 1.35 && Math.abs(sunNdc.y) < 1.35) { want = smoothstep(0.2, 0.5, facing) * (1 - smoothstep(0.9, 1.35, Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y)))); F.ndc = sunNdc; } }
  }
  F.vis = damp(F.vis, want, 6, dt); const v = F.vis * clamp(W.sun.intensity / 3.4, 0, 1);
  const place = (sprite, ndcX, ndcY, dist) => { const p = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(cam); const d = p.sub(cam.position).normalize(); sprite.position.copy(cam.position).addScaledVector(d, dist); };
  if (v < 0.01 || !F.ndc) { F.glow.visible = false; F.ghosts.forEach(g => g.s.visible = false); return; }
  F.glow.visible = true; place(F.glow, F.ndc.x, F.ndc.y, 3); F.glow.material.opacity = 0.75 * v; F.glow.scale.setScalar(1.6 + 0.6 * v);
  F.ghosts.forEach(g => { g.s.visible = true; place(g.s, F.ndc.x * (1 - 2 * g.t), F.ndc.y * (1 - 2 * g.t), 2.5); g.s.material.opacity = g.op * v; });
}
function setupPost() {
  setupCSM(); setupEnvironment(); setupComposer(); setupFlare();
  // light shafts for the two front windows and the side window (corner order: bottom-left, bottom-right, top-right, top-left as seen from inside)
  const z1 = ROOM.z1 - 0.02, x0 = ROOM.x0 + 0.02; const V = (x, y, z) => new THREE.Vector3(x, y, z);
  makeShaft([V(2.2, 0.85, z1), V(5.2, 0.85, z1), V(5.2, 2.75, z1), V(2.2, 2.75, z1)], V(0, 0, -1));
  makeShaft([V(-1.4, 0.85, z1), V(1.6, 0.85, z1), V(1.6, 2.75, z1), V(-1.4, 2.75, z1)], V(0, 0, -1));
  makeShaft([V(x0, 0.7, 3.2), V(x0, 0.7, 0.2), V(x0, 2.6, 0.2), V(x0, 2.6, 3.2)], V(1, 0, 0));
  POST.occluders = []; W.scene.traverse(o => { if (o.isMesh && (o.name.startsWith('batch:') || o.name === 'ceiling' || o.parent === W.ceilingGroup) && !o.material.transparent) POST.occluders.push(o); }); if (W.ceilingGroup) W.ceilingGroup.children.forEach(c => POST.occluders.push(c));
}
function renderFrame(dt) {
  if (POST.csm) { POST.csm.update(); }
  updateEnvironment(false); updateShafts(dt); updateFlare(dt);
  if (POST.final) POST.final.uniforms.time.value = W.time;
  if (POST.composer) POST.composer.render(); else W.renderer.render(W.scene, W.camera);
}
