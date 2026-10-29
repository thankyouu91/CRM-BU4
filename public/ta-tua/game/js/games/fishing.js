// Câu cá: phao chạy qua lại trên thanh căng dây, bấm đúng lúc phao nằm trong vùng xanh để giật cần.
import { GAMES, fishSequence, rng } from '../shared/minigames.js';
import { OUTLINE, Pen, bitmap, makeCanvas, outline, seeded, shadeBlob } from '../pixel.js';
import { burst, floatText } from '../fx.js';

const W = 240;
const H = 150;
const COUNTDOWN = 2.4;
const MIN_GAP = 1.25; // server chặn quá một lần quăng mỗi 1,2 giây
const CAST = 0.7;
const HOOK = 4.5;
const REEL = 1.5;
const BAR = { x: 56, y: 28, w: 128, h: 8 };
const ROD = { x: 39, y: 99 };
const TIP = { x: 96, y: 58 };
const BUCKET = { x: 37, y: 97 };
const RARE = new Set(['vang', 'trang']);
const ease = (u) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;
const lerp = (a, b, u) => a + (b - a) * u;
const tri = (u) => (u % 2 < 1 ? u % 2 : 2 - (u % 2));

const LOOKS = {
  ro: { rx: 7, ry: 3, tail: 4, fork: true, body: '#a3b866', light: '#d2df93', dark: '#71893f', fin: '#e08a45', belly: '#e9e6aa' },
  chep: { rx: 8, ry: 4, tail: 5, fork: true, body: '#eba24e', light: '#fbd590', dark: '#c0702c', fin: '#dd5f3c', belly: '#fbe2aa' },
  hoi: { rx: 9, ry: 3, tail: 4, fork: true, body: '#f2a0a0', light: '#ffd2cc', dark: '#cf6f78', fin: '#7d95ad', belly: '#f3f6f8' },
  vang: { rx: 5, ry: 4, tail: 6, fork: false, body: '#ffb733', light: '#ffe58c', dark: '#e57a12', fin: '#ffd36a', belly: '#fff0b6' },
  trang: { rx: 6, ry: 6, tail: 3, fork: false, body: '#e4ddff', light: '#ffffff', dark: '#ab9fe6', fin: '#c9bbff', belly: '#f6f3ff' },
};

function fishArt(id) {
  const L = LOOKS[id];
  const fin = id === 'trang' ? 4 : 2;
  const [c, g] = makeCanvas(L.rx * 2 + L.tail + 1, L.ry * 2 + fin * 2 + 1);
  const p = new Pen(g);
  const cx = L.rx;
  const cy = L.ry + fin;
  const each = (fn) => {
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (((x - cx) / (L.rx + 0.5)) ** 2 + ((y - cy) / (L.ry + 0.5)) ** 2 <= 1) fn(x, y);
    }
  };
  // đuôi hình quạt, cá thường chẻ đôi
  for (let k = 0; k < L.tail; k++) {
    const half = Math.round(1 + k * (L.fork ? 0.75 : 1));
    for (let j = -half; j <= half; j++) {
      if (!L.fork || k < 2 || Math.abs(j) >= k - 1) p.px(cx + L.rx - 1 + k, cy + j, Math.abs(j) === half || k === L.tail - 1 ? L.dark : L.fin);
    }
  }
  if (id === 'trang') {
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) p.rect(cx - 2 + k, cy + s * (L.ry + 1 + k), 5 - k, 1, k === 3 ? L.dark : L.fin);
  } else {
    p.rect(cx - 2, cy - L.ry - 1, 6, 1, L.fin);
    p.rect(cx - 2, cy + L.ry + 1, 2, 1, L.fin);
    if (id === 'ro') for (let x = cx - 2; x < cx + 4; x += 2) p.px(x, cy - L.ry - 2, L.dark);
    else p.rect(cx - 1, cy - L.ry - 2, 3, 1, L.fin);
  }
  p.ellipse(cx, cy, L.rx, L.ry, L.body);
  each((x, y) => y > cy + L.ry * 0.3 && p.px(x, y, L.belly));
  if (id === 'ro') each((x, y) => (x - cx) % 3 === 0 && x > 2 && y <= cy + 1 && p.px(x, y, L.dark));
  if (id === 'chep') each((x, y) => y <= cy && x > 3 && (x + (y % 2) * 2) % 4 === 0 && p.px(x, y, L.dark));
  if (id === 'hoi') each((x, y) => y < cy - 1 && p.px(x, y, (x * 7 + y * 3) % 11 === 0 ? '#4f6680' : '#8da5bb'));
  if (id === 'trang') {
    p.disc(cx + 1, cy, 2, '#ffe39a');
    p.disc(cx + 2, cy - 1, 2, L.body);
  }
  shadeBlob(c, cx - 2, cy - 1, L.rx, { light: L.light, mid: L.body, dark: L.dark });
  if (id === 'vang') p.rect(cx - 3, cy - 2, 2, 2, '#ffffff');
  p.px(id === 'vang' ? cx - 3 : cx - L.rx + 2, cy - 1, OUTLINE);
  return outline(c);
}

