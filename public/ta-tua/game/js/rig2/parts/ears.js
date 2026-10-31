// Tai (và sừng, gạc, vây, mào trên đầu): sổ đăng ký theo `ears` của từng loài trong shared/pets.js. Chủ sở hữu: họa sĩ tai.
// Mỗi mục { S, E, N }: hàm vẽ nhận ctx, đẩy bộ phận tô bóng vào ctx.parts (và điểm vào ctx.pixels nếu cần).
// Tai nằm sau đầu khi nhìn trước/ngang (z = 2) và trước đầu khi nhìn sau (z = 7). ctx.pose.ear = 1 thì tai cụp/giật.
// Ngoại lệ nằm TRƯỚC đầu (z đầu + 0.05): tai cụp (cún, heo), đỉnh đầu đỏ của hạc, vây gần khi nhìn ngang.
// Sừng, gạc, chỏm lông cú: lớn theo GIAI ĐOẠN TUỔI (ageOf: sơ sinh, nhí, từ thiếu niên), không theo cấp.
// Loại lạ (không có trong EARS) thì không vẽ gì (không bao giờ lỗi).
// TRẠNG THÁI: đủ 12 loại của shared/pets.js, không còn hình tạm (FALLBACK rỗng).
//   round, cat, bunny: port nguyên từ pets-pilot (khớp từng điểm ảnh với ảnh mẫu, ĐỪNG sửa: ảnh mẫu kiểm thử khóa chúng).
//   fox, tuft, mouse, floppy, horns, antler, crest, fin: vẽ mới cho Rig 2.0 (họa sĩ tai, 2026-10-31), xem từng hàm bên dưới.
//   Sửa sau duyệt (2026-10-31): sừng tê giác dựng cao (bỏ sừng mũi), gạc thành đôi chữ V tách hẳn, sừng rồng ngắn chừa khe
//   cho lửa, chỏm cú chẻ ngọn chĩa ra ngoài, chóp tai cáo theo phần tai ló, mào gà mái cao hơn, chỏm chu tước vàng nghệ,
//   lòng tai chuột, tai heo và vây cá nóc nhìn ngang ló khỏi mép đầu.
// Tinh chỉnh theo loài nằm trong TUNE (không sửa pets.js): đầu chóp tai cáo, kiểu tai cụp, kiểu sừng/mào/vây, màu sừng/mào.
import { mAbove, mAnd, mAndNot, mAny, mEllipse, mStamp, mTri, part } from '../core.js';
import { LIFE_STAGES } from '../../shared/pets.js';

/**
 * Tinh chỉnh theo loài.
 * - tai tròn: scale (cỡ), spread (độ xòe ngang), drop (độ thấp).
 * - fox: tip = [dải màu, bậc] của chóp tai sẫm.
 * - floppy: floppy = 'dog' (tai dài rủ hai bên má, mặc định) | 'pig' (tai ngắn xòe rủ ra hai bên, lòng hồng).
 * - horns: horn = 'calf' (sừng nghé cong, mặc định) | 'dragon' (sừng rồng cong ra rồi lên) | 'nub' (sừng chóp mập của tê giác).
 * - antler, horns: hornRamp = dải màu sừng/gạc (mặc định theo hành, xem hornRamp()).
 * - crest: crest = 'comb' (mào gà trống, mặc định) | 'hen' (mào gà mái nhỏ) | 'cap' (đỉnh đầu đỏ của hạc) | 'plume' (chỏm lông vũ);
 *   crestRamp = dải màu mào (mặc định: điểm nhấn của loài).
 * - fin: fin = 'fan' (vây quạt nhỏ, mặc định) | 'bigfan' (vây quạt lớn) | 'gills' (mang ngoài ba nhánh của kỳ giông).
 */
