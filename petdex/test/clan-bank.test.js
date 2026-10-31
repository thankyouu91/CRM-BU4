// Kiểm thử Ngân hàng gia tộc: mở ngân hàng, trần lãi, tiền gửi và bảo hiểm, cho vay thế chấp (LTV, liên quan, thanh khoản),
// rút tiền xếp hàng, đổ vỡ và bảo hiểm bù, vỡ nợ và đấu giá lô siết nợ, phong tỏa, giải tán; cuối cùng đối soát sổ cái.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const clans = await import('../server/clans.js');
const cb = await import('../server/clan-bank.js');
const { economy } = await import('../server/bank.js');
const { netWorth } = await import('../server/wallet.js');
const { CBANK, maxDepositRate, simpleInterest } = await import('../../public/ta-tua/game/js/shared/clan-bank.js');
const { financeTax } = await import('../../public/ta-tua/game/js/shared/clan-bonds.js');
const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
migrate(T0);

let n = 0;
function player(level = 8) {
  n += 1;
  const id = store.createUser(`nh${n}`, 'x', T0 - 30 * DAY);
  post({ userId: id, delta: 5_000_000, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, 'test_pet', T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
const clanOf = (u) => clans.clanView(u, T0).clan;
const fundOf = (id) => store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(`clan:${id}`)?.balance ?? 0;
const balance = (account) => store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(account)?.balance ?? 0;
function makeClan(name, money = 3_000_000) {
  const leader = player();
  clans.createClan(leader, { name, emblem: '🏯', color: '#445566' }, T0);
  clans.donateClan(leader, money, T0);
  return { leader, id: clanOf(leader).id };
}
const freePlot = () => {
  const used = new Set(store.db.prepare('SELECT id FROM land_plots WHERE clan_id IS NOT NULL').all().map((r) => r.id));
  return PLOTS.find((p) => !used.has(p.id) && p.zone !== 'sea');
};
function buyPlot(c) {
  const p = freePlot();
  clans.buyPlot(c.leader, p.id, T0);
  return p.id;
}
const giveStateBank = (clanId) => store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'state_bank', 0, ?)").run(clanId, T0);
const dep = (id) => store.db.prepare('SELECT * FROM cbank_deposits WHERE id = ?').get(id);
const lastDeposit = () => store.db.prepare('SELECT * FROM cbank_deposits ORDER BY id DESC LIMIT 1').get();
const lastLoan = () => store.db.prepare('SELECT * FROM cbank_loans ORDER BY id DESC LIMIT 1').get();
const bankRow = (id) => store.db.prepare('SELECT * FROM cbank_banks WHERE clan_id = ?').get(id);
const base = economy().baseRate;

const bankClan = makeClan('Kho Bạc');
const borrower = makeClan('Thợ Gốm');
const saver = player();
const saver2 = player();

test('mở ngân hàng: mua giấy phép một suất (phí vào ngân sách), vốn tối thiểu, tách khỏi quỹ', () => {
  assert.throws(() => cb.openBank(bankClan.leader, CBANK.minCapital - 1, T0), /tối thiểu/);
  const before = fundOf(bankClan.id);
  const treasury = balance('treasury');
  const free = cb.freeLicenses();
  cb.openBank(bankClan.leader, 300_000, T0);
  assert.equal(fundOf(bankClan.id), before - 300_000 - CBANK.license.fee);
  assert.equal(balance('treasury'), treasury + CBANK.license.fee);
  assert.equal(cb.freeLicenses(), free - 1);
  assert.equal(balance(`bank:${bankClan.id}`), 300_000);
  assert.equal(bankRow(bankClan.id).reputation, CBANK.reputation.start);
  assert.throws(() => cb.openBank(bankClan.leader, 100_000, T0), /đã có ngân hàng/);
});

test('lãi tiền gửi tối đa 3 lần lãi tiết kiệm NPC; khoảng lãi cho vay', () => {
  const cap = maxDepositRate(base);
  assert.equal(cap, Math.round(base * 3 * 1e9) / 1e9);
  assert.throws(() => cb.setBankTerms(bankClan.leader, { rates: { 7: cap * 1.01 } }, T0), /Lãi tiền gửi/);
  cb.setBankTerms(bankClan.leader, { rates: { 7: cap, 14: cap, 30: cap }, loanRate: base * 4, lendingOpen: true }, T0);
  assert.throws(() => cb.setBankTerms(bankClan.leader, { loanRate: base * 6.5 }, T0), /Lãi cho vay/);
  assert.throws(() => cb.setBankTerms(borrower.leader, { rates: { 7: base } }, T0), /chưa mở ngân hàng/);
});

test('gửi tiền: tiền vào tài khoản vốn, ngân hàng nộp 1% vào quỹ bảo hiểm, trần mỗi người và tính vào tài sản ròng', () => {
  const ins = cb.insuranceFund();
  const cash = balance(`bank:${bankClan.id}`);
  cb.depositAtBank(saver, bankClan.id, 40_000, 7, T0);
  assert.equal(balance(`bank:${bankClan.id}`), cash + 40_000 - 400);
  assert.equal(cb.insuranceFund(), ins + 400);
  assert.equal(lastDeposit().rate, maxDepositRate(base));
  assert.throws(() => cb.depositAtBank(saver, bankClan.id, 10_001, 7, T0), /tối đa 50\.000/);
  assert.throws(() => cb.depositAtBank(saver, bankClan.id, 99, 7, T0), /tối thiểu/);
  assert.throws(() => cb.depositAtBank(saver, bankClan.id, 500, 9, T0), /Kỳ hạn/);
  assert.equal(netWorth(saver, T0).parts.clanBank, 40_000);
});

test('rút trước hạn chỉ nhận gốc; đáo hạn nửa đêm tự trả gốc + lãi', () => {
  cb.depositAtBank(saver2, bankClan.id, 10_000, 7, T0);
  const early = lastDeposit();
  const coins = store.getUser(saver2).coins;
  cb.withdrawFromBank(saver2, early.id, T0 + HOUR);
  assert.equal(store.getUser(saver2).coins, coins + 10_000);
  assert.equal(dep(early.id).status, 'closed');

  cb.depositAtBank(saver2, bankClan.id, 10_000, 7, T0);
  const d = lastDeposit();
  const before = store.getUser(saver2).coins;
  cb.settleClanBankDay(d.matures_at);
  assert.equal(dep(d.id).status, 'closed');
  const interest = simpleInterest(10_000, d.rate, 7);
  assert.equal(store.getUser(saver2).coins, before + 10_000 + interest - financeTax(interest)); // thuế lợi nhuận tài chính 10%
});

test('trần tiền gửi = 10 lần vốn chủ', () => {
  const s = cb.sheetOf(bankClan.id);
  assert.equal(s.depositCap, Math.max(0, s.equity) * CBANK.leverage);
  // Ngân hàng nhỏ: vốn 50.000 thì nhận tối đa khoảng 500.000 xu tiền gửi.
  const small = makeClan('Tiệm Nhỏ');
  store.db.prepare("DELETE FROM clan_industries WHERE industry = 'state_bank'").run();
  giveStateBank(small.id);
  cb.openBank(small.leader, CBANK.minCapital, T0);
  cb.setBankTerms(small.leader, { rates: { 7: base } }, T0);
  const people = Array.from({ length: 10 }, () => player());
  for (const p of people.slice(0, 9)) cb.depositAtBank(p, small.id, 50_000, 7, T0);
  assert.throws(() => cb.depositAtBank(people[9], small.id, 50_000, 7, T0), /đủ tiền gửi so với vốn chủ/);
  // trả lại Ngân hàng nhà nước cho Kho Bạc để các test sau dùng
  store.db.prepare("DELETE FROM clan_industries WHERE industry = 'state_bank'").run();
  giveStateBank(bankClan.id);
});

test('cho vay thế chấp: tối đa 60% giá trị lô, không cho chính mình hay gia tộc liên quan, phí 1% vào bảo hiểm, lô không bán được', () => {
  const ownPlot = buyPlot(bankClan);
  assert.throws(() => cb.borrowFromBank(bankClan.leader, { bankId: bankClan.id, plotId: ownPlot, amount: 10_000, term: 7 }, T0), /liên quan/);
  const plotId = buyPlot(borrower);
  const c = clans.plotCollateral(plotId, T0);
  const cap = Math.floor(c.value * CBANK.loan.ltv);
  assert.throws(() => cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: cap + 1, term: 7 }, T0), /60% giá trị/);

  // Một người vừa rời Kho Bạc sang Thợ Gốm: hai gia tộc thành liên quan trong 14 ngày.
  const mover = player();
  clans.joinClan(mover, bankClan.id, T0 - 3 * DAY);
  clans.leaveClan(mover, T0 - 2 * DAY);
  clans.joinClan(mover, borrower.id, T0 - DAY);
  assert.ok(cb.clansRelated(borrower.id, bankClan.id, T0));
  assert.throws(() => cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: 10_000, term: 7 }, T0), /liên quan/);
  assert.equal(cb.clansRelated(borrower.id, bankClan.id, T0 + 15 * DAY), false);

  const now = T0 + 15 * DAY;
  const fund = fundOf(borrower.id);
  const ins = cb.insuranceFund();
  const amount = Math.min(cap, 60_000);
  cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount, term: 7 }, now);
  const loan = lastLoan();
  assert.equal(fundOf(borrower.id), fund + amount - Math.ceil(amount * CBANK.loan.fee));
  assert.equal(cb.insuranceFund(), ins + Math.ceil(amount * CBANK.loan.fee));
  assert.equal(loan.owed, amount + simpleInterest(amount, base * 4, 7));
  assert.throws(() => clans.sellPlot(borrower.leader, plotId, now), /thế chấp/);
  assert.throws(() => cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: 10_000, term: 7 }, now), /thế chấp rồi/);

  cb.repayBankLoan(borrower.leader, loan.id, null, now + HOUR);
  assert.equal(store.db.prepare('SELECT status FROM cbank_loans WHERE id = ?').get(loan.id).status, 'repaid');
  assert.equal(cb.plotPledged(plotId), false);
});

