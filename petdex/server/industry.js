// Chuỗi sản xuất của gia tộc: kho hàng, sản xuất mỗi đêm (khai thác mỏ trên lô → điện → nhà máy theo công thức),
// bán hàng thừa cho NPC theo giá vĩ mô, sàn công nghiệp chung giữa các gia tộc, nhập khẩu nguyên liệu từ NPC.
// Luật và số liệu ở public/ta-tua/game/js/shared/industry.js.
import { db, transaction } from './db.js';
import { dayKey } from './clock.js';
import { DAY, GameError } from './game.js';
import { post } from './ledger.js';
import {
  GOODS, GOOD_INDUSTRY, GOOD_ORDER, MARKET_RULES, PRODUCTION_INDUSTRIES, RUN_ORDER, depositsOf, extractable, plantsFor, recipeOf,
} from '../../public/ta-tua/game/js/shared/industry.js';
import { PHASES, PLOTS, clanLevelOf, clanPerks, designBonus, designComplete, envFactor, weatherFactor } from '../../public/ta-tua/game/js/shared/clan.js';

const q = {
  goods: db.prepare('SELECT * FROM clan_goods WHERE clan_id = ?'),
  good: db.prepare('SELECT * FROM clan_goods WHERE clan_id = ? AND good = ?'),
  addGood: db.prepare(`
    INSERT INTO clan_goods (clan_id, good, qty) VALUES (?, ?, ?)
    ON CONFLICT (clan_id, good) DO UPDATE SET qty = qty + excluded.qty`),
  takeGood: db.prepare('UPDATE clan_goods SET qty = qty - ? WHERE clan_id = ? AND good = ? AND qty >= ?'),
  setKeep: db.prepare(`
    INSERT INTO clan_goods (clan_id, good, qty, keep) VALUES (?, ?, 0, ?)
    ON CONFLICT (clan_id, good) DO UPDATE SET keep = excluded.keep`),
  listings: db.prepare(`
    SELECT l.*, c.name AS clan_name, c.emblem, c.color FROM goods_listings l JOIN clans c ON c.id = l.clan_id
    WHERE l.closed_at IS NULL AND l.expires_at > ? ORDER BY l.good, l.price LIMIT 200`),
  listing: db.prepare('SELECT * FROM goods_listings WHERE id = ?'),
  myListings: db.prepare('SELECT COUNT(*) AS n FROM goods_listings WHERE clan_id = ? AND closed_at IS NULL'),
  insertListing: db.prepare('INSERT INTO goods_listings (clan_id, good, qty, price, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'),
  setListingQty: db.prepare('UPDATE goods_listings SET qty = ? WHERE id = ?'),
  closeListing: db.prepare('UPDATE goods_listings SET closed_at = ? WHERE id = ?'),
  expired: db.prepare('SELECT * FROM goods_listings WHERE closed_at IS NULL AND expires_at <= ?'),
  insertTrade: db.prepare('INSERT INTO clan_trades (seller_id, buyer_id, good, qty, price, income, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  tradeIncome: db.prepare('SELECT COALESCE(SUM(income), 0) AS total FROM clan_trades WHERE seller_id = ? AND day = ?'),
  recentTrades: db.prepare(`
    SELECT t.*, s.name AS seller_name, b.name AS buyer_name FROM clan_trades t JOIN clans s ON s.id = t.seller_id
    LEFT JOIN clans b ON b.id = t.buyer_id WHERE t.seller_id = ? OR t.buyer_id = ? ORDER BY t.id DESC LIMIT 20`),
  addProduction: db.prepare(`
    INSERT INTO clan_production (clan_id, day, good, produced, used, sold, revenue) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (clan_id, day, good) DO UPDATE SET produced = produced + excluded.produced, used = used + excluded.used,
      sold = sold + excluded.sold, revenue = revenue + excluded.revenue`),
  production: db.prepare('SELECT * FROM clan_production WHERE clan_id = ? AND day = ? ORDER BY good'),
  lastDay: db.prepare('SELECT MAX(day) AS day FROM clan_production WHERE clan_id = ?'),
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  setVariant: db.prepare('UPDATE land_plots SET variant = ? WHERE id = ?'),
};

const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));
const DEPOSITS = new Map(PLOTS.map((p) => [p.id, depositsOf(p)]));
export const plotDeposits = (plotId) => DEPOSITS.get(Number(plotId)) ?? {};
const clanAccount = (id) => `clan:${id}`;
const balance = (id) => q.account.get(clanAccount(id))?.balance ?? 0;
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const stochastic = (x, rand) => Math.floor(x) + (rand() < x - Math.floor(x) ? 1 : 0);

