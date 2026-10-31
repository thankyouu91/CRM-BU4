// Dáng RỒNG / BÒ SÁT (serpent): Thanh Long, Cá Chép Rồng, Kỳ Nhông Lửa, Rồng Lửa Nhí, Hoàng Long (5 loài).
// Chủ sở hữu: họa sĩ dáng serpent. TRẠNG THÁI: bản vẽ thật, lượt 1b.
import { RAMPS, gait, mAnd, mAndNot, mBelow, mEllipse, mOr, mOrInto, mTri, newMask, part } from '../core.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Tinh chỉnh theo loài. */
const TUNE = {
  thanh_long: { frill: 'E', whiskers: true },
  hoang_long: { frill: 'E', whiskers: true },
  rong_lua: { frill: 'all', tip: 'flame' },
  ky_nhong: { ridge: 'none', tip: 'point', legs: 1.15, stance: 'lizard' },
  ca_chep_rong: { ridge: 'fin', legs: 0, tip: 'koi', whiskers: true, koi: true },
};
function lookOf(ctx) {
  const t = TUNE[ctx.sp.id] ?? {};
  return {
    ridge: t.ridge ?? 'spikes',
    tip: t.tip ?? (ctx.sp.tail === 'fish' ? 'koi' : 'tuft'),
    legs: t.legs ?? 1,
    frill: t.frill ?? false,
    whiskers: t.whiskers ?? false,
    stance: t.stance ?? 'coil',
    koi: t.koi ?? false,
  };
}
/** 0 = sơ sinh, 1 = trưởng thành (theo cỡ thân). */
const growT = (sk) => clamp((sk.bk - 0.45) / 0.69, 0, 1.2);

/** Ống thân: chuỗi đĩa nối liền qua các điểm [x, y, r] (nội suy từng 0.5 px). */
function tube(pts) {
  const m = newMask();
  for (let i = 0; i < pts.length; i++) {
    const [x, y, r] = pts[i];
    mOrInto(m, mEllipse(x, y, r, r));
    if (i + 1 < pts.length) {
      const [x2, y2, r2] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x, y2 - y) / 0.5));
      for (let k = 1; k < n; k++) {
        const u = k / n;
        const r3 = lerp(r, r2, u);
        mOrInto(m, mEllipse(lerp(x, x2, u), lerp(y, y2, u), r3, r3));
      }
    }
  }
  return m;
}

/** Bỏ đuôi do parts/tails.js vẽ: dáng serpent tự vẽ thân nối liền thành đuôi. */
function dropForeignTail(ctx) {
  for (let i = ctx.parts.length - 1; i >= 0; i--) {
    if (String(ctx.parts[i].group ?? ctx.parts[i].name).startsWith('tail')) ctx.parts.splice(i, 1);
  }
}

/** Chóp đuôi tại (x, y), hướng `dx, dy` (vector đơn vị theo chiều đuôi), cỡ k. */
function tailTip(ctx, look, x, y, dx, dy, z, k) {
  const A = ctx.ramps.accent;
  const nx = -dy;
  const ny = dx; // pháp tuyến
  const at = (a, b) => [x + dx * a + nx * b, y + dy * a + ny * b];
  if (look.tip === 'koi') {
    const m = mOr(
      mTri(at(-0.6, 1.3), at(5.6 * k, 4.6 * k), at(3.0 * k, 0)), mTri(at(-0.6, -1.3), at(5.6 * k, -4.6 * k), at(3.0 * k, 0)),
      mTri(at(-0.6, 1.3), at(-0.6, -1.3), at(3.0 * k, 0)),
    );
    ctx.parts.push(part('tipfin', m, A, z, { normal: [x + dx * 2 - 1, y + dy * 2 - 2, 5, 5] }));
  } else if (look.tip === 'tuft') {
    const m = mOr(mTri(at(-0.6, 1.5 * k), at(-0.6, -1.5 * k), at(3.8 * k, 0)), mTri(at(0, 0.4), at(1.2 * k, 2.4 * k), at(3.0 * k, 1.6 * k)), mTri(at(0, -0.4), at(1.2 * k, -2.4 * k), at(3.0 * k, -1.6 * k)));
    ctx.parts.push(part('tuft', m, A, z, { normal: [x - 1, y - 2, 4, 4] }));
  } else if (look.tip === 'flame') {
    const m = mOr(mTri(at(-0.6, 1.6 * k), at(-0.6, -1.6 * k), at(4.2 * k, 0.6)), mTri(at(0.6, 0.6), at(1.4 * k, 2.6 * k), at(3.0 * k, 1.2 * k)));
    ctx.parts.push(part('flame', m, 'orange', z, { normal: [x - 1, y - 2, 4, 4] }));
  }
}

