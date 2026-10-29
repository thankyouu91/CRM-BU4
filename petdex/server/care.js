// Chăm sóc giai đoạn 2: tắm, phòng khám, bảo hiểm sức khỏe, trường học.
import { allPets, db, getUser, savePet, transaction } from './db.js';
import { indexedPrice } from './bank.js';
import { dayKey } from './clock.js';
import { GameError, ageInfo, applyEffect, bathe, isBusy, requireHealthy, stageRules, tick } from './game.js';
import { post } from './ledger.js';
import { CLASSES, CLINIC, HEALTH, ILLNESSES, INSURANCE, SCHOOL, has } from './rules/production.js';
import { track } from './quests.js';
import { growSkill } from './elements.js';
import { mutatePet, ownedPet } from './service.js';
import { statsOfSpecies } from '../../public/ta-tua/game/js/shared/pets.js';

const q = {
  plan: db.prepare('SELECT * FROM insurance WHERE user_id = ?'),
  setPlan: db.prepare('INSERT OR REPLACE INTO insurance (user_id, plan, since) VALUES (?, ?, ?)'),
  dropPlan: db.prepare('DELETE FROM insurance WHERE user_id = ?'),
  allPlans: db.prepare('SELECT * FROM insurance'),
  classes: db.prepare('SELECT skill, count FROM school_log WHERE pet_id = ? AND day = ?'),
  addClass: db.prepare(`
    INSERT INTO school_log (pet_id, day, skill, count) VALUES (?, ?, ?, 1)
    ON CONFLICT (pet_id, day, skill) DO UPDATE SET count = count + 1`),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

export function bath(userId, petId, now = Date.now()) {
  const outcome = mutatePet(userId, petId, (pet) => bathe(pet, now), { now });
  track(userId, 'bath', 1, now);
  return { ...outcome, petName: outcome.pet.name, message: `🛁 ${outcome.pet.name} tắm xong thơm tho!` };
}

/** Viện phí sau bảo hiểm. */
function billFor(userId, amount) {
  const plan = q.plan.get(userId);
  const cover = plan ? INSURANCE[plan.plan].cover : 0;
  return { total: amount, paid: Math.round(amount * (1 - cover)), cover };
}

export function clinicView(userId, now = Date.now()) {
  const plan = q.plan.get(userId);
  return {
    plan: plan ? { id: plan.plan, since: plan.since, ...INSURANCE[plan.plan], premium: indexedPrice(INSURANCE[plan.plan].premium) } : null,
    plans: Object.fromEntries(Object.entries(INSURANCE).map(([id, p]) => [id, { ...p, premium: indexedPrice(p.premium) }])),
    checkup: billFor(userId, indexedPrice(CLINIC.checkup)),
    treatments: Object.fromEntries(Object.entries(ILLNESSES).map(([id, i]) => [id, { ...i, bill: billFor(userId, indexedPrice(i.treat)) }])),
  };
}

/** Khám: bé ốm thì chữa khỏi (+30 sức khỏe), bé khỏe thì khám tổng quát (+15 sức khỏe). */
export function visitClinic(userId, petId, now = Date.now()) {
  return transaction(() => {
    const pet = tick(ownedPet(userId, petId), now);
    const illness = pet.sick ? ILLNESSES[pet.sick] : null;
    const bill = billFor(userId, indexedPrice(illness ? illness.treat : CLINIC.checkup));
    if (bill.paid > 0) {
      post({ userId, delta: -bill.paid, kind: 'clinic', memo: illness ? `Chữa ${illness.name}` : 'Khám tổng quát', now });
    }
    const outcome = mutatePet(userId, petId, (p) => ({
      pet: { ...applyEffect(p, { health: illness ? CLINIC.treatHealth : CLINIC.checkupHealth }), sick: null },
      xp: 2,
    }), { now });
    const covered = bill.total - bill.paid;
    return {
      ...outcome,
      petName: outcome.pet.name,
      message: illness
        ? `🩺 ${outcome.pet.name} đã khỏi ${illness.name.toLowerCase()}! Viện phí ${bill.paid} 🪙${covered ? ` (bảo hiểm trả ${covered})` : ''}.`
        : `🩺 Khám tổng quát xong, ${outcome.pet.name} khỏe hơn. Phí ${bill.paid} 🪙.`,
    };
  });
}

export function setInsurance(userId, plan, now = Date.now()) {
  if (plan && !INSURANCE[plan]) throw new GameError('Không có gói bảo hiểm này.');
  return transaction(() => {
    if (!plan) {
      q.dropPlan.run(userId);
      return { message: 'Đã hủy bảo hiểm.' };
    }
    q.setPlan.run(userId, plan, now);
    return { message: `Đã mua ${INSURANCE[plan].name}: ${indexedPrice(INSURANCE[plan].premium)} 🪙 mỗi ngày, trừ lúc nửa đêm.` };
  });
}

/** Nửa đêm: thu phí bảo hiểm (thiếu tiền thì gói bị hủy); bé sức khỏe thấp có thể đổ bệnh qua đêm. */
export function settleCareDay(day, end, rand = Math.random) {
  transaction(() => {
    for (const p of q.allPlans.all()) {
      const premium = indexedPrice(INSURANCE[p.plan].premium);
      if (getUser(p.user_id).coins >= premium) {
        post({ userId: p.user_id, delta: -premium, kind: 'insurance', memo: INSURANCE[p.plan].name, now: end - 1 });
      } else {
        q.dropPlan.run(p.user_id);
      }
    }
    for (const row of allPets()) {
      const pet = tick(row, end);
      if (!pet.sick && pet.health < HEALTH.sickBelow && rand() < 0.5 * statsOfSpecies(pet.species).sickness * (stageRules(pet.born_at, end).sickness ?? 1)) {
        savePet({ ...pet, sick: rand() < 0.5 ? 'cold' : 'stomach' });
      }
    }
  });
}

// ---------------------------------------------------------------- trường học

export function schoolView(userId, petId, now = Date.now()) {
  const pet = ownedPet(userId, petId);
  const taken = Object.fromEntries(q.classes.all(pet.id, dayKey(now)).map((r) => [r.skill, r.count]));
  return {
    classes: Object.fromEntries(Object.entries(CLASSES).map(([skill, c]) => [skill, {
      ...c, cost: indexedPrice(c.cost), taken: taken[skill] ?? 0, max: SCHOOL.perSkillPerDay,
    }])),
    rules: SCHOOL,
  };
}

/** Một lớp học 30 phút: tốn xu và năng lượng, bé bận trong lúc học, kỹ năng tăng ngay. */
export function attendClass(userId, petId, skill, now = Date.now(), rand = Math.random) {
  const cls = CLASSES[skill];
  if (!cls) throw new GameError('Không có lớp này.');
  return transaction(() => {
    const pet = tick(ownedPet(userId, petId), now);
    requireHealthy(pet, 'đi học');
    if (ageInfo(pet.born_at, now).stage === 'baby') throw new GameError(`${pet.name} còn bé quá, 2 tuần tuổi mới đi học được.`);
    if (isBusy(pet, now)) throw new GameError(`${pet.name} đang bận.`);
    if (pet.energy < SCHOOL.energy) throw new GameError(`${pet.name} cần ${SCHOOL.energy} năng lượng để học.`);
    const day = dayKey(now);
    const taken = q.classes.all(pet.id, day).find((r) => r.skill === skill)?.count ?? 0;
    if (taken >= SCHOOL.perSkillPerDay) throw new GameError(`Hôm nay ${pet.name} học ${cls.name.toLowerCase()} đủ ${SCHOOL.perSkillPerDay} buổi rồi.`);
    post({ userId, delta: -indexedPrice(cls.cost), kind: 'school', memo: `${pet.name}: ${cls.name}`, now });
    q.addClass.run(pet.id, day, skill);
    track(userId, 'school', 1, now);
    const [lo, hi] = SCHOOL.gain;
    // Nhí nhố học nhanh nhất, lão làng chậm.
    const raw = (lo + rand() * (hi - lo)) * (has(pet, 'bookworm') ? 1.25 : 1) * (stageRules(pet.born_at, now).school ?? 1);
    const { before, after } = growSkill(pet.id, skill, raw);
    const end = now + SCHOOL.minutes * 60_000;
    const outcome = mutatePet(userId, petId, (p) => ({
      pet: { ...applyEffect(p, { energy: -SCHOOL.energy }), busy_from: now, busy_until: end },
      xp: 5,
    }), { now });
    const gain = Math.round((after - before) * 10) / 10;
    return {
      ...outcome,
      petName: outcome.pet.name,
      skill: { id: skill, gain },
      message: `${cls.icon} ${pet.name} học xong ${cls.name.toLowerCase()}: +${gain} điểm.`,
    };
  });
}