// ---------------------------------------------------------------- giá & kho

/** Giá tham chiếu hôm nay: giá gốc × cầu của ngành làm ra hàng đó × hệ số chu kỳ kinh tế. */
export function refPrice(good, macro) {
  const demand = macro?.demand?.[GOOD_INDUSTRY[good]] ?? 1;
  return Math.max(1, Math.round(GOODS[good].base * demand * (PHASES[macro?.phase]?.factor ?? 1)));
}
export const npcBuyPrice = (good, macro) => Math.max(1, Math.round(refPrice(good, macro) * MARKET_RULES.npcBuy));
export const importPrice = (good, macro) => Math.round(refPrice(good, macro) * MARKET_RULES.importMarkup);

export const warehouseCap = (level) => MARKET_RULES.warehouseBase + MARKET_RULES.warehousePerLevel * level;

function stock(clanId) {
  return Object.fromEntries(q.goods.all(clanId).map((r) => [r.good, r.qty]));
}
const used = (clanId) => q.goods.all(clanId).reduce((s, r) => s + (r.good === 'power' ? 0 : r.qty), 0);

function addGoods(clanId, good, qty) {
  if (qty > 0) q.addGood.run(clanId, good, qty);
}
function takeGoods(clanId, good, qty) {
  if (qty <= 0) return;
  if (q.takeGood.run(qty, clanId, good, qty).changes === 0) throw new GameError(`Kho không đủ ${GOODS[good].name}.`);
}

/** Hàng gia tộc dùng làm nguyên liệu cho các lô của mình (mặc định giữ lại, không tự bán). */
function inputsNeeded(plots) {
  const need = new Set();
  for (const row of plots) {
    const recipe = recipeOf(row.industry, row.variant);
    for (const g of Object.keys(recipe?.in ?? {})) need.add(g);
  }
  return need;
}

// ---------------------------------------------------------------- sản xuất mỗi đêm

/** Hệ số sản xuất của một lô (tốc độ lô, đất hợp ngành, thời tiết, chu kỳ, cấp gia tộc, công trình). */
export function plotFactor(plot, row, { level, macro }) {
  const design = typeof row.design === 'string' ? JSON.parse(row.design) : row.design ?? [];
  return (1 + plot.prod) * envFactor(row.industry, plot.zone, plot.climate) * weatherFactor(macro.weather, plot.zone, plot.climate)
    * (PHASES[macro.phase]?.factor ?? 1) * (1 + clanPerks(level).prodBonus) * (1 + designBonus(design));
}

