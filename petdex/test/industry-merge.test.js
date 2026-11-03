// Gộp ngành (41 → 26): dữ liệu cũ chuyển sang ngành mới đúng dây chuyền, ngành trùng được hoàn tiền,
// lô chọn được dây chuyền, cầu vĩ mô của ngành gộp lấy trung bình các ngành cũ.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const macro = await import('../server/macro.js');
const rules = await import('../../public/ta-tua/game/js/shared/industry.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');

const T0 = Date.parse('2026-12-10T03:00:00Z');
migrate(T0);
runDue(T0);

const boss = store.createUser('trum_cong_nghiep', 'x', T0 - 10 * DAY);
post({ userId: boss, delta: 5_000_000, kind: 'opening', now: T0 });
const pet = store.insertPet(boss, 'Bé', 'test_pet', T0 - 45 * DAY);
store.savePet({ ...store.getPet(pet), level: 8, updated_at: T0 });
clans.createClan(boss, { name: 'Tập Đoàn Cũ', emblem: '🐉', color: '#555555' }, T0);
const clanId = store.db.prepare('SELECT id FROM clans WHERE name = ?').get('Tập Đoàn Cũ').id;
const fund = () => store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(`clan:${clanId}`)?.balance ?? 0;

test('26 ngành, ngành gộp có dây chuyền hoặc khai thác nhiều nhóm tài nguyên', () => {
  assert.equal(shared.INDUSTRY_ORDER.length, 26);
  for (const old of Object.keys(rules.MERGED_INTO)) assert.equal(shared.INDUSTRIES[old], undefined, `${old} đã gộp`);
  assert.deepEqual(Object.keys(rules.PRODUCTION_INDUSTRIES.vehicles.lines), ['autos', 'trains', 'shipbuilding', 'aerospace']);
  const sea = shared.PLOTS.find((p) => p.zone === 'sea');
  const urban = shared.PLOTS.find((p) => p.zone === 'urban');
  assert.ok(rules.variantsFor('vehicles', sea).includes('shipbuilding'));
  assert.ok(!rules.variantsFor('vehicles', urban).includes('shipbuilding'), 'đóng tàu cần ven nước');
  // Khai khoáng & dầu khí lấy cả khoáng lẫn dầu khí; Nông nghiệp & chăn nuôi lấy cả nông sản lẫn gia súc.
  assert.deepEqual(rules.extractable('mining', { iron_ore: 5, crude_oil: 3, timber: 2 }), { iron_ore: 5, crude_oil: 3 });
  assert.deepEqual(rules.extractable('agriculture', { wheat: 8, beef: 2, timber: 1 }), { wheat: 8, beef: 2 });
  assert.equal(rules.GOOD_INDUSTRY.steel, 'metallurgy');
  assert.equal(rules.GOOD_INDUSTRY.crude_oil, 'mining');
  assert.equal(rules.GOOD_INDUSTRY.beef, 'agriculture');
  assert.deepEqual(rules.recipeOf('metallurgy', 'aluminium').out, { aluminium: 1 });
  assert.equal(rules.batchesOf('vehicles', 'aerospace'), 1);
});

