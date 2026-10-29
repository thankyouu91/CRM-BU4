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
  dried_tea: { name: 'Trà khô', icon: '🍂', kind: 'processed', base: 35, vol: 0.06, inputs: { tea_leaf: 2 } },
  pearl: { name: 'Trân châu', icon: '⚫', kind: 'processed', base: 15, vol: 0.06, shelfDays: 5, inputs: { cassava: 1 } },
  sugar: { name: 'Đường nâu', icon: '🟤', kind: 'processed', base: 15, vol: 0.05, inputs: { cane: 1 } },
  condensed: { name: 'Sữa đặc', icon: '🍼', kind: 'processed', base: 40, vol: 0.06, shelfDays: 7, inputs: { milk: 1 } },
};

export const MARKET = {
  tickMs: 10 * 60_000,
  theta: 0.35, // tốc độ hồi về giá trung bình, mỗi ngày
  spread: 0.01, // chênh lệch mua/bán của NPC mỗi phía
  fee: 0.01,
  liquidity: 200, // số lô làm giá dịch 100%
  processedDepth: 3, // hàng chế biến có thương lái nơi khác mua sỉ: sâu gấp 3 lần hàng thô
  band: 0.15, // giá lệnh giới hạn phải nằm trong ±15% giá hiện tại
  matchBand: 0.2, // lệnh nằm ngoài ±20% giá hiện tại thì tạm không khớp
  npcDailyLots: 40, // mỗi người, mỗi loại hàng, mỗi chiều
  newsPerDay: 0.8,
  newsLeadMs: 30 * 60_000,
  maxOrderLots: 100,
  warehouse: [
    { lots: 200, price: 0 },
    { lots: 500, price: 1500 },
    { lots: 2000, price: 6000 },
  ],
};

/** Tiêu đề tin: [tin làm giá tăng, tin làm giá giảm]. */
export const HEADLINES = {
  tea_leaf: ['Mưa lớn ở đồi chè, lá trà khan hiếm', 'Đồi chè trúng mùa, lá trà dồi dào'],
  milk: ['Đàn bò nghỉ sữa, sữa tươi giảm sản lượng', 'Trang trại mở rộng đàn bò, sữa về nhiều'],
  cassava: ['Sâu hại phá ruộng sắn', 'Ruộng sắn được mùa lớn'],
  cane: ['Nắng hạn làm mía còi cọc', 'Mía ngọt trúng lớn khắp vùng'],
  strawberry: ['Sương muối làm dập dâu', 'Dâu chín rộ khắp các vườn'],
  fish: ['Biển động, thuyền không ra khơi', 'Mùa cá về, lưới đầy ắp'],
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

/** Một bước Ornstein–Uhlenbeck: kéo về giá trung bình cộng nhiễu theo biến động ngày của hàng. */
export function stepPrice(id, price, mean, dtMs, z) {
  const dt = dtMs / DAY;
  const { vol, base } = COMMODITIES[id];
  const next = price + MARKET.theta * (mean - price) * dt + vol * price * Math.sqrt(dt) * z;
  return Math.max(base * 0.25, next);
}

/** Độ trôi của giá trung bình: bước ngẫu nhiên chậm, luôn kéo nhẹ về 1, giới hạn 0,8–1,25. */
export function stepDrift(drift, dtMs, z) {
  const dt = dtMs / DAY;
  const next = drift * Math.exp(0.03 * Math.sqrt(dt) * z - 0.1 * Math.log(drift) * dt);
  return Math.min(1.25, Math.max(0.8, next));
}

export const quote = (price) => ({ bid: price * (1 - MARKET.spread), ask: price * (1 + MARKET.spread) });

/** Giá sau khi khớp `lots` lô với NPC: mua đẩy giá lên, bán kéo giá xuống. */
export const impact = (price, lots, side, depth = MARKET.liquidity) => price * (1 + (side === 'buy' ? 1 : -1) * (lots / depth));

/** Giá khớp bình quân khi ăn dần vào thanh khoản của NPC (nửa đường của tác động). */
export const fillPrice = (quotePrice, lots, side, depth = MARKET.liquidity) => quotePrice * (1 + (side === 'buy' ? 1 : -1) * (lots / depth / 2));

/** Số lô làm giá mặt hàng dịch 100%. */
export const depthOf = (id) => MARKET.liquidity * (COMMODITIES[id]?.kind === 'processed' ? MARKET.processedDepth : 1);

export const tradeFee = (amount) => (amount > 0 ? Math.max(1, Math.round(amount * MARKET.fee)) : 0);

/** Thành tiền (xu, làm tròn) cho `qty` phần ở giá `pricePerLot`. */
export const amountFor = (qty, pricePerLot) => Math.round((qty / LOT) * pricePerLot);

export const inBand = (limit, price, band = MARKET.band) => Math.abs(limit - price) <= price * band;

export const shelfLife = (id, from) => (COMMODITIES[id].shelfDays ? from + COMMODITIES[id].shelfDays * DAY : null);

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
