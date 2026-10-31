// Đuôi: sổ đăng ký theo `tail` của từng loài trong shared/pets.js. Chủ sở hữu: họa sĩ đuôi.
// Mỗi mục { S, E, N }: hàm vẽ nhận ctx, đẩy bộ phận vào ctx.parts. Đuôi nằm sau thân khi nhìn trước/ngang (z = 1)
// và trước thân khi nhìn sau (z = 8). ctx.pose.tail ∈ {−1, 0, 1} làm chóp đuôi đung đưa.
// flat, thin, puff, nub: port nguyên từ pets-pilot (khớp từng điểm ảnh). Loại chưa vẽ lại dùng tạm FALLBACK.
import { FH, FW, mAnd, mAndNot, mChain, mEllipse, mOr, mTri, part } from '../core.js';

/** Loài vẽ đuôi khác với dữ liệu: cánh cụt có mẩu đuôi nhỏ lộ ra khi nhìn ngang và nhìn sau (thiết kế của bản mẫu). */
const SPECIES_TAIL = { canh_cut: 'nub' };

// ---- đuôi dẹt (rái cá)
const flat = {
  S(ctx) {
    const [bcx, , brx] = ctx.sk.body;
    const sw = ctx.pose.tail ?? 0;
    const x = bcx + brx * 0.85 + sw * 0.6;
    const y = ctx.sk.ground - 1.6;
    ctx.parts.push(part('tail', mEllipse(x, y, 2.6, 1.7, -0.5), ctx.ramps.main, 1, { normal: [x, y, 2.6, 1.7], shade: -1 }));
  },
  E(ctx) {
    const [bcx, , brx] = ctx.sk.body;
    const sw = ctx.pose.tail ?? 0;
    const x = bcx - brx - 1.6;
    const y = ctx.sk.ground - 1.8 + sw * 0.4;
    ctx.parts.push(part('tail', mEllipse(x, y, 3.6, 1.7, 0.15), ctx.ramps.main, 1, { normal: [x, y - 1, 3.6, 2.4] }));
  },
  N(ctx) {
    const [bcx] = ctx.sk.body;
    const sw = ctx.pose.tail ?? 0;
    const x = bcx + sw * 0.6;
    const y = ctx.sk.ground - 0.6;
    ctx.parts.push(part('tail', mEllipse(x, y, 2.5, 2.3), ctx.ramps.main, 8, { normal: [x, y - 1, 2.6, 2.6] }));
  },
};

// ---- đuôi mảnh (mèo): chuỗi đĩa cong lên, chóp tối hơn một bậc
function thinChain(ctx, pts, z, sh, r = 1.25) {
  const m = mChain(pts, r);
  const nrm = [pts[2][0], pts[2][1], 3.0, 5.0];
  ctx.parts.push(part('tail', m, ctx.ramps.main, z, { normal: nrm, shade: sh }));
  const tip = mChain(pts.slice(-1), r);
  ctx.parts.push(part('tailtip', mAnd(tip, m), ctx.ramps.main, z + 0.05, { group: 'tail', shade: ctx.view !== 'N' ? sh - 1 : -1, normal: nrm }));
}
const thinPts = {
  S(ctx, sw) {
    const [bcx, bcy, brx] = ctx.sk.body;
    const [b0, b1] = [bcx + brx * 0.55, bcy + 1.0];
    return [[b0 + 1.5, b1 - 0.5], [b0 + 3.0, b1 - 2.0], [b0 + 3.8, b1 - 4.0], [b0 + 3.8 + sw * 0.5, b1 - 6.0], [b0 + 3.2 + sw, b1 - 7.6]];
  },
  E(ctx, sw) {
    const [bcx, bcy, brx] = ctx.sk.body;
    const [b0, b1] = [bcx - brx + 1.0, bcy - 0.5];
    return [[b0 - 1.5, b1 - 0.8], [b0 - 2.8, b1 - 2.4], [b0 - 3.4, b1 - 4.4], [b0 - 3.0 + sw * 0.5, b1 - 6.4], [b0 - 2.0 + sw, b1 - 7.8]];
  },
  N(ctx, sw) {
    const [bcx, bcy, , bry] = ctx.sk.body;
    const [b0, b1] = [bcx, bcy + bry * 0.3];
    return [[b0, b1 - 1.0], [b0 + 0.6, b1 - 3.0], [b0 + 1.6 + sw * 0.4, b1 - 5.0], [b0 + 2.4 + sw * 0.8, b1 - 7.0], [b0 + 2.4 + sw, b1 - 8.6]];
  },
};
const thinZ = { S: [1, -1], E: [1, 0], N: [8, 0] };
const thinView = (v, r) => (ctx) => thinChain(ctx, thinPts[v](ctx, ctx.pose.tail ?? 0), ...thinZ[v], r);
const thin = { S: thinView('S'), E: thinView('E'), N: thinView('N') };

// ---- đuôi bông (thỏ): cục tròn màu bụng
function puffAt(ctx, x, y, z) {
  const r = 2.3;
  ctx.parts.push(part('tail', mEllipse(x, y, r, r), ctx.ramps.belly, z, { normal: [x, y, r, r] }));
}
const puff = {
  S(ctx) {
    const [bcx, bcy, brx] = ctx.sk.body;
    puffAt(ctx, bcx + brx * 0.85, bcy + 1.2, 1);
  },
  E(ctx) {
    const [bcx, bcy, brx] = ctx.sk.body;
    puffAt(ctx, bcx - brx - 0.4, bcy + 0.4, 1);
  },
  N(ctx) {
    const [bcx, bcy] = ctx.sk.body;
    puffAt(ctx, bcx + (ctx.pose.tail ?? 0) * 0.3, bcy + 0.8, 8);
  },
};

// ---- mẩu đuôi (cánh cụt): chỉ lộ khi nhìn ngang và nhìn sau
const nub = {
  S() {},
  E(ctx) {
    const [bcx, , brx] = ctx.sk.body;
    const x = bcx - brx - 0.2;
    const y = ctx.sk.ground - 2.4;
    const m = mTri([x + 2.0, y - 1.8], [x + 2.0, y + 1.2], [x - 1.6, y + 0.8]);
    ctx.parts.push(part('tail', m, ctx.ramps.main, 1, { normal: [x, y, 3, 3] }));
  },
  N(ctx) {
    const [bcx] = ctx.sk.body;
    const x = bcx + (ctx.pose.tail ?? 0) * 0.5;
    const y = ctx.sk.ground - 1.8;
    const m = mTri([x - 2.4, y - 1.6], [x + 2.4, y - 1.6], [x, y + 1.6]);
    ctx.parts.push(part('tail', m, ctx.ramps.main, 8, { normal: [x, y - 2, 3, 3] }));
  },
};

