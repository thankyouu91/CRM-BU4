// Kiểm thử quản trị gia tộc trên DB tạm: bỏ phiếu phế truất tộc trưởng (người bị phế truất mất quyền quản trị
// vĩnh viễn), tiền gửi kỳ hạn của quỹ (đáo hạn có lãi, rút gấp bị phạt, quỹ cạn thì tự rút gấp), và tác động
// của các ngành gia tộc lên Sàn Nguyên Liệu.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const gov = await import('../server/clan-gov.js');
const market = await import('../server/market.js');
const { CLAN_BANK, voteOutcome } = await import('../server/rules/finance.js');
const { industryInfluence, industryStrength } = await import('../../public/ta-tua/game/js/shared/industry-market.js');

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
const boss = newPlayer('ong_trum', 1_000_000);
const a = newPlayer('thanh_a', 50_000);
const b = newPlayer('thanh_b', 50_000);
const c = newPlayer('thanh_c', 50_000);
clans.createClan(boss, { name: 'Gia Tộc Thử', emblem: '🐉', color: '#aa3333' }, T0);
const clanId = store.db.prepare('SELECT id FROM clans WHERE name = ?').get('Gia Tộc Thử').id;
for (const id of [a, b, c]) clans.joinClan(id, clanId, T0);
const fund = () => gov.clanFund(clanId);

test('luật bỏ phiếu: quá nửa số người được bầu là thông qua; không thể đủ nữa thì thất bại', () => {
  assert.equal(voteOutcome({ yes: 2, no: 0, eligible: 3, expired: false }), 'passed');
  assert.equal(voteOutcome({ yes: 1, no: 0, eligible: 3, expired: false }), 'open');
  assert.equal(voteOutcome({ yes: 1, no: 2, eligible: 3, expired: false }), 'failed');
  assert.equal(voteOutcome({ yes: 1, no: 0, eligible: 3, expired: true }), 'failed');
  assert.equal(voteOutcome({ yes: 2, no: 2, eligible: 4, expired: false }), 'failed');
});

test('tiền gửi gia tộc: chỉ tộc trưởng gửi; đáo hạn về quỹ kèm lãi; rút gấp mất lãi, bị phạt', () => {
  const t = T0 + 2 * HOUR;
  clans.donateClan(boss, 300_000, t);
  assert.throws(() => gov.openClanDeposit(a, 10_000, 7, t), /Chỉ tộc trưởng/);
  const before = fund();
  gov.openClanDeposit(boss, 100_000, 3, t);
  gov.openClanDeposit(boss, 50_000, 14, t);
  assert.equal(fund(), before - 150_000);
  const view = clans.clanView(boss, t).clan.gov;
  assert.equal(view.canManage, true);
  assert.equal(view.bank.total, 150_000);
  const [three, fourteen] = view.bank.deposits;

  // Rút gấp khoản 14 ngày: về quỹ gốc trừ 5%, không có lãi.
  const f1 = fund();
  gov.withdrawClanDeposit(boss, fourteen.id, t + DAY);
  assert.equal(fund(), f1 + 50_000 - Math.ceil(50_000 * CLAN_BANK.earlyPenalty));

  // Khoản 3 ngày tự tất toán khi đáo hạn, có lãi.
  const f2 = fund();
  gov.settleClanGovDay(t + 3 * DAY + HOUR);
  assert.equal(fund(), f2 + 100_000 + three.interest);
  assert.equal(gov.clanDeposited(clanId), 0);
});

test('quỹ cạn không đủ phí duy trì: tự rút gấp tiền gửi (phạt nhẹ hơn) thay vì bị trừ kinh nghiệm', () => {
  const t = T0 + 5 * DAY;
  gov.openClanDeposit(boss, fund() - 10, 7, t); // gửi gần hết quỹ, chỉ chừa 10 xu
  assert.ok(fund() < 100);
  const parked = gov.clanDeposited(clanId);
  const got = gov.coverFromDeposits(clanId, 500, t + HOUR);
  assert.equal(got, parked - Math.ceil(parked * CLAN_BANK.emergencyPenalty));
  assert.equal(gov.clanDeposited(clanId), 0);
});

