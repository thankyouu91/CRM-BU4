// Ngân hàng: tiết kiệm không kỳ hạn, gửi kỳ hạn, thông báo của Ngân hàng Trung ương.
import { api } from '../api.js';
import { lineChart } from '../charts.js';
import { countdown, esc, fmt, pct, viewHead } from '../ui.js';

let term = 7;

export function renderBank(root, ctx) {
  root.innerHTML = `${viewHead('🏦 Ngân hàng Trân Châu', 'Để tiền sinh lời: tiết kiệm rút lúc nào cũng được, gửi kỳ hạn lãi cao hơn.')}
    <div class="bank-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.bank-view');
  const need = ctx.catalog.unlocks.bank;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Ngân hàng chưa mở</h2>
      <p class="muted">Có một bé đạt cấp ${need} là mở tài khoản được.</p></section>`;
    return;
  }

  function draw(b) {
    const latest = b.history.at(-1);
    const termInfo = b.terms.find((t) => t.days === term) ?? b.terms[0];
    view.innerHTML = `
      <div class="bank-grid">
        <section class="card bank-box">
          <h3>🐷 Tiết kiệm không kỳ hạn</h3>
          <div class="big-number">${fmt(b.savings)} <small>🪙</small></div>
          <p class="muted">Lãi đang chạy <b class="up">+${b.accrued.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</b> 🪙, cộng vào lúc nửa đêm.
            Lãi suất <b>${pct(b.baseRate, 2, false)}/ngày</b> trên tối đa ${fmt(b.cap)} 🪙.</p>
          <form class="money-form" data-form="savings">
            <input name="amount" type="number" min="1" step="1" inputmode="numeric" placeholder="Số xu" required />
            <button class="btn primary" value="deposit">Gửi vào</button>
            <button class="btn" value="withdraw">Rút ra</button>
          </form>
          <div class="quick">
            <button class="chip" data-fill="savings:${Math.max(0, ctx.me.user.coins - 200)}">Gửi tất cả trừ 200</button>
            <button class="chip" data-fill="savings:${b.savings}">Rút hết</button>
          </div>
        </section>

        <section class="card bank-box">
          <h3>📜 Gửi kỳ hạn</h3>
          <div class="term-options">
            ${b.terms.map((t) => `
              <button class="term ${t.days === term ? 'current' : ''}" data-term="${t.days}">
                <b>${t.days} ngày</b><span>${pct(t.rate, 2, false)}<wbr>/ngày</span><small>cả kỳ ${pct(t.rate * t.days, 1, false)}</small>
              </button>`).join('')}
          </div>
          <form class="money-form" data-form="deposit">
            <input name="amount" type="number" min="${b.minDeposit}" step="1" inputmode="numeric" placeholder="Tối thiểu ${b.minDeposit} xu" required />
            <button class="btn primary">Gửi ${term} ngày</button>
          </form>
          <p class="muted small">Lãi chốt lúc gửi (${pct(termInfo.rate, 2, false)}/ngày). Rút trước hạn chỉ nhận lại gốc.</p>
          ${b.deposits.length ? `<ul class="deposit-list">${b.deposits.map((d) => {
            const done = Math.min(1, (Date.now() - d.openedAt) / (d.maturesAt - d.openedAt));
            const matured = Date.now() >= d.maturesAt;
            return `<li>
              <div><b>${fmt(d.amount)} 🪙</b> · ${d.termDays} ngày · lãi <b class="up">+${fmt(d.interest)}</b></div>
              <div class="bar xp"><i style="width:${Math.round(done * 100)}%"></i></div>
              <div class="row-between"><small class="muted">${matured ? 'Đã đáo hạn' : `Đáo hạn sau ${countdown(d.maturesAt - Date.now())}`}</small>
                <button class="btn small ${matured ? 'gold' : ''}" data-close-deposit="${d.id}" data-early="${matured ? '' : '1'}">${matured ? 'Nhận tiền' : 'Rút sớm'}</button></div>
            </li>`;
          }).join('')}</ul>` : ''}
        </section>

        <section class="card bank-box wide">
          <h3>🏛️ Ngân hàng Trung ương</h3>
          ${latest ? `
            <p>Phiên họp ${esc(latest.week)}: lượng xu bình quân mỗi người chơi <b>${fmt(latest.moneyPerPlayer)}</b>,
              tăng <b>${pct(latest.growth)}</b>/tuần (mục tiêu +10%).</p>
            <div class="cb-stats">
              <div><span class="muted">Chỉ số giá</span><b>${latest.priceIndex.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</b></div>
              <div><span class="muted">Lãi suất cơ bản</span><b>${pct(latest.baseRate, 2, false)}/ngày</b></div>
              <div><span class="muted">Người chơi hoạt động</span><b>${latest.players}</b></div>
            </div>
            ${b.history.length > 1 ? '<div class="chart-pair"><div><small class="muted">Chỉ số giá</small><div id="cb-index"></div></div><div><small class="muted">Lãi suất cơ bản</small><div id="cb-rate"></div></div></div>' : ''}`
          : '<p class="muted">Ngân hàng Trung ương họp lần đầu vào nửa đêm Chủ nhật này.</p>'}
          <p class="muted small">Xu in ra quá nhanh thì giá siêu thị tăng và lãi tiết kiệm giảm để hạ nhiệt; xu co lại thì ngược lại.</p>
        </section>

        <section class="card bank-box wide row-between">
          <div>
            <h3>💳 Tín dụng & vay trả góp</h3>
            <p class="muted">Điểm tín dụng lên khi bạn giữ lời hứa: giao đủ hàng hợp đồng, trả góp đúng hạn.
              ${ctx.me.user.advanced ? 'Bạn đang bật Tài chính nâng cao: vay được theo hạn mức.' : `Vay trả góp mở ở chế độ Tài chính nâng cao (bé cấp ${ctx.catalog.unlocks.advanced}).`}</p>
          </div>
          <button class="btn gold" data-go="credit">Xem điểm tín dụng</button>
        </section>

        <section class="card bank-box wide row-between">
          <div>
            <h3>🏯 Ngân hàng gia tộc</h3>
            <p class="muted">Gửi kỳ hạn ở ngân hàng do gia tộc nắm Ngân hàng nhà nước điều hành: lãi có thể cao hơn ở đây (tối đa 3 lần), đổi lại rủi ro ngân hàng thiếu tiền mặt hay đổ vỡ.</p>
          </div>
          <button class="btn gold" data-go="clanbank">Xem</button>
        </section>

        <section class="card bank-box wide row-between">
          <div>
            <h3>📈 Sàn cổ phiếu gia tộc</h3>
            <p class="muted">Mua cổ phần các gia tộc đã lên sàn, nhận cổ tức khi gia tộc có lãi. Giá chạy theo cung cầu, mỗi ngày tối đa ±15%.</p>
          </div>
          <button class="btn gold" data-go="shares">Xem</button>
        </section>

        <section class="card bank-box wide row-between">
          <div>
            <h3>🤝 Vay ngang hàng & 🔄 Hụi</h3>
            <p class="muted">Cho người chơi khác vay qua ngân hàng trung gian (ngân hàng giữ 10–20% tiền lãi), hoặc góp hụi bỏ thăm với bạn bè và các gia tộc.</p>
          </div>
          <button class="btn gold" data-go="finance">Mở</button>
        </section>
      </div>`;
    if (b.history.length > 1) {
      lineChart(view.querySelector('#cb-index'), b.history.map((h) => h.priceIndex), { height: 110, format: (v) => v.toFixed(3) });
      lineChart(view.querySelector('#cb-rate'), b.history.map((h) => h.baseRate * 100), { height: 110, format: (v) => `${v.toFixed(2)}%`, color: '#58b9d6' });
    }
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.term) {
      term = Number(btn.dataset.term);
      ctx.refresh();
    } else if (btn.dataset.fill) {
      const [form, amount] = btn.dataset.fill.split(':');
      view.querySelector(`[data-form="${form}"] input`).value = amount;
    } else if (btn.dataset.closeDeposit) {
      if (btn.dataset.early && !confirm('Rút trước hạn sẽ mất toàn bộ tiền lãi. Vẫn rút?')) return;
      ctx.act(`/bank/deposits/${btn.dataset.closeDeposit}/close`);
    }
  });

  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = Number(new FormData(e.target).get('amount'));
    if (e.target.dataset.form === 'savings') ctx.act('/bank/savings', { action: e.submitter?.value ?? 'deposit', amount });
    else ctx.act('/bank/deposits', { amount, term });
  });

  api('/bank').then((b) => view.isConnected && draw(b)).catch(ctx.fail);
}