test('cho vay phải giữ 20% tiền gửi làm tiền mặt; rút không đủ tiền thì xếp hàng, lên báo, mất uy tín; trả nợ thì trả hàng chờ', () => {
  const now = T0 + 16 * DAY;
  const plotId = store.db.prepare('SELECT id FROM land_plots WHERE clan_id = ?').get(borrower.id).id;
  cb.depositAtBank(saver, bankClan.id, 40_000, 14, now);
  const s0 = cb.sheetOf(bankClan.id);
  assert.throws(() => cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: s0.cash - s0.floor + 1, term: 7 }, now), /cho vay được|60%/);
  cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: 60_000, term: 7 }, now);
  const loan = lastLoan();
  // Rút vốn tới sát mức tiền mặt tối thiểu (20% tiền gửi); rút thêm 1 xu là bị chặn.
  const s = cb.sheetOf(bankClan.id);
  assert.throws(() => cb.moveBankCapital(bankClan.leader, 'out', s.cash - s.floor + 1, now), /tối thiểu/);
  cb.moveBankCapital(bankClan.leader, 'out', s.cash - s.floor, now);
  assert.equal(cb.sheetOf(bankClan.id).cash, s.floor);
  // Người gửi 40.000 rút: tiền mặt chỉ còn mức tối thiểu 20% (8.000) nên phải xếp hàng.
  const d = store.db.prepare("SELECT * FROM cbank_deposits WHERE user_id = ? AND status = 'open'").get(saver);
  const headlines = store.db.prepare('SELECT COUNT(*) AS n FROM news').get().n;
  cb.withdrawFromBank(saver, d.id, now);
  assert.equal(dep(d.id).status, 'queued');
  assert.equal(bankRow(bankClan.id).reputation, CBANK.reputation.start - CBANK.reputation.runDrop);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM news').get().n, headlines + 1);
  assert.throws(() => cb.depositAtBank(saver2, bankClan.id, 1_000, 7, now), /xếp hàng/);
  cb.repayBankLoan(borrower.leader, loan.id, null, now + HOUR);
  assert.equal(dep(d.id).status, 'closed');
  cb.settleClanBankDay(now + DAY);
  assert.equal(bankRow(bankClan.id).reputation, CBANK.reputation.start - CBANK.reputation.runDrop + CBANK.reputation.dailyRecover);
});

