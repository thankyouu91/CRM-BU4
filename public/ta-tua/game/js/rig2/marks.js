// Dấu hiệu thêm lên pet: lão làng (gậy, lông mày, chòm râu bạc), dáng theo cấp (LEVEL_FORMS: vạch thái dương, vằn hông,
// vòng linh khí, đốm sáng, ánh vàng), hào quang bé Quý / Huyền thoại, và sao lấp lánh của bộ đồ cùng hành.
// Chủ sở hữu: họa sĩ hiệu ứng. Ba điểm vào, pipeline (index.js) gọi theo thứ tự:
//  - body(ctx): trước khi tô bóng; đẩy bộ phận tô bóng (gậy z 6.5, râu nhóm 'head') vào ctx.parts, điểm vào ctx.pixels
//    (lông mày z 23; vạch thái dương, vằn hông z 16 như hoa văn, chỉ ở chỗ lông thấy được, dưới má hồng và mắt);
//  - behind(ctx, img): trước khi dán pet (hào quang, vòng linh khí dưới chân), pet sẽ đè lên;
//  - front(ctx, img): sau cùng (đốm sáng bay lên, sao của bộ đồ), luôn cách bóng hình ĐÃ GHÉP (pet, viền, đồ đeo, đồ cầm)
//    ít nhất một điểm trống, nên không che mặt, thân hay món đồ nào.
// TRẠNG THÁI: ĐÃ VẼ LẠI theo phong cách 16-bit (Rig 2.0), khóa 48 màu, mọi điểm đục, mọi thứ trong hàng/cột 1..46.
// Không có tinh chỉnh riêng theo loài: màu vạch được chọn TỪNG ĐIỂM theo màu lông thật nằm dưới (underAt chép đúng
// phép tô colourise cho riêng các điểm cần vẽ: đủ bậc tối, giữa, sáng, bóng đổ, kể cả hoa văn), nên vạch nổi cả ở nửa tối
// của thân to; không vẽ đè nét trong. Lông mày: một màu cố định theo dải lông của loài (browOf).
// Còn để ngỏ: hào quang (lớp sau pet) không ôm theo đồ đội đầu, vì marks.js không vẽ được đồ đeo (mũ, vương miện nằm
// đè lên vầng sáng, đúng thứ tự lớp); lớp front thì đã né mọi món đồ vì đọc bóng hình đã ghép.
// Bảng màu không có tím: Quý là ánh ngọc (bạc hà, mòng két, trắng sương), Huyền thoại là ánh vàng kim + kem.
// Nhịp hiệu ứng (ctx.tick): chu kỳ 6 khung cho chuyển động trôi (đốm sáng bay lên, ánh chạy quanh vòng, bụi hào quang
// bay lên, sao hào quang), nên liền mạch ở idle, walk, think (6 khung); chu kỳ 2 cho nhấp nháy (sao của bộ đồ, caro
// hào quang), liền mạch ở mọi hoạt ảnh. Các cảm xúc 4 khung (sad, busy, spin) chơi trọn 4/6 nhịp trôi rồi quay lại.
// Người dùng bật "giảm chuyển động" (prefers-reduced-motion) thì mọi hiệu ứng đứng yên ở khung 0 (pet vẫn thở như cũ).
// Chỉ dựa vào bộ xương (ctx.sk) và các bộ phận đã có trong ctx.parts, nên tự khớp với dáng khung mới (round, serpent).
import { ELEMENTS, fullSetOf } from '../shared/pets.js';
import { FW, INK, LIGHT, NPX, RAMPS, gait, newMask, oklab, part, pyRound, setPx } from './core.js';

// ---------------------------------------------------------------- tiện ích

const inCell = (x, y) => x >= 1 && y >= 1 && x <= 46 && y <= 46;
const put = (img, x, y, c) => {
  if (inCell(x, y)) setPx(img, x, y, c);
};

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

/**
 * Bộ nhớ đệm theo khung hình (một ctx = một khung): bóng hình, bộ phận trên cùng, bản tô thử, lớp hào quang đã vẽ.
 * Mỗi mục kèm "chữ ký" (số bộ phận, số điểm...) nên tự tính lại khi body() vừa thêm gậy hay râu.
 */
const memo = new WeakMap();
function once(ctx, key, sig, make) {
  let c = memo.get(ctx);
  if (!c) memo.set(ctx, (c = {}));
  if (!c[key] || c[key].sig !== sig) c[key] = { sig, v: make() };
  return c[key].v;
}

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

/** Lông thân (thân, bụng, tay, chân, cánh, mai), không phải đầu, tai, đuôi, gậy. */
const onTorso = (p) => p.group !== 'head' && p.z >= 3 && p.z <= 6.4 && !p.name.startsWith('tail') && !p.name.startsWith('ear');
/** Tay, cánh (giơ lên được): không tính vào chỗ đứng của gậy, để gậy không trượt khi bé giơ tay. */
const isLimb = (p) => /^(arm|wing)/.test(p.name);

/** Thân pet (không tính đầu, tai, đuôi, gậy): các bộ phận z 3..6.4 khác nhóm 'head'. `trunk`: bỏ cả tay, cánh. */
const torsoPart = (trunk) => (p) => p.group !== 'head' && p.z >= 3 && p.z <= 6.4 && !(trunk && isLimb(p));

/**
 * Cột trái nhất / phải nhất của các bộ phận thỏa `keep` (cộng mặt nạ `extra` nếu có) trong các hàng y0..y1: như
 * spanX(mặt nạ gộp) nhưng chỉ duyệt mấy hàng cần, không dựng cả mặt nạ 48 × 48.
 */
function spanParts(ctx, keep, y0, y1, extra = null) {
  let a = FW;
  let b = -1;
  const ms = ctx.parts.filter(keep).map((p) => p.mask);
  if (extra) ms.push(extra);
  for (let y = Math.max(0, y0); y <= Math.min(FW - 1, y1); y++) {
    for (const m of ms) {
      for (let x = 0; x < a; x++) if (m[y * FW + x]) a = x;
      for (let x = FW - 1; x > b; x--) if (m[y * FW + x]) b = x;
    }
  }
  return b < 0 ? null : [a, b];
}

