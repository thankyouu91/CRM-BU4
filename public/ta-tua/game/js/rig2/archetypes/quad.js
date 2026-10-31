// Dáng BỐN CHÂN (quad): mèo, chó, cáo, hươu, ngựa, rùa... Chủ sở hữu: họa sĩ dáng quad.
// Nhìn trước: hai chân trước dạng cột, bàn chân màu bụng. Nhìn ngang: thân dài, bốn chân bước chéo. Nhìn sau: mông và hai bàn chân sau.
// Port nguyên từ pets-pilot/scripts/rig2.py (mèo Meo Bạc), khớp từng điểm ảnh với ảnh mẫu.
import { gait, mAnd, mBelow, mEllipse, part } from '../core.js';

function torso(ctx) {
  const { sk, view, ramps } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const body = mEllipse(bcx, bcy, brx, bry, 0, 2.0);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  ctx.parts.push(part('body', body, ramps.main, 4, { normal: nrm }));
  if (view === 'N') return;
  const [ex, ey, erx, ery] = view === 'E' ? [bcx + 0.5, bcy + bry * 0.55, brx - 1.5, bry * 0.55] : [bcx, bcy - 0.3, brx * 0.52, bry * 0.85];
  const belly = mAnd(body, mEllipse(ex, ey, Math.max(1.2, erx), Math.max(1.2, ery)));
  ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
}

function legs(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const g = sk.ground;
  const { s: si, lN, lF } = gait(pose);
  const lw = 1.75 * Math.min(1, sk.bk + 0.3);
  const top = bcy + bry * 0.25;
  if (view === 'S') {
    for (const [s, lift] of [[-1, lF], [1, lN]]) {
      const lx = bcx + s * Math.max(1.8, brx * 0.4);
      const m = mEllipse(lx, (top + g) / 2 - lift * 0.5, lw + 0.25, (g - top) / 2 + 0.45 - lift * 0.5, 0, 3.0);
      ctx.parts.push(part(`legF${s}`, m, ramps.main, 5, { normal: [lx - 0.6, top, lw + 1, g - top + 1] }));
      const paw = mAnd(m, mBelow(g - 2.0 - lift));
      ctx.parts.push(part(`paw${s}`, paw, ramps.belly, 5.1, { group: `legF${s}`, normal: [lx - 0.6, g - 3, lw + 1, 3] }));
    }
  } else if (view === 'N') {
    for (const [s, lift] of [[-1, lF], [1, lN]]) {
      const lx = bcx + s * Math.max(2.0, brx * 0.5);
      const m = mEllipse(lx, g - 1.4 - lift, 2.1, 1.7);
      ctx.parts.push(part(`legB${s}`, m, ramps.main, 5, { normal: [lx - 0.5, g - 3, 2.6, 2.6] }));
      const pad = mAnd(m, mBelow(g - 0.9 - lift));
      ctx.parts.push(part(`pad${s}`, pad, ramps.belly, 5.1, { group: `legB${s}`, flat: 1 }));
    }
  } else {
    const list = [
      ['fN', bcx + brx - 2.6, si, lN, 5, 0], ['bN', bcx - brx + 2.8, -si, lF, 5, 0],
      ['fF', bcx + brx - 1.2, -si, lF, 2, -1], ['bF', bcx - brx + 4.0, si, lN, 2, -1],
    ];
    for (const [nm, lx, off, lift, z, sh] of list) {
      const x0 = lx + off * 0.45;
      const m = mEllipse(x0, (top + g) / 2 - lift * 0.5, lw, (g - top) / 2 + 0.5 - lift * 0.5, 0, 2.6);
      ctx.parts.push(part(`leg${nm}`, m, ramps.main, z, { normal: [x0 - 0.6, top, lw + 1, g - top + 1], shade: sh }));
      if (z === 5) {
        const paw = mAnd(m, mBelow(g - 1.6 - lift));
        ctx.parts.push(part(`paw${nm}`, paw, ramps.belly, 5.1, { group: `leg${nm}`, normal: [x0 - 0.6, g - 2, lw + 1, 2.5] }));
      }
    }
  }
}

function body(ctx) {
  torso(ctx);
  legs(ctx);
}

function head(ctx) {
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  const m = mEllipse(hcx, hcy, hrx, hry, 0, 2.25);
  ctx.headMask = m;
  ctx.parts.push(part('head', m, ctx.ramps.main, ctx.zh, { normal: ctx.hnrm }));
}

export default {
  id: 'quad',
  dims: { head: [11.6, 9.7], body: [6.9, 4.9], side: [9.4, 4.9], leg: 3.5, overlap: 3.4, fwd: 5.4, eShift: 3.0, neckE: 'head' },
  // Nhìn từ sau, đầu mèo nằm bên kia mông (z thấp hơn thân).
  headZ: (view) => (view === 'N' ? 3.5 : 8),
  body: { S: body, E: body, N: body },
  head: { S: head, E: head, N: head },
};