const TUNE = {
  boba: { scale: 0.78, spread: 0.8, drop: 0.62 }, // tai rái cá nhỏ, thấp, sát hai bên
  // ---- fox: chóp tai sẫm (sói xám: màu mặt nạ; cáo lửa: nâu gỗ như cáo đỏ thật; cáo lá: xanh rừng đậm, bậc 1 cho nổi trên thân cỏ)
  soi_bac: { tip: ['slate', 2] },
  cao_lua: { tip: ['wood', 2] },
  cao_la: { tip: ['forest', 1] },
  // ---- floppy: cún tai dài rủ (mặc định); hai bé heo tai ngắn xòe rủ ra hai bên
  heo_than: { floppy: 'pig' },
  heo_dat: { floppy: 'pig' },
  // ---- horns
  rong_lua: { horn: 'dragon' },
  huyen_vu: { horn: 'dragon' },
  te_giac_da: { horn: 'nub' }, // tê giác: hai sừng chóp mập dựng thẳng (rig.js cũ không có sừng mũi)
  // ---- antler: thân màu nhạt (kem, vàng) thì gạc màu nâu da bò cho nổi; hươu pha lê gạc xanh pha lê trên thân trắng tuyết
  ky_lan: { hornRamp: 'tan' },
  hoang_long: { hornRamp: 'tan' },
  huou_pha_le: { hornRamp: 'sky' },
  // ---- crest
  ga_vang: { crest: 'hen' },
  hac_bac: { crest: 'cap' },
  ung_lua: { crest: 'plume' },
  chu_tuoc: { crest: 'plume', crestRamp: 'gold' }, // chỏm vàng nghệ: màu điểm nhấn 'butter' gần trắng, đọc thành nơ trắng
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

/**
 * Tuổi của sừng, gạc, chỏm lông: 0 sơ sinh, 1 nhí, 2 từ thiếu niên trở lên. Đọc giai đoạn từ dáng (head, eye, leg của
 * LIFE_STAGES): cấp (LEVEL_FORMS.grow) chỉ nhân `scale`, nên bé sơ sinh cấp 50 vẫn mang sừng sơ sinh. Dáng lạ (không khớp
 * giai đoạn nào): theo scale, mép nằm giữa các dải đã lớn theo cấp (sơ sinh 0.62..0.713, nhí 0.74..0.851, thiếu niên từ
 * 0.86); đổi scale của LIFE_STAGES hay grow của LEVEL_FORMS thì xem lại hai mép 0.73 và 0.855.
 */
const AGE_OF_STAGE = { baby: 0, kid: 1 };
function ageOf(ctx) {
  const { st } = ctx;
  const hit = LIFE_STAGES.find(({ look }) => look.head === st.head && look.eye === st.eye && look.leg === st.leg);
  if (hit) return AGE_OF_STAGE[hit.key] ?? 2;
  return st.scale < 0.73 ? 0 : st.scale < 0.855 ? 1 : 2;
}

/** Mép trên của khối đầu (siêu elip n = 2.25) ở cột lệch `dx` so với tâm đầu: gốc sừng/gạc cắm đúng vào đầu ở mọi tuổi. */
function surfY(sk, dx) {
  const [, hcy, hrx, hry] = sk.head;
  const u = Math.min(0.97, Math.abs(dx) / hrx);
  return hcy - hry * (1 - u ** 2.25) ** (1 / 2.25);
}

/** Hàng đầu tiên của khối đầu ở cột lệch `dx` (tâm điểm ảnh nằm dưới mép đầu): gốc cắm `sink` hàng vào đầu (1 = hàng đầu tiên). */
const rootRow = (sk, dx, sink = 1) => Math.floor(surfY(sk, dx) + 0.5) + sink - 1;

/** Cột điểm gốc bên phải (s = 1) hoặc bên trái (s = -1) cách tâm đầu `d`: hai bên đối xứng đúng từng điểm ảnh. */
function pairCol(hcx, d, s) {
  const r = Math.floor(hcx + d);
  return s > 0 ? r : Math.floor(2 * hcx) - 1 - r;
}

/**
 * Hình vẽ tay → bộ phận tô bóng. art = { rows, ax, ay }: các hàng cùng độ dài, (ax, ay) = điểm gốc trong hình (chỗ mọc ra
 * khỏi đầu), đặt vào ô (col, row) của khung; flip = lật ngang. keys: ký tự → [dải màu, bậc cố định hoặc null = tô theo khối].
 * clip: mặt nạ cắt bỏ (vd. phần nằm trong đầu khi bộ phận ở trước đầu).
 * Ánh sáng tính theo khối elip bao quanh hình (lệch lên-trái), nên hình lật vẫn sáng từ trên-trái như mọi bộ phận khác.
 */
function stampAt(ctx, name, art, col, row, flip, z, keys, shade = 0, clip = null) {
  const { rows, ax, ay } = art;
  const w = rows[0].length;
  const h = rows.length;
  const x0 = col - (flip ? w - 1 - ax : ax);
  const y0 = row - ay;
  const nrm = [x0 + w * 0.4, y0 + h * 0.35, w * 0.6 + 1.2, h * 0.6 + 1.2];
  for (const [ch, [ramp, flat]] of Object.entries(keys)) {
    let m = mStamp(rows, ch, x0, y0, flip);
    if (clip) m = mAndNot(m, clip);
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
 * Cao và hẹp hơn tai mèo (10.4k so với 7.4k), dựng gần thẳng, lòng tai lông màu bụng (mèo: hồng), chóp tai sẫm (TUNE.tip,
 * mặc định bậc tối của thân) dài chừng 38% phần tai ló khỏi đầu (tối đa 3k hàng). Nhìn sau: mặt lưng tai màu thân, chóp sẫm
 * dài hơn. Giật tai (pose.ear): tai phải cụp xuống 1 px, chóp nghiêng ra.
 */
function foxEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const t = tune(ctx);
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const k = kOf(sk);
  const h = 10.4 * k;
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
      // line: false: lòng tai đè lên tai xa (nhìn ngang) không lấy nét trong bậc 0 của dải bụng (sói bạc: một chấm xanh)
      ctx.parts.push(part(`${g}in`, inner, ramps.belly, z + 0.1, { group: g, flat: 2, line: false }));
    }
    // chóp sẫm theo phần tai ló khỏi đầu (sơ sinh, nhí nhìn ngang chỉ ló chừng 5 hàng: chóp dài thì thành hai sừng quỷ)
    const vis = surfY(sk, c[0] - hcx) - c[1];
    const tip = mAnd(m, mAbove(c[1] + Math.min((view === 'N' ? 3.8 : 3.0) * k, vis * (view === 'N' ? 0.5 : 0.38))));
    ctx.parts.push(part(`${g}tip`, tip, tipRamp, z + 0.2, { group: g, flat: tipStep, shade: sh }));
  }
}

