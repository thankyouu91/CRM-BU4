// Đồ đeo, phần dùng chung cho 5 file khe (head, face, neck, back, charm). Chủ sở hữu: dev. Họa sĩ chỉ gọi, không sửa.
// Từ gói vẽ phase 2, cả 55 món vẽ từ DỮ LIỆU (wear/data/*.js, luật đặt ở wear/stamp.js). File này giữ đường DỰ PHÒNG:
// hình cũ của rig.js (LEGACY trong từng file khe) cho món nào chưa có dữ liệu, và blitClipped (dùng chung cho cả hai).
//
// Hợp đồng của một món trong sổ khe: { S(ctx, img), E(ctx, img), N(ctx, img) }.
//  - img: bộ đệm 48×48 đang ghép (core.js newBuf); vẽ thẳng lên đó bằng blit / setPx / putPixels.
//  - ctx: đủ trường như mọi hàm trong sổ đăng ký (index.js makeCtx, ARTIST-GUIDE mục 4), kể cả khi wearIcon vẽ hình
//    biểu tượng cho túi đồ (lúc đó ctx.chin = null). Hay dùng nhất:
//    ctx.sk.anchors[khe] = [x, y] (số thực, tọa độ ô): điểm neo đã dịch theo dáng của khung hình này;
//    ctx.view: 'S' | 'E' | 'N' (hướng 'W' được vẽ bằng 'E' rồi lật cả khung, đừng tự lật);
//    ctx.pose, ctx.tick (số khung, cho món đung đưa), ctx.sk (đầu, thân, mắt, mặt đất: xem skeleton.js), ctx.ramps,
//    ctx.chin (mặt nạ cằm, khe cổ; null ở hướng N và trong wearIcon).
//  - Hình biểu tượng (túi đồ, cửa hàng, bé khách mời) luôn là hình S của món, do wearIcon() trong index.js tự cắt.
// Món chưa có dữ liệu dùng hình cũ của rig.js (LEGACY trong từng file khe), đã ép về bảng màu và viền #2e1d14,
// hiện ở cả S và E (W = E lật) để bé đi bộ trong công viên vẫn mặc đủ đồ đã mua; luật từng khe xem legacyEntry.
// Món lưng, cổ, bùa không bao giờ thò xuống dưới mặt đất (ctx.sk.ground): bé sơ sinh và nhí nhố người thấp; món lưng và
// bùa không chạm mép trái/phải của ô.
import { FW, FH, INK, nearestPalette, padOutline, pyRound, rgb, stamp } from '../core.js';

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
 * Nửa gần của hình mặt cũ cho hướng ngang: các cột từ cột chốt sang phải (mắt bên phải hình S + nửa cầu kính, đọc như
 * gọng chạy về tai), viền lại cho kín mép cắt. { img, pivot } như legacyImage (cột chốt là cột 1 của hình đã viền).
 */
