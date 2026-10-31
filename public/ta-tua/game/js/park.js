import { burst, flyTo, floatText } from './fx.js';
import { loadParkArt, mountPark16, rectNav } from './parkscene.js';
import { PARK_PX, mountParkScene } from './scenes.js';
import { createPetFigure } from './sprite.js';
import { $, esc, toast } from './ui.js';

const SPEED = 190; // đơn vị thế giới mỗi giây
const BASE_SCALE = 0.6;
const CUDDLE_GAP = 62; // đứng cách bạn bao xa khi vuốt ve
const WORLD_W = 2000;
const ROOMS_POLL_MS = 3000;
/** Bé cao chừng này trên chân: camera canh giữa thân bé chứ không canh chân. */
const BODY_MID = 36;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Mỗi điểm ảnh gốc hiện ra bấy nhiêu điểm ảnh màn hình: 3 trên máy tính, 2 trên điện thoại (số nguyên cho sắc nét). */
const pixelTarget = () => (innerWidth < 768 ? 2 : 3);
/** Cả game thu nhỏ bằng `zoom` trên <html> (css/style.css); bù lại để điểm ảnh vẫn tròn số. */
function pageZoom() {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z > 0 ? z : 1;
}

/** Vẽ công viên và nối socket; trả về hàm dọn dẹp khi rời màn. */
export function mountPark(root, ctx) {
  root.innerHTML = `
    <div class="park">
      <div class="park-wrap" id="park-wrap">
        <div class="park-world" id="park-world"></div>
        <div class="park-hud">
          <button class="btn small park-room" id="park-room" aria-haspopup="true" aria-expanded="false" aria-controls="park-rooms" title="Đổi kênh">
            <span id="park-room-name">Kênh</span> ▾
          </button>
          <span class="park-count" title="Số bé ở kênh này, kể cả bé của người đang vắng">🌳 <span id="online-count">0</span><span class="park-count-unit"> bé</span></span>
          <div class="emotes">
            <button class="btn small" data-emote="wave" title="Vẫy">👋</button>
            <button class="btn small" data-emote="jump" title="Nhảy">🦘</button>
            <button class="btn small" data-emote="spin" title="Xoay">🌀</button>
          </div>
          <button class="btn small park-help" id="park-help" aria-expanded="false" aria-controls="park-tip" aria-label="Cách chơi ở công viên" title="Cách chơi">?</button>
        </div>
        <div class="park-pop park-rooms" id="park-rooms" hidden></div>
        <div class="park-pop park-tip" id="park-tip" role="tooltip" hidden>
          Bấm lên bãi cỏ để đi tới đó, khung hình đi theo bé của bạn. Bấm vào bé khác để vuốt ve 💖 hoặc tặng quà 🎁.
          Công viên chia thành nhiều kênh; bấm nút Kênh để sang kênh khác còn chỗ. Trò chuyện ở khung 💬 bên dưới.
        </div>
        <div class="park-status" id="park-status">Đang vào công viên…</div>
      </div>
    </div>`;

  const wrap = $('#park-wrap', root);
  const worldEl = $('#park-world', root);
  const statusEl = $('#park-status', root);
  const roomBtn = $('#park-room', root);
  const roomsEl = $('#park-rooms', root);
  const helpBtn = $('#park-help', root);
  const tipEl = $('#park-tip', root);

  let world = { width: WORLD_W, height: 600, minX: 50, maxX: WORLD_W - 50, minY: 318, maxY: 585 };
  let scale = 1;
  let camX = 0; // mép trái / mép trên khung nhìn, theo đơn vị thế giới
  let camY = 0;
  let shownCam = { x: 0, y: 0 }; // camera đã làm tròn theo điểm ảnh gốc, đúng như đang hiện
  let selfId = null;
  let menu = null;
  let room = null; // kênh đang đứng
  let cap = 60;
  let rooms = [];
  let roomsPoll = 0;
  const entities = new Map();
  worldEl.style.width = `${world.width}px`;

  // ---- cảnh: công viên 16-bit (assets/park), tải không được thì về cảnh vẽ tay cũ ----
  // Tọa độ trên máy chủ là một khung chữ nhật; `nav` ánh xạ nó vào bãi cỏ đi được của cảnh, tránh ao và đồ vật.
  let nav = rectNav(world);
  let scene = null;
  let unmountScene = null;
  let alive = true;
  loadParkArt().then((art) => {
    if (!alive) return;
    if (art) {
      scene = mountPark16(worldEl, art);
      nav = scene.nav;
      nav.setLogical(world);
      wrap.classList.add('px16');
    } else {
      unmountScene = mountParkScene(worldEl, WORLD_W);
    }
    remap();
  });

  const speciesOf = (id) => ctx.catalog.species.find((s) => s.id === id) ?? ctx.catalog.species[0];
  const petHeight = (e) => e.figure.height;
  /** Điểm trên thân bé: 0 là chân, 1 là đỉnh khung hình. */
  const pointOn = (e, frac) => ({ x: e.x - 4, y: e.y - petHeight(e) * frac });

  // ---- camera: điểm ảnh gốc phóng số nguyên lần, khung nhìn đi theo bé của mình cả ngang lẫn dọc ----

  function measure() {
    scale = pixelTarget() / pageZoom() / PARK_PX;
    wrap.style.setProperty('--park-scale', String(scale));
    wrap.style.setProperty('--park-h', `${Math.round(world.height * scale)}px`);
  }
  const viewW = () => wrap.clientWidth / scale;
  const viewH = () => wrap.clientHeight / scale;
  function applyCamera() {
    // Camera bước theo từng điểm ảnh gốc để cảnh không nhòe, không rung mép.
    shownCam = { x: Math.round(camX / PARK_PX) * PARK_PX, y: Math.round(camY / PARK_PX) * PARK_PX };
    worldEl.style.transform = `translate3d(${-shownCam.x * scale}px, ${-shownCam.y * scale}px, 0) scale(${scale})`;
  }
  /** Góc trên-trái khung nhìn để bé của mình nằm giữa (kẹp trong thế giới); chưa có bé thì nhìn giữa bãi cỏ. */
  function cameraGoal() {
    const me = entities.get(selfId);
    const { box } = nav;
    const fx = me ? me.x : (box.x0 + box.x1) / 2;
    const fy = me ? me.y - BODY_MID : (box.y0 + box.y1) / 2;
    return {
      x: clamp(fx - viewW() / 2, 0, Math.max(0, world.width - viewW())),
      y: clamp(fy - viewH() / 2, 0, Math.max(0, world.height - viewH())),
    };
  }
  function snapCamera() {
    ({ x: camX, y: camY } = cameraGoal());
    applyCamera();
  }

  const resize = new ResizeObserver(() => {
    measure();
    snapCamera();
    if (menu) positionMenu();
  });
  measure();
  resize.observe(wrap);

  function setStatus(text) {
    statusEl.hidden = !text;
    statusEl.textContent = text ?? '';
  }

  // ---- thú cưng trên sân ----

  function place(e) {
    e.el.style.left = `${e.x}px`;
    e.el.style.top = `${e.y}px`;
    e.el.style.zIndex = String(Math.max(Math.round(e.y), e.lift ?? 0));
  }

  function setPet(e, player) {
    e.data = player;
    e.figure?.destroy();
    e.figure = createPetFigure(speciesOf(player.pet.species), BASE_SCALE, player.pet.wear, { stage: player.pet.stage, ageScale: player.pet.scale, level: player.pet.level });
    e.el.insertBefore(e.figure.el, e.nameEl);
    e.nameEl.innerHTML = `${esc(player.pet.name)} <b>Lv ${player.pet.level}</b><small>${player.offline ? '💤 ' : ''}${esc(player.username)}</small>`;
    e.el.classList.toggle('away', Boolean(player.offline));
    e.el.title = player.offline ? `${player.username} đang vắng, bé vẫn dạo công viên` : '';
  }

  /** Đi tới (x, y) trên cảnh, vòng qua ao và đồ vật. */
  function walkTo(e, x, y) {
    e.tx = x;
    e.ty = y;
    e.path = nav.route(e.x, e.y, x, y);
  }

  /** Cảnh vừa tải xong (bản đồ đi lại đổi): đặt lại mọi bé theo tọa độ máy chủ. */
  function remap() {
    for (const e of entities.values()) {
      const p = nav.toDisplay(e.lx, e.ly);
      Object.assign(e, { x: p.x, y: p.y, tx: p.x, ty: p.y, path: [], home: p });
      place(e);
    }
    snapCamera();
  }

  function addPlayer(player) {
    removePlayer(player.id);
    const at = nav.toDisplay(player.x, player.y);
    const el = document.createElement('div');
    el.className = `pg-pet${player.id === selfId ? ' self' : ''}`;
    el.dataset.id = player.id;
    el.innerHTML = '<div class="pg-bubble"></div><div class="pg-name"></div>';
    const e = {
      id: player.id,
      el,
      nameEl: el.querySelector('.pg-name'),
      bubbleEl: el.querySelector('.pg-bubble'),
      x: at.x, y: at.y, tx: at.x, ty: at.y, path: [],
      lx: player.x, ly: player.y, // vị trí trên máy chủ (đích mới nhất)
      facing: 'runRight',
      dustAt: 0,
      onArrive: null,
      bubbleTimer: 0,
      // Cư dân (chủ đang vắng) tự đi dạo quanh chỗ của mình; mỗi máy thấy một kiểu, không gửi lên máy chủ.
      home: at,
      wanderAt: performance.now() + 1500 + Math.random() * 6000,
    };
    setPet(e, player);
    entities.set(player.id, e);
    worldEl.append(el);
    place(e);
    renderOnline();
  }

  function removePlayer(id) {
    const e = entities.get(id);
    if (!e) return;
    clearTimeout(e.bubbleTimer);
    e.figure.destroy();
    e.el.remove();
    entities.delete(id);
    if (menu?.targetId === id) closeMenu();
    renderOnline();
  }

  function renderOnline() {
    $('#online-count', root).textContent = entities.size;
  }

  function particles(id, frac, options) {
    const e = entities.get(id);
    if (!e) return;
    const { x, y } = pointOn(e, frac);
    burst(worldEl, x, y, { px: PARK_PX, ...options });
  }

  // ---- vòng lặp di chuyển ----

  let last = performance.now();
  let raf = requestAnimationFrame(step);
  let occludedAt = 0;

  /** Đi dọc các điểm dừng của đường; trả về true nếu bé có nhích. */
  function advance(e, dt) {
    let budget = SPEED * dt;
    let moved = false;
    while (budget > 0 && e.path.length) {
      const wp = e.path[0];
      const dx = wp.x - e.x;
      const dy = wp.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > dist * 0.2) e.facing = dx > 0 ? 'runRight' : 'runLeft';
      if (dist <= budget) {
        e.x = wp.x;
        e.y = wp.y;
        e.path.shift();
        budget -= dist;
      } else {
        e.x += (dx / dist) * budget;
        e.y += (dy / dist) * budget;
        budget = 0;
      }
      moved = true;
    }
    return moved;
  }

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const e of entities.values()) {
      const sprite = e.figure.sprite;
      if (advance(e, dt)) {
        if (!sprite.busy) sprite.play(e.facing);
        e.figure.body.style.transform = `translateY(${-Math.abs(Math.sin(now / 85)) * 5}px)`;
        if (now - e.dustAt > 170) {
          e.dustAt = now;
          const back = e.facing === 'runRight' ? -1 : 1;
          burst(worldEl, e.x + back * 14, e.y - 3, { icon: 'dust', count: 1, spread: 16, rise: 10, life: 520, px: PARK_PX, stagger: 0 });
        }
        place(e);
      } else {
        if (e.figure.body.style.transform) e.figure.body.style.transform = '';
        if (!sprite.busy && sprite.anim !== 'idle') sprite.play('idle');
        if (e.onArrive) {
          const done = e.onArrive;
          e.onArrive = null;
          done();
        } else if (e.data.offline && now > e.wanderAt) {
          e.wanderAt = now + 4000 + Math.random() * 8000;
          const { box } = nav;
          const spot = nav.snap(
            clamp(e.home.x + (Math.random() - 0.5) * 220, box.x0, box.x1),
            clamp(e.home.y + (Math.random() - 0.5) * 90, box.y0, box.y1),
          );
          walkTo(e, spot.x, spot.y);
        }
      }
    }
    const goal = cameraGoal();
    if (goal.x !== camX || goal.y !== camY) {
      const k = Math.min(1, dt * 5);
      camX = Math.abs(goal.x - camX) < 0.5 ? goal.x : camX + (goal.x - camX) * k;
      camY = Math.abs(goal.y - camY) < 0.5 ? goal.y : camY + (goal.y - camY) * k;
      applyCamera();
    }
    if (menu) positionMenu();
    // Đồ vật che bé đứng sau nó thì mờ đi, để vẫn thấy bé và tên.
    if (scene && now - occludedAt > 120) {
      occludedAt = now;
      const list = [...entities.values()];
      const lifts = scene.update(list.map((e) => ({ x: e.x, y: e.y, h: petHeight(e) })));
      list.forEach((e, i) => {
        if (lifts[i] === (e.lift ?? 0)) return;
        e.lift = lifts[i];
        place(e);
      });
    }
    raf = requestAnimationFrame(step);
  }

  function moveSelf(x, y, onArrive = null) {
    const me = entities.get(selfId);
    if (!me) return;
    // Đi đúng chỗ máy khác sẽ thấy: điểm trên cảnh -> tọa độ máy chủ (số nguyên) -> lại lên cảnh.
    const spot = nav.snap(x, y);
    const to = nav.toLogical(spot.x, spot.y);
    const at = nav.toDisplay(to.x, to.y);
    me.lx = to.x;
    me.ly = to.y;
    walkTo(me, at.x, at.y);
    me.onArrive = onArrive;
    socket.emit('pg:move', to);
  }

  /** Chạy tới cạnh bé kia rồi mới vuốt ve. */
  function approach(targetId, action) {
    const me = entities.get(selfId);
    const target = entities.get(targetId);
    if (!me || !target) return;
    const side = me.x < target.x ? -1 : 1;
    let x = target.x + side * CUDDLE_GAP;
    if (!nav.isOpen(x, target.y)) x = target.x - side * CUDDLE_GAP;
    if (Math.hypot(me.x - x, me.y - target.y) < 12) return action();
    moveSelf(x, target.y + 2, action);
  }

  // ---- menu tương tác với bé khác ----

  function closeMenu() {
    menu?.el.remove();
    menu = null;
  }

  function positionMenu() {
    const e = entities.get(menu.targetId);
    if (!e) return closeMenu();
    const w = menu.el.offsetWidth;
    const h = menu.el.offsetHeight;
    const below = (e.y + 44 - shownCam.y) * scale;
    const above = (e.y - petHeight(e) - shownCam.y) * scale - h - 8;
    const top = below + h + 8 > wrap.clientHeight ? above : below;
    menu.el.style.left = `${clamp((e.x - shownCam.x) * scale - w / 2, 6, wrap.clientWidth - w - 6)}px`;
    menu.el.style.top = `${Math.max(6, top)}px`;
  }

  function openMenu(targetId) {
    closeMenu();
    const e = entities.get(targetId);
    if (!e || targetId === selfId) return;
    const inventory = ctx.me().inventory;
    const gifts = Object.values(ctx.catalog.items).filter((i) => (i.type === 'food' || i.type === 'care') && inventory[i.id] > 0);
    const el = document.createElement('div');
    el.className = 'pg-menu card';
    el.innerHTML = `
      <h4>${esc(e.data.pet.name)} <small class="muted">của ${esc(e.data.username)}</small></h4>
      <button class="btn pink small" data-cuddle>💖 Vuốt ve</button>
      <span class="label">🎁 Tặng quà từ túi đồ</span>
      <div class="gifts">
        ${gifts.length
          ? gifts.map((i) => `<button class="btn small" data-gift="${i.id}" title="${esc(i.name)}">${i.icon}<sup>${inventory[i.id]}</sup></button>`).join('')
          : '<span class="muted">Túi chưa có gì để tặng.</span>'}
      </div>`;
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const gift = ev.target.closest('[data-gift]');
      if (ev.target.closest('[data-cuddle]')) approach(targetId, () => socket.emit('pg:cuddle', { targetId }));
      else if (gift) socket.emit('pg:gift', { targetId, itemId: gift.dataset.gift });
      else return;
      closeMenu();
    });
    wrap.append(el);
    menu = { targetId, el };
    positionMenu();
  }

  // ---- thao tác của người chơi ----

  worldEl.addEventListener('click', (ev) => {
    closePops();
    const petEl = ev.target.closest('.pg-pet');
    if (petEl) {
      if (petEl.dataset.id === selfId) socket.emit('pg:emote', { kind: 'jump' });
      else openMenu(petEl.dataset.id);
      return;
    }
    closeMenu();
    if (!selfId) return;
    const rect = worldEl.getBoundingClientRect();
    moveSelf(((ev.clientX - rect.left) / rect.width) * world.width, ((ev.clientY - rect.top) / rect.height) * world.height);
  });

  root.querySelector('.emotes').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-emote]');
    if (btn) socket.emit('pg:emote', { kind: btn.dataset.emote });
  });

  // ---- kênh và hướng dẫn trên thanh công cụ ----

  function renderRoomName() {
    $('#park-room-name', root).textContent = room ? `Kênh ${room}` : 'Kênh';
  }

  function renderRooms() {
    roomsEl.innerHTML = `
      <h4>Chọn kênh</h4>
      <div class="park-room-list">
        ${rooms.map(({ n, count }) => {
          const full = count >= cap;
          const here = n === room;
          return `<button class="park-room-item${here ? ' current' : ''}" data-room="${n}" ${full || here ? 'disabled' : ''}
              title="${here ? 'Bạn đang ở kênh này' : full ? 'Kênh đã đầy' : `Sang kênh ${n}`}">
            <b>Kênh ${n}</b><small>${count}/${cap}${here ? ' · bạn ở đây' : full ? ' · đầy' : ''}</small>
            <i style="--fill:${Math.min(100, Math.round((count / cap) * 100))}%"></i>
          </button>`;
        }).join('')}
      </div>`;
  }

  function closePops() {
    roomsEl.hidden = true;
    tipEl.hidden = true;
    roomBtn.setAttribute('aria-expanded', 'false');
    helpBtn.setAttribute('aria-expanded', 'false');
    clearInterval(roomsPoll);
  }

  roomBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const open = roomsEl.hidden;
    closePops();
    if (!open) return;
    renderRooms();
    roomsEl.hidden = false;
    roomBtn.setAttribute('aria-expanded', 'true');
    // Số người mỗi kênh cập nhật liên tục khi bảng đang mở.
    socket.emit('pg:rooms');
    roomsPoll = setInterval(() => socket.emit('pg:rooms'), ROOMS_POLL_MS);
  });

  roomsEl.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const btn = ev.target.closest('[data-room]');
    if (!btn || btn.disabled) return;
    closePops();
    setStatus(`Đang sang kênh ${btn.dataset.room}…`);
    socket.emit('pg:room', { room: Number(btn.dataset.room) });
  });

  helpBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const open = tipEl.hidden;
    closePops();
    tipEl.hidden = !open;
    helpBtn.setAttribute('aria-expanded', String(open));
  });
  tipEl.addEventListener('click', (ev) => ev.stopPropagation());

  const onDocClick = (ev) => {
    if (!wrap.contains(ev.target)) closePops();
  };
  document.addEventListener('click', onDocClick);

  const onKey = (ev) => {
    if (ev.key !== 'Escape') return;
    closeMenu();
    closePops();
  };
  document.addEventListener('keydown', onKey);

  // ---- socket ----

  const socket = window.io({ auth: { token: ctx.token } });

  socket.on('connect', () => {
    setStatus('Đang vào công viên…');
    socket.emit('pg:join', room ? { room } : {}); // nối lại mạng thì về đúng kênh cũ
  });
  socket.on('connect_error', (err) => setStatus(`Không kết nối được: ${err.message}`));
  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') setStatus('Mất kết nối, đang thử lại…');
  });

  socket.on('pg:state', ({ selfId: id, world: w, players, room: n, cap: c, rooms: list }) => {
    selfId = id;
    world = w;
    worldEl.style.width = `${world.width}px`;
    worldEl.style.height = `${world.height}px`;
    if (scene) nav.setLogical(world);
    else nav = rectNav(world);
    measure();
    room = n ?? room;
    cap = c ?? cap;
    rooms = list ?? rooms;
    renderRoomName();
    if (!roomsEl.hidden) renderRooms();
    closeMenu();
    for (const key of [...entities.keys()]) removePlayer(key);
    players.forEach(addPlayer);
    snapCamera(); // vào kênh: đặt khung nhìn ngay chỗ bé của mình
    setStatus(null);
    particles(selfId, 0.5, { icon: 'sparkle', count: 5, spread: 90, rise: 60 });
  });

  const dropResident = (userId) => {
    for (const e of [...entities.values()]) if (e.data.offline && e.data.userId === userId) removePlayer(e.id);
  };

  socket.on('pg:joined', (player) => {
    dropResident(player.userId);
    addPlayer(player);
    particles(player.id, 0.5, { icon: 'sparkle', count: 5, spread: 90, rise: 60 });
  });

  socket.on('pg:left', ({ id }) => {
    removePlayer(id);
  });

  socket.on('pg:moved', ({ id, x, y }) => {
    const e = entities.get(id);
    if (!e) return;
    e.lx = x;
    e.ly = y;
    const at = nav.toDisplay(x, y);
    walkTo(e, at.x, at.y);
  });

  socket.on('pg:player', (player) => {
    const e = entities.get(player.id);
    if (!e) {
      if (!player.offline) dropResident(player.userId);
      return addPlayer(player);
    }
    setPet(e, player);
    renderOnline();
  });

  socket.on('pg:emote', ({ id, kind }) => {
    const e = entities.get(id);
    if (!e) return;
    e.figure.sprite.play(kind, { once: true });
    if (kind === 'wave') particles(id, 0.9, { icon: 'note', count: 2, spread: 50, rise: 50, life: 1300 });
    if (kind === 'spin') particles(id, 0.55, { icon: 'twinkle', count: 6, spread: 110, rise: 50 });
    if (kind === 'jump') setTimeout(() => particles(id, 0, { icon: 'dust', count: 4, spread: 60, rise: 12, life: 600, stagger: 0 }), 420);
  });

  socket.on('pg:fx', ({ from, to, kind, icon }) => {
    if (kind === 'cuddle') {
      entities.get(to)?.figure.sprite.play('jump', { once: true });
      entities.get(from)?.figure.sprite.play('wave', { once: true });
      particles(to, 0.75, { icon: 'heart', count: 6, spread: 80, rise: 70 });
      particles(from, 0.75, { icon: 'heart', count: 2, spread: 40, rise: 50 });
    } else if (kind === 'gift') {
      const giver = entities.get(from);
      const receiver = entities.get(to);
      if (giver && receiver) {
        flyTo(worldEl, pointOn(giver, 0.7), pointOn(receiver, 0.7), esc(icon), { size: 36, arc: 110 }).then(() => {
          receiver.figure.sprite.play('wave', { once: true });
          particles(to, 0.7, { icon: 'sparkle', count: 6, spread: 90, rise: 50 });
        });
      }
    }
  });

  socket.on('me:changed', (payload) => {
    if (payload?.levelUps?.length && selfId) {
      const me = entities.get(selfId);
      particles(selfId, 0.6, { icon: 'sparkle', count: 12, spread: 160, rise: 100 });
      if (me) floatText(worldEl, me.x, me.y - petHeight(me) - 10, 'LÊN CẤP!', { color: '#ffd75e', size: 26 });
    }
    ctx.onMeChanged(payload);
  });
  socket.on('pg:rooms', ({ rooms: list, cap: c }) => {
    rooms = list;
    cap = c ?? cap;
    if (!roomsEl.hidden) renderRooms();
  });
  socket.on('pg:error', ({ message }) => {
    if (statusEl.textContent.startsWith('Đang sang kênh')) setStatus(null);
    toast(message, 'error');
  });
  socket.on('pg:kicked', () => {
    setStatus('Bạn vừa vào công viên từ một tab khác.');
    socket.disconnect();
  });

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    resize.disconnect();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onDocClick);
    clearInterval(roomsPoll);
    socket.removeAllListeners();
    socket.disconnect();
    closeMenu();
    for (const id of [...entities.keys()]) removePlayer(id);
    scene?.destroy();
    unmountScene?.();
  };
}
