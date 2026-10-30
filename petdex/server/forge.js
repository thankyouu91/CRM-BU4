// Lò rèn: sửa trang phục hỏng sau trận đấu trường và nâng cấp trang phục; Tiệm vật liệu bán hàng thô giá cao.
// Vật liệu là hàng thô trong kho (rớt từ mini-game hoặc mua trên Sàn), tính bằng lô; giá và tỉ lệ ở cấu hình trang phục.
import { db, transaction } from './db.js';
import { GameError, HOUR, ITEMS } from './game.js';
import { post } from './ledger.js';
import { addGoods, currentPrices, removeGoods, stock } from './market.js';
import { describeGear, gearConfig, getGear, poolOf } from './gear.js';
import { COMMODITIES, LOT } from './rules/market.js';
import { TIERS, nextTier, upgradeAffixes } from '../../public/ta-tua/game/js/shared/gear.js';

/** Hàng thô dùng làm vật liệu rèn. */
export const FORGE_MATERIALS = Object.keys(COMMODITIES).filter((c) => COMMODITIES[c].kind === 'raw');

/** Thứ tự lấy vật liệu: hàng rẻ nhất trên Sàn lúc này trước, để người chơi đỡ mất hàng đắt. */
function cheapestFirst() {
  const prices = currentPrices();
  const price = (c) => prices[c] ?? COMMODITIES[c].base;
  return [...FORGE_MATERIALS].sort((a, b) => price(a) - price(b));
}

const q = {
  repaired: db.prepare('UPDATE gear SET broken = 0, repair_until = ? WHERE id = ? AND broken = 1'),
  upgraded: db.prepare('UPDATE gear SET tier = ?, affixes = ? WHERE id = ? AND tier = ?'),
};

/** Số lô vật liệu rèn đang có trong kho (chỉ tính lô đủ 10 phần). */
export function materialLots(userId, now = Date.now()) {
  const have = stock(userId, now);
  return Math.floor(FORGE_MATERIALS.reduce((s, c) => s + (have[c] ?? 0), 0) / LOT);
}

/** Lấy `lots` lô vật liệu ra khỏi kho (hàng rẻ trước); trả về { mã hàng: số phần } đã dùng. */
function takeMaterials(userId, lots, now) {
  let left = lots * LOT;
  if (!left) return {};
  const have = stock(userId, now);
  const total = FORGE_MATERIALS.reduce((s, c) => s + (have[c] ?? 0), 0);
  if (total < left) throw new GameError(`Cần ${lots} lô vật liệu (hàng thô bất kỳ trong kho), bạn mới có ${Math.floor(total / LOT)} lô.`);
  const used = {};
  for (const c of cheapestFirst()) {
    if (!left) break;
    const take = Math.min(have[c] ?? 0, left);
    if (!take) continue;
    removeGoods(userId, c, take, now);
    used[c] = take;
    left -= take;
  }
  return used;
}

const usedText = (used) => Object.entries(used).map(([c, n]) => `${COMMODITIES[c].icon} ${n / LOT} lô ${COMMODITIES[c].name}`).join(', ');

function ownGear(userId, gearId) {
  const g = getGear(gearId);
  if (!g || g.owner_id !== userId) throw new GameError('Bạn không có món này.');
  if (g.listed) throw new GameError('Món này đang bày bán hoặc đấu giá ở Chợ Phiên.');
  if (g.sealed) throw new GameError('Mở hộp trước đã nhé.');
  return g;
}

/** Giá, tỉ lệ sửa và nâng cấp từng cấp, kèm số lô vật liệu người chơi đang có (cho màn Lò rèn). */
export function forgeView(userId, now = Date.now()) {
  const f = gearConfig().forge;
  const prices = currentPrices();
  return {
    rules: f,
    materialLots: materialLots(userId, now),
    materials: cheapestFirst().map((c) => ({
      commodity: c, name: COMMODITIES[c].name, icon: COMMODITIES[c].icon,
      price: Math.ceil((prices[c] ?? COMMODITIES[c].base) * f.shopMarkup),
    })),
  };
}

/**
 * Sửa món hỏng: trả xu và vật liệu theo cấp, quay `repairChance` %. Thành công thì món nằm ở lò `repairHours` giờ
 * rồi mới cộng chỉ số lại; hỏng thì mất hết, món vẫn hỏng. `rand` truyền vào để kiểm thử.
 */
