// Kiểm thử tích hợp giai đoạn 1B trên DB tạm: quầy, thuê người, thuế, bỏ phiếu, bạn bè, Hội, nhiệm vụ.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, GameError, HOUR } = await import('../server/game.js');
const { post, treasuryBalance } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const jobs = await import('../server/jobs.js');
const market = await import('../server/market.js');
const business = await import('../server/business.js');
const town = await import('../server/town.js');
const social = await import('../server/social.js');
const quests = await import('../server/quests.js');

const T0 = Date.parse('2026-11-02T03:00:00Z'); // 10 giờ sáng thứ Hai, giờ Việt Nam
const coins = (id) => store.getUser(id).coins;
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY); // loài lạ, tuổi Trưởng thành: số liệu trung tính
  store.savePet({ ...store.getPet(petId), level: 6, fullness: 95, energy: 100, updated_at: T0 });
  for (const skill of ['strength', 'agility', 'intellect', 'charm', 'craft']) store.setSkill(petId, skill, 20);
  store.setActivePet(id, petId);
  return { id, petId };
}

migrate(T0);
runDue(T0, rand);
const owner = newPlayer('chuquay', 20_000);
const worker = newPlayer('lamthue', 500);
const friend = newPlayer('banbe', 3_000);

test('quầy: mở quầy, nhập hàng, bé trực giờ cao điểm thì bán được, trừ nguyên liệu, có thuế doanh thu', () => {
  const before = coins(owner.id);
  business.openBusiness(owner.id, { name: 'Trà Sữa Rái Cá', location: 'alley' }, T0);
  assert.equal(coins(owner.id), before - 1500);
  assert.throws(() => business.openBusiness(owner.id, { name: 'Quầy hai', location: 'alley' }, T0), GameError);

  for (const c of ['dried_tea', 'milk', 'pearl', 'sugar']) {
    market.placeOrder(owner.id, { commodity: c, side: 'buy', qty: 20, type: 'market' }, T0);
  }
  jobs.startShift(owner.id, { petId: owner.petId, hours: 2, businessId: business.businessOf(owner.id).id }, T0 + HOUR);
  const coinsBefore = coins(owner.id);
  const view = business.businessView(owner.id, T0 + 3 * HOUR);
  const today = view.business.today;
  assert.ok(today.cups > 0, 'giờ cao điểm phải bán được ly nào đó');
  assert.equal(today.revenue, today.cups * 22);
  assert.ok(coins(owner.id) > coinsBefore);
  assert.equal(market.stock(owner.id, T0 + 3 * HOUR).milk, 20 - today.cups);
  assert.equal(today.tax, Math.round(today.revenue * 0.03));
});

test('quầy: tuyển người, lương giữ trước từ ví chủ, xong ca người làm thuê nhận đủ', () => {
  const t = T0 + 4 * HOUR;
  const biz = business.businessOf(owner.id);
  business.setJobPost(owner.id, { wage: 20, slots: 1, open: true }, t);
  assert.equal(business.openJobs(worker.id, t).length, 1);
  const ownerBefore = coins(owner.id);
  const workerBefore = coins(worker.id);
  jobs.startShift(worker.id, { petId: worker.petId, hours: 2, businessId: biz.id }, t);
  assert.equal(coins(owner.id), ownerBefore - 40);
  assert.equal(business.openJobs(friend.id, t).length, 0, 'hết chỗ tuyển');
  const [shift] = jobs.jobsView(worker.id, t + 2 * HOUR).shifts;
  jobs.claimShift(worker.id, shift.id, t + 2 * HOUR);
  assert.equal(coins(worker.id), workerBefore + 40);
});

test('quầy: thực đơn kiểm tra số món và giá', () => {
  assert.throws(() => business.setMenu(owner.id, [{ recipe: 'boba_milk_tea', price: 22 }, { recipe: 'milk_tea', price: 18 }, { recipe: 'strawberry_tea', price: 21 }], T0 + 7 * HOUR), GameError);
  assert.throws(() => business.setMenu(owner.id, [{ recipe: 'boba_milk_tea', price: 999 }], T0 + 7 * HOUR), GameError);
  business.setMenu(owner.id, [{ recipe: 'boba_milk_tea', price: 24 }, { recipe: 'brown_sugar_milk', price: 14 }], T0 + 7 * HOUR);
  assert.equal(business.businessOf(owner.id).menu.length, 2);
});

