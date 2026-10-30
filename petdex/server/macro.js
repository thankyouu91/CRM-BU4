// Kinh tế vĩ mô của thị trấn: chu kỳ kinh tế, thời tiết, cầu từng ngành và chỉ số giá đất, mỗi ngày một bản ghi.
// Tác động lên doanh thu các lô đất của gia tộc (clans.js), lên giá hàng trên Sàn (tin tức có hiệu lực giá)
// và lên lượng khách của quầy trà sữa (hiệu ứng thị trấn). Quản trị viên có thể ép pha và thời tiết.
import { economy } from './bank.js';
import { dayKey, nextDay, startOfDay } from './clock.js';
import { db } from './db.js';
import { DAY } from './game.js';
import { gaussian } from './rules/market.js';
import { INDUSTRIES, INDUSTRY_ORDER, PHASES, PHASE_NEXT, WEATHER } from '../../public/ta-tua/game/js/shared/clan.js';

const q = {
  day: db.prepare('SELECT * FROM macro_days WHERE day = ?'),
  before: db.prepare('SELECT * FROM macro_days WHERE day < ? ORDER BY day DESC LIMIT 1'),
  recent: db.prepare('SELECT * FROM macro_days WHERE day <= ? ORDER BY day DESC LIMIT ?'),
  insert: db.prepare(`
    INSERT OR REPLACE INTO macro_days (day, phase, weather, land_index, gdp, demand, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'),
  insertEffect: db.prepare('INSERT INTO town_effects (kind, target, value, label, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'),
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const GDP = { recovery: 0.025, boom: 0.07, peak: 0.04, recession: -0.03 };

const parse = (row) => row && { day: row.day, phase: row.phase, weather: row.weather, landIndex: row.land_index, gdp: row.gdp, demand: JSON.parse(row.demand) };

function pickWeighted(table, rand) {
  const entries = Object.entries(table);
  let r = rand() * entries.reduce((s, [, w]) => s + w.weight, 0);
  for (const [key, w] of entries) {
    r -= w.weight;
    if (r <= 0) return key;
  }
  return entries[0][0];
}

/**
 * Trạng thái vĩ mô của ngày sau từ ngày trước (hàm thuần trừ `rand`). `force`: { phase, weather } quản trị viên ép.
 * Trả về thêm `shocks`: các ngành vừa có cú sốc cầu (để đăng tin).
 */
export function rollMacro(prev, { rand = Math.random, baseRate = 0.003, force = {} } = {}) {
  let phase = prev.phase;
  if (force.phase && PHASES[force.phase]) phase = force.phase;
  else {
    let r = rand();
    for (const [next, p] of Object.entries(PHASE_NEXT[phase] ?? {})) {
      if (r < p) {
        phase = next;
        break;
      }
      r -= p;
    }
  }
  const weather = force.weather && WEATHER[force.weather] ? force.weather : pickWeighted(WEATHER, rand);
  const shocks = [];
  const demand = {};
  for (const id of INDUSTRY_ORDER) {
    const d = prev.demand?.[id] ?? 1;
    let next = 1 + (d - 1) * 0.85 + gaussian(rand) * 0.03;
    if (rand() < 0.04) {
      const shock = (rand() < 0.5 ? -1 : 1) * (0.1 + rand() * 0.1);
      next += shock;
      shocks.push({ industry: id, shock });
    }
    demand[id] = Math.round(clamp(next, 0.7, 1.35) * 1000) / 1000;
  }
  // Giá đất theo chu kỳ, trừ đi phần lãi suất cao hơn mức trung tính, cộng nhiễu nhỏ.
  const drift = PHASES[phase].land - (baseRate - 0.003) * 2 + gaussian(rand) * 0.003;
  const landIndex = Math.round(clamp(prev.landIndex * (1 + drift), 0.6, 1.8) * 10000) / 10000;
  const gdp = Math.round((GDP[phase] + gaussian(rand) * 0.005) * 10000) / 10000;
  return { phase, weather, landIndex, gdp, demand, shocks };
}

const INITIAL = { phase: 'recovery', weather: 'calm', landIndex: 1, gdp: GDP.recovery, demand: Object.fromEntries(INDUSTRY_ORDER.map((id) => [id, 1])) };

/** Ghi trạng thái của `day` và đăng tin/hiệu ứng cho ngày đó. */
function write(day, state, now) {
  q.insert.run(day, state.phase, state.weather, state.landIndex, state.gdp, JSON.stringify(state.demand), now);
  const from = startOfDay(day);
  const to = from + DAY;
  const w = WEATHER[state.weather];
  for (const [commodity, effect] of Object.entries(w.news ?? {})) {
    q.insertNews.run(commodity, `${w.icon} ${w.name}: thị trường ${effect > 0 ? 'lo thiếu hàng' : 'dư hàng'}`, effect, from, from, to);
  }
  for (const { industry, shock } of state.shocks ?? []) {
    const ind = INDUSTRIES[industry];
    const headline = `${ind.icon} Cầu ngành ${ind.name} ${shock > 0 ? 'tăng vọt' : 'sụt giảm'} ${Math.round(Math.abs(shock) * 100)}%`;
    if (ind.commodities.length) for (const c of ind.commodities) q.insertNews.run(c, headline, shock / 2, from, from, to);
    else q.insertNews.run(null, headline, 0, from, from, to);
  }
  const traffic = PHASES[state.phase].traffic;
  if (traffic) q.insertEffect.run('traffic', null, traffic, `${PHASES[state.phase].icon} Kinh tế ${PHASES[state.phase].name}`, from, to);
}

/** Trạng thái vĩ mô của `day`; chưa có thì tạo từ ngày gần nhất trước đó. */
export function macroFor(day, { rand = Math.random, force = {}, now = Date.now() } = {}) {
  const found = parse(q.day.get(day));
  if (found) return found;
  const prev = parse(q.before.get(day)) ?? INITIAL;
  const state = rollMacro(prev, { rand, baseRate: economy().baseRate, force });
  write(day, state, now);
  return { day, ...state, shocks: undefined };
}

/** Ghi đè trạng thái của một ngày (quản trị viên chỉnh tay). */
export function overrideMacro(day, patch, now = Date.now()) {
  const cur = macroFor(day, { now });
  const next = {
    phase: PHASES[patch.phase] ? patch.phase : cur.phase,
    weather: WEATHER[patch.weather] ? patch.weather : cur.weather,
    landIndex: Number.isFinite(patch.landIndex) ? clamp(patch.landIndex, 0.6, 1.8) : cur.landIndex,
    gdp: cur.gdp,
    demand: cur.demand,
  };
  q.insert.run(day, next.phase, next.weather, next.landIndex, next.gdp, JSON.stringify(next.demand), now);
  return { day, ...next };
}

export const macroToday = (now = Date.now()) => macroFor(dayKey(now), { now });

/** 14 ngày gần nhất (cũ → mới) cho biểu đồ. */
export const macroHistory = (day, n = 14) => q.recent.all(day, n).map(parse).reverse();

/** Đóng ngày `day`: tạo sẵn trạng thái của ngày hôm sau. */
export function rollNextDay(day, { rand = Math.random, force = {} } = {}) {
  const next = nextDay(day);
  return macroFor(next, { rand, force, now: startOfDay(next) });
}
