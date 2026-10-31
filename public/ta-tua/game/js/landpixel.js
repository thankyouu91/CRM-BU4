// Nền pixel art của bản đồ đất kiểu overworld nhìn 3/4: núi nhiều đỉnh chồng lớp (sáng mặt trái, tối mặt phải,
// đổ bóng về đông nam), đỉnh tuyết phía bắc, khối núi hồng có chùa trên đỉnh, miệng núi lửa lõm với lava phát
// sáng, rừng thông, sông uốn khúc có bờ, phố mái đỏ và lâu đài, ruộng đồng, bãi cát, bờ bọt và dải nước nông,
// biển sâu có sóng, thuyền và nhà nổi. Địa hình từng điểm lấy đúng theo vùng của lô (PLOTS), chỉ làm mềm ranh
// giới vài điểm ảnh. Vẽ một lần trên canvas nhỏ rồi phóng to sắc nét (image-rendering: pixelated); lưới lô, màu
// theo chế độ và mây được landmap.js vẽ đè bằng SVG.
import { Pen, bayer, hexToRgb, makeCanvas, outline, seeded, shadeBlob } from './pixel.js';
import { LAND, PLOTS } from './shared/clan.js';

/** Số điểm ảnh canvas trên một đơn vị của khung SVG (ô lục giác rộng 24 điểm ảnh). */
export const PIXEL_SCALE = 0.5;

/** Bảng màu ấm của game: kem, trà, lá, biển, cát, vàng, mái đỏ, viền mực. */
export const PIXEL_PALETTE = {
  ink: '#2e1d14', cream: '#fff3e3', sand: ['#f6e7c8', '#ecd5a6', '#dcbb84'], gold: '#f4c24f', goldDeep: '#d79c1c',
  leaf: { light: '#a8e08f', mid: '#6dbb5a', dark: '#4e9a45' }, leafDeep: '#3b7d3a', meadow: ['#bfeaa6', '#d7f2c0'],
  sea: { deep: '#4f8fd6', deeper: '#4682cc', mid: '#7cb6e8', shallow: '#a6d2f2', wave: '#9ccbf2', glint: '#e3f2fd' },
  tea: { hi: '#f3d3a6', light: '#e3b07c', mid: '#c8915f', dark: '#9b6238', deep: '#734526' },
  rose: { hi: '#ffd9c4', light: '#f2a98c', mid: '#de8a6c', dark: '#b4614c', deep: '#8a4536' },
  snow: { hi: '#ffffff', light: '#fff8ee', shade: '#d7e0ee', deep: '#b6c3d9' },
  roof: ['#e86f6f', '#c25555'], pink: ['#f6a5bd', '#d9708a'], wall: '#fff3e3', wallShade: '#ecd5b8',
  lava: ['#ffe58a', '#ffb347', '#ff7a3d', '#e2492f'], basalt: ['#6b4a3f', '#56392f', '#43291f'],
  path: '#f4dcaa', dune: '#d9bd86', town: ['#ece0c2', '#dccaa2', '#e8dcbc'], field: { wheat: ['#f6d36b', '#e0ad3c'], rice: ['#b8e69a', '#8fcf6f'], soil: '#b9814f', edge: '#8f5f36' },
};
const K = PIXEL_PALETTE;

// ---------------------------------------------------------------- tiện ích

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Nhiễu giá trị mượt (để ranh giới và vân đất tự nhiên mà vẫn cố định mỗi lần vẽ). */
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.1;

/** Đường cong Catmull-Rom qua các điểm, lấy mẫu dày. */
function sample(points, step = 0.5) {
  const out = [];
  for (let k = 0; k < points.length - 1; k++) {
    const p0 = points[Math.max(0, k - 1)];
    const p1 = points[k];
    const p2 = points[k + 1];
    const p3 = points[Math.min(points.length - 1, k + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (points.length) out.push(points.at(-1));
  return out;
}

/** Khoảng cách (bước 4 hướng) từ mỗi điểm tới tập nguồn, tối đa `cap`. */
function distanceField(W, H, isSource, cap = 40) {
  const dist = new Int16Array(W * H).fill(cap);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < W * H; i++) {
    if (isSource(i)) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i] + 1;
    if (d >= cap) continue;
    const x = i % W;
    if (x > 0 && dist[i - 1] > d) { dist[i - 1] = d; queue[tail++] = i - 1; }
    if (x < W - 1 && dist[i + 1] > d) { dist[i + 1] = d; queue[tail++] = i + 1; }
    if (i >= W && dist[i - W] > d) { dist[i - W] = d; queue[tail++] = i - W; }
    if (i < W * (H - 1) && dist[i + W] > d) { dist[i + W] = d; queue[tail++] = i + W; }
  }
  return dist;
}

/** Làm mờ hộp (ngang rồi dọc) bán kính r. */
function boxBlur(src, W, H, r) {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = s / n;
      s += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s / n;
      s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

const packed = new Map();
/** Màu '#rrggbb' → số 32 bit theo thứ tự byte của ImageData (máy little-endian: ABGR). */
function pack(hex) {
  let v = packed.get(hex);
  if (v === undefined) {
    const [r, g, b] = hexToRgb(hex);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    packed.set(hex, v);
  }
  return v;
}

/** Cả bảng màu (lồng nhau) đổi sang số 32 bit. */
const packAll = (v) => (typeof v === 'string' ? pack(v) : Array.isArray(v) ? v.map(packAll) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, packAll(x)])));

const pixelsOf = new WeakMap();
/** Điểm ảnh của sprite (đọc một lần), để đổ bóng và dán thẳng vào nền. */
function spritePixels(c) {
  if (!pixelsOf.has(c)) pixelsOf.set(c, new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer));
  return pixelsOf.get(c);
}

const pool = new Map();
/**
 * Sprite dùng chung: mỗi loại chỉ vẽ vài biến thể (hạt giống theo khóa) rồi dùng lại, thay vì vẽ và viền từng
 * cây, từng ngọn núi (đỡ vài trăm canvas). `rand` chọn biến thể.
 */
function pick(rand, kind, variants, make) {
  const key = `${kind}#${Math.floor(rand() * variants)}`;
  if (!pool.has(key)) {
    let seed = 7;
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    pool.set(key, make(seeded(seed)));
  }
  return pool.get(key);
}

// ---------------------------------------------------------------- sprite

