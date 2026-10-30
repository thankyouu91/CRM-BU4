// Kiểm thử vay ngang hàng (ngân hàng trung gian giữ 10–20% tiền lãi) và hụi bỏ thăm (người chơi, gia tộc) trên DB tạm.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post, treasuryBalance } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const { dayKey } = await import('../server/clock.js');
const p2p = await import('../server/p2p.js');
const hui = await import('../server/hui.js');
const clans = await import('../server/clans.js');
const wallet = await import('../server/wallet.js');
const { P2P, pickWinner, p2pCut, splitPot, splitRepayment } = await import('../server/rules/finance.js');

const T0 = Date.parse('2026-12-02T03:00:00Z'); // 10 giờ sáng giờ Việt Nam
const coins = (id) => store.getUser(id).coins;
const credit = (id) => store.getUser(id).credit;

function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  return id;
}
const setCoins = (id, n) => {
  const d = n - coins(id);
  if (d) post({ userId: id, delta: d, kind: 'admin', now: T0 });
};

migrate(T0);
runDue(T0);

test('luật: phí trung gian 10–20% theo hạng tín dụng; trả gốc trước rồi tới lãi', () => {
  assert.equal(p2pCut(800), 0.1);
  assert.equal(p2pCut(500), 0.2);
  assert.ok(p2pCut(600) > 0.1 && p2pCut(600) < 0.2);
  assert.deepEqual(splitRepayment(1070, { principalLeft: 1000, interestLeft: 70, cut: 0.2 }), { principal: 1000, interest: 70, bank: 14, lender: 1056 });
  assert.deepEqual(splitRepayment(600, { principalLeft: 1000, interestLeft: 70, cut: 0.2 }), { principal: 600, interest: 0, bank: 0, lender: 600 });
});

test('P2P: đăng yêu cầu, người khác rót vốn, đáo hạn tự thu; ngân hàng giữ phần lãi của mình', () => {
  const borrower = newPlayer('nguoi_vay', 500);
  const lender = newPlayer('nguoi_cho_vay', 5000);
  const t = T0 + HOUR;
  assert.throws(() => p2p.requestP2P(borrower, { amount: 50_000, termDays: 7, rate: 0.01 }, t), /Số tiền vay/);
  assert.throws(() => p2p.requestP2P(borrower, { amount: 1000, termDays: 5, rate: 0.01 }, t), /Kỳ hạn/);
  assert.throws(() => p2p.requestP2P(borrower, { amount: 1000, termDays: 7, rate: 0.5 }, t), /Lãi đặt/);
  p2p.requestP2P(borrower, { amount: 1000, termDays: 3, rate: 0.01 }, t);
  const [ask] = p2p.p2pView(lender, t).market;
  assert.equal(ask.amount, 1000);
  assert.equal(ask.cut, 0.2);
  assert.throws(() => p2p.fundP2P(borrower, ask.id, t), /tự cho mình/);
  p2p.fundP2P(lender, ask.id, t);
  assert.equal(coins(borrower), 1500);
  assert.equal(coins(lender), 4000);
  assert.equal(wallet.netWorth(lender, t).parts.lent, 1030);
  assert.equal(wallet.netWorth(borrower, t).parts.debt, -1030);

  const treasury = treasuryBalance();
  p2p.settleP2PDay(dayKey(t + 3 * DAY));
  const loan = p2p.p2pView(borrower, t + 3 * DAY + HOUR).borrowing[0];
  assert.equal(loan.status, 'repaid');
  assert.equal(coins(borrower), 1500 - 1030);
  assert.equal(coins(lender), 4000 + 1000 + 24); // lãi 30, ngân hàng giữ 20% = 6
  assert.equal(treasuryBalance(), treasury + 6);
});

