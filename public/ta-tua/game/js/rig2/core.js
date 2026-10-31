// Rig 2.0, lõi vẽ: bộ đệm RGBA, bảng màu khóa 48 màu, dải màu chất liệu, mặt nạ hình học, tô bóng, viền, lật, dán.
// Không đụng DOM: chạy được cả trong trình duyệt lẫn Node (kiểm thử ảnh mẫu, contact sheet).
// Chủ sở hữu: dev (lõi). Họa sĩ chỉ đọc file này; muốn thêm dải màu thì thêm vào RAMPS (giữ thứ tự 5 bậc).
//
// Hệ tọa độ: ô 48×48, gốc (0,0) ở góc trên-trái, x sang phải, y xuống dưới. Tâm điểm ảnh (x, y) là (x+0.5, y+0.5).
// Trục đối xứng ở x = 24 (giữa cột 23 và 24). Chân chạm hàng 44 (PIVOT), hàng 44 là viền dưới chân.
// Mọi số ở đây phải khớp từng điểm ảnh với bản Python mẫu (pets-pilot/scripts/rig2.py): đừng "dọn" thứ tự phép tính.

export const FW = 48;
export const FH = 48;
export const NPX = FW * FH;
/** Trục đối xứng của ô (giữa cột 23 và 24). */
export const CX = 24.0;
/** Hàng điểm ảnh dưới cùng của chân (trước khi viền). */
export const G = 44;
/** Điểm neo của ô: chân, giữa đáy. Vẽ ô tại (cx − 24, mặtĐất − 45) để hàng 44 nằm trên mặtĐất − 1. */
export const PIVOT = { x: 24, y: 44 };
/** Viền ngoài thống nhất của cả game. */
export const INK = '#2e1d14';

/** Bảng màu khóa Phase 0 (phase0/palette.json), 48 màu. Mọi điểm ảnh đục của pet phải nằm trong bảng này. */
export const PALETTE = [
  '#2e1d14', '#3d2a1f', '#4a3326', '#2f5a3a', '#3e7a3f', '#4e9a45', '#6dbb5a', '#8fcf6a', '#c4e89a', '#7a4e2c',
  '#9b6238', '#c8915f', '#dcb07c', '#ecd2a2', '#2f6f9a', '#3f8fc0', '#58b9d6', '#8fd0e8', '#bfe3f2', '#eef8fb',
  '#6e6660', '#9c948a', '#c4bcb0', '#5c3a24', '#6e2e24', '#8c3f2a', '#8a5a34', '#b87d4b', '#a84848', '#d65f5f',
  '#d9708a', '#f4a3b4', '#ffd1dc', '#dcc0a0', '#ecd8bf', '#fbf1e3', '#fffaf3', '#c88a62', '#f2c49b', '#2f7f73',
  '#4fae93', '#8fd3bf', '#d79c1c', '#f4c24f', '#fff3c4', '#f39b4a', '#b4643a', '#e84a5f',
];
const PAL_SET = new Set(PALETTE);
export const inPalette = (hex) => PAL_SET.has(String(hex).toLowerCase());

/**
 * Dải màu chất liệu, 5 bậc: [0 nét trong (line), 1 tối (shadow), 2 giữa (mid), 3 sáng (light), 4 bóng loáng (highlight)].
 * Nét trong là bậc tối nhất của chính dải đó (không dùng đen); bóng loáng chỉ có trên đầu.
 * Mười hai dải đầu lấy nguyên từ bản mẫu pets-pilot; các dải sau thêm cho 51 loài (ramps.js chọn dải cho từng loài).
 */
