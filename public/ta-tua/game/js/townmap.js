// Bản đồ "Phố Trân Châu": hai dãy nhà hai bên một con phố. Nền (trời, đồi, vỉa hè, mặt đường) vẽ một lần;
// mỗi toà nhà vẽ trên canvas riêng để nhấc lên khi rê chuột và làm xám khi còn khoá; xe cộ, mây, khói,
// bảng điện chạy ở lớp chuyển động; đèn đường và cửa sổ sáng ở lớp ánh sáng ban đêm. Tông màu như công viên.
import { PARK_PX, timeOfDay } from './scenes.js';
import { Pen, bitmap, hexToRgb, makeCanvas, outline, seeded, shadeBlob } from './pixel.js';

const PX = PARK_PX;
const SLOTS = 11;
const SLOT_W = 37;
const W = 1 + SLOTS * SLOT_W;
const H = 200;
// Khung thế giới tính bằng px CSS trước khi thu phóng theo bề ngang khung chứa.
const WORLD_W = W * PX;
const WORLD_H = H * PX;
const BASE = [92, 188]; // hàng pixel ngay dưới chân dãy nhà sau / dãy trước
const ROAD = [100, 126];
const HEAD = 22; // khoảng trống trên nóc cho khói, cờ bay
const KW = SLOT_W + 2; // bề ngang vùng vẽ một toà, trước khi thêm viền
const COMPACT_BELOW = 520;
const slotLeft = (slot) => 1 + slot * SLOT_W;

const SKIES = {
  dawn: ['#a9bde6', '#f2c4c8', '#ffe4c8'],
  day: ['#74c2ea', '#9bd6f1', '#cbeef8'],
  dusk: ['#5a4a98', '#c9739a', '#ffb88a'],
  night: ['#0f1433', '#1b2350', '#2c3770'],
};
const TINTS = { dawn: '#fff0e4', day: null, dusk: '#ffcdb8', night: '#6670b8' };
const CLOUD = {
  dawn: ['#fff4ee', '#f3cbd2'],
  day: ['#ffffff', '#d8eaf6'],
  dusk: ['#ffd7c8', '#e3a1b0'],
  night: ['#4d5688', '#3a4274'],
};
const GREEN = { light: '#a6dc7c', mid: '#79c25a', dark: '#4f9a43' };
const BLOSSOM = { light: '#ffe0ea', mid: '#ffb6cb', dark: '#ee8aa9' };

// Kính cửa sổ: ban đêm các điểm mang đúng màu này được thắp sáng (giữ nguyên rèm, kệ hàng bên trong).
const GLASS = { '#a9d6ec': '#ffe7a0', '#8fc4e0': '#ffd27a', '#e3f4fb': '#fff6d6' };
const [GLASS_A, GLASS_B, GLASS_HI] = Object.keys(GLASS);

// ---------------------------------------------------------------- hình dựng sẵn (chép từ scenes.js)

function roundTree(r, seed, pal = GREEN) {
  const rand = seeded(seed);
  const trunkH = Math.round(r * 0.9);
  const w = Math.ceil(r * 2.7) + 2;
  const [c, g] = makeCanvas(w, Math.ceil(r * 2.3) + trunkH);
  const p = new Pen(g);
  const cx = Math.floor(w / 2);
  const cy = r + 1;
  p.rect(cx - 1, cy + r - 4, 4, trunkH + 3, '#8a5a3a');
  p.rect(cx + 2, cy + r - 4, 1, trunkH + 3, '#6e4428');
  p.disc(cx, cy, r, pal.mid);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI * (0.9 + rand() * 1.2) + (k % 2 ? Math.PI : 0);
    p.disc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.35 + 1, Math.round(r * (0.5 + rand() * 0.2)), pal.mid);
  }
  shadeBlob(c, cx, cy, r, pal);
  for (let k = 0; k < r; k++) p.px(cx - r * 0.6 + rand() * r * 0.9, cy - r * 0.7 + rand() * r * 0.8, pal.light);
  return outline(c);
}

function pineTree(h) {
  const w = Math.round(h * 0.62) | 1;
  const [c, g] = makeCanvas(w, h + 4);
  const p = new Pen(g);
  const cx = Math.floor(w / 2);
  p.rect(cx - 1, h - 4, 3, 8, '#7a4f33');
  for (let tier = 0; tier < 3; tier++) {
    const top = Math.round(tier * h * 0.24);
    const bottom = top + Math.round(h * 0.46);
    for (let y = top; y <= bottom; y++) {
      const half = Math.round(((y - top) / (bottom - top)) * (w / 2) * (0.62 + tier * 0.19));
      p.rect(cx - half, y, half * 2 + 1, 1, '#5aa457');
    }
  }
  shadeBlob(c, cx, h * 0.5, h * 0.4, { light: '#7fc46d', mid: '#5aa457', dark: '#3d7f45' });
  return outline(c);
}

function bush(r, seed, berries) {
  const rand = seeded(seed);
  const [c, g] = makeCanvas(r * 3 + 2, r * 2 + 2);
  const p = new Pen(g);
  const cx = Math.floor(c.width / 2);
  const cy = r + 1;
  p.ellipse(cx, cy + 1, Math.round(r * 1.4), r, GREEN.mid);
  p.disc(cx - r * 0.6, cy - 1, Math.round(r * 0.75), GREEN.mid);
  p.disc(cx + r * 0.5, cy - 2, Math.round(r * 0.8), GREEN.mid);
  shadeBlob(c, cx, cy, r, GREEN);
  if (berries) for (let k = 0; k < r; k++) p.px(cx - r + rand() * r * 2, cy - r * 0.4 + rand() * r, berries);
  return outline(c);
}

function cloud(w, seed, [fill, under]) {
  const rand = seeded(seed);
  const h = Math.round(w * 0.5);
  const [c, g] = makeCanvas(w + 2, h + 2);
  const p = new Pen(g);
  for (let k = 0; k < 5; k++) {
    const t = (k + 0.5) / 5;
    const r = Math.max(2, Math.round(h * (0.2 + 0.27 * Math.sin(Math.PI * t)) + rand()));
    p.disc(1 + t * w, h - r, r, fill);
  }
  p.rect(1 + w * 0.1, h - 2, w * 0.8, 2, fill);
  g.clearRect(0, h, c.width, 2);
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let x = 0; x < c.width; x++) {
    let seen = 0;
    for (let y = c.height - 1; y >= 0 && seen < 2; y--) {
      if (img.data[(y * c.width + x) * 4 + 3]) {
        p.px(x, y, under);
        seen += 1;
      }
    }
  }
  return c;
}

function bench() {
  const [c, g] = makeCanvas(18, 10);
  const p = new Pen(g);
  p.rect(2, 0, 2, 9, '#6b4229');
  p.rect(14, 0, 2, 9, '#6b4229');
  for (const y of [1, 3]) {
    p.rect(0, y, 18, 1, '#c98f5a');
  }
  p.rect(0, 6, 18, 2, '#d9a46e');
  p.rect(0, 6, 18, 1, '#f0c48f');
  return outline(c);
}

function fenceSegment(len) {
  const [c, g] = makeCanvas(len, 8);
  const p = new Pen(g);
  p.rect(0, 2, len, 1, '#d9a46e');
  p.rect(0, 5, len, 1, '#d9a46e');
  for (let x = 1; x < len - 1; x += 5) {
    p.rect(x, 0, 2, 8, '#b97e4c');
    p.px(x, 0, '#dba672');
  }
  return outline(c, '#5b3a24');
}

function streetLamp(lit) {
  const [c, g] = makeCanvas(8, 27);
  const p = new Pen(g);
  p.rect(3, 6, 2, 18, '#4a4458');
  p.rect(3, 6, 1, 18, '#6f6886');
  p.rect(1, 23, 6, 4, '#3b3647');
  p.rect(1, 23, 6, 1, '#5a536b');
  p.rect(1, 1, 6, 5, lit ? '#ffe7a0' : '#e6edf4');
  p.rect(2, 2, 2, 3, lit ? '#fffbe2' : '#ffffff');
  p.rect(0, 0, 8, 1, '#3b3647');
  p.rect(1, 6, 6, 1, '#3b3647');
  return outline(c);
}

// ---------------------------------------------------------------- tiện ích

function makeLayer(parent, cls, w, h) {
  const [c, g] = makeCanvas(w, h);
  c.className = `px-layer ${cls}`;
  c.style.width = `${w * PX}px`;
  c.style.height = `${h * PX}px`;
  parent.append(c);
  return { c, g, p: new Pen(g) };
}

function animate(fps, draw) {
  let raf = 0;
  let last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / fps) return;
    last = now;
    draw(now / 1000);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

/** Phủ màu multiply lên phần đã vẽ, giữ nguyên chỗ trong suốt (để bầu trời không bị phủ). */
function tinted(src, color) {
  if (!color) return src;
  const [c, g] = makeCanvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-over'; // còn vẽ chồng ổ khoá lên sau
  return c;
}

/** Nhân một màu với màu phủ của giờ hiện tại, dùng cho những thứ vẽ ở lớp chuyển động. */
function mul(hex, tint) {
  if (!tint) return hex;
  const a = hexToRgb(hex);
  const b = hexToRgb(tint);
  return `rgb(${a.map((v, i) => Math.round((v * b[i]) / 255)).join(',')})`;
}

function flipped(src) {
  const [c, g] = makeCanvas(src.width, src.height);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** Toà nhà còn khoá: bỏ màu, nén tương phản cho nhạt như ảnh cũ. */
function greyOut(c) {
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const v = (k) => 62 + (l * 0.86 + d[i + k] * 0.14) * 0.66;
    [d[i], d[i + 1], d[i + 2]] = [v(0) * 0.98, v(1) * 0.98, v(2) * 1.03];
  }
  g.putImageData(img, 0, 0);
  return c;
}

function drawSky(p, x, y, w, h, time, rand) {
  p.vGradient(x, y, w, h, SKIES[time]);
  if (time === 'night') {
    for (let k = 0; k < (w * h) / 90; k++) p.px(x + rand() * w, y + rand() * h * 0.9, rand() < 0.7 ? '#fffbe0' : '#b9c6ff');
  }
}