test('vỡ nợ: quá hạn cộng phí trễ, hết ân hạn thì siết lô ra đấu giá; gia tộc khác mua, tiền trả ngân hàng, dư về gia tộc vay', () => {
  const now = T0 + 20 * DAY;
  cb.moveBankCapital(bankClan.leader, 'in', 200_000, now);
  const plotId = store.db.prepare('SELECT id FROM land_plots WHERE clan_id = ?').get(borrower.id).id;
  cb.borrowFromBank(borrower.leader, { bankId: bankClan.id, plotId, amount: 20_000, term: 7 }, now);
  const loan = lastLoan();
  // Gia tộc vay tiêu sạch quỹ.
  const drain = fundOf(borrower.id);
  post({ account: `clan:${borrower.id}`, delta: -drain, kind: 'clan_upkeep', now });
  post({ account: 'treasury', delta: drain, kind: 'clan_upkeep', now });
  cb.settleClanBankDay(loan.due_at);
  let l = store.db.prepare('SELECT * FROM cbank_loans WHERE id = ?').get(loan.id);
  assert.equal(l.status, 'late');
  assert.equal(l.owed, loan.owed + Math.ceil(loan.owed * CBANK.loan.lateFee));
  for (let i = 1; i <= CBANK.loan.graceNights; i++) cb.settleClanBankDay(loan.due_at + i * DAY);
  l = store.db.prepare('SELECT * FROM cbank_loans WHERE id = ?').get(loan.id);
  assert.equal(l.status, 'defaulted');
  const a = store.db.prepare('SELECT * FROM cbank_auctions WHERE loan_id = ?').get(loan.id);
  assert.equal(a.status, 'open');
  assert.equal(a.start_price, Math.round(l.collateral > 0 ? clans.plotCollateral(plotId, a.created_at).value * CBANK.auction.startShare : 0));

  const buyer = makeClan('Người Mua');
  assert.throws(() => cb.bidSeizedPlot(borrower.leader, a.id, a.start_price, a.created_at), /không trả giá/);
  assert.throws(() => cb.bidSeizedPlot(buyer.leader, a.id, a.start_price - 1, a.created_at), /ít nhất/);
  cb.bidSeizedPlot(buyer.leader, a.id, a.start_price, a.created_at);
  const rival = makeClan('Kẻ Tranh');
  const rivalFund = fundOf(rival.id);
  const buyerFund = fundOf(buyer.id);
  const second = a.start_price + Math.ceil(a.start_price * CBANK.auction.step);
  cb.bidSeizedPlot(rival.leader, a.id, second, a.created_at + HOUR);
  assert.equal(fundOf(buyer.id), buyerFund + a.start_price); // hoàn giá bị vượt
  assert.throws(() => cb.keepSeizedPlot(bankClan.leader, a.id, a.created_at + HOUR), /Đã có gia tộc trả giá/);
  const bankCash = balance(`bank:${bankClan.id}`);
  const debtorFund = fundOf(borrower.id);
  cb.settleBankAuctions(a.ends_at);
  const left = l.owed - l.paid;
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(plotId).clan_id, rival.id);
  assert.equal(balance(`bank:${bankClan.id}`), bankCash + Math.min(left, second));
  assert.equal(fundOf(borrower.id), debtorFund + Math.max(0, second - left));
  assert.equal(fundOf(rival.id), rivalFund - second);
  assert.equal(store.db.prepare('SELECT status FROM cbank_auctions WHERE id = ?').get(a.id).status, 'sold');
});