const sprites = new Map();
function fishSprite(id) {
  if (!sprites.has(id)) sprites.set(id, ((c) => ({ c, url: c.toDataURL() }))(fishArt(id)));
  return sprites.get(id);
}

let SPRITES = null; // phao và dấu chấm than khi cá cắn câu
function makeSprites() {
  const bang = (c) => bitmap(['cc', 'cc', 'cc', 'cc', '..', 'cc'], { c }, OUTLINE);
  return {
    bobber: bitmap(['..k..', '.rrr.', 'rhrrr', 'rrrrr', 'wwwww', '.www.'], { k: OUTLINE, r: '#e8473f', h: '#ff9d92', w: '#fffaf0' }, OUTLINE),
    common: bang('#ff6f61'),
    rare: bang('#ffd75e'),
  };
}

function drawPond() {
  const [c, g] = makeCanvas(W, H);
  const p = new Pen(g);
  const rand = seeded(23);
  p.vGradient(0, 0, W, 46, ['#86c9ec', '#b9e2f4', '#ffe7c9']);
  p.disc(198, 17, 10, '#fff0bf');
  p.disc(198, 17, 8, '#fffae3');
  for (const [x, y, w] of [[28, 10, 24], [118, 6, 16], [158, 14, 20]]) {
    for (const [dx, dy, r] of [[-w / 6, -2, 3], [w / 8, -3, 4]]) p.disc(x + dx, y + dy, r, '#ffffff');
    p.ellipse(x, y, w / 2, 2, '#ffffff');
    p.rect(x - w / 2 + 2, y + 2, w - 4, 1, '#dcedf6');
  }
  for (let x = 0; x < W; x++) {
    const far = 30 + Math.round(3 * Math.sin(x / 19 + 1) + 2 * Math.sin(x / 7));
    const near = 38 + Math.round(2 * Math.sin(x / 11 + 3) + Math.sin(x / 5));
    p.rect(x, far, 1, 46 - far, '#b3d8a0');
    p.px(x, far, '#c9e6b8');
    p.rect(x, near, 1, 46 - near, '#8cc474');
  }
  for (let k = 0; k < 11; k++) {
    const x = 6 + k * 23 + rand() * 8;
    const r = 3 + Math.round(rand() * 3);
    p.disc(x, 42 - r, r, '#6aa957');
    p.disc(x - 1, 41 - r, r - 1, '#7fbd66');
  }
  p.vGradient(0, 46, W, H - 46, ['#a4dff0', '#6cc0de', '#3f95c4']);
  p.ditherFill(0, 47, W, 6, '#7fbf8a', 0.45, (x, y) => y < 49 + 2 * Math.sin(x / 9) + Math.sin(x / 4));
  p.rect(0, 46, W, 1, '#e8f8fc');
  for (let k = 0; k < 46; k++) {
    const y = 52 + Math.floor(rand() * (H - 52));
    p.rect(rand() * W, y, 2 + rand() * (2 + (y - 46) / 12), 1, y > 98 ? '#5aaed4' : '#c4ecf6');
  }
  // lá sen, một lá có hoa
  for (const [x, y, r] of [[152, 137, 7], [190, 127, 5], [124, 146, 6], [214, 142, 4]]) {
    const ry = Math.ceil(r * 0.4);
    p.ellipse(x, y + 1, r, ry, '#3f7f3a');
    p.ellipse(x, y, r, ry, '#79c25a');
    p.ellipse(x - 1, y - 1, r - 2, Math.max(0, ry - 1), '#9bd67a');
    p.rect(x + 1, y - ry, Math.ceil(r / 2), 1, '#6cc0de');
  }
  p.rect(149, 133, 5, 3, '#ffb7cf');
  p.rect(150, 132, 3, 1, '#ffd6e4');
  p.px(151, 134, '#ffe26b');
  // cầu gỗ, cọc và xô đựng cá
  p.rect(0, 110, 76, 6, '#d9a46e');
  p.rect(0, 110, 76, 1, '#f0c48f');
  for (let x = 6; x < 76; x += 8) p.rect(x, 110, 1, 6, '#b97e4c');
  p.rect(0, 116, 76, 4, '#9b6238');
  p.rect(0, 120, 77, 1, OUTLINE);
  p.rect(76, 110, 1, 10, OUTLINE);
  for (const x of [8, 38, 68]) {
    p.rect(x, 121, 4, 10, '#7a4f33');
    p.rect(x, 121, 1, 10, '#a0704c');
    p.ditherFill(x, 131, 4, 8, '#3d7fa8', 0.5);
    p.rect(x - 3, 130, 10, 1, '#c4ecf6');
  }
  const [b, bg] = makeCanvas(14, 12);
  const bp = new Pen(bg);
  for (let y = 0; y < 12; y++) bp.rect(Math.floor(y / 6), y, 14 - Math.floor(y / 6) * 2, 1, y < 2 ? '#5e3a22' : y % 5 === 3 ? '#8b98a6' : '#c98f5a');
  bp.rect(1, 2, 2, 9, '#e3ad78');
  g.drawImage(outline(b), BUCKET.x - 7, 97);
  return c;
}

