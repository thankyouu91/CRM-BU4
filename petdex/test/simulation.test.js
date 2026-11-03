// Bản rút gọn của mô phỏng kinh tế: chặn các thay đổi số liệu vô tình phá nền kinh tế.
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulate } from '../scripts/simulate-economy.js';

test('mô phỏng 16 bot × 15 ngày: sổ cái khớp, kinh tế không vỡ', () => {
  const r = simulate({ bots: 16, days: 15, seed: 7 });
  assert.equal(r.auditMismatches, 0);
  assert.equal(r.negativeBalances, 0);
  assert.ok(r.weeks.length >= 2, 'Ngân hàng Trung ương họp mỗi tuần');

  const last = r.daily.at(-1);
  assert.ok(last.diligent > last.casual, 'chăm chỉ thì giàu hơn chơi thỉnh thoảng');
  assert.ok(last.speculator < last.diligent * 1.15, 'đầu cơ ngẫu nhiên không được lời hơn hẳn làm ăn chăm chỉ');
  assert.ok(r.perBotDay.salary < 260, `lương trung bình ${r.perBotDay.salary}/ngày quá cao`);
  assert.ok(r.perBotDay.minigame <= 100, 'mini-game không vượt giới hạn ngày');
  for (const [id, ratio] of Object.entries(r.priceDrift)) assert.ok(ratio > 0.4 && ratio < 2.5, `giá ${id} trôi quá xa: ${ratio}`);
  assert.ok(r.clinicVisits / (16 * 15) < 0.2, `bé ốm quá nhiều: ${r.clinicVisits} lượt khám`);
  if (r.factories) assert.ok(r.factories.batchesPerDay > 0, 'xưởng có chạy');
  if (r.shops) {
    assert.ok(r.shops.closed < r.shops.count, 'không phải quầy nào cũng phá sản');
    assert.ok(r.shops.profitPerDay > 0, `quầy phải có lãi: ${r.shops.profitPerDay}/ngày`);
  }
});
