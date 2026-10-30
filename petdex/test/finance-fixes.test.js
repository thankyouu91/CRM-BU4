// Sửa lỗi tài chính: thu nợ vỡ nợ theo thu nhập (ví rồi tiết kiệm) và vẫn tính lãi, hạn mức P2P theo hạng,
// trần tiền thăm hụi theo quỹ thật, kỳ hụi đầu sau lần quyết toán cho chạy, làm tròn tiền, tốc độ tăng tổng lượng xu,
// thưởng dự án Hội chỉ báo người được trả, và lệnh ép vĩ mô áp cho mọi nơi tạo bản ghi ngày.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const { dayKey, startOfDay } = await import('../server/clock.js');
const credit = await import('../server/credit.js');
const bank = await import('../server/bank.js');
const hui = await import('../server/hui.js');
const chat = await import('../server/chat.js');
const macro = await import('../server/macro.js');
const { LOANS, ceilCoins, installment, loanRate, tierOf } = await import('../server/rules/production.js');
const { HUI, P2P, p2pLimit } = await import('../server/rules/finance.js');
const { UNLOCKS } = await import('../server/routes-economy.js');

const T0 = Date.parse('2026-12-02T03:00:00Z');
migrate(T0);
runDue(T0);
const coins = (id) => store.getUser(id).coins;
const savings = (id) => store.db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?').get(id)?.savings ?? 0;
function newPlayer(name, money) {
  const id = store.createUser(name, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: money, kind: 'opening', now: T0 });
  return id;
}

test('làm tròn: 1.000 xu × (0,3% + 1%) là 13 xu lãi, không phải 14', () => {
  assert.equal(Math.ceil(1000 * (0.003 + 0.01)), 14, 'lỗi dấu phẩy động gốc');
  assert.equal(ceilCoins(1000 * (0.003 + 0.01)), 13);
  const rate = loanRate(0.003, 700); // phụ phí hạng
  assert.equal(rate, Math.round((0.003 + tierOf(700).premium) * 1e6) / 1e6);
  assert.equal(installment({ remaining: 1000, rate: 0.003 + 0.01, principal: 1000, term_days: 7 }).interest, 13);
});

test('hạn mức P2P theo hạng tín dụng; vay ngân hàng báo đúng cấp mở tài chính nâng cao', () => {
  assert.equal(p2pLimit(800), tierOf(800).limit * P2P.limitMultiplier);
  assert.ok(p2pLimit(800) > p2pLimit(500));
  const u = newPlayer('chua_nang_cao', 100);
  assert.match(credit.creditView(u, T0).blocked, new RegExp(`cấp ${UNLOCKS.advanced}`));
});

test('vay ngân hàng vỡ nợ: vẫn cộng lãi và phí trễ, giữ 30% thu nhập trong ngày từ ví rồi tới tiết kiệm', () => {
  const u = newPlayer('vo_no_bank', 0);
  store.setAdvanced(u, true);
  // Dựng sẵn một khoản đã vỡ nợ.
  store.db.prepare(`INSERT INTO loans (user_id, principal, remaining, rate, term_days, opened_at, due_at, status, fees, late_days)
    VALUES (?, 2000, 2000, 0.01, 7, ?, ?, 'defaulted', 0, 7)`).run(u, T0 - 20 * DAY, T0 - 13 * DAY);
  const day = dayKey(T0 + DAY);
  const from = startOfDay(day);
  // Không có thu nhập: không thu gì nhưng nợ vẫn tăng (lãi 1% + phí trễ 1%).
  credit.settleLoansDay(day);
  let loan = store.db.prepare('SELECT * FROM loans WHERE user_id = ?').get(u);
  assert.equal(loan.remaining, 2000);
  assert.equal(loan.fees, 20 + ceilCoins((2000 + 20) * LOANS.lateFee));
  // Có lương 1.000 nhưng giấu 900 vào tiết kiệm: vẫn bị giữ đủ 300 (100 ví + 200 tiết kiệm).
  const day2 = dayKey(T0 + 2 * DAY);
  const from2 = startOfDay(day2);
  post({ userId: u, delta: 1000, kind: 'salary', memo: 'lương', now: from2 + HOUR });
  bank.moveSavings(u, 'deposit', 900, from2 + 2 * HOUR);
  const owedBefore = loan.remaining + loan.fees;
  credit.settleLoansDay(day2);
  assert.equal(coins(u), 0);
  assert.equal(savings(u), 900 - 200);
  loan = store.db.prepare('SELECT * FROM loans WHERE user_id = ?').get(u);
  assert.equal(loan.status, 'defaulted');
  const interest = ceilCoins(2000 * 0.01);
  assert.ok(loan.remaining + loan.fees < owedBefore + interest, 'đã thu bớt nợ');
  assert.ok(from < from2);
});

