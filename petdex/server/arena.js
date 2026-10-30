// Đấu trường gia tộc: thách đấu giành một lô đất hoặc một ghế ngành chiến lược của gia tộc khác.
// Bên thách đấu đề xuất 1–2 khung 19h/20h (giờ Việt Nam) vào ngày sau; bên bị thách chọn một khung trong 48 giờ, không
// thì bị xử thua (mất lô/ghế, phạt 15% quỹ). Đến giờ, server đánh theo lượt (có seed) giữa 15 thành viên chiến lực cao
// nhất mỗi bên, lưu nhật ký từng lượt để xem lại. Bên thua mất lô/ghế và 30% tài sản gia tộc (quỹ + tiền gửi kỳ hạn; nửa cho
// bên thắng, nửa vào ngân sách); trang phục đang đeo trên các bé ra sân hỏng hẳn. Luật ở shared/arena.js.
import { adminLog, db, listPets, transaction } from './db.js';
import { dayKey } from './clock.js';
import { DAY, GameError, HOUR, ageInfo } from './game.js';
import { post } from './ledger.js';
import { breakPetGear, wornGear } from './gear.js';
import { breakDepositsFor, clanAssets } from './clan-gov.js';
import { createAnnouncement } from './announcements.js';
import { ARENA, combatPower, simulateBattle, slotTime, warSeed } from '../../public/ta-tua/game/js/shared/arena.js';
import { INDUSTRIES, PLOTS } from '../../public/ta-tua/game/js/shared/clan.js';
import { STRATEGIC_INDUSTRIES } from '../../public/ta-tua/game/js/shared/industry.js';
import { speciesOrGuest } from '../../public/ta-tua/game/js/shared/pets.js';

