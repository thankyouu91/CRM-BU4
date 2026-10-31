// Dáng TRÒN (round): chuột chuông, ếch sen, nhím rêu, hải cẩu, cá nóc, heo than, chuột chũi, heo đất (8 loài).
// Chủ sở hữu: họa sĩ dáng round. TRẠNG THÁI: ĐÃ VẼ (Rig 2.0, đã sửa theo duyệt lần 3: R1 - R11). Chưa có ảnh mẫu khóa
// (không loài nào của bản mẫu dùng dáng này): soát bằng contact sheet (ARTIST-GUIDE mục 11).
//
// Cách dựng: đầu và thân của bộ xương (skeleton.js, cỡ ở `dims`) nhập MỀM thành một khối tròn (geo), bo theo elip vừa
// khung bao, hai bên phình đều (smoothSides: không có eo kiểu người tuyết), tô bằng MỘT khối chiếu sáng chung nên không có
// đường nối cổ; khối sáng lệch lên trái đủ để chừng 40% khối ở bậc tối, như Boba, Mèo Bạc. Phần trên của khối là vùng đầu
// (part 'head', ctx.headMask: mặt, hoa văn đầu bám vào đây), phần dưới là thân; bụng là mảng bầu dục ngay dưới cằm, có khối
// chiếu sáng RIÊNG (nằm thấp trên khối chung thì gần như cả bụng rơi vào bậc tối, mất màu bụng). Chân là hai mẩu nhỏ ló
// dưới đáy, tay là hai mẩu tròn hai bên khối. Đi: nảy như quả bóng (walkPose).
// Điểm neo: đầu, mặt, bùa do skeleton.js tính từ `dims`; CỔ và LƯNG tính lại theo khối (ballAnchors): cổ không thấp hơn 3/4
// khối và luôn cách đất ít nhất 6 px (khăn, chuông của bé nhỏ tuổi không chạm đất), lưng ở 1/3 trên của khối, nhìn ngang
// thì nằm trên mép sau thật của khối. skeleton.js gọi móc `anchors(sk, sp)` ở cuối file ngay khi dựng bộ xương, nên mọi
// nơi đọc điểm neo (đồ đeo, hình túi đồ, kiểm thử) đều thấy cổ và lưng theo khối.
// Trường ctx MỚI cho đồ đeo: ctx.ballRows[y] = [x trái, x phải] (điểm ảnh, tính cả hai đầu) của khối ở hàng y (chỉ có ở
// dáng tròn, đặt trong body(), hướng E chưa lật): để khăn quàng nhìn ngang chạy hết bề ngang khối (việc của họa sĩ đồ cổ).
// Phần riêng từng loài (TUNE bên dưới): tay chân hồng (chuột chuông), chân ếch + đùi gập + hai u mắt trên đỉnh, đầu vuông
// vai (ếch sen), lớp gai rêu: mép răng cưa quanh mặt, vương miện gai, vân chữ V (nhím rêu), vây chèo trước thò qua mép
// trước - dưới + đuôi thuôn (hải cẩu), gai + vây đuôi + vây lưng, không chân, đi là nảy (cá nóc), móng heo có kẽ (heo
// than, heo đất), khe bỏ xu trên lưng (heo đất), bàn tay đào đất có ba móng kem dính liền bàn tay (chuột chũi).
// Đã nối ở bước ghép: skeleton.animPoses truyền loài vào walkPose (cá nóc và ếch nảy cao hơn, HOP), skeleton.js gọi móc
// `anchors`, và index.js tính cằm che khăn (ctx.chin) theo điểm neo cổ (neck[1] − 0.8; dáng khác y hệt trước).
import { FH, FW, RAMPS, gait, mAbove, mAnd, mAndNot, mEllipse, mOr, mOrInto, mTri, newMask, part, pyRound } from '../core.js';

// ---------------------------------------------------------------- tinh chỉnh theo loài (chỉ trong file này)

/**
 * Phần riêng của từng loài (dữ liệu shared/pets.js không có chỗ cho chúng):
 *  hands: tay 'nub' (mẩu tròn, mặc định) | 'flipper' (vây chèo hải cẩu) | 'claw' (bàn tay đào đất chuột chũi) | 'fin' (vây cá);
 *  feet:  chân 'nub' (mặc định) | 'hoof' (móng heo, có kẽ) | 'frog' (chân ếch có màng + đùi gập) | 'flipper' (vây sau
 *         hải cẩu) | 'none' (cá nóc: không có chân, khối tròn chạm đất; đi là nảy tưng tưng);
 *  limb:  dải màu của tay chân ('main' | 'belly' | 'accent' | 'inner' | tên dải trong RAMPS); mặc định ramps.limb;
 *  quills: lông gai rêu (nhím), spikes: gai nhỏ quanh mình (cá nóc), tailFin: vây đuôi + vây lưng (cá nóc),
 *  slot: khe bỏ xu trên lưng (heo đất = con heo đất bỏ ống);
 *  domes: hai u mắt trên đỉnh khối, ngay trên hai cột mắt (ếch): thuộc khối và vùng đầu nên ánh sáng liền một mảng.
 */
const TUNE = {
  chuot_chuong: { limb: 'inner' }, // chuột chuông: bàn tay, bàn chân hồng
  ech_sen: { feet: 'frog', hands: 'frog', domes: true }, // ếch ngồi: chân trước chống thẳng, đùi sau gập hai bên, hai u mắt
  nhim_reu: { quills: true },
  hai_cau: { hands: 'flipper', feet: 'flipper' },
  ca_noc: { hands: 'fin', feet: 'none', spikes: true, tailFin: true },
  heo_than: { feet: 'hoof' },
  heo_dat: { feet: 'hoof', slot: true },
  chuot_chui: { hands: 'claw', limb: 'accent' }, // chuột chũi: hai bàn tay đào đất to, hồng
};
const tune = (ctx) => TUNE[ctx.sp.id] ?? {};
const roleRamp = (ctx, role) => (role ? ctx.ramps[role] ?? role : ctx.ramps.limb ?? ctx.ramps.main);

// Nhím rêu: dải của lớp gai (điểm nhấn của loài = xanh rêu).
const QUILL_ROLE = 'accent';
// z riêng của dáng tròn (xem ARTIST-GUIDE mục 8): bụng zh + 0.05 (trên khối đầu, dưới mõm), lớp gai zh + 0.12,
// đùi ếch zh + 0.2, tay zh + 0.25 (nhìn trước). Điểm chi tiết (kẽ móng, khe xu): z 15, dưới hoa văn (16).
const Z_PX = 15;

