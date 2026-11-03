import assert from 'node:assert/strict';
import test from 'node:test';
import { appeal, customersPerHour, nextReputation, peakFactor, refPrice, unitCost } from '../server/rules/business.js';
import { PROPOSALS, dailyReward, incomeTax, pickQuests, winner } from '../server/rules/town.js';

test('thuế thu nhập lũy tiến theo bậc, có giảm thuế', () => {
  assert.equal(incomeTax(140), 0);
  assert.equal(incomeTax(250), 8);
  assert.equal(incomeTax(670), 41);
  assert.equal(incomeTax(1870), 68 + 104);
  assert.equal(incomeTax(5000), 68 + 240 + 360);
  assert.equal(incomeTax(670, 0.02), Math.floor(520 * 0.06));
});

test('quà ngày tăng theo chuỗi, tối đa ngày thứ 7', () => {
  assert.equal(dailyReward(1), 60);
  assert.equal(dailyReward(3), 80);
  assert.equal(dailyReward(7), 120);
  assert.equal(dailyReward(30), 120);
});

test('bỏ phiếu: nhiều phiếu nhất thắng, hòa lấy đề xuất rẻ hơn, không ai bầu thì thôi', () => {
  assert.equal(winner([{ option: 'bridge', votes: 2 }, { option: 'tax_cut', votes: 5 }]), 'tax_cut');
  assert.equal(winner([{ option: 'bridge', votes: 3 }, { option: 'newbie_fund', votes: 3 }]), 'newbie_fund');
  assert.equal(winner([{ option: 'bridge', votes: 0 }]), null);
  assert.ok(Object.values(PROPOSALS).every((p) => p.cost > 0 && p.effect.days > 0));
});

test('nhiệm vụ chỉ bốc những việc người chơi làm được', () => {
  const r = () => 0.42;
  const fresh = pickQuests({ level: 1, has: {} }, r);
  assert.equal(fresh.length, 3);
  assert.ok(!fresh.some((q) => ['trade', 'save', 'friend', 'donate', 'serve'].includes(q)));
  const all = new Set();
  for (let i = 0; i < 40; i++) {
    let s = i + 1;
    for (const q of pickQuests({ level: 9, has: { friend: true, guild: true, business: true } }, () => ((s = (s * 9301 + 49297) % 233280) / 233280))) all.add(q);
  }
  assert.ok(all.has('serve') && all.has('donate'));
});

test('quầy: giá tham chiếu theo chi phí nguyên liệu, khách nhạy với giá', () => {
  assert.equal(unitCost('boba_milk_tea'), 9.5);
  assert.equal(refPrice('boba_milk_tea'), 22);
  assert.equal(refPrice('boba_milk_tea', 1.2), Math.round(9.5 * 1.2 * 2.3));
  assert.equal(appeal(22, 22), 1);
  assert.ok(appeal(30, 22) < 0.7);
  assert.ok(appeal(15, 22) > 1.5);
  assert.equal(peakFactor(12), 1.5);
  assert.equal(peakFactor(15), 1);
  assert.equal(peakFactor(2), 0.3);
  const base = customersPerHour({ location: 'street', hourVN: 15, reputation: 1 });
  assert.equal(base, 20 * 0.3);
  assert.ok(customersPerHour({ location: 'street', hourVN: 15, reputation: 1, promo: true, bonus: 0.15 }) > base * 1.6);
});

test('quầy: hết hàng hoặc chặt chém thì mất uy tín, bán đều thì lên dần', () => {
  assert.ok(nextReputation(1, { served: 2, wanted: 6, priceRatio: 1 }) < 1);
  assert.ok(nextReputation(1, { served: 5, wanted: 5, priceRatio: 1.6 }) < 1);
  assert.ok(nextReputation(1, { served: 5, wanted: 5, priceRatio: 1 }) > 1);
  assert.equal(nextReputation(1.5, { served: 5, wanted: 5, priceRatio: 1 }), 1.5);
});
