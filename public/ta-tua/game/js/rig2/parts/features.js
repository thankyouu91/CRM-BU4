// Đặc điểm riêng của loài: sổ đăng ký theo `feature` trong shared/pets.js. Chủ sở hữu: họa sĩ đặc điểm.
// Mỗi mục { S, E, N } nhận ctx. Có năm chỗ để vẽ:
//  - trên trán (crystal, drop, gem): điểm z 18, chỉ nhìn trước/ngang; luôn hiện, kể cả khi đội mũ (mũ lún 2 px, trán còn lộ);
//  - trên đỉnh đầu (sprout, flame, pebble, mushroom, crest): điểm z 17, ngồi đúng mép đầu (topAt); đội mũ (ctx.wear.head) thì giấu;
//  - trên má (ember): điểm z 19.5 đè lên má hồng (blush) đã đổi màu cam;
//  - quanh cổ (leafcollar): bộ phận tô bóng giữa thân và đầu; đeo đồ cổ (ctx.wear.neck) thì giấu;
//  - đồ cầm tay (cup): `holds: true` (dáng biped thôi vẽ tay), vẽ vào ctx.held = { pixels, parts }: một lớp riêng,
//    viền riêng, nằm trên khăn cổ và dưới kính/mũ;
//  - sau khi viền (bubble): `over(ctx, img)` vẽ thẳng lên ảnh đã ghép (bong bóng trong suốt, không viền mực).
// crystal, sprout, cup: port nguyên từ pets-pilot (khớp từng điểm ảnh, ảnh mẫu khóa: ĐỪNG sửa gemOn, sprout, cup).
// drop, gem, flame, ember, pebble, mushroom, crest, leafcollar, bubble: vẽ mới ở Rig 2.0 (họa sĩ đặc điểm), cùng mật độ với
// crystal/sprout: điểm tay theo dải màu của bảng, sáng trên-trái. Đặc điểm nằm trên đầu (trán, má, đỉnh) chọn bộ màu tương phản
// nhất với màu đầu của loài (pick) để không chìm: giọt nước đậm hơn trên đầu xanh nhạt, đá sẫm hơn trên đầu xám...
// Tinh chỉnh theo loài: không có (mọi chỗ đặt theo bộ xương và mặt nạ đầu, nên theo kịp dáng round/serpent khi vẽ lại).
import { RAMPS, mEllipse, oklab, part, pyRound, setPx } from '../core.js';

const none = () => {};
const all = (fn) => ({ S: fn, E: fn, N: fn });

// ---------------------------------------------------------------- tiện ích

/** Khác biệt màu OKLab (như nearestRamp của ramps.js: dL ×2, da/db ×3). */
function dist(a, b) {
  const [L1, a1, b1] = oklab(a);
  const [L2, a2, b2] = oklab(b);
  return Math.hypot(2 * (L1 - L2), 3 * (a1 - a2), 3 * (b1 - b2));
}

/**
 * Chọn bộ màu: bộ đầu tiên (mặc định) nếu màu `key` của nó đủ khác hai tông đầu (bậc giữa và sáng của dải thân),
 * không thì bộ khác tông đầu nhiều nhất. Để giọt nước, ngọc, đá không chìm vào đầu cùng màu.
 */
function pick(ctx, sets, key, min = 0.3) {
  const R = RAMPS[ctx.ramps.main];
  const tones = [R[2], R[3]];
  const score = (s) => Math.min(...tones.map((t) => dist(s[key], t)));
  if (score(sets[0]) >= min) return sets[0];
  let best = sets[0];
  let bd = -1;
  for (const s of sets) {
    const d = score(s);
    if (d > bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Hàng trên cùng của đầu ở cột x (theo ctx.headMask), để đồ trên đỉnh đầu ngồi đúng mép cong của đầu. */
function topAt(ctx, x) {
  const m = ctx.headMask;
  const xi = Math.max(0, Math.min(47, x));
  if (m) for (let y = 0; y < 48; y++) if (m[y * 48 + xi]) return y;
  return pyRound(ctx.sk.htop);
}

/** Đẩy hình từ bản đồ ký tự vào ctx.pixels (góc trên-trái x0, y0; flip: lật ngang). keys: ký tự → màu ('.' bỏ trống). */
function pushStamp(ctx, rows, keys, x0, y0, z, flip = false) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = keys[ch];
    if (!c) return;
    ctx.pixels.push([x0 + (flip ? row.length - 1 - i : i), y0 + j, c, z]);
  }));
}