/** Núi: một đỉnh chính và vài vai núi; mặt trái sáng, mặt phải tối, khe đá, chân cỏ, mũ tuyết tùy chọn. */
function mountain(rand, { h, w = null, snow = 0, pal = K.tea, shoulders = null, dither = 0.18 }) {
  w = w ?? Math.round(h * (1.5 + rand() * 0.5));
  const [c, g] = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  const buf = new Uint32Array(img.data.buffer); // ghi thẳng điểm ảnh (nhanh hơn vài nghìn fillRect)
  const tris = [{ ax: w * (0.42 + rand() * 0.16), ay: 0, k: (h / (w / 2)) * (0.95 + rand() * 0.2) }];
  const count = shoulders ?? (h > 9 ? 1 + Math.floor(rand() * 2) : 0);
  for (let i = 0; i < count; i++) {
    const side = i === 0 ? (rand() < 0.5 ? -1 : 1) : -tris.at(-1).side;
    const far = 0.16 + (i >> 1) * 0.14 + rand() * 0.08;
    tris.push({ ax: w / 2 + side * w * far, ay: h * (0.28 + (i >> 1) * 0.15 + rand() * 0.15), k: tris[0].k * (1.1 + rand() * 0.3), side });
  }
  const seed = rand() * 99;
  const owner = new Int8Array(w);
  const top = new Int16Array(w);
  for (let x = 0; x < w; x++) {
    let best = Infinity;
    tris.forEach((t, i) => {
      const y = t.ay + Math.abs(x + 0.5 - t.ax) * t.k;
      if (y < best) { best = y; owner[x] = i; }
    });
    top[x] = Math.max(0, Math.round(best) + (best > 2 ? Math.round((vnoise(x * 0.5, 3, seed) - 0.5) * 2) : 0));
  }
  for (let x = 0; x < w; x++) {
    const t = tris[owner[x]];
    const cap = snow * h * (0.9 + 0.35 * vnoise(x * 0.7, 9, 5)) + t.ay;
    for (let y = top[x]; y < h; y++) {
      const depth = (y - t.ay) / Math.max(1, h - t.ay);
      const ridge = t.ax + (y - t.ay) * 0.18 + Math.sin(y * 0.9 + t.ax) * 0.8; // sống núi hơi lệch phải
      const lit = x + 0.5 < ridge;
      const onRidge = Math.abs(x + 0.5 - ridge) < 1.2 && y > t.ay + 1;
      const crev = lit ? (x + y * 0.8 + t.ax * 3) % 6 < 1 && y - top[x] > 1 : (y * 0.7 - x + t.ax * 2) % 5 < 1;
      let col;
      if (lit) col = onRidge ? pal.hi : crev || bayer(x, y) < dither ? pal.mid : pal.light;
      else col = crev || bayer(x, y) < 0.15 ? pal.deep : pal.dark;
      if (depth > 0.68 && bayer(x, y) < (depth - 0.68) * 3.2) col = lit ? (crev ? K.leaf.mid : K.leaf.light) : K.leaf.dark; // chân núi cỏ
      if (snow && y < cap) {
        col = lit ? (onRidge ? K.snow.hi : K.snow.light) : crev ? K.snow.deep : K.snow.shade;
        if (y > cap - 1.6 && bayer(x, y) < 0.5) col = lit ? pal.light : pal.dark;
      }
      buf[y * w + x] = pack(col);
    }
  }
  g.putImageData(img, 0, 0);
  return outline(c, '#5a3825');
}

function pine(rand, snowy = false) {
  const h = 8 + Math.floor(rand() * 4);
  const w = h > 9 ? 9 : 7;
  const [c, g] = makeCanvas(w, h + 2);
  const p = new Pen(g);
  const mid = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    const tier = y % 3;
    const half = Math.min(mid, Math.floor(y / 2.4) + tier * 0.6);
    for (let x = Math.round(mid - half); x <= Math.round(mid + half); x++) {
      let col = x <= mid ? K.leaf.mid : K.leaf.dark;
      if (x < mid - half + 1.5 && tier === 2) col = K.leaf.light;
      if (x > mid + 0.5 && tier === 2) col = K.leafDeep;
      if (snowy && ((tier === 0 && y > 0 && bayer(x, y) < 0.8) || y === 0)) col = x <= mid ? K.snow.light : K.snow.shade;
      p.px(x, y, col);
    }
  }
  p.rect(Math.round(mid), h, 1, 2, K.tea.dark);
  return outline(c, '#24401f');
}

function roundTree(rand, big = false, fruit = false) {
  const r = (big ? 4 : 3) + Math.floor(rand() * 1.6);
  const [c, g] = makeCanvas(r * 2 + 3, r * 2 + 4);
  const p = new Pen(g);
  p.rect(r, r * 2, 2, 3, K.tea.dark);
  p.disc(r + 1, r + 1, r, K.leaf.mid);
  shadeBlob(c, r + 1, r + 1, r, K.leaf);
  p.px(r - 1, r - 1, '#d4f5bf');
  if (fruit) for (let k = 0; k < 3; k++) p.px(r - 1 + Math.floor(rand() * 4), r + Math.floor(rand() * 3), '#f08a8a');
  return outline(c, '#2b4a22');
}

function palm(rand) {
  const [c, g] = makeCanvas(11, 13);
  const p = new Pen(g);
  const lean = rand() < 0.5 ? -1 : 1;
  for (let y = 4; y < 13; y++) p.px(5 + Math.round(((12 - y) / 8) * lean), y, y % 2 ? K.tea.mid : K.tea.dark);
  for (const [dx, dy] of [[-4, 1], [-3, 0], [-2, -1], [2, -1], [3, 0], [4, 1], [-1, 2], [1, 2]]) p.px(5 + dx, 3 + dy, K.leaf.mid);
  for (const [dx, dy] of [[-4, 2], [4, 2], [2, 0], [0, 1]]) p.px(5 + dx, 3 + dy, K.leaf.dark);
  p.rect(4, 2, 3, 2, K.leaf.light);
  return outline(c, '#24401f');
}

/** Mái nhọn hai màu (nửa trái sáng, nửa phải tối), đáy ở hàng y0 + rows - 1. */
function gable(p, cx, y0, rows, colors, grow = 1) {
  for (let y = 0; y < rows; y++) {
    const hw = Math.ceil(y * grow) + 1;
    for (let k = -hw; k <= hw; k++) p.px(cx + k, y0 + y, k < 0 ? colors[0] : colors[1]);
  }
}

function house(rand, { roof = K.roof, wide = false } = {}) {
  const w = wide ? 11 : 8 + Math.floor(rand() * 2);
  const [c, g] = makeCanvas(w, 10);
  const p = new Pen(g);
  for (let y = 0; y < 5; y++) {
    const inset = Math.max(0, 3 - y);
    for (let x = inset; x < w - inset; x++) p.px(x, y, y === 4 || x >= w / 2 ? roof[1] : roof[0]);
  }
  p.px(1, 1, '#ffb0a8');
  p.rect(0, 5, w, 5, K.wall);
  p.rect(w - 2, 5, 2, 5, K.wallShade);
  p.rect(1, 6, 2, 2, rand() < 0.5 ? K.gold : '#9fd0f2');
  if (w > 8) p.rect(w - 4, 6, 2, 2, '#9fd0f2');
  p.rect(Math.floor(w / 2), 7, 2, 3, K.tea.dark);
  if (rand() < 0.5) p.rect(w - 3, 0, 1, 2, K.tea.deep); // ống khói
  return outline(c, K.ink);
}