/** Cả bóng hình của pet (mọi bộ phận, điểm, đồ cầm tay), chưa tính viền. */
function footprint(ctx) {
  const sig = `${ctx.parts.length}|${ctx.pixels.length}|${ctx.held.parts.length}|${ctx.held.pixels.length}`;
  return once(ctx, 'fp', sig, () => {
    const top = topParts(ctx);
    const m = newMask();
    for (let k = 0; k < NPX; k++) m[k] = top[k] >= 0 ? 1 : 0;
    for (const p of ctx.held.parts) for (let k = 0; k < NPX; k++) m[k] |= p.mask[k];
    for (const [x, y] of [...ctx.pixels, ...ctx.held.pixels]) if (x >= 0 && y >= 0 && x < FW && y < FW) m[y * FW + x] = 1;
    return m;
  });
}

/** Lớp đồ cầm tay (cốc trà sữa của Boba) nới thêm 1 px cho viền riêng của nó: vạch, gậy không nằm dưới lớp này. */
function heldMask(ctx) {
  const sig = `${ctx.held.parts.length}|${ctx.held.pixels.length}`;
  return once(ctx, 'held', sig, () => {
    const m = newMask();
    for (const p of ctx.held.parts) for (let k = 0; k < NPX; k++) m[k] |= p.mask[k];
    for (const [x, y] of ctx.held.pixels) if (x >= 0 && y >= 0 && x < FW && y < FW) m[y * FW + x] = 1;
    const out = newMask();
    for (let k = 0; k < NPX; k++) {
      if (!m[k]) continue;
      const x = k % FW;
      for (const q of [k, k - FW, k + FW, x > 0 ? k - 1 : -1, x < FW - 1 ? k + 1 : -1]) if (q >= 0 && q < NPX) out[q] = 1;
    }
    return out;
  });
}

/**
 * Bóng hình đã ghép trên khung (lớp front): pet, viền, đồ đeo, đồ cầm, bong bóng; KHÔNG tính lớp behind (hào quang,
 * vòng linh khí) mà chính file này vẽ: điểm nào còn đúng màu lớp behind đã vẽ thì vẫn là nền.
 */
function solidMask(ctx, img) {
  const back = memo.get(ctx)?.behindLayer?.v;
  const m = newMask();
  for (let k = 0; k < NPX; k++) {
    const j = k * 4;
    if (!img.data[j + 3]) continue;
    if (back && back[j + 3] && back[j] === img.data[j] && back[j + 1] === img.data[j + 1] && back[j + 2] === img.data[j + 2]) continue;
    m[k] = 1;
  }
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

/** Các điểm của sao 4 cánh cỡ `size` tại (x, y) (1 = một điểm, 2 = dấu cộng, 3 = cộng dài). */
function starPts(x, y, size) {
  const pts = [[x, y]];
  if (size >= 2) pts.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  if (size >= 3) pts.push([x + 2, y], [x - 2, y], [x, y + 2], [x, y - 2]);
  return pts;
}

/**
 * Sao lấp lánh 4 cánh tại (x, y). c = [lõi, cánh, chóp]. Cỡ 1 là một điểm màu CÁNH (lõi trắng sẽ biến mất trên nền kem
 * của game); cỡ 2 trở lên mới có lõi trắng giữa các cánh. Bỏ cả sao nếu chạm mép.
 */
function twinkle(img, x, y, size, c) {
  if (size <= 0) return;
  const r = size - 1;
  if (!inCell(x - r, y - r) || !inCell(x + r, y + r)) return;
  if (size === 1) {
    put(img, x, y, c[1]);
    return;
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(img, x + dx, y + dy, c[1]);
  if (size >= 3) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(img, x + dx, y + dy, c[2]);
  put(img, x, y, c[0]);
}

/** Điểm (x, y) cách mặt nạ ít nhất một điểm trống (không có điểm đặc nào trong ô 3 × 3 quanh nó). */
function clear(mask, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const qx = x + dx;
      const qy = y + dy;
      if (qx >= 0 && qy >= 0 && qx < FW && qy < FW && mask[qy * FW + qx]) return false;
    }
  }
  return true;
}

/**
 * Chỗ đặt một hiệu ứng nhỏ ngoài bóng hình: bắt đầu cách mép ngoài cùng của hàng y (± r + 1 hàng) một điểm trống,
 * rồi lùi ra xa tới khi mọi điểm `pts(x, y)` cách bóng hình ít nhất một điểm trống và nằm trong ô; không được thì null.
 */
function besideShape(mask, y, side, r, pts) {
  const row = spanX(mask, y - r - 1, y + r + 1);
  if (!row) return null;
  let x = side < 0 ? row[0] - 2 - r : row[1] + 2 + r;
  for (let tries = 0; tries < 4; tries++, x += side) {
    const ps = pts(x, y);
    if (ps.some(([px, py]) => !inCell(px, py))) return null;
    if (ps.every(([px, py]) => clear(mask, px, py))) return x;
  }
  return null;
}

// ---------------------------------------------------------------- màu

/** Khoảng cách màu OKLab (sắc độ a, b nặng gấp 2, như phép ép bảng màu). */
const distMemo = new Map();
function dist(a, b) {
  const key = a < b ? a + b : b + a;
  let d = distMemo.get(key);
  if (d === undefined) {
    const [l1, a1, b1] = oklab(a);
    const [l2, a2, b2] = oklab(b);
    d = Math.hypot(l1 - l2, 2 * (a1 - a2), 2 * (b1 - b2));
    distMemo.set(key, d);
  }
  return d;
}

/**
 * Màu "mực vẽ" của vạch/vằn theo hành, theo thứ tự ưu tiên: điểm nào cũng lấy màu ĐẦU TIÊN đủ nổi (≥ 0.2) trên màu lông
 * thật nằm dưới điểm đó, nên vạch đổi sắc theo bậc sáng/tối của lông (mực đậm trên lông sáng, mực sáng cùng sắc trên
 * nửa tối). Cấp 50 (Thần thái) vẽ hai tông vàng: lõi GOLD_CORE, một điểm GOLD_EDGE ở phía tối của mỗi nét.
 */
