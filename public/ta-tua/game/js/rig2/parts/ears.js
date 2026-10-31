// Tai (và sừng, gạc, vây, mào trên đầu): sổ đăng ký theo `ears` của từng loài trong shared/pets.js. Chủ sở hữu: họa sĩ tai.
// Mỗi mục { S, E, N }: hàm vẽ nhận ctx, đẩy bộ phận tô bóng vào ctx.parts (và điểm vào ctx.pixels nếu cần).
// Tai nằm sau đầu khi nhìn trước/ngang (z = 2) và trước đầu khi nhìn sau (z = 7). ctx.pose.ear = 1 thì tai cụp/giật.
// Loại chưa vẽ lại dùng tạm mục gần nhất (FALLBACK bên dưới); loại lạ hoàn toàn thì không vẽ gì (không bao giờ lỗi).
// round, cat, bunny: port nguyên từ pets-pilot (khớp từng điểm ảnh với ảnh mẫu).
import { mAnd, mEllipse, mStamp, mTri, part, pyRound } from '../core.js';

/** Tinh chỉnh theo loài: scale (cỡ), spread (độ xòe ngang), drop (độ thấp) cho tai tròn. */
const TUNE = {
  boba: { scale: 0.78, spread: 0.8, drop: 0.62 }, // tai rái cá nhỏ, thấp, sát hai bên
};
const tune = (ctx) => TUNE[ctx.sp.id] ?? {};
const zBack = (view) => (view === 'N' ? 7 : 2);

function roundEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const t = tune(ctx);
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const r = ((2.9 * sk.hk) / 0.92) * 0.95 * (t.scale ?? 1);
  const sides = view !== 'E' ? [-1, 1] : [-1];
  for (const s of sides) {
    let ex;
    let ey;
    if (view === 'E') {
      ex = hcx - hrx * 0.3;
      ey = hcy - (hry * 0.86 * (t.drop ?? 0.93)) / 0.93;
    } else {
      ex = hcx + s * hrx * (t.spread ?? 0.7);
      ey = hcy - hry * (t.drop ?? 0.8) + (s > 0 ? tw : 0);
    }
    ctx.parts.push(part(`ear${s}`, mEllipse(ex, ey, r, r), ramps.main, zb, { normal: [ex, ey, r, r] }));
    if (view !== 'N') {
      const ir = r - (r > 2.4 ? 1.25 : 1.0);
      ctx.parts.push(part(`ear${s}in`, mEllipse(ex + (view === 'E' ? 0.2 : s * 0.2), ey + 0.3, ir, ir), ramps.inner, zb + 0.1, {
        group: `ear${s}`, normal: [ex, ey, r, r],
      }));
    }
  }
}

