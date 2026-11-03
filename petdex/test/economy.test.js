// Kiểm thử tích hợp trên DB tạm trong RAM: chạy các hệ thống kinh tế với đồng hồ giả rồi đối soát sổ cái.
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
const bank = await import('../server/bank.js');
const games = await import('../server/minigames.js');
const wallet = await import('../server/wallet.js');
const { fishSequence } = await import('../../public/ta-tua/game/js/shared/minigames.js');

const T0 = Date.parse('2026-11-02T03:00:00Z'); // 10 giờ sáng thứ Hai, giờ Việt Nam
const coins = (userId) => store.getUser(userId).coins;

function newPlayer(name, money = 2000) {
  const id = store.createUser(name, 'x', T0);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY); // loài lạ, tuổi Trưởng thành: số liệu trung tính
  store.savePet({ ...store.getPet(petId), fullness: 90, energy: 100, updated_at: T0 });
  for (const skill of ['strength', 'agility', 'intellect', 'charm', 'craft']) store.setSkill(petId, skill, 10);
  store.setActivePet(id, petId);
  return { id, petId };
}

migrate(T0);
runDue(T0);
const alice = newPlayer('alice');
const bob = newPlayer('bob');

test('ca làm: bé bận trong ca, xong ca mới nhận lương, lên kỹ năng', () => {
  const before = coins(alice.id);
  jobs.startShift(alice.id, { petId: alice.petId, career: 'porter', hours: 2 }, T0);
  assert.throws(() => jobs.startShift(alice.id, { petId: alice.petId, career: 'tutor', hours: 1 }, T0 + HOUR), GameError);
  const [shift] = jobs.jobsView(alice.id, T0 + HOUR).shifts;
  assert.equal(shift.ready, false);
  assert.throws(() => jobs.claimShift(alice.id, shift.id, T0 + HOUR), GameError);
  const result = jobs.claimShift(alice.id, shift.id, T0 + 2 * HOUR);
  assert.equal(coins(alice.id), before + shift.pay);
  assert.ok(result.skill.gain > 0);
  assert.throws(() => jobs.claimShift(alice.id, shift.id, T0 + 3 * HOUR), GameError);
  assert.equal(jobs.jobsView(alice.id, T0 + 2 * HOUR).pets[0].careers.porter.hours, 2);
});

test('Sàn: mua bán với NPC, phí, tác động giá, hàng tươi bị hư', () => {
  const t = T0 + 3 * HOUR;
  const price0 = market.currentPrices().milk;
  const before = coins(alice.id);
  const buy = market.placeOrder(alice.id, { commodity: 'milk', side: 'buy', qty: 25, type: 'market' }, t);
  assert.equal(buy.filled, 25);
  assert.equal(coins(alice.id), before - buy.amount - buy.fee);
  assert.ok(market.currentPrices().milk > price0);
  assert.equal(market.marketView(alice.id, t).holdings.milk.qty, 25);

  // Giá vốn bình quân = tiền mua + phí, tính theo lô; lãi/lỗ tạm tính theo giá bán ngay cho NPC.
  const held = market.marketView(alice.id, t).holdings.milk;
  assert.ok(Math.abs(held.avgCost * 2.5 - (buy.amount + buy.fee)) <= 1, `vốn ${held.avgCost}`); // phí làm tròn tới xu
  assert.ok(held.pnl < 0, 'vừa mua xong bán ngay thì lỗ chênh lệch mua/bán và phí');
  assert.equal(held.pnl, held.value - held.basis);

  const sell = market.placeOrder(alice.id, { commodity: 'milk', side: 'sell', qty: 10, type: 'market' }, t);
  assert.equal(sell.filled, 10);
  assert.ok(sell.profit && sell.profit.pnl < 0 && sell.profit.pct < 0);
  assert.match(sell.message, /Lỗ −\d+ 🪙 \(−[\d,]+% so với giá vốn\)/);
  const view = market.marketView(alice.id, t);
  assert.equal(view.holdings.milk.qty, 15);
  assert.deepEqual(view.book.trades.map((x) => x.side), ['sell', 'buy']);
  assert.equal(view.book.today.sells, 1);
  assert.equal(view.book.today.pnl, view.book.trades[0].pnl);
  assert.throws(() => market.placeOrder(alice.id, { commodity: 'milk', side: 'sell', qty: 50, type: 'market' }, t), GameError);

  // Bán hết thì kho về 0 (mặt hàng biến khỏi kho), không còn gì để bán thêm.
  const pork = market.placeOrder(alice.id, { commodity: 'pork', side: 'buy', qty: 20, type: 'market' }, t);
  assert.equal(pork.filled, 20);
  market.placeOrder(alice.id, { commodity: 'pork', side: 'sell', qty: 20, type: 'market' }, t);
  assert.equal(market.marketView(alice.id, t).holdings.pork, undefined);
  assert.equal(market.stock(alice.id, t).pork, undefined);
  assert.throws(() => market.placeOrder(alice.id, { commodity: 'pork', side: 'sell', qty: 10, type: 'market' }, t), GameError);
  // Lệnh bán chờ giữ hàng khỏi kho; hủy lệnh thì hàng về lại.
  market.placeOrder(alice.id, { commodity: 'pork', side: 'buy', qty: 10, type: 'market' }, t);
  const ask = market.currentPrices().pork;
  const wait = market.placeOrder(alice.id, { commodity: 'pork', side: 'sell', qty: 10, type: 'limit', limit: ask * 1.14 }, t);
  assert.ok(wait.orderId);
  assert.equal(market.stock(alice.id, t).pork, undefined);
  market.cancelOrder(alice.id, wait.orderId, t);
  assert.equal(market.stock(alice.id, t).pork, 10);

  // Thịt để 1,2 ngày (60% hạn dùng) thành Kém tươi: NPC chỉ trả 80% giá; quá hạn thì hư.
  const stale = market.marketView(alice.id, t + 1.2 * DAY).holdings.pork;
  assert.equal(stale.lots[0].freshness, 'stale');
  assert.ok(Math.abs(stale.quality - 0.8) < 1e-9);
  const bid = market.marketView(alice.id, t + 1.2 * DAY).commodities.find((c) => c.id === 'pork').bid;
  const old = market.placeOrder(alice.id, { commodity: 'pork', side: 'sell', qty: 10, type: 'market' }, t + 1.2 * DAY);
  assert.match(old.message, /NPC chỉ trả 80% giá/);
  assert.ok(old.amount < bid * 0.81, `bán ${old.amount} với giá NPC ${bid}`);

  const later = market.marketView(alice.id, t + 4 * DAY);
  assert.equal(later.holdings.milk, undefined);
  assert.deepEqual(later.spoiled.map((s) => s.commodity), ['milk']);
});

