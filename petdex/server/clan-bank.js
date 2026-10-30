// Ngân hàng gia tộc: gia tộc nắm ngành Ngân hàng nhà nước (state_bank) mở ngân hàng riêng.
// - Tiền gửi kỳ hạn 7/14/30 ngày của người chơi, lãi do tộc trưởng đặt (tối đa 3 × lãi tiết kiệm NPC). Tiền nằm ở tài khoản
//   vốn 'bank:<clanId>', không lẫn với quỹ gia tộc; luôn giữ tối thiểu 20% tiền gửi làm tiền mặt khi cho vay hay rút vốn.
// - Rút tiền khi tiền mặt không đủ: lệnh rút xếp hàng, lên báo, uy tín ngân hàng giảm. Xếp hàng quá 3 đêm: ngân hàng đổ vỡ,
//   tiền mặt chia theo tỉ lệ gốc, quỹ bảo hiểm tiền gửi (nuôi bằng phí) bù tới 80% phần thiếu.
// - Cho gia tộc khác vay có thế chấp lô đất (tối đa 60% giá trị), không cho chính mình hay gia tộc liên quan vay.
//   Vỡ nợ: ngân hàng siết lô, giữ lại hoặc đưa ra đấu giá 24 giờ; không ai mua thì Sở Nhà Đất mua lại.
// Luật và con số ở public/ta-tua/game/js/shared/clan-bank.js (wiki đọc thẳng từ đó).
import { economy } from './bank.js';
import { adminLog, db, getMeta, getUser, setMeta, transaction } from './db.js';
import { dayKey } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { chargeFinanceTax, post } from './ledger.js';
import { breakDepositsFor, isDeposed } from './clan-gov.js';
import { plotCollateral, plotRoom, releasePlotToLand, transferPlot } from './clans.js';
import {
  CBANK, balanceSheet, depositPayout, failurePayout, loanRateRange, maxDepositRate, maxLoanOn, simpleInterest,
} from '../../public/ta-tua/game/js/shared/clan-bank.js';

export const INSURANCE = 'cbank_insurance';
const FREEZE = 'cbank_frozen';
const bankAccount = (id) => `bank:${id}`;
const clanAccount = (id) => `clan:${id}`;
const escrowAccount = (id) => `cbank_escrow:${id}`;
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const pctDay = (r) => `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}%/ngày`;
const OPEN_LOAN = "('active', 'late')";