test('hụi: tiền thăm kéo về trần 30% quỹ thật khi có người bị loại; dây cho chạy lúc quyết toán thì kỳ 1 chốt đêm sau, có thư báo', () => {
  const [a, b, c, d] = ['hui_x1', 'hui_x2', 'hui_x3', 'hui_x4'].map((n) => newPlayer(n, 2000));
  const t = T0 + 3 * HOUR;
  hui.createHui(a, { scope: 'player', name: 'Hụi trần thăm', amount: 1000, size: 5 }, t);
  const g = store.db.prepare("SELECT * FROM hui_groups WHERE name = 'Hụi trần thăm'").get();
  for (const id of [b, c, d]) hui.joinHui(id, g.id, t);
  // Chưa đủ 5 người: hết 3 ngày gom thì đủ tối thiểu nên cho chạy ngay trong lần quyết toán đó.
  const settleDay = dayKey(t + HUI.openDays * DAY);
  hui.settleHuiDay(settleDay);
  let row = store.db.prepare('SELECT * FROM hui_groups WHERE id = ?').get(g.id);
  assert.equal(row.status, 'running');
  assert.equal(row.round, 0, 'chưa chốt kỳ 1 trong cùng lần quyết toán');
  assert.ok(row.next_round_at > startOfDay(settleDay) + DAY);
  for (const id of [a, b, c, d]) assert.ok(chat.mailbox(id).mails.some((m) => /bắt đầu chạy/.test(m.subject)), 'thư báo dây bắt đầu');

  // b bỏ thăm tối đa theo quỹ 4 người (1.200); d tiêu hết tiền nên bị loại: quỹ còn 3.000, trần là 900.
  const bidAt = row.next_round_at - HOUR;
  hui.bidHui(b, g.id, Math.floor(4000 * HUI.maxBidRatio), bidAt);
  post({ userId: d, delta: -coins(d), kind: 'admin', now: bidAt });
  hui.settleHuiDay(dayKey(row.next_round_at));
  const r1 = store.db.prepare('SELECT * FROM hui_rounds WHERE group_id = ? AND round = 1').get(g.id);
  assert.equal(r1.pot, 3000);
  assert.equal(r1.winner_id, b);
  assert.equal(r1.bid, Math.floor(3000 * HUI.maxBidRatio), 'thăm bị kéo về trần của quỹ thật');
  row = store.db.prepare('SELECT * FROM hui_groups WHERE id = ?').get(g.id);
  assert.equal(row.round, 1);
});

test('Ngân hàng Trung ương: tốc độ tăng tính trên tổng lượng xu, người chơi nghỉ không thổi phồng', () => {
  bank.centralBankWeek('2026-W60', T0 + 30 * DAY); // phiên ghi mốc tổng lượng xu
  const before = store.db.prepare('SELECT * FROM central_bank ORDER BY week DESC LIMIT 1').get();
  assert.ok(before.money_total > 0);
  // Không ai giao dịch suốt tuần (mọi người "nghỉ"), lượng xu không đổi: tăng trưởng 0, không phải tăng vọt.
  bank.centralBankWeek('2026-W61', T0 + 60 * DAY);
  const after = store.db.prepare('SELECT * FROM central_bank ORDER BY week DESC LIMIT 1').get();
  assert.equal(after.week, '2026-W61');
  assert.ok(Math.abs(after.growth) < 1e-9, `tăng trưởng ${after.growth}`);
  const news = store.db.prepare("SELECT headline FROM news WHERE headline LIKE 'Ngân hàng Trung ương:%' ORDER BY id DESC LIMIT 1").get().headline;
  assert.match(news, /lãi suất cơ bản \d+,\d{2}%\/ngày/, 'lãi suất hiện 2 chữ số thập phân');
});

