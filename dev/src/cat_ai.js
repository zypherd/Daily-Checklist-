// ─── Cat controller: locomotion, jumping, navigation and a utility-based behaviour brain ──
const SPEEDS = { walk: 0.55, trot: 1.05, run: 2.3, creep: 0.3 };

const PERSONALITIES = {
  marmalade: { energy: 0.9, curiosity: 0.75, sociability: 0.6, playfulness: 0.95, laziness: 0.15, boldness: 0.8, sunLover: 0.3, heightLover: 0.5, scratchy: 0.6, bio: 'Chaos in a fur coat. Will chase anything that rolls, then act like nothing happened.' },
  smoke: { energy: 0.3, curiosity: 0.3, sociability: 0.4, playfulness: 0.2, laziness: 0.95, boldness: 0.55, sunLover: 1.0, heightLover: 0.2, scratchy: 0.2, bio: 'A professional napper who follows the sunbeam across the floor like a slow hand on a clock.' },
  onyx: { energy: 0.6, curiosity: 1.0, sociability: 0.45, playfulness: 0.5, laziness: 0.3, boldness: 0.65, sunLover: 0.4, heightLover: 0.6, scratchy: 0.5, bio: 'Investigates every new sound, every dropped spoon, every stranger at the window. Keeps notes, probably.' },
  pearl: { energy: 0.7, curiosity: 0.55, sociability: 0.95, playfulness: 0.75, laziness: 0.3, boldness: 0.5, sunLover: 0.5, heightLover: 0.3, scratchy: 0.4, bio: 'The café greeter. Sniffs noses with the other cats, sits with whoever sits down, purrs at strangers.' },
  mochi: { energy: 0.5, curiosity: 0.5, sociability: 0.25, playfulness: 0.4, laziness: 0.45, boldness: 0.85, sunLover: 0.6, heightLover: 1.0, scratchy: 0.7, bio: 'Aloof, immaculate, always on the highest thing in the room. Grooms more than she does anything else.' },
};

