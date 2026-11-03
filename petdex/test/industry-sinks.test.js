// Tài nguyên trên đất phải có chỗ dùng: mọi loại mỏ sinh ra trên 200 lô đều là nguyên liệu của ít nhất một ngành,
// và khi công nghiệp nặng tạm đóng thì các loại trước đây "chỉ bán NPC" (gà, ngô, lúa gạo, khoai, muối, cao su, bạc,
// thiếc, vàng, kim cương) có dây chuyền Hàng tiêu dùng nhận. Nhãn công dụng trên lô (depositUse) đúng cho từng trường hợp.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const shared = await import('../../public/ta-tua/game/js/shared/industry.js');
const { PLOTS } = await import('../../public/ta-tua/game/js/shared/clan.js');
const { clanQuality } = await import('../server/industry.js');
const { GOODS, HEAVY_INDUSTRIES, PRODUCTION_INDUSTRIES, RUN_STEPS, depositUse, depositsOf, goodConsumers } = shared;

const depositGoods = [...new Set(PLOTS.flatMap((p) => Object.keys(depositsOf(p))))];

test('mọi tài nguyên trên đất đều là nguyên liệu của ít nhất một ngành', () => {
  const orphans = depositGoods.filter((g) => !goodConsumers(g).open.length);
  assert.deepEqual(orphans, []);
});

test('công nghiệp nặng đóng: tài nguyên trước đây chỉ bán NPC giờ có ngành đang mở dùng', () => {
  for (const g of ['chicken', 'maize', 'rice', 'potatoes', 'salt', 'rubber', 'silver', 'tin', 'gold', 'diamond']) {
    assert.ok(goodConsumers(g, HEAVY_INDUSTRIES).open.includes('consumer_goods'), g);
  }
  // Còn lại chỉ công nghiệp nặng dùng: hiện mờ trên lô, không tính vào chế độ tô màu "Tài nguyên".
  const heavyOnly = depositGoods.filter((g) => depositUse(g, { closed: HEAVY_INDUSTRIES }) === 'heavy').sort();
  assert.deepEqual(heavyOnly, ['bauxite', 'copper', 'crude_oil', 'iron_ore', 'rare_earth', 'silicon', 'titanium'].filter((g) => depositGoods.includes(g)).sort());
  assert.ok(depositGoods.every((g) => depositUse(g, { closed: HEAVY_INDUSTRIES }) !== 'npc'));
});

test('nhãn công dụng: ngành gia tộc khai thác hoặc chế biến được thì là "mine"', () => {
  const closed = HEAVY_INDUSTRIES;
  assert.equal(depositUse('chicken', { closed, held: ['agriculture'] }), 'mine', 'khai thác');
  assert.equal(depositUse('chicken', { closed, held: ['consumer_goods'] }), 'mine', 'chế biến');
  assert.equal(depositUse('chicken', { closed, held: ['tea'] }), 'open');
  assert.equal(depositUse('iron_ore', { closed, held: ['metallurgy'] }), 'heavy', 'ngành đóng không tính');
  assert.equal(depositUse('iron_ore', { closed, held: ['mining'] }), 'mine', 'khai khoáng vẫn khai thác và bán được');
  assert.equal(depositUse('iron_ore', { closed: [], held: [] }), 'open', 'mở lại luyện kim thì có ngành dùng');
});

test('dây chuyền mới: có trong thứ tự chạy, có lãi ở giá gốc, hàng ra có trong GOODS', () => {
  const steps = new Set(RUN_STEPS.map(([i, l]) => `${i}:${l}`));
  for (const [id, ind] of Object.entries(PRODUCTION_INDUSTRIES)) {
    for (const line of Object.keys(ind.lines ?? {})) assert.ok(steps.has(`${id}:${line}`), `${id}:${line} thiếu trong RUN_STEPS`);
  }
  const value = (side) => Object.entries(side).reduce((s, [g, n]) => s + GOODS[g].base * n, 0);
  for (const line of ['poultry_food', 'staple_food', 'footwear', 'jewelry', 'fine_jewelry']) {
    const { recipe } = PRODUCTION_INDUSTRIES.consumer_goods.lines[line];
    for (const g of [...Object.keys(recipe.in), ...Object.keys(recipe.out)]) assert.ok(GOODS[g], `${line}: ${g}`);
    assert.ok(value(recipe.out) > value(recipe.in), `${line} phải có lãi ở giá gốc`);
  }
});

test('chất lượng đồ ăn gia tộc: nhà xưởng mọi dây chuyền ra thực phẩm chế biến đều được tính', () => {
  const design = JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ p: i })));
  const rows = (variant) => [{ industry: 'consumer_goods', variant, design }];
  const base = clanQuality('food', [], 1);
  assert.ok(clanQuality('food', rows('poultry_food'), 1) > base);
  assert.ok(clanQuality('food', rows('staple_food'), 1) > base);
  assert.equal(clanQuality('food', rows('jewelry'), 1), base, 'trang sức không phải xưởng đồ ăn');
});
