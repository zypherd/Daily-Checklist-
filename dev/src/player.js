// ─── Player: first-person / third-person character controller, orbit & follow cameras, picking ──
const PL = { mode: 'fp', x: 0.3, z: 2.6, yaw: Math.PI * 0.05, pitch: -0.05, heading: Math.PI * 1.05, vx: 0, vz: 0, eye: 1.52, eyeCur: 1.52, crouch: false, run: false, seated: null, bobT: 0,
  tp: { yaw: Math.PI * 0.05, pitch: 0.22, dist: 2.6 }, orbit: { yaw: 0.6, pitch: 0.45, dist: 8.5, tx: -0.5, ty: 0.7, tz: 0.2 }, follow: null, keys: {}, locked: false, drag: null, blend: 1, prevPos: null, prevQuat: null, moveSpeed: 0, lastHover: 0 };
const EYE_STAND = 1.52, EYE_CROUCH = 0.95;   // a 5'4" person
window.Cafe3D.PL = PL; window.Cafe3D.M = M;

function setupPlayer() {
  const el = W.renderer.domElement; el.tabIndex = 0;
  W.avatar = new Avatar(); W.scene.add(W.avatar.group); window.Cafe3D.avatar = W.avatar;
  W.camera.position.set(PL.x, EYE_STAND, PL.z);
  document.addEventListener('pointerlockchange', () => { PL.locked = document.pointerLockElement === el; document.body.classList.toggle('pointer-locked', PL.locked); hint(); });
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return; el.focus();
    if (PL.mode === 'fp' || PL.mode === 'tp') {
      if (PL.locked) { interactCenter(); return; }
      const hit = pickAtScreen(e.clientX, e.clientY); if (hit) { doInteract(hit); return; }
      el.requestPointerLock && el.requestPointerLock();
    } else { PL.drag = { x: e.clientX, y: e.clientY, moved: 0 }; }
  });
  window.addEventListener('mousemove', e => {
    if (PL.locked && PL.mode === 'fp') { PL.yaw -= e.movementX * 0.0022; PL.pitch = clamp(PL.pitch - e.movementY * 0.0022, -1.35, 1.35); }
    else if (PL.locked && PL.mode === 'tp') { PL.tp.yaw -= e.movementX * 0.0022; PL.tp.pitch = clamp(PL.tp.pitch + e.movementY * 0.0022, -0.6, 1.2); }
    else if (PL.drag) { const dx = e.clientX - PL.drag.x, dy = e.clientY - PL.drag.y; PL.drag.x = e.clientX; PL.drag.y = e.clientY; PL.drag.moved += Math.abs(dx) + Math.abs(dy); const o = PL.orbit; o.yaw -= dx * 0.006; o.pitch = clamp(o.pitch + dy * 0.005, -0.15, 1.45); }
    else { PL.mouse = { x: e.clientX, y: e.clientY }; }
  });
  window.addEventListener('mouseup', e => { if (PL.drag) { if (PL.drag.moved < 4) { const hit = pickAtScreen(e.clientX, e.clientY); if (hit) doInteract(hit); else if (W.selectedCat) selectCat(null); } PL.drag = null; } });
  el.addEventListener('wheel', e => { if (PL.mode === 'orbit') PL.orbit.dist = clamp(PL.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 1.2, 16); else if (PL.mode === 'tp') PL.tp.dist = clamp(PL.tp.dist * (1 + Math.sign(e.deltaY) * 0.1), 1.2, 5); e.preventDefault(); }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (isTyping()) return; const k = e.key.toLowerCase();
    PL.keys[k] = true; if (k === 'shift') PL.run = true;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (PL.seated) standUp(); }
    if (k === 'c') PL.crouch = !PL.crouch;
    if (k === 'v') { toggleCameraMode(); e.preventDefault(); }
    if (k === 'r') resetCamera();
    if (k === 'n') cycleCat();
    if (k === 't') throwNearestToy();
    if (k === 'l') toggleLights();
    if (k === 'o') toggleOutfitPanel();
    if (k === 'g') cycleQuality();
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

