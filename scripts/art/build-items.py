#!/usr/bin/env python3
"""Dựng atlas icon đồ 16-bit (32x32) cho Siêu thị, Túi đồ, Bếp, Sàn, Lò rèn, Vườn, Nhà máy, Gia tộc.

    python3 -I scripts/art/build-items.py S [--check]

S (bắt buộc) là thư mục làm việc của đội vẽ, không nằm trong repo (có phase1/). Script chỉ ĐỌC ở đó, và chỉ đọc
những gói ghi trong PACKAGES dưới đây (không tự dò thư mục goods-*): S/phase1/<gói>/pal/<id>.png.
Tên tệp chính là id trong catalog: đồ Siêu thị, món Bếp, nông sản Sàn, hay hàng gia tộc (GOODS trong js/shared/industry.js).

Mỗi icon phải qua đủ các bước kiểm sau; sai một chỗ là script dừng với mã thoát 1 và không ghi tệp nào:
  - đúng 32x32, tên tệp là id (a-z, 0-9, _), id không trùng giữa các gói;
  - có đúng một mục trong manifest.json của gói (icon chỉ có mục rejected thì bị bỏ qua), status sample hoặc approved,
    và content_bbox của mục khớp với ảnh (ảnh bị sửa sau khi ghi manifest, hay còn đang vẽ dở, thì không khớp);
  - có nguồn gốc: pixellab_id (uuid, hay danh sách uuid khi icon ghép từ nhiều lần sinh) + prompt (ảnh PixelLab, ghi dòng
    giấy phép PixelLab), hoặc kind hand-built có tool (giữ dòng giấy phép của mục, không gắn giấy phép PixelLab);
  - status lấy từ mục của gói. Icon chỉ thành approved khi mục đã approved (có approved_by), hoặc khi gói có bản ghi
    duyệt trong PACKAGES và inputs_sha1 của bản ghi khớp đúng bộ tệp đang có: sửa hay thêm một icon sau khi duyệt
    là phải duyệt lại.
--check chạy đủ các bước kiểm trên và in mã băm từng gói, không ghi tệp.

Thêm gói (vd goods-a khi đội vẽ giao xong): thêm một dòng vào PACKAGES với approved = None, chạy --check cho tới khi sạch.
Chủ dự án duyệt xong thì ghi tên người duyệt và mã băm mà --check in ra vào approved, rồi chạy lại.
petdex/test/item-atlas.test.js chỉ nhận mục approved, nên icon chưa duyệt không lọt vào bản phát hành.

Ra:
  public/ta-tua/game/assets/items/items-<n>.webp   trang atlas WebP lossless, khung 32x32 cách nhau 1 px, mỗi tệp <= 200 KB
  public/ta-tua/game/assets/items/items.json       bảng khung cho công cụ: trang, x, y, w, h
  public/ta-tua/game/js/itematlas.js               cùng bảng khung dưới dạng module, để itemart.js dựng icon ngay
                                                   (đồng bộ, không fetch, không nháy)
và thay các mục area = "items" trong docs/art/asset-manifest.json (id item-<id>, hàng gia tộc good-<id>;
mục của khu khác giữ nguyên từng byte), cùng bản ghi builds.items.
Đầu vào được sắp xếp, nên chạy lại cho ra đúng từng byte như cũ.
"""
import hashlib
import io
import json
import os
import re
import sys

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LICENSE = 'PixelLab output owned by the creator, commercial use allowed (PixelLab ToS §1.3, §3.3, https://pixellab.ai/termsofservice); not to be used to train other models without written permission (§1.2, §3.3)'
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
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')

