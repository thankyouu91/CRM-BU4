// Đặc điểm riêng của loài: sổ đăng ký theo `feature` trong shared/pets.js. Chủ sở hữu: họa sĩ đặc điểm.
// Mỗi mục { S, E, N } nhận ctx. Có năm chỗ để vẽ:
//  - trên trán (crystal, drop, gem): điểm z 18, chỉ nhìn trước/ngang; luôn hiện, kể cả khi đội mũ (mũ lún 2 px, trán còn lộ);
//  - trên đỉnh đầu (sprout, flame, pebble, mushroom, crest): điểm z 17, ngồi đúng mép đầu (topAt); đội mũ (ctx.wear.head) thì giấu;
//  - trên má (ember): điểm z 19.5 đè lên má hồng (blush) đã đổi màu cam;
//  - quanh cổ (leafcollar): bộ phận tô bóng nằm trên thân, dưới tay và đầu (z 5.5), không xuống tới chân; đeo đồ cổ thì giấu;
//  - đồ cầm tay (cup): `holds: true` (dáng biped thôi vẽ tay), vẽ vào ctx.held = { pixels, parts }: một lớp riêng,
//    viền riêng, nằm trên khăn cổ và dưới kính/mũ;
//  - sau khi viền (bubble): `over(ctx, img)` vẽ thẳng lên ảnh đã ghép (bong bóng trong suốt, không viền mực).
// crystal, sprout, cup: port nguyên từ pets-pilot (khớp từng điểm ảnh, ảnh mẫu khóa: ĐỪNG sửa gemOn, sprout, cup).
// drop, gem, flame, ember, pebble, mushroom, crest, leafcollar, bubble: vẽ mới ở Rig 2.0 (họa sĩ đặc điểm), cùng mật độ với
// crystal/sprout: điểm tay theo dải màu của bảng, sáng trên-trái. Đặc điểm nằm trên đầu (trán, má, đỉnh) chọn bộ màu tương phản
// nhất với màu đầu của loài (pick) để không chìm: giọt nước đậm hơn trên đầu xanh nhạt, đá sa thạch trên đầu xám...
// Bé sơ sinh, nhí nhố (sk.big): giọt nước 3×5, ngọc 3×3 (không to bằng mắt). Đồ trên đỉnh đầu nhô tối đa 4 hàng (lửa), đá và nấm
// 2-3 hàng, để cú nhảy không chạm mép trên (bộ khớp ô sẽ hạ cú nhảy).
// Tinh chỉnh theo loài: không có bảng riêng; chỉ theo dữ liệu (tai 'fin' đẩy bong bóng ra xa, tai 'horns'/'antler' chỉ một viên
// đá giữa hai sừng, lông xanh lá đổi vòng lá sang màu điểm nhấn). Mọi chỗ đặt theo bộ xương và mặt nạ đầu, nên theo kịp dáng
// round/serpent khi vẽ lại.
import { RAMPS, mAbove, mAnd, mAndNot, mAny, mEllipse, mOrInto, oklab, part, pyRound, setPx } from '../core.js';

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
  // trưởng thành: chóp 1 điểm cao 2 hàng, bụng tròn 4 điểm, chấm sáng trên-trái của bụng
  S: ['.M..', '.LM.', 'LWMM', 'MMMD', '.DD.'],
  E: ['M..', 'LM.', 'WMM', 'MMD', '.D.'],
  // bé sơ sinh, nhí nhố (mắt to 3×4): giọt hẹp 3 × 5, nhìn ngang 2 × 4
  bS: ['.M.', '.M.', 'LWM', 'MMD', '.D.'],
  bE: ['M.', 'LM', 'WM', 'MD'],
};
function drop(ctx) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [L, W, M, D] = pick(ctx, DROP_SETS, 2);
  const [hcx, , hrx] = sk.head;
  const ft = foreheadY(sk);
  const rows = DROP[(sk.big ? 'b' : '') + view];
  const x = view === 'S' ? pyRound(hcx) - (rows[0].length > 3 ? 2 : 1) : pyRound(hcx + hrx * 0.25) - 1;
  pushStamp(ctx, rows, { L, W, M, D }, x, ft - rows.length + 2, 18);
}

