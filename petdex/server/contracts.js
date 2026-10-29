// Hợp đồng cung ứng giữa hai người chơi: mỗi đêm bên bán giao hàng cho bên mua với giá đã chốt, hai bên ký quỹ.
import { db, findUserByName, getUser, transaction } from './db.js';
import { startOfDay } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { post } from './ledger.js';
import { addGoods, currentPrices, recordGain, removeGoods, stock } from './market.js';
import { COMMODITIES, LOT, amountFor } from './rules/market.js';
import { CONTRACTS, CREDIT, contractDayValue, contractEscrows, shortfallPenalty } from './rules/production.js';
import { addCredit } from './credit.js';

// Trong bảng contracts, `qty` là số lô mỗi ngày và `price` là giá mỗi lô (xu, số nguyên).
const q = {
  byId: db.prepare('SELECT * FROM contracts WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO contracts (seller_id, buyer_id, proposer_id, commodity, qty, price, days, days_left, buyer_escrow, seller_escrow, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)`),
  mine: db.prepare(`
    SELECT c.*, s.username AS seller, b.username AS buyer FROM contracts c
    JOIN users s ON s.id = c.seller_id JOIN users b ON b.id = c.buyer_id
    WHERE (c.seller_id = ? OR c.buyer_id = ?) AND (c.status IN ('proposed', 'active') OR c.ended_at > ?)
    ORDER BY c.status = 'active' DESC, c.id DESC`),
  openCount: db.prepare("SELECT COUNT(*) AS n FROM contracts WHERE (seller_id = ? OR buyer_id = ?) AND status IN ('proposed', 'active')"),
  active: db.prepare("SELECT * FROM contracts WHERE status = 'active' AND accepted_at < ? AND (last_day IS NULL OR last_day < ?) ORDER BY id"),
  stale: db.prepare("SELECT * FROM contracts WHERE status = 'proposed' AND created_at < ?"),
  escrowOf: db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN seller_id = ? THEN seller_escrow ELSE 0 END + CASE WHEN buyer_id = ? THEN buyer_escrow ELSE 0 END), 0) AS total
    FROM contracts WHERE status IN ('proposed', 'active') AND (seller_id = ? OR buyer_id = ?)`),
  accept: db.prepare("UPDATE contracts SET status = 'active', accepted_at = ?, buyer_escrow = ?, seller_escrow = ? WHERE id = ?"),
  save: db.prepare('UPDATE contracts SET days_left = ?, delivered = ?, buyer_escrow = ?, seller_escrow = ?, last_day = ?, status = ?, broken_by = ?, ended_at = ? WHERE id = ?'),
  end: db.prepare('UPDATE contracts SET status = ?, buyer_escrow = 0, seller_escrow = 0, broken_by = ?, ended_at = ? WHERE id = ?'),
};

const escrowAccount = (id) => `contract:${id}`;

/** Tổng xu `userId` đang ký quỹ trong các hợp đồng (tính vào tài sản ròng). */
export const escrowOf = (userId) => q.escrowOf.get(userId, userId, userId, userId).total;
const other = (c, userId) => (c.seller_id === userId ? c.buyer_id : c.seller_id);
const nameOf = (c) => COMMODITIES[c.commodity].name;

function lock(c, userId, amount, now) {
  if (amount <= 0) return;
  post({ userId, delta: -amount, kind: 'escrow_lock', memo: `Ký quỹ hợp đồng #${c.id}`, now });
  post({ account: escrowAccount(c.id), delta: amount, kind: 'escrow_lock', memo: getUser(userId).username, now });
}

/** Rút `amount` xu khỏi quỹ hợp đồng về ví `userId` (`kind` là hoàn ký quỹ hoặc bồi thường). */
function release(c, userId, amount, now, kind = 'escrow_release', memo = `Hợp đồng #${c.id}`) {
  if (amount <= 0) return;
  post({ account: escrowAccount(c.id), delta: -amount, kind, memo: getUser(userId).username, now });
  post({ userId, delta: amount, kind, memo, now });
}

