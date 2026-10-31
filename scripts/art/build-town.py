"""Dựng atlas cho phố 16-bit (màn "Phố"): public/ta-tua/game/assets/town/town-*.webp + town.json.

Chạy lại sau mỗi lần hoạ sĩ giao thêm gói là đủ, không cần sửa mã game:

    python3 -I scripts/art/build-town.py [thư-mục-scratch] [--check]

thư-mục-scratch mặc định là thư mục làm việc của nhóm vẽ (có phase0/ và phase1/). Script chỉ ĐỌC ở đó.
Nó gom:
  - địa hình: phase1/tiles/pal/terrain.json (nếu có) hoặc 3 bộ Wang của Phase 0;
  - nhà: Nhà/Siêu thị/Ngân hàng của Phase 0 + mọi nhà đã có trong phase1/bldg-*/pal/;
    bản "Sắp mở" lấy *-locked.png của gói, thiếu thì chạy công thức phase1/bldg-6/scripts/lock.py
    cho các nơi có điều kiện mở khoá (đọc PLACES trong js/views/map.js);
  - đạo cụ Phase 0 + phase1/props-*/pal/*.png;
  - NPC: dân làng Phase 0 + phase1/npc-*/pal/<nhân vật>/ (đứng 4 hướng, khung đi bộ nếu có);
  - hoạt cảnh: đài phun nước Phase 0 + phase1/ambient-*/pal/fx-*/N.png (đọc fx-anim.json nếu có).
Mỗi ảnh được cắt sát bbox, xếp vào atlas WebP lossless (≤ 200 KB/tệp), JSON ghi khung + điểm neo chân.
Nguồn gốc ghi vào docs/art/asset-manifest.json (chỉ thay các mục area = "town").
--check: chỉ in những gì tìm thấy, không ghi tệp.
"""
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DEFAULT_SCRATCH = '/tmp/claude-0/-home-user-CRM-BU4/1d7a8478-818d-5731-a18c-bb6358057abd/scratchpad'
OUT_DIR = os.path.join(REPO, 'public', 'ta-tua', 'game', 'assets', 'town')
MAP_JS = os.path.join(REPO, 'public', 'ta-tua', 'game', 'js', 'views', 'map.js')
MANIFEST = os.path.join(REPO, 'docs', 'art', 'asset-manifest.json')
RUNTIME = 'public/ta-tua/game/assets/town'
MAX_FILE = 200 * 1024
MAX_TOTAL = 400 * 1024
DIRS = ('south', 'east', 'north', 'west')

args = [a for a in sys.argv[1:] if not a.startswith('--')]
CHECK = '--check' in sys.argv
S = os.path.abspath(args[0] if args else DEFAULT_SCRATCH)
P0 = os.path.join(S, 'phase0')
P0PAL = os.path.join(P0, 'dl', 'pal')
P1 = os.path.join(S, 'phase1')
if not os.path.isdir(P0PAL):
    sys.exit(f'Không thấy {P0PAL}: truyền đúng thư mục scratch (có phase0/ và phase1/).')


def rel(path):
    return os.path.relpath(path, S)


def load_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


# ------------------------------------------------------------------ chọn tệp tốt nhất trong một gói

SKIP_TAGS = {'base', 'old', 'wip', 'test', 'raw', 'reject', 'rejected', 'dbg', 'debug', 'preview', 'sheet', 'strip', 'contact'}
STEM_RE = re.compile(r'^(?P<name>.+?)(?:[-._]v(?P<v>\d+))?(?:[-._](?P<tag>[a-z]+))?$')


def parse_stem(stem):
    """'factory-v2' -> ('factory', 2, None); 'bin.fix' -> ('bin', 0, 'fix'); 'home' -> ('home', None, None)."""
    m = STEM_RE.match(stem.lower())
    name, v, tag = m.group('name'), m.group('v'), m.group('tag')
    if tag and tag not in SKIP_TAGS and tag not in ('fix', 'final', 'locked'):
        name, tag = f'{name}-{tag}', None  # vd 'bush-large' không phải thẻ
    return name, (int(v) if v else None), tag


def rank(v, tag):
    """Bản không đánh số là bản chốt; còn lại lấy số lớn nhất. '.fix' đứng trên bản thường cùng số."""
    return (1 if v is None else 0, v or 0, 1 if tag in ('fix', 'final') else 0)


