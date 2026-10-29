// Bộ khung vẽ pet ngũ hành: mọi loài lắp từ cùng một bộ phận trên một khung có điểm neo (đầu, mặt, cổ, lưng).
// Mỗi khung hình tính lại điểm neo theo dáng (nhún, nhảy, cúi đầu...), nên đồ đeo luôn dính đúng chỗ.
import { OUTLINE, Pen, bayer, bitmap, hexToRgb, makeCanvas, outline, shadeBlob } from './pixel.js';
import { ELEMENTS, LIFE_STAGES, SPECIES_BY_ID, WEARABLES, fullSetOf } from './shared/pets.js';

export const RIG_W = 44;
export const RIG_H = 50;
const CX = 22;
const GROUND = 46;

// ---------------------------------------------------------------- màu

const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
export function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

function paletteOf(sp, stage) {
  let [main, belly, accent] = sp.colors;
  if (stage.look.elder) {
    // Lão làng: lông bạc đi một chút.
    main = mix(main, '#c9c4bc', 0.28);
    accent = mix(accent, '#c9c4bc', 0.2);
  }
  return {
    main,
    mainL: mix(main, '#ffffff', 0.32),
    mainD: mix(main, OUTLINE, 0.28),
    belly,
    bellyD: mix(belly, main, 0.35),
    accent,
    accentL: mix(accent, '#ffffff', 0.35),
    accentD: mix(accent, OUTLINE, 0.3),
    inner: mix(belly, '#f08aa6', 0.45),
    blush: '#f3889c',
  };
}

// ---------------------------------------------------------------- dáng khung (giá trị của bé trưởng thành)

const ARCH = {
  biped: { body: [8, 8], head: [11, 9], leg: 2, overlap: 4, limbs: 'arms' },
  quad: { body: [10, 7], head: [11, 9], leg: 3, overlap: 4, limbs: 'paws' },
  round: { body: [14, 12], head: null, leg: 1, overlap: 0, limbs: 'nubs' },
  bird: { body: [9, 9], head: [10, 8], leg: 2, overlap: 4, limbs: 'wings' },
  serpent: { body: [9, 8], head: [11, 9], leg: 2, overlap: 4, limbs: 'arms' },
};

/**
 * Bộ xương của một khung hình: vị trí thân, đầu, chân và các điểm neo đồ đeo.
 * `pose`: by (nhún), lift (nhảy, âm là lên), sq (bẹp/giãn thân), hx/hy (lệch đầu), step (bước chân)...
 */
export function skeleton(sp, stage, pose = {}) {
  const A = ARCH[sp.body];
  const L = stage.look;
  const headK = Math.sqrt(L.scale) * L.head;
  const bodyK = L.scale * L.body;
  const ground = GROUND + (pose.lift ?? 0);
  // Lão làng hơi còng: đầu cúi thấp hơn một chút.
  const by = pose.by ?? 0;
  const stoop = L.elder ? 1 : 0;
  const sq = pose.sq ?? 0;
  const legH = Math.max(1, Math.round(A.leg * L.leg));
  let body;
  let head;
  if (!A.head) {
    // Dáng tròn: đầu và thân là một khối; "đầu" chỉ là phần trên để đặt mặt và đồ đeo.
    const rx = Math.round(A.body[0] * headK * 0.92) + Math.max(0, -sq);
    const ry = Math.max(6, Math.round(A.body[1] * headK * 0.92) + sq);
    body = { x: CX, y: ground - legH - ry + by, rx, ry };
    head = { x: CX + (pose.hx ?? 0), y: body.y - Math.round(ry * 0.25) + (pose.hy ?? 0), rx: Math.round(rx * 0.86), ry: Math.round(ry * 0.75) };
    head.top = body.y - ry;
  } else {
    const rx = Math.max(3, Math.round(A.body[0] * bodyK)) + Math.max(0, -sq);
    const ry = Math.max(3, Math.round(A.body[1] * bodyK) + sq);
    body = { x: CX, y: ground - legH - ry + by, rx, ry };
    const hrx = Math.round(A.head[0] * headK);
    const hry = Math.round(A.head[1] * headK);
    const overlap = Math.max(2, Math.round(A.overlap * Math.min(1, bodyK + 0.2)));
    head = { x: CX + (pose.hx ?? 0) + stoop, y: body.y - ry + overlap - hry + (pose.hy ?? 0) + stoop, rx: hrx, ry: hry };
    head.top = head.y - hry;
  }
  const eyeDx = Math.max(3, Math.round(head.rx * 0.45));
  const eyeY = head.y + (A.head ? 1 : 0);
  return {
    A, L, ground, legH, body, head, eyeDx, eyeY,
    anchors: {
      head: { x: head.x, y: head.top },
      face: { x: head.x, y: eyeY },
      // Cổ: ngay dưới cằm (dáng tròn thì dưới miệng), để khăn và vòng không đè lên mặt.
      neck: { x: body.x + Math.round((pose.hx ?? 0) / 2), y: head.y + head.ry + (A.head ? 1 : 0) },
      back: { x: body.x, y: body.y - body.ry + 1 }, // vai: áo choàng buông từ đây, cánh xòe từ đây
    },
  };
}

// ---------------------------------------------------------------- bộ phận

const layer = () => {
  const [c, g] = makeCanvas(RIG_W, RIG_H);
  return { c, g, p: new Pen(g) };
};

/** Vẽ hình ký tự `rows` vào `g` tại (x, y); `flip` để lật ngang (tai phải, cánh phải...). */
function stamp(g, rows, pal, x, y, flip = false) {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const color = pal[ch];
      if (!color) return;
      g.fillStyle = color;
      g.fillRect(Math.round(x + (flip ? row.length - 1 - i : i)), Math.round(y + j), 1, 1);
    });
  });
}