export const RAMPS = {
  // ---- từ bản mẫu (đừng đổi: ảnh mẫu kiểm thử dựa vào đây)
  fur_brown: ['#5c3a24', '#7a4e2c', '#9b6238', '#b87d4b', '#c8915f'],
  cream: ['#c8915f', '#dcb07c', '#ecd2a2', '#fbf1e3', '#fffaf3'],
  fur_silver: ['#6e6660', '#9c948a', '#c4bcb0', '#c4bcb0', '#eef8fb'],
  white: ['#9c948a', '#c4bcb0', '#fbf1e3', '#fffaf3', '#fffaf3'],
  fur_blue: ['#2e1d14', '#2f6f9a', '#3f8fc0', '#58b9d6', '#8fd0e8'],
  snow: ['#58b9d6', '#bfe3f2', '#eef8fb', '#fffaf3', '#fffaf3'],
  orange: ['#8c3f2a', '#b4643a', '#f39b4a', '#f4c24f', '#fff3c4'],
  pink: ['#a84848', '#d9708a', '#f4a3b4', '#ffd1dc', '#ffd1dc'],
  fur_green: ['#2f5a3a', '#4e9a45', '#8fcf6a', '#c4e89a', '#c4e89a'],
  mint: ['#4e9a45', '#c4e89a', '#fbf1e3', '#fffaf3', '#fffaf3'],
  gold: ['#8a5a34', '#d79c1c', '#f4c24f', '#fff3c4', '#fffaf3'],
  red: ['#6e2e24', '#a84848', '#e84a5f', '#f4a3b4', '#ffd1dc'],
  // ---- thêm ở bước port (Rig 2.0 cho 51 loài)
  // Xanh đen: bảng 48 màu không có màu navy thật (#3d4a6b); đây là dải tối nhất giữ được sắc xanh lam.
  navy: ['#2e1d14', '#3d2a1f', '#2f6f9a', '#3f8fc0', '#58b9d6'],
  charcoal: ['#2e1d14', '#2e1d14', '#3d2a1f', '#4a3326', '#6e6660'],
  stone: ['#4a3326', '#6e6660', '#9c948a', '#c4bcb0', '#eef8fb'],
  pearl: ['#9c948a', '#c4bcb0', '#eef8fb', '#fffaf3', '#fffaf3'],
  wood: ['#3d2a1f', '#5c3a24', '#7a4e2c', '#9b6238', '#b87d4b'],
  tan: ['#7a4e2c', '#b87d4b', '#c8915f', '#dcb07c', '#ecd2a2'],
  sand: ['#9b6238', '#c8915f', '#dcb07c', '#ecd2a2', '#fbf1e3'],
  wheat: ['#b87d4b', '#dcc0a0', '#ecd8bf', '#fbf1e3', '#fffaf3'],
  peach: ['#8c3f2a', '#c88a62', '#f2c49b', '#fbf1e3', '#fffaf3'],
  rust: ['#6e2e24', '#8c3f2a', '#b4643a', '#f39b4a', '#f4c24f'],
  brick: ['#3d2a1f', '#6e2e24', '#a84848', '#d65f5f', '#f4a3b4'],
  coral: ['#6e2e24', '#a84848', '#d65f5f', '#f4a3b4', '#ffd1dc'],
  rose: ['#a84848', '#d65f5f', '#d9708a', '#f4a3b4', '#ffd1dc'],
  blossom: ['#d9708a', '#f4a3b4', '#ffd1dc', '#fffaf3', '#fffaf3'],
  amber: ['#5c3a24', '#8a5a34', '#d79c1c', '#f4c24f', '#fff3c4'],
  butter: ['#d79c1c', '#f4c24f', '#fff3c4', '#fffaf3', '#fffaf3'],
  forest: ['#2e1d14', '#2f5a3a', '#3e7a3f', '#4e9a45', '#6dbb5a'],
  leaf: ['#2f5a3a', '#3e7a3f', '#4e9a45', '#6dbb5a', '#8fcf6a'],
  grass: ['#2f5a3a', '#4e9a45', '#6dbb5a', '#8fcf6a', '#c4e89a'],
  sprout: ['#4e9a45', '#8fcf6a', '#c4e89a', '#fbf1e3', '#fffaf3'],
  teal: ['#2f5a3a', '#2f7f73', '#4fae93', '#8fd3bf', '#eef8fb'],
  aqua: ['#2f7f73', '#4fae93', '#8fd3bf', '#eef8fb', '#fffaf3'],
  sky: ['#2f6f9a', '#58b9d6', '#8fd0e8', '#bfe3f2', '#eef8fb'],
  ice: ['#58b9d6', '#8fd0e8', '#bfe3f2', '#eef8fb', '#fffaf3'],
  slate: ['#3d2a1f', '#4a3326', '#6e6660', '#9c948a', '#c4bcb0'],
  latte: ['#9b6238', '#c8915f', '#dcc0a0', '#ecd8bf', '#fbf1e3'],
  maroon: ['#2e1d14', '#3d2a1f', '#6e2e24', '#8c3f2a', '#a84848'],
  flame: ['#6e2e24', '#b4643a', '#d65f5f', '#f39b4a', '#f4c24f'],
  salmon: ['#8c3f2a', '#d65f5f', '#f4a3b4', '#f2c49b', '#fbf1e3'],
};

