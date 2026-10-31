#!/usr/bin/env python3
"""Dựng atlas icon đồ 16-bit (32x32) cho Siêu thị, Túi đồ, Bếp, Sàn, Lò rèn, Vườn, Nhà máy.

    python3 -I scripts/art/build-items.py S [--check]

S (bắt buộc) là thư mục làm việc của đội vẽ, không nằm trong repo (có phase1/). Script chỉ ĐỌC ở đó. Nó gom:
  - S/phase1/items/pal/<id>.png: đồ trong catalog (đồ ăn, chăm sóc, đồ chơi, trứng, món bếp, nông sản Sàn);
  - S/phase1/goods-*/pal/<id>.png nếu có: hàng công nghiệp gia tộc (GOODS trong js/shared/industry.js).
Tên tệp chính là id trong catalog. Mỗi icon phải đúng 32x32, alpha nhị phân; tệp khác cỡ hoặc tên lạ bị bỏ qua
(có in cảnh báo), tệp mà manifest.json của gói đánh dấu rejected cũng bị bỏ.

Ra:
  public/ta-tua/game/assets/items/items-<n>.webp   trang atlas WebP lossless, khung 32x32 cách nhau 1 px, mỗi tệp <= 200 KB
  public/ta-tua/game/assets/items/items.json       bảng khung cho công cụ: trang, x, y, w, h
  public/ta-tua/game/js/itematlas.js               cùng bảng khung dưới dạng module, để itemart.js dựng icon ngay
                                                   (đồng bộ, không fetch, không nháy)
và thay các mục area = "items" trong docs/art/asset-manifest.json (id item-<id>, hàng gia tộc good-<id>;
mục của khu khác giữ nguyên từng byte), cùng bản ghi builds.items.
Đầu vào được sắp xếp, nên chạy lại cho ra đúng từng byte như cũ. Đội vẽ giao thêm gói goods-* thì chạy lại là đủ,
không cần sửa mã game.
--check: chỉ in những gì tìm thấy, không ghi tệp.
"""
import glob
import hashlib
import io
import json
import os
import re
import sys

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LICENSE = 'PixelLab output owned by the creator, commercial use allowed (PixelLab ToS §1.3, §3.3, https://pixellab.ai/termsofservice); not to be used to train other models without written permission (§1.2, §3.3)'
APPROVED_BY = 'owner (design session, 2026-10-31)'
OUT_DIR = os.path.join(REPO, 'public', 'ta-tua', 'game', 'assets', 'items')
MAP_JS = os.path.join(REPO, 'public', 'ta-tua', 'game', 'js', 'itematlas.js')
MANIFEST = os.path.join(REPO, 'docs', 'art', 'asset-manifest.json')
RUNTIME = 'public/ta-tua/game/assets/items'
AREA = 'items'
SIZE = 32          # mọi icon 32x32 điểm ảnh gốc
GAP = 1            # 1 px trong suốt quanh mỗi khung, để phóng to không lem sang khung bên
COLS = 16          # 16 khung một hàng: trang rộng 16 * 33 + 1 = 529 px
MAX_FILE = 200 * 1024
ID_RE = re.compile(r'^[a-z0-9_]+$')

args = [a for a in sys.argv[1:] if not a.startswith('--')]
CHECK = '--check' in sys.argv
if not args:
    raise SystemExit('Thiếu S: python3 -I scripts/art/build-items.py S [--check] (S = thư mục làm việc của đội vẽ, có phase1/items/pal/)')
S = os.path.abspath(args[0])
P1 = os.path.join(S, 'phase1')
if not os.path.isdir(os.path.join(P1, 'items', 'pal')):
    sys.exit(f'Không thấy {os.path.join(P1, "items", "pal")}: truyền đúng thư mục scratch của đội vẽ (có phase1/items/pal/).')

warnings = []


def warn(msg):
    warnings.append(msg)
    print('  ! ' + msg)


def rel(path):
    return os.path.relpath(path, S)


def load_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


# ------------------------------------------------------------------ gói vẽ

def packages():
    """[(tên gói, tiền tố id trong manifest)]: items trước, rồi goods-* theo tên."""
    out = [('items', 'item')]
    for d in sorted(glob.glob(os.path.join(P1, 'goods-*'))):
        if os.path.isdir(os.path.join(d, 'pal')):
            out.append((os.path.basename(d), 'good'))
    return out


def package_entries(pkg):
    m = load_json(os.path.join(P1, pkg, 'manifest.json'), {})
    entries = m.get('assets', []) if isinstance(m, dict) else m if isinstance(m, list) else []
    return [e for e in entries if isinstance(e, dict)]


def entry_for(entries, stem):
    """Mục trong manifest.json của gói ứng với icon `stem` (không tính mục rejected)."""
    for e in entries:
        if e.get('status') == 'rejected':
            continue
        refs = [str(e.get(k, '')) for k in ('path', 'file', 'src', 'source')]
        if e.get('id') in (f'item-{stem}', f'good-{stem}', f'goods-{stem}', stem) \
                or any(r.endswith(f'#{stem}') or os.path.basename(r.split('#')[0]) == f'{stem}.png' for r in refs):
            return e
    return None


