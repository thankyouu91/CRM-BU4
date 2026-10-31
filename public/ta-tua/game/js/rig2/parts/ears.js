// Tai (và sừng, gạc, vây, mào trên đầu): sổ đăng ký theo `ears` của từng loài trong shared/pets.js. Chủ sở hữu: họa sĩ tai.
// Mỗi mục { S, E, N }: hàm vẽ nhận ctx, đẩy bộ phận tô bóng vào ctx.parts (và điểm vào ctx.pixels nếu cần).
// Tai nằm sau đầu khi nhìn trước/ngang (z = 2) và trước đầu khi nhìn sau (z = 7). ctx.pose.ear = 1 thì tai cụp/giật.
// Ngoại lệ nằm TRƯỚC đầu (z đầu + 0.05): tai cụp (cún, heo), đỉnh đầu đỏ của hạc, vây gần khi nhìn ngang; sừng mũi tê giác
// z đầu + 0.2 (trên mõm).
// Loại lạ (không có trong EARS) thì không vẽ gì (không bao giờ lỗi).
// TRẠNG THÁI: đủ 12 loại của shared/pets.js, không còn hình tạm (FALLBACK rỗng).
//   round, cat, bunny: port nguyên từ pets-pilot (khớp từng điểm ảnh với ảnh mẫu, ĐỪNG sửa: ảnh mẫu kiểm thử khóa chúng).
//   fox, tuft, mouse, floppy, horns, antler, crest, fin: vẽ mới cho Rig 2.0 (họa sĩ tai, 2026-10-31), xem từng hàm bên dưới.
// Tinh chỉnh theo loài nằm trong TUNE (không sửa pets.js): đầu chóp tai cáo, kiểu tai cụp, kiểu sừng/mào/vây, màu sừng.
import { mAbove, mAnd, mAndNot, mAny, mEllipse, mStamp, mTri, part } from '../core.js';

/**
 * Tinh chỉnh theo loài.
 * - tai tròn: scale (cỡ), spread (độ xòe ngang), drop (độ thấp).
 * - fox: tip = [dải màu, bậc] của chóp tai sẫm.
 * - floppy: floppy = 'dog' (tai dài rủ hai bên má, mặc định) | 'pig' (tai ngắn xòe rủ ra hai bên, lòng hồng).
 * - horns: horn = 'calf' (sừng nghé cong, mặc định) | 'dragon' (sừng rồng vuốt ra sau) | 'nub' (u sừng tê giác); nose: sừng mũi.
 * - antler, horns: hornRamp = dải màu sừng/gạc (mặc định theo hành, xem hornRamp()).
 * - crest: crest = 'comb' (mào gà trống, mặc định) | 'hen' (mào gà mái nhỏ) | 'cap' (đỉnh đầu đỏ của hạc) | 'plume' (chỏm lông vũ).
 * - fin: fin = 'fan' (vây quạt nhỏ, mặc định) | 'bigfan' (vây quạt lớn) | 'gills' (mang ngoài ba nhánh của kỳ giông).
 */
const TUNE = {
  boba: { scale: 0.78, spread: 0.8, drop: 0.62 }, // tai rái cá nhỏ, thấp, sát hai bên
  // ---- fox: chóp tai sẫm (sói xám: màu mặt nạ; cáo lửa: nâu gỗ như cáo đỏ thật; cáo lá: xanh rừng như chóp lá)
  soi_bac: { tip: ['slate', 2] },
  cao_lua: { tip: ['wood', 2] },
  cao_la: { tip: ['forest', 2] },
  // ---- floppy: cún tai dài rủ (mặc định); hai bé heo tai ngắn xòe rủ ra hai bên
  heo_than: { floppy: 'pig' },
  heo_dat: { floppy: 'pig' },
  // ---- horns
  rong_lua: { horn: 'dragon' },
  huyen_vu: { horn: 'dragon' },
  te_giac_da: { horn: 'nub', nose: true }, // tê giác: u sừng trên đầu + sừng mũi (nét nhận diện)
  // ---- crest
  ga_vang: { crest: 'hen' },
  hac_bac: { crest: 'cap' },
  ung_lua: { crest: 'plume' },
  chu_tuoc: { crest: 'plume' },
  // ---- fin
  ca_chep_rong: { fin: 'bigfan' },
  ky_giong: { fin: 'gills' },
};
const tune = (ctx) => TUNE[ctx.sp.id] ?? {};
const zBack = (view) => (view === 'N' ? 7 : 2);

