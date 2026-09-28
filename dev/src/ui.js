// ─── UI glue: checklist panel, HUD, cat card, help, audio panel, checklist ↔ world hooks ──
let panelOpen = true;
function openPanel(open) {
  panelOpen = open ?? !panelOpen; document.body.classList.toggle('panel-closed', !panelOpen);
  if (panelOpen && document.pointerLockElement) document.exitPointerLock();
  const b = document.getElementById('btn-panel'); if (b) b.classList.toggle('active', panelOpen);
  W.pickList = null;
}
function setupUI() {
  document.getElementById('btn-panel').onclick = () => openPanel();
  document.getElementById('panel-tab').onclick = () => openPanel(true);
  const close = document.getElementById('panel-close'); const header = document.querySelector('.header'); if (header && close) { header.style.position = 'relative'; header.appendChild(close); close.onclick = () => openPanel(false); }
  document.getElementById('btn-camera').onclick = () => toggleCameraMode();
  document.getElementById('btn-help').onclick = () => toggleHelp();
  document.getElementById('help-close').onclick = () => closeHelp();
  document.getElementById('help-overlay').addEventListener('click', e => { if (e.target.id === 'help-overlay') closeHelp(); });
  document.getElementById('btn-classic').onclick = () => { try { store.setItem('checklist_view_mode', 'classic'); } catch (e) {} location.href = location.pathname + '?classic'; };
  document.getElementById('btn-audio').onclick = () => { initAudio(); document.getElementById('audio-panel').classList.toggle('open'); document.getElementById('outfit-panel').classList.remove('open'); };
  document.getElementById('btn-outfit').onclick = () => toggleOutfitPanel();
  document.querySelectorAll('#outfit-panel .of-btn').forEach(b => b.onclick = () => { W.avatar.setOutfit(b.dataset.outfit); syncOutfitUI(); showToast(b.dataset.outfit === 'work' ? 'Changed into work clothes' : 'Changed into casual clothes'); });
  document.querySelectorAll('#of-slacks .of-sw').forEach(b => b.onclick = () => { W.avatar.setOutfit('work', b.dataset.slack); syncOutfitUI(); });
  document.querySelectorAll('#of-shirts .of-sw').forEach(b => b.onclick = () => { W.avatar.setOutfit('work', null, b.dataset.shirt); syncOutfitUI(); });
  syncOutfitUI();
  ['master', 'ambience', 'music', 'cats'].forEach(k => { const el = document.getElementById('vol-' + k); el.value = Math.round(AU.vols[k] * 100); el.oninput = () => { AU.vols[k] = el.value / 100; applyVolumes(); }; });
  document.getElementById('vol-mute').onchange = e => { AU.muted = e.target.checked; applyVolumes(); updateAudioBtn(); };
  document.getElementById('cc-close').onclick = () => selectCat(null);
  document.getElementById('cc-follow').onclick = () => { const c = W.selectedCat; if (!c) return; if (PL.follow === c) { PL.follow = null; toggleCameraMode('fp'); } else { if (PL.mode !== 'orbit') toggleCameraMode('orbit'); PL.follow = c; PL.orbit.dist = 2.6; PL.orbit.pitch = 0.35; } updateCamLabel(); updateCard(); hint(); };
  document.getElementById('cc-call').onclick = () => { const c = W.selectedCat; if (!c) return; const to = W.playerPos ? { x: clamp(W.playerPos.x + rand(-0.4, 0.4), ROOM.x0 + 0.5, ROOM.x1 - 0.5), z: clamp(W.playerPos.z + rand(-0.4, 0.4), ROOM.z0 + 0.5, ROOM.z1 - 0.5) } : { x: clamp(c.x + rand(-1, 1), ROOM.x0 + 0.5, ROOM.x1 - 0.5), z: clamp(c.z + rand(-1, 1), ROOM.z0 + 0.5, ROOM.z1 - 0.5) }; const [tx, tz] = resolveCircle(to.x, to.z, 0.1); const tr = tossTreat({ x: tx, z: tz }); tr.fromPlayer = true; playSfx('treat'); showToast(`You offer ${c.name} a treat…`); setTimeout(() => { if (!c.air) { c.pendingEvent = { type: 'treat', x: tx, z: tz, salience: 1.5, sal: 3, treat: tr, label: 'the treat you offered' }; } }, 900); };
  // keyboard: Tab toggles the panel, M sound, H help
  window.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !isTyping() && !document.querySelector('.modal-overlay.open')) { e.preventDefault(); openPanel(); return; }
    if (isTyping()) return; const k = e.key.toLowerCase();
    if (k === 'h' || k === '?') toggleHelp();
    if (k === 'm') { initAudio(); AU.muted = !AU.muted; document.getElementById('vol-mute').checked = AU.muted; applyVolumes(); updateAudioBtn(); showToast(AU.muted ? 'Sound muted' : 'Sound on'); }
  });
  // audio starts on the first gesture (autoplay policy)
  const kick = () => { initAudio(); if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); }; window.addEventListener('pointerdown', kick, { passive: true }); window.addEventListener('keydown', kick);
  document.addEventListener('visibilitychange', () => { if (!AU.ctx) return; if (document.hidden) AU.ctx.suspend(); else AU.ctx.resume(); });
  updateAudioBtn();
}
function toggleOutfitPanel() { const p = document.getElementById('outfit-panel'); p.classList.toggle('open'); document.getElementById('audio-panel').classList.remove('open'); if (p.classList.contains('open')) { if (document.pointerLockElement) document.exitPointerLock(); if (PL.mode === 'fp') toggleCameraMode('tp'); } }
function syncOutfitUI() { const a = W.avatar; document.querySelectorAll('#outfit-panel .of-btn').forEach(b => b.classList.toggle('active', b.dataset.outfit === a.outfit)); document.querySelectorAll('#of-slacks .of-sw').forEach(b => b.classList.toggle('active', b.dataset.slack === a.slack)); document.querySelectorAll('#of-shirts .of-sw').forEach(b => b.classList.toggle('active', b.dataset.shirt === a.shirt)); }
function updateAudioBtn() { const b = document.getElementById('btn-audio'); if (b) b.innerHTML = (AU.muted ? '🔇 Muted' : '🔈 Sound') + ' <span class="kbd">M</span>'; }
function toggleHelp() { const h = document.getElementById('help-overlay'); h.classList.toggle('open'); if (h.classList.contains('open') && document.pointerLockElement) document.exitPointerLock(); }
function closeHelp() { document.getElementById('help-overlay').classList.remove('open'); }

