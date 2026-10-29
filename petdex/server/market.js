// Sàn Nguyên Liệu: giá chạy theo thời gian thực, kho theo lô, lệnh thị trường/giới hạn, NPC đứng giữa.
import { db, getUser, listPets, setWarehouse, skillsOf, transaction } from './db.js';
import { economy } from './bank.js';
import { dayKey } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { chargeFee, post } from './ledger.js';
import { tradeBonus } from './gear.js';
import {
  COMMODITIES, LOT, MARKET, RAW_FIRST, amountFor, depthOf, fillPrice, gaussian, impact, inBand, meanPrice,
  quote, rollNews, shelfLife, stepDrift, stepPrice, tradeFee,
} from './rules/market.js';

const q = {
  states: db.prepare('SELECT * FROM commodity_state'),
  state: db.prepare('SELECT * FROM commodity_state WHERE commodity = ?'),
  initState: db.prepare('INSERT OR IGNORE INTO commodity_state (commodity, price, drift, updated_at) VALUES (?, ?, 1, ?)'),
  setState: db.prepare('UPDATE commodity_state SET price = ?, drift = ?, updated_at = ? WHERE commodity = ?'),
  setPrice: db.prepare('UPDATE commodity_state SET price = ? WHERE commodity = ?'),
  addHistory: db.prepare('INSERT OR REPLACE INTO commodity_prices (commodity, at, price) VALUES (?, ?, ?)'),
  history: db.prepare('SELECT at, price FROM commodity_prices WHERE commodity = ? AND at >= ? ORDER BY at'),
  priceAt: db.prepare('SELECT price FROM commodity_prices WHERE commodity = ? AND at <= ? ORDER BY at DESC LIMIT 1'),
  pruneHistory: db.prepare('DELETE FROM commodity_prices WHERE at < ?'),
  activeNews: db.prepare('SELECT effect FROM news WHERE commodity = ? AND starts_at <= ? AND ends_at > ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'),
  recentNews: db.prepare('SELECT * FROM news WHERE created_at >= ? ORDER BY created_at DESC LIMIT 60'),

  lots: db.prepare('SELECT * FROM lots WHERE user_id = ? ORDER BY commodity, expires_at IS NULL, expires_at, id'),
  lotsOf: db.prepare('SELECT * FROM lots WHERE user_id = ? AND commodity = ? ORDER BY expires_at IS NULL, expires_at, id'),
  spoiled: db.prepare('SELECT commodity, SUM(qty) AS qty FROM lots WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at <= ? GROUP BY commodity'),
  dropSpoiled: db.prepare('DELETE FROM lots WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at <= ?'),
  held: db.prepare('SELECT COALESCE(SUM(qty), 0) AS qty FROM lots WHERE user_id = ?'),
  reserved: db.prepare("SELECT COALESCE(SUM(qty - filled), 0) AS qty FROM orders WHERE user_id = ? AND side = 'buy' AND status = 'open'"),
  addLot: db.prepare('INSERT INTO lots (user_id, commodity, qty, acquired_at, expires_at, cost) VALUES (?, ?, ?, ?, ?, ?)'),
  addGain: db.prepare(`
    INSERT INTO gains (user_id, day, amount) VALUES (?, ?, ?)
    ON CONFLICT (user_id, day) DO UPDATE SET amount = amount + excluded.amount`),
  setLotQty: db.prepare('UPDATE lots SET qty = ? WHERE id = ?'),
  deleteLot: db.prepare('DELETE FROM lots WHERE id = ?'),

  insertOrder: db.prepare(`
    INSERT INTO orders (user_id, commodity, side, qty, limit_price, locked, goods_expires_at, goods_cost, status, day, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`),
  order: db.prepare('SELECT * FROM orders WHERE id = ?'),
  myOrders: db.prepare("SELECT * FROM orders WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC"),
  book: db.prepare(`
    SELECT * FROM orders WHERE commodity = ? AND side = ? AND status = 'open' AND user_id != ?
    ORDER BY CASE WHEN side = 'sell' THEN limit_price ELSE -limit_price END, created_at`),
  openOrders: db.prepare("SELECT * FROM orders WHERE status = 'open' ORDER BY created_at"),
  staleOrders: db.prepare("SELECT * FROM orders WHERE status = 'open' AND day < ?"),
  updateOrder: db.prepare('UPDATE orders SET filled = ?, locked = ?, status = ? WHERE id = ?'),

  flow: db.prepare('SELECT bought, sold FROM npc_flow WHERE user_id = ? AND day = ? AND commodity = ?'),
  addFlow: db.prepare(`
    INSERT INTO npc_flow (user_id, day, commodity, bought, sold) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id, day, commodity) DO UPDATE SET bought = bought + excluded.bought, sold = sold + excluded.sold`),
};