/** Hàng trán: nơi đặt ngọc (giống ngọc pha lê của bản mẫu). */
const foreheadY = (sk) => pyRound(sk.htop + Math.max(2.5, sk.head[3] * 0.36));

// ---------------------------------------------------------------- ngọc trán

/** Ngọc hình thoi 5 điểm (nhìn trước) hoặc 3 điểm (nhìn ngang). C = [đáy tối, hai cạnh, đỉnh, tâm sáng]. */
function gemOn(C) {
  return (ctx) => {
    const { sk, view } = ctx;
    if (view === 'N') return;
    const [hcx, , hrx, hry] = sk.head;
    const ft = pyRound(sk.htop + Math.max(2.5, hry * 0.36));
    const fx = pyRound(view === 'S' ? hcx : hcx + hrx * 0.25);
    if (view === 'S') ctx.pixels.push([fx - 1, ft, C[1], 18], [fx, ft - 1, C[2], 18], [fx, ft, C[3], 18], [fx + 1, ft, C[1], 18], [fx, ft + 1, C[0], 18]);
    else ctx.pixels.push([fx, ft, C[2], 18], [fx, ft - 1, C[3], 18], [fx, ft + 1, C[1], 18]);
  };
}

/**
 * Giọt nước trên trán (hệ Thủy: rái cá, mèo mưa, rùa biển, cá chép rồng, huyền vũ): đầu nhọn hướng lên, bụng tròn,
 * chấm sáng trên-trái. Bộ màu [viền sáng, chấm sáng, giữa, tối]: nước trong; nước đậm (đầu xanh nhạt); nước nhạt (đầu xanh đậm).
 */
const DROP_SETS = [
  ['#8fd0e8', '#eef8fb', '#58b9d6', '#3f8fc0'],
  ['#58b9d6', '#eef8fb', '#3f8fc0', '#2f6f9a'],
  ['#bfe3f2', '#fffaf3', '#8fd0e8', '#58b9d6'],
];
const DROP = {
  S: ['.M.', 'LWM', 'MMD', '.D.'],
  E: ['M.', 'WM', 'MD', 'D.'],
};
function drop(ctx) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [L, W, M, D] = pick(ctx, DROP_SETS, 2);
  const [hcx, , hrx] = sk.head;
  const ft = foreheadY(sk);
  const x = view === 'S' ? pyRound(hcx) - 1 : pyRound(hcx + hrx * 0.25);
  pushStamp(ctx, DROP[view], { L, W, M, D }, x, ft - 1, 18);
}

/**
 * Ngọc vàng trên trán (hệ Kim, hệ Thổ: chuột chuông, sóc đồng, cú ánh kim, hạc bạc, heo đất, gấu mật, kỳ lân): viên ngọc
 * mài tròn (cabochon) gắn trong ổ viền vàng sẫm (5×4, nhìn ngang 4×4): ổ viền tách viên ngọc khỏi đầu màu nâu vàng (sóc đồng,
 * heo đất, kỳ lân), chấm sáng lấp lánh (đổi màu theo ctx.tick). Khác pha lê (thoi xanh 5 điểm).
 */
const GEM = { H: '#fff3c4', Y: '#f4c24f', D: '#d79c1c', L: '#8a5a34' };
const GEM_ROWS = {
  S: ['.LLL.', 'LHgYL', 'LYYDL', '.LLL.'],
  E: ['.LL.', 'LgYL', 'LYDL', '.LL.'],
};
function gem(ctx) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [hcx, , hrx] = sk.head;
  const ft = foreheadY(sk);
  const g = ctx.tick % 4 === 0 ? '#fffaf3' : GEM.H;
  const x = view === 'S' ? pyRound(hcx) - 2 : pyRound(hcx + hrx * 0.25) - 1;
  pushStamp(ctx, GEM_ROWS[view], { ...GEM, g }, x, ft - 1, 18);
}

