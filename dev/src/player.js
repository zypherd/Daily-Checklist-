// ─── Player: first-person walk, orbit / follow cameras, picking & interaction ──
const PL = { mode: 'fp', x: 0.3, z: 2.6, yaw: Math.PI * 0.05, pitch: -0.05, vx: 0, vz: 0, eye: 1.62, eyeCur: 1.62, crouch: false, run: false, seated: null, bobT: 0,
  orbit: { yaw: 0.6, pitch: 0.45, dist: 8.5, tx: -0.5, ty: 0.7, tz: 0.2 }, follow: null, keys: {}, locked: false, drag: null, blend: 1, prevPos: null, prevQuat: null, moveSpeed: 0, lastHover: 0 };

window.Cafe3D.PL = PL; window.Cafe3D.M = M;
function setupPlayer() {
  const el = W.renderer.domElement; el.tabIndex = 0;
  W.camera.position.set(PL.x, PL.eye, PL.z);
  document.addEventListener('pointerlockchange', () => { PL.locked = document.pointerLockElement === el; document.body.classList.toggle('pointer-locked', PL.locked); hint(); });
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return; el.focus();
    if (PL.mode === 'fp') {
      if (PL.locked) { interactCenter(); return; }
      const hit = pickAtScreen(e.clientX, e.clientY); if (hit) { doInteract(hit); return; }
      el.requestPointerLock && el.requestPointerLock();
    } else { PL.drag = { x: e.clientX, y: e.clientY, moved: 0 }; }
  });
  window.addEventListener('mousemove', e => {
    if (PL.mode === 'fp' && PL.locked) { PL.yaw -= e.movementX * 0.0022; PL.pitch = clamp(PL.pitch - e.movementY * 0.0022, -1.35, 1.35); }
    else if (PL.drag) { const dx = e.clientX - PL.drag.x, dy = e.clientY - PL.drag.y; PL.drag.x = e.clientX; PL.drag.y = e.clientY; PL.drag.moved += Math.abs(dx) + Math.abs(dy); const o = PL.orbit; o.yaw -= dx * 0.006; o.pitch = clamp(o.pitch + dy * 0.005, -0.15, 1.45); }
    else { PL.mouse = { x: e.clientX, y: e.clientY }; }
  });
  window.addEventListener('mouseup', e => { if (PL.drag) { if (PL.drag.moved < 4) { const hit = pickAtScreen(e.clientX, e.clientY); if (hit) doInteract(hit); else if (W.selectedCat) selectCat(null); } PL.drag = null; } });
  el.addEventListener('wheel', e => { if (PL.mode !== 'fp') { PL.orbit.dist = clamp(PL.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 1.2, 16); e.preventDefault(); } }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (isTyping()) return; const k = e.key.toLowerCase();
    PL.keys[k] = true; if (k === 'shift') PL.run = true;
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') { if (PL.seated) standUp(); }
    if (k === 'c') PL.crouch = !PL.crouch;
    if (k === 'v') { toggleCameraMode(); e.preventDefault(); }
    if (k === 'r') resetCamera();
    if (k === 'n') cycleCat();
    if (k === 't') throwNearestToy();
    if (k === 'l') toggleLights();
    if (k === '[') { W.daySpeed = clamp(W.daySpeed / 2, 1 / 800, 1 / 3); showToast('Day speed: ' + describeDaySpeed()); }
    if (k === ']') { W.daySpeed = clamp(W.daySpeed * 2, 1 / 800, 1 / 3); showToast('Day speed: ' + describeDaySpeed()); }
    if (k === 'escape') { selectCat(null); closeHelp(); }
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); PL.keys[k] = false; if (k === 'shift') PL.run = false; });
  window.addEventListener('blur', () => { PL.keys = {}; PL.run = false; });
}
const describeDaySpeed = () => { const mins = Math.round(24 / W.daySpeed / 60); return mins >= 60 ? `a day every ${Math.round(mins / 60)} h` : `a day every ${mins} min`; };
function isTyping() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable); }
function anyModalOpen() { return !!document.querySelector('.modal-overlay.open') || document.getElementById('help-overlay').classList.contains('open'); }