const lotsText = (qty) => (qty / LOT).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const memoFor = (id, qty, price) => `${lotsText(qty)} lô ${COMMODITIES[id].name} @ ${price.toFixed(1)}`;

export function initMarket(now = Date.now()) {
  for (const [id, c] of Object.entries(COMMODITIES)) {
    q.initState.run(id, c.base, now);
    q.addHistory.run(id, now, q.state.get(id).price);
  }
}

export const currentPrices = () => Object.fromEntries(q.states.all().map((s) => [s.commodity, s.price]));

// ---------------------------------------------------------------- kho

export const capacityOf = (user) => MARKET.warehouse[user.warehouse].lots * LOT;

/** Bỏ các lô đã hư; trả về [{ commodity, qty }] vừa hư để báo cho người chơi. */
function purge(userId, now) {
  const spoiled = q.spoiled.all(userId, now);
  if (spoiled.length) q.dropSpoiled.run(userId, now);
  return spoiled;
}

/** Số phần kho còn trống (đã trừ chỗ giữ cho lệnh mua đang chờ). */
export function freeSpace(userId) {
  return capacityOf(getUser(userId)) - q.held.get(userId).qty - q.reserved.get(userId).qty;
}

/**
 * Nhập hàng vào kho; `allowPartial` thì nhận tới khi đầy (dùng cho phần thưởng), không thì báo lỗi.
 * `cost` là giá vốn mỗi phần, để tính lãi khi bán.
 */
export function addGoods(userId, commodity, qty, now = Date.now(), { expiresAt = shelfLife(commodity, now), allowPartial = false, cost = 0 } = {}) {
  let take = qty;
  const free = freeSpace(userId);
  if (take > free) {
    if (!allowPartial) throw new GameError('Kho đầy rồi: nâng cấp kho hoặc bán bớt hàng.');
    take = Math.max(0, free);
  }
  if (take > 0) q.addLot.run(userId, commodity, take, now, expiresAt, cost);
  return take;
}

/** Lấy hàng ra theo thứ tự sắp hư trước; trả về hạn dùng sớm nhất và giá vốn bình quân mỗi phần của phần lấy ra. */
function takeGoods(userId, commodity, qty, now) {
  purge(userId, now);
  const lots = q.lotsOf.all(userId, commodity);
  const have = lots.reduce((sum, l) => sum + l.qty, 0);
  if (have < qty) throw new GameError(`Kho chỉ còn ${lotsText(have)} lô ${COMMODITIES[commodity].name}.`);
  let left = qty;
  let earliest = null;
  let basis = 0;
  for (const lot of lots) {
    if (!left) break;
    const take = Math.min(lot.qty, left);
    left -= take;
    basis += take * lot.cost;
    if (lot.expires_at && (earliest === null || lot.expires_at < earliest)) earliest = lot.expires_at;
    if (take === lot.qty) q.deleteLot.run(lot.id);
    else q.setLotQty.run(lot.qty - take, lot.id);
  }
  return { expiresAt: earliest, cost: qty ? basis / qty : 0 };
}

/** Ghi lãi (hoặc lỗ) đã chốt khi bán hàng, để quyết toán thuế cuối ngày. */
export function recordGain(userId, gain, now) {
  if (gain) q.addGain.run(userId, dayKey(now), Math.round(gain));
}

/** Số phần còn dùng được của từng mặt hàng trong kho (đã bỏ hàng hư). */
export function stock(userId, now = Date.now()) {
  purge(userId, now);
  const out = {};
  for (const lot of q.lots.all(userId)) out[lot.commodity] = (out[lot.commodity] ?? 0) + lot.qty;
  return out;
}

