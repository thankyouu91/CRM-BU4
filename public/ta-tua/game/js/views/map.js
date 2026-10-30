// Bản đồ Phố Trân Châu: trang chủ dẫn tới mọi khu, kèm nhiệm vụ ngày.
import { api } from '../api.js';
import { esc } from '../ui.js';
import { ELEMENTS, ELEMENT_RULES } from '../shared/pets.js';

/** Tòa nhà nào mở màn nào. Các khu chưa làm hiện mờ kèm "Sắp mở". */
const PLACES = [
  { id: 'home', name: 'Nhà', icon: '🏠', row: 0, slot: 0, kind: 'home', view: 'home' },
  { id: 'shop', name: 'Siêu thị', icon: '🏪', row: 0, slot: 1, kind: 'shop', view: 'shop' },
  { id: 'jobs', name: 'Việc làm', icon: '💼', row: 0, slot: 2, kind: 'jobs', view: 'jobs' },
  { id: 'bank', name: 'Ngân hàng', icon: '🏦', row: 0, slot: 3, kind: 'bank', view: 'bank', level: 'bank' },
  { id: 'market', name: 'Sàn Nguyên Liệu', icon: '📈', row: 0, slot: 4, kind: 'market', view: 'market' },
  { id: 'news', name: 'Báo Trân Châu', icon: '📰', row: 0, slot: 5, kind: 'news', view: 'news' },
  { id: 'townhall', name: 'Tòa thị chính', icon: '🏛️', row: 0, slot: 6, kind: 'townhall', view: 'townhall', level: 'townhall' },
  { id: 'school', name: 'Trường học', icon: '🏫', row: 0, slot: 7, kind: 'school', view: 'school', level: 'school' },
  { id: 'clinic', name: 'Phòng khám', icon: '🩺', row: 0, slot: 8, kind: 'clinic', view: 'clinic' },
  { id: 'park', name: 'Công viên', icon: '🌳', row: 1, slot: 0, kind: 'park', view: 'park' },
  { id: 'arcade', name: 'Khu vui chơi', icon: '🎮', row: 1, slot: 1, kind: 'arcade', view: 'games' },
  { id: 'kitchen', name: 'Bếp', icon: '🍳', row: 1, slot: 2, kind: 'kitchen', view: 'kitchen', level: 'kitchen' },
  { id: 'garden', name: 'Vườn', icon: '🌱', row: 1, slot: 3, kind: 'garden', view: 'garden', level: 'garden' },
  { id: 'bazaar', name: 'Chợ Phiên', icon: '🛒', row: 1, slot: 4, kind: 'bazaar', view: 'bazaar', level: 'bazaar' },
  { id: 'boba', name: 'Quầy trà sữa', icon: '🧋', row: 1, slot: 5, kind: 'boba', view: 'business', level: 'business' },
  // Khu công nghiệp mở cùng Sàn: gia công thuê dùng được từ cấp 2, xây xưởng thì màn bên trong tự khóa tới cấp 6.
  { id: 'factory', name: 'Khu công nghiệp', icon: '🏭', row: 1, slot: 6, kind: 'factory', view: 'factory', level: 'market' },
  { id: 'realestate', name: 'Gia tộc & Nhà Đất', icon: '🏘️', row: 1, slot: 7, kind: 'realestate', view: 'clans', level: 'clan' },
  { id: 'arena', name: 'Bảng vàng', icon: '🏆', row: 1, slot: 8, kind: 'arena', view: 'ranks' },
];

/** Vận khí hôm nay: một hành vượng, bé hành đó được thêm XP và lương. */
function fortuneBanner(element) {
  const el = ELEMENTS[element];
  if (!el) return '';
  const pct = ELEMENT_RULES.fortune * 100;
  return `<p class="fortune-banner" style="--el:${el.color}">${el.icon} <b>Vận khí hôm nay: hành ${el.name} vượng.</b>
    Bé hành ${el.name} được +${pct}% kinh nghiệm và +${pct}% lương ca làm.</p>`;
}

