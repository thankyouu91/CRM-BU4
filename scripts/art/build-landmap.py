#!/usr/bin/env python3
"""Bản đồ đất gia tộc 16-bit: tranh nền 702x332 và atlas hiệu ứng cho landmap.js.

    python3 -I scripts/art/build-landmap.py ART_ROOT [--preview out.png] [--audit audit.txt] [--dump DIR]

ART_ROOT (bắt buộc) là thư mục làm việc của đội vẽ (không nằm trong repo), chứa:
  phase0/palette.json                      bảng 48 màu đã duyệt
  phase1/tiles/                            bộ Wang và terrain.py (pond_decal)
  phase1/ambient-1/pal/                    khói ống khói, lấp lánh nước
  phase3/landmap-concept/pal/              hình của concept đã duyệt (đã remap, viền mực)
  phase3/lm-terrain|lm-landmarks|lm-life/pal/   hình của 3 gói vẽ sản xuất (khi đã có)
Ảnh trong public/ đã là bản cuối nên game chạy không cần ART_ROOT.

Hình học lô lấy bằng node từ chính game (scripts/art/dump-plots.mjs chạy clan.js + landmap.js), không chép thuật toán.
Bố cục theo concept bản sửa 2 (compose2.py): vùng nền theo ô lục giác (ranh mềm ±3 điểm, sâu hơn 3,5 điểm luôn đúng
vùng), sông theo riverPoints, công trình biểu tượng đặt bằng tìm kiếm ít đè lô khác vùng nhất, bóng tối một bậc palette.

Gói vẽ sản xuất: chạy lại script này là đủ, không sửa mã game (--concept-only: bỏ qua các gói, chỉ dùng hình concept).
Hình trong <gói>/pal/ (PNG, đúng palette, alpha 0/255) thay hình concept theo vai trò (bảng ROLES):
  waterfall-NN, windmill-sails-NN  khung động đủ hình, cùng cỡ (khung 0 nằm trên tranh, các khung sau vào fx.webp);
  mine-rock (trạm mỏ), mountain-x, peak-x, far-ridge, knoll-rock-x, knoll-earth-x (núi đồi), bridge-stone-ns, bridge-wood-ns;
  tex-snow, tex-highland, tex-tea, tex-wheat, tex-paddy (ô nền lặp, thay nền vẽ bằng mã).
  lm-life (đã duyệt): theo đúng luật của gói (lm-life/scripts/patch-compose.py, fx3.py): nhà mặt tiền thẳng house-town-*
  (chỉ trong 40 điểm quanh E10), house-small-*, house-cottage-*, barn-front-*, farm-*, tree2-*, beach-*, islet-*; mây cloud-a/b/c
  (neo góc trên trái), pal/fx-gull/N.png (hải âu 9x5), pal/fx-house-smoke/N.png (làn khói trên nhà có ống khói),
  pal/fx-pennant/N.png (cờ trên tháp tòa thị chính).
  Cùng tên với hình concept (vd. pagoda.png, harbour.png) cũng thay hình đó. Thứ tự ưu tiên: lm-landmarks, lm-life,
  lm-terrain, rồi concept. Gói có manifest.json thì nguồn gốc được chép vào docs/art/asset-manifest.json.

Ba cổng kiểm (trượt là dừng, không ghi gì):
  (a) 0 điểm ảnh nền sai vùng sâu hơn 3,5 điểm trong ô;
  (b) công trình biểu tượng, kiểm trên cả hình: đè lô khác vùng tối đa 12 điểm và chỉ ở 1/4 trên;
  (c) cảm nhận từng lô: Đồi núi đá + đất + chè >= 30 % và thông sẫm ít hơn lô rừng ít thông nhất; Ven biển cát >= 50 %
      (trừ lô mang công trình; đồ bãi biển đứng trên cát tính là cát); Trung tâm nước <= 33 %.
Ra (public/ta-tua/game/assets/landmap/): map.webp (702x332, lossless), fx.webp (atlas hiệu ứng, đệm 1 điểm),
landmap.json (kích thước, plots_hash, lô có công trình, hiệu ứng); thay các mục area "landmap" (id lm-*) trong
docs/art/asset-manifest.json, giữ nguyên byte các mục khác. Cùng đầu vào thì ra cùng byte.
"""
import io
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

LICENSE = 'PixelLab output owned by the creator, commercial use allowed (PixelLab ToS §1.3, §3.3, https://pixellab.ai/termsofservice); not to be used to train other models without written permission (§1.2, §3.3)'
APPROVED_BY = 'owner (design session, 2026-10-31)'
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT_DIR = os.path.join(REPO, 'public', 'ta-tua', 'game', 'assets', 'landmap')
MANIFEST = os.path.join(REPO, 'docs', 'art', 'asset-manifest.json')
MAX_MAP, MAX_FX, MAX_JSON, MAX_TOTAL, MAX_FILE = 80 * 1024, 24 * 1024, 6 * 1024, 110 * 1024, 200 * 1024

args = sys.argv[1:]


def opt(flag):
    if flag in args:
        i = args.index(flag)
        v = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]
        return v
    return None


PREVIEW, AUDIT, DUMP = opt('--preview'), opt('--audit'), opt('--dump')
CONCEPT_ONLY = '--concept-only' in args
args = [a for a in args if a != '--concept-only']
if not args or args[0].startswith('-'):
    raise SystemExit('Thiếu ART_ROOT: python3 -I scripts/art/build-landmap.py ART_ROOT [--concept-only] [--preview out.png] [--audit audit.txt] [--dump DIR] (xem docstring)')
ROOT = os.path.abspath(args[0])
C = os.path.join(ROOT, 'phase3', 'landmap-concept')
# Gói vẽ chỉ được dùng khi đã giao xong (có report.txt); gói đang vẽ dở bị bỏ qua.
PKGS = [] if CONCEPT_ONLY else [d for d in (os.path.join(ROOT, 'phase3', p) for p in ('lm-landmarks', 'lm-life', 'lm-terrain'))
                                if os.path.isfile(os.path.join(d, 'report.txt'))]
LIFE = any(os.path.basename(d) == 'lm-life' for d in PKGS)
TERR = any(os.path.basename(d) == 'lm-terrain' for d in PKGS)
LMKS = any(os.path.basename(d) == 'lm-landmarks' for d in PKGS)
for need in (os.path.join(ROOT, 'phase0', 'palette.json'), os.path.join(ROOT, 'phase1', 'tiles', 'scripts', 'terrain.py'), os.path.join(C, 'pal')):
    if not os.path.exists(need):
        raise SystemExit(f'ART_ROOT thiếu {os.path.relpath(need, ROOT)} (xem docstring)')
sys.path.insert(0, os.path.join(ROOT, 'phase1', 'tiles', 'scripts'))
from terrain import Terrain, pond_decal  # noqa: E402

D = json.loads(subprocess.run(['node', os.path.join(REPO, 'scripts', 'art', 'dump-plots.mjs')], check=True, capture_output=True, text=True, cwd=REPO).stdout)
S = 2 / 3
W, H = 702, 332
UNIT = 1.5
assert round(W * UNIT) >= D['MAP_W'] and round(H * UNIT) == D['MAP_H'], ('khung SVG đổi', D['MAP_W'], D['MAP_H'])
PAL = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in json.load(open(os.path.join(ROOT, 'phase0', 'palette.json')))]
PALSET = set(PAL)
INK = (0x2e, 0x1d, 0x14)
ZID = {'sea': 0, 'coast': 1, 'plain': 2, 'river': 3, 'urban': 4, 'hill': 5, 'forest': 6}
ZN = {v: k for k, v in ZID.items()}
plots = D['plots']
CX = np.array([g['cx'] * S for g in D['geo']])
CY = np.array([g['cy'] * S for g in D['geo']])
PZ = np.array([ZID[p['zone']] for p in plots])
TW = 32.0
APO = TW / 2
ROW = (CY[20] - CY[0])
by_code = {p['code']: i for i, p in enumerate(plots)}
LOG = []
USED = {}  # tên hình -> đường dẫn nguồn (cho manifest)

def pal_path(name):
    """Hình `name` từ gói sản xuất nếu có, không thì từ concept."""
    for pkg in PKGS:
        p = os.path.join(pkg, 'pal', name + '.png')
        if os.path.isfile(p):
            return p
    p = os.path.join(C, 'pal', name + '.png')
    return p if os.path.isfile(p) else None


def pkg_dir_frames(name):
    """Khung N.png trong thư mục <gói>/pal/<name>/ (hiệu ứng), hoặc []."""
    for pkg in PKGS:
        d = os.path.join(pkg, 'pal', name)
        out = []
        while os.path.isfile(os.path.join(d, f'{len(out)}.png')):
            USED[f'{name}-{len(out)}'] = os.path.join(d, f'{len(out)}.png')
            out.append(np.array(Image.open(os.path.join(d, f'{len(out)}.png')).convert('RGBA')))
        if out:
            return out
    return []


def log(*a):
    s = ' '.join(str(x) for x in a)
    LOG.append(s)
    print(s)