/** Đề xuất hợp đồng: `role` là vai của mình ('sell' hoặc 'buy'). Ký quỹ phần mình ngay khi gửi. */
export function propose(userId, { counterpart, role, commodity, lots, price, days }, now = Date.now()) {
  if (!['sell', 'buy'].includes(role)) throw new GameError('Chọn bán hay mua.');
  if (!COMMODITIES[commodity]) throw new GameError('Không có mặt hàng này.');
  if (!Number.isInteger(lots) || lots < 1 || lots > CONTRACTS.maxLots) throw new GameError(`Mỗi ngày giao 1–${CONTRACTS.maxLots} lô.`);
  if (!Number.isInteger(days) || days < CONTRACTS.days[0] || days > CONTRACTS.days[1]) {
    throw new GameError(`Hợp đồng kéo dài ${CONTRACTS.days[0]}–${CONTRACTS.days[1]} ngày.`);
  }
  const market = Math.round(currentPrices()[commodity]); // làm tròn giống giá gửi xuống giao diện
  const [lo, hi] = CONTRACTS.band.map((k) => Math.max(1, Math.round(market * k)));
  if (!Number.isInteger(price) || price < lo || price > hi) throw new GameError(`Giá mỗi lô phải từ ${lo} đến ${hi} xu (giá Sàn đang ${Math.round(market)}).`);
  const partner = findUserByName(String(counterpart ?? '').trim());
  if (!partner) throw new GameError('Không tìm thấy người chơi này.');
  if (partner.id === userId) throw new GameError('Không ký hợp đồng với chính mình được.');
  return transaction(() => {
    for (const id of [userId, partner.id]) {
      if (q.openCount.get(id, id).n >= CONTRACTS.maxOpen) {
        throw new GameError(id === userId ? `Bạn đã có ${CONTRACTS.maxOpen} hợp đồng đang mở.` : `${partner.username} đã có đủ ${CONTRACTS.maxOpen} hợp đồng.`);
      }
    }
    const [sellerId, buyerId] = role === 'sell' ? [userId, partner.id] : [partner.id, userId];
    const escrow = contractEscrows(lots, price, days);
    const mine = role === 'sell' ? escrow.seller : escrow.buyer;
    const id = Number(q.insert.run(sellerId, buyerId, userId, commodity, lots, price, days, days,
      role === 'buy' ? escrow.buyer : 0, role === 'sell' ? escrow.seller : 0, now).lastInsertRowid);
    lock(q.byId.get(id), userId, mine, now);
    return { message: `📜 Đã gửi đề xuất cho ${partner.username}, ký quỹ ${mine} 🪙. Đề xuất hết hạn sau ${CONTRACTS.proposalHours} giờ.` };
  });
}

function mustGet(contractId, userId) {
  const c = q.byId.get(contractId);
  if (!c || (c.seller_id !== userId && c.buyer_id !== userId)) throw new GameError('Không tìm thấy hợp đồng.');
  return c;
}

export function acceptContract(userId, contractId, now = Date.now()) {
  return transaction(() => {
    const c = mustGet(contractId, userId);
    if (c.status !== 'proposed' || c.proposer_id === userId) throw new GameError('Không có đề xuất nào để nhận.');
    if (c.created_at < now - CONTRACTS.proposalHours * HOUR) throw new GameError('Đề xuất này đã hết hạn.');
    const escrow = contractEscrows(c.qty, c.price, c.days);
    const asSeller = c.seller_id === userId;
    lock(c, userId, asSeller ? escrow.seller : escrow.buyer, now);
    q.accept.run(now, escrow.buyer, escrow.seller, c.id);
    return { message: `🤝 Đã ký hợp đồng #${c.id}. Lượt giao đầu tiên vào nửa đêm nay.` };
  });
}