/** Đường cong bậc hai võng xuống `sag` px; `thick(t)` làm dày đoạn gốc cần câu. */
function curve(p, x0, y0, x1, y1, sag, color, thick) {
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2 + sag];
  for (let i = 0, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.3) + 1; i <= n; i++) {
    const t = i / n;
    const x = lerp(lerp(x0, mx, t), lerp(mx, x1, t), t);
    const y = lerp(lerp(y0, my, t), lerp(my, y1, t), t);
    p.px(x, y, typeof color === 'function' ? color(t) : color);
    if (thick?.(t)) p.px(x + 1, y, '#a8703f');
  }
}

export function mount(container, { seed, duration = GAMES.fishing.duration, onFinish }) {
  SPRITES ??= makeSprites();
  const { bobber } = SPRITES;
  const root = document.createElement('div');
  root.className = 'mg-root mg-fishing';
  root.innerHTML = `
    <div class="mg-stage" tabindex="0" aria-label="${GAMES.fishing.name}. ${GAMES.fishing.desc}">
      <canvas class="mg-canvas" width="${W}" height="${H}"></canvas><div class="mg-fx"></div>
      <div class="mg-hud">
        <span class="mg-pill mg-box" data-time><i class="mg-ico">⏱</i><b>0</b></span>
        <span class="mg-pill mg-box" data-score><i>🐟</i><small>Cá</small><b>0</b></span>
        <button type="button" class="btn small mg-end">Kết thúc</button>
      </div>
      <div class="mg-dock"><span class="mg-pill mg-box mg-last" hidden><small>Vừa câu</small><img alt="" /><b></b></span></div>
      <div class="mg-catch mg-box"><img alt="" /><b></b><small></small></div>
      <div class="mg-count"><span>Sẵn sàng</span><b>3</b><small>Bấm chuột, chạm màn hình hoặc nhấn Space khi phao nằm trong vùng xanh.</small></div>
      <div class="mg-banner mg-box" hidden></div>
    </div>`;
  container.append(root);
  const $ = (s) => root.querySelector(s);
  const stage = $('.mg-stage');
  const fx = $('.mg-fx');
  const g = $('canvas').getContext('2d');
  g.imageSmoothingEnabled = false;
  const p = new Pen(g);
  const bg = drawPond();
  const seq = fishSequence(seed);
  const rand = seeded(5);
  const reeds = Array.from({ length: 24 }, (_, k) => ({ x: k < 16 ? 204 + rand() * 36 : 78 + rand() * 14, h: (k < 16 ? 18 : 10) + rand() * (k < 16 ? 26 : 14), cat: rand() < 0.4, ph: rand() * 6 }));
  const glints = Array.from({ length: 16 }, () => ({ x: rand() * W, y: 52 + rand() * 90, len: 2 + rand() * 4, sp: 1 + rand() * 3, ph: rand() * 6 }));

  const caught = [];
  const ripples = [];
  let phase = 'ready';
  let cast = null; // lần quăng hiện tại: cá, vùng xanh, chỗ phao rơi
  let bar = null;
  let lastFish = null;
  let t0 = 0; // lúc bắt đầu pha hiện tại (giây kể từ khi gắn)
  let lastCast = -Infinity;
  let kickAt = -9;
  let lastRipple = 0;
  let shown = 0;
  let raf = 0;
  let finished = false;
  const born = performance.now();
  const clock = () => (performance.now() - born) / 1000;
  const scale = () => stage.clientWidth / W;
  const at = (x, y) => [x * scale(), y * scale()];
  const px = () => Math.max(2, Math.round(scale()));
  const marker = (t) => tri((t - t0) * cast.fish.speed);
  const inZone = (pos) => pos >= cast.zone && pos <= cast.zone + cast.fish.zone;

  function startCast(t) {
    const i = caught.length;
    const r = rng(seed + i);
    cast = { fish: seq[i], zone: 0.1 + r() * (0.8 - seq[i].zone), x: 118 + Math.random() * 74, y: 80 + Math.random() * 30, wait: 0.5 + Math.random() * 0.9 };
    [phase, t0, bar] = ['cast', t, null];
  }

  function resolve(t, ok, escaped = false) {
    if (t - lastCast < MIN_GAP) return;
    Object.assign(bar, { ok, pos: marker(t), close: t + 0.4 });
    lastCast = kickAt = t0 = t;
    caught.push(ok);
    phase = 'reel';
    cast.ok = ok;
    const [bx, by] = at(cast.x, cast.y);
    if (!ok) {
      floatText(fx, bx, by - 20, escaped ? 'Cá chạy mất!' : 'Hụt rồi!', { color: '#ffd0c8', size: 18 });
      return burst(fx, bx, by, { icon: 'bubble', count: 5, spread: 50, rise: 40, life: 800, px: px() });
    }
    const { fish } = cast;
    const rare = RARE.has(fish.id);
    const { c, url } = fishSprite(fish.id);
    lastFish = fish.id;
    $('[data-score] b').textContent = caught.filter(Boolean).length;
    const last = $('.mg-last');
    last.hidden = false;
    Object.assign(last.querySelector('img'), { src: url });
    last.querySelector('b').textContent = fish.name;
    last.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
    const card = $('.mg-catch');
    card.classList.toggle('rare', rare);
    Object.assign(card.querySelector('img'), { src: url, width: c.width * 4 });
    card.querySelector('b').textContent = fish.name;
    card.querySelector('small').textContent = rare ? `Cá hiếm! +${fish.coins} xu` : `+${fish.portions} phần cá`;
    card.animate([
      { opacity: 0, transform: 'translate(-50%, 10px) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1.08)', offset: 0.15 },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%, -8px) scale(.95)' },
    ], { duration: 1350, easing: 'ease-out' });
    burst(fx, bx, by, { icon: 'drop', count: 6, spread: 60, rise: 45, life: 700, px: px(), stagger: 10 });
    if (!rare) return;
    burst(fx, ...at(W / 2, 40), { icon: 'sparkle', count: 16, spread: 300, rise: 110, life: 1500, px: px(), stagger: 30 });
    stage.animate([{ filter: 'brightness(1.5)' }, { filter: 'none' }], { duration: 450, easing: 'ease-out' });
  }

  function press() {
    if (finished) return;
    if (phase === 'hook') return resolve(clock(), inZone(marker(clock())));
    if ((phase === 'cast' || phase === 'nibble') && !cast.hinted) {
      cast.hinted = true;
      floatText(fx, ...at(cast.x, cast.y - 8), 'Chờ cá cắn câu…', { color: '#fff6d8', size: 15, rise: 30 });
    }
  }

  function update(t) {
    if (t >= duration) return finish('Hết giờ!');
    const count = $('.mg-count');
    const n = Math.ceil((COUNTDOWN - t) / (COUNTDOWN / 3));
    if (t < COUNTDOWN && n !== shown) {
      count.querySelector('b').textContent = shown = n;
      count.querySelector('b').animate([{ transform: 'scale(1.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,1.5,.4,1)' });
    } else if (t >= COUNTDOWN && shown) {
      shown = 0;
      count.classList.add('go');
      count.querySelector('b').textContent = 'Câu thôi!';
    }
    const left = Math.max(0, Math.ceil(duration - Math.max(t, COUNTDOWN)));
    $('[data-time] b').textContent = left;
    $('[data-time]').classList.toggle('warn', left <= 5);

    if (phase === 'ready' && t >= COUNTDOWN) startCast(t);
    else if (phase === 'cast' && t - t0 >= CAST) {
      [phase, t0] = ['nibble', t];
      ripples.push({ x: cast.x, y: cast.y, at: t, r: 16, life: 0.9 });
    } else if (phase === 'nibble' && t - t0 >= cast.wait) {
      [phase, t0, bar] = ['hook', t, { open: t, close: Infinity, ok: null }];
      if (RARE.has(cast.fish.id)) burst(fx, ...at(cast.x, cast.y - 10), { icon: 'twinkle', count: 6, spread: 80, rise: 50, px: px() });
    } else if (phase === 'hook' && t - t0 >= HOOK) resolve(t, false, true);
    else if (phase === 'reel' && t - t0 >= REEL) startCast(t);
    if (t - lastRipple > ({ hook: 0.22, nibble: 1.1 }[phase] ?? Infinity)) {
      lastRipple = t;
      ripples.push({ x: cast.x, y: cast.y, at: t, r: phase === 'hook' ? 9 : 6, life: 0.7 });
    }
  }

  function drawBar(t) {
    const leave = bar && t > bar.close ? (t - bar.close) / 0.25 : 0;
    if (!bar || leave >= 1) return;
    const { x, w, h } = BAR;
    const y = Math.round(BAR.y - 34 * (1 - ease((t - bar.open) / 0.3)) - 34 * leave * leave);
    const rare = RARE.has(cast.fish.id);
    const pos = bar.ok === null ? marker(t) : bar.pos;
    const zx = x + Math.round(cast.zone * w);
    const zw = Math.max(2, Math.round(cast.fish.zone * w));
    const mx = x + Math.min(w - 1, Math.round(pos * w)) + (bar.ok === false ? Math.round(Math.sin(t * 60) * 2) : 0);
    const rest = bar.ok === null ? 1 - (t - bar.open) / HOOK : 0;
    p.rect(x - 2, y - 2, w + 4, h + 7, rare ? '#7a4c0e' : OUTLINE);
    p.rect(x - 1, y - 1, w + 2, h + 2, rare ? '#fff1c2' : '#fffaf0');
    p.rect(x, y, w, h, '#dcc3a3');
    p.ditherFill(x, y, w, h, '#cdb08c', 0.25);
    p.rect(zx, y, zw, h, bar.ok ? '#e9fff5' : inZone(pos) ? '#a8f0d4' : '#7fd0b4');
    p.rect(zx, y, zw, 1, '#d4fbea');
    p.rect(zx, y + h - 1, zw, 1, '#4fae93');
    p.rect(x, y + h + 2, w, 2, '#5a3e2b');
    p.rect(x, y + h + 2, Math.round(w * rest), 2, rest > 0.3 ? '#f4c24f' : '#e8574f');
    // kim phao: đầu đỏ, thân sáng; xanh khi trúng, đỏ khi trượt
    p.rect(mx - 2, y - 6, 5, 4, OUTLINE);
    p.rect(mx - 1, y - 5, 3, 2, bar.ok === false ? '#9a9a9a' : '#e8473f');
    p.px(mx - 1, y - 5, '#ff9d92');
    p.rect(mx - 1, y - 2, 3, h + 4, OUTLINE);
    p.rect(mx, y - 2, 1, h + 3, bar.ok === null ? '#fffaf0' : bar.ok ? '#8fe0b0' : '#ff7a6e');
    if (rare) for (let k = 0; k < 3; k++) if (Math.sin(t * 6 + k) > 0) p.px(x + w / 2 + Math.cos(t * 2 + k * 2.1) * (w / 2 + 6), y + 3 + Math.sin(t * 2 + k * 2.1) * 9, '#fff1a8');
  }

  // Vẽ phao (y là mép nước) và trả về điểm buộc dây ở đỉnh phao.
  function bob(x, y, sunk = 0, sag = 0) {
    g.drawImage(bobber, 0, 0, bobber.width, bobber.height - sunk, Math.round(x) - 3, Math.round(y) - 5, bobber.width, bobber.height - sunk);
    return { x: Math.round(x), y: Math.round(y) - 5, sag };
  }

  function draw(t) {
    g.drawImage(bg, 0, 0);
    for (const s of glints) if (Math.sin(t * 2 + s.ph) > 0) p.rect(((s.x + t * s.sp) % (W + 10)) - 5, s.y, s.len, 1, '#e3f7fc');
    for (let k = 0; k < 6; k++) if (Math.sin(t * 5 + k * 1.7) > 0.2) p.rect(195 + Math.round(Math.sin(t * 2 + k) * 3), 49 + k * 4, 5 - (k >> 1), 1, '#fff6d6');
    for (const r of reeds) {
      for (let j = 0; j < r.h; j++) {
        const sway = Math.round(Math.sin(t * 1.3 + r.ph) * (j / r.h) ** 2 * 2);
        p.px(r.x + sway, H - j, j % 6 === 0 ? '#4f9a43' : '#6fb850');
        if (r.cat && j === Math.floor(r.h) - 1) p.rect(r.x + sway - 1, H - j - 4, 2, 5, '#8a5a3a');
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const { x, y, at: a, r, life } = ripples[i];
      const u = (t - a) / life;
      if (u >= 1) ripples.splice(i, 1);
      else for (let k = 0, n = Math.ceil((2 + u * r) * 5); k < n; k++) p.px(x + Math.cos((k / n) * 6.283) * (2 + u * r), y + 1 + Math.sin((k / n) * 6.283) * (2 + u * r) * 0.32, `rgba(236, 250, 255, ${0.85 * (1 - u)})`);
    }

    const tip = { ...TIP };
    if (phase === 'hook') tip.y += 4 + Math.round(Math.sin(t * 22));
    const kick = (t - kickAt) / 0.35;
    if (kick >= 0 && kick < 1) tip.y -= Math.round(7 * Math.sin(kick * Math.PI));
    const u = t - t0;
    let line;
    if (phase === 'cast') {
      const k = ease(u / CAST);
      line = bob(lerp(tip.x, cast.x, k), lerp(tip.y + 13, cast.y, k) - 26 * Math.sin(Math.PI * k), 0, 4);
    } else if (phase === 'nibble') {
      const dip = Math.sin(t * 13) > 0.92 ? 1 : 0;
      line = bob(cast.x, cast.y + Math.round(Math.sin(t * 3) * 0.6) + dip, 2 + dip, 8);
    } else if (phase === 'hook') {
      const wx = cast.x + Math.round(Math.sin(t * 25));
      line = bob(wx, cast.y + 2, 4, 1);
      g.drawImage(SPRITES[RARE.has(cast.fish.id) ? 'rare' : 'common'], wx - 1, Math.round(cast.y - 18 - Math.abs(Math.sin(t * 10)) * 2));
    } else if (phase === 'reel' && cast.ok && u < 0.9) {
      // cá vọt khỏi mặt nước rồi rơi vào xô
      const k = u / 0.9;
      const [fx0, fy0] = [lerp(cast.x, BUCKET.x, ease(k)), lerp(cast.y, BUCKET.y - 2, k) - 40 * Math.sin(Math.PI * k)];
      const s = fishSprite(cast.fish.id).c;
      if (RARE.has(cast.fish.id)) for (const [r, a] of [[14, 0.12], [10, 0.18], [6, 0.25]]) p.disc(fx0, fy0, r, `rgba(255, ${cast.fish.id === 'trang' ? '250, 210' : '220, 120'}, ${a})`);
      g.drawImage(s, Math.round(fx0 - s.width / 2), Math.round(fy0 - s.height / 2));
      line = { x: Math.round(fx0 - s.width / 2 + 2), y: Math.round(fy0), sag: 0 };
    } else if (phase === 'reel' && !cast.ok && u < 0.7) {
      const k = ease(u / 0.7);
      line = bob(lerp(cast.x, tip.x + 1, k), lerp(cast.y, tip.y + 13, k) - 18 * Math.sin(Math.PI * k), 0, 3);
    } else {
      if (phase === 'reel' && cast.ok && !cast.landed) burst(fx, ...at(BUCKET.x, BUCKET.y), { icon: 'drop', count: 5, spread: 40, rise: 30, life: 600, px: px(), stagger: 0 });
      if (cast) cast.landed = true;
      line = bob(tip.x + 1, tip.y + 13);
    }
    if (lastFish) {
      p.px(BUCKET.x - 2, BUCKET.y - 3, LOOKS[lastFish].fin);
      p.px(BUCKET.x, BUCKET.y - 3, LOOKS[lastFish].fin);
      p.rect(BUCKET.x - 1, BUCKET.y - 2, 1, 2, LOOKS[lastFish].fin);
    }
    curve(p, ROD.x, ROD.y, tip.x, tip.y, -6, (k) => (k < 0.14 ? '#e3b47a' : '#6b4229'), (k) => k < 0.55);
    p.disc(ROD.x + 9, ROD.y - 6, 2, '#8a96a3');
    p.px(ROD.x + 9, ROD.y - 6, '#4a5560');
    curve(p, tip.x, tip.y, line.x, line.y, line.sag, 'rgba(255, 251, 240, 0.9)');
    drawBar(t);
  }

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = clock();
    update(t);
    if (!finished) draw(t);
  };
  raf = requestAnimationFrame(frame);
  const endTimer = setTimeout(() => finish('Hết giờ!'), duration * 1000 + 50);

  function finish(label) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    stage.classList.add('is-over');
    $('.mg-count').hidden = true;
    $('[data-time] b').textContent = Math.max(0, Math.ceil(duration - clock()));
    Object.assign($('.mg-banner'), { textContent: label, hidden: false });
    onFinish?.({ caught: caught.slice() });
  }

  const onPointer = (e) => {
    if (e.button > 0 || e.target.closest('.mg-end')) return;
    stage.focus({ preventScroll: true });
    press();
  };
  const onKey = (e) => {
    if ((e.code !== 'Space' && e.key !== 'Enter') || e.target.closest?.('input, textarea, select, button, a, [contenteditable]')) return;
    e.preventDefault();
    if (!e.repeat) press();
  };
  stage.addEventListener('pointerdown', onPointer);
  $('.mg-end').addEventListener('click', () => finish('Đã kết thúc'));
  window.addEventListener('keydown', onKey);
  stage.focus({ preventScroll: true });

  return () => {
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    window.removeEventListener('keydown', onKey);
    root.remove();
  };
}