/**
 * Tai tròn. Loài hoa văn 'patch' (gấu trúc) có tai màu điểm nhấn (đen), không có lòng tai hồng: cùng màu với mảng mắt và
 * tay chân (ramps.js gau_truc limb), để bé vẫn nhận ra là gấu trúc chứ không phải gấu trắng.
 */
function roundEars(ctx) {
  const { sk, view, pose, ramps, sp } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const t = tune(ctx);
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const r = ((2.9 * sk.hk) / 0.92) * 0.95 * (t.scale ?? 1);
  const dark = sp.pattern === 'patch';
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
    ctx.parts.push(part(`ear${s}`, mEllipse(ex, ey, r, r), dark ? ramps.accent : ramps.main, zb, { normal: [ex, ey, r, r] }));
    if (view !== 'N' && !dark) {
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

// ================================================================ Rig 2.0: các loại tai vẽ mới (họa sĩ tai)
// Cùng luật với bản mẫu: bộ phận tô bóng theo dải màu của loài, sáng từ trên-trái, viền ngoài do pipeline vẽ.
// Hình nhỏ có chi tiết (sừng, gạc, mào, vây) vẽ tay bằng bản đồ ký tự (mStamp) rồi tô bóng như mọi bộ phận;
// tai to (cáo, cú, chuột, tai cụp) dựng bằng hình học theo cỡ đầu, như tai mèo của bản mẫu.

/** Hệ số cỡ đầu: 1 ở trưởng thành cấp 1 (sơ sinh ≈ 0.91, cấp 50 ≈ 1.07). Đầu gần như cùng cỡ ở mọi tuổi. */
const kOf = (sk) => sk.hk / 0.92;
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** Tuổi của sừng/gạc theo cỡ người: 0 sơ sinh, 1 nhí, 2 từ thiếu niên trở lên (bé lớn lên thì gạc cũng lớn). */
const ageOf = (ctx) => (ctx.st.scale < 0.68 ? 0 : ctx.st.scale < 0.8 ? 1 : 2);

/** Mép trên của khối đầu (siêu elip n = 2.25) ở cột lệch `dx` so với tâm đầu: gốc sừng/gạc cắm đúng vào đầu ở mọi tuổi. */
function surfY(sk, dx) {
  const [, hcy, hrx, hry] = sk.head;
  const u = Math.min(0.97, Math.abs(dx) / hrx);
  return hcy - hry * (1 - u ** 2.25) ** (1 / 2.25);
}

/** Cột điểm gốc bên phải (s = 1) hoặc bên trái (s = -1) cách tâm đầu `d`: hai bên đối xứng đúng từng điểm ảnh. */
function pairCol(hcx, d, s) {
  const r = Math.floor(hcx + d);
  return s > 0 ? r : Math.floor(2 * hcx) - 1 - r;
}

/**
 * Hình vẽ tay → bộ phận tô bóng. art = { rows, ax, ay }: các hàng cùng độ dài, (ax, ay) = điểm gốc trong hình (chỗ mọc ra
 * khỏi đầu), đặt vào ô (col, row) của khung; flip = lật ngang. keys: ký tự → [dải màu, bậc cố định hoặc null = tô theo khối].
 * Ánh sáng tính theo khối elip bao quanh hình (lệch lên-trái), nên hình lật vẫn sáng từ trên-trái như mọi bộ phận khác.
 */
function stampAt(ctx, name, art, col, row, flip, z, keys, shade = 0) {
  const { rows, ax, ay } = art;
  const w = rows[0].length;
  const h = rows.length;
  const x0 = col - (flip ? w - 1 - ax : ax);
  const y0 = row - ay;
  const nrm = [x0 + w * 0.4, y0 + h * 0.35, w * 0.6 + 1.2, h * 0.6 + 1.2];
  for (const [ch, [ramp, flat]] of Object.entries(keys)) {
    const m = mStamp(rows, ch, x0, y0, flip);
    if (mAny(m)) ctx.parts.push(part(`${name}${ch}`, m, ramp, z, { group: name, normal: nrm, flat, shade }));
  }
}

/** Dải màu sừng và gạc: như rig.js cũ theo hành (Kim bạc ánh băng, Hỏa vàng nắng, còn lại kem ngà); TUNE.hornRamp đổi riêng. */
function hornRamp(ctx) {
  const t = tune(ctx);
  if (t.hornRamp) return t.hornRamp;
  return ctx.sp.element === 'kim' ? 'ice' : ctx.sp.element === 'hoa' ? 'butter' : 'wheat';
}

// ---------------------------------------------------------------- fox: tai cáo cao, nhọn, chóp sẫm (cáo lá, cáo lửa, sói bạc)

/**
 * Cao và hẹp hơn tai mèo, dựng gần thẳng, lòng tai lông màu bụng (mèo: hồng), chóp tai sẫm (TUNE.tip, mặc định bậc tối của
 * thân). Nhìn sau: mặt lưng tai màu thân, chóp sẫm dài hơn. Giật tai (pose.ear): tai phải cụp xuống 1 px, chóp nghiêng ra.
 */
function foxEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const t = tune(ctx);
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const k = kOf(sk);
  const h = 11.2 * k;
  const w = 6.0 * k;
  const [tipRamp, tipStep] = t.tip ?? [ramps.main, 1];
  const sides = view !== 'E' ? [-1, 1] : [1, -1];
  for (const s of sides) {
    let a;
    let b;
    let c;
    let z = zb;
    let sh = 0;
    if (view === 'E') {
      // tai gần ở sau đỉnh đầu, tai xa ló ra phía gáy
      const base = hcx - hrx * (s > 0 ? 0.16 : 0.55);
      const y0 = hcy - hry * 0.5;
      a = [base - w * 0.55, y0];
      b = [base + w * 0.55, y0];
      c = [base - w * 0.12 - tw, y0 - h + tw];
      if (s < 0) [z, sh] = [zb - 0.5, -1];
    } else {
      const ox = hcx + s * hrx * 0.55;
      const y0 = hcy - hry * 0.46 + (s > 0 ? tw : 0);
      a = [ox - s * w * 0.66, y0 - 0.9];
      b = [ox + s * w * 0.62, y0 + 0.7];
      c = [ox + s * (w * 0.16 + (s > 0 ? tw : 0)), y0 - h];
    }
    const g = `ear${s}`;
    const m = mTri(a, b, c);
    ctx.parts.push(part(g, m, ramps.main, z, { normal: [c[0] - 0.5, (a[1] + c[1]) / 2 - 1, w, h], shade: sh }));
    if (view === 'S' || (view === 'E' && s > 0)) {
      const ia = lerp(a, c, 0.32);
      const ib = lerp(b, c, 0.32);
      const inner = mAnd(m, mTri([ia[0], ia[1] + 0.3], [ib[0], ib[1] + 0.3], [c[0], c[1] + 3.2 * k]));
      ctx.parts.push(part(`${g}in`, inner, ramps.belly, z + 0.1, { group: g, flat: 2 }));
    }
    const tip = mAnd(m, mAbove(c[1] + (view === 'N' ? 3.8 : 3.0) * k));
    ctx.parts.push(part(`${g}tip`, tip, tipRamp, z + 0.2, { group: g, flat: tipStep, shade: sh }));
  }
}

// ---------------------------------------------------------------- tuft: chỏm lông tai của cú (cú ánh kim)

/**
 * Hai chỏm lông nhọn ở hai góc đỉnh đầu, chĩa lên và xòe ra ngoài; mỗi chỏm có một ngọn lông ngắn phía trong (khía chữ V),
 * để nhìn là lông vũ chứ không phải tai mèo. Màu thân. Giật tai: chỏm phải rủ 1 px.
 */
function tuftEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, , hrx] = sk.head;
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const k = kOf(sk);
  const up = 4.6 * k;
  const sides = view !== 'E' ? [-1, 1] : [1, -1];
  for (const s of sides) {
    let outer;
    let inner;
    let nrm;
    let z = zb;
    let sh = 0;
    if (view === 'E') {
      // chỏm gần ngả về gáy, có ngọn trong; chỏm xa (chỉ ngọn ngoài) ló phía trước một chút, tối hơn
      const bx = hcx - hrx * (s > 0 ? 0.3 : 0.02);
      const by = surfY(sk, bx - hcx) + 2.0;
      const tip = [bx - 3.0 * k - (s > 0 ? tw : 0), sk.htop - up + (s > 0 ? 0.6 + tw : 1.8)];
      outer = mTri([bx + 1.8 * k, by], [bx - 2.4 * k, by + 0.6], tip);
      inner = s > 0 ? mTri([bx + 2.0 * k, by], [bx - 0.2, by], [bx + 0.6, sk.htop - up * 0.45]) : outer;
      nrm = [tip[0] + 1, (by + tip[1]) / 2 - 1, 3.4 * k, up + 1];
      if (s < 0) [z, sh] = [zb - 0.5, -1];
    } else {
      const hy = s > 0 ? tw : 0;
      const tip = [hcx + s * (hrx * 0.96 + 0.4), sk.htop - up + hy];
      const inA = hcx + s * hrx * 0.4;
      const outB = hcx + s * hrx * 0.86;
      const yA = surfY(sk, inA - hcx) + 1.6;
      const yB = surfY(sk, outB - hcx) + 1.4;
      outer = mTri([inA, yA], [outB, yB], tip);
      inner = mTri([inA - s * 0.4, yA], [hcx + s * hrx * 0.66, yA], [hcx + s * hrx * 0.52, sk.htop - up * 0.5 + hy]);
      nrm = [tip[0] - s * 1.5, (yA + tip[1]) / 2 - 1, hrx * 0.45, up + 1.5];
    }
    // ngọn ngoài dài màu thân; ngọn trong ngắn tối một bậc (lớp lông thứ hai), cùng nhóm nên không kẻ nét giữa hai ngọn
    ctx.parts.push(part(`tuft${s}`, outer, ramps.main, z, { normal: nrm, shade: sh }));
    ctx.parts.push(part(`tuft${s}b`, mAndNot(inner, outer), ramps.main, z, { group: `tuft${s}`, normal: nrm, shade: sh - 1 }));
  }
}