const EARS = {
  cat: { rows: ['m....', 'mm...', 'mim..', 'miim.', 'mmmmm'], dx: 0.95, sink: 2 },
  fox: { rows: ['m.....', 'mm....', 'mim...', 'miim..', 'miiim.', 'miiiim', 'mmmmmm'], dx: 1, sink: 2 },
  bunny: { rows: ['.mm.', 'mmmm', 'miim', 'miim', 'miim', 'miim', 'miim', 'mmmm', 'mmmm'], dx: 0.5, sink: 2 },
  round: { rows: ['.mm.', 'mimm', 'mimm', 'mmmm'], dx: 0.95, sink: 3 },
  mouse: { rows: ['.mmmm.', 'mmiimm', 'miiiim', 'miiiim', 'mmiimm', '.mmmm.'], dx: 1.15, sink: 3 },
  tuft: { rows: ['m...', 'mm..', 'mmm.', 'mmmm'], dx: 0.9, sink: 2 },
  horns: { rows: ['a..', 'aa.', '.aa', '.aa'], dx: 0.55, sink: 1, color: 'horn' },
  antler: { rows: ['a.a....', 'a.a.a..', '.aaa.a.', '..aaa..', '...a...', '...a...'], dx: 0.85, sink: 1, color: 'horn' },
};

function drawEars(g, sk, sp, pal, pose, front) {
  const { head } = sk;
  const droop = pose.ear ?? 0;
  if (sp.ears === 'floppy' && front) {
    const rows = ['dddd', 'dddd', 'dddd', 'dddd', '.ddd', '..dd'];
    const pals = { d: pal.mainD };
    stamp(g, rows, pals, head.x - head.rx - 1, head.top + 2 + droop);
    stamp(g, rows, pals, head.x + head.rx - 2, head.top + 2 + droop, true);
    return;
  }
  if (sp.ears === 'fin' && !front) {
    const rows = ['a...', 'aa.a', 'aaaa', 'aa.a', 'a...'];
    const pals = { a: pal.accent };
    stamp(g, rows, pals, head.x - head.rx - 3, head.y - 3 + droop);
    stamp(g, rows, pals, head.x + head.rx, head.y - 3 + droop, true);
    return;
  }
  const def = EARS[sp.ears];
  if (!def || front) return;
  const horn = sp.element === 'kim' ? '#dfe7ef' : sp.element === 'hoa' ? '#ffd08a' : '#efe3c8';
  const pals = {
    m: sp.ears === 'round' && sp.pattern === 'patch' ? pal.accent : pal.main,
    i: pal.inner,
    a: def.color === 'horn' ? horn : pal.accent,
  };
  const w = def.rows[0].length;
  const h = def.rows.length;
  const xL = Math.round(head.x - head.rx * def.dx) - (sp.ears === 'bunny' ? 2 : 0);
  const y = head.top + def.sink - h + droop;
  stamp(g, def.rows, pals, xL - Math.round(droop / 2), y);
  stamp(g, def.rows, pals, 2 * head.x - xL - w + 1 + Math.round(droop / 2), y, true);
}

/** Đuôi vẽ sau lưng; `pose.tail` làm chóp đuôi đung đưa. */
function drawTail(p, sk, sp, pal, pose) {
  const { body } = sk;
  const sway = pose.tail ?? 0;
  const bx = body.x + body.rx - 1;
  const by = body.y + Math.round(body.ry * 0.3);
  const chain = (pts, color, tipColor) => pts.forEach(([dx, dy, r], i) => {
    const last = i === pts.length - 1;
    const sw = Math.round((sway * (i + 1)) / pts.length);
    p.disc(bx + dx + sw, by + dy, r, last && tipColor ? tipColor : color);
  });
  switch (sp.tail) {
    case 'thin':
      chain([[1, 0, 1], [2, -1, 1], [3, -3, 1], [3, -5, 1], [4, -7, 1]], pal.main, pal.mainD);
      break;
    case 'fluffy':
      chain([[1, 0, 2], [3, -2, 3], [4, -5, 3], [4, -8, 2]], pal.main, sp.element === 'hoa' ? '#ffd75e' : pal.belly);
      break;
    case 'puff':
      p.disc(bx + 1, by + 1, 2, pal.mainL);
      break;
    case 'flat':
      p.ellipse(bx + 2, by + 2 + Math.round(sway / 2), 2, 4, pal.mainD);
      break;
    case 'curl':
      [[1, 0], [2, -1], [3, -1], [4, -2], [4, -3], [3, -3]].forEach(([dx, dy]) => p.rect(bx + dx, by + dy, 1, 2, pal.mainD));
      break;
    case 'fan':
      p.ellipse(bx + 1, by + 2, 2, 4, pal.accentD);
      p.ellipse(bx + 3 + sway, by - 1, 2, 4, pal.accent);
      p.ellipse(bx + 1, by - 3, 2, 3, pal.accentL);
      break;
    case 'dragon':
      chain([[1, 1, 3], [4, 0, 3], [6, -2, 2], [8, -4, 2], [9, -7, 1], [10, -9, 1]], pal.main);
      [[4, -3], [7, -5], [9, -9]].forEach(([dx, dy]) => p.rect(bx + dx + sway, by + dy, 1, 1, pal.accent));
      break;
    case 'fish':
      chain([[1, 1, 2], [3, 0, 2], [5, -1, 1]], pal.main);
      stamp(p.g, ['a..', 'aa.', 'aaa', 'aa.', 'a..'], { a: pal.accent }, bx + 6 + sway, by - 3);
      break;
    default:
  }
}

/** Mai rùa nhô ra sau thân (vẽ trước thân). */
function drawShell(p, sk, pal) {
  const { body } = sk;
  p.ellipse(body.x, body.y - 1, body.rx + 2, body.ry + 1, pal.accent);
  for (const [dx, dy] of [[-5, -3], [0, -5], [5, -3], [-6, 1], [6, 1]]) p.disc(body.x + dx, body.y + dy, 1, pal.accentL);
}