function drawSunOrMoon(p, cx, cy, time, r = 8) {
  if (time === 'night') {
    p.disc(cx, cy, Math.round(r * 0.75), '#f6f1d6');
    p.disc(cx + Math.ceil(r * 0.4), cy - Math.ceil(r * 0.25), Math.round(r * 0.62), SKIES.night[0]);
    return;
  }
  const color = { dawn: '#ffd9a8', day: '#fff4c4', dusk: '#ffad6b' }[time];
  p.disc(cx, cy, r + 2, time === 'day' ? '#ffeeb0' : '#ffc89a');
  p.disc(cx, cy, r, color);
  p.px(cx - Math.ceil(r / 3), cy - Math.ceil(r / 3), '#ffffff');
}

function pixelLine(p, x0, y0, x1, y1, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) p.px(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
}

// Chữ số 3×5 cho bảng điện tử và biển "BÁN".
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111',
  '.': '000000000000100', '^': '000010111000000', v: '000111010000000', ' ': '000000000000000',
  B: '110101110101110', A: '010101111101101', N: '110101101101101',
};

function drawText(p, text, x, y, color) {
  for (const ch of text) {
    const bits = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (bits[i] === '1') p.px(x + (i % 3), y + Math.floor(i / 3), color);
    x += ch === '.' ? 2 : 4;
  }
  return x;
}

const PADLOCK = () => bitmap([
  '.sss.',
  's...s',
  's...s',
  'ggggg',
  'gGkgg',
  'ggkgg',
  'ggggg',
], { s: '#d8d3e3', g: '#f4c24f', G: '#fff1a8', k: '#6b4a12' }, '#2e1d14');

// ---------------------------------------------------------------- bộ dựng toà nhà

/**
 * Mỗi toà vẽ trên khung KW×h: chân toà ở hàng h-1, tâm ở x=19. `wins` ghi các ô kính để thắp đèn,
 * `glows` các đốm sáng ban đêm [x, y, r, màu], `decor` các hình đã có viền dán vào sau bước viền,
 * `anim(p, t, tint)` vẽ phần chuyển động lên canvas riêng của toà.
 */
function kit(h, seed, locked) {
  const [c, g] = makeCanvas(KW, h);
  return { c, g, p: new Pen(g), h, seed, locked, rand: seeded(seed), wins: [], glows: [], decor: [], anim: null };
}

function wall(k, x, y, w, h, color, shade) {
  k.p.rect(x, y, w, h, color);
  k.p.rect(x + w - 2, y, 2, h, shade);
  k.p.ditherFill(x + w - 4, y, 2, h, shade, 0.5);
  k.p.rect(x, y, w, 1, shade);
}

function glass(k, x, y, w, h) {
  k.p.vGradient(x, y, w, h, [GLASS_A, GLASS_B]);
  k.p.rect(x, y, 1, Math.max(1, h - 2), GLASS_HI);
  k.wins.push([x, y, w, h]);
}

function win(k, x, y, w, h, frame = '#fffaf0', cross = w >= 5) {
  const { p } = k;
  p.rect(x - 1, y - 1, w + 2, h + 2, frame);
  glass(k, x, y, w, h);
  if (cross) {
    p.rect(x + Math.floor(w / 2), y, 1, h, frame);
    if (h >= 5) p.rect(x, y + Math.floor(h / 2), w, 1, frame);
  }
  p.rect(x - 1, y + h + 1, w + 2, 1, 'rgba(46, 29, 20, 0.16)');
}

/** Cửa sổ vòm: bo hai góc trên của khung. */
function archWin(k, x, y, w, h, frame, wallColor) {
  win(k, x, y, w, h, frame, false);
  k.p.px(x - 1, y - 1, wallColor);
  k.p.px(x + w, y - 1, wallColor);
  k.p.px(x, y, frame);
  k.p.px(x + w - 1, y, frame);
}

function door(k, x, y, w, h, color, dark, knob = '#f4c24f') {
  const { p } = k;
  p.rect(x - 1, y - 1, w + 2, h + 1, dark);
  p.rect(x, y, w, h, color);
  p.rect(x + 1, y + 1, w - 2, 1, dark);
  p.rect(x + 1, y + Math.floor(h / 2) + 1, w - 2, 1, dark);
  p.px(x + w - 2, y + Math.floor(h / 2), knob);
}

/** Mái dốc hai bên quanh tâm `cx`, rộng dần tới `half` ở hàng dưới cùng, ngói kẻ hàng. */
function gable(k, cx, y, half, h, color, dark = color, light = null) {
  for (let j = 0; j < h; j++) {
    const hw = Math.max(1, Math.round(((j + 1) / h) * half));
    k.p.rect(cx - hw, y + j, hw * 2 + 1, 1, j % 3 === 2 ? dark : color);
    if (light) k.p.px(cx - hw, y + j, light);
  }
}

/** Mái hình thang (mansard). */
function hip(k, x, y, w, h, color, dark) {
  for (let j = 0; j < h; j++) {
    const inset = h - 1 - j;
    k.p.rect(x + inset, y + j, w - inset * 2, 1, j % 3 === 2 ? dark : color);
  }
}

function cornice(k, x, y, w, color, light) {
  k.p.rect(x, y, w, 2, color);
  k.p.rect(x, y, w, 1, light);
}

/** Mái hiên sọc, mép dưới lượn vỏ sò. */
function awning(k, x, y, w, h, c1, c2) {
  for (let i = 0; i < w; i++) {
    const color = Math.floor(i / 3) % 2 ? c2 : c1;
    k.p.rect(x + i, y, 1, h, color);
    if (i % 3 !== 2) k.p.px(x + i, y + h, color);
  }
  k.p.rect(x, y, w, 1, 'rgba(255, 255, 255, 0.35)');
}

function grassLot(k, y) {
  k.p.rect(1, y, 37, k.h - y, '#92cf76');
  k.p.rect(1, y, 37, 1, '#a6d98b');
  for (let i = 0; i < 12; i++) k.p.px(2 + k.rand() * 35, y + 1 + k.rand() * (k.h - y - 1), '#74b85c');
}

/** Khói bốc lên từ (x, y), trôi dạt sang phải. */
function smoke(x, y, n = 4) {
  return (p, t, tint) => {
    for (let i = 0; i < n; i++) {
      const u = (t * 0.32 + i / n) % 1;
      p.g.globalAlpha = 1 - u * u;
      const sx = x + Math.sin(u * 5 + i) * 1.5 + u * 7;
      p.disc(sx, y - u * 20, Math.round(1 + u * 2.4), mul(u < 0.45 ? '#f6f1ec' : '#dcd4ce', tint));
    }
    p.g.globalAlpha = 1;
  };
}

/** Bảng điện tử chạy giá tăng (xanh) giảm (đỏ). */
function ticker(rand, x, y, w) {
  const [strip, sg] = makeCanvas(260, 5);
  const sp = new Pen(sg);
  let len = 0;
  for (let i = 0; i < 7; i++) {
    const up = rand() < 0.55;
    const color = up ? '#5dff8a' : '#ff5d6c';
    len = drawText(sp, up ? '^' : 'v', len, 0, color);
    len = drawText(sp, (1 + rand() * 40).toFixed(1), len, 0, color) + 3;
  }
  return (p, t) => {
    const off = Math.floor(t * 10) % len;
    p.g.save();
    p.g.beginPath();
    p.g.rect(x, y - 1, w, 7);
    p.g.clip();
    p.g.drawImage(strip, x - off, y);
    p.g.drawImage(strip, x - off + len, y);
    p.g.restore();
    if (Math.floor(t * 2) % 2) p.px(x + w - 1, y - 1, '#ff5d6c');
  };
}

const BUILD = {};
const HEIGHT = {
  home: 40, shop: 36, jobs: 50, bank: 44, market: 46, news: 34, townhall: 56, school: 50, clinic: 40,
  park: 34, arcade: 36, kitchen: 42, garden: 32, bazaar: 32, boba: 52, factory: 46, realestate: 44, arena: 48, filler: 34,
  forge: 44, matshop: 36, colosseum: 50,
};

BUILD.home = (k) => {
  const { p } = k;
  p.rect(26, 5, 4, 9, '#c97a5a');
  p.rect(26, 5, 1, 9, '#dd9474');
  p.rect(25, 4, 6, 2, '#9b6238');
  wall(k, 6, 18, 27, 22, '#fff1dc', '#f0d9bc');
  gable(k, 19, 3, 16, 15, '#e2788f', '#c95c78', '#f4a3b4');
  p.rect(3, 17, 33, 1, '#b8506c');
  win(k, 18, 10, 3, 3, '#fffaf0', false);
  for (const x of [9, 24]) {
    win(k, x, 23, 6, 6);
    p.rect(x - 1, 30, 8, 2, '#c98f5a');
    for (let i = 0; i < 4; i++) p.px(x + i * 2, 29, i % 2 ? '#ffd75e' : '#ff7a9c');
  }
  for (const [x, y] of [[18, 23], [20, 23], [18, 24], [19, 24], [20, 24], [19, 25]]) p.px(x, y, '#ff6f91');
  door(k, 16, 28, 7, 11, '#c8915f', '#9b6238');
  p.rect(15, 39, 9, 1, '#d9cfc0');
};

BUILD.shop = (k) => {
  const { p } = k;
  cornice(k, 1, 6, 37, '#4fae93', '#8fd3bf');
  wall(k, 2, 8, 35, 28, '#eef8f1', '#cfe6da');
  p.rect(4, 9, 31, 7, '#4fae93');
  p.rect(5, 10, 29, 5, '#fffaf0');
  p.px(6, 10, '#4a4458');
  p.rect(7, 11, 6, 2, '#d9708a');
  p.rect(7, 13, 5, 1, '#4a4458');
  p.px(8, 14, '#4a4458');
  p.px(11, 14, '#4a4458');
  for (const [x, w, c] of [[15, 4, '#d9708a'], [20, 3, '#f39b4a'], [24, 5, '#4fae93'], [30, 2, '#d9708a']]) p.rect(x, 11, w, 3, c);
  awning(k, 2, 17, 35, 3, '#f4a3b4', '#fffaf0');
  const goods = ['#ff7a9c', '#ffd75e', '#79c25a', '#f39b4a'];
  for (const x of [5, 26]) {
    win(k, x, 23, 8, 9, '#4fae93', false);
    for (const y of [26, 29]) {
      p.rect(x, y, 8, 1, '#c98f5a');
      for (let i = 0; i < 8; i += 2) p.px(x + i + (y % 2), y - 1, goods[(i / 2 + y) % 4]);
    }
  }
  p.rect(15, 22, 9, 14, '#4fae93');
  glass(k, 16, 23, 3, 13);
  glass(k, 20, 23, 3, 13);
};