// ---------------------------------------------------------------- trên đỉnh đầu

/** Mầm lá (thỏ lá, ếch sen...). */
function sprout(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const [hcx] = sk.head;
  const x = pyRound(view !== 'E' ? hcx : hcx - 1);
  const y = pyRound(sk.htop);
  const Gr = RAMPS.fur_green;
  const pts = [[x, y - 1, '#4e9a45'], [x, y - 2, '#4e9a45'], [x - 1, y - 3, Gr[2]], [x - 2, y - 3, Gr[2]], [x - 2, y - 4, Gr[3]],
    [x + 1, y - 3, Gr[2]], [x + 2, y - 3, Gr[1]], [x + 2, y - 4, Gr[2]]];
  for (const [a, b, c] of pts) ctx.pixels.push([a, b, c, 17]);
}

/**
 * Chỏm lửa (hệ Hỏa: cáo lửa, lân con, rồng lửa, ưng lửa, ngựa lửa, chu tước): ba lưỡi lửa đỏ-cam-vàng, lõi vàng nhạt,
 * lập lòe 3 khung theo ctx.tick (ngọn nghiêng trái, thẳng, nghiêng phải). Hai hàng dưới lún vào đỉnh đầu; hàng đáy cam-vàng
 * để lửa vẫn tách khỏi đầu đỏ (rồng lửa, chu tước). Nhìn sau thấy y như nhìn trước.
 */
const FLAME_KEYS = { R: '#e84a5f', d: '#a84848', O: '#f39b4a', Y: '#f4c24f', W: '#fff3c4' };
const FLAME = [
  ['...R.', '..RR.', '.ROR.', '.OYOd', 'ROWYd', 'ROYYO', '.OYO.'],
  ['..R..', '.RRd.', '.ROd.', 'ROYOd', 'OYWYd', 'ROYYO', '.OYO.'],
  ['.R...', '.RR..', '.ROR.', 'dOYO.', 'ROWYd', 'OYYOR', '.OYO.'],
];
function flame(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const x = pyRound(view === 'E' ? sk.head[0] - 1 : sk.head[0]);
  const rows = FLAME[ctx.tick % 3];
  pushStamp(ctx, rows, FLAME_KEYS, x - 2, topAt(ctx, x) - 5, 17);
}

/**
 * Đá cuội (hệ Thổ: lạc đà, chuột chũi, tê giác đá): một viên to và một viên nhỏ nằm lệch trên đỉnh đầu, bên trái của bé
 * (nhìn trước: bên phải người xem; nhìn sau: bên trái người xem; nhìn ngang: sau đỉnh đầu). Đá xám, hoặc đá sẫm trên đầu xám.
 */
const PEBBLE_SETS = [
  { D: '#6e6660', M: '#9c948a', L: '#c4bcb0', H: '#eef8fb' },
  { D: '#3d2a1f', M: '#6e6660', L: '#9c948a', H: '#c4bcb0' },
];
const PEBBLE = ['.LLM....', 'LHMMD.LM', 'MMMDDLMD', '.DDD..D.'];
function pebble(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const keys = pick(ctx, PEBBLE_SETS.map((s) => [s.D, s.M, s.L, s.H]), 1, 0.25);
  const k = { D: keys[0], M: keys[1], L: keys[2], H: keys[3] };
  let cx;
  if (view === 'S') cx = pyRound(hcx + hrx * 0.32);
  else if (view === 'N') cx = pyRound(hcx - hrx * 0.32) - 1;
  else cx = pyRound(hcx - 2);
  const x0 = cx - 3;
  // ngồi trên mép đầu ở cột viên to (cột 1..3 của hình): hàng đáy lún vào đầu 1 hàng
  const top = Math.min(topAt(ctx, x0 + 1), topAt(ctx, x0 + 3));
  pushStamp(ctx, PEBBLE, k, x0, top - 3, 17, view === 'N');
}

