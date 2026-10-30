// Nền pixel art của bản đồ đất theo kiểu tileset lục giác: mỗi lô là một ô lục giác có viền mảnh, mỗi loại đất
// một kiểu vân (nước gợn, tuyết, đất nứt, cát gợn sóng, cỏ, rừng, đá lát), sông thẳng qua các ô ven sông, rồi
// núi đá (đỉnh tuyết phía bắc), núi lửa, hang, rừng cây, làng mái đỏ, lâu đài, ruộng, ao, cây dừa, nhà nổi và
// thuyền. Vẽ trên canvas nhỏ rồi phóng to sắc nét (image-rendering: pixelated).
import { Pen, bayer, hexToRgb, makeCanvas, outline, seeded, shadeBlob } from './pixel.js';
import { PLOTS } from './shared/clan.js';

/** Số điểm ảnh canvas trên một đơn vị của khung SVG. */
export const PIXEL_SCALE = 0.75;

export const PIXEL_PALETTE = {
  ocean: ['#1d5fae', '#2470bd', '#2f8fd2', '#4fb3e4', '#8adcf0', '#c8f3f8'],
  grass: ['#5cb336', '#51a32f', '#6cc444'], grid: '#4f9e2d',
  forestFloor: ['#3f8a2a', '#357a24'], hillGrass: ['#7fa846', '#71973d'], urbanGrass: ['#6dbd45', '#62ae3d'],
  sand: ['#f0d9a0', '#e3c682'], cliff: ['#b47a43', '#93602f', '#6e4522'], cliffTop: '#3d8a28',
  river: ['#3f97d6', '#6cc0ec', '#a9e2f6'], bank: '#8a5a30',
  road: ['#e7c27c', '#cf9f58'], plank: ['#d9b77a', '#9c7346', '#6b4a2a'],
  tree: { light: '#86d05a', mid: '#3f9a2e', dark: '#256b1e' },
  pine: ['#2f7d2a', '#1f5e1e'],
  rock: { light: '#c69a68', mid: '#9c7148', dark: '#6b4a2e' }, snow: ['#f7fafc', '#cbd6e2'],
  roof: ['#d9533c', '#c0442f', '#e07848'], wall: '#f3e6d2', stone: ['#b9b6ae', '#8f8b83', '#6a665f'],
  flower: ['#f4d34a', '#f08ab0', '#ffffff'], mushroom: '#d9653f', shadow: '#00000033',
};
const P = PIXEL_PALETTE;

// ---------------------------------------------------------------- tiện ích

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Đường cong Catmull-Rom qua các điểm, lấy mẫu dày. */
function sample(points, step = 0.6) {
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
    const y = (i - x) / W;
    if (x > 0 && dist[i - 1] > d) { dist[i - 1] = d; queue[tail++] = i - 1; }
    if (x < W - 1 && dist[i + 1] > d) { dist[i + 1] = d; queue[tail++] = i + 1; }
    if (y > 0 && dist[i - W] > d) { dist[i - W] = d; queue[tail++] = i - W; }
    if (y < H - 1 && dist[i + W] > d) { dist[i + W] = d; queue[tail++] = i + W; }
  }
  return dist;
}

// ---------------------------------------------------------------- sprite

function tree(rand, big = false) {
  const r = (big ? 4 : 3) + Math.floor(rand() * 2);
  const [c, g] = makeCanvas(r * 2 + 3, r * 2 + 5);
  const p = new Pen(g);
  p.rect(r, r * 2 - 1, 3, 4, '#7a4428');
  p.px(r - 1, r * 2 + 2, '#7a4428');
  p.px(r + 3, r * 2 + 2, '#7a4428');
  p.disc(r + 1, r + 1, r, P.tree.mid);
  shadeBlob(c, r + 1, r + 1, r, P.tree);
  for (let k = 0; k < r; k++) p.px(r - 1 + rand() * r, 2 + rand() * r, P.tree.light);
  return outline(c, '#1d3d14');
}

function pine(rand) {
  const h = 7 + Math.floor(rand() * 3);
  const [c, g] = makeCanvas(h, h + 2);
  const p = new Pen(g);
  const mid = Math.floor(h / 2);
  for (let y = 0; y < h; y++) {
    const half = Math.min(mid, Math.floor((y % 3) + y / 3));
    p.rect(mid - half, y, half * 2 + 1, 1, P.pine[0]);
    p.rect(mid + 1, y, Math.max(0, half), 1, P.pine[1]);
  }
  p.rect(mid, h, 1, 2, '#6b3f24');
  return outline(c, '#173d14');
}