// ---------------------------------------------------------------- khối tròn

/** Độ "dính" khi nhập đầu vào thân (số mũ của phép hợp mềm: nhỏ = nhập nhiều, to = gần phép hợp thường). */
const BLEND = 2;
/** Bo tròn: khối được cắt bởi elip (số mũ ROUND_N) vừa khung bao của nó, nới ROUND_PAD px: thành quả bóng, không thành hộp. */
const ROUND_N = 2.0;
const ROUND_PAD = 0.3;

const geoCache = new WeakMap();

function scan(mask) {
  const rows = [];
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  for (let k = 0; k < FW * FH; k++) {
    if (!mask[k]) continue;
    const x = k % FW;
    const y = (k - x) / FW;
    if (!rows[y]) rows[y] = [x, x];
    else rows[y][1] = x;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const box = { x0, x1: x1 + 1, y0, y1: y1 + 1 };
  Object.assign(box, { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, rx: (box.x1 - box.x0) / 2, ry: (box.y1 - box.y0) / 2 });
  return { rows, box };
}

/**
 * Khối tròn của khung hình: hợp MỀM của đầu (siêu elip n = 2.25) và thân (elip) của bộ xương, nên eo giữa đầu và thân
 * được lấp đầy (một khối, không thành người tuyết); rồi bo theo elip vừa khung bao. Loài không có chân (cá nóc) thì thân
 * kéo xuống chạm đất. Trả về { ball, box, nrm, rows }: box = khung bao (tọa độ mép), nrm = khối elip chiếu sáng CHUNG cho
 * đầu lẫn thân (không có đường nối), rows[y] = [x trái, x phải] của hàng y.
 */
function geo(ctx) {
  const { sk } = ctx;
  let g = geoCache.get(sk);
  if (g) return g;
  let [bcx, bcy, brx, bry] = sk.body;
  const [hcx, hcy, hrx, hry] = sk.head;
  if (tune(ctx).feet === 'none') {
    const drop = Math.max(0, sk.ground - 0.5 - (bcy + bry));
    bcy += drop / 2;
    bry += drop / 2;
  }
  // Ếch (domes): đầu vuông vai hơn (siêu elip số mũ lớn) và bo ít hơn, để đỉnh khối rộng, phẳng, đủ chỗ cho hai u mắt.
  const domed = Boolean(tune(ctx).domes);
  const hn = domed ? 3.0 : 2.25;
  const blob = newMask();
  const xa = Math.max(0, Math.floor(Math.min(bcx - brx, hcx - hrx) - 2));
  const xb = Math.min(FW - 1, Math.ceil(Math.max(bcx + brx, hcx + hrx) + 2));
  const ya = Math.max(0, Math.floor(hcy - hry - 2));
  const yb = Math.min(FH - 1, Math.ceil(bcy + bry + 2));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const fh = Math.abs((px - hcx) / hrx) ** hn + Math.abs((py - hcy) / hry) ** hn;
      const fb = ((px - bcx) / brx) ** 2 + ((py - bcy) / bry) ** 2;
      if (fh <= 1 || fb <= 1 || (fh ** -BLEND + fb ** -BLEND) ** (-1 / BLEND) <= 1) blob[y * FW + x] = 1;
    }
  }
  const b0 = scan(blob).box;
  const ball = mAnd(blob, mEllipse(b0.cx, b0.cy, b0.rx + ROUND_PAD, b0.ry + ROUND_PAD, 0, domed ? 2.5 : ROUND_N));
  smoothSides(ball);
  const domes = tune(ctx).domes ? eyeDomes(ctx, ball) : null;
  if (domes) mOrInto(ball, domes);
  const { rows, box } = scan(ball);
  const nrm = [box.cx - 1.8, box.cy - 2.6, box.rx + 0.8, box.ry + 1.2];
  g = { ball, box, nrm, rows, domes };
  geoCache.set(sk, g);
  return g;
}

/**
 * Hai bên khối luôn phình đều: đi từ đỉnh xuống hàng rộng nhất, mép chỉ được nở ra (không thắt lại), và đi từ đáy lên
 * cũng vậy; giữa hai hàng rộng nhất (đầu và bụng cùng rộng) thì lấp thẳng. Bỏ được "eo" 1 px chỗ đầu nhập vào thân
 * (dáng người tuyết) và cục u 1 hàng.
 */
function smoothSides(ball) {
  const { rows, box } = scan(ball);
  for (const s of [-1, 1]) {
    const e = (y) => (s < 0 ? rows[y][0] : rows[y][1]);
    const wider = (a, b) => (s < 0 ? Math.min(a, b) : Math.max(a, b));
    // Một hàng lẻ nhô ra 1 px so với cả hai hàng kề (cục u): gọt về bằng hàng kề.
    for (let y = box.y0 + 1; y < box.y1 - 1; y++) {
      if (!rows[y - 1] || !rows[y] || !rows[y + 1]) continue;
      const n = wider(e(y - 1), e(y + 1));
      if (e(y) !== n && wider(e(y), n) === e(y) && Math.abs(e(y) - n) === 1 && e(y - 1) === e(y + 1)) {
        ball[y * FW + e(y)] = 0;
        rows[y][s < 0 ? 0 : 1] = n;
      }
    }
    let best = e(box.y0);
    for (let y = box.y0; y < box.y1; y++) if (rows[y]) best = wider(best, e(y));
    let first = -1;
    let last = -1;
    for (let y = box.y0; y < box.y1; y++) if (rows[y] && e(y) === best) { if (first < 0) first = y; last = y; }
    const want = [];
    let run = e(box.y0);
    for (let y = box.y0; y <= first; y++) want[y] = run = wider(run, e(y));
    for (let y = first; y <= last; y++) want[y] = best;
    run = e(box.y1 - 1);
    for (let y = box.y1 - 1; y >= last; y--) want[y] = run = wider(run, e(y));
    for (let y = box.y0; y < box.y1; y++) {
      if (!rows[y]) continue;
      const [a, b] = s < 0 ? [want[y], rows[y][0]] : [rows[y][1] + 1, want[y] + 1];
      for (let x = a; x < b; x++) ball[y * FW + x] = 1;
    }
  }
}