const q = {
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  isHolder: db.prepare("SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = 'state_bank'"),

  bank: db.prepare('SELECT * FROM cbank_banks WHERE clan_id = ?'),
  banks: db.prepare('SELECT b.*, c.name, c.emblem, c.color, c.dissolved_at FROM cbank_banks b JOIN clans c ON c.id = b.clan_id ORDER BY b.opened_at'),
  insertBank: db.prepare(`
    INSERT INTO cbank_banks (clan_id, status, deposit_rates, loan_rate, lending_open, reputation, opened_at) VALUES (?, 'open', ?, ?, 0, ?, ?)
    ON CONFLICT (clan_id) DO UPDATE SET status = 'open', deposit_rates = excluded.deposit_rates, loan_rate = excluded.loan_rate,
      lending_open = 0, reputation = excluded.reputation, opened_at = excluded.opened_at, failed_at = NULL, run_day = NULL`),
  setTerms: db.prepare('UPDATE cbank_banks SET deposit_rates = ?, loan_rate = ?, lending_open = ? WHERE clan_id = ?'),
  setReputation: db.prepare('UPDATE cbank_banks SET reputation = ?, run_day = COALESCE(?, run_day) WHERE clan_id = ?'),
  setFrozen: db.prepare('UPDATE cbank_banks SET frozen = ? WHERE clan_id = ?'),
  failBank: db.prepare("UPDATE cbank_banks SET status = 'failed', failed_at = ?, lending_open = 0 WHERE clan_id = ?"),

  deposit: db.prepare('SELECT * FROM cbank_deposits WHERE id = ?'),
  insertDeposit: db.prepare(`
    INSERT INTO cbank_deposits (bank_id, user_id, amount, rate, term_days, opened_at, matures_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  liveDeposits: db.prepare("SELECT * FROM cbank_deposits WHERE bank_id = ? AND status IN ('open', 'queued') ORDER BY id"),
  depositTotal: db.prepare("SELECT COALESCE(SUM(amount), 0) AS total, COUNT(DISTINCT user_id) AS people FROM cbank_deposits WHERE bank_id = ? AND status IN ('open', 'queued')"),
  userAtBank: db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM cbank_deposits WHERE bank_id = ? AND user_id = ? AND status IN ('open', 'queued')"),
  userLive: db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM cbank_deposits WHERE user_id = ? AND status IN ('open', 'queued')"),
  myDeposits: db.prepare(`
    SELECT d.*, c.name AS bank_name, c.emblem FROM cbank_deposits d JOIN clans c ON c.id = d.bank_id
    WHERE d.user_id = ? AND (d.status IN ('open', 'queued') OR d.closed_at >= ?) ORDER BY d.id DESC LIMIT 30`),
  queue: db.prepare("SELECT * FROM cbank_deposits WHERE bank_id = ? AND status = 'queued' ORDER BY queued_at, id"),
  queueSum: db.prepare("SELECT COALESCE(SUM(payout), 0) AS total, COUNT(*) AS n, MIN(queued_at) AS oldest FROM cbank_deposits WHERE bank_id = ? AND status = 'queued'"),
  matured: db.prepare("SELECT * FROM cbank_deposits WHERE bank_id = ? AND status = 'open' AND matures_at <= ? ORDER BY matures_at, id"),
  queueDeposit: db.prepare("UPDATE cbank_deposits SET status = 'queued', queued_at = ?, payout = ? WHERE id = ? AND status = 'open'"),
  closeDeposit: db.prepare('UPDATE cbank_deposits SET status = ?, payout = ?, insured = ?, closed_at = ? WHERE id = ?'),

  loan: db.prepare('SELECT * FROM cbank_loans WHERE id = ?'),
  insertLoan: db.prepare(`
    INSERT INTO cbank_loans (bank_id, clan_id, plot_id, amount, rate, term_days, collateral, owed, opened_at, due_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  loanOutstanding: db.prepare(`SELECT COALESCE(SUM(owed - paid), 0) AS total FROM cbank_loans WHERE bank_id = ? AND status IN ${OPEN_LOAN}`),
  bankLoans: db.prepare(`
    SELECT l.*, c.name AS clan_name, c.emblem FROM cbank_loans l JOIN clans c ON c.id = l.clan_id
    WHERE l.bank_id = ? AND (l.status IN ${OPEN_LOAN} OR l.closed_at >= ?) ORDER BY l.id DESC LIMIT 40`),
  clanLoans: db.prepare(`
    SELECT l.*, c.name AS bank_name, c.emblem FROM cbank_loans l JOIN clans c ON c.id = l.bank_id
    WHERE l.clan_id = ? AND (l.status IN ${OPEN_LOAN} OR l.closed_at >= ?) ORDER BY l.id DESC LIMIT 20`),
  clanOpenLoans: db.prepare(`SELECT COUNT(*) AS n FROM cbank_loans WHERE clan_id = ? AND status IN ${OPEN_LOAN}`),
  dueLoans: db.prepare(`SELECT * FROM cbank_loans WHERE status IN ${OPEN_LOAN} AND due_at <= ? ORDER BY due_at, id`),
  liveLoansOf: db.prepare(`SELECT * FROM cbank_loans WHERE clan_id = ? AND status IN ${OPEN_LOAN}`),
  plotPledged: db.prepare(`
    SELECT 1 FROM cbank_loans WHERE plot_id = ? AND status IN ${OPEN_LOAN}
    UNION ALL SELECT 1 FROM cbank_auctions WHERE plot_id = ? AND status = 'open' LIMIT 1`),
  saveLoan: db.prepare('UPDATE cbank_loans SET owed = ?, paid = ?, late_nights = ?, status = ?, closed_at = ? WHERE id = ?'),
  allLoans: db.prepare(`
    SELECT l.*, b.name AS bank_name, c.name AS clan_name FROM cbank_loans l JOIN clans b ON b.id = l.bank_id JOIN clans c ON c.id = l.clan_id
    ORDER BY CASE WHEN l.status IN ${OPEN_LOAN} THEN 0 ELSE 1 END, l.id DESC LIMIT 100`),
  defaults: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(owed - paid), 0) AS lost FROM cbank_loans WHERE bank_id = ? AND status IN ('defaulted', 'written_off')"),

  auction: db.prepare('SELECT * FROM cbank_auctions WHERE id = ?'),
  openAuctions: db.prepare(`
    SELECT a.*, d.name AS debtor_name, b.name AS bank_name, t.name AS top_name FROM cbank_auctions a
    JOIN clans d ON d.id = a.debtor_id JOIN clans b ON b.id = a.bank_id LEFT JOIN clans t ON t.id = a.top_clan
    WHERE a.status = 'open' ORDER BY a.ends_at`),
  dueAuctions: db.prepare("SELECT * FROM cbank_auctions WHERE status = 'open' AND ends_at <= ? ORDER BY ends_at, id"),
  auctionsOfClan: db.prepare("SELECT * FROM cbank_auctions WHERE status = 'open' AND (top_clan = ? OR debtor_id = ?)"),
  insertAuction: db.prepare(`
    INSERT INTO cbank_auctions (loan_id, plot_id, bank_id, debtor_id, owed, start_price, created_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  bid: db.prepare("UPDATE cbank_auctions SET top_bid = ?, top_clan = ?, bids = bids + 1 WHERE id = ? AND status = 'open' AND COALESCE(top_bid, 0) = ?"),
  closeAuction: db.prepare('UPDATE cbank_auctions SET status = ?, closed_at = ?, proceeds = ? WHERE id = ?'),
  clearBid: db.prepare('UPDATE cbank_auctions SET top_bid = NULL, top_clan = NULL WHERE id = ?'),
  clanPlotIds: db.prepare('SELECT id FROM land_plots WHERE clan_id = ? ORDER BY id'),
  heldBids: db.prepare("SELECT COALESCE(SUM(top_bid), 0) AS total FROM cbank_auctions WHERE status = 'open' AND top_clan = ?"),

  // Liên quan: có người ra vào giữa hai gia tộc trong `relatedDays` ngày, hoặc có thành viên vào game qua cùng một link mời.
  crossed: db.prepare(`
    SELECT 1 FROM clan_member_log l JOIN clan_members m ON m.user_id = l.user_id
    WHERE ((m.clan_id = ? AND l.clan_id = ?) OR (m.clan_id = ? AND l.clan_id = ?)) AND l.at >= ? LIMIT 1`),
  sameInvite: db.prepare(`
    SELECT 1 FROM clan_members a JOIN users ua ON ua.id = a.user_id
    JOIN users ub ON ub.invite_id = ua.invite_id JOIN clan_members b ON b.user_id = ub.id
    WHERE a.clan_id = ? AND b.clan_id = ? AND ua.invite_id IS NOT NULL LIMIT 1`),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const balanceOf = (account) => q.account.get(account)?.balance ?? 0;
const cashOf = (bankId) => balanceOf(bankAccount(bankId));
export const insuranceFund = () => balanceOf(INSURANCE);
export const globalFrozen = () => getMeta(FREEZE) === '1';
const news = (headline, now) => q.insertNews.run(headline, now, now, now + DAY);
const ratesOf = (bank) => {
  try {
    return JSON.parse(bank.deposit_rates) ?? {};
  } catch {
    return {};
  }
};

/** Bảng cân đối hiện tại của một ngân hàng. */
export function sheetOf(bankId) {
  const deposits = q.depositTotal.get(bankId);
  const queued = q.queueSum.get(bankId);
  return {
    ...balanceSheet({ cash: cashOf(bankId), loans: q.loanOutstanding.get(bankId).total, deposits: deposits.total }),
    depositors: deposits.people,
    queued: queued.total,
    queuedCount: queued.n,
    queuedSince: queued.oldest,
  };
}

/** Lô đang thế chấp hoặc đang bị đấu giá siết nợ (không bán được). */
export const plotPledged = (plotId) => Boolean(q.plotPledged.get(plotId, plotId));
/** Tổng tiền gửi đang mở của người chơi ở các ngân hàng gia tộc (tính vào tài sản ròng). */
export const clanBankDeposits = (userId) => q.userLive.get(userId).total;

/** Hai gia tộc có liên quan (cùng nhau, có người ra vào trong 14 ngày, hoặc thành viên vào game qua cùng một link mời). */
export function clansRelated(a, b, now = Date.now()) {
  if (a === b) return true;
  const since = now - CBANK.relatedDays * DAY;
  return Boolean(q.crossed.get(a, b, b, a, since) || q.sameInvite.get(a, b));
}

function clanOf(userId) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  return { clan, member: m };
}

function mustLeader(userId, what, roles = ['leader']) {
  const ctx = clanOf(userId);
  if (!roles.includes(ctx.member.role) || isDeposed(ctx.clan.id, userId)) {
    throw new GameError(`Chỉ ${roles.includes('elder') ? 'tộc trưởng hoặc trưởng lão' : 'tộc trưởng'} mới được ${what}.`);
  }
  return ctx;
}

/** Ngân hàng của gia tộc mình (tộc trưởng). */
function myBank(userId, what) {
  const { clan } = mustLeader(userId, what);
  const bank = q.bank.get(clan.id);
  if (!bank || bank.status !== 'open') throw new GameError('Gia tộc chưa mở ngân hàng.');
  return { clan, bank };
}

/** Ngân hàng có đang nhận việc mới không: đang mở, chưa bị phong tỏa, gia tộc còn nắm Ngân hàng nhà nước. */
function bankState(bank) {
  if (!bank || bank.status !== 'open') return { ok: false, why: 'Ngân hàng đã đóng cửa.' };
  if (globalFrozen() || bank.frozen) return { ok: false, frozen: true, why: 'Ngân hàng đang bị phong tỏa khẩn cấp.' };
  if (!q.isHolder.get(bank.clan_id)) return { ok: false, runoff: true, why: 'Gia tộc không còn nắm Ngân hàng nhà nước: chỉ trả tiền gửi và thu nợ cũ.' };
  return { ok: true };
}

function mustOperate(bank) {
  const s = bankState(bank);
  if (!s.ok) throw new GameError(s.why);
}

function mustNotFrozen(bank) {
  if (globalFrozen() || bank?.frozen) throw new GameError('Ngân hàng đang bị phong tỏa khẩn cấp, tạm thời chưa rút được.');
}

// ---------------------------------------------------------------- quản lý ngân hàng (tộc trưởng gia tộc chủ)

/** Mở ngân hàng: chuyển vốn chủ từ quỹ gia tộc vào tài khoản vốn, lãi mặc định bằng lãi tiết kiệm NPC. */
export function openBank(userId, capital, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'mở ngân hàng');
    if (!q.isHolder.get(clan.id)) throw new GameError('Chỉ gia tộc nắm ngành Ngân hàng nhà nước mới mở được ngân hàng.');
    const old = q.bank.get(clan.id);
    if (old?.status === 'open') throw new GameError('Gia tộc đã có ngân hàng.');
    if (old && (q.liveDeposits.all(clan.id).length || q.loanOutstanding.get(clan.id).total)) throw new GameError('Ngân hàng cũ còn khoản gửi hoặc khoản vay chưa xong.');
    if (!Number.isInteger(capital) || capital < CBANK.minCapital) throw new GameError(`Vốn mở ngân hàng tối thiểu ${fmt(CBANK.minCapital)} xu.`);
    if (balanceOf(clanAccount(clan.id)) < capital) throw new GameError(`Quỹ gia tộc chỉ còn ${fmt(balanceOf(clanAccount(clan.id)))} xu.`);
    const base = economy().baseRate;
    const rates = Object.fromEntries(CBANK.terms.map((t) => [t, base]));
    post({ account: clanAccount(clan.id), delta: -capital, kind: 'cbank_capital_in', memo: 'Mở ngân hàng gia tộc', now });
    post({ account: bankAccount(clan.id), delta: capital, kind: 'cbank_capital_in', memo: 'Vốn chủ ban đầu', now });
    // Mở lại sau khi đổ vỡ: uy tín chỉ còn một nửa.
    q.insertBank.run(clan.id, JSON.stringify(rates), loanRateRange(base)[0] * 2, old ? CBANK.reputation.start / 2 : CBANK.reputation.start, now);
    news(`🏦 Ngân hàng ${clan.emblem} ${clan.name} mở cửa nhận tiền gửi`, now);
    return { message: `🏦 Đã mở ngân hàng với vốn ${fmt(capital)} xu.` };
  });
}

/** Tộc trưởng đặt lãi tiền gửi từng kỳ hạn, lãi cho vay và bật/tắt cho vay. */
export function setBankTerms(userId, { rates = {}, loanRate, lendingOpen }, now = Date.now()) {
  return transaction(() => {
    const { clan, bank } = myBank(userId, 'đặt lãi ngân hàng');
    const base = economy().baseRate;
    const cap = maxDepositRate(base);
    const next = { ...ratesOf(bank) };
    for (const t of CBANK.terms) {
      if (rates[t] === undefined) continue;
      const r = Number(rates[t]);
      if (!Number.isFinite(r) || r < 0 || r > cap + 1e-12) throw new GameError(`Lãi tiền gửi từ 0 tới ${pctDay(cap)} (3 lần lãi tiết kiệm hiện tại).`);
      next[t] = Math.round(r * 1e7) / 1e7;
    }
    let lr = bank.loan_rate;
    if (loanRate !== undefined) {
      const [lo, hi] = loanRateRange(base);
      lr = Number(loanRate);
      if (!Number.isFinite(lr) || lr < lo - 1e-12 || lr > hi + 1e-12) throw new GameError(`Lãi cho vay từ ${pctDay(lo)} tới ${pctDay(hi)}.`);
      lr = Math.round(lr * 1e7) / 1e7;
    }
    const open = lendingOpen === undefined ? bank.lending_open : lendingOpen ? 1 : 0;
    q.setTerms.run(JSON.stringify(next), lr, open, clan.id);
    return { message: 'Đã cập nhật lãi suất ngân hàng.', at: now };
  });
}

/** Góp thêm vốn từ quỹ gia tộc ('in') hoặc rút vốn về quỹ ('out'). Rút vốn phải giữ đủ tiền mặt tối thiểu và trần tiền gửi. */
export function moveBankCapital(userId, action, amount, now = Date.now()) {
  return transaction(() => {
    const { clan, bank } = myBank(userId, 'chuyển vốn ngân hàng');
    if (!Number.isInteger(amount) || amount < 1) throw new GameError('Số tiền không hợp lệ.');
    if (action === 'in') {
      if (balanceOf(clanAccount(clan.id)) < amount) throw new GameError(`Quỹ gia tộc chỉ còn ${fmt(balanceOf(clanAccount(clan.id)))} xu.`);
      post({ account: clanAccount(clan.id), delta: -amount, kind: 'cbank_capital_in', memo: 'Góp vốn ngân hàng', now });
      post({ account: bankAccount(clan.id), delta: amount, kind: 'cbank_capital_in', memo: 'Góp vốn từ quỹ gia tộc', now });
      drainQueue(bank, now);
      return { message: `Đã góp ${fmt(amount)} xu vào vốn ngân hàng.` };
    }
    if (action !== 'out') throw new GameError('Thao tác không hợp lệ.');
    mustNotFrozen(bank);
    const s = sheetOf(clan.id);
    if (s.queuedCount) throw new GameError('Còn người xếp hàng rút tiền, trả hết cho họ trước đã.');
    if (s.cash - amount < s.floor) throw new GameError(`Phải giữ tối thiểu ${fmt(s.floor)} xu tiền mặt (20% tiền gửi). Rút được tối đa ${fmt(Math.max(0, s.cash - s.floor))} xu.`);
    if (s.deposits > (s.equity - amount) * CBANK.leverage) throw new GameError(`Tiền gửi không được quá ${CBANK.leverage} lần vốn chủ: rút số này thì vốn chủ không đủ.`);
    post({ account: bankAccount(clan.id), delta: -amount, kind: 'cbank_capital_out', memo: 'Rút vốn về quỹ gia tộc', now });
    post({ account: clanAccount(clan.id), delta: amount, kind: 'cbank_capital_out', memo: 'Rút vốn ngân hàng', now });
    return { message: `Đã rút ${fmt(amount)} xu vốn ngân hàng về quỹ.` };
  });
}

// ---------------------------------------------------------------- tiền gửi của người chơi

/** Người chơi gửi kỳ hạn vào ngân hàng gia tộc. Ngân hàng nộp 1% vào quỹ bảo hiểm tiền gửi. */
export function depositAtBank(userId, bankId, amount, term, now = Date.now()) {
  return transaction(() => {
    const bank = q.bank.get(bankId);
    mustOperate(bank);
    if (!CBANK.terms.includes(term)) throw new GameError(`Kỳ hạn chỉ có ${CBANK.terms.join(', ')} ngày.`);
    if (!Number.isInteger(amount) || amount < CBANK.minDeposit) throw new GameError(`Gửi tối thiểu ${fmt(CBANK.minDeposit)} xu.`);
    if (bank.reputation < CBANK.minReputation) throw new GameError(`Uy tín ngân hàng dưới ${CBANK.minReputation}, tạm không nhận tiền gửi mới.`);
    const s = sheetOf(bankId);
    if (s.queuedCount) throw new GameError('Ngân hàng đang có người xếp hàng rút tiền, tạm không nhận tiền gửi mới.');
    const mine = q.userAtBank.get(bankId, userId).total;
    if (mine + amount > CBANK.maxPerDepositor) throw new GameError(`Mỗi người gửi tối đa ${fmt(CBANK.maxPerDepositor)} xu ở một ngân hàng (bạn đang gửi ${fmt(mine)}).`);
    const premium = Math.ceil(amount * CBANK.insurancePremium);
    if (s.deposits + amount > Math.max(0, s.equity - premium) * CBANK.leverage) throw new GameError('Ngân hàng đã nhận đủ tiền gửi so với vốn chủ, chưa nhận thêm được.');
    const rate = Math.min(Number(ratesOf(bank)[term] ?? 0), maxDepositRate(economy().baseRate));
    if (!(rate > 0)) throw new GameError(`Ngân hàng chưa mở kỳ hạn ${term} ngày.`);
    const clan = q.clan.get(bankId);
    post({ userId, delta: -amount, kind: 'cbank_deposit', memo: `${clan.name} · kỳ hạn ${term} ngày`, now });
    post({ account: bankAccount(bankId), delta: amount, kind: 'cbank_deposit', memo: `${getUser(userId)?.username ?? ''} gửi ${term} ngày`, now });
    post({ account: bankAccount(bankId), delta: -premium, kind: 'cbank_insurance', memo: 'Phí bảo hiểm tiền gửi', now });
    post({ account: INSURANCE, delta: premium, kind: 'cbank_insurance', memo: `Phí bảo hiểm từ ngân hàng ${clan.name}`, now });
    q.insertDeposit.run(bankId, userId, amount, rate, term, now, now + term * DAY);
    return { message: `🏦 Đã gửi ${fmt(amount)} xu ở ngân hàng ${clan.name}, ${term} ngày, lãi ${pctDay(rate)}: đáo hạn nhận thêm ${fmt(simpleInterest(amount, rate, term))} xu.` };
  });
}

/** Trả một khoản (đã chốt số tiền `total`) từ tiền mặt ngân hàng cho người gửi. */
function payOut(dep, total, now, status = 'closed') {
  const interest = Math.max(0, total - dep.amount);
  const principal = total - interest;
  post({ account: bankAccount(dep.bank_id), delta: -total, kind: 'cbank_withdraw', memo: `Khoản gửi #${dep.id}`, now });
  post({ userId: dep.user_id, delta: principal, kind: 'cbank_withdraw', memo: `Khoản gửi #${dep.id}`, now });
  if (interest) {
    post({ userId: dep.user_id, delta: interest, kind: 'cbank_interest', memo: `Lãi ${dep.term_days} ngày, khoản #${dep.id}`, now });
    chargeFinanceTax(dep.user_id, interest, `Lãi khoản gửi #${dep.id}`, now);
  }
  q.closeDeposit.run(status, total, 0, now, dep.id);
}

/** Lệnh rút không đủ tiền mặt: xếp hàng, uy tín giảm (một lần mỗi ngày), lên báo. */
function queueWithdrawal(bank, dep, total, now) {
  q.queueDeposit.run(now, total, dep.id);
  const day = dayKey(now);
  if (bank.run_day !== day) {
    const rep = Math.max(0, bank.reputation - CBANK.reputation.runDrop);
    q.setReputation.run(rep, day, bank.clan_id);
    const clan = q.clan.get(bank.clan_id);
    news(`🚨 Người gửi xếp hàng rút tiền ở ngân hàng ${clan?.emblem ?? ''} ${clan?.name ?? ''}: tiền mặt không đủ trả, uy tín còn ${rep}`, now);
  }
}

/** Trả dần hàng chờ rút theo thứ tự, dừng ở người đầu tiên chưa đủ tiền trả. */
function drainQueue(bank, now) {
  if (!bank || globalFrozen() || bank.frozen) return 0;
  let n = 0;
  for (const dep of q.queue.all(bank.clan_id)) {
    if (cashOf(bank.clan_id) < dep.payout) break;
    payOut(dep, dep.payout, now);
    n += 1;
  }
  return n;
}

/** Người gửi rút một khoản: đủ hạn nhận gốc + lãi, trước hạn chỉ nhận gốc. Tiền mặt không đủ thì xếp hàng. */
export function withdrawFromBank(userId, depositId, now = Date.now()) {
  return transaction(() => {
    const dep = q.deposit.get(depositId);
    if (!dep || dep.user_id !== userId || dep.status !== 'open') throw new GameError('Không tìm thấy khoản gửi này.');
    const bank = q.bank.get(dep.bank_id);
    mustNotFrozen(bank);
    const { total, interest } = depositPayout(dep, now);
    // Đã có người xếp hàng thì phải chờ sau họ, kể cả khi tiền mặt vừa đủ cho khoản này.
    if (!q.queueSum.get(dep.bank_id).n && cashOf(dep.bank_id) >= total) {
      payOut(dep, total, now);
      return { message: interest ? `Đã nhận ${fmt(dep.amount)} gốc + ${fmt(interest)} lãi.` : `Rút trước hạn: nhận lại ${fmt(dep.amount)} xu, không có lãi.` };
    }
    queueWithdrawal(bank, dep, total, now);
    return { message: `Ngân hàng chưa đủ tiền mặt: lệnh rút ${fmt(total)} xu đã xếp hàng, sẽ được trả khi ngân hàng có tiền.` };
  });
}

// ---------------------------------------------------------------- cho vay thế chấp

/** Tộc trưởng gia tộc vay tiền ngân hàng, thế chấp một lô đất của gia tộc. */
export function borrowFromBank(userId, { bankId, plotId, amount, term }, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'vay ngân hàng gia tộc');
    const bank = q.bank.get(bankId);
    mustOperate(bank);
    if (!bank.lending_open) throw new GameError('Ngân hàng này chưa mở cho vay.');
    if (clansRelated(clan.id, bankId, now)) throw new GameError('Ngân hàng không cho chính gia tộc mình hay gia tộc có liên quan vay (có người qua lại trong 14 ngày hoặc vào game qua cùng một link mời).');
    if (!CBANK.loan.terms.includes(term)) throw new GameError(`Kỳ hạn vay chỉ có ${CBANK.loan.terms.join(', ')} ngày.`);
    if (q.clanOpenLoans.get(clan.id).n >= CBANK.loan.maxOpen) throw new GameError(`Mỗi gia tộc nợ tối đa ${CBANK.loan.maxOpen} khoản cùng lúc.`);
    const c = plotCollateral(plotId, now);
    if (!c || c.row.clan_id !== clan.id) throw new GameError('Lô này không thuộc gia tộc của bạn.');
    if (plotPledged(c.plot.id)) throw new GameError('Lô này đang thế chấp rồi.');
    const cap = maxLoanOn(c.value);
    if (!Number.isInteger(amount) || amount < CBANK.loan.minAmount || amount > cap) {
      throw new GameError(`Vay từ ${fmt(CBANK.loan.minAmount)} tới ${fmt(cap)} xu (60% giá trị thế chấp ${fmt(c.value)} xu của lô ${c.plot.code}).`);
    }
    const s = sheetOf(bankId);
    if (s.queuedCount || s.cash - amount < s.floor) throw new GameError(`Ngân hàng chỉ cho vay được ${fmt(Math.max(0, s.cash - s.floor))} xu lúc này (phải giữ 20% tiền gửi làm tiền mặt).`);
    const rate = bank.loan_rate;
    const owed = amount + simpleInterest(amount, rate, term);
    const fee = Math.ceil(amount * CBANK.loan.fee);
    const bankClan = q.clan.get(bankId);
    post({ account: bankAccount(bankId), delta: -amount, kind: 'cbank_loan', memo: `Cho ${clan.name} vay, thế chấp lô ${c.plot.code}`, now });
    post({ account: clanAccount(clan.id), delta: amount, kind: 'cbank_loan', memo: `Vay ngân hàng ${bankClan.name}, thế chấp lô ${c.plot.code}`, now });
    post({ account: clanAccount(clan.id), delta: -fee, kind: 'cbank_loan_fee', memo: 'Phí giải ngân 1%', now });
    post({ account: INSURANCE, delta: fee, kind: 'cbank_loan_fee', memo: `Phí giải ngân khoản vay của ${clan.name}`, now });
    q.insertLoan.run(bankId, clan.id, c.plot.id, amount, rate, term, c.value, owed, now, now + term * DAY);
    return { message: `🏦 Đã vay ${fmt(amount)} xu của ngân hàng ${bankClan.name}, ${term} ngày. Đáo hạn trả ${fmt(owed)} xu; lô ${c.plot.code} thế chấp tới khi trả xong.` };
  });
}

