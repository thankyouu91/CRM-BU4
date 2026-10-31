// Đuôi: sổ đăng ký theo `tail` của từng loài trong shared/pets.js. Chủ sở hữu: họa sĩ đuôi.
// Mỗi mục { S, E, N }: hàm vẽ nhận ctx, đẩy bộ phận vào ctx.parts. Đuôi nằm sau thân khi nhìn trước/ngang (z = 1)
// và trước thân khi nhìn sau (z = 8). ctx.pose.tail ∈ {−1, 0, 1} làm chóp đuôi đung đưa.
// flat, thin, puff, nub: port nguyên từ pets-pilot (khớp từng điểm ảnh, ảnh mẫu kiểm thử khóa lại: đừng sửa).
// fluffy, curl, fan, dragon, fish: Rig 2.0 (họa sĩ G), ĐÃ XONG, đủ S/E/N, mọi giai đoạn tuổi; FALLBACK nay để trống.
//   fluffy  đuôi chổi lông xù, 4 dáng (sóc, cáo, sói, ngựa) + chóp khác màu + túm lông nhọn; gấu mèo đỏ có khoanh;
//   curl    heo: vòng xoắn nhỏ có lỗ; chó: đuôi cuộn trên lưng, mặt trong màu bụng;
//   fan     đuôi chim, mỗi loài một bộ lông vũ (gà con, gà trống, hạc, vịt, ưng, chu tước): gốc ở mông khi nhìn ngang,
//           chóp ló hai bên hông dưới cánh khi nhìn trước, xòe phá viền thân khi nhìn sau, 2-3 mảng màu (FANS);
//   dragon  đuôi rồng dày thuôn, bụng đuôi màu bụng, gai lưng, chùm lông/lửa ở chóp;
//   fish    cuống đuôi màu thân + vây đuôi chẻ đôi màu điểm nhấn, mép vây sáng (cá chép rồng);
//   snake   (SPECIES_TAIL, Huyền Vũ) đuôi rắn chui ra từ vành mai khi nhìn sau.
// Mọi bộ phận đuôi đều có tên và nhóm bắt đầu bằng 'tail' (dáng khung tự vẽ đuôi lọc bỏ được hết bằng tiền tố).
// Ghi chú cho người ghép nhánh: cả 9 loài dùng TAILS.dragon / TAILS.fish đều là 5 loài serpent; nhánh serpent bỏ đuôi
// của file này (dropForeignTail) và tự vẽ chóp đuôi, nên dragon / fish ở đây chỉ còn là đuôi dự phòng cho dáng khác.
// Đuôi mới luôn nằm trong ô và trên mặt đất (settle), lộ ra ngoài bóng đầu chibi (clearOfHead, hugSide). Tinh chỉnh: TUNE.
import { FH, FW, mAnd, mAndNot, mChain, mEllipse, mOr, mTri, part } from '../core.js';

/**
 * Loài vẽ đuôi khác với dữ liệu: cánh cụt có mẩu đuôi nhỏ lộ ra khi nhìn ngang và nhìn sau (thiết kế của bản mẫu).
 * Rùa có mai (hoa văn shell): đuôi nằm ở vành mai, không vắt ngang các tấm mai khi nhìn sau.
 *   rua_co_thu: mẩu đuôi nhọn (nub) dưới vành mai thay cho cục bông giữa mai (trông như cái nút);
 *   huyen_vu:   đuôi rắn (snake) chui ra từ vành mai dưới bên phải rồi cuộn lên ngoài mép mai.
 */
const SPECIES_TAIL = { canh_cut: 'nub', rua_co_thu: 'nub', huyen_vu: 'snake' };

// ---- đuôi dẹt (rái cá)
const flat = {
  S(ctx) {
    const [bcx, , brx] = ctx.sk.body;
    const sw = ctx.pose.tail ?? 0;
    const x = bcx + brx * 0.85 + sw * 0.6;
    const y = ctx.sk.ground - 1.6;
    ctx.parts.push(part('tail', mEllipse(x, y, 2.6, 1.7, -0.5), ctx.ramps.main, 1, { normal: [x, y, 2.6, 1.7], shade: -1 }));
  },
  E(ctx) {
    const [bcx, , brx] = ctx.sk.body;
    const sw = ctx.pose.tail ?? 0;
    const x = bcx - brx - 1.6;
    const y = ctx.sk.ground - 1.8 + sw * 0.4;
    ctx.parts.push(part('tail', mEllipse(x, y, 3.6, 1.7, 0.15), ctx.ramps.main, 1, { normal: [x, y - 1, 3.6, 2.4] }));
  },
  N(ctx) {
    const [bcx] = ctx.sk.body;
    const sw = ctx.pose.tail ?? 0;
    const x = bcx + sw * 0.6;
    const y = ctx.sk.ground - 0.6;
    ctx.parts.push(part('tail', mEllipse(x, y, 2.5, 2.3), ctx.ramps.main, 8, { normal: [x, y - 1, 2.6, 2.6] }));
  },
};

// ---- đuôi mảnh (mèo): chuỗi đĩa cong lên, chóp tối hơn một bậc
function thinChain(ctx, pts, z, sh, r = 1.25) {
  const m = mChain(pts, r);
  const nrm = [pts[2][0], pts[2][1], 3.0, 5.0];
  ctx.parts.push(part('tail', m, ctx.ramps.main, z, { normal: nrm, shade: sh }));
  const tip = mChain(pts.slice(-1), r);
  ctx.parts.push(part('tailtip', mAnd(tip, m), ctx.ramps.main, z + 0.05, { group: 'tail', shade: ctx.view !== 'N' ? sh - 1 : -1, normal: nrm }));
}
const thinPts = {
  S(ctx, sw) {
    const [bcx, bcy, brx] = ctx.sk.body;
    const [b0, b1] = [bcx + brx * 0.55, bcy + 1.0];
    return [[b0 + 1.5, b1 - 0.5], [b0 + 3.0, b1 - 2.0], [b0 + 3.8, b1 - 4.0], [b0 + 3.8 + sw * 0.5, b1 - 6.0], [b0 + 3.2 + sw, b1 - 7.6]];
  },
  E(ctx, sw) {
    const [bcx, bcy, brx] = ctx.sk.body;
    const [b0, b1] = [bcx - brx + 1.0, bcy - 0.5];
    return [[b0 - 1.5, b1 - 0.8], [b0 - 2.8, b1 - 2.4], [b0 - 3.4, b1 - 4.4], [b0 - 3.0 + sw * 0.5, b1 - 6.4], [b0 - 2.0 + sw, b1 - 7.8]];
  },
  N(ctx, sw) {
    const [bcx, bcy, , bry] = ctx.sk.body;
    const [b0, b1] = [bcx, bcy + bry * 0.3];
    return [[b0, b1 - 1.0], [b0 + 0.6, b1 - 3.0], [b0 + 1.6 + sw * 0.4, b1 - 5.0], [b0 + 2.4 + sw * 0.8, b1 - 7.0], [b0 + 2.4 + sw, b1 - 8.6]];
  },
};
const thinZ = { S: [1, -1], E: [1, 0], N: [8, 0] };
const thinView = (v, r) => (ctx) => thinChain(ctx, thinPts[v](ctx, ctx.pose.tail ?? 0), ...thinZ[v], r);
const thin = { S: thinView('S'), E: thinView('E'), N: thinView('N') };

// ---- đuôi bông (thỏ): cục tròn màu bụng
function puffAt(ctx, x, y, z) {
  const r = 2.3;
  ctx.parts.push(part('tail', mEllipse(x, y, r, r), ctx.ramps.belly, z, { normal: [x, y, r, r] }));
}
const puff = {
  S(ctx) {
    const [bcx, bcy, brx] = ctx.sk.body;
    puffAt(ctx, bcx + brx * 0.85, bcy + 1.2, 1);
  },
  E(ctx) {
    const [bcx, bcy, brx] = ctx.sk.body;
    puffAt(ctx, bcx - brx - 0.4, bcy + 0.4, 1);
  },
  N(ctx) {
    const [bcx, bcy] = ctx.sk.body;
    puffAt(ctx, bcx + (ctx.pose.tail ?? 0) * 0.3, bcy + 0.8, 8);
  },
};