function castle() {
  const [c, g] = makeCanvas(26, 26);
  const p = new Pen(g);
  const stone = ['#f6e7cf', '#e2c9a4', '#c9a87e'];
  p.rect(3, 13, 20, 13, stone[0]);
  p.rect(16, 13, 7, 13, stone[1]);
  for (let x = 3; x < 23; x += 2) p.px(x, 12, x > 15 ? stone[1] : stone[0]);
  for (let y = 16; y < 26; y += 3) for (let x = 4 + (y % 2) * 2; x < 22; x += 5) p.rect(x, y, 2, 1, stone[2]);
  p.rect(10, 18, 6, 8, '#7a4a2a');
  p.rect(11, 19, 4, 7, '#a0643a');
  for (const x of [0, 20]) {
    p.rect(x, 9, 6, 17, stone[0]);
    p.rect(x + 3, 9, 3, 17, stone[1]);
    gable(p, x + 3, 3, 6, K.pink, 0.6);
    p.rect(x + 2, 13, 2, 3, '#7a4a2a');
  }
  p.rect(9, 6, 8, 8, stone[0]);
  p.rect(13, 6, 4, 8, stone[1]);
  gable(p, 13, 1, 5, K.roof);
  p.rect(11, 9, 2, 3, K.gold);
  p.rect(13, 0, 1, 2, K.tea.deep);
  p.rect(14, 0, 3, 2, K.gold);
  return outline(c, K.ink);
}

/** Chùa hai tầng mái hồng trên đỉnh núi cao nhất. */
function pagoda() {
  const [c, g] = makeCanvas(19, 22);
  const p = new Pen(g);
  const tier = (y, hw, th) => {
    for (let j = 0; j < th; j++) {
      const ww = hw - (th - 1 - j);
      for (let k = -ww; k <= ww; k++) p.px(9 + k, y + j, j === th - 1 || k >= 0 ? K.pink[1] : K.pink[0]);
    }
    p.px(9 - hw - 1, y + th - 2, K.pink[0]); // mái cong
    p.px(9 + hw + 1, y + th - 2, K.pink[1]);
  };
  p.rect(5, 16, 9, 6, K.wall);
  p.rect(11, 16, 3, 6, K.wallShade);
  p.rect(8, 18, 3, 4, K.tea.dark);
  p.rect(6, 17, 1, 2, K.gold);
  p.rect(12, 17, 1, 2, K.gold);
  tier(12, 8, 4);
  p.rect(6, 9, 7, 4, K.wall);
  p.rect(10, 9, 3, 4, K.wallShade);
  p.rect(8, 10, 2, 2, K.gold);
  tier(5, 6, 4);
  p.rect(9, 1, 1, 4, K.goldDeep);
  for (const [x, y] of [[9, 0], [8, 2], [10, 2]]) p.px(x, y, K.gold);
  return outline(c, K.ink);
}

function windmill() {
  const [c, g] = makeCanvas(15, 17);
  const p = new Pen(g);
  p.rect(5, 7, 5, 10, K.wall);
  p.rect(8, 7, 2, 10, K.wallShade);
  p.rect(6, 13, 2, 4, K.tea.dark);
  gable(p, 7, 4, 3, K.roof);
  for (let i = 1; i <= 6; i++) {
    for (const [x, y] of [[7 - i, 5 - i * 0.7], [7 + i, 5 + i * 0.7], [7 + i * 0.7, 5 - i], [7 - i * 0.7, 5 + i]]) p.px(x, y, K.tea.mid);
  }
  for (let i = 3; i <= 6; i++) {
    p.px(7 - i, 6 - i * 0.7, K.cream);
    p.px(7 + i * 0.7 + 1, 5 - i, K.cream);
  }
  p.px(7, 5, K.ink);
  return outline(c, K.ink);
}

function lighthouse() {
  const [c, g] = makeCanvas(9, 19);
  const p = new Pen(g);
  for (let y = 6; y < 19; y++) {
    const hw = 2 + Math.floor((y - 6) / 7);
    const red = ((y - 6) >> 2) % 2 === 0;
    for (let k = -hw; k <= hw; k++) p.px(4 + k, y, red ? K.roof[k > 0 ? 1 : 0] : k > 0 ? K.wallShade : K.wall);
  }
  p.rect(2, 3, 5, 3, K.gold);
  p.rect(3, 4, 3, 1, '#fff7c2');
  p.rect(2, 2, 5, 1, K.roof[1]);
  p.rect(3, 1, 3, 1, K.roof[1]);
  p.px(4, 0, K.ink);
  return outline(c, K.ink);
}

function haystack() {
  const [c, g] = makeCanvas(6, 5);
  const p = new Pen(g);
  p.ellipse(3, 3, 3, 2, K.field.wheat[0]);
  p.rect(3, 2, 3, 3, K.field.wheat[1]);
  p.px(1, 1, '#fff0b0');
  return outline(c, '#7a5222');
}

function spire(rand) {
  const h = 6 + Math.floor(rand() * 5);
  const [c, g] = makeCanvas(5, h);
  const p = new Pen(g);
  for (let y = 0; y < h; y++) {
    const hw = Math.min(2, Math.floor(y / 2));
    for (let k = -hw; k <= hw; k++) p.px(2 + k, y, k > 0 ? K.tea.dark : y % 3 === 0 ? K.tea.mid : K.tea.light);
  }
  return outline(c, '#5a3825');
}

function boat() {
  const [c, g] = makeCanvas(12, 11);
  const p = new Pen(g);
  p.rect(1, 7, 10, 2, K.tea.mid);
  p.rect(1, 7, 10, 1, K.tea.light);
  p.rect(2, 9, 8, 1, K.tea.dark);
  p.rect(6, 0, 1, 7, K.tea.deep);
  for (let y = 1; y < 7; y++) p.rect(6 - Math.min(4, y), y, Math.min(4, y), 1, y === 4 ? K.roof[0] : K.cream);
  p.rect(7, 2, 2, 4, '#f3e2c8');
  p.rect(6, 0, 3, 1, K.roof[0]);
  return outline(c, K.ink);
}

function floatHouse() {
  const [c, g] = makeCanvas(12, 11);
  const p = new Pen(g);
  p.rect(0, 8, 12, 3, K.tea.mid);
  p.rect(0, 8, 12, 1, K.tea.light);
  for (let x = 1; x < 12; x += 3) p.px(x, 9, K.tea.dark);
  p.rect(2, 4, 7, 4, K.wall);
  p.rect(7, 4, 2, 4, K.wallShade);
  p.rect(4, 5, 2, 3, K.tea.dark);
  gable(p, 5, 0, 4, K.roof);
  p.rect(10, 3, 1, 5, K.tea.deep);
  p.px(10, 2, K.gold);
  return outline(c, K.ink);
}

/** Tháp nhỏ mái cam của thợ rèn giữa miệng núi lửa. */
function forgeTower() {
  const [c, g] = makeCanvas(9, 15);
  const p = new Pen(g);
  p.rect(1, 6, 7, 9, '#d8c3a5');
  p.rect(5, 6, 3, 9, '#b79c7a');
  for (let y = 8; y < 15; y += 3) p.rect(1, y, 7, 1, '#b79c7a');
  p.rect(3, 11, 2, 4, K.basalt[2]);
  p.rect(3, 8, 2, 1, K.gold);
  gable(p, 4, 1, 5, ['#ffa463', '#e0743e'], 0.9);
  p.px(4, 0, K.gold);
  return outline(c, K.ink);
}

