// Cổ phần gia tộc: IPO, sàn giá theo cung cầu (quỹ khớp lệnh tích số không đổi, biên ±15%/ngày), cổ tức, mua lại,
// thâu tóm (gia tộc nắm trên 50% được bổ nhiệm tộc trưởng hoặc sáp nhập đất và ngành), vay ký quỹ của ngân hàng gia tộc.
// - Người chơi giữ tối đa 10% cổ phần một gia tộc; nắm trên 25% thì lên báo; Sở Công Thương chặn thâu tóm làm gia tộc
//   vượt 40% số lô của một ngành.
// - Phí giao dịch 1% và phí bảo lãnh 2% về gia tộc nắm Ngân hàng nhà nước (vào ngân hàng của nó nếu đang mở).
// Luật ở public/ta-tua/game/js/shared/clan-shares.js (wiki đọc thẳng từ đó).
import { adminLog, db, getUser, transaction } from './db.js';
import { dayKey } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { chargeFinanceTax, post } from './ledger.js';
import { isDeposed } from './clan-gov.js';
import { plotCollateral, plotRoom, transferPlot } from './clans.js';
import { plotPledged, sheetOf } from './clan-bank.js';
import { bondsInDefault } from './clan-bonds.js';
import { isStrategic } from '../../public/ta-tua/game/js/shared/clan.js';
import {
  PLAYER_CAP, SHARES, SHARE_IPO_MAX, SHARE_POOL, allotByDonation, buyCost, poolPrice, sellProceeds, tradeFee, withinBand,
} from '../../public/ta-tua/game/js/shared/clan-shares.js';

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const clanAccount = (id) => `clan:${id}`;
const bankAccount = (id) => `bank:${id}`;
const poolAccount = (id) => `shares_pool:${id}`;
const CONTROL = Math.floor(SHARES.total * SHARES.control);
const DISCLOSE = Math.floor(SHARES.total * SHARES.disclose);