/**
 * U mắt của ếch: hai vòm tròn nhô lên khỏi đỉnh khối ngay trên hai cột mắt (nhìn trước, nhìn sau: hcx ± eyeDx; nhìn
 * ngang: vòm gần trên mắt gần, vòm xa lùi sau một chút, thấp hơn nửa điểm ảnh).
 */
function eyeDomes(ctx, ball) {
  const { sk, view } = ctx;
  const rx = 2.7 * sk.hk;
  const ry = 2.6 * sk.hk;
  const top = (x) => {
    for (let y = 0; y < FH; y++) if (ball[y * FW + Math.floor(x)]) return y;
    return Math.floor(sk.htop);
  };
  const span = (y) => {
    let a = FW;
    let b = -1;
    for (let x = 0; x < FW; x++) if (ball[y * FW + x]) { a = Math.min(a, x); b = Math.max(b, x); }
    return [a, b];
  };
  const xs = view === 'E' ? [[sk.anchors.face[0] - 0.8, 0], [sk.anchors.face[0] - 0.8 - 4.4 * sk.hk, 0.6]] : [[sk.head[0] - sk.eyeDx, 0], [sk.head[0] + sk.eyeDx, 0]];
  const m = newMask();
  for (const [x, drop] of xs) {
    // Nửa trên của vòm elip, chân vòm ngồi trên đỉnh khối (thấp hơn đỉnh cột đó 1 hàng), không lòi ra ngoài hai bên khối.
    const cy = top(x) + 0.5 + drop;
    const [a, b] = span(Math.floor(cy));
    const d = mAnd(mEllipse(x, cy, rx, ry), mAbove(cy));
    for (let k = 0; k < FW * FH; k++) if (d[k] && (k % FW) >= a && (k % FW) <= b) m[k] = 1;
  }
  return m;
}

/** Mép trái (s = −1) hoặc phải (s = 1) của khối ở độ cao y (tọa độ mép, không phải tâm điểm ảnh). */
function edgeAt(g, y, s) {
  const r = g.rows[Math.min(g.box.y1 - 1, Math.max(g.box.y0, Math.floor(y)))];
  if (!r) return s < 0 ? g.box.x0 : g.box.x1;
  return s < 0 ? r[0] : r[1] + 1;
}

/** Hàng trên cùng của khối ở cột x (hoặc null). */
function topAt(g, x) {
  for (let y = g.box.y0; y < g.box.y1; y++) if (g.ball[y * FW + x]) return y;
  return null;
}

/** Điểm trên elip khung bao ở góc a (độ, 0 = đỉnh, chiều kim đồng hồ) và pháp tuyến hướng ra ngoài. */
function rim(g, a) {
  const t = (a * Math.PI) / 180;
  const sx = Math.sin(t);
  const sy = -Math.cos(t);
  const { cx, cy, rx, ry } = g.box;
  let nx = sx / rx;
  let ny = sy / ry;
  const l = Math.hypot(nx, ny);
  nx /= l;
  ny /= l;
  return [cx + sx * rx, cy + sy * ry, nx, ny];
}

/** Các góc từ `from` tới `to` (độ), cách nhau `step`. */
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step + 1e-6) + 1 }, (_, i) => from + i * step);

/**
 * Như rim() nhưng điểm nằm đúng trên mép THẬT của khối (đi từ tâm khung bao theo hướng của góc `a` tới điểm cuối còn
 * trong khối), pháp tuyến vẫn lấy của elip khung bao. Dùng cho gai nhím: chóp gai luôn ló đều ra ngoài viền dù khối dẹt.
 */
function ballRim(g, a) {
  const [ex, ey, nx, ny] = rim(g, a);
  const { cx, cy } = g.box;
  const dx = ex - cx;
  const dy = ey - cy;
  let t = 0;
  for (let u = 0; u <= 1.3; u += 0.02) {
    const x = Math.floor(cx + dx * u);
    const y = Math.floor(cy + dy * u);
    if (x < 0 || y < 0 || x >= FW || y >= FH || !g.ball[y * FW + x]) break;
    t = u;
  }
  return [cx + dx * t, cy + dy * t, nx, ny];
}

/**
 * Gai tam giác quanh khối ở các góc `angles` (độ): dài `len` (gai lẻ ngắn đi `alt`), chân rộng 2 × `base`, chóp lệch `lean`.
 * `onBall`: chân gai bám mép thật của khối (ballRim) thay vì elip khung bao.
 */
function spikeRing(g, angles, len, base, { lean = 0, alt = 0, onBall = false } = {}) {
  const m = newMask();
  for (const [i, a] of angles.entries()) {
    const [x, y, nx, ny] = onBall ? ballRim(g, a) : rim(g, a);
    const L = len - (i % 2) * alt;
    const tx = -ny;
    const ty = nx;
    const p0 = [x - nx * 1.2 + tx * base, y - ny * 1.2 + ty * base];
    const p1 = [x - nx * 1.2 - tx * base, y - ny * 1.2 - ty * base];
    mOrInto(m, mTri(p0, p1, [x + nx * L + lean, y + ny * L]));
  }
  return m;
}

// ---------------------------------------------------------------- thân, bụng

function torso(ctx, g) {
  const { sk, view, ramps } = ctx;
  ctx.parts.push(part('body', g.ball, ramps.main, 4, { group: 'head', normal: g.nrm }));
  if (view === 'N') return;
  // Bụng: mảng bầu dục màu bụng, mép trên ngay dưới cằm (điểm neo cổ), nằm TRÊN khối đầu (cùng nhóm 'head': không có
  // nét trong, không có đường nối), dưới mõm và mắt. Bé sơ sinh gần như chỉ có cái đầu nên bụng chỉ là một mảng nhỏ.
  // Khối chiếu sáng riêng, tâm hơi lệch trái - lên trong chính mảng bụng: bụng ra chừng 46/37/13% ở bậc tối/giữa/sáng
  // (bản mẫu 41 - 55% bậc tối), không chìm hết vào bậc tối của khối chung (heo, chuột chuông mất bụng).
  const top = sk.anchors.neck[1] - 1.0;
  const bot = g.box.y1;
  if (bot - top < 1.5) return;
  const ery = (bot - top) * 0.75;
  const ex = view === 'S' ? sk.body[0] : g.box.cx + g.box.rx * 0.3;
  const erx = Math.max(2.0, g.box.rx * (view === 'S' ? 0.62 : 0.56));
  const belly = mAnd(g.ball, mEllipse(ex, top + ery, erx, ery));
  ctx.parts.push(part('belly', belly, ramps.belly, ctx.zh + 0.05, { group: 'head', normal: [ex - erx * 0.35, top + ery * 0.55, erx + 1.4, ery + 1.2] }));
}