/** Mây bông: các cụm tròn, sáng phía trên trái, bụng mây đậm hơn, viền nâu nhạt. */
function cloud(rand, w, h) {
  const [c, g] = makeCanvas(w, h);
  const p = new Pen(g);
  const puffs = [];
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = Math.round(h * (0.28 + 0.18 * Math.sin(t * Math.PI)) + rand() * 2);
    puffs.push([Math.round(r + t * (w - 2 * r - 1)), Math.round(h - r - 1 - rand() * 2 * Math.sin(t * Math.PI)), r]);
  }
  for (const [x, y, r] of puffs) p.disc(x, y, r, '#000');
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      let s = 1;
      for (const [px, py, r] of puffs) s = Math.min(s, ((x - px) * 0.5 + (y - py)) / r);
      const belly = y > h * 0.62 && bayer(x, y) < (y - h * 0.62) / (h * 0.3);
      [d[i], d[i + 1], d[i + 2]] = hexToRgb(belly ? '#e8d3b8' : s < -0.45 ? '#ffffff' : s < 0.25 + bayer(x, y) * 0.3 ? '#fff6ea' : '#f3e2cc');
    }
  }
  g.putImageData(img, 0, 0);
  return outline(c, '#cfb293');
}

/** Bóng mây: elip dither mờ màu tím ấm (vẽ đè bán trong suốt lên nền). */
function cloudShadow(w, h) {
  const [c, g] = makeCanvas(w, h);
  const p = new Pen(g);
  const rx = w / 2 - 0.5;
  const ry = h / 2 - 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = ((x - rx) / rx) ** 2 + ((y - ry) / ry) ** 2 + (vnoise(x * 0.25, y * 0.25, 40) - 0.5) * 0.3;
      if (e <= 1 && !(e > 0.7 && bayer(x, y) > 0.5)) p.px(x, y, '#3e2450');
    }
  }
  return c;
}

/**
 * Mây trôi (vẽ riêng để landmap.js đặt ở lớp trên cùng, không chặn bấm và có thể trôi bằng CSS).
 * Trả về danh sách { cloud, shadow, x, y, sx, sy } theo điểm ảnh canvas, kèm `scale` để đổi sang đơn vị SVG.
 */
export function drawClouds({ width, height }) {
  const W = Math.round(width * PIXEL_SCALE);
  const H = Math.round(height * PIXEL_SCALE);
  return [[0.3, 0.2, 46, 16, 11], [0.47, 0.62, 38, 14, 21], [0.76, 0.69, 52, 17, 31]].map(([fx, fy, w, h, seed]) => {
    const x = Math.round(fx * W);
    const y = Math.round(fy * H);
    // bóng rơi về đông nam, cách mây một khoảng như mây đang bay cao
    return { cloud: cloud(seeded(seed), w, h), shadow: cloudShadow(Math.round(w * 0.96), h), x, y, sx: x + 15, sy: y + Math.round(h / 2) + 20, scale: PIXEL_SCALE };
  });
}

// ---------------------------------------------------------------- các bước tính theo điểm ảnh
// Mỗi vòng lặp lớn là một hàm nhỏ riêng: trình duyệt tối ưu hàm nhỏ nhanh hơn nhiều so với một hàm vẽ rất dài.

/** Hàm tra lô theo điểm ảnh: chỉ số lô (0..199) chứa (x, y), hoặc -1 nếu ngoài lưới (xét 9 tâm ô gần nhất). */
function hexLookup(centers, TW, ROW) {
  const CX = Float32Array.from(centers, (c) => c[0]);
  const CY = Float32Array.from(centers, (c) => c[1]);
  const APO = TW / 2; // khoảng cách tâm tới cạnh
  return (x, y) => {
    const r0 = Math.round((y - CY[0]) / ROW);
    let best = -1;
    let bd = Infinity;
    for (let r = Math.max(0, r0 - 1); r <= Math.min(LAND.rows - 1, r0 + 1); r++) {
      const c0 = Math.round((x - CX[0] - (r % 2) * APO) / TW);
      for (let c = Math.max(0, c0 - 1); c <= Math.min(LAND.cols - 1, c0 + 1); c++) {
        const k = r * LAND.cols + c;
        const d = (CX[k] - x) ** 2 + (CY[k] - y) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
    }
    if (best < 0) return -1;
    const dx = Math.abs(x - CX[best]);
    const dy = Math.abs(y - CY[best]);
    return dx <= APO && dx * 0.5 + dy * 0.866 <= APO ? best : -1;
  };
}

/** Lưới thưa (mỗi `step` điểm ảnh một mẫu) cho nhiễu tần thấp và vùng theo ô. */
function coarse(W, H, step) {
  const gw = Math.ceil(W / step) + 1;
  const gh = Math.ceil(H / step) + 1;
  const fill = (fn) => {
    const out = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) out[j * gw + i] = fn(i * step, j * step);
    return out;
  };
  return { gw, gh, step, fill, at: (x, y) => Math.floor(y / step) * gw + Math.floor(x / step) };
}

/** Đất/nước đủ độ phân giải: nội suy song tuyến mặt nạ đất đã làm mịn (lưới bước 2) cộng nhiễu bờ. */
function landMask(W, H, smooth, shore, gw) {
  const isLand = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = (y & 1) * 0.5;
    const row = (y >> 1) * gw;
    for (let x = 0; x < W; x++) {
      const k = row + (x >> 1);
      const fx = (x & 1) * 0.5;
      const up = smooth[k] + (smooth[k + 1] - smooth[k]) * fx;
      const down = smooth[k + gw] + (smooth[k + gw + 1] - smooth[k + gw]) * fx;
      isLand[y * W + x] = up + (down - up) * fy + shore[k] > 0.5 ? 1 : 0;
    }
  }
  return isLand;
}

/** Vùng của từng điểm đất; điểm đất mới có do làm mịn bờ lấy vùng của ô đất gần nhất (mặc định là bãi cát). */
function zoneMask(W, H, isLand, raw, gw) {
  const zone = new Int8Array(W * H).fill(-1);
  const at = (x, y) => raw[(y >> 1) * gw + (x >> 1)];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isLand[i]) continue;
      let z = at(x, y);
      if (z <= 0) {
        z = Z.coast;
        search: for (let r = 1; r <= 6; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const xx = x + dx;
              const yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < W && yy < H && at(xx, yy) > 0) {
                z = at(xx, yy);
                break search;
              }
            }
          }
        }
      }
      zone[i] = z;
    }
  }
  return zone;
}

