// Tạm đóng công nghiệp nặng: gia tộc đang nắm được hoàn phí, lô về chưa chọn ngành, không thâu tóm mới được;
// quản trị viên mở lại / đóng lại. Dược phẩm không cần hóa chất nữa; sản lượng ngành sản xuất theo giá lô.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const chat = await import('../server/chat.js');
const heavy = await import('../server/heavy-industry.js');
const rules = await import('../../public/ta-tua/game/js/shared/industry.js');
const shared = await import('../../public/ta-tua/game/js/shared/clan.js');

const T0 = Date.parse('2026-12-05T03:00:00Z');
migrate(T0);
runDue(T0);
const boss = store.createUser('trum_nang', 'x', T0 - 10 * DAY);
post({ userId: boss, delta: 5_000_000, kind: 'opening', now: T0 });
const pet = store.insertPet(boss, 'Bé', 'test_pet', T0 - 45 * DAY);
store.savePet({ ...store.getPet(pet), level: 8, updated_at: T0 });
store.setActivePet(boss, pet);
clans.createClan(boss, { name: 'Lò Thép', emblem: '🐉', color: '#555555' }, T0);
clans.donateClan(boss, 2_000_000, T0);
const clanId = clans.clanView(boss, T0).clan.id;
const fund = () => clans.clanView(boss, T0).clan.treasury;

test('mặc định công nghiệp nặng tạm đóng: không thâu tóm được, bảng ngành báo đóng', () => {
  assert.equal(heavy.heavyOpen(), false);
  for (const id of rules.HEAVY_INDUSTRIES) assert.equal(heavy.industryClosed(id), true);
  assert.equal(heavy.industryClosed('agriculture'), false);
  assert.throws(() => clans.enterIndustry(boss, 'metallurgy', T0), /tạm đóng/);
  assert.deepEqual(clans.clanView(boss, T0).config.closedIndustries, rules.HEAVY_INDUSTRIES);
});

test('mở lại thì thâu tóm được; đóng lại thì hoàn phí, gỡ ngành, lô về chưa chọn ngành, tộc trưởng nhận thư', () => {
  heavy.setHeavyOpen(true, 'Kiểm thử', T0);
  clans.enterIndustry(boss, 'metallurgy', T0);
  const fee = store.db.prepare("SELECT fee FROM clan_industries WHERE clan_id = ? AND industry = 'metallurgy'").get(clanId).fee;
  assert.ok(fee > 0);
  const plot = shared.PLOTS.find((p) => rules.variantsFor('metallurgy', p).length);
  clans.buyPlot(boss, plot.id, T0);
  clans.setPlotIndustry(boss, plot.id, 'metallurgy');
  const status = heavy.heavyStatus();
  assert.equal(status.holders.length, 1);
  assert.equal(status.refund, fee);

  const before = fund();
  const res = heavy.setHeavyOpen(false, 'Kiểm thử', T0 + 1);
  assert.match(res.message, /hoàn/);
  assert.equal(fund(), before + fee, 'hoàn đúng phí đã trả');
  assert.deepEqual(store.db.prepare('SELECT industry FROM clan_industries WHERE clan_id = ?').all(clanId), []);
  assert.deepEqual({ ...store.db.prepare('SELECT industry, variant FROM land_plots WHERE id = ?').get(plot.id) }, { industry: null, variant: null });
  assert.ok(chat.mailbox(boss).mails.some((m) => /Công nghiệp nặng tạm đóng/.test(m.subject)));
  // Đóng lần nữa không hoàn thêm.
  heavy.setHeavyOpen(false, 'Kiểm thử', T0 + 2);
  assert.equal(fund(), before + fee);
});

test('bước chuyển dữ liệu: chạy một lần, bỏ qua nếu đã mở lại', () => {
  store.db.prepare("DELETE FROM meta WHERE key = 'migrated_heavy_industry_close_v1'").run();
  heavy.setHeavyOpen(true, 'Kiểm thử', T0);
  store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'vehicles', 50000, ?)").run(clanId, T0);
  migrate(T0 + DAY);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM clan_industries WHERE industry = 'vehicles'").get().n, 1, 'đang mở thì không đóng');
  heavy.setHeavyOpen(false, 'Kiểm thử', T0 + DAY);
  migrate(T0 + 2 * DAY);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM clan_industries WHERE industry = 'vehicles'").get().n, 0);
});

test('Dược phẩm chỉ cần đậu và điện; sản lượng ngành sản xuất tăng theo giá gốc lô (có trần)', () => {
  assert.deepEqual(rules.recipeOf('pharma').in, { beans: 2, power: 1 });
  const { PRODUCTION_YIELD, landYield } = rules;
  assert.equal(landYield({ basePrice: PRODUCTION_YIELD.refPrice }), PRODUCTION_YIELD.scale);
  assert.equal(landYield({ basePrice: PRODUCTION_YIELD.refPrice * 2 }), PRODUCTION_YIELD.scale * 2);
  assert.equal(landYield({ basePrice: 100_000_000 }), PRODUCTION_YIELD.max);
  const cheap = [...shared.PLOTS].sort((a, b) => a.basePrice - b.basePrice)[0];
  const dear = [...shared.PLOTS].sort((a, b) => b.basePrice - a.basePrice)[0];
  assert.ok(landYield(dear) > landYield(cheap));
});