// ---------------------------------------------------------------- chân

function feet(ctx, g) {
  const { sk, view, pose } = ctx;
  const kind = tune(ctx).feet ?? 'nub';
  const gnd = sk.ground;
  const { s: si, lN, lF } = gait(pose);
  const ramp = roleRamp(ctx, tune(ctx).limb);
  const k = Math.min(1, sk.bk);
  const parts = ctx.parts;
  if (kind === 'none') return;
  if (kind === 'flipper') return flipperFeet(ctx, g);
  if (view === 'S' || view === 'N') {
    const frog = kind === 'frog';
    const dx = Math.max(2.2, g.box.rx * (frog ? 0.5 : 0.42));
    const fry = frog ? 1.15 : 1.3;
    const frx = (frog ? 2.1 : 1.5) + 0.6 * k;
    for (const [s, lift] of [[-1, lF], [1, lN]]) {
      const fx = sk.body[0] - (pose.sway ?? 0) + s * dx;
      const fy = gnd - fry + 0.42 - lift;
      if (frog) haunch(ctx, g, s, view);
      const rot = frog ? -s * 0.28 : 0;
      const z = frog && view === 'S' ? ctx.zh + 0.21 : 3;
      parts.push(part(`foot${s}`, mEllipse(fx, fy, frx, fry, rot), ramp, z, { normal: [fx - 0.5, fy - 1, frx + 0.5, fry + 1] }));
      if (kind === 'hoof') cleft(ctx, ramp, pyRound(fx - 0.5), soleRow(fy + fry));
      if (frog && view === 'S') toes(ctx, ramp, fx, soleRow(fy + fry), s);
    }
  } else {
    if (kind === 'frog') haunch(ctx, g, 1, 'E');
    const fry = kind === 'frog' ? 1.15 : 1.3;
    const frx = (kind === 'frog' ? 2.4 : 1.8) + 0.6 * k;
    for (const [nm, off, lift, z, sh] of [['footF', -si, lF, 2, -1], ['footN', si, lN, kind === 'frog' ? ctx.zh + 0.21 : 5, 0]]) {
      const fx = g.box.cx + (kind === 'frog' ? 1.5 : 0.5) + off * 0.9;
      const fy = gnd - fry + 0.42 - lift;
      parts.push(part(nm, mEllipse(fx, fy, frx, fry), ramp, z, { normal: [fx - 0.5, fy - 1, frx + 1, fry + 1], shade: sh }));
      if (kind === 'hoof' && sh === 0) cleft(ctx, ramp, pyRound(fx + frx * 0.35), soleRow(fy + fry));
    }
  }
}

/** Hàng điểm ảnh cuối của bàn chân có đáy elip tại `bottom` (= mặt đất + 0.42 − nhấc chân). */
const soleRow = (bottom) => Math.floor(bottom - 0.43);

/** Kẽ móng heo: một điểm nét trong ở đáy bàn chân. */
function cleft(ctx, ramp, x, y) {
  ctx.pixels.push([x, y, RAMPS[ramp][0], Z_PX]);
}

/** Ngón chân ếch: hai kẽ ở mép trước bàn chân (ba ngón). */
function toes(ctx, ramp, fx, y, s) {
  const c = RAMPS[ramp][0];
  ctx.pixels.push([pyRound(fx - 0.5 + s * 0.6), y, c, Z_PX], [pyRound(fx - 0.5 + s * 2.0), y, c, Z_PX]);
}

/** Đùi ếch gập hai bên đáy (nhìn trước, sau) hoặc một bên (nhìn ngang). */
function haunch(ctx, g, s, view) {
  const { sk } = ctx;
  const k = Math.min(1, sk.bk + 0.25);
  const ry = 3.4 * k;
  const rx = 2.6 * k;
  const y = g.box.y1 - ry + 0.2;
  let x;
  let z;
  if (view === 'E') {
    x = g.box.cx - g.box.rx * 0.35;
    z = ctx.zh + 0.2;
  } else {
    x = edgeAt(g, y, s) - s * (rx - 0.6);
    z = view === 'S' ? ctx.zh + 0.2 : 6.5;
  }
  ctx.parts.push(part(`haunch${s}`, mAnd(mEllipse(x, y, rx, ry, view === 'E' ? -0.35 : s * 0.25), mAbove(sk.ground - 0.6)), ctx.ramps.main, z, {
    normal: [x - 1, y - 1.5, rx + 1.5, ry + 1.5],
  }));
}

/** Vây sau hải cẩu: xòe hai bên đáy (S), chụm ra sau như đuôi (E), xòe giữa đáy và nằm trước lưng (N). */
function flipperFeet(ctx, g) {
  const { sk, view, pose } = ctx;
  const ramp = roleRamp(ctx, tune(ctx).limb);
  const { s: si, walking } = gait(pose);
  const gnd = sk.ground;
  const k = Math.min(1, sk.bk + 0.3);
  const flap = walking ? si * 0.12 : (pose.tail ?? 0) * 0.08;
  if (view === 'S') {
    for (const s of [-1, 1]) {
      const fx = sk.body[0] + s * (g.box.rx * 0.48 + 0.8);
      const fy = gnd - 1.0;
      P(ctx, `flip${s}`, mEllipse(fx, fy, 2.6 * k, 1.1, -s * 0.22), ramp, 3, [fx - 0.5, fy - 1, 3, 2], -1);
    }
  } else if (view === 'N') {
    // nhìn sau: hai vây sau xòe ra hai bên đáy, phía trước lưng (về phía người xem), tối hơn một bậc
    for (const s of [-1, 1]) {
      const fx = sk.body[0] + s * (g.box.rx * 0.42 + 1.0) + (pose.tail ?? 0) * 0.3;
      const fy = gnd - 1.0;
      P(ctx, `flip${s}`, mEllipse(fx, fy, 2.7 * k, 1.15, -s * (0.22 + flap)), ramp, 8, [fx - 0.5, fy - 1, 3, 2], -1);
    }
  } else {
    // Nhìn ngang: phần đuôi thuôn ra sau sát đất (dáng hải cẩu nằm), hai vây sau chụm ở cuối.
    const ty = gnd - 2.0 * k - 0.4;
    const tx = g.box.x0 + 2.2;
    P(ctx, 'rump', mAnd(mEllipse(tx, ty, 4.2 * k, 2.2 * k, -0.12), mAbove(gnd - 0.6)), ctx.ramps.main, 3.9, g.nrm);
    const fx = tx - 3.6 * k;
    const fy = gnd - 1.4;
    for (const [s, sh] of [[-1, -1], [1, 0]]) {
      P(ctx, `flip${s}`, mEllipse(fx - 1.4 * k, fy - s * 0.7, 2.4 * k, 1.05, -s * (0.38 + flap)), ramp, 1 + (s > 0 ? 0.1 : 0), [fx - 2, fy - 1, 3.5, 2], sh);
    }
  }
}

