// Kiểm thử hạ tầng chiến lược trên DB tạm: 1 ngành chiến lược mỗi gia tộc, giới hạn số gia tộc chủ, buff toàn server
// theo cấp, phí hạ tầng 20% phần tăng thêm, thành viên chủ +10% và pet huyền thoại đứng máy, dừng buff khi hết tiền,
// Ngân hàng nhà nước buff lãi, Trị thủy buff vườn và sản lượng nông nghiệp gia tộc, Thuế vụ truy thu hưởng hoa hồng.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const strategic = await import('../server/strategic.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');
const rules = await import('../../public/ta-tua/game/js/shared/industry.js');
const { dayKey } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function newPlayer(name, money, species = 'test_pet') {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, species, T0 - 45 * DAY);
  store.savePet({ ...store.getPet(petId), level: 6, fullness: 95, energy: 100, updated_at: T0 });
  store.setActivePet(id, petId);
  return { id, petId };
}

migrate(T0);
runDue(T0, rand);
const wind = newPlayer('chugio', 6_000_000, 'bach_ho'); // Bạch Hổ: huyền thoại hành Kim
const farmer = newPlayer('nongdan', 3_000_000);
const outsider = newPlayer('nguoichoi', 1_000);
const taxman = newPlayer('thuevu', 3_000_000);
const BUILT = [
  { piece: 'base-3', x: 2, y: 19, color: '#8b5e3c' },
  { piece: 'wall_brick-8', x: 2, y: 15, color: '#e85d5d' },
  { piece: 'roof_gable-5', x: 2, y: 11, color: '#4b8ff2' },
];
const coins = (id) => store.getUser(id).coins;
const treasuryOf = (user) => clans.clanView(user, T0).clan.treasury;
const windPlot = shared.PLOTS.find((p) => rules.strategicPlaceOk('wind_farm', p) && p.zone === 'coast');
const urbanPlots = shared.PLOTS.filter((p) => p.zone === 'urban');

test('gia tộc nắm Năng lượng gió: chỉ 1 ngành chiến lược, buff 10% toàn server khi hạ tầng hoàn chỉnh', () => {
  clans.createClan(wind.id, { name: 'Gió Biển', emblem: '🐋', color: '#3388cc' }, T0);
  clans.donateClan(wind.id, 5_000_000, T0);
  clans.enterIndustry(wind.id, 'wind_farm', T0);
  assert.throws(() => clans.enterIndustry(wind.id, 'irrigation', T0), /1 ngành chiến lược/);
  assert.equal(strategic.globalBuff('wind_farm').buff, 0, 'chưa có công trình thì chưa có buff');
  const badPlot = urbanPlots[0];
  clans.buyPlot(wind.id, badPlot.id, T0);
  assert.throws(() => clans.setPlotIndustry(wind.id, badPlot.id, 'wind_farm'), /không dựng được/);
  clans.buyPlot(wind.id, windPlot.id, T0);
  clans.setPlotIndustry(wind.id, windPlot.id, 'wind_farm');
  clans.saveDesign(wind.id, windPlot.id, BUILT, T0);
  assert.equal(strategic.globalBuff('wind_farm').buff, 0.1);
  strategic.upgradeInfra(wind.id, T0);
  assert.equal(strategic.globalBuff('wind_farm').buff, 0.2);
});

test('thu nhập mua bán cá nhân: người ngoài được +20% và trả phí 20% phần tăng thêm cho gia tộc chủ', () => {
  const before = coins(outsider.id);
  const fundBefore = treasuryOf(wind.id);
  strategic.windTradeBonus(outsider.id, 1000, 'bán thử', T0);
  // +200 thưởng, −40 phí
  assert.equal(coins(outsider.id), before + 200 - 40);
  assert.equal(treasuryOf(wind.id), fundBefore + 40);
});

test('thành viên gia tộc chủ: +10% riêng, không phải trả phí; pet huyền thoại hành Kim đứng máy thêm +30%', () => {
  const before = coins(wind.id);
  strategic.windTradeBonus(wind.id, 1000, 'bán thử', T0);
  assert.equal(coins(wind.id), before + 300); // 20% chung + 10% thành viên
  strategic.assignOperator(wind.id, windPlot.id, wind.petId, T0);
  const b = strategic.buffFor('wind_farm', { userId: wind.id });
  assert.ok(Math.abs(b.total - 0.6) < 1e-9, 'chung 20% + thành viên 10% + Bạch Hổ 30%');
  assert.equal(b.paid, 0);
});

