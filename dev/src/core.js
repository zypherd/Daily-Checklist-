// The Rose Teacup — a living 3D café for the Daily Checklist.
// Everything below runs as one ES module. Three.js is fetched from a pinned CDN build; if that
// fails (offline, blocked) or WebGL is unavailable, the classic 2D café takes over (enterClassicMode).

let THREE, mergeGeometries, RoomEnvironment;

const W = {           // world state shared by every section
  active: false, renderer: null, scene: null, camera: null, clock: null,
  time: 0, dt: 0, dayTime: 10.5,   // hours (0..24) — starts mid-morning
  daySpeed: 1 / 50,                 // game hours per real second → a full day in ~20 minutes
  cats: [], toys: [], perches: [], obstacles: [], interactables: [], steamers: [],
  lightsOn: true, sun: null, hemi: null, pendants: [], sunPatch: new (class { constructor(){ this.x = -3; this.z = 2; this.valid = true; } })(),
  events: [],        // transient stimuli for the cats: {type, pos, salience, t}
  bird: null, pedestrians: [], selectedCat: null,
  quality: 'high',
};
window.Cafe3D = { active: false, world: W };

// ─── small math helpers ────────────────────────────────────────────────────────
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));   // frame-rate independent smoothing
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const wrapAngle = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

// deterministic value noise for textures
function makeNoise(seed = 1) {
  const perm = new Uint8Array(512); let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => { const g = h & 3; return (g & 1 ? -x : x) + (g & 2 ? -y : y); };
  const n2 = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  };
  const fbm = (x, y, oct = 4, lac = 2, gain = 0.5) => { let s = 0, a = 1, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); norm += a; a *= gain; f *= lac; } return s / norm; };
  return { n2, fbm };
}
const noise = makeNoise(7);
const noiseB = makeNoise(31);

function loadStatus(msg, pct) {
  const s = document.getElementById('ld-status'); if (s) s.textContent = msg;
  const b = document.getElementById('ld-bar-fill'); if (b && pct != null) b.style.width = pct + '%';
}
const nextFrame = () => new Promise(r => setTimeout(r, 0));   // setTimeout, not rAF: keeps loading even in a background tab
