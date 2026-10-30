// Luật chơi thuần: không đụng tới DB hay HTTP, dùng chung cho REST API và sân chơi.
import { HEALTH, ILLNESSES, NIGHT_SHIFT, TRAITS, has, healthDelta, sickChance } from './rules/production.js';
import {
  EGG, ELEMENTS, LIFE, WEARABLES, elementOfSpecies, foodBonus, lifespanWeeks, speciesOrGuest, stageAt, statsOfSpecies,
} from '../../public/ta-tua/game/js/shared/pets.js';
import { ESSENTIALS, clanItemId } from '../../public/ta-tua/game/js/shared/industry.js';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** 1 ngày ngoài đời = 1 tuần tuổi của thú cưng. */
export const PET_DAY_MS = DAY / 7;

export const RULES = {
  startCoins: 150,
  adoptCost: 200,
  maxPets: 4,
  dailyReward: 60,
  dailyCooldownMs: 20 * HOUR,
};

/**
 * Mốc giai đoạn tính bằng ngày tuổi (7 ngày tuổi = 1 ngày thật), khớp LIFE_STAGES trong shared/pets.js.
 * `scale` chỉ dùng cho bé khách mời Petdex (ảnh vẽ sẵn); bé vẽ bằng bộ khung đã tự đổi dáng theo tuổi.
 */
export const STAGES = [
  { key: 'baby', label: 'Sơ sinh', minDays: 0, scale: 0.66 },
  { key: 'kid', label: 'Nhí nhố', minDays: 14, scale: 0.76 },
  { key: 'teen', label: 'Thiếu niên', minDays: 56, scale: 0.88 },
  { key: 'young', label: 'Thanh niên', minDays: 147, scale: 0.95 },
  { key: 'adult', label: 'Trưởng thành', minDays: 280, scale: 1 },
  { key: 'elder', label: 'Lão làng', minDays: 490, scale: 1 },
];

/** Thay đổi chỉ số mỗi giờ khi thú cưng tự sinh hoạt; lúc đi làm thì năng lượng và no bụng tụt nhanh hơn. */
const PER_HOUR = { fullness: -8, happiness: -4, energy: 12 };
const BUSY_PER_HOUR = { fullness: -12, energy: -10 };
const HUNGRY_AT = 20;
const DIRTY_AT = 20;
const STATS = ['fullness', 'happiness', 'energy', 'hygiene', 'health'];