function drawBody(sk, sp, pal) {
  const L = layer();
  const { body } = sk;
  L.p.ellipse(body.x, body.y, body.rx, body.ry, pal.main);
  shadeBlob(L.c, body.x, body.y, Math.max(body.rx, body.ry), { light: pal.mainL, mid: pal.main, dark: pal.mainD });
  if (sk.A.head || sp.face !== 'beak') {
    const brx = Math.max(1, body.rx - 3);
    const bry = Math.max(1, body.ry - (sk.A.head ? 2 : 4));
    L.p.ellipse(body.x, body.y + (sk.A.head ? 1 : 3), brx, bry, pal.belly);
  }
  if (sp.pattern === 'spots') {
    for (const [dx, dy] of [[-0.6, -0.3], [0.55, -0.1], [-0.3, 0.45]]) {
      L.p.disc(body.x + Math.round(dx * body.rx), body.y + Math.round(dy * body.ry), 1, pal.accent);
    }
  }
  if (sp.pattern === 'stripes') {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) L.p.rect(body.x + s * (body.rx - 2) - (s > 0 ? 1 : 0), body.y - 2 + k * 3, 2, 1, pal.accent);
    }
  }
  if (sp.pattern === 'scales') {
    for (let y = body.y - body.ry + 1; y < body.y - 1; y += 2) {
      for (let x = body.x - body.rx + 2; x < body.x + body.rx - 1; x += 3) L.p.px(x + ((y >> 1) & 1), y, pal.accentL);
    }
  }
  return L.c;
}

function drawHead(sk, sp, pal, tick) {
  const L = layer();
  const { head } = sk;
  if (sk.A.head) {
    L.p.ellipse(head.x, head.y, head.rx, head.ry, pal.main);
    shadeBlob(L.c, head.x, head.y, Math.max(head.rx, head.ry), { light: pal.mainL, mid: pal.main, dark: pal.mainD });
  }
  const my = sk.eyeY + 3;
  if (sp.pattern === 'mask' || sp.pattern === 'patch') {
    for (const s of [-1, 1]) L.p.ellipse(head.x + s * sk.eyeDx, sk.eyeY, sp.pattern === 'patch' ? 2 : 3, 2, pal.accent);
  }
  if (sp.pattern === 'stripes') {
    for (const dx of [-3, 0, 3]) L.p.rect(head.x + dx, head.top + 1, 1, 2, pal.accent);
    for (const s of [-1, 1]) L.p.rect(head.x + s * (head.rx - 1), head.y, 1, 2, pal.accent);
  }
  if (sp.pattern === 'spots' && sk.A.head) {
    L.p.disc(head.x - Math.round(head.rx * 0.55), head.top + 3, 1, pal.accent);
    L.p.px(head.x + Math.round(head.rx * 0.5), head.top + 2, pal.accent);
  }
  if (sp.pattern === 'scales' && sk.A.head) {
    for (let x = head.x - 4; x <= head.x + 4; x += 2) L.p.px(x, head.top + 2 + (x & 1), pal.accentL);
  }
  if (sp.face === 'muzzle') {
    L.p.ellipse(head.x, my, Math.max(2, Math.round(head.rx * 0.36)), 2, pal.belly);
    L.p.rect(head.x - 1, my - 2, 2, 1, OUTLINE);
  } else if (sp.face === 'snout') {
    L.p.ellipse(head.x, my - 1, 3, 2, mix(pal.main, '#f08aa6', 0.35));
    L.p.px(head.x - 1, my - 1, pal.mainD);
    L.p.px(head.x + 1, my - 1, pal.mainD);
  } else if (sp.face === 'beak') {
    stamp(L.g, ['aaa', '.a.'], { a: pal.accent }, head.x - 1, my - 2);
  }
  // Điểm hành trên trán: luôn thấy được, kể cả khi đội mũ.
  const forehead = head.top + Math.max(3, Math.round(head.ry * 0.45));
  if (sp.feature === 'drop') stamp(L.g, ['.b.', 'bwb', 'bbb'], { b: '#5fb3e8', w: '#e8f8ff' }, head.x - 1, forehead - 1);
  if (sp.feature === 'crystal') stamp(L.g, ['.c.', 'cwc', '.c.'], { c: '#8fd3f0', w: '#ffffff' }, head.x - 1, forehead - 1);
  if (sp.feature === 'gem') stamp(L.g, ['.y.', 'yWy', '.y.'], { y: '#f2c14e', W: tick % 4 === 0 ? '#ffffff' : '#ffe9a8' }, head.x - 1, forehead - 1);
  return L.c;
}

/** Tay, chân, cánh: vẽ viền tối bên trong để tách khỏi thân khi cùng màu. */
function limb(p, x, y, rx, ry, fill, rim) {
  p.ellipse(x, y, rx, ry, rim);
  if (rx > 1 && ry > 1) p.ellipse(x, y - 1, rx - 1, ry - 1, fill);
}

function drawLegsBack(p, sk, sp, pal) {
  if (sp.body !== 'quad') return;
  const { body, ground } = sk;
  for (const s of [-1, 1]) limb(p, body.x + s * (body.rx - 1), ground - 2, 2, 2, pal.mainD, mix(pal.mainD, OUTLINE, 0.2));
}