const ACTIVE = ['proposed', 'scheduled'];
const q = {
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  members: db.prepare('SELECT m.user_id, m.role, u.username, u.display_name FROM clan_members m JOIN users u ON u.id = m.user_id WHERE m.clan_id = ?'),
  clans: db.prepare('SELECT * FROM clans WHERE dissolved_at IS NULL ORDER BY id'),
  plot: db.prepare('SELECT * FROM land_plots WHERE id = ?'),
  ownedPlots: db.prepare('SELECT * FROM land_plots WHERE clan_id IS NOT NULL ORDER BY id'),
  industries: db.prepare('SELECT * FROM clan_industries WHERE clan_id = ?'),
  seatHolders: db.prepare('SELECT ci.*, c.name FROM clan_industries ci JOIN clans c ON c.id = ci.clan_id AND c.dissolved_at IS NULL'),
  hasSeat: db.prepare('SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),

  insertWar: db.prepare(`
    INSERT INTO clan_wars (challenger_id, defender_id, target_kind, target_ref, slots, created_by, created_at, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  war: db.prepare('SELECT * FROM clan_wars WHERE id = ?'),
  activeOf: db.prepare(`SELECT * FROM clan_wars WHERE status IN ('proposed', 'scheduled') AND (challenger_id = ? OR defender_id = ?)`),
  activeOnTarget: db.prepare(`SELECT * FROM clan_wars WHERE status IN ('proposed', 'scheduled') AND target_kind = ? AND target_ref = ?`),
  lastOnTarget: db.prepare(`
    SELECT MAX(resolved_at) AS at FROM clan_wars WHERE status IN ('done', 'forfeit') AND target_kind = ? AND target_ref = ?`),
  dueForfeits: db.prepare(`SELECT * FROM clan_wars WHERE status = 'proposed' AND deadline <= ? ORDER BY id`),
  dueFights: db.prepare(`SELECT * FROM clan_wars WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at, id`),
  schedule: db.prepare(`UPDATE clan_wars SET status = 'scheduled', scheduled_at = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ? AND status = 'proposed'`),
  resolve: db.prepare('UPDATE clan_wars SET status = ?, resolved_at = ?, winner_id = ?, penalty = ?, result = ?, note = ? WHERE id = ?'),
  cancel: db.prepare(`UPDATE clan_wars SET status = 'cancelled', resolved_at = ?, note = ? WHERE id = ? AND status IN ('proposed', 'scheduled')`),
  insertRound: db.prepare('INSERT INTO clan_war_rounds (war_id, round, hits) VALUES (?, ?, ?)'),
  rounds: db.prepare('SELECT * FROM clan_war_rounds WHERE war_id = ? ORDER BY round'),
  mine: db.prepare('SELECT * FROM clan_wars WHERE challenger_id = ? OR defender_id = ? ORDER BY id DESC LIMIT 30'),
  upcoming: db.prepare(`SELECT * FROM clan_wars WHERE status IN ('proposed', 'scheduled') ORDER BY COALESCE(scheduled_at, deadline), id LIMIT 50`),
  history: db.prepare(`SELECT * FROM clan_wars WHERE status IN ('done', 'forfeit', 'cancelled') ORDER BY resolved_at DESC, id DESC LIMIT ?`),

  movePlot: db.prepare('UPDATE land_plots SET clan_id = ? WHERE id = ? AND clan_id = ?'),
  dropOperatorsOfPlot: db.prepare('DELETE FROM clan_operators WHERE plot_id = ?'),
  dropSeat: db.prepare('DELETE FROM clan_industries WHERE clan_id = ? AND industry = ?'),
  addSeat: db.prepare('INSERT OR IGNORE INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, ?, 0, ?)'),
  infra: db.prepare('SELECT * FROM clan_infra WHERE clan_id = ? AND industry = ?'),
  dropInfra: db.prepare('DELETE FROM clan_infra WHERE clan_id = ? AND industry = ?'),
  setInfra: db.prepare(`
    INSERT INTO clan_infra (clan_id, industry, level, since) VALUES (?, ?, ?, ?)
    ON CONFLICT (clan_id, industry) DO UPDATE SET level = MAX(level, excluded.level)`),
  seatPlots: db.prepare('SELECT id FROM land_plots WHERE clan_id = ? AND industry = ?'),
  clearPlotIndustry: db.prepare('UPDATE land_plots SET industry = NULL, variant = NULL WHERE id = ?'),
};

const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));
const clanAccount = (id) => `clan:${id}`;
const clanBalance = (id) => q.account.get(clanAccount(id))?.balance ?? 0;
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const isStrategic = (industry) => Boolean(STRATEGIC_INDUSTRIES[industry]);
const clanName = (id) => q.clan.get(id)?.name ?? `#${id}`;
const targetName = (kind, ref) => (kind === 'plot'
  ? `lô ${PLOT_BY_ID.get(Number(ref))?.code ?? ref}`
  : `ghế ${INDUSTRIES[ref]?.name ?? ref}`);

// ---------------------------------------------------------------- chiến lực

/** Hạng các món đang đeo và còn dùng được (đồ hỏng, đồ đang sửa không tính). */
function usableTiers(petId) {
  return Object.values(wornGear(petId)).filter((g) => g.usable && g.tier).map((g) => g.tier);
}

/** Bé mạnh nhất của một người chơi và chiến lực của bé (null nếu không có bé nào). */
export function memberPower(userId, now = Date.now()) {
  let best = null;
  for (const pet of listPets(userId)) {
    const sp = speciesOrGuest(pet.species);
    const tiers = usableTiers(pet.id);
    const power = combatPower({ level: pet.level, rarity: sp.rarity, tiers });
    if (!best || power > best.power) {
      const age = ageInfo(pet.born_at, now);
      best = {
        power,
        pet: {
          id: pet.id, name: pet.name, species: pet.species, level: pet.level, element: sp.element ?? null, rarity: sp.rarity,
          stage: age.stage, scale: age.scale, wear: pet.activeWear ?? {}, gear: tiers.length,
        },
      };
    }
  }
  return best;
}

/** Thành viên gia tộc kèm chiến lực, cao trước. */
export function clanRoster(clanId, now = Date.now()) {
  return q.members.all(clanId).map((m) => {
    const p = memberPower(m.user_id, now);
    return { userId: m.user_id, name: m.display_name || m.username, role: m.role, power: p?.power ?? 0, pet: p?.pet ?? null };
  }).sort((a, b) => b.power - a.power || a.userId - b.userId);
}

/** 15 thành viên có bé và chiến lực cao nhất. */
export const topFighters = (clanId, now = Date.now()) => clanRoster(clanId, now).filter((m) => m.pet).slice(0, ARENA.teamSize);

// ---------------------------------------------------------------- thách đấu & chọn giờ

function mustManage(userId) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  if (m.role !== 'leader' && m.role !== 'elder') throw new GameError('Chỉ tộc trưởng hoặc trưởng lão mới được thách đấu và chọn giờ đấu.');
  return clan;
}

/** Chủ hiện tại của một mục tiêu (lô hoặc ghế), hoặc null. Ghế chiến lược có thể nhiều gia tộc cùng giữ. */
function holderOf(kind, ref, defenderId) {
  if (kind === 'plot') return q.plot.get(Number(ref))?.clan_id ?? null;
  return q.hasSeat.get(defenderId, ref) ? defenderId : null;
}

/** Các khung đấu hợp lệ: 19h hoặc 20h giờ Việt Nam, từ ngày mai tới `maxDaysAhead` ngày, không trùng. */
function parseSlots(slots, now) {
  const list = Array.isArray(slots) ? slots : [];
  if (!list.length || list.length > ARENA.maxSlots) throw new GameError(`Đề xuất 1–${ARENA.maxSlots} khung giờ đấu.`);
  const today = dayKey(now);
  const last = dayKey(now + ARENA.maxDaysAhead * DAY);
  const out = list.map((s) => {
    const day = String(s?.day ?? '');
    const hour = Number(s?.hour);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day <= today || day > last) throw new GameError(`Ngày đấu phải từ ngày mai tới ${ARENA.maxDaysAhead} ngày tới.`);
    if (!ARENA.hours.includes(hour)) throw new GameError(`Giờ đấu chỉ được ${ARENA.hours.map((h) => `${h}h`).join(' hoặc ')} (giờ Việt Nam).`);
    return slotTime(day, hour);
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * Gia tộc của `userId` thách đấu gia tộc `defenderId` để giành một lô (`kind: 'plot'`, `ref`: mã lô) hoặc một ghế ngành
 * chiến lược (`kind: 'seat'`, `ref`: mã ngành). Mỗi gia tộc chỉ có một trận đang chờ; cùng mục tiêu không bị thách lại
 * trong 7 ngày sau trận.
 */
export function challenge(userId, { defenderId, kind, ref, slots }, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    const defender = q.clan.get(Number(defenderId));
    if (!defender || defender.dissolved_at) throw new GameError('Không có gia tộc này.');
    if (defender.id === clan.id) throw new GameError('Không tự thách đấu gia tộc mình.');
    if (kind !== 'plot' && kind !== 'seat') throw new GameError('Chọn lô đất hoặc ghế ngành chiến lược để thách đấu.');
    const target = kind === 'plot' ? String(Number(ref)) : String(ref ?? '');
    if (kind === 'plot' && !PLOT_BY_ID.has(Number(target))) throw new GameError('Không có lô đất này.');
    if (kind === 'seat' && !isStrategic(target)) throw new GameError('Chỉ thách đấu được ghế ngành chiến lược.');
    if (holderOf(kind, target, defender.id) !== defender.id) throw new GameError(`${defender.name} không giữ ${targetName(kind, target)}.`);
    if (kind === 'seat') {
      const owned = q.industries.all(clan.id);
      if (owned.some((i) => isStrategic(i.industry))) throw new GameError('Gia tộc đã nắm một ngành chiến lược; mỗi gia tộc chỉ giữ được 1 ghế.');
      if (owned.length >= 3) throw new GameError('Gia tộc đã đủ 3 ngành, không nhận thêm ghế được.');
    }
    if (q.activeOf.all(clan.id, clan.id).length) throw new GameError('Gia tộc đang có một trận chờ đấu; mỗi gia tộc chỉ một trận một lúc.');
    if (q.activeOf.all(defender.id, defender.id).length) throw new GameError(`${defender.name} đang có trận chờ đấu khác, thử lại sau.`);
    if (q.activeOnTarget.all(kind, target).length) throw new GameError(`${targetName(kind, target)} đang có trận chờ đấu.`);
    const last = q.lastOnTarget.get(kind, target).at;
    if (last && now - last < ARENA.cooldownDays * DAY) {
      throw new GameError(`${targetName(kind, target)} vừa đấu xong, ${ARENA.cooldownDays} ngày sau mới thách lại được.`);
    }
    const times = parseSlots(slots, now);
    // Hạn chọn giờ: 48 giờ, nhưng không muộn hơn khung cuối cùng.
    const deadline = Math.min(now + ARENA.confirmHours * HOUR, times[times.length - 1]);
    const id = Number(q.insertWar.run(clan.id, defender.id, kind, target, JSON.stringify(times), userId, now, deadline).lastInsertRowid);
    adminLog('Đấu trường', 'arena_challenge', userId, { warId: id, challenger: clan.name, defender: defender.name, target: targetName(kind, target) });
    return { id, message: `Đã gửi lời thách đấu ${defender.name} giành ${targetName(kind, target)}. Họ có tới ${new Date(deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} để chọn giờ.` };
  });
}

/** Bên bị thách đấu chọn một khung giờ; cả server nhận thông báo. */
export function confirmSlot(userId, warId, at, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    const war = q.war.get(Number(warId));
    if (!war || war.status !== 'proposed') throw new GameError('Trận này không còn chờ chọn giờ.');
    if (war.defender_id !== clan.id) throw new GameError('Chỉ gia tộc bị thách đấu mới chọn giờ.');
    if (war.deadline <= now) throw new GameError('Đã quá hạn chọn giờ.');
    const slot = Number(at);
    if (!JSON.parse(war.slots).includes(slot)) throw new GameError('Khung giờ này không có trong lời thách đấu.');
    if (slot <= now) throw new GameError('Khung giờ này đã qua.');
    q.schedule.run(slot, userId, now, war.id);
    announceFight({ ...war, scheduled_at: slot }, now);
    adminLog('Đấu trường', 'arena_schedule', userId, { warId: war.id, at: slot });
    return { message: `Đã chốt giờ đấu ${new Date(slot).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.` };
  });
}

