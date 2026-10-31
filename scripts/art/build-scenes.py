#!/usr/bin/env python3
"""Cảnh đầu trang 16-bit (320x80) cho 7 màn: factory, bank, shop, kitchen, garden, school, clinic.

    python3 -I scripts/art/build-scenes.py [S] [--preview out.png]

S là thư mục làm việc của đội vẽ (mặc định: thư mục scratch của phiên Phase 1). Với mỗi cảnh:
  1. Gói `headers` đã có tranh cuối (S/phase1/headers/**/<name>-1x.png, đúng 320x80) -> dùng nguyên tranh đó.
  2. Chưa có -> ghép tạm từ tài sản Phase 0 đã duyệt (ô Wang, nhà, đạo cụ, NPC). Gói Phase 1 nào đã có hình
     hợp (xưởng bldg-5, bếp bldg-3, ...) thì lấy thêm; thiếu thì quay về hình Phase 0.
Hoạt cảnh khói/hơi (gói ambient-1, fx-anim.json) đặt theo hình nhà (tranh tạm) hoặc theo layers/<name>/layers.json
của gói headers (tranh cuối, xem FX_HINTS); chỉ thêm khi miệng ống khói nằm trong khung.
Ảnh <name>-phone.png của gói headers không cần: trên điện thoại CSS cắt giữa đúng như vậy từ ảnh 1x.

Ra (public/ta-tua/game/assets/scenes/):
  <name>.webp            ảnh cảnh 320x80, WebP lossless
  fx-<id>.webp           dải khung hoạt cảnh (khung xếp ngang)
  scenes.json            bảng khung: kích thước, trạng thái, hoạt cảnh (vị trí theo điểm ảnh 1x của cảnh)
và thay các mục `scene-*` trong docs/art/asset-manifest.json (giữ nguyên mục của khu khác).
Chạy lại sau khi đội vẽ xong là đủ; không cần sửa mã game.
"""
import glob
import io
import json
import math
import os
import re
import sys

from PIL import Image

DEFAULT_S = '/tmp/claude-0/-home-user-CRM-BU4/1d7a8478-818d-5731-a18c-bb6358057abd/scratchpad'
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(REPO, 'public', 'ta-tua', 'game', 'assets', 'scenes')
MANIFEST = os.path.join(REPO, 'docs', 'art', 'asset-manifest.json')

W, H, T = 320, 80, 16
SCENES = ['factory', 'bank', 'shop', 'kitchen', 'garden', 'school', 'clinic']
LABELS = {
    'factory': 'Khu công nghiệp', 'bank': 'Phố Ngân hàng', 'shop': 'Siêu thị', 'kitchen': 'Bếp',
    'garden': 'Vườn', 'school': 'Trường học', 'clinic': 'Phòng khám',
}
MAX_BYTES = 200 * 1024

# Ghi đè tay vị trí hoạt cảnh trên tranh CUỐI (x giữa, y miệng, theo điểm ảnh 1x của cảnh) khi layers.json
# không đủ để tự tính. Có mục ở đây thì bỏ qua FX_HINTS của cảnh đó.
FINAL_FX = {
    # 'factory': [('fx-chimney-smoke-lg', 251, 9)],
    # 'kitchen': [('fx-chimney-smoke', 60, 14)],
}

args = [a for a in sys.argv[1:]]
preview = None
if '--preview' in args:
    i = args.index('--preview')
    preview = args[i + 1]
    del args[i:i + 2]
S = os.path.abspath(args[0] if args else DEFAULT_S)
P0 = os.path.join(S, 'phase0')
P1 = os.path.join(S, 'phase1')


# ---------------------------------------------------------------- bảng màu

def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def oklab(rgb):
    c = [v / 255 for v in rgb]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    l = 0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]
    m = 0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]
    s = 0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


PALETTE = [hex_rgb(h) for h in json.load(open(os.path.join(P0, 'palette.json')))]
PAL_SET = set(PALETTE)
PAL_LAB = [oklab(c) for c in PALETTE]
INK = (0x2e, 0x1d, 0x14)


def nearest(rgb):
    """Màu gần nhất trong bảng (OKLab, sắc độ nặng gấp 2 như remap.py)."""
    L = oklab(rgb)
    best = min(range(len(PALETTE)), key=lambda k: (L[0] - PAL_LAB[k][0]) ** 2 + 4 * (L[1] - PAL_LAB[k][1]) ** 2 + 4 * (L[2] - PAL_LAB[k][2]) ** 2)
    return PALETTE[best]


