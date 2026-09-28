#!/usr/bin/env python3
"""Fetch and pack the real-world assets for The Rose Teacup (all CC0, from polyhaven.com).

  python3 dev/fetch_assets.py [--cache DIR] [--skip-models]

Produces assets/ next to index.html:
  sky/*.jpg           13 captured pure-sky HDRIs (the Qwantani day/night series) packed as gamma-1/4 JPGs
  tex/<id>/*.webp     scanned PBR texture sets (diffuse / GL normal / AO-rough-metal)
  models/<id>.glb     scanned furniture & props, Draco-compressed, WebP textures (via gltf-transform)
  manifest.json       what exists + sky frame statistics + physical texture sizes
  CREDITS.md          authors
The 3D café works without this folder (procedural fallback); with it, the world upgrades as files stream in.
Needs: pip install --user pillow numpy ; node/npx for the models.
"""
import json, os, re, sys, time, argparse, subprocess, concurrent.futures, urllib.request, shutil
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
UA = {'User-Agent': 'Mozilla/5.0 rose-teacup-asset-fetch'}
API = 'https://api.polyhaven.com'

# ── what we use ──────────────────────────────────────────────────────────────────
SKY = [  # (asset id, game hour, kind)  — one location, one day, sun/moon at the same azimuth in every frame
    ('qwantani_night_puresky', 3.5, 'night'), ('qwantani_dawn_puresky', 5.4, 'dawn'), ('qwantani_sunrise_puresky', 6.2, 'sun'),
    ('qwantani_morning_puresky', 7.8, 'sun'), ('qwantani_mid_morning_puresky', 9.8, 'sun'), ('qwantani_noon_puresky', 12.5, 'sun'),
    ('qwantani_afternoon_puresky', 15.0, 'sun'), ('qwantani_late_afternoon_puresky', 17.2, 'sun'), ('qwantani_sunset_puresky', 19.1, 'sun'),
    ('qwantani_dusk_1_puresky', 19.8, 'dusk'), ('qwantani_dusk_2_puresky', 20.4, 'dusk'), ('qwantani_moonrise_puresky', 21.0, 'moon'),
    ('qwantani_moon_noon_puresky', 0.5, 'moon')]
SKY_MARGIN = 64   # rows kept below the horizon (of a 1024-row equirect)
TEX = {  # id: output resolution
    'oak_wood_planks': 1024, 'wood_table_001': 1024, 'oak_veneer_01': 512, 'dark_wooden_planks': 1024, 'white_plaster_02': 1024,
    'plastered_wall_04': 1024, 'plastered_wall_03': 512, 'long_white_tiles': 1024, 'velour_velvet': 512, 'rough_linen': 512,
    'cotton_jersey': 512, 'curly_teddy_natural': 512, 'brown_leather': 512, 'hessian_230': 512, 'terry_cloth': 512, 'wool_boucle': 512,
    'aerial_beach_01': 1024, 'damp_beach_sand': 1024, 'wood_floor_deck': 1024, 'concrete_pavers_02': 1024, 'patio_tiles': 512,
    'coral_stone_wall': 1024, 'beige_wall_001': 1024, 'reed_roof_04': 1024, 'palm_tree_bark': 512, 'blue_floor_tiles_01': 512}
MODELS = ['dining_chair_02', 'round_wooden_table_01', 'wooden_table_02', 'bar_chair_round_01', 'Sofa_01', 'ArmChair_01', 'coffee_table_round_01',
          'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'ceiling_fan', 'modern_ceiling_lamp_01',
          'fancy_picture_frame_01', 'tea_set_01', 'CashRegister_01', 'outdoor_table_chair_set_01', 'lifebuoy', 'street_lamp_02',
          'stone_fire_pit', 'Lantern_01', 'modular_wooden_pier', 'wicker_basket_01', 'concrete_cat_statue', 'vintage_electric_kettle',]
MODEL_MAX_MB = 6.0

def get_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
def download(url, out):
    if os.path.exists(out) and os.path.getsize(out) > 100: return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read(); open(out, 'wb').write(data); return out
        except Exception as e:
            err = e; time.sleep(2)
    raise RuntimeError(f'download failed: {url}: {err}')