/**
 * Ngọc vàng trên trán (hệ Kim, hệ Thổ: chuột chuông, sóc đồng, cú ánh kim, hạc bạc, heo đất, gấu mật, kỳ lân): viên ngọc
 * mài tròn (cabochon) gắn trong ổ viền vàng sẫm (5×4, nhìn ngang 4×4): ổ viền tách viên ngọc khỏi đầu màu nâu vàng (sóc đồng,
 * heo đất, kỳ lân), chấm sáng lấp lánh (đổi màu theo ctx.tick). Bé sơ sinh, nhí nhố (sk.big: mắt to 3×4): hạt ngọc nhỏ 3×3
 * (bốn góc ổ viền, vàng sáng trên-trái, vàng sẫm dưới-phải, chấm sáng giữa) để ngọc không to bằng con mắt. Khác pha lê (thoi xanh).
 */
const GEM = { H: '#fff3c4', Y: '#f4c24f', D: '#d79c1c', L: '#8a5a34' };
const GEM_ROWS = {
  S: ['.LLL.', 'LHgYL', 'LYYDL', '.LLL.'],
  E: ['.LL.', 'LgYL', 'LYDL', '.LL.'],
  big: ['LYL', 'YgD', 'LDL'],
};
function gem(ctx) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [hcx, , hrx] = sk.head;
  const ft = foreheadY(sk);
  const g = ctx.tick % 4 === 0 ? '#fffaf3' : GEM.H;
  const rows = sk.big ? GEM_ROWS.big : GEM_ROWS[view];
  const x = view === 'S' ? pyRound(hcx) - (rows[0].length >> 1) : pyRound(hcx + hrx * 0.25) - 1;
  pushStamp(ctx, rows, { ...GEM, g }, x, ft - 1, 18);
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
 * lập lòe 3 khung theo ctx.tick (ngọn nghiêng phải, thẳng, nghiêng trái). 6 hàng: 4 hàng trên đỉnh đầu, 2 hàng dưới lún vào
 * đỉnh đầu (lửa cao 5 hàng làm khung nhảy chạm mép trên, bộ khớp ô hạ cú nhảy xuống); hàng đáy cam-vàng để lửa vẫn tách khỏi
 * đầu đỏ (rồng lửa, chu tước). Nhìn sau thấy y như nhìn trước.
 * Lửa và mào (ưng lửa, chu tước: tai 'crest'). Quyết định: GIỮ CẢ HAI, lửa không thay mào. Mào kiểu 'plume' của ears.js
 * (nhánh claude/design-pets-ears, họa sĩ tai) xòe hai bên và vuốt ra sau gáy, chừa trống giữa đỉnh đầu cho lửa: nhìn trước/sau
 * lửa mọc giữa hai chỏm lông; nhìn ngang lửa ở đỉnh đầu, chỏm lông ló ra sau gáy. Lửa là điểm (z 17) nên đè lên gốc mào chỗ
 * trùng; ears.js không cần bỏ mào khi có lửa. (Mào tạm của rig cũ trên nhánh rig2, 3×3 ở giữa đỉnh, thì bị lửa che hết.)
 */
const FLAME_KEYS = { R: '#e84a5f', d: '#a84848', O: '#f39b4a', Y: '#f4c24f', W: '#fff3c4' };
const FLAME = [
  ['...R.', '..RO.', '.ROYd', 'ROWYd', 'ROYYO', '.OYO.'],
  ['..R..', '.ROd.', 'ROYOd', 'OYWYd', 'ROYYO', '.OYO.'],
  ['.R...', '.OR..', 'dOYR.', 'ROWYd', 'OYYOR', '.OYO.'],
];
function flame(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const x = pyRound(view === 'E' ? sk.head[0] - 1 : sk.head[0]);
  const rows = FLAME[ctx.tick % 3];
  pushStamp(ctx, rows, FLAME_KEYS, x - 2, topAt(ctx, x) - 4, 17);
}