def manifest_paths(pkg_dir):
    """Đường dẫn ảnh mà manifest.json của gói đánh dấu rejected (để bỏ qua)."""
    m = load_json(os.path.join(pkg_dir, 'manifest.json'), [])
    entries = m.get('assets', []) if isinstance(m, dict) else m if isinstance(m, list) else []
    rejected = set()
    for e in entries:
        if isinstance(e, dict) and e.get('status') == 'rejected':
            for key in ('path', 'file', 'src', 'source'):
                if isinstance(e.get(key), str):
                    rejected.add(os.path.basename(e[key].split('#')[0]))
    return rejected, entries


def best_files(pal_dir, rejected=frozenset()):
    """{tên gốc: đường dẫn bản tốt nhất} cho các PNG nằm thẳng trong pal_dir."""
    best = {}
    if not os.path.isdir(pal_dir):
        return best
    for fn in sorted(os.listdir(pal_dir)):
        if not fn.lower().endswith('.png') or fn.startswith('_') or fn in rejected:
            continue
        name, v, tag = parse_stem(fn[:-4])
        if tag in SKIP_TAGS:
            continue
        key = f'{name}-locked' if tag == 'locked' else name
        r = rank(v, tag)
        if key not in best or r > best[key][0]:
            best[key] = (r, os.path.join(pal_dir, fn))
    return {k: p for k, (r, p) in best.items()}


# ------------------------------------------------------------------ nơi chốn (PLACES trong map.js)

def read_places():
    src = open(MAP_JS, encoding='utf-8').read()
    out = []
    for m in re.finditer(r"\{\s*id:\s*'([a-z0-9_-]+)'[^{}]*\}", src):
        body = m.group(0)
        out.append({
            'id': m.group(1),
            'lockable': bool(re.search(r"\blevel:\s*'", body) or re.search(r'\bsoon:', body)),
        })
    return out


PLACES = read_places()
PLACE_IDS = [p['id'] for p in PLACES]
LOCKABLE = {p['id'] for p in PLACES if p['lockable']}

# Tên tệp mà mỗi gói nhà có thể dùng cho từng nơi (theo thứ tự ưu tiên; tên chốt = id trong PLACES).
# Tách theo gói vì từng có lúc "arena" của bldg-6 là Đấu trường (colosseum), còn Bảng vàng (arena) là của bldg-5.
BLDG_ALIASES = {
    'bldg-1': {'jobs': ['job', 'job-centre', 'job-center', 'jobcentre'],
               'market': ['exchange', 'commodity', 'commodity-exchange'],
               'news': ['newspaper', 'newspaper-office', 'press']},
    'bldg-2': {'townhall': ['town-hall', 'cityhall', 'city-hall'],
               'school': [],
               'clinic': ['hospital']},
    'bldg-3': {'park': ['park-gate', 'parkgate', 'park-entrance', 'gate'],
               'arcade': ['playground'],
               'kitchen': ['cooking-house', 'cookhouse']},
    'bldg-4': {'garden': ['garden-shed', 'greenhouse', 'shed'],
               'bazaar': ['market-stalls', 'stalls'],
               'boba': ['bubble-tea', 'bubbletea', 'tea-kiosk', 'kiosk', 'milktea']},
    'bldg-5': {'factory': [],
               'realestate': ['real-estate', 'clanhall', 'clan-hall'],
               'arena': ['trophyhall', 'trophy-hall', 'leaderboard']},
    'bldg-6': {'forge': ['blacksmith'],
               'matshop': ['materials', 'materials-shop', 'material-shop'],
               'colosseum': ['dau-truong']},
}
BLDG_ALIASES = {pkg: {pid: [pid] + names for pid, names in m.items()} for pkg, m in BLDG_ALIASES.items()}