const CATALOG = {
  boba: { name: 'Trà sữa trân châu', icon: '🧋', type: 'food', element: 'moc', price: 12, effect: { fullness: 20, happiness: 6 }, xp: 6, desc: 'Món khoái khẩu của mọi bé rái cá.' },
  fish: { name: 'Cá tươi', icon: '🐟', type: 'food', element: 'thuy', price: 18, effect: { fullness: 32 }, xp: 8, desc: 'Vừa vớt dưới suối lên.' },
  onigiri: { name: 'Cơm nắm', icon: '🍙', type: 'food', element: 'tho', price: 25, effect: { fullness: 45, energy: 5 }, xp: 10, desc: 'Chắc bụng, ăn là có sức.' },
  sushi: { name: 'Khay sushi', icon: '🍣', type: 'food', element: 'thuy', price: 45, effect: { fullness: 60, happiness: 12 }, xp: 18, minLevel: 3, desc: 'Bữa sang chảnh cuối tuần.' },
  cake: { name: 'Bánh kem dâu', icon: '🍰', type: 'food', element: 'hoa', price: 70, effect: { fullness: 30, happiness: 35 }, xp: 30, minLevel: 5, desc: 'Ăn một miếng, vui cả ngày.' },

  juice: { name: 'Nước tăng lực', icon: '🧃', type: 'care', element: 'kim', price: 30, effect: { energy: 40 }, xp: 4, desc: 'Hồi sức tức thì.' },
  bath: { name: 'Tắm bong bóng', icon: '🛁', type: 'care', element: 'thuy', price: 35, effect: { happiness: 25, energy: 10, hygiene: 60 }, xp: 8, desc: 'Thơm tho, sạch sẽ, sảng khoái.' },
  vitamin: { name: 'Vitamin tổng hợp', icon: '💊', type: 'care', element: 'kim', price: 55, effect: { fullness: 15, happiness: 15, energy: 25, health: 15 }, xp: 12, minLevel: 4, desc: 'Khỏe từ trong ra ngoài.' },

  ball: { name: 'Bóng nảy', icon: '⚽', type: 'toy', price: 60, play: { happiness: 8, xp: 4 }, desc: 'Dùng mãi mãi. Chơi vui hơn, thêm XP.' },
  yarn: { name: 'Cuộn len', icon: '🧶', type: 'toy', price: 90, play: { happiness: 12, xp: 6 }, minLevel: 2, desc: 'Lăn lộn cả buổi không chán.' },
  kite: { name: 'Diều giấy', icon: '🪁', type: 'toy', price: 180, play: { happiness: 18, xp: 10 }, minLevel: 6, desc: 'Bay cao, vui cao.' },

  ...wearables({
    bow: { icon: '🎀', price: 80, desc: 'Điệu đà dễ thương.' },
    leafband: { icon: '🌿', price: 70, desc: 'Vòng lá non mát rượi.' },
    scarf: { icon: '🧣', price: 70, desc: 'Khăn quàng đỏ thắm.' },
    bowtie: { icon: '🎗️', price: 60, desc: 'Nơ cổ nâu chỉn chu.' },
    flower: { icon: '🌸', price: 100, minLevel: 2, desc: 'Thơm mùi mùa xuân.' },
    nonla: { icon: '👒', price: 110, minLevel: 2, desc: 'Nón lá quê nhà, che nắng che mưa.' },
    leafscarf: { icon: '🍃', price: 80, minLevel: 2, desc: 'Khăn kết từ lá non.' },
    bell: { icon: '🔔', price: 90, minLevel: 2, desc: 'Leng keng mỗi bước chạy.' },
    glasses: { icon: '👓', price: 120, minLevel: 3, desc: 'Gọng tròn, trông thông thái hẳn.' },
    shades: { icon: '🕶️', price: 150, minLevel: 3, desc: 'Ngầu nhất công viên.' },
    beret: { icon: '🎨', price: 130, minLevel: 3, desc: 'Mũ nồi của nghệ sĩ.' },
    tophat: { icon: '🎩', price: 220, minLevel: 5, desc: 'Lịch lãm từng centimet.' },
    pearls: { icon: '📿', price: 260, minLevel: 5, desc: 'Ngọc trai biển sâu.' },
    cape: { icon: '🦸', price: 380, minLevel: 5, desc: 'Áo choàng tung bay.' },
    angel: { icon: '🪽', price: 450, minLevel: 10, desc: 'Đôi cánh trắng muốt.' },
    crown: { icon: '👑', price: 500, minLevel: 20, desc: 'Dành cho bậc thầy nuôi thú.' },
    dragonwings: { icon: '🐉', price: 600, minLevel: 20, desc: 'Cánh rồng đỏ rực.' },
    leafglasses: { icon: '🌱', price: 120, minLevel: 3, desc: 'Gọng kính kết từ lá non.' },
    heartglasses: { icon: '💗', price: 140, minLevel: 3, desc: 'Nhìn đâu cũng thấy đáng yêu.' },
    woodglasses: { icon: '🪵', price: 120, minLevel: 3, desc: 'Gọng gỗ mộc mạc.' },
    butterfly: { icon: '🦋', price: 420, minLevel: 6, desc: 'Đôi cánh bướm xanh biếc.' },
    wavecape: { icon: '🌊', price: 400, minLevel: 6, desc: 'Áo choàng dập dềnh như sóng.' },
    cap: { icon: '🧢', price: 90, desc: 'Mũ lưỡi trai xanh, đội ngược cho ngầu.' },
    strawhat: { icon: '👒', price: 95, desc: 'Mũ rơm đi thăm đồng.' },
    mushroom: { icon: '🍄', price: 120, minLevel: 2, desc: 'Mũ nấm đỏ chấm trắng.' },
    devilhorns: { icon: '😈', price: 160, minLevel: 4, desc: 'Hai sừng nhỏ tinh nghịch.' },
    halo: { icon: '😇', price: 480, minLevel: 30, desc: 'Vòng sáng lơ lửng trên đầu.' },
    monocle: { icon: '🧐', price: 150, minLevel: 4, desc: 'Kính một mắt của nhà quý tộc.' },
    partymask: { icon: '🎭', price: 170, minLevel: 4, desc: 'Mặt nạ đêm hội hóa trang.' },
    starglasses: { icon: '⭐', price: 180, minLevel: 5, desc: 'Gọng ngôi sao lấp lánh.' },
    bandana: { icon: '🥷', price: 140, minLevel: 3, desc: 'Khăn lá bịt mắt như ninja rừng.' },
    medal: { icon: '🏅', price: 300, minLevel: 12, desc: 'Phần thưởng cho bé chăm chỉ.' },
    jade: { icon: '🟢', price: 240, minLevel: 6, desc: 'Ngọc bích xanh mát, giữ bình an.' },
    necktie: { icon: '👔', price: 110, minLevel: 2, desc: 'Cà vạt chỉn chu đi làm.' },
    lei: { icon: '🌺', price: 130, minLevel: 3, desc: 'Vòng hoa rực rỡ ngày hội.' },
    amber: { icon: '🟠', price: 220, minLevel: 6, desc: 'Hổ phách ấm áp từ lòng đất.' },
    backpack: { icon: '🎒', price: 160, minLevel: 3, desc: 'Ba lô nhỏ đựng đầy bánh kẹo.' },
    batwings: { icon: '🦇', price: 420, minLevel: 10, desc: 'Cánh dơi đêm trăng.' },
    fairy: { icon: '🧚', price: 460, minLevel: 15, desc: 'Cánh tiên trong veo như pha lê.' },
    phoenix: { icon: '🐦‍🔥', price: 800, minLevel: 40, desc: 'Cánh phượng hoàng rực lửa tái sinh.' },
    lantern: { icon: '🏮', price: 120, desc: 'Đèn lồng đỏ soi đường đêm hội.' },
    clover: { icon: '🍀', price: 140, desc: 'Cỏ bốn lá đem lại may mắn.' },
    luckycoin: { icon: '🪙', price: 180, minLevel: 3, desc: 'Đồng xu vàng lấp lánh.' },
    seashell: { icon: '🐚', price: 150, minLevel: 2, desc: 'Vỏ sò nghe được tiếng biển.' },
    gourd: { icon: '🫙', price: 200, minLevel: 5, desc: 'Hồ lô gỗ của lữ khách.' },
    balloon: { icon: '🎈', price: 100, desc: 'Bóng bay xanh bay lơ lửng.' },
    // Bộ cấp cao: lấp chỗ còn thưa (mặt Thổ, lưng Mộc, bùa) và làm mốc cho bé cấp 10–40.
    goggles: { icon: '🥽', price: 180, minLevel: 10, desc: 'Kính bảo hộ của thợ mỏ, gọng đồng chắc chắn.' },
    khandong: { icon: '🧕', price: 300, minLevel: 20, desc: 'Khăn đóng xanh ngày Tết.' },
    aotoi: { icon: '🌾', price: 520, minLevel: 20, desc: 'Áo tơi lá cọ, che mưa che nắng ngoài đồng.' },
    sao: { icon: '🎋', price: 260, minLevel: 20, desc: 'Sáo trúc vi vu đầu làng.' },
    lotus: { icon: '🪷', price: 340, minLevel: 30, desc: 'Đóa sen hồng cài trên đầu, thơm thanh khiết.' },
    goldmask: { icon: '🎭', price: 380, minLevel: 30, desc: 'Mặt nạ vàng của đêm hội trăng rằm.' },
    quat: { icon: '🪭', price: 360, minLevel: 30, desc: 'Quạt lông phượng, phẩy là nóng bừng.' },
    trongdong: { icon: '🥁', price: 480, minLevel: 40, desc: 'Trống đồng nhỏ, hoa văn chim Lạc.' },
    starcape: { icon: '🌌', price: 900, minLevel: 40, desc: 'Áo choàng tinh tú, lấp lánh cả dải ngân hà.' },
  }),
  ...eggs(),
};

