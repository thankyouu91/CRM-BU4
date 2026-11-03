// Thả bé (người chơi) và xóa bé (quản trị viên): trang phục về tủ, ô được trả lại, bé đang bận / bé cuối không thả được.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, GameError, HOUR } = await import('../server/game.js');
const { migrate } = await import('../server/migrate.js');
const { post } = await import('../server/ledger.js');
const gear = await import('../server/gear.js');
const { releasePet } = await import('../server/lifecycle.js');
const { internalApi } = await import('../server/internal.js');
const { buildResponse } = await import('../server/router.js');

migrate();
const now = Date.now();

function player(n = 2) {
  const id = store.createUser(`tha${Math.random().toString(36).slice(2, 8)}`, 'x', now - 30 * DAY);
  post({ userId: id, delta: 10_000, kind: 'opening', now });
  const pets = Array.from({ length: n }, (_, i) => store.insertPet(id, `Bé ${i + 1}`, 'otter', now - 20 * DAY));
  store.setActivePet(id, pets[0]);
  return { id, pets };
}

test('thả bé: trang phục đang đeo về tủ, bé chính đổi sang bé còn lại, kỹ năng và chỗ đeo bị xóa', () => {
  const p = player(2);
  const g = gear.createGear(p.id, 'bow', { source: 'test', tier: 'blue', affixes: { luck: 2 } });
  gear.equipGear(p.id, { ...store.getPet(p.pets[0]), wear: {} }, g.id);
  store.setSkill(p.pets[0], 'craft', 30);
  assert.equal(gear.listGear(p.id).find((x) => x.id === g.id).wornBy, p.pets[0]);
  releasePet(p.id, p.pets[0], { now });
  assert.equal(store.getPet(p.pets[0]), undefined);
  assert.equal(store.listPets(p.id).length, 1);
  assert.equal(store.getUser(p.id).active_pet_id, p.pets[1]);
  const back = gear.listGear(p.id).find((x) => x.id === g.id);
  assert.ok(back, 'trang phục vẫn thuộc người chơi');
  assert.equal(back.wornBy, null);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM pet_skills WHERE pet_id = ?').get(p.pets[0]).n, 0);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM memorials WHERE user_id = ?').get(p.id).n, 0, 'không lập bia');
  assert.equal(store.getUser(p.id).locked_slots ?? 0, 0, 'không khóa ô');
});

test('không thả được bé cuối cùng, bé đang bận hay bé đang đứng máy ngành chiến lược', () => {
  const solo = player(1);
  assert.throws(() => releasePet(solo.id, solo.pets[0], { now }), /duy nhất/);
  const p = player(3);
  store.db.prepare('UPDATE pets SET busy_until = ?, busy_kind = ? WHERE id = ?').run(now + HOUR, 'work', p.pets[0]);
  assert.throws(() => releasePet(p.id, p.pets[0], { now }), /đang bận/);
  store.db.prepare('INSERT INTO clan_operators (plot_id, clan_id, user_id, pet_id, since) VALUES (?, ?, ?, ?, ?)').run(999_001, 1, p.id, p.pets[1], now);
  assert.throws(() => releasePet(p.id, p.pets[1], { now }), /đứng máy/);
  const other = player(2);
  assert.throws(() => releasePet(other.id, p.pets[2], { now }), GameError, 'không thả bé của người khác');
});

test('quản trị viên xóa được bé đang bận hay đang đứng máy, trả lương ca đã làm, có lý do và ghi nhật ký', async () => {
  const p = player(1);
  const pet = p.pets[0];
  store.db.prepare('UPDATE pets SET busy_until = ?, busy_kind = ? WHERE id = ?').run(now + HOUR, 'work', pet);
  store.db.prepare('INSERT INTO clan_operators (plot_id, clan_id, user_id, pet_id, since) VALUES (?, ?, ?, ?, ?)').run(999_002, 1, p.id, pet, now);
  store.db.prepare('INSERT INTO shifts (user_id, pet_id, career, rank, hours, pay, day, starts_at, ends_at) VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?)')
    .run(p.id, pet, 'baker', 37, '2026-10-31', now - 2 * HOUR, now - HOUR);
  const coins = store.getUser(p.id).coins;
  const call = async (body) => {
    const path = `/admin/players/${p.id}/pets/${pet}/delete`;
    const { res, done } = buildResponse();
    await internalApi.handle({ method: 'POST', url: path, path, query: {}, params: {}, body: { actor: 'Admin Test', ...body }, ip: null, get: () => undefined }, res);
    return done;
  };
  assert.equal((await call({})).status, 400, 'thiếu lý do');
  const out = await call({ reason: 'người chơi nhờ xóa' });
  assert.equal(out.status, 200, out.body);
  assert.equal(store.getPet(pet), undefined);
  assert.equal(store.getUser(p.id).coins, coins + 37, 'lương ca đã làm được trả nốt');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM clan_operators WHERE pet_id = ?').get(pet).n, 0);
  assert.equal(store.getUser(p.id).active_pet_id, null);
  const log = store.adminLogs(5).find((l) => l.action === 'pet_delete');
  assert.equal(log.details.reason, 'người chơi nhờ xóa');
  assert.equal(log.user_id, p.id);
});
