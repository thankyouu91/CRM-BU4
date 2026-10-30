import * as store from './db.js';
import { economy } from './bank.js';
import { dayKey, nextDay, startOfDay } from './clock.js';
import { GameError, HOUR, describePet, levelReward, rollSickness, settle, stageRules, tick } from './game.js';
import { post } from './ledger.js';
import { xpFactor } from './elements.js';
import { eggsView } from './eggs.js';
import { recentMemorials, slotsOf } from './lifecycle.js';
import { fortuneOf } from '../../public/ta-tua/game/js/shared/pets.js';
import { listGear, wearLimitOf, wornGear } from './gear.js';
import { essentialsView } from './essentials.js';
import { refPrice } from './industry.js';
import { macroToday } from './macro.js';

/** Phát 'pet:changed' (userId) để sân chơi cập nhật thẻ thú cưng khi chủ thay đổi ở nơi khác. */
export { bus } from './events.js';
import { bus } from './events.js';

const q = {
  readyShifts: store.db.prepare('SELECT COUNT(*) AS n FROM shifts WHERE user_id = ? AND claimed_at IS NULL AND ends_at <= ?'),
  maturedDeposits: store.db.prepare('SELECT COUNT(*) AS n FROM deposits WHERE user_id = ? AND closed_at IS NULL AND matures_at <= ?'),
};

export function snapshot(userId, now = Date.now()) {
  const user = store.getUser(userId);
  const { priceIndex, baseRate } = economy();
  const today = dayKey(now);
  return {
    user: {
      id: user.id,
      username: user.username,
      coins: user.coins,
      activePetId: user.active_pet_id,
      dailyReadyAt: user.daily_day === today ? startOfDay(nextDay(today)) : 0,
      streak: user.streak,
      taxDue: user.tax_due,
      advanced: Boolean(user.advanced),
      credit: user.credit,
      hasPassword: Boolean(user.pass_hash),
      kind: user.kind,
    },
    pets: store.listPets(userId).map((pet) => ({ ...describePet(pet, now), skills: store.skillsOf(pet.id), bonus: pet.bonus, gear: wornGear(pet.id), wearLimit: wearLimitOf(pet) })),
    inventory: store.inventory(userId),
    gear: listGear(userId),
    economy: { priceIndex, baseRate },
    essentials: essentialsView(userId, refPrice('processed_food', macroToday(now)), now),
    eggs: eggsView(userId, now),
    slots: slotsOf(userId),
    memorials: recentMemorials(userId, now),
    fortune: fortuneOf(today),
    badges: {
      jobs: q.readyShifts.get(userId, now).n,
      bank: q.maturedDeposits.get(userId, now).n,
    },
  };
}

export function ownedPet(userId, petId) {
  const pet = store.getPet(Number(petId));
  if (!pet || pet.owner_id !== userId) throw new GameError('Không tìm thấy thú cưng này.');
  return pet;
}

/**
 * Cập nhật chỉ số theo thời gian, chạy hành động, cộng XP rồi lưu lại.
 * `action(pet)` trả về { pet, xp, coins } như các hàm trong game.js; xu của hành động ghi sổ với loại `kind`,
 * thưởng lên cấp ghi riêng loại 'level'.
 */
export function mutatePet(userId, petId, action, { now = Date.now(), kind = 'play' } = {}) {
  const result = store.transaction(() => {
    const row = ownedPet(userId, petId);
    const current = rollSickness(tick(row, now), Math.max(0, now - row.updated_at) / HOUR);
    const acted = action(current);
    const xp = (acted.xp ?? 0) * xpFactor(current, now) * (stageRules(current.born_at, now).xp ?? 1);
    const outcome = settle({ ...acted, xp: Math.round(xp) });
    store.savePet(outcome.pet);
    const levelCoins = outcome.levelsGained.reduce((sum, level) => sum + levelReward(level), 0);
    const actionCoins = outcome.coins - levelCoins;
    if (actionCoins) post({ userId, delta: actionCoins, kind, now });
    if (levelCoins) post({ userId, delta: levelCoins, kind: 'level', memo: `${outcome.pet.name} lên cấp ${outcome.pet.level}`, now });
    return outcome;
  });
  bus.emit('pet:changed', userId);
  return result;
}
