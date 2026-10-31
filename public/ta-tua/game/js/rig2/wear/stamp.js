// Đồ đeo vẽ từ DỮ LIỆU (gói vẽ phase 2, WEAR-SPEC): mỗi món là hình dán theo hướng S/E/N (W = lật cả khung E),
// thêm "small" (bé sơ sinh, nhí nhố) hoặc "big" (đồ mặt, giai đoạn mắt to). Dữ liệu sinh ra ở wear/data/<khe>.js bởi
// scripts/art/build-wear.mjs; file này giữ LUẬT ĐẶT của từng khe, đúng như bộ xem trước của họa sĩ (hw.py, common.py
// place_xy, neckprev.py render(), preview.py, wl.py). Chủ sở hữu: dev.
//
// Luật chung
//  - Hình dán vẽ KHÔNG có viền ngoài; ở đây thêm viền 1 px #2e1d14 (4 hướng) quanh hình. Đồ mặt viền theo bóng ngoài
//    thôi: lỗ kín (tròng kính, lỗ mắt mặt nạ) để trống cho thấy mắt (báo cáo khe mặt, luật 1). Các khe khác viền cả lỗ kín
//    (ngọc bội, đồng xu, nan quạt: báo cáo khe cổ luật 4, khe bùa), đúng pad_outline của rig2.py.
//  - "pivot" là điểm ảnh của hình rơi đúng điểm neo của khe ở khung này (ctx.sk.anchors), làm tròn theo từng khe:
//      đầu  : (floor(x + .5), floor(y + .5)) của neo đầu; món có `lag` (vầng hào quang) trễ sau đầu tối đa chừng ấy px
//             khi bé nhảy lên (lag 2: vòng vẫn lơ lửng cách đầu 1 px ở đỉnh cú nhảy). Món KHÔNG bị đẩy xuống khi nhảy:
//             nhảy cao mà đỉnh mũ chạm mép trên thì renderFrame (index.js) hạ cả cú nhảy, bé và mũ lên xuống cùng nhau.
//      mặt  : theo Ô MẮT, không theo neo thô: Y = floor(eyeY − eh/2 + .5) (hàng trên của mắt, mắt 2×3 hoặc 3×4);
//             X = pyRound(neo mặt x) ở S/N, floor(neo mặt x − ew/2 + .5) ở E; X += pose.look ở S và E (mắt liếc thì kính
//             liếc theo), không ở N.
//      cổ   : (floor(x + .5), floor(y + .5)) của neo cổ; cằm che (ctx.chin) xóa cả hình lẫn viền ở S/E; E lay đuôi khăn:
//             các hàng `flutter` của hướng E dời dọc pose.flutter px (WEAR-SPEC D3).
//      lưng : (floor(x), floor(y)) của neo lưng; "over" (WEAR-SPEC D1: quai ba lô, dây áo choàng ôm trước ngực) đặt
//             cùng neo, vẽ SAU thân pet (trước khăn, kính, mũ), có viền riêng, cằm che.
//      bùa  : (pyRound(x), pyRound(y)) của neo bùa, nhún xuống 1 px khi tick % 4 ≥ 2.
//  - "layer": front (vẽ trên pet), behind (vẽ dưới pet), behindNfront (dưới pet ở S/E, trên pet ở N). index.js đọc
//    entry.layer cho MỌI khe (WEAR-SPEC D6). Thêm (bảng của build-wear.mjs): `drape` (áo choàng, áo tơi: thú bốn chân
//    nhìn ngang thì vẽ TRÊN pet, WEAR-SPEC D4), `openTop` (món đầu chừa đỉnh đầu: ctx.headTopCovered = false), `icon`
//    (hướng của hình túi đồ khi không phải S).
//  - An toàn: món lưng, cổ, bùa không thò xuống dưới hàng chân (cắt và viền lại mép cắt; bùa thì nâng lên), món lưng và
//    bùa không chạm mép trái/phải. Các chốt này CÓ đổi vài điểm ảnh trên 4 loài mẫu: hàng cuối của huy chương "small"
//    (S) và đuôi khăn quàng "small" (N) ở bé sơ sinh chạm hàng chân nên bị cắt và viền lại (1-2 px; họa sĩ khe cổ có thể
//    rút ngắn một hàng để chốt không còn tác dụng).
import { FH, FW, INK, blit, newBuf, outline, pyRound, stamp } from '../core.js';
import { blitClipped } from './common.js';