/** Sản lượng dự kiến một đêm của một lô (để xem trước): đầu ra tối đa và nguyên liệu cần. */
export function productionPreview(plot, { industry, variant, design = [], level = 1, macro }) {
  const ind = PRODUCTION_INDUSTRIES[industry];
  if (!ind) return null;
  const factor = plotFactor(plot, { industry, design }, { level, macro });
  const deposits = DEPOSITS.get(plot.id);
  if (ind.extracts) {
    const out = Object.fromEntries(Object.entries(extractable(industry, deposits)).map(([g, n]) => [g, Math.round(n * factor * 10) / 10]));
    const value = Object.entries(out).reduce((s, [g, n]) => s + n * npcBuyPrice(g, macro), 0);
    return { kind: 'extract', factor, deposits, out, in: {}, batches: 0, value: Math.round(value), cost: 0 };
  }
  const recipe = recipeOf(industry, variant);
  if (!recipe) return { kind: 'power', factor, deposits, out: {}, in: {}, batches: 0, value: 0, cost: 0, plants: plantsFor(plot) };
  const batches = Math.round((ind.batches ?? 4) * factor * 10) / 10;
  const out = Object.fromEntries(Object.entries(recipe.out).map(([g, n]) => [g, n * batches]));
  const input = Object.fromEntries(Object.entries(recipe.in).map(([g, n]) => [g, n * batches]));
  const value = Object.entries(out).reduce((s, [g, n]) => s + n * npcBuyPrice(g, macro), 0);
  const cost = Object.entries(input).reduce((s, [g, n]) => s + n * refPrice(g, macro), 0);
  return { kind: industry === 'power' ? 'power' : 'factory', factor, deposits, out, in: input, batches, value: Math.round(value), cost: Math.round(cost), plants: industry === 'power' ? plantsFor(plot) : undefined };
}

/**
 * Chạy sản xuất một đêm cho gia tộc: khai thác, điện, nhà máy theo thứ tự thượng nguồn → hạ nguồn, rồi bán cho NPC
 * điện thừa và hàng không giữ (hoặc tràn kho). Ghi tiền bán vào quỹ, trả về doanh thu để tính thuế.
 * Lô chỉ chạy khi công trình đã hoàn chỉnh.
 */
