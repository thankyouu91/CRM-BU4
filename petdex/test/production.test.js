// Kiểm thử tích hợp giai đoạn 2 trên DB tạm: chăm sóc, trường, vườn, bếp, xưởng, hợp đồng, Chợ Phiên, vay; đối soát sổ cái.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, GameError, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const jobs = await import('../server/jobs.js');
const market = await import('../server/market.js');
const social = await import('../server/social.js');
const care = await import('../server/care.js');
const farm = await import('../server/farm.js');
const factory = await import('../server/factory.js');
const contracts = await import('../server/contracts.js');
const bazaar = await import('../server/bazaar.js');
const credit = await import('../server/credit.js');
const { CONTRACTS, CREDIT, LOANS, SCHOOL, shortfallPenalty } = await import('../server/rules/production.js');

const T0 = Date.parse('2026-11-02T03:00:00Z'); // 10 giờ sáng thứ Hai, giờ Việt Nam (nửa đêm = T0 + 14 giờ)
const coins = (id) => store.getUser(id).coins;
const goods = (id, c) => market.stock(id, Date.now() + 365 * DAY)[c] ?? 0;
const stockAt = (id, c, t) => market.stock(id, t)[c] ?? 0;
const always = (v) => () => v;
const comp = (id) => store.db.prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE user_id = ? AND kind = 'contract_comp'").get(id).s;

function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY); // loài lạ, tuổi Trưởng thành: số liệu trung tính
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  for (const skill of ['strength', 'agility', 'intellect', 'charm', 'craft']) store.setSkill(petId, skill, 20);
  store.setActivePet(id, petId);
  return { id, petId };
}

/** Chăm bé đầy đủ ở thời điểm `t` để các bước sau không vướng đói, mệt, ốm. */
function refresh(petId, t) {
  store.savePet({ ...store.getPet(petId), fullness: 90, energy: 100, happiness: 80, hygiene: 90, health: 90, sick: null, busy_from: null, busy_until: null, updated_at: t });
}

migrate(T0);
runDue(T0);
const alice = newPlayer('alice', 20_000);
const bob = newPlayer('bob', 3000);
const carol = newPlayer('carol', 1000);
social.requestFriend(alice.id, 'bob', T0);
social.acceptFriend(bob.id, alice.id, T0);

test('chăm sóc: tắm sạch, bé ốm không đi làm được, phòng khám chữa và bảo hiểm trả một phần', () => {
  const t = T0;
  refresh(alice.petId, t);
  store.savePet({ ...store.getPet(alice.petId), hygiene: 10 });
  care.bath(alice.id, alice.petId, t);
  assert.equal(Math.round(store.getPet(alice.petId).hygiene), 100);

  refresh(alice.petId, t);
  store.savePet({ ...store.getPet(alice.petId), health: 30, sick: 'cold' });
  assert.throws(() => jobs.startShift(alice.id, { petId: alice.petId, career: 'barista', hours: 1 }, t), /ốm/);

  care.setInsurance(alice.id, 'basic', t);
  const view = care.clinicView(alice.id);
  const bill = view.treatments.cold.bill;
  assert.ok(bill.paid < bill.total, 'bảo hiểm trả một phần');
  const before = coins(alice.id);
  care.visitClinic(alice.id, alice.petId, t);
  assert.equal(coins(alice.id), before - bill.paid);
  const pet = store.getPet(alice.petId);
  assert.equal(pet.sick, null);
  assert.ok(pet.health > 30);
});

test('trường học: tốn xu và năng lượng, bé bận 30 phút, mỗi môn tối đa 3 buổi/ngày', () => {
  let t = T0 + HOUR;
  refresh(alice.petId, t);
  const before = store.skillsOf(alice.petId).strength;
  const paid = coins(alice.id);
  care.attendClass(alice.id, alice.petId, 'strength', t, always(0.5));
  assert.ok(store.skillsOf(alice.petId).strength > before);
  assert.ok(coins(alice.id) < paid);
  assert.throws(() => care.attendClass(alice.id, alice.petId, 'strength', t + 60_000), /bận/);
  for (let i = 1; i < SCHOOL.perSkillPerDay; i++) {
    t += SCHOOL.minutes * 60_000;
    care.attendClass(alice.id, alice.petId, 'strength', t, always(0.5));
  }
  t += SCHOOL.minutes * 60_000;
  assert.throws(() => care.attendClass(alice.id, alice.petId, 'strength', t), /đủ/);
});