test('đấu giá không ai trả: Sở Nhà Đất mua lại theo giá bán lại đất; ngân hàng cũng có thể giữ lô', () => {
  const now = T0 + 40 * DAY;
  const debtor = makeClan('Nợ Nần');
  const plotA = buyPlot(debtor);
  cb.borrowFromBank(debtor.leader, { bankId: bankClan.id, plotId: plotA, amount: 15_000, term: 7 }, now);
  const loanA = lastLoan();
  const drain = fundOf(debtor.id);
  post({ account: `clan:${debtor.id}`, delta: -drain, kind: 'clan_upkeep', now });
  post({ account: 'treasury', delta: drain, kind: 'clan_upkeep', now });
  for (let i = 0; i <= CBANK.loan.graceNights; i++) cb.settleClanBankDay(loanA.due_at + i * DAY);
  const a = store.db.prepare('SELECT * FROM cbank_auctions WHERE loan_id = ?').get(loanA.id);
  const resale = clans.plotCollateral(plotA, a.ends_at).resale;
  const cash = balance(`bank:${bankClan.id}`);
  const left = store.db.prepare('SELECT owed - paid AS left FROM cbank_loans WHERE id = ?').get(loanA.id).left;
  cb.settleBankAuctions(a.ends_at);
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(plotA).clan_id, null);
  assert.equal(balance(`bank:${bankClan.id}`), cash + Math.min(left, resale));
  assert.equal(store.db.prepare('SELECT status FROM cbank_auctions WHERE id = ?').get(a.id).status, 'npc');
});

