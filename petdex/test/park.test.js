// Công viên nhiều kênh: xếp kênh và trần mỗi kênh, ưu tiên bạn bè/gia tộc, phát sóng tách theo kênh,
// cư dân theo kênh, giới hạn tốc độ gửi vị trí. Chạy hub trong tiến trình với một transport giả.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY } = await import('../server/game.js');
const { migrate } = await import('../server/migrate.js');
const { createHub } = await import('../server/hub.js');
const { attachPlayground, MOVE_GAP_MS, RESIDENTS_PER_ROOM, ROOM_CAP, WORLD } = await import('../server/playground.js');

migrate();
const NOW = Date.now();
let seq = 0;

/** Người chơi có một bé chính và một phiên đăng nhập; `seenAgo` đặt lần hoạt động gần nhất (cho thứ tự cư dân). */
function player(seenAgo = 0) {
  const name = `pk${++seq}`;
  const id = store.createUser(name, 'x', NOW - 30 * DAY);
  const pet = store.insertPet(id, `Bé ${name}`, 'test_pet', NOW - 20 * DAY);
  store.setActivePet(id, pet);
  store.db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(NOW - seenAgo, id);
  const token = `tok-${name}`;
  store.createSession(token, id);
  return { id, token };
}

/** Client giả: gom mọi khung tin nhận được. */
function connect(hub, who) {
  const inbox = [];
  const transport = { send: (text) => inbox.push(JSON.parse(text)), close() {} };
  const socket = hub.connect(transport, { token: who.token });
  assert.ok(socket, 'kết nối được');
  const c = {
    socket,
    userId: who.id,
    send: (event, payload) => hub.message(socket, JSON.stringify([event, payload ?? null])),
    all: (event) => inbox.filter(([e]) => e === event).map(([, p]) => p),
    last: (event) => c.all(event).at(-1),
    clear: () => (inbox.length = 0),
    close: () => hub.closed(socket),
  };
  return c;
}

function park() {
  const hub = createHub();
  const pg = attachPlayground(hub);
  const clients = [];
  const join = (who, payload) => {
    const c = connect(hub, who);
    c.send('pg:join', payload);
    clients.push(c);
    return c;
  };
  const done = () => clients.forEach((c) => c.close());
  return { hub, pg, join, done };
}

const roomOf = (c) => c.last('pg:state')?.room;
const residentsOf = (c) => c.last('pg:state').players.filter((p) => p.offline);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('xếp kênh: lấp kênh số nhỏ nhất còn chỗ, mỗi kênh tối đa ROOM_CAP người', () => {
  const { join, pg, done } = park();
  const first = Array.from({ length: ROOM_CAP }, () => join(player()));
  assert.ok(first.every((c) => roomOf(c) === 1), 'kênh 1 nhận đủ 60 người');
  const extra = join(player());
  assert.equal(roomOf(extra), 2, 'người thứ 61 sang kênh 2');
  assert.deepEqual(pg.rooms().slice(0, 2), [{ n: 1, count: ROOM_CAP }, { n: 2, count: 1 }]);
  assert.equal(pg.rooms().length, 3, 'luôn có thêm một kênh trống để chọn');

  // Đổi sang kênh đầy bị từ chối; kênh 1 có chỗ trống thì người mới vào lại kênh 1.
  extra.send('pg:room', { room: 1 });
  assert.match(extra.last('pg:error').message, /đã đủ/);
  first[0].close();
  const late = join(player());
  assert.equal(roomOf(late), 1);
  assert.equal(pg.rooms()[0].count, ROOM_CAP);

  // Chọn kênh khác còn chỗ: nhận trạng thái kênh mới.
  const mover = first[1];
  mover.send('pg:room', { room: 2 });
  assert.equal(roomOf(mover), 2);
  assert.equal(pg.roomOf(mover.userId), 2);
  assert.deepEqual(new Set(mover.last('pg:state').players.filter((p) => !p.offline).map((p) => p.userId)), new Set([extra.userId, mover.userId]));
  // Kênh không tồn tại.
  extra.send('pg:room', { room: 999 });
  assert.match(extra.last('pg:error').message, /Không có kênh/);
  // Danh sách kênh theo yêu cầu.
  extra.send('pg:rooms');
  assert.deepEqual(extra.last('pg:rooms').rooms.slice(0, 2), [{ n: 1, count: ROOM_CAP - 1 }, { n: 2, count: 2 }]);
  done();
});

test('bạn bè và người cùng gia tộc được xếp chung kênh khi còn chỗ', () => {
  const { join, done } = park();
  const a = join(player());
  a.send('pg:room', { room: 3 });
  assert.equal(roomOf(a), 3);

  const friend = player();
  const link = store.db.prepare("INSERT INTO friends (user_id, friend_id, status, since) VALUES (?, ?, 'accepted', ?)");
  link.run(a.userId, friend.id, NOW);
  link.run(friend.id, a.userId, NOW);
  assert.equal(roomOf(join(friend)), 3, 'bạn bè vào kênh 3 dù kênh 1 còn trống');

  const mate = player();
  const member = store.db.prepare("INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, 77, 'member', ?)");
  member.run(a.userId, NOW);
  member.run(mate.id, NOW);
  assert.equal(roomOf(join(mate)), 3, 'người cùng gia tộc vào kênh 3');

  assert.equal(roomOf(join(player())), 1, 'người lạ vào kênh số nhỏ nhất');
  // Chọn kênh khi vào (ví dụ nối lại mạng) thắng ưu tiên bạn bè.
  const back = player();
  link.run(a.userId, back.id, NOW);
  link.run(back.id, a.userId, NOW);
  assert.equal(roomOf(join(back, { room: 2 })), 2);
  done();
});

