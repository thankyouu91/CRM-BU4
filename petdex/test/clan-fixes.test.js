// Kiểm thử các lỗi gia tộc và Đấu trường đã sửa: thành viên bị kẹt khi gia tộc giải tán, chỉ bé ra sân bị hỏng đồ,
// mục tiêu đổi chủ thì hủy trận, ghế ở lại khi bên thắng hết chỗ, đội trống, tiền gửi kỳ hạn không né được phạt/truy thu.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR, ITEMS } = await import('../server/game.js');
const { post, treasuryBalance } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const gov = await import('../server/clan-gov.js');
const arena = await import('../server/arena.js');
const gear = await import('../server/gear.js');
const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');
const { slotTime } = await import('../../public/ta-tua/game/js/shared/arena.js');
const { dayKey } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
let seed = 21;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
migrate(T0);
runDue(T0, rand);

let n = 0;
function player(level, { pet = true } = {}) {
  n += 1;
  const id = store.createUser(`sua${n}`, 'x', T0 - 30 * DAY);
  post({ userId: id, delta: 5_000_000, kind: 'opening', now: T0 });
  if (pet) {
    const petId = store.insertPet(id, `Bé ${n}`, 'test_pet', T0 - 20 * DAY);
    store.savePet({ ...store.getPet(petId), level, updated_at: T0 });
    store.setActivePet(id, petId);
  }
  return id;
}
const clanOf = (u) => clans.clanView(u, T0).clan;
const fund = (u) => clanOf(u).treasury;
function makeClan(name, level, members = 0, { pets = true, money = 3_000_000 } = {}) {
  const leader = player(level, { pet: pets });
  clans.createClan(leader, { name, emblem: '🏯', color: '#445566' }, T0);
  clans.donateClan(leader, money, T0);
  const ms = Array.from({ length: members }, () => player(level, { pet: pets }));
  for (const m of ms) clans.joinClan(m, clanOf(leader).id, T0);
  return { leader, members: ms, id: clanOf(leader).id };
}
const freePlots = () => {
  const used = new Set(store.db.prepare('SELECT id FROM land_plots WHERE clan_id IS NOT NULL').all().map((r) => r.id));
  return PLOTS.filter((p) => !used.has(p.id) && p.zone !== 'sea');
};
let dayOffset = 0;
/** Thách đấu, chốt giờ ngày mai 19h (mỗi lần lùi thêm một ngày để không trùng khung). */
function schedule(challenger, defender, kind, ref) {
  dayOffset += 1;
  const now = T0 + (dayOffset - 1) * 2 * DAY;
  const day = dayKey(now + DAY);
  const { id } = arena.challenge(challenger.leader, { defenderId: defender.id, kind, ref, slots: [{ day, hour: 19 }] }, now);
  arena.confirmSlot(defender.leader, id, slotTime(day, 19), now + HOUR);
  return { id, at: slotTime(day, 19) };
}

test('giải tán vì không còn ai làm được tộc trưởng: mọi thành viên được thả ra, vào/lập gia tộc khác được', () => {
  const c = makeClan('Kẹt Cứng', 5, 2);
  for (const m of c.members) store.db.prepare('INSERT INTO clan_deposed (clan_id, user_id, at) VALUES (?, ?, ?)').run(c.id, m, T0);
  const r = clans.leaveClan(c.leader, T0);
  assert.match(r.message, /2 thành viên còn lại được tự do/);
  for (const m of c.members) assert.equal(clans.clanView(m, T0).clan, null);
  const other = makeClan('Nhà Mới', 5);
  clans.joinClan(c.members[0], other.id, T0);
  assert.equal(clanOf(c.members[0]).id, other.id);
  clans.createClan(c.members[1], { name: 'Tự Lập', emblem: '🌸', color: '#aa3366' }, T0);
});

