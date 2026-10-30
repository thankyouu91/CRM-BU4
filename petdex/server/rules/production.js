// Luật giai đoạn 2 (hàm thuần): sức khỏe, tính cách, trường học, vườn, bếp, xưởng, Chợ Phiên, tín dụng.
import { COMMODITIES, LOT } from './market.js';

// Không lấy từ game.js vì game.js cũng dùng file này (tránh import vòng).
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------- sức khỏe & tính cách

export const HEALTH = {
  hygienePerHour: -5,
  // Mô phỏng cho thấy −3/+2 làm cả người chơi vào 3 lần/ngày cũng tụt sức khỏe dần (bé đói qua đêm), nên hạ còn −1/+1.
  lossPerHour: 1, // khi đói hoặc bẩn dưới 20
  regenPerHour: 1, // khi no và sạch, không ốm
  sickChancePerHour: 0.03, // khi Sức khỏe dưới 40
  sickBelow: 40,
  bathMinutes: 15,
};

export const ILLNESSES = {
  cold: { name: 'Cảm lạnh', icon: '🤧', treat: 120 },
  stomach: { name: 'Đau bụng', icon: '🤢', treat: 200 },
};

export const CLINIC = { checkup: 60, checkupHealth: 15, treatHealth: 30 };
export const INSURANCE = {
  basic: { name: 'Bảo hiểm Cơ bản', premium: 8, cover: 0.5 },
  full: { name: 'Bảo hiểm Toàn diện', premium: 20, cover: 0.9 },
};

export const TRAITS = {
  glutton: { name: 'Tham ăn', icon: '🍙', desc: 'No bụng giảm nhanh 20%, đồ ăn cho thêm 30% XP.' },
  diligent: { name: 'Chăm chỉ', icon: '💼', desc: '+10% lương ca làm.' },
  playful: { name: 'Ham chơi', icon: '🎈', desc: 'Chơi đùa được thêm 50% vui vẻ.' },
  sleepy: { name: 'Ngủ nướng', icon: '😴', desc: 'Năng lượng hồi nhanh hơn 20%, lương −5%.' },
  charming: { name: 'Có duyên', icon: '✨', desc: '+5 Duyên dáng ban đầu, khách ở quầy +10% khi bé trực.' },
  bookworm: { name: 'Mọt sách', icon: '📚', desc: 'Học ở trường được thêm 25% điểm kỹ năng.' },
};

/** 1–2 tính cách ngẫu nhiên khi nhận nuôi. */
export function rollTraits(rand) {
  const keys = Object.keys(TRAITS);
  const first = keys[Math.floor(rand() * keys.length)];
  if (rand() < 0.5) return [first];
  const rest = keys.filter((k) => k !== first);
  return [first, rest[Math.floor(rand() * rest.length)]];
}

export const has = (pet, trait) => (pet.traits ?? []).includes(trait);
export const payFactor = (pet) => 1 + (has(pet, 'diligent') ? 0.1 : 0) - (has(pet, 'sleepy') ? 0.05 : 0);

/**
 * Thay đổi Sức khỏe trong `hours` giờ: giảm khi đói hoặc bẩn dưới 20, hồi trong `goodFor` giờ đầu bé còn no và sạch
 * (bé ốm thì `goodFor` = 0: không tự hồi, phải đi khám).
 */
export function healthDelta(hours, { hungryAfter, dirtyAfter, goodFor, regen = 1 }) {
  const bad = Math.max(0, hours - Math.min(hungryAfter, dirtyAfter));
  const good = Math.max(0, Math.min(hours - bad, goodFor));
  return HEALTH.regenPerHour * regen * good - HEALTH.lossPerHour * bad;
}

/** Xác suất bé đổ bệnh sau `hours` giờ Sức khỏe thấp. */
export const sickChance = (hours) => 1 - (1 - HEALTH.sickChancePerHour) ** Math.max(0, hours);

// ---------------------------------------------------------------- trường học

export const SCHOOL = { minutes: 30, energy: 15, perSkillPerDay: 3, gain: [2, 4] };
export const CLASSES = {
  strength: { name: 'Lớp thể lực', icon: '💪', cost: 30 },
  agility: { name: 'Lớp chạy bền', icon: '🏃', cost: 30 },
  intellect: { name: 'Lớp toán vui', icon: '🧠', cost: 40 },
  charm: { name: 'Lớp thanh nhạc', icon: '✨', cost: 50 },
  craft: { name: 'Lớp thủ công', icon: '🖐️', cost: 40 },
};

// ---------------------------------------------------------------- vườn

/** Sản lượng tính bằng phần (1 lô = 10 phần). */
export const CROPS = {
  tea: { name: 'Chè', icon: '🍃', commodity: 'tea_leaf', hours: 6, seed: 8, yield: [10, 20] },
  strawberry: { name: 'Dâu tây', icon: '🍓', commodity: 'strawberry', hours: 4, seed: 20, yield: [10, 12] },
  cane: { name: 'Mía', icon: '🎋', commodity: 'cane', hours: 8, seed: 10, yield: [20, 30] },
  cassava: { name: 'Sắn', icon: '🥔', commodity: 'cassava', hours: 6, seed: 8, yield: [18, 22] },
};
export const GARDEN = {
  startPlots: 4,
  expandCosts: [300, 800, 2000, 5000, 9000],
  waterBonus: 0.2,
  helpReward: 2,
  helpXp: 5,
  helpPerDay: 10,
  pestChance: 0.25,
  pestLoss: 0.3,
};

