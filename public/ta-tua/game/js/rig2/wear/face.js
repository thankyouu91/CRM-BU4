// Khe MẶT (11 món): kính tròn, kính râm, kính lá, kính tim, kính gỗ, kính một mắt, mặt nạ dạ hội, kính sao, khăn bịt,
// kính bảo hộ, mặt nạ vàng. Hình: gói vẽ phase 2 (wear-face), sinh ra ở wear/data/face.js (scripts/art/build-wear.mjs).
// Luật đặt (wear/stamp.js, báo cáo khe mặt luật 1-3): viền CHỈ bóng ngoài (tròng kính, lỗ mắt để trống cho thấy mắt);
// đặt theo Ô MẮT của bộ xương: Y = floor(eyeY − eh/2 + .5), X = pyRound(neo mặt x) ở S/N, floor(neo mặt x − ew/2 + .5)
// ở E (mắt gần); X += pose.look ở S và E (không ở N); "big" cho giai đoạn mắt to (bé sơ sinh, nhí nhố: mắt 3×4).
// Lớp "front": S/E vẽ sau khăn và cốc, trước mũ; N vẽ ngay sau pet (dây, quai sau đầu). Kính một mắt không có hình N.
// Món nào thiếu dữ liệu thì dùng hình cũ của rig.js (LEGACY): nguyên hình ở S, nửa gần ở E, không có ở N.
import DATA from './data/face.js';
import { legacyEntry } from './common.js';
import { dataEntry } from './stamp.js';

/** Sổ đăng ký khe face: mã món (WEARABLES) → mục vẽ (wear/stamp.js dataEntry). */
export const FACE = Object.fromEntries(Object.entries(DATA).map(([id, item]) => [id, dataEntry('face', id, item)]));

/** Hình cũ của rig.js (dự phòng: chỉ dùng khi món chưa có dữ liệu). pivot như rig.js: điểm neo mặt = giữa hàng mắt. */
export const LEGACY = {
  shades: { rows: ['###############', '#BwB#.....#BwB#', '.###.......###.'], pal: { '#': '#22202b', B: '#3d3a52', w: '#8f8aa8' }, pivot: [7, 1] },
  leafglasses: { rows: ['g###.......###g', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'], pal: { '#': '#4f9a3f', w: '#dff3c8', L: '#ffffff', g: '#8fdc7a' }, pivot: [7, 2] },
  heartglasses: { rows: ['.r.r.......r.r.', 'rprpr#####rprpr', 'rpppr.....rpppr', '.rpr.......rpr.', '..r.........r..'], pal: { r: '#e2493b', p: '#ffb3c1', '#': '#c8402f' }, pivot: [7, 2] },
  woodglasses: { rows: ['.###.......###.', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'], pal: { '#': '#8a5a35', w: '#f3e3c8', L: '#ffffff' }, pivot: [7, 2] },
  monocle: { rows: ['...........###.', '..........#wLw#', '..........#www#', '...........###.', '..........y....', '.........y.....'], pal: { '#': '#e0a21c', w: '#bfe0f5', L: '#ffffff', y: '#e0a21c' }, pivot: [7, 2] },
  partymask: { rows: ['rrrrrrrrrrrrrrr', 'rr...rrrrr...rr', 'rrr.rrrYrrr.rrr', '.rrrrr...rrrrr.'], pal: { r: '#a55fd0', Y: '#ffd75e' }, pivot: [7, 1] },
  starglasses: { rows: ['..y.........y..', '.yyy.......yyy.', 'yybyy#####yybyy', '.yyy.......yyy.', '.y.y.......y.y.'], pal: { y: '#ffd75e', b: '#4f8fd6', '#': '#e0a21c' }, pivot: [7, 2] },
  bandana: { rows: ['ggggggggggggggg', 'gg...ggggg...gg', 'ggggggggggggggg', '.............gG'], pal: { g: '#4f9a3f', G: '#8fdc7a' }, pivot: [7, 1] },
  goggles: { rows: ['..###.....###..', 'ss#gg#####gg#ss', '..#Lg#...#Lg#..', '..###.....###..'], pal: { '#': '#b87333', g: '#9fd8c0', L: '#ffffff', s: '#6b4a1f' }, pivot: [7, 2] },
  goldmask: { rows: ['yyyyyyyyyyyyyyy', 'yy...yyyyy...yy', 'yyy.yyyRyyy.yyy', '.yyyYy...yYyyy.', '..y.........y..'], pal: { y: '#e0a21c', Y: '#fff3b0', R: '#e2493b' }, pivot: [7, 1] },
};

/** Mục vẽ của món `id` ở khe face: dữ liệu; thiếu dữ liệu thì hình cũ (LEGACY); món lạ: null (khe bị bỏ qua). */
export function faceFor(id) {
  if (FACE[id]) return FACE[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'face') : null;
}
