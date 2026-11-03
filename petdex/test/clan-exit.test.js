// Bỏ ngành: tộc trưởng gỡ một ngành đã thâu tóm, quỹ trả 80% số đã trả lúc thâu tóm (nửa vào ngân sách thị trấn),
// lô đang làm ngành đó về chưa chọn ngành, ngành chiến lược không bỏ được ở đây.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, GameError } = await import('../server/game.js');
const { post, treasuryBalance } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const clans = await import('../server/clans.js');
const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');

function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY);
  store.savePet({ ...store.getPet(petId), level: 6, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}

migrate(T0);
const leader = newPlayer('toctruong', 5_000_000);
const member = newPlayer('thanhvien', 50_000);
clans.createClan(leader, { name: 'Bỏ Ngành', emblem: '🌾', color: '#227744' }, T0);
clans.donateClan(leader, 4_000_000, T0);
clans.joinClan(member, clans.clanView(leader, T0).clan.id, T0);
const view = () => clans.clanView(leader, T0).clan;
const plot = PLOTS[0];

test('bỏ ngành: quỹ trả 80% phí thâu tóm, nửa vào ngân sách, lô về chưa chọn ngành, thuế giảm', () => {
  clans.enterIndustry(leader, 'tea', T0);
  clans.buyPlot(leader, plot.id, T0);
  clans.setPlotIndustry(leader, plot.id, 'tea');
  const paid = view().industries.find((i) => i.id === 'tea').fee;
  assert.ok(paid > 0);
  const fund = view().treasury;
  const town = treasuryBalance();

  assert.throws(() => clans.exitIndustry(member, 'tea', T0), GameError, 'chỉ tộc trưởng được bỏ ngành');
  assert.throws(() => clans.exitIndustry(leader, 'dairy', T0), GameError, 'không bỏ được ngành chưa nắm');

  const res = clans.exitIndustry(leader, 'tea', T0 + 1);
  const fee = Math.round(paid * clans.DEFAULT_CLAN_CONFIG.exitShare);
  assert.equal(clans.DEFAULT_CLAN_CONFIG.exitShare, 0.8);
  assert.equal(view().treasury, fund - fee);
  assert.equal(treasuryBalance(), town + Math.floor(fee / 2));
  assert.deepEqual(view().industries, []);
  const row = clans.landView(leader, T0).plots.find((p) => p.id === plot.id);
  assert.equal(row.industry, null);
  assert.equal(row.variant, null);
  assert.match(res.message, /Đã bỏ ngành/);
  assert.match(res.message, /1 lô về chưa chọn ngành/);
});

test('bỏ ngành xong thì thâu tóm lại được như ngành đầu tiên', () => {
  const before = view().treasury;
  const fee = view().nextFees.tea;
  clans.enterIndustry(leader, 'tea', T0 + 2);
  assert.equal(view().treasury, before - fee);
  clans.exitIndustry(leader, 'tea', T0 + 3);
});

test('ngành chiến lược không bỏ được qua nút bỏ ngành', () => {
  clans.enterIndustry(leader, 'irrigation', T0 + 4);
  assert.throws(() => clans.exitIndustry(leader, 'irrigation', T0 + 5), /ngành chiến lược/);
  assert.ok(view().industries.some((i) => i.id === 'irrigation'));
});