/** Trứng ngũ hành: mỗi hành một quả, ấp 1 ngày thật thì nở ra một bé của hành đó. */
function eggs() {
  return Object.fromEntries(Object.entries(ELEMENTS).map(([el, e]) => [`egg_${el}`, {
    name: `Trứng ${e.name}`, icon: '🥚', type: 'egg', element: el, price: EGG.price, minLevel: EGG.minLevel,
    desc: `Ấp ${EGG.hours} giờ, nở ra một bé hành ${e.name}. Có thể là loài hiếm!`,
  }]));
}

/** Đồ đeo: tên, khe, hành lấy từ shared/pets.js (cùng nguồn với hình vẽ); giá và mô tả ở đây. */
function wearables(shop) {
  return Object.fromEntries(Object.entries(shop).map(([id, extra]) => {
    const w = WEARABLES[id];
    return [id, { name: w.name, type: 'accessory', slot: w.slot, element: w.element, ...extra }];
  }));
}

/**
 * Hàng gia tộc ở Siêu thị (essentials.js): Suất ăn gia tộc từ Thực phẩm chế biến, Bộ chăm sóc gia tộc từ Thuốc,
 * mỗi loại 3 hạng Thường / Ngon / Tuyệt hảo. Hiệu ứng và XP nhân hệ số hạng; giá và số lượng theo kho Siêu thị.
 */