// ---- mẩu đuôi (cánh cụt): chỉ lộ khi nhìn ngang và nhìn sau
const nub = {
  S() {},
  E(ctx) {
    const [bcx, , brx] = ctx.sk.body;
    const x = bcx - brx - 0.2;
    const y = ctx.sk.ground - 2.4;
    const m = mTri([x + 2.0, y - 1.8], [x + 2.0, y + 1.2], [x - 1.6, y + 0.8]);
    ctx.parts.push(part('tail', m, ctx.ramps.main, 1, { normal: [x, y, 3, 3] }));
  },
  N(ctx) {
    const [bcx] = ctx.sk.body;
    const x = bcx + (ctx.pose.tail ?? 0) * 0.5;
    const y = ctx.sk.ground - 1.8;
    const m = mTri([x - 2.4, y - 1.6], [x + 2.4, y - 1.6], [x, y + 1.6]);
    ctx.parts.push(part('tail', m, ctx.ramps.main, 8, { normal: [x, y - 2, 3, 3] }));
  },
};

/**
 * Đuôi rắn của Huyền Vũ: nhìn trước, nhìn ngang như đuôi mảnh (thin); nhìn sau thì chui ra từ vành mai dưới bên phải,
 * vòng ra ngoài mép mai rồi cuộn lên (mai tính như parts/patterns.js shell: bầu dục cx = bcx, cy = bcy − 0.6).
 */
const snake = {
  S: thin.S,
  E: thin.E,
  N(ctx) {
    const { sk } = ctx;
    const [bcx, bcy, brx, bry] = sk.body;
    const sw = ctx.pose.tail ?? 0;
    const pk = Math.min(1.05, Math.max(0.68, 0.45 + 0.5 * sk.bk));
    const cy = bcy - 0.6;
    const rx = brx + 1.6;
    const ry = Math.min(bry + 2.2 * pk, sk.ground - 1.2 - cy);
    const [x0, y0] = [bcx + rx * 0.5, cy + ry * 0.8];
    const k = Math.min(1, 0.55 + 0.4 * sk.bk);
    const pts = [[x0, y0], [x0 + 2.0 * k, y0 + 0.2], [x0 + 3.6 * k, y0 - 1.2 * k], [x0 + 4.2 * k + sw * 0.4, y0 - 3.2 * k], [x0 + 3.5 * k + sw * 0.8, y0 - 5.0 * k]];
    thinChain(ctx, pts.map(([x, y]) => [x, Math.min(y, sk.ground - 1.6)]), 8, 0, Math.max(0.9, 1.25 * k));
  },
};

const none = { S() {}, E() {}, N() {} };

// ================================================================ fluffy, curl, fan, dragon, fish (Rig 2.0, họa sĩ G)
// Cách dựng chung: đuôi là một chuỗi "hạt" [x, y, r] trong KHÔNG GIAN ĐUÔI (hướng E: x âm = ra sau, y âm = lên trên),
// nhân theo cỡ giai đoạn tuổi (tailSize) rồi đặt ở mông. Nhìn trước (S) = hình E lật sang bên PHẢI người xem và ép ngang
// (góc 3/4, như đuôi mảnh của bản mẫu); nhìn sau (N) có hình riêng nằm trên lưng (z 8). Nét trong giữa các chùm lông,
// lông vũ, vây... không vẽ tay: mỗi chùm là một nhóm riêng, chùm đứng trước tự có nét bậc 0 của chính dải màu đó ở chỗ đè
// lên chùm phía sau (colourise, nét trong chọn lọc). Đuôi không bao giờ xuống hàng 44 (aboveGround) và không chạm mép ô.
// Tinh chỉnh theo loài: TUNE bên dưới (dáng đuôi, dải màu chóp, khoanh, lông vũ...). Loài mới chưa có dòng thì dùng mặc định.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DEG = Math.PI / 180;
/** Cỡ đuôi theo giai đoạn: sơ sinh 0.79 (bé con đuôi to so với thân), nhí nhố 0.86, thiếu niên 0.93, thanh niên 1.0, trưởng thành 1.05 (chặn trên). */
const tailSize = (sk) => clamp(0.6 + 0.42 * sk.bk, 0.75, 1.05);
/** Mặt nạ từ chuỗi hạt [x, y, r]. */
const mBeads = (pts) => mOr(...pts.map(([x, y, r]) => mEllipse(x, y, r, r)));
/** Khối elip tô sáng bao quanh chuỗi hạt, lệch lên-trái (sáng tròn hơn, như pháp tuyến của bản mẫu). */
function nrmOf(pts) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y, r] of pts) {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  }
  return [(x0 + x1) / 2 - 0.8, (y0 + y1) / 2 - 1.2, (x1 - x0) / 2 + 1.0, (y1 - y0) / 2 + 1.4];
}
/** Đẩy cả chuỗi lên nếu hạt thấp nhất chạm hàng 44 (hàng viền dưới chân): khung đứng yên phải kết thúc ở hàng 44. */
function aboveGround(pts, ground) {
  const low = Math.max(...pts.map(([, y, r]) => y + r));
  const d = low - (ground - 0.3);
  return d > 0 ? pts.map(([x, y, r]) => [x, y - d, r]) : pts;
}
/**
 * Giữ đuôi trong khung: các bộ phận đuôi vừa đẩy (từ chỉ số `from` của ctx.parts) được dời nguyên khối, không cắt, để
 * không chạm cột 0..1 / 46..47, hàng 0..1, và không xuống hàng mặt đất (khung đứng yên kết thúc ở hàng 44 = viền dưới chân).
 * Dời cả khối thay vì cắt: ở cấp 50 (thân to nhất) hoặc khi đuôi đung đưa, đuôi chỉ lấn vào thân thêm 1-2 điểm.
 */