/** Bên nhận từ chối, hoặc bên đề xuất rút lại: hoàn ký quỹ cho bên đề xuất. */
export function declineContract(userId, contractId, now = Date.now()) {
  return transaction(() => {
    const c = mustGet(contractId, userId);
    if (c.status !== 'proposed') throw new GameError('Hợp đồng này không còn ở bước đề xuất.');
    release(c, c.proposer_id, c.buyer_escrow + c.seller_escrow, now);
    q.end.run(c.proposer_id === userId ? 'cancelled' : 'rejected', null, now, c.id);
    return { message: c.proposer_id === userId ? 'Đã rút lại đề xuất, hoàn ký quỹ.' : 'Đã từ chối đề xuất.' };
  });
}

/**
 * Phá hợp đồng: bên kia nhận bồi thường 10% giá trị phần còn lại từ ký quỹ của bên phá (tối đa bằng ký quỹ đó),
 * phần ký quỹ dư trả về bên phá; bên kia nhận lại ký quỹ của mình. Trả về số tiền bồi thường.
 */
function breakBy(c, breakerId, now, reason) {
  const victim = other(c, breakerId);
  const escrow = breakerId === c.seller_id ? c.seller_escrow : c.buyer_escrow;
  const own = breakerId === c.seller_id ? c.buyer_escrow : c.seller_escrow;
  const comp = Math.min(escrow, Math.round(c.days_left * contractDayValue(c.qty, c.price) * CONTRACTS.breakShare));
  release(c, victim, comp, now, 'contract_comp', `Bồi thường hợp đồng #${c.id}`);
  release(c, breakerId, escrow - comp, now);
  release(c, victim, own, now);
  q.end.run('broken', breakerId, now, c.id);
  addCredit(breakerId, CREDIT.contractBroken, `Phá hợp đồng #${c.id}: ${reason}`, now);
  return comp;
}

export function breakContract(userId, contractId, now = Date.now()) {
  return transaction(() => {
    const c = mustGet(contractId, userId);
    if (c.status !== 'active') throw new GameError('Hợp đồng không còn hiệu lực.');
    const comp = breakBy(c, userId, now, 'tự hủy');
    return { message: `Đã hủy hợp đồng #${c.id}: bồi thường ${comp} 🪙 cho đối tác, phần ký quỹ còn lại về ví. −${-CREDIT.contractBroken} điểm tín dụng.` };
  });
}

/** Lấy `amount` xu của `userId`: ví trước, thiếu thì trừ vào ký quỹ của người đó. Trả về số lấy được từ ký quỹ. */
function charge(c, userId, amount, kind, memo, now) {
  const fromWallet = Math.min(amount, Math.max(0, getUser(userId).coins));
  if (fromWallet > 0) post({ userId, delta: -fromWallet, kind, memo, now });
  const fromEscrow = amount - fromWallet;
  if (fromEscrow > 0) post({ account: escrowAccount(c.id), delta: -fromEscrow, kind, memo: getUser(userId).username, now });
  return fromEscrow;
}