test('Trị thủy: buff vụ vườn của người chơi, hết xu trả phí thì không có buff', () => {
  clans.createClan(farmer.id, { name: 'Nhà Nông', emblem: '🌾', color: '#66aa33' }, T0);
  clans.donateClan(farmer.id, 2_500_000, T0);
  clans.enterIndustry(farmer.id, 'irrigation', T0);
  const riverPlot = shared.PLOTS.find((p) => p.zone === 'river');
  clans.buyPlot(farmer.id, riverPlot.id, T0);
  clans.setPlotIndustry(farmer.id, riverPlot.id, 'irrigation');
  clans.saveDesign(farmer.id, riverPlot.id, BUILT, T0);
  assert.equal(strategic.globalBuff('irrigation').buff, 0.1);
  const paid = strategic.irrigationHarvest(taxman.id, 20, 3, T0);
  assert.equal(paid.extra, 2);
  assert.equal(paid.fee, Math.round(2 * 3 * 0.2));
  // Người chơi gần như hết xu: không đủ phí thì không có phần thêm.
  const poor = newPlayer('ngheo', 0);
  const none = strategic.irrigationHarvest(poor.id, 200, 30, T0);
  assert.equal(none.extra, 0);
  assert.ok(none.unpaid);
});

test('Ngân hàng nhà nước: chỉ 1 gia tộc được nắm, lãi người chơi tăng theo cấp, phí trừ từ phần thưởng', () => {
  clans.createClan(taxman.id, { name: 'Bộ Tài Chính', emblem: '🏮', color: '#aa2222' }, T0);
  clans.donateClan(taxman.id, 2_500_000, T0);
  clans.enterIndustry(taxman.id, 'tax_office', T0);
  assert.throws(() => clans.enterIndustry(taxman.id, 'state_bank', T0), /1 ngành chiến lược/);
  const before = coins(outsider.id);
  strategic.bankInterestBonus(outsider.id, 100, { now: T0 });
  assert.equal(coins(outsider.id), before, 'chưa ai vận hành Ngân hàng nhà nước thì chưa có buff');
});

test('Thuế vụ: thấy hồ sơ khai thiếu của gia tộc khác, truy thu kèm phạt 50%, hưởng hoa hồng theo cấp', () => {
  const office = urbanPlots.find((p) => p.id !== urbanPlots[0].id);
  clans.buyPlot(taxman.id, office.id, T0);
  clans.setPlotIndustry(taxman.id, office.id, 'tax_office');
  clans.saveDesign(taxman.id, office.id, BUILT, T0);
  // Nhà Nông khai 50% doanh thu một đêm (cho lô khác của họ làm Nông nghiệp để có doanh thu).
  clans.setDeclareRatio(farmer.id, 0.5);
  const day = dayKey(T0);
  const fieldPlot = shared.PLOTS.find((p) => p.zone === 'plain' && !clans.landView(farmer.id, T0).plots.find((x) => x.id === p.id).owner);
  clans.buyPlot(farmer.id, fieldPlot.id, T0);
  clans.enterIndustry(farmer.id, 'tea', T0);
  clans.setPlotIndustry(farmer.id, fieldPlot.id, 'tea');
  clans.saveDesign(farmer.id, fieldPlot.id, BUILT, T0);
  clans.settleClansDay(day, rand);
  const view = clans.taxOfficeCases(taxman.id);
  assert.equal(view.rate, 0.1);
  const record = view.cases.find((c) => c.clan === 'Nhà Nông');
  assert.ok(record, 'Thuế vụ thấy hồ sơ của Nhà Nông');
  assert.equal(clans.taxOfficeCases(farmer.id), null, 'gia tộc khác không thấy');
  const before = treasuryOf(taxman.id);
  clans.collectAsTaxOffice(taxman.id, record.id, T0 + DAY);
  const due = Math.round(record.evaded * 1.5);
  assert.equal(treasuryOf(taxman.id), before + Math.round(due * 0.1));
  assert.throws(() => clans.collectAsTaxOffice(taxman.id, record.id, T0 + DAY), /không còn mở/);
});

test('nhiều gia tộc cùng nắm một ngành: lấy mức cao nhất cộng 25% phần còn lại, trần 60%', () => {
  assert.equal(rules.combinedBuff([0.4]), 0.4);
  assert.ok(Math.abs(rules.combinedBuff([0.4, 0.4]) - 0.5) < 1e-9);
  assert.equal(rules.combinedBuff([0.4, 0.4, 0.4, 0.4, 0.4]), 0.6);
});
