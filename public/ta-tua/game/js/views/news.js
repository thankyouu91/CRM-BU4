// Báo Trân Châu: thông báo của ban quản lý (ghim đầu báo), tin thị trường và thông báo của Ngân hàng Trung ương.
import { api } from '../api.js';
import { ago, esc, viewHead } from '../ui.js';
import { renderAnnouncement } from '../shared/announce.js';

export { renderAnnouncement };

/** Thẻ một thông báo; `open` để mở sẵn phần nội dung. */
export const announcementCard = (a, { open = false } = {}) => `
  <details class="announcement" ${open ? 'open' : ''}>
    <summary><span class="news-icon">📣</span><span><b>${esc(a.title)}</b><small class="muted">Ban quản lý · ${ago(a.at)}</small></span></summary>
    <div class="announcement-body">${renderAnnouncement(a.body)}</div>
  </details>`;

export function renderNews(root, ctx) {
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
  root.innerHTML = `${viewHead('📰 Báo Trân Châu', `Số ra ${today}`)}
    <section class="card newspaper"><div class="empty muted">Đang tải…</div></section>`;
  const paper = root.querySelector('.newspaper');
  const { commodities } = ctx.catalog;

  Promise.all([api('/news'), api('/announcements').catch(() => [])]).then(([items, notes]) => {
    if (!paper.isConnected) return;
    const pinned = notes.length ? `<section class="announcements">${notes.map((a, i) => announcementCard(a, { open: i === 0 })).join('')}</section>` : '';
    if (!items.length) {
      paper.innerHTML = `${pinned}<div class="empty"><b>🗞️</b><p class="muted">Thị trấn hôm nay yên ả, chưa có tin gì.</p></div>`;
      return;
    }
    paper.innerHTML = `${pinned}<ul class="news-list">${items.map((n) => {
      const c = n.commodity ? commodities[n.commodity] : null;
      return `<li class="${c ? '' : 'official'}">
        <span class="news-icon">${c ? c.icon : '🏛️'}</span>
        <div>
          <b>${esc(n.headline)}</b>
          <small class="muted">${c ? `${c.name} · dự báo ${n.up ? '<span class="up">tăng giá ▲</span>' : '<span class="down">giảm giá ▼</span>'} · ` : ''}${ago(n.at)}</small>
        </div>
        ${c ? '<button class="btn small" data-go="market">Xem Sàn</button>' : ''}
      </li>`;
    }).join('')}</ul>`;
  }).catch(ctx.fail);
}