const q = {
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  members: db.prepare('SELECT user_id AS id, donated FROM clan_members WHERE clan_id = ? ORDER BY joined_at'),
  stateBank: db.prepare(`
    SELECT c.id, b.status AS bank_status, b.frozen, b.loan_rate FROM clan_industries i JOIN clans c ON c.id = i.clan_id AND c.dissolved_at IS NULL
    LEFT JOIN cbank_banks b ON b.clan_id = c.id WHERE i.industry = 'state_bank' ORDER BY i.entered_at LIMIT 1`),

  listing: db.prepare('SELECT * FROM clan_listings WHERE clan_id = ?'),
  listings: db.prepare("SELECT l.*, c.name, c.emblem, c.color FROM clan_listings l JOIN clans c ON c.id = l.clan_id WHERE l.status != 'delisted' ORDER BY l.listed_at, l.opens_at"),
  dueIpos: db.prepare("SELECT * FROM clan_listings WHERE status = 'subscribing' AND closes_at <= ?"),
  insertListing: db.prepare(`
    INSERT INTO clan_listings (clan_id, status, ipo_shares, ipo_price, pool_shares, ref_price, ref_day, opens_at, closes_at)
    VALUES (?, 'subscribing', ?, ?, ?, ?, ?, ?, ?)`),
  addSold: db.prepare('UPDATE clan_listings SET ipo_sold = ipo_sold + ? WHERE clan_id = ? AND ipo_sold + ? <= ipo_shares'),
  setListed: db.prepare("UPDATE clan_listings SET status = 'listed', listed_at = ?, ref_price = ?, ref_day = ? WHERE clan_id = ?"),
  setPool: db.prepare('UPDATE clan_listings SET pool_shares = ? WHERE clan_id = ?'),
  setRef: db.prepare('UPDATE clan_listings SET ref_price = ?, ref_day = ? WHERE clan_id = ?'),
  setController: db.prepare('UPDATE clan_listings SET controller = ? WHERE clan_id = ?'),
  delist: db.prepare("UPDATE clan_listings SET status = 'delisted', pool_shares = 0, controller = NULL WHERE clan_id = ?"),

  holding: db.prepare('SELECT * FROM clan_shareholdings WHERE clan_id = ? AND holder_kind = ? AND holder_id = ?'),
  addHolding: db.prepare(`
    INSERT INTO clan_shareholdings (clan_id, holder_kind, holder_id, qty, pledged) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (clan_id, holder_kind, holder_id) DO UPDATE SET qty = qty + excluded.qty, pledged = pledged + excluded.pledged`),
  takeHolding: db.prepare('UPDATE clan_shareholdings SET qty = qty - ?, pledged = pledged - ? WHERE clan_id = ? AND holder_kind = ? AND holder_id = ? AND qty - ? >= pledged - ? AND qty >= ?'),
  setDisclosed: db.prepare('UPDATE clan_shareholdings SET disclosed = ? WHERE clan_id = ? AND holder_kind = ? AND holder_id = ?'),
  holders: db.prepare('SELECT * FROM clan_shareholdings WHERE clan_id = ? AND qty > 0 ORDER BY qty DESC'),
  external: db.prepare("SELECT * FROM clan_shareholdings WHERE clan_id = ? AND qty > 0 AND holder_kind IN ('user', 'clan', 'bank')"),
  heldBy: db.prepare('SELECT h.*, c.name, c.emblem FROM clan_shareholdings h JOIN clans c ON c.id = h.clan_id WHERE h.holder_kind = ? AND h.holder_id = ? AND h.qty > 0'),
  heldInDissolved: db.prepare("SELECT * FROM clan_shareholdings WHERE holder_kind IN ('clan', 'bank') AND holder_id = ? AND qty > 0"),
  dropHolding: db.prepare('DELETE FROM clan_shareholdings WHERE clan_id = ? AND holder_kind = ? AND holder_id = ?'),

  insertTrade: db.prepare('INSERT INTO clan_share_trades (clan_id, holder_kind, holder_id, side, qty, value, fee, price, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  trades: db.prepare('SELECT * FROM clan_share_trades WHERE clan_id = ? ORDER BY id DESC LIMIT ?'),
  dayVolume: db.prepare("SELECT COALESCE(SUM(qty), 0) AS qty FROM clan_share_trades WHERE clan_id = ? AND side IN ('buy', 'sell', 'liquidate') AND at >= ?"),

  insertMargin: db.prepare('INSERT INTO clan_margin_loans (user_id, clan_id, bank_id, owed, shares, rate, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  margin: db.prepare('SELECT * FROM clan_margin_loans WHERE id = ?'),
  myMargins: db.prepare("SELECT m.*, c.name FROM clan_margin_loans m JOIN clans c ON c.id = m.clan_id WHERE m.user_id = ? AND (m.status = 'open' OR m.closed_at >= ?) ORDER BY m.id DESC"),
  openMargins: db.prepare("SELECT * FROM clan_margin_loans WHERE status = 'open' ORDER BY id"),
  openMarginsOf: db.prepare("SELECT * FROM clan_margin_loans WHERE status = 'open' AND clan_id = ?"),
  marginDebt: db.prepare("SELECT COALESCE(SUM(owed), 0) AS owed FROM clan_margin_loans WHERE status = 'open' AND user_id = ?"),
  saveMargin: db.prepare('UPDATE clan_margin_loans SET owed = ?, status = ?, closed_at = ? WHERE id = ?'),

  profit: db.prepare('SELECT COALESCE(SUM(revenue - tax - upkeep), 0) AS p FROM clan_days WHERE clan_id = ? AND day >= ?'),
  dividendsSince: db.prepare("SELECT COALESCE(-SUM(delta), 0) AS paid FROM ledger WHERE account = ? AND kind = 'share_dividend' AND created_at >= ?"),
  clanPlots: db.prepare('SELECT * FROM land_plots WHERE clan_id = ? ORDER BY id'),
  industryPlots: db.prepare('SELECT clan_id, COUNT(*) AS n FROM land_plots WHERE industry = ? GROUP BY clan_id'),
  clanIndustries: db.prepare('SELECT industry FROM clan_industries WHERE clan_id = ?'),
  addIndustry: db.prepare('INSERT OR IGNORE INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, ?, 0, ?)'),
  setLeader: db.prepare('UPDATE clans SET leader_id = ? WHERE id = ?'),
  setRole: db.prepare('UPDATE clan_members SET role = ? WHERE user_id = ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const balanceOf = (account) => q.account.get(account)?.balance ?? 0;
const news = (headline, now) => q.insertNews.run(headline, now, now, now + DAY);
const nameOf = (id) => q.clan.get(id)?.name ?? `#${id}`;

/** Tài khoản nhận phí môi giới: ngân hàng của gia tộc nắm Ngân hàng nhà nước (đang mở), không thì quỹ gia tộc đó, không thì ngân sách. */
function brokerAccount() {
  const sb = q.stateBank.get();
  if (!sb) return 'treasury';
  return sb.bank_status === 'open' ? bankAccount(sb.id) : clanAccount(sb.id);
}

function payFee(fromAccount, userId, fee, memo, now) {
  if (fee <= 0) return;
  if (userId) post({ userId, delta: -fee, kind: 'share_fee', memo, now });
  else post({ account: fromAccount, delta: -fee, kind: 'share_fee', memo, now });
  post({ account: brokerAccount(), delta: fee, kind: 'share_fee', memo: `Môi giới: ${memo}`, now });
}

function clanOf(userId) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  return { clan, member: m };
}
function mustLeader(userId, what) {
  const ctx = clanOf(userId);
  if (ctx.member.role !== 'leader' || isDeposed(ctx.clan.id, userId)) throw new GameError(`Chỉ tộc trưởng mới được ${what}.`);
  return ctx;
}

/** Giá trị sổ sách mỗi cổ phần: (quỹ gia tộc + giá trị thế chấp các lô) / tổng số cổ phần. */
export function bookValue(clanId, now = Date.now()) {
  const plots = q.clanPlots.all(clanId).reduce((s, r) => s + (plotCollateral(r.id, now)?.value ?? 0), 0);
  return (Math.max(0, balanceOf(clanAccount(clanId))) + plots) / SHARES.total;
}

/** Giá hiện tại (đang IPO thì là giá IPO). */
export function priceOf(listing) {
  if (!listing) return 0;
  if (listing.status === 'subscribing') return listing.ipo_price;
  return poolPrice(balanceOf(poolAccount(listing.clan_id)), listing.pool_shares);
}

/** Giá đầu ngày dùng cho biên ±15%: sang ngày mới thì chốt lại theo giá hiện tại. */
function refPrice(listing, now) {
  const day = dayKey(now);
  if (listing.ref_day === day && listing.ref_price) return listing.ref_price;
  const p = priceOf(listing);
  q.setRef.run(p, day, listing.clan_id);
  return p;
}

const heldQty = (clanId, kind, id) => q.holding.get(clanId, kind, id)?.qty ?? 0;

/** Ai đang nắm quyền kiểm soát (gia tộc giữ trên 50%), và lên báo khi có người vượt 25% hay đổi người kiểm soát. */
function afterHoldingChange(clanId, kind, id, now) {
  const h = q.holding.get(clanId, kind, id);
  if (h && h.qty > DISCLOSE && !h.disclosed && kind !== 'self') {
    q.setDisclosed.run(1, clanId, kind, id);
    const who = kind === 'user' ? getUser(id)?.username ?? 'Một người chơi' : kind === 'bank' ? `Ngân hàng ${nameOf(id)}` : `Gia tộc ${nameOf(id)}`;
    news(`📢 Công bố sở hữu: ${who} nắm ${fmt(h.qty)} cổ phần (${Math.round((h.qty / SHARES.total) * 100)}%) của gia tộc ${nameOf(clanId)}`, now);
  } else if (h && h.qty <= DISCLOSE && h.disclosed) q.setDisclosed.run(0, clanId, kind, id);
  const listing = q.listing.get(clanId);
  if (!listing) return;
  const top = q.holders.all(clanId).find((x) => x.holder_kind === 'clan' && x.qty > CONTROL);
  const controller = top?.holder_id ?? null;
  if (controller !== listing.controller) {
    q.setController.run(controller, clanId);
    if (controller) news(`🏴 Gia tộc ${nameOf(controller)} nắm quyền kiểm soát gia tộc ${nameOf(clanId)} (${fmt(top.qty)} cổ phần)`, now);
  }
}

/** Gia tộc kiểm soát được bao nhiêu % số lô của từng ngành nếu nhận thêm đất của `targetId`. Trả về các ngành vượt trần. */
export function antitrustBreaches(acquirerId, targetId) {
  const out = [];
  const industries = new Set(q.clanPlots.all(targetId).map((r) => r.industry).filter(Boolean));
  for (const ind of industries) {
    const rows = q.industryPlots.all(ind);
    const total = rows.reduce((s, r) => s + r.n, 0);
    const mine = rows.filter((r) => r.clan_id === acquirerId || r.clan_id === targetId).reduce((s, r) => s + r.n, 0);
    if (total && mine / total > SHARES.antitrustShare) out.push({ industry: ind, share: mine / total });
  }
  return out;
}

// ---------------------------------------------------------------- IPO

/** Tộc trưởng đưa gia tộc lên sàn: bán `shares` cổ phần giá `price` trong 24 giờ. */
export function startIpo(userId, { shares, price }, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'đưa gia tộc lên sàn');
    const old = q.listing.get(clan.id);
    if (old && old.status !== 'delisted') throw new GameError('Gia tộc đã lên sàn rồi.');
    if (old) throw new GameError('Gia tộc đã rời sàn, không lên sàn lại được.');
    const min = Math.ceil(SHARES.total * SHARES.ipoMin);
    if (!Number.isInteger(shares) || shares < min || shares > SHARE_IPO_MAX) throw new GameError(`Bán ra từ ${min} tới ${SHARE_IPO_MAX} cổ phần (tối đa ${Math.round(SHARES.ipoMax * 100)}%).`);
    const book = bookValue(clan.id, now);
    const [lo, hi] = SHARES.ipoBand.map((k) => Math.max(1, Math.round(book * k)));
    if (!Number.isInteger(price) || price < lo || price > hi) throw new GameError(`Giá IPO từ ${fmt(lo)} tới ${fmt(hi)} xu một cổ phần (0,5 tới 2 lần giá trị sổ sách ${fmt(book)}).`);
    const seed = SHARE_POOL * price;
    if (balanceOf(clanAccount(clan.id)) < seed) throw new GameError(`Quỹ cần ${fmt(seed)} xu góp vào quỹ khớp lệnh (${SHARE_POOL} cổ phần × giá IPO).`);
    post({ account: clanAccount(clan.id), delta: -seed, kind: 'share_pool', memo: 'Góp quỹ khớp lệnh khi lên sàn', now });
    post({ account: poolAccount(clan.id), delta: seed, kind: 'share_pool', memo: `Quỹ khớp lệnh ${clan.name}`, now });
    q.insertListing.run(clan.id, shares, price, SHARE_POOL, price, dayKey(now), now, now + SHARES.subscribeHours * HOUR);
    for (const a of allotByDonation(q.members.all(clan.id), SHARES.total - shares - SHARE_POOL)) {
      if (a.qty > 0) q.addHolding.run(clan.id, 'user', a.id, a.qty, 0);
      if (a.qty > 0) afterHoldingChange(clan.id, 'user', a.id, now);
    }
    news(`🔔 Gia tộc ${clan.emblem} ${clan.name} chào bán ${fmt(shares)} cổ phần giá ${fmt(price)} xu, trong ${SHARES.subscribeHours} giờ`, now);
    return { message: `🔔 Đã mở bán ${fmt(shares)} cổ phần giá ${fmt(price)} xu. Thành viên được chia ${fmt(SHARES.total - shares - SHARE_POOL)} cổ phần theo số đã góp quỹ.` };
  });
}