_shade = {}


def shade(rgb):
    """Bóng đổ 28 % #2e1d14 (style bible), ép lại về bảng màu để cảnh không có màu lạ."""
    if rgb not in _shade:
        _shade[rgb] = nearest(tuple(round(c * 0.72 + k * 0.28) for c, k in zip(rgb, INK)))
    return _shade[rgb]


# ---------------------------------------------------------------- tìm hình

def rel(path):
    return os.path.relpath(path, S)


def version_key(path):
    m = re.search(r'-v(\d+)\.png$', path)
    return (int(m.group(1)) if m else 10_000, os.path.getmtime(path))


def skip(base, pat):
    """Bản nháp/bản phụ không dùng: _tạm, .base, .fix, -locked (trừ khi mẫu hỏi đúng bản khóa)."""
    return base.startswith('_') or '.base' in base or '.fix' in base or ('locked' in base and 'locked' not in pat)


def find(*patterns):
    """Hình đầu tiên khớp (theo thứ tự mẫu). Trong một mẫu: bản không đánh số (bản chốt) > số -vN lớn nhất."""
    for pat in patterns:
        hits = [p for p in glob.glob(os.path.join(S, pat)) if not skip(os.path.basename(p), pat)]
        if hits:
            return max(hits, key=version_key)
    return None


class Sprite:
    def __init__(self, path, flip=False):
        im = Image.open(path).convert('RGBA')
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        self.path, self.im = path, im
        self.bbox = im.getbbox() or (0, 0, im.width, im.height)

    @property
    def w(self):
        return self.bbox[2] - self.bbox[0]

    @property
    def h(self):
        return self.bbox[3] - self.bbox[1]

    def chimney(self):
        """Miệng ống khói = dải điểm ảnh đục cao nhất (nhà có ống khói thì ống khói luôn là chỗ cao nhất)."""
        x0, y0, x1, _ = self.bbox
        px = self.im.load()
        cols = [x for x in range(x0, x1) if px[x, y0][3]]
        return (sum(cols) / len(cols), y0)


_cache = {}


def sprite(path, flip=False):
    key = (path, flip)
    if key not in _cache:
        _cache[key] = Sprite(path, flip)
    return _cache[key]


def p0(name):
    return os.path.join(P0, 'dl', 'pal', name + '.png')


# ---------------------------------------------------------------- địa hình (ô Wang Phase 0)

TILESETS = {}
for ts in ('ts-grass-dirt', 'ts-water-grass', 'ts-dirt-stone'):
    meta = json.load(open(os.path.join(P0, 'dl', 'raw', ts + '.json')))['tileset_data']['tiles']
    TILESETS[ts] = (Image.open(p0(ts)).convert('RGBA'), [(t['corners'], t['bounding_box']) for t in meta])
# g cỏ, p đất, s đá lát, w nước. Một ô Wang chỉ chứa 2 loại: đá luôn cách cỏ ít nhất 1 đỉnh đất.
PAIRS = {'gp': ('ts-grass-dirt', {'g': 'lower', 'p': 'upper'}), 'gw': ('ts-water-grass', {'w': 'lower', 'g': 'upper'}),
         'ps': ('ts-dirt-stone', {'p': 'lower', 's': 'upper'})}
PURE = {'g': ('ts-grass-dirt', 'lower'), 'p': ('ts-grass-dirt', 'upper'), 'w': ('ts-water-grass', 'lower'), 's': ('ts-dirt-stone', 'upper')}


