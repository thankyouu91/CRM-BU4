// Khe LƯNG (11 món): cánh, áo choàng, ba lô... Chủ sở hữu: họa sĩ đồ đeo lưng.
// Mỗi món { S(ctx, img), E(ctx, img), N(ctx, img) } (xem wear/common.js). Điểm neo ctx.sk.anchors.back = vai
// (S/N: giữa đỉnh thân; E: phía sau thân). THỨ TỰ VẼ: nhìn trước và ngang, món lưng vẽ TRƯỚC pet (img lúc đó chỉ
// có hào quang phía sau, pet sẽ đè lên); nhìn sau, món lưng vẽ SAU CÙNG (trên pet, mũ, khăn).
// Chưa món nào vẽ lại: hình cũ của rig.js (LEGACY) hiện ở cả 3 hướng (S và E sau lưng, chỉ lộ mép cánh / áo choàng;
// N đè lên lưng), không thò xuống dưới mặt đất (bé sơ sinh: áo choàng chạm đất như bàn chân). Xem wear/common.js legacyEntry.
import { legacyEntry } from './common.js';

/** Sổ đăng ký khe lưng: mã món → mục vẽ (vẽ lại xong món nào thì thêm vào đây). */
export const BACK = {};

/** Hình cũ của rig.js (chưa vẽ lại). pivot như rig.js: điểm neo lưng = vai. */
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

export function backFor(id) {
  if (BACK[id]) return BACK[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'back') : null;
}
