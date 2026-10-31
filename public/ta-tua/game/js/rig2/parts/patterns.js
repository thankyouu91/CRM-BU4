// Hoa văn lông: sổ đăng ký theo `pattern` của loài (belly, spots, stripes, mask, patch, scales, shell). Chủ sở hữu: họa sĩ hoa văn.
// Mỗi mục { S, E, N } nhận ctx; thêm bộ phận tô bóng (ctx.parts) hoặc điểm (ctx.pixels, z 16).
// Bụng màu sáng do dáng khung (archetypes/*) vẽ sẵn cho mọi loài; ở đây chỉ thêm phần riêng của hoa văn.
//  - belly: vằn trán mèo (loài tai mèo), port nguyên từ pets-pilot (khớp từng điểm ảnh).
//  - spots, stripes, mask, patch, scales, shell: Rig 2.0 (họa sĩ G), vẽ lại hết, ĐÃ XONG:
//    spots   đốm theo loài: đốm hươu hai hàng dọc lưng, đốm rải (cá nóc, nhím), mảng đá (tê giác), mảng lớn cá chép
//            (kohaku, đốm đỏ trên đỉnh đầu như tancho), đốm đen kỳ nhông; đốm đầu luôn cách viền đầu ≥ 1 điểm, nhìn sau
//            thì lệch khỏi trục giữa (không xếp thành mặt);
//    stripes vằn hổ đậm: vạch nhọn từ sống lưng xuống hông, chữ V liền qua sống lưng khi nhìn sau, ba vạch trán, vạch
//            má; gáy chỉ có vạch dọc từ đỉnh đầu (bé, nhí nhố: ba vạch);
//    mask    sói (dải mắt 2 điểm quét lên phía tai + mũi tên trán ▼ + yên lưng), gấu mèo đỏ (mảng trắng mày và má),
//            lân (mày đầu lân vểnh cao ở đuôi mày, đỏ bậc 1-2);
//    patch   gấu trúc: giữ nhận diện của bản sửa sau soát (hai mảng mắt to nghiêng ra ngoài, tai và tay chân đen), mảng
//            nay hình giọt nước rủ xuống má, thêm đai đen vắt qua vai (nhìn sau, nhìn ngang) nối hai tay;
//    scales  vảy lợp: chỉ nét mép dưới lượn sóng của từng hàng tấm lớn (≈ 6 × 4), tối hơn lông tại chỗ một bậc, không
//            có nét dọc; nhìn sau thưa hàng và chừa sống lưng; tê tê có thêm mũ vảy trên đầu; rồng có khoanh bụng,
//            khoanh vuông góc với trục dài của mảng bụng;
//    shell   mai rùa thật: mai vòm phủ lên lưng khi nhìn ngang, bầu dục khi nhìn sau, chia tấm bằng Voronoi (hàng tấm
//            sống lưng, tấm sườn, viền tấm rìa), mỗi đường chia 1 điểm ảnh bậc tối của dải mai.
// Cách dùng chung: hoa văn trên thân là bộ phận z 4.2 (nhóm riêng hoặc 'body'), cắt theo mặt nạ thân THẬT trong ctx.parts
// (bộ phận tên 'body', trừ bụng 'belly'), nên dáng khung nào cũng khớp (round, serpent vẽ lại vẫn chạy); hoa văn trên đầu
// là bộ phận z = ctx.zh + 0.15 cắt theo ctx.headMask, trừ các mảng mặt (z = ctx.zh + 0.1: mõm, mặt nạ mỏ...).
// Tinh chỉnh theo loài: TUNE bên dưới.
import { LIGHT, RAMPS, mAbove, mAnd, mAndNot, mAny, mChain, mEllipse, mOr, mStamp, mTri, newMask, part, pyRound } from '../core.js';

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
/** Co mặt nạ 1 điểm ảnh (4 hướng): hoa văn nằm trong đó luôn cách viền ngoài ít nhất 1 điểm màu lông. */
function inset(m) {
  const o = newMask();
  for (let y = 1; y < 47; y++) {
    for (let x = 1; x < 47; x++) {
      const k = y * 48 + x;
      if (m[k] && m[k - 1] && m[k + 1] && m[k - 48] && m[k + 48]) o[k] = 1;
    }
  }
  return o;
}
/** Dời mặt nạ nguyên điểm (dx, dy). */
function shift(m, dx, dy) {
  const o = newMask();
  for (let k = 0; k < NPX; k++) {
    if (!m[k]) continue;
    const x = (k % 48) + dx;
    const y = Math.floor(k / 48) + dy;
    if (x >= 0 && y >= 0 && x < 48 && y < 48) o[y * 48 + x] = 1;
  }
  return o;
}
/** Đẩy một đốm về phía (tx, ty) từng điểm một (tối đa `max`) tới khi nằm gọn trong `area`; còn lòi thì cắt theo `area`. */
function nudgeInside(m, area, [cx, cy], [tx, ty], max = 3) {
  const d = Math.hypot(tx - cx, ty - cy) || 1;
  const [ux, uy] = [(tx - cx) / d, (ty - cy) / d];
  let best = m;
  for (let i = 0; i <= max; i++) {
    const mm = i ? shift(m, Math.round(ux * i), Math.round(uy * i)) : m;
    best = mm;
    if (!mAny(mAndNot(mm, area))) break;
  }
  return mAnd(best, area);
}
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

