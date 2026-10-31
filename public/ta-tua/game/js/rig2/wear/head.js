// Khe ĐẦU (14 món): mũ, nơ, hoa cài, vương miện... Chủ sở hữu: họa sĩ đồ đội đầu.
// Mỗi món { S(ctx, img), E(ctx, img), N(ctx, img) } (xem wear/common.js). Điểm neo: ctx.sk.anchors.head = đỉnh đầu
// (nhìn ngang: lùi 1 px về sau gáy). Luật của bản mẫu: hình dán cố định cho từng hướng, chốt ở GIỮA ĐÁY vành mũ,
// lún 2 px vào đỉnh đầu; một hình vừa mọi loài, mọi giai đoạn tuổi. Vẽ sau cùng (trên kính, khăn, cốc).
// crown: port nguyên từ pets-pilot (khớp từng điểm ảnh). Món khác: hình cũ của rig.js (LEGACY), hiện ở cả 3 hướng.
import { RAMPS, padOutline, pyRound, stamp, blit } from '../core.js';
import { legacyEntry } from './common.js';

const GOLD = RAMPS.gold;
const CROWN_KEYS = { H: GOLD[4], h: GOLD[3], Y: GOLD[2], D: GOLD[1], R: '#e84a5f', r: '#a84848', B: '#58b9d6', b: '#2f6f9a', L: GOLD[0] };
const CROWN = {
  S: ['h....Y....Y', 'hY..hHY..YD', 'hYY.YYY.YDD', 'hYYYYYYYYYD', 'YRrYYBbYRrD', 'DDDDDDDDDDD'],
  E: ['.h...Y...Y.', '.hY.hYY.YD.', '.hYYYYYYYDD', 'hYYYYYYYYYD', 'YYYYBbYYRrD', 'DDDDDDDDDDD'],
  N: ['h....Y....Y', 'hY..hYY..YD', 'hYY.YYY.YDD', 'hYYYYYYYYYD', 'YYYYYBbYYYD', 'DDDDDDDDDDD'],
};

/** Hình dán theo hướng (đã viền), lưu sẵn. */
export function stampSet(rows, keys) {
  const cache = {};
  return (view) => (cache[view] ??= padOutline(stamp(rows[view], keys)));
}

/** Dán hình mũ: giữa đáy vành ở điểm neo đầu, lún `sink` px vào đầu. */
export function placeOnHead(img, pic, ctx, sink = 2) {
  const [ax, ay] = ctx.sk.anchors.head;
  const x = pyRound(ax - pic.w / 2);
  const y = pyRound(ay) + sink - (pic.h - 1);
  blit(img, pic, x, y);
}

const crownImg = stampSet(CROWN, CROWN_KEYS);
const crown = {
  S: (ctx, img) => placeOnHead(img, crownImg('S'), ctx),
  E: (ctx, img) => placeOnHead(img, crownImg('E'), ctx),
  N: (ctx, img) => placeOnHead(img, crownImg('N'), ctx),
  icon: () => crownImg('S'),
};

/** Sổ đăng ký khe đầu: mã món (WEARABLES) → mục vẽ. */
export const HEAD = { crown };

/** Hình cũ của rig.js (chưa vẽ lại): màu được ép về bảng màu lúc chạy, viền #2e1d14. pivot/sink/side/dx như rig.js. */
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

/** Mục vẽ của món `id` ở khe đầu (món chưa vẽ lại: hình cũ ở cả 3 hướng; món lạ: null). */
export function headFor(id) {
  if (HEAD[id]) return HEAD[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'head', ['S', 'E', 'N']) : null;
}