/**
 * Nấm đội đầu (sóc nấm): mũ nấm đỏ chấm trắng, chân kem, mọc lệch bên phải của bé (nhìn trước: bên trái người xem;
 * nhìn sau: bên phải người xem; nhìn ngang: phía gần, ngay đỉnh đầu). Mũ nấm dùng dải điểm nhấn đỏ của loài.
 */
const MUSHROOM = ['..lRR..', '.lWRRd.', 'lRRRWRd', '.ddddd.', '..sS...'];
function mushroom(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const R = RAMPS.red;
  const keys = { l: R[3], R: R[2], d: R[1], W: '#fffaf3', s: '#fbf1e3', S: '#ecd2a2' };
  let cx;
  if (view === 'S') cx = pyRound(hcx - hrx * 0.3) - 1;
  else if (view === 'N') cx = pyRound(hcx + hrx * 0.3);
  else cx = pyRound(hcx);
  const x0 = cx - 3;
  pushStamp(ctx, MUSHROOM, keys, x0, topAt(ctx, cx) - 4, 17, view === 'N');
}

/**
 * Mào rồng (thanh long, hoàng long): hàng gai dọc sống đầu, màu dải điểm nhấn của loài. Nhìn trước: một gai giữa trán;
 * nhìn ngang: ba gai ngả về sau, gai giữa cao nhất; nhìn sau: gai trên đỉnh và dải vảy chạy xuống gáy.
 * Gai mọc từ đúng mép đầu (topAt), mặt trái sáng, mặt phải tối (sáng trên-trái).
 */
function spine(ctx, x, h, C, z = 17) {
  // gai cao h, gốc rộng 3 ở hàng ngay trên mép đầu tại cột x, ngọn ngả về sau (trái) 1 điểm
  const base = topAt(ctx, x);
  const P = ctx.pixels;
  for (let j = 0; j < h; j++) {
    const y = base - 1 - j;
    if (j === h - 1) P.push([x - (h > 2 ? 1 : 0), y, C[3], z]);
    else if (j === h - 2) P.push([x - 1, y, C[3], z], [x, y, C[2], z]);
    else P.push([x - 1, y, C[3], z], [x, y, C[2], z], [x + 1, y, C[1], z]);
  }
  P.push([x - 1, base, C[2], z], [x, base, C[1], z], [x + 1, base, C[1], z]);
}
function crest(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const [hcx, hcy, hrx, hry] = sk.head;
  const C = RAMPS[ctx.ramps.accent];
  const P = ctx.pixels;
  const x = pyRound(hcx);
  if (view === 'E') {
    const s = Math.max(0.8, hrx / 10.9);
    spine(ctx, pyRound(hcx + 1.5 * s), 3, C);
    spine(ctx, pyRound(hcx - 2.2 * s), 4, C);
    spine(ctx, pyRound(hcx - 5.8 * s), 3, C);
    return;
  }
  // gai giữa: thẳng đứng, đối xứng hơn gai nhìn ngang
  const base = topAt(ctx, x);
  const rows = ['.l.', '.lm', 'lmd', 'lmd', 'mdd'];
  pushStamp(ctx, rows, { l: C[3], m: C[2], d: C[1] }, x - 1, base - 4, 17);
  if (view === 'N') {
    // dải vảy xuống gáy: hai cột giữa, sáng/tối xen kẽ
    const y1 = pyRound(hcy + hry * 0.35);
    for (let y = base + 1; y <= y1; y++) {
      const k = (y - base) % 3;
      P.push([x - 1, y, k === 0 ? C[1] : C[2], 16.5], [x, y, k === 0 ? C[0] : C[1], 16.5]);
    }
  }
}

// ---------------------------------------------------------------- trên má

