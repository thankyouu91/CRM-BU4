// Tòa thị chính: ngân sách, thuế thu nhập, đề xuất chi tiêu theo tuần, hiệu ứng đang chạy, trợ cấp tân thủ.
import { db, getUser, transaction } from './db.js';
import { dayKey, startOfDay, weekday } from './clock.js';
import { DAY, GameError } from './game.js';
import { chargeTax, post, treasuryBalance } from './ledger.js';
import { PROPOSALS, STIPEND, incomeTax, pickProposals, winner } from './rules/town.js';

const q = {
  effectsAt: db.prepare('SELECT * FROM town_effects WHERE starts_at <= ? AND ends_at > ? ORDER BY ends_at'),
  effectsBetween: db.prepare('SELECT * FROM town_effects WHERE starts_at < ? AND ends_at > ?'),
  insertEffect: db.prepare('INSERT INTO town_effects (kind, target, value, label, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'),
  proposals: db.prepare('SELECT * FROM proposals WHERE week = ? ORDER BY option'),
  insertProposal: db.prepare("INSERT OR IGNORE INTO proposals (week, option, votes, status) VALUES (?, ?, 0, 'open')"),
  setStatus: db.prepare('UPDATE proposals SET status = ? WHERE week = ? AND option = ?'),
  history: db.prepare("SELECT * FROM proposals WHERE status IN ('funded', 'unfunded') ORDER BY week DESC LIMIT 6"),
  myVote: db.prepare('SELECT option FROM votes WHERE week = ? AND user_id = ?'),
  upsertVote: db.prepare(`
    INSERT INTO votes (week, user_id, option) VALUES (?, ?, ?)
    ON CONFLICT (week, user_id) DO UPDATE SET option = excluded.option`),
  addVotes: db.prepare('UPDATE proposals SET votes = votes + ? WHERE week = ? AND option = ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'),
  taxable: db.prepare(`
    SELECT kind, COALESCE(SUM(delta), 0) AS total FROM ledger
    WHERE user_id = ? AND created_at >= ? AND created_at < ? AND kind IN ('salary', 'interest', 'toll_income', 'minigame') GROUP BY kind`),
  gains: db.prepare('SELECT COALESCE(SUM(amount), 0) AS amount FROM gains WHERE user_id = ? AND day = ?'),
  profit: db.prepare(`
    SELECT COALESCE(SUM(revenue - cogs - rent - wages - tax), 0) AS profit FROM business_days d
    JOIN businesses b ON b.id = d.business_id WHERE b.owner_id = ? AND d.day = ?`),
  taxpayers: db.prepare(`
    SELECT DISTINCT user_id FROM ledger WHERE user_id IS NOT NULL AND created_at >= ? AND created_at < ?
    UNION SELECT id FROM users WHERE tax_due > 0
    UNION SELECT b.owner_id FROM business_days d JOIN businesses b ON b.id = d.business_id WHERE d.day = ?
    UNION SELECT user_id FROM gains WHERE day = ?`),
  setTaxDue: db.prepare('UPDATE users SET tax_due = ? WHERE id = ?'),
  insertTaxDay: db.prepare('INSERT OR REPLACE INTO tax_days (user_id, day, taxable, tax, paid, breakdown) VALUES (?, ?, ?, ?, ?, ?)'),
  taxDays: db.prepare('SELECT * FROM tax_days WHERE user_id = ? ORDER BY day DESC LIMIT 7'),
  treasuryFlow: db.prepare(`
    SELECT kind, SUM(delta) AS total FROM ledger WHERE account = 'treasury' AND created_at >= ? GROUP BY kind`),
};

/** Khóa tuần = ngày thứ Hai (giờ Việt Nam) của tuần chứa `day`. */
export function weekKey(day) {
  const back = (weekday(day) + 6) % 7;
  return dayKey(startOfDay(day) - back * DAY + 3_600_000);
}

export const effectsAt = (at) => q.effectsAt.all(at, at);
export const effectsBetween = (from, to) => q.effectsBetween.all(to, from);

/** Thưởng thêm khách cho quầy ở `location` tại thời điểm `at` từ các hiệu ứng đang chạy. */
export function trafficBonus(effects, location, at) {
  return effects
    .filter((e) => e.kind === 'traffic' && (!e.target || e.target === location) && e.starts_at <= at && e.ends_at > at)
    .reduce((sum, e) => sum + e.value, 0);
}

export const taxCut = (at) => effectsAt(at).filter((e) => e.kind === 'tax_cut').reduce((s, e) => s + e.value, 0);

export function stipendAmount(at) {
  const boosted = effectsAt(at).filter((e) => e.kind === 'stipend').map((e) => e.value);
  return Math.max(STIPEND.amount, ...boosted);
}

/** Trợ cấp tân thủ trả từ ngân sách (nếu ngân sách còn tiền); gọi khi nhận quà ngày. */
export function payStipend(userId, now = Date.now()) {
  const user = getUser(userId);
  if (now - user.created_at >= STIPEND.days * DAY) return 0;
  const amount = Math.min(stipendAmount(now), treasuryBalance());
  if (amount <= 0) return 0;
  post({ account: 'treasury', delta: -amount, kind: 'stipend', memo: user.username, now });
  post({ userId, delta: amount, kind: 'stipend', now });
  return amount;
}

