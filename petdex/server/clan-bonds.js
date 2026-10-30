// Trái phiếu gia tộc và kho bạc, sàn trái phiếu thứ cấp, quyền đặt lãi suất cơ bản của gia tộc nắm Ngân hàng nhà nước.
// - Phát hành: mệnh giá 100, coupon cố định mỗi ngày, kỳ hạn 7/14/30 ngày, bán theo mệnh giá trong 24 giờ; phần không ai mua
//   bị hủy. Coupon trả mỗi nửa đêm, đáo hạn trả gốc. Không đủ tiền: vỡ nợ, phần còn nợ (arrears) trả dần theo tỉ lệ cho người
//   đang giữ; trong lúc đó gia tộc không được chia cổ tức hay mua lại cổ phần (trái chủ đứng trước cổ đông); giải tán thì
//   quỹ trả trái chủ trước khi về ngân sách.
// - Sàn thứ cấp: người giữ rao bán với giá tự đặt, người mua trả thêm 1% phí cho gia tộc nắm Ngân hàng nhà nước.
// - Lãi suất cơ bản: tộc trưởng gia tộc nắm Ngân hàng nhà nước đặt trong khoảng lãi chính sách ± 0,1 điểm %, có hiệu lực tới
//   phiên họp sau của Ngân hàng Trung ương (lãi tiết kiệm, gửi kỳ hạn, vay NPC đều theo). Lượng xu tăng quá 15%/tuần trong tuần
//   gia tộc đặt lãi thấp hơn lãi chính sách: phạt 50.000 xu; lần thứ hai trong 28 ngày thì mất ghế Ngân hàng nhà nước.
// Luật ở public/ta-tua/game/js/shared/clan-bonds.js (wiki đọc thẳng từ đó).
import { economy } from './bank.js';
import { adminLog, db, getMeta, setMeta, transaction } from './db.js';
import { dayKey } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { chargeFinanceTax, post } from './ledger.js';
import { breakDepositsFor, isDeposed } from './clan-gov.js';
import { bookValue } from './clan-shares.js';
import { BONDS, RATE_POWER, couponOf, couponRange, rateBand } from '../../public/ta-tua/game/js/shared/clan-bonds.js';

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const pctDay = (r) => `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}%/ngày`;
const clanAccount = (id) => `clan:${id}`;
const bankAccount = (id) => `bank:${id}`;
const issuerAccount = (i) => (i.issuer_kind === 'treasury' ? 'treasury' : clanAccount(i.issuer_id));
const RATE_KEY = 'base_rate_set';

