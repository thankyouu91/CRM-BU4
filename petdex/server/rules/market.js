// Luật Sàn Nguyên Liệu (hàm thuần): định nghĩa hàng, mô hình giá, báo giá, phí, tác động giá.
import { DAY } from '../game.js';

/** 1 lô = 10 phần. Kho và lệnh tính bằng phần; giá niêm yết theo lô. */
export const LOT = 10;

export const COMMODITIES = {
  tea_leaf: { name: 'Lá trà tươi', icon: '🍃', kind: 'raw', base: 12, vol: 0.12, shelfDays: 2 },
  milk: { name: 'Sữa tươi', icon: '🥛', kind: 'raw', base: 30, vol: 0.1, shelfDays: 3 },
  cassava: { name: 'Củ sắn', icon: '🥔', kind: 'raw', base: 8, vol: 0.1 },
  cane: { name: 'Mía', icon: '🎋', kind: 'raw', base: 8, vol: 0.08 },
  strawberry: { name: 'Dâu tây', icon: '🍓', kind: 'raw', base: 40, vol: 0.15, shelfDays: 3 },
  fish: { name: 'Cá tươi', icon: '🐟', kind: 'raw', base: 60, vol: 0.12, shelfDays: 2 },
  pork: { name: 'Thịt heo', icon: '🥩', kind: 'raw', base: 55, vol: 0.11, shelfDays: 2 },
  mango: { name: 'Xoài chín', icon: '🥭', kind: 'raw', base: 25, vol: 0.13, shelfDays: 4 },
  dried_tea: { name: 'Trà khô', icon: '🍂', kind: 'processed', base: 35, vol: 0.06, inputs: { tea_leaf: 2 } },
  pearl: { name: 'Trân châu', icon: '⚫', kind: 'processed', base: 15, vol: 0.06, shelfDays: 5, inputs: { cassava: 1 } },
  sugar: { name: 'Đường nâu', icon: '🟤', kind: 'processed', base: 15, vol: 0.05, inputs: { cane: 1 } },
  condensed: { name: 'Sữa đặc', icon: '🍼', kind: 'processed', base: 40, vol: 0.06, shelfDays: 7, inputs: { milk: 1 } },
};

export const MARKET = {
  tickMs: 10 * 60_000,
  theta: 0.35, // tốc độ hồi về giá trung bình, mỗi ngày
  spread: 0.01, // chênh lệch mua/bán của NPC mỗi phía
  fee: 0.015, // phí giao dịch mỗi lệnh khớp (một nguồn hút xu)
  liquidity: 200, // số lô làm giá dịch 100%
  processedDepth: 3, // hàng chế biến có thương lái nơi khác mua sỉ: sâu gấp 3 lần hàng thô
  band: 0.15, // giá lệnh giới hạn phải nằm trong ±15% giá hiện tại
  matchBand: 0.2, // lệnh nằm ngoài ±20% giá hiện tại thì tạm không khớp
  npcDailyLots: 40, // mỗi người, mỗi loại hàng, mỗi chiều
  // Hạn mức chung của cả thị trấn (mỗi loại hàng, mỗi chiều, mỗi ngày): tối thiểu townBaseLots, cộng townLotsPerTrader
  // cho mỗi người đã giao dịch với NPC trong 7 ngày qua. Tài khoản phụ thêm 40 lô riêng nhưng chỉ nới hạn mức chung 15 lô.
  townBaseLots: 300,
  townLotsPerTrader: 15,
  newsPerDay: 0.8,
  newsLeadMs: 30 * 60_000,
  maxOrderLots: 100,
  // Giá = 55% luật game + 45% lực mua bán của người chơi: mỗi lệnh khớp với NPC dồn "áp lực" (mua dương, bán âm),
  // áp lực tự phai dần (chu kỳ bán rã vài giờ) và chỉ chiếm `playerWeight` phần trong giá niêm yết.
  playerWeight: 0.45,
  pressureHalfLifeMs: 6 * 3_600_000,
  maxPressure: 2,
  ceiling: 5, // giá không vượt 5 lần giá gốc
  floor: 0.25, // giá không dưới 0,25 lần giá gốc
  freshFloor: 0.4, // hàng tươi (có hạn dùng) không giữ chờ giá lên được: sàn cao hơn, 0,4 lần giá gốc
  // Pha thị trường ẩn của từng hàng thô: đổi bất chợt, trung bình mỗi `regimeHours` giờ một lần.
  regimeHours: 10,
  // Sốt giá / sập giá đột ngột: mỗi hàng thô trung bình `jumpsPerDay` lần/ngày, nhảy 12–30% tức thì.
  jumpsPerDay: 0.4,
  jumpMin: 0.12,
  jumpMax: 0.3,
  // Độ trôi dài hạn của giá trung bình (cho phép giàu nhanh / nghèo nhanh hơn trước).
  driftVol: 0.06,
  driftMin: 0.6,
  driftMax: 1.7,
  warehouse: [
    { lots: 200, price: 0 },
    { lots: 500, price: 1500 },
    { lots: 2000, price: 6000 },
  ],
};