export function runProduction(clan, plots, { day, macro, at, rand = Math.random, buffs = {} }) {
  const irr = buffs.irrigation ?? 0;
  const wind = buffs.wind ?? 0;
  const extra = { irrigation: 0, wind: 0 };
  const level = clanLevelOf(clan.xp);
  const rows = plots.filter((r) => PRODUCTION_INDUSTRIES[r.industry] && designComplete(JSON.parse(r.design)));
  if (!rows.length && !q.goods.all(clan.id).length) return { revenue: 0, extra };
  const log = new Map();
  const note = (good, field, n) => {
    if (!n) return;
    const e = log.get(good) ?? { produced: 0, used: 0, sold: 0, revenue: 0 };
    e[field] += n;
    log.set(good, e);
  };
  const goods = stock(clan.id);
  const have = (g) => goods[g] ?? 0;
  const give = (g, n) => {
    goods[g] = have(g) + n;
    note(g, 'produced', n);
  };
  const take = (g, n) => {
    goods[g] = have(g) - n;
    note(g, 'used', n);
  };

  for (const industry of RUN_ORDER) {
    for (const row of rows.filter((r) => r.industry === industry)) {
      const plot = PLOT_BY_ID.get(row.id);
      const factor = plotFactor(plot, row, { level, macro });
      const ind = PRODUCTION_INDUSTRIES[industry];
      if (ind.extracts) {
        // Trị thủy chỉ tăng trồng trọt, chăn nuôi, lâm nghiệp.
        const boost = ['agriculture', 'livestock', 'forestry'].includes(industry) ? irr : 0;
        for (const [g, n] of Object.entries(extractable(industry, DEPOSITS.get(plot.id)))) {
          const made = stochastic(n * factor * (1 + boost), rand);
          give(g, made);
          extra.irrigation += (made * boost / (1 + boost)) * npcBuyPrice(g, macro);
        }
        continue;
      }
      const recipe = recipeOf(industry, row.variant);
      if (!recipe) continue;
      // Năng lượng gió tăng số mẻ của nhà máy và nhà máy điện.
      const cap = stochastic((ind.batches ?? 4) * factor * (1 + wind), rand);
      const can = Math.min(cap, ...Object.entries(recipe.in).map(([g, n]) => Math.floor(have(g) / n)));
      if (can <= 0) continue;
      for (const [g, n] of Object.entries(recipe.in)) take(g, n * can);
      for (const [g, n] of Object.entries(recipe.out)) {
        give(g, n * can);
        extra.wind += (n * can * wind / (1 + wind)) * npcBuyPrice(g, macro);
      }
    }
  }

  // Bán: điện thừa (không trữ được), hàng gia tộc chọn không giữ, và phần tràn kho.
  const keepRows = new Map(q.goods.all(clan.id).map((r) => [r.good, r.keep]));
  const needed = inputsNeeded(plots);
  const sell = {};
  for (const g of Object.keys(goods)) {
    if (goods[g] <= 0) continue;
    const keep = keepRows.get(g);
    if (g === 'power' || keep === 0 || (keep == null && !needed.has(g))) sell[g] = goods[g];
  }
  let space = warehouseCap(level) - Object.entries(goods).reduce((s, [g, n]) => s + (g === 'power' || sell[g] ? 0 : Math.max(0, n)), 0);
  for (const g of GOOD_ORDER.slice().reverse()) {
    if (space >= 0) break;
    const left = (goods[g] ?? 0) - (sell[g] ?? 0);
    if (left <= 0 || g === 'power') continue;
    const n = Math.min(left, -space);
    sell[g] = (sell[g] ?? 0) + n;
    space += n;
  }
  let revenue = 0;
  for (const [g, n] of Object.entries(sell)) {
    const income = n * npcBuyPrice(g, macro);
    goods[g] -= n;
    note(g, 'sold', n);
    log.get(g).revenue += income;
    revenue += income;
  }

  // Ghi kho (theo chênh lệch so với lúc đầu) và nhật ký.
  const before = stock(clan.id);
  for (const g of new Set([...Object.keys(before), ...Object.keys(goods)])) {
    const diff = (goods[g] ?? 0) - (before[g] ?? 0);
    if (diff > 0) addGoods(clan.id, g, diff);
    else if (diff < 0) takeGoods(clan.id, g, -diff);
  }
  for (const [g, e] of log) q.addProduction.run(clan.id, day, g, e.produced, e.used, e.sold, e.revenue);
  if (revenue > 0) post({ account: clanAccount(clan.id), delta: revenue, kind: 'clan_revenue', memo: `Bán hàng cho NPC ${day}`, now: at });
  return { revenue, extra: { irrigation: Math.round(extra.irrigation), wind: Math.round(extra.wind) } };
}

/** Tiền bán hàng trên sàn chung (và bán NPC tức thì) trong ngày, đã vào quỹ, cần tính thuế. */
export const tradeIncome = (clanId, day) => q.tradeIncome.get(clanId, day).total;

/** Trả hàng của các tin đăng đã hết hạn về kho người bán. */
export function expireListings(now) {
  for (const l of q.expired.all(now)) {
    q.closeListing.run(now, l.id);
    addGoods(l.clan_id, l.good, l.qty);
  }
}

// ---------------------------------------------------------------- thao tác của người chơi

function memberRole(userId) {
  const m = db.prepare('SELECT * FROM clan_members WHERE user_id = ?').get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  return { clan, role: m.role };
}
function mustManage(userId) {
  const ctx = memberRole(userId);
  if (ctx.role !== 'leader' && ctx.role !== 'elder') throw new GameError('Chỉ tộc trưởng hoặc trưởng lão mới được giao dịch hàng của gia tộc.');
  return ctx.clan;
}
const mustGood = (good, { power = false } = {}) => {
  if (!GOODS[good] || (!power && good === 'power')) throw new GameError('Không có mặt hàng này.');
  return GOODS[good];
};
const intQty = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 100_000) throw new GameError('Số lượng không hợp lệ.');
  return n;
};

