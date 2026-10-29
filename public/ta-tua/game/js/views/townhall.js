// Tòa thị chính: ngân sách thị trấn, bỏ phiếu chi tiêu mỗi tuần, hiệu ứng đang chạy, thuế thu nhập.
import { api } from '../api.js';
import { countdown, fmt, pct, viewHead } from '../ui.js';

const FLOW_LABELS = {
  fee: ['Phí giao dịch', 1], tax: ['Thuế', 1], town_seed: ['Quỹ khởi tạo', 1],
  stipend: ['Trợ cấp tân thủ', -1], town_spend: ['Đề xuất được duyệt', -1], guild_reward: ['Thưởng dự án Hội', -1],
};

export function renderTownhall(root, ctx) {
  root.innerHTML = `<div class="town-page">
    ${viewHead('🏛️ Tòa thị chính', 'Một nửa tiền thuế và phí vào ngân sách thị trấn. Mỗi tuần người chơi bỏ phiếu chọn cách tiêu.')}
    <div class="town-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.town-page');
  const view = page.querySelector('.town-view');
  const canVote = ctx.bestLevel() >= ctx.catalog.unlocks.townhall;

  function draw(t) {
    const brackets = ctx.catalog.town.brackets;
    let prev = 0;
    view.innerHTML = `
      <div class="town-grid">
        <section class="card town-box">
          <h3>💰 Ngân sách thị trấn</h3>
          <div class="big-number">${fmt(t.treasury)} <small>🪙</small></div>
          <ul class="flow-list">${Object.entries(t.flows).filter(([k]) => FLOW_LABELS[k]).map(([k, v]) => `
            <li><span>${FLOW_LABELS[k][0]}</span><b class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : ''}${fmt(v)}</b></li>`).join('') || '<li class="muted">Chưa có thu chi trong 7 ngày.</li>'}</ul>
          <p class="muted small">7 ngày gần nhất. Trợ cấp tân thủ hiện là ${t.stipend.amount} 🪙/ngày trong ${t.stipend.days} ngày đầu.</p>
        </section>

        <section class="card town-box wide">
          <header class="row-between"><h3>🗳️ Bỏ phiếu tuần này</h3><span class="badge">Chốt sau ${countdown(t.closesAt - Date.now())}</span></header>
          <div class="proposal-grid">
            ${t.proposals.map((p) => `
              <article class="proposal ${t.myVote === p.option ? 'voted' : ''}">
                <span class="proposal-icon">${p.icon}</span>
                <h4>${p.name}</h4>
                <p class="muted">${p.desc}</p>
                <p class="small">Chi phí <b>${fmt(p.cost)} 🪙</b>${t.treasury < p.cost ? ' · <span class="down">ngân sách chưa đủ</span>' : ''}</p>
                <div class="row-between"><b>${p.votes} phiếu</b>
                  ${t.myVote === p.option ? '<span class="badge star">✓ Bạn đã bầu</span>'
                    : `<button class="btn small primary" data-vote="${p.option}" ${canVote ? '' : 'disabled'}>Bầu</button>`}</div>
              </article>`).join('')}
          </div>
          ${canVote ? '<p class="muted small">Đổi ý được trước khi chốt. Đề xuất nhiều phiếu nhất được làm nếu ngân sách đủ tiền.</p>'
            : `<p class="locked-note">🔒 Có một bé cấp ${ctx.catalog.unlocks.townhall} là được bỏ phiếu.</p>`}
        </section>

        <section class="card town-box">
          <h3>✨ Đang có hiệu lực</h3>
          ${t.effects.length ? `<ul class="flow-list">${t.effects.map((e) => `
            <li><span>${e.label}</span><small class="muted">còn ${countdown(e.endsAt - Date.now())}</small></li>`).join('')}</ul>`
            : '<p class="muted">Chưa có. Bỏ phiếu để thay đổi thị trấn!</p>'}
          ${t.history.length ? `<h4>Các tuần trước</h4><ul class="flow-list">${t.history.map((h) => `
            <li><span>${h.week.slice(5)} · ${h.name}</span><b class="${h.status === 'funded' ? 'up' : 'down'}">${h.status === 'funded' ? 'đã làm' : 'thiếu tiền'}</b></li>`).join('')}</ul>` : ''}
        </section>

        <section class="card town-box wide">
          <h3>🧾 Thuế thu nhập</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>Thu nhập chịu thuế mỗi ngày</th><th class="num">Thuế suất</th></tr></thead>
            <tbody>${brackets.map(([cap, rate]) => {
              const row = `<tr><td>${fmt(prev)} – ${cap === null ? 'trở lên' : fmt(cap)}</td><td class="num">${pct(Math.max(0, rate - t.taxCut), 0, false)}${t.taxCut && rate ? ' <small class="up">(đang giảm)</small>' : ''}</td></tr>`;
              prev = cap;
              return row;
            }).join('')}</tbody>
          </table></div>
          <p class="muted small">Chịu thuế: lương, lãi ngân hàng, lợi nhuận quầy. Không chịu thuế: quà, nhiệm vụ, mini-game. Thuế trừ vào ví lúc nửa đêm.</p>
          ${t.taxDue ? `<p class="locked-note">Bạn đang nợ thuế ${fmt(t.taxDue)} 🪙, sẽ trừ tiếp khi ví có tiền.</p>` : ''}
          ${t.taxes.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Ngày</th><th class="num">Lương</th><th class="num">Lãi</th><th class="num">Quầy</th><th class="num">Chịu thuế</th><th class="num">Thuế</th></tr></thead>
            <tbody>${t.taxes.map((x) => `<tr><td>${x.day.slice(5)}</td><td class="num">${fmt(x.parts.salary ?? 0)}</td><td class="num">${fmt(x.parts.interest ?? 0)}</td>
              <td class="num">${fmt(x.parts.business ?? 0)}</td><td class="num">${fmt(x.taxable)}</td><td class="num down">${fmt(x.tax)}</td></tr>`).join('')}</tbody>
          </table></div>` : '<p class="muted">Bạn chưa phải đóng thuế ngày nào.</p>'}
        </section>
      </div>`;
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-vote]');
    if (btn && !btn.disabled) ctx.act('/town/vote', { option: btn.dataset.vote });
  });

  api('/town').then((t) => view.isConnected && draw(t)).catch(ctx.fail);
}