/** Người chơi mua cổ phần IPO với giá cố định. Tiền về quỹ gia tộc, trừ 2% phí bảo lãnh cho ngân hàng. */
export function subscribeIpo(userId, clanId, qty, now = Date.now()) {
  return transaction(() => {
    const l = q.listing.get(clanId);
    if (!l || l.status !== 'subscribing' || l.closes_at <= now) throw new GameError('Gia tộc này không còn bán IPO.');
    if (!Number.isInteger(qty) || qty < 1) throw new GameError('Số cổ phần không hợp lệ.');
    const mine = heldQty(clanId, 'user', userId);
    if (mine + qty > PLAYER_CAP) throw new GameError(`Mỗi người giữ tối đa ${PLAYER_CAP} cổ phần (${Math.round(SHARES.playerCap * 100)}%) của một gia tộc; bạn đang có ${mine}.`);
    if (q.addSold.run(qty, clanId, qty).changes === 0) throw new GameError(`Chỉ còn ${l.ipo_shares - l.ipo_sold} cổ phần IPO.`);
    const value = qty * l.ipo_price;
    const fee = Math.ceil(value * SHARES.underwriteFee);
    post({ userId, delta: -value, kind: 'share_buy', memo: `IPO ${nameOf(clanId)}: ${qty} cổ phần`, now });
    post({ account: clanAccount(clanId), delta: value - fee, kind: 'share_ipo', memo: `Bán IPO ${qty} cổ phần`, now });
    if (fee > 0) post({ account: brokerAccount(), delta: fee, kind: 'share_fee', memo: `Phí bảo lãnh IPO ${nameOf(clanId)}`, now });
    q.addHolding.run(clanId, 'user', userId, qty, 0);
    q.insertTrade.run(clanId, 'user', userId, 'ipo', qty, value, 0, l.ipo_price, now);
    afterHoldingChange(clanId, 'user', userId, now);
    return { message: `📈 Đã mua ${qty} cổ phần ${nameOf(clanId)} giá ${fmt(l.ipo_price)} xu.` };
  });
}

