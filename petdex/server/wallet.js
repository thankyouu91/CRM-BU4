// Ví: tài sản ròng, báo cáo thu chi từ sổ cái, sao kê, ảnh chụp tài sản mỗi đêm.
import { allUsers, db, getUser, inventory } from './db.js';
import { bankHoldings, indexedPrice } from './bank.js';
import { clanBankDeposits } from './clan-bank.js';
import { dayKey } from './clock.js';
import { DAY, ITEMS } from './game.js';
import { KINDS } from './ledger.js';
import { goodsValue, lockedInOrders } from './market.js';
import { escrowOf } from './contracts.js';
import { heldInAuctions } from './auction.js';
import { debtOf } from './credit.js';
import { p2pPositions } from './p2p.js';

const q = {
  since: db.prepare('SELECT delta, kind, created_at FROM ledger WHERE user_id = ? AND created_at >= ? ORDER BY id'),
  page: db.prepare(`
    SELECT id, account, delta, balance_after, kind, memo, created_at FROM ledger
    WHERE user_id = ? AND (? IS NULL OR kind = ?) AND (? IS NULL OR id < ?)
    ORDER BY id DESC LIMIT ?`),
  history: db.prepare('SELECT day, total FROM networth WHERE user_id = ? ORDER BY day DESC LIMIT ?'),
  snapshot: db.prepare('INSERT OR REPLACE INTO networth (user_id, day, total, detail) VALUES (?, ?, ?, ?)'),
  activeSince: db.prepare('SELECT DISTINCT user_id FROM ledger WHERE user_id IS NOT NULL AND created_at >= ?'),
};

export function netWorth(userId, now = Date.now()) {
  const user = getUser(userId);
  const bank = bankHoldings(userId, now);
  const items = Object.entries(inventory(userId))
    .reduce((sum, [id, qty]) => sum + (ITEMS[id] ? Math.floor(indexedPrice(ITEMS[id].price) * 0.5) * qty : 0), 0);
  const p2p = p2pPositions(userId);
  const parts = {
    wallet: user.coins,
    savings: bank.savings,
    deposits: bank.deposits,
    clanBank: clanBankDeposits(userId), // gốc tiền gửi ở các ngân hàng gia tộc
    locked: lockedInOrders(userId),
    goods: goodsValue(userId, now),
    items,
    escrow: escrowOf(userId) + heldInAuctions(userId),
    lent: p2p.lent, // khoản cho vay ngang hàng chưa thu về (tính theo số phải thu, trước phí ngân hàng)
    debt: -debtOf(userId) - p2p.debt,
  };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}

/** Thu chi theo nhóm và theo ngày trong `days` ngày gần nhất (bỏ qua các khoản chuyển nội bộ). */
export function report(userId, days, now = Date.now()) {
  const from = now - days * DAY;
  const byKind = {};
  const daily = new Map();
  for (const row of q.since.all(userId, from)) {
    const group = KINDS[row.kind]?.group;
    if (group !== 'income' && group !== 'expense') continue;
    byKind[row.kind] = (byKind[row.kind] ?? 0) + row.delta;
    const key = dayKey(row.created_at);
    const d = daily.get(key) ?? { day: key, income: 0, expense: 0 };
    if (group === 'income') d.income += row.delta;
    else d.expense -= row.delta;
    daily.set(key, d);
  }
  const income = Object.entries(byKind).filter(([k]) => KINDS[k].group === 'income').map(([kind, total]) => ({ kind, total }));
  const expense = Object.entries(byKind).filter(([k]) => KINDS[k].group === 'expense').map(([kind, total]) => ({ kind, total: -total }));
  const days_ = [];
  for (let t = from + DAY; t <= now + 1; t += DAY) {
    const key = dayKey(t);
    days_.push(daily.get(key) ?? { day: key, income: 0, expense: 0 });
  }
  return {
    income: income.sort((a, b) => b.total - a.total),
    expense: expense.sort((a, b) => b.total - a.total),
    daily: days_,
  };
}

export function ledgerPage(userId, { kind = null, before = null, limit = 40 } = {}) {
  const k = kind && KINDS[kind] ? kind : null;
  const b = Number.isInteger(before) ? before : null;
  return q.page.all(userId, k, k, b, b, limit).map((r) => ({
    id: r.id, account: r.account, delta: r.delta, balance: r.balance_after, kind: r.kind, memo: r.memo, at: r.created_at,
  }));
}

export function walletView(userId, days = 7, now = Date.now()) {
  const worth = netWorth(userId, now);
  const history = q.history.all(userId, 30).reverse().map((h) => ({ day: h.day, total: h.total }));
  const today = dayKey(now);
  if (history.at(-1)?.day !== today) history.push({ day: today, total: worth.total });
  return { netWorth: worth, report: report(userId, days, now), history, ledger: ledgerPage(userId) };
}

/** Chụp tài sản ròng của người chơi có hoạt động trong 7 ngày (gọi lúc quyết toán ngày). */
export function snapshotNetWorth(day, now = Date.now()) {
  for (const { user_id: userId } of q.activeSince.all(now - 7 * DAY)) {
    const worth = netWorth(userId, now);
    q.snapshot.run(userId, day, worth.total, JSON.stringify(worth.parts));
  }
}

/** Bảng xếp hạng tài sản ròng tính trực tiếp (đủ nhanh với vài trăm người chơi). */
export function richList(limit = 20, now = Date.now()) {
  return allUsers()
    .map((u) => ({ userId: u.id, username: u.username, total: netWorth(u.id, now).total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