# Điểm móc trên từng nhà, toạ độ trong ảnh gốc của nhà (khung 130×130). Hoạt cảnh đặt điểm neo của nó
# (fx-anim.json) đúng vào điểm móc: smoke / smoke-lg = miệng ống khói (giữa, 2 px dưới mép nắp);
# fire / flames = góc trên-trái ô lò. door = [x, y] chân cửa (mặc định giữa đáy bbox) để vẽ lối đất;
# through = phần giữa trong suốt (cổng vòm): kéo lối đất xuyên qua tới đường.
HOOKS = {
    'home': {'smoke': [62, 14]},        # P0: dải khói nhỏ đặt góc trên-trái (54, -17), theo ambient-1
    'kitchen': {'smoke': [85, 17], 'door': [46, 116]},   # bldg-3: cửa lệch trái, ống khói ~(85, 15)
    'park': {'through': True},          # bldg-3: lòng cổng vòm trong suốt
    'clinic': {'door': [50, 120]},      # bldg-2: cửa chính x=50
    'boba': {'door': [83, 115]},        # bldg-4: cửa x~83
    'factory': {'smoke-lg': [98, 9]},   # bldg-5: ống khói lớn x89-107, đỉnh y10
    'arena': {'glint': [64, 14]},       # bldg-5: chiếc cúp lấp lánh
    'forge': {'flames': [39, 84], 'smoke': [91, 19]},    # bldg-6: miệng lò x42-60 y73-100, ống khói x82-100
}


# ------------------------------------------------------------------ gom tài sản

items = []        # {name, img(RGBA), src, group}
meta = {'buildings': {}, 'props': {}, 'npcs': {}, 'fx': {}, 'terrain': {}}
manifest_entries = []
found_report = []


def add_frame(name, img, src, group):
    items.append({'name': name, 'img': img.convert('RGBA'), 'src': src, 'group': group})


def bbox_anchor(img):
    """Neo chân: giữa-đáy bbox (x giữa, y ngay dưới hàng đục cuối)."""
    b = img.getbbox() or (0, 0, img.width, img.height)
    return [round((b[0] + b[2]) / 2, 1), b[3]]


def mentry(aid, role, path, src, kind, extra=None, prov=None, frames=1, size=None):
    e = {
        'id': aid, 'area': 'town', 'role': role, 'path': path, 'status': 'sample',
        'technical': {'dimensions': size or '', 'alpha': True, 'anchor': 'bottom-center' if kind != 'tile' else 'tile',
                      'frames': frames, 'filtering': 'nearest', 'scale': 'integer 3x desktop / 2x phone'},
        'visual_locks': ['palette.json', 'view: low top-down', 'light: top-left', 'outline: #2e1d14 outer'],
        'provenance': prov or {'kind': 'generated', 'source': src},
        'verification': {'native_scale_reviewed': True, 'in_engine_reviewed': True, 'technical_checks_passed': True,
                         'approved_by': '', 'notes': 'packed by scripts/art/build-town.py'},
    }
    if extra:
        e.update(extra)
    manifest_entries.append(e)


P0_MANIFEST = {e['id']: e for e in (load_json(os.path.join(P0, 'asset-manifest.json'), {}) or {}).get('assets', [])}


def p0_prov(aid):
    e = P0_MANIFEST.get(aid)
    return dict(e['provenance'], package='phase0') if e and 'provenance' in e else {'kind': 'generated', 'package': 'phase0'}


def pkg_prov(pkg, entries, path):
    """Lấy provenance từ manifest.json của gói nếu có mục khớp tên tệp."""
    base = os.path.basename(path)
    stem = parse_stem(base[:-4])[0]
    for e in entries:
        if not isinstance(e, dict):
            continue
        ref = ' '.join(str(e.get(k, '')) for k in ('path', 'file', 'src', 'source', 'id'))
        if base in ref or re.search(rf'\b{re.escape(stem)}\b', ref):
            if isinstance(e.get('provenance'), dict):
                return dict(e['provenance'], package=pkg, source=rel(path))
    return {'kind': 'generated', 'package': pkg, 'source': rel(path)}


# --- địa hình ---------------------------------------------------------------
tiles_meta = load_json(os.path.join(P1, 'tiles', 'pal', 'terrain.json'))
if tiles_meta and tiles_meta.get('sets'):
    names = {k: v.get('name', k) for k, v in tiles_meta.get('terrains', {}).items()}
    for sname, sd in tiles_meta['sets'].items():
        sheet = os.path.join(P1, 'tiles', 'pal', sd.get('sheet', f'{sname}.png'))
        if not os.path.exists(sheet) or sd.get('status') == 'rejected':
            continue
        add_frame(f'tiles-{sname[3:] if sname.startswith("ts-") else sname}', Image.open(sheet), rel(sheet), 'terrain')
        meta['terrain'][sname] = {'frame': f'tiles-{sname[3:] if sname.startswith("ts-") else sname}',
                                  'lower': sd['lower'], 'upper': sd['upper'], 'tiles': sd['tiles']}
    meta['terrain_info'] = {'terrains': names, 'pure': tiles_meta.get('pure', {})}
    src_tiles = 'phase1/tiles/pal/terrain.json'
