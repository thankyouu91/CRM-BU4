// Khe CỔ (10 món): vòng chuông, khăn lá, chuỗi ngọc trai, khăn quàng, nơ cổ, huy chương, vòng ngọc bích, cà vạt,
// vòng hoa, hổ phách. Hình: gói vẽ phase 2 (wear-neck), sinh ra ở wear/data/neck.js (scripts/art/build-wear.mjs).
// Luật đặt (wear/stamp.js, báo cáo khe cổ): chốt rơi vào (floor(x + .5), floor(y + .5)) của ctx.sk.anchors.neck (dưới
// cằm); viền 4 hướng lấp cả lỗ kín (lỗ ngọc bội); CẰM CHE DẢI: xóa mọi điểm (cả viền) nằm trong ctx.chin ở S/E, không ở
// N; "small" cho bé sơ sinh và nhí nhố; khăn quàng và khăn lá phấp phới ở E (hàng `flutter` dời theo pose.flutter).
// Thứ tự trên Boba ôm cốc (WEAR-SPEC D2, index.js): pet → thân cốc → đồ cổ → ống hút + tay ôm cốc → kính → mũ.
// Món nào thiếu dữ liệu thì dùng hình cũ của rig.js (LEGACY): hướng S, và E tại neo cổ nhìn ngang; không có ở N.
import DATA from './data/neck.js';
import { legacyEntry } from './common.js';
import { dataEntry } from './stamp.js';

/** Sổ đăng ký khe neck: mã món (WEARABLES) → mục vẽ (wear/stamp.js dataEntry). */
export const NECK = Object.fromEntries(Object.entries(DATA).map(([id, item]) => [id, dataEntry('neck', id, item)]));

/** Hình cũ của rig.js (dự phòng: chỉ dùng khi món chưa có dữ liệu). pivot như rig.js: điểm neo cổ = giữa, ngay dưới cằm. */
export const LEGACY = {
  bell: { rows: ['.ccccccccc.', 'ccccccccccc', '....yYy....', '....yyy....', '.....k.....'], pal: { c: '#8796a8', y: '#ffcf4a', Y: '#fff3b0', k: '#7a4c0e' }, pivot: [5, 1] },
  pearls: { rows: ['p...........p', '.p.........p.', '..p.p.p.p.p..'], pal: { p: '#f4f1ff' }, pivot: [6, 0] },
  bowtie: { rows: ['bb...bb', 'bbbkbbb', 'bb...bb'], pal: { b: '#a8743c', k: '#6b4a1f' }, pivot: [3, 1] },
  leafscarf: { rows: ['.gGg.gGg.gGg..', 'gggggggggggggg', '.g...g...g..g.'], pal: { g: '#5fae4a', G: '#a8e07a' }, pivot: [7, 1] },
  medal: { rows: ['r.........b', '.r.......b.', '..r.....b..', '...rr.bb...', '....yyy....', '...yYyyy...', '...yyyyy...', '....yyy....'], pal: { r: '#e2493b', b: '#4f8fd6', y: '#e0a21c', Y: '#fff3b0' }, pivot: [5, 0] },
  jade: { rows: ['g...........g', '.g.........g.', '..g.g.G.g.g..', '.....GGG.....', '......G......'], pal: { g: '#3f9a5a', G: '#8fdc7a' }, pivot: [6, 0] },
  necktie: { rows: ['.bbbbb.', '..bBb..', '..bbb..', '..bBb..', '..bbb..', '...b...'], pal: { b: '#4f8fd6', B: '#bfe3f7' }, pivot: [3, 0] },
  lei: { rows: ['pYp.......oYo', '.oYo.....pYp.', '...pYpoYopY..'], pal: { p: '#ff8fb1', o: '#ffb347', Y: '#ffd75e' }, pivot: [6, 0] },
  amber: { rows: ['b...........b', '.b.........b.', '..b.b.o.b.b..', '.....oOo.....', '......o......'], pal: { b: '#8a5a35', o: '#e08a1c', O: '#ffd27a' }, pivot: [6, 0] },
};

/** Mục vẽ của món `id` ở khe neck: dữ liệu; thiếu dữ liệu thì hình cũ (LEGACY); món lạ: null (khe bị bỏ qua). */
export function neckFor(id) {
  if (NECK[id]) return NECK[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'neck') : null;
}