function settle(ctx, from) {
  const ps = ctx.parts.slice(from);
  if (!ps.length) return;
  let [x0, y0, x1, y1] = [FW, FH, -1, -1];
  for (const p of ps) {
    for (let k = 0; k < FW * FH; k++) {
      if (!p.mask[k]) continue;
      const x = k % FW;
      const y = (k - x) / FW;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return;
  const floor = Math.ceil(ctx.sk.ground) - 1; // hàng thấp nhất được tô
  const dx = x0 < 2 ? 2 - x0 : x1 > FW - 3 ? FW - 3 - x1 : 0;
  const dy = y1 > floor ? floor - y1 : y0 < 2 ? 2 - y0 : 0;
  if (!dx && !dy) return;
  for (const p of ps) {
    const m = new Uint8Array(FW * FH);
    for (let k = 0; k < FW * FH; k++) {
      if (!p.mask[k]) continue;
      const x = (k % FW) + dx;
      const y = Math.floor(k / FW) + dy;
      if (x >= 0 && y >= 0 && x < FW && y < FH) m[y * FW + x] = 1;
    }
    p.mask = m;
    if (p.normal) p.normal = [p.normal[0] + dx, p.normal[1] + dy, p.normal[2], p.normal[3]];
  }
}
/** Bọc một hàm vẽ đuôi: vẽ rồi settle(). */
const settled = (fn) => (ctx) => {
  const from = ctx.parts.length;
  fn(ctx);
  settle(ctx, from);
};

/**
 * Không gian đuôi → ô. E: ra sau = sang trái. S: lật sang phải người xem, ép ngang `sq` (góc 3/4).
 * `sw` (pose.tail) uốn đầu xa của đuôi.
 */
function place(pts, A, k, view, sw, sq = 0.62) {
  const n = pts.length - 1;
  return pts.map(([dx, dy, r], i) => {
    const t = n ? i / n : 0;
    const s = sw * t * t;
    const x = view === 'S' ? A[0] - dx * k * sq + s * 0.8 : A[0] + dx * k + s * 0.6;
    const y = A[1] + dy * k - (view === 'E' ? s * 0.3 : 0);
    return [x, y, Math.max(0.6, r * k)];
  });
}
/** Hình vẽ thẳng trong ô (S, N): x lệch theo `sw` ở đầu xa. `mx` = 1 giữ nguyên, −1 lật. */
function placeN(pts, A, k, sw, mx = 1) {
  const n = pts.length - 1;
  return pts.map(([dx, dy, r], i) => {
    const t = n ? i / n : 0;
    return [A[0] + dx * k * mx + sw * t * t * 1.2, A[1] + dy * k, Math.max(0.6, r * k)];
  });
}
/** Dải màu theo vai trò ('main' | 'belly' | 'accent' | 'inner' | 'limb') hoặc tên dải trong RAMPS. */
const rampOf = (ctx, role) => ctx.ramps[role] ?? role;

/** Nửa bề ngang của siêu elip (số mũ n) ở độ cao y; null nếu y nằm ngoài hình. */
function halfWidth(cy, rx, ry, y, n) {
  const v = Math.abs((y - cy) / ry);
  return v >= 1 ? null : rx * (1 - v ** n) ** (1 / n);
}
/**
 * Đầu to (bé sơ sinh, dáng biped nhìn ngang) che mất đuôi: đẩy các hạt từ hạt thứ 1 ra ngoài (E: sang trái, S: sang phải)
 * sao cho hạt `j` chỉ lấn vào bóng đầu/thân tối đa (1 − keep) × bán kính. Hạt gốc giữ ở mông.
 */
function clearOfHead(ctx, pts, view, j, keep = 0.6) {
  const [bcx, bcy, brx, bry] = ctx.sk.body;
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  const [x, y, r] = pts[j];
  const hw = halfWidth(hcy, hrx, hry, y, 2.25);
  const bw = halfWidth(bcy, brx, bry, y, 2);
  const sides = [hw === null ? null : [hcx, hw], bw === null ? null : [bcx, bw]].filter(Boolean);
  if (!sides.length) return pts;
  const s = view === 'E' ? -1 : 1;
  // mép ngoài của bóng đầu/thân về phía đuôi
  const edge = s < 0 ? Math.min(...sides.map(([c, w]) => c - w)) : Math.max(...sides.map(([c, w]) => c + w));
  const inner = s < 0 ? x + r * (1 - keep) : x - r * (1 - keep);
  const d = s < 0 ? Math.max(0, inner - edge) : Math.max(0, edge - inner);
  if (!d) return pts;
  return pts.map(([px, py, pr], i) => [px + s * d * Math.min(1, i / Math.max(1, j - 1)), py, pr]);
}

/**
 * Nhìn trước/sau: đuôi ôm sát bên PHẢI người xem. Từng hạt (từ hạt `from`) bị đẩy ra ngoài bóng đầu/thân, chỉ được lấn
 * vào tối đa `ov` × đường kính: đuôi luôn có viền riêng nổi trên nền, không lẫn vào má (đầu chibi rất to).
 */
function hugSide(ctx, pts, ov, from = 2) {
  const [bcx, bcy, brx, bry] = ctx.sk.body;
  const [hcx, hcy, hrx, hry] = ctx.sk.head;
  return pts.map(([x, y, r], i) => {
    if (i < from) return [x, y, r];
    const hw = halfWidth(hcy, hrx, hry, y, 2.25);
    const bw = halfWidth(bcy, brx, bry, y, 2);
    const edge = Math.max(hw === null ? -Infinity : hcx + hw, bw === null ? -Infinity : bcx + bw);
    return [Math.max(x, edge + r - 2 * ov * r), y, r];
  });
}

// ---------------------------------------------------------------- fluffy: đuôi chổi lông xù
// Bốn dáng: squirrel (sóc, gấu mèo đỏ: chữ S dựng cao sau lưng, chóp cuộn về trước), brush (cáo, lân, kỳ lân: bông to
// chếch 45° ra sau, nhìn trước thì vòng ra bên hông), low (sói: bông xệ xuống), flow (ngựa: dải đuôi chảy xuống).
// Hai chùm lông + chóp khác màu (chóp trắng của cáo...), mỗi phần một nhóm nên có nét chia chùm. Gấu mèo đỏ có khoanh sẫm.
// E, S, N: hạt [x, y, r] (S, N vẽ thẳng trong ô: x dương = bên phải người xem); clumps*: chỉ số hạt từng chùm (chùm sau
// vẽ trước); tip*: hạt từ chỉ số này là chóp; big: hạt to nhất (đẩy ra khỏi bóng đầu).
const FLUFFY = {
  squirrel: {
    up: true, big: 3,
    E: [[0, 0, 1.5], [-2.4, -0.9, 2.3], [-4.3, -2.9, 3.0], [-5.1, -5.8, 3.2], [-4.6, -8.7, 3.0], [-3.1, -10.8, 2.4], [-1.3, -11.8, 1.6]],
    S: [[0, 0, 1.5], [2.2, -0.6, 2.2], [3.8, -2.6, 2.8], [4.6, -5.4, 3.1], [4.6, -8.4, 2.9], [3.8, -10.8, 2.3], [2.6, -12.2, 1.6]],
    N: [[0, 1.0, 1.6], [2.2, 1.0, 2.3], [4.2, -0.6, 2.9], [5.4, -3.4, 3.2], [5.6, -6.6, 3.1], [5.0, -9.4, 2.6], [3.8, -11.4, 1.9]],
    clumps: [[0, 1, 2], [2, 3, 4]], tip: 5, clumpsN: [[0, 1, 2], [2, 3, 4]], tipN: 5, tufts: [2, 4],
  },
  brush: {
    up: true, big: 3,
    E: [[0, 0, 1.4], [-2.2, -1.4, 2.2], [-3.9, -3.3, 2.8], [-4.8, -5.7, 2.8], [-4.6, -8.0, 2.3], [-3.8, -9.6, 1.5]],
    S: [[0, 0, 1.4], [2.0, 0.9, 2.0], [3.9, 0.8, 2.6], [5.1, -1.0, 2.7], [5.3, -3.4, 2.3], [4.6, -5.3, 1.6]],
    N: [[0, 0.5, 1.4], [1.9, 1.3, 2.0], [3.9, 1.2, 2.6], [5.6, -0.2, 2.7], [6.6, -2.4, 2.3], [6.8, -4.4, 1.6]],
    clumps: [[0, 1, 2], [2, 3]], tip: 4, clumpsN: [[0, 1, 2], [2, 3]], tipN: 4, tufts: [2, 3],
  },
  // đuôi rủ (sói, ngựa): chóp dừng cách hàng mặt đất ≥ 2 điểm (clear) để không thành "bàn chân thứ ba" cạnh chân; nhìn
  // sau thì ngắn lại và lệch sang phải, dừng trên bàn chân thay vì rơi vào khe giữa hai chân sau.
  low: {
    up: false, big: 3, clear: 2.6,
    E: [[0, 0, 1.4], [-2.0, 0.6, 2.0], [-3.6, 2.0, 2.5], [-4.4, 3.9, 2.5], [-4.6, 5.6, 2.0], [-4.3, 6.9, 1.3]],
    S: [[0, 0, 1.4], [1.9, 0.8, 2.0], [3.4, 2.2, 2.4], [4.3, 3.9, 2.3], [4.6, 5.5, 1.8], [4.4, 6.7, 1.2]],
    N: [[0, 0, 1.5], [0.7, 1.5, 2.0], [1.5, 3.0, 2.3], [2.3, 4.3, 2.1], [2.9, 5.4, 1.6], [3.1, 6.3, 1.1]],
    clumps: [[0, 1, 2], [2, 3]], tip: 5, clumpsN: [[0, 1, 2]], tipN: 5, tufts: [2, 3],
  },
  flow: {
    up: false, big: 3, clear: 2.6,
    E: [[0, 0, 1.2], [-1.8, -0.6, 1.6], [-3.4, 0.4, 2.0], [-4.3, 2.4, 2.2], [-4.5, 4.6, 2.0], [-4.0, 6.6, 1.6], [-3.2, 8.0, 1.1]],
    S: [[0, 0, 1.2], [1.6, 0.0, 1.6], [3.0, 1.4, 2.0], [3.7, 3.4, 2.1], [3.8, 5.4, 1.9], [3.3, 7.2, 1.4], [2.6, 8.4, 1.0]],
    N: [[0, 0, 1.2], [0.5, 1.5, 1.6], [1.1, 3.0, 1.9], [1.8, 4.5, 1.9], [2.3, 5.8, 1.5], [2.4, 6.9, 1.0]],
    clumps: [[0, 1, 2], [2, 3, 4]], tip: 4, clumpsN: [[0, 1, 2]], tipN: 4, tufts: [3, 5],
  },
};

/** Khoanh ngang qua thân đuôi ở vị trí hạt `f` (số thực): elip mỏng dọc theo chiều đuôi. */
function ringAt(pts, f) {
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  const [x0, y0, r0] = pts[i];
  const [x1, y1, r1] = pts[i + 1];
  const rot = Math.atan2(y1 - y0, x1 - x0);
  return mEllipse(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.85, (r0 + (r1 - r0) * u) * 1.6, rot);
}

/**
 * Túm lông nhọn ở mép ngoài của đuôi (phía xa thân) tại các hạt `ids`, và một mũi nhọn nối dài chóp đuôi: viền đuôi
 * lởm chởm như lông xù thay vì một khối tròn trơn.
 */
function furPoints(ctx, pts, ids, k) {
  const [bcx, bcy] = ctx.sk.body;
  const ms = [];
  const dirAt = (i) => {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(x2 - x0, y2 - y0) || 1;
    return [(x2 - x0) / d, (y2 - y0) / d];
  };
  for (const i of ids) {
    const [x, y, r] = pts[i];
    const [ux, uy] = dirAt(i);
    let [nx, ny] = [uy, -ux];
    if (nx * (x - bcx) + ny * (y - bcy) < 0) [nx, ny] = [-nx, -ny];
    const h = r + 1.1 * k;
    ms.push(mTri([x + nx * (r - 1.0) - ux * 1.1, y + ny * (r - 1.0) - uy * 1.1], [x + nx * (r - 1.0) + ux * 0.9, y + ny * (r - 1.0) + uy * 0.9], [x + nx * h - ux * 0.7, y + ny * h - uy * 0.7]));
  }
  const [x, y, r] = pts.at(-1);
  const [ux, uy] = dirAt(pts.length - 1);
  ms.push(mTri([x - uy * r * 0.8, y + ux * r * 0.8], [x + uy * r * 0.8, y - ux * r * 0.8], [x + ux * (r + 1.4 * k), y + uy * (r + 1.4 * k)]));
  return mOr(...ms);
}

/**
 * Đuôi lông: các chùm (nhóm riêng, chùm sau đè chùm trước), chóp màu riêng, khoanh (nếu có), túm lông nhọn ở mép ngoài.
 * `front`: đuôi nằm trước thân (nhìn sau): khối sáng dời xuống-phải để đuôi sáng hơn lưng phía sau, tách khỏi lưng.
 */
function furTail(ctx, pts, z, clumps, tipFrom, t, { shade = 0, front = false, tufts = [] } = {}) {
  const k = tailSize(ctx.sk);
  const whole = mOr(mBeads(pts), furPoints(ctx, pts, tufts, k));
  let nrm = nrmOf(pts);
  if (front) nrm = [nrm[0] + 1.6, nrm[1] + 1.8, nrm[2] + 1.6, nrm[3] + 1.2];
  const main = rampOf(ctx, t.ramp ?? 'main');
  clumps.forEach((ids, c) => {
    const m = c ? mAnd(whole, mBeads(ids.map((i) => pts[i]))) : whole;
    ctx.parts.push(part(c ? `tail${c}` : 'tail', m, main, z + c * 0.01, { normal: nrm, shade }));
  });
  if (t.rings) {
    const n = pts.length - 1;
    const rm = mAnd(whole, mOr(...[0.42, 0.62].map((f) => ringAt(pts, f * n))));
    ctx.parts.push(part('tailring', rm, rampOf(ctx, t.rings), z + 0.03, { normal: nrm, shade, line: false }));
  }
  const tipZone = mOr(...pts.slice(tipFrom).map(([x, y, r]) => mEllipse(x, y, r + 1.6 * k, r + 1.6 * k)));
  const tip = mAndNot(mAnd(whole, tipZone), mBeads(pts.slice(0, Math.max(1, tipFrom - 1))));
  // tipShade/tipFlat: chóp đậm hơn (lân: đỏ bậc 1-2, không hồng) hoặc phẳng (sói: xám bậc 2, không gần màu viền)
  ctx.parts.push(part('tailtip', tip, rampOf(ctx, t.tip ?? 'belly'), z + 0.04, { normal: nrm, shade: shade + (t.tipShade ?? 0), flat: t.tipFlat ?? null }));
}

const fluffyView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'fluffy');
  const F = FLUFFY[t.shape] ?? FLUFFY.brush;
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  if (view === 'E') {
    let pts = place(F.E, [bcx - brx + 1.0, bcy - bry * (F.up ? 0.25 : 0.35)], k, 'E', sw);
    pts = aboveGround(clearOfHead(ctx, pts, 'E', F.big, F.up ? 0.55 : 0.8), sk.ground - (F.clear ?? 0));
    furTail(ctx, pts, 1, F.clumps, F.tip, t, { tufts: F.tufts });
    return;
  }
  // S: sau thân, ló ra bên phải; N: trước lưng (z 8), từ mông vòng sang phải rồi dựng lên, viền đuôi nổi ngoài bóng đầu.
  const A = view === 'S' ? [bcx + brx * 0.6, bcy + bry * (F.up ? 0.1 : -0.1)] : [F.up ? bcx + brx * 0.3 : bcx, F.up ? bcy + bry * 0.3 : bcy - bry * 0.2];
  let pts = placeN(view === 'S' ? F.S : F.N, A, k, sw);
  // nhìn sau: đuôi dựng (sóc, cáo) vòng sang phải và nổi ngoài bóng đầu; đuôi rủ (sói, ngựa) thả thẳng giữa hai chân sau
  if (view === 'S' || F.up) pts = hugSide(ctx, pts, view === 'S' ? 0.2 : 0.4);
  pts = aboveGround(pts, sk.ground - (F.clear ?? 0) - (view === 'N' && !F.up ? 0.6 : 0));
  furTail(ctx, pts, view === 'S' ? 1 : 8, view === 'S' ? F.clumps : F.clumpsN, view === 'S' ? F.tip : F.tipN, t, { front: view === 'N', tufts: F.tufts });
};
const fluffy = { S: settled(fluffyView('S')), E: settled(fluffyView('E')), N: settled(fluffyView('N')) };