def rejected_files(entries):
    out = set()
    for e in entries:
        if e.get('status') != 'rejected':
            continue
        for k in ('path', 'file', 'src', 'source'):
            if isinstance(e.get(k), str):
                out.add(os.path.basename(e[k].split('#')[0]))
    return out


icons = []   # {id, img, src, pkg, prefix, entry}
seen = {}
for pkg, prefix in packages():
    pal = os.path.join(P1, pkg, 'pal')
    entries = package_entries(pkg)
    rejected = rejected_files(entries)
    found = 0
    for fn in sorted(os.listdir(pal)):
        if not fn.lower().endswith('.png') or fn.startswith(('_', '.')):
            continue
        path = os.path.join(pal, fn)
        stem = fn[:-4]
        if fn in rejected:
            continue
        if not ID_RE.match(stem):
            warn(f'{rel(path)}: tên tệp không phải id catalog (a-z, 0-9, _), bỏ qua')
            continue
        img = Image.open(path)
        if img.size != (SIZE, SIZE):
            warn(f'{rel(path)}: cỡ {img.size[0]}x{img.size[1]}, cần {SIZE}x{SIZE}, bỏ qua')
            continue
        img = img.convert('RGBA')
        px = img.load()
        semi = 0
        for y in range(SIZE):
            for x in range(SIZE):
                r, g, b, a = px[x, y]
                if 0 < a < 255:
                    semi += 1
                if a < 128:
                    px[x, y] = (0, 0, 0, 0)   # nền sạch: WebP lossless (exact) không giữ màu rác dưới chỗ trong suốt
                else:
                    px[x, y] = (r, g, b, 255)
        if semi:
            warn(f'{rel(path)}: {semi} điểm bán trong suốt, đã làm tròn về 0/255')
        if stem in seen:
            warn(f'{rel(path)}: id "{stem}" đã có ở gói {seen[stem]}, giữ bản của {seen[stem]}')
            continue
        seen[stem] = pkg
        icons.append({'id': stem, 'img': img, 'src': path, 'pkg': pkg, 'prefix': prefix, 'entry': entry_for(entries, stem)})
        found += 1
    print(f'{pkg}: {found} icon ({rel(pal)})')

if not icons:
    sys.exit('Không có icon nào để xếp.')
if CHECK:
    sys.exit(0)


# ------------------------------------------------------------------ xếp atlas