/** Hết giờ IPO: ngân hàng gia tộc bảo lãnh mua phần chưa bán (90% giá), không có ngân hàng thì gia tộc giữ lại; mở giao dịch. */
export function closeIpos(now = Date.now()) {
  const due = q.dueIpos.all(now);
  if (!due.length) return 0;
  transaction(() => {
    for (const l of due) {
      const unsold = l.ipo_shares - l.ipo_sold;
      if (unsold > 0) {
        const sb = q.stateBank.get();
        const cost = Math.ceil(unsold * l.ipo_price * SHARES.underwritePrice);
        const canUnderwrite = sb && sb.id !== l.clan_id && sb.bank_status === 'open' && !sb.frozen && sheetOf(sb.id).cash - sheetOf(sb.id).floor >= cost;
        if (canUnderwrite) {
          post({ account: bankAccount(sb.id), delta: -cost, kind: 'share_underwrite', memo: `Bảo lãnh ${unsold} cổ phần IPO ${nameOf(l.clan_id)}`, now });
          post({ account: clanAccount(l.clan_id), delta: cost, kind: 'share_underwrite', memo: `Ngân hàng ${nameOf(sb.id)} bảo lãnh ${unsold} cổ phần`, now });
          q.addHolding.run(l.clan_id, 'bank', sb.id, unsold, 0);
          q.insertTrade.run(l.clan_id, 'bank', sb.id, 'underwrite', unsold, cost, 0, l.ipo_price * SHARES.underwritePrice, now);
          afterHoldingChange(l.clan_id, 'bank', sb.id, now);
        } else q.addHolding.run(l.clan_id, 'self', l.clan_id, unsold, 0);
      }
      q.setListed.run(now, l.ipo_price, dayKey(now), l.clan_id);
      news(`📈 Cổ phiếu gia tộc ${nameOf(l.clan_id)} bắt đầu giao dịch, giá ${fmt(l.ipo_price)} xu`, now);
    }
  });
  return due.length;
}

// ---------------------------------------------------------------- giao dịch với quỹ khớp lệnh

/**
 * Một lệnh mua/bán của `holder` { kind, id, account, userId } trên cổ phiếu `clanId`. Kiểm tra biên ngày, trần sở hữu,
 * Sở Công Thương; ghi sổ; trả về { value, fee, price }. Gọi trong transaction. `force` (bán giải chấp) bỏ qua biên ngày.
 */
function trade(holder, clanId, side, qty, now, { force = false, pledge = 0 } = {}) {
  const l = q.listing.get(clanId);
  if (!l || l.status !== 'listed') throw new GameError('Cổ phiếu này chưa giao dịch.');
  if (!Number.isInteger(qty) || qty < 1) throw new GameError('Số cổ phần không hợp lệ.');
  const coins = balanceOf(poolAccount(clanId));
  const shares = l.pool_shares;
  const ref = refPrice(l, now);
  const label = `${nameOf(clanId)} ${qty} cổ phần`;
  if (side === 'buy') {
    const cost = buyCost(coins, shares, qty);
    if (!Number.isFinite(cost)) throw new GameError(`Quỹ khớp lệnh chỉ còn ${shares - 1} cổ phần để mua.`);
    const next = poolPrice(coins + cost, shares - qty);
    if (!withinBand(ref, next)) throw new GameError(`Lệnh này đẩy giá vượt biên ${Math.round(SHARES.band * 100)}% hôm nay (giá đầu ngày ${fmt(ref)}). Mua ít hơn.`);
    if (holder.kind === 'user' && heldQty(clanId, 'user', holder.id) + qty > PLAYER_CAP) throw new GameError(`Mỗi người giữ tối đa ${PLAYER_CAP} cổ phần (${Math.round(SHARES.playerCap * 100)}%) của một gia tộc.`);
    if (holder.kind === 'clan') {
      const after = heldQty(clanId, 'clan', holder.id) + qty;
      if (after > CONTROL && antitrustBreaches(holder.id, clanId).length) throw new GameError(`Sở Công Thương chặn: nắm quyền gia tộc này sẽ đưa gia tộc bạn vượt ${Math.round(SHARES.antitrustShare * 100)}% số lô của một ngành.`);
    }
    const fee = tradeFee(cost);
    if (holder.userId) post({ userId: holder.userId, delta: -cost, kind: 'share_buy', memo: label, now });
    else post({ account: holder.account, delta: -cost, kind: 'share_buy', memo: label, now });
    post({ account: poolAccount(clanId), delta: cost, kind: 'share_buy', memo: `Mua ${qty}`, now });
    payFee(holder.account, holder.userId, fee, label, now);
    q.setPool.run(shares - qty, clanId);
    q.addHolding.run(clanId, holder.kind, holder.id, qty, pledge);
    q.insertTrade.run(clanId, holder.kind, holder.id, side, qty, cost, fee, cost / qty, now);
    afterHoldingChange(clanId, holder.kind, holder.id, now);
    return { value: cost, fee, price: next };
  }
  const proceeds = sellProceeds(coins, shares, qty);
  const next = poolPrice(coins - proceeds, shares + qty);
  if (!force && !withinBand(ref, next)) throw new GameError(`Lệnh này đẩy giá xuống quá biên ${Math.round(SHARES.band * 100)}% hôm nay (giá đầu ngày ${fmt(ref)}). Bán ít hơn.`);
  const unpledge = force ? qty : 0;
  if (q.takeHolding.run(qty, unpledge, clanId, holder.kind, holder.id, qty, unpledge, qty).changes === 0) throw new GameError('Không đủ cổ phần (cổ phần đang cầm cố vay ký quỹ không bán được).');
  const fee = Math.min(proceeds, tradeFee(proceeds));
  post({ account: poolAccount(clanId), delta: -proceeds, kind: 'share_sell', memo: `Bán ${qty}`, now });
  if (holder.userId) post({ userId: holder.userId, delta: proceeds, kind: 'share_sell', memo: label, now });
  else post({ account: holder.account, delta: proceeds, kind: 'share_sell', memo: label, now });
  payFee(holder.account, holder.userId, fee, label, now);
  q.setPool.run(shares + qty, clanId);
  q.insertTrade.run(clanId, holder.kind, holder.id, force ? 'liquidate' : side, qty, proceeds, fee, proceeds / qty, now);
  afterHoldingChange(clanId, holder.kind, holder.id, now);
  if (!force) checkMargins(clanId, now);
  return { value: proceeds, fee, price: next };
}

