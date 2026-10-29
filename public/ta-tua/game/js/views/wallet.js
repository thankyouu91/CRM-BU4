// Ví: tài sản ròng, báo cáo thu chi, sao kê sổ cái, công tắc Tài chính nâng cao.
import { api } from '../api.js';
import { COLORS, barChart, lineChart } from '../charts.js';
import { esc, fmt, viewHead } from '../ui.js';

let days = 7;
let kindFilter = '';

const PARTS = [
  ['wallet', 'Ví', '#c8915f'],
  ['savings', 'Tiết kiệm', '#58b98d'],
  ['deposits', 'Kỳ hạn', '#3f8f6f'],
  ['locked', 'Ký quỹ lệnh', '#9aa6c9'],
  ['goods', 'Hàng trong kho', '#f2a65a'],
  ['items', 'Đồ đạc', '#ef8fa8'],
];

export function renderWallet(root, ctx) {
  root.innerHTML = `${viewHead('👛 Ví của bạn', 'Mọi đồng xu ra vào đều được ghi sổ.')}
    <div class="wallet-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.wallet-view');
  const kinds = ctx.catalog.kinds;
  let rows = [];

  const ledgerRow = (r) => `
    <tr>
      <td class="muted">${new Date(r.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
      <td><b>${kinds[r.kind]?.label ?? r.kind}</b>${r.account === 'savings' ? ' <span class="badge">tiết kiệm</span>' : ''}
        ${r.memo ? `<br><small class="muted">${esc(r.memo)}</small>` : ''}</td>
      <td class="num ${r.delta > 0 ? 'up' : 'down'}">${r.delta > 0 ? '+' : ''}${fmt(r.delta)}</td>
      <td class="num muted">${fmt(r.balance)}</td>
    </tr>`;

  const list = (items, sign) => items.length
    ? items.map((i) => `<li><span>${kinds[i.kind]?.label ?? i.kind}</span><b class="${sign > 0 ? 'up' : 'down'}">${sign > 0 ? '+' : '−'}${fmt(i.total)}</b></li>`).join('')
    : '<li class="muted">Chưa có</li>';

  function draw(w) {
    rows = w.ledger;
    const { total, parts } = w.netWorth;
    const income = w.report.income.reduce((s, i) => s + i.total, 0);
    const expense = w.report.expense.reduce((s, i) => s + i.total, 0);
    const advancedLocked = ctx.bestLevel() < ctx.catalog.unlocks.advanced;
    view.innerHTML = `
      <div class="wallet-grid">
        <section class="card wallet-box">
          <h3>💎 Tài sản ròng</h3>
          <div class="big-number">${fmt(total)} <small>🪙</small></div>
          <div class="stack-bar">${PARTS.map(([k, , color]) => parts[k] > 0 ? `<i style="flex:${parts[k]};background:${color}" title="${k}"></i>` : '').join('')}</div>
          <ul class="legend">${PARTS.map(([k, name, color]) => `<li><i style="background:${color}"></i>${name}<b>${fmt(parts[k])}</b></li>`).join('')}</ul>
          ${w.history.length > 1 ? '<div id="nw-chart"></div>' : '<p class="muted small">Biểu đồ tài sản có từ ngày mai (chụp lại mỗi nửa đêm).</p>'}
        </section>

        <section class="card wallet-box">
          <header class="row-between"><h3>📊 Thu chi</h3>
            <div class="seg">
              <button class="${days === 7 ? 'current' : ''}" data-days="7">7 ngày</button>
              <button class="${days === 30 ? 'current' : ''}" data-days="30">30 ngày</button>
            </div></header>
          <div class="cb-stats">
            <div><span class="muted">Thu</span><b class="up">+${fmt(income)}</b></div>
            <div><span class="muted">Chi</span><b class="down">−${fmt(expense)}</b></div>
            <div><span class="muted">Dư</span><b class="${income - expense >= 0 ? 'up' : 'down'}">${fmt(income - expense)}</b></div>
          </div>
          <div id="flow-chart"></div>
          <p class="legend-inline"><i style="background:${COLORS.income}"></i> Thu <i style="background:${COLORS.expense}"></i> Chi</p>
          <div class="flow-lists"><ul>${list(w.report.income, 1)}</ul><ul>${list(w.report.expense, -1)}</ul></div>
        </section>

        <section class="card wallet-box wide">
          <header class="row-between"><h3>🧾 Sao kê</h3>
            <select data-kind>
              <option value="">Tất cả giao dịch</option>
              ${Object.entries(kinds).map(([k, v]) => `<option value="${k}" ${k === kindFilter ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select></header>
          <div class="table-wrap"><table class="ledger">
            <thead><tr><th>Lúc</th><th>Nội dung</th><th class="num">Số xu</th><th class="num">Số dư</th></tr></thead>
            <tbody>${rows.map(ledgerRow).join('') || '<tr><td colspan="4" class="muted">Chưa có giao dịch.</td></tr>'}</tbody>
          </table></div>
          ${rows.length >= 40 ? '<button class="btn small" data-more>Xem thêm</button>' : ''}
        </section>

        <section class="card wallet-box wide advanced-box">
          <div>
            <h3>🎓 Tài chính nâng cao</h3>
            <p class="muted">Vay nợ, hợp đồng tương lai, hội thi có lệ phí và cổ phiếu sẽ mở dần trong các bản sau.
              Lợi nhuận cao hơn nhưng cũng có thể mất tiền. ${advancedLocked ? `Cần một bé cấp ${ctx.catalog.unlocks.advanced}.` : ''}</p>
          </div>
          <label class="switch ${advancedLocked ? 'disabled' : ''}">
            <input type="checkbox" data-advanced ${ctx.me.user.advanced ? 'checked' : ''} ${advancedLocked || !ctx.catalog.advancedFinance ? 'disabled' : ''} />
            <span></span>
          </label>
        </section>
      </div>`;
    if (w.history.length > 1) lineChart(view.querySelector('#nw-chart'), w.history.map((h) => h.total), { height: 110, format: (v) => fmt(v) });
    barChart(view.querySelector('#flow-chart'), w.report.daily, { height: 120 });
  }

  async function loadLedger(append) {
    const before = append ? rows.at(-1)?.id : '';
    const page = await api(`/wallet/ledger?kind=${encodeURIComponent(kindFilter)}${before ? `&before=${before}` : ''}`);
    rows = append ? rows.concat(page) : page;
    view.querySelector('.ledger tbody').innerHTML = rows.map(ledgerRow).join('') || '<tr><td colspan="4" class="muted">Không có giao dịch loại này.</td></tr>';
    const more = view.querySelector('[data-more]');
    if (more && page.length < 40) more.remove();
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.days) {
      days = Number(btn.dataset.days);
      ctx.refresh();
    } else if (btn.dataset.more !== undefined) {
      loadLedger(true).catch(ctx.fail);
    }
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-kind]')) {
      kindFilter = e.target.value;
      loadLedger(false).catch(ctx.fail);
    } else if (e.target.matches('[data-advanced]')) {
      const on = e.target.checked;
      if (on && !confirm('Bật Tài chính nâng cao? Các công cụ này có thể làm bạn mất xu nếu không cẩn thận.')) {
        e.target.checked = false;
        return;
      }
      ctx.act('/settings', { advancedFinance: on });
    }
  });

  api(`/wallet?days=${days}`).then((w) => {
    if (!view.isConnected) return;
    draw(w);
    if (kindFilter) loadLedger(false).catch(ctx.fail);
  }).catch(ctx.fail);
}
