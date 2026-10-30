// Trái phiếu: mua đợt đang mở bán, sàn thứ cấp, phát hành (tộc trưởng), lãi suất cơ bản (gia tộc nắm Ngân hàng nhà nước).
// Luật ở shared/clan-bonds.js; server ở petdex/server/clan-bonds.js.
import { api } from '../api.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';

const ratePct = (r) => `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}%/ngày`;
const STATUS = { subscribing: 'Đang mở bán', active: 'Đang lưu hành', defaulted: 'Vỡ nợ', matured: 'Đã đáo hạn', cancelled: 'Đã hủy' };

export function renderBonds(root, ctx) {
  root.innerHTML = `${viewHead('📜 Trái phiếu', 'Cho gia tộc hoặc kho bạc vay, nhận lãi cố định mỗi đêm và lấy lại gốc khi đáo hạn.')}
    <div class="bank-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.bank-view');
  const need = ctx.catalog.unlocks.bank;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Chưa mở</h2><p class="muted">Có một bé đạt cấp ${need} là mua trái phiếu được.</p></section>`;
    return;
  }

  function issueCard(i, v) {
    const asks = v.asks.filter((a) => a.issueId === i.id);
    const mine = v.holdings.find((h) => h.issueId === i.id);
    return `<section class="card bank-box"><h3>${esc(i.issuer)} <small class="muted">đợt #${i.id}</small></h3>
      <p class="muted small">${STATUS[i.status] ?? i.status} · ${i.termDays} ngày · lãi ${ratePct(i.coupon)} (${fmt(i.per100)} xu/đêm cho 100 trái phiếu, mệnh giá ${fmt(i.face)})${i.maturesAt ? ` · đáo hạn sau ${countdown(i.maturesAt - Date.now())}` : ''}${i.arrears ? ` · <b class="down">còn nợ ${fmt(i.arrears)} xu</b>` : ''}</p>
      ${i.open ? `<p class="muted small">Đã bán ${fmt(i.sold)}/${fmt(i.qty)} · đóng sau ${countdown(i.closesAt - Date.now())} · mỗi người tối đa ${fmt(i.cap)}</p>
        <form class="money-form" data-subscribe="${i.id}"><input name="qty" type="number" min="1" max="${i.cap}" placeholder="Số trái phiếu" required /><button class="btn primary">Mua ${fmt(i.face)} xu/trái phiếu</button></form>` : ''}
      ${asks.length ? `<ul class="deposit-list">${asks.map((a) => `<li class="row-between"><span>${fmt(a.qty)} × ${fmt(a.price)} xu</span>${a.mine ? `<button class="btn small" data-cancel="${a.id}">Rút lệnh</button>` : `<form class="money-form" data-buy="${a.id}"><input name="qty" type="number" min="1" max="${a.qty}" value="1" /><button class="btn small">Mua</button></form>`}</li>`).join('')}</ul>` : ''}
      ${mine ? `<p class="muted small">Bạn có ${fmt(mine.qty)} trái phiếu${mine.listed ? ` (${fmt(mine.listed)} đang rao bán)` : ''}.</p>
        ${['active', 'defaulted'].includes(i.status) ? `<form class="money-form" data-list="${i.id}"><input name="qty" type="number" min="1" max="${mine.qty - mine.listed}" placeholder="Số lượng" required /><input name="price" type="number" min="1" placeholder="Giá mỗi trái phiếu" required /><button class="btn">Rao bán</button></form>` : ''}` : ''}
    </section>`;
  }

  function clanPanel(v) {
    const c = v.clan;
    if (!c?.leader) return '';
    return `<section class="card bank-box wide"><h3>🏯 ${esc(c.name)}</h3>
      ${c.inDefault ? '<p class="down">Gia tộc đang nợ trái chủ: chưa phát hành thêm, chia cổ tức hay mua lại cổ phần được.</p>' : `<form class="money-form wrap" data-form="issue">
        <input name="qty" type="number" min="${v.rules.minQty}" max="${Math.min(v.rules.maxQty, c.room)}" placeholder="Số trái phiếu (còn ${fmt(c.room)})" required />
        <input name="coupon" type="number" step="0.001" min="${+(v.couponRange[0] * 100).toFixed(4)}" max="${+(v.couponRange[1] * 100).toFixed(4)}" placeholder="Lãi %/ngày" required />
        <select name="term">${v.rules.terms.map((t) => `<option value="${t}">${t} ngày</option>`).join('')}</select>
        <button class="btn primary">Phát hành</button></form>
        <p class="muted small">Lãi coupon từ ${ratePct(v.couponRange[0])} tới ${ratePct(v.couponRange[1])}. Tổng mệnh giá đang lưu hành không quá ${Math.round(v.rules.clanBookShare * 100)}% giá trị sổ sách.</p>`}
      ${c.rateHolder ? `<h4>🏛️ Lãi suất cơ bản</h4><p class="muted small">Lãi chính sách ${ratePct(v.policyRate)}, đang áp dụng ${ratePct(v.baseRate)}. Gia tộc đặt được ${ratePct(v.rateBand[0])}–${ratePct(v.rateBand[1])} tới phiên họp sau. Lần bị phạt trong ${v.ratePower.strikeDays} ngày: ${c.strikes}.</p>
        <form class="money-form" data-form="rate"><input name="rate" type="number" step="0.001" value="${+(v.baseRate * 100).toFixed(4)}" /> %/ngày<button class="btn">Đặt lãi suất</button></form>` : ''}
    </section>`;
  }

  function draw(v) {
    const live = v.issues.filter((i) => ['subscribing', 'active', 'defaulted'].includes(i.status));
    view.innerHTML = `<p class="muted">Lãi suất cơ bản ${ratePct(v.baseRate)}${v.rateSetBy ? ` (do ${esc(v.rateSetBy)} đặt)` : ''}. Lãi trái phiếu bị khấu thuế lợi nhuận tài chính 10%. <a href="https://wiki.petfarm.online/trai-phieu" target="_blank" rel="noopener">Đọc luật trong wiki</a>.</p>
      <div class="bank-grid">
        ${live.length ? live.map((i) => issueCard(i, v)).join('') : '<section class="card bank-box"><p class="muted">Chưa có đợt trái phiếu nào.</p></section>'}
        ${clanPanel(v)}
      </div>`;
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn?.dataset.cancel) ctx.act(`/bonds/asks/${btn.dataset.cancel}/cancel`);
  });
  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const num = (k) => Number(f.get(k));
    if (form.dataset.subscribe) ctx.act(`/bonds/${form.dataset.subscribe}/subscribe`, { qty: num('qty') });
    else if (form.dataset.buy) ctx.act(`/bonds/asks/${form.dataset.buy}/buy`, { qty: num('qty') });
    else if (form.dataset.list) ctx.act(`/bonds/${form.dataset.list}/list`, { qty: num('qty'), price: num('price') });
    else if (form.dataset.form === 'issue') ctx.act('/bonds/issue', { qty: num('qty'), coupon: num('coupon') / 100, term: num('term') });
    else if (form.dataset.form === 'rate') ctx.act('/bonds/rate', { rate: num('rate') / 100 });
  });

  api('/bonds').then((v) => view.isConnected && draw(v)).catch(ctx.fail);
}