/** Gọn: đẩy một bộ phận (normal null + flat → bậc màu cố định; line false → không kẻ nét trong, cho vây nhỏ). */
function P(ctx, name, mask, ramp, z, normal, shade = 0, flat = null, line = true) {
  ctx.parts.push(part(name, mask, ramp, z, { normal: normal ?? [0, 0, 1, 1], shade, flat, line }));
}

// ---------------------------------------------------------------- tay

/** Vị trí tay bên `s`: mép khối ở chừng 60% chiều cao; giơ lên khi vẫy (armR / armL = 1, 2), đung đưa khi đi. */
function handAt(ctx, g, s, out = 0.9) {
  const { pose } = ctx;
  const { lN, walking } = gait(pose);
  const up = s > 0 ? pose.armR ?? 0 : pose.armL ?? 0;
  const sw = !walking ? 0 : (s < 0) === (lN > 0) ? 0.6 : 0;
  const y0 = g.box.y0 + g.box.ry * 1.22;
  const ay = y0 - up * 2.8 + sw;
  const ax = edgeAt(g, ay, s) - s * out + s * up * 0.7;
  return { ax, ay, up };
}

function hands(ctx, g) {
  const { view, pose } = ctx;
  const t = tune(ctx);
  const kind = t.hands ?? 'nub';
  const ramp = kind === 'fin' ? ctx.ramps.accent : roleRamp(ctx, t.limb);
  const { s: si, lN, lF, walking } = gait(pose);
  const k = Math.min(1, ctx.sk.bk + 0.35);
  if (view === 'S' || view === 'N') {
    const z = view === 'S' ? ctx.zh + 0.25 : 3;
    for (const s of [-1, 1]) {
      if (ctx.handsBusy && view === 'S' && !(s > 0 ? pose.armR : pose.armL)) continue;
      if (kind === 'flipper') {
        const { ax, ay, up } = handAt(ctx, g, s, 0.4);
        const rot = up ? s * 0.55 : -s * 0.6;
        P(ctx, `hand${s}`, mEllipse(ax, ay + (up ? 0 : 1.2), 1.4, 3.1 * k, rot), ramp, z, [ax - 0.5, ay - 1, 2, 3.5], view === 'S' ? 0 : -1);
      } else if (kind === 'claw') {
        const { ax, ay } = handAt(ctx, g, s, 0.2);
        const paw = mEllipse(ax, ay, 2.1 * k, 2.3 * k, s * 0.3);
        P(ctx, `hand${s}`, paw, ramp, z, [ax - 0.8, ay - 1, 2.5, 2.8]);
        claws(ctx, paw, s, z, `hand${s}`);
      } else if (kind === 'fin') {
        // Cá nóc: vây ngực (tai 'fin') đã ở hai bên mặt; vây "tay" ép sát mình, chỉ xòe ra khi vẫy, nhảy, bận rộn,
        // và quạt so le khi đi (nảy tưng tưng).
        const { ax, ay, up } = handAt(ctx, g, s, 0.6);
        const paddle = walking && (s < 0 ? lF : lN) > 0;
        if (!up && !paddle) continue;
        const tip = up ? [ax + s * 2.8, ay - 2.2 - up * 0.6] : [ax + s * 2.6, ay + 0.6];
        P(ctx, `hand${s}`, mTri([ax - s * 0.6, ay - 1.4], [ax - s * 0.2, ay + 1.6], tip), ramp, z, null, 0, 2, false);
      } else if (kind === 'frog') {
        frogArm(ctx, g, s, ramp, z);
      } else {
        const { ax, ay, up } = handAt(ctx, g, s);
        P(ctx, `hand${s}`, mEllipse(ax, ay, 1.5, 2.0, s * (up ? 0.5 : -0.45)), ramp, z, [ax - 0.5, ay - 1, 2.0, 2.6]);
      }
    }
    return;
  }
  if (ctx.handsBusy || kind === 'fin') return;
  // Nhìn ngang: tay gần ló ra ở mép trước khối, thấp hơn mõm (không đè lên mặt; bé sơ sinh mặt chiếm cả khối nên hạ thấp
  // hơn nữa). Tay nằm trọn trong khối thì nét trong vẽ thành một "chữ" lạ trên bụng, nên luôn cho ló ra ngoài viền.
  const y = Math.min(g.box.y1 - 2.2, Math.max(g.box.y0 + g.box.ry * 1.42, ctx.sk.eyeY + 5.5));
  const z = ctx.zh + 0.25; // trên bụng và đầu
  const front = edgeAt(g, y, 1);
  if (kind === 'flipper') {
    // Vây chèo trước: mái chèo dẹt chĩa xuống - ra trước, gốc trong khối, đầu vây thò qua mép trước - dưới của khối (như
    // tay mẩu: vây nằm trọn trong khối thì nét trong vẽ thành một vòng lạ trên bụng). Khi đi, vây quạt theo bước.
    const fy = g.box.y1 - 3.4 * k - 0.6;
    const ax = edgeAt(g, fy, 1) - 0.6 - si * 0.35;
    P(ctx, 'handN', mEllipse(ax, fy, 3.0 * k, 1.3, 0.8 - si * 0.1), ramp, z, [ax - 1.5, fy - 1, 3.5, 2]);
  } else if (kind === 'claw') {
    const x = front - 1.3 - si * 0.3;
    const paw = mEllipse(x, y + 0.4, 2.0 * k, 2.3 * k, 0.3);
    P(ctx, 'handN', paw, ramp, z, [x - 0.8, y, 2.5, 2.8]);
    claws(ctx, paw, 1, z, 'handN');
  } else if (kind === 'frog') {
    frogArm(ctx, g, 1, ramp, z);
  } else {
    const ax = front - 0.9 - si * 0.4;
    P(ctx, 'handN', mEllipse(ax, y, 1.5, 1.9, 0.45 + si * 0.1), ramp, z, [ax - 0.5, y - 1, 2.0, 2.6]);
  }
}

