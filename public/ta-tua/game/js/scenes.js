// Cảnh nền pixel art (công viên, căn phòng): một lớp tĩnh vẽ một lần, một lớp chuyển động
// (mây, nước, bướm, hạt bụi...) và một lớp ánh sáng ban đêm. Tông màu đổi theo giờ thật.
import { Pen, bitmap, makeCanvas, outline, seeded, shadeBlob } from './pixel.js';

export function timeOfDay(now = new Date()) {
  const forced = new URLSearchParams(location.search).get('time');
  if (['dawn', 'day', 'dusk', 'night'].includes(forced)) return forced;
  const h = now.getHours();
  if (h >= 19 || h < 5) return 'night';
  if (h < 7) return 'dawn';
  return h < 17 ? 'day' : 'dusk';
}

const SKIES = {
  dawn: ['#a9bde6', '#f2c4c8', '#ffe4c8'],
  day: ['#74c2ea', '#9bd6f1', '#cbeef8'],
  dusk: ['#5a4a98', '#c9739a', '#ffb88a'],
  night: ['#0f1433', '#1b2350', '#2c3770'],
};
/** Màu phủ (multiply) lên mọi thứ trừ bầu trời. */
const TINTS = { dawn: '#fff0e4', day: null, dusk: '#ffcdb8', night: '#6670b8' };
const ROOM_TINTS = { dawn: '#fff4ea', day: null, dusk: '#ffe0cc', night: '#bfa2a8' };
const CLOUD = {
  dawn: ['#fff4ee', '#f3cbd2'],
  day: ['#ffffff', '#d8eaf6'],
  dusk: ['#ffd7c8', '#e3a1b0'],
  night: ['#4d5688', '#3a4274'],
};

const GREEN = { light: '#a6dc7c', mid: '#79c25a', dark: '#4f9a43' };
const BLOSSOM = { light: '#ffe0ea', mid: '#ffb6cb', dark: '#ee8aa9' };

// ---------------------------------------------------------------- hình dựng sẵn

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
  // Các cụm tròn to dần vào giữa, đáy phẳng.
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

function fountain() {
  const [c, g] = makeCanvas(50, 30);
  const p = new Pen(g);
  const cx = 25;
  p.ellipse(cx, 24, 23, 4, '#a9a8bb');
  p.rect(cx - 23, 19, 47, 5, '#bdbccd');
  for (let x = cx - 20; x < cx + 22; x += 7) p.rect(x, 20, 1, 4, '#a3a2b5');
  p.ellipse(cx, 19, 23, 5, '#e2e1ec');
  p.ellipse(cx, 19, 20, 3, '#4fb4dd');
  p.ellipse(cx, 20, 18, 2, '#78cdee');
  p.rect(cx - 2, 7, 5, 12, '#d3d2df');
  p.rect(cx + 1, 7, 2, 12, '#b4b3c4');
  p.ellipse(cx, 7, 8, 2, '#e2e1ec');
  p.ellipse(cx, 7, 6, 1, '#78cdee');
  p.rect(cx - 1, 1, 3, 5, '#d3d2df');
  return outline(c);
}

function bench() {
  const [c, g] = makeCanvas(24, 13);
  const p = new Pen(g);
  p.rect(2, 0, 2, 12, '#6b4229');
  p.rect(20, 0, 2, 12, '#6b4229');
  for (const y of [1, 4]) {
    p.rect(0, y, 24, 2, '#c98f5a');
    p.rect(0, y, 24, 1, '#e3ad78');
  }
  p.rect(0, 8, 24, 2, '#d9a46e');
  p.rect(0, 8, 24, 1, '#f0c48f');
  p.rect(1, 10, 22, 1, '#a8703f');
  return outline(c);
}

function lampPost(lit) {
  const [c, g] = makeCanvas(9, 36);
  const p = new Pen(g);
  p.rect(3, 9, 3, 24, '#4a4458');
  p.rect(3, 9, 1, 24, '#6f6886');
  p.rect(1, 32, 7, 4, '#3b3647');
  p.rect(1, 2, 7, 7, lit ? '#ffe7a0' : '#e6edf4');
  p.rect(2, 3, 2, 4, lit ? '#fffbe2' : '#ffffff');
  p.rect(0, 1, 9, 1, '#3b3647');
  p.rect(3, 0, 3, 1, '#3b3647');
  p.rect(1, 9, 7, 1, '#3b3647');
  return outline(c);
}

function fenceSegment(len) {
  const [c, g] = makeCanvas(len, 10);
  const p = new Pen(g);
  p.rect(0, 2, len, 2, '#d9a46e');
  p.rect(0, 6, len, 2, '#d9a46e');
  p.rect(0, 2, len, 1, '#efc490');
  for (let x = 1; x < len - 2; x += 9) {
    p.rect(x, 0, 3, 10, '#b97e4c');
    p.rect(x, 0, 1, 10, '#dba672');
  }
  return outline(c, '#5b3a24');
}