# ── Radiance .hdr reader (new-style RLE) ─────────────────────────────────────────
def read_hdr(path):
    data = open(path, 'rb').read(); p = 0
    while True:
        e = data.index(b'\n', p); line = data[p:e]; p = e + 1
        if line == b'': break
    e = data.index(b'\n', p); m = re.match(r'-Y (\d+) \+X (\d+)', data[p:e].decode()); p = e + 1
    H, W = int(m.group(1)), int(m.group(2)); buf = np.frombuffer(data, dtype=np.uint8); out = np.empty((H, W, 4), dtype=np.uint8)
    for y in range(H):
        assert buf[p] == 2 and buf[p + 1] == 2, 'old-style RLE not supported'; p += 4
        for c in range(4):
            x = 0; row = out[y, :, c]
            while x < W:
                n = int(buf[p]); p += 1
                if n > 128: n -= 128; row[x:x + n] = buf[p]; p += 1; x += n
                else: row[x:x + n] = buf[p:p + n]; p += n; x += n
    e = out[..., 3].astype(np.int32); scale = np.where(e == 0, 0.0, np.ldexp(1.0, e - 136)).astype(np.float32)
    rgb = (out[..., :3].astype(np.float32) + 0.5) * scale[..., None]; rgb[e == 0] = 0
    return rgb