/**
 * Than hồng trên má (gấu mèo đỏ, kỳ nhông lửa, heo than): mỗi má một đốm than hồng thay cho má hồng (blush đổi sang cam):
 * hàng trên cam - lõi vàng sáng - cam, hàng dưới một điểm đỏ; lõi và điểm đỏ lập lòe theo ctx.tick. Lõi sáng cách mắt 1-2 cột
 * (sát mắt thì nhìn như giọt nước mắt). Cùng hàng với má hồng của eyes() (faces.js), theo cả khi liếc mắt (pose.look).
 * Nhìn sau không thấy má.
 */
function ember(ctx) {
  const { sk, view, pose } = ctx;
  if (view === 'N') return;
  const [hcx] = sk.head;
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  const look = pose.look ?? 0;
  const y = Math.floor(sk.eyeY - eh / 2 + 0.5) + eh;
  const hot = ctx.tick % 2 ? '#fffaf3' : '#fff3c4';
  const low = ctx.tick % 2 ? '#e84a5f' : '#d65f5f';
  const list = view === 'S' ? [[-1, hcx - sk.eyeDx], [1, hcx + sk.eyeDx]] : [[1, sk.anchors.face[0]]];
  for (const [s, ex] of list) {
    const x0 = Math.floor(ex - ew / 2 + 0.5) + look;
    // má 3 điểm ngay dưới-ngoài mắt (cùng hàng với má hồng): cam - lõi sáng - cam, hàng dưới một điểm đỏ
    const c = view === 'S' && s > 0 ? x0 + ew + 1 : x0 - 2;
    ctx.pixels.push([c - 1, y, '#f39b4a', 19.5], [c, y, hot, 19.5], [c + 1, y, '#f39b4a', 19.5], [c, y + 1, low, 19.5]);
  }
}

// ---------------------------------------------------------------- quanh cổ

/**
 * Vòng lá ở cổ (khỉ tre, cáo lá): một vòng lá nhọn xòe ra quanh cổ như bờm lá. Lá giữa rủ xuống dưới cằm, lá hai bên chìa ra
 * khỏi má (nhìn trước/sau thấy rõ cả khi đầu to che cổ, như cáo lá dáng quad). Các lá gộp thành MỘT bộ phận nằm sau đầu
 * (mép đầu có nét trong chỗ lá chui ra, mép lá có nét trong khi đè lên thân), mỗi lá có một gân sáng.
 * Nhìn ngang: lá dưới hàm và lá chìa ra sau gáy. Nhìn sau: lá hai bên và một hàng lá ngang gáy, nằm trên vai.
 * Màu: dải 'grass' (lá tre tươi); bé lông xanh lá (cáo lá) dùng 'sprout' (lá non xanh nhạt) để vòng lá không chìm vào lông
 * (đã thử 'leaf' đậm hơn một bậc: trùng bậc tối của lông, nhìn 2x thành vệt bẩn).
 * Đeo đồ cổ thì giấu (khăn, vòng... thay chỗ vòng lá).
 */