function cactusPot() {
  const [c, g] = makeCanvas(7, 10);
  const p = new Pen(g);
  p.rect(2, 0, 3, 6, '#6fbf6a');
  p.rect(2, 0, 1, 6, '#9be08f');
  p.rect(0, 2, 2, 2, '#6fbf6a');
  p.rect(5, 1, 2, 2, '#6fbf6a');
  p.rect(1, 6, 5, 4, '#d07a4f');
  p.rect(0, 6, 7, 1, '#e39468');
  return outline(c);
}

function floorLamp(lit) {
  const [c, g] = makeCanvas(15, 46);
  const p = new Pen(g);
  for (let y = 0; y < 9; y++) {
    const half = 4 + Math.round(y * 0.4);
    p.rect(7 - half, y, half * 2 + 1, 1, lit ? '#fff1c4' : '#fbeccb');
    if (y % 3 === 1) p.rect(7 - half, y, half * 2 + 1, 1, lit ? '#ffe39a' : '#f1d9ae');
  }
  p.rect(6, 9, 2, 34, '#7a5a44');
  p.rect(6, 9, 1, 34, '#9c7a60');
  p.ellipse(7, 43, 5, 1, '#5e4434');
  return outline(c);
}

/** Chậu cây lá dài xòe ra như quạt. */
function pottedPlant() {
  const [c, g] = makeCanvas(24, 32);
  const p = new Pen(g);
  const leaves = [[-0.9, 11], [-0.5, 14], [-0.15, 16], [0.2, 15], [0.55, 13], [0.95, 10]];
  for (const [lean, len] of leaves) {
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = 12 + Math.sin(lean) * k * 0.95 + lean * t * t * 4;
      const y = 19 - Math.cos(lean) * k * 0.95 + t * t * 3;
      const w = t < 0.15 ? 1 : t > 0.85 ? 1 : 2;
      p.rect(x, y, w, 1, k % 4 === 0 ? '#86cf72' : '#5fae5a');
      if (w === 2) p.px(x + 1, y, '#3f8a43');
    }
  }
  for (let y = 0; y < 11; y++) {
    const half = 6 - Math.floor(y / 4);
    p.rect(12 - half, 20 + y, half * 2 + 1, 1, '#d07a4f');
    p.rect(12 + half - 1, 20 + y, 2, 1, '#b5643d');
  }
  p.rect(4, 19, 17, 3, '#e39468');
  p.rect(4, 19, 17, 1, '#f2ad83');
  return outline(c);
}

const BUTTERFLY_FRAMES = [
  ['ww.ww', 'wwbww', '.wbw.', '.w.w.'],
  ['.w.w.', '..b..', '..b..', '.....'],
];
const butterflies = (color) => BUTTERFLY_FRAMES.map((rows) => bitmap(rows, { w: color, b: '#3d2a1f' }));

// ---------------------------------------------------------------- tiện ích dựng lớp

function makeLayer(parent, cls, w, h, px) {
  const [c, g] = makeCanvas(w, h);
  c.className = `px-layer ${cls}`;
  c.style.width = `${w * px}px`;
  c.style.height = `${h * px}px`;
  parent.append(c);
  return { c, g, p: new Pen(g) };
}

