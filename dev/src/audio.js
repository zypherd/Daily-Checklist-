// ─── Audio: everything is synthesized with the Web Audio API (no recordings, nothing to license) ──
const AU = { ctx: null, started: false, muted: false, vols: { master: 0.7, ambience: 0.7, music: 0.45, cats: 0.8 }, noise: null, ir: null, lastCat: {}, lastGlobal: {} };

function initAudio() {
  if (AU.started) return; AU.started = true;
  try {
    const ctx = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.master = ctx.createGain(); AU.master.connect(ctx.destination);
    AU.bus = {}; for (const b of ['ambience', 'music', 'cats', 'sfx']) { const g = ctx.createGain(); g.connect(AU.master); AU.bus[b] = g; }
    // simple synthetic room reverb
    const len = ctx.sampleRate * 1.6; const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8) * 0.5; }
    AU.reverb = ctx.createConvolver(); AU.reverb.buffer = ir; AU.reverbGain = ctx.createGain(); AU.reverbGain.gain.value = 0.28; AU.reverb.connect(AU.reverbGain); AU.reverbGain.connect(AU.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; AU.noise = nb;
    applyVolumes(); startAmbience(); startMusic();
  } catch (e) { console.warn('audio unavailable', e); AU.ctx = null; }
}
function applyVolumes() { if (!AU.ctx) return; const v = AU.vols; AU.master.gain.setTargetAtTime(AU.muted ? 0 : v.master, AU.ctx.currentTime, 0.05); AU.bus.ambience.gain.value = v.ambience; AU.bus.music.gain.value = v.music * 0.55; AU.bus.cats.gain.value = v.cats; AU.bus.sfx.gain.value = 0.9; }
function panner(pos) { const ctx = AU.ctx; const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1.1; p.maxDistance = 40; const x = pos.x ?? 0, y = pos.y ?? 0.2, z = pos.z ?? 0; if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); return p; }
function updateAudioListener() {
  if (!AU.ctx) return; const L = AU.ctx.listener; const c = W.camera; const f = new THREE.Vector3(); c.getWorldDirection(f); const up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
  if (L.positionX) { const t = AU.ctx.currentTime; L.positionX.setTargetAtTime(c.position.x, t, 0.05); L.positionY.setTargetAtTime(c.position.y, t, 0.05); L.positionZ.setTargetAtTime(c.position.z, t, 0.05); L.forwardX.setTargetAtTime(f.x, t, 0.05); L.forwardY.setTargetAtTime(f.y, t, 0.05); L.forwardZ.setTargetAtTime(f.z, t, 0.05); L.upX.setTargetAtTime(up.x, t, 0.05); L.upY.setTargetAtTime(up.y, t, 0.05); L.upZ.setTargetAtTime(up.z, t, 0.05); }
  else { L.setPosition(c.position.x, c.position.y, c.position.z); L.setOrientation(f.x, f.y, f.z, up.x, up.y, up.z); }
}
function noiseSrc() { const s = AU.ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true; return s; }
function env(g, t, a, peak, d, sus, r, end) { const p = g.gain; p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); p.setValueAtTime(Math.max(sus, 0.0001), t + end); p.exponentialRampToValueAtTime(0.0001, t + end + r); }
function burst({ pos, bus = 'sfx', type = 'noise', freq = 1000, q = 1, filter = 'bandpass', gain = 0.3, a = 0.005, d = 0.08, dur = 0.1, r = 0.08, sweep = null, osc = 'sine', reverb = 0.3, delay = 0 }) {
  const ctx = AU.ctx; if (!ctx) return; const t = ctx.currentTime + delay; let src;
  if (type === 'noise') { src = noiseSrc(); } else { src = ctx.createOscillator(); src.type = osc; src.frequency.setValueAtTime(freq, t); if (sweep) { src.frequency.exponentialRampToValueAtTime(sweep[0], t + sweep[1]); if (sweep[2]) src.frequency.exponentialRampToValueAtTime(sweep[2], t + sweep[3]); } }
  const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); env(g, t, a, gain, d, gain * 0.4, r, dur);
  src.connect(type === 'noise' ? f : g); if (type === 'noise') f.connect(g);
  const out = pos ? panner(pos) : ctx.createGain(); g.connect(out); out.connect(AU.bus[bus]); if (reverb) { const rg = ctx.createGain(); rg.gain.value = reverb; out.connect(rg); rg.connect(AU.reverb); }
  src.start(t); src.stop(t + dur + r + 0.1);
}
function playSfx(name, pos, mul = 1) {
  if (!AU.ctx || AU.muted) return; const P = pos ? { x: pos.x, y: pos.y ?? 0.2, z: pos.z } : null; const now = AU.ctx.currentTime;
  // rate limiting per sound so nothing machine-guns
  const lim = { purr: 4, meow: 6, trill: 2, chatter: 4, scratch: 0.1, step: 0.2, chirp: 0.5 }[name] ?? 0.05; if (AU.lastGlobal[name] && now - AU.lastGlobal[name] < lim) return; AU.lastGlobal[name] = now;
  switch (name) {
    case 'step': burst({ pos: P, type: 'noise', freq: 300, q: 0.8, filter: 'lowpass', gain: 0.12 * mul, d: 0.05, dur: 0.03, r: 0.05, reverb: 0.2 }); break;
    case 'land': burst({ pos: P, bus: 'cats', type: 'noise', freq: 220, filter: 'lowpass', gain: 0.18 * mul, d: 0.06, dur: 0.04, r: 0.06 }); break;
    case 'jump': burst({ pos: P, bus: 'cats', type: 'noise', freq: 500, filter: 'lowpass', gain: 0.07, d: 0.05, dur: 0.03, r: 0.05 }); break;
    case 'scamper': for (let i = 0; i < 5; i++) burst({ pos: P, bus: 'cats', type: 'noise', freq: 400, filter: 'lowpass', gain: 0.08, d: 0.04, dur: 0.02, r: 0.04, delay: i * 0.11 }); break;
    case 'bat': burst({ pos: P, bus: 'cats', type: 'noise', freq: 900, q: 1.2, gain: 0.14, d: 0.04, dur: 0.02, r: 0.05 }); break;
    case 'toyBounce': burst({ pos: P, type: 'osc', osc: 'sine', freq: 320, sweep: [180, 0.08], gain: 0.12 * mul, d: 0.05, dur: 0.03, r: 0.06 }); break;
    case 'throw': burst({ pos: P, type: 'noise', freq: 1500, q: 0.5, gain: 0.05, d: 0.1, dur: 0.05, r: 0.1 }); break;
    case 'scratch': for (let i = 0; i < 3; i++) burst({ pos: P, bus: 'cats', type: 'noise', freq: 1900, q: 1.6, gain: 0.09, d: 0.05, dur: 0.06, r: 0.04, delay: i * 0.09 }); break;
    case 'purr': { const ctx = AU.ctx; const t = now; const src = noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; const am = ctx.createGain(); am.gain.value = 0; const lfo = ctx.createOscillator(); lfo.frequency.value = 24; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain); const base = ctx.createConstantSource(); base.offset.value = 0.5; base.connect(am.gain); const g = ctx.createGain(); env(g, t, 0.6, 0.35 * mul, 0.5, 0.3 * mul, 1.2, 3.2); src.connect(f); f.connect(am); am.connect(g); const out = P ? panner(P) : ctx.createGain(); g.connect(out); out.connect(AU.bus.cats); src.start(t); lfo.start(t); base.start(t); src.stop(t + 5); lfo.stop(t + 5); base.stop(t + 5); break; }
    case 'meow': { const ctx = AU.ctx; const t = now; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(640, t + 0.18); o.frequency.exponentialRampToValueAtTime(420, t + 0.62); const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 2.5; f1.frequency.setValueAtTime(900, t); f1.frequency.linearRampToValueAtTime(1500, t + 0.25); f1.frequency.linearRampToValueAtTime(1000, t + 0.6); const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 2600; const g = ctx.createGain(); env(g, t, 0.05, 0.18 * mul, 0.2, 0.12 * mul, 0.15, 0.55); o.connect(f1); f1.connect(f2); f2.connect(g); const out = P ? panner(P) : ctx.createGain(); g.connect(out); out.connect(AU.bus.cats); const rg = ctx.createGain(); rg.gain.value = 0.3; out.connect(rg); rg.connect(AU.reverb); o.start(t); o.stop(t + 1); break; }
    case 'trill': { const ctx = AU.ctx; const t = now; const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.3); const am = ctx.createGain(); const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain); am.gain.value = 0.5; const g = ctx.createGain(); env(g, t, 0.03, 0.12 * mul, 0.1, 0.08, 0.1, 0.3); o.connect(am); am.connect(g); const out = P ? panner(P) : ctx.createGain(); g.connect(out); out.connect(AU.bus.cats); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6); break; }
    case 'chatter': for (let i = 0; i < 7; i++) burst({ pos: P, bus: 'cats', type: 'osc', osc: 'square', freq: 700 + i * 30, gain: 0.03, d: 0.02, dur: 0.01, r: 0.02, delay: i * 0.07 }); break;
    case 'crunch': for (let i = 0; i < 4; i++) burst({ pos: P, bus: 'cats', type: 'noise', freq: 2400, q: 1.0, gain: 0.08, d: 0.03, dur: 0.02, r: 0.03, delay: i * 0.22 }); break;
    case 'chirp': for (let i = 0; i < 3; i++) burst({ pos: P, type: 'osc', osc: 'sine', freq: 2900, sweep: [4300, 0.06, 3200, 0.1], gain: 0.05, d: 0.06, dur: 0.05, r: 0.05, delay: i * 0.16 }); break;
    case 'flutter': for (let i = 0; i < 6; i++) burst({ pos: P, type: 'noise', freq: 1200, q: 0.8, gain: 0.05, d: 0.03, dur: 0.02, r: 0.03, delay: i * 0.06 }); break;
    case 'bell': { const ctx = AU.ctx; const t = now; [[2093, 0.35], [5274, 0.12], [3520, 0.08], [8372, 0.03]].forEach(([f, g0]) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(g0 * mul, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(g); const out = P ? panner(P) : ctx.createGain(); g.connect(out); out.connect(AU.bus.sfx); const rg = ctx.createGain(); rg.gain.value = 0.5; out.connect(rg); rg.connect(AU.reverb); o.start(t); o.stop(t + 2); }); burst({ pos: P, type: 'noise', freq: 4000, q: 1, gain: 0.1, d: 0.02, dur: 0.01, r: 0.02 }); break; }
    case 'espresso': { const ctx = AU.ctx; const t = now; const src = noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.6); g.gain.setValueAtTime(0.22, t + 3.4); g.gain.linearRampToValueAtTime(0.0001, t + 4.3); src.connect(f); f.connect(g); const out = P ? panner(P) : ctx.createGain(); g.connect(out); out.connect(AU.bus.sfx); src.start(t); src.stop(t + 4.5); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52; const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 160; const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.09, t + 0.3); og.gain.setValueAtTime(0.09, t + 3.6); og.gain.linearRampToValueAtTime(0.0001, t + 4.2); o.connect(lf); lf.connect(og); og.connect(out); o.start(t); o.stop(t + 4.5); for (let i = 0; i < 5; i++) burst({ pos: P, type: 'noise', freq: 3000, q: 1, gain: 0.06, d: 0.02, dur: 0.02, r: 0.03, delay: 0.1 + i * 0.09 }); break; }
    case 'cupSet': burst({ pos: P, type: 'osc', osc: 'sine', freq: 1900, sweep: [1500, 0.05], gain: 0.1, d: 0.06, dur: 0.02, r: 0.12 }); burst({ pos: P, type: 'osc', osc: 'sine', freq: 3200, gain: 0.05, d: 0.04, dur: 0.02, r: 0.1, delay: 0.03 }); break;
    case 'click': burst({ pos: P, type: 'noise', freq: 2500, q: 2, gain: 0.12, d: 0.01, dur: 0.01, r: 0.02 }); break;
    case 'rustle': for (let i = 0; i < 4; i++) burst({ pos: P, type: 'noise', freq: 3200, q: 0.7, gain: 0.05, d: 0.06, dur: 0.05, r: 0.06, delay: i * 0.08 }); break;
    case 'sit': burst({ pos: P, type: 'noise', freq: 250, filter: 'lowpass', gain: 0.15, d: 0.1, dur: 0.08, r: 0.15 }); break;
    case 'select': burst({ type: 'osc', osc: 'sine', freq: 880, sweep: [1320, 0.08], gain: 0.05, d: 0.06, dur: 0.02, r: 0.12, reverb: 0.4 }); break;
    case 'treat': burst({ type: 'osc', osc: 'sine', freq: 1200, sweep: [1800, 0.1], gain: 0.05, d: 0.05, dur: 0.03, r: 0.15 }); break;
  }
}
// ambience: room tone + murmur + occasional clinks around the tables
function startAmbience() {
  const ctx = AU.ctx; const src = noiseSrc(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; const g = ctx.createGain(); g.gain.value = 0.045; src.connect(lp); lp.connect(g); g.connect(AU.bus.ambience); src.start();
  const m = noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.6; const mg = ctx.createGain(); mg.gain.value = 0.02; const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(mg.gain); m.connect(bp); bp.connect(mg); mg.connect(AU.bus.ambience); m.start(); lfo.start();
  const clink = () => { if (AU.ctx && !AU.muted && !document.hidden) { const spots = [[-2.4, 0.8, 0.6], [1.1, 0.8, 1.4], [1.1, 0.8, -1.5], [-2.5, 1.0, -3.3], [4.3, 0.5, 0.3]]; const s = pick(spots); burst({ pos: { x: s[0], y: s[1], z: s[2] }, bus: 'ambience', type: 'osc', osc: 'sine', freq: rand(1800, 4200), gain: rand(0.02, 0.06), d: 0.05, dur: 0.02, r: rand(0.1, 0.3), reverb: 0.5 }); if (Math.random() < 0.3) burst({ pos: { x: s[0], y: s[1], z: s[2] }, bus: 'ambience', type: 'noise', freq: 2200, q: 1.5, gain: 0.03, d: 0.03, dur: 0.02, r: 0.05, delay: 0.07 }); } setTimeout(clink, rand(3500, 11000)); };
  setTimeout(clink, 4000);
  AU.ambCheck = setInterval(() => { if (!AU.ctx) return; const night = W.isNight ? 0.5 : 1; g.gain.setTargetAtTime(0.045 * night, AU.ctx.currentTime, 1); mg.gain.setTargetAtTime(0.02 * night, AU.ctx.currentTime, 1); }, 2000);
}
// music: a slow, warm lo-fi loop — Rhodes-like chords, a sparse pentatonic melody, a brushed tick
function startMusic() {
  const ctx = AU.ctx; const bpm = 68, beat = 60 / bpm; const chords = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [46, 50, 53, 57], [55, 58, 62, 65], [48, 55, 58, 62]]; const pent = [65, 67, 69, 72, 74, 77, 79];
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; const musicOut = ctx.createGain(); musicOut.gain.value = 1; lp.connect(musicOut); musicOut.connect(AU.bus.music); const rg = ctx.createGain(); rg.gain.value = 0.55; musicOut.connect(rg); rg.connect(AU.reverb);
  const dl = ctx.createDelay(1.0); dl.delayTime.value = beat * 0.75; const dg = ctx.createGain(); dg.gain.value = 0.22; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1400; musicOut.connect(dl); dl.connect(dlp); dlp.connect(dg); dg.connect(dl); dg.connect(AU.bus.music);
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const note = (n, t, dur, vel, tone = 'ep') => {
    const f = midi(n); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + (tone === 'ep' ? 0.012 : 0.03)); g.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.4); g.gain.setValueAtTime(vel * 0.45, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4); g.connect(lp);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f; o1.connect(g); o1.start(t); o1.stop(t + dur + 1.6);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.02, t + 0.7); g2.connect(g); const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.0; o2.connect(g2); o2.start(t); o2.stop(t + dur + 1.6);
    const g3 = ctx.createGain(); g3.gain.setValueAtTime(0.12, t); g3.gain.exponentialRampToValueAtTime(0.01, t + 1.2); g3.connect(g); const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * (tone === 'ep' ? 3.01 : 1.0); o3.connect(g3); o3.start(t); o3.stop(t + dur + 1.6);
  };
  const tick = (t, vel) => { const s = noiseSrc(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); s.connect(f); f.connect(g); g.connect(AU.bus.music); s.start(t); s.stop(t + 0.1); };
  let nextBeat = ctx.currentTime + 0.5, beatNo = 0, chordI = 0, lastMel = -10;
  AU.musicTimer = setInterval(() => {
    if (!AU.ctx || document.hidden) return;
    while (nextBeat < ctx.currentTime + 0.6) {
      const t = nextBeat; const bar = Math.floor(beatNo / 4), inBar = beatNo % 4;
      if (beatNo % 8 === 0) { chordI = (Math.floor(beatNo / 8)) % chords.length; const ch = chords[chordI]; ch.forEach((n, i) => note(n, t + i * 0.035, beat * 7.2, 0.05)); note(ch[0] - 12, t, beat * 7.5, 0.045, 'bass'); }
      if (inBar === 1 || inBar === 3) tick(t, 0.012); if (inBar === 0 && Math.random() < 0.3) tick(t + beat * 0.5, 0.008);
      if (Math.random() < 0.32 && beatNo - lastMel >= 1 && bar % 4 !== 3) { const chordTones = chords[chordI].map(n => (n % 12)); let n = pick(pent); if (Math.random() < 0.6) { const ok = pent.filter(p => chordTones.includes(p % 12)); if (ok.length) n = pick(ok); } const dur = beat * (Math.random() < 0.5 ? 1 : 2); note(n, t + (Math.random() < 0.3 ? beat * 0.5 : 0), dur, 0.032, 'ep'); lastMel = beatNo; if (Math.random() < 0.3) { const n2 = pick(pent); note(n2, t + beat * 0.75, beat * 0.8, 0.024, 'ep'); } }
      nextBeat += beat; beatNo++;
    }
  }, 120);
}
