// Kiểm thử vòng đời vật phẩm thiết yếu trên DB tạm: hạn mức đồ ăn NPC theo D (NPC giữ tối thiểu 10%), XP và giá
// đồ NPC theo giai đoạn, tài khoản mới được miễn, Siêu thị mua Thực phẩm chế biến của gia tộc (tối đa 40% mỗi gia tộc)
// rồi bán lại thành Suất ăn gia tộc, D dịch tối đa 10 điểm mỗi ngày.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, GameError } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const industry = await import('../server/industry.js');
const essentials = await import('../server/essentials.js');
const macro = await import('../server/macro.js');
const rules = await import('../../public/ta-tua/game/js/shared/industry.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');
const { ITEMS } = await import('../server/game.js');
const { dayKey, nextDay } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
const day = dayKey(T0);
let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function newPlayer(name, money, createdAgo = 30 * DAY) {
  const id = store.createUser(name, 'x', T0 - createdAgo);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY);
  store.savePet({ ...store.getPet(petId), level: 6, fullness: 95, energy: 100, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}

migrate(T0);
runDue(T0, rand);
macro.overrideMacro(day, { phase: 'recovery', weather: 'calm' }, T0);
const veteran = newPlayer('lauNam', 50_000);
const newbie = newPlayer('moiVao', 50_000, DAY);
const owner = newPlayer('chuBep', 9_000_000);
const setD = (d, at = day) => store.db.prepare('INSERT OR REPLACE INTO essentials_days (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, 0, 0, 0, 0)').run(at, d);

test('luật thuần: giai đoạn theo D, XP đồ NPC 50% → 25% → 10%, giá tăng tới +30%', () => {
  assert.equal(rules.essentialStage(0).key, 'pioneer');
  assert.equal(rules.essentialStage(0.5).key, 'growing');
  assert.equal(rules.essentialStage(0.85).key, 'self');
  assert.equal(rules.npcXpFactor(0), 0.5);
  assert.ok(Math.abs(rules.npcXpFactor(0.8 - 1e-9) - 0.25) < 1e-6);
  assert.equal(rules.npcXpFactor(0.9), 0.1);
  assert.equal(rules.npcPriceFactor(0.1), 1);
  assert.ok(Math.abs(rules.npcPriceFactor(0.8) - 1.3) < 1e-9);
});

test('D = 0: người cũ được 1 bé × 3 suất + 2 = 5 món đồ ăn NPC/ngày, XP đồ NPC còn 50%; người mới không giới hạn', () => {
  assert.equal(essentials.npcAllowance(veteran, T0), 5);
  assert.equal(essentials.npcAllowance(newbie, T0), Infinity);
  const boba = ITEMS.boba;
  assert.equal(essentials.foodXpFactor(veteran, boba, T0), 0.5);
  assert.equal(essentials.foodXpFactor(newbie, boba, T0), 1);
  assert.equal(essentials.foodXpFactor(veteran, ITEMS.clan_meal, T0), 1);
  assert.equal(essentials.chargeFood(veteran, boba, 5, 12, 120, T0), 12);
  assert.throws(() => essentials.chargeFood(veteran, boba, 1, 12, 120, T0), /Hết hạn mức đồ ăn NPC/);
  assert.throws(() => essentials.chargeFood(veteran, ITEMS.cake, 1, 70, 120, T0), /Hết hạn mức/, 'đồ ăn nào cũng tính hạn mức');
  assert.equal(essentials.chargeFood(newbie, ITEMS.cake, 20, 70, 120, T0), 70, 'người mới giữ giá gốc');
});

test('NPC luôn giữ tối thiểu 10%: ở D = 90% vẫn được 1 × 3 × 10% (làm tròn lên) + 2 = 3 món', () => {
  const later = T0 + 3 * DAY;
  setD(0.9, dayKey(later));
  assert.equal(essentials.npcAllowance(veteran, later), 3);
  assert.equal(essentials.foodXpFactor(veteran, ITEMS.boba, later), 0.1);
  assert.equal(essentials.essentialsView(veteran, 120, later).stage.key, 'self');
});

test('gia tộc chế biến thực phẩm: Siêu thị mua trước bằng giá tham chiếu, kho suất ăn tăng, người chơi mua được Suất ăn gia tộc', () => {
  clans.createClan(owner, { name: 'Bếp Làng', emblem: '🌾', color: '#aa7733' }, T0);
  clans.donateClan(owner, 8_000_000, T0);
  clans.enterIndustry(owner, 'food_processing', T0);
  clans.enterIndustry(owner, 'power', T0);
  const factory = shared.PLOTS.find((p) => p.zone === 'urban');
  const hydro = shared.PLOTS.find((p) => p.zone === 'river' && rules.plantsFor(p).includes('hydro'));
  const BUILT = [
    { piece: 'base-3', x: 2, y: 19, color: '#8b5e3c' },
    { piece: 'wall_brick-8', x: 2, y: 15, color: '#e85d5d' },
    { piece: 'roof_gable-5', x: 2, y: 11, color: '#4b8ff2' },
  ];
  for (const [plot, ind] of [[factory, 'food_processing'], [hydro, 'power']]) {
    clans.buyPlot(owner, plot.id, T0);
    clans.setPlotIndustry(owner, plot.id, ind);
    clans.saveDesign(owner, plot.id, BUILT, T0);
  }
  clans.choosePlant(owner, hydro.id, 'hydro');
  const m = macro.macroFor(day);
  industry.importGoods(owner, 'wheat', 20, m, T0);
  industry.importGoods(owner, 'beef', 20, m, T0);
  const stockBefore = essentials.essentialsView(veteran, 120, T0).meal.stock;
  clans.settleClansDay(day, rand);
  const log = Object.fromEntries(industry.industryView(owner, m, T0 + DAY).production.rows.map((r) => [r.good, r]));
  assert.ok(log.processed_food.produced > 0, 'nhà máy làm ra thực phẩm chế biến');
  const stockAfter = essentials.essentialsView(veteran, 120, T0 + DAY).meal.stock;
  assert.ok(stockAfter > stockBefore, 'Siêu thị nhập suất ăn');
  assert.equal((stockAfter - stockBefore) % rules.ESSENTIALS.mealsPerUnit, 0);
  // Gia tộc bán cho Siêu thị tối đa 40% lượng thu mua của đêm.
  const bought = (stockAfter - stockBefore) / rules.ESSENTIALS.mealsPerUnit;
  assert.ok(log.processed_food.sold >= bought);
  // Người chơi mua suất ăn gia tộc: kho giảm, giá theo giá tham chiếu / 5 × 1,15.
  const price = essentials.chargeFood(veteran, ITEMS.clan_meal, 2, 24, 120, T0 + DAY);
  assert.equal(price, Math.ceil((120 / 5) * 1.15));
  assert.equal(essentials.essentialsView(veteran, 120, T0 + DAY).meal.stock, stockAfter - 2);
  assert.throws(() => essentials.chargeFood(veteran, ITEMS.clan_meal, 99_999, 24, 120, T0 + DAY), GameError);
});

test('D dịch tối đa 10 điểm mỗi ngày dù cung tăng đột biến', () => {
  const d1 = dayKey(T0 + 10 * DAY);
  store.db.prepare('INSERT OR REPLACE INTO essentials_days (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, 0, 10, 10000, 0, 0)').run(d1);
  const next = essentials.settleEssentialsDay(d1);
  assert.ok(next <= 0.1 + 1e-9);
  assert.equal(essentials.currentD(Date.parse(`${nextDay(d1)}T05:00:00Z`)), next);
});