function resizeLayer(layer, w, h, px) {
  layer.c.width = w;
  layer.c.height = h;
  layer.c.style.width = `${w * px}px`;
  layer.c.style.height = `${h * px}px`;
  layer.g.imageSmoothingEnabled = false;
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

/** Vạch đồng hồ, nước, tia nắng... vẽ bằng đường thẳng pixel. */
function pixelLine(p, x0, y0, x1, y1, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) p.px(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
}

// ---------------------------------------------------------------- công viên

export const PARK_PX = 3;
/** Một đoạn cảnh gốc rộng 334 điểm ảnh (1000 đơn vị thế giới); công viên rộng hơn ghép nhiều đoạn liền nhau. */
const SEG = 334;
const PH = 200;
const HORIZON = 70;

/** Bố cục trong một đoạn (tọa độ trong đoạn). */
const PARK = {
  fountain: { x: 167, y: 104 },
  pond: { x: 46, y: 95, rx: 30, ry: 7 },
  plaza: { x: 167, y: 140, rx: 104, ry: 40 },
  lamps: [[97, 107], [237, 107]],
  benches: [[119, 103], [215, 103]],
  blossom: { x: 72, y: 86 },
};

/** Đổi tọa độ trong đoạn thứ `s` ra tọa độ cả cảnh; đoạn lẻ lật ngang bố cục để hai đoạn liền nhau không lặp y hệt. */
const segX = (s) => (x) => s * SEG + (s % 2 ? SEG - x : x);
const segCount = (pw) => Math.ceil(pw / SEG);

function drawParkContent(time, pw) {
  const [c, g] = makeCanvas(pw, PH);
  const p = new Pen(g);
  const rand = seeded(7);
  const segs = segCount(pw);

  // đồi xa
  for (let x = 0; x < pw; x++) {
    const far = HORIZON - Math.round(10 + 4 * Math.sin(x / 37 + 0.5) + 3 * Math.sin(x / 13));
    p.rect(x, far, 1, HORIZON - far + 2, '#b5dca3');
    p.px(x, far, '#cbeabd');
    const near = HORIZON - Math.round(4 + 3 * Math.sin(x / 23 + 2) + 2 * Math.sin(x / 9));
    p.rect(x, near, 1, HORIZON - near + 2, '#9fd28a');
  }

  // bãi cỏ có vân
  p.vGradient(0, HORIZON, pw, PH - HORIZON, ['#a6d98b', '#92cf76', '#84c76a']);
  for (let y = HORIZON + 1; y < PH; y++) {
    for (let x = 0; x < pw; x++) {
      const r = rand();
      if (r < 0.03) p.px(x, y, '#74b85c');
      else if (r < 0.05) p.px(x, y, '#b2e195');
    }
  }
  for (let k = 0; k < 160 * segs; k++) {
    const x = Math.round(rand() * pw);
    const y = Math.round(HORIZON + 6 + rand() * (PH - HORIZON - 6));
    p.px(x, y, '#66a94f');
    p.px(x - 1, y - 1, '#66a94f');
    p.px(x + 1, y - 1, '#66a94f');
  }

  // lối đi chạy suốt chiều ngang
  const { plaza, pond } = PARK;
  for (let x = 0; x < pw; x++) {
    const y = plaza.y + 6 + Math.round(Math.sin(x / 19) * 2);
    p.rect(x, y - 6, 1, 13, '#d2ae74');
    p.rect(x, y - 5, 1, 11, '#ebd29d');
  }
  const onPath = (x, y) =>
    ((x - plaza.x) / plaza.rx) ** 2 + ((y - plaza.y) / plaza.ry) ** 2 < 0.92 || Math.abs(y - plaza.y - 6) < 4;
  const lit = time === 'night' || time === 'dusk';

  for (let s = 0; s < segs; s++) {
    const X = segX(s);
    // quảng trường
    p.ellipse(X(plaza.x), plaza.y, plaza.rx + 1, plaza.ry + 1, '#d2ae74');
    p.ellipse(X(plaza.x), plaza.y, plaza.rx, plaza.ry, '#ebd29d');
    p.ellipse(X(plaza.x), plaza.y - 1, plaza.rx - 6, plaza.ry - 4, '#f0dbad');
    for (let k = 0; k < 420; k++) {
      const x = Math.round(rand() * SEG);
      const y = Math.round(plaza.y - plaza.ry + rand() * plaza.ry * 2);
      if (onPath(x, y)) p.px(X(x), y, rand() < 0.6 ? '#dcc089' : '#f8ead0');
    }

    // ao sen
    const px = X(pond.x);
    p.ellipse(px, pond.y, pond.rx + 3, pond.ry + 2, '#c9bda7');
    p.ellipse(px, pond.y + 1, pond.rx + 2, pond.ry + 1, '#a99c84');
    p.ellipse(px, pond.y, pond.rx, pond.ry, '#4aa2cf');
    p.ellipse(px, pond.y + 1, pond.rx - 1, pond.ry - 1, '#68c3e6');
    p.ellipse(X(pond.x - 8), pond.y - 1, 8, 1, '#9fdff4');
    for (const [dx, dy] of [[-16, 1], [9, 2], [18, -1]]) {
      p.ellipse(X(pond.x + dx), pond.y + dy, 3, 1, '#5fae4f');
      p.px(X(pond.x + dx + 2), pond.y + dy, '#68c3e6');
    }
    p.rect(X(pond.x + 9), pond.y + 1, 2, 1, '#ffb7cf');

    // hàng cây chân trời (mỗi đoạn một bộ dáng cây khác)
    const k = s * 10;
    const trees = [
      [-6, 80, roundTree(14, 1 + k)],
      [16, 77, pineTree(34 - (s % 2) * 3)],
      [40, 82, roundTree(11, 2 + k)],
      [102, 74, roundTree(8, 3 + k)],
      [232, 74, roundTree(8, 4 + k)],
      [262, 81, roundTree(13, 5 + k)],
      [292, 78, pineTree(32 + (s % 2) * 3)],
      [320, 83, roundTree(15, 6 + k)],
    ];
    for (const [x, y, img] of trees) g.drawImage(img, Math.round(X(x) - img.width / 2), y - img.height);
    const blossom = roundTree(13, 9 + k, BLOSSOM);
    g.drawImage(blossom, X(PARK.blossom.x) - Math.round(blossom.width / 2), PARK.blossom.y - blossom.height);

    for (const [x0, len] of [[92, 44], [218, 50]]) g.drawImage(fenceSegment(len), s % 2 ? X(x0 + len) : X(x0), HORIZON + 4);

    // luống hoa phía sau
    p.ellipse(X(290), 101, 20, 4, '#7b5236');
    p.ellipse(X(290), 100, 19, 3, '#9a6b45');

    for (const [x, y] of PARK.benches) {
      const img = bench();
      g.drawImage(img, X(x) - Math.round(img.width / 2), y - img.height);
    }
    for (const [x, y] of PARK.lamps) {
      const img = lampPost(lit);
      g.drawImage(img, X(x) - Math.round(img.width / 2), y - img.height);
    }
    const fountainImg = fountain();
    g.drawImage(fountainImg, X(PARK.fountain.x) - Math.round(fountainImg.width / 2), PARK.fountain.y - fountainImg.height);

    for (const [x, y, r, berries] of [[6, 202, 9, '#ff8fb1'], [26, 205, 7], [330, 202, 10, '#fff1a8'], [306, 206, 7]]) {
      const img = bush(r, x + y + k, berries);
      g.drawImage(img, X(x) - Math.round(img.width / 2), y - img.height);
    }
  }
  return c;
}

function makeFlowers(pw) {
  const rand = seeded(42);
  const colors = [['#ff7a9c', '#ffc2d1'], ['#ffd75e', '#fff1b0'], ['#ffffff', '#e8eefc'], ['#b48cf2', '#dcc8ff']];
  const spots = [
    [272, 308, 97, 102, 10],
    [4, 42, 160, 196, 7],
    [292, 330, 160, 196, 7],
    [96, 134, 84, 90, 4],
    [222, 266, 84, 90, 4],
  ];
  return Array.from({ length: segCount(pw) }, (_, s) => {
    const X = segX(s);
    return spots.flatMap(([x0, x1, y0, y1, n]) =>
      Array.from({ length: n }, () => {
        const [color, light] = colors[Math.floor(rand() * colors.length)];
        return { x: X(Math.round(x0 + rand() * (x1 - x0))), y: Math.round(y0 + rand() * (y1 - y0)), color, light, phase: rand() * 6 };
      }));
  }).flat();
}

/**
 * Gắn cảnh công viên vào `world` (cao 600, rộng `width` đơn vị thế giới, mặc định 1000). Công viên rộng hơn ghép
 * nhiều đoạn cảnh liền nhau ở cùng cỡ điểm ảnh, không kéo giãn. Trả về hàm dọn dẹp.
 */
export function mountParkScene(world, width = 1000) {
  const PW = Math.ceil(width / PARK_PX);
  const segs = segCount(PW);
  const spots = Array.from({ length: segs }, (_, s) => segX(s));
  const bg = makeLayer(world, 'scene-bg', PW, PH, PARK_PX);
  const amb = makeLayer(world, 'scene-amb', PW, PH, PARK_PX);
  const glow = makeLayer(world, 'scene-glow', PW, PH, PARK_PX);
  world.prepend(bg.c, amb.c);

  let time = null;
  let clouds = [];
  let stars = [];
  let wings = [];
  const flowers = makeFlowers(PW);
  const rand = seeded(99);
  const flies = Array.from({ length: 16 * segs }, () => ({ x: 20 + rand() * (PW - 34), y: 90 + rand() * 100, phase: rand() * 6 }));
  const petals = spots.flatMap((X) => Array.from({ length: 8 }, () => ({ x: X(PARK.blossom.x), phase: rand(), wobble: rand() * 6 })));
  const bugs = spots.flatMap((X) => [['#ffd166', X(120), 120], ['#ff9ec4', X(250), 150], ['#a0d8ff', X(60), 140]]);
  const lamps = spots.flatMap((X) => PARK.lamps.map(([x, y]) => [X(x), y]));

  function build() {
    time = timeOfDay();
    world.dataset.time = time;
    const r = seeded(3);
    bg.g.clearRect(0, 0, PW, PH);
    drawSky(bg.p, 0, 0, PW, HORIZON + 2, time, r);
    drawSunOrMoon(bg.p, time === 'night' ? 60 : time === 'dusk' ? 250 : time === 'dawn' ? 70 : 262, time === 'dusk' ? 50 : 24, time);
    bg.g.drawImage(tinted(drawParkContent(time, PW), TINTS[time]), 0, 0);
    clouds = spots.flatMap((_, s) => [[34, 8, 1.6], [24, 26, 2.4], [42, 14, 1.1], [20, 36, 2.9]].map(([w, y, speed], i) => ({
      img: cloud(w, i + 1 + s * 4, CLOUD[time]), y, speed, x0: i * 97 + s * (SEG + 40),
    })));
    stars = time === 'night' ? Array.from({ length: 10 * segs }, () => ({ x: Math.round(rand() * PW), y: Math.round(rand() * 55), phase: rand() * 6 })) : [];
    wings = bugs.map(([color, x, y]) => ({ frames: butterflies(color), x, y, phase: rand() * 6 }));
  }

  function draw(t) {
    const { g, p } = amb;
    g.clearRect(0, 0, PW, PH);
    for (const s of stars) if (Math.sin(t * 2.5 + s.phase) > 0.55) {
      p.px(s.x - 1, s.y, '#fffbe0'); p.px(s.x + 1, s.y, '#fffbe0'); p.px(s.x, s.y - 1, '#fffbe0'); p.px(s.x, s.y + 1, '#fffbe0');
    }
    for (const cl of clouds) {
      const span = PW + cl.img.width * 2;
      g.drawImage(cl.img, Math.round(((cl.x0 + t * cl.speed) % span) - cl.img.width), cl.y);
    }

    for (const X of spots) {
      // vòi phun nước
      const fx = X(PARK.fountain.x);
      const top = PARK.fountain.y - 29;
      for (let k = 0; k < 6; k++) p.px(fx, top - 1 - ((k + Math.floor(t * 8)) % 6), k % 2 ? '#ffffff' : '#c9f1ff');
      for (const side of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
          const ph = (t * 0.9 + k / 9) % 1;
          const x = fx + side * (1 + ph * 15);
          const y = top - 2 + ph * ph * 22 - Math.sin(Math.PI * ph) * 4;
          p.px(x, y, ph > 0.85 ? '#ffffff' : '#bfefff');
        }
      }
      for (let k = 0; k < 4; k++) {
        const a = t * 1.7 + k * 1.6;
        p.px(fx + Math.round(Math.cos(a) * 15), PARK.fountain.y - 11 + Math.round(Math.sin(a * 1.3)), '#e8fbff');
      }

      // mặt ao lấp lánh
      const { pond } = PARK;
      const cx = X(pond.x);
      for (let k = 0; k < 4; k++) {
        const x = cx - pond.rx + 4 + ((t * 3 + k * 14) % (pond.rx * 2 - 10));
        const y = pond.y - 2 + (k % 3) * 2;
        if (Math.sin(t * 3 + k) > -0.3) p.rect(x, y, 3, 1, '#d6f4ff');
      }
    }

    g.globalAlpha = { night: 0.5, dusk: 0.85 }[time] ?? 1; // lớp này không qua bộ phủ màu nên tự làm tối
    for (const f of flowers) {
      const sway = Math.round(Math.sin(t * 1.8 + f.phase) * 0.8);
      p.px(f.x, f.y, '#4f9a3f');
      p.px(f.x, f.y - 1, '#4f9a3f');
      const hx = f.x + sway;
      const hy = f.y - 3;
      p.px(hx - 1, hy, f.color); p.px(hx + 1, hy, f.color); p.px(hx, hy - 1, f.color); p.px(hx, hy + 1, f.color);
      p.px(hx, hy, '#ffe26b');
      p.px(hx - 1, hy - 1, f.light);
    }
    g.globalAlpha = 1;

    if (time !== 'night') {
      for (const b of wings) {
        const x = b.x + 34 * Math.sin(t * 0.35 + b.phase) + 7 * Math.sin(t * 1.6 + b.phase * 2);
        const y = b.y + 9 * Math.sin(t * 0.8 + b.phase) + 3 * Math.sin(t * 3.1);
        g.drawImage(b.frames[Math.floor(t * 7 + b.phase) % 2], Math.round(x), Math.round(y));
      }
      // cánh hoa anh đào bay
      for (const pe of petals) {
        const u = (t / 9 + pe.phase) % 1;
        const x = pe.x - 12 + u * 70 + Math.sin(u * 14 + pe.wobble) * 3;
        const y = PARK.blossom.y - 26 + u * 46;
        p.rect(x, y, 2, 1, '#ffc4d6');
        p.px(x + (Math.sin(t * 4 + pe.wobble) > 0 ? 1 : 0), y + 1, '#ff9fbd');
      }
    }

    // ánh đèn và đom đóm
    glow.g.clearRect(0, 0, PW, PH);
    if (time === 'night' || time === 'dusk') {
      const flicker = Math.sin(t * 9) * 0.02;
      for (const [x, y] of lamps) {
        for (const [r, a] of [[22, 0.08], [14, 0.12], [8, 0.2]]) glow.p.disc(x, y - 30, r, `rgba(255, 214, 140, ${a + flicker})`);
      }
      for (const f of flies) {
        const a = (Math.sin(t * 2 + f.phase * 3) + 1) / 2;
        if (a < 0.25) continue;
        const x = f.x + 14 * Math.sin(t * 0.4 + f.phase);
        const y = f.y + 7 * Math.sin(t * 0.7 + f.phase * 1.3);
        glow.p.rect(x - 1, y - 1, 3, 3, `rgba(255, 246, 168, ${a * 0.35})`);
        glow.p.px(x, y, `rgba(255, 250, 200, ${a})`);
      }
    }
  }

  build();
  const stop = animate(12, draw);
  const clock = setInterval(() => timeOfDay() !== time && build(), 60_000);
  return () => {
    stop();
    clearInterval(clock);
    for (const l of [bg, amb, glow]) l.c.remove();
  };
}

