// Ngân hàng Trân Châu (tiết kiệm, gửi kỳ hạn) và Ngân hàng Trung ương (chỉ số giá, lãi suất cơ bản).
import { db, transaction } from './db.js';
import { DAY, GameError } from './game.js';
import { post } from './ledger.js';
import { BANK, accrue, depositPayout, policy } from './rules/bank.js';
import { bankInterestBonus } from './strategic.js';

const q = {
  latest: db.prepare('SELECT * FROM central_bank ORDER BY week DESC LIMIT 1'),
  history: db.prepare('SELECT * FROM central_bank ORDER BY week DESC LIMIT ?'),
  insertWeek: db.prepare(`
    INSERT OR REPLACE INTO central_bank (week, money_per_player, growth, price_index, base_rate, players, at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`),
  ensure: db.prepare('INSERT OR IGNORE INTO bank_accounts (user_id, savings, accrued, updated_at) VALUES (?, 0, 0, ?)'),
  account: db.prepare('SELECT * FROM bank_accounts WHERE user_id = ?'),
  allAccounts: db.prepare('SELECT * FROM bank_accounts'),
  setAccrued: db.prepare('UPDATE bank_accounts SET accrued = ?, updated_at = ? WHERE user_id = ?'),
  deposits: db.prepare('SELECT * FROM deposits WHERE user_id = ? AND closed_at IS NULL ORDER BY matures_at'),
  deposit: db.prepare('SELECT * FROM deposits WHERE id = ?'),
  matured: db.prepare('SELECT * FROM deposits WHERE closed_at IS NULL AND matures_at <= ?'),
  insertDeposit: db.prepare(`
    INSERT INTO deposits (user_id, amount, rate, term_days, opened_at, matures_at) VALUES (?, ?, ?, ?, ?, ?)`),
  closeDeposit: db.prepare('UPDATE deposits SET closed_at = ?, payout = ? WHERE id = ?'),
  moneySupply: db.prepare(`
    SELECT (SELECT COALESCE(SUM(coins), 0) FROM users)
         + (SELECT COALESCE(SUM(savings), 0) FROM bank_accounts)
         + (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE closed_at IS NULL)
         + (SELECT COALESCE(SUM(locked), 0) FROM orders WHERE status = 'open')
         + (SELECT COALESCE(SUM(pay), 0) FROM shifts WHERE claimed_at IS NULL AND (business_id IS NOT NULL OR factory_id IS NOT NULL))
         + (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE id != 'treasury') AS total`),
  activePlayers: db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM ledger WHERE user_id IS NOT NULL AND created_at >= ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

export function economy() {
  const row = q.latest.get();
  return { priceIndex: row?.price_index ?? 1, baseRate: row?.base_rate ?? BANK.defaultRate, growth: row?.growth ?? BANK.targetGrowth, week: row?.week ?? null };
}

/** Giá siêu thị NPC sau khi nhân chỉ số giá. */
export const indexedPrice = (base) => Math.max(1, Math.round(base * economy().priceIndex));

/** Cộng dồn lãi đến thời điểm `now` rồi trả về tài khoản tiết kiệm. */
function touch(userId, now) {
  q.ensure.run(userId, now);
  const acc = q.account.get(userId);
  const accrued = acc.accrued + accrue(acc.savings, economy().baseRate, acc.updated_at, now);
  q.setAccrued.run(accrued, now, userId);
  return { ...acc, accrued, updated_at: now };
}

export function moveSavings(userId, action, amount, now = Date.now()) {
  if (!['deposit', 'withdraw'].includes(action)) throw new GameError('Thao tác không hợp lệ.');
  return transaction(() => {
    touch(userId, now);
    if (action === 'deposit') {
      post({ userId, delta: -amount, kind: 'savings_in', now });
      post({ userId, account: 'savings', delta: amount, kind: 'savings_in', now });
      return { message: `Đã gửi ${amount} 🪙 vào tiết kiệm.` };
    }
    post({ userId, account: 'savings', delta: -amount, kind: 'savings_out', now });
    post({ userId, delta: amount, kind: 'savings_out', now });
    return { message: `Đã rút ${amount} 🪙 về ví.` };
  });
}

export function openDeposit(userId, amount, term, now = Date.now()) {
  const premium = BANK.termPremium[term];
  if (premium === undefined) throw new GameError('Kỳ hạn chỉ có 3, 7 hoặc 14 ngày.');
  if (amount < BANK.minDeposit) throw new GameError(`Gửi kỳ hạn tối thiểu ${BANK.minDeposit} 🪙.`);
  const rate = economy().baseRate + premium;
  return transaction(() => {
    post({ userId, delta: -amount, kind: 'deposit_open', memo: `Kỳ hạn ${term} ngày`, now });
    q.insertDeposit.run(userId, amount, rate, term, now, now + term * DAY);
    const interest = Math.floor(amount * rate * term);
    return { message: `Đã gửi ${amount} 🪙 kỳ hạn ${term} ngày, đáo hạn nhận thêm ${interest} 🪙.` };
  });
}

function payDeposit(dep, now) {
  const { principal, interest } = depositPayout(dep, now);
  post({ userId: dep.user_id, delta: principal, kind: 'deposit_close', memo: `Kỳ hạn ${dep.term_days} ngày`, now });
  if (interest) {
    post({ userId: dep.user_id, delta: interest, kind: 'interest', memo: `Lãi kỳ hạn ${dep.term_days} ngày`, now });
    bankInterestBonus(dep.user_id, interest, { memo: `lãi kỳ hạn ${dep.term_days} ngày`, now });
  }
  q.closeDeposit.run(now, principal + interest, dep.id);
  return { principal, interest };
}

export function closeDeposit(userId, depositId, now = Date.now()) {
  return transaction(() => {
    const dep = q.deposit.get(depositId);
    if (!dep || dep.user_id !== userId || dep.closed_at) throw new GameError('Không tìm thấy khoản gửi này.');
    const { principal, interest } = payDeposit(dep, now);
    return {
      message: interest
        ? `Tất toán đúng hạn: nhận ${principal} gốc + ${interest} lãi.`
        : `Rút trước hạn: nhận lại ${principal} 🪙, không có lãi.`,
    };
  });
}

export function bankView(userId, now = Date.now()) {
  const acc = transaction(() => touch(userId, now));
  const { baseRate, priceIndex } = economy();
  return {
    savings: acc.savings,
    accrued: Math.floor(acc.accrued * 100) / 100,
    cap: BANK.savingsCap,
    minDeposit: BANK.minDeposit,
    baseRate,
    priceIndex,
    terms: Object.entries(BANK.termPremium).map(([days, premium]) => ({ days: Number(days), rate: baseRate + premium })),
    deposits: q.deposits.all(userId).map((d) => ({
      id: d.id,
      amount: d.amount,
      rate: d.rate,
      termDays: d.term_days,
      openedAt: d.opened_at,
      maturesAt: d.matures_at,
      interest: Math.floor(d.amount * d.rate * d.term_days),
    })),
    history: q.history.all(12).reverse().map((w) => ({
      week: w.week, growth: w.growth, priceIndex: w.price_index, baseRate: w.base_rate, moneyPerPlayer: Math.round(w.money_per_player), players: w.players,
    })),
  };
}

/** Phần tiền gửi để tính tài sản ròng (không ghi gì vào DB). */
export function bankHoldings(userId, now = Date.now()) {
  const acc = q.account.get(userId);
  const savings = acc ? acc.savings + Math.floor(acc.accrued + accrue(acc.savings, economy().baseRate, acc.updated_at, now)) : 0;
  const deposits = q.deposits.all(userId).reduce((sum, d) => sum + d.amount, 0);
  return { savings, deposits };
}

/** Quyết toán cuối ngày: cộng lãi tiết kiệm phần nguyên, tự tất toán các khoản đã đáo hạn. */
export function settleBankDay(endTs) {
  transaction(() => {
    for (const { user_id: userId } of q.allAccounts.all()) {
      const acc = touch(userId, endTs);
      const whole = Math.floor(acc.accrued);
      if (whole > 0) {
        post({ userId, account: 'savings', delta: whole, kind: 'interest', memo: 'Lãi tiết kiệm', now: endTs });
        bankInterestBonus(userId, whole, { account: 'savings', memo: 'lãi tiết kiệm', now: endTs });
        q.setAccrued.run(acc.accrued - whole, endTs, userId);
      }
    }
    for (const dep of q.matured.all(endTs)) payDeposit(dep, endTs);
  });
}

/** Ngân hàng Trung ương họp mỗi tuần: đo lượng xu bình quân, chỉnh chỉ số giá và lãi suất cơ bản. */
export function centralBankWeek(week, now = Date.now()) {
  transaction(() => {
    const players = Math.max(1, q.activePlayers.get(now - 7 * DAY).n);
    const moneyPerPlayer = q.moneySupply.get().total / players;
    const prev = q.latest.get();
    // Phiên họp đầu chưa có số liệu để so, coi như đúng mục tiêu (giữ nguyên chính sách).
    const growth = prev && prev.money_per_player > 0
      ? (moneyPerPlayer - prev.money_per_player) / prev.money_per_player
      : BANK.targetGrowth;
    const next = policy({ growth, priceIndex: prev?.price_index ?? 1 });
    q.insertWeek.run(week, moneyPerPlayer, growth, next.priceIndex, next.baseRate, players, now);
    const pct = (v) => `${(v * 100).toFixed(1).replace('.', ',')}%`;
    q.insertNews.run(
      `Ngân hàng Trung ương: lượng xu tăng ${pct(growth)}/tuần, lãi suất cơ bản ${pct(next.baseRate)}/ngày, chỉ số giá ${next.priceIndex.toFixed(3).replace('.', ',')}`,
      now, now, now + 7 * DAY,
    );
  });
}
