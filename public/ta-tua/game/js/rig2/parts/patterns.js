// Hoa văn lông: sổ đăng ký theo `pattern` của loài (belly, spots, stripes, mask, patch, scales, shell). Chủ sở hữu: họa sĩ hoa văn.
// Mỗi mục { S, E, N } nhận ctx; thêm bộ phận tô bóng (ctx.parts) hoặc điểm (ctx.pixels, z 16).
// Bụng màu sáng do dáng khung (archetypes/*) vẽ sẵn cho mọi loài; ở đây chỉ thêm phần riêng của hoa văn.
//  - belly: vằn trán mèo (loài tai mèo), port nguyên từ pets-pilot (khớp từng điểm ảnh).
//  - spots, stripes, mask, patch, scales, shell: HÌNH TẠM (chưa vẽ lại theo bản mẫu), dựng nhanh từ rig.js cũ, đã khóa màu.
//    patch (gấu trúc) đã chỉnh lại sau soát: mảng mắt to nghiêng, đi cùng tai đen (parts/ears.js) và tay chân đen (ramps.js limb).
import { RAMPS, mAnd, mEllipse, mOr, mAndNot, part, pyRound } from '../core.js';

const none = () => {};

/** Vằn trán của loài tai mèo: hai vạch 3 điểm, bậc tối của dải thân. */
function tabby(ctx) {
  const { sp, sk, view } = ctx;
  if (sp.ears !== 'cat' || view === 'N') return;
  const lc = RAMPS[ctx.ramps.main][1];
  const [hcx] = sk.head;
  const ty = pyRound(sk.htop) + 2;
  const xs = view === 'S' ? [pyRound(hcx) - 3, pyRound(hcx) + 2] : [pyRound(hcx) - 2, pyRound(hcx) + 1];
  for (const x of xs) ctx.pixels.push([x, ty, lc, 16], [x, ty + 1, lc, 16], [x, ty + 2, lc, 16]);
}

/** Mảng màu điểm nhấn trên thân, cắt theo thân (nhóm 'body', không kẻ nét trong). */
function onBody(ctx, name, m) {
  const [bcx, bcy, brx, bry] = ctx.sk.body;
  const body = mEllipse(bcx, bcy, brx, bry);
  ctx.parts.push(part(name, mAnd(body, m), ctx.ramps.accent, 4.2, { group: 'body', normal: [bcx - 0.5, bcy - 1, brx + 1, bry + 1.5], line: false }));
}
/** Mảng màu điểm nhấn trên đầu, cắt theo đầu (nhóm 'head'). */
function onHead(ctx, name, m) {
  ctx.parts.push(part(name, mAnd(ctx.headMask, m), ctx.ramps.accent, ctx.zh + 0.15, { group: 'head', normal: ctx.hnrm, line: false }));
}

// ---- đốm (hươu, nhím, tê giác): ba đốm trên thân, một đốm trên trán
function spots(ctx) {
  const { sk, view } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const [hcx, , hrx] = sk.head;
  const pts = view === 'E' ? [[-0.5, -0.3], [0.1, -0.5], [0.55, -0.2]] : [[-0.55, -0.3], [0.5, -0.1], [-0.25, 0.4]];
  onBody(ctx, 'spots', mOr(...pts.map(([dx, dy]) => mEllipse(bcx + dx * brx, bcy + dy * bry, 1.2, 1.1))));
  if (view !== 'N') onHead(ctx, 'headspot', mEllipse(hcx - hrx * 0.45, sk.htop + 3.2, 1.3, 1.1));
}

// ---- vằn (hổ): vạch ngang hai bên hông và ba vạch trên trán
function stripes(ctx) {
  const { sk, view } = ctx;
  const [bcx, bcy, brx] = sk.body;
  const [hcx, , hrx] = sk.head;
  const ms = [];
  for (const s of view === 'E' ? [-1, 0.2] : [-1, 1]) {
    for (const k of [0, 1]) ms.push(mEllipse(bcx + s * (brx - 1.2), bcy - 1.5 + k * 2.6, 1.8, 0.6));
  }
  onBody(ctx, 'stripes', mOr(...ms));
  const top = sk.htop;
  const xs = view === 'E' ? [hcx - 2, hcx + 1] : [hcx - 3, hcx, hcx + 3];
  onHead(ctx, 'headstripes', mOr(...xs.map((x) => mEllipse(x + 0.5, top + 1.8, 0.6, 1.4))));
  if (view === 'S') onHead(ctx, 'cheekstripes', mOr(mEllipse(hcx - hrx + 1.2, ctx.sk.eyeY + 1, 1.2, 0.5), mEllipse(hcx + hrx - 1.2, ctx.sk.eyeY + 1, 1.2, 0.5)));
}