// ---------------------------------------------------------------- màu

const rgbCache = new Map();
/** '#rrggbb' → [r, g, b]. */
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1, 7), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** OKLab [L, a, b] của một màu hex. */
export function oklab(hex) {
  const [r, g, b] = rgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const nearestCache = new Map();
/**
 * Màu gần nhất trong bảng 48 màu (OKLab, sắc độ a,b nặng gấp 2 độ sáng, như phase0/scripts/remap.py).
 * Dùng để ép hình cũ (đồ đeo chưa vẽ lại, màu hành) về bảng màu khóa.
 */
export function nearestPalette(hex) {
  const key = String(hex).toLowerCase();
  if (PAL_SET.has(key)) return key;
  let best = nearestCache.get(key);
  if (!best) {
    const [L, a, b] = oklab(key);
    let d0 = Infinity;
    for (const p of PALETTE) {
      const [L2, a2, b2] = oklab(p);
      const d = (L - L2) ** 2 + (2 * (a - a2)) ** 2 + (2 * (b - b2)) ** 2;
      if (d < d0) {
        d0 = d;
        best = p;
      }
    }
    nearestCache.set(key, best);
  }
  return best;
}

/** round() của Python: số .5 làm tròn về số chẵn (bản mẫu dùng Python, nên phải làm tròn y hệt). */
export function pyRound(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// ---------------------------------------------------------------- bộ đệm RGBA

/** Bộ đệm ảnh { w, h, data } (RGBA, Uint8ClampedArray). Mặc định là một ô 48×48 trong suốt. */
export function newBuf(w = FW, h = FH) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function cloneBuf(b) {
  return { w: b.w, h: b.h, data: new Uint8ClampedArray(b.data) };
}

/** Tô một điểm (bỏ qua nếu ra ngoài khung). */
export function setPx(b, x, y, hex) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const [r, g, bl] = rgb(hex);
  const i = (y * b.w + x) * 4;
  b.data[i] = r;
  b.data[i + 1] = g;
  b.data[i + 2] = bl;
  b.data[i + 3] = 255;
}

export const alphaAt = (b, x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : b.data[(y * b.w + x) * 4 + 3]);

/** Danh sách điểm [x, y, hex] tô thẳng lên bộ đệm. */
export function putPixels(b, pts) {
  for (const [x, y, c] of pts) setPx(b, x, y, c);
}

/** Thêm viền 1 px (4 hướng) quanh mọi điểm đục, trong cùng khung (không nới khung). */
export function outline(src, color = INK) {
  const { w, h } = src;
  const out = cloneBuf(src);
  const a = src.data;
  const [r, g, b] = rgb(color);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (a[i + 3]) continue;
      if ((y > 0 && a[i - w * 4 + 3]) || (y < h - 1 && a[i + w * 4 + 3]) || (x > 0 && a[i - 4 + 3]) || (x < w - 1 && a[i + 4 + 3])) {
        out.data[i] = r;
        out.data[i + 1] = g;
        out.data[i + 2] = b;
        out.data[i + 3] = 255;
      }
    }
  }
  return out;
}