const INKS = {
  kim: ['#d79c1c', '#8a5a34', '#fff3c4', '#f4c24f'],
  moc: ['#3e7a3f', '#2f5a3a', '#c4e89a', '#8fcf6a'],
  thuy: ['#2f6f9a', '#3f8fc0', '#58b9d6', '#8fd0e8'],
  hoa: ['#e84a5f', '#f39b4a', '#6e2e24', '#f4c24f'],
  tho: ['#8a5a34', '#5c3a24', '#3d2a1f', '#ecd2a2'],
};
const GOLD_CORE = ['#f4c24f', '#fff3c4'];
const GOLD_EDGE = ['#d79c1c', '#8a5a34'];
const INK_MIN = 0.2;

function pickInk(list, under) {
  let best = list[0];
  let bd = -1;
  for (const c of list) {
    const d = dist(c, under);
    if (d >= INK_MIN) return c;
    if (d > bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** Bộ phận nằm trên cùng ở từng điểm (như colourise: z lớn hơn che z nhỏ, bằng nhau thì bộ phận sau che). */
function topParts(ctx) {
  return once(ctx, 'top', ctx.parts.length, () => {
    const top = new Int32Array(NPX).fill(-1);
    const order = [...ctx.parts.keys()].sort((i, j) => ctx.parts[i].z - ctx.parts[j].z);
    for (const i of order) {
      const m = ctx.parts[i].mask;
      for (let k = 0; k < NPX; k++) if (m[k]) top[k] = i;
    }
    return top;
  });
}

const clip = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Bậc sáng của bộ phận i ở điểm k trước khi dọn điểm lẻ (đúng như colourise trong core.js). */
function bandAt(parts, i, k) {
  const p = parts[i];
  let band;
  if (p.flat !== null && p.flat !== undefined) {
    band = p.flat;
  } else {
    const [cx, cy, rx, ry] = p.normal ?? [0, 0, 1, 1];
    const nx = clip((k % FW + 0.5 - cx) / rx, -1, 1);
    const ny = clip((Math.floor(k / FW) + 0.5 - cy) / ry, -1, 1);
    const nz = Math.sqrt(clip(1 - nx * nx - ny * ny, 0, 1));
    const I = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
    band = I < 0.16 ? 1 : I < 0.56 ? 2 : I < 0.92 ? 3 : 4;
    if (p.name !== 'head') band = Math.min(band, 3);
  }
  return clip(band + p.shade, 1, 4);
}
/**
 * Màu lông thật nằm dưới điểm (x, y) lúc này: chép đúng từng bước của colourise (bậc theo ánh sáng, dọn điểm lẻ, bóng đổ
 * dưới bộ phận phía trước, nét trong) và các điểm tô thẳng có z ≤ 16 (hoa văn), nhưng chỉ cho vài chục điểm cần vẽ thay vì
 * tô thử cả khung. Trả về [màu, bậc] (bậc 0 = nét trong, −1 = điểm tô thẳng) hoặc null nếu không có lông.
 */
function underAt(ctx, x, y) {
  const { parts } = ctx;
  const top = topParts(ctx);
  const k = y * FW + x;
  const i = top[k];
  if (i < 0) return null;
  const px = once(ctx, 'px16', ctx.pixels.length, () => {
    const m = new Map();
    ctx.pixels.map((q, j) => [q, j]).filter(([q]) => q[3] <= 16).sort((a, b) => a[0][3] - b[0][3] || a[1] - b[1])
      .forEach(([[qx, qy, c]]) => m.set(qy * FW + qx, c));
    return m;
  });
  if (px.has(k)) return [px.get(k), -1];
  const p = parts[i];
  const nb = [y > 0 ? k - FW : -1, y < FW - 1 ? k + FW : -1, x > 0 ? k - 1 : -1, x < FW - 1 ? k + 1 : -1];
  const behind = (q) => q >= 0 && top[q] >= 0 && parts[top[q]].group !== p.group && parts[top[q]].z < p.z;
  if (p.line && nb.some(behind)) return [RAMPS[p.ramp][0], 0];
  let band = bandAt(parts, i, k);
  if (x >= 1 && y >= 1 && x < FW - 1 && y < FW - 1) {
    const cnt = [0, 0, 0, 0, 0];
    let n = 0;
    let differs = true;
    for (const q of nb) {
      const j = top[q];
      if (j < 0 || parts[j].group !== p.group || parts[j].ramp !== p.ramp) continue;
      const b = bandAt(parts, j, q);
      cnt[b]++;
      n++;
      if (b === band) differs = false;
    }
    if (n >= 3 && differs) {
      let best = 0;
      for (let v = 1; v <= 4; v++) if (cnt[v] > cnt[best]) best = v;
      band = best;
    }
  }
  const up = y > 0 ? top[k - FW] : -1;
  if (up >= 0 && parts[up].group !== p.group && parts[up].z > p.z && (p.flat === null || p.flat === undefined)) band = Math.max(1, band - 1);
  return [RAMPS[p.ramp][band], band];
}

/**
 * Tô các nét vạch. Mỗi nét là danh sách điểm [x, y], hoặc { alts: [điểm, điểm, ...] } (vài chỗ thay thế, lấy chỗ đầu
 * tiên dùng được). Chỉ giữ điểm có bộ phận trên cùng thỏa `ok(part)`, không nằm trên nét trong (bậc 0) hay nét mặt, không
 * dưới đồ cầm tay; nét còn dưới 2 điểm, hoặc dính vào nét đã vẽ, thì bỏ (không để lại chấm lẻ). Còn ít hơn `minStrokes`
 * nét thì không vẽ gì. Màu chọn từng điểm theo màu lông bên dưới (pickInk). `kind` 'gold': hai tông, điểm phía tối nhất
 * (x + y lớn nhất) là viền. Điểm z 16, như hoa văn: dưới má hồng, mắt, mũi.
 */
function paintStrokes(ctx, strokes, kind, ok, minStrokes = 1) {
  const top = topParts(ctx);
  const held = heldMask(ctx);
  const seen = new Set();
  const kept = [];
  const near = (k) => seen.has(k) || seen.has(k - 1) || seen.has(k + 1) || seen.has(k - FW) || seen.has(k + FW);
  for (const stroke of strokes) {
    for (const pts of stroke.alts ?? [stroke]) {
      const keep = [];
      for (const [x, y] of pts) {
        if (!inBody(x, y)) continue;
        const k = y * FW + x;
        const i = top[k];
        if (i < 0 || held[k] || !ok(ctx.parts[i])) continue;
        const [under, band] = underAt(ctx, x, y) ?? [null, 0];
        if (!under || band === 0 || under === INK) continue;
        if (keep.some((q) => q[2] === k)) continue;
        keep.push([x, y, k, under]);
      }
      if (keep.length < 2 || keep.some((q) => near(q[2]))) continue;
      for (const q of keep) seen.add(q[2]);
      kept.push(keep);
      break;
    }
  }
  if (kept.length < minStrokes) return; // một nét lẻ loi đọc thành giọt nước dưới cằm, không thành vằn
  for (const keep of kept) {
    let edge = -1;
    if (kind === 'gold') keep.forEach(([x, y], j) => (edge = edge < 0 || x + y > keep[edge][0] + keep[edge][1] ? j : edge));
    keep.forEach(([x, y, , under], j) => {
      const list = kind === 'gold' ? (j === edge ? GOLD_EDGE : GOLD_CORE) : INKS[kind];
      ctx.pixels.push([x, y, pickInk(list, under), 16]);
    });
  }
}

// ---------------------------------------------------------------- lão làng

/** Điểm của bộ phận gắn trên người: chừa 1 px cho viền, nên viền vẫn nằm trong hàng/cột 1..46. */
const inBody = (x, y) => x >= 2 && y >= 2 && x <= 45 && y <= 45;

/** Đầu và mọi thứ của nhóm 'head' (mõm, mặt nạ, râu): móc gậy nhìn ngang luôn nằm dưới khối này để thấy được. */
function headGroup(ctx) {
  const m = newMask();
  for (const p of ctx.parts) if (p.group === 'head') for (let k = 0; k < NPX; k++) m[k] |= p.mask[k];
  return m;
}

/** Dáng khung có tay hay cánh cầm gậy (biped, chim; round/serpent nếu dáng mới có tay). Bốn chân thì không. */
const hasHand = (ctx) => ctx.sk.arch === 'biped' || ctx.sk.arch === 'bird' || (ctx.sk.arch !== 'quad' && ctx.parts.some(isLimb));

/**
 * Gậy tre: cán 1 px, đầu móc cong về phía tay. Dải 'tan' (tre vàng) để nổi trên cả lông nâu lẫn lông sáng.
 * S: bên trái người xem (tay phải của bé), móc qua bàn tay; N: bên phải người xem, sau thân (chỉ thò cán và móc ra).
 * Chỗ đứng của cán tính theo thân KHÔNG kể tay/cánh, nên chân gậy luôn cắm đất: bé giơ tay lúc đứng (busy) thì chỉ đầu
 * móc nhích 1 px theo tay; chỉ khi cả bé nhảy lên (pose.lift < 0) gậy mới nhấc theo tay giơ. Bốn chân: không bao giờ nhấc.
 * E: biped và chim cầm gậy ở tay/cánh gần: móc chạm mép trước của thân ở tầm tay (dưới cằm), cán chỉ cách thân 1 cột
 * ở dưới bàn tay, ngọn gậy đưa theo bước đi, chân gậy đứng yên. Bốn chân: gậy đứng trước ngực, cách chân trước 1 cột.
 */
function cane(ctx) {
  const { sk, view, pose } = ctx;
  const [bcx, bcy] = sk.body;
  const hand = hasHand(ctx);
  const raised = view === 'S' ? pose.armL ?? 0 : view === 'N' ? pose.armR ?? 0 : 0;
  const airborne = (pose.lift ?? 0) < 0;
  const lift = hand && airborne ? Math.round(raised * 3) : 0;
  const nudge = hand && !airborne && raised ? 1 : 0;
  const tip = Math.round(sk.ground) - 1;
  const y0 = Math.round(bcy) - 2;
  const trunk = torsoPart(true);
  const span = spanParts(ctx, trunk, y0, tip) ?? [Math.round(bcx) - 6, Math.round(bcx) + 5];
  const reach = hand ? 2 : 0; // tay/cánh thò ra ngoài thân tới 2 cột: cán đứng ngoài tay
  const { s: si } = gait(pose);
  let pts;
  let z = 6.5;
  if (view === 'S' || view === 'N') {
    const h = view === 'S' ? 1 : -1;
    const sx = Math.max(2, Math.min(45, view === 'S' ? span[0] - 2 - reach : span[1] + 2 + reach));
    if (view === 'N') z = 2.5;
    let bar = Math.round(bcy - 1.5) - lift - nudge;
    bar = Math.max(3, Math.min(bar, tip - lift - 4));
    pts = linePts(sx, bar + 1, sx, tip - lift);
    pts.push([sx, bar], [sx + h, bar - 1], [sx + 2 * h, bar - 1], [sx + 3 * h, bar]);
  } else {
    let bar = Math.round(bcy - 1.5);
    const sway = pyRound(-si * 0.5);
    let hookEnd;
    let sx;
    if (hand) {
      // Tầm tay: ngang giữa thân, luôn dưới cằm. Mép trước tính theo thân không kể tay (tay đưa theo bước, chân gậy thì
      // phải đứng yên), cộng đồ cầm tay. Đầu móc chạm mép trước ở tầm tay; tay gần (z 6) nằm dưới gậy (z 6.5).
      const front0 = (row) => spanParts(ctx, trunk, row, row + 1, heldMask(ctx))?.[1];
      let front = front0(bar) ?? Math.round(bcx + 4);
      const headLow = lowestRow(headGroup(ctx), front + 1, front + 4);
      bar = Math.max(3, Math.min(Math.max(bar, headLow + 2), tip - 4));
      front = front0(bar) ?? front;
      hookEnd = front + 1;
      sx = front + 4;
    } else {
      sx = span[1] + 4; // một cột trống giữa gậy và chân trước: gậy không lẫn thành chân thứ năm
      const headLow = lowestRow(headGroup(ctx), sx - 3, sx);
      bar = Math.max(3, Math.min(Math.max(bar, headLow + 2), tip - 4));
      hookEnd = sx + sway - 3;
    }
    sx = Math.min(45, sx);
    const tx = Math.min(45, sx + sway); // ngọn gậy đưa theo bước đi, chân gậy đứng yên
    pts = linePts(tx, bar + 1, sx, tip);
    pts.push([tx, bar], [hookEnd, bar]);
    for (let x = hookEnd + 1; x < tx; x++) pts.push([x, bar - 1]);
  }
  const m = mPts(pts.filter(([x, y]) => inBody(x, y) && y <= 43));
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const [ya, yb] = [Math.min(...ys), Math.max(...ys)];
  ctx.parts.push(part('cane', m, 'tan', z, { normal: [Math.min(...xs) + 1, (ya + yb) / 2, 2, (yb - ya) / 2 + 2] }));
}

/**
 * Lông mày bạc rậm, đuôi rủ xuống ngoài khóe mắt (điểm z 23); chòm râu dê trắng dưới miệng, thò qua cằm xuống ngực
 * (bộ phận nhóm 'head': không kẻ nét trên mặt, có nét ở chỗ đè lên ngực). Mặt mỏ (chim) không có râu. Nhìn sau: không có.
 * Màu lông mày: trắng kem như rig cũ, trừ khi trắng chìm vào màu lông thật dưới chính các sợi lông mày (lông trắng,
 * ngọc trai, tuyết, băng): khi đó lấy màu bạc nổi nhất, không bao giờ trùng một bậc của lông.
 */
const BEARD = {
  S: [[-2, 1], [-2, 1], [-2, 1], [-1, 0], [-1, -1]],
  E: [[-1, 1], [-1, 1], [-1, 0], [-2, -1]],
};
const BROWS = ['#fffaf3', '#c4bcb0', '#9c948a', '#6e6660'];
/**
 * Một màu cho cả hai lông mày, cố định theo loài (giống nhau ở S và E, mọi khung): màu sáng nhất trong BROWS cách bậc
 * giữa và bậc sáng của lông ≥ 0.15 (lông mày S bên trái nằm ở phía được chiếu sáng), cách bậc tối ≥ 0.1, và không trùng
 * bậc nào. Trắng cho hầu hết các loài; lông trắng/vàng nhạt/xanh nhạt thì bạc nhạt hoặc bạc.
 */
function browOf(ctx) {
  const fur = RAMPS[ctx.ramps.main].slice(1, 4);
  const ok = (c) => !fur.includes(c) && dist(c, fur[0]) >= 0.1 && dist(c, fur[1]) >= 0.15 && dist(c, fur[2]) >= 0.15;
  const found = BROWS.find(ok);
  if (found) return found;
  const score = (c) => (fur.includes(c) ? -1 : Math.min(...fur.map((f) => dist(c, f))));
  return BROWS.reduce((a, b) => (score(b) > score(a) ? b : a));
}
function browsAndBeard(ctx) {
  const { sk, view, pose, sp } = ctx;
  if (view === 'N') return;
  const [hcx, , hrx] = sk.head;
  if (sp.face !== 'beak') {
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
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  const y0 = Math.floor(sk.eyeY - eh / 2 + 0.5);
  const look = pose.look ?? 0;
  const list = view === 'S' ? [[-1, hcx - sk.eyeDx], [1, hcx + sk.eyeDx]] : [[-1, sk.anchors.face[0]]];
  const by = y0 - 2 + (pose.mouth === 'sad' ? 1 : 0);
  const pts = [];
  for (const [s, ex] of list) {
    const x0 = Math.floor(ex - ew / 2 + 0.5) + look;
    const outer = s < 0 ? x0 - 1 : x0 + ew;
    for (let x = Math.min(x0, outer); x <= Math.max(x0 + ew - 1, outer); x++) pts.push([x, by]);
    pts.push([outer + s, by + 1]);
  }
  const brow = browOf(ctx);
  for (const [x, y] of pts) ctx.pixels.push([x, y, brow, 23]);
}

// ---------------------------------------------------------------- dáng theo cấp

/** Lông đầu: khối 'head' và túm má cùng màu lông; không phải mặt nạ, mõm, hoa văn đầu, tai rủ, mỏ hay đồ trên đầu. */
const headFur = (ctx) => (p) => p.name === 'head' || (p.group === 'head' && p.ramp === ctx.ramps.main && p.z < ctx.zh + 0.1);

/**
 * Vạch thái dương (cấp 10+): mỗi bên hai nét ngắn 2 px trên lông đầu ở mép đầu ngang mắt, nét dưới lệch ra ngoài (S và N,
 * cách mắt ít nhất 1 cột); nhìn ngang: hai nét sau đuôi mắt, lệch về phía tai. Chỉ vẽ trên lông đầu (khối 'head', túm má),
 * không lên mặt nạ trắng quanh mắt (chim cánh cụt: vạch trên mũ lông xanh đen, không thành giọt nước mắt cạnh mắt).
 * Mép đầu chỉ còn dải lông hẹp thì nét lùi ra trong dải lông; dải lông dưới 2 px thì bỏ nét.
 */
function temples(ctx, kind) {
  const { sk, view } = ctx;
  const [hcx] = sk.head;
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  const y0 = Math.floor(sk.eyeY - eh / 2 + 0.5);
  const top = topParts(ctx);
  const fur = headFur(ctx);
  const strokes = [];
  if (view === 'E') {
    const x0 = Math.floor(sk.anchors.face[0] - ew / 2 + 0.5);
    strokes.push([[x0 - 4, y0], [x0 - 3, y0]], [[x0 - 5, y0 + 2], [x0 - 4, y0 + 2]]);
  } else {
    for (const s of [-1, 1]) {
      const eyeX = Math.floor(hcx + s * sk.eyeDx - ew / 2 + 0.5);
      const eyeOut = s > 0 ? eyeX + ew - 1 : eyeX; // cột ngoài cùng của mắt
      for (const [y, depth] of [[y0, 3], [y0 + 2, 2]]) {
        // mép đầu thấy được ở hàng y, rồi dải lông đầu liền từ mép vào trong
        let edge = -1;
        for (let x = s > 0 ? FW - 1 : 0; x >= 0 && x < FW; x -= s) {
          const i = top[y * FW + x];
          if (i >= 0 && ctx.parts[i].group === 'head') {
            edge = x;
            break;
          }
        }
        if (edge < 0) continue;
        let run = 0;
        while (run < 6) {
          const x = edge - s * run;
          if (x < 0 || x >= FW) break;
          const i = top[y * FW + x];
          if (i < 0 || !fur(ctx.parts[i])) break;
          run++;
        }
        let d = Math.min(depth, run - 1);
        if (view === 'S') d = Math.min(d, s * (edge - eyeOut) - 2); // chừa 1 cột giữa vạch và mắt
        if (d < 1) continue;
        const a = edge - s * d;
        strokes.push([[a, y], [a + s, y]]);
      }
    }
  }
  paintStrokes(ctx, strokes, kind, fur);
}

/**
 * Vằn hông (cấp 20+), chỉ trên phần thân THẤY ĐƯỢC (thân, bụng, tay, cánh, chân nằm trên cùng, không dưới đồ cầm tay).
 * S, N: mỗi bên hai nét 3 px cong vào từ mép thân (nét trên ngang giữa thân, nét dưới thấp hơn 2-3 hàng), điểm cuối nhích
 * lên 1 hàng; nét rơi vào nét trong (tay đè thân) thì thử lệch 1 hàng hoặc lùi vào 1 cột.
 * E (công viên, bé đi ngang): mỗi cột lấy hàng thân đầu tiên (sống lưng của bé bốn chân, ngay dưới cằm của bé đứng, chim,
 * bé tròn), rồi vẽ 2-3 nét xiên ngắn từ đó xuống, chia đều ngang phần thân thấy được (dưới cằm: đặt giữa phần thân). Phải
 * còn ít nhất hai nét, không thì không vẽ (bé sơ sinh nhìn ngang gần như chỉ thấy đầu). Nét dưới 2 điểm thì bỏ.
 */
function flanks(ctx, kind) {
  const { sk, view } = ctx;
  const [, bcy, , bry] = sk.body;
  const strokes = [];
  const top = topParts(ctx);
  const held = heldMask(ctx);
  const vis = (x, y) => {
    const k = y * FW + x;
    return top[k] >= 0 && !held[k] && onTorso(ctx.parts[top[k]]);
  };
  if (view === 'E') {
    const L = Math.max(2, Math.min(4, Math.round(bry * 0.6)));
    const cols = [];
    for (let x = 2; x <= 45; x++) {
      let y = 2;
      while (y <= 45 && !vis(x, y)) y++;
      if (y > 45) continue;
      let run = 0;
      while (y + run <= 45 && vis(x, y + run)) run++;
      // ngay dưới cằm (điểm phía trên là đầu): nét đặt giữa phần thân thấy được; dưới sống lưng: nét bắt đầu từ sống lưng
      const up = top[(y - 1) * FW + x];
      const chin = up >= 0 && ctx.parts[up].group === 'head';
      if (run >= 3) cols.push([x, y, run, chin]);
    }
    if (cols.length >= 2) {
      // phần thân thấy được liền nhau rộng nhất
      let best = [0, 0];
      for (let i = 0, j = 0; i < cols.length; i = j) {
        j = i + 1;
        while (j < cols.length && cols[j][0] === cols[j - 1][0] + 1) j++;
        if (j - i > best[1] - best[0]) best = [i, j];
      }
      const run = cols.slice(best[0], best[1]);
      const w = run.length;
      const n = w >= 11 ? 3 : w >= 4 ? 2 : 0;
      const at = (c) => {
        if (c < 0 || c >= w) return [];
        const [x, y, h, chin] = run[c];
        const len = Math.min(L, h - 1);
        const y1 = y + 1 + (chin ? Math.max(0, Math.floor((h - 1 - len) / 2)) : 0);
        const st = [];
        for (let i = 0; i < len; i++) st.push([x - (i >> 1), y1 + i]);
        return st;
      };
      for (let j = 0; j < n; j++) {
        const c = Math.min(w - 1, Math.floor(((j + 0.5) * w) / n));
        strokes.push({ alts: [at(c), at(c + 1), at(c - 1)] }); // nét rơi vào nét trong (chân trước thân) thì lệch 1 cột
      }
    }
  } else {
    const yb = view === 'N' ? bcy - 2 : bcy - 1.2;
    for (const s of [-1, 1]) {
      for (const yk of [yb, yb + 2.6]) {
        const alts = [];
        for (const dy of [0, 1, -1]) {
          const r = Math.round(yk) + dy;
          let edge = -1;
          for (let x = s > 0 ? 45 : 2; x >= 2 && x <= 45; x -= s) {
            if (vis(x, r)) {
              edge = x;
              break;
            }
          }
          if (edge < 0) continue;
          for (const inset of [0, 1]) alts.push([0, 1, 2].map((j) => [edge - s * (inset + j), r - (j === 2 ? 1 : 0)]));
        }
        strokes.push({ alts });
      }
    }
  }
  paintStrokes(ctx, strokes, kind, onTorso, view === 'E' ? 2 : 1);
}

/**
 * Màu vòng linh khí và đốm sáng theo hành: [đậm, sáng, ánh]. Hai màu xen kẽ để nổi trên cỏ, đường đất, sàn gỗ và nền kem;
 * màu ánh (trắng) luôn đi kèm màu sáng bên cạnh, vì nền kem của game (#fffaf3, #fbf1e3) nuốt mất điểm trắng đứng một mình.
 */
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
 * xen kẽ đậm/sáng xoay theo tick, ba ánh chạy vòng (điểm ánh trắng kẹp giữa hai điểm sáng). Cấp 50: vòng vàng, bốn ánh.
 * Nằm gọn trong hàng ≤ 46. Chu kỳ 6 khung: sau 6 khung mỗi ánh tới đúng chỗ ánh kế tiếp.
 */
function spiritRing(ctx, img, c, form) {
  const { sk } = ctx;
  const t = tickOf(ctx);
  const [bcx, , brx] = sk.body;
  const g = Math.round(sk.ground);
  const span = spanParts(ctx, torsoPart(false), g - 4, g - 1);
  const cx = span ? (span[0] + span[1] + 1) / 2 : bcx;
  const half = span ? (span[1] - span[0] + 1) / 2 : brx;
  const rx = Math.max(4, Math.min(Math.max(half + 4, brx + 4.5), cx - 1.5, 46.5 - cx));
  const ry = Math.max(2, Math.min(3, rx * 0.24));
  // vòng nằm trên mặt đất thật: bé nhảy (lift) thì nhảy ra khỏi vòng, vòng không bay theo
  const cy = Math.min(sk.ground - (ctx.pose.lift ?? 0) + 0.5, 46.9 - ry);
  const n = form >= 5 ? 4 : 3;
  const per = Math.round(2 * Math.PI * Math.max(rx, ry) * 3);
  const segs = 2 * Math.max(5, Math.round((Math.PI * (rx + ry)) / 6));
  // các điểm của vòng theo thứ tự quanh vòng (không trùng)
  const ring = [];
  const done = new Set();
  for (let i = 0; i < per; i++) {
    const u = i / per;
    const a = u * 2 * Math.PI;
    const x = Math.floor(cx + Math.cos(a) * rx);
    const y = Math.floor(cy + Math.sin(a) * ry);
    const key = y * FW + x;
    if (done.has(key)) continue;
    done.add(key);
    ring.push([x, y, u]);
  }
  const N = ring.length;
  const glint = new Map();
  for (let j = 0; j < n; j++) {
    // vị trí theo số nguyên (6n bước một vòng): khung t + 6 trùng đúng khung t, không lệch vì làm tròn số thực
    const step = (6 * j + t) % (6 * n);
    const at = Math.floor((2 * step * N + 6 * n) / (12 * n)) % N;
    glint.set(at, 2);
    for (const q of [(at + 1) % N, (at + N - 1) % N]) if (!glint.has(q)) glint.set(q, 1);
  }
  ring.forEach(([x, y, u], i) => {
    // nửa sau (trên) màu sáng, nửa trước (dưới) xen kẽ đậm/sáng xoay theo tick
    const dark = y + 0.5 >= cy && (Math.floor(u * segs) + t) & 1;
    const gl = glint.get(i);
    put(img, x, y, gl === 2 ? c[2] : gl === 1 ? c[1] : dark ? c[0] : c[1]);
  });
}

/**
 * Đốm sáng bay lên hai bên người: luôn cách bóng hình đã ghép (pet, viền, đồ đeo) ít nhất 1 điểm trống, nên không che mặt,
 * cánh hay bùa. Hình theo hành: kim ánh kim (sao), moc lá non, thuy giọt nước, hoa tàn lửa, tho hạt bụi vàng; gold: sao
 * vàng (cấp 50). Bay hết một lượt trong 6 khung.
 */
const MOTE = {
  moc: (x, y, s, big) => [[x, y, 1], [x - s, y, 1], [x, y - 1, 1], [x - s, y + 1, 0], ...(big ? [[x + s, y - 1, 2]] : [])],
  thuy: (x, y) => [[x, y - 1, 2], [x, y, 1], [x - 1, y + 1, 1], [x, y + 1, 0], [x + 1, y + 1, 1]],
  hoa: (x, y, s, big) => [[x, y, big ? 2 : 1], [x, y + 1, 0], ...(big ? [[x, y - 1, 1]] : [])],
  tho: (x, y, s, big) => [[x, y, 1], [x + 1, y, 0], [x, y + 1, 0], ...(big ? [[x - 1, y - 1, 2]] : [])],
};
function motes(ctx, img, kind, n, phase = 0) {
  const { sk } = ctx;
  const t = tickOf(ctx) + phase;
  const c = GLOW[kind] ?? GLOW.gold;
  const g = Math.round(sk.ground) - 1;
  const top = Math.max(4, Math.round(sk.htop) + 2);
  const spanY = Math.max(6, g - 3 - top);
  const solid = solidMask(ctx, img);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const y = g - 3 - Math.round((((t + (i * 6) / n + (i >> 1) * 1.5) % 6) / 6) * spanY);
    const big = (t + i) % 3 === 0;
    const off = side * (i >> 1); // đốm thứ 3, 4 bay xa hơn một cột
    const shape = (x, yy) => (MOTE[kind] ? MOTE[kind](x + off, yy, side, big) : starPts(x + off, yy, big ? 2 : 1).map(([a, b]) => [a, b, 0]));
    const x = besideShape(solid, y, side, 1, shape);
    if (x === null) continue;
    if (MOTE[kind]) for (const [px, py, ci] of shape(x, y)) put(img, px, py, c[ci]);
    else twinkle(img, x + off, y, big ? 2 : 1, [c[2], c[1], c[0]]);
  }
}

// ---------------------------------------------------------------- hào quang

/**
 * Hào quang (lớp sau pet): vầng sáng ôm theo bóng hình (đã bo tròn các khe giữa tai, giữa chân), ba lớp từ trong ra:
 * một vòng liền màu sáng có vài điểm kem lấp lánh ở phía được chiếu sáng (trên trái), một vòng caro hai tông cùng sắc
 * (vàng / vàng đậm; bạc hà / mòng két) đổi pha mỗi khung, một lớp hạt thưa màu đậm bay lên. Không dùng kem ở lớp ngoài:
 * trên nền kem của game nó biến mất và vầng sáng thành viền liền có rìa chấm. Vài ngôi sao 4 cánh nhấp nháy so le.
 * Huyền thoại: vàng kim và kem, 5 sao (sao lớn). Quý: ngọc (bạc hà, mòng két, trắng sương), 3 sao nhỏ hơn.
 * Không xuống dưới hàng chân (chỗ bóng đổ của game). Mọi điểm đục, trong hàng/cột 1..46.
 */
const AURAS = {
  huyenthoai: { solid: '#f4c24f', hi: '#fff3c4', check: ['#f4c24f', '#d79c1c'], dust: '#d79c1c', dens: 0.25, star: ['#fffaf3', '#f4c24f', '#d79c1c'], stars: 5, big: 3 },
  quy: { solid: '#8fd3bf', hi: '#eef8fb', check: ['#8fd3bf', '#4fae93'], dust: '#4fae93', dens: 0.19, star: ['#eef8fb', '#8fd3bf', '#4fae93'], stars: 3, big: 2 },
};
const STAR_ANGLES = [-150, -100, -55, -15, 200, 25];
/** Ngưỡng dither 4 × 6 (chu kỳ 6 hàng): bụi bay lên 1 px mỗi khung, sau 6 khung về đúng chỗ cũ. */
const DUST = [0, 12, 3, 15, 18, 6, 21, 9, 4, 16, 1, 13, 22, 10, 19, 7, 2, 14, 5, 17, 20, 8, 23, 11].map((v) => (v + 0.5) / 24);
const dustAt = (x, y) => DUST[(((y % 6) + 6) % 6) * 4 + (x & 3)];

/** Bóng hình đã bo tròn (đóng hình thái học bán kính 2): khe hẹp giữa tai, giữa chân được lấp. */
function closedShape(fp, d0 = chamfer(fp)) {
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
  const near = chamfer(fp);
  const d = chamfer(closedShape(fp, near));
  const g = Math.round(sk.ground);
  const breathe = t % 6 >= 2 && t % 6 <= 4 ? 1 : 0;
  const [hcx, hcy] = sk.head;
  for (let y = 1; y <= Math.min(46, g); y++) {
    for (let x = 1; x <= 46; x++) {
      const k = y * FW + x;
      if (near[k] <= 3) continue; // pet và viền của pet
      const r = d[k] / 3;
      if (r <= 0) continue;
      const b = r <= 2.01 ? 0 : r <= 3.01 ? 1 : r <= 4.01 + breathe ? 2 : -1;
      if (b < 0) continue;
      let c;
      if (b === 0) {
        // vòng liền; điểm kem lấp lánh thưa ở phía trên trái (hướng sáng), đổi chỗ mỗi khung
        const lit = x + y < hcx + hcy - 2;
        c = lit && dustAt(x + (t & 1) * 2, y) < 0.1 ? A.hi : A.solid;
      } else if (b === 1) {
        c = A.check[(x + y + t) & 1];
      } else {
        if (dustAt(x, y + t) >= A.dens) continue; // hạt thưa bay lên
        c = A.dust;
      }
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

/**
 * Bộ đồ cùng hành (3 món trở lên): bốn ngôi sao màu hành ở bốn tầng (đỉnh đầu, ngang mắt, giữa thân, thân dưới), mỗi
 * sao cách bóng hình đã ghép (pet, viền, đồ đeo, đồ cầm) ít nhất 1 điểm trống, nên không bao giờ đè lên pet hay món đồ.
 * S, N: hai sao mỗi bên, so le. E: sau đầu, sau lưng (bên trái), trước mặt và trước ngực, ngoài cả đồ cầm tay (bên phải).
 * Nhấp nháy chu kỳ 2 (lớn/nhỏ xen kẽ), liền mạch ở mọi hoạt ảnh.
 */
function sparkles(ctx, img, el) {
  const { sk, view } = ctx;
  const t = tickOf(ctx);
  const [, bcy, , bry] = sk.body;
  const c = GLOW[el] ?? GLOW.gold;
  const g = Math.round(sk.ground);
  const rows = [Math.round(sk.htop + 1), Math.round(sk.eyeY), Math.round(bcy), Math.min(g - 4, Math.round(bcy + bry * 0.6))];
  const sides = view === 'E' ? [-1, 1, -1, 1] : [-1, 1, 1, -1];
  const solid = solidMask(ctx, img);
  rows.forEach((y, i) => {
    const x = besideShape(solid, y, sides[i], 1, (px, py) => starPts(px, py, 2));
    if (x === null) return;
    twinkle(img, x, y, (t + i) & 1 ? 1 : 2, [c[2], c[1], c[0]]);
  });
}

// ---------------------------------------------------------------- điểm vào

const markKind = (ctx) => (ctx.form >= 5 ? 'gold' : INKS[ctx.sp.element] ? ctx.sp.element : null);
const glowOf = (ctx) => (ctx.form >= 5 ? 'gold' : GLOW[ctx.sp.element] ? ctx.sp.element : null);

export const MARKS = {
  /** Trước khi tô bóng: râu, lông mày, gậy (lão làng; gậy sau râu để móc gậy nằm dưới râu), vạch thái dương (cấp 10+), vằn hông (cấp 20+). */
  body(ctx) {
    if (ctx.st.elder) {
      browsAndBeard(ctx);
      cane(ctx);
    }
    const kind = markKind(ctx);
    if (!kind) return;
    if (ctx.form >= 1) temples(ctx, kind);
    if (ctx.form >= 2) flanks(ctx, kind);
  },
  /** Trước khi dán pet: hào quang (Quý, Huyền thoại), vòng linh khí (cấp 30+). Ghi lại lớp này để front() biết đâu là nền. */
  behind(ctx, img) {
    const a = AURAS[ctx.sp.rarity];
    if (a) aura(ctx, img, a);
    const k = glowOf(ctx);
    if (k && ctx.form >= 3) spiritRing(ctx, img, GLOW[k], ctx.form);
    once(ctx, 'behindLayer', 0, () => img.data.slice());
  },
  /** Sau cùng: đốm sáng bay lên (cấp 40+), sao lấp lánh của bộ đồ cùng hành (3 món trở lên). */
  front(ctx, img) {
    const k = glowOf(ctx);
    if (k && ctx.form >= 4) motes(ctx, img, k, ctx.form >= 5 ? 4 : 2, 1);
    const set = fullSetOf(ctx.wear);
    if (set && ELEMENTS[set]) sparkles(ctx, img, set);
  },
};