class Cat {
  constructor(key, x, z) {
    this.key = key; this.spec = CAT_SPECS[key]; this.name = this.spec.name; this.P = PERSONALITIES[key];
    this.model = new CatModel(this.spec); this.group = this.model.group; W.scene.add(this.group);
    this.x = x; this.z = z; this.y = 0; this.heading = rand(TAU); this.speed = 0; this.vx = 0; this.vz = 0;
    this.perch = null; this.air = null; this.path = null; this.pathI = 0; this.stuckT = 0; this.lastProg = 0;
    this.needs = { energy: rand(0.5, 0.9), play: rand(0.2, 0.6), social: rand(0.2, 0.6), explore: rand(0.3, 0.7), groom: rand(0.1, 0.5) };
    this.action = null; this.steps = null; this.stepI = 0; this.stepT = 0; this.mood = 'calm'; this.activity = 'settling in'; this.activityDetail = '';
    this.cooldown = {}; this.pendingEvent = null; this.lookTimer = 0; this.playerNoticeT = rand(4, 9); this.lastSleep = -100; this.sleepDebt = 0;
    this.r = 0.17 * this.spec.size; this.wanderTargetPerch = null; this.sinceDecision = 0; this.age = 0; this.busyWithCat = null;
    this.model.setPoseImmediate('stand'); this.syncTransform(); this.steps = [this.hold('stand', rand(0.5, 4), 'calm', null, true)]; this.stepI = 0; this.steps[0].start(); this.action = { name: 'settle', threshold: 0.4 };
  }
  get pos() { return new THREE.Vector3(this.x, this.y, this.z); }
  get headPos() { const v = new THREE.Vector3(); this.model.head.getWorldPosition(v); return v; }
  isAsleep() { return this.action && (this.action.name === 'sleep' || this.action.name === 'nap'); }
  // ── stimuli
  notify(ev) {
    if (this.air) return;
    const d = dist2(this.x, this.z, ev.x, ev.z); let sal = ev.salience * (1 - smoothstep(1.5, 8, d));
    if (ev.type === 'toy') sal *= 0.5 + this.P.playfulness; if (ev.type === 'novel' || ev.type === 'sound') sal *= 0.5 + this.P.curiosity;
    if (ev.type === 'cat-arrived') sal *= this.perch && ev.perch === this.perch ? 1.6 : 0.4;
    if (ev.type === 'player') sal *= 1.4 - this.P.boldness;
    if (ev.type === 'treat') sal *= 0.9 + this.P.playfulness * 0.4;
    if (ev.type === 'player-sat') sal *= 0.3 + this.P.sociability * 1.2;
    if (ev.type === 'bird') sal *= 0.8 + this.P.curiosity;
    const thr = this.action ? this.action.threshold : 0.2;
    if (sal > thr && (!this.pendingEvent || sal > this.pendingEvent.sal)) { this.pendingEvent = { ...ev, sal }; }
  }
  // ── decision making
  decide() {
    const P = this.P, N = this.needs, now = W.time; const opts = [];
    const cd = (name) => (this.cooldown[name] && now < this.cooldown[name]) ? 0.15 : 1;
    const hour = W.dayTime; const crepuscular = 0.6 + 0.4 * (Math.exp(-((hour - 7.5) ** 2) / 3) + Math.exp(-((hour - 18.5) ** 2) / 3)); const night = (hour < 6 || hour > 22) ? 1 : 0;
    const tired = 1 - N.energy;
    const ev = this.pendingEvent; this.pendingEvent = null;
    if (ev && ev.type === 'player-sat') { if (W.playerSeat && !W.playerSeat.catTaken) opts.push({ name: 'lap', score: 1.0 + ev.sal + this.P.sociability }); }
    else if (ev) opts.push({ name: 'react', score: 0.9 + ev.sal * 1.2, ev });
    // sleeping / resting spots
    const spots = W.perches.filter(p => p.kind !== 'chair' || Math.random() < 0.7);
    let best = null, bestScore = -1;
    for (const p of spots) {
      if (p.occupants.size && !p.occupants.has(this)) continue;   // occupied or claimed by another cat
      const sunW = W.sunPatch.valid ? Math.max(0, 1 - dist2(p.x, p.z, W.sunPatch.x, W.sunPatch.z) / 1.6) : 0;
      const warmth = p.warmth + sunW * P.sunLover * 1.3 + (p.kind === 'bed' ? 0.2 : 0);
      const s = p.comfort * 0.8 + warmth * 0.9 + p.y * 0.4 * P.heightLover + gauss() * 0.18 + (p.favorite === this.key ? 0.45 : 0) - (p.y > 1.2 && P.boldness < 0.5 ? 0.5 : 0);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (best) {
      const dayPenalty = (hour > 8 && hour < 20) ? 0.28 : 0;
      opts.push({ name: 'sleep', score: (0.1 + tired * 1.4 + P.laziness * 0.45 + night * 0.8 + bestScore * 0.3 - dayPenalty) * cd('sleep'), perch: best });
      opts.push({ name: 'nap', score: (0.15 + tired * 0.8 + P.laziness * 0.35 + bestScore * 0.25 - dayPenalty * 0.6) * cd('nap'), perch: best });
    }
    opts.push({ name: 'wander', score: (0.5 + N.explore * 0.5 + P.energy * 0.45) * crepuscular * cd('wander') });
    opts.push({ name: 'observe', score: 0.45 + gauss() * 0.1 });
    opts.push({ name: 'groom', score: (0.15 + N.groom * 1.2 + (now - this.lastSleep < 8 ? 0.5 : 0)) * cd('groom') });
    if (now - this.lastSleep < 6) opts.push({ name: 'stretch', score: 1.4 });
    const highs = W.perches.filter(p => p.y > 0.8 && !p.occupants.size);
    if (highs.length) opts.push({ name: 'perch', score: (0.2 + P.heightLover * 0.9 + N.explore * 0.3) * cd('perch'), perch: pick(highs) });
    const views = W.perches.filter(p => p.view > 0.3 && !p.occupants.size);
    if (views.length) opts.push({ name: 'window', score: (0.35 + P.curiosity * 0.5 + (W.bird && W.bird.landed ? 1.0 : 0) + (W.pedestrians.some(pd => pd.active) ? 0.2 : 0)) * cd('window'), perch: views.sort((a, b) => b.view - a.view)[Math.min(views.length - 1, randi(0, 1))] });
    const scratchers = W.perches.filter(p => p.scratch);
    if (scratchers.length) opts.push({ name: 'scratch', score: (0.1 + P.scratchy * 0.6 + P.energy * 0.2) * cd('scratch'), perch: pick(scratchers) });
    const toys = W.toys.filter(t => t.y < 0.6); 
    if (toys.length) { const t = toys.reduce((a, b) => (dist2(this.x, this.z, a.x, a.z) < dist2(this.x, this.z, b.x, b.z) ? a : b)); const movingBonus = Math.hypot(t.vx, t.vz) > 0.3 ? 0.8 : 0; opts.push({ name: 'play', score: (0.2 + N.play * 1.3 * P.playfulness + movingBonus + P.energy * 0.2) * cd('play'), toy: t }); }
    const others = W.cats.filter(c => c !== this && !c.air && c.busyWithCat !== this);
    if (others.length) { const o = pick(others); opts.push({ name: 'social', score: (0.25 + N.social * 1.3 * P.sociability + (o.isAsleep() ? -0.3 : 0.15)) * cd('social'), other: o }); }
    if (W.playerSeat && !W.playerSeat.catTaken) opts.push({ name: 'lap', score: (0.3 + P.sociability * 1.1 + N.social * 0.5) * cd('lap') });
    if (W.explorePoints && W.explorePoints.length) opts.push({ name: 'explore', score: (0.3 + P.curiosity * 0.8 + N.explore * 0.6) * cd('explore'), point: pick(W.explorePoints) });
    if (W.danglers && W.danglers.length) opts.push({ name: 'dangle', score: (0.1 + P.playfulness * 0.6 + N.play * 0.5) * cd('dangle') });
    // pick: softmax-ish with noise (variety, not argmax)
    opts.forEach(o => o.score += gauss() * 0.22);
    opts.sort((a, b) => b.score - a.score);
    const choice = Math.random() < 0.8 ? opts[0] : (opts[1] || opts[0]);
    this.start(choice);
  }
  start(o) {
    const S = this; const name = o.name; if (o.perch && o.perch.y >= 0.12 || (o.perch && (name === 'sleep' || name === 'nap'))) { o.perch.occupants.add(this); this.claimed = o.perch; } this.action = { name, threshold: 0.5 }; this.cooldown[name] = W.time + ({ sleep: 60, nap: 25, wander: 4, groom: 40, perch: 30, window: 35, scratch: 45, play: 12, social: 30, lap: 60, explore: 15, dangle: 40 }[name] || 5);
    const A = this.action; this.busyWithCat = null;
    switch (name) {
      case 'sleep': case 'nap': {
        const p = o.perch; const dur = name === 'sleep' ? rand(45, 140) * (0.6 + this.P.laziness) * (W.isNight ? 1.6 : 1) : rand(15, 40);
        A.threshold = name === 'sleep' ? 0.85 : 0.6; this.describe(name === 'sleep' ? 'sleeping' : 'napping', 'on ' + p.name);
        this.steps = [...S.routeTo(p), S.settleOn(p), S.hold(name === 'sleep' ? 'loaf' : 'loaf', 3, 'calm'), S.hold(name === 'sleep' ? 'sleep' : (Math.random() < 0.5 ? 'loaf' : 'lieSide'), dur, 'sleepy', p), S.hold('loaf', 3, 'calm'), S.leave(p)];
        break; }
      case 'wander': { A.threshold = 0.3; const to = randomFreePoint({ x: this.x, z: this.z }, 2); this.describe('wandering', 'across the café'); this.steps = [S.goTo(to, 'walk'), S.hold(Math.random() < 0.5 ? 'sit' : 'stand', rand(2, 6), 'calm')]; break; }
      case 'observe': { A.threshold = 0.3; this.describe('watching the café', ''); this.steps = [S.hold('sit', rand(6, 18), 'calm', null, true)]; break; }
      case 'groom': { A.threshold = 0.55; this.describe('grooming', ''); this.steps = [S.hold('sit', 1, 'calm'), S.groomSeq(rand(8, 18)), S.hold('sit', 1.5, 'calm')]; this.needs.groom = 0; break; }
      case 'stretch': { A.threshold = 0.9; this.describe('stretching', 'after a nap'); this.steps = [S.hold('stretch', rand(2, 3.2), 'calm'), S.hold('stand', 1, 'calm')]; break; }
      case 'perch': { A.threshold = 0.45; const p = o.perch; this.describe('climbing', 'up to ' + p.name); this.steps = [...S.routeTo(p), S.settleOn(p), S.hold('sit', rand(15, 50), 'calm', p, true), S.leave(p)]; break; }
      case 'window': { A.threshold = 0.5; const p = o.perch; this.describe('window watching', 'from ' + p.name); this.steps = [...S.routeTo(p), S.settleOn(p), S.windowWatch(rand(20, 50), p), S.leave(p)]; break; }
      case 'scratch': { A.threshold = 0.5; const p = o.perch; const at = p.approach[0] || { x: p.x, z: p.z + p.hd + 0.4 }; this.describe('scratching', p.name); this.steps = [S.goTo(at, 'walk'), S.face(p.x, p.z), S.scratchSeq(rand(3, 6), p), S.hold('stand', 1, 'calm')]; break; }
      case 'play': { A.threshold = 0.6; this.describe('playing', 'with a toy'); this.steps = [S.playSeq(o.toy, randi(2, 5))]; break; }
      case 'social': { A.threshold = 0.5; const oc = o.other; this.describe('approaching ' + oc.name, ''); this.busyWithCat = oc; this.steps = [S.approachCat(oc), S.greet(oc)]; break; }
      case 'lap': { A.threshold = 0.5; const s = W.playerSeat; this.describe('coming to sit with you', '');
        const p = s.perch; const side = Math.random() < 0.5 ? 1 : -1;
        if (p && (p.hw > 0.4 || p.hd > 0.4)) {   // a couch: hop up and settle right beside you
          const at = p.hw > p.hd ? { x: clamp(s.x + side * 0.55, p.x - p.hw, p.x + p.hw), z: p.z } : { x: p.x, z: clamp(s.z + side * 0.55, p.z - p.hd, p.z + p.hd) };
          this.steps = [...S.routeTo(p), S.settleOn(p, at), S.lapSit(rand(25, 70))];
        } else { const at = { x: s.x + Math.sin(s.ry) * 0.5 + Math.cos(s.ry) * 0.35 * side, z: s.z + Math.cos(s.ry) * 0.5 - Math.sin(s.ry) * 0.35 * side }; this.steps = [S.goTo(at, 'walk'), S.face(s.x, s.z), S.lapSit(rand(25, 70))]; }
        break; }
      case 'explore': { A.threshold = 0.4; const pt = o.point; this.describe('investigating', pt.label); this.steps = [S.goTo({ x: pt.x, z: pt.z }, Math.random() < 0.5 ? 'walk' : 'trot'), S.face(pt.fx ?? pt.x, pt.fz ?? pt.z), S.hold('sniff', rand(2, 4), 'curious'), Math.random() < 0.4 ? S.hold('bat', 0.6, 'playful') : S.hold('alert', 1.5, 'curious')]; break; }
      case 'dangle': { A.threshold = 0.6; const d = W.danglers[0]; this.describe('batting the dangling toy', ''); this.steps = [S.goTo({ x: d.x, z: d.z + 0.35 }, 'trot'), S.face(d.x, d.z), S.dangleSeq(randi(3, 6), d)]; break; }
      case 'react': { const ev = o.ev; A.threshold = 0.95; this.describe('startled', 'by ' + (ev.label || 'something')); 
        const investigate = (ev.type === 'toy' || ev.type === 'treat' || ev.type === 'novel' || ev.type === 'sound') && Math.random() < this.P.curiosity * 0.9 + (ev.type === 'treat' ? 0.4 : 0);
        const flee = ev.type === 'player' && Math.random() < (1 - this.P.boldness);
        this.steps = [S.hold('alert', rand(0.8, 2.2), 'alert', null, false, { x: ev.x, y: ev.y ?? 0.2, z: ev.z })];
        if (flee) this.steps.push(S.fleeFrom(ev));
        else if (investigate) { this.steps.push(S.goTo({ x: ev.x, z: ev.z }, ev.type === 'treat' ? 'run' : 'trot', 0.35, ev.treat ? () => ev.treat.gone && ev.treat.gone !== S : null), S.face(ev.x, ev.z), S.hold('sniff', rand(1.5, 3), 'curious')); if (ev.type === 'treat') { this.steps.push(S.eat(ev)); } else if (ev.type === 'toy' && Math.random() < this.P.playfulness) { const t = ev.toy; if (t) this.steps.push(S.playSeq(t, randi(1, 3))); } }
        else if (ev.type === 'cat-arrived' && Math.random() < 0.45) { this.steps.push(S.fleeFrom(ev, 2.0, 'walk')); this.describe('moving away', 'from ' + (ev.label || 'a cat')); }
        else if (ev.type === 'bird' && Math.random() < 0.7) { const p = W.perches.find(pp => pp.id === 'sill'); if (p && !p.occupants.size) this.steps.push(...S.routeTo(p), S.settleOn(p), S.windowWatch(rand(15, 40), p), S.leave(p)); }
        break; }
    }
    this.stepI = 0; this.stepT = 0; if (this.steps[0] && this.steps[0].start) this.steps[0].start();
  }
  describe(a, d) { this.activity = a; this.activityDetail = d; }
  activityText() {
    const map = { sleeping: 'Fast asleep', napping: 'Napping', wandering: 'Wandering', 'watching the café': 'Sitting and watching the room', grooming: 'Grooming', stretching: 'A long stretch', climbing: 'Climbing', 'window watching': 'Watching the street', scratching: 'Scratching', playing: 'Playing', startled: 'Startled', investigating: 'Investigating', 'batting the dangling toy': 'Batting the toy on the cat tree', 'coming to sit with you': 'Coming over to sit with you' };
    return `<b>${map[this.activity] || this.activity}</b> ${this.activityDetail}`.trim();
  }
  // ── step builders (each returns {update(dt) → true when finished, start?})
  hold(pose, dur, mood = 'calm', perch = null, lookAround = false, lookAt = null) {
    const S = this; let t = 0, nextLook = 0;
    return { start() { S.model.setPose(pose); S.mood = mood; S.speed = 0; if (lookAt) S.model.lookTarget = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z); else S.model.lookTarget = null; if (pose === 'sleep' || pose === 'lieSide') S.lastSleep = W.time; if (pose === 'sleep') playSfx('purr', S); },
      update(dt) { t += dt; if (pose === 'sleep' || pose === 'loaf' || pose === 'lieSide') { S.needs.energy = clamp(S.needs.energy + dt * (pose === 'sleep' ? 0.012 : 0.006), 0, 1); }
        if (lookAround) { nextLook -= dt; if (nextLook < 0) { nextLook = rand(2, 6); S.model.lookTarget = S.pickGaze(); } }
        if (pose === 'sleep' && S.lastSleep < W.time) S.lastSleep = W.time;
        return t >= dur; } };
  }
  pickGaze() {
    const c = [];
    if (W.playerPos && dist2(this.x, this.z, W.playerPos.x, W.playerPos.z) < 5) c.push(W.playerPos.clone().setY(W.playerPos.y - 0.1));
    W.cats.forEach(o => { if (o !== this && dist2(this.x, this.z, o.x, o.z) < 5 && (o.speed > 0.2 || Math.random() < 0.3)) c.push(o.headPos); });
    W.toys.forEach(t => { if (Math.hypot(t.vx, t.vz) > 0.2) c.push(new THREE.Vector3(t.x, t.y, t.z)); });
    if (W.bird && W.bird.landed) c.push(W.bird.pos.clone());
    if (Math.random() < 0.4 || !c.length) { const a = this.heading + rand(-1.2, 1.2); return new THREE.Vector3(this.x + Math.sin(a) * 3, rand(0.1, 1.2), this.z + Math.cos(a) * 3); }
    return pick(c);
  }
  face(x, z) { const S = this; let t = 0; return { start() { S.model.setPose('stand'); }, update(dt) { t += dt; S.turnToward(Math.atan2(x - S.x, z - S.z), dt); return t > 0.5 && Math.abs(wrapAngle(Math.atan2(x - S.x, z - S.z) - S.heading)) < 0.2 || t > 1.5; } }; }
  goTo(pt, gait = 'walk', tol = 0.16, abortIf = null) {
    const S = this; let started = false, t = 0;
    return { start() { S.planPath(pt.x, pt.z); S.gait = gait; started = true; t = 0; S.model.setPose(gait === 'run' ? 'run' : gait === 'trot' ? 'trot' : 'walk'); S.model.lookTarget = null; },
      update(dt) { t += dt; if (abortIf && abortIf()) { S.speed = 0; S.model.setPose('stand'); S.steps.length = S.stepI + 1; return true; } if (S.perch && S.perch.y >= 0.12) { S.descendStep = S.descendStep || S.descendFrom(S.perch); if (S.descendStep.update(dt)) { S.descendStep = null; S.planPath(pt.x, pt.z); } return false; }
        const done = S.followPath(dt, SPEEDS[gait], tol); if (done) { S.speed = 0; S.model.setPose('stand'); } return done || t > 40; } };
  }
  routeTo(p) {           // steps that get the cat onto perch p (floor spots need only a walk)
    const S = this; const steps = [];
    if (p.y < 0.12) { steps.push(S.goTo({ x: p.x, z: p.z }, 'walk', 0.14)); return steps; }
    if (S.perch === p) return steps;
    // direct link from the current perch?
    if (S.perch && S.perch.links.includes(p.id)) { steps.push(S.jumpTo(p)); return steps; }
    // route: floor → approach → chain of jumps
    const chain = S.perchChain(p); if (!chain) { steps.push(S.goTo({ x: p.x, z: p.z + p.hd + 0.5 }, 'walk')); return steps; }
    const first = chain[0]; const ap = S.nearestApproach(first);
    steps.push(S.goTo(ap, 'walk', 0.14), S.face(first.x, first.z));
    chain.forEach(c => steps.push(S.jumpTo(c)));
    return steps;
  }
  perchChain(target) {   // BFS over perch links back to any perch with a floor approach; returns ordered list ending at target
    const q = [[target]]; const seen = new Set([target.id]);
    while (q.length) { const path = q.shift(); const head = path[0]; if (head.approach.length) return path; for (const id of head.links) { if (seen.has(id)) continue; const np = perchById(id); if (!np) continue; seen.add(id); q.push([np, ...path]); } }
    return null;
  }
  nearestApproach(p) { let best = p.approach[0], bd = Infinity; for (const a of p.approach) { const d = dist2(this.x, this.z, a.x, a.z); if (d < bd) { bd = d; best = a; } } return best; }
  settleOn(p, at = null) {   // walk to a spot inside the perch rectangle
    const S = this; let tx, tz, t = 0;
    return { start() { tx = at ? at.x : clamp(p.x + rand(-p.hw, p.hw) * 0.8, p.x - p.hw, p.x + p.hw); tz = at ? at.z : clamp(p.z + rand(-p.hd, p.hd) * 0.8, p.z - p.hd, p.z + p.hd); S.model.setPose('walk'); },
      update(dt) { t += dt; if (p.y < 0.12 && !S.perch) { S.perch = p; p.occupants.add(S); } const d = dist2(S.x, S.z, tx, tz); if (d < 0.06 || t > 6) { S.speed = 0; S.model.setPose('stand'); return true; } S.steerDirect(tx, tz, SPEEDS.creep + 0.15, dt); S.clampToPerch(); return false; } };
  }
  leave(p) { const S = this; return { start() { if (S.perch && S.perch.y < 0.12) { S.perch.occupants.delete(S); S.perch = null; } }, update() { return true; } }; }
  jumpTo(p) {   // crouch → ballistic arc → land, from the current spot to a point inside perch p
    const S = this; let phase = 0, t = 0, tx, tz;
    return { start() { tx = clamp(p.x + rand(-p.hw, p.hw) * 0.6, p.x - p.hw, p.x + p.hw); tz = clamp(p.z + rand(-p.hd, p.hd) * 0.6, p.z - p.hd, p.z + p.hd); S.model.setPose('crouch'); S.speed = 0; S.model.lookTarget = new THREE.Vector3(tx, p.y + 0.1, tz); },
      update(dt) { t += dt;
        if (phase === 0) { S.turnToward(Math.atan2(tx - S.x, tz - S.z), dt, 8); if (t > 0.32) { phase = 1; S.launch(tx, p.y, tz); S.model.setPose(p.y > S.y ? 'jumpUp' : 'jumpDown'); if (S.perch) S.perch.occupants.delete(S); S.perch = null; playSfx('jump', S); } return false; }
        if (phase === 1) { if (!S.air) { phase = 2; t = 0; S.perch = p; p.occupants.add(S); S.model.setPose('land'); S.model.lookTarget = null; emitEvent({ type: 'cat-arrived', x: S.x, z: S.z, salience: 0.6, perch: p, label: S.name + ' jumping up' }, S); } return false; }
        if (t > 0.3) { S.model.setPose('stand'); return true; } return false; } };
  }
  descendFrom(p) {  // choose a floor approach (or a lower linked perch) and jump down there
    const S = this; let target = null, inner = null;
    if (p.approach.length) { const ap = S.nearestApproach(p); target = { x: ap.x, z: ap.z, y: 0, hw: 0.1, hd: 0.1, id: 'floor', occupants: new Set(), links: [], approach: [] }; inner = S.jumpTo(target); }
    else { const chain = S.perchChain(p); const next = chain && chain.length > 1 ? chain[chain.length - 2] : null; if (next) inner = S.jumpTo(next); else { target = { x: p.x, z: p.z + p.hd + 0.5, y: 0, hw: 0.1, hd: 0.1, id: 'floor', occupants: new Set(), links: [], approach: [] }; inner = S.jumpTo(target); } }
    inner.start(); const wrapped = { update(dt) { const d = inner.update(dt); if (d && S.perch && S.perch.id === 'floor') { S.perch.occupants.delete(S); S.perch = null; } return d; } };
    return wrapped;
  }
  launch(tx, ty, tz) {
    const dx = tx - this.x, dz = tz - this.z, dy = ty - this.y; const dist = Math.hypot(dx, dz);
    const T = clamp(0.32 + dist * 0.22 + Math.max(0, dy) * 0.32, 0.38, 1.1); const g = 9.8;
    this.air = { t: 0, T, x0: this.x, y0: this.y, z0: this.z, tx, ty, tz, vy0: (dy + 0.5 * g * T * T) / T, g };
    this.heading = Math.atan2(dx, dz);
  }
  groomSeq(dur) { const S = this; let t = 0, seg = 0, segT = 0; const variants = [{ headYaw: 0.5, headPitch: 0.6, FR_hip: 0.9 }, { headYaw: -0.5, headPitch: 0.6, headRoll: -0.2, FR_hip: -0.45, FL_hip: 0.9, FL_knee: 1.6, FL_paw: 0.3 }, { headYaw: 0.1, headPitch: 0.9, neckPitch: -0.8 }, { headYaw: 1.1, headPitch: 0.4, neckPitch: -0.5 }];
    return { start() { S.model.setPose('groom'); S.mood = 'calm'; S.model.lookTarget = null; }, update(dt) { t += dt; segT += dt; if (segT > rand(1.2, 2.2)) { segT = 0; seg = (seg + 1) % variants.length; S.model.setPose('groom', variants[seg]); } const lick = Math.sin(t * 9) * 0.06; S.model.pose.headPitch += lick * 0.5; S.model.pose.FR_knee += Math.abs(lick) * 2; return t >= dur; } }; }
  scratchSeq(dur, p) { const S = this; let t = 0; return { start() { S.model.setPose('scratch'); S.mood = 'playful'; playSfx('scratch', S); }, update(dt) { t += dt; const a = Math.sin(t * 7); S.model.pose.FL_hip += a * 0.25; S.model.pose.FR_hip -= a * 0.25; if (Math.floor(t * 7 / Math.PI) !== Math.floor((t - dt) * 7 / Math.PI) && Math.random() < 0.5) playSfx('scratch', S); return t >= dur; } }; }
  windowWatch(dur, p) { const S = this; let t = 0, next = 0; return { start() { S.model.setPose('sit'); S.mood = 'calm'; S.describe('window watching', 'from ' + p.name); }, update(dt) { t += dt; next -= dt; if (next < 0) { next = rand(1.5, 5); const outside = W.bird && W.bird.landed ? W.bird.pos.clone() : (W.pedestrians.find(pd => pd.active) ? W.pedestrians.find(pd => pd.active).pos.clone() : new THREE.Vector3(S.x + rand(-3, 3), rand(0.6, 1.6), ROOM.z1 + rand(2, 8))); if (p.id === 'sill') outside.set(ROOM.x0 - rand(2, 6), rand(0.6, 1.8), S.z + rand(-3, 3)); S.model.lookTarget = outside; if (W.bird && W.bird.landed && Math.random() < 0.5) { S.model.pose.crouch = 0.3; S.mood = 'agitated'; if (Math.random() < 0.3) playSfx('chatter', S); } else S.mood = 'calm'; } return t >= dur; } }; }
  playSeq(toy, rounds) {   // stalk → pounce → bat, repeated
    const S = this; let phase = 'stalk', t = 0, round = 0, stalkT = rand(1, 2.5);
    return { start() { S.model.setPose('stalk'); S.mood = 'playful'; S.gait = 'stalk'; S.planPath(toy.x, toy.z); },
      update(dt) { t += dt; const d = dist2(S.x, S.z, toy.x, toy.z);
        if (S.perch && S.perch.y >= 0.12) { S.descendStep = S.descendStep || S.descendFrom(S.perch); if (S.descendStep.update(dt)) { S.descendStep = null; S.planPath(toy.x, toy.z); } return false; }
        if (phase === 'stalk') { S.model.lookTarget = new THREE.Vector3(toy.x, toy.y, toy.z); const fast = Math.hypot(toy.vx, toy.vz) > 0.4; if (d > 0.45) { if (t > 0.5 && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) S.planPath(toy.x, toy.z); S.followPath(dt, fast ? SPEEDS.run : (t < stalkT ? SPEEDS.creep : SPEEDS.trot), 0.3); S.model.setPose(fast ? 'run' : t < stalkT ? 'stalk' : 'trot'); } else { phase = 'ready'; t = 0; S.speed = 0; S.model.setPose('pounceReady'); } }
        else if (phase === 'ready') { S.turnToward(Math.atan2(toy.x - S.x, toy.z - S.z), dt, 6); S.model.pose.bodyRoll = Math.sin(t * 14) * 0.04; if (t > rand(0.5, 1.2)) { phase = 'bat'; t = 0; S.model.setPose('bat'); } }
        else if (phase === 'bat') { if (t > 0.18 && !S.batted) { S.batted = true; const a = S.heading + rand(-0.5, 0.5); const pow = rand(1.2, 2.6) * (0.6 + S.P.energy * 0.6); toy.vx += Math.sin(a) * pow; toy.vz += Math.cos(a) * pow; toy.vy += rand(0.4, 1.4); toy.lastHit = W.time; playSfx('bat', S); emitEvent({ type: 'toy', x: toy.x, z: toy.z, salience: 0.5, toy, label: 'a rolling toy' }, S); }
          if (t > 0.45) { S.batted = false; round++; if (round >= rounds) { S.model.setPose('sit'); return true; } phase = 'stalk'; t = 0; stalkT = rand(0.3, 1.5); S.model.setPose('stalk'); } }
        S.needs.play = clamp(S.needs.play - dt * 0.05, 0, 1); return false; } };
  }
  dangleSeq(n, d) { const S = this; let t = 0, hits = 0; return { start() { S.model.setPose('sit'); S.mood = 'playful'; S.model.lookTarget = new THREE.Vector3(d.x, d.y - d.len, d.z); }, update(dt) { t += dt; S.model.lookTarget.set(d.ball.position.x, d.ball.position.y, d.ball.position.z); if (t > 1.2) { t = 0; hits++; S.model.setPose('scratch', { bodyPitch: 0.8, FL_hip: 1.9, FR_hip: 1.6 }); d.vel += rand(3, 7) * (Math.random() < 0.5 ? -1 : 1); playSfx('bat', S); setTimeout(() => S.model.setPose('sit'), 350); } S.needs.play = clamp(S.needs.play - dt * 0.03, 0, 1); return hits >= n; } }; }
  approachCat(o) { const S = this; let t = 0; return { start() { S.gait = 'walk'; S.model.setPose('walk'); S.planPath(o.x, o.z); }, update(dt) { t += dt; const d = dist2(S.x, S.z, o.x, o.z); if (d < 0.55 || t > 20) { S.speed = 0; S.model.setPose('stand'); return true; } if (Math.floor(t) !== Math.floor(t - dt)) S.planPath(o.x, o.z); if (S.perch && S.perch.y >= 0.12) { S.descendStep = S.descendStep || S.descendFrom(S.perch); if (S.descendStep.update(dt)) S.descendStep = null; return false; } S.followPath(dt, SPEEDS.walk, 0.5); S.model.lookTarget = o.headPos; return false; } }; }
  greet(o) {   // sniff noses; the other cat either reciprocates, ignores or moves off, based on its personality
    const S = this; let t = 0, reaction = null; return { start() { S.model.setPose('sniff'); S.model.lookTarget = o.headPos; S.needs.social = clamp(S.needs.social - 0.5, 0, 1); S.describe('sniffing noses with ' + o.name, '');
        if (!o.air) { const willing = !o.isAsleep() ? Math.random() < o.P.sociability + 0.15 : Math.random() < 0.15; reaction = willing ? 'greet' : (Math.random() < 0.5 ? 'ignore' : 'avoid'); o.respondToGreeting(S, reaction); } },
      update(dt) { t += dt; S.turnToward(Math.atan2(o.x - S.x, o.z - S.z), dt, 4); if (t > (reaction === 'greet' ? rand(3, 5) : 1.5)) { S.model.setPose('stand'); if (reaction === 'greet' && Math.random() < 0.5) { S.steps.push(S.hold('sit', rand(6, 15), 'calm', null, true)); S.describe('sitting with ' + o.name, ''); } return true; } return false; } }; }
  respondToGreeting(from, reaction) {
    if (this.air) return; const S = this;
    if (reaction === 'greet') { this.interruptWith('greeting ' + from.name, [S.face(from.x, from.z), S.hold('sniff', 3, 'calm', null, false, { x: from.x, y: 0.2, z: from.z }), S.hold('stand', 1, 'calm')], 0.9); if (Math.random() < 0.3) playSfx('trill', this); }
    else if (reaction === 'avoid') { this.interruptWith('keeping some distance from ' + from.name, [S.fleeFrom({ x: from.x, z: from.z }, 1.6, 'walk')], 0.8); }
    else { if (!this.isAsleep()) { this.model.lookTarget = from.headPos; setTimeout(() => { if (this.model.lookTarget) this.model.lookTarget = null; }, 2500); } }
  }
  interruptWith(desc, steps, threshold = 0.7) { if (this.perch && this.perch.y > 0.12) { /* stays on furniture; only look */ this.model.lookTarget = null; } this.action = { name: 'respond', threshold }; this.describe(desc, ''); this.steps = steps; this.stepI = 0; this.stepT = 0; if (steps[0].start) steps[0].start(); }
  fleeFrom(src, distance = 2.5, gait = 'run') { const S = this; let target = null, t = 0; return { start() { const a = Math.atan2(S.x - src.x, S.z - src.z) + rand(-0.7, 0.7); target = randomFreePointNear(S.x + Math.sin(a) * distance, S.z + Math.cos(a) * distance, 1.0); S.planPath(target.x, target.z); S.model.setPose(gait); S.mood = 'agitated'; if (gait === 'run' && Math.random() < 0.5) playSfx('scamper', S); }, update(dt) { t += dt; if (S.perch && S.perch.y >= 0.12) { S.descendStep = S.descendStep || S.descendFrom(S.perch); if (S.descendStep.update(dt)) S.descendStep = null; return false; } const done = S.followPath(dt, SPEEDS[gait], 0.25); if (done || t > 6) { S.speed = 0; S.model.setPose('alert'); S.mood = 'calm'; return true; } return false; } }; }
  lapSit(dur) { const S = this; let t = 0; return { start() { if (W.playerSeat) S.heading = Math.atan2(W.playerSeat.x - S.x, W.playerSeat.z - S.z) + (Math.random() < 0.5 ? 0.9 : -0.9); S.model.setPose('loaf'); S.mood = 'calm'; S.describe('sitting with you', '— purring'); if (W.playerSeat) W.playerSeat.catTaken = S; if (Math.random() < 0.4) playSfx('meow', S, 0.8); setTimeout(() => playSfx('purr', S, 1.2), 900); S.needs.social = 0; }, update(dt) { t += dt; if (!W.playerSeat) { return true; } S.model.lookTarget = W.playerPos ? W.playerPos.clone() : null; return t >= dur; } }; }
  eat(ev) { const S = this; let t = 0, gone = false; return { start() { if (ev.treat && (ev.treat.eaten || ev.treat.gone)) { gone = true; S.describe('too late for the treat', ''); S.model.setPose('sit'); return; } S.model.setPose('sniff', { headPitch: 0.7, neckPitch: -0.5 }); S.describe('eating a treat', ''); if (ev.treat) ev.treat.gone = S; if (Math.random() < 0.35) playSfx('meow', S); setTimeout(() => playSfx('crunch', S), 500); }, update(dt) { t += dt; if (gone) return t > 1.2; if (ev.treat && ev.treat.gone !== S) return true; if (t > 2.6 && ev.treat) ev.treat.eaten = true; S.model.pose.headPitch += Math.sin(t * 8) * 0.05; if (t > 3) { S.needs.play = clamp(S.needs.play + 0.1, 0, 1); S.model.setPose('sit'); if (Math.random() < 0.6) { S.steps.push(S.groomSeq(6)); } return true; } return false; } }; }
  // ── locomotion
  planPath(tx, tz) { this.path = findPath(this.x, this.z, tx, tz) || [{ x: tx, z: tz }]; this.pathI = 0; this.stuckT = 0; this.lastProg = Infinity; }
  followPath(dt, maxSpeed, tol) {
    if (!this.path || !this.path.length) return true;
    const last = this.path[this.path.length - 1]; if (dist2(this.x, this.z, last.x, last.z) < tol) { this.path = null; return true; }
    let wp = this.path[this.pathI]; while (this.pathI < this.path.length - 1 && dist2(this.x, this.z, wp.x, wp.z) < 0.22) { this.pathI++; wp = this.path[this.pathI]; }
    const remaining = dist2(this.x, this.z, last.x, last.z);
    const target = remaining < 0.6 ? maxSpeed * clamp(remaining / 0.5, 0.35, 1) : maxSpeed;   // arrival slow-down
    this.steerDirect(wp.x, wp.z, target, dt, true);
    // stuck detection → replan
    const prog = remaining; if (prog < this.lastProg - 0.02) { this.lastProg = prog; this.stuckT = 0; } else { this.stuckT += dt; if (this.stuckT > 1.6) { this.planPath(last.x, last.z); this.stuckT = 0; if (dist2(this.x, this.z, last.x, last.z) < 0.5) { this.path = null; return true; } } }
    return false;
  }
  steerDirect(tx, tz, maxSpeed, dt, separate = false) {
    let dx = tx - this.x, dz = tz - this.z; const d = Math.hypot(dx, dz) || 0.0001; dx /= d; dz /= d;
    if (separate) for (const o of W.cats) { if (o === this) continue; const ox = this.x - o.x, oz = this.z - o.z; const od = Math.hypot(ox, oz); if (od < 0.6 && od > 0.001) { const f = (0.6 - od) / 0.6 * 1.6; dx += ox / od * f; dz += oz / od * f; } }
    if (W.playerPos && separate) { const ox = this.x - W.playerPos.x, oz = this.z - W.playerPos.z; const od = Math.hypot(ox, oz); if (od < 0.6 && od > 0.001) { const f = (0.6 - od) / 0.6 * 2; dx += ox / od * f; dz += oz / od * f; } }
    const want = Math.atan2(dx, dz); const turnRate = this.speed > 1.2 ? 4.5 : 7;
    this.turnToward(want, dt, turnRate);
    const align = Math.cos(wrapAngle(want - this.heading)); const accel = maxSpeed > this.speed ? 3.5 : 6;
    const targetSpeed = maxSpeed * clamp(align, 0.15, 1);
    this.speed = damp(this.speed, targetSpeed, accel, dt);
  }
  turnToward(a, dt, rate = 7) { const d = wrapAngle(a - this.heading); this.heading += clamp(d, -rate * dt, rate * dt); }
  clampToPerch() { const p = this.perch; if (!p || p.y < 0.12) return; this.x = clamp(this.x, p.x - p.hw, p.x + p.hw); this.z = clamp(this.z, p.z - p.hd, p.z + p.hd); }
  // ── per-frame
  update(dt) {
    this.age += dt; this.sinceDecision += dt;
    // needs drift
    const N = this.needs, P = this.P; const active = this.speed > 0.1;
    N.energy = clamp(N.energy - dt * (active ? 0.003 + this.speed * 0.0025 : 0.0008), 0, 1);
    N.play = clamp(N.play + dt * 0.0035 * P.playfulness, 0, 1); N.social = clamp(N.social + dt * 0.003 * P.sociability, 0, 1); N.explore = clamp(N.explore + dt * 0.003 * P.curiosity, 0, 1); N.groom = clamp(N.groom + dt * 0.0015, 0, 1);
    // behaviour
    if (this.pendingEvent && !this.air) { this.finishAction(); }
    if (!this.steps || this.stepI >= this.steps.length) { this.decide(); }
    else {
      const st = this.steps[this.stepI]; this.stepT += dt;
      if (st.update(dt) || this.stepT > 260) { this.stepI++; this.stepT = 0; const nx = this.steps[this.stepI]; if (nx && nx.start) nx.start(); if (!nx) { this.finishAction(); } }
    }
    // physics: airborne arc or ground movement
    if (this.air) {
      const a = this.air; a.t += dt; const k = clamp(a.t / a.T, 0, 1);
      this.x = lerp(a.x0, a.tx, k); this.z = lerp(a.z0, a.tz, k); this.y = a.y0 + a.vy0 * a.t - 0.5 * a.g * a.t * a.t;
      const vy = a.vy0 - a.g * a.t; const vh = Math.hypot(a.tx - a.x0, a.tz - a.z0) / a.T; this.model.pose.bodyPitch = clamp(Math.atan2(vy, vh) * 0.6, -0.7, 0.7);
      if (k >= 1) { this.x = a.tx; this.z = a.tz; this.y = a.ty; this.air = null; playSfx('land', this); }
    } else {
      if (this.speed > 0.01) { this.vx = Math.sin(this.heading) * this.speed; this.vz = Math.cos(this.heading) * this.speed; this.x += this.vx * dt; this.z += this.vz * dt; } else { this.vx = this.vz = 0; }
      if (this.perch && this.perch.y >= 0.12) { this.clampToPerch(); this.y = this.perch.y; }
      else { const [nx, nz] = resolveCircle(this.x, this.z, this.r, { minTop: 0.12 }); this.x = nx; this.z = nz; this.y = 0; }
      // nudge toys we walk into
      for (const t of W.toys) { const d = dist2(this.x, this.z, t.x, t.z); if (d < this.r + t.r && this.speed > 0.2 && t.y < 0.3) { const f = 0.6; t.vx += this.vx * f + (t.x - this.x) / (d || 0.01) * 0.3; t.vz += this.vz * f + (t.z - this.z) / (d || 0.01) * 0.3; t.vy += 0.3; } }
    }
    // occasionally notice the player
    if (W.playerPos && !this.isAsleep()) { const d = dist2(this.x, this.z, W.playerPos.x, W.playerPos.z); this.playerNoticeT -= dt;
      if (this.playerNoticeT < 0) { this.playerNoticeT = rand(3, 9); if (d < 2.2 && Math.random() < 0.35 + this.P.curiosity * 0.4 && !this.model.lookTarget) { this.model.lookTarget = W.playerPos.clone().setY(W.playerPos.y - 0.15); this.lookTimer = rand(1.5, 4); } }
      if (this.lookTimer > 0) { this.lookTimer -= dt; if (this.lookTimer <= 0 && this.action && this.action.name !== 'lap') this.model.lookTarget = null; }
      if (d < 0.8 && W.playerSpeed > 1.3 && this.P.boldness < 0.75 && !this.perch && this.action.name !== 'flee') this.notify({ type: 'player', x: W.playerPos.x, z: W.playerPos.z, salience: 0.9, label: 'you rushing past' });
    }
    this.syncTransform();
    this.model.animate(dt, { speed: this.speed, moving: this.speed > 0.04 && !this.air, mood: this.mood, airborne: !!this.air });
  }
  finishAction() { if (this.claimed && this.perch !== this.claimed) this.claimed.occupants.delete(this); this.claimed = null; if (this.perch && (this.perch.y < 0.12 || this.perch.id === 'floor')) { this.perch.occupants.delete(this); this.perch = null; } if (W.playerSeat && W.playerSeat.catTaken === this) W.playerSeat.catTaken = null; this.steps = null; this.action = null; this.descendStep = null; this.busyWithCat = null; }
  syncTransform() { this.group.position.set(this.x, this.y, this.z); this.group.rotation.y = this.heading; }
}
function randomFreePointNear(x, z, radius) { for (let k = 0; k < 20; k++) { const a = rand(TAU), r = rand(0, radius); const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; const c = nearestFree(px, pz); if (c) { const [cx, cz] = cellCenter(c[0], c[1]); return { x: cx, z: cz }; } } return randomFreePoint(); }
function emitEvent(ev, source = null) { ev.t = W.time; W.cats.forEach(c => { if (c !== source) c.notify(ev); }); }