BUILD.jobs = (k) => {
  const { p } = k;
  p.rect(16, 0, 7, 1, '#6e4428');
  p.px(16, 1, '#6e4428');
  p.px(22, 1, '#6e4428');
  p.rect(12, 2, 15, 6, '#9b6238');
  p.rect(12, 2, 15, 1, '#c8915f');
  p.rect(12, 5, 15, 1, '#7a4f33');
  p.rect(18, 4, 3, 3, '#f4c24f');
  p.px(19, 5, '#d79c1c');
  p.rect(14, 8, 1, 2, '#4a4458');
  p.rect(24, 8, 1, 2, '#4a4458');
  cornice(k, 4, 10, 31, '#7a8fc9', '#a9b8e6');
  wall(k, 5, 12, 29, 38, '#e3eaf2', '#c3cfdc');
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) win(k, 8 + col * 6, 15 + row * 6, 4, 4, '#b4c1dc', false);
  p.rect(5, 39, 29, 1, '#7a8fc9');
  p.rect(13, 40, 13, 2, '#7a8fc9');
  p.rect(15, 42, 9, 8, '#5c6b99');
  glass(k, 16, 43, 3, 7);
  glass(k, 20, 43, 3, 7);
  for (const x of [8, 27]) {
    p.disc(x + 2, 45, 2, '#79c25a');
    p.rect(x, 46, 5, 4, '#c98f5a');
    p.rect(x, 46, 5, 1, '#e3ad78');
  }
};

BUILD.bank = (k) => {
  const { p } = k;
  gable(k, 19, 5, 17, 9, '#f4c24f');
  gable(k, 19, 7, 14, 7, '#f8f0de');
  p.disc(19, 4, 4, '#ffcf4a');
  p.disc(19, 4, 3, '#e09a1f');
  p.disc(19, 4, 2, '#ffcf4a');
  p.rect(19, 2, 1, 5, '#e09a1f');
  p.px(17, 2, '#fff3b0');
  p.px(18, 1, '#fff3b0');
  p.rect(2, 14, 35, 3, '#f8f0de');
  p.rect(2, 14, 35, 1, '#ffe08a');
  p.rect(2, 16, 35, 1, '#d79c1c');
  wall(k, 3, 17, 33, 21, '#e9dcc3', '#d2c2a4');
  win(k, 9, 22, 1, 8, '#e9dcc3', false);
  win(k, 29, 22, 1, 8, '#e9dcc3', false);
  win(k, 17, 21, 5, 2, '#d79c1c', false);
  door(k, 17, 26, 5, 12, '#9b6238', '#6e4428');
  for (const x of [4, 11, 24, 31]) {
    p.rect(x - 1, 17, 6, 2, '#fffaf0');
    p.rect(x, 19, 4, 17, '#ffffff');
    p.rect(x + 1, 20, 1, 15, '#ece8de');
    p.rect(x + 3, 19, 1, 17, '#d9d4c6');
    p.rect(x - 1, 36, 6, 2, '#fffaf0');
  }
  for (const [y, inset, c] of [[38, 2, '#efe6d2'], [40, 1, '#e2d6bd'], [42, 1, '#d3c5a8']]) {
    p.rect(inset, y, 39 - inset * 2, 2, c);
    p.rect(inset, y, 39 - inset * 2, 1, '#fffaf0');
  }
};

BUILD.market = (k) => {
  const { p } = k;
  for (let j = 0; j < 4; j++) {
    p.rect(14 - j, j, 1 + j * 2, 1, '#4fbf6a');
    p.rect(24 - j, 3 - j, 1 + j * 2, 1, '#e8586a');
  }
  cornice(k, 2, 4, 35, '#c8915f', '#e3b68a');
  wall(k, 3, 6, 33, 40, '#f7ecd9', '#e6d3b5');
  p.rect(5, 9, 29, 11, '#4a4458');
  p.rect(6, 10, 27, 9, '#1b1a24');
  for (let y = 10; y < 19; y++) for (let x = 6 + (y % 2); x < 33; x += 2) p.px(x, y, '#262533');
  k.glows.push([19, 14, 13, 'rgba(110, 255, 160, 0.10)']);
  if (!k.locked) k.anim = ticker(k.rand, 6, 12, 27);
  for (const x of [7, 17, 27]) win(k, x, 23, 5, 6);
  for (const x of [6, 28]) win(k, x, 34, 5, 6);
  p.rect(12, 31, 15, 1, '#9b6238');
  p.rect(13, 32, 13, 14, '#c8915f');
  glass(k, 14, 33, 5, 13);
  glass(k, 20, 33, 5, 13);
};

BUILD.news = (k) => {
  const { p } = k;
  p.rect(12, 0, 15, 6, '#fffaf0');
  p.rect(13, 1, 13, 1, '#d9534f');
  for (const [x, y, w] of [[13, 3, 6], [20, 3, 6], [13, 4, 5], [20, 4, 4]]) p.rect(x, y, w, 1, '#b9b2a6');
  p.rect(15, 6, 1, 2, '#4a4458');
  p.rect(23, 6, 1, 2, '#4a4458');
  p.rect(5, 8, 29, 2, '#3d8f78');
  awning(k, 5, 10, 29, 3, '#4fae93', '#e8f7f2');
  wall(k, 7, 14, 25, 20, '#fde2c4', '#efc9a2');
  p.rect(9, 15, 21, 8, '#5c4033');
  k.glows.push([19, 19, 9, 'rgba(255, 214, 140, 0.14)']);
  for (const [x, c] of [[10, '#ff8fb1'], [14, '#8fd3bf'], [18, '#ffd75e'], [22, '#8ab8e9'], [26, '#f39b4a']]) {
    p.rect(x, 16, 3, 4, c);
    p.px(x, 16, '#fffaf0');
  }
  p.rect(8, 23, 23, 2, '#c8915f');
  p.rect(8, 23, 23, 1, '#e3ad78');
  for (const [x, w, h] of [[10, 6, 3], [18, 5, 2], [24, 5, 4]]) {
    p.rect(x, 23 - h, w, h, '#fffaf0');
    for (let y = 23 - h + 1; y < 23; y += 2) p.rect(x + 1, y, w - 2, 1, '#cfc8bb');
  }
  p.rect(9, 26, 21, 6, '#f6d2a8');
  p.rect(11, 27, 6, 4, '#fffaf0');
  p.rect(12, 28, 4, 1, '#d9534f');
  p.rect(12, 29, 3, 1, '#b9b2a6');
  p.rect(22, 27, 6, 4, '#ffd75e');
  p.rect(23, 28, 4, 1, '#f39b4a');
  p.rect(33, 24, 5, 10, '#e84a5f');
  p.rect(33, 24, 5, 1, '#ff8f9a');
  p.rect(34, 26, 3, 3, '#fffaf0');
};

BUILD.townhall = (k) => {
  const { p } = k;
  p.rect(19, 0, 1, 11, '#6f6886');
  p.px(19, 0, '#f4c24f');
  p.disc(19, 18, 7, '#8fd3bf');
  shadeBlob(k.c, 17, 14, 7, { light: '#c4eedf', mid: '#8fd3bf', dark: '#5fb89c' });
  p.rect(17, 10, 5, 2, '#f4c24f');
  p.rect(18, 9, 3, 1, '#ffe08a');
  p.rect(11, 18, 17, 8, '#fff3dc');
  for (let x = 12; x < 28; x += 3) p.rect(x, 19, 1, 7, '#ecd9bc');
  p.disc(19, 22, 3, '#c8915f');
  p.disc(19, 22, 2, '#fffaf0');
  p.rect(19, 20, 1, 3, '#4a3326');
  p.rect(19, 22, 2, 1, '#4a3326');
  cornice(k, 1, 26, 37, '#c8915f', '#e3b68a');
  wall(k, 2, 28, 35, 28, '#fff3dc', '#ecd9bc');
  for (const x of [5, 11, 24, 30]) archWin(k, x, 32, 4, 7, '#c8915f', '#fff3dc');
  for (const x of [5, 30]) win(k, x, 45, 4, 5, '#c8915f', false);
  for (const x of [10, 27]) p.rect(x, 44, 2, 10, '#f4a3b4');
  p.rect(14, 41, 11, 13, '#c8915f');
  p.rect(15, 42, 9, 12, '#7a4f33');
  p.px(14, 41, '#fff3dc');
  p.px(24, 41, '#fff3dc');
  p.rect(19, 42, 1, 12, '#5c3a24');
  p.px(18, 48, '#f4c24f');
  p.px(20, 48, '#f4c24f');
  p.rect(12, 54, 15, 2, '#e2d6bd');
  p.rect(12, 54, 15, 1, '#fffaf0');
  k.anim = (q, t, tint) => {
    for (let i = 0; i < 8; i++) {
      const dy = Math.round(Math.sin(t * 5 - i * 0.8) * (i / 7) * 1.3);
      q.rect(20 + i, 1 + dy, 1, 5, mul(i ? '#e8453c' : '#c9302c', tint));
      if (i === 3) {
        for (const [sx, sy] of [[0, 1], [-1, 2], [0, 2], [1, 2], [0, 3]]) q.px(20 + i + sx, 1 + dy + sy, mul('#ffd75e', tint));
      }
    }
  };
};

function schoolBell(p, dx, tint = null) {
  const c = (hex) => mul(hex, tint);
  p.px(19, 8, c('#4a4458'));
  p.rect(18 + dx, 9, 3, 1, c('#f4c24f'));
  p.rect(17 + dx, 10, 5, 2, c('#f4c24f'));
  p.rect(17 + dx, 12, 5, 1, c('#d79c1c'));
  p.px(18 + dx, 10, c('#fff1a8'));
  p.px(19 + dx * 2, 13, c('#9b6238'));
}

