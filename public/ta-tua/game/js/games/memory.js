// Ghép hình nhớ: lật hai thẻ giống nhau, ghép đủ 8 cặp; càng ít lượt càng được thưởng.
import { GAMES, memoryDeck } from '../shared/minigames.js';
import { OUTLINE, Pen, bitmap, makeCanvas, outline, seeded } from '../pixel.js';
import { burst, floatText } from '../fx.js';

const W = 240;
const H = 150;
const COUNTDOWN = 2.4;
const CW = 30;
const CH = 33;
const GAP = 3;
const X0 = (W - CW * 4 - GAP * 3) >> 1;
const Y0 = 5;
const FLIP = 0.24;
const PEEK = 0.7;
const MIN_DONE = 8.5; // server từ chối ván ghép đủ 8 cặp trong dưới 8 giây

const ICONS = {
  boba: [['.......ss..', '......ss...', '......s....', '...LLLsLL..', '..LLLLsLLL.', '.RRRRRRRRR.', '.twttttttt.', '.twttttttt.',
    '..wtttttt..', '..ttttttt..', '..pdpdpdp..', '..dpdpdpd..', '...ppppp...'],
  { s: '#ff8fb1', L: '#fffaf0', R: '#e9d2b8', t: '#d9a571', w: '#f1cfa1', p: '#3d2a1f', d: '#6b4a38' }],
  fish: [['...bbbb.....', '.bbbbbbbb..B', 'bwkbbbbbbbBB', 'bbbbbbbbbbBB', 'blllllllbbBB', '.llllllbb..B', '...BB.......'],
    { b: '#7cc4ef', B: '#4f97cf', l: '#d6f0fb', w: '#ffffff', k: OUTLINE }],
  heart: [['.rrr...rrr.', 'rrwrr.rrrrr', 'rwrrrrrrrrr', 'rrrrrrrrrrr', 'rrrrrrrrrrR', '.rrrrrrrrR.', '..rrrrrrR..', '...rrrrR...', '....rrR....', '.....R.....'],
    { r: '#ff7a9c', w: '#ffd3df', R: '#e0557a' }],
  star: [['.....y.....', '....yyy....', '....ywy....', 'yyyyywyyyyy', '.yyyyyyyyy.', '..yyyyyyo..', '...yyyyyo..', '..yyyoyyy..', '..yyo.oyy..', '.yyo...oyy.', '.yo.....oy.'],
    { y: '#ffd75e', w: '#fff6c4', o: '#e8a62a' }],
  berry: [['...g..g...', '..gggggg..', '.rggggggr.', 'rrrggggrrr', 'rwryrrryrr', 'rrrrrrrrrr', 'ryrrryrrry', '.rrrrrrrr.', '.rryrrryr.', '..rrrrrr..', '...ryrr...', '....rr....'],
    { r: '#ff5f6d', w: '#ffc2c8', y: '#ffe08a', g: '#5fae4f' }],
  cake: [['.....cc.....', '.....cw.....', '..pppppppp..', '.pppppppppp.', 'pppppppppppp', 'pPpppPpppPpp', 'sPsssPsssPss', 'ssssssssssss', 'SSSSSSSSSSSS', 'ssssssssssss', 'oooooooooooo'],
    { p: '#ffb3c7', P: '#ff8fb1', s: '#ffe2a8', S: '#ffffff', o: '#f2c27a', c: '#e8364f', w: '#ffb3bd' }],
};

function iconArt(sym) {
  if (ICONS[sym]) return bitmap(...ICONS[sym], OUTLINE);
  const [c, g] = makeCanvas(12, 12);
  const p = new Pen(g);
  if (sym === 'leaf') {
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const u = (x + 11 - y) / 22;
      const v = (x - 11 + y) / 2;
      if (Math.abs(v) < 3.4 * Math.sin(Math.PI * Math.min(1, u * 1.1))) p.px(x, y, Math.abs(v) < 0.6 ? '#4f9a43' : v < 0 ? '#9bd67a' : '#79c25a');
    }
    p.px(0, 11, '#4f9a43');
  } else {
    // trăng khuyết: đĩa vàng bị khoét bởi một đĩa lệch
    p.disc(6, 6, 5, '#ffe27a');
    p.disc(4, 7, 2, '#fff1b0');
    g.globalCompositeOperation = 'destination-out';
    p.disc(9, 4, 4, '#000');
    g.globalCompositeOperation = 'source-over';
  }
  return outline(c);
}

