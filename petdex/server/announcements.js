// Thông báo của ban quản lý: quản trị viên đăng trên bảng quản lý, người chơi đọc ở đầu Báo Trân Châu
// và thấy bật lên một lần (máy người chơi nhớ thông báo nào đã xem). Nội dung là chữ thường, cách định dạng
// đơn giản xem renderAnnouncement trong public/ta-tua/game/js/views/news.js.
import { db } from './db.js';
import { DAY, GameError } from './game.js';

export const ANNOUNCEMENT = { maxTitle: 120, maxBody: 8000, minDays: 1, maxDays: 30, defaultDays: 7 };

const q = {
  insert: db.prepare('INSERT INTO announcements (title, body, popup, created_by, created_at, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  byId: db.prepare('SELECT * FROM announcements WHERE id = ?'),
  all: db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 100'),
  active: db.prepare('SELECT * FROM announcements WHERE removed_at IS NULL AND starts_at <= ? AND ends_at > ? ORDER BY id DESC LIMIT 10'),
  remove: db.prepare('UPDATE announcements SET removed_at = ? WHERE id = ? AND removed_at IS NULL'),
};

const view = (r) => ({
  id: r.id,
  title: r.title,
  body: r.body,
  popup: Boolean(r.popup),
  createdBy: r.created_by,
  createdAt: r.created_at,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  removedAt: r.removed_at,
});

/** Đăng một thông báo, hiện ngay và kéo dài `days` ngày. */
export function createAnnouncement({ title, body, days = ANNOUNCEMENT.defaultDays, popup = true, createdBy = null }, now = Date.now()) {
  const t = String(title ?? '').trim();
  const b = String(body ?? '').replace(/\r\n?/g, '\n').trim();
  const d = Number(days);
  if (!t) throw new GameError('Cần tiêu đề thông báo.');
  if (t.length > ANNOUNCEMENT.maxTitle) throw new GameError(`Tiêu đề tối đa ${ANNOUNCEMENT.maxTitle} ký tự.`);
  if (!b) throw new GameError('Cần nội dung thông báo.');
  if (b.length > ANNOUNCEMENT.maxBody) throw new GameError(`Nội dung tối đa ${ANNOUNCEMENT.maxBody} ký tự.`);
  if (!Number.isInteger(d) || d < ANNOUNCEMENT.minDays || d > ANNOUNCEMENT.maxDays) {
    throw new GameError(`Thời gian hiện từ ${ANNOUNCEMENT.minDays} đến ${ANNOUNCEMENT.maxDays} ngày.`);
  }
  const id = Number(q.insert.run(t, b, popup ? 1 : 0, createdBy, now, now, now + d * DAY).lastInsertRowid);
  return view(q.byId.get(id));
}

/** Gỡ một thông báo (người chơi không thấy nữa; bảng quản lý vẫn giữ lịch sử). Trả về false nếu đã gỡ. */
export function removeAnnouncement(id, now = Date.now()) {
  if (!q.byId.get(Number(id))) throw new GameError('Không có thông báo này.');
  return q.remove.run(now, Number(id)).changes > 0;
}

export const announcementById = (id) => {
  const r = q.byId.get(Number(id));
  return r ? view(r) : null;
};
export const listAnnouncements = () => q.all.all().map(view);
/** Thông báo đang hiện cho người chơi, mới nhất trước. */
export const activeAnnouncements = (now = Date.now()) => q.active.all(now, now).map(view);