test('phong tỏa khẩn cấp chặn rút và gửi; gỡ thì chạy lại', () => {
  cb.depositAtBank(saver2, bankClan.id, 5_000, 14, T0 + 50 * DAY);
  const d = lastDeposit();
  cb.setClanBankFrozen(bankClan.id, true);
  assert.throws(() => cb.withdrawFromBank(saver2, d.id, T0 + 50 * DAY), /phong tỏa/);
  cb.setClanBankFrozen(bankClan.id, false);
  cb.setClanBankFrozen(null, true);
  assert.throws(() => cb.depositAtBank(saver2, bankClan.id, 5_000, 14, T0 + 50 * DAY), /phong tỏa/);
  assert.equal(cb.adminClanBankView().frozen, true);
  cb.setClanBankFrozen(null, false);
  cb.withdrawFromBank(saver2, d.id, T0 + 50 * DAY);
  assert.equal(dep(d.id).status, 'closed');
});

test('đổ vỡ: xếp hàng quá 3 đêm thì tiền mặt chia theo tỉ lệ gốc, bảo hiểm bù tới 80% phần thiếu', () => {
  const now = T0 + 60 * DAY;
  const weak = makeClan('Ngân Hàng Yếu');
  store.db.prepare("DELETE FROM clan_industries WHERE industry = 'state_bank'").run();
  giveStateBank(weak.id);
  cb.openBank(weak.leader, CBANK.minCapital, now);
  cb.setBankTerms(weak.leader, { rates: { 7: base }, loanRate: base * 2, lendingOpen: true }, now);
  const people = [player(), player()];
  for (const p of people) cb.depositAtBank(p, weak.id, 50_000, 7, now);
  const debtor = makeClan('Vay Rồi Đi');
  const plotId = buyPlot(debtor);
  const s = cb.sheetOf(weak.id);
  cb.borrowFromBank(debtor.leader, { bankId: weak.id, plotId, amount: Math.min(s.cash - s.floor, Math.floor(clans.plotCollateral(plotId, now).value * 0.6)), term: 30 }, now);
  const [d1, d2] = store.db.prepare('SELECT * FROM cbank_deposits WHERE bank_id = ? ORDER BY id').all(weak.id);
  cb.withdrawFromBank(people[0], d1.id, now);
  assert.equal(dep(d1.id).status, 'queued');
  const cash = balance(`bank:${weak.id}`);
  const fund = cb.insuranceFund();
  const coins = people.map((p) => store.getUser(p).coins);
  for (let i = 1; i <= CBANK.failNights; i++) cb.settleClanBankDay(now + i * DAY);
  assert.equal(bankRow(weak.id).status, 'failed');
  const paid = [dep(d1.id), dep(d2.id)];
  const ratio = cash / 100_000;
  for (const [i, d] of paid.entries()) {
    assert.equal(d.status, 'failed');
    const fromCash = Math.floor(50_000 * ratio);
    assert.equal(d.payout - d.insured, fromCash);
    assert.ok(d.insured <= Math.floor((50_000 - fromCash) * CBANK.insuranceCover));
    assert.equal(store.getUser(people[i]).coins, coins[i] + d.payout);
  }
  assert.equal(cb.insuranceFund(), fund - paid[0].insured - paid[1].insured);
  assert.equal(balance(`bank:${weak.id}`), 0);
  // Khoản vay của ngân hàng đổ vỡ: tiền trả nợ vào quỹ bảo hiểm.
  const loan = lastLoan();
  const ins = cb.insuranceFund();
  cb.repayBankLoan(debtor.leader, loan.id, 1_000, now + 5 * DAY);
  assert.equal(cb.insuranceFund(), ins + 1_000);
});

