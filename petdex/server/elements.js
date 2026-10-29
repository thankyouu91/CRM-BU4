// Ngũ hành trong luật chơi: hệ số lên kỹ năng, XP và lương theo loài, bộ đồ đang mặc và vận khí ngày.
import { getPet, setSkill, skillsOf } from './db.js';
import { dayKey } from './clock.js';
import { gainSkill } from './rules/careers.js';
import { ELEMENT_RULES, elementOfSpecies, fortuneOf, fullSetOf, statsOfSpecies, wearBonus } from '../../public/ta-tua/game/js/shared/pets.js';

/** Hành của bé đang vượng hôm nay không. */
export const isFortunate = (pet, now = Date.now()) => elementOfSpecies(pet.species) === fortuneOf(dayKey(now));

/** Hệ số lên kỹ năng `skill`: sở trường của loài × bộ đồ hợp mệnh (kỵ mệnh nặng nhất cũng không dưới 50%). */
export function skillFactor(pet, skill) {
  const gear = 1 + (pet.bonus?.stats ?? 0) / 100; // trang phục: % "Chỉ số"
  return statsOfSpecies(pet.species).growth[skill] * Math.max(0.5, 1 + wearBonus(pet.wear, elementOfSpecies(pet.species))) * gear;
}

/** Cộng `raw` điểm kỹ năng cho bé `petId` theo hệ số ngũ hành; trả về điểm trước và sau. */
export function growSkill(petId, skill, raw) {
  const pet = getPet(petId);
  const before = skillsOf(petId)[skill] ?? 0;
  const after = gainSkill(before, raw * skillFactor(pet, skill));
  setSkill(petId, skill, after);
  return { before, after };
}

/** Hành vượng hôm nay thì thêm 10% XP. */
export const xpFactor = (pet, now = Date.now()) => (isFortunate(pet, now) ? 1 + ELEMENT_RULES.fortune : 1);

/** Hệ số lương ca làm: vận khí ngày, bộ đồ đủ 4 khe cùng hành, bé Hỏa làm nghề dùng Sức mạnh. */
export function elementPay(pet, now = Date.now(), careerSkill = null) {
  let k = 1;
  if (isFortunate(pet, now)) k += ELEMENT_RULES.fortune;
  if (fullSetOf(pet.wear)) k += ELEMENT_RULES.fullSet;
  k += (pet.bonus?.income ?? 0) / 100; // trang phục: % "Thu nhập ca làm"
  if (careerSkill === 'strength' && elementOfSpecies(pet.species) === 'hoa') k += ELEMENT_RULES.perks.hoa.strengthPay;
  return k;
}

/** Bé có thuộc hành `element` không (theo mã loài). */
export const isElement = (speciesId, element) => elementOfSpecies(speciesId) === element;
