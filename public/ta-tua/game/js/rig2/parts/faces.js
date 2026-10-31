// Mặt: mắt (chung cho mọi loài) và sổ đăng ký theo `face` của loài (muzzle mõm, beak mỏ, plain mặt trơn, snout mũi heo).
// Chủ sở hữu: họa sĩ mặt. Mỗi mục { S, E, N } nhận ctx và làm hai việc:
//  - mảng mặt tô bóng (mõm màu bụng, mặt nạ cánh cụt, mỏ nhìn ngang...) đẩy vào ctx.parts, nhóm 'head', z = ctx.zh + 0.1;
//  - mũi, miệng tô thẳng vào ctx.pixels: [x, y, hex, z] (z 20: nét mặt; 21: điểm sáng; 19: má hồng; 22: nước mắt).
// Nhìn sau (N) không có mặt. Dáng: ctx.pose.mouth 'open' | 'sad', blink, look (liếc ±1), tear (1, 2).
// muzzle, beak, plain: port nguyên từ pets-pilot (khớp từng điểm ảnh). snout: vẽ mới ở Rig 2.0 (heo than, heo đất, chuột chũi).
import { INK, RAMPS, mAnd, mEllipse, mOr, mTri, oklab, part, pyRound } from '../core.js';

/** Tinh chỉnh theo loài. band: dải kem rộng qua hai má và cằm (rái cá Boba). */
const TUNE = {
  boba: { band: true },
  // Mũi heo (snout). Đĩa mũi mặc định theo dải bụng (như mõm): heo than hồng nhạt, heo đất màu đào (heo đất nung).
  // nostril: màu lỗ mũi (bậc 0 của dải bụng nhạt quá ở 2x). mole: mũi chuột chũi, snout = dải của cục mũi (hồng như dữ liệu).
  heo_than: { nostril: '#a84848' },
  heo_dat: { nostril: '#5c3a24' },
  chuot_chui: { snout: 'pink', nostril: '#a84848', mole: true },
};
const tune = (ctx) => TUNE[ctx.sp.id] ?? {};

const D = INK;
const HILITE = '#fffaf3';
const EYE_LIGHT = '#58b9d6';

/**
 * Màu má hồng: lông tối (bậc giữa của dải thân có độ sáng OKLab < 0.6) dùng hồng đậm, lông sáng dùng hồng nhạt.
 * Mặt có mỏ thì má nằm trên mặt nạ sáng, nên luôn hồng nhạt.
 */
export function blushOf(ctx) {
  if (ctx.sp.face === 'beak') return '#f4a3b4';
  return oklab(RAMPS[ctx.ramps.main][2])[0] < 0.6 ? '#d9708a' : '#f4a3b4';
}

/** Mắt 2×3 (3×4 khi mắt to: bé sơ sinh, nhí nhố), điểm sáng trên-trái, má hồng, nước mắt. */
export function eyes(ctx) {
  const { sk, view, pose } = ctx;
  if (view === 'N') return;
  const [hcx] = sk.head;
  const { eyeY, big } = sk;
  const blink = pose.blink;
  const sad = pose.mouth === 'sad';
  const look = pose.look ?? 0;
  const list = view === 'S' ? [[-1, hcx - sk.eyeDx], [1, hcx + sk.eyeDx]] : [[1, sk.anchors.face[0]]];
  const [ew, eh] = big ? [3, 4] : [2, 3];
  const bc = ctx.blush ?? blushOf(ctx);
  const P = ctx.pixels;
  for (const [s, ex] of list) {
    const x0 = Math.floor(ex - ew / 2 + 0.5) + look;
    const y0 = Math.floor(eyeY - eh / 2 + 0.5);
    if (blink) {
      for (let i = 0; i < ew; i++) P.push([x0 + i, y0 + eh - 2, D, 20]);
      if (ew === 3) P.push([x0 + (s < 0 ? 0 : 2), y0 + eh - 3, D, 20]);
    } else {
      for (let j = 0; j < eh; j++) {
        for (let i = 0; i < ew; i++) {
          if (sad && j === 0) continue;
          P.push([x0 + i, y0 + j, D, 20]);
        }
      }
      P.push([x0, y0 + (sad ? 1 : 0), HILITE, 21]);
      if (big) P.push([x0 + 1, y0 + eh - 1, EYE_LIGHT, 21]);
    }
    if (view === 'S') {
      const bx = s < 0 ? x0 - 2 : x0 + ew;
      P.push([bx, y0 + eh, bc, 19], [bx + 1, y0 + eh, bc, 19]);
    } else {
      P.push([x0 - 2, y0 + eh, bc, 19], [x0 - 1, y0 + eh, bc, 19]);
    }
    if (pose.tear && (s < 0 || view === 'E')) {
      P.push([x0, y0 + eh + pose.tear, '#8fd0e8', 22], [x0, y0 + eh + pose.tear + 1, '#58b9d6', 22]);
    }
  }
}

