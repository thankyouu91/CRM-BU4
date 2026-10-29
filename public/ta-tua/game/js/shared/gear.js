// Cấp trang phục và dòng chỉ số tăng trưởng. Dùng chung cho máy chủ và trình duyệt.
// Mỗi món đồ đeo người chơi sở hữu là một "bản" riêng: có cấp (Xanh lam → Xanh lục → Vàng → Đỏ)
// và 1–4 dòng chỉ số; các dòng của đồ đang đeo cộng dồn cho bé.

export const TIER_ORDER = ['blue', 'green', 'gold', 'red'];

export const TIERS = {
  blue: { name: 'Xanh lam', color: '#4f8fd6', lines: 1 },
  green: { name: 'Xanh lục', color: '#3fa860', lines: 2 },
  gold: { name: 'Vàng', color: '#e0a21c', lines: 3 },
  red: { name: 'Đỏ', color: '#e2493b', lines: 4 },
};

/** Giá tham chiếu ở Chợ Phiên: giá shop của món × hệ số theo cấp. */
export const TIER_VALUE = { blue: 1, green: 2, gold: 4, red: 8 };

export const AFFIX_ORDER = ['income', 'stats', 'trade', 'luck'];

export const AFFIXES = {
  income: { name: 'Thu nhập ca làm', icon: '💼', desc: 'Lương các ca làm nghề tăng thêm.' },
  stats: { name: 'Chỉ số', icon: '📈', desc: 'Kỹ năng lên nhanh hơn; đồ ăn, đồ chăm sóc, chơi đùa và tắm hồi chỉ số nhiều hơn.' },
  trade: { name: 'Thu nhập giao dịch', icon: '🏮', desc: 'Thưởng thêm khi bán ở Chợ Phiên, trên Sàn nguyên liệu và bán món cho quán ăn.' },
  luck: { name: 'May mắn', icon: '🍀', desc: 'Nấu dễ ra món ngon, mini-game dễ rớt vật liệu và trang phục, mua đồ dễ ra cấp cao.' },
};

/** Tổng % mỗi loại chỉ số trên một bé không vượt mức này, dù đeo đồ gì. */
export const BONUS_CAP = 100;

/** Cấu hình mặc định; quản trị viên chỉnh được trên bảng quản lý (lưu ở máy chủ game). */
export const DEFAULT_GEAR_CONFIG = {
  /** Trọng số ra từng cấp khi quay đồ (tính theo %, tổng nên là 100). */
  odds: { blue: 60, green: 28, gold: 10, red: 2 },
  /** Biên độ [thấp nhất, cao nhất] % của mỗi dòng chỉ số theo cấp. */
  ranges: {
    blue: { income: [2, 5], stats: [2, 5], trade: [2, 5], luck: [2, 5] },
    green: { income: [4, 8], stats: [4, 8], trade: [4, 8], luck: [4, 8] },
    gold: { income: [7, 12], stats: [7, 12], trade: [7, 12], luck: [7, 12] },
    red: { income: [10, 20], stats: [10, 20], trade: [10, 20], luck: [10, 20] },
  },
  /** % một ván mini-game cho thêm vật liệu (nguyên liệu thô vào kho). */
  materialChance: 50,
  /** Số lô vật liệu mỗi lần rớt [ít nhất, nhiều nhất] (như lô hàng trên Sàn). */
  materialQty: [1, 3],
  /** % một ván mini-game rớt một món trang phục. */
  gearDropChance: 3,
};

const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v))));