/** Ghi một khoản trả nợ vào ngân hàng (ngân hàng đã đổ vỡ thì vào quỹ bảo hiểm). */
function collect(loan, amount, now, memo) {
  if (amount <= 0) return 0;
  const bank = q.bank.get(loan.bank_id);
  const to = bank?.status === 'open' ? bankAccount(loan.bank_id) : INSURANCE;
  post({ account: clanAccount(loan.clan_id), delta: -amount, kind: 'cbank_repay', memo, now });
  post({ account: to, delta: amount, kind: 'cbank_repay', memo: `${memo} (${q.clan.get(loan.clan_id)?.name ?? ''})`, now });
  const paid = loan.paid + amount;
  const done = paid >= loan.owed;
  q.saveLoan.run(loan.owed, paid, loan.late_nights, done ? 'repaid' : loan.status, done ? now : null, loan.id);
  if (bank?.status === 'open') drainQueue(q.bank.get(loan.bank_id), now);
  return amount;
}

/** Tộc trưởng hoặc trưởng lão trả nợ từ quỹ gia tộc (trả một phần hoặc hết). */
export function repayBankLoan(userId, loanId, amount = null, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'trả nợ ngân hàng', ['leader', 'elder']);
    const loan = q.loan.get(loanId);
    if (!loan || loan.clan_id !== clan.id || !['active', 'late'].includes(loan.status)) throw new GameError('Không tìm thấy khoản vay này.');
    const left = loan.owed - loan.paid;
    const pay = Math.min(left, amount ?? left);
    if (!Number.isInteger(pay) || pay < 1) throw new GameError('Số tiền không hợp lệ.');
    if (balanceOf(clanAccount(clan.id)) < pay) throw new GameError(`Quỹ gia tộc chỉ còn ${fmt(balanceOf(clanAccount(clan.id)))} xu.`);
    collect(loan, pay, now, `Trả nợ khoản vay #${loan.id}`);
    return { message: pay === left ? `Đã trả hết khoản vay #${loan.id}, lô được giải chấp.` : `Đã trả ${fmt(pay)} xu, còn nợ ${fmt(left - pay)} xu.` };
  });
}

