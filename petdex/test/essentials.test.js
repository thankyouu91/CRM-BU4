// Kiểm thử vòng đời vật phẩm thiết yếu trên DB tạm: hạn mức đồ ăn và đồ chăm sóc NPC theo D của từng nhóm (NPC giữ
// tối thiểu 10%), XP và giá đồ NPC theo giai đoạn, tài khoản mới được miễn, Siêu thị mua Thực phẩm chế biến / Thuốc của
// gia tộc (tối đa 40% mỗi gia tộc) rồi bán lại thành hàng gia tộc 3 hạng chất lượng, D dịch tối đa 10 điểm mỗi ngày.
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
const REFS = { food: 120, care: 450 };
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
const setD = (d, at = day, table = 'essentials_days') => store.db.prepare(`INSERT OR REPLACE INTO ${table} (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, ?, 0, 0, 0, 0)`).run(at, d);

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

test('luật thuần: điểm chất lượng theo cấp, nhà xưởng, ngành đầu vào; tỉ lệ hạng cộng đủ 100%', () => {
  assert.equal(rules.qualityScore({ level: 1, pieces: 0, upstream: 0 }), 0);
  assert.equal(rules.qualityScore({ level: 10, pieces: 20, upstream: 1 }), 1);
  assert.equal(rules.qualityScore({ level: 1, pieces: 10, upstream: 1 }), 0.45);
  for (const s of [0, 0.45, 1]) {
    const split = rules.qualitySplit(s);
    assert.ok(Math.abs(split.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.ok(split.every((p) => p >= 0));
  }
  assert.deepEqual(rules.qualitySplit(0).map((p) => Math.round(p * 100)), [80, 20, 0]);
  assert.deepEqual(rules.qualitySplit(1).map((p) => Math.round(p * 100)), [5, 60, 35]);
  assert.equal(rules.clanItemId('food', 2), 'clan_meal_tuyet');
  assert.equal(ITEMS.clan_meal_tuyet.xp, Math.round(ITEMS.clan_meal.xp * 1.5));
  assert.equal(ITEMS.clan_care_ngon.type, 'care');
  assert.equal(ITEMS.clan_care_ngon.effect.health, Math.round(ITEMS.clan_care.effect.health * 1.2));
});

test('D = 0: người cũ được 1 bé × 3 suất + 2 = 5 món đồ ăn NPC/ngày, XP đồ NPC còn 50%; người mới không giới hạn', () => {
  assert.equal(essentials.npcAllowance(veteran, 'food', T0), 5);
  assert.equal(essentials.npcAllowance(newbie, 'food', T0), Infinity);
  const boba = ITEMS.boba;
  assert.equal(essentials.essentialXpFactor(veteran, boba, T0), 0.5);
  assert.equal(essentials.essentialXpFactor(newbie, boba, T0), 1);
  assert.equal(essentials.essentialXpFactor(veteran, ITEMS.clan_meal, T0), 1);
  assert.equal(essentials.essentialXpFactor(veteran, ITEMS.ball, T0), 1);
  assert.equal(essentials.chargeEssential(veteran, boba, 5, 12, REFS, T0), 12);
  assert.throws(() => essentials.chargeEssential(veteran, boba, 1, 12, REFS, T0), /Hết hạn mức đồ ăn NPC/);
  assert.throws(() => essentials.chargeEssential(veteran, ITEMS.cake, 1, 70, REFS, T0), /Hết hạn mức/, 'đồ ăn nào cũng tính hạn mức');
  assert.equal(essentials.chargeEssential(newbie, ITEMS.cake, 20, 70, REFS, T0), 70, 'người mới giữ giá gốc');
});

test('đồ chăm sóc có hạn mức riêng: 1 bé × 2 + 2 = 4 món/ngày, không ăn vào hạn mức đồ ăn', () => {
  assert.equal(essentials.npcAllowance(veteran, 'care', T0), 4);
  assert.equal(essentials.chargeEssential(veteran, ITEMS.bath, 4, 35, REFS, T0), 35);
  assert.throws(() => essentials.chargeEssential(veteran, ITEMS.juice, 1, 30, REFS, T0), /Hết hạn mức đồ chăm sóc NPC/);
  assert.equal(essentials.essentialXpFactor(veteran, ITEMS.vitamin, T0), 0.5);
  assert.equal(essentials.chargeEssential(veteran, { type: 'toy' }, 1, 10, REFS, T0), null);
});

test('NPC luôn giữ tối thiểu 10%: ở D = 90% vẫn được 1 × 3 × 10% (làm tròn lên) + 2 = 3 món', () => {
  const later = T0 + 3 * DAY;
  setD(0.9, dayKey(later));
  assert.equal(essentials.npcAllowance(veteran, 'food', later), 3);
  assert.equal(essentials.essentialXpFactor(veteran, ITEMS.boba, later), 0.1);
  const view = essentials.essentialsView(veteran, REFS, later);
  assert.equal(view.food.stage.key, 'self');
  assert.equal(view.care.stage.key, 'pioneer', 'mỗi nhóm có D riêng');
  setD(0.5, dayKey(later), 'essentials_care_days');
  assert.equal(essentials.npcAllowance(veteran, 'care', later), 3);
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
  const stockBefore = essentials.essentialsView(veteran, REFS, T0).food.stock;
  clans.settleClansDay(day, rand);
  const log = Object.fromEntries(industry.industryView(owner, m, T0 + DAY).production.rows.map((r) => [r.good, r]));
  assert.ok(log.processed_food.produced > 0, 'nhà máy làm ra thực phẩm chế biến');
  const stockAfter = essentials.essentialsView(veteran, REFS, T0 + DAY).food.stock;
  const added = stockAfter.map((n, i) => n - stockBefore[i]);
  const addedTotal = added.reduce((a, b) => a + b, 0);
  assert.ok(addedTotal > 0, 'Siêu thị nhập suất ăn');
  assert.ok(added.every((n) => n % rules.ESSENTIALS.cats.food.perUnit === 0));
  assert.ok(log.processed_food.sold >= addedTotal / rules.ESSENTIALS.cats.food.perUnit);
  // Người chơi mua suất ăn gia tộc: kho giảm, giá theo giá tham chiếu / 5 × 1,15 × hạng.
  const before = essentials.essentialsView(veteran, REFS, T0 + DAY).food.stock[0];
  const price = essentials.chargeEssential(veteran, ITEMS.clan_meal, 2, 24, REFS, T0 + DAY);
  assert.equal(price, Math.ceil((120 / 5) * 1.15));
  assert.equal(essentials.essentialsView(veteran, REFS, T0 + DAY).food.stock[0], before - 2);
  assert.equal(essentials.clanItemPrice('food', 120, 2), Math.ceil((120 / 5) * 1.15 * 1.5));
  assert.throws(() => essentials.chargeEssential(veteran, ITEMS.clan_meal, 99_999, 24, REFS, T0 + DAY), GameError);
});

test('chất lượng: gia tộc cấp cao, nhà xưởng đủ mảnh, tự trồng nguyên liệu thì Siêu thị nhận nhiều hàng Ngon / Tuyệt hảo và trả giá cao hơn', () => {
  const nextDayKey = dayKey(T0 + 2 * DAY);
  // Kho đang rỗng ở hạng Ngon/Tuyệt hảo; mở đợt thu mua mới rồi chào bán với điểm tối đa.
  store.setMeta('essentials_care_stock', JSON.stringify([0, 0, 0]));
  // Nhu cầu đồ chăm sóc của thị trấn: 1.000 món một ngày.
  store.db.prepare('INSERT OR REPLACE INTO essentials_care_days (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, 0, 1000, 0, 1000, 0)').run(nextDayKey);
  const plan = essentials.openShopBuying(nextDayKey);
  assert.ok(plan.care > 0);
  let r = 0.5;
  const byQ = essentials.offerToShop(99, 'care', 1000, 1, () => r);
  const units = byQ.reduce((a, b) => a + b, 0);
  assert.equal(units, Math.floor(Math.ceil(plan.care * 0.4) / 10), 'mỗi gia tộc tối đa 40% đợt thu mua');
  assert.ok(byQ[2] >= Math.floor(units * 0.35) && byQ[1] >= Math.floor(units * 0.6), `chia hạng ${byQ}`);
  const stock = essentials.essentialsView(veteran, REFS, T0 + 2 * DAY).care.stock;
  assert.deepEqual(stock, byQ.map((n) => n * 10));
  // Điểm 0: không có hạng Tuyệt hảo.
  r = 0.99;
  const low = essentials.offerToShop(98, 'care', 1000, 0, () => r);
  assert.equal(low[2], 0);
  essentials.settleEssentialsDay(nextDayKey);
  // Hàm điểm của gia tộc: đọc cấp, số mảnh nhà xưởng và ngành đầu vào trên các lô.
  const rows = [
    { industry: 'food_processing', design: JSON.stringify(Array(20).fill({})) },
    { industry: 'agriculture', design: '[]' },
  ];
  assert.equal(industry.clanQuality('food', rows, 10), 1);
  assert.equal(industry.clanQuality('care', rows, 1), 0.3);
});

test('D dịch tối đa 10 điểm mỗi ngày dù cung tăng đột biến', () => {
  const d1 = dayKey(T0 + 10 * DAY);
  store.db.prepare('INSERT OR REPLACE INTO essentials_days (day, d, demand, supplied, npc_sold, meal_sold) VALUES (?, 0, 10, 10000, 0, 0)').run(d1);
  const next = essentials.settleEssentialsDay(d1);
  assert.ok(next.food <= 0.1 + 1e-9);
  assert.equal(essentials.currentD('food', Date.parse(`${nextDay(d1)}T05:00:00Z`)), next.food);
});