/** Bên thách đấu rút lời thách khi bên kia chưa chọn giờ (không mất gì). */
export function withdraw(userId, warId, now = Date.now()) {
  return transaction(() => {
    const clan = mustManage(userId);
    const war = q.war.get(Number(warId));
    if (!war || war.status !== 'proposed') throw new GameError('Chỉ rút được lời thách đấu chưa chốt giờ.');
    if (war.challenger_id !== clan.id) throw new GameError('Chỉ bên thách đấu mới rút được.');
    q.cancel.run(now, 'Bên thách đấu rút lại', war.id);
    adminLog('Đấu trường', 'arena_withdraw', userId, { warId: war.id });
    return { message: 'Đã rút lời thách đấu.' };
  });
}

function announceFight(war, now) {
  const when = new Date(war.scheduled_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  const a = clanName(war.challenger_id);
  const b = clanName(war.defender_id);
  const days = Math.min(30, Math.max(1, Math.ceil((war.scheduled_at - now) / DAY) + 1));
  createAnnouncement({
    title: `⚔️ Đấu trường: ${a} thách đấu ${b}`,
    body: `## ${a} ⚔️ ${b}\n\n- Giành: **${targetName(war.target_kind, war.target_ref)}**\n- Giờ đấu: **${when}** (giờ Việt Nam)\n- Mỗi bên ${ARENA.teamSize} thành viên chiến lực cao nhất. Bên thua mất ${targetName(war.target_kind, war.target_ref)} và ${Math.round(ARENA.penalty * 100)}% tài sản gia tộc.\n\nXem trực tiếp kết quả ở Đấu trường.`,
    days,
    popup: true,
    createdBy: 'Đấu trường',
  }, now);
}

// ---------------------------------------------------------------- đến giờ: xử thua, đánh, chuyển giao

/** Trang phục đang đeo trên các bé đã ra sân hỏng hẳn sau trận (luật độ bền ở gear.js); bé khác ở nhà không sao. */
export function breakParticipantsGear(petIds) {
  return breakPetGear(petIds);
}

/**
 * Bên thua nộp `rate` × (quỹ + tiền gửi kỳ hạn): quỹ thiếu thì phá khoản gửi (chỉ gốc, mất lãi). Một nửa cho bên thắng,
 * phần còn lại vào ngân sách thị trấn. Trả về tổng tiền phạt.
 */
function payPenalty(loserId, winnerId, rate, memo, now) {
  const due = Math.floor(clanAssets(loserId) * rate);
  if (due <= 0) return 0;
  const total = Math.min(due, breakDepositsFor(loserId, due, 'nộp phạt Đấu trường', now));
  if (total <= 0) return 0;
  const toWinner = Math.floor(total / 2);
  post({ account: clanAccount(loserId), delta: -total, kind: 'arena_penalty', memo, now });
  if (toWinner > 0) post({ account: clanAccount(winnerId), delta: toWinner, kind: 'arena_prize', memo, now });
  post({ account: 'treasury', delta: total - toWinner, kind: 'arena_penalty', memo, now });
  return total;
}

/** Bên bị thách đấu còn giữ mục tiêu không (lô còn là của họ, ghế còn trong tay họ). */
const defenderStillHolds = (war) => holderOf(war.target_kind, war.target_ref, war.defender_id) === war.defender_id;

/** Bên thách đấu thắng còn nhận được ghế không (chưa có ghế chiến lược khác, chưa đủ 3 ngành). */
function canTakeSeat(clanId) {
  const owned = q.industries.all(clanId);
  return !owned.some((i) => isStrategic(i.industry)) && owned.length < 3;
}

/**
 * Chuyển lô (kèm nhà máy, công trình) hoặc ghế sang bên thắng. Ghế đi kèm cấp hạ tầng; lô của bên thua đang làm ngành đó
 * thôi chạy (giữ công trình), nên bên thua mất luôn buff tài chính. Bên thắng không còn chỗ nhận ghế thì ghế ở lại với bên
 * giữ ghế (tiền phạt vẫn tính). Trả về mô tả ngắn.
 */
function transferTarget(war, loserId, winnerId, now) {
  if (war.target_kind === 'plot') {
    const id = Number(war.target_ref);
    if (!q.movePlot.run(winnerId, id, loserId).changes) return { moved: false, note: 'Lô đã không còn thuộc bên thua.' };
    q.dropOperatorsOfPlot.run(id);
    return { moved: true };
  }
  const industry = war.target_ref;
  if (!q.hasSeat.get(loserId, industry)) return { moved: false, note: 'Ghế đã không còn thuộc bên thua.' };
  if (!canTakeSeat(winnerId)) return { moved: false, kept: true, note: 'Bên thắng không còn chỗ nhận ghế; ghế ở lại với bên giữ ghế.' };
  const infra = q.infra.get(loserId, industry);
  q.dropSeat.run(loserId, industry);
  q.dropInfra.run(loserId, industry);
  for (const p of q.seatPlots.all(loserId, industry)) {
    q.clearPlotIndustry.run(p.id);
    q.dropOperatorsOfPlot.run(p.id);
  }
  q.addSeat.run(winnerId, industry, now);
  if (infra) q.setInfra.run(winnerId, industry, infra.level, now);
  return { moved: true };
}

/** Ảnh chụp đội hình cho nhật ký và màn xem lại. */
const snapshot = (team) => team.map((m) => ({ userId: m.userId, name: m.name, power: m.power, pet: m.pet }));

/** Hủy trận lúc tới hạn (không ai mất gì). */
function voidWar(war, now, note) {
  q.resolve.run('cancelled', now, null, 0, null, note, war.id);
  adminLog('Đấu trường', 'arena_void', null, { warId: war.id, note });
  return { cancelled: true, note };
}

/**
 * Đánh một trận đã đến giờ. Mục tiêu đã đổi chủ thì hủy. Một bên không có ai ra sân: bên thách đấu trống thì bên thách
 * đấu bỏ trận (nộp 15%, mục tiêu giữ nguyên); bên giữ trống thì như bỏ trận (nộp 15%, mục tiêu chuyển); cả hai trống thì hủy.
 */
export function fight(war, now = Date.now()) {
  if (!defenderStillHolds(war)) return voidWar(war, now, 'Mục tiêu đã đổi chủ');
  const a = topFighters(war.challenger_id, now);
  const b = topFighters(war.defender_id, now);
  if (!a.length && !b.length) return voidWar(war, now, 'Cả hai bên không ai ra sân');
  if (!a.length || !b.length) {
    const winnerId = a.length ? war.challenger_id : war.defender_id;
    const loserId = a.length ? war.defender_id : war.challenger_id;
    const memo = `Đấu trường #${war.id}: ${clanName(loserId)} không ai ra sân`;
    const penalty = payPenalty(loserId, winnerId, ARENA.forfeitPenalty, memo, now);
    const transfer = winnerId === war.challenger_id ? transferTarget(war, loserId, winnerId, now) : { moved: false, kept: true };
    const note = `${clanName(loserId)} không ai ra sân${transfer.note ? `; ${transfer.note}` : ''}`;
    q.resolve.run('forfeit', now, winnerId, penalty, JSON.stringify({ transfer }), note, war.id);
    adminLog('Đấu trường', 'arena_forfeit', null, { warId: war.id, winner: clanName(winnerId), loser: clanName(loserId), penalty, transfer, empty: true });
    return { winnerId, loserId, penalty, broken: 0, transfer };
  }
  const fighters = (team) => team.map((m) => ({ power: m.power, rarity: m.pet.rarity, element: m.pet.element }));
  const battle = simulateBattle(fighters(a), fighters(b), warSeed(war.id, war.scheduled_at));
  const winnerId = battle.winner === 'a' ? war.challenger_id : war.defender_id;
  const loserId = winnerId === war.challenger_id ? war.defender_id : war.challenger_id;
  battle.rounds.forEach((hits, i) => q.insertRound.run(war.id, i + 1, JSON.stringify(hits)));
  const memo = `Đấu trường #${war.id}: ${clanName(war.challenger_id)} ⚔️ ${clanName(war.defender_id)}`;
  const penalty = payPenalty(loserId, winnerId, ARENA.penalty, memo, now);
  // Bên thách đấu thắng thì giành mục tiêu; bên giữ thắng thì giữ nguyên.
  const transfer = winnerId === war.challenger_id ? transferTarget(war, loserId, winnerId, now) : { moved: false, kept: true };
  // Chỉ bé đã ra sân bị hỏng đồ.
  const broken = breakParticipantsGear([...a, ...b].map((m) => m.pet.id));
  const result = {
    teams: [snapshot(a), snapshot(b)], hp: battle.hp, maxHp: battle.maxHp, rounds: battle.rounds.length, transfer, broken,
  };
  q.resolve.run('done', now, winnerId, penalty, JSON.stringify(result), transfer.note ?? null, war.id);
  adminLog('Đấu trường', 'arena_fight', null, { warId: war.id, winner: clanName(winnerId), loser: clanName(loserId), penalty, broken, transfer });
  return { winnerId, loserId, penalty, broken, transfer };
}

/** Bên bị thách đấu không chọn giờ kịp: thua, mất mục tiêu, phạt 15%. Mục tiêu đã đổi chủ thì hủy. */
export function forfeit(war, now = Date.now()) {
  if (!defenderStillHolds(war)) return voidWar(war, now, 'Mục tiêu đã đổi chủ');
  const memo = `Đấu trường #${war.id}: ${clanName(war.defender_id)} bỏ trận`;
  const penalty = payPenalty(war.defender_id, war.challenger_id, ARENA.forfeitPenalty, memo, now);
  const transfer = transferTarget(war, war.defender_id, war.challenger_id, now);
  q.resolve.run('forfeit', now, war.challenger_id, penalty, JSON.stringify({ transfer }), transfer.note ?? 'Không chọn giờ trong hạn', war.id);
  adminLog('Đấu trường', 'arena_forfeit', null, { warId: war.id, winner: clanName(war.challenger_id), loser: clanName(war.defender_id), penalty, transfer });
  return { penalty, transfer };
}

/** Chạy từ bộ lập lịch: xử thua các lời thách quá hạn và đánh các trận đã đến giờ. */
export function settleArena(now = Date.now()) {
  let n = 0;
  for (const war of q.dueForfeits.all(now)) {
    transaction(() => forfeit(war, war.deadline));
    n += 1;
  }
  for (const war of q.dueFights.all(now)) {
    transaction(() => fight(war, war.scheduled_at));
    n += 1;
  }
  return n;
}

// ---------------------------------------------------------------- màn Đấu trường & quản trị

const warRow = (w) => ({
  id: w.id,
  status: w.status,
  challenger: { id: w.challenger_id, name: clanName(w.challenger_id), emblem: q.clan.get(w.challenger_id)?.emblem ?? '' },
  defender: { id: w.defender_id, name: clanName(w.defender_id), emblem: q.clan.get(w.defender_id)?.emblem ?? '' },
  target: { kind: w.target_kind, ref: w.target_ref, name: targetName(w.target_kind, w.target_ref) },
  slots: JSON.parse(w.slots),
  deadline: w.deadline,
  scheduledAt: w.scheduled_at,
  resolvedAt: w.resolved_at,
  winnerId: w.winner_id,
  penalty: w.penalty,
  note: w.note,
});

/** Mục tiêu có thể thách đấu: lô đã có chủ và ghế chiến lược của các gia tộc khác. */
function targetsFor(clanId) {
  const plots = q.ownedPlots.all().filter((p) => p.clan_id !== clanId).map((p) => ({
    kind: 'plot', ref: String(p.id), name: targetName('plot', p.id), clanId: p.clan_id, clan: clanName(p.clan_id),
    industry: p.industry ? INDUSTRIES[p.industry]?.name ?? p.industry : null,
  }));
  const seats = q.seatHolders.all().filter((s) => s.clan_id !== clanId && isStrategic(s.industry)).map((s) => ({
    kind: 'seat', ref: s.industry, name: targetName('seat', s.industry), clanId: s.clan_id, clan: s.name,
  }));
  return [...seats, ...plots];
}

export function arenaView(userId, now = Date.now()) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  const mine = clan && !clan.dissolved_at ? clan : null;
  const days = Array.from({ length: ARENA.maxDaysAhead }, (_, i) => dayKey(now + (i + 1) * DAY));
  return {
    rules: ARENA,
    days,
    clan: mine ? {
      id: mine.id, name: mine.name, emblem: mine.emblem, role: m.role, treasury: clanBalance(mine.id),
      roster: clanRoster(mine.id, now),
      wars: q.mine.all(mine.id, mine.id).map(warRow),
      targets: targetsFor(mine.id),
    } : null,
    upcoming: q.upcoming.all().map(warRow),
    history: q.history.all(20).map(warRow),
  };
}

