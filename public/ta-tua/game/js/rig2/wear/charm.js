// Khe BÙA (9 món): đèn lồng, cỏ bốn lá, đồng xu, vỏ sò, hồ lô, bóng bay, sáo, quạt, trống đồng. Chủ sở hữu: họa sĩ bùa.
// Mỗi món { S(ctx, img), E(ctx, img), N(ctx, img) } (xem wear/common.js). Bùa lơ lửng bên hông tại ctx.sk.anchors.charm
// (S: bên phải bé; N: bên trái; E: sau lưng), đung đưa 1 px theo ctx.tick (tick % 4 ≥ 2 thì thấp xuống 1 px). Vẽ sau cùng.
// Bùa giữ trong ô 48×48: hình rộng tối đa 7 px (cả viền) nếu chốt ở giữa đỉnh.
// Chưa món nào vẽ lại: hình cũ của rig.js (LEGACY), hiện ở cả 3 hướng (bùa nhìn hướng nào cũng như nhau).
import { legacyEntry } from './common.js';

/** Sổ đăng ký khe bùa: mã món → mục vẽ (vẽ lại xong món nào thì thêm vào đây). */
export const CHARM = {};

/** Hình cũ của rig.js (chưa vẽ lại). pivot như rig.js: giữa đỉnh (bóng bay: chốt ở cuối dây). */
export const LEGACY = {
  lantern: { rows: ['..k..', '.rrr.', 'rrYrr', 'rYYYr', 'rrYrr', '.rrr.', '..y..'], pal: { k: '#3a3340', r: '#e2493b', Y: '#ffd75e', y: '#ffd75e' }, pivot: [2, 0] },
  clover: { rows: ['.g.g.', 'gGgGg', '.gwg.', 'gGgGg', '.g.g.', '..g..', '..g..'], pal: { g: '#3f9a5a', G: '#8fdc7a', w: '#ffd75e' }, pivot: [2, 0] },
  luckycoin: { rows: ['..k..', '.yyy.', 'yyYyy', 'yYyYy', 'yyYyy', '.yyy.'], pal: { k: '#7a4c0e', y: '#e0a21c', Y: '#fff3b0' }, pivot: [2, 0] },
  seashell: { rows: ['..p..', '.pPp.', 'pPpPp', 'pPpPp', 'ppppp', '.p.p.'], pal: { p: '#ffb3c1', P: '#fff0f3' }, pivot: [2, 0] },
  gourd: { rows: ['..k..', '.ooo.', '.oOo.', '..o..', 'ooooo', 'oOooo', 'ooooo', '.ooo.'], pal: { k: '#e2493b', o: '#c99a4b', O: '#f2d58a' }, pivot: [2, 0] },
  balloon: { rows: ['.bbb.', 'bbWbb', 'bWbbb', 'bbbbb', '.bbb.', '..b..', '..k..', '...k.', '..k..', '...k.'], pal: { b: '#4f8fd6', W: '#bfe3f7', k: '#6d6478' }, pivot: [3, 9] },
  sao: { rows: ['.gGg.', '.gkg.', '.gGg.', '.gkg.', '.gGg.', '.gkg.', '.ggg.', '..r..', '.r.r.'], pal: { g: '#5fae4a', G: '#a8e07a', k: '#2f5a24', r: '#e2493b' }, pivot: [2, 0] },
  quat: { rows: ['.rOrOr.', 'rOrOrOr', '.rOrOr.', '..rrr..', '...k...', '...k...'], pal: { r: '#e2493b', O: '#ffb347', k: '#8a5a35' }, pivot: [3, 0] },
  trongdong: { rows: ['.ooooo.', 'oOoYoOo', 'ooooooo', 'oKoKoKo', 'ooooooo', '.o...o.'], pal: { o: '#b0803c', O: '#e6c88a', Y: '#ffd75e', K: '#6b4a1f' }, pivot: [3, 0] },
};

export function charmFor(id) {
  if (CHARM[id]) return CHARM[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'charm', ['S', 'E', 'N']) : null;
}
