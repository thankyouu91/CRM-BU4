// Dấu hiệu thêm lên pet: lão làng (gậy, lông mày, chòm râu bạc), dáng theo cấp (LEVEL_FORMS: vạch thái dương, vằn hông,
// vòng linh khí, đốm sáng, ánh vàng), hào quang bé Quý / Huyền thoại, và sao lấp lánh của bộ đồ cùng hành.
// Chủ sở hữu: họa sĩ hiệu ứng. Ba điểm vào, pipeline (index.js) gọi theo thứ tự:
//  - body(ctx): trước khi tô bóng; đẩy bộ phận tô bóng (gậy z 6.5, râu nhóm 'head') vào ctx.parts, điểm vào ctx.pixels
//    (lông mày z 23; vạch thái dương, vằn hông z 16 như hoa văn, chỉ ở chỗ lông thấy được, dưới má hồng và mắt);
//  - behind(ctx, img): trước khi dán pet (hào quang, vòng linh khí dưới chân), pet sẽ đè lên;
//  - front(ctx, img): sau cùng (đốm sáng bay lên, sao của bộ đồ), luôn ở NGOÀI đầu và thân nên không che mặt.
// TRẠNG THÁI: ĐÃ VẼ LẠI theo phong cách 16-bit (Rig 2.0), khóa 48 màu, mọi điểm đục, mọi thứ trong hàng/cột 1..46.
// Không có tinh chỉnh riêng theo loài: màu vạch, lông mày tự chọn theo độ nổi trên lông (inkOf, browOf).
// Bảng màu không có tím: Quý là ánh ngọc (bạc hà, mòng két, trắng sương), Huyền thoại là ánh vàng kim + kem.
// Hiệu ứng chạy theo ctx.tick (vòng lặp 6 khung liền mạch); người dùng bật "giảm chuyển động" (prefers-reduced-motion)
// thì mọi hiệu ứng đứng yên ở khung 0 (pet vẫn thở như cũ).
// Chỉ dựa vào bộ xương (ctx.sk) và các bộ phận đã có trong ctx.parts, nên tự khớp với dáng khung mới (round, serpent).
import { ELEMENTS, fullSetOf } from '../shared/pets.js';
import { FW, NPX, RAMPS, gait, mEllipse, mOr, newMask, oklab, part, pyRound, setPx } from './core.js';

// ---------------------------------------------------------------- tiện ích

const inCell = (x, y) => x >= 1 && y >= 1 && x <= 46 && y <= 46;
const put = (img, x, y, c) => {
  if (inCell(x, y)) setPx(img, x, y, c);
};

/** Ma trận Bayer 4×4 (ngưỡng 0..1) cho điểm dither đục. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

/** Người dùng xin giảm chuyển động: hiệu ứng đứng yên (khung 0). Trong Node (kiểm thử, contact sheet) luôn là không. */
let motionQuery;
function calm() {
  try {
    if (motionQuery === undefined) {
      motionQuery = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : null;
    }
    return Boolean(motionQuery?.matches);
  } catch {
    return false;
  }
}
const tickOf = (ctx) => (calm() ? 0 : ctx.tick ?? 0);

/** Mặt nạ từ danh sách điểm [x, y]. */
function mPts(pts) {
  const m = newMask();
  for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < FW && y < FW) m[y * FW + x] = 1;
  return m;
}