/** Vỡ nợ: siết lô thế chấp ra đấu giá 24 giờ; lô không còn trong tay gia tộc vay thì xóa nợ. */
function defaultLoan(loan, now) {
  const left = loan.owed - loan.paid;
  const c = plotCollateral(loan.plot_id, now);
  const debtor = q.clan.get(loan.clan_id);
  const bankClan = q.clan.get(loan.bank_id);
  if (!c || c.row.clan_id !== loan.clan_id) {
    q.saveLoan.run(loan.owed, loan.paid, loan.late_nights, 'written_off', now, loan.id);
    news(`💸 ${debtor?.name ?? 'Một gia tộc'} vỡ nợ ngân hàng ${bankClan?.name ?? ''}, lô thế chấp không còn: ngân hàng mất ${fmt(left)} xu`, now);
    return;
  }
  q.saveLoan.run(loan.owed, loan.paid, loan.late_nights, 'defaulted', now, loan.id);
  const start = Math.max(1, Math.round(c.value * CBANK.auction.startShare));
  q.insertAuction.run(loan.id, c.plot.id, loan.bank_id, loan.clan_id, left, start, now, now + CBANK.auction.hours * HOUR);
  news(`🔨 ${debtor?.name ?? 'Một gia tộc'} vỡ nợ: ngân hàng ${bankClan?.name ?? ''} siết lô ${c.plot.code}, đấu giá từ ${fmt(start)} xu`, now);
}