/**
 * Pha thị trường (người chơi không thấy, chỉ đoán qua biểu đồ): `trend` kéo giá trung bình mỗi ngày,
 * `vol` nhân biến động, `weight` tỷ lệ rơi vào pha này khi đổi pha.
 */
export const REGIMES = {
  calm: { name: 'Ổn định', trend: 0, vol: 1, weight: 0.4 },
  boom: { name: 'Tăng nóng', trend: 0.2, vol: 1.3, weight: 0.2 },
  slump: { name: 'Lao dốc', trend: -0.2, vol: 1.3, weight: 0.2 },
  wild: { name: 'Hỗn loạn', trend: 0, vol: 2.5, weight: 0.2 },
};

/** Tiêu đề tin: [tin làm giá tăng, tin làm giá giảm]. */
export const HEADLINES = {
  tea_leaf: ['Mưa lớn ở đồi chè, lá trà khan hiếm', 'Đồi chè trúng mùa, lá trà dồi dào'],
  milk: ['Đàn bò nghỉ sữa, sữa tươi giảm sản lượng', 'Trang trại mở rộng đàn bò, sữa về nhiều'],
  cassava: ['Sâu hại phá ruộng sắn', 'Ruộng sắn được mùa lớn'],
  cane: ['Nắng hạn làm mía còi cọc', 'Mía ngọt trúng lớn khắp vùng'],
  strawberry: ['Sương muối làm dập dâu', 'Dâu chín rộ khắp các vườn'],
  fish: ['Biển động, thuyền không ra khơi', 'Mùa cá về, lưới đầy ắp'],
  pork: ['Dịch tả heo lan rộng, thịt khan hàng', 'Trại heo xuất chuồng đồng loạt'],
  mango: ['Mưa đá làm rụng xoài non', 'Xoài cát chín rộ khắp miệt vườn'],
  dried_tea: ['Lò sấy trà quá tải', 'Xưởng sấy trà mới khai trương'],
  pearl: ['Trà sữa trân châu thành trào lưu mới', 'Kho trân châu tồn quá nhiều'],
  sugar: ['Giá điện tăng, nhà máy đường giảm công suất', 'Nhà máy đường chạy hết công suất'],
  condensed: ['Thiếu hộp thiếc, sữa đặc khó đóng gói', 'Lò sữa đặc tăng ca'],
};

export const RAW_FIRST = Object.keys(COMMODITIES).sort((a, b) =>
  (COMMODITIES[a].kind === 'raw' ? 0 : 1) - (COMMODITIES[b].kind === 'raw' ? 0 : 1));

export function gaussian(rand) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Giá trung bình hiện hành. Hàng thô: giá gốc × chỉ số giá × độ trôi riêng × tin tức.
 * Hàng chế biến: giá gốc × (chi phí đầu vào hiện tại ÷ chi phí đầu vào gốc) × tin tức, để giữ biên lời của xưởng.
 */