function drawLimbs(p, sk, sp, pal, pose) {
  const { body, ground, legH } = sk;
  const step = pose.step ?? 0;
  const footRx = Math.max(2, Math.round(body.rx * 0.32));
  if (sp.body === 'quad') {
    for (const s of [-1, 1]) {
      const lift = (s === -1 && step > 0) || (s === 1 && step < 0) ? 1 : 0;
      const raise = s === 1 && pose.armR ? pose.armR + 1 : 0;
      const x = body.x + s * Math.max(2, body.rx - 4);
      limb(p, x, ground - Math.max(1, legH) - lift - raise * 2, 2, Math.max(2, legH), pal.main, pal.mainD);
      p.rect(x - 1, ground - 1 - lift - raise * 2, 3, 1, pal.belly);
    }
    return;
  }
  if (sp.body === 'round') {
    for (const s of [-1, 1]) {
      const lift = (s === -1 && step > 0) || (s === 1 && step < 0) ? 1 : 0;
      p.ellipse(body.x + s * Math.round(body.rx * 0.4), ground - lift, 2, 1, pal.mainD);
    }
    for (const s of [-1, 1]) {
      const up = s === 1 ? pose.armR ?? 0 : pose.armL ?? 0;
      p.ellipse(body.x + s * (body.rx - 1), body.y + 2 - up * 3, 1, 2, pal.mainD);
    }
    return;
  }
  // Chân hai bàn (đứng, chim, rồng).
  const footColor = sp.body === 'bird' ? '#f2a03d' : pal.mainD;
  for (const s of [-1, 1]) {
    const lift = (s === -1 && step > 0) || (s === 1 && step < 0) ? 1 : 0;
    const x = body.x + s * Math.max(2, Math.round(body.rx * 0.45));
    if (sp.body === 'bird') p.rect(x - 1, ground - legH - lift, 1, legH, footColor);
    p.ellipse(x, ground - lift, footRx, 1, footColor);
  }
  if (sp.body === 'bird') return;
  for (const s of [-1, 1]) {
    const up = s === 1 ? pose.armR ?? 0 : pose.armL ?? 0;
    if (sp.feature === 'cup' && !up) continue; // tay đang ôm cốc trà sữa: vẽ ở drawHeldCup
    const x = body.x + s * (body.rx - 1 + up);
    const y = body.y - 1 - up * 3;
    limb(p, x, y, 2, 3, pal.main, pal.mainD);
  }
}

function drawWings(p, sk, sp, pal, pose) {
  if (sp.body !== 'bird') return;
  const { body } = sk;
  for (const s of [-1, 1]) {
    const up = s === 1 ? pose.armR ?? 0 : pose.armL ?? 0;
    const x = body.x + s * (body.rx - 1 + up);
    const y = body.y - up * 3;
    limb(p, x, y, 3, 5 - up, pal.mainD, mix(pal.mainD, OUTLINE, 0.2));
    p.ellipse(x - s, y + 1, 1, 3 - up, pal.main);
  }
}

/** Đồ trang trí theo hành trên đỉnh đầu; đội mũ thì giấu đi như tóc dưới mũ. */
function drawTopFeature(g, sk, sp, pal, tick) {
  const { head } = sk;
  const top = head.top;
  switch (sp.feature) {
    case 'sprout':
      stamp(g, ['gg.gg', '.gGg.', '..s..', '..s..'], { g: '#7ccf5a', G: '#b6ef8a', s: '#5a9a3f' }, head.x - 2, top - 3 + (tick % 4 === 2 ? 1 : 0));
      break;
    case 'flame': {
      const frames = [
        ['..y..', '.yoy.', '.oro.', 'orRro', '.rRr.'],
        ['.y...', '.oy..', '.oroy', 'orRro', '.rRr.'],
        ['...y.', '..yo.', 'yoro.', 'orRro', '.rRr.'],
      ];
      stamp(g, frames[tick % 3], { y: '#ffe27a', o: '#ffa53d', r: '#f0663c', R: '#d8402e' }, head.x - 2, top - 3);
      break;
    }
    case 'pebble':
      stamp(g, ['.gG', 'ggg'], { g: '#9a948a', G: '#c9c4bc' }, head.x + Math.round(head.rx * 0.35), top - 1);
      break;
    case 'mushroom':
      stamp(g, ['.rrr.', 'rwrwr', 'rrrrr', '..s..'], { r: '#e2493b', w: '#fff3e0', s: '#f3dcbc' }, head.x - Math.round(head.rx * 0.6) - 2, top - 3);
      break;
    case 'crest':
      stamp(g, ['.a.a.', 'aa.aa', '.aaa.'], { a: pal.accent }, head.x - 2, top - 2);
      break;
    default:
  }
  if (sp.ears === 'crest') stamp(g, ['.a.', 'aaa', 'aaa'], { a: pal.accent }, head.x - 1, top - 2);
}

function drawLeafCollar(p, sk) {
  const { x, y } = sk.anchors.neck;
  for (const dx of [-4, -1, 2, 5]) p.ellipse(x + dx - 1, y, 1, 1, '#7ccf5a');
  p.px(x - 3, y, '#b6ef8a');
  p.px(x + 3, y, '#b6ef8a');
}

/** Chi tiết mặt vẽ sau khi viền: mắt, má, miệng, nước mắt, lông mày bạc. */
function drawFace(g, sk, sp, pal, pose, stage, tick) {
  const p = new Pen(g);
  const { head } = sk;
  const o = 1; // lệch do viền
  const ex = sk.eyeDx;
  const look = pose.look ?? 0;
  const big = stage.look.eye > 1.1;
  const ew = big ? 3 : 2;
  const eh = big ? 4 : 3;
  for (const s of [-1, 1]) {
    const x = head.x + s * ex - (s < 0 ? ew - 1 : 0) + look + o;
    const y = sk.eyeY - 1 + o;
    if (pose.blink) {
      p.rect(x, y + eh - 2, ew, 1, OUTLINE);
    } else if (pose.mouth === 'sad') {
      p.rect(x, y + 1, ew, eh - 1, OUTLINE);
      p.px(x + (s < 0 ? ew - 1 : 0), y + 1, '#ffffff');
    } else {
      p.rect(x, y, ew, eh, OUTLINE);
      p.px(x + (big ? 1 : 0), y, '#ffffff');
      if (big) p.px(x, y + 2, '#6b5a73');
    }
    if (stage.look.elder) p.rect(x - (s < 0 ? 1 : 0), y - 2, ew + 1, 1, '#f4f1ea'); // lông mày bạc
    const blush = sp.feature === 'ember' ? (tick % 2 ? '#ff9a3d' : '#ffb25e') : pal.blush;
    p.rect(head.x + s * (ex + 2) - (s < 0 ? 1 : 0) + o, sk.eyeY + 2 + o, 2, 1, blush);
  }
  if (pose.tear) p.rect(head.x - ex + o, sk.eyeY + 2 + pose.tear + o, 1, 2, '#8fd6f2');
  if (stage.look.elder && sp.face !== 'beak') {
    // Chòm râu bạc dưới cằm.
    const by = sk.eyeY + 6 + (sp.face === 'muzzle' ? 1 : 0) + o;
    p.rect(head.x - 1 + o, by, 3, 1, '#f4f1ea');
    p.px(head.x + o, by + 1, '#f4f1ea');
  }
  if (sp.face === 'beak') return;
  const mx = head.x + o;
  const my = sk.eyeY + 3 + (sp.face === 'muzzle' ? 1 : 0) + (sp.face === 'snout' ? 1 : 0) + o;
  if (pose.mouth === 'open') {
    p.rect(mx - 1, my, 3, 2, OUTLINE);
    p.px(mx, my + 1, '#f07a8e');
  } else if (pose.mouth === 'sad') {
    p.px(mx, my, OUTLINE);
    p.px(mx - 1, my + 1, OUTLINE);
    p.px(mx + 1, my + 1, OUTLINE);
  } else {
    p.px(mx - 1, my, OUTLINE);
    p.px(mx + 1, my, OUTLINE);
    p.px(mx, my + 1, OUTLINE);
  }
}

