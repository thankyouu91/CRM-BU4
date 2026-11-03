// Hụi (chơi hụi bỏ thăm): nhóm người chơi, hoặc "hụi lớn" giữa các gia tộc (góp bằng quỹ gia tộc, tộc trưởng thao tác).
// Mỗi kỳ (1 ngày, chốt lúc quyết toán đêm) mọi thành viên góp một khoản bằng nhau vào quỹ hụi; một người chưa hốt
// sẽ hốt cả quỹ: người bỏ thăm cao nhất (nhận quỹ trừ tiền thăm, tiền thăm chia cho người cùng góp), không ai bỏ thăm
// thì kỳ đầu chủ hụi hốt, các kỳ sau theo thứ tự vào nhóm. Tới kỳ mà không đủ tiền góp thì bị loại, không hoàn tiền.
import { sendMail } from './chat.js';
import { addCredit } from './credit.js';
import { db, getUser, transaction } from './db.js';
import { dayKey, startOfDay } from './clock.js';
import { DAY, GameError } from './game.js';
import { post } from './ledger.js';
import { HUI, pickWinner, splitPot } from './rules/finance.js';

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const potAccount = (id) => `hui:${id}`;
const clanAccount = (id) => `clan:${id}`;

const q = {
  group: db.prepare('SELECT * FROM hui_groups WHERE id = ?'),
  insert: db.prepare('INSERT INTO hui_groups (name, scope, owner_id, amount, size, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  start: db.prepare("UPDATE hui_groups SET status = 'running', size = ?, round = 0, next_round_at = ? WHERE id = ?"),
  advance: db.prepare('UPDATE hui_groups SET round = ?, next_round_at = ?, status = ?, closed_at = ? WHERE id = ?'),
  cancel: db.prepare("UPDATE hui_groups SET status = 'cancelled', closed_at = ? WHERE id = ?"),
  open: db.prepare("SELECT * FROM hui_groups WHERE status = 'open' ORDER BY created_at DESC LIMIT 40"),
  staleOpen: db.prepare("SELECT * FROM hui_groups WHERE status = 'open' AND created_at <= ?"),
  dueRounds: db.prepare("SELECT * FROM hui_groups WHERE status = 'running' AND next_round_at <= ? ORDER BY id"),
  mine: db.prepare(`
    SELECT g.* FROM hui_groups g JOIN hui_members m ON m.group_id = g.id
    WHERE g.scope = ? AND m.member_id = ? AND (g.status IN ('open', 'running') OR g.closed_at >= ?) ORDER BY g.id DESC LIMIT 20`),

  members: db.prepare('SELECT * FROM hui_members WHERE group_id = ? ORDER BY joined_at, member_id'),
  clanLeader: db.prepare("SELECT user_id FROM clan_members WHERE clan_id = ? AND role = 'leader'"),
  member: db.prepare('SELECT * FROM hui_members WHERE group_id = ? AND member_id = ?'),
  count: db.prepare("SELECT COUNT(*) AS n FROM hui_members WHERE group_id = ? AND status = 'active'"),
  join: db.prepare('INSERT INTO hui_members (group_id, member_id, joined_at) VALUES (?, ?, ?)'),
  leave: db.prepare('DELETE FROM hui_members WHERE group_id = ? AND member_id = ?'),
  paid: db.prepare('UPDATE hui_members SET paid = paid + ? WHERE group_id = ? AND member_id = ?'),
  got: db.prepare('UPDATE hui_members SET got = got + ? WHERE group_id = ? AND member_id = ?'),
  won: db.prepare('UPDATE hui_members SET received = ? WHERE group_id = ? AND member_id = ?'),
  out: db.prepare("UPDATE hui_members SET status = 'out', out_at = ? WHERE group_id = ? AND member_id = ?"),
  activeGroups: db.prepare(`
    SELECT COUNT(*) AS n FROM hui_members m JOIN hui_groups g ON g.id = m.group_id
    WHERE g.scope = ? AND m.member_id = ? AND m.status = 'active' AND g.status IN ('open', 'running')`),

  bid: db.prepare(`
    INSERT INTO hui_bids (group_id, round, member_id, bid, at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (group_id, round, member_id) DO UPDATE SET bid = excluded.bid, at = excluded.at`),
  bids: db.prepare('SELECT * FROM hui_bids WHERE group_id = ? AND round = ?'),
  insertRound: db.prepare('INSERT INTO hui_rounds (group_id, round, winner_id, pot, bid, payers, dropped, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  rounds: db.prepare('SELECT * FROM hui_rounds WHERE group_id = ? ORDER BY round'),

  clanMember: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  setBan: db.prepare('UPDATE users SET hui_ban_until = ? WHERE id = ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const MAX_GROUPS = 3; // mỗi người (hoặc gia tộc) tham gia tối đa 3 nhóm hụi cùng lúc

/** Ai đang thao tác: người chơi (hụi người chơi) hoặc gia tộc của tộc trưởng (hụi gia tộc). */
function actorFor(userId, scope) {
  if (scope === 'player') {
    const user = getUser(userId);
    return { id: userId, name: user.username, user };
  }
  if (scope !== 'clan') throw new GameError('Loại hụi không hợp lệ.');
  const m = q.clanMember.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Hụi gia tộc dành cho tộc trưởng các gia tộc.');
  const deposed = db.prepare('SELECT 1 FROM clan_deposed WHERE clan_id = ? AND user_id = ?').get(clan.id, userId);
  if (m.role !== 'leader' || deposed) throw new GameError('Chỉ tộc trưởng mới cho gia tộc chơi hụi.');
  return { id: clan.id, name: `${clan.emblem} ${clan.name}`, clan };
}

const nameOf = (scope, id) => (scope === 'player' ? getUser(id)?.username : (() => {
  const c = q.clan.get(id);
  return c ? `${c.emblem} ${c.name}` : `Gia tộc #${id}`;
})()) ?? `#${id}`;

function checkBan(scope, actor, now) {
  if (scope === 'player' && actor.user.hui_ban_until > now) {
    throw new GameError('Bạn từng bỏ hụi nên đang bị cấm chơi hụi tới ' + new Date(actor.user.hui_ban_until).toLocaleDateString('vi-VN') + '.');
  }
  if (q.activeGroups.get(scope, actor.id).n >= MAX_GROUPS) throw new GameError(`Mỗi ${scope === 'clan' ? 'gia tộc' : 'người'} chơi tối đa ${MAX_GROUPS} dây hụi cùng lúc.`);
}

/** Lập dây hụi: chủ hụi là thành viên đầu tiên. */
export function createHui(userId, { scope = 'player', name, amount, size }, now = Date.now()) {
  return transaction(() => {
    const rules = HUI[scope];
    if (!rules) throw new GameError('Loại hụi không hợp lệ.');
    const actor = actorFor(userId, scope);
    checkBan(scope, actor, now);
    const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
    if ([...clean].length < 3 || [...clean].length > 30) throw new GameError('Tên dây hụi dài 3–30 ký tự.');
    if (!Number.isInteger(amount) || amount < rules.minAmount || amount > rules.maxAmount) throw new GameError(`Tiền góp mỗi kỳ từ ${fmt(rules.minAmount)} đến ${fmt(rules.maxAmount)} xu.`);
    if (!Number.isInteger(size) || size < rules.minSize || size > rules.maxSize) throw new GameError(`Dây hụi có ${rules.minSize}–${rules.maxSize} ${scope === 'clan' ? 'gia tộc' : 'người'}.`);
    const id = Number(q.insert.run(clean, scope, actor.id, amount, size, now).lastInsertRowid);
    q.join.run(id, actor.id, now);
    if (scope === 'clan') q.insertNews.run(`🔄 ${actor.name} mở dây hụi lớn "${clean}": ${size} gia tộc, mỗi kỳ góp ${fmt(amount)} xu`, now, now, now + 2 * DAY);
    return { message: `Đã lập dây hụi "${clean}". Đủ ${size} ${scope === 'clan' ? 'gia tộc' : 'người'} thì bắt đầu, mỗi đêm một kỳ.` };
  });
}

export function joinHui(userId, groupId, now = Date.now()) {
  return transaction(() => {
    const g = q.group.get(groupId);
    if (!g || g.status !== 'open') throw new GameError('Dây hụi này không nhận thêm người.');
    const actor = actorFor(userId, g.scope);
    if (q.member.get(g.id, actor.id)) throw new GameError('Bạn đã ở trong dây hụi này.');
    checkBan(g.scope, actor, now);
    q.join.run(g.id, actor.id, now);
    if (q.count.get(g.id).n >= g.size) startGroup(g, now);
    return { message: `Đã vào dây hụi "${g.name}".` };
  });
}

/** Rời dây hụi khi chưa bắt đầu (chưa góp kỳ nào nên không mất gì). Chủ hụi rời thì hủy dây. */
export function leaveHui(userId, groupId, now = Date.now()) {
  return transaction(() => {
    const g = q.group.get(groupId);
    if (!g) throw new GameError('Không có dây hụi này.');
    const actor = actorFor(userId, g.scope);
    if (!q.member.get(g.id, actor.id)) throw new GameError('Bạn không ở dây hụi này.');
    if (g.status !== 'open') throw new GameError('Hụi đã chạy thì không rời được: bỏ kỳ góp là bị loại và mất tiền đã góp.');
    if (g.owner_id === actor.id) {
      q.cancel.run(now, g.id);
      return { message: 'Đã hủy dây hụi.' };
    }
    q.leave.run(g.id, actor.id);
    return { message: 'Đã rời dây hụi.' };
  });
}

/** Chủ hụi cho dây chạy sớm khi đã đủ số người tối thiểu. */
export function startHuiNow(userId, groupId, now = Date.now()) {
  return transaction(() => {
    const g = q.group.get(groupId);
    if (!g || g.status !== 'open') throw new GameError('Dây hụi này không ở trạng thái chờ.');
    const actor = actorFor(userId, g.scope);
    if (g.owner_id !== actor.id) throw new GameError('Chỉ chủ hụi mới cho dây chạy.');
    const n = q.count.get(g.id).n;
    if (n < HUI[g.scope].minSize) throw new GameError(`Cần ít nhất ${HUI[g.scope].minSize} thành viên.`);
    startGroup(g, now);
    return { message: `Dây hụi "${g.name}" bắt đầu với ${n} thành viên: kỳ 1 chốt đêm nay.` };
  });
}

/**
 * Cho dây chạy và báo cho từng thành viên qua hộp thư. Kỳ đầu chốt ở lần quyết toán nửa đêm hôm nay (giờ Việt Nam);
 * dây được cho chạy ngay trong một lần quyết toán (`atSettlement`) thì kỳ đầu chốt ở lần quyết toán sau,
 * để thành viên kịp biết và chuẩn bị tiền góp.
 */
function startGroup(g, now, { atSettlement = false } = {}) {
  const n = q.count.get(g.id).n;
  const firstRound = atSettlement ? now + DAY : startOfDay(dayKey(now)) + DAY - 1;
  q.start.run(n, firstRound, g.id);
  for (const m of q.members.all(g.id)) {
    if (m.status !== 'active') continue;
    const to = g.scope === 'player' ? m.member_id : q.clanLeader.get(m.member_id)?.user_id;
    if (!to) continue;
    sendMail({
      to,
      fromName: 'Ngân hàng Trân Châu',
      subject: `Dây hụi "${g.name}" bắt đầu chạy`,
      body: `Dây hụi "${g.name}" đã đủ ${n} thành viên và bắt đầu chạy. Mỗi kỳ góp ${fmt(g.amount)} xu${g.scope === 'clan' ? ' từ quỹ gia tộc' : ''}; kỳ 1 chốt lúc nửa đêm ${dayKey(firstRound)}.\nKhông đủ tiền góp đúng kỳ là bị loại và mất số đã góp.`,
      now,
    });
  }
}

/** Bỏ thăm cho kỳ đang tới (chỉ người chưa hốt). Tiền thăm tối đa maxBidRatio quỹ kỳ đó. */
export function bidHui(userId, groupId, bid, now = Date.now()) {
  return transaction(() => {
    const g = q.group.get(groupId);
    if (!g || g.status !== 'running') throw new GameError('Dây hụi này không đang chạy.');
    const actor = actorFor(userId, g.scope);
    const m = q.member.get(g.id, actor.id);
    if (!m || m.status !== 'active') throw new GameError('Bạn không còn trong dây hụi này.');
    if (m.received) throw new GameError('Bạn đã hốt hụi rồi, chỉ còn góp đều tới hết dây.');
    const pot = g.amount * q.count.get(g.id).n;
    const max = Math.floor(pot * HUI.maxBidRatio);
    if (!Number.isInteger(bid) || bid < 0 || bid > max) throw new GameError(`Tiền thăm từ 0 đến ${fmt(max)} xu (${Math.round(HUI.maxBidRatio * 100)}% quỹ kỳ).`);
    q.bid.run(g.id, g.round + 1, actor.id, bid, now);
    return { message: bid ? `Đã bỏ thăm ${fmt(bid)} xu cho kỳ ${g.round + 1}.` : 'Đã rút thăm.' };
  });
}

/** Thu tiền góp của một thành viên; không đủ thì trả false (không trừ gì). */
function collect(g, memberId, at) {
  const memo = `Hụi "${g.name}" kỳ ${g.round + 1}`;
  if (g.scope === 'player') {
    if ((getUser(memberId)?.coins ?? 0) < g.amount) return false;
    post({ userId: memberId, delta: -g.amount, kind: 'hui_pay', memo, now: at });
  } else {
    if ((q.account.get(clanAccount(memberId))?.balance ?? 0) < g.amount) return false;
    post({ account: clanAccount(memberId), delta: -g.amount, kind: 'hui_pay', memo, now: at });
  }
  post({ account: potAccount(g.id), delta: g.amount, kind: 'hui_pay', memo, now: at });
  q.paid.run(g.amount, g.id, memberId);
  return true;
}

function payOut(g, memberId, amount, kind, memo, at) {
  if (amount <= 0) return;
  post({ account: potAccount(g.id), delta: -amount, kind, memo, now: at });
  if (g.scope === 'player') post({ userId: memberId, delta: amount, kind, memo, now: at });
  else post({ account: clanAccount(memberId), delta: amount, kind, memo, now: at });
  q.got.run(amount, g.id, memberId);
}

/** Loại một thành viên bỏ kỳ: không hoàn tiền; người chơi bị trừ tín dụng và cấm chơi hụi một thời gian. */
function dropMember(g, m, at) {
  q.out.run(at, g.id, m.member_id);
  if (g.scope === 'player') {
    addCredit(m.member_id, m.received ? HUI.creditPenalty : HUI.creditPenaltyBeforeWin, `Bỏ hụi "${g.name}"${m.received ? ' sau khi đã hốt' : ''}`, at);
    q.setBan.run(at + HUI.banDays * DAY, m.member_id);
  }
  q.insertNews.run(`🔄 ${nameOf(g.scope, m.member_id)} không đóng hụi "${g.name}" kỳ ${g.round + 1}: bị loại, mất ${fmt(m.paid)} xu đã góp`, at, at, at + DAY);
}

/** Chốt một kỳ: thu góp (ai thiếu thì loại), chọn người hốt, chia tiền thăm. */
function runRound(g, at) {
  const round = g.round + 1;
  const memo = `Hụi "${g.name}" kỳ ${round}`;
  const payers = [];
  let dropped = 0;
  for (const m of q.members.all(g.id)) {
    if (m.status !== 'active') continue;
    if (collect(g, m.member_id, at)) payers.push({ ...m, paid: m.paid + g.amount });
    else {
      dropMember(g, m, at);
      dropped += 1;
    }
  }
  const pot = payers.length * g.amount;
  const eligible = payers.filter((m) => !m.received).map((m) => m.member_id);
  // Trần tiền thăm tính lại theo quỹ thực tế (đã trừ người bị loại kỳ này): thăm vượt trần thì kéo về trần.
  const cap = Math.floor(pot * HUI.maxBidRatio);
  const bids = q.bids.all(g.id, round).map((b) => ({ ...b, bid: Math.min(b.bid, cap) }));
  const pick = pickWinner(eligible, bids, round, g.owner_id);
  let winnerId = null;
  let bid = 0;
  if (pick && pot > 0) {
    winnerId = pick.winner;
    bid = pick.bid;
    const others = payers.filter((m) => m.member_id !== winnerId);
    const split = splitPot(pot, bid, others.length);
    payOut(g, winnerId, split.winner, 'hui_win', memo, at);
    for (const o of others) payOut(g, o.member_id, split.each, 'hui_share', `${memo}: chia tiền thăm`, at);
    q.won.run(round, g.id, winnerId);
  } else if (pot > 0) {
    // Ai cũng đã hốt (người hốt sau cùng đã bỏ hụi): trả lại tiền góp kỳ này.
    for (const p of payers) payOut(g, p.member_id, g.amount, 'hui_share', `${memo}: hoàn góp`, at);
  }
  q.insertRound.run(g.id, round, winnerId, pot, bid, payers.length, dropped, at);
  const stillToWin = q.members.all(g.id).filter((m) => m.status === 'active' && !m.received).length;
  const active = q.count.get(g.id).n;
  // Hết người chưa hốt, hoặc chỉ còn một người góp (không ai góp cùng nữa) thì dây hụi kết thúc.
  const done = stillToWin === 0 || active < 2;
  q.advance.run(round, done ? null : at + DAY, done ? 'done' : 'running', done ? at : null, g.id);
}

/**
 * Cuối ngày: chốt các kỳ hụi đến hạn; dây chờ quá `openDays` ngày chưa đủ người mà chưa đủ tối thiểu thì hủy,
 * đủ tối thiểu thì cho chạy.
 */
export function settleHuiDay(day) {
  const end = startOfDay(day) + DAY;
  const at = end - 1;
  transaction(() => {
    for (const g of q.staleOpen.all(end - HUI.openDays * DAY)) {
      if (q.count.get(g.id).n >= HUI[g.scope].minSize) startGroup(g, at, { atSettlement: true });
      else q.cancel.run(at, g.id);
    }
    for (const g of q.dueRounds.all(end)) runRound(q.group.get(g.id), at);
  });
}

// ---------------------------------------------------------------- xem

function groupView(g, actorId) {
  const members = q.members.all(g.id);
  const active = members.filter((m) => m.status === 'active');
  const me = members.find((m) => m.member_id === actorId) ?? null;
  const nextRound = g.round + 1;
  const myBid = me ? q.bids.all(g.id, nextRound).find((b) => b.member_id === actorId)?.bid ?? 0 : 0;
  const pot = g.amount * active.length;
  return {
    id: g.id,
    name: g.name,
    scope: g.scope,
    owner: nameOf(g.scope, g.owner_id),
    isOwner: g.owner_id === actorId,
    amount: g.amount,
    size: g.size,
    status: g.status,
    round: g.round,
    nextRoundAt: g.next_round_at,
    pot,
    maxBid: Math.floor(pot * HUI.maxBidRatio),
    myBid,
    me: me && { status: me.status, received: me.received, paid: me.paid, got: me.got },
    members: members.map((m) => ({ name: nameOf(g.scope, m.member_id), status: m.status, received: m.received, paid: m.paid, got: m.got, me: m.member_id === actorId })),
    rounds: q.rounds.all(g.id).map((r) => ({ round: r.round, winner: r.winner_id ? nameOf(g.scope, r.winner_id) : null, pot: r.pot, bid: r.bid, payers: r.payers, dropped: r.dropped })),
    createdAt: g.created_at,
    joinable: g.status === 'open' && !me,
  };
}

/** Màn hụi: dây đang mở để vào, dây của tôi, dây của gia tộc (nếu là tộc trưởng). */
export function huiView(userId, now = Date.now()) {
  const user = getUser(userId);
  let clanActor = null;
  try {
    clanActor = actorFor(userId, 'clan');
  } catch {
    clanActor = null;
  }
  const since = now - 7 * DAY;
  return {
    rules: HUI,
    bannedUntil: user.hui_ban_until > now ? user.hui_ban_until : null,
    clan: clanActor ? { id: clanActor.id, name: clanActor.name, fund: q.account.get(clanAccount(clanActor.id))?.balance ?? 0 } : null,
    open: q.open.all().map((g) => groupView(g, g.scope === 'clan' ? clanActor?.id : userId)).filter((g) => g.scope === 'player' || clanActor),
    mine: q.mine.all('player', userId, since).map((g) => groupView(g, userId)),
    clanGroups: clanActor ? q.mine.all('clan', clanActor.id, since).map((g) => groupView(g, clanActor.id)) : [],
  };
}
