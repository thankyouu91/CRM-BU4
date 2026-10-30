// Quản trị gia tộc: bỏ phiếu phế truất tộc trưởng (người bị phế truất mất quyền quản trị vĩnh viễn trong gia tộc đó)
// và tiền gửi kỳ hạn của quỹ gia tộc (rút trước hạn bị phạt; quỹ cạn thì hệ thống tự rút gấp).
import { economy } from './bank.js';
import { db, getUser, transaction } from './db.js';
import { DAY, GameError, HOUR } from './game.js';
import { post } from './ledger.js';
import { ceilCoins, floorCoins } from './rules/production.js';
import { CLAN_BANK, CLAN_GOV, clanDepositPayout, clanDepositRate, voteOutcome } from './rules/finance.js';

const clanAccount = (id) => `clan:${id}`;
const depositAccount = (id) => `clandep:${id}`;
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

const q = {
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  members: db.prepare('SELECT m.*, u.username FROM clan_members m JOIN users u ON u.id = m.user_id WHERE m.clan_id = ? ORDER BY m.joined_at'),
  setRole: db.prepare('UPDATE clan_members SET role = ? WHERE user_id = ?'),
  setLeader: db.prepare('UPDATE clans SET leader_id = ? WHERE id = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),

  openVote: db.prepare("SELECT * FROM clan_votes WHERE clan_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1"),
  lastFailed: db.prepare("SELECT * FROM clan_votes WHERE clan_id = ? AND status = 'failed' ORDER BY closed_at DESC LIMIT 1"),
  vote: db.prepare('SELECT * FROM clan_votes WHERE id = ?'),
  allOpen: db.prepare("SELECT * FROM clan_votes WHERE status = 'open'"),
  insertVote: db.prepare(`
    INSERT INTO clan_votes (clan_id, kind, target_id, candidate_id, started_by, started_at, ends_at) VALUES (?, 'depose', ?, ?, ?, ?, ?)`),
  closeVote: db.prepare('UPDATE clan_votes SET status = ?, closed_at = ? WHERE id = ?'),
  ballot: db.prepare(`
    INSERT INTO clan_ballots (vote_id, user_id, yes, at) VALUES (?, ?, ?, ?)
    ON CONFLICT (vote_id, user_id) DO UPDATE SET yes = excluded.yes, at = excluded.at`),
  ballots: db.prepare('SELECT b.* FROM clan_ballots b JOIN clan_members m ON m.user_id = b.user_id AND m.clan_id = ? WHERE b.vote_id = ?'),
  history: db.prepare("SELECT * FROM clan_votes WHERE clan_id = ? AND status != 'open' ORDER BY id DESC LIMIT 5"),
  deposed: db.prepare('SELECT 1 FROM clan_deposed WHERE clan_id = ? AND user_id = ?'),
  deposedList: db.prepare('SELECT d.user_id, d.at, u.username FROM clan_deposed d JOIN users u ON u.id = d.user_id WHERE d.clan_id = ? ORDER BY d.at DESC'),
  addDeposed: db.prepare('INSERT OR IGNORE INTO clan_deposed (clan_id, user_id, at) VALUES (?, ?, ?)'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),

  deposits: db.prepare('SELECT * FROM clan_deposits WHERE clan_id = ? AND closed_at IS NULL ORDER BY matures_at'),
  deposit: db.prepare('SELECT * FROM clan_deposits WHERE id = ?'),
  matured: db.prepare('SELECT * FROM clan_deposits WHERE closed_at IS NULL AND matures_at <= ?'),
  closedDeposits: db.prepare('SELECT * FROM clan_deposits WHERE clan_id = ? AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 5'),
  insertDeposit: db.prepare('INSERT INTO clan_deposits (clan_id, amount, rate, term_days, opened_at, matures_at) VALUES (?, ?, ?, ?, ?, ?)'),
  closeDeposit: db.prepare('UPDATE clan_deposits SET closed_at = ?, payout = ?, penalty = ?, close_kind = ? WHERE id = ?'),
};

export const clanFund = (clanId) => q.account.get(clanAccount(clanId))?.balance ?? 0;
export const isDeposed = (clanId, userId) => Boolean(q.deposed.get(clanId, userId));

function clanOf(userId) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  return { clan, member: m };
}

