// Vườn (trồng, tưới hộ, bắt sâu, thu hoạch) và Bếp (nấu món, khám phá công thức, ăn, bán cho NPC).
import { db, getPet, getUser, skillsOf, transaction } from './db.js';
import { economy, indexedPrice } from './bank.js';
import { dayKey } from './clock.js';
import { DAY, GameError, HOUR, applyEffect, isBusy, requireHealthy } from './game.js';
import { post } from './ledger.js';
import { addGoods, removeGoods, stock } from './market.js';
import { CROPS, DISHES, GARDEN, KITCHEN, QUALITY, dishValue, harvestYield, rollQuality, sameInputs } from './rules/production.js';
import { mutatePet } from './service.js';
import { track } from './quests.js';
import { isElement } from './elements.js';
import { ELEMENT_RULES, elementOfSpecies, foodBonus } from '../../public/ta-tua/game/js/shared/pets.js';

const q = {
  plots: db.prepare('SELECT * FROM garden_plots WHERE user_id = ? ORDER BY idx'),
  plot: db.prepare('SELECT * FROM garden_plots WHERE user_id = ? AND idx = ?'),
  plant: db.prepare(`
    INSERT INTO garden_plots (user_id, idx, crop, planted_at, ready_at, watered, pests_at, pests_cleared, seed_cost)
    VALUES (?, ?, ?, ?, ?, '[]', ?, 0, ?)
    ON CONFLICT (user_id, idx) DO UPDATE SET crop = excluded.crop, planted_at = excluded.planted_at, ready_at = excluded.ready_at,
      watered = '[]', pests_at = excluded.pests_at, pests_cleared = 0, seed_cost = excluded.seed_cost`),
  clear: db.prepare('UPDATE garden_plots SET crop = NULL, planted_at = NULL, ready_at = NULL, watered = \'[]\', pests_at = NULL WHERE user_id = ? AND idx = ?'),
  water: db.prepare('UPDATE garden_plots SET watered = ? WHERE user_id = ? AND idx = ?'),
  clearPests: db.prepare('UPDATE garden_plots SET pests_cleared = 1 WHERE user_id = ? AND idx = ?'),
  setPlots: db.prepare('UPDATE users SET plots = ? WHERE id = ?'),
  help: db.prepare('SELECT count FROM garden_help WHERE user_id = ? AND day = ?'),
  addHelp: db.prepare(`
    INSERT INTO garden_help (user_id, day, count) VALUES (?, ?, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1`),
  isFriend: db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'"),
  known: db.prepare('SELECT recipe FROM recipes_known WHERE user_id = ?'),
  learn: db.prepare('INSERT OR IGNORE INTO recipes_known (user_id, recipe) VALUES (?, ?)'),
  dishes: db.prepare('SELECT * FROM dishes WHERE user_id = ? AND expires_at > ? ORDER BY expires_at'),
  dish: db.prepare('SELECT * FROM dishes WHERE id = ?'),
  insertDish: db.prepare('INSERT INTO dishes (user_id, recipe, quality, made_at, expires_at) VALUES (?, ?, ?, ?, ?)'),
  deleteDish: db.prepare('DELETE FROM dishes WHERE id = ?'),
  dropSpoiled: db.prepare('DELETE FROM dishes WHERE user_id = ? AND expires_at <= ?'),
};

// ---------------------------------------------------------------- vườn

function plotView(row, idx, viewerId, now) {
  if (!row?.crop) return { idx, crop: null };
  const watered = JSON.parse(row.watered);
  return {
    idx,
    crop: row.crop,
    plantedAt: row.planted_at,
    readyAt: row.ready_at,
    ready: now >= row.ready_at,
    watered: watered.length > 0,
    wateredBy: watered.length,
    canWater: viewerId !== row.user_id && !watered.includes(viewerId),
    pests: Boolean(row.pests_at && row.pests_at <= now && !row.pests_cleared),
  };
}

