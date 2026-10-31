// Hoa văn lông: sổ đăng ký theo `pattern` của loài (belly, spots, stripes, mask, patch, scales, shell). Chủ sở hữu: họa sĩ hoa văn.
// Mỗi mục { S, E, N } nhận ctx; thêm bộ phận tô bóng (ctx.parts) hoặc điểm (ctx.pixels, z 16).
// Bụng màu sáng do dáng khung (archetypes/*) vẽ sẵn cho mọi loài; ở đây chỉ thêm phần riêng của hoa văn.
//  - belly: vằn trán mèo (loài tai mèo), port nguyên từ pets-pilot (khớp từng điểm ảnh).
//  - spots, stripes, mask, patch, scales, shell: Rig 2.0 (họa sĩ G), vẽ lại hết, ĐÃ XONG:
//    spots   đốm theo loài: đốm hươu hai hàng dọc lưng, đốm rải (cá nóc, nhím), mảng đá (tê giác), mảng lớn cá chép
//            (kohaku, đốm đỏ trên đỉnh đầu như tancho), đốm đen kỳ nhông;
//    stripes vằn hổ đậm: vạch nhọn từ sống lưng xuống hông, chữ V trên lưng, ba vạch trán, vạch má;
//    mask    mặt nạ quanh mắt: sói (mặt nạ sẫm + mũi tên trán + yên lưng), gấu mèo đỏ (mảng trắng mày và má),
//            lân (mày đỏ rậm + má đỏ);
//    patch   gấu trúc: giữ nhận diện của bản sửa sau soát (hai mảng mắt to nghiêng ra ngoài, tai và tay chân đen), mảng
//            nay hình giọt nước rủ xuống má, thêm đai đen vắt qua vai (nhìn sau, nhìn ngang) nối hai tay;
//    scales  vảy lợp: tấm vảy so le, hàng trên đè hàng dưới nên mỗi tấm có một nét cong ở mép dưới (nét trong chọn
//            lọc của colourise); tê tê có thêm vảy trên đầu; rồng có thêm khoanh bụng (vảy bụng);
//    shell   mai rùa thật: mai vòm phủ lên lưng khi nhìn ngang, bầu dục khi nhìn sau, chia tấm bằng Voronoi (hàng tấm
//            sống lưng, tấm sườn, viền tấm rìa), mỗi đường chia 1 điểm ảnh bậc tối của dải mai.
// Cách dùng chung: hoa văn trên thân là bộ phận z 4.2 (nhóm riêng hoặc 'body'), cắt theo mặt nạ thân THẬT trong ctx.parts
// (bộ phận tên 'body', trừ bụng 'belly'), nên dáng khung nào cũng khớp (round, serpent vẽ lại vẫn chạy); hoa văn trên đầu
// là bộ phận z = ctx.zh + 0.15 cắt theo ctx.headMask, trừ các mảng mặt (z = ctx.zh + 0.1: mõm, mặt nạ mỏ...).
// Tinh chỉnh theo loài: TUNE bên dưới.
import { RAMPS, mAbove, mAnd, mAndNot, mAny, mBelow, mEllipse, mOr, mStamp, mTri, newMask, part, pyRound } from '../core.js';

const none = () => {};

/** Vằn trán của loài tai mèo: hai vạch 3 điểm, bậc tối của dải thân. */
function tabby(ctx) {
  const { sp, sk, view } = ctx;
  if (sp.ears !== 'cat' || view === 'N') return;
  const lc = RAMPS[ctx.ramps.main][1];
  const [hcx] = sk.head;
  const ty = pyRound(sk.htop) + 2;
  const xs = view === 'S' ? [pyRound(hcx) - 3, pyRound(hcx) + 2] : [pyRound(hcx) - 2, pyRound(hcx) + 1];
  for (const x of xs) ctx.pixels.push([x, ty, lc, 16], [x, ty + 1, lc, 16], [x, ty + 2, lc, 16]);
}

// ================================================================ mặt nạ dùng chung

