// Hứng trân châu: di cốc theo chuột/ngón tay hoặc phím ←/→, hứng trân châu rơi và né đá lạnh.
import { DROPS, GAMES, pearlSchedule } from '../shared/minigames.js';
import { OUTLINE, Pen, bitmap, makeCanvas, seeded } from '../pixel.js';
import { burst, floatText } from '../fx.js';

const W = 240;
const H = 150;
const COUNTDOWN = 2.4;
const FLOOR = 139; // mặt quầy: vật rơi trượt chạm ở đây
const CUP = { base: 142, h: 24, top: 24, bottom: 17 };
const MOUTH = CUP.base - CUP.h;
const KEY_SPEED = 200;
const KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let ITEMS = null;
function makeItems() {
  const ball = ['..ppp..', '.phhpp.', 'phwhppp', 'phhpppp', 'pppppdp', '.ppppd.', '..ddd..'];
  ITEMS = {
    pearl: bitmap(ball, { p: '#5b3b2b', h: '#8a6450', w: '#e2c6b0', d: '#3a2419' }, OUTLINE),
    gold: bitmap(ball, { p: '#ffc93c', h: '#ffe58c', w: '#ffffff', d: '#d18a12' }, '#7a4c0e'),
    ice: bitmap(['.iiiiii.', 'iwwiiiiI', 'iwiiiiiI', 'iiiiiiiI', 'iiiiiiiI', 'iiiiiiII', 'iiiiiIII', '.IIIIII.'],
      { i: '#c4ecff', w: '#ffffff', I: '#86c8ec' }, '#2f5d85'),
  };
}

function drawShop() {
  const [c, g] = makeCanvas(W, H);
  const p = new Pen(g);
  const rand = seeded(8);
  p.rect(0, 0, W, 100, '#ffdfe6');
  for (let x = 0; x < W; x += 12) p.rect(x, 0, 6, 100, '#ffeaef');
  // mái hiên sọc, mép vỏ sò
  for (let x = 0; x < W; x += 12) {
    const [fill, edge] = (x / 12) % 2 ? ['#fff6ea', '#e9d2b8'] : ['#f4a3b4', '#d9708a'];
    p.ellipse(x + 6, 10, 6, 3, edge);
    p.ellipse(x + 6, 9, 6, 3, fill);
    p.rect(x, 0, 12, 9, fill);
  }
  // bảng menu phấn
  p.rect(13, 25, 60, 46, '#9b6238');
  p.rect(14, 26, 58, 44, '#c98f5a');
  p.rect(16, 28, 54, 40, '#3f5a4a');
  p.ditherFill(16, 28, 54, 40, '#4b6a57', 0.18);
  p.rect(24, 32, 22, 2, '#ffb3c7');
  for (let k = 0; k < 5; k++) {
    p.rect(22, 39 + k * 6, 12 + Math.round(rand() * 18), 1, '#f3efe6');
    p.rect(58, 39 + k * 6, 6, 1, '#ffd75e');
  }
  // biển tròn hình cốc trà sữa
  p.disc(120, 46, 16, OUTLINE);
  p.disc(120, 46, 15, '#fff6ea');
  p.disc(120, 46, 12, '#ffd2dc');
  for (let j = 0; j < 12; j++) p.rect(115 + Math.floor(j / 4), 41 + j, 11 - Math.floor(j / 4) * 2, 1, j > 8 ? '#3d2a1f' : '#d9a571');
  p.rect(114, 40, 13, 2, '#fffaf0');
  p.rect(122, 33, 2, 8, '#ff8fb1');
  // đèn thả trần
  for (const [x, shade] of [[86, '#8fd3bf'], [154, '#f4a3b4']]) {
    p.rect(x, 9, 1, 12, '#7a5a44');
    for (let j = 0; j < 5; j++) p.rect(x - 3 - j, 20 + j, 7 + j * 2, 1, j === 4 ? OUTLINE : shade);
    p.rect(x - 1, 25, 3, 2, '#fff6c4');
  }
  // kệ lọ topping
  p.rect(166, 62, 62, 3, '#b98457');
  p.rect(166, 65, 62, 1, '#8f6240');
  for (const [x, fill, dot] of [[171, '#3d2a1f', '#7a5a48'], [190, '#9fd88a', '#d6f5c4'], [209, '#f6c06a', '#fff1c4']]) {
    p.rect(x - 1, 47, 14, 15, OUTLINE);
    p.rect(x, 48, 12, 14, '#e3f2f6');
    p.rect(x + 1, 53, 10, 8, fill);
    for (let k = 0; k < 6; k++) p.px(x + 2 + (k % 3) * 3, 55 + Math.floor(k / 3) * 3, dot);
    p.rect(x - 1, 44, 14, 4, OUTLINE);
    p.rect(x, 45, 12, 2, '#c98f5a');
    p.rect(x + 1, 49, 1, 10, '#ffffff');
  }
  // ốp tường bạc hà, quầy gỗ
  p.rect(0, 100, W, 30, '#bfe8da');
  for (let x = 4; x < W; x += 10) p.rect(x, 104, 1, 26, '#a6dcc9');
  p.rect(0, 100, W, 3, '#fff6ea');
  p.rect(0, 103, W, 1, '#8fd3bf');
  p.rect(0, 129, W, 1, '#9b6238');
  p.rect(0, 130, W, 13, '#f0c592');
  p.rect(0, 130, W, 2, '#f8dbb3');
  for (let k = 0; k < 18; k++) p.rect(rand() * W, 133 + rand() * 9, 6 + rand() * 10, 1, '#e4b27c');
  p.rect(0, 143, W, 1, '#9b6238');
  p.rect(0, 144, W, 6, '#c8915f');
  for (let x = 8; x < W; x += 16) p.rect(x, 144, 1, 6, '#a8703f');
  return c;
}