def h2(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------- noise
def value_noise(w, h, cell, seed):
    rng = np.random.default_rng(seed)
    gw, gh = int(w / cell) + 3, int(h / cell) + 3
    g = rng.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0, y0 = xs.astype(int), ys.astype(int)
    fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = g[y0, x0], g[y0, x0 + 1]
    c, d = g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def fbm(w, h, cell, seed):
    return value_noise(w, h, cell, seed) * 0.6 + value_noise(w, h, cell / 2.1, seed + 7) * 0.3 + value_noise(w, h, cell / 4.3, seed + 13) * 0.1


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
YY, XX = np.mgrid[0:H, 0:W]
BAY = BAYER[YY % 4, XX % 4]
HASH = np.random.default_rng(99).random((H, W))


# ---------------------------------------------------------------- zones per pixel
def nearest_hex(px, py):
    out = np.empty(px.size, int)
    fx, fy = px.ravel(), py.ravel()
    for s in range(0, fx.size, 40000):
        d = (fx[s:s + 40000, None] - CX[None]) ** 2 + (fy[s:s + 40000, None] - CY[None]) ** 2
        out[s:s + 40000] = d.argmin(1)
    return out.reshape(px.shape)


warp = 3.0
wx = (fbm(W, H, 14, 1) - 0.5) * 2 * warp
wy = (fbm(W, H, 14, 2) - 0.5) * 2 * warp
HEX = nearest_hex(XX + 0.5, YY + 0.5)
HEXW = nearest_hex(XX + 0.5 + wx, YY + 0.5 + wy)
dx, dy = np.abs(XX + 0.5 - CX[HEX]), np.abs(YY + 0.5 - CY[HEX])
INSIDE = (dx <= APO) & (dx * 0.5 + dy * 0.866 <= APO)
EDGE = np.minimum(APO - dx, (APO - (dx * 0.5 + dy * 0.866)))
ZONE = PZ[HEXW].copy()
deep = INSIDE & (EDGE > 3.5)
ZONE[deep] = PZ[HEX][deep]
margin = ~INSIDE
ZONE[margin & (ZONE == ZID['coast'])] = ZID['sea']
ZONE[margin & (ZONE == ZID['river'])] = ZID['hill']
ZONE[INSIDE & (PZ[HEX] == ZID['coast'])] = ZID['coast']
Z = ZONE
INNER = INSIDE & (EDGE > 3.5)

def dist_to(mask, cap=24):
    d = np.where(mask, 0, cap).astype(np.int16)
    cur = mask.copy()
    for k in range(1, cap):
        nb = cur.copy()
        nb[1:] |= cur[:-1]
        nb[:-1] |= cur[1:]
        nb[:, 1:] |= cur[:, :-1]
        nb[:, :-1] |= cur[:, 1:]
        new = nb & ~cur
        d[new] = k
        cur = nb
        if not new.any():
            break
    return d


def nb4(m):
    n = np.zeros_like(m)
    n[1:] |= m[:-1]
    n[:-1] |= m[1:]
    n[:, 1:] |= m[:, :-1]
    n[:, :-1] |= m[:, 1:]
    return n


# ---------------------------------------------------------------- textures + palette-locked light/dark steps
T = Terrain(os.path.join(ROOT, 'phase1', 'tiles', 'pal', 'terrain.json'))


def pure(code):
    sid = T.pure[code]
    x, y = T.sets[sid]['tiles'][code * 4]
    return np.array(T.image(sid).convert('RGBA'))[y:y + 16, x:x + 16, :3]


TEX = {c: pure(c) for c in 'gpswbcmth'}
RAMPS = ['c4e89a 8fcf6a 6dbb5a 4e9a45 3e7a3f 2f5a3a', 'ecd2a2 dcb07c c8915f 9b6238 7a4e2c 5c3a24 3d2a1f',
         'eef8fb bfe3f2 8fd0e8 58b9d6 3f8fc0 2f6f9a', 'c4bcb0 9c948a 6e6660 4a3326 3d2a1f 2e1d14',
         'b87d4b 8a5a34 5c3a24 3d2a1f', '8c3f2a 6e2e24 3d2a1f', 'ffd1dc f4a3b4 d9708a a84848 6e2e24',
         'd65f5f a84848', 'fffaf3 fbf1e3 ecd8bf dcc0a0 c8915f', 'fff3c4 ecd2a2', 'f2c49b c88a62 9b6238',
         '8fd3bf 4fae93 2f7f73 2f5a3a', 'f4c24f d79c1c b4643a 8c3f2a', 'f39b4a b4643a', 'e84a5f a84848']
DARK, LIGHT = {}, {}
for r in RAMPS:
    cs = [h2('#' + c) for c in r.split()]
    for a, b in zip(cs, cs[1:]):
        DARK.setdefault(a, b)
        LIGHT.setdefault(b, a)
DARK.setdefault(INK, INK)
for c in PAL:
    DARK.setdefault(c, INK if sum(c) < 200 else c)
    LIGHT.setdefault(c, c)


def step(img, mask, lut):
    flat = img.reshape(-1, 3)
    m = mask.ravel()
    keys = flat[m]
    if not len(keys):
        return
    packed = (keys[:, 0].astype(np.int32) << 16) | (keys[:, 1].astype(np.int32) << 8) | keys[:, 2]
    tab = {((a << 16) | (b << 8) | c): lut[(a, b, c)] for (a, b, c) in lut}
    flat[m] = np.array([tab.get(int(v), (int(v) >> 16, (int(v) >> 8) & 255, int(v) & 255)) for v in packed], np.uint8)


def darken(img, mask):
    step(img, mask, DARK)


def lighten(img, mask):
    step(img, mask, LIGHT)


TEX['G'] = TEX['g'].copy()                                   # forest floor: grass one step darker
darken(TEX['G'], np.ones((16, 16), bool))
g_ = TEX['g']                                                # calm grass (style bible 8 open item)
g_[(g_[..., 0] == 0x3e) & (g_[..., 1] == 0x7a) & (g_[..., 2] == 0x3f)] = h2('#4e9a45')
TEX['P'] = TEX['p'].copy()                                   # highland earth: dirt one step darker (#c8915f / #9b6238)
darken(TEX['P'], np.ones((16, 16), bool))


def stony_grass():
    t = TEX['g'].copy()
    rng = np.random.default_rng(11)
    for _ in range(5):
        x, y = rng.integers(0, 15, 2)
        t[y, x:x + 2] = h2('#c4bcb0')
        t[y + 1, x:x + 2] = h2('#9c948a')
        t[y + 1, x + 1] = h2('#6e6660')
    return t


TEX['k'] = stony_grass()


def ltex(n):
    """Ô nền 16x16 của gói lm-terrain (tex-<n>)."""
    USED['tex-' + n] = pal_path('tex-' + n)
    return np.array(Image.open(USED['tex-' + n]).convert('RGB'))


LT = {n: ltex(n) for n in ('snow', 'highland', 'paddy', 'wheat', 'tea', 'rice', 'ripe')} if TERR else {}


def cellvar(t, mask, seed, flip=True):
    """lm-terrain: lặp ô 16 điểm với độ lệch (và lật ngang) ngẫu nhiên theo từng ô 16 điểm để giấu lưới lặp."""
    rng = np.random.default_rng(seed)
    gy, gx = H // 16 + 2, W // 16 + 2
    ox = rng.integers(0, 16, (gy, gx))
    oy = rng.integers(0, 16, (gy, gx))
    fl = rng.random((gy, gx)) < 0.5 if flip else np.zeros((gy, gx), bool)
    cy_, cx_ = YY // 16, XX // 16
    u = (XX + ox[cy_, cx_]) % 16
    u = np.where(fl[cy_, cx_], 15 - u, u)
    v = (YY + oy[cy_, cx_]) % 16
    return t[v[mask], u[mask]]

# ---------------------------------------------------------------- ground per pixel
GROUND = np.full((H, W), 'g', '<U1')
row_of = lambda y: (y - CY[0]) / ROW  # noqa: E731
rowf = row_of(YY + 0.5)
n1 = fbm(W, H, 10, 3)
n2 = fbm(W, H, 5, 4)
sea = Z == ZID['sea']
to_sea = dist_to(sea, 30)
GROUND[sea] = 'w'
coast = Z == ZID['coast']
GROUND[coast] = 'b'                                           # LM-04: the whole coast plot is beach
GROUND[Z == ZID['plain']] = 'g'
GROUND[Z == ZID['river']] = np.where(n2[Z == ZID['river']] > 0.45, 'm', 'g')
GROUND[Z == ZID['urban']] = 'c'
hill = Z == ZID['hill']
snowline = 0.55 + (fbm(W, H, 18, 6) - 0.5) * 0.9
GROUND[hill] = np.where(rowf[hill] < snowline[hill], 'n', 'H')
forest = Z == ZID['forest']
GROUND[forest] = 'G'
GROUND[forest & (rowf < snowline - 0.2)] = 'n'

img = np.zeros((H, W, 3), np.uint8)
for code in 'gpswbcmthGk':
    m = GROUND == code
    img[m] = TEX[code][YY[m] % 16, XX[m] % 16]

# --- snow (LM-10): shaded drifts, wind ripples, rock showing through; no flat paper white
snow = GROUND == 'n'
hs = fbm(W, H, 13, 51)
gs = hs - np.roll(np.roll(hs, -2, 0), -2, 1)                 # light from the top-left
if TERR:                                                      # tuyết lm-terrain: lặp thường, cột lệch 5 điểm mỗi 48 điểm
    img[snow] = LT['snow'][(YY[snow] + (XX[snow] // 48) * 5) % 16, XX[snow] % 16]
    darken(img, snow & (gs < -0.03) & (BAY < 0.6))
    darken(img, snow & (gs < -0.05))
    img[snow & (gs > 0.03) & (BAY < 0.5)] = h2('#fffaf3')
    rock_s = snow & (fbm(W, H, 6, 52) > (0.70 - 0.08 * (Z == ZID['hill'])))
else:
    img[snow] = h2('#eef8fb')
    img[snow & (gs < -0.018)] = h2('#bfe3f2')
    img[snow & (gs < -0.018) & (BAY < 0.5)] = h2('#bfe3f2')
    img[snow & (gs < -0.042)] = h2('#8fd0e8')
    img[snow & (gs > 0.03) & (BAY < 0.6)] = h2('#fffaf3')
    rip = snow & (HASH < 0.035)
    for k in range(3):
        img[np.roll(rip, k, 1) & snow] = h2('#bfe3f2')
    rock_s = snow & (fbm(W, H, 6, 52) > 0.70)
img[rock_s] = h2('#9c948a')
img[rock_s & ~np.roll(rock_s, 1, 0)] = h2('#c4bcb0')
img[rock_s & ~np.roll(rock_s, -1, 0)] = h2('#6e6660')

# --- highland (LM-01): brown earth with stones, stony-grass hollows, grey rock, relief shading
hl = GROUND == 'H'
hh = fbm(W, H, 20, 31) * 0.75 + fbm(W, H, 8, 32) * 0.25
mat = fbm(W, H, 7, 41)
img[hl] = cellvar(LT['highland'], hl, 502) if TERR else TEX['P'][YY[hl] % 16, XX[hl] % 16]
grassy = hl & (mat < 0.36)
img[grassy] = TEX['k'][YY[grassy] % 16, XX[grassy] % 16]
edge_g = hl & ~grassy & nb4(grassy) & (BAY < 0.5)
img[edge_g] = h2('#6dbb5a')
rockm = hl & (mat > 0.66)
img[rockm] = h2('#9c948a')
img[rockm & (HASH < 0.25)] = h2('#c4bcb0')
img[rockm & ~np.roll(rockm, 1, 0)] = h2('#c4bcb0')
img[rockm & ~np.roll(rockm, -1, 0)] = h2('#6e6660')
pebble = hl & ~rockm & ~grassy & (HASH < 0.05)
img[pebble] = h2('#c4bcb0')
img[np.roll(pebble, 1, 0) & hl & ~rockm & ~grassy] = h2('#6e6660')
gh = hh - np.roll(np.roll(hh, -2, 0), -2, 1)
lighten(img, hl & (gh > 0.016) & (BAY < 0.75))
darken(img, hl & (gh < -0.016) & (BAY < 0.75))
darken(img, hl & (gh < -0.04))

# soft dithered seams between unlike grounds
for a, b, col in (('b', 'g', '#dcb07c'), ('n', 'H', '#bfe3f2'), ('n', 'G', '#bfe3f2'), ('n', 'g', '#bfe3f2'), ('H', 'g', '#9b6238'),
                  ('H', 'm', '#9b6238')):
    ma, mb = GROUND == a, GROUND == b
    img[nb4(ma) & mb & (BAY < 0.6)] = h2(col)

# lm-terrain: vách đá ở mép nam các đồi thấp (nhìn 3/4 chỉ thấy vách quay về nam), lấy vân từ dải cliff-stone-a (5 hàng, cột
# cách 1), vẽ phía lô Đồi núi để lô Đồng bằng giữ nguyên nền; một vệt tối một bậc ở chân vách.
CLIFF = np.zeros((H, W), bool)
if TERR:
    USED['cliff-stone-a'] = pal_path('cliff-stone-a')
    _cl = np.array(Image.open(USED['cliff-stone-a']).convert('RGB'))
    CLIFF_TEX = _cl[[5, 8, 11, 14, 17]][:, 1:-1:2]
    hillm = Z == ZID['hill']
    southp = (Z == ZID['plain'])
    CK = np.zeros((H, W), int)
    for k in range(1, 6):
        below = np.zeros((H, W), bool)
        below[:-k] = southp[k:]
        m_ = hillm & below & (rowf > 2.6) & ~CLIFF
        CK[m_] = 5 - k
        CLIFF |= m_
    cl_ok = CLIFF & (n2 > 0.22)
    img[cl_ok] = CLIFF_TEX[CK[cl_ok], XX[cl_ok] % CLIFF_TEX.shape[1]]
    foot = np.zeros((H, W), bool)
    foot[1:] = cl_ok[:-1]
    foot &= southp
    darken(img, foot)
    CLIFF = cl_ok
    log('vách đồi (điểm ảnh):', int(CLIFF.sum()))

# ---------------------------------------------------------------- urban plaza around the town hall
keep = by_code['E10']
kx, ky = CX[keep], CY[keep]
plaza = (np.abs(XX - kx) < 18) & (YY > ky - 12) & (YY < ky + 15) & (Z == ZID['urban'])
img[plaza] = TEX['s'][YY[plaza] % 16, XX[plaza] % 16]
img[plaza & ~np.roll(plaza, 1, 0)] = h2('#fffaf3')
img[plaza & ~np.roll(plaza, -1, 0)] = h2('#9c948a')


# ---------------------------------------------------------------- river course (narrow canal in the city, LM-08)
def catmull(points, step_=0.5):
    out = []
    for k in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(0, k - 1)], points[k], points[k + 1], points[min(len(points) - 1, k + 2)]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step_))
        for s in range(n):
            t = s / n
            t2, t3 = t * t, t * t * t
            f = lambda a, b, c, d: 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)  # noqa: E731
            out.append((f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])))
    out.append(points[-1])
    return out


river_pts = [(x * S, y * S) for x, y in D['river']]
bends = [river_pts[0]]
for k in range(1, len(river_pts)):
    (ax, ay), (bx, by) = river_pts[k - 1], river_pts[k]
    ln = math.hypot(bx - ax, by - ay) or 1
    s = 3 if k % 2 else -3
    bends += [((ax + bx) / 2 - (by - ay) / ln * s, (ay + by) / 2 + (bx - ax) / ln * s), (bx, by)]
bends[0] = (-4, bends[0][1])
flow = catmull(bends, 0.4)
in_city = Z == ZID['urban']
city_d = dist_to(in_city, 10)
coast_d = dist_to(Z == ZID['coast'], 8)
river = np.zeros((H, W), bool)
for k, (x, y) in enumerate(flow):
    wdt = 3.2 + 2.2 * (k / len(flow))
    xi, yi = int(min(W - 1, max(0, x))), int(min(H - 1, max(0, y)))
    if city_d[yi, xi] < 8:                                      # narrow canal inside (and just around) the city
        wdt = 2.6 + (wdt - 2.6) * city_d[yi, xi] / 8
    if Z[yi, xi] == ZID['coast'] or coast_d[yi, xi] < 6:          # narrow mouth across the beach (G17), LM-04
        wdt = min(wdt, 2.5)
    x0, x1 = int(max(0, x - wdt - 1)), int(min(W, x + wdt + 2))
    y0, y1 = int(max(0, y - wdt - 1)), int(min(H, y + wdt + 2))
    yy, xx = np.mgrid[y0:y1, x0:x1]
    river[y0:y1, x0:x1] |= (xx + 0.5 - x) ** 2 + ((yy + 0.5 - y) * 1.15) ** 2 <= wdt * wdt
to_river = dist_to(river, 40)
to_land = dist_to(~(sea | river), 12)


# ---------------------------------------------------------------- roads (fields keep clear; drawn after the fields)
def C_(c, r, ddx=0, ddy=0):
    k = r * 20 + c
    return (CX[k] + ddx, CY[k] + ddy)


ROADS = [
    [(kx, ky + 8), C_(8, 6, -2, 4), C_(6, 7, 0, 6), C_(3, 8, 2, 0), C_(0, 8, -14, 2)],      # west to the paddies
    [(kx, ky + 8), C_(10, 7, 4, 2), C_(12, 7, 0, 6), C_(14, 7, -2, 2)],                     # south-east to the harbour
    [(kx, ky - 6), C_(10, 3, 0, 0), C_(12, 2, 0, 6), C_(14, 3, 2, 4)],                      # north-east to the sawmill
    [C_(8, 5, -4, 0), C_(6, 4, 2, 4), C_(5, 3, 6, 6)],                                       # west to the mine
    [C_(12, 5, 6, 2), C_(14, 5, 0, 4), C_(16, 5, 0, 4), C_(18, 5, -2, 6)],                   # east to the lighthouse
    [C_(6, 7, 0, 6), C_(5, 8, 2, 8), C_(5, 9, 0, 14)],                                       # south farms (past the windmill)
]
road = np.zeros((H, W), bool)
for pts in ROADS:
    for x, y in catmull(pts, 0.4):
        x0, y0 = int(round(x)), int(round(y))
        if 0 <= x0 < W and 0 <= y0 < H and Z[y0, x0] != ZID['sea']:
            road[max(0, y0 - 1):y0 + 2, max(0, x0 - 1):x0 + 2] = True
road &= ~sea
road_near = dist_to(road, 4) < 3
busy = np.zeros((H, W), bool)
busy |= CLIFF

# ---------------------------------------------------------------- sprites
SPR = {}


def spr(name):
    if name not in SPR:
        path = pal_path(name)
        if not path:
            raise SystemExit(f'thiếu hình {name}.png (concept hoặc gói vẽ)')
        USED[name] = path
        SPR[name] = Image.open(path).convert('RGBA')
    return SPR[name]


items = []  # (sort key, x centre, sprite, shadow, name)


def put(name, x, foot, flip=False, shadow=True, z=0.0, img_=None, anim=None):
    """`anim`: khóa hiệu ứng mặt đất (hình động vẽ lại theo khung ở build, xem phần hiệu ứng)."""
    s = img_ if img_ is not None else spr(name)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    items.append((foot + z * 0.01, x, s, shadow, name, foot, {'anim': anim, 'flip': flip, 'n': len(items)}))


def free(x, y, w=6, zone=None, margin_ok=False, ground=None):
    x0, x1 = int(x - w / 2), int(x + w / 2)
    y0 = int(y)
    if x0 < 0 or x1 >= W or y0 < 2 or y0 >= H:
        return False
    if busy[y0 - 2:y0 + 1, x0:x1 + 1].any():
        return False
    if zone is not None:
        if not (Z[y0 - 2:y0 + 1, x0:x1 + 1] == ZID[zone]).all():
            return False
        if not margin_ok and not INSIDE[y0, int(x)]:
            return False
    if ground is not None and not np.isin(GROUND[y0 - 2:y0 + 1, x0:x1 + 1], list(ground)).all():
        return False
    return True


def claim(x, y, w, h=4):
    busy[max(0, int(y - h)):int(y) + 1, max(0, int(x - w / 2)):int(x + w / 2) + 1] = True