const CLAN_GOODS = {
  food: { name: 'Suất ăn gia tộc', icon: '🍱', element: 'tho', price: 24, effect: { fullness: 50, happiness: 12 }, xp: 22, desc: 'Nấu từ nông sản các gia tộc tự trồng, nhiều XP hơn đồ NPC.' },
  care: { name: 'Bộ chăm sóc gia tộc', icon: '🧴', element: 'kim', price: 52, effect: { happiness: 15, energy: 25, health: 15, hygiene: 30 }, xp: 14, desc: 'Dược phẩm các gia tộc bào chế: tắm, bổ, khỏe trong một hộp.' },
};
function clanGoods() {
  const out = {};
  for (const [cat, base] of Object.entries(CLAN_GOODS)) {
    ESSENTIALS.qualities.forEach((q, i) => {
      out[clanItemId(cat, i)] = {
        ...base,
        name: i ? `${base.name} (${q.name})` : base.name,
        type: cat,
        price: Math.round(base.price * q.mult),
        effect: Object.fromEntries(Object.entries(base.effect).map(([k, v]) => [k, Math.round(v * q.mult)])),
        xp: Math.round(base.xp * q.mult),
        clanMade: true,
        quality: i,
      };
    });
  }
  return out;
}

export const ITEMS = Object.fromEntries(Object.entries({ ...CATALOG, ...clanGoods() }).map(([id, item]) => [id, { id, ...item }]));

/** Đồ ăn và đồ chăm sóc dùng là hết; đồ chơi và phụ kiện mua một lần dùng mãi. */
export const isConsumable = (item) => item.type === 'food' || item.type === 'care';

/** Lỗi do người chơi (thiếu xu, thú mệt...), trả về nguyên văn cho client. */
export class GameError extends Error {}

