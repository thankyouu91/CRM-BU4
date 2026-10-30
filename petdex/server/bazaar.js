// Chợ Phiên: người chơi bày bán đồ siêu thị và món tự nấu cho nhau, giá tự đặt trong khoảng cho phép.
import { addItem, db, getUser, inventory, takeItem, transaction, unequipItem } from './db.js';
import { economy, indexedPrice } from './bank.js';
import { DAY, GameError, HOUR, ITEMS, isConsumable } from './game.js';
import { chargeFee, post } from './ledger.js';
import { giveDish, takeDish } from './farm.js';
import { getGear, describeGear, listGear, setGearListed, tradeBonus, transferGear } from './gear.js';
import { TIER_VALUE } from '../../public/ta-tua/game/js/shared/gear.js';
import { windTradeBonus } from './strategic.js';
import { BAZAAR, DISHES, KITCHEN, QUALITY, dishValue } from './rules/production.js';

const q = {
  byId: db.prepare('SELECT * FROM listings WHERE id = ?'),
  open: db.prepare(`
    SELECT l.*, u.username AS seller FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE l.status = 'open' AND l.expires_at > ? ORDER BY l.created_at DESC LIMIT 200`),
  myOpen: db.prepare("SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND status = 'open'"),
  recent: db.prepare(`
    SELECT l.*, b.username AS buyer FROM listings l LEFT JOIN users b ON b.id = l.buyer_id
    WHERE l.seller_id = ? AND l.status != 'open' ORDER BY COALESCE(l.sold_at, l.expires_at) DESC LIMIT 10`),
  bought: db.prepare(`
    SELECT l.*, s.username AS seller FROM listings l JOIN users s ON s.id = l.seller_id
    WHERE l.buyer_id = ? ORDER BY l.sold_at DESC LIMIT 10`),
  insert: db.prepare(`
    INSERT INTO listings (seller_id, kind, ref, quality, made_at, price, ref_price, created_at, expires_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`),
  sell: db.prepare("UPDATE listings SET status = 'sold', buyer_id = ?, sold_at = ? WHERE id = ? AND status = 'open'"),
  close: db.prepare("UPDATE listings SET status = ? WHERE id = ? AND status = 'open'"),
  due: db.prepare("SELECT * FROM listings WHERE status = 'open' AND expires_at <= ?"),
  dishes: db.prepare('SELECT * FROM dishes WHERE user_id = ? AND expires_at > ? ORDER BY expires_at'),
};

const dishExpiry = (madeAt) => madeAt + KITCHEN.shelfDays * DAY;

function describe(l) {
  if (l.kind === 'item') {
    const item = ITEMS[l.ref];
    return { name: item.name, icon: item.icon, type: item.type };
  }
  if (l.kind === 'gear') {
    const g = getGear(l.ref);
    const item = ITEMS[g?.item_id];
    if (!g || !item) return { name: 'Trang phục', icon: '🎀', type: 'accessory' };
    const view = describeGear(g);
    return { name: `${item.name} · ${view.tierName}`, icon: item.icon, type: 'accessory', itemId: item.id, tier: g.tier, lines: view.lines };
  }
  const dish = DISHES[l.ref];
  return { name: dish.name, icon: dish.icon, type: 'dish', quality: QUALITY[l.quality].name, spoilsAt: dishExpiry(l.made_at) };
}

const listingView = (l, userId) => ({
  id: l.id,
  kind: l.kind,
  ref: l.ref,
  ...describe(l),
  price: l.price,
  refPrice: l.ref_price,
  seller: l.seller,
  mine: l.seller_id === userId,
  createdAt: l.created_at,
  expiresAt: l.expires_at,
});

/** Trả hàng về cho người bán khi tin hết hạn hoặc bị gỡ (món ăn đã hư thì mất). */
function giveBack(l, now) {
  if (l.kind === 'item') addItem(l.seller_id, l.ref, 1);
  else if (l.kind === 'gear') setGearListed(l.ref, false);
  else if (dishExpiry(l.made_at) > now) giveDish(l.seller_id, l.ref, l.quality, l.made_at, now);
}