const NPX = 48 * 48;
/** Hợp các mặt nạ của bộ phận thỏa `pred` (đã có trong ctx.parts lúc hoa văn chạy: đuôi, tai, thân, đầu, mặt). */
function partsMask(ctx, pred) {
  const m = newMask();
  for (const p of ctx.parts) if (pred(p)) for (let k = 0; k < NPX; k++) m[k] |= p.mask[k];
  return m;
}
/** Thân thật (bộ phận 'body'); dáng khung lạ không có thì dùng elip của bộ xương. */
function bodyMask(ctx) {
  const m = partsMask(ctx, (p) => p.name === 'body');
  if (mAny(m)) return m;
  const [bcx, bcy, brx, bry] = ctx.sk.body;
  return mEllipse(bcx, bcy, brx, bry);
}
const bellyMask = (ctx) => partsMask(ctx, (p) => p.name === 'belly');
/** Các mảng mặt (mõm, mặt nạ mỏ, má...): z = zh + 0.1 theo hợp đồng của parts/faces.js. */
const faceMask = (ctx) => partsMask(ctx, (p) => Math.abs(p.z - (ctx.zh + 0.1)) < 1e-6);
/** Vùng thân để vẽ hoa văn: thân trừ bụng. */
const backMask = (ctx) => mAndNot(bodyMask(ctx), bellyMask(ctx));
/** Vùng đầu để vẽ hoa văn: đầu trừ mảng mặt. */
const headArea = (ctx) => (ctx.headMask ? mAndNot(ctx.headMask, faceMask(ctx)) : newMask());

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Cỡ hoa văn theo giai đoạn (theo thân): sơ sinh ~0.7, trưởng thành 1. */
const patSize = (sk) => clamp(0.45 + 0.5 * sk.bk, 0.68, 1.05);
/** Khối sáng của thân (giống archetype), để hoa văn tô sáng liền với lông. */
const bodyNrm = (sk) => {
  const [bcx, bcy, brx, bry] = sk.body;
  return [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
};
const rampOf = (ctx, role) => ctx.ramps[role] ?? role;

/** Mảng hoa văn trên thân (z 4.2, không kẻ nét trong). */
function onBody(ctx, name, m, ramp, opts = {}) {
  if (!mAny(m)) return;
  ctx.parts.push(part(name, m, ramp, 4.2, { group: 'body', normal: bodyNrm(ctx.sk), line: false, ...opts }));
}
/** Mảng hoa văn trên đầu (z zh + 0.15, nhóm 'head', không kẻ nét trong). */
function onHead(ctx, name, m, ramp, opts = {}) {
  const mm = mAnd(headArea(ctx), m);
  if (!mAny(mm)) return;
  ctx.parts.push(part(name, mm, ramp, ctx.zh + 0.15, { group: 'head', normal: ctx.hnrm, line: false, ...opts }));
}
/** Vạch nhọn (nêm): đáy rộng `w` vuông góc với hướng a→b, mũi nhọn ở b. */
function wedge([ax, ay], [bx, by], w) {
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const [nx, ny] = [(-(by - ay) / d) * w * 0.5, ((bx - ax) / d) * w * 0.5];
  return mTri([ax + nx, ay + ny], [ax - nx, ay - ny], [bx, by]);
}
/** Vạch cong nhọn: hai nêm nối nhau qua điểm giữa m (đáy rộng w, giữa rộng w*0.7). */
function curvedWedge(a, mid, b, w) {
  const d = Math.hypot(mid[0] - a[0], mid[1] - a[1]) || 1;
  const [nx, ny] = [(-(mid[1] - a[1]) / d) * w * 0.5, ((mid[0] - a[0]) / d) * w * 0.5];
  const half = mTri([a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [mid[0] + nx * 0.7, mid[1] + ny * 0.7]);
  const half2 = mTri([a[0] - nx, a[1] - ny], [mid[0] + nx * 0.7, mid[1] + ny * 0.7], [mid[0] - nx * 0.7, mid[1] - ny * 0.7]);
  return mOr(half, half2, wedge(mid, b, w * 0.7));
}

// ================================================================ spots: đốm

/** Đốm vẽ tay (bản đồ ký tự, tâm ở giữa): đốm tròn nhỏ, đốm vừa, mảng méo (hai biến thể, lật theo `seed`). */
const SPOT_STAMPS = {
  dot: [['##', '##']],
  spot: [['.##.', '####', '.##.'], ['##', '##']],
  blotch: [['.###.', '#####', '.##..'], ['.##', '###', '.#.']],
};
/** Hình một đốm tại (x, y): dot 2×2, spot 4×3 bo góc, blotch mảng méo, big mảng lớn (cá chép) dựng từ 3 elip. */
function spotShape(x, y, size, k, seed) {
  if (size !== 'big') {
    const set = SPOT_STAMPS[size] ?? SPOT_STAMPS.spot;
    const rows = k < 0.86 && set[1] ? set[1] : set[0];
    const w = rows[0].length;
    const h = rows.length;
    return mStamp(rows, '#', Math.round(x - w / 2), Math.round(y - h / 2), seed % 2 === 1);
  }
  const r = Math.max(1.4, 2.0 * k);
  const off = seed % 2 ? 1 : -1;
  return mOr(mEllipse(x, y, r * 1.2, r * 0.9), mEllipse(x + off * r * 0.9, y + r * 0.45, r * 0.8, r * 0.7), mEllipse(x - off * r * 0.6, y - r * 0.55, r * 0.7, r * 0.6));
}
/** Bố cục đốm [u, v] theo khối thân (u: −1 trái … 1 phải theo bán trục ngang, v: −1 trên … 1 dưới), mỗi hướng nhìn. */
const SPOT_LAYOUT = {
  // hươu: hai hàng đốm dọc sống lưng
  fawn: {
    E: [[-0.62, -0.62], [-0.24, -0.72], [0.14, -0.66], [0.5, -0.52], [-0.44, -0.22], [-0.05, -0.3], [0.32, -0.2]],
    S: [[-0.74, -0.25], [0.74, -0.25], [-0.68, 0.3], [0.68, 0.3]],
    N: [[-0.3, -0.62], [0.3, -0.62], [-0.62, -0.2], [0.62, -0.2], [-0.24, 0.12], [0.24, 0.12], [0, -0.32]],
    head: null,
  },
  // rải đều: cá nóc, nhím rêu, kỳ nhông
  scatter: {
    E: [[-0.62, -0.5], [-0.12, -0.72], [0.36, -0.48], [-0.34, -0.06], [0.12, -0.18], [0.6, -0.05]],
    S: [[-0.72, -0.22], [0.72, -0.22], [-0.62, 0.32], [0.62, 0.32]],
    N: [[-0.42, -0.5], [0.42, -0.5], [0, -0.68], [-0.62, 0.08], [0.62, 0.08], [-0.2, 0.18], [0.24, -0.16]],
    head: { S: [[-0.5, -0.66], [0.42, -0.74], [0.05, -0.85]], E: [[-0.42, -0.7], [0.12, -0.82]], N: [[-0.35, -0.55], [0.4, -0.4], [0, -0.1]] },
  },
  // mảng đá: tê giác
  rock: {
    E: [[-0.55, -0.42], [0.15, -0.58], [-0.12, 0.05]],
    S: [[-0.7, 0.0], [0.68, -0.2]],
    N: [[-0.4, -0.42], [0.45, -0.18], [-0.05, 0.25]],
    head: { S: [[-0.55, -0.6]], E: [[-0.35, -0.62]], N: [[0.3, -0.5]] },
  },
  // cá chép kohaku: hai mảng đỏ lớn + đốm tròn đỏ trên đỉnh đầu (tancho)
  koi: {
    E: [[-0.42, -0.42], [0.36, -0.32]],
    S: [[0.62, -0.22], [-0.66, 0.28]],
    N: [[-0.32, -0.42], [0.38, 0.05]],
    head: { S: [[0.34, -0.6], [-0.5, -0.66]], E: [[-0.42, -0.55]], N: [[0.2, -0.4], [-0.42, 0.15]] },
  },
};

function spots(ctx) {
  const t = TUNE[ctx.sp.id]?.spots ?? { layout: 'scatter', size: 'spot' };
  const L = SPOT_LAYOUT[t.layout] ?? SPOT_LAYOUT.scatter;
  const { sk, view } = ctx;
  const k = patSize(sk);
  const [bcx, bcy, brx, bry] = sk.body;
  const ramp = rampOf(ctx, t.ramp ?? 'accent');
  const ms = (L[view] ?? []).map(([u, v], i) => spotShape(bcx + u * brx, bcy + v * bry, t.size, k, i));
  const look = { ...(t.flat ? { flat: t.flat } : {}), ...(t.shade ? { shade: t.shade } : {}) };
  if (ms.length) onBody(ctx, 'spots', mAnd(backMask(ctx), mOr(...ms)), ramp, look);
  const hs = L.head?.[view];
  if (hs) {
    const [hcx, hcy, hrx, hry] = sk.head;
    const hsize = t.headSize ?? (t.size === 'big' ? 'blotch' : t.size === 'blotch' ? 'spot' : t.size);
    onHead(ctx, 'headspots', mOr(...hs.map(([u, v], i) => spotShape(hcx + u * hrx, hcy + v * hry, hsize, k, i + 1))), ramp, look);
  }
}

// ================================================================ stripes: vằn hổ

function stripes(ctx) {
  const t = TUNE[ctx.sp.id]?.stripes ?? {};
  const { sk, view } = ctx;
  const k = patSize(sk);
  const [bcx, bcy, brx, bry] = sk.body;
  const [hcx, hcy, hrx, hry] = sk.head;
  const ramp = rampOf(ctx, t.ramp ?? 'accent');
  const w = Math.max(1.6, 2.3 * k);
  const top = bcy - bry;
  const ms = [];
  if (view === 'E') {
    // vạch nhọn từ sống lưng xuống hông, hơi chéo ra sau; vạch vai ngắn hơn
    for (const [u, len] of [[-0.78, 0.95], [-0.48, 1.1], [-0.17, 1.15], [0.14, 1.05], [0.44, 0.75]]) {
      const x = bcx + u * brx;
      ms.push(curvedWedge([x + 0.3, top - 0.6], [x - 0.3, top + bry * 0.55 * len], [x - 1.1, top + bry * 1.05 * len], w));
    }
  } else if (view === 'S') {
    // hai bên hông: nêm ngang từ mép thân chỉ vào trong
    for (const s of [-1, 1]) {
      for (const v of [-0.35, 0.2]) {
        const y = bcy + v * bry;
        ms.push(wedge([bcx + s * (brx + 0.6), y - 0.4], [bcx + s * brx * 0.38, y + 0.6], w * 0.9));
      }
    }
  } else {
    // nhìn sau: chữ V qua sống lưng, ba vạch
    for (const v of [-0.62, -0.18, 0.26]) {
      const y = bcy + v * bry;
      for (const s of [-1, 1]) ms.push(curvedWedge([bcx + 0.5 * s, y + 0.9], [bcx + s * brx * 0.5, y - 0.1], [bcx + s * (brx + 0.6), y - 0.6], w));
    }
  }
  onBody(ctx, 'stripes', mAnd(backMask(ctx), mOr(...ms)), ramp);
  // đầu
  const hs = [];
  const hw = Math.max(1.3, 1.8 * k);
  const ht = sk.htop;
  if (view === 'S') {
    // ba vạch trán (giữa dài hơn) + hai vạch má mỗi bên
    hs.push(wedge([hcx, ht - 0.5], [hcx, ht + 4.6 * k], hw * 1.15));
    for (const s of [-1, 1]) {
      hs.push(wedge([hcx + s * 2.9 * k, ht], [hcx + s * 2.4 * k, ht + 3.2 * k], hw));
      for (const dy of [0.4, 2.4]) hs.push(wedge([hcx + s * (hrx + 0.5), sk.eyeY + dy - 0.3], [hcx + s * (hrx - 3.6 * k), sk.eyeY + dy + 0.5], hw));
    }
  } else if (view === 'E') {
    // vạch trán chéo, hai vạch má từ sau gáy chỉ về mắt
    for (const dx of [-2.6, 0.2, 2.8]) hs.push(wedge([hcx + dx * k - 0.6, ht - 0.5], [hcx + dx * k + 0.2, ht + 3.4 * k], hw));
    for (const dy of [0.2, 2.4]) hs.push(wedge([hcx - hrx - 0.5, sk.eyeY + dy - 0.6], [hcx - hrx * 0.25, sk.eyeY + dy + 0.4], hw));
  } else {
    // gáy: ba cặp vạch từ hai bên vào giữa, vạch trên cùng ngang đỉnh đầu
    for (const v of [-0.6, -0.15, 0.3]) {
      const y = hcy + v * hry;
      for (const s of [-1, 1]) hs.push(wedge([hcx + s * (hrx + 0.6), y - 0.5], [hcx + s * hrx * 0.28, y + 0.7], hw));
    }
    hs.push(wedge([hcx, ht - 0.5], [hcx, ht + 3.4 * k], hw * 1.1));
  }
  onHead(ctx, 'headstripes', mOr(...hs), ramp, { shade: -1 });
}

// ================================================================ mask: mặt nạ quanh mắt

/** Elip quanh mắt: hai bên khi nhìn trước, mắt gần khi nhìn ngang. f(x, s) → mặt nạ; s = −1 trái, 1 phải (S), 1 (E). */
function perEye(ctx, f) {
  const { sk, view } = ctx;
  const [hcx] = sk.head;
  return view === 'S' ? mOr(f(hcx - sk.eyeDx, -1), f(hcx + sk.eyeDx, 1)) : f(sk.anchors.face[0], 1);
}

/**
 * Sói (kiểu husky): mũ lông sẫm trùm đỉnh đầu xuống tới trên mắt, mũi tên sẫm chĩa xuống giữa hai mắt, hai chấm mày sáng;
 * quanh mắt và mõm giữ màu lông sáng (không thành mặt nạ gấu mèo). Nhìn sau: gáy sẫm; thân: yên lưng sẫm.
 */
function wolfMask(ctx, ramp) {
  const { sk, view } = ctx;
  const k = patSize(sk);
  const [hcx, hcy, hrx, hry] = sk.head;
  const { eyeY } = sk;
  if (view === 'N') {
    onHead(ctx, 'mask', mAnd(mEllipse(hcx, sk.htop + hry * 0.6, hrx * 0.78, hry * 0.72), mAbove(hcy + hry * 0.2)), ramp, { shade: -1 });
  } else {
    const capY = eyeY - 2.2 * k - 0.4; // mép dưới của mũ lông
    let cap = mAbove(capY);
    const brow = perEye(ctx, (x, s) => mEllipse(x + s * 0.2, capY - 0.6, 1.2 * k + 0.15, 0.85 * k + 0.1));
    cap = mAndNot(cap, brow);
    const peak = view === 'S' ? mTri([hcx - 1.8 * k, capY - 0.5], [hcx + 1.8 * k, capY - 0.5], [hcx, eyeY + 0.6]) : mTri([hcx + hrx * 0.1, capY - 0.5], [hcx + hrx * 0.45, capY - 0.5], [hcx + hrx * 0.28, eyeY + 0.2]);
    // nhìn ngang: mũ trùm cả nửa sau của đầu xuống tới tai và gáy
    const back = view === 'E' ? mAnd(mEllipse(hcx - hrx * 0.55, hcy - hry * 0.1, hrx * 0.55, hry * 0.8), mAbove(eyeY + 1.0)) : newMask();
    onHead(ctx, 'mask', mOr(cap, peak, back), ramp, { shade: -1 });
  }
  // yên lưng sẫm (nhìn ngang, nhìn sau)
  const [bcx, bcy, brx, bry] = sk.body;
  if (view === 'E') onBody(ctx, 'saddle', mAnd(backMask(ctx), mEllipse(bcx - brx * 0.1, bcy - bry * 0.7, brx * 0.72, bry * 0.55)), ramp, { shade: -1 });
  if (view === 'N') onBody(ctx, 'saddle', mAnd(backMask(ctx), mEllipse(bcx, bcy - bry * 0.55, brx * 0.7, bry * 0.5)), ramp, { shade: -1 });
}

/** Gấu mèo đỏ: mảng trắng trên mày và hai má (mặt gấu mèo đỏ), mõm giữ nguyên của parts/faces.js. */
function redPandaMask(ctx, ramp) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const k = patSize(sk);
  const { eyeY } = sk;
  const brows = perEye(ctx, (x, s) => mEllipse(x + s * 0.3, eyeY - 2.7 * k - 0.2, 1.5 * k + 0.2, 0.95 * k + 0.1, s * 0.25));
  const cheeks = perEye(ctx, (x, s) => mEllipse(x + s * (view === 'S' ? 1.8 : -0.6) * k, eyeY + 2.8 * k, 2.2 * k + 0.2, 1.7 * k + 0.2, -s * 0.3));
  onHead(ctx, 'mask', mOr(brows, cheeks), ramp);
}

/** Lân: mày đỏ rậm (dày, cong lên ở đuôi mày) và má đỏ tròn, như đầu lân múa. Nhìn sau: không có (gáy trơn). */
function lionMask(ctx, ramp) {
  const { sk, view } = ctx;
  const k = patSize(sk);
  const [hcx, hcy, hrx, hry] = sk.head;
  const { eyeY } = sk;
  if (view === 'N') return;
  void hcx;
  void hcy;
  void hrx;
  void hry;
  const brows = perEye(ctx, (x, s) => mOr(mEllipse(x, eyeY - 2.6 * k, 2.1 * k + 0.3, 0.95 * k + 0.2, -s * 0.28), mEllipse(x + s * 1.6 * k, eyeY - 3.3 * k, 1.0 * k + 0.2, 0.8 * k + 0.2)));
  const cheeks = perEye(ctx, (x, s) => mEllipse(x + s * (view === 'S' ? 1.4 : -0.9) * k, eyeY + 2.6 * k, 1.5 * k + 0.2, 1.2 * k + 0.2));
  onHead(ctx, 'mask', mOr(brows, cheeks), ramp);
}

function mask(ctx) {
  const t = TUNE[ctx.sp.id]?.mask ?? { kind: 'wolf' };
  const ramp = rampOf(ctx, t.ramp ?? 'accent');
  if (t.kind === 'redpanda') redPandaMask(ctx, ramp);
  else if (t.kind === 'lion') lionMask(ctx, ramp);
  else wolfMask(ctx, ramp);
}

// ================================================================ patch: gấu trúc

/**
 * Hai mảng mắt hình giọt nước: elip to nghiêng ra ngoài + thùy rủ xuống má, màu điểm nhấn bậc 1 cố định (flat, như bản
 * sửa sau soát: tối như tai và tay chân, không trùng màu viền); mắt và đốm sáng của mắt nằm trên mảng.
 * Thân: đai đen vắt qua vai nối hai tay (nhìn sau: ngang lưng trên; nhìn ngang: dải dọc trên vai), dải tô bóng như tay chân.
 */
function pandaPatches(ctx) {
  const { sk, view } = ctx;
  const ramp = ctx.ramps.accent;
  const [bcx, bcy, brx, bry] = sk.body;
  if (view !== 'N') {
    const { eyeY } = sk;
    const [rx, ry] = sk.big ? [2.9, 3.4] : [2.7, 3.1];
    const drop = (x, s) => mOr(mEllipse(x + s * 0.2, eyeY + 0.3, rx, ry, -s * 0.45), mEllipse(x + s * 1.3, eyeY + 2.4, rx * 0.62, ry * 0.55, -s * 0.6));
    const m = perEye(ctx, drop);
    ctx.parts.push(part('patch', mAnd(ctx.headMask, mAndNot(m, faceMask(ctx))), ramp, ctx.zh + 0.15, { group: 'head', flat: 1, line: false }));
  }
  const back = backMask(ctx);
  // đai vai nằm ngay dưới cằm/gáy (đầu chibi che gần hết vai)
  const [, hcy, , hry] = sk.head;
  const y = Math.max(bcy - bry + 0.6, hcy + hry - 0.4);
  if (view === 'N') onBody(ctx, 'shoulders', mAnd(back, mEllipse(bcx, y + 0.6, brx + 1.0, Math.max(1.6, bry * 0.42))), ramp, { group: 'limbband', line: true });
  if (view === 'E') onBody(ctx, 'shoulders', mAnd(back, mEllipse(bcx + brx * 0.1, y + 1.0, brx * 0.45, Math.max(1.8, bry * 0.55), 0.3)), ramp, { group: 'limbband', line: true });
}

// ================================================================ scales: vảy lợp

/**
 * Hàng vảy lợp so le phủ `region`: tấm = elip tròn (rộng pw, hàng cách ph); hàng trên đè hàng dưới (z cao hơn) nên mép dưới
 * của mỗi hàng là một đường cong lượn sóng ⌣⌣⌣ (nét bậc 0 của dải vảy, colourise tự kẻ). Trong một hàng các tấm cùng
 * nhóm (không kẻ nét dọc: tránh trông như tường gạch). `keep(cx, cy)`: chỉ giữ tấm có tâm thỏa điều kiện, nên mép vùng vảy
 * cũng lượn theo tấm thay vì một đường thẳng.
 */
function platesOn(ctx, region, { pw, ph, ramp, z, prefix, normal, keep = () => true }) {
  let [x0, y0, x1, y1] = [48, 48, -1, -1];
  for (let k = 0; k < NPX; k++) {
    if (!region[k]) continue;
    const x = k % 48;
    const y = (k - x) / 48;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return;
  const rows = Math.ceil((y1 - y0 + 1) / ph) + 1;
  const rx = pw * 0.56;
  const ry = ph * 0.9 + 0.35;
  for (let r = 0; r < rows; r++) {
    const cy = y0 + r * ph;
    const off = r % 2 ? pw / 2 : 0;
    const ms = [];
    for (let cx = x0 - pw + off; cx <= x1 + pw; cx += pw) if (keep(cx + 0.5, cy + 0.5)) ms.push(mEllipse(cx + 0.5, cy + 0.5, rx, ry));
    const m = ms.length ? mAnd(region, mOr(...ms)) : null;
    if (m && mAny(m)) ctx.parts.push(part(`${prefix}${r}`, m, ramp, z + (rows - r) * 0.002, { normal }));
  }
}

/** Khoanh bụng (vảy bụng rồng): dải ngang (S) hoặc dọc (E) trên phần bụng, mỗi dải có nét chia. */
function bellyBands(ctx) {
  const { sk, view } = ctx;
  const belly = bellyMask(ctx);
  if (!mAny(belly) || view === 'N') return;
  const k = patSize(sk);
  const step = Math.max(2, Math.round(2.6 * k));
  const [bcx, bcy] = sk.body;
  const nrm = bodyNrm(sk);
  let i = 0;
  for (let d = -12; d <= 12; d += step) {
    const band = view === 'S' ? mAnd(mBelow(bcy + d - 0.01), mAbove(bcy + d + step)) : mAnd(mBelow(-1), mAnd(rightOf(bcx + d), leftOf(bcx + d + step)));
    const m = mAnd(belly, band);
    if (!mAny(m)) continue;
    ctx.parts.push(part(`bellyband${i}`, m, ctx.ramps.belly, 4.15 + (view === 'S' ? i : -i) * 0.001, { normal: nrm }));
    i++;
  }
}
function rightOf(x) {
  const m = newMask();
  for (let k = 0; k < NPX; k++) if ((k % 48) + 0.5 > x) m[k] = 1;
  return m;
}
function leftOf(x) {
  const m = newMask();
  for (let k = 0; k < NPX; k++) if ((k % 48) + 0.5 < x) m[k] = 1;
  return m;
}

function scales(ctx) {
  const t = TUNE[ctx.sp.id]?.scales ?? {};
  const { sk, view } = ctx;
  const k = patSize(sk);
  const ramp = rampOf(ctx, t.ramp ?? 'main');
  const pw = Math.max(4, Math.round(4.6 * k));
  const ph = Math.max(2, Math.round(3.0 * k));
  // thân: vảy trên lưng và hông (trừ bụng); rồng chừa một dải sống lưng cho gai/bờm của dáng khung
  platesOn(ctx, backMask(ctx), { pw, ph, ramp, z: 4.2, prefix: 'scale', normal: bodyNrm(sk) });
  if (t.belly) bellyBands(ctx);
  // đầu (tê tê): mũ vảy trên đỉnh và gáy, mép dưới lượn theo tấm vảy; chừa mắt và mặt
  if (t.head && ctx.headMask) {
    const [, hcy, , hry] = sk.head;
    const hpw = Math.max(4, Math.round(5.0 * k));
    const hph = Math.max(3, Math.round(3.2 * k));
    const lim = view === 'S' ? sk.eyeY - 2.6 * k - 0.6 : view === 'E' ? sk.eyeY - 2.0 : hcy + hry * 0.5;
    const fx = sk.anchors.face[0];
    const keep = view === 'E' ? (cx, cy) => cy < lim && cx < fx - 0.5 : (cx, cy) => cy < lim;
    platesOn(ctx, headArea(ctx), { pw: hpw, ph: hph, ramp, z: ctx.zh + 0.15, prefix: 'headscale', normal: ctx.hnrm, keep });
  }
}

// ================================================================ shell: mai rùa

/**
 * Chia `region` thành tấm theo hạt giống gần nhất (Voronoi, khoảng cách co theo sx, sy): tấm mai lục giác tự nhiên.
 * Mỗi tấm một nhóm, z tăng dần, nên mỗi đường chia đúng 1 điểm ảnh (bậc 0 của dải mai, ở tấm đứng trước).
 */
function voronoiPlates(ctx, region, seeds, { ramp, z, prefix, normal, sx = 1, sy = 1 }) {
  const cells = seeds.map(() => newMask());
  for (let k = 0; k < NPX; k++) {
    if (!region[k]) continue;
    const x = (k % 48) + 0.5;
    const y = Math.floor(k / 48) + 0.5;
    let best = 0;
    let d0 = Infinity;
    seeds.forEach(([sxp, syp, w = 1], i) => {
      const d = (((x - sxp) / sx) ** 2 + ((y - syp) / sy) ** 2) / (w * w);
      if (d < d0) {
        d0 = d;
        best = i;
      }
    });
    cells[best][k] = 1;
  }
  cells.forEach((m, i) => {
    if (mAny(m)) ctx.parts.push(part(`${prefix}${i}`, m, ramp, z + i * 0.001, { normal }));
  });
}

function shell(ctx) {
  const { sk, view } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const ramp = rampOf(ctx, TUNE[ctx.sp.id]?.shell?.ramp ?? 'accent');
  const k = patSize(sk);
  if (view === 'E') {
    // vòm mai phủ lưng: elip cắt phẳng ở mép dưới (viền mai), che nửa trên của thân; chân (z 5) và đầu (z 8) ở trước
    const cx = bcx - 0.4;
    const rx = brx + 1.0;
    const ry = bry + 2.4 * k;
    const cy = bcy + bry * 0.25;
    const rim = bcy + bry * 0.42;
    const top = cy - ry;
    const dome = mAnd(mEllipse(cx, cy, rx, ry), mAbove(rim));
    const h = rim - top;
    const seeds = [];
    // tấm sống lưng (3), tấm sườn (4), tấm rìa (một hàng mỏng sát mép dưới)
    for (const u of [-0.42, 0, 0.42]) seeds.push([cx + u * rx, top + h * 0.2, 1]);
    for (const u of [-0.66, -0.22, 0.22, 0.66]) seeds.push([cx + u * rx, top + h * 0.56, 1]);
    const nRim = Math.max(5, Math.round((rx * 2) / 3.2));
    for (let i = 0; i < nRim; i++) seeds.push([cx - rx + ((i + 0.5) * 2 * rx) / nRim, rim - 0.6, 0.55]);
    voronoiPlates(ctx, dome, seeds, { ramp, z: 4.2, prefix: 'shell', normal: [cx - 1.5, top + h * 0.35, rx + 1.5, h + 1.5], sx: 1, sy: 0.75 });
    return;
  }
  if (view === 'N') {
    // nhìn sau: bầu dục mai phủ cả lưng; cột tấm sống lưng, hai cột tấm sườn, vòng tấm rìa
    const cx = bcx;
    const cy = bcy - 0.6;
    const rx = brx + 1.6;
    const ry = Math.min(bry + 2.2 * k, sk.ground - 1.2 - cy);
    const oval = mEllipse(cx, cy, rx, ry);
    const seeds = [];
    for (const v of [-0.5, 0, 0.5]) seeds.push([cx, cy + v * ry, 1]);
    for (const s of [-1, 1]) for (const v of [-0.3, 0.32]) seeds.push([cx + s * 0.56 * rx, cy + v * ry, 1]);
    const nRim = 12;
    for (let i = 0; i < nRim; i++) {
      const a = ((i + 0.5) / nRim) * Math.PI * 2;
      seeds.push([cx + Math.cos(a) * rx * 0.95, cy + Math.sin(a) * ry * 0.95, 0.5]);
    }
    voronoiPlates(ctx, oval, seeds, { ramp, z: 4.5, prefix: 'shell', normal: [cx - 1.5, cy - 2.0, rx + 2.0, ry + 2.0] });
    return;
  }
  // nhìn trước: mai sau thân (z 3.9), chỉ lộ vành hai bên và trên vai; vành chia tấm rìa
  const cx = bcx;
  const cy = bcy - 1.0;
  const rx = brx + 2.2;
  const ry = bry + 2.0;
  const rimM = mEllipse(cx, cy, rx, ry);
  const seeds = [];
  const nRim = 10;
  for (let i = 0; i < nRim; i++) {
    const a = ((i + 0.5) / nRim) * Math.PI * 2;
    seeds.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1]);
  }
  voronoiPlates(ctx, rimM, seeds, { ramp, z: 3.9, prefix: 'shell', normal: [cx - 1, cy - 2.5, rx + 2.6, ry + 2.4] });
}