export function industryView(userId, macro, now = Date.now()) {
  const m = db.prepare('SELECT * FROM clan_members WHERE user_id = ?').get(userId);
  const clan = m && q.clan.get(m.clan_id);
  const prices = Object.fromEntries(GOOD_ORDER.map((g) => [g, { ref: refPrice(g, macro), npc: npcBuyPrice(g, macro), import: importPrice(g, macro) }]));
  const listings = q.listings.all(now).map((l) => ({
    id: l.id, good: l.good, qty: l.qty, price: l.price, clan: { id: l.clan_id, name: l.clan_name, emblem: l.emblem, color: l.color },
    mine: Boolean(clan && l.clan_id === clan.id), expiresAt: l.expires_at,
  }));
  if (!clan || clan.dissolved_at) return { clan: null, prices, listings, rules: MARKET_RULES };
  const level = clanLevelOf(clan.xp);
  const plots = db.prepare('SELECT * FROM land_plots WHERE clan_id = ?').all(clan.id);
  const needed = inputsNeeded(plots);
  const last = q.lastDay.get(clan.id).day;
  return {
    clan: { id: clan.id, role: m.role, treasury: balance(clan.id) },
    // Nguyên liệu của gia tộc luôn hiện (kể cả khi hết hàng) để vẫn chỉnh được "Giữ trong kho".
    goods: (() => {
      const rows = new Map(q.goods.all(clan.id).map((r) => [r.good, r]));
      for (const g of needed) if (!rows.has(g)) rows.set(g, { good: g, qty: 0, keep: null });
      return [...rows.values()].filter((r) => r.qty > 0 || r.keep != null || needed.has(r.good)).map((r) => ({
        good: r.good, qty: r.qty, keep: r.keep == null ? needed.has(r.good) : Boolean(r.keep), input: needed.has(r.good),
      }));
    })(),
    capacity: warehouseCap(level),
    used: used(clan.id),
    production: last ? { day: last, rows: q.production.all(clan.id, last) } : null,
    trades: q.recentTrades.all(clan.id, clan.id).map((t) => ({
      id: t.id, good: t.good, qty: t.qty, price: t.price, income: t.income, day: t.day, at: t.created_at,
      side: t.seller_id === clan.id ? 'sell' : 'buy', other: t.seller_id === clan.id ? t.buyer_name ?? 'NPC' : t.seller_name,
    })),
    prices,
    listings,
    rules: MARKET_RULES,
  };
}

export function setKeep(userId, good, keep) {
  const clan = mustManage(userId);
  mustGood(good);
  q.setKeep.run(clan.id, good, keep ? 1 : 0);
  return { message: keep ? `Giữ ${GOODS[good].name} trong kho.` : `${GOODS[good].name} sẽ tự bán cho NPC mỗi đêm.` };
}

export function listGoods(userId, { good, qty, price }, macro, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    mustGood(good);
    const n = intQty(qty);
    const ref = refPrice(good, macro);
    const p = Number(price);
    if (!Number.isInteger(p) || p < Math.ceil(ref * MARKET_RULES.band[0]) || p > Math.floor(ref * MARKET_RULES.band[1])) {
      throw new GameError(`Giá phải từ ${fmt(Math.ceil(ref * MARKET_RULES.band[0]))} đến ${fmt(Math.floor(ref * MARKET_RULES.band[1]))} xu mỗi đơn vị.`);
    }
    if (q.myListings.get(clan.id).n >= MARKET_RULES.maxListings) throw new GameError(`Mỗi gia tộc đăng tối đa ${MARKET_RULES.maxListings} tin.`);
    takeGoods(clan.id, good, n);
    q.insertListing.run(clan.id, good, n, p, now, now + MARKET_RULES.listingDays * DAY);
    return { message: `Đã đăng bán ${fmt(n)} ${GOODS[good].name} giá ${fmt(p)} xu/đơn vị.` };
  });
}