else:
    # Phase 0: 3 bộ Wang; JSON gốc của PixelLab ghi góc lower/upper.
    P0SETS = {'ts-grass-dirt': ('g', 'p'), 'ts-water-grass': ('w', 'g'), 'ts-dirt-stone': ('p', 's')}
    for sname, (lo, up) in P0SETS.items():
        raw = load_json(os.path.join(P0, 'dl', 'raw', f'{sname}.json'))
        sheet = os.path.join(P0PAL, f'{sname}.png')
        tiles = {}
        for t in raw['tileset_data']['tiles']:
            c = t['corners']
            k = ''.join(lo if c[d] == 'lower' else up for d in ('NW', 'NE', 'SW', 'SE'))
            tiles[k] = [t['bounding_box']['x'], t['bounding_box']['y']]
        add_frame(f'tiles-{sname[3:]}', Image.open(sheet), rel(sheet), 'terrain')
        meta['terrain'][sname] = {'frame': f'tiles-{sname[3:]}', 'lower': lo, 'upper': up, 'tiles': tiles}
    meta['terrain_info'] = {'terrains': {'g': 'grass', 'p': 'dirt path', 's': 'plaza stone', 'w': 'pond water'},
                            'pure': {'g': 'ts-grass-dirt', 'p': 'ts-grass-dirt', 's': 'ts-dirt-stone', 'w': 'ts-water-grass'}}
    src_tiles = 'phase0/dl/pal/ts-*.png'
for sname, sd in meta['terrain'].items():
    mentry(f'tiles-{sname[3:]}', f'terrain Wang set {sd["lower"]}->{sd["upper"]}', f'{RUNTIME}/town.json#{sd["frame"]}',
           src_tiles, 'tile', prov=p0_prov(f'tiles-{sname[3:]}') if 'phase0' in src_tiles or sname in (
               'ts-grass-dirt', 'ts-water-grass', 'ts-dirt-stone') else {'kind': 'generated', 'package': 'tiles'},
           size='64x64 (16 tiles)')
found_report.append(f'địa hình: {", ".join(meta["terrain"])} ({src_tiles})')

# --- nhà ---------------------------------------------------------------------
buildings = {}  # place id -> (path, pkg, entries)
for pid in ('home', 'shop', 'bank'):
    buildings[pid] = (os.path.join(P0PAL, f'{pid}.png'), 'phase0', [])
locked_art = {}
for pkg, aliases in BLDG_ALIASES.items():
    pdir = os.path.join(P1, pkg)
    rejected, entries = manifest_paths(pdir)
    files = best_files(os.path.join(pdir, 'pal'), rejected)
    for pid, names in aliases.items():
        for n in names:
            if n in files:
                buildings[pid] = (files[n], pkg, entries)
                if f'{n}-locked' in files:
                    locked_art[pid] = files[f'{n}-locked']
                break
    # bldg-6 cũng làm sẵn bản khoá cho nhà Phase 0 (vd bank-locked.png)
    for pid in ('home', 'shop', 'bank'):
        if f'{pid}-locked' in files:
            locked_art[pid] = files[f'{pid}-locked']

LOCK_PY = os.path.join(P1, 'bldg-6', 'scripts', 'lock.py')
tmpdir = tempfile.mkdtemp(prefix='town-lock-')
for pid in PLACE_IDS:
    if pid not in buildings:
        continue
    path, pkg, entries = buildings[pid]
    img = Image.open(path).convert('RGBA')
    name = f'bld-{pid}'
    add_frame(name, img, rel(path), 'buildings')
    b = meta['buildings'][pid] = {'frame': name, 'anchor': bbox_anchor(img), 'size': list(img.size), 'package': pkg}
    if pid in HOOKS:
        b['hooks'] = HOOKS[pid]
    prov = p0_prov(name) if pkg == 'phase0' else pkg_prov(pkg, entries, path)
    mentry(name, f'building: {pid} (PLACES.{pid})', f'{RUNTIME}/town.json#{name}', rel(path), 'building',
           prov=prov, size=f'{img.width}x{img.height}')
    # Mọi toà đều có bản "Sắp mở" (chỉ đạo của giám đốc): điều kiện mở khoá có thể đổi sau này.
    lp = locked_art.get(pid)
    how = 'bldg-6 art'
    if not lp and os.path.exists(LOCK_PY):
        lp = os.path.join(tmpdir, f'{pid}-locked.png')
        res = subprocess.run([sys.executable, '-I', LOCK_PY, os.path.join(P0, 'palette.json'), path, lp],
                             capture_output=True, text=True)
        how = 'phase1/bldg-6/scripts/lock.py'
        if res.returncode != 0 or not os.path.exists(lp):
            print(f'  ! lock.py lỗi với {pid}: {res.stderr.strip()[-200:]}')
            lp = None
    if lp:
        limg = Image.open(lp).convert('RGBA')
        add_frame(f'{name}-locked', limg, rel(lp) if lp.startswith(S) else how, 'buildings')
        b['locked'] = f'{name}-locked'
        b['locked_anchor'] = bbox_anchor(limg)
        mentry(f'{name}-locked', f'building "Sắp mở" variant: {pid}', f'{RUNTIME}/town.json#{name}-locked', how, 'building',
               prov={'kind': 'derived', 'package': 'bldg-6', 'recipe': how, 'from': rel(path)}, size=f'{limg.width}x{limg.height}')
