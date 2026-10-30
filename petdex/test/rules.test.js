import assert from 'node:assert/strict';
import test from 'node:test';
import { fishSequence, judge, memoryDeck, pearlSchedule } from '../../public/ta-tua/game/js/shared/minigames.js';
import { DAY, GameError } from '../server/game.js';
import { BANK, accrue, depositPayout, policy } from '../server/rules/bank.js';
import { canPromote, checkShift, gainSkill, shiftPay } from '../server/rules/careers.js';
import {
  COMMODITIES, MARKET, REGIMES, amountFor, blendPrice, decayPressure, fillPrice, impact, inBand, meanPrice, profitOf, pushPressure, quote,
  FRESHNESS, freshnessOf, rollJump, stepDrift, stepPrice, stepRegime, tradeFee,
} from '../server/rules/market.js';

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
  // Đi làm từ cấp 1: bé sơ sinh nhận ca nhẹ được, nhưng không quá 2 giờ/ngày.
  assert.doesNotThrow(() => checkShift({ ...ok, stage: 'baby', maxHours: 2 }));
  assert.throws(() => checkShift({ ...ok, stage: 'baby', maxHours: 2, hoursToday: 1 }), GameError);
  assert.throws(() => checkShift({ ...ok, hours: 3 }), GameError);
  assert.throws(() => checkShift({ ...ok, hoursToday: 7 }), GameError);
  assert.throws(() => checkShift({ ...ok, busy: true }), GameError);
  assert.throws(() => checkShift({ ...ok, pet: { ...pet, energy: 15 } }), GameError);
});

test('Sàn: báo giá, phí, thành tiền, biên giá', () => {
  const { bid, ask } = quote(100);
  assert.equal(bid, 99);
  assert.equal(ask, 101);
  assert.equal(tradeFee(250), 4); // 1,5%
  assert.equal(tradeFee(10), 1);
  assert.equal(amountFor(25, 40), 100);
  assert.ok(inBand(114, 100));
  assert.ok(!inBand(116, 100));
});

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('Sàn: mua đẩy giá lên, bán kéo xuống, chỉ 45% tác động; giá khớp bình quân bằng nửa tác động', () => {
  assert.equal(MARKET.playerWeight, 0.45);
  near(impact(100, MARKET.liquidity / 10, 'buy'), 104.5);
  near(impact(100, MARKET.liquidity / 10, 'sell'), 95.5);
  near(fillPrice(100, MARKET.liquidity / 10, 'buy'), 102.25);
});

test('Sàn: giá = luật game × (1 + 45% áp lực người chơi); áp lực phai dần, có giới hạn', () => {
  const p = pushPressure(0, MARKET.liquidity / 10, 'buy');
  near(p, 0.1);
  near(blendPrice('milk', 30, p), 30 * 1.045);
  near(blendPrice('milk', 30, pushPressure(0, MARKET.liquidity / 10, 'sell')), 30 * 0.955);
  near(decayPressure(1, MARKET.pressureHalfLifeMs), 0.5);
  assert.equal(pushPressure(1.95, MARKET.liquidity, 'buy'), MARKET.maxPressure);
  // sàn (sữa tươi là hàng tươi: 0,4 lần) và trần 5 lần giá gốc
  assert.equal(blendPrice('milk', 1, 0), 30 * MARKET.freshFloor);
  assert.equal(blendPrice('milk', 1000, 0), 30 * MARKET.ceiling);
});

test('Sàn: pha thị trường đổi bất chợt, sốt/sập giá đột ngột, độ trôi rộng hơn', () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Mỗi nhịp 10 phút hiếm khi đổi pha; một ngày có vài lần.
  let regime = 'calm';
  let switches = 0;
  const seen = new Set();
  for (let i = 0; i < 144 * 30; i++) {
    const next = stepRegime(regime, MARKET.tickMs, rand);
    if (next !== regime) switches++;
    regime = next;
    seen.add(regime);
  }
  assert.deepEqual([...seen].sort(), Object.keys(REGIMES).sort());
  assert.ok(switches > 30 && switches < 120, `đổi pha ${switches} lần / 30 ngày`);
  // Sốt/sập giá: khoảng 0,4 lần mỗi ngày, cỡ 12–30%.
  let jumps = 0;
  for (let i = 0; i < 144 * 100; i++) {
    const j = rollJump(MARKET.tickMs, rand);
    if (!j) continue;
    jumps++;
    assert.ok(Math.abs(j.size) >= MARKET.jumpMin && Math.abs(j.size) <= MARKET.jumpMax);
    assert.equal(j.up, j.size > 0);
  }
  assert.ok(jumps > 25 && jumps < 60, `${jumps} cú nhảy / 100 ngày`);
  // Pha Tăng nóng kéo độ trôi lên, Lao dốc kéo xuống; luôn trong biên.
  let up = 1;
  let down = 1;
  for (let i = 0; i < 144 * 3; i++) {
    up = stepDrift(up, MARKET.tickMs, 0, REGIMES.boom.trend);
    down = stepDrift(down, MARKET.tickMs, 0, REGIMES.slump.trend);
  }
  assert.ok(up > 1.4 && up <= MARKET.driftMax, `tăng nóng ${up}`);
  assert.ok(down < 0.75 && down >= MARKET.driftMin, `lao dốc ${down}`);
});

test('Sàn: hàng tươi giảm chất lượng theo hạn dùng; hàng khô luôn tươi', () => {
  const t = 1_000_000_000_000;
  const life = COMMODITIES.fish.shelfDays * DAY; // cá: 2 ngày
  const at = (used) => freshnessOf('fish', t + life, t + used * life);
  assert.equal(at(0.1).key, 'fresh');
  assert.equal(at(0.6).key, 'stale');
  assert.equal(at(0.9).key, 'old');
  assert.deepEqual(FRESHNESS.map((f) => f.factor), [1, 0.8, 0.55]);
  assert.equal(freshnessOf('sugar', null, t).key, 'fresh');
  for (const id of ['strawberry', 'fish', 'pork', 'mango', 'milk']) assert.ok(COMMODITIES[id].shelfDays, id);
});

test('Sàn: lãi/lỗ so với giá vốn', () => {
  assert.deepEqual(profitOf(120, 100), { pnl: 20, pct: 0.2 });
  assert.deepEqual(profitOf(80, 100), { pnl: -20, pct: -0.2 });
  assert.deepEqual(profitOf(50, 0), { pnl: 50, pct: null });
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
  near(hot.priceIndex, 1.15); // tối đa +15%/tuần
  near(hot.baseRate, 0.0005);
  const cold = policy({ growth: -0.2, priceIndex: 1 });
  near(cold.priceIndex, 0.97);
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

test('giá sàn: hàng tươi không xuống dưới 0,4 lần giá gốc, hàng để lâu được 0,25 lần', async () => {
  const { blendPrice, stepPrice, floorOf } = await import('../server/rules/market.js');
  assert.equal(floorOf('fish'), MARKET.freshFloor);
  assert.equal(floorOf('sugar'), MARKET.floor);
  assert.equal(blendPrice('fish', 1, -2), COMMODITIES.fish.base * MARKET.freshFloor);
  assert.equal(blendPrice('sugar', 1, -2), COMMODITIES.sugar.base * MARKET.floor);
  assert.equal(stepPrice('strawberry', COMMODITIES.strawberry.base * 0.41, 0, DAY, -5), COMMODITIES.strawberry.base * MARKET.freshFloor);
});
