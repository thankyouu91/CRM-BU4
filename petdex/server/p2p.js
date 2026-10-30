// Vay ngang hàng (P2P) qua Ngân hàng Trân Châu làm trung gian: người vay đăng yêu cầu (số tiền, kỳ hạn, lãi/ngày),
// người cho vay rót đủ vốn, đáo hạn người vay trả gốc + lãi một lần. Ngân hàng giữ 10–20% tiền lãi tùy hạng tín dụng
// của người vay; người cho vay chịu rủi ro: người vay trễ thì bị phí trễ và trừ điểm, vỡ nợ thì bị giữ dần tiền trong ví.
import { db, getUser, transaction } from './db.js';
import { addCredit } from './credit.js';
import { dayKey, startOfDay } from './clock.js';
import { DAY, GameError } from './game.js';
import { post } from './ledger.js';
import { CREDIT, TIERS, tierOf } from './rules/production.js';
import { P2P, p2pCut, p2pInterest, splitRepayment } from './rules/finance.js';

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const OPEN_DEBT = "('funded', 'late', 'defaulted')";

const q = {
  loan: db.prepare('SELECT * FROM p2p_loans WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO p2p_loans (borrower_id, amount, rate, term_days, bank_cut, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  fund: db.prepare("UPDATE p2p_loans SET lender_id = ?, status = 'funded', funded_at = ?, due_at = ?, owed = ? WHERE id = ? AND status = 'open'"),
  save: db.prepare('UPDATE p2p_loans SET status = ?, owed = ?, paid = ?, late_days = ?, closed_at = ? WHERE id = ?'),
  setStatus: db.prepare('UPDATE p2p_loans SET status = ?, closed_at = ? WHERE id = ?'),
  myActive: db.prepare(`SELECT COUNT(*) AS n FROM p2p_loans WHERE borrower_id = ? AND status IN ('open', 'funded', 'late', 'defaulted')`),
  myBad: db.prepare("SELECT COUNT(*) AS n FROM p2p_loans WHERE borrower_id = ? AND status IN ('late', 'defaulted')"),
  openList: db.prepare("SELECT l.*, u.username, u.credit FROM p2p_loans l JOIN users u ON u.id = l.borrower_id WHERE l.status = 'open' AND l.expires_at > ? ORDER BY l.created_at DESC LIMIT 40"),
  expired: db.prepare("SELECT * FROM p2p_loans WHERE status = 'open' AND expires_at <= ?"),
  due: db.prepare(`SELECT * FROM p2p_loans WHERE status IN ${OPEN_DEBT} AND due_at <= ? ORDER BY due_at`),
  asBorrower: db.prepare("SELECT * FROM p2p_loans WHERE borrower_id = ? AND (status IN ('open', 'funded', 'late', 'defaulted') OR closed_at >= ?) ORDER BY id DESC LIMIT 20"),
  asLender: db.prepare("SELECT * FROM p2p_loans WHERE lender_id = ? AND (status IN ('funded', 'late', 'defaulted') OR closed_at >= ?) ORDER BY id DESC LIMIT 20"),
  savings: db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?'),
  stats: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS volume FROM p2p_loans WHERE funded_at IS NOT NULL AND funded_at >= ?"),
};

const left = (loan) => loan.owed - loan.paid;
const bankLimit = (score) => tierOf(score).limit;

/** Người vay đăng một yêu cầu vay. */
export function requestP2P(userId, { amount, termDays, rate }, now = Date.now()) {
  return transaction(() => {
    const user = getUser(userId);
    if (now - user.created_at < P2P.minAccountDays * DAY) throw new GameError(`Tài khoản cần đủ ${P2P.minAccountDays * 24} giờ mới vay ngang hàng được.`);
    if (user.loan_ban_until > now) throw new GameError('Bạn đang bị cấm vay vì từng vỡ nợ.');
    if (q.myBad.get(userId).n) throw new GameError('Bạn còn khoản vay ngang hàng trễ hạn hoặc vỡ nợ, trả xong mới vay tiếp được.');
    if (!P2P.terms.includes(termDays)) throw new GameError(`Kỳ hạn chỉ có ${P2P.terms.join(', ')} ngày.`);
    const [lo, hi] = P2P.rateRange;
    if (!Number.isFinite(rate) || rate < lo || rate > hi) throw new GameError(`Lãi đặt từ ${(lo * 100).toFixed(1)}% đến ${(hi * 100).toFixed(1)}% mỗi ngày.`);
    const limit = bankLimit(user.credit) * P2P.limitMultiplier;
    if (!Number.isInteger(amount) || amount < P2P.minAmount || amount > limit) {
      throw new GameError(`Số tiền vay từ ${fmt(P2P.minAmount)} đến ${fmt(limit)} xu (gấp ${P2P.limitMultiplier} hạn mức hạng ${tierOf(user.credit).name}).`);
    }
    if (q.myActive.get(userId).n >= P2P.maxOpen) throw new GameError(`Mỗi người tối đa ${P2P.maxOpen} khoản vay ngang hàng đang chờ hoặc đang nợ.`);
    const cut = p2pCut(user.credit);
    q.insert.run(userId, amount, Math.round(rate * 10000) / 10000, termDays, cut, now, now + P2P.listDays * DAY);
    return { message: `Đã đăng yêu cầu vay ${fmt(amount)} xu, ${termDays} ngày, lãi ${(rate * 100).toFixed(2)}%/ngày. Ngân hàng giữ ${Math.round(cut * 100)}% tiền lãi làm phí trung gian.` };
  });
}

/** Người cho vay rót đủ vốn cho một yêu cầu: tiền chuyển thẳng sang ví người vay. */
export function fundP2P(lenderId, loanId, now = Date.now()) {
  return transaction(() => {
    const loan = q.loan.get(loanId);
    if (!loan || loan.status !== 'open' || loan.expires_at <= now) throw new GameError('Yêu cầu vay này không còn mở.');
    if (loan.borrower_id === lenderId) throw new GameError('Không tự cho mình vay được.');
    const borrower = getUser(loan.borrower_id);
    const memo = `Khoản P2P #${loan.id}`;
    post({ userId: lenderId, delta: -loan.amount, kind: 'p2p_lend', memo: `Cho ${borrower.username} vay · ${memo}`, now });
    post({ userId: loan.borrower_id, delta: loan.amount, kind: 'p2p_borrow', memo: `Vay của ${getUser(lenderId).username} · ${memo}`, now });
    const owed = loan.amount + p2pInterest(loan.amount, loan.rate, loan.term_days);
    q.fund.run(lenderId, now, now + loan.term_days * DAY, owed, loan.id);
    const net = Math.round((owed - loan.amount) * (1 - loan.bank_cut));
    return { message: `Đã cho ${borrower.username} vay ${fmt(loan.amount)} xu. Đúng hạn bạn nhận lại ${fmt(loan.amount + net)} xu (lãi ${fmt(net)} sau phí ngân hàng).` };
  });
}

export function cancelP2P(userId, loanId, now = Date.now()) {
  return transaction(() => {
    const loan = q.loan.get(loanId);
    if (!loan || loan.borrower_id !== userId || loan.status !== 'open') throw new GameError('Không hủy được yêu cầu này.');
    q.setStatus.run('cancelled', now, loan.id);
    return { message: 'Đã rút yêu cầu vay.' };
  });
}

/**
 * Thu tối đa `budget` xu của người vay cho khoản `loan` (ví trước, rồi tiết kiệm nếu `useSavings`):
 * chia gốc/lãi, ngân hàng giữ phần của mình, người cho vay nhận phần còn lại. Trả về số đã thu.
 */
function collect(loan, budget, now, { useSavings = false } = {}) {
  const wallet = getUser(loan.borrower_id).coins;
  const savings = useSavings ? q.savings.get(loan.borrower_id)?.savings ?? 0 : 0;
  const want = Math.min(left(loan), Math.max(0, Math.floor(budget)));
  const fromWallet = Math.min(wallet, want);
  const fromSavings = Math.min(savings, want - fromWallet);
  const got = fromWallet + fromSavings;
  if (got <= 0) return 0;
  const principalPaid = Math.min(loan.paid, loan.amount);
  const share = splitRepayment(got, { principalLeft: loan.amount - principalPaid, interestLeft: left(loan) - (loan.amount - principalPaid), cut: loan.bank_cut });
  const memo = `Khoản P2P #${loan.id}`;
  if (fromSavings) {
    post({ userId: loan.borrower_id, account: 'savings', delta: -fromSavings, kind: 'savings_out', memo, now });
    post({ userId: loan.borrower_id, delta: fromSavings, kind: 'savings_out', memo, now });
  }
  if (share.principal) post({ userId: loan.borrower_id, delta: -share.principal, kind: 'p2p_repay', memo, now });
  if (share.interest) post({ userId: loan.borrower_id, delta: -share.interest, kind: 'p2p_cost', memo, now });
  if (share.principal) post({ userId: loan.lender_id, delta: share.principal, kind: 'p2p_principal', memo, now });
  const lenderInterest = share.interest - share.bank;
  if (lenderInterest) post({ userId: loan.lender_id, delta: lenderInterest, kind: 'p2p_interest', memo, now });
  if (share.bank) post({ account: 'treasury', delta: share.bank, kind: 'p2p_bank_fee', memo, now });
  loan.paid += got;
  return got;
}

/** Người vay trả hết trước hạn (trả đủ lãi cả kỳ như đã thỏa thuận). */
export function repayP2P(userId, loanId, now = Date.now()) {
  return transaction(() => {
    const loan = q.loan.get(loanId);
    if (!loan || loan.borrower_id !== userId || !['funded', 'late', 'defaulted'].includes(loan.status)) throw new GameError('Không có khoản nợ này.');
    const need = left(loan);
    if (getUser(userId).coins < need) throw new GameError(`Cần ${fmt(need)} xu trong ví để trả hết khoản này.`);
    collect(loan, need, now);
    finish(loan, now);
    return { message: `Đã trả hết khoản vay ngang hàng #${loan.id}: ${fmt(need)} xu.` };
  });
}

/** Đã trả đủ thì đóng khoản, cộng điểm tín dụng; chưa thì lưu tiến độ. */
function finish(loan, now) {
  if (left(loan) <= 0) {
    if (loan.status !== 'defaulted') addCredit(loan.borrower_id, Math.round(CREDIT.repaid / 3), `Trả xong khoản vay ngang hàng #${loan.id}`, now);
    q.save.run('repaid', loan.owed, loan.paid, loan.late_days, now, loan.id);
    return true;
  }
  q.save.run(loan.status, loan.owed, loan.paid, loan.late_days, null, loan.id);
  return false;
}

/**
 * Cuối ngày: yêu cầu quá hạn đăng thì hết hạn; khoản đến hạn thì thu (ví rồi tiết kiệm). Thiếu thì trễ hạn: cộng phí trễ,
 * trừ điểm; trễ đủ `defaultAfter` ngày là vỡ nợ (trừ nặng, cấm vay), từ đó mỗi đêm ngân hàng giữ `garnish` số dư ví trả dần.
 */
export function settleP2PDay(day) {
  const end = startOfDay(day) + DAY;
  const at = end - 1;
  transaction(() => {
    for (const loan of q.expired.all(end)) q.setStatus.run('expired', at, loan.id);
    for (const loan of q.due.all(end)) {
      if (loan.status === 'defaulted') {
        collect(loan, getUser(loan.borrower_id).coins * P2P.garnish, at);
        finish(loan, at);
        continue;
      }
      collect(loan, left(loan), at, { useSavings: true });
      if (finish(loan, at)) continue;
      loan.owed += Math.ceil(left(loan) * P2P.lateFee);
      loan.late_days += 1;
      loan.status = 'late';
      addCredit(loan.borrower_id, CREDIT.late, `Trễ hạn khoản vay ngang hàng #${loan.id}`, at);
      if (loan.late_days >= P2P.defaultAfter) {
        loan.status = 'defaulted';
        addCredit(loan.borrower_id, CREDIT.defaulted, `Vỡ nợ khoản vay ngang hàng #${loan.id}`, at);
        db.prepare('UPDATE users SET loan_ban_until = ? WHERE id = ?').run(at + 14 * DAY, loan.borrower_id);
      }
      q.save.run(loan.status, loan.owed, loan.paid, loan.late_days, null, loan.id);
    }
  });
}

/** Dư nợ vay ngang hàng (cho bảng tài sản ròng) và phần đang cho vay. */
export function p2pPositions(userId) {
  const debt = db.prepare(`SELECT COALESCE(SUM(owed - paid), 0) AS s FROM p2p_loans WHERE borrower_id = ? AND status IN ${OPEN_DEBT}`).get(userId).s;
  const lent = db.prepare(`SELECT COALESCE(SUM(owed - paid), 0) AS s FROM p2p_loans WHERE lender_id = ? AND status IN ${OPEN_DEBT}`).get(userId).s;
  return { debt, lent };
}

const view = (l, now) => {
  const interest = p2pInterest(l.amount, l.rate, l.term_days);
  return {
    id: l.id,
    amount: l.amount,
    rate: l.rate,
    termDays: l.term_days,
    cut: l.bank_cut,
    status: l.status,
    interest,
    lenderGets: l.amount + Math.round(interest * (1 - l.bank_cut)),
    owed: l.owed,
    paid: l.paid,
    left: Math.max(0, l.owed - l.paid),
    lateDays: l.late_days,
    dueAt: l.due_at,
    expiresAt: l.expires_at,
    createdAt: l.created_at,
    borrower: getUser(l.borrower_id)?.username,
    lender: l.lender_id ? getUser(l.lender_id)?.username : null,
    overdue: Boolean(l.due_at && l.due_at <= now && l.status !== 'repaid'),
  };
};

export function p2pView(userId, now = Date.now()) {
  const user = getUser(userId);
  const since = now - 3 * DAY;
  const week = q.stats.get(now - 7 * DAY);
  return {
    rules: { ...P2P, tiers: TIERS.map((t) => ({ key: t.key, name: t.name, icon: t.icon, cut: P2P.cut[t.key] })) },
    me: { credit: user.credit, tier: tierOf(user.credit).name, cut: p2pCut(user.credit), limit: bankLimit(user.credit) * P2P.limitMultiplier, banned: user.loan_ban_until > now },
    market: q.openList.all(now).map((l) => ({ ...view(l, now), mine: l.borrower_id === userId, credit: l.credit, tierIcon: tierOf(l.credit).icon })),
    borrowing: q.asBorrower.all(userId, since).map((l) => view(l, now)),
    lending: q.asLender.all(userId, since).map((l) => view(l, now)),
    week: { loans: week.n, volume: week.volume },
    today: dayKey(now),
  };
}
