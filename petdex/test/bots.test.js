// Kiểm thử cư dân tự động trên DB tạm: công tắc tắt, tăng dần số bot, ngân sách hành động mỗi nhịp, bot đi qua đúng
// route của người chơi (hạn mức, luật), cờ is_bot không lộ ra API của người chơi, không tặng quà quản trị cho bot.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const { api } = await import('../server/routes.js');
const bots = await import('../server/bots.js');
const { RULES } = await import('../server/game.js');

const now = Date.now();
migrate(now);
runDue(now);
let seed = 17;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Cho mọi bot thức cả ngày, đang trong phiên và tới lượt ngay, để nhịp kiểm thử không phụ thuộc giờ chạy.
const wakeAll = (online = true) => {
  for (const b of store.db.prepare('SELECT user_id, persona FROM bots').all()) {
    store.db.prepare('UPDATE bots SET persona = ?, next_at = 0, session_end = ? WHERE user_id = ?')
      .run(JSON.stringify({ ...JSON.parse(b.persona), wake: 0, sleep: 24 }), online ? now + 3_600_000 : null, b.user_id);
  }
};
const count = () => store.db.prepare('SELECT COUNT(*) AS n FROM bots').get().n;

test('tên kiểu Việt Nam: tên đăng nhập hợp lệ như người thật, họ tên có dấu', () => {
  for (let i = 0; i < 50; i += 1) {
    const n = bots.makeName(rand);
    assert.match(n.username, /^[a-z0-9_]{3,20}$/);
    assert.ok(n.display.split(' ').length >= 2);
  }
});

test('công tắc tắt: không tạo bot, không hành động', async () => {
  const r = await bots.runBots(api, now, rand);
  assert.equal(r.created, 0);
  assert.equal(r.actions, 0);
  assert.equal(r.stopped, 'off');
  assert.equal(count(), 0);
});

test('tăng dần tới mục tiêu: mỗi nhịp tạo tối đa 5 bot, mỗi bot chỉ có xu khởi đầu', async () => {
  bots.setBotConfig({ enabled: true, target: 12 }, 'test');
  await bots.runBots(api, now, rand);
  assert.equal(count(), 5);
  await bots.runBots(api, now, rand);
  await bots.runBots(api, now, rand);
  assert.equal(count(), 12);
  await bots.runBots(api, now, rand);
  assert.equal(count(), 12);
  const b = store.db.prepare('SELECT u.* FROM bots b JOIN users u ON u.id = b.user_id LIMIT 1').get();
  assert.equal(b.is_bot, 1);
  assert.equal(b.pass_hash, '', 'không đăng nhập bằng mật khẩu');
  assert.equal(b.invite_id, null, 'không qua link mời');
  assert.ok(b.coins <= RULES.startCoins);
  assert.equal(bots.setBotConfig({ target: 9999 }, 'test').target, 1000);
  assert.deepEqual(bots.setBotConfig({ onlineMin: 80, onlineMax: 60 }, 'test').onlineMin, 60, 'tối thiểu không quá tối đa');
  bots.setBotConfig({ onlineMin: 50, onlineMax: 100 }, 'test');
  bots.setBotConfig({ target: 12 }, 'test');
});

test('ngân sách mỗi nhịp: tối đa `budget` hành động hoặc hết thời gian thì dừng, bot gặp lỗi luật chơi thì bỏ qua', async () => {
  wakeAll();
  const r = await bots.runBots(api, now, rand, { budget: 4 });
  assert.ok(r.actions <= 4);
  assert.equal(r.stopped, 'budget');
  wakeAll();
  const t = await bots.runBots(api, now, rand, { timeBudgetMs: 0 });
  assert.equal(t.actions, 0);
  assert.equal(t.stopped, 'time');
  assert.equal(bots.adminBotsView(now).lastTick.stopped, 'time');
  // Nhiều nhịp: bot nhận nuôi bé, đi làm, mua đồ... qua route thật, không làm hỏng nhịp.
  const seen = new Set();
  for (let i = 0; i < 8; i += 1) {
    wakeAll();
    const out = await bots.runBots(api, now, rand);
    assert.ok(out.actions <= bots.BOT_RULES.budget);
  }
  for (const r2 of store.db.prepare('SELECT last_action FROM bots').all()) seen.add(r2.last_action);
  assert.ok(store.db.prepare('SELECT COUNT(*) AS n FROM pets p JOIN users u ON u.id = p.owner_id WHERE u.is_bot = 1').get().n >= 10, 'bot đã nhận nuôi bé');
  assert.ok(seen.size >= 2, `bot làm nhiều việc khác nhau: ${[...seen]}`);
});