// ---------------------------------------------------------------- tuft: chỏm lông tai của cú (cú ánh kim)

/**
 * Chỏm lông PHẢI nhìn trước (trái = lật): mọc ở góc trên của đầu, chĩa chéo ra ngoài, ngọn vượt mép đầu 1-2 px và chẻ
 * hai (khía chữ V giữa hai ngọn lông) để đọc là lông vũ, không phải tai mèo. Sơ sinh và nhí thấp hơn một hàng.
 * (ax, ay) = gốc phía trong, cắm sâu vào đầu: nhìn trước/ngang phần đó khuất sau đầu; nhìn sau chỉ chừa 1 hàng trên đầu.
 */
const TUFT_ART = [
  { rows: ['...a', '.a.a', 'aaaa', 'aaa.', 'aa..'], ax: 0, ay: 4 },
  { rows: ['....a', '..a.a', '.aaaa', 'aaaa.', 'aaa..', 'aa...'], ax: 0, ay: 5 },
  { rows: ['.....a', '...a.a', '..aaaa', '.aaaa.', 'aaaa..', 'aaa...', 'aa....'], ax: 0, ay: 6 },
];

function tuftEars(ctx) {
  const { sk, view, pose, ramps } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const tw = pose.ear ?? 0;
  const zb = zBack(view);
  const art = TUFT_ART[ageOf(ctx)];
  const keys = { a: [ramps.main, null] };
  if (view === 'E') {
    // chỏm gần vuốt ra sau gáy (hình nhìn trước lật lại); chỏm xa ló phía trước một chút, thấp hơn một hàng, tối hơn
    // gốc gần đỉnh đầu (mép đầu cao hơn ở góc): cắm sâu hơn để ngọn cao bằng nhìn trước
    const col = Math.floor(hcx - hrx * 0.25);
    const row = rootRow(sk, col + 0.5 - hcx, 4);
    stampAt(ctx, 'tuftF', art, col + 3, row + 1, false, zb - 0.5, keys, -1);
    stampAt(ctx, 'tuftN', art, col + (tw ? 1 : 0), row + tw, true, zb, keys);
    return;
  }
  // nhìn sau chỏm nằm TRƯỚC đầu: bỏ phần gốc cắm trong đầu, chỉ chừa 1 hàng đè lên mép đầu
  const clip = view === 'N' ? mEllipse(hcx, hcy + 1, hrx, hry, 0, 2.25) : null;
  const d = hrx * 0.6;
  for (const s of [-1, 1]) {
    const col = pairCol(hcx, d, s);
    stampAt(ctx, `tuft${s}`, art, col, rootRow(sk, d, 3) + (s > 0 ? tw : 0), s < 0, zb, keys, 0, clip);
  }
}