const none = { S() {}, E() {}, N() {} };

// ================================================================ fluffy, curl, fan, dragon, fish (Rig 2.0, họa sĩ G)
// Cách dựng chung: đuôi là một chuỗi "hạt" [x, y, r] trong KHÔNG GIAN ĐUÔI (hướng E: x âm = ra sau, y âm = lên trên),
// nhân theo cỡ giai đoạn tuổi (tailSize) rồi đặt ở mông. Nhìn trước (S) = hình E lật sang bên PHẢI người xem và ép ngang
// (góc 3/4, như đuôi mảnh của bản mẫu); nhìn sau (N) có hình riêng nằm trên lưng (z 8). Nét trong giữa các chùm lông,
// lông vũ, vây... không vẽ tay: mỗi chùm là một nhóm riêng, chùm đứng trước tự có nét bậc 0 của chính dải màu đó ở chỗ đè
// lên chùm phía sau (colourise, nét trong chọn lọc). Đuôi không bao giờ xuống hàng 44 (aboveGround) và không chạm mép ô.
// Tinh chỉnh theo loài: TUNE bên dưới (dáng đuôi, dải màu chóp, khoanh, lông vũ...). Loài mới chưa có dòng thì dùng mặc định.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DEG = Math.PI / 180;
/** Cỡ đuôi theo giai đoạn: sơ sinh 0.72, nhí nhố 0.80, thiếu niên 0.90, thanh niên 0.97, trưởng thành 1.05 (chặn trên để cấp 50 vẫn vừa ô). */
const tailSize = (sk) => clamp(0.5 + 0.5 * sk.bk, 0.6, 1.05);
/** Mặt nạ từ chuỗi hạt [x, y, r]. */
const mBeads = (pts) => mOr(...pts.map(([x, y, r]) => mEllipse(x, y, r, r)));
/** Khối elip tô sáng bao quanh chuỗi hạt, lệch lên-trái (sáng tròn hơn, như pháp tuyến của bản mẫu). */
function nrmOf(pts) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y, r] of pts) {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  }
  return [(x0 + x1) / 2 - 0.8, (y0 + y1) / 2 - 1.2, (x1 - x0) / 2 + 1.0, (y1 - y0) / 2 + 1.4];
}
/** Đẩy cả chuỗi lên nếu hạt thấp nhất chạm hàng 44 (hàng viền dưới chân): khung đứng yên phải kết thúc ở hàng 44. */
function aboveGround(pts, ground) {
  const low = Math.max(...pts.map(([, y, r]) => y + r));
  const d = low - (ground - 0.3);
  return d > 0 ? pts.map(([x, y, r]) => [x, y - d, r]) : pts;
}
/**
 * Giữ đuôi trong khung: các bộ phận đuôi vừa đẩy (từ chỉ số `from` của ctx.parts) được dời nguyên khối, không cắt, để
 * không chạm cột 0..1 / 46..47, hàng 0..1, và không xuống hàng mặt đất (khung đứng yên kết thúc ở hàng 44 = viền dưới chân).
 * Dời cả khối thay vì cắt: ở cấp 50 (thân to nhất) hoặc khi đuôi đung đưa, đuôi chỉ lấn vào thân thêm 1-2 điểm.
 */