function drawCup(p, cx, { squash, chill, inCup }) {
  const h = CUP.h - Math.round(squash * 3);
  const top = CUP.top + Math.round(squash * 2);
  const y0 = CUP.base - h;
  const tea = CUP.base - Math.round((h - 3) * Math.min(0.82, 0.5 + inCup * 0.02));
  p.ellipse(cx, CUP.base + 1, top / 2 + 1, 1, 'rgba(90, 50, 30, 0.28)');
  for (let j = 0; j <= h; j++) {
    const y = y0 + j;
    const half = Math.round(top / 2 - ((top - CUP.bottom) / 2) * (j / h));
    p.rect(cx - half - 1, y, half * 2 + 2, 1, OUTLINE);
    if (j < h) p.rect(cx - half, y, half * 2, 1, y > tea ? '#d9a571' : y === tea ? '#efcb9c' : 'rgba(244, 252, 255, 0.85)');
  }
  // trân châu đã hứng xếp dưới đáy, mỗi viên 2×2 có điểm sáng
  for (let k = 0; k < inCup; k++) {
    const row = Math.floor(k / 4);
    const x = cx - 6 + (k % 4) * 3 + (row % 2);
    const y = CUP.base - 3 - row * 2;
    p.rect(x, y, 2, 2, '#3d2a1f');
    p.px(x, y, '#7a5a48');
  }
  // ống hút sọc hồng xuyên qua miệng cốc
  for (let k = 0; k < 17; k++) {
    const x = cx + 3 + Math.round(k * 0.3);
    p.rect(x, y0 + 9 - k, 2, 1, k % 4 < 2 ? '#f48fb1' : '#fff3f6');
    if (k > 9) p.px(x - 1, y0 + 9 - k, OUTLINE);
  }
  p.rect(cx - top / 2 - 1, y0 - 1, top + 2, 1, OUTLINE);
  p.rect(cx - top / 2, y0, top, 1, '#ffffff');
  p.rect(cx - top / 2 + 2, y0 + 3, 1, h - 7, 'rgba(255, 255, 255, 0.85)');
  p.rect(cx - 5, tea + 3, 7, 3, '#f4a3b4');
  p.rect(cx - 4, tea + 4, 5, 1, '#fff3f6');
  if (chill > 0) p.rect(cx - top / 2, y0, top, h, `rgba(150, 215, 255, ${chill * 0.55})`);
}