test('vườn: gieo hạt, bạn bè tưới hộ được thưởng, người lạ không vào được, thu hoạch có giá vốn', () => {
  const t = T0 + 2 * HOUR;
  farm.plant(alice.id, 0, 'tea', t, always(0.9)); // 0.9 ≥ tỉ lệ sâu: vụ này không có sâu
  assert.throws(() => farm.plant(alice.id, 0, 'tea', t), GameError);
  const bobCoins = coins(bob.id);
  farm.water(bob.id, alice.id, 0, t + HOUR);
  assert.equal(coins(bob.id), bobCoins + 2);
  assert.throws(() => farm.water(bob.id, alice.id, 0, t + HOUR), /rồi/);
  assert.throws(() => farm.water(carol.id, alice.id, 0, t + HOUR), /bạn bè/);
  assert.throws(() => farm.gardenView(carol.id, alice.id, t), /bạn bè/);
  assert.throws(() => farm.harvest(alice.id, 0, t + HOUR), /Chưa/);
  const had = stockAt(alice.id, 'tea_leaf', t + 6 * HOUR);
  farm.harvest(alice.id, 0, t + 6 * HOUR, always(0));
  assert.equal(stockAt(alice.id, 'tea_leaf', t + 6 * HOUR), had + 12, '10 phần cơ bản + 20% nhờ tưới');
  const lot = store.db.prepare("SELECT cost FROM lots WHERE user_id = ? AND commodity = 'tea_leaf' ORDER BY id DESC").get(alice.id);
  assert.ok(lot.cost > 0, 'thu hoạch mang giá vốn hạt giống');
});

test('bếp: nấu món đã biết, ghép đúng thì khám phá món ẩn, ghép sai không mất nguyên liệu', () => {
  const t = T0 + 9 * HOUR;
  refresh(alice.petId, t);
  for (const c of ['dried_tea', 'milk', 'pearl', 'sugar']) market.addGoods(alice.id, c, 10, t);
  farm.cook(alice.id, { recipe: 'home_milk_tea' }, t, always(0.9));
  assert.equal(stockAt(alice.id, 'milk', t), 9);
  assert.throws(() => farm.cook(alice.id, { inputs: { milk: 3 } }, t), /chưa ra món/);
  assert.equal(stockAt(alice.id, 'milk', t), 9, 'ghép sai không mất nguyên liệu');
  assert.throws(() => farm.cook(alice.id, { recipe: 'tea_jelly' }, t), /chưa biết/);
  const found = farm.cook(alice.id, { inputs: { dried_tea: 2, sugar: 1 } }, t, always(0.9));
  assert.match(found.message, /Khám phá/);
  const kitchen = farm.kitchenView(alice.id, t);
  assert.ok(kitchen.recipes.tea_jelly, 'món ẩn hiện ra sau khi khám phá');
  assert.equal(kitchen.dishes.length, 2);

  store.savePet({ ...store.getPet(alice.petId), fullness: 40 });
  const tea = kitchen.dishes.find((d) => d.recipe === 'home_milk_tea');
  farm.eatDish(alice.id, tea.id, alice.petId, t);
  assert.ok(store.getPet(alice.petId).fullness > 60);
  const jelly = kitchen.dishes.find((d) => d.recipe === 'tea_jelly');
  const before = coins(alice.id);
  farm.sellDishToNpc(alice.id, jelly.id, t);
  assert.equal(coins(alice.id), before + jelly.npcPrice);
});

let factoryId;

