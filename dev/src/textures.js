// ─── Procedural textures (canvas) — no external image assets needed ───────────
function canvas2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }

function toTexture(c, { repeat = [1, 1], srgb = true, aniso = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (aniso && W.renderer) t.anisotropy = Math.min(8, W.renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true; return t;
}

// height (grayscale canvas) → normal map canvas via Sobel
function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d'); const d = sctx.getImageData(0, 0, w, h).data;
  const [c, ctx] = canvas2d(w, h); const out = ctx.createImageData(w, h); const o = out.data;
  const H = (x, y) => d[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1); const i = (y * w + x) * 4;
    o[i] = (-dx / len * 0.5 + 0.5) * 255; o[i + 1] = (-dy / len * 0.5 + 0.5) * 255; o[i + 2] = (1 / len * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0); return c;
}

const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

// Wood planks: returns {map, normalMap, roughnessMap}
function woodTexture({ hue = 28, sat = 42, light = 38, planks = 6, size = 1024, vertical = false, grain = 1, seed = 3 } = {}) {
  const N = makeNoise(seed);
  const [c, ctx] = canvas2d(size, size); const [hc, hctx] = canvas2d(size, size); const [rc, rctx] = canvas2d(size, size);
  const img = ctx.createImageData(size, size), hi = hctx.createImageData(size, size), ri = rctx.createImageData(size, size);
  const pw = size / planks;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = vertical ? y : x, py = vertical ? x : y;     // plank axis = px (along grain)
    const plank = Math.floor(py / pw); const inPlank = (py % pw) / pw;
    const pOff = N.n2(plank * 13.7, 0.5) * 100;
    const g = N.fbm((px / size) * 3 * grain + pOff, (py / size) * 40 + pOff, 4, 2.1, 0.55);   // stretched grain
    const rings = Math.sin((py / size * 18 + g * 6 + plank * 2.3) * 2.2) * 0.5 + 0.5;
    const knots = N.fbm(px / size * 6 + plank, py / size * 6, 2) * 0.35;
    let L = light + (rings * 8 - 4) + g * 10 + knots * 10 + N.n2(plank * 3.1, 7) * 6;
    let S = sat + g * 6;
    const seam = Math.min(inPlank, 1 - inPlank) * pw;
    if (seam < 1.5) L -= 18; else if (seam < 4) L -= 6 * (1 - seam / 4);
    const endLen = size / 2 + N.n2(plank * 7.7, 1) * size * 0.2; const endSeam = Math.abs(((px + pOff * 37) % endLen + endLen) % endLen);
    if (endSeam < 1.5) L -= 16; else if (endSeam < 3) L -= 5;
    const fine = N.n2(px * 0.9, py * 0.05) * 3; L += fine;
    const hue2 = hue + N.n2(plank * 5.5, 2) * 6;
    const [r, gg, b] = hslToRgb(hue2 / 360, clamp(S, 0, 100) / 100, clamp(L, 5, 90) / 100);
    const i = (y * size + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    const hgt = clamp(128 + rings * 30 + g * 40 - (seam < 2 || endSeam < 2 ? 60 : 0) + fine * 8, 0, 255);
    hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hgt; hi.data[i + 3] = 255;
    const rough = clamp(150 + g * 50 - rings * 20 + (seam < 2 ? 60 : 0), 0, 255);
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = rough; ri.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); hctx.putImageData(hi, 0, 0); rctx.putImageData(ri, 0, 0);
  return { map: c, normal: heightToNormal(hc, 1.4), rough: rc };
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) r = g = b = l; else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

function plasterTexture({ r = 236, g = 226, b = 212, size = 256, amount = 10, seed = 5 } = {}) {
  const N = makeNoise(seed); const [c, ctx] = canvas2d(size, size); const [hc, hctx] = canvas2d(size, size);
  const img = ctx.createImageData(size, size), hi = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = N.fbm(x / size * 8, y / size * 8, 5) * amount + N.n2(x * 0.7, y * 0.7) * amount * 0.4;
    const i = (y * size + x) * 4; img.data[i] = clamp(r + n, 0, 255); img.data[i + 1] = clamp(g + n, 0, 255); img.data[i + 2] = clamp(b + n, 0, 255); img.data[i + 3] = 255;
    const hgt = 128 + n * 3; hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = clamp(hgt, 0, 255); hi.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); hctx.putImageData(hi, 0, 0);
  return { map: c, normal: heightToNormal(hc, 0.8) };
}