// ---------------------------------------------------------------- mouse: tai chuột to tròn (chuột chuông)

/**
 * Tai tròn TO (gần gấp rưỡi tai tròn), đặt cao ở hai góc đầu kiểu chuột, lòng tai hồng rộng (vành mỏng). Nhìn ngang: tai
 * gần quay về trước (thấy lòng tai), tai xa ló sau gáy, tối hơn. Giật tai: tai phải hạ 1 px.
 */
function mouseEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const k = kOf(sk);
  const r = 4.4 * k;
  const list = view === 'E'
    ? [[-1, hcx - hrx * 0.62, hcy - hry * 0.9, zb - 0.5, -1], [1, hcx - hrx * 0.24, hcy - hry * 0.84, zb, 0]]
    : [[-1, hcx - hrx * 0.74, hcy - hry * 0.76, zb, 0], [1, hcx + hrx * 0.74, hcy - hry * 0.76 + tw, zb, 0]];
  for (const [s, ex, ey, z, sh] of list) {
    const g = `ear${s}`;
    const nrm = [ex - 0.8, ey - 0.8, r + 0.8, r + 0.8];
    ctx.parts.push(part(g, mEllipse(ex, ey, r, r), ramps.main, z, { normal: nrm, shade: sh }));
    if (view === 'S' || (view === 'E' && s > 0)) {
      const ir = r - 1.45;
      const ix = view === 'E' ? ex + 0.45 : ex + s * 0.4;
      ctx.parts.push(part(`${g}in`, mEllipse(ix, ey + 0.5, ir, ir), ramps.inner, z + 0.1, { group: g, normal: nrm }));
    }
  }
}