// ---------------------------------------------------------------- curl: đuôi xoắn (heo: vòng nhỏ mảnh; chó: vòng to cuộn trên lưng)
// Vòng tròn có lỗ: tâm đặt đúng góc điểm ảnh (lỗ 2×2) hoặc tâm điểm ảnh (lỗ 1 điểm khi vòng nhỏ), lỗ trên nền trống thành
// một chấm viền nên đọc ra ngay là đuôi xoắn; nhìn sau thì lỗ lộ lông lưng. Một cuống ngắn nối vòng vào mông.
function curlRing(ctx, cx, cy, R, z, ramp, from, shade = 0) {
  const big = R >= 1.95;
  const x = big ? Math.round(cx) : Math.floor(cx) + 0.5;
  const y = big ? Math.round(cy) : Math.floor(cy) + 0.5;
  const ring = mAndNot(mEllipse(x, y, R, R), mEllipse(x, y, big ? 0.8 : 0.5, big ? 0.8 : 0.5));
  const thick = big ? 0.95 : 0.75;
  const [fx, fy] = from;
  const steps = Math.max(2, Math.ceil(Math.hypot(x - fx, y - fy) / 0.8));
  const stub = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    // dừng ở mép vòng: cuống không lấp lỗ
    const px = fx + (x - fx) * u;
    const py = fy + (y - fy) * u;
    if (Math.hypot(px - x, py - y) < R - thick) break;
    stub.push([px, py, thick]);
  }
  const m = stub.length ? mOr(ring, mBeads(stub)) : ring;
  const nrm = [x - 0.8, y - 1.0, R + 1.2, R + 1.4];
  ctx.parts.push(part('tail', m, ramp, z, { normal: nrm, shade }));
}

/** Đuôi chó cuộn (kiểu chó Phú Quốc, Shiba): dựng lên từ mông rồi cuộn về trước, nằm trên lưng; mặt trong màu bụng. */
const DOG_CURL = [[0, 0, 1.5], [-1.0, -1.9, 1.6], [-0.8, -3.8, 1.6], [0.6, -5.0, 1.5], [2.2, -4.6, 1.35], [2.9, -3.1, 1.15], [2.2, -1.9, 0.95]];
/** Nhìn sau: dựng giữa mông rồi cuộn sang phải thành hình số 6 (không phải vòng tròn có cuống: trông như lỗ khóa). */
const DOG_CURL_N = [[0, 0.6, 1.5], [-0.5, -1.5, 1.6], [0.2, -3.4, 1.6], [1.9, -4.2, 1.5], [3.3, -3.2, 1.3], [3.3, -1.5, 1.1], [2.2, -0.7, 0.9]];
function dogCurl(ctx, pts, z, shade = 0) {
  const k = tailSize(ctx.sk);
  const whole = mBeads(pts);
  const nrm = nrmOf(pts);
  ctx.parts.push(part('tail', whole, rampOf(ctx, 'main'), z, { normal: nrm, shade }));
  // tâm vòng cuộn ≈ trung bình hạt 1..5; mép trong (gần tâm) màu bụng
  const [cx, cy] = [1, 2, 3, 4, 5].reduce(([a, b], i) => [a + pts[i][0] / 5, b + pts[i][1] / 5], [0, 0]);
  const inner = mAnd(whole, mEllipse(cx, cy, 1.9 * k, 1.9 * k));
  ctx.parts.push(part('tailin', mAndNot(inner, mBeads(pts.slice(0, 1))), rampOf(ctx, 'belly'), z + 0.01, { group: 'tail', normal: nrm, shade }));
}

