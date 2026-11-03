// Luật mini-game dùng chung cho trình duyệt (dựng màn chơi) và server (kiểm tra kết quả, tính thưởng).
// Mọi thứ ngẫu nhiên đều sinh từ hạt giống của phiên chơi, nên hai bên thấy cùng một ván.

export const GAMES = {
  fishing: { name: 'Câu cá', icon: '🎣', duration: 40, energy: 5, desc: 'Bấm khi phao nằm trong vùng xanh để giật cần.' },
  pearls: { name: 'Hứng trân châu', icon: '🧋', duration: 30, energy: 5, desc: 'Di cốc hứng trân châu, né đá lạnh.' },
  memory: { name: 'Ghép hình nhớ', icon: '🧩', duration: 60, energy: 5, desc: 'Lật hai thẻ giống nhau, càng ít lượt càng giỏi.' },
};

/** Thưởng tối đa mỗi ngày từ mini-game (xu và phần nguyên liệu). */
export const DAILY_CAPS = { coins: 100, portions: { fish: 10, pearl: 20 } };

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- câu cá

/** zone: bề rộng vùng xanh (tỉ lệ thanh), speed: số lần phao chạy hết thanh mỗi giây. */
export const FISH = [
  { id: 'ro', name: 'Cá rô', portions: 1, coins: 1, zone: 0.26, speed: 0.9, weight: 46 },
  { id: 'chep', name: 'Cá chép', portions: 2, coins: 1, zone: 0.2, speed: 1.2, weight: 30 },
  { id: 'hoi', name: 'Cá hồi', portions: 3, coins: 2, zone: 0.15, speed: 1.5, weight: 15 },
  { id: 'vang', name: 'Cá vàng', portions: 2, coins: 15, zone: 0.12, speed: 1.8, weight: 7 },
  { id: 'trang', name: 'Cá mặt trăng', portions: 4, coins: 40, zone: 0.08, speed: 2.2, weight: 2 },
];

const MIN_CAST_SECONDS = 1.2;

/** Thứ tự cá cắn câu trong ván: lần quăng thứ i gặp cá `fishSequence(seed)[i]`. */
export function fishSequence(seed, count = 60) {
  const r = rng(seed);
  const total = FISH.reduce((sum, f) => sum + f.weight, 0);
  return Array.from({ length: count }, () => {
    let roll = r() * total;
    return FISH.find((f) => (roll -= f.weight) < 0) ?? FISH[0];
  });
}

// ---------------------------------------------------------------- hứng trân châu

export const DROPS = {
  pearl: { score: 1 },
  gold: { score: 5 },
  ice: { score: -3 },
};

/**
 * Lịch rơi trong ván: mỗi vật có thời điểm xuất hiện `t` (giây), vị trí ngang `x` (0–1),
 * tốc độ rơi `speed` (chiều cao màn chơi mỗi giây). Càng về cuối càng dày và nhanh.
 */
export function pearlSchedule(seed, duration = GAMES.pearls.duration) {
  const r = rng(seed);
  const drops = [];
  for (let t = 0.6; t < duration - 1; ) {
    const progress = t / duration;
    const roll = r();
    const kind = roll < 0.06 ? 'gold' : roll < 0.22 + progress * 0.12 ? 'ice' : 'pearl';
    drops.push({ t: Math.round(t * 100) / 100, x: 0.06 + r() * 0.88, kind, speed: 0.38 + progress * 0.35 + r() * 0.12 });
    t += 0.55 - progress * 0.3 + r() * 0.25;
  }
  return drops;
}

// ---------------------------------------------------------------- ghép hình nhớ

export const MEMORY_SYMBOLS = ['boba', 'fish', 'heart', 'star', 'leaf', 'berry', 'cake', 'moon'];

/** 16 thẻ (8 cặp) đã xáo theo hạt giống. */
export function memoryDeck(seed) {
  const r = rng(seed);
  const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ---------------------------------------------------------------- kiểm tra & tính thưởng

/**
 * Kiểm tra kết quả client gửi lên với thời gian thật đã trôi (giây, do server đo).
 * Trả về { ok, reason } hoặc { ok, score, coins, portions: { fish, pearl }, skill: { name, amount } }.
 * Đây là phần thưởng thô, chưa áp giới hạn ngày.
 */
export function judge(game, seed, elapsed, result) {
  const fail = (reason) => ({ ok: false, reason });
  if (!result || typeof result !== 'object') return fail('Kết quả không hợp lệ.');

  if (game === 'fishing') {
    const caught = result.caught;
    if (!Array.isArray(caught) || caught.some((c) => typeof c !== 'boolean')) return fail('Kết quả không hợp lệ.');
    if (caught.length > Math.floor(elapsed / MIN_CAST_SECONDS) + 1) return fail('Quăng cần nhanh hơn sức người.');
    const seq = fishSequence(seed);
    if (caught.length > seq.length) return fail('Quá nhiều lần quăng.');
    const fish = seq.slice(0, caught.length).filter((_, i) => caught[i]);
    return {
      ok: true,
      score: fish.length,
      coins: fish.reduce((sum, f) => sum + f.coins, 0),
      portions: { fish: fish.reduce((sum, f) => sum + f.portions, 0), pearl: 0 },
      skill: { name: 'agility', amount: 0.25 * fish.length },
      detail: fish.map((f) => f.id),
    };
  }

  if (game === 'pearls') {
    const caught = result.caught;
    if (!Array.isArray(caught) || !caught.every(Number.isInteger)) return fail('Kết quả không hợp lệ.');
    const drops = pearlSchedule(seed);
    const seen = new Set();
    for (const i of caught) {
      if (i < 0 || i >= drops.length || seen.has(i)) return fail('Kết quả không hợp lệ.');
      if (drops[i].t > elapsed + 0.5) return fail('Hứng được vật chưa kịp rơi.');
      seen.add(i);
    }
    const score = caught.reduce((sum, i) => sum + DROPS[drops[i].kind].score, 0);
    const pearls = caught.filter((i) => drops[i].kind === 'pearl').length;
    return {
      ok: true,
      score,
      coins: Math.max(0, Math.round(score * 0.5)),
      portions: { fish: 0, pearl: Math.floor(pearls / 4) },
      skill: { name: 'agility', amount: 0.15 * Math.max(0, Math.min(score, 30)) / 3 },
    };
  }

  if (game === 'memory') {
    const { moves, pairs } = result;
    if (!Number.isInteger(moves) || !Number.isInteger(pairs) || pairs < 0 || pairs > 8) return fail('Kết quả không hợp lệ.');
    if (moves < pairs) return fail('Số lượt không khớp.');
    if (pairs === 8 && elapsed < 8) return fail('Lật thẻ nhanh hơn sức người.');
    const bonus = pairs < 8 ? 0 : moves <= 12 ? 12 : moves <= 16 ? 6 : 0;
    return {
      ok: true,
      score: pairs * 10 - Math.max(0, moves - 8),
      coins: pairs * 3 + bonus,
      portions: { fish: 0, pearl: 0 },
      skill: { name: 'intellect', amount: 0.4 + pairs * 0.1 },
    };
  }

  return fail('Không có trò chơi này.');
}