// ---------------------------------------------------------------- floppy: tai cụp (cún cỏ; heo than, heo đất)

/**
 * Cún (mặc định): tai dài, mềm, rủ hai bên má từ góc đỉnh đầu, nằm TRƯỚC đầu (z đầu + 0.05), màu thân tối một bậc (như rig.js
 * cũ). Buồn/giật tai (pose.ear): tai rủ thấp hơn và khép vào. Nhìn ngang: một tai che bên đầu sau mắt.
 */
function dogEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const k = kOf(sk);
  const dr = pose.ear ?? 0;
  const rx = 2.7 * k;
  const ry = 5.4 * k;
  const z = view === 'N' ? 7 : ctx.zh + 0.05;
  const list = view === 'E'
    ? [[1, hcx - hrx * 0.3, hcy - hry * 0.14 + dr * 0.6, 0.3 - dr * 0.1]]
    : [-1, 1].map((s) => [s, hcx + s * (hrx * 0.9 - dr * 0.3), hcy - hry * 0.16 + dr * 0.6, -s * (0.3 - dr * 0.1)]);
  for (const [s, ex, ey, rot] of list) {
    const m = mEllipse(ex, ey, rx, ry, rot);
    ctx.parts.push(part(`ear${s}`, m, ramps.main, z, { normal: [ex - 1.2, ey - 2.5, rx + 1.6, ry + 1.6], shade: -1 }));
  }
}