/** Lật ngang (hướng tây = lật hướng đông). */
export function mirror(src) {
  const { w, h } = src;
  const out = newBuf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = (y * w + (w - 1 - x)) * 4;
      out.data[d] = src.data[s];
      out.data[d + 1] = src.data[s + 1];
      out.data[d + 2] = src.data[s + 2];
      out.data[d + 3] = src.data[s + 3];
    }
  }
  return out;
}

/** Dán `src` lên `dst` tại góc trên-trái (x, y); chỉ chép điểm đục. */
export function blit(dst, src, x, y) {
  for (let j = 0; j < src.h; j++) {
    const ty = y + j;
    if (ty < 0 || ty >= dst.h) continue;
    for (let i = 0; i < src.w; i++) {
      const tx = x + i;
      const s = (j * src.w + i) * 4;
      if (!src.data[s + 3] || tx < 0 || tx >= dst.w) continue;
      const d = (ty * dst.w + tx) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = src.data[s + 3];
    }
  }
}

/** Chồng `src` (cùng cỡ) lên `dst` ở mọi điểm đục. */
export const over = (dst, src) => blit(dst, src, 0, 0);

/** Hình từ bản đồ ký tự: mỗi ký tự là một màu trong `keys`, ký tự khác bỏ trống. */
export function stamp(rows, keys) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const b = newBuf(w, h);
  rows.forEach((r, j) => {
    [...r].forEach((ch, i) => {
      if (keys[ch]) setPx(b, i, j, keys[ch]);
    });
  });
  return b;
}

/** Nới khung 1 px mỗi bên rồi viền (cho hình dán như vương miện). */
export function padOutline(src, color = INK) {
  const big = newBuf(src.w + 2, src.h + 2);
  blit(big, src, 1, 1);
  return outline(big, color);
}

/** Khung bao các điểm đục: { x0, y0, x1, y1 } (x1, y1 tính cả), hoặc null nếu trống. */
export function bbox(b) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!b.data[(y * b.w + x) * 4 + 3]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Cắt một vùng của bộ đệm. */
export function crop(b, x, y, w, h) {
  const out = newBuf(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      const sy = y + j;
      if (sx < 0 || sy < 0 || sx >= b.w || sy >= b.h) continue;
      const s = (sy * b.w + sx) * 4;
      const d = (j * w + i) * 4;
      for (let k = 0; k < 4; k++) out.data[d + k] = b.data[s + k];
    }
  }
  return out;
}

// ---------------------------------------------------------------- mặt nạ (Uint8Array FW×FH, 1 = trong hình)

const PXC = new Float64Array(NPX);
const PYC = new Float64Array(NPX);
for (let y = 0; y < FH; y++) {
  for (let x = 0; x < FW; x++) {
    PXC[y * FW + x] = x + 0.5;
    PYC[y * FW + x] = y + 0.5;
  }
}
export const newMask = () => new Uint8Array(NPX);

/**
 * Elip (hoặc siêu elip với số mũ `n`) tâm (cx, cy), bán trục rx, ry, xoay `rot` radian.
 * Điểm ảnh thuộc hình nếu tâm của nó nằm trong: |dx/rx|^n + |dy/ry|^n ≤ 1.
 */
