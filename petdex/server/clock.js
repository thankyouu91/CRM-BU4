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