/** Lấy hàng ra khỏi kho (quầy dùng nguyên liệu, góp dự án Hội...). */
export const removeGoods = (userId, commodity, qty, now = Date.now()) => takeGoods(userId, commodity, qty, now);

export function upgradeWarehouse(userId, now = Date.now()) {
  return transaction(() => {
    const user = getUser(userId);
    const next = MARKET.warehouse[user.warehouse + 1];
    if (!next) throw new GameError('Kho đã lớn nhất rồi.');
    post({ userId, delta: -next.price, kind: 'warehouse', memo: `Kho ${next.lots} lô`, now });
    setWarehouse(userId, user.warehouse + 1);
    return { message: `Kho mở rộng lên ${next.lots} lô.` };
  });
}

// ---------------------------------------------------------------- khớp lệnh

/** Số phần tối đa khớp với NPC mà giá bình quân vẫn không vượt giới hạn. */
function npcQtyWithin(commodity, ref, limit, side) {
  const room = side === 'buy' ? limit / ref - 1 : 1 - limit / ref;
  return room <= 0 ? 0 : Math.floor(room * 2 * depthOf(commodity) * LOT);
}

function npcLeft(userId, day, commodity, side) {
  const flow = q.flow.get(userId, day, commodity) ?? { bought: 0, sold: 0 };
  return Math.max(0, MARKET.npcDailyLots * LOT - (side === 'buy' ? flow.bought : flow.sold));
}

/** Thanh toán cho người đặt lệnh chờ khi lệnh của họ khớp `qty` phần ở giá `price`. */
function settleResting(order, qty, price, now, goodsExpiry = null) {
  const amount = amountFor(qty, price);
  const fee = tradeFee(amount);
  const memo = memoFor(order.commodity, qty, price);
  if (order.side === 'sell') {
    post({ userId: order.user_id, delta: amount, kind: 'market_sell', memo, now });
    tradeBonus(order.user_id, amount, `Bán trên Sàn: ${memo}`, now);
    chargeFee(order.user_id, Math.min(fee, amount), 'Phí bán trên Sàn', now);
    recordGain(order.user_id, amount - Math.min(fee, amount) - qty * order.goods_cost, now);
  } else {
    const charge = Math.min(amount + fee, order.locked);
    const spent = Math.min(amount, charge);
    post({ userId: order.user_id, delta: charge, kind: 'escrow_release', memo, now });
    post({ userId: order.user_id, delta: -spent, kind: 'market_buy', memo, now });
    chargeFee(order.user_id, charge - spent, 'Phí mua trên Sàn', now);
    order.locked -= charge;
    q.addLot.run(order.user_id, order.commodity, qty, now, goodsExpiry ?? shelfLife(order.commodity, now), price / LOT);
  }
  order.filled += qty;
  const done = order.filled >= order.qty;
  if (done && order.locked > 0) {
    post({ userId: order.user_id, delta: order.locked, kind: 'escrow_release', memo: 'Hoàn ký quỹ thừa', now });
    order.locked = 0;
  }
  q.updateOrder.run(order.filled, order.locked, done ? 'filled' : 'open', order.id);
}

function validateOrder({ commodity, side, qty, type, limit }) {
  if (!COMMODITIES[commodity]) throw new GameError('Không có mặt hàng này.');
  if (!['buy', 'sell'].includes(side)) throw new GameError('Lệnh phải là mua hoặc bán.');
  if (!['market', 'limit'].includes(type)) throw new GameError('Loại lệnh không hợp lệ.');
  if (!Number.isInteger(qty) || qty < 1 || qty > MARKET.maxOrderLots * LOT) {
    throw new GameError(`Khối lượng từ 0,1 đến ${MARKET.maxOrderLots} lô.`);
  }
  if (type === 'limit' && !(Number.isFinite(limit) && limit > 0)) throw new GameError('Giá đặt không hợp lệ.');
}

/**
 * Đặt lệnh. qty tính bằng phần; limit là giá mỗi lô.
 * Khớp trước với lệnh chờ của người chơi khác (nếu giá tốt hơn NPC), phần còn lại khớp với NPC trong hạn mức ngày.
 * Lệnh giới hạn chưa khớp hết thì nằm chờ đến cuối ngày (mua: ký quỹ xu, bán: giữ hàng).
 */