export function harvestYield(crop, { watered, pests, rand }) {
  const [lo, hi] = CROPS[crop].yield;
  let qty = lo + Math.floor(rand() * (hi - lo + 1));
  if (watered) qty *= 1 + GARDEN.waterBonus;
  if (pests) qty *= 1 - GARDEN.pestLoss;
  return Math.max(1, Math.round(qty));
}

// ---------------------------------------------------------------- bếp

/** Đầu vào tính bằng phần. `hidden` thì phải tự khám phá đúng công thức. */
export const DISHES = {
  home_milk_tea: { name: 'Trà sữa nhà làm', icon: '🧋', element: 'moc', inputs: { dried_tea: 1, milk: 1, pearl: 1, sugar: 1 }, effect: { fullness: 30, happiness: 12 } },
  strawberry_smoothie: { name: 'Sinh tố dâu', icon: '🍹', element: 'hoa', inputs: { strawberry: 2, milk: 1 }, effect: { fullness: 20, happiness: 25, energy: 10 } },
  grilled_fish: { name: 'Cá nướng', icon: '🐟', element: 'hoa', inputs: { fish: 2, sugar: 1 }, effect: { fullness: 55 } },
  strawberry_cake: { name: 'Bánh dâu', icon: '🍰', element: 'hoa', inputs: { strawberry: 2, pearl: 1, sugar: 2, milk: 1 }, effect: { fullness: 35, happiness: 40 } },
  tea_jelly: { name: 'Thạch trà', icon: '🍮', element: 'moc', inputs: { dried_tea: 2, sugar: 1 }, effect: { happiness: 30, energy: 15 }, hidden: true },
  fish_soup: { name: 'Canh cá lá trà', icon: '🍲', element: 'thuy', inputs: { fish: 1, tea_leaf: 1, cassava: 1 }, effect: { fullness: 45, health: 10 }, hidden: true },
  cassava_cake: { name: 'Bánh sắn nướng', icon: '🥮', element: 'tho', inputs: { cassava: 2, sugar: 1, condensed: 1 }, effect: { fullness: 40, happiness: 15 }, hidden: true },
};
export const QUALITY = [
  { name: 'Thường', mult: 1 },
  { name: 'Ngon', mult: 1.2 },
  { name: 'Tuyệt hảo', mult: 1.5 },
];
export const KITCHEN = { energy: 5, shelfDays: 3, npcRate: 0.6, valueMarkup: 1.8 };

export function rollQuality(craft, rand) {
  const r = rand();
  if (r < craft / 200) return 2;
  if (r < craft / 200 + 0.3 + craft / 300) return 1;
  return 0;
}

export const sameInputs = (a, b) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** Giá trị tham chiếu của một món (dùng cho Chợ Phiên và bán NPC). */
export function dishValue(dishId, quality, index = 1) {
  const cost = Object.entries(DISHES[dishId].inputs).reduce((s, [c, n]) => s + (COMMODITIES[c].base * index * n) / LOT, 0);
  return Math.round(cost * KITCHEN.valueMarkup * QUALITY[quality].mult);
}

// ---------------------------------------------------------------- xưởng chế biến

/** Mỗi mẻ: `input` lô hàng thô → `output` lô hàng chế biến. */
export const FACTORIES = {
  dryer: { name: 'Xưởng sấy trà', icon: '🍂', input: { tea_leaf: 2 }, output: { dried_tea: 1 }, perHour: 6, build: 4000 },
  pearl_mill: { name: 'Xưởng bột trân châu', icon: '⚫', input: { cassava: 1 }, output: { pearl: 1 }, perHour: 6, build: 3000 },
  sugar_mill: { name: 'Nhà máy đường', icon: '🟤', input: { cane: 1 }, output: { sugar: 1 }, perHour: 6, build: 3000 },
  dairy: { name: 'Lò sữa đặc', icon: '🍼', input: { milk: 1 }, output: { condensed: 1 }, perHour: 4, build: 4000 },
};
export const FACTORY = { landRent: 50, upgradeCosts: [2000, 4000, 8000], perLevel: 3, skillBoost: 0.3, maxTollFee: 100 };

/** Số mẻ mỗi giờ: theo cấp, cộng tới +30% theo Sức mạnh và Khéo tay của bé đứng máy giỏi nhất. */
export function batchesPerHour(kind, level, strength, craft) {
  return (FACTORIES[kind].perHour + level * FACTORY.perLevel) * (1 + (FACTORY.skillBoost * clamp((strength + craft) / 2, 0, 100)) / 100);
}

// ---------------------------------------------------------------- hợp đồng cung ứng