/** Chỉ tộc trưởng đương nhiệm (chưa từng bị phế truất ở gia tộc này) mới vào được bảng quản trị. */
function mustLeader(userId, what) {
  const ctx = clanOf(userId);
  if (ctx.member.role !== 'leader' || isDeposed(ctx.clan.id, userId)) throw new GameError(`Chỉ tộc trưởng mới được ${what}.`);
  return ctx;
}

// ---------------------------------------------------------------- bỏ phiếu phế truất

const eligibleVoters = (clanId, leaderId) => q.members.all(clanId).filter((m) => m.user_id !== leaderId);

/** Mở phiếu phế truất tộc trưởng, đề cử `candidateId` lên thay. Người mở phiếu tự bỏ phiếu thuận. */
export function startDepose(userId, candidateId, now = Date.now()) {
  return transaction(() => {
    const { clan, member } = clanOf(userId);
    if (member.role === 'leader') throw new GameError('Tộc trưởng muốn nghỉ thì nhường chức, không cần bỏ phiếu.');
    if (now - member.joined_at < CLAN_GOV.joinedHours * HOUR) throw new GameError(`Cần ở gia tộc đủ ${CLAN_GOV.joinedHours} giờ mới được mở phiếu.`);
    const all = q.members.all(clan.id);
    if (all.length < CLAN_GOV.minMembers) throw new GameError(`Gia tộc cần ít nhất ${CLAN_GOV.minMembers} người mới bỏ phiếu phế truất được.`);
    if (q.openVote.get(clan.id)) throw new GameError('Đang có một cuộc bỏ phiếu, chờ kết quả đã.');
    const failed = q.lastFailed.get(clan.id);
    if (failed && now - failed.closed_at < CLAN_GOV.cooldownDays * DAY) {
      throw new GameError(`Lần bỏ phiếu trước không thành, ${CLAN_GOV.cooldownDays} ngày sau mới mở lại được.`);
    }
    const candidate = all.find((m) => m.user_id === candidateId);
    if (!candidate || candidate.role === 'leader') throw new GameError('Người được đề cử phải là thành viên khác trong gia tộc.');
    if (isDeposed(clan.id, candidateId)) throw new GameError('Người này từng bị phế truất, không thể làm tộc trưởng nữa.');
    const id = Number(q.insertVote.run(clan.id, clan.leader_id, candidateId, userId, now, now + CLAN_GOV.voteHours * HOUR).lastInsertRowid);
    q.ballot.run(id, userId, 1, now);
    const result = resolveVote(q.vote.get(id), now);
    return { message: result === 'passed' ? 'Phiếu phế truất đã đủ số thuận và được thông qua ngay.' : `Đã mở phiếu phế truất, đề cử ${candidate.username}. Phiếu đóng sau ${CLAN_GOV.voteHours} giờ.` };
  });
}

export function castBallot(userId, voteId, yes, now = Date.now()) {
  return transaction(() => {
    const { clan } = clanOf(userId);
    const vote = q.vote.get(voteId);
    if (!vote || vote.clan_id !== clan.id || vote.status !== 'open') throw new GameError('Không có cuộc bỏ phiếu này.');
    if (userId === vote.target_id) throw new GameError('Tộc trưởng không bỏ phiếu cho chính mình.');
    q.ballot.run(vote.id, userId, yes ? 1 : 0, now);
    const result = resolveVote(vote, now);
    if (result === 'passed') return { message: 'Đủ phiếu thuận: tộc trưởng đã bị phế truất.' };
    if (result === 'failed') return { message: 'Phiếu phế truất không thể đủ số thuận nữa, đã khép lại.' };
    return { message: yes ? 'Đã bỏ phiếu thuận.' : 'Đã bỏ phiếu chống.' };
  });
}