// ---------------------------------------------------------------- căn phòng

const ROOM_PX = 4;

function roomLayout(W, H) {
  const floorY = Math.round(H * 0.68);
  const narrow = W < 110;
  const win = { x: W - (narrow ? 34 : 46), y: 13, w: narrow ? 24 : 32, h: 25 };
  const shelf = { x: 24, y: 36, w: narrow ? 20 : 28 };
  const frame = narrow ? null : { x: shelf.x + shelf.w + 8, y: 12, w: 16, h: 12 };
  const clockX = Math.round(((frame ? frame.x + frame.w : shelf.x + shelf.w) + win.x - 10) / 2);
  return {
    W, H, floorY, win, shelf, frame,
    clock: { x: clockX, y: 15, r: 6 },
    lamp: { x: 4, base: floorY + 14 },
    plant: { x: W - 28, base: H - 7 },
    rug: { x: Math.round(W / 2), y: floorY + Math.round((H - floorY) * 0.52), rx: Math.min(44, Math.round(W * 0.3)), ry: 8 },
  };
}

function drawRoomContent(L, time) {
  const { W, H, floorY, win, shelf, frame, clock, rug } = L;
  const [c, g] = makeCanvas(W, H);
  const p = new Pen(g);
  const rand = seeded(11);

  // giấy dán tường sọc, chấm hoa
  p.rect(0, 0, W, floorY, '#fde8cf');
  for (let x = 3; x < W; x += 9) p.rect(x, 0, 2, floorY, '#f9ddbf');
  for (let y = 8, row = 0; y < floorY - 22; y += 8, row++) {
    for (let x = 7 + (row % 2) * 4; x < W; x += 9) {
      p.px(x, y, '#f2c9a3'); p.px(x - 1, y + 1, '#f2c9a3'); p.px(x + 1, y + 1, '#f2c9a3'); p.px(x, y + 2, '#f2c9a3');
    }
  }
  p.rect(0, 0, W, 2, '#f1cfa8');
  p.rect(0, 2, W, 1, '#e3b98c');

  // ốp gỗ chân tường
  const wy = floorY - 19;
  p.rect(0, wy, W, 19, '#ecc9a0');
  p.rect(0, wy, W, 2, '#d1a271');
  p.rect(0, wy + 2, W, 1, '#f6dcb9');
  for (let x = 3; x < W; x += 14) {
    p.rect(x, wy + 5, 10, 9, '#e5bf92');
    p.rect(x, wy + 5, 10, 1, '#cfa678');
    p.rect(x, wy + 5, 1, 9, '#cfa678');
    p.rect(x, wy + 13, 10, 1, '#f4d8b4');
    p.rect(x + 9, wy + 5, 1, 9, '#f4d8b4');
  }
  p.rect(0, floorY - 3, W, 3, '#c48d5c');
  p.rect(0, floorY - 3, W, 1, '#dca877');

  // sàn gỗ
  for (let row = 0, y = floorY; y < H; row++, y += 5) {
    p.rect(0, y, W, 5, row % 2 ? '#d6a36b' : '#dcab74');
    p.rect(0, y + 4, W, 1, '#ba8551');
    for (let x = Math.floor(rand() * 22); x < W; x += 20 + Math.floor(rand() * 14)) {
      p.rect(x, y, 1, 4, '#ba8551');
      p.px(x + 1, y, '#e9be8b');
    }
    for (let k = 0; k < W / 12; k++) p.rect(rand() * W, y + 1 + Math.floor(rand() * 3), 2, 1, '#cd9960');
  }
  p.rect(0, floorY, W, 1, '#a8744a');

  // vệt nắng chiếu xuống sàn
  if (time === 'day' || time === 'dawn') {
    const x0 = win.x;
    const x1 = win.x + win.w;
    const yTop = win.y + win.h;
    p.ditherFill(0, yTop, W, H - yTop, 'rgba(255, 246, 214, 0.45)', 0.28, (x, y) => {
      const shift = (y - yTop) * 0.9;
      return x >= x0 - shift && x <= x1 - shift;
    });
  }

  // cửa sổ: khung gỗ trắng, kính để trống cho bầu trời phía sau
  p.rect(win.x - 3, win.y - 3, win.w + 6, win.h + 6, '#c9a27a');
  p.rect(win.x - 2, win.y - 2, win.w + 4, win.h + 4, '#fff6ea');
  g.clearRect(win.x, win.y, win.w, win.h);
  p.rect(win.x + Math.floor(win.w / 2) - 1, win.y, 2, win.h, '#fff6ea');
  p.rect(win.x, win.y + Math.floor(win.h / 2) - 1, win.w, 2, '#fff6ea');
  p.rect(win.x - 5, win.y + win.h + 2, win.w + 10, 3, '#fff6ea');
  p.rect(win.x - 5, win.y + win.h + 5, win.w + 10, 1, '#d9c2a6');
  const cactus = cactusPot();
  g.drawImage(cactus, win.x + win.w - 9, win.y + win.h + 2 - cactus.height);

  // rèm hồng hai bên
  p.rect(win.x - 12, win.y - 7, win.w + 24, 2, '#a8754a');
  for (const side of [-1, 1]) {
    const left = side < 0 ? win.x - 11 : win.x + win.w + 3;
    for (let y = win.y - 5; y < win.y + win.h + 10; y++) {
      const tie = y > win.y + win.h * 0.55 && y < win.y + win.h * 0.7;
      const width = tie ? 5 : 8;
      const x = side < 0 ? left : left + (8 - width);
      for (let k = 0; k < width; k++) p.px(x + k, y, (x + k) % 3 === 0 ? '#e98aa1' : '#f6a9bb');
      if (tie) p.px(side < 0 ? x + width - 1 : x, y, '#c95c78');
    }
  }

  // kệ sách, lọ trân châu
  p.rect(shelf.x, shelf.y, shelf.w, 2, '#b98457');
  p.rect(shelf.x, shelf.y + 2, shelf.w, 1, '#8f6240');
  p.rect(shelf.x + 3, shelf.y + 3, 1, 3, '#8f6240');
  p.rect(shelf.x + shelf.w - 4, shelf.y + 3, 1, 3, '#8f6240');
  let bx = shelf.x + 2;
  for (const [h, w, color] of [[9, 3, '#e98a8a'], [7, 2, '#8ab8e9'], [10, 3, '#f2c14e'], [8, 2, '#8fd3bf']]) {
    p.rect(bx, shelf.y - h, w, h, color);
    p.rect(bx, shelf.y - h + 2, w, 1, '#fff6ea');
    p.rect(bx + w - 1, shelf.y - h, 1, h, 'rgba(0,0,0,0.12)');
    bx += w;
  }
  if (shelf.w > 24) {
    p.rect(bx + 3, shelf.y - 8, 7, 8, '#e3f2f6');
    p.rect(bx + 3, shelf.y - 9, 7, 2, '#c98f5a');
    for (let k = 0; k < 6; k++) p.px(bx + 4 + (k % 3) * 2, shelf.y - 2 - Math.floor(k / 3) * 2, '#3d2a1f');
    p.rect(bx + 3, shelf.y - 7, 1, 6, '#ffffff');
  }

  // tranh treo tường
  if (frame) {
    p.rect(frame.x - 1, frame.y - 1, frame.w + 2, frame.h + 2, '#9c6a43');
    p.rect(frame.x, frame.y, frame.w, frame.h, '#bfe3f2');
    for (let k = 0; k < frame.w; k++) {
      const hill = Math.round(4 + 2 * Math.sin(k / 3));
      p.rect(frame.x + k, frame.y + frame.h - hill, 1, hill, k > 9 ? '#a8db92' : '#8fcf7a');
    }
    p.rect(frame.x + frame.w - 5, frame.y + 2, 2, 2, '#fff1a8');
    p.rect(frame.x + frame.w / 2 - 1, frame.y - 4, 2, 3, '#9c6a43');
  }

  // đồng hồ (kim vẽ ở lớp chuyển động)
  p.disc(clock.x, clock.y, clock.r + 1, '#9c6a43');
  p.disc(clock.x, clock.y, clock.r, '#fff8ec');
  for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) p.px(clock.x + dx, clock.y + dy, '#9c6a43');

  // thảm tròn
  p.ellipse(rug.x, rug.y, rug.rx + 1, rug.ry + 1, '#c86f86');
  p.ellipse(rug.x, rug.y, rug.rx, rug.ry, '#f1a1b5');
  p.ellipse(rug.x, rug.y, rug.rx - 4, rug.ry - 2, '#ffd2dd');
  p.ellipse(rug.x, rug.y, rug.rx - 9, rug.ry - 4, '#f8b9c8');
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    p.px(rug.x + Math.cos(a) * (rug.rx - 2), rug.y + Math.sin(a) * (rug.ry - 1), '#ffffff');
  }

  const lit = time === 'night' || time === 'dusk';
  const lamp = floorLamp(lit);
  g.drawImage(lamp, L.lamp.x, L.lamp.base - lamp.height);
  const plant = pottedPlant();
  g.drawImage(plant, L.plant.x, L.plant.base - plant.height);
  return c;
}