/**
 * Hai người chơi ký giao hàng mỗi đêm: `lots` lô mỗi ngày trong `days` ngày với giá cố định mỗi lô.
 * Bên mua ký quỹ tiền một ngày, bên bán ký quỹ 20% tổng giá trị; giao thiếu thì bồi thường
 * phần chênh giá thị trường cộng 10% giá trị phần thiếu. Bên nào phá hợp đồng thì bên kia nhận
 * 10% giá trị phần còn lại (lấy từ ký quỹ bên phá, tối đa bằng ký quỹ đó).
 */
export const CONTRACTS = {
  days: [3, 14], maxLots: 20, band: [0.5, 2], sellerEscrow: 0.2, shortfallExtra: 0.1, breakShare: 0.1, proposalHours: 48, maxOpen: 5,
};

export const contractDayValue = (lots, price) => Math.round(lots * price);
export const contractEscrows = (lots, price, days) => ({
  buyer: contractDayValue(lots, price),
  seller: Math.round(contractDayValue(lots, price) * days * CONTRACTS.sellerEscrow),
});

/** Bồi thường khi bên bán giao thiếu `missingLots` lô: chênh giá thị trường (nếu giá đã lên) + 10% giá trị phần thiếu. */
export const shortfallPenalty = (missingLots, price, marketPrice) =>
  Math.round(missingLots * (Math.max(0, marketPrice - price) + price * CONTRACTS.shortfallExtra));

// ---------------------------------------------------------------- Chợ Phiên

// minAccountDays: tài khoản mới chờ 1 ngày (24 giờ) mới bày bán được, chặn tạo tài khoản ảo để đẩy đồ.
export const BAZAAR = { listFee: 0.01, saleFee: 0.05, band: [0.5, 3], hours: 48, minAccountDays: 1, maxListings: 10 };

/**
 * Đấu giá trang phục: giá khởi điểm 10–300% giá tham chiếu, mỗi lần trả giá cao hơn ít nhất 5% (tối thiểu 1 xu),
 * trả giá trong 5 phút cuối thì phiên kéo dài thêm 5 phút. Phí như Chợ Phiên; mỗi người mở tối đa 5 phiên.
 */
export const AUCTION = { hours: [6, 12, 24], startBand: [0.1, 3], stepPct: 0.05, minStep: 1, snipeMs: 5 * 60_000, maxOpen: 5 };

// ---------------------------------------------------------------- tín dụng & vay

export const CREDIT = { start: 500, min: 300, max: 850, onTime: 5, repaid: 30, late: -20, defaulted: -100, contractDay: 3, contractBroken: -30, evicted: -40 };
export const TIERS = [
  { key: 'bronze', name: 'Đồng', icon: '🥉', min: 0, limit: 500, premium: 0.015 },
  { key: 'silver', name: 'Bạc', icon: '🥈', min: 550, limit: 2000, premium: 0.01 },
  { key: 'gold', name: 'Vàng', icon: '🥇', min: 650, limit: 8000, premium: 0.006 },
  { key: 'diamond', name: 'Kim cương', icon: '💎', min: 750, limit: 25000, premium: 0.003 },
];
export const LOANS = { terms: [3, 7, 14], originationFee: 0.02, lateFee: 0.01, defaultAfter: 7, garnish: 0.3, banDays: 14, minAccountDays: 3 };

export const tierOf = (score) => TIERS.findLast((t) => score >= t.min);
export const clampCredit = (score) => clamp(score, CREDIT.min, CREDIT.max);

/**
 * Làm tròn số tiền / lãi suất tới 6 chữ số thập phân để bỏ sai số dấu phẩy động (0,003 + 0,01 = 0,013000000000000001),
 * rồi mới làm tròn lên xu: 1.000 × 1,3% là 13 xu, không phải 14.
 */
export const tidy = (x) => Math.round(x * 1e6) / 1e6;
export const ceilCoins = (x) => Math.ceil(tidy(x));
export const floorCoins = (x) => Math.floor(tidy(x));

/** Lãi vay mỗi ngày = lãi cơ bản + phụ phí hạng + phụ phí lạm phát. */
export const loanRate = (baseRate, score, growth = 0) => tidy(baseRate + tierOf(score).premium + Math.max(0, growth - 0.1) / 7);

/** Hạn mức vay = min(hạn mức hạng, 3 × thu nhập bình quân 7 ngày + 50% tiết kiệm) − dư nợ hiện có. */
export function loanLimit({ score, avgIncome, savings, outstanding }) {
  return Math.max(0, Math.floor(Math.min(tierOf(score).limit, 3 * avgIncome + 0.5 * savings) - outstanding));
}

/**
 * Kỳ trả góp hôm nay: lãi trên dư nợ + phần gốc chia đều (tới hạn thì phải trả hết gốc),
 * cộng phí và lãi còn nợ từ các kỳ trước.
 */
export function installment(loan, pastDue = false) {
  const interest = ceilCoins(loan.remaining * loan.rate);
  const principal = pastDue ? loan.remaining : Math.min(loan.remaining, ceilCoins(loan.principal / loan.term_days));
  return { arrears: loan.fees ?? 0, interest, principal, total: (loan.fees ?? 0) + interest + principal };
}