test('gia tộc vay giải tán: lô đang thế chấp về tay ngân hàng chủ nợ', () => {
  store.db.prepare("DELETE FROM clan_industries WHERE industry = 'state_bank'").run();
  giveStateBank(bankClan.id);
  const now = T0 + 80 * DAY;
  const gone = makeClan('Sắp Tan');
  const plotId = buyPlot(gone);
  cb.borrowFromBank(gone.leader, { bankId: bankClan.id, plotId, amount: 10_000, term: 7 }, now);
  clans.leaveClan(gone.leader, now + HOUR);
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(plotId).clan_id, bankClan.id);
  assert.equal(lastLoan().status, 'defaulted');
});

test('Phố Ngân hàng chỉ có CBANK.license.slots suất: đủ suất thì không mở thêm, ngân hàng đổ vỡ trả lại suất', () => {
  const now = T0 + 90 * DAY;
  const extra = [];
  while (cb.freeLicenses() > 0) {
    const c = makeClan(`Suất ${extra.length}`);
    cb.openBank(c.leader, CBANK.minCapital, now);
    extra.push(c);
  }
  const late = makeClan('Đến Muộn');
  assert.throws(() => cb.openBank(late.leader, CBANK.minCapital, now), /đủ/);
  assert.equal(cb.clanBankView(late.leader, now).clan.canOpen, false);
  cb.failBank(extra[0].id, now, 'thử');
  assert.equal(cb.freeLicenses(), 1);
  assert.equal(cb.clanBankView(late.leader, now).clan.canOpen, true);
  cb.openBank(late.leader, CBANK.minCapital, now);
  assert.equal(cb.freeLicenses(), 0);
});

test('sổ cái khớp: mọi tài khoản chung và ví người chơi bằng tổng các dòng sổ cái', () => {
  const bad = store.db.prepare(`
    SELECT a.id, a.balance, COALESCE(SUM(l.delta), 0) AS sum FROM accounts a LEFT JOIN ledger l ON l.account = a.id
    GROUP BY a.id HAVING a.balance != sum`).all();
  assert.deepEqual(bad, []);
  const wallets = store.db.prepare(`
    SELECT u.id, u.coins, COALESCE(SUM(l.delta), 0) AS sum FROM users u LEFT JOIN ledger l ON l.user_id = u.id AND l.account = 'wallet'
    GROUP BY u.id HAVING u.coins != sum`).all();
  assert.deepEqual(wallets, []);
  const negative = store.db.prepare("SELECT id, balance FROM accounts WHERE (id LIKE 'bank:%' OR id LIKE 'cbank_%') AND balance < 0").all();
  assert.deepEqual(negative, []);
});