function settle(ctx, from) {
  const ps = ctx.parts.slice(from);
  if (!ps.length) return;
  let [x0, y0, x1, y1] = [FW, FH, -1, -1];
  for (const p of ps) {
    for (let k = 0; k < FW * FH; k++) {
      if (!p.mask[k]) continue;
      const x = k % FW;
      const y = (k - x) / FW;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return;
  const floor = Math.ceil(ctx.sk.ground) - 1; // hàng thấp nhất được tô
  const dx = x0 < 2 ? 2 - x0 : x1 > FW - 3 ? FW - 3 - x1 : 0;
  const dy = y1 > floor ? floor - y1 : y0 < 2 ? 2 - y0 : 0;
  if (!dx && !dy) return;
  for (const p of ps) {
    const m = new Uint8Array(FW * FH);
    for (let k = 0; k < FW * FH; k++) {
      if (!p.mask[k]) continue;
      const x = (k % FW) + dx;
      const y = Math.floor(k / FW) + dy;
      if (x >= 0 && y >= 0 && x < FW && y < FH) m[y * FW + x] = 1;
    }
    p.mask = m;
    if (p.normal) p.normal = [p.normal[0] + dx, p.normal[1] + dy, p.normal[2], p.normal[3]];
  }
}
/** Bọc một hàm vẽ đuôi: vẽ rồi settle(). */
const settled = (fn) => (ctx) => {
  const from = ctx.parts.length;
  fn(ctx);
  settle(ctx, from);
};

/**
 * Không gian đuôi → ô. E: ra sau = sang trái. S: lật sang phải người xem, ép ngang `sq` (góc 3/4).
 * `sw` (pose.tail) uốn đầu xa của đuôi.
 */
function place(pts, A, k, view, sw, sq = 0.62) {
  const n = pts.length - 1;
  return pts.map(([dx, dy, r], i) => {
    const t = n ? i / n : 0;
    const s = sw * t * t;
    const x = view === 'S' ? A[0] - dx * k * sq + s * 0.8 : A[0] + dx * k + s * 0.6;
    const y = A[1] + dy * k - (view === 'E' ? s * 0.3 : 0);
    return [x, y, Math.max(0.6, r * k)];
  });
}
/** Hình vẽ thẳng trong ô (S, N): x lệch theo `sw` ở đầu xa. `mx` = 1 giữ nguyên, −1 lật. */
function placeN(pts, A, k, sw, mx = 1) {
  const n = pts.length - 1;
  return pts.map(([dx, dy, r], i) => {
    const t = n ? i / n : 0;
    return [A[0] + dx * k * mx + sw * t * t * 1.2, A[1] + dy * k, Math.max(0.6, r * k)];
  });
}
/** Dải màu theo vai trò ('main' | 'belly' | 'accent' | 'inner' | 'limb') hoặc tên dải trong RAMPS. */
const rampOf = (ctx, role) => ctx.ramps[role] ?? role;

/** Nửa bề ngang của siêu elip (số mũ n) ở độ cao y; null nếu y nằm ngoài hình. */
function halfWidth(cy, rx, ry, y, n) {
  const v = Math.abs((y - cy) / ry);
  return v >= 1 ? null : rx * (1 - v ** n) ** (1 / n);
}
/**
 * Đầu to (bé sơ sinh, dáng biped nhìn ngang) che mất đuôi: đẩy các hạt từ hạt thứ 1 ra ngoài (E: sang trái, S: sang phải)
 * sao cho hạt `j` chỉ lấn vào bóng đầu/thân tối đa (1 − keep) × bán kính. Hạt gốc giữ ở mông.
 */
function clearOfHead(ctx, pts, view, j, keep = 0.6) {
  const [bcx, bcy, brx, bry] = ctx.sk.body;
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  const [x, y, r] = pts[j];
  const hw = halfWidth(hcy, hrx, hry, y, 2.25);
  const bw = halfWidth(bcy, brx, bry, y, 2);
  const sides = [hw === null ? null : [hcx, hw], bw === null ? null : [bcx, bw]].filter(Boolean);
  if (!sides.length) return pts;
  const s = view === 'E' ? -1 : 1;
  // mép ngoài của bóng đầu/thân về phía đuôi
  const edge = s < 0 ? Math.min(...sides.map(([c, w]) => c - w)) : Math.max(...sides.map(([c, w]) => c + w));
  const inner = s < 0 ? x + r * (1 - keep) : x - r * (1 - keep);
  const d = s < 0 ? Math.max(0, inner - edge) : Math.max(0, edge - inner);
  if (!d) return pts;
  return pts.map(([px, py, pr], i) => [px + s * d * Math.min(1, i / Math.max(1, j - 1)), py, pr]);
}

/**
 * Nhìn trước/sau: đuôi ôm sát bên PHẢI người xem. Từng hạt (từ hạt `from`) bị đẩy ra ngoài bóng đầu/thân, chỉ được lấn
 * vào tối đa `ov` × đường kính: đuôi luôn có viền riêng nổi trên nền, không lẫn vào má (đầu chibi rất to).
 */
function hugSide(ctx, pts, ov, from = 2) {
  const [bcx, bcy, brx, bry] = ctx.sk.body;
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  return pts.map(([x, y, r], i) => {
    if (i < from) return [x, y, r];
    const hw = halfWidth(hcy, hrx, hry, y, 2.25);
    const bw = halfWidth(bcy, brx, bry, y, 2);
    const edge = Math.max(hw === null ? -Infinity : hcx + hw, bw === null ? -Infinity : bcx + bw);
    return [Math.max(x, edge + r - 2 * ov * r), y, r];
  });
}

// ---------------------------------------------------------------- fluffy: đuôi chổi lông xù
// Bốn dáng: squirrel (sóc, gấu mèo đỏ: chữ S dựng cao sau lưng, chóp cuộn về trước), brush (cáo, lân, kỳ lân: bông to
// chếch 45° ra sau, nhìn trước thì vòng ra bên hông), low (sói: bông xệ xuống), flow (ngựa: dải đuôi chảy xuống).
// Hai chùm lông + chóp khác màu (chóp trắng của cáo...), mỗi phần một nhóm nên có nét chia chùm. Gấu mèo đỏ có khoanh sẫm.
// E, S, N: hạt [x, y, r] (S, N vẽ thẳng trong ô: x dương = bên phải người xem); clumps*: chỉ số hạt từng chùm (chùm sau
// vẽ trước); tip*: hạt từ chỉ số này là chóp; big: hạt to nhất (đẩy ra khỏi bóng đầu).
const FLUFFY = {
  squirrel: {
    up: true, big: 3,
    E: [[0, 0, 1.5], [-2.4, -0.9, 2.3], [-4.3, -2.9, 3.0], [-5.1, -5.8, 3.2], [-4.6, -8.7, 3.0], [-3.1, -10.8, 2.4], [-1.3, -11.8, 1.6]],
    S: [[0, 0, 1.5], [2.2, -0.6, 2.2], [3.8, -2.6, 2.8], [4.6, -5.4, 3.1], [4.6, -8.4, 2.9], [3.8, -10.8, 2.3], [2.6, -12.2, 1.6]],
    N: [[0, 1.0, 1.6], [2.2, 1.0, 2.3], [4.2, -0.6, 2.9], [5.4, -3.4, 3.2], [5.6, -6.6, 3.1], [5.0, -9.4, 2.6], [3.8, -11.4, 1.9]],
    clumps: [[0, 1, 2], [2, 3, 4]], tip: 5, clumpsN: [[0, 1, 2], [2, 3, 4]], tipN: 5, tufts: [2, 4],
  },
  brush: {
    up: true, big: 3,
    E: [[0, 0, 1.4], [-2.2, -1.4, 2.2], [-3.9, -3.3, 2.8], [-4.8, -5.7, 2.8], [-4.6, -8.0, 2.3], [-3.8, -9.6, 1.5]],
    S: [[0, 0, 1.4], [2.0, 0.9, 2.0], [3.9, 0.8, 2.6], [5.1, -1.0, 2.7], [5.3, -3.4, 2.3], [4.6, -5.3, 1.6]],
    N: [[0, 0.5, 1.4], [1.9, 1.3, 2.0], [3.9, 1.2, 2.6], [5.6, -0.2, 2.7], [6.6, -2.4, 2.3], [6.8, -4.4, 1.6]],
    clumps: [[0, 1, 2], [2, 3]], tip: 4, clumpsN: [[0, 1, 2], [2, 3]], tipN: 4, tufts: [2, 3],
  },
  low: {
    up: false, big: 3,
    E: [[0, 0, 1.4], [-2.0, 0.6, 2.0], [-3.6, 2.0, 2.5], [-4.4, 4.0, 2.6], [-4.4, 6.0, 2.1], [-3.9, 7.6, 1.4]],
    S: [[0, 0, 1.4], [1.8, 1.0, 2.0], [3.2, 2.6, 2.4], [3.9, 4.6, 2.4], [3.8, 6.4, 1.9], [3.2, 7.8, 1.3]],
    N: [[0, 0, 1.5], [0.3, 1.8, 2.1], [0.6, 3.8, 2.5], [0.6, 5.8, 2.4], [0.3, 7.4, 1.8], [0, 8.6, 1.2]],
    clumps: [[0, 1, 2], [2, 3]], tip: 5, clumpsN: [[0, 1, 2]], tipN: 5, tufts: [2, 3],
  },
  flow: {
    up: false, big: 3,
    E: [[0, 0, 1.2], [-1.8, -0.6, 1.6], [-3.4, 0.4, 2.0], [-4.3, 2.4, 2.2], [-4.5, 4.6, 2.0], [-4.0, 6.6, 1.6], [-3.2, 8.0, 1.1]],
    S: [[0, 0, 1.2], [1.6, 0.0, 1.6], [3.0, 1.4, 2.0], [3.7, 3.4, 2.1], [3.8, 5.4, 1.9], [3.3, 7.2, 1.4], [2.6, 8.4, 1.0]],
    N: [[0, 0, 1.2], [0.2, 1.6, 1.6], [0.4, 3.4, 2.0], [0.5, 5.4, 2.1], [0.4, 7.2, 1.8], [0.1, 8.6, 1.2]],
    clumps: [[0, 1, 2], [2, 3, 4]], tip: 4, clumpsN: [[0, 1, 2]], tipN: 4, tufts: [3, 5],
  },
};

/** Khoanh ngang qua thân đuôi ở vị trí hạt `f` (số thực): elip mỏng dọc theo chiều đuôi. */
function ringAt(pts, f) {
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  const [x0, y0, r0] = pts[i];
  const [x1, y1, r1] = pts[i + 1];
  const rot = Math.atan2(y1 - y0, x1 - x0);
  return mEllipse(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.85, (r0 + (r1 - r0) * u) * 1.6, rot);
}

/**
 * Túm lông nhọn ở mép ngoài của đuôi (phía xa thân) tại các hạt `ids`, và một mũi nhọn nối dài chóp đuôi: viền đuôi
 * lởm chởm như lông xù thay vì một khối tròn trơn.
 */
function furPoints(ctx, pts, ids, k) {
  const [bcx, bcy] = ctx.sk.body;
  const ms = [];
  const dirAt = (i) => {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(x2 - x0, y2 - y0) || 1;
    return [(x2 - x0) / d, (y2 - y0) / d];
  };
  for (const i of ids) {
    const [x, y, r] = pts[i];
    const [ux, uy] = dirAt(i);
    let [nx, ny] = [uy, -ux];
    if (nx * (x - bcx) + ny * (y - bcy) < 0) [nx, ny] = [-nx, -ny];
    const h = r + 1.1 * k;
    ms.push(mTri([x + nx * (r - 1.0) - ux * 1.1, y + ny * (r - 1.0) - uy * 1.1], [x + nx * (r - 1.0) + ux * 0.9, y + ny * (r - 1.0) + uy * 0.9], [x + nx * h - ux * 0.7, y + ny * h - uy * 0.7]));
  }
  const [x, y, r] = pts.at(-1);
  const [ux, uy] = dirAt(pts.length - 1);
  ms.push(mTri([x - uy * r * 0.8, y + ux * r * 0.8], [x + uy * r * 0.8, y - ux * r * 0.8], [x + ux * (r + 1.4 * k), y + uy * (r + 1.4 * k)]));
  return mOr(...ms);
}

/**
 * Đuôi lông: các chùm (nhóm riêng, chùm sau đè chùm trước), chóp màu riêng, khoanh (nếu có), túm lông nhọn ở mép ngoài.
 * `front`: đuôi nằm trước thân (nhìn sau): khối sáng dời xuống-phải để đuôi sáng hơn lưng phía sau, tách khỏi lưng.
 */
function furTail(ctx, pts, z, clumps, tipFrom, t, { shade = 0, front = false, tufts = [] } = {}) {
  const k = tailSize(ctx.sk);
  const whole = mOr(mBeads(pts), furPoints(ctx, pts, tufts, k));
  let nrm = nrmOf(pts);
  if (front) nrm = [nrm[0] + 1.6, nrm[1] + 1.8, nrm[2] + 1.6, nrm[3] + 1.2];
  const main = rampOf(ctx, t.ramp ?? 'main');
  clumps.forEach((ids, c) => {
    const m = c ? mAnd(whole, mBeads(ids.map((i) => pts[i]))) : whole;
    ctx.parts.push(part(c ? `tail${c}` : 'tail', m, main, z + c * 0.01, { normal: nrm, shade }));
  });
  if (t.rings) {
    const n = pts.length - 1;
    const rm = mAnd(whole, mOr(...[0.42, 0.62].map((f) => ringAt(pts, f * n))));
    ctx.parts.push(part('tailring', rm, rampOf(ctx, t.rings), z + 0.03, { normal: nrm, shade, line: false }));
  }
  const tipZone = mOr(...pts.slice(tipFrom).map(([x, y, r]) => mEllipse(x, y, r + 1.6 * k, r + 1.6 * k)));
  const tip = mAndNot(mAnd(whole, tipZone), mBeads(pts.slice(0, Math.max(1, tipFrom - 1))));
  ctx.parts.push(part('tailtip', tip, rampOf(ctx, t.tip ?? 'belly'), z + 0.04, { normal: nrm, shade }));
}

const fluffyView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'fluffy');
  const F = FLUFFY[t.shape] ?? FLUFFY.brush;
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  if (view === 'E') {
    let pts = place(F.E, [bcx - brx + 1.0, bcy - bry * (F.up ? 0.25 : 0.35)], k, 'E', sw);
    pts = aboveGround(clearOfHead(ctx, pts, 'E', F.big, F.up ? 0.55 : 0.8), sk.ground);
    furTail(ctx, pts, 1, F.clumps, F.tip, t, { tufts: F.tufts });
    return;
  }
  // S: sau thân, ló ra bên phải; N: trước lưng (z 8), từ mông vòng sang phải rồi dựng lên, viền đuôi nổi ngoài bóng đầu.
  const A = view === 'S' ? [bcx + brx * 0.6, bcy + bry * (F.up ? 0.1 : -0.1)] : [F.up ? bcx + brx * 0.3 : bcx, F.up ? bcy + bry * 0.3 : bcy - bry * 0.2];
  let pts = placeN(view === 'S' ? F.S : F.N, A, k, sw);
  // nhìn sau: đuôi dựng (sóc, cáo) vòng sang phải và nổi ngoài bóng đầu; đuôi rủ (sói, ngựa) thả thẳng giữa hai chân sau
  if (view === 'S' || F.up) pts = hugSide(ctx, pts, view === 'S' ? 0.2 : 0.4);
  pts = aboveGround(pts, sk.ground);
  furTail(ctx, pts, view === 'S' ? 1 : 8, view === 'S' ? F.clumps : F.clumpsN, view === 'S' ? F.tip : F.tipN, t, { front: view === 'N', tufts: F.tufts });
};
const fluffy = { S: settled(fluffyView('S')), E: settled(fluffyView('E')), N: settled(fluffyView('N')) };