/**
 * Bày bán: `kind` là 'item' (đồ siêu thị, `ref` = mã món) hoặc 'dish' (`ref` = id món đã nấu).
 * Giá phải trong 50–300% giá tham chiếu; phí đăng tin 1% (tối thiểu 1 xu).
 */
export function listForSale(userId, { kind, ref, price }, now = Date.now()) {
  const user = getUser(userId);
  if (now - user.created_at < BAZAAR.minAccountDays * DAY) throw new GameError(`Tài khoản cần đủ ${BAZAAR.minAccountDays} ngày tuổi mới bày bán được.`);
  if (!Number.isInteger(price) || price < 1) throw new GameError('Giá bán không hợp lệ.');
  return transaction(() => {
    if (q.myOpen.get(userId).n >= BAZAAR.maxListings) throw new GameError(`Mỗi người bày tối đa ${BAZAAR.maxListings} món.`);
    let refPrice;
    let row;
    if (kind === 'item') {
      const item = ITEMS[ref];
      if (!item) throw new GameError('Không có món này.');
      if (item.type === 'accessory') throw new GameError('Trang phục bán theo từng món: chọn món ở mục Trang phục.');
      refPrice = indexedPrice(item.price);
      row = { ref, quality: 0, madeAt: null, expiresAt: now + BAZAAR.hours * HOUR };
    } else if (kind === 'gear') {
      const g = getGear(ref);
      if (!g || g.owner_id !== userId || g.listed) throw new GameError('Không tìm thấy món trang phục này.');
      if (g.sealed) throw new GameError('Mở hộp trước rồi hẵng bày bán nhé.');
      refPrice = indexedPrice(ITEMS[g.item_id].price) * (TIER_VALUE[g.tier] ?? 1);
      row = { ref: String(g.id), quality: 0, madeAt: null, expiresAt: now + BAZAAR.hours * HOUR };
    } else if (kind === 'dish') {
      const owned = q.dishes.all(userId, now).find((d) => d.id === Number(ref));
      if (!owned) throw new GameError('Không tìm thấy món này.');
      refPrice = dishValue(owned.recipe, owned.quality, economy().priceIndex);
      row = { ref: owned.recipe, quality: owned.quality, madeAt: owned.made_at, expiresAt: Math.min(now + BAZAAR.hours * HOUR, owned.expires_at) };
    } else {
      throw new GameError('Chỉ bán được đồ siêu thị, trang phục hoặc món tự nấu.');
    }
    const [lo, hi] = BAZAAR.band.map((k) => Math.max(1, Math.round(refPrice * k)));
    if (price < lo || price > hi) throw new GameError(`Giá phải từ ${lo} đến ${hi} xu (giá tham chiếu ${refPrice}).`);

    if (kind === 'item') {
      takeItem(userId, ref, 1);
      if (!inventory(userId)[ref]) unequipItem(userId, ref);
    } else if (kind === 'gear') {
      setGearListed(row.ref, true);
    } else {
      takeDish(userId, Number(ref), now);
    }
    chargeFee(userId, Math.max(1, Math.round(price * BAZAAR.listFee)), 'Phí đăng tin Chợ Phiên', now);
    q.insert.run(userId, kind, row.ref, row.quality, row.madeAt, price, refPrice, now, row.expiresAt);
    return { message: `🏮 Đã bày bán ở Chợ Phiên, tin đăng còn ${Math.round((row.expiresAt - now) / HOUR)} giờ.` };
  });
}