function catEars(ctx, size = 1) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const k = sk.hk / 0.92;
  const h = 7.4 * k * size;
  const w = 5.4 * k * size;
  const sides = view !== 'E' ? [-1, 1] : [1, -1];
  for (const s of sides) {
    let a;
    let b;
    let c;
    let z;
    let sh;
    if (view === 'E') {
      // tai gần ở sau đầu, tai xa ló ra phía sau hơn
      const base = hcx - hrx * (s > 0 ? 0.1 : 0.55);
      const y0 = hcy - hry * 0.52;
      [a, b, c] = [[base - w * 0.55, y0], [base + w * 0.55, y0], [base - w * 0.05, y0 - h]];
      z = s > 0 ? zb : zb - 0.5;
      sh = s > 0 ? 0 : -1;
    } else {
      const ox = hcx + s * hrx * 0.6;
      const y0 = hcy - hry * 0.48 + (s > 0 ? tw : 0);
      a = [ox - s * w * 0.75, y0 - 0.5];
      b = [ox + s * w * 0.55, y0 + 0.6];
      c = [ox + s * w * 0.2, y0 - h];
      z = zb;
      sh = 0;
    }
    const m = mTri(a, b, c);
    ctx.parts.push(part(`ear${s}`, m, ramps.main, z, { normal: [c[0], (a[1] + c[1]) / 2, w, h], shade: sh }));
    if ((view !== 'N' && s > 0) || view === 'S') {
      // lòng tai: tam giác nhỏ hơn, lệch về chóp
      const ia = [a[0] * 0.6 + c[0] * 0.4, a[1] - 0.4];
      const ib = [b[0] * 0.6 + c[0] * 0.4, b[1] - 0.4];
      const ic = [c[0], c[1] + 1.6];
      ctx.parts.push(part(`ear${s}in`, mAnd(m, mTri(ia, ib, ic)), ramps.inner, z + 0.1, { group: `ear${s}`, flat: 2 }));
    }
  }
  // Túm lông má hai bên đầu (thuộc nhóm đầu: khăn quàng nằm dưới nó).
  if (view === 'S') {
    for (const s of [-1, 1]) {
      const tx = hcx + s * (hrx - 0.2);
      const ty = hcy + hry * 0.35;
      const m = mTri([tx - s * 1.6, ty - 1.4], [tx + s * 1.9, ty + 0.4], [tx - s * 1.2, ty + 1.8]);
      ctx.parts.push(part(`tuft${s}`, m, ramps.main, ctx.zh - 0.05, { group: 'head', normal: ctx.hnrm }));
    }
  } else if (view === 'E') {
    const tx = hcx - hrx + 0.4;
    const ty = hcy + hry * 0.35;
    const m = mTri([tx + 1.4, ty - 1.4], [tx - 1.9, ty + 0.5], [tx + 1.2, ty + 1.8]);
    ctx.parts.push(part('tuft', m, ramps.main, ctx.zh - 0.05, { group: 'head', normal: ctx.hnrm }));
  }
}

function bunnyEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const k = sk.hk / 0.92;
  const h = 7.6 * k;
  const w = 2.6 * k;
  const sides = view !== 'E' ? [-1, 1] : [1, -1];
  for (const s of sides) {
    let ex;
    let rot;
    let z;
    let sh;
    if (view === 'E') {
      ex = hcx - hrx * (s > 0 ? 0.15 : 0.45);
      rot = -0.25;
      [z, sh] = s > 0 ? [zb, 0] : [zb - 0.5, -1];
    } else {
      ex = hcx + s * hrx * 0.38;
      rot = s * 0.18;
      [z, sh] = [zb, 0];
    }
    const ey = hcy - hry - h * 0.42 + (s > 0 ? tw : 0);
    ctx.parts.push(part(`ear${s}`, mEllipse(ex, ey, w, h, rot), ramps.main, z, { normal: [ex, ey, w * 1.4, h], shade: sh }));
    if (view !== 'N') {
      ctx.parts.push(part(`ear${s}in`, mEllipse(ex + (view === 'E' ? 0.3 : 0), ey + 0.8, w - 1.1, h - 2.2, rot), ramps.inner, z + 0.1, {
        group: `ear${s}`, flat: 2,
      }));
    }
  }
}

// ---- hình tạm từ bản đồ ký tự của rig.js cũ (sừng, gạc, vây, mào, tai cụp), đã khóa màu và có viền.
// Mỗi ký tự → [vai màu: 'main' | 'inner' | 'accent' | tên dải trong RAMPS, bậc màu cố định].
const HORN = 'wheat';
const LEGACY = {
  horns: { rows: ['a..', 'aa.', '.aa', '.aa'], dx: 0.55, sink: 1, keys: { a: [HORN, 2] } },
  antler: { rows: ['a.a....', 'a.a.a..', '.aaa.a.', '..aaa..', '...a...', '...a...'], dx: 0.85, sink: 1, keys: { a: ['tan', 3] } },
  crest: { rows: ['.a.', 'aaa', 'aaa'], centre: true, sink: 1, keys: { a: ['accent', 2] } },
  fin: { rows: ['a...', 'aa.a', 'aaaa', 'aa.a', 'a...'], side: true, keys: { a: ['accent', 2] } },
  floppy: { rows: ['dddd', 'dddd', 'dddd', 'dddd', '.ddd', '..dd'], hang: true, keys: { d: ['main', 1] } },
};

