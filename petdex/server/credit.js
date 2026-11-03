// Điểm tín dụng (mọi người chơi) và vay trả góp theo ngày ở Ngân hàng (chế độ tài chính nâng cao).
import { db, getUser, transaction } from './db.js';
import { economy } from './bank.js';
import { startOfDay } from './clock.js';
import { DAY, GameError } from './game.js';
import { KINDS, post } from './ledger.js';
import { UNLOCKS } from './routes-economy.js';
import { CREDIT, LOANS, TIERS, ceilCoins, clampCredit, installment, loanLimit, loanRate, tierOf } from './rules/production.js';

const MIN_LOAN = 50;
const MAX_LOANS = 2;

const q = {
  setCredit: db.prepare('UPDATE users SET credit = ? WHERE id = ?'),
  insertEvent: db.prepare('INSERT INTO credit_events (user_id, delta, reason, at) VALUES (?, ?, ?, ?)'),
  events: db.prepare('SELECT delta, reason, at FROM credit_events WHERE user_id = ? ORDER BY id DESC LIMIT 12'),
  openLoans: db.prepare("SELECT * FROM loans WHERE user_id = ? AND status IN ('active', 'late', 'defaulted') ORDER BY id"),
  openAll: db.prepare("SELECT * FROM loans WHERE status IN ('active', 'late', 'defaulted') AND opened_at < ?"),
  loan: db.prepare('SELECT * FROM loans WHERE id = ?'),
  history: db.prepare("SELECT * FROM loans WHERE user_id = ? AND status = 'repaid' ORDER BY id DESC LIMIT 5"),
  insertLoan: db.prepare(`
    INSERT INTO loans (user_id, principal, remaining, rate, term_days, opened_at, due_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`),
  saveLoan: db.prepare('UPDATE loans SET remaining = ?, fees = ?, late_days = ?, paid_days = ?, status = ? WHERE id = ?'),
  income: db.prepare(`
    SELECT kind, COALESCE(SUM(delta), 0) AS total FROM ledger
    WHERE user_id = ? AND account = 'wallet' AND delta > 0 AND created_at >= ? AND created_at < ? GROUP BY kind`),
  savings: db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?'),
  setBan: db.prepare('UPDATE users SET loan_ban_until = ? WHERE id = ?'),
};

/** Cộng/trừ điểm tín dụng (giữ trong 300–850) và ghi lý do để người chơi xem lại. */
export function addCredit(userId, delta, reason, now = Date.now()) {
  if (!delta) return;
  const user = getUser(userId);
  if (!user) return;
  const next = clampCredit(user.credit + delta);
  if (next === user.credit) return;
  q.setCredit.run(next, userId);
  q.insertEvent.run(userId, next - user.credit, reason, now);
}

/** Thu nhập (các khoản thuộc nhóm thu) vào ví trong khoảng [from, to). */
export function incomeBetween(userId, from, to) {
  return q.income.all(userId, from, to).filter((r) => KINDS[r.kind]?.group === 'income').reduce((s, r) => s + r.total, 0);
}

const outstanding = (loans) => loans.reduce((s, l) => s + l.remaining + l.fees, 0);

/** Lý do chưa được vay (null nếu được). */
function blockedReason(user, loans, now) {
  if (!user.advanced) return `Bật chế độ tài chính nâng cao (cấp ${UNLOCKS.advanced}) để vay.`;
  if (now - user.created_at < LOANS.minAccountDays * DAY) return `Tài khoản cần đủ ${LOANS.minAccountDays} ngày tuổi mới được vay.`;
  if (user.loan_ban_until > now) return 'Bạn đang bị cấm vay vì từng vỡ nợ.';
  if (loans.some((l) => l.status !== 'active')) return 'Trả hết khoản đang trễ hạn đã.';
  if (loans.length >= MAX_LOANS) return `Mỗi lúc chỉ có tối đa ${MAX_LOANS} khoản vay.`;
  return null;
}

function terms(userId, now) {
  const user = getUser(userId);
  const loans = q.openLoans.all(userId);
  const eco = economy();
  const limit = loanLimit({
    score: user.credit,
    avgIncome: incomeBetween(userId, now - 7 * DAY, now) / 7,
    savings: q.savings.get(userId)?.savings ?? 0,
    outstanding: outstanding(loans),
  });
  return { user, loans, limit, rate: loanRate(eco.baseRate, user.credit, eco.growth), blocked: blockedReason(user, loans, now) };
}