const userHolder = (userId) => ({ kind: 'user', id: userId, userId, account: null });

/** Người chơi mua cổ phiếu; `margin` thì vay ngân hàng gia tộc tối đa 50% giá trị lệnh, cổ phần mua được cầm cố. */
export function buyShares(userId, clanId, qty, { margin = false } = {}, now = Date.now()) {
  return transaction(() => {
    if (!margin) {
      const r = trade(userHolder(userId), clanId, 'buy', qty, now);
      return { message: `📈 Đã mua ${qty} cổ phần ${nameOf(clanId)}: ${fmt(r.value)} xu + ${fmt(r.fee)} phí.` };
    }
    const sb = q.stateBank.get();
    if (!sb || sb.bank_status !== 'open' || sb.frozen) throw new GameError('Chưa có ngân hàng gia tộc nào cho vay ký quỹ.');
    const l = q.listing.get(clanId);
    if (!l || l.status !== 'listed') throw new GameError('Cổ phiếu này chưa giao dịch.');
    const cost = buyCost(balanceOf(poolAccount(clanId)), l.pool_shares, qty);
    const loan = Math.floor(cost * SHARES.margin.maxLtv);
    const s = sheetOf(sb.id);
    if (!Number.isFinite(loan) || loan < 1 || s.cash - loan < s.floor || s.queuedCount) throw new GameError('Ngân hàng không đủ tiền mặt cho khoản vay ký quỹ này.');
    post({ account: bankAccount(sb.id), delta: -loan, kind: 'margin_loan', memo: `Vay ký quỹ của ${getUser(userId)?.username ?? ''}`, now });
    post({ userId, delta: loan, kind: 'margin_loan', memo: `Vay ký quỹ ngân hàng ${nameOf(sb.id)}`, now });
    const r = trade(userHolder(userId), clanId, 'buy', qty, now, { pledge: qty });
    q.insertMargin.run(userId, clanId, sb.id, loan, qty, sb.loan_rate, now);
    return { message: `📈 Đã mua ${qty} cổ phần ${nameOf(clanId)} (${fmt(r.value)} xu), vay ký quỹ ${fmt(loan)} xu. Cổ phần cầm cố tới khi trả nợ.` };
  });
}

export function sellShares(userId, clanId, qty, now = Date.now()) {
  return transaction(() => {
    const r = trade(userHolder(userId), clanId, 'sell', qty, now);
    return { message: `📉 Đã bán ${qty} cổ phần ${nameOf(clanId)}: nhận ${fmt(r.value - r.fee)} xu (đã trừ ${fmt(r.fee)} phí).` };
  });
}

/**
 * Tộc trưởng mua/bán cổ phiếu bằng quỹ gia tộc. Cổ phiếu của chính mình: mua lại (giữ làm cổ phần tự giữ) hoặc bán ra.
 * `asBank`: tộc trưởng gia tộc có ngân hàng mua bán bằng vốn ngân hàng (ví dụ bán dần cổ phần đã bảo lãnh).
 */
export function clanTradeShares(userId, targetId, side, qty, { asBank = false } = {}, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'mua bán cổ phiếu bằng quỹ');
    if (!['buy', 'sell'].includes(side)) throw new GameError('Thao tác không hợp lệ.');
    const own = targetId === clan.id;
    if (own && side === 'buy' && bondsInDefault(clan.id)) throw new GameError('Gia tộc còn nợ trái chủ: trái chủ được trả trước, chưa mua lại cổ phần được.');
    if (asBank) {
      const b = db.prepare('SELECT * FROM cbank_banks WHERE clan_id = ?').get(clan.id);
      if (!b || b.status !== 'open' || b.frozen) throw new GameError('Ngân hàng của gia tộc không hoạt động.');
      if (own) throw new GameError('Ngân hàng không mua bán cổ phiếu của chính gia tộc mình.');
      if (side === 'buy') {
        const s = sheetOf(clan.id);
        const l = q.listing.get(targetId);
        const cost = l ? buyCost(balanceOf(poolAccount(targetId)), l.pool_shares, qty) : Infinity;
        if (s.queuedCount || s.cash - cost * (1 + SHARES.fee) < s.floor) throw new GameError('Ngân hàng phải giữ đủ 20% tiền gửi làm tiền mặt.');
      }
    }
    const holder = asBank
      ? { kind: 'bank', id: clan.id, userId: null, account: bankAccount(clan.id) }
      : { kind: own ? 'self' : 'clan', id: clan.id, userId: null, account: clanAccount(clan.id) };
    const r = trade(holder, targetId, side, qty, now);
    const what = own ? (side === 'buy' ? 'Mua lại' : 'Bán ra') : side === 'buy' ? 'Mua' : 'Bán';
    return { message: `${what} ${qty} cổ phần ${nameOf(targetId)}: ${fmt(r.value)} xu, phí ${fmt(r.fee)} xu.` };
  });
}