// ================================================================ tinh chỉnh theo loài
// spots: layout (fawn | scatter | rock | koi), size (dot | spot | blotch | big), ramp, flat, headSize.
// stripes: ramp. mask: kind (wolf | redpanda | lion), ramp. scales: head (vảy đầu), belly (khoanh bụng), ramp. shell: ramp.
const TUNE = {
  huou_pha_le: { spots: { layout: 'fawn', size: 'dot' } }, // hươu pha lê: đốm băng xanh nhỏ dọc lưng
  huou_reu: { spots: { layout: 'fawn', size: 'dot' } }, // hươu rêu: đốm rêu xanh nhỏ
  nhim_reu: { spots: { layout: 'scatter', size: 'spot' } }, // nhím rêu: mảng rêu trên lưng
  ca_noc: { spots: { layout: 'scatter', size: 'dot' } }, // cá nóc: chấm vàng
  ky_nhong: { spots: { layout: 'scatter', size: 'blotch', headSize: 'spot' } }, // kỳ nhông lửa: đốm đen méo
  te_giac_da: { spots: { layout: 'rock', size: 'blotch', shade: -1 } }, // tê giác đá: mảng đá sẫm (tối hơn một bậc: đá xám trên đá xám)
  ca_chep_rong: { spots: { layout: 'koi', size: 'big', headSize: 'big' } }, // cá chép rồng: mảng đỏ kohaku trên đầu và lưng
  bach_ho: { stripes: {} },
  soi_bac: { mask: { kind: 'wolf' } },
  gau_meo_do: { mask: { kind: 'redpanda' } },
  lan_con: { mask: { kind: 'lion' } },
  te_te: { scales: { head: true } }, // tê tê: vảy lợp cả đầu
  thanh_long: { scales: { belly: true } },
  rong_lua: { scales: { belly: true } },
  hoang_long: { scales: { belly: true } },
};

const all = (fn) => ({ S: fn, E: fn, N: fn });

/** Sổ đăng ký: loại hoa văn → { S, E, N }. */
export const PATTERNS = {
  belly: all(tabby),
  spots: all(spots),
  stripes: all(stripes),
  mask: all(mask),
  patch: all(pandaPatches),
  scales: all(scales),
  shell: all(shell),
};

/** Hoa văn chưa vẽ lại: đã vẽ xong cả 7 loại, để trống (pipeline và sheet vẫn đọc được). */
export const FALLBACK = {};

export const patternFor = (kind) => PATTERNS[kind] ?? FALLBACK[kind] ?? all(none);
