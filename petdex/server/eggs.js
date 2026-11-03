// Trứng ngũ hành và bé mới: mua trứng ở Siêu thị, ấp 24 giờ, nở ra một loài của hành đó (có thể là loài hiếm).
import { db, getUser, insertPet, listPets, setActivePet, setSkill, setTraits, takeItem, transaction } from './db.js';
import { GameError, HOUR, ITEMS, RULES } from './game.js';
import { initialSkills } from './rules/careers.js';
import { TRAITS, rollTraits } from './rules/production.js';
import { EGG, ELEMENTS, RARITIES, SKILL_IDS, SPECIES_BY_ID, rollEggSpecies, statsOfSpecies } from '../../public/ta-tua/game/js/shared/pets.js';
import { slotsOf, takeHeirloom } from './lifecycle.js';

const q = {
  incubating: db.prepare('SELECT * FROM eggs WHERE user_id = ? AND hatched_at IS NULL ORDER BY hatch_at'),
  byId: db.prepare('SELECT * FROM eggs WHERE id = ?'),
  insert: db.prepare('INSERT INTO eggs (user_id, element, species, started_at, hatch_at) VALUES (?, ?, ?, ?, ?)'),
  hatch: db.prepare('UPDATE eggs SET hatched_at = ?, pet_id = ? WHERE id = ? AND hatched_at IS NULL'),
};

/**
 * Lập bé mới (nhận nuôi hoặc nở từ trứng): bốc tính cách, kỹ năng khởi đầu theo loài
 * (loài vẽ bằng bộ khung có số liệu riêng; loài khách mời bốc ngẫu nhiên như trước).
 */
export function createPet(userId, name, speciesId, now = Date.now(), rand = Math.random) {
  const traits = rollTraits(rand);
  const petId = insertPet(userId, name, speciesId, now);
  setTraits(petId, traits);
  const skills = { ...(SPECIES_BY_ID[speciesId] ? statsOfSpecies(speciesId).skills : initialSkills(rand)) };
  if (traits.includes('charming')) skills.charm += 5;
  // Kỷ vật của bé đã về với sao trời: bé mới thừa hưởng sở trường của bé cũ.
  const heirloom = takeHeirloom(userId, now);
  if (heirloom && SKILL_IDS.includes(heirloom.skill)) skills[heirloom.skill] += heirloom.amount;
  for (const [skill, value] of Object.entries(skills)) setSkill(petId, skill, value);
  if (!getUser(userId).active_pet_id) setActivePet(userId, petId);
  const traitText = traits.map((t) => `${TRAITS[t].icon} ${TRAITS[t].name}`).join(', ');
  return { petId, traits, traitText, heirloom };
}


export function eggsView(userId, now = Date.now()) {
  return q.incubating.all(userId).map((e) => ({
    id: e.id,
    element: e.element,
    startedAt: e.started_at,
    hatchAt: e.hatch_at,
    ready: now >= e.hatch_at,
  }));
}

/** Đem quả trứng `itemId` trong túi đi ấp. Loài bốc ngay lúc này, để ấp xong không đổi được kết quả. */
export function incubate(userId, itemId, now = Date.now(), rand = Math.random) {
  const item = ITEMS[itemId];
  if (!item || item.type !== 'egg') throw new GameError('Đây không phải trứng.');
  return transaction(() => {
    if (slotsOf(userId).free <= 0) {
      throw new GameError(`Đã đủ ${RULES.maxPets} ô nuôi (tính cả trứng đang ấp và ô tưởng niệm). Chờ có chỗ trống rồi ấp tiếp nhé.`);
    }
    takeItem(userId, itemId, 1);
    q.insert.run(userId, item.element, rollEggSpecies(item.element, rand), now, now + EGG.hours * HOUR);
    return { message: `🥚 Đã ấp ${item.name}. ${EGG.hours} giờ nữa trứng nở!` };
  });
}

export const heirloomText = (h) => (h ? ` Kỷ vật của ${h.from}: +${h.amount} ${SKILL_NAMES[h.skill] ?? h.skill}.` : '');
const SKILL_NAMES = { strength: 'Sức mạnh', agility: 'Nhanh nhẹn', intellect: 'Thông minh', charm: 'Duyên dáng', craft: 'Khéo tay' };

/** Trứng đủ giờ thì nở thành bé mới tên `name`. */
export function hatch(userId, eggId, name, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    const egg = q.byId.get(eggId);
    if (!egg || egg.user_id !== userId || egg.hatched_at) throw new GameError('Không tìm thấy quả trứng này.');
    if (now < egg.hatch_at) throw new GameError('Trứng chưa đủ ngày, kiên nhẫn chút nhé.');
    if (listPets(userId).length >= RULES.maxPets) throw new GameError(`Mỗi người nuôi tối đa ${RULES.maxPets} bé thôi.`);
    const sp = SPECIES_BY_ID[egg.species];
    const { petId, traitText, heirloom } = createPet(userId, name, egg.species, now, rand);
    if (q.hatch.run(now, petId, egg.id).changes === 0) throw new GameError('Quả trứng này nở rồi.');
    const r = RARITIES[sp.rarity];
    return {
      petName: name,
      hatched: { species: sp.id, rarity: sp.rarity, element: sp.element },
      message: `🐣 Trứng ${ELEMENTS[sp.element].name} nở ra ${sp.name} ${'★'.repeat(r.stars)} ${r.name}! Chào ${name}. Tính cách: ${traitText}.${heirloomText(heirloom)}`,
    };
  });
}