/** Đường thẳng 1 px (Bresenham) từ (x0, y0) tới (x1, y1). */
function linePts(x0, y0, x1, y1) {
  const pts = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    pts.push([x, y]);
    if (x === x1 && y === y1) return pts;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Hàng thấp nhất của mặt nạ trong các cột x0..x1 (−1 nếu trống). */
function lowestRow(m, x0, x1) {
  for (let y = FW - 1; y >= 0; y--) for (let x = Math.max(0, x0); x <= Math.min(FW - 1, x1); x++) if (m[y * FW + x]) return y;
  return -1;
}

/**
 * Thân pet (không tính đầu, tai, đuôi): các bộ phận z 3..6.4 khác nhóm 'head' (thân, bụng, tay, chân, cánh, mai).
 * Dùng để đặt gậy sát người và giới hạn vằn hông, với mọi dáng khung.
 */
function torsoMask(ctx) {
  const m = newMask();
  for (const p of ctx.parts) {
    if (p.group === 'head' || p.z < 3 || p.z > 6.4) continue;
    for (let k = 0; k < NPX; k++) m[k] |= p.mask[k];
  }
  return m;
}

/** Cột trái nhất / phải nhất của mặt nạ trong các hàng y0..y1. */
function spanX(m, y0, y1) {
  let a = FW;
  let b = -1;
  for (let y = Math.max(0, y0); y <= Math.min(FW - 1, y1); y++) {
    for (let x = 0; x < FW; x++) {
      if (!m[y * FW + x]) continue;
      if (x < a) a = x;
      if (x > b) b = x;
    }
  }
  return b < 0 ? null : [a, b];
}

/** Cả bóng hình của pet (mọi bộ phận, điểm, đồ cầm tay), chưa tính viền. */
function footprint(ctx) {
  const m = newMask();
  for (const p of [...ctx.parts, ...ctx.held.parts]) for (let k = 0; k < NPX; k++) m[k] |= p.mask[k];
  for (const [x, y] of [...ctx.pixels, ...ctx.held.pixels]) if (x >= 0 && y >= 0 && x < FW && y < FW) m[y * FW + x] = 1;
  return m;
}

/** Khoảng cách chamfer 3-4 tới mặt nạ (3 = 1 px thẳng, 4 = 1 px chéo). */
function chamfer(m) {
  const d = new Int32Array(NPX);
  for (let k = 0; k < NPX; k++) d[k] = m[k] ? 0 : 1 << 20;
  for (let y = 0; y < FW; y++) {
    for (let x = 0; x < FW; x++) {
      const k = y * FW + x;
      if (x > 0) d[k] = Math.min(d[k], d[k - 1] + 3);
      if (y > 0) {
        d[k] = Math.min(d[k], d[k - FW] + 3);
        if (x > 0) d[k] = Math.min(d[k], d[k - FW - 1] + 4);
        if (x < FW - 1) d[k] = Math.min(d[k], d[k - FW + 1] + 4);
      }
    }
  }
  for (let y = FW - 1; y >= 0; y--) {
    for (let x = FW - 1; x >= 0; x--) {
      const k = y * FW + x;
      if (x < FW - 1) d[k] = Math.min(d[k], d[k + 1] + 3);
      if (y < FW - 1) {
        d[k] = Math.min(d[k], d[k + FW] + 3);
        if (x < FW - 1) d[k] = Math.min(d[k], d[k + FW + 1] + 4);
        if (x > 0) d[k] = Math.min(d[k], d[k + FW - 1] + 4);
      }
    }
  }
  return d;
}

/** Sao lấp lánh 4 cánh tại (x, y): size 1 = một điểm, 2 = dấu cộng, 3 = cộng dài. c = [lõi, cánh, chóp]. Bỏ cả sao nếu chạm mép. */
function twinkle(img, x, y, size, c) {
  if (size <= 0) return;
  const r = size - 1;
  if (!inCell(x - r, y - r) || !inCell(x + r, y + r)) return;
  if (size >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(img, x + dx, y + dy, c[1]);
  if (size >= 3) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(img, x + dx, y + dy, c[2]);
  put(img, x, y, c[0]);
}

// ---------------------------------------------------------------- màu

/**
 * Màu "mực vẽ" của vạch/vằn theo hành: màu chính trước, rồi các màu dự phòng (tối tới sáng) cho lông cùng màu.
 * Cấp 50 (Thần thái) mọi thứ hóa vàng. Toàn màu trong bảng 48 màu.
 */
const INKS = {
  kim: ['#d79c1c', '#8a5a34', '#f4c24f', '#fff3c4'],
  moc: ['#3e7a3f', '#2f5a3a', '#4e9a45', '#8fcf6a', '#c4e89a'],
  thuy: ['#2f6f9a', '#3f8fc0', '#58b9d6', '#8fd0e8'],
  hoa: ['#e84a5f', '#a84848', '#f39b4a', '#f4c24f'],
  tho: ['#8a5a34', '#5c3a24', '#b87d4b', '#ecd2a2'],
  gold: ['#d79c1c', '#fff3c4', '#f4c24f', '#8a5a34'],
};

/** Khoảng cách màu OKLab (sắc độ a, b nặng gấp 2, như phép ép bảng màu). */
function dist(a, b) {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, 2 * (a1 - a2), 2 * (b1 - b2));
}
/** Độ nổi của màu c trên lông: khoảng cách nhỏ nhất tới bậc giữa và bậc sáng của dải thân (phần lông thấy nhiều nhất). */
function onFur(ctx, c) {
  const fur = RAMPS[ctx.ramps.main];
  return Math.min(dist(c, fur[2]), dist(c, fur[3]));
}

/** Màu vạch/vằn: màu đầu tiên trong INKS[kind] đủ nổi trên lông (≥ 0.24), không thì màu nổi nhất. */
function inkOf(ctx, kind) {
  const list = INKS[kind];
  for (const c of list) if (onFur(ctx, c) >= 0.24) return c;
  return list.reduce((a, b) => (onFur(ctx, b) > onFur(ctx, a) ? b : a));
}

/** Màu lông mày bạc nổi trên lông: trắng kem; lông trắng hoặc vàng nhạt thì bạc nhạt, rồi bạc đậm. */
function browOf(ctx) {
  for (const c of ['#fffaf3', '#c4bcb0']) if (onFur(ctx, c) >= 0.2) return c;
  return '#9c948a';
}

// ---------------------------------------------------------------- lão làng

/** Điểm của bộ phận gắn trên người: chừa 1 px cho viền, nên viền vẫn nằm trong hàng/cột 1..46. */
const inBody = (x, y) => x >= 2 && y >= 2 && x <= 45 && y <= 45;

/**
 * Gậy tre: cán 1 px, đầu móc cong về phía tay. S: bên trái người xem (tay phải của bé), móc qua bàn tay;
 * E: trước ngực, dưới cằm, đầu gậy đưa theo bước đi; N: bên phải người xem, sau thân (chỉ thò cán và móc ra ngoài).
 * Tay cầm gậy giơ lên (vẫy, nhảy, bận rộn) thì gậy nhấc theo. Dải 'tan' (tre vàng) để nổi trên cả lông nâu lẫn lông sáng.
 */
function cane(ctx) {
  const { sk, view, pose } = ctx;
  const [bcx, bcy] = sk.body;
  const tip = Math.round(sk.ground) - 1;
  const span = spanX(torsoMask(ctx), Math.round(bcy) - 2, tip) ?? [Math.round(bcx) - 6, Math.round(bcx) + 5];
  const up = view === 'S' ? pose.armL ?? 0 : view === 'N' ? pose.armR ?? 0 : 0;
  const lift = Math.round(up * 3);
  let sx;
  let h;
  let z;
  if (view === 'S') [sx, h, z] = [span[0] - 2 - Math.round(up), 1, 6.5];
  else if (view === 'N') [sx, h, z] = [span[1] + 2 + Math.round(up), -1, 2.5];
  else [sx, h, z] = [span[1] + 4, -1, 6.5]; // một cột trống giữa gậy và chân trước: gậy không lẫn thành chân thứ năm
  sx = Math.max(2, Math.min(45, sx));
  // Thanh ngang của móc: ngang tay (giữa thân); nhìn ngang thì luôn thấp hơn cằm ở các cột của móc để thấy được.
  const cols = h > 0 ? [sx, sx + 3] : [sx - 3, sx];
  const headLow = ctx.headMask ? lowestRow(ctx.headMask, cols[0], cols[1]) : -1;
  let bar = Math.round(bcy - 1.5) - lift;
  if (view === 'E') bar = Math.max(bar, headLow + 2);
  bar = Math.max(3, Math.min(bar, tip - lift - 4));
  const { s: si } = gait(pose);
  const tx = sx + (view === 'E' ? pyRound(-si * 0.5) : 0);
  const pts = linePts(tx, bar + 1, sx, tip - lift);
  pts.push([tx, bar], [tx + h, bar - 1], [tx + 2 * h, bar - 1], [tx + 3 * h, bar]);
  const m = mPts(pts.filter(([x, y]) => inBody(x, y) && y <= 43));
  ctx.parts.push(part('cane', m, 'tan', z, { normal: [tx + 1, (bar + tip) / 2, 2, (tip - bar) / 2 + 2] }));
}

/**
 * Lông mày bạc rậm, đuôi rủ xuống ngoài khóe mắt (điểm z 23); chòm râu dê trắng dưới miệng, thò qua cằm xuống ngực
 * (bộ phận nhóm 'head': không kẻ nét trên mặt, có nét ở chỗ đè lên ngực). Mặt mỏ (chim) không có râu. Nhìn sau: không có.
 */
const BEARD = {
  S: [[-2, 1], [-2, 1], [-2, 1], [-1, 0], [-1, -1]],
  E: [[-1, 1], [-1, 1], [-1, 0], [-2, -1]],
};
function browsAndBeard(ctx) {
  const { sk, view, pose, sp } = ctx;
  if (view === 'N') return;
  const [hcx, , hrx] = sk.head;
  const brow = browOf(ctx);
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  const y0 = Math.floor(sk.eyeY - eh / 2 + 0.5);
  const look = pose.look ?? 0;
  const list = view === 'S' ? [[-1, hcx - sk.eyeDx], [1, hcx + sk.eyeDx]] : [[-1, sk.anchors.face[0]]];
  const by = y0 - 2 + (pose.mouth === 'sad' ? 1 : 0);
  for (const [s, ex] of list) {
    const x0 = Math.floor(ex - ew / 2 + 0.5) + look;
    const outer = s < 0 ? x0 - 1 : x0 + ew;
    for (let x = Math.min(x0, outer); x <= Math.max(x0 + ew - 1, outer); x++) ctx.pixels.push([x, by, brow, 23]);
    ctx.pixels.push([outer + s, by + 1, brow, 23]);
  }
  if (sp.face === 'beak') return;
  const top = view === 'S' ? pyRound(sk.eyeY + 1.6) + 4 : pyRound(sk.eyeY + 1.5) + 3;
  const x = view === 'S' ? pyRound(hcx) : pyRound(hcx + hrx * 0.62);
  const pts = [];
  BEARD[view].forEach(([a, b], j) => {
    for (let i = a; i <= b; i++) pts.push([x + i, top + j]);
  });
  const rows = BEARD[view].length;
  ctx.parts.push(part('beard', mPts(pts.filter(([px, py]) => inBody(px, py))), 'white', ctx.zh + 0.12, {
    group: 'head', normal: [x - 1.5, top + 0.5, 3.2, rows],
  }));
}

// ---------------------------------------------------------------- dáng theo cấp

/**
 * Bộ phận nằm trên cùng ở từng điểm (như phép tô của colourise: z lớn hơn che z nhỏ, bằng nhau thì bộ phận sau che),
 * để vạch/vằn (điểm tô thẳng) chỉ hiện ở chỗ lông thật sự thấy được.
 */
function topParts(ctx) {
  const top = new Int32Array(NPX).fill(-1);
  const order = [...ctx.parts.keys()].sort((i, j) => ctx.parts[i].z - ctx.parts[j].z);
  for (const i of order) {
    const m = ctx.parts[i].mask;
    for (let k = 0; k < NPX; k++) if (m[k]) top[k] = i;
  }
  return top;
}

/** Đẩy điểm vạch (z 16, như hoa văn: dưới má hồng và mắt) ở những chỗ bộ phận trên cùng thỏa `ok(part)`. */
function paint(ctx, pts, color, ok, top = topParts(ctx)) {
  const seen = new Set();
  for (const [x, y] of pts) {
    if (!inBody(x, y)) continue;
    const k = y * FW + x;
    const i = top[k];
    if (seen.has(k) || i < 0 || !ok(ctx.parts[i])) continue;
    seen.add(k);
    ctx.pixels.push([x, y, color, 16]);
  }
}
/** Lông đầu (đầu, mõm, mặt nạ, hoa văn đầu), không phải tai rủ, mỏ hay đồ trên đầu. */
const onHead = (ctx) => (p) => p.group === 'head' && p.z >= ctx.zh - 0.1 && p.z <= ctx.zh + 0.16;
/** Lông thân (thân, bụng, tay, chân, cánh, mai), không phải đầu, tai, đuôi. */
const onTorso = (p) => p.group !== 'head' && p.z >= 3 && p.z <= 6.4 && !p.name.startsWith('tail') && !p.name.startsWith('ear');

/**
 * Vạch thái dương (cấp 10+): mỗi bên hai nét ngắn 2 px ở mép đầu ngang mắt, nét dưới lệch ra ngoài (S và N, cách mắt
 * ít nhất 1 cột); nhìn ngang: hai nét sau đuôi mắt, lệch về phía tai. Màu hành tương phản với lông (inkOf).
 */
function temples(ctx, kind) {
  const { sk, view } = ctx;
  const [hcx] = sk.head;
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  const y0 = Math.floor(sk.eyeY - eh / 2 + 0.5);
  const top = topParts(ctx);
  const head = onHead(ctx);
  const pts = [];
  if (view === 'E') {
    const x0 = Math.floor(sk.anchors.face[0] - ew / 2 + 0.5);
    pts.push([x0 - 4, y0], [x0 - 3, y0], [x0 - 5, y0 + 2], [x0 - 4, y0 + 2]);
  } else {
    for (const s of [-1, 1]) {
      const eyeX = Math.floor(hcx + s * sk.eyeDx - ew / 2 + 0.5);
      const eyeOut = s > 0 ? eyeX + ew - 1 : eyeX; // cột ngoài cùng của mắt
      for (const [y, inset] of [[y0, 2], [y0 + 2, 1]]) {
        // mép đầu thấy được ở hàng y
        let edge = -1;
        for (let x = s > 0 ? FW - 1 : 0; x >= 0 && x < FW; x -= s) {
          const i = top[y * FW + x];
          if (i >= 0 && head(ctx.parts[i])) {
            edge = x;
            break;
          }
        }
        if (edge < 0) continue;
        let a = edge - s * (inset + 1);
        if (view === 'S' && s * (a - eyeOut) < 2) a = eyeOut + 2 * s; // chừa 1 cột giữa vạch và mắt
        pts.push([a, y], [a + s, y]);
      }
    }
  }
  paint(ctx, pts, inkOf(ctx, kind), head, top);
}

/** Vằn hông (cấp 20+): hai nét cong vào từ mép thân mỗi bên (S, N), ba nét dọc từ sống lưng xuống (E). Vẽ cả lên tay. */
function flanks(ctx, kind) {
  const { sk, view } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const ms = [];
  if (view === 'E') {
    const top = bcy - bry;
    for (const f of [-0.55, -0.15, 0.25]) ms.push(mEllipse(bcx + f * brx, top + 2.2, 0.55, 1.9, 0.3));
  } else {
    const yb = view === 'N' ? bcy - 2 : bcy - 1.2;
    for (const s of [-1, 1]) for (const k of [0, 1]) ms.push(mEllipse(bcx + s * (brx - 1.3), yb + k * 2.6, 1.7, 0.5, s * 0.35));
  }
  const m = mOr(...ms);
  const pts = [];
  for (let k = 0; k < NPX; k++) if (m[k]) pts.push([k % FW, Math.floor(k / FW)]);
  paint(ctx, pts, inkOf(ctx, kind), onTorso);
}

/** Màu vòng linh khí và đốm sáng theo hành: [đậm, sáng, ánh]. Hai màu xen kẽ để nổi trên cỏ, đường đất, sàn gỗ và nền kem. */
const GLOW = {
  kim: ['#d79c1c', '#f4c24f', '#fffaf3'],
  moc: ['#3e7a3f', '#c4e89a', '#fffaf3'],
  thuy: ['#3f8fc0', '#8fd0e8', '#eef8fb'],
  hoa: ['#e84a5f', '#f39b4a', '#fff3c4'],
  tho: ['#b87d4b', '#ecd2a2', '#fffaf3'],
  gold: ['#d79c1c', '#f4c24f', '#fffaf3'],
};

/**
 * Vòng linh khí (cấp 30+): vòng elip dẹt liền nét trên mặt đất quanh chân (lớp sau pet: chân che nửa sau), từng đoạn 2 px
 * xen kẽ đậm/sáng xoay theo tick, ba đốm ánh chạy vòng. Cấp 50: vòng vàng, bốn đốm ánh. Nằm gọn trong hàng ≤ 46.
 */
function spiritRing(ctx, img, c, form) {
  const { sk } = ctx;
  const t = tickOf(ctx);
  const [bcx, , brx] = sk.body;
  const g = Math.round(sk.ground);
  const span = spanX(torsoMask(ctx), g - 4, g - 1);
  const cx = span ? (span[0] + span[1] + 1) / 2 : bcx;
  const half = span ? (span[1] - span[0] + 1) / 2 : brx;
  const rx = Math.max(4, Math.min(Math.max(half + 4, brx + 4.5), cx - 1.5, 46.5 - cx));
  const ry = Math.max(2, Math.min(3, rx * 0.24));
  // vòng nằm trên mặt đất thật: bé nhảy (lift) thì nhảy ra khỏi vòng, vòng không bay theo
  const cy = Math.min(sk.ground - (ctx.pose.lift ?? 0) + 0.5, 46.9 - ry);
  const n = form >= 5 ? 4 : 3;
  const per = Math.round(2 * Math.PI * Math.max(rx, ry) * 3);
  const segs = 2 * Math.max(5, Math.round((Math.PI * (rx + ry)) / 6));
  const done = new Set();
  for (let i = 0; i < per; i++) {
    const u = i / per;
    const a = u * 2 * Math.PI;
    const x = Math.floor(cx + Math.cos(a) * rx);
    const y = Math.floor(cy + Math.sin(a) * ry);
    const key = y * FW + x;
    if (done.has(key)) continue;
    done.add(key);
    let glint = false;
    for (let j = 0; j < n; j++) {
      const p = (((u - j / n - t / (6 * n)) % 1) + 1) % 1;
      if (p < 0.022 || p > 0.99) glint = true;
    }
    // nửa sau (trên) màu sáng, nửa trước (dưới) xen kẽ đậm/sáng xoay theo tick
    const dark = y + 0.5 >= cy && (Math.floor(u * segs) + t) & 1;
    put(img, x, y, glint ? c[2] : dark ? c[0] : c[1]);
  }
}

/**
 * Đốm sáng bay lên hai bên người: luôn ở ngoài bóng hình pet (cách viền 2 px), nên không che mặt.
 * Hình theo hành: kim ánh kim (sao), moc lá non, thuy giọt nước, hoa tàn lửa, tho hạt bụi vàng; gold: sao vàng (cấp 50).
 */
function motes(ctx, img, kind, n, phase = 0) {
  const { sk } = ctx;
  const t = tickOf(ctx) + phase;
  const c = GLOW[kind] ?? GLOW.gold;
  const g = Math.round(sk.ground) - 1;
  const top = Math.max(4, Math.round(sk.htop) + 2);
  const spanY = Math.max(6, g - 3 - top);
  const fp = footprint(ctx);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const y = g - 3 - Math.round((((t + (i * 6) / n + (i >> 1) * 1.5) % 6) / 6) * spanY);
    const row = spanX(fp, y - 2, y + 2);
    if (!row) continue;
    const x = side < 0 ? row[0] - 3 - (i >> 1) : row[1] + 3 + (i >> 1);
    if (!inCell(x - 1, y - 1) || !inCell(x + 1, y + 1)) continue;
    const big = (t + i) % 3 === 0;
    if (kind === 'moc') {
      put(img, x, y, c[1]);
      put(img, x - side, y, c[1]);
      put(img, x, y - 1, c[1]);
      put(img, x - side, y + 1, c[0]);
      if (big) put(img, x + side, y - 1, c[2]);
    } else if (kind === 'thuy') {
      put(img, x, y - 1, c[2]);
      put(img, x, y, c[1]);
      put(img, x - 1, y + 1, c[1]);
      put(img, x, y + 1, c[0]);
      put(img, x + 1, y + 1, c[1]);
    } else if (kind === 'hoa') {
      put(img, x, y, big ? c[2] : c[1]);
      put(img, x, y + 1, c[0]);
      if (big) put(img, x, y - 1, c[1]);
    } else if (kind === 'tho') {
      put(img, x, y, c[1]);
      put(img, x + 1, y, c[0]);
      put(img, x, y + 1, c[0]);
      if (big) put(img, x - 1, y - 1, c[2]);
    } else {
      twinkle(img, x, y, big ? 2 : 1, [c[2], c[1], c[0]]);
    }
  }
}