test('Sàn: hạn mức NPC chung của thị trấn chặn việc dùng nhiều tài khoản để gom hàng', async () => {
  const { MARKET, townNpcLots } = await import('../server/rules/market.js');
  assert.equal(townNpcLots('cassava', 3), MARKET.townBaseLots);
  assert.equal(townNpcLots('cassava', 40), 40 * MARKET.townLotsPerTrader);
  assert.equal(townNpcLots('pearl', 3), MARKET.townBaseLots * MARKET.processedDepth);
  assert.ok(MARKET.townLotsPerTrader < MARKET.npcDailyLots, 'tài khoản phụ nới hạn mức chung ít hơn phần riêng của nó');

  const t = T0 + 2 * DAY + 5 * HOUR; // một ngày chưa ai mua sắn
  const alts = Array.from({ length: 9 }, (_, i) => newPlayer(`gom_san_${i}`, 5000));
  const view = market.marketView(alts[0].id, t).commodities.find((c) => c.id === 'cassava');
  assert.equal(view.town.buy.total, MARKET.townBaseLots * 10);
  const bought = [];
  for (const alt of alts) {
    try {
      bought.push(market.placeOrder(alt.id, { commodity: 'cassava', side: 'buy', qty: MARKET.npcDailyLots * 10, type: 'market' }, t).filled);
    } catch (err) {
      assert.match(err.message, /hạn mức chung của cả thị trấn/);
      bought.push(0);
    }
  }
  assert.equal(bought.reduce((a, b) => a + b, 0), MARKET.townBaseLots * 10, 'cả thị trấn không mua quá hạn mức chung');
  assert.deepEqual(bought.slice(0, 7), Array(7).fill(400));
  assert.equal(bought[7], 200);
  assert.equal(bought[8], 0);
  const after = market.marketView(alts[8].id, t).commodities.find((c) => c.id === 'cassava');
  assert.equal(after.town.buy.left, 0);
  assert.equal(after.ownLeft.buy, 400);
  assert.equal(after.npcLeft.buy, 0);
  // Chiều bán và ngày hôm sau không bị ảnh hưởng.
  assert.ok(after.town.sell.left > 0);
  assert.equal(market.marketView(alts[8].id, t + DAY).commodities.find((c) => c.id === 'cassava').town.buy.left, view.town.buy.total);
});