export function buyListing(userId, listingId, now = Date.now()) {
  return transaction(() => {
    const l = q.byId.get(listingId);
    if (!l || l.status !== 'open' || l.expires_at <= now) throw new GameError('Món này không còn bán nữa.');
    if (l.seller_id === userId) throw new GameError('Đây là món bạn đang bán.');
    const what = describe(l);
    if (l.kind === 'item' && !isConsumable(ITEMS[l.ref]) && inventory(userId)[l.ref]) {
      throw new GameError(`Bạn đã có ${what.name} rồi, món này dùng mãi mãi.`);
    }
    const seller = getUser(l.seller_id);
    const fee = Math.max(1, Math.round(l.price * BAZAAR.saleFee));
    post({ userId, delta: -l.price, kind: 'bazaar_buy', memo: `${what.name} của ${seller.username}`, now });
    post({ userId: l.seller_id, delta: l.price - fee, kind: 'bazaar_sale', memo: `${what.name} cho ${getUser(userId).username} (đã trừ phí ${fee})`, now });
    tradeBonus(l.seller_id, l.price - fee, `Chợ Phiên: ${what.name}`, now);
    windTradeBonus(l.seller_id, l.price - fee, `Chợ Phiên: ${what.name}`, now);
    // Phí bán: một nửa vào ngân sách thị trấn, một nửa bị hủy.
    if (Math.floor(fee / 2) > 0) post({ account: 'treasury', delta: Math.floor(fee / 2), kind: 'fee', memo: 'Phí Chợ Phiên', now });
    if (q.sell.run(userId, now, l.id).changes === 0) throw new GameError('Món này vừa có người mua mất rồi.');
    if (l.kind === 'item') addItem(userId, l.ref, 1);
    else if (l.kind === 'gear') transferGear(l.ref, userId);
    else giveDish(userId, l.ref, l.quality, l.made_at, now);
    return { message: `🛍️ Đã mua ${what.icon} ${what.name} giá ${l.price} 🪙.` };
  });
}

export function cancelListing(userId, listingId, now = Date.now()) {
  return transaction(() => {
    const l = q.byId.get(listingId);
    if (!l || l.seller_id !== userId || l.status !== 'open') throw new GameError('Không tìm thấy tin đăng.');
    q.close.run('cancelled', l.id);
    giveBack(l, now);
    return { message: 'Đã gỡ tin, món hàng về lại túi (phí đăng tin không hoàn).' };
  });
}

/** Tin hết hạn: trả hàng về người bán. */
export function expireListings(now = Date.now()) {
  transaction(() => {
    for (const l of q.due.all(now)) {
      q.close.run('expired', l.id);
      giveBack(l, now);
    }
  });
}

export function bazaarView(userId, now = Date.now()) {
  const index = economy().priceIndex;
  const inv = inventory(userId);
  const user = getUser(userId);
  return {
    listings: q.open.all(now).map((l) => listingView(l, userId)),
    sold: q.recent.all(userId).map((l) => ({ ...listingView(l, userId), status: l.status, buyer: l.buyer, soldAt: l.sold_at })),
    bought: q.bought.all(userId).map((l) => ({ ...listingView(l, userId), soldAt: l.sold_at })),
    sellable: {
      gear: listGear(userId).map((g) => ({ ...g, refPrice: indexedPrice(ITEMS[g.itemId].price) * (TIER_VALUE[g.tier] ?? 1) })),
      items: Object.entries(inv).filter(([id, n]) => n > 0 && ITEMS[id] && ITEMS[id].type !== 'accessory').map(([id, n]) => ({
        ref: id, name: ITEMS[id].name, icon: ITEMS[id].icon, qty: n, refPrice: indexedPrice(ITEMS[id].price),
      })),
      dishes: q.dishes.all(userId, now).map((d) => ({
        ref: d.id, recipe: d.recipe, name: DISHES[d.recipe].name, icon: DISHES[d.recipe].icon, quality: QUALITY[d.quality].name,
        expiresAt: d.expires_at, refPrice: dishValue(d.recipe, d.quality, index),
      })),
    },
    canSell: now - user.created_at >= BAZAAR.minAccountDays * DAY,
    sellFrom: user.created_at + BAZAAR.minAccountDays * DAY,
    open: q.myOpen.get(userId).n,
    rules: BAZAAR,
  };
}