// ---------------------------------------------------------------- vay ký quỹ

/** Người vay trả hết nợ ký quỹ từ ví; cổ phần được gỡ cầm cố. */
export function repayMargin(userId, loanId, now = Date.now()) {
  return transaction(() => {
    const m = q.margin.get(loanId);
    if (!m || m.user_id !== userId || m.status !== 'open') throw new GameError('Không tìm thấy khoản vay ký quỹ này.');
    post({ userId, delta: -m.owed, kind: 'margin_repay', memo: `Trả vay ký quỹ #${m.id}`, now });
    post({ account: bankAccount(m.bank_id), delta: m.owed, kind: 'margin_repay', memo: `Thu vay ký quỹ #${m.id}`, now });
    db.prepare('UPDATE clan_shareholdings SET pledged = MAX(0, pledged - ?) WHERE clan_id = ? AND holder_kind = ? AND holder_id = ?').run(m.shares, m.clan_id, 'user', userId);
    q.saveMargin.run(m.owed, 'repaid', now, m.id);
    return { message: `Đã trả ${fmt(m.owed)} xu, ${m.shares} cổ phần ${nameOf(m.clan_id)} hết cầm cố.` };
  });
}

/** Bán giải chấp: bán toàn bộ cổ phần cầm cố vào quỹ (bỏ qua biên ngày), trả ngân hàng trước, dư về người vay. */
function liquidate(m, now) {
  const r = trade(userHolder(m.user_id), m.clan_id, 'sell', m.shares, now, { force: true });
  const net = r.value - r.fee;
  const toBank = Math.min(m.owed, net);
  const to = db.prepare('SELECT status FROM cbank_banks WHERE clan_id = ?').get(m.bank_id)?.status === 'open' ? bankAccount(m.bank_id) : 'cbank_insurance';
  if (toBank > 0) {
    post({ userId: m.user_id, delta: -toBank, kind: 'margin_repay', memo: `Bán giải chấp vay ký quỹ #${m.id}`, now });
    post({ account: to, delta: toBank, kind: 'margin_repay', memo: `Thu nợ ký quỹ #${m.id} (bán giải chấp)`, now });
  }
  q.saveMargin.run(m.owed - toBank, 'liquidated', now, m.id);
  news(`⚠️ Bán giải chấp ${fmt(m.shares)} cổ phần ${nameOf(m.clan_id)} của ${getUser(m.user_id)?.username ?? 'một người chơi'}`, now);
}

/** Khoản ký quỹ nào có giá trị cổ phần cầm cố dưới 130% số nợ thì bán giải chấp. */
function checkMargins(clanId, now) {
  const l = q.listing.get(clanId);
  if (!l || l.status !== 'listed') return;
  for (const m of q.openMarginsOf.all(clanId)) {
    const value = sellProceeds(balanceOf(poolAccount(clanId)), q.listing.get(clanId).pool_shares, m.shares);
    if (value < m.owed * SHARES.margin.maintenance) liquidate(m, now);
  }
}

/** Cuối ngày: cộng lãi vay ký quỹ rồi kiểm tra ngưỡng giải chấp; khép IPO đã hết giờ. */
export function settleSharesDay(endTs) {
  transaction(() => {
    for (const m of q.openMargins.all()) {
      const owed = m.owed + Math.ceil(m.owed * m.rate);
      q.saveMargin.run(owed, 'open', null, m.id);
    }
    const seen = new Set(q.openMargins.all().map((m) => m.clan_id));
    for (const id of seen) checkMargins(id, endTs);
  });
  closeIpos(endTs);
}

// ---------------------------------------------------------------- cổ tức, quyền kiểm soát

/**
 * Tộc trưởng chia cổ tức từ lợi nhuận: tổng chia trong 7 ngày không quá lợi nhuận 7 ngày (doanh thu − thuế − phí duy trì).
 * Chia đều theo cổ phần cho người chơi, gia tộc khác và ngân hàng đang giữ; cổ phần gia tộc tự giữ và quỹ khớp lệnh không nhận.
 */
