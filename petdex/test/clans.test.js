// Kiểm thử Gia tộc & Sở Nhà Đất trên DB tạm: lập gia tộc, góp quỹ, thâu tóm ngành (bồi thường, ngành thứ hai ×10),
// mua đất, lắp ghép công trình, doanh thu đêm, thuế 35%/40%, khai thiếu bị ghi hồ sơ, hoàn thuế cuối tháng, giá đất khan hiếm.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, GameError } = await import('../server/game.js');
const { post, treasuryBalance } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const macro = await import('../server/macro.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');
const { dayKey } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z'); // 10 giờ sáng thứ Tư 25/11, giờ Việt Nam
let seed = 7;
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
const leader = newPlayer('toctruong', 3_000_000);
const member = newPlayer('thanhvien', 50_000);
const rival = newPlayer('doithu', 3_000_000);
const coins = (id) => store.getUser(id).coins;

test('bản đồ: 200 lô cố định, giá 100.000–2.000.000, tăng trưởng và tốc độ sản xuất không quá 18%', () => {
  assert.equal(shared.PLOTS.length, 200);
  assert.equal(new Set(shared.PLOTS.map((p) => p.code)).size, 200);
  for (const p of shared.PLOTS) {
    assert.ok(p.basePrice >= 100_000 && p.basePrice <= 2_000_000);
    assert.ok(p.growth > 0 && p.growth <= 0.18);
    assert.ok(p.prod >= 0 && p.prod <= 0.18);
  }
  const zones = new Set(shared.PLOTS.map((p) => p.zone));
  for (const z of ['sea', 'hill', 'urban', 'plain', 'coast']) assert.ok(zones.has(z), `thiếu địa hình ${z}`);
  // Đất đắt thì % tăng trưởng cao hơn.
  const sorted = [...shared.PLOTS].sort((a, b) => a.basePrice - b.basePrice);
  assert.ok(sorted.at(-1).growth > sorted[0].growth);
  assert.equal(shared.PIECES.length, 200);
  assert.equal(new Set(shared.PIECES.map((p) => p.id)).size, 200);
});

test('lắp ghép: tối đa 20 mảnh, phải nằm trong khung, màu hợp lệ', () => {
  const ok = shared.cleanDesign([{ piece: 'base-3', x: 0, y: 19, color: '#AABBCC' }]);
  assert.equal(ok[0].color, '#aabbcc');
  assert.throws(() => shared.cleanDesign(Array.from({ length: 21 }, () => ({ piece: 'lamp-1', x: 0, y: 0, color: '#ffffff' }))), /tối đa 20/);
  assert.throws(() => shared.cleanDesign([{ piece: 'base-5', x: 20, y: 0, color: '#ffffff' }]), /ngoài khung/);
  assert.throws(() => shared.cleanDesign([{ piece: 'khong-co', x: 0, y: 0, color: '#ffffff' }]), /không có/);
  assert.throws(() => shared.cleanDesign([{ piece: 'lamp-1', x: 0, y: 0, color: 'red' }]), /Màu/);
});

let clanId;
const fishPlot = shared.PLOTS.find((p) => p.zone === 'sea');
const hillPlot = shared.PLOTS.find((p) => p.zone === 'hill');

test('lập gia tộc, góp quỹ, thâu tóm ngành đầu trả bồi thường gốc', () => {
  const before = coins(leader);
  clans.createClan(leader, { name: 'Nhà Họ Trần', emblem: '🐉', color: '#aa3322' }, T0);
  assert.equal(coins(leader), before - 3_000);
  assert.throws(() => clans.createClan(leader, { name: 'Lần hai' }, T0), GameError);
  clanId = clans.clanView(leader, T0).clan.id;
  clans.joinClan(member, clanId, T0);
  clans.donateClan(leader, 1_500_000, T0);
  clans.donateClan(member, 5_000, T0);
  const view = clans.clanView(member, T0).clan;
  assert.equal(view.treasury, 1_505_000);
  assert.equal(view.members.length, 2);
  assert.ok(view.level >= 5, 'góp nhiều thì lên cấp');
  assert.throws(() => clans.enterIndustry(member, 'fishery', T0), /tộc trưởng/);

  const treasury = treasuryBalance();
  clans.enterIndustry(leader, 'fishery', T0);
  assert.equal(clans.clanView(leader, T0).clan.treasury, 1_505_000 - 50_000);
  assert.equal(treasuryBalance(), treasury + 25_000);
  assert.equal(clans.clanView(leader, T0).clan.taxRate, 0.35);
});