export function mEllipse(cx, cy, rx, ry, rot = 0, n = 2) {
  const m = new Uint8Array(NPX);
  const ax = Math.max(rx, 0.5);
  const ay = Math.max(ry, 0.5);
  const c = rot ? Math.cos(rot) : 1;
  const s = rot ? Math.sin(rot) : 0;
  // Chỉ xét các điểm trong khung bao (điểm ngoài khung chắc chắn không thuộc hình; kết quả giữ nguyên từng bit).
  const R = rot ? ax + ay + 1 : 0;
  const x0 = Math.max(0, Math.floor(cx - (rot ? R : ax + 1)));
  const x1 = Math.min(FW - 1, Math.ceil(cx + (rot ? R : ax + 1)));
  const y0 = Math.max(0, Math.floor(cy - (rot ? R : ay + 1)));
  const y1 = Math.min(FH - 1, Math.ceil(cy + (rot ? R : ay + 1)));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = y * FW + x;
      let dx = PXC[k] - cx;
      let dy = PYC[k] - cy;
      if (rot) {
        const t = dx * c + dy * s;
        dy = -dx * s + dy * c;
        dx = t;
      }
      const u = Math.abs(dx / ax);
      const v = Math.abs(dy / ay);
      if (u > 1 || v > 1) continue;
      const d = n === 2 ? u * u + v * v : u ** n + v ** n;
      if (d <= 1.0) m[k] = 1;
    }
  }
  return m;
}

/** Tam giác a, b, c (mỗi điểm [x, y]); theo chiều nào cũng được. */
export function mTri(a, b, c) {
  const m = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) {
    const X = PXC[k];
    const Y = PYC[k];
    const e0 = (b[0] - a[0]) * (Y - a[1]) - (b[1] - a[1]) * (X - a[0]);
    const e1 = (c[0] - b[0]) * (Y - b[1]) - (c[1] - b[1]) * (X - b[0]);
    const e2 = (a[0] - c[0]) * (Y - c[1]) - (a[1] - c[1]) * (X - c[0]);
    if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) m[k] = 1;
  }
  return m;
}

/** Chuỗi đĩa tròn bán kính r qua các điểm (đuôi mảnh). */
export function mChain(pts, r) {
  const m = new Uint8Array(NPX);
  for (const [x, y] of pts) mOrInto(m, mEllipse(x, y, r, r));
  return m;
}

export function mAnd(a, b) {
  const m = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) m[k] = a[k] & b[k];
  return m;
}
export function mOr(...ms) {
  const m = new Uint8Array(NPX);
  for (const x of ms) mOrInto(m, x);
  return m;
}
export function mOrInto(dst, src) {
  for (let k = 0; k < NPX; k++) dst[k] |= src[k];
  return dst;
}
export function mAndNot(a, b) {
  const m = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) m[k] = a[k] & (b[k] ^ 1);
  return m;
}
/** Các điểm có tâm thấp hơn y (PYc > y). */
export function mBelow(y) {
  const m = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) if (PYC[k] > y) m[k] = 1;
  return m;
}
/** Các điểm có tâm cao hơn y (PYc < y). */
export function mAbove(y) {
  const m = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) if (PYC[k] < y) m[k] = 1;
  return m;
}
/** Các điểm có tâm bên phải x (PXc > x). */
export function mRightOf(x) {
  const m = new Uint8Array(NPX);
  for (let k = 0; k < NPX; k++) if (PXC[k] > x) m[k] = 1;
  return m;
}
export const mAny = (m) => m.some((v) => v);

/**
 * Mặt nạ từ bản đồ ký tự: các ô mang ký tự `ch` (hoặc một trong các ký tự của `ch`), góc trên-trái (x0, y0),
 * `flip` để lật ngang (tai phải, cánh phải...). Dùng để biến hình vẽ tay thành bộ phận có che khuất và viền.
 */
export function mStamp(rows, ch, x0, y0, flip = false) {
  const m = new Uint8Array(NPX);
  rows.forEach((row, j) => {
    const w = row.length;
    [...row].forEach((c, i) => {
      if (!ch.includes(c) || c === '.') return;
      const x = x0 + (flip ? w - 1 - i : i);
      const y = y0 + j;
      if (x >= 0 && y >= 0 && x < FW && y < FH) m[y * FW + x] = 1;
    });
  });
  return m;
}

// ---------------------------------------------------------------- bước chân (dùng chung cho mọi dáng khung)