/**
 * Đá cuội (hệ Thổ: lạc đà, chuột chũi, tê giác đá): một viên to và một viên nhỏ nằm lệch trên đỉnh đầu, bên trái của bé
 * (nhìn trước: bên phải người xem; nhìn sau: bên trái người xem; nhìn ngang: sau đỉnh đầu). Đá xám; trên đầu xám (chuột chũi,
 * tê giác đá) là đá sa thạch nâu vàng (hệ Thổ; đá xám sẫm đáy #3d2a1f nhìn thành búi tóc tối). Đá lún 2 hàng vào mép đầu, chỉ
 * nhô 2 hàng: cao hơn thì khung nhảy chạm mép trên và bộ khớp ô hạ cú nhảy xuống.
 * Đầu có sừng/gạc (tê giác đá): chỉ một viên to, đặt giữa hai sừng (viên nhỏ lệch bên sẽ đè lên sừng phải).
 */
const PEBBLE_SETS = [
  { D: '#6e6660', M: '#9c948a', L: '#c4bcb0', H: '#eef8fb' },
  { D: '#7a4e2c', M: '#b87d4b', L: '#dcb07c', H: '#ecd2a2' },
];
const PEBBLE = ['.LLM....', 'LHMMD.LM', 'MMMDDLMD', '.DDD..D.'];
const PEBBLE_ONE = ['.LLM.', 'LHMMD', 'MMMDD', '.DDD.'];
function pebble(ctx) {
  if (ctx.wear.head) return;
  const { sk, view, sp } = ctx;
  const [hcx, , hrx] = sk.head;
  const keys = pick(ctx, PEBBLE_SETS.map((s) => [s.D, s.M, s.L, s.H]), 1, 0.25);
  const k = { D: keys[0], M: keys[1], L: keys[2], H: keys[3] };
  const horned = sp.ears === 'horns' || sp.ears === 'antler';
  const rows = horned ? PEBBLE_ONE : PEBBLE;
  let x0;
  if (horned) x0 = pyRound(view === 'E' ? hcx + 1.5 : hcx) - 2; // nhìn ngang: trước sừng (sừng ở sau đỉnh đầu)
  else if (view === 'E') x0 = pyRound(hcx - 2) - 3;
  else {
    x0 = pyRound(hcx + hrx * 0.4) - 3;
    if (view === 'N') x0 = pyRound(2 * hcx) - x0 - rows[0].length; // ảnh gương của nhìn trước
  }
  // ngồi trên mép đầu ở cột viên to (cột 1..3 của hình, đã tính lật): hai hàng dưới lún vào đầu
  const col = (i) => (view === 'N' ? x0 + rows[0].length - 1 - i : x0 + i);
  const top = Math.min(topAt(ctx, col(1)), topAt(ctx, col(3)));
  pushStamp(ctx, rows, k, x0, top - 2, 17, view === 'N');
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
  pushStamp(ctx, MUSHROOM, keys, x0, topAt(ctx, cx) - 3, 17, view === 'N');
}