export function gardenView(userId, ownerId = userId, now = Date.now()) {
  const owner = getUser(ownerId);
  if (ownerId !== userId && !q.isFriend.get(userId, ownerId)) throw new GameError('Chỉ vào được vườn của bạn bè.');
  const rows = Object.fromEntries(q.plots.all(ownerId).map((r) => [r.idx, r]));
  const used = q.help.get(userId, dayKey(now))?.count ?? 0;
  return {
    owner: owner.username,
    own: ownerId === userId,
    plots: Array.from({ length: owner.plots }, (_, i) => plotView(rows[i], i, userId, now)),
    nextPlotCost: GARDEN.expandCosts[owner.plots - GARDEN.startPlots] ?? null,
    crops: Object.fromEntries(Object.entries(CROPS).map(([id, c]) => [id, { ...c, seed: indexedPrice(c.seed) }])),
    helpLeft: Math.max(0, GARDEN.helpPerDay - used),
  };
}

export function plant(userId, idx, crop, now = Date.now(), rand = Math.random) {
  const def = CROPS[crop];
  if (!def) throw new GameError('Không có hạt giống này.');
  return transaction(() => {
    const user = getUser(userId);
    if (!Number.isInteger(idx) || idx < 0 || idx >= user.plots) throw new GameError('Ô đất không hợp lệ.');
    if (q.plot.get(userId, idx)?.crop) throw new GameError('Ô này đang trồng rồi.');
    const seed = indexedPrice(def.seed);
    post({ userId, delta: -seed, kind: 'seeds', memo: def.name, now });
    const ready = now + def.hours * HOUR;
    const pestsAt = rand() < GARDEN.pestChance ? now + rand() * (ready - now) : null;
    q.plant.run(userId, idx, crop, now, ready, pestsAt, seed);
    return { message: `${def.icon} Đã gieo ${def.name.toLowerCase()}, ${def.hours} giờ nữa thu hoạch.` };
  });
}

/** Tưới hộ vườn bạn: vụ đó thêm 20% sản lượng; người tưới được ít xu và XP (giới hạn mỗi ngày). */
export function water(userId, ownerId, idx, now = Date.now()) {
  return transaction(() => {
    if (ownerId === userId) throw new GameError('Tự tưới vườn nhà không được thưởng, nhờ bạn bè tưới nhé.');
    if (!q.isFriend.get(userId, ownerId)) throw new GameError('Chỉ tưới được vườn của bạn bè.');
    const row = q.plot.get(ownerId, idx);
    if (!row?.crop || now >= row.ready_at) throw new GameError('Ô này không cần tưới.');
    const watered = JSON.parse(row.watered);
    if (watered.includes(userId)) throw new GameError('Bạn đã tưới ô này rồi.');
    const day = dayKey(now);
    if ((q.help.get(userId, day)?.count ?? 0) >= GARDEN.helpPerDay) throw new GameError(`Mỗi ngày tưới giúp tối đa ${GARDEN.helpPerDay} ô.`);
    q.water.run(JSON.stringify([...watered, userId]), ownerId, idx);
    q.addHelp.run(userId, day);
    post({ userId, delta: GARDEN.helpReward, kind: 'garden_help', memo: getUser(ownerId).username, now });
    const user = getUser(userId);
    if (user.active_pet_id) mutatePet(userId, user.active_pet_id, (pet) => ({ pet, xp: GARDEN.helpXp }), { now });
    track(userId, 'friend', 1, now);
    return { message: `💧 Đã tưới vườn ${getUser(ownerId).username}: vụ này thêm ${GARDEN.waterBonus * 100}% sản lượng. +${GARDEN.helpReward} 🪙` };
  });
}

export function catchPests(userId, idx, now = Date.now()) {
  return transaction(() => {
    const row = q.plot.get(userId, idx);
    if (!row?.pests_at || row.pests_at > now || row.pests_cleared) throw new GameError('Ô này không có sâu.');
    q.clearPests.run(userId, idx);
    return { message: '🐛 Đã bắt sạch sâu!' };
  });
}

