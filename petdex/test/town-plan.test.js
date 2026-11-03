// Phố Trân Châu, lưới khu phố (public/ta-tua/game/js/town-plan.js): ở mọi bố cục, mỗi nơi trên bản đồ
// được đặt đúng một lần, khung toà nhà (cỡ thật lấy từ town.json) không chồng nhau, nằm trọn trong thế giới,
// đủ lớn để bấm, và thế giới vừa khung ở các cỡ màn hình đã duyệt.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const { DISTRICTS, MODES, NARROW_MIN_W, PLANS, WORLD_W, planTown, townMode } = await import('../../public/ta-tua/game/js/town-plan.js');

const GAME = fileURLToPath(new URL('../../public/ta-tua/game/', import.meta.url));
const town = JSON.parse(readFileSync(`${GAME}assets/town/town.json`, 'utf8'));
// map.js kéo theo api.js (trình duyệt), nên đọc danh sách nơi thẳng từ mã nguồn.
const mapSrc = readFileSync(`${GAME}js/views/map.js`, 'utf8');
const PLACE_IDS = [...mapSrc.slice(mapSrc.indexOf('const PLACES = ['), mapSrc.indexOf('];', mapSrc.indexOf('const PLACES = ['))).matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);

/** Khung toà nhà trên canvas khi chân đặt ở (fx, fy), y hệt Sprite.rect() của town16.js. */
function rectOf(id, fx, fy) {
  const b = town.buildings[id];
  const [, , , w, h, ox, oy] = town.frames[b.frame];
  const [ax, ay] = b.anchor;
  return { x: Math.round(fx - ax + ox), y: Math.round(fy - ay + oy), w, h };
}
function sizeOf(id) {
  const b = town.buildings[id];
  if (!b) return undefined;
  const [, , , w, , ox] = town.frames[b.frame];
  return { l: b.anchor[0] - ox, r: w - (b.anchor[0] - ox) };
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const SHAPES = [['wide'], ['mid'], ['narrow'], ['narrow', NARROW_MIN_W], ['narrow', 348]];

test('lưới khu phố: đọc được 21 nơi từ map.js, nơi nào cũng có tranh và có trong bảng bố cục', () => {
  assert.equal(PLACE_IDS.length, 21);
  assert.equal(new Set(PLACE_IDS).size, PLACE_IDS.length);
  for (const id of PLACE_IDS) assert.ok(town.buildings[id], `${id}: chưa có tranh trong town.json`);
  for (const mode of MODES) {
    const planned = PLANS[mode].rows.flat().flatMap(([, ids]) => ids).filter((id) => !id.startsWith('#'));
    assert.deepEqual([...planned].sort(), [...PLACE_IDS].sort(), `${mode}: bảng bố cục phải có đủ 21 nơi, mỗi nơi một lần`);
  }
});

for (const [mode, width] of SHAPES) {
  test(`lưới khu phố ${mode}${width ? ` ${width}px` : ''}: mỗi nơi đúng một lần, không chồng nhau, nằm trong thế giới`, () => {
    const plan = planTown(mode, PLACE_IDS, { sizeOf, width });
    assert.equal(plan.mode, mode);
    assert.equal(plan.W, width ?? WORLD_W[mode]);
    const placed = plan.cells.filter((c) => c.kind === 'place');
    assert.deepEqual(placed.map((c) => c.id).sort(), [...PLACE_IDS].sort());
    const rects = placed.map((c) => ({ id: c.id, ...rectOf(c.id, c.x, c.y) }));
    for (const r of rects) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= plan.W && r.y + r.h <= plan.H, `${r.id} ra ngoài thế giới ${plan.W}x${plan.H}: ${JSON.stringify(r)}`);
      assert.ok(Math.min(r.w, r.h) >= 40, `${r.id}: nút bấm nhỏ hơn 40 px`);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i], rects[j]), `${rects[i].id} chồng lên ${rects[j].id}`);
    }
    // toà nằm trên dải nhà của dãy mình, không lấn xuống đường
    for (const c of placed) assert.ok(c.y <= plan.rows[c.row].roadTop, `${c.id}: chân toà nằm trên mặt đường`);
    // ô trang trí, quảng trường cũng nằm trong thế giới
    for (const c of plan.cells.filter((cc) => cc.kind !== 'place')) assert.ok(c.x0 >= 0 && c.x1 <= plan.W, `${c.kind} ra ngoài thế giới`);
    // 5 khu + quảng trường, bảng tên nằm trong thế giới
    assert.deepEqual(plan.districts.map((d) => d.id).sort(), ['cho', 'cn', 'nha', 'plaza', 'tai', 'vui']);
    for (const d of plan.districts) assert.ok(d.x >= 0 && d.x < plan.W && d.y >= 0 && d.y < plan.H, `bảng ${d.id} ra ngoài`);
  });
}