/** Đêm đáo hạn: tự thu từ quỹ gia tộc vay (phá cả tiền gửi kỳ hạn của quỹ), thiếu thì tính trễ, quá ân hạn thì vỡ nợ. */
function settleLoans(endTs) {
  for (const loan of q.dueLoans.all(endTs)) {
    const left = loan.owed - loan.paid;
    const have = breakDepositsFor(loan.clan_id, left, `trả nợ ngân hàng gia tộc`, endTs);
    const got = collect(loan, Math.min(left, have), endTs, `Thu nợ đáo hạn khoản #${loan.id}`);
    if (got >= left) continue;
    const fresh = q.loan.get(loan.id);
    const nights = fresh.late_nights + 1;
    if (nights > CBANK.loan.graceNights) {
      q.saveLoan.run(fresh.owed, fresh.paid, nights, fresh.status, null, fresh.id);
      defaultLoan({ ...fresh, late_nights: nights }, endTs);
      continue;
    }
    const lateFee = Math.ceil((fresh.owed - fresh.paid) * CBANK.loan.lateFee);
    q.saveLoan.run(fresh.owed + lateFee, fresh.paid, nights, 'late', null, fresh.id);
  }
}

// ---------------------------------------------------------------- lô siết nợ: giữ lại hoặc đấu giá