const curlView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'curl');
  const pig = t.kind === 'pig';
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const ramp = rampOf(ctx, t.ramp ?? 'main');
  if (pig) {
    // heo: vòng nhỏ mảnh (1 điểm ảnh) có lỗ, cuống ngắn
    const R = Math.max(1.6, 2.0 * k);
    if (view === 'E') {
      // vòng nằm sau mông; đầu to (bé sơ sinh) che mông thì đẩy vòng ra sau mép đầu
      const y = bcy - bry * 0.15 - R * 0.4;
      const [hcx, hcy, hrx, hry] = sk.head;
      const hw = halfWidth(hcy, hrx, hry, y, 2.25);
      const x = Math.min(bcx - brx - R + 0.6, hw === null ? Infinity : hcx - hw - R * 0.35) + sw * 0.3;
      curlRing(ctx, x, y, R, 1, ramp, [bcx - brx + 1.0, bcy]);
    }
    else if (view === 'S') curlRing(ctx, bcx + brx + 1.6 + sw * 0.3, bcy - 0.2, R * 0.9, 1, ramp, [bcx + brx - 1.0, bcy + 0.8], -1);
    else curlRing(ctx, bcx + sw * 0.5, bcy + bry * 0.2, R, 8, ramp, [bcx - 1.7, bcy + bry * 0.2 + 1.7]);
    return;
  }
  if (view === 'E') {
    const pts = place(DOG_CURL, [bcx - brx + 1.4, sk.btop + 1.3], k, 'E', sw * 0.6);
    dogCurl(ctx, aboveGround(clearOfHead(ctx, pts, 'E', 2, 0.75), sk.ground), 1);
  } else if (view === 'S') {
    const pts = placeN(DOG_CURL, [bcx + brx - 0.4, bcy - bry * 0.1], k * 0.9, sw * 0.6, -1);
    dogCurl(ctx, aboveGround(hugSide(ctx, pts, 0.3, 1), sk.ground), 1);
  } else {
    const pts = placeN(DOG_CURL_N, [bcx - 0.6, bcy + bry * 0.15], k, sw * 0.6);
    dogCurl(ctx, aboveGround(pts, sk.ground), 8);
  }
};
const curl = { S: settled(curlView('S')), E: settled(curlView('E')), N: settled(curlView('N')) };

// ---------------------------------------------------------------- fan: đuôi chim (mỗi loài một bộ lông vũ)
// Lông vũ = đường cong Bézier (3 điểm: bậc 2, 4 điểm: bậc 3) từ gốc tới chóp, bề ngang [gốc, giữa, chóp].
// Điểm viết theo KHỐI THÂN: [u, v, du, dv] → (bcx + u·brx + du·k, bcy + v·bry + dv·k): gốc nằm trong thân, chóp ló ra
// ngoài viền thân đúng du, dv điểm ảnh (nhân cỡ tuổi k), nên ở mọi giai đoạn tuổi đuôi đều phá viền thân như nhau.
// Bố cục (sau soát lần 3):
//   E  gốc ở MÔNG (sau, dưới), không ở ngang ngực; đuôi gà trống vồng cao hơn lưng rồi rủ xuống, chu tước có một lông
//      dài gấp rưỡi kéo xuống ra sau.
//   S  đuôi nằm sau thân: chỉ chóp lông ló ra HAI bên hông, dưới đường cánh (không còn một chùm ngang vai bên phải: trông
//      như bàn tay giơ lên). Gà con, vịt: đuôi nhỏ khuất hẳn sau thân, không vẽ (như mẩu đuôi cánh cụt của bản mẫu).
//   N  đuôi trước lưng (z 8), phá viền thân: xòe qua hai bên hông dưới cánh và rủ xuống giữa hai chân; gà con, vịt: túm
//      hai thùy ló qua viền dưới thân.
// Màu theo khối: lông cùng nhóm màu (`grp`, mặc định = dải màu) liền một khối, không có nét chia; chỉ chỗ hai nhóm màu
// chồng nhau mới có nét bậc 0, nên mỗi đuôi đọc thành 2-3 mảng. `sym`: lông có thêm bản đối xứng (S, N).
// Tên và nhóm mọi bộ phận đều bắt đầu bằng 'tail' (dáng khung tự vẽ đuôi, như serpent, bỏ được hết bằng một tiền tố).
/** Điểm theo khối thân → ô. `mx` = −1: đối xứng qua trục thân. */
function bodyPt([u, v, du = 0, dv = 0], [bcx, bcy, brx, bry], k, mx = 1) {
  return [bcx + mx * (u * brx + du * k), bcy + v * bry + dv * k];
}
/** Chuỗi hạt dọc đường Bézier P (3 hoặc 4 điểm), bán kính nội suy [gốc, giữa, chóp]. */
function quillPts(P, [w0, w1, w2], k) {
  const at = (t) => {
    const s = 1 - t;
    if (P.length === 3) return [0, 1].map((c) => s * s * P[0][c] + 2 * s * t * P[1][c] + t * t * P[2][c]);
    return [0, 1].map((c) => s * s * s * P[0][c] + 3 * s * s * t * P[1][c] + 3 * s * t * t * P[2][c] + t * t * t * P[3][c]);
  };
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= 16; i++) {
    const q = at(i / 16);
    len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  const n = Math.max(4, Math.ceil(len / 0.6));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = t < 0.5 ? w0 + (w1 - w0) * (t / 0.5) : w1 + (w2 - w1) * ((t - 0.5) / 0.5);
    pts.push([...at(t), Math.max(0.55, w * k)]);
  }
  return pts;
}

function fanTail(ctx, view, feathers) {
  const { sk } = ctx;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const z = view === 'N' ? 8 : 1;
  const floor = sk.ground - 0.3;
  // bung các lông đối xứng; lông sau (vẽ trước) đứng trước trong danh sách
  const list = [];
  for (const f of feathers) {
    if (f.sym) list.push({ ...f, mx: -1 });
    list.push({ ...f, mx: 1 });
  }
  const sets = list.map((f) => {
    const P = f.p.map((q) => bodyPt(q, sk.body, k, f.mx));
    const pts = quillPts(P, f.w, k);
    const m = pts.length - 1;
    // chóp đung đưa theo pose.tail; không hạt nào xuống hàng mặt đất
    return pts.map(([x, y, r], j) => {
      const t = (j / m) ** 2;
      const xx = x + sw * t * (view === 'E' ? 0.5 : 0.8);
      return [xx, Math.min(y, floor - r), r];
    });
  });
  const all = sets.flat();
  if (!all.length) return;
  let nrm = nrmOf(all);
  // nhìn sau: quạt nằm trước lưng, khối sáng dời xuống-phải để lông sáng hơn lưng (như đuôi lông)
  if (view === 'N') nrm = [nrm[0] + 1.4, nrm[1] + 1.6, nrm[2] + 1.4, nrm[3] + 1.2];
  list.forEach((f, i) => {
    const pts = sets[i];
    const zz = z + i * 0.01;
    const grp = `tailfan_${f.grp ?? f.ramp ?? 'accent'}`;
    const whole = mBeads(pts);
    ctx.parts.push(part(`tailfan${i}`, whole, rampOf(ctx, f.ramp ?? 'accent'), zz, { group: grp, normal: nrm, shade: f.shade ?? 0 }));
    if (f.tip) {
      // chóp khác màu: cùng nhóm với chóp các lông khác (một dải), có nét chia với thân lông
      const tip = mAnd(whole, mBeads(pts.slice(-Math.max(2, Math.round(pts.length * (f.tipLen ?? 0.3))))));
      ctx.parts.push(part(`tailfan${i}tip`, tip, rampOf(ctx, f.tip), zz + 0.005, { group: `tailfan_${f.tip}tip`, normal: nrm, shade: f.tipShade ?? 0, line: f.tipLine ?? true }));
    }
    if (f.eye) {
      // mắt lông phượng: chấm tròn gần chóp, cùng nhóm với lông (không viền)
      const [ex, ey] = pts[Math.max(0, pts.length - 1 - Math.round(pts.length * 0.12))];
      const r = Math.max(0.85, 1.05 * k);
      ctx.parts.push(part(`tailfan${i}eye`, mAnd(whole, mEllipse(ex, ey, r, r)), rampOf(ctx, f.eye), zz + 0.006, { group: grp, normal: [ex - 0.5, ey - 0.6, r + 0.8, r + 0.8] }));
    }
  });
}

