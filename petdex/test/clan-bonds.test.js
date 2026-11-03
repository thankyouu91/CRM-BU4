// Kiểm thử trái phiếu và quyền lãi suất: phát hành (trần 50% sổ sách, khoảng coupon, trần 20% mỗi người, phí), coupon mỗi
// đêm có khấu thuế 10%, đáo hạn trả gốc, vỡ nợ và arrears (trái chủ trước cổ đông), sàn thứ cấp, trái phiếu kho bạc,
// lãi suất cơ bản do gia tộc nắm Ngân hàng nhà nước đặt, phạt và mất ghế, giải tán; cuối cùng đối soát sổ cái.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const clans = await import('../server/clans.js');
const bonds = await import('../server/clan-bonds.js');
const sh = await import('../server/clan-shares.js');
const bank = await import('../server/bank.js');
const { netWorth } = await import('../server/wallet.js');
const { BONDS, RATE_POWER, couponOf, financeTax, rateBand } = await import('../../public/ta-tua/game/js/shared/clan-bonds.js');
const { dayKey, startOfDay, nextDay } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
migrate(T0);
let n = 0;
function player() {
  n += 1;
  const id = store.createUser(`tp${n}`, 'x', T0 - 30 * DAY);
  post({ userId: id, delta: 5_000_000, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, 'test_pet', T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
function makeClan(name, money = 2_000_000) {
  const leader = player();
  clans.createClan(leader, { name, emblem: '🏯', color: '#445566' }, T0);
  clans.donateClan(leader, money, T0);
  return { leader, id: clans.clanView(leader, T0).clan.id };
}
const bal = (a) => store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(a)?.balance ?? 0;
const issue = (id) => store.db.prepare('SELECT * FROM bond_issues WHERE id = ?').get(id);
const lastIssue = () => store.db.prepare('SELECT * FROM bond_issues ORDER BY id DESC LIMIT 1').get();
const base = bank.economy().baseRate;
const midnight = (ts) => startOfDay(nextDay(dayKey(ts)));

const rateClan = makeClan('Ngân Khố');
store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'state_bank', 0, ?)").run(rateClan.id, T0);
const issuer = makeClan('Phát Hành', 300_000);
const a = player();
const b = player();
let id;

test('phát hành: khoảng coupon, trần 50% giá trị sổ sách', () => {
  assert.throws(() => bonds.issueClanBonds(issuer.leader, { qty: 100, coupon: base * 5.1, term: 7 }, T0), /Lãi coupon/);
  assert.throws(() => bonds.issueClanBonds(issuer.leader, { qty: 100, coupon: base, term: 9 }, T0), /Kỳ hạn/);
  const room = Math.floor(sh.bookValue(issuer.id, T0) * 1000 * BONDS.clanBookShare / BONDS.face);
  assert.ok(room + 1 <= BONDS.maxQty);
  assert.throws(() => bonds.issueClanBonds(issuer.leader, { qty: room + 1, coupon: base * 2, term: 7 }, T0), /sổ sách/);
  bonds.issueClanBonds(issuer.leader, { qty: 1000, coupon: base * 2, term: 7 }, T0);
  id = lastIssue().id;
  assert.equal(lastIssue().status, 'subscribing');
});

test('mua theo mệnh giá: trần 20% mỗi người, tiền về quỹ trừ 1% phí cho Ngân hàng nhà nước; hết giờ thì hủy phần chưa bán', () => {
  const fund = bal(`clan:${issuer.id}`);
  const broker = bal(`clan:${rateClan.id}`);
  assert.throws(() => bonds.subscribeBonds(a, id, 201, {}, T0 + HOUR), /tối đa 200/);
  bonds.subscribeBonds(a, id, 200, {}, T0 + HOUR);
  bonds.subscribeBonds(b, id, 100, {}, T0 + HOUR);
  assert.equal(bal(`clan:${issuer.id}`), fund + 300 * BONDS.face - Math.ceil(200 * BONDS.face * BONDS.issueFee) - Math.ceil(100 * BONDS.face * BONDS.issueFee));
  assert.ok(bal(`clan:${rateClan.id}`) > broker);
  bonds.closeBondSubs(T0 + BONDS.subscribeHours * HOUR);
  const i = issue(id);
  assert.equal(i.status, 'active');
  assert.equal(i.qty, 300);
  assert.equal(i.matures_at, i.closes_at + 7 * DAY);
  assert.equal(netWorth(a, T0 + 2 * DAY).parts.bonds, 200 * BONDS.face);
});

test('coupon mỗi nửa đêm, khấu thuế 10%; mỗi đêm chỉ trả một lần', () => {
  const end = midnight(T0 + 2 * DAY);
  const coins = store.getUser(a).coins;
  bonds.settleBondsDay(end);
  bonds.settleBondsDay(end);
  const per = Math.floor(couponOf(300, issue(id).coupon) * 200 / 300);
  assert.equal(store.getUser(a).coins, coins + per - financeTax(per));
});

test('sàn thứ cấp: rao bán, người mua trả 1% phí, rút lệnh', () => {
  bonds.listBonds(a, id, 50, 105, {}, T0 + 2 * DAY);
  const ask = store.db.prepare("SELECT * FROM bond_asks WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
  assert.throws(() => bonds.listBonds(a, id, 151, 105, {}, T0 + 2 * DAY), /chưa rao bán/);
  const c = player();
  const cb0 = store.getUser(c).coins;
  const ca0 = store.getUser(a).coins;
  bonds.buyBondAsk(c, ask.id, 20, {}, T0 + 2 * DAY);
  assert.equal(store.getUser(c).coins, cb0 - 20 * 105 - Math.ceil(20 * 105 * BONDS.tradeFee));
  assert.equal(store.getUser(a).coins, ca0 + 20 * 105);
  bonds.cancelBondAsk(a, ask.id);
  assert.equal(store.db.prepare('SELECT listed FROM bond_holdings WHERE issue_id = ? AND holder_id = ?').get(id, a).listed, 0);
});

test('vỡ nợ: thiếu tiền thì cộng arrears, không chia cổ tức được; có tiền lại thì trả nợ cũ trước rồi đáo hạn', () => {
  const end = midnight(T0 + 3 * DAY);
  const fund = bal(`clan:${issuer.id}`);
  post({ account: `clan:${issuer.id}`, delta: -fund, kind: 'clan_upkeep', now: end - HOUR });
  post({ account: 'treasury', delta: fund, kind: 'clan_upkeep', now: end - HOUR });
  bonds.settleBondsDay(end);
  const i = issue(id);
  assert.equal(i.status, 'defaulted');
  assert.equal(i.arrears, couponOf(300, i.coupon));
  assert.ok(bonds.bondsInDefault(issuer.id));
  post({ account: 'treasury', delta: -1_000, kind: 'admin', now: end });
  post({ account: `clan:${issuer.id}`, delta: 1_000, kind: 'admin', now: end });
  sh.startIpo(issuer.leader, { shares: 100, price: Math.max(1, Math.round(sh.bookValue(issuer.id, end))) }, end); // lên sàn được nhưng không chia cổ tức
  sh.closeIpos(end + BONDS.subscribeHours * HOUR);
  assert.throws(() => sh.payShareDividend(issuer.leader, 1000, end + 2 * DAY), /trái chủ/);
  post({ account: 'treasury', delta: -500_000, kind: 'admin', now: end });
  post({ account: `clan:${issuer.id}`, delta: 500_000, kind: 'admin', now: end });
  const coins = store.getUser(b).coins;
  for (let d = 1; d <= 6; d++) bonds.settleBondsDay(end + d * DAY);
  const done = issue(id);
  assert.equal(done.status, 'matured');
  assert.equal(done.arrears, 0);
  assert.ok(store.getUser(b).coins >= coins + 100 * BONDS.face);
  assert.equal(bonds.bondsInDefault(issuer.id), false);
});

test('trái phiếu kho bạc: tiền vào ngân sách', () => {
  const t0 = bal('treasury');
  bonds.issueTreasuryBonds({ qty: 500, coupon: base, term: 14 }, 'test', T0 + 10 * DAY);
  bonds.subscribeBonds(a, lastIssue().id, 100, {}, T0 + 10 * DAY);
  assert.equal(bal('treasury'), t0 + 100 * BONDS.face - Math.ceil(100 * BONDS.face * BONDS.issueFee));
});

test('lãi suất cơ bản: chỉ gia tộc nắm Ngân hàng nhà nước, trong biên ±0,1 điểm %, áp vào lãi tiết kiệm NPC tới phiên họp sau', () => {
  const now = T0 + 11 * DAY;
  const [lo, hi] = rateBand(bank.economy().policyRate);
  assert.throws(() => bonds.setBaseRate(issuer.leader, lo, now), /Ngân hàng nhà nước/);
  assert.throws(() => bonds.setBaseRate(rateClan.leader, hi + 0.0001, now), /Lãi suất cơ bản từ/);
  bonds.setBaseRate(rateClan.leader, lo, now);
  assert.equal(bank.economy().baseRate, lo);
  assert.equal(bank.bankView(a, now).baseRate, lo);
  bank.centralBankWeek('2026-12-06', now + DAY);
  assert.equal(bonds.currentOverride(), null);
});

test('lượng xu tăng quá 15%/tuần trong tuần gia tộc hạ lãi: phạt; lần hai trong 28 ngày: mất ghế', () => {
  const now = T0 + 14 * DAY;
  const policy = bank.economy().policyRate;
  const override = { rate: policy - 0.0005, clanId: rateClan.id, week: bank.economy().week, at: now };
  store.db.prepare('UPDATE central_bank SET growth = 0.3 WHERE week = (SELECT MAX(week) FROM central_bank)').run();
  const t0 = bal('treasury');
  bonds.rateWeek(override, policy, now);
  assert.equal(bal('treasury'), t0 + RATE_POWER.penalty);
  assert.ok(store.db.prepare("SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = 'state_bank'").get(rateClan.id));
  assert.equal(bonds.rateWeek({ ...override, rate: policy }, policy, now + 7 * DAY), null); // không hạ lãi thì không phạt
  bonds.rateWeek(override, policy, now + 7 * DAY);
  assert.equal(store.db.prepare("SELECT 1 FROM clan_industries WHERE clan_id = ? AND industry = 'state_bank'").get(rateClan.id), undefined);
});

test('giải tán: quỹ trả trái chủ trước khi về ngân sách', () => {
  const now = T0 + 30 * DAY;
  const c = makeClan('Tan Rã', 500_000);
  bonds.issueClanBonds(c.leader, { qty: 100, coupon: base, term: 7 }, now);
  const iid = lastIssue().id;
  bonds.subscribeBonds(a, iid, 20, {}, now);
  bonds.closeBondSubs(now + BONDS.subscribeHours * HOUR);
  const coins = store.getUser(a).coins;
  clans.leaveClan(c.leader, now + 2 * DAY);
  assert.equal(store.getUser(a).coins, coins + 20 * BONDS.face);
});

test('người giữ ít trái phiếu vẫn nhận đủ lãi nhờ cộng dồn phần lẻ', () => {
  const t = makeClan('Lẻ Xu', 500_000);
  bonds.issueClanBonds(t.leader, { qty: 100, coupon: base * 1.5, term: 14 }, T0 + 40 * DAY);
  const iid = lastIssue().id;
  const small = player();
  bonds.subscribeBonds(small, iid, 1, {}, T0 + 40 * DAY);
  bonds.subscribeBonds(a, iid, 20, {}, T0 + 40 * DAY);
  bonds.closeBondSubs(T0 + 40 * DAY + BONDS.subscribeHours * HOUR);
  const coins = store.getUser(small).coins;
  for (let d = 1; d <= 5; d++) bonds.settleBondsDay(midnight(T0 + 41 * DAY + d * DAY));
  const exact = 5 * BONDS.face * issue(iid).coupon; // 1 trái phiếu, 5 đêm
  const got = store.getUser(small).coins - coins;
  assert.ok(got >= Math.floor(exact) - 1 && got > 0, `nhận ${got}, lãi đúng ${exact}`);
});

test('sổ cái khớp', () => {
  const bad = store.db.prepare(`
    SELECT a.id FROM accounts a LEFT JOIN ledger l ON l.account = a.id GROUP BY a.id HAVING a.balance != COALESCE(SUM(l.delta), 0)`).all();
  assert.deepEqual(bad, []);
  const wallets = store.db.prepare(`
    SELECT u.id FROM users u LEFT JOIN ledger l ON l.user_id = u.id AND l.account = 'wallet' GROUP BY u.id HAVING u.coins != COALESCE(SUM(l.delta), 0)`).all();
  assert.deepEqual(wallets, []);
});