/** Bộ đồ đủ 4 khe cùng hành: vài ngôi sao màu hành nhấp nháy quanh bé. */
function drawSetSparkles(g, sk, el, tick) {
  const p = new Pen(g);
  const { head, body } = sk;
  const spots = [
    [head.x - head.rx - 3, head.y - 3], [head.x + head.rx + 3, head.y + 1],
    [body.x - body.rx - 3, body.y + 2], [body.x + body.rx + 3, body.y - 2],
  ];
  spots.forEach(([x, y], i) => {
    if ((i + tick) % 2) return;
    const big = (i + tick) % 4 === 0;
    p.px(x + 1, y + 1, '#ffffff');
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) p.px(x + dx, y + dy, el.accent);
    if (big) for (const [dx, dy] of [[-1, 1], [3, 1], [1, -1], [1, 3]]) p.px(x + dx, y + dy, el.color);
  });
}

const CUPS = {
  // Cốc trà sữa trân châu: nắp vòm trắng, trà caramel, trân châu đen ở đáy.
  big: ['...LLL...', '..LLLLL..', '.LLLLLLL.', '.ttttttt.', '.twttttt.', '.twttttt.', '.ttttttt.', '.tptptpt.', '.ppppppp.', '..ppppp..'],
  small: ['.LLL.', 'LLLLL', 'ttttt', 'twttt', 'ttttt', 'tpppt', '.ppp.'],
};
const cupImages = {};
/**
 * Cốc trà sữa bé ôm trước bụng (nét riêng của Boba): vẽ sau đồ ở cổ, nên khăn nằm sau cốc;
 * ống hút hồng nối từ nắp lên miệng, tay nào không giơ lên thì ôm lấy cốc. Bé nhỏ ôm cốc nhỏ.
 */
function drawHeldCup(g, sk, sp, pal, pose) {
  const size = sk.body.rx < 6 ? 'small' : 'big';
  cupImages[size] ??= bitmap(CUPS[size], { L: '#ffffff', t: '#d9a066', w: '#fff3e0', p: '#3d2a1f' }, '#6b4426');
  const img = cupImages[size];
  const rows = CUPS[size];
  const pen = new Pen(g);
  const o = 1; // lệch do viền khung hình
  const { body, head } = sk;
  const mouth = sk.eyeY + 4 + (sp.face === 'muzzle' ? 1 : 0);
  // Nắp cốc thấp hơn miệng vài pixel để thấy ống hút; đáy cốc không xuống quá chân.
  const lid = Math.max(mouth + (size === 'big' ? 3 : 1), Math.min(body.y - 2, sk.ground - rows.length));
  for (let y = mouth; y < lid; y++) pen.px(head.x + o, y + o, '#ff6f9a');
  const half = (rows[0].length - 1) / 2;
  g.drawImage(img, body.x - half - 1 + o, lid - 1 + o);
  for (const side of [-1, 1]) {
    const up = side === 1 ? pose.armR ?? 0 : pose.armL ?? 0;
    if (up) continue;
    const x = body.x + side * (half + 1) + o;
    const y = lid + Math.round(rows.length * 0.55) + o;
    pen.ellipse(x, y, 2, 2, OUTLINE);
    pen.ellipse(x, y, 1, 1, pal.mainL);
  }
}

/**
 * Hào quang của bé quý hiếm: vầng sáng lốm đốm (dither) quanh người, đốm sáng dưới chân,
 * và vài hạt sáng bay lên. Quý màu tím nhạt; Huyền thoại màu vàng kim, đậm và nhiều hạt hơn.
 */
const AURAS = {
  quy: {
    inner: 'rgba(206, 168, 255, 0.7)', outer: 'rgba(160, 92, 230, 0.85)', ground: 'rgba(150, 80, 210, 0.4)',
    spark: '#a55fd0', rim: 0.7, fill: 0.25, motes: 3,
  },
  huyenthoai: {
    inner: 'rgba(255, 228, 120, 0.8)', outer: 'rgba(255, 184, 20, 0.95)', ground: 'rgba(255, 170, 30, 0.5)',
    spark: '#ffb300', rim: 0.9, fill: 0.4, motes: 5,
  },
};