def process_sky(cache, credits):
    frames = []; os.makedirs(os.path.join(OUT, 'sky'), exist_ok=True)
    for fid, hour, kind in SKY:
        files = get_json(f'{API}/files/{fid}'); info = get_json(f'{API}/info/{fid}')
        credits.append(('HDRI', fid, info.get('authors', {})))
        hdr = download(files['hdri']['2k']['hdr']['url'], os.path.join(cache, 'hdr', fid + '_2k.hdr'))
        img = read_hdr(hdr); H, W, _ = img.shape
        lum = img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32); ul = lum[:H // 2]; upper = img[:H // 2]
        mx = ul.max(); ys, xs = np.where(ul > mx * 0.5); cy, cx = ys.mean(), xs.mean()
        az = ((cx + 0.5) / W - 0.5) * 360; el = (0.5 - (cy + 0.5) / H) * 180
        clipAt = float(np.percentile(ul, 99.5)); clipped = np.minimum(upper, clipAt)   # the sun's few pixels would otherwise dominate the averages
        zenith = clipped[:H // 12].reshape(-1, 3).mean(0); horizon = np.minimum(img[H // 2 - H // 45:H // 2], clipAt).reshape(-1, 3).mean(0); mean = clipped.reshape(-1, 3).mean(0)
        S = float(np.percentile(ul, 99.97)) * 1.6            # everything below this is kept; only the sun core clips
        enc = np.clip(img[:H // 2 + SKY_MARGIN] / S, 0, 1) ** 0.25 * 255 + np.random.default_rng(1).uniform(-0.5, 0.5, (H // 2 + SKY_MARGIN, W, 3)).astype(np.float32)
        name = fid.replace('qwantani_', '').replace('_puresky', '')
        Image.fromarray(np.clip(np.rint(enc), 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'sky', name + '.jpg'), quality=90, subsampling=0, optimize=True)
        frames.append({'id': name, 'src': fid, 'file': f'sky/{name}.jpg', 'hour': hour, 'kind': kind, 'scale': S, 'bodyAz': float(az), 'bodyEl': float(el) if kind in ('sun', 'moon') else None,
                       'zenith': [float(v) for v in zenith], 'horizon': [float(v) for v in horizon], 'mean': [float(v) for v in mean], 'p50': float(np.percentile(ul, 50))})
        print(f'  sky {name:15s} hour {hour:5.1f}  body el {el:5.1f}  scale {S:6.2f}')
    return {'margin': SKY_MARGIN, 'width': 2048, 'height': 1024, 'frames': frames}

def process_textures(cache, credits):
    out = {}
    for tid, res in TEX.items():
        try: files = get_json(f'{API}/files/{tid}'); info = get_json(f'{API}/info/{tid}')
        except Exception as e: print('  ! texture', tid, e); continue
        credits.append(('Texture', tid, info.get('authors', {})))
        raw = {}
        for k in ('Diffuse', 'nor_gl', 'arm', 'Rough', 'AO'):
            if k in files and '1k' in files[k] and 'jpg' in files[k]['1k']: raw[k] = download(files[k]['1k']['jpg']['url'], os.path.join(cache, 'tex', tid, k + '.jpg'))
        if 'Diffuse' not in raw: print('  ! no diffuse for', tid); continue
        d = os.path.join(OUT, 'tex', tid); os.makedirs(d, exist_ok=True); maps = []
        def save(img, name, q): img.resize((res, res), Image.LANCZOS).save(os.path.join(d, name + '.webp'), quality=q, method=5); maps.append(name)
        save(Image.open(raw['Diffuse']).convert('RGB'), 'diff', 82)
        if 'nor_gl' in raw: save(Image.open(raw['nor_gl']).convert('RGB'), 'nor', 88)
        if 'arm' in raw: save(Image.open(raw['arm']).convert('RGB'), 'arm', 80)
        elif 'Rough' in raw:
            r = Image.open(raw['Rough']).convert('L'); a = Image.open(raw['AO']).convert('L').resize(r.size) if 'AO' in raw else Image.new('L', r.size, 255)
            save(Image.merge('RGB', (a, r, Image.new('L', r.size, 0))), 'arm', 80)
        dims = info.get('dimensions') or [1000, 1000]
        out[tid] = {'size': round(dims[0] / 1000, 3), 'res': res, 'maps': maps, 'name': info.get('name')}
        print(f'  tex {tid:24s} {res}px  {out[tid]["size"]} m  {maps}')
    return out

def process_models(cache, credits):
    out = {}; os.makedirs(os.path.join(OUT, 'models'), exist_ok=True)
    npx = shutil.which('npx') or os.path.expanduser('~/Claude/Scheduled/.toolchain/node/bin/npx')
    for mid in MODELS:
        try: files = get_json(f'{API}/files/{mid}'); info = get_json(f'{API}/info/{mid}')
        except Exception as e: print('  ! model', mid, e); continue
        if 'gltf' not in files: print('  ! no glTF for', mid); continue
        res = '1k' if '1k' in files['gltf'] else sorted(files['gltf'])[0]; g = files['gltf'][res]['gltf']
        src = download(g['url'], os.path.join(cache, 'models', mid, mid + '.gltf'))
        for path, v in g.get('include', {}).items(): download(v['url'], os.path.join(cache, 'models', mid, path))
        dst = os.path.join(OUT, 'models', mid + '.glb')
        if not os.path.exists(dst):
            cmd = [npx, '--yes', '@gltf-transform/cli@4', 'optimize', src, dst, '--compress', 'draco', '--texture-compress', 'webp', '--texture-size', '1024', '--simplify-error', '0.0005']
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0 or not os.path.exists(dst): print('  ! gltf-transform failed for', mid, r.stderr[-400:]); continue
        mb = os.path.getsize(dst) / 1e6
        if mb > MODEL_MAX_MB: print(f'  ! {mid} is {mb:.1f} MB — dropped'); os.remove(dst); continue
        credits.append(('Model', mid, info.get('authors', {})))
        dims = info.get('dimensions') or [0, 0, 0]
        out[mid] = {'file': f'models/{mid}.glb', 'dims': [round(v / 1000, 3) for v in dims], 'name': info.get('name'), 'mb': round(mb, 2)}
        print(f'  model {mid:28s} {mb:5.2f} MB  dims {out[mid]["dims"]}')
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--cache', default=os.path.join(ROOT, 'dev', '.cache')); ap.add_argument('--skip-models', action='store_true'); ap.add_argument('--skip-sky', action='store_true'); ap.add_argument('--skip-tex', action='store_true')
    a = ap.parse_args(); os.makedirs(OUT, exist_ok=True); credits = []
    mpath = os.path.join(OUT, 'manifest.json'); manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    manifest['version'] = 1; manifest['generated'] = time.strftime('%Y-%m-%d')
    if not a.skip_sky: print('sky'); manifest['sky'] = process_sky(a.cache, credits)
    if not a.skip_tex: print('textures'); manifest['textures'] = process_textures(a.cache, credits)
    if not a.skip_models: print('models'); manifest['models'] = process_models(a.cache, credits)
    json.dump(manifest, open(mpath, 'w'), indent=1)
    if credits:
        lines = ['# Asset credits', '', 'Every file in this folder comes from [Poly Haven](https://polyhaven.com) and is released under CC0 (public domain). Thank you to the artists:', '']
        for kind, aid, authors in credits: lines.append(f'- {kind} `{aid}` — {", ".join(authors) if authors else "Poly Haven"}')
        lines += ['', 'Skies: the Qwantani pure-sky series (one location captured through a full day), packed by `dev/fetch_assets.py` into gamma-encoded JPGs with the sun position and brightness statistics stored in `manifest.json`.', 'Models were optimised with gltf-transform (Draco meshes, WebP textures).']
        open(os.path.join(OUT, 'CREDITS.md'), 'w').write('\n'.join(lines) + '\n')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(f'assets/ = {total / 1e6:.1f} MB')

if __name__ == '__main__': main()