test('Sàn: lệnh giới hạn ký quỹ, hủy thì hoàn; lệnh của người chơi khớp với nhau', () => {
  const t = T0 + 4 * HOUR;
  const price = market.currentPrices().sugar;
  const before = coins(alice.id);
  const low = market.placeOrder(alice.id, { commodity: 'sugar', side: 'buy', qty: 20, type: 'limit', limit: price * 0.9 }, t);
  assert.ok(low.orderId);
  assert.ok(coins(alice.id) < before);
  assert.throws(() => market.placeOrder(alice.id, { commodity: 'sugar', side: 'buy', qty: 20, type: 'limit', limit: price * 0.5 }, t), GameError);
  market.cancelOrder(alice.id, low.orderId, t);
  assert.equal(coins(alice.id), before);

  market.placeOrder(bob.id, { commodity: 'sugar', side: 'buy', qty: 30, type: 'market' }, t);
  const ask = market.currentPrices().sugar;
  const rest = market.placeOrder(bob.id, { commodity: 'sugar', side: 'sell', qty: 20, type: 'limit', limit: ask }, t);
  assert.ok(rest.orderId);
  const bobBefore = coins(bob.id);
  const take = market.placeOrder(alice.id, { commodity: 'sugar', side: 'buy', qty: 20, type: 'market' }, t);
  assert.equal(take.filled, 20);
  assert.ok(coins(bob.id) > bobBefore);
  assert.equal(market.marketView(bob.id, t).orders.length, 0);
});

test('ngân hàng: tiết kiệm có lãi, kỳ hạn tự tất toán, Ngân hàng Trung ương họp tuần', () => {
  const t = T0 + 5 * HOUR;
  bank.moveSavings(bob.id, 'deposit', 500, t);
  bank.moveSavings(bob.id, 'withdraw', 100, t);
  assert.throws(() => bank.moveSavings(bob.id, 'withdraw', 10_000, t), GameError);
  bank.openDeposit(bob.id, 200, 7, t);
  const before = coins(bob.id);

  runDue(T0 + 8 * DAY);
  const view = bank.bankView(bob.id, T0 + 8 * DAY);
  assert.ok(view.savings > 400, `tiết kiệm ${view.savings}`);
  assert.equal(view.deposits.length, 0);
  assert.ok(coins(bob.id) > before + 200, 'kỳ hạn trả gốc và lãi về ví');
  assert.ok(view.history.length >= 1, 'đã có phiên họp Ngân hàng Trung ương');
});

test('mini-game: thưởng theo luật chung, chặn gian lận và nộp hai lần', () => {
  const t = T0 + 9 * DAY;
  // Bé bị bỏ mặc 9 ngày nên có thể đã ốm: chăm lại cho khỏe trước khi chơi.
  store.savePet({ ...store.getPet(alice.petId), fullness: 90, energy: 100, hygiene: 90, health: 90, sick: null, updated_at: t });
  const session = games.startGame(alice.id, 'fishing', t);
  const casts = fishSequence(session.seed).slice(0, 8).map(() => true);
  assert.throws(() => games.finishGame(alice.id, session.id, { caught: casts }, t + 2000), GameError);
  const again = games.startGame(alice.id, 'fishing', t);
  const result = games.finishGame(alice.id, again.id, { caught: casts }, t + 20_000);
  assert.ok(result.portions.fish > 0);
  assert.throws(() => games.finishGame(alice.id, again.id, { caught: casts }, t + 21_000), GameError);
});

test('sổ cái khớp từng xu với số dư, báo cáo phân loại đúng', () => {
  const sum = store.db.prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE user_id = ? AND account = ?');
  for (const { id } of [alice, bob]) {
    assert.equal(sum.get(id, 'wallet').s, coins(id));
    const savings = store.db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?').get(id)?.savings ?? 0;
    assert.equal(sum.get(id, 'savings').s, savings);
  }
  const treasury = store.db.prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE account = 'treasury'").get().s;
  assert.equal(treasury, store.db.prepare("SELECT balance FROM accounts WHERE id = 'treasury'").get()?.balance ?? 0);

  const report = wallet.report(alice.id, 30, T0 + 9 * DAY + HOUR);
  const kinds = (list) => list.map((r) => r.kind);
  assert.ok(kinds(report.income).includes('salary'));
  assert.ok(kinds(report.income).includes('market_sell'));
  assert.ok(kinds(report.expense).includes('market_buy'));
  assert.ok(kinds(report.expense).includes('fee'));
  assert.ok(wallet.netWorth(alice.id, T0 + 9 * DAY).total > 0);
});