function cardBase(fill) {
  const [c, g] = makeCanvas(CW, CH);
  const p = new Pen(g);
  p.rect(1, 0, CW - 2, CH, OUTLINE);
  p.rect(0, 1, CW, CH - 2, OUTLINE);
  p.rect(1, 1, CW - 2, CH - 2, fill);
  p.rect(1, CH - 3, CW - 2, 2, fill === '#fffaf0' ? '#ecd8bf' : '#d9708a');
  return [c, g, p];
}

function cardBack() {
  const [c, , p] = cardBase('#fff3e3');
  p.rect(3, 3, CW - 6, CH - 7, '#f4a3b4');
  for (let y = 4; y < CH - 4; y += 4) for (let x = 4 + ((y >> 2) % 2) * 2; x < CW - 4; x += 4) p.px(x, y, '#ffc6d2');
  const cx = CW >> 1;
  const cy = (CH >> 1) - 1;
  p.disc(cx, cy, 6, '#d9708a');
  p.disc(cx, cy, 5, '#fff3e3');
  p.ellipse(cx, cy + 1, 2, 1, '#d9708a');
  for (const dx of [-2, 0, 2]) p.px(cx + dx, cy - 2 + (dx ? 1 : 0), '#d9708a');
  return c;
}

function cardFace(sym) {
  const [c, g, p] = cardBase('#fffaf0');
  p.ditherFill(2, 2, CW - 4, CH - 5, '#fdeedd', 0.2);
  const icon = iconArt(sym);
  g.drawImage(icon, (CW - icon.width) >> 1, ((CH - icon.height) >> 1) - 1);
  return c;
}

function drawTable() {
  const [c, g] = makeCanvas(W, H);
  const p = new Pen(g);
  const rand = seeded(12);
  // mặt bàn ván gỗ dọc có vân
  for (let col = 0, x = 0; x < W; col++, x += 12) {
    p.rect(x, 0, 12, H, col % 2 ? '#d6a36b' : '#dcab74');
    p.rect(x + 11, 0, 1, H, '#ba8551');
    p.rect(x, Math.floor(rand() * H), 11, 1, '#ba8551');
    for (let k = 0; k < 6; k++) p.rect(x + 2 + Math.floor(rand() * 8), rand() * H, 1, 4 + rand() * 8, '#cd9960');
  }
  // khăn caro hồng dưới lưới thẻ, mép ren
  const L = X0 - 6;
  const R = X0 + CW * 4 + GAP * 3 + 6;
  for (let y = 0; y < H; y += 4) for (const x of [L, R]) p.disc(x, y + 2, 2, '#fffaf0');
  for (let y = 0; y < H; y++) for (let x = L; x < R; x++) {
    const a = Math.floor((x - L) / 6) % 2;
    const b = Math.floor(y / 6) % 2;
    p.px(x, y, a && b ? '#f6b3c2' : a || b ? '#fbd0da' : '#fff3ec');
  }
  // cốc trà sữa và đĩa bánh quy hai bên
  p.ellipse(25, 143, 11, 2, 'rgba(70, 40, 20, 0.25)');
  for (let j = 0; j < 22; j++) p.rect(18 + Math.floor(j / 7), 120 + j, 14 - Math.floor(j / 7) * 2, 1, j > 16 ? '#3d2a1f' : j > 3 ? '#d9a571' : '#eaf8fc');
  p.rect(17, 119, 16, 2, '#fffaf0');
  for (let k = 0; k < 12; k++) p.rect(27 + Math.round(k * 0.3), 124 - k, 2, 1, k % 4 < 2 ? '#ff8fb1' : '#fff3f6');
  p.ellipse(215, 140, 16, 4, '#e9d2b8');
  p.ellipse(215, 139, 14, 3, '#fffaf0');
  for (const [x, y] of [[207, 135], [221, 136], [214, 131]]) {
    p.disc(x, y, 5, '#b8763e');
    p.disc(x, y - 1, 4, '#d8975a');
    for (let k = 0; k < 3; k++) p.px(x - 2 + k * 2, y - 2 + (k % 2) * 2, '#5a3a2a');
  }
  return c;
}

