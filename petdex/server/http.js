// Tiện ích HTTP dùng chung cho các router.
import * as store from './db.js';
import { GameError, levelReward } from './game.js';
import { snapshot } from './service.js';
import { resolveFactoryChains } from './factory.js';

export function auth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const user = store.userForToken(token);
  if (!user) return res.status(401).json({ error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.' });
  if (user.banned) return res.status(403).json({ error: 'Tài khoản này đã bị quản trị viên khóa.' });
  store.touchSeen(user.id);
  // Nối các ca đứng máy đã hết giờ (xưởng bật chạy liên tục) trước khi đọc hay làm gì, để bé và kho đúng tới lúc này.
  try {
    resolveFactoryChains(user.id);
  } catch (err) {
    console.error('Lỗi nối ca xưởng:', err);
  }
  req.user = user;
  req.token = token;
  next();
}

/** Trả về toàn bộ trạng thái mới kèm kết quả hành động để client vẽ lại một lần. */
export function reply(res, userId, result = {}) {
  const levelUps = (result.levelsGained ?? []).map((level) => ({ level, reward: levelReward(level) }));
  const { levelsGained, pet, ...rest } = result;
  res.json({ ...snapshot(userId), result: { ...rest, levelUps } });
}

/** Đọc số nguyên trong khoảng cho phép từ body, ném lỗi tiếng Việt nếu sai. */
export function intField(value, label, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new GameError(`${label} không hợp lệ.`);
  return n;
}
