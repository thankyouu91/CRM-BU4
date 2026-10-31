// Đồ đeo, phần dùng chung cho 5 file khe (head, face, neck, back, charm). Chủ sở hữu: dev. Họa sĩ chỉ gọi, không sửa.
//
// Hợp đồng của một món trong sổ khe: { S(ctx, img), E(ctx, img), N(ctx, img) }.
//  - img: bộ đệm 48×48 đang ghép (core.js newBuf); vẽ thẳng lên đó bằng blit / setPx / putPixels.
//  - ctx.sk.anchors[khe] = [x, y] (số thực, tọa độ ô): điểm neo đã dịch theo dáng của khung hình này.
//  - ctx.view: 'S' | 'E' | 'N' (hướng 'W' được vẽ bằng 'E' rồi lật cả khung, đừng tự lật).
//  - ctx.pose, ctx.tick (số khung, cho món đung đưa), ctx.sk (đầu, thân, mắt: xem skeleton.js), ctx.chin (mặt nạ cằm, khe cổ).
// Món chưa vẽ lại dùng hình cũ của rig.js (LEGACY trong từng file khe), đã ép về bảng màu và viền #2e1d14:
//  hiện đủ ở hướng S; hướng E/N theo luật của từng khe (xem legacyEntry), không bao giờ lỗi.
import { INK, nearestPalette, padOutline, pyRound, stamp, blit } from '../core.js';

const cache = new Map();

/** Hình cũ đã khóa màu và viền: { img, pivot } (pivot tính trên hình đã viền). */
export function legacyImage(id, def) {
  if (!cache.has(id)) {
    const keys = Object.fromEntries(Object.entries(def.pal).map(([k, v]) => [k, nearestPalette(v)]));
    cache.set(id, { img: padOutline(stamp(def.rows, keys), INK), pivot: [def.pivot[0] + 1, def.pivot[1] + 1] });
  }
  return cache.get(id);
}

/**
 * Góc trên-trái để dán hình cũ `def` ở khe `slot` (luật đặt đồ của rig.js cũ): điểm `pivot` của hình trùng điểm neo;
 * món đội đầu lún `sink` pixel và lệch `side` × nửa bề ngang đầu; `dx` dời ngang.
 */
export function legacySpot(def, slot, anchors, headRx) {
  const [ax, ay] = Array.isArray(anchors[slot]) ? anchors[slot] : [anchors[slot].x, anchors[slot].y];
  let x = ax + (def.dx ?? 0);
  let y = ay;
  if (slot === 'head') {
    x += (def.side ?? 0) * headRx;
    y += def.sink ?? 2;
  }
  return [pyRound(x) - def.pivot[0] - 1, pyRound(y) - def.pivot[1] - 1];
}

/** Dán hình cũ của món `id` tại điểm neo khe `slot` của khung hình (dy: đung đưa). */
export function drawLegacy(id, def, slot, ctx, img, dy = 0) {
  const { img: pic } = legacyImage(id, def);
  const [x, y] = legacySpot(def, slot, ctx.sk.anchors, ctx.sk.head[2]);
  blit(img, pic, x, y + dy);
}

/**
 * Mục sổ đăng ký cho món chưa vẽ lại. `views`: các hướng vẫn dán hình S cũ (mặc định chỉ 'S').
 * Luật theo khe: head S/E/N (mũ nhìn đâu cũng giống); face chỉ S; neck chỉ S; back S và N (cánh, áo choàng nhìn sau vẫn đúng); charm cả 3.
 */
export function legacyEntry(id, def, slot, views = ['S']) {
  const draw = (v) => (views.includes(v) ? (ctx, img) => drawLegacy(id, def, slot, ctx, img, slot === 'charm' && ctx.tick % 4 >= 2 ? 1 : 0) : () => {});
  return { S: draw('S'), E: draw('E'), N: draw('N'), legacy: true, icon: () => legacyImage(id, def).img };
}