/**
 * Chân trước của ếch: cột ngắn chống xuống đất trước bụng, giữa hai đùi (S); một chân trước dưới mõm (E).
 * Vẫy/nhảy thì giơ lên cạnh má như tay thường.
 */
function frogArm(ctx, g, s, ramp, z) {
  const { sk, view, pose } = ctx;
  const up = view === 'S' ? (s > 0 ? pose.armR ?? 0 : pose.armL ?? 0) : 0;
  const { s: si, lN, lF } = gait(pose);
  if (up) {
    const { ax, ay } = handAt(ctx, g, s);
    P(ctx, `hand${s}`, mEllipse(ax, ay, 1.4, 2.0, s * 0.5), ramp, z, [ax - 0.5, ay - 1, 2.0, 2.6]);
    return;
  }
  const bot = sk.ground - 0.6 - (view === 'E' ? 0 : s < 0 ? lF : lN);
  const top = Math.max(sk.anchors.neck[1] + 1.5, bot - 6.0);
  const x = view === 'S' ? sk.body[0] + s * Math.max(2.0, g.box.rx * 0.32) : g.box.cx + g.box.rx * 0.45 + si * 0.4;
  const ry = Math.max(1.2, (bot - top) / 2);
  P(ctx, `hand${s}`, mEllipse(x, (top + bot) / 2, 1.25, ry, view === 'S' ? -s * 0.12 : 0.1, 2.4), ramp, z, [x - 0.6, top, 2, ry * 2 + 1]);
}

/**
 * Móng chuột chũi: hai hoặc ba vạch kem ngắn (2 × 1, bé sơ sinh 1 × 1) chĩa ra từ mép ngoài bàn tay, cách nhau một hàng,
 * nằm trong các hàng của bàn tay. Móng dính liền bàn tay nên viền ngoài bao một lần cho cả bàn tay lẫn móng: khe giữa hai
 * móng là nét viền, đọc thành ba ngón móng rõ ràng (không phải chấm lẻ, không "dither"). Cùng nhóm với bàn tay: không có
 * nét trong giữa móng và tay.
 */
const CLAW_RAMP = 'wheat';
function claws(ctx, paw, s, z, group) {
  const edge = [];
  let y0 = FH;
  let y1 = -1;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      if (!paw[y * FW + x]) continue;
      if (edge[y] === undefined || (s > 0 ? x > edge[y] : x < edge[y])) edge[y] = x;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (y1 < 0) return;
  const n = y1 - y0 + 1;
  const mid = Math.floor((y0 + y1 + 1) / 2);
  const rows = n >= 5 ? [mid - 2, mid, mid + 2] : n >= 3 ? [mid - 1, mid + 1] : [mid];
  const len = ctx.sk.bk >= 0.6 ? 2 : 1;
  const m = newMask();
  for (const y of rows) {
    if (edge[y] === undefined || y < y0 || y > y1) continue;
    for (let i = 1; i <= len; i++) {
      const x = edge[y] + s * i;
      if (x >= 1 && x < FW - 1) m[y * FW + x] = 1;
    }
  }
  ctx.parts.push(part(`claws${s}`, m, CLAW_RAMP, z + 0.01, { group, flat: 3, line: false }));
}

// ---------------------------------------------------------------- phần riêng của loài

/**
 * Nhím rêu: lớp gai rêu phủ đỉnh đầu và lưng; mặt và bụng trơn (màu thân). Đọc là NHÍM, không phải "áo mũ trùm":
 *  - mép lớp gai quanh mặt là răng cưa (gai nhọn chĩa xuống trán và hai má), không phải một đường elip trơn;
 *  - viền ngoài có gai ló ra: nhìn trước có cả một vương miện gai trên đỉnh, giữa hai tai; nhìn ngang chỉ ở cung lưng
 *    (không có gai nào trên trán, mõm, cằm hay cạnh chân trước); nhìn sau là cả vòng;
 *  - trên lớp gai có vài nét chữ V phẳng (bậc tối, không nét trong) làm vân gai.
 */
function quills(ctx, g) {
  const { sk, view } = ctx;
  const ramp = roleRamp(ctx, QUILL_ROLE);
  const [hcx, , hrx, hry] = sk.head;
  const k = Math.min(1, sk.bk + 0.3);
  const nrm = g.nrm;
  let coat;
  let ring;
  let zc;
  if (view === 'S') {
    const cy = sk.eyeY + 2.6;
    const ry = hry * 0.94;
    const rx = hrx * 0.76;
    const face = mAndNot(mEllipse(hcx, cy, rx, ry), fringe(ctx, hcx, cy, rx, ry, range(-96, 96, 24), 2.4 * k));
    coat = mAnd(mAndNot(g.ball, face), mAbove(g.box.cy + g.box.ry * 0.2));
    ring = spikeRing(g, range(-112, 112, 16), 2.8 + 1.0 * k, 1.6, { alt: 1.0, onBall: true });
    zc = ctx.zh + 0.12;
  } else if (view === 'E') {
    const face = mEllipse(hcx + hrx * 0.42, sk.eyeY + 2.6, hrx * 0.74, hry * 1.08);
    coat = mAnd(mAndNot(g.ball, face), mAbove(g.box.y1 - 3.0));
    // Chỉ cung lưng (đỉnh đầu ra sau, xuống tới mông): mặt, mõm, cằm và chân trước sạch gai.
    ring = spikeRing(g, range(-80, 36, 20).concat(range(216, 260, 20)), 2.8 + 0.8 * k, 1.6, { lean: -0.9, alt: 0.9, onBall: true });
    zc = ctx.zh + 0.12;
  } else {
    coat = mAnd(g.ball, mAbove(g.box.y1 - 3.2));
    ring = spikeRing(g, range(-126, 126, 18), 2.8 + 0.8 * k, 1.6, { alt: 0.9, onBall: true });
    zc = 6.5;
  }
  ctx.parts.push(part('quills', coat, ramp, zc, { normal: nrm }));
  // Vân gai tô bằng màu bậc tối của lớp gai nhưng qua một dải KHÁC có cùng màu đó: cùng nhóm (không bóng đổ, không nét
  // trong) mà không bị bước dọn điểm lẻ của colourise xóa mất (bước đó chỉ so các điểm cùng nhóm, cùng dải).
  const [mr, ms] = sameColour(ramp, 1);
  ctx.parts.push(part('quillmarks', chevrons(coat, view, sk), mr, zc + 0.01, { group: 'quills', flat: ms, line: false }));
  ctx.parts.push(part('quilltips', mAndNot(ring, g.ball), ramp, 1.5, { group: 'quills', normal: nrm }));
}