function mountain(rand, { snowy = false, size = 0 } = {}) {
  const h = 10 + size + Math.floor(rand() * 4);
  const w = h * 2 + 1;
  const [c, g] = makeCanvas(w, h);
  const p = new Pen(g);
  const capRows = snowy ? Math.floor(h * 0.45) : 2;
  for (let y = 0; y < h; y++) {
    for (let x = h - y; x <= h + y; x++) {
      const side = x < h + Math.sin(y * 0.9) * 1.5;
      let color = side ? P.rock.light : P.rock.mid;
      if (!side && (x + y) % 5 === 0) color = P.rock.dark;
      if (side && (x * 3 + y) % 7 === 0) color = P.rock.mid;
      if (y < capRows + ((x * 7) % 3) - 1) color = side ? P.snow[0] : P.snow[1];
      p.px(x, y, color);
    }
  }
  return outline(c, '#3e2a1a');
}

function volcano() {
  const h = 14;
  const w = h * 2 + 3;
  const [c, g] = makeCanvas(w, h + 6);
  const p = new Pen(g);
  const mid = Math.floor(w / 2);
  for (let y = 4; y < h + 6; y++) {
    const half = 3 + Math.floor((y - 4) * 1.05);
    for (let x = -half; x <= half; x++) p.px(mid + x, y, x < 0 ? '#b8583a' : (x + y) % 4 ? '#8e3f29' : '#6e2e1e');
  }
  p.rect(mid - 3, 4, 7, 2, '#ff8a3a');
  p.rect(mid - 2, 4, 5, 1, '#ffd36a');
  p.disc(mid - 1, 1, 1, '#d8d2cc');
  p.disc(mid + 2, 1, 1, '#ece8e4');
  return outline(c, '#3e1d14');
}

function palm(rand) {
  const [c, g] = makeCanvas(11, 13);
  const p = new Pen(g);
  const lean = rand() < 0.5 ? -1 : 1;
  for (let y = 4; y < 13; y++) p.px(5 + Math.round(((12 - y) / 8) * lean), y, y % 2 ? '#a06a38' : '#7c4e28');
  for (const [dx, dy] of [[-4, 1], [-3, 0], [-2, -1], [2, -1], [3, 0], [4, 1], [-1, 2], [1, 2]]) p.px(5 + dx, 3 + dy, '#3f9a2e');
  for (const [dx, dy] of [[-4, 2], [4, 2], [-2, 0], [2, 0], [0, 1]]) p.px(5 + dx, 3 + dy, '#2a7322');
  p.rect(4, 2, 3, 2, '#56b33a');
  return outline(c, '#1d3d14');
}

function house(rand) {
  const w = 7 + Math.floor(rand() * 3);
  const [c, g] = makeCanvas(w, 9);
  const p = new Pen(g);
  const roof = P.roof[Math.floor(rand() * P.roof.length)];
  for (let y = 0; y < 4; y++) {
    const inset = Math.max(0, 3 - y);
    p.rect(inset, y, w - inset * 2, 1, y === 3 ? '#9a3424' : roof);
  }
  p.rect(0, 4, w, 5, P.wall);
  p.rect(1, 5, 2, 2, '#7ab8de');
  p.rect(w - 3, 5, 2, 2, '#7ab8de');
  p.rect(Math.floor(w / 2), 6, 1, 3, '#8a5a35');
  return outline(c, '#3a2318');
}

function castle() {
  const [c, g] = makeCanvas(22, 21);
  const p = new Pen(g);
  p.rect(2, 9, 18, 11, P.stone[0]);
  for (let x = 2; x < 20; x += 2) p.px(x, 8, P.stone[0]);
  for (let y = 11; y < 20; y += 3) p.rect(2, y, 18, 1, P.stone[1]);
  p.rect(9, 13, 4, 7, '#5a2e22');
  p.rect(10, 14, 2, 6, '#8a3a2a');
  for (const x of [0, 17]) {
    p.rect(x, 5, 5, 15, P.stone[1]);
    p.rect(x, 5, 2, 15, P.stone[0]);
    for (let y = 0; y < 5; y++) p.rect(x + 2 - Math.floor(y / 2), y, 1 + Math.floor(y / 2) * 2, 1, y === 4 ? '#9a3424' : '#d9533c');
    p.px(x + 2, 10, '#2e2a26');
  }
  p.rect(9, 1, 4, 9, P.stone[1]);
  p.rect(9, 1, 2, 9, P.stone[0]);
  p.px(11, 0, '#d9533c');
  p.rect(12, 0, 3, 2, '#e8463a');
  return outline(c, '#2e2a26');
}