const MODE_ORDER = ['fp', 'tp', 'orbit'];
function toggleCameraMode(mode) {
  const next = mode || MODE_ORDER[(MODE_ORDER.indexOf(PL.mode) + 1) % MODE_ORDER.length];
  if (next === PL.mode) return;
  beginCamBlend(); const prev = PL.mode; PL.mode = next; PL.follow = null;
  if (next === 'tp') { PL.tp.yaw = prev === 'fp' ? PL.yaw : Math.atan2(-Math.sin(PL.heading), -Math.cos(PL.heading)) ; PL.tp.pitch = 0.22; }
  if (next === 'fp') { PL.yaw = prev === 'tp' ? PL.tp.yaw : PL.heading + Math.PI; PL.pitch = -0.05; }
  if (next === 'orbit') { document.exitPointerLock && document.exitPointerLock(); const o = PL.orbit; const f = fpForward(); o.tx = PL.x + f.x * 3; o.tz = PL.z + f.z * 3; o.ty = 0.7; o.yaw = Math.atan2(-f.x, -f.z) + Math.PI; }
  updateCamLabel(); hint();
}
function updateCamLabel() { const l = document.getElementById('cam-mode-label'); if (l) l.textContent = PL.mode === 'fp' ? (PL.seated ? 'Seated' : 'First person') : PL.mode === 'tp' ? 'Third person' : PL.follow ? 'Following ' + PL.follow.name : 'Orbit view'; }
function resetCamera() { beginCamBlend(); PL.follow = null; if (PL.seated) standUp(); PL.x = 0.3; PL.z = 2.6; PL.yaw = Math.PI * 0.05; PL.pitch = -0.05; PL.tp.yaw = PL.yaw; PL.tp.pitch = 0.22; Object.assign(PL.orbit, { yaw: 0.6, pitch: 0.45, dist: 8.5, tx: -0.5, ty: 0.7, tz: 0.2 }); updateCamLabel(); }
function beginCamBlend() { PL.blend = 0; PL.prevPos = W.camera.position.clone(); PL.prevQuat = W.camera.quaternion.clone(); }
const inRoom = (x, z) => x > ROOM.x0 && x < ROOM.x1 && z > ROOM.z0 && z < ROOM.z1;
function fpForward() { const yaw = PL.mode === 'tp' ? PL.tp.yaw : PL.yaw; return new THREE.Vector3(-Math.sin(yaw) * Math.cos(PL.pitch), Math.sin(PL.pitch), -Math.cos(yaw) * Math.cos(PL.pitch)); }

function sitPlayer(x, z, ry, sh) {
  if (PL.seated) standUp();
  beginCamBlend(); if (PL.mode === 'orbit') PL.mode = 'tp'; PL.follow = null; PL.seated = { x, z, ry, sh, fromX: PL.x, fromZ: PL.z };
  PL.x = x; PL.z = z; PL.heading = ry; PL.yaw = ry + Math.PI; PL.pitch = -0.1; PL.tp.yaw = PL.yaw; W.playerSeat = { x, z, ry, catTaken: null };
  const perch = W.perches.find(p => Math.abs(p.x - x) < 0.3 && Math.abs(p.z - z) < 0.3); if (perch) { perch.occupants.add('player'); W.playerSeat.perch = perch; }
  playSfx('sit', { x, y: sh, z }); showToast('You sit down. Move (WASD) to stand up.'); updateCamLabel(); hint();
  setTimeout(() => { if (W.playerSeat) emitEvent({ type: 'player-sat', x, z, salience: 0.8, label: 'you sitting down' }); }, 1500);
}
function standUp() {
  if (!PL.seated) return; const s = PL.seated; beginCamBlend();
  const f = { x: Math.sin(s.ry), z: Math.cos(s.ry) }; let nx = s.x + f.x * 0.7, nz = s.z + f.z * 0.7; [nx, nz] = resolveCircle(nx, nz, 0.28, { minTop: 0.25, bounds: false }); PL.x = nx; PL.z = nz;
  if (W.playerSeat && W.playerSeat.perch) W.playerSeat.perch.occupants.delete('player'); W.playerSeat = null; PL.seated = null; updateCamLabel(); hint();
}