// ---------------------------------------------------------------- mouse: tai chuột to tròn (chuột chuông)

/**
 * Tai tròn TO (gần gấp rưỡi tai tròn), đặt cao ở hai góc đầu kiểu chuột, lòng tai hồng rộng (vành mỏng), lệch lên và ra
 * ngoài để thành cái bát tròn trên phần tai ló. Nhìn ngang: tai gần quay về trước (thấy lòng tai), tai xa ló sau gáy, tối
 * hơn. Giật tai: tai phải hạ 1 px.
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
      // lòng tai lệch lên và ra ngoài: đầu che nửa dưới của tai, lòng hồng vẫn hiện thành cái bát tròn
      const ir = r - 1.45;
      const [ix, iy] = view === 'E' ? [ex + 0.45, ey] : [ex + s * 0.8, ey - 0.5];
      ctx.parts.push(part(`${g}in`, mEllipse(ix, iy, ir, ir), ramps.inner, z + 0.1, { group: g, normal: nrm }));
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
 * đầu, lòng tai hồng hé ở mép dưới. Khác tai cún (dài, rủ thẳng dọc má) và tai mèo (dựng). Nhìn ngang: một tai gần ở góc
 * sau của đỉnh đầu, rủ ra sau, chóp ló khỏi mép đầu 1-2 px (nằm gọn trong đầu thì thành cái mũ) (tai xa khuất sau đầu).
 * Nhìn sau: hai tai xòe, không có lòng tai. Buồn/giật tai: tai rủ thấp và cụp xuống thêm.
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
    ? [[1, hcx - hrx * 0.72, surfY(sk, -hrx * 0.72) + 1.6 + dr * 0.6, 1.1 + dr * 0.2]]
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

// ---------------------------------------------------------------- horns: sừng (nghé đất, tê giác đá, rồng lửa, huyền vũ)

/**
 * Hình vẽ tay theo kiểu sừng (TUNE.horn) và tuổi (sơ sinh là hai u sừng). S: sừng PHẢI (bên trái là hình lật),
 * E: sừng gần (sừng xa = cùng hình, lệch theo far, tối hơn). (ax, ay) = gốc sừng. sink: gốc cắm đúng `sink` hàng vào
 * đầu (rootRow); không có sink: hàng floor(mép đầu) + 1 như bản đầu (sừng nghé).
 * calf: sừng nghé cong ra rồi lên. dragon: sừng rồng ngắn (4-5 hàng), gốc ra ngoài để nhìn trước đọc được sừng, khe,
 * lửa, khe, sừng; nhìn ngang vuốt ra sau gáy, sừng xa nằm sau sừng gần, cách lửa ít nhất 1 px.
 * nub: sừng chóp mập của tê giác, dựng thẳng, ngọn cao hơn mép đầu 2-4 hàng ở mọi tuổi (rig.js cũ: sừng nhỏ 4 hàng).
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
    d: 0.55, // gốc ra ngoài: nhìn trước đọc được sừng, khe, lửa, khe, sừng
    sink: 1,
    dE: -0.42, // vuốt ra sau gáy, chừa đỉnh đầu cho lửa
    far: [-2, -1], // sừng xa lùi sau sừng gần (cách xa ngọn lửa trên đỉnh đầu)
    S: [
      { rows: ['.a', 'aa', 'aa'], ax: 0, ay: 2 },
      { rows: ['..a', '..a', 'aaa', 'aa.'], ax: 0, ay: 3 },
      { rows: ['...a', '...a', '..aa', 'aaa.', 'aa..'], ax: 0, ay: 4 },
    ],
    E: [
      { rows: ['a.', 'aa', '.a'], ax: 1, ay: 2 },
      { rows: ['a..', '.aa', '..a', '..a'], ax: 2, ay: 3 },
      { rows: ['a...', '.aa.', '..aa', '...a', '...a'], ax: 3, ay: 4 },
    ],
  },
  nub: {
    d: 0.5, // trên đỉnh đầu, gần giữa hơn tai (ở góc đầu thì hai sừng nhạt màu đọc thành tai mèo)
    sink: 1,
    dE: -0.12,
    far: [-4, 0],
    S: [
      { rows: ['.a.', 'aaa', 'aaa', 'aaa'], ax: 1, ay: 3 },
      { rows: ['.a.', '.aa', 'aaa', 'aaa', 'aaa'], ax: 1, ay: 4 },
      { rows: ['.a.', '.aa', 'aaa', 'aaa', 'aaa', 'aaa'], ax: 1, ay: 5 },
    ],
    E: [
      { rows: ['.a.', 'aaa', 'aaa', 'aaa'], ax: 1, ay: 3 },
      { rows: ['..a', '.aa', 'aaa', 'aaa', 'aaa'], ax: 1, ay: 4 },
      { rows: ['..a', '.aa', 'aaa', 'aaa', 'aaa', 'aaa'], ax: 1, ay: 5 },
    ],
  },
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
    const row = set.sink ? rootRow(sk, col + 0.5 - hcx, set.sink) : Math.floor(surfY(sk, col + 0.5 - hcx)) + 1;
    stampAt(ctx, 'hornF', art, col + set.far[0], row + set.far[1], false, zb - 0.5, keys, -1);
    stampAt(ctx, 'hornN', art, col, row, false, zb, keys);
  } else {
    for (const s of [-1, 1]) {
      const col = pairCol(hcx, hrx * set.d, s);
      const row = set.sink ? rootRow(sk, hrx * set.d, set.sink) : Math.floor(surfY(sk, hrx * set.d)) + 1;
      stampAt(ctx, `horn${s}`, set.S[age], col, row, s < 0, zb, keys);
    }
  }
}

// ---------------------------------------------------------------- antler: gạc chẽ nhánh (hươu pha lê, hươu rêu, kỳ lân, thanh long, hoàng long)

/**
 * Gạc lớn theo tuổi: sơ sinh là chạc chữ V nhỏ, nhí chẽ đôi, từ thiếu niên ba nhánh. S/N: mỗi gạc là chữ V nghiêng ra ngoài
 * (thân gạc chéo ra ngoài, nhánh dựng lên), gốc ở góc trên của đầu (như rig.js cũ), hai gạc cách nhau từ 8 px: nhìn là MỘT
 * ĐÔI gạc chứ không thành vương miện. Nhánh 1 px như gạc thật, viền chen giữa các nhánh. E: một gạc (gạc xa khuất).
 * Thân màu nhạt (kỳ lân, hoàng long) dùng gạc nâu da bò qua TUNE.hornRamp để gạc giữ độ đậm trên nền thân.
 */
