// Khe CỔ (10 món): khăn, vòng, chuỗi, nơ cổ, cà vạt, huy chương... Chủ sở hữu: họa sĩ đồ đeo cổ.
// Mỗi món { S(ctx, img), E(ctx, img), N(ctx, img) } (xem wear/common.js). Luật của bản mẫu: dải quanh cổ rộng
// nửa bề ngang = max(3.2, min(thân rx − 0.5, đầu rx × 0.56)), nằm dưới cằm tại ctx.sk.anchors.neck; CẰM CHE DẢI:
// mọi điểm thuộc ctx.chin (mặt nạ đầu, chừa hàng cằm cuối) phải để trống. Phần buông: đuôi khăn phía trước (S),
// bay ra sau và phấp phới theo bước đi (E, ctx.pose.flutter), rủ xuống lưng (N).
// Thứ tự vẽ: sau thân pet, trước đồ cầm tay (cốc của Boba), kính và mũ.
// scarf: port nguyên từ pets-pilot (khớp từng điểm ảnh). Món khác: hình cũ của rig.js (LEGACY): hướng S, và hướng E tại
// điểm neo cổ của hướng ngang (cằm che như khăn); không có ở hướng N; không thò xuống dưới mặt đất (wear/common.js).
import { NPX, FW, RAMPS, mAbove, mAny, mBelow, mEllipse, mOr, mRightOf, newBuf, outline, setPx } from '../core.js';
import { legacyEntry } from './common.js';

/** Nửa bề ngang dải cổ theo cỡ thân và đầu của khung hình. */
export function bandHalf(sk) {
  const [, , brx] = sk.body;
  const [, , hrx] = sk.head;
  return Math.max(3.2, Math.min(brx - 0.5, hrx * 0.56));
}

/** Ghép lớp `piece` (đã viền) lên khung, chừa chỗ cằm che. */
export function underChin(ctx, img, piece) {
  const chin = ctx.chin;
  for (let k = 0; k < NPX; k++) {
    if (!piece.data[k * 4 + 3] || (chin && chin[k])) continue;
    for (let c = 0; c < 4; c++) img.data[k * 4 + c] = piece.data[k * 4 + c];
  }
}

const SCARF = RAMPS.red;

/** Khăn quàng đỏ: dải trơn ba bậc, đuôi khăn có tua kem. */
function scarf(ctx, img) {
  const { sk, view, pose } = ctx;
  const [nx, ny] = sk.anchors.neck;
  const half = bandHalf(sk);
  const yb = ny + 0.3;
  const flutter = pose.flutter ?? 0;
  const lay = new Uint8Array(NPX); // 0 trống, 1..3 bậc màu, 5 tua kem
  const band = view === 'E' ? mEllipse(nx, yb, Math.min(half, 4.6), 1.75, 0, 2.6) : mEllipse(nx, yb, half, 1.75, 0, 2.6);
  const up = mAbove(yb - 0.6);
  const down = mBelow(yb + 0.8);
  for (let k = 0; k < NPX; k++) if (band[k]) lay[k] = up[k] ? 3 : down[k] ? 1 : 2;
  let tail;
  if (view === 'S') {
    const tx = nx + half * 0.45;
    tail = mEllipse(tx + 0.3, yb + 2.6, 1.3, 2.4, -0.2);
  } else if (view === 'E') {
    const tx = nx - Math.min(half, 4.6) + 0.5;
    tail = mEllipse(tx - 2.0, yb + 1.4 + flutter, 2.8, 1.4, 0.35 - flutter * 0.25);
  } else {
    tail = mOr(mEllipse(nx - 0.9, yb + 3.0, 1.3, 2.6, 0.2), mEllipse(nx + 1.1, yb + 3.2, 1.3, 2.6, -0.2));
  }
  for (let k = 0; k < NPX; k++) if (tail[k] && lay[k] === 0) lay[k] = 2;
  if (mAny(tail)) {
    let sum = 0;
    let n = 0;
    let yMax = -1;
    for (let k = 0; k < NPX; k++) {
      if (!tail[k]) continue;
      sum += k % FW;
      n++;
      yMax = Math.max(yMax, Math.floor(k / FW));
    }
    const right = mRightOf(sum / n + 0.5 + 0.5); // nửa phải của đuôi khăn tối một bậc
    for (let k = 0; k < NPX; k++) if (tail[k] && right[k] && lay[k] === 2) lay[k] = 1;
    for (let x = 0; x < FW; x++) if (tail[yMax * FW + x] && x % 2 === 0) lay[yMax * FW + x] = 5; // tua
  }
  const piece = newBuf();
  const cols = { 1: SCARF[1], 2: SCARF[2], 3: SCARF[3], 5: '#fff3c4' };
  for (let k = 0; k < NPX; k++) if (lay[k]) setPx(piece, k % FW, Math.floor(k / FW), cols[lay[k]]);
  underChin(ctx, img, outline(piece));
}

/** Sổ đăng ký khe cổ: mã món → mục vẽ. */
export const NECK = {
  scarf: { S: scarf, E: scarf, N: scarf },
};

/** Hình cũ của rig.js (chưa vẽ lại). pivot như rig.js: điểm neo cổ = giữa, ngay dưới cằm. */
export const LEGACY = {
  bell: { rows: ['.ccccccccc.', 'ccccccccccc', '....yYy....', '....yyy....', '.....k.....'], pal: { c: '#8796a8', y: '#ffcf4a', Y: '#fff3b0', k: '#7a4c0e' }, pivot: [5, 1] },
  pearls: { rows: ['p...........p', '.p.........p.', '..p.p.p.p.p..'], pal: { p: '#f4f1ff' }, pivot: [6, 0] },
  bowtie: { rows: ['bb...bb', 'bbbkbbb', 'bb...bb'], pal: { b: '#a8743c', k: '#6b4a1f' }, pivot: [3, 1] },
  leafscarf: { rows: ['.gGg.gGg.gGg..', 'gggggggggggggg', '.g...g...g..g.'], pal: { g: '#5fae4a', G: '#a8e07a' }, pivot: [7, 1] },
  medal: { rows: ['r.........b', '.r.......b.', '..r.....b..', '...rr.bb...', '....yyy....', '...yYyyy...', '...yyyyy...', '....yyy....'], pal: { r: '#e2493b', b: '#4f8fd6', y: '#e0a21c', Y: '#fff3b0' }, pivot: [5, 0] },
  jade: { rows: ['g...........g', '.g.........g.', '..g.g.G.g.g..', '.....GGG.....', '......G......'], pal: { g: '#3f9a5a', G: '#8fdc7a' }, pivot: [6, 0] },
  necktie: { rows: ['.bbbbb.', '..bBb..', '..bbb..', '..bBb..', '..bbb..', '...b...'], pal: { b: '#4f8fd6', B: '#bfe3f7' }, pivot: [3, 0] },
  lei: { rows: ['pYp.......oYo', '.oYo.....pYp.', '...pYpoYopY..'], pal: { p: '#ff8fb1', o: '#ffb347', Y: '#ffd75e' }, pivot: [6, 0] },
  amber: { rows: ['b...........b', '.b.........b.', '..b.b.o.b.b..', '.....oOo.....', '......o......'], pal: { b: '#8a5a35', o: '#e08a1c', O: '#ffd27a' }, pivot: [6, 0] },
};

export function neckFor(id) {
  if (NECK[id]) return NECK[id];
  return LEGACY[id] ? legacyEntry(id, LEGACY[id], 'neck') : null;
}
