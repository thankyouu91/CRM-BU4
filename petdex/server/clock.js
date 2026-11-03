// Mốc thời gian của nền kinh tế: ngày và tuần tính theo giờ Việt Nam (UTC+7).
import { DAY, HOUR } from './game.js';

const OFFSET = 7 * HOUR;

/** '2026-10-29' theo giờ Việt Nam. */
export const dayKey = (ts) => new Date(ts + OFFSET).toISOString().slice(0, 10);

/** Thời điểm 00:00 giờ Việt Nam của một ngày. */
export const startOfDay = (key) => Date.parse(`${key}T00:00:00Z`) - OFFSET;

export const nextDay = (key) => dayKey(startOfDay(key) + DAY + HOUR);

/** Thứ trong tuần theo giờ Việt Nam: 0 = Chủ nhật. */
export const weekday = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();

/** Giờ trong ngày theo giờ Việt Nam, có phần lẻ (13.5 = 13 giờ 30). */
export const hourOfDay = (ts) => (ts - startOfDay(dayKey(ts))) / HOUR;

/**
 * Đêm chứa thời điểm `ts` khi khung đêm chạy từ `from` giờ hôm D tới `until` giờ sáng hôm sau:
 * 20:00 hôm D và 01:30 hôm D+1 đều thuộc đêm D. Ngoài khung thì trả về null.
 */
export function nightKey(ts, from, until) {
  const h = hourOfDay(ts);
  if (h >= from) return dayKey(ts);
  if (h < until) return dayKey(ts - DAY);
  return null;
}

/** Lúc khung đêm (`from` giờ) mở lần tới tính từ `ts`; đang trong khung thì là lúc khung này mở. */
export function nightOpensAt(ts, from, until) {
  const key = nightKey(ts, from, until) ?? dayKey(ts);
  return startOfDay(key) + from * HOUR;
}