export const clamp = (value, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, value));

/** Bé đang bận việc gì: 'work' (ca làm), 'night' (ca đêm ở xưởng), 'school' (lớp học) hay 'bath' (tắm); lúc rảnh là null. */
export const busyKind = (pet, now = Date.now()) => (isBusy(pet, now) ? pet.busy_kind ?? 'work' : null);
const BUSY_TEXT = { work: 'đang đi làm', night: 'đang làm ca đêm', school: 'đang đi học', bath: 'đang tắm' };

/** Số giờ trong [from, to] trùng với lúc bé bận việc hao sức (ca làm, lớp học); tắm tính như lúc rảnh. */
function busyHours(pet, from, to) {
  if (!pet.busy_from || !pet.busy_until || pet.busy_kind === 'bath') return 0;
  return Math.max(0, Math.min(to, pet.busy_until) - Math.max(from, pet.busy_from)) / HOUR;
}

/**
 * Tính chỉ số hiện tại dựa trên thời gian trôi qua kể từ lần lưu cuối.
 * Đói hoặc đang ốm thì vui vẻ giảm nhanh gấp đôi; đói hoặc bẩn thì sức khỏe tụt, còn no và sạch thì sức khỏe hồi.
 */
export function tick(pet, now = Date.now()) {
  const hours = Math.max(0, now - pet.updated_at) / HOUR;
  const busy = busyHours(pet, pet.updated_at, now);
  const free = hours - busy;
  // Mỗi loài hao/hồi chỉ số một kiểu (hành và loài, xem shared/pets.js), cộng thêm tính cách.
  const st = statsOfSpecies(pet.species);
  // Giai đoạn tuổi: thanh niên ăn nhiều, thiếu niên ẩm ương mau buồn, lão làng hồi sức chậm.
  const sr = stageRules(pet.born_at, now);
  const hunger = (has(pet, 'glutton') ? 1.2 : 1) * st.fullness * (sr.spend ?? 1);
  const fullnessLoss = (-PER_HOUR.fullness * free - BUSY_PER_HOUR.fullness * busy) * hunger;
  const lossPerHour = hours > 0 ? fullnessLoss / hours : -PER_HOUR.fullness * hunger;
  const hoursUntilHungry = Math.max(0, (pet.fullness - HUNGRY_AT) / lossPerHour);
  const hungryHours = Math.max(0, hours - hoursUntilHungry);
  const hygiene = pet.hygiene ?? 80;
  const health = pet.health ?? 90;
  const dirtyPerHour = -HEALTH.hygienePerHour * st.hygiene;
  const dirtyAfter = Math.max(0, (hygiene - DIRTY_AT) / dirtyPerHour);
  const goodFor = pet.sick ? 0 : Math.min(hoursUntilHungry, dirtyAfter);
  const regen = (has(pet, 'sleepy') ? 1.2 : 1) * st.energyRegen * (sr.energyRegen ?? 1);
  return {
    ...pet,
    fullness: clamp(pet.fullness - fullnessLoss),
    happiness: clamp(pet.happiness + PER_HOUR.happiness * st.happiness * (sr.moodDrop ?? 1) * (hours + hungryHours + (pet.sick ? hours : 0))),
    // Ca đêm hao sức gấp 1,5 lần ca thường.
    energy: clamp(pet.energy + PER_HOUR.energy * regen * free + BUSY_PER_HOUR.energy * busy * (pet.busy_kind === 'night' ? NIGHT_SHIFT.energy : 1)),
    hygiene: clamp(hygiene - dirtyPerHour * hours),
    health: clamp(health + healthDelta(hours, { hungryAfter: hoursUntilHungry, dirtyAfter, goodFor, regen: st.healthRegen })),
    updated_at: Math.max(pet.updated_at, now),
  };
}

