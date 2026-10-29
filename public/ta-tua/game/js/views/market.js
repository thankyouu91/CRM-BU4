// Sàn Nguyên Liệu: bảng giá, biểu đồ, đặt lệnh, kho hàng, lệnh chờ, tin thị trường.
import { api } from '../api.js';
import { candleChart, lineChart, sparkline } from '../charts.js';
import { ago, countdown, esc, fmt, fmtLots, fmtPrice, pct, viewHead } from '../ui.js';

/** Lựa chọn của người chơi giữ nguyên qua các lần vẽ lại. */
const ui = { selected: 'milk', range: 'day', side: 'buy', type: 'market', qty: '1', limit: '' };

export function renderMarket(root, ctx) {
  root.innerHTML = `<div class="market-page">
    ${viewHead('📈 Sàn Nguyên Liệu', 'Giá đổi mỗi 10 phút theo cung cầu và tin tức. 1 lô = 10 phần.', '<div class="wh-slot"></div>')}
    <div class="market-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.market-page');
  const view = page.querySelector('.market-view');
  const whSlot = page.querySelector('.wh-slot');
  const { commodities, market: rules } = ctx.catalog;
  const canTrade = ctx.bestLevel() >= ctx.catalog.unlocks.market;
  let data = null;
  let poll = 0;

  const priceOf = (id) => data.commodities.find((c) => c.id === id);

  function estimate() {
    const c = priceOf(ui.selected);
    const lots = Number(ui.qty) || 0;
    if (!c || lots <= 0) return '';
    const ref = ui.side === 'buy' ? c.ask : c.bid;
    const depth = rules.liquidity * (commodities[c.id].kind === 'processed' ? rules.processedDepth : 1);
    const unit = ui.type === 'limit' && Number(ui.limit) > 0
      ? Number(ui.limit)
      : ref * (1 + (ui.side === 'buy' ? 1 : -1) * (lots / depth / 2));
    const amount = Math.round(lots * unit);
    const fee = Math.max(1, Math.round(amount * rules.fee));
    return ui.side === 'buy'
      ? `≈ ${fmt(amount)} + phí ${fmt(fee)} = <b>${fmt(amount + fee)} 🪙</b>`
      : `≈ ${fmt(amount)} − phí ${fmt(fee)} = <b>${fmt(amount - fee)} 🪙</b>`;
  }

  function boardRow(c) {
    const def = commodities[c.id];
    return `
      <tr class="${c.id === ui.selected ? 'current' : ''}" data-pick="${c.id}">
        <td><span class="mk-icon">${def.icon}</span> ${def.name}${def.kind === 'processed' ? ' <small class="badge">chế biến</small>' : ''}</td>
        <td class="num"><b>${fmtPrice(c.price)}</b></td>
        <td class="num ${c.change >= 0 ? 'up' : 'down'}">${pct(c.change)}</td>
        <td class="spark-cell"><div class="spark" data-spark="${c.id}"></div></td>
        <td class="num muted">${c.held ? fmtLots(c.held) : '–'}</td>
      </tr>`;
  }

  function detail() {
    const c = priceOf(ui.selected);
    const def = commodities[c.id];
    const held = data.holdings[c.id]?.qty ?? 0;
    const npc = c.npcLeft[ui.side];
    const lo = c.price * (1 - rules.band);
    const hi = c.price * (1 + rules.band);
    if (!ui.limit) ui.limit = fmtPrice(c.price).replace(',', '.');
    return `
      <header class="mk-head">
        <span class="mk-icon big">${def.icon}</span>
        <div>
          <h3>${def.name}</h3>
          <small class="muted">${def.kind === 'processed' ? `Chế biến từ ${Object.entries(def.inputs).map(([i, n]) => `${n} lô ${commodities[i].name.toLowerCase()}`).join(', ')}` : 'Hàng thô'}
            · ${def.shelfDays ? `hư sau ${def.shelfDays} ngày` : 'không hư'}</small>
        </div>
        <div class="mk-price">
          <b>${fmtPrice(c.price)}</b><span class="${c.change >= 0 ? 'up' : 'down'}">${pct(c.change)}</span>
          <small class="muted">mua ${fmtPrice(c.ask)} · bán ${fmtPrice(c.bid)}</small>
        </div>
      </header>
      <div class="seg range">
        <button class="${ui.range === 'day' ? 'current' : ''}" data-range="day">24 giờ</button>
        <button class="${ui.range === 'week' ? 'current' : ''}" data-range="week">7 ngày (nến giờ)</button>
      </div>
      <div class="mk-chart"></div>
      ${canTrade ? `
      <form class="trade" data-trade>
        <div class="seg side">
          <button type="button" class="${ui.side === 'buy' ? 'current buy' : ''}" data-side="buy">Mua</button>
          <button type="button" class="${ui.side === 'sell' ? 'current sell' : ''}" data-side="sell">Bán</button>
        </div>
        <div class="seg type">
          <button type="button" class="${ui.type === 'market' ? 'current' : ''}" data-type="market">Giá thị trường</button>
          <button type="button" class="${ui.type === 'limit' ? 'current' : ''}" data-type="limit">Đặt giá chờ</button>
        </div>
        <label>Khối lượng (lô)
          <input name="qty" type="number" min="0.1" max="100" step="0.1" value="${esc(ui.qty)}" required />
        </label>
        <div class="quick">
          ${[1, 5, 10].map((n) => `<button type="button" class="chip" data-qty="${n}">${n} lô</button>`).join('')}
          ${ui.side === 'sell' && held ? `<button type="button" class="chip" data-qty="${held / 10}">Tất cả (${fmtLots(held)})</button>` : ''}
        </div>
        ${ui.type === 'limit' ? `
          <label>Giá đặt (xu/lô)
            <input name="limit" type="number" min="${lo.toFixed(1)}" max="${hi.toFixed(1)}" step="0.1" value="${esc(ui.limit)}" required />
          </label>
          <small class="muted">Trong khoảng ${fmtPrice(lo)}–${fmtPrice(hi)}. Lệnh chờ tới nửa đêm, ${ui.side === 'buy' ? 'xu được ký quỹ' : 'hàng được giữ'} trong lúc chờ.</small>` : ''}
        <p class="estimate">${estimate()}</p>
        <p class="muted small">Hôm nay còn ${fmtLots(npc)} lô ${ui.side === 'buy' ? 'mua từ' : 'bán cho'} NPC · Kho của bạn: ${fmtLots(held)} lô</p>
        <button class="btn ${ui.side === 'buy' ? 'mint' : 'pink'}">${ui.side === 'buy' ? 'Mua' : 'Bán'} ${def.name}</button>
      </form>` : `<p class="locked-note">🔒 Mở giao dịch khi có một bé đạt cấp ${ctx.catalog.unlocks.market}. Hàng câu được vẫn nằm an toàn trong kho.</p>`}`;
  }

  function holdingsHtml() {
    const entries = Object.entries(data.holdings);
    if (!entries.length) return '<p class="muted">Kho trống. Mua trên Sàn hoặc câu cá, hứng trân châu ở Khu vui chơi.</p>';
    return `<ul class="holdings">${entries.map(([id, h]) => {
      const def = commodities[id];
      const soonest = h.lots.map((l) => l.expiresAt).filter(Boolean).sort((a, b) => a - b)[0];
      const value = (h.qty / 10) * priceOf(id).bid;
      return `<li>
        <span class="mk-icon">${def.icon}</span>
        <div><b>${def.name}</b> · ${fmtLots(h.qty)} lô <small class="muted">≈ ${fmt(value)} 🪙</small>
          ${soonest ? `<br><small class="${soonest - Date.now() < 12 * 3600_000 ? 'down' : 'muted'}">Lô sớm nhất hư sau ${countdown(soonest - Date.now())}</small>` : ''}</div>
        ${canTrade ? `<button class="btn small" data-sell-all="${id}">Bán</button>` : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  function ordersHtml() {
    if (!data.orders.length) return '<p class="muted">Không có lệnh nào đang chờ.</p>';
    return `<ul class="orders">${data.orders.map((o) => `
      <li>
        <span class="badge ${o.side === 'buy' ? 'star' : ''}">${o.side === 'buy' ? 'Mua' : 'Bán'}</span>
        <div>${commodities[o.commodity].icon} ${fmtLots(o.qty - o.filled)} lô @ <b>${fmtPrice(o.limit)}</b>
          ${o.filled ? `<small class="muted">(đã khớp ${fmtLots(o.filled)})</small>` : ''}
          ${o.locked ? `<br><small class="muted">Ký quỹ ${fmt(o.locked)} 🪙</small>` : ''}</div>
        <button class="btn small" data-cancel="${o.id}">Hủy</button>
      </li>`).join('')}</ul>`;
  }

  function newsHtml() {
    if (!data.news.length) return '<p class="muted">Chưa có tin mới.</p>';
    return `<ul class="mk-news">${data.news.map((n) => `
      <li><span>${commodities[n.commodity].icon}</span>
        <div>${esc(n.headline)} <span class="${n.up ? 'up' : 'down'}">${n.up ? '▲' : '▼'}</span>
          <br><small class="muted">${n.early ? '🧠 Tin sớm · ' : ''}${ago(n.at)}</small></div></li>`).join('')}</ul>
      ${data.smart ? '' : '<p class="muted small">Bé có Thông minh từ 60 sẽ đọc được tin sớm 30 phút.</p>'}`;
  }

  async function drawChart() {
    const host = view.querySelector('.mk-chart');
    if (!host) return;
    const points = await api(`/market/${ui.selected}/history?range=${ui.range}`);
    if (!host.isConnected) return;
    if (ui.range === 'day') lineChart(host, points.map((p) => p.price), { height: 170, format: fmtPrice });
    else candleChart(host, points, { height: 170, format: fmtPrice });
  }

  function draw() {
    const wh = data.warehouse;
    const used = wh.used + wh.reserved;
    whSlot.innerHTML = `
      <div class="warehouse">
        <span>🏚️ Kho ${fmtLots(used)}/${fmtLots(wh.capacity)} lô</span>
        <div class="bar energy"><i style="width:${Math.min(100, (used / wh.capacity) * 100)}%"></i></div>
        ${wh.next ? `<button class="btn small" data-upgrade>Mở rộng ${fmt(wh.next.lots)} lô · ${fmt(wh.next.price)} 🪙</button>` : ''}
        <button class="btn small" data-go="contracts">📜 Hợp đồng cung ứng</button>
      </div>`;
    view.innerHTML = `
      <div class="market-grid">
        <section class="card mk-board">
          <div class="table-wrap"><table>
            <thead><tr><th>Mặt hàng</th><th class="num">Giá/lô</th><th class="num">24 giờ</th><th></th><th class="num">Kho</th></tr></thead>
            <tbody>${data.commodities.map(boardRow).join('')}</tbody>
          </table></div>
        </section>
        <section class="card mk-detail">${detail()}</section>
        <section class="card mk-side"><h3>🏚️ Kho hàng</h3>${holdingsHtml()}</section>
        <section class="card mk-side"><h3>⏳ Lệnh chờ</h3>${ordersHtml()}</section>
        <section class="card mk-side"><h3>📰 Tin thị trường</h3>${newsHtml()}</section>
      </div>`;
    for (const el of view.querySelectorAll('[data-spark]')) sparkline(el, priceOf(el.dataset.spark).spark, { height: 26 });
    drawChart().catch(() => {});
  }

  async function load({ notifySpoiled = false } = {}) {
    data = await api('/market');
    if (!view.isConnected) return;
    if (!data.commodities.some((c) => c.id === ui.selected)) ui.selected = data.commodities[0].id;
    if (notifySpoiled) {
      for (const s of data.spoiled) ctx.toast(`🦠 ${fmtLots(s.qty)} lô ${commodities[s.commodity].name} đã hư, bị bỏ khỏi kho.`, 'error');
    }
    draw();
  }

  page.addEventListener('click', (e) => {
    const row = e.target.closest('[data-pick]');
    if (row && view.contains(row)) {
      ui.selected = row.dataset.pick;
      ui.limit = '';
      draw();
      return;
    }
    const btn = e.target.closest('button');
    if (!btn) return;
    const d = btn.dataset;
    if (d.range) {
      ui.range = d.range;
      draw();
    } else if (d.side) {
      ui.side = d.side;
      draw();
    } else if (d.type) {
      ui.type = d.type;
      draw();
    } else if (d.qty) {
      ui.qty = String(d.qty);
      draw();
    } else if (d.sellAll) {
      Object.assign(ui, { selected: d.sellAll, side: 'sell', type: 'market', qty: String(data.holdings[d.sellAll].qty / 10), limit: '' });
      draw();
      view.querySelector('.mk-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (d.cancel) {
      ctx.act(`/market/orders/${d.cancel}/cancel`);
    } else if (d.upgrade !== undefined) {
      ctx.act('/market/warehouse');
    }
  });

  view.addEventListener('input', (e) => {
    if (!e.target.closest('[data-trade]')) return;
    ui[e.target.name] = e.target.value;
    const est = view.querySelector('.estimate');
    if (est) est.innerHTML = estimate();
  });

  view.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-trade]')) return;
    e.preventDefault();
    const qty = Math.round(Number(ui.qty) * 10);
    const body = { commodity: ui.selected, side: ui.side, qty, type: ui.type };
    if (ui.type === 'limit') body.limit = Number(ui.limit);
    ctx.act('/market/order', body);
  });

  load({ notifySpoiled: true }).catch(ctx.fail);
  poll = setInterval(() => {
    if (document.visibilityState === 'visible' && !view.contains(document.activeElement)) load().catch(() => {});
  }, 60_000);
  return () => clearInterval(poll);
}