test('phát sóng chỉ tới người cùng kênh: vào, đi, biểu cảm, rời', async () => {
  const { join, done } = park();
  const a = join(player());
  const b = join(player());
  const c = join(player(), { room: 2 });
  assert.deepEqual([roomOf(a), roomOf(b), roomOf(c)], [1, 1, 2]);
  assert.equal(a.all('pg:joined').length, 1, 'a thấy b vào');
  assert.equal(a.all('pg:joined').filter((p) => p.userId === c.userId).length, 0, 'a không thấy c ở kênh 2');
  [a, b, c].forEach((x) => x.clear());

  a.send('pg:move', { x: 400, y: 400 });
  a.send('pg:emote', { kind: 'wave' });
  assert.deepEqual(b.last('pg:moved'), { id: a.socket.id, x: 400, y: 400 });
  assert.equal(b.last('pg:emote').kind, 'wave');
  assert.equal(a.all('pg:moved').length, 0, 'không gửi lại vị trí cho chính mình');
  assert.equal(a.all('pg:emote').length, 1, 'biểu cảm có gửi lại cho mình để thấy hoạt ảnh');
  assert.equal(c.all('pg:moved').length + c.all('pg:emote').length, 0, 'kênh 2 không nghe gì');

  c.send('pg:move', { x: 10_000, y: -5 });
  assert.equal(a.all('pg:moved').length, 0);
  // Vị trí bị kẹp trong thế giới mới rộng 2000.
  b.send('pg:room', { room: 2 });
  const cInRoom2 = b.last('pg:state').players.find((p) => p.userId === c.userId);
  assert.deepEqual([cInRoom2.x, cInRoom2.y], [WORLD.maxX, WORLD.minY]);
  assert.equal(WORLD.width, 2000);

  // b rời kênh 1: a nghe pg:left, c (kênh 2) nghe b vào.
  assert.equal(a.last('pg:left').id, b.socket.id);
  assert.equal(c.last('pg:joined').userId, b.userId);
  c.clear();
  await wait(450); // qua khoảng chờ giữa hai biểu cảm
  a.send('pg:emote', { kind: 'spin' });
  a.close();
  assert.equal(c.all('pg:emote').length + c.all('pg:left').length, 0, 'kênh 2 không nghe a');
  done();
});

test('cư dân theo kênh: mỗi kênh tối đa RESIDENTS_PER_ROOM, không trùng giữa các kênh', () => {
  // Thêm nhiều người vắng mặt hoạt động gần đây để mỗi kênh đều đủ cư dân.
  for (let i = 0; i < RESIDENTS_PER_ROOM * 3; i++) player(1_000 + i);
  const { join, pg, done } = park();
  const a = join(player());
  const ra = residentsOf(a);
  assert.equal(ra.length, RESIDENTS_PER_ROOM);
  const b = join(player(), { room: 2 });
  const rb = residentsOf(b);
  assert.equal(rb.length, RESIDENTS_PER_ROOM);
  const ids = (list) => new Set(list.map((p) => p.userId));
  assert.equal([...ids(ra)].filter((id) => ids(rb).has(id)).length, 0, 'hai kênh không chung cư dân');
  assert.ok(!ids(ra).has(a.userId) && !ids(rb).has(b.userId), 'người đang online không là cư dân');
  const perRoom = new Map();
  for (const room of pg.residentRooms().values()) perRoom.set(room, (perRoom.get(room) ?? 0) + 1);
  assert.deepEqual([...perRoom].sort(), [[1, RESIDENTS_PER_ROOM], [2, RESIDENTS_PER_ROOM]]);

  // Một người cư dân ở kênh 2 vào công viên (kênh 1): kênh 2 bỏ thẻ cư dân của họ.
  const someone = rb[0];
  b.clear();
  const live = join({ id: someone.userId, token: `tok-${someone.username}` });
  assert.equal(roomOf(live), 1);
  assert.equal(b.last('pg:left').id, `r${someone.userId}`);

  // a về nhà: bé của a ở lại kênh 1 như cư dân, kênh 2 không thấy.
  b.clear();
  const other = join(player());
  a.close();
  const back = other.last('pg:player');
  assert.equal(back.userId, a.userId);
  assert.equal(back.offline, true);
  assert.equal(b.all('pg:player').length, 0);
  done();
});

test('giới hạn gửi vị trí: dồn nhiều lần trong MOVE_GAP_MS chỉ phát một lần ngay và một lần vị trí mới nhất', async () => {
  const { join, done } = park();
  const a = join(player());
  const b = join(player());
  b.clear();
  for (let i = 0; i < 6; i++) a.send('pg:move', { x: 300 + i * 10, y: 400 });
  assert.equal(b.all('pg:moved').length, 1, 'chỉ lần đầu được phát ngay');
  assert.equal(b.last('pg:moved').x, 300);
  await wait(MOVE_GAP_MS + 30);
  assert.equal(b.all('pg:moved').length, 2, 'hết khoảng chờ phát thêm đúng một lần');
  assert.equal(b.last('pg:moved').x, 350, 'lần phát sau mang vị trí mới nhất');
  await wait(MOVE_GAP_MS + 10);
  a.send('pg:move', { x: 700, y: 500 });
  assert.equal(b.all('pg:moved').length, 3, 'đợi đủ lâu thì phát ngay');
  // Rời công viên khi còn vị trí đang chờ: không phát gì nữa.
  a.send('pg:move', { x: 710, y: 500 });
  a.close();
  await wait(MOVE_GAP_MS + 30);
  assert.equal(b.all('pg:moved').length, 3);
  done();
});
