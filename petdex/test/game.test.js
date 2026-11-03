import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY, GameError, HOUR, ITEMS, PET_DAY_MS, STAGES, ageInfo, levelReward, play, settle, tick, useItem, xpToNext } from '../server/game.js';
import { LIFE_STAGES } from '../../public/ta-tua/game/js/shared/pets.js';

const makePet = (over = {}) => ({
  id: 1, name: 'Boba', species: 'test_pet', level: 1, xp: 0,
  fullness: 80, happiness: 80, energy: 50, accessory: null, born_at: -45 * 86_400_000, updated_at: 0, // Trưởng thành: mốc trung tính
  ...over,
});

test('tick: chỉ số thay đổi theo giờ', () => {
  const pet = tick(makePet(), 2 * HOUR);
  assert.equal(pet.fullness, 64);
  assert.equal(pet.happiness, 72);
  assert.equal(pet.energy, 74);
  assert.equal(pet.updated_at, 2 * HOUR);
});

test('tick: đang đói thì độ vui giảm gấp đôi', () => {
  assert.equal(tick(makePet({ fullness: 20 }), 2 * HOUR).happiness, 64);
});

test('tick: lúc đi làm năng lượng tụt và no bụng giảm nhanh hơn', () => {
  const pet = tick(makePet({ busy_from: HOUR, busy_until: 3 * HOUR }), 4 * HOUR);
  // 2 giờ rảnh (+24 năng lượng, −16 no) và 2 giờ làm (−20 năng lượng, −24 no)
  assert.equal(pet.energy, 54);
  assert.equal(pet.fullness, 40);
});

test('tick: chỉ số luôn nằm trong 0–100', () => {
  const pet = tick(makePet(), 100 * HOUR);
  assert.equal(pet.fullness, 0);
  assert.equal(pet.happiness, 0);
  assert.equal(pet.energy, 100);
});

test('settle: lên nhiều cấp một lúc và cộng xu thưởng', () => {
  const out = settle({ pet: makePet(), xp: xpToNext(1) + xpToNext(2) + 5, coins: 4 });
  assert.equal(out.pet.level, 3);
  assert.equal(out.pet.xp, 5);
  assert.deepEqual(out.levelsGained, [2, 3]);
  assert.equal(out.coins, 4 + levelReward(2) + levelReward(3));
});

test('ageInfo: 1 ngày thật = 1 tuần tuổi, 6 giai đoạn đời', () => {
  assert.equal(Math.round(PET_DAY_MS * 7), DAY);
  assert.equal(ageInfo(0, 0).stage, 'baby');
  assert.equal(ageInfo(0, 2 * DAY).stage, 'kid');
  assert.equal(ageInfo(0, 8 * DAY).stage, 'teen');
  assert.equal(ageInfo(0, 20 * DAY).stage, 'teen');
  assert.equal(ageInfo(0, 21 * DAY).stage, 'young');
  assert.equal(ageInfo(0, 40 * DAY).stage, 'adult');
  assert.equal(ageInfo(0, 70 * DAY).stage, 'elder');
  // Mốc tuổi phía server khớp với dáng vẽ ở shared/pets.js.
  assert.deepEqual(STAGES.map((s) => [s.key, s.minDays / 7]), LIFE_STAGES.map((s) => [s.key, s.fromWeek]));
  assert.equal(ageInfo(0, 3 * DAY).weeks, 3);
});

test('play và useItem', () => {
  assert.throws(() => play(makePet({ energy: 5 })), GameError);
  assert.throws(() => play(makePet({ busy_from: 0, busy_until: HOUR })), GameError);
  assert.equal(play(makePet(), ITEMS.ball).xp, 14);
  assert.throws(() => useItem(makePet({ fullness: 99 }), ITEMS.fish), GameError);
  assert.equal(useItem(makePet(), ITEMS.fish).pet.fullness, 100);
  assert.throws(() => useItem(makePet(), ITEMS.bow), GameError);
});
