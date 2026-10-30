// Kiểm thử Sở Công Thương trên DB tạm: giới hạn mua gom 30% hàng đang niêm yết trong 24 giờ (M8), thuế chống độc
// quyền khi một gia tộc bán quá 40% khối lượng một mặt hàng trên sàn (M6), bảng HHI và cờ tài khoản liên kết (M11).
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const industry = await import('../server/industry.js');
const commerce = await import('../server/commerce.js');
const macro = await import('../server/macro.js');
const { dayKey } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 30 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  return id;
}

migrate(T0);
runDue(T0, rand);
const day = dayKey(T0);
macro.overrideMacro(day, { phase: 'recovery', weather: 'calm' }, T0);
const m = macro.macroFor(day);
const ref = industry.refPrice('iron_ore', m);
const [seller, buyer, other] = ['banSi', 'muaGom', 'muaLe'].map((name) => {
  const id = newPlayer(name, 6_000_000);
  clans.createClan(id, { name: `Tộc ${name}`, emblem: '⚓', color: '#335577' }, T0);
  clans.donateClan(id, 4_000_000, T0);
  return id;
});
const treasury = (user) => clans.clanView(user, T0).clan.treasury;
const listing = () => industry.industryView(buyer, m, T0).listings.find((l) => l.good === 'iron_ore');

test('luật thuần: HHI 10.000 khi một người bán, 5.000 khi chia đôi, 0 khi không có giao dịch', () => {
  assert.equal(commerce.hhi([10]), 10_000);
  assert.equal(commerce.hhi([5, 5]), 5_000);
  assert.equal(commerce.hhi([]), 0);
});

test('M8: một gia tộc mua tối đa 30% hàng đang niêm yết của một mặt hàng trong 24 giờ', () => {
  industry.importGoods(seller, 'iron_ore', 200, m, T0);
  industry.listGoods(seller, { good: 'iron_ore', qty: 200, price: ref }, m, T0);
  assert.equal(commerce.buyCapLeft(buyer, 'iron_ore', T0), 60);
  assert.equal(industry.industryView(buyer, m, T0).buyLeft.iron_ore, 60);
  assert.throws(() => industry.buyListing(buyer, listing().id, 61, T0), /chỉ được mua thêm 60/);
  industry.buyListing(buyer, listing().id, 30, T0);
  assert.equal(commerce.buyCapLeft(buyer, 'iron_ore', T0), 30);
  // Mới 30 đơn vị giao dịch (dưới 50) nên chưa tính thuế chống độc quyền.
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM antitrust_taxes').get().n, 0);
  const before = treasury(seller);
  industry.buyListing(buyer, listing().id, 30, T0);
  assert.throws(() => industry.buyListing(buyer, listing().id, 1, T0), /đã mua đủ hạn mức/);
  // M6: 60 đơn vị đều của một gia tộc, phần vượt 40% (36 đv) tính trên 30 đv vừa bán → thuế 10% tiền hàng.
  const tax = Math.round(30 * ref * 0.1);
  const fee = Math.ceil(30 * ref * 0.02);
  assert.equal(treasury(seller), before + 30 * ref - fee - tax);
  const row = store.db.prepare('SELECT * FROM antitrust_taxes').get();
  assert.equal(row.qty, 30);
  assert.equal(row.tax, tax);
  assert.equal(industry.tradeIncome(clans.clanView(seller, T0).clan.id, day), 60 * ref - fee * 2 - tax, 'thuế trừ vào doanh thu chịu thuế');
  // Hết 24 giờ thì được mua tiếp.
  assert.ok(commerce.buyCapLeft(buyer, 'iron_ore', T0 + DAY + 1) > 0);
});

test('M6: thị phần dưới 40% thì không bị thuế', () => {
  industry.importGoods(other, 'iron_ore', 200, m, T0);
  industry.listGoods(other, { good: 'iron_ore', qty: 200, price: ref }, m, T0);
  const otherListing = industry.industryView(seller, m, T0).listings.find((l) => l.good === 'iron_ore' && l.clan.name === 'Tộc muaLe');
  const anti = commerce.antitrustTax(clans.clanView(other, T0).clan.id, 'iron_ore', 20, ref, T0);
  assert.equal(anti.tax, 0);
  industry.buyListing(seller, otherListing.id, 20, T0);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM antitrust_taxes').get().n, 1);
});

test('Sở Công Thương: HHI theo mặt hàng, thuế đã thu, cờ tài khoản cùng link mời ở hai gia tộc nắm ngành chiến lược', () => {
  clans.enterIndustry(seller, 'irrigation', T0);
  clans.enterIndustry(other, 'wind_farm', T0);
  store.db.prepare('UPDATE users SET invite_id = 7 WHERE id IN (?, ?)').run(seller, other);
  const v = commerce.commerceView((g) => industry.refPrice(g, m), T0);
  const iron = v.goods.find((g) => g.good === 'iron_ore');
  assert.equal(iron.qty, 80);
  assert.equal(iron.sellers, 2);
  assert.equal(iron.hhi, commerce.hhi([60, 20]));
  assert.equal(iron.level, 'alert');
  assert.equal(iron.top.name, 'Tộc banSi');
  assert.equal(iron.top.share, 0.75);
  assert.equal(v.taxTotal, Math.round(30 * ref * 0.1));
  assert.equal(v.essentials.length, 2);
  assert.equal(v.linked.length, 1);
  assert.deepEqual(v.linked[0].clans.map((c) => c.name).sort(), ['Tộc banSi', 'Tộc muaLe']);
});
