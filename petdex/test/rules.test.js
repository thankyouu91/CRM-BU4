import assert from 'node:assert/strict';
import test from 'node:test';
import { fishSequence, judge, memoryDeck, pearlSchedule } from '../../public/ta-tua/game/js/shared/minigames.js';
import { DAY, GameError } from '../server/game.js';
import { BANK, accrue, depositPayout, policy } from '../server/rules/bank.js';
import { canPromote, checkShift, gainSkill, shiftPay } from '../server/rules/careers.js';
import { COMMODITIES, MARKET, amountFor, fillPrice, impact, inBand, meanPrice, quote, stepPrice, tradeFee } from '../server/rules/market.js';

test('nghề: lương theo bậc, kỹ năng và số giờ', () => {
  assert.equal(shiftPay('porter', 1, 0, 1), Math.round(16 * 0.8));
  assert.equal(shiftPay('porter', 3, 40, 4), Math.round(30 * 1.0 * 4));
  assert.ok(shiftPay('tutor', 5, 100, 1) > shiftPay('tutor', 1, 100, 1));
});

test('nghề: điều kiện thăng bậc', () => {
  assert.equal(canPromote(1, 15, 50), false);
  assert.equal(canPromote(1, 16, 19), false);
  assert.equal(canPromote(1, 16, 20), true);
  assert.equal(canPromote(5, 999, 100), false);
});

test('nghề: kỹ năng càng cao càng khó lên', () => {
  assert.ok(gainSkill(10, 3) - 10 > gainSkill(90, 3) - 90);
  assert.equal(gainSkill(100, 50), 100);
});

test('nghề: kiểm tra trước khi nhận ca', () => {
  const pet = { name: 'Boba', energy: 100, fullness: 80 };
  const ok = { pet, stage: 'kid', careerId: 'porter', hours: 2, hoursToday: 0, busy: false };
  assert.doesNotThrow(() => checkShift(ok));
  assert.throws(() => checkShift({ ...ok, stage: 'baby' }), GameError);
  assert.throws(() => checkShift({ ...ok, hours: 3 }), GameError);
  assert.throws(() => checkShift({ ...ok, hoursToday: 7 }), GameError);
  assert.throws(() => checkShift({ ...ok, busy: true }), GameError);
  assert.throws(() => checkShift({ ...ok, pet: { ...pet, energy: 15 } }), GameError);
});

test('Sàn: báo giá, phí, thành tiền, biên giá', () => {
  const { bid, ask } = quote(100);
  assert.equal(bid, 99);
  assert.equal(ask, 101);
  assert.equal(tradeFee(250), 3);
  assert.equal(tradeFee(10), 1);
  assert.equal(amountFor(25, 40), 100);
  assert.ok(inBand(114, 100));
  assert.ok(!inBand(116, 100));
});

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('Sàn: mua đẩy giá lên, bán kéo xuống; giá khớp bình quân bằng nửa tác động', () => {
  near(impact(100, MARKET.liquidity / 10, 'buy'), 110);
  near(impact(100, MARKET.liquidity / 10, 'sell'), 90);
  near(fillPrice(100, MARKET.liquidity / 10, 'buy'), 105);
});

test('Sàn: giá hàng chế biến đi theo chi phí đầu vào', () => {
  const base = Object.fromEntries(Object.entries(COMMODITIES).map(([id, c]) => [id, c.base]));
  assert.equal(meanPrice('pearl', { prices: base }), COMMODITIES.pearl.base);
  assert.equal(meanPrice('pearl', { prices: { ...base, cassava: 12 } }), COMMODITIES.pearl.base * 1.5);
  assert.equal(meanPrice('milk', { prices: base, index: 1.1, drift: 1, news: 1.2 }), 30 * 1.1 * 1.2);
});

test('Sàn: giá hồi về trung bình khi không có nhiễu', () => {
  let price = 20;
  for (let i = 0; i < 144 * 10; i++) price = stepPrice('cassava', price, 8, MARKET.tickMs, 0);
  assert.ok(Math.abs(price - 8) < 0.5, `giá ${price}`);
});

test('ngân hàng: lãi chỉ tính trên phần dưới hạn mức', () => {
  assert.equal(accrue(1000, 0.003, 0, DAY), 3);
  assert.equal(accrue(BANK.savingsCap * 5, 0.003, 0, DAY), BANK.savingsCap * 0.003);
});

test('ngân hàng: kỳ hạn rút sớm mất lãi', () => {
  const dep = { amount: 1000, rate: 0.005, term_days: 7, matures_at: 100 };
  assert.deepEqual(depositPayout(dep, 99), { principal: 1000, interest: 0 });
  assert.deepEqual(depositPayout(dep, 100), { principal: 1000, interest: 35 });
});

test('Ngân hàng Trung ương: xu tăng nhanh thì nâng giá NPC và hạ lãi tiết kiệm, có giới hạn', () => {
  const hot = policy({ growth: 0.6, priceIndex: 1 });
  near(hot.priceIndex, 1.045);
  near(hot.baseRate, 0.0005);
  const cold = policy({ growth: -0.2, priceIndex: 1 });
  near(cold.priceIndex, 0.985);
  near(cold.baseRate, 0.005);
  const steady = policy({ growth: BANK.targetGrowth, priceIndex: 1.2 });
  near(steady.priceIndex, 1.2);
  near(steady.baseRate, 0.003);
});

test('mini-game: câu cá không cho quăng nhanh hơn sức người', () => {
  assert.equal(judge('fishing', 7, 6, { caught: [true, true, true, true, true] }).ok, true);
  assert.equal(judge('fishing', 7, 3, { caught: [true, true, true, true, true] }).ok, false);
  const r = judge('fishing', 7, 30, { caught: [true, false, true] });
  const seq = fishSequence(7);
  assert.equal(r.portions.fish, seq[0].portions + seq[2].portions);
});

test('mini-game: hứng trân châu chỉ tính vật đã rơi, không trùng', () => {
  const drops = pearlSchedule(42);
  const early = drops.findIndex((d) => d.t < 3);
  const late = drops.findIndex((d) => d.t > 20);
  assert.equal(judge('pearls', 42, 5, { caught: [early] }).ok, true);
  assert.equal(judge('pearls', 42, 5, { caught: [late] }).ok, false);
  assert.equal(judge('pearls', 42, 30, { caught: [early, early] }).ok, false);
});

test('mini-game: ghép hình có đủ 8 cặp và thưởng theo số lượt', () => {
  assert.equal(memoryDeck(1).length, 16);
  assert.deepEqual([...memoryDeck(5)].sort(), [...memoryDeck(9)].sort());
  assert.equal(judge('memory', 1, 30, { moves: 10, pairs: 8 }).coins, 8 * 3 + 12);
  assert.equal(judge('memory', 1, 3, { moves: 8, pairs: 8 }).ok, false);
  assert.equal(judge('memory', 1, 30, { moves: 4, pairs: 6 }).ok, false);
});