const q = {
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  stateBank: db.prepare(`
    SELECT c.id, b.status AS bank_status FROM clan_industries i JOIN clans c ON c.id = i.clan_id AND c.dissolved_at IS NULL
    LEFT JOIN cbank_banks b ON b.clan_id = c.id WHERE i.industry = 'state_bank' ORDER BY i.entered_at LIMIT 1`),
  dropSeat: db.prepare("DELETE FROM clan_industries WHERE clan_id = ? AND industry = 'state_bank'"),

  issue: db.prepare('SELECT * FROM bond_issues WHERE id = ?'),
  insertIssue: db.prepare(`
    INSERT INTO bond_issues (issuer_kind, issuer_id, face, coupon, term_days, qty, status, opens_at, closes_at) VALUES (?, ?, ?, ?, ?, ?, 'subscribing', ?, ?)`),
  addSold: db.prepare("UPDATE bond_issues SET sold = sold + ? WHERE id = ? AND status = 'subscribing' AND sold + ? <= qty"),
  dueSubs: db.prepare("SELECT * FROM bond_issues WHERE status = 'subscribing' AND closes_at <= ?"),
  live: db.prepare("SELECT * FROM bond_issues WHERE status IN ('active', 'defaulted') ORDER BY id"),
  listed: db.prepare("SELECT * FROM bond_issues WHERE status IN ('subscribing', 'active', 'defaulted') OR closed_at >= ? ORDER BY id DESC LIMIT 60"),
  outstanding: db.prepare("SELECT COALESCE(SUM(sold * face), 0) AS face FROM bond_issues WHERE issuer_kind = 'clan' AND issuer_id = ? AND status IN ('active', 'defaulted')"),
  pending: db.prepare("SELECT COALESCE(SUM(qty * face), 0) AS face FROM bond_issues WHERE issuer_kind = 'clan' AND issuer_id = ? AND status = 'subscribing'"),
  inDefault: db.prepare("SELECT COUNT(*) AS n FROM bond_issues WHERE issuer_kind = 'clan' AND issuer_id = ? AND (status = 'defaulted' OR arrears > 0)"),
  ofIssuer: db.prepare("SELECT * FROM bond_issues WHERE issuer_kind = 'clan' AND issuer_id = ? AND status IN ('subscribing', 'active', 'defaulted')"),
  save: db.prepare('UPDATE bond_issues SET status = ?, matures_at = COALESCE(?, matures_at), qty = ?, paid_day = ?, arrears = ?, closed_at = ? WHERE id = ?'),

  holding: db.prepare('SELECT * FROM bond_holdings WHERE issue_id = ? AND holder_kind = ? AND holder_id = ?'),
  holders: db.prepare('SELECT * FROM bond_holdings WHERE issue_id = ? AND qty > 0 ORDER BY holder_kind, holder_id'),
  addHolding: db.prepare(`
    INSERT INTO bond_holdings (issue_id, holder_kind, holder_id, qty, listed) VALUES (?, ?, ?, ?, 0)
    ON CONFLICT (issue_id, holder_kind, holder_id) DO UPDATE SET qty = qty + excluded.qty`),
  takeHolding: db.prepare('UPDATE bond_holdings SET qty = qty - ?, listed = listed - ? WHERE issue_id = ? AND holder_kind = ? AND holder_id = ? AND qty >= ? AND listed >= ?'),
  list: db.prepare('UPDATE bond_holdings SET listed = listed + ? WHERE issue_id = ? AND holder_kind = ? AND holder_id = ? AND qty - listed >= ?'),
  unlist: db.prepare('UPDATE bond_holdings SET listed = MAX(0, listed - ?) WHERE issue_id = ? AND holder_kind = ? AND holder_id = ?'),
  mine: db.prepare("SELECT h.*, i.issuer_kind, i.issuer_id, i.coupon, i.term_days, i.status, i.matures_at FROM bond_holdings h JOIN bond_issues i ON i.id = h.issue_id WHERE h.holder_kind = ? AND h.holder_id = ? AND h.qty > 0"),
  setCarry: db.prepare('UPDATE bond_holdings SET carry = ? WHERE issue_id = ? AND holder_kind = ? AND holder_id = ?'),
  heldValue: db.prepare("SELECT COALESCE(SUM(h.qty * i.face), 0) AS v FROM bond_holdings h JOIN bond_issues i ON i.id = h.issue_id WHERE h.holder_kind = 'user' AND h.holder_id = ? AND i.status IN ('active', 'defaulted', 'subscribing')"),

  ask: db.prepare('SELECT * FROM bond_asks WHERE id = ?'),
  asks: db.prepare("SELECT * FROM bond_asks WHERE status = 'open' ORDER BY issue_id, price, id LIMIT 200"),
  insertAsk: db.prepare('INSERT INTO bond_asks (issue_id, holder_kind, holder_id, qty, price, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  setAsk: db.prepare('UPDATE bond_asks SET qty = ?, status = ? WHERE id = ?'),
  asksOfIssue: db.prepare("SELECT * FROM bond_asks WHERE status = 'open' AND issue_id = ?"),

  strikes: db.prepare('SELECT * FROM rate_strikes WHERE clan_id = ? AND at >= ? ORDER BY at'),
  allStrikes: db.prepare('SELECT s.*, c.name FROM rate_strikes s JOIN clans c ON c.id = s.clan_id ORDER BY s.id DESC LIMIT 20'),
  insertStrike: db.prepare('INSERT INTO rate_strikes (clan_id, week, growth, penalty, lost, at) VALUES (?, ?, ?, ?, ?, ?)'),
  latestWeek: db.prepare('SELECT * FROM central_bank ORDER BY week DESC LIMIT 1'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const balanceOf = (account) => q.account.get(account)?.balance ?? 0;
const news = (headline, now) => q.insertNews.run(headline, now, now, now + DAY);
const issuerName = (i) => (i.issuer_kind === 'treasury' ? 'Kho bạc thị trấn' : `Gia tộc ${q.clan.get(i.issuer_id)?.name ?? `#${i.issuer_id}`}`);

/** Tài khoản nhận phí: ngân hàng (hoặc quỹ) của gia tộc nắm Ngân hàng nhà nước, không thì ngân sách. */
function brokerAccount() {
  const sb = q.stateBank.get();
  if (!sb) return 'treasury';
  return sb.bank_status === 'open' ? bankAccount(sb.id) : clanAccount(sb.id);
}

function mustLeader(userId, what) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  if (m.role !== 'leader' || isDeposed(clan.id, userId)) throw new GameError(`Chỉ tộc trưởng mới được ${what}.`);
  return clan;
}

/** Gia tộc đang nợ trái chủ (vỡ nợ hoặc còn arrears): không được chia cổ tức hay mua lại cổ phần. */
export const bondsInDefault = (clanId) => q.inDefault.get(clanId).n > 0;

/** Giá trị trái phiếu người chơi đang giữ theo mệnh giá (tài sản ròng). */
export const bondValue = (userId) => q.heldValue.get(userId).v;

// ---------------------------------------------------------------- phát hành

function validateTerms({ qty, coupon, term }) {
  if (!BONDS.terms.includes(term)) throw new GameError(`Kỳ hạn chỉ có ${BONDS.terms.join(', ')} ngày.`);
  if (!Number.isInteger(qty) || qty < BONDS.minQty || qty > BONDS.maxQty) throw new GameError(`Phát hành từ ${BONDS.minQty} tới ${fmt(BONDS.maxQty)} trái phiếu.`);
  const [lo, hi] = couponRange(economy().baseRate);
  if (!Number.isFinite(coupon) || coupon < lo - 1e-12 || coupon > hi + 1e-12) throw new GameError(`Lãi coupon từ ${pctDay(lo)} tới ${pctDay(hi)}.`);
  return Math.round(coupon * 1e7) / 1e7;
}

/** Tộc trưởng phát hành trái phiếu gia tộc: tổng mệnh giá đang lưu hành không quá 50% giá trị sổ sách. */
export function issueClanBonds(userId, { qty, coupon, term }, now = Date.now()) {
  return transaction(() => {
    const clan = mustLeader(userId, 'phát hành trái phiếu');
    const c = validateTerms({ qty, coupon, term });
    if (bondsInDefault(clan.id)) throw new GameError('Gia tộc đang nợ trái chủ, trả xong mới phát hành tiếp được.');
    const cap = Math.floor(bookValue(clan.id, now) * 1_000 * BONDS.clanBookShare);
    const used = q.outstanding.get(clan.id).face + q.pending.get(clan.id).face;
    if (used + qty * BONDS.face > cap) throw new GameError(`Tổng mệnh giá trái phiếu không quá ${Math.round(BONDS.clanBookShare * 100)}% giá trị sổ sách: còn phát hành được ${fmt(Math.max(0, Math.floor((cap - used) / BONDS.face)))} trái phiếu.`);
    const id = Number(q.insertIssue.run('clan', clan.id, BONDS.face, c, term, qty, now, now + BONDS.subscribeHours * HOUR).lastInsertRowid);
    news(`📜 Gia tộc ${clan.name} phát hành ${fmt(qty)} trái phiếu ${term} ngày, lãi ${pctDay(c)}`, now);
    return { message: `📜 Đã mở bán ${fmt(qty)} trái phiếu (đợt #${id}) trong ${BONDS.subscribeHours} giờ.` };
  });
}

/** Quản trị viên phát hành trái phiếu kho bạc (tiền vào ngân sách thị trấn). */
export function issueTreasuryBonds({ qty, coupon, term }, actor = 'Quản trị viên', now = Date.now()) {
  return transaction(() => {
    const c = validateTerms({ qty, coupon, term });
    const id = Number(q.insertIssue.run('treasury', 0, BONDS.face, c, term, qty, now, now + BONDS.subscribeHours * HOUR).lastInsertRowid);
    news(`📜 Kho bạc thị trấn phát hành ${fmt(qty)} trái phiếu ${term} ngày, lãi ${pctDay(c)}`, now);
    adminLog(actor, 'bond_treasury_issue', null, { id, qty, coupon: c, term });
    return { message: `Đã mở bán ${fmt(qty)} trái phiếu kho bạc (đợt #${id}).`, id };
  });
}

/** Người chơi (hoặc tộc trưởng bằng quỹ) mua trái phiếu đang mở bán theo mệnh giá. */
export function subscribeBonds(userId, issueId, qty, { asClan = false } = {}, now = Date.now()) {
  return transaction(() => {
    const i = q.issue.get(issueId);
    if (!i || i.status !== 'subscribing' || i.closes_at <= now) throw new GameError('Đợt trái phiếu này không còn mở bán.');
    if (!Number.isInteger(qty) || qty < 1) throw new GameError('Số trái phiếu không hợp lệ.');
    const holder = asClan ? { kind: 'clan', id: mustLeader(userId, 'mua trái phiếu bằng quỹ').id } : { kind: 'user', id: userId };
    if (holder.kind === 'clan' && i.issuer_kind === 'clan' && i.issuer_id === holder.id) throw new GameError('Gia tộc không mua trái phiếu của chính mình.');
    const cap = Math.floor(i.qty * BONDS.holderCap);
    const mine = q.holding.get(i.id, holder.kind, holder.id)?.qty ?? 0;
    if (mine + qty > cap) throw new GameError(`Mỗi người giữ tối đa ${fmt(cap)} trái phiếu (${Math.round(BONDS.holderCap * 100)}%) của một đợt.`);
    if (q.addSold.run(qty, i.id, qty).changes === 0) throw new GameError(`Đợt này chỉ còn ${fmt(i.qty - i.sold)} trái phiếu.`);
    const value = qty * i.face;
    const fee = Math.ceil(value * BONDS.issueFee);
    if (holder.kind === 'user') post({ userId, delta: -value, kind: 'bond_buy', memo: `${issuerName(i)} đợt #${i.id}`, now });
    else post({ account: clanAccount(holder.id), delta: -value, kind: 'bond_buy', memo: `${issuerName(i)} đợt #${i.id}`, now });
    post({ account: issuerAccount(i), delta: value - fee, kind: 'bond_issue', memo: `Bán ${qty} trái phiếu đợt #${i.id}`, now });
    if (fee > 0) post({ account: brokerAccount(), delta: fee, kind: 'bond_fee', memo: `Phí phát hành đợt #${i.id}`, now });
    q.addHolding.run(i.id, holder.kind, holder.id, qty);
    return { message: `📜 Đã mua ${fmt(qty)} trái phiếu ${issuerName(i)} (${fmt(value)} xu).` };
  });
}

/** Hết giờ mở bán: phần không ai mua bị hủy, trái phiếu bắt đầu tính coupon. */
export function closeBondSubs(now = Date.now()) {
  const due = q.dueSubs.all(now);
  if (!due.length) return 0;
  transaction(() => {
    for (const i of due) {
      if (!i.sold) q.save.run('cancelled', null, 0, null, 0, now, i.id);
      else q.save.run('active', i.closes_at + i.term_days * DAY, i.sold, dayKey(i.closes_at), 0, null, i.id);
    }
  });
  return due.length;
}

// ---------------------------------------------------------------- trả coupon, gốc, vỡ nợ

/** Tiền tổ chức phát hành đang có để trả trái chủ (gia tộc: phá cả tiền gửi kỳ hạn của quỹ). */
function issuerCash(i, need, now) {
  if (i.issuer_kind === 'treasury') return Math.max(0, balanceOf('treasury'));
  return breakDepositsFor(i.issuer_id, need, 'trả trái chủ', now);
}

/**
 * Chia `amount` cho người đang giữ theo số trái phiếu; `kind` coupon (có thuế) hay gốc. Phần lẻ dưới 1 xu của mỗi người
 * được giữ lại (carry) và cộng vào lần trả sau, để người giữ ít trái phiếu vẫn nhận đủ lãi. Trả về số đã chia.
 */
function payHolders(i, amount, kind, memo, now) {
  const holders = q.holders.all(i.id);
  const total = holders.reduce((s, h) => s + h.qty, 0);
  if (!total || amount <= 0) return 0;
  let paid = 0;
  for (const h of holders) {
    const exact = (amount * h.qty) / total + h.carry;
    const x = Math.floor(Math.round(exact * 1e6) / 1e6);
    q.setCarry.run(Math.max(0, exact - x), i.id, h.holder_kind, h.holder_id);
    if (x <= 0) continue;
    paid += x;
    if (h.holder_kind === 'user') {
      post({ userId: h.holder_id, delta: x, kind, memo, now });
      if (kind === 'bond_coupon') chargeFinanceTax(h.holder_id, x, memo, now);
    } else post({ account: clanAccount(h.holder_id), delta: x, kind, memo, now });
  }
  if (paid > 0) post({ account: issuerAccount(i), delta: -paid, kind, memo: `${memo} (${fmt(total)} trái phiếu)`, now });
  return paid;
}

/**
 * Nửa đêm: mỗi đợt đang lưu hành trả coupon của ngày; đáo hạn thì trả gốc và rút khỏi sàn. Không đủ tiền thì phần thiếu
 * cộng vào arrears (vỡ nợ) và được trả dần trước mọi khoản mới.
 */
export function settleBondsDay(endTs) {
  transaction(() => {
    const day = dayKey(endTs - 1);
    for (const i of q.live.all()) {
      if (i.paid_day && i.paid_day >= day) continue;
      const coupon = couponOf(i.qty, i.coupon);
      const matured = i.matures_at && endTs >= i.matures_at;
      const principal = matured ? i.qty * i.face : 0;
      let need = i.arrears + coupon + principal;
      const have = Math.min(need, issuerCash(i, need, endTs));
      let left = have;
      // Nợ cũ trước, rồi coupon hôm nay, rồi gốc.
      const arrearsPaid = Math.min(left, i.arrears);
      if (arrearsPaid) left -= payHolders(i, arrearsPaid, 'bond_coupon', `Trả nợ trái phiếu đợt #${i.id}`, endTs);
      const couponPaid = Math.min(left, coupon);
      if (couponPaid) left -= payHolders(i, couponPaid, 'bond_coupon', `Lãi trái phiếu đợt #${i.id}`, endTs);
      const principalPaid = Math.min(left, principal);
      if (principalPaid) payHolders(i, principalPaid, 'bond_redeem', `Gốc trái phiếu đợt #${i.id}`, endTs);
      need -= arrearsPaid + couponPaid + principalPaid;
      const arrears = Math.max(0, need);
      if (arrears > 0 && i.status !== 'defaulted') news(`💸 ${issuerName(i)} không trả đủ trái phiếu đợt #${i.id}: còn nợ ${fmt(arrears)} xu`, endTs);
      if (matured && arrears === 0) {
        q.save.run('matured', null, i.qty, day, 0, endTs, i.id);
        for (const a of q.asksOfIssue.all(i.id)) q.setAsk.run(a.qty, 'closed', a.id);
      } else q.save.run(arrears > 0 ? 'defaulted' : 'active', null, i.qty, day, arrears, null, i.id);
    }
  });
  closeBondSubs(endTs);
}

/** Gia tộc giải tán: quỹ trả trái chủ (nợ cũ + gốc) trước khi về ngân sách; phần không trả được mất. */
export function bondsDissolve(clanId, now) {
  for (const i of q.ofIssuer.all(clanId)) {
    if (i.status === 'subscribing') {
      // Hoàn tiền người đã mua trong lúc mở bán (tiền đã vào quỹ, trừ phí).
      const owed = i.sold * i.face;
      const have = Math.min(owed, Math.max(0, balanceOf(clanAccount(clanId))));
      payHolders(i, have, 'bond_redeem', `Hoàn tiền đợt #${i.id} (gia tộc giải tán)`, now);
      q.save.run('cancelled', null, i.sold, null, owed - have, now, i.id);
      continue;
    }
    const owed = i.arrears + i.qty * i.face;
    const have = Math.min(owed, Math.max(0, balanceOf(clanAccount(clanId))));
    payHolders(i, have, 'bond_redeem', `Thanh lý trái phiếu đợt #${i.id} (gia tộc giải tán)`, now);
    q.save.run('defaulted', null, i.qty, null, owed - have, now, i.id);
    for (const a of q.asksOfIssue.all(i.id)) q.setAsk.run(a.qty, 'closed', a.id);
    news(`💸 Gia tộc giải tán: trái chủ đợt #${i.id} nhận ${fmt(have)} trên ${fmt(owed)} xu`, now);
  }
}

// ---------------------------------------------------------------- sàn thứ cấp

function holderOf(userId, asClan) {
  return asClan ? { kind: 'clan', id: mustLeader(userId, 'bán trái phiếu của quỹ').id } : { kind: 'user', id: userId };
}

/** Rao bán `qty` trái phiếu với giá `price` mỗi trái phiếu. */
export function listBonds(userId, issueId, qty, price, { asClan = false } = {}, now = Date.now()) {
  return transaction(() => {
    const i = q.issue.get(issueId);
    if (!i || !['active', 'defaulted'].includes(i.status)) throw new GameError('Đợt trái phiếu này không giao dịch.');
    if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(price) || price < 1) throw new GameError('Số lượng hoặc giá không hợp lệ.');
    const h = holderOf(userId, asClan);
    if (q.list.run(qty, i.id, h.kind, h.id, qty).changes === 0) throw new GameError('Không đủ trái phiếu chưa rao bán.');
    q.insertAsk.run(i.id, h.kind, h.id, qty, price, now);
    return { message: `Đã rao bán ${fmt(qty)} trái phiếu đợt #${i.id} giá ${fmt(price)} xu.` };
  });
}

export function cancelBondAsk(userId, askId, { asClan = false } = {}) {
  return transaction(() => {
    const a = q.ask.get(askId);
    const h = holderOf(userId, asClan);
    if (!a || a.status !== 'open' || a.holder_kind !== h.kind || a.holder_id !== h.id) throw new GameError('Không tìm thấy lệnh rao bán này.');
    q.setAsk.run(a.qty, 'cancelled', a.id);
    q.unlist.run(a.qty, a.issue_id, h.kind, h.id);
    return { message: 'Đã rút lệnh rao bán.' };
  });
}

/** Mua `qty` trái phiếu từ một lệnh rao bán; người mua trả thêm 1% phí. */
export function buyBondAsk(userId, askId, qty, { asClan = false } = {}, now = Date.now()) {
  return transaction(() => {
    const a = q.ask.get(askId);
    if (!a || a.status !== 'open') throw new GameError('Lệnh rao bán không còn.');
    const i = q.issue.get(a.issue_id);
    if (!i || !['active', 'defaulted'].includes(i.status)) throw new GameError('Đợt trái phiếu này không giao dịch.');
    if (!Number.isInteger(qty) || qty < 1 || qty > a.qty) throw new GameError(`Mua từ 1 tới ${fmt(a.qty)} trái phiếu.`);
    const h = holderOf(userId, asClan);
    if (h.kind === a.holder_kind && h.id === a.holder_id) throw new GameError('Đây là lệnh của bạn.');
    if (h.kind === 'clan' && i.issuer_kind === 'clan' && i.issuer_id === h.id) throw new GameError('Gia tộc không mua trái phiếu của chính mình.');
    const cap = Math.floor(i.qty * BONDS.holderCap);
    if ((q.holding.get(i.id, h.kind, h.id)?.qty ?? 0) + qty > cap) throw new GameError(`Mỗi người giữ tối đa ${fmt(cap)} trái phiếu của một đợt.`);
    const value = qty * a.price;
    const fee = Math.max(1, Math.ceil(value * BONDS.tradeFee));
    const memo = `Trái phiếu đợt #${i.id}: ${qty} × ${fmt(a.price)}`;
    const payer = h.kind === 'user' ? { userId } : { account: clanAccount(h.id) };
    post({ ...payer, delta: -value, kind: 'bond_buy', memo, now });
    post({ ...payer, delta: -fee, kind: 'bond_fee', memo: `Phí mua ${memo}`, now });
    post({ account: brokerAccount(), delta: fee, kind: 'bond_fee', memo: `Môi giới ${memo}`, now });
    const seller = a.holder_kind === 'user' ? { userId: a.holder_id } : { account: clanAccount(a.holder_id) };
    post({ ...seller, delta: value, kind: 'bond_sell', memo, now });
    if (q.takeHolding.run(qty, qty, i.id, a.holder_kind, a.holder_id, qty, qty).changes === 0) throw new GameError('Người bán không còn đủ trái phiếu.');
    q.addHolding.run(i.id, h.kind, h.id, qty);
    q.setAsk.run(a.qty - qty, a.qty - qty ? 'open' : 'filled', a.id);
    return { message: `Đã mua ${fmt(qty)} trái phiếu đợt #${i.id} (${fmt(value)} xu + ${fmt(fee)} phí).` };
  });
}

// ---------------------------------------------------------------- lãi suất cơ bản

/** Tộc trưởng gia tộc nắm Ngân hàng nhà nước đặt lãi suất cơ bản cho tới phiên họp sau của Ngân hàng Trung ương. */
export function setBaseRate(userId, rate, now = Date.now()) {
  return transaction(() => {
    const clan = mustLeader(userId, 'đặt lãi suất cơ bản');
    const sb = q.stateBank.get();
    if (!sb || sb.id !== clan.id) throw new GameError('Chỉ gia tộc nắm Ngân hàng nhà nước mới đặt được lãi suất cơ bản.');
    const { policyRate, week } = economy();
    const [lo, hi] = rateBand(policyRate);
    const r = Number(rate);
    if (!Number.isFinite(r) || r < lo - 1e-12 || r > hi + 1e-12) throw new GameError(`Lãi suất cơ bản từ ${pctDay(lo)} tới ${pctDay(hi)} (lãi chính sách ${pctDay(policyRate)} ± ${pctDay(RATE_POWER.band)}).`);
    setMeta(RATE_KEY, JSON.stringify({ rate: Math.round(r * 1e7) / 1e7, clanId: clan.id, week, at: now }));
    news(`🏛️ Ngân hàng nhà nước (${clan.name}) đặt lãi suất cơ bản ${pctDay(r)} (lãi chính sách ${pctDay(policyRate)})`, now);
    return { message: `Đã đặt lãi suất cơ bản ${pctDay(r)} tới phiên họp sau của Ngân hàng Trung ương.` };
  });
}

/**
 * Sau phiên họp Chủ nhật: nếu tuần vừa qua gia tộc tự đặt lãi thấp hơn lãi chính sách mà lượng xu tăng quá 15%,
 * gia tộc bị phạt 50.000 xu (vào ngân sách); lần thứ hai trong 28 ngày thì mất ghế Ngân hàng nhà nước.
 * `prevOverride` là lựa chọn của gia tộc trước phiên họp (đọc trước khi họp).
 */
export function rateWeek(prevOverride, prevPolicy, now = Date.now()) {
  if (!prevOverride || !(prevOverride.rate < prevPolicy)) return null;
  const row = q.latestWeek.get();
  if (!row || row.growth <= RATE_POWER.growthCap) return null;
  return transaction(() => {
    const clan = q.clan.get(prevOverride.clanId);
    if (!clan || clan.dissolved_at) return null;
    const have = breakDepositsFor(clan.id, RATE_POWER.penalty, 'nộp phạt điều hành lãi suất', now);
    const penalty = Math.min(RATE_POWER.penalty, have);
    if (penalty > 0) {
      post({ account: clanAccount(clan.id), delta: -penalty, kind: 'rate_penalty', memo: `Lượng xu tăng ${(row.growth * 100).toFixed(1)}%/tuần`, now });
      post({ account: 'treasury', delta: penalty, kind: 'rate_penalty', memo: `Phạt Ngân hàng nhà nước ${clan.name}`, now });
    }
    const prior = q.strikes.all(clan.id, now - RATE_POWER.strikeDays * DAY).length;
    const lost = prior >= 1;
    q.insertStrike.run(clan.id, row.week, row.growth, penalty, lost ? 1 : 0, now);
    if (lost) {
      q.dropSeat.run(clan.id);
      setMeta(RATE_KEY, 'null');
      news(`🏛️ Gia tộc ${clan.name} mất ghế Ngân hàng nhà nước vì để lượng xu tăng quá nhanh hai lần trong ${RATE_POWER.strikeDays} ngày`, now);
    } else news(`🏛️ Gia tộc ${clan.name} bị phạt ${fmt(penalty)} xu vì hạ lãi suất khi lượng xu tăng ${(row.growth * 100).toFixed(1)}%/tuần`, now);
    adminLog('Ngân hàng Trung ương', 'rate_strike', null, { clanId: clan.id, growth: row.growth, penalty, lost });
    return { penalty, lost };
  });
}

/** Lựa chọn lãi suất hiện hành của gia tộc (đọc trước phiên họp để rateWeek xét). */
export function currentOverride() {
  try {
    const o = JSON.parse(getMeta(RATE_KEY) ?? 'null');
    return o && o.week === economy().week ? o : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- xem

const issueRow = (i, now) => ({
  id: i.id, issuer: issuerName(i), issuerKind: i.issuer_kind, issuerId: i.issuer_id, face: i.face, coupon: i.coupon, termDays: i.term_days,
  qty: i.qty, sold: i.sold, status: i.status, closesAt: i.closes_at, maturesAt: i.matures_at, arrears: i.arrears,
  per100: couponOf(100, i.coupon), open: i.status === 'subscribing' && i.closes_at > now, cap: Math.floor(i.qty * BONDS.holderCap),
});

export function bondsView(userId, now = Date.now()) {
  closeBondSubs(now);
  const eco = economy();
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  const leader = Boolean(clan && !clan.dissolved_at && m.role === 'leader' && !isDeposed(clan.id, userId));
  const sb = q.stateBank.get();
  const issues = q.listed.all(now - 7 * DAY);
  const byId = new Map(issues.map((i) => [i.id, i]));
  return {
    rules: BONDS, ratePower: RATE_POWER,
    baseRate: eco.baseRate, policyRate: eco.policyRate, rateSetBy: eco.rateSetBy ? q.clan.get(eco.rateSetBy)?.name ?? null : null,
    couponRange: couponRange(eco.baseRate), rateBand: rateBand(eco.policyRate),
    issues: issues.map((i) => issueRow(i, now)),
    asks: q.asks.all().map((a) => ({ id: a.id, issueId: a.issue_id, qty: a.qty, price: a.price, mine: (a.holder_kind === 'user' && a.holder_id === userId) || (leader && a.holder_kind === 'clan' && a.holder_id === clan.id), issuer: byId.get(a.issue_id) ? issuerName(byId.get(a.issue_id)) : '' })),
    holdings: q.mine.all('user', userId).map((h) => ({ issueId: h.issue_id, qty: h.qty, listed: h.listed, issuer: issuerName(h), coupon: h.coupon, status: h.status, maturesAt: h.matures_at })),
    clan: clan && !clan.dissolved_at ? {
      id: clan.id, name: clan.name, leader, rateHolder: Boolean(sb && sb.id === clan.id),
      inDefault: bondsInDefault(clan.id),
      room: leader ? Math.max(0, Math.floor((Math.floor(bookValue(clan.id, now) * 1_000 * BONDS.clanBookShare) - q.outstanding.get(clan.id).face - q.pending.get(clan.id).face) / BONDS.face)) : 0,
      holdings: leader ? q.mine.all('clan', clan.id).map((h) => ({ issueId: h.issue_id, qty: h.qty, listed: h.listed, issuer: issuerName(h) })) : [],
      strikes: leader && sb?.id === clan.id ? q.strikes.all(clan.id, now - RATE_POWER.strikeDays * DAY).length : 0,
    } : null,
  };
}

export function adminBondsView(now = Date.now()) {
  const eco = economy();
  return {
    baseRate: eco.baseRate, policyRate: eco.policyRate, rateSetBy: eco.rateSetBy ? q.clan.get(eco.rateSetBy)?.name ?? null : null,
    couponRange: couponRange(eco.baseRate),
    issues: q.listed.all(now - 30 * DAY).map((i) => issueRow(i, now)),
    strikes: q.allStrikes.all().map((s) => ({ clan: s.name, week: s.week, growth: s.growth, penalty: s.penalty, lost: Boolean(s.lost), at: s.at })),
  };
}