// Dáng đi 6 khung (pose.step = 0..5): độ lệch trước/sau của chân và chân nào đang nhấc.
const STRIDE = [2, 1, -1, -2, -1, 1];
const LIFT_NEAR = [0, 0, 0, 0, 1, 1];
const LIFT_FAR = [0, 1, 1, 0, 0, 0];

/** Bước chân của khung hình: { s (lệch trước/sau), lN (chân gần nhấc), lF (chân xa nhấc), walking }. Đứng yên thì 0. */
export function gait(pose) {
  const step = pose.step;
  if (step === undefined || step === null) return { s: 0, lN: 0, lF: 0, walking: false };
  return { s: STRIDE[step], lN: LIFT_NEAR[step], lF: LIFT_FAR[step], walking: true };
}

// ---------------------------------------------------------------- bộ phận và tô bóng

/** Hướng sáng: từ trên-trái, hơi hướng ra người xem (đã chuẩn hóa; số chép từ numpy để khớp từng bit). */
export const LIGHT = [-0.5003002702702839, -0.7204323891892087, 0.48028825945947246];

/**
 * Một bộ phận tô bóng: `mask` (newMask), `ramp` (tên dải trong RAMPS), `z` (lớn hơn = gần người xem hơn).
 * - `group`: các bộ phận cùng nhóm không kẻ nét trong / không đổ bóng lên nhau (mặc định = name).
 * - `normal`: [cx, cy, rx, ry] khối elip dùng để tính sáng tối (bắt buộc nếu không có `flat`).
 * - `shade`: lệch bậc màu (−1 = chân xa, tối hơn một bậc). `flat`: bậc màu cố định, không tính sáng.
 * - `line`: kẻ nét trong (bậc 0 của dải) ở chỗ bộ phận này đè lên bộ phận phía sau.
 * Bộ phận tên 'head' mới được bậc bóng loáng (4).
 */
export function part(name, mask, ramp, z, { group = null, normal = null, shade = 0, flat = null, line = true } = {}) {
  return { name, mask, ramp, z, group: group ?? name, normal, shade, flat, line };
}

/** Điểm tô thẳng [x, y, hex, z]: mắt, miệng, ngọc trán... (vẽ sau khi tô bóng, theo thứ tự z). */
export const px = (x, y, hex, z) => [x, y, hex, z];

const clip = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Tô màu các bộ phận: bộ phận z cao che z thấp; mỗi điểm lấy bậc màu theo pháp tuyến của khối elip
 * và ánh sáng trên-trái; dọn điểm lẻ; đổ bóng một bậc ngay dưới bộ phận phía trước; kẻ nét trong
 * (bậc 0) ở mép bộ phận phía trước. Cuối cùng tô các điểm `pixels` theo thứ tự z. Trả về bộ đệm 48×48 chưa viền.
 */