BUILD.school = (k) => {
  const { p } = k;
  gable(k, 19, 0, 6, 5, '#e07a5f', '#b85a42');
  wall(k, 14, 5, 11, 13, '#ffe3a3', '#f2c97a');
  p.rect(16, 7, 7, 7, '#5c4033');
  p.px(16, 7, '#ffe3a3');
  p.px(22, 7, '#ffe3a3');
  if (k.locked) schoolBell(p, 0);
  else k.anim = (q, t, tint) => schoolBell(q, Math.sin(t * 1.3) > 0.8 ? Math.round(Math.sin(t * 14)) : 0, tint);
  hip(k, 1, 17, 37, 7, '#e07a5f', '#b85a42');
  wall(k, 3, 24, 33, 26, '#ffe3a3', '#f2c97a');
  for (const x of [6, 12, 23, 29]) win(k, x, 27, 4, 5, '#4fae93', false);
  for (const x of [6, 29]) win(k, x, 38, 4, 5, '#4fae93', false);
  p.rect(14, 33, 11, 4, '#fffaf0');
  for (const [x, c] of [[16, '#e84a5f'], [19, '#4fae93'], [22, '#4aa3e8']]) p.rect(x, 34, 2, 2, c);
  door(k, 16, 38, 7, 12, '#4fae93', '#3d8f78');
  p.rect(19, 38, 1, 12, '#3d8f78');
};

BUILD.clinic = (k) => {
  const { p } = k;
  p.rect(14, 0, 11, 10, '#ffffff');
  p.rect(18, 1, 3, 8, '#ef5a6a');
  p.rect(15, 3, 9, 3, '#ef5a6a');
  p.px(18, 1, '#ff9aa5');
  p.px(15, 3, '#ff9aa5');
  cornice(k, 3, 10, 33, '#4fae93', '#8fd3bf');
  wall(k, 4, 12, 31, 28, '#fbfaf5', '#dfe4ea');
  p.rect(4, 22, 31, 2, '#8fd3bf');
  for (const x of [7, 13, 22, 28]) win(k, x, 15, 4, 5, '#cfe6da', false);
  for (const x of [7, 28]) win(k, x, 28, 4, 6, '#cfe6da', false);
  p.rect(13, 25, 13, 2, '#4fae93');
  p.rect(18, 25, 3, 1, '#ef5a6a');
  p.rect(14, 27, 11, 13, '#9fb0c4');
  glass(k, 15, 28, 4, 12);
  glass(k, 20, 28, 4, 12);
};

BUILD.park = (k) => {
  grassLot(k, 29);
  k.decor.push([fenceSegment(35), 1, 18]);
  k.decor.push([roundTree(7, k.seed), 0, 5]);
  k.decor.push([roundTree(6, k.seed + 1, BLOSSOM), 17, 9]);
  k.decor.push([bench(), 10, 21]);
  k.decor.push([bush(3, k.seed + 2, '#ff8fb1'), 0, 23]);
  k.decor.push([bush(3, k.seed + 3, '#fff1a8'), 25, 23]);
};

function bobber(p, t, tint) {
  const bob = Math.round(Math.sin(t * 2.4) * 0.7 + (Math.sin(t * 0.6) > 0.94 ? 1 : 0));
  for (let y = 18; y < 30 + bob; y++) p.px(31, y, mul('#eef3f8', tint));
  p.px(31, 30 + bob, mul('#ffffff', tint));
  p.px(31, 31 + bob, mul('#e84a5f', tint));
  if (Math.sin(t * 2.4) < -0.4) {
    p.px(29, 32, mul('#d6f4ff', tint));
    p.px(33, 32, mul('#d6f4ff', tint));
  }
}

BUILD.arcade = (k) => {
  const { p } = k;
  grassLot(k, 30);
  p.ellipse(27, 32, 10, 3, '#c9bda7');
  p.ellipse(27, 32, 9, 2, '#4aa2cf');
  p.ellipse(27, 33, 8, 1, '#68c3e6');
  p.rect(21, 31, 4, 1, '#9fdff4');
  p.rect(34, 33, 2, 1, '#5fae4f');
  p.rect(1, 12, 1, 18, '#d9708a');
  p.rect(5, 12, 1, 18, '#d9708a');
  for (let y = 15; y < 30; y += 3) p.rect(2, y, 3, 1, '#f4a3b4');
  gable(k, 3, 6, 3, 5, '#ffd75e', '#f2c14e');
  p.rect(0, 11, 7, 2, '#f4a3b4');
  pixelLine(p, 6, 12, 12, 28, '#ffd75e');
  pixelLine(p, 7, 12, 13, 28, '#f2c14e');
  p.rect(12, 28, 3, 2, '#ffd75e');
  p.rect(16, 29, 9, 2, '#c98f5a');
  p.rect(16, 29, 9, 1, '#e3ad78');
  for (let x = 17; x < 25; x += 3) p.px(x, 30, '#a8703f');
  p.rect(17, 31, 1, 3, '#8a5a3a');
  p.rect(23, 31, 1, 3, '#8a5a3a');
  pixelLine(p, 22, 28, 31, 17, '#7a4f33');
  p.px(24, 26, '#4a4458');
  p.rect(27, 26, 3, 2, '#f39b4a');
  if (k.locked) bobber(p, 0, null);
  else k.anim = bobber;
};

BUILD.kitchen = (k) => {
  const { p } = k;
  p.rect(27, 2, 4, 9, '#c97a5a');
  p.rect(27, 2, 1, 9, '#dd9474');
  for (let y = 4; y < 11; y += 3) p.rect(28, y, 3, 1, '#a8603f');
  p.rect(26, 1, 6, 2, '#7a4f33');
  hip(k, 2, 8, 35, 8, '#9b6238', '#7a4f33');
  p.rect(2, 16, 35, 1, '#6e4428');
  wall(k, 4, 17, 31, 25, '#f6d2a8', '#e3b68a');
  awning(k, 3, 18, 33, 3, '#f39b4a', '#fff1dc');
  p.rect(13, 10, 13, 6, '#fff3dc');
  p.rect(13, 10, 13, 1, '#ffffff');
  p.rect(16, 13, 7, 2, '#d9534f');
  p.rect(17, 15, 5, 1, '#b8443f');
  p.px(17, 11, '#cfc8bb');
  p.px(19, 12, '#cfc8bb');
  pixelLine(p, 21, 11, 24, 12, '#7a4f33');
  for (const x of [6, 25]) win(k, x, 25, 8, 8, '#9b6238');
  door(k, 16, 26, 7, 16, '#9b6238', '#6e4428');
  glass(k, 17, 27, 5, 5);
  for (const x of [3, 34]) {
    p.rect(x, 22, 2, 1, '#7a4f33');
    p.rect(x, 23, 2, 3, '#e84a5f');
    p.px(x, 26, '#f4c24f');
    k.glows.push([x + 1, 24, 5, 'rgba(255, 120, 90, 0.22)']);
  }
  if (!k.locked) k.anim = smoke(29, 0);
};

BUILD.garden = (k) => {
  const { p } = k;
  grassLot(k, 27);
  p.ellipse(28, 15, 9, 6, '#fffaf0');
  p.rect(19, 15, 19, 13, '#fffaf0');
  p.ellipse(28, 15, 8, 5, GLASS_A);
  p.rect(20, 15, 17, 12, GLASS_A);
  p.ditherFill(20, 10, 17, 17, GLASS_B, 0.35);
  for (let y = 11; y < 22; y++) p.px(21 + Math.floor((y - 11) / 3), y, GLASS_HI);
  k.wins.push([20, 10, 17, 17]);
  for (const x of [24, 28, 32]) p.rect(x, 10, 1, 17, '#fffaf0');
  p.rect(20, 20, 17, 1, '#fffaf0');
  for (let x = 20; x < 37; x++) {
    const top = 23 + (x % 3 === 0 ? 0 : 1);
    p.rect(x, top, 1, 27 - top, x % 2 ? '#5fae5a' : '#86cf72');
  }
  for (const x of [22, 27, 33]) p.px(x, 23, '#e84a5f');
  p.rect(9, 5, 1, 11, '#8a5a3a');
  p.rect(6, 9, 7, 1, '#8a5a3a');
  p.rect(7, 8, 5, 5, '#e98a8a');
  p.disc(9, 5, 2, '#f6d2a8');
  p.px(8, 5, '#3d2a1f');
  p.px(10, 5, '#3d2a1f');
  p.rect(6, 3, 7, 1, '#c98f5a');
  p.rect(7, 1, 5, 2, '#d9a46e');
  for (const y of [17, 21, 25]) {
    p.rect(2, y, 15, 2, '#9a6b45');
    p.rect(2, y + 1, 15, 1, '#7b5236');
    for (let x = 3; x < 16; x += 3) {
      p.px(x, y - 1, '#4f9a43');
      p.px(x - 1, y - 2, '#a6dc7c');
      p.px(x + 1, y - 2, '#79c25a');
      if (y === 21) p.px(x, y, '#f39b4a');
    }
  }
};

BUILD.bazaar = (k) => {
  const { p } = k;
  const bulbs = ['#ffd75e', '#ff8fb1', '#8fd3bf'];
  for (let x = 1; x < 38; x++) {
    const y = 3 + Math.round(Math.sin((x / 37) * Math.PI) * 2);
    p.px(x, y, '#4a4458');
    if (x % 4 === 2) {
      p.px(x, y + 1, bulbs[(x >> 2) % 3]);
      k.glows.push([x, y + 1, 2, 'rgba(255, 230, 150, 0.3)']);
    }
  }
  const stalls = [['#f4a3b4', '#ff7a9c', '#ffd75e'], ['#8fd3bf', '#79c25a', '#e84a5f'], ['#ffd75e', '#f39b4a', '#b48cf2']];
  stalls.forEach(([cloth, a, b], i) => {
    const x0 = 1 + i * 12;
    p.rect(x0 + 1, 11, 1, 21, '#8a5a3a');
    p.rect(x0 + 10, 11, 1, 21, '#8a5a3a');
    p.rect(x0, 7, 12, 1, '#fffaf0');
    awning(k, x0, 8, 12, 3, cloth, '#fffaf0');
    for (let j = 0; j < 3; j++) p.rect(x0 + 3 + j * 3, 13, 1, 2 + (j % 2), j % 2 ? a : b);
    p.rect(x0 + 1, 20, 10, 2, '#e3ad78');
    p.rect(x0 + 1, 22, 10, 10, cloth);
    for (let y = 23; y < 32; y += 3) p.rect(x0 + 1, y, 10, 1, '#fffaf0');
    for (let j = 0; j < 4; j++) {
      p.disc(x0 + 3 + j * 2, 18, 1, j % 2 ? a : b);
      p.px(x0 + 3 + j * 2 - 1, 17, '#fffaf0');
    }
  });
};