/** Ngân hàng giữ lại lô siết nợ thay cho tiền (chỉ khi chưa ai trả giá và gia tộc còn chỗ chứa lô). */
export function keepSeizedPlot(userId, auctionId, now = Date.now()) {
  return transaction(() => {
    const { clan } = myBank(userId, 'giữ lô siết nợ');
    const a = q.auction.get(auctionId);
    if (!a || a.bank_id !== clan.id || a.status !== 'open') throw new GameError('Không tìm thấy phiên đấu giá này.');
    if (a.top_clan) throw new GameError('Đã có gia tộc trả giá, phải để phiên chạy tới hết giờ.');
    if (plotRoom(clan.id) < 1) throw new GameError('Gia tộc đã giữ đủ số lô theo cấp.');
    const c = plotCollateral(a.plot_id, now);
    if (!c || c.row.clan_id !== a.debtor_id) {
      q.closeAuction.run('npc', now, 0, a.id);
      throw new GameError('Lô không còn trong tay gia tộc vỡ nợ.');
    }
    transferPlot(a.plot_id, clan.id, c.land, now);
    q.closeAuction.run('kept', now, 0, a.id);
    news(`🏦 Ngân hàng ${clan.name} giữ lại lô ${c.plot.code} siết nợ của ${q.clan.get(a.debtor_id)?.name ?? ''}`, now);
    return { message: `Đã nhận lô ${c.plot.code} về gia tộc thay cho khoản nợ.` };
  });
}

/** Gia tộc khác trả giá lô siết nợ: tiền giá cao nhất được giữ lại, bị trả cao hơn thì hoàn ngay về quỹ. */
export function bidSeizedPlot(userId, auctionId, amount, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'trả giá lô siết nợ', ['leader', 'elder']);
    const a = q.auction.get(auctionId);
    if (!a || a.status !== 'open' || a.ends_at <= now) throw new GameError('Phiên đấu giá đã kết thúc.');
    if (clan.id === a.debtor_id || clan.id === a.bank_id) throw new GameError('Gia tộc vỡ nợ và ngân hàng chủ nợ không trả giá được.');
    if (a.top_clan === clan.id) throw new GameError('Gia tộc đang trả giá cao nhất rồi.');
    const room = plotRoom(clan.id) - q.auctionsOfClan.all(clan.id, clan.id).filter((x) => x.top_clan === clan.id).length;
    if (room < 1) throw new GameError('Gia tộc đã giữ đủ số lô theo cấp (kể cả lô đang dẫn đấu giá).');
    const min = a.top_bid ? a.top_bid + Math.max(1, Math.ceil(a.top_bid * CBANK.auction.step)) : a.start_price;
    if (!Number.isInteger(amount) || amount < min) throw new GameError(`Phải trả ít nhất ${fmt(min)} xu.`);
    if (balanceOf(clanAccount(clan.id)) < amount) throw new GameError(`Quỹ gia tộc chỉ còn ${fmt(balanceOf(clanAccount(clan.id)))} xu.`);
    if (q.bid.run(amount, clan.id, a.id, a.top_bid ?? 0).changes === 0) throw new GameError('Vừa có gia tộc khác trả giá, xem lại giá mới nhé.');
    post({ account: clanAccount(clan.id), delta: -amount, kind: 'cbank_auction', memo: `Giữ giá đấu lô siết nợ #${a.id}`, now });
    post({ account: escrowAccount(a.id), delta: amount, kind: 'cbank_auction', memo: `Giá của ${clan.name}`, now });
    if (a.top_clan) {
      post({ account: escrowAccount(a.id), delta: -a.top_bid, kind: 'cbank_auction', memo: 'Hoàn giá bị vượt', now });
      post({ account: clanAccount(a.top_clan), delta: a.top_bid, kind: 'cbank_auction', memo: `Hoàn giá đấu lô siết nợ #${a.id} (có gia tộc trả cao hơn)`, now });
    }
    return { message: `🔨 Gia tộc đang dẫn phiên đấu giá lô với ${fmt(amount)} xu.` };
  });
}

/** Chia tiền bán lô siết nợ: trả ngân hàng tới hết nợ còn lại, phần dư về gia tộc vỡ nợ. Trả về phần ngân hàng nhận. */
function splitProceeds(a, amount, from, now, kind) {
  const loan = q.loan.get(a.loan_id);
  const left = Math.max(0, loan.owed - loan.paid);
  const toBank = Math.min(left, amount);
  const bank = q.bank.get(a.bank_id);
  const bankTo = bank?.status === 'open' ? bankAccount(a.bank_id) : INSURANCE;
  if (from) post({ account: from, delta: -amount, kind, memo: `Chốt phiên lô siết nợ #${a.id}`, now });
  if (toBank > 0) post({ account: bankTo, delta: toBank, kind, memo: `Thu nợ từ bán lô siết nợ #${a.id}`, now });
  if (amount - toBank > 0) post({ account: clanAccount(a.debtor_id), delta: amount - toBank, kind, memo: `Phần dư sau khi bán lô siết nợ #${a.id}`, now });
  q.saveLoan.run(loan.owed, loan.paid + toBank, loan.late_nights, 'defaulted', loan.closed_at ?? now, loan.id);
  if (bank?.status === 'open') drainQueue(q.bank.get(a.bank_id), now);
  return toBank;
}

/** Đóng các phiên đấu giá lô siết nợ đã hết giờ. Không ai trả giá: Sở Nhà Đất mua lại theo giá bán lại đất. */
export function settleBankAuctions(now = Date.now()) {
  const due = q.dueAuctions.all(now);
  if (!due.length) return 0;
  transaction(() => {
    for (const a of due) {
      const c = plotCollateral(a.plot_id, now);
      const still = c && c.row.clan_id === a.debtor_id;
      if (a.top_clan) {
        if (!still || plotRoom(a.top_clan) < 1) {
          // Lô đã đổi chủ (Đấu trường) hoặc người thắng hết chỗ: hoàn tiền, ngân hàng không thu được.
          post({ account: escrowAccount(a.id), delta: -a.top_bid, kind: 'cbank_auction', memo: 'Hoàn giá: phiên không chốt được', now });
          post({ account: clanAccount(a.top_clan), delta: a.top_bid, kind: 'cbank_auction', memo: `Hoàn giá đấu lô siết nợ #${a.id}`, now });
          q.closeAuction.run('void', now, 0, a.id);
          continue;
        }
        transferPlot(a.plot_id, a.top_clan, a.top_bid, now);
        splitProceeds(a, a.top_bid, escrowAccount(a.id), now, 'cbank_auction');
        q.closeAuction.run('sold', now, a.top_bid, a.id);
        news(`🔨 ${q.clan.get(a.top_clan)?.name ?? ''} mua lô ${c.plot.code} siết nợ giá ${fmt(a.top_bid)} xu`, now);
        continue;
      }
      if (!still) {
        q.closeAuction.run('void', now, 0, a.id);
        continue;
      }
      releasePlotToLand(a.plot_id);
      splitProceeds(a, c.resale, null, now, 'cbank_seize_sale');
      q.closeAuction.run('npc', now, c.resale, a.id);
    }
  });
  return due.length;
}