# Gói được xếp vào atlas, theo đúng thứ tự này. Gói không có ở đây thì không được đọc, dù thư mục đã có trong S.
#   name:     thư mục S/phase1/<name>/ (có pal/ và manifest.json)
#   prefix:   tiền tố id trong docs/art/asset-manifest.json: item-<id> (đồ catalog) hay good-<id> (hàng gia tộc)
#   approved: bản ghi duyệt của chủ dự án cho đúng bộ tệp có mã băm inputs_sha1 (--check in ra), hoặc None
#             (chưa duyệt: icon giữ status trong manifest.json của gói, thường là sample).
PACKAGES = (
    {'name': 'items', 'prefix': 'item', 'approved': {
        'by': 'owner (design session, 2026-10-31)',
        'in_engine_reviewed': True,
        'inputs_sha1': 'd1a82d00497fd36c3c38731e65cfcf5964d548f9',   # 43 icon của phase1/items/pal
    }},
    # Hàng gia tộc (GOODS trong js/shared/industry.js), id good-<id>. Chủ dự án duyệt sau vòng phê bình của art director
    # và lượt sửa (review/critique.txt, report.txt của từng gói); xem trong game ở màn Gia tộc, Hợp đồng, Cộng đồng.
    {'name': 'goods-a', 'prefix': 'good', 'approved': {
        'by': 'owner (design session, 2026-10-31)',
        'in_engine_reviewed': True,
        'inputs_sha1': 'c8960730deff59de63e01f2997b454fa2fc0417a',   # 15 icon khoáng sản, năng lượng thô
    }},
    {'name': 'goods-b', 'prefix': 'good', 'approved': {
        'by': 'owner (design session, 2026-10-31)',
        'in_engine_reviewed': True,
        'inputs_sha1': '9b5609d2213543fdcef9a5baefc5d681b8a19d1d',   # 11 icon nông sản, gỗ, cao su, điện
    }},
    {'name': 'goods-c', 'prefix': 'good', 'approved': {
        'by': 'owner (design session, 2026-10-31)',
        'in_engine_reviewed': True,
        'inputs_sha1': '102b45b55b0ee9dddd2fc3b7e9e0dd5465de2362',   # 15 icon hàng công nghiệp
    }},
)

args = [a for a in sys.argv[1:] if not a.startswith('--')]
CHECK = '--check' in sys.argv
if not args:
    raise SystemExit('Thiếu S: python3 -I scripts/art/build-items.py S [--check] (S = thư mục làm việc của đội vẽ, có phase1/items/pal/)')
S = os.path.abspath(args[0])
P1 = os.path.join(S, 'phase1')
if not os.path.isdir(os.path.join(P1, 'items', 'pal')):
    sys.exit(f'Không thấy {os.path.join(P1, "items", "pal")}: truyền đúng thư mục scratch của đội vẽ (có phase1/items/pal/).')

warnings = []
errors = []


def warn(msg):
    warnings.append(msg)
    print('  ! ' + msg)


def fail(msg):
    errors.append(msg)
    print('  x ' + msg)


def rel(path):
    return os.path.relpath(path, S)


def load_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


# ------------------------------------------------------------------ gói vẽ

def package_entries(pkg):
    """Các mục trong manifest.json của gói, hoặc None nếu gói chưa có manifest.json đọc được."""
    m = load_json(os.path.join(P1, pkg, 'manifest.json'))
    if m is None:
        return None
    entries = m.get('assets', []) if isinstance(m, dict) else m if isinstance(m, list) else []
    return [e for e in entries if isinstance(e, dict)]


def entry_matches(e, stem):
    refs = [str(e.get(k, '')) for k in ('path', 'file', 'src', 'source')]
    return e.get('id') in (f'item-{stem}', f'good-{stem}', f'goods-{stem}', stem) \
        or any(r.endswith(f'#{stem}') or os.path.basename(r.split('#')[0]) == f'{stem}.png' for r in refs)


