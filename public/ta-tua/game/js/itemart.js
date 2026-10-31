// Biểu tượng pixel cho đồ: Siêu thị, Túi đồ, trứng, Bếp, Sàn, Lò rèn, Vườn, Nhà máy.
// Thứ tự tìm hình của một id:
//   1. icon 16-bit 32x32 trong atlas assets/items/ (scripts/art/build-items.py, bảng khung ở itematlas.js);
//   2. hình pixel cũ (ICONS dưới đây, lưới 9-13 ô, viền nâu đậm, cùng độ thô với pet);
//   3. đồ đeo: chính hình vẽ lên người (rig.js);
//   4. không có hình: emoji của món (bộ icon js/icons vẽ lại emoji thành pixel).
import { ITEM_ATLAS } from './itematlas.js';
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

// Trang atlas chỉ vài KB: tải sẵn khi game mở để thẻ đồ đầu tiên đã có hình, không nháy
// (giữ tham chiếu tới ảnh để chúng không bị thu dọn giữa chừng).
const preloaded = typeof Image === 'function' ? ITEM_ATLAS.pages.map((p) => Object.assign(new Image(), { src: p.url })) : [];

/**
 * Ảnh pixel của món `id` ở độ phân giải gốc, hoặc null nếu món chưa có hình.
 * Icon atlas: { url (trang atlas), w, h, x, y, sheet: [rộng, cao trang] }; hình cũ: { url (data URL), w, h }.
 */
export function itemArt(id) {
  if (!cache.has(id)) {
    const f = Object.hasOwn(ITEM_ATLAS.frames, id) ? ITEM_ATLAS.frames[id] : null;
    let art = null;
    if (f && ITEM_ATLAS.pages[f[0]]) {
      const page = ITEM_ATLAS.pages[f[0]];
      art = { url: page.url, w: ITEM_ATLAS.size, h: ITEM_ATLAS.size, x: f[1], y: f[2], sheet: [page.w, page.h] };
    } else {
      const canvas = Object.hasOwn(ICONS, id) ? bitmap(ICONS[id][0], ICONS[id][1], OUTLINE) : wearImage(id);
      art = canvas && { url: canvas.toDataURL(), w: canvas.width, h: canvas.height };
    }
    cache.set(id, art);
  }
  return cache.get(id);
}

/**
 * HTML hình của món đồ (`item` cần `id`, và `icon` là emoji dự phòng); món chưa có hình thì trả về emoji.
 * - `scale`: icon atlas 32x32 phóng nguyên lần: 2 = 64 điểm (thẻ Siêu thị, Túi đồ, trứng), 1 = 32 điểm (danh sách).
 *   Thẻ <span> nền sprite, bù zoom của cả game (css .px-atlas) nên mỗi điểm ảnh ra đúng `scale` điểm màn hình.
 * - `px`: hệ số phóng của hình cũ (<img>, đồ đeo), giữ như trước: 4 ở thẻ, 3 ở danh sách chọn.
 * Hình chỉ để trang trí (tên món đã ghi bằng chữ bên cạnh) nên ẩn với trình đọc màn hình.
 */
export function itemIcon(item, px = 4, scale = px >= 4 ? 2 : 1) {
  const a = item && itemArt(item.id);
  if (!a) return item?.icon ?? '';
  if (a.sheet) {
    const s = Math.max(1, Math.round(scale));
    return `<span class="px-icon px-atlas" aria-hidden="true" style="width:${a.w * s}px;height:${a.h * s}px;`
      + `background-image:url('${a.url}');background-position:${-a.x * s}px ${-a.y * s}px;`
      + `background-size:${a.sheet[0] * s}px ${a.sheet[1] * s}px"></span>`;
  }
  return `<img class="px-icon" src="${a.url}" alt="" width="${a.w * px}" height="${a.h * px}" />`;
}