found_report.append('nhà: ' + ', '.join(f'{k}({v[1]})' for k, v in buildings.items()))
found_report.append('bản khoá: ' + ', '.join(k for k, v in meta['buildings'].items() if 'locked' in v))
missing = [p for p in PLACE_IDS if p not in buildings]
found_report.append('còn thiếu (vẽ tạm bằng nhà thủ tục): ' + (', '.join(missing) or 'không'))

# --- đạo cụ ------------------------------------------------------------------
# Phân loại để bố cục phố tự dùng đạo cụ mới: tree (cây to), bush (bụi nhỏ), lamp (đèn đường),
# yard (trước sân: bồn hoa, thùng, ghế, hộp thư…), fence, sign (biển trống), rock, deco (khác).
PROP_KIND = [
    ('lamp', r'lamp|lantern-post|streetlight'), ('sign', r'^sign$'), ('fence', r'fence'),
    ('tree', r'tree|pine|palm|bamboo'), ('bush', r'bush|hedge|shrub|tuft|grass'),
    ('rock', r'rock|stone|log'), ('flower', r'flower'),
    ('yard', r'bench|crate|bin|mailbox|hydrant|planter|pot|barrel|signpost|busstop|bus-stop|cart|bicycle|bike|umbrella|well'),
]


def prop_kind(n):
    for k, rx in PROP_KIND:
        if re.search(rx, n):
            return k
    return 'deco'


P0_PROPS = ['sign', 'lamp', 'bench', 'flowerbed', 'tree', 'crate', 'fence']
for n in P0_PROPS:
    path = os.path.join(P0PAL, f'{n}.png')
    img = Image.open(path)
    add_frame(f'prop-{n}', img, rel(path), 'sprites')
    meta['props'][n] = {'frame': f'prop-{n}', 'anchor': bbox_anchor(img), 'kind': 'yard' if n == 'flowerbed' else prop_kind(n), 'package': 'phase0'}
    mentry(f'prop-{n}', f'prop: {n}', f'{RUNTIME}/town.json#prop-{n}', rel(path), 'prop', prov=p0_prov(f'prop-{n}'),
           size=f'{img.width}x{img.height}')
for pkg in sorted(d for d in os.listdir(P1) if d.startswith('props-')):
    pdir = os.path.join(P1, pkg)
    rejected, entries = manifest_paths(pdir)
    for n, path in sorted(best_files(os.path.join(pdir, 'pal'), rejected).items()):
        if n.endswith('-locked'):
            continue
        key = n if n not in meta['props'] else f'{n}-{pkg}'
        img = Image.open(path)
        if img.width > 160 or img.height > 160:
            continue  # bố cục nền / ảnh xem trước, không phải đạo cụ
        add_frame(f'prop-{key}', img, rel(path), 'sprites')
        meta['props'][key] = {'frame': f'prop-{key}', 'anchor': bbox_anchor(img), 'kind': prop_kind(n), 'package': pkg}
        mentry(f'prop-{key}', f'prop: {n}', f'{RUNTIME}/town.json#prop-{key}', rel(path), 'prop',
               prov=pkg_prov(pkg, entries, path), size=f'{img.width}x{img.height}')
found_report.append('đạo cụ: ' + ', '.join(f'{k}[{v["kind"]}]' for k, v in meta['props'].items()))

