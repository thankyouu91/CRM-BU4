// Ngân hàng gia tộc: gửi tiền ở ngân hàng của gia tộc nắm Ngân hàng nhà nước, vay thế chấp lô đất, đấu giá lô siết nợ.
// Luật ở shared/clan-bank.js; server ở petdex/server/clan-bank.js.
import { api } from '../api.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';

const ratePct = (r) => `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}%/ngày`;
const STATUS = { open: 'Đang gửi', queued: 'Đang xếp hàng rút', closed: 'Đã tất toán', failed: 'Ngân hàng đổ vỡ' };
const LOAN_STATUS = { active: 'Đang nợ', late: 'Quá hạn', repaid: 'Đã trả xong', defaulted: 'Vỡ nợ, đã siết lô', written_off: 'Vỡ nợ, mất trắng' };

export function renderClanBank(root, ctx) {
  root.innerHTML = `${viewHead('🏯 Ngân hàng gia tộc', 'Gửi tiền ở ngân hàng do gia tộc nắm Ngân hàng nhà nước điều hành, hoặc vay thế chấp lô đất.')}
    <div class="bank-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.bank-view');
  const need = ctx.catalog.unlocks.bank;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Chưa mở</h2><p class="muted">Có một bé đạt cấp ${need} là gửi ngân hàng được.</p></section>`;
    return;
  }

  function bankCard(b, v) {
    return `<section class="card bank-box">
      <h3>${esc(b.emblem)} ${esc(b.name)}</h3>
      <p class="muted small">Uy tín <b>${b.reputation}</b>/100 · tiền mặt ${b.liquidity >= 1 ? 'đủ trả mọi khoản gửi' : `đủ trả ${Math.round(b.liquidity * 100)}% tiền gửi`}${b.queuedCount ? ` · <b class="down">${b.queuedCount} lệnh rút đang xếp hàng</b>` : ''}${b.frozen ? ' · <b class="down">đang phong tỏa</b>' : ''}</p>
      <div class="term-options">${b.rates.map((r) => `<div class="term"><b>${r.days} ngày</b><span>${ratePct(r.rate)}</span><small>${r.rate > v.baseRate ? `gấp ${(r.rate / v.baseRate).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} lãi NPC` : 'bằng lãi NPC'}</small></div>`).join('')}</div>
      ${b.accepting ? `<form class="money-form" data-deposit="${b.clanId}">
        <input name="amount" type="number" min="${v.rules.minDeposit}" step="1" inputmode="numeric" placeholder="Tối thiểu ${v.rules.minDeposit} xu" required />
        <select name="term">${v.rules.terms.map((t) => `<option value="${t}">${t} ngày</option>`).join('')}</select>
        <button class="btn primary">Gửi</button>
      </form>` : `<p class="muted small">Tạm không nhận tiền gửi mới${b.why ? `: ${esc(b.why)}` : ''}.</p>`}
      ${b.lendingOpen ? `<p class="muted small">Cho vay thế chấp: ${ratePct(b.loanRate)}, còn cho vay được ${fmt(b.lendable)} xu.</p>` : ''}
    </section>`;
  }

  function depositList(v) {
    if (!v.deposits.length) return '<p class="muted">Bạn chưa gửi ở ngân hàng gia tộc nào.</p>';
    return `<ul class="deposit-list">${v.deposits.map((d) => `<li>
      <div><b>${fmt(d.amount)} 🪙</b> · ${esc(d.emblem)} ${esc(d.bank)} · ${d.termDays} ngày · ${ratePct(d.rate)} · lãi <b class="up">+${fmt(d.interest)}</b></div>
      <div class="row-between"><small class="muted">${STATUS[d.status] ?? d.status}${d.status === 'open' ? (d.matured ? ' · đã đáo hạn' : ` · đáo hạn sau ${countdown(d.maturesAt - Date.now())}`) : ''}${d.payout != null && d.status !== 'open' ? ` · ${d.status === 'queued' ? 'chờ nhận' : 'đã nhận'} ${fmt(d.payout)} xu${d.insured ? ` (bảo hiểm bù ${fmt(d.insured)})` : ''}` : ''}</small>
        ${d.status === 'open' ? `<button class="btn small ${d.matured ? 'gold' : ''}" data-withdraw="${d.id}" data-early="${d.matured ? '' : '1'}">${d.matured ? 'Nhận tiền' : 'Rút sớm'}</button>` : ''}</div>
    </li>`).join('')}</ul>`;
  }

  function manage(v) {
    const c = v.clan;
    if (!c?.leader || (!c.holder && !c.bank)) return '';
    if (!c.bank || c.bank.status !== 'open') {
      if (!c.holder) return '';
      return `<section class="card bank-box wide"><h3>🏦 Mở ngân hàng của gia tộc</h3>
        <p class="muted">Gia tộc đang nắm Ngân hàng nhà nước. Vốn chủ tối thiểu ${fmt(v.rules.minCapital)} xu, chuyển từ quỹ gia tộc (quỹ đang có ${fmt(c.fund)} xu).</p>
        <form class="money-form" data-form="open"><input name="capital" type="number" min="${v.rules.minCapital}" step="1000" required placeholder="Vốn chủ" /><button class="btn primary">Mở ngân hàng</button></form></section>`;
    }
    const b = c.bank;
    return `<section class="card bank-box wide"><h3>🏦 Quản lý ngân hàng ${esc(c.name)}</h3>
      <div class="cb-stats">
        <div><span class="muted">Tiền mặt</span><b>${fmt(b.cash)}</b></div>
        <div><span class="muted">Tiền gửi</span><b>${fmt(b.deposits)}</b><small>${b.depositors} người</small></div>
        <div><span class="muted">Đang cho vay</span><b>${fmt(b.loans)}</b></div>
        <div><span class="muted">Vốn chủ</span><b>${fmt(b.equity)}</b></div>
        <div><span class="muted">Tiền mặt tối thiểu</span><b>${fmt(b.floor)}</b></div>
        <div><span class="muted">Uy tín</span><b>${b.reputation}</b></div>
      </div>
      ${b.queuedCount ? `<p class="down">⚠️ ${b.queuedCount} lệnh rút đang xếp hàng (${fmt(b.queued)} xu). Quá ${v.rules.failNights} đêm chưa trả hết thì ngân hàng đổ vỡ.</p>` : ''}
      <form class="money-form wrap" data-form="terms">
        ${v.rules.terms.map((t) => `<label>${t} ngày <input name="r${t}" type="number" min="0" step="0.001" value="${+((b.rates[t] ?? 0) * 100).toFixed(4)}" /> %/ngày</label>`).join('')}
        <label>Cho vay <input name="loan" type="number" step="0.001" value="${+(b.loanRate * 100).toFixed(4)}" /> %/ngày</label>
        <label><input name="lending" type="checkbox" ${b.lendingOpen ? 'checked' : ''} /> Mở cho vay</label>
        <button class="btn primary">Lưu lãi suất</button>
      </form>
      <p class="muted small">Lãi tiền gửi tối đa ${ratePct(v.maxDepositRate)}; lãi cho vay từ ${ratePct(v.loanRange[0])} tới ${ratePct(v.loanRange[1])}.</p>
      <form class="money-form" data-form="capital"><input name="amount" type="number" min="1" step="1" required placeholder="Số xu" />
        <button class="btn" value="in">Góp vốn từ quỹ</button><button class="btn" value="out">Rút vốn về quỹ</button></form>
      ${b.loanList.length ? `<h4>Khoản đã cho vay</h4><ul class="deposit-list">${b.loanList.map((l) => `<li><b>${esc(l.emblem)} ${esc(l.clan)}</b> · gốc ${fmt(l.amount)} · còn ${fmt(l.left)} · ${LOAN_STATUS[l.status] ?? l.status}${['active', 'late'].includes(l.status) ? ` · hạn ${countdown(l.dueAt - Date.now())}` : ''}</li>`).join('')}</ul>` : ''}
    </section>`;
  }

  function borrow(v) {
    const c = v.clan;
    if (!c?.leader) return '';
    const lenders = v.banks.filter((b) => b.lendingOpen && !c.related.includes(b.clanId));
    const plots = c.plots.filter((p) => !p.pledged);
    const loans = c.loans.length ? `<ul class="deposit-list">${c.loans.map((l) => `<li><div><b>${esc(l.emblem)} ${esc(l.bank)}</b> · gốc ${fmt(l.amount)} · phải trả ${fmt(l.owed)} · đã trả ${fmt(l.paid)} · ${LOAN_STATUS[l.status] ?? l.status}</div>
      ${['active', 'late'].includes(l.status) ? `<div class="row-between"><small class="muted">${l.status === 'late' ? `Quá hạn ${l.lateNights} đêm` : `Đáo hạn sau ${countdown(l.dueAt - Date.now())}`}</small><button class="btn small gold" data-repay="${l.id}">Trả hết ${fmt(l.left)}</button></div>` : ''}</li>`).join('')}</ul>` : '';
    return `<section class="card bank-box wide"><h3>📜 Vay thế chấp cho gia tộc</h3>
      ${lenders.length && plots.length ? `<form class="money-form wrap" data-form="borrow">
        <select name="bank">${lenders.map((b) => `<option value="${b.clanId}">${esc(b.emblem)} ${esc(b.name)} · ${ratePct(b.loanRate)}</option>`).join('')}</select>
        <select name="plot">${plots.map((p) => `<option value="${p.id}">Lô ${esc(p.code)} · thế chấp ${fmt(p.value)} · vay tối đa ${fmt(p.maxLoan)}</option>`).join('')}</select>
        <input name="amount" type="number" min="${v.rules.loan.minAmount}" step="1000" required placeholder="Số xu vay" />
        <select name="term">${v.rules.loan.terms.map((t) => `<option value="${t}">${t} ngày</option>`).join('')}</select>
        <button class="btn primary">Vay</button>
      </form>` : `<p class="muted">${plots.length ? 'Chưa có ngân hàng nào cho gia tộc bạn vay lúc này.' : 'Gia tộc chưa có lô đất nào còn trống thế chấp.'}</p>`}
      ${loans}</section>`;
  }

  function auctions(v) {
    if (!v.auctions.length) return '';
    const c = v.clan;
    const canBid = c && ['leader', 'elder'].includes(c.role);
    return `<section class="card bank-box wide"><h3>🔨 Đấu giá lô siết nợ</h3><ul class="deposit-list">${v.auctions.map((a) => `<li>
      <div><b>Lô ${esc(a.plotCode)}</b> của ${esc(a.debtor)} · chủ nợ ${esc(a.bank)} · ${a.topBid ? `giá cao nhất ${fmt(a.topBid)} (${esc(a.topClan)})` : `khởi điểm ${fmt(a.startPrice)}`} · còn ${countdown(a.endsAt - Date.now())}</div>
      ${canBid && c.id !== a.debtorId && c.id !== a.bankId ? `<form class="money-form" data-bid="${a.id}"><input name="amount" type="number" min="${a.minBid}" value="${a.minBid}" step="1" /><button class="btn">Trả giá</button></form>` : ''}
      ${c?.leader && c.id === a.bankId && !a.topBid ? `<button class="btn small" data-keep="${a.id}">Giữ lô thay cho nợ</button>` : ''}
    </li>`).join('')}</ul></section>`;
  }

  function draw(v) {
    view.innerHTML = `
      ${v.frozen ? '<section class="card"><b class="down">⛔ Ngân hàng gia tộc đang bị phong tỏa khẩn cấp: tạm dừng gửi, rút và vay.</b></section>' : ''}
      <p class="muted">Lãi tiết kiệm NPC hiện tại ${ratePct(v.baseRate)}. Ngân hàng gia tộc được trả tối đa ${ratePct(v.maxDepositRate)}. Quỹ bảo hiểm tiền gửi đang có ${fmt(v.insurance)} xu. <a href="https://wiki.petfarm.online/ngan-hang-gia-toc" target="_blank" rel="noopener">Đọc luật trong wiki</a>.</p>
      <div class="bank-grid">
        ${v.banks.length ? v.banks.map((b) => bankCard(b, v)).join('') : '<section class="card bank-box"><p class="muted">Chưa có gia tộc nào mở ngân hàng.</p></section>'}
        <section class="card bank-box wide"><h3>📒 Khoản gửi của bạn</h3>${depositList(v)}</section>
        ${manage(v)}
        ${borrow(v)}
        ${auctions(v)}
      </div>`;
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.withdraw) {
      if (btn.dataset.early && !confirm('Rút trước hạn chỉ nhận lại gốc, mất toàn bộ tiền lãi. Vẫn rút?')) return;
      ctx.act(`/clan-bank/deposits/${btn.dataset.withdraw}/withdraw`);
    } else if (btn.dataset.repay) ctx.act(`/clan-bank/loans/${btn.dataset.repay}/repay`);
    else if (btn.dataset.keep && confirm('Giữ lô thay cho khoản nợ? Ngân hàng không thu thêm tiền từ phiên này.')) ctx.act(`/clan-bank/auctions/${btn.dataset.keep}/keep`);
  });

  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const num = (k) => Number(f.get(k));
    const form = e.target;
    if (form.dataset.deposit) ctx.act(`/clan-bank/${form.dataset.deposit}/deposit`, { amount: num('amount'), term: num('term') });
    else if (form.dataset.bid) ctx.act(`/clan-bank/auctions/${form.dataset.bid}/bid`, { amount: num('amount') });
    else if (form.dataset.form === 'open') ctx.act('/clan-bank/open', { capital: num('capital') });
    else if (form.dataset.form === 'capital') ctx.act('/clan-bank/capital', { action: e.submitter?.value ?? 'in', amount: num('amount') });
    else if (form.dataset.form === 'borrow') {
      if (!confirm('Vay thế chấp: quá hạn và hết ân hạn mà quỹ không đủ trả thì lô bị siết ra đấu giá. Vẫn vay?')) return;
      ctx.act(`/clan-bank/${num('bank')}/borrow`, { plotId: num('plot'), amount: num('amount'), term: num('term') });
    } else if (form.dataset.form === 'terms') {
      const rates = Object.fromEntries([...form.querySelectorAll('input[name^="r"]')].map((i) => [i.name.slice(1), Number(i.value) / 100]));
      ctx.act('/clan-bank/terms', { rates, loanRate: num('loan') / 100, lendingOpen: f.get('lending') === 'on' });
    }
  });

  api('/clan-bank').then((v) => view.isConnected && draw(v)).catch(ctx.fail);
}