/**
 * Mào rồng (thanh long, hoàng long): hàng gai dọc sống đầu, màu dải điểm nhấn của loài. Nhìn ngang: ba gai ngả về sau, gai
 * giữa cao nhất. Nhìn trước: một vây gai thấp, chân rộng 5 điểm, cao 2 hàng trên đỉnh đầu, mặt trái sáng, mặt phải tối (gai
 * cao mảnh nằm giữa hai gạc nhìn như nhánh gạc thứ ba). Nhìn sau: vây gai trên đỉnh và 2-3 vảy hình chữ V rời nhau dọc gáy, chỉ
 * bậc sáng (nửa trái) và bậc 1 (nửa phải), không dùng bậc 0 (dải liền bậc tối nhìn như đường nứt chẻ đôi đầu), dừng trên
 * ngang tâm đầu.
 * Gai mọc từ đúng mép đầu (topAt), sáng trên-trái.
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
const CREST_FIN = ['..l..', '.llm.', 'llmmd'];
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
  // vây gai giữa đỉnh đầu: hàng đáy phủ lên mép đầu, nhô 2 hàng
  const base = topAt(ctx, x);
  pushStamp(ctx, CREST_FIN, { l: C[3], m: C[2], d: C[1] }, x - 2, base - 2, 17);
  if (view === 'N') {
    // vảy chữ V dọc gáy (rộng 4, đối xứng qua trục đầu), cách nhau 1 hàng
    const y1 = hcy - hry * 0.15;
    for (let y = base + 3, n = 0; y + 1 <= y1 && n < 3; y += 3, n++) {
      P.push([x - 2, y, C[3], 16.5], [x + 1, y, C[1], 16.5], [x - 1, y + 1, C[3], 16.5], [x, y + 1, C[1], 16.5]);
    }
  }
}

// ---------------------------------------------------------------- trên má

/**
 * Than hồng trên má (gấu mèo đỏ, kỳ nhông lửa, heo than): mỗi má một cục than hồng 3×2 thay cho má hồng (blush đổi sang cam).
 * Màu vành cố định, NGOÀI dải màu đầu của ba loài (đầu 'flame', 'salmon' đã có #d65f5f, #f39b4a, #f4c24f): hàng trên đỏ son
 * #e84a5f - lõi trắng nóng - đỏ son; hàng dưới đỏ sẫm #a84848 - vàng lửa - tro #6e2e24 (góc dưới-phải, phía tối). Lõi và
 * điểm vàng lập lòe theo ctx.tick. Lõi sáng cách mắt 1 cột (sát mắt thì nhìn như giọt nước mắt). Cùng hàng với má hồng của
 * eyes() (faces.js), theo cả khi liếc mắt (pose.look), nhưng chỉ vẽ trong mặt nạ đầu: không bao giờ lồi ra khỏi má.
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
  const glow = ctx.tick % 2 ? '#f4c24f' : '#f39b4a';
  const head = ctx.headMask;
  const list = view === 'S' ? [[-1, hcx - sk.eyeDx], [1, hcx + sk.eyeDx]] : [[1, sk.anchors.face[0]]];
  for (const [s, ex] of list) {
    const x0 = Math.floor(ex - ew / 2 + 0.5) + look;
    // cục than 3×2 ngay dưới-ngoài mắt (hàng trên cùng hàng với má hồng)
    const c = view === 'S' && s > 0 ? x0 + ew + 1 : x0 - 2;
    const coal = [[c - 1, y, '#e84a5f'], [c, y, hot], [c + 1, y, '#e84a5f'], [c - 1, y + 1, '#a84848'], [c, y + 1, glow], [c + 1, y + 1, '#6e2e24']];
    for (const [x, yy, col] of coal) if (!head || (x >= 0 && x < 48 && yy >= 0 && yy < 48 && head[yy * 48 + x])) ctx.pixels.push([x, yy, col, 19.5]);
  }
}

// ---------------------------------------------------------------- quanh cổ

/**
 * Vòng lá ở cổ (khỉ tre, cáo lá): một vòng lá nhọn quanh cổ. Nhìn trước: mỗi bên một lá chìa ra khỏi quai hàm (thấy rõ cả khi
 * đầu to che cổ, như cáo lá dáng quad) và một yếm lá ngắn dưới cằm. Nhìn ngang: một lá chìa ra sau gáy, hai lá dưới hàm. Nhìn sau:
 * hai lá ở quai hàm và một hàng lá ngang gáy, nằm trên vai. Các lá gộp thành MỘT bộ phận (mép lá có nét trong khi đè lên thân),
 * mỗi lá có một gân sáng gần ngọn.
 * - Lớp: nằm giữa thân và tay (z 5.5 nhìn trước/ngang: trên thân 4, bụng 4.1, chân quad 5; dưới tay biped 6 và đầu), nên tay
 *   vẫy, tay giơ khi nhảy luôn đè lên lá. Nhìn sau tay biped ở sau thân (z 3): lá trừ chỗ tay ló ra.
 * - Cỡ lá theo thân (sk.bk): bé sơ sinh lá nhỏ; yếm lá không bao giờ xuống tới chân: ngọn lá dừng trên đỉnh bàn chân, và cả vòng
 *   lá bị cắt ở hàng sk.ground - 4 (cùng nhảy, cùng bẹp theo dáng). Cổ sát đất (bé sơ sinh): bỏ hai lá yếm ngoài, chỉ còn lá giữa.
 * - Màu: dải 'grass' (lá tre tươi). Bé lông xanh lá (cáo lá) dùng dải điểm nhấn của loài nếu nó không xanh (cáo lá: 'gold',
 *   lá thu vàng như màu điểm nhấn #f4c45a của dữ liệu), không thì 'orange': lá xanh trên lông xanh chìm hẳn (đã thử 'sprout',
 *   'leaf': trùng 3/5 màu với lông 'grass', nhìn 2x thành một khối xanh).
 * Đeo đồ cổ thì giấu (khăn, vòng... thay chỗ vòng lá).
 */