test('vĩ mô: lệnh ép áp cho mọi nơi tạo bản ghi ngày; sửa tay thì thay tin thời tiết và hiệu ứng khách', () => {
  const cfg = JSON.parse(store.getMeta('clan_config') ?? '{}');
  store.setMeta('clan_config', JSON.stringify({ ...cfg, macro: { phase: 'recession', weather: 'monsoon' } }));
  const day = '2027-02-10';
  const now = startOfDay(day) + HOUR;
  const state = macro.macroToday(now);
  assert.equal(state.day, day);
  assert.equal(state.phase, 'recession');
  assert.equal(state.weather, 'monsoon');
  const from = startOfDay(day);
  const weatherNews = () => store.db.prepare("SELECT headline FROM news WHERE starts_at = ? AND commodity IS NOT NULL AND headline LIKE '%: thị trường %'").all(from).map((r) => r.headline);
  const traffic = () => store.db.prepare("SELECT value FROM town_effects WHERE kind = 'traffic' AND target IS NULL AND starts_at = ?").all(from).map((r) => r.value);
  assert.ok(weatherNews().length > 0 && weatherNews().every((h) => h.includes('Mưa lớn')));
  assert.deepEqual(traffic(), [-0.1]);

  macro.overrideMacro(day, { phase: 'boom', weather: 'calm' }, now + HOUR);
  assert.deepEqual(weatherNews(), [], 'trời yên thì không còn tin mưa');
  assert.deepEqual(traffic(), [0.1], 'hiệu ứng khách theo pha mới');
  store.setMeta('clan_config', JSON.stringify(cfg));
});

test('dự án Hội: ngân sách thị trấn chỉ đủ cho một người thì chỉ báo một người được thưởng', async () => {
  const social = await import('../server/social.js');
  const market = await import('../server/market.js');
  const { GUILD_PROJECTS, GUILD } = await import('../server/rules/town.js');
  const { LOT } = await import('../server/rules/market.js');
  const { treasuryBalance } = await import('../server/ledger.js');
  const { weekKey } = await import('../server/town.js');
  const lead = newPlayer('truong_hoi', GUILD.createCost + 100);
  const mem = newPlayer('hoi_vien', 100);
  const t = T0 + 4 * HOUR;
  social.createGuild(lead, { name: 'Hội Thử Ngân Sách', emblem: '🧋' }, t);
  const gid = store.db.prepare("SELECT id FROM guilds WHERE name = 'Hội Thử Ngân Sách'").get().id;
  social.joinGuild(mem, gid, t);
  social.guildView(lead, t); // tạo dự án tuần
  const week = weekKey(dayKey(t));
  const row = store.db.prepare('SELECT * FROM guild_projects WHERE guild_id = ? AND week = ?').get(gid, week);
  const def = GUILD_PROJECTS[row.project];
  // Chỉ còn thiếu 1 lô của mặt hàng đầu tiên.
  const [first, ...rest] = Object.keys(def.needs);
  const progress = Object.fromEntries([[first, (def.needs[first] - 1) * LOT], ...rest.map((c) => [c, def.needs[c] * LOT])]);
  store.db.prepare('UPDATE guild_projects SET progress = ? WHERE guild_id = ? AND week = ?').run(JSON.stringify(progress), gid, week);
  market.addGoods(lead, first, LOT, t);
  // Ngân sách thị trấn chỉ còn đủ cho đúng một phần thưởng.
  post({ account: 'treasury', delta: def.reward - treasuryBalance(), kind: 'admin', now: t });
  const res = social.contribute(lead, first, LOT, t);
  assert.match(res.message, /1\/2 thành viên/);
  assert.doesNotMatch(res.message, /mỗi thành viên/);
});
