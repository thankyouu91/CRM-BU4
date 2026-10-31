// Dấu hiệu thêm lên pet: lão làng (gậy, lông mày, chòm râu bạc), dáng theo cấp (LEVEL_FORMS: vạch thái dương, vằn hông,
// vòng linh khí, đốm sáng, ánh vàng), hào quang bé Quý / Huyền thoại, và sao lấp lánh của bộ đồ cùng hành.
// Chủ sở hữu: họa sĩ hiệu ứng. Ba điểm vào, pipeline (index.js) gọi theo thứ tự:
//  - body(ctx): trước khi tô bóng; đẩy bộ phận (gậy) vào ctx.parts, điểm (lông mày, râu, vạch) vào ctx.pixels (z 23);
//  - behind(ctx, img): trước khi dán pet (hào quang, vòng linh khí dưới chân), pet sẽ đè lên;
//  - front(ctx, img): sau cùng (đốm sáng bay lên, sao của bộ đồ).
// TRẠNG THÁI: HÌNH TẠM, port từ rig.js cũ sang ô 48×48, ĐÃ KHÓA MÀU và không bán trong suốt (hào quang cũ dùng rgba,
// nay là điểm dither đục). Bảng 48 màu không có màu tím: hào quang Quý tạm dùng hồng. Mọi thứ nằm trong hàng/cột 1..46.
import { ELEMENTS, fullSetOf } from '../shared/pets.js';
import { mEllipse, mOr, part, pyRound, setPx } from './core.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const inCell = (x, y) => x >= 1 && y >= 1 && x <= 46 && y <= 46;
const put = (img, x, y, c) => {
  if (inCell(x, y)) setPx(img, x, y, c);
};

/** Màu theo hành, đã chọn trong bảng 48 màu: vòng linh khí, vạch (đậm), đốm sáng. */
const EL = {
  kim: { ring: '#c4bcb0', mark: '#d79c1c', mote: '#f4c24f' },
  moc: { ring: '#6dbb5a', mark: '#3e7a3f', mote: '#c4e89a' },
  thuy: { ring: '#3f8fc0', mark: '#2f6f9a', mote: '#8fd0e8' },
  hoa: { ring: '#f39b4a', mark: '#b4643a', mote: '#f4c24f' },
  tho: { ring: '#c8915f', mark: '#8a5a34', mote: '#ecd2a2' },
};
const GOLD = { ring: '#f4c24f', mark: '#d79c1c', mote: '#fff3c4' };

/** Hào quang theo độ hiếm (Quý: hồng, vì bảng màu không có tím; Huyền thoại: vàng kim, dày và nhiều hạt hơn). */
const AURAS = {
  quy: { inner: '#ffd1dc', rim: '#d9708a', ground: '#f4a3b4', spark: '#d9708a', rimD: 0.7, fillD: 0.25, motes: 3 },
  huyenthoai: { inner: '#fff3c4', rim: '#f4c24f', ground: '#f4c24f', spark: '#d79c1c', rimD: 0.9, fillD: 0.4, motes: 5 },
};

// ---------------------------------------------------------------- lão làng