/** Bộ lông vũ mặc định (loài chim mới chưa có dòng trong FANS): quạt nhỏ màu điểm nhấn. */
const FAN_DEFAULT = {
  E: [
    { p: [[-0.8, 0.15], [-1, 0.0, -2.5, -1.5], [-1, -0.05, -5, -2.5]], w: [1.3, 1.6, 0.7], ramp: 'accent' },
    { p: [[-0.8, 0.2], [-1, 0.25, -2.5, 0], [-1, 0.3, -5.5, 0.5]], w: [1.3, 1.6, 0.7], ramp: 'accent' },
  ],
  S: [{ p: [[0.45, 0.45], [0.95, 0.55, 0.5, 0], [1, 0.5, 3, -0.5]], w: [1.2, 1.4, 0.6], ramp: 'accent', sym: true }],
  N: [
    { p: [[0.1, 0.2], [0.7, 0.5, 0, 0], [1, 0.62, 2.5, 0]], w: [1.4, 1.7, 0.7], ramp: 'accent', sym: true },
    { p: [[0, 0.2], [0, 0.7], [0, 1, 0, 0.8]], w: [1.5, 1.8, 0.8], ramp: 'accent' },
  ],
};
/**
 * Bộ lông vũ theo loài: { E, S, N } mỗi hướng một danh sách lông { p, w, ramp, grp, tip, tipLen, eye, sym, shade }.
 * Vai trò màu: 'main' | 'belly' | 'accent' hoặc tên dải trong core.js RAMPS.
 */
const FANS = {
  // gà con: túm lông ngắn vểnh, màu thân, chóp cam; nhìn sau là túm hai thùy màu thân ló qua viền dưới thân
  ga_vang: {
    E: [
      { p: [[-0.8, 0.2], [-1, 0.25, -2, 0], [-1, 0.1, -4.2, -1.6]], w: [1.3, 1.6, 0.7], ramp: 'main', tip: 'accent', tipLen: 0.35 },
      { p: [[-0.8, 0.1], [-1, 0.0, -1.2, -1.8], [-1, -0.15, -2.6, -4.2]], w: [1.2, 1.5, 0.7], ramp: 'main', tip: 'accent', tipLen: 0.35 },
    ],
    S: [],
    N: [{ p: [[0.05, 0.4], [0.45, 0.65], [0.8, 0.85, 1.4, 0.2]], w: [1.3, 1.6, 0.7], ramp: 'main', sym: true }],
  },
  // gà trống: liềm đuôi đỏ vồng cao hơn lưng rồi rủ xuống, liềm đỏ sẫm phía sau, lông phủ cam ở gốc (3 mảng màu)
  ga_trong: {
    E: [
      { p: [[-0.8, 0.15], [-1, -0.05, -2, -6], [-1, 0.0, -10.5, -5.5], [-1, 0.35, -10.5, 0.5]], w: [1.2, 1.5, 0.6], ramp: 'maroon', shade: 1 },
      { p: [[-0.8, 0.1], [-1, -0.25, -0.5, -9.5], [-1, -0.25, -8.5, -9.5], [-1, 0.2, -8.5, 0]], w: [1.3, 1.7, 0.6], ramp: 'accent', shade: -1 },
      { p: [[-0.8, 0.15], [-1, 0.0, -1.5, -2.6], [-1, -0.1, -4.6, -2.6]], w: [1.5, 1.8, 0.8], ramp: 'main' },
    ],
    S: [
      { p: [[0.4, 0.35], [0.9, 0.45], [1, 0.4, 2.0, -0.8], [1, 0.3, 2.6, -2.0]], w: [1.0, 1.2, 0.6], ramp: 'maroon', shade: 1, sym: true },
      { p: [[0.4, 0.45], [0.9, 0.55], [1, 0.58, 2.4, 0.2]], w: [1.1, 1.3, 0.6], ramp: 'accent', shade: -1, sym: true },
    ],
    N: [
      { p: [[0.05, 0.2], [0.6, 0.3], [1, 0.45, 2.0, 0], [1, 0.6, 3.2, 1.2]], w: [1.2, 1.5, 0.6], ramp: 'maroon', shade: 1, sym: true },
      { p: [[0.05, 0.2], [0.35, 0.6], [0.55, 0.95, 0.4, 0.3]], w: [1.7, 2.1, 1.1], ramp: 'accent', shade: -1, sym: true },
      { p: [[0, 0.2], [0, 0.6], [0, 1, 0, 0.5]], w: [1.7, 2.1, 1.1], ramp: 'accent', shade: -1 },
    ],
  },
  // hạc: chùm lông rủ trắng, chóp sẫm (2 mảng)
  hac_bac: {
    E: [
      { p: [[-0.8, 0.05], [-1, -0.1, -3.5, -1], [-1, 0.2, -6.5, 1], [-1, 0.35, -6.5, 2.6]], w: [1.5, 1.9, 0.8], ramp: 'main', tip: 'charcoal', tipLen: 0.3 },
      { p: [[-0.8, 0.15], [-1, 0.15, -2.5, 0], [-1, 0.35, -4.8, 1.0], [-1, 0.5, -4.4, 2.2]], w: [1.5, 1.8, 0.8], ramp: 'main', tip: 'charcoal', tipLen: 0.3 },
    ],
    S: [{ p: [[0.4, 0.35], [0.9, 0.45], [1, 0.5, 2.4, 0.0], [1, 0.58, 3.0, 0.8]], w: [1.3, 1.5, 0.7], ramp: 'main', sym: true }],
    N: [
      { p: [[0.05, 0.2], [0.6, 0.3], [1, 0.42, 1.8, 0], [1, 0.5, 2.6, 0.8]], w: [1.5, 1.9, 0.8], ramp: 'main', tip: 'charcoal', tipLen: 0.22, sym: true },
      { p: [[0.05, 0.25], [0.3, 0.62], [0.5, 0.95, 0.3, 0.3]], w: [1.6, 2.0, 1.0], ramp: 'main', sym: true },
      { p: [[0, 0.25], [0, 0.62], [0, 1, 0, 0.5]], w: [1.6, 2.0, 1.0], ramp: 'main' },
    ],
  },
  // vịt mây: chỏm đuôi nhọn vểnh trắng như mây (thùy trên màu thân, thùy dưới trắng)
  vit_may: {
    E: [
      { p: [[-0.8, 0.25], [-1, 0.3, -2.2, 0.2], [-1, 0.2, -4.2, -0.8]], w: [1.3, 1.5, 0.6], ramp: 'belly' },
      { p: [[-0.8, 0.1], [-1, 0.05, -1.8, -1.2], [-1, -0.1, -4.2, -3.4]], w: [1.3, 1.6, 0.6], ramp: 'main' },
    ],
    S: [],
    N: [{ p: [[0.05, 0.4], [0.45, 0.65], [0.8, 0.85, 1.4, 0.2]], w: [1.3, 1.6, 0.7], ramp: 'main', tip: 'belly', tipLen: 0.45, sym: true }],
  },
  // ưng lửa: quạt rộng nâu đỏ sẫm, lông phủ đỏ gạch ở gốc, dải chóp vàng (3 mảng)
  ung_lua: {
    E: [
      { p: [[-0.8, 0.15], [-1, 0.1, -3, -0.8], [-1, 0.05, -6.6, -1.2]], w: [1.7, 2.1, 1.7], ramp: 'accent', shade: 1, tip: 'belly', tipLen: 0.22 },
      { p: [[-0.8, 0.2], [-1, 0.25, -3, 0.2], [-1, 0.3, -7.2, 0.6]], w: [1.7, 2.1, 1.7], ramp: 'accent', shade: 1, tip: 'belly', tipLen: 0.22 },
      { p: [[-0.8, 0.25], [-1, 0.4, -3, 0.6], [-1, 0.5, -6.6, 1.6]], w: [1.6, 2.0, 1.6], ramp: 'accent', shade: 1, tip: 'belly', tipLen: 0.22 },
      { p: [[-0.8, 0.15], [-1, 0.15, -1.2, -0.6], [-1, 0.2, -3.0, -0.2]], w: [1.6, 1.9, 1.0], ramp: 'main' },
    ],
    S: [{ p: [[0.4, 0.35], [0.9, 0.45], [1, 0.45, 2.8, -0.6]], w: [1.4, 1.7, 1.0], ramp: 'accent', shade: 1, sym: true }],
    N: [
      { p: [[0.05, 0.2], [0.6, 0.4], [1, 0.62, 1.8, 0.6]], w: [1.7, 2.1, 1.2], ramp: 'accent', shade: 1, tip: 'belly', tipLen: 0.25, sym: true },
      { p: [[0.05, 0.2], [0.35, 0.62], [0.6, 0.95, 0.6, 0.3]], w: [1.7, 2.1, 1.2], ramp: 'accent', shade: 1, tip: 'belly', tipLen: 0.28, sym: true },
      { p: [[0, 0.2], [0, 0.62], [0, 1, 0, 0.5]], w: [1.8, 2.1, 1.2], ramp: 'accent', shade: 1, tip: 'belly', tipLen: 0.28 },
    ],
  },
  // chu tước: hai lông phượng vồng lên và một lông dài gấp rưỡi kéo xuống ra sau, chóp có mắt đỏ
  chu_tuoc: {
    E: [
      { p: [[-0.8, 0.05], [-1, -0.25, -0.5, -7.5], [-1, -0.25, -6, -9], [-1, -0.1, -8, -5.5]], w: [1.1, 1.4, 0.6], ramp: 'accent', shade: -1, eye: 'main' },
      { p: [[-0.8, 0.1], [-1, 0.0, -3, -2], [-1, 0.0, -7, -2.6], [-1, 0.15, -9.5, -1]], w: [1.2, 1.5, 0.6], ramp: 'accent', shade: -1, eye: 'main' },
      { p: [[-0.8, 0.15], [-1, 0.2, -4, 0], [-1, 0.35, -9, 0.5], [-1, 0.5, -12.5, 2.0]], w: [1.3, 1.6, 0.6], ramp: 'belly', eye: 'main' },
    ],
    S: [
      { p: [[0.4, 0.35], [0.9, 0.4], [1, 0.35, 2.0, -1.0], [1, 0.25, 2.4, -2.2]], w: [1.0, 1.2, 0.6], ramp: 'accent', shade: -1, sym: true },
      { p: [[0.4, 0.42], [0.9, 0.5], [1, 0.55, 2.4, -0.2], [1, 0.62, 3.8, 0.8]], w: [1.0, 1.3, 0.6], ramp: 'belly', eye: 'main', sym: true },
    ],
    N: [
      { p: [[0.05, 0.2], [0.6, 0.3], [1, 0.42, 1.6, 0], [1, 0.55, 3.4, 1.0]], w: [1.1, 1.4, 0.6], ramp: 'accent', shade: -1, eye: 'main', sym: true },
      { p: [[0.05, 0.2], [0.3, 0.6], [0.5, 0.95, 0.4, 0.3]], w: [1.4, 1.8, 0.9], ramp: 'belly', sym: true },
      { p: [[0, 0.2], [0, 0.6], [0, 1, 0, 0.6]], w: [1.4, 1.8, 0.9], ramp: 'belly', eye: 'main' },
    ],
  },
};
const fanView = (view) => (ctx) => {
  const F = FANS[ctx.sp.id] ?? FAN_DEFAULT;
  fanTail(ctx, view, F[view] ?? []);
};
const fan = { S: settled(fanView('S')), E: settled(fanView('E')), N: settled(fanView('N')) };

