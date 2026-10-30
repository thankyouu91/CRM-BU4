// Vòng đời vật phẩm thiết yếu (đồ ăn): chỉ số tự chủ thực phẩm D, Siêu thị mua Thực phẩm chế biến của gia tộc
// và bán lại thành "Suất ăn gia tộc", hạn mức đồ ăn NPC mỗi người mỗi ngày (NPC luôn giữ tối thiểu 10%),
// XP và giá của đồ ăn NPC theo giai đoạn, miễn giới hạn cho tài khoản mới. Luật ở shared/industry.js (ESSENTIALS).
import { db, getMeta, getUser, listPets, setMeta } from './db.js';
import { dayKey, nextDay } from './clock.js';
import { DAY, GameError } from './game.js';
import { ESSENTIALS, essentialStage, npcPriceFactor, npcXpFactor } from '../../public/ta-tua/game/js/shared/industry.js';

const q = {
  day: db.prepare('SELECT * FROM essentials_days WHERE day = ?'),
  upsertDay: db.prepare(`
    INSERT INTO essentials_days (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (day) DO UPDATE SET d = excluded.d`),
  addFlow: db.prepare(`
    INSERT INTO essentials_days (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (day) DO UPDATE SET demand = demand + excluded.demand, supplied = supplied + excluded.supplied,
      npc_sold = npc_sold + excluded.npc_sold, meal_sold = meal_sold + excluded.meal_sold`),
  window: db.prepare('SELECT COALESCE(SUM(demand), 0) AS demand, COALESCE(SUM(supplied), 0) AS supplied, COUNT(*) AS days FROM essentials_days WHERE day > ? AND day <= ?'),
  lastD: db.prepare('SELECT d FROM essentials_days WHERE day <= ? ORDER BY day DESC LIMIT 1'),
  buys: db.prepare('SELECT * FROM essentials_buys WHERE user_id = ? AND day = ?'),
  addBuys: db.prepare(`
    INSERT INTO essentials_buys (user_id, day, npc, meal) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, day) DO UPDATE SET npc = npc + excluded.npc, meal = meal + excluded.meal`),
  livePets: db.prepare('SELECT COUNT(*) AS n FROM pets'),
  history: db.prepare('SELECT * FROM essentials_days WHERE day <= ? ORDER BY day DESC LIMIT ?'),
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const stock = () => Number(getMeta('essentials_stock') ?? 0);
const setStock = (n) => setMeta('essentials_stock', Math.max(0, Math.round(n)));

/** D đang áp dụng hôm nay (chốt lúc nửa đêm hôm trước). */
export const currentD = (now = Date.now()) => q.lastD.get(dayKey(now))?.d ?? 0;

const isNewbie = (user, now) => now - user.created_at < ESSENTIALS.newbieDays * DAY;

/** Nhu cầu đồ ăn bình quân một ngày (suất): theo lượng mua 7 ngày qua, tối thiểu theo số bé. */
function dailyDemand(day) {
  const w = q.window.get(dayKey(Date.parse(`${day}T12:00:00Z`) - 7 * DAY), day);
  const byPets = q.livePets.get().n * ESSENTIALS.mealsPerPetDay;
  return Math.max(byPets * 0.5, w.days ? w.demand / Math.max(1, w.days) : byPets);
}

// ---------------------------------------------------------------- Siêu thị thu mua của gia tộc

let nightPlan = null;

/**
 * Bắt đầu đợt thu mua của một đêm: Siêu thị cần đủ hàng cho khoảng 1,5 ngày phần người chơi (D tối đa 90%).
 * Trả về số suất định mua; mỗi gia tộc bán tối đa `perClanShare` của số đó.
 */
export function openShopBuying(day) {
  const target = Math.round(dailyDemand(day) * (1 - ESSENTIALS.npcFloor) * 1.5);
  const want = Math.max(0, target - stock());
  nightPlan = { day, want, left: want, perClan: Math.ceil(want * ESSENTIALS.perClanShare), byClan: new Map() };
  return want;
}

/**
 * Gia tộc chào bán `units` Thực phẩm chế biến (đơn vị) cho Siêu thị. Trả về số đơn vị Siêu thị mua;
 * phần còn lại nơi gọi bán NPC như bình thường.
 */
export function offerToShop(clanId, units) {
  if (!nightPlan || units <= 0) return 0;
  const per = ESSENTIALS.mealsPerUnit;
  const used = nightPlan.byClan.get(clanId) ?? 0;
  const canMeals = Math.min(nightPlan.left, nightPlan.perClan - used);
  const take = Math.max(0, Math.min(units, Math.floor(canMeals / per)));
  if (!take) return 0;
  nightPlan.left -= take * per;
  nightPlan.byClan.set(clanId, used + take * per);
  setStock(stock() + take * per);
  q.addFlow.run(nightPlan.day, currentD(), 0, take * per, 0, 0);
  return take;
}

/** Chốt D cho ngày hôm sau theo cung/cầu 7 ngày, mỗi ngày dịch tối đa 10 điểm. */
export function settleEssentialsDay(day) {
  nightPlan = null;
  const w = q.window.get(dayKey(Date.parse(`${day}T12:00:00Z`) - 7 * DAY), day);
  const prev = q.lastD.get(day)?.d ?? 0;
  const demand = Math.max(w.demand, q.livePets.get().n * ESSENTIALS.mealsPerPetDay * Math.max(1, w.days) * 0.5);
  const target = clamp(demand ? w.supplied / demand : 0, 0, 1 - ESSENTIALS.npcFloor);
  const next = Math.round(clamp(target, prev - ESSENTIALS.maxDailyShift, prev + ESSENTIALS.maxDailyShift) * 1000) / 1000;
  q.upsertDay.run(nextDay(day), next, 0, 0, 0, 0);
  return next;
}

// ---------------------------------------------------------------- người chơi mua & ăn

/** Giá suất ăn gia tộc: theo giá tham chiếu Thực phẩm chế biến hôm nay (chia 5, cộng 15%). */
export function mealPrice(processedRef) {
  return Math.max(1, Math.ceil((processedRef / ESSENTIALS.mealsPerUnit) * ESSENTIALS.mealMarkup));
}

/** Hạn mức đồ ăn NPC hôm nay của người chơi (suất), hoặc Infinity với tài khoản mới. */
export function npcAllowance(userId, now = Date.now()) {
  const user = getUser(userId);
  if (isNewbie(user, now)) return Infinity;
  const pets = Math.max(1, listPets(userId).length);
  const d = currentD(now);
  const daily = Math.ceil(pets * ESSENTIALS.mealsPerPetDay * Math.max(ESSENTIALS.npcFloor, 1 - d)) + 2;
  return Math.max(0, daily - (q.buys.get(userId, dayKey(now))?.npc ?? 0));
}

export function essentialsView(userId, processedRef, now = Date.now()) {
  const d = currentD(now);
  const user = getUser(userId);
  const newbie = isNewbie(user, now);
  const stage = essentialStage(d);
  const left = npcAllowance(userId, now);
  return {
    d,
    stage: { key: stage.key, name: stage.name, icon: stage.icon },
    newbie,
    npcPriceFactor: newbie ? 1 : npcPriceFactor(d),
    npcXpFactor: newbie ? 1 : npcXpFactor(d),
    npcLeft: Number.isFinite(left) ? left : null,
    meal: { price: mealPrice(processedRef), stock: stock() },
  };
}

/**
 * Kiểm tra và ghi nhận khi người chơi mua đồ ăn ở Siêu thị. Trả về giá một món (đã nhân hệ số), hoặc null nếu
 * không phải đồ ăn (giữ giá cũ). Ném lỗi khi hết hạn mức NPC hoặc Siêu thị hết suất ăn gia tộc.
 */
export function chargeFood(userId, item, qty, basePrice, processedRef, now = Date.now()) {
  if (item.type !== 'food') return null;
  const day = dayKey(now);
  if (item.clanMade) {
    if (stock() < qty) throw new GameError(`Siêu thị chỉ còn ${stock()} suất ăn gia tộc.`);
    setStock(stock() - qty);
    q.addBuys.run(userId, day, 0, qty);
    q.addFlow.run(day, currentD(now), qty, 0, 0, qty);
    return mealPrice(processedRef);
  }
  const left = npcAllowance(userId, now);
  if (left < qty) {
    throw new GameError(left > 0
      ? `Hôm nay bạn chỉ mua thêm được ${left} món đồ ăn NPC. Mua Suất ăn gia tộc 🍱 do người chơi làm ra nhé.`
      : 'Hết hạn mức đồ ăn NPC hôm nay. Mua Suất ăn gia tộc 🍱 do người chơi làm ra nhé.');
  }
  const user = getUser(userId);
  q.addBuys.run(userId, day, qty, 0);
  q.addFlow.run(day, currentD(now), qty, 0, qty, 0);
  return Math.max(1, Math.round(basePrice * (isNewbie(user, now) ? 1 : npcPriceFactor(currentD(now)))));
}

/** Hệ số XP khi bé ăn một món: đồ NPC theo giai đoạn, suất ăn gia tộc và tài khoản mới giữ nguyên. */
export function foodXpFactor(userId, item, now = Date.now()) {
  if (item.type !== 'food' || item.clanMade) return 1;
  if (isNewbie(getUser(userId), now)) return 1;
  return npcXpFactor(currentD(now));
}

export const essentialsHistory = (day, n = 14) => q.history.all(day, n).reverse();