test('xưởng: chủ đứng máy chế biến kho của mình, thuê công nhân, gia công thuê cho người khác', () => {
  let t = T0 + 10 * HOUR;
  const before = coins(alice.id);
  factory.buildFactory(alice.id, 'dryer', t);
  assert.ok(coins(alice.id) < before);
  factoryId = factory.factoryView(alice.id, t).factories[0].id;
  const teaHad = stockAt(alice.id, 'tea_leaf', t);
  const dryHad = stockAt(alice.id, 'dried_tea', t);
  market.removeGoods(alice.id, 'tea_leaf', teaHad, t);
  market.addGoods(alice.id, 'tea_leaf', 200, t, { cost: 1 });

  refresh(alice.petId, t);
  jobs.startShift(alice.id, { petId: alice.petId, hours: 2, factoryId }, t);
  t += 2 * HOUR;
  const view = factory.factoryView(alice.id, t);
  assert.equal(stockAt(alice.id, 'tea_leaf', t), 0, 'hết nguyên liệu: 10 mẻ × 2 lô');
  assert.equal(stockAt(alice.id, 'dried_tea', t), dryHad + 100);
  assert.equal(view.factories[0].days.at(-1).batches, 10);
  const lot = store.db.prepare("SELECT cost FROM lots WHERE user_id = ? AND commodity = 'dried_tea' ORDER BY id DESC").get(alice.id);
  assert.ok(Math.abs(lot.cost - 2) < 1e-9, 'giá vốn = 200 xu lá trà / 100 phần trà khô');

  // Thuê bob đứng máy, nhận gia công cho carol.
  factory.setFactoryJobs(alice.id, factoryId, { wage: 10, slots: 1, open: true });
  factory.setToll(alice.id, factoryId, { fee: 5, open: true }, t);
  assert.equal(jobs.jobsView(bob.id, t).factoryJobs.length, 1);
  market.addGoods(carol.id, 'tea_leaf', 40, t);
  const carolCoins = coins(carol.id);
  factory.orderToll(carol.id, factoryId, 2, t);
  assert.equal(coins(carol.id), carolCoins - 10);
  assert.equal(stockAt(carol.id, 'tea_leaf', t), 0, 'nguyên liệu gửi đi ngay');

  refresh(bob.petId, t);
  const aliceCoins = coins(alice.id);
  jobs.startShift(bob.id, { petId: bob.petId, hours: 1, factoryId }, t);
  assert.equal(coins(alice.id), aliceCoins - 10, 'lương giữ trước từ ví chủ xưởng');
  t += HOUR;
  factory.syncFactories(alice.id, t);
  assert.equal(stockAt(carol.id, 'dried_tea', t), 20, 'carol nhận 2 lô trà khô');
  assert.equal(coins(alice.id), aliceCoins - 10 + 10, 'chủ xưởng nhận phí gia công');
  const shift = jobs.jobsView(bob.id, t).shifts[0];
  const bobCoins = coins(bob.id);
  const strength = store.skillsOf(bob.petId).strength;
  jobs.claimShift(bob.id, shift.id, t);
  assert.equal(coins(bob.id), bobCoins + 10);
  assert.ok(store.skillsOf(bob.petId).strength > strength);
});

test('hợp đồng cung ứng: ký quỹ, giao mỗi đêm, giao thiếu thì bồi thường, xong thì hoàn ký quỹ', () => {
  const t = T0 + 13 * HOUR + 30 * 60_000; // 23 giờ 30 thứ Hai
  const price = Math.round(market.currentPrices().dried_tea);
  assert.throws(() => contracts.propose(alice.id, { counterpart: 'bob', role: 'sell', commodity: 'dried_tea', lots: 3, price: price * 5, days: 3 }, t), /Giá/);
  assert.throws(() => contracts.propose(alice.id, { counterpart: 'alice', role: 'sell', commodity: 'dried_tea', lots: 3, price, days: 3 }, t), GameError);
  const aliceBefore = coins(alice.id);
  contracts.propose(alice.id, { counterpart: 'bob', role: 'sell', commodity: 'dried_tea', lots: 3, price, days: 3 }, t);
  const sellerEscrow = Math.round(3 * price * 3 * CONTRACTS.sellerEscrow);
  assert.equal(coins(alice.id), aliceBefore - sellerEscrow);
  const id = contracts.contractsView(bob.id, t).contracts[0].id;
  assert.throws(() => contracts.acceptContract(alice.id, id, t), GameError, 'bên đề xuất không tự nhận');
  const bobBefore = coins(bob.id);
  contracts.acceptContract(bob.id, id, t);
  assert.equal(coins(bob.id), bobBefore - 3 * price);
  const scoreBefore = store.getUser(alice.id).credit;

  // Đêm thứ Hai: giao đủ 3 lô.
  runDue(T0 + 15 * HOUR);
  assert.equal(stockAt(bob.id, 'dried_tea', T0 + 15 * HOUR), 30);
  assert.equal(store.getUser(alice.id).credit, scoreBefore + CREDIT.contractDay);

  // Đêm thứ Ba: alice chỉ còn 1 lô → giao thiếu 2 lô, bồi thường cho bob.
  const t2 = T0 + 20 * HOUR;
  const left = stockAt(alice.id, 'dried_tea', t2);
  market.removeGoods(alice.id, 'dried_tea', left - 10, t2);
  const bobMid = coins(bob.id);
  const compSoFar = comp(bob.id);
  runDue(T0 + 39 * HOUR);
  const penalty = comp(bob.id) - compSoFar;
  assert.ok(penalty >= shortfallPenalty(2, price, 0), `bồi thường ${penalty}`);
  assert.equal(coins(bob.id), bobMid - price + penalty, 'bob trả 1 lô và nhận bồi thường 2 lô');
  assert.equal(stockAt(bob.id, 'dried_tea', T0 + 39 * HOUR), 40);

  // Đêm thứ Tư: hết hạn hợp đồng, ký quỹ còn lại về hai bên, quỹ hợp đồng về 0.
  runDue(T0 + 63 * HOUR);
  const c = contracts.contractsView(alice.id, T0 + 63 * HOUR).contracts.find((x) => x.id === id);
  assert.equal(c.status, 'done');
  assert.equal(store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(`contract:${id}`).balance, 0);
});