/** Mặt nạ địa hình: đất/nước, vùng, khoảng cách tới đất và tới nước, nhiễu vân đất. */
function terrainMasks(W, H, hexAt) {
  // Nhiễu và vùng theo ô tính trên lưới thưa (ranh giới vùng thành bậc 2 điểm ảnh, vẫn hợp chất pixel).
  const G2 = coarse(W, H, 2);
  const G4 = coarse(W, H, 4);
  const warpX = G4.fill((x, y) => (fbm(x * 0.09, y * 0.09, 1) - 0.5) * 6);
  const warpY = G4.fill((x, y) => (fbm(x * 0.09, y * 0.09, 2) - 0.5) * 6);
  const patch = G4.fill((x, y) => fbm(x * 0.07, y * 0.07, 6));
  const shore = G2.fill((x, y) => (vnoise(x * 0.15, y * 0.15, 3) - 0.5) * 0.35);
  const fine = G2.fill((x, y) => vnoise(x * 0.3, y * 0.3, 8));
  const plotZone = Int8Array.from(PLOTS, (p) => Z[p.zone]);
  const raw = G2.fill((x, y) => {
    const k = hexAt(x + 1 + warpX[G4.at(x, y)], y + 1 + warpY[G4.at(x, y)]);
    return k < 0 ? -1 : plotZone[k];
  });
  const smooth = boxBlur(raw.map((z) => (z > 0 ? 1 : 0)), G2.gw, G2.gh, 2);
  const isLand = landMask(W, H, smooth, shore, G2.gw);
  const zone = zoneMask(W, H, isLand, raw, G2.gw);
  return {
    isLand, zone, patch, fine, G2, G4,
    toLand: distanceField(W, H, (i) => isLand[i] === 1, 24),
    toWater: distanceField(W, H, (i) => isLand[i] === 0, 8),
  };
}

/** Tô nền vào mảng điểm ảnh 32 bit: biển theo độ sâu, vách bờ nam, vân từng vùng đất. */
function paintGround(px32, W, H, { isLand, zone, toLand, toWater, patch, fine, G2, G4 }, snowY) {
  const U = packAll(K); // bảng màu dạng số
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = bayer(x, y);
      const n = patch[G4.at(x, y)];
      const n2 = fine[G2.at(x, y)];
      let col;
      if (!isLand[i]) {
        const dl = toLand[i];
        const above = y > 0 && isLand[i - W] ? 1 : y > 1 && isLand[i - 2 * W] ? 2 : 0;
        if (above && zone[i - above * W] !== Z.coast) col = above === 1 ? U.tea.dark : U.tea.deep;
        else if (dl <= 1) col = n2 > 0.32 || b < 0.5 ? U.cream : U.sea.shallow;
        else if (dl <= 3) col = b < 0.75 ? U.sea.shallow : U.sea.mid;
        else if (dl <= 7) col = b < (7 - dl) / 4 ? U.sea.shallow : U.sea.mid;
        else if (dl <= 12) col = b < (12 - dl) / 5 ? U.sea.mid : U.sea.deep;
        else col = n < 0.38 && b < 0.5 ? U.sea.deeper : U.sea.deep;
        if (dl === 4 && n2 > 0.55 && x % 3) col = U.sea.glint; // vòng bọt thứ hai, đứt quãng
      } else {
        const z = zone[i];
        const dw = toWater[i];
        if (z === Z.coast || (dw <= 1 && z !== Z.hill)) {
          col = dw <= 1 || n2 > 0.62 ? U.sand[1] : (y + Math.round(Math.sin(x * 0.5) * 1.5)) % 5 === 0 && b < 0.5 ? U.sand[2] : U.sand[0];
          if (z === Z.coast && dw > 6 && n > 0.55) col = b < 0.5 ? U.leaf.light : U.sand[0];
        } else if (z === Z.hill) {
          if (y < snowY[x]) col = n2 > 0.66 || b < 0.06 ? U.snow.shade : U.snow.light;
          else col = n > 0.55 ? (b < 0.5 ? U.tea.light : U.dune) : n2 > 0.6 ? U.leaf.mid : U.leaf.light;
        } else if (z === Z.forest) col = n > 0.5 ? (b < 0.3 ? U.leaf.mid : U.leaf.dark) : n2 > 0.7 ? U.leaf.mid : U.leaf.dark;
        else if (z === Z.urban) col = n > 0.62 ? (b < 0.5 ? U.leaf.light : U.town[2]) : (x + (y >> 1)) % 4 === 0 && y % 2 === 0 ? U.town[1] : U.town[0];
        else if (z === Z.river) col = n2 > 0.7 ? U.leaf.mid : b < 0.12 ? U.meadow[0] : U.leaf.light;
        else col = n > 0.6 ? (b < 0.5 ? U.meadow[0] : U.leaf.light) : n < 0.3 ? (b < 0.4 ? U.leaf.mid : U.leaf.light) : n2 > 0.75 && b < 0.3 ? U.meadow[1] : U.leaf.light;
      }
      px32[i] = col;
    }
  }
}

/** Mặt nạ bóng đổ của mọi vật đứng: chiếu từng điểm về đông nam; bóng của mỗi sprite tính một lần. */
function castShadows(items, W, H) {
  const shadow = new Uint8Array(W * H);
  const cache = new Map();
  for (const it of items) {
    if (!it.shadow) continue;
    const key = it.k;
    if (!cache.has(it.sprite)) cache.set(it.sprite, new Map());
    let fp = cache.get(it.sprite).get(key);
    if (!fp) {
      const sw = it.sprite.width;
      const sh = it.sprite.height;
      const a = spritePixels(it.sprite);
      const set = new Set();
      for (let y = 0; y < sh; y++) {
        const up = sh - y;
        const dy = Math.round(1 - up * 0.38);
        for (let x = 0; x < sw; x++) {
          if (!(a[y * sw + x] >>> 24)) continue;
          const dx = Math.round(x + up * it.k);
          set.add((dy + 512) * 4096 + dx).add((dy + 512) * 4096 + dx + 1);
        }
      }
      fp = Int32Array.from(set);
      cache.get(it.sprite).set(key, fp);
    }
    for (let k = 0; k < fp.length; k++) {
      const v = fp[k];
      const Y = it.y + Math.floor(v / 4096) - 512;
      const X = it.x + (v % 4096);
      if (X >= 0 && X < W && Y >= 0 && Y < H) shadow[Y * W + X] = 1;
    }
  }
  return shadow;
}

/** Tối nền dưới bóng (ấm, hơi tím) rồi dán vật từ xa tới gần thẳng vào mảng điểm ảnh. */
function composeItems(data, items, shadow, W, H) {
  for (let i = 0; i < shadow.length; i++) {
    if (!shadow[i]) continue;
    data[i * 4] = data[i * 4] * 0.74 + 6;
    data[i * 4 + 1] = data[i * 4 + 1] * 0.74 + 3;
    data[i * 4 + 2] = data[i * 4 + 2] * 0.74 + 6;
  }
  const out = new Uint32Array(data.buffer);
  for (const it of items) {
    const sw = it.sprite.width;
    const sh = it.sprite.height;
    const a = spritePixels(it.sprite);
    const top = it.y - sh;
    for (let y = Math.max(0, -top); y < sh && top + y < H; y++) {
      for (let x = 0; x < sw; x++) {
        const v = a[y * sw + x];
        const X = it.x + x;
        if (v >>> 24 && X >= 0 && X < W) out[(top + y) * W + X] = v; // pixel art: điểm ảnh đặc hoặc trống
      }
    }
  }
}

// ---------------------------------------------------------------- vẽ nền

