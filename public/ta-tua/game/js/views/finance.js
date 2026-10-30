// Vay ngang hàng (Ngân hàng Trân Châu làm trung gian, giữ 10–20% tiền lãi) và chơi hụi bỏ thăm (người chơi, gia tộc).
import { api } from '../api.js';
import { countdown, esc, fmt, pct, viewHead } from '../ui.js';

/** Bản nháp form và tab đang xem, giữ qua các lần vẽ lại. */
const ui = { tab: 'p2p', amount: '', term: 7, rate: '1', huiScope: 'player' };

const STATUS = {
  open: 'Đang chờ người cho vay', funded: 'Đang vay', late: '⚠️ Trễ hạn', defaulted: '⛔ Vỡ nợ', repaid: '✅ Đã trả xong',
  cancelled: 'Đã rút', expired: 'Hết hạn đăng',
};
const HUI_STATUS = { open: 'Đang gom người', running: 'Đang chạy', done: 'Đã mãn hụi', cancelled: 'Đã hủy' };

export function renderFinance(root, ctx) {
  root.innerHTML = `<div class="pb-page finance-page">
    ${viewHead('🤝 Vay ngang hàng & Hụi', 'Người chơi cho nhau vay qua ngân hàng trung gian, hoặc góp hụi cùng nhau. Tiền thật, rủi ro thật: hãy chọn người tin được.',
      `<div class="pb-links">
        <button class="btn small" data-go="bank">🏦 Ngân hàng</button>
        <button class="btn small" data-go="credit">💳 Tín dụng</button>
      </div>`)}
    <nav class="seg finance-tabs">
      <button data-tab="p2p">🤝 Vay ngang hàng</button>
      <button data-tab="hui">🔄 Hụi</button>
    </nav>
    <div class="finance-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.finance-page');
  const view = page.querySelector('.finance-view');
  let p2p = null;
  let hui = null;
  let alive = true;
  const until = (ts) => (ts ? countdown(ts - Date.now()) : '–');
  const money = (n) => `${fmt(n)} 🪙`;

  // ================================================================ vay ngang hàng

  function estimate() {
    const amount = Number(ui.amount) || 0;
    const rate = (Number(ui.rate) || 0) / 100;
    if (amount <= 0 || rate <= 0) return '';
    const interest = Math.round(amount * rate * ui.term);
    const cut = p2p.me.cut;
    return `Đáo hạn trả <b>${money(amount + interest)}</b> (lãi ${money(interest)}). Người cho vay nhận ${money(amount + Math.round(interest * (1 - cut)))},
      ngân hàng giữ ${money(Math.round(interest * cut))} (${Math.round(cut * 100)}% tiền lãi).`;
  }

  function loanRow(l, side) {
    const left = l.status === 'open' ? '' : `<small class="muted">Còn nợ ${money(l.left)}${l.dueAt ? ` · đáo hạn ${l.dueAt > Date.now() ? `sau ${until(l.dueAt)}` : 'đã qua'}` : ''}${l.lateDays ? ` · trễ ${l.lateDays} ngày` : ''}</small>`;
    const action = side === 'borrow'
      ? l.status === 'open' ? `<button class="btn small" data-p2p-cancel="${l.id}">Rút yêu cầu</button>`
        : ['funded', 'late', 'defaulted'].includes(l.status) ? `<button class="btn small mint" data-p2p-repay="${l.id}" data-left="${l.left}">Trả hết ${money(l.left)}</button>` : ''
      : '';
    return `<li class="p2p-loan ${l.status}">
      <div><b>${money(l.amount)}</b> · ${l.termDays} ngày · ${pct(l.rate, 2, false)}/ngày
        <br><small>${STATUS[l.status] ?? l.status}${side === 'borrow' && l.lender ? ` · vay của <b>${esc(l.lender)}</b>` : ''}${side === 'lend' ? ` · cho <b>${esc(l.borrower)}</b> vay` : ''}</small>
        ${side === 'lend' ? `<br><small class="muted">Đúng hạn nhận ${money(l.lenderGets)} (sau ${Math.round(l.cut * 100)}% phí ngân hàng trên tiền lãi)</small>` : ''}
        ${left ? `<br>${left}` : ''}</div>
      ${action}
    </li>`;
  }

  function drawP2P() {
    const d = p2p;
    const r = d.rules;
    const terms = r.terms.map((t) => `<option value="${t}" ${ui.term === t ? 'selected' : ''}>${t} ngày</option>`).join('');
    view.innerHTML = `<div class="finance-grid">
      <section class="card fin-box">
        <h3>📝 Đăng yêu cầu vay</h3>
        <p class="muted small">Điểm tín dụng <b>${d.me.credit}</b> (hạng ${esc(d.me.tier)}): vay tối đa <b>${money(d.me.limit)}</b>,
          ngân hàng giữ <b>${Math.round(d.me.cut * 100)}%</b> tiền lãi bạn trả làm phí trung gian. Điểm càng cao, phí càng thấp (tối thiểu ${Math.round(r.cut.diamond * 100)}%).</p>
        ${d.me.banned ? '<p class="warn">Bạn đang bị cấm vay vì từng vỡ nợ.</p>' : `
        <form class="fin-form" data-form="p2p">
          <label>Số tiền (xu)<input name="amount" type="number" min="${r.minAmount}" max="${d.me.limit}" step="10" value="${esc(ui.amount)}" required /></label>
          <label>Kỳ hạn<select name="term">${terms}</select></label>
          <label>Lãi mỗi ngày (%)<input name="rate" type="number" min="${r.rateRange[0] * 100}" max="${r.rateRange[1] * 100}" step="0.05" value="${esc(ui.rate)}" required /></label>
          <p class="estimate">${estimate()}</p>
          <button class="btn gold">Đăng yêu cầu</button>
        </form>`}
        <p class="muted small">Yêu cầu nằm trên chợ ${r.listDays} ngày. Đáo hạn hệ thống tự thu từ ví, thiếu thì lấy tiết kiệm. Không đủ thì trễ hạn: phí trễ ${pct(r.lateFee, 0, false)}/ngày và trừ điểm;
          trễ ${r.defaultAfter} ngày là vỡ nợ: bị cấm vay 14 ngày và mỗi đêm ngân hàng giữ ${pct(r.garnish, 0, false)} số dư ví để trả dần người cho vay.</p>
      </section>

      <section class="card fin-box wide">
        <h3>🏪 Chợ vay <small class="muted">${d.week.loans} khoản đã giải ngân tuần này · ${money(d.week.volume)}</small></h3>
        ${d.market.length ? `<div class="table-wrap"><table class="fin-table">
          <thead><tr><th>Người vay</th><th class="num">Số tiền</th><th class="num">Kỳ hạn</th><th class="num">Lãi/ngày</th><th class="num">Bạn nhận về</th><th></th></tr></thead>
          <tbody>${d.market.map((l) => `<tr>
            <td>${l.tierIcon} <b>${esc(l.borrower)}</b><br><small class="muted">điểm ${l.credit} · ngân hàng giữ ${Math.round(l.cut * 100)}% lãi</small></td>
            <td class="num">${money(l.amount)}</td>
            <td class="num">${l.termDays} ngày</td>
            <td class="num">${pct(l.rate, 2, false)}</td>
            <td class="num"><b>${money(l.lenderGets)}</b><br><small class="up">+${fmt(l.lenderGets - l.amount)}</small></td>
            <td>${l.mine ? '<small class="muted">Của bạn</small>' : `<button class="btn small mint" data-p2p-fund="${l.id}" data-amount="${l.amount}" data-who="${esc(l.borrower)}">Cho vay</button>`}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa có yêu cầu vay nào đang chờ.</p>'}
        <p class="muted small">Cho vay là chịu rủi ro: người vay vỡ nợ thì bạn chỉ nhận lại dần. Xem điểm tín dụng trước khi rót vốn.</p>
      </section>

      <section class="card fin-box">
        <h3>📥 Khoản bạn vay</h3>
        ${d.borrowing.length ? `<ul class="p2p-list">${d.borrowing.map((l) => loanRow(l, 'borrow')).join('')}</ul>` : '<p class="muted">Chưa có.</p>'}
      </section>
      <section class="card fin-box">
        <h3>📤 Khoản bạn cho vay</h3>
        ${d.lending.length ? `<ul class="p2p-list">${d.lending.map((l) => loanRow(l, 'lend')).join('')}</ul>` : '<p class="muted">Chưa có.</p>'}
      </section>
    </div>`;
  }

  // ================================================================ hụi

  function groupCard(g) {
    const r = hui.rules;
    const unit = g.scope === 'clan' ? 'gia tộc' : 'người';
    const canBid = g.status === 'running' && g.me?.status === 'active' && !g.me.received;
    return `<article class="card hui-card ${g.status}">
      <header><b>${g.scope === 'clan' ? '🏯' : '🔄'} ${esc(g.name)}</b> <span class="badge">${HUI_STATUS[g.status]}</span></header>
      <p class="small">Chủ hụi ${esc(g.owner)} · góp <b>${money(g.amount)}</b>/kỳ · ${g.members.filter((m) => m.status === 'active').length}/${g.size} ${unit}
        ${g.status === 'running' ? ` · kỳ ${g.round + 1} chốt sau ${until(g.nextRoundAt)} · quỹ kỳ ${money(g.pot)}` : ''}</p>
      ${g.me ? `<p class="small">Bạn đã góp ${money(g.me.paid)}, đã nhận ${money(g.me.got)}${g.me.received ? ` · đã hốt ở kỳ ${g.me.received}` : ''}${g.me.status === 'out' ? ' · <b class="down">bị loại vì bỏ kỳ góp</b>' : ''}</p>` : ''}
      <ul class="hui-members">${g.members.map((m) => `<li class="${m.status}">${m.me ? '⭐ ' : ''}${esc(m.name)}
        <small>${m.status === 'out' ? '❌ bị loại' : m.received ? `💰 hốt kỳ ${m.received}` : '⏳ chưa hốt'}</small></li>`).join('')}</ul>
      ${canBid ? `<form class="row" data-form="bid" data-group="${g.id}">
        <input name="bid" type="number" min="0" max="${g.maxBid}" step="10" value="${g.myBid || ''}" placeholder="Tiền thăm (tối đa ${fmt(g.maxBid)})" />
        <button class="btn small gold">${g.myBid ? 'Đổi thăm' : 'Bỏ thăm'}</button>
      </form><small class="muted">Thăm cao nhất hốt kỳ này: nhận quỹ trừ tiền thăm, tiền thăm chia cho người cùng góp.</small>` : ''}
      <div class="row">
        ${g.joinable ? `<button class="btn small mint" data-hui-join="${g.id}" data-amount="${g.amount}">Vào dây hụi</button>` : ''}
        ${g.status === 'open' && g.isOwner && g.members.length >= r[g.scope].minSize ? `<button class="btn small gold" data-hui-start="${g.id}">Cho chạy ngay</button>` : ''}
        ${g.status === 'open' && g.me ? `<button class="btn small" data-hui-leave="${g.id}">${g.isOwner ? 'Hủy dây' : 'Rời dây'}</button>` : ''}
      </div>
      ${g.rounds.length ? `<details><summary class="small">Lịch sử ${g.rounds.length} kỳ</summary><ul class="small">${g.rounds.map((x) => `<li>Kỳ ${x.round}: ${x.winner ? `<b>${esc(x.winner)}</b> hốt ${money(x.pot - x.bid)}${x.bid ? ` (thăm ${money(x.bid)})` : ''}` : 'không ai hốt'} · ${x.payers} góp${x.dropped ? ` · ${x.dropped} bị loại` : ''}</li>`).join('')}</ul></details>` : ''}
    </article>`;
  }

  function drawHui() {
    const d = hui;
    const r = d.rules;
    const scope = d.clan ? ui.huiScope : 'player';
    const lim = r[scope];
    view.innerHTML = `<div class="finance-grid">
      <section class="card fin-box">
        <h3>➕ Lập dây hụi</h3>
        ${d.bannedUntil ? `<p class="warn">Bạn từng bỏ hụi nên bị cấm chơi tới ${new Date(d.bannedUntil).toLocaleDateString('vi-VN')}.</p>` : ''}
        <form class="fin-form" data-form="hui">
          ${d.clan ? `<label>Loại hụi<select name="scope">
            <option value="player" ${scope === 'player' ? 'selected' : ''}>Hụi người chơi (góp bằng ví)</option>
            <option value="clan" ${scope === 'clan' ? 'selected' : ''}>Hụi lớn gia tộc (góp bằng quỹ ${esc(d.clan.name)})</option>
          </select></label>` : ''}
          <label>Tên dây hụi<input name="name" maxlength="30" required placeholder="Hụi xóm Trân Châu" /></label>
          <label>Góp mỗi kỳ (xu)<input name="amount" type="number" min="${lim.minAmount}" max="${lim.maxAmount}" step="10" required /></label>
          <label>Số ${scope === 'clan' ? 'gia tộc' : 'người'}<input name="size" type="number" min="${lim.minSize}" max="${lim.maxSize}" value="${lim.minSize}" required /></label>
          <button class="btn gold">Lập dây</button>
        </form>
        ${d.clan ? `<p class="muted small">Quỹ ${esc(d.clan.name)}: ${money(d.clan.fund)}. Quỹ không đủ tiền góp tới kỳ thì gia tộc bị loại khỏi dây.</p>` : ''}
        <details class="small"><summary>Luật chơi hụi</summary>
          <ul>
            <li>Mỗi đêm là một kỳ: mọi thành viên góp đúng số tiền đã định vào quỹ hụi.</li>
            <li>Người chưa hốt được <b>bỏ thăm</b> (tối đa ${pct(r.maxBidRatio, 0, false)} quỹ kỳ). Thăm cao nhất hốt quỹ trừ tiền thăm; tiền thăm chia đều cho những người cùng góp kỳ đó.</li>
            <li>Không ai bỏ thăm: kỳ đầu chủ hụi hốt, các kỳ sau theo thứ tự vào dây.</li>
            <li><b>Tới kỳ mà không đủ tiền góp là bị loại, không hoàn số đã góp</b>; người chơi bị trừ điểm tín dụng (nặng hơn nếu đã hốt) và cấm chơi hụi ${r.banDays} ngày.</li>
            <li>Dây gom người ${r.openDays} ngày: đủ tối thiểu thì tự chạy, không đủ thì hủy.</li>
          </ul></details>
      </section>

      <section class="fin-box wide">
        <h3>🔄 Dây hụi của bạn</h3>
        ${d.mine.length ? `<div class="hui-grid">${d.mine.map(groupCard).join('')}</div>` : '<p class="muted">Bạn chưa chơi dây hụi nào.</p>'}
        ${d.clan ? `<h3>🏯 Hụi lớn của ${esc(d.clan.name)}</h3>
          ${d.clanGroups.length ? `<div class="hui-grid">${d.clanGroups.map(groupCard).join('')}</div>` : '<p class="muted">Gia tộc chưa chơi hụi lớn.</p>'}` : ''}
        <h3>📣 Dây đang gom người</h3>
        ${d.open.filter((g) => g.joinable).length ? `<div class="hui-grid">${d.open.filter((g) => g.joinable).map(groupCard).join('')}</div>` : '<p class="muted">Chưa có dây nào đang gom người.</p>'}
      </section>
    </div>`;
  }

  // ================================================================ tải & vẽ

  function draw() {
    if (!alive) return;
    for (const b of page.querySelectorAll('.finance-tabs button')) b.classList.toggle('current', b.dataset.tab === ui.tab);
    if (ui.tab === 'p2p' && p2p) drawP2P();
    else if (ui.tab === 'hui' && hui) drawHui();
  }

  async function load() {
    [p2p, hui] = await Promise.all([api('/p2p'), api('/hui')]);
    draw();
  }

  page.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.tab) {
      ui.tab = d.tab;
      draw();
    } else if (d.p2pFund) {
      if (confirm(`Cho ${d.who} vay ${fmt(Number(d.amount))} xu? Người vay vỡ nợ thì bạn chỉ thu lại dần.`)) ctx.act(`/p2p/${d.p2pFund}/fund`);
    } else if (d.p2pCancel) ctx.act(`/p2p/${d.p2pCancel}/cancel`);
    else if (d.p2pRepay) {
      if (confirm(`Trả hết ${fmt(Number(d.left))} xu ngay bây giờ?`)) ctx.act(`/p2p/${d.p2pRepay}/repay`);
    } else if (d.huiJoin) {
      if (confirm(`Vào dây hụi, mỗi đêm góp ${fmt(Number(d.amount))} xu tới khi mãn hụi? Bỏ kỳ góp là bị loại và mất số đã góp.`)) ctx.act(`/hui/${d.huiJoin}/join`);
    } else if (d.huiStart) ctx.act(`/hui/${d.huiStart}/start`);
    else if (d.huiLeave) ctx.act(`/hui/${d.huiLeave}/leave`);
  });

  page.addEventListener('input', (e) => {
    const form = e.target.closest('form');
    if (form?.dataset.form === 'p2p') {
      ui[e.target.name] = e.target.name === 'term' ? Number(e.target.value) : e.target.value;
      const est = form.querySelector('.estimate');
      if (est) est.innerHTML = estimate();
    }
  });
  page.addEventListener('change', (e) => {
    if (e.target.name === 'scope') {
      ui.huiScope = e.target.value;
      draw();
    } else if (e.target.name === 'term') {
      ui.term = Number(e.target.value);
      const est = page.querySelector('.estimate');
      if (est) est.innerHTML = estimate();
    }
  });

  page.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = Object.fromEntries(new FormData(form));
    if (form.dataset.form === 'p2p') {
      ctx.act('/p2p/request', { amount: Number(fd.amount), term: Number(fd.term), rate: Number(fd.rate) / 100 });
    } else if (form.dataset.form === 'hui') {
      ctx.act('/hui/create', { scope: fd.scope ?? 'player', name: fd.name, amount: Number(fd.amount), size: Number(fd.size) });
    } else if (form.dataset.form === 'bid') {
      ctx.act(`/hui/${form.dataset.group}/bid`, { bid: Number(fd.bid) || 0 });
    }
  });

  load().catch(ctx.fail);
  return () => {
    alive = false;
  };
}