// ---------------------------------------------------------------- curl: đuôi xoắn (heo: vòng nhỏ mảnh; chó: vòng to cuộn trên lưng)
// Vòng tròn có lỗ: tâm đặt đúng góc điểm ảnh (lỗ 2×2) hoặc tâm điểm ảnh (lỗ 1 điểm khi vòng nhỏ), lỗ trên nền trống thành
// một chấm viền nên đọc ra ngay là đuôi xoắn; nhìn sau thì lỗ lộ lông lưng. Một cuống ngắn nối vòng vào mông.
function curlRing(ctx, cx, cy, R, z, ramp, from, shade = 0) {
  const big = R >= 1.95;
  const x = big ? Math.round(cx) : Math.floor(cx) + 0.5;
  const y = big ? Math.round(cy) : Math.floor(cy) + 0.5;
  const ring = mAndNot(mEllipse(x, y, R, R), mEllipse(x, y, big ? 0.8 : 0.5, big ? 0.8 : 0.5));
  const thick = big ? 0.95 : 0.75;
  const [fx, fy] = from;
  const steps = Math.max(2, Math.ceil(Math.hypot(x - fx, y - fy) / 0.8));
  const stub = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    // dừng ở mép vòng: cuống không lấp lỗ
    const px = fx + (x - fx) * u;
    const py = fy + (y - fy) * u;
    if (Math.hypot(px - x, py - y) < R - thick) break;
    stub.push([px, py, thick]);
  }
  const m = stub.length ? mOr(ring, mBeads(stub)) : ring;
  const nrm = [x - 0.8, y - 1.0, R + 1.2, R + 1.4];
  ctx.parts.push(part('tail', m, ramp, z, { normal: nrm, shade }));
}