/** Kiểm tra và chuẩn hóa cấu hình (thiếu thì lấy mặc định). Ném lỗi kèm lời nhắn tiếng Việt nếu sai. */
export function normalizeGearConfig(input = {}) {
  const base = DEFAULT_GEAR_CONFIG;
  const odds = {};
  for (const t of TIER_ORDER) {
    const v = Number(input.odds?.[t] ?? base.odds[t]);
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error(`Tỷ lệ cấp ${TIERS[t].name} phải từ 0 đến 100.`);
    odds[t] = Math.round(v * 10) / 10;
  }
  if (!TIER_ORDER.some((t) => odds[t] > 0)) throw new Error('Phải có ít nhất một cấp có tỷ lệ lớn hơn 0.');
  const ranges = {};
  for (const t of TIER_ORDER) {
    ranges[t] = {};
    for (const a of AFFIX_ORDER) {
      const [lo, hi] = input.ranges?.[t]?.[a] ?? base.ranges[t][a];
      const min = Number(lo);
      const max = Number(hi);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > BONUS_CAP || min > max) {
        throw new Error(`Biên độ ${AFFIXES[a].name} cấp ${TIERS[t].name} phải trong 0–${BONUS_CAP}% và thấp nhất ≤ cao nhất.`);
      }
      ranges[t][a] = [Math.round(min), Math.round(max)];
    }
  }
  const pct = (key) => {
    const v = Number(input[key] ?? base[key]);
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error('Tỷ lệ rớt phải từ 0 đến 100%.');
    return Math.round(v * 10) / 10;
  };
  const [qLo, qHi] = input.materialQty ?? base.materialQty;
  const materialQty = [clampInt(qLo, 1, 20), clampInt(qHi, 1, 20)];
  if (materialQty[0] > materialQty[1]) throw new Error('Số phần vật liệu: ít nhất phải ≤ nhiều nhất.');
  return { odds, ranges, materialChance: pct('materialChance'), materialQty, gearDropChance: pct('gearDropChance') };
}

/** Quay cấp theo trọng số; May mắn `luck` (%) làm cấp cao dễ ra hơn (mỗi bậc nhân thêm một lần). */
export function rollTier(odds, rand, luck = 0) {
  const boost = 1 + Math.max(0, luck) / 100;
  const weights = TIER_ORDER.map((t, i) => (odds[t] ?? 0) * boost ** i);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < TIER_ORDER.length; i++) {
    r -= weights[i];
    if (r < 0) return TIER_ORDER[i];
  }
  return TIER_ORDER.findLast((t) => (odds[t] ?? 0) > 0) ?? 'blue';
}

/** Quay các dòng chỉ số cho một món cấp `tier`: số dòng theo cấp, mỗi loại tối đa một dòng. */
export function rollAffixes(tier, ranges, rand) {
  const pool = [...AFFIX_ORDER];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const affixes = {};
  for (const a of pool.slice(0, TIERS[tier].lines)) {
    const [lo, hi] = ranges[tier][a];
    affixes[a] = lo + Math.floor(rand() * (hi - lo + 1));
  }
  return affixes;
}

/** Một món mới: cấp (đã cho hoặc quay) và các dòng chỉ số. */
export function rollGear(config, rand, { luck = 0, tier = null } = {}) {
  const t = tier && TIERS[tier] ? tier : rollTier(config.odds, rand, luck);
  return { tier: t, affixes: rollAffixes(t, config.ranges, rand) };
}

/** Cộng các dòng chỉ số của những món đang đeo; mỗi loại không vượt BONUS_CAP. */
export function sumBonus(list) {
  const total = Object.fromEntries(AFFIX_ORDER.map((a) => [a, 0]));
  for (const affixes of list) {
    for (const a of AFFIX_ORDER) total[a] += Number(affixes?.[a] ?? 0) || 0;
  }
  for (const a of AFFIX_ORDER) total[a] = Math.min(BONUS_CAP, total[a]);
  return total;
}

/** Dòng mô tả một chỉ số, ví dụ "💼 +5% Thu nhập ca làm". */
export const affixText = (key, value) => `${AFFIXES[key].icon} +${value}% ${AFFIXES[key].name}`;

/** Kiểm tra dòng chỉ số do quản trị viên nhập tay: đúng loại, số nguyên 0–BONUS_CAP, số dòng 1–4. */
export function cleanAffixes(input) {
  const out = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!AFFIXES[k]) throw new Error(`Không có loại chỉ số "${k}".`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > BONUS_CAP) throw new Error(`${AFFIXES[k].name} phải từ 0 đến ${BONUS_CAP}%.`);
    if (n > 0) out[k] = Math.round(n);
  }
  if (!Object.keys(out).length) throw new Error('Cần ít nhất một dòng chỉ số.');
  return out;
}
