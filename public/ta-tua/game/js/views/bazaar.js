// Chợ Phiên: người chơi bày bán đồ dư trong túi và món tự nấu cho nhau, giá tự đặt trong khoảng cho phép.
import { api } from '../api.js';
import { ago, countdown, esc, fmt, viewHead } from '../ui.js';
import { TIERS } from '../shared/gear.js';

const tierChip = (tier) => (TIERS[tier] ? `<span class="tier-chip tier-${tier}">${TIERS[tier].name}</span>` : '');

const TYPES = { food: 'Đồ ăn', care: 'Chăm sóc', toy: 'Đồ chơi', accessory: 'Phụ kiện', dish: 'Món nấu' };
const SORTS = { new: 'Mới nhất', deal: 'Giá hời', ending: 'Sắp hết hạn' };

/** Tab, bộ lọc và giá đang gõ, giữ nguyên qua các lần vẽ lại. */
const ui = { tab: 'buy', type: 'all', sort: 'new', help: false };
const drafts = {};

export function renderBazaar(root, ctx) {
  const { unlocks, items } = ctx.catalog;
  root.innerHTML = `<div class="pb-page bazaar-page">
    ${viewHead('🏮 Chợ Phiên', 'Chợ của người chơi: bày bán đồ dư trong túi và món tự nấu, mua lại đồ của nhau giá mềm.',
      '<div class="pb-links"><button class="btn small" data-go="kitchen">🍳 Bếp</button><button class="btn small" data-go="shop">🛍️ Cửa hàng</button></div>')}
    <div class="bazaar-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.bazaar-page');
  const view = page.querySelector('.bazaar-view');
  if (ctx.bestLevel() < unlocks.bazaar) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Chợ Phiên chưa họp</h2>
      <p class="muted">Có một bé đạt cấp ${unlocks.bazaar} là vào chợ mua bán được.</p></section>`;
    return;
  }
  let data = null;
  let rules = ctx.catalog.bazaar;
  let timer = 0;
  let poll = 0;
  let stopped = false;

  const until = (ts) => `<span data-until="${ts}">${countdown(ts - Date.now())}</span>`;
  const bandOf = (ref) => rules.band.map((k) => Math.max(1, Math.round(ref * k)));
  const listFee = (p) => Math.max(1, Math.round(p * rules.listFee));
  const saleFee = (p) => Math.max(1, Math.round(p * rules.saleFee));
  const permanent = (type) => type === 'toy' || type === 'accessory';
  const owned = (ref) => (ctx.me.inventory?.[ref] ?? 0) > 0;
  const pctOf = (l) => Math.round((l.price / Math.max(1, l.refPrice)) * 100);

  function tabsHtml() {
    const tab = (id, label) => `<button class="${ui.tab === id ? 'current' : ''}" data-bz-tab="${id}">${label}</button>`;
    return `<div class="seg bazaar-tabs">
      ${tab('buy', `🛍️ Mua <small>(${data.listings.filter((l) => !l.mine).length})</small>`)}
      ${tab('sell', `🏷️ Bán <small>(${data.open}/${rules.maxListings})</small>`)}
      ${tab('history', '🧾 Lịch sử')}
    </div>`;
  }

  function buyButton(l) {
    if (l.mine) return `<button class="btn small" data-bz-cancel="${l.id}">Gỡ tin</button>`;
    if (l.kind === 'item' && permanent(l.type) && l.type !== 'accessory' && owned(l.ref)) return '<button class="btn small" disabled title="Đồ dùng mãi mãi, bạn đã có rồi">Đã có</button>';
    if (ctx.me.user.coins < l.price) return '<button class="btn small" disabled>Thiếu xu</button>';
    return `<button class="btn small mint" data-bz-buy-id="${l.id}">Mua</button>`;
  }

  function listingCard(l) {
    const p = pctOf(l);
    return `<article class="card bazaar-card ${l.mine ? 'mine' : ''}">
      <span class="bazaar-icon">${l.icon}</span>
      <div class="bazaar-info">
        <b>${esc(l.name)}</b>${l.quality ? ` <span class="badge">${esc(l.quality)}</span>` : ''}${l.tier ? ` ${tierChip(l.tier)}` : ''}
        <small class="type-tag">${TYPES[l.type] ?? esc(l.type)}</small>
        ${l.lines?.length ? `<small class="gear-lines-inline">${l.lines.map(esc).join(' · ')}</small>` : ''}
        <small class="muted">${l.mine ? '<span class="badge star">Tin của bạn</span>' : `Người bán <b>${esc(l.seller)}</b>`}</small>
        <small class="muted">⏳ còn ${until(l.expiresAt)}${l.spoilsAt ? ` · 🦠 hư sau ${until(l.spoilsAt)}` : ''}</small>
      </div>
      <div class="bazaar-price">
        <b>${fmt(l.price)} 🪙</b>
        <small class="${p <= 100 ? 'up' : 'down'}" title="Giá tham chiếu ${fmt(l.refPrice)} 🪙">${p}% giá tham chiếu</small>
        ${buyButton(l)}
      </div>
    </article>`;
  }

  function buyTab() {
    const chip = (id, label) => `<button class="chip ${ui.type === id ? 'current' : ''}" data-bz-type="${id}">${label}</button>`;
    const sorted = data.listings.filter((l) => ui.type === 'all' || l.type === ui.type).slice();
    if (ui.sort === 'deal') sorted.sort((a, b) => a.price / a.refPrice - b.price / b.refPrice);
    else if (ui.sort === 'ending') sorted.sort((a, b) => a.expiresAt - b.expiresAt);
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return `<div class="bazaar-toolbar">
        <div class="bazaar-chips">${chip('all', 'Tất cả')}${Object.entries(TYPES).map(([id, label]) => chip(id, label)).join('')}</div>
        <div class="seg bazaar-sort">${Object.entries(SORTS).map(([id, label]) => `<button class="${ui.sort === id ? 'current' : ''}" data-bz-sort="${id}">${label}</button>`).join('')}</div>
      </div>
      ${sorted.length ? `<div class="bazaar-grid">${sorted.map(listingCard).join('')}</div>`
        : `<section class="card empty"><b>🏮</b><p class="muted">${ui.type === 'all' ? 'Chợ đang vắng, chưa ai bày hàng.' : 'Chưa có món nào thuộc loại này.'} Quay lại sau nhé!</p></section>`}`;
  }

  function sellRow(kind, s) {
    const key = `${kind}:${s.ref}`;
    const [lo, hi] = bandOf(s.refPrice);
    const price = drafts[key] ?? String(s.refPrice);
    const full = data.open >= rules.maxListings;
    let note = '';
    if (kind === 'gear') {
      note = `<small class="gear-lines-inline">${tierChip(s.tier)} ${(s.lines ?? []).map(esc).join(' · ')}</small>`
        + (s.wornBy ? '<small class="down">Bé đang đeo món này, bày bán sẽ tháo ra.</small>' : '');
    } else if (kind === 'item') {
      const item = items[s.ref];
      const worn = item?.type === 'accessory' && s.qty === 1 && ctx.me.pets.some((p) => Object.values(p.wear ?? {}).includes(s.ref));
      if (worn) note = '<small class="down">Bé đang đeo món này, bày bán sẽ tháo ra.</small>';
      else if (permanent(item?.type) && s.qty === 1) note = '<small class="muted">Đây là món cuối cùng của bạn.</small>';
    } else {
      note = `<small class="muted">🦠 Hư sau ${until(s.expiresAt)} · tin hết hạn cùng lúc món hư</small>`;
    }
    return `<form class="bazaar-sell" data-bz-sell="${kind}" data-ref="${esc(s.ref)}" data-refprice="${s.refPrice}">
      <span class="bazaar-icon small">${s.icon}</span>
      <div class="bazaar-sell-info">
        <b>${esc(s.name)}</b>${kind === 'item' ? ` <small class="muted">×${s.qty}</small>` : kind === 'dish' ? ` <span class="badge">${esc(s.quality)}</span>` : ''}
        <small class="muted">Tham chiếu ${fmt(s.refPrice)} 🪙 · cho phép ${fmt(lo)}–${fmt(hi)}</small>
        ${note}
      </div>
      <div class="bazaar-sell-action">
        <input name="price" type="number" min="${lo}" max="${hi}" step="1" value="${esc(price)}" aria-label="Giá bán" required />
        <button class="btn small pink" ${!data.canSell || full ? 'disabled' : ''}>Bày bán</button>
      </div>
      <small class="bazaar-net">${netText(Number(price), lo, hi)}</small>
    </form>`;
  }

  function netText(p, lo, hi) {
    if (!Number.isInteger(p) || p < lo || p > hi) return `<span class="down">Giá phải từ ${fmt(lo)} đến ${fmt(hi)} xu.</span>`;
    return `Phí đăng ${fmt(listFee(p))} 🪙 · bán được bạn nhận <b>${fmt(p - saleFee(p))} 🪙</b>`;
  }

  function sellTab() {
    const mine = data.listings.filter((l) => l.mine);
    const notice = data.canSell ? ''
      : `<p class="locked-note">⏳ Tài khoản cần đủ ${rules.minAccountDays} ngày tuổi mới bày bán được — mở lúc
          ${esc(new Date(data.sellFrom).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }))}
          (còn ${until(data.sellFrom)}). Trong lúc chờ bạn vẫn mua được.</p>`;
    const full = data.open >= rules.maxListings
      ? `<p class="pb-note">Bạn đang bày đủ ${rules.maxListings} món. Gỡ bớt hoặc đợi bán xong để bày thêm.</p>` : '';
    const { items: inv, dishes } = data.sellable;
    const gear = (data.sellable.gear ?? []).map((g) => ({ ...g, ref: String(g.id), icon: items[g.itemId]?.icon ?? '🎀' }));
    return `${notice}
      <section class="card bazaar-box">
        <h3>🏷️ Đang bày <small class="muted">(${data.open}/${rules.maxListings})</small></h3>
        ${mine.length ? `<ul class="pb-list">${mine.map((l) => `
          <li class="bazaar-mine">
            <span class="bazaar-icon small">${l.icon}</span>
            <div><b>${esc(l.name)}</b>${l.quality ? ` <span class="badge">${esc(l.quality)}</span>` : ''}<br>
              <small class="muted">${fmt(l.price)} 🪙 (${pctOf(l)}% tham chiếu) · còn ${until(l.expiresAt)}</small></div>
            <button class="btn small" data-bz-cancel="${l.id}">Gỡ tin</button>
          </li>`).join('')}</ul>` : '<p class="muted">Bạn chưa bày món nào.</p>'}
        ${full}
      </section>
      <section class="card bazaar-box">
        <h3>🎒 Đồ trong túi</h3>
        ${inv.length ? `<div class="bazaar-sell-list">${inv.map((s) => sellRow('item', s)).join('')}</div>`
          : '<p class="muted">Túi đồ trống. Mua ở cửa hàng hoặc nhận quà từ bạn bè.</p>'}
      </section>
      <section class="card bazaar-box">
        <h3>🎀 Trang phục</h3>
        ${gear.length ? `<div class="bazaar-sell-list">${gear.map((s) => sellRow('gear', s)).join('')}</div>`
          : '<p class="muted">Chưa có món trang phục nào. Mua ở cửa hàng, nhận từ mini-game hoặc mã quà.</p>'}
      </section>
      <section class="card bazaar-box">
        <h3>🍲 Món tự nấu</h3>
        ${dishes.length ? `<div class="bazaar-sell-list">${dishes.map((s) => sellRow('dish', s)).join('')}</div>`
          : '<p class="muted">Chưa có món nào. Vào Bếp nấu vài món rồi mang ra chợ nhé.</p>'}
      </section>`;
  }

  function historyTab() {
    const statusText = (l) => {
      if (l.status === 'sold') return `<span class="up">Đã bán cho ${esc(l.buyer)} · nhận ${fmt(l.price - saleFee(l.price))} 🪙</span>`;
      if (l.status === 'expired') return 'Hết hạn, món đã về túi';
      return 'Đã gỡ tin';
    };
    return `<section class="card bazaar-box">
        <h3>💰 Tin của bạn đã đóng</h3>
        ${data.sold.length ? `<ul class="pb-list">${data.sold.map((l) => `
          <li class="bazaar-mine">
            <span class="bazaar-icon small">${l.icon}</span>
            <div><b>${esc(l.name)}</b>${l.quality ? ` <span class="badge">${esc(l.quality)}</span>` : ''} · ${fmt(l.price)} 🪙<br>
              <small class="muted">${statusText(l)}${l.soldAt ? ` · ${ago(l.soldAt)}` : ''}</small></div>
          </li>`).join('')}</ul>` : '<p class="muted">Chưa có tin nào đóng.</p>'}
      </section>
      <section class="card bazaar-box">
        <h3>🛍️ Bạn đã mua</h3>
        ${data.bought.length ? `<ul class="pb-list">${data.bought.map((l) => `
          <li class="bazaar-mine">
            <span class="bazaar-icon small">${l.icon}</span>
            <div><b>${esc(l.name)}</b>${l.quality ? ` <span class="badge">${esc(l.quality)}</span>` : ''} · ${fmt(l.price)} 🪙<br>
              <small class="muted">của ${esc(l.seller)}${l.soldAt ? ` · ${ago(l.soldAt)}` : ''}</small></div>
          </li>`).join('')}</ul>` : '<p class="muted">Bạn chưa mua gì ở chợ.</p>'}
      </section>`;
  }

  function helpHtml() {
    const pc = (v) => `${Math.round(v * 100)}%`;
    return `<details class="card pb-help" data-help ${ui.help ? 'open' : ''}>
      <summary>❓ Luật chợ</summary>
      <ul>
        <li>Giá tự đặt trong khoảng <b>${pc(rules.band[0])}–${pc(rules.band[1])} giá tham chiếu</b> (giá cửa hàng, hoặc giá trị món nấu theo chất lượng).</li>
        <li>Phí đăng tin <b>${pc(rules.listFee)}</b> trả ngay và không hoàn; bán được thì trừ thêm <b>${pc(rules.saleFee)}</b> vào tiền bạn nhận.</li>
        <li>Tin còn <b>${rules.hours} giờ</b>. Hết hạn hoặc gỡ tin thì món về lại túi (món nấu đã hư thì mất).</li>
        <li>Mỗi người bày tối đa <b>${rules.maxListings} món</b>; tài khoản cần đủ ${rules.minAccountDays} ngày tuổi mới được bày bán.</li>
        <li>Đồ chơi dùng mãi mãi chỉ mua được nếu bạn chưa có.</li>
        <li>Trang phục bán theo từng món, giữ nguyên cấp và dòng chỉ số; giá tham chiếu theo cấp (Xanh lam ×1, Xanh lục ×2, Vàng ×4, Đỏ ×8 giá cửa hàng).</li>
        <li>Bán được hàng, bé chính có dòng "Thu nhập giao dịch" thì nhận thêm % đó.</li>
      </ul>
    </details>`;
  }

  function draw() {
    const body = ui.tab === 'sell' ? sellTab() : ui.tab === 'history' ? historyTab() : buyTab();
    view.innerHTML = `${tabsHtml()}<div class="bazaar-body">${body}</div>${helpHtml()}`;
  }

  async function load() {
    const d = await api('/bazaar');
    if (!view.isConnected) return;
    data = d;
    rules = { ...ctx.catalog.bazaar, ...d.rules };
    draw();
  }

  page.addEventListener('toggle', (e) => {
    if (e.target.matches?.('[data-help]')) ui.help = e.target.open;
  }, true);

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !data) return;
    const d = btn.dataset;
    if (d.bzTab) {
      ui.tab = d.bzTab;
      draw();
    } else if (d.bzType) {
      ui.type = d.bzType;
      draw();
    } else if (d.bzSort) {
      ui.sort = d.bzSort;
      draw();
    } else if (d.bzBuyId) {
      const l = data.listings.find((x) => x.id === Number(d.bzBuyId));
      if (!l) return;
      const p = pctOf(l);
      if (p > 150 && !confirm(`${l.name} đang bán ${fmt(l.price)} 🪙, bằng ${p}% giá tham chiếu (${fmt(l.refPrice)} 🪙). Vẫn mua?`)) return;
      ctx.act(`/bazaar/${l.id}/buy`);
    } else if (d.bzCancel) {
      const l = data.listings.find((x) => x.id === Number(d.bzCancel));
      const fee = l ? listFee(l.price) : 0;
      if (confirm(`Gỡ tin${l ? ` ${l.name}` : ''}? Món về lại túi, phí đăng tin${fee ? ` ${fmt(fee)} 🪙` : ''} không được hoàn.`)) ctx.act(`/bazaar/${d.bzCancel}/cancel`);
    }
  });

  page.addEventListener('input', (e) => {
    const f = e.target.closest('[data-bz-sell]');
    if (!f || e.target.name !== 'price') return;
    drafts[`${f.dataset.bzSell}:${f.dataset.ref}`] = e.target.value;
    const [lo, hi] = bandOf(Number(f.dataset.refprice));
    f.querySelector('.bazaar-net').innerHTML = netText(Number(e.target.value), lo, hi);
  });

  page.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-bz-sell]');
    if (!f) return;
    e.preventDefault();
    const kind = f.dataset.bzSell;
    const key = `${kind}:${f.dataset.ref}`;
    ctx.act('/bazaar/list', { kind, ref: f.dataset.ref, price: Number(new FormData(f).get('price')) }, {
      onResult: () => { delete drafts[key]; },
    });
  });

  load().then(() => {
    if (stopped || !view.isConnected) return;
    timer = setInterval(() => {
      for (const el of view.querySelectorAll('[data-until]')) el.textContent = countdown(Number(el.dataset.until) - Date.now());
    }, 1000);
    poll = setInterval(() => {
      if (ui.tab === 'buy' && document.visibilityState === 'visible' && !page.contains(document.activeElement?.closest('input, select, textarea'))) {
        load().catch(() => {});
      }
    }, 60_000);
  }).catch(ctx.fail);
  return () => {
    stopped = true;
    clearInterval(timer);
    clearInterval(poll);
  };
}
