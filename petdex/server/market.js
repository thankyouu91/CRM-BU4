// Sàn Nguyên Liệu: giá chạy theo thời gian thực, kho theo lô, lệnh thị trường/giới hạn, NPC đứng giữa.
import { db, getUser, listPets, setWarehouse, skillsOf, transaction } from './db.js';
import { economy } from './bank.js';
import { dayKey, startOfDay } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { chargeFee, post } from './ledger.js';
import { tradeBonus } from './gear.js';
import { windTradeBonus } from './strategic.js';
import {
  COMMODITIES, LOT, MARKET, RAW_FIRST, REGIMES, amountFor, blendPrice, decayPressure, depthOf, fillPrice, freshnessOf, gaussian, inBand,
  jumpHeadline, meanPrice, profitOf, pushPressure, quote, rollJump, rollNews, shelfLife, stepDrift, stepPrice, stepRegime, townNpcLots, tradeFee,
} from './rules/market.js';
import { designComplete } from '../../public/ta-tua/game/js/shared/clan.js';
import { industryInfluence } from '../../public/ta-tua/game/js/shared/industry-market.js';

const q = {
  states: db.prepare('SELECT * FROM commodity_state'),
  state: db.prepare('SELECT * FROM commodity_state WHERE commodity = ?'),
  initState: db.prepare('INSERT OR IGNORE INTO commodity_state (commodity, price, drift, updated_at, rule_price) VALUES (?, ?, 1, ?, ?)'),
  setState: db.prepare('UPDATE commodity_state SET price = ?, drift = ?, updated_at = ?, rule_price = ?, pressure = ?, regime = ? WHERE commodity = ?'),
  setTrade: db.prepare('UPDATE commodity_state SET price = ?, pressure = ? WHERE commodity = ?'),
  addHistory: db.prepare('INSERT OR REPLACE INTO commodity_prices (commodity, at, price) VALUES (?, ?, ?)'),
  history: db.prepare('SELECT at, price FROM commodity_prices WHERE commodity = ? AND at >= ? ORDER BY at'),
  priceAt: db.prepare('SELECT price FROM commodity_prices WHERE commodity = ? AND at <= ? ORDER BY at DESC LIMIT 1'),
  pruneHistory: db.prepare('DELETE FROM commodity_prices WHERE at < ?'),
  activeNews: db.prepare('SELECT effect FROM news WHERE commodity = ? AND starts_at <= ? AND ends_at > ? AND flash = 0'),
  insertFlash: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at, flash) VALUES (?, ?, ?, ?, ?, ?, 1)'),
  insertTrade: db.prepare(`
    INSERT INTO market_trades (user_id, commodity, side, qty, price, amount, fee, cost, pnl, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  recentTrades: db.prepare('SELECT * FROM market_trades WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 15'),
  realized: db.prepare("SELECT COALESCE(SUM(pnl), 0) AS pnl, COUNT(*) AS n, COALESCE(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END), 0) AS wins FROM market_trades WHERE user_id = ? AND side = 'sell' AND at >= ?"),
  pruneTrades: db.prepare('DELETE FROM market_trades WHERE at < ?'),
  industryClans: db.prepare(`
    SELECT ci.industry, COUNT(DISTINCT ci.clan_id) AS n FROM clan_industries ci JOIN clans c ON c.id = ci.clan_id
    WHERE c.dissolved_at IS NULL GROUP BY ci.industry`),
  industryPlots: db.prepare(`
    SELECT lp.industry, lp.design FROM land_plots lp JOIN clans c ON c.id = lp.clan_id
    WHERE lp.industry IS NOT NULL AND c.dissolved_at IS NULL`),
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
  townFlow: db.prepare('SELECT COALESCE(SUM(bought), 0) AS bought, COALESCE(SUM(sold), 0) AS sold FROM npc_flow WHERE day = ? AND commodity = ?'),
  traders: db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM npc_flow WHERE day >= ?'),
  addFlow: db.prepare(`
    INSERT INTO npc_flow (user_id, day, commodity, bought, sold) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id, day, commodity) DO UPDATE SET bought = bought + excluded.bought, sold = sold + excluded.sold`),
};

const lotsText = (qty) => (qty / LOT).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const memoFor = (id, qty, price) => `${lotsText(qty)} lô ${COMMODITIES[id].name} @ ${price.toFixed(1)}`;

export function initMarket(now = Date.now()) {
  for (const [id, c] of Object.entries(COMMODITIES)) {
    q.initState.run(id, c.base, now, c.base);
    q.addHistory.run(id, now, q.state.get(id).price);
  }
}

/** Mặt hàng thêm vào sau khi Sàn đã mở (DB cũ) chưa có dòng giá: tạo ở giá gốc. Chỉ ghi khi thiếu. */
function ensureStates(states, now) {
  for (const [id, c] of Object.entries(COMMODITIES)) {
    if (states[id]) continue;
    q.initState.run(id, c.base, now, c.base);
    q.addHistory.run(id, now, c.base);
    states[id] = q.state.get(id);
  }
  return states;
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

/**
 * Lấy hàng ra theo thứ tự sắp hư trước; trả về hạn dùng sớm nhất, giá vốn bình quân mỗi phần
 * và hệ số độ tươi bình quân (1 = tươi; kém tươi, sắp hư thì thấp hơn) của phần lấy ra.
 */
function takeGoods(userId, commodity, qty, now) {
  purge(userId, now);
  const lots = q.lotsOf.all(userId, commodity);
  const have = lots.reduce((sum, l) => sum + l.qty, 0);
  if (have < qty) throw new GameError(`Kho chỉ còn ${lotsText(have)} lô ${COMMODITIES[commodity].name}.`);
  let left = qty;
  let earliest = null;
  let basis = 0;
  let quality = 0;
  for (const lot of lots) {
    if (!left) break;
    const take = Math.min(lot.qty, left);
    left -= take;
    basis += take * lot.cost;
    quality += take * freshnessOf(commodity, lot.expires_at, now).factor;
    if (lot.expires_at && (earliest === null || lot.expires_at < earliest)) earliest = lot.expires_at;
    if (take === lot.qty) q.deleteLot.run(lot.id);
    else q.setLotQty.run(lot.qty - take, lot.id);
  }
  return { expiresAt: earliest, cost: qty ? basis / qty : 0, quality: qty ? quality / qty : 1 };
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
  return room <= 0 ? 0 : Math.floor((room * 2 * depthOf(commodity) * LOT) / MARKET.playerWeight);
}

/** Hạn mức NPC còn lại của riêng người chơi hôm nay (phần). */
function ownLeft(userId, day, commodity, side) {
  const flow = q.flow.get(userId, day, commodity) ?? { bought: 0, sold: 0 };
  return Math.max(0, MARKET.npcDailyLots * LOT - (side === 'buy' ? flow.bought : flow.sold));
}

/** Số người đã giao dịch với NPC trong 7 ngày tới hết `day` (đếm lại mỗi ngày một lần). */
const traderCache = new Map();
function tradersOf(day) {
  if (!traderCache.has(day)) {
    traderCache.clear();
    traderCache.set(day, q.traders.get(dayKey(startOfDay(day) - 6 * DAY)).n);
  }
  return traderCache.get(day);
}

/** Hạn mức chung của thị trấn: tổng và phần còn lại hôm nay (phần) cho mặt hàng và chiều giao dịch. */
export function townQuota(day, commodity, side) {
  const total = townNpcLots(commodity, tradersOf(day)) * LOT;
  const flow = q.townFlow.get(day, commodity);
  return { total, left: Math.max(0, total - (side === 'buy' ? flow.bought : flow.sold)) };
}

/** NPC còn nhận bao nhiêu phần từ người này: không quá hạn mức riêng, cũng không quá phần chung còn lại của thị trấn. */
function npcLeft(userId, day, commodity, side) {
  return Math.min(ownLeft(userId, day, commodity, side), townQuota(day, commodity, side).left);
}

/** Thanh toán cho người đặt lệnh chờ khi lệnh của họ khớp `qty` phần ở giá `price`. */
function settleResting(order, qty, price, now, goodsExpiry = null) {
  const amount = amountFor(qty, price);
  const fee = tradeFee(amount);
  const memo = memoFor(order.commodity, qty, price);
  if (order.side === 'sell') {
    post({ userId: order.user_id, delta: amount, kind: 'market_sell', memo, now });
    const bonus = tradeBonus(order.user_id, amount, `Bán trên Sàn: ${memo}`, now) + windTradeBonus(order.user_id, amount, `Bán trên Sàn: ${memo}`, now);
    chargeFee(order.user_id, Math.min(fee, amount), 'Phí bán trên Sàn', now);
    recordGain(order.user_id, amount - Math.min(fee, amount) - qty * order.goods_cost, now);
    logTrade(order.user_id, order.commodity, 'sell', qty, price, amount, Math.min(fee, amount), qty * order.goods_cost, bonus, now);
  } else {
    const charge = Math.min(amount + fee, order.locked);
    const spent = Math.min(amount, charge);
    post({ userId: order.user_id, delta: charge, kind: 'escrow_release', memo, now });
    post({ userId: order.user_id, delta: -spent, kind: 'market_buy', memo, now });
    chargeFee(order.user_id, charge - spent, 'Phí mua trên Sàn', now);
    logTrade(order.user_id, order.commodity, 'buy', qty, price, spent, charge - spent, charge, 0, now);
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
    let quality = 1;
    if (side === 'sell') ({ expiresAt: goodsExpiry, cost: goodsCost, quality } = takeGoods(userId, commodity, qty, now));
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
      // NPC ép giá hàng kém tươi / sắp hư theo độ tươi bình quân của phần đem bán.
      const ref = side === 'buy' ? ask : bid * quality;
      let npcQty = Math.min(remaining, npcLeft(userId, day, commodity, side));
      if (limit !== null) npcQty = Math.min(npcQty, npcQtyWithin(commodity, ref, limit, side));
      if (npcQty > 0) {
        fills.push({ qty: npcQty, price: fillPrice(ref, npcQty / LOT, side, depthOf(commodity)), expiresAt: side === 'buy' ? shelfLife(commodity, now) : null });
        q.addFlow.run(userId, day, commodity, side === 'buy' ? npcQty : 0, side === 'sell' ? npcQty : 0);
        price = applyNpcTrade(commodity, npcQty / LOT, side);
        remaining -= npcQty;
      }
    }

    const filled = qty - remaining;
    const amount = fills.reduce((sum, f) => sum + amountFor(f.qty, f.price), 0);
    const fee = tradeFee(amount);
    const memo = filled ? memoFor(commodity, filled, amount / (filled / LOT)) : '';
    let profit = null;
    if (filled && side === 'buy') {
      post({ userId, delta: -amount, kind: 'market_buy', memo, now });
      chargeFee(userId, fee, 'Phí mua trên Sàn', now);
      for (const f of fills) q.addLot.run(userId, commodity, f.qty, now, f.expiresAt, (f.price * (1 + MARKET.fee)) / LOT);
      logTrade(userId, commodity, 'buy', filled, amount / (filled / LOT), amount, fee, amount + fee, 0, now);
    } else if (filled) {
      post({ userId, delta: amount, kind: 'market_sell', memo, now });
      const bonus = tradeBonus(userId, amount, `Bán trên Sàn: ${memo}`, now) + windTradeBonus(userId, amount, `Bán trên Sàn: ${memo}`, now);
      chargeFee(userId, Math.min(fee, amount), 'Phí bán trên Sàn', now);
      recordGain(userId, amount - Math.min(fee, amount) - filled * goodsCost, now);
      profit = logTrade(userId, commodity, 'sell', filled, amount / (filled / LOT), amount, Math.min(fee, amount), filled * goodsCost, bonus, now);
    }

    let orderId = null;
    if (remaining && limit !== null) {
      const lock = side === 'buy' ? amountFor(remaining, limit) + tradeFee(amountFor(remaining, limit)) : 0;
      if (lock) post({ userId, delta: -lock, kind: 'escrow_lock', memo: `Lệnh mua ${memoFor(commodity, remaining, limit)}`, now });
      orderId = Number(q.insertOrder.run(userId, commodity, side, remaining, limit, lock, goodsExpiry, goodsCost, day, now).lastInsertRowid);
    } else if (remaining && side === 'sell') {
      q.addLot.run(userId, commodity, remaining, now, goodsExpiry, goodsCost);
    }
    if (!filled && limit === null) {
      throw new GameError(townQuota(day, commodity, side).left <= 0
        ? `Hôm nay NPC đã ${side === 'buy' ? 'bán' : 'mua'} hết hạn mức chung của cả thị trấn cho ${COMMODITIES[commodity].name.toLowerCase()}. Đặt giá chờ hoặc mua bán với người chơi khác, mai mở lại.`
        : 'Hôm nay bạn đã hết hạn mức giao dịch với NPC cho mặt hàng này.');
    }

    const verb = side === 'buy' ? 'Mua' : 'Bán';
    const parts = [];
    if (filled) parts.push(`${verb} ${lotsText(filled)} lô ${COMMODITIES[commodity].name}, ${side === 'buy' ? 'trả' : 'nhận'} ${amount} 🪙 (phí ${fee})`);
    if (side === 'sell' && quality < 0.999 && filled) parts.push(`Hàng không còn tươi nên NPC chỉ trả ${Math.round(quality * 100)}% giá`);
    if (profit) parts.push(profitText(profit));
    if (orderId) parts.push(`${lotsText(remaining)} lô đang chờ khớp ở giá ${limit.toFixed(1)}`);
    else if (remaining) parts.push(`${lotsText(remaining)} lô chưa khớp, đã trả lại kho`);
    return { message: parts.join('. '), filled, amount, fee, orderId, profit };
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
    const ref = order.side === 'buy' ? ask : bid * freshnessOf(order.commodity, order.goods_expires_at, now).factor;
    let qty = Math.min(order.qty - order.filled, npcLeft(order.user_id, day, order.commodity, order.side));
    qty = Math.min(qty, npcQtyWithin(order.commodity, ref, order.limit_price, order.side));
    if (qty <= 0) continue;
    settleResting(order, qty, fillPrice(ref, qty / LOT, order.side, depthOf(order.commodity)), now);
    q.addFlow.run(order.user_id, day, order.commodity, order.side === 'buy' ? qty : 0, order.side === 'sell' ? qty : 0);
    applyNpcTrade(order.commodity, qty / LOT, order.side);
  }
}

// ---------------------------------------------------------------- nhịp giá

/**
 * Tình hình các ngành gia tộc: { ngành: { clans, plots } } (lô đất có công trình hoàn chỉnh mới tính là đang chạy),
 * và hệ số giá/biến động mỗi mặt hàng chịu từ các ngành đó. Ngành chưa ai nắm không có mặt: hàng chạy bình thường.
 */
export function industryPresence() {
  const presence = {};
  for (const r of q.industryClans.all()) (presence[r.industry] ??= { clans: 0, plots: 0 }).clans = r.n;
  for (const r of q.industryPlots.all()) {
    let design = [];
    try {
      design = JSON.parse(r.design);
    } catch {
      design = [];
    }
    if (designComplete(design)) (presence[r.industry] ??= { clans: 0, plots: 0 }).plots += 1;
  }
  return presence;
}

/**
 * Một nhịp 10 phút. Phần luật game (55%): tin tức, pha thị trường ẩn, độ trôi, bước giá, cú sốt/sập giá.
 * Phần người chơi (45%): áp lực mua bán phai dần. Giá niêm yết ghép hai phần, rồi khớp lệnh chờ.
 */
export function marketTick(now, rand = Math.random) {
  transaction(() => {
    const states = ensureStates(Object.fromEntries(q.states.all().map((s) => [s.commodity, s])), now);
    const prices = Object.fromEntries(Object.entries(states).map(([id, s]) => [id, s.price]));
    const { priceIndex } = economy();
    const influence = industryInfluence(industryPresence());
    for (const id of RAW_FIRST) {
      const st = states[id];
      const ind = influence[id] ?? { mean: 1, vol: 1 };
      const raw = COMMODITIES[id].kind === 'raw';
      if (rand() < (MARKET.newsPerDay * MARKET.tickMs) / DAY) {
        const n = rollNews(id, now, rand);
        q.insertNews.run(n.commodity, n.headline, n.effect, n.created_at, n.starts_at, n.ends_at);
      }
      const news = q.activeNews.all(id, now, now).reduce((m, n) => m * (1 + n.effect), 1);
      const regime = raw ? stepRegime(st.regime, MARKET.tickMs, rand) : 'calm';
      const drift = raw ? stepDrift(st.drift, MARKET.tickMs, gaussian(rand), REGIMES[regime].trend) : 1;
      // Ngành gia tộc đang chạy kéo giá trung bình (cung/cầu/chi phí) và làm biến động dịu đi (giao vận, máy móc...).
      const mean = meanPrice(id, { prices, drift, index: priceIndex, news }) * ind.mean;
      let rule = stepPrice(id, st.rule_price ?? st.price, mean, MARKET.tickMs, gaussian(rand), REGIMES[regime].vol * ind.vol);
      const jump = raw ? rollJump(MARKET.tickMs, rand) : null;
      if (jump) {
        rule = blendPrice(id, rule * (1 + jump.size), 0); // nhảy tức thì, vẫn trong khoảng sàn–trần
        q.insertFlash.run(id, jumpHeadline(id, jump.up), jump.size, now, now, now + 3 * HOUR);
      }
      const pressure = decayPressure(st.pressure ?? 0, MARKET.tickMs);
      prices[id] = blendPrice(id, rule, pressure);
      q.setState.run(prices[id], drift, now, rule, pressure, regime, id);
      q.addHistory.run(id, now, prices[id]);
    }
    matchRestingWithNpc(now);
  });
}

/** Khớp `lots` lô với NPC: dồn áp lực mua bán, giá niêm yết đổi theo phần 45% của người chơi. Trả về giá mới. */
function applyNpcTrade(commodity, lots, side) {
  const s = q.state.get(commodity);
  const pressure = pushPressure(s.pressure ?? 0, lots, side, depthOf(commodity));
  const price = blendPrice(commodity, s.rule_price ?? s.price, pressure);
  q.setTrade.run(price, pressure, commodity);
  return price;
}

/** Ghi một lần khớp vào sổ giao dịch; bán thì tính lãi/lỗ (tiền về sau phí, cộng thưởng trang phục, trừ giá vốn). */
function logTrade(userId, commodity, side, qty, pricePerLot, amount, fee, cost, bonus, now) {
  if (side === 'buy') {
    q.insertTrade.run(userId, commodity, 'buy', qty, pricePerLot, amount, fee, cost, null, now);
    return null;
  }
  const profit = profitOf(amount - fee + (bonus ?? 0), cost);
  q.insertTrade.run(userId, commodity, 'sell', qty, pricePerLot, amount, fee, cost, profit.pnl, now);
  return profit;
}

const signed = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('vi-VN')}`;
const profitText = ({ pnl, pct }) => (pct === null
  ? `Hàng không tốn vốn: lãi ${signed(pnl)} 🪙`
  : `${pnl >= 0 ? 'Lãi' : 'Lỗ'} ${signed(pnl)} 🪙 (${signed(pct * 100)}% so với giá vốn)`);