// ---------------------------------------------------------------- hào quang

/**
 * Hào quang (lớp sau pet): vầng sáng ôm theo bóng hình (đã bo tròn các khe giữa tai, giữa chân), ba lớp từ trong ra:
 * một vòng liền màu sáng, một vòng caro gợn theo tick, một lớp hạt thưa trôi lên. Vài ngôi sao 4 cánh nhấp nháy so le.
 * Huyền thoại: vàng kim và kem, dày hơn, 5 sao (sao lớn). Quý: ngọc (bạc hà, mòng két, trắng sương), 3 sao nhỏ hơn.
 * Không xuống dưới hàng chân (chỗ bóng đổ của game). Mọi điểm đục, trong hàng/cột 1..46.
 */
export const AURAS = {
  huyenthoai: { band: ['#f4c24f', ['#fff3c4', '#f4c24f'], '#f4c24f'], dens: [1, 0.5, 0.25], star: ['#fffaf3', '#f4c24f', '#d79c1c'], stars: 5, big: 3 },
  quy: { band: ['#8fd3bf', ['#eef8fb', '#4fae93'], '#4fae93'], dens: [1, 0.5, 0.19], star: ['#eef8fb', '#8fd3bf', '#4fae93'], stars: 3, big: 2 },
};
const STAR_ANGLES = [-150, -100, -55, -15, 200, 25];