/** Mảng màu cá chép (đỏ cam trên nền trắng) trên một đoạn thân của dáng này: cắt theo đoạn thân, không kẻ nét trong. */
function koiPatch(ctx, look, name, segMask, m, z, group, nrm) {
  if (!look.koi) return;
  ctx.parts.push(part(name, mAnd(segMask, m), ctx.ramps.accent, z + 0.02, { group, normal: nrm, line: false }));
}

const dirOf = (pts) => {
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  return [(x2 - x1) / d, (y2 - y1) / d];
};

/** Vạch vảy bụng: những hàng ngang bậc tối của dải bụng, bên trong mảng bụng (chừa mép). */
function plates(ctx, belly, y0, y1, step) {
  const c = RAMPS[ctx.ramps.belly][1];
  for (let y = Math.round(y0); y <= y1; y += step) {
    const xs = [];
    for (let x = 0; x < 48; x++) if (belly[y * 48 + x]) xs.push(x);
    if (xs.length < 4) continue;
    for (const x of xs.slice(1, -1)) ctx.pixels.push([x, y, c, 15]);
  }
}

// ---------------------------------------------------------------- nhìn trước / sau

function frontBody(ctx, back) {
  dropForeignTail(ctx);
  const { sk, pose, ramps } = ctx;
  const look = lookOf(ctx);
  const [bcx, bcy, brx, bry] = sk.body;
  const g = sk.ground;
  const t = growT(sk);
  const kx = lerp(0.72, 1, t);
  const ky = lerp(0.55, 1, t);
  const { s: si, lN, lF, walking } = gait(pose);
  const sd = back ? -1 : 1; // phía khoanh thân: phải người xem khi nhìn trước; đuôi ở phía kia
  const X = (dx) => bcx + sd * dx * kx;
  const sw = pose.tail ?? 0;
  const R = (r) => r * lerp(0.72, 1, t);
  let tailPts;
  let tz;
  if (look.stance === 'lizard') {
    // kỳ nhông: thân sau nằm thấp sau ngực, đuôi duỗi trên đất rồi vểnh chóp (nhìn sau: đuôi chĩa về phía người xem)
    const rump = mEllipse(bcx, g - R(2.6) + 0.42, brx * 0.85, R(2.6));
    ctx.parts.push(part('coil', rump, ramps.main, 3, { normal: [bcx - 1, g - 4, brx + 1, 4] }));
    const pts = back ? [[0, 2.2], [3.2, 2.0], [6.4, 1.8], [9.0, 2.6], [10.6 + sw * 0.4, 5.0]] : [[-3.0, 2.0], [-6.4, 1.8], [-9.4, 1.6], [-11.4, 2.8], [-12.2 + sw * 0.4, 5.2]];
    tailPts = pts.map(([dx, dy], i) => [X(dx), g - (i < 3 ? R(dy) - 0.42 : dy * ky), R(dy > 2.5 ? 1.25 : dy)]);
    tailPts[3][2] = R(1.45);
    tz = back ? 4.5 : 2;
  } else {
    // khoanh thân nằm trên đất, vòng sang một bên rồi luồn ra sau ngực
    const lapPts = [[0.5, 2.7], [4.0, 2.6], [7.0, 3.0], [8.8, 4.8], [7.2, 6.4]].map(([dx, dy], i) => [X(dx + (walking ? si * 0.15 : 0)), g - dy * ky, R([2.7, 2.6, 2.4, 2.1, 2.0][i])]);
    lapPts[0][1] = g - R(2.7) + 0.42;
    lapPts[1][1] = g - R(2.6) + 0.42;
    const lap = tube(lapPts);
    const lapN = [X(4), g - 4 * ky, 7 * kx, 4];
    ctx.parts.push(part('coil', lap, ramps.main, 3, { normal: lapN }));
    koiPatch(ctx, look, 'coilkoi', lap, mEllipse(X(7.4), g - 4.2 * ky, R(2.6), R(2.2)), 3, 'coil', lapN);
    // đuôi: ló ra phía bên kia, uốn chữ S đi lên rồi cuộn ra ngoài
    tailPts = [[-4.4, 2.5, 2.4], [-7.4, 3.0, 2.2], [-9.8, 5.2, 2.0], [-10.2, 8.2, 1.8], [-9.0, 10.8, 1.6], [-9.8, 13.2, 1.4], [-11.6 + sw * 0.5, 14.0, 1.25]]
      .map(([dx, dy, r]) => [X(dx), g - dy * ky, R(r)]);
    tailPts[0][1] = g - R(2.5) + 0.42;
    tz = back ? 3.5 : 2;
  }
  const tailM = tube(tailPts);
  const tailN = [X(-8), g - 8 * ky, 4, 7 * ky];
  ctx.parts.push(part('stail', tailM, ramps.main, tz, { normal: tailN }));
  koiPatch(ctx, look, 'tailkoi', tailM, mEllipse(X(-9.9), g - 7.0 * ky, R(2.2), R(1.8)), tz, 'stail', tailN);
  const [tx, ty] = tailPts[tailPts.length - 1];
  const [ddx, ddy] = dirOf(tailPts);
  tailTip(ctx, look, tx, ty, ddx, ddy, tz - 0.05, lerp(0.7, 1, t));
  // ngực
  const body = mEllipse(bcx, bcy, brx, bry);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  ctx.parts.push(part('body', body, ramps.main, 4, { normal: nrm }));
  if (!back) {
    const belly = mAnd(body, mEllipse(bcx, bcy + bry * 0.25, brx * 0.62, bry * 1.05));
    ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
    plates(ctx, belly, sk.btop + bry * 0.9, bcy + bry - 1.5, t > 0.5 ? 2 : 2);
  }
  // gờ lưng (nhìn sau): gai dọc sống lưng và dọc đuôi
  if (back && look.ridge === 'spikes') {
    for (let y = sk.btop + 3.2, i = 0; y < bcy + bry - 0.5; y += lerp(2.2, 2.6, t), i++) {
      const w = lerp(1.2, 1.7, t);
      ctx.parts.push(part(`ridge${i}`, mTri([bcx - w, y + 1.0], [bcx + w, y + 1.0], [bcx, y - lerp(1.6, 2.2, t)]), ramps.accent, 4.2, { group: `ridge${i}`, normal: [bcx - 0.5, y - 1, 2, 2] }));
    }
  } else if (back && look.ridge === 'fin') {
    const fin = mAnd(body, mEllipse(bcx, bcy - 0.5, 1.2, bry));
    ctx.parts.push(part('dorsal', fin, ramps.accent, 4.2, { normal: [bcx - 0.5, bcy - 1, 2, bry] }));
  }
  // tay: hai vuốt nhỏ khoanh trước ngực (nhìn trước); giơ lên thì đưa ra hai bên như dáng biped.
  // Kỳ nhông: chân trước dạng ngang chống xuống đất (nhìn sau: chân sau). Cá chép: vây ngực hai bên.
  const limb = ramps.limb ?? ramps.main;
  for (const s of [-1, 1]) {
    const up = s > 0 ? pose.armR ?? 0 : pose.armL ?? 0;
    const lift = s < 0 ? lF : lN;
    const swg = !walking ? 0 : (s < 0) === (lN > 0) ? 1 : 0;
    const z = back ? 3 : 6;
    if (!look.legs) {
      const ax = bcx + s * (brx - lerp(0.5, 0.9, t) + up * 1.2);
      const ay = bcy - lerp(0.2, 0.8, t) - up * 3.0 + swg;
      const k = lerp(0.7, 1, t);
      const m = mOr(mTri([ax - s * 0.6, ay - 1.6], [ax - s * 0.6, ay + 1.6], [ax + s * 3.8 * k, ay + 2.6 - up * 2.4]), mTri([ax - s * 0.6, ay - 1.6], [ax + s * 3.8 * k, ay + 2.6 - up * 2.4], [ax + s * 3.6 * k, ay - 0.4 - up * 2.4]));
      ctx.parts.push(part(`fin${s}`, m, ramps.accent, z, { normal: [ax, ay - 1, 3, 3] }));
    } else if (look.stance === 'lizard' && !up) {
      const fry = lerp(1.1, 1.3, t);
      const fx = bcx + s * (brx + lerp(0.6, 1.4, t));
      const fy = g - fry + 0.42 - lift;
      const lw = lerp(1.2, 1.45, t) * look.legs;
      const m = mOr(tube([[bcx + s * (brx - 1.4), back ? g - 3.2 : bcy + bry * 0.15, lw], [fx - s * 0.4, fy - 0.6, lw]]), mEllipse(fx, fy, lerp(1.6, 2.0, t), fry));
      ctx.parts.push(part(`leg${s}`, m, limb, 5, { normal: [fx - s - 0.5, fy - 3, 3, 4] }));
    } else if (!back || up) {
      // giơ lên: cánh tay dài hơn, chĩa chéo ra ngoài từ vai, nằm dưới râu và ngoài mép đầu (đầu to che mất tay giơ thẳng)
      const ax = bcx + s * (up ? brx + up * 1.5 : lerp(1.5, 2.3, t));
      const ay = up ? bcy - 1.0 - up * 2.0 : bcy - lerp(0.0, 0.5, t) + swg * 0.5;
      const rot = up ? -s * (0.55 + up * 0.2) : s * 0.55;
      const ry = up ? lerp(2.2, 2.7, t) : lerp(1.6, 2.0, t);
      ctx.parts.push(part(`arm${s}`, mEllipse(ax, ay, lerp(1.15, 1.4, t), ry, rot), limb, z, { normal: [ax - 0.5, ay - 1, 2, 3] }));
    }
  }
}