test('P2P: không trả được thì trễ hạn (phí trễ, trừ điểm), trễ 7 ngày là vỡ nợ, bị cấm vay và bị giữ dần tiền', () => {
  const borrower = newPlayer('vay_mat_tich', 100);
  const lender = newPlayer('chu_no', 5000);
  const t = T0 + 2 * HOUR;
  p2p.requestP2P(borrower, { amount: 800, termDays: 3, rate: 0.01 }, t);
  p2p.fundP2P(lender, p2p.p2pView(lender, t).market.find((l) => l.borrower === 'vay_mat_tich').id, t);
  setCoins(borrower, 0); // tiêu hết
  const score = credit(borrower);
  p2p.settleP2PDay(dayKey(t + 3 * DAY));
  let loan = p2p.p2pView(borrower, t + 3 * DAY + HOUR).borrowing[0];
  assert.equal(loan.status, 'late');
  assert.ok(loan.left > 824, 'đã cộng phí trễ');
  assert.ok(credit(borrower) < score);
  assert.throws(() => p2p.requestP2P(borrower, { amount: 300, termDays: 3, rate: 0.01 }, t + 3 * DAY + HOUR), /trễ hạn/);

  for (let d = 4; d <= 10; d++) p2p.settleP2PDay(dayKey(t + d * DAY));
  loan = p2p.p2pView(borrower, t + 10 * DAY + HOUR).borrowing[0];
  assert.equal(loan.status, 'defaulted');
  assert.ok(store.getUser(borrower).loan_ban_until > t + 10 * DAY);
  // Vỡ nợ: mỗi đêm ngân hàng giữ 30% số dư ví trả cho người cho vay.
  setCoins(borrower, 1000);
  const before = coins(lender);
  p2p.settleP2PDay(dayKey(t + 11 * DAY));
  assert.equal(coins(borrower), 1000 - Math.floor(1000 * P2P.garnish));
  assert.equal(coins(lender), before + Math.floor(1000 * P2P.garnish)); // còn đang trả gốc nên chưa có phần ngân hàng
});

test('luật hụi: thăm cao nhất hốt; không ai bỏ thăm thì kỳ đầu chủ hụi, sau đó theo thứ tự vào', () => {
  assert.deepEqual(pickWinner([1, 2, 3], [{ member_id: 2, bid: 30, at: 5 }, { member_id: 3, bid: 30, at: 4 }], 1, 1), { winner: 3, bid: 30 });
  assert.deepEqual(pickWinner([1, 2, 3], [], 1, 1), { winner: 1, bid: 0 });
  assert.deepEqual(pickWinner([2, 3], [], 2, 1), { winner: 2, bid: 0 });
  assert.deepEqual(splitPot(300, 31, 2), { winner: 270, each: 15 });
});

test('hụi người chơi: đủ người thì chạy, mỗi đêm một kỳ, bỏ thăm để hốt sớm; tổng tiền không mất đi đâu', () => {
  const [a, b, c] = ['hui_a', 'hui_b', 'hui_c'].map((n) => newPlayer(n, 1000));
  const t = T0 + 3 * HOUR;
  assert.throws(() => hui.createHui(a, { scope: 'player', name: 'Hụ', amount: 100, size: 3 }, t), /Tên/);
  assert.throws(() => hui.createHui(a, { scope: 'player', name: 'Hụi to', amount: 100, size: 30 }, t), /3–10/);
  hui.createHui(a, { scope: 'player', name: 'Hụi xóm', amount: 100, size: 3 }, t);
  const g = hui.huiView(b, t).open.find((x) => x.name === 'Hụi xóm');
  hui.joinHui(b, g.id, t);
  hui.joinHui(c, g.id, t); // đủ 3 người: bắt đầu
  assert.equal(hui.huiView(a, t).mine[0].status, 'running');
  assert.throws(() => hui.leaveHui(b, g.id, t), /không rời được/);
  assert.throws(() => hui.bidHui(c, g.id, 200, t), /Tiền thăm/);
  hui.bidHui(c, g.id, 30, t);

  hui.settleHuiDay(dayKey(t)); // kỳ 1: c hốt nhờ bỏ thăm
  assert.equal(coins(c), 1000 - 100 + 270);
  assert.equal(coins(a), 1000 - 100 + 15);
  assert.throws(() => hui.bidHui(c, g.id, 10, t + DAY), /đã hốt/);
  hui.settleHuiDay(dayKey(t + DAY)); // kỳ 2: không ai bỏ thăm → a (vào sớm nhất)
  hui.settleHuiDay(dayKey(t + 2 * DAY)); // kỳ 3: b
  const done = hui.huiView(a, t + 2 * DAY + 2 * HOUR).mine.find((x) => x.id === g.id);
  assert.equal(done.status, 'done');
  assert.deepEqual(done.rounds.map((r) => r.winner), ['hui_c', 'hui_a', 'hui_b']);
  assert.equal(coins(a) + coins(b) + coins(c), 3000);
  assert.equal(coins(c), 1000 - 30);
  assert.equal(coins(a), 1000 + 15);
});