function updatePlayer(dt) {
  const cam = W.camera; const av = W.avatar;
  if (PL.mode === 'fp' || PL.mode === 'tp') {
    const camYaw = PL.mode === 'fp' ? PL.yaw : PL.tp.yaw;
    if (!PL.seated) {
      const k = PL.keys; let fx = 0, fz = 0;
      if (k.w || k.arrowup) fz -= 1; if (k.s || k.arrowdown) fz += 1; if (k.a || k.arrowleft) fx -= 1; if (k.d || k.arrowright) fx += 1;
      const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
      const sp = (PL.run ? 3.6 : 1.7) * (PL.crouch ? 0.55 : 1); const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
      // camera forward is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw). fz = -1 means forward.
      const wx = (fx * cy + fz * sy) * sp, wz = (-fx * sy + fz * cy) * sp;
      PL.vx = damp(PL.vx, wx, 10, dt); PL.vz = damp(PL.vz, wz, 10, dt);
      let nx = PL.x + PL.vx * dt, nz = PL.z + PL.vz * dt; [nx, nz] = resolveCircle(nx, nz, 0.26, { minTop: 0.25, bounds: false });
      nx = clamp(nx, -34, 34); nz = clamp(nz, -11.5, EXT.shoreZ + 1.4);   // the resort is yours to explore; the walls, pool and palms are obstacles
      PL.moveSpeed = Math.hypot(nx - PL.x, nz - PL.z) / Math.max(dt, 1e-4); PL.x = nx; PL.z = nz;
      // facing: first person follows the look direction; third person turns toward the movement direction
      const wantHeading = PL.mode === 'fp' ? camYaw + Math.PI : (Math.hypot(PL.vx, PL.vz) > 0.2 ? Math.atan2(PL.vx, PL.vz) : PL.heading);
      const dh = wrapAngle(wantHeading - PL.heading); PL.heading += PL.mode === 'fp' ? dh : clamp(dh, -9 * dt, 9 * dt);
      PL.bobT += dt * PL.moveSpeed * 5.2;
      if (PL.moveSpeed > 0.3) { PL.stepAcc = (PL.stepAcc || 0) + dt * PL.moveSpeed; if (PL.stepAcc > 0.72) { PL.stepAcc = 0; playSfx('step', { x: PL.x, y: 0, z: PL.z }, 0.5); } }
      PL.eye = PL.crouch ? EYE_CROUCH : EYE_STAND;
    } else { PL.eye = PL.seated.sh + 0.72; PL.moveSpeed = 0; PL.vx = PL.vz = 0; }
    PL.eyeCur = damp(PL.eyeCur, PL.eye, 8, dt);
    PL.groundCur = damp(PL.groundCur ?? 0, PL.seated ? 0 : groundY(PL.x, PL.z), 9, dt);
    // the front door swings open as you walk up to it
    if (W.door) { const d = W.door; const near = !PL.seated && Math.hypot(PL.x - (d.x - d.w / 2), PL.z - d.z) < 1.5; if (near && d.open < 0.02) playSfx('click', { x: d.x, y: 1, z: d.z }, 0.5); d.open = damp(d.open, near ? 1 : 0, near ? 3 : 1.6, dt); d.swing.rotation.y = -d.open * 1.65; }
    // the character model
    av.group.position.set(PL.x, PL.groundCur, PL.z); av.group.rotation.y = PL.heading;
    const rel = PL.mode === 'tp' ? wrapAngle(PL.tp.yaw + Math.PI - PL.heading) : 0; const headYaw = Math.abs(rel) < 1.5 ? rel * 0.5 : 0;   // glance where the camera looks, unless it's facing her
    av.animate(dt, { speed: PL.moveSpeed, moving: PL.moveSpeed > 0.15, seated: !!PL.seated, seatH: PL.seated ? PL.seated.sh : 0, crouch: PL.crouch && !PL.seated, headYaw, headPitch: PL.mode === 'fp' ? PL.pitch : 0, hideHead: PL.mode === 'fp' });
    av.group.visible = true;
    if (PL.mode === 'fp') {
      const bob = Math.sin(PL.bobT) * 0.014 * clamp(PL.moveSpeed / 2, 0, 1); const sway = Math.sin(PL.bobT * 0.5) * 0.006 * clamp(PL.moveSpeed / 2, 0, 1);
      const desired = new THREE.Vector3(PL.x - Math.sin(PL.yaw) * 0.06 + Math.cos(PL.yaw) * sway, PL.groundCur + PL.eyeCur + bob, PL.z - Math.cos(PL.yaw) * 0.06 - Math.sin(PL.yaw) * sway);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PL.pitch, PL.yaw, 0, 'YXZ')); applyCam(desired, q, dt);
    } else {
      const t = PL.tp; const headY = PL.groundCur + (PL.seated ? PL.seated.sh + 0.75 : (PL.crouch ? 1.15 : 1.5));
      const target = new THREE.Vector3(PL.x, headY + 0.05, PL.z);
      let px = PL.x + Math.sin(t.yaw) * Math.cos(t.pitch) * t.dist, py = headY + 0.05 + Math.sin(t.pitch) * t.dist, pz = PL.z + Math.cos(t.yaw) * Math.cos(t.pitch) * t.dist;
      if (inRoom(PL.x, PL.z)) { px = clamp(px, ROOM.x0 + 0.2, ROOM.x1 - 0.2); pz = clamp(pz, ROOM.z0 + 0.2, ROOM.z1 - 0.2); py = clamp(py, 0.35, ROOM.h - 0.15); }
      else py = Math.max(py, groundY(px, pz) + 0.35);
      // don't let furniture sit between the camera and the character: shorten when the camera point is inside an obstacle
      const [cx2, cz2] = resolveCircle(px, pz, 0.15, { minTop: py - 0.05, bounds: inRoom(PL.x, PL.z) }); px = cx2; pz = cz2;
      const desired = new THREE.Vector3(px, py, pz); const m = new THREE.Matrix4().lookAt(desired, target, new THREE.Vector3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m);
      applyCam(desired, q, dt);
    }
    W.playerPos = new THREE.Vector3(PL.x, PL.groundCur + PL.eyeCur, PL.z); W.playerSpeed = PL.moveSpeed;
  } else {
    const o = PL.orbit; const k = PL.keys;
    if (PL.follow) { const c = PL.follow; o.tx = damp(o.tx, c.x, 4, dt); o.tz = damp(o.tz, c.z, 4, dt); o.ty = damp(o.ty, c.y + 0.15, 4, dt); }
    else { let fx = 0, fz = 0; if (k.w || k.arrowup) fz -= 1; if (k.s || k.arrowdown) fz += 1; if (k.a || k.arrowleft) fx -= 1; if (k.d || k.arrowright) fx += 1; const sp = 3 * dt; const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw); o.tx += (fx * cy + fz * sy) * sp; o.tz += (-fx * sy + fz * cy) * sp; o.tx = clamp(o.tx, -40, 40); o.tz = clamp(o.tz, -14, 44); if (k.q) o.ty = clamp(o.ty + dt * 1.5, -1.2, 14); if (k.e) o.ty = clamp(o.ty - dt * 1.5, -1.2, 14); }
    const d = PL.follow ? Math.min(o.dist, 3.2) : o.dist;
    let px = o.tx + Math.sin(o.yaw) * Math.cos(o.pitch) * d, py = o.ty + Math.sin(o.pitch) * d, pz = o.tz + Math.cos(o.yaw) * Math.cos(o.pitch) * d;
    if (inRoom(o.tx, o.tz) && py < ROOM.h + 0.15) { px = clamp(px, ROOM.x0 + 0.25, ROOM.x1 - 0.25); pz = clamp(pz, ROOM.z0 + 0.25, ROOM.z1 - 0.25); py = clamp(py, 0.25, ROOM.h - 0.1); }
    else { px = clamp(px, -70, 70); pz = clamp(pz, -30, 70); py = Math.max(py, groundY(px, pz) + 0.3); if (inRoom(px, pz) && py < ROOM.h + 0.15) py = ROOM.h + 0.3; }
    const desired = new THREE.Vector3(px, py, pz); const m = new THREE.Matrix4().lookAt(desired, new THREE.Vector3(o.tx, o.ty, o.tz), new THREE.Vector3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m);
    applyCam(desired, q, dt);
    av.group.position.set(PL.x, PL.groundCur || 0, PL.z); av.group.rotation.y = PL.heading; av.animate(dt, { speed: 0, moving: false, seated: !!PL.seated, seatH: PL.seated ? PL.seated.sh : 0, crouch: false, headYaw: 0, headPitch: 0, hideHead: false }); av.group.visible = true;
    W.playerPos = new THREE.Vector3(PL.x, 1.5, PL.z); W.playerSpeed = 0;
  }
  updateHover();
}
function applyCam(pos, quat, dt) {
  if (PL.blend < 1) { PL.blend = Math.min(1, PL.blend + dt / 0.85); const k = smoothstep(0, 1, PL.blend); W.camera.position.lerpVectors(PL.prevPos, pos, k); W.camera.quaternion.slerpQuaternions(PL.prevQuat, quat, k); }
  else { W.camera.position.copy(pos); W.camera.quaternion.copy(quat); }
}