// ---------------------------------------------------------------- nhìn ngang (quay phải)

function seg(ctx, name, m, cx, cy, rx, ry, z, bellyFrom = null) {
  const nrm = [cx - 0.5, cy - 1, rx + 1, ry + 1.2];
  ctx.parts.push(part(name, m, ctx.ramps.main, z, { normal: nrm }));
  if (bellyFrom !== null) ctx.parts.push(part(`${name}b`, mAnd(m, mBelow(bellyFrom)), ctx.ramps.belly, z + 0.01, { group: name, normal: nrm }));
}

function sideBody(ctx) {
  dropForeignTail(ctx);
  const { sk, pose, ramps } = ctx;
  const look = lookOf(ctx);
  const [bcx, bcy, brx, bry] = sk.body;
  const g = sk.ground;
  const t = growT(sk);
  const k = lerp(0.6, 1, t);
  const { s: si, lN, lF, walking } = gait(pose);
  const und = walking ? [0, 0.6, 0.6, 0, -0.6, -0.6][pose.step] : 0;
  const legH = sk.legH;
  // ngực
  const body = mEllipse(bcx, bcy, brx, bry);
  seg(ctx, 'body', body, bcx, bcy, brx, bry, 4, null);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  const belly = mAnd(body, mEllipse(bcx + brx * 0.55, bcy + bry * 0.45, brx * 0.72, bry * 0.9));
  ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
  // đốt 1 (thấp, sau ngực), đốt 2 (gù lên), đuôi cong. Kỳ nhông: lưng thẳng, đuôi kéo trên đất rồi vểnh chóp.
  const liz = look.stance === 'lizard';
  const r1x = lerp(2.8, 4.4, t);
  const r1y = lerp(2.6, 4.0, t) * (liz ? 0.9 : 1);
  const c1x = bcx - brx - lerp(0.6, 1.4, t);
  const c1y = liz ? bcy + bry * 0.2 + und * 0.4 : g - legH * (look.legs ? 0.8 : 0) - r1y + 0.42 + (look.legs ? und * 0.5 : Math.min(0, und));
  const seg1 = mEllipse(c1x, c1y, r1x, r1y);
  seg(ctx, 'seg1', seg1, c1x, c1y, r1x, r1y, 3.9, c1y + r1y * 0.4);
  koiPatch(ctx, look, 'seg1koi', seg1, mEllipse(c1x + r1x * 0.2, c1y - r1y * 0.55, r1x * 0.7, r1y * 0.55), 3.9, 'seg1', [c1x - 0.5, c1y - 1, r1x + 1, r1y + 1.2]);
  const r2 = lerp(2.0, 3.2, t) * (liz ? 0.85 : 1);
  const c2x = c1x - r1x * (liz ? 0.85 : 1) - lerp(0.2, 0.8, t);
  const c2y = liz ? c1y + lerp(0.6, 1.2, t) - und * 0.4 : c1y - lerp(1.4, 3.0, t) - und;
  const seg2 = mEllipse(c2x, c2y, r2 * 1.05, r2);
  seg(ctx, 'seg2', seg2, c2x, c2y, r2 * 1.05, r2, 3.8, c2y + r2 * 0.4);
  koiPatch(ctx, look, 'seg2koi', seg2, mEllipse(c2x - r2 * 0.3, c2y - r2 * 0.2, r2 * 0.6, r2 * 0.6), 3.8, 'seg2', [c2x - 0.5, c2y - 1, r2 + 1, r2 + 1.2]);
  const sw = pose.tail ?? 0;
  const R = (r) => r * lerp(0.75, 1, t);
  let tailDef;
  if (liz) tailDef = [[-1.2, 0.6, 2.2], [-2.8, 1.8, 1.9], [-4.4, 1.9, 1.65], [-5.4, 0.5, 1.45], [-5.2 + sw * 0.3, -1.6, 1.25]];
  else if (look.tip === 'koi') tailDef = [[-1.0, -0.8, 2.4], [-2.3, -3.4, 2.0], [-2.5, -6.0, 1.6], [-1.6 + sw * 0.4, -8.0, 1.3]];
  else tailDef = [[-1.2, -0.8, 2.5], [-2.6, -3.8, 2.1], [-2.4, -7.0, 1.8], [-0.6, -9.4, 1.55], [1.8, -10.0, 1.35], [3.4 + sw * 0.5, -8.8, 1.2]];
  const pts = tailDef.map(([dx, dy, r]) => [c2x + dx * k, c2y + dy * k, R(r)]);
  const tail = tube(pts);
  ctx.parts.push(part('stail', tail, ramps.main, 3.7, { normal: [c2x - 1.5, c2y - 7 * k, 3.5, 6 * k] }));
  const [tx, ty] = pts[pts.length - 1];
  const [ddx, ddy] = dirOf(pts);
  tailTip(ctx, look, tx, ty, ddx, ddy, 3.65, lerp(0.7, 1, t));
  // gờ lưng: gai nhỏ dọc lưng và đuôi, chĩa về sau
  if (look.ridge === 'spikes') {
    const h = lerp(1.6, 2.6, t);
    const spikes = [
      [bcx - brx * 0.45, bcy - bry * 0.85, 3.95], [c1x + r1x * 0.35, c1y - r1y * 0.95, 3.85], [c1x - r1x * 0.45, c1y - r1y * 0.85, 3.85],
      [c2x + r2 * 0.1, c2y - r2, 3.75], [pts[1][0] - pts[1][2] * 0.8, pts[1][1], 3.68], [pts[2][0] - pts[2][2] * 0.6, pts[2][1] - pts[2][2] * 0.6, 3.68],
    ];
    spikes.forEach(([x, y, z], i) => {
      const m = mTri([x - 1.3 * k, y + 1.2], [x + 1.3 * k, y + 1.2], [x - 1.2 * k, y - h]);
      ctx.parts.push(part(`spike${i}`, m, ramps.accent, z, { normal: [x - 0.5, y - 1, 2, 2] }));
    });
  } else if (look.ridge === 'fin') {
    const hh = lerp(2.0, 3.4, t);
    const fin = mOr(
      mTri([c1x + r1x * 0.7, c1y - r1y * 0.75], [c1x - r1x * 0.3, c1y - r1y * 0.6], [c1x + r1x * 0.15, c1y - r1y - hh]),
      mTri([c1x - r1x * 0.1, c1y - r1y * 0.7], [c2x - r2 * 0.4, c2y - r2 * 0.6], [c2x + r2 * 0.2, c2y - r2 - hh * 0.9]),
    );
    ctx.parts.push(part('dorsal', fin, ramps.accent, 3.6, { normal: [c1x, c1y - r1y - 2, 5, 3] }));
  }
  // bốn chân nhỏ (cá chép: vây ngực)
  if (look.legs) {
    const lw = lerp(1.2, 1.5, t) * look.legs;
    const legs = [
      ['fN', bcx + brx * 0.2, si, lN, 5, 0, bcy + bry - 1.5], ['fF', bcx + brx * 0.2 + 1.5, -si, lF, 2, -1, bcy + bry - 1.5],
      ['bN', c1x + 0.4, -si, lF, 5, 0, c1y + r1y - 1.5], ['bF', c1x + 1.9, si, lN, 2, -1, c1y + r1y - 1.5],
    ];
    for (const [nm, lx, off, lift, z, sh, top] of legs) {
      const x0 = lx + off * 0.45;
      const m = mEllipse(x0, (top + g) / 2 - lift * 0.5, lw, (g - top) / 2 + 0.5 - lift * 0.5, 0, 2.6);
      ctx.parts.push(part(`leg${nm}`, m, ramps.limb ?? ramps.main, z, { normal: [x0 - 0.6, top, lw + 1, g - top + 1], shade: sh }));
    }
  } else {
    const fx = bcx + brx * 0.1;
    const fy = bcy + bry * 0.55;
    const m = mOr(mTri([fx + 1.8, fy - 1.4], [fx - 0.6, fy + 0.8], [fx - 4.0 * k, g - 0.6]), mTri([fx + 1.8, fy - 1.4], [fx - 4.0 * k, g - 0.6], [fx - 4.4 * k, fy + 0.4]));
    ctx.parts.push(part('finP', m, ramps.accent, 5, { normal: [fx - 1, fy, 4, 3] }));
  }
}

