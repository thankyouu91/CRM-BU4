// Ngân hàng: tiết kiệm không kỳ hạn, gửi kỳ hạn, thông báo của Ngân hàng Trung ương.
import { api } from '../api.js';
import { lineChart } from '../charts.js';
import { countdown, esc, fmt, pct, viewHead } from '../ui.js';
import { sceneHdr } from '../scenes-hdr.js';
import { focusClanBank } from './clan-bank.js';

let term = 7;

const ratePct = (r) => `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;

/**
 * Phố Ngân hàng: chính giữa là Ngân hàng Trân Châu (nhà nước, NPC), hai bên là các suất ngân hàng tư của gia tộc.
 * Suất đã có gia tộc mua giấy phép thì mở cửa (bấm vào để gửi tiền / vay), suất chưa ai mua thì kéo cửa cuốn khóa lại.
 */
function streetHtml(cb, ctx) {
  const slots = cb?.licenses?.slots ?? 4;
  const banks = (cb?.banks ?? []).slice(0, slots);
  const store = (i) => {
    const b = banks[i];
    if (!b) {
      const lic = cb?.licenses;
      const mine = cb?.clan;
      return `<div class="bank-store locked" aria-label="Suất ngân hàng tư còn trống">
        <div class="store-awning"></div>
        <div class="store-shutter"><span>🔒</span></div>
        <div class="store-sign"><b>Ngân hàng tư #${i + 1}</b><small>Chờ gia tộc mua giấy phép${lic ? ` · ${fmt(lic.fee)} xu` : ''}</small></div>
        ${mine?.canOpen ? '<button class="btn small gold" data-go="clanbank">Mua giấy phép</button>' : ''}
      </div>`;
    }
    const best = Math.max(...b.rates.map((r) => r.rate));
    const color = /^#[0-9a-f]{6}$/i.test(b.color ?? '') ? b.color : '#8a5a3b';
    return `<button class="bank-store open ${b.accepting ? '' : 'paused'}" data-go="clanbank" data-bank="${b.clanId}" style="--store:${color}" title="Vào ${esc(b.name)}">
      <div class="store-awning"></div>
      <div class="store-front"><span class="store-emblem">${esc(b.emblem)}</span></div>
      <div class="store-sign"><b>${esc(b.name)}</b>
        <small>lãi tới <b class="up">${ratePct(best)}</b>/ngày · uy tín ${b.reputation}</small>
        <small class="${b.accepting ? 'muted' : 'down'}">${b.frozen ? '⛔ Đang phong tỏa' : b.accepting ? '🟢 Đang nhận tiền gửi' : '⏸ Tạm ngừng nhận gửi'}</small>
      </div>
    </button>`;
  };
  const half = Math.ceil(slots / 2);
  const left = Array.from({ length: half }, (_, i) => store(i)).join('');
  const right = Array.from({ length: slots - half }, (_, i) => store(half + i)).join('');
  return `<section class="bank-street" aria-label="Phố Ngân hàng">
    <div class="street-gate">🏦 Phố Ngân hàng <small>${banks.length}/${slots} ngân hàng tư đang mở</small></div>
    <div class="street-row">
      <div class="street-side">${left}</div>
      <a class="bank-store national" href="#bank-national" data-scroll="bank-national">
        <div class="store-awning"></div>
        <div class="store-front"><span class="store-emblem">🏛️</span></div>
        <div class="store-sign"><b>Ngân hàng Trân Châu</b><small>Ngân hàng nhà nước · tiết kiệm, kỳ hạn, tín dụng</small></div>
      </a>
      <div class="street-side">${right}</div>
    </div>
    <div class="street-road"></div>
  </section>`;
}

export function renderBank(root, ctx) {
  root.innerHTML = `${viewHead('🏦 Phố Ngân hàng', 'Giữa phố là Ngân hàng Trân Châu của nhà nước; hai bên là ngân hàng tư của các gia tộc, lãi cao hơn nhưng rủi ro hơn.')}
    ${sceneHdr('bank')}
    <div class="bank-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.bank-view');
  const need = ctx.catalog.unlocks.bank;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Ngân hàng chưa mở</h2>
      <p class="muted">Có một bé đạt cấp ${need} là mở tài khoản được.</p></section>`;
    return;
  }

  function draw(b, cb) {
    const latest = b.history.at(-1);
    const termInfo = b.terms.find((t) => t.days === term) ?? b.terms[0];
    view.innerHTML = `
      ${streetHtml(cb, ctx)}
      <h2 class="bank-section-title" id="bank-national">🏛️ Ngân hàng Trân Châu <small class="muted">ngân hàng nhà nước</small></h2>
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


      </div>
      <h2 class="bank-section-title">🏪 Dịch vụ tài chính khác</h2>
      <div class="bank-grid">
        <section class="card bank-box wide row-between">
          <div>
            <h3>📈 Sàn cổ phiếu gia tộc</h3>
            <p class="muted">Mua cổ phần các gia tộc đã lên sàn, nhận cổ tức khi gia tộc có lãi. Giá chạy theo cung cầu, mỗi ngày tối đa ±15%.</p>
          </div>
          <button class="btn gold" data-go="shares">Xem</button>
        </section>

        <section class="card bank-box wide row-between">
          <div>
            <h3>📜 Trái phiếu</h3>
            <p class="muted">Cho gia tộc hoặc kho bạc vay theo mệnh giá, nhận lãi cố định mỗi đêm và lấy lại gốc khi đáo hạn; mua bán lại trên sàn thứ cấp.</p>
          </div>
          <button class="btn gold" data-go="bonds">Xem</button>
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
    const link = e.target.closest('[data-scroll]');
    if (link) {
      e.preventDefault();
      view.querySelector(`#${link.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.bank) focusClanBank(Number(btn.dataset.bank));
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

  // Ngân hàng tư chỉ để vẽ phố: lỗi thì vẫn hiện Ngân hàng Trân Châu, phố toàn suất khóa.
  Promise.all([api('/bank'), api('/clan-bank').catch(() => null)])
    .then(([b, cb]) => view.isConnected && draw(b, cb)).catch(ctx.fail);
}
