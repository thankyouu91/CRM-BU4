// Luật thị trấn (hàm thuần): thuế thu nhập lũy tiến, các đề xuất chi ngân sách, trợ cấp, nhiệm vụ, Hội.

/** [trần của bậc, thuế suất] theo thu nhập chịu thuế mỗi ngày. */
export const BRACKETS = [[300, 0], [1000, 0.05], [3000, 0.1], [Infinity, 0.15]];

/** Thuế lũy tiến; `cut` là số điểm % được giảm (từ đề xuất "Giảm thuế"). */
export function incomeTax(taxable, cut = 0) {
  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of BRACKETS) {
    if (taxable > prev) tax += (Math.min(taxable, cap) - prev) * Math.max(0, rate - cut);
    prev = cap;
  }
  return Math.floor(tax);
}

export const STIPEND = { amount: 30, days: 7 };
export const TREASURY_SEED = 5000;

/** Đề xuất chi ngân sách; mỗi tuần bốc 3 cái cho người chơi bỏ phiếu. */
export const PROPOSALS = {
  bridge: { name: 'Xây cầu Phố–Hẻm', icon: '🌉', desc: '+15% khách cho các quầy ở Hẻm nhỏ trong 2 tuần.', cost: 3000, effect: { kind: 'traffic', target: 'alley', value: 0.15, days: 14 } },
  food_fest: { name: 'Lễ hội ẩm thực', icon: '🎪', desc: '+30% khách cho mọi quầy trong 3 ngày.', cost: 2000, effect: { kind: 'traffic', target: null, value: 0.3, days: 3 } },
  tax_cut: { name: 'Giảm thuế', icon: '✂️', desc: 'Thuế thu nhập giảm 2 điểm % trong 1 tuần.', cost: 1500, effect: { kind: 'tax_cut', target: null, value: 0.02, days: 7 } },
  milk_subsidy: { name: 'Trợ giá sữa tươi', icon: '🥛', desc: 'Giá sữa tươi trên Sàn giảm khoảng 15% trong 3 ngày.', cost: 1500, effect: { kind: 'news', target: 'milk', value: -0.15, days: 3 } },
  promote_town: { name: 'Quảng bá phố', icon: '📣', desc: '+10% khách cho mọi quầy trong 1 tuần.', cost: 2500, effect: { kind: 'traffic', target: null, value: 0.1, days: 7 } },
  newbie_fund: { name: 'Quỹ chào tân thủ', icon: '🐣', desc: 'Trợ cấp tân thủ tăng lên 50 xu/ngày trong 1 tuần.', cost: 1000, effect: { kind: 'stipend', target: null, value: 50, days: 7 } },
};

export function pickProposals(rand) {
  const keys = Object.keys(PROPOSALS);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys.slice(0, 3);
}

/** Phiếu nhiều nhất thắng; hòa thì lấy đề xuất rẻ hơn. Không ai bầu thì không làm gì. */
export function winner(rows) {
  const ranked = rows.filter((r) => r.votes > 0)
    .sort((a, b) => b.votes - a.votes || PROPOSALS[a.option].cost - PROPOSALS[b.option].cost);
  return ranked[0]?.option ?? null;
}

// ---------------------------------------------------------------- nhiệm vụ ngày

export const QUESTS = {
  feed: { text: 'Cho bé ăn 3 lần', goal: 3, reward: 25 },
  play: { text: 'Chơi với bé 2 lần', goal: 2, reward: 20 },
  minigame: { text: 'Chơi 2 ván mini-game', goal: 2, reward: 30 },
  shift: { text: 'Nhận lương 1 ca làm', goal: 1, reward: 35 },
  trade: { text: 'Giao dịch 1 lần trên Sàn', goal: 1, reward: 30, level: 2 },
  save: { text: 'Gửi tiền vào ngân hàng', goal: 1, reward: 25, level: 3 },
  cuddle: { text: 'Vuốt ve một bé ở công viên', goal: 1, reward: 25 },
  friend: { text: 'Thả tim nhà một người bạn', goal: 1, reward: 25, needs: 'friend' },
  donate: { text: 'Góp quỹ Hội', goal: 1, reward: 30, needs: 'guild' },
  serve: { text: 'Quầy bán được 20 ly', goal: 20, reward: 40, needs: 'business' },
  bath: { text: 'Tắm cho bé 1 lần', goal: 1, reward: 20 },
  school: { text: 'Cho bé đi học 1 buổi', goal: 1, reward: 30, level: 2 },
  harvest: { text: 'Thu hoạch 1 ô vườn', goal: 1, reward: 30, level: 2 },
  cook: { text: 'Nấu 1 món trong Bếp', goal: 1, reward: 30, level: 3 },
};
export const QUEST_SLOTS = 3;
export const QUEST_CHEST = 50;
export const QUEST_XP = 10;

/** Chọn 3 nhiệm vụ phù hợp với người chơi, cố định trong ngày theo hạt giống. */
export function pickQuests({ level, has }, rand) {
  const pool = Object.entries(QUESTS)
    .filter(([, q]) => (q.level ?? 0) <= level && (!q.needs || has[q.needs]))
    .map(([id]) => id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, QUEST_SLOTS);
}

/** Quà ngày tăng theo chuỗi đăng nhập liên tiếp, tối đa ở ngày thứ 7. */
export const dailyReward = (streak) => 60 + 10 * (Math.min(Math.max(streak, 1), 7) - 1);

// ---------------------------------------------------------------- Hội

export const GUILD = { createCost: 2000, maxMembers: 20 };
export const GUILD_EMBLEMS = ['🧋', '🐟', '🌸', '⭐', '🍀', '🦦', '🔥', '🌙', '🎀', '🍓'];
export const GUILD_UPGRADES = {
  office: { name: 'Văn phòng Hội', desc: '+3% lương ca làm cho mọi thành viên', costs: [3000, 8000, 20000], per: 0.03 },
  sign: { name: 'Biển hiệu Hội', desc: '+5% khách cho quầy của thành viên', costs: [2500, 7000, 18000], per: 0.05 },
};
/** Dự án tuần: góp đủ nguyên liệu (tính bằng lô) để xây một công trình cho công viên chung. */
export const GUILD_PROJECTS = {
  lanterns: { name: 'Dãy đèn lồng công viên', icon: '🏮', needs: { dried_tea: 20, sugar: 20 }, prestige: 100, reward: 40 },
  fountain: { name: 'Sửa đài phun nước', icon: '⛲', needs: { cassava: 30, cane: 30 }, prestige: 100, reward: 40 },
  tea_stall: { name: 'Quán trà miễn phí cho người qua đường', icon: '🍵', needs: { tea_leaf: 40, milk: 15 }, prestige: 120, reward: 50 },
  fish_feast: { name: 'Tiệc cá cuối tuần', icon: '🐟', needs: { fish: 10, sugar: 15 }, prestige: 120, reward: 50 },
};
