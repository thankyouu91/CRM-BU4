// Khe MẶT (11 món): kính, mặt nạ, kính một mắt... Chủ sở hữu: họa sĩ đồ đeo mặt.
// Mỗi món { S(ctx, img), E(ctx, img), N(ctx, img) } (xem wear/common.js). Luật của bản mẫu: vẽ theo Ô MẮT mà bộ xương biết:
// tâm mắt (S: ctx.sk.head[0] ± ctx.sk.eyeDx; E: ctx.sk.anchors.face[0]), hàng mắt ctx.sk.eyeY, cỡ mắt 2×3
// (3×4 khi ctx.sk.big, bé sơ sinh và nhí nhố). Mắt phải còn thấy: tròng kính là vòng trong, không tô kín.
// Nhìn ngang: mắt gần + gọng tới tai. Nhìn sau: chỉ hai đầu gọng ló ở hai bên đầu. Vẽ trên khăn và cốc, dưới mũ.
// glasses: port nguyên từ pets-pilot (khớp từng điểm ảnh). Món khác: hình cũ của rig.js (LEGACY): nguyên hình ở hướng S,
// nửa gần của hình S ở hướng E (mắt phải của hình đặt lên mắt gần), không có ở hướng N (wear/common.js legacyEntry).
import { putPixels, pyRound } from '../core.js';
import { legacyEntry } from './common.js';

/** Ô mắt của khung hình: { ew, eh, y0 } (y0 = hàng trên cùng của mắt). */
export function eyeBox(sk) {
  const [ew, eh] = sk.big ? [3, 4] : [2, 3];
  return { ew, eh, y0: Math.floor(sk.eyeY - eh / 2 + 0.5) };
}

/** Kính tròn: gọng nâu đậm, tròng trong (vòng xanh nhạt sát gọng), điểm lóa trên-trái không đè con ngươi. */
function glassesAt(ctx, img) {
  const F = '#3d2a1f';
  const gl = '#eef8fb';
  const tint = '#bfe3f2';
  const { sk, view } = ctx;
  const [hcx, , hrx] = sk.head;
  const { ew, eh, y0 } = eyeBox(sk);
  const pts = [];
  const ring = (ex) => {
    const x0 = Math.floor(ex - ew / 2 + 0.5);
    const [L, R, T, B] = [x0 - 2, x0 + ew + 1, y0 - 1, y0 + eh];
    for (let x = L + 1; x < R; x++) pts.push([x, T, F], [x, B, F]);
    for (let y = T + 1; y < B; y++) pts.push([L, y, F], [R, y, F], [L + 1, y, tint], [R - 1, y, tint]);
    pts.push([L + 1, T + 1, gl]);
    return [L, R, T];
  };
  const edgeL = Math.floor(hcx - hrx + 0.5);
  const edgeR = Math.ceil(hcx + hrx - 0.5) - 1;
  if (view === 'S') {
    const [L1, R1, T] = ring(hcx - sk.eyeDx);
    const [L2, R2] = ring(hcx + sk.eyeDx);
    for (let x = R1 + 1; x < L2; x++) pts.push([x, T + 1, F]); // cầu kính
    for (let x = edgeL; x < L1; x++) pts.push([x, T + 1, F]); // gọng tới mép đầu
    for (let x = R2 + 1; x <= edgeR; x++) pts.push([x, T + 1, F]);
  } else if (view === 'E') {
    const [L1, , T] = ring(sk.anchors.face[0]);
    for (let x = pyRound(hcx - hrx * 0.35); x < L1; x++) pts.push([x, T + 1, F]); // gọng tới tai
  } else {
    const T = y0 - 1;
    pts.push([edgeL, T, F], [edgeL + 1, T, F], [edgeR, T, F], [edgeR - 1, T, F]); // hai đầu gọng ở hai bên đầu
  }
  putPixels(img, pts);
}

/** Sổ đăng ký khe mặt: mã món → mục vẽ. */
export const FACE = {
  glasses: { S: glassesAt, E: glassesAt, N: glassesAt },
};

/** Hình cũ của rig.js (chưa vẽ lại). pivot như rig.js: điểm neo mặt = giữa hàng mắt. */
export const LEGACY = {
  shades: { rows: ['###############', '#BwB#.....#BwB#', '.###.......###.'], pal: { '#': '#22202b', B: '#3d3a52', w: '#8f8aa8' }, pivot: [7, 1] },
  leafglasses: { rows: ['g###.......###g', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'], pal: { '#': '#4f9a3f', w: '#dff3c8', L: '#ffffff', g: '#8fdc7a' }, pivot: [7, 2] },
  heartglasses: { rows: ['.r.r.......r.r.', 'rprpr#####rprpr', 'rpppr.....rpppr', '.rpr.......rpr.', '..r.........r..'], pal: { r: '#e2493b', p: '#ffb3c1', '#': '#c8402f' }, pivot: [7, 2] },
  woodglasses: { rows: ['.###.......###.', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'], pal: { '#': '#8a5a35', w: '#f3e3c8', L: '#ffffff' }, pivot: [7, 2] },
  monocle: { rows: ['...........###.', '..........#wLw#', '..........#www#', '...........###.', '..........y....', '.........y.....'], pal: { '#': '#e0a21c', w: '#bfe0f5', L: '#ffffff', y: '#e0a21c' }, pivot: [7, 2] },
  partymask: { rows: ['rrrrrrrrrrrrrrr', 'rr...rrrrr...rr', 'rrr.rrrYrrr.rrr', '.rrrrr...rrrrr.'], pal: { r: '#a55fd0', Y: '#ffd75e' }, pivot: [7, 1] },
  starglasses: { rows: ['..y.........y..', '.yyy.......yyy.', 'yybyy#####yybyy', '.yyy.......yyy.', '.y.y.......y.y.'], pal: { y: '#ffd75e', b: '#4f8fd6', '#': '#e0a21c' }, pivot: [7, 2] },
  bandana: { rows: ['ggggggggggggggg', 'gg...ggggg...gg', 'ggggggggggggggg', '.............gG'], pal: { g: '#4f9a3f', G: '#8fdc7a' }, pivot: [7, 1] },
  goggles: { rows: ['..###.....###..', 'ss#gg#####gg#ss', '..#Lg#...#Lg#..', '..###.....###..'], pal: { '#': '#b87333', g: '#9fd8c0', L: '#ffffff', s: '#6b4a1f' }, pivot: [7, 2] },
  goldmask: { rows: ['yyyyyyyyyyyyyyy', 'yy...yyyyy...yy', 'yyy.yyyRyyy.yyy', '.yyyYy...yYyyy.', '..y.........y..'], pal: { y: '#e0a21c', Y: '#fff3b0', R: '#e2493b' }, pivot: [7, 1] },
};

export function faceFor(id) {
  if (FACE[id]) return FACE[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'face') : null;
}
