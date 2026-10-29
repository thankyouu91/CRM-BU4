// Bộ vẽ pixel art: vẽ lên canvas độ phân giải thấp rồi phóng to sắc nét bằng CSS (image-rendering: pixelated).

export const OUTLINE = '#2e1d14';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Ngẫu nhiên có hạt giống (mulberry32) để cảnh vẽ ra giống nhau mỗi lần. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** Ngưỡng dither Bayer 4×4 tại một điểm, trong khoảng (0, 1). */
export const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

export class Pen {
  constructor(g) {
    this.g = g;
  }

  rect(x, y, w, h, color) {
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x, y, color) {
    this.rect(x, y, 1, 1, color);
  }

  ellipse(cx, cy, rx, ry, color) {
    this.g.fillStyle = color;
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) ** 2))) + 0.5);
      this.g.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
    }
  }

  disc(cx, cy, r, color) {
    this.ellipse(cx, cy, r, r, color);
  }

  /** Dải màu dọc; ranh giới giữa các màu được dither để ra chất pixel cổ điển. */
  vGradient(x, y, w, h, colors) {
    if (colors.length === 1) return this.rect(x, y, w, h, colors[0]);
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * (colors.length - 1);
      const i = Math.min(colors.length - 2, Math.floor(t));
      const f = Math.min(1, Math.max(0, (t - i - 0.5) * 2.5 + 0.5));
      if (f <= 0.03 || f >= 0.97) {
        this.rect(x, y + j, w, 1, colors[f >= 0.97 ? i + 1 : i]);
        continue;
      }
      for (let k = 0; k < w; k++) this.px(x + k, y + j, f > bayer(x + k, y + j) ? colors[i + 1] : colors[i]);
    }
  }

  /** Tô các điểm trong vùng `inside(x, y)` theo mật độ dither `density` (0–1). */
  ditherFill(x, y, w, h, color, density, inside = () => true) {
    for (let j = 0; j < h; j++) {
      for (let k = 0; k < w; k++) {
        const px = x + k;
        const py = y + j;
        if (bayer(px, py) < density && inside(px, py)) this.px(px, py, color);
      }
    }
  }
}

/** Thêm viền 1px quanh mọi điểm không trong suốt. */
export function outline(src, color = OUTLINE) {
  const w = src.width;
  const h = src.height;
  const [c, g] = makeCanvas(w + 2, h + 2);
  const alpha = src.getContext('2d').getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 0;
  g.fillStyle = color;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
        g.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }
  g.drawImage(src, 1, 1);
  return c;
}

/** Vẽ hình từ bản đồ ký tự: mỗi ký tự là một màu trong `palette`, ký tự khác bỏ trống. */
export function bitmap(rows, palette, outlineColor) {
  const [c, g] = makeCanvas(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!palette[ch]) return;
      g.fillStyle = palette[ch];
      g.fillRect(x, y, 1, 1);
    });
  });
  return outlineColor ? outline(c, outlineColor) : c;
}

/**
 * Tô bóng khối tròn: điểm nào đang mang màu `mid` sẽ được đổi sang sáng/tối theo hướng
 * ánh sáng từ trên-trái, ranh giới dither.
 */
export function shadeBlob(c, cx, cy, r, { light, mid, dark }) {
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const [mr, mg, mb] = hexToRgb(mid);
  const lightRgb = hexToRgb(light);
  const darkRgb = hexToRgb(dark);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i + 3] === 0 || d[i] !== mr || d[i + 1] !== mg || d[i + 2] !== mb) continue;
      const s = ((x - cx) * 0.55 + (y - cy)) / r;
      const b = bayer(x, y);
      let rgb = null;
      if (s > 0.35 + b * 0.3) rgb = darkRgb;
      else if (s < -0.75 + b * 0.3) rgb = lightRgb;
      if (rgb) [d[i], d[i + 1], d[i + 2]] = rgb;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------- icon hạt hiệu ứng & phụ kiện

function flower(petal, petalLight, center) {
  const [c] = makeCanvas(11, 11);
  const p = new Pen(c.getContext('2d'));
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    p.disc(5 + Math.cos(a) * 3, 5 + Math.sin(a) * 3, 2, petal);
  }
  p.px(4, 2, petalLight);
  p.px(2, 4, petalLight);
  p.disc(5, 5, 1, center);
  return outline(c, '#7a2f45');
}

