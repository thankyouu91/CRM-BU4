// Hướng đi của bé (public/ta-tua/game/js/petmotion.js): chọn S/E/N/W theo véc-tơ di chuyển có trễ, đổi tên play()
// ra hàng có thật trên sheet mới (walkS/E/N/W, idleE/N/W) lẫn sheet cũ (idle, runRight, runLeft), và bảng cỡ số nguyên.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DIRS, PET_PX, directionOf, hasDirections, isPixelPerfect, petPx, resolveAnim } from '../../public/ta-tua/game/js/petmotion.js';

const row = { row: 0, frames: 6, fps: 10 };
const OLD = Object.fromEntries(['idle', 'runRight', 'runLeft', 'wave', 'jump', 'sad', 'wait', 'busy', 'think', 'spin'].map((k) => [k, row]));
const NEW = {
  ...OLD,
  ...Object.fromEntries(['idleE', 'idleN', 'idleW', 'walkS', 'walkE', 'walkN', 'walkW'].map((k) => [k, row])),
};

test('hướng theo trục trội: phải E, trái W, xuống S, lên N', () => {
  assert.equal(directionOf(10, 1, 'S'), 'E');
  assert.equal(directionOf(-10, 1, 'S'), 'W');
  assert.equal(directionOf(1, 10, 'E'), 'S');
  assert.equal(directionOf(1, -10, 'E'), 'N');
  assert.deepEqual(DIRS, ['S', 'E', 'N', 'W']);
});

test('đi chéo không giật: phải vượt ngưỡng trễ mới đổi trục', () => {
  // Đang đi ngang: chéo 45 độ, hơi dọc hơn một chút vẫn giữ ngang.
  assert.equal(directionOf(10, 10, 'E'), 'E');
  assert.equal(directionOf(10, 12, 'E'), 'E');
  assert.equal(directionOf(-10, 12, 'E'), 'W', 'đổi dấu ngang thì quay theo dấu, vẫn trên trục ngang');
  assert.equal(directionOf(10, 14, 'E'), 'S', 'dọc trội hơn 1.35 lần thì sang trục dọc');
  // Đang đi dọc: tương tự.
  assert.equal(directionOf(12, -10, 'N'), 'N');
  assert.equal(directionOf(14, -10, 'N'), 'E');
  // Chuỗi véc-tơ lắc quanh đường chéo không làm hướng nhảy qua lại.
  let dir = 'E';
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    dir = directionOf(10, 10 + (i % 2 ? 2 : -2), dir);
    seen.add(dir);
  }
  assert.deepEqual([...seen], ['E']);
});

test('bước quá ngắn hoặc đứng yên giữ hướng cũ', () => {
  assert.equal(directionOf(0, 0, 'N'), 'N');
  assert.equal(directionOf(0.2, -0.1, 'W'), 'W');
  assert.equal(directionOf(2, 0, 'W', { minStep: 3 }), 'W');
  assert.equal(directionOf(4, 0, 'W', { minStep: 3 }), 'E');
  assert.equal(directionOf(Number.NaN, 1, 'E'), 'E');
  assert.equal(directionOf(5, 0, 'bogus'), 'E');
});

test('sheet mới: walk và idle theo đúng hướng', () => {
  for (const d of DIRS) assert.equal(resolveAnim(NEW, 'walk', d, 'E'), `walk${d}`);
  assert.equal(resolveAnim(NEW, 'idle', 'S'), 'idle');
  assert.equal(resolveAnim(NEW, 'idle', 'E'), 'idleE');
  assert.equal(resolveAnim(NEW, 'idle', 'N'), 'idleN');
  assert.equal(resolveAnim(NEW, 'idle', 'W'), 'idleW');
});

test('sheet cũ: walk về runRight / runLeft, đi dọc chạy theo hướng ngang gần nhất, idle luôn nhìn trước', () => {
  assert.equal(resolveAnim(OLD, 'walk', 'E', 'W'), 'runRight');
  assert.equal(resolveAnim(OLD, 'walk', 'W', 'E'), 'runLeft');
  assert.equal(resolveAnim(OLD, 'walk', 'S', 'E'), 'runRight');
  assert.equal(resolveAnim(OLD, 'walk', 'N', 'E'), 'runRight');
  assert.equal(resolveAnim(OLD, 'walk', 'S', 'W'), 'runLeft');
  assert.equal(resolveAnim(OLD, 'walk', 'N', 'W'), 'runLeft');
  for (const d of DIRS) assert.equal(resolveAnim(OLD, 'idle', d), 'idle');
});

test('sheet thiếu một phần: idle có hướng thì dùng, không thì idle; chỉ có walkE/W thì đi dọc theo hướng ngang', () => {
  const partial = { idle: row, idleN: row, walkE: row, walkW: row, runRight: row, runLeft: row };
  assert.equal(resolveAnim(partial, 'idle', 'N'), 'idleN');
  assert.equal(resolveAnim(partial, 'idle', 'E'), 'idle');
  assert.equal(resolveAnim(partial, 'walk', 'S', 'W'), 'walkW');
  assert.equal(resolveAnim(partial, 'walk', 'N', 'E'), 'walkE');
  assert.equal(resolveAnim({ idle: row }, 'walk', 'E'), 'idle', 'không có hàng đi thì đứng yên');
});

test('cảm xúc và tên cũ giữ nguyên; tên không có trả về null', () => {
  for (const k of ['wave', 'jump', 'sad', 'wait', 'busy', 'think', 'spin', 'runRight', 'runLeft']) assert.equal(resolveAnim(NEW, k, 'N'), k);
  assert.equal(resolveAnim(OLD, 'dance', 'S'), null);
  assert.equal(resolveAnim(undefined, 'idle', 'S'), null);
});

test('hasDirections chỉ đúng khi sheet có cả hàng E lẫn W (không bao giờ lật CSS sheet có W)', () => {
  assert.equal(hasDirections({ anims: NEW }), true);
  assert.equal(hasDirections({ anims: NEW }, 'idle'), true);
  assert.equal(hasDirections({ anims: OLD }), false);
  assert.equal(hasDirections({ anims: OLD }, 'idle'), false);
  assert.equal(hasDirections(null), false);
});

test('pixelPerfect thiếu cờ coi như không; bảng cỡ toàn số nguyên', () => {
  assert.equal(isPixelPerfect({ pixelPerfect: true }), true);
  assert.equal(isPixelPerfect({ pixelated: true }), false);
  assert.equal(isPixelPerfect({ pixelPerfect: 'yes' }), false);
  assert.equal(isPixelPerfect(undefined), false);
  for (const [ctx, [desk, phone]] of Object.entries(PET_PX)) {
    assert.ok(Number.isInteger(desk) && Number.isInteger(phone) && desk >= phone && phone >= 1, ctx);
    assert.equal(petPx(ctx, false), desk);
    assert.equal(petPx(ctx, true), phone);
  }
  assert.deepEqual([petPx('home'), petPx('home', true), petPx('park'), petPx('park', true)], [5, 4, 3, 2]);
  assert.equal(petPx('nowhere'), PET_PX.card[0]);
});