const isGreen = (ramp) => oklab(RAMPS[ramp][2])[1] < -0.04;
function leafRamp(ctx) {
  const { main, accent } = ctx.ramps;
  if (!isGreen(main)) return 'grass';
  return accent && RAMPS[accent] && !isGreen(accent) ? accent : 'orange';
}
/** Nửa bề ngang của khối đầu (siêu elip n = 2.25) ở hàng y. */
function headHalfW(sk, y) {
  const [, hcy, hrx, hry] = sk.head;
  const t = Math.min(1, Math.abs(y - hcy) / hry);
  return hrx * (1 - t ** 2.25) ** (1 / 2.25);
}
function leafcollar(ctx) {
  if (ctx.wear.neck) return;
  const { sk, view } = ctx;
  const [nx, ny] = sk.anchors.neck;
  const [hcx, hcy, , hry] = sk.head;
  const ramp = leafRamp(ctx);
  const R = RAMPS[ramp];
  const z = view === 'N' ? (ctx.zh > 4.5 ? ctx.zh - 0.2 : 4.05) : 5.5;
  const b = Math.max(0, Math.min(1, (sk.bk - 0.45) / 0.55)); // 0 bé sơ sinh .. 1 trưởng thành
  const wid = 1.1 + 0.2 * b; // nửa bề ngang lá
  const side = 2.1 + 0.6 * b; // nửa chiều dài lá ở quai hàm / sau gáy
  const chin = 1.5 + 0.5 * b; // nửa chiều dài lá yếm
  const floor = sk.ground - 4; // hàng cắt: lá không xuống tới chân
  const low = ny > sk.ground - 6; // cổ sát đất
  // lá: [gốc x, gốc y, góc (rad; 0 = ngọn chúc xuống, dương = ngọn sang phải người xem), nửa chiều dài]
  const leaves = [];
  const chinLeaf = (x, y, a) => {
    // ngọn lá (gốc + 2 × nửa dài theo hướng lá) dừng trên hàng cắt
    const room = (floor - 0.6 - y) / (2 * Math.cos(a));
    const len = Math.min(chin, room);
    if (len >= 0.9) leaves.push([x, y, a, len]);
  };
  // hai lá ở quai hàm mỗi bên: lá trên chìa ngang, lá dưới chúc xuống (gốc lún 1 điểm vào mép đầu)
  const jaw = [[0.38, 1.45], [0.7, 0.85]].map(([f, a]) => {
    const y = hcy + hry * f;
    return [headHalfW(sk, y) - 1.0, y, a];
  });
  if (view === 'E') {
    for (const [jx, jy, a] of jaw) leaves.push([hcx - jx, jy, -a, side]); // chìa ra sau gáy
    chinLeaf(nx - 1.4, ny - 0.8, -0.5);
    chinLeaf(nx + 1.0, ny - 0.8, 0.15);
  } else {
    for (const s of [-1, 1]) for (const [jx, jy, a] of jaw) leaves.push([hcx + s * jx, jy, s * a, side]);
    const k = 0.6 + 0.4 * b;
    if (view === 'N') {
      for (const dx of [-2.4, 0, 2.4]) chinLeaf(nx + dx * k, ny - 1.6, dx * 0.2);
    } else {
      if (!low) for (const s of [-1, 1]) chinLeaf(nx + s * 1.9 * k, ny - 0.9, s * 0.6);
      chinLeaf(nx, ny - 0.6, 0);
    }
  }
  let m = new Uint8Array(48 * 48);
  const tips = [];
  for (const [x, y, a, len] of leaves) {
    const dx = Math.sin(a);
    const dy = Math.cos(a);
    const leaf = mEllipse(x + dx * len, y + dy * len, wid, len, -a, 1.5);
    for (let i = 0; i < m.length; i++) m[i] |= leaf[i];
    tips.push([x + dx * (2 * len - 1.1), y + dy * (2 * len - 1.1)]);
  }
  m = mAnd(m, mAbove(floor));
  // nhìn sau: tay biped (z 3, sau thân) ló ra hai bên thân thì nằm trên lá
  if (view === 'N') {
    const body = ctx.parts.find((p) => p.name === 'body');
    for (const p of ctx.parts) if (/^arm/.test(p.name)) m = mAndNot(m, body ? mAndNot(p.mask, body.mask) : p.mask);
  }
  if (!mAny(m)) return;
  ctx.parts.push(part('leafcollar', m, ramp, z, { normal: [hcx - 2, hcy + hry * 0.3, sk.head[2] + 3, hry * 0.8 + 3] }));
  // gân lá sáng: một điểm gần ngọn mỗi lá, chỉ chỗ lá thấy được (không bộ phận nào ở trên che)
  const cover = new Uint8Array(48 * 48);
  for (const p of ctx.parts) if (p.z > z) mOrInto(cover, p.mask);
  const vein = R[4] === '#fffaf3' ? R[3] : R[4];
  for (const [tx, ty] of tips) {
    const x = Math.floor(tx);
    const y = Math.floor(ty);
    const k = y * 48 + x;
    if (x >= 0 && x < 48 && y >= 0 && y < 48 && m[k] && !cover[k]) ctx.pixels.push([x, y, vein, 16]);
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
 * bong bóng nhỏ 2×2, bay lên cạnh đầu theo ctx.tick (chu kỳ 6 khung, lệch pha nhau 3 khung), lên tới đỉnh thì bóng to vỡ thành 4 chấm.
 * Bay bên tay phải của bé, từ ngang trán lên đỉnh đầu: nhìn trước = bên trái người xem, nhìn sau = bên phải người xem, nhìn
 * ngang = trước trán, cao hơn mõm/mỏ. Rig cũ để bên phải người xem, nhưng đó là phía bùa (charm) bay (luôn bên trái của bé),
 * bóng bay/đèn lồng sẽ chồng lên bong bóng.
 * Bóng nhỏ đi đường riêng: ra xa đầu hơn bóng to (cách 1 cột) và thấp hơn (từ ngang má lên), nên ở mọi khung hai bóng không
 * chung hàng nào và không chạm nhau (khung 0, khung đứng yên của bảng hướng, là hai bóng tách rời). Tai vây (cá nóc, kỳ giông):
 * cả hai bóng dời ra xa thêm 2 cột để bóng không đè lên vây. Luôn trong cột/hàng 1..46.
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
  // phía tay phải của bé (bùa luôn bay bên trái của bé, nên hai thứ không chồng nhau): nhìn trước = trái người xem,
  // nhìn sau = phải người xem; nhìn ngang = trước mặt (bùa ở sau lưng).
  const side = view === 'S' ? -1 : 1;
  const top = pyRound(sk.htop);
  const out = ctx.sp.ears === 'fin' ? 2 : 0; // tai vây chìa ra hai bên đầu: bóng ra xa hơn
  // bong bóng to (4×4): 6 bước, từ ngang trán bay lên tới đỉnh đầu, lắc 1 điểm ở bước 2 và 5; bước cuối vỡ
  const k = ctx.tick % 6;
  const x0 = side > 0 ? pyRound(hcx + hrx) + 2 + out : pyRound(hcx - hrx) - 6 - out;
  const bx = Math.max(1, Math.min(43, x0 + (k % 3 === 2 ? side : 0)));
  const by = Math.max(1, Math.min(43, top + 4 - k));
  if (k === 5) popBubble(img, bx, by);
  else bigBubble(img, bx, by);
  // bong bóng nhỏ (2×2): lệch pha 3 khung, đi đường thấp hơn 7 hàng và ra ngoài bóng to (cách 1 cột)
  const j = (ctx.tick + 3) % 6;
  if (j < 5) {
    const sx = Math.max(1, Math.min(45, side > 0 ? x0 + 5 : x0 - 3));
    let sy = Math.max(1, Math.min(45, top + 11 - j));
    // bị ép vào mép ô mà chạm bóng to: xuống dưới bóng to, cách 1 hàng
    if (k < 5 && sx + 1 >= bx - 1 && sx <= bx + 4 && sy + 1 >= by - 1 && sy <= by + 4) sy = Math.min(45, by + 5);
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
