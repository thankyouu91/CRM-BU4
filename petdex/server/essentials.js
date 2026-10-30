// Vòng đời vật phẩm thiết yếu, tách hai nhóm đồ ăn (food) và đồ chăm sóc (care). Mỗi nhóm có chỉ số tự chủ D riêng,
// kho hàng gia tộc riêng ở Siêu thị theo 3 hạng chất lượng (Thường / Ngon / Tuyệt hảo), hạn mức đồ NPC mỗi người mỗi
// ngày (NPC luôn giữ tối thiểu 10%), XP và giá đồ NPC theo giai đoạn, miễn giới hạn cho tài khoản mới.
// Luật ở shared/industry.js (ESSENTIALS).
import { db, getMeta, getUser, listPets, setMeta } from './db.js';
import { dayKey, nextDay } from './clock.js';
import { DAY, GameError } from './game.js';
import {
  ESSENTIALS, ESSENTIAL_CATS, essentialCat, essentialStage, npcPriceFactor, npcXpFactor, qualitySplit,
} from '../../public/ta-tua/game/js/shared/industry.js';

const TABLES = { food: 'essentials_days', care: 'essentials_care_days' };
const STOCK_KEYS = { food: 'essentials_stock', care: 'essentials_care_stock' };
const BUY_COLS = { food: ['npc', 'meal'], care: ['care_npc', 'care_clan'] };
const QN = ESSENTIALS.qualities.length;