/** Bóng hình đã bo tròn (đóng hình thái học bán kính 2): khe hẹp giữa tai, giữa chân được lấp. */
function closedShape(fp) {
  const d0 = chamfer(fp);
  const out = newMask();
  for (let k = 0; k < NPX; k++) out[k] = d0[k] <= 6 ? 0 : 1;
  const d1 = chamfer(out);
  const m = newMask();
  for (let k = 0; k < NPX; k++) m[k] = fp[k] || d1[k] > 6 ? 1 : 0;
  return m;
}

function aura(ctx, img, A) {
  const { sk } = ctx;
  const t = tickOf(ctx);
  const fp = footprint(ctx);
  const d = chamfer(closedShape(fp));
  const near = chamfer(fp);
  const g = Math.round(sk.ground);
  const breathe = t % 6 >= 2 && t % 6 <= 4 ? 1 : 0;
  for (let y = 1; y <= Math.min(46, g); y++) {
    for (let x = 1; x <= 46; x++) {
      const k = y * FW + x;
      if (near[k] <= 3) continue; // pet và viền của pet
      const r = d[k] / 3;
      if (r <= 0) continue;
      const b = r <= 2.01 ? 0 : r <= 3.01 ? 1 : r <= 4.01 + breathe ? 2 : -1;
      if (b < 0) continue;
      if (b === 2 && bayer(x, y + t) >= A.dens[2]) continue; // hạt thưa trôi lên
      // lớp giữa: caro hai màu (sáng / đậm) đổi pha mỗi khung, nổi trên cả nền kem lẫn cỏ
      const c = b === 1 ? A.band[1][(x + y + t) & 1] : A.band[b];
      put(img, x, y, c);
    }
  }
  const [bcx] = sk.body;
  const cy = (sk.htop + g) / 2;
  for (let k = 0; k < A.stars; k++) {
    const a = (STAR_ANGLES[k] * Math.PI) / 180;
    let x = bcx;
    let y = cy;
    for (let s = 0; s < 60; s++) {
      if (d[Math.floor(y) * FW + Math.floor(x)] >= 15) break;
      x += Math.cos(a) * 0.5;
      y += Math.sin(a) * 0.5;
      if (!inCell(Math.floor(x), Math.floor(y))) break;
    }
    const ph = (t + k * 2) % 6;
    twinkle(img, Math.floor(x), Math.min(g - 3, Math.floor(y)), [1, 2, A.big, 2, 1, 0][ph], A.star);
  }
}

