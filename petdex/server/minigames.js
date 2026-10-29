// Mini-game: server cấp phiên chơi có hạt giống, kiểm tra kết quả bằng luật dùng chung và áp giới hạn thưởng ngày.
import { randomBytes, randomInt } from 'node:crypto';
import { DAILY_CAPS, GAMES, judge } from '../../public/ta-tua/game/js/shared/minigames.js';
import { db, getUser, transaction } from './db.js';
import { dayKey } from './clock.js';
import { GameError, applyEffect, requireHealthy } from './game.js';
import { post } from './ledger.js';
import { addGoods } from './market.js';
import { growSkill } from './elements.js';
import { track } from './quests.js';
import { mutatePet } from './service.js';

/** Phần thưởng nguyên liệu của mini-game ứng với mặt hàng trên Sàn. */
const GOODS = { fish: 'fish', pearl: 'pearl' };

const q = {
  insert: db.prepare('INSERT INTO minigame_sessions (id, user_id, pet_id, game, seed, started_at) VALUES (?, ?, ?, ?, ?, ?)'),
  session: db.prepare('SELECT * FROM minigame_sessions WHERE id = ?'),
  finish: db.prepare('UPDATE minigame_sessions SET finished_at = ? WHERE id = ? AND finished_at IS NULL'),
  day: db.prepare('SELECT * FROM minigame_days WHERE user_id = ? AND day = ?'),
  addDay: db.prepare(`
    INSERT INTO minigame_days (user_id, day, coins, fish, pearl, plays) VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET coins = coins + excluded.coins, fish = fish + excluded.fish,
      pearl = pearl + excluded.pearl, plays = plays + 1`),
  prune: db.prepare('DELETE FROM minigame_sessions WHERE started_at < ?'),
};

const usedToday = (userId, day) => q.day.get(userId, day) ?? { coins: 0, fish: 0, pearl: 0, plays: 0 };

export function gamesView(userId, now = Date.now()) {
  const used = usedToday(userId, dayKey(now));
  return {
    caps: DAILY_CAPS,
    used: { coins: used.coins, fish: used.fish, pearl: used.pearl, plays: used.plays },
  };
}

export function startGame(userId, game, now = Date.now()) {
  if (!GAMES[game]) throw new GameError('Không có trò chơi này.');
  const user = getUser(userId);
  if (!user.active_pet_id) throw new GameError('Hãy nhận nuôi một bé trước đã.');
  const cost = GAMES[game].energy;
  mutatePet(userId, user.active_pet_id, (pet) => {
    requireHealthy(pet, 'chơi');
    if (pet.energy < cost) throw new GameError(`${pet.name} cần ${cost} năng lượng để chơi.`);
    return { pet: applyEffect(pet, { energy: -cost }) };
  }, { now, kind: 'minigame' });
  const id = randomBytes(9).toString('hex');
  const seed = randomInt(0, 2 ** 31);
  q.insert.run(id, userId, user.active_pet_id, game, seed, now);
  q.prune.run(now - 2 * 86_400_000);
  return { id, game, seed, duration: GAMES[game].duration };
}

export function finishGame(userId, sessionId, result, now = Date.now()) {
  return transaction(() => {
    const session = q.session.get(String(sessionId));
    if (!session || session.user_id !== userId) throw new GameError('Không tìm thấy ván chơi.');
    if (q.finish.run(now, session.id).changes === 0) throw new GameError('Ván này đã kết thúc rồi.');
    const def = GAMES[session.game];
    const elapsed = Math.min((now - session.started_at) / 1000, def.duration + 10);
    const verdict = judge(session.game, session.seed, elapsed, result);
    if (!verdict.ok) throw new GameError(verdict.reason);

    const day = dayKey(now);
    const used = usedToday(userId, day);
    const coins = Math.max(0, Math.min(verdict.coins, DAILY_CAPS.coins - used.coins));
    const portions = {};
    for (const key of Object.keys(GOODS)) {
      portions[key] = Math.max(0, Math.min(verdict.portions[key] ?? 0, DAILY_CAPS.portions[key] - used[key]));
    }
    if (coins) post({ userId, delta: coins, kind: 'minigame', memo: def.name, now });
    const stored = {};
    for (const [key, qty] of Object.entries(portions)) {
      stored[key] = qty ? addGoods(userId, GOODS[key], qty, now, { allowPartial: true }) : 0;
    }
    q.addDay.run(userId, day, coins, portions.fish, portions.pearl);

    const { before, after } = growSkill(session.pet_id, verdict.skill.name, verdict.skill.amount);
    const outcome = mutatePet(userId, session.pet_id, (pet) => ({ pet, xp: 3 }), { now, kind: 'minigame' });
    track(userId, 'minigame', 1, now);

    return {
      game: session.game,
      score: verdict.score,
      coins,
      rawCoins: verdict.coins,
      portions: stored,
      capped: coins < verdict.coins || Object.keys(GOODS).some((k) => stored[k] < (verdict.portions[k] ?? 0)),
      skill: { id: verdict.skill.name, gain: Math.round((after - before) * 10) / 10 },
      detail: verdict.detail ?? null,
      petName: outcome.pet.name,
      levelsGained: outcome.levelsGained,
    };
  });
}
