// Đặc điểm riêng của loài: sổ đăng ký theo `feature` trong shared/pets.js. Chủ sở hữu: họa sĩ đặc điểm.
// Mỗi mục { S, E, N } nhận ctx. Có bốn chỗ để vẽ:
//  - ngọc trán (crystal, drop, gem): điểm z 18 trên trán, chỉ nhìn trước/ngang;
//  - trên đỉnh đầu (sprout, flame, pebble, mushroom, crest): điểm z 17; đội mũ (ctx.wear.head) thì giấu đi;
//  - đồ cầm tay (cup): `holds: true` (dáng biped thôi vẽ tay), vẽ vào ctx.held = { pixels, parts }: một lớp riêng,
//    viền riêng, nằm trên khăn cổ và dưới kính/mũ;
//  - hiệu ứng sau khi viền (bubble): `over(ctx, img)` vẽ thẳng lên ảnh đã ghép; `blush`: đổi màu má (ember).
// crystal, sprout, cup: port nguyên từ pets-pilot (khớp từng điểm ảnh). Các mục khác: HÌNH TẠM khóa màu từ rig.js cũ.
import { RAMPS, mEllipse, nearestPalette, part, pyRound, setPx } from '../core.js';

const none = () => {};
const all = (fn) => ({ S: fn, E: fn, N: fn });

// ---------------------------------------------------------------- ngọc trán

/** Ngọc hình thoi 5 điểm (nhìn trước) hoặc 3 điểm (nhìn ngang). C = [đáy tối, hai cạnh, đỉnh, tâm sáng]. */
function gemOn(C) {
  return (ctx) => {
    const { sk, view } = ctx;
    if (view === 'N') return;
    const [hcx, , hrx, hry] = sk.head;
    const ft = pyRound(sk.htop + Math.max(2.5, hry * 0.36));
    const fx = pyRound(view === 'S' ? hcx : hcx + hrx * 0.25);
    if (view === 'S') ctx.pixels.push([fx - 1, ft, C[1], 18], [fx, ft - 1, C[2], 18], [fx, ft, C[3], 18], [fx + 1, ft, C[1], 18], [fx, ft + 1, C[0], 18]);
    else ctx.pixels.push([fx, ft, C[2], 18], [fx, ft - 1, C[3], 18], [fx, ft + 1, C[1], 18]);
  };
}

// ---------------------------------------------------------------- trên đỉnh đầu

/** Mầm lá (thỏ lá, ếch sen...). */
function sprout(ctx) {
  if (ctx.wear.head) return;
  const { sk, view } = ctx;
  const [hcx] = sk.head;
  const x = pyRound(view !== 'E' ? hcx : hcx - 1);
  const y = pyRound(sk.htop);
  const Gr = RAMPS.fur_green;
  const pts = [[x, y - 1, '#4e9a45'], [x, y - 2, '#4e9a45'], [x - 1, y - 3, Gr[2]], [x - 2, y - 3, Gr[2]], [x - 2, y - 4, Gr[3]],
    [x + 1, y - 3, Gr[2]], [x + 2, y - 3, Gr[1]], [x + 2, y - 4, Gr[2]]];
  for (const [a, b, c] of pts) ctx.pixels.push([a, b, c, 17]);
}

/** Hình tạm trên đầu từ bản đồ ký tự (màu đã ép về bảng màu). `at(ctx)` → góc trên-trái. `frames` đổi theo ctx.tick. */
function topStamp(frames, keys, at) {
  return (ctx) => {
    if (ctx.wear.head) return;
    const rows = frames[ctx.tick % frames.length];
    const [x0, y0] = at(ctx);
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const k = keys[ch];
      if (!k) return;
      const c = k === 'accent' ? RAMPS[ctx.ramps.accent][2] : nearestPalette(k);
      ctx.pixels.push([x0 + i, y0 + j, c, 17]);
    }));
  };
}
const headTop = (ctx) => [pyRound(ctx.sk.head[0]), pyRound(ctx.sk.htop)];

const flame = topStamp(
  [
    ['..y..', '.yoy.', '.oro.', 'orRro', '.rRr.'],
    ['.y...', '.oy..', '.oroy', 'orRro', '.rRr.'],
    ['...y.', '..yo.', 'yoro.', 'orRro', '.rRr.'],
  ],
  { y: '#fff3c4', o: '#f39b4a', r: '#e84a5f', R: '#a84848' },
  (ctx) => {
    const [x, y] = headTop(ctx);
    return [x - 2, y - 4];
  },
);
const pebble = topStamp([['.gG', 'ggg']], { g: '#9c948a', G: '#c4bcb0' }, (ctx) => {
  const [x, y] = headTop(ctx);
  return [x + pyRound(ctx.sk.head[2] * 0.3), y - 1];
});
const mushroom = topStamp([['.rrr.', 'rwrwr', 'rrrrr', '..s..']], { r: '#e84a5f', w: '#fffaf3', s: '#ecd2a2' }, (ctx) => {
  const [x, y] = headTop(ctx);
  return [x - pyRound(ctx.sk.head[2] * 0.55) - 2, y - 3];
});
const crest = topStamp([['.a.a.', 'aa.aa', '.aaa.']], { a: 'accent' }, (ctx) => {
  const [x, y] = headTop(ctx);
  return [x - 2, y - 2];
});

