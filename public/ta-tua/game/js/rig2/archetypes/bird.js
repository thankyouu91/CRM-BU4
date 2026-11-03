// Dáng CHIM (bird): cánh cụt, gà, cú, hạc, vịt, ưng, chu tước. Chủ sở hữu: họa sĩ dáng bird.
// Thân tròn, hai bàn chân màu điểm nhấn (mỏ), hai cánh thay tay; đi lạch bạch (lắc ngang + vẫy cánh).
// Port nguyên từ pets-pilot/scripts/rig2.py (Chim Cánh Cụt), khớp từng điểm ảnh với ảnh mẫu.
import { gait, mAnd, mEllipse, part } from '../core.js';

function torso(ctx) {
  const { sk, view, ramps } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const body = mEllipse(bcx, bcy, brx, bry, 0, 2.0);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  ctx.parts.push(part('body', body, ramps.main, 4, { normal: nrm }));
  if (view === 'N') return;
  const [ex, ey, erx, ery] = view === 'S' ? [bcx, bcy + 0.9, brx - 1.6, bry - 0.9] : [bcx + brx * 0.45, bcy + 0.9, brx * 0.62, bry - 1.2];
  const belly = mAnd(body, mEllipse(ex, ey, Math.max(1.2, erx), Math.max(1.2, ery)));
  ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
}

function feet(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [bcx, , brx] = sk.body;
  const g = sk.ground;
  const { s: si, lN, lF } = gait(pose);
  const fry = 1.15;
  const frx = 2.2 * Math.min(1, sk.bk + 0.35);
  if (view === 'S' || view === 'N') {
    const dx = Math.max(2.0, brx * 0.48);
    for (const [s, lift] of [[-1, lF], [1, lN]]) {
      const fx = bcx - (pose.sway ?? 0) + s * dx;
      const fy = g - fry + 0.42 - lift;
      ctx.parts.push(part(`foot${s}`, mEllipse(fx, fy, frx, fry), ramps.accent, 3, { normal: [fx - 0.5, fy - 1, frx + 0.5, fry + 1] }));
    }
  } else {
    for (const [nm, off, lift, z, sh] of [['footF', -si, lF, 2, -1], ['footN', si, lN, 5, 0]]) {
      const fx = bcx + 0.8 + off * 0.9;
      const fy = g - fry + 0.42 - lift;
      ctx.parts.push(part(nm, mEllipse(fx, fy, frx + 0.3, fry), ramps.accent, z, { normal: [fx - 0.5, fy - 1, frx + 1, fry + 1], shade: sh }));
    }
  }
}

function wings(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [bcx, bcy, brx] = sk.body;
  const flap = pose.flap ?? 0;
  if (view === 'S' || view === 'N') {
    for (const s of [-1, 1]) {
      const up = (s > 0 ? pose.armR ?? 0 : pose.armL ?? 0) + flap;
      const wx = bcx + s * (brx - 0.2 + up * 0.6);
      const wy = bcy + 0.4 - up * 1.6;
      ctx.parts.push(part(`wing${s}`, mEllipse(wx, wy, 1.7, 4.0, s * (0.32 + up * 0.5)), ramps.main, 5, { normal: [wx - 0.8, wy - 2, 2.4, 4.6] }));
    }
  } else {
    const wx = bcx - 0.6;
    ctx.parts.push(part('wingN', mEllipse(wx, bcy + 0.2 - flap, 2.2, 4.4, 0.45 - flap * 0.3), ramps.main, 6, { normal: [wx - 0.8, bcy - 2, 2.8, 4.8] }));
  }
}

function body(ctx) {
  torso(ctx);
  feet(ctx);
  wings(ctx);
}

function head(ctx) {
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  const m = mEllipse(hcx, hcy, hrx, hry, 0, 2.25);
  ctx.headMask = m;
  ctx.parts.push(part('head', m, ctx.ramps.main, ctx.zh, { normal: ctx.hnrm }));
}

const SWAY = [0, 1, 1, 0, -1, -1];
const FLAP = [0, 1, 0, 0, 1, 0];

export default {
  id: 'bird',
  dims: { head: [10.7, 9.0], body: [8.2, 7.4], side: [7.6, 7.4], leg: 1.8, overlap: 4.0, fwd: 0.9, eShift: 0.5, neckE: 'mid' },
  headZ: (view) => (view === 'N' ? 6 : 8),
  body: { S: body, E: body, N: body },
  head: { S: head, E: head, N: head },
  /** Đi lạch bạch: thân lắc ngang (nhìn trước/sau) và vẫy cánh ở khung `i` của dáng đi. */
  walkPose: (i, view) => ({ sway: view === 'S' || view === 'N' ? SWAY[i] : 0, flap: FLAP[i] }),
};
