// Hợp đồng cung ứng: chốt giá với người chơi khác, mỗi nửa đêm hàng tự đi từ kho bên bán sang kho bên mua.
import { api } from '../api.js';
import { ago, countdown, esc, fmt, pct, viewHead } from '../ui.js';
import { hasAtlasIcon, itemIcon } from '../itemart.js';

/** Bản nháp đề xuất mới và trạng thái giao diện, giữ nguyên qua các lần vẽ lại. */
const form = { counterpart: '', role: 'sell', commodity: '', lots: '1', price: '', days: '7' };
const ui = { help: false };

const HOUR = 3600_000;
/** Nửa đêm sắp tới theo giờ Việt Nam: lúc hợp đồng giao hàng. */
function nextMidnight() {
  const key = new Date(Date.now() + 7 * HOUR).toISOString().slice(0, 10);
  return Date.parse(`${key}T00:00:00Z`) - 7 * HOUR + 24 * HOUR;
}
const int = (v) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0);

export function renderContracts(root, ctx) {
  const { commodities, unlocks } = ctx.catalog;
  const lot = ctx.catalog.market?.lot ?? 10;
  const brokenPts = Math.abs(ctx.catalog.credit?.contractBroken ?? 30);
  const dayPts = Math.abs(ctx.catalog.credit?.contractDay ?? 3);

  root.innerHTML = `<div class="pb-page contract-page">
    ${viewHead('📜 Hợp đồng cung ứng', 'Chốt giá với người chơi khác: mỗi nửa đêm hàng tự giao, tiền tự trả, giá Sàn lên xuống cũng không sợ.',
      `<div class="pb-links">
        <button class="btn small" data-go="factory">🏭 Xưởng</button>
        <button class="btn small" data-go="market">📈 Sàn</button>
        <button class="btn small" data-go="credit">💳 Tín dụng</button>
      </div>`)}
    <div class="contract-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.contract-page');
  const view = page.querySelector('.contract-view');
  const locked = ctx.bestLevel() < unlocks.contracts;
  let data = null;
  let rules = ctx.catalog.contracts;
  let friends = [];
  let timer = 0;
  let poll = 0;
  let stopped = false;

  const com = (c) => commodities[c] ?? { name: c, icon: '📦' };
  /** Icon 16-bit 32 điểm của mặt hàng `c` (atlas assets/items); chưa có hình thì emoji như cũ. */
  const comIcon = (c) => itemIcon({ id: c, icon: com(c).icon }, 3, 1);
  /** Emoji của mặt hàng chêm vào câu, chỉ khi hàng chưa có icon 16-bit: có rồi thì đầu thẻ (hay ô chọn hàng) đã vẽ
   *  icon đó, chêm emoji cũ (hình khác hẳn) là một thứ ra hai hình. */
  const glyph = (c) => (hasAtlasIcon(c) ? '' : ` ${com(c).icon}`);
  const stockLots = (c) => (data.goods[c] ?? 0) / lot;
  const lotsText = (n) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const breakShare = () => rules.breakShare ?? 0.1;
  /** Bồi thường cho đối tác nếu mình phá hợp đồng bây giờ (10% giá trị phần còn lại, tối đa bằng ký quỹ của mình). */
  const breakComp = (c) => Math.min(c.myEscrow, Math.round(c.daysLeft * c.lots * c.price * breakShare()));
  /** Ký quỹ phải giữ khi nhận một đề xuất. */
  const escrowFor = (role, lots, price, days) => (role === 'sell' ? Math.round(lots * price * days * rules.sellerEscrow) : lots * price);
  const band = (c) => {
    const market = data.prices[c] ?? 0;
    return rules.band.map((k) => Math.max(1, Math.round(market * k)));
  };
  const until = (ts) => `<span data-until="${ts}">${countdown(ts - Date.now())}</span>`;

  /** Giá hợp đồng so với giá Sàn, màu theo lợi hay thiệt cho mình. */
  function marketDiff(role, price, market) {
    const diff = (price - market) / market;
    const good = role === 'sell' ? diff >= 0 : diff <= 0;
    return { diff, cls: Math.abs(diff) < 0.005 ? 'muted' : good ? 'up' : 'down' };
  }
  function vsMarket(role, price, market) {
    if (!market) return '';
    const { diff, cls } = marketDiff(role, price, market);
    return `<small class="${cls}">Sàn ${fmt(market)} · ${pct(diff, 0)}</small>`;
  }

  function statusBadge(c) {
    const labels = {
      proposed: ['Chờ trả lời', ''],
      active: ['Đang chạy', 'star'],
      done: ['Hoàn thành', 'star'],
      broken: [c.brokenByMe ? 'Bạn đã phá' : 'Đối tác phá', 'pb-bad'],
      cancelled: [c.proposedByMe ? 'Bạn rút lại' : 'Đối tác rút lại', ''],
      rejected: [c.proposedByMe ? 'Bị từ chối' : 'Bạn từ chối', ''],
      expired: ['Hết hạn', ''],
    };
    const [text, cls] = labels[c.status] ?? [c.status, ''];
    return `<span class="badge ${cls}">${esc(text)}</span>`;
  }

  function head(c) {
    const k = com(c.commodity);
    return `<header class="contract-head">
      <span class="contract-icon">${comIcon(c.commodity)}</span>
      <div><b>${c.role === 'sell' ? 'Bán' : 'Mua'} ${esc(k.name)}</b> <small class="muted">#${c.id}</small><br>
        <small class="muted">${c.role === 'sell' ? 'cho' : 'của'} <b>${esc(c.partner)}</b></small></div>
      ${statusBadge(c)}
    </header>`;
  }

  function terms(c) {
    return `<div class="contract-terms">
      <div><span class="muted">Mỗi đêm</span><b>${c.lots} lô</b></div>
      <div><span class="muted">Giá/lô</span><b>${fmt(c.price)} 🪙</b>${vsMarket(c.role, c.price, c.market)}</div>
      <div><span class="muted">Thời hạn</span><b>${c.days} ngày</b></div>
      <div><span class="muted">Tổng giá trị</span><b>${fmt(c.lots * c.price * c.days)} 🪙</b></div>
    </div>`;
  }

  function incomingCard(c) {
    const need = escrowFor(c.role, c.lots, c.price, c.days);
    const expired = c.expiresAt <= Date.now();
    const stock = c.role === 'sell'
      ? `<li class="${stockLots(c.commodity) >= c.lots ? '' : 'down'}"><span>Kho của bạn</span><b>${lotsText(stockLots(c.commodity))} lô${glyph(c.commodity)} (cần ${c.lots} lô mỗi đêm)</b></li>`
      : `<li><span>Mỗi đêm trả</span><b>${fmt(c.lots * c.price)} 🪙 (ví trước, thiếu thì trừ ký quỹ)</b></li>`;
    return `<article class="contract-card incoming">
      ${head(c)}
      <p class="contract-lead"><b>${esc(c.partner)}</b> muốn ${c.role === 'sell' ? 'mua của bạn' : 'bán cho bạn'} ${c.lots} lô mỗi đêm trong ${c.days} ngày.</p>
      ${terms(c)}
      <ul class="pb-list">
        <li class="${ctx.me.user.coins >= need ? '' : 'down'}"><span>Nhận thì bạn ký quỹ ngay</span><b>${fmt(need)} 🪙</b></li>
        <li><span>Ký quỹ của ${esc(c.partner)}</span><b>${fmt(c.theirEscrow)} 🪙</b></li>
        ${stock}
      </ul>
      <div class="row-between">
        <small class="muted">${expired ? 'Đề xuất đã hết hạn' : `Hết hạn sau ${until(c.expiresAt)}`}</small>
        <div class="row">
          <button class="btn small" data-ct-decline="${c.id}">Từ chối</button>
          <button class="btn small mint" data-ct-accept="${c.id}" ${locked || expired ? `disabled title="${expired ? 'Đề xuất đã hết hạn' : `Cần bé cấp ${unlocks.contracts}`}"` : ''}>🤝 Nhận</button>
        </div>
      </div>
    </article>`;
  }

  function outgoingCard(c) {
    return `<article class="contract-card outgoing">
      ${head(c)}
      ${terms(c)}
      <div class="row-between">
        <small class="muted">Bạn đã ký quỹ <b>${fmt(c.myEscrow)} 🪙</b> · ${c.expiresAt <= Date.now()
          ? 'đề xuất đã hết hạn, ký quỹ tự hoàn lúc nửa đêm (hoặc rút lại ngay)'
          : `chờ ${esc(c.partner)} trả lời · hết hạn sau ${until(c.expiresAt)}`}</small>
        <button class="btn small" data-ct-withdraw="${c.id}">Rút lại</button>
      </div>
    </article>`;
  }

  /** Đêm nay có giao/nhận đủ không. */
  function tonight(c) {
    if (c.role === 'sell') {
      const have = stockLots(c.commodity);
      if (have >= c.lots) return `<p class="pb-ok">✅ Kho đủ hàng cho đêm nay: có ${lotsText(have)} lô, cần ${c.lots} lô.</p>`;
      const missing = c.lots - Math.floor(have);
      const penalty = Math.round(missing * (Math.max(0, c.market - c.price) + c.price * rules.shortfallExtra));
      return `<p class="pb-warn">⚠️ Kho chỉ có ${lotsText(have)} lô, đêm nay thiếu ~${missing} lô → bồi thường ≈ ${fmt(penalty)} 🪙. Mua thêm ở Sàn hoặc cho xưởng chạy.</p>`;
    }
    const need = c.lots * c.price;
    const coins = ctx.me.user.coins;
    if (coins >= need) return `<p class="pb-ok">✅ Ví đủ trả đêm nay (${fmt(need)} 🪙).</p>`;
    if (coins + c.myEscrow >= need) return `<p class="pb-note">Ví đang thiếu, đêm nay sẽ trừ vào ký quỹ. Cần ${fmt(need)} 🪙 mỗi đêm.</p>`;
    return `<p class="pb-warn">⚠️ Ví và ký quỹ không đủ trả đêm nay (cần ${fmt(need)} 🪙): hợp đồng sẽ bị tính là bạn phá.</p>`;
  }

  function activeCard(c) {
    const doneDays = c.days - c.daysLeft;
    return `<article class="contract-card active">
      ${head(c)}
      ${terms(c)}
      <div class="contract-progress">
        <div class="row-between"><small>Ngày ${doneDays}/${c.days} · đã giao ${lotsText(c.delivered)}/${c.lots * c.days} lô</small>
          <small class="muted">Lượt giao tới sau ${until(nextMidnight())}</small></div>
        <div class="bar xp"><i style="width:${Math.round((doneDays / Math.max(1, c.days)) * 100)}%"></i></div>
      </div>
      <ul class="pb-list">
        <li><span>Ký quỹ của bạn</span><b>${fmt(c.myEscrow)} 🪙</b></li>
        <li><span>Ký quỹ của ${esc(c.partner)}</span><b>${fmt(c.theirEscrow)} 🪙</b></li>
      </ul>
      ${tonight(c)}
      <button class="link-btn danger" data-ct-break="${c.id}">Phá hợp đồng</button>
    </article>`;
  }

  function pastRow(c) {
    const k = com(c.commodity);
    return `<li class="contract-past">
      <span class="contract-icon small">${comIcon(c.commodity)}</span>
      <div><b>${c.role === 'sell' ? 'Bán' : 'Mua'} ${esc(k.name)}</b> <small class="muted">${c.role === 'sell' ? 'cho' : 'của'} ${esc(c.partner)} · ${c.lots} lô × ${fmt(c.price)} 🪙 × ${c.days} ngày
        ${c.status === 'done' || c.status === 'broken' ? ` · đã giao ${lotsText(c.delivered)} lô` : ''} · ${ago(c.createdAt)}</small></div>
      ${statusBadge(c)}
    </li>`;
  }

  function compare(price) {
    const market = data.prices[form.commodity];
    if (!market) return '';
    const { diff, cls } = marketDiff(form.role, price, market);
    const note = cls === 'up' ? ' · có lợi cho bạn' : cls === 'down' ? (form.role === 'sell' ? ' · rẻ hơn bán ở Sàn' : ' · đắt hơn mua ở Sàn') : '';
    return `<li><span>So với giá Sàn (${fmt(market)})</span><b class="${cls}">${pct(diff, 0)}${note}</b></li>`;
  }

  function previewHtml() {
    const lots = int(form.lots);
    const price = int(form.price);
    const days = int(form.days);
    const [lo, hi] = band(form.commodity);
    const errs = [];
    if (lots < 1 || lots > rules.maxLots) errs.push(`Mỗi đêm 1–${rules.maxLots} lô.`);
    if (price < lo || price > hi) errs.push(`Giá mỗi lô phải từ ${fmt(lo)} đến ${fmt(hi)} xu.`);
    if (days < rules.days[0] || days > rules.days[1]) errs.push(`Thời hạn ${rules.days[0]}–${rules.days[1]} ngày.`);
    if (errs.length) return `<p class="down small">${errs.join(' ')}</p>`;
    const daily = lots * price;
    const escrow = escrowFor(form.role, lots, price, days);
    const coins = ctx.me.user.coins;
    const extra = form.role === 'sell'
      ? (() => {
        const have = stockLots(form.commodity);
        const nights = Math.floor(have / lots);
        return `<li class="${nights >= days ? '' : 'down'}"><span>Kho của bạn</span><b>${lotsText(have)} lô${glyph(form.commodity)} · đủ ${Math.min(nights, days)}/${days} đêm</b></li>`;
      })()
      : `<li><span>Mỗi đêm cần sẵn</span><b>${fmt(daily)} 🪙 để nhận hàng</b></li>`;
    return `<ul class="pb-list">
      <li><span>Mỗi đêm</span><b>${lots} lô × ${fmt(price)} = ${fmt(daily)} 🪙</b></li>
      <li><span>Cả hợp đồng (${days} ngày)</span><b>${fmt(daily * days)} 🪙</b></li>
      <li class="${coins >= escrow ? '' : 'down'}"><span>Bạn ký quỹ ngay</span><b>${fmt(escrow)} 🪙 <small class="muted">(ví ${fmt(coins)})</small></b></li>
      ${extra}
      ${compare(price)}
    </ul>
    <small class="muted">${form.role === 'sell'
      ? `Bên bán ký quỹ ${pct(rules.sellerEscrow, 0, false)} tổng giá trị; đối tác (bên mua) ký quỹ tiền hàng một đêm.`
      : `Bên mua ký quỹ tiền hàng một đêm; đối tác (bên bán) ký quỹ ${pct(rules.sellerEscrow, 0, false)} tổng giá trị.`}</small>`;
  }

  function formHtml() {
    if (locked) {
      return `<p class="locked-note">🔒 Có một bé đạt cấp ${unlocks.contracts} là gửi và nhận hợp đồng được.</p>`;
    }
    const market = data.prices[form.commodity] ?? 0;
    const [lo, hi] = band(form.commodity);
    const chip = (label, v) => `<button type="button" class="chip" data-ct-price="${v}">${label}</button>`;
    // Ô chọn hàng: icon 16-bit của hàng đang chọn đứng cạnh (form vẽ lại khi đổi hàng). <option> chỉ chứa chữ, nên hàng
    // đã có icon 16-bit thì bỏ emoji cũ khỏi tên, để hàng đang chọn không ra hai hình khác nhau.
    return `<form class="contract-form" data-ct-form>
      <label>Đối tác
        <input name="counterpart" list="ct-friends" maxlength="20" autocomplete="off" placeholder="Tên người chơi" value="${esc(form.counterpart)}" required />
      </label>
      <datalist id="ct-friends">${friends.map((f) => `<option value="${esc(f)}"></option>`).join('')}</datalist>
      <div class="seg contract-role">
        <button type="button" class="${form.role === 'sell' ? 'current sell' : ''}" data-ct-role="sell">Tôi bán</button>
        <button type="button" class="${form.role === 'buy' ? 'current buy' : ''}" data-ct-role="buy">Tôi mua</button>
      </div>
      <label>Mặt hàng
        <span class="contract-pick"><span class="contract-icon small">${comIcon(form.commodity)}</span>
        <select name="commodity">${Object.entries(commodities).map(([id, k]) => `
          <option value="${esc(id)}" ${id === form.commodity ? 'selected' : ''}>${hasAtlasIcon(id) ? '' : `${k.icon} `}${esc(k.name)} · ${fmt(data.prices[id] ?? 0)} 🪙/lô</option>`).join('')}
        </select></span>
      </label>
      <div class="contract-form-row">
        <label>Lô mỗi đêm <input name="lots" type="number" min="1" max="${rules.maxLots}" step="1" value="${esc(form.lots)}" required /></label>
        <label>Số ngày <input name="days" type="number" min="${rules.days[0]}" max="${rules.days[1]}" step="1" value="${esc(form.days)}" required /></label>
      </div>
      <label>Giá mỗi lô (xu)
        <input name="price" type="number" min="${lo}" max="${hi}" step="1" value="${esc(form.price)}" required />
      </label>
      <div class="quick">
        ${chip(`Giá Sàn ${fmt(market)}`, market)}
        ${chip('−10%', Math.max(lo, Math.round(market * 0.9)))}
        ${chip('+10%', Math.min(hi, Math.round(market * 1.1)))}
      </div>
      <small class="muted">Cho phép ${fmt(lo)}–${fmt(hi)} xu (${pct(rules.band[0], 0, false)}–${pct(rules.band[1], 0, false)} giá Sàn). Đề xuất hết hạn sau ${rules.proposalHours} giờ.</small>
      <div class="contract-preview">${previewHtml()}</div>
      <button class="btn primary">📜 Gửi đề xuất</button>
    </form>`;
  }

  function helpHtml() {
    return `<details class="card pb-help" data-help ${ui.help ? 'open' : ''}>
      <summary>❓ Hợp đồng hoạt động thế nào?</summary>
      <ul>
        <li>Mỗi <b>nửa đêm</b>, hàng tự đi từ kho bên bán sang kho bên mua, tiền đi ngược lại theo giá đã chốt — giá Sàn lên xuống cũng không đổi.</li>
        <li><b>Ký quỹ</b>: bên mua giữ tiền hàng một đêm, bên bán giữ ${pct(rules.sellerEscrow, 0, false)} tổng giá trị. Hết hợp đồng thì ai về nhà nấy.</li>
        <li><b>Giao thiếu</b>: mỗi lô thiếu, bên bán bồi thường phần giá Sàn cao hơn giá hợp đồng (nếu có) cộng ${pct(rules.shortfallExtra, 0, false)} giá hợp đồng.
          Kho bên mua đầy thì phần không vào được không tính là thiếu.</li>
        <li>Ngày nào giao và trả đủ, <b>cả hai +${dayPts} điểm tín dụng</b>.</li>
        <li><b>Phá hợp đồng</b>: bên phá bồi thường cho bên kia ${pct(breakShare(), 0, false)} giá trị phần còn lại (lấy từ ký quỹ, tối đa bằng ký quỹ), phần ký quỹ dư về ví, và mất ${brokenPts} điểm tín dụng.
          Bên mua không đủ tiền nhận hàng, hoặc bên bán không đủ tiền bồi thường giao thiếu, cũng bị tính là phá.</li>
        <li>Mỗi người tối đa ${rules.maxOpen} hợp đồng đang mở (kể cả đề xuất chờ trả lời).</li>
      </ul>
    </details>`;
  }

  function section(title, body, cls = '') {
    return `<section class="card contract-box ${cls}"><h3>${title}</h3>${body}</section>`;
  }

  function draw() {
    const list = data.contracts;
    const incoming = list.filter((c) => c.status === 'proposed' && !c.proposedByMe);
    const outgoing = list.filter((c) => c.status === 'proposed' && c.proposedByMe);
    const active = list.filter((c) => c.status === 'active');
    const past = list.filter((c) => !['proposed', 'active'].includes(c.status));
    const open = incoming.length + outgoing.length + active.length;
    const held = [...outgoing, ...active].reduce((s, c) => s + c.myEscrow, 0);
    view.innerHTML = `
      <section class="card contract-summary">
        <div class="cb-stats">
          <div><span class="muted">Đang chạy</span><b>${active.length}</b></div>
          <div><span class="muted">Lời mời đến</span><b class="${incoming.length ? 'up' : ''}">${incoming.length}</b></div>
          <div><span class="muted">Đang mở</span><b>${open}/${rules.maxOpen}</b></div>
          <div><span class="muted">Bạn đang ký quỹ</span><b>${fmt(held)} 🪙</b></div>
        </div>
      </section>
      <div class="contract-grid">
        <div class="contract-main">
          ${incoming.length ? section('📨 Lời mời gửi tới bạn', incoming.map(incomingCard).join(''), 'highlight') : ''}
          ${section('🤝 Đang chạy', active.length ? active.map(activeCard).join('')
            : '<p class="muted">Chưa có hợp đồng nào đang chạy. Gửi đề xuất cho một người trồng, chủ xưởng hay đầu bếp để có hàng hoặc đầu ra ổn định.</p>')}
          ${outgoing.length ? section('📤 Đề xuất bạn đã gửi', outgoing.map(outgoingCard).join('')) : ''}
          ${past.length ? section('🗂️ Gần đây', `<ul class="pb-list">${past.map(pastRow).join('')}</ul>`) : ''}
        </div>
        <div class="contract-side">
          ${section('✍️ Đề xuất hợp đồng mới', `<div class="contract-form-slot">${formHtml()}</div>`)}
          ${helpHtml()}
        </div>
      </div>`;
  }

  function drawForm() {
    const slot = view.querySelector('.contract-form-slot');
    if (slot) slot.innerHTML = formHtml();
  }

  async function load() {
    const [d, f] = await Promise.all([api('/contracts'), api('/friends').catch(() => null)]);
    if (!view.isConnected) return;
    data = d;
    rules = { ...ctx.catalog.contracts, ...d.rules };
    if (f?.friends) friends = f.friends.map((x) => x.username);
    if (!commodities[form.commodity]) form.commodity = Object.keys(commodities)[0];
    if (!form.price) form.price = String(data.prices[form.commodity] ?? '');
    draw();
  }

  page.addEventListener('toggle', (e) => {
    if (e.target.matches?.('[data-help]')) ui.help = e.target.open;
  }, true);

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !data) return;
    const d = btn.dataset;
    const find = (id) => data.contracts.find((c) => c.id === Number(id));
    if (d.ctRole) {
      form.role = d.ctRole;
      drawForm();
    } else if (d.ctPrice) {
      form.price = d.ctPrice;
      drawForm();
    } else if (d.ctAccept) {
      const c = find(d.ctAccept);
      const need = escrowFor(c.role, c.lots, c.price, c.days);
      if (confirm(`Nhận hợp đồng #${c.id} với ${c.partner}?\nBạn ký quỹ ${fmt(need)} 🪙 ngay. Lượt giao đầu tiên vào nửa đêm nay.\nPhá giữa chừng sẽ mất bồi thường và ${brokenPts} điểm tín dụng.`)) {
        ctx.act(`/contracts/${c.id}/accept`);
      }
    } else if (d.ctDecline) {
      ctx.act(`/contracts/${d.ctDecline}/decline`);
    } else if (d.ctWithdraw) {
      ctx.act(`/contracts/${d.ctWithdraw}/decline`);
    } else if (d.ctBreak) {
      const c = find(d.ctBreak);
      const comp = breakComp(c);
      if (confirm(`Phá hợp đồng #${c.id} với ${c.partner}?\n• Bồi thường cho ${c.partner}: ${fmt(comp)} 🪙 (${pct(breakShare(), 0, false)} giá trị ${c.daysLeft} ngày còn lại, lấy từ ký quỹ)\n• Ký quỹ còn lại về ví: ${fmt(c.myEscrow - comp)} 🪙\n• Mất ${brokenPts} điểm tín dụng`)) {
        ctx.act(`/contracts/${c.id}/break`);
      }
    }
  });

  page.addEventListener('input', (e) => {
    const f = e.target.closest('[data-ct-form]');
    if (!f || !(e.target.name in form)) return;
    form[e.target.name] = e.target.value;
    if (e.target.name === 'commodity') {
      form.price = String(data.prices[form.commodity] ?? '');
      drawForm();
      return;
    }
    f.querySelector('.contract-preview').innerHTML = previewHtml();
  });

  page.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-ct-form]')) return;
    e.preventDefault();
    ctx.act('/contracts', {
      counterpart: form.counterpart.trim(),
      role: form.role,
      commodity: form.commodity,
      lots: int(form.lots),
      price: int(form.price),
      days: int(form.days),
    }, { onResult: () => { form.counterpart = ''; } });
  });

  load().then(() => {
    if (stopped || !view.isConnected) return;
    timer = setInterval(() => {
      for (const el of view.querySelectorAll('[data-until]')) el.textContent = countdown(Number(el.dataset.until) - Date.now());
    }, 1000);
    poll = setInterval(() => {
      if (document.visibilityState === 'visible' && !page.contains(document.activeElement?.closest('input, select, textarea'))) load().catch(() => {});
    }, 60_000);
  }).catch(ctx.fail);
  return () => {
    stopped = true;
    clearInterval(timer);
    clearInterval(poll);
  };
}
