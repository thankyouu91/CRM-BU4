// Kiểm thử Đấu trường gia tộc trên DB tạm: chiến lực, chọn 15 người mạnh nhất, trận đánh có seed, thách đấu và chọn
// giờ, xử thua khi không chọn giờ, chuyển lô/ghế, chia tiền phạt, hỏng trang phục người tham chiến.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR, ITEMS } = await import('../server/game.js');
const { post, treasuryBalance } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const clans = await import('../server/clans.js');
const arena = await import('../server/arena.js');
const gear = await import('../server/gear.js');
const { activeAnnouncements } = await import('../server/announcements.js');
const rules = await import('../../public/ta-tua/game/js/shared/arena.js');
const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');
const { dayKey } = await import('../server/clock.js');

// 10h sáng giờ Việt Nam.
const T0 = Date.parse('2026-11-25T03:00:00Z');
let seed = 9;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const tomorrow = dayKey(T0 + DAY);

let n = 0;
function player(level, species = 'test_pet') {
  n += 1;
  const id = store.createUser(`dau${n}`, 'x', T0 - 30 * DAY);
  post({ userId: id, delta: 5_000_000, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, species, T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
const clanOf = (userId) => clans.clanView(userId, T0).clan;
const fund = (userId) => clanOf(userId).treasury;

migrate(T0);
runDue(T0, rand);

// Gia tộc A (thách đấu): 17 người, cấp 30. Gia tộc B (giữ đất, giữ ghế Trị thủy): 5 người, cấp 5.
const aLeader = player(30);
clans.createClan(aLeader, { name: 'Hổ Vằn', emblem: '🐯', color: '#cc5500' }, T0);
clans.donateClan(aLeader, 3_000_000, T0);
const aMembers = Array.from({ length: 16 }, (_, i) => player(i < 2 ? 1 : 30));
for (const id of aMembers) clans.joinClan(id, clanOf(aLeader).id, T0);

const bLeader = player(5);
clans.createClan(bLeader, { name: 'Rùa Vàng', emblem: '🐢', color: '#227744' }, T0);
clans.donateClan(bLeader, 4_000_000, T0);
const bMembers = Array.from({ length: 4 }, () => player(5));
for (const id of bMembers) clans.joinClan(id, clanOf(bLeader).id, T0);
const plot = PLOTS.find((p) => p.zone === 'plain') ?? PLOTS[0];
clans.buyPlot(bLeader, plot.id, T0);
clans.enterIndustry(bLeader, 'irrigation', T0);
const A = clanOf(aLeader).id;
const B = clanOf(bLeader).id;

// Một món trang phục đỏ đang đeo trên bé của một thành viên B.
const wearable = Object.values(ITEMS).find((i) => i.type === 'accessory');
const g = gear.createGear(bMembers[0], wearable.id, { tier: 'red', affixes: { stats: 5 }, source: 'test' }, T0);
gear.equipGear(bMembers[0], store.getPet(store.getUser(bMembers[0]).active_pet_id), g.id);

test('chiến lực: (100 + 20 × cấp) × độ hiếm × (1 + 5% × điểm trang phục)', () => {
  assert.equal(rules.combatPower({ level: 1, rarity: 'thuong' }), 120);
  assert.equal(rules.combatPower({ level: 10, rarity: 'huyenthoai' }), 450);
  assert.equal(rules.combatPower({ level: 10, rarity: 'thuong', tiers: ['red', 'blue'] }), Math.round(300 * 1.25));
  const withGear = arena.memberPower(bMembers[0], T0);
  const without = arena.memberPower(bMembers[1], T0);
  assert.equal(withGear.power, Math.round(without.power * 1.2), 'món đỏ còn dùng được: +20%');
  assert.equal(clans.clanView(aLeader, T0).clan.members.find((m) => m.id === aLeader).power, arena.memberPower(aLeader, T0).power);
});

test('chọn 15 thành viên chiến lực cao nhất', () => {
  const roster = arena.clanRoster(A, T0);
  assert.equal(roster.length, 17);
  const top = arena.topFighters(A, T0);
  assert.equal(top.length, 15);
  assert.ok(top.every((m) => m.power >= roster[14].power));
  assert.ok(!top.some((m) => aMembers.slice(0, 2).includes(m.userId)), 'hai người cấp 1 ngồi ngoài');
});

test('trận đánh có seed: cùng seed ra cùng kết quả, bên mạnh hơn thắng, một bên trống thì thua ngay', () => {
  const strong = Array.from({ length: 5 }, () => ({ power: 800, rarity: 'thuong', element: 'kim' }));
  const weak = Array.from({ length: 5 }, () => ({ power: 200, rarity: 'thuong', element: 'moc' }));
  const x = rules.simulateBattle(strong, weak, 42);
  const y = rules.simulateBattle(strong, weak, 42);
  assert.deepEqual(x, y);
  assert.equal(x.winner, 'a');
  assert.ok(x.rounds.length > 0 && x.rounds.length <= rules.ARENA.maxRounds);
  assert.notDeepEqual(rules.simulateBattle(strong, weak, 43).rounds, x.rounds);
  assert.equal(rules.simulateBattle([], weak, 1).winner, 'b');
  // Kim khắc Mộc: đòn của bên Kim mạnh hơn 25%.
  assert.equal(rules.elementMult('kim', 'moc'), 1.25);
  assert.equal(rules.elementMult('moc', 'kim'), 0.85);
});

let war;
test('thách đấu: kiểm tra khung giờ, quyền, một trận một lúc; bên bị thách chọn giờ thì cả server nhận thông báo', () => {
  assert.throws(() => arena.challenge(aMembers[5], { defenderId: B, kind: 'plot', ref: plot.id, slots: [{ day: tomorrow, hour: 19 }] }, T0), /tộc trưởng hoặc trưởng lão/);
  assert.throws(() => arena.challenge(aLeader, { defenderId: B, kind: 'plot', ref: plot.id, slots: [{ day: dayKey(T0), hour: 19 }] }, T0), /từ ngày mai/);
  assert.throws(() => arena.challenge(aLeader, { defenderId: B, kind: 'plot', ref: plot.id, slots: [{ day: tomorrow, hour: 21 }] }, T0), /19h hoặc 20h/);
  assert.throws(() => arena.challenge(aLeader, { defenderId: A, kind: 'plot', ref: plot.id, slots: [{ day: tomorrow, hour: 19 }] }, T0), /Không tự thách/);
  const { id } = arena.challenge(aLeader, { defenderId: B, kind: 'plot', ref: plot.id, slots: [{ day: tomorrow, hour: 19 }, { day: tomorrow, hour: 20 }] }, T0);
  war = id;
  assert.throws(() => arena.challenge(aLeader, { defenderId: B, kind: 'seat', ref: 'irrigation', slots: [{ day: tomorrow, hour: 19 }] }, T0), /một trận/);
  const view = arena.arenaView(bLeader, T0).clan.wars[0];
  assert.equal(view.status, 'proposed');
  assert.equal(view.slots.length, 2);
  assert.throws(() => arena.confirmSlot(aLeader, id, view.slots[0], T0), /bị thách đấu/);
  arena.confirmSlot(bLeader, id, view.slots[1], T0 + HOUR);
  assert.equal(arena.arenaView(bLeader, T0).clan.wars[0].scheduledAt, rules.slotTime(tomorrow, 20));
  assert.ok(activeAnnouncements(T0 + HOUR).some((a) => a.title.includes('Hổ Vằn') && a.popup));
});

test('đến giờ: đánh, bên mạnh thắng, lô chuyển sang, phạt 30% chia đôi, trang phục người tham chiến hỏng', () => {
  const at = rules.slotTime(tomorrow, 20);
  // Chạy bộ lập lịch tới sát giờ (quyết toán đêm qua) rồi mới chốt số quỹ để so.
  runDue(at - 60_000, rand);
  assert.equal(arena.arenaView(bLeader, at).clan.wars[0].status, 'scheduled', 'chưa tới giờ');
  const bFund = fund(bLeader);
  const aFund = fund(aLeader);
  const treasury = treasuryBalance();
  arena.settleArena(at + 30_000);
  const r = arena.warReplay(war);
  assert.equal(r.status, 'done');
  assert.equal(r.winnerId, A);
  assert.equal(r.teams[0].length, 15);
  assert.equal(r.teams[1].length, 5);
  assert.ok(r.rounds.length > 0);
  const penalty = Math.floor(bFund * 0.3);
  assert.equal(r.penalty, penalty);
  assert.equal(fund(bLeader), bFund - penalty);
  assert.equal(fund(aLeader), aFund + Math.floor(penalty / 2));
  assert.equal(treasuryBalance(), treasury + penalty - Math.floor(penalty / 2));
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(plot.id).clan_id, A);
  const worn = gear.wornGear(store.getUser(bMembers[0]).active_pet_id);
  assert.ok(Object.values(worn).every((w) => w.broken), 'đồ đang đeo hỏng hẳn');
  assert.equal(arena.memberPower(bMembers[0], at + DAY).power, arena.memberPower(bMembers[1], at + DAY).power, 'đồ hỏng không cộng chiến lực');
  // Đánh lại từ nhật ký vẫn ra đúng kết quả.
  const again = rules.simulateBattle(
    r.teams[0].map((m) => ({ power: m.power, rarity: m.pet.rarity, element: m.pet.element })),
    r.teams[1].map((m) => ({ power: m.power, rarity: m.pet.rarity, element: m.pet.element })),
    rules.warSeed(war, at),
  );
  assert.deepEqual(again.rounds, r.rounds);
});

test('không thách lại cùng lô trong 7 ngày; không chọn giờ trong 48 giờ thì xử thua, mất ghế, phạt 15%', () => {
  const t = T0 + 2 * DAY;
  // B mua lại một lô khác để có thể giành lại sau; lô vừa đấu đang trong thời gian chờ.
  assert.throws(() => arena.challenge(bLeader, { defenderId: A, kind: 'plot', ref: plot.id, slots: [{ day: dayKey(t + DAY), hour: 19 }] }, t), /7 ngày/);
  const { id } = arena.challenge(aLeader, { defenderId: B, kind: 'seat', ref: 'irrigation', slots: [{ day: dayKey(t + 3 * DAY), hour: 19 }] }, t);
  const bFund = fund(bLeader);
  const aFund = fund(aLeader);
  arena.settleArena(t + 47 * HOUR);
  assert.equal(arena.warReplay(id).status, 'proposed');
  arena.settleArena(t + 48 * HOUR + 1);
  const r = arena.warReplay(id);
  assert.equal(r.status, 'forfeit');
  assert.equal(r.winnerId, A);
  const penalty = Math.floor(bFund * 0.15);
  assert.equal(r.penalty, penalty);
  assert.equal(fund(aLeader), aFund + Math.floor(penalty / 2));
  const seatOf = (clanId) => store.db.prepare("SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = 'irrigation'").get(clanId);
  assert.ok(seatOf(A) && !seatOf(B), 'ghế Trị thủy sang A');
});

test('rút lời thách và quản trị viên hủy trận', () => {
  const t = T0 + 5 * DAY;
  const second = PLOTS.find((p) => p.id !== plot.id && p.zone === plot.zone);
  clans.buyPlot(bLeader, second.id, t);
  const { id } = arena.challenge(aLeader, { defenderId: B, kind: 'plot', ref: second.id, slots: [{ day: dayKey(t + DAY), hour: 19 }] }, t);
  assert.throws(() => arena.withdraw(bLeader, id, t), /bên thách đấu/);
  arena.withdraw(aLeader, id, t);
  assert.equal(arena.warReplay(id).status, 'cancelled');
  const next = arena.challenge(aLeader, { defenderId: B, kind: 'plot', ref: second.id, slots: [{ day: dayKey(t + DAY), hour: 20 }] }, t);
  const admin = arena.adminCancelWar(next.id, 'Quản trị viên', 'thử');
  assert.equal(admin.history.find((w) => w.id === next.id).status, 'cancelled');
  assert.throws(() => arena.adminCancelWar(next.id, 'Quản trị viên'), /chưa đánh/);
});