/**
 * Gắn căn phòng vào `container`; `onLayout({ x, y })` báo vị trí (px) tâm tấm thảm để đặt thú cưng.
 * Trả về hàm dọn dẹp.
 */
export function mountRoomScene(container, { onLayout } = {}) {
  const bg = makeLayer(container, 'scene-bg', 1, 1, ROOM_PX);
  const amb = makeLayer(container, 'scene-amb', 1, 1, ROOM_PX);
  const glow = makeLayer(container, 'scene-glow', 1, 1, ROOM_PX);
  container.prepend(bg.c, amb.c);

  let L = null;
  let time = null;
  let clouds = [];
  const rand = seeded(5);
  const motes = Array.from({ length: 12 }, () => ({ u: rand(), v: rand(), phase: rand() * 6 }));
  const winStars = Array.from({ length: 8 }, () => ({ u: rand(), v: rand() * 0.7, phase: rand() * 6 }));

  function build() {
    const W = Math.ceil(container.clientWidth / ROOM_PX);
    const H = Math.ceil(container.clientHeight / ROOM_PX);
    if (!W || !H) return;
    time = timeOfDay();
    container.dataset.time = time;
    L = roomLayout(W, H);
    for (const l of [bg, amb, glow]) resizeLayer(l, W, H, ROOM_PX);
    const { win } = L;
    drawSky(bg.p, win.x, win.y, win.w, win.h, time, seeded(2));
    drawSunOrMoon(bg.p, time === 'night' ? win.x + win.w - 7 : win.x + 6, win.y + 6, time, 3);
    bg.g.drawImage(tinted(drawRoomContent(L, time), ROOM_TINTS[time]), 0, 0);
    clouds = [[14, 4, 1.2], [10, 13, 1.8]].map(([w, y, speed], i) => ({ img: cloud(w, i + 7, CLOUD[time]), y, speed, x0: i * 23 }));
    onLayout?.({ x: L.rug.x * ROOM_PX, y: L.rug.y * ROOM_PX });
  }

  function draw(t) {
    if (!L) return;
    const { g, p } = amb;
    const { win, clock } = L;
    g.clearRect(0, 0, L.W, L.H);

    // mây trôi qua ô cửa
    g.save();
    g.beginPath();
    g.rect(win.x, win.y, win.w, win.h);
    g.clip();
    for (const cl of clouds) {
      const span = win.w + cl.img.width;
      g.drawImage(cl.img, Math.round(win.x - cl.img.width + ((cl.x0 + t * cl.speed) % span)), win.y + cl.y);
    }
    if (time === 'night') {
      for (const s of winStars) if (Math.sin(t * 2.2 + s.phase) > 0.2) p.px(win.x + s.u * win.w, win.y + s.v * win.h, '#fffbe0');
    }
    g.restore();
    p.rect(win.x + Math.floor(win.w / 2) - 1, win.y, 2, win.h, '#fff6ea');
    p.rect(win.x, win.y + Math.floor(win.h / 2) - 1, win.w, 2, '#fff6ea');

    // bụi lơ lửng trong vệt nắng
    if (time === 'day' || time === 'dawn') {
      const yTop = win.y + win.h;
      for (const m of motes) {
        const y = yTop + 4 + ((m.v * (L.H - yTop) + t * 1.5) % (L.H - yTop - 6));
        const x = win.x + m.u * win.w - (y - yTop) * 0.9 + Math.sin(t * 0.8 + m.phase) * 2;
        if (Math.sin(t * 1.5 + m.phase) > -0.2) p.px(x, y, 'rgba(255, 250, 225, 0.9)');
      }
    }

    // kim đồng hồ theo giờ thật
    const now = new Date();
    const minA = ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
    const hourA = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    pixelLine(p, clock.x, clock.y, clock.x + Math.round(Math.cos(minA) * 5), clock.y + Math.round(Math.sin(minA) * 5), '#4a3326');
    pixelLine(p, clock.x, clock.y, clock.x + Math.round(Math.cos(hourA) * 3), clock.y + Math.round(Math.sin(hourA) * 3), '#c44569');

    glow.g.clearRect(0, 0, L.W, L.H);
    if (time === 'night' || time === 'dusk') {
      const flicker = Math.sin(t * 7) * 0.015;
      const lx = L.lamp.x + 7;
      const ly = L.lamp.base - 40;
      for (const [r, a] of [[40, 0.07], [26, 0.1], [14, 0.16]]) glow.p.disc(lx, ly, r, `rgba(255, 200, 120, ${a + flicker})`);
    }
  }

  build();
  const stop = animate(10, draw);
  const resize = new ResizeObserver(() => build());
  resize.observe(container);
  const clockTimer = setInterval(() => timeOfDay() !== time && build(), 60_000);
  return () => {
    stop();
    resize.disconnect();
    clearInterval(clockTimer);
    for (const l of [bg, amb, glow]) l.c.remove();
  };
}