// ---------------------------------------------------------------- bộ đồ cùng hành

/** Bộ đồ cùng hành (3 món trở lên): bốn ngôi sao màu hành nhấp nháy so le quanh đầu và thân (ngoài khối đầu, thân). */
function sparkles(ctx, img, el) {
  const { sk } = ctx;
  const t = tickOf(ctx);
  const [bcx, bcy, brx] = sk.body;
  const [hcx, hcy, hrx] = sk.head;
  const c = GLOW[el] ?? GLOW.gold;
  const spots = [[hcx - hrx - 3, hcy - 3], [hcx + hrx + 3, hcy + 1], [bcx - brx - 4, bcy + 2], [bcx + brx + 4, bcy - 2]];
  spots.forEach(([fx, fy], i) => {
    const ph = (t + i * 3) % 4;
    twinkle(img, Math.round(fx), Math.round(fy), [1, 2, 1, 0][ph], [c[2], c[1], c[0]]);
  });
}

// ---------------------------------------------------------------- điểm vào

const markKind = (ctx) => (ctx.form >= 5 ? 'gold' : INKS[ctx.sp.element] ? ctx.sp.element : null);
const glowOf = (ctx) => (ctx.form >= 5 ? 'gold' : GLOW[ctx.sp.element] ? ctx.sp.element : null);