test('ngành thứ hai trả gấp 10 lần và thuế tăng; tối đa 3 ngành', () => {
  const before = clans.clanView(leader, T0).clan.treasury;
  clans.enterIndustry(leader, 'tea', T0);
  assert.equal(clans.clanView(leader, T0).clan.treasury, before - 300_000);
  assert.ok(Math.abs(clans.clanView(leader, T0).clan.taxRate - 0.4) < 1e-9);
  clans.enterIndustry(leader, 'sugar', T0);
  assert.throws(() => clans.enterIndustry(leader, 'dairy', T0), /tối đa 3/);
});

test('mua đất, xem trước theo môi trường, lắp ghép công trình rồi mới hoạt động', () => {
  const sea = clans.plotPreview(leader, fishPlot.id, 'fishery', T0);
  const seaTea = clans.plotPreview(leader, fishPlot.id, 'tea', T0);
  assert.ok(sea.factors.env > 1 && seaTea.factors.env < 1, 'hải sản hợp biển, trà thì không');
  const land = clans.landView(leader, T0);
  const price = land.plots.find((p) => p.id === fishPlot.id).price;
  const before = clans.clanView(leader, T0).clan.treasury;
  clans.buyPlot(leader, fishPlot.id, T0);
  assert.equal(clans.clanView(leader, T0).clan.treasury, before - price);
  assert.throws(() => clans.buyPlot(rival, fishPlot.id, T0), GameError);
  clans.setPlotIndustry(leader, fishPlot.id, 'fishery');
  assert.throws(() => clans.setPlotIndustry(leader, fishPlot.id, 'dairy'), /chưa thâu tóm/);
  assert.equal(clans.clanView(leader, T0).clan.plots[0].operating, false);
  const design = [
    { piece: 'base-3', x: 2, y: 19, color: '#8b5e3c' },
    { piece: 'wall_brick-8', x: 2, y: 15, color: '#e85d5d' },
    { piece: 'roof_gable-5', x: 2, y: 11, color: '#4b8ff2' },
  ];
  assert.throws(() => clans.saveDesign(member, fishPlot.id, design, T0), /tộc trưởng hoặc trưởng lão/);
  clans.setMemberRole(leader, member, 'elder');
  const t1 = clans.clanView(leader, T0).clan.treasury;
  clans.saveDesign(member, fishPlot.id, design, T0);
  const cost = shared.designCost(design);
  assert.equal(clans.clanView(leader, T0).clan.treasury, t1 - cost);
  // Lưu lại cùng thiết kế thì không tốn thêm; thêm mảnh thì chỉ trả phần chênh.
  clans.saveDesign(member, fishPlot.id, design, T0);
  assert.equal(clans.clanView(leader, T0).clan.treasury, t1 - cost);
  const plot = clans.clanView(leader, T0).clan.plots[0];
  assert.equal(plot.operating, true);
  assert.ok(plot.estimate > 0);
});

test('đêm: doanh thu vào quỹ, thuế 45% (3 ngành) trên phần khai báo; khai thiếu thì Sở thuế có hồ sơ, gia tộc không thấy', () => {
  clans.setDeclareRatio(leader, 0.6);
  const day = dayKey(T0);
  const before = clans.clanView(leader, T0).clan.treasury;
  clans.settleClansDay(day, rand);
  const view = clans.clanView(leader, T0 + DAY);
  const d = view.clan.days[0];
  assert.equal(d.day, day);
  assert.ok(d.revenue > 0);
  assert.equal(d.declared, Math.round(d.revenue * 0.6));
  assert.ok(Math.abs(d.rate - 0.45) < 1e-9);
  assert.equal(d.tax, Math.round(d.declared * 0.45));
  assert.equal(view.clan.treasury, before + d.revenue - d.tax - d.upkeep);
  assert.ok(!JSON.stringify(view).includes('evad'), 'gia tộc không được biết hồ sơ trốn thuế');
  const admin = clans.adminClanView(T0 + DAY);
  const record = admin.evasions.find((e) => e.clan_id === clanId && e.day === day);
  assert.ok(record, 'Sở thuế phải có hồ sơ');
  assert.equal(record.evaded, Math.round((d.revenue - d.declared) * 0.45));
  assert.ok(store.adminLogs(5).some((l) => l.action === 'tax_evasion'));
  // Truy thu kèm phạt 50%.
  const t = clans.clanView(leader, T0 + DAY).clan.treasury;
  const { collected } = clans.resolveEvasion(record.id, 'collect', { penalty: 0.5, actor: 'test' }, T0 + DAY);
  assert.equal(collected, Math.round(record.evaded * 1.5));
  assert.equal(clans.clanView(leader, T0 + DAY).clan.treasury, t - collected);
  assert.throws(() => clans.resolveEvasion(record.id, 'dismiss'), /đã xử lý/);
  clans.setDeclareRatio(leader, 1);
});