BUILD.boba = (k) => {
  const { p } = k;
  for (let y = 10; y < 28; y++) {
    const half = 7 - Math.floor((y - 10) / 5);
    p.rect(19 - half, y, half * 2 + 1, 1, y < 13 ? '#fff3e3' : y < 20 ? '#e8bf92' : '#ddaa78');
    if (y > 12 && y < 25) p.px(20 - half, y, '#fff6ea');
  }
  p.ditherFill(12, 19, 15, 2, '#e8bf92', 0.5);
  for (const [x, y] of [[15, 25], [18, 25], [21, 25], [16, 23], [20, 23], [18, 21]]) {
    p.rect(x, y, 2, 2, '#3d2a1f');
    p.px(x, y, '#7a5a44');
  }
  for (const [x, y] of [[18, 15], [20, 15], [18, 16], [19, 16], [20, 16], [19, 17]]) p.px(x, y, '#ff8fb1');
  p.ellipse(19, 8, 7, 2, '#fffaf0');
  p.rect(11, 9, 17, 1, '#efe2cf');
  for (let j = 0; j < 8; j++) {
    const x = 20 + Math.floor(j / 2);
    p.rect(x, 7 - j, 2, 1, '#ff8fb1');
    p.px(x, 7 - j, '#ffc2d1');
  }
  p.rect(4, 28, 31, 2, '#d9708a');
  p.rect(4, 28, 31, 1, '#f4a3b4');
  awning(k, 4, 30, 31, 3, '#f4a3b4', '#fffaf0');
  wall(k, 5, 34, 29, 18, '#fde8cf', '#f0cfae');
  p.rect(8, 35, 23, 7, '#5c4033');
  p.rect(10, 36, 9, 4, '#3d2a1f');
  for (const y of [37, 39]) p.rect(11, y, 6, 1, '#fffaf0');
  k.glows.push([19, 38, 10, 'rgba(255, 214, 140, 0.14)']);
  p.rect(7, 42, 25, 2, '#c8915f');
  p.rect(7, 42, 25, 1, '#e3ad78');
  for (const [x, c] of [[21, '#e8bf92'], [25, '#c79bf2'], [28, '#8fd3bf']]) {
    p.rect(x, 39, 2, 3, c);
    p.px(x + 1, 41, '#3d2a1f');
    p.px(x + 1, 38, '#ff8fb1');
  }
  p.rect(7, 44, 25, 7, '#f4a3b4');
  for (let y = 45; y < 51; y += 3) for (let x = 9 + (y % 2) * 2; x < 31; x += 4) p.px(x, y, '#ffd3df');
  if (!k.locked) {
    k.anim = (q, t, tint) => {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.22 + i / 3) % 1;
        q.px(16 + i * 3 + Math.round(Math.sin(t * 2 + i)), 24 - u * 10, mul('#f8e3c6', tint));
      }
    };
  }
};

BUILD.factory = (k) => {
  const { p } = k;
  p.rect(29, 0, 5, 20, '#d9534f');
  p.rect(29, 0, 1, 20, '#ef7a6f');
  for (const y of [3, 9]) p.rect(29, y, 5, 2, '#fffaf0');
  p.rect(28, 0, 7, 1, '#7a4f33');
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 9;
    for (let c = 0; c < 9; c++) {
      const top = 10 + Math.round((c * 7) / 8);
      p.rect(x0 + c, top, 1, 19 - top, c === 2 ? '#b6b5c8' : '#9a99ae');
    }
    p.vGradient(x0, 10, 2, 8, [GLASS_A, GLASS_B]);
    k.wins.push([x0, 10, 2, 8]);
  }
  p.rect(1, 18, 36, 1, '#6f6886');
  wall(k, 2, 19, 35, 27, '#e7b98a', '#c8915f');
  for (let y = 21; y < 45; y += 3) for (let x = 3 + ((y / 3) % 2) * 3; x < 33; x += 6) p.rect(x, y, 2, 1, '#d6a575');
  p.disc(12, 24, 3, '#f4c24f');
  for (const [x, y] of [[12, 20], [12, 28], [8, 24], [16, 24]]) p.px(x, y, '#f4c24f');
  p.disc(12, 24, 1, '#c8915f');
  p.rect(5, 29, 14, 17, '#4a4458');
  p.rect(6, 31, 12, 15, '#c3c2d1');
  for (let y = 32; y < 46; y += 2) p.rect(6, y, 12, 1, '#a3a2b5');
  for (let x = 0; x < 12; x++) p.px(6 + x, 30, x % 4 < 2 ? '#ffd75e' : '#3d2a1f');
  win(k, 23, 23, 4, 4, '#fffaf0', false);
  win(k, 30, 23, 4, 4, '#fffaf0', false);
  door(k, 26, 35, 6, 11, '#7a8fc9', '#5c6b99');
  if (!k.locked) k.anim = smoke(31, -1, 5);
};

BUILD.realestate = (k) => {
  const { p } = k;
  gable(k, 25, 1, 5, 4, '#f4c24f', '#d79c1c');
  p.rect(22, 5, 7, 2, '#f4c24f');
  p.px(25, 5, '#9b6238');
  cornice(k, 13, 7, 25, '#4fae93', '#8fd3bf');
  wall(k, 14, 9, 23, 35, '#cdeee0', '#a7dcc6');
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) win(k, 17 + col * 6, 12 + row * 7, 4, 4, '#fffaf0', false);
  p.rect(20, 33, 11, 2, '#4fae93');
  p.rect(21, 35, 9, 9, '#3d8f78');
  glass(k, 22, 36, 3, 8);
  glass(k, 26, 36, 3, 8);
  p.rect(3, 27, 1, 17, '#8a5a3a');
  p.rect(11, 27, 1, 17, '#8a5a3a');
  p.rect(1, 13, 13, 15, '#fffaf0');
  p.rect(1, 13, 13, 8, '#e84a5f');
  drawText(p, 'BAN', 2, 15, '#fffaf0');
  p.px(8, 14, '#fffaf0');
  p.px(4, 23, '#4fae93');
  p.rect(3, 24, 3, 1, '#4fae93');
  p.rect(3, 25, 3, 2, '#4fae93');
  p.rect(8, 23, 4, 1, '#b9b2a6');
  p.rect(8, 25, 4, 1, '#b9b2a6');
  p.rect(1, 42, 13, 2, '#92cf76');
};

BUILD.arena = (k) => {
  const { p } = k;
  for (let y = 1; y < 8; y++) {
    const half = y < 5 ? 5 : 5 - (y - 4);
    p.rect(19 - half, y, half * 2 + 1, 1, '#ffcf4a');
  }
  for (const x of [12, 25]) {
    p.rect(x, 2, 2, 1, '#ffcf4a');
    p.px(x + (x < 19 ? 0 : 1), 3, '#ffcf4a');
    p.rect(x, 4, 2, 1, '#ffcf4a');
  }
  p.rect(15, 2, 1, 3, '#fff3b0');
  p.px(19, 3, '#fff3b0');
  p.rect(18, 8, 3, 3, '#e09a1f');
  p.rect(16, 11, 7, 2, '#ffcf4a');
  p.rect(15, 13, 9, 3, '#9b6238');
  p.rect(15, 13, 9, 1, '#c8915f');
  k.glows.push([19, 6, 8, 'rgba(255, 220, 120, 0.12)']);
  for (const x of [2, 36]) {
    p.rect(x, 6, 1, 16, '#6f6886');
    p.rect(x - 2, 3, 5, 3, '#e6edf4');
    p.rect(x - 2, 3, 5, 1, '#9fa8bd');
    k.glows.push([x, 5, 9, 'rgba(255, 250, 220, 0.16)']);
  }
  for (let c = 0; c < 35; c++) {
    const top = 22 - Math.round(Math.sin((c / 34) * Math.PI) * 6);
    p.rect(2 + c, top, 1, 48 - top, c > 30 ? '#efc9a2' : '#fde2c4');
    p.px(2 + c, top, '#fffaf0');
    p.rect(2 + c, top + 2, 1, 2, c % 6 < 3 ? '#d9708a' : '#f4a3b4');
  }
  for (const x of [4, 8, 28, 32]) {
    p.rect(x, 29, 3, 6, '#5c4033');
    p.px(x, 29, '#fde2c4');
    p.px(x + 2, 29, '#fde2c4');
  }
  p.rect(2, 37, 35, 1, '#efc9a2');
  p.rect(14, 25, 11, 3, '#d9708a');
  p.px(19, 26, '#fff1a8');
  p.ellipse(19, 32, 6, 3, '#f4c24f');
  p.rect(13, 32, 13, 16, '#f4c24f');
  p.ellipse(19, 32, 5, 2, '#5c4033');
  p.rect(14, 32, 11, 16, '#5c4033');
  for (let x = 15; x < 25; x += 2) p.rect(x, 33, 1, 15, '#7a5a44');
};

/** Lò rèn: tường đá, ống khói bốc khói, cửa lò đỏ rực, biển đe treo. */
BUILD.forge = (k) => {
  const { p } = k;
  p.rect(27, 2, 6, 16, '#8b8698');
  p.rect(27, 2, 1, 16, '#a7a3b3');
  p.rect(26, 1, 8, 2, '#5c5870');
  for (let y = 5; y < 18; y += 3) p.rect(28 + (y % 2), y, 3, 1, '#77728a');
  gable(k, 17, 8, 16, 11, '#6e5a4e', '#57463c', '#8a7466');
  p.rect(1, 19, 37, 1, '#3d2f28');
  wall(k, 3, 20, 33, 24, '#b9b3c4', '#9a94a8');
  for (let y = 22; y < 43; y += 3) for (let x = 4 + ((y / 3) % 2) * 3; x < 33; x += 6) p.rect(x, y, 4, 1, '#a49eb2');
  // cửa lò: vòm đỏ rực
  p.rect(5, 28, 13, 16, '#4a4458');
  p.ellipse(11, 28, 6, 3, '#4a4458');
  p.rect(6, 29, 11, 15, '#3a1f18');
  p.vGradient(7, 32, 9, 12, ['#ffb347', '#ff7a2f', '#e8452c']);
  for (const x of [8, 11, 14]) p.rect(x, 30 + (x % 3), 1, 2, '#ffd27a');
  k.glows.push([11, 37, 9, 'rgba(255, 140, 60, 0.22)']);
  // biển đe treo
  p.rect(22, 21, 1, 3, '#4a4458');
  p.rect(32, 21, 1, 3, '#4a4458');
  p.rect(21, 24, 13, 6, '#7a4f33');
  p.rect(21, 24, 13, 1, '#9b6238');
  p.rect(24, 26, 7, 1, '#2e2a38');
  p.rect(25, 27, 5, 1, '#2e2a38');
  p.rect(26, 28, 3, 1, '#2e2a38');
  p.px(23, 26, '#2e2a38');
  win(k, 22, 33, 4, 4, '#fffaf0', false);
  door(k, 29, 33, 6, 11, '#7a5a44', '#5c4033');
  if (!k.locked) k.anim = smoke(30, 0, 5);
};