/** Miệng nhìn trước tại (mx, my): cười, há (mouth 'open'), buồn (mouth 'sad'). */
function mouthS(ctx, mx, my) {
  const m = ctx.pose.mouth;
  const P = ctx.pixels;
  if (m === 'open') P.push([mx - 2, my, D, 20], [mx - 1, my, D, 20], [mx, my, D, 20], [mx + 1, my, D, 20], [mx - 1, my + 1, '#e84a5f', 20], [mx, my + 1, '#e84a5f', 20]);
  else if (m === 'sad') P.push([mx - 1, my + 1, D, 20], [mx, my + 1, D, 20], [mx - 2, my + 2, D, 20], [mx + 1, my + 2, D, 20]);
  else P.push([mx - 2, my, D, 20], [mx - 1, my + 1, D, 20], [mx, my + 1, D, 20], [mx + 1, my, D, 20]);
}

// ---- mõm (muzzle): mõm màu bụng, mũi nâu đậm
const muzzle = {
  S(ctx) {
    const { sk } = ctx;
    const [hcx, , hrx] = sk.head;
    const { eyeY } = sk;
    const m = tune(ctx).band
      ? mOr(mEllipse(hcx, eyeY + 3.4, hrx * 0.86, 3.6), mEllipse(hcx, eyeY + 2.0, 3.6, 2.6)) // rái cá: dải kem qua hai má và cằm
      : mEllipse(hcx, eyeY + 2.7, 3.6, 2.4);
    ctx.parts.push(part('muzzle', mAnd(ctx.headMask, m), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    const mx = pyRound(hcx);
    const ny = pyRound(eyeY + 1.6);
    ctx.pixels.push([mx - 1, ny, D, 20], [mx, ny, D, 20], [mx - 1, ny - 0, D, 20], [mx - 1, ny, '#4a3326', 20]);
    mouthS(ctx, mx, ny + 1);
  },
  E(ctx) {
    const { sk } = ctx;
    const [hcx, , hrx] = sk.head;
    const { eyeY } = sk;
    const [mx, my, mrx, mry] = [hcx + hrx * 0.74, eyeY + 2.5, 3.1, 2.3];
    ctx.parts.push(part('muzzle', mEllipse(mx, my, mrx, mry), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: [mx - 1, my - 1, mrx + 1, mry + 1] }));
    if (tune(ctx).band) {
      const cheek = mAnd(ctx.headMask, mEllipse(hcx + hrx * 0.2, eyeY + 3.4, hrx * 0.75, 3.2));
      ctx.parts.push(part('cheek', cheek, ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    }
    const tipx = pyRound(hcx + hrx * (0.74 + 0.3));
    const ny = pyRound(eyeY + 1.5);
    ctx.pixels.push([tipx, ny, D, 20], [tipx - 1, ny, D, 20]);
    const my2 = ny + 2;
    if (ctx.pose.mouth === 'open') ctx.pixels.push([tipx - 2, my2, D, 20], [tipx - 1, my2, D, 20], [tipx - 1, my2 + 1, '#e84a5f', 20]);
    else ctx.pixels.push([tipx - 2, my2, D, 20], [tipx - 1, my2, D, 20]);
  },
  N() {},
};

// ---- mặt trơn (plain): mũi hồng; loài tai mèo có thêm mảng má màu bụng; nhìn ngang có chóp mũi nhô ra
const plain = {
  S(ctx) {
    const { sk, sp } = ctx;
    const [hcx] = sk.head;
    const { eyeY } = sk;
    if (sp.ears === 'cat') {
      const m = mOr(mEllipse(hcx - 2.2, eyeY + 3.0, 3.4, 2.6), mEllipse(hcx + 2.2, eyeY + 3.0, 3.4, 2.6), mEllipse(hcx, eyeY + 4.4, 3.0, 2.0));
      ctx.parts.push(part('muzzlepatch', mAnd(ctx.headMask, m), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    }
    const mx = pyRound(hcx);
    const ny = pyRound(eyeY + 1.6);
    ctx.pixels.push([mx - 1, ny, '#d9708a', 20], [mx, ny, '#d9708a', 20]);
    mouthS(ctx, mx, ny + 1);
  },
  E(ctx) {
    const { sk, sp } = ctx;
    const [hcx, , hrx] = sk.head;
    const { eyeY } = sk;
    if (sp.ears === 'cat') {
      const m = mEllipse(hcx + hrx * 0.7, eyeY + 2.8, 3.2, 2.4);
      ctx.parts.push(part('muzzlepatch', mAnd(ctx.headMask, m), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    }
    const [nx, ny0] = [hcx + hrx * 0.86, eyeY + 2.2];
    ctx.parts.push(part('snout', mEllipse(nx, ny0, 1.9, 1.6), ctx.ramps.main, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    const tipx = pyRound(hcx + hrx * (0.86 + 0.15));
    const ny = pyRound(eyeY + 1.6);
    ctx.pixels.push([tipx, ny, '#d9708a', 20]);
    const my = ny + 2;
    if (ctx.pose.mouth === 'open') ctx.pixels.push([tipx - 2, my, D, 20], [tipx - 1, my, D, 20], [tipx - 1, my + 1, '#e84a5f', 20]);
    else ctx.pixels.push([tipx - 2, my, D, 20], [tipx - 1, my - 1, D, 20]);
  },
  N() {},
};

// ---- mỏ (beak): mặt nạ sáng quanh mắt; mỏ bậc màu điểm nhấn (dải accent của loài)
const beak = {
  S(ctx) {
    const { sk } = ctx;
    const [hcx] = sk.head;
    const { eyeY, eyeDx } = sk;
    const m = mOr(mEllipse(hcx - eyeDx + 0.3, eyeY + 0.4, 3.3, 3.0), mEllipse(hcx + eyeDx - 0.3, eyeY + 0.4, 3.3, 3.0), mEllipse(hcx, eyeY + 2.6, 4.6, 2.7));
    ctx.parts.push(part('mask', mAnd(ctx.headMask, m), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    const O = RAMPS[ctx.ramps.accent];
    const bx = pyRound(hcx) - 2;
    const by = pyRound(eyeY + 1.5);
    [O[3], O[2], O[2], O[1]].forEach((c, i) => ctx.pixels.push([bx + i, by, c, 20]));
    ctx.pixels.push([bx + 1, by + 1, O[2], 20], [bx + 2, by + 1, O[1], 20]);
    if (ctx.pose.mouth === 'open') ctx.pixels.push([bx + 1, by + 1, O[0], 21], [bx + 2, by + 1, O[0], 21]);
  },
  E(ctx) {
    const { sk } = ctx;
    const [hcx, , hrx] = sk.head;
    const { eyeY } = sk;
    const m = mOr(mEllipse(hcx + hrx * 0.46, eyeY + 0.6, 3.6, 3.2), mEllipse(hcx + hrx * 0.62, eyeY + 2.6, 3.4, 2.4));
    ctx.parts.push(part('mask', mAnd(ctx.headMask, m), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
    const [bx, by] = [hcx + hrx - 0.6, eyeY + 1.6];
    const tri = mTri([bx - 1.2, by - 1.4], [bx - 1.2, by + 1.3], [bx + 3.0, by + 0.2]);
    ctx.parts.push(part('beak', tri, ctx.ramps.accent, ctx.zh + 0.2, { normal: [bx, by - 1, 3, 2] }));
  },
  N() {},
};

// ---- mũi heo (snout): đĩa mũi nhô ra, hai lỗ mũi. Heo: đĩa to bè giữa hai mắt; chuột chũi (TUNE mole): mõm kem thon
// kéo xuống một cục mũi hồng nhỏ, nhìn ngang là mõm dài nhọn chúc xuống. Nhìn sau (N): đầu che hết mũi, không vẽ gì.
// Đĩa mũi là khối riêng (nhóm 'snout', không phải 'head'): có nét trong bậc 0 của chính dải màu (vành đĩa) và đổ bóng
// một bậc xuống đầu ngay dưới nó, nên đọc ra là nhô lên chứ không phải vệt sơn. Dải màu: TUNE snout, mặc định dải bụng.

/** Khung bao của một mặt nạ: { x0, y0, x1, y1 } (tính cả), hoặc null. */
function maskBox(m) {
  let x0 = 99;
  let y0 = 99;
  let x1 = -1;
  let y1 = -1;
  for (let k = 0; k < m.length; k++) {
    if (!m[k]) continue;
    const x = k % 48;
    const y = (k - x) / 48;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Hàng dưới cùng của đầu ở cột x (cằm), để miệng không rơi ra ngoài đầu ở bé sơ sinh (đầu thấp, mũi to). */
function chinAt(ctx, x) {
  const m = ctx.headMask;
  for (let y = 47; y >= 0; y--) if (m[y * 48 + x]) return y;
  return 47;
}

const snoutRamp = (ctx) => tune(ctx).snout ?? ctx.ramps.belly;
/** Màu lỗ mũi: TUNE nostril, mặc định bậc 0 của dải thân (đậm hơn bậc 0 của dải bụng, đọc rõ ở 2x). */
const nostrilOf = (ctx) => tune(ctx).nostril ?? RAMPS[ctx.ramps.main][0];

const snout = {
  S(ctx) {
    const { sk } = ctx;
    const [hcx, , hrx, hry] = sk.head;
    const { eyeY, big } = sk;
    const t = tune(ctx);
    const ramp = snoutRamp(ctx);
    const P = ctx.pixels;
    const nos = nostrilOf(ctx);
    const mx = pyRound(hcx);
    if (t.mole) {
      // sống mũi kem từ giữa hai mắt xuống, cục mũi hồng ở cuối
      const bridge = mOr(mEllipse(hcx, eyeY + 1.0, 2.0, 2.6), mEllipse(hcx, eyeY + 2.8, 3.3, 2.1));
      ctx.parts.push(part('muzzle', mAnd(ctx.headMask, bridge), ctx.ramps.belly, ctx.zh + 0.1, { group: 'head', normal: ctx.hnrm }));
      const ny = eyeY + 2.6 + (big ? 0.3 : 0);
      const nose = mAnd(ctx.headMask, mEllipse(hcx, ny, 2.6, 1.7, 0, 2.2));
      ctx.parts.push(part('snout', nose, ramp, ctx.zh + 0.12, { normal: [hcx - 1, ny - 1.2, 3.4, 2.6] }));
      const b = maskBox(nose);
      const r = b.y0 + 1;
      P.push([mx - 2, r, nos, 20], [mx + 1, r, nos, 20]);
      mouthS(ctx, mx, Math.min(b.y1 + 1, chinAt(ctx, mx) - 2));
      return;
    }
    const srx = Math.max(2.9, hrx * 0.33);
    const sry = Math.max(1.9, hry * 0.215);
    const sy = eyeY + 2.3 + (big ? 0.3 : 0);
    const disc = mAnd(ctx.headMask, mEllipse(hcx, sy, srx, sry, 0, 2.6));
    ctx.parts.push(part('snout', disc, ramp, ctx.zh + 0.12, { normal: [hcx - 1.2, sy - 1.6, srx + 1.2, sry + 1.8] }));
    const b = maskBox(disc);
    // lỗ mũi: hai vạch dọc đối xứng qua trục, cách vành 1 điểm (đĩa hẹp: sát vành)
    const inset = b.x1 - b.x0 + 1 >= 8 ? 2 : 1;
    const rows = b.y1 - b.y0 + 1 >= 5 ? [b.y0 + 1, b.y0 + 2] : [b.y0 + 1];
    for (const y of rows) P.push([b.x0 + inset, y, nos, 20], [b.x1 - inset, y, nos, 20]);
    mouthS(ctx, mx, Math.min(b.y1 + 1, chinAt(ctx, mx) - 2));
  },
  E(ctx) {
    const { sk } = ctx;
    const [hcx, , hrx] = sk.head;
    const { eyeY } = sk;
    const t = tune(ctx);
    const ramp = snoutRamp(ctx);
    const P = ctx.pixels;
    const nos = nostrilOf(ctx);
    if (t.mole) {
      // mõm dài thon chúc xuống, cục mũi hồng ở chóp
      const sx = hcx + hrx - 0.2;
      const sy = eyeY + 2.4;
      const tube = mOr(mEllipse(sx - 0.8, sy - 0.2, 2.6, 1.7), mEllipse(sx + 1.4, sy + 0.4, 1.9, 1.3));
      ctx.parts.push(part('muzzle', tube, ctx.ramps.belly, ctx.zh + 0.15, { group: 'snout', normal: [sx - 2, sy - 2, 4, 2.6] }));
      const tip = mEllipse(sx + 2.9, sy + 0.7, 1.4, 1.3);
      ctx.parts.push(part('snout', tip, ramp, ctx.zh + 0.2, { group: 'snout', normal: [sx + 2.4, sy, 2, 2] }));
      const b = maskBox(mOr(tube, tip));
      P.push([b.x1, pyRound(sy + 0.2), nos, 20]);
      const my = b.y1 + 1;
      P.push([b.x1 - 3, my, D, 20], [b.x1 - 4, my, D, 20]);
      if (ctx.pose.mouth === 'open') P.push([b.x1 - 3, my + 1, '#e84a5f', 20]);
      return;
    }
    const sx = hcx + hrx - 0.4;
    const sy = eyeY + 2.4;
    const tube = mEllipse(sx, sy, 2.4, 2.1, 0, 3.0);
    ctx.parts.push(part('snout', tube, ramp, ctx.zh + 0.2, { normal: [sx - 1.6, sy - 1.6, 3.4, 3.0] }));
    const b = maskBox(tube);
    // mặt đĩa nhìn nghiêng: cột chóp sáng một bậc, lỗ mũi trên mặt đĩa
    for (let y = b.y0 + 1; y < b.y1; y++) P.push([b.x1, y, RAMPS[ramp][2], 19.5]);
    P.push([b.x1, pyRound(sy) - 1, nos, 20], [b.x1 - 1, pyRound(sy) - 1, nos, 20]);
    const my = b.y1 + 1;
    if (ctx.pose.mouth === 'open') P.push([b.x1 - 2, my, D, 20], [b.x1 - 3, my, D, 20], [b.x1 - 3, my + 1, '#e84a5f', 20]);
    else if (ctx.pose.mouth === 'sad') P.push([b.x1 - 2, my + 1, D, 20], [b.x1 - 3, my, D, 20]);
    else P.push([b.x1 - 2, my, D, 20], [b.x1 - 3, my, D, 20], [b.x1 - 4, my - 1, D, 20]);
  },
  N() {},
};

/** Sổ đăng ký: loại mặt → { S, E, N }. */
export const FACES = { muzzle, plain, beak, snout };

/** Loại mặt chưa vẽ lại → hình tạm. Đã vẽ hết; loại lạ: mặt trơn. */
export const FALLBACK = {};

export const faceFor = (kind) => FACES[kind] ?? FALLBACK[kind] ?? plain;