export function placeOrder(userId, order, now = Date.now()) {
  validateOrder(order);
  const { commodity, side, qty, type } = order;
  const limit = type === 'limit' ? order.limit : null;
  return transaction(() => {
    const day = dayKey(now);
    purge(userId, now);
    let price = q.state.get(commodity).price;
    if (limit !== null && !inBand(limit, price)) {
      const lo = (price * (1 - MARKET.band)).toFixed(1);
      const hi = (price * (1 + MARKET.band)).toFixed(1);
      throw new GameError(`Giá đặt phải nằm trong khoảng ${lo}–${hi} xu/lô.`);
    }
    let goodsExpiry = null;
    let goodsCost = 0;
    if (side === 'sell') ({ expiresAt: goodsExpiry, cost: goodsCost } = takeGoods(userId, commodity, qty, now));
    else if (qty > freeSpace(userId)) throw new GameError('Kho không đủ chỗ cho lượng hàng này.');

    const fills = [];
    let remaining = qty;
    const { bid, ask } = quote(price);
    for (const rest of q.book.all(commodity, side === 'buy' ? 'sell' : 'buy', userId)) {
      if (!remaining) break;
      if (!inBand(rest.limit_price, price, MARKET.matchBand)) continue;
      const better = side === 'buy' ? rest.limit_price <= ask : rest.limit_price >= bid;
      const withinLimit = limit === null || (side === 'buy' ? rest.limit_price <= limit : rest.limit_price >= limit);
      if (!better || !withinLimit) continue;
      const take = Math.min(remaining, rest.qty - rest.filled);
      settleResting(rest, take, rest.limit_price, now, goodsExpiry);
      fills.push({ qty: take, price: rest.limit_price, expiresAt: side === 'buy' ? rest.goods_expires_at : null });
      remaining -= take;
    }

    if (remaining) {
      const ref = side === 'buy' ? ask : bid;
      let npcQty = Math.min(remaining, npcLeft(userId, day, commodity, side));
      if (limit !== null) npcQty = Math.min(npcQty, npcQtyWithin(commodity, ref, limit, side));
      if (npcQty > 0) {
        fills.push({ qty: npcQty, price: fillPrice(ref, npcQty / LOT, side, depthOf(commodity)), expiresAt: side === 'buy' ? shelfLife(commodity, now) : null });
        q.addFlow.run(userId, day, commodity, side === 'buy' ? npcQty : 0, side === 'sell' ? npcQty : 0);
        price = impact(price, npcQty / LOT, side, depthOf(commodity));
        q.setPrice.run(price, commodity);
        remaining -= npcQty;
      }
    }

    const filled = qty - remaining;
    const amount = fills.reduce((sum, f) => sum + amountFor(f.qty, f.price), 0);
    const fee = tradeFee(amount);
    const memo = filled ? memoFor(commodity, filled, amount / (filled / LOT)) : '';
    if (filled && side === 'buy') {
      post({ userId, delta: -amount, kind: 'market_buy', memo, now });
      chargeFee(userId, fee, 'Phí mua trên Sàn', now);
      for (const f of fills) q.addLot.run(userId, commodity, f.qty, now, f.expiresAt, (f.price * (1 + MARKET.fee)) / LOT);
    } else if (filled) {
      post({ userId, delta: amount, kind: 'market_sell', memo, now });
      tradeBonus(userId, amount, `Bán trên Sàn: ${memo}`, now);
      chargeFee(userId, Math.min(fee, amount), 'Phí bán trên Sàn', now);
      recordGain(userId, amount - Math.min(fee, amount) - filled * goodsCost, now);
    }

    let orderId = null;
    if (remaining && limit !== null) {
      const lock = side === 'buy' ? amountFor(remaining, limit) + tradeFee(amountFor(remaining, limit)) : 0;
      if (lock) post({ userId, delta: -lock, kind: 'escrow_lock', memo: `Lệnh mua ${memoFor(commodity, remaining, limit)}`, now });
      orderId = Number(q.insertOrder.run(userId, commodity, side, remaining, limit, lock, goodsExpiry, goodsCost, day, now).lastInsertRowid);
    } else if (remaining && side === 'sell') {
      q.addLot.run(userId, commodity, remaining, now, goodsExpiry, goodsCost);
    }
    if (!filled && limit === null) throw new GameError('Hôm nay đã hết hạn mức giao dịch với NPC cho mặt hàng này.');

    const verb = side === 'buy' ? 'Mua' : 'Bán';
    const parts = [];
    if (filled) parts.push(`${verb} ${lotsText(filled)} lô ${COMMODITIES[commodity].name}, ${side === 'buy' ? 'trả' : 'nhận'} ${amount} 🪙 (phí ${fee})`);
    if (orderId) parts.push(`${lotsText(remaining)} lô đang chờ khớp ở giá ${limit.toFixed(1)}`);
    else if (remaining) parts.push(`${lotsText(remaining)} lô chưa khớp, đã trả lại kho`);
    return { message: parts.join('. '), filled, amount, fee, orderId };
  });
}