/**
 * Heo: tai ngắn, mềm, mọc ở hai góc đỉnh đầu rồi XÒE RỦ ra hai bên (chóp chúc xuống ra ngoài mép đầu), nằm trước
 * đầu, lòng tai hồng hé ở mép dưới. Khác tai cún (dài, rủ thẳng dọc má) và tai mèo (dựng). Nhìn ngang: một tai gần rủ
 * ra sau trên đỉnh đầu (tai xa khuất sau đầu: ló ra thì thành chỏm nhọn trên đỉnh). Nhìn sau: hai tai xòe, không có
 * lòng tai. Buồn/giật tai: tai rủ thấp và cụp xuống thêm.
 */
function pigEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, , hrx] = sk.head;
  const k = kOf(sk);
  const dr = pose.ear ?? 0;
  const rx = 2.3 * k;
  const ry = 4.1 * k;
  const z = view === 'N' ? 7 : ctx.zh + 0.05;
  const list = view === 'E'
    ? [[1, hcx - hrx * 0.42, surfY(sk, -hrx * 0.42) + 1.6 + dr * 0.6, 0.75 + dr * 0.2]]
    : [-1, 1].map((s) => [s, hcx + s * (hrx * 0.84 + 0.4), surfY(sk, hrx * 0.84) + 1.0 + dr * 0.6, -s * (0.95 + dr * 0.25)]);
  for (const [s, ex, ey, rot] of list) {
    const g = `ear${s}`;
    const m = mEllipse(ex, ey, rx, ry, rot);
    const nrm = [ex - 1.2, ey - 1.6, rx + 2, ry + 1.2];
    ctx.parts.push(part(g, m, ramps.main, z, { normal: nrm }));
    if (view === 'N') continue;
    // lòng tai hồng hé ở nửa dưới (mặt trong của vạt tai đang rủ)
    const off = view === 'E' ? [-0.5, 0.9] : [s * 0.35, 1.0];
    const inner = mAnd(m, mEllipse(ex + off[0], ey + off[1], rx - 0.9, ry - 1.3, rot));
    ctx.parts.push(part(`${g}in`, inner, ramps.inner, z + 0.1, { group: g, flat: 2 }));
  }
}

const floppyEars = (ctx) => (tune(ctx).floppy === 'pig' ? pigEars(ctx) : dogEars(ctx));

// ---------------------------------------------------------------- horns: sừng nhỏ cong (nghé đất, tê giác đá, rồng lửa, huyền vũ)

/**
 * Hình vẽ tay theo kiểu sừng (TUNE.horn) và tuổi (sơ sinh chỉ là hai u sừng). S: sừng PHẢI (bên trái là hình lật),
 * E: sừng gần (sừng xa = cùng hình, lệch theo far, tối hơn). (ax, ay) = gốc sừng, cắm 1 px vào mép đầu.
 */