export const MARKS = {
  /** Trước khi tô bóng: gậy, lông mày, râu (lão làng), vạch thái dương (cấp 10+), vằn hông (cấp 20+). */
  body(ctx) {
    if (ctx.st.elder) {
      cane(ctx);
      browsAndBeard(ctx);
    }
    const kind = markKind(ctx);
    if (!kind) return;
    if (ctx.form >= 1) temples(ctx, kind);
    if (ctx.form >= 2) flanks(ctx, kind);
  },
  /** Trước khi dán pet: hào quang (Quý, Huyền thoại), vòng linh khí (cấp 30+). */
  behind(ctx, img) {
    const a = AURAS[ctx.sp.rarity];
    if (a) aura(ctx, img, a);
    const k = glowOf(ctx);
    if (k && ctx.form >= 3) spiritRing(ctx, img, GLOW[k], ctx.form);
  },
  /** Sau cùng: đốm sáng bay lên (cấp 40+), sao lấp lánh của bộ đồ cùng hành (3 món trở lên). */
  front(ctx, img) {
    const k = glowOf(ctx);
    if (k && ctx.form >= 4) motes(ctx, img, k, ctx.form >= 5 ? 4 : 2, 1);
    const set = fullSetOf(ctx.wear);
    if (set && ELEMENTS[set]) sparkles(ctx, img, set);
  },
};