// ─── Picking ──────────────────────────────────────────────────────────────────
let raycaster = null;
function pickables() { const list = []; W.interactables.forEach(i => i.mesh && list.push(i.mesh)); W.cats.forEach(c => list.push(...c.model.meshes)); W.toys.forEach(t => t.mesh.traverse(o => { if (o.isMesh) list.push(o); })); return list; }
function pickNDC(nx, ny) {
  raycaster = raycaster || new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(nx, ny), W.camera); raycaster.far = PL.mode === 'fp' ? 3.2 : PL.mode === 'tp' ? 6 : 40;
  const hits = raycaster.intersectObjects(W.pickList || (W.pickList = pickables()), false);
  for (const h of hits) { const o = h.object; if (o.userData.interact) return { kind: 'interact', it: o.userData.interact, point: h.point, dist: h.distance }; if (o.userData.cat) { const cat = W.cats.find(c => c.model === o.userData.cat); if (cat) return { kind: 'cat', cat, point: h.point, dist: h.distance }; } let p = o; while (p && !p.userData.toyObj) p = p.parent; if (p && p.userData.toyObj) return { kind: 'toy', toy: p.userData.toyObj, point: h.point, dist: h.distance }; }
  return null;
}
function pickAtScreen(cx, cy) { const r = W.renderer.domElement.getBoundingClientRect(); return pickNDC(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
function interactCenter() { const hit = pickNDC(0, 0); if (hit) doInteract(hit); }
function doInteract(hit) {
  if (hit.kind === 'cat') { selectCat(hit.cat); playSfx('select', hit.cat); if (Math.random() < 0.25 && !hit.cat.isAsleep()) playSfx(Math.random() < 0.5 ? 'meow' : 'trill', hit.cat, 0.8); hit.cat.model.lookTarget = W.playerPos ? W.playerPos.clone() : W.camera.position.clone(); hit.cat.lookTimer = 3; return; }
  if (hit.kind === 'toy') { const dir = fpDirOrView(); const from = PL.mode !== 'orbit' ? new THREE.Vector3(PL.x, 1.1, PL.z) : new THREE.Vector3(hit.toy.x, hit.toy.y + 0.5, hit.toy.z); if (PL.mode === 'orbit') { dir.set(rand(-1, 1), 0.4, rand(-1, 1)).normalize(); } tossToy(hit.toy, from, dir, PL.mode !== 'orbit' ? 3.2 : 2.2); playSfx('throw', hit.toy); showToast('Toy tossed!'); return; }
  if (hit.kind === 'interact') { if (hit.it.onClick) hit.it.onClick(hit); }
}
function fpDirOrView() { const d = new THREE.Vector3(); W.camera.getWorldDirection(d); d.y = Math.max(d.y, 0.1) + 0.25; return d.normalize(); }
function throwNearestToy() { const from = PL.mode !== 'orbit' ? new THREE.Vector3(PL.x, 1.1, PL.z) : new THREE.Vector3(PL.orbit.tx, 1.2, PL.orbit.tz); const resting = W.toys.filter(t => Math.hypot(t.vx, t.vz) < 0.1); if (!resting.length) return; const t = resting.reduce((a, b) => dist2(a.x, a.z, from.x, from.z) < dist2(b.x, b.z, from.x, from.z) ? a : b); const dir = PL.mode !== 'orbit' ? fpDirOrView() : new THREE.Vector3(rand(-1, 1), 0.5, rand(-1, 1)).normalize(); tossToy(t, from, dir, 3.0); playSfx('throw', t); showToast('You toss the ' + (t.kind === 'ball' ? 'ball' : 'toy mouse')); }
function updateHover() {
  const now = performance.now(); if (now - PL.lastHover < 90) return; PL.lastHover = now; const lab = document.getElementById('hover-label');
  let hit = null;
  if (PL.locked) hit = pickNDC(0, 0); else if (PL.mouse && !PL.drag && !anyModalOpen()) hit = pickAtScreen(PL.mouse.x, PL.mouse.y);
  if (hit && !(document.body.classList.contains('panel-closed') === false && PL.mouse && PL.mouse.x > window.innerWidth - 470)) {
    const text = hit.kind === 'cat' ? `${hit.cat.name} · click to select` : hit.kind === 'toy' ? (hit.toy.kind === 'ball' ? 'Toy ball · click to toss' : 'Toy mouse · click to toss') : hit.it.label;
    lab.textContent = text; lab.classList.add('show'); const px = PL.locked ? window.innerWidth / 2 : PL.mouse.x, py = PL.locked ? window.innerHeight / 2 - 10 : PL.mouse.y; lab.style.left = px + 'px'; lab.style.top = py + 'px';
    W.renderer.domElement.style.cursor = PL.locked ? 'none' : 'pointer';
  } else { lab.classList.remove('show'); W.renderer.domElement.style.cursor = PL.locked ? 'none' : (PL.mode === 'orbit' ? 'grab' : 'crosshair'); }
}
function hint() {
  const h = document.getElementById('hud-hint'); if (!h) return;
  if (PL.mode === 'fp' || PL.mode === 'tp') h.textContent = PL.seated ? 'You are seated · WASD to stand · look around with the mouse' : PL.locked ? 'WASD walk · Shift run · C crouch · click to interact · Esc releases the mouse' : 'Click the café to look around · WASD walk · V camera · Tab checklist · H help';
  else h.textContent = PL.follow ? `Following ${PL.follow.name} · drag to orbit · wheel to zoom · V first person` : 'Drag to orbit · wheel zoom · WASD pan · Q/E height · click a cat · V first person';
}