// ---------------------------------------------------------------- quanh cổ

/** Vòng lá ở cổ (cáo lá, khỉ tre); đeo đồ cổ thì giấu. */
function leafcollar(ctx) {
  if (ctx.wear.neck) return;
  const [nx, ny] = ctx.sk.anchors.neck;
  const y = pyRound(ny);
  const x = pyRound(nx);
  const xs = ctx.view === 'E' ? [-3, 0] : [-4, -1, 2];
  for (const dx of xs) ctx.parts.push(part(`leaf${dx}`, mEllipse(x + dx + 1, y + 0.5, 1.4, 1.1), 'grass', ctx.zh - 0.2, { group: 'leafcollar', flat: 2 }));
}

// ---------------------------------------------------------------- đồ cầm tay: cốc trà sữa của Boba

const CUPS = {
  // nắp kín trắng, trà sữa caramel, trân châu (toàn màu trong bảng)
  big: ['wWWWWWw', 'tTttttd', 'tTttttd', '.Ttttd.', '.tptpd.', '.ptptp.', '.ppppp.'],
  small: ['wWWWw', 'tTttd', 'tTptd', '.ppp.'],
};
const CUP_KEYS = { W: '#fffaf3', w: '#ecd8bf', T: '#ecd2a2', t: '#dcb07c', d: '#c8915f', p: '#3d2a1f' };

/** Ôm ở ngang ngực, ống hút hồng lên tới miệng; tay nào không giơ lên thì ôm cốc. */
function cup(ctx) {
  const { sk, view, pose } = ctx;
  if (view === 'N') return;
  const [bcx, bcy, brx, bry] = sk.body;
  const small = brx < 5.0;
  const rows = CUPS[small ? 'small' : 'big'];
  const cw = rows[0].length;
  const ch = rows.length;
  const mouthY = pyRound(sk.eyeY + 4.0);
  const cx0 = view === 'S' ? pyRound(bcx - cw / 2) : pyRound(bcx + brx - 2.5);
  let cy0 = Math.max(mouthY + 2, pyRound(bcy - bry * 0.35));
  cy0 = Math.min(cy0, pyRound(sk.ground) - ch - 1);
  const held = ctx.held;
  rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (CUP_KEYS[c]) held.pixels.push([cx0 + i, cy0 + j, CUP_KEYS[c], 9]);
  }));
  const sx = view === 'E' ? cx0 + Math.floor(cw / 2) + 1 : cx0 + Math.floor(cw / 2);
  for (let y = mouthY; y < cy0; y++) held.pixels.push([sx, y, '#d9708a', 9]);
  const pr = small ? 1.3 : 1.6;
  for (const s of view === 'S' ? [-1, 1] : [-1]) {
    let px;
    let py;
    if (view === 'S') {
      const up = s > 0 ? pose.armR ?? 0 : pose.armL ?? 0;
      if (up) continue;
      px = s < 0 ? cx0 - 0.1 : cx0 + cw + 0.1;
      py = cy0 + ch * 0.5;
    } else {
      px = cx0 + 0.4;
      py = cy0 + ch * 0.5;
    }
    held.parts.push(part(`cuppaw${s}`, mEllipse(px, py, pr + 0.3, pr), ctx.ramps.main, 9.5, { normal: [px - 0.5, py - 1, pr + 1, pr + 1] }));
  }
}

// ---------------------------------------------------------------- sau khi viền

/** Bong bóng nhỏ bay lên cạnh đầu (hải cẩu, cá nóc, vịt mây, kỳ giông). */
function bubbleOver(ctx, img) {
  const { sk, view } = ctx;
  if (view === 'N') return;
  const [hcx, , hrx] = sk.head;
  const rise = ctx.tick % 6;
  const bx = Math.min(44, pyRound(hcx + hrx) + 2);
  const by = Math.max(2, pyRound(sk.htop) + 4 - rise);
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) setPx(img, bx + dx, by + dy, '#8fd0e8');
  setPx(img, bx, by, '#fffaf3');
}

/** Sổ đăng ký: đặc điểm → { S, E, N } (+ holds, over, blush). */
export const FEATURES = {
  none: all(none),
  crystal: all(gemOn(['#2f6f9a', '#58b9d6', '#8fd0e8', '#eef8fb'])),
  sprout: all(sprout),
  cup: { ...all(cup), holds: true },
};

/** Đặc điểm chưa vẽ lại theo bản mẫu: HÌNH TẠM khóa màu từ rig.js cũ. Vẽ xong thì chuyển vào FEATURES. */
export const FALLBACK = {
  drop: all(gemOn(['#2f6f9a', '#3f8fc0', '#8fd0e8', '#eef8fb'])),
  gem: all(gemOn(['#8a5a34', '#d79c1c', '#f4c24f', '#fffaf3'])),
  flame: all(flame),
  pebble: all(pebble),
  mushroom: all(mushroom),
  crest: all(crest),
  leafcollar: all(leafcollar),
  bubble: { ...all(none), over: bubbleOver },
  ember: { ...all(none), blush: '#f39b4a' },
};

export const featureFor = (kind) => FEATURES[kind] ?? FALLBACK[kind] ?? FEATURES.none;