export function payShareDividend(userId, amount, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'chia cổ tức');
    const l = q.listing.get(clan.id);
    if (!l || l.status !== 'listed') throw new GameError('Gia tộc chưa lên sàn.');
    if (bondsInDefault(clan.id)) throw new GameError('Gia tộc còn nợ trái chủ: trái chủ được trả trước, chưa chia cổ tức được.');
    const holders = q.external.all(clan.id);
    const shares = holders.reduce((s, h) => s + h.qty, 0);
    if (!shares) throw new GameError('Chưa có cổ đông nào nhận cổ tức.');
    const room = dividendRoom(clan.id, now);
    if (!Number.isInteger(amount) || amount < shares) throw new GameError(`Chia ít nhất ${fmt(shares)} xu (1 xu mỗi cổ phần).`);
    if (amount > room) throw new GameError(`Cổ tức 7 ngày không vượt lợi nhuận 7 ngày: còn chia được ${fmt(room)} xu.`);
    if (balanceOf(clanAccount(clan.id)) < amount) throw new GameError('Quỹ gia tộc không đủ.');
    const per = Math.floor(amount / shares);
    let paid = 0;
    for (const h of holders) {
      const x = per * h.qty;
      paid += x;
      if (h.holder_kind === 'user') {
        post({ userId: h.holder_id, delta: x, kind: 'share_dividend', memo: `Cổ tức ${clan.name}: ${h.qty} cổ phần`, now });
        chargeFinanceTax(h.holder_id, x, `Cổ tức ${clan.name}`, now);
      }
      else post({ account: h.holder_kind === 'bank' ? bankAccount(h.holder_id) : clanAccount(h.holder_id), delta: x, kind: 'share_dividend', memo: `Cổ tức ${clan.name}`, now });
    }
    post({ account: clanAccount(clan.id), delta: -paid, kind: 'share_dividend', memo: `Cổ tức ${fmt(per)} xu/cổ phần`, now });
    news(`💰 Gia tộc ${clan.name} chia cổ tức ${fmt(per)} xu mỗi cổ phần`, now);
    return { message: `💰 Đã chia ${fmt(paid)} xu cổ tức (${fmt(per)} xu mỗi cổ phần).` };
  });
}

/** Số xu còn chia cổ tức được: lợi nhuận 7 ngày trừ cổ tức đã chia trong 7 ngày. */
export function dividendRoom(clanId, now = Date.now()) {
  const profit = q.profit.get(clanId, dayKey(now - 7 * DAY)).p;
  return Math.max(0, profit - q.dividendsSince.get(clanAccount(clanId), now - 7 * DAY).paid);
}

/** Gia tộc kiểm soát `targetId` (nắm trên 50%) — tộc trưởng gọi. */
function mustController(userId, targetId) {
  const { clan } = mustLeader(userId, 'dùng quyền cổ đông kiểm soát');
  const l = q.listing.get(targetId);
  if (!l || l.controller !== clan.id || heldQty(targetId, 'clan', clan.id) <= CONTROL) throw new GameError(`Gia tộc bạn chưa nắm trên ${Math.round(SHARES.control * 100)}% cổ phần gia tộc này.`);
  const target = q.clan.get(targetId);
  if (!target || target.dissolved_at) throw new GameError('Gia tộc này không còn.');
  return { clan, target };
}

/** Cổ đông kiểm soát bổ nhiệm một thành viên của gia tộc bị kiểm soát làm tộc trưởng. */
export function appointLeader(userId, targetId, newLeaderId, now = Date.now()) {
  return transaction(() => {
    const { clan, target } = mustController(userId, targetId);
    const m = q.member.get(newLeaderId);
    if (!m || m.clan_id !== targetId) throw new GameError('Người này không ở gia tộc đó.');
    if (isDeposed(targetId, newLeaderId)) throw new GameError('Người này từng bị phế truất ở gia tộc đó.');
    q.setRole.run('member', target.leader_id);
    q.setRole.run('leader', newLeaderId);
    q.setLeader.run(newLeaderId, targetId);
    news(`🏴 Cổ đông kiểm soát ${clan.name} bổ nhiệm ${getUser(newLeaderId)?.username ?? ''} làm tộc trưởng ${target.name}`, now);
    adminLog('Cổ phần gia tộc', 'share_appoint', newLeaderId, { controller: clan.id, target: targetId });
    return { message: `Đã bổ nhiệm tộc trưởng mới cho ${target.name}.` };
  });
}

/**
 * Sáp nhập: đất (kèm ngành của lô) của gia tộc bị kiểm soát về gia tộc kiểm soát, trong giới hạn số lô theo cấp.
 * Bỏ qua lô ngành chiến lược và lô đang thế chấp. Sở Công Thương kiểm tra lại trần 40% từng ngành.
 */
export function mergeControlled(userId, targetId, now = Date.now()) {
  return transaction(() => {
    const { clan, target } = mustController(userId, targetId);
    const breaches = antitrustBreaches(clan.id, targetId);
    if (breaches.length) throw new GameError(`Sở Công Thương chặn: gia tộc sẽ vượt ${Math.round(SHARES.antitrustShare * 100)}% số lô ngành ${breaches.map((b) => b.industry).join(', ')}.`);
    let room = plotRoom(clan.id);
    let moved = 0;
    for (const r of q.clanPlots.all(targetId)) {
      if (room < 1) break;
      if (plotPledged(r.id) || (r.industry && isStrategic(r.industry))) continue;
      if (r.industry) q.addIndustry.run(clan.id, r.industry, now);
      const c = plotCollateral(r.id, now);
      transferPlot(r.id, clan.id, c?.land ?? 1, now);
      room -= 1;
      moved += 1;
    }
    if (!moved) throw new GameError('Không có lô nào chuyển được (hết chỗ chứa lô, hoặc lô đang thế chấp / ngành chiến lược).');
    news(`🤝 Gia tộc ${clan.name} sáp nhập ${moved} lô đất của ${target.name}`, now);
    adminLog('Cổ phần gia tộc', 'share_merge', null, { controller: clan.id, target: targetId, plots: moved });
    return { message: `Đã sáp nhập ${moved} lô đất của ${target.name}.` };
  });
}