// ---------------------------------------------------------------- dragon: đuôi rồng dày, thuôn dần, chùm lông ở chóp
// Thân đuôi màu thân; dải bụng (bụng rồng, màu bụng) chạy dưới đuôi khi nhìn ngang; gai lưng (điểm nhấn) dọc mép trên;
// chùm lông ở chóp hình ngọn lửa (dải `tuft`). Nhìn sau: đuôi từ mông thả xuống đất rồi vòng sang phải, gai thành hàng
// giữa sống đuôi.
const DRAGON = {
  E: [[0, 0, 2.6], [-2.3, 0.5, 2.4], [-4.4, 0.5, 2.1], [-6.2, -0.4, 1.8], [-7.4, -2.0, 1.5], [-8.0, -3.8, 1.2], [-8.0, -5.2, 1.0]],
  // nhìn trước: đuôi vòng ra bên phải, nằm sát đất rồi vểnh chóp lên
  S: [[0, 0, 2.5], [2.0, 1.2, 2.3], [3.8, 2.4, 2.0], [5.4, 2.8, 1.7], [6.8, 2.4, 1.4], [7.8, 1.2, 1.15], [8.2, -0.2, 0.95]],
  N: [[0, -0.5, 2.5], [0.4, 1.8, 2.3], [1.6, 3.7, 2.0], [3.6, 4.9, 1.7], [5.6, 5.1, 1.4], [7.2, 4.3, 1.15], [8.2, 3.0, 0.95]],
};
/** Chùm lông chóp đuôi: ba thùy theo hướng đuôi + một mũi nhọn, như ngọn lửa. */
function tuftAt(pts, k, size = 1) {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const [ux, uy] = [(x1 - x0) / d, (y1 - y0) / d];
  const [px, py] = [-uy, ux];
  const s = k * size;
  return mOr(
    mEllipse(x1 + ux * 1.3 * s, y1 + uy * 1.3 * s, 1.6 * s, 1.6 * s),
    mEllipse(x1 + (ux * 0.5 + px * 1.3) * s, y1 + (uy * 0.5 + py * 1.3) * s, 1.25 * s, 1.25 * s),
    mEllipse(x1 + (ux * 0.5 - px * 1.3) * s, y1 + (uy * 0.5 - py * 1.3) * s, 1.25 * s, 1.25 * s),
    mEllipse(x1 + ux * 2.9 * s, y1 + uy * 2.9 * s, 0.9 * s, 0.9 * s),
  );
}
/** Gai nhỏ hình tam giác dọc mép ngoài của đuôi ở các hạt `ids` (về phía `side` của pháp tuyến đường đuôi). */
function spikesAt(pts, ids, side, k) {
  const ms = [];
  for (const i of ids) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1, r] = pts[i];
    const [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(x2 - x0, y2 - y0) || 1;
    const [ux, uy] = [(x2 - x0) / d, (y2 - y0) / d];
    const [nx, ny] = [uy * side, -ux * side];
    const h = r + 1.5 * k;
    ms.push(mTri([x1 + nx * (r - 0.6) - ux * 0.9, y1 + ny * (r - 0.6) - uy * 0.9], [x1 + nx * (r - 0.6) + ux * 0.9, y1 + ny * (r - 0.6) + uy * 0.9], [x1 + nx * h + ux * 0.6, y1 + ny * h + uy * 0.6]));
  }
  return mOr(...ms);
}

const dragonView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'dragon');
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const z = view === 'N' ? 8 : 1;
  let pts;
  if (view === 'N') pts = aboveGround(placeN(DRAGON.N, [bcx, bcy + bry * 0.2], k, sw), sk.ground - 0.2);
  else if (view === 'E') pts = aboveGround(clearOfHead(ctx, place(DRAGON.E, [bcx - brx + 1.2, bcy + bry * 0.3], k, 'E', sw), 'E', 2, 0.8), sk.ground - 0.2);
  else pts = aboveGround(hugSide(ctx, placeN(DRAGON.S, [bcx + brx * 0.45, bcy + bry * 0.45], k, sw), 0.35), sk.ground - 0.2);
  const whole = mBeads(pts);
  let nrm = nrmOf(pts);
  // nhìn sau: đuôi nằm trước lưng; khối sáng dời xuống-phải để chỗ sáng nhất không thành mảng trắng lạc giữa lưng
  if (view === 'N') nrm = [nrm[0] + 1.6, nrm[1] + 1.8, nrm[2] + 1.6, nrm[3] + 1.2];
  const main = rampOf(ctx, t.ramp ?? 'main');
  const accent = rampOf(ctx, t.spikes ?? 'accent');
  if (t.spikes !== false) {
    // E: gai trên mép trên (về phía y âm); S: hình lật nên mép trên đổi phía; N: gai thành hàng hạt giữa sống đuôi.
    if (view === 'N') {
      const ridge = mOr(...[1, 2, 3, 4].map((i) => mEllipse(pts[i][0], pts[i][1] - pts[i][2] * 0.15, 0.75 * k + 0.2, 0.75 * k + 0.2)));
      ctx.parts.push(part('tailridge', mAnd(whole, ridge), accent, z + 0.03, { normal: nrm, line: false }));
    } else {
      ctx.parts.push(part('tailspikes', mAndNot(spikesAt(pts, [1, 2, 3, 4], view === 'E' ? -1 : 1, k), whole), accent, z - 0.02, { normal: nrm }));
    }
  }
  // nhìn sau: lùi một bậc (dải thân rồng có bậc sáng gần trắng: aqua, gold)
  ctx.parts.push(part('tail', whole, main, z, { normal: nrm, shade: view === 'N' ? -1 : 0 }));
  if (view !== 'N') {
    const under = mAnd(whole, mBeads(pts.slice(0, -2).map(([x, y, r]) => [x, y + r * 0.62, r * 0.55])));
    ctx.parts.push(part('tailbelly', under, rampOf(ctx, 'belly'), z + 0.01, { normal: nrm }));
  }
  const tuft = mAndNot(tuftAt(pts, k, t.tuftSize ?? 1), mAnd(whole, mBeads(pts.slice(0, -2))));
  ctx.parts.push(part('tailtuft', tuft, rampOf(ctx, t.tuft ?? 'accent'), z + 0.02, { normal: nrmOf([...pts.slice(-2), [pts.at(-1)[0], pts.at(-1)[1], 3 * k]]) }));
};
const dragon = { S: settled(dragonView('S')), E: settled(dragonView('E')), N: settled(dragonView('N')) };