const HORN_ART = {
  calf: {
    d: 0.42, // gốc cách tâm đầu (theo bề ngang đầu)
    dE: -0.08, // gốc sừng gần khi nhìn ngang (âm = về phía gáy)
    far: [-3, -1], // sừng xa lệch so với sừng gần khi nhìn ngang
    S: [
      { rows: ['.a', 'aa', 'aa'], ax: 0, ay: 2 },
      { rows: ['...a', '..aa', 'aaa.', 'aa..'], ax: 0, ay: 3 },
      { rows: ['....a', '...aa', '..aaa', 'aaaa.', 'aaa..'], ax: 0, ay: 4 },
    ],
    E: [
      { rows: ['.a', 'aa', 'aa'], ax: 0, ay: 2 },
      { rows: ['..a', '.aa', 'aa.', 'a..'], ax: 0, ay: 3 },
      { rows: ['..a', '.aa', 'aaa', 'aa.', 'aa.'], ax: 0, ay: 4 },
    ],
  },
  dragon: {
    d: 0.42,
    dE: -0.3, // vuốt ra sau gáy, chừa đỉnh đầu cho lửa
    far: [2, -1],
    S: [
      { rows: ['.a', 'aa', 'aa'], ax: 0, ay: 2 },
      { rows: ['...a', '..aa', '.aa.', 'aaa.'], ax: 0, ay: 3 },
      { rows: ['.....a', '....aa', '...aa.', '..aaa.', '.aaa..', 'aaa...'], ax: 0, ay: 5 },
    ],
    E: [
      { rows: ['a.', 'aa', 'aa'], ax: 1, ay: 2 },
      { rows: ['a...', '.aa.', '..aa', '..aa'], ax: 3, ay: 3 },
      { rows: ['a.....', '.aa...', '..aaa.', '...aaa', '....aa'], ax: 5, ay: 4 },
    ],
  },
  nub: {
    d: 0.46,
    dE: -0.15,
    far: [-3, -1],
    S: [
      { rows: ['aa', 'aa'], ax: 0, ay: 1 },
      { rows: ['.a', 'aa', 'aa'], ax: 0, ay: 2 },
      { rows: ['.a.', 'aaa', 'aaa'], ax: 1, ay: 2 },
    ],
    E: [
      { rows: ['aa', 'aa'], ax: 0, ay: 1 },
      { rows: ['a.', 'aa', 'aa'], ax: 0, ay: 2 },
      { rows: ['.a.', 'aaa', 'aaa'], ax: 1, ay: 2 },
    ],
  },
};

/** Sừng mũi tê giác (TUNE.nose): nón ngà mọc từ sống mũi lên giữa hai mắt, trước mõm (z đầu + 0.2); nhìn trước và ngang. */
const NOSE_HORN = {
  S: [
    { rows: ['.aa.', '.aa.', 'aaaa'], ax: 1, ay: 2 },
    { rows: ['.aa.', '.aa.', 'aaaa', 'aaaa'], ax: 1, ay: 3 },
    { rows: ['.aa.', '.aa.', '.aa.', 'aaaa', 'aaaa'], ax: 1, ay: 4 },
  ],
  E: [
    { rows: ['.a', 'aa'], ax: 0, ay: 1 },
    { rows: ['..a', '.aa', 'aaa'], ax: 0, ay: 2 },
    { rows: ['...a', '..aa', '.aaa', 'aaa.'], ax: 0, ay: 3 },
  ],
};

function hornEars(ctx) {
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const t = tune(ctx);
  const set = HORN_ART[t.horn] ?? HORN_ART.calf;
  const age = ageOf(ctx);
  const keys = { a: [hornRamp(ctx), null] };
  const zb = zBack(view);
  if (view === 'E') {
    const art = set.E[age];
    const col = Math.floor(hcx + hrx * set.dE);
    const row = Math.floor(surfY(sk, col + 0.5 - hcx)) + 1;
    stampAt(ctx, 'hornF', art, col + set.far[0], row + set.far[1], false, zb - 0.5, keys, -1);
    stampAt(ctx, 'hornN', art, col, row, false, zb, keys);
  } else {
    for (const s of [-1, 1]) {
      const col = pairCol(hcx, hrx * set.d, s);
      const row = Math.floor(surfY(sk, hrx * set.d)) + 1;
      stampAt(ctx, `horn${s}`, set.S[age], col, row, s < 0, zb, keys);
    }
  }
  if (t.nose && view !== 'N') {
    const { eyeY } = sk;
    if (view === 'S') {
      stampAt(ctx, 'nosehorn', NOSE_HORN.S[age], Math.floor(hcx) - 1, Math.floor(eyeY + 0.3), false, ctx.zh + 0.2, keys);
    } else {
      stampAt(ctx, 'nosehorn', NOSE_HORN.E[age], Math.floor(hcx + hrx * 0.74), Math.floor(eyeY + 0.9), false, ctx.zh + 0.2, keys);
    }
  }
}

// ---------------------------------------------------------------- antler: gạc chẽ nhánh (hươu pha lê, hươu rêu, kỳ lân, thanh long, hoàng long)

/**
 * Gạc lớn theo tuổi: sơ sinh là chạc nhỏ, nhí chẽ đôi, từ thiếu niên ba nhánh. S: gạc PHẢI (trái = lật), nhánh 1 px như
 * gạc thật, viền chen giữa các nhánh. E: gạc gần trên đỉnh đầu, nhánh chĩa lên trước; gạc xa nhỏ hơn một tuổi, lùi 3 px
 * về gáy, tối hơn.
 */
