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

/** Một dòng chỉ số (quản trị viên nhập tay hoặc biên độ cấu hình) không vượt mức này. */
export const BONUS_CAP = 100;

/**
 * Cộng dồn có giảm dần, để bé đeo 5 món không bỏ xa bé đeo 3 món: mỗi loại chỉ số tính đủ tới SOFT_CAP %,
 * phần vượt chỉ tính OVER_RATE, và tổng không quá TOTAL_CAP %. Ví dụ 4 món Đỏ cộng thô 60% → thực nhận 42,5%.
 * Số liệu mô phỏng: docs/pet-town-gear-balance.md.
 */
export const STACKING = { softCap: 25, overRate: 0.5, totalCap: 60 };

/** % thực nhận của một loại chỉ số khi các dòng cộng thô được `raw` %. */
export function effectiveBonus(raw) {
  const { softCap, overRate, totalCap } = STACKING;
  const v = Math.max(0, Number(raw) || 0);
  const eff = v <= softCap ? v : softCap + (v - softCap) * overRate;
  return Math.min(totalCap, Math.round(eff * 10) / 10);
}

/**
 * Đồ có yêu cầu cấp cao mở hộp dễ ra Xanh lục hơn: cứ 10 cấp yêu cầu thì cộng 10 điểm May mắn
 * khi quay hộp ở Siêu thị (vẫn chỉ ra Xanh lam/Xanh lục).
 */
export const gradeLuck = (minLevel = 1) => Math.floor(Math.max(0, minLevel) / 10) * 10;

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
  /** Lò rèn: sửa đồ hỏng sau đấu trường và nâng cấp. Vật liệu tính bằng lô hàng thô bất kỳ trong kho (1 lô = 10 phần). */
  forge: {
    /** % sửa thành công; hỏng thì mất vật liệu và xu, đồ vẫn hỏng. */
    repairChance: 70,
    /** Sửa xong phải để ở lò bấy nhiêu giờ mới dùng lại được. */
    repairHours: 24,
    repair: {
      blue: { coins: 120, lots: 3 },
      green: { coins: 350, lots: 5 },
      gold: { coins: 900, lots: 8 },
      red: { coins: 2200, lots: 12 },
    },
    /** % nâng lên cấp kế tiếp (không quá UPGRADE_MAX_CHANCE); hỏng thì mất vật liệu và xu, món giữ nguyên. */
    upgradeChance: { blue: 30, green: 18, gold: 8 },
    upgrade: {
      blue: { coins: 2500, lots: 15 },
      green: { coins: 8000, lots: 30 },
      gold: { coins: 25000, lots: 60 },
    },
    /** Tiệm vật liệu bán hàng thô gấp bấy nhiêu lần giá Sàn. */
    shopMarkup: 2.5,
  },
};

/** Tỉ lệ nâng cấp không bao giờ vượt mức này. */
export const UPGRADE_MAX_CHANCE = 30;
/** Cấp kế tiếp khi nâng cấp (Đỏ là cao nhất). */
export const nextTier = (tier) => TIER_ORDER[TIER_ORDER.indexOf(tier) + 1] ?? null;

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
  return { odds, ranges, materialChance: pct('materialChance'), materialQty, gearDropChance: pct('gearDropChance'), forge: normalizeForge(input.forge) };
}

function normalizeForge(input = {}) {
  const base = DEFAULT_GEAR_CONFIG.forge;
  const num = (v, lo, hi, msg) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(msg);
    return n;
  };
  const cost = (src, fallback, t, what) => ({
    coins: Math.round(num(src?.coins ?? fallback.coins, 0, 10_000_000, `Xu ${what} cấp ${TIERS[t].name} phải từ 0 đến 10.000.000.`)),
    lots: Math.round(num(src?.lots ?? fallback.lots, 0, 1000, `Vật liệu ${what} cấp ${TIERS[t].name} phải từ 0 đến 1.000 lô.`)),
  });
  const repair = {};
  for (const t of TIER_ORDER) repair[t] = cost(input.repair?.[t], base.repair[t], t, 'sửa');
  const upgrade = {};
  const upgradeChance = {};
  for (const t of TIER_ORDER.slice(0, -1)) {
    upgrade[t] = cost(input.upgrade?.[t], base.upgrade[t], t, 'nâng cấp');
    const c = num(input.upgradeChance?.[t] ?? base.upgradeChance[t], 0, UPGRADE_MAX_CHANCE, `Tỉ lệ nâng cấp từ ${TIERS[t].name} phải từ 0 đến ${UPGRADE_MAX_CHANCE}%.`);
    upgradeChance[t] = Math.round(c * 10) / 10;
  }
  return {
    repairChance: Math.round(num(input.repairChance ?? base.repairChance, 1, 100, 'Tỉ lệ sửa thành công phải từ 1 đến 100%.') * 10) / 10,
    repairHours: Math.round(num(input.repairHours ?? base.repairHours, 0, 168, 'Thời gian sửa phải từ 0 đến 168 giờ.')),
    repair,
    upgradeChance,
    upgrade,
    shopMarkup: Math.round(num(input.shopMarkup ?? base.shopMarkup, 1, 20, 'Hệ số giá Tiệm vật liệu phải từ 1 đến 20.') * 100) / 100,
  };
}

/**
 * Dòng chỉ số sau khi nâng từ cấp `from` lên `to`: giữ các loại cũ, mỗi dòng giữ vị trí tương đối trong biên độ
 * (dòng cao vẫn cao), thêm đúng một dòng mới (ưu tiên nhóm `pool` của món) quay trong biên độ cấp mới.
 */