/** Đuôi chó cuộn (kiểu chó Phú Quốc, Shiba): dựng lên từ mông rồi cuộn về trước, nằm trên lưng; mặt trong màu bụng. */
const DOG_CURL = [[0, 0, 1.5], [-1.0, -1.9, 1.6], [-0.8, -3.8, 1.6], [0.6, -5.0, 1.5], [2.2, -4.6, 1.35], [2.9, -3.1, 1.15], [2.2, -1.9, 0.95]];
/** Nhìn sau: dựng giữa mông rồi cuộn sang phải thành hình số 6 (không phải vòng tròn có cuống: trông như lỗ khóa). */
const DOG_CURL_N = [[0, 0.6, 1.5], [-0.5, -1.5, 1.6], [0.2, -3.4, 1.6], [1.9, -4.2, 1.5], [3.3, -3.2, 1.3], [3.3, -1.5, 1.1], [2.2, -0.7, 0.9]];
function dogCurl(ctx, pts, z, shade = 0) {
  const k = tailSize(ctx.sk);
  const whole = mBeads(pts);
  const nrm = nrmOf(pts);
  ctx.parts.push(part('tail', whole, rampOf(ctx, 'main'), z, { normal: nrm, shade }));
  // tâm vòng cuộn ≈ trung bình hạt 1..5; mép trong (gần tâm) màu bụng
  const [cx, cy] = [1, 2, 3, 4, 5].reduce(([a, b], i) => [a + pts[i][0] / 5, b + pts[i][1] / 5], [0, 0]);
  const inner = mAnd(whole, mEllipse(cx, cy, 1.9 * k, 1.9 * k));
  ctx.parts.push(part('tailin', mAndNot(inner, mBeads(pts.slice(0, 1))), rampOf(ctx, 'belly'), z + 0.01, { group: 'tail', normal: nrm, shade }));
}

const curlView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'curl');
  const pig = t.kind === 'pig';
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const ramp = rampOf(ctx, t.ramp ?? 'main');
  if (pig) {
    // heo: vòng nhỏ mảnh (1 điểm ảnh) có lỗ, cuống ngắn
    const R = Math.max(1.6, 2.0 * k);
    if (view === 'E') curlRing(ctx, bcx - brx - R + 0.6 + sw * 0.3, bcy - bry * 0.15 - R * 0.4, R, 1, ramp, [bcx - brx + 1.0, bcy]);
    else if (view === 'S') curlRing(ctx, bcx + brx + 1.6 + sw * 0.3, bcy - 0.2, R * 0.9, 1, ramp, [bcx + brx - 1.0, bcy + 0.8], -1);
    else curlRing(ctx, bcx + sw * 0.5, bcy + bry * 0.2, R, 8, ramp, [bcx - 1.7, bcy + bry * 0.2 + 1.7]);
    return;
  }
  if (view === 'E') {
    const pts = place(DOG_CURL, [bcx - brx + 1.4, sk.btop + 1.3], k, 'E', sw * 0.6);
    dogCurl(ctx, aboveGround(pts, sk.ground), 1);
  } else if (view === 'S') {
    const pts = placeN(DOG_CURL, [bcx + brx - 0.4, bcy - bry * 0.1], k * 0.9, sw * 0.6, -1);
    dogCurl(ctx, aboveGround(hugSide(ctx, pts, 0.3, 1), sk.ground), 1);
  } else {
    const pts = placeN(DOG_CURL_N, [bcx - 0.6, bcy + bry * 0.15], k, sw * 0.6);
    dogCurl(ctx, aboveGround(pts, sk.ground), 8);
  }
};
const curl = { S: settled(curlView('S')), E: settled(curlView('E')), N: settled(curlView('N')) };

// ---------------------------------------------------------------- fan: đuôi chim (mỗi loài một bộ lông vũ)
// Lông vũ = chuỗi hạt từ gốc theo góc `a` (độ; 0 = thẳng ra sau, 90 = dựng đứng), dài L, nửa bề ngang w, `bend` = độ cong rủ
// xuống ở chóp. Mỗi lông một nhóm (lông sau vẽ trước), nên giữa hai lông có một nét bậc 0 của lông đứng trước.
// `eye`: chấm tròn ở chóp (lông phượng). Nhìn sau: các lông xòe đối xứng (dir 'up' dựng lên, 'down' rủ xuống), spreadN độ.
function featherPts(a, L, w, bend = 0) {
  const n = Math.max(3, Math.ceil(L / 0.9));
  const pts = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (i) {
      const ang = (a - bend * t) * DEG;
      x -= (Math.cos(ang) * L) / n;
      y -= (Math.sin(ang) * L) / n;
    }
    const prof = t < 0.6 ? 0.55 + 0.45 * (t / 0.6) : 1 - 0.5 * ((t - 0.6) / 0.4);
    pts.push([x, y, Math.max(0.6, w * prof)]);
  }
  return pts;
}