test('phế truất: thành viên bỏ phiếu, quá nửa thuận thì tộc trưởng mất chức và không vào lại bảng quản trị được', () => {
  const t = T0 + 8 * DAY;
  assert.throws(() => gov.startDepose(boss, a, t), /nhường chức/);
  gov.startDepose(a, b, t); // a mở phiếu, đề cử b; a tự thuận (1/3)
  assert.throws(() => gov.startDepose(c, a, t), /Đang có/);
  const open = clans.clanView(a, t).clan.gov.vote;
  assert.deepEqual([open.yes, open.no, open.eligible, open.need], [1, 0, 3, 2]);
  assert.throws(() => gov.castBallot(boss, open.id, false, t), /không bỏ phiếu/);
  const res = gov.castBallot(c, open.id, true, t + HOUR);
  assert.match(res.message, /phế truất/);

  const after = clans.clanView(boss, t + HOUR).clan;
  assert.equal(after.role, 'member');
  assert.equal(after.gov.canManage, false);
  assert.equal(after.gov.iAmDeposed, true);
  assert.equal(clans.clanView(b, t + HOUR).clan.role, 'leader');
  assert.equal(clans.clanView(b, t + HOUR).clan.gov.canManage, true);

  // Người bị phế truất không gửi/rút tiền, không chia cổ tức, không được phong lại chức.
  assert.throws(() => gov.openClanDeposit(boss, 5_000, 3, t + HOUR), /Chỉ tộc trưởng/);
  assert.throws(() => clans.payDividend(boss, 100, t + HOUR), /tộc trưởng/);
  assert.throws(() => clans.setMemberRole(b, boss, 'elder'), /phế truất/);
  assert.throws(() => clans.setMemberRole(b, boss, 'leader'), /phế truất/);
  // Rời đi rồi quay lại vẫn bị cấm.
  clans.leaveClan(boss, t + 2 * HOUR);
  clans.joinClan(boss, clanId, t + 3 * HOUR);
  assert.throws(() => clans.setMemberRole(b, boss, 'elder'), /phế truất/);
  assert.equal(clans.clanView(boss, t + 3 * HOUR).clan.gov.canManage, false);
});

test('phiếu thất bại thì phải chờ mới mở lại; phiếu hết giờ tự khép', () => {
  const t = T0 + 12 * DAY;
  // a mở phiếu phế truất b, đề cử c; boss và b... b là tộc trưởng nên không bầu; người bầu: boss, a, c.
  gov.startDepose(a, c, t);
  const vote = clans.clanView(a, t).clan.gov.vote;
  gov.castBallot(boss, vote.id, false, t);
  gov.castBallot(c, vote.id, false, t);
  assert.equal(clans.clanView(a, t).clan.gov.vote, null);
  assert.throws(() => gov.startDepose(c, a, t + DAY), /ngày sau/);
  gov.startDepose(c, a, t + 4 * DAY);
  gov.resolveVotes(t + 7 * DAY); // quá 48 giờ, chỉ 1 phiếu thuận
  assert.equal(clans.clanView(a, t + 7 * DAY).clan.gov.vote, null);
  assert.equal(clans.clanView(b, t + 7 * DAY).clan.role, 'leader');
});

test('mọi ngành gia tộc đều có dòng trong bảng tác động lên Sàn (kể cả ngành không tác động)', async () => {
  const { INDUSTRY_ORDER } = await import('../../public/ta-tua/game/js/shared/clan.js');
  const { INDUSTRY_MARKET } = await import('../../public/ta-tua/game/js/shared/industry-market.js');
  assert.deepEqual(INDUSTRY_ORDER.filter((id) => !INDUSTRY_MARKET[id]), []);
});