export function mount(container, { seed, duration = GAMES.memory.duration, onFinish }) {
  const root = document.createElement('div');
  root.className = 'mg-root mg-memory';
  root.innerHTML = `
    <div class="mg-stage" tabindex="0" aria-label="${GAMES.memory.name}. ${GAMES.memory.desc}">
      <canvas class="mg-canvas" width="${W}" height="${H}"></canvas><div class="mg-fx"></div>
      <div class="mg-hud">
        <span class="mg-pill mg-box" data-time><i class="mg-ico">⏱</i><b>0</b></span>
        <span class="mg-pill mg-box" data-pairs><i>🃏</i><small>Cặp</small><b>0/8</b></span>
        <span class="mg-pill mg-box" data-moves><i>🔁</i><small>Lượt</small><b>0</b></span>
        <button type="button" class="btn small mg-end">Kết thúc</button>
      </div>
      <div class="mg-count"><span>Sẵn sàng</span><b>3</b><small>Chạm hai thẻ giống nhau. Bàn phím: phím mũi tên để chọn, Enter hoặc Space để lật.</small></div>
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
  const bg = drawTable();
  const back = cardBack();
  const faces = {};
  const cards = memoryDeck(seed).map((sym) => {
    faces[sym] ??= cardFace(sym);
    return { sym, f: 0, target: 0, matched: false, shake: 0, glow: 0, bad: 0 };
  });

  const later = [];
  let open = [];
  let pending = null; // cặp lật sai đang chờ úp lại
  let moves = 0;
  let pairs = 0;
  let hover = -1;
  let cursor = 5;
  let kbd = false;
  let shown = 0;
  let last = 0;
  let ending = false;
  let finished = false;
  let doneTimer = 0;
  const born = performance.now();
  const clock = () => (performance.now() - born) / 1000;
  const scale = () => stage.clientWidth / W;
  const cell = (i) => [X0 + (i % 4) * (CW + GAP), Y0 + (i >> 2) * (CH + GAP)];
  const center = (i) => cell(i).map((v, k) => (v + (k ? CH : CW) / 2) * scale());

  function hud() {
    $('[data-pairs] b').textContent = `${pairs}/8`;
    $('[data-moves] b').textContent = moves;
  }

  function flipBack() {
    pending.a.target = pending.b.target = 0;
    pending = null;
  }

  function pick(i) {
    const t = clock();
    const c = cards[i];
    if (ending || t < COUNTDOWN || !c || c.matched || c.target === 1) return;
    if (pending) flipBack();
    c.target = 1;
    open.push(i);
    if (open.length < 2) return;
    const [ia, ib] = open;
    const [a, b] = [cards[ia], cards[ib]];
    open = [];
    moves += 1;
    if (a.sym === b.sym) {
      a.matched = b.matched = true;
      pairs += 1;
      later.push({ at: t + FLIP, fn: () => {
        a.glow = b.glow = 1;
        for (const k of [ia, ib]) burst(fx, ...center(k), { icon: 'sparkle', count: 6, spread: 90, rise: 60, px: Math.max(2, Math.round(scale())) });
        floatText(fx, ...center(ib), pairs === 8 ? 'Tuyệt vời!' : 'Đúng rồi!', { color: '#ffe27a', size: 18 });
      } });
      if (pairs === 8) complete(t);
    } else {
      pending = { a, b, at: t + FLIP + PEEK };
      later.push({ at: t + FLIP, fn: () => { a.shake = b.shake = a.bad = b.bad = 1; } });
    }
    hud();
    $('[data-moves]').animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  }

  function complete(t) {
    ending = true;
    clearTimeout(endTimer);
    Object.assign($('.mg-banner'), { textContent: 'Hoàn thành!', hidden: false });
    later.push({ at: t + FLIP + 0.1, fn: () => burst(fx, stage.clientWidth / 2, stage.clientHeight / 2, { icon: 'sparkle', count: 18, spread: 360, rise: 160, life: 1500, px: 3, stagger: 25 }) });
    doneTimer = setTimeout(() => done('Hoàn thành!'), Math.max(1, MIN_DONE - t) * 1000);
  }

  function update(t) {
    const dt = Math.min(0.05, t - last);
    last = t;
    if (t >= duration && !ending) return finish('Hết giờ!');
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
      count.querySelector('b').textContent = 'Lật thôi!';
    }
    if (!ending) {
      const left = Math.max(0, Math.ceil(duration - Math.max(t, COUNTDOWN)));
      $('[data-time] b').textContent = left;
      $('[data-time]').classList.toggle('warn', left <= 5);
    }
    for (const c of cards) {
      if (c.f !== c.target) c.f = Math.min(1, Math.max(0, c.f + Math.sign(c.target - c.f) * (dt / FLIP)));
      c.shake = Math.max(0, c.shake - dt * 3);
      c.glow = Math.max(0, c.glow - dt * 1.2);
      c.bad = Math.max(0, c.bad - dt * 2);
    }
    for (let k = later.length - 1; k >= 0; k--) if (t >= later[k].at) later.splice(k, 1)[0].fn();
    if (pending && t >= pending.at) flipBack();
  }

  function draw(t) {
    g.drawImage(bg, 0, 0);
    cards.forEach((c, i) => {
      const [cx, y] = cell(i);
      const e = c.f < 0.5 ? 2 * c.f * c.f : 1 - 2 * (1 - c.f) ** 2;
      const w = Math.max(1, Math.round(CW * Math.abs(Math.cos(Math.PI * e))));
      const lift = Math.round(Math.sin(Math.PI * e) * 3) + (i === hover && !c.target && !ending ? 1 : 0);
      const x = cx + Math.round((CW - w) / 2 + Math.sin(c.shake * 30) * 2 * c.shake);
      p.rect(x + 1, y + CH, w - 1, 1, 'rgba(70, 40, 20, 0.3)');
      if (c.matched && e > 0.5) p.rect(x - 1, y - lift - 1, w + 2, CH + 2, c.glow > 0 && Math.sin(t * 24) > 0 ? '#fff6c4' : '#f4c24f');
      g.drawImage(e < 0.5 ? back : faces[c.sym], 0, 0, CW, CH, x, y - lift, w, CH);
      if (c.bad > 0) p.rect(x + 1, y - lift + 1, w - 2, CH - 2, `rgba(255, 90, 90, ${c.bad * 0.35})`);
      if (c.matched && e === 1 && Math.sin(t * 2.3 + i * 1.7) > 0.96) p.rect(x + 4 + (i * 7) % 20, y + 4 + (i * 5) % 22, 1, 1, '#ffffff');
    });
    if (kbd && !ending && Math.sin(t * 8) > -0.4) {
      const [x, y] = cell(cursor);
      for (const [rx, ry, rw, rh] of [[x - 3, y - 3, CW + 6, 2], [x - 3, y + CH + 1, CW + 6, 2], [x - 3, y - 1, 2, CH + 2], [x + CW + 1, y - 1, 2, CH + 2]]) p.rect(rx, ry, rw, rh, '#ffd75e');
    }
  }

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = clock();
    update(t);
    if (!finished) draw(t);
  };
  raf = requestAnimationFrame(frame);
  const endTimer = setTimeout(() => !ending && finish('Hết giờ!'), duration * 1000 + 50);

  function finish(label) {
    if (ending) return;
    ending = true;
    done(label);
  }

  function done(label) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    clearTimeout(doneTimer);
    stage.classList.add('is-over');
    $('.mg-count').hidden = true;
    if (label !== 'Hoàn thành!') $('[data-time] b').textContent = Math.max(0, Math.ceil(duration - clock()));
    Object.assign($('.mg-banner'), { textContent: label, hidden: false });
    onFinish?.({ moves, pairs });
  }

  const cardAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const col = Math.floor((((e.clientX - r.left) / r.width) * W - X0 + GAP / 2) / (CW + GAP));
    const row = Math.floor((((e.clientY - r.top) / r.height) * H - Y0 + GAP / 2) / (CH + GAP));
    return col >= 0 && col < 4 && row >= 0 && row < 4 ? row * 4 + col : -1;
  };
  const onMove = (e) => {
    hover = cardAt(e);
    kbd = false;
    stage.style.cursor = hover >= 0 && !cards[hover].target ? 'pointer' : '';
  };
  const onDown = (e) => {
    if (e.button > 0 || e.target.closest('.mg-end')) return;
    stage.focus({ preventScroll: true });
    const i = cardAt(e);
    if (i >= 0) pick((cursor = i));
  };
  const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select, button, a, [contenteditable]')) return;
    if (e.key in STEP) cursor = (cursor + STEP[e.key] + 16) % 16;
    else if (e.key === 'Enter' || e.key === ' ') !e.repeat && pick(cursor);
    else return;
    e.preventDefault();
    kbd = true;
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', () => (hover = -1));
  stage.addEventListener('pointerdown', onDown);
  $('.mg-end').addEventListener('click', () => finish('Đã kết thúc'));
  window.addEventListener('keydown', onKey);
  stage.focus({ preventScroll: true });

  return () => {
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    clearTimeout(doneTimer);
    window.removeEventListener('keydown', onKey);
    root.remove();
  };
}
