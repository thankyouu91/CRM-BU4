// Mặt hàng thêm vào sau khi Sàn đã mở: DB cũ chưa có dòng giá, nhịp giá phải tự tạo thay vì làm hỏng cả bộ lập lịch.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR } = await import('../server/game.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const { COMMODITIES } = await import('../server/rules/market.js');

const T0 = Date.parse('2026-11-02T03:00:00Z');
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('Sàn: thiếu dòng giá của mặt hàng mới thì nhịp giá tự tạo, quyết toán ngày vẫn chạy', () => {
  migrate(T0);
  runDue(T0, rand);
  store.db.prepare("DELETE FROM commodity_state WHERE commodity IN ('pork', 'mango')").run();
  const before = store.getMeta('settled_day');
  const later = T0 + DAY + HOUR;
  assert.doesNotThrow(() => runDue(later, rand));
  const rows = store.db.prepare('SELECT commodity, price FROM commodity_state').all();
  assert.deepEqual(rows.map((r) => r.commodity).sort(), Object.keys(COMMODITIES).sort());
  for (const r of rows) assert.ok(r.price > 0, r.commodity);
  assert.notEqual(store.getMeta('settled_day'), before, 'quyết toán ngày phải chạy tiếp');
  assert.equal(Number(store.getMeta('market_tick')) > T0, true);
});