test('online: chỉ bot trong phiên mới làm việc; số bot online giữ trong khoảng quản trị viên đặt', async () => {
  // Không ai online, tới lượt nhưng vượt trần online 3 → chỉ 3 bot vào phiên; bot offline không làm gì.
  wakeAll(false);
  bots.setBotConfig({ onlineMin: 0, onlineMax: 3 }, 'test');
  const before = store.db.prepare('SELECT SUM(actions) AS n FROM bots').get().n;
  const r = await bots.runBots(api, now, rand);
  assert.ok(r.online <= 3, `online ${r.online}`);
  assert.ok(store.db.prepare('SELECT SUM(actions) AS n FROM bots').get().n - before <= 3);
  // Dưới mức tối thiểu thì mở thêm phiên cho bot đang giờ thức.
  wakeAll(false);
  bots.setBotConfig({ onlineMin: 8, onlineMax: 10 }, 'test');
  const r2 = await bots.runBots(api, now, rand, { budget: 0 });
  assert.ok(r2.online >= 8 && r2.online <= 10, `online ${r2.online}`);
  bots.setBotConfig({ onlineMin: 50, onlineMax: 100 }, 'test');
  // Lịch phiên: rơi vào giờ thức của bot.
  const persona = { wake: 8, sleep: 22, sessions: 2, zeal: 1 };
  for (let i = 0; i < 20; i += 1) {
    const at = bots.nextSessionStart(persona, now + i * 3_600_000, rand);
    const h = new Date(at + 7 * 3_600_000).getUTCHours();
    assert.ok(h >= 8 && h <= 22, `giờ ${h}`);
  }
});

test('bot đi qua đúng luật của route: hạn mức, số dư', async () => {
  const bot = store.db.prepare('SELECT * FROM bots LIMIT 1').get();
  const r = await bots.botCall(api, bot.token, 'POST', '/shop/buy', { itemId: 'onigiri', qty: 99 });
  assert.equal(r.status, 400);
  const broke = await bots.botCall(api, bot.token, 'POST', '/bank/savings', { action: 'deposit', amount: 10_000_000 });
  assert.equal(broke.ok, false);
});

test('cờ is_bot không bao giờ có trong API của người chơi', async () => {
  const bot = store.db.prepare('SELECT * FROM bots LIMIT 1').get();
  const other = store.db.prepare('SELECT * FROM bots LIMIT 1 OFFSET 1').get();
  const paths = ['/me', '/leaderboard', '/leaderboard?by=networth', '/clans', '/arena', '/chat/world', '/jobs', '/market', '/land', `/friends/${other.user_id}/visit`];
  for (const p of paths) {
    const r = await bots.botCall(api, bot.token, 'GET', p);
    const text = JSON.stringify(r.body ?? {});
    assert.ok(!/is_?bot/i.test(text), `${p} lộ cờ bot`);
    assert.ok(!text.includes(bot.token), `${p} lộ phiên của bot`);
  }
});

test('kết thúc: tắt thì nhịp sau dừng hẳn; bảng quản trị thấy số bot và số người thật', async () => {
  bots.setBotConfig({ enabled: false }, 'test');
  wakeAll(true);
  const before = store.db.prepare('SELECT SUM(actions) AS n FROM bots').get().n;
  const r = await bots.runBots(api, now, rand);
  assert.equal(r.actions, 0);
  assert.equal(store.db.prepare('SELECT SUM(actions) AS n FROM bots').get().n, before);
  const view = bots.adminBotsView();
  assert.equal(view.count, 12);
  assert.equal(view.players.bots, 12);
  assert.equal(view.players.real, view.players.total - 12);
  const overview = store.usersOverview(now);
  assert.equal(overview.bots, 12);
  assert.equal(overview.realPlayers.total, view.players.real);
});

test('Đấu trường: gia tộc bot thách đấu gia tộc người thật tối đa 1 lần mỗi 7 ngày (gia tộc bot với nhau thì không giới hạn)', () => {
  const real = store.createUser('nguoithat_dt', 'x', now);
  const clans = store.db.prepare('INSERT INTO clans (name, emblem, color, leader_id, created_at) VALUES (?, ?, ?, ?, ?)');
  const realClan = Number(clans.run('Người Thật', '🏯', '#123456', real, now).lastInsertRowid);
  const botUser = store.db.prepare('SELECT user_id FROM bots LIMIT 1').get().user_id;
  const botClan = Number(clans.run('Bot Tộc', '🐉', '#654321', botUser, now).lastInsertRowid);
  const DAY = 86_400_000;
  assert.equal(bots.botClanRecent({}, realClan, now), false);
  assert.equal(bots.botClanRecent({ realChallengeAt: now - 3 * DAY }, realClan, now), true);
  assert.equal(bots.botClanRecent({ realChallengeAt: now - 8 * DAY }, realClan, now), false);
  assert.equal(bots.botClanRecent({ realChallengeAt: now - DAY }, botClan, now), false);
});