function toggleCameraMode(mode) {
  const next = mode || (PL.mode === 'fp' ? 'orbit' : 'fp');
  if (next === PL.mode) return;
  beginCamBlend(); PL.mode = next; PL.follow = null;
  if (next === 'fp') { if (document.pointerLockElement !== W.renderer.domElement) { /* user clicks to lock */ } }
  else { document.exitPointerLock && document.exitPointerLock(); const o = PL.orbit; const f = fpForward(); o.tx = PL.x + f.x * 3; o.tz = PL.z + f.z * 3; o.ty = 0.7; o.yaw = Math.atan2(-f.x, -f.z) + Math.PI; }
  updateCamLabel(); hint();
}
function updateCamLabel() { const l = document.getElementById('cam-mode-label'); if (l) l.textContent = PL.mode === 'fp' ? (PL.seated ? 'Seated' : 'First person') : PL.follow ? 'Following ' + PL.follow.name : 'Orbit view'; }
function resetCamera() { beginCamBlend(); PL.follow = null; if (PL.seated) standUp(); PL.x = 0.3; PL.z = 2.6; PL.yaw = Math.PI * 0.05; PL.pitch = -0.05; Object.assign(PL.orbit, { yaw: 0.6, pitch: 0.45, dist: 8.5, tx: -0.5, ty: 0.7, tz: 0.2 }); updateCamLabel(); }
function beginCamBlend() { PL.blend = 0; PL.prevPos = W.camera.position.clone(); PL.prevQuat = W.camera.quaternion.clone(); }
function fpForward() { return new THREE.Vector3(-Math.sin(PL.yaw) * Math.cos(PL.pitch), Math.sin(PL.pitch), -Math.cos(PL.yaw) * Math.cos(PL.pitch)); }

function sitPlayer(x, z, ry, sh) {
  if (PL.seated) standUp();
  beginCamBlend(); PL.mode = 'fp'; PL.follow = null; PL.seated = { x, z, ry, sh, fromX: PL.x, fromZ: PL.z };
  PL.x = x; PL.z = z; PL.yaw = ry + Math.PI; PL.pitch = -0.1; W.playerSeat = { x, z, ry, catTaken: null };
  const perch = W.perches.find(p => Math.abs(p.x - x) < 0.3 && Math.abs(p.z - z) < 0.3); if (perch) { perch.occupants.add('player'); W.playerSeat.perch = perch; }
  playSfx('sit', { x, y: sh, z }); showToast('You sit down. Move (WASD) to stand up.'); updateCamLabel(); hint();
  setTimeout(() => { if (W.playerSeat) emitEvent({ type: 'player-sat', x, z, salience: 0.8, label: 'you sitting down' }); }, 1500);
}
function standUp() {
  if (!PL.seated) return; const s = PL.seated; beginCamBlend();
  const f = { x: Math.sin(s.ry), z: Math.cos(s.ry) }; let nx = s.x + f.x * 0.7, nz = s.z + f.z * 0.7; [nx, nz] = resolveCircle(nx, nz, 0.28, { minTop: 0.25 }); PL.x = nx; PL.z = nz;
  if (W.playerSeat && W.playerSeat.perch) W.playerSeat.perch.occupants.delete('player'); W.playerSeat = null; PL.seated = null; updateCamLabel(); hint();
}