export function repairGear(userId, gearId, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    const g = ownGear(userId, gearId);
    if (!g.broken) throw new GameError(g.repair_until > now ? 'Món này đang ở lò, chờ sửa xong nhé.' : 'Món này còn lành, không cần sửa.');
    const f = gearConfig().forge;
    const cost = f.repair[g.tier];
    const item = ITEMS[g.item_id];
    const label = `${item.name} (${TIERS[g.tier].name})`;
    const used = takeMaterials(userId, cost.lots, now);
    if (cost.coins) post({ userId, delta: -cost.coins, kind: 'gear_repair', memo: label, now });
    const ok = rand() * 100 < f.repairChance;
    if (ok) q.repaired.run(now + f.repairHours * HOUR, g.id);
    const spent = [cost.coins ? `${cost.coins} 🪙` : null, usedText(used) || null].filter(Boolean).join(' và ');
    return {
      ok,
      gear: describeGear(getGear(g.id)),
      message: ok
        ? `🔨 Sửa thành công ${item.icon} ${label}! Món cần ${f.repairHours} giờ ở lò rồi mới dùng lại được.${spent ? ` Đã dùng ${spent}.` : ''}`
        : `💥 Sửa thất bại, ${item.icon} ${label} vẫn hỏng.${spent ? ` Mất ${spent}.` : ''}`,
    };
  });
}

/**
 * Nâng món lên cấp kế tiếp: rất đắt, tỉ lệ thấp (không quá 30%, cấp càng cao càng thấp). Thành công thì giữ các dòng cũ
 * (nâng theo biên độ cấp mới) và thêm một dòng; hỏng thì mất xu và vật liệu, món giữ nguyên.
 */
export function upgradeGear(userId, gearId, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    const g = ownGear(userId, gearId);
    if (g.broken) throw new GameError('Món đang hỏng: sửa xong rồi hẵng nâng cấp.');
    if (g.repair_until > now) throw new GameError('Món đang ở lò sửa, chờ xong rồi hẵng nâng cấp.');
    const to = nextTier(g.tier);
    if (!to) throw new GameError('Món này đã ở cấp cao nhất.');
    const config = gearConfig();
    const f = config.forge;
    const cost = f.upgrade[g.tier];
    const chance = f.upgradeChance[g.tier];
    const item = ITEMS[g.item_id];
    const label = `${item.name} (${TIERS[g.tier].name} → ${TIERS[to].name})`;
    const used = takeMaterials(userId, cost.lots, now);
    if (cost.coins) post({ userId, delta: -cost.coins, kind: 'gear_upgrade', memo: label, now });
    const ok = rand() * 100 < chance;
    if (ok) q.upgraded.run(to, JSON.stringify(upgradeAffixes(g.tier, to, g.affixes, config.ranges, rand, poolOf(g.item_id))), g.id, g.tier);
    const spent = [cost.coins ? `${cost.coins} 🪙` : null, usedText(used) || null].filter(Boolean).join(' và ');
    return {
      ok,
      gear: describeGear(getGear(g.id)),
      message: ok
        ? `✨ Nâng cấp thành công! ${item.icon} ${item.name} lên cấp ${TIERS[to].name}.`
        : `💥 Nâng cấp thất bại (${chance}%), ${item.icon} ${item.name} giữ nguyên cấp ${TIERS[g.tier].name}.${spent ? ` Mất ${spent}.` : ''}`,
    };
  });
}

/** Tiệm vật liệu: mua `lots` lô hàng thô `commodity` gấp `shopMarkup` lần giá Sàn, về thẳng kho. */
export function buyMaterials(userId, commodity, lots, now = Date.now()) {
  if (!FORGE_MATERIALS.includes(commodity)) throw new GameError('Tiệm không bán món này.');
  if (!Number.isInteger(lots) || lots < 1 || lots > 50) throw new GameError('Mỗi lần mua 1–50 lô.');
  return transaction(() => {
    const unit = forgeView(userId, now).materials.find((m) => m.commodity === commodity).price;
    const coins = unit * lots;
    post({ userId, delta: -coins, kind: 'forge_materials', memo: `${lots} lô ${COMMODITIES[commodity].name}`, now });
    addGoods(userId, commodity, lots * LOT, now, { cost: unit / LOT });
    return { message: `🧺 Đã mua ${lots} lô ${COMMODITIES[commodity].icon} ${COMMODITIES[commodity].name} (${coins} 🪙), hàng đã vào kho.` };
  });
}
