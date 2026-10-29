export const $ = (selector, root = document) => root.querySelector(selector);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const STAT_LABELS = { fullness: 'No bụng', happiness: 'Vui vẻ', energy: 'Năng lượng', hygiene: 'Sạch sẽ', health: 'Sức khỏe' };
export const STAT_ICONS = { fullness: '🍙', happiness: '💖', energy: '⚡', hygiene: '🫧', health: '❤️' };
export const TYPE_LABELS = { food: 'Đồ ăn', care: 'Chăm sóc', toy: 'Đồ chơi', accessory: 'Phụ kiện', egg: 'Trứng', dish: 'Món nấu' };
export const MOOD_ICONS = { great: '🥰', ok: '🙂', hungry: '😋', tired: '😴', sad: '🥺', sick: '🤒', dirty: '🫧' };

export function effectText(item) {
  if (item.effect) {
    const parts = Object.entries(item.effect).map(([stat, v]) => `${STAT_ICONS[stat]} +${v}`);
    if (item.xp) parts.push(`⭐ +${item.xp} XP`);
    return parts.join('  ');
  }
  if (item.play) return `Khi chơi: 💖 +${item.play.happiness}  ⭐ +${item.play.xp} XP`;
  if (item.type === 'egg') return 'Ấp 24 giờ thì nở';
  return { head: 'Đội trên đầu', face: 'Đeo trên mặt', neck: 'Quàng ở cổ', back: 'Khoác sau lưng' }[item.slot] ?? '';
}

export function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, kind === 'error' ? 4200 : 3200);
}

let closeCurrent = null;

/** Mở hộp thoại; `onPick(value)` nhận data-pick của nút được bấm. */
export function openModal({ title, html, onPick }) {
  closeModal();
  const root = document.createElement('div');
  root.className = 'modal-backdrop';
  root.innerHTML = `
    <div class="modal card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h3>${esc(title)}</h3><button class="close" data-close aria-label="Đóng">✕</button></header>
      ${html}
    </div>`;
  const onKey = (e) => e.key === 'Escape' && closeModal();
  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('[data-close]')) return closeModal();
    const pick = e.target.closest('[data-pick]');
    if (pick && onPick) onPick(pick.dataset.pick);
  });
  document.addEventListener('keydown', onKey);
  $('#modal-root').append(root);
  closeCurrent = () => {
    document.removeEventListener('keydown', onKey);
    root.remove();
  };
}

export function closeModal() {
  closeCurrent?.();
  closeCurrent = null;
}

export const modalOpen = () => closeCurrent !== null;

/** Bé đang bận việc gì (busyKind từ máy chủ; thiếu thì là ca làm). `away`: bé rời nhà lúc đó. */
export const BUSY = {
  work: { icon: '💼', text: 'đang đi làm', until: 'về lúc', away: true },
  school: { icon: '📚', text: 'đang đi học', until: 'về lúc', away: true },
  bath: { icon: '🛁', text: 'đang tắm', until: 'xong lúc', away: false },
};
export const busyOf = (pet) => (pet?.busyUntil && pet.busyUntil > Date.now() ? BUSY[pet.busyKind] ?? BUSY.work : null);

export const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
/** Số phần → số lô (1 lô = 10 phần). */
export const fmtLots = (qty) => (qty / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
export const fmtPrice = (p) => p.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pct = (v, digits = 1, sign = true) =>
  `${sign && v > 0 ? '+' : ''}${(v * 100).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
export const clock = (ts) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function countdown(ms) {
  if (ms <= 0) return 'xong';
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)} ngày ${h % 24}g`;
  if (h) return `${h}g ${String(m).padStart(2, '0')}p`;
  return m ? `${m}p ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

/** "3 tuần 2 ngày tuổi" từ số ngày tuổi. */
export function ageText(days) {
  const w = Math.floor(days / 7);
  const d = days % 7;
  if (!w) return `${d} ngày tuổi`;
  return d ? `${w} tuần ${d} ngày tuổi` : `${w} tuần tuổi`;
}

export const viewHead = (title, subtitle = '', extra = '') => `
  <div class="view-head">
    <div>
      <button class="link-back" data-go="map">← Về phố</button>
      <h2>${title}</h2>
      ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
    </div>
    ${extra}
  </div>`;

export function formatWait(ms) {
  const minutes = Math.ceil(ms / 60_000);
  const h = Math.floor(minutes / 60);
  return h ? `${h}g${String(minutes % 60).padStart(2, '0')}` : `${minutes}p`;
}