function selectCat(cat) {
  W.selectedCat = cat; const card = document.getElementById('cat-card'); if (!cat) { card.classList.remove('show'); if (PL.follow) { PL.follow = null; updateCamLabel(); hint(); } return; }
  document.getElementById('cc-swatch').style.background = cat.spec.swatch; document.getElementById('cc-name').textContent = cat.name; document.getElementById('cc-breed').textContent = cat.spec.breed;
  const P = cat.P; const traits = []; if (P.energy > 0.7) traits.push('energetic'); if (P.laziness > 0.7) traits.push('lazy'); if (P.curiosity > 0.7) traits.push('curious'); if (P.sociability > 0.7) traits.push('social'); if (P.playfulness > 0.7) traits.push('playful'); if (P.boldness > 0.75) traits.push('bold'); if (P.boldness < 0.5) traits.push('a little shy'); if (P.sunLover > 0.8) traits.push('sun worshipper'); if (P.heightLover > 0.8) traits.push('climber'); if (P.sociability < 0.3) traits.push('aloof');
  document.getElementById('cc-traits').innerHTML = traits.map(t => `<span class="cc-trait">${t}</span>`).join(''); document.getElementById('cc-bio').textContent = P.bio;
  card.classList.add('show'); updateCard();
}
function updateCard() {
  const cat = W.selectedCat; if (!cat) return; document.getElementById('cc-activity').innerHTML = cat.activityText() + (cat.perch && cat.perch.y > 0.12 && !cat.activityDetail.includes(cat.perch.name) ? ` <span style="color:#c8b8a8">· on ${cat.perch.name}</span>` : '');
  const N = cat.needs; const rows = [['Energy', N.energy], ['Wants to play', N.play], ['Wants company', N.social], ['Curiosity', N.explore]];
  document.getElementById('cc-needs').innerHTML = rows.map(([l, v]) => `<span>${l}</span><div class="cc-bar"><i style="width:${Math.round(v * 100)}%"></i></div>`).join('');
  document.getElementById('cc-follow').textContent = PL.follow === cat ? '🎥 Stop following' : '🎥 Follow';
}
function cycleCat() { const i = W.selectedCat ? W.cats.indexOf(W.selectedCat) : -1; const c = W.cats[(i + 1) % W.cats.length]; selectCat(c); if (PL.mode !== 'orbit') toggleCameraMode('orbit'); PL.follow = c; PL.orbit.dist = 2.6; PL.orbit.pitch = 0.35; updateCamLabel(); updateCard(); hint(); }

let cardTick = 0, clockTick = 0, boardDirty = false, boardT = 0, fpsAcc = 0, fpsN = 0;
function updateUI(dt) {
  cardTick += dt; if (cardTick > 0.5) { cardTick = 0; updateCard(); }
  clockTick += dt; if (clockTick > 1) { clockTick = 0; const h = Math.floor(W.dayTime), m = Math.floor((W.dayTime % 1) * 60); const phase = W.dayTime < 6 ? 'night' : W.dayTime < 10 ? 'morning' : W.dayTime < 14 ? 'midday' : W.dayTime < 17.5 ? 'afternoon' : W.dayTime < 20 ? 'evening' : 'night'; document.getElementById('hud-clock').textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'} · ${phase}`; const f = document.getElementById('hud-fps'); if (f && fpsN) { f.textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; } }
  fpsAcc += dt; fpsN++;
  if (boardDirty) { boardT += dt; if (boardT > 0.25) { boardDirty = false; boardT = 0; refreshTaskBoard(); } }
}
Object.assign(window.Cafe3D, {
  audio: AU, playSfx, initAudio, selectCat, sitPlayer, tossTreat, brewEspresso,
  onChecklistRender() { boardDirty = true; },
  onTaskCompleted() { if (!W.active) return; ringBell(false); setTimeout(() => tossTreat(), 350); playSfx('treat'); },
});