/** Giao hàng một đêm của hợp đồng `c`. */
function deliver(c, day, at, prices) {
  const dueQty = c.qty * LOT;
  const seller = getUser(c.seller_id);
  const buyer = getUser(c.buyer_id);
  const have = stock(c.seller_id, at)[c.commodity] ?? 0;
  const n = Math.min(have, dueQty);
  // Bên mua không đủ tiền (cả ví lẫn ký quỹ) để trả cho phần hàng có sẵn → bên mua phá hợp đồng.
  if (amountFor(n, c.price) > Math.max(0, buyer.coins) + c.buyer_escrow) {
    breakBy(c, c.buyer_id, at, 'không đủ tiền nhận hàng');
    return;
  }
  let received = 0;
  if (n > 0) {
    const { cost, expiresAt } = removeGoods(c.seller_id, c.commodity, n, at);
    received = addGoods(c.buyer_id, c.commodity, n, at, { allowPartial: true, expiresAt, cost: c.price / LOT });
    if (received < n) addGoods(c.seller_id, c.commodity, n - received, at, { allowPartial: true, expiresAt, cost });
    const payment = amountFor(received, c.price);
    if (payment > 0) {
      c.buyer_escrow -= charge(c, c.buyer_id, payment, 'contract_buy', `${received / LOT} lô ${nameOf(c)} từ ${seller.username}`, at);
      post({ userId: c.seller_id, delta: payment, kind: 'contract_sell', memo: `${received / LOT} lô ${nameOf(c)} cho ${buyer.username}`, now: at });
      recordGain(c.seller_id, payment - received * cost, at);
    }
  }
  // Phần không vào được vì kho bên mua đầy không tính là giao thiếu: chỉ phạt phần bên bán không có hàng.
  const missingLots = (dueQty - n) / LOT;
  let clean = missingLots === 0;
  if (missingLots > 0) {
    const penalty = shortfallPenalty(missingLots, c.price, prices[c.commodity]);
    const canPay = Math.max(0, getUser(c.seller_id).coins) + c.seller_escrow;
    if (canPay < penalty) {
      breakBy(c, c.seller_id, at, 'giao thiếu hàng');
      return;
    }
    c.seller_escrow -= charge(c, c.seller_id, penalty, 'contract_penalty', `Giao thiếu ${missingLots} lô cho ${buyer.username}`, at);
    if (penalty > 0) post({ userId: c.buyer_id, delta: penalty, kind: 'contract_comp', memo: `${seller.username} giao thiếu ${missingLots} lô`, now: at });
    clean = false;
  }
  if (clean) {
    addCredit(c.seller_id, CREDIT.contractDay, `Giao đủ hàng hợp đồng #${c.id}`, at);
    addCredit(c.buyer_id, CREDIT.contractDay, `Nhận và trả đủ hợp đồng #${c.id}`, at);
  }
  const daysLeft = c.days_left - 1;
  if (daysLeft > 0) {
    q.save.run(daysLeft, c.delivered + received, c.buyer_escrow, c.seller_escrow, day, 'active', null, null, c.id);
    return;
  }
  release(c, c.buyer_id, c.buyer_escrow, at);
  release(c, c.seller_id, c.seller_escrow, at);
  q.save.run(0, c.delivered + received, 0, 0, day, 'done', null, at, c.id);
}

/** Nửa đêm: giao hàng mọi hợp đồng đang chạy, hủy các đề xuất quá hạn (hoàn ký quỹ). */
export function settleContractsDay(day) {
  const end = startOfDay(day) + DAY;
  const at = end - 1;
  transaction(() => {
    const prices = currentPrices();
    for (const c of q.active.all(end, day)) deliver(c, day, at, prices);
    for (const c of q.stale.all(end - CONTRACTS.proposalHours * HOUR)) {
      release(c, c.proposer_id, c.buyer_escrow + c.seller_escrow, at);
      q.end.run('expired', null, at, c.id);
    }
  });
}

export function contractsView(userId, now = Date.now()) {
  const prices = currentPrices();
  return {
    contracts: q.mine.all(userId, userId, now - 3 * DAY).map((c) => ({
      id: c.id,
      role: c.seller_id === userId ? 'sell' : 'buy',
      partner: c.seller_id === userId ? c.buyer : c.seller,
      proposedByMe: c.proposer_id === userId,
      commodity: c.commodity,
      lots: c.qty,
      price: c.price,
      market: Math.round(prices[c.commodity]),
      days: c.days,
      daysLeft: c.days_left,
      delivered: c.delivered / LOT,
      myEscrow: c.seller_id === userId ? c.seller_escrow : c.buyer_escrow,
      theirEscrow: c.seller_id === userId ? c.buyer_escrow : c.seller_escrow,
      status: c.status,
      brokenByMe: c.broken_by === userId,
      createdAt: c.created_at,
      expiresAt: c.status === 'proposed' ? c.created_at + CONTRACTS.proposalHours * HOUR : null,
    })),
    prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Math.round(v)])),
    goods: stock(userId, now),
    rules: CONTRACTS,
  };
}