test('ngành gia tộc tác động lên Sàn; ngành chưa ai nắm thì hàng chạy bình thường', () => {
  assert.equal(industryStrength({}), 0);
  assert.equal(industryStrength({ clans: 1, plots: 8 }), 1);
  const inf = industryInfluence({ tea: { clans: 2, plots: 6 }, beverage: { clans: 1, plots: 0 }, logistics: { clans: 1, plots: 2 } });
  assert.ok(inf.tea_leaf.mean < 1, 'trà nhiều cung → giá giảm');
  assert.ok(inf.pearl.mean > 1, 'chuỗi trà sữa cầu trân châu → giá lên');
  assert.ok(inf.fish.vol < 1 && inf.fish.mean === 1, 'giao vận chỉ làm bớt biến động');
  assert.equal(industryInfluence({}).milk, undefined);

  // Gia tộc thâu tóm ngành Trà: Sàn hiện ngành chi phối lá trà; sữa (chưa ai nắm ngành) vẫn bình thường.
  store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'tea', 0, ?)").run(clanId, T0);
  assert.deepEqual(market.industryPresence().tea, { clans: 1, plots: 0 });
  const view = market.marketView(a, T0 + 13 * DAY);
  const tea = view.commodities.find((x) => x.id === 'tea_leaf');
  assert.ok(tea.industry && tea.industry.mean < 1);
  assert.equal(view.commodities.find((x) => x.id === 'cane').industry, null);
});

test('vĩ mô: ngày ghi từ trước khi có ngành mới được bổ sung cầu cho các ngành thiếu (không còn hiện 0%)', async () => {
  const macro = await import('../server/macro.js');
  const { INDUSTRY_ORDER } = await import('../../public/ta-tua/game/js/shared/clan.js');
  const day = '2027-03-01';
  store.db.prepare(`INSERT OR REPLACE INTO macro_days (day, phase, weather, land_index, gdp, demand, created_at)
    VALUES (?, 'recovery', 'calm', 1, 0.02, ?, 0)`).run(day, JSON.stringify({ tea: 1.05, dairy: 0.97 }));
  const state = macro.macroFor(day, { rand });
  assert.equal(state.demand.tea, 1.05, 'giữ nguyên cầu đã có');
  assert.deepEqual(INDUSTRY_ORDER.filter((id) => state.demand[id] == null), []);
  for (const id of INDUSTRY_ORDER) assert.ok(state.demand[id] >= 0.7 && state.demand[id] <= 1.35);
  const saved = JSON.parse(store.db.prepare('SELECT demand FROM macro_days WHERE day = ?').get(day).demand);
  assert.equal(Object.keys(saved).length, INDUSTRY_ORDER.length, 'đã lưu lại');
});

test('cân bằng ngành: mọi ngành chạy hết công suất thì mỗi mặt hàng lệch ròng không quá ±10%, Sàn vẫn còn ≥70% biến động', async () => {
  const { INDUSTRY_MARKET } = await import('../../public/ta-tua/game/js/shared/industry-market.js');
  const { HEAVY_INDUSTRIES } = await import('../../public/ta-tua/game/js/shared/industry.js');
  // Cả khi công nghiệp nặng tạm đóng (không ai nắm được) lẫn khi mở lại.
  for (const [plots, open] of [[8, false], [2, false], [8, true], [2, true]]) {
    const ids = Object.keys(INDUSTRY_MARKET).filter((id) => open || !HEAVY_INDUSTRIES.includes(id));
    const all = Object.fromEntries(ids.map((id) => [id, { clans: 1, plots }]));
    for (const [id, c] of Object.entries(industryInfluence(all))) {
      const net = c.sources.filter((s) => s.kind !== 'stabilize').reduce((m, s) => m * (1 + s.effect), 1);
      assert.ok(net >= 0.9 && net <= 1.1, `${id} lệch ${net.toFixed(3)} khi các ngành chạy ${plots} lô`);
      assert.ok(c.vol >= 0.7, `${id} biến động còn ${c.vol}`);
    }
  }
});