function fanTail(ctx, view, feathers, t) {
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const z = view === 'N' ? 8 : 1;
  const n = feathers.length;
  let A;
  const lift = t.base ?? 0; // độ cao gốc đuôi: 0 giữa mông, dương = cao hơn (gà dựng đuôi), âm = thấp
  if (view === 'E') A = [bcx - brx + 0.6, bcy - bry * lift];
  else if (view === 'S') A = [bcx + brx - 1.2, bcy - bry * lift];
  else A = [bcx, bcy + bry * (t.baseN ?? (t.dirN === 'down' ? 0.1 : 0.3))];
  const sets = feathers.map((f, i) => {
    let pts;
    if (view === 'N') {
      // nhìn sau: lông xòe đối xứng quanh trục dọc (dựng lên hoặc rủ xuống), chóp cong ra ngoài
      const phi = n > 1 ? (t.spreadN ?? 100) * (i / (n - 1) - 0.5) : 0;
      const side = phi < 0 ? -1 : 1;
      const down = t.dirN === 'down';
      const ang = down ? 270 - phi : 90 + phi;
      const bend = (down ? side : -side) * (f.bend ?? 0) * (t.bendN ?? 0.25);
      const raw = featherPts(ang, f.L * (t.foreN ?? 0.8), f.w * (t.wN ?? 1.3), bend);
      const m = raw.length - 1;
      pts = raw.map(([x, y, r], j) => [A[0] + x * k + sw * 0.6 * (j / m) ** 2, A[1] + y * k, Math.max(0.6, r * k)]);
    } else {
      pts = place(featherPts(f.a, f.L, f.w, f.bend ?? 0), A, k, view, sw, 0.75);
      if (view === 'S') pts = hugSide(ctx, pts, 0.3, 2);
    }
    return aboveGround(pts, sk.ground);
  });
  const all = sets.flat();
  let nrm = nrmOf(all);
  // nhìn sau: quạt nằm trước lưng, khối sáng dời xuống-phải để lông sáng hơn lưng (như đuôi lông)
  if (view === 'N') nrm = [nrm[0] + 1.4, nrm[1] + 1.6, nrm[2] + 1.4, nrm[3] + 1.2];
  const order = view === 'N' ? feathers.map((_, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2)) : feathers.map((_, i) => i);
  order.forEach((i, rank) => {
    const f = feathers[i];
    const pts = sets[i];
    const zz = z + rank * 0.01;
    ctx.parts.push(part(`feather${i}`, mBeads(pts), rampOf(ctx, f.ramp ?? 'accent'), zz, { normal: nrm, shade: f.shade ?? 0 }));
    if (f.tip) {
      const tip = mAnd(mBeads(pts), mBeads(pts.slice(-Math.max(2, Math.round(pts.length * (f.tipLen ?? 0.3))))));
      ctx.parts.push(part(`feather${i}tip`, tip, rampOf(ctx, f.tip), zz + 0.005, { group: `feather${i}`, normal: nrm }));
    }
    if (f.eye) {
      const [ex, ey] = pts[pts.length - 2];
      const r = Math.max(0.9, 1.1 * k);
      ctx.parts.push(part(`feather${i}eye`, mEllipse(ex, ey, r, r), rampOf(ctx, f.eye), zz + 0.006, { normal: [ex - 0.5, ey - 0.6, r + 0.8, r + 0.8] }));
    }
  });
}

/** Bộ lông vũ mặc định (loài mới): ba lông màu điểm nhấn. */
const FAN_DEFAULT = {
  feathers: [{ a: 70, L: 4.2, w: 1.3, ramp: 'accent' }, { a: 45, L: 4.8, w: 1.4, ramp: 'accent' }, { a: 20, L: 4.2, w: 1.3, ramp: 'accent' }],
  spreadN: 90,
};
const fanView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'fan');
  fanTail(ctx, view, t.feathers ?? FAN_DEFAULT.feathers, { ...FAN_DEFAULT, ...t });
};
const fan = { S: settled(fanView('S')), E: settled(fanView('E')), N: settled(fanView('N')) };

// ---------------------------------------------------------------- dragon: đuôi rồng dày, thuôn dần, chùm lông ở chóp
// Thân đuôi màu thân; dải bụng (bụng rồng, màu bụng) chạy dưới đuôi khi nhìn ngang; gai lưng (điểm nhấn) dọc mép trên;
// chùm lông ở chóp hình ngọn lửa (dải `tuft`). Nhìn sau: đuôi từ mông thả xuống đất rồi vòng sang phải, gai thành hàng
// giữa sống đuôi.
const DRAGON = {
  E: [[0, 0, 2.6], [-2.3, 0.5, 2.4], [-4.4, 0.5, 2.1], [-6.2, -0.4, 1.8], [-7.4, -2.0, 1.5], [-8.0, -3.8, 1.2], [-8.0, -5.2, 1.0]],
  // nhìn trước: đuôi vòng ra bên phải, nằm sát đất rồi vểnh chóp lên
  S: [[0, 0, 2.5], [2.0, 1.2, 2.3], [3.8, 2.4, 2.0], [5.4, 2.8, 1.7], [6.8, 2.4, 1.4], [7.8, 1.2, 1.15], [8.2, -0.2, 0.95]],
  N: [[0, -0.5, 2.5], [0.4, 1.8, 2.3], [1.6, 3.7, 2.0], [3.6, 4.9, 1.7], [5.6, 5.1, 1.4], [7.2, 4.3, 1.15], [8.2, 3.0, 0.95]],
};
/** Chùm lông chóp đuôi: ba thùy theo hướng đuôi + một mũi nhọn, như ngọn lửa. */
function tuftAt(pts, k, size = 1) {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const [ux, uy] = [(x1 - x0) / d, (y1 - y0) / d];
  const [px, py] = [-uy, ux];
  const s = k * size;
  return mOr(
    mEllipse(x1 + ux * 1.3 * s, y1 + uy * 1.3 * s, 1.6 * s, 1.6 * s),
    mEllipse(x1 + (ux * 0.5 + px * 1.3) * s, y1 + (uy * 0.5 + py * 1.3) * s, 1.25 * s, 1.25 * s),
    mEllipse(x1 + (ux * 0.5 - px * 1.3) * s, y1 + (uy * 0.5 - py * 1.3) * s, 1.25 * s, 1.25 * s),
    mEllipse(x1 + ux * 2.9 * s, y1 + uy * 2.9 * s, 0.9 * s, 0.9 * s),
  );
}
/** Gai nhỏ hình tam giác dọc mép ngoài của đuôi ở các hạt `ids` (về phía `side` của pháp tuyến đường đuôi). */
function spikesAt(pts, ids, side, k) {
  const ms = [];
  for (const i of ids) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1, r] = pts[i];
    const [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(x2 - x0, y2 - y0) || 1;
    const [ux, uy] = [(x2 - x0) / d, (y2 - y0) / d];
    const [nx, ny] = [uy * side, -ux * side];
    const h = r + 1.5 * k;
    ms.push(mTri([x1 + nx * (r - 0.6) - ux * 0.9, y1 + ny * (r - 0.6) - uy * 0.9], [x1 + nx * (r - 0.6) + ux * 0.9, y1 + ny * (r - 0.6) + uy * 0.9], [x1 + nx * h + ux * 0.6, y1 + ny * h + uy * 0.6]));
  }
  return mOr(...ms);
}