test('chuyển dữ liệu cũ: lô giữ đúng dây chuyền, ngành trùng được hoàn tiền thâu tóm', () => {
  // Dựng dữ liệu như trước khi gộp: gia tộc nắm Luyện thép, Luyện nhôm, Dầu khí; ba lô làm nhôm, máy tính, đóng tàu.
  const ins = store.db.prepare('INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, ?, ?, ?)');
  ins.run(clanId, 'steel', 40_000, T0);
  ins.run(clanId, 'aluminium', 400_000, T0 + 1);
  ins.run(clanId, 'oil_gas', 450_000, T0 + 2);
  const [p1, p2, p3] = [shared.PLOTS.find((p) => p.zone === 'urban'), shared.PLOTS.find((p) => p.zone === 'plain'), shared.PLOTS.find((p) => p.zone === 'coast')];
  clans.landView(boss, T0); // tạo sẵn 200 dòng lô đất
  const own = store.db.prepare('UPDATE land_plots SET clan_id = ?, industry = ?, variant = NULL WHERE id = ?');
  own.run(clanId, 'aluminium', p1.id);
  own.run(clanId, 'electronics', p2.id);
  own.run(clanId, 'shipbuilding', p3.id);
  const before = fund();

  store.db.prepare("DELETE FROM meta WHERE key = 'migrated_industries_merge_v1'").run();
  migrate(T0 + DAY);

  const held = store.db.prepare('SELECT industry FROM clan_industries WHERE clan_id = ? ORDER BY entered_at').all(clanId).map((r) => r.industry);
  assert.deepEqual(held, ['metallurgy', 'mining'], 'thép + nhôm thành một ngành Luyện kim, Dầu khí thành Khai khoáng');
  assert.equal(fund(), before + 400_000, 'hoàn tiền ngành thừa (Luyện nhôm)');
  const plot = (p) => store.db.prepare('SELECT industry, variant FROM land_plots WHERE id = ?').get(p.id);
  assert.deepEqual({ ...plot(p1) }, { industry: 'metallurgy', variant: 'aluminium' });
  assert.deepEqual({ ...plot(p2) }, { industry: 'electronics', variant: 'electronics' });
  assert.deepEqual({ ...plot(p3) }, { industry: 'vehicles', variant: 'shipbuilding' });
  // Chạy lại không làm gì thêm.
  migrate(T0 + 2 * DAY);
  assert.equal(fund(), before + 400_000);
});

test('tộc trưởng đổi dây chuyền của lô; dây chuyền không hợp đất thì bị từ chối', () => {
  const p1 = shared.PLOTS.find((p) => p.zone === 'urban');
  clans.choosePlant(boss, p1.id, 'steel');
  assert.equal(store.db.prepare('SELECT variant FROM land_plots WHERE id = ?').get(p1.id).variant, 'steel');
  assert.throws(() => clans.choosePlant(boss, p1.id, 'autos'), /không chạy được/);
  const view = clans.clanView(boss, T0 + 2 * DAY).clan.plots.find((p) => p.id === p1.id);
  assert.equal(view.variant, 'steel');
});

test('cầu vĩ mô của ngành gộp là trung bình các ngành cũ', () => {
  const day = '2027-04-01';
  store.db.prepare(`INSERT OR REPLACE INTO macro_days (day, phase, weather, land_index, gdp, demand, created_at)
    VALUES (?, 'recovery', 'calm', 1, 0.02, ?, 0)`).run(day, JSON.stringify({ steel: 1.1, aluminium: 0.9, autos: 1.2, trains: 1, shipbuilding: 1, aerospace: 1.2 }));
  const state = macro.macroFor(day);
  assert.equal(state.demand.metallurgy, 1);
  assert.equal(state.demand.vehicles, 1.1);
});