export function harvest(userId, idx, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    const row = q.plot.get(userId, idx);
    if (!row?.crop) throw new GameError('Ô này đang trống.');
    if (now < row.ready_at) throw new GameError('Chưa tới lúc thu hoạch.');
    const def = CROPS[row.crop];
    // Bé chính hành Mộc: vụ nào cũng thêm 15%.
    const active = getUser(userId).active_pet_id;
    const mocBonus = Boolean(active && isElement(getPet(active)?.species, 'moc'));
    const base = harvestYield(row.crop, {
      watered: JSON.parse(row.watered).length > 0,
      pests: Boolean(row.pests_at && !row.pests_cleared),
      rand,
    });
    const qty = Math.max(1, Math.round(base * (mocBonus ? 1 + ELEMENT_RULES.perks.moc.harvest : 1)));
    const stored = addGoods(userId, def.commodity, qty, now, { allowPartial: true, cost: row.seed_cost / qty });
    const bonusNote = mocBonus ? ' (bé Mộc chăm vườn: +15%)' : '';
    q.clear.run(userId, idx);
    track(userId, 'harvest', 1, now);
    return {
      message: stored < qty
        ? `Thu được ${qty} phần ${def.name.toLowerCase()} nhưng kho chỉ còn chỗ cho ${stored} phần.`
        : `${def.icon} Thu hoạch ${qty} phần ${def.name.toLowerCase()} vào kho${bonusNote}.`,
    };
  });
}

export function expandGarden(userId, now = Date.now()) {
  return transaction(() => {
    const user = getUser(userId);
    const cost = GARDEN.expandCosts[user.plots - GARDEN.startPlots];
    if (cost === undefined) throw new GameError('Vườn đã rộng nhất rồi.');
    post({ userId, delta: -indexedPrice(cost), kind: 'garden_expand', now });
    q.setPlots.run(user.plots + 1, userId);
    return { message: `🌱 Vườn có thêm ô đất thứ ${user.plots + 1}.` };
  });
}

// ---------------------------------------------------------------- bếp

// Kèm tên, biểu tượng và hiệu quả: món ẩn mua ở Chợ Phiên thì người mua chưa có trong danh sách công thức.
const dishView = (d, index) => ({
  id: d.id, recipe: d.recipe, name: DISHES[d.recipe].name, icon: DISHES[d.recipe].icon, effect: DISHES[d.recipe].effect,
  quality: d.quality, qualityName: QUALITY[d.quality].name, expiresAt: d.expires_at,
  value: dishValue(d.recipe, d.quality, index), npcPrice: Math.round(dishValue(d.recipe, d.quality, index) * KITCHEN.npcRate),
});

export function kitchenView(userId, now = Date.now()) {
  q.dropSpoiled.run(userId, now);
  const known = new Set(q.known.all(userId).map((r) => r.recipe));
  const index = economy().priceIndex;
  const goods = stock(userId, now);
  return {
    recipes: Object.fromEntries(Object.entries(DISHES)
      .filter(([id, d]) => !d.hidden || known.has(id))
      .map(([id, d]) => [id, {
        ...d,
        canMake: Math.min(...Object.entries(d.inputs).map(([c, n]) => Math.floor((goods[c] ?? 0) / n))),
        value: dishValue(id, 0, index),
      }])),
    hiddenLeft: Object.entries(DISHES).filter(([id, d]) => d.hidden && !known.has(id)).length,
    dishes: q.dishes.all(userId, now).map((d) => dishView(d, index)),
    goods,
  };
}

/**
 * Nấu theo công thức đã biết (`recipe`) hoặc thử ghép nguyên liệu (`inputs`) để khám phá công thức ẩn.
 * Ghép sai thì không mất nguyên liệu, chỉ nhận gợi ý.
 */
