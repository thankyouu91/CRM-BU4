// Dáng RỒNG / BÒ SÁT (serpent): Thanh Long, Hoàng Long, Rồng Lửa Nhí, Kỳ Nhông Lửa, Cá Chép Rồng (5 loài).
// Chủ sở hữu: họa sĩ dáng serpent. TRẠNG THÁI: ĐÃ VẼ (hết stub), soát 3 lượt trên contact sheet (6 giai đoạn × S/E/N/W,
// đi, đứng, cảm xúc, cấp 1/30/50, đồ đeo), lượt 3 theo góp ý của art director (SERP-01..11).
//
// Dáng chibi rồng phương Đông: đầu to, ngực nhỏ (đúng elip sk.body), thân uốn lượn vài đốt, bốn chân ngắn, đuôi dài cuộn.
//  - S (nhìn trước): ngồi trên khoanh thân; khoanh nằm trên đất vòng sang PHẢI người xem rồi luồn ra sau ngực, đuôi ló ra
//    bên TRÁI người xem (bên phải của bé), uốn chữ S vươn lên rồi cuộn ra ngoài, có gai dọc mép ngoài. Hai vuốt nhỏ khoanh
//    trước ngực (để hai bên sườn trống, đuôi không bị đọc nhầm là tay). Giơ tay (wave, jump, busy): bàn tay ló ra NGOÀI viền
//    đầu, bậc 1 ngang má dưới râu, bậc 2 ngang mắt trên râu (cánh tay nấp sau đầu to, chỉ bàn tay lộ ra). Bụng có vạch vảy
//    ngang (một bộ phận z 4.12, dưới khoanh bụng của hoa văn 'scales' nếu có, nên đầu, vuốt, râu che được). Không vẽ chân sau
//    (giấu trong khoanh: vẽ chân ra trông như gấu ngồi).
//  - E (nhìn ngang, quay phải): ngực dưới gáy, đốt 1 thấp, đốt 2 gù lên, đuôi vươn lên cuộn như dấu hỏi. Đốt 1, đốt 2 và
//    đuôi chung MỘT khối sáng (dải sáng chạy liền cả thân sau), bụng sáng chỉ ở ngực và đốt 1, không vạch vảy, 3-4 gai lưng:
//    thân sau đọc thành một khối liền ở cỡ game. Bốn chân ngắn bước chéo như quad. Đi bộ: sóng chạy dọc thân (đốt 1 xuống thì
//    đốt 2 lên, 0.6 px). Đầu có mõm nhô (headMask gồm cả mõm).
//  - N (nhìn sau): gai dọc sống lưng, khoanh bên TRÁI người xem, đuôi có gai bên PHẢI; tay chỉ hiện khi giơ. Râu chỉ lộ một
//    mẩu ngắn rủ xuống sau má (không vểnh lên: ở bé nhỏ tuổi đầu râu vểnh trông như hai tay giơ).
//  - W = lật E (pipeline). Đi bộ S/N: thân lắc ngang 1 px (walkPose, như dáng chim).
// Đầu: siêu elip như biped. Râu rồng (Thanh Long, Hoàng Long, Cá Chép, Rồng Lửa): sợi 1 px màu bụng từ hai bên mõm vểnh ra
// rồi cong lên (S), một sợi rủ dưới hàm uốn về sau (E); Rồng Lửa: chóp râu là đốm lửa cam. Mang má: gai sau hàm (E: rồng).
//
// Rồng Lửa Nhí (SERP-02: "rõ ràng KHÔNG phải gấu", cả ở sơ sinh): ba gai lửa cam mỗi bên đầu xòe ra phá viền đầu (S/N; E: ba
// gai sau hàm chĩa về sau), dài 3 px ở sơ sinh, 4-5 px khi lớn; râu chóp lửa; gờ mày cam sáng chếch lên trên mỗi mắt (S).
// Dải màu thân vẫn là 'flame' như Gấu Mèo Đỏ: đã đề nghị họa sĩ màu dùng 'red' cho rong_lua (ramps.js không phải file này).
//
// ĐUÔI: dáng này TỰ VẼ đuôi (thân nối liền thành đuôi), `sp.tail` chỉ chọn CHÓP: 'dragon' → túm lông màu điểm nhấn
// (Rồng Lửa: ngọn lửa; Kỳ Nhông: đốm lửa nhỏ vàng), 'fish' → vây đuôi cá chép xòe hai thùy. Dáng khai báo `ownsTail: true`
// và index.js bỏ qua tails[...] với dáng này (đã nối ở bước ghép). dropForeignTail() chỉ còn là lưới an toàn: xóa trắng mặt nạ
// mọi bộ phận parts/tails.js đã đẩy vào: chính xác theo ctx.earParts nếu pipeline có ghi (index.js có ghi),
// không thì theo z của đuôi trong hợp đồng (ARTIST-GUIDE mục 8: 1 khi nhìn trước/ngang, 8 khi nhìn sau; tai 1.5, 2, 6-7),
// không dựa vào tên bộ phận. Họa sĩ đuôi muốn đổi kiểu chóp thì sửa tailTip() ở đây (cùng chủ dáng serpent).
//
// Tinh chỉnh theo loài (TUNE): ridge 'spikes' | 'fin' | 'none' (gờ lưng), tip (chóp đuôi), legs (0 = không chân, vây ngực;
// > 1 = chân to hơn), stance 'coil' | 'lizard' (Kỳ Nhông: chân trước dạng ngang chống đất, mông rộng có hai bàn chân sau
// xòe, đuôi duỗi trên đất rồi vểnh, cùng bên với nhìn trước khi quay lưng; lưng thẳng khi nhìn ngang), frill 'E' (gai mang
// sau hàm, chỉ nhìn ngang) | 'flame' (gai lửa ba hướng, mọi hướng), whiskers true | 'flame' (chóp lửa), brow (gờ mày),
// plates (vạch vảy bụng, mặc định có), koi (mảng đỏ cam trên các đốt thân, khoanh và đuôi; đuôi nhìn trước/sau dừng ngang
// ngực, vây đuôi chĩa lên; vây lưng nhìn sau là ba thùy vây sáng).
//
// Tên bộ phận: 'body', 'belly', 'head' theo hợp đồng (hoa văn tìm thân/bụng theo tên); mọi bộ phận khác mang tiền tố riêng
// ('s...' hoặc 'tailserp...': marks.js coi tên bắt đầu bằng 'tail' là đuôi) để không trùng nhóm với tai/đuôi/đặc điểm.
//
// Điểm neo: dims giữ đầu cỡ biped, ngực = sk.body, nên neo đầu/mặt/cổ/lưng/bùa của skeleton.js vẫn đúng; hoa văn (vảy, đốm),
// dấu hiệu cấp (vằn hông), gậy lão làng, đồ cổ/lưng đều rơi lên ngực. móc anchors(sk) dưới đây (skeleton.js gọi
// arch.anchors?.(sk, sp) sau khi tính điểm neo, SERP-03): nhìn ngang lùi neo lưng về sau cho đồ lưng lộ ra.
// Phụ thuộc của người khác: sừng/gạc/vây tai (parts/ears.js), mào/lửa/giọt/than hồng (parts/features.js), vảy/đốm
// (parts/patterns.js), màu (ramps.js).
// Hợp đồng (ARTIST-GUIDE mục 9): dims, headZ(view), body { S, E, N }(ctx), head { S, E, N }(ctx), walkPose(i, view).
import { gait, mAnd, mAndNot, mAny, mBelow, mEllipse, mOr, mOrInto, mTri, newMask, part } from '../core.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Tinh chỉnh theo loài. */
const TUNE = {
  thanh_long: { frill: 'E', whiskers: true },
  hoang_long: { frill: 'E', whiskers: true },
  rong_lua: { frill: 'flame', whiskers: 'flame', brow: true, tip: 'flame' },
  ky_nhong: { ridge: 'none', tip: 'ember', legs: 1.15, stance: 'lizard', plates: false },
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
    brow: t.brow ?? false,
    plates: t.plates ?? true,
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

/** Nửa bề ngang của đầu (siêu elip n = 2.25) ở hàng y. */
function headHalfW(sk, y) {
  const [, hcy, hrx, hry] = sk.head;
  const v = Math.min(1, Math.abs(y - hcy) / hry);
  return hrx * (1 - v ** 2.25) ** (1 / 2.25);
}

/**
 * Bỏ đuôi do parts/tails.js vẽ (dáng serpent tự vẽ thân nối liền thành đuôi): xóa trắng mặt nạ, giữ nguyên chỉ số trong
 * ctx.parts. Pipeline có ghi ctx.earParts = [đầu, cuối] của tai thì mọi bộ phận trước tai là đuôi; không thì nhận đuôi theo
 * z của hợp đồng (đuôi 1 / 8, tai 1.5 trở lên khi nhìn trước/ngang và 6-7 khi nhìn sau). Không dựa vào tên bộ phận.
 */
function dropForeignTail(ctx) {
  const ranged = Array.isArray(ctx.earParts);
  const end = ranged ? ctx.earParts[0] : ctx.parts.length;
  const tz = ctx.view === 'N' ? 8 : 1;
  for (let i = 0; i < end; i++) {
    const p = ctx.parts[i];
    if (ranged || Math.abs(p.z - tz) < 0.3) ctx.parts[i] = { ...p, mask: newMask() };
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
    ctx.parts.push(part('tailserpfin', m, A, z, { normal: [x + dx * 2 - 1, y + dy * 2 - 2, 5, 5] }));
  } else if (look.tip === 'tuft') {
    const m = mOr(mTri(at(-0.6, 1.5 * k), at(-0.6, -1.5 * k), at(3.8 * k, 0)), mTri(at(0, 0.4), at(1.2 * k, 2.4 * k), at(3.0 * k, 1.6 * k)), mTri(at(0, -0.4), at(1.2 * k, -2.4 * k), at(3.0 * k, -1.6 * k)));
    ctx.parts.push(part('tailserptuft', m, A, z, { normal: [x - 1, y - 2, 4, 4] }));
  } else if (look.tip === 'flame' || look.tip === 'ember') {
    const f = look.tip === 'ember' ? 0.8 : 1; // kỳ nhông: đốm lửa nhỏ ở chóp đuôi
    const m = mOr(mTri(at(-0.6, 1.6 * k * f), at(-0.6, -1.6 * k * f), at(4.2 * k * f, 0.6 * f)), mTri(at(0.6 * f, 0.6 * f), at(1.4 * k * f, 2.6 * k * f), at(3.0 * k * f, 1.2 * k * f)));
    ctx.parts.push(part('tailserpflame', m, f < 1 ? 'gold' : 'orange', z, { normal: [x - 1, y - 2, 4, 4] }));
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

/**
 * Vạch vảy bụng (chỉ nhìn trước): những hàng ngang bậc tối của dải bụng, bên trong mảng bụng (chừa mép). Là BỘ PHẬN
 * (z 4.12, nhóm 'body', bậc cố định, không nét trong) chứ không phải điểm tô thẳng, nên đầu, vuốt, râu che được; nằm dưới
 * khoanh bụng của hoa văn 'scales' (z 4.15) để hoa văn có thì hoa văn thắng.
 */
function plates(ctx, belly, y0, y1, step) {
  const m = newMask();
  for (let y = Math.round(y0); y <= y1; y += step) {
    const xs = [];
    for (let x = 0; x < 48; x++) if (belly[y * 48 + x]) xs.push(x);
    if (xs.length < 4) continue;
    for (const x of xs.slice(1, -1)) m[y * 48 + x] = 1;
  }
  if (mAny(m)) ctx.parts.push(part('splates', m, ctx.ramps.belly, 4.12, { group: 'body', flat: 1, line: false }));
}

/**
 * Bàn tay giơ (nhìn trước): ló ra NGOÀI viền đầu. Bậc 1: ngang má, dưới râu; bậc 2: ngang mắt, trên râu (cao hơn, xa hơn:
 * bậc 2 luôn lộ ít nhất bằng bậc 1). Cá chép (fin): vây ngực vẫy ngang dưới râu, bậc 2 xa ra ngoài hơn (ngang mắt là chỗ
 * vây tai). Trả về [x, y, bán kính bàn tay].
 */
function pawAt(sk, s, up, swg, fin = false, far = 0) {
  const [hcx] = sk.head;
  const t = growT(sk);
  const pr = lerp(1.35, 1.75, t);
  const yw = sk.eyeY + lerp(2.6, 3.0, t); // hàng râu
  let py;
  let out;
  if (fin) [py, out] = up >= 2 ? [yw + 1.0, pr + 2.6] : [yw + 2.6, pr + 0.6];
  else [py, out] = up >= 2 ? [sk.eyeY - lerp(0.6, 1.4, t), pr + 0.7 + far] : [yw + lerp(2.0, 2.4, t), pr - 0.2];
  py += swg * 0.5;
  return [hcx + s * (headHalfW(sk, py) + out), py, pr];
}

/** z của tay/vây giơ (nhìn trước): sau đầu và râu, trước gai mang và vây tai (bàn tay ló ra ngoài viền đầu không bị che). */
const raisedZ = (ctx) => ctx.zh - 0.05;

/** Tay giơ (nhìn trước): cánh tay từ vai chĩa chéo lên, nấp sau đầu to; bàn tay ló ra ngoài viền đầu (pawAt). */
function raisedArm(ctx, s, up, z, swg) {
  const { sk, ramps } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const t = growT(sk);
  // gai lửa hai bên đầu (Rồng Lửa): bàn tay giơ cao ra xa hơn, khỏi lẫn vào gai
  const [px, py, pr] = pawAt(sk, s, up, swg, false, lookOf(ctx).frill === 'flame' ? 1.2 : 0);
  const sx = bcx + s * (brx - 1.0);
  const sy = bcy - bry * 0.3;
  const aw = lerp(1.05, 1.35, t);
  const m = mOr(tube([[sx, sy, aw], [lerp(sx, px, 0.6), lerp(sy, py, 0.6) + 0.4, aw], [px - s * 0.4, py + 0.5, aw]]), mEllipse(px, py, pr, pr));
  ctx.parts.push(part(`sarm${s}`, m, ramps.limb ?? ramps.main, z, { normal: [px - 0.8, py - 1.2, pr + 1.4, pr + 1.6] }));
  // lòng bàn tay màu bụng quay về phía người xem: đọc ra là bàn tay đang vẫy, kể cả khi nằm trên gai mang cùng màu thân
  const palm = mEllipse(px - s * 0.1, py + 0.2, pr * 0.62, pr * 0.62);
  ctx.parts.push(part(`sarm${s}palm`, mAnd(palm, m), ramps.belly, z + 0.001, { group: `sarm${s}`, flat: 3 }));
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
  const sd = back ? -1 : 1; // phía khoanh thân: phải người xem khi nhìn trước; đuôi ở phía kia (cùng một bên của bé)
  const X = (dx) => bcx + sd * dx * kx;
  const sw = pose.tail ?? 0;
  const R = (r) => r * lerp(0.72, 1, t);
  const liz = look.stance === 'lizard';
  let tailPts;
  let tz;
  if (liz) {
    // kỳ nhông: mông rộng nằm thấp (sau ngực khi nhìn trước, trước ngực khi nhìn sau), hai bàn chân sau xòe hai bên mông;
    // đuôi duỗi trên đất về bên PHẢI của bé rồi vểnh chóp (nhìn sau: từ giữa mông chĩa về phía người xem rồi vòng sang
    // phải người xem, dài hơn, nằm trước mông)
    const rz = back ? 4.3 : 3;
    const rry = R(2.7);
    const rump = mEllipse(bcx, g - rry + 0.42, brx * 1.2 + 0.4, rry);
    const rumpN = [bcx - 1, g - 4, brx * 1.2 + 1.4, 4];
    ctx.parts.push(part('scoil', rump, ramps.main, rz, { normal: rumpN }));
    for (const s of [-1, 1]) {
      // nhìn trước: bàn chân sau xòe ở hai bên mông (xa hơn nên cao hơn chân trước 1 px, tối hơn một bậc); nhìn sau: khuỷu
      // chân trước ló ra hai bên ngực (sau ngực), chân gần là chân sau (vẽ cùng chân bên dưới)
      const lift = s < 0 ? lF : lN;
      if (back) {
        const ex = bcx + s * (brx + lerp(0.6, 1.1, t));
        const ey = bcy + bry * 0.15;
        const lw = lerp(1.15, 1.4, t);
        const m = tube([[bcx + s * (brx - 1.2), bcy - bry * 0.25, lw], [ex, ey, lw], [ex + s * 0.4, ey + lerp(1.5, 2.4, t), lw * 0.9]]);
        ctx.parts.push(part(`sfront${s}`, m, ramps.limb ?? ramps.main, 3.5, { normal: [ex - 0.5, ey - 2, 2.5, 3.5], shade: -1 }));
      } else {
        const fx = bcx + s * (brx * 1.2 + lerp(0.6, 1.0, t));
        const fy = g - lerp(1.5, 2.2, t) + 0.42 - lift * 0.5 - 0.6;
        const toe = mEllipse(fx + s * 0.6, fy, lerp(1.5, 2.0, t), lerp(1.0, 1.25, t), s * 0.35);
        ctx.parts.push(part(`shind${s}`, toe, ramps.limb ?? ramps.main, rz + 0.05, { normal: [fx - 0.5, fy - 1.5, 2.5, 2.2], shade: -1 }));
      }
    }
    // [dx, độ cao (null = nằm sát đất), bán kính]; dx âm = phía phải của bé (trái người xem khi nhìn trước)
    const pts = back
      ? [[0, 2.3, 2.2], [-2.2, null, 2.0], [-5.2, null, 1.85], [-8.2, null, 1.65], [-10.8, 2.0, 1.45], [-12.0 + sw * 0.4, 4.6, 1.25]]
      : [[-3.0, null, 2.0], [-6.4, null, 1.8], [-9.4, null, 1.6], [-11.4, 2.8, 1.45], [-12.2 + sw * 0.4, 5.2, 1.25]];
    tailPts = pts.map(([dx, h, r]) => [X(dx), h === null ? g - R(r) + 0.42 : g - h * ky, R(r)]);
    tz = back ? 4.5 : 2;
  } else {
    // khoanh thân nằm trên đất, vòng sang một bên rồi luồn ra sau ngực
    const lapPts = [[0.5, 2.7], [4.0, 2.6], [7.0, 3.0], [8.8, 4.8], [7.2, 6.4]].map(([dx, dy], i) => [X(dx + (walking ? si * 0.15 : 0)), g - dy * ky, R([2.7, 2.6, 2.4, 2.1, 2.0][i])]);
    lapPts[0][1] = g - R(2.7) + 0.42;
    lapPts[1][1] = g - R(2.6) + 0.42;
    const lap = tube(lapPts);
    const lapN = [X(4), g - 4 * ky, 7 * kx, 4];
    ctx.parts.push(part('scoil', lap, ramps.main, 3, { normal: lapN }));
    koiPatch(ctx, look, 'scoilkoi', lap, mEllipse(X(7.4), g - 4.2 * ky, R(2.6), R(2.2)), 3, 'scoil', lapN);
    // đuôi: ló ra phía bên kia, uốn chữ S đi lên rồi cuộn ra ngoài. Cá chép: dừng ngang ngực, vây đuôi chĩa lên (chóp đuôi
    // ngang má chĩa ra ngoài trông như tay giơ hay cầm cờ).
    const def = look.tip === 'koi'
      ? [[-4.4, 2.5, 2.4], [-7.6, 3.0, 2.2], [-10.2, 4.4, 2.0], [-11.4, 6.2, 1.8], [-11.6 + sw * 0.4, 7.8, 1.55]]
      : [[-4.4, 2.5, 2.4], [-7.4, 3.0, 2.2], [-9.8, 5.2, 2.0], [-10.2, 8.2, 1.8], [-9.0, 10.8, 1.6], [-9.8, 13.2, 1.4], [-11.6 + sw * 0.5, 14.0, 1.25]];
    tailPts = def.map(([dx, dy, r]) => [X(dx), g - dy * ky, R(r)]);
    tailPts[0][1] = g - R(2.5) + 0.42;
    tz = back ? 3.5 : 2;
  }
  const tailM = tube(tailPts);
  const tailN = liz && back ? [X(-6), g - 4, 7 * kx, 4] : [X(-8), g - 8 * ky, 4, 7 * ky];
  ctx.parts.push(part('tailserp', tailM, ramps.main, tz, { normal: tailN }));
  koiPatch(ctx, look, 'tailserpkoi', tailM, mEllipse(X(-9.9), g - 6.0 * ky, R(2.2), R(1.8)), tz, 'tailserp', tailN);
  const [tx, ty] = tailPts[tailPts.length - 1];
  let [ddx, ddy] = dirOf(tailPts);
  if (look.tip === 'koi') {
    // vây đuôi cá chép chĩa chéo lên, ngả ra ngoài (xa vây ngực)
    const ox = -sd * 0.8;
    const d = Math.hypot(ox, 1);
    [ddx, ddy] = [ox / d, -1 / d];
  }
  tailTip(ctx, look, tx, ty, ddx, ddy, tz - 0.05, lerp(0.7, 1, t));
  // vây dọc mép ngoài của đuôi (cá chép): ba thùy vây sáng chĩa ra ngoài, lộ khỏi viền thân ở cả nhìn trước lẫn nhìn sau
  if (look.ridge === 'fin' && !liz) {
    const ms = [];
    for (let i = 1; i < tailPts.length - 1; i++) {
      const [x, y, r] = tailPts[i];
      const [xa, ya] = tailPts[i - 1];
      const [xb, yb] = tailPts[i + 1];
      const d = Math.hypot(xb - xa, yb - ya) || 1;
      const [ux, uy] = [(xb - xa) / d, (yb - ya) / d];
      const ox = -sd; // phía ngoài (xa thân)
      const h = lerp(1.3, 2.0, t);
      ms.push(mTri([x + ox * (r - 0.6) - ux * 1.5, y - uy * 1.5], [x + ox * (r - 0.6) + ux * 1.5, y + uy * 1.5], [x + ox * (r + h) + ux * 1.0, y + uy * 1.0]));
    }
    if (ms.length) ctx.parts.push(part('tailserpfinedge', mAndNot(mOr(...ms), tailM), ramps.accent, tz - 0.02, { flat: 3 }));
  }
  // gai dọc mép ngoài của đuôi (rồng)
  if (look.ridge === 'spikes' && !liz) {
    for (const i of [2, 4]) {
      const [x, y, r] = tailPts[i];
      const ox = -sd; // phía ngoài (xa thân)
      const h = lerp(1.4, 2.2, t);
      const m = mTri([x + ox * (r - 0.6), y - 1.2], [x + ox * (r - 0.6), y + 1.2], [x + ox * (r + h), y - 1.0]);
      ctx.parts.push(part(`tailserpspike${i}`, m, ramps.accent, tz - 0.02, { normal: [x + ox * r, y - 1, 2, 2] }));
    }
  }
  // ngực
  const body = mEllipse(bcx, bcy, brx, bry);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  ctx.parts.push(part('body', body, ramps.main, 4, { normal: nrm }));
  if (!back) {
    const belly = mAnd(body, mEllipse(bcx, bcy + bry * 0.25, brx * 0.62, bry * 1.05));
    ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
    if (look.plates) plates(ctx, belly, sk.btop + bry * 0.9, bcy + bry - 1.5, 2);
  }
  // gờ lưng (nhìn sau): gai dọc sống lưng (rồng). Cá chép không có sọc vây giữa lưng (nhìn sau trông như đường may): vây
  // của nó lộ ở mép đuôi (bên trên).
  if (back && look.ridge === 'spikes') {
    for (let y = sk.btop + 3.2, i = 0; y < bcy + bry - 0.5; y += lerp(2.2, 2.6, t), i++) {
      const w = lerp(1.3, 1.9, t);
      ctx.parts.push(part(`sridge${i}`, mTri([bcx - w, y + 1.0], [bcx + w, y + 1.0], [bcx, y - lerp(1.7, 2.5, t)]), ramps.accent, 4.2, { group: `sridge${i}`, normal: [bcx - 0.5, y - 1, 2, 2] }));
    }
  }
  // tay: hai vuốt nhỏ khoanh trước ngực (nhìn trước); giơ lên thì bàn tay ló ra ngoài viền đầu (raisedArm).
  // Kỳ nhông: chân trước dạng ngang chống xuống đất (nhìn sau: chân sau). Cá chép: vây ngực hai bên.
  const limb = ramps.limb ?? ramps.main;
  for (const s of [-1, 1]) {
    const up = s > 0 ? pose.armR ?? 0 : pose.armL ?? 0;
    const lift = s < 0 ? lF : lN;
    const swg = !walking ? 0 : (s < 0) === (lN > 0) ? 1 : 0;
    const z = back ? 3 : 6;
    if (!look.legs) {
      // vây ngực cá chép: nghỉ thì xòe chéo xuống hai bên ngực; giơ thì chóp vây ló ra ngoài viền đầu (như bàn tay giơ)
      const k = lerp(0.7, 1, t);
      let ax = bcx + s * (brx - lerp(0.5, 0.9, t));
      let ay = bcy - lerp(0.2, 0.8, t) + swg;
      let m;
      if (up && !back) {
        const [px, py] = pawAt(sk, s, up, swg, true);
        ax = bcx + s * (brx - 1.0);
        ay = bcy - bry * 0.3;
        const ux = px - ax;
        const uy = py - ay;
        const L = Math.hypot(ux, uy);
        const [dx, dy] = [ux / L, uy / L];
        const [nx, ny] = [-dy, dx];
        const tip = [px + dx * 1.2, py + dy * 1.2];
        m = mOr(mTri([ax + nx * 1.4, ay + ny * 1.4], [ax - nx * 1.4, ay - ny * 1.4], tip), mTri(tip, [px + nx * 2.2 * k, py + ny * 2.2 * k], [px - nx * 2.2 * k, py - ny * 2.2 * k]));
      } else {
        // nghỉ: vây chĩa chéo xuống sát sườn (để chỗ cho vây đuôi chĩa lên bên cạnh)
        m = mOr(mTri([ax - s * 0.6, ay - 1.6], [ax - s * 0.6, ay + 1.6], [ax + s * 2.6 * k, ay + 3.4]), mTri([ax - s * 0.6, ay - 1.6], [ax + s * 2.6 * k, ay + 3.4], [ax + s * 3.2 * k, ay + 0.6]));
      }
      ctx.parts.push(part(`spfin${s}`, m, ramps.accent, up && !back ? raisedZ(ctx) : z, { normal: [ax, ay - 1, 3, 3] }));
    } else if (up && !back) {
      raisedArm(ctx, s, up, raisedZ(ctx), swg);
    } else if (liz) {
      const fry = lerp(1.1, 1.3, t);
      const fx = bcx + s * (back ? brx * 1.2 + lerp(0.8, 1.3, t) : brx + lerp(0.6, 1.4, t));
      const fy = g - fry + 0.42 - lift;
      const lw = lerp(1.2, 1.45, t) * look.legs;
      const m = mOr(tube([[bcx + s * (brx - 1.4), back ? g - 3.2 : bcy + bry * 0.15, lw], [fx - s * 0.4, fy - 0.6, lw]]), mEllipse(fx, fy, lerp(1.6, 2.0, t), fry));
      ctx.parts.push(part(`sleg${s}`, m, limb, 5, { normal: [fx - s - 0.5, fy - 3, 3, 4] }));
    } else if (!back || up) {
      // hai vuốt nhỏ khoanh trước ngực (nhìn sau chỉ hiện khi giơ: chĩa chéo ra hai bên vai)
      const ax = bcx + s * (up ? brx + up * 1.5 : lerp(1.5, 2.3, t));
      const ay = up ? bcy - 1.0 - up * 2.0 : bcy - lerp(0.0, 0.5, t) + swg * 0.5;
      const rot = up ? -s * (0.55 + up * 0.2) : s * 0.55;
      const ry = up ? lerp(2.2, 2.7, t) : lerp(1.6, 2.0, t);
      ctx.parts.push(part(`sarm${s}`, mEllipse(ax, ay, lerp(1.15, 1.4, t), ry, rot), limb, z, { normal: [ax - 0.5, ay - 1, 2, 3] }));
    }
  }
}

// ---------------------------------------------------------------- nhìn ngang (quay phải)

/** Hình học thân sau khi nhìn ngang: đốt 1, đốt 2, các điểm đuôi. */
function sideGeom(sk, look, pose) {
  const [bcx, bcy, brx, bry] = sk.body;
  const g = sk.ground;
  const t = growT(sk);
  const k = lerp(0.6, 1, t);
  const { walking } = gait(pose);
  const und = walking ? [0, 0.6, 0.6, 0, -0.6, -0.6][pose.step] : 0;
  const liz = look.stance === 'lizard';
  const r1x = lerp(2.8, 4.4, t);
  const r1y = lerp(2.6, 4.0, t) * (liz ? 0.9 : 1);
  const c1x = bcx - brx - lerp(0.6, 1.4, t);
  const c1y = liz ? bcy + bry * 0.2 + und * 0.4 : g - sk.legH * (look.legs ? 0.8 : 0) - r1y + 0.42 + (look.legs ? und * 0.5 : Math.min(0, und));
  const r2 = lerp(2.0, 3.2, t) * (liz ? 0.85 : 1);
  const c2x = c1x - r1x * (liz ? 0.85 : 1) - lerp(0.2, 0.8, t);
  const c2y = liz ? c1y + lerp(0.6, 1.2, t) - und * 0.4 : c1y - lerp(1.4, 3.0, t) - und;
  const sw = pose.tail ?? 0;
  const R = (r) => r * lerp(0.75, 1, t);
  let tailDef;
  if (liz) tailDef = [[-1.2, 0.6, 2.2], [-2.8, 1.8, 1.9], [-4.4, 1.9, 1.65], [-5.4, 0.5, 1.45], [-5.2 + sw * 0.3, -1.6, 1.25]];
  else if (look.tip === 'koi') tailDef = [[-1.0, -0.8, 2.4], [-2.3, -3.4, 2.0], [-2.5, -6.0, 1.6], [-1.6 + sw * 0.4, -8.0, 1.3]];
  else tailDef = [[-1.2, -0.8, 2.5], [-2.6, -3.8, 2.1], [-2.4, -7.0, 1.8], [-0.6, -9.4, 1.55], [1.8, -10.0, 1.35], [3.4 + sw * 0.5, -8.8, 1.2]];
  const pts = tailDef.map(([dx, dy, r]) => [c2x + dx * k, c2y + dy * k, R(r)]);
  return { t, k, und, liz, r1x, r1y, c1x, c1y, r2, c2x, c2y, pts, bcx, bcy, brx, bry, g };
}

function sideBody(ctx) {
  dropForeignTail(ctx);
  const { sk, pose, ramps } = ctx;
  const look = lookOf(ctx);
  const G = sideGeom(sk, look, pose);
  const { t, k, r1x, r1y, c1x, c1y, r2, c2x, c2y, pts, bcx, bcy, brx, bry, g } = G;
  const { s: si, lN, lF } = gait(pose);
  // ngực + bụng sáng (không vạch vảy khi nhìn ngang: đỡ rối ở cỡ game)
  const body = mEllipse(bcx, bcy, brx, bry);
  const nrm = [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5];
  ctx.parts.push(part('body', body, ramps.main, 4, { normal: nrm }));
  const belly = mAnd(body, mEllipse(bcx + brx * 0.55, bcy + bry * 0.45, brx * 0.72, bry * 0.9));
  ctx.parts.push(part('belly', belly, ramps.belly, 4.1, { group: 'body', normal: nrm }));
  // thân sau: đốt 1 (thấp, sau ngực), đốt 2 (gù lên), đuôi cong, chung một khối sáng nên dải sáng chạy liền một mạch.
  // Bụng sáng chỉ ở đốt 1. Kỳ nhông: lưng thẳng, đuôi kéo trên đất rồi vểnh chóp.
  let [x0, y0, x1, y1] = [c1x + r1x, c1y + r1y, c1x - r1x, c1y - r1y];
  for (const [x, y, r] of [[c2x, c2y, r2 * 1.05], ...pts]) {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  }
  const rearN = [(x0 + x1) / 2 - 1.5, (y0 + y1) / 2 - 2.0, (x1 - x0) / 2 + 2.5, (y1 - y0) / 2 + 2.5];
  const seg1 = mEllipse(c1x, c1y, r1x, r1y);
  ctx.parts.push(part('sseg1', seg1, ramps.main, 3.9, { group: 'srear', normal: rearN }));
  ctx.parts.push(part('sseg1b', mAnd(seg1, mBelow(c1y + r1y * 0.4)), ramps.belly, 3.91, { group: 'srear', normal: rearN }));
  koiPatch(ctx, look, 'sseg1koi', seg1, mEllipse(c1x + r1x * 0.2, c1y - r1y * 0.55, r1x * 0.7, r1y * 0.55), 3.9, 'srear', rearN);
  const seg2 = mEllipse(c2x, c2y, r2 * 1.05, r2);
  ctx.parts.push(part('sseg2', seg2, ramps.main, 3.8, { group: 'srear', normal: rearN }));
  koiPatch(ctx, look, 'sseg2koi', seg2, mEllipse(c2x - r2 * 0.3, c2y - r2 * 0.2, r2 * 0.6, r2 * 0.6), 3.8, 'srear', rearN);
  const tail = tube(pts);
  ctx.parts.push(part('tailserp', tail, ramps.main, 3.7, { group: 'srear', normal: rearN }));
  const [tx, ty] = pts[pts.length - 1];
  const [ddx, ddy] = dirOf(pts);
  tailTip(ctx, look, tx, ty, ddx, ddy, 3.65, lerp(0.7, 1, t));
  // gờ lưng: 3-4 gai nhỏ dọc lưng và đuôi, chĩa về sau (sơ sinh 3)
  if (look.ridge === 'spikes') {
    const h = lerp(1.6, 2.6, t);
    const spikes = [
      [c1x + r1x * 0.2, c1y - r1y * 0.97, 3.85], [c2x + r2 * 0.1, c2y - r2, 3.75],
      [pts[1][0] - pts[1][2] * 0.8, pts[1][1], 3.68], ...(t > 0.45 ? [[pts[2][0] - pts[2][2] * 0.6, pts[2][1] - pts[2][2] * 0.6, 3.68]] : []),
    ];
    spikes.forEach(([x, y, z], i) => {
      const m = mTri([x - 1.3 * k, y + 1.2], [x + 1.3 * k, y + 1.2], [x - 1.2 * k, y - h]);
      ctx.parts.push(part(`sspike${i}`, m, ramps.accent, z, { normal: [x - 0.5, y - 1, 2, 2] }));
    });
  } else if (look.ridge === 'fin') {
    const hh = lerp(2.0, 3.4, t);
    const fin = mOr(
      mTri([c1x + r1x * 0.7, c1y - r1y * 0.75], [c1x - r1x * 0.3, c1y - r1y * 0.6], [c1x + r1x * 0.15, c1y - r1y - hh]),
      mTri([c1x - r1x * 0.1, c1y - r1y * 0.7], [c2x - r2 * 0.4, c2y - r2 * 0.6], [c2x + r2 * 0.2, c2y - r2 - hh * 0.9]),
    );
    ctx.parts.push(part('sdorsal', fin, ramps.accent, 3.6, { normal: [c1x, c1y - r1y - 2, 5, 3] }));
  }
  // bốn chân nhỏ (cá chép: vây ngực)
  if (look.legs) {
    const lw = lerp(1.2, 1.5, t) * look.legs;
    const legs = [
      ['fN', bcx + brx * 0.2, si, lN, 5, 0, bcy + bry - 1.5], ['fF', bcx + brx * 0.2 + 1.5, -si, lF, 2, -1, bcy + bry - 1.5],
      ['bN', c1x + 0.4, -si, lF, 5, 0, c1y + r1y - 1.5], ['bF', c1x + 1.9, si, lN, 2, -1, c1y + r1y - 1.5],
    ];
    for (const [nm, lx, off, lift, z, sh, top] of legs) {
      const x0l = lx + off * 0.45;
      const m = mEllipse(x0l, (top + g) / 2 - lift * 0.5, lw, (g - top) / 2 + 0.5 - lift * 0.5, 0, 2.6);
      ctx.parts.push(part(`sleg${nm}`, m, ramps.limb ?? ramps.main, z, { normal: [x0l - 0.6, top, lw + 1, g - top + 1], shade: sh }));
    }
  } else {
    const fx = bcx + brx * 0.1;
    const fy = bcy + bry * 0.55;
    const m = mOr(mTri([fx + 1.8, fy - 1.4], [fx - 0.6, fy + 0.8], [fx - 4.0 * k, g - 0.6]), mTri([fx + 1.8, fy - 1.4], [fx - 4.0 * k, g - 0.6], [fx - 4.4 * k, fy + 0.4]));
    ctx.parts.push(part('spfinE', m, ramps.accent, 5, { normal: [fx - 1, fy, 4, 3] }));
  }
}

// ---------------------------------------------------------------- đầu

/**
 * Gai lửa (Rồng Lửa): ba gai mỗi bên đầu xòe ra ngoài phá viền đầu (chân gai không chồng nhau, tô phẳng một bậc cam: bên
 * trái người xem đón sáng nên sáng hơn); nhìn ngang ba gai sau hàm chĩa về sau.
 */
function flameFrills(ctx, m) {
  const { sk, view } = ctx;
  const [hcx, hcy, , hry] = sk.head;
  const t = Math.min(1, growT(sk));
  const L = lerp(3.4, 4.6, t); // phần ló ra ngoài viền đầu (gai giữa; gai trên/dưới 0.9/0.85: ≥ 3 px ở sơ sinh, ≥ 4 px khi lớn)
  const w = lerp(1.15, 1.45, t); // nửa bề rộng chân gai
  const sets = view === 'E'
    ? [[-1, -0.14, Math.PI + 0.62, 0.9], [-1, 0.2, Math.PI + 0.12, 1], [-1, 0.54, Math.PI - 0.38, 0.85]]
    : [-1, 1].flatMap((s) => [[s, -0.36, -0.62, 0.9], [s, 0.03, -0.16, 1], [s, 0.4, 0.34, 0.85]]);
  sets.forEach(([s, v, a, f], i) => {
    const y = hcy + hry * v;
    const edge = view === 'E' ? hcx - headHalfW(sk, y) : hcx + s * headHalfW(sk, y);
    const [dx, dy] = view === 'E' ? [Math.cos(a), Math.sin(a)] : [s * Math.cos(a), Math.sin(a)];
    const bx = edge - dx * 1.5;
    const by = y - dy * 1.5;
    const tip = [edge + dx * L * f, y + dy * L * f];
    // gai thuôn: chuỗi đĩa từ chân (bán kính w) tới chóp (0.6), nên chóp 1 px luôn có mặt (tam giác nhọn mất điểm chóp)
    const fm = mOr(mTri([bx - dy * w, by + dx * w], [bx + dy * w, by - dx * w], tip), tube([[bx, by, w * 0.8], [tip[0], tip[1], 0.6]]));
    // bậc sáng ở phía đón sáng (trái người xem) và khi nhìn ngang (gai nằm trên gáy sáng màu): tách khỏi đầu
    const lit = view === 'E' || s < 0;
    ctx.parts.push(part(`sfrill${i}`, mAndNot(fm, m), 'orange', ctx.zh - 0.1, { group: 'sfrill', flat: lit ? 3 : 2 }));
  });
}

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
  // mang má: gai nhọn sau hàm, chĩa về sau (rồng, chỉ nhìn ngang). Rồng Lửa: gai lửa mọi hướng (flameFrills).
  if (look.frill === 'flame') {
    flameFrills(ctx, m);
  } else if (look.frill === 'E' && view === 'E') {
    const L = lerp(2.0, 3.0, t);
    const x = hcx - hrx * 0.7;
    const y = hcy + hry * 0.38;
    const fm = mOr(mTri([x, y - 2.2], [x, y + 0.8], [x - L, y - 2.4]), mTri([x, y - 0.2], [x, y + 2.4], [x - (L - 0.6), y + 1.6]));
    ctx.parts.push(part('sfrill', mAndNot(fm, m), ramps.accent, ctx.zh - 0.1, { normal: [x - 1, y - 2, 3, 3] }));
  }
  // gờ mày (Rồng Lửa, nhìn trước): một nét cam sáng chếch lên ra ngoài trên mỗi mắt, như vảy mày rồng (gấu không có)
  if (look.brow && view === 'S') {
    const [ew, eh] = sk.big ? [3, 4] : [2, 3];
    const yb = Math.floor(sk.eyeY - eh / 2 + 0.5) - 1.5;
    for (const s of [-1, 1]) {
      const x0 = hcx + s * (sk.eyeDx - ew / 2 - 0.2);
      const x1 = hcx + s * (sk.eyeDx + ew / 2 + 1.1);
      const bm = mAnd(tube([[x0, yb + 0.1, 0.6], [x1, yb - 1.1, 0.6]]), m);
      ctx.parts.push(part(`sbrow${s}`, bm, 'orange', ctx.zh + 0.13, { group: 'head', flat: 3 }));
    }
  }
  // râu rồng: sợi mảnh từ hai bên mõm, vểnh ra ngoài rồi cong lên (nhìn ngang: một sợi rủ dưới hàm, uốn về sau;
  // nhìn sau: chỉ một mẩu ngắn rủ xuống sau má, không vểnh lên)
  if (look.whiskers) {
    const wz = view === 'N' ? ctx.zh - 0.2 : ctx.zh + 0.12;
    const y0 = sk.eyeY + lerp(2.6, 3.0, t);
    const w = lerp(0.55, 1, t); // độ dài phần râu ló ra ngoài đầu
    const lines = [];
    if (view === 'E') {
      const yb = hcy + hry;
      lines.push([[hcx + hrx * 0.45, yb - 1.2], [hcx + hrx * 0.1, yb + 0.9], [hcx - hrx * 0.3, yb + 1.6 * w], [hcx - hrx * (0.3 + 0.35 * w), yb + 0.9 * w], [hcx - hrx * (0.3 + 0.5 * w), yb - 0.6]]);
    } else if (view === 'N') {
      for (const s of [-1, 1]) {
        const hw = headHalfW(sk, y0);
        lines.push([[hcx + s * (hw - 1.5), y0 - 0.4], [hcx + s * (hw + 0.6), y0 + 0.4], [hcx + s * (hw + 0.6 + 1.1 * w), y0 + 0.6 + 1.5 * w]]);
      }
    } else {
      for (const s of [-1, 1]) {
        if (look.whiskers === 'flame') {
          // Rồng Lửa: râu má mọc từ má (ngoài mõm, không vắt ngang mõm), vươn ra rồi rủ xuống, dưới gai lửa
          lines.push([[hcx + s * hrx * 0.6, y0], [hcx + s * (hrx + 0.4), y0 + 0.5], [hcx + s * (hrx + 2.0 * w), y0 + 1.2 * w], [hcx + s * (hrx + 2.8 * w), y0 + 2.6 * w]]);
        } else {
          lines.push([[hcx + s * 3.2, y0], [hcx + s * 6.0, y0 + 0.7], [hcx + s * (hrx + 0.4), y0 + 0.6], [hcx + s * (hrx + 2.4 * w), y0 - 0.6 * w], [hcx + s * (hrx + 3.2 * w), y0 - 2.4 * w]]);
        }
      }
    }
    lines.forEach((pts, i) => {
      const wm = tube(pts.map(([x, y]) => [x, y, 0.62]));
      const shown = view === 'N' ? mAndNot(wm, m) : wm;
      ctx.parts.push(part(`swhisker${i}`, shown, ramps.belly, wz, { group: 'swhisker', flat: 3, line: false }));
      if (look.whiskers === 'flame') {
        // chóp râu là đốm lửa cam (Rồng Lửa)
        const [ex, ey] = pts[pts.length - 1];
        const tipM = mAnd(shown, mEllipse(ex, ey, view === 'N' ? 1.2 : 1.6, view === 'N' ? 1.2 : 1.6));
        ctx.parts.push(part(`swhisker${i}tip`, tipM, 'orange', wz + 0.001, { group: 'swhisker', flat: 2, line: false }));
      }
    });
  }
}

const SWAY = [0, 1, 1, 0, -1, -1];

/**
 * Móc cho bộ xương (SERP-03): skeleton.js gọi `archetype.anchors?.(sk, sp)` và dùng kết quả (a = sk.anchors).
 * Nhìn ngang: neo lưng (đồ lưng vẽ SAU pet) lùi về sau 1.2-2.2 px dọc sống lưng, ra khỏi chỗ gáy to che, tới chỗ lưng
 * thấp trước gù: đo trên hình đồ đeo mới (nhánh đồ đeo), món lưng dưới 30% so với Boba giảm 40 → 32 trên 264 ô, tỉ lệ
 * trung bình 0.70 → 0.84 (đưa neo lên đỉnh gù làm cánh nấp sau đuôi cuộn: tệ hơn). Nhìn trước/sau giữ nguyên: nâng hay hạ
 * neo đều không giúp áo choàng ở bé sơ sinh/nhí nhố (khoanh và đuôi chiếm chỗ hai bên ngực, xem ghi chú bàn giao).
 */
function anchors(sk, view, a) {
  if (view !== 'E') return a;
  return { ...a, back: [a.back[0] - lerp(1.2, 2.2, Math.min(1, growT(sk))), a.back[1]] };
}

export default {
  id: 'serpent',
  dims: { head: [11.4, 9.6], body: [5.4, 5.6], side: [5.4, 5.0], leg: 3.0, overlap: 3.6, fwd: 5.0, eShift: 2.0, neckE: 'head' },
  /** Dáng tự vẽ đuôi (thân nối liền thành đuôi): index.js bỏ qua tails[...] khi cờ này bật (SERP-01). */
  ownsTail: true,
  headZ: (view) => (view === 'N' ? 6 : 8),
  /** Đi uốn lượn: nhìn trước/sau thân lắc ngang 1 px (như dáng chim), nhìn ngang thì sóng chạy dọc thân (sideBody). */
  walkPose: (i, view) => ({ sway: view === 'S' || view === 'N' ? SWAY[i] : 0 }),
  anchors: (sk) => anchors(sk, sk.view, sk.anchors),
  body: { S: (ctx) => frontBody(ctx, false), E: sideBody, N: (ctx) => frontBody(ctx, true) },
  head: { S: head, E: head, N: head },
};
