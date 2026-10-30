// Mã quà: quản trị viên tạo mã, người chơi nhập trong game để nhận.
// Phần quà gồm phần luôn nhận (xu và các món) và, nếu có, một lượt chọn: người chơi tự chọn 1 trong 2–6 món.
// Mỗi món có thể cố định, ngẫu nhiên trong một nhóm, hoặc hợp mệnh bé chính của người nhận (cùng hành hoặc
// tương sinh), để quà hợp với từng người chơi dù bé thuộc hành nào.
// Mỗi người nhận một mã một lần; mã có thể giới hạn tổng lượt dùng và hạn dùng, và thu hồi được.
import { randomInt } from 'node:crypto';
import { addItem, db, getPet, getUser, transaction } from './db.js';
import { GameError, ITEMS } from './game.js';
import { post } from './ledger.js';
import { createGear, describeGear } from './gear.js';
import { TIERS } from '../../public/ta-tua/game/js/shared/gear.js';
import { elementOfSpecies, relation } from '../../public/ta-tua/game/js/shared/pets.js';

const q = {
  insert: db.prepare('INSERT INTO gift_codes (code, label, rewards, max_uses, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  byCode: db.prepare('SELECT * FROM gift_codes WHERE code = ?'),
  byId: db.prepare('SELECT * FROM gift_codes WHERE id = ?'),
  list: db.prepare('SELECT * FROM gift_codes ORDER BY id DESC LIMIT 200'),
  use: db.prepare('UPDATE gift_codes SET uses = uses + 1 WHERE id = ? AND (max_uses IS NULL OR uses < max_uses)'),
  revoke: db.prepare('UPDATE gift_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'),
  redeemed: db.prepare('SELECT 1 FROM gift_redemptions WHERE code_id = ? AND user_id = ?'),
  redeem: db.prepare('INSERT INTO gift_redemptions (code_id, user_id, created_at) VALUES (?, ?, ?)'),
  redemptions: db.prepare(`
    SELECT r.created_at, u.id AS user_id, u.username, u.display_name FROM gift_redemptions r JOIN users u ON u.id = r.user_id
    WHERE r.code_id = ? ORDER BY r.created_at DESC LIMIT 200`),
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ chữ dễ nhầm: I, O, 0, 1
export const CODE_RULE = /^[A-Z0-9_-]{4,32}$/;
const MAX_COINS = 1_000_000;
const MAX_ENTRIES = 12;
const MAX_GEAR = 10;

/** Nhóm vật phẩm để quay ngẫu nhiên hoặc chọn hợp mệnh (trang phục là loại quà riêng). */
export const GIFT_CATEGORIES = {
  food: { name: 'Đồ ăn' },
  care: { name: 'Đồ chăm sóc' },
  toy: { name: 'Đồ chơi', noElement: true },
  egg: { name: 'Trứng ngũ hành' },
  any: { name: 'Vật phẩm' },
};
const PICKS = ['fixed', 'random', 'match'];

/** Mã ngẫu nhiên dạng XXXX-XXXX. */
export function randomGiftCode() {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${pick()}-${pick()}`;
}

// Hàng gia tộc chỉ có khi Siêu thị còn kho, không tặng kèm.
const itemsOf = (category) => Object.values(ITEMS).filter((i) => i.type !== 'accessory' && !i.clanMade && (category === 'any' || i.type === category));
const wearables = () => Object.values(ITEMS).filter((i) => i.type === 'accessory');
/** Hợp mệnh: cùng hành hoặc hành của món sinh ra hành của bé. */
const fits = (item, element) => ['same', 'feeds'].includes(relation(item.element, element));
const intIn = (v, lo, hi, what) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new GameError(`${what} phải là số nguyên ${lo}–${hi.toLocaleString('vi-VN')}.`);
  return n;
};

/** Kiểm tra một món quà; trả về bản chuẩn hóa. `allowCoins`: món "xu" chỉ dùng trong lượt chọn. */
function cleanEntry(raw, { allowCoins }) {
  const kind = raw?.kind;
  if (kind === 'coins') {
    if (!allowCoins) throw new GameError('Xu của phần luôn nhận nhập ở ô Xu.');
    return { kind, amount: intIn(raw.amount, 1, MAX_COINS, 'Số xu') };
  }
  const pick = PICKS.includes(raw?.pick) ? raw.pick : 'fixed';
  if (kind === 'item') {
    const qty = intIn(raw.qty ?? 1, 1, 99, 'Số lượng');
    if (pick === 'fixed') {
      const item = Object.hasOwn(ITEMS, raw.itemId ?? '') ? ITEMS[raw.itemId] : null;
      if (!item) throw new GameError(`Không có vật phẩm "${raw.itemId ?? ''}".`);
      if (item.type === 'accessory') throw new GameError('Trang phục chọn ở loại quà "Trang phục" để có cấp.');
      return { kind, pick, itemId: item.id, qty };
    }
    const category = Object.hasOwn(GIFT_CATEGORIES, raw.category ?? '') ? raw.category : null;
    if (!category) throw new GameError('Chọn nhóm vật phẩm cho quà ngẫu nhiên hoặc hợp mệnh.');
    if (pick === 'match' && GIFT_CATEGORIES[category].noElement) throw new GameError(`${GIFT_CATEGORIES[category].name} không có hành, hãy chọn ngẫu nhiên.`);
    return { kind, pick, category, qty };
  }
  if (kind === 'gear') {
    const tier = raw.tier && raw.tier !== 'random' ? String(raw.tier) : 'random';
    if (tier !== 'random' && !TIERS[tier]) throw new GameError('Cấp trang phục không hợp lệ.');
    if (pick === 'fixed') {
      if (ITEMS[raw.itemId]?.type !== 'accessory') throw new GameError('Trang phục không hợp lệ.');
      return { kind, pick, itemId: raw.itemId, tier };
    }
    return { kind, pick, tier };
  }
  throw new GameError('Loại quà không hợp lệ.');
}

/** Phần quà kiểu cũ ({ items: { id: n }, gear: [{ itemId|'random', tier }] }) sang kiểu mới. */
function fromLegacy(input) {
  const entries = [...(input.entries ?? [])];
  for (const [itemId, qty] of Object.entries(input.items ?? {})) entries.push({ kind: 'item', pick: 'fixed', itemId, qty });
  for (const g of input.gear ?? []) {
    entries.push(g?.itemId && g.itemId !== 'random' ? { kind: 'gear', pick: 'fixed', itemId: g.itemId, tier: g.tier } : { kind: 'gear', pick: 'random', tier: g?.tier });
  }
  return entries;
}

/** Kiểm tra phần quà quản trị viên nhập; trả về bản đã chuẩn hóa { coins, entries, choice }. */
export function cleanRewards(input = {}) {
  const coins = input.coins == null || input.coins === '' ? 0 : intIn(input.coins, 0, MAX_COINS, 'Xu thưởng');
  const entries = fromLegacy(input).map((e) => cleanEntry(e, { allowCoins: false }));
  const choice = (input.choice ?? []).map((e) => cleanEntry(e, { allowCoins: true }));
  if (entries.length > MAX_ENTRIES) throw new GameError(`Phần luôn nhận tối đa ${MAX_ENTRIES} món.`);
  if (choice.length === 1 || choice.length > 6) throw new GameError('Lượt chọn cần từ 2 đến 6 món để người chơi chọn.');
  if ([...entries, ...choice].filter((e) => e.kind === 'gear').length > MAX_GEAR) throw new GameError(`Mỗi mã tặng tối đa ${MAX_GEAR} món trang phục.`);
  if (!coins && !entries.length && !choice.length) throw new GameError('Mã quà cần có ít nhất một phần quà.');
  return { coins, entries, choice };
}

/** Phần quà đã lưu (kể cả mã tạo trước khi có lượt chọn) ở dạng chuẩn. */
export const normalizeRewards = (stored) => ({ coins: stored.coins ?? 0, entries: fromLegacy(stored), choice: stored.choice ?? [] });

const tierText = (tier) => (tier === 'random' ? 'cấp ngẫu nhiên' : `cấp ${TIERS[tier]?.name ?? tier}`);

/** Mô tả một món quà cho người xem (trước khi quay). */
export function entryText(e) {
  if (e.kind === 'coins') return `${e.amount.toLocaleString('vi-VN')} 🪙`;
  if (e.kind === 'item') {
    if (e.pick === 'fixed') return `${e.qty} × ${ITEMS[e.itemId]?.icon ?? ''} ${ITEMS[e.itemId]?.name ?? e.itemId}`;
    const name = GIFT_CATEGORIES[e.category]?.name ?? e.category;
    return `${e.qty} × ${name} ${e.pick === 'match' ? 'hợp mệnh bé chính' : 'ngẫu nhiên'}`;
  }
  const name = e.pick === 'fixed' ? ITEMS[e.itemId]?.name ?? e.itemId : e.pick === 'match' ? 'Trang phục hợp mệnh bé chính' : 'Trang phục ngẫu nhiên';
  return `${name} (${tierText(e.tier)})`;
}

/** Mô tả cả phần quà. */
export function rewardsText(stored) {
  const r = normalizeRewards(stored);
  const parts = [];
  if (r.coins) parts.push(`${r.coins.toLocaleString('vi-VN')} 🪙`);
  parts.push(...r.entries.map(entryText));
  if (r.choice.length) parts.push(`tự chọn 1 trong: ${r.choice.map(entryText).join(' / ')}`);
  return parts.join(', ');
}

/** Hành của bé chính người nhận (null nếu chưa có bé): dùng cho quà hợp mệnh. */
function elementOf(userId) {
  const user = getUser(userId);
  const pet = user?.active_pet_id ? getPet(user.active_pet_id) : null;
  return pet ? elementOfSpecies(pet.species) : null;
}

/** Trao một món quà; trả về lời mô tả món thật sự nhận được. */
function grant(userId, e, { element, rand, now, gear, code }) {
  const pickFrom = (pool) => pool[Math.floor(rand() * pool.length)];
  if (e.kind === 'coins') {
    post({ userId, delta: e.amount, kind: 'gift_code', memo: `Mã quà ${code}`, now });
    return entryText(e);
  }
  if (e.kind === 'item') {
    let item = e.pick === 'fixed' ? ITEMS[e.itemId] : null;
    if (!item) {
      const pool = itemsOf(e.category);
      const fitting = e.pick === 'match' && element ? pool.filter((i) => fits(i, element)) : [];
      item = pickFrom(fitting.length ? fitting : pool);
    }
    addItem(userId, item.id, e.qty);
    return `${e.qty} × ${item.icon ?? ''} ${item.name}`;
  }
  let itemId = e.pick === 'fixed' ? e.itemId : null;
  if (!itemId) {
    const pool = wearables();
    const fitting = e.pick === 'match' && element ? pool.filter((i) => fits(i, element)) : [];
    itemId = pickFrom(fitting.length ? fitting : pool).id;
  }
  const made = describeGear(createGear(userId, itemId, { source: 'gift', tier: e.tier === 'random' ? null : e.tier, rand }, now));
  gear.push(made);
  return `${made.name} (cấp ${made.tierName})`;
}

export function createGiftCode({ code, label, rewards, maxUses = null, expiresAt = null, createdBy }, now = Date.now()) {
  let finalCode = code ? String(code).trim().toUpperCase() : randomGiftCode();
  if (!CODE_RULE.test(finalCode)) throw new GameError('Mã 4–32 ký tự: chữ không dấu, số, dấu - hoặc _.');
  // mã ngẫu nhiên trùng (rất hiếm) thì quay lại; mã tự đặt trùng thì báo
  for (let tries = 0; !code && tries < 5 && q.byCode.get(finalCode); tries++) finalCode = randomGiftCode();
  if (q.byCode.get(finalCode)) throw new GameError('Mã này đã có, chọn mã khác.');
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100_000)) throw new GameError('Số lượt dùng không hợp lệ.');
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= now)) throw new GameError('Hạn dùng phải ở tương lai.');
  const clean = cleanRewards(rewards);
  const name = String(label ?? '').trim().slice(0, 60) || 'Mã quà';
  const id = Number(q.insert.run(finalCode, name, JSON.stringify(clean), maxUses, expiresAt, createdBy, now).lastInsertRowid);
  return giftView(q.byId.get(id), now);
}

export function giftView(row, now = Date.now()) {
  const rewards = normalizeRewards(JSON.parse(row.rewards));
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    rewards,
    rewardsText: rewardsText(rewards),
    maxUses: row.max_uses,
    uses: row.uses,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    usable: usable(row, now),
  };
}

const usable = (row, now) => !row.revoked_at && (!row.expires_at || row.expires_at > now) && (row.max_uses == null || row.uses < row.max_uses);

export const listGiftCodes = (now = Date.now()) => q.list.all().map((r) => giftView(r, now));
export const giftCodeById = (id) => q.byId.get(Number(id));
export const giftRedemptions = (id) => q.redemptions.all(Number(id)).map((r) => ({ userId: r.user_id, name: r.display_name ?? r.username, at: r.created_at }));
export const revokeGiftCode = (id, now = Date.now()) => q.revoke.run(now, Number(id)).changes > 0;

// Chống dò mã: mỗi người chơi tối đa 10 lần nhập mỗi phút (bộ nhớ của máy chủ game, một Durable Object).
const attempts = new Map();
function throttle(userId, now) {
  const recent = (attempts.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) throw new GameError('Bạn nhập mã nhiều quá, thử lại sau một phút nhé.');
  recent.push(now);
  attempts.set(userId, recent);
}

/**
 * Người chơi nhập mã: kiểm tra rồi trao quà; trả về lời nhắn và những gì đã nhận.
 * Mã có lượt chọn mà chưa chọn (`choice` trống): chưa trao gì, chưa tính lượt, trả về các món để chọn.
 */
export function redeemGiftCode(userId, rawCode, choice = null, now = Date.now(), rand = Math.random) {
  throttle(userId, now);
  const code = String(rawCode ?? '').trim().toUpperCase();
  if (!CODE_RULE.test(code)) throw new GameError('Mã quà không đúng.');
  return transaction(() => {
    const row = q.byCode.get(code);
    if (!row) throw new GameError('Mã quà không đúng.');
    if (row.revoked_at) throw new GameError('Mã quà này đã bị thu hồi.');
    if (row.expires_at && row.expires_at <= now) throw new GameError('Mã quà này đã hết hạn.');
    if (q.redeemed.get(row.id, userId)) throw new GameError('Bạn đã nhận quà của mã này rồi.');
    if (row.max_uses != null && row.uses >= row.max_uses) throw new GameError('Mã quà này đã hết lượt.');
    const rewards = normalizeRewards(JSON.parse(row.rewards));
    const fixed = { ...rewards, choice: [] };
    if (rewards.choice.length && (choice === null || choice === undefined || choice === '')) {
      return {
        needsChoice: true,
        code: row.code,
        label: row.label,
        always: rewardsText(fixed),
        options: rewards.choice.map((e, index) => ({ index, text: entryText(e) })),
        message: `🎁 ${row.label}: chọn 1 món quà.`,
      };
    }
    let picked = null;
    if (rewards.choice.length) {
      const i = Number(choice);
      if (!Number.isInteger(i) || i < 0 || i >= rewards.choice.length) throw new GameError('Món quà chọn không hợp lệ.');
      picked = rewards.choice[i];
    }
    if (q.use.run(row.id).changes === 0) throw new GameError('Mã quà này đã hết lượt.');
    q.redeem.run(row.id, userId, now);
    const ctx = { element: elementOf(userId), rand, now, gear: [], code: row.code };
    const got = [];
    if (rewards.coins) {
      post({ userId, delta: rewards.coins, kind: 'gift_code', memo: `Mã quà ${row.code}`, now });
      got.push(`${rewards.coins.toLocaleString('vi-VN')} 🪙`);
    }
    for (const e of rewards.entries) got.push(grant(userId, e, ctx));
    if (picked) got.push(grant(userId, picked, ctx));
    const user = getUser(userId);
    return {
      code: row.code,
      label: row.label,
      gear: ctx.gear,
      received: got,
      message: `🎁 ${row.label}: đã nhận ${got.join(', ')}.`,
      who: user.display_name ?? user.username,
    };
  });
}
