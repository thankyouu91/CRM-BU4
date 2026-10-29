// Trung tâm việc làm: nhận ca theo giờ thật, nhận lương, lên kỹ năng và thăng bậc.
import { db, listPets, savePet, skillsOf, transaction } from './db.js';
import { dayKey } from './clock.js';
import { GameError, HOUR, ageInfo, busyKind, isBusy, stageRules, tick } from './game.js';
import { seniorityBonus } from '../../public/ta-tua/game/js/shared/pets.js';
import { post } from './ledger.js';
import {
  CAREERS, RANK_TITLES, SKILL_PER_HOUR, XP_PER_HOUR, canPromote, checkShift, shiftPay, tipsFor,
} from './rules/careers.js';
import { businessOf, openJobs, recordWages, shiftTerms } from './business.js';
import { factoryShiftTerms, openFactoryJobs, recordFactoryWages } from './factory.js';
import { FACTORIES } from './rules/production.js';
import { track } from './quests.js';
import { payFactor } from './rules/production.js';
import { GUILD_UPGRADES } from './rules/town.js';
import { mutatePet, ownedPet } from './service.js';
import { elementPay, growSkill } from './elements.js';

const q = {
  careers: db.prepare('SELECT career, rank, hours FROM careers WHERE pet_id = ?'),
  career: db.prepare('SELECT rank, hours FROM careers WHERE pet_id = ? AND career = ?'),
  saveCareer: db.prepare(`
    INSERT INTO careers (pet_id, career, rank, hours) VALUES (?, ?, ?, ?)
    ON CONFLICT (pet_id, career) DO UPDATE SET rank = excluded.rank, hours = excluded.hours`),
  hoursToday: db.prepare('SELECT COALESCE(SUM(hours), 0) AS h FROM shifts WHERE pet_id = ? AND day = ?'),
  insertShift: db.prepare(`
    INSERT INTO shifts (user_id, pet_id, career, rank, hours, pay, day, starts_at, ends_at, business_id, wage, factory_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  businessName: db.prepare('SELECT name FROM businesses WHERE id = ?'),
  factoryKind: db.prepare('SELECT kind FROM factories WHERE id = ?'),
  myFactories: db.prepare('SELECT id, kind FROM factories WHERE owner_id = ? AND closed_at IS NULL ORDER BY id'),
  guildUpgrades: db.prepare('SELECT g.upgrades FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.user_id = ?'),
  openShifts: db.prepare('SELECT * FROM shifts WHERE user_id = ? AND claimed_at IS NULL ORDER BY ends_at'),
  shift: db.prepare('SELECT * FROM shifts WHERE id = ?'),
  claim: db.prepare('UPDATE shifts SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL'),
};

export function jobsView(userId, now = Date.now()) {
  const day = dayKey(now);
  const pets = listPets(userId).map((row) => {
    const pet = tick(row, now);
    const sr = stageRules(pet.born_at, now);
    const careers = Object.fromEntries(q.careers.all(pet.id).map((c) => [c.career, { rank: c.rank, hours: c.hours }]));
    return {
      id: pet.id,
      name: pet.name,
      energy: Math.round(pet.energy),
      fullness: Math.round(pet.fullness),
      sick: Boolean(pet.sick),
      stage: ageInfo(pet.born_at, now).stage,
      busyUntil: isBusy(pet, now) ? pet.busy_until : null,
      busyKind: busyKind(pet, now),
      hoursToday: q.hoursToday.get(pet.id, day).h,
      maxHours: sr.maxHours ?? 8, // theo tuổi
      workFactor: sr.work ?? 1,
      seniority: Boolean(sr.seniority),
      skills: skillsOf(pet.id),
      careers,
    };
  });
  const shifts = q.openShifts.all(userId).map((s) => ({
    id: s.id,
    petId: s.pet_id,
    career: s.career,
    businessName: s.business_id ? q.businessName.get(s.business_id)?.name : s.factory_id ? factoryName(s.factory_id) : null,
    rank: s.rank,
    hours: s.hours,
    pay: s.pay,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    ready: s.ends_at <= now,
  }));
  const own = businessOf(userId);
  return {
    pets,
    shifts,
    jobs: openJobs(userId, now),
    factoryJobs: openFactoryJobs(userId, now),
    myBusiness: own ? { id: own.id, name: own.name } : null,
    myFactories: q.myFactories.all(userId).map((f) => ({ id: f.id, kind: f.kind, name: FACTORIES[f.kind].name })),
    officeBonus: officeBonus(userId),
  };
}

const factoryName = (id) => FACTORIES[q.factoryKind.get(id)?.kind]?.name ?? 'xưởng';

/** Thưởng lương từ "Văn phòng Hội" của Hội mình đang ở. */
function officeBonus(userId) {
  const row = q.guildUpgrades.get(userId);
  return row ? (JSON.parse(row.upgrades).office ?? 0) * GUILD_UPGRADES.office.per : 0;
}

/**
 * Nhận ca: theo nghề (`career`), trực quầy (`businessId`) hoặc đứng máy ở xưởng (`factoryId`).
 * Làm cho mình thì không lương; làm thuê thì lương được giữ trước từ ví chủ quầy/chủ xưởng.
 */
export function startShift(userId, { petId, career, hours, businessId = null, factoryId = null }, now = Date.now()) {
  return transaction(() => {
    const pet = tick(ownedPet(userId, petId), now);
    const day = dayKey(now);
    const terms = businessId ? shiftTerms(userId, businessId, now) : null;
    const plant = !terms && factoryId ? factoryShiftTerms(userId, factoryId, now) : null;
    // Theo tuổi: nhí nhố làm nhẹ 2 giờ, thiếu niên bán thời gian 4 giờ, lão làng 4 giờ.
    const sr = stageRules(pet.born_at, now);
    checkShift({
      pet,
      stage: ageInfo(pet.born_at, now).stage,
      careerId: terms ? 'shop' : plant ? 'factory' : career,
      hours,
      hoursToday: q.hoursToday.get(pet.id, day).h,
      busy: busyKind(pet, now),
      maxHours: sr.maxHours ?? 8,
    });
    const endsAt = now + hours * HOUR;
    let message;
    if (plant) {
      const pay = plant.wage * hours;
      if (pay > 0) {
        try {
          post({ userId: plant.factory.owner_id, delta: -pay, kind: 'wage', memo: `${pet.name} đứng máy ${hours} giờ`, now });
        } catch (err) {
          if (err instanceof GameError) throw new GameError('Chủ xưởng không đủ tiền trả lương lúc này.');
          throw err;
        }
        recordFactoryWages(plant.factory.id, pay, now);
      }
      q.insertShift.run(userId, pet.id, 'factory', 1, hours, pay, day, now, endsAt, null, plant.wage, plant.factory.id);
      message = plant.ownShift
        ? `${pet.name} vào ${plant.name} đứng máy ${hours} giờ.`
        : `${pet.name} làm công nhân ở ${plant.name} ${hours} giờ, xong ca nhận ${pay} 🪙.`;
    } else if (terms) {
      const pay = terms.wage * hours;
      if (pay > 0) {
        try {
          post({ userId: terms.business.owner_id, delta: -pay, kind: 'wage', memo: `${pet.name} trực ${hours} giờ`, now });
        } catch (err) {
          if (err instanceof GameError) throw new GameError('Chủ quầy không đủ tiền trả lương lúc này.');
          throw err;
        }
        recordWages(terms.business.id, pay, now);
      }
      q.insertShift.run(userId, pet.id, 'shop', 1, hours, pay, day, now, endsAt, terms.business.id, terms.wage, null);
      message = terms.ownShift
        ? `${pet.name} ra trực quầy "${terms.business.name}" ${hours} giờ.`
        : `${pet.name} làm thuê ở "${terms.business.name}" ${hours} giờ, xong ca nhận ${pay} 🪙.`;
    } else {
      const { rank, hours: done } = q.career.get(pet.id, career) ?? { rank: 1, hours: 0 };
      const base = shiftPay(career, rank, skillsOf(pet.id)[CAREERS[career].skill] ?? 0, hours);
      const age = (sr.work ?? 1) * (1 + (sr.seniority ? seniorityBonus(done) : 0));
      const pay = Math.round(base * (1 + officeBonus(userId)) * payFactor(pet) * elementPay(pet, now, CAREERS[career].skill) * age);
      q.insertShift.run(userId, pet.id, career, rank, hours, pay, day, now, endsAt, null, 0, null);
      message = `${pet.name} bắt đầu ca ${CAREERS[career].name} ${hours} giờ, xong ca nhận ${pay} 🪙.`;
    }
    savePet({ ...pet, busy_from: now, busy_until: endsAt, busy_kind: 'work' });
    return { message, endsAt };
  });
}

export function claimShift(userId, shiftId, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    const s = q.shift.get(shiftId);
    if (!s || s.user_id !== userId) throw new GameError('Không tìm thấy ca làm này.');
    if (s.claimed_at) throw new GameError('Ca này đã nhận lương rồi.');
    if (s.ends_at > now) throw new GameError('Ca làm chưa xong.');
    q.claim.run(now, s.id);
    track(userId, 'shift', 1, now);

    if (s.business_id) return claimBusinessShift(userId, s, now);
    if (s.factory_id) return claimFactoryShift(userId, s, now);
    const career = CAREERS[s.career];
    const tips = tipsFor(s.career, s.pay, rand);
    post({ userId, delta: s.pay + tips, kind: 'salary', memo: `${career.name} ${s.hours} giờ${tips ? `, boa ${tips}` : ''}`, now });

    const { before, after } = growSkill(s.pet_id, career.skill, SKILL_PER_HOUR * s.hours);
    const state = q.career.get(s.pet_id, s.career) ?? { rank: 1, hours: 0 };
    const hoursDone = state.hours + s.hours;
    const promoted = canPromote(state.rank, hoursDone, after);
    const rank = promoted ? state.rank + 1 : state.rank;
    q.saveCareer.run(s.pet_id, s.career, rank, hoursDone);

    const outcome = mutatePet(userId, s.pet_id, (pet) => ({ pet, xp: XP_PER_HOUR * s.hours }), { now, kind: 'salary' });
    const name = outcome.pet.name;
    return {
      petName: name,
      levelsGained: outcome.levelsGained,
      gain: { coins: s.pay + tips, xp: XP_PER_HOUR * s.hours },
      skill: { id: career.skill, gain: Math.round((after - before) * 10) / 10 },
      promoted: promoted ? { rank, title: RANK_TITLES[rank - 1], career: career.name } : null,
      message: `${name} nhận ${s.pay} 🪙${tips ? ` + ${tips} tiền boa` : ''} từ ca ${career.name}.`,
    };
  });
}

/** Xong ca trực quầy: nhận lương (nếu làm thuê), lên Khéo tay và kinh nghiệm. */
function claimBusinessShift(userId, s, now) {
  const where = q.businessName.get(s.business_id)?.name ?? 'quầy';
  if (s.pay > 0) post({ userId, delta: s.pay, kind: 'salary', memo: `Làm thuê ở ${where} ${s.hours} giờ`, now });
  const { before, after } = growSkill(s.pet_id, 'craft', SKILL_PER_HOUR * s.hours);
  const outcome = mutatePet(userId, s.pet_id, (pet) => ({ pet, xp: XP_PER_HOUR * s.hours }), { now, kind: 'salary' });
  return {
    petName: outcome.pet.name,
    levelsGained: outcome.levelsGained,
    gain: { coins: s.pay, xp: XP_PER_HOUR * s.hours },
    skill: { id: 'craft', gain: Math.round((after - before) * 10) / 10 },
    promoted: null,
    message: s.pay ? `${outcome.pet.name} nhận ${s.pay} 🪙 lương trực ở ${where}.` : `${outcome.pet.name} trực xong ở ${where}.`,
  };
}

/** Xong ca đứng máy: nhận lương (nếu làm thuê), lên Sức mạnh và kinh nghiệm. */
function claimFactoryShift(userId, s, now) {
  const where = factoryName(s.factory_id);
  if (s.pay > 0) post({ userId, delta: s.pay, kind: 'salary', memo: `Công nhân ${where} ${s.hours} giờ`, now });
  const { before, after } = growSkill(s.pet_id, 'strength', SKILL_PER_HOUR * s.hours);
  const outcome = mutatePet(userId, s.pet_id, (pet) => ({ pet, xp: XP_PER_HOUR * s.hours }), { now, kind: 'salary' });
  return {
    petName: outcome.pet.name,
    levelsGained: outcome.levelsGained,
    gain: { coins: s.pay, xp: XP_PER_HOUR * s.hours },
    skill: { id: 'strength', gain: Math.round((after - before) * 10) / 10 },
    promoted: null,
    message: s.pay ? `${outcome.pet.name} nhận ${s.pay} 🪙 lương đứng máy ở ${where}.` : `${outcome.pet.name} xong ca đứng máy ở ${where}.`,
  };
}
