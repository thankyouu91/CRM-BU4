// Nền pixel art của bản đồ đất, cùng phong cách với Phố Trân Châu: vẽ ở độ phân giải bằng nửa khung SVG
// rồi phóng to sắc nét (image-rendering: pixelated). Mỗi điểm ảnh thuộc một khu phố (lô) hoặc là đường;
// sau đó vẽ nhà, cây, núi, sóng theo từng địa hình, rồi sông, trục đường cam và vòng xoay đè lên trên.
import { Pen, bayer, hexToRgb, makeCanvas, outline, seeded, shadeBlob } from './pixel.js';
import { PLOTS } from './shared/clan.js';

/** Số điểm ảnh canvas trên một đơn vị của khung SVG. */
export const PIXEL_SCALE = 0.5;

export const PIXEL_PALETTE = {
  street: '#f3e7d1', streetEdge: '#e2d2b4',
  road: '#eda447', roadEdge: '#c27c2c', roadLine: '#ffe2a0',
  urban: ['#ddd2c2', '#d0c4b2'],
  field: ['#d3e69b', '#b2d06e'],
  park: { light: '#a6dc7c', mid: '#79c25a', dark: '#4f9a43' },
  river: ['#6fbde6', '#a9dcf2'], riverBank: '#cfe8c0',
  sea: ['#5aaee0', '#4b9bd0'], wave: '#e3f5fc',
  sand: ['#f2e0a6', '#e6cd86'],
  mountain: ['#b39a76', '#9c8160'], mountainFoot: ['#a3b36e', '#8fa35c'], rock: '#7d6649', snow: '#f7f3ea',
  forest: ['#5f9e4a', '#548f41'], tree: { light: '#79c25a', mid: '#3f8a3a', dark: '#2c6a2a' },
  roofs: ['#e8836a', '#d9a05a', '#8fb0d0', '#c98fb4', '#e6c36b', '#9fc28a'], wall: '#f6ead6', window: '#8fc4e0',
};
const P = PIXEL_PALETTE;

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Đường cong Catmull-Rom qua các điểm, lấy mẫu dày để đóng dấu từng điểm ảnh. */
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

function stamp(pen, line, r, color) {
  for (const [x, y] of line) pen.disc(x, y, r, color);
}

// ---------------------------------------------------------------- đồ vật nhỏ

function house(rand) {
  const w = 5 + Math.floor(rand() * 4);
  const h = 4 + Math.floor(rand() * 3);
  const [c, g] = makeCanvas(w, h + 3);
  const p = new Pen(g);
  const roof = P.roofs[Math.floor(rand() * P.roofs.length)];
  p.rect(0, 0, w, 3, roof);
  p.rect(0, 2, w, 1, '#00000022');
  p.rect(0, 3, w, h, P.wall);
  for (let x = 1; x < w - 1; x += 2) p.px(x, 4, P.window);
  p.rect(Math.floor(w / 2), h + 1, 1, 2, '#a26a45');
  return outline(c);
}

function tree(rand, pal = P.tree) {
  const r = 2 + Math.floor(rand() * 2);
  const [c, g] = makeCanvas(r * 2 + 3, r * 2 + 4);
  const p = new Pen(g);
  p.rect(r + 1, r * 2, 1, 3, '#7a4f30');
  p.disc(r + 1, r + 1, r, pal.mid);
  shadeBlob(c, r + 1, r + 1, r, pal);
  return outline(c);
}

function peak(rand) {
  const h = 6 + Math.floor(rand() * 4);
  const w = h * 2 - 1;
  const [c, g] = makeCanvas(w, h);
  const p = new Pen(g);
  for (let y = 0; y < h; y++) {
    const half = y;
    p.rect(h - 1 - half, y, half * 2 + 1, 1, y < 3 ? P.snow : (y + Math.floor(rand() * 2)) % 3 ? P.mountain[1] : P.rock);
    p.rect(h - 1 - half, y, Math.max(1, half), 1, y < 3 ? P.snow : P.mountain[0]);
  }
  return outline(c, '#5b4630');
}

// ---------------------------------------------------------------- vẽ nền

/**
 * Vẽ nền pixel. `geometry`: Map id → { block, cx, cy } theo đơn vị SVG. `heat(plot)`: màu tô theo chế độ
 * (null = theo địa hình). `river` và `roads`: danh sách điểm theo đơn vị SVG. Trả về canvas.
 */