function fabricTexture({ r = 120, g = 100, b = 90, size = 256, weave = 3, seed = 9 } = {}) {
  const N = makeNoise(seed); const [c, ctx] = canvas2d(size, size); const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wv = ((x % weave) === 0 || (y % weave) === 0) ? -12 : 4;
    const n = N.fbm(x / size * 12, y / size * 12, 3) * 14 + wv;
    const i = (y * size + x) * 4; img.data[i] = clamp(r + n, 0, 255); img.data[i + 1] = clamp(g + n, 0, 255); img.data[i + 2] = clamp(b + n, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}

function tileTexture({ size = 512, cols = 8, rows = 4, color = '#f1ede6', grout = '#c9c0b4' } = {}) {
  const [c, ctx] = canvas2d(size, size); ctx.fillStyle = grout; ctx.fillRect(0, 0, size, size);
  const tw = size / cols, th = size / rows;
  for (let r = 0; r < rows; r++) for (let col = -1; col <= cols; col++) {
    const off = (r % 2) * tw / 2; const x = col * tw + off, y = r * th;
    ctx.fillStyle = color; ctx.fillRect(x + 2, y + 2, tw - 4, th - 4);
    const gr = ctx.createLinearGradient(x, y, x + tw, y + th); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = gr; ctx.fillRect(x + 2, y + 2, tw - 4, th - 4);
  }
  return c;
}

function radialTexture(size = 128, inner = 'rgba(0,0,0,0.55)', outer = 'rgba(0,0,0,0)') {
  const [c, ctx] = canvas2d(size, size); const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.55, inner.replace(/[\d.]+\)$/, '0.22)')); g.addColorStop(1, outer); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Fur: base coat + mottling + optional tabby stripes / patches. Returns canvas (also used for legs/tail/head).
function furTexture(spec) {
  const size = 256; const N = makeNoise(spec.seed || 11); const [c, ctx] = canvas2d(size, size); const img = ctx.createImageData(size, size);
  const base = spec.base, dark = spec.dark || base, belly = spec.belly || base;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;                        // u: around body, v: nose→tail
    let col = base.slice();
    const bellyT = smoothstep(0.62, 0.9, Math.abs(((u + 0.25) % 1) - 0.5) * 2); // underside band
    col = mix3(col, belly, bellyT * (spec.bellyAmount ?? 0.8));
    if (spec.stripes) {
      const wob = N.fbm(u * 6, v * 6, 3) * 0.12;
      const s = Math.sin((v * spec.stripes + wob + u * 0.3) * TAU) ;
      const st = smoothstep(0.35, 0.8, s) * (1 - bellyT * 0.85) * (spec.stripeStrength ?? 0.8);
      const brk = smoothstep(-0.2, 0.25, N.fbm(u * 10 + 3, v * 10, 2));  // broken stripes
      col = mix3(col, dark, st * brk);
    }
    if (spec.patches) {
      const p = N.fbm(u * 3.2 + 7, v * 2.4 + 1, 3);
      col = mix3(col, spec.patchColor, smoothstep(spec.patchLevel ?? 0.12, (spec.patchLevel ?? 0.12) + 0.06, p));
    }
    if (spec.mottle) { const m = N.fbm(u * 24, v * 24, 3) * spec.mottle; col = [col[0] + m, col[1] + m, col[2] + m]; }
    const hair = N.n2(x * 1.3, y * 0.11) * 9 + N.n2(x * 0.15, y * 1.4) * 4;  // fine hair streaks
    const i = (y * size + x) * 4; img.data[i] = clamp(col[0] + hair, 0, 255); img.data[i + 1] = clamp(col[1] + hair, 0, 255); img.data[i + 2] = clamp(col[2] + hair, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function eyeTexture(iris = '#8fbf5a', pupilW = 0.22, irisR = 0.36) {
  const size = 256; const [c, ctx] = canvas2d(size, size);
  ctx.fillStyle = '#f2ede4'; ctx.fillRect(0, 0, size, size);
  const cx = size * 0.5, cy = size * 0.5;      // iris centered on the +z pole of the eye sphere (uv .5,.5)
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * irisR); g.addColorStop(0, shade(iris, 25)); g.addColorStop(0.6, iris); g.addColorStop(0.85, shade(iris, -35)); g.addColorStop(1, shade(iris, -70));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, size * irisR, size * irisR, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 70; i++) { ctx.strokeStyle = `rgba(0,0,0,${rand(0.05, 0.22)})`; ctx.beginPath(); const a = rand(TAU); ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); ctx.lineTo(cx + Math.cos(a) * size * irisR * 0.95, cy + Math.sin(a) * size * irisR * 0.95); ctx.stroke(); }
  ctx.fillStyle = '#0c0a0a'; ctx.beginPath(); ctx.ellipse(cx, cy, size * pupilW * 0.5, size * Math.min(0.3, irisR * 0.8), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(cx - 20, cy - 24, 11, 7, -0.6, 0, TAU); ctx.fill();
  const v = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 0.5); v.addColorStop(0, 'rgba(120,60,50,0)'); v.addColorStop(1, 'rgba(120,60,50,0.25)'); ctx.fillStyle = v; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255); return `rgb(${r},${g},${b})`; }