export function creditView(userId, now = Date.now()) {
  const t = terms(userId, now);
  const tier = tierOf(t.user.credit);
  return {
    score: t.user.credit,
    tier,
    nextTier: TIERS.find((x) => x.min > t.user.credit) ?? null,
    tiers: TIERS,
    events: q.events.all(userId),
    limit: t.blocked ? 0 : t.limit,
    rate: t.rate,
    terms: LOANS.terms,
    originationFee: LOANS.originationFee,
    minLoan: MIN_LOAN,
    blocked: t.blocked,
    banUntil: t.user.loan_ban_until > now ? t.user.loan_ban_until : null,
    loans: t.loans.map((l) => ({
      id: l.id,
      principal: l.principal,
      remaining: l.remaining,
      fees: l.fees,
      rate: l.rate,
      termDays: l.term_days,
      openedAt: l.opened_at,
      dueAt: l.due_at,
      lateDays: l.late_days,
      status: l.status,
      today: l.status === 'defaulted' ? null : installment(l, now >= l.due_at),
      payoff: l.remaining + l.fees,
    })),
    history: q.history.all(userId).map((l) => ({ id: l.id, principal: l.principal, termDays: l.term_days, openedAt: l.opened_at })),
  };
}

export function borrow(userId, amount, termDays, now = Date.now()) {
  if (!Number.isInteger(amount) || amount < MIN_LOAN) throw new GameError(`Vay tối thiểu ${MIN_LOAN} xu.`);
  if (!LOANS.terms.includes(termDays)) throw new GameError(`Kỳ hạn vay: ${LOANS.terms.join(', ')} ngày.`);
  return transaction(() => {
    const t = terms(userId, now);
    if (t.blocked) throw new GameError(t.blocked);
    if (amount > t.limit) throw new GameError(`Hạn mức hiện tại của bạn là ${t.limit} xu.`);
    // Ngân hàng giải ngân là tạo ra xu mới; trả gốc thì số xu đó bị hủy.
    post({ userId, delta: amount, kind: 'loan_in', memo: `Vay ${termDays} ngày`, now });
    chargeLoanCost(userId, ceilCoins(amount * LOANS.originationFee), 'loan_fee', 'Phí giải ngân', now);
    q.insertLoan.run(userId, amount, amount, t.rate, termDays, now, now + termDays * DAY);
    return { message: `💳 Đã giải ngân ${amount} 🪙. Mỗi tối ngân hàng tự trừ một kỳ trả góp từ ví (thiếu thì lấy sang tiết kiệm).` };
  });
}

/** Lãi và phí vay: một nửa vào ngân sách thị trấn, một nửa bị hủy (giống phí giao dịch). */
function chargeLoanCost(userId, amount, kind, memo, now, account = 'wallet') {
  if (amount <= 0) return;
  post({ userId, account, delta: -amount, kind, memo, now });
  const toTreasury = Math.floor(amount / 2);
  if (toTreasury > 0) post({ account: 'treasury', delta: toTreasury, kind, memo, now });
}

/**
 * Trả `amount` xu cho khoản vay, lấy từ ví rồi tới tiết kiệm (nếu `useSavings`):
 * trả phí và lãi còn nợ trước, rồi tới gốc. Trả về số đã trả cho từng phần.
 */
function pay(loan, amount, now, { useSavings = false, interest = 0 } = {}) {
  const user = getUser(loan.user_id);
  const savings = useSavings ? q.savings.get(loan.user_id)?.savings ?? 0 : 0;
  let budget = Math.min(amount, Math.max(0, user.coins) + savings);
  const paid = { costs: 0, principal: 0 };
  const take = (n, kind, memo, isCost) => {
    let left = n;
    for (const account of ['wallet', 'savings']) {
      const have = account === 'wallet' ? getUser(loan.user_id).coins : (useSavings ? q.savings.get(loan.user_id)?.savings ?? 0 : 0);
      const part = Math.min(left, Math.max(0, have));
      if (part <= 0) continue;
      if (isCost) chargeLoanCost(loan.user_id, part, kind, memo, now, account);
      else post({ userId: loan.user_id, account, delta: -part, kind, memo, now });
      left -= part;
    }
    return n - left;
  };
  const costs = Math.min(budget, loan.fees + interest);
  if (costs > 0) {
    paid.costs = take(costs, 'loan_interest', `Lãi và phí khoản vay #${loan.id}`, true);
    budget -= paid.costs;
  }
  return { paid, budget, take };
}