export function drawPixelBase({ width, height, geometry, heat, river, roads, roundabouts }) {
  const S = PIXEL_SCALE;
  const W = Math.round(width * S);
  const H = Math.round(height * S);
  const [canvas, g] = makeCanvas(W, H);
  const img = g.createImageData(W, H);
  const d = img.data;
  const blocks = PLOTS.map((p) => ({ plot: p, poly: geometry.get(p.id).block.map(([x, y]) => [x * S, y * S]), heat: heat(p) }));
  const cols = 20;
  const cellW = (width / cols) * S;
  const cellH = (height / 10) * S;
  const rgbCache = new Map();
  const rgb = (hex) => {
    if (!rgbCache.has(hex)) rgbCache.set(hex, hexToRgb(hex));
    return rgbCache.get(hex);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cc = Math.floor(x / cellW);
      const cr = Math.floor(y / cellH);
      let found = null;
      for (let dr = -1; dr <= 1 && !found; dr++) {
        for (let dc = -1; dc <= 1 && !found; dc++) {
          const b = blocks[(cr + dr) * cols + (cc + dc)];
          if (b && cc + dc >= 0 && cc + dc < cols && inside(b.poly, x + 0.5, y + 0.5)) found = b;
        }
      }
      let color;
      const t = bayer(x, y);
      if (!found) color = t < 0.12 ? P.streetEdge : P.street;
      else if (found.heat) color = t < 0.15 ? shadeHex(found.heat) : found.heat;
      else {
        switch (found.plot.zone) {
          case 'urban': color = t < 0.25 ? P.urban[1] : P.urban[0]; break;
          case 'plain': color = (x + y) % 4 === 0 ? P.field[1] : P.field[0]; break;
          case 'river': color = t < 0.2 ? P.field[1] : P.field[0]; break;
          case 'coast': color = t < 0.3 ? P.sand[1] : P.sand[0]; break;
          case 'sea': color = t < 0.3 ? P.sea[1] : P.sea[0]; break;
          case 'hill': color = t < 0.35 ? P.mountainFoot[1] : P.mountainFoot[0]; break;
          case 'forest': color = t < 0.3 ? P.forest[1] : P.forest[0]; break;
          default: color = P.field[0];
        }
      }
      const [r, gg, bb] = rgb(color);
      const i = (y * W + x) * 4;
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = bb;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const pen = new Pen(g);
  const scaled = (pts) => pts.map(([x, y]) => [x * S, y * S]);

  // trang trí từng khu
  for (const { plot, heat: h } of blocks) {
    if (h) continue;
    const geo = geometry.get(plot.id);
    const cx = geo.cx * S;
    const cy = geo.cy * S;
    const rand = seeded(plot.id * 7919);
    const put = (sprite, x, y) => g.drawImage(sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height / 2));
    switch (plot.zone) {
      case 'urban':
        for (let k = 0; k < 3; k++) put(house(rand), cx - 7 + (k % 2) * 9 + rand() * 3, cy - 4 + Math.floor(k / 2) * 8);
        break;
      case 'river':
      case 'coast':
        put(house(rand), cx - 4 + rand() * 6, cy - 3 + rand() * 4);
        if (plot.zone === 'coast') {
          pen.rect(cx + 5, cy + 2, 1, 3, '#a26a45');
          pen.rect(cx + 3, cy + 1, 5, 1, '#e8836a');
        }
        break;
      case 'plain':
        if (rand() < 0.3) {
          pen.ellipse(cx - 2, cy + 1, 6, 4, P.park.mid);
          put(tree(rand, P.park), cx - 3, cy);
        } else if (rand() < 0.5) put(house(rand), cx + rand() * 4 - 2, cy);
        break;
      case 'hill':
        put(peak(rand), cx, cy);
        if (rand() < 0.5) put(tree(rand), cx + 6, cy + 4);
        break;
      case 'forest':
        for (let k = 0; k < 4; k++) put(tree(rand), cx - 6 + rand() * 12, cy - 4 + rand() * 8);
        break;
      case 'sea':
        pen.rect(cx - 5, cy - 2, 3, 1, P.wave);
        pen.rect(cx + 1, cy + 3, 3, 1, P.wave);
        break;
      default:
    }
  }
  // sông: bờ sáng, lòng sông xanh, gợn sáng
  const riverLine = sample(scaled(river));
  stamp(pen, riverLine, 5, P.riverBank);
  stamp(pen, riverLine, 4, P.river[0]);
  riverLine.forEach(([x, y], k) => k % 9 === 0 && pen.rect(x - 1, y - 1, 2, 1, P.river[1]));

  // trục đường: viền đậm, mặt cam, vạch sáng đứt quãng (đè lên sông thành cầu)
  const roadLines = roads.map((r) => sample(scaled(r)));
  for (const line of roadLines) stamp(pen, line, 3, P.roadEdge);
  for (const line of roadLines) stamp(pen, line, 2, P.road);
  for (const line of roadLines) line.forEach(([x, y], k) => k % 8 < 3 && pen.px(x, y, P.roadLine));
  for (const [x, y] of scaled(roundabouts)) {
    pen.disc(x, y, 6, P.roadEdge);
    pen.disc(x, y, 5, P.road);
    pen.disc(x, y, 3, P.park.mid);
    pen.px(x - 1, y - 1, P.park.light);
  }

  return canvas;
}

function shadeHex(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r, g, b].map((v) => Math.round(v * 0.88).toString(16).padStart(2, '0')).join('')}`;
}

