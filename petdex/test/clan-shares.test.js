// Kiểm thử cổ phần gia tộc: IPO và chia cổ phần thành viên, trần 10%, bảo lãnh, giá theo quỹ khớp lệnh và biên ±15%/ngày,
// phí môi giới, công bố 25%, kiểm soát 50%, Sở Công Thương, bổ nhiệm và sáp nhập, mua lại, cổ tức theo lợi nhuận,
// vay ký quỹ và bán giải chấp, giải tán; cuối cùng đối soát sổ cái.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const clans = await import('../server/clans.js');
const cb = await import('../server/clan-bank.js');
const sh = await import('../server/clan-shares.js');
const { economy } = await import('../server/bank.js');
const { netWorth } = await import('../server/wallet.js');
const { SHARES, SHARE_POOL, PLAYER_CAP, buyCost, sellProceeds, allotByDonation } = await import('../../public/ta-tua/game/js/shared/clan-shares.js');
const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');
const { dayKey } = await import('../server/clock.js');

const T0 = Date.parse('2026-11-25T03:00:00Z');
migrate(T0);
let n = 0;
function player() {
  n += 1;
  const id = store.createUser(`cp${n}`, 'x', T0 - 30 * DAY);
  post({ userId: id, delta: 5_000_000, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, 'test_pet', T0 - 20 * DAY);
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  store.setActivePet(id, petId);
  return id;
}
const clanId = (u) => clans.clanView(u, T0).clan.id;
function makeClan(name, members = 0, money = 2_000_000) {
  const leader = player();
  clans.createClan(leader, { name, emblem: '🏯', color: '#445566' }, T0);
  clans.donateClan(leader, money, T0);
  const ms = Array.from({ length: members }, () => player());
  const id = clanId(leader);
  ms.forEach((m, i) => { clans.joinClan(m, id, T0); clans.donateClan(m, 1_000 * (i + 1), T0); });
  return { leader, members: ms, id };
}
const bal = (a) => store.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(a)?.balance ?? 0;
const held = (c, k, id) => store.db.prepare('SELECT qty FROM clan_shareholdings WHERE clan_id = ? AND holder_kind = ? AND holder_id = ?').get(c, k, id)?.qty ?? 0;
const listing = (c) => store.db.prepare('SELECT * FROM clan_listings WHERE clan_id = ?').get(c);
const freePlot = () => {
  const used = new Set(store.db.prepare('SELECT id FROM land_plots WHERE clan_id IS NOT NULL').all().map((r) => r.id));
  return PLOTS.find((p) => !used.has(p.id) && p.zone !== 'sea');
};

// Gia tộc nắm Ngân hàng nhà nước (môi giới, bảo lãnh, cho vay ký quỹ).
const banker = makeClan('Môi Giới');
store.db.prepare("INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, 'state_bank', 0, ?)").run(banker.id, T0);
cb.openBank(banker.leader, 1_000_000, T0);
const base = economy().baseRate;
cb.setBankTerms(banker.leader, { loanRate: base * 2, lendingOpen: true }, T0);
const target = makeClan('Lên Sàn', 3);
let price;

test('chia cổ phần thành viên theo số đã góp, đủ tổng', () => {
  const out = allotByDonation([{ id: 1, donated: 300 }, { id: 2, donated: 100 }, { id: 3, donated: 0 }], 650);
  assert.equal(out.reduce((s, o) => s + o.qty, 0), 650);
  assert.ok(out[0].qty > out[1].qty && out[2].qty === 0);
});

test('IPO: giá trong 0,5–2 lần sổ sách, tối đa 30%, góp quỹ khớp lệnh, thành viên nhận phần còn lại', () => {
  const book = sh.bookValue(target.id, T0);
  assert.throws(() => sh.startIpo(target.leader, { shares: 301, price: Math.round(book) }, T0), /tới 300/);
  assert.throws(() => sh.startIpo(target.leader, { shares: 300, price: Math.round(book * 2.1) }, T0), /Giá IPO/);
  assert.throws(() => sh.startIpo(target.members[0], { shares: 300, price: Math.round(book) }, T0), /tộc trưởng/);
  price = Math.round(book);
  const fund = bal(`clan:${target.id}`);
  sh.startIpo(target.leader, { shares: 300, price }, T0);
  assert.equal(bal(`clan:${target.id}`), fund - SHARE_POOL * price);
  assert.equal(bal(`shares_pool:${target.id}`), SHARE_POOL * price);
  const members = store.db.prepare("SELECT SUM(qty) AS q FROM clan_shareholdings WHERE clan_id = ? AND holder_kind = 'user'").get(target.id).q;
  assert.equal(members, SHARES.total - 300 - SHARE_POOL);
  assert.throws(() => sh.startIpo(target.leader, { shares: 100, price }, T0), /đã lên sàn/);
});

test('mua IPO: trần 10% mỗi người, tiền về quỹ trừ 2% phí bảo lãnh cho ngân hàng môi giới', () => {
  const buyer = player();
  const fund = bal(`clan:${target.id}`);
  const broker = bal(`bank:${banker.id}`);
  sh.subscribeIpo(buyer, target.id, 80, T0 + HOUR);
  const value = 80 * price;
  assert.equal(bal(`clan:${target.id}`), fund + value - Math.ceil(value * SHARES.underwriteFee));
  assert.equal(bal(`bank:${banker.id}`), broker + Math.ceil(value * SHARES.underwriteFee));
  assert.throws(() => sh.subscribeIpo(buyer, target.id, PLAYER_CAP - 80 + 1, T0 + HOUR), /tối đa 100/);
  assert.throws(() => sh.buyShares(buyer, target.id, 1, {}, T0 + HOUR), /chưa giao dịch/);
});

test('hết giờ IPO: ngân hàng bảo lãnh phần chưa bán với 90% giá; giao dịch mở với giá IPO', () => {
  const at = T0 + SHARES.subscribeHours * HOUR;
  const fund = bal(`clan:${target.id}`);
  sh.closeIpos(at);
  const l = listing(target.id);
  assert.equal(l.status, 'listed');
  assert.equal(held(target.id, 'bank', banker.id), 220);
  assert.equal(bal(`clan:${target.id}`), fund + Math.ceil(220 * price * SHARES.underwritePrice));
  assert.equal(sh.priceOf(l), price);
});

test('giá theo cung cầu: tích số không đổi, phí 1% cho môi giới, biên ±15% mỗi ngày, sang ngày mới chốt lại giá', () => {
  const now = T0 + 2 * DAY;
  const buyer = player();
  const c0 = bal(`shares_pool:${target.id}`);
  const s0 = listing(target.id).pool_shares;
  const cost = buyCost(c0, s0, 3);
  const broker = bal(`bank:${banker.id}`);
  const coins = store.getUser(buyer).coins;
  sh.buyShares(buyer, target.id, 3, {}, now);
  assert.equal(store.getUser(buyer).coins, coins - cost - Math.ceil(cost * SHARES.fee));
  assert.equal(bal(`bank:${banker.id}`), broker + Math.ceil(cost * SHARES.fee));
  assert.ok(sh.priceOf(listing(target.id)) > price);
  assert.ok(bal(`shares_pool:${target.id}`) * listing(target.id).pool_shares >= c0 * s0);
  assert.throws(() => sh.buyShares(buyer, target.id, 10, {}, now), /biên 15%/);
  const got = sellProceeds(bal(`shares_pool:${target.id}`), listing(target.id).pool_shares, 3);
  sh.sellShares(buyer, target.id, 3, now);
  assert.equal(store.getUser(buyer).coins, coins - cost - Math.ceil(cost * SHARES.fee) + got - Math.ceil(got * SHARES.fee));
  assert.equal(listing(target.id).ref_day, dayKey(now));
});

test('cổ tức: chỉ chia trong lợi nhuận 7 ngày, chia đều theo cổ phần ngoài gia tộc', () => {
  const now = T0 + 3 * DAY;
  assert.throws(() => sh.payShareDividend(target.leader, 10_000, now), /lợi nhuận/);
  store.db.prepare('INSERT INTO clan_days (clan_id, day, revenue, declared, rate, tax, upkeep) VALUES (?, ?, 100000, 100000, 0.1, 10000, 0)').run(target.id, dayKey(now - DAY));
  const holders = store.db.prepare("SELECT * FROM clan_shareholdings WHERE clan_id = ? AND holder_kind IN ('user', 'clan', 'bank') AND qty > 0").all(target.id);
  const total = holders.reduce((s, h) => s + h.qty, 0);
  const amount = total * 50;
  const m0 = store.getUser(target.members[2]).coins;
  const mine = held(target.id, 'user', target.members[2]);
  sh.payShareDividend(target.leader, amount, now);
  assert.equal(store.getUser(target.members[2]).coins, m0 + 50 * mine);
  assert.equal(sh.dividendRoom(target.id, now), 90_000 - amount);
});

test('thâu tóm: công bố khi vượt 25%, Sở Công Thương chặn khi vượt 40% số lô một ngành, trên 50% thì kiểm soát', () => {
  const now = T0 + 4 * DAY;
  const raider = makeClan('Thâu Tóm');
  // Hai bên cùng có lô ngành textiles và chỉ có hai lô đó: gộp lại là 100% ngành.
  const p1 = freePlot(); clans.buyPlot(target.leader, p1.id, now);
  const p2 = freePlot(); clans.buyPlot(raider.leader, p2.id, now);
  store.db.prepare("UPDATE land_plots SET industry = 'textiles' WHERE id IN (?, ?)").run(p1.id, p2.id);
  assert.equal(sh.antitrustBreaches(raider.id, target.id).length, 1);
  // Thành viên bán dần vào quỹ, gia tộc thâu tóm mua lại từng chút để giá không vượt biên.
  const sellers = [target.leader, ...target.members];
  const news0 = store.db.prepare("SELECT COUNT(*) AS n FROM news WHERE headline LIKE '%Công bố sở hữu%'").get().n;
  let blocked = false;
  for (let i = 0; i < 400 && !blocked; i++) {
    const s = sellers.find((u) => held(target.id, 'user', u) >= 5);
    if (!s) break;
    sh.sellShares(s, target.id, 5, now);
    try {
      sh.clanTradeShares(raider.leader, target.id, 'buy', 5, {}, now);
    } catch (e) {
      assert.match(e.message, /Sở Công Thương/);
      blocked = true;
    }
  }
  assert.ok(blocked, 'phải bị chặn khi vượt 50% mà gộp lại vượt 40% ngành');
  assert.ok(held(target.id, 'clan', raider.id) <= SHARES.total * SHARES.control);
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM news WHERE headline LIKE '%Công bố sở hữu%'").get().n, news0 + 1);
  // Bỏ ngành của lô đích: không còn vi phạm, mua tiếp vượt 50% thì nắm quyền.
  store.db.prepare('UPDATE land_plots SET industry = NULL WHERE id = ?').run(p1.id);
  for (let i = 0; i < 40 && held(target.id, 'clan', raider.id) <= 500; i++) {
    const s = sellers.find((u) => held(target.id, 'user', u) >= 5);
    sh.clanTradeShares(raider.leader, target.id, 'buy', 5, {}, now);
    sh.sellShares(s, target.id, 5, now);
  }
  assert.equal(listing(target.id).controller, raider.id);
  assert.throws(() => sh.appointLeader(target.leader, target.id, target.members[0], now), /chưa nắm/);
  sh.appointLeader(raider.leader, target.id, target.members[0], now);
  assert.equal(store.db.prepare('SELECT leader_id FROM clans WHERE id = ?').get(target.id).leader_id, target.members[0]);
  sh.mergeControlled(raider.leader, target.id, now);
  assert.equal(store.db.prepare('SELECT clan_id FROM land_plots WHERE id = ?').get(p1.id).clan_id, raider.id);
});

test('mua lại: gia tộc mua cổ phiếu của chính mình thành cổ phần tự giữ', () => {
  const now = T0 + 5 * DAY;
  const leader = store.db.prepare('SELECT leader_id FROM clans WHERE id = ?').get(target.id).leader_id;
  sh.clanTradeShares(leader, target.id, 'buy', 2, {}, now);
  assert.ok(held(target.id, 'self', target.id) >= 2);
});

test('vay ký quỹ: vay 50% giá trị lệnh, cổ phần cầm cố không bán được; giá rơi dưới 130% nợ thì bán giải chấp', () => {
  const now = T0 + 6 * DAY;
  const trader = player();
  const cash = bal(`bank:${banker.id}`);
  sh.buyShares(trader, target.id, 3, { margin: true }, now);
  const m = store.db.prepare('SELECT * FROM clan_margin_loans ORDER BY id DESC LIMIT 1').get();
  assert.ok(m.owed > 0 && m.shares === 3);
  assert.ok(bal(`bank:${banker.id}`) < cash);
  assert.throws(() => sh.sellShares(trader, target.id, 1, now), /cầm cố/);
  assert.ok(netWorth(trader, now).parts.shares > 0);
  // Nợ phình to (giả lập lãi nhiều ngày) thì đêm sau bị bán giải chấp.
  store.db.prepare('UPDATE clan_margin_loans SET owed = owed * 3 WHERE id = ?').run(m.id);
  sh.settleSharesDay(now + DAY);
  assert.equal(store.db.prepare('SELECT status FROM clan_margin_loans WHERE id = ?').get(m.id).status, 'liquidated');
  assert.equal(held(target.id, 'user', trader), 0);
});

test('giải tán: cổ phiếu rời sàn, quỹ khớp lệnh về quỹ gia tộc', () => {
  const now = T0 + 8 * DAY;
  const tiny = makeClan('Sắp Rời Sàn');
  sh.startIpo(tiny.leader, { shares: 100, price: Math.round(sh.bookValue(tiny.id, now)) }, now);
  sh.closeIpos(now + SHARES.subscribeHours * HOUR);
  clans.leaveClan(tiny.leader, now + 2 * DAY);
  assert.equal(listing(tiny.id).status, 'delisted');
  assert.equal(bal(`shares_pool:${tiny.id}`), 0);
});

test('sổ cái khớp', () => {
  const bad = store.db.prepare(`
    SELECT a.id FROM accounts a LEFT JOIN ledger l ON l.account = a.id GROUP BY a.id HAVING a.balance != COALESCE(SUM(l.delta), 0)`).all();
  assert.deepEqual(bad, []);
  const wallets = store.db.prepare(`
    SELECT u.id FROM users u LEFT JOIN ledger l ON l.user_id = u.id AND l.account = 'wallet' GROUP BY u.id HAVING u.coins != COALESCE(SUM(l.delta), 0)`).all();
  assert.deepEqual(wallets, []);
  assert.deepEqual(store.db.prepare("SELECT id FROM accounts WHERE id != 'treasury' AND balance < 0").all(), []);
});