/** Trả trước một phần hoặc toàn bộ (không tính lãi ngày hôm nay). */
export function repay(userId, loanId, amount, now = Date.now()) {
  if (!Number.isInteger(amount) || amount < 1) throw new GameError('Số tiền trả không hợp lệ.');
  return transaction(() => {
    const loan = q.loan.get(loanId);
    if (!loan || loan.user_id !== userId || !['active', 'late', 'defaulted'].includes(loan.status)) throw new GameError('Không tìm thấy khoản vay.');
    const owed = loan.remaining + loan.fees;
    const want = Math.min(amount, owed);
    if (getUser(userId).coins < want) throw new GameError('Không đủ xu trong ví.');
    const { paid, budget, take } = pay(loan, want, now);
    paid.principal = take(Math.min(budget, loan.remaining), 'loan_repay', `Trả gốc khoản vay #${loan.id}`, false);
    const next = { ...loan, fees: loan.fees - paid.costs, remaining: loan.remaining - paid.principal };
    finish(next, now, { lateCleared: next.fees === 0 });
    const done = next.remaining === 0 && next.fees === 0;
    return { message: done ? `🎉 Đã tất toán khoản vay #${loan.id}!` : `Đã trả ${paid.costs + paid.principal} 🪙, còn nợ ${next.remaining + next.fees} 🪙.` };
  });
}

/** Lưu khoản vay sau một lần trả; tất toán thì cộng điểm (trừ khi từng vỡ nợ). */
function finish(loan, now, { lateCleared }) {
  let status = loan.status;
  if (loan.remaining === 0 && loan.fees === 0) {
    if (loan.status !== 'defaulted') addCredit(loan.user_id, CREDIT.repaid, `Tất toán khoản vay #${loan.id}`, now);
    status = 'repaid';
  } else if (status === 'late' && lateCleared) {
    status = 'active';
    loan.late_days = 0;
  }
  q.saveLoan.run(loan.remaining, loan.fees, loan.late_days, loan.paid_days, status, loan.id);
}

/**
 * Cuối ngày: trừ kỳ trả góp của mọi khoản vay. Trả đủ → +5 điểm; thiếu → phần thiếu cộng 1% phí trễ, −20 điểm;
 * trễ 7 kỳ liền → vỡ nợ: −100 điểm, cấm vay 14 ngày, từ đó mỗi tối ngân hàng giữ 30% thu nhập trong ngày để thu nợ.
 */
export function settleLoansDay(day) {
  const from = startOfDay(day);
  const end = from + DAY;
  const at = end - 1;
  transaction(() => {
    for (const loan of q.openAll.all(end)) {
      if (loan.status === 'defaulted') {
        // Vỡ nợ vẫn chịu lãi và phí trễ như khoản trễ hạn; ngân hàng giữ `garnish` thu nhập trong ngày,
        // lấy từ ví rồi tới tiết kiệm (không giấu xu trong tiết kiệm để né thu nợ được).
        const interest = ceilCoins(loan.remaining * loan.rate);
        const garnish = Math.floor(incomeBetween(loan.user_id, from, end) * LOANS.garnish);
        const { paid, budget, take } = pay(loan, garnish, at, { useSavings: true, interest });
        paid.principal = take(Math.min(budget, loan.remaining), 'loan_repay', `Thu nợ khoản vay #${loan.id}`, false);
        const next = { ...loan, fees: loan.fees + interest - paid.costs, remaining: loan.remaining - paid.principal };
        if (next.remaining + next.fees > 0) next.fees += ceilCoins((next.remaining + next.fees) * LOANS.lateFee);
        finish(next, at, { lateCleared: false });
        continue;
      }
      const due = installment(loan, at >= loan.due_at);
      const { paid, budget, take } = pay(loan, due.total, at, { useSavings: true, interest: due.interest });
      paid.principal = take(Math.min(budget, due.principal), 'loan_repay', `Kỳ trả góp khoản vay #${loan.id}`, false);
      const unpaidCosts = loan.fees + due.interest - paid.costs;
      const short = due.principal - paid.principal + unpaidCosts;
      const next = { ...loan, remaining: loan.remaining - paid.principal, fees: unpaidCosts, paid_days: loan.paid_days + 1 };
      if (short <= 0) {
        addCredit(loan.user_id, CREDIT.onTime, `Trả góp đúng hạn khoản #${loan.id}`, at);
        finish(next, at, { lateCleared: true });
        continue;
      }
      next.fees += ceilCoins((next.remaining + next.fees) * LOANS.lateFee);
      next.late_days = loan.late_days + 1;
      next.status = 'late';
      addCredit(loan.user_id, CREDIT.late, `Trễ kỳ trả góp khoản #${loan.id}`, at);
      if (next.late_days >= LOANS.defaultAfter) {
        next.status = 'defaulted';
        addCredit(loan.user_id, CREDIT.defaulted, `Vỡ nợ khoản #${loan.id}`, at);
        q.setBan.run(at + LOANS.banDays * DAY, loan.user_id);
      }
      finish(next, at, { lateCleared: false });
    }
  });
}

/** Tổng dư nợ của người chơi (dùng cho bảng tài sản ròng). */
export const debtOf = (userId) => outstanding(q.openLoans.all(userId));