export function mount(container, { seed, duration = GAMES.pearls.duration, onFinish }) {
  if (!ITEMS) makeItems();
  const root = document.createElement('div');
  root.className = 'mg-root mg-pearls';
  root.innerHTML = `
    <div class="mg-stage" tabindex="0" aria-label="${GAMES.pearls.name}. ${GAMES.pearls.desc}">
      <canvas class="mg-canvas" width="${W}" height="${H}"></canvas><div class="mg-fx"></div>
      <div class="mg-hud">
        <span class="mg-pill mg-box" data-time><i class="mg-ico">⏱</i><b>0</b></span>
        <span class="mg-pill mg-box" data-score><i>🧋</i><small>Điểm</small><b>0</b></span>
        <button type="button" class="btn small mg-end">Kết thúc</button>
      </div>
      <div class="mg-count"><span>Sẵn sàng</span><b>3</b><small>Di chuột, kéo ngón tay hoặc dùng phím ← → để di cốc. Trân châu +1, trân châu vàng +5, né đá lạnh −3!</small></div>
      <div class="mg-banner mg-box" hidden></div>
    </div>`;
  container.append(root);
  const $ = (s) => root.querySelector(s);
  const stage = $('.mg-stage');
  const canvas = $('canvas');
  const fx = $('.mg-fx');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const p = new Pen(g);
  const bg = drawShop();
  const drops = pearlSchedule(seed, duration);

  const caught = [];
  const live = [];
  const held = new Set();
  const cup = { squash: 0, chill: 0, inCup: 3 };
  let next = 0;
  let score = 0;
  let cupX = W / 2;
  let aim = W / 2;
  let shown = 0;
  let last = 0;
  let finished = false;
  const born = performance.now();
  const clock = () => (performance.now() - born) / 1000;
  const scale = () => stage.clientWidth / W;
  const px = () => Math.max(2, Math.round(scale()));

  function take(it) {
    it.gone = true;
    caught.push(it.i);
    const { kind } = it.d;
    score += DROPS[kind].score;
    $('[data-score] b').textContent = score;
    $('[data-score]').animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    const x = cupX * scale();
    const y = MOUTH * scale();
    if (kind === 'ice') {
      cup.chill = 1;
      floatText(fx, x, y - 12, '−3', { color: '#bfe9ff', size: 24 });
      burst(fx, x, y, { icon: 'drop', count: 5, spread: 80, rise: 40, life: 700, px: px(), stagger: 0 });
      canvas.animate([0, -4, 4, -3, 2, 0].map((d) => ({ transform: `translateX(${d}px)` })), { duration: 300 });
      return;
    }
    cup.squash = 1;
    if (kind === 'pearl') cup.inCup = Math.min(16, cup.inCup + 1);
    floatText(fx, x, y - 12, kind === 'gold' ? '+5' : '+1', { color: kind === 'gold' ? '#ffd75e' : '#fff6d8', size: kind === 'gold' ? 26 : 18 });
    if (kind === 'gold') burst(fx, x, y, { icon: 'sparkle', count: 10, spread: 150, rise: 90, px: px() });
  }

  function update(t) {
    const dt = Math.min(0.05, t - last);
    last = t;
    if (t >= duration) return finish('Hết giờ!');
    const count = $('.mg-count');
    if (t < COUNTDOWN) {
      const n = Math.ceil((COUNTDOWN - t) / (COUNTDOWN / 3));
      if (n !== shown) {
        shown = n;
        count.querySelector('b').textContent = n;
        count.querySelector('b').animate([{ transform: 'scale(1.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,1.5,.4,1)' });
      }
    } else if (shown) {
      shown = 0;
      count.classList.add('go');
      count.querySelector('b').textContent = 'Hứng nào!';
    }
    const left = Math.max(0, Math.ceil(duration - Math.max(t, COUNTDOWN)));
    $('[data-time] b').textContent = left;
    $('[data-time]').classList.toggle('warn', left <= 5);

    const dir = [...held].reduce((s, k) => s + KEYS[k], 0);
    if (dir) aim = clamp(aim + Math.sign(dir) * KEY_SPEED * dt, CUP.top / 2, W - CUP.top / 2);
    cupX += (aim - cupX) * (1 - Math.exp(-dt * 22));
    cup.squash = Math.max(0, cup.squash - dt * 5);
    cup.chill = Math.max(0, cup.chill - dt * 2.5);

    // đồng hồ lịch rơi tính từ lúc hết đếm ngược
    const play = t - COUNTDOWN;
    if (play < 0) return;
    while (next < drops.length && drops[next].t <= play) live.push({ i: next, d: drops[next++], y: -6 });
    for (const it of live) {
      if (it.land !== undefined) continue;
      const prev = it.y;
      it.y = -6 + (play - it.d.t) * it.d.speed * H;
      if (prev < MOUTH && it.y >= MOUTH && Math.abs(it.d.x * W - cupX) <= CUP.top / 2 + 2) take(it);
      else if (it.y >= FLOOR) it.land = t;
    }
    for (let k = live.length - 1; k >= 0; k--) if (live[k].gone || t - live[k].land > 0.5) live.splice(k, 1);
  }

  function draw(t) {
    g.drawImage(bg, 0, 0);
    for (const x of [86, 154]) for (const [r, a] of [[20, 0.07], [12, 0.1]]) p.disc(x, 27, r, `rgba(255, 240, 180, ${a + Math.sin(t * 3 + x) * 0.015})`);
    for (const it of live) {
      const img = ITEMS[it.d.kind];
      const x = it.d.x * W;
      if (it.land === undefined) {
        g.drawImage(img, Math.round(x - img.width / 2), Math.round(it.y - img.height / 2));
        if (it.d.kind === 'gold' && Math.sin(t * 9 + it.i) > 0.3) p.px(x + 4, it.y - 5, '#ffffff');
        continue;
      }
      // rơi trượt: trân châu nảy rồi mờ, đá vỡ vụn
      const a = (t - it.land) / 0.5;
      g.globalAlpha = 1 - a;
      if (it.d.kind === 'ice') for (const s of [-1, 0, 1]) p.rect(x + s * (1 + a * 9), FLOOR - 1 - Math.sin(a * Math.PI) * (5 - Math.abs(s) * 2), 2, 2, s ? '#c4ecff' : '#86c8ec');
      else g.drawImage(img, Math.round(x - img.width / 2), Math.round(FLOOR - img.height / 2 - Math.abs(Math.sin(a * 9)) * 4 * (1 - a)));
      g.globalAlpha = 1;
    }
    drawCup(p, Math.round(cupX + Math.sin(t * 70) * 2 * cup.chill), cup);
  }

  let raf = 0;
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

  const aimAt = (e) => {
    const r = canvas.getBoundingClientRect();
    aim = clamp(((e.clientX - r.left) / r.width) * W, CUP.top / 2, W - CUP.top / 2);
  };
  const onDown = (e) => {
    if (e.target.closest('.mg-end')) return;
    stage.focus({ preventScroll: true });
    stage.setPointerCapture?.(e.pointerId);
    aimAt(e);
  };
  const onKey = (e) => {
    if (!(e.code in KEYS) || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (e.type === 'keydown') held.add(e.code);
    else held.delete(e.code);
  };
  const onBlur = () => held.clear();
  stage.addEventListener('pointermove', aimAt);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  $('.mg-end').addEventListener('click', () => finish('Đã kết thúc'));
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  stage.focus({ preventScroll: true });

  return () => {
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
    root.remove();
  };
}