test('bạn bè: kết bạn, thả tim một lần mỗi ngày, tặng quà có giới hạn', () => {
  social.requestFriend(owner.id, 'banbe', T0);
  assert.throws(() => social.likeFriend(owner.id, friend.id, T0), GameError, 'chưa đồng ý thì chưa là bạn');
  social.acceptFriend(friend.id, owner.id, T0);
  assert.equal(social.friendsView(owner.id, T0).friends.length, 1);
  social.likeFriend(owner.id, friend.id, T0);
  assert.throws(() => social.likeFriend(owner.id, friend.id, T0 + HOUR), GameError);
  store.addItem(owner.id, 'boba', 6);
  for (let i = 0; i < 5; i++) social.giftFriend(owner.id, friend.id, 'boba', T0);
  assert.throws(() => social.giftFriend(owner.id, friend.id, 'boba', T0), GameError);
  assert.equal(store.inventory(friend.id).boba, 5);
});

test('Hội: lập, gia nhập, góp quỹ, nâng cấp, dự án tuần xong thì có danh vọng và thưởng', () => {
  social.createGuild(owner.id, { name: 'Hội Trân Châu', emblem: '🧋' }, T0);
  const { guild } = social.guildView(owner.id, T0);
  social.joinGuild(friend.id, guild.id, T0);
  social.donate(friend.id, 2600, T0);
  assert.throws(() => social.upgradeGuild(friend.id, 'sign', T0), GameError, 'chỉ trưởng Hội');
  social.upgradeGuild(owner.id, 'sign', T0);
  assert.equal(social.guildView(owner.id, T0).guild.upgrades.sign.level, 1);

  const project = social.guildView(owner.id, T0).guild.project;
  for (const [c, lots] of Object.entries(project.needs)) {
    market.placeOrder(owner.id, { commodity: c, side: 'buy', qty: lots * 10, type: 'market' }, T0);
    social.contribute(owner.id, c, lots * 10, T0);
  }
  const after = social.guildView(owner.id, T0).guild;
  assert.equal(after.project.done, true);
  assert.equal(after.prestige, project.prestige);
});

test('nhiệm vụ ngày: báo tiến độ, nhận thưởng, đủ 3 thì mở rương', () => {
  const t = T0 + 8 * HOUR;
  const view = quests.questsView(worker.id, t);
  assert.equal(view.quests.length, 3);
  for (const qst of view.quests) quests.track(worker.id, qst.id, qst.goal, t);
  assert.throws(() => quests.claimQuest(worker.id, -1, t), GameError, 'chưa nhận hết thì chưa mở rương');
  for (const qst of view.quests) quests.claimQuest(worker.id, qst.slot, t);
  const before = coins(worker.id);
  quests.claimQuest(worker.id, -1, t);
  assert.equal(coins(worker.id), before + 50);
});

test('quyết toán: tiền thuê, thuế thu nhập; Chủ nhật đóng phiên bầu và chi ngân sách', () => {
  town.vote(owner.id, town.townView(owner.id, T0).proposals[0].option, T0);
  const option = town.townView(owner.id, T0).proposals[0].option;
  const treasuryBefore = treasuryBalance();
  runDue(T0 + 7 * DAY, rand); // qua hết Chủ nhật
  const days = business.businessView(owner.id, T0 + 7 * DAY).business.days;
  assert.ok(days.some((d) => d.rent === 40), 'mỗi đêm trừ tiền thuê');
  const view = town.townView(owner.id, T0 + 7 * DAY);
  const result = view.history.find((h) => h.option === option);
  assert.equal(result?.status, 'funded');
  assert.ok(treasuryBalance() < treasuryBefore + 5000);
  assert.ok(view.taxes.length > 0 || view.taxDue >= 0);
});

test('sổ cái khớp từng xu cho người chơi, ngân sách và quỹ Hội', () => {
  const sum = store.db.prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE user_id = ? AND account = ?');
  for (const { id } of [owner, worker, friend]) assert.equal(sum.get(id, 'wallet').s, coins(id));
  const byAccount = store.db.prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE account = ?');
  for (const acc of store.db.prepare('SELECT id, balance FROM accounts').all()) {
    assert.equal(byAccount.get(acc.id).s, acc.balance, acc.id);
  }
});
