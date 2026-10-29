// Luật nghề nghiệp và kỹ năng (hàm thuần).
import { GameError, clamp, stageIndex } from '../game.js';

export const SKILLS = {
  strength: { name: 'Sức mạnh', icon: '💪' },
  agility: { name: 'Nhanh nhẹn', icon: '🏃' },
  intellect: { name: 'Thông minh', icon: '🧠' },
  charm: { name: 'Duyên dáng', icon: '✨' },
  craft: { name: 'Khéo tay', icon: '🖐️' },
};

export const CAREERS = {
  barista: { name: 'Pha chế', icon: '🧋', skill: 'craft', pay: [14, 20, 28, 38, 52], desc: 'Pha trà sữa ở quán đầu phố.' },
  courier: { name: 'Giao hàng', icon: '📦', skill: 'agility', pay: [15, 21, 29, 39, 54], desc: 'Chạy khắp phố giao bưu kiện.' },
  porter: { name: 'Bốc vác', icon: '🏋️', skill: 'strength', pay: [16, 22, 30, 40, 55], desc: 'Khuân hàng ở bến cảng.' },
  tutor: { name: 'Gia sư', icon: '📚', skill: 'intellect', pay: [13, 20, 30, 42, 58], desc: 'Dạy kèm cho các bé nhỏ hơn.' },
  singer: { name: 'Ca sĩ đường phố', icon: '🎤', skill: 'charm', pay: [10, 16, 24, 36, 50], tips: 0.6, desc: 'Hát rong, khách vui thì boa thêm.' },
};

export const RANK_TITLES = ['Học việc', 'Nhân viên', 'Lành nghề', 'Chuyên gia', 'Bậc thầy'];
export const SHIFT_HOURS = [1, 2, 4];
export const MAX_HOURS_PER_DAY = 8;
export const ENERGY_PER_HOUR = 10;
export const XP_PER_HOUR = 4;
/** Lên bậc r+1 cần đủ giờ làm của nghề đó và kỹ năng chính. */
export const PROMOTION = [
  { hours: 16, skill: 20 },
  { hours: 60, skill: 40 },
  { hours: 150, skill: 60 },
  { hours: 300, skill: 80 },
];
/** Kỹ năng chính tăng mỗi giờ làm (trước khi giảm dần theo độ cao). */
export const SKILL_PER_HOUR = 0.6;
// Đi làm từ cấp 1: bé sơ sinh nhận được ca nhẹ (2 giờ/ngày, lương 50%, theo LIFE_STAGES).
const MIN_STAGE = 'baby';

export function initialSkills(rand) {
  return Object.fromEntries(Object.keys(SKILLS).map((k) => [k, Math.round((5 + rand() * 10) * 10) / 10]));
}

/** Kỹ năng càng cao càng khó lên. */
export const gainSkill = (current, amount) => clamp(current + amount * (1 - current / 150), 0, 100);

export function shiftPay(careerId, rank, skill, hours) {
  const career = CAREERS[careerId];
  return Math.round(career.pay[rank - 1] * (0.8 + skill / 200) * hours);
}

/** Tiền boa ngẫu nhiên cho nghề có boa, tính lúc nhận lương. */
export const tipsFor = (careerId, pay, rand) => Math.round(pay * (CAREERS[careerId].tips ?? 0) * rand());

export function canPromote(rank, hoursDone, skill) {
  const need = PROMOTION[rank - 1];
  return Boolean(need) && hoursDone >= need.hours && skill >= need.skill;
}

/** Kiểm tra trước khi nhận ca; `pet` đã được tick tới hiện tại. */
export function checkShift({ pet, stage, careerId, hours, hoursToday, busy, maxHours = MAX_HOURS_PER_DAY }) {
  if (careerId !== 'shop' && careerId !== 'factory' && !CAREERS[careerId]) throw new GameError('Không có nghề này.');
  if (!SHIFT_HOURS.includes(hours)) throw new GameError('Ca làm chỉ có 1, 2 hoặc 4 giờ.');
  if (stageIndex(stage) < stageIndex(MIN_STAGE)) throw new GameError(`${pet.name} còn bé quá, chưa đi làm được.`);
  // `busy`: việc bé đang làm ('work' | 'school' | 'bath'), hoặc true/false
  if (busy) throw new GameError(`${pet.name} ${{ school: 'đang đi học', bath: 'đang tắm' }[busy] ?? 'đang làm ca khác'}, xong rồi hẵng nhận ca.`);
  if (pet.sick) throw new GameError(`${pet.name} đang ốm, đưa bé đi khám rồi hẵng đi làm.`);
  if (hoursToday + hours > maxHours) {
    throw new GameError(`Hôm nay ${pet.name} chỉ làm thêm được ${Math.max(0, maxHours - hoursToday)} giờ nữa (tuổi này làm tối đa ${maxHours} giờ/ngày).`);
  }
  if (pet.energy < ENERGY_PER_HOUR * hours) throw new GameError(`${pet.name} cần ${ENERGY_PER_HOUR * hours} năng lượng cho ca ${hours} giờ.`);
  if (pet.fullness < 15) throw new GameError(`${pet.name} đói quá, cho ăn rồi hẵng đi làm.`);
}
