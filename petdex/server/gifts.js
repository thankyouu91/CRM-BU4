// Mã quà: quản trị viên tạo mã (xu, vật phẩm, trang phục theo cấp), người chơi nhập trong game để nhận.
// Mỗi người nhận một mã một lần; mã có thể giới hạn tổng lượt dùng và hạn dùng, và thu hồi được.
import { randomInt } from 'node:crypto';
import { addItem, db, getUser, transaction } from './db.js';
import { GameError, ITEMS } from './game.js';
import { post } from './ledger.js';
import { createGear, createRandomGear, describeGear } from './gear.js';
import { TIERS } from '../../public/ta-tua/game/js/shared/gear.js';

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

/** Mã ngẫu nhiên dạng XXXX-XXXX. */
export function randomGiftCode() {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${pick()}-${pick()}`;
}

/** Kiểm tra phần quà quản trị viên nhập; trả về bản đã chuẩn hóa. */
export function cleanRewards(input = {}) {
  const coins = input.coins == null || input.coins === '' ? 0 : Number(input.coins);
  if (!Number.isInteger(coins) || coins < 0 || coins > MAX_COINS) throw new GameError(`Xu thưởng phải là số nguyên 0–${MAX_COINS.toLocaleString('vi-VN')}.`);
  const items = {};
  for (const [id, n] of Object.entries(input.items ?? {})) {
    const item = Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
    if (!item) throw new GameError(`Không có vật phẩm "${id}".`);
    if (item.type === 'accessory') throw new GameError('Trang phục thêm ở mục "Trang phục" để chọn cấp.');
    const qty = Number(n);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new GameError(`Số lượng ${item.name} phải từ 1 đến 99.`);
    items[id] = qty;
  }
  const gear = (input.gear ?? []).map((g) => {
    const itemId = g?.itemId && g.itemId !== 'random' ? String(g.itemId) : 'random';
    if (itemId !== 'random' && ITEMS[itemId]?.type !== 'accessory') throw new GameError('Trang phục không hợp lệ.');
    const tier = g?.tier && g.tier !== 'random' ? String(g.tier) : 'random';
    if (tier !== 'random' && !TIERS[tier]) throw new GameError('Cấp trang phục không hợp lệ.');
    return { itemId, tier };
  });
  if (gear.length > 10) throw new GameError('Mỗi mã tặng tối đa 10 món trang phục.');
  if (!coins && !Object.keys(items).length && !gear.length) throw new GameError('Mã quà cần có ít nhất một phần quà.');
  return { coins, items, gear };
}

/** Mô tả phần quà cho người xem. */
export function rewardsText(rewards) {
  const parts = [];
  if (rewards.coins) parts.push(`${rewards.coins.toLocaleString('vi-VN')} 🪙`);
  for (const [id, n] of Object.entries(rewards.items ?? {})) parts.push(`${n} × ${ITEMS[id]?.icon ?? ''} ${ITEMS[id]?.name ?? id}`);
  for (const g of rewards.gear ?? []) {
    const name = g.itemId === 'random' ? 'Trang phục ngẫu nhiên' : ITEMS[g.itemId]?.name ?? g.itemId;
    parts.push(`${name} (${g.tier === 'random' ? 'cấp ngẫu nhiên' : `cấp ${TIERS[g.tier].name}`})`);
  }
  return parts.join(', ');
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
  const rewards = JSON.parse(row.rewards);
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

/** Người chơi nhập mã: kiểm tra rồi trao quà; trả về lời nhắn và những gì đã nhận. */
export function redeemGiftCode(userId, rawCode, now = Date.now()) {
  throttle(userId, now);
  const code = String(rawCode ?? '').trim().toUpperCase();
  if (!CODE_RULE.test(code)) throw new GameError('Mã quà không đúng.');
  return transaction(() => {
    const row = q.byCode.get(code);
    if (!row) throw new GameError('Mã quà không đúng.');
    if (row.revoked_at) throw new GameError('Mã quà này đã bị thu hồi.');
    if (row.expires_at && row.expires_at <= now) throw new GameError('Mã quà này đã hết hạn.');
    if (q.redeemed.get(row.id, userId)) throw new GameError('Bạn đã nhận quà của mã này rồi.');
    if (q.use.run(row.id).changes === 0) throw new GameError('Mã quà này đã hết lượt.');
    q.redeem.run(row.id, userId, now);
    const rewards = JSON.parse(row.rewards);
    const gear = [];
    if (rewards.coins) post({ userId, delta: rewards.coins, kind: 'gift_code', memo: `Mã quà ${row.code}`, now });
    for (const [id, n] of Object.entries(rewards.items ?? {})) if (ITEMS[id]) addItem(userId, id, n);
    for (const g of rewards.gear ?? []) {
      const tier = g.tier === 'random' ? null : g.tier;
      const made = g.itemId === 'random'
        ? createRandomGear(userId, { source: 'gift', tier }, now)
        : createGear(userId, g.itemId, { source: 'gift', tier }, now);
      gear.push(describeGear(made));
    }
    const user = getUser(userId);
    return {
      code: row.code,
      label: row.label,
      gear,
      message: `🎁 ${row.label}: đã nhận ${rewardsText(rewards)}.`,
      who: user.display_name ?? user.username,
    };
  });
}