// ---------------------------------------------------------------- đổ vỡ

/** Ngân hàng đổ vỡ: tiền mặt chia theo tỉ lệ gốc, quỹ bảo hiểm bù tới 80% phần thiếu; khoản vay còn lại trả về quỹ bảo hiểm. */
export function failBank(bankId, now, reason) {
  const bank = q.bank.get(bankId);
  if (!bank || bank.status !== 'open') return null;
  const deps = q.liveDeposits.all(bankId);
  const cash = cashOf(bankId);
  const { paid, insured, fundUsed } = failurePayout(deps.map((d) => d.amount), cash, insuranceFund());
  deps.forEach((d, i) => {
    if (paid[i] > 0) {
      post({ account: bankAccount(bankId), delta: -paid[i], kind: 'cbank_withdraw', memo: `Đổ vỡ: trả khoản gửi #${d.id}`, now });
      post({ userId: d.user_id, delta: paid[i], kind: 'cbank_withdraw', memo: `Ngân hàng đổ vỡ: trả theo tỉ lệ khoản #${d.id}`, now });
    }
    if (insured[i] > 0) {
      post({ account: INSURANCE, delta: -insured[i], kind: 'cbank_insurance_payout', memo: `Bù khoản gửi #${d.id}`, now });
      post({ userId: d.user_id, delta: insured[i], kind: 'cbank_insurance_payout', memo: `Bảo hiểm tiền gửi bù khoản #${d.id}`, now });
    }
    q.closeDeposit.run('failed', paid[i] + insured[i], insured[i], now, d.id);
  });
  // Tiền mặt còn dư (khi đủ trả hết gốc) là vốn chủ: về quỹ gia tộc nếu gia tộc còn, không thì vào quỹ bảo hiểm.
  const left = cashOf(bankId);
  if (left > 0) {
    const clan = q.clan.get(bankId);
    post({ account: bankAccount(bankId), delta: -left, kind: 'cbank_capital_out', memo: 'Đóng ngân hàng: vốn còn lại', now });
    post({ account: clan && !clan.dissolved_at ? clanAccount(bankId) : INSURANCE, delta: left, kind: 'cbank_capital_out', memo: 'Vốn còn lại của ngân hàng đổ vỡ', now });
  }
  q.failBank.run(now, bankId);
  const clan = q.clan.get(bankId);
  news(`💥 Ngân hàng ${clan?.emblem ?? ''} ${clan?.name ?? ''} đổ vỡ (${reason}): người gửi nhận lại theo tỉ lệ, bảo hiểm tiền gửi bù ${fmt(fundUsed)} xu`, now);
  adminLog('Ngân hàng gia tộc', 'cbank_failed', null, { clanId: bankId, reason, deposits: deps.length, cash, fundUsed });
  return { deposits: deps.length, cash, fundUsed };
}

/** Gia tộc giải tán: ngân hàng của nó đổ vỡ; lô đang thế chấp của nó về tay ngân hàng chủ nợ (vượt cả giới hạn số lô). */
export function clanBankDissolve(clanId, now) {
  failBank(clanId, now, 'gia tộc giải tán');
  for (const loan of q.liveLoansOf.all(clanId)) {
    const c = plotCollateral(loan.plot_id, now);
    const lender = q.clan.get(loan.bank_id);
    if (c && c.row.clan_id === clanId && lender && !lender.dissolved_at) {
      transferPlot(loan.plot_id, loan.bank_id, c.land, now);
      q.saveLoan.run(loan.owed, loan.paid, loan.late_nights, 'defaulted', now, loan.id);
    } else q.saveLoan.run(loan.owed, loan.paid, loan.late_nights, 'written_off', now, loan.id);
  }
  // Phiên đấu giá: hoàn giá gia tộc giải tán đang dẫn; lô siết nợ của chính nó về thẳng ngân hàng chủ nợ.
  for (const a of q.auctionsOfClan.all(clanId, clanId)) {
    if (a.top_clan) {
      post({ account: escrowAccount(a.id), delta: -a.top_bid, kind: 'cbank_auction', memo: 'Hoàn giá: phiên đóng sớm', now });
      post({ account: clanAccount(a.top_clan), delta: a.top_bid, kind: 'cbank_auction', memo: `Hoàn giá đấu lô siết nợ #${a.id}`, now });
      q.clearBid.run(a.id);
    }
    if (a.debtor_id !== clanId) continue;
    const c = plotCollateral(a.plot_id, now);
    const lender = q.clan.get(a.bank_id);
    if (c && c.row.clan_id === clanId && lender && !lender.dissolved_at) transferPlot(a.plot_id, a.bank_id, c.land, now);
    q.closeAuction.run('kept', now, 0, a.id);
  }
}

// ---------------------------------------------------------------- cuối ngày

/**
 * Nửa đêm: thu nợ đáo hạn, trả các khoản gửi đáo hạn (không đủ tiền mặt thì xếp hàng), trả hàng chờ, hồi uy tín,
 * và cho đổ vỡ ngân hàng có lệnh rút xếp hàng quá 3 đêm. Ngân hàng bị phong tỏa vẫn thu nợ nhưng không chi.
 */
export function settleClanBankDay(endTs) {
  transaction(() => {
    settleLoans(endTs);
    for (const bank of q.banks.all()) {
      if (bank.status !== 'open' || globalFrozen() || bank.frozen) continue;
      for (const dep of q.matured.all(bank.clan_id, endTs)) {
        const { total } = depositPayout(dep, endTs);
        if (cashOf(bank.clan_id) >= total && !q.queueSum.get(bank.clan_id).n) payOut(dep, total, endTs);
        else queueWithdrawal(q.bank.get(bank.clan_id), dep, total, endTs);
      }
      const fresh = q.bank.get(bank.clan_id);
      drainQueue(fresh, endTs);
      const queued = q.queueSum.get(bank.clan_id);
      if (queued.n && queued.oldest <= endTs - CBANK.failNights * DAY) {
        failBank(bank.clan_id, endTs, `lệnh rút xếp hàng quá ${CBANK.failNights} đêm`);
        continue;
      }
      if (!queued.n && fresh.reputation < CBANK.reputation.start) q.setReputation.run(Math.min(CBANK.reputation.start, fresh.reputation + CBANK.reputation.dailyRecover), null, bank.clan_id);
    }
  });
}

// ---------------------------------------------------------------- xem