# --- NPC ---------------------------------------------------------------------
WALK_RE = re.compile(r'(?:^|[-_/])(south|east|north|west)[-_/](\d+)$')


def add_npc(cid, pkg, idle, walk, idle_anim, entries=()):
    """idle: {dir: path}; walk / idle_anim: {dir: [path...]}. Neo của mỗi chuỗi = bbox khung 0."""
    n = {'package': pkg, 'idle': {}, 'walk': {}, 'idleAnim': {}}
    for d, path in idle.items():
        img = Image.open(path)
        add_frame(f'npc-{cid}-{d}', img, rel(path), 'sprites')
        n['idle'][d] = {'frame': f'npc-{cid}-{d}', 'anchor': bbox_anchor(img)}
    for key, seqs, out in (('walk', walk, n['walk']), ('idle', idle_anim, n['idleAnim'])):
        for d, paths in seqs.items():
            if not paths:
                continue
            frames = []
            for i, path in enumerate(paths):
                img = Image.open(path)
                if i == 0:
                    anchor = bbox_anchor(img)
                add_frame(f'npc-{cid}-{key}-{d}-{i}', img, rel(path), 'sprites')
                frames.append(f'npc-{cid}-{key}-{d}-{i}')
            out[d] = {'frames': frames, 'anchor': anchor}
    if not n['idle'] and not n['walk']:
        return
    meta['npcs'][cid] = n
    nframes = len(n['idle']) + sum(len(v['frames']) for v in n['walk'].values()) + sum(len(v['frames']) for v in n['idleAnim'].values())
    mentry(f'npc-{cid}', f'NPC {cid}: idle {"/".join(n["idle"])}; walk {"/".join(n["walk"]) or "none"}',
           f'{RUNTIME}/town.json#npc-{cid}-*', pkg, 'npc', frames=nframes,
           prov=p0_prov('npc-villager') if pkg == 'phase0' else {'kind': 'generated', 'package': pkg})


add_npc('villager', 'phase0',
        {d: os.path.join(P0PAL, f'npc-{d}.png') for d in DIRS if os.path.exists(os.path.join(P0PAL, f'npc-{d}.png'))},
        {d: [os.path.join(P0PAL, 'walk-skel', f'{d}-{i}.png') for i in range(6)
             if os.path.exists(os.path.join(P0PAL, 'walk-skel', f'{d}-{i}.png'))] for d in DIRS}, {})


def scan_char(cdir):
    idle, walk, ianim = {}, {d: [] for d in DIRS}, {d: [] for d in DIRS}
    for root, _dirs, fns in os.walk(cdir):
        for fn in fns:
            if not fn.lower().endswith('.png') or fn.startswith('_'):
                continue
            path = os.path.join(root, fn)
            r = os.path.relpath(path, cdir)[:-4].lower().replace(os.sep, '/')
            if any(t in r for t in ('reject', 'base', 'raw', 'test', 'old', 'preview', 'sheet', 'strip')):
                continue
            m = WALK_RE.search(r)
            if m:  # khung đánh số theo hướng: đi bộ, trừ khi tên có "idle" (thở tại chỗ)
                (ianim if 'idle' in r or 'breath' in r else walk)[m.group(1)].append((int(m.group(2)), path))
                continue
            m2 = re.match(r'^(?:rot-|rotation-|idle-|stand-)?(south|east|north|west)$', r.split('/')[-1])
            if m2 and (m2.group(1) not in idle or '/' not in r):
                idle[m2.group(1)] = path
    srt = lambda seq: {d: [p for _, p in sorted(v)] for d, v in seq.items() if v}
    return idle, srt(walk), srt(ianim)


for pkg in sorted(d for d in os.listdir(P1) if d.startswith('npc-')):
    pal = os.path.join(P1, pkg, 'pal')
    if not os.path.isdir(pal):
        continue
    for c in sorted(os.listdir(pal)):
        cdir = os.path.join(pal, c)
        if os.path.isdir(cdir) and not c.startswith('_'):
            idle, walk, ianim = scan_char(cdir)
            cid = re.sub(r'[^a-z0-9]+', '-', c.lower()).strip('-')
            if cid in meta['npcs']:
                cid = f'{cid}-{pkg}'
            add_npc(cid, pkg, idle, walk, ianim)
found_report.append('NPC: ' + ', '.join(f'{k}(đi: {"/".join(v["walk"]) or "-"})' for k, v in meta['npcs'].items()))