/** Xem lại một trận: đội hình hai bên và từng lượt đánh. */
export function warReplay(warId) {
  const war = q.war.get(Number(warId));
  if (!war) throw new GameError('Không có trận này.');
  const result = war.result ? JSON.parse(war.result) : null;
  return {
    ...warRow(war),
    teams: result?.teams ?? [[], []],
    maxHp: result?.maxHp ?? [[], []],
    hp: result?.hp ?? [[], []],
    transfer: result?.transfer ?? null,
    broken: result?.broken ?? 0,
    rounds: q.rounds.all(war.id).map((r) => JSON.parse(r.hits)),
  };
}

export function adminArenaView() {
  return { rules: ARENA, upcoming: q.upcoming.all().map(warRow), history: q.history.all(50).map(warRow) };
}

/** Quản trị viên hủy một trận chưa đánh (không ai mất gì). */
export function adminCancelWar(warId, actor, reason = '') {
  const war = q.war.get(Number(warId));
  if (!war || !ACTIVE.includes(war.status)) throw new GameError('Chỉ hủy được trận chưa đánh.');
  q.cancel.run(Date.now(), `Quản trị viên ${actor} hủy${reason ? `: ${reason}` : ''}`, war.id);
  adminLog(actor, 'arena_cancel', null, { warId: war.id, challenger: clanName(war.challenger_id), defender: clanName(war.defender_id), reason });
  return adminArenaView();
}

