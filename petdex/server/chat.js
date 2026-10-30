// Trò chuyện (kênh chung, kênh gia tộc, tin nhắn riêng) và hộp thư.
//
// Tin nhắn lưu trong chat_messages theo kênh: 'world', 'clan:<id>', 'pm:<id nhỏ>:<id lớn>'. Trình duyệt hỏi tin mới
// (`since`) vài giây một lần khi đang mở màn Trò chuyện; số tin chưa đọc của kênh gia tộc, tin nhắn riêng và hộp thư
// đi kèm /me để hiện chấm đỏ. Kênh chung chỉ giữ 7 ngày gần nhất.
//
// Hộp thư: người chơi gửi thư cho nhau (không kèm quà), hệ thống và quản trị viên gửi thư có thể kèm xu,
// người nhận bấm "Nhận quà" một lần.
import { adminLog, db, findUserByName, getUser, transaction } from './db.js';
import { DAY, GameError, HOUR } from './game.js';
import { post } from './ledger.js';

export const CHAT = {
  maxLen: 300,
  gapMs: 2_500, // tối thiểu giữa hai tin của một người
  page: 50,
  worldKeepMs: 7 * DAY,
  pmKeepMs: 60 * DAY,
  newAccountMs: HOUR, // tài khoản mới tạo chưa được nói ở kênh chung
};
export const MAIL = {
  subjectLen: 80,
  bodyLen: 2_000,
  gapMs: 30_000,
  perDay: 20,
  keepMs: 60 * DAY, // thư đã đọc, không còn quà, quá hạn thì tự xoá
  page: 50,
  maxCoins: 100_000_000,
};

const lastSent = new Map(); // userId → lúc gửi tin gần nhất (một Durable Object duy nhất nên giữ trong bộ nhớ là đủ)
const lastMail = new Map();

const AUTHOR = `m.id, m.channel, m.user_id, m.text, m.created_at,
  COALESCE(u.display_name, u.username) AS name, u.username, c.emblem AS clan_emblem, c.name AS clan_name`;