def provenance_of(entry, where):
    """(provenance đã kèm giấy phép, lỗi hoặc None). PixelLab cần pixellab_id + prompt; tự vẽ cần kind hand-built + tool.
    Icon ghép từ nhiều lần sinh (vd titan, urani: một khối đá + một chùm tinh thể) ghi pixellab_id là danh sách mã,
    prompt là danh sách cùng độ dài, theo đúng thứ tự."""
    prov = entry.get('provenance')
    if not isinstance(prov, dict):
        return None, f'{where}: mục trong manifest.json không có provenance'
    prov = dict(prov)
    if prov.get('pixellab_id'):
        ids = prov['pixellab_id'] if isinstance(prov['pixellab_id'], list) else [prov['pixellab_id']]
        if not all(isinstance(i, str) and UUID_RE.match(i) for i in ids):
            return None, f'{where}: pixellab_id phải là mã PixelLab (uuid), hay danh sách mã khi icon ghép từ nhiều lần sinh'
        prompt = prov.get('prompt')
        if isinstance(prompt, list) and (len(prompt) != len(ids) or not all(isinstance(t, str) and t for t in prompt)):
            return None, f'{where}: prompt là danh sách thì phải có đúng {len(ids)} câu, mỗi pixellab_id một câu'
        if not prompt:
            return None, f'{where}: có pixellab_id nhưng thiếu prompt'
        prov['license'] = LICENSE
        return prov, None
    if str(prov.get('kind', '')).startswith('hand-built') and prov.get('tool'):
        lic = str(prov.get('license') or '')
        if not lic or 'pixellab' in lic.lower():
            return None, f'{where}: icon tự vẽ cần dòng giấy phép riêng (không phải giấy phép PixelLab)'
        return prov, None
    return None, f'{where}: không có nguồn gốc (thiếu pixellab_id, cũng không phải kind hand-built có tool)'


