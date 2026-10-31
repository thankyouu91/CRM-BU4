// Khe LƯNG (11 món): cánh thiên thần, cánh rồng, áo choàng, cánh bướm, áo choàng sóng, ba lô, cánh dơi, cánh phượng,
// cánh tiên, áo tơi, áo choàng sao. Hình: gói vẽ phase 2 (wear-back), sinh ra ở wear/data/back.js
// (scripts/art/build-wear.mjs). Luật đặt (wear/stamp.js): chốt rơi vào (floor(x), floor(y)) của ctx.sk.anchors.back (vai;
// nhìn ngang: sau lưng, thú bốn chân thì dời lên gần cổ, WEAR-SPEC D4); "small" cho bé sơ sinh và nhí nhố.
// Lớp "behindNfront": S/E vẽ TRƯỚC pet (chỉ lộ cánh, mép áo choàng), N vẽ sau cùng (đè lên lưng và chân đầu).
// Áo choàng, áo tơi (`drape`, WEAR-SPEC D4): thú bốn chân nhìn ngang thì vẽ SAU pet, phủ lưng từ gáy tới mông.
// Nhìn ngang, đồ lưng vẽ dưới pet vẫn nằm trên phần ĐUÔI thò ra ngoài thân (sóc, chim xòe đuôi: index.js backOverTail).
// Hình túi đồ (wearIcon): áo choàng, áo tơi, ba lô lấy hình N (cả món), các món khác hình S.
// "over" (WEAR-SPEC D1, nếu một hướng có): phần ôm trước ngực (quai ba lô, dây áo choàng) vẽ ngay SAU thân pet, trước khăn,
// kính, mũ, có viền riêng, cằm che. Không thò xuống dưới hàng chân, không chạm mép trái/phải.
// Món nào thiếu dữ liệu thì dùng hình cũ của rig.js (LEGACY) ở cả 3 hướng.
import DATA from './data/back.js';
import { legacyEntry } from './common.js';
import { dataEntry } from './stamp.js';

/** Sổ đăng ký khe back: mã món (WEARABLES) → mục vẽ (wear/stamp.js dataEntry). */
export const BACK = Object.fromEntries(Object.entries(DATA).map(([id, item]) => [id, dataEntry('back', id, item)]));

