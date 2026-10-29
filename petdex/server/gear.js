// Trang phục có cấp: mỗi món người chơi sở hữu là một bản trong bảng `gear` (cấp + dòng chỉ số).
// Luật chung (cấp, loại chỉ số, cách quay) ở public/ta-tua/game/js/shared/gear.js.
import { db, getMeta, getUser, gearBonusOf, setMeta, setWear } from './db.js';
import { GameError, ITEMS } from './game.js';
import { post } from './ledger.js';
import { AFFIX_ORDER, DEFAULT_GEAR_CONFIG, TIERS, affixText, cleanAffixes, normalizeGearConfig, rollGear, sumBonus } from '../../public/ta-tua/game/js/shared/gear.js';

const q = {
  insert: db.prepare('INSERT INTO gear (owner_id, item_id, tier, affixes, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
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
    SELECT w.slot, w.item_id, g.id AS gear_id, g.tier, g.affixes FROM pet_wear w LEFT JOIN gear g ON g.id = w.gear_id
    WHERE w.pet_id = ?`),
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
const wearables = () => Object.values(ITEMS).filter((i) => i.type === 'accessory');

/** Tạo một bản cho `ownerId`. `affixes` bỏ trống thì quay theo cấu hình (cấp `tier` hoặc quay cả cấp). */
export function createGear(ownerId, itemId, { tier = null, affixes = null, source, luck = 0, rand = Math.random } = {}, now = Date.now()) {
  if (!isWearable(itemId)) throw new GameError('Món này không phải trang phục.');
  if (tier && !TIERS[tier]) throw new GameError('Không có cấp này.');
  let rolled;
  if (affixes) {
    try {
      rolled = { tier: tier ?? 'blue', affixes: cleanAffixes(affixes) };
    } catch (err) {
      throw new GameError(err.message);
    }
  } else {
    rolled = rollGear(gearConfig(), rand, { luck, tier });
  }
  const id = Number(q.insert.run(ownerId, itemId, rolled.tier, JSON.stringify(rolled.affixes), source, now).lastInsertRowid);
  return getGear(id);
}

/** Một món trang phục ngẫu nhiên (món và cấp đều quay). */
export function createRandomGear(ownerId, { source, luck = 0, tier = null, rand = Math.random } = {}, now = Date.now()) {
  const pool = wearables();
  return createGear(ownerId, pool[Math.floor(rand() * pool.length)].id, { source, luck, tier, rand }, now);
}

export const getGear = (id) => parse(q.byId.get(Number(id)));

/** Tủ đồ của người chơi, kèm món nào đang đeo trên bé nào (đồ đang bày bán thì bỏ ra). */
export function listGear(ownerId, { includeListed = false } = {}) {
  return q.ofOwner.all(ownerId).map(parse).filter((g) => includeListed || !g.listed).map(describeGear);
}

export function describeGear(g) {
  const item = ITEMS[g.item_id];
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
    wornBy: g.worn_by ?? null,
    listed: Boolean(g.listed),
    source: g.source,
    createdAt: g.created_at,
  };
}

/** Trang phục bé đang đeo theo khe, kèm cấp và dòng chỉ số. */
export function wornGear(petId) {
  return Object.fromEntries(q.petWear.all(petId).map((r) => [r.slot, {
    itemId: r.item_id,
    gearId: r.gear_id,
    tier: r.tier ?? null,
    affixes: r.affixes ? JSON.parse(r.affixes) : {},
  }]));
}

/** Đeo bản `gearId` lên bé `pet` (gỡ khỏi bé khác nếu đang đeo ở đó). */
export function equipGear(userId, pet, gearId) {
  const g = getGear(gearId);
  if (!g || g.owner_id !== userId) throw new GameError('Bạn không có món này.');
  if (g.listed) throw new GameError('Món này đang bày bán ở Chợ Phiên.');
  const item = ITEMS[g.item_id];
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