// ---------------------------------------------------------------- đầu

function head(ctx) {
  const { sk, view, ramps } = ctx;
  const look = lookOf(ctx);
  const [hcx, hcy, hrx, hry] = sk.head;
  const t = growT(sk);
  let m = mEllipse(hcx, hcy, hrx, hry, 0, 2.25);
  // mõm rồng nhô ra trước khi nhìn ngang
  if (view === 'E') m = mOr(m, mEllipse(hcx + hrx * 0.7, sk.eyeY + 2.4, hrx * 0.45, hry * 0.34, 0, 2.25));
  ctx.headMask = m;
  ctx.parts.push(part('head', m, ramps.main, ctx.zh, { normal: ctx.hnrm }));
  // mang má: gai nhọn sau hàm. Nhìn ngang: chĩa về sau (rồng). Nhìn trước/sau: hai bên má, chĩa ra ngoài (Rồng Lửa).
  if (look.frill === 'all' || (look.frill === 'E' && view === 'E')) {
    const L = lerp(2.0, 3.0, t);
    const sides = view === 'E' ? [[-1, hcx - hrx * 0.7, hcy + hry * 0.38]] : [-1, 1].map((s) => [s, hcx + s * hrx * 0.86, hcy + hry * 0.3]);
    for (const [s, x, y] of sides) {
      const fm = mOr(mTri([x, y - 2.2], [x, y + 0.8], [x + s * L, y - 2.4]), mTri([x, y - 0.2], [x, y + 2.4], [x + s * (L - 0.6), y + 1.6]));
      ctx.parts.push(part(`frill${s}`, mAndNot(fm, m), ramps.accent, ctx.zh - 0.1, { normal: [x - 1, y - 2, 3, 3] }));
    }
  }
  // râu rồng: sợi mảnh từ hai bên mõm, vểnh ra ngoài rồi cong lên (nhìn sau: chỉ lộ đầu râu hai bên đầu;
  // nhìn ngang: một sợi rủ dưới hàm, uốn về sau)
  if (look.whiskers) {
    const wz = view === 'N' ? ctx.zh - 0.2 : ctx.zh + 0.12;
    const y0 = sk.eyeY + lerp(2.6, 3.0, t);
    const w = lerp(0.55, 1, t); // độ dài phần râu ló ra ngoài đầu
    const lines = [];
    if (view === 'E') {
      const yb = hcy + hry;
      lines.push([[hcx + hrx * 0.45, yb - 1.2], [hcx + hrx * 0.1, yb + 0.9], [hcx - hrx * 0.3, yb + 1.6 * w], [hcx - hrx * (0.3 + 0.35 * w), yb + 0.9 * w], [hcx - hrx * (0.3 + 0.5 * w), yb - 0.6]]);
    } else {
      for (const s of [-1, 1]) {
        lines.push([[hcx + s * 3.2, y0], [hcx + s * 6.0, y0 + 0.7], [hcx + s * (hrx + 0.4), y0 + 0.6], [hcx + s * (hrx + 2.4 * w), y0 - 0.6 * w], [hcx + s * (hrx + 3.2 * w), y0 - 2.4 * w]]);
      }
    }
    lines.forEach((pts, i) => {
      const wm = tube(pts.map(([x, y]) => [x, y, 0.62]));
      ctx.parts.push(part(`whisker${i}`, view === 'N' ? mAndNot(wm, m) : wm, ramps.belly, wz, { group: 'whisker', flat: 3, line: false }));
    });
  }
}

const SWAY = [0, 1, 1, 0, -1, -1];

export default {
  id: 'serpent',
  dims: { head: [11.4, 9.6], body: [5.4, 5.6], side: [5.4, 5.0], leg: 3.0, overlap: 3.6, fwd: 5.0, eShift: 2.0, neckE: 'head' },
  headZ: (view) => (view === 'N' ? 6 : 8),
  /** Đi uốn lượn: nhìn trước/sau thân lắc ngang 1 px (như dáng chim), nhìn ngang thì sóng chạy dọc thân (sideBody). */
  walkPose: (i, view) => ({ sway: view === 'S' || view === 'N' ? SWAY[i] : 0 }),
  body: { S: (ctx) => frontBody(ctx, false), E: sideBody, N: (ctx) => frontBody(ctx, true) },
  head: { S: head, E: head, N: head },
};