def sprite_cover(sprite, x, foot):
    """(X, Y, rowfrac) of the opaque pixels of a sprite drawn with its foot centre at (x, foot)."""
    a_ = np.array(sprite)[..., 3] > 0
    ox, oy = int(round(x - sprite.width / 2)), int(round(foot - sprite.height + 1))
    ys_, xs_ = np.nonzero(a_)
    X, Y = ox + xs_, oy + ys_
    ok_ = (X >= 0) & (X < W) & (Y >= 0) & (Y < H)
    return X[ok_], Y[ok_], ys_[ok_] / sprite.height


def spill_full(sprite, x, foot, allowed):
    """Whole-sprite spill (LM-03): opaque pixels over the interior (> 3.5 px from the border) of a plot whose zone is not
    allowed. Returns (total, in the top quarter of the sprite = roof/tower tolerance band, {plot code: px})."""
    X, Y, fr = sprite_cover(sprite, x, foot)
    inner = INNER[Y, X]
    zz = PZ[HEX[Y, X]]
    bad = inner & ~np.isin(zz, [ZID[z] for z in allowed])
    per = {}
    for hid in HEX[Y[bad], X[bad]]:
        per[plots[hid]['code']] = per.get(plots[hid]['code'], 0) + 1
    return int(bad.sum()), int((bad & (fr < 0.25)).sum()), per


def place(name, codes, allowed, dxs=range(-8, 9), dys=range(0, 15), pref=(0, 9), foot_edge=2.0):
    """Best foot position over the candidate plots: least whole-sprite spill, then nearest to the preferred offset.
    The foot centre must lie on the plot itself, at least foot_edge px inside its border."""
    s_ = spr(name)
    best = None
    for code in codes:
        i = by_code[code]
        for ddx in dxs:
            for ddy in dys:
                x, y = CX[i] + ddx, CY[i] + ddy
                fx_, fy_ = int(round(x)), int(round(y)) - 1
                if not (0 <= fx_ < W and 0 <= fy_ < H) or HEX[fy_, fx_] != i or EDGE[fy_, fx_] < foot_edge:
                    continue
                n, n_top, per = spill_full(s_, x, y, allowed)
                score = (n - min(n_top, 12), n, abs(ddx - pref[0]) + abs(ddy - pref[1]) + 6 * codes.index(code))
                if best is None or score < best[0]:
                    best = (score, x, y, code, n, n_top, per)
    return best


# ---------------------------------------------------------------- landmarks first (fields and houses keep clear)
LMK = {}


def landmark(name, codes, allowed, claim_w, claim_h=10, z=0.0, anim=None, **kw):
    b = place(name, codes, allowed, **kw)
    _, x, y, code, n, n_top, per = b
    put(name, x, y, z=z, anim=anim)
    claim(x, y, claim_w, claim_h)
    LMK[name] = dict(plot=code, x=round(x, 1), foot=round(y, 1), spill=n, spill_top=n_top, per=per, allowed=list(allowed))
    return x, y


landmark('townhall-front', ['E10'], ('urban',), 34, 16, dxs=range(-3, 4), dys=range(6, 17))
if LMKS:
    # lm-landmarks: thác động waterfall-00..06 (00 = hình tĩnh trên tranh), cối xay windmill-sails-00..03 (đặt theo hợp của
    # 4 khung để khung nào cũng qua kiểm đè lô)
    landmark('waterfall-00', ['E01'], ('river', 'hill'), 30, 12, z=1, anim='waterfall', dxs=range(-14, -5), dys=range(6, 14), pref=(-10, 10))
    _u = np.zeros((spr('windmill-sails-00').height, spr('windmill-sails-00').width), bool)
    for _k in range(4):
        _u |= np.array(spr('windmill-sails-%02d' % _k))[..., 3] > 0
    _ua = np.zeros(_u.shape + (4,), np.uint8)
    _ua[_u] = (*INK, 255)
    SPR['windmill-union'] = Image.fromarray(_ua, 'RGBA')
    _b = place('windmill-union', ['I06', 'I05', 'H06', 'I04', 'I07', 'H04', 'H03'], ('plain',), dys=range(4, 13), pref=(0, 8))
    put('windmill-sails-00', _b[1], _b[2], anim='windmill')
    claim(_b[1], _b[2], 22, 10)
    LMK['windmill-sails-00'] = dict(plot=_b[3], x=round(_b[1], 1), foot=round(_b[2], 1), spill=_b[4], spill_top=_b[5], per=_b[6], allowed=['plain'])
else:
    landmark('waterfall-stone', ['E01'], ('river', 'hill'), 30, 12, z=1, anim='waterfall', dxs=range(-14, -5), dys=range(6, 14), pref=(-10, 10))
    landmark('windmill', ['I06', 'I05', 'H06', 'I04', 'I07', 'H04', 'H03'], ('plain',), 22, anim='windmill', dys=range(4, 13), pref=(0, 8))
landmark('lighthouse', ['F20'], ('coast', 'sea'), 12, 8, anim='lighthouse', dxs=range(-2, 15), dys=range(4, 15), pref=(11, 9))
landmark('harbour', ['H15', 'H14'], ('coast', 'sea'), 44, 12, dxs=range(-20, 8), dys=range(8, 18), pref=(-10, 11), foot_edge=0.5)
landmark('pagoda', ['C04', 'C03', 'C05', 'D03', 'C02'], ('hill',), 24, 10, dys=range(2, 14), pref=(0, 8))
# mining station: a rocky knoll as the rock face behind the timber frame (LM-11; production rerolls the mine itself)
if LMKS:                                                       # trạm mỏ lm-landmarks có vách đá riêng, không cần đồi đá sau
    landmark('mine-rock', ['D06'], ('hill',), 34, z=1, dxs=range(-8, 6), dys=range(4, 14), pref=(-2, 9))
else:
    mx, my = landmark('mine', ['D06'], ('hill',), 30, z=1, dxs=range(-8, 5), dys=range(4, 13), pref=(-4, 9))
    put('knoll-sm-rock-b' if TERR else 'knoll-rock', mx - 6, my - 10, z=-2)
landmark('sawmill', ['D15'], ('forest',), 26, dxs=range(-4, 8), dys=range(4, 13), pref=(3, 10))
busy |= dist_to(road, 3) < 2

# ---------------------------------------------------------------- tea terraces on part of the lower hills (LM-01)
TEA = ['E03', 'E04', 'F02', 'D04']
tea = np.isin(HEX, [by_code[c] for c in TEA]) & (Z == ZID['hill']) & (GROUND == 'H') & ~busy & ~road_near
tea &= (dist_to(Z != ZID['hill'], 4) >= 2)
tt = (YY + 2.5 * np.sin(XX / 7.0 + 1.3) + 3.0 * (fbm(W, H, 11, 61) - 0.5)) / 4.0
band = tt - np.floor(tt)
if TERR:                                                      # chè lm-terrain theo tọa độ bậc thang, bờ đất 2 bậc, mép sáng
    yw = np.floor(YY + 2.5 * np.sin(XX / 7.0 + 1.3) + 3.0 * (fbm(W, H, 11, 61) - 0.5)).astype(int)
    img[tea] = LT['tea'][yw[tea] % 16, XX[tea] % 16]
    img[tea & (band >= 0.62) & (band < 0.78)] = h2('#7a4e2c')
    img[tea & (band >= 0.78) & (band < 0.86)] = h2('#5c3a24')
    img[tea & (band < 0.08)] = h2('#8fd3bf')
else:
    ramp = [(0.0, '#8fd3bf'), (0.14, '#4fae93'), (0.46, '#2f7f73'), (0.58, '#7a4e2c'), (0.68, None)]
    for k, (lo, col) in enumerate(ramp):
        hi = ramp[k + 1][0] if k + 1 < len(ramp) else 1.0
        m = tea & (band >= lo) & (band < hi)
        if col:
            img[m] = h2(col)
    img[tea & (band >= 0.14) & (band < 0.46) & (HASH < 0.12)] = h2('#8fd3bf')
busy |= tea

# ---------------------------------------------------------------- farmsteads on the plains (yards first, LM-05)
FARMS = []
fr_ = np.random.default_rng(5150)
plain = Z == ZID['plain']
plain_in = plain & (dist_to(~plain, 6) >= 4)
for i, p in enumerate(plots):
    if p['zone'] != 'plain' or fr_.random() > 0.30:
        continue
    for _ in range(6):
        x, y = CX[i] + (fr_.random() - 0.5) * 18, CY[i] + (fr_.random() - 0.5) * 14
        x0, y0 = int(x - 10), int(y - 9)
        if x0 < 2 or y0 < 2 or x0 + 22 >= W or y0 + 14 >= H:
            continue
        box = (slice(y0, y0 + 14), slice(x0, x0 + 22))
        if plain_in[box].all() and not busy[box].any() and not road[box].any() and (to_river[box] > 3).all():
            FARMS.append((x, y))
            yard = np.zeros((H, W), bool)
            yard[box] = ((XX[box] - x) / 10.5) ** 2 + ((YY[box] - y - 2) / 6.0) ** 2 <= 1
            img[yard] = TEX['p'][YY[yard] % 16, XX[yard] % 16]
            busy[box] = True
            break

# ---------------------------------------------------------------- plain fields: shared organic patchworks (LM-05)
cult = plain & ~busy & ~road_near & (to_river >= 4) & (dist_to(~plain, 6) >= 3)
wet_all = (to_river < 34) | (to_sea < 26) | (rowf >= 7.4)
rr = np.random.default_rng(777)
# regions: big patchworks of 2-4 plots with one row direction each
rs = []
for y in range(-20, H + 40, 52):
    for x in range(-20, W + 40, 60):
        rs.append((x + rr.random() * 40, y + rr.random() * 30))
