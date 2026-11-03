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

// ---------------------------------------------------------------- bộ não của bot (bot-brain.js)

const brain = await import('../server/bot-brain.js');
const catalog = (await bots.botCall(api, '', 'GET', '/catalog')).body;

/** Trạng thái /me giả: một bé cấp `level`, khỏe, no, sạch; quà ngày đã nhận. */
const fakeMe = ({ pet = {}, coins = 500, inventory = {}, daily = 1, jobs = 0, level = 5 } = {}) => ({
  user: { id: 1, coins, activePetId: 1, dailyReadyAt: daily },
  pets: [{
    id: 1, level, fullness: 85, happiness: 80, energy: 80, hygiene: 85, health: 90, sick: null, busyUntil: null,
    age: { weeks: 30 }, skills: { craft: 10, strength: 12 }, gear: {}, wearLimit: 3, ...pet,
  }],
  inventory, gear: [], economy: { priceIndex: 1 }, badges: { jobs },
  essentials: { food: { npcLeft: 3, npcPriceFactor: 1, stock: [0, 0, 0], prices: [24, 29, 36] } },
});

/** Bối cảnh một lượt với route giả: ghi lại mọi lần gọi, trả lời theo `answer(method, path, body)`. */
function fakeCtx({ me = fakeMe(), persona = {}, state = {}, answer = () => ({ ok: true, body: {} }), helpers = {}, r = 0.5 } = {}) {
  const log = [];
  const call = async (method, path, body) => {
    log.push({ method, path, body });
    return answer(method, path, body) ?? { ok: false, body: null };
  };
  const traits = { zeal: 1, social: 0.5, trader: 0.5, fighter: 0.2, producer: 0.5, carer: 0.5, ...persona };
  const ctx = brain.makeContext({ me, catalog, persona: traits, state, now, rand: () => r, call, helpers, userId: 1 });
  return { ctx, log };
}

test('bộ não: bé đói lả thì cho ăn trước mọi việc khác, dùng món no lâu nhất trong túi', async () => {
  const { ctx, log } = fakeCtx({ me: fakeMe({ pet: { fullness: 10 }, inventory: { boba: 1, onigiri: 2 } }) });
  const list = brain.candidates(ctx);
  for (let i = 0; i < 20; i += 1) assert.equal(brain.pickWeighted(list, () => i / 20).key, 'feed');
  assert.equal(await brain.think(ctx), 'feed');
  const posts = log.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, '/pets/1/use');
  assert.equal(posts[0].body.itemId, 'onigiri');
});

test('bộ não: hết đồ ăn thì mua món vừa túi tiền ở Siêu thị, trong hạn mức NPC', async () => {
  const { ctx, log } = fakeCtx({ me: fakeMe({ pet: { fullness: 10 }, coins: 60 }), r: 0.99 });
  assert.equal(await brain.think(ctx), 'buy_food');
  const buy = log.find((c) => c.path === '/shop/buy');
  assert.ok(buy.body.qty >= 1 && buy.body.qty <= 3);
  assert.ok(catalog.items[buy.body.itemId].price * buy.body.qty <= 60);
  assert.ok(!catalog.items[buy.body.itemId].teaShop, 'đồ uống quầy không mua ở Siêu thị');
  // Hết hạn mức NPC hôm nay thì không mua đồ NPC nữa (ghé quầy trà sữa hoặc vào bếp).
  const out = fakeMe({ pet: { fullness: 10 }, coins: 300, level: 2 });
  out.essentials.food.npcLeft = 0;
  const none = fakeCtx({ me: out, r: 0.99, answer: (m) => (m === 'GET' ? { ok: true, body: { stalls: [], left: 10 } } : { ok: true, body: {} }) });
  await brain.think(none.ctx);
  assert.ok(!none.log.some((c) => c.path === '/shop/buy' && catalog.items[c.body.itemId].type === 'food'));
});

test('bộ não: quà ngày, lương chờ nhận và bé ốm là việc cần làm ngay', () => {
  const { ctx } = fakeCtx({ me: fakeMe({ daily: 0, jobs: 1, pet: { sick: { id: 'cold' } } }) });
  const needs = brain.candidates(ctx).filter((c) => c.need).map((c) => c.key).sort();
  assert.deepEqual(needs, ['claim_shift', 'clinic', 'daily']);
});