const bankCard = (b, now) => {
  const s = sheetOf(b.clan_id);
  const state = bankState(b);
  const rates = ratesOf(b);
  return {
    clanId: b.clan_id, name: b.name, emblem: b.emblem, color: b.color, status: b.status,
    rates: CBANK.terms.map((t) => ({ days: t, rate: Math.min(Number(rates[t] ?? 0), maxDepositRate(economy().baseRate)) })),
    loanRate: b.loan_rate, lendingOpen: Boolean(b.lending_open && state.ok),
    reputation: b.reputation, frozen: Boolean(b.frozen) || globalFrozen(),
    accepting: state.ok && b.reputation >= CBANK.minReputation && !s.queuedCount && s.deposits < Math.max(0, s.equity) * CBANK.leverage,
    why: state.ok ? null : state.why,
    deposits: s.deposits, liquidity: Math.round(s.liquidity * 1000) / 1000, queuedCount: s.queuedCount,
    lendable: Math.max(0, s.cash - s.floor), openedAt: b.opened_at, at: now,
  };
};

const depositRow = (d, now) => ({
  id: d.id, bankId: d.bank_id, bank: d.bank_name, emblem: d.emblem, amount: d.amount, rate: d.rate, termDays: d.term_days,
  openedAt: d.opened_at, maturesAt: d.matures_at, status: d.status, queuedAt: d.queued_at, payout: d.payout, insured: d.insured,
  closedAt: d.closed_at, interest: simpleInterest(d.amount, d.rate, d.term_days), matured: now >= d.matures_at,
});

const loanRow = (l) => ({
  id: l.id, bankId: l.bank_id, clanId: l.clan_id, bank: l.bank_name, clan: l.clan_name, emblem: l.emblem, plotId: l.plot_id,
  amount: l.amount, rate: l.rate, termDays: l.term_days, collateral: l.collateral, owed: l.owed, paid: l.paid, left: l.owed - l.paid,
  lateNights: l.late_nights, status: l.status, openedAt: l.opened_at, dueAt: l.due_at, closedAt: l.closed_at,
});

const auctionRow = (a, now) => ({
  id: a.id, plotId: a.plot_id, bankId: a.bank_id, bank: a.bank_name, debtorId: a.debtor_id, debtor: a.debtor_name,
  startPrice: a.start_price, topBid: a.top_bid, topClanId: a.top_clan, topClan: a.top_name, bids: a.bids, endsAt: a.ends_at,
  minBid: a.top_bid ? a.top_bid + Math.max(1, Math.ceil(a.top_bid * CBANK.auction.step)) : a.start_price, plotCode: plotCollateral(a.plot_id, now)?.plot.code ?? `#${a.plot_id}`,
});

/** Màn Ngân hàng gia tộc: các ngân hàng đang mở, khoản gửi của mình; tộc trưởng thấy thêm phần vay và phần quản lý. */
export function clanBankView(userId, now = Date.now()) {
  const base = economy().baseRate;
  const banks = q.banks.all().filter((b) => b.status === 'open' && !b.dissolved_at).map((b) => bankCard(b, now));
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  let mine = null;
  if (clan && !clan.dissolved_at) {
    const bank = q.bank.get(clan.id);
    const leader = m.role === 'leader' && !isDeposed(clan.id, userId);
    const plots = q.clanPlotIds.all(clan.id).map((r) => {
      const c = plotCollateral(r.id, now);
      return { id: r.id, code: c.plot.code, value: c.value, maxLoan: maxLoanOn(c.value), pledged: plotPledged(r.id) };
    });
    mine = {
      id: clan.id, name: clan.name, role: m.role, leader,
      holder: Boolean(q.isHolder.get(clan.id)), fund: balanceOf(clanAccount(clan.id)),
      loans: q.clanLoans.all(clan.id, now - 7 * DAY).map(loanRow),
      plots,
      related: banks.filter((b) => clansRelated(clan.id, b.clanId, now)).map((b) => b.clanId),
      bank: bank && leader ? {
        ...sheetOf(clan.id), status: bank.status, reputation: bank.reputation, rates: ratesOf(bank), loanRate: bank.loan_rate,
        lendingOpen: Boolean(bank.lending_open), frozen: Boolean(bank.frozen) || globalFrozen(),
        loanList: q.bankLoans.all(clan.id, now - 7 * DAY).map(loanRow),
        defaults: q.defaults.get(clan.id),
      } : bank ? { status: bank.status } : null,
    };
  }
  return {
    baseRate: base,
    maxDepositRate: maxDepositRate(base),
    loanRange: loanRateRange(base),
    rules: CBANK,
    insurance: insuranceFund(),
    frozen: globalFrozen(),
    banks,
    deposits: q.myDeposits.all(userId, now - 7 * DAY).map((d) => depositRow(d, now)),
    auctions: q.openAuctions.all().map((a) => auctionRow(a, now)),
    clan: mine,
  };
}

// ---------------------------------------------------------------- quản trị viên

export function adminClanBankView(now = Date.now()) {
  return {
    frozen: globalFrozen(),
    insurance: insuranceFund(),
    baseRate: economy().baseRate,
    rules: CBANK,
    banks: q.banks.all().map((b) => {
      const s = sheetOf(b.clan_id);
      const d = q.defaults.get(b.clan_id);
      return {
        clanId: b.clan_id, name: b.name, emblem: b.emblem, status: b.status, frozen: Boolean(b.frozen), reputation: b.reputation,
        holder: Boolean(q.isHolder.get(b.clan_id)), rates: ratesOf(b), loanRate: b.loan_rate, lendingOpen: Boolean(b.lending_open),
        cash: s.cash, deposits: s.deposits, loans: s.loans, equity: s.equity, floor: s.floor, liquidity: Math.round(s.liquidity * 1000) / 1000,
        depositors: s.depositors, queued: s.queued, queuedCount: s.queuedCount, queuedSince: s.queuedSince,
        defaults: d.n, defaultLost: d.lost, openedAt: b.opened_at, failedAt: b.failed_at,
      };
    }),
    loans: q.allLoans.all().map(loanRow),
    auctions: q.openAuctions.all().map((a) => auctionRow(a, now)),
  };
}

/** Phong tỏa khẩn cấp: `clanId` null là toàn bộ ngân hàng gia tộc. Phong tỏa thì không gửi, rút, vay, chi trả đáo hạn. */
export function setClanBankFrozen(clanId, frozen) {
  if (clanId == null) {
    setMeta(FREEZE, frozen ? '1' : '0');
    return { message: frozen ? 'Đã phong tỏa toàn bộ ngân hàng gia tộc.' : 'Đã gỡ phong tỏa toàn bộ ngân hàng gia tộc.' };
  }
  const bank = q.bank.get(clanId);
  if (!bank) throw new GameError('Không có ngân hàng này.');
  q.setFrozen.run(frozen ? 1 : 0, clanId);
  if (!frozen) transaction(() => drainQueue(q.bank.get(clanId), Date.now()));
  return { message: frozen ? 'Đã phong tỏa ngân hàng.' : 'Đã gỡ phong tỏa ngân hàng.' };
}
