// Vòng đời: theo dõi sức khỏe cả đời, bé hết tuổi thọ thì về với sao trời, Đồi Sao tưởng niệm,
// kỷ vật cho bé kế tiếp, ô tưởng niệm và phí mở lại ô.
import { db, getUser, listPets, setActivePet, transaction } from './db.js';
import { indexedPrice } from './bank.js';
import { startOfDay } from './clock.js';
import { DAY, GameError, RULES, ageInfo, isBusy, lifeOf, tick } from './game.js';
import { post } from './ledger.js';
import { LIFE, SPECIES, speciesOrGuest } from '../../public/ta-tua/game/js/shared/pets.js';

const q = {
  allPets: db.prepare('SELECT * FROM pets'),
  setHealthAvg: db.prepare('UPDATE pets SET health_avg = ?, health_days = ? WHERE id = ?'),
  openShifts: db.prepare('SELECT * FROM shifts WHERE pet_id = ? AND claimed_at IS NULL'),
  claim: db.prepare('UPDATE shifts SET claimed_at = ? WHERE id = ?'),
  skills: db.prepare('SELECT skill, value FROM pet_skills WHERE pet_id = ?'),
  wear: db.prepare('SELECT slot, item_id FROM pet_wear WHERE pet_id = ?'),
  deletePet: db.prepare('DELETE FROM pets WHERE id = ?'),
  insertMemorial: db.prepare(`
    INSERT INTO memorials (user_id, name, species, element, rarity, level, weeks, born_at, died_at, wear, skills, traits, heirloom_skill)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  lockSlot: db.prepare('UPDATE users SET locked_slots = locked_slots + 1 WHERE id = ?'),
  unlockSlot: db.prepare('UPDATE users SET locked_slots = locked_slots - 1 WHERE id = ? AND locked_slots > 0'),
  insertEgg: db.prepare('INSERT INTO eggs (user_id, element, species, started_at, hatch_at) VALUES (?, ?, ?, ?, ?)'),
  eggCount: db.prepare('SELECT COUNT(*) AS n FROM eggs WHERE user_id = ? AND hatched_at IS NULL'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
  mine: db.prepare('SELECT * FROM memorials WHERE user_id = ? ORDER BY died_at DESC LIMIT 30'),
  all: db.prepare('SELECT m.*, u.username FROM memorials m JOIN users u ON u.id = m.user_id ORDER BY m.died_at DESC LIMIT 40'),
  heirloom: db.prepare('SELECT * FROM memorials WHERE user_id = ? AND heirloom_used_at IS NULL ORDER BY died_at LIMIT 1'),
  useHeirloom: db.prepare('UPDATE memorials SET heirloom_used_at = ? WHERE id = ?'),
};

const memorialView = (m) => ({
  id: m.id,
  name: m.name,
  species: m.species,
  element: m.element,
  rarity: m.rarity,
  level: m.level,
  weeks: m.weeks,
  bornAt: m.born_at,
  diedAt: m.died_at,
  wear: JSON.parse(m.wear),
  skills: JSON.parse(m.skills),
  heirloom: m.heirloom_used_at ? null : m.heirloom_skill,
  owner: m.username,
});

/** Ô nuôi: tối đa, đang dùng (bé + trứng đang ấp + ô tưởng niệm còn khóa), giá mở lại một ô tưởng niệm. */
export function slotsOf(userId) {
  const locked = getUser(userId).locked_slots;
  const used = listPets(userId).length + q.eggCount.get(userId).n + locked;
  return { max: RULES.maxPets, used, free: RULES.maxPets - used, locked, reopenCost: indexedPrice(LIFE.reopenCost) };
}

/** Kỷ vật của bé đã mất (cũ nhất chưa dùng) cho bé mới: +5 vào kỹ năng sở trường của bé cũ. */
export function takeHeirloom(userId, now = Date.now()) {
  const m = q.heirloom.get(userId);
  if (!m) return null;
  q.useHeirloom.run(now, m.id);
  return { skill: m.heirloom_skill, amount: LIFE.heirloom, from: m.name };
}

/** Bé về với sao trời: trả nốt lương ca chưa nhận, lập bia ở Đồi Sao, khóa ô hoặc tặng trứng nếu là bé cuối. */
function passAway(row, at) {
  const user = getUser(row.owner_id);
  for (const s of q.openShifts.all(row.id)) {
    if (s.pay > 0) post({ userId: row.owner_id, delta: s.pay, kind: 'salary', memo: `Lương ca cuối của ${row.name}`, now: at });
    q.claim.run(at, s.id);
  }
  const sp = speciesOrGuest(row.species);
  const weeks = ageInfo(row.born_at, at).weeks;
  const skills = Object.fromEntries(q.skills.all(row.id).map((r) => [r.skill, Math.round(r.value)]));
  const wear = Object.fromEntries(q.wear.all(row.id).map((r) => [r.slot, r.item_id]));
  // Kỷ vật: sở trường của loài, loài lạ thì kỹ năng cao nhất của bé.
  const heirloom = sp.fav ?? Object.entries(skills).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'charm';
  q.insertMemorial.run(row.owner_id, row.name, row.species, sp.element ?? null, sp.rarity ?? 'thuong', row.level, weeks,
    row.born_at, at, JSON.stringify(wear), JSON.stringify(skills), row.traits ?? '[]', heirloom);
  q.deletePet.run(row.id); // xóa kéo theo kỹ năng, nghề, ca làm, đồ đeo (khóa ngoại ON DELETE CASCADE)

  const left = listPets(row.owner_id);
  if (user.active_pet_id === row.id) setActivePet(row.owner_id, left[0]?.id ?? null);
  if (left.length === 0 && q.eggCount.get(row.owner_id).n === 0) {
    // Bé cuối cùng: không khóa ô, tặng một trứng Thường cùng hành, nở sau 3 ngày, để người chơi không bị kẹt.
    const element = sp.element ?? 'thuy';
    const pool = SPECIES.filter((s) => s.element === element && s.rarity === 'thuong');
    q.insertEgg.run(row.owner_id, element, pool[Math.floor(Math.random() * pool.length)].id, at, at + LIFE.memorialEggDays * DAY);
  } else {
    q.lockSlot.run(row.owner_id);
  }
  q.insertNews.run(`🌠 ${row.name} của ${user.username} đã về với sao trời sau ${weeks} tuần`, at, at, at + 2 * DAY);
}

/**
 * Nửa đêm: ghi sức khỏe vào trung bình cả đời (chăm tốt thì sống lâu hơn), rồi tiễn những bé đã hết tuổi thọ.
 * Bé đang dở ca làm thì đợi xong ca, đêm sau mới đi.
 */
export function settleLifeDay(day) {
  const end = startOfDay(day) + DAY;
  transaction(() => {
    for (const row of q.allPets.all()) {
      const pet = tick({ ...row, traits: JSON.parse(row.traits ?? '[]'), wear: {} }, end);
      const n = row.health_days ?? 0;
      const avg = ((row.health_avg ?? 80) * n + pet.health) / (n + 1);
      q.setHealthAvg.run(avg, n + 1, row.id);
      const life = lifeOf({ ...row, health_avg: avg }, end);
      if (life.left <= 0 && !isBusy(row, end)) passAway(row, end - 1);
    }
  });
}

/** Mở lại một ô tưởng niệm để nhận nuôi hoặc ấp trứng tiếp. */
export function reopenSlot(userId, now = Date.now()) {
  return transaction(() => {
    const slots = slotsOf(userId);
    if (!slots.locked) throw new GameError('Không có ô tưởng niệm nào cần mở lại.');
    post({ userId, delta: -slots.reopenCost, kind: 'slot_reopen', memo: 'Mở lại ô tưởng niệm', now });
    q.unlockSlot.run(userId);
    return { message: `🕯️ Đã mở lại một ô nuôi. Đồi Sao vẫn giữ tên bé cũ.` };
  });
}

export function memorialsView(userId, scope = 'mine') {
  const rows = scope === 'all' ? q.all.all() : q.mine.all(userId).map((m) => ({ ...m, username: getUser(userId).username }));
  return rows.map(memorialView);
}

/** Bé vừa mất trong 3 ngày qua (để màn Nhà báo tin). */
export const recentMemorials = (userId, now = Date.now()) => q.mine.all(userId).filter((m) => m.died_at > now - 3 * DAY).map(memorialView);