const ZONE_IDS = ['sea', 'coast', 'plain', 'river', 'urban', 'hill', 'forest'];
const Z = Object.fromEntries(ZONE_IDS.map((z, i) => [z, i]));

/**
 * Vẽ nền pixel. `geometry`: Map id → { hex, cx, cy } theo đơn vị SVG; `river`: điểm theo đơn vị SVG.
 * Trả về canvas (cùng nền cho mọi chế độ tô màu; màu theo chế độ do landmap.js vẽ đè).
 */
export function drawPixelBase({ width, height, geometry, river }) {
  const S = PIXEL_SCALE;
  const W = Math.round(width * S);
  const H = Math.round(height * S);
  const N = W * H;
  // Canvas chính để ở bộ nhớ thường (willReadFrequently): đọc/ghi điểm ảnh nhiều lần mà không phải chép từ GPU.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  const pen = new Pen(g);
  const plotAt = (c, r) => (c < 0 || r < 0 || c >= LAND.cols || r >= LAND.rows ? null : PLOTS[r * LAND.cols + c]);
  const center = (p) => {
    const geo = geometry.get(p.id);
    return [geo.cx * S, geo.cy * S];
  };

  // Lưới lục giác suy ra từ hình học: bề ngang ô, bước hàng, tâm ô đầu tiên.
  const g1 = geometry.get(1);
  const ROW = (geometry.get(LAND.cols + 1).cy - g1.cy) * S;
  const hexAt = hexLookup(PLOTS.map(center), (geometry.get(2).cx - g1.cx) * S, ROW);

  // 1) vùng của từng điểm ảnh: lấy theo ô (lệch nhẹ bằng nhiễu cho ranh giới mềm), bờ đất làm mịn bỏ răng cưa
  const m = terrainMasks(W, H, hexAt);
  const { isLand, zone, toLand, toWater } = m;
  const snowY = new Float32Array(W);
  for (let x = 0; x < W; x++) snowY[x] = g1.cy * S + 1.55 * ROW + (fbm(x * 0.12, 0, 4) - 0.5) * 10;

  // 2) tô nền: biển theo độ sâu (bọt, nước nông, sâu), vách đất 3/4 ở bờ nam, vân từng loại đất
  const img = g.createImageData(W, H);
  paintGround(new Uint32Array(img.data.buffer), W, H, m, snowY);
  g.putImageData(img, 0, 0);

  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x, y) => Math.round(y) * W + Math.round(x);
  const land = (x, y) => inMap(Math.round(x), Math.round(y)) && isLand[idx(x, y)] === 1;
  const zoneAt = (x, y) => (land(x, y) ? ZONE_IDS[zone[idx(x, y)]] : 'sea');
  const busy = new Uint8Array(N); // chỗ đã có đường, sông, ruộng: không đặt vật lên
  const mark = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(Math.round(x + dx), Math.round(y + dy))) busy[idx(x + dx, y + dy)] = 1;
  };
  const isBusy = (x, y) => !inMap(Math.round(x), Math.round(y)) || busy[idx(x, y)] === 1;
  const C = (c, r, dx = 0, dy = 0) => {
    const [x, y] = center(plotAt(c, r));
    return [x + dx, y + dy];
  };

  const urban = PLOTS.filter((p) => p.zone === 'urban');
  const keep = urban.reduce((a, b) => (b.desirability > a.desirability ? b : a), urban[0]);
  const hills = PLOTS.filter((p) => p.zone === 'hill' && p.row >= 3);
  const fire = hills.reduce((a, b) => (b.col + b.row > a.col + a.row ? b : a), hills[0]);
  const caveAt = hills.find((p) => p.row === 3 && p !== fire) ?? null;
  const [kx, ky] = center(keep);
  const [fx, fy] = center(fire);
  const [mx, my] = C(4, 1); // khối núi cao nhất
  const nearCrater = (x, y, r) => Math.hypot(x - fx, (y - fy - 4) * 1.5) < r;
  const onMassif = (x, y) => Math.abs(x - mx - 2) < 40 - Math.max(0, y - my) * 0.3 && y < my + 34;

  // 3) ruộng ở đồng bằng (phẳng, vẽ trước đường)
  for (const p of PLOTS.filter((q) => q.zone === 'plain')) {
    const rand = seeded(p.id * 131);
    if (rand() > 0.45) continue;
    const [cx, cy] = center(p);
    const fw = 9 + Math.floor(rand() * 5);
    const fh = 6 + Math.floor(rand() * 3);
    const x0 = Math.round(cx - fw / 2 + (rand() - 0.5) * 6);
    const y0 = Math.round(cy - fh / 2 + (rand() - 0.5) * 4);
    if (![[x0, y0], [x0 + fw, y0], [x0, y0 + fh], [x0 + fw, y0 + fh]].every(([x, y]) => zoneAt(x, y) === 'plain' && toWater[idx(x, y)] > 2)) continue;
    const crop = rand() < 0.55 ? K.field.wheat : K.field.rice;
    pen.rect(x0, y0, fw, fh, K.field.soil);
    for (let y = y0 + 1; y < y0 + fh - 1; y++) pen.rect(x0 + 1, y, fw - 2, 1, crop[(y - y0) % 2 ? 0 : 1]);
    pen.rect(x0, y0 + fh, fw, 1, K.field.edge);
    mark(x0 + fw / 2, y0 + fh / 2, Math.ceil(Math.max(fw, fh) / 2));
  }

  // 4) đường đất uốn lượn từ phố ra các ngả
  const road = (pts) => {
    const line = sample(pts, 0.4).filter(([x, y]) => land(x, y));
    for (const [x, y] of line) pen.rect(x - 2, y - 1, 4, 4, K.tea.mid);
    for (const [x, y] of line) {
      pen.rect(x - 1, y - 0.5, 2, 2, K.path);
      mark(x, y, 2);
    }
  };
  road([[kx, ky], C(8, 6, -4, 6), C(6, 7, 0, 2), C(3, 8, 2, -2), C(0, 8, -6, 2)]);
  road([[kx, ky], C(10, 7, 2, 0), C(10, 8, -4, 4), C(10, 9, 2, 6)]);
  road([C(8, 5), C(6, 4, 4, 2), C(6, 3, 6, 6), [fx + 8, fy + 4]]);
  road([C(11, 3, 4, 0), C(13, 2, 0, 4), C(15, 2, -4, 6), C(16, 3, 2, -2)]);
  road([C(12, 5, 0, 2), C(14, 6, 2, 0), C(15, 6, 0, 2)]);
  road([C(9, 3, 0, -2), C(9, 1, 2, 4), C(7, 1, 4, 6), C(6, 2, 2, 2)]);

  // 5) sông theo đúng các ô ven sông, chèn khúc uốn, có bờ cát và bờ nam sẫm; một cây cầu gần phố
  const bends = [river[0].map((v) => v * S)];
  for (let k = 1; k < river.length; k++) {
    const [ax, ay] = river[k - 1].map((v) => v * S);
    const [bx, by] = river[k].map((v) => v * S);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const s = k % 2 ? 4 : -4;
    bends.push([(ax + bx) / 2 - ((by - ay) / len) * s, (ay + by) / 2 + ((bx - ax) / len) * s], [bx, by]);
  }
  const flow = sample(bends, 0.7).filter(([x, y]) => land(x, y) || land(x, y - 3));
  for (const [x, y] of flow) pen.disc(x, y + 1, 3, K.tea.dark);
  for (const [x, y] of flow) pen.disc(x, y, 3, K.sand[1]);
  for (const [x, y] of flow) {
    pen.disc(x, y, 2, K.sea.mid);
    mark(x, y, 4);
  }
  flow.forEach(([x, y], k) => {
    if (k % 10 === 0) pen.rect(x - 1, y - 1, 2, 1, K.sea.glint);
    else if (k % 10 === 5) pen.px(x + 1, y + 1, K.sea.deep);
  });
  if (flow.length) {
    const [bx, by] = flow.reduce((a, q) => (Math.hypot(q[0] - kx + 30, q[1] - ky - 10) < Math.hypot(a[0] - kx + 30, a[1] - ky - 10) ? q : a)).map(Math.round);
    pen.rect(bx - 4, by - 3, 8, 6, K.tea.mid);
    for (let x = bx - 4; x < bx + 4; x += 2) pen.rect(x, by - 3, 1, 6, K.tea.light);
    pen.rect(bx - 4, by - 4, 8, 1, K.tea.deep);
    pen.rect(bx - 4, by + 3, 8, 1, K.tea.deep);
  }

  // 6) miệng núi lửa lõm: vách trong tây bắc tối, đông nam sáng; đáy đá bazan với khe lava phát sáng
  const crater = (cx, cy, rx, ry) => {
    for (let y = -ry - 4; y <= ry + 4; y++) {
      for (let x = -rx - 5; x <= rx + 5; x++) {
        const e = (x / (rx + 4)) ** 2 + (y / (ry + 3)) ** 2;
        if (e < 1 && e > 0.7 && bayer(cx + x, cy + y) < 0.35) pen.px(cx + x, cy + y, K.tea.dark);
      }
    }
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const e = (x / rx) ** 2 + (y / ry) ** 2;
        if (e > 1) continue;
        const slope = x / rx + y / ry;
        let col;
        if (e > 0.94) col = '#5a3825';
        else if (e > 0.55) col = slope < -0.2 ? K.basalt[2] : slope > 0.3 ? K.tea.mid : K.basalt[0];
        else if (Math.abs(Math.sin(x * 0.9 + Math.sin(y * 1.3) * 2)) < 0.22 || Math.abs(Math.sin(y * 1.4 + x * 0.35)) < 0.18) col = e < 0.2 ? K.lava[0] : K.lava[1];
        else if (e < 0.12) col = K.lava[2];
        else col = bayer(cx + x, cy + y) < 0.25 * (1 - e) ? K.lava[3] : K.basalt[1];
        pen.px(cx + x, cy + y, col);
      }
    }
    for (let x = -rx + 2; x <= rx - 2; x++) pen.px(cx + x, cy - Math.round(ry * Math.sqrt(1 - (x / rx) ** 2)) - 1, x < 0 ? K.tea.hi : K.tea.light);
    mark(cx, cy, Math.max(rx, ry) + 2);
  };
  crater(Math.round(fx), Math.round(fy + 2), 17, 10);
  if (caveAt) {
    const [vx, vy] = center(caveAt);
    crater(Math.round(vx + 1), Math.round(vy + 4), 6, 4);
  }

  // 7) vật đứng: gom lại, sắp theo chân, đổ bóng chung một lớp
  const items = [];
  const put = (sprite, x, y, { shadow = true, k = 0.55, z = 0 } = {}) => items.push({ sprite, x: Math.round(x - sprite.width / 2), y: Math.round(y), shadow, k, z });
  const fits = (x, y, w, ok) => [[x, y], [x - w / 2, y], [x + w / 2, y], [x, y - 2]].every(([a, b]) => ok(zoneAt(a, b)) && !isBusy(a, b));

  // núi: nhiều đỉnh chồng lớp, đỉnh phía bắc phủ tuyết; chừa chỗ cho miệng núi lửa và khối núi lớn
  for (const p of PLOTS.filter((q) => q.zone === 'hill')) {
    const rand = seeded(p.id * 977);
    const [cx, cy] = center(p);
    const n = p === fire || p === caveAt ? 2 : 4;
    for (let k = 0; k < n; k++) {
      const x = cx + (k % 2 ? 1 : -1) * (3 + rand() * 6) + (rand() - 0.5) * 4;
      const y = cy - 6 + Math.floor(k / 2) * 10 + rand() * 3;
      if (nearCrater(x, y, 26) || zoneAt(x, y) !== 'hill' || onMassif(x, y)) continue;
      if (caveAt === p && Math.hypot(x - cx, y - cy - 4) < 9) continue;
      if (rand() < 0.15) continue;
      const h = 8 + 2 * Math.floor(rand() * 6) + (p.row <= 1 ? 3 : 0);
      const snow = y - h * 0.4 < snowY[Math.max(0, Math.min(W - 1, Math.round(x)))] ? 2 : p.row <= 2 ? 1 : 0;
      const peak = pick(rand, `m${h}.${snow}`, 1, (r) => mountain(r, { h, w: Math.round(h * (1.3 + r() * 0.9)), snow: [0, 0.18, 0.3 + r() * 0.25][snow] }));
      put(peak, x, y + (rand() - 0.5) * 3, { k: 0.45 });
    }
    const pr = seeded(p.id * 61);
    for (let k = 0; k < 2; k++) {
      const x = cx + (pr() - 0.5) * 18;
      const y = cy + 4 + pr() * 6;
      if (zoneAt(x, y) === 'hill' && !isBusy(x, y) && !nearCrater(x, y, 24) && !(Math.abs(x - mx - 2) < 40 && y < my + 34)) { const sn = y < snowY[Math.round(x)] + 6; put(pick(pr, `p${sn}`, 6, (r) => pine(r, sn)), x, y); }
    }
  }
  {
    // khối núi hồng cao nhất, chùa trên đỉnh
    const big = mountain(seeded(4242), { h: 60, w: 90, snow: 0.22, pal: K.rose, shoulders: 4, dither: 0.06 });
    put(big, mx + 2, my + 30, { k: 0.4 });
    const a = spritePixels(big);
    let apex = [big.width / 2, 0];
    for (let i = 0; i < a.length; i++) {
      if (a[i] >>> 24) { apex = [i % big.width, Math.floor(i / big.width)]; break; }
    }
    const pg = pagoda();
    items.push({ sprite: pg, x: Math.round(mx + 2 - big.width / 2 + apex[0] - pg.width / 2), y: Math.round(my + 30 - big.height + apex[1] + 5), shadow: true, k: 0.4, z: 1 });
  }
  put(forgeTower(), fx, fy + 6, { k: 0.3 });
  for (const [a, rr] of [[-2.6, 1], [-2.0, 1.05], [-1.2, 1.1], [-0.5, 1.05], [0.3, 1.1], [2.9, 1.05]]) {
    put(pick(seeded(Math.round(a * 100) + 500), 'spire', 5, spire), fx + Math.cos(a) * 20 * rr, fy + 4 + Math.sin(a) * 12 * rr);
  }
  // gai đá rải ở rìa đồi – đồng bằng
  for (const p of PLOTS.filter((q) => q.zone === 'plain' && q.col <= 7 && q.row <= 6)) {
    const rand = seeded(p.id * 53);
    const [cx, cy] = center(p);
    for (let k = 0; k < 2; k++) {
      const x = cx + (rand() - 0.5) * 16;
      const y = cy + (rand() - 0.5) * 12;
      if (rand() < 0.6 && fits(x, y, 4, (z) => z === 'plain')) put(pick(rand, 'spire', 5, spire), x, y);
    }
  }
  // rừng: thông và cây tròn dày
  for (const p of PLOTS.filter((q) => q.zone === 'forest')) {
    const rand = seeded(p.id * 7919);
    const [cx, cy] = center(p);
    for (let k = 0; k < 16; k++) {
      const gx = k % 4;
      const gy = k >> 2;
      const x = cx - 10 + gx * 6.5 + (gy % 2) * 3 + (rand() - 0.5) * 3;
      const y = cy - 6 + gy * 6 + (rand() - 0.5) * 2;
      if (!fits(x, y, 4, (z) => z === 'forest')) continue;
      const sn = y < snowY[Math.round(x)] - 6;
      put(rand() < 0.55 ? pick(rand, `p${sn}`, 6, (r) => pine(r, sn)) : pick(rand, 'tree', 6, (r) => roundTree(r, r() < 0.3, r() < 0.15)), x, y);
    }
  }
  // phố: nhà mái đỏ quây quần quanh lâu đài
  for (const p of urban) {
    const rand = seeded(p.id * 313);
    const [cx, cy] = center(p);
    if (p === keep) {
      put(castle(), cx, cy + 9);
      continue;
    }
    for (const [dx, dy] of [[-6, -2], [5, -1], [-1, 6], [8, 7], [-8, 8]]) {
      const x = cx + dx + (rand() - 0.5) * 2;
      const y = cy + dy;
      if (Math.hypot(x - kx, y - ky - 4) < 14) continue;
      if (fits(x, y, 8, (z) => z === 'urban')) put(pick(rand, 'house', 6, (r) => house(r, { roof: r() < 0.25 ? K.pink : K.roof, wide: r() < 0.25 })), x, y);
      else if (rand() < 0.5 && fits(x, y, 4, (z) => z === 'urban')) put(pick(rand, 'tree', 6, (r) => roundTree(r, r() < 0.3, r() < 0.15)), x, y);
    }
  }
  // đồng bằng & ven sông: cây, nhà, đống rơm, cối xay gió, hoa
  const mill = plotAt(4, 6);
  for (const p of PLOTS.filter((q) => q.zone === 'plain' || q.zone === 'river')) {
    const rand = seeded(p.id * 7);
    const [cx, cy] = center(p);
    const ok = (z) => z === 'plain' || z === 'river';
    if (p === mill && fits(cx, cy + 4, 8, ok)) {
      put(windmill(), cx, cy + 6);
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const x = cx + (rand() - 0.5) * 18;
      const y = cy + (rand() - 0.5) * 14;
      const r = rand();
      if (!fits(x, y, 6, ok)) continue;
      if (r < 0.5) put(pick(rand, 'tree', 6, (q) => roundTree(q, q() < 0.3, q() < 0.15)), x, y);
      else if (r < 0.56) put(pick(rand, 'hay', 1, haystack), x, y);
      else if (r < 0.68) put(pick(rand, 'house', 6, (q) => house(q, { roof: q() < 0.25 ? K.pink : K.roof, wide: q() < 0.25 })), x, y);
    }
    for (let k = 0; k < 4; k++) {
      const x = cx + (rand() - 0.5) * 20;
      const y = cy + (rand() - 0.5) * 16;
      if (fits(x, y, 1, ok)) pen.px(x, y, ['#ffffff', K.pink[0], K.gold][Math.floor(rand() * 3)]);
    }
  }
  // ven biển: dừa, hải đăng, cầu tàu gỗ
  for (const p of PLOTS.filter((q) => q.zone === 'coast')) {
    const rand = seeded(p.id * 17);
    const [cx, cy] = center(p);
    for (let k = 0; k < 2; k++) {
      const x = cx + (rand() - 0.5) * 16;
      const y = cy + (rand() - 0.5) * 10;
      if (fits(x, y, 6, (z) => z === 'coast')) put(pick(rand, 'palm', 4, palm), x, y);
    }
  }
  {
    const [lx, ly] = C(19, 5);
    put(lighthouse(), lx + 2, ly + 2);
    const [dx, dy] = C(11, 8);
    for (let k = 0; k < 14; k++) pen.rect(dx + 6 + k, dy + 8 + Math.floor(k / 2), 3, 2, k % 2 ? K.tea.light : K.tea.mid);
    pen.rect(dx + 6, dy + 10, 15, 1, K.tea.deep);
  }
  // biển: nhà nổi, thuyền buồm (không đổ bóng, có bọt quanh)
  const seaRand = seeded(99);
  for (const p of PLOTS.filter((q) => q.zone === 'sea')) {
    const [cx, cy] = center(p);
    const r = seaRand();
    if (r < 0.14) put(pick(seaRand, 'raft', 1, floatHouse), cx, cy + 4, { shadow: false });
    else if (r < 0.26) put(pick(seaRand, 'boat', 1, boat), cx, cy + 4, { shadow: false });
  }
  put(pick(seaRand, 'boat', 1, boat), 30, H - 22, { shadow: false });
  put(pick(seaRand, 'boat', 1, boat), W - 40, 18, { shadow: false });
  for (const it of items) {
    const cx = it.x + it.sprite.width / 2;
    if (land(cx, it.y - 1)) continue;
    pen.rect(cx - 6, it.y - 1, 3, 1, K.sea.glint);
    pen.rect(cx + 3, it.y, 4, 1, K.sea.glint);
    pen.rect(cx - 2, it.y + 1, 3, 1, K.cream);
  }
  {
    const rand = seeded(77);
    for (let k = 0; k < 180; k++) {
      const x = Math.floor(rand() * W);
      const y = Math.floor(rand() * H);
      if (toLand[y * W + x] < 8) continue;
      pen.rect(x, y, 3, 1, K.sea.wave);
      pen.px(x - 1, y + 1, K.sea.wave);
      pen.px(x + 3, y + 1, K.sea.wave);
      pen.px(x + 1, y, K.sea.glint);
    }
  }

  // 8) bóng đổ chung: chiếu từng điểm của vật về đông nam, gộp một mặt nạ rồi tối nền một lần; sau đó dán vật
  // (từ xa tới gần) thẳng vào mảng điểm ảnh, một lần putImageData thay cho vài trăm drawImage.
  items.sort((a, b) => a.y - b.y || a.z - b.z);
  const im = g.getImageData(0, 0, W, H);
  composeItems(im.data, items, castShadows(items, W, H), W, H);
  g.putImageData(im, 0, 0);
  return canvas;
}