/** Vầng hào quang sau lưng bé (vẽ trước đồ ở lưng và thân bé). Nhịp thở: to nhỏ theo khung hình. */
function drawAura(g, sk, aura, tick) {
  const o = 1; // lệch do viền khung hình
  const { head, body, ground } = sk;
  const top = head.top - 2;
  const bottom = ground;
  const cx = body.x + o;
  const cy = (top + bottom) / 2 + o;
  const pulse = tick % 2;
  const rx = Math.max(head.rx, body.rx) + 4 + pulse;
  const ry = (bottom - top) / 2 + 2 + pulse;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1 || d < 0.55) continue;
      // Vành ngoài dày đặc màu đậm, phía trong lốm đốm màu nhạt.
      const rim = d > 0.78;
      if (bayer(x, y) >= (rim ? aura.rim : aura.fill)) continue;
      g.fillStyle = rim ? aura.outer : aura.inner;
      g.fillRect(x, y, 1, 1);
    }
  }
  // Đốm sáng dưới chân.
  const gr = body.rx + 6;
  for (let x = -gr; x <= gr; x++) {
    const h = Math.round(2 * Math.sqrt(1 - (x / (gr + 0.5)) ** 2));
    for (let y = -h; y <= 0; y++) {
      if (bayer(cx + x, ground + o + y) < 0.55) {
        g.fillStyle = aura.ground;
        g.fillRect(cx + x, ground + o + y + 1, 1, 1);
      }
    }
  }
}

/** Hạt sáng bay lên hai bên người bé (vẽ trước mặt bé), lên dần qua từng khung hình. */
function drawMotes(g, sk, aura, tick) {
  const o = 1;
  const { head, body, ground } = sk;
  const span = ground - head.top;
  const reach = Math.max(head.rx, body.rx) + 2;
  for (let i = 0; i < aura.motes; i++) {
    const side = i % 2 ? 1 : -1;
    const x = body.x + o + side * (reach + (i >> 1) * 3);
    const y = ground + o - ((tick * 4 + Math.round((i * span) / aura.motes)) % span);
    g.fillStyle = aura.spark;
    g.fillRect(x, y, 1, 1);
    if ((tick + i) % 3 === 0) {
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, 1, 1);
    }
  }
}

/** Gậy chống của bé lão làng. */
function drawCane(p, sk) {
  const x = sk.body.x - sk.body.rx - 3;
  const top = sk.body.y - Math.round(sk.body.ry * 0.6);
  p.rect(x, top, 2, sk.ground - top + 1, '#8a5a35');
  p.rect(x, top - 1, 4, 2, '#8a5a35');
  p.px(x + 3, top + 1, '#8a5a35');
  p.px(x, top, '#b07a4a');
}

// ---------------------------------------------------------------- đồ đeo

/**
 * Hình từng món, vẽ cùng lưới pixel và viền như pet. `pivot`: điểm trên hình dính vào điểm neo;
 * `sink`: món đội đầu lún xuống bao nhiêu pixel; `side`: lệch sang trái/phải theo bề ngang đầu.
 */
