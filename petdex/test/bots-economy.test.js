// Mô phỏng nhỏ cư dân tự động (100 bot, 2 ngày giả lập) qua đúng router của game: bot chơi như người trung bình,
// không "cày" tối ưu (5–10 bot online cùng lúc, cùng tỉ lệ 1000 bot ↔ 50–100). Bản đầy đủ:
// node petdex/scripts/simulate-bots.js --bots 1000 --days 3.
import assert from 'node:assert/strict';
import test from 'node:test';

const { simulateBots } = await import('../scripts/simulate-bots.js');

test('100 bot trong 2 ngày: mỗi bot tạo thêm ít xu như người chơi mới, số online trong khoảng đặt, nhịp trong ngân sách', async () => {
  const out = await simulateBots({ bots: 100, days: 2, step: 5, log: () => {} });
  const late = out.ticks.slice(60);
  assert.ok(late.every((t) => t.online <= 10), 'không quá 10 bot online');
  assert.ok(late.every((t) => t.actions <= 25));
  assert.equal(out.rows.length, 2);
  assert.ok(out.perBotDay > 0, 'bot có chơi và kiếm được xu');
  // Thu nhập từ quà ngày, mini-game (trần 100 xu/ngày) và ca làm của bé cấp thấp: dưới 150 xu mỗi bot mỗi ngày.
  assert.ok(out.perBotDay < 150, `bot kiếm ${out.perBotDay} xu/ngày, quá mức người chơi trung bình`);
  for (const r of out.rows) assert.ok(r.actions <= (24 * 60 / 5) * 25);
});
