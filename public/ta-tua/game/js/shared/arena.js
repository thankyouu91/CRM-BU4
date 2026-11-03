// Đấu trường gia tộc: luật dùng chung cho server (petdex/server/arena.js) và màn Đấu trường (views/arena.js).
// Chiến lực, chỉ số chiến đấu và trận đánh theo lượt có seed (cùng seed, cùng đội hình thì ra cùng kết quả).
import { RARITIES, relation } from './pets.js';

export const ARENA = {
  /** Mỗi bên cử tối đa chừng này thành viên có chiến lực cao nhất. */
  teamSize: 15,
  /** Giờ đấu (giờ Việt Nam) và số khung bên thách đấu được đề xuất. */
  hours: [19, 20],
  maxSlots: 2,
  /** Ngày đấu sớm nhất là ngày mai, muộn nhất sau chừng này ngày. */
  maxDaysAhead: 7,
  /** Bên bị thách đấu không chọn khung giờ trong chừng này giờ thì bị xử thua. */
  confirmHours: 48,
  /** Không ai được thách lại cùng một lô hay ghế trong chừng này ngày sau trận. */
  cooldownDays: 7,
  /** Phần quỹ bên thua phải nộp; một nửa cho bên thắng, một nửa vào ngân sách thị trấn. */
  penalty: 0.3,
  forfeitPenalty: 0.15,
  /** Trận dừng sau chừng này lượt; khi đó bên còn nhiều % máu hơn thắng, bằng nhau thì bên giữ đất/ghế thắng. */
  maxRounds: 30,
  /** Chiến lực = (100 + 20 × cấp) × hệ số độ hiếm × (1 + 5% × điểm trang phục còn dùng được). */
  basePower: 100,
  powerPerLevel: 20,
  rarity: { thuong: 1, hiem: 1.15, quy: 1.3, huyenthoai: 1.5 },
  /** Điểm của mỗi món trang phục đang đeo và còn dùng được (đồ hỏng hay đang sửa không tính). */
  tierPoints: { blue: 1, green: 2, gold: 3, red: 4 },
  gearPerPoint: 0.05,
  /** Máu và sức đánh tính từ chiến lực; chí mạng theo độ hiếm (×1,5 sát thương). */
  hpPerPower: 4,
  atkPerPower: 0.35,
  crit: { thuong: 0.05, hiem: 0.08, quy: 0.11, huyenthoai: 0.15 },
  critMult: 1.5,
  /** Ngũ hành: đánh vào hành mình khắc thì +25%, đánh vào hành khắc mình thì −15%. */
  beats: 1.25,
  beaten: 0.85,
};

export const RARITY_NAMES = Object.fromEntries(Object.entries(RARITIES).map(([k, r]) => [k, r.name]));

/** Chiến lực của một bé: cấp, độ hiếm và các món trang phục còn dùng được (`tiers`: danh sách cấp món). */
export function combatPower({ level = 1, rarity = 'thuong', tiers = [] }) {
  const points = tiers.reduce((s, t) => s + (ARENA.tierPoints[t] ?? 0), 0);
  const base = ARENA.basePower + ARENA.powerPerLevel * Math.max(1, level);
  return Math.round(base * (ARENA.rarity[rarity] ?? 1) * (1 + ARENA.gearPerPoint * points));
}

/** Hệ số sát thương theo ngũ hành của bên đánh với bên bị đánh. */
export function elementMult(attacker, defender) {
  const r = relation(attacker, defender);
  if (r === 'beats') return ARENA.beats;
  if (r === 'beaten') return ARENA.beaten;
  return 1;
}

/** Bộ sinh số ngẫu nhiên có seed (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed của một trận từ mã trận và giờ đấu, để đánh lại vẫn ra đúng trận đó. */
export function warSeed(warId, at) {
  let h = 2166136261;
  for (const ch of `${warId}:${at}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Đánh theo lượt. `a`, `b`: danh sách chiến binh { power, rarity, element } đã xếp theo chiến lực giảm dần.
 * Mỗi lượt, mọi bé còn sống của hai bên lần lượt (chiến lực cao trước, xen kẽ hai bên) đánh một bé còn sống ngẫu nhiên
 * của bên kia. Trả về { winner: 'a' | 'b' | null, rounds, hp, maxHp }; mỗi lượt là danh sách đòn
 * [bên đánh 0|1, vị trí đánh, vị trí bị đánh, sát thương, chí mạng 0|1, máu còn lại của bé bị đánh].
 * Một bên không có ai thì bên kia thắng ngay; cả hai không có ai thì winner = null.
 */
export function simulateBattle(a, b, seed) {
  const rand = seeded(seed);
  const sides = [a, b].map((team) => team.map((f) => ({
    ...f,
    hp: Math.round(f.power * ARENA.hpPerPower),
    maxHp: Math.round(f.power * ARENA.hpPerPower),
    atk: f.power * ARENA.atkPerPower,
  })));
  const alive = (s) => sides[s].some((f) => f.hp > 0);
  const rounds = [];
  if (!sides[0].length || !sides[1].length) {
    return { winner: sides[0].length ? 'a' : sides[1].length ? 'b' : null, rounds, hp: sides.map((s) => s.map((f) => f.hp)), maxHp: sides.map((s) => s.map((f) => f.maxHp)) };
  }
  for (let r = 0; r < ARENA.maxRounds && alive(0) && alive(1); r += 1) {
    const order = [];
    const n = Math.max(sides[0].length, sides[1].length);
    for (let i = 0; i < n; i += 1) for (const s of [0, 1]) if (sides[s][i]) order.push([s, i]);
    const hits = [];
    for (const [s, i] of order) {
      const me = sides[s][i];
      if (me.hp <= 0) continue;
      const foes = sides[1 - s].map((f, j) => [f, j]).filter(([f]) => f.hp > 0);
      if (!foes.length) break;
      const [foe, j] = foes[Math.floor(rand() * foes.length)];
      const crit = rand() < (ARENA.crit[me.rarity] ?? ARENA.crit.thuong);
      const dmg = Math.max(1, Math.round(me.atk * (0.85 + rand() * 0.3) * elementMult(me.element, foe.element) * (crit ? ARENA.critMult : 1)));
      foe.hp = Math.max(0, foe.hp - dmg);
      hits.push([s, i, j, dmg, crit ? 1 : 0, foe.hp]);
    }
    rounds.push(hits);
  }
  const share = (s) => sides[s].reduce((x, f) => x + f.hp, 0) / sides[s].reduce((x, f) => x + f.maxHp, 0);
  let winner;
  if (!alive(1)) winner = 'a';
  else if (!alive(0)) winner = 'b';
  else winner = share(0) > share(1) ? 'a' : 'b';
  return { winner, rounds, hp: sides.map((s) => s.map((f) => f.hp)), maxHp: sides.map((s) => s.map((f) => f.maxHp)) };
}

/** Mốc giờ (ms) của một khung đấu: ngày `day` (YYYY-MM-DD, giờ Việt Nam) lúc `hour` giờ. */
export const slotTime = (day, hour) => Date.parse(`${day}T${String(hour - 7).padStart(2, '0')}:00:00Z`);