/** Hình cũ của rig.js (dự phòng: chỉ dùng khi món chưa có dữ liệu). pivot như rig.js: điểm neo lưng = vai. */
export const LEGACY = {
  cape: { rows: ['......cccccccccc......', '.....cccccccccccc.....', '....cccccccccccccc....', '...cccccccccccccccc...', '..cccccccccccccccccc..', '..cccccccccccccccccc..', '.cccccccccccccccccccc.', '.cccccccccccccccccccc.', 'cccccccccccccccccccccc', 'cCcccCcccCcccCcccCcccC'], pal: { c: '#c99a4b', C: '#e6c88a' }, pivot: [11, 0] },
  angel: { rows: ['ww..........................ww', 'wWw........................wWw', 'wwWw......................wWww', '.wwWww..................wwWww.', '..wwwWww..............wwWwww..', '...wwwwww............wwwwww...', '....wwww..............wwww....', '.....ww................ww.....'], pal: { w: '#ffffff', W: '#d3e0f0' }, pivot: [15, 6] },
  dragonwings: { rows: ['r............................r', 'rr..........................rr', 'rRr........................rRr', 'rRRrr....................rrRRr', '.rRRRrr................rrRRRr.', '..rrRRRrr............rrRRRrr..', '...r.r.rrr..........rrr.r.r...'], pal: { r: '#c8402f', R: '#f5a64a' }, pivot: [15, 5] },
  butterfly: { rows: ['.gggg....................gggg.', 'gGGGgg..................ggGGGg', 'gGyGGgg................ggGGyGg', 'gGGGGGgg..............ggGGGGGg', '.ggGGGgg..............ggGGGgg.', '..gGyGg................gGyGg..', '..gGGGg................gGGGg..', '...ggg..................ggg...'], pal: { g: '#3f9a5a', G: '#8fdc7a', y: '#ffd75e' }, pivot: [15, 5] },
  wavecape: { rows: ['......bbbbbbbbbb......', '.....bbbbbbbbbbbb.....', '....bbbbbbbbbbbbbb....', '...bbbbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbbbb..', '.bbbbbbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbbbbbb.', 'bbwwbbbwwbbbwwbbbwwbbb', 'bwbbwbwbbwbwbbwbwbbwbw'], pal: { b: '#4f8fd6', w: '#bfe3f7' }, pivot: [11, 0] },
  backpack: { rows: ['.........kkkkkk.........', '........kBBBBBBk........', '..bbbbbbbbbbbbbbbbbbbb..', '.bBBbbbbbbbbbbbbbbbbBBb.', 'bbBbbbbbbbbbbbbbbbbbbBbb', 'bbbbbbbbbbbbbbbbbbbbbbbb', 'bkkbbbbbbbbbbbbbbbbbbkkb', 'bbbbbbbbbbbbbbbbbbbbbbbb', '.bbbbbbbbbbbbbbbbbbbbbb.'], pal: { b: '#c0612b', B: '#e6905a', k: '#ffd75e' }, pivot: [12, 2] },
  batwings: { rows: ['b............................b', 'bb..........................bb', 'bBb........................bBb', 'bBBbb....................bbBBb', '.bBBBbb................bbBBBb.', '..bbBBBbb............bbBBBbb..', '..b.b.b.bb..........bb.b.b.b..'], pal: { b: '#3d3a6b', B: '#7a6fc0' }, pivot: [15, 5] },
  phoenix: { rows: ['.r..........................r.', 'rRr........................rRr', 'rRYr......................rYRr', 'rRYYrr..................rrYYRr', '.rRYYYrr..............rrYYYRr.', '..rRRYYrr............rrYYRRr..', '...rrRRrr............rrRRrr...', '....r.r.r............r.r.r....'], pal: { r: '#c8402f', R: '#f0663c', Y: '#ffd75e' }, pivot: [15, 6] },
  fairy: { rows: ['.cccc....................cccc.', 'cWWWcc..................ccWWWc', 'cWWWWcc................ccWWWWc', '.cWWWWc................cWWWWc.', '..cccc..................cccc..', '..cWWc..................cWWc..', '...cc....................cc...'], pal: { c: '#9fd8f0', W: '#e8f8ff' }, pivot: [15, 4] },
  aotoi: { rows: ['......cccccccccc......', '.....cccCccccCccc.....', '....ccCccccCccccCc....', '...cCccccCccccCcccc...', '..CccccCccccCccccCcc..', '..cccCccccCccccCcccc..', '.ccCccccCccccCccccCcc.', '.CccccCccccCccccCcccc.', 'ccccCccccCccccCccccCcc', 'c.c.c.c.c.c.c.c.c.c.c.'], pal: { c: '#8a9a3c', C: '#c8d47a' }, pivot: [11, 0] },
  starcape: { rows: ['......cccccccccc......', '.....ccccsccccccc.....', '....ccccccccccwccc....', '...cccscccccccccccc...', '..ccccccccccsccccccc..', '..ccwccccccccccccscc..', '.ccccccccwccccccccccc.', '.ccscccccccccccsccccc.', 'cccccccccccwcccccccscc', 'cCcCcCcCcCcCcCcCcCcCcC'], pal: { c: '#1f2a5a', C: '#3d4f9e', s: '#ffe680', w: '#9fb4ff' }, pivot: [11, 0] },
};

/** Mục vẽ của món `id` ở khe back: dữ liệu; thiếu dữ liệu thì hình cũ (LEGACY); món lạ: null (khe bị bỏ qua). */
export function backFor(id) {
  if (BACK[id]) return BACK[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'back') : null;
}
