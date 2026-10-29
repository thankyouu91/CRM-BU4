// Báo Trân Châu: tin thị trường và thông báo của Ngân hàng Trung ương.
import { api } from '../api.js';
import { ago, esc, viewHead } from '../ui.js';

export function renderNews(root, ctx) {
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
  root.innerHTML = `${viewHead('📰 Báo Trân Châu', `Số ra ${today}`)}
    <section class="card newspaper"><div class="empty muted">Đang tải…</div></section>`;
  const paper = root.querySelector('.newspaper');
  const { commodities } = ctx.catalog;

  api('/news').then((items) => {
    if (!paper.isConnected) return;
    if (!items.length) {
      paper.innerHTML = '<div class="empty"><b>🗞️</b><p class="muted">Thị trấn hôm nay yên ả, chưa có tin gì.</p></div>';
      return;
    }
    paper.innerHTML = `<ul class="news-list">${items.map((n) => {
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