/** Viền ngoài chuẩn (rig2.py pad_outline): nới 1 px rồi viền 4 hướng, lỗ kín cũng thành viền. */
function padRing(src) {
  const big = newBuf(src.w + 2, src.h + 2);
  blit(big, src, 1, 1);
  return outline(big, INK);
}

/** Viền chỉ theo bóng ngoài: điểm trong suốt bị bao kín (không loang ra được tới mép) vẫn trong suốt. */
export function outerOutline(src) {
  const big = newBuf(src.w + 2, src.h + 2);
  blit(big, src, 1, 1);
  const { w, h } = big;
  const solid = (k) => big.data[k * 4 + 3] !== 0;
  // Loang từ góc (0, 0) của khung đã nới qua các điểm trong suốt: điểm loang tới là "bên ngoài".
  const outside = new Uint8Array(w * h);
  const stack = [0];
  outside[0] = 1;
  while (stack.length) {
    const k = stack.pop();
    const x = k % w;
    const y = (k - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (outside[n] || solid(n)) continue;
      outside[n] = 1;
      stack.push(n);
    }
  }
  const ring = outline(big, INK);
  for (let k = 0; k < w * h; k++) if (!solid(k) && !outside[k]) ring.data.fill(0, k * 4, k * 4 + 4);
  return ring;
}

/** Hàng `flutter` = [a, b] dời dọc f px (−1..1); thêm 1 hàng trống trên/dưới nên chốt y + 1. Điểm cố định đè điểm dời. */
export function flutterRows(rows, [a, b], f) {
  const w = rows[0].length;
  const blank = '.'.repeat(w);
  const out = [blank, ...rows.map((r, j) => (j >= a && j <= b ? blank : r)), blank];
  for (let j = a; j <= b; j++) {
    const t = j + 1 + f;
    out[t] = [...out[t]].map((c, i) => (c === '.' || c === ' ' ? rows[j][i] : c)).join('');
  }
  return out;
}

/** Bộ hình của khung này: 'big' (đồ mặt, mắt to) hoặc 'small' (bé sơ sinh, nhí nhố = sk.big) nếu món có, không thì 'views'. */
export function variantOf(slot, item, sk) {
  if (sk.big && slot === 'face' && item.big) return 'big';
  if (sk.big && slot !== 'face' && item.small) return 'small';
  return 'views';
}

const cache = new Map();
/** Hình đã viền { pic, pivot: [x, y] trong hình đã viền } của một hướng (lưu sẵn). */
function outlined(slot, id, vn, view, part, vd, keys, f) {
  const key = `${slot}|${id}|${vn}|${view}|${part}|${f}`;
  if (!cache.has(key)) {
    const rows = f ? flutterRows(vd.rows, vd.flutter, f) : vd.rows;
    const raw = stamp(rows, keys);
    const pic = slot === 'face' ? outerOutline(raw) : padRing(raw);
    cache.set(key, { pic, pivot: [vd.pivot[0] + 1, vd.pivot[1] + 1 + (f ? 1 : 0)] });
  }
  return cache.get(key);
}

/**
 * Điểm ảnh (nguyên) mà chốt của hình rơi vào, theo luật của khe (ctx: sk, view, pose của khung). wearIcon (index.js)
 * dùng đúng điểm này làm chốt của hình túi đồ, để bé khách mời Petdex đặt món y như khi vẽ lên pet.
 */