test('lưới khu phố: khu đúng như chủ dự án đã duyệt', () => {
  const plan = planTown('wide', PLACE_IDS, { sizeOf });
  const byDistrict = {};
  for (const c of plan.cells.filter((cc) => cc.kind === 'place')) (byDistrict[c.district] ??= []).push(c.id);
  for (const list of Object.values(byDistrict)) list.sort();
  assert.deepEqual(byDistrict, {
    nha: ['clinic', 'garden', 'home', 'kitchen', 'school'],
    tai: ['bank', 'news', 'townhall'],
    cho: ['bazaar', 'boba', 'market', 'matshop', 'shop'],
    vui: ['arcade', 'park'],
    cn: ['arena', 'colosseum', 'factory', 'forge', 'jobs', 'realestate'],
  });
  assert.equal(DISTRICTS.nha.name, 'Nhà & Chăm sóc');
  assert.equal(plan.cells.filter((c) => c.kind === 'plaza').length, 1);
});

test('lưới khu phố: chọn bố cục theo bề ngang, cả phố lọt một khung ở 1366 và 900', () => {
  // bề ngang dành cho phố = cửa sổ trừ lề 16 px hai bên
  assert.equal(townMode(1366 - 32), 'wide');
  assert.equal(townMode(1366 - 15 - 32), 'wide'); // có thanh cuộn dọc
  assert.equal(townMode(900 - 32), 'mid');
  assert.equal(townMode(390 - 8), 'narrow');
  const wide = planTown('wide', PLACE_IDS, { sizeOf });
  const mid = planTown('mid', PLACE_IDS, { sizeOf });
  assert.deepEqual([wide.W, wide.H], [1312, 552]);
  assert.deepEqual([mid.W, mid.H], [848, 728]);
  assert.ok(wide.H + 4 <= 768 - 175 - 30, '1366x768: khung phố phải lọt màn đầu');
  const narrow = planTown('narrow', PLACE_IDS, { sizeOf });
  assert.ok(narrow.W + 4 <= 390 - 2 * 14, '390: không cuộn ngang');
  assert.ok(narrow.vroads.length === 0 && wide.vroads.length === 2 && mid.vroads.length === 1);
});

test('lưới khu phố: nơi mới chưa có trong bảng vẫn được đặt (không bao giờ mất toà)', () => {
  const ids = [...PLACE_IDS, 'zoo', 'library', 'museum', 'harbour', 'castle'];
  for (const mode of MODES) {
    const plan = planTown(mode, ids);
    const placed = plan.cells.filter((c) => c.kind === 'place').map((c) => c.id);
    assert.deepEqual([...placed].sort(), [...ids].sort(), mode);
    const rects = plan.cells.filter((c) => c.kind === 'place').map((c) => ({ x: c.x - 56, y: c.y - 100, w: 112, h: 100 }));
    for (const r of rects) assert.ok(r.x >= 0 && r.x + r.w <= plan.W && r.y + r.h <= plan.H, mode);
  }
  // nơi bị bỏ khỏi PLACES: ô trống, không vỡ bố cục
  const fewer = planTown('wide', PLACE_IDS.filter((id) => id !== 'news'), { sizeOf });
  assert.equal(fewer.cells.filter((c) => c.kind === 'empty').length, 1);
});
