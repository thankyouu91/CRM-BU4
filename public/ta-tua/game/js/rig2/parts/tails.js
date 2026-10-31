// Đuôi: sổ đăng ký theo `tail` của từng loài trong shared/pets.js. Chủ sở hữu: họa sĩ đuôi.
// Mỗi mục { S, E, N }: hàm vẽ nhận ctx, đẩy bộ phận vào ctx.parts. Đuôi nằm sau thân khi nhìn trước/ngang (z = 1)
// và trước thân khi nhìn sau (z = 8). ctx.pose.tail ∈ {−1, 0, 1} làm chóp đuôi đung đưa.
// flat, thin, puff, nub: port nguyên từ pets-pilot (khớp từng điểm ảnh). Loại chưa vẽ lại dùng tạm FALLBACK.
import { mAnd, mChain, mEllipse, mTri, part } from '../core.js';

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

/** Sổ đăng ký: loại đuôi → { S, E, N }. */
export const TAILS = { none, flat, thin, puff, nub };

/**
 * Loại đuôi chưa vẽ lại → hình tạm. Họa sĩ vẽ xong loại nào thì thêm vào TAILS và xóa khỏi đây.
 * fluffy (sóc, cáo, ngựa): đuôi mảnh to hơn; curl (heo, cún): đuôi mảnh; dragon (rồng): đuôi mảnh to;
 * fish (cá chép rồng): đuôi mảnh; fan (gà, chim): cục bông màu thân.
 */
const thick = (r) => ({ S: thinView('S', r), E: thinView('E', r), N: thinView('N', r) });
export const FALLBACK = {
  fluffy: thick(1.9),
  curl: thin,
  dragon: thick(1.6),
  fish: thin,
  fan: puff,
};

/** Mục vẽ đuôi cho loài `sp` (không bao giờ undefined). */
export function tailFor(sp) {
  const kind = SPECIES_TAIL[sp.id] ?? sp.tail;
  return TAILS[kind] ?? FALLBACK[kind] ?? none;
}
