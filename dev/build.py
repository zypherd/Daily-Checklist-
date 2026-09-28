#!/usr/bin/env python3
"""Assemble index.html = original checklist (assets + logic preserved) + 3D café layer."""
import re, sys, os
S = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(S, 'src')
orig = open(os.path.join(S, 'classic_index.html')).read()
def rd(n): return open(os.path.join(SRC, n)).read()

css3d = rd('cafe3d.css')
html3d = rd('cafe3d.html')
js_parts = ['core.js','textures.js','room.js','post.js','exterior.js','props.js','nav.js','cat_model.js','cat_ai.js','avatar.js','npc.js','world.js','player.js','audio.js','ui.js','main.js']
js3d = '\n'.join(f'// ═══════════ {p} ═══════════\n' + rd(p) for p in js_parts)

out = orig
# 1. title + import map + 3D css
out = out.replace('<title>Daily Checklist</title>',
  '<title>Daily Checklist — The Rose Teacup Café</title>\n'
  '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",'
  '"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>', 1)
assert out.count('</style>') == 1
out = out.replace('</style>', css3d + '\n</style>', 1)
# 2. extra markup (3D container, HUD) right before the app grid
assert out.count('<div class="app">') == 1
out = out.replace('<div class="app">', html3d + '\n<div class="app">', 1)

# 3. patches to the original checklist script
def patch(old, new, count=1):
    global out
    assert out.count(old) == count, (old[:60], out.count(old))
    out = out.replace(old, new)

patch("""function spawnRewardCat() {
  roamCat(CAT_BREEDS[Math.floor(Math.random() * CAT_BREEDS.length)]);
}""", """function spawnRewardCat() {
  if (window.Cafe3D && Cafe3D.active) { Cafe3D.onTaskCompleted(); return; }
  roamCat(CAT_BREEDS[Math.floor(Math.random() * CAT_BREEDS.length)]);
}""")
patch("""function seedBaselineCats() {
  BASELINE_BREEDS""", """function seedBaselineCats() {
  if (document.body.classList.contains('mode-3d')) return; // 3D cats live in the scene instead
  BASELINE_BREEDS""")
patch("""  renderTasks();
  updateProgress();
  renderCup();
}""", """  renderTasks();
  updateProgress();
  renderCup();
  if (window.Cafe3D && Cafe3D.active) Cafe3D.onChecklistRender();
}""")
patch("""(() => {
  const bg = document.getElementById('cafe-bg');
  bg.addEventListener('load', () => repositionCatsForViewport());
  bg.src = CAFE_BG;
})();
checkMidnight();
buildCup();
render();
seedBaselineCats();
""", """// ─── VIEW MODE: 3D café (default when WebGL is available) or the classic 2D café ──
const PREFER_3D = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('classic')) return false;
    if (q.has('3d')) return true;
    if (store.getItem('checklist_view_mode') === 'classic') return false;
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
})();
function enterClassicMode(reason) {
  document.body.classList.remove('mode-3d');
  const ld = document.getElementById('cafe-loading'); if (ld) ld.remove();
  const bg = document.getElementById('cafe-bg');
  bg.addEventListener('load', () => repositionCatsForViewport());
  bg.src = CAFE_BG;
  seedBaselineCats();
  if (reason) { console.warn('3D café unavailable:', reason); setTimeout(() => showToast('3D café unavailable here — showing the classic café'), 600); }
}
checkMidnight();
buildCup();
render();
if (PREFER_3D) document.body.classList.add('mode-3d'); else enterClassicMode();
// Safety net: if the 3D module never evaluates (old browser, script blocked), fall back to the classic café.
if (PREFER_3D) setTimeout(() => { if (!window.Cafe3D) enterClassicMode('3D module did not start'); }, 8000);
""")
patch("""      <button class="btn btn-danger" onclick="confirmReset()">↺ Reset Day</button>
    </div>""", """      <button class="btn btn-danger" onclick="confirmReset()">↺ Reset Day</button>
      <button class="btn" id="btn-3d" title="Open the 3D café" onclick="store.setItem('checklist_view_mode','3d');location.href=location.pathname+'?3d'">🐈 3D Café</button>
    </div>""")
patch("</script>\n</body>", "</script>\n<script type=\"module\">\n" + js3d + "\n</script>\n</body>")
open(os.path.join(os.path.dirname(S), 'index.html'), 'w').write(out)
print('built', len(out), 'bytes')