const ANTLER_ART = {
  S: [
    { rows: ['a.a', '.a.', '.a.'], ax: 1, ay: 2 },
    { rows: ['a..a.', 'a.a.a', '.aaa.', '..a..', '..a..'], ax: 2, ay: 4 },
    { rows: ['.a...a.', '.a..a..', '..a.a.a', '..aaaa.', '...aa..', '...a...', '...a...'], ax: 3, ay: 6 },
  ],
  E: [
    { rows: ['a.a', '.a.', '.a.'], ax: 1, ay: 2 },
    { rows: ['.a..a', 'a.a.a', '.aaa.', '..a..', '..a..'], ax: 2, ay: 4 },
    { rows: ['.a...a.', '..a..a.', 'a.a.a..', '.aaaa..', '..aa...', '...a...', '...a...'], ax: 3, ay: 6 },
  ],
  d: 0.4,
};

function antlerEars(ctx) {
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const age = ageOf(ctx);
  const keys = { a: [hornRamp(ctx), null] };
  const zb = zBack(view);
  if (view === 'E') {
    // gạc xa: nhỏ hơn một tuổi, lùi về gáy, tối hơn (đỡ rối hơn hai gạc cùng cỡ chồng lên nhau)
    const col = Math.floor(hcx - hrx * 0.12);
    const row = Math.floor(surfY(sk, col + 0.5 - hcx)) + 1;
    stampAt(ctx, 'antlerF', ANTLER_ART.E[Math.max(0, age - 1)], col - 3, row - 1, false, zb - 0.5, keys, -1);
    stampAt(ctx, 'antlerN', ANTLER_ART.E[age], col, row, false, zb, keys);
    return;
  }
  for (const s of [-1, 1]) {
    const col = pairCol(hcx, hrx * ANTLER_ART.d, s);
    const row = Math.floor(surfY(sk, hrx * ANTLER_ART.d)) + 1;
    stampAt(ctx, `antler${s}`, ANTLER_ART.S[age], col, row, s < 0, zb, keys);
  }
}

// ---------------------------------------------------------------- crest: mào và chỏm lông trên đầu chim (gà, hạc, ưng, chu tước)

/**
 * Mào màu điểm nhấn (như rig.js cũ). comb: mào gà trống (nhìn ngang ba răng, nhìn trước lưỡi mào hẹp); hen: mào gà mái nhỏ;
 * plume: chỏm lông vũ vuốt ra sau gáy, nhìn trước xòe hai bên (giữa để trống cho đặc điểm lửa trên đỉnh đầu); cap: đỉnh đầu
 * đỏ của hạc (mảng màu trên đầu, gồ nhẹ khỏi đỉnh). Đội mũ thì mào giấu dưới mũ (như đặc điểm trên đỉnh đầu).
 * S/N: hình đối xứng, bề ngang chẵn, đặt giữa trục đầu. E: gốc ở đỉnh đầu, hơi về trước.
 */
const CREST_ART = {
  comb: {
    S: { rows: ['.aa.', 'aaaa', 'aaaa', 'aaaa'], ax: 1, ay: 3 },
    E: { rows: ['.a.a.a.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.'], ax: 3, ay: 3 },
    dE: 0.12,
  },
  hen: {
    S: { rows: ['.aa.', 'aaaa', 'aaaa'], ax: 1, ay: 2 },
    E: { rows: ['.a.a.', 'aaaaa', '.aaa.'], ax: 2, ay: 2 },
    dE: 0.18,
  },
  plume: {
    S: { rows: ['a......a', 'aa.aa.aa', '.aaaaaa.', '..aaaa..'], ax: 3, ay: 3 },
    E: { rows: ['aa......', '.aaa....', 'a..aaa..', '.aaa.aaa', '...aaaaa'], ax: 6, ay: 4 },
    dE: -0.05,
  },
};