export function cook(userId, { recipe, inputs }, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    let id = recipe;
    if (!id) {
      if (!inputs || typeof inputs !== 'object') throw new GameError('Hãy chọn nguyên liệu.');
      const clean = Object.fromEntries(Object.entries(inputs).filter(([, n]) => Number.isInteger(n) && n > 0));
      id = Object.keys(DISHES).find((k) => sameInputs(DISHES[k].inputs, clean));
      if (!id) throw new GameError('Ghép thế này chưa ra món nào. Thử đổi số lượng hoặc nguyên liệu xem!');
    }
    const dish = DISHES[id];
    if (!dish) throw new GameError('Không có món này.');
    const user = getUser(userId);
    if (!user.active_pet_id) throw new GameError('Cần một bé vào bếp.');
    const known = q.known.all(userId).some((r) => r.recipe === id);
    if (dish.hidden && !known && recipe) throw new GameError('Bạn chưa biết công thức này.');
    for (const [c, n] of Object.entries(dish.inputs)) removeGoods(userId, c, n, now);
    // Bé hành Kim vào bếp: nấu như có thêm 15 Khéo tay.
    const craft = (skillsOf(user.active_pet_id).craft ?? 0)
      + (isElement(getPet(user.active_pet_id)?.species, 'kim') ? ELEMENT_RULES.perks.kim.cookCraft : 0);
    const quality = rollQuality(craft, rand);
    q.insertDish.run(userId, id, quality, now, now + KITCHEN.shelfDays * DAY);
    const discovered = dish.hidden && !known;
    q.learn.run(userId, id);
    const outcome = mutatePet(userId, user.active_pet_id, (pet) => {
      requireHealthy(pet, 'vào bếp');
      if (isBusy(pet, now)) throw new GameError(`${pet.name} đang bận, xong việc rồi vào bếp nhé.`);
      if (pet.energy < KITCHEN.energy) throw new GameError(`${pet.name} cần ${KITCHEN.energy} năng lượng để nấu.`);
      return { pet: applyEffect(pet, { energy: -KITCHEN.energy }), xp: 4 };
    }, { now });
    track(userId, 'cook', 1, now);
    return {
      ...outcome,
      petName: outcome.pet.name,
      message: `${discovered ? '✨ Khám phá công thức mới! ' : ''}${dish.icon} ${outcome.pet.name} nấu xong ${dish.name} (${QUALITY[quality].name}).`,
    };
  });
}

/** Ăn món đã nấu: hiệu quả nhân theo chất lượng. */
export function eatDish(userId, dishId, petId, now = Date.now()) {
  return transaction(() => {
    const d = q.dish.get(dishId);
    if (!d || d.user_id !== userId || d.expires_at <= now) throw new GameError('Không tìm thấy món này.');
    const def = DISHES[d.recipe];
    const mult = QUALITY[d.quality].mult;
    q.deleteDish.run(d.id);
    const effect = Object.fromEntries(Object.entries(def.effect).map(([k, v]) => [k, Math.round(v * mult)]));
    const outcome = mutatePet(userId, petId, (pet) => {
      if (effect.fullness && pet.fullness >= 97) throw new GameError(`${pet.name} no căng bụng rồi!`);
      return { pet: applyEffect(pet, effect), xp: Math.round(8 * mult * (1 + foodBonus(def.element, elementOfSpecies(pet.species)))) };
    }, { now });
    track(userId, 'feed', 1, now);
    return { ...outcome, petName: outcome.pet.name, message: `${def.icon} ${outcome.pet.name} ăn ${def.name} ${QUALITY[d.quality].name.toLowerCase()}, ngon tuyệt!` };
  });
}

export function sellDishToNpc(userId, dishId, now = Date.now()) {
  return transaction(() => {
    const d = q.dish.get(dishId);
    if (!d || d.user_id !== userId || d.expires_at <= now) throw new GameError('Không tìm thấy món này.');
    const price = Math.round(dishValue(d.recipe, d.quality, economy().priceIndex) * KITCHEN.npcRate);
    q.deleteDish.run(d.id);
    post({ userId, delta: price, kind: 'kitchen_sale', memo: DISHES[d.recipe].name, now });
    return { message: `Bán ${DISHES[d.recipe].name} cho quán ăn đầu phố: +${price} 🪙` };
  });
}

/** Dùng bởi Chợ Phiên: lấy món ra khỏi tủ / trả lại món. */
export function takeDish(userId, dishId, now = Date.now()) {
  const d = q.dish.get(dishId);
  if (!d || d.user_id !== userId || d.expires_at <= now) throw new GameError('Không tìm thấy món này.');
  q.deleteDish.run(d.id);
  return d;
}
export const giveDish = (userId, recipe, quality, madeAt, now = Date.now()) =>
  q.insertDish.run(userId, recipe, quality, madeAt ?? now, (madeAt ?? now) + KITCHEN.shelfDays * DAY);