function elder(ctx) {
  const { sk, view, pose, sp } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const [hcx] = sk.head;
  const silver = '#fbf1e3';
  // gậy chống bằng gỗ: bên trái bé (nhìn trước), phía trước (nhìn ngang), bên phải (nhìn sau)
  const top = bcy - bry * 0.6;
  const g = sk.ground;
  const x = view === 'S' ? bcx - brx - 2.5 : view === 'E' ? bcx + brx + 1.2 : bcx + brx + 2.5;
  const hook = view === 'N' ? -1 : 1;
  const stick = mEllipse(x, (top + g) / 2, 0.9, (g - top) / 2 + 0.4, 0, 8);
  const crook = mOr(mEllipse(x + hook * 1.2, top - 0.2, 1.6, 0.9, 0, 6), mEllipse(x + hook * 2.4, top + 0.8, 0.8, 1.0, 0, 6));
  ctx.parts.push(part('cane', mOr(stick, crook), 'wood', 6.5, { normal: [x - 0.5, top, 2, g - top] }));
  if (view === 'N') return;
  // lông mày bạc ngay trên mắt, chòm râu dưới miệng
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  const y0 = Math.floor(sk.eyeY - eh / 2 + 0.5);
  const eyes = view === 'S' ? [[-1, hcx - sk.eyeDx], [1, hcx + sk.eyeDx]] : [[1, sk.anchors.face[0]]];
  for (const [s, ex] of eyes) {
    const x0 = Math.floor(ex - ew / 2 + 0.5) + (pose.look ?? 0);
    for (let i = 0; i <= ew; i++) ctx.pixels.push([x0 + i - (s < 0 ? 1 : 0), y0 - 2, silver, 23]);
  }
  if (sp.face !== 'beak') {
    const mx = view === 'S' ? pyRound(hcx) : pyRound(sk.anchors.face[0] + 2);
    const ny = pyRound(sk.eyeY + 1.6);
    ctx.pixels.push([mx - 1, ny + 3, silver, 23], [mx, ny + 3, silver, 23], [mx - 1, ny + 4, silver, 23]);
  }
}

// ---------------------------------------------------------------- dáng theo cấp

function temples(ctx, col) {
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const rows = [pyRound(sk.eyeY) - 1, pyRound(sk.eyeY) + 1];
  if (view === 'S') {
    const d = Math.max(sk.eyeDx + 2, hrx - 2);
    const xr = Math.floor(hcx + d) - 1;
    const xl = Math.floor(2 * hcx) - 1 - xr;
    for (const y of rows) ctx.pixels.push([xr, y, col, 23], [xr - 1, y, col, 23], [xl, y, col, 23], [xl + 1, y, col, 23]);
  } else if (view === 'E') {
    const x = pyRound(sk.anchors.face[0]) - 4;
    for (const y of rows) ctx.pixels.push([x, y, col, 23], [x - 1, y, col, 23]);
  }
}

function flanks(ctx, col) {
  const { sk, view } = ctx;
  const [bcx, bcy, brx] = sk.body;
  const ys = [pyRound(bcy) - 1, pyRound(bcy) + 2];
  if (view === 'E') {
    for (const x of [pyRound(bcx - brx * 0.35), pyRound(bcx + brx * 0.1)]) for (const y of ys) ctx.pixels.push([x, y, col, 23], [x + 1, y + 1, col, 23]);
    return;
  }
  const xr = Math.floor(bcx + Math.max(2, brx - 2)) - 1;
  const xl = Math.floor(2 * bcx) - 1 - xr;
  for (const y of ys) ctx.pixels.push([xr, y, col, 23], [xr - 1, y + 1, col, 23], [xl, y, col, 23], [xl + 1, y + 1, col, 23]);
}

function spiritRing(ctx, img, col, form) {
  const { sk } = ctx;
  const [bcx, , brx] = sk.body;
  const gr = Math.round(brx + 5);
  const cx = Math.floor(bcx);
  const y0 = Math.min(45, Math.round(sk.ground) + 1);
  for (let x = -gr; x <= gr; x++) {
    if ((x + gr + ctx.tick) % 3 === 0) continue;
    const h = Math.round(Math.sqrt(Math.max(0, 1 - (x / (gr + 0.5)) ** 2)));
    const c = form >= 5 && (x + ctx.tick) % 2 ? GOLD.ring : col;
    put(img, cx + x, y0 - h, c);
    if (h) put(img, cx + x, y0 + h, c);
  }
}

function motes(ctx, img, color, n, tick) {
  const { sk } = ctx;
  const [bcx, , brx] = sk.body;
  const [, , hrx] = sk.head;
  const g = Math.round(sk.ground);
  const span = Math.max(4, g - Math.round(sk.htop));
  const reach = Math.round(Math.max(hrx, brx)) + 2;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const x = Math.floor(bcx) + side * (reach + (i >> 1) * 3);
    const y = g - ((tick * 4 + Math.round((i * span) / n)) % span);
    put(img, x, y, color);
    if ((tick + i) % 3 === 0) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(img, x + dx, y + dy, color);
      put(img, x, y, '#fffaf3');
    }
  }
}

