// Mặt: mắt (chung cho mọi loài) và sổ đăng ký theo `face` của loài (muzzle mõm, beak mỏ, plain mặt trơn, snout mũi heo).
// Chủ sở hữu: họa sĩ mặt. Mỗi mục { S, E, N } nhận ctx và làm hai việc:
//  - mảng mặt tô bóng (mõm màu bụng, mặt nạ cánh cụt, mỏ nhìn ngang...) đẩy vào ctx.parts, nhóm 'head', z = ctx.zh + 0.1;
//  - mũi, miệng tô thẳng vào ctx.pixels: [x, y, hex, z] (z 20: nét mặt; 21: điểm sáng; 19: má hồng; 22: nước mắt).
// Nhìn sau (N) không có mặt. Dáng: ctx.pose.mouth 'open' | 'sad', blink, look (liếc ±1), tear (1, 2).
// muzzle, beak, plain: port nguyên từ pets-pilot (khớp từng điểm ảnh). snout: chưa vẽ lại, dùng tạm mõm (FALLBACK).
import { INK, RAMPS, mAnd, mEllipse, mOr, mTri, oklab, part, pyRound } from '../core.js';

/** Tinh chỉnh theo loài. band: dải kem rộng qua hai má và cằm (rái cá Boba). */
const TUNE = { boba: { band: true } };
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

/** Sổ đăng ký: loại mặt → { S, E, N }. */
export const FACES = { muzzle, plain, beak };

/** Loại mặt chưa vẽ lại → hình tạm. snout (heo, chuột chũi): tạm dùng mõm. Loại lạ: mặt trơn. */
export const FALLBACK = { snout: muzzle };

export const faceFor = (kind) => FACES[kind] ?? FALLBACK[kind] ?? plain;
