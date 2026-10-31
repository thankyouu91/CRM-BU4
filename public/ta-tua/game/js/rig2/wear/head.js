// Khe ĐẦU (14 món): vương miện, hoa cài, vòng lá, mũ chóp, nơ, mũ nồi, nón lá, vầng hào quang, mũ lưỡi trai, mũ rơm,
// mũ nấm, sừng quỷ, khăn đóng, hoa sen. Hình: gói vẽ phase 2 (wear-head), sinh ra ở wear/data/head.js
// (scripts/art/build-wear.mjs). Luật đặt (wear/stamp.js): chốt của hình rơi vào (floor(x + .5), floor(y + .5)) của
// ctx.sk.anchors.head (đỉnh đầu; nhìn ngang lùi 1 px về gáy), hình tự lún vào đầu theo chốt; "small" cho bé sơ sinh và
// nhí nhố; khi nhảy, đỉnh món không lên quá hàng 1 (đẩy xuống), vầng hào quang trễ sau đầu tối đa 3 px.
// Lớp: 13 món "front" (vẽ sau kính, khăn, cốc); halo "behind" (vẽ dưới pet: tai thỏ dựng trước vòng).
// earsOver (tophat, beret, cap): CHỈ hướng S và chỉ loài có tai nhọn hai bên đầu (EARS_OVER: tai mèo), tai của pet được
// vẽ lại lên trên mũ (index.js); không bao giờ ở E, N, W; không cho tai thỏ (dựng trên đỉnh) hay tai tròn.
// Món nào thiếu dữ liệu thì dùng hình cũ của rig.js (LEGACY, wear/common.js legacyEntry) ở cả 3 hướng.
import DATA from './data/head.js';
import { legacyEntry } from './common.js';
import { dataEntry } from './stamp.js';

/** Loại tai (shared/pets.js `ears`) được vẽ lại lên trên món có earsOver ở hướng S: tai nhọn mọc hai bên đầu. */
export const EARS_OVER = new Set(['cat']);

/** Sổ đăng ký khe head: mã món (WEARABLES) → mục vẽ (wear/stamp.js dataEntry). */
export const HEAD = Object.fromEntries(Object.entries(DATA).map(([id, item]) => [id, dataEntry('head', id, item)]));

/** Hình cũ của rig.js (dự phòng: chỉ dùng khi món chưa có dữ liệu): màu được ép về bảng màu lúc chạy, viền #2e1d14. pivot/sink/side/dx như rig.js. */
export const LEGACY = {
  tophat: { rows: ['..#######..', '..#w#####..', '..#w#####..', '..#######..', '..#######..', '..rrrrrrr..', '..#######..', '###########', '.#########.'], pal: { '#': '#3a3340', w: '#6d6478', r: '#4f8fd6' }, pivot: [5, 8], sink: 2 },
  beret: { rows: ['.....r......', '...rrrrrr...', '.rrrrrrrrrr.', 'rRrrrrrrrrrr', '.RRRRRRRRRR.'], pal: { r: '#e2493b', R: '#b8352a' }, pivot: [6, 4], sink: 3, dx: -1 },
  nonla: { rows: ['.......y.......', '......yYy......', '....yyyYyyy....', '..yyyyyYyyyyy..', 'yyyyyyyyyyyyyyy', '.bbbbbbbbbbbbb.'], pal: { y: '#f2d58a', Y: '#fff1c2', b: '#c99a4b' }, pivot: [7, 5], sink: 3 },
  leafband: { rows: ['.g.G.g.G.g.G.', 'ggGggGggGggGg', '.ggggggggggg.'], pal: { g: '#5fae4a', G: '#a8e07a' }, pivot: [6, 2], sink: 3 },
  bow: { rows: ['.pp.....pp.', 'pwpp...pppp', 'ppppDkDpppp', 'pppDkkkDppp', 'ppppDkDpppp', 'pppp...pppp', '.pp.....pp.'], pal: { p: '#ff8fb1', w: '#ffd6e4', D: '#e0607f', k: '#c44569' }, pivot: [5, 6], sink: 3, side: 0.5 },
  flower: { rows: ['..p.p..', '.ppPpp.', 'pPpypPp', '.ppypp.', 'pPpppPp', '.pp.pp.'], pal: { p: '#ffb7cf', P: '#ffe3ec', y: '#ffd75e' }, pivot: [3, 5], sink: 3, side: -0.55 },
  halo: { rows: ['..yyyyyyy..', '.y.......y.', '..yyyyyyy..'], pal: { y: '#ffe680' }, pivot: [5, 2], sink: -2 },
  cap: { rows: ['....bbbbbb.....', '...bbbbbbbb....', '..bbWbbbbbbb...', '..bbbbbbbbbbb..', '..BBBBBBBBBBBBB'], pal: { b: '#4f8fd6', W: '#bfe3f7', B: '#2f5f9e' }, pivot: [7, 4], sink: 3 },
  strawhat: { rows: ['....yyyyyyy....', '...yyyyyyyyy...', '...rrrrrrrrr...', 'yyyyyyyyyyyyyyy', '.yyyyyyyyyyyyy.'], pal: { y: '#f2d58a', r: '#e2493b' }, pivot: [7, 4], sink: 3 },
  mushroom: { rows: ['....rrrrr....', '..rrwrrrwrr..', '.rrrrrrrrrrr.', 'rrwrrrrrrwrrr', 'rrrrrwrrrrrrr', '.ccccccccccc.'], pal: { r: '#e2493b', w: '#ffffff', c: '#f3e3c8' }, pivot: [6, 5], sink: 3 },
  devilhorns: { rows: ['r.........r', 'rr.......rr', 'rRr.....rRr', '.rr.....rr.', 'kkkkkkkkkkk'], pal: { r: '#c8402f', R: '#f5a64a', k: '#3a3340' }, pivot: [5, 4], sink: 3 },
  khandong: { rows: ['..bbbbbbb..', '.bBbBbBbBb.', 'bBbBbBbBbBb', 'bbbbbbbbbbb'], pal: { b: '#2f5f9e', B: '#4f8fd6' }, pivot: [5, 3], sink: 3 },
  lotus: { rows: ['.....p.....', '...p.P.p...', '..pPpPpPp..', '.pPpPyPpPp.', 'ggpppppppgg', '.ggg...ggg.'], pal: { p: '#ff8fb1', P: '#ffd6e4', y: '#ffd75e', g: '#3f9a5a' }, pivot: [5, 5], sink: 3 },
};

/** Mục vẽ của món `id` ở khe head: dữ liệu; thiếu dữ liệu thì hình cũ (LEGACY); món lạ: null (khe bị bỏ qua). */
export function headFor(id) {
  if (HEAD[id]) return HEAD[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'head') : null;
}