test('sửa một lần: dòng thành viên trỏ vào gia tộc đã giải tán được xóa', () => {
  const stuck = player(3);
  const dead = store.db.prepare('SELECT id FROM clans WHERE dissolved_at IS NOT NULL LIMIT 1').get().id;
  store.db.prepare("INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(stuck, dead, T0);
  assert.throws(() => clans.createClan(stuck, { name: 'Bị Kẹt', emblem: '🌸', color: '#aa3366' }, T0));
  store.db.prepare("DELETE FROM meta WHERE key = 'migrated_clan_members_dissolved_v1'").run();
  migrate(T0);
  assert.ok(!store.db.prepare('SELECT 1 FROM clan_members WHERE user_id = ?').get(stuck));
  assert.ok(store.adminLogs(5).some((l) => l.action === 'clan_members_repair'));
});

test('Đấu trường: chỉ đồ trên bé ra sân bị hỏng, bé ở nhà giữ nguyên', () => {
  const a = makeClan('Gấu Nâu', 30, 2);
  const b = makeClan('Cáo Đỏ', 3, 1);
  const plot = freePlots()[0];
  clans.buyPlot(b.leader, plot.id, T0);
  // Người của B có thêm một bé yếu ở nhà, đeo một món.
  const homePet = store.insertPet(b.members[0], 'Bé ở nhà', 'test_pet', T0 - 5 * DAY);
  const wearable = Object.values(ITEMS).find((i) => i.type === 'accessory');
  const g1 = gear.createGear(b.members[0], wearable.id, { tier: 'red', affixes: { stats: 5 }, source: 'test' }, T0);
  gear.equipGear(b.members[0], store.getPet(homePet), g1.id);
  const fighterPet = store.getUser(b.members[0]).active_pet_id;
  const g2 = gear.createGear(b.members[0], wearable.id, { tier: 'blue', affixes: { stats: 2 }, source: 'test' }, T0);
  gear.equipGear(b.members[0], store.getPet(fighterPet), g2.id);
  const { id, at } = schedule(a, b, 'plot', plot.id);
  arena.settleArena(at + 1000);
  assert.equal(arena.warReplay(id).status, 'done');
  assert.ok(Object.values(gear.wornGear(fighterPet)).every((w) => w.broken), 'bé ra sân hỏng đồ');
  assert.ok(Object.values(gear.wornGear(homePet)).every((w) => !w.broken), 'bé ở nhà không sao');
});

test('mục tiêu đã đổi chủ lúc đánh hoặc lúc xử thua: hủy trận, không phạt', () => {
  const a = makeClan('Sói Xám', 20, 1);
  const b = makeClan('Thỏ Trắng', 5, 1);
  const plot = freePlots()[0];
  clans.buyPlot(b.leader, plot.id, T0);
  const { id, at } = schedule(a, b, 'plot', plot.id);
  clans.sellPlot(b.leader, plot.id, at - HOUR);
  const before = fund(b.leader);
  arena.settleArena(at + 1000);
  const r = arena.warReplay(id);
  assert.equal(r.status, 'cancelled');
  assert.equal(r.note, 'Mục tiêu đã đổi chủ');
  assert.equal(r.penalty, 0);
  assert.equal(fund(b.leader), before);
});

test('bên thắng hết chỗ nhận ghế: ghế ở lại với bên giữ, tiền phạt vẫn tính', () => {
  const a = makeClan('Hổ Đen', 30, 2, { money: 4_000_000 });
  const b = makeClan('Mèo Mướp', 3, 1, { money: 4_000_000 });
  clans.enterIndustry(b.leader, 'irrigation', T0);
  const { id, at } = schedule(a, b, 'seat', 'irrigation');
  clans.enterIndustry(a.leader, 'wind_farm', T0 + 2 * HOUR); // sau khi thách đấu mới thâu tóm ghế khác
  const bFund = fund(b.leader);
  arena.settleArena(at + 1000);
  const r = arena.warReplay(id);
  assert.equal(r.winnerId, a.id);
  assert.ok(r.penalty > 0);
  assert.ok(fund(b.leader) < bFund);
  assert.ok(store.db.prepare("SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = 'irrigation'").get(b.id), 'ghế ở lại với bên giữ');
  assert.match(r.note, /ở lại với bên giữ ghế/);
});

test('đội trống: bên thách đấu trống thì nộp 15% và mục tiêu giữ nguyên; bên giữ trống thì nộp 15% và mất mục tiêu; cả hai trống thì hủy', () => {
  // Bên thách đấu không có bé nào.
  const a = makeClan('Không Bé', 1, 0, { pets: false });
  const b = makeClan('Có Bé', 5, 0);
  const p1 = freePlots()[0];
  clans.buyPlot(b.leader, p1.id, T0);
  let w = schedule(a, b, 'plot', p1.id);
  let aFund = fund(a.leader);
  arena.settleArena(w.at + 1000);
  let r = arena.warReplay(w.id);
  assert.equal(r.status, 'forfeit');
  assert.equal(r.winnerId, b.id);
  assert.equal(r.penalty, Math.floor(aFund * 0.15));
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(p1.id).clan_id, b.id);
  // Bên giữ không có bé nào.
  const c = makeClan('Có Bé 2', 5, 0);
  const d = makeClan('Không Bé 2', 1, 0, { pets: false });
  const p2 = freePlots()[0];
  clans.buyPlot(d.leader, p2.id, T0);
  w = schedule(c, d, 'plot', p2.id);
  const dFund = fund(d.leader);
  arena.settleArena(w.at + 1000);
  r = arena.warReplay(w.id);
  assert.equal(r.status, 'forfeit');
  assert.equal(r.penalty, Math.floor(dFund * 0.15));
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(p2.id).clan_id, c.id);
  // Cả hai trống.
  const e = makeClan('Trống 1', 1, 0, { pets: false });
  const f = makeClan('Trống 2', 1, 0, { pets: false });
  const p3 = freePlots()[0];
  clans.buyPlot(f.leader, p3.id, T0);
  w = schedule(e, f, 'plot', p3.id);
  aFund = fund(e.leader);
  arena.settleArena(w.at + 1000);
  r = arena.warReplay(w.id);
  assert.equal(r.status, 'cancelled');
  assert.equal(fund(e.leader), aFund);
});

