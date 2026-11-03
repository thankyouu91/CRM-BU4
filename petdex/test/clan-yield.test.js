// Gia tộc có tiền qua đêm ngay khi lô có ngành: lô chưa xây xong vẫn chạy ở mức DESIGN.unbuiltRate (trước đây ra 0 mà
// vẫn tốn phí duy trì), xây xong thì đủ công suất. Khu Trung tâm hợp mọi ngành ít nhất LAND.urbanBonus.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const clans = await import('../server/clans.js');
const { closeDay } = await import('../server/scheduler.js');
const { plotDeposits } = await import('../server/industry.js');
const { dayKey } = await import('../server/clock.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');
const { DESIGN, INDUSTRIES, LAND, PIECES, PLOTS, envFactor, zoneFit } = shared;

const T0 = Date.parse('2026-11-25T03:00:00Z');
const DAY = 864e5;
migrate(T0);
const lead = store.createUser('toctruong', 'x', T0 - 40 * DAY);
post({ userId: lead, delta: 9_000_000, kind: 'opening', now: T0 });
const pet = store.insertPet(lead, 'Bé', 'test_pet', T0 - 30 * DAY);
store.savePet({ ...store.getPet(pet), level: 10, updated_at: T0 });
store.setActivePet(lead, pet);
clans.createClan(lead, { name: 'Qua Đêm', emblem: '🌾', color: '#227744' }, T0);
clans.donateClan(lead, 6_000_000, T0);
const goods = (clanId) => Object.fromEntries(store.db.prepare('SELECT good, qty FROM clan_goods WHERE clan_id = ?').all(clanId).map((r) => [r.good, r.qty]));

test('khu Trung tâm: mọi ngành hợp ít nhất +18%, ngành vốn hợp hơn giữ mức cũ, vùng khác không đổi', () => {
  assert.equal(LAND.urbanBonus, 0.18);
  for (const [id, ind] of Object.entries(INDUSTRIES)) {
    assert.equal(zoneFit(id, 'urban'), Math.max(ind.zones.urban ?? 0, 0.18), id);
    assert.equal(zoneFit(id, 'plain'), ind.zones.plain ?? 0, id);
  }
  assert.ok(envFactor('mining', 'urban', 'temperate') > 1, 'khai khoáng trước đây −40% ở Trung tâm');
});

test('lô mỏ chưa xây xong: đêm đầu đã khai thác và có doanh thu vào quỹ', () => {
  clans.enterIndustry(lead, 'mining', T0);
  const hill = PLOTS.find((p) => p.zone === 'hill' && Object.keys(plotDeposits(p.id)).some((g) => g !== 'timber'));
  clans.buyPlot(lead, hill.id, T0);
  clans.setPlotIndustry(lead, hill.id, 'mining');
  const view = clans.clanView(lead, T0).clan;
  const row = view.plots.find((p) => p.id === hill.id);
  assert.equal(row.built, false);
  assert.ok(row.estimate > 0, 'ước tính > 0 dù chưa xây');
  closeDay(dayKey(T0));
  const day = store.db.prepare('SELECT * FROM clan_days WHERE clan_id = ? AND day = ?').get(view.id, dayKey(T0));
  assert.ok(day.revenue > 0, 'có doanh thu qua đêm');
  const kinds = new Set(store.db.prepare("SELECT memo FROM ledger WHERE account = ? AND kind = 'clan_revenue'").all(`clan:${view.id}`).map((r) => r.memo));
  assert.ok([...kinds].some((m) => /Bán hàng cho NPC/.test(m)), 'hàng khai thác được bán cho NPC');
  // Xây xong: sản lượng ước tính gấp ~ (1 + thưởng) ÷ unbuiltRate.
  const base = PIECES.find((p) => p.family === 'base');
  const parts = PIECES.filter((p) => p.family !== 'base').slice(0, 2);
  clans.saveDesign(lead, hill.id, [base, ...parts].map((p, i) => ({ piece: p.id, x: 0, y: i * 5, color: '#aa5533' })), T0);
  const built = clans.clanView(lead, T0).clan.plots.find((p) => p.id === hill.id);
  assert.equal(built.built, true);
  assert.ok(built.estimate > row.estimate * 1.8, `${built.estimate} so với ${row.estimate}`);
  assert.ok(Object.keys(goods(view.id)).length || day.revenue > 0);
});

test('lô dịch vụ chưa xây xong vẫn có doanh thu, bằng unbuiltRate so với xây xong không thưởng', () => {
  const plot = PLOTS.find((p) => p.zone === 'urban');
  const macro = { weather: 'calm', phase: 'recovery', demand: {} };
  const bare = clans.plotRevenue(plot, { industry: 'tea', design: [], level: 1, macro });
  assert.equal(bare.operating, true);
  assert.equal(bare.factors.building, DESIGN.unbuiltRate);
  assert.ok(bare.revenue > 0);
  assert.equal(bare.factors.zone, Math.max(INDUSTRIES.tea.zones.urban ?? 0, 0.18));
});

test('xem trước lô với mọi ngành không lỗi (kể cả hạ tầng chiến lược như Năng lượng gió)', () => {
  const sample = [PLOTS[9], PLOTS[31], PLOTS[39], PLOTS[52], PLOTS[53], PLOTS.find((p) => p.zone === 'urban'), PLOTS.find((p) => p.zone === 'sea')];
  for (const plot of sample) {
    for (const industry of Object.keys(INDUSTRIES)) {
      const pv = clans.plotPreview(lead, plot.id, industry, T0);
      assert.equal(pv.industry, industry);
      assert.ok(Number.isFinite(pv.revenue) && Number.isFinite(pv.afterTax), `${plot.code} ${industry}`);
      if (shared.isStrategic(industry)) assert.equal(pv.strategic, true, `${industry} là hạ tầng chiến lược`);
    }
  }
});