function cave() {
  const [c, g] = makeCanvas(11, 8);
  const p = new Pen(g);
  p.ellipse(5, 6, 5, 5, P.stone[1]);
  p.ellipse(4, 5, 3, 3, P.stone[0]);
  p.rect(3, 4, 5, 4, '#2a1d14');
  p.rect(4, 3, 3, 1, '#2a1d14');
  p.rect(3, 7, 5, 1, '#c8a050');
  return outline(c, '#2a1d14');
}

function ship() {
  const [c, g] = makeCanvas(13, 11);
  const p = new Pen(g);
  p.rect(1, 7, 11, 2, '#8a5a30');
  p.rect(2, 9, 9, 1, '#6b4224');
  p.rect(6, 0, 1, 7, '#5a3a20');
  p.rect(3, 1, 3, 5, '#f4efe2');
  p.rect(7, 2, 3, 4, '#efe8d6');
  p.rect(6, 0, 2, 1, '#d9533c');
  return outline(c, '#2a1a10');
}

function hut() {
  const [c, g] = makeCanvas(9, 9);
  const p = new Pen(g);
  p.rect(0, 7, 9, 2, '#9c7346');
  for (let x = 1; x < 9; x += 2) p.px(x, 8, '#6b4a2a');
  p.rect(2, 3, 5, 4, '#e8d7b0');
  for (let y = 0; y < 3; y++) p.rect(3 - y, y, 3 + y * 2, 1, '#c7843e');
  p.rect(4, 5, 1, 2, '#6b4a2a');
  return outline(c, '#2a1a10');
}

function field(rand) {
  const w = 12 + Math.floor(rand() * 4);
  const h = 8;
  const [c, g] = makeCanvas(w, h);
  const p = new Pen(g);
  const crop = rand() < 0.5 ? ['#e2c75a', '#c4a63c'] : ['#9fcf4a', '#7aa836'];
  p.rect(0, 0, w, h, '#a8743e');
  for (let y = 1; y < h - 1; y += 2) p.rect(1, y, w - 2, 1, crop[y % 4 === 1 ? 0 : 1]);
  return outline(c, '#5e3c1e');
}

function pond(rand) {
  const rx = 5 + Math.floor(rand() * 3);
  const ry = 3 + Math.floor(rand() * 2);
  const [c, g] = makeCanvas(rx * 2 + 3, ry * 2 + 3);
  const p = new Pen(g);
  p.ellipse(rx + 1, ry + 1, rx, ry, P.river[0]);
  p.ellipse(rx, ry, rx - 2, Math.max(1, ry - 2), P.river[1]);
  p.px(rx - 2, ry - 1, P.river[2]);
  return outline(c, '#2f6a8a');
}