const dragonView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'dragon');
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const z = view === 'N' ? 8 : 1;
  let pts;
  if (view === 'N') pts = aboveGround(placeN(DRAGON.N, [bcx, bcy + bry * 0.2], k, sw), sk.ground - 0.2);
  else if (view === 'E') pts = aboveGround(clearOfHead(ctx, place(DRAGON.E, [bcx - brx + 1.2, bcy + bry * 0.3], k, 'E', sw), 'E', 2, 0.8), sk.ground - 0.2);
  else pts = aboveGround(hugSide(ctx, placeN(DRAGON.S, [bcx + brx * 0.45, bcy + bry * 0.45], k, sw), 0.35), sk.ground - 0.2);
  const whole = mBeads(pts);
  const nrm = nrmOf(pts);
  const main = rampOf(ctx, t.ramp ?? 'main');
  const accent = rampOf(ctx, t.spikes ?? 'accent');
  if (t.spikes !== false) {
    // E: gai trên mép trên (về phía y âm); S: hình lật nên mép trên đổi phía; N: gai thành hàng hạt giữa sống đuôi.
    if (view === 'N') {
      const ridge = mOr(...[1, 2, 3, 4].map((i) => mEllipse(pts[i][0], pts[i][1] - pts[i][2] * 0.15, 0.75 * k + 0.2, 0.75 * k + 0.2)));
      ctx.parts.push(part('tailridge', mAnd(whole, ridge), accent, z + 0.03, { normal: nrm, line: false }));
    } else {
      ctx.parts.push(part('tailspikes', mAndNot(spikesAt(pts, [1, 2, 3, 4], view === 'E' ? -1 : 1, k), whole), accent, z - 0.02, { normal: nrm }));
    }
  }
  ctx.parts.push(part('tail', whole, main, z, { normal: nrm }));
  if (view !== 'N') {
    const under = mAnd(whole, mBeads(pts.slice(0, -2).map(([x, y, r]) => [x, y + r * 0.62, r * 0.55])));
    ctx.parts.push(part('tailbelly', under, rampOf(ctx, 'belly'), z + 0.01, { normal: nrm }));
  }
  const tuft = mAndNot(tuftAt(pts, k, t.tuftSize ?? 1), mAnd(whole, mBeads(pts.slice(0, -2))));
  ctx.parts.push(part('tailtuft', tuft, rampOf(ctx, t.tuft ?? 'accent'), z + 0.02, { normal: nrmOf([...pts.slice(-2), [pts.at(-1)[0], pts.at(-1)[1], 3 * k]]) }));
};
const dragon = { S: settled(dragonView('S')), E: settled(dragonView('E')), N: settled(dragonView('N')) };

// ---------------------------------------------------------------- fish: đuôi cá chép (cuống đuôi màu thân + vây đuôi chẻ đôi)
// Vây hai thùy (trên, dưới) màu điểm nhấn, thùy trên đứng trước nên có nét chia ở chỗ chẻ; mép vây sáng (dải bụng) như
// vây cá chép trong. Nhìn sau: đuôi cong dựng sau lưng, vây xòe chữ V.
const FISH = {
  E: [[0, 0, 2.2], [-2.2, -0.4, 1.9], [-4.0, -1.4, 1.5], [-5.4, -2.6, 1.2]],
  S: [[0, 0, 2.1], [2.0, 0.6, 1.8], [3.8, 0.4, 1.5], [5.2, -0.6, 1.2]],
  N: [[0, 1.2, 2.0], [0.2, -0.9, 1.7], [0.4, -2.9, 1.3], [0.4, -4.4, 1.0]],
};
/** Một thùy vây: elip xoay từ điểm P về phía Q, rộng w. */
function lobe(P, Q, w) {
  const [dx, dy] = [Q[0] - P[0], Q[1] - P[1]];
  const L = Math.hypot(dx, dy);
  return mEllipse(P[0] + dx * 0.55, P[1] + dy * 0.55, L * 0.55 + 0.4, w, Math.atan2(dy, dx));
}
const fishView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'fish');
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const z = view === 'N' ? 8 : 1;
  let pts;
  let up;
  let lo;
  if (view === 'N') {
    pts = aboveGround(placeN(FISH.N, [bcx, bcy + bry * 0.35], k, sw), sk.ground);
    const P = pts.at(-1);
    up = [P[0] - 4.2 * k + sw * 0.6, P[1] - 4.0 * k];
    lo = [P[0] + 4.2 * k + sw * 0.6, P[1] - 4.0 * k];
  } else if (view === 'E') {
    pts = aboveGround(clearOfHead(ctx, place(FISH.E, [bcx - brx + 1.0, bcy + bry * 0.1], k, 'E', sw), 'E', 2, 0.8), sk.ground);
    const P = pts.at(-1);
    up = [P[0] - 1.6 * k + sw * 0.4, P[1] - 5.6 * k];
    lo = [P[0] - 5.8 * k + sw * 0.4, P[1] - 0.6 * k];
  } else {
    pts = aboveGround(hugSide(ctx, placeN(FISH.S, [bcx + brx * 0.5, bcy + bry * 0.35], k, sw), 0.35), sk.ground);
    const P = pts.at(-1);
    up = [P[0] + 1.4 * k + sw * 0.4, P[1] - 5.0 * k];
    lo = [P[0] + 5.4 * k + sw * 0.4, P[1] - 0.4 * k];
  }
  const P = pts.at(-1);
  const w = Math.max(1.2, 1.8 * k);
  const body = mBeads(pts);
  const nrm = nrmOf([...pts, [up[0], up[1], 1], [lo[0], lo[1], 1]]);
  const fin = rampOf(ctx, t.fin ?? 'accent');
  const edge = rampOf(ctx, t.edge ?? 'belly');
  ctx.parts.push(part('tail', body, rampOf(ctx, t.ramp ?? 'main'), z, { normal: nrm }));
  const lower = lobe(P, lo, w);
  const upper = lobe(P, up, w);
  ctx.parts.push(part('finlo', lower, fin, z + 0.01, { normal: nrm }));
  ctx.parts.push(part('finup', upper, fin, z + 0.02, { normal: nrm }));
  // mép vây sáng ở hai chóp thùy (cùng nhóm với thùy của nó: không kẻ nét giữa mép và vây)
  ctx.parts.push(part('finedgelo', mAnd(lower, mEllipse(lo[0], lo[1], 1.5 * k, 1.5 * k)), edge, z + 0.015, { group: 'finlo', normal: nrm }));
  ctx.parts.push(part('finedgeup', mAnd(upper, mEllipse(up[0], up[1], 1.5 * k, 1.5 * k)), edge, z + 0.025, { group: 'finup', normal: nrm }));
};
const fish = { S: settled(fishView('S')), E: settled(fishView('E')), N: settled(fishView('N')) };