const ANTLER_ART = {
  // gạc PHẢI nhìn trước: gốc ở cột 0 (phía trong), nhánh trong dựng thẳng, thân gạc chéo ra ngoài, nhánh giữa dựng lên từ thân
  S: [
    { rows: ['a.a', 'aa.', 'a..'], ax: 0, ay: 2 },
    { rows: ['...a', 'a.a.', 'aa..', 'a...', 'a...'], ax: 0, ay: 4 },
    { rows: ['..a..a', '..a.a.', 'a.aa..', 'a.a...', 'aa....', 'a.....', 'a.....'], ax: 0, ay: 6 },
  ],
  d: 0.62, // gốc cách tâm đầu (theo bề ngang đầu): hai gạc tách hẳn, chừa khe giữa
  dE: -0.1, // gốc gạc gần khi nhìn ngang (âm = về phía gáy)
};

function antlerEars(ctx) {
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const age = ageOf(ctx);
  const keys = { a: [hornRamp(ctx), null] };
  const zb = zBack(view);
  if (view === 'E') {
    // một gạc: hình nhìn trước lật lại (nhánh trong thành nhánh trán dựng trước, thân gạc vuốt ra sau gáy). Gạc xa khuất
    // sau gạc gần (như tai xa của heo): vẽ thêm thì thành một bụi nhánh rối.
    const col = Math.floor(hcx + hrx * ANTLER_ART.dE);
    stampAt(ctx, 'antler', ANTLER_ART.S[age], col, rootRow(sk, col + 0.5 - hcx), true, zb, keys);
    return;
  }
  for (const s of [-1, 1]) {
    const col = pairCol(hcx, hrx * ANTLER_ART.d, s);
    stampAt(ctx, `antler${s}`, ANTLER_ART.S[age], col, rootRow(sk, hrx * ANTLER_ART.d), s < 0, zb, keys);
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
  // sinkS/sinkE: hàng gốc so với floor(htop) (S) / với mép đầu ở cột gốc (E); số lớn = cắm sâu hơn vào đầu
  comb: {
    S: { rows: ['.aa.', 'aaaa', 'aaaa', 'aaaa'], ax: 1, ay: 3 },
    E: { rows: ['.a.a.a.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.'], ax: 3, ay: 3 },
    dE: 0.12,
    sinkS: 0,
    sinkE: 1,
  },
  // mào gà mái: ló 2 hàng khỏi đầu (như rig.js cũ), thấp hơn mào gà trống một hàng
  hen: {
    S: { rows: ['.aa.', 'aaaa', 'aaaa'], ax: 1, ay: 2 },
    E: { rows: ['.a.a.', 'aaaaa', 'aaaaa'], ax: 2, ay: 2 },
    dE: 0.18,
    sinkS: 0,
    sinkE: 0,
  },
  plume: {
    S: { rows: ['a......a', 'aa.aa.aa', '.aaaaaa.', '..aaaa..'], ax: 3, ay: 3 },
    E: { rows: ['aa......', '.aaa....', 'a..aaa..', '.aaa.aaa', '...aaaaa'], ax: 6, ay: 4 },
    dE: -0.05,
    sinkS: 1,
    sinkE: 1,
  },
};

function crestEars(ctx) {
  if (ctx.headTopCovered) return;
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
  const keys = { a: [tune(ctx).crestRamp ?? ramps.accent, null] };
  if (view === 'E') {
    const col = Math.floor(hcx + hrx * set.dE);
    stampAt(ctx, 'crest', set.E, col, Math.floor(surfY(sk, col + 0.5 - hcx)) + set.sinkE, false, 2, keys);
  } else {
    // gốc ở hàng floor(htop): đầu chim tròn nhô cao hơn htop một chút, gốc thấp hơn thì đầu che gần hết mào
    const col = Math.floor(hcx) - 1;
    stampAt(ctx, 'crest', set.S, col, Math.floor(sk.htop) + (view === 'N' ? 1 : 0) + set.sinkS, false, zBack(view), keys);
  }
}

// ---------------------------------------------------------------- fin: vây và mang trên đầu (cá nóc, cá chép rồng, kỳ giông)

/**
 * Vây màu điểm nhấn (như rig.js cũ) ở hai bên đầu, sau đầu. fan: vây quạt ba tia nhỏ (cá nóc); bigfan: vây quạt bốn tia
 * (cá chép rồng); gills: mang ngoài ba nhánh xòe của kỳ giông (nét nhận diện của axolotl). S/N: vây PHẢI, bên trái lật.
 * E: vây gần cắm ở mép sau của đầu (trước đầu) rồi xòe các tia ra hẳn sau gáy, vây xa ló cao hơn, tối hơn. Giật tai: vây
 * phẩy lên 1 px.
 */
// inE: số cột gốc vây gần cắm vào mép sau của đầu khi nhìn ngang (vây quạt nhỏ cắm nông để ba tia ló hẳn ra sau gáy)
const FIN_ART = {
  fan: { rows: ['..aa', '.aa.', 'aaaa', '.aa.', '..aa'], ax: 0, ay: 2, dy: 0.1, inE: 1 },
  bigfan: { rows: ['...aa', '..aa.', '.aaaa', 'aaaa.', '.aaaa', '..aa.', '...aa'], ax: 0, ay: 3, dy: 0.25, inE: 2 },
  gills: { rows: ['...aa', '..aa.', '.a...', 'aaaaa', '.a...', '..aa.', '...aa'], ax: 0, ay: 3, dy: 0.3, inE: 2 },
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
    const col = Math.floor(hcx - hrx) + art.inE;
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