/** Sức khỏe thấp lâu thì có thể đổ bệnh (gọi khi lưu bé, với số giờ đã trôi). */
export function rollSickness(pet, hours, rand = Math.random) {
  if (pet.sick || pet.health >= HEALTH.sickBelow || hours <= 0) return pet;
  // Bé sơ sinh và lão làng ốm gấp đôi, bé trưởng thành ít ốm nhất.
  const stage = stageRules(pet.born_at, pet.updated_at).sickness ?? 1;
  if (rand() >= sickChance(hours) * statsOfSpecies(pet.species).sickness * stage) return pet;
  return { ...pet, sick: rand() < 0.5 ? 'cold' : 'stomach' };
}

/** Tắm ở nhà: miễn phí, sạch tinh tươm, bé bận 15 phút. */
export function bathe(pet, now = Date.now()) {
  if (isBusy(pet, now)) throw new GameError(`${pet.name} đang bận, xong việc rồi tắm nhé.`);
  return {
    pet: { ...applyEffect(pet, boostEffect(pet, { hygiene: 100, happiness: 5 })), busy_from: now, busy_until: now + HEALTH.bathMinutes * 60_000, busy_kind: 'bath' },
    xp: 2,
    coins: 0,
  };
}

export function requireHealthy(pet, what) {
  if (pet.sick) throw new GameError(`${pet.name} đang ${ILLNESSES[pet.sick].name.toLowerCase()}, đưa bé đi khám rồi hẵng ${what}.`);
}

export const isBusy = (pet, now = Date.now()) => Boolean(pet.busy_until && pet.busy_until > now);

export function applyEffect(pet, effect = {}) {
  const next = { ...pet };
  for (const stat of STATS) if (effect[stat]) next[stat] = clamp(next[stat] + effect[stat]);
  return next;
}

export const xpToNext = (level) => 80 + (level - 1) * 40;
export const levelReward = (level) => 20 + level * 10;

export function ageInfo(bornAt, now = Date.now()) {
  // Nhân trước rồi chia để tránh sai số số thực (PET_DAY_MS không nguyên).
  const days = Math.max(0, Math.floor(((now - bornAt) * 7) / DAY));
  const stage = STAGES.findLast((s) => days >= s.minDays);
  return { days, weeks: Math.floor(days / 7), stage: stage.key, label: stage.label, scale: stage.scale };
}

/** Luật của giai đoạn tuổi lúc `now` (xem LIFE_STAGES trong shared/pets.js). */
export const stageRules = (bornAt, now = Date.now()) => stageAt(ageInfo(bornAt, now).weeks).rules;

/** Tuổi thọ của bé (tuần), số tuần còn lại, và có cần báo trước không. */
export function lifeOf(pet, now = Date.now()) {
  const lifespan = lifespanWeeks(speciesOrGuest(pet.species), pet.health_avg ?? 80);
  const weeks = ageInfo(pet.born_at, now).weeks;
  const left = Math.max(0, lifespan - weeks);
  return { lifespan, weeks, left, warn: left <= LIFE.warnWeeks };
}

/** Thứ tự giai đoạn để so sánh "đủ lớn chưa". */
export const stageIndex = (key) => STAGES.findIndex((s) => s.key === key);

export function mood(pet) {
  if (pet.sick) return { key: 'sick', label: ILLNESSES[pet.sick].name };
  if (pet.fullness < HUNGRY_AT) return { key: 'hungry', label: 'Đói meo' };
  if ((pet.hygiene ?? 80) < DIRTY_AT) return { key: 'dirty', label: 'Lấm lem' };
  if (pet.energy < 15) return { key: 'tired', label: 'Buồn ngủ' };
  if (pet.happiness < 25) return { key: 'sad', label: 'Buồn thiu' };
  const avg = (pet.fullness + pet.happiness + pet.energy) / 3;
  return avg >= 70 ? { key: 'great', label: 'Vui phơi phới' } : { key: 'ok', label: 'Bình thường' };
}