// ---------------------------------------------------------------- fish: đuôi cá chép (cuống đuôi màu thân + vây đuôi chẻ đôi)
// Vây hai thùy (trên, dưới) màu điểm nhấn, thùy trên đứng trước nên có nét chia ở chỗ chẻ; mép vây sáng (dải bụng) như
// vây cá chép trong. Nhìn sau: đuôi cong dựng sau lưng, vây xòe chữ V.
const FISH = {
  E: [[0, 0, 2.2], [-2.2, -0.4, 1.9], [-4.0, -1.4, 1.5], [-5.4, -2.6, 1.2]],
  S: [[0, 0, 2.1], [2.0, 0.6, 1.8], [3.8, 0.4, 1.5], [5.2, -0.6, 1.2]],
  N: [[0, 1.2, 2.0], [0.2, -0.9, 1.7], [0.4, -2.9, 1.3], [0.4, -4.4, 1.0]],
};
/** Một thùy vây: elip xoay từ điểm P về phía Q, rộng w. */
function lobe(P, Q, w) {
  const [dx, dy] = [Q[0] - P[0], Q[1] - P[1]];
  const L = Math.hypot(dx, dy);
  return mEllipse(P[0] + dx * 0.55, P[1] + dy * 0.55, L * 0.55 + 0.4, w, Math.atan2(dy, dx));
}
const fishView = (view) => (ctx) => {
  const t = tuneOf(ctx, 'fish');
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const k = tailSize(sk);
  const sw = ctx.pose.tail ?? 0;
  const z = view === 'N' ? 8 : 1;
  let pts;
  let up;
  let lo;
  if (view === 'N') {
    pts = aboveGround(placeN(FISH.N, [bcx, bcy + bry * 0.35], k, sw), sk.ground);
    const P = pts.at(-1);
    up = [P[0] - 4.2 * k + sw * 0.6, P[1] - 4.0 * k];
    lo = [P[0] + 4.2 * k + sw * 0.6, P[1] - 4.0 * k];
  } else if (view === 'E') {
    pts = aboveGround(clearOfHead(ctx, place(FISH.E, [bcx - brx + 1.0, bcy + bry * 0.1], k, 'E', sw), 'E', 2, 0.8), sk.ground);
    const P = pts.at(-1);
    up = [P[0] - 1.6 * k + sw * 0.4, P[1] - 5.6 * k];
    lo = [P[0] - 5.8 * k + sw * 0.4, P[1] - 0.6 * k];
  } else {
    pts = aboveGround(hugSide(ctx, placeN(FISH.S, [bcx + brx * 0.5, bcy + bry * 0.35], k, sw), 0.35), sk.ground);
    const P = pts.at(-1);
    up = [P[0] + 1.4 * k + sw * 0.4, P[1] - 5.0 * k];
    lo = [P[0] + 5.4 * k + sw * 0.4, P[1] - 0.4 * k];
  }
  const P = pts.at(-1);
  const w = Math.max(1.2, 1.8 * k);
  const body = mBeads(pts);
  const nrm = nrmOf([...pts, [up[0], up[1], 1], [lo[0], lo[1], 1]]);
  const fin = rampOf(ctx, t.fin ?? 'accent');
  const edge = rampOf(ctx, t.edge ?? 'belly');
  ctx.parts.push(part('tail', body, rampOf(ctx, t.ramp ?? 'main'), z, { normal: nrm }));
  const lower = lobe(P, lo, w);
  const upper = lobe(P, up, w);
  // tên và nhóm đều bắt đầu bằng 'tail': dáng khung tự vẽ đuôi (serpent: dropForeignTail) bỏ được cả vây, không sót mảnh
  ctx.parts.push(part('tailfinlo', lower, fin, z + 0.01, { normal: nrm }));
  ctx.parts.push(part('tailfinup', upper, fin, z + 0.02, { normal: nrm }));
  // mép vây sáng ở hai chóp thùy (cùng nhóm với thùy của nó: không kẻ nét giữa mép và vây)
  ctx.parts.push(part('tailfinedgelo', mAnd(lower, mEllipse(lo[0], lo[1], 1.5 * k, 1.5 * k)), edge, z + 0.015, { group: 'tailfinlo', normal: nrm }));
  ctx.parts.push(part('tailfinedgeup', mAnd(upper, mEllipse(up[0], up[1], 1.5 * k, 1.5 * k)), edge, z + 0.025, { group: 'tailfinup', normal: nrm }));
};
const fish = { S: settled(fishView('S')), E: settled(fishView('E')), N: settled(fishView('N')) };

// ---------------------------------------------------------------- tinh chỉnh theo loài
// fluffy: shape (squirrel | brush | low | flow), ramp (thân đuôi), tip (chóp), rings (khoanh).
// curl: kind ('pig' | 'dog'). fan: bộ lông theo loài nằm trong FANS (mục fan ở trên).
// dragon: tuft (dải chùm chóp), tuftSize, spikes (dải gai hoặc false). fish: fin, edge.
// Vai trò màu: 'main' | 'belly' | 'accent' (dải của loài, ramps.js) hoặc tên dải trong core.js RAMPS.
const TUNE = {
  // ---- fluffy
  soc_dong: { shape: 'squirrel', tip: 'belly' }, // sóc: đuôi chữ S dựng sau lưng, chóp kem
  soc_nam: { shape: 'squirrel', tip: 'belly' },
  gau_meo_do: { shape: 'squirrel', rings: 'maroon', tip: 'maroon' }, // gấu mèo đỏ: đuôi khoanh nâu đỏ sẫm, chóp sẫm
  cao_la: { shape: 'brush', tip: 'belly' }, // cáo: chóp trắng (màu bụng)
  cao_lua: { shape: 'brush', tip: 'belly' },
  soi_bac: { shape: 'low', tip: 'accent', tipFlat: 2 }, // sói: bông xệ, chóp xám sẫm phẳng (bậc 2, không gần màu viền)
  lan_con: { shape: 'brush', tip: 'accent', tipShade: -1 }, // lân: vàng, chóp đỏ (bậc 1-2 của dải đỏ, không ngả hồng)
  ky_lan: { shape: 'brush', tip: 'accent' }, // kỳ lân: kem, chóp nâu vàng
  ngua_lua: { shape: 'flow', ramp: 'accent', tip: 'gold' }, // ngựa lửa: đuôi lửa, chóp vàng
  // ---- curl
  heo_than: { kind: 'pig' },
  heo_dat: { kind: 'pig' },
  cun_co: { kind: 'dog' },
  cho_vang: { kind: 'dog' },
  // ---- dragon
  ky_nhong: { tuft: 'gold', tuftSize: 0.8, spikes: false }, // kỳ nhông lửa: đuôi trơn, chóp đốm lửa
  rong_lua: { tuft: 'gold', spikes: 'accent' }, // rồng lửa nhí: chùm lửa vàng ở chóp, gai đỏ sẫm
  thanh_long: { tuft: 'accent', spikes: 'accent' },
  hoang_long: { tuft: 'accent', spikes: 'accent' },
  // ---- fish
  ca_chep_rong: { fin: 'accent', edge: 'belly' },
};
const DEFAULT_TUNE = { fluffy: { shape: 'brush', tip: 'belly' }, curl: {}, dragon: {}, fish: {} };
function tuneOf(ctx, kind) {
  const t = TUNE[ctx.sp.id];
  if (kind === 'curl' && !t?.kind) return { kind: ctx.sp.body === 'round' ? 'pig' : 'dog', ...t };
  return t && (kind !== 'fluffy' || t.shape) ? t : DEFAULT_TUNE[kind];
}

/** Sổ đăng ký: loại đuôi → { S, E, N }. */
export const TAILS = { none, flat, thin, puff, nub, fluffy, curl, fan, dragon, fish, snake };

/** Loại đuôi chưa vẽ lại → hình tạm. Đã vẽ xong cả 9 loại: để trống (giữ để pipeline và sheet vẫn đọc được). */
export const FALLBACK = {};

/** Mục vẽ đuôi cho loài `sp` (không bao giờ undefined). */
export function tailFor(sp) {
  const kind = SPECIES_TAIL[sp.id] ?? sp.tail;
  return TAILS[kind] ?? FALLBACK[kind] ?? none;
}