function closeOrder(order, status, now) {
  const left = order.qty - order.filled;
  if (order.side === 'buy' && order.locked > 0) {
    post({ userId: order.user_id, delta: order.locked, kind: 'escrow_release', memo: 'Hủy lệnh mua', now });
  } else if (order.side === 'sell' && left > 0) {
    q.addLot.run(order.user_id, order.commodity, left, now, order.goods_expires_at, order.goods_cost);
  }
  q.updateOrder.run(order.filled, 0, status, order.id);
}

export function cancelOrder(userId, orderId, now = Date.now()) {
  return transaction(() => {
    const order = q.order.get(orderId);
    if (!order || order.user_id !== userId || order.status !== 'open') throw new GameError('Không tìm thấy lệnh đang chờ này.');
    closeOrder(order, 'cancelled', now);
    return { message: 'Đã hủy lệnh, ký quỹ và hàng đã trả về.' };
  });
}

/** Lệnh chờ còn sót từ hôm trước thì hết hạn (gọi lúc quyết toán ngày). */
export function expireOrders(today, now = Date.now()) {
  transaction(() => {
    for (const order of q.staleOrders.all(today)) closeOrder(order, 'expired', now);
  });
}

/** Sau mỗi nhịp giá: lệnh chờ nào chạm giá NPC thì khớp với NPC. */
function matchRestingWithNpc(now) {
  const day = dayKey(now);
  for (const order of q.openOrders.all()) {
    const price = q.state.get(order.commodity).price;
    const { bid, ask } = quote(price);
    const ref = order.side === 'buy' ? ask : bid;
    let qty = Math.min(order.qty - order.filled, npcLeft(order.user_id, day, order.commodity, order.side));
    qty = Math.min(qty, npcQtyWithin(order.commodity, ref, order.limit_price, order.side));
    if (qty <= 0) continue;
    settleResting(order, qty, fillPrice(ref, qty / LOT, order.side, depthOf(order.commodity)), now);
    q.addFlow.run(order.user_id, day, order.commodity, order.side === 'buy' ? qty : 0, order.side === 'sell' ? qty : 0);
    q.setPrice.run(impact(price, qty / LOT, order.side, depthOf(order.commodity)), order.commodity);
  }
}

// ---------------------------------------------------------------- nhịp giá

/** Một nhịp 10 phút: tin tức mới, giá trung bình, bước giá, rồi khớp lệnh chờ. */
export function marketTick(now, rand = Math.random) {
  transaction(() => {
    const states = Object.fromEntries(q.states.all().map((s) => [s.commodity, s]));
    const prices = Object.fromEntries(Object.entries(states).map(([id, s]) => [id, s.price]));
    const { priceIndex } = economy();
    for (const id of RAW_FIRST) {
      if (rand() < (MARKET.newsPerDay * MARKET.tickMs) / DAY) {
        const n = rollNews(id, now, rand);
        q.insertNews.run(n.commodity, n.headline, n.effect, n.created_at, n.starts_at, n.ends_at);
      }
      const news = q.activeNews.all(id, now, now).reduce((m, n) => m * (1 + n.effect), 1);
      const drift = COMMODITIES[id].kind === 'raw' ? stepDrift(states[id].drift, MARKET.tickMs, gaussian(rand)) : 1;
      const mean = meanPrice(id, { prices, drift, index: priceIndex, news });
      prices[id] = stepPrice(id, prices[id], mean, MARKET.tickMs, gaussian(rand));
      q.setState.run(prices[id], drift, now, id);
      q.addHistory.run(id, now, prices[id]);
    }
    matchRestingWithNpc(now);
  });
}