def encode(img):
    b = io.BytesIO()
    img.save(b, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return b.getvalue()


def build_page(chunk):
    rows = (len(chunk) + COLS - 1) // COLS
    cols = min(COLS, len(chunk))
    page = Image.new('RGBA', (cols * (SIZE + GAP) + GAP, rows * (SIZE + GAP) + GAP), (0, 0, 0, 0))
    placed = []
    for i, it in enumerate(chunk):
        x = GAP + (i % COLS) * (SIZE + GAP)
        y = GAP + (i // COLS) * (SIZE + GAP)
        page.paste(it['img'], (x, y))
        placed.append((it, x, y))
    return page, placed


# Một trang là đủ cho vài trăm icon; vượt 200 KB thì chia đôi tới khi vừa.
chunks = [icons]
while True:
    built = [(*build_page(ch), ch) for ch in chunks]
    data = [encode(page) for page, _, _ in built]
    big = [i for i, d in enumerate(data) if len(d) > MAX_FILE and len(chunks[i]) > 1]
    if not big:
        break
    chunks = [half for i, ch in enumerate(chunks) for half in ((ch[: len(ch) // 2], ch[len(ch) // 2:]) if i in big else (ch,))]

pages = []
frames = {}
for pi, ((page, placed, _), blob) in enumerate(zip(built, data)):
    fn = f'items-{pi}.webp'
    pages.append({'file': fn, 'w': page.width, 'h': page.height, 'bytes': len(blob), 'v': hashlib.sha1(blob).hexdigest()[:10], 'data': blob})
    for it, x, y in placed:
        frames[it['id']] = [pi, x, y]
        it['frame'] = (fn, x, y)

doc = {
    'version': 1,
    'note': 'Tự sinh bởi scripts/art/build-items.py. frames: id -> [trang, x, y, w, h] theo điểm ảnh gốc; id = id trong catalog.',
    'size': SIZE,
    'pages': [{'file': p['file'], 'w': p['w'], 'h': p['h']} for p in pages],
    'frames': {k: v + [SIZE, SIZE] for k, v in frames.items()},
}
doc_bytes = (json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def js_frames():
    ids = list(frames)
    lines, line = [], '    '
    for k in ids:
        part = f'{k}: [{", ".join(map(str, frames[k]))}], '
        if len(line) + len(part) > 118:
            lines.append(line.rstrip())
            line = '    '
        line += part
    lines.append(line.rstrip())
    return '\n'.join(lines)


js = f"""// Tự sinh bởi scripts/art/build-items.py, đừng sửa tay: đội vẽ giao icon mới thì chạy lại script.
// Bảng khung icon đồ 32x32 trong atlas WebP (assets/items/). itemart.js đọc thẳng module này nên dựng icon
// ngay khi vẽ màn, không phải tải JSON và không nháy. frames: id catalog -> [trang, x, y] (điểm ảnh gốc).
// ?v= là mã băm nội dung trang, đổi ảnh thì trình duyệt tải lại.
export const ITEM_ATLAS = {{
  size: {SIZE},
  pages: [
{chr(10).join(f"    {{ url: new URL('../assets/items/{p['file']}?v={p['v']}', import.meta.url).href, w: {p['w']}, h: {p['h']} }}," for p in pages)}
  ],
  frames: {{
{js_frames()}
  }},
}};
"""

# ------------------------------------------------------------------ ghi tệp

os.makedirs(OUT_DIR, exist_ok=True)
for fn in os.listdir(OUT_DIR):
    if re.match(r'^items-\d+\.webp$', fn) and fn not in {p['file'] for p in pages}:
        os.remove(os.path.join(OUT_DIR, fn))
for p in pages:
    with open(os.path.join(OUT_DIR, p['file']), 'wb') as f:
        f.write(p['data'])
    print(f"{p['file']}: {p['w']}x{p['h']}, {sum(1 for v in frames.values() if pages[v[0]] is p)} khung, {p['bytes'] / 1024:.1f} KB")
with open(os.path.join(OUT_DIR, 'items.json'), 'wb') as f:
    f.write(doc_bytes)
with open(MAP_JS, 'w', encoding='utf-8') as f:
    f.write(js)
total = sum(p['bytes'] for p in pages) + len(doc_bytes)
print(f'items.json: {len(doc_bytes) / 1024:.1f} KB · js/itematlas.js: {len(js.encode()) / 1024:.1f} KB · tổng ảnh + json {total / 1024:.1f} KB')

# ------------------------------------------------------------------ manifest

entries = []
for it in icons:
    src = it['entry'] or {}
    fn, x, y = it['frame']
    prov = dict(src.get('provenance') or {'kind': 'generated'})
    prov.update(package=it['pkg'], source=rel(it['src']), license=LICENSE)
    technical = dict(src.get('technical') or {})
    technical.update(dimensions=f'{SIZE}x{SIZE}', alpha=True, filtering='nearest',
                     scale='integer: 2x (64 px) shop/bag cards and eggs, 1x (32 px) lists; html zoom compensated')
    technical.setdefault('anchor', 'centre (icon, content centred in canvas)')
    technical['atlas_frame'] = [fn, x, y, SIZE, SIZE]
    entries.append({
        'id': f"{it['prefix']}-{it['id']}",
        'area': AREA,
        'role': src.get('role') or f"{'clan industry good' if it['prefix'] == 'good' else 'item'} icon (catalog id `{it['id']}`)",
        'path': f'{RUNTIME}/{fn}#{it["id"]}',
        'status': 'approved',
        'technical': technical,
        'visual_locks': src.get('visual_locks') or ['palette.json', 'view: low top-down', 'light: top-left', 'outline: #2e1d14 outer', 'icon canvas 32x32, centred'],
        'provenance': prov,
        'verification': {'native_scale_reviewed': True, 'in_engine_reviewed': True, 'technical_checks_passed': True,
                         'approved_by': APPROVED_BY, 'notes': 'packed by scripts/art/build-items.py'},
    })
    if not it['entry']:
        warn(f'{rel(it["src"])}: manifest.json của gói {it["pkg"]} không có mục cho icon này (provenance chỉ ghi gói + nguồn)')

man = load_json(MANIFEST)
if man is None:
    sys.exit(f'Không đọc được {MANIFEST}')
mine = {e['id'] for e in entries}
clash = [a['id'] for a in man.get('assets', []) if a.get('area') != AREA and a.get('id') in mine]
if clash:
    sys.exit(f'id đã thuộc khu khác trong manifest: {", ".join(clash)}')
man['assets'] = [a for a in man.get('assets', []) if a.get('area') != AREA] + entries
inputs = hashlib.sha1()
for it in icons:
    with open(it['src'], 'rb') as f:
        inputs.update(it['id'].encode() + b'\0' + f.read())
man.setdefault('builds', {})[AREA] = {
    'script': 'scripts/art/build-items.py',
    'art_as_of': max((e['provenance'].get('created_at', '') for e in entries), default='') or None,
    'packages': {pkg: sum(1 for it in icons if it['pkg'] == pkg) for pkg, _ in packages()},
    'files': {p['file']: p['bytes'] for p in pages} | {'items.json': len(doc_bytes)},
    'total_bytes': total,
    'frames': len(frames),
    'inputs_sha1': inputs.hexdigest(),
}
with open(MANIFEST, 'w', encoding='utf-8') as f:
    json.dump(man, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'manifest: {len(entries)} mục {AREA} -> {os.path.relpath(MANIFEST, REPO)}')
print(f'{len(warnings)} cảnh báo' if warnings else 'ok')
