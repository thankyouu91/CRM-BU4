// Nhiệm vụ ngày: 3 nhiệm vụ mỗi ngày, các hệ thống báo tiến độ qua track(); làm đủ cả 3 thì mở thêm rương.
import { db, getUser, listPets, transaction } from './db.js';
import { dayKey } from './clock.js';
import { GameError } from './game.js';
import { post } from './ledger.js';
import { QUESTS, QUEST_CHEST, QUEST_XP, pickQuests } from './rules/town.js';
import { mutatePet } from './service.js';

const CHEST_SLOT = -1;

const q = {
  rows: db.prepare('SELECT * FROM quests WHERE user_id = ? AND day = ? ORDER BY slot'),
  insert: db.prepare('INSERT OR IGNORE INTO quests (user_id, day, slot, quest) VALUES (?, ?, ?, ?)'),
  add: db.prepare('UPDATE quests SET progress = progress + ? WHERE user_id = ? AND day = ? AND quest = ? AND claimed_at IS NULL'),
  claim: db.prepare('UPDATE quests SET claimed_at = ? WHERE user_id = ? AND day = ? AND slot = ? AND claimed_at IS NULL'),
  hasFriend: db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND status = 'accepted' LIMIT 1"),
  hasGuild: db.prepare('SELECT 1 FROM guild_members WHERE user_id = ?'),
  hasBusiness: db.prepare('SELECT 1 FROM businesses WHERE owner_id = ? AND closed_at IS NULL'),
};

function seedFor(userId, day) {
  let s = userId * 2654435761 + Number(day.replaceAll('-', ''));
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function ensure(userId, day) {
  if (q.rows.all(userId, day).length) return;
  const level = Math.max(0, ...listPets(userId).map((p) => p.level));
  const has = {
    friend: Boolean(q.hasFriend.get(userId)),
    guild: Boolean(q.hasGuild.get(userId)),
    business: Boolean(q.hasBusiness.get(userId)),
  };
  pickQuests({ level, has }, seedFor(userId, day)).forEach((quest, slot) => q.insert.run(userId, day, slot, quest));
}

/** Báo một việc vừa làm (gọi từ các hệ thống khác); không bao giờ làm hỏng hành động gốc. */
export function track(userId, event, amount = 1, now = Date.now()) {
  try {
    const day = dayKey(now);
    ensure(userId, day);
    q.add.run(amount, userId, day, event);
  } catch (err) {
    console.error('Lỗi cập nhật nhiệm vụ:', err);
  }
}

export function questsView(userId, now = Date.now()) {
  const day = dayKey(now);
  transaction(() => ensure(userId, day));
  const rows = q.rows.all(userId, day);
  const quests = rows.filter((r) => r.slot !== CHEST_SLOT).map((r) => {
    const def = QUESTS[r.quest];
    return { slot: r.slot, id: r.quest, text: def.text, goal: def.goal, progress: Math.min(def.goal, r.progress), reward: def.reward, claimed: Boolean(r.claimed_at) };
  });
  const chest = rows.find((r) => r.slot === CHEST_SLOT);
  return { day, quests, chest: { reward: QUEST_CHEST, ready: quests.every((x) => x.claimed), claimed: Boolean(chest?.claimed_at) }, streak: getUser(userId).streak };
}

export function claimQuest(userId, slot, now = Date.now()) {
  return transaction(() => {
    const day = dayKey(now);
    const view = questsView(userId, now);
    const user = getUser(userId);
    if (slot === CHEST_SLOT) {
      if (!view.chest.ready) throw new GameError('Hoàn thành cả 3 nhiệm vụ để mở rương.');
      q.insert.run(userId, day, CHEST_SLOT, 'chest');
      if (q.claim.run(now, userId, day, CHEST_SLOT).changes === 0) throw new GameError('Rương hôm nay đã mở rồi.');
      post({ userId, delta: QUEST_CHEST, kind: 'quest', memo: 'Rương nhiệm vụ ngày', now });
      return { message: `Mở rương nhiệm vụ: +${QUEST_CHEST} 🪙` };
    }
    const quest = view.quests.find((x) => x.slot === slot);
    if (!quest) throw new GameError('Không có nhiệm vụ này.');
    if (quest.claimed) throw new GameError('Nhiệm vụ này đã nhận thưởng.');
    if (quest.progress < quest.goal) throw new GameError('Nhiệm vụ chưa xong.');
    q.claim.run(now, userId, day, slot);
    post({ userId, delta: quest.reward, kind: 'quest', memo: quest.text, now });
    let levelsGained = [];
    let petName;
    if (user.active_pet_id) {
      const outcome = mutatePet(userId, user.active_pet_id, (pet) => ({ pet, xp: QUEST_XP }), { now, kind: 'quest' });
      levelsGained = outcome.levelsGained;
      petName = outcome.pet.name;
    }
    return { message: `Xong nhiệm vụ "${quest.text}": +${quest.reward} 🪙 · +${QUEST_XP} XP`, levelsGained, petName };
  });
}