/** Đếm phiếu; thông qua thì đổi tộc trưởng và ghi người bị phế truất. Gọi trong transaction. */
function resolveVote(vote, now) {
  const clan = q.clan.get(vote.clan_id);
  // Tộc trưởng đã đổi (nhường chức, rời gia tộc) hoặc gia tộc giải tán: phiếu không còn ý nghĩa.
  if (!clan || clan.dissolved_at || clan.leader_id !== vote.target_id || !q.member.get(vote.candidate_id) || q.member.get(vote.candidate_id).clan_id !== clan.id) {
    q.closeVote.run('cancelled', now, vote.id);
    return 'cancelled';
  }
  const voters = eligibleVoters(clan.id, vote.target_id).map((m) => m.user_id);
  const ballots = q.ballots.all(clan.id, vote.id).filter((b) => voters.includes(b.user_id));
  const yes = ballots.filter((b) => b.yes).length;
  const result = voteOutcome({ yes, no: ballots.length - yes, eligible: voters.length, expired: now >= vote.ends_at });
  if (result === 'open') return result;
  q.closeVote.run(result, now, vote.id);
  if (result === 'passed') {
    q.setRole.run('member', vote.target_id);
    q.setRole.run('leader', vote.candidate_id);
    q.setLeader.run(vote.candidate_id, clan.id);
    q.addDeposed.run(clan.id, vote.target_id, now);
    const oldName = getUser(vote.target_id)?.username ?? 'tộc trưởng cũ';
    const newName = getUser(vote.candidate_id)?.username ?? 'tộc trưởng mới';
    q.insertNews.run(`⚖️ ${clan.emblem} ${clan.name}: thành viên bỏ phiếu phế truất ${oldName}, ${newName} lên làm tộc trưởng`, now, now, now + 2 * DAY);
  }
  return result;
}

/** Khép các phiếu đã hết giờ (gọi định kỳ). */
export function resolveVotes(now = Date.now()) {
  transaction(() => {
    for (const vote of q.allOpen.all()) resolveVote(vote, now);
  });
}

// ---------------------------------------------------------------- tiền gửi gia tộc

/** Tộc trưởng gửi kỳ hạn từ quỹ gia tộc. */
export function openClanDeposit(userId, amount, term, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'gửi tiền kỳ hạn');
    if (!CLAN_BANK.termPremium[term]) throw new GameError('Kỳ hạn chỉ có 3, 7 hoặc 14 ngày.');
    if (!Number.isInteger(amount) || amount < CLAN_BANK.minDeposit) throw new GameError(`Gửi tối thiểu ${fmt(CLAN_BANK.minDeposit)} xu.`);
    if (clanFund(clan.id) < amount) throw new GameError(`Quỹ gia tộc chỉ còn ${fmt(clanFund(clan.id))} xu.`);
    const rate = clanDepositRate(economy().baseRate, term);
    post({ account: clanAccount(clan.id), delta: -amount, kind: 'clan_deposit', memo: `Kỳ hạn ${term} ngày`, now });
    post({ account: depositAccount(clan.id), delta: amount, kind: 'clan_deposit', memo: `Kỳ hạn ${term} ngày`, now });
    q.insertDeposit.run(clan.id, amount, rate, term, now, now + term * DAY);
    return { message: `🏦 Quỹ ${clan.name} gửi ${fmt(amount)} xu kỳ hạn ${term} ngày, đáo hạn lãi ${fmt(Math.floor(amount * rate * term))} xu.` };
  });
}

/** Trả một khoản gửi về quỹ: đúng hạn có lãi; trước hạn mất lãi và bị phạt (một nửa tiền phạt vào ngân sách thị trấn). */
function settleDeposit(dep, now, { emergency = false } = {}) {
  const pay = clanDepositPayout(dep, now, { emergency });
  post({ account: depositAccount(dep.clan_id), delta: -dep.amount, kind: 'clan_deposit_close', memo: `Khoản #${dep.id}`, now });
  post({ account: clanAccount(dep.clan_id), delta: pay.principal, kind: 'clan_deposit_close', memo: `Khoản #${dep.id}`, now });
  if (pay.interest) post({ account: clanAccount(dep.clan_id), delta: pay.interest, kind: 'clan_interest', memo: `Kỳ hạn ${dep.term_days} ngày`, now });
  if (pay.penalty) {
    const half = Math.floor(pay.penalty / 2);
    if (half > 0) post({ account: 'treasury', delta: half, kind: 'clan_penalty', memo: `Phạt rút trước hạn khoản #${dep.id}`, now });
  }
  q.closeDeposit.run(now, pay.principal + pay.interest, pay.penalty, pay.kind, dep.id);
  return pay;
}

/** Tộc trưởng rút gấp một khoản (trước hạn bị phạt). */
export function withdrawClanDeposit(userId, depositId, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustLeader(userId, 'rút tiền gửi');
    const dep = q.deposit.get(depositId);
    if (!dep || dep.clan_id !== clan.id || dep.closed_at) throw new GameError('Không tìm thấy khoản gửi này.');
    const pay = settleDeposit(dep, now);
    return {
      message: pay.kind === 'matured'
        ? `Tất toán đúng hạn: ${fmt(pay.principal)} gốc + ${fmt(pay.interest)} lãi về quỹ.`
        : `Rút gấp trước hạn: về quỹ ${fmt(pay.principal)} xu, mất lãi và bị phạt ${fmt(pay.penalty)} xu.`,
    };
  });
}