function leafcollar(ctx) {
  if (ctx.wear.neck) return;
  const { sk, view } = ctx;
  const [nx, ny] = sk.anchors.neck;
  const [hcx, hcy, hrx, hry] = sk.head;
  const green = oklab(RAMPS[ctx.ramps.main][2])[1] < -0.04;
  const ramp = green ? 'sprout' : 'grass';
  const R = RAMPS[ramp];
  const z = view === 'N' ? (ctx.zh > 4.5 ? ctx.zh - 0.2 : 4.05) : ctx.zh - 0.2;
  const k = Math.min(1, hrx / 10.9);
  // lá: [tâm x, tâm y, góc nghiêng (rad, dương = ngọn ngả sang phải), dài]; lá hướng ngọn xuống
  let leaves;
  if (view === 'E') {
    const by = hcy + hry * 0.62;
    leaves = [
      [hcx - hrx + 0.6, by - 1.0, 1.25, 2.5], // chìa ra sau gáy
      [hcx - hrx * 0.45, hcy + hry + 0.6, 0.55, 2.3],
      [hcx + hrx * 0.05, hcy + hry + 1.0, 0.2, 2.3],
    ];
  } else {
    const sy = hcy + hry * 0.5;
    leaves = [];
    for (const s of [-1, 1]) {
      leaves.push([hcx + s * (hrx - 0.3), sy + 0.6, -s * 0.95, 2.5]); // chìa ra khỏi má
      leaves.push([hcx + s * hrx * 0.68, hcy + hry * 0.92, -s * 0.7, 2.4]);
      leaves.push([nx + s * 2.3 * k, ny + 1.5, -s * 0.25, 2.3]);
    }
    leaves.push([nx, ny + 2.0, 0, 2.3]);
  }
  const m = new Uint8Array(48 * 48);
  for (const [cx, cy, rot, len] of leaves) {
    // ngọn lá hướng ra ngoài: dời tâm theo hướng ngọn để gốc lá nằm sau đầu
    const leaf = mEllipse(cx - Math.sin(rot) * 0.6, cy + Math.cos(rot) * 0.6, 1.5 * Math.max(0.85, k), len * Math.max(0.85, k), -rot, 1.6);
    for (let i = 0; i < m.length; i++) m[i] |= leaf[i];
  }
  ctx.parts.push(part('leafcollar', m, ramp, z, { normal: [hcx - 2, hcy + hry * 0.3, hrx + 3, hry * 0.8 + 3] }));
  // gân lá sáng: một điểm gần ngọn mỗi lá (chỉ chỗ lá thấy được: trong vòng lá, ngoài đầu)
  const head = view === 'N' && ctx.zh < 4.5 ? null : ctx.headMask;
  for (const [cx, cy, rot] of leaves) {
    const x = Math.floor(cx - Math.sin(rot) * 1.4 + 0.5);
    const y = Math.floor(cy + Math.cos(rot) * 1.4 + 0.5);
    if (x >= 0 && x < 48 && y >= 0 && y < 48 && m[y * 48 + x] && !(head && head[y * 48 + x])) ctx.pixels.push([x, y, R[4], 16]);
  }
}

// ---------------------------------------------------------------- đồ cầm tay: cốc trà sữa của Boba

const CUPS = {
  // nắp kín trắng, trà sữa caramel, trân châu (toàn màu trong bảng)
  big: ['wWWWWWw', 'tTttttd', 'tTttttd', '.Ttttd.', '.tptpd.', '.ptptp.', '.ppppp.'],
  small: ['wWWWw', 'tTttd', 'tTptd', '.ppp.'],
};
const CUP_KEYS = { W: '#fffaf3', w: '#ecd8bf', T: '#ecd2a2', t: '#dcb07c', d: '#c8915f', p: '#3d2a1f' };

/** Ôm ở ngang ngực, ống hút hồng lên tới miệng; tay nào không giơ lên thì ôm cốc. */
function cup(ctx) {
  const { sk, view, pose } = ctx;
  if (view === 'N') return;
  const [bcx, bcy, brx, bry] = sk.body;
  const small = brx < 5.0;
  const rows = CUPS[small ? 'small' : 'big'];
  const cw = rows[0].length;
  const ch = rows.length;
  const mouthY = pyRound(sk.eyeY + 4.0);
  const cx0 = view === 'S' ? pyRound(bcx - cw / 2) : pyRound(bcx + brx - 2.5);
  let cy0 = Math.max(mouthY + 2, pyRound(bcy - bry * 0.35));
  cy0 = Math.min(cy0, pyRound(sk.ground) - ch - 1);
  const held = ctx.held;
  rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (CUP_KEYS[c]) held.pixels.push([cx0 + i, cy0 + j, CUP_KEYS[c], 9]);
  }));
  const sx = view === 'E' ? cx0 + Math.floor(cw / 2) + 1 : cx0 + Math.floor(cw / 2);
  for (let y = mouthY; y < cy0; y++) held.pixels.push([sx, y, '#d9708a', 9]);
  const pr = small ? 1.3 : 1.6;
  for (const s of view === 'S' ? [-1, 1] : [-1]) {
    let px;
    let py;
    if (view === 'S') {
      const up = s > 0 ? pose.armR ?? 0 : pose.armL ?? 0;
      if (up) continue;
      px = s < 0 ? cx0 - 0.1 : cx0 + cw + 0.1;
      py = cy0 + ch * 0.5;
    } else {
      px = cx0 + 0.4;
      py = cy0 + ch * 0.5;
    }
    held.parts.push(part(`cuppaw${s}`, mEllipse(px, py, pr + 0.3, pr), ctx.ramps.main, 9.5, { normal: [px - 0.5, py - 1, pr + 1, pr + 1] }));
  }
}