export function meanPrice(id, { prices, drift = 1, index = 1, news = 1 }) {
  const c = COMMODITIES[id];
  if (c.kind === 'raw') return c.base * index * drift * news;
  let now = 0;
  let base = 0;
  for (const [input, qty] of Object.entries(c.inputs)) {
    now += prices[input] * qty;
    base += COMMODITIES[input].base * qty;
  }
  return c.base * (now / base) * news;
}

/** Giá sàn (phần của giá gốc): hàng tươi cao hơn hàng để lâu được. */
export const floorOf = (id) => (COMMODITIES[id]?.shelfDays ? MARKET.freshFloor : MARKET.floor);

/** Một bước Ornstein–Uhlenbeck: kéo về giá trung bình cộng nhiễu theo biến động ngày của hàng (nhân `volMul` của pha). */
export function stepPrice(id, price, mean, dtMs, z, volMul = 1) {
  const dt = dtMs / DAY;
  const { vol, base } = COMMODITIES[id];
  const next = price + MARKET.theta * (mean - price) * dt + vol * volMul * price * Math.sqrt(dt) * z;
  return Math.min(base * MARKET.ceiling, Math.max(base * floorOf(id), next));
}

/**
 * Độ trôi của giá trung bình: bước ngẫu nhiên, kéo nhẹ về 1, cộng xu hướng `trend`/ngày của pha thị trường;
 * giới hạn driftMin–driftMax.
 */
export function stepDrift(drift, dtMs, z, trend = 0) {
  const dt = dtMs / DAY;
  const next = drift * Math.exp(MARKET.driftVol * Math.sqrt(dt) * z - 0.1 * Math.log(drift) * dt + trend * dt);
  return Math.min(MARKET.driftMax, Math.max(MARKET.driftMin, next));
}

/** Pha kế tiếp: phần lớn nhịp giữ nguyên, thỉnh thoảng đổi sang pha khác theo trọng số. */
export function stepRegime(regime, dtMs, rand) {
  const now = REGIMES[regime] ? regime : 'calm';
  if (rand() >= dtMs / (MARKET.regimeHours * 3_600_000)) return now;
  const options = Object.entries(REGIMES).filter(([k]) => k !== now);
  let r = rand() * options.reduce((sum, [, v]) => sum + v.weight, 0);
  for (const [k, v] of options) {
    r -= v.weight;
    if (r <= 0) return k;
  }
  return options.at(-1)[0];
}

/** Áp lực mua bán của người chơi phai dần theo chu kỳ bán rã. */
export const decayPressure = (pressure, dtMs) => pressure * 0.5 ** (dtMs / MARKET.pressureHalfLifeMs);

/** Thêm áp lực sau khi khớp `lots` lô với NPC (mua dương, bán âm), giới hạn ±maxPressure. */
export const pushPressure = (pressure, lots, side, depth = MARKET.liquidity) =>
  Math.max(-MARKET.maxPressure, Math.min(MARKET.maxPressure, pressure + (side === 'buy' ? 1 : -1) * (lots / depth)));

/** Giá niêm yết: giá theo luật game nhân phần áp lực người chơi (chỉ chiếm playerWeight), trong khoảng sàn–trần. */
export function blendPrice(id, rulePrice, pressure) {
  const { base } = COMMODITIES[id];
  return Math.min(base * MARKET.ceiling, Math.max(base * floorOf(id), rulePrice * (1 + MARKET.playerWeight * pressure)));
}

/** Cú sốt giá / sập giá trong một nhịp: có thì trả về { up, size } (size là tỷ lệ nhảy, âm khi sập). */
export function rollJump(dtMs, rand) {
  if (rand() >= (MARKET.jumpsPerDay * dtMs) / DAY) return null;
  const up = rand() < 0.5;
  const size = MARKET.jumpMin + rand() * (MARKET.jumpMax - MARKET.jumpMin);
  return { up, size: up ? size : -size };
}

/** Tiêu đề tin chớp nhoáng cho cú sốt/sập giá. */
export const jumpHeadline = (id, up) => (up
  ? `⚡ Sốt giá ${COMMODITIES[id].name.toLowerCase()}: thương lái gom hàng ồ ạt`
  : `⚡ Sập giá ${COMMODITIES[id].name.toLowerCase()}: hàng xả bán tháo khắp chợ`);