test('gỡ gộp (quay lại bản cũ): lô và ngành về id cũ theo dây chuyền đang chạy, khôi phục ngành bị xoá, thu lại tiền hoàn', async () => {
  const gate = await import('../server/industry-merge.js');
  const [p1, p2, p3] = [shared.PLOTS.find((p) => p.zone === 'urban'), shared.PLOTS.find((p) => p.zone === 'plain'), shared.PLOTS.find((p) => p.zone === 'coast')];
  const plan = gate.unmergePlan();
  assert.equal(plan.done, true);
  // Lô p1 đã đổi sang dây chuyền luyện thép ở test trước: gỡ về Luyện thép, không phải Luyện nhôm như lúc gộp.
  assert.equal(plan.plots.find((p) => p.id === p1.id).to, 'steel');
  assert.deepEqual(plan.clawback.map((c) => [c.industry, c.refunded]), [['aluminium', 400_000]]);

  const before = fund();
  const res = gate.unmergeIndustries('Kiểm thử', T0 + 3 * DAY);
  assert.equal(res.clawback[0].take, 400_000);
  assert.equal(fund(), before - 400_000);
  const plot = (p) => store.db.prepare('SELECT industry, variant FROM land_plots WHERE id = ?').get(p.id);
  assert.deepEqual({ ...plot(p1) }, { industry: 'steel', variant: null });
  assert.deepEqual({ ...plot(p2) }, { industry: 'electronics', variant: null });
  assert.deepEqual({ ...plot(p3) }, { industry: 'shipbuilding', variant: null });
  const held = store.db.prepare('SELECT industry, fee FROM clan_industries WHERE clan_id = ? ORDER BY industry').all(clanId).map((r) => `${r.industry}:${r.fee}`);
  assert.deepEqual(held, ['aluminium:400000', 'oil_gas:450000', 'steel:40000']);

  // Bản mới vẫn đang chạy: khởi động lại không được tự gộp lại (cờ giữ).
  migrate(T0 + 4 * DAY);
  assert.equal(plot(p1).industry, 'steel');
  assert.equal(gate.mergeHeld(), true);

  // Gộp lại (deploy bản mới lần nữa): trở về trạng thái gộp, hoàn tiền lần nữa (vì đã thu lại), không mất gì.
  gate.remergeIndustries('Kiểm thử', T0 + 5 * DAY);
  assert.deepEqual({ ...plot(p1) }, { industry: 'metallurgy', variant: 'steel' });
  assert.equal(fund(), before);
  assert.equal(gate.mergeHeld(), false);
  assert.equal(gate.mergeDone(), true);
  migrate(T0 + 6 * DAY);
  assert.equal(fund(), before, 'không hoàn hai lần');
});

test('gộp từ bản chưa ghi nhật ký (656b1e2): dựng lại ngành bị xoá từ bút toán hoàn tiền của lần gộp gần nhất', async () => {
  const gate = await import('../server/industry-merge.js');
  store.db.prepare('DELETE FROM industry_merge_log').run();
  // Ngành "mining" của gia tộc thật ra là Dầu khí cũ: đọc ra từ bút toán trả phí thâu tóm lúc đó.
  post({ account: `clan:${clanId}`, delta: 450_000, kind: 'clan_comp', memo: 'nạp thử', now: T0 + 2 });
  post({ account: `clan:${clanId}`, delta: -450_000, kind: 'clan_comp', memo: 'Thâu tóm ngành Dầu khí', now: T0 + 2 });
  const plan = gate.unmergePlan();
  assert.equal(plan.fromLedger, true);
  // Chỉ lần gộp lại ở T0+5 ngày, không lấy bút toán hoàn của lần gộp đầu (đã bị thu lại).
  assert.deepEqual(plan.restore.map((r) => [r.clanId, r.industry, r.fee]), [[clanId, 'aluminium', 400_000]]);
  assert.deepEqual(plan.industries.map((r) => [r.from, r.rename]), [['metallurgy', 'steel'], ['mining', 'oil_gas']]);
  const before = fund();
  gate.unmergeIndustries('Kiểm thử', T0 + 7 * DAY);
  assert.equal(fund(), before - 400_000);
  const held = store.db.prepare('SELECT industry FROM clan_industries WHERE clan_id = ? ORDER BY industry').all(clanId).map((r) => r.industry);
  assert.deepEqual(held, ['aluminium', 'oil_gas', 'steel']);
});

test('số kiểm tra sau khi gộp', async () => {
  const gate = await import('../server/industry-merge.js');
  gate.remergeIndustries('Kiểm thử', T0 + 8 * DAY);
  const { checks } = gate.unmergePlan();
  assert.equal(checks.oldIdPlots, 0);
  assert.equal(checks.oldIdIndustries, 0);
  assert.equal(checks.nullLinePlots, 0);
  assert.ok(checks.flagAt && checks.refunds.count >= 1);
});