test('hụi: tới kỳ không đủ tiền góp thì bị loại, không hoàn tiền, bị trừ tín dụng và cấm chơi hụi', () => {
  const [d, e, f] = ['hui_d', 'hui_e', 'hui_f'].map((n) => newPlayer(n, 1000));
  const t = T0 + 4 * HOUR;
  hui.createHui(d, { scope: 'player', name: 'Hụi rủi ro', amount: 200, size: 3 }, t);
  const id = hui.huiView(e, t).open.find((x) => x.name === 'Hụi rủi ro').id;
  hui.joinHui(e, id, t);
  hui.joinHui(f, id, t);
  hui.settleHuiDay(dayKey(t)); // kỳ 1: d (chủ hụi) hốt 600
  setCoins(e, 50); // e hết tiền
  const score = credit(e);
  hui.settleHuiDay(dayKey(t + DAY)); // kỳ 2: e bị loại, f hốt 400
  const g = hui.huiView(d, t + DAY + HOUR).mine.find((x) => x.id === id);
  const eRow = g.members.find((m) => m.name === 'hui_e');
  assert.equal(eRow.status, 'out');
  assert.equal(eRow.paid, 200); // mất 200 đã góp kỳ 1
  assert.equal(coins(e), 50);
  assert.ok(credit(e) < score);
  assert.throws(() => hui.createHui(e, { scope: 'player', name: 'Hụi mới', amount: 100, size: 3 }, t + DAY + HOUR), /cấm chơi hụi/);
  assert.equal(g.status, 'done'); // còn d, f đều đã hốt
  assert.equal(coins(f), 1000 - 400 + 400);
});

test('hụi lớn gia tộc: tộc trưởng góp bằng quỹ gia tộc; quỹ không đủ thì gia tộc bị loại', () => {
  const t = T0 + 5 * HOUR;
  const leaders = ['toc_1', 'toc_2', 'toc_3'].map((n) => newPlayer(n, 200_000));
  leaders.forEach((id, i) => {
    clans.createClan(id, { name: `Tộc Hụi ${i + 1}`, emblem: '🐉', color: '#aa3333' }, t);
    clans.donateClan(id, 20_000, t);
  });
  const member = newPlayer('dan_thuong', 1000);
  clans.joinClan(member, store.db.prepare("SELECT id FROM clans WHERE name = 'Tộc Hụi 1'").get().id, t);
  assert.throws(() => hui.createHui(member, { scope: 'clan', name: 'Hụi lớn', amount: 5000, size: 3 }, t), /tộc trưởng/);
  hui.createHui(leaders[0], { scope: 'clan', name: 'Hụi ba nhà', amount: 5000, size: 3 }, t);
  const id = hui.huiView(leaders[1], t).open.find((x) => x.name === 'Hụi ba nhà').id;
  hui.joinHui(leaders[1], id, t);
  hui.joinHui(leaders[2], id, t);
  const fundOf = (i) => hui.huiView(leaders[i], t).clan.fund;
  const before = [0, 1, 2].map(fundOf);
  hui.settleHuiDay(dayKey(t));
  assert.equal(fundOf(0), before[0] - 5000 + 15_000); // gia tộc chủ hụi hốt kỳ đầu
  assert.equal(fundOf(1), before[1] - 5000);
  // Gia tộc 3 cạn quỹ: kỳ 2 bị loại.
  clans.payDividend(leaders[2], fundOf(2), t + HOUR);
  hui.settleHuiDay(dayKey(t + DAY));
  const g = hui.huiView(leaders[0], t + DAY + HOUR).clanGroups.find((x) => x.id === id);
  assert.equal(g.members.find((m) => m.name.endsWith('Tộc Hụi 3')).status, 'out');
});