test('tiền gửi kỳ hạn không né được phạt Đấu trường: tính trên quỹ + tiền gửi, phá khoản gửi lấy gốc, mất lãi', () => {
  const a = makeClan('Đại Bàng', 30, 2);
  const b = makeClan('Chim Sẻ', 3, 0, { money: 1_000_000 });
  const plot = freePlots()[0];
  clans.buyPlot(b.leader, plot.id, T0);
  // B gửi gần hết quỹ vào kỳ hạn 14 ngày.
  const deposit = fund(b.leader) - 10_000;
  gov.openClanDeposit(b.leader, deposit, 14, T0);
  const assets = gov.clanAssets(b.id);
  assert.equal(fund(b.leader), 10_000);
  const { id, at } = schedule(a, b, 'plot', plot.id);
  const treasury = treasuryBalance();
  arena.settleArena(at + 1000);
  const r = arena.warReplay(id);
  // Quỹ và tiền gửi có thể đã đổi một chút do quyết toán đêm; tiền phạt ≈ 30% tài sản, lớn hơn hẳn 30% của quỹ.
  assert.ok(r.penalty > 0.25 * assets && r.penalty <= 0.3 * assets + 1, `phạt ${r.penalty} / tài sản ${assets}`);
  assert.equal(gov.clanDeposited(b.id), 0, 'khoản gửi đã bị thu hồi');
  assert.ok(treasuryBalance() > treasury);
  const closed = store.db.prepare('SELECT * FROM clan_deposits WHERE clan_id = ?').get(b.id);
  assert.equal(closed.payout, deposit, 'trả đúng gốc, mất lãi');
});

test('quản trị viên truy thu: quỹ thiếu thì phá tiền gửi kỳ hạn', () => {
  const c = makeClan('Trốn Thuế', 5, 0, { money: 600_000 });
  gov.openClanDeposit(c.leader, fund(c.leader) - 1_000, 7, T0);
  store.db.prepare('INSERT INTO tax_evasion (clan_id, day, revenue, declared, rate, evaded, created_at) VALUES (?, ?, 0, 0, 0.35, ?, ?)').run(c.id, dayKey(T0), 100_000, T0);
  const row = store.db.prepare('SELECT id FROM tax_evasion WHERE clan_id = ?').get(c.id);
  const out = clans.resolveEvasion(row.id, 'collect', { penalty: 0.5 }, T0 + HOUR);
  assert.equal(out.collected, 150_000, 'thu đủ dù quỹ chỉ còn 1.000 xu');
  assert.ok(gov.clanDeposited(c.id) === 0);
});
