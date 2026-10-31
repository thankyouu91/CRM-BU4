// Dáng ĐỨNG HAI CHÂN (biped): Boba, thỏ, sóc, khỉ, gấu... Chủ sở hữu: họa sĩ dáng biped.
// Vẽ thân (thân + bụng), chân, tay, và khối đầu. Tai, đuôi, mặt, hoa văn, đặc điểm do các file parts/ lo.
// Port nguyên từ pets-pilot/scripts/rig2.py (body_parts, head_parts), khớp từng điểm ảnh với ảnh mẫu.
import { gait, mAnd, mEllipse, part } from '../core.js';

/** Thân và bụng (dùng chung cho mọi hướng). `bird` đổi cỡ bụng nhìn trước. */
function torso(ctx) {
  const { sk, view, ramps } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const body = mEllipse(bcx, bcy, brx, bry, 0, 2.0);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  ctx.parts.push(part('body', body, ramps.main, 4, { normal: nrm }));
  if (view === 'N') return;
  let ex;
  let ey;
  let erx;
  let ery;
  if (view === 'S') [ex, ey, erx, ery] = [bcx, bcy + 0.9, brx - 2.0, bry - 1.2];
  else [ex, ey, erx, ery] = [bcx + brx * 0.45, bcy + 0.9, brx * 0.62, bry - 1.2];
  const belly = mAnd(body, mEllipse(ex, ey, Math.max(1.2, erx), Math.max(1.2, ery)));
  ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
}

function feet(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [bcx, , brx] = sk.body;
  const g = sk.ground;
  const { s: si, lN, lF } = gait(pose);
  const fry = 1.45;
  const frx = 2.3 * Math.min(1, sk.bk + 0.35);
  if (view === 'S' || view === 'N') {
    const dx = Math.max(2.0, brx * 0.48);
    for (const [s, lift] of [[-1, lF], [1, lN]]) {
      const fx = bcx - (pose.sway ?? 0) + s * dx;
      const fy = g - fry + 0.42 - lift;
      ctx.parts.push(part(`foot${s}`, mEllipse(fx, fy, frx, fry), ramps.main, 3, { normal: [fx - 0.5, fy - 1, frx + 0.5, fry + 1] }));
    }
  } else {
    for (const [nm, off, lift, z, sh] of [['footF', -si, lF, 2, -1], ['footN', si, lN, 5, 0]]) {
      const fx = bcx + 0.8 + off * 0.9;
      const fy = g - fry + 0.42 - lift;
      ctx.parts.push(part(nm, mEllipse(fx, fy, frx + 0.3, fry), ramps.main, z, { normal: [fx - 0.5, fy - 1, frx + 1, fry + 1], shade: sh }));
    }
  }
}

function arms(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [bcx, bcy, brx] = sk.body;
  const { s: si, lN, walking } = gait(pose);
  const upR = pose.armR ?? 0;
  const upL = pose.armL ?? 0;
  if (view === 'S' || view === 'N') {
    for (const s of [-1, 1]) {
      const up = s > 0 ? upR : upL;
      const sw = !walking ? 0 : (s < 0) === (lN > 0) ? 1 : 0;
      if (ctx.handsBusy && view === 'S' && !up) continue; // hai tay đang ôm đồ (cốc trà sữa của Boba): vẽ cùng món đồ
      const ax = bcx + s * (brx - 0.3 + up * 1.2);
      const ay = bcy - 0.4 - up * 3.2 + sw;
      const z = view === 'S' ? 6 : 3;
      ctx.parts.push(part(`arm${s}`, mEllipse(ax, ay, 1.7, 2.6, -s * (0.35 + up * 0.5)), ramps.main, z, { normal: [ax - 0.5, ay - 1, 2.2, 3.2] }));
    }
  } else if (!ctx.handsBusy) {
    const ax = bcx + 1.0 - si * 0.5;
    ctx.parts.push(part('armN', mEllipse(ax, bcy - 0.2, 1.7, 2.7, -0.25 + si * 0.1), ramps.main, 6, { normal: [ax - 0.5, bcy - 1, 2.2, 3.2] }));
  }
}

function body(ctx) {
  torso(ctx);
  feet(ctx);
  arms(ctx);
}

/** Khối đầu: siêu elip (n = 2.25), z 8 khi nhìn trước/ngang, 6 khi nhìn sau. */
function head(ctx) {
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  const m = mEllipse(hcx, hcy, hrx, hry, 0, 2.25);
  ctx.headMask = m;
  ctx.parts.push(part('head', m, ctx.ramps.main, ctx.zh, { normal: ctx.hnrm }));
}

export default {
  id: 'biped',
  /**
   * Cỡ gốc trước khi nhân theo giai đoạn tuổi: head/body/side = [rx, ry] (side = thân nhìn ngang),
   * leg = chiều cao chân, overlap = đầu lún vào thân, fwd = đầu nhô về trước khi nhìn ngang,
   * eShift = thân lùi về sau khi nhìn ngang, neckE = điểm neo cổ khi nhìn ngang ('mid' giữa đầu và thân, 'head' dưới cằm).
   */
  dims: { head: [11.9, 10.0], body: [7.1, 5.6], side: [6.7, 5.6], leg: 2.7, overlap: 3.8, fwd: 1.1, eShift: 0.5, neckE: 'mid' },
  /** z của đầu theo hướng nhìn. */
  headZ: (view) => (view === 'N' ? 6 : 8),
  body: { S: body, E: body, N: body },
  head: { S: head, E: head, N: head },
};