/** Tiệm vật liệu: quầy gỗ, mái hiên xanh lá, thùng hàng và bao tải trước cửa. */
BUILD.matshop = (k) => {
  const { p } = k;
  cornice(k, 1, 4, 37, '#9b6238', '#c8915f');
  wall(k, 2, 6, 35, 30, '#e9c99c', '#cfa874');
  for (let x = 3; x < 35; x += 4) p.rect(x, 6, 1, 30, '#ddb784');
  p.rect(6, 8, 27, 6, '#5c4033');
  p.rect(7, 9, 25, 4, '#fff1dc');
  for (const [x, c] of [[9, '#79c25a'], [13, '#c8915f'], [17, '#f4c24f'], [21, '#9fa8bd'], [25, '#d9708a'], [29, '#79c25a']]) p.rect(x, 10, 2, 2, c);
  awning(k, 2, 15, 35, 3, '#5aa860', '#e8f5dc');
  win(k, 5, 22, 9, 7, '#7a4f33', false);
  for (const [x, c] of [[6, '#c8915f'], [9, '#f4c24f'], [12, '#79c25a']]) p.rect(x, 26, 2, 3, c);
  door(k, 17, 23, 7, 13, '#7a4f33', '#5c4033');
  // thùng gỗ và bao tải
  for (const [x, y, w, h] of [[26, 29, 6, 7], [32, 31, 5, 5], [28, 24, 5, 5]]) {
    p.rect(x, y, w, h, '#b07a48');
    p.rect(x, y, w, 1, '#d19a64');
    p.rect(x, y + Math.floor(h / 2), w, 1, '#8a5a34');
    p.rect(x + Math.floor(w / 2), y, 1, h, '#8a5a34');
  }
  p.ellipse(5, 33, 3, 3, '#e4d3b0');
  p.rect(4, 30, 3, 1, '#c9b48a');
  p.ellipse(10, 34, 2, 2, '#d8c49c');
};

/** Đấu trường: vòng đá nhiều tầng vòm, cờ gia tộc bay trên đỉnh. */
BUILD.colosseum = (k) => {
  const { p } = k;
  const flags = [[6, '#e2493b'], [19, '#4f8fd6'], [32, '#3fa860']];
  for (const [x] of flags) p.rect(x, 2, 1, 12, '#6f6886');
  for (let c = 0; c < 37; c++) {
    const top = 14 - Math.round(Math.sin((c / 36) * Math.PI) * 4);
    p.rect(1 + c, top, 1, 50 - top, c > 32 ? '#c9b89e' : '#e6d6bb');
    p.px(1 + c, top, '#f5ead6');
  }
  for (const y of [20, 32, 44]) p.rect(1, y, 37, 1, '#b8a68a');
  for (const [y, h] of [[23, 7], [35, 8]]) {
    for (let x = 3; x < 36; x += 6) {
      p.rect(x, y, 4, h, '#7a6650');
      p.px(x, y, '#e6d6bb');
      p.px(x + 3, y, '#e6d6bb');
      p.rect(x + 1, y + 1, 2, h - 1, '#5c4a38');
    }
  }
  p.rect(15, 35, 9, 15, '#4a3a2c');
  p.ellipse(19, 35, 4, 2, '#4a3a2c');
  for (let x = 16; x < 24; x += 2) p.rect(x, 36, 1, 14, '#6e5a46');
  k.glows.push([19, 22, 8, 'rgba(255, 220, 140, 0.12)']);
  if (!k.locked) k.anim = (q, t, tint) => {
    for (const [x, color] of flags) {
      for (let i = 0; i < 5; i++) {
        const dy = Math.round(Math.sin(t * 4 + i * 0.9 + x) * 0.8);
        q.rect(x + 1 + i, 2 + dy, 1, 4 - (i > 3 ? 1 : 0), mul(color, tint));
      }
    }
  };
};

/** Ô trống: vài cái cây cho phố khỏi hở. */
BUILD.filler = (k) => {
  grassLot(k, 29);
  const tree = roundTree(8, k.seed);
  k.decor.push([tree, 1, k.h - tree.height]);
  const pine = pineTree(22);
  k.decor.push([pine, 22, k.h - pine.height]);
  k.decor.push([bush(3, k.seed + 1, '#ff8fb1'), 13, k.h - 10]);
};

// ---------------------------------------------------------------- dựng một toà hoàn chỉnh

const isLit = (time) => time === 'night' || time === 'dusk';

function firstSolidRow(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) return y;
  return 0;
}

const LIT_RGB = new Map(Object.entries(GLASS).map(([from, to]) => [hexToRgb(from).join(), hexToRgb(to)]));

/** Thắp ngẫu nhiên một phần ô kính (so màu trên bản chưa phủ để giữ rèm, kệ hàng). Trả về tâm các ô đã thắp. */
function lightWindows(art, raw, k, chance) {
  const w = art.width;
  const src = raw.getContext('2d').getImageData(0, 0, w, raw.height).data;
  const g = art.getContext('2d');
  const out = g.getImageData(0, 0, w, art.height);
  const lit = [];
  for (const [x0, y0, ww, hh] of k.wins) {
    if (k.rand() > chance) continue;
    const left = x0 + 1;
    const top = y0 + 1 + HEAD;
    lit.push([left + ww / 2, top + hh / 2, Math.max(ww, hh)]);
    for (let y = top; y < top + hh; y++) {
      for (let x = left; x < left + ww; x++) {
        const i = (y * w + x) * 4;
        const to = LIT_RGB.get(`${src[i]},${src[i + 1]},${src[i + 2]}`);
        if (to) [out.data[i], out.data[i + 1], out.data[i + 2]] = to;
      }
    }
  }
  g.putImageData(out, 0, 0);
  return lit;
}

/** Vẽ toà `kind` lên canvas (KW+2)×(h+2+HEAD), chân toà ở hàng cuối. */
export function renderBuilding(kind, { locked, time, seed }) {
  const h = HEIGHT[kind] ?? HEIGHT.filler;
  const k = kit(h, seed, locked);
  (BUILD[kind] ?? BUILD.filler)(k);
  const body = outline(k.c);
  for (const [img, x, y] of k.decor) body.getContext('2d').drawImage(img, x + 1, y + 1);
  const [raw, rg] = makeCanvas(body.width, body.height + HEAD);
  rg.drawImage(body, 0, HEAD);
  if (locked) greyOut(raw);
  const art = tinted(raw, TINTS[time]);
  let lit = [];
  if (!locked && isLit(time)) lit = lightWindows(art, raw, k, time === 'night' ? 0.75 : 0.4);
  if (locked) {
    const lock = PADLOCK();
    art.getContext('2d').drawImage(lock, 20 - Math.floor(lock.width / 2), HEAD + Math.round(h * 0.55) - 4);
  }
  return { art, k, h, lit, top: firstSolidRow(art) };
}

// ---------------------------------------------------------------- nền phố

const LAMPS = [2, 4, 6, 8].map((s) => slotLeft(s) - 1).concat([slotLeft(0) + 4, slotLeft(SLOTS - 1) + SLOT_W - 5]);

function walkway(p, y0, y1) {
  p.rect(0, y0, W, y1 - y0, '#ead6b4');
  p.rect(0, y0, W, 1, '#f5e6c8');
  for (let y = y0 + 2; y < y1; y += 3) {
    p.rect(0, y, W, 1, '#dfc79f');
    for (let x = ((y - y0) % 2) * 4; x < W; x += 8) p.rect(x, y - 2, 1, 2, '#dfc79f');
  }
}

function drawStreetContent() {
  const [c, g] = makeCanvas(W, H);
  const p = new Pen(g);
  const rand = seeded(17);

  for (let x = 0; x < W; x++) {
    const far = 40 - Math.round(7 + 3 * Math.sin(x / 31 + 0.5) + 2 * Math.sin(x / 11));
    p.rect(x, far, 1, 60, '#b5dca3');
    p.px(x, far, '#cbeabd');
    const near = 47 - Math.round(3 + 3 * Math.sin(x / 19 + 2) + 1.5 * Math.sin(x / 7));
    p.rect(x, near, 1, 60, '#9fd28a');
  }
  p.vGradient(0, 50, W, 42, ['#9fd28a', '#92cf76', '#86c96c']);
  for (let x = -4; x < W; x += 13 + Math.floor(rand() * 9)) {
    const img = rand() < 0.35 ? pineTree(14 + Math.floor(rand() * 6)) : roundTree(4 + Math.floor(rand() * 3), x + 50);
    g.drawImage(img, x, 54 - img.height + Math.floor(rand() * 3));
  }
  for (let s = 0; s <= SLOTS; s++) {
    const img = s % 2 ? roundTree(6, s + 70) : bush(4, s + 80, s % 4 ? null : '#ff8fb1');
    g.drawImage(img, slotLeft(s) - Math.floor(img.width / 2), 93 - img.height);
  }

  walkway(p, 92, 100);
  p.rect(0, 99, W, 1, '#c4b29a');

  // mặt đường, vạch chia làn, vạch qua đường
  p.rect(0, ROAD[0], W, ROAD[1] - ROAD[0], '#6e6880');
  for (let k = 0; k < 900; k++) p.px(rand() * W, ROAD[0] + rand() * 26, rand() < 0.5 ? '#655f77' : '#7a7490');
  p.rect(0, ROAD[0], W, 1, '#57526a');
  p.rect(0, 102, W, 1, '#8a84a0');
  p.rect(0, 124, W, 1, '#8a84a0');
  const cross = [Math.round(W / 2) - 9, Math.round(W / 2) + 11];
  for (let x = 3; x < W; x += 14) if (x + 7 < cross[0] || x > cross[1]) p.rect(x, 112, 7, 1, '#fff1c4');
  for (let x = cross[0]; x < cross[1]; x += 4) p.rect(x, 104, 2, 19, '#e4e0ee');

  walkway(p, 126, 133);
  p.rect(0, 126, W, 1, '#c4b29a');

  // bãi cỏ sau dãy nhà trước, bờ rào cây
  p.vGradient(0, 133, W, 55, ['#a6d98b', '#92cf76', '#84c76a']);
  for (let y = 138; y < 188; y++) for (let x = 0; x < W; x++) if (rand() < 0.03) p.px(x, y, rand() < 0.6 ? '#74b85c' : '#b2e195');
  for (let s = 0; s <= SLOTS; s++) {
    const img = s % 2 ? pineTree(18) : roundTree(5, s + 90);
    g.drawImage(img, slotLeft(s) - Math.floor(img.width / 2), 160 - img.height);
  }
  for (let x = 0; x < W; x++) {
    const top = 133 + (Math.sin(x * 0.9) > 0.3 ? 0 : 1);
    p.rect(x, top, 1, 5 - (top - 133), '#79c25a');
    p.px(x, top, (x % 3) ? '#a6dc7c' : '#79c25a');
    p.px(x, 137, '#4f9a43');
  }
  p.rect(0, 138, W, 1, '#2e1d14');

  // lối gạch và cỏ dưới cùng
  p.rect(0, 188, W, 5, '#e3c29a');
  p.rect(0, 188, W, 1, '#f0d6b4');
  p.rect(0, 190, W, 1, '#d4b088');
  for (let x = 0; x < W; x += 6) {
    p.px(x, 189, '#c9a47a');
    p.rect(x + 3, 191, 1, 2, '#c9a47a');
  }
  p.vGradient(0, 193, W, 7, ['#92cf76', '#84c76a']);
  return c;
}