test('hợp đồng: bên đề xuất rút lại hoặc để quá hạn thì được hoàn ký quỹ', () => {
  const t = T0 + 64 * HOUR;
  const price = Math.round(market.currentPrices().sugar);
  const before = coins(bob.id);
  contracts.propose(bob.id, { counterpart: 'carol', role: 'buy', commodity: 'sugar', lots: 1, price, days: 3 }, t);
  assert.equal(coins(bob.id), before - price);
  const id = contracts.contractsView(bob.id, t).contracts.find((c) => c.status === 'proposed').id;
  contracts.declineContract(bob.id, id, t);
  assert.equal(coins(bob.id), before);
  contracts.propose(bob.id, { counterpart: 'carol', role: 'buy', commodity: 'sugar', lots: 1, price, days: 3 }, t);
  runDue(t + CONTRACTS.proposalHours * HOUR + DAY);
  assert.equal(coins(bob.id), before, 'đề xuất quá hạn được hoàn ký quỹ');
  assert.equal(contracts.contractsView(bob.id, t + 3 * DAY).contracts.filter((c) => c.status === 'proposed').length, 0);

  // Phá hợp đồng đang chạy: bên kia nhận 10% giá trị phần còn lại, ký quỹ dư về bên phá, −30 điểm.
  const t2 = t + 3 * DAY;
  const sugar = Math.round(market.currentPrices().sugar);
  contracts.propose(bob.id, { counterpart: 'carol', role: 'buy', commodity: 'sugar', lots: 2, price: sugar, days: 10 }, t2);
  const active = contracts.contractsView(carol.id, t2).contracts.find((c) => c.status === 'proposed');
  contracts.acceptContract(carol.id, active.id, t2);
  const bobBefore = coins(bob.id);
  const carolBefore = coins(carol.id);
  const score = store.getUser(bob.id).credit;
  const sellerEscrow = Math.round(2 * sugar * 10 * CONTRACTS.sellerEscrow);
  contracts.breakContract(bob.id, active.id, t2);
  const comp = Math.min(2 * sugar, Math.round(10 * 2 * sugar * CONTRACTS.breakShare));
  assert.equal(coins(carol.id), carolBefore + comp + sellerEscrow);
  assert.equal(coins(bob.id), bobBefore + 2 * sugar - comp);
  assert.equal(store.getUser(bob.id).credit, score + CREDIT.contractBroken);
});

test('Chợ Phiên: bày bán có phí, người mua trả đủ, người bán nhận sau phí; đồ dùng mãi mãi chỉ có 1', () => {
  const t = T0 + 6 * DAY;
  store.addItem(alice.id, 'ball', 2);
  const view = bazaar.bazaarView(alice.id, t);
  const ref = view.sellable.items.find((i) => i.ref === 'ball').refPrice;
  assert.throws(() => bazaar.listForSale(alice.id, { kind: 'item', ref: 'ball', price: ref * 10 }, t), /Giá/);
  const before = coins(alice.id);
  bazaar.listForSale(alice.id, { kind: 'item', ref: 'ball', price: ref }, t);
  bazaar.listForSale(alice.id, { kind: 'item', ref: 'ball', price: ref }, t);
  assert.ok(coins(alice.id) < before, 'phí đăng tin');
  const listings = bazaar.bazaarView(bob.id, t).listings.filter((l) => l.ref === 'ball');
  assert.equal(listings.length, 2);
  const bobBefore = coins(bob.id);
  const aliceBefore = coins(alice.id);
  bazaar.buyListing(bob.id, listings[0].id, t);
  assert.equal(coins(bob.id), bobBefore - ref);
  assert.equal(coins(alice.id), aliceBefore + ref - Math.max(1, Math.round(ref * 0.05)));
  assert.equal(store.inventory(bob.id).ball, 1);
  assert.throws(() => bazaar.buyListing(bob.id, listings[1].id, t), /dùng mãi mãi/);
  assert.throws(() => bazaar.buyListing(alice.id, listings[1].id, t), /bạn đang bán/);

  // Tin còn lại hết hạn sau 48 giờ: bóng về lại túi alice.
  bazaar.expireListings(t + 49 * HOUR);
  assert.equal(store.inventory(alice.id).ball, 1);
});