// Mỗi hành động trả về { pet, xp, coins }; settle() lo phần lên cấp.

/** % "Chỉ số" từ trang phục bé đang đeo làm phần cộng của chăm sóc mạnh hơn (phần trừ giữ nguyên). */
export function boostEffect(pet, effect = {}) {
  const pct = pet.bonus?.stats ?? 0;
  if (!pct) return effect;
  return Object.fromEntries(Object.entries(effect).map(([k, v]) => [k, v > 0 ? Math.round(v * (1 + pct / 100)) : v]));
}

/** `xpFactor`: hệ số XP của đồ NPC theo giai đoạn tự chủ của nhóm (essentials.js). */
export function useItem(pet, item, { xpFactor = 1 } = {}) {
  if (!item || !isConsumable(item)) throw new GameError('Món này không dùng trực tiếp được.');
  if (item.type === 'food' && pet.fullness >= 97) throw new GameError(`${pet.name} no căng bụng rồi!`);
  // Món hợp mệnh (cùng hành hoặc hành nuôi dưỡng bé) cho thêm 20% XP.
  const xp = Math.round((item.xp ?? 0) * xpFactor * (item.type === 'food' && has(pet, 'glutton') ? 1.3 : 1) * (1 + foodBonus(item.element, elementOfSpecies(pet.species))));
  return { pet: applyEffect(pet, boostEffect(pet, item.effect)), xp, coins: 0 };
}

export function play(pet, toy) {
  const kind = busyKind(pet, pet.updated_at);
  if (kind) throw new GameError(`${pet.name} ${BUSY_TEXT[kind]}, xong rồi chơi nhé.`);
  if (pet.energy < 15) throw new GameError(`${pet.name} mệt quá, để bé nghỉ chút đã.`);
  if (pet.fullness < 10) throw new GameError(`${pet.name} đói quá, không chơi nổi.`);
  const bonus = toy?.play ?? {};
  const joy = (12 + (bonus.happiness ?? 0)) * (has(pet, 'playful') ? 1.5 : 1);
  return {
    pet: applyEffect(pet, boostEffect(pet, { energy: -15, fullness: -5, hygiene: -5, happiness: Math.round(joy) })),
    xp: 10 + (bonus.xp ?? 0),
    coins: 4,
  };
}

/** Được thú cưng khác vuốt ve ở sân chơi. */
export function cuddle(pet) {
  return { pet: applyEffect(pet, { happiness: 6 }), xp: 5, coins: 0 };
}

/** Cộng XP, xử lý lên nhiều cấp một lúc và gộp xu thưởng. */
export function settle({ pet, xp = 0, coins = 0 }) {
  let { level } = pet;
  let current = pet.xp + xp;
  const levelsGained = [];
  while (current >= xpToNext(level)) {
    current -= xpToNext(level);
    level += 1;
    levelsGained.push(level);
    coins += levelReward(level);
  }
  return { pet: { ...pet, level, xp: current }, xp, coins, levelsGained };
}

export function describePet(row, now = Date.now()) {
  const pet = tick(row, now);
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    element: elementOfSpecies(pet.species),
    wear: pet.wear ?? {},
    level: pet.level,
    xp: pet.xp,
    xpNext: xpToNext(pet.level),
    fullness: Math.round(pet.fullness),
    happiness: Math.round(pet.happiness),
    energy: Math.round(pet.energy),
    hygiene: Math.round(pet.hygiene ?? 80),
    health: Math.round(pet.health ?? 90),
    sick: pet.sick ? { id: pet.sick, ...ILLNESSES[pet.sick] } : null,
    traits: (pet.traits ?? []).filter((t) => TRAITS[t]),
    bornAt: pet.born_at,
    age: ageInfo(pet.born_at, now),
    mood: mood(pet),
    busyUntil: isBusy(pet, now) ? pet.busy_until : null,
    busyKind: busyKind(pet, now),
    life: lifeOf(pet, now),
  };
}