const perCat = (fn) => Object.fromEntries(ESSENTIAL_CATS.map((c) => [c, fn(c)]));
const q = {
  ...perCat((c) => ({
    upsertDay: db.prepare(`
      INSERT INTO ${TABLES[c]} (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, 0, 0, 0, 0)
      ON CONFLICT (day) DO UPDATE SET d = excluded.d`),
    addFlow: db.prepare(`
      INSERT INTO ${TABLES[c]} (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (day) DO UPDATE SET demand = demand + excluded.demand, supplied = supplied + excluded.supplied,
        npc_sold = npc_sold + excluded.npc_sold, meal_sold = meal_sold + excluded.meal_sold`),
    window: db.prepare(`SELECT COALESCE(SUM(demand), 0) AS demand, COALESCE(SUM(supplied), 0) AS supplied, COUNT(*) AS days
      FROM ${TABLES[c]} WHERE day > ? AND day <= ?`),
    lastD: db.prepare(`SELECT d FROM ${TABLES[c]} WHERE day <= ? ORDER BY day DESC LIMIT 1`),
    history: db.prepare(`SELECT * FROM ${TABLES[c]} WHERE day <= ? ORDER BY day DESC LIMIT ?`),
    addBuys: db.prepare(`
      INSERT INTO essentials_buys (user_id, day, ${BUY_COLS[c][0]}, ${BUY_COLS[c][1]}) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, day) DO UPDATE SET ${BUY_COLS[c][0]} = ${BUY_COLS[c][0]} + excluded.${BUY_COLS[c][0]},
        ${BUY_COLS[c][1]} = ${BUY_COLS[c][1]} + excluded.${BUY_COLS[c][1]}`),
  })),
  buys: db.prepare('SELECT * FROM essentials_buys WHERE user_id = ? AND day = ?'),
  livePets: db.prepare('SELECT COUNT(*) AS n FROM pets'),
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Kho hàng gia tộc của Siêu thị theo hạng. Bản cũ lưu một số (toàn hạng Thường). */
export function stockOf(cat) {
  const raw = getMeta(STOCK_KEYS[cat]);
  if (raw == null) return Array(QN).fill(0);
  const v = JSON.parse(raw);
  return Array.isArray(v) ? Array.from({ length: QN }, (_, i) => v[i] ?? 0) : [Number(v) || 0, ...Array(QN - 1).fill(0)];
}
const setStock = (cat, arr) => setMeta(STOCK_KEYS[cat], JSON.stringify(arr.map((n) => Math.max(0, Math.round(n)))));
const total = (arr) => arr.reduce((s, n) => s + n, 0);

/** D của nhóm đang áp dụng hôm nay (chốt lúc nửa đêm hôm trước). */
export const currentD = (cat, now = Date.now()) => q[cat].lastD.get(dayKey(now))?.d ?? 0;

const isNewbie = (user, now) => now - user.created_at < ESSENTIALS.newbieDays * DAY;
const weekBefore = (day) => dayKey(Date.parse(`${day}T12:00:00Z`) - 7 * DAY);

/** Nhu cầu bình quân một ngày của nhóm: theo lượng mua 7 ngày qua, tối thiểu theo số bé. */
function dailyDemand(cat, day) {
  const w = q[cat].window.get(weekBefore(day), day);
  const byPets = q.livePets.get().n * ESSENTIALS.cats[cat].perPetDay;
  return Math.max(byPets * 0.5, w.days ? w.demand / Math.max(1, w.days) : byPets);
}

// ---------------------------------------------------------------- Siêu thị thu mua của gia tộc

let nightPlan = null;

/**
 * Bắt đầu đợt thu mua của một đêm: với mỗi nhóm, Siêu thị cần đủ hàng cho khoảng 1,5 ngày phần người chơi
 * (D tối đa 90%). Trả về số suất/bộ định mua theo nhóm; mỗi gia tộc bán tối đa `perClanShare` của số đó.
 */
export function openShopBuying(day) {
  nightPlan = { day, cats: {} };
  for (const cat of ESSENTIAL_CATS) {
    const target = Math.round(dailyDemand(cat, day) * (1 - ESSENTIALS.npcFloor) * 1.5);
    const want = Math.max(0, target - total(stockOf(cat)));
    nightPlan.cats[cat] = { want, left: want, perClan: Math.ceil(want * ESSENTIALS.perClanShare), byClan: new Map() };
  }
  return Object.fromEntries(ESSENTIAL_CATS.map((c) => [c, nightPlan.cats[c].want]));
}

/** Nhóm thiết yếu mà một mặt hàng công nghiệp cung cấp (processed_food → food, medicine → care). */
export const catOfGood = (good) => ESSENTIAL_CATS.find((c) => ESSENTIALS.cats[c].good === good) ?? null;

/**
 * Gia tộc chào bán `units` đơn vị hàng của nhóm `cat` cho Siêu thị, với điểm chất lượng `score` (0–1).
 * Trả về số đơn vị Siêu thị mua theo hạng [Thường, Ngon, Tuyệt hảo]; phần còn lại nơi gọi bán NPC như bình thường.
 */
export function offerToShop(clanId, cat, units, score = 0, rand = Math.random) {
  const plan = nightPlan?.cats[cat];
  const none = Array(QN).fill(0);
  if (!plan || units <= 0) return none;
  const per = ESSENTIALS.cats[cat].perUnit;
  const used = plan.byClan.get(clanId) ?? 0;
  const take = Math.max(0, Math.min(units, Math.floor(Math.min(plan.left, plan.perClan - used) / per)));
  if (!take) return none;
  // Chia số đơn vị theo tỉ lệ hạng; phần lẻ làm tròn ngẫu nhiên, hạng Thường nhận phần còn lại.
  const split = qualitySplit(score);
  const byQ = none.slice();
  for (let i = QN - 1; i > 0; i -= 1) byQ[i] = Math.min(take - total(byQ), Math.floor(take * split[i] + rand()));
  byQ[0] = take - total(byQ);
  plan.left -= take * per;
  plan.byClan.set(clanId, used + take * per);
  setStock(cat, stockOf(cat).map((n, i) => n + byQ[i] * per));
  q[cat].addFlow.run(nightPlan.day, currentD(cat), 0, take * per, 0, 0);
  return byQ;
}

/** Chốt D của mỗi nhóm cho ngày hôm sau theo cung/cầu 7 ngày, mỗi ngày dịch tối đa 10 điểm. */
export function settleEssentialsDay(day) {
  nightPlan = null;
  return perCat((cat) => {
    const w = q[cat].window.get(weekBefore(day), day);
    const prev = q[cat].lastD.get(day)?.d ?? 0;
    const demand = Math.max(w.demand, q.livePets.get().n * ESSENTIALS.cats[cat].perPetDay * Math.max(1, w.days) * 0.5);
    const target = clamp(demand ? w.supplied / demand : 0, 0, 1 - ESSENTIALS.npcFloor);
    const next = Math.round(clamp(target, prev - ESSENTIALS.maxDailyShift, prev + ESSENTIALS.maxDailyShift) * 1000) / 1000;
    q[cat].upsertDay.run(nextDay(day), next);
    return next;
  });
}

// ---------------------------------------------------------------- người chơi mua & dùng

/** Giá bán lẻ một suất/bộ gia tộc hạng `quality`: giá tham chiếu một đơn vị ÷ số suất × 1,15 × hệ số hạng. */
export function clanItemPrice(cat, ref, quality = 0) {
  return Math.max(1, Math.ceil((ref / ESSENTIALS.cats[cat].perUnit) * ESSENTIALS.markup * ESSENTIALS.qualities[quality].mult));
}

/** Hạn mức đồ NPC hôm nay của nhóm (món), hoặc Infinity với tài khoản mới. */
export function npcAllowance(userId, cat, now = Date.now()) {
  const user = getUser(userId);
  if (isNewbie(user, now)) return Infinity;
  const pets = Math.max(1, listPets(userId).length);
  const d = currentD(cat, now);
  const { npcBoost, npcSpare } = essentialStage(d);
  const daily = Math.ceil(pets * ESSENTIALS.cats[cat].perPetDay * Math.max(ESSENTIALS.npcFloor, 1 - d) * npcBoost) + npcSpare;
  return Math.max(0, daily - (q.buys.get(userId, dayKey(now))?.[BUY_COLS[cat][0]] ?? 0));
}

/** `refs`: giá tham chiếu hôm nay của hàng mỗi nhóm, { food, care }. */
export function essentialsView(userId, refs, now = Date.now()) {
  const newbie = isNewbie(getUser(userId), now);
  return {
    newbie,
    ...perCat((cat) => {
      const d = currentD(cat, now);
      const stage = essentialStage(d);
      const left = npcAllowance(userId, cat, now);
      return {
        d,
        stage: { key: stage.key, name: stage.name, icon: stage.icon },
        npcPriceFactor: newbie ? 1 : npcPriceFactor(d),
        npcXpFactor: newbie ? 1 : npcXpFactor(d),
        npcLeft: Number.isFinite(left) ? left : null,
        stock: stockOf(cat),
        prices: ESSENTIALS.qualities.map((_, i) => clanItemPrice(cat, refs[cat], i)),
      };
    }),
  };
}

/**
 * Kiểm tra và ghi nhận khi người chơi mua đồ ăn/đồ chăm sóc ở Siêu thị. Trả về giá một món (đã nhân hệ số), hoặc
 * null nếu không phải hàng thiết yếu (giữ giá cũ). Ném lỗi khi hết hạn mức NPC hoặc Siêu thị hết hàng gia tộc.
 */
export function chargeEssential(userId, item, qty, basePrice, refs, now = Date.now()) {
  const cat = essentialCat(item);
  if (!cat) return null;
  const day = dayKey(now);
  const meta = ESSENTIALS.cats[cat];
  if (item.clanMade) {
    const stock = stockOf(cat);
    const qi = item.quality ?? 0;
    if (stock[qi] < qty) throw new GameError(`Siêu thị chỉ còn ${stock[qi]} ${meta.unit} ${item.name}.`);
    stock[qi] -= qty;
    setStock(cat, stock);
    q[cat].addBuys.run(userId, day, 0, qty);
    q[cat].addFlow.run(day, currentD(cat, now), qty, 0, 0, qty);
    return clanItemPrice(cat, refs[cat], qi);
  }
  const left = npcAllowance(userId, cat, now);
  if (left < qty) {
    const hint = `Mua ${meta.icon} hàng gia tộc do người chơi làm ra nhé.`;
    throw new GameError(left > 0
      ? `Hôm nay bạn chỉ mua thêm được ${left} món ${meta.name.toLowerCase()} NPC. ${hint}`
      : `Hết hạn mức ${meta.name.toLowerCase()} NPC hôm nay. ${hint}`);
  }
  q[cat].addBuys.run(userId, day, qty, 0);
  q[cat].addFlow.run(day, currentD(cat, now), qty, 0, qty, 0);
  return Math.max(1, Math.round(basePrice * (isNewbie(getUser(userId), now) ? 1 : npcPriceFactor(currentD(cat, now)))));
}

/** Hệ số XP khi bé dùng một món: đồ NPC theo giai đoạn của nhóm; hàng gia tộc và tài khoản mới giữ nguyên. */
export function essentialXpFactor(userId, item, now = Date.now()) {
  const cat = essentialCat(item);
  if (!cat || item.clanMade) return 1;
  if (isNewbie(getUser(userId), now)) return 1;
  return npcXpFactor(currentD(cat, now));
}

export const essentialsHistory = (cat, day, n = 14) => q[cat].history.all(day, n).reverse();