export function ensureProposals(week, rand = Math.random) {
  if (q.proposals.all(week).length) return;
  for (const option of pickProposals(rand)) q.insertProposal.run(week, option);
}

export function vote(userId, option, now = Date.now()) {
  return transaction(() => {
    const week = weekKey(dayKey(now));
    ensureProposals(week);
    const rows = q.proposals.all(week);
    if (!rows.some((r) => r.option === option && r.status === 'open')) throw new GameError('Đề xuất này không có trong phiên bầu tuần này.');
    const prev = q.myVote.get(week, userId)?.option;
    if (prev === option) throw new GameError('Bạn đã bầu cho đề xuất này rồi.');
    if (prev) q.addVotes.run(-1, week, prev);
    q.upsertVote.run(week, userId, option);
    q.addVotes.run(1, week, option);
    return { message: `Đã bầu cho "${PROPOSALS[option].name}".` };
  });
}

/** Áp hiệu ứng của đề xuất thắng, bắt đầu từ `now`. */
function applyEffect(option, now) {
  const p = PROPOSALS[option];
  const { kind, target, value, days } = p.effect;
  const end = now + days * DAY;
  if (kind === 'news') {
    q.insertNews.run(target, `Tòa thị chính trợ giá: ${p.name.toLowerCase()}`, value, now, now, end);
  }
  q.insertEffect.run(kind, target, value, p.name, now, end);
}

/** Đóng phiên bầu của `week` lúc `now` (nửa đêm Chủ nhật), chi tiền nếu ngân sách đủ, mở phiên tuần sau. */
export function closeWeek(week, now = Date.now(), rand = Math.random) {
  transaction(() => {
    ensureProposals(week, rand);
    const rows = q.proposals.all(week);
    const top = winner(rows);
    for (const r of rows) if (r.option !== top) q.setStatus.run('lost', week, r.option);
    if (top) {
      const p = PROPOSALS[top];
      const funded = treasuryBalance() >= p.cost;
      if (funded) {
        post({ account: 'treasury', delta: -p.cost, kind: 'town_spend', memo: p.name, now });
        applyEffect(top, now);
      }
      q.setStatus.run(funded ? 'funded' : 'unfunded', week, top);
      q.insertNews.run(null, funded
        ? `Tòa thị chính: "${p.name}" thắng phiếu và bắt đầu từ hôm nay`
        : `Tòa thị chính: "${p.name}" thắng phiếu nhưng ngân sách chưa đủ ${p.cost} xu`, 0, now, now, now + 7 * DAY);
    }
    ensureProposals(weekKey(dayKey(now)), rand);
  });
}

/** Thuế thu nhập của ngày `day`: lương + lãi + lợi nhuận quầy, trừ thẳng vào ví; thiếu thì ghi nợ thuế. */
export function settleTaxes(day, now = Date.now()) {
  const from = startOfDay(day);
  const to = from + DAY;
  const cut = taxCut(from);
  transaction(() => {
    for (const { user_id: userId } of q.taxpayers.all(from, to, day, day)) {
      if (!userId) continue;
      const parts = Object.fromEntries(q.taxable.all(userId, from, to).map((r) => [r.kind, r.total]));
      parts.business = Math.max(0, q.profit.get(userId, day).profit);
      parts.trading = Math.max(0, q.gains.get(userId, day).amount);
      const taxable = Math.max(0, (parts.salary ?? 0) + (parts.interest ?? 0) + (parts.toll_income ?? 0) + (parts.minigame ?? 0) + parts.business + parts.trading);
      const tax = incomeTax(taxable, cut);
      const user = getUser(userId);
      const due = tax + user.tax_due;
      const paid = Math.min(due, Math.max(0, user.coins));
      if (paid > 0) chargeTax(userId, paid, `Thuế thu nhập ngày ${day}`, now);
      q.setTaxDue.run(due - paid, userId);
      if (taxable > 0 || due > 0) q.insertTaxDay.run(userId, day, taxable, tax, paid, JSON.stringify(parts));
    }
  });
}

export function townView(userId, now = Date.now()) {
  const week = weekKey(dayKey(now));
  transaction(() => ensureProposals(week));
  const flows = Object.fromEntries(q.treasuryFlow.all(now - 7 * DAY).map((r) => [r.kind, r.total]));
  return {
    treasury: treasuryBalance(),
    flows,
    week,
    closesAt: startOfDay(week) + 7 * DAY,
    proposals: q.proposals.all(week).map((p) => ({ option: p.option, votes: p.votes, ...PROPOSALS[p.option] })),
    myVote: q.myVote.get(week, userId)?.option ?? null,
    effects: effectsAt(now).map((e) => ({ kind: e.kind, target: e.target, value: e.value, label: e.label, endsAt: e.ends_at })),
    history: q.history.all().map((h) => ({ week: h.week, option: h.option, status: h.status, votes: h.votes, name: PROPOSALS[h.option]?.name })),
    taxCut: taxCut(now),
    taxes: q.taxDays.all(userId).map((t) => ({ day: t.day, taxable: t.taxable, tax: t.tax, paid: t.paid, parts: JSON.parse(t.breakdown) })),
    taxDue: getUser(userId).tax_due,
    stipend: { amount: stipendAmount(now), days: STIPEND.days },
  };
}