const HYDRANT = () => bitmap([
  '.RRR.',
  '.rrr.',
  'rrrrr',
  '.rwr.',
  '.rrr.',
  'rrrrr',
], { R: '#ff8f9a', r: '#e84a5f', w: '#fffaf0' }, '#2e1d14');

const BIN = () => bitmap([
  'mmmmm',
  '.MMM.',
  '.MmM.',
  '.MMM.',
  '.MMM.',
], { m: '#8fd3bf', M: '#4fae93' }, '#2e1d14');

/** Đèn đường, trụ cứu hoả, thùng rác trên vỉa hè sau: đứng trước dãy nhà sau. */
function drawStreetFurniture(time) {
  const [c, g] = makeCanvas(W, H);
  const lit = isLit(time);
  for (const x of LAMPS) {
    const img = streetLamp(lit);
    g.drawImage(img, x - Math.floor(img.width / 2), 101 - img.height);
  }
  for (const [s, make] of [[1, HYDRANT], [5, BIN], [7, HYDRANT], [3, BIN], [9, BIN]]) {
    const img = make();
    g.drawImage(img, slotLeft(s) + (s % 4 === 1 ? -3 : 1), 100 - img.height);
  }
  return c;
}

// ---------------------------------------------------------------- xe cộ

const CAR = [
  '....bbbbbbb.....',
  '...bwwbwwwwb....',
  '..bwwwbwwwwwb...',
  'bbbbbbbbbbbbbbb.',
  'rbbbbbbbbbbbbbbh',
  'dddddddddddddddd',
  '..tgt.....tgt...',
  '..ttt.....ttt...',
];
const SCOOTER = [
  '.....HH.....',
  '....HHHs....',
  '.....cc.....',
  '....cccc.S..',
  '....ccc..S..',
  '..bbbbbbbbS.',
  'rbbbbbbbbbbh',
  '.ttt....ttt.',
  '.tgt....tgt.',
  '..t......t..',
];
const WHEELS = { t: '#2e1d14', g: '#a3a2b5', r: '#e84a5f', h: '#fff1a8' };

const car = (b, d) => bitmap(CAR, { ...WHEELS, b, d, w: '#bfe3f2' }, '#2e1d14');
const scooter = (b, H, c) => bitmap(SCOOTER, { ...WHEELS, b, H, c, s: '#f6d2a8', S: '#4a4458' }, '#2e1d14');

function bus() {
  const [c, g] = makeCanvas(28, 12);
  const p = new Pen(g);
  p.rect(1, 0, 26, 1, '#8fd3bf');
  p.rect(0, 1, 28, 8, '#8fd3bf');
  p.rect(0, 1, 28, 1, '#bfe8d8');
  for (let x = 2; x < 21; x += 5) p.rect(x, 2, 4, 3, '#bfe3f2');
  p.rect(23, 2, 4, 4, '#bfe3f2');
  p.rect(0, 6, 28, 1, '#fffaf0');
  p.rect(0, 8, 28, 1, '#4fae93');
  p.px(27, 7, '#fff1a8');
  p.px(0, 7, '#e84a5f');
  for (const x of [4, 20]) {
    p.rect(x, 9, 4, 3, '#2e1d14');
    p.rect(x + 1, 10, 2, 1, '#a3a2b5');
  }
  return outline(c);
}

const LANES = [{ y: 111, speed: 13, dir: -1 }, { y: 124, speed: 17, dir: 1 }];

function makeTraffic(time) {
  const makers = [
    () => car('#f4a3b4', '#d9708a'), () => scooter('#8fd3bf', '#ffd75e', '#e98a8a'),
    () => scooter('#f39b4a', '#fffaf0', '#8ab8e9'), () => car('#ffd75e', '#e0b23a'),
    bus, () => car('#8ab8e9', '#5f8fc9'),
    () => car('#fff1dc', '#d9c4a3'), () => scooter('#ff8fb1', '#4fae93', '#fff1dc'),
  ];
  return makers.map((make, i) => {
    const lane = i % 2;
    const img = tinted(make(), TINTS[time]);
    return { img: LANES[lane].dir < 0 ? flipped(img) : img, lane, x0: Math.floor(i / 2) * 101 + lane * 43, bob: img.height < 13 && img.width < 15 };
  });
}

// ---------------------------------------------------------------- gắn bản đồ

function makeFlowers() {
  const rand = seeded(42);
  const colors = [['#ff7a9c', '#ffc2d1'], ['#ffd75e', '#fff1b0'], ['#ffffff', '#e8eefc'], ['#b48cf2', '#dcc8ff']];
  return Array.from({ length: 46 }, () => {
    const [color, light] = colors[Math.floor(rand() * colors.length)];
    return { x: Math.round(2 + rand() * (W - 4)), y: Math.round(197 + rand() * 3), color, light, phase: rand() * 6 };
  });
}

const BIRD = [[[-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1]], [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]]];

/**
 * Gắn bản đồ phố vào `container`. `places`: [{ id, name, icon, row, slot, kind, unlocked, lockText, badge? }],
 * `onSelect(id)` gọi khi bấm một nơi đã mở. Trả về { update(places), destroy() }.
 */
