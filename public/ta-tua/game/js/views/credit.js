// Tín dụng: điểm tín dụng của mọi người chơi, và vay trả góp theo ngày ở chế độ Tài chính nâng cao.
import { api } from '../api.js';
import { ago, countdown, esc, fmt, pct, viewHead } from '../ui.js';

/** Bản nháp form vay và trạng thái giao diện, giữ nguyên qua các lần vẽ lại. */
const ui = { term: 7, amount: '', help: false };
const repayDrafts = {};

const TIER_COLORS = { bronze: '#e0a77f', silver: '#c3c8d4', gold: '#f4c24f', diamond: '#8fd0e6' };

/** Lịch trả góp ước tính nếu trả đúng hạn: lãi trên dư nợ + gốc chia đều mỗi tối. */
function plan(amount, term, rate, fee) {
  let remaining = amount;
  let interest = 0;
  let first = 0;
  const per = Math.ceil(amount / term);
  for (let k = 1; k <= term && remaining > 0; k++) {
    const i = Math.ceil(remaining * rate);
    const p = k === term ? remaining : Math.min(remaining, per);
    if (k === 1) first = i + p;
    interest += i;
    remaining -= p;
  }
  return { fee: Math.ceil(amount * fee), first, interest };
}

export function renderCredit(root, ctx) {
  const { unlocks } = ctx.catalog;
  const rules = ctx.catalog.credit;
  const loans = rules.loans;
  root.innerHTML = `<div class="pb-page credit-page">
    ${viewHead('💳 Tín dụng', 'Điểm tín dụng cho thấy bạn giữ lời hứa tới đâu. Điểm cao thì vay được nhiều hơn, lãi thấp hơn.',
      `<div class="pb-links">
        <button class="btn small" data-go="bank">🏦 Ngân hàng</button>
        <button class="btn small" data-go="contracts">📜 Hợp đồng</button>
      </div>`)}
    <div class="credit-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.credit-page');
  const view = page.querySelector('.credit-view');
  let data = null;
  let timer = 0;
  let stopped = false;

  const until = (ts) => `<span data-until="${ts}">${countdown(ts - Date.now())}</span>`;
  const ratePct = (r) => pct(r, 2, false);
  const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

  function gaugeHtml(c) {
    const lo = rules.min;
    const span = rules.max - rules.min;
    const at = (v) => ((Math.min(rules.max, Math.max(lo, v)) - lo) / span) * 100;
    const bands = c.tiers.map((t, i) => {
      const start = at(t.min);
      const end = i + 1 < c.tiers.length ? at(c.tiers[i + 1].min) : 100;
      return `<i style="left:${start}%;width:${end - start}%;background:${TIER_COLORS[t.key] ?? '#ddd'}" title="${esc(t.name)}"></i>`;
    }).join('');
    return `<div class="credit-gauge" role="img" aria-label="Điểm ${c.score} trên thang ${rules.min}–${rules.max}">
        <div class="credit-track">${bands}</div>
        <span class="credit-needle" style="left:${at(c.score)}%"></span>
      </div>
      <div class="credit-scale"><span>${rules.min}</span><span>${rules.max}</span></div>`;
  }

  function scoreHtml(c) {
    const next = c.nextTier;
    let progress = '<p class="muted small">🏆 Bạn đang ở hạng cao nhất. Giữ vững phong độ nhé!</p>';
    if (next) {
      const from = Math.max(rules.min, c.tier.min);
      const frac = Math.max(0, Math.min(1, (c.score - from) / Math.max(1, next.min - from)));
      progress = `<div class="credit-next">
        <div class="row-between"><small>Còn <b>${next.min - c.score} điểm</b> nữa lên hạng ${next.icon} ${esc(next.name)}</small>
          <small class="muted">${c.score}/${next.min}</small></div>
        <div class="bar xp"><i style="width:${Math.round(frac * 100)}%"></i></div>
      </div>`;
    }
    return `<section class="card credit-box credit-score">
      <h3>📊 Điểm tín dụng</h3>
      <div class="credit-score-row">
        <div class="big-number">${c.score}</div>
        <span class="badge credit-tier" style="background:${TIER_COLORS[c.tier.key] ?? ''}">${c.tier.icon} Hạng ${esc(c.tier.name)}</span>
      </div>
      ${gaugeHtml(c)}
      ${progress}
      <div class="cb-stats">
        <div><span class="muted">Hạn mức hạng</span><b>${fmt(c.tier.limit)} 🪙</b></div>
        <div><span class="muted">Phụ phí lãi</span><b>+${ratePct(c.tier.premium)}</b><small class="muted">/ngày</small></div>
        <div><span class="muted">Còn vay được</span><b>${fmt(c.limit)} 🪙</b></div>
        <div><span class="muted">Lãi nếu vay hôm nay</span><b>${ratePct(c.rate)}</b><small class="muted">/ngày</small></div>
      </div>
    </section>`;
  }

  function tiersHtml(c) {
    return `<section class="card credit-box">
      <h3>🪜 Các hạng</h3>
      <ul class="credit-tiers">${c.tiers.map((t) => `
        <li class="${t.key === c.tier.key ? 'current' : ''}">
          <span class="credit-tier-icon" style="background:${TIER_COLORS[t.key] ?? ''}">${t.icon}</span>
          <div><b>${esc(t.name)}</b><br><small class="muted">từ ${Math.max(rules.min, t.min)} điểm</small></div>
          <div class="num"><b>${fmt(t.limit)} 🪙</b><br><small class="muted">lãi +${ratePct(t.premium)}/ngày</small></div>
        </li>`).join('')}</ul>
      <p class="muted small">Hạn mức thực tế = min(hạn mức hạng, 3 × thu nhập bình quân 7 ngày + 50% tiền tiết kiệm) − dư nợ đang có.</p>
    </section>`;
  }

  function rulesHtml() {
    const row = (v, text) => `<li><b class="${v >= 0 ? 'up' : 'down'}">${signed(v)}</b><span>${text}</span></li>`;
    return `<section class="card credit-box">
      <h3>⚖️ Điểm lên xuống vì đâu?</h3>
      <ul class="credit-rules">
        ${row(rules.contractDay, 'Mỗi đêm hợp đồng cung ứng giao và trả đủ (cả hai bên)')}
        ${row(rules.onTime, 'Trả một kỳ góp đúng hạn')}
        ${row(rules.repaid, 'Tất toán một khoản vay')}
        ${row(rules.late, 'Trễ một kỳ trả góp')}
        ${row(rules.contractBroken, 'Phá hợp đồng cung ứng (kể cả khi không đủ tiền nhận hàng hay bồi thường)')}
        ${row(rules.evicted, 'Xưởng hoặc quầy bị đóng vì nợ tiền thuê')}
        ${row(rules.defaulted, `Vỡ nợ (trễ ${loans.defaultAfter} kỳ liền)`)}
      </ul>
      <p class="muted small">Ai cũng bắt đầu từ ${rules.start} điểm, thang điểm ${rules.min}–${rules.max}. Chưa vay được thì cứ giữ chữ tín với hợp đồng cung ứng để điểm tăng dần.</p>
      <button class="btn small" data-go="contracts">📜 Xem hợp đồng của bạn</button>
    </section>`;
  }

  function eventsHtml(c) {
    return `<section class="card credit-box">
      <h3>🕑 Thay đổi gần đây</h3>
      ${c.events.length ? `<ul class="pb-list credit-events">${c.events.map((ev) => `
        <li><b class="${ev.delta >= 0 ? 'up' : 'down'}">${signed(ev.delta)}</b><span>${esc(ev.reason)}</span><small class="muted">${ago(ev.at)}</small></li>`).join('')}</ul>`
        : '<p class="muted">Chưa có thay đổi nào. Điểm sẽ lên xuống theo cách bạn trả nợ và giữ hợp đồng.</p>'}
    </section>`;
  }

  function advancedHtml() {
    if (ctx.me.user.advanced) return '';
    if (ctx.catalog.advancedFinance === false) return '<p class="muted small">Máy chủ này đã tắt chế độ Tài chính nâng cao.</p>';
    if (ctx.bestLevel() < unlocks.advanced) return `<p class="muted small">Cần một bé đạt cấp ${unlocks.advanced} để bật Tài chính nâng cao.</p>`;
    return `<div class="credit-advanced">
      <p class="small">Tài chính nâng cao mở khóa vay trả góp ở ngân hàng. Vay khéo thì xoay vốn nhanh, vay quá sức thì mất điểm và bị giữ thu nhập.</p>
      <button class="btn gold" data-cr-advanced>🎓 Bật Tài chính nâng cao</button>
    </div>`;
  }

  function previewHtml(c) {
    const amount = Math.floor(Number(ui.amount)) || 0;
    if (amount < c.minLoan || amount > c.limit) {
      return `<p class="down small">Số tiền vay từ ${fmt(c.minLoan)} đến ${fmt(c.limit)} xu.</p>`;
    }
    const p = plan(amount, ui.term, c.rate, c.originationFee);
    return `<ul class="pb-list">
      <li><span>Phí giải ngân (${pct(c.originationFee, 0, false)})</span><b>${fmt(p.fee)} 🪙</b></li>
      <li><span>Nhận vào ví</span><b>${fmt(amount - p.fee)} 🪙</b></li>
      <li><span>Lãi</span><b>${ratePct(c.rate)}/ngày trên dư nợ</b></li>
      <li><span>Kỳ đầu (nửa đêm nay)</span><b>≈ ${fmt(p.first)} 🪙</b></li>
      <li><span>Tổng lãi nếu trả đúng hạn</span><b>≈ ${fmt(p.interest)} 🪙</b></li>
      <li><span>Tổng phải trả</span><b>≈ ${fmt(amount + p.interest)} 🪙</b></li>
    </ul>`;
  }

  function borrowHtml(c) {
    let body;
    if (c.blocked) {
      body = `<p class="blocked">${esc(c.blocked)}</p>
        ${c.banUntil ? `<p class="pb-warn">⛔ Bị cấm vay thêm ${until(c.banUntil)} nữa.</p>` : ''}
        ${advancedHtml()}`;
    } else if (c.limit < c.minLoan) {
      body = `<p class="pb-note">Hạn mức hiện tại (${fmt(c.limit)} 🪙) chưa đủ khoản vay tối thiểu ${fmt(c.minLoan)} 🪙.
        Tăng thu nhập 7 ngày, gửi thêm tiết kiệm hoặc nâng hạng tín dụng để được vay nhiều hơn.</p>`;
    } else {
      const quick = [[0.25, '25%'], [0.5, '50%']]
        .map(([k, label]) => [Math.floor(c.limit * k), label])
        .filter(([v], i, all) => v >= c.minLoan && v < c.limit && all.findIndex(([x]) => x === v) === i);
      body = `<form class="credit-borrow" data-cr-borrow>
        <label>Số tiền vay (xu)
          <input name="amount" type="number" min="${c.minLoan}" max="${c.limit}" step="1" inputmode="numeric" value="${esc(ui.amount)}" placeholder="${fmt(c.minLoan)}–${fmt(c.limit)}" required />
        </label>
        <div class="quick">
          ${quick.map(([v, label]) => `<button type="button" class="chip" data-cr-amount="${v}">${label} · ${fmt(v)}</button>`).join('')}
          <button type="button" class="chip" data-cr-amount="${c.limit}">Tối đa · ${fmt(c.limit)}</button>
        </div>
        <div class="term-options credit-terms">${c.terms.map((t) => `
          <button type="button" class="term ${t === ui.term ? 'current' : ''}" data-cr-term="${t}">
            <b>${t} ngày</b><small>${t} kỳ góp</small></button>`).join('')}</div>
        <div class="credit-preview">${previewHtml(c)}</div>
        <button class="btn primary">💳 Vay ngay</button>
      </form>`;
    }
    return `<section class="card credit-box credit-borrow-box">
      <h3>🏦 Vay trả góp</h3>
      ${body}
    </section>`;
  }

  function loanCard(l) {
    const labels = { active: ['Đang trả', 'star'], late: [`Trễ ${l.lateDays} kỳ`, 'pb-warn-badge'], defaulted: ['Vỡ nợ', 'pb-bad'] };
    const [label, cls] = labels[l.status] ?? [l.status, ''];
    const paid = l.principal - l.remaining;
    const due = l.dueAt - Date.now();
    const draft = repayDrafts[l.id] ?? '';
    return `<article class="credit-loan ${esc(l.status)}">
      <header class="row-between">
        <div><b>Khoản #${l.id} · ${fmt(l.principal)} 🪙</b><br><small class="muted">${l.termDays} ngày · vay ${ago(l.openedAt)} · lãi ${ratePct(l.rate)}/ngày</small></div>
        <span class="badge ${cls}">${label}</span>
      </header>
      <div class="bar xp"><i style="width:${Math.round((paid / Math.max(1, l.principal)) * 100)}%"></i></div>
      <small class="muted">Đã trả gốc ${fmt(paid)}/${fmt(l.principal)} 🪙 · ${due > 0 ? `đáo hạn sau ${until(l.dueAt)}` : 'đã tới hạn, phải trả hết gốc'}</small>
      <div class="cb-stats">
        <div><span class="muted">Dư nợ gốc</span><b>${fmt(l.remaining)} 🪙</b></div>
        <div><span class="muted">Lãi & phí còn nợ</span><b class="${l.fees ? 'down' : ''}">${fmt(l.fees)} 🪙</b></div>
        <div><span class="muted">Trả hết ngay</span><b>${fmt(l.payoff)} 🪙</b></div>
      </div>
      ${l.today ? `<p class="${ctx.me.user.coins >= l.today.total ? 'pb-note' : 'pb-warn'}">🌙 Kỳ tối nay: <b>${fmt(l.today.total)} 🪙</b>
        <small>(${l.today.arrears ? `nợ cũ ${fmt(l.today.arrears)} + ` : ''}lãi ${fmt(l.today.interest)} + gốc ${fmt(l.today.principal)})</small>
        ${ctx.me.user.coins >= l.today.total ? '' : `<br><small>Ví đang có ${fmt(ctx.me.user.coins)} 🪙 — thiếu thì ngân hàng lấy sang tiết kiệm, vẫn thiếu là trễ kỳ.</small>`}</p>` : ''}
      ${l.status === 'late' ? `<p class="pb-warn">⚠️ Đã trễ ${l.lateDays} kỳ: mỗi kỳ trễ cộng ${pct(loans.lateFee, 0, false)} phí và ${rules.late} điểm. Trễ ${loans.defaultAfter} kỳ là vỡ nợ.</p>` : ''}
      ${l.status === 'defaulted' ? `<p class="pb-warn">⛔ Vỡ nợ: mỗi tối ngân hàng giữ ${pct(loans.garnish, 0, false)} thu nhập trong ngày để thu nợ. Trả hết sớm để thoát.</p>` : ''}
      <form class="credit-repay" data-cr-repay="${l.id}">
        <input name="amount" type="number" min="1" max="${l.payoff}" step="1" inputmode="numeric" value="${esc(draft)}" placeholder="Số xu muốn trả" aria-label="Số xu trả" required />
        <button type="button" class="chip" data-cr-payoff="${l.id}">Trả hết · ${fmt(l.payoff)}</button>
        <button class="btn small mint">Trả nợ</button>
      </form>
    </article>`;
  }

  function loansHtml(c) {
    const history = c.history.length ? `<h4>Đã tất toán</h4><ul class="pb-list">${c.history.map((h) => `
      <li><span>Khoản #${h.id} · ${fmt(h.principal)} 🪙 · ${h.termDays} ngày</span><small class="muted">vay ${ago(h.openedAt)} · ✅ xong</small></li>`).join('')}</ul>` : '';
    if (!c.loans.length && !history) return '';
    return `<section class="card credit-box credit-loans">
      <h3>📒 Khoản vay của bạn</h3>
      ${c.loans.length ? c.loans.map(loanCard).join('') : '<p class="muted">Không có khoản vay nào đang mở.</p>'}
      ${history}
    </section>`;
  }

  function helpHtml() {
    return `<details class="card pb-help" data-help ${ui.help ? 'open' : ''}>
      <summary>❓ Vay và trả thế nào?</summary>
      <ul>
        <li>Kỳ hạn ${loans.terms.join(', ')} ngày, phí giải ngân ${pct(loans.originationFee, 0, false)}. Tài khoản cần đủ ${loans.minAccountDays} ngày tuổi.</li>
        <li><b>Mỗi tối</b> ngân hàng tự trừ một kỳ góp: lãi trên dư nợ + phần gốc chia đều (tới hạn thì trả hết gốc). Trừ từ ví trước, thiếu thì lấy sang tiết kiệm.</li>
        <li>Trả đủ kỳ <b class="up">+${rules.onTime}</b> điểm, tất toán <b class="up">+${rules.repaid}</b> điểm.</li>
        <li>Thiếu tiền: phần thiếu cộng ${pct(loans.lateFee, 0, false)} phí trễ và <b class="down">${rules.late}</b> điểm mỗi kỳ.</li>
        <li>Trễ ${loans.defaultAfter} kỳ là <b>vỡ nợ</b>: <b class="down">${rules.defaulted}</b> điểm, cấm vay ${loans.banDays} ngày, từ đó mỗi tối ngân hàng giữ ${pct(loans.garnish, 0, false)} thu nhập trong ngày để thu nợ.</li>
        <li>Trả trước lúc nào cũng được, không mất lãi ngày hôm đó: tiền trả vào lãi và phí còn nợ trước, rồi tới gốc.</li>
      </ul>
    </details>`;
  }

  function draw() {
    const c = data;
    view.innerHTML = `<div class="credit-grid">
      ${scoreHtml(c)}
      ${borrowHtml(c)}
      ${loansHtml(c)}
      ${eventsHtml(c)}
      ${rulesHtml()}
      ${tiersHtml(c)}
      ${helpHtml()}
    </div>`;
  }

  async function load() {
    const d = await api('/credit');
    if (!view.isConnected) return;
    data = d;
    if (!d.terms.includes(ui.term)) ui.term = d.terms[Math.min(1, d.terms.length - 1)];
    draw();
  }

  function updatePreview() {
    const el = view.querySelector('.credit-preview');
    if (el) el.innerHTML = previewHtml(data);
  }

  page.addEventListener('toggle', (e) => {
    if (e.target.matches?.('[data-help]')) ui.help = e.target.open;
  }, true);

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !data) return;
    const d = btn.dataset;
    if (d.crTerm) {
      ui.term = Number(d.crTerm);
      for (const b of view.querySelectorAll('[data-cr-term]')) b.classList.toggle('current', b === btn);
      updatePreview();
    } else if (d.crAmount) {
      ui.amount = d.crAmount;
      const input = view.querySelector('[data-cr-borrow] input[name="amount"]');
      if (input) input.value = ui.amount;
      updatePreview();
    } else if (d.crPayoff) {
      const loan = data.loans.find((l) => l.id === Number(d.crPayoff));
      repayDrafts[d.crPayoff] = String(loan?.payoff ?? '');
      btn.closest('form').querySelector('input[name="amount"]').value = repayDrafts[d.crPayoff];
    } else if (d.crAdvanced !== undefined) {
      if (confirm('Bật Tài chính nâng cao?\nBạn sẽ vay được ở ngân hàng. Vay quá sức có thể bị phạt phí, mất điểm tín dụng và bị giữ thu nhập khi vỡ nợ.')) {
        ctx.act('/settings', { advancedFinance: true });
      }
    }
  });

  page.addEventListener('input', (e) => {
    if (e.target.closest('[data-cr-borrow]') && e.target.name === 'amount') {
      ui.amount = e.target.value;
      updatePreview();
    } else if (e.target.closest('[data-cr-repay]') && e.target.name === 'amount') {
      repayDrafts[e.target.closest('[data-cr-repay]').dataset.crRepay] = e.target.value;
    }
  });

  page.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = e.target;
    const amount = Math.floor(Number(new FormData(t).get('amount')));
    if (t.matches('[data-cr-borrow]')) {
      const p = plan(amount, ui.term, data.rate, data.originationFee);
      const ok = confirm(`Vay ${fmt(amount)} 🪙 trong ${ui.term} ngày?
• Phí giải ngân ${fmt(p.fee)} 🪙, nhận vào ví ${fmt(amount - p.fee)} 🪙
• Mỗi tối tự trừ một kỳ góp, kỳ đầu ≈ ${fmt(p.first)} 🪙 ngay nửa đêm nay
• Tổng lãi ước tính ≈ ${fmt(p.interest)} 🪙 nếu trả đúng hạn
• Trễ kỳ: phạt ${pct(loans.lateFee, 0, false)} và ${rules.late} điểm; trễ ${loans.defaultAfter} kỳ là vỡ nợ`);
      if (ok) ctx.act('/credit/borrow', { amount, term: ui.term }, { onResult: () => { ui.amount = ''; } });
    } else if (t.matches('[data-cr-repay]')) {
      const id = t.dataset.crRepay;
      ctx.act(`/credit/loans/${id}/repay`, { amount }, { onResult: () => { delete repayDrafts[id]; } });
    }
  });

  load().then(() => {
    if (stopped || !view.isConnected) return;
    timer = setInterval(() => {
      for (const el of view.querySelectorAll('[data-until]')) el.textContent = countdown(Number(el.dataset.until) - Date.now());
    }, 1000);
  }).catch(ctx.fail);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
