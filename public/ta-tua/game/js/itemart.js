// Biểu tượng pixel cho đồ trong Siêu thị và Túi đồ: cùng lưới, cùng viền nâu đậm, cùng độ thô với pet,
// để đồ ăn, đồ chơi, đồ đeo trông như một bộ. Đồ đeo dùng chính hình vẽ lên người (rig.js).
import { OUTLINE, bitmap } from './pixel.js';
import { wearImage } from './rig.js';
import { ELEMENTS } from './shared/pets.js';

const ICONS = {
  boba: [[
    '......ss..', '.....ss...', '.....s....', 'LLLLLsLLLL', '.tttttttt.', '.twtttttt.', '.twtttttt.',
    '.tttttttt.', '.tpptpptt.', '..pptppt..', '..pppppp..', '...pppp...',
  ], { s: '#ff8fb1', L: '#e9eef5', t: '#e8c49a', w: '#fff3e0', p: '#3d2a1f' }],
  fish: [[
    '....ffff....', '..ffffffff.t', '.fefffffffft', 'fffffffffftt', '.fbbbbbbbftt', '..ffffffff.t', '....ffff....',
  ], { f: '#7cb6e8', b: '#e6f3fb', e: OUTLINE, t: '#5a93cf' }],
  onigiri: [[
    '.....w.....', '....www....', '...wwwww...', '..wwwwwww..', '..wwwwwww..', '.wwwwwwwww.',
    '.wwwnnnwww.', 'wwwwnnnwwww', 'wwwwnnnwwww', '.wwwnnnwww.',
  ], { w: '#fbf8ef', n: '#2f3b2f' }],
  sushi: [[
    '..oo....oo..', '.oOoo..oOoo.', '.oooo..oooo.', '.rrrr..rrrr.', '.rrrr..rrrr.', 'bbbbbbbbbbbb', 'bBBBBBBBBBBb', '.b........b.',
  ], { o: '#ff9a6b', O: '#ffc4a3', r: '#fbf8ef', b: '#b98a52', B: '#d9a85c' }],
  cake: [[
    '.....RR.....', '....RrRR....', '..wwwRRwww..', '.wwwwwwwwww.', '.pppppppppp.', '.cccccccccc.',
    '.pppppppppp.', '.cccccccccc.', '.cccccccccc.', 'dddddddddddd',
  ], { R: '#e84a5f', r: '#ff8fa0', w: '#ffffff', p: '#ffc4d6', c: '#f6d79a', d: '#dfe3ec' }],
  juice: [[
    '......s..', '.....s...', '....s....', '.ggggsgg.', '.gGGGGGg.', '.gGoooGg.', '.gGoOoGg.',
    '.gGoooGg.', '.gGGGGGg.', '.ggggggg.', '.ggggggg.',
  ], { g: '#7cc576', G: '#c9ecb0', o: '#ffa53d', O: '#ffd75e', s: '#f4f4f4' }],
  bath: [[
    '..b...bb.....', '.bwb.bwwb.b..', '..b...bb.bwb.', 'ttttttttttttt', '.tWWWWWWWWWt.', '.tWWWWWWWWWt.',
    '..tWWWWWWWt..', '..f.......f..',
  ], { b: '#bfe9fb', w: '#ffffff', t: '#9fd8f0', W: '#e8f8ff', f: '#c9a24b' }],
  vitamin: [[
    '..ccccc..', '..ccccc..', '.bbbbbbb.', '.bwbbbbb.', '.bLLLLLb.', '.bLLrLLb.', '.bLrrrLb.',
    '.bLLrLLb.', '.bLLLLLb.', '.bbbbbbb.', '.bbbbbbb.',
  ], { c: '#f0663c', b: '#f6c46a', w: '#fff3cc', L: '#ffffff', r: '#e84a5f' }],
  ball: [[
    '..rrryy..', '.rwrryyy.', 'rrrrryyyy', 'rrrrryyyy', 'bbbbbgggg', 'bbbbbgggg', '.bbbbggg.', '..bbbgg..',
  ], { r: '#e84a5f', y: '#ffd75e', b: '#4f8fd6', g: '#6dbb5a', w: '#ffffff' }],
  yarn: [[
    '...ppppp...', '.ppPPpppp..', 'ppppPPpppp.', 'pPpppPPppp.', 'ppPpppPPpp.', 'pppPpppPpp.', '.pppPpppPp.',
    '..ppppppp..', '........pp.', '.........pp',
  ], { p: '#c79bf2', P: '#9a6bd0' }],
  kite: [[
    '.....r.....', '....rry....', '...rrryy...', '..rrrryyy..', '.rrrrryyyy.', 'rrrrrryyyyy', '.bbbbbgggg.',
    '..bbbbggg..', '...bbbgg...', '....bbg....', '.....s.....', '......s....', '.....s.....',
  ], { r: '#e84a5f', y: '#ffd75e', b: '#4f8fd6', g: '#6dbb5a', s: '#8a5a35' }],
};

// Trứng ngũ hành: cùng một dáng trứng, vỏ và đốm theo màu hành.
const EGG_ROWS = ['...eee...', '..eeeee..', '.eheeeee.', '.eheesse.', 'eeeeessee', 'esseeeeee', 'esseeeese', 'eeeeeesse', '.eeeeeee.', '..eeeee..'];
const EGG_SHELL = { kim: '#f4f1ea', moc: '#eef7dd', thuy: '#e8f4fc', hoa: '#fff0dc', tho: '#fbf0dc' };
for (const [el, e] of Object.entries(ELEMENTS)) ICONS[`egg_${el}`] = [EGG_ROWS, { e: EGG_SHELL[el], s: e.color, h: '#ffffff' }];

const cache = new Map();

/** Ảnh pixel của món `id`: { url, w, h } ở độ phân giải gốc, hoặc null nếu món chưa có hình. */
export function itemArt(id) {
  if (!cache.has(id)) {
    let canvas = null;
    if (ICONS[id]) canvas = bitmap(ICONS[id][0], ICONS[id][1], OUTLINE);
    else canvas = wearImage(id);
    cache.set(id, canvas && { url: canvas.toDataURL(), w: canvas.width, h: canvas.height });
  }
  return cache.get(id);
}

/** Thẻ <img> của món đồ phóng `px` lần; món chưa có hình thì trả về emoji. */
export function itemIcon(item, px = 4) {
  const a = item && itemArt(item.id);
  if (!a) return item?.icon ?? '';
  return `<img class="px-icon" src="${a.url}" alt="" width="${a.w * px}" height="${a.h * px}" />`;
}