function placesFor(ctx) {
  const level = ctx.bestLevel();
  const { me, catalog } = ctx;
  const dailyReady = me.user.dailyReadyAt <= Date.now();
  return PLACES.map((p) => {
    const need = p.level ? catalog.unlocks[p.level] : 0;
    const unlocked = !p.soon && level >= need;
    let badge;
    if (p.id === 'jobs' && me.badges.jobs) badge = 'Lương sẵn sàng!';
    if (p.id === 'bank' && me.badges.bank) badge = 'Kỳ hạn đến hạn!';
    if (p.id === 'home' && dailyReady) badge = 'Có quà ngày!';
    return {
      id: p.id, name: p.name, icon: p.icon, row: p.row, slot: p.slot, kind: p.kind, unlocked,
      lockText: p.soon ?? `Mở khi có bé cấp ${need}`,
      badge,
    };
  });
}

export function renderMap(root, ctx) {
  const pet = ctx.activePet();
  root.innerHTML = `
    <div class="map-view">
      <div class="map-intro">
        <div>
          <h2>Phố Trân Châu</h2>
          <p class="muted">${pet ? `Chào ${esc(ctx.me.user.username)}! ${esc(pet.name)} đang đợi bạn.` : 'Chào mừng tới phố! Ghé Nhà để nhận nuôi bé đầu tiên.'}
            Chạm vào một tòa nhà để vào.</p>
          ${fortuneBanner(ctx.me.fortune)}
        </div>
      </div>
      <section class="card quest-board" hidden></section>
      <div class="map-host"></div>
    </div>`;
  const board = root.querySelector('.quest-board');

  function drawQuests(qv) {
    board.hidden = false;
    board.innerHTML = `
      <header class="row-between"><h3>📜 Nhiệm vụ hôm nay</h3>
        <span class="muted small">🔥 Chuỗi đăng nhập ${qv.streak} ngày</span></header>
      <div class="quest-list">
        ${qv.quests.map((x) => `
          <div class="quest ${x.claimed ? 'done' : ''}">
            <span>${esc(x.text)}</span>
            <div class="bar xp"><i style="width:${(x.progress / x.goal) * 100}%"></i></div>
            <small class="muted">${x.progress}/${x.goal} · +${x.reward} 🪙</small>
            ${x.claimed ? '<span class="badge star">✓</span>'
              : `<button class="btn small gold" data-quest="${x.slot}" ${x.progress >= x.goal ? '' : 'disabled'}>Nhận</button>`}
          </div>`).join('')}
        <div class="quest chest ${qv.chest.claimed ? 'done' : ''}">
          <span>🎁 Rương nhiệm vụ</span>
          <small class="muted">Xong cả 3 nhiệm vụ · +${qv.chest.reward} 🪙</small>
          ${qv.chest.claimed ? '<span class="badge star">✓</span>'
            : `<button class="btn small gold" data-quest="-1" ${qv.chest.ready ? '' : 'disabled'}>Mở</button>`}
        </div>
      </div>`;
  }
  board.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quest]');
    if (btn && !btn.disabled) ctx.act(`/quests/${btn.dataset.quest}/claim`);
  });
  if (ctx.me.pets.length) api('/quests').then((qv) => board.isConnected && drawQuests(qv)).catch(ctx.fail);
  const host = root.querySelector('.map-host');
  const places = placesFor(ctx);
  const open = (id) => {
    const place = PLACES.find((p) => p.id === id);
    if (place?.view) ctx.go(place.view);
  };

  // Danh sách nút dự phòng hiện ngay; bản đồ pixel nạp sau thì thay vào.
  host.innerHTML = `<div class="map-fallback">${places.map((p) => `
    <button class="btn" data-place="${p.id}" ${p.unlocked ? '' : 'disabled'} title="${esc(p.unlocked ? p.name : p.lockText)}">
      ${p.icon} ${p.name}${p.badge ? ' ❗' : ''}</button>`).join('')}</div>`;
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-place]');
    if (btn) open(btn.dataset.place);
  });

  let map = null;
  let alive = true;
  import('../townmap.js')
    .then(({ mountTownMap }) => {
      if (!alive) return;
      host.replaceChildren();
      map = mountTownMap(host, { places, onSelect: open });
    })
    .catch((err) => console.warn('Không nạp được bản đồ pixel, dùng danh sách nút.', err));
  return () => {
    alive = false;
    map?.destroy();
  };
}