/**
 * Răng cưa quanh mặt (nhìn trước): các gai tam giác của lớp gai chĩa từ mép mặt vào trong, sâu `depth`, ở các góc `angles`
 * (độ, 0 = đỉnh trán) trên elip mặt; bỏ phần chạm vùng mắt để mắt luôn nằm trên nền mặt.
 */
function fringe(ctx, cx, cy, rx, ry, angles, depth) {
  const { sk } = ctx;
  const m = newMask();
  for (const a of angles) {
    const t = (a * Math.PI) / 180;
    const x = cx + Math.sin(t) * rx;
    const y = cy - Math.cos(t) * ry;
    let nx = Math.sin(t) / rx;
    let ny = -Math.cos(t) / ry;
    const l = Math.hypot(nx, ny);
    nx /= l;
    ny /= l;
    const b = 1.5;
    mOrInto(m, mTri([x + nx * 0.8 - ny * b, y + ny * 0.8 + nx * b], [x + nx * 0.8 + ny * b, y + ny * 0.8 - nx * b], [x - nx * depth, y - ny * depth]));
  }
  const eyes = mOr(mEllipse(cx - sk.eyeDx, sk.eyeY + 0.5, 3.2, 3.6), mEllipse(cx + sk.eyeDx, sk.eyeY + 0.5, 3.2, 3.6));
  return mAndNot(m, eyes);
}

/** [dải, bậc] của một dải khác `ramp` có màu đúng bằng bậc `step` của `ramp` (bậc 1..3); không có thì chính `ramp`. */
function sameColour(ramp, step) {
  const c = RAMPS[ramp][step];
  for (const [name, r] of Object.entries(RAMPS)) {
    if (name === ramp) continue;
    for (let i = 1; i <= 3; i++) if (r[i] === c) return [name, i];
  }
  return [ramp, step];
}

/** Vân gai: chữ V úp (^) rộng 3, cao 2, so le theo lưới; chỉ giữ chữ nằm trọn trong lớp gai, cách mép 1 px. */
function chevrons(coat, view, sk) {
  const m = newMask();
  const inside = (x, y) => x > 0 && y > 0 && x < FW - 1 && y < FH - 1 && coat[y * FW + x];
  const roomy = (x, y) => [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => inside(x + dx, y + dy));
  const gx = sk.bk < 0.7 ? 5 : 6;
  const gy = 4;
  for (let row = 0, y = 2; y < FH - 2; y += gy, row++) {
    for (let x = (row % 2 ? gx / 2 : 0) + 3; x < FW - 2; x += gx) {
      const X = Math.floor(x);
      const pts = view === 'E' ? [[X, y], [X + 1, y], [X - 1, y + 1]] : [[X, y], [X - 1, y + 1], [X + 1, y + 1]];
      if (!pts.every(([px, py]) => roomy(px, py))) continue;
      for (const [px, py] of pts) m[py * FW + px] = 1;
    }
  }
  return m;
}

/**
 * Cá nóc: gai nhỏ thưa quanh mình; chừa chỗ vây ngực hai bên mặt (tai 'fin'), vây lưng và vây đuôi; không có gai chĩa
 * xuống đất (trông như chân nhện khi bé nảy lên).
 */
const SPIKE_AT = { S: [0, -32, 32, -100, 100], N: [-32, 32, -100, 100], E: [22, 50, 80, 108, -50, -118] };
function spikes(ctx, g) {
  const k = Math.min(1, ctx.sk.bk + 0.4);
  const ring = spikeRing(g, SPIKE_AT[ctx.view], 1.6 + 1.2 * k, 1.0);
  ctx.parts.push(part('spikes', mAndNot(ring, g.ball), ctx.ramps.main, 1.5, { normal: g.nrm }));
}

/**
 * Cá nóc: vây đuôi (quạt, nhìn ngang) và vây lưng (nhìn ngang, nhìn sau), màu điểm nhấn, đung đưa theo pose.tail.
 * Nhìn trước thì cả hai khuất sau mình. Nhìn sau không vẽ vây đuôi: lưỡi vây dọc chỉ rộng 1 - 2 px, trông như dấu "!".
 */
function tailFin(ctx, g) {
  const { view, pose } = ctx;
  const sw = pose.tail ?? 0;
  const acc = ctx.ramps.accent;
  const { box } = g;
  if (view === 'E') {
    const x = box.x0 + 1.2;
    const y = box.cy + 1.0;
    const m = mOr(mTri([x + 1.0, y - 1.4], [x - 4.2, y - 3.6 + sw], [x - 3.4, y + 0.2 + sw * 0.5]), mTri([x + 1.0, y + 1.0], [x - 3.4, y - 0.2 + sw * 0.5], [x - 4.2, y + 3.2 + sw]));
    P(ctx, 'caudal', m, acc, 1, [x - 2, y - 1, 3, 4]);
    const dx = box.cx - box.rx * 0.25;
    const dt = topAt(g, Math.floor(dx)) ?? box.y0;
    P(ctx, 'dorsal', mTri([dx + 2.2, dt + 1.6], [dx - 2.6, dt + 1.4], [dx - 2.4 + sw * 0.3, dt - 2.2]), acc, 1, [dx, dt, 3, 3]);
  } else if (view === 'N') {
    const dt = box.y0;
    P(ctx, 'dorsal', mTri([box.cx - 1.4, dt + 2], [box.cx + 1.4, dt + 2], [box.cx + sw * 0.3, dt - 2.2]), acc, 3, [box.cx, dt, 2, 3]);
  }
}

/** Heo đất: khe bỏ xu trên lưng (nhìn sau và nhìn ngang). */
function coinSlot(ctx, g) {
  const { view, sk } = ctx;
  const R = RAMPS[ctx.ramps.main];
  if (view === 'N') {
    const x = pyRound(sk.head[0]) - 2;
    const y = pyRound(g.box.y0 + 3.2);
    for (let i = 0; i < 4; i++) ctx.pixels.push([x + i, y, R[0], Z_PX], [x + i, y + 1, R[3], Z_PX]);
  } else if (view === 'E') {
    const x = Math.floor(g.box.cx - g.box.rx * 0.15);
    const t = topAt(g, x);
    if (t === null) return;
    for (let i = 0; i < 3; i++) ctx.pixels.push([x - i, (topAt(g, x - i) ?? t) + 1, R[0], Z_PX]);
  }
}