export function upgradeAffixes(from, to, affixes, ranges, rand, pool = AFFIX_ORDER) {
  const out = {};
  for (const [a, v] of Object.entries(affixes)) {
    const [lo, hi] = ranges[from][a];
    const [nlo, nhi] = ranges[to][a];
    const u = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    out[a] = Math.min(nhi, Math.max(nlo, Math.round(nlo + Math.min(1, Math.max(0, u)) * (nhi - nlo))));
  }
  const fresh = [...shuffle(pool.filter((a) => !(a in out)), rand), ...shuffle(AFFIX_ORDER.filter((a) => !pool.includes(a) && !(a in out)), rand)];
  for (const a of fresh.slice(0, Math.max(0, TIERS[to].lines - Object.keys(out).length))) {
    const [lo, hi] = ranges[to][a];
    out[a] = lo + Math.floor(rand() * (hi - lo + 1));
  }
  return out;
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

/**
 * Mỗi món thiên về vài loại chỉ số, công khai trước khi mua: hai loại theo hành và một loại theo khe.
 * Món cấp Xanh lam, Xanh lục (mọi hộp ở Siêu thị) chỉ ra dòng trong nhóm này; nhóm thiếu chỗ (cấp Vàng, Đỏ)
 * thì thêm loại ngoài nhóm. Cấp và % vẫn chỉ biết khi mở hộp.
 */
export const ELEMENT_AFFIXES = {
  kim: ['trade', 'income'],
  moc: ['stats', 'luck'],
  thuy: ['trade', 'luck'],
  hoa: ['income', 'stats'],
  tho: ['income', 'luck'],
};
export const SLOT_AFFIX = { head: 'stats', face: 'luck', neck: 'income', back: 'trade', charm: 'luck' };

/** Các loại chỉ số món ở khe `slot`, hành `element` có thể ra (theo thứ tự AFFIX_ORDER); không rõ món thì đủ 4 loại. */
export function affixPool(slot, element) {
  const picks = new Set([...(ELEMENT_AFFIXES[element] ?? []), SLOT_AFFIX[slot]].filter(Boolean));
  return picks.size ? AFFIX_ORDER.filter((a) => picks.has(a)) : [...AFFIX_ORDER];
}

const shuffle = (list, rand) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Quay các dòng chỉ số cho một món cấp `tier`: số dòng theo cấp, mỗi loại tối đa một dòng, ưu tiên nhóm `pool` của món. */
export function rollAffixes(tier, ranges, rand, pool = AFFIX_ORDER) {
  const inPool = shuffle(pool, rand);
  const rest = shuffle(AFFIX_ORDER.filter((a) => !pool.includes(a)), rand);
  const affixes = {};
  for (const a of [...inPool, ...rest].slice(0, TIERS[tier].lines)) {
    const [lo, hi] = ranges[tier][a];
    affixes[a] = lo + Math.floor(rand() * (hi - lo + 1));
  }
  return affixes;
}

/** Một món mới: cấp (đã cho hoặc quay) và các dòng chỉ số. */
export function rollGear(config, rand, { luck = 0, tier = null, pool } = {}) {
  const t = tier && TIERS[tier] ? tier : rollTier(config.odds, rand, luck);
  return { tier: t, affixes: rollAffixes(t, config.ranges, rand, pool) };
}

/**
 * Đồ mua ở Siêu thị về là hộp kín: chỉ ra cấp Xanh lam (1 dòng) hoặc Xanh lục (2 dòng), mở hộp mới biết dòng nào.
 * Cấp Vàng và Đỏ chỉ có từ mini-game, mã quà hoặc Chợ Phiên.
 */
export const SHOP_TIERS = ['blue', 'green'];

/** Quay một món mua ở Siêu thị: tỷ lệ Xanh lam/Xanh lục theo cấu hình, May mắn giúp ra Xanh lục. */
export function rollShopGear(config, rand, { luck = 0, pool } = {}) {
  const odds = Object.fromEntries(TIER_ORDER.map((t) => [t, SHOP_TIERS.includes(t) ? config.odds[t] ?? 0 : 0]));
  if (!SHOP_TIERS.some((t) => odds[t] > 0)) odds.blue = 1;
  return rollGear(config, rand, { tier: rollTier(odds, rand, luck), pool });
}

/**
 * Bán nhanh cho Siêu thị: thu lại 10–40% giá trị món (giá cửa hàng × hệ số cấp), tùy các dòng chỉ số quay cao hay thấp
 * trong biên độ của cấp đó. Hộp chưa mở thu mức thấp nhất trên giá cửa hàng.
 */
export const QUICK_SELL = { min: 0.1, max: 0.4 };

/** Tỷ lệ thu lại (0,1–0,4) của một món cấp `tier` có các dòng `affixes`, theo biên độ `ranges`. */
export function quickSellRate(tier, affixes, ranges) {
  const scores = Object.entries(affixes ?? {}).map(([a, v]) => {
    const [lo, hi] = ranges?.[tier]?.[a] ?? [0, 0];
    return hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 1;
  });
  const q = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  return Math.round((QUICK_SELL.min + (QUICK_SELL.max - QUICK_SELL.min) * q) * 1000) / 1000;
}

/** Cộng các dòng chỉ số của những món đang đeo, rồi áp giảm dần và trần (effectiveBonus) cho từng loại. */
export function sumBonus(list) {
  const total = Object.fromEntries(AFFIX_ORDER.map((a) => [a, 0]));
  for (const affixes of list) {
    for (const a of AFFIX_ORDER) total[a] += Number(affixes?.[a] ?? 0) || 0;
  }
  for (const a of AFFIX_ORDER) total[a] = effectiveBonus(total[a]);
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