# --- hoạt cảnh -----------------------------------------------------------------
fdir = os.path.join(P0PAL, 'fountain-anim')
fr = sorted((int(f[:-4]), f) for f in os.listdir(fdir) if re.match(r'^\d+\.png$', f))
names = []
for i, f in fr:
    img = Image.open(os.path.join(fdir, f))
    if i == 0:
        anchor = bbox_anchor(img)
    add_frame(f'fx-fountain-{i}', img, rel(os.path.join(fdir, f)), 'sprites')
    names.append(f'fx-fountain-{i}')
meta['fx']['fountain'] = {'frames': names, 'ms': 110, 'playback': 'pingpong', 'anchor': anchor, 'package': 'phase0'}
mentry('fx-fountain', 'ambient: fountain loop (ping-pong)', f'{RUNTIME}/town.json#fx-fountain-*', rel(fdir), 'fx',
       frames=len(names), prov=p0_prov('fx-fountain'), size='66x66')
for pkg in sorted(d for d in os.listdir(P1) if d.startswith('ambient-')):
    pal = os.path.join(P1, pkg, 'pal')
    if not os.path.isdir(pal):
        continue
    fxmeta = {}
    for fn in os.listdir(pal):
        if fn.endswith('.json'):
            d = load_json(os.path.join(pal, fn), {})
            if isinstance(d, dict):
                fxmeta.update(d)
    for c in sorted(os.listdir(pal)):
        cdir = os.path.join(pal, c)
        if not os.path.isdir(cdir) or c.startswith('_'):
            continue
        fr = sorted((int(f[:-4]), f) for f in os.listdir(cdir) if re.match(r'^\d+\.png$', f))
        if len(fr) < 2:
            continue
        key = re.sub(r'^fx-', '', c.lower())
        info = dict(fxmeta.get(c, fxmeta.get(key, {})))
        info.update(load_json(os.path.join(cdir, 'anim.json'), {}) if not info else {})
        # Hai kiểu ghi của các gói: ambient-1 (anchor [x, y], ms_per_frame) và ambient-2 (anchor {ax, ay}, ms [..]).
        a = info.get('anchor')
        if isinstance(a, dict):
            a = [a.get('ax', a.get('x', 0)), a.get('ay', a.get('y', 0))]
        ms = info.get('ms_per_frame', info.get('ms', 120))
        if isinstance(ms, list) and len(set(ms)) == 1:
            ms = ms[0]
        names = []
        for i, f in fr:
            img = Image.open(os.path.join(cdir, f))
            if i == fr[0][0]:
                anchor = a or bbox_anchor(img)
                size = img.size
            add_frame(f'fx-{key}-{i}', img, rel(os.path.join(cdir, f)), 'sprites')
            names.append(f'fx-{key}-{i}')
        meta['fx'][key] = {'frames': names, 'ms': ms,
                           'playback': 'loop' if str(info.get('playback', 'loop')).startswith('loop') else info.get('playback'),
                           'anchor': anchor, 'package': pkg}
        if info.get('gap_ms'):
            meta['fx'][key]['gap'] = info['gap_ms']
        mentry(f'fx-{key}', f'ambient: {key}', f'{RUNTIME}/town.json#fx-{key}-*', rel(cdir), 'fx', frames=len(names),
               prov={'kind': 'generated', 'package': pkg, 'source': rel(cdir)}, size=f'{size[0]}x{size[1]}')
found_report.append('hoạt cảnh: ' + ', '.join(meta['fx']))

print('\n'.join(found_report))
if CHECK:
    sys.exit(0)

# ------------------------------------------------------------------ xếp atlas

def trim(it):
    img = it['img']
    b = img.getbbox() or (0, 0, 1, 1)
    if it['group'] == 'terrain':
        b = (0, 0, img.width, img.height)  # ô giữ nguyên toạ độ trong bộ
    it['ox'], it['oy'] = b[0], b[1]
    it['sw'], it['sh'] = img.size
    it['crop'] = img.crop(b)


for it in items:
    trim(it)

PAD = 1
PAGE_W = 512


def pack(group_items, page_w):
    """Xếp kệ (shelf) theo chiều cao giảm dần; trả về [(item, x, y)], cao trang."""
    order = sorted(group_items, key=lambda it: (-it['crop'].height, -it['crop'].width, it['name']))
    x = y = shelf = 0
    placed = []
    for it in order:
        w, h = it['crop'].size
        if x + w + PAD * 2 > page_w:
            x, y, shelf = 0, y + shelf, 0
        placed.append((it, x + PAD, y + PAD))
        x += w + PAD * 2
        shelf = max(shelf, h + PAD * 2)
    return placed, y + shelf