/**
 * Quỹ thiếu `need` xu để trả một khoản bắt buộc (phí duy trì, thuế...): tự rút gấp các khoản gửi, khoản sắp đáo hạn trước,
 * cho tới khi đủ. Trả về số xu đã rút về quỹ. Gọi trong transaction.
 */
export function coverFromDeposits(clanId, need, now = Date.now()) {
  let got = 0;
  for (const dep of q.deposits.all(clanId)) {
    if (got >= need) break;
    const pay = settleDeposit(dep, now, { emergency: true });
    got += pay.principal + pay.interest;
    q.insertNews.run(`🏦 Quỹ gia tộc ${q.clan.get(clanId)?.name ?? ''} cạn tiền, rút gấp khoản gửi #${dep.id} (phạt ${fmt(pay.penalty)} xu)`, now, now, now + DAY);
  }
  return got;
}

/** Cuối ngày: khoản đáo hạn tự về quỹ kèm lãi; phiếu hết giờ thì khép. */
export function settleClanGovDay(endTs) {
  transaction(() => {
    for (const dep of q.matured.all(endTs)) settleDeposit(dep, endTs);
  });
  resolveVotes(endTs);
}

/** Tổng tiền gửi đang nằm ở ngân hàng của gia tộc. */
export const clanDeposited = (clanId) => q.deposits.all(clanId).reduce((s, d) => s + d.amount, 0);

// ---------------------------------------------------------------- xem

/** Phần quản trị trong màn gia tộc: phiếu đang mở, người bị phế truất, quyền vào bảng quản trị, tiền gửi. */
export function clanGovView(userId, clanId, now = Date.now()) {
  const clan = q.clan.get(clanId);
  const me = q.member.get(userId);
  const open = q.openVote.get(clanId);
  let vote = null;
  if (open) {
    const voters = eligibleVoters(clanId, open.target_id);
    const ballots = q.ballots.all(clanId, open.id).filter((b) => voters.some((v) => v.user_id === b.user_id));
    const yes = ballots.filter((b) => b.yes).length;
    vote = {
      id: open.id,
      target: getUser(open.target_id)?.username,
      candidate: getUser(open.candidate_id)?.username,
      startedBy: getUser(open.started_by)?.username,
      endsAt: open.ends_at,
      yes,
      no: ballots.length - yes,
      eligible: voters.length,
      need: Math.floor(voters.length * CLAN_GOV.threshold) + 1,
      mine: ballots.find((b) => b.user_id === userId)?.yes ?? null,
      canVote: userId !== open.target_id,
    };
  }
  const deposed = q.deposedList.all(clanId).map((d) => ({ id: d.user_id, username: d.username, at: d.at }));
  const iAmDeposed = deposed.some((d) => d.id === userId);
  const failed = q.lastFailed.get(clanId);
  const { baseRate } = economy();
  return {
    canManage: me?.role === 'leader' && !iAmDeposed,
    iAmDeposed,
    vote,
    deposed,
    history: q.history.all(clanId).map((v) => ({ id: v.id, status: v.status, target: getUser(v.target_id)?.username, candidate: getUser(v.candidate_id)?.username, closedAt: v.closed_at })),
    cooldownUntil: failed ? failed.closed_at + CLAN_GOV.cooldownDays * DAY : null,
    rules: CLAN_GOV,
    leaderId: clan?.leader_id ?? null,
    bank: {
      rules: CLAN_BANK,
      terms: Object.keys(CLAN_BANK.termPremium).map((t) => ({ days: Number(t), rate: clanDepositRate(baseRate, Number(t)) })),
      deposits: q.deposits.all(clanId).map((d) => ({
        id: d.id, amount: d.amount, rate: d.rate, termDays: d.term_days, openedAt: d.opened_at, maturesAt: d.matures_at,
        interest: floorCoins(d.amount * d.rate * d.term_days), earlyPenalty: ceilCoins(d.amount * CLAN_BANK.earlyPenalty),
      })),
      closed: q.closedDeposits.all(clanId).map((d) => ({ id: d.id, amount: d.amount, payout: d.payout, penalty: d.penalty, kind: d.close_kind, closedAt: d.closed_at })),
      total: clanDeposited(clanId),
    },
  };
}