// ---------------------------------------------------------------- vào sổ

function body(ctx) {
  const g = geo(ctx);
  const t = tune(ctx);
  // Điểm neo theo khối tròn (cổ, lưng) đã có sẵn trong ctx.sk.anchors (skeleton.js gọi móc `anchors`, xem ballAnchors).
  // Mép từng hàng của khối cho đồ đeo.
  ctx.ballRows = g.rows;
  const p0 = ctx.parts.length;
  const q0 = ctx.pixels.length;
  torso(ctx, g);
  feet(ctx, g);
  hands(ctx, g);
  if (t.quills) quills(ctx, g);
  if (t.spikes) spikes(ctx, g);
  if (t.tailFin) tailFin(ctx, g);
  if (t.slot) coinSlot(ctx, g);
  // Không gì của thân xuống dưới mặt đất: hàng cuối là hàng 43 (khi đứng), hàng 44 là viền dưới chân.
  const floor = mAbove(ctx.sk.ground);
  for (let i = p0; i < ctx.parts.length; i++) ctx.parts[i].mask = mAnd(ctx.parts[i].mask, floor);
  ctx.pixels.splice(q0, ctx.pixels.length - q0, ...ctx.pixels.slice(q0).filter(([, y]) => y + 0.5 < ctx.sk.ground));
}

/** Vùng đầu = phần trên của khối tròn (mặt, mắt, đồ đội đầu bám vào đây). Cùng khối chiếu sáng với thân: không có đường nối. */
function head(ctx) {
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  const g = geo(ctx);
  const m = mAnd(g.ball, g.domes ? mOr(mEllipse(hcx, hcy, hrx, hry, 0, 2.25), g.domes) : mEllipse(hcx, hcy, hrx, hry, 0, 2.25));
  ctx.headMask = m;
  ctx.parts.push(part('head', m, ctx.ramps.main, ctx.zh, { normal: g.nrm }));
}

// ---------------------------------------------------------------- điểm neo đồ đeo theo khối tròn

/**
 * Cổ không thấp hơn NECK_AT chiều cao khối (tính từ đỉnh đầu) và luôn cao hơn mặt đất ít nhất NECK_MIN px (cả lúc nhún
 * thở, lúc bẹp người trước khi nhảy): bé sơ sinh, nhí nhố có cổ cao thêm chừng 1.5 - 2 px (bản mẫu: 5.1 - 7.2 px).
 */
const NECK_AT = 0.75;
const NECK_MIN = 6.0;
/** Lưng (vai) ở chừng một phần ba trên của khối. */
const BACK_AT = 1 / 3;

/**
 * Điểm neo của dáng tròn, tính từ khối (geo) thay cho thân/đầu elip của skeleton.js (với quả bóng, "vai" và "dưới cằm"
 * theo elip nằm lọt trong khối):
 *  - neck: như skeleton.js, nhưng không thấp hơn NECK_AT chiều cao khối và NECK_MIN trên mặt đất, để khăn, chuông của
 *    bé nhỏ tuổi không chạm đất;
 *  - back: S/N giữa lưng ở một phần ba trên của khối; E ngay trên MÉP SAU thật của khối ở độ cao đó (ba lô, áo choàng
 *    bám vào viền lưng chứ không lọt giữa khối);
 *  - head, face, charm: giữ nguyên.
 * Hàm thuần (không đổi `sk`), trả về bộ điểm neo mới; skeleton.js có thể gọi qua móc `anchors(sk, sp)` của dáng khung.
 */
function ballAnchors(sk, g) {
  const a = sk.anchors;
  const top = sk.htop;
  const bot = Math.min(g.box.y1, sk.ground - Math.max(1, sk.legH)); // cá nóc (không chân): khối chạm đất, tính như có chân
  const neck = [a.neck[0], Math.min(a.neck[1], top + (bot - top) * NECK_AT, sk.ground - NECK_MIN)];
  const by = top + (bot - top) * BACK_AT;
  const back = sk.view === 'E' ? [edgeAt(g, by, -1) + 0.5, by] : [a.back[0], by];
  return { ...a, neck, back };
}

// Đi: nảy như quả bóng, bẹp một chút lúc chạm đất (khung 0 và 3); khung 1 và 4 đã nhún lên 1 px (skeleton.animPoses).
const WALK_SQ = [-0.5, 0, 0, -0.5, 0, 0];
// Loài nhảy cao hơn khi đi (cá nóc, ếch): skeleton.animPoses truyền loài vào walkPose (tham số thứ 3).
const HOP = { ca_noc: [0, -2, -1, 0, -2, -1], ech_sen: [0, -2, -1, 0, -2, -1] };

export default {
  id: 'round',
  /**
   * Cỡ gốc (trước khi nhân theo giai đoạn tuổi), cùng nghĩa với biped.js. Đầu gần bằng thân, lún 4.64 vào thân rồi nhập
   * mềm (geo): bé sơ sinh gần như chỉ có cái đầu tròn; lớn lên thì phần bụng phía dưới nở ra (dáng ngồi, đáy rộng).
   * Điểm neo cổ theo khối (ballAnchors): cách đất 6 px (sơ sinh, nhí nhố) tới 10.6 px (trưởng thành): khăn nằm dưới má,
   * không chạm đất.
   */
  dims: { head: [12.4, 9.6], body: [10.8, 5.9], side: [11.3, 5.9], leg: 1.6, overlap: 4.64, fwd: 1.4, eShift: 1.4, neckE: 'mid' },
  headZ: (view) => (view === 'N' ? 6 : 8),
  body: { S: body, E: body, N: body },
  head: { S: head, E: head, N: head },
  /** Móc của skeleton.js (gọi `arch.anchors?.(sk, sp)` sau khi tính điểm neo): điểm neo cổ và lưng theo khối tròn. */
  anchors: (sk, sp) => ballAnchors(sk, geo({ sk, sp, view: sk.view })),
  walkPose: (i, view, sp) => {
    const hop = sp && HOP[sp.id];
    return hop ? { sq: WALK_SQ[i], lift: hop[i] } : { sq: WALK_SQ[i] };
  },
};
