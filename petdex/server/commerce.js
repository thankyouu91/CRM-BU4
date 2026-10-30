// Sở Công Thương: chống thao túng sàn công nghiệp và số liệu thị trường cho bảng quản trị.
// - M6 thuế chống độc quyền: gia tộc bán quá 40% khối lượng một mặt hàng trên sàn (7 ngày) thì phần vượt chịu +10%.
// - M8 giới hạn mua gom: trong 24 giờ một gia tộc mua tối đa 30% số hàng đang niêm yết của một mặt hàng.
// - commerceView: HHI, thị phần, lệch giá, hàng thiết yếu, cờ tài khoản liên kết giữa các gia tộc nắm ngành chiến lược (M11).
// Luật ở shared/industry.js (MARKET_RULES); giao dịch giữa gia tộc nằm ở clan_trades (buyer_id > 0).
import { db } from './db.js';
import { dayKey } from './clock.js';
import { DAY, HOUR } from './game.js';
import { currentD, stockOf } from './essentials.js';
import {
  ESSENTIALS, ESSENTIAL_CATS, GOODS, MARKET_RULES, STRATEGIC_INDUSTRIES,
} from '../../public/ta-tua/game/js/shared/industry.js';

const q = {
  goodVolume: db.prepare(`
    SELECT COALESCE(SUM(qty), 0) AS total, COALESCE(SUM(CASE WHEN seller_id = ? THEN qty ELSE 0 END), 0) AS mine
    FROM clan_trades WHERE good = ? AND buyer_id > 0 AND day > ?`),
  bought: db.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM clan_trades WHERE buyer_id = ? AND good = ? AND created_at > ?'),
  listed: db.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM goods_listings WHERE good = ? AND closed_at IS NULL AND expires_at > ? AND clan_id <> ?'),
  sellers: db.prepare(`
    SELECT t.good, t.seller_id, c.name, SUM(t.qty) AS qty, SUM(t.qty * t.price) AS value
    FROM clan_trades t JOIN clans c ON c.id = t.seller_id WHERE t.buyer_id > 0 AND t.day > ? GROUP BY t.good, t.seller_id`),
  shopSellers: db.prepare(`
    SELECT t.good, t.seller_id, c.name, SUM(t.qty) AS qty FROM clan_trades t JOIN clans c ON c.id = t.seller_id
    WHERE t.buyer_id = 0 AND t.day > ? GROUP BY t.good, t.seller_id`),
  insertTax: db.prepare('INSERT INTO antitrust_taxes (clan_id, good, qty, tax, share, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  taxes: db.prepare(`
    SELECT a.*, c.name FROM antitrust_taxes a JOIN clans c ON c.id = a.clan_id WHERE a.day > ? ORDER BY a.id DESC LIMIT 50`),
  strategicHolders: db.prepare(`
    SELECT i.clan_id, i.industry, c.name FROM clan_industries i JOIN clans c ON c.id = i.clan_id WHERE c.dissolved_at IS NULL`),
  membersWithInvite: db.prepare(`
    SELECT m.clan_id, u.id AS user_id, u.username, u.display_name, u.invite_id FROM clan_members m JOIN users u ON u.id = m.user_id
    WHERE u.invite_id IS NOT NULL`),
};

const since = (now) => dayKey(now - MARKET_RULES.windowDays * DAY);

/**
 * Thuế chống độc quyền cho `qty` đơn vị gia tộc `sellerId` vừa bán trên sàn, giá `price`/đv (M6).
 * Chỉ phần đưa thị phần 7 ngày của người bán lên quá 40% mới chịu thuế. Trả về { tax, taxedQty, share }.
 */
export function antitrustTax(sellerId, good, qty, price, now = Date.now()) {
  const v = q.goodVolume.get(sellerId, good, since(now));
  const total = v.total + qty;
  const mine = v.mine + qty;
  const share = total ? mine / total : 0;
  if (total < MARKET_RULES.antitrustMinVolume || share <= MARKET_RULES.antitrustShare) return { tax: 0, taxedQty: 0, share };
  // Lượng tối đa người bán được bán mà vẫn ở ngưỡng: x / (total) ≤ s, phần vượt chịu thuế (không quá lượng vừa bán).
  const taxedQty = Math.min(qty, Math.ceil(mine - MARKET_RULES.antitrustShare * total));
  return { tax: Math.round(taxedQty * price * MARKET_RULES.antitrustRate), taxedQty, share };
}

export function recordAntitrust(clanId, good, taxedQty, tax, share, now = Date.now()) {
  q.insertTax.run(clanId, good, taxedQty, tax, share, dayKey(now), now);
}

/** Số đơn vị gia tộc `buyerId` còn được mua của mặt hàng trong 24 giờ tới (M8). */
export function buyCapLeft(buyerId, good, now = Date.now()) {
  const bought = q.bought.get(buyerId, good, now - 24 * HOUR).n;
  const listed = q.listed.get(good, now, buyerId).n;
  const cap = Math.max(MARKET_RULES.buyCapMin, Math.floor((listed + bought) * MARKET_RULES.buyCapShare));
  return Math.max(0, cap - bought);
}

/** HHI (0–10.000) từ danh sách khối lượng. */
export function hhi(volumes) {
  const total = volumes.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  return Math.round(volumes.reduce((s, v) => s + ((v / total) * 100) ** 2, 0));
}

const level = (h) => (h > MARKET_RULES.hhiAlert ? 'alert' : h > MARKET_RULES.hhiWarn ? 'warn' : 'ok');

/**
 * Bảng Sở Công Thương: mỗi mặt hàng có giao dịch trên sàn 7 ngày (khối lượng, HHI, gia tộc lớn nhất, giá bình quân
 * so với giá tham chiếu), hàng thiết yếu (D, kho, thị phần bán cho Siêu thị), thuế chống độc quyền đã thu,
 * cờ tài khoản liên kết.
 */
export function commerceView(refPriceOf, now = Date.now()) {
  const from = since(now);
  const byGood = new Map();
  for (const r of q.sellers.all(from)) {
    const e = byGood.get(r.good) ?? { good: r.good, qty: 0, value: 0, sellers: [] };
    e.qty += r.qty;
    e.value += r.value;
    e.sellers.push({ clanId: r.seller_id, name: r.name, qty: r.qty });
    byGood.set(r.good, e);
  }
  const goods = [...byGood.values()].map((e) => {
    const h = hhi(e.sellers.map((s) => s.qty));
    const top = e.sellers.sort((a, b) => b.qty - a.qty)[0];
    const avg = e.value / e.qty;
    const ref = refPriceOf(e.good);
    return {
      good: e.good, name: GOODS[e.good]?.name ?? e.good, icon: GOODS[e.good]?.icon ?? '',
      qty: e.qty, sellers: e.sellers.length, hhi: h, level: level(h),
      top: { name: top.name, share: Math.round((top.qty / e.qty) * 1000) / 1000 },
      avgPrice: Math.round(avg), refPrice: ref, deviation: ref ? Math.round(((avg - ref) / ref) * 1000) / 1000 : 0,
    };
  }).sort((a, b) => b.hhi - a.hhi || b.qty - a.qty);

  const shop = new Map();
  for (const r of q.shopSellers.all(from)) {
    const e = shop.get(r.good) ?? [];
    e.push({ name: r.name, qty: r.qty });
    shop.set(r.good, e);
  }
  const essentials = ESSENTIAL_CATS.map((cat) => {
    const meta = ESSENTIALS.cats[cat];
    const sellers = (shop.get(meta.good) ?? []).sort((a, b) => b.qty - a.qty);
    const total = sellers.reduce((s, x) => s + x.qty, 0);
    return {
      cat, name: meta.name, label: meta.label, icon: meta.icon, good: meta.good,
      d: currentD(cat, now),
      stock: stockOf(cat),
      shopQty: total, hhi: hhi(sellers.map((s) => s.qty)),
      sellers: sellers.slice(0, 5).map((s) => ({ name: s.name, share: total ? Math.round((s.qty / total) * 1000) / 1000 : 0 })),
    };
  });

  const taxes = q.taxes.all(from).map((t) => ({
    id: t.id, clan: t.name, good: t.good, name: GOODS[t.good]?.name ?? t.good, qty: t.qty, tax: t.tax, share: t.share, day: t.day, at: t.created_at,
  }));

  return {
    rules: MARKET_RULES,
    windowDays: MARKET_RULES.windowDays,
    goods,
    essentials,
    taxes,
    taxTotal: taxes.reduce((s, t) => s + t.tax, 0),
    linked: linkedFlags(),
  };
}

/**
 * M11: tài khoản vào game qua cùng một link mời nhưng ở các gia tộc khác nhau, mà các gia tộc đó cùng nắm ngành chiến
 * lược. Chỉ gắn cờ để quản trị viên xem, không tự phạt.
 */
function linkedFlags() {
  const strategicClans = new Map();
  for (const r of q.strategicHolders.all()) {
    if (!STRATEGIC_INDUSTRIES[r.industry]) continue;
    const e = strategicClans.get(r.clan_id) ?? { name: r.name, industries: [] };
    e.industries.push(r.industry);
    strategicClans.set(r.clan_id, e);
  }
  const byInvite = new Map();
  for (const m of q.membersWithInvite.all()) {
    if (!strategicClans.has(m.clan_id)) continue;
    const list = byInvite.get(m.invite_id) ?? [];
    list.push(m);
    byInvite.set(m.invite_id, list);
  }
  const flags = [];
  for (const [inviteId, list] of byInvite) {
    const clans = [...new Set(list.map((m) => m.clan_id))];
    if (clans.length < 2) continue;
    flags.push({
      inviteId,
      clans: clans.map((id) => ({ id, name: strategicClans.get(id).name, industries: strategicClans.get(id).industries.map((i) => STRATEGIC_INDUSTRIES[i].name) })),
      players: list.map((m) => ({ id: m.user_id, name: m.display_name || m.username, clanId: m.clan_id })),
    });
  }
  return flags;
}