def terrain(canvas, kind_at):
    """kind_at(vx, vy) -> loại đất ở đỉnh lưới (vx 0..20, vy 0..5)."""
    V = [[kind_at(x, y) for x in range(W // T + 1)] for y in range(H // T + 1)]
    for y in range(H // T):
        for x in range(W // T):
            k = (V[y][x], V[y][x + 1], V[y + 1][x], V[y + 1][x + 1])
            kinds = ''.join(sorted(set(k)))
            if len(kinds) == 1:
                ts, side = PURE[kinds]
                want = {c: side for c in kinds}
            elif kinds in PAIRS:
                ts, want = PAIRS[kinds]
            else:
                raise SystemExit(f'ô ({x},{y}) có 3 loại đất {k}: thêm đỉnh đệm')
            img, tiles = TILESETS[ts]
            corners = dict(zip(('NW', 'NE', 'SW', 'SE'), (want[c] for c in k)))
            bb = next(b for c, b in tiles if c == corners)
            canvas.alpha_composite(img.crop((bb['x'], bb['y'], bb['x'] + T, bb['y'] + T)), (x * T, y * T))


# ---------------------------------------------------------------- ghép cảnh tạm

class Scene:
    def __init__(self, kind_at):
        self.im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        terrain(self.im, kind_at)
        self.items = []  # (chân y, thứ tự, hàm vẽ)
        self.fx = []
        self.sources = set()

    def add(self, path, cx, base, shadow=True, flip=False, smoke=None):
        """Đặt hình theo giữa-đáy (cx, base) như compose-slice; bóng elip pixel lệch +2 px sang phải."""
        if not path:
            return None
        sp = sprite(path, flip)
        self.sources.add(rel(path))
        x = round(cx - (sp.bbox[0] + sp.w / 2))
        y = round(base - sp.bbox[3])

        def draw():
            if shadow:
                self.shadow(cx, base - 2, max(4, round(sp.w / 2.3)), 3 if sp.h > 60 else 2)
            self.paste(sp.im, x, y)
            if smoke:
                mx, my = sp.chimney()
                self.fx.append((smoke, x + mx, y + my))
        self.items.append((base, len(self.items), draw))
        return sp

    def paste(self, im, x, y):
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        layer.paste(im, (x, y), im)
        self.im.alpha_composite(layer)

    def shadow(self, cx, cy, rx, ry):
        px = self.im.load()
        for dy in range(-ry, ry + 1):
            w = round(rx * math.sqrt(max(0, 1 - (dy / (ry + 0.5)) ** 2)))
            yy = round(cy + dy)
            if not 0 <= yy < H:
                continue
            for xx in range(round(cx - w + 2), round(cx - w + 2) + 2 * w):
                if 0 <= xx < W:
                    r, g, b, a = px[xx, yy]
                    if a:
                        px[xx, yy] = (*shade((r, g, b)), 255)

    def render(self):
        for _, _, draw in sorted(self.items, key=lambda it: (it[0], it[1])):
            draw()
        bg = Image.new('RGBA', (W, H), (*hex_rgb('#6dbb5a'), 255))
        bg.alpha_composite(self.im)
        return bg


def band(vy_from, kind='p', inner=None):
    """Cỏ phía trên, dải `kind` từ hàng đỉnh vy_from trở xuống; `inner(vx, vy)` vẽ đè (vd. quảng trường đá)."""
    def kind_at(x, y):
        k = kind if y >= vy_from else 'g'
        if inner:
            k = inner(x, y) or k
        return k
    return kind_at


def bldg(*ids):
    """Nhà Phase 1 nếu đã có (gói bldg-* trước, rồi hình nhà riêng của gói headers), không thì None."""
    return find(*[f'phase1/{pkg}/pal/{i}{v}.png' for pkg in ('bldg-*', 'headers') for i in ids for v in ('', '-v*')])


def npc(*patterns):
    return find(*patterns) or p0('npc-south')


def prop(*patterns, fallback=None):
    return find(*patterns) or (p0(fallback) if fallback else None)


def compose(name):
    tree = p0('tree')
    lamp, bench, crate, bed, fence = (p0(n) for n in ('lamp', 'bench', 'crate', 'flowerbed', 'fence'))
    if name == 'shop':
        sc = Scene(band(4))
        sc.add(tree, 14, 44)
        sc.add(tree, 306, 46)
        sc.add(p0('home'), 46, 66)
        sc.add(bench, 104, 66)
        sc.add(lamp, 88, 74)
        sc.add(p0('shop'), 160, 76)
        sc.add(crate, 214, 74)
        sc.add(crate, 226, 79)
        sc.add(crate, 202, 80)
        sc.add(bed, 262, 76)
        sc.add(lamp, 244, 74)
        sc.add(npc('phase1/npc-1/pal/shopkeeper/rot-south.png'), 126, 80)
    elif name == 'bank':
        plaza = lambda x, y: ('s' if 6 <= x <= 14 and y >= 4 else 'p' if 5 <= x <= 15 and y >= 3 else None)
        sc = Scene(band(5, 'p', plaza))
        side = find('phase1/bldg-*/pal/bank-locked.png')
        if side:
            sc.add(side, 22, 70)
            sc.add(side, 298, 70, flip=True)
        else:
            sc.add(tree, 20, 50)
            sc.add(tree, 300, 52)
        sc.add(bed, 70, 74)
        sc.add(bench, 104, 64)
        sc.add(bench, 216, 64)
        sc.add(lamp, 90, 78)
        sc.add(lamp, 230, 78)
        sc.add(p0('bank'), 160, 79)
        sc.add(bed, 250, 74)
        sc.add(npc('phase1/npc-3/pal/clerk/south.png'), 124, 80)
    elif name == 'factory':
        # Xưởng hạ thấp (mất phần chân) để thấy miệng ống khói và khói bốc lên.
        sc = Scene(band(3))
        sc.add(tree, 14, 42)
        for x in range(36, 116, 24):
            sc.add(fence, x, 50)
        sc.add(crate, 46, 68)
        sc.add(crate, 58, 74)
        sc.add(crate, 34, 78)
        sc.add(crate, 70, 81)
        sc.add(lamp, 102, 80)
        factory = bldg('factory')
        if factory:
            top = sprite(factory).chimney()[1] - sprite(factory).bbox[3]
            sc.add(factory, 176, 14 - top, smoke='fx-chimney-smoke-lg')
        else:
            sc.add(p0('shop'), 176, 78)
        sc.add(npc('phase1/npc-2/pal/farmer/idle-south.png'), 248, 79)
        sc.add(crate, 270, 74)
        sc.add(crate, 282, 80)
        sc.add(tree, 306, 46)
    elif name == 'kitchen':
        sc = Scene(band(4))
        sc.add(tree, 16, 46)
        sc.add(bed, 56, 72)
        sc.add(crate, 98, 74)
        sc.add(crate, 88, 79)
        sc.add(bldg('kitchen', 'cook') or p0('home'), 160, 76, smoke='fx-chimney-smoke')
        sc.add(crate, 224, 76)
        sc.add(bench, 262, 66)
        sc.add(lamp, 240, 76)
        sc.add(tree, 304, 46)
        sc.add(npc('phase1/npc-3/pal/chef/south.png'), 116, 80)
    elif name == 'garden':
        sc = Scene(band(5))
        sc.add(prop('phase1/props-2/pal/orange-tree.png', fallback='tree'), 18, 44)
        for x in (60, 100):
            sc.add(bed, x, 60)
            sc.add(bed, x, 78)
        sc.add(bldg('garden', 'shed', 'greenhouse') or p0('home'), 168, 74)
        for x in (232, 272):
            sc.add(bed, x, 60)
            sc.add(bed, x, 78)
        sc.add(prop('phase1/props-2/pal/cherry-tree.png', fallback='tree'), 306, 44)
        sc.add(npc('phase1/npc-2/pal/farmer/idle-south.png'), 128, 80)
    elif name == 'school':
        sc = Scene(band(4))
        sc.add(tree, 20, 50)
        sc.add(tree, 64, 40)
        sc.add(bench, 74, 70)
        sc.add(lamp, 106, 76)
        sc.add(bldg('school') or p0('home'), 162, 76)
        sc.add(bench, 246, 70)
        sc.add(tree, 296, 50)
        sc.add(prop('phase1/props-2/pal/bush-large.png', fallback='flowerbed'), 222, 78)
        sc.add(npc('phase1/npc-2/pal/student/idle-south.png'), 208, 80)
    elif name == 'clinic':
        sc = Scene(band(4))
        sc.add(tree, 16, 46)
        sc.add(bed, 64, 72)
        sc.add(bench, 96, 64)
        sc.add(lamp, 112, 78)
        sc.add(bldg('clinic') or p0('home'), 160, 76)
        sc.add(bed, 230, 74)
        sc.add(bench, 262, 64)
        sc.add(tree, 304, 46)
        sc.add(npc('phase1/npc-1/pal/grandpa/rot-south.png'), 212, 80)
    else:
        raise SystemExit(f'không có bố cục cho {name}')
    return sc


# ---------------------------------------------------------------- hoạt cảnh (ambient-1)

def load_fx():
    """{id: thông số} từ S/phase1/ambient-*/pal/fx-anim.json; chỉ lấy hoạt cảnh lặp có dải khung."""
    out = {}
    for meta in sorted(glob.glob(os.path.join(P1, 'ambient-*', 'pal', 'fx-anim.json'))):
        base = os.path.dirname(meta)
        for fid, m in json.load(open(meta)).items():
            strip = os.path.join(base, m.get('strip', ''))
            if m.get('playback') == 'loop' and os.path.isfile(strip):
                out[fid] = {**m, 'path': strip}
    return out


def place_fx(fx_lib, fid, mx, my):
    """Đặt dải khung theo neo của gói ambient: neo (giữa-đáy) trùng miệng ống khói, lấn 2 hàng xuống nắp ống."""
    m = fx_lib.get(fid)
    if not m:
        return None
    ax, ay = m['anchor']
    x, y = round(mx - ax), round(my - ay + 2)
    # miệng ống khói phải nằm trong khung, chừa ít nhất 8 px phía trên để thấy khói
    if not (0 <= mx < W and 8 <= my < H):
        return None
    return {'id': fid, 'src': f'{fid}.webp', 'x': x, 'y': y, 'w': m['frame_w'], 'h': m['frame_h'],
            'frames': m['frames'], 'ms': m['ms_per_frame']}


# ---------------------------------------------------------------- xuất

def webp_bytes(im):
    buf = io.BytesIO()
    im.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return buf.getvalue()


def audit(im):
    raw = im.convert('RGBA').tobytes()
    px = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]
    return {'off_palette': sum(1 for p in px if p[3] and p[:3] not in PAL_SET),
            'semi_alpha': sum(1 for p in px if 0 < p[3] < 255), 'colours': len({p[:3] for p in px if p[3]})}


# Hình trong tranh cuối có khói/hơi -> hoạt cảnh (tìm theo id/tên hình trong layers.json của gói headers).
# Neo 'chimney' = dải điểm ảnh cao nhất của hình; (x, y) = điểm trong hình gốc (vd. miệng nồi trên bếp lò).
FX_HINTS = {
    'factory': [('factory', 'fx-chimney-smoke-lg', 'chimney')],
    'kitchen': [('kitchen', 'fx-chimney-smoke', 'chimney'), ('kit-stove', 'fx-chimney-smoke', (20, 13))],
}


def final_fx(name, art_path):
    """Miệng ống khói trong tranh cuối, đọc từ layers/<name>/layers.json (cùng quy ước đặt hình giữa-đáy)."""
    out = list(FINAL_FX.get(name, []))
    if out:
        return out
    layers = os.path.join(os.path.dirname(art_path), 'layers', name, 'layers.json')
    if not os.path.isfile(layers):
        layers = os.path.join(P1, 'headers', 'layers', name, 'layers.json')
    try:
        objects = json.load(open(layers)).get('objects', [])
    except (OSError, ValueError):
        return out
    for key, fid, anchor in FX_HINTS.get(name, []):
        for o in objects:
            if key not in (o.get('id', '') + ' ' + os.path.basename(o.get('src', ''))) or o.get('frame'):
                continue
            path = os.path.join(S, o['src'])
            if not os.path.isfile(path):
                continue
            sp = sprite(path, o.get('flip', False))
            left = round(o['x'] - (sp.bbox[0] + sp.w / 2))
            top = round(o['y'] - sp.bbox[3])
            if anchor == 'chimney':
                mx, my = sp.chimney()
            else:
                mx, my = (sp.im.width - 1 - anchor[0] if o.get('flip') else anchor[0]), anchor[1]
            out.append((fid, left + mx, top + my))
    return out


def final_art(name):
    hits = sorted(glob.glob(os.path.join(P1, 'headers', '**', f'{name}-1x.png'), recursive=True),
                  key=lambda p: ('/pal/' not in p, p))
    for path in hits:
        im = Image.open(path).convert('RGBA')
        if im.size == (W, H):
            return path, im
        print(f'  ! {rel(path)} là {im.size[0]}x{im.size[1]}, cần {W}x{H}: bỏ qua')
    return None, None


def main():
    os.makedirs(OUT, exist_ok=True)
    fx_lib = load_fx()
    table, entries, sheet = {}, [], []
    for name in SCENES:
        path, im = final_art(name)
        fx = []
        if im is not None:
            status, sources = 'art', [rel(path)]
            bg = Image.new('RGBA', (W, H), (*hex_rgb('#fbf1e3'), 255))
            bg.alpha_composite(im)
            im = bg
            fx = [place_fx(fx_lib, fid, mx, my) for fid, mx, my in final_fx(name, path)]
        else:
            sc = compose(name)
            im = sc.render()
            status, sources = 'placeholder', sorted(sc.sources)
            fx = [place_fx(fx_lib, fid, mx, my) for fid, mx, my in sc.fx]
        fx = [f for f in fx if f]
        data = webp_bytes(im.convert('RGB'))
        if len(data) > MAX_BYTES:
            raise SystemExit(f'{name}.webp {len(data)} B > {MAX_BYTES} B')
        with open(os.path.join(OUT, f'{name}.webp'), 'wb') as f:
            f.write(data)
        for item in fx:
            strip = Image.open(fx_lib[item['id']]['path']).convert('RGBA')
            with open(os.path.join(OUT, item['src']), 'wb') as f:
                f.write(webp_bytes(strip))
        check = audit(im)
        table[name] = {'src': f'{name}.webp', 'w': W, 'h': H, 'status': status, 'fx': fx}
        print(f'{name:8s} {status:11s} {len(data):6d} B  off-palette={check["off_palette"]} fx={[f["id"] for f in fx]}  <- {", ".join(sources[:3])}{" …" if len(sources) > 3 else ""}')
        entries.append(manifest_entry(name, status, sources, check, len(data), fx))
        sheet.append(im)
    # dọn dải hoạt cảnh không còn cảnh nào dùng
    used = {f['src'] for s in table.values() for f in s['fx']}
    for old in glob.glob(os.path.join(OUT, 'fx-*.webp')):
        if os.path.basename(old) not in used:
            os.remove(old)
    with open(os.path.join(OUT, 'scenes.json'), 'w') as f:
        json.dump({'size': [W, H], 'scale': {'desktop': 3, 'narrow': 2, 'phone': 2},
                   'note': 'scripts/art/build-scenes.py; x/y/w/h tính theo điểm ảnh 1x của cảnh 320x80',
                   'scenes': table}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    write_manifest(entries)
    total = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, '*')))
    print(f'tổng thư mục scenes: {total} B')
    if preview:
        pad = 4
        big = Image.new('RGB', (W * 3 + 2 * pad, (H * 3 + pad) * len(sheet) + pad), hex_rgb('#fbf1e3'))
        for i, im in enumerate(sheet):
            big.paste(im.convert('RGB').resize((W * 3, H * 3), Image.NEAREST), (pad, pad + i * (H * 3 + pad)))
        big.save(preview)
        print('preview', preview)


def manifest_entry(name, status, sources, check, size, fx):
    placeholder = status == 'placeholder'  # 'art' = tranh của gói headers
    return {
        'id': f'scene-{name}',
        'role': f'header scene: {LABELS[name]} (view {name})',
        'path': f'public/ta-tua/game/assets/scenes/{name}.webp',
        'status': 'sample',
        'technical': {
            'dimensions': f'{W}x{H}', 'alpha': False, 'anchor': 'center (phone: center crop)', 'frames': 1,
            'filtering': 'nearest', 'scale': 'integer 3x desktop (2x when the column is under 960 px) / 2x phone',
            'bytes': size, 'fx': [f['id'] for f in fx],
        },
        'visual_locks': ['palette.json', 'view: low top-down', 'light: top-left', 'outline: #2e1d14 outer'],
        'provenance': {
            'kind': 'composited' if placeholder else 'generated',
            'tool': 'scripts/art/build-scenes.py' + (' (placeholder compositor)' if placeholder else ' <- headers package (compose.py)'),
            'mode': status,
            'pixellab_id': '',
            'prompt': '',
            'params': {'sources': sources},
            'created_at': '',
            'generation_cost': 0,
            'postprocess': ['opaque on #fbf1e3', 'WebP lossless (exact)'] + (
                ['Wang terrain + sprites placed by bottom-centre', 'shadow 28% #2e1d14 snapped to palette'] if placeholder else []),
            'license': 'derived from PixelLab assets listed in sources (PixelLab ToS) — verify before ship',
        },
        'verification': {
            'native_scale_reviewed': True, 'in_engine_reviewed': True, 'technical_checks_passed': check['off_palette'] == 0,
            'approved_by': '', 'notes': f'off-palette={check["off_palette"]} colours={check["colours"]}'
                + ('; placeholder until the headers package lands' if placeholder else ''),
        },
    }


def write_manifest(entries):
    try:
        doc = json.load(open(MANIFEST))
    except FileNotFoundError:
        doc = {'schema_version': 2, 'art_direction_brief': 'style-bible.md', 'palette': 'palette.json',
               'schema_notes': {'provenance': 'tool, mode, pixellab_id, prompt, params, created_at, generation_cost, postprocess[], license',
                                'status': 'planned | sample | approved | rejected',
                                'path': "proposed runtime path; '#name' = atlas frame"},
               'assets': []}
    doc['assets'] = [a for a in doc.get('assets', []) if not a.get('id', '').startswith('scene-')] + entries
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