function crestEars(ctx) {
  if (ctx.wear.head) return;
  const { sk, view, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const kind = tune(ctx).crest ?? 'comb';
  if (kind === 'cap') {
    // đỉnh đầu đỏ: mảng màu điểm nhấn trên đỉnh, nhô 1 px khỏi mép đầu (nhìn sau cũng thấy)
    const cx = view === 'E' ? hcx + hrx * 0.12 : hcx;
    const head = mEllipse(hcx, hcy - 1.0, hrx, hry, 0, 2.25);
    const cap = mAnd(head, mEllipse(cx, sk.htop + 1.4, view === 'E' ? 3.6 : 3.4, 2.6));
    // cùng nhóm 'head': mảng màu vẽ lên đầu (không kẻ nét trong), viền ngoài ôm theo chỗ gồ
    ctx.parts.push(part('cap', cap, ramps.accent, ctx.zh + 0.05, { group: 'head', flat: 2 }));
    return;
  }
  const set = CREST_ART[kind] ?? CREST_ART.comb;
  const keys = { a: [ramps.accent, null] };
  if (view === 'E') {
    const col = Math.floor(hcx + hrx * set.dE);
    stampAt(ctx, 'crest', set.E, col, Math.floor(surfY(sk, col + 0.5 - hcx)) + 1, false, 2, keys);
  } else {
    const col = Math.floor(hcx) - 1;
    stampAt(ctx, 'crest', set.S, col, Math.floor(sk.htop) + (view === 'N' ? 2 : 1), false, zBack(view), keys);
  }
}

// ---------------------------------------------------------------- fin: vây và mang trên đầu (cá nóc, cá chép rồng, kỳ giông)

/**
 * Vây màu điểm nhấn (như rig.js cũ) ở hai bên đầu, sau đầu. fan: vây quạt ba tia nhỏ (cá nóc); bigfan: vây quạt bốn tia
 * (cá chép rồng); gills: mang ngoài ba nhánh xòe của kỳ giông (nét nhận diện của axolotl). S/N: vây PHẢI, bên trái lật.
 * E: vây gần cắm ở mép sau của đầu (trước đầu) rồi xòe ra sau gáy, vây xa ló cao hơn, tối hơn. Giật tai: vây phẩy lên 1 px.
 */
const FIN_ART = {
  fan: { rows: ['..aa', '.aa.', 'aaaa', '.aa.', '..aa'], ax: 0, ay: 2, dy: 0.1 },
  bigfan: { rows: ['...aa', '..aa.', '.aaaa', 'aaaa.', '.aaaa', '..aa.', '...aa'], ax: 0, ay: 3, dy: 0.25 },
  gills: { rows: ['...aa', '..aa.', '.a...', 'aaaaa', '.a...', '..aa.', '...aa'], ax: 0, ay: 3, dy: 0.3 },
};

function finEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const art = FIN_ART[tune(ctx).fin] ?? FIN_ART.fan;
  const tw = pose.ear ?? 0;
  const keys = { a: [ramps.accent, null] };
  const row = Math.floor(hcy - hry * art.dy);
  if (view === 'E') {
    // vây gần: gốc áp lên mép sau của đầu (trước đầu), quạt xòe ra sau gáy; vây xa ló cao hơn 2 px sau đầu, tối hơn
    const col = Math.floor(hcx - hrx) + 2;
    stampAt(ctx, 'finF', art, col + 1, row - 2, true, 2, keys, -1);
    stampAt(ctx, 'finN', art, col, row - tw, true, ctx.zh + 0.05, keys);
    return;
  }
  for (const s of [-1, 1]) {
    const col = pairCol(hcx, hrx - 1.2, s);
    stampAt(ctx, `fin${s}`, art, col, row - (s > 0 ? tw : 0), s < 0, 2, keys);
  }
}

// ---------------------------------------------------------------- sổ đăng ký

const none = () => {};
const all = (fn) => ({ S: fn, E: fn, N: fn });

/** Sổ đăng ký: loại tai → { S, E, N }. Đủ 12 loại `ears` của shared/pets.js. */
export const EARS = {
  none: all(none),
  round: all(roundEars),
  cat: all((ctx) => catEars(ctx)),
  bunny: all(bunnyEars),
  fox: all(foxEars),
  tuft: all(tuftEars),
  mouse: all(mouseEars),
  floppy: all(floppyEars),
  horns: all(hornEars),
  antler: all(antlerEars),
  crest: all(crestEars),
  fin: all(finEars),
};

/** Loại tai còn dùng hình tạm: không còn loại nào (giữ lại để index.js và libraryStatus() đọc). */
export const FALLBACK = {};

/** Mục vẽ cho loại tai `kind` (không bao giờ undefined). */
export const earsFor = (kind) => EARS[kind] ?? FALLBACK[kind] ?? EARS.none;
