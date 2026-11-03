// Trò chuyện và hộp thư: kênh chung / gia tộc / riêng, chưa đọc, chặn, cấm chat, thư kèm quà nhận một lần.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const chat = await import('../server/chat.js');
const clans = await import('../server/clans.js');
const { snapshot } = await import('../server/service.js');

const T0 = Date.parse('2026-12-01T03:00:00Z');
migrate(T0);
function player(name, created = T0 - 10 * DAY) {
  const id = store.createUser(name, 'x', created);
  post({ userId: id, delta: 1_000_000, kind: 'opening', now: T0 });
  const pet = store.insertPet(id, `Bé ${name}`, 'test_pet', T0 - 45 * DAY);
  store.savePet({ ...store.getPet(pet), level: 8, updated_at: T0 });
  store.setActivePet(id, pet);
  return id;
}
const an = player('an');
const binh = player('binh');
const moi = player('moi', T0 - 10 * 60_000);
let t = T0;
const tick = () => (t += 3_000);

test('kênh chung: gửi, nhận tin mới theo since, tài khoản mới phải chờ, gửi dồn bị chặn', () => {
  const { message } = chat.sendChat(an, 'world', '  xin   chào  ', tick());
  assert.equal(message.text, 'xin chào');
  assert.throws(() => chat.sendChat(an, 'world', 'nữa', t + 500), /chậm lại/);
  assert.throws(() => chat.sendChat(moi, 'world', 'hi', tick()), /1 giờ/);
  chat.sendChat(binh, 'world', 'chào An', tick());
  const feed = chat.chatFeed(an, 'world', { since: message.id });
  assert.deepEqual(feed.messages.map((m) => m.text), ['chào An']);
  assert.equal(chat.chatFeed(an, 'world').messages.length, 2);
});

test('tin nhắn riêng: hai người cùng một kênh, chưa đọc, đọc rồi hết', () => {
  chat.sendChat(an, `pm:${binh}`, 'đi chợ không', tick());
  chat.sendChat(moi, `pm:${binh}`, 'chào anh', tick()); // tài khoản mới vẫn nhắn riêng được
  assert.equal(chat.chatBadges(binh).pm, 2);
  const threads = chat.pmThreads(binh);
  assert.deepEqual(threads.map((x) => x.other.username), ['moi', 'an']);
  const feed = chat.chatFeed(binh, `pm:${an}`);
  assert.equal(feed.messages[0].text, 'đi chợ không');
  assert.equal(chat.chatBadges(binh).pm, 1);
  assert.equal(snapshot(binh, t).badges.pm, 1);
});

test('chặn: không nhắn riêng, không gửi thư được; tin cũ bị ẩn', () => {
  chat.blockUser(binh, moi, t);
  assert.throws(() => chat.sendChat(moi, `pm:${binh}`, 'alo', tick()), /không nhận/);
  assert.throws(() => chat.playerMail(moi, { to: 'binh', subject: 'x', body: 'y' }, tick()), /không nhận/);
  assert.equal(chat.chatBadges(binh).pm, 0);
  assert.equal(chat.chatFeed(binh, `pm:${moi}`).messages[0].text, null);
  chat.unblockUser(binh, moi);
});

test('kênh gia tộc: chỉ thành viên', () => {
  assert.throws(() => chat.chatFeed(an, 'clan'), /chưa vào gia tộc/);
  clans.createClan(an, { name: 'Nhà An', emblem: '🐯', color: '#aa0000' }, t);
  const id = store.db.prepare('SELECT id FROM clans WHERE name = ?').get('Nhà An').id;
  clans.joinClan(binh, id, t);
  chat.sendChat(an, 'clan', 'họp tộc', tick());
  assert.equal(chat.chatBadges(binh).clan, 1);
  const feed = chat.chatFeed(binh, 'clan');
  assert.equal(feed.clan.name, 'Nhà An');
  assert.equal(feed.messages.at(-1).clan.emblem, '🐯');
  assert.equal(chat.chatBadges(binh).clan, 0);
  assert.throws(() => chat.sendChat(moi, 'clan', 'xin vào', tick()), /chưa vào gia tộc/);
});

test('cấm chat: không nói, không gửi thư cho tới khi hết hạn', () => {
  chat.muteUser('Kiểm thử', binh, 2, t);
  assert.throws(() => chat.sendChat(binh, 'world', 'hello', tick()), /cấm chat/);
  chat.muteUser('Kiểm thử', binh, 0, t);
  chat.sendChat(binh, 'world', 'hello', tick());
  // Quản trị xoá tin: không còn trong kênh.
  const last = chat.chatFeed(an, 'world').messages.at(-1);
  chat.adminDeleteMessage('Kiểm thử', last.id);
  assert.ok(!chat.chatFeed(an, 'world').messages.some((m) => m.id === last.id));
});

test('hộp thư: người chơi gửi thư; thư quản trị kèm xu nhận đúng một lần, chưa nhận thì không xoá được', () => {
  chat.playerMail(an, { to: 'binh', subject: 'Hẹn', body: 'Mai\n\n\n\nđi câu cá' }, tick());
  assert.throws(() => chat.playerMail(an, { to: 'binh', subject: 'Nữa', body: 'x' }, t + 1_000), /30 giây/);
  let box = chat.mailbox(binh);
  assert.equal(box.mails[0].body, 'Mai\n\nđi câu cá');
  assert.equal(box.unread, 1);
  chat.readMail(binh, box.mails[0].id, t);
  assert.equal(chat.mailbox(binh).unread, 0);

  const { sent } = chat.adminMail('Kiểm thử', { to: 'all', subject: 'Quà ra mắt', body: 'Chúc vui', coins: 500 }, tick());
  assert.equal(sent, 3);
  box = chat.mailbox(binh);
  const gift = box.mails[0];
  assert.equal(gift.system, true);
  assert.equal(box.unread, 1);
  assert.throws(() => chat.deleteMail(binh, gift.id, t), /chưa nhận/);
  const before = store.getUser(binh).coins;
  chat.claimMail(binh, gift.id, t);
  assert.equal(store.getUser(binh).coins, before + 500);
  assert.throws(() => chat.claimMail(binh, gift.id, t), /đã nhận/);
  assert.throws(() => chat.claimMail(an, gift.id, t), /Không tìm thấy/, 'không nhận thư của người khác');
  chat.deleteMail(binh, gift.id, t);
  assert.equal(chat.mailbox(binh).mails.length, 1);
});

test('dọn tin: kênh chung giữ 7 ngày', () => {
  chat.pruneChat(T0 + 8 * DAY + HOUR);
  assert.equal(chat.chatFeed(an, 'world').messages.length, 0);
  assert.equal(chat.chatFeed(binh, `pm:${an}`).messages.length, 1);
});