function darken(hex, f = 0.88) {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r, g, b].map((v) => Math.round(v * f).toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------- vẽ nền

/** Vân từng loại đất (theo kiểu tileset lục giác): màu nền và cách điểm xuyết theo vị trí điểm ảnh. */
const TERRAIN = {
  water: { line: '#7fb8ee', paint: (x, y, t) => ((y % 4 === 0 && (x + (y >> 2) * 5) % 9 < 3) ? '#6fb3ec' : t < 0.1 ? '#3584cf' : '#3f8fd8') },
  snow: { line: '#b9c8dc', paint: (x, y, t) => (t < 0.08 ? '#c9d6e6' : (y % 5 === 0 && (x + y) % 7 < 2) ? '#d6e2ef' : '#eef4fa') },
  dirt: { line: '#7a4519', paint: (x, y, t) => (((x + y * 2) % 11 === 0 || (x * 2 - y) % 13 === 0) ? '#86491d' : t < 0.15 ? '#b0702f' : '#9c5d26') },
  sand: { line: '#d49a22', paint: (x, y, t) => ((y + Math.round(Math.sin(x * 0.45) * 1.5)) % 5 === 0 ? '#e3a92e' : t < 0.1 ? '#f7d26a' : '#f2c24a') },
  grass: { line: '#3f8e26', paint: (x, y, t) => (t > 0.94 ? '#7fd651' : t < 0.12 ? '#4ea52f' : '#5fbf3a') },
  forest: { line: '#2a6a1e', paint: (x, y, t) => (t < 0.25 ? '#357f27' : '#3f952d') },
  stone: { line: '#9a917c', paint: (x, y, t) => ((x % 5 === 0 || (y % 4 === 0)) ? '#b3ab95' : t < 0.1 ? '#d4cdbb' : '#c7c0ac') },
};
const terrainOf = (p) => {
  if (p.zone === 'sea') return 'water';
  if (p.zone === 'hill') return p.row <= 1 ? 'snow' : 'dirt';
  return { coast: 'sand', forest: 'forest', urban: 'stone' }[p.zone] ?? 'grass';
};

/**
 * Vẽ nền pixel. `geometry`: Map id → { hex, cx, cy } theo đơn vị SVG. `heat(plot)`: màu tô theo chế độ
 * (null = theo địa hình). `river`: điểm theo đơn vị SVG. Trả về canvas.
 */
export function drawPixelBase({ width, height, geometry, heat, river }) {
  const S = PIXEL_SCALE;
  const W = Math.round(width * S);
  const H = Math.round(height * S);
  const [canvas, g] = makeCanvas(W, H);
  const N = W * H;
  const heatMode = PLOTS.some((p) => heat(p));
  const blocks = PLOTS.map((p) => {
    const hex = geometry.get(p.id).hex.map(([x, y]) => [x * S, y * S]);
    const xs = hex.map((q) => q[0]);
    const ys = hex.map((q) => q[1]);
    return { plot: p, hex, heat: heat(p), terrain: terrainOf(p), box: [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))] };
  });

  const owner = new Int16Array(N).fill(-1);
  blocks.forEach((b, k) => {
    const [x0, y0, x1, y1] = b.box;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) if (inside(b.hex, x + 0.5, y + 0.5)) owner[y * W + x] = k;
    }
  });
  const isWaterAt = (i) => owner[i] < 0 || blocks[owner[i]].terrain === 'water';
  const toLand = distanceField(W, H, (i) => !isWaterAt(i), 6);

  const img = g.createImageData(W, H);
  const d = img.data;
  const rgbCache = new Map();
  const rgb = (hex) => {
    if (!rgbCache.has(hex)) rgbCache.set(hex, hexToRgb(hex));
    return rgbCache.get(hex);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = bayer(x, y);
      const k = owner[i];
      let color;
      if (k < 0) {
        // biển ngoài lưới: sâu hơn, sóng thưa, bọt sáng sát bờ
        color = toLand[i] <= 1 ? '#a9d8f5' : toLand[i] <= 3 && t < 0.5 ? '#6fb3ec' : (y % 6 === 0 && (x + (y >> 1) * 7) % 13 < 3) ? '#4f9be0' : t < 0.2 ? '#2a6fbe' : '#3079c8';
      } else {
        const b = blocks[k];
        const right = x + 1 < W ? owner[i + 1] : -1;
        const down = y + 1 < H ? owner[i + W] : -1;
        const edge = right !== k || down !== k;
        if (b.heat) {
          color = edge ? darken(b.heat, 0.7) : b.terrain === 'water' && t < 0.45 ? TERRAIN.water.paint(x, y, t) : t < 0.12 ? darken(b.heat) : b.heat;
        } else {
          color = edge ? TERRAIN[b.terrain].line : TERRAIN[b.terrain].paint(x, y, t);
          if (b.terrain === 'water' && toLand[i] <= 1) color = '#a9d8f5';
        }
      }
      const [r, gg, bb] = rgb(color);
      d[i * 4] = r;
      d[i * 4 + 1] = gg;
      d[i * 4 + 2] = bb;
      d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const pen = new Pen(g);
  const onLand = (x, y) => {
    const xx = Math.round(x);
    const yy = Math.round(y);
    return xx >= 0 && yy >= 0 && xx < W && yy < H && !isWaterAt(yy * W + xx);
  };

  // sông chảy thẳng qua tâm các ô ven sông
  const riverLine = sample(river.map(([x, y]) => [x * S, y * S]));
  const riverMask = new Uint8Array(N);
  for (const [x, y] of riverLine) {
    if (!onLand(x, y) && !onLand(x, y - 4) && !onLand(x, y + 4)) continue;
    pen.disc(x, y, 4, '#2f7ec8');
    pen.disc(x, y, 3, '#3f8fd8');
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const xx = Math.round(x + dx);
        const yy = Math.round(y + dy);
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) riverMask[yy * W + xx] = 1;
      }
    }
  }
  riverLine.forEach(([x, y], k) => {
    if (k % 9 === 0 && onLand(x, y)) pen.rect(x - 1, y, 3, 1, '#7fc2f0');
  });

  if (!heatMode) decorate();
  return canvas;

  function decorate() {
    const free = (x, y) => onLand(x, y) && !riverMask[Math.round(y) * W + Math.round(x)];
    const fits = (sprite, x, y) => free(x, y) && free(x - sprite.width / 2, y) && free(x + sprite.width / 2, y) && free(x, y - sprite.height / 2);
    const put = (sprite, x, y, shadow = true) => {
      if (shadow) pen.ellipse(x + 2, y, Math.max(2, Math.floor(sprite.width / 2) - 1), 1, P.shadow);
      g.drawImage(sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height));
    };
    const urban = blocks.filter((b) => b.plot.zone === 'urban');
    const keep = urban.reduce((a, b) => (b.plot.desirability > a.plot.desirability ? b : a), urban[0]);
    const hills = blocks.filter((b) => b.plot.zone === 'hill' && b.plot.row >= 3);
    const fire = hills.reduce((a, b) => (b.plot.col + b.plot.row > a.plot.col + a.plot.row ? b : a), hills[0]);
    const caveAt = hills.find((b) => b.plot.row === 3 && b !== fire) ?? null;

    for (const b of [...blocks].sort((a, c) => a.plot.row - c.plot.row || a.plot.col - c.plot.col)) {
      const geo = geometry.get(b.plot.id);
      const cx = geo.cx * S;
      const cy = geo.cy * S;
      const rand = seeded(b.plot.id * 7919);
      const tryPut = (sprite, dx, dy, shadow) => {
        const x = cx + dx;
        const y = cy + dy;
        if (!fits(sprite, x, y)) return false;
        put(sprite, x, y, shadow);
        return true;
      };
      const tryAny = (sprite, spots, shadow) => spots.some(([dx, dy]) => tryPut(sprite, dx, dy, shadow));
      if (b.terrain === 'grass') {
        for (let k = 0; k < 4; k++) {
          const x = cx - 10 + rand() * 20;
          const y = cy - 8 + rand() * 16;
          if (free(x, y)) pen.px(x, y, rand() < 0.2 ? P.mushroom : P.flower[Math.floor(rand() * 3)]);
        }
      }
      switch (b.plot.zone) {
        case 'urban':
          if (b === keep) tryAny(castle(), [[0, 10], [0, 4], [-6, 8], [6, 8]]);
          else {
            tryAny(house(rand), [[-6, 2], [-6, 6], [-2, 0]]);
            tryAny(house(rand), [[7, 4], [7, 9], [3, 10]]);
            tryAny(house(rand), [[0, 13], [-4, 12]]);
          }
          break;
        case 'river':
          tryAny(tree(rand), [[-9, 2], [-9, 12], [9, 12]]);
          tryAny(house(rand), [[8, 0], [6, 12], [-6, 12]]);
          break;
        case 'coast':
          tryAny(palm(rand), [[-7, 6], [-7, 2]]);
          tryAny(palm(rand), [[7, 9], [6, 4]]);
          break;
        case 'plain': {
          const r = rand();
          if (r < 0.25) tryPut(field(rand), 0, 8, false);
          else if (r < 0.37) tryPut(pond(rand), 0, 7, false);
          else if (r < 0.55) tryAny(house(rand), [[-4, 6], [4, 8]]);
          tryAny(tree(rand), [[8, 0], [-8, 2], [6, 12]]);
          break;
        }
        case 'hill':
          if (b === fire) put(volcano(), cx, cy + 11, false);
          else {
            tryAny(mountain(rand, { snowy: b.plot.row <= 1 }), [[-3, 9], [0, 6]], false);
            if (b === caveAt) tryAny(cave(), [[7, 12], [-7, 12]], false);
            else tryAny(mountain(rand, { snowy: b.plot.row <= 1, size: -3 }), [[8, 13], [-8, 13]], false);
          }
          break;
        case 'forest':
          for (let k = 0; k < 7; k++) tryPut(rand() < 0.35 ? pine(rand) : tree(rand, rand() < 0.3), -11 + (k % 3) * 11 + rand() * 3, -4 + Math.floor(k / 3) * 8 + rand() * 2);
          break;
        case 'sea':
          if (rand() < 0.18) put(hut(), cx, cy + 4, false);
          else if (rand() < 0.12) put(ship(), cx, cy + 5, false);
          break;
        default:
      }
    }
  }
}