/** Nét bút: chuỗi đĩa bán kính r nối liền qua các điểm (nội suy từng 0.5 điểm ảnh). */
function stroke(pts, r) {
  const q = [];
  for (let i = 0; i < pts.length; i++) {
    if (!i) {
      q.push(pts[0]);
      continue;
    }
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5));
    for (let j = 1; j <= n; j++) q.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
  }
  return mChain(q, r);
}

// ================================================================ spots: đốm

/** Đốm vẽ tay (bản đồ ký tự, tâm ở giữa): chấm 2×2, đốm vừa hơi xiên (không thành dấu cộng), mảng méo; lật theo `seed`. */
const SPOT_STAMPS = {
  dot: [['##', '##']],
  spot: [['.###', '####', '###.'], ['##', '##']],
  blotch: [['.###.', '#####', '.##..'], ['.##', '###', '.#.']],
};
/** Hình một đốm tại (x, y): dot 2×2, spot 4×3 xiên, blotch mảng méo, big mảng lớn (cá chép) dựng từ 3 elip. */
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
    // nhìn sau: đốm lệch khỏi trục giữa, một gần đỉnh đầu, một thấp ở gáy bên kia (không xếp thành "hai mắt + miệng")
    head: { S: [[-0.5, -0.62], [0.42, -0.7], [0.0, -0.84]], E: [[-0.42, -0.66], [0.12, -0.8]], N: [[-0.42, -0.6], [0.48, 0.42]] },
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
    head: { S: [[0.34, -0.6], [-0.5, -0.66]], E: [[-0.42, -0.55]], N: [[0.3, -0.5], [-0.45, 0.3]] },
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
  if (hs && ctx.headMask) {
    // đốm đầu nằm gọn trong đầu, cách viền ít nhất 1 điểm (không thành vết cắn vào bóng đầu), đẩy dần về tâm đầu
    const [hcx, hcy, hrx, hry] = sk.head;
    const hsize = t.headSize ?? (t.size === 'big' ? 'blotch' : t.size === 'blotch' ? 'spot' : t.size);
    const area = inset(headArea(ctx));
    const ms2 = hs.map(([u, v], i) => {
      const [x, y] = [hcx + u * hrx, hcy + v * hry];
      return nudgeInside(spotShape(x, y, hsize, k, i + 1), area, [x, y], [hcx, hcy]);
    });
    onHead(ctx, 'headspots', mOr(...ms2), ramp, look);
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
    // nhìn sau: chữ V LIỀN qua sống lưng (đỉnh V ở sống lưng chỉ xuống), hai cánh nhọn dần ra hông; bé: hai chữ V
    for (const v of sk.big ? [-0.4, 0.25] : [-0.6, -0.12, 0.36]) {
      const y = bcy + v * bry;
      for (const s of [-1, 1]) ms.push(curvedWedge([bcx, y + 1.1], [bcx + s * brx * 0.5, y - 0.1], [bcx + s * (brx + 0.6), y - 0.7], w));
      ms.push(mEllipse(bcx, y + 0.8, w * 0.55, w * 0.55));
    }
  }
  onBody(ctx, 'stripes', mAnd(backMask(ctx), mOr(...ms)), ramp);
  // đầu: cỡ theo đầu (bé con đầu to: vạch không bé tí theo thân)
  const hs = [];
  const kh = clamp(sk.hk * 1.1, 0.85, 1.05);
  const hw = Math.max(1.3, 1.8 * kh);
  const ht = sk.htop;
  if (view === 'S') {
    // ba vạch trán (giữa dài hơn) + hai vạch má mỗi bên
    hs.push(wedge([hcx, ht - 0.5], [hcx, ht + 4.6 * kh], hw * 1.15));
    for (const s of [-1, 1]) {
      hs.push(wedge([hcx + s * 2.9 * kh, ht], [hcx + s * 2.4 * kh, ht + 3.2 * kh], hw));
      for (const dy of [0.4, 2.4]) hs.push(wedge([hcx + s * (hrx + 0.5), sk.eyeY + dy - 0.3], [hcx + s * (hrx - 3.6 * kh), sk.eyeY + dy + 0.5], hw));
    }
  } else if (view === 'E') {
    // vạch trán chéo, hai vạch má từ sau gáy chỉ về mắt
    for (const dx of [-2.6, 0.2, 2.8]) hs.push(wedge([hcx + dx * kh - 0.6, ht - 0.5], [hcx + dx * kh + 0.2, ht + 3.4 * kh], hw));
    for (const dy of [0.2, 2.4]) hs.push(wedge([hcx - hrx - 0.5, sk.eyeY + dy - 0.6], [hcx - hrx * 0.25, sk.eyeY + dy + 0.4], hw));
  } else {
    // gáy: vạch DỌC từ đỉnh đầu chỉ xuống gáy (không vạch ngang hai bên: trông như ria và mắt nhắm); bé, nhí nhố: chỉ ba
    // vạch đỉnh đầu; lớn hơn: thêm hai nêm dọc hai bên đỉnh, chỉ xuống nửa trên gáy
    hs.push(wedge([hcx, ht - 0.5], [hcx, ht + (sk.big ? 3.0 : 4.2) * kh], hw * 1.15));
    for (const s of [-1, 1]) {
      hs.push(wedge([hcx + s * 2.8 * kh, ht - 0.2], [hcx + s * 2.3 * kh, ht + (sk.big ? 2.4 : 3.2) * kh], hw));
      if (!sk.big) hs.push(wedge([hcx + s * hrx * 0.64, hcy - hry * 0.7], [hcx + s * hrx * 0.5, hcy - hry * 0.15], hw));
    }
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
 * Sói: vệt mắt là dải 2 điểm (bậc 2 phẳng của dải điểm nhấn) từ đuôi mắt quét lên phía tai, cộng mũi tên trán chỉ xuống
 * sống mũi; hai vệt KHÔNG nối qua sống mũi (tránh thành mặt nạ gấu mèo). Nhìn ngang: vệt mắt gần quét lên-ra sau về
 * phía tai. Thân: yên lưng sẫm (nhìn sau: bầu dục cân giữa lưng; nhìn ngang: dải 2-3 điểm theo sống lưng từ vai tới mông).
 */
function wolfMask(ctx, ramp) {
  const { sk, view } = ctx;
  const k = clamp(sk.hk * 1.1, 0.85, 1.05); // theo cỡ đầu: bé con đầu to vẫn rõ mặt nạ
  const [hcx] = sk.head;
  const { eyeY } = sk;
  const ew = sk.big ? 1.5 : 1.0; // nửa bề ngang ô mắt
  const look = { flat: 2 };
  if (view !== 'N') {
    const streak = (x, s) => stroke([[x + s * (ew + 0.3), eyeY + 0.4], [x + s * (ew + 1.3 * k), eyeY - 0.7 * k], [x + s * (ew + 2.1 * k), eyeY - 2.0 * k], [x + s * (ew + 2.5 * k), eyeY - 3.3 * k]], 0.95);
    let m;
    if (view === 'S') {
      // mũi tên trán ▼: tam giác đáy trên rộng, mũi nhọn chỉ xuống sống mũi, khía chữ V ở đáy (không có cán: trông như chữ thập)
      const top = sk.htop + 2.2 * k;
      const arrow = mAndNot(mTri([hcx - 2.3 * k, top], [hcx + 2.3 * k, top], [hcx, eyeY - 1.2]), mTri([hcx - 1.0 * k, top - 0.5], [hcx + 1.0 * k, top - 0.5], [hcx, top + 1.3 * k]));
      m = mOr(streak(hcx - sk.eyeDx, -1), streak(hcx + sk.eyeDx, 1), arrow);
    } else {
      m = streak(sk.anchors.face[0], -1);
    }
    onHead(ctx, 'mask', m, ramp, look);
  }
  const [bcx, bcy, brx, bry] = sk.body;
  const back = backMask(ctx);
  if (view === 'N') {
    onBody(ctx, 'saddle', mAnd(back, mEllipse(bcx, bcy - bry * 0.15, brx * 0.55, bry * 0.62)), ramp, look);
  } else if (view === 'E') {
    // dải dọc sống lưng: 2-3 điểm dưới mép trên của thân, từ vai (sau đầu) tới mông
    const band = newMask();
    const th = Math.max(2, Math.round(2.6 * k));
    for (let x = Math.floor(bcx - brx * 0.92); x <= Math.ceil(bcx + brx * 0.55); x++) {
      let y = 0;
      while (y < 48 && !back[y * 48 + x]) y++;
      for (let j = 0; j < th && y + j < 48; j++) if (back[(y + j) * 48 + x]) band[(y + j) * 48 + x] = 1;
    }
    onBody(ctx, 'saddle', band, ramp, look);
  }
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

/**
 * Lân: mày đầu lân múa: vòng cung dày 2 điểm vểnh cao ở đuôi mày (phía ngoài), đỏ bậc 1-2 của dải điểm nhấn (tô bóng lùi
 * một bậc: không ngả hồng); không còn mảng má đỏ (trông như phấn trang điểm, má đã có má hồng chung). Nhìn sau: gáy trơn.
 * Nhìn ngang: mày của mắt gần, đuôi mày vểnh về phía sau đầu.
 */
function lionMask(ctx, ramp) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const k = clamp(sk.hk * 1.1, 0.85, 1.05);
  const { eyeY } = sk;
  const ew = sk.big ? 1.5 : 1.0;
  const brow = (x, s) => mOr(
    stroke([[x - s * (ew + 0.2), eyeY - 2.3 * k], [x, eyeY - 2.9 * k], [x + s * (ew + 0.9 * k), eyeY - 3.5 * k], [x + s * (ew + 1.9 * k), eyeY - 4.6 * k]], 0.9),
    mEllipse(x + s * (ew + 1.6 * k), eyeY - 4.2 * k, 1.1, 1.0),
  );
  const m = view === 'S' ? perEye(ctx, brow) : brow(sk.anchors.face[0], -1);
  onHead(ctx, 'mask', m, ramp, { shade: -1 });
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

/** Bậc sáng (1..4) của điểm (x, y) theo khối elip `normal` và ánh sáng trên-trái (cùng công thức với core.js colourise). */
function bandAt(normal, x, y, head = false) {
  const [cx, cy, rx, ry] = normal;
  const nx = clamp((x + 0.5 - cx) / rx, -1, 1);
  const ny = clamp((y + 0.5 - cy) / ry, -1, 1);
  const nz = Math.sqrt(clamp(1 - nx * nx - ny * ny, 0, 1));
  const I = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  const b = I < 0.16 ? 1 : I < 0.56 ? 2 : I < 0.92 ? 3 : 4;
  return head ? b : Math.min(b, 3);
}
/** Một màu bảng phẳng: [tên dải, bậc 1..4] của một dải KHÁC `not` có màu `hex` (để nét vảy không bị dọn như điểm lẻ). */
function flatOf(hex, not) {
  for (const [key, r] of Object.entries(RAMPS)) {
    if (key === not) continue;
    const i = r.indexOf(hex, 1);
    if (i >= 1) return [key, i];
  }
  return null;
}
/**
 * Vảy lợp: CHỈ vẽ mép dưới lượn sóng ⌣⌣⌣ của từng hàng tấm (mỗi cột một điểm), không có nét dọc giữa hai tấm trong
 * một hàng (trông như tường gạch). Hàng tấm so le nửa tấm; tấm lớn (pw × ph). Nét vảy tối hơn lông tại chỗ đúng một bậc
 * (sáng → giữa, giữa → tối, tối → nét), cùng nhóm với thân: không đổ bóng, không kẻ nét trong, nên thân vẫn tô dải như
 * bản mẫu. `skip(x, y, band)`: bỏ nét ở đó (dải sáng sống lưng). `keep(cx, cy)`: chỉ giữ tấm có tâm thỏa điều kiện.
 */
function scallops(ctx, region, { pw, ph, ramp, z, prefix, group, normal, head = false, keep = () => true, skip = () => false }) {
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
  const R = RAMPS[ramp];
  // tấm nửa elip: rộng đúng pw (hai tấm kề chạm nhau ở mũi nhọn), mép dưới võng sâu ≈ 0.6 ph: nét ⌣ rõ, liền nhau
  const rx = pw * 0.5 + 0.05;
  const ry = ph * 0.62;
  const byHex = new Map();
  for (let r = 0; y0 + r * ph <= y1; r++) {
    const cy = y0 + r * ph;
    const off = r % 2 ? pw / 2 : 0;
    const ms = [];
    for (let cx = x0 - pw + off; cx <= x1 + pw; cx += pw) if (keep(cx + 0.5, cy + 0.5)) ms.push(mEllipse(cx + 0.5, cy + 0.5, rx, ry));
    if (!ms.length) continue;
    const row = mOr(...ms);
    for (let x = x0; x <= x1; x++) {
      // điểm thấp nhất của hàng tấm ở cột x (trong vùng, chưa chạm mép dưới vùng: mép vùng đã có viền)
      let y = -1;
      for (let yy = Math.min(47, Math.ceil(cy + ry + 1)); yy >= Math.max(0, Math.floor(cy - ry)); yy--) {
        if (row[yy * 48 + x]) {
          y = yy;
          break;
        }
      }
      if (y < 0 || y >= 47 || !region[y * 48 + x] || !region[(y + 1) * 48 + x]) continue;
      const band = bandAt(normal, x, y, head);
      if (skip(x, y, band)) continue;
      // một bậc tối hơn lông tại chỗ, bỏ qua bậc trùng màu (fur_silver: bậc 2 = bậc 3)
      let d = band - 1;
      while (d > 0 && R[d] === R[band]) d--;
      const hex = R[d];
      if (!byHex.has(hex)) byHex.set(hex, newMask());
      byHex.get(hex)[y * 48 + x] = 1;
    }
  }
  let i = 0;
  for (const [hex, m] of byHex) {
    const fl = flatOf(hex, ramp);
    if (fl) ctx.parts.push(part(`${prefix}${i++}`, m, fl[0], z, { group, flat: fl[1], line: false }));
  }
}

/**
 * Khoanh bụng (vảy bụng rồng): dải VUÔNG GÓC với trục dài của mảng bụng (mô-men bậc hai), mỗi dải có nét chia: bụng
 * dựng đứng (dáng đứng nhìn ngang hay nhìn trước) thì khoanh ngang, bụng dài nằm ngang (thân rắn) thì khoanh dọc theo thân.
 */
function bellyBands(ctx) {
  const { sk, view } = ctx;
  const belly = bellyMask(ctx);
  if (!mAny(belly) || view === 'N') return;
  const k = patSize(sk);
  const step = Math.max(2, Math.round(2.6 * k));
  let [n, sx, sy] = [0, 0, 0];
  for (let q = 0; q < NPX; q++) {
    if (!belly[q]) continue;
    n++;
    sx += q % 48;
    sy += Math.floor(q / 48);
  }
  const [mx, my] = [sx / n, sy / n];
  let [cxx, cyy, cxy] = [0, 0, 0];
  for (let q = 0; q < NPX; q++) {
    if (!belly[q]) continue;
    const dx = (q % 48) - mx;
    const dy = Math.floor(q / 48) - my;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  // trục dài (vectơ riêng lớn nhất của ma trận hiệp phương sai); bụng tròn (dài/rộng < 1.6) thì coi như bụng đứng:
  // trục dọc, khoanh ngang
  const tr = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l2 = Math.max(1e-6, tr - l1);
  const th = l1 / l2 < 1.6 * 1.6 ? Math.PI / 2 : 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const [ux, uy] = [Math.cos(th), Math.sin(th)];
  const nrm = bodyNrm(sk);
  const bands = new Map();
  for (let q = 0; q < NPX; q++) {
    if (!belly[q]) continue;
    const t = ((q % 48) - mx) * ux + (Math.floor(q / 48) - my) * uy;
    const i = Math.floor(t / step + 0.5);
    if (!bands.has(i)) bands.set(i, newMask());
    bands.get(i)[q] = 1;
  }
  // dải phía trên/trước đè dải sau: thứ tự theo hướng trục (đi xuống trong ô), nét chia nằm ở mép dải đứng trước
  const down = uy > 0.2 || (Math.abs(uy) <= 0.2 && ux > 0) ? 1 : -1;
  [...bands.keys()].sort((p, q) => p - q).forEach((i, j) => {
    ctx.parts.push(part(`bellyband${j}`, bands.get(i), ctx.ramps.belly, 4.15 - down * j * 0.001, { normal: nrm }));
  });
}

function scales(ctx) {
  const t = TUNE[ctx.sp.id]?.scales ?? {};
  const { sk, view } = ctx;
  const k = patSize(sk);
  const ramp = rampOf(ctx, t.ramp ?? 'main');
  // tấm lớn (≈ 6 × 4 ở tuổi trưởng thành); nhìn sau thưa hàng hơn
  const pw = Math.max(4, Math.round(5.8 * k));
  const ph = Math.max(3, Math.round((view === 'N' ? 4.8 : 3.8) * k));
  const nrm = bodyNrm(sk);
  const [bcx, , brx] = sk.body;
  // thân: nhìn sau chừa cột sống lưng (đường gai/bờm, dải sáng của khối) để lưng không thành vải kẻ ô
  const skip = (x) => view === 'N' && Math.abs(x + 0.5 - bcx) < Math.max(1.5, brx * 0.2);
  scallops(ctx, backMask(ctx), { pw, ph, ramp, z: 4.2, prefix: 'scale', group: 'body', normal: nrm, skip });
  if (t.belly) bellyBands(ctx);
  // đầu (tê tê): mũ vảy trên đỉnh và gáy; chừa mắt, mặt và vùng sáng nhất của đầu
  if (t.head && ctx.headMask) {
    const [, hcy, , hry] = sk.head;
    const hpw = Math.max(4, Math.round(5.6 * k));
    const hph = Math.max(3, Math.round(3.6 * k));
    const lim = view === 'S' ? sk.eyeY - 2.6 * k - 0.6 : view === 'E' ? sk.eyeY - 2.0 : hcy + hry * 0.5;
    const fx = sk.anchors.face[0];
    const keep = view === 'E' ? (cx, cy) => cy < lim && cx < fx - 0.5 : (cx, cy) => cy < lim;
    scallops(ctx, headArea(ctx), { pw: hpw, ph: hph, ramp, z: ctx.zh + 0.15, prefix: 'headscale', group: 'head', normal: ctx.hnrm, head: true, keep, skip: (x, y, band) => band >= 4 });
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
  ky_nhong: { spots: { layout: 'scatter', size: 'blotch', headSize: 'spot', flat: 2 } }, // kỳ nhông lửa: đốm đen méo (phẳng: đốm tròn đều)
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