export function mountTownMap(container, { places = [], onSelect } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'tm-wrap';
  wrap.style.aspectRatio = `${WORLD_W} / ${WORLD_H}`;
  const world = document.createElement('div');
  world.className = 'tm-world';
  world.style.width = `${WORLD_W}px`;
  world.style.height = `${WORLD_H}px`;
  wrap.append(world);
  container.append(wrap);

  // Thứ tự lớp: nền → mây → dãy sau → đèn đường → xe → dãy trước → hoa → ánh sáng → nhãn & nút.
  const bg = makeLayer(world, 'tm-bg', W, H);
  const sky = makeLayer(world, 'tm-sky', W, H);
  const slots = [];
  const addRow = (row) => {
    for (let slot = 0; slot < SLOTS; slot++) {
      const el = document.createElement('div');
      el.className = 'tm-slot';
      world.append(el);
      slots.push({ key: `${row}:${slot}`, row, slot, el, artKey: null, place: null, anim: null, tipTimer: 0 });
    }
  };
  addRow(0);
  const mid = makeLayer(world, 'tm-mid', W, H);
  const road = makeLayer(world, 'tm-road', W, H);
  addRow(1);
  const front = makeLayer(world, 'tm-front', W, H);
  const glow = makeLayer(world, 'scene-glow tm-glow', W, H);
  const ui = document.createElement('div');
  ui.className = 'tm-ui';
  world.append(ui);

  for (const e of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tm-place';
    btn.hidden = true;
    btn.innerHTML = `
      <span class="tm-tag" aria-hidden="true">
        <span class="tm-badge pixel-box" hidden></span>
        <span class="tm-label pixel-box"><i></i><b></b></span>
        <span class="tm-tip pixel-box"></span>
      </span>`;
    btn.classList.toggle('edge-l', e.slot === 0);
    btn.classList.toggle('edge-r', e.slot === SLOTS - 1);
    const hot = (on) => e.el.classList.toggle('hot', on);
    btn.addEventListener('pointerenter', () => hot(true));
    btn.addEventListener('pointerleave', () => hot(btn === document.activeElement && btn.matches(':focus-visible')));
    btn.addEventListener('focus', () => hot(btn.matches(':focus-visible')));
    btn.addEventListener('blur', () => hot(false));
    ui.append(btn);
    Object.assign(e, {
      btn,
      badge: btn.querySelector('.tm-badge'),
      icon: btn.querySelector('.tm-label i'),
      name: btn.querySelector('.tm-label b'),
      tip: btn.querySelector('.tm-tip'),
    });
  }

  let time = null;
  let current = [];
  let clouds = [];
  let stars = [];
  let traffic = [];
  let glowStatic = null;
  const flowers = makeFlowers();
  const rand = seeded(99);
  const birds = Array.from({ length: 3 }, (_, i) => ({ x0: i * 47, y: 8 + i * 5, speed: 6 + i * 1.5, phase: rand() * 6 }));

  /** Vẽ lại toà trong một ô (khi đổi loại nhà, khoá/mở hoặc đổi giờ). */
  function renderSlot(e, place) {
    const kind = place ? place.kind : 'filler';
    const seed = 11 + e.row * 31 + e.slot * 7;
    const r = renderBuilding(kind, { locked: !!place && !place.unlocked, time, seed });
    const base = BASE[e.row];
    const topArt = base - 1 - r.h - HEAD;
    e.el.replaceChildren();
    e.el.style.left = `${(slotLeft(e.slot) - 2) * PX}px`;
    e.el.style.top = `${topArt * PX}px`;
    e.el.style.width = `${r.art.width * PX}px`;
    e.el.style.height = `${r.art.height * PX}px`;
    const show = (c, cls) => {
      c.className = `px-layer ${cls}`;
      c.style.width = `${c.width * PX}px`;
      c.style.height = `${c.height * PX}px`;
      e.el.append(c);
    };
    show(r.art, 'tm-art');
    e.anim = null;
    if (r.k.anim) {
      const [c, g] = makeCanvas(r.art.width, r.art.height);
      show(c, 'tm-anim');
      e.anim = { c, g, p: new Pen(g), draw: r.k.anim };
    }
    e.built = r;
    e.topArt = topArt;
    const hitTop = topArt + r.top;
    Object.assign(e.btn.style, {
      left: `${slotLeft(e.slot) * PX}px`,
      top: `${hitTop * PX}px`,
      width: `${SLOT_W * PX}px`,
      height: `${(base + 1 - hitTop) * PX}px`,
    });
  }

  function syncButton(e, place) {
    const { btn } = e;
    btn.hidden = !place;
    if (!place) return;
    const locked = !place.unlocked;
    btn.dataset.id = place.id;
    btn.classList.toggle('locked', locked);
    btn.setAttribute('aria-label', locked
      ? `${place.name} (đang khoá${place.lockText ? `: ${place.lockText}` : ''})`
      : `${place.name}${place.badge ? ` – ${place.badge}` : ''}`);
    if (locked) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
    e.icon.textContent = locked ? '🔒' : place.icon ?? '';
    e.name.textContent = place.name ?? '';
    e.badge.hidden = !place.badge;
    e.badge.textContent = place.badge ?? '';
    e.tip.textContent = place.lockText || 'Chưa mở khoá';
  }

  function buildGlow() {
    const [c, g] = makeCanvas(W, H);
    const p = new Pen(g);
    if (isLit(time)) {
      for (const e of slots) {
        if (!e.built) continue;
        const ox = slotLeft(e.slot) - 2;
        for (const [x, y, r] of e.built.lit) {
          p.disc(ox + x, e.topArt + y, Math.round(r * 0.8) + 3, 'rgba(255, 205, 120, 0.08)');
          p.disc(ox + x, e.topArt + y, Math.round(r * 0.5) + 1, 'rgba(255, 220, 150, 0.12)');
        }
        if (e.built.k.locked) continue;
        for (const [x, y, r, color] of e.built.k.glows) p.disc(ox + x + 1, e.topArt + HEAD + 1 + y, r, color);
      }
    }
    glowStatic = c;
  }

  function update(next = []) {
    current = Array.isArray(next) ? next : [];
    const byKey = new Map();
    for (const pl of current) {
      if (pl && (pl.row === 0 || pl.row === 1) && pl.slot >= 0 && pl.slot < SLOTS) byKey.set(`${pl.row}:${pl.slot}`, pl);
    }
    let rebuilt = false;
    for (const e of slots) {
      const place = byKey.get(e.key) ?? null;
      const artKey = place ? `${place.kind}|${place.unlocked ? 1 : 0}` : 'filler';
      if (artKey !== e.artKey) {
        renderSlot(e, place);
        e.artKey = artKey;
        rebuilt = true;
      }
      e.place = place;
      syncButton(e, place);
    }
    if (rebuilt) buildGlow();
    fitTags();
  }

  /** Đẩy nhãn ở hai mép vào trong cho khỏi bị cắt. */
  function fitTags() {
    const k = parseFloat(world.style.getPropertyValue('--tm-k')) || 1;
    for (const e of slots) {
      if (!e.place) continue;
      const tag = e.btn.firstElementChild;
      const half = (tag.offsetWidth * k) / 2;
      const cx = (slotLeft(e.slot) + SLOT_W / 2) * PX;
      const dx = Math.max(0, 4 - (cx - half)) + Math.min(0, WORLD_W - 4 - (cx + half));
      const top = e.btn.offsetTop - 4 - tag.offsetHeight * k;
      tag.style.setProperty('--tm-dx', `${Math.round(dx)}px`);
      tag.style.setProperty('--tm-dy', `${Math.max(0, Math.round(4 - top))}px`);
    }
  }

  function build() {
    time = timeOfDay();
    world.dataset.time = time;
    bg.g.clearRect(0, 0, W, H);
    drawSky(bg.p, 0, 0, W, 52, time, seeded(3));
    const sun = { dawn: [36, 20], day: [W - 32, 13], dusk: [58, 22], night: [44, 12] }[time];
    drawSunOrMoon(bg.p, sun[0], sun[1], time, 7);
    bg.g.drawImage(tinted(drawStreetContent(), TINTS[time]), 0, 0);
    mid.g.clearRect(0, 0, W, H);
    mid.g.drawImage(tinted(drawStreetFurniture(time), TINTS[time]), 0, 0);
    clouds = [[30, 2, 1.4], [20, 12, 2.2], [34, 5, 1.0], [18, 14, 2.7]].map(([w, y, speed], i) => ({
      img: cloud(w, i + 1, CLOUD[time]), y, speed, x0: i * 97,
    }));
    stars = time === 'night' ? Array.from({ length: 12 }, () => ({ x: Math.round(rand() * W), y: Math.round(2 + rand() * 22), phase: rand() * 6 })) : [];
    traffic = makeTraffic(time);
    for (const e of slots) e.artKey = null;
    update(current);
  }

  function draw(t) {
    const tint = TINTS[time];
    const { g, p } = sky;
    g.clearRect(0, 0, W, H);
    for (const s of stars) if (Math.sin(t * 2.5 + s.phase) > 0.55) {
      p.px(s.x - 1, s.y, '#fffbe0'); p.px(s.x + 1, s.y, '#fffbe0'); p.px(s.x, s.y - 1, '#fffbe0'); p.px(s.x, s.y + 1, '#fffbe0');
    }
    for (const cl of clouds) {
      const span = W + cl.img.width * 2;
      g.drawImage(cl.img, Math.round(((cl.x0 + t * cl.speed) % span) - cl.img.width), cl.y);
    }
    if (time !== 'night') {
      for (const b of birds) {
        const x = Math.round(((b.x0 + t * b.speed) % (W + 40)) - 20);
        const y = Math.round(b.y + Math.sin(t * 0.9 + b.phase) * 2);
        for (const [dx, dy] of BIRD[Math.floor(t * 4 + b.phase) % 2]) p.px(x + dx, y + dy, mul('#5a536b', tint));
      }
    }

    road.g.clearRect(0, 0, W, H);
    const lights = [];
    for (const v of traffic) {
      const lane = LANES[v.lane];
      const s = (v.x0 + t * lane.speed) % (W + 70);
      const x = Math.round(lane.dir > 0 ? s - 35 : W + 35 - s - v.img.width);
      const y = lane.y - v.img.height + (v.bob ? Math.floor(t * 6 + v.x0) % 2 : 0);
      road.g.drawImage(v.img, x, y);
      lights.push([lane.dir > 0 ? x + v.img.width : x, lane.y - 4, lane.dir]);
    }

    front.g.clearRect(0, 0, W, H);
    front.g.globalAlpha = { night: 0.5, dusk: 0.85 }[time] ?? 1;
    for (const f of flowers) {
      const sway = Math.round(Math.sin(t * 1.8 + f.phase) * 0.8);
      front.p.px(f.x, f.y, '#4f9a3f');
      front.p.px(f.x, f.y - 1, '#4f9a3f');
      const hx = f.x + sway;
      const hy = f.y - 3;
      front.p.px(hx - 1, hy, f.color); front.p.px(hx + 1, hy, f.color); front.p.px(hx, hy - 1, f.color); front.p.px(hx, hy + 1, f.color);
      front.p.px(hx, hy, '#ffe26b');
      front.p.px(hx - 1, hy - 1, f.light);
    }
    front.g.globalAlpha = 1;

    for (const e of slots) {
      if (!e.anim) continue;
      const a = e.anim;
      a.g.setTransform(1, 0, 0, 1, 0, 0);
      a.g.clearRect(0, 0, a.c.width, a.c.height);
      a.g.setTransform(1, 0, 0, 1, 1, HEAD + 1);
      a.draw(a.p, t, tint);
    }

    glow.g.clearRect(0, 0, W, H);
    if (isLit(time)) {
      if (glowStatic) glow.g.drawImage(glowStatic, 0, 0);
      const flicker = Math.sin(t * 9) * 0.02;
      for (const x of LAMPS) {
        for (const [r, a] of [[18, 0.07], [11, 0.11], [6, 0.18]]) glow.p.disc(x, 77, r, `rgba(255, 214, 140, ${a + flicker})`);
        glow.p.ellipse(x, 98, 11, 2, 'rgba(255, 220, 150, 0.12)');
      }
      for (const [x, y, dir] of lights) {
        for (let k = 1; k < 9; k++) glow.p.rect(x + dir * k, y - Math.floor(k / 3), 1, 1 + Math.floor(k / 1.5), `rgba(255, 244, 190, ${0.3 - k * 0.03})`);
      }
    }
  }

  function onClick(ev) {
    const btn = ev.target.closest('.tm-place');
    if (!btn) return;
    const e = slots.find((s) => s.btn === btn);
    if (!e?.place) return;
    if (e.place.unlocked) {
      onSelect?.(e.place.id);
      return;
    }
    clearTimeout(e.tipTimer);
    for (const el of [btn, e.el]) {
      el.classList.remove('shake');
      void el.offsetWidth; // chạy lại hoạt ảnh lắc
      el.classList.add('shake');
    }
    btn.classList.add('tip');
    e.tipTimer = setTimeout(() => {
      btn.classList.remove('tip', 'shake');
      e.el.classList.remove('shake');
    }, 2000);
  }
  ui.addEventListener('click', onClick);

  const fit = () => {
    const width = wrap.clientWidth;
    if (!width) return;
    const scale = width / WORLD_W;
    const compact = width < COMPACT_BELOW;
    world.style.transform = `scale(${scale})`;
    wrap.classList.toggle('tm-compact', compact);
    // Nhãn tự phóng to ngược lại để chữ không nhỏ hơn ~10px trên màn hình (biểu tượng ~12px khi thu gọn).
    const k = compact ? Math.max(1, 12 / (15 * scale)) : Math.max(1, 10 / (14 * scale));
    world.style.setProperty('--tm-k', k.toFixed(3));
    fitTags();
  };
  const resize = new ResizeObserver(fit);
  resize.observe(wrap);

  current = places;
  build();
  fit();
  document.fonts?.ready.then(() => wrap.isConnected && fitTags());
  const stop = animate(12, draw);
  const clock = setInterval(() => timeOfDay() !== time && build(), 60_000);

  return {
    update,
    destroy() {
      stop();
      clearInterval(clock);
      resize.disconnect();
      ui.removeEventListener('click', onClick);
      for (const e of slots) clearTimeout(e.tipTimer);
      wrap.remove();
    },
  };
}