// ---------------------------------------------------------------- tinh chỉnh theo loài
// fluffy: shape (squirrel | brush | low | flow), ramp (thân đuôi), tip (chóp), rings (khoanh).
// curl: kind ('pig' | 'dog'). fan: feathers [{ a, L, w, bend, ramp, tip, eye, shade }], spreadN, dirN, foreN.
// dragon: tuft (dải chùm chóp), tuftSize, spikes (dải gai hoặc false). fish: fin, edge.
// Vai trò màu: 'main' | 'belly' | 'accent' (dải của loài, ramps.js) hoặc tên dải trong core.js RAMPS.
const TUNE = {
  // ---- fluffy
  soc_dong: { shape: 'squirrel', tip: 'belly' }, // sóc: đuôi chữ S dựng sau lưng, chóp kem
  soc_nam: { shape: 'squirrel', tip: 'belly' },
  gau_meo_do: { shape: 'squirrel', rings: 'maroon', tip: 'maroon' }, // gấu mèo đỏ: đuôi khoanh nâu đỏ sẫm, chóp sẫm
  cao_la: { shape: 'brush', tip: 'belly' }, // cáo: chóp trắng (màu bụng)
  cao_lua: { shape: 'brush', tip: 'belly' },
  soi_bac: { shape: 'low', tip: 'accent' }, // sói: bông xệ, chóp sẫm
  lan_con: { shape: 'brush', tip: 'accent' }, // lân: vàng, chóp đỏ (màu múa lân)
  ky_lan: { shape: 'brush', tip: 'accent' }, // kỳ lân: kem, chóp nâu vàng
  ngua_lua: { shape: 'flow', ramp: 'accent', tip: 'gold' }, // ngựa lửa: đuôi lửa, chóp vàng
  // ---- curl
  heo_than: { kind: 'pig' },
  heo_dat: { kind: 'pig' },
  cun_co: { kind: 'dog' },
  cho_vang: { kind: 'dog' },
  // ---- fan
  ga_vang: { // gà con: chỏm lông ngắn vểnh lên, màu thân, lông giữa cam
    base: 0.15,
    feathers: [{ a: 84, L: 4.6, w: 1.4, ramp: 'main' }, { a: 58, L: 5.2, w: 1.5, ramp: 'accent' }, { a: 32, L: 4.4, w: 1.4, ramp: 'main' }],
    spreadN: 100, foreN: 0.9, baseN: 0.5,
  },
  ga_trong: { // gà trống: bốn lông xòe vồng cao rồi rủ (đỏ sẫm, đỏ, đỏ chóp cam, cam), như đuôi gà trống
    base: 0.35,
    feathers: [
      { a: 22, L: 6.0, w: 1.15, bend: 20, ramp: 'main' }, { a: 104, L: 9.5, w: 1.15, bend: 75, ramp: 'maroon' },
      { a: 78, L: 10.5, w: 1.25, bend: 65, ramp: 'accent' }, { a: 50, L: 9.0, w: 1.2, bend: 45, ramp: 'accent', tip: 'main' },
    ],
    spreadN: 110, foreN: 0.85,
  },
  hac_bac: { // hạc: chùm lông rủ, trắng, chóp sẫm như lông hạc
    base: 0.05,
    feathers: [{ a: 52, L: 6.6, w: 1.6, bend: 80, ramp: 'main', tip: 'charcoal' }, { a: 30, L: 7.2, w: 1.7, bend: 70, ramp: 'main', tip: 'charcoal' }, { a: 8, L: 6.0, w: 1.6, bend: 45, ramp: 'main', tip: 'charcoal' }],
    spreadN: 100, dirN: 'down', foreN: 0.75,
  },
  vit_may: { // vịt mây: chỏm đuôi nhọn vểnh, trắng như mây, một lông xoăn
    base: 0.1,
    feathers: [{ a: 14, L: 4.4, w: 1.7, bend: -38, ramp: 'belly' }, { a: 40, L: 4.6, w: 1.5, bend: -70, ramp: 'main' }],
    spreadN: 50, foreN: 0.9, baseN: 0.55,
  },
  ung_lua: { // ưng lửa: quạt xòe rộng, nâu đỏ sẫm, chóp vàng
    base: 0,
    feathers: [
      { a: 40, L: 6.6, w: 1.45, ramp: 'accent', tip: 'belly' }, { a: 22, L: 7.2, w: 1.5, ramp: 'main', tip: 'belly' },
      { a: 4, L: 7.4, w: 1.5, ramp: 'accent', tip: 'belly' }, { a: -14, L: 6.6, w: 1.45, ramp: 'main', tip: 'belly' },
    ],
    spreadN: 130, dirN: 'down', foreN: 0.75,
  },
  chu_tuoc: { // chu tước: ba lông phượng dài xòe rồi rủ, vàng, chóp có mắt đỏ
    base: 0.25,
    feathers: [
      { a: 88, L: 10.5, w: 1.2, bend: 95, ramp: 'accent', eye: 'main' }, { a: 52, L: 12.0, w: 1.25, bend: 70, ramp: 'belly', eye: 'main' },
      { a: 18, L: 10.0, w: 1.2, bend: 40, ramp: 'accent', eye: 'main' },
    ],
    spreadN: 70, foreN: 0.85,
  },
  // ---- dragon
  ky_nhong: { tuft: 'gold', tuftSize: 0.8, spikes: false }, // kỳ nhông lửa: đuôi trơn, chóp đốm lửa
  rong_lua: { tuft: 'gold', spikes: 'accent' }, // rồng lửa nhí: chùm lửa vàng ở chóp, gai đỏ sẫm
  thanh_long: { tuft: 'accent', spikes: 'accent' },
  hoang_long: { tuft: 'accent', spikes: 'accent' },
  // ---- fish
  ca_chep_rong: { fin: 'accent', edge: 'belly' },
};
const DEFAULT_TUNE = { fluffy: { shape: 'brush', tip: 'belly' }, curl: {}, fan: {}, dragon: {}, fish: {} };
function tuneOf(ctx, kind) {
  const t = TUNE[ctx.sp.id];
  if (kind === 'curl' && !t?.kind) return { kind: ctx.sp.body === 'round' ? 'pig' : 'dog', ...t };
  return t && (kind !== 'fluffy' || t.shape) ? t : DEFAULT_TUNE[kind];
}

/** Sổ đăng ký: loại đuôi → { S, E, N }. */
export const TAILS = { none, flat, thin, puff, nub, fluffy, curl, fan, dragon, fish };

/** Loại đuôi chưa vẽ lại → hình tạm. Đã vẽ xong cả 9 loại: để trống (giữ để pipeline và sheet vẫn đọc được). */
export const FALLBACK = {};

/** Mục vẽ đuôi cho loài `sp` (không bao giờ undefined). */
export function tailFor(sp) {
  const kind = SPECIES_TAIL[sp.id] ?? sp.tail;
  return TAILS[kind] ?? FALLBACK[kind] ?? none;
}
