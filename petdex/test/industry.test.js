// Kiểm thử chuỗi sản xuất của gia tộc trên DB tạm: mỏ trên lô, khai thác, điện, luyện thép, tự bán cho NPC,
// giữ nguyên liệu, sàn công nghiệp giữa hai gia tộc (tiền bán tính thuế), nhập khẩu từ NPC.
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
const macro = await import('../server/macro.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');
const rules = await import('../../public/ta-tua/game/js/shared/industry.js');
const { dayKey } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY);
  store.savePet({ ...store.getPet(petId), level: 6, fullness: 95, energy: 100, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}

migrate(T0);
runDue(T0, rand);
const a = newPlayer('thepmay', 6_000_000);
const b = newPlayer('muahang', 6_000_000);
const day = dayKey(T0);
// The day's economy (phase, weather) is rolled the first time anything reads it, with Math.random
// when plotPreview reads it. Bad weather (cold: hill -15%) then left no ore over and the test failed
// about 1 run in 4, so pin a neutral day: recovery phase, calm weather.
macro.overrideMacro(day, { phase: 'recovery', weather: 'calm' }, T0);
const BUILT = [
  { piece: 'base-3', x: 2, y: 19, color: '#8b5e3c' },
  { piece: 'wall_brick-8', x: 2, y: 15, color: '#e85d5d' },
  { piece: 'roof_gable-5', x: 2, y: 11, color: '#4b8ff2' },
];
const treasury = (user) => clans.clanView(user, T0).clan.treasury;

test('mỏ trên lô cố định theo địa hình: đồi có khoáng sản, rừng có gỗ, biển có dầu khí', () => {
  const hill = shared.PLOTS.filter((p) => p.zone === 'hill');
  assert.ok(hill.every((p) => Object.keys(rules.depositsOf(p)).some((g) => rules.GOODS[g].group === 'mineral')));
  const forest = shared.PLOTS.find((p) => p.zone === 'forest');
  assert.ok(rules.depositsOf(forest).timber > 0);
  const sea = shared.PLOTS.find((p) => p.zone === 'sea');
  assert.ok(rules.depositsOf(sea).crude_oil > 0 || rules.depositsOf(sea).gas > 0);
  assert.deepEqual(rules.depositsOf(forest), rules.depositsOf(forest), 'cố định');
  assert.equal(rules.RUN_ORDER.length, Object.keys(rules.PRODUCTION_INDUSTRIES).length);
});

let ironPlot;
let factoryPlot;
let powerPlot;

test('gia tộc khai khoáng + luyện thép + điện: quặng và than vào kho, nhà máy dùng điện luyện thép', () => {
  clans.createClan(a, { name: 'Tập Đoàn Thép', emblem: '🐉', color: '#555555' }, T0);
  clans.donateClan(a, 5_000_000, T0);
  clans.enterIndustry(a, 'mining', T0);
  clans.enterIndustry(a, 'steel', T0);
  clans.enterIndustry(a, 'power', T0);
  ironPlot = shared.PLOTS.find((p) => p.zone === 'hill' && rules.depositsOf(p).iron_ore && rules.depositsOf(p).coal);
  factoryPlot = shared.PLOTS.find((p) => p.zone === 'urban');
  powerPlot = shared.PLOTS.find((p) => p.zone === 'river' && rules.plantsFor(p).includes('hydro'));
  assert.ok(ironPlot && factoryPlot && powerPlot, 'phải có lô phù hợp trên bản đồ');
  for (const [plot, ind] of [[ironPlot, 'mining'], [factoryPlot, 'steel'], [powerPlot, 'power']]) {
    clans.buyPlot(a, plot.id, T0);
    clans.setPlotIndustry(a, plot.id, ind);
    clans.saveDesign(a, plot.id, BUILT, T0);
  }
  clans.choosePlant(a, powerPlot.id, 'hydro');
  assert.throws(() => clans.choosePlant(a, powerPlot.id, 'nuclear-x'), /không dựng được/);

  const preview = clans.plotPreview(a, factoryPlot.id, 'steel', T0);
  assert.ok(preview.production.batches > 0);
  assert.ok(preview.production.in.iron_ore > 0);

  const before = treasury(a);
  clans.settleClansDay(day, rand);
  const view = industry.industryView(a, macro.macroFor(day), T0 + DAY);
  const log = Object.fromEntries(view.production.rows.map((r) => [r.good, r]));
  assert.ok(log.iron_ore.produced > 0, 'khai thác quặng');
  assert.ok(log.power.produced > 0, 'thủy điện phát điện');
  assert.ok(log.steel?.produced > 0, 'luyện ra thép');
  assert.equal(log.iron_ore.used, log.steel.produced * 2);
  // Quặng và than là nguyên liệu của gia tộc nên được giữ; thép và điện thừa bán cho NPC.
  const goods = Object.fromEntries(view.goods.map((g) => [g.good, g]));
  assert.ok(goods.iron_ore.keep && goods.iron_ore.input);
  assert.ok(log.steel.sold === log.steel.produced);
  assert.ok(log.steel.revenue > 0);
  const d = clans.clanView(a, T0 + DAY).clan.days[0];
  assert.ok(d.revenue >= log.steel.revenue, 'tiền bán hàng tính vào doanh thu chịu thuế');
  assert.equal(treasury(a), before + d.revenue - d.tax - d.upkeep);
});

test('sàn công nghiệp: gia tộc A đăng bán, gia tộc B mua về kho; tiền bán của A tính thuế đêm đó', () => {
  clans.createClan(b, { name: 'Gia Tộc Mua', emblem: '⚓', color: '#2255aa' }, T0);
  clans.donateClan(b, 3_000_000, T0);
  const m = macro.macroFor(dayKey(T0 + DAY));
  const now = T0 + DAY;
  industry.setKeep(a, 'iron_ore', true);
  industry.importGoods(a, 'iron_ore', 10, m, now); // nhà máy thép đã dùng gần hết quặng tự khai thác
  const ref = industry.refPrice('iron_ore', m);
  assert.throws(() => industry.listGoods(a, { good: 'iron_ore', qty: 5, price: ref * 3 }, m, now), /Giá phải/);
  industry.listGoods(a, { good: 'iron_ore', qty: 5, price: ref }, m, now);
  const listing = industry.industryView(b, m, now).listings.find((l) => l.good === 'iron_ore');
  assert.ok(listing);
  const aBefore = treasury(a);
  const bBefore = treasury(b);
  industry.buyListing(b, listing.id, 3, now);
  assert.equal(treasury(b), bBefore - 3 * ref);
  assert.equal(treasury(a), aBefore + 3 * ref - Math.ceil(3 * ref * 0.02));
  const bGoods = Object.fromEntries(industry.industryView(b, m, now).goods.map((g) => [g.good, g.qty]));
  assert.equal(bGoods.iron_ore, 3);
  assert.equal(industry.tradeIncome(clans.clanView(a, now).clan.id, dayKey(now)), 3 * ref - Math.ceil(3 * ref * 0.02));
  industry.cancelListing(a, listing.id, now);
  assert.throws(() => industry.buyListing(b, listing.id, 1, now), /hết/);
});

test('nhập khẩu từ NPC đắt hơn giá tham chiếu 30% và cần chỗ trong kho', () => {
  const m = macro.macroFor(dayKey(T0 + DAY));
  const before = treasury(b);
  industry.importGoods(b, 'coal', 10, m, T0 + DAY);
  assert.equal(treasury(b), before - 10 * industry.importPrice('coal', m));
  assert.equal(industry.importPrice('coal', m), Math.round(industry.refPrice('coal', m) * 1.3));
  assert.throws(() => industry.importGoods(b, 'coal', 99_999, m, T0 + DAY), /không đủ chỗ|không đủ/);
  assert.throws(() => industry.importGoods(b, 'power', 1, m, T0 + DAY), /Không có mặt hàng/);
});