const ART = {
  heart: () => bitmap([
    '.rr.rr.',
    'rwrrrrr',
    'rrrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...',
  ], { r: '#ff6f91', w: '#ffd3df' }, '#7a2335'),
  sparkle: () => bitmap([
    '...y...',
    '...y...',
    '..yWy..',
    'yyWWWyy',
    '..yWy..',
    '...y...',
    '...y...',
  ], { y: '#ffd75e', W: '#ffffff' }),
  twinkle: () => bitmap([
    '.y.',
    'yWy',
    '.y.',
  ], { y: '#fff1a8', W: '#ffffff' }),
  coin: () => bitmap([
    '.yyyy.',
    'yyWyyy',
    'yWyyOy',
    'yyyyOy',
    'yyyOOy',
    '.yyyy.',
  ], { y: '#ffcf4a', W: '#fff3b0', O: '#e09a1f' }, '#7a4c0e'),
  zzz: () => bitmap([
    'zzzzz',
    '...z.',
    '..z..',
    '.z...',
    'zzzzz',
  ], { z: '#c7dcff' }, '#3b4a7a'),
  bubble: () => bitmap([
    '..bbb..',
    '.bfffb.',
    'bfwfffb',
    'bfffffb',
    'bfffffb',
    '.bfffb.',
    '..bbb..',
  ], { b: '#8fd6f2', f: 'rgba(214,243,255,0.55)', w: '#ffffff' }),
  dust: () => bitmap([
    '.dd..',
    'dddd.',
    'ddddd',
    '.ddd.',
  ], { d: '#f5e7c9' }),
  crumb: () => bitmap(['cC', 'Cc'], { c: '#d8975a', C: '#b8763e' }),
  drop: () => bitmap([
    '.b.',
    '.b.',
    'bbb',
    'bwb',
    '.b.',
  ], { b: '#7cc9f2', w: '#e8f8ff' }, '#2f5d85'),
  note: () => bitmap([
    '..nnn',
    '..n.n',
    '..n.n',
    'nnn.n',
    'nnn..',
  ], { n: '#c79bf2' }, '#4a2f6b'),
  shadow: () => {
    const [c, g] = makeCanvas(25, 6);
    new Pen(g).ellipse(12, 3, 12, 2, 'rgba(70, 40, 20, 0.26)');
    return c;
  },

  'acc:bow': () => bitmap([
    '.pp.....pp.',
    'pwpp...pppp',
    'ppppDkDpppp',
    'pppDkkkDppp',
    'ppppDkDpppp',
    'pppp...pppp',
    '.pp.....pp.',
  ], { p: '#ff8fb1', w: '#ffd6e4', D: '#e0607f', k: '#c44569' }, '#5a1f2b'),
  'acc:flower': () => flower('#ffb7cf', '#ffe3ec', '#ffd75e'),
  'acc:glasses': () => bitmap([
    '.####...####.',
    '#############',
    '#w###...#w###',
    '.###.....###.',
  ], { '#': '#2d2a3e', w: '#9fb4e0' }, '#120c08'),
  'acc:tophat': () => bitmap([
    '..#######..',
    '..#w#####..',
    '..#w#####..',
    '..#######..',
    '..#######..',
    '..rrrrrrr..',
    '..#######..',
    '###########',
    '.#########.',
  ], { '#': '#3a3340', w: '#6d6478', r: '#d0506e' }, '#120c08'),
  'acc:crown': () => bitmap([
    'y....y....y',
    'yy..yyy..yy',
    'yyy.yWy.yyy',
    'yyyyyyyyyyy',
    'yRyyyByyyRy',
    'yyyyyyyyyyy',
  ], { y: '#ffcf4a', W: '#fff3b0', R: '#e84a5f', B: '#4aa3e8' }, '#7a4c0e'),
};

const cache = new Map();

/** Lấy hình pixel đã vẽ sẵn: { canvas, url, w, h }. */
export function art(name) {
  if (!cache.has(name)) {
    const make = ART[name];
    if (!make) return null;
    const canvas = make();
    cache.set(name, { canvas, url: canvas.toDataURL(), w: canvas.width, h: canvas.height });
  }
  return cache.get(name);
}