function updatePlayer(dt) {
  const cam = W.camera;
  if (PL.mode === 'fp') {
    if (!PL.seated) {
      const k = PL.keys; let fx = 0, fz = 0;
      if (k.w || k.arrowup) fz -= 1; if (k.s || k.arrowdown) fz += 1; if (k.a || k.arrowleft) fx -= 1; if (k.d || k.arrowright) fx += 1;
      const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
      const sp = (PL.run ? 3.4 : 1.9) * (PL.crouch ? 0.6 : 1); const cy = Math.cos(PL.yaw), sy = Math.sin(PL.yaw);
      const wx = (fx * cy - fz * sy) * sp, wz = (fx * sy + fz * cy) * sp;   // local → world (camera forward = -z)
      PL.vx = damp(PL.vx, wx, 10, dt); PL.vz = damp(PL.vz, wz, 10, dt);
      let nx = PL.x + PL.vx * dt, nz = PL.z + PL.vz * dt; [nx, nz] = resolveCircle(nx, nz, 0.28, { minTop: 0.25 });
      nx = clamp(nx, ROOM.x0 + 0.4, ROOM.x1 - 0.4); nz = clamp(nz, ROOM.z0 + 0.4, ROOM.z1 - 0.4);
      PL.moveSpeed = Math.hypot(nx - PL.x, nz - PL.z) / Math.max(dt, 1e-4); PL.x = nx; PL.z = nz;
      PL.bobT += dt * PL.moveSpeed * 5.5;
      // step sounds
      if (PL.moveSpeed > 0.3) { PL.stepAcc = (PL.stepAcc || 0) + dt * PL.moveSpeed; if (PL.stepAcc > 0.7) { PL.stepAcc = 0; playSfx('step', { x: PL.x, y: 0, z: PL.z }, 0.5); } }
      PL.eye = PL.crouch ? 0.85 : 1.62;
    } else { PL.eye = PL.seated.sh + 0.72; PL.moveSpeed = 0; PL.vx = PL.vz = 0; }
    PL.eyeCur = damp(PL.eyeCur, PL.eye, 8, dt);
    const bob = Math.sin(PL.bobT) * 0.012 * clamp(PL.moveSpeed / 2, 0, 1);
    const desired = new THREE.Vector3(PL.x, PL.eyeCur + bob, PL.z); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PL.pitch, PL.yaw, 0, 'YXZ'));
    applyCam(desired, q, dt);
    W.playerPos = cam.position; W.playerSpeed = PL.moveSpeed;
  } else {
    const o = PL.orbit; const k = PL.keys;
    if (PL.follow) { const c = PL.follow; o.tx = damp(o.tx, c.x, 4, dt); o.tz = damp(o.tz, c.z, 4, dt); o.ty = damp(o.ty, c.y + 0.15, 4, dt); }
    else { let fx = 0, fz = 0; if (k.w || k.arrowup) fz -= 1; if (k.s || k.arrowdown) fz += 1; if (k.a || k.arrowleft) fx -= 1; if (k.d || k.arrowright) fx += 1; const sp = 3 * dt; o.tx += (fx * Math.cos(o.yaw) - fz * Math.sin(o.yaw)) * sp; o.tz += (fx * Math.sin(o.yaw) + fz * Math.cos(o.yaw)) * sp; o.tx = clamp(o.tx, ROOM.x0, ROOM.x1); o.tz = clamp(o.tz, ROOM.z0, ROOM.z1); if (k.q) o.ty = clamp(o.ty + dt * 1.5, 0.1, 3); if (k.e) o.ty = clamp(o.ty - dt * 1.5, 0.1, 3); }
    const d = PL.follow ? Math.min(o.dist, 3.2) : o.dist;
    let px = o.tx + Math.sin(o.yaw) * Math.cos(o.pitch) * d, py = o.ty + Math.sin(o.pitch) * d, pz = o.tz + Math.cos(o.yaw) * Math.cos(o.pitch) * d;
    // keep the camera inside the room unless it's above the ceiling (dollhouse view)
    if (py < ROOM.h + 0.15) { px = clamp(px, ROOM.x0 + 0.25, ROOM.x1 - 0.25); pz = clamp(pz, ROOM.z0 + 0.25, ROOM.z1 - 0.25); py = clamp(py, 0.25, ROOM.h - 0.1); }
    else { px = clamp(px, -14, 14); pz = clamp(pz, -12, 14); }
    const desired = new THREE.Vector3(px, py, pz); const m = new THREE.Matrix4().lookAt(desired, new THREE.Vector3(o.tx, o.ty, o.tz), new THREE.Vector3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m);
    applyCam(desired, q, dt);
    W.playerPos = null; W.playerSpeed = 0;
  }
  updateHover();
}
function applyCam(pos, quat, dt) {
  if (PL.blend < 1) { PL.blend = Math.min(1, PL.blend + dt / 0.85); const k = smoothstep(0, 1, PL.blend); W.camera.position.lerpVectors(PL.prevPos, pos, k); W.camera.quaternion.slerpQuaternions(PL.prevQuat, quat, k); }
  else { W.camera.position.copy(pos); W.camera.quaternion.copy(quat); }
}