/** Gia tộc giải tán: quỹ khớp lệnh về quỹ gia tộc, rời sàn, khoản ký quỹ trên cổ phiếu này mất trắng; cổ phần nó giữ ở gia tộc khác thành cổ phần tự giữ của gia tộc đó. */
export function sharesDissolve(clanId, now) {
  const l = q.listing.get(clanId);
  if (l && l.status !== 'delisted') {
    const pool = balanceOf(poolAccount(clanId));
    if (pool > 0) {
      post({ account: poolAccount(clanId), delta: -pool, kind: 'share_pool', memo: 'Rời sàn: quỹ khớp lệnh về quỹ gia tộc', now });
      post({ account: clanAccount(clanId), delta: pool, kind: 'share_pool', memo: 'Rời sàn: nhận lại quỹ khớp lệnh', now });
    }
    for (const m of q.openMarginsOf.all(clanId)) q.saveMargin.run(m.owed, 'liquidated', now, m.id);
    q.delist.run(clanId);
  }
  for (const h of q.heldInDissolved.all(clanId)) {
    if (h.holder_kind === 'bank') continue; // ngân hàng đổ vỡ vẫn giữ cổ phần; cổ tức vào quỹ bảo hiểm khi bán.
    q.dropHolding.run(h.clan_id, 'clan', clanId);
    q.addHolding.run(h.clan_id, 'self', h.clan_id, h.qty, 0);
    afterHoldingChange(h.clan_id, 'self', h.clan_id, now);
  }
}

// ---------------------------------------------------------------- xem

/** Giá trị cổ phần và nợ ký quỹ của người chơi (tài sản ròng). */
export function sharePositions(userId) {
  let value = 0;
  for (const h of q.heldBy.all('user', userId)) {
    const l = q.listing.get(h.clan_id);
    if (l && l.status !== 'delisted') value += Math.floor(h.qty * priceOf(l));
  }
  return { value, debt: q.marginDebt.get(userId).owed };
}

const listingRow = (l, now) => {
  const price = priceOf(l);
  const ref = l.status === 'listed' && l.ref_day === dayKey(now) ? l.ref_price : price;
  return {
    clanId: l.clan_id, name: l.name, emblem: l.emblem, color: l.color, status: l.status, price: Math.round(price * 100) / 100,
    ref: Math.round(ref * 100) / 100, change: ref ? price / ref - 1 : 0, poolShares: l.pool_shares,
    ipo: { shares: l.ipo_shares, sold: l.ipo_sold, price: l.ipo_price, closesAt: l.closes_at },
    controller: l.controller ? { id: l.controller, name: nameOf(l.controller) } : null,
    volume24h: q.dayVolume.get(l.clan_id, now - DAY).qty,
    book: Math.round(bookValue(l.clan_id, now) * 100) / 100,
    quote: l.status === 'listed' ? {
      buy1: buyCost(balanceOf(poolAccount(l.clan_id)), l.pool_shares, 1), sell1: sellProceeds(balanceOf(poolAccount(l.clan_id)), l.pool_shares, 1),
      maxPrice: ref * (1 + SHARES.band), minPrice: ref * (1 - SHARES.band),
    } : null,
  };
};

const holderName = (h) => (h.holder_kind === 'user' ? getUser(h.holder_id)?.username ?? `#${h.holder_id}` : h.holder_kind === 'self' ? 'Gia tộc tự giữ' : `${h.holder_kind === 'bank' ? 'Ngân hàng ' : ''}${nameOf(h.holder_id)}`);

export function sharesView(userId, now = Date.now()) {
  closeIpos(now);
  const listings = q.listings.all().map((l) => listingRow(l, now));
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  let mine = null;
  if (clan && !clan.dissolved_at) {
    const l = q.listing.get(clan.id);
    const leader = m.role === 'leader' && !isDeposed(clan.id, userId);
    const book = bookValue(clan.id, now);
    mine = {
      id: clan.id, name: clan.name, leader, fund: balanceOf(clanAccount(clan.id)),
      listing: l ? listingRow({ ...l, name: clan.name, emblem: clan.emblem, color: clan.color }, now) : null,
      holders: l ? q.holders.all(clan.id).slice(0, 12).map((h) => ({ kind: h.holder_kind, id: h.holder_id, name: holderName(h), qty: h.qty })) : [],
      book: Math.round(book * 100) / 100,
      ipoRange: SHARES.ipoBand.map((k) => Math.max(1, Math.round(book * k))),
      dividendRoom: leader ? dividendRoom(clan.id, now) : 0,
      holdings: q.heldBy.all('clan', clan.id).map((h) => ({ clanId: h.clan_id, name: h.name, emblem: h.emblem, qty: h.qty })),
      controls: q.listings.all().filter((x) => x.controller === clan.id).map((x) => ({ clanId: x.clan_id, name: x.name, members: q.members.all(x.clan_id).map((mm) => ({ id: mm.id, name: getUser(mm.id)?.username ?? '' })) })),
    };
  }
  const sb = q.stateBank.get();
  return {
    rules: { ...SHARES, ipoMaxShares: SHARE_IPO_MAX, poolSeed: SHARE_POOL, playerCap: PLAYER_CAP },
    marginOpen: Boolean(sb && sb.bank_status === 'open' && !sb.frozen),
    listings,
    holdings: q.heldBy.all('user', userId).map((h) => ({ clanId: h.clan_id, name: h.name, emblem: h.emblem, qty: h.qty, pledged: h.pledged })),
    margins: q.myMargins.all(userId, now - 7 * DAY).map((x) => ({ id: x.id, clanId: x.clan_id, name: x.name, owed: x.owed, shares: x.shares, rate: x.rate, status: x.status, openedAt: x.opened_at })),
    clan: mine,
  };
}

export function adminSharesView(now = Date.now()) {
  return {
    listings: q.listings.all().map((l) => ({
      ...listingRow(l, now),
      holders: q.holders.all(l.clan_id).slice(0, 8).map((h) => ({ kind: h.holder_kind, name: holderName(h), qty: h.qty })),
      trades: q.trades.all(l.clan_id, 5),
    })),
    margins: q.openMargins.all().map((m) => ({ id: m.id, user: getUser(m.user_id)?.username ?? '', clan: nameOf(m.clan_id), bank: nameOf(m.bank_id), owed: m.owed, shares: m.shares })),
  };
}