test('bộ não: tối sắp thoát game thì cho bé ăn no trước', () => {
  const me = fakeMe({ pet: { fullness: 60 }, inventory: { fish: 2 } });
  const later = fakeCtx({ me });
  assert.ok(!brain.candidates(later.ctx).find((c) => c.key === 'feed')?.need);
  const ctx = brain.makeContext({ me, catalog, persona: {}, state: {}, now, rand: () => 0.5, call: async () => ({ ok: true }), userId: 1, sessionEnd: now + 5 * 60_000 });
  assert.ok(brain.candidates(ctx).find((c) => c.key === 'feed')?.need);
});

test('bộ não: chưa có gia tộc thì xin vào gia tộc còn chỗ, cấp gần với mình; người ít giao du chơi một mình', async () => {
  const clans = [
    { id: 7, level: 1, members: 12, maxMembers: 12 },
    { id: 8, level: 6, members: 3, maxMembers: 32 },
    { id: 9, level: 1, members: 5, maxMembers: 12 },
  ];
  const answer = (method, path) => (method === 'GET' && path === '/clans' ? { ok: true, body: { clan: null, clans, config: { createCost: 3000 } } } : { ok: true, body: {} });
  const { ctx, log } = fakeCtx({ me: fakeMe({ level: 6 }), answer, r: 0.1 });
  const step = brain.candidates(ctx).find((c) => c.key === 'clan');
  assert.ok(step, 'đủ cấp mà chưa có gia tộc thì tìm gia tộc');
  assert.equal(await step.run(ctx), 'clan_join');
  assert.equal(log.find((c) => c.method === 'POST').path, '/clans/9/join', 'bỏ qua gia tộc đủ người, chọn gia tộc cùng cấp');
  assert.deepEqual(ctx.state.clan, { id: 9, role: 'member' });
  const loner = fakeCtx({ me: fakeMe({ level: 6 }), persona: { social: 0.05 } });
  assert.ok(!brain.candidates(loner.ctx).some((c) => c.key === 'clan'));
  const young = fakeCtx({ me: fakeMe({ level: catalog.unlocks.clan - 1 }) });
  assert.ok(!brain.candidates(young.ctx).some((c) => c.key === 'clan'), 'chưa đủ cấp gia tộc');
});

test('bộ não: thành viên góp quỹ vừa phải theo định mức tuần', async () => {
  const clan = { id: 4, role: 'member', quota: 300, members: [{ id: 1, role: 'member', week: 120, donated: 500 }] };
  const answer = (method) => (method === 'GET' ? { ok: true, body: { clan, clans: [] } } : { ok: true, body: {} });
  const { ctx, log } = fakeCtx({ me: fakeMe({ level: 6, coins: 2000 }), state: { clan: { id: 4, role: 'member' } }, answer, r: 0.1 });
  assert.equal(await brain.candidates(ctx).find((c) => c.key === 'clan').run(ctx), 'clan_donate');
  const amount = log.find((c) => c.path === '/clans/donate').body.amount;
  assert.ok(amount >= 10 && amount <= 180, `góp ${amount}`);
});

test('bộ não: đủ cấp mở quầy và đủ tiền thì mở quầy trà sữa ở chỗ vừa túi tiền', async () => {
  const unlock = catalog.unlocks.business;
  const poor = fakeCtx({ me: fakeMe({ level: unlock, coins: 900 }), persona: { producer: 0.9 } });
  assert.ok(!brain.candidates(poor.ctx).some((c) => c.key === 'stall_open'), 'chưa đủ tiền giấy phép thì để dành');
  assert.ok(poor.ctx.goal > 0, 'đang để dành mở quầy');
  const { ctx, log } = fakeCtx({ me: fakeMe({ level: unlock, coins: 3200 }), persona: { producer: 0.9 } });
  const step = brain.candidates(ctx).find((c) => c.key === 'stall_open');
  assert.ok(step);
  assert.equal(await step.run(ctx), 'stall_open');
  assert.equal(log.find((c) => c.path === '/business/open').body.location, 'alley', '3.200 xu chỉ đủ mở ở Hẻm nhỏ');
  assert.ok(ctx.state.biz);
  const low = fakeCtx({ me: fakeMe({ level: unlock - 1, coins: 9000 }), persona: { producer: 0.9 } });
  assert.ok(!brain.candidates(low.ctx).some((c) => c.key.startsWith('stall')), 'chưa đủ cấp thì không mở quầy');
});