rs = np.array(rs)
REG = np.argmin((XX[..., None] + 0.5 - rs[None, None, :, 0]) ** 2 + (YY[..., None] + 0.5 - rs[None, None, :, 1]) ** 2, axis=2)
THETAS = [0, 0, 0, 90, 90, 12, -12, 22, -22]
reg_theta = np.radians(np.array([THETAS[int(rr.integers(len(THETAS)))] for _ in rs]))
reg_stretch = 1.4 + rr.random(len(rs)) * 0.9
reg_pasture = rr.random(len(rs)) < 0.34
# parcel seeds (poisson-ish, 11-15 px apart) over the cultivable plain
seeds = []
cand = np.argwhere(cult)
rr.shuffle(cand)
grid = {}
for y, x in cand:
    r_ = 14 + 6 * HASH[y, x]
    gk = (int(x // 15), int(y // 15))
    ok = True
    for gx in range(gk[0] - 1, gk[0] + 2):
        for gy in range(gk[1] - 1, gk[1] + 2):
            for (sx, sy) in grid.get((gx, gy), ()):
                if (sx - x) ** 2 + (sy - y) ** 2 < r_ * r_:
                    ok = False
                    break
            if not ok:
                break
        if not ok:
            break
    if ok:
        grid.setdefault(gk, []).append((x, y))
        seeds.append((x, y))
seeds = np.array(seeds, float)
ys_c, xs_c = np.nonzero(cult)
th = reg_theta[REG[ys_c, xs_c]]
st = reg_stretch[REG[ys_c, xs_c]]
PID = np.full((H, W), -1, int)
best = np.full(len(ys_c), 1e9)
arg = np.zeros(len(ys_c), int)
for k0 in range(0, len(seeds), 64):
    sd = seeds[k0:k0 + 64]
    ddx_ = xs_c[:, None] - sd[None, :, 0]
    ddy_ = ys_c[:, None] - sd[None, :, 1]
    u = ddx_ * np.cos(th)[:, None] + ddy_ * np.sin(th)[:, None]
    v = -ddx_ * np.sin(th)[:, None] + ddy_ * np.cos(th)[:, None]
    dd = (u / st[:, None]) ** 2 + v ** 2
    j = dd.argmin(1)
    dj = dd[np.arange(len(j)), j]
    better = dj < best
    best[better] = dj[better]
    arg[better] = k0 + j[better]
PID[ys_c, xs_c] = arg
# crop per parcel (from its seed's region): wet land mostly rice, dry land wheat / vegetables / meadow / orchard
KINDS_WET = ['rice'] * 5 + ['rice_young'] * 2 + ['rice_ripe'] * 2 + ['wheat'] + ['veg'] + ['meadow'] * 2
KINDS_DRY = ['wheat'] * 4 + ['veg'] * 2 + ['meadow'] * 3 + ['orchard'] * 2 + ['rice'] + ['fallow']
kind = []
for k, (x, y) in enumerate(seeds):
    wet = wet_all[int(y), int(x)]
    pool = KINDS_WET if wet else KINDS_DRY
    kk = pool[int(rr.integers(len(pool)))]
    if kk == 'rice_young' and not (to_river[int(y), int(x)] < 16 or to_sea[int(y), int(x)] < 12):
        kk = 'rice'
    if reg_pasture[REG[int(y), int(x)]] and rr.random() < 0.8:
        kk = 'meadow'
    kind.append(kk)
kind = np.array(kind)
PK = np.where(PID >= 0, kind[np.maximum(PID, 0)], '')
TH = reg_theta[REG]
u_all = XX * np.cos(TH) + YY * np.sin(TH) + 1.2 * (fbm(W, H, 9, 71) - 0.5)
v_all = -XX * np.sin(TH) + YY * np.cos(TH)
ph3 = np.floor(v_all).astype(int) % 3
ph2 = np.floor(v_all).astype(int) % 2


def paint(mask, col):
    img[mask] = h2(col)


if TERR:                                                      # ruộng lm-terrain: lấy mẫu theo hướng luống của từng thửa
    UI = np.floor(u_all).astype(int) % 16
    VI = np.floor(v_all).astype(int) % 16
    for kk_, tn_ in (('rice', 'rice'), ('rice_young', 'paddy'), ('rice_ripe', 'ripe'), ('wheat', 'wheat')):
        m = PK == kk_
        img[m] = LT[tn_][VI[m], UI[m]]
else:
    m = PK == 'rice'
    paint(m, '#6dbb5a')
    paint(m & (ph3 == 0), '#8fcf6a')
    paint(m & (ph3 == 2) & (HASH < 0.45), '#4e9a45')
    paint(m & (ph3 == 2) & (HASH < 0.035), '#58b9d6')
    m = PK == 'rice_young'                                       # flooded paddy, young rice in rows
    paint(m, '#58b9d6')
    paint(m & (HASH < 0.2), '#8fd0e8')
    paint(m & (ph2 == 1) & (HASH < 0.3), '#8fcf6a')
    paint(m & (ph2 == 0) & ((np.floor(u_all).astype(int) % 2) == 0), '#6dbb5a')
    m = PK == 'rice_ripe'
    paint(m, '#c4e89a')
    paint(m & (ph3 == 1), '#8fcf6a')
    paint(m & (ph3 == 0) & (HASH < 0.25), '#f4c24f')
    m = PK == 'wheat'
    paint(m & (ph2 == 0), '#f4c24f')
    paint(m & (ph2 == 1), '#d79c1c')
    paint(m & (ph2 == 0) & (HASH < 0.08), '#fff3c4')
m = PK == 'veg'
img[m] = TEX['t'][YY[m] % 16, XX[m] % 16]
paint(m & (ph3 == 0), '#4e9a45')
paint(m & (ph3 == 0) & (HASH < 0.3), '#6dbb5a')
m = PK == 'fallow'                                           # freshly ploughed: dark soil furrows (never sand-coloured)
img[m] = TEX['t'][YY[m] % 16, XX[m] % 16]
paint(m & (ph2 == 0), '#9b6238')
m = PK == 'meadow'
mm = m & (fbm(W, H, 8, 81) > 0.5)
img[mm] = TEX['m'][YY[mm] % 16, XX[mm] % 16]
# dikes / hedges between parcels: 1 px light grass, its south side one step darker (3/4 relief)
cultivated = (PID >= 0) & np.isin(PK, ['rice', 'rice_young', 'rice_ripe', 'wheat', 'veg', 'fallow'])
diff = np.zeros((H, W), bool)
diff[:, :-1] |= (PID[:, :-1] != PID[:, 1:])
diff[:-1] |= (PID[:-1] != PID[1:])
dike = diff & (cultivated | np.roll(cultivated, -1, 1) | np.roll(cultivated, -1, 0)) & (PID >= 0)
dike |= cultivated & nb4(PID < 0)
paint(dike, '#8fcf6a')
darken(img, np.roll(dike, 1, 0) & cultivated & ~dike)
busy |= cultivated
# orchard parcels: little fruit trees in rows along the parcel direction
ORCH = []
ORCH_GRID = (10, 8) if LIFE else (6, 5)
for k in np.nonzero(kind == 'orchard')[0]:
    ys_o, xs_o = np.nonzero(PID == k)
    if len(ys_o) < 30:
        continue
    t_ = reg_theta[REG[int(seeds[k][1]), int(seeds[k][0])]]
    for y, x in zip(ys_o, xs_o):
        uu = x * math.cos(t_) + y * math.sin(t_)
        vv = -x * math.sin(t_) + y * math.cos(t_)
        if int(uu) % ORCH_GRID[0] == 0 and int(vv) % ORCH_GRID[1] == 0 and EDGE[y, x] > 2 and not road_near[y, x] and (PID[y - 3:y + 1, x - 2:x + 3] == k).all():
            ORCH.append((x, y + 1))
for x, y in ORCH:
    if LIFE:                                                   # cây táo 8-9 điểm của lm-life, lưới thưa hơn
        put('farm-orchard-0%d' % ((x + y) % 2), x, y, shadow=True)
    else:
        put('orchard-bush', x, y, shadow=False)
busy |= PK == 'orchard'
fields_info = dict(parcels=int(len(seeds)), regions=len(set(REG[ys_c, xs_c].tolist())),
                   kinds={k: int((kind == k).sum()) for k in sorted(set(kind.tolist()))})

# ---------------------------------------------------------------- roads (dirt) and city streets (cobble)
ring_ = nb4(road) & ~road & ~sea & ~in_city & ~plaza
img[ring_ & ~river] = h2('#c8915f')
rm = road & ~in_city & ~plaza
img[rm] = TEX['p'][YY[rm] % 16, XX[rm] % 16]
cm = road & in_city & ~plaza
img[cm] = h2('#c4bcb0')
img[cm & (BAY < 0.25)] = h2('#9c948a')
busy |= road | ring_

# ---------------------------------------------------------------- water
decal_sea = np.array(pond_decal(T, sea.tolist(), 0, 0, 'ts-water-sand', 'b', 'w', max_band=4))
m = decal_sea[..., 3] > 0
img[m] = decal_sea[..., :3][m]
shallow = sea & (to_land <= 5 + (n2 - 0.5) * 4)
img[shallow] = TEX['h'][YY[shallow] % 16, XX[shallow] % 16]
rim = sea & ~shallow & (np.roll(shallow, 1, 0) | np.roll(shallow, -1, 1))
img[rim & (BAY < 0.7)] = h2('#8fd0e8')
PRE_FOAM = img.copy()                                        # sóng: khung 2 đổi chỗ bọt (hiệu ứng mặt đất)
FOAM_A = sea & (to_land == 1) & (BAY < 0.55)
FOAM_B = sea & (((to_land == 1) & (BAY >= 0.55)) | ((to_land == 2) & (BAY < 0.3)))
img[sea & (to_land == 1) & (BAY < 0.55)] = h2('#eef8fb')
riv_c = river & ~sea
img[riv_c] = TEX['w'][YY[riv_c] % 16, XX[riv_c] % 16]
dec = np.array(pond_decal(T, riv_c.tolist(), 0, 0, 'ts-water-grass', 'g', 'w', max_band=4))
m = (dec[..., 3] > 0) & ~in_city & ~sea & (city_d > 2) & (Z != ZID['coast'])
img[m] = dec[..., :3][m]
decs = np.array(pond_decal(T, riv_c.tolist(), 0, 0, 'ts-water-sand', 'b', 'w', max_band=4))   # sandy banks at the mouth
m = (decs[..., 3] > 0) & ~sea & (Z == ZID['coast'])
img[m] = decs[..., :3][m]
# city canal: cut-stone quay 2 px each side; the quay wall under the north bank shows as a dark band (3/4 view)
quay_zone = (city_d <= 2)
q1 = nb4(riv_c) & ~riv_c & quay_zone & ~sea
q2 = nb4(riv_c | q1) & ~riv_c & ~q1 & quay_zone & ~sea
img[q2] = h2('#c4bcb0')
img[q1] = h2('#9c948a')
wall = riv_c & np.roll(q1, 1, 0) & quay_zone
img[wall] = h2('#6e6660')
mid = riv_c & (dist_to(~riv_c, 6) >= 3)
img[mid & (BAY < 0.18)] = h2('#58b9d6')
busy |= river | (dist_to(river, 3) < 3)

# bridges where roads cross the river
bridges = []
cross = road & river
if cross.any():
    ys, xs = np.nonzero(cross)
    groups = []
    for x, y in sorted(zip(xs.tolist(), ys.tolist())):
        for g in groups:
            if abs(g[-1][0] - x) <= 6 and abs(g[-1][1] - y) <= 8:
                g.append((x, y))
                break
        else:
            groups.append([(x, y)])
    for g in groups:
        bridges.append((int(round(sum(p[0] for p in g) / len(g))), int(round(sum(p[1] for p in g) / len(g)))))
BRIDGES, DECOR = [], []
for bx, by in bridges:
    city = city_d[by, bx] <= 2
    if LMKS:
        # cầu lm-landmarks: bám tâm dòng nước trong 7 điểm, mặt cầu vuông góc với hướng chính của sông
        rr = int(road[by, max(0, bx - 8):bx + 9].sum())
        rc = int(road[max(0, by - 8):by + 9, bx].sum())
        yy_, xx_ = np.mgrid[max(0, by - 7):by + 8, max(0, bx - 7):bx + 8]
        wm_ = riv_c[yy_, xx_] & (np.hypot(yy_ - by, xx_ - bx) <= 7)
        wx, wy = xx_[wm_].astype(float), yy_[wm_].astype(float)
        if len(wx) >= 4:
            ev, evec = np.linalg.eigh(np.cov(np.vstack([wx - wx.mean(), wy - wy.mean()])))
            dx_r, dy_r = evec[:, -1]
            ori = 'ns' if abs(dx_r) > abs(dy_r) else 'ew'
            bx, by = int(round(wx.mean())), int(round(wy.mean()))
        else:
            ori = 'ew' if rr > rc else 'ns'
        name = ('bridge-stone-' if city else 'bridge-wood-') + ori
        sp = spr(name)
        foot = by + sp.height - int(round(sp.height * 0.45))
        put(name, bx, foot, shadow=False, z=5)
        claim(bx, foot + 12, sp.width + 8, sp.height + 14)
        BRIDGES.append(dict(name=name, x=bx, foot=foot))
        continue
    deck = h2('#c4bcb0') if city else h2('#b87d4b')
    dk = h2('#9c948a') if city else h2('#8a5a34')
    y0 = y1 = by                                              # span exactly the water (+1 px of bank each end)
    while y0 - 1 >= 0 and riv_c[y0 - 1, bx]:
        y0 -= 1
    while y1 + 1 < H and riv_c[y1 + 1, bx]:
        y1 += 1
    y0, y1 = y0 - (2 if city else 2), y1 + (2 if city else 2)
    for y in range(y0, y1):
        for x in range(bx - 3, bx + 4):
            if 0 <= y < H and 0 <= x < W:
                if city:                                      # the street carries on: cobble deck, light stone parapets
                    img[y, x] = h2('#c4bcb0') if abs(x - bx) == 3 else TEX['c'][y % 16, x % 16]
                else:
                    img[y, x] = deck if y % 2 else dk
        if 0 <= y < H:
            img[y, bx - 4] = INK
            img[y, bx + 4] = INK
    img[y1, bx - 4:bx + 5] = INK
    img[y1 + 1, bx - 3:bx + 4] = h2('#6e6660') if city else h2('#2f6f9a')   # shadow under the deck

if LMKS:
    # lau sậy, đá trên bờ sông, lá súng trên đoạn nước rộng (ngoài phố, biển, bãi; xa đường và công trình)
    rb = np.random.default_rng(777)
    bank = (dist_to(riv_c, 3) == 1) & ~riv_c & ~road & (city_d > 4) & ~sea & (Z != ZID['coast']) & (dist_to(road, 6) > 4)
    wet_edge = riv_c & nb4(~riv_c) & (city_d > 4) & ~sea & (dist_to(road, 6) > 5)
    wide = riv_c & (dist_to(~riv_c, 6) >= 3) & (city_d > 4) & ~sea & (dist_to(road, 6) > 5)
    for mask_, names, n_, gap in ((bank, ['reeds-a', 'reeds-b', 'reeds-c'], 34, 9), (wet_edge, ['river-stones-a', 'river-stones-b'], 10, 18),
                                  (wide, ['lily-a', 'lily-b'], 8, 14)):
        ys_, xs_ = np.nonzero(mask_)
        order = rb.permutation(len(xs_))
        got = []
        for o in order:
            x, y = int(xs_[o]), int(ys_[o])
            if any(abs(x - gx) + abs(y - gy) < gap for gx, gy in got) or any(
                    abs(x - dx_) < 20 and abs(y - dy_) < 16 for dx_, dy_ in [(LMK[k]['x'], LMK[k]['foot'] - 8) for k in LMK]):
                continue
            nm = names[int(rb.integers(len(names)))]
            put(nm, x, y + 1, shadow=False, z=-1 if nm.startswith('lily') else 0)
            got.append((x, y))
            DECOR.append((nm, x, y + 1))
            if len(got) >= n_:
                break
    log('cầu:', BRIDGES, '| trang trí sông:', {k: sum(1 for d_ in DECOR if d_[0].startswith(k)) for k in ('reeds', 'river-stones', 'lily')})

# ---------------------------------------------------------------- mountains: far ridge (LM-10) + 4-tier front ridge
ROUND = [f'trees-sheet-{k:02d}' for k in (2, 3, 4, 5)]
CHERRY = [f'cherry-{k:02d}' for k in (2, 3, 4, 5)]
PINE = [f'trees-sheet-{k:02d}' for k in (6, 7, 8, 9, 10, 11)]


def reoutline(a):
    op = a[..., 3] > 0
    out = np.zeros((a.shape[0] + 2, a.shape[1] + 2, 4), np.uint8)
    out[1:-1, 1:-1] = a
    big = np.zeros(out.shape[:2], bool)
    big[1:-1, 1:-1] = op
    out[nb4(big) & ~big] = (*INK, 255)
    return out


def recolor(im, pairs):
    a = np.array(im)
    src = a.copy()
    for s_, d_ in pairs:
        mm_ = (src[..., 0] == s_[0]) & (src[..., 1] == s_[1]) & (src[..., 2] == s_[2]) & (src[..., 3] > 0)
        a[mm_, :3] = d_
    return Image.fromarray(a, 'RGBA')


HP = [(h2('#2f5a3a'), h2('#3e7a3f'))]                        # mountain pines: never the forest's dark pine
if not TERR:                                                   # núi concept (lm-terrain có bộ núi riêng)
    ms = np.array(spr('mountain-snow'))
    hh_ = ms.shape[0]
    grn = (ms[..., 1].astype(int) > ms[..., 0].astype(int) + 8) & (ms[..., 3] > 0)
    ys_, xs_ = np.mgrid[0:hh_, 0:ms.shape[1]]
    ms[grn & (ys_ > hh_ - 16) & (xs_ < 52)] = 0
    ink = (ms[..., 0] == INK[0]) & (ms[..., 1] == INK[1]) & (ms[..., 2] == INK[2])
    col_ = (ms[..., 3] > 0) & ~ink
    ms[ink & ~nb4(col_)] = 0
    ms[ink & nb4(col_) & (ys_ > hh_ - 16) & (xs_ < 52)] = 0
    SPR['mountain'] = Image.fromarray(reoutline(ms), 'RGBA').crop(Image.fromarray(reoutline(ms), 'RGBA').getbbox())
    SNOW_FIX = [(h2('#ffd1dc'), h2('#eef8fb')), (h2('#f4a3b4'), h2('#bfe3f2')), (h2('#d9708a'), h2('#9c948a'))]
    SPR['peak'] = recolor(spr('peak-rock'), SNOW_FIX)
    SPR['mountain'] = recolor(SPR['mountain'], HP)
for k_ in (6, 7, 8, 9, 10, 11):
    SPR[f'hpine-{k_:02d}'] = recolor(spr(f'trees-sheet-{k_:02d}'), HP)
HPINE = [f'hpine-{k_:02d}' for k_ in (6, 7, 8, 9, 10, 11)]
rr2 = np.random.default_rng(77)


def hill_ok(x, y, half):
    xs = np.arange(int(x - half), int(x + half) + 1)
    if xs.min() < 0 or xs.max() >= W or y >= H:
        return False
    return bool((Z[int(y) - 1, xs] == ZID['hill']).all())


# far ridge: pale peaks behind the whole front ridge (drawn first); they fill the flat snow gaps over the hill rows only
fx0 = -12.0
k = 0
if TERR:                                                       # dãy núi xa của lm-terrain: một bản, chân ở (160, 44)
    put('far-ridge', 160, 44, shadow=False, z=-100000)
while fx0 < 372 and not TERR:
    name = 'far-peak' if k % 3 else 'far-mountain'
    fy = (40 + int(rr2.integers(-4, 7))) if name == 'far-peak' else (62 + int(rr2.integers(-4, 5)))
    sp_ = spr(name)
    n_, nt_, _ = spill_full(sp_, fx0, fy, ('hill', 'forest'))
    if n_ - min(nt_, 12) <= 6:
        put(name, fx0, fy, flip=bool(rr2.random() < 0.5), shadow=False, z=-100000)
    fx0 += 30 + rr2.random() * 16
    k += 1
RIDGE = []
if TERR:
    # lm-terrain: 4 tầng núi; mountain-a (mũ tuyết lớn) chỉ ở tầng gần nhất, nếu không tuyết phủ trắng lô hàng A và trượt
    # cổng (c). mountain-a/-c/-d ấm lên lúc vẽ (đá xám -> nâu đất), tệp PNG vẫn giữ màu xám.
    for _n in ('mountain-a', 'mountain-b', 'mountain-c', 'mountain-d', 'peak-a', 'peak-b'):
        if pal_path(_n):
            SPR[_n] = spr(_n)
    PB = 'peak-b' if 'peak-b' in SPR else 'peak-a'
    for _n in ('mountain-a', 'mountain-c', 'mountain-d'):
        if _n in SPR:
            SPR[_n] = recolor(SPR[_n], [(h2('#6e6660'), h2('#8a5a34')), (h2('#9c948a'), h2('#b87d4b'))])
    TIERS = ((44, 30, (PB, 'mountain-c', 'mountain-b')), (60, 36, ('mountain-d', 'mountain-b', 'mountain-c', PB)),
             (78, 40, ('mountain-c', 'mountain-d', PB, 'mountain-b')), (100, 44, ('mountain-a', 'peak-a', 'mountain-d', PB)))
else:
    TIERS = ((44, 31, ('peak',)), (58, 37, ('peak', 'peak', 'mountain')), (76, 41, ('peak', 'mountain')), (100, 46, ('mountain', 'peak')))
for fy, stp, names in TIERS:
    x = 6 + rr2.random() * 10
    k = 0
    while x < W:
        name = names[k % len(names)]
        sp = SPR[name]
        fyj = fy + rr2.integers(-3, 4)
        if hill_ok(x, fyj, sp.width * 0.3) and spill_full(sp, x, fyj, ('hill',))[0] - spill_full(sp, x, fyj, ('hill',))[1] <= 6:
            RIDGE.append((name, x, fyj, bool(rr2.random() < 0.5)))
        x += (max(stp, sp.width * 0.6) if TERR else stp) + rr2.random() * 8
        k += 1
for name, x, y, fl in RIDGE:
    put(name, x, y, flip=fl, img_=SPR[name])
busy[:108, :] |= (Z == ZID['hill'])[:108, :]

# --- lower hills (rows D-G): one knoll or rocky peak per plot, at most one small pine group (LM-01)
KN = {'C01': 'knoll-rock', 'C02': 'knoll-earth', 'C04': None, 'C06': 'knoll-earth', 'D01': 'knoll-earth', 'D02': 'knoll-rock',
      'D03': 'knoll-earth', 'D05': 'knoll-earth', 'E03': None, 'E04': None, 'F01': 'knoll-rock', 'F02': None, 'G01': 'knoll-earth'}
if TERR:                                                       # đồi nhỏ cỡ bản đồ của lm-terrain, mỗi lô một cái
    KN = {'C01': 'knoll-sm-rock-a', 'C02': 'knoll-sm-earth-a', 'C04': None, 'C06': 'knoll-sm-earth-b', 'D01': 'knoll-sm-earth-a',
          'D02': 'knoll-sm-rock-b', 'D03': 'knoll-sm-earth-b', 'D05': 'knoll-sm-earth-a', 'E03': None, 'E04': None,
          'F01': 'knoll-sm-rock-a', 'F02': None, 'G01': 'knoll-sm-earth-b'}
PINES = {'C01': 1, 'C02': 0, 'C06': 2, 'D01': 1, 'D02': 2, 'D03': 0, 'D05': 2, 'F01': 1, 'G01': 2, 'E04': 1, 'C04': 1}
hill_stats = {}
for code, kn in KN.items():
    i = by_code[code]
    r = np.random.default_rng(i * 977)
    if kn:
        b = None
        for ddx in range(-8, 9, 2):
            for ddy in range(2, 13, 2):
                x, y = CX[i] + ddx, CY[i] + ddy
                n, ntop, _ = spill_full(spr(kn), x, y, ('hill',))
                py_, px_ = (3 + (i * 37) % 10, (i * 53) % 13 - 6) if TERR else (7, 0)   # lm-terrain: lệch theo lô, không xếp thành tường
                if b is None or (n, abs(ddx - px_) + abs(ddy - py_)) < b[0]:
                    b = ((n, abs(ddx - px_) + abs(ddy - py_)), x, y)
        _, x, y = b
        if b[0][0] <= 8 and not busy[int(y) - 2:int(y) + 1, int(x) - 4:int(x) + 5].any():
            put(kn, x, y, flip=bool(r.random() < 0.5))
            claim(x, y, 30, 12)
for code, n_p in PINES.items():
    i = by_code[code]
    r = np.random.default_rng(i * 31)
    placed = 0
    for _ in range(30):
        if placed >= n_p:
            break
        x = CX[i] + (r.random() - 0.5) * 20 if placed == 0 else gx + (r.random() - 0.5) * 9
        y = CY[i] + (r.random() - 0.5) * 16 if placed == 0 else gy + (r.random() - 0.5) * 4
        if free(x, y, 6, 'hill'):
            if placed == 0:
                gx, gy = x, y
            hp_ = HPINE[int(r.integers(len(HPINE)))]
            put(hp_, x, y, img_=SPR[hp_])
            claim(x, y, 7, 4)
            placed += 1

# --- forest: dense but irregular; pines to the north, broadleaf toward the plains, a few clearings
fr = np.random.default_rng(424242)
spots = []
for y in range(2, int(CY[by_code['D16']] + 16), 6):
    for x in range(int(CX[by_code['A15']] - 24), W + 8, 8):
        spots.append((x + (fr.random() - 0.5) * 6 + ((y // 6) % 2) * 4, y + (fr.random() - 0.5) * 3))
clear = [(CX[by_code[c]] + a_, CY[by_code[c]] + b_) for c, a_, b_ in (('B17', 4, 2), ('C19', -2, 4), ('A20', 0, 0))]
for jx, jy in spots:
    if not (0 <= jx < W and 1 <= jy < H) or Z[int(jy), int(jx)] != ZID['forest'] or busy[int(jy), int(jx)]:
        continue
    if any(math.hypot(jx - a_, (jy - b_) * 1.3) < 8 for a_, b_ in clear) or fr.random() < 0.08:
        continue
    pine_p = 0.85 if jy < CY[by_code['B16']] else (0.6 if jy < CY[by_code['C16']] else 0.3)
    pick_ = PINE if fr.random() < pine_p else ROUND
    put(pick_[int(fr.integers(len(pick_)))], jx, jy, flip=fr.random() < 0.5)

# --- city: front-facade houses in rows, pink accents, cherry trees (LM-06)
# Gói lm-life (đã duyệt): nhà mặt tiền thẳng to hơn nhà vẽ tạm, theo đúng luật của gói (scripts/patch-compose.py):
# phố = nhà nhỏ + nhà vườn, nhà phố hai tầng chỉ trong vòng 40 điểm quanh E10; trang trại = nhà vườn + kho mặt tiền.
def life_list(prefix):
    return sorted(f[:-4] for f in os.listdir(os.path.join(ROOT, 'phase3', 'lm-life', 'pal')) if f.startswith(prefix) and f.endswith('.png'))


if LIFE:
    SMALL, COT, TOWN, BARN = life_list('house-small-'), life_list('house-cottage-'), life_list('house-town-'), life_list('barn-front-')
    FFH = SMALL + COT
    TREE2 = [f'tree2-{k:02d}' for k in (0, 1, 3, 4, 5, 6, 7)]
    ROUND = ROUND + TREE2[:4]
    SPOTS = ((-9, -5), (9, -5), (0, 5), (-10, 14), (10, 14), (0, -14), (-13, 4), (13, 4))
else:
    FFH = sorted(f[:-4] for f in os.listdir(os.path.join(C, 'pal')) if f.startswith('ffh-'))
    SPOTS = ((-8, -6), (8, -6), (0, 3), (-9, 12), (9, 12), (0, -14), (-12, 3), (12, 3))
urban_ids = [i for i, p in enumerate(plots) if p['zone'] == 'urban']
n_houses = 0
for i in urban_ids:
    if i == keep:
        continue
    r = np.random.default_rng(i * 313)
    near_sq = math.hypot(CX[i] - kx, CY[i] - ky) < 40
    for ddx, ddy in SPOTS:
        x, y = CX[i] + ddx + (r.random() - 0.5) * 2, CY[i] + ddy
        if LIFE:
            if free(x, y, 18, 'urban') and math.hypot(x - kx, y - ky) > 22 and not river[int(y) - 3:int(y) + 2, int(x) - 9:int(x) + 10].any():
                nm_ = TOWN[int(r.integers(len(TOWN)))] if (near_sq and r.random() < 0.5) else FFH[int(r.integers(len(FFH)))]
                put(nm_, x, y)
                claim(x, y, spr(nm_).width - 2, 12)
                n_houses += 1
            elif free(x, y, 15, 'urban') and math.hypot(x - kx, y - ky) > 22 and not river[int(y) - 3:int(y) + 2, int(x) - 8:int(x) + 9].any():
                nm_ = SMALL[int(r.integers(len(SMALL)))]
                put(nm_, x, y)
                claim(x, y, spr(nm_).width - 3, 11)
                n_houses += 1
            elif free(x, y, 6, 'urban') and r.random() < 0.4:
                put(CHERRY[int(r.integers(4))] if r.random() < 0.45 else ROUND[int(r.integers(4))], x, y)
                claim(x, y, 7, 5)
        elif free(x, y, 14, 'urban') and math.hypot(x - kx, y - ky) > 20 and not river[int(y) - 3:int(y) + 2, int(x) - 8:int(x) + 9].any():
            put(FFH[int(r.integers(len(FFH)))], x, y)
            claim(x, y, 16, 11)
            n_houses += 1
        elif free(x, y, 6, 'urban') and r.random() < 0.4:
            put(CHERRY[int(r.integers(4))] if r.random() < 0.45 else ROUND[int(r.integers(4))], x, y)
            claim(x, y, 7, 5)

# --- farmsteads: house + barn + haystacks + a tree; haystacks on some wheat parcels; trees along the plain
for k, (x, y) in enumerate(FARMS):
    r = np.random.default_rng(int(x * 7 + y))
    if LIFE:
        put(COT[int(r.integers(len(COT)))], x - 7, y + 1)
        if r.random() < 0.35:
            put(BARN[int(r.integers(len(BARN)))], x + 11, y + 3)
        else:
            put('farm-haystack', x + 8, y + 3)
            put('farm-bale-round', x + 15, y + 5)
        if r.random() < 0.35:
            put('farm-silo', x + 2, y - 3)
        put(CHERRY[int(r.integers(4))] if r.random() < 0.4 else ROUND[int(r.integers(len(ROUND)))], x - 20 + r.random() * 2, y + 4)
        continue
    put(FFH[int(r.integers(len(FFH)))], x - 4, y + 1)
    if r.random() < 0.6:
        put('barn', x + 6, y + 4)
    else:
        put('haystack', x + 5, y + 3)
        put('haystack', x + 8, y + 5)
    put(CHERRY[int(r.integers(4))] if r.random() < 0.4 else ROUND[int(r.integers(4))], x - 12 + r.random() * 2, y + 4)
for k in np.nonzero(kind == 'wheat')[0]:
    if HASH[int(seeds[k][1]), int(seeds[k][0])] < 0.35:
        x, y = seeds[k]
        if PID[int(y), int(x)] == k and PID[int(y) - 4, int(x)] == k and INSIDE[int(y), int(x)]:
            if LIFE:
                put('farm-haystack' if HASH[int(y), int(x)] < 0.12 else 'farm-bale-round', x, y + 2, shadow=True)
            else:
                put('haystack', x, y + 2, shadow=True)
for i, p in enumerate(plots):
    if p['zone'] not in ('plain', 'river'):
        continue
    r = np.random.default_rng(i * 7)
    for _ in range(4 if p['zone'] == 'river' else 3):
        x, y = CX[i] + (r.random() - 0.5) * 24, CY[i] + (r.random() - 0.5) * 20
        if free(x, y, 7, p['zone']) and r.random() < (0.8 if p['zone'] == 'river' else 0.55):
            if LIFE:
                put(CHERRY[int(r.integers(4))] if r.random() < 0.3 else ROUND[int(r.integers(len(ROUND)))], x, y)
                claim(x, y, 10, 6)
            else:
                put(CHERRY[int(r.integers(4))] if r.random() < 0.3 else ROUND[int(r.integers(4))], x, y)
                claim(x, y, 8, 5)
    if p['zone'] == 'river' and r.random() < 0.4:
        x, y = CX[i] + (r.random() - 0.5) * 12, CY[i] + (r.random() - 0.5) * 10
        if LIFE:
            if free(x, y, 20, 'river'):
                put(COT[int(r.integers(len(COT)))], x, y)
                claim(x, y, 22, 12)
        elif free(x, y, 16, 'river'):
            put(FFH[int(r.integers(len(FFH)))], x, y)
            claim(x, y, 16, 10)

# --- coast: palms on the sand (LM-04)
PALMS = ['sea-props-sheet-00', 'sea-props-sheet-01', 'sea-props-sheet-02']
RAFTS = ['sea-props-sheet-04', 'sea-props-sheet-05']
BOATS = ['sea-props-sheet-08', 'sea-props-sheet-09']
for i, p in enumerate(plots):
    if p['zone'] != 'coast':
        continue
    r = np.random.default_rng(i * 17)
    placed = 0
    want = 0 if p['code'] == 'H15' else (1 if p['code'] in ('F20', 'H14', 'G17') else 2)
    for _ in range(30):
        if placed >= want:
            break
        side = 1 if (placed + int(r.integers(2))) % 2 else -1
        x, y = CX[i] + side * (10 + r.random() * 4), CY[i] + 2 + r.random() * 10
        if free(x, y, 6, 'coast', ground='b'):
            put(PALMS[int(r.integers(3))], x, y, flip=r.random() < 0.5)
            claim(x, y, 9, 6)
            placed += 1

# --- sea: rafts, fishing boats and ships centred on sea plots; islets in the sea margin only
seas = [i for i, p in enumerate(plots) if p['zone'] == 'sea']
if LMKS:                                                       # làng chài nổi lm-landmarks (lô biển, ghim góc từ 2×)
    _fv = place('fishing-village', ['I17', 'J16', 'I16', 'J17', 'I18', 'J18'], ('sea',), dxs=range(-6, 7), dys=range(4, 16), pref=(0, 10))
    put('fishing-village', _fv[1], _fv[2], shadow=False)
    LMK['fishing-village'] = dict(plot=_fv[3], x=round(_fv[1], 1), foot=round(_fv[2], 1), spill=_fv[4], spill_top=_fv[5], per=_fv[6], allowed=['sea'])
for k, i in enumerate(seas):
    r = np.random.default_rng(i * 17)
    if LMKS and math.hypot(CX[i] - _fv[1], CY[i] + 8 - _fv[2]) < 34:
        continue
    if k % 4 == 0:
        put(RAFTS[k % 2], CX[i] + (r.random() - 0.5) * 6, CY[i] + 9, flip=r.random() < 0.5, shadow=False, anim='bob')
    elif k % 6 == 2:
        put(BOATS[k % 2], CX[i] + (r.random() - 0.5) * 8, CY[i] + 7, flip=r.random() < 0.5, shadow=False, anim='bob')
    elif k % 7 == 3:
        put('ship', CX[i] + (r.random() - 0.5) * 6, CY[i] + 10, flip=r.random() < 0.5, shadow=False, anim='bob')
if LIFE:
    for x, y, nm_ in ((W - 15, H - 1, 'islet-04'), (W - 14, CY[by_code['G20']] + 14, 'islet-00'), (W - 12, CY[by_code['I20']] + 6, 'islet-05')):
        put(nm_, x, y, shadow=False)
    BEACH = ['beach-umbrella-pink', 'beach-umbrella-red-00', 'beach-umbrella-red-01', 'beach-rowboat', 'beach-rock-00',
             'beach-driftwood', 'beach-net', 'beach-rock-01']
    for i, p in enumerate(plots):
        if p['zone'] != 'coast' or p['code'] in ('H15', 'F20'):
            continue
        r = np.random.default_rng(i * 59)
        placed = 0
        for _ in range(40):
            if placed >= 2:
                break
            x, y = CX[i] + (r.random() - 0.5) * 16, CY[i] + (r.random() - 0.3) * 14
            if free(x, y, 6, 'coast', ground='b'):
                put(BEACH[(i + placed * 3) % len(BEACH)], x, y, flip=r.random() < 0.5)
                claim(x, y, 8, 5)
                placed += 1
else:
    for x, y in ((W - 17, H - 2), (W - 15, CY[by_code['G20']] + 14)):
        put('sea-props-sheet-11', x, y, shadow=False)
put('ship', W - 40, H - 3, shadow=False, flip=True, anim='bob')

# ---------------------------------------------------------------- vẽ: bóng tối một bậc palette, rồi hình từ xa tới gần
CHIMNEY_HOUSES = ('house-cottage-00', 'house-cottage-02', 'house-cottage-04', 'house-cottage-05', 'house-cottage-06', 'house-cottage-07',
                  'house-cottage-08', 'house-cottage-09', 'house-cottage-pink-00', 'house-cottage-orange-00')
CHIM = [[round(x), round(foot), n_] for _k, x, _s, _sh, n_, foot, _m in items if n_ in CHIMNEY_HOUSES] if LIFE else []
items.sort(key=lambda t: t[0])
shadow = np.zeros((H, W), bool)
for key, x, s, sh, _n, foot, _meta in items:
    if not sh:
        continue
    ww = max(4, int(s.width * 0.55))
    for yy in range(-1, 2):
        span = int(ww / 2 * math.sqrt(max(0, 1 - (yy / 2.2) ** 2)))
        y = int(round(foot)) + yy - 1
        if 0 <= y < H:
            shadow[y, max(0, int(x) + 2 - span):min(W, int(x) + 2 + span + 1)] = True
GROUND_ONLY = img.copy()                                       # nền thuần (chưa bóng, chưa hình): cho cổng kiểm cảm nhận
darken(img, shadow & ~sea)
GROUND_SH = img.copy()


def origin(x, foot, s):
    return int(round(x - s.width / 2)), int(round(foot - s.height + 1))


def render(over=None, ground=None):
    """Ghép hình lên nền. `over`: {số thứ tự hình: (ảnh, dx, dy)} để dựng một khung động."""
    canvas = Image.fromarray(GROUND_SH if ground is None else ground, 'RGB').convert('RGBA')
    for key, x, s, sh, name, foot, meta in items:
        dx = dy = 0
        if over and meta['n'] in over:
            s, dx, dy = over[meta['n']]
        ox, oy = origin(x, foot, s)
        canvas.alpha_composite(s, (ox + dx, oy + dy))
    return np.array(canvas.convert('RGB'))


BASE = render()
if DUMP:                                                       # --dump DIR: tranh và nền thuần (PNG) để soát tay
    os.makedirs(DUMP, exist_ok=True)
    Image.fromarray(BASE, 'RGB').save(os.path.join(DUMP, 'map.png'))
    Image.fromarray(GROUND_ONLY, 'RGB').save(os.path.join(DUMP, 'ground.png'))

# ---------------------------------------------------------------- cổng kiểm
ALLOW = {'townhall-front': {'urban'}, 'windmill': {'plain'}, 'windmill-sails-00': {'plain'}, 'mine-rock': {'hill'},
         'waterfall-00': {'river', 'hill', 'margin'}, 'fishing-village': {'sea', 'margin'},
         'knoll-sm-earth-a': {'hill'}, 'knoll-sm-earth-b': {'hill'}, 'knoll-sm-rock-a': {'hill'}, 'knoll-sm-rock-b': {'hill'},
         'mountain-a': {'hill'}, 'mountain-b': {'hill'}, 'mountain-c': {'hill'}, 'mountain-d': {'hill'}, 'peak-a': {'hill'}, 'peak-b': {'hill'},
         'far-ridge': {'hill', 'forest', 'margin'}, 'lighthouse': {'coast'}, 'harbour': {'coast'}, 'mine': {'hill'},
         'sawmill': {'forest'}, 'waterfall-stone': {'river', 'hill', 'margin'}, 'mountain': {'hill'}, 'peak': {'hill'},
         'knoll-earth': {'hill'}, 'knoll-rock': {'hill'}, 'pagoda': {'hill'}, 'far-mountain': {'hill', 'forest', 'margin'},
         'far-peak': {'hill', 'forest', 'margin'}, 'ship': {'sea', 'margin'}, 'sea-props-sheet-11': {'margin'}, 'barn': {'plain'},
         'haystack': {'plain'}, 'orchard-bush': {'plain'}, 'farm-haystack': {'plain'}, 'farm-bale-round': {'plain'},
         'farm-silo': {'plain'}, 'farm-orchard-00': {'plain'}, 'farm-orchard-01': {'plain'}, 'barn-front-00': {'plain'}, 'barn-front-01': {'plain'},
         'islet-00': {'margin'}, 'islet-04': {'margin'}, 'islet-05': {'margin'}}
NO_SPILL = ('ship', 'sea-props-sheet-11', 'haystack', 'orchard-bush', 'farm-haystack', 'farm-bale-round', 'farm-silo', 'farm-orchard-00',
            'farm-orchard-01', 'islet-00', 'islet-04', 'islet-05')
bad_items, counts = [], {}
for key, x, s_, sh, name, foot, _meta in items:
    fx_, fy_ = min(W - 1, max(0, int(round(x)))), min(H - 1, int(round(foot)) - 1)
    zone = 'margin' if not INSIDE[fy_, fx_] else ZN[int(PZ[HEX[fy_, fx_]])]
    if name in ALLOW:
        ok_ = zone in ALLOW[name]
    elif name.startswith(('ffh-', 'house-')):
        ok_ = zone in ('urban', 'plain', 'river')
    elif name.startswith('hpine'):
        ok_ = zone == 'hill'
    elif name.startswith('beach-'):
        ok_ = zone == 'coast'
    elif name.startswith(('trees-sheet', 'cherry', 'tree')):
        ok_ = zone in ('plain', 'river', 'urban', 'forest', 'hill', 'coast', 'margin')
    elif name in PALMS:
        ok_ = zone == 'coast'
    elif name.startswith('sea-props-sheet'):
        ok_ = zone in ('sea', 'margin')
    else:
        ok_ = True
    counts[zone] = counts.get(zone, 0) + 1
    if not ok_:
        bad_items.append((name, round(x), round(foot), zone))
log('hình theo vùng đặt chân', counts, '| chân sai vùng', len(bad_items), bad_items[:12])
FAILS = []
if bad_items:
    FAILS.append(f'{len(bad_items)} hình đặt chân sai vùng')
mism = int(((ZONE != PZ[HEX]) & INNER).sum())
log('(a) điểm ảnh nền sai vùng (sâu hơn 3,5 điểm trong ô):', mism)
if mism:
    FAILS.append(f'(a) {mism} điểm ảnh nền sai vùng')
log('(b) công trình biểu tượng, kiểm trên cả hình (điểm đè lô khác vùng; "top" = 1/4 trên của hình):')
for name, v in LMK.items():
    log(f'  {name:16s} {v["plot"]} ({v["x"]},{v["foot"]}): {v["spill"]} điểm ({v["spill_top"]} ở 1/4 trên) {v["per"]}')
    if v['spill'] > v['spill_top'] or v['spill_top'] > 12:
        FAILS.append(f'(b) {name} đè lô khác vùng {v["spill"]} điểm ({v["spill_top"]} ở 1/4 trên)')
for key, x, s_, sh, name, foot, _meta in items:
    if name in ALLOW and name not in LMK and name not in NO_SPILL:
        allowed = [z for z in ALLOW[name] if z != 'margin']
        n, ntop, per = spill_full(s_, x, foot, allowed)
        if n - min(ntop, 12) > 8:
            FAILS.append(f'(b) {name} tại ({round(x)},{round(foot)}) đè {n} điểm {per}')

# (c) cảm nhận từng lô: hình tròn 0,8 bán kính trong của ô, như perceptual.py của concept
CL = {'rock': '#c4bcb0 #9c948a #6e6660 #4a3326', 'earth': '#c8915f #9b6238 #7a4e2c #5c3a24 #b87d4b #8a5a34',
      'tea': '#8fd3bf #4fae93 #2f7f73', 'sand': '#ecd2a2 #dcb07c #fff3c4', 'water': '#2f6f9a #3f8fc0 #58b9d6 #8fd0e8',
      'pine': '#2f5a3a'}
CLS = {h2(c): k for k, v in CL.items() for c in v.split()}
inr = APO * 0.8
LMK_PLOTS = {v['plot'] for v in LMK.values()}


def shares(pic, i, coast=False):
    m = (XX - CX[i]) ** 2 + (YY - CY[i]) ** 2 <= inr * inr       # cùng cách lấy mẫu với perceptual.py của concept
    cnt = {}
    for c, n in zip(*np.unique(pic[m].reshape(-1, 3), axis=0, return_counts=True)):
        k = CLS.get(tuple(int(v) for v in c), 'other')
        if coast and tuple(int(v) for v in c) == h2('#c8915f'):
            k = 'sand'
        cnt[k] = cnt.get(k, 0) + int(n)
    tot = int(m.sum())
    return {k: v / tot for k, v in cnt.items()}


# Đồ bãi biển của lm-life (dù, thuyền con, lưới...) đứng trên cát: tính cát của lô Ven biển trên tranh không có chúng.
NOBEACH = render({t[6]['n']: (Image.new('RGBA', (1, 1)), 0, 0) for t in items if t[4].startswith('beach-')}) if any(t[4].startswith('beach-') for t in items) else BASE
SH = {i: shares(NOBEACH if p['zone'] == 'coast' else BASE, i, p['zone'] == 'coast') for i, p in enumerate(plots)}
fmin = min(SH[i].get('pine', 0) for i, p in enumerate(plots) if p['zone'] == 'forest')
hill_min = min(((p['code'], SH[i].get('rock', 0) + SH[i].get('earth', 0) + SH[i].get('tea', 0)) for i, p in enumerate(plots) if p['zone'] == 'hill'), key=lambda t: t[1])
hill_pine = max(((p['code'], SH[i].get('pine', 0)) for i, p in enumerate(plots) if p['zone'] == 'hill'), key=lambda t: t[1])
coast_min = min(((p['code'], SH[i].get('sand', 0)) for i, p in enumerate(plots) if p['zone'] == 'coast' and p['code'] not in LMK_PLOTS), key=lambda t: t[1])
urban_max = max(((p['code'], SH[i].get('water', 0)) for i, p in enumerate(plots) if p['zone'] == 'urban'), key=lambda t: t[1])
log(f'(c) Đồi núi đá+đất+chè thấp nhất {hill_min[1]:.1%} ({hill_min[0]}), thông sẫm cao nhất {hill_pine[1]:.1%} ({hill_pine[0]}) / rừng thấp nhất {fmin:.1%}; '
    f'Ven biển cát thấp nhất {coast_min[1]:.1%} ({coast_min[0]}); Trung tâm nước cao nhất {urban_max[1]:.1%} ({urban_max[0]})')
if hill_min[1] < 0.30 or hill_pine[1] >= fmin:
    FAILS.append('(c) Đồi núi')
if coast_min[1] < 0.50:
    FAILS.append(f'(c) Ven biển {coast_min}')
if urban_max[1] > 0.33:
    FAILS.append(f'(c) Trung tâm {urban_max}')
for code in sorted(LMK_PLOTS):
    i = by_code[code]
    if plots[i]['zone'] == 'coast':
        g = shares(GROUND_ONLY, i, True).get('sand', 0)
        log(f'    {code} mang công trình: cát {SH[i].get("sand", 0):.1%} trên tranh, {g:.1%} trên nền (dưới công trình)')
        if g < 0.5:
            FAILS.append(f'(c) {code}: nền cát {g:.1%}')

# ---------------------------------------------------------------- hiệu ứng mặt đất (khung dựng sẵn, vẽ lại đúng vùng)
WATER = {h2('#' + c) for c in 'eef8fb bfe3f2 8fd0e8 58b9d6 3f8fc0 2f6f9a fffaf3'.split()}


def water_cycle(sp, k):
    """Thác (bản concept tĩnh): dời vân nước xuống k điểm trong từng cột nước, vòng lại trong đoạn."""
    a = np.array(sp)
    out = a.copy()
    wet = np.zeros(a.shape[:2], bool)
    for c in WATER:
        wet |= (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2]) & (a[..., 3] > 0)
    for x in range(a.shape[1]):
        y = 0
        while y < a.shape[0]:
            if not wet[y, x]:
                y += 1
                continue
            y0 = y
            while y < a.shape[0] and wet[y, x]:
                y += 1
            n = y - y0
            if n >= 4:
                out[y0:y, x] = np.roll(a[y0:y, x], k, axis=0)
    return Image.fromarray(out, 'RGBA')


def windmill_turn(sp, deg, hub=(17, 12)):
    """Cối xay (bản concept tĩnh): tách cánh quạt (dải chéo quanh trục), xoay cánh rồi dán lại; chỗ hở trên mái lấp theo màu
    mái cùng hàng. Gói lm-landmarks có windmill-f0..f3 thì dùng khung đó thay cho cách này."""
    a = np.array(sp)
    hgt, wid = a.shape[:2]
    ys, xs = np.mgrid[0:hgt, 0:wid]
    dx, dy = xs - hub[0], ys - hub[1]
    body = {h2(c) for c in ('#d65f5f', '#a84848', '#fff3c4', '#c8915f')}
    isbody = np.zeros((hgt, wid), bool)
    for c in body:
        isbody |= (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2])
    blade = (a[..., 3] > 0) & (np.abs(np.abs(dx) - np.abs(dy)) <= 4.5) & (np.hypot(dx, dy) <= 18) & ~isbody & (ys <= hub[1] + 15)
    blade[hub[1] - 1:hub[1] + 2, hub[0] - 1:hub[0] + 2] = False
    rest = a.copy()
    rest[blade] = 0
    # lấp chỗ hở nằm giữa thân (có màu thân hai bên trong cùng hàng)
    for y, x in zip(*np.nonzero(blade)):
        left = [rest[y, xx] for xx in range(x - 1, max(-1, x - 7), -1) if rest[y, xx, 3] and tuple(rest[y, xx, :3]) in body]
        right = [rest[y, xx] for xx in range(x + 1, min(wid, x + 7)) if rest[y, xx, 3] and tuple(rest[y, xx, :3]) in body]
        if left and right:
            rest[y, x] = left[0]
    lay = np.zeros_like(a)
    lay[blade] = a[blade]
    t = math.radians(deg)
    rot = np.zeros_like(a)
    for y in range(hgt):
        for x in range(wid):
            ddx, ddy = x - hub[0], y - hub[1]
            sx = int(round(hub[0] + ddx * math.cos(t) + ddy * math.sin(t)))
            sy = int(round(hub[1] - ddx * math.sin(t) + ddy * math.cos(t)))
            if 0 <= sx < wid and 0 <= sy < hgt and lay[sy, sx, 3]:
                rot[y, x] = lay[sy, sx]
    out = rest.copy()
    m = rot[..., 3] > 0
    out[m] = rot[m]
    edge = nb4(m) & ~m & (out[..., 3] == 0)
    out[edge] = (*INK, 255)
    return Image.fromarray(out, 'RGBA')


def lamp_on(sp):
    """Hải đăng: đèn sáng lên một bậc (vàng -> kem) ở 45 % trên của hình."""
    a = np.array(sp)
    top = np.zeros(a.shape[:2], bool)
    top[: int(a.shape[0] * 0.45)] = True
    for s_, d_ in (('#d79c1c', '#f4c24f'), ('#f4c24f', '#fff3c4'), ('#fff3c4', '#fffaf3')):
        c = h2(s_)
        m = top & (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2]) & (a[..., 3] > 0)
        a[m, :3] = h2(d_)
    return Image.fromarray(a, 'RGBA')


GROUND_FX = []   # {id, rect (x, y, w, h), frames: [None | RGBA ndarray], ms, gap, phase}


def patch_fx(fid, overs, ms, phase=0, split=None, loop0=True):
    """Khung động dựng bằng cách ghép lại tranh với một vài hình thay thế; mỗi khung là phần tranh khác khung gốc.
    `split`: tách thành nhiều hiệu ứng nhỏ, mỗi hình một ô (thuyền nhấp nhô)."""
    frames = [render(o) for o in overs]
    groups = [(fid, None)] if split is None else [(f'{fid}-{k}', n) for k, n in enumerate(split)]
    for gid, n in groups:
        diff = np.zeros((H, W), bool)
        for f in frames:
            d = (f != BASE).any(2)
            if n is not None:
                key, x, s, sh, name, foot, meta = next(t for t in items if t[6]['n'] == n)
                ox, oy = origin(x, foot, s)
                box = np.zeros((H, W), bool)
                box[max(0, oy - 2):oy + s.height + 2, max(0, ox - 2):ox + s.width + 2] = True
                d &= box
            diff |= d
        if not diff.any():
            continue
        ys, xs = np.nonzero(diff)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        GROUND_FX.append({'id': gid, 'rect': (x0, y0, x1 - x0, y1 - y0), 'ms': ms, 'gap': 0, 'phase': phase if n is None else (phase + 330 * len(GROUND_FX)) % 1000,
                          'frames': ([None] if loop0 else []) + [np.dstack([f[y0:y1, x0:x1], np.full((y1 - y0, x1 - x0), 255, np.uint8)]) for f in frames]})


by_anim = {}
for t in items:
    if t[6]['anim']:
        by_anim.setdefault(t[6]['anim'], []).append(t)


def over(t, im):
    return {t[6]['n']: (im.transpose(Image.FLIP_LEFT_RIGHT) if t[6]['flip'] else im, 0, 0)}


for t in by_anim.get('waterfall', []):
    if LMKS:                                                   # lm-landmarks: vòng 01..06 (00 là hình tĩnh, giảm chuyển động)
        patch_fx('waterfall', [over(t, spr('waterfall-%02d' % k)) for k in range(1, 7)], 125, loop0=False)
    else:
        patch_fx('waterfall', [over(t, water_cycle(t[2], 2 * k)) for k in range(1, 4)], 130)
for t in by_anim.get('windmill', []):
    if LMKS:                                                   # lm-landmarks: 00..03, mỗi khung 22,5 độ, nối vòng liền
        patch_fx('windmill', [over(t, spr('windmill-sails-%02d' % k)) for k in range(1, 4)], 125)
    else:
        patch_fx('windmill', [over(t, windmill_turn(t[2], -45 * k)) for k in range(1, 4)], 220)
for t in by_anim.get('lighthouse', []):
    patch_fx('lighthouse', [over(t, lamp_on(t[2]))], 900)
bobs = by_anim.get('bob', [])
if bobs:
    patch_fx('boat', [{t[6]['n']: (t[2], 0, 1) for t in bobs}], 700, split=[t[6]['n'] for t in bobs])

# sóng: bọt ven bờ đổi chỗ (lớp phủ thưa: chỗ bọt cũ trả màu nước, chỗ bọt mới màu kem); chỉ nơi không có hình che
bare = (BASE == GROUND_SH).all(2)
fa, fb = FOAM_A & bare & ~shadow, FOAM_B & bare & ~shadow
if (fa | fb).any():
    ys, xs = np.nonzero(fa | fb)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    ov = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    sub_a, sub_b = fa[y0:y1, x0:x1], fb[y0:y1, x0:x1]
    ov[sub_a & ~sub_b] = np.dstack([PRE_FOAM[y0:y1, x0:x1], np.full((y1 - y0, x1 - x0), 255, np.uint8)])[sub_a & ~sub_b]
    ov[sub_b] = (*h2('#eef8fb'), 255)
    # đứng đầu danh sách: vùng sóng rộng được trả tranh gốc trước, các hiệu ứng nằm trong nó vẽ sau
    GROUND_FX.insert(0, {'id': 'waves', 'rect': (x0, y0, x1 - x0, y1 - y0), 'ms': 900, 'gap': 0, 'phase': 0, 'frames': [None, ov]})

# khói xưởng gỗ: khung ambient-1 đã duyệt, cắt còn 2 cụm dưới (cỡ bản đồ, LM-16)
AMB = os.path.join(ROOT, 'phase1', 'ambient-1', 'pal')
if 'sawmill' in LMK:
    saw = np.array(spr('sawmill'))
    op = saw[..., 3] > 0
    right = op[:, saw.shape[1] // 2:]
    cy_ = int(np.argmax(right.any(1)))
    cx_ = saw.shape[1] // 2 + int(np.nonzero(right[cy_])[0].mean())
    ox, oy = origin(LMK['sawmill']['x'], LMK['sawmill']['foot'], spr('sawmill'))
    smoke = []
    k = 0
    while os.path.isfile(os.path.join(AMB, 'fx-chimney-smoke', f'{k}.png')):
        smoke.append(np.array(Image.open(os.path.join(AMB, 'fx-chimney-smoke', f'{k}.png')).convert('RGBA'))[12:32])
        USED[f'fx-chimney-smoke-{k}'] = os.path.join(AMB, 'fx-chimney-smoke', f'{k}.png')
        k += 1
    sx, sy = ox + cx_ - 8, oy + cy_ - 20 + 2
    GROUND_FX.append({'id': 'smoke', 'rect': (sx, sy, 16, 20), 'ms': 140, 'gap': 0, 'phase': 0, 'frames': smoke})

# lấp lánh trên biển: khung ambient-1, phát từng đợt rồi nghỉ (gap), chỉ ở chỗ nước trống
spark = []
k = 0
while os.path.isfile(os.path.join(AMB, 'fx-pond-sparkle', f'{k}.png')):
    spark.append(np.array(Image.open(os.path.join(AMB, 'fx-pond-sparkle', f'{k}.png')).convert('RGBA')))
    USED[f'fx-pond-sparkle-{k}'] = os.path.join(AMB, 'fx-pond-sparkle', f'{k}.png')
    k += 1
if spark:
    al = np.zeros(spark[0].shape[:2], bool)
    for f in spark:
        al |= f[..., 3] > 0
    ys, xs = np.nonzero(al)
    sb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    spark = [f[sb[1]:sb[3], sb[0]:sb[2]] for f in spark]
    sw, sh_ = sb[2] - sb[0], sb[3] - sb[1]
    n_sp = 0
    gaps = [700, 1500, 1100, 1900, 900, 1300, 1700]
    for code in ('H17', 'I15', 'J18', 'H19', 'I19', 'J14', 'I17', 'J16'):
        if code not in by_code or n_sp >= 6:
            continue
        i = by_code[code]
        for ddx, ddy in ((-8, -2), (4, 4), (-2, 8), (6, -6)):
            x0, y0 = int(CX[i] + ddx - sw / 2), int(CY[i] + ddy - sh_ / 2)
            box = (slice(y0 - 1, y0 + sh_ + 1), slice(x0 - 1, x0 + sw + 1))
            if x0 < 1 or y0 < 1 or x0 + sw + 1 >= W or y0 + sh_ + 1 >= H:
                continue
            if sea[box].all() and bare[box].all() and not any(
                    f['rect'][0] < x0 + sw and x0 < f['rect'][0] + f['rect'][2] and f['rect'][1] < y0 + sh_ and y0 < f['rect'][1] + f['rect'][3]
                    for f in GROUND_FX if f['id'] != 'waves'):
                GROUND_FX.append({'id': f'sparkle-{n_sp}', 'rect': (x0, y0, sw, sh_), 'ms': 100, 'gap': gaps[n_sp % len(gaps)], 'phase': 370 * n_sp,
                                  'frames': spark})
                n_sp += 1
                break

# lm-life: làn khói 4x6 trên nhà vườn có ống khói (đáy làn khói đặt trên đỉnh ống khói = hàng cao nhất nửa phải của hình),
# cờ đuôi nheo 6x4 trên đỉnh tháp tòa thị chính. Một hiệu ứng, nhiều chỗ ('at'), mỗi chỗ lệch pha.
WISP = pkg_dir_frames('fx-house-smoke') if LIFE else []
if WISP and CHIM:
    at = []
    for hx, hf, nm in CHIM:
        hs = np.array(spr(nm))
        op_ = hs[..., 3] > 0
        right = op_[:, hs.shape[1] // 2:]
        cy_ = int(np.argmax(right.any(1)))
        cx_ = hs.shape[1] // 2 + int(np.nonzero(right[cy_])[0].mean())
        x0, y0 = int(round(hx - hs.shape[1] / 2)) + cx_ - 2, int(round(hf - hs.shape[0] + 1)) + cy_ - 6
        if 0 <= x0 and x0 + 4 <= W and 0 <= y0 and y0 + 6 <= H:
            at.append([x0, y0])
    if at:
        GROUND_FX.append({'id': 'wisp', 'rect': (at[0][0], at[0][1], 4, 6), 'ms': 150, 'gap': 0, 'phase': 0, 'frames': WISP, 'at': at[1:]})
PENNANT = pkg_dir_frames('fx-pennant') if LIFE else []
if PENNANT and 'townhall-front' in LMK:
    ts = np.array(spr('townhall-front'))
    op_ = ts[..., 3] > 0
    ty = int(np.argmax(op_.any(1)))
    tx = int(np.nonzero(op_[ty])[0].mean())
    th = LMK['townhall-front']
    px_ = int(round(th['x'] - ts.shape[1] / 2)) + tx + 1
    py_ = int(round(th['foot'] - ts.shape[0] + 1)) + ty - 5
    ph, pw = PENNANT[0].shape[:2]
    GROUND_FX.append({'id': 'pennant', 'rect': (px_, max(0, py_), pw, ph), 'ms': 160, 'gap': 0, 'phase': 0, 'frames': PENNANT})

# ---------------------------------------------------------------- lớp trời: mây (kèm bóng tối một bậc trên mặt đất), hải âu


def cloud_sprite(w, h, seed):
    """Mây tích vẽ từ palette (bản tạm của concept; gói lm-life có cloud-NN thì dùng hình đó)."""
    rng = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:h, 0:w]
    base = h * 0.86
    m = (ys <= base) & (ys >= base - h * 0.18) & (xs >= w * 0.1) & (xs <= w * 0.9)
    n = 6
    for k in range(n):
        bx = w * (0.12 + 0.76 * k / (n - 1)) + (rng.random() - 0.5) * 3
        hump = math.sin(math.pi * (k + 0.5) / n)
        br = h * (0.16 + 0.30 * hump) + rng.random() * 2.5
        by = base - br * 0.62 - h * 0.18 * hump
        m |= ((xs - bx) ** 2 + ((ys - by) * 1.15) ** 2 <= br * br) & (ys <= base)
    out = np.zeros((h, w, 4), np.uint8)
    out[m] = (*h2('#fffaf3'), 255)
    lit = np.zeros_like(m)
    lit[2:] = m[2:] & ~m[:-2]
    b2 = np.array([[0, 2], [3, 1]]) / 4.0
    out[lit & (b2[ys % 2, xs % 2] < 0.5)] = (*h2('#fbf1e3'), 255)
    out[m & (ys > base - 5)] = (*h2('#eef8fb'), 255)
    out[m & (ys > base - 2)] = (*h2('#bfe3f2'), 255)
    out[nb4(m) & ~m] = (*h2('#9c948a'), 255)
    bb = Image.fromarray(out, 'RGBA').getbbox()
    return out[bb[1]:bb[3], bb[0]:bb[2]]


CLOUDS = []
if LIFE and all(pal_path(n) for n in ('cloud-b', 'cloud-c', 'cloud-a')):
    # mây của lm-life, neo góc trên trái như fx3.py của gói (bóng lệch 9, 18)
    for n, y, v, x in (('cloud-b', 262, 3.2, 14), ('cloud-c', 2, 2.6, 606), ('cloud-a', 118, 2.2, 330)):
        USED[n] = pal_path(n)
        CLOUDS.append({'img': np.array(Image.open(pal_path(n)).convert('RGBA')), 'y': y, 'v': v, 'x': x, 'sh': [9, 18]})
else:
    for (y, v, x), a in zip(((268, 3.2, 18), (6, 2.6, 600), (128, 2.2, 330)), (cloud_sprite(80, 36, 3), cloud_sprite(68, 32, 8), cloud_sprite(56, 26, 5))):
        CLOUDS.append({'img': a, 'y': y, 'v': v, 'x': x, 'sh': [9, 22]})
GULLS = pkg_dir_frames('fx-gull')
if len(GULLS) < 2:
    up, flat = np.zeros((3, 5, 4), np.uint8), np.zeros((3, 5, 4), np.uint8)
    for (xx, yy) in ((0, 0), (1, 1), (2, 1), (3, 1), (4, 0)):
        up[yy, xx] = (*h2('#fffaf3'), 255)
    for (xx, yy) in ((1, 2), (2, 2), (3, 2)):
        up[yy, xx] = (*INK, 255)
    for (xx, yy) in ((0, 1), (1, 1), (2, 1), (3, 1), (4, 1)):
        flat[yy, xx] = (*h2('#fffaf3'), 255)
    for (xx, yy) in ((1, 2), (2, 2), (3, 2)):
        flat[yy, xx] = (*INK, 255)
    GULLS = [up, flat]
FLOCKS = [{'cx': 572, 'cy': 252, 'rx': 46, 'ry': 16, 't': 16, 'n': 3}, {'cx': 640, 'cy': 300, 'rx': 30, 'ry': 10, 't': 12, 'n': 2},
          {'cx': 455, 'cy': 222, 'rx': 26, 'ry': 9, 't': 14, 'n': 2}]

# ---------------------------------------------------------------- atlas (xếp kệ, đệm 1 điểm), kiểm palette
cells = []   # (khóa, ảnh RGBA)
for f in GROUND_FX:
    for k, fr in enumerate(f['frames']):
        if fr is not None:
            cells.append(((f['id'], k), fr))
for k, c in enumerate(CLOUDS):
    cells.append((('cloud', k), c['img']))
for k, g in enumerate(GULLS):
    cells.append((('gull', k), g))
# khung trùng nhau (lấp lánh dùng chung) chỉ xếp một lần
uniq, alias = [], {}
for key, a in cells:
    hit = next((u for u in uniq if u[1].shape == a.shape and np.array_equal(u[1], a)), None)
    if hit:
        alias[key] = hit[0]
    else:
        uniq.append((key, a))
        alias[key] = key
AW = max(256, max(a.shape[1] for _, a in uniq) + 2)
order = sorted(range(len(uniq)), key=lambda i: (-uniq[i][1].shape[0], i))
pos, x, y, row_h = {}, 1, 1, 0
for i in order:
    hgt, wid = uniq[i][1].shape[:2]
    if x + wid + 1 > AW:
        x, y, row_h = 1, y + row_h + 1, 0
    pos[uniq[i][0]] = (x, y)
    x += wid + 1
    row_h = max(row_h, hgt)
AH = y + row_h + 1
atlas = np.zeros((AH, AW, 4), np.uint8)
for key, a in uniq:
    x, y = pos[key]
    atlas[y:y + a.shape[0], x:x + a.shape[1]] = a


def audit_px(a):
    rgb = a[..., :3].reshape(-1, 3)
    alpha = a[..., 3].reshape(-1) if a.shape[2] == 4 else np.full(len(rgb), 255)
    cols = {tuple(int(v) for v in c) for c in np.unique(rgb[alpha > 0], axis=0)}
    return {'off_palette': len(cols - PALSET), 'semi_alpha': int(((alpha > 0) & (alpha < 255)).sum()), 'colours': len(cols)}


A_MAP, A_FX = audit_px(BASE), audit_px(atlas)
log('palette: tranh', A_MAP, '| atlas', A_FX)
for nm, a_ in (('map', A_MAP), ('fx', A_FX)):
    if a_['off_palette'] or a_['semi_alpha']:
        FAILS.append(f'{nm}: {a_["off_palette"]} màu ngoài palette, {a_["semi_alpha"]} điểm bán trong suốt')
for name, path in sorted(USED.items()):
    a_ = audit_px(np.array(Image.open(path).convert('RGBA')))
    if a_['off_palette'] or a_['semi_alpha']:
        FAILS.append(f'hình {name}: {a_}')
log('hiệu ứng mặt đất:', [(f['id'], f['rect'], len(f['frames'])) for f in GROUND_FX])
log('lớp trời: mây', len(CLOUDS), '| hải âu', sum(fl['n'] for fl in FLOCKS))
if FAILS:
    print('\n'.join(LOG))
    raise SystemExit('CỔNG KIỂM TRƯỢT, không ghi gì:\n  ' + '\n  '.join(FAILS))


# ---------------------------------------------------------------- ghi ra
def webp_bytes(im):
    buf = io.BytesIO()
    im.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return buf.getvalue()


map_bytes = webp_bytes(Image.fromarray(BASE, 'RGB'))
fx_bytes = webp_bytes(Image.fromarray(atlas, 'RGBA'))
# đọc lại: WebP lossless phải trả đúng từng điểm
assert np.array_equal(np.array(Image.open(io.BytesIO(map_bytes)).convert('RGB')), BASE)
assert np.array_equal(np.array(Image.open(io.BytesIO(fx_bytes)).convert('RGBA'))[atlas[..., 3] > 0], atlas[atlas[..., 3] > 0])
pack = lambda c: (c[0] << 16) | (c[1] << 8) | c[2]  # noqa: E731
landmarks = {}
for name, v in LMK.items():
    landmarks[v['plot']] = name
data = {
    'note': 'scripts/art/build-landmap.py; toạ độ theo điểm ảnh tranh 702x332 (1 điểm = 1,5 đơn vị SVG)',
    'size': [W, H], 'unit': UNIT, 'view': [round(W * UNIT), D['MAP_H']], 'plots_hash': D['plots_hash'],
    'map': 'map.webp', 'atlas': 'fx.webp', 'fps': 8,
    'landmarks': {code: landmarks[code] for code in sorted(landmarks)},
    'landmark_plots': sorted(plots[by_code[c]]['id'] for c in landmarks),
    'ground': [{'id': f['id'], 'r': list(f['rect']), 'ms': f['ms'], 'gap': f['gap'], 'phase': f['phase'],
                'f': [None if fr is None else list(pos[alias[(f['id'], k)]]) for k, fr in enumerate(f['frames'])], **({'at': f['at']} if f.get('at') else {})}
               for f in GROUND_FX],
    'clouds': [{'a': [*pos[alias[('cloud', k)]], int(c['img'].shape[1]), int(c['img'].shape[0])], 'y': int(c['y']), 'x': c['x'], 'v': c['v'], 'sh': c['sh']}
               for k, c in enumerate(CLOUDS)],
    'gulls': {'f': [[*pos[alias[('gull', k)]], int(g.shape[1]), int(g.shape[0])] for k, g in enumerate(GULLS)], 'ms': 120 if len(GULLS) > 2 else 200, 'flocks': FLOCKS},
    'dark': sorted([pack(a), pack(b)] for a, b in DARK.items() if a in PALSET and a != b),
}
json_bytes = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
sizes = {'map.webp': len(map_bytes), 'fx.webp': len(fx_bytes), 'landmap.json': len(json_bytes)}
log('dung lượng:', sizes, 'tổng', sum(sizes.values()))
over = [n for n, b, lim in (('map.webp', len(map_bytes), MAX_MAP), ('fx.webp', len(fx_bytes), MAX_FX), ('landmap.json', len(json_bytes), MAX_JSON)) if b > min(lim, MAX_FILE)]
if over or sum(sizes.values()) > MAX_TOTAL:
    raise SystemExit(f'vượt ngân sách dung lượng: {sizes} (tranh <= 80 KB, fx <= 24 KB, json <= 6 KB, tổng <= 110 KB)')
os.makedirs(OUT_DIR, exist_ok=True)
for name, b in (('map.webp', map_bytes), ('fx.webp', fx_bytes), ('landmap.json', json_bytes)):
    with open(os.path.join(OUT_DIR, name), 'wb') as f:
        f.write(b)


# ---------------------------------------------------------------- manifest (chỉ area "landmap")
def rel_art(p):
    return os.path.relpath(p, ROOT)


def load_pkg_manifest(d):
    try:
        m = json.load(open(os.path.join(d, 'manifest.json')))
    except (OSError, ValueError):
        return []
    return m.get('assets', []) if isinstance(m, dict) else m if isinstance(m, list) else []


used_paths = {rel_art(p) for p in USED.values()}
src_entries = {}
for d in [C] + PKGS[::-1]:          # gói sau ghi đè concept; lm-landmarks ưu tiên nhất nên ghi cuối
    for e in load_pkg_manifest(d):
        paths = e.get('path') or []
        paths = [paths] if isinstance(paths, str) else paths
        hit = sorted(p for p in paths if p in used_paths)
        if not hit or not isinstance(e.get('provenance'), dict):
            continue
        eid = e['id'] if str(e.get('id', '')).startswith('lm-') else 'lm-' + str(e.get('id', 'src'))
        if eid in ('lm-map', 'lm-fx'):
            eid += '-src'
        prov = dict(e['provenance'])
        prov['license'] = LICENSE
        prov.setdefault('postprocess', [])
        prov['params'] = dict(prov.get('params') or {}, art_root_files=hit)
        src_entries[eid] = {
            'id': eid, 'area': 'landmap', 'role': f'land map source: {e.get("role", eid)}',
            'path': f'public/ta-tua/game/assets/landmap/map.webp#{eid[3:]}', 'status': 'approved',
            'technical': dict(e.get('technical') or {}, filtering='nearest', scale='integer 1x / 2x / 3x (map picture)'),
            'visual_locks': e.get('visual_locks') or ['palette.json', 'view: low top-down', 'light: top-left', 'outline: #2e1d14 outer'],
            'provenance': prov,
            'verification': {'native_scale_reviewed': True, 'in_engine_reviewed': True, 'technical_checks_passed': True,
                             'approved_by': APPROVED_BY, 'notes': 'composited into map.webp by scripts/art/build-landmap.py'},
        }
from_pkg = sorted(p for p in used_paths if p.startswith('phase3/lm-'))
common = {'visual_locks': ['palette.json', 'view: low top-down', 'light: top-left', 'outline: #2e1d14 outer']}
entries = [
    {'id': 'lm-map', 'area': 'landmap', 'role': 'clan land map picture (16-bit, under the plot grid)', 'path': 'public/ta-tua/game/assets/landmap/map.webp',
     'status': 'approved',
     'technical': {'dimensions': f'{W}x{H}', 'alpha': False, 'anchor': 'top-left = SVG (0,0); 1 px = 1.5 SVG units', 'frames': 1, 'filtering': 'nearest',
                   'scale': 'integer 1x / 2x / 3x (desktop default 1x, phone default 2x)', 'bytes': len(map_bytes), 'plots_hash': D['plots_hash']},
     **common,
     'provenance': {'kind': 'composited', 'tool': 'scripts/art/build-landmap.py', 'mode': 'production' if from_pkg else 'concept assets',
                    'pixellab_id': '', 'prompt': '', 'params': {'sources': sorted(used_paths), 'packages': sorted({p.split('/')[1] for p in from_pkg})},
                    'created_at': '2026-10-31', 'generation_cost': 0,
                    'postprocess': ['zones from PLOTS via node (dump-plots.mjs)', 'Wang terrain + pond_decal shores', 'sprites placed by foot',
                                    'shadows one palette step darker', 'WebP lossless (exact)'], 'license': LICENSE},
     'verification': {'native_scale_reviewed': True, 'in_engine_reviewed': True, 'technical_checks_passed': True, 'approved_by': APPROVED_BY,
                      'notes': f'gates (a)(b)(c) passed; off-palette={A_MAP["off_palette"]} colours={A_MAP["colours"]}'}},
    {'id': 'lm-fx', 'area': 'landmap', 'role': 'clan land map effects atlas (water, windmill, lighthouse, boats, waves, smoke, sparkle, clouds, gulls)',
     'path': 'public/ta-tua/game/assets/landmap/fx.webp', 'status': 'approved',
     'technical': {'dimensions': f'{AW}x{AH}', 'alpha': True, 'anchor': 'see landmap.json', 'frames': len(cells), 'filtering': 'nearest',
                   'scale': 'same as lm-map', 'bytes': len(fx_bytes)},
     **common,
     'provenance': {'kind': 'composited', 'tool': 'scripts/art/build-landmap.py', 'mode': 'production' if from_pkg else 'concept assets',
                    'pixellab_id': '', 'prompt': '', 'params': {'effects': [f['id'] for f in GROUND_FX] + ['clouds', 'gulls']},
                    'created_at': '2026-10-31', 'generation_cost': 0,
                    'postprocess': ['frames re-composited from the map', 'shelf-packed, 1 px padding', 'WebP lossless (exact)'], 'license': LICENSE},
     'verification': {'native_scale_reviewed': True, 'in_engine_reviewed': True, 'technical_checks_passed': True, 'approved_by': APPROVED_BY,
                      'notes': f'off-palette={A_FX["off_palette"]} semi-alpha={A_FX["semi_alpha"]}'}},
] + [src_entries[k] for k in sorted(src_entries)]
ids = [e['id'] for e in entries]
assert len(ids) == len(set(ids)) and all(i.startswith('lm-') for i in ids), ids
doc = json.load(open(MANIFEST))
others = [a for a in doc['assets'] if a.get('area') != 'landmap']
clash = {a.get('id') for a in others} & set(ids)
if clash:
    raise SystemExit(f'id trùng với khu khác: {sorted(clash)}')
doc.setdefault('schema_notes', {})['area'] = 'town | park | scenes | landmap — each build script replaces only its own area'
doc['assets'] = others + entries
with open(MANIFEST, 'w') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
    f.write('\n')
log(f'manifest: {len(entries)} mục landmap -> docs/art/asset-manifest.json')
if AUDIT:
    open(AUDIT, 'w').write('\n'.join(LOG) + '\n')
if PREVIEW:
    big = Image.fromarray(BASE, 'RGB').resize((W * 2, H * 2), Image.NEAREST)
    sheet = Image.new('RGB', (W * 2, H * 2 + AH * 2 + 8), (0xfb, 0xf1, 0xe3))
    sheet.paste(big, (0, 0))
    at = Image.fromarray(atlas, 'RGBA').resize((AW * 2, AH * 2), Image.NEAREST)
    sheet.paste(at, (0, H * 2 + 8), at)
    sheet.save(PREVIEW)
    log('preview', PREVIEW)
