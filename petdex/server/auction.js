// Đấu giá trang phục ở Chợ Phiên: người bán đặt giá khởi điểm và thời hạn, người mua trả giá tăng dần.
// Giá đang dẫn được giữ khỏi ví người trả (ký quỹ); bị trả cao hơn thì hoàn ngay. Hết giờ: món về người trả cao nhất.
import { db, getUser, transaction } from './db.js';
import { DAY, GameError, HOUR, ITEMS } from './game.js';
import { chargeFee, post } from './ledger.js';
import { describeGear, gearValue, getGear, setGearListed, tradeBonus, transferGear } from './gear.js';
import { AUCTION, BAZAAR } from './rules/production.js';

const q = {
  insert: db.prepare(`
    INSERT INTO auctions (seller_id, gear_id, start_price, ref_price, created_at, ends_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'open')`),
  byId: db.prepare('SELECT * FROM auctions WHERE id = ?'),
  open: db.prepare(`
    SELECT a.*, s.username AS seller FROM auctions a JOIN users s ON s.id = a.seller_id
    WHERE a.status = 'open' AND a.ends_at > ? ORDER BY a.ends_at LIMIT 200`),
  myOpen: db.prepare("SELECT COUNT(*) AS n FROM auctions WHERE seller_id = ? AND status = 'open'"),
  closed: db.prepare(`
    SELECT a.*, s.username AS seller, b.username AS winner FROM auctions a
    JOIN users s ON s.id = a.seller_id LEFT JOIN users b ON b.id = a.top_bidder
    WHERE a.status != 'open' AND (a.seller_id = ? OR (a.top_bidder = ? AND a.status = 'sold'))
    ORDER BY a.closed_at DESC LIMIT 10`),
  bid: db.prepare(`
    UPDATE auctions SET top_bid = ?, top_bidder = ?, bids = bids + 1, ends_at = ?
    WHERE id = ? AND status = 'open' AND COALESCE(top_bid, 0) = ?`),
  close: db.prepare("UPDATE auctions SET status = ?, closed_at = ? WHERE id = ? AND status = 'open'"),
  due: db.prepare("SELECT * FROM auctions WHERE status = 'open' AND ends_at <= ?"),
  held: db.prepare("SELECT COALESCE(SUM(top_bid), 0) AS n FROM auctions WHERE status = 'open' AND top_bidder = ?"),
};

/** Số xu `userId` đang bị giữ vì dẫn các phiên chưa đóng (vẫn là tài sản của họ). */
export const heldInAuctions = (userId) => q.held.get(userId).n;

/** Bước giá tối thiểu khi giá đang là `top`. */
export const bidStep = (top) => Math.max(AUCTION.minStep, Math.ceil(top * AUCTION.stepPct));
/** Giá thấp nhất được trả tiếp cho phiên `a`. */
export const minBid = (a) => (a.top_bid ? a.top_bid + bidStep(a.top_bid) : a.start_price);

/** Khoảng giá khởi điểm cho phép với giá tham chiếu `ref`. */
export const startBand = (ref) => AUCTION.startBand.map((k) => Math.max(1, Math.round(ref * k)));

function lotOf(a) {
  const g = getGear(a.gear_id);
  const item = g && ITEMS[g.item_id];
  if (!item) return { name: 'Trang phục', icon: '🎀' };
  const view = describeGear(g);
  return {
    gearId: g.id, itemId: item.id, name: item.name, icon: item.icon, slot: item.slot, element: item.element,
    sealed: view.sealed, tier: view.tier, tierName: view.tierName, lines: view.lines, pool: view.pool,
  };
}

const auctionView = (a, userId) => ({
  id: a.id,
  ...lotOf(a),
  seller: a.seller,
  mine: a.seller_id === userId,
  leading: a.top_bidder === userId,
  startPrice: a.start_price,
  refPrice: a.ref_price,
  topBid: a.top_bid,
  bids: a.bids,
  minBid: minBid(a),
  endsAt: a.ends_at,
  createdAt: a.created_at,
});

/** Mở phiên đấu giá cho món `gearId` (đã mở hộp hoặc còn nguyên hộp), giá khởi điểm `startPrice`, kéo dài `hours` giờ. */
export function listAuction(userId, { gearId, startPrice, hours }, now = Date.now()) {
  const user = getUser(userId);
  if (now - user.created_at < BAZAAR.minAccountDays * DAY) throw new GameError(`Tài khoản mới cần đủ ${BAZAAR.minAccountDays * 24} giờ mới bày bán được.`);
  if (!AUCTION.hours.includes(hours)) throw new GameError(`Thời hạn đấu giá chỉ chọn ${AUCTION.hours.join(', ')} giờ.`);
  if (!Number.isInteger(startPrice) || startPrice < 1) throw new GameError('Giá khởi điểm không hợp lệ.');
  return transaction(() => {
    if (q.myOpen.get(userId).n >= AUCTION.maxOpen) throw new GameError(`Mỗi người mở tối đa ${AUCTION.maxOpen} phiên đấu giá cùng lúc.`);
    const g = getGear(gearId);
    if (!g || g.owner_id !== userId || g.listed) throw new GameError('Không tìm thấy món trang phục này.');
    const ref = gearValue(g);
    const [lo, hi] = startBand(ref);
    if (startPrice < lo || startPrice > hi) throw new GameError(`Giá khởi điểm phải từ ${lo} đến ${hi} xu (giá tham chiếu ${ref}).`);
    setGearListed(g.id, true);
    chargeFee(userId, Math.max(1, Math.round(startPrice * BAZAAR.listFee)), 'Phí mở phiên đấu giá', now);
    q.insert.run(userId, g.id, startPrice, ref, now, now + hours * HOUR);
    const item = ITEMS[g.item_id];
    return { message: `🔨 Đã mở phiên đấu giá ${item.icon} ${item.name}, khởi điểm ${startPrice} 🪙, kéo dài ${hours} giờ.` };
  });
}