test('cuối tháng hoàn 15% tổng thuế đã đóng trong tháng', () => {
  // Chạy các đêm còn lại tới hết 30/11.
  for (let t = T0 + DAY; dayKey(t) <= '2026-11-30'; t += DAY) clans.settleClansDay(dayKey(t), rand);
  const view = clans.clanView(leader, Date.parse('2026-12-01T03:00:00Z')).clan;
  const refund = view.refunds.find((r) => r.month === '2026-11');
  assert.ok(refund, 'phải có hoàn thuế tháng 11');
  const taxed = view.days.filter((d) => d.day.startsWith('2026-11')).reduce((s, d) => s + d.tax, 0);
  assert.equal(refund.taxed, taxed);
  assert.equal(refund.refund, Math.floor(taxed * 0.15));
});

test('giá đất: quỹ đất càng cạn giá càng tăng; chế độ tay theo hệ số; quản trị đặt giá riêng từng lô', () => {
  const s0 = shared.scarcityFactor(0);
  assert.equal(s0, 1);
  assert.ok(shared.scarcityFactor(0.5) < 1.5);
  assert.ok(Math.abs(shared.scarcityFactor(1) - 3) < 1e-9);
  const priceBefore = clans.landView(rival, T0).plots.find((p) => p.id === hillPlot.id).price;
  clans.setClanConfig({ land: { mode: 'manual', multiplier: 2 } });
  const manual = clans.landView(rival, T0).plots.find((p) => p.id === hillPlot.id).price;
  assert.equal(manual, Math.round((clans.scaledBase(hillPlot) * 2) / 1000) * 1000);
  clans.setPlotOverride(hillPlot.id, 555_000);
  assert.equal(clans.landView(rival, T0).plots.find((p) => p.id === hillPlot.id).price, 555_000);
  clans.setPlotOverride(hillPlot.id, null);
  clans.setClanConfig({ land: { mode: 'auto', multiplier: 1 } });
  assert.ok(priceBefore >= 100_000);
});

test('vĩ mô: mỗi ngày một trạng thái, quản trị ép được pha và thời tiết, bão làm lô trên biển giảm sản lượng', () => {
  const m = macro.rollMacro({ phase: 'boom', weather: 'calm', landIndex: 1, demand: {} }, { rand, force: { phase: 'recession', weather: 'storm' } });
  assert.equal(m.phase, 'recession');
  assert.equal(m.weather, 'storm');
  assert.ok(shared.weatherFactor('storm', 'sea', 'sunny') < 0.7);
  assert.equal(shared.weatherFactor('calm', 'sea', 'sunny'), 1);
  const day = dayKey(T0 + 40 * DAY);
  const forced = macro.overrideMacro(day, { phase: 'boom', weather: 'perfect' }, T0);
  assert.equal(forced.phase, 'boom');
  assert.equal(macro.macroFor(day).weather, 'perfect');
});

test('rời gia tộc: tộc trưởng rời thì trưởng lão lên thay; người cuối rời thì giải tán, đất về quỹ', () => {
  clans.leaveClan(leader, T0);
  const view = clans.clanView(member, T0).clan;
  assert.equal(view.role, 'leader');
  clans.leaveClan(member, T0);
  assert.equal(clans.clanView(member, T0).clan, null);
  assert.equal(clans.landView(rival, T0).plots.find((p) => p.id === fishPlot.id).owner, null);
});