const q = {
  insert: db.prepare('INSERT INTO chat_messages (channel, user_id, text, created_at) VALUES (?, ?, ?, ?)'),
  since: db.prepare(`SELECT ${AUTHOR} FROM chat_messages m JOIN users u ON u.id = m.user_id
    LEFT JOIN clan_members cm ON cm.user_id = m.user_id LEFT JOIN clans c ON c.id = cm.clan_id
    WHERE m.channel = ? AND m.id > ? AND m.deleted = 0 ORDER BY m.id LIMIT ?`),
  before: db.prepare(`SELECT ${AUTHOR} FROM chat_messages m JOIN users u ON u.id = m.user_id
    LEFT JOIN clan_members cm ON cm.user_id = m.user_id LEFT JOIN clans c ON c.id = cm.clan_id
    WHERE m.channel = ? AND m.id < ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT ?`),
  lastId: db.prepare('SELECT MAX(id) AS id FROM chat_messages WHERE channel = ?'),
  markRead: db.prepare(`INSERT INTO chat_reads (user_id, channel, last_id) VALUES (?, ?, ?)
    ON CONFLICT(user_id, channel) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`),
  readOf: db.prepare('SELECT last_id FROM chat_reads WHERE user_id = ? AND channel = ?'),
  unreadIn: db.prepare(`SELECT COUNT(*) AS n FROM chat_messages m WHERE m.channel = ? AND m.deleted = 0 AND m.user_id != ?
    AND m.id > COALESCE((SELECT last_id FROM chat_reads WHERE user_id = ? AND channel = ?), 0)`),
  pmUnread: db.prepare(`SELECT COUNT(*) AS n FROM chat_pm p JOIN chat_messages m ON m.channel = p.channel
    WHERE p.user_id = ? AND m.deleted = 0 AND m.user_id != p.user_id
      AND m.id > COALESCE((SELECT last_id FROM chat_reads r WHERE r.user_id = p.user_id AND r.channel = p.channel), 0)
      AND p.other_id NOT IN (SELECT blocked_id FROM chat_blocks WHERE user_id = p.user_id)`),
  threads: db.prepare(`SELECT p.channel, p.other_id, MAX(m.id) AS last_id FROM chat_pm p JOIN chat_messages m ON m.channel = p.channel
    WHERE p.user_id = ? AND m.deleted = 0 GROUP BY p.channel ORDER BY last_id DESC LIMIT 50`),
  joinPm: db.prepare('INSERT OR IGNORE INTO chat_pm (channel, user_id, other_id) VALUES (?, ?, ?)'),
  message: db.prepare(`SELECT ${AUTHOR} FROM chat_messages m JOIN users u ON u.id = m.user_id
    LEFT JOIN clan_members cm ON cm.user_id = m.user_id LEFT JOIN clans c ON c.id = cm.clan_id WHERE m.id = ?`),
  clanOf: db.prepare('SELECT cm.clan_id, c.name, c.emblem FROM clan_members cm JOIN clans c ON c.id = cm.clan_id WHERE cm.user_id = ?'),
  block: db.prepare('INSERT OR IGNORE INTO chat_blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)'),
  unblock: db.prepare('DELETE FROM chat_blocks WHERE user_id = ? AND blocked_id = ?'),
  blocked: db.prepare('SELECT 1 FROM chat_blocks WHERE user_id = ? AND blocked_id = ?'),
  blockList: db.prepare(`SELECT b.blocked_id AS id, COALESCE(u.display_name, u.username) AS name, u.username
    FROM chat_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY b.created_at DESC`),
  blockedIds: db.prepare('SELECT blocked_id FROM chat_blocks WHERE user_id = ?'),
  deleteMsg: db.prepare('UPDATE chat_messages SET deleted = 1 WHERE id = ?'),
  pruneWorld: db.prepare("DELETE FROM chat_messages WHERE channel = 'world' AND created_at < ?"),
  prunePm: db.prepare("DELETE FROM chat_messages WHERE channel LIKE 'pm:%' AND created_at < ?"),
  pruneClan: db.prepare("DELETE FROM chat_messages WHERE channel LIKE 'clan:%' AND created_at < ?"),
  mute: db.prepare('UPDATE users SET chat_muted_until = ? WHERE id = ?'),
  recent: db.prepare(`SELECT ${AUTHOR} FROM chat_messages m JOIN users u ON u.id = m.user_id
    LEFT JOIN clan_members cm ON cm.user_id = m.user_id LEFT JOIN clans c ON c.id = cm.clan_id
    WHERE (? = '' OR m.channel = ?) AND m.deleted = 0 ORDER BY m.id DESC LIMIT ?`),

  mailInsert: db.prepare('INSERT INTO mail (to_user, from_user, from_name, subject, body, coins, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  mailList: db.prepare(`SELECT m.id, m.from_user, m.from_name, u.username AS from_username, m.subject, m.body, m.coins, m.read_at, m.claimed_at, m.created_at
    FROM mail m LEFT JOIN users u ON u.id = m.from_user WHERE m.to_user = ? AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT ?`),
  mailOne: db.prepare('SELECT * FROM mail WHERE id = ? AND to_user = ? AND deleted_at IS NULL'),
  mailRead: db.prepare('UPDATE mail SET read_at = ? WHERE id = ? AND read_at IS NULL'),
  mailReadAll: db.prepare('UPDATE mail SET read_at = ? WHERE to_user = ? AND read_at IS NULL AND deleted_at IS NULL'),
  mailClaim: db.prepare('UPDATE mail SET claimed_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ? AND claimed_at IS NULL'),
  mailDelete: db.prepare('UPDATE mail SET deleted_at = ? WHERE id = ?'),
  mailUnread: db.prepare('SELECT COUNT(*) AS n FROM mail WHERE to_user = ? AND deleted_at IS NULL AND (read_at IS NULL OR (coins > 0 AND claimed_at IS NULL))'),
  mailSentToday: db.prepare('SELECT COUNT(*) AS n FROM mail WHERE from_user = ? AND created_at > ?'),
  mailPrune: db.prepare('UPDATE mail SET deleted_at = ? WHERE deleted_at IS NULL AND read_at IS NOT NULL AND (coins = 0 OR claimed_at IS NOT NULL) AND created_at < ?'),
  everyone: db.prepare("SELECT id FROM users WHERE COALESCE(banned, 0) = 0"),
};

const pmChannel = (a, b) => `pm:${Math.min(a, b)}:${Math.max(a, b)}`;
const nameOf = (u) => u.display_name || u.username;

/** Gọn văn bản: bỏ ký tự điều khiển, gộp khoảng trắng (thư giữ xuống dòng), cắt độ dài. */
function cleanText(text, max, { lines = false } = {}) {
  let s = String(text ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮]/g, '');
  s = lines ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

function mustNotMuted(user, now) {
  if ((user.chat_muted_until ?? 0) > now) {
    const h = Math.ceil((user.chat_muted_until - now) / HOUR);
    throw new GameError(`Bạn đang bị cấm chat, còn khoảng ${h} giờ.`);
  }
}

/** Người chơi `userId` vào kênh `key` ('world' | 'clan' | 'pm:<id người kia>') được không; trả về tên kênh trong DB. */
function resolve(userId, key) {
  if (key === 'world') return { channel: 'world' };
  if (key === 'clan') {
    const clan = q.clanOf.get(userId);
    if (!clan) throw new GameError('Bạn chưa vào gia tộc nào.');
    return { channel: `clan:${clan.clan_id}`, clan };
  }
  const m = /^pm:(\d+)$/.exec(String(key ?? ''));
  if (!m) throw new GameError('Kênh trò chuyện không hợp lệ.');
  const other = getUser(Number(m[1]));
  if (!other || other.id === userId) throw new GameError('Không tìm thấy người chơi này.');
  return { channel: pmChannel(userId, other.id), other };
}

const shape = (r, blocked) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  username: r.username,
  clan: r.clan_emblem ? { emblem: r.clan_emblem, name: r.clan_name } : null,
  text: blocked?.has(r.user_id) ? null : r.text, // tin của người mình chặn: chỉ hiện "đã ẩn"
  at: r.created_at,
});

/** Gửi một tin vào kênh. */
export function sendChat(userId, key, text, now = Date.now()) {
  const user = getUser(userId);
  mustNotMuted(user, now);
  const clean = cleanText(text, CHAT.maxLen);
  if (!clean) throw new GameError('Tin nhắn trống.');
  const { channel, other } = resolve(userId, key);
  if (channel === 'world' && now - user.created_at < CHAT.newAccountMs) {
    throw new GameError('Tài khoản mới cần chờ 1 giờ mới được nói ở kênh chung. Kênh gia tộc và tin nhắn riêng thì dùng được ngay.');
  }
  if (other && (q.blocked.get(other.id, userId) || q.blocked.get(userId, other.id))) {
    throw new GameError(q.blocked.get(userId, other.id) ? `Bạn đang chặn ${nameOf(other)}. Bỏ chặn để nhắn tin.` : `${nameOf(other)} không nhận tin nhắn của bạn.`);
  }
  if (now - (lastSent.get(userId) ?? 0) < CHAT.gapMs) throw new GameError('Từ từ thôi, nhắn chậm lại một chút nhé!');
  lastSent.set(userId, now);
  const { lastInsertRowid } = q.insert.run(channel, userId, clean, now);
  if (other) {
    q.joinPm.run(channel, userId, other.id);
    q.joinPm.run(channel, other.id, userId);
  }
  q.markRead.run(userId, channel, Number(lastInsertRowid));
  return { message: shape(q.message.get(lastInsertRowid)) };
}

/**
 * Tin của một kênh: `since` lấy tin mới hơn id đó (hỏi định kỳ), `before` lấy trang cũ hơn; không có gì thì 50 tin cuối.
 * Đánh dấu đã đọc tới tin mới nhất trả về.
 */
export function chatFeed(userId, key, { since = 0, before = 0 } = {}) {
  const { channel, clan, other } = resolve(userId, key);
  const blocked = new Set(q.blockedIds.all(userId).map((r) => r.blocked_id));
  let rows;
  if (before > 0) rows = q.before.all(channel, before, CHAT.page).reverse();
  else if (since > 0) rows = q.since.all(channel, since, CHAT.page * 2);
  else rows = q.before.all(channel, Number.MAX_SAFE_INTEGER, CHAT.page).reverse();
  const top = rows.at(-1)?.id;
  if (top && !before) q.markRead.run(userId, channel, top);
  return {
    key,
    messages: rows.map((r) => shape(r, blocked)),
    clan: clan ? { id: clan.clan_id, name: clan.name, emblem: clan.emblem } : null,
    other: other ? { id: other.id, name: nameOf(other), username: other.username, blocked: blocked.has(other.id), blocksMe: Boolean(q.blocked.get(other.id, userId)) } : null,
    more: !since && rows.length === CHAT.page,
  };
}

/** Danh sách cuộc trò chuyện riêng, mới nhất trước, kèm số tin chưa đọc. */
export function pmThreads(userId) {
  const blocked = new Set(q.blockedIds.all(userId).map((r) => r.blocked_id));
  return q.threads.all(userId).map((t) => {
    const otherId = t.other_id;
    const other = getUser(otherId);
    if (!other) return null;
    const last = q.message.get(t.last_id);
    return {
      key: `pm:${otherId}`,
      other: { id: otherId, name: nameOf(other), username: other.username, blocked: blocked.has(otherId) },
      last: last ? { text: blocked.has(last.user_id) ? null : last.text, mine: last.user_id === userId, at: last.created_at } : null,
      unread: blocked.has(otherId) ? 0 : q.unreadIn.get(t.channel, userId, userId, t.channel).n,
    };
  }).filter(Boolean);
}

/** Tìm người để nhắn riêng theo tên đăng nhập. */
export function findChatUser(userId, username) {
  const other = findUserByName(String(username ?? '').trim());
  if (!other) throw new GameError('Không tìm thấy người chơi có tên này.');
  if (other.id === userId) throw new GameError('Không thể tự nhắn cho chính mình.');
  return { key: `pm:${other.id}`, other: { id: other.id, name: nameOf(other), username: other.username } };
}

export function blockUser(userId, otherId, now = Date.now()) {
  const other = getUser(Number(otherId));
  if (!other || other.id === userId) throw new GameError('Không tìm thấy người chơi này.');
  q.block.run(userId, other.id, now);
  return { message: `Đã chặn ${nameOf(other)}: không nhận tin nhắn riêng, thư, và tin của họ ở các kênh bị ẩn.` };
}

export function unblockUser(userId, otherId) {
  q.unblock.run(userId, Number(otherId));
  return { message: 'Đã bỏ chặn.' };
}

export const blockList = (userId) => q.blockList.all(userId);

/** Số chưa đọc cho chấm đỏ: kênh gia tộc, tin nhắn riêng, hộp thư (kênh chung không tính). */
export function chatBadges(userId) {
  const clan = q.clanOf.get(userId);
  const channel = clan ? `clan:${clan.clan_id}` : null;
  return {
    clan: channel ? q.unreadIn.get(channel, userId, userId, channel).n : 0,
    pm: q.pmUnread.get(userId).n,
    mail: q.mailUnread.get(userId).n,
  };
}

/** Dọn tin cũ (chạy mỗi ngày). */
export function pruneChat(now = Date.now()) {
  q.pruneWorld.run(now - CHAT.worldKeepMs);
  q.pruneClan.run(now - CHAT.pmKeepMs);
  q.prunePm.run(now - CHAT.pmKeepMs);
  q.mailPrune.run(now, now - MAIL.keepMs);
}

// ---------------------------------------------------------------- hộp thư

/** Gửi thư hệ thống (from = null) hoặc của người chơi. Dùng được từ các phần khác của game. */
export function sendMail({ to, fromUser = null, fromName = 'Bưu điện Pet Town', subject, body = '', coins = 0, now = Date.now() }) {
  const s = cleanText(subject, MAIL.subjectLen);
  if (!s) throw new GameError('Thư cần có tiêu đề.');
  const b = cleanText(body, MAIL.bodyLen, { lines: true });
  const { lastInsertRowid } = q.mailInsert.run(to, fromUser, fromName, s, b, Math.max(0, Math.floor(coins)), now);
  return Number(lastInsertRowid);
}

/** Người chơi gửi thư cho người khác (không kèm quà). */
export function playerMail(userId, { to, subject, body }, now = Date.now()) {
  const me = getUser(userId);
  mustNotMuted(me, now);
  const other = findUserByName(String(to ?? '').trim());
  if (!other) throw new GameError('Không tìm thấy người nhận.');
  if (other.id === userId) throw new GameError('Không thể gửi thư cho chính mình.');
  if (q.blocked.get(other.id, userId)) throw new GameError(`${nameOf(other)} không nhận thư của bạn.`);
  if (!cleanText(body, MAIL.bodyLen, { lines: true })) throw new GameError('Thư trống.');
  if (now - (lastMail.get(userId) ?? 0) < MAIL.gapMs) throw new GameError('Mỗi 30 giây chỉ gửi được một lá thư.');
  if (q.mailSentToday.get(userId, now - DAY).n >= MAIL.perDay) throw new GameError(`Mỗi ngày gửi tối đa ${MAIL.perDay} lá thư.`);
  lastMail.set(userId, now);
  sendMail({ to: other.id, fromUser: userId, fromName: nameOf(me), subject, body, now });
  return { message: `📮 Đã gửi thư cho ${nameOf(other)}.` };
}

export function mailbox(userId) {
  const blocked = new Set(q.blockedIds.all(userId).map((r) => r.blocked_id));
  const mails = q.mailList.all(userId, MAIL.page)
    .filter((m) => !m.from_user || !blocked.has(m.from_user))
    .map((m) => ({
      id: m.id,
      from: m.from_user ? { id: m.from_user, name: m.from_name, username: m.from_username } : { id: null, name: m.from_name || 'Bưu điện Pet Town' },
      system: !m.from_user,
      subject: m.subject,
      body: m.body,
      coins: m.coins,
      read: Boolean(m.read_at),
      claimed: Boolean(m.claimed_at),
      at: m.created_at,
    }));
  return { mails, unread: q.mailUnread.get(userId).n };
}

function mustMail(userId, id) {
  const m = q.mailOne.get(Number(id), userId);
  if (!m) throw new GameError('Không tìm thấy thư này.');
  return m;
}

export function readMail(userId, id, now = Date.now()) {
  mustMail(userId, id);
  q.mailRead.run(now, Number(id));
  return {};
}

export function readAllMail(userId, now = Date.now()) {
  q.mailReadAll.run(now, userId);
  return { message: 'Đã đánh dấu đọc hết thư.' };
}

/** Nhận xu đính kèm, đúng một lần. */
export function claimMail(userId, id, now = Date.now()) {
  return transaction(() => {
    const m = mustMail(userId, id);
    if (!m.coins) throw new GameError('Thư này không có quà.');
    if (m.claimed_at || !q.mailClaim.run(now, now, m.id).changes) throw new GameError('Bạn đã nhận quà của thư này rồi.');
    post({ userId, delta: m.coins, kind: 'mail', memo: `Quà trong thư: ${m.subject}`, now });
    return { message: `🎁 Đã nhận ${m.coins.toLocaleString('vi-VN')} xu.` };
  });
}

export function deleteMail(userId, id, now = Date.now()) {
  const m = mustMail(userId, id);
  if (m.coins && !m.claimed_at) throw new GameError('Thư còn quà chưa nhận. Nhận quà rồi mới xoá được.');
  q.mailDelete.run(now, m.id);
  return { message: 'Đã xoá thư.' };
}

// ---------------------------------------------------------------- quản trị

/** Quản trị viên gửi thư cho một người (`to` = id) hoặc mọi người (`to` = 'all'), có thể kèm xu. */
export function adminMail(actor, { to, subject, body, coins = 0 }, now = Date.now()) {
  const amount = Number(coins) || 0;
  if (!Number.isInteger(amount) || amount < 0 || amount > MAIL.maxCoins) throw new GameError('Số xu đính kèm không hợp lệ.');
  const ids = to === 'all' ? q.everyone.all().map((r) => r.id) : [Number(to)];
  if (to !== 'all' && !getUser(ids[0])) throw new GameError('Không tìm thấy người chơi này.');
  if (!cleanText(subject, MAIL.subjectLen)) throw new GameError('Thư cần có tiêu đề.');
  transaction(() => {
    for (const id of ids) sendMail({ to: id, fromName: 'Ban quản lý Pet Town', subject, body, coins: amount, now });
  });
  adminLog(actor, 'mail', to === 'all' ? null : ids[0], { to: to === 'all' ? 'all' : ids[0], subject: cleanText(subject, MAIL.subjectLen), coins: amount, count: ids.length });
  return { sent: ids.length };
}

export const adminChat = ({ channel = '', limit = 200 } = {}) => q.recent.all(channel, channel, Math.min(500, Number(limit) || 200)).map((r) => ({ ...shape(r), channel: r.channel }));

export function adminDeleteMessage(actor, id) {
  const msg = q.message.get(Number(id));
  if (!msg) throw new GameError('Không tìm thấy tin nhắn.');
  q.deleteMsg.run(msg.id);
  adminLog(actor, 'chat_delete', msg.user_id, { id: msg.id, channel: msg.channel, text: msg.text });
  return { ok: true };
}

/** Cấm chat (và gửi thư) `hours` giờ; 0 là bỏ cấm. */
export function muteUser(actor, userId, hours, now = Date.now()) {
  const user = getUser(Number(userId));
  if (!user) throw new GameError('Không tìm thấy người chơi này.');
  const h = Number(hours);
  if (!Number.isFinite(h) || h < 0 || h > 24 * 365) throw new GameError('Số giờ không hợp lệ.');
  q.mute.run(h ? now + h * HOUR : 0, user.id);
  adminLog(actor, h ? 'chat_mute' : 'chat_unmute', user.id, { hours: h });
  return { mutedUntil: h ? now + h * HOUR : 0 };
}