export function anchorPixel(slot, ctx) {
  const { sk, view, pose } = ctx;
  const [ax, ay] = sk.anchors[slot];
  if (slot === 'face') {
    const [ew, eh] = sk.big ? [3, 4] : [2, 3];
    let x = view === 'E' ? Math.floor(ax - ew / 2 + 0.5) : pyRound(ax);
    if (view !== 'N') x += Math.round(pose?.look ?? 0);
    return [x, Math.floor(sk.eyeY - eh / 2 + 0.5)];
  }
  if (slot === 'back') return [Math.floor(ax), Math.floor(ay)];
  if (slot === 'charm') return [pyRound(ax), pyRound(ay)];
  return [Math.floor(ax + 0.5), Math.floor(ay + 0.5)];
}

const groundRow = (ctx) => pyRound(ctx.sk.ground);

/**
 * Vẽ phần `part` ('main' hoặc 'over') của món `id` (dữ liệu `item`) ở khe `slot` lên `img`, theo ctx của khung.
 * Trả về true nếu đã vẽ (hướng này có hình).
 */
export function drawItem(slot, id, item, ctx, img, part = 'main') {
  const { view: v, pose = {} } = ctx;
  const vn = variantOf(slot, item, ctx.sk);
  let vd = item[vn]?.[v];
  if (part === 'over') vd = vd?.over;
  if (!vd) return false;
  const f = v === 'E' && vd.flutter ? Math.max(-1, Math.min(1, Math.round(pose.flutter ?? 0))) : 0;
  const { pic, pivot } = outlined(slot, id, vn, v, part, vd, item.keys, f);
  const [px, py] = anchorPixel(slot, ctx);
  let x = px - pivot[0];
  let y = py - pivot[1];
  if (slot === 'head') {
    // Vầng hào quang trễ sau đầu khi nhảy. Không đẩy món xuống ở đây: renderFrame hạ cả cú nhảy nếu đỉnh món chạm mép.
    if (item.lag) y += Math.min(item.lag, Math.max(0, -Math.round(pose.lift ?? 0)));
    blit(img, pic, x, y);
  } else if (slot === 'face') {
    blit(img, pic, x, y);
  } else {
    const maxY = groundRow(ctx);
    if (slot === 'charm') {
      y = Math.min(y, maxY - pic.h);
      if (ctx.tick % 4 >= 2) y += 1;
    }
    if (slot === 'back' || slot === 'charm') x = Math.min(Math.max(x, 1), FW - 1 - pic.w);
    const mask = (slot === 'neck' || part === 'over') && v !== 'N' ? ctx.chin : null;
    blitClipped(img, pic, x, y, { maxY: Math.min(maxY, FH - 2), mask });
  }
  return true;
}

/** Món này có phần "over" (WEAR-SPEC D1) ở hướng nào không. */
export const hasOver = (item) => ['views', 'small', 'big'].some((vn) => ['S', 'E', 'N'].some((v) => item[vn]?.[v]?.over));

/**
 * Mục sổ đăng ký cho món có dữ liệu: { S, E, N, layer, earsOver, drape, openTop, icon, over?, data }.
 * index.js đọc `layer` (vẽ dưới hay trên pet ở hướng này), `drape` (thú bốn chân nhìn ngang: vẽ trên pet, D4), gọi
 * `over` ngay sau pet, `earsOver` (khe đầu, chỉ hướng S, loài tai mèo hai bên đầu: vẽ lại tai lên trên mũ chóp, mũ nồi,
 * mũ lưỡi trai), `openTop` (món đầu chừa đỉnh đầu) và `icon` (hướng vẽ hình túi đồ, mặc định S).
 */
export function dataEntry(slot, id, item) {
  const draw = (ctx, img) => {
    drawItem(slot, id, item, ctx, img, 'main');
  };
  const entry = {
    S: draw, E: draw, N: draw, layer: item.layer, earsOver: Boolean(item.earsOver), drape: Boolean(item.drape),
    openTop: Boolean(item.openTop), icon: item.icon ?? 'S', data: item,
  };
  if (hasOver(item)) entry.over = (ctx, img) => drawItem(slot, id, item, ctx, img, 'over');
  return entry;
}

/** Xóa bộ nhớ đệm hình đã viền (kiểm thử). */
export const clearStampCache = () => cache.clear();