// ---------------------------------------------------------------- hào quang

function aura(ctx, img, a) {
  const { sk } = ctx;
  const [bcx, , brx] = sk.body;
  const [, , hrx] = sk.head;
  const top = sk.htop - 2;
  const bottom = sk.ground;
  const cx = bcx;
  const cy = (top + bottom) / 2;
  const pulse = ctx.tick % 2;
  const rx = Math.max(hrx, brx) + 3 + pulse;
  const ry = (bottom - top) / 2 + 1 + pulse;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1 || d < 0.55) continue;
      const rim = d > 0.78;
      if (bayer(x, y) >= (rim ? a.rimD : a.fillD)) continue;
      put(img, x, y, rim ? a.rim : a.inner);
    }
  }
  const gr = Math.round(brx + 5);
  const g = Math.round(bottom);
  for (let x = -gr; x <= gr; x++) {
    const h = Math.round(2 * Math.sqrt(1 - (x / (gr + 0.5)) ** 2));
    for (let y = -h; y <= 0; y++) {
      const px = Math.floor(cx) + x;
      if (bayer(px, g + y) < 0.55) put(img, px, g + y + 1, a.ground);
    }
  }
}

// ---------------------------------------------------------------- bộ đồ cùng hành

function sparkles(ctx, img, el) {
  const { sk } = ctx;
  const [bcx, bcy, brx] = sk.body;
  const [hcx, hcy, hrx] = sk.head;
  const spots = [[hcx - hrx - 3, hcy - 3], [hcx + hrx + 2, hcy + 1], [bcx - brx - 3, bcy + 2], [bcx + brx + 2, bcy - 2]];
  spots.forEach(([fx, fy], i) => {
    if ((i + ctx.tick) % 2) return;
    const x = Math.round(fx);
    const y = Math.round(fy);
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) put(img, x + dx, y + dy, EL[el].mote);
    put(img, x + 1, y + 1, '#fffaf3');
    if ((i + ctx.tick) % 4 === 0) for (const [dx, dy] of [[-1, 1], [3, 1], [1, -1], [1, 3]]) put(img, x + dx, y + dy, EL[el].ring);
  });
}

// ---------------------------------------------------------------- điểm vào

const colOf = (ctx) => (ctx.form >= 5 ? GOLD : EL[ctx.sp.element] ?? null);

export const MARKS = {
  /** Trước khi tô bóng: gậy, lông mày, râu (lão làng), vạch thái dương (cấp 10+), vằn hông (cấp 20+). */
  body(ctx) {
    if (ctx.st.elder) elder(ctx);
    const c = colOf(ctx);
    if (!c) return;
    if (ctx.form >= 1) temples(ctx, c.mark);
    if (ctx.form >= 2) flanks(ctx, c.mark);
  },
  /** Trước khi dán pet: hào quang (Quý, Huyền thoại), vòng linh khí (cấp 30+). */
  behind(ctx, img) {
    const a = AURAS[ctx.sp.rarity];
    if (a) aura(ctx, img, a);
    const c = colOf(ctx);
    if (c && ctx.form >= 3) spiritRing(ctx, img, (EL[ctx.sp.element] ?? GOLD).ring, ctx.form);
  },
  /** Sau cùng: đốm sáng bay lên (hào quang, cấp 40+), sao lấp lánh của bộ đồ cùng hành (3 món trở lên). */
  front(ctx, img) {
    const a = AURAS[ctx.sp.rarity];
    if (a) motes(ctx, img, a.spark, a.motes, ctx.tick);
    const c = colOf(ctx);
    if (c && ctx.form >= 4) motes(ctx, img, c.mote, ctx.form >= 5 ? 4 : 2, ctx.tick + 1);
    const set = fullSetOf(ctx.wear);
    if (set && EL[set] && ELEMENTS[set]) sparkles(ctx, img, set);
  },
};
