// Khe BÙA (9 món): đèn lồng, cỏ bốn lá, đồng xu may mắn, vỏ sò, hồ lô, bóng bay, sáo trúc, quạt lông phượng, trống
// đồng. Hình: gói vẽ phase 2 (wear-charm), sinh ra ở wear/data/charm.js (scripts/art/build-wear.mjs).
// Luật đặt (wear/stamp.js): chốt rơi vào (pyRound(x), pyRound(y)) của ctx.sk.anchors.charm (S: bên phải bé; N: bên trái;
// E: sau mông, neo = min(bcx − brx, hcx − hrx) − 2.5, WEAR-SPEC D6), nhún xuống 1 px khi ctx.tick % 4 ≥ 2; mỗi hướng một
// hình (bóng bay, sáo khác nhau theo hướng); "small" cho bé sơ sinh và nhí nhố; viền lấp lỗ kín (lỗ vuông đồng xu).
// Lớp "behindNfront": S/E vẽ dưới pet (đuôi, mông che bùa), N vẽ trên pet. Không thò xuống dưới hàng chân.
// Món nào thiếu dữ liệu thì dùng hình cũ của rig.js (LEGACY) ở cả 3 hướng, đung đưa 1 px.
import DATA from './data/charm.js';
import { legacyEntry } from './common.js';
import { dataEntry } from './stamp.js';

/** Sổ đăng ký khe charm: mã món (WEARABLES) → mục vẽ (wear/stamp.js dataEntry). */
export const CHARM = Object.fromEntries(Object.entries(DATA).map(([id, item]) => [id, dataEntry('charm', id, item)]));

/** Hình cũ của rig.js (dự phòng: chỉ dùng khi món chưa có dữ liệu). pivot như rig.js: giữa đỉnh (bóng bay: chốt ở cuối dây). */
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

/** Mục vẽ của món `id` ở khe charm: dữ liệu; thiếu dữ liệu thì hình cũ (LEGACY); món lạ: null (khe bị bỏ qua). */
export function charmFor(id) {
  if (CHARM[id]) return CHARM[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'charm') : null;
}