function paintingTexture(kind) {
  const [c, ctx] = canvas2d(512, 384);
  if (kind === 0) {           // warm abstract sunrise
    const g = ctx.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#e9b5a0'); g.addColorStop(0.6, '#d98ca0'); g.addColorStop(1, '#4a3a4a'); ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); ctx.arc(330, 150, 60, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(60,40,60,${0.25 + i * 0.1})`; ctx.beginPath(); ctx.moveTo(0, 240 + i * 22); for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, 240 + i * 22 + Math.sin(x * 0.02 + i) * 14); ctx.lineTo(512, 384); ctx.lineTo(0, 384); ctx.fill(); }
  } else if (kind === 1) {    // line-art cat
    ctx.fillStyle = '#f3ecdf'; ctx.fillRect(0, 0, 512, 384); ctx.strokeStyle = '#3a2f2a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(256, 250, 120, 80, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(256, 150, 58, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(212, 110); ctx.lineTo(220, 60); ctx.lineTo(250, 100); ctx.moveTo(300, 110); ctx.lineTo(292, 60); ctx.lineTo(262, 100); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(370, 250); ctx.quadraticCurveTo(450, 200, 420, 140); ctx.stroke();
    ctx.fillStyle = '#3a2f2a'; ctx.beginPath(); ctx.arc(238, 150, 5, 0, TAU); ctx.arc(274, 150, 5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(256, 165); ctx.lineTo(248, 175); ctx.lineTo(264, 175); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d98ca0'; ctx.font = 'italic 22px serif'; ctx.fillText('purr.', 380, 340);
  } else if (kind === 2) {    // coffee botanical
    ctx.fillStyle = '#efe6d8'; ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#4b6b3f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(256, 360); ctx.quadraticCurveTo(240, 200, 270, 60); ctx.stroke();
    for (let i = 0; i < 7; i++) { const y = 90 + i * 38; const dir = i % 2 ? 1 : -1; ctx.fillStyle = i % 2 ? '#5d8a4c' : '#4b6b3f'; ctx.beginPath(); ctx.ellipse(256 + dir * 40, y, 44, 16, dir * 0.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#a0413b'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(250 + Math.sin(i) * 20, 120 + i * 45, 8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#6b4a32'; ctx.font = '20px serif'; ctx.fillText('Coffea arabica', 180, 350);
  } else {                    // geometric mid-century
    ctx.fillStyle = '#2b2531'; ctx.fillRect(0, 0, 512, 384);
    const cols = ['#d98ca0', '#e9b5a0', '#f4c2cf', '#6b4a32', '#c8b8a8'];
    for (let i = 0; i < 14; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(60 + (i % 7) * 66, 110 + Math.floor(i / 7) * 160, 34 + (i % 3) * 8, 0, Math.PI * (1 + (i % 2))); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  return toTexture(c, { aniso: false });
}

function bookSpinesTexture(seed = 1) {
  const [c, ctx] = canvas2d(1024, 256); const N = makeNoise(seed);
  ctx.fillStyle = '#1d1712'; ctx.fillRect(0, 0, 1024, 256);
  let x = 4; const palette = ['#7d3b3b', '#2f4d6b', '#4a6b3f', '#b08b4e', '#3a3a52', '#a35b45', '#d9c6a5', '#5a2f4b', '#2c5f5a', '#e0d6c4'];
  while (x < 1000) {
    const w = 22 + Math.floor(N.n2(x * 0.3, seed) * 14 + 14), h = 175 + Math.floor(N.n2(x * 0.1, 3) * 40);
    const lean = N.n2(x * 0.05, 9) > 0.55;
    ctx.fillStyle = palette[Math.floor(Math.abs(N.n2(x * 0.11, 5)) * palette.length) % palette.length];
    ctx.save(); if (lean) { ctx.translate(x + w / 2, 256); ctx.rotate(-0.12); ctx.translate(-x - w / 2, -256); }
    ctx.fillRect(x, 256 - h, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, 256 - h, 3, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + w - 3, 256 - h, 3, h);
    ctx.fillStyle = 'rgba(240,230,210,0.7)'; ctx.fillRect(x + 4, 256 - h + 14, w - 8, 3); ctx.fillRect(x + 4, 256 - h + 22, w - 8, 3);
    ctx.restore(); x += w + 2 + (N.n2(x, 1) > 0.7 ? 20 : 0);
  }
  return toTexture(c, { aniso: false });
}

function leafTexture(kind = 'monstera') {
  const [c, ctx] = canvas2d(256, 256); ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#5f9a4a'); g.addColorStop(1, '#2f5f2c'); ctx.fillStyle = g;
  if (kind === 'monstera') {
    ctx.beginPath(); ctx.moveTo(128, 250); ctx.bezierCurveTo(10, 200, 10, 60, 128, 8); ctx.bezierCurveTo(246, 60, 246, 200, 128, 250); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) { const y = 60 + i * 30, s = i % 2 ? 1 : -1; ctx.beginPath(); ctx.ellipse(128 + s * 70, y, 48, 11, s * 0.3, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(30,70,30,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(128, 250); ctx.lineTo(128, 12); ctx.stroke();
  } else if (kind === 'fern') {
    ctx.strokeStyle = '#3d7a30'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(128, 250); ctx.lineTo(128, 10); ctx.stroke();
    for (let i = 0; i < 16; i++) { const y = 20 + i * 14, len = 60 * Math.sin((i / 16) * Math.PI) + 12; ctx.fillStyle = i % 2 ? '#4f8d3c' : '#3f7a32'; ctx.beginPath(); ctx.ellipse(128 - len / 2, y, len / 2, 6, 0.15, 0, TAU); ctx.ellipse(128 + len / 2, y, len / 2, 6, -0.15, 0, TAU); ctx.fill(); }
  } else {   // snake plant blade
    const g2 = ctx.createLinearGradient(0, 0, 256, 0); g2.addColorStop(0, '#2f5f2c'); g2.addColorStop(0.5, '#7fae55'); g2.addColorStop(1, '#2f5f2c'); ctx.fillStyle = g2;
    ctx.beginPath(); ctx.moveTo(100, 256); ctx.quadraticCurveTo(60, 100, 128, 0); ctx.quadraticCurveTo(196, 100, 156, 256); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,40,0,0.35)'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(105 + i * 10, 250); ctx.quadraticCurveTo(80 + i * 22, 100, 128, 4); ctx.stroke(); }
    ctx.strokeStyle = '#e8d97a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(100, 256); ctx.quadraticCurveTo(60, 100, 128, 0); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function chalkText(ctx, text, x, y, size, color = '#f1eadc', font = 'DM Serif Display, serif', align = 'left') {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function menuBoardTexture() {
  const [c, ctx] = canvas2d(1024, 640);
  ctx.fillStyle = '#1f2420'; ctx.fillRect(0, 0, 1024, 640);
  const N = makeNoise(4); const img = ctx.getImageData(0, 0, 1024, 640);
  for (let i = 0; i < img.data.length; i += 4) { const x = (i / 4) % 1024, y = Math.floor(i / 4 / 1024); const n = N.fbm(x / 60, y / 60, 3) * 14 + 6; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  chalkText(ctx, 'The Rose Teacup', 512, 92, 64, '#f4c2cf', 'DM Serif Display, serif', 'center');
  ctx.strokeStyle = 'rgba(241,234,220,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(160, 118); ctx.lineTo(864, 118); ctx.stroke();
  const items = [['Espresso', '3'], ['Cortado', '3.5'], ['Flat white', '4.5'], ['Rose latte', '5'], ['Honey oat cappuccino', '5'], ['Pour-over · single origin', '5.5'], ['Cardamom bun', '4'], ['Catnip cookie (for the cats)', '—']];
  items.forEach(([n, p], i) => { const y = 175 + i * 52; chalkText(ctx, n, 120, y, 34); chalkText(ctx, p, 900, y, 34, '#f1eadc', 'Inter, sans-serif', 'right'); ctx.strokeStyle = 'rgba(241,234,220,0.25)'; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(130 + ctx.measureText(n).width + 20, y - 8); ctx.lineTo(820, y - 8); ctx.stroke(); ctx.setLineDash([]); });
  chalkText(ctx, '☕  cats are staff. please do not feed them espresso.', 512, 612, 22, '#c8b8a8', 'Inter, sans-serif', 'center');
  return toTexture(c, { aniso: false });
}

// The daily task board: re-rendered whenever the checklist changes (see ui.js)
function drawTaskBoard(ctx, W_, H_) {
  ctx.fillStyle = '#20241f'; ctx.fillRect(0, 0, W_, H_);
  const N = makeNoise(8); const img = ctx.getImageData(0, 0, W_, H_);
  for (let i = 0; i < img.data.length; i += 16) { const x = (i / 4) % W_, y = Math.floor(i / 4 / W_); const n = N.fbm(x / 50, y / 50, 2) * 10 + 5; for (let k = 0; k < 16; k += 4) { img.data[i + k] += n; img.data[i + k + 1] += n; img.data[i + k + 2] += n; } }
  ctx.putImageData(img, 0, 0);
  let prog = { done: 0, total: 0, pct: 0 }, todays = [];
  try { prog = getProgress(); todays = getTasksForToday(); } catch (e) {}
  const d = new Date();
  chalkText(ctx, 'Today', 60, 78, 54, '#f4c2cf');
  chalkText(ctx, d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), W_ - 60, 78, 26, '#c8b8a8', 'Inter, sans-serif', 'right');
  ctx.strokeStyle = 'rgba(241,234,220,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, 100); ctx.lineTo(W_ - 60, 100); ctx.stroke();
  let y = 150; const rows = []; 
  todays.forEach(t => {
    const hasSubs = t.subtasks && t.subtasks.length; let done = false; try { done = isTaskDone(t); } catch (e) {}
    rows.push({ name: t.name, done, sub: false, color: (getCat(t.category) || {}).color });
    if (hasSubs) t.subtasks.forEach(s => { let sd = false; try { sd = isDone(s.id, t); } catch (e) {} rows.push({ name: s.name, done: sd, sub: true }); });
  });
  const maxRows = 13; const shown = rows.slice(0, maxRows);
  shown.forEach(r => {
    const x = r.sub ? 120 : 70; ctx.strokeStyle = r.done ? '#9ad39a' : 'rgba(241,234,220,0.8)'; ctx.lineWidth = 3; ctx.strokeRect(x, y - 24, 26, 26);
    if (r.done) { ctx.strokeStyle = '#9ad39a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 5, y - 11); ctx.lineTo(x + 11, y - 4); ctx.lineTo(x + 23, y - 21); ctx.stroke(); }
    if (r.color && !r.sub) { ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(x - 20, y - 11, 6, 0, TAU); ctx.fill(); }
    chalkText(ctx, r.name.length > 40 ? r.name.slice(0, 39) + '…' : r.name, x + 42, y - 4, r.sub ? 24 : 28, r.done ? 'rgba(241,234,220,0.45)' : '#f1eadc', 'Inter, sans-serif');
    if (r.done) { ctx.strokeStyle = 'rgba(241,234,220,0.45)'; ctx.lineWidth = 2; const w = ctx.measureText(r.name.length > 40 ? r.name.slice(0, 39) + '…' : r.name).width; ctx.beginPath(); ctx.moveTo(x + 42, y - 13); ctx.lineTo(x + 42 + w, y - 13); ctx.stroke(); }
    y += r.sub ? 38 : 44;
  });
  if (rows.length > maxRows) chalkText(ctx, `… and ${rows.length - maxRows} more on the clipboard`, 70, y, 22, '#c8b8a8', 'Inter, sans-serif');
  if (!rows.length) chalkText(ctx, 'Nothing scheduled for today — enjoy a coffee with the cats.', 70, 170, 26, '#c8b8a8', 'Inter, sans-serif');
  // progress cup
  const px = W_ - 130, py = H_ - 120;
  ctx.strokeStyle = '#f1eadc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px - 50, py - 50); ctx.lineTo(px - 40, py + 40); ctx.quadraticCurveTo(px, py + 60, px + 40, py + 40); ctx.lineTo(px + 50, py - 50); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(px, py - 50, 50, 12, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(px + 62, py, 22, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  const fillH = 90 * (prog.pct / 100); ctx.fillStyle = 'rgba(217,140,160,0.75)'; ctx.fillRect(px - 42, py + 42 - fillH, 84, fillH);
  chalkText(ctx, `${prog.pct}%`, px, py + 100, 30, '#f4c2cf', 'Inter, sans-serif', 'center');
  chalkText(ctx, `${prog.done} / ${prog.total} done`, px, py + 128, 20, '#c8b8a8', 'Inter, sans-serif', 'center');
  if (prog.total && prog.pct === 100) chalkText(ctx, '✿ all done — treat time ✿', W_ / 2, H_ - 40, 28, '#f4c2cf', 'DM Serif Display, serif', 'center');
}