test('bộ não: quầy đã mở thì cho bé trực, nhập nguyên liệu, giá thực đơn quanh giá tham chiếu', async () => {
  const recipes = Object.fromEntries(Object.entries(catalog.business.recipes).map(([id, r]) => [id, { ...r, ref: 22, cost: 9.5 }]));
  const business = (stock, openNow, price = 22) => ({
    id: 5, location: 'alley', slots: 2, openNow, days: [], upgrades: {}, jobPost: null,
    menu: [{ recipe: 'boba_milk_tea', price, ref: 22, stock }],
  });
  const run = async (b) => {
    const answer = (m) => (m === 'GET' ? { ok: true, body: { business: b, recipes, goods: {} } } : { ok: true, body: {} });
    const { ctx, log } = fakeCtx({ me: fakeMe({ level: 5, coins: 1500 }), state: { biz: { id: 5 } }, answer });
    const out = await brain.candidates(ctx).find((c) => c.key === 'stall').run(ctx);
    return { out, post: log.find((c) => c.method === 'POST') };
  };
  const duty = await run(business(30, false));
  assert.equal(duty.out, 'stall_duty');
  assert.equal(duty.post.body.businessId, 5);
  const restock = await run(business(0, true));
  assert.equal(restock.out, 'stall_restock');
  assert.deepEqual([restock.post.body.side, restock.post.body.type], ['buy', 'market']);
  assert.ok(restock.post.body.qty >= 5 && restock.post.body.qty <= 400);
  const menu = await run(business(30, true, 80));
  assert.equal(menu.out, 'stall_menu');
  assert.equal(menu.post.body.menu.length, 2, 'thêm món cho đủ ô thực đơn');
  for (const m of menu.post.body.menu) assert.ok(m.price >= 22 * 0.9 && m.price <= 22 * 1.2, `giá ${m.price}`);
});

test('bộ não: lệnh Sàn nhỏ, trong hạn mức NPC, lệnh giới hạn trong biên giá; không bán khi hạn mức thị trấn sắp cạn', () => {
  const band = catalog.market.band;
  const c = (id, price, { town = 0.8 } = {}) => ({
    id, price, bid: price * 0.99, ask: price * 1.01, npcLeft: { buy: 400, sell: 400 },
    town: { buy: { total: 3000, left: 3000 * town }, sell: { total: 3000, left: 3000 * town } },
  });
  const base = (id) => catalog.commodities[id].base;
  let k = 3;
  const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  let limits = 0;
  let orders = 0;
  for (let i = 0; i < 300; i += 1) {
    const { ctx } = fakeCtx({ me: fakeMe({ coins: 2000 }), persona: { trader: rnd() } });
    ctx.rand = rnd;
    const view = {
      commodities: [c('milk', base('milk') * 0.8), c('sugar', base('sugar') * 1.3), c('cane', base('cane') * 1.25, { town: 0.1 })],
      holdings: { sugar: { qty: 300, avgCost: base('sugar'), lots: [] }, cane: { qty: 300, avgCost: 1, lots: [] } },
    };
    const o = brain.marketOrder(ctx, view);
    if (!o) continue;
    orders += 1;
    assert.notEqual(o.commodity, 'cane', 'hạn mức chung của thị trấn sắp cạn thì không bán thêm');
    assert.equal(o.commodity, o.side === 'sell' ? 'sugar' : 'milk', 'bán món đang cao hơn giá tham chiếu, mua món đang rẻ');
    const cur = view.commodities.find((x) => x.id === o.commodity);
    assert.ok(Number.isInteger(o.qty) && o.qty >= 1 && o.qty <= 50 && o.qty <= cur.npcLeft[o.side], `khối lượng ${o.qty}`);
    if (o.type === 'limit') {
      limits += 1;
      assert.ok(Math.abs(o.limit / cur.price - 1) <= band, `giá đặt ${o.limit} ngoài biên ±${band * 100}% của ${cur.price}`);
      assert.ok(o.side === 'buy' ? o.limit < cur.price : o.limit > cur.price);
    }
  }
  assert.ok(orders > 200 && limits > 10, `${orders} lệnh, ${limits} lệnh giới hạn`);
  const broke = fakeCtx({ me: fakeMe({ coins: 100 }) });
  assert.equal(brain.marketOrder(broke.ctx, { commodities: [c('milk', base('milk') * 0.7)], holdings: {} }), null, 'hết tiền tiêu vặt thì không đầu cơ');
  const dear = fakeCtx({ me: fakeMe({ coins: 3000 }) });
  assert.equal(brain.marketOrder(dear.ctx, { commodities: [c('milk', base('milk') * 1.2)], holdings: {} }), null, 'không mua khi giá cao hơn giá tham chiếu');
});