export function legacyHalf(id, def) {
  const key = `${id}|half`;
  if (!cache.has(key)) {
    const keys = Object.fromEntries(Object.entries(def.pal).map(([k, v]) => [k, nearestPalette(v)]));
    const rows = def.rows.map((r) => r.slice(def.pivot[0]));
    cache.set(key, { img: padOutline(stamp(rows, keys), INK), pivot: [1, def.pivot[1] + 1] });
  }
  return cache.get(key);
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

/**
 * Dán `pic` lên `img` tại (x, y), chỉ chép điểm đục, với hai giới hạn tùy chọn:
 * - maxY: bỏ mọi điểm dưới hàng maxY; điểm ở đúng hàng maxY mà bên dưới (trong hình) còn điểm thì tô viền #2e1d14,
 *   để mép bị cắt vẫn kín viền (áo choàng chạm đất như bàn chân);
 * - mask: bỏ mọi điểm nằm trong mặt nạ (cằm che dải cổ).
 */
export function blitClipped(img, pic, x, y, { maxY = FH - 1, mask = null } = {}) {
  const ink = rgb(INK);
  for (let j = 0; j < pic.h; j++) {
    const ty = y + j;
    if (ty < 0 || ty >= FH || ty > maxY) continue;
    for (let i = 0; i < pic.w; i++) {
      const tx = x + i;
      const s = (j * pic.w + i) * 4;
      if (!pic.data[s + 3] || tx < 0 || tx >= FW || (mask && mask[ty * FW + tx])) continue;
      const cut = ty === maxY && j + 1 < pic.h && pic.data[s + pic.w * 4 + 3];
      const d = (ty * FW + tx) * 4;
      for (let c = 0; c < 3; c++) img.data[d + c] = cut ? ink[c] : pic.data[s + c];
      img.data[d + 3] = 255;
    }
  }
}

/** Hàng thấp nhất món lưng/cổ/bùa được chạm: hàng viền dưới chân của khung này. */
const groundRow = (ctx) => pyRound(ctx.sk.ground);

/** Dán hình cũ của món `id` tại điểm neo khe `slot` của khung hình (dy: đung đưa). */
export function drawLegacy(id, def, slot, ctx, img, dy = 0) {
  const { img: pic } = legacyImage(id, def);
  let [x, y] = legacySpot(def, slot, ctx.sk.anchors, ctx.sk.head[2]);
  if (slot === 'head') {
    blitClipped(img, pic, x, y + dy);
    return;
  }
  const maxY = groundRow(ctx);
  // Bùa lơ lửng: thấp quá thì nâng lên cho cả nhịp đung đưa (thêm 1 px) vẫn ở trên mặt đất, thay vì cắt tua.
  if (slot === 'charm') y = Math.min(y, maxY - pic.h);
  // Cánh rộng 30 điểm ảnh: ở hướng ngang điểm neo lưng lùi về sau thân (thú bốn chân thân dài) nên dịch vào cho khỏi chạm mép ô.
  if (slot === 'back' || slot === 'charm') x = Math.min(Math.max(x, 1), FW - 1 - pic.w);
  blitClipped(img, pic, x, y + dy, { maxY, mask: slot === 'neck' && ctx.view === 'E' ? ctx.chin : null });
}

/**
 * Hướng ngang (E) của món mặt cũ: nửa gần của hình S (legacyHalf), đặt sao cho mắt phải của hình S trùng mắt gần
 * (ctx.sk.anchors.face): cột chốt lùi về phía tai đúng ctx.sk.eyeDx, như khoảng cách chốt → mắt ở hướng S.
 */
export function drawLegacyFaceE(id, def, ctx, img) {
  const { img: pic } = legacyHalf(id, def);
  const [fx, fy] = ctx.sk.anchors.face;
  blitClipped(img, pic, pyRound(fx - ctx.sk.eyeDx + (def.dx ?? 0)) - 1, pyRound(fy) - def.pivot[1] - 1);
}

/**
 * Mục sổ đăng ký cho món chưa vẽ lại (hình cũ của rig.js), đủ 3 hướng theo khe:
 *  - head:  hình S ở cả S/E/N (mũ nhìn đâu cũng giống);
 *  - face:  S nguyên hình; E nửa gần (drawLegacyFaceE); N không thấy;
 *  - neck:  S nguyên hình; E hình S tại điểm neo cổ của hướng ngang, cằm che như khăn (ctx.chin); N không thấy;
 *  - back:  hình S ở cả S/E/N (S/E nằm sau pet nên chỉ lộ mép cánh, mép áo choàng; N đè lên lưng);
 *  - charm: hình S ở cả 3 hướng, đung đưa 1 px theo ctx.tick.
 * Món lưng, cổ, bùa không thò xuống dưới mặt đất (drawLegacy). `def` để wearIcon / wearSpotAt đọc side, dx.
 */
export function legacyEntry(id, def, slot) {
  const at = (ctx, img) => drawLegacy(id, def, slot, ctx, img, slot === 'charm' && ctx.tick % 4 >= 2 ? 1 : 0);
  const skip = () => {};
  const E = slot === 'face' ? (ctx, img) => drawLegacyFaceE(id, def, ctx, img) : at;
  const N = slot === 'face' || slot === 'neck' ? skip : at;
  return { S: at, E, N, legacy: true, def };
}