/** Trả giá `amount` cho phiên `auctionId`: giữ xu của người trả, hoàn xu cho người vừa bị vượt. */
export function placeBid(userId, auctionId, amount, now = Date.now()) {
  if (!Number.isInteger(amount) || amount < 1) throw new GameError('Giá trả không hợp lệ.');
  return transaction(() => {
    const a = q.byId.get(auctionId);
    if (!a || a.status !== 'open' || a.ends_at <= now) throw new GameError('Phiên đấu giá đã kết thúc.');
    if (a.seller_id === userId) throw new GameError('Đây là phiên của bạn.');
    if (a.top_bidder === userId) throw new GameError('Bạn đang trả giá cao nhất rồi.');
    const need = minBid(a);
    if (amount < need) throw new GameError(`Phải trả ít nhất ${need} xu.`);
    const lot = lotOf(a);
    post({ userId, delta: -amount, kind: 'escrow_lock', memo: `Giữ giá đấu ${lot.name}`, now });
    if (a.top_bidder) post({ userId: a.top_bidder, delta: a.top_bid, kind: 'escrow_release', memo: `Hoàn giá đấu ${lot.name} (có người trả cao hơn)`, now });
    // Trả giá sát giờ thì phiên kéo dài thêm, để ai cũng kịp trả lại.
    const endsAt = a.ends_at - now < AUCTION.snipeMs ? now + AUCTION.snipeMs : a.ends_at;
    if (q.bid.run(amount, userId, endsAt, a.id, a.top_bid ?? 0).changes === 0) throw new GameError('Vừa có người trả giá, xem lại giá mới nhé.');
    return { message: `🔨 Bạn đang dẫn phiên ${lot.icon} ${lot.name} với ${amount} 🪙.` };
  });
}

/** Người bán hủy phiên khi chưa ai trả giá; món về lại tủ đồ (phí mở phiên không hoàn). */
export function cancelAuction(userId, auctionId, now = Date.now()) {
  return transaction(() => {
    const a = q.byId.get(auctionId);
    if (!a || a.seller_id !== userId || a.status !== 'open') throw new GameError('Không tìm thấy phiên đấu giá.');
    if (a.top_bidder) throw new GameError('Đã có người trả giá, không hủy được phiên nữa.');
    q.close.run('cancelled', now, a.id);
    setGearListed(a.gear_id, false);
    return { message: 'Đã hủy phiên, món về lại tủ đồ (phí mở phiên không hoàn).' };
  });
}

/** Đóng các phiên đã hết giờ: có người trả thì giao món và trả tiền người bán (trừ phí), không thì trả món về. */
export function settleAuctions(now = Date.now()) {
  const due = q.due.all(now);
  if (!due.length) return 0;
  transaction(() => {
    for (const a of due) {
      const g = getGear(a.gear_id);
      if (!a.top_bidder) {
        q.close.run('unsold', now, a.id);
        if (g) setGearListed(g.id, false);
        continue;
      }
      const lot = lotOf(a);
      if (!g) {
        // Món đã bị quản trị viên xóa trong lúc đấu giá: hoàn tiền người trả.
        q.close.run('cancelled', now, a.id);
        post({ userId: a.top_bidder, delta: a.top_bid, kind: 'escrow_release', memo: `Hoàn giá đấu ${lot.name} (phiên bị hủy)`, now });
        continue;
      }
      const seller = getUser(a.seller_id);
      const winner = getUser(a.top_bidder);
      const fee = Math.max(1, Math.round(a.top_bid * BAZAAR.saleFee));
      post({ userId: a.top_bidder, delta: a.top_bid, kind: 'escrow_release', memo: `Chốt giá đấu ${lot.name}`, now });
      post({ userId: a.top_bidder, delta: -a.top_bid, kind: 'auction_buy', memo: `${lot.name} của ${seller.username}`, now });
      post({ userId: a.seller_id, delta: a.top_bid - fee, kind: 'auction_sale', memo: `${lot.name} cho ${winner.username} (đã trừ phí ${fee})`, now });
      tradeBonus(a.seller_id, a.top_bid - fee, `Đấu giá: ${lot.name}`, now);
      if (Math.floor(fee / 2) > 0) post({ account: 'treasury', delta: Math.floor(fee / 2), kind: 'fee', memo: 'Phí đấu giá', now });
      transferGear(g.id, a.top_bidder);
      q.close.run('sold', now, a.id);
    }
  });
  return due.length;
}

export function auctionsView(userId, now = Date.now()) {
  settleAuctions(now);
  return {
    auctions: q.open.all(now).map((a) => auctionView(a, userId)),
    closedAuctions: q.closed.all(userId, userId).map((a) => ({ ...auctionView(a, userId), status: a.status, winner: a.winner, closedAt: a.closed_at })),
    openMine: q.myOpen.get(userId).n,
    auctionRules: AUCTION,
  };
}