export const pruneHistory = (before) => q.pruneHistory.run(before);

// ---------------------------------------------------------------- đọc

function smartReader(userId) {
  return listPets(userId).some((p) => (skillsOf(p.id).intellect ?? 0) >= 60);
}

export function marketView(userId, now = Date.now()) {
  const spoiled = transaction(() => purge(userId, now));
  const day = dayKey(now);
  const holdings = {};
  for (const lot of q.lots.all(userId)) {
    const h = (holdings[lot.commodity] ??= { qty: 0, lots: [] });
    h.qty += lot.qty;
    h.lots.push({ qty: lot.qty, expiresAt: lot.expires_at });
  }
  const commodities = q.states.all().map((s) => {
    const { bid, ask } = quote(s.price);
    const dayAgo = q.priceAt.get(s.commodity, now - DAY)?.price ?? q.history.all(s.commodity, 0)[0]?.price ?? s.price;
    const ticks = q.history.all(s.commodity, now - DAY);
    return {
      id: s.commodity,
      price: s.price,
      bid,
      ask,
      change: (s.price - dayAgo) / dayAgo,
      spark: ticks.filter((_, i) => i % 3 === 0 || i === ticks.length - 1).map((t) => t.price),
      held: holdings[s.commodity]?.qty ?? 0,
      npcLeft: { buy: npcLeft(userId, day, s.commodity, 'buy'), sell: npcLeft(userId, day, s.commodity, 'sell') },
    };
  });
  const smart = smartReader(userId);
  const news = q.recentNews.all(now - 2 * DAY)
    .filter((n) => n.commodity && (n.starts_at <= now || (smart && n.created_at <= now)))
    .slice(0, 12)
    .map((n) => ({ id: n.id, commodity: n.commodity, headline: n.headline, up: n.effect > 0, at: n.created_at, early: n.starts_at > now }));
  const user = getUser(userId);
  return {
    commodities,
    holdings,
    news,
    smart,
    orders: q.myOrders.all(userId).map((o) => ({
      id: o.id, commodity: o.commodity, side: o.side, qty: o.qty, filled: o.filled, limit: o.limit_price, locked: o.locked, createdAt: o.created_at,
    })),
    warehouse: {
      level: user.warehouse,
      capacity: capacityOf(user),
      used: q.held.get(userId).qty,
      reserved: q.reserved.get(userId).qty,
      next: MARKET.warehouse[user.warehouse + 1] ?? null,
    },
    spoiled,
  };
}

/** Dữ liệu biểu đồ: 'day' = các nhịp 10 phút trong 24 giờ; 'week' = nến theo giờ trong 7 ngày. */
export function priceHistory(commodity, range, now = Date.now()) {
  if (!COMMODITIES[commodity]) throw new GameError('Không có mặt hàng này.');
  if (range === 'day') return q.history.all(commodity, now - DAY).map((t) => ({ at: t.at, price: t.price }));
  const candles = new Map();
  for (const t of q.history.all(commodity, now - 7 * DAY)) {
    const hour = Math.floor(t.at / HOUR) * HOUR;
    const c = candles.get(hour);
    if (!c) candles.set(hour, { at: hour, open: t.price, high: t.price, low: t.price, close: t.price });
    else Object.assign(c, { high: Math.max(c.high, t.price), low: Math.min(c.low, t.price), close: t.price });
  }
  return [...candles.values()];
}

/** Giá trị hàng trong kho và trong lệnh bán đang chờ, tính theo giá NPC mua vào. */
export function goodsValue(userId) {
  const prices = currentPrices();
  let value = 0;
  for (const lot of q.lots.all(userId)) value += (lot.qty / LOT) * quote(prices[lot.commodity]).bid;
  for (const o of q.myOrders.all(userId)) {
    if (o.side === 'sell') value += ((o.qty - o.filled) / LOT) * quote(prices[o.commodity]).bid;
  }
  return Math.round(value);
}

export const lockedInOrders = (userId) => q.myOrders.all(userId).reduce((sum, o) => sum + o.locked, 0);