function legacyEars(kind) {
  const def = LEGACY[kind];
  const w = def.rows[0].length;
  const h = def.rows.length;
  return (ctx) => {
    const { sk, view, pose } = ctx;
    const [hcx, hcy, hrx] = sk.head;
    const droop = pose.ear ?? 0;
    const top = pyRound(sk.htop);
    const cx = pyRound(hcx * 2) / 2;
    let places; // [x, y, lật?]
    let z = zBack(view);
    if (def.centre) {
      places = [[pyRound(cx - w / 2), top + def.sink - h + 1, false]];
      z = view === 'N' ? 7 : ctx.zh + 0.05;
    } else if (def.hang) {
      // tai cụp rủ hai bên đầu, phía trước đầu
      const xl = pyRound(hcx - hrx - 1);
      const xr = pyRound(hcx + hrx - w + 1);
      const y = top + 2 + droop;
      places = view === 'E' ? [[pyRound(hcx - hrx * 0.45), y, true]] : [[xl, y, false], [xr, y, true]];
      z = ctx.zh + 0.05;
    } else if (def.side) {
      const y = pyRound(hcy) - 3 + droop;
      places = view === 'E' ? [[pyRound(hcx - hrx * 0.4) - w, y, false]] : [[pyRound(hcx - hrx) - w + 1, y, false], [pyRound(hcx + hrx) - 1, y, true]];
    } else {
      const xl = pyRound(hcx - hrx * def.dx);
      const y = top + def.sink - h + droop;
      const xr = pyRound(2 * hcx) - xl - w;
      places = view === 'E' ? [[pyRound(hcx - hrx * 0.25) - w + 2, y, false]] : [[xl, y, false], [xr, y, true]];
    }
    places.forEach(([x, y, flip], n) => {
      for (const [ch, [role, flat]] of Object.entries(def.keys)) {
        const ramp = ['main', 'inner', 'accent', 'belly'].includes(role) ? ctx.ramps[role] : role;
        const m = mStamp(def.rows, ch, x, y, flip);
        ctx.parts.push(part(`${kind}${n}${ch}`, m, ramp, z, { group: `${kind}${n}`, flat }));
      }
    });
  };
}

const none = () => {};
const all = (fn) => ({ S: fn, E: fn, N: fn });

/** Sổ đăng ký: loại tai → { S, E, N }. */
export const EARS = {
  none: all(none),
  round: all(roundEars),
  cat: all((ctx) => catEars(ctx)),
  bunny: all(bunnyEars),
};

/**
 * Loại tai chưa vẽ lại theo bản mẫu → HÌNH TẠM (để loài vẫn nhận ra được). Họa sĩ vẽ xong loại nào thì thêm vào EARS và xóa khỏi đây.
 * fox: tai mèo to hơn; tuft (cú): tai mèo nhỏ; mouse: tai tròn to; floppy (cún, heo): tai cụp rủ hai bên;
 * horns, antler, fin, crest: bản đồ ký tự của rig.js cũ (màu sừng 'wheat', gạc 'tan', vây/mào màu điểm nhấn).
 */
export const FALLBACK = {
  fox: all((ctx) => catEars(ctx, 1.15)),
  tuft: all((ctx) => catEars(ctx, 0.7)),
  mouse: all((ctx) => roundEars({ ...ctx, sk: { ...ctx.sk, hk: ctx.sk.hk * 1.35 } })),
  floppy: all(legacyEars('floppy')),
  horns: all(legacyEars('horns')),
  antler: all(legacyEars('antler')),
  crest: all(legacyEars('crest')),
  fin: all(legacyEars('fin')),
};

/** Mục vẽ cho loại tai `kind` (không bao giờ undefined). */
export const earsFor = (kind) => EARS[kind] ?? FALLBACK[kind] ?? EARS.none;