// ─── Picking ──────────────────────────────────────────────────────────────────
const _ray = () => new THREE.Raycaster();
let raycaster = null;
function pickables() { const list = []; W.interactables.forEach(i => i.mesh && list.push(i.mesh)); W.cats.forEach(c => list.push(...c.model.meshes)); W.toys.forEach(t => t.mesh.traverse(o => { if (o.isMesh) list.push(o); })); return list; }
function pickNDC(nx, ny) {
  raycaster = raycaster || _ray(); raycaster.setFromCamera(new THREE.Vector2(nx, ny), W.camera); raycaster.far = PL.mode === 'fp' ? 3.2 : 40;
  const hits = raycaster.intersectObjects(W.pickList || (W.pickList = pickables()), false);
  for (const h of hits) { const o = h.object; if (o.userData.interact) return { kind: 'interact', it: o.userData.interact, point: h.point, dist: h.distance }; if (o.userData.cat) { const cat = W.cats.find(c => c.model === o.userData.cat); if (cat) return { kind: 'cat', cat, point: h.point, dist: h.distance }; } let p = o; while (p && !p.userData.toyObj) p = p.parent; if (p && p.userData.toyObj) return { kind: 'toy', toy: p.userData.toyObj, point: h.point, dist: h.distance }; }
  return null;
}
function pickAtScreen(cx, cy) { const r = W.renderer.domElement.getBoundingClientRect(); return pickNDC(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
function interactCenter() { const hit = pickNDC(0, 0); if (hit) doInteract(hit); }
function doInteract(hit) {
  if (hit.kind === 'cat') { selectCat(hit.cat); playSfx('select', hit.cat); if (Math.random() < 0.25 && !hit.cat.isAsleep()) playSfx(Math.random() < 0.5 ? 'meow' : 'trill', hit.cat, 0.8); hit.cat.model.lookTarget = W.camera.position.clone(); hit.cat.lookTimer = 3; return; }
  if (hit.kind === 'toy') { const dir = fpDirOrView(); const from = PL.mode === 'fp' ? new THREE.Vector3(W.camera.position.x, 1.1, W.camera.position.z) : new THREE.Vector3(hit.toy.x, hit.toy.y + 0.5, hit.toy.z); if (PL.mode !== 'fp') { dir.set(rand(-1, 1), 0.4, rand(-1, 1)).normalize(); } tossToy(hit.toy, from, dir, PL.mode === 'fp' ? 3.2 : 2.2); playSfx('throw', hit.toy); showToast('Toy tossed!'); return; }
  if (hit.kind === 'interact') { if (hit.it.onClick) hit.it.onClick(hit); }
}
function fpDirOrView() { const d = new THREE.Vector3(); W.camera.getWorldDirection(d); d.y = Math.max(d.y, 0.1) + 0.25; return d.normalize(); }
function throwNearestToy() { const from = PL.mode === 'fp' ? new THREE.Vector3(W.camera.position.x, 1.1, W.camera.position.z) : new THREE.Vector3(PL.orbit.tx, 1.2, PL.orbit.tz); const resting = W.toys.filter(t => Math.hypot(t.vx, t.vz) < 0.1); if (!resting.length) return; const t = resting.reduce((a, b) => dist2(a.x, a.z, from.x, from.z) < dist2(b.x, b.z, from.x, from.z) ? a : b); const dir = PL.mode === 'fp' ? fpDirOrView() : new THREE.Vector3(rand(-1, 1), 0.5, rand(-1, 1)).normalize(); tossToy(t, from, dir, 3.0); playSfx('throw', t); showToast('You toss the ' + (t.kind === 'ball' ? 'ball' : 'toy mouse')); }
function updateHover() {
  const now = performance.now(); if (now - PL.lastHover < 90) return; PL.lastHover = now; const lab = document.getElementById('hover-label');
  let hit = null;
  if (PL.mode === 'fp' && PL.locked) hit = pickNDC(0, 0); else if (PL.mouse && !PL.drag && !anyModalOpen()) hit = pickAtScreen(PL.mouse.x, PL.mouse.y);
  if (hit && !(document.body.classList.contains('panel-closed') === false && PL.mouse && PL.mouse.x > window.innerWidth - 470)) {
    const text = hit.kind === 'cat' ? `${hit.cat.name} · click to select` : hit.kind === 'toy' ? (hit.toy.kind === 'ball' ? 'Toy ball · click to toss' : 'Toy mouse · click to toss') : hit.it.label;
    lab.textContent = text; lab.classList.add('show'); const px = PL.locked ? window.innerWidth / 2 : PL.mouse.x, py = PL.locked ? window.innerHeight / 2 - 10 : PL.mouse.y; lab.style.left = px + 'px'; lab.style.top = py + 'px';
    W.renderer.domElement.style.cursor = PL.locked ? 'none' : 'pointer';
  } else { lab.classList.remove('show'); W.renderer.domElement.style.cursor = PL.locked ? 'none' : (PL.mode === 'fp' ? 'crosshair' : 'grab'); }
}
function hint() {
  const h = document.getElementById('hud-hint'); if (!h) return;
  if (PL.mode === 'fp') h.textContent = PL.seated ? 'You are seated · WASD to stand · look around with the mouse' : PL.locked ? 'WASD walk · Shift run · C crouch · click to interact · Esc releases the mouse' : 'Click the café to look around · WASD walk · Tab checklist · H help';
  else h.textContent = PL.follow ? `Following ${PL.follow.name} · drag to orbit · wheel to zoom · V first person` : 'Drag to orbit · wheel zoom · WASD pan · Q/E height · click a cat · V first person';
}