export const quote = (price) => ({ bid: price * (1 - MARKET.spread), ask: price * (1 + MARKET.spread) });

/** Giá (gần đúng) sau khi khớp `lots` lô với NPC: mua đẩy giá lên, bán kéo xuống, chỉ playerWeight phần tác động. */
export const impact = (price, lots, side, depth = MARKET.liquidity) =>
  price * (1 + (side === 'buy' ? 1 : -1) * MARKET.playerWeight * (lots / depth));

/** Giá khớp bình quân khi ăn dần vào thanh khoản của NPC (nửa đường của tác động). */
export const fillPrice = (quotePrice, lots, side, depth = MARKET.liquidity) =>
  quotePrice * (1 + (side === 'buy' ? 1 : -1) * MARKET.playerWeight * (lots / depth / 2));

/** Lãi/lỗ khi bán: `proceeds` tiền thu về (đã trừ phí), `basis` giá vốn; % so với vốn (vốn 0 thì null). */
export const profitOf = (proceeds, basis) => ({ pnl: proceeds - basis, pct: basis > 0 ? (proceeds - basis) / basis : null });

/** Hạn mức chung của thị trấn (lô) cho mặt hàng `id` khi có `traders` người giao dịch trong 7 ngày; hàng chế biến sâu hơn. */
export const townNpcLots = (id, traders) =>
  Math.max(MARKET.townBaseLots, traders * MARKET.townLotsPerTrader) * (COMMODITIES[id]?.kind === 'processed' ? MARKET.processedDepth : 1);

/** Số lô làm giá mặt hàng dịch 100%. */
export const depthOf = (id) => MARKET.liquidity * (COMMODITIES[id]?.kind === 'processed' ? MARKET.processedDepth : 1);

export const tradeFee = (amount) => (amount > 0 ? Math.max(1, Math.round(amount * MARKET.fee)) : 0);

/** Thành tiền (xu, làm tròn) cho `qty` phần ở giá `pricePerLot`. */
export const amountFor = (qty, pricePerLot) => Math.round((qty / LOT) * pricePerLot);

export const inBand = (limit, price, band = MARKET.band) => Math.abs(limit - price) <= price * band;

export const shelfLife = (id, from) => (COMMODITIES[id].shelfDays ? from + COMMODITIES[id].shelfDays * DAY : null);

/**
 * Độ tươi của hàng có hạn dùng (trái cây, cá, thịt, sữa...), theo phần hạn dùng đã trôi qua:
 * nửa đầu còn Tươi, tới 80% là Kém tươi, sau đó Sắp hư; hết hạn thì hư và bị bỏ khỏi kho.
 * Bán cho NPC thì giá nhân `factor` (hàng kém chất lượng bị ép giá).
 */
export const FRESHNESS = [
  { key: 'fresh', name: 'Tươi', upTo: 0.5, factor: 1 },
  { key: 'stale', name: 'Kém tươi', upTo: 0.8, factor: 0.8 },
  { key: 'old', name: 'Sắp hư', upTo: 1, factor: 0.55 },
];

/** Độ tươi của một lô hết hạn lúc `expiresAt` (hàng không hư thì luôn Tươi). */
export function freshnessOf(id, expiresAt, now) {
  const days = COMMODITIES[id]?.shelfDays;
  if (!days || !expiresAt) return FRESHNESS[0];
  const used = 1 - (expiresAt - now) / (days * DAY);
  return FRESHNESS.find((f) => used <= f.upTo) ?? FRESHNESS.at(-1);
}

/** Tin mới: hướng, độ mạnh 20–40%, kéo dài 6–24 giờ, có hiệu lực sau `newsLeadMs`. */
export function rollNews(id, now, rand) {
  const up = rand() < 0.5;
  const strength = 0.2 + rand() * 0.2;
  const starts = now + MARKET.newsLeadMs;
  return {
    commodity: id,
    headline: HEADLINES[id][up ? 0 : 1],
    effect: up ? strength : -strength,
    created_at: now,
    starts_at: starts,
    ends_at: starts + (6 + rand() * 18) * 3_600_000,
  };
}