const WEAR_ART = {
  crown: {
    rows: ['y....y....y', 'yy..yyy..yy', 'yyy.yWy.yyy', 'yyyyyyyyyyy', 'yRyyyByyyRy', 'yyyyyyyyyyy'],
    pal: { y: '#ffcf4a', W: '#fff3b0', R: '#e84a5f', B: '#4aa3e8' }, line: '#7a4c0e', pivot: [5, 5], sink: 2,
  },
  tophat: {
    rows: ['..#######..', '..#w#####..', '..#w#####..', '..#######..', '..#######..', '..rrrrrrr..', '..#######..', '###########', '.#########.'],
    pal: { '#': '#3a3340', w: '#6d6478', r: '#4f8fd6' }, line: '#120c08', pivot: [5, 8], sink: 2,
  },
  beret: {
    rows: ['.....r......', '...rrrrrr...', '.rrrrrrrrrr.', 'rRrrrrrrrrrr', '.RRRRRRRRRR.'],
    pal: { r: '#e2493b', R: '#b8352a' }, line: '#4a1a14', pivot: [6, 4], sink: 3, dx: -1,
  },
  nonla: {
    rows: ['.......y.......', '......yYy......', '....yyyYyyy....', '..yyyyyYyyyyy..', 'yyyyyyyyyyyyyyy', '.bbbbbbbbbbbbb.'],
    pal: { y: '#f2d58a', Y: '#fff1c2', b: '#c99a4b' }, line: '#6b4a1f', pivot: [7, 5], sink: 3,
  },
  leafband: {
    rows: ['.g.G.g.G.g.G.', 'ggGggGggGggGg', '.ggggggggggg.'],
    pal: { g: '#5fae4a', G: '#a8e07a' }, line: '#2f5a24', pivot: [6, 2], sink: 3,
  },
  bow: {
    rows: ['.pp.....pp.', 'pwpp...pppp', 'ppppDkDpppp', 'pppDkkkDppp', 'ppppDkDpppp', 'pppp...pppp', '.pp.....pp.'],
    pal: { p: '#ff8fb1', w: '#ffd6e4', D: '#e0607f', k: '#c44569' }, line: '#5a1f2b', pivot: [5, 6], sink: 3, side: 0.5,
  },
  flower: {
    rows: ['..p.p..', '.ppPpp.', 'pPpypPp', '.ppypp.', 'pPpppPp', '.pp.pp.'],
    pal: { p: '#ffb7cf', P: '#ffe3ec', y: '#ffd75e' }, line: '#7a2f45', pivot: [3, 5], sink: 3, side: -0.55,
  },
  glasses: {
    rows: ['.###.......###.', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'],
    pal: { '#': '#3a3340', w: '#bfe0f5', L: '#ffffff' }, line: '#120c08', pivot: [7, 2],
  },
  shades: {
    rows: ['###############', '#BwB#.....#BwB#', '.###.......###.'],
    pal: { '#': '#22202b', B: '#3d3a52', w: '#8f8aa8' }, line: '#0b0910', pivot: [7, 1],
  },
  scarf: {
    rows: ['.rrrrrrrrrrrr.', 'rRrrrRrrrrRrrr', '.rrrrrrrrrrrr.', '..........rr..', '..........rR..'],
    pal: { r: '#e2493b', R: '#ff8a6e' }, line: '#4a1a14', pivot: [7, 1],
  },
  leafscarf: {
    rows: ['.gGg.gGg.gGg..', 'gggggggggggggg', '.g...g...g..g.'],
    pal: { g: '#5fae4a', G: '#a8e07a' }, line: '#2f5a24', pivot: [7, 1],
  },
  bell: {
    rows: ['.ccccccccc.', 'ccccccccccc', '....yYy....', '....yyy....', '.....k.....'],
    pal: { c: '#8796a8', y: '#ffcf4a', Y: '#fff3b0', k: '#7a4c0e' }, line: '#2e3440', pivot: [5, 1],
  },
  pearls: {
    rows: ['p...........p', '.p.........p.', '..p.p.p.p.p..'],
    pal: { p: '#f4f1ff' }, line: '#5d6a8a', pivot: [6, 0],
  },
  bowtie: {
    rows: ['bb...bb', 'bbbkbbb', 'bb...bb'],
    pal: { b: '#a8743c', k: '#6b4a1f' }, line: '#3a2410', pivot: [3, 1],
  },
  cape: {
    rows: [
      '......cccccccccc......', '.....cccccccccccc.....', '....cccccccccccccc....', '...cccccccccccccccc...',
      '..cccccccccccccccccc..', '..cccccccccccccccccc..', '.cccccccccccccccccccc.', '.cccccccccccccccccccc.',
      'cccccccccccccccccccccc', 'cCcccCcccCcccCcccCcccC',
    ],
    pal: { c: '#c99a4b', C: '#e6c88a' }, line: '#5a3d16', pivot: [11, 0],
  },
  angel: {
    rows: [
      'ww..........................ww', 'wWw........................wWw', 'wwWw......................wWww',
      '.wwWww..................wwWww.', '..wwwWww..............wwWwww..', '...wwwwww............wwwwww...',
      '....wwww..............wwww....', '.....ww................ww.....',
    ],
    pal: { w: '#ffffff', W: '#d3e0f0' }, line: '#6d7a96', pivot: [15, 6],
  },
  dragonwings: {
    rows: [
      'r............................r', 'rr..........................rr', 'rRr........................rRr',
      'rRRrr....................rrRRr', '.rRRRrr................rrRRRr.', '..rrRRRrr............rrRRRrr..',
      '...r.r.rrr..........rrr.r.r...',
    ],
    pal: { r: '#c8402f', R: '#f5a64a' }, line: '#4a1a14', pivot: [15, 5],
  },
  leafglasses: {
    rows: ['g###.......###g', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'],
    pal: { '#': '#4f9a3f', w: '#dff3c8', L: '#ffffff', g: '#8fdc7a' }, line: '#22421a', pivot: [7, 2],
  },
  heartglasses: {
    rows: ['.r.r.......r.r.', 'rprpr#####rprpr', 'rpppr.....rpppr', '.rpr.......rpr.', '..r.........r..'],
    pal: { r: '#e2493b', p: '#ffb3c1', '#': '#c8402f' }, line: '#4a1a14', pivot: [7, 2],
  },
  woodglasses: {
    rows: ['.###.......###.', '#www#######www#', '#wLw#.....#wLw#', '.###.......###.'],
    pal: { '#': '#8a5a35', w: '#f3e3c8', L: '#ffffff' }, line: '#3a2410', pivot: [7, 2],
  },
  butterfly: {
    rows: [
      '.gggg....................gggg.', 'gGGGgg..................ggGGGg', 'gGyGGgg................ggGGyGg',
      'gGGGGGgg..............ggGGGGGg', '.ggGGGgg..............ggGGGgg.', '..gGyGg................gGyGg..',
      '..gGGGg................gGGGg..', '...ggg..................ggg...',
    ],
    pal: { g: '#3f9a5a', G: '#8fdc7a', y: '#ffd75e' }, line: '#1d4a2a', pivot: [15, 5],
  },
  wavecape: {
    rows: [
      '......bbbbbbbbbb......', '.....bbbbbbbbbbbb.....', '....bbbbbbbbbbbbbb....', '...bbbbbbbbbbbbbbbb...',
      '..bbbbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbbbb..', '.bbbbbbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbbbbbb.',
      'bbwwbbbwwbbbwwbbbwwbbb', 'bwbbwbwbbwbwbbwbwbbwbw',
    ],
    pal: { b: '#4f8fd6', w: '#bfe3f7' }, line: '#1f3f6b', pivot: [11, 0],
  },
};

const wearCache = new Map();
/** Hình đã viền của món đồ `id` (canvas ở độ phân giải pixel nghệ thuật), hoặc null nếu chưa vẽ. */
export function wearImage(id) {
  if (!wearCache.has(id)) {
    const a = WEAR_ART[id];
    wearCache.set(id, a ? bitmap(a.rows, a.pal, a.line) : null);
  }
  return wearCache.get(id);
}

/**
 * Góc trên-trái để đặt hình món `id` khi biết các điểm neo (`anchors`) và nửa bề ngang đầu (`headRx`).
 * Dùng chung cho pet vẽ bằng bộ khung và bé khách mời Petdex (điểm neo dò từ ảnh).
 */
export function wearSpotAt(id, anchors, headRx) {
  const a = WEAR_ART[id];
  const slot = WEARABLES[id].slot;
  const anchor = anchors[slot];
  let x = anchor.x + (a.dx ?? 0);
  let y = anchor.y;
  if (slot === 'head') {
    x += Math.round((a.side ?? 0) * headRx);
    y += a.sink ?? 2;
  }
  // Ảnh đã viền dày thêm 1 pixel mỗi bên; khung hình cũng vậy, nên hai phần lệch nhau triệt tiêu.
  return { x: x - a.pivot[0], y: y - a.pivot[1] };
}

const wearSpot = (id, sk) => wearSpotAt(id, sk.anchors, sk.head.rx);

// ---------------------------------------------------------------- hoạt ảnh

export const RIG_ANIMS = {
  idle: { fps: 5, frames: [{ tail: 0 }, { tail: 1 }, { by: 1, tail: 1 }, { by: 1, blink: 1, tail: 0 }, { by: 1, tail: -1 }, { tail: -1 }] },
  wave: { fps: 6, frames: [{ armR: 1, mouth: 'open' }, { armR: 2, mouth: 'open' }, { armR: 1, mouth: 'open' }, { armR: 2, mouth: 'open', blink: 1 }] },
  jump: {
    fps: 9,
    frames: [
      { sq: -2, by: 1 }, { lift: -3, sq: 1 }, { lift: -6, sq: 1, armL: 1, armR: 1, mouth: 'open', tail: 1 },
      { lift: -6, armL: 1, armR: 1, mouth: 'open', tail: -1 }, { lift: -3 }, { sq: -2, by: 1 },
    ],
  },
  sad: { fps: 3, frames: [{ hy: 1, ear: 1, mouth: 'sad' }, { hy: 1, ear: 1, mouth: 'sad', tear: 1 }, { hy: 2, ear: 1, mouth: 'sad', tear: 2 }, { hy: 1, ear: 1, mouth: 'sad' }] },
  run: {
    fps: 10,
    frames: [
      { step: 1, hx: 1, look: 1, tail: -1 }, { step: 1, by: 1, hx: 1, look: 1, tail: -1 }, { step: 0, hx: 1, look: 1 },
      { step: -1, hx: 1, look: 1, tail: 1 }, { step: -1, by: 1, hx: 1, look: 1, tail: 1 }, { step: 0, hx: 1, look: 1 },
    ],
  },
  think: { fps: 3, frames: [{ look: -1 }, { look: -1, hx: -1 }, { look: 0 }, { look: 1, hx: 1 }, { look: 1 }, { look: 0, blink: 1 }] },
  busy: { fps: 6, frames: [{ armL: 1, by: 1 }, { armR: 1 }, { armL: 1 }, { armR: 1, by: 1 }] },
  spin: { fps: 8, frames: [{ mouth: 'open' }, { look: 1, mouth: 'open' }, { mirror: true, mouth: 'open' }, { mirror: true, look: 1, mouth: 'open' }] },
};

/**
 * Vẽ một khung hình: pet `species` ở giai đoạn `stageKey`, dáng `pose`, đeo các món `wear` ({ head, face, neck, back }).
 * Trả về canvas (RIG_W + 2) × (RIG_H + 2) ở độ phân giải pixel nghệ thuật.
 */
export function drawFrame(species, stageKey, pose = {}, wear = {}, tick = 0, { anchors = false } = {}) {
  const sp = typeof species === 'string' ? SPECIES_BY_ID[species] : species;
  const stage = LIFE_STAGES.find((s) => s.key === stageKey) ?? LIFE_STAGES.at(-2);
  const pal = paletteOf(sp, stage);
  const sk = skeleton(sp, stage, pose);

  // 1) Thân pet trên một lớp, rồi viền một lần để mọi bộ phận liền khối.
  const cr = layer();
  if (sp.pattern === 'shell') drawShell(cr.p, sk, pal);
  drawTail(cr.p, sk, sp, pal, pose);
  drawLegsBack(cr.p, sk, sp, pal);
  drawEars(cr.g, sk, sp, pal, pose, false);
  cr.g.drawImage(drawBody(sk, sp, pal), 0, 0);
  drawLimbs(cr.p, sk, sp, pal, pose);
  cr.g.drawImage(drawHead(sk, sp, pal, tick), 0, 0);
  drawEars(cr.g, sk, sp, pal, pose, true);
  drawWings(cr.p, sk, sp, pal, pose);
  if (!wear.head) drawTopFeature(cr.g, sk, sp, pal, tick);
  if (sp.feature === 'leafcollar' && !wear.neck) drawLeafCollar(cr.p, sk);
  if (stage.look.elder) drawCane(cr.p, sk);
  const body = outline(cr.c);

  // 2) Ghép: đồ sau lưng → pet → mặt → đồ trước người.
  const [out, g] = makeCanvas(RIG_W + 2, RIG_H + 2);
  const put = (id) => {
    const img = id && wearImage(id);
    if (!img) return;
    const { x, y } = wearSpot(id, sk);
    g.drawImage(img, x, y);
  };
  const aura = AURAS[sp.rarity];
  if (aura) drawAura(g, sk, aura, tick);
  put(wear.back);
  g.drawImage(body, 0, 0);
  drawFace(g, sk, sp, pal, pose, stage, tick);
  if (sp.feature === 'bubble') {
    const rise = tick % 6;
    const p = new Pen(g);
    const bx = sk.head.x + sk.head.rx + 2;
    const by = sk.head.top + 4 - rise;
    p.px(bx, by - 1, '#bfe9fb');
    p.px(bx - 1, by, '#bfe9fb');
    p.px(bx + 1, by, '#bfe9fb');
    p.px(bx, by + 1, '#bfe9fb');
    p.px(bx, by, '#ffffff');
  }
  put(wear.neck);
  if (sp.feature === 'cup') drawHeldCup(g, sk, sp, pal, pose);
  put(wear.face);
  put(wear.head);
  const set = fullSetOf(wear);
  if (set) drawSetSparkles(g, sk, ELEMENTS[set], tick);
  if (aura) drawMotes(g, sk, aura, tick);

  if (anchors) {
    const colors = { head: '#ff3b6b', face: '#3bb3ff', neck: '#ffb800', back: '#7a5cff' };
    for (const [k, a] of Object.entries(sk.anchors)) {
      g.fillStyle = colors[k];
      g.fillRect(a.x + 1, a.y + 1, 1, 1);
    }
  }
  if (!pose.mirror) return out;
  const [flip, fg] = makeCanvas(out.width, out.height);
  fg.translate(out.width, 0);
  fg.scale(-1, 1);
  fg.drawImage(out, 0, 0);
  return flip;
}

/** Toàn bộ khung hình của một hoạt ảnh (đã tính sẵn để chạy mượt). */
export function animFrames(species, stageKey, anim, wear = {}, opts = {}) {
  const def = RIG_ANIMS[anim] ?? RIG_ANIMS.idle;
  return def.frames.map((pose, i) => drawFrame(species, stageKey, pose, wear, i, opts));
}

export const elementOf = (sp) => ELEMENTS[sp.element];