test('bộ não: người thích sản xuất đủ cấp, đủ vốn thì xây xưởng; xưởng có nguyên liệu thì cho bé đứng máy', async () => {
  const unlock = catalog.unlocks.factory;
  const { ctx, log } = fakeCtx({ me: fakeMe({ level: unlock, coins: 8000 }), persona: { producer: 0.9 }, state: { biz: { id: 2, loc: 'alley' } } });
  const build = brain.candidates(ctx).find((c) => c.key === 'factory_build');
  assert.ok(build);
  assert.equal(await build.run(ctx), 'factory_build');
  assert.ok(catalog.factory.kinds[log.find((c) => c.path === '/factory/build').body.kind]);
  const kinds = catalog.factory.kinds;
  const answer = (m, p) => (m === 'GET' && p === '/factory'
    ? { ok: true, body: { factories: [{ id: 4, kind: 'dryer', level: 0, canRun: 12, duty: [] }], kinds, goods: { tea_leaf: 240 } } }
    : { ok: true, body: {} });
  const run = fakeCtx({ me: fakeMe({ level: unlock, coins: 3000 }), persona: { producer: 0.9 }, state: { factory: { id: 4, kind: 'dryer' } }, answer });
  assert.equal(await brain.candidates(run.ctx).find((c) => c.key === 'factory').run(run.ctx), 'factory_shift');
  assert.equal(run.log.find((c) => c.method === 'POST').body.factoryId, 4);
});

test('bộ não: Chợ Phiên mua món ăn không đắt hơn giá tham chiếu, bày bán món nhà nấu dư với giá trong khoảng cho phép', () => {
  const [lo, hi] = catalog.bazaar.band;
  const view = {
    canSell: true, open: 0,
    listings: [
      { id: 1, kind: 'item', ref: 'onigiri', type: 'food', price: 40, refPrice: 25, mine: false },
      { id: 2, kind: 'dish', ref: 'grilled_fish', type: 'dish', price: 20, refPrice: 22, mine: false },
    ],
    sellable: { dishes: [{ ref: 9, refPrice: 30 }], items: [], gear: [] },
  };
  const hungry = fakeCtx({ me: fakeMe({ pet: { fullness: 50 }, coins: 800 }) });
  assert.equal(brain.bazaarMove(hungry.ctx, view).path, '/bazaar/2/buy', 'món đắt gấp rưỡi giá tham chiếu thì bỏ qua');
  const full = fakeCtx({ me: fakeMe({ pet: { fullness: 90 }, coins: 800 }) });
  const move = brain.bazaarMove(full.ctx, view);
  assert.equal(move.path, '/bazaar/list');
  assert.ok(move.body.price >= 30 * lo && move.body.price <= 30 * hi && move.body.price <= 30 * 1.3, `giá ${move.body.price}`);
});

test('bộ não: mỗi lượt tối đa 3 lần đọc và 1 lần ghi thành công', async () => {
  for (let i = 0; i < 60; i += 1) {
    let k = i + 1;
    const r = () => ((k = (k * 48271) % 2147483647) / 2147483647);
    const me = fakeMe({ level: 2 + (i % 9), coins: 200 + i * 120, pet: { fullness: 20 + i, hygiene: 15 + i }, daily: i % 3, jobs: i % 4 === 0 ? 1 : 0 });
    const state = i % 2 ? { biz: { id: 3 }, clan: { id: 2, role: 'leader' }, factory: { id: 4, kind: 'dryer' } } : {};
    const { ctx, log } = fakeCtx({ me, persona: { trader: r(), social: r(), producer: r() }, state });
    ctx.rand = r;
    await brain.think(ctx);
    assert.ok(log.filter((c) => c.method === 'GET').length <= 2, 'cùng GET /me là tối đa 3 lần đọc');
    assert.ok(log.filter((c) => c.method === 'POST').length <= 1, 'route giả luôn thành công: chỉ một lần ghi');
  }
});
