// Kiểm thử luật giai đoạn 2 (hàm thuần): tính cách, sức khỏe, vườn, bếp, xưởng, hợp đồng, tín dụng.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREDIT, FACTORIES, GARDEN, LOANS, TIERS, TRAITS, batchesPerHour, clampCredit, contractEscrows, dishValue, harvestYield,
  healthDelta, installment, loanLimit, loanRate, payFactor, rollQuality, rollTraits, shortfallPenalty, sickChance, tierOf,
} from '../server/rules/production.js';

test('tính cách: 1–2 nét không trùng, ảnh hưởng lương', () => {
  for (let s = 0; s < 50; s++) {
    let x = s + 1;
    const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    const traits = rollTraits(rand);
    assert.ok(traits.length >= 1 && traits.length <= 2);
    assert.equal(new Set(traits).size, traits.length);
    for (const t of traits) assert.ok(TRAITS[t]);
  }
  assert.equal(payFactor({ traits: ['diligent'] }), 1.1);
  assert.equal(payFactor({ traits: ['sleepy'] }), 0.95);
  assert.equal(payFactor({ traits: [] }), 1);
});

test('sức khỏe: no và sạch thì lên, bỏ đói hay bẩn lâu thì xuống; ốm dần theo giờ', () => {
  assert.equal(healthDelta(4, { hungryAfter: 10, dirtyAfter: 10, goodFor: 10 }), 4);
  assert.equal(healthDelta(4, { hungryAfter: 1, dirtyAfter: 10, goodFor: 1 }), 1 - 3);
  assert.equal(healthDelta(4, { hungryAfter: 10, dirtyAfter: 10, goodFor: 0 }), 0, 'bé ốm không tự hồi');
  assert.ok(healthDelta(10, { hungryAfter: 0, dirtyAfter: 0, goodFor: 0 }) < 0);
  assert.equal(sickChance(0), 0);
  assert.ok(sickChance(10) > sickChance(1));
  assert.ok(sickChance(1000) <= 1);
});

test('vườn: tưới thêm 20%, sâu mất 30%, ít nhất 1 phần', () => {
  const base = harvestYield('tea', { watered: false, pests: false, rand: () => 0 });
  assert.equal(base, 10);
  assert.equal(harvestYield('tea', { watered: true, pests: false, rand: () => 0 }), Math.round(10 * (1 + GARDEN.waterBonus)));
  assert.equal(harvestYield('tea', { watered: false, pests: true, rand: () => 0 }), Math.round(10 * (1 - GARDEN.pestLoss)));
  assert.equal(harvestYield('tea', { watered: false, pests: false, rand: () => 0.999 }), 20);
});

test('bếp: tay nghề cao ra món ngon hơn, món ngon đắt hơn', () => {
  const tally = (craft) => {
    let x = 7;
    const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += rollQuality(craft, rand);
    return sum;
  };
  assert.ok(tally(80) > tally(0));
  assert.ok(dishValue('home_milk_tea', 2) > dishValue('home_milk_tea', 1));
  assert.ok(dishValue('home_milk_tea', 1) > dishValue('home_milk_tea', 0));
  assert.ok(dishValue('home_milk_tea', 0, 1.5) > dishValue('home_milk_tea', 0, 1));
});

test('xưởng: mỗi cấp thêm mẻ, kỹ năng cộng tối đa 30%', () => {
  const base = FACTORIES.dryer.perHour;
  assert.equal(batchesPerHour('dryer', 0, 0, 0), base);
  assert.equal(batchesPerHour('dryer', 1, 0, 0), base + 3);
  assert.ok(Math.abs(batchesPerHour('dryer', 0, 100, 100) - base * 1.3) < 1e-9);
  assert.ok(Math.abs(batchesPerHour('dryer', 0, 500, 500) - base * 1.3) < 1e-9, 'kỹ năng không vượt trần');
});

test('hợp đồng: ký quỹ hai bên và bồi thường khi giao thiếu', () => {
  assert.deepEqual(contractEscrows(2, 40, 5), { buyer: 80, seller: 80 });
  // Giá thị trường không đổi: chỉ phạt 10% giá trị phần thiếu.
  assert.equal(shortfallPenalty(2, 40, 40), 8);
  // Giá đã lên 60: bù thêm chênh lệch 20 mỗi lô.
  assert.equal(shortfallPenalty(2, 40, 60), 48);
  assert.equal(shortfallPenalty(2, 40, 20), 8, 'giá xuống thì không bù chênh lệch');
});

test('tín dụng: hạng theo điểm, lãi theo hạng và lạm phát, hạn mức theo thu nhập', () => {
  assert.equal(tierOf(CREDIT.start).key, 'bronze');
  assert.equal(tierOf(560).key, 'silver');
  assert.equal(tierOf(CREDIT.max).key, TIERS.at(-1).key);
  assert.equal(clampCredit(10), CREDIT.min);
  assert.equal(clampCredit(9999), CREDIT.max);
  assert.ok(loanRate(0.003, 500) > loanRate(0.003, 700), 'điểm cao vay rẻ hơn');
  assert.ok(loanRate(0.003, 500, 0.3) > loanRate(0.003, 500, 0.1), 'lạm phát cao thì lãi cao');
  assert.equal(loanLimit({ score: 500, avgIncome: 100, savings: 0, outstanding: 0 }), 300);
  assert.equal(loanLimit({ score: 500, avgIncome: 1000, savings: 0, outstanding: 0 }), TIERS[0].limit);
  assert.equal(loanLimit({ score: 500, avgIncome: 100, savings: 0, outstanding: 400 }), 0);
  assert.ok(LOANS.terms.includes(7));
});

test('trả góp: lãi trên dư nợ + gốc chia đều; quá hạn phải trả hết gốc', () => {
  const loan = { principal: 700, remaining: 700, rate: 0.01, term_days: 7, fees: 0 };
  assert.deepEqual(installment(loan), { arrears: 0, interest: 7, principal: 100, total: 107 });
  const tail = { ...loan, remaining: 50, fees: 12 };
  assert.deepEqual(installment(tail), { arrears: 12, interest: 1, principal: 50, total: 63 });
  assert.equal(installment({ ...loan, remaining: 300 }, true).principal, 300);
});