export function colourise(parts, pixels = []) {
  const n = parts.length;
  const order = [...Array(n).keys()].sort((a, b) => parts[a].z - parts[b].z);
  const pid = new Int32Array(NPX).fill(-1);
  for (const i of order) {
    const m = parts[i].mask;
    for (let k = 0; k < NPX; k++) if (m[k]) pid[k] = i;
  }
  const [L0, L1, L2] = LIGHT;
  const idx = new Int8Array(NPX);
  const flatOf = parts.map((p) => (p.flat === null || p.flat === undefined ? -1 : p.flat));
  const nrm = parts.map((p) => p.normal ?? [0, 0, 1, 1]);
  for (let k = 0; k < NPX; k++) {
    const i = pid[k];
    if (i < 0) continue;
    const p = parts[i];
    let band;
    if (flatOf[i] >= 0) {
      band = flatOf[i];
    } else {
      const N = nrm[i];
      const cx = N[0];
      const cy = N[1];
      const rx = N[2];
      const ry = N[3];
      const nx = clip((PXC[k] - cx) / rx, -1, 1);
      const ny = clip((PYC[k] - cy) / ry, -1, 1);
      const nz = Math.sqrt(clip(1 - nx * nx - ny * ny, 0, 1));
      const I = nx * L0 + ny * L1 + nz * L2;
      band = I < 0.16 ? 1 : I < 0.56 ? 2 : I < 0.92 ? 3 : 4;
      if (p.name !== 'head') band = Math.min(band, 3); // bóng loáng chỉ có trên đầu
    }
    idx[k] = clip(band + p.shade, 1, 4);
  }
  const grp = parts.map((p) => p.group);
  const sameRamp = (i, j) => grp[j] === grp[i] && parts[j].ramp === parts[i].ramp;
  // Dọn điểm lẻ: một điểm khác bậc với cả (≥ 3) hàng xóm cùng nhóm, cùng dải thì lấy bậc phổ biến nhất (hòa: bậc nhỏ hơn).
  const out = idx.slice();
  const cnt = new Int8Array(5);
  for (let y = 1; y < FH - 1; y++) {
    for (let x = 1; x < FW - 1; x++) {
      const k = y * FW + x;
      const i = pid[k];
      if (i < 0) continue;
      cnt.fill(0);
      let n = 0;
      let differs = true;
      for (let t = 0; t < 4; t++) {
        const q = t === 0 ? k - FW : t === 1 ? k + FW : t === 2 ? k - 1 : k + 1;
        const j = pid[q];
        if (j >= 0 && sameRamp(i, j)) {
          cnt[idx[q]]++;
          n++;
          if (idx[q] === idx[k]) differs = false;
        }
      }
      if (n >= 3 && differs) {
        let best = 0;
        for (let v = 1; v <= 4; v++) if (cnt[v] > cnt[best]) best = v;
        out[k] = best;
      }
    }
  }
  // Bóng đổ: điểm ngay dưới một bộ phận ở phía trước (nhóm khác, z cao hơn) tối đi một bậc.
  for (let k = FW; k < NPX; k++) {
    const i = pid[k];
    const j = pid[k - FW];
    if (i >= 0 && j >= 0 && grp[i] !== grp[j] && parts[j].z > parts[i].z && flatOf[i] < 0) {
      out[k] = Math.max(1, out[k] - 1);
    }
  }
  // Nét trong: điểm của bộ phận phía trước kề (4 hướng) một bộ phận phía sau khác nhóm.
  const ramps = parts.map((p) => {
    const r = RAMPS[p.ramp];
    if (!r) throw new Error(`rig2: không có dải màu "${p.ramp}" (bộ phận ${p.name})`);
    return r.map(rgb);
  });
  const img = newBuf();
  const D = img.data;
  const behind = (i, q) => {
    const j = pid[q];
    return j >= 0 && grp[j] !== grp[i] && parts[j].z < parts[i].z;
  };
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const k = y * FW + x;
      const i = pid[k];
      if (i < 0) continue;
      const line = parts[i].line && ((y > 0 && behind(i, k - FW)) || (y < FH - 1 && behind(i, k + FW)) || (x > 0 && behind(i, k - 1)) || (x < FW - 1 && behind(i, k + 1)));
      const c = ramps[i][line ? 0 : out[k]];
      D[k * 4] = c[0];
      D[k * 4 + 1] = c[1];
      D[k * 4 + 2] = c[2];
      D[k * 4 + 3] = 255;
    }
  }
  const sorted = pixels.map((p, i) => [p, i]).sort((a, b) => a[0][3] - b[0][3] || a[1] - b[1]);
  for (const [[x, y, c]] of sorted) {
    if (x >= 0 && x < FW && y >= 0 && y < FH) setPx(img, x, y, c);
  }
  return img;
}

/** Gộp mặt nạ của mọi bộ phận thuộc nhóm `group`. */
export function groupMask(parts, group) {
  const m = new Uint8Array(NPX);
  for (const p of parts) if (p.group === group) mOrInto(m, p.mask);
  return m;
}
