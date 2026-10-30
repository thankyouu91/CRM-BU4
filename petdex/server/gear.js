// Trang phục có cấp: mỗi món người chơi sở hữu là một bản trong bảng `gear` (cấp + dòng chỉ số).
// Luật chung (cấp, loại chỉ số, cách quay) ở public/ta-tua/game/js/shared/gear.js.
import { db, getMeta, getUser, gearBonusOf, setMeta, setWear, transaction } from './db.js';
import { GameError, ITEMS } from './game.js';
import { post } from './ledger.js';
import { indexedPrice } from './bank.js';
import {
  AFFIX_ORDER, DEFAULT_GEAR_CONFIG, QUICK_SELL, TIERS, TIER_VALUE, affixPool, affixText, cleanAffixes, normalizeGearConfig, quickSellRate, rollGear, rollShopGear, sumBonus,
} from '../../public/ta-tua/game/js/shared/gear.js';
import { SLOTS, speciesOrGuest, wearLimit } from '../../public/ta-tua/game/js/shared/pets.js';

const q = {
  insert: db.prepare('INSERT INTO gear (owner_id, item_id, tier, affixes, source, created_at, sealed) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  unseal: db.prepare('UPDATE gear SET sealed = 0 WHERE id = ?'),
  byId: db.prepare('SELECT * FROM gear WHERE id = ?'),
  ofOwner: db.prepare(`
    SELECT g.*, w.pet_id AS worn_by FROM gear g LEFT JOIN pet_wear w ON w.gear_id = g.id
    WHERE g.owner_id = ? ORDER BY g.id DESC`),
  update: db.prepare('UPDATE gear SET tier = ?, affixes = ? WHERE id = ?'),
  setOwner: db.prepare('UPDATE gear SET owner_id = ?, listed = 0 WHERE id = ?'),
  setListed: db.prepare('UPDATE gear SET listed = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM gear WHERE id = ?'),
  unwear: db.prepare('DELETE FROM pet_wear WHERE gear_id = ?'),
  wornIn: db.prepare('SELECT pet_id, slot FROM pet_wear WHERE gear_id = ?'),
  petWear: db.prepare(`
    SELECT w.slot, w.item_id, g.id AS gear_id, g.tier, g.affixes, g.broken, g.repair_until FROM pet_wear w LEFT JOIN gear g ON g.id = w.gear_id
    WHERE w.pet_id = ?`),
  breakWorn: db.prepare(`
    UPDATE gear SET broken = 1, repair_until = 0
    WHERE broken = 0 AND id IN (SELECT w.gear_id FROM pet_wear w JOIN pets p ON p.id = w.pet_id WHERE p.owner_id = ?)`),
};

const parse = (row) => row && { ...row, affixes: JSON.parse(row.affixes || '{}') };

// ---- cấu hình (quản trị viên chỉnh được) ----
let cached = null;
export function gearConfig() {
  if (!cached) {
    const raw = getMeta('gear_config');
    try {
      cached = normalizeGearConfig(raw ? JSON.parse(raw) : DEFAULT_GEAR_CONFIG);
    } catch {
      cached = normalizeGearConfig(DEFAULT_GEAR_CONFIG);
    }
  }
  return cached;
}
export function setGearConfig(input) {
  let next;
  try {
    next = normalizeGearConfig(input);
  } catch (err) {
    throw new GameError(err.message);
  }
  setMeta('gear_config', JSON.stringify(next));
  cached = next;
  return next;
}

// ---- bản trang phục ----
export const isWearable = (itemId) => ITEMS[itemId]?.type === 'accessory';
/** Các loại chỉ số món `itemId` có thể ra (công khai trước khi mua). */
export const poolOf = (itemId) => affixPool(ITEMS[itemId]?.slot, ITEMS[itemId]?.element);
const wearables = () => Object.values(ITEMS).filter((i) => i.type === 'accessory');

/**
 * Tạo một bản cho `ownerId`. `affixes` bỏ trống thì quay theo cấu hình (cấp `tier` hoặc quay cả cấp).
 * `shop`: mua ở Siêu thị, chỉ ra 1–2 dòng chỉ số và về tay dưới dạng hộp kín (mở ra mới lộ dòng nào).
 */
export function createGear(ownerId, itemId, { tier = null, affixes = null, source, luck = 0, shop = false, rand = Math.random } = {}, now = Date.now()) {
  if (!isWearable(itemId)) throw new GameError('Món này không phải trang phục.');
  if (tier && !TIERS[tier]) throw new GameError('Không có cấp này.');
  let rolled;
  if (affixes) {
    try {
      rolled = { tier: tier ?? 'blue', affixes: cleanAffixes(affixes) };
    } catch (err) {
      throw new GameError(err.message);
    }
  } else if (shop) {
    rolled = rollShopGear(gearConfig(), rand, { luck, pool: poolOf(itemId) });
  } else {
    rolled = rollGear(gearConfig(), rand, { luck, tier, pool: poolOf(itemId) });
  }
  const id = Number(q.insert.run(ownerId, itemId, rolled.tier, JSON.stringify(rolled.affixes), source, now, shop ? 1 : 0).lastInsertRowid);
  return getGear(id);
}

/** Một món trang phục ngẫu nhiên (món và cấp đều quay). */
export function createRandomGear(ownerId, { source, luck = 0, tier = null, rand = Math.random } = {}, now = Date.now()) {
  const pool = wearables();
  return createGear(ownerId, pool[Math.floor(rand() * pool.length)].id, { source, luck, tier, rand }, now);
}

export const getGear = (id) => parse(q.byId.get(Number(id)));

/** Tủ đồ của người chơi, kèm món nào đang đeo trên bé nào (đồ đang bày bán thì bỏ ra). `reveal`: quản trị viên xem cả hộp kín. */
export function listGear(ownerId, { includeListed = false, reveal = false } = {}) {
  return q.ofOwner.all(ownerId).map(parse).filter((g) => includeListed || !g.listed)
    .map((g) => ({ ...describeGear(g, { reveal }), quickSell: quickSellPrice(g) }));
}

/** Thẻ một món; hộp kín (chưa mở) thì giấu cấp và dòng chỉ số, trừ khi `reveal`. */
export function describeGear(g, { reveal = false } = {}) {
  const item = ITEMS[g.item_id];
  const sealed = Boolean(g.sealed);
  if (sealed && !reveal) {
    return {
      id: g.id,
      itemId: g.item_id,
      name: item?.name ?? g.item_id,
      slot: item?.slot ?? null,
      element: item?.element ?? null,
      sealed: true,
      pool: poolOf(g.item_id),
      tier: null,
      tierName: 'Hộp chưa mở',
      affixes: {},
      lines: [],
      wornBy: null,
      listed: Boolean(g.listed),
      ...durabilityOf(g),
      source: g.source,
      createdAt: g.created_at,
    };
  }
  return {
    id: g.id,
    itemId: g.item_id,
    name: item?.name ?? g.item_id,
    slot: item?.slot ?? null,
    element: item?.element ?? null,
    tier: g.tier,
    tierName: TIERS[g.tier]?.name ?? g.tier,
    affixes: g.affixes,
    lines: AFFIX_ORDER.filter((a) => g.affixes[a]).map((a) => affixText(a, g.affixes[a])),
    pool: poolOf(g.item_id),
    sealed,
    wornBy: g.worn_by ?? null,
    listed: Boolean(g.listed),
    ...durabilityOf(g),
    source: g.source,
    createdAt: g.created_at,
  };
}

/** Độ bền: `broken` (hỏng sau trận đấu trường), `repairUntil` (đang ở Lò rèn tới lúc này), `usable` (đang cộng chỉ số). */
export function durabilityOf(g, now = Date.now()) {
  const broken = Boolean(g.broken);
  const repairUntil = !broken && g.repair_until > now ? g.repair_until : null;
  return { broken, repairUntil, usable: !broken && !repairUntil };
}

/** Trang phục bé đang đeo theo khe, kèm cấp và dòng chỉ số. */
export function wornGear(petId) {
  return Object.fromEntries(q.petWear.all(petId).map((r) => [r.slot, {
    itemId: r.item_id,
    gearId: r.gear_id,
    tier: r.tier ?? null,
    affixes: r.affixes ? JSON.parse(r.affixes) : {},
    ...durabilityOf(r),
  }]));
}

/**
 * Sau một trận đấu trường: mọi trang phục đang đeo trên các bé của `userIds` hỏng hẳn (không cộng chỉ số tới khi sửa ở Lò rèn).
 * Đồ đang sửa cũng hỏng lại. Trả về số món vừa hỏng. (Tham số giờ trận nếu có thì bỏ qua: hỏng là hỏng ngay.)
 */
export function breakWornGear(userIds) {
  return transaction(() => {
    let n = 0;
    for (const id of new Set(userIds)) n += Number(q.breakWorn.run(Number(id)).changes);
    return n;
  });
}

/** Mở hộp mua ở Siêu thị: lộ cấp và dòng chỉ số. */
export function openGear(userId, gearId) {
  const g = getGear(gearId);
  if (!g || g.owner_id !== userId) throw new GameError('Bạn không có món này.');
  if (!g.sealed) throw new GameError('Hộp này đã mở rồi.');
  q.unseal.run(g.id);
  return describeGear(getGear(g.id));
}

/** Số món bé `pet` đeo được cùng lúc (theo cấp và độ hiếm). */
export const wearLimitOf = (pet) => wearLimit(pet.level, speciesOrGuest(pet.species).rarity);

/** Đeo bản `gearId` lên bé `pet` (gỡ khỏi bé khác nếu đang đeo ở đó). */
export function equipGear(userId, pet, gearId) {
  const g = getGear(gearId);
  if (!g || g.owner_id !== userId) throw new GameError('Bạn không có món này.');
  if (g.listed) throw new GameError('Món này đang bày bán ở Chợ Phiên.');
  if (g.sealed) throw new GameError('Mở hộp trước rồi hẵng đeo nhé.');
  const item = ITEMS[g.item_id];
  // Đổi món trong cùng khe thì không tính thêm; đeo vào khe trống thì phải còn chỗ.
  const limit = wearLimitOf(pet);
  const others = Object.keys(pet.wear ?? {}).filter((s) => s !== item.slot && SLOTS[s]).length;
  if (others >= limit) {
    throw new GameError(`${pet.name} (cấp ${pet.level}) chỉ đeo được ${limit} món cùng lúc. Tháo bớt một món, hoặc lên cấp 30 để đeo thêm.`);
  }
  q.unwear.run(g.id);
  setWear(pet.id, item.slot, item.id, g.id);
  return { gear: describeGear(g), item };
}

/** Sửa cấp và dòng chỉ số (quản trị viên). */
export function updateGear(id, { tier, affixes }) {
  const g = getGear(id);
  if (!g) throw new GameError('Không có món này.');
  if (!TIERS[tier]) throw new GameError('Không có cấp này.');
  let clean;
  try {
    clean = cleanAffixes(affixes);
  } catch (err) {
    throw new GameError(err.message);
  }
  q.update.run(tier, JSON.stringify(clean), g.id);
  return getGear(g.id);
}

/** Giá trị tham chiếu của một bản: giá cửa hàng × hệ số cấp; hộp chưa mở tính như Xanh lam để không lộ cấp. */
export const gearValue = (g) => indexedPrice(ITEMS[g.item_id].price) * (g.sealed ? 1 : TIER_VALUE[g.tier] ?? 1);

/** Số xu Siêu thị trả khi bán nhanh: 10–40% giá trị tùy các dòng chỉ số; hộp chưa mở trả mức thấp nhất. */
export function quickSellPrice(g) {
  const rate = g.sealed ? QUICK_SELL.min : quickSellRate(g.tier, g.affixes, gearConfig().ranges);
  return Math.max(1, Math.floor(gearValue(g) * rate));
}

/** Bán nhanh một món cho Siêu thị: món mất hẳn, tiền về ngay (không có thưởng giao dịch). */
export function quickSellGear(userId, gearId, now = Date.now()) {
  const g = getGear(gearId);
  if (!g || g.owner_id !== userId) throw new GameError('Bạn không có món này.');
  if (g.listed) throw new GameError('Món này đang bày bán hoặc đấu giá ở Chợ Phiên.');
  const item = ITEMS[g.item_id];
  const coins = quickSellPrice(g);
  deleteGear(g.id);
  const label = g.sealed ? 'hộp chưa mở' : TIERS[g.tier]?.name;
  post({ userId, delta: coins, kind: 'gear_quicksell', memo: `${item.name} (${label})`, now });
  return { coins, message: `Đã bán ${item.icon} ${item.name} (${label}) cho Siêu thị, nhận ${coins} 🪙.` };
}

/** Xóa một bản (gỡ khỏi bé đang đeo). */
export function deleteGear(id) {
  q.unwear.run(Number(id));
  q.remove.run(Number(id));
}

/** Chuyển chủ (Chợ Phiên): gỡ khỏi bé đang đeo, bỏ cờ đang bán. */
export function transferGear(id, newOwnerId) {
  q.unwear.run(Number(id));
  q.setOwner.run(newOwnerId, Number(id));
}

export function setGearListed(id, listed) {
  if (listed) q.unwear.run(Number(id));
  q.setListed.run(listed ? 1 : 0, Number(id));
}

// ---- dùng chỉ số ----

/** Chỉ số của bé chính: dùng cho việc của cả người chơi (mua đồ, giao dịch, nấu bằng bé chính). */
export function userBonus(userId) {
  const user = getUser(userId);
  return user?.active_pet_id ? gearBonusOf(user.active_pet_id) : sumBonus([]);
}

/**
 * Thưởng giao dịch: `amount` xu vừa nhận từ một lần bán, cộng thêm % "Thu nhập giao dịch" của bé chính
 * thành một dòng sổ cái riêng. Trả về số xu thưởng.
 */
export function tradeBonus(userId, amount, memo, now = Date.now()) {
  const pct = userBonus(userId).trade;
  const extra = Math.floor((amount * pct) / 100);
  if (extra > 0) post({ userId, delta: extra, kind: 'gear_trade', memo: `+${pct}% trang phục · ${memo}`, now });
  return extra;
}
