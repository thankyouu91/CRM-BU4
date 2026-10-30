// Sàn cổ phiếu gia tộc: IPO, mua bán theo quỹ khớp lệnh (giá theo cung cầu, biên ±15%/ngày), vay ký quỹ, cổ tức, thâu tóm.
// Luật ở shared/clan-shares.js; server ở petdex/server/clan-shares.js.
import { api } from '../api.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';

const price = (p) => p.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const change = (c) => `<b class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '+' : ''}${(c * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</b>`;

export function renderShares(root, ctx) {
  root.innerHTML = `${viewHead('📈 Sàn cổ phiếu gia tộc', 'Mua cổ phần các gia tộc đã lên sàn. Giá chạy theo cung cầu, mỗi ngày dao động tối đa ±15%.')}
    <div class="bank-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.bank-view');
  const need = ctx.catalog.unlocks.bank;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Chưa mở</h2><p class="muted">Có một bé đạt cấp ${need} là mua cổ phiếu được.</p></section>`;
    return;
  }

  function listingCard(l, v) {
    const mine = v.holdings.find((h) => h.clanId === l.clanId);
    if (l.status === 'subscribing') {
      return `<section class="card bank-box"><h3>${esc(l.emblem)} ${esc(l.name)} <small class="muted">đang IPO</small></h3>
        <p class="muted small">Giá IPO <b>${fmt(l.ipo.price)}</b> xu · còn ${fmt(l.ipo.shares - l.ipo.sold)}/${fmt(l.ipo.shares)} cổ phần · đóng sau ${countdown(l.ipo.closesAt - Date.now())} · sổ sách ${price(l.book)} xu/cổ phần</p>
        <form class="money-form" data-subscribe="${l.clanId}"><input name="qty" type="number" min="1" max="${v.rules.playerCap}" step="1" placeholder="Số cổ phần" required /><button class="btn primary">Mua IPO</button></form>
        ${mine ? `<p class="muted small">Bạn đang có ${fmt(mine.qty)} cổ phần.</p>` : ''}</section>`;
    }
    return `<section class="card bank-box"><h3>${esc(l.emblem)} ${esc(l.name)}</h3>
      <div class="cb-stats">
        <div><span class="muted">Giá</span><b>${price(l.price)}</b><small>${change(l.change)} hôm nay</small></div>
        <div><span class="muted">Sổ sách</span><b>${price(l.book)}</b></div>
        <div><span class="muted">Khớp 24 giờ</span><b>${fmt(l.volume24h)}</b></div>
      </div>
      <p class="muted small">Mua 1 cổ phần ${fmt(l.quote.buy1)} xu, bán 1 nhận ${fmt(l.quote.sell1)} xu (chưa tính phí ${Math.round(v.rules.fee * 100)}%). Biên hôm nay ${price(l.quote.minPrice)}–${price(l.quote.maxPrice)}.${l.controller ? ` Gia tộc ${esc(l.controller.name)} đang nắm quyền kiểm soát.` : ''}</p>
      <form class="money-form wrap" data-trade="${l.clanId}">
        <input name="qty" type="number" min="1" step="1" placeholder="Số cổ phần" required />
        <button class="btn primary" value="buy">Mua</button><button class="btn" value="sell">Bán</button>
        ${v.marginOpen ? `<label class="small"><input type="checkbox" name="margin" /> Vay ký quỹ ${Math.round(v.rules.margin.maxLtv * 100)}%</label>` : ''}
      </form>
      ${mine ? `<p class="muted small">Bạn có ${fmt(mine.qty)} cổ phần${mine.pledged ? ` (${fmt(mine.pledged)} đang cầm cố)` : ''}, trị giá khoảng ${fmt(mine.qty * l.price)} xu.</p>` : ''}
    </section>`;
  }

  function margins(v) {
    if (!v.margins.length) return '';
    return `<section class="card bank-box wide"><h3>🧾 Vay ký quỹ</h3><ul class="deposit-list">${v.margins.map((m) => `<li><div><b>${esc(m.name)}</b> · ${fmt(m.shares)} cổ phần cầm cố · nợ ${fmt(m.owed)} xu · ${m.status === 'open' ? 'đang nợ' : m.status === 'repaid' ? 'đã trả' : 'đã bán giải chấp'}</div>
      ${m.status === 'open' ? `<div class="row-between"><small class="muted">Giá trị cổ phần dưới ${Math.round(v.rules.margin.maintenance * 100)}% số nợ thì bị bán giải chấp.</small><button class="btn small gold" data-repay="${m.id}">Trả ${fmt(m.owed)}</button></div>` : ''}</li>`).join('')}</ul></section>`;
  }

  function clanPanel(v) {
    const c = v.clan;
    if (!c?.leader) return '';
    const l = c.listing;
    const others = v.listings.filter((x) => x.status === 'listed' && x.clanId !== c.id);
    return `<section class="card bank-box wide"><h3>🏯 Cổ phiếu của ${esc(c.name)}</h3>
      ${!l ? `<p class="muted">Giá trị sổ sách ${price(c.book)} xu/cổ phần. Bán ra ${Math.round(v.rules.ipoMin * 100)}–${Math.round(v.rules.ipoMax * 100)}% (tối đa ${v.rules.ipoMaxShares} cổ phần), giá ${fmt(c.ipoRange[0])}–${fmt(c.ipoRange[1])} xu. Quỹ góp ${v.rules.poolSeed} cổ phần × giá IPO vào quỹ khớp lệnh; thành viên chia phần còn lại theo số đã góp quỹ.</p>
        <form class="money-form wrap" data-form="ipo"><input name="shares" type="number" min="1" max="${v.rules.ipoMaxShares}" placeholder="Số cổ phần bán ra" required />
          <input name="price" type="number" min="${c.ipoRange[0]}" max="${c.ipoRange[1]}" placeholder="Giá IPO" required /><button class="btn primary">Lên sàn</button></form>`
        : `<p class="muted">Cổ đông lớn: ${c.holders.map((h) => `${esc(h.name)} ${fmt(h.qty)}`).join(' · ')}</p>
        ${l.status === 'listed' ? `<form class="money-form wrap" data-form="dividend"><input name="amount" type="number" min="1" placeholder="Tổng tiền cổ tức" required /><button class="btn">Chia cổ tức</button><small class="muted">Còn chia được ${fmt(c.dividendRoom)} xu (lợi nhuận 7 ngày).</small></form>
        <form class="money-form wrap" data-clan-trade="${c.id}"><input name="qty" type="number" min="1" placeholder="Số cổ phần" required /><button class="btn" value="buy">Mua lại bằng quỹ</button><button class="btn" value="sell">Bán cổ phần tự giữ</button></form>` : ''}`}
      ${others.length ? `<h4>Mua bán cổ phiếu gia tộc khác bằng quỹ</h4><form class="money-form wrap" data-form="clan-trade">
        <select name="clan">${others.map((x) => `<option value="${x.clanId}">${esc(x.emblem)} ${esc(x.name)} · ${price(x.price)}</option>`).join('')}</select>
        <input name="qty" type="number" min="1" placeholder="Số cổ phần" required /><button class="btn" value="buy">Mua</button><button class="btn" value="sell">Bán</button>
        <label class="small"><input type="checkbox" name="asBank" /> Dùng vốn ngân hàng</label></form>` : ''}
      ${c.holdings.length ? `<p class="muted small">Gia tộc đang giữ: ${c.holdings.map((h) => `${esc(h.emblem)} ${esc(h.name)} ${fmt(h.qty)}`).join(' · ')}</p>` : ''}
      ${c.controls.map((t) => `<div class="card"><b>Gia tộc kiểm soát ${esc(t.name)}</b>
        <form class="money-form wrap" data-appoint="${t.clanId}"><select name="user">${t.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select><button class="btn">Bổ nhiệm tộc trưởng</button></form>
        <button class="btn danger small" data-merge="${t.clanId}">Sáp nhập đất về gia tộc mình</button></div>`).join('')}
    </section>`;
  }

  function draw(v) {
    view.innerHTML = `<p class="muted">Mỗi người giữ tối đa ${v.rules.playerCap} cổ phần (${Math.round(v.rules.playerCap / v.rules.total * 100)}%) của một gia tộc. <a href="https://wiki.petfarm.online/co-phan-gia-toc" target="_blank" rel="noopener">Đọc luật trong wiki</a>.</p>
      <div class="bank-grid">
        ${v.listings.length ? v.listings.map((l) => listingCard(l, v)).join('') : '<section class="card bank-box"><p class="muted">Chưa có gia tộc nào lên sàn.</p></section>'}
        ${margins(v)}
        ${clanPanel(v)}
      </div>`;
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.repay) ctx.act(`/shares/margin/${btn.dataset.repay}/repay`);
    else if (btn.dataset.merge && confirm('Sáp nhập: chuyển đất của gia tộc bị kiểm soát về gia tộc mình (trong giới hạn số lô). Tiếp tục?')) ctx.act(`/shares/${btn.dataset.merge}/merge`);
  });

  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const num = (k) => Number(f.get(k));
    const side = e.submitter?.value ?? 'buy';
    if (form.dataset.subscribe) ctx.act(`/shares/${form.dataset.subscribe}/subscribe`, { qty: num('qty') });
    else if (form.dataset.trade) {
      if (f.get('margin') === 'on' && side === 'buy' && !confirm('Vay ký quỹ: giá giảm sâu thì cổ phần bị bán giải chấp để trả nợ. Vẫn vay?')) return;
      ctx.act(`/shares/${form.dataset.trade}/${side}`, side === 'buy' ? { qty: num('qty'), margin: f.get('margin') === 'on' } : { qty: num('qty') });
    } else if (form.dataset.clanTrade) ctx.act(`/shares/${form.dataset.clanTrade}/clan-trade`, { side, qty: num('qty') });
    else if (form.dataset.appoint) ctx.act(`/shares/${form.dataset.appoint}/appoint`, { userId: num('user') });
    else if (form.dataset.form === 'ipo') {
      if (!confirm('Lên sàn là không rút lại được. Tiếp tục?')) return;
      ctx.act('/shares/ipo', { shares: num('shares'), price: num('price') });
    } else if (form.dataset.form === 'dividend') ctx.act('/shares/dividend', { amount: num('amount') });
    else if (form.dataset.form === 'clan-trade') ctx.act(`/shares/${num('clan')}/clan-trade`, { side, qty: num('qty'), asBank: f.get('asBank') === 'on' });
  });

  api('/shares').then((v) => view.isConnected && draw(v)).catch(ctx.fail);
}