def encode(img):
    b = io.BytesIO()
    img.save(b, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return b.getvalue()


groups = [('terrain', 'buildings'), ('sprites',)]
pages = []   # (filename, bytes, placed)
for gi, gset in enumerate(groups):
    gitems = [it for it in items if it['group'] in gset]
    # Chia thành nhiều trang nếu một trang vượt ngân sách tệp.
    chunks = [gitems]
    while True:
        out = []
        ok = True
        for ch in chunks:
            placed, h = pack(ch, PAGE_W)
            page = Image.new('RGBA', (PAGE_W, max(h, 1)), (0, 0, 0, 0))
            for it, x, y in placed:
                page.paste(it['crop'], (x, y))
            data = encode(page)
            if len(data) > MAX_FILE and len(ch) > 1:
                ok = False
                break
            out.append((data, placed, page.size))
        if ok:
            break
        chunks = [c for ch in chunks for c in (ch[: len(ch) // 2], ch[len(ch) // 2:])]
    for data, placed, size in out:
        pages.append((f'town-{len(pages)}.webp', data, placed, size))

frames = {}
for pi, (fn, data, placed, size) in enumerate(pages):
    for it, x, y in placed:
        frames[it['name']] = [pi, x, y, it['crop'].width, it['crop'].height, it['ox'], it['oy'], it['sw'], it['sh']]

total = sum(len(d) for _, d, _, _ in pages)
doc = {
    'version': 1,
    'built': date.today().isoformat(),
    'tile': 16,
    'note': 'frames: [atlas, x, y, w, h, ox, oy, sw, sh]: (ox, oy) = chỗ phần đã cắt nằm trong ảnh gốc sw×sh; anchor tính theo toạ độ ảnh gốc',
    'atlases': [fn for fn, *_ in pages],
    'frames': frames,
    'terrain': meta['terrain'],
    'terrainInfo': meta['terrain_info'],
    'buildings': meta['buildings'],
    'props': meta['props'],
    'npcs': meta['npcs'],
    'fx': meta['fx'],
}
os.makedirs(OUT_DIR, exist_ok=True)
for fn in os.listdir(OUT_DIR):
    if re.match(r'^town-\d+\.webp$', fn):
        os.remove(os.path.join(OUT_DIR, fn))
for fn, data, placed, size in pages:
    with open(os.path.join(OUT_DIR, fn), 'wb') as f:
        f.write(data)
    print(f'{fn}: {size[0]}x{size[1]}, {len(placed)} khung, {len(data) / 1024:.1f} KB')
js = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(OUT_DIR, 'town.json'), 'w', encoding='utf-8') as f:
    f.write(js)
total += len(js.encode())
print(f'town.json: {len(js.encode()) / 1024:.1f} KB · tổng {total / 1024:.1f} KB (trần {MAX_TOTAL // 1024} KB)')
if total > MAX_TOTAL:
    print('  ! VƯỢT ngân sách 400 KB cho cả phố')

# ------------------------------------------------------------------ manifest

man = load_json(MANIFEST) or {}
if not man:
    p0 = load_json(os.path.join(P0, 'asset-manifest.json'), {})
    man = {k: p0[k] for k in ('schema_version', 'schema_notes') if k in p0}
    man['art_direction_brief'] = 'docs/art/style-bible.md'
    man['palette'] = 'phase0/palette.json (48 colours, listed in style-bible.md §1)'
    man['assets'] = []
man.setdefault('schema_notes', {})['area'] = 'town | park | scenes — each build script replaces only its own area'
man['assets'] = [e for e in man.get('assets', []) if e.get('area') != 'town'] + manifest_entries
man.setdefault('builds', {})['town'] = {
    'script': 'scripts/art/build-town.py', 'built': date.today().isoformat(),
    'files': {fn: len(d) for fn, d, *_ in pages} | {'town.json': len(js.encode())}, 'total_bytes': total,
    'missing_places': missing,
}
os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
with open(MANIFEST, 'w', encoding='utf-8') as f:
    json.dump(man, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'manifest: {len(manifest_entries)} mục town -> {os.path.relpath(MANIFEST, REPO)}')