test('vay: trả góp đúng hạn thì lên điểm; không trả được thì trễ hạn rồi vỡ nợ, bị cấm vay', () => {
  let t = T0 + 8 * DAY + 2 * HOUR;
  runDue(t);
  assert.throws(() => credit.borrow(alice.id, 100, 3, t), /nâng cao/);
  store.setAdvanced(alice.id, true);
  post({ userId: alice.id, delta: 1000, kind: 'salary', memo: 'lương giả lập', now: t - HOUR });
  const view = credit.creditView(alice.id, t);
  assert.ok(view.limit >= 100, `hạn mức ${view.limit}`);
  assert.throws(() => credit.borrow(alice.id, view.limit + 1, 3, t), /Hạn mức/);
  const before = coins(alice.id);
  const score = store.getUser(alice.id).credit;
  credit.borrow(alice.id, 100, 3, t);
  assert.equal(coins(alice.id), before + 100 - Math.ceil(100 * LOANS.originationFee));
  t += 3 * DAY;
  runDue(t);
  assert.equal(credit.creditView(alice.id, t).loans.length, 0, 'đã trả hết sau 3 kỳ');
  assert.ok(store.getUser(alice.id).credit >= score + 3 * CREDIT.onTime + CREDIT.repaid - 1);

  // carol vay rồi tiêu sạch tiền: trễ 7 kỳ thì vỡ nợ.
  store.setAdvanced(carol.id, true);
  post({ userId: carol.id, delta: 700, kind: 'salary', memo: 'lương giả lập', now: t - HOUR });
  credit.borrow(carol.id, 200, 3, t);
  post({ userId: carol.id, delta: -coins(carol.id), kind: 'shop', memo: 'tiêu hết', now: t });
  const carolScore = store.getUser(carol.id).credit;
  runDue(t + DAY);
  assert.equal(credit.creditView(carol.id, t + DAY).loans[0].status, 'late');
  assert.equal(store.getUser(carol.id).credit, carolScore + CREDIT.late);
  runDue(t + (LOANS.defaultAfter + 1) * DAY);
  const loan = credit.creditView(carol.id, t + (LOANS.defaultAfter + 1) * DAY);
  assert.equal(loan.loans[0].status, 'defaulted');
  assert.ok(loan.banUntil > t);
  assert.throws(() => credit.borrow(carol.id, 50, 3, t + (LOANS.defaultAfter + 1) * DAY), GameError);

  // Có thu nhập lại thì ngân hàng giữ 30% để thu nợ; trả hết bằng tay cũng được.
  const owed = loan.loans[0].payoff;
  post({ userId: carol.id, delta: owed + 50, kind: 'salary', memo: 'lương giả lập', now: t + (LOANS.defaultAfter + 1) * DAY + HOUR });
  credit.repay(carol.id, loan.loans[0].id, owed, t + (LOANS.defaultAfter + 1) * DAY + 2 * HOUR);
  assert.equal(credit.creditView(carol.id, t + (LOANS.defaultAfter + 1) * DAY + 3 * HOUR).loans.length, 0);
});

test('sổ cái giai đoạn 2: ví, tiết kiệm và mọi tài khoản chung khớp từng xu', () => {
  const sum = store.db.prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE user_id = ? AND account = ?');
  for (const { id } of [alice, bob, carol]) {
    assert.equal(sum.get(id, 'wallet').s, coins(id), `ví của #${id}`);
    const savings = store.db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?').get(id)?.savings ?? 0;
    assert.equal(sum.get(id, 'savings').s, savings);
  }
  const byAccount = store.db.prepare("SELECT account, SUM(delta) AS s FROM ledger WHERE account NOT IN ('wallet', 'savings') GROUP BY account").all();
  for (const row of byAccount) {
    assert.equal(store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(row.account).balance, row.s, row.account);
  }
  const contractsLeft = store.db.prepare("SELECT COALESCE(SUM(buyer_escrow + seller_escrow), 0) AS s FROM contracts WHERE status IN ('proposed', 'active')").get().s;
  const contractAccounts = store.db.prepare("SELECT COALESCE(SUM(balance), 0) AS s FROM accounts WHERE id LIKE 'contract:%'").get().s;
  assert.equal(contractAccounts, contractsLeft, 'quỹ hợp đồng khớp số ký quỹ đang giữ');
});