// ---------------------------------------------------------------- sau khi viền

/**
 * Bong bóng (hải cẩu, cá nóc, kỳ giông, vịt mây): một bong bóng tròn 4×4 trong suốt (vành xanh, chấm sáng trên-trái) và một
 * bong bóng nhỏ, bay lên cạnh đầu theo ctx.tick (chu kỳ 6 khung, lệch pha nhau), lên tới đỉnh thì vỡ thành 4 chấm.
 * Nhìn trước: bên trái của bé (bên phải người xem, như rig cũ), từ ngang trán lên đỉnh đầu (trên vây tai, trên bùa);
 * nhìn ngang: trước trán, cao hơn mõm/mỏ; nhìn sau: bên trái người xem. Luôn trong cột/hàng 1..46.
 */
const RING = '#58b9d6';
const SHINE = '#eef8fb';
const SMALL = '#8fd0e8';
const put = (img, x, y, c) => {
  if (x >= 1 && y >= 1 && x <= 46 && y <= 46) setPx(img, x, y, c);
};
function bigBubble(img, x, y) {
  for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]]) put(img, x + dx, y + dy, RING);
  put(img, x + 1, y + 1, SHINE);
}
function popBubble(img, x, y) {
  for (const [dx, dy] of [[0, 0], [3, 0], [0, 3], [3, 3]]) put(img, x + dx, y + dy, SMALL);
}
function bubbleOver(ctx, img) {
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const side = view === 'N' ? -1 : 1;
  const top = pyRound(sk.htop);
  // bong bóng to (4×4): 6 bước, từ ngang trán bay lên tới đỉnh đầu, lắc 1 điểm ở bước 2 và 5; bước cuối vỡ
  const k = ctx.tick % 6;
  const x0 = side > 0 ? pyRound(hcx + hrx) + 2 : pyRound(hcx - hrx) - 6;
  const bx = Math.max(1, Math.min(43, x0 + (k % 3 === 2 ? side : 0)));
  const by = Math.max(1, Math.min(43, top + 4 - k));
  if (k === 5) popBubble(img, bx, by);
  else bigBubble(img, bx, by);
  // bong bóng nhỏ (2×2): lệch pha 3 khung, thấp hơn và ra xa đầu hơn
  const j = (ctx.tick + 3) % 6;
  if (j < 5) {
    const sx = Math.max(1, Math.min(45, x0 + (side > 0 ? 4 : -2)));
    const sy = Math.max(1, Math.min(45, top + 8 - j));
    put(img, sx, sy, SHINE);
    put(img, sx + 1, sy, SMALL);
    put(img, sx, sy + 1, SMALL);
    put(img, sx + 1, sy + 1, RING);
  }
}

/** Sổ đăng ký: đặc điểm → { S, E, N } (+ holds, over, blush). */
export const FEATURES = {
  none: all(none),
  crystal: all(gemOn(['#2f6f9a', '#58b9d6', '#8fd0e8', '#eef8fb'])),
  sprout: all(sprout),
  cup: { ...all(cup), holds: true },
  drop: all(drop),
  gem: all(gem),
  flame: all(flame),
  pebble: all(pebble),
  mushroom: all(mushroom),
  crest: all(crest),
  leafcollar: all(leafcollar),
  bubble: { ...all(none), over: bubbleOver },
  ember: { ...all(ember), blush: '#f39b4a' },
};

/** Đặc điểm chưa vẽ lại theo bản mẫu. Đã vẽ hết; đặc điểm lạ: không vẽ gì. */
export const FALLBACK = {};

export const featureFor = (kind) => FEATURES[kind] ?? FALLBACK[kind] ?? FEATURES.none;