icons = []   # {id, img, src, pkg, prefix, entry, prov, status, verification}
seen = {}
pkg_info = {}   # tên gói -> {icons, inputs_sha1, status, approved_by}
for pk in PACKAGES:
    pkg, prefix, approval = pk['name'], pk['prefix'], pk.get('approved')
    pal = os.path.join(P1, pkg, 'pal')
    if not os.path.isdir(pal):
        fail(f'gói {pkg}: không thấy {rel(pal)}')
        continue
    entries = package_entries(pkg)
    if entries is None:
        fail(f'gói {pkg}: không có manifest.json đọc được, chưa xếp được icon nào của gói (gói còn đang vẽ?)')
        continue
    mine = []
    for fn in sorted(os.listdir(pal)):
        if not fn.lower().endswith('.png') or fn.startswith(('_', '.')):
            continue
        path = os.path.join(pal, fn)
        stem = fn[:-4]
        where = rel(path)
        if not ID_RE.match(stem):
            fail(f'{where}: tên tệp không phải id catalog (a-z, 0-9, _)')
            continue
        live = [e for e in entries if e.get('status') != 'rejected' and entry_matches(e, stem)]
        if not live:
            if any(entry_matches(e, stem) for e in entries):
                continue   # manifest của gói đánh dấu rejected
            fail(f'{where}: manifest.json của gói {pkg} không có mục cho icon này')
            continue
        if len(live) > 1:
            fail(f'{where}: {len(live)} mục trong manifest.json của gói {pkg} cùng trỏ tới icon này ({", ".join(str(e.get("id")) for e in live)})')
            continue
        entry = live[0]
        if entry.get('status') not in ('sample', 'approved'):
            fail(f'{where}: status "{entry.get("status")}" trong manifest.json, cần sample hoặc approved')
            continue
        img = Image.open(path)
        if img.size != (SIZE, SIZE):
            fail(f'{where}: cỡ {img.size[0]}x{img.size[1]}, cần {SIZE}x{SIZE}')
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
            warn(f'{where}: {semi} điểm bán trong suốt, đã làm tròn về 0/255')
        bbox = list(img.getchannel('A').getbbox() or [])
        want = (entry.get('technical') or {}).get('content_bbox')
        if bbox != want:
            fail(f'{where}: khung nội dung của ảnh {bbox} khác content_bbox {want} trong manifest.json (ảnh đổi sau khi ghi manifest, hay còn đang vẽ?)')
            continue
        prov, err = provenance_of(entry, where)
        if err:
            fail(err)
            continue
        if stem in seen:
            fail(f'{where}: id "{stem}" đã có ở gói {seen[stem]}')
            continue
        seen[stem] = pkg
        with open(path, 'rb') as f:
            raw = f.read()
        mine.append({'id': stem, 'img': img, 'raw': raw, 'src': path, 'pkg': pkg, 'prefix': prefix, 'entry': entry, 'prov': prov})

    h = hashlib.sha1()
    for it in mine:
        h.update(it['id'].encode() + b'\0' + it['raw'])
    digest = h.hexdigest()
    if approval and approval.get('inputs_sha1') != digest:
        fail(f'gói {pkg}: bộ icon đã đổi sau khi duyệt (inputs_sha1 {digest}, bản ghi duyệt {approval.get("inputs_sha1")}): '
             'chủ dự án duyệt lại rồi mới cập nhật PACKAGES')
        approval = None
    for it in mine:
        ver = it['entry'].get('verification') or {}
        if approval:
            it['status'], approved_by, in_engine = 'approved', approval['by'], bool(approval.get('in_engine_reviewed'))
        else:
            it['status'], approved_by, in_engine = it['entry']['status'], str(ver.get('approved_by') or ''), bool(ver.get('in_engine_reviewed'))
            if it['status'] == 'approved' and not approved_by:
                fail(f'{rel(it["src"])}: manifest.json ghi approved nhưng không có approved_by')
        it['verification'] = {'native_scale_reviewed': bool(ver.get('native_scale_reviewed')), 'in_engine_reviewed': in_engine,
                              'technical_checks_passed': bool(ver.get('technical_checks_passed')),
                              'approved_by': approved_by, 'notes': 'packed by scripts/art/build-items.py'}
    pending = sum(1 for it in mine if it['status'] != 'approved')
    pkg_info[pkg] = {'icons': len(mine), 'inputs_sha1': digest, 'approved_by': approval['by'] if approval else None}
    icons += mine
    state = f'duyệt bởi {approval["by"]}' if approval else (f'{pending} icon chưa duyệt' if pending else 'mọi mục đã approved trong gói')
    print(f'{pkg}: {len(mine)} icon ({rel(pal)}), inputs_sha1 {digest}, {state}')

if errors:
    sys.exit(f'{len(errors)} lỗi, không ghi tệp nào. Sửa ở gói vẽ (hay ở PACKAGES) rồi chạy lại.')
if not icons:
    sys.exit('Không có icon nào để xếp.')
unapproved = [it['id'] for it in icons if it['status'] != 'approved']
if unapproved:
    warn(f'{len(unapproved)} icon chưa được duyệt ({", ".join(unapproved[:8])}{"..." if len(unapproved) > 8 else ""}): '
         'petdex/test/item-atlas.test.js sẽ đỏ, đừng commit bản dựng này')
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


js = f"""// Tự sinh bởi scripts/art/build-items.py, đừng sửa tay: có icon mới được duyệt thì chạy lại script.
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
    src = it['entry']
    fn, x, y = it['frame']
    prov = it['prov']
    prov.update(package=it['pkg'], source=rel(it['src']))
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
        'status': it['status'],
        'technical': technical,
        'visual_locks': src.get('visual_locks') or ['palette.json', 'view: low top-down', 'light: top-left', 'outline: #2e1d14 outer', 'icon canvas 32x32, centred'],
        'provenance': prov,
        'verification': it['verification'],
    })

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
    inputs.update(it['id'].encode() + b'\0' + it['raw'])
man.setdefault('builds', {})[AREA] = {
    'script': 'scripts/art/build-items.py',
    'art_as_of': max((e['provenance'].get('created_at', '') for e in entries), default='') or None,
    'packages': pkg_info,
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