export function pruneHistory(before) {
  q.pruneHistory.run(before);
  q.pruneTrades.run(before - 16 * DAY); // sổ giao dịch giữ 30 ngày
}

// ---------------------------------------------------------------- đọc

function smartReader(userId) {
  return listPets(userId).some((p) => (skillsOf(p.id).intellect ?? 0) >= 60);
}

export function marketView(userId, now = Date.now()) {
  const spoiled = transaction(() => purge(userId, now));
  const day = dayKey(now);
  const holdings = {};
  for (const lot of q.lots.all(userId)) {
    const h = (holdings[lot.commodity] ??= { qty: 0, lots: [], basis: 0 });
    const fresh = freshnessOf(lot.commodity, lot.expires_at, now);
    h.qty += lot.qty;
    h.basis += lot.qty * lot.cost;
    h.quality = (h.quality ?? 0) + lot.qty * fresh.factor;
    h.lots.push({ qty: lot.qty, expiresAt: lot.expires_at, freshness: fresh.key, freshnessName: fresh.name, factor: fresh.factor });
  }
  for (const h of Object.values(holdings)) h.quality = h.qty ? h.quality / h.qty : 1;
  const statesNow = Object.fromEntries(q.states.all().map((s) => [s.commodity, s]));
  const influence = industryInfluence(industryPresence());
  let bookCost = 0;
  let bookValue = 0;
  for (const [id, h] of Object.entries(holdings)) {
    // Giá vốn bình quân mỗi lô, giá trị nếu bán ngay cho NPC (giá mua vào, trừ phí), lãi/lỗ tạm tính.
    const value = (h.qty / LOT) * quote(statesNow[id].price).bid * h.quality;
    const net = value - tradeFee(Math.round(value));
    h.avgCost = h.qty ? (h.basis / h.qty) * LOT : 0;
    h.pct = profitOf(net, h.basis).pct;
    h.value = Math.round(net);
    h.basis = Math.round(h.basis);
    h.pnl = h.value - h.basis; // khớp đúng với hai số đang hiện
    bookCost += h.basis;
    bookValue += h.value;
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
      industry: influence[s.commodity] ?? null,
      npcLeft: { buy: npcLeft(userId, day, s.commodity, 'buy'), sell: npcLeft(userId, day, s.commodity, 'sell') },
      ownLeft: { buy: ownLeft(userId, day, s.commodity, 'buy'), sell: ownLeft(userId, day, s.commodity, 'sell') },
      town: { buy: townQuota(day, s.commodity, 'buy'), sell: townQuota(day, s.commodity, 'sell') },
    };
  });
  const smart = smartReader(userId);
  const news = q.recentNews.all(now - 2 * DAY)
    .filter((n) => n.commodity && (n.starts_at <= now || (smart && n.created_at <= now)))
    .slice(0, 12)
    .map((n) => ({ id: n.id, commodity: n.commodity, headline: n.headline, up: n.effect > 0, at: n.created_at, early: n.starts_at > now, flash: Boolean(n.flash) }));
  const user = getUser(userId);
  const today = q.realized.get(userId, startOfDay(day));
  const week = q.realized.get(userId, now - 7 * DAY);
  return {
    commodities,
    holdings,
    book: {
      cost: bookCost,
      value: bookValue,
      ...profitOf(bookValue, bookCost),
      today: { pnl: Math.round(today.pnl), sells: today.n, wins: today.wins },
      week: { pnl: Math.round(week.pnl), sells: week.n, wins: week.wins },
      trades: q.recentTrades.all(userId).map((t) => ({
        id: t.id, commodity: t.commodity, side: t.side, qty: t.qty, price: t.price, amount: t.amount, fee: t.fee,
        cost: Math.round(t.cost), pnl: t.pnl === null ? null : Math.round(t.pnl), pct: t.side === 'sell' && t.cost > 0 ? t.pnl / t.cost : null, at: t.at,
      })),
    },
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

/** Giá trị hàng trong kho và trong lệnh bán đang chờ, tính theo giá NPC mua vào (đã trừ phần ép giá hàng kém tươi). */
export function goodsValue(userId, now = Date.now()) {
  const prices = currentPrices();
  let value = 0;
  for (const lot of q.lots.all(userId)) {
    value += (lot.qty / LOT) * quote(prices[lot.commodity]).bid * freshnessOf(lot.commodity, lot.expires_at, now).factor;
  }
  for (const o of q.myOrders.all(userId)) {
    if (o.side === 'sell') value += ((o.qty - o.filled) / LOT) * quote(prices[o.commodity]).bid * freshnessOf(o.commodity, o.goods_expires_at, now).factor;
  }
  return Math.round(value);
}

export const lockedInOrders = (userId) => q.myOrders.all(userId).reduce((sum, o) => sum + o.locked, 0);
