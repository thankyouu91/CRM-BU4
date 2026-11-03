// Kiểm thử quản trị viên đưa bot vào / rút bot khỏi gia tộc: bot đi qua đúng route của người chơi, nên luật vẫn áp dụng
// (cấp mở Gia tộc, gia tộc đủ người), tộc trưởng bot không bị rút, mỗi lần tối đa BOT_CLAN_MAX bot, có ghi nhật ký quản trị.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const { api } = await import('../server/routes.js');
const bots = await import('../server/bots.js');
const { clanConfig } = await import('../server/clans.js');
const { clanPerks } = await import('../../public/ta-tua/game/js/shared/clan.js');

const now = Date.now();
migrate(now);
runDue(now);
let seed = 23;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const unlock = clanConfig().unlockLevel;
const addPet = (userId, level) => store.db.prepare('INSERT INTO pets (owner_id, name, species, born_at, level, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(userId, 'Bé', 'meo_vang', now, level, now);
const makeBot = (level) => {
  const id = bots.createBot(now, rand);
  if (level) addPet(id, level);
  return id;
};
const clanOf = (userId) => {
  const row = store.db.prepare('SELECT clan_id, role FROM clan_members WHERE user_id = ?').get(userId);
  return row && { ...row };
};

const leader = store.createUser('toctruong_that', 'x', now);
addPet(leader, unlock);
const clanId = Number(store.db.prepare('INSERT INTO clans (name, emblem, color, leader_id, created_at) VALUES (?, ?, ?, ?, ?)')
  .run('Nhà Thật', '🏯', '#123456', leader, now).lastInsertRowid);
store.db.prepare('INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, ?, ?, ?)').run(leader, clanId, 'leader', now);
const capacity = clanPerks(1).maxMembers;

test('đưa bot vào: chỉ bot đủ cấp mở Gia tộc vào được, bé cấp cao trước, có ghi nhật ký quản trị', async () => {
  const young = makeBot(unlock - 1);
  const ready = [makeBot(unlock), makeBot(unlock + 3)];
  const out = await bots.sendBotsToClan(api, clanId, 3, 'test');
  assert.equal(out.joined.length, 2);
  for (const id of ready) assert.deepEqual(clanOf(id), { clan_id: clanId, role: 'member' });
  assert.equal(clanOf(young), undefined, 'bé chưa đủ cấp thì không vào được');
  assert.equal(out.failed.length, 1, 'lý do thất bại được gom lại');
  const log = store.adminLogs(5).find((l) => l.action === 'bots_join_clan');
  assert.equal(log.details.clanId, clanId);
  assert.equal(log.details.bots.length, 2);
});

test('gia tộc đầy thì dừng, không vượt sức chứa theo cấp', async () => {
  for (let i = 0; i < capacity + 3; i += 1) makeBot(unlock);
  await bots.sendBotsToClan(api, clanId, bots.BOT_CLAN_MAX, 'test');
  const members = store.db.prepare('SELECT COUNT(*) AS n FROM clan_members WHERE clan_id = ?').get(clanId).n;
  assert.equal(members, capacity);
  const card = bots.adminBotsView(now).clans.find((c) => c.id === clanId);
  assert.equal(card.members, capacity);
  assert.equal(card.bots, capacity - 1, 'trừ tộc trưởng người thật');
  assert.equal(card.maxMembers, capacity);
});

test('rút bot: chỉ bot thường rời, người thật và tộc trưởng ở lại', async () => {
  const botLeaderClan = Number(store.db.prepare('INSERT INTO clans (name, emblem, color, leader_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('Nhà Bot', '🐉', '#654321', makeBot(unlock), now).lastInsertRowid);
  const botLeader = store.db.prepare('SELECT leader_id FROM clans WHERE id = ?').get(botLeaderClan).leader_id;
  store.db.prepare('INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, ?, ?, ?)').run(botLeader, botLeaderClan, 'leader', now);
  const recalled = await bots.recallBotsFromClan(api, botLeaderClan, 5, 'test');
  assert.equal(recalled.left.length, 0, 'tộc trưởng bot không bị rút');
  assert.deepEqual(clanOf(botLeader), { clan_id: botLeaderClan, role: 'leader' });

  const out = await bots.recallBotsFromClan(api, clanId, 4, 'test');
  assert.equal(out.left.length, 4);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM clan_members WHERE clan_id = ?').get(clanId).n, capacity - 4);
  assert.deepEqual(clanOf(leader), { clan_id: clanId, role: 'leader' });
});

test('giới hạn: số bot 1–BOT_CLAN_MAX, gia tộc phải còn hoạt động', async () => {
  await assert.rejects(bots.sendBotsToClan(api, clanId, 0, 'test'), /Số bot/);
  await assert.rejects(bots.sendBotsToClan(api, clanId, bots.BOT_CLAN_MAX + 1, 'test'), /Số bot/);
  await assert.rejects(bots.sendBotsToClan(api, 99999, 1, 'test'), /Không tìm thấy gia tộc/);
});

test('route quản trị trả về kết quả và bảng bot mới', async () => {
  const { internalApi } = await import('../server/internal.js');
  const { buildResponse } = await import('../server/router.js');
  makeBot(unlock);
  const req = { method: 'POST', url: '/admin/bots/join-clan', path: '/admin/bots/join-clan', query: {}, params: {}, body: { clanId, count: 1, actor: 'test' }, ip: null, get: () => undefined };
  const { res, done } = buildResponse();
  await internalApi.handle(req, res);
  const out = await done;
  const body = JSON.parse(out.body);
  assert.equal(out.status, 200);
  assert.equal(body.result.joined.length, 1, JSON.stringify(body.result));
  assert.ok(Array.isArray(body.clans));
});