export function cancelListing(userId, id, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    const l = q.listing.get(Number(id));
    if (!l || l.clan_id !== clan.id || l.closed_at) throw new GameError('Không tìm thấy tin đăng của gia tộc.');
    q.closeListing.run(now, l.id);
    addGoods(clan.id, l.good, l.qty);
    return { message: 'Đã gỡ tin, hàng về lại kho.' };
  });
}

export function buyListing(userId, id, qty, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    const l = q.listing.get(Number(id));
    if (!l || l.closed_at || l.expires_at <= now) throw new GameError('Tin này đã hết.');
    if (l.clan_id === clan.id) throw new GameError('Không mua hàng của chính gia tộc mình.');
    const n = Math.min(intQty(qty), l.qty);
    const level = clanLevelOf(clan.xp);
    if (used(clan.id) + n > warehouseCap(level)) throw new GameError('Kho gia tộc không đủ chỗ.');
    const total = n * l.price;
    if (balance(clan.id) < total) throw new GameError(`Quỹ gia tộc không đủ ${fmt(total)} xu.`);
    const fee = Math.ceil(total * MARKET_RULES.fee);
    post({ account: clanAccount(clan.id), delta: -total, kind: 'goods_trade', memo: `Mua ${n} ${GOODS[l.good].name}`, now });
    post({ account: clanAccount(l.clan_id), delta: total - fee, kind: 'goods_trade', memo: `Bán ${n} ${GOODS[l.good].name}`, now });
    if (fee > 0) post({ account: 'treasury', delta: Math.floor(fee / 2), kind: 'goods_trade', memo: 'Phí sàn công nghiệp', now });
    addGoods(clan.id, l.good, n);
    if (n === l.qty) q.closeListing.run(now, l.id);
    else q.setListingQty.run(l.qty - n, l.id);
    q.insertTrade.run(l.clan_id, clan.id, l.good, n, l.price, total - fee, dayKey(now), now);
    return { message: `Đã mua ${fmt(n)} ${GOODS[l.good].name} với giá ${fmt(total)} xu.` };
  });
}

export function importGoods(userId, good, qty, macro, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    mustGood(good);
    const n = intQty(qty);
    if (used(clan.id) + n > warehouseCap(clanLevelOf(clan.xp))) throw new GameError('Kho gia tộc không đủ chỗ.');
    const total = n * importPrice(good, macro);
    if (balance(clan.id) < total) throw new GameError(`Quỹ gia tộc không đủ ${fmt(total)} xu.`);
    post({ account: clanAccount(clan.id), delta: -total, kind: 'goods_import', memo: `Nhập ${n} ${GOODS[good].name}`, now });
    addGoods(clan.id, good, n);
    return { message: `Đã nhập khẩu ${fmt(n)} ${GOODS[good].name} giá ${fmt(total)} xu.` };
  });
}

export function sellToNpc(userId, good, qty, macro, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    mustGood(good);
    const n = intQty(qty);
    takeGoods(clan.id, good, n);
    const income = n * npcBuyPrice(good, macro);
    post({ account: clanAccount(clan.id), delta: income, kind: 'goods_trade', memo: `Bán ${n} ${GOODS[good].name} cho NPC`, now });
    q.insertTrade.run(clan.id, null, good, n, npcBuyPrice(good, macro), income, dayKey(now), now);
    return { message: `Đã bán ${fmt(n)} ${GOODS[good].name}, nhận ${fmt(income)} xu.` };
  });
}

export function setPlotVariant(plotId, plant) {
  const plot = PLOT_BY_ID.get(Number(plotId));
  if (!plot) throw new GameError('Không có lô đất này.');
  if (!plantsFor(plot).includes(plant)) throw new GameError('Lô này không dựng được loại nhà máy điện đó.');
  q.setVariant.run(plant, plot.id);
  return { message: `Lô ${plot.code}: ${PRODUCTION_INDUSTRIES.power.plants[plant].name}.` };
}