// ---- mặt nạ quanh mắt (gấu mèo đỏ, sói, lân)
function eyeMask(ctx, rx, ry) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [hcx] = sk.head;
  const { eyeY, eyeDx } = sk;
  const m = view === 'S' ? mOr(mEllipse(hcx - eyeDx, eyeY + 0.3, rx, ry), mEllipse(hcx + eyeDx, eyeY + 0.3, rx, ry)) : mEllipse(sk.anchors.face[0], eyeY + 0.3, rx, ry);
  onHead(ctx, 'mask', m);
}

// ---- mảng mắt gấu trúc: hai mảng bầu dục to, nghiêng ra ngoài (đáy chếch về phía má), màu điểm nhấn bậc 1 cố định
// (flat: không tô bóng; dải charcoal bậc 1 = #3d2a1f, tối như tai và tay chân nhưng không trùng màu viền #2e1d14);
// mắt và đốm sáng của mắt nằm trên mảng.
function pandaPatches(ctx) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [hcx] = sk.head;
  const { eyeY, eyeDx } = sk;
  const [rx, ry, tilt] = sk.big ? [3.0, 3.5, 0.4] : [2.8, 3.2, 0.4];
  const at = (x, s) => mEllipse(x, eyeY + 0.4, rx, ry, -s * tilt);
  const m = view === 'S' ? mOr(at(hcx - eyeDx, -1), at(hcx + eyeDx, 1)) : at(sk.anchors.face[0], -1);
  ctx.parts.push(part('patch', mAnd(ctx.headMask, m), ctx.ramps.accent, ctx.zh + 0.15, { group: 'head', flat: 1, line: false }));
}

// ---- vảy (tê tê, rồng): chấm sáng xen kẽ trên thân
function scales(ctx) {
  const { sk } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const L = RAMPS[ctx.ramps.main][3];
  for (let y = Math.ceil(bcy - bry + 1); y < bcy + bry - 1; y += 2) {
    for (let x = Math.ceil(bcx - brx + 2); x < bcx + brx - 1; x += 3) {
      const xx = x + ((y >> 1) & 1);
      const dx = (xx + 0.5 - bcx) / brx;
      const dy = (y + 0.5 - bcy) / bry;
      if (dx * dx + dy * dy < 0.7) ctx.pixels.push([xx, y, L, 16]);
    }
  }
}

// ---- mai (rùa): mai lớn sau thân, màu điểm nhấn, vân sáng
function shell(ctx) {
  const { sk, view } = ctx;
  const [bcx, bcy, brx, bry] = sk.body;
  const m = mEllipse(bcx - (view === 'E' ? 0.5 : 0), bcy - 1.2, brx + 1.6, bry + 1.4);
  const z = view === 'N' ? 4.5 : 3.9;
  ctx.parts.push(part('shell', view === 'N' ? m : mAndNot(m, mEllipse(bcx, bcy + 1.2, brx - 1.2, bry - 0.6)), ctx.ramps.accent, z, {
    normal: [bcx - 1, bcy - 2.5, brx + 2.6, bry + 2.4],
  }));
  const L = RAMPS[ctx.ramps.accent][3];
  const spotsAt = view === 'E' ? [[-3, -3], [1, -4], [-1, -1]] : [[-4, -3], [0, -4], [4, -3]];
  for (const [dx, dy] of spotsAt) ctx.pixels.push([pyRound(bcx + dx), pyRound(bcy + dy), L, 16]);
}

const all = (fn) => ({ S: fn, E: fn, N: fn });

/** Sổ đăng ký: loại hoa văn → { S, E, N }. */
export const PATTERNS = {
  belly: all(tabby),
};

/** Hoa văn chưa vẽ lại theo bản mẫu: hình tạm, đã khóa màu, đủ 3 hướng. Vẽ xong thì chuyển vào PATTERNS. */
export const FALLBACK = {
  spots: all(spots),
  stripes: all(stripes),
  mask: all((ctx) => eyeMask(ctx, 2.8, 2.2)),
  patch: all(pandaPatches),
  scales: all(scales),
  shell: all(shell),
};

export const patternFor = (kind) => PATTERNS[kind] ?? FALLBACK[kind] ?? all(none);
