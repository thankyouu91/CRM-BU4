// Khu công nghiệp: xây xưởng chế biến, cho bé đứng máy, nhận gia công thuê và gửi hàng nhờ xưởng người khác.
import { api } from '../api.js';
import { barChart } from '../charts.js';
import { countdown, esc, fmt, fmtLots, pct, viewHead } from '../ui.js';

/** Lựa chọn của người chơi giữ nguyên qua các lần vẽ lại. */
const ui = { orderFor: null, batches: '10', help: false };

const HOUR = 3600_000;
/** Ngày theo giờ Việt Nam ('2026-10-29'), khớp với `day` trong số liệu 7 ngày. */
const todayKey = () => new Date(Date.now() + 7 * HOUR).toISOString().slice(0, 10);

export function renderFactory(root, ctx) {
  const { commodities, factory: rules, unlocks } = ctx.catalog;
  const lot = ctx.catalog.market?.lot ?? 10;
  const biz = ctx.catalog.business?.rules ?? {};
  const wageMin = biz.wageMin ?? 8;
  const wageMax = biz.wageMax ?? 80;
  const unpaidLimit = biz.unpaidLimit ?? 3;
  const evicted = Math.abs(ctx.catalog.credit?.evicted ?? 40);

  root.innerHTML = `<div class="pb-page factory-page">
    ${viewHead('🏭 Khu công nghiệp', 'Biến hàng thô thành hàng chế biến: xây xưởng, cho bé đứng máy, nhận gia công thuê.',
      `<div class="pb-links">
        <button class="btn small" data-go="contracts">📜 Hợp đồng</button>
        <button class="btn small" data-go="market">📈 Sàn</button>
      </div>`)}
    <div class="factory-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.factory-page');
  const view = page.querySelector('.factory-view');
  if (ctx.bestLevel() < unlocks.market) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Khu công nghiệp chưa mở</h2>
      <p class="muted">Có một bé đạt cấp ${unlocks.market} là gửi hàng gia công được, cấp ${unlocks.factory} là tự xây xưởng.</p></section>`;
    return;
  }
  const canBuild = ctx.bestLevel() >= unlocks.factory;
  let data = null;
  let timer = 0;
  let poll = 0;
  let stopped = false;
  let lastLoad = 0;

  const com = (c) => commodities[c] ?? { name: c, icon: '📦', base: 0 };
  const spec = (s) => Object.entries(s).map(([c, n]) => `${n} lô ${com(c).icon} ${com(c).name}`).join(' + ');
  const shortSpec = (s) => Object.entries(s).map(([c, n]) => `${n} ${com(c).icon}`).join(' + ');
  const have = (c) => data.goods[c] ?? 0;
  /** Số mẻ làm được với hàng trong kho của mình. */
  const maxBatches = (input) => Math.min(...Object.entries(input).map(([c, n]) => Math.floor(have(c) / (n * lot))));
  const perHour = (kind, level) => data.kinds[kind].perHour + level * rules.perLevel;
  const index = () => ctx.me.economy?.priceIndex ?? 1;
  /** Lời gộp mỗi mẻ theo giá gốc (chỉ để tham khảo, giá Sàn thực tế lên xuống). */
  const margin = (def) => {
    const value = (s) => Object.entries(s).reduce((sum, [c, n]) => sum + n * com(c).base, 0) * index();
    return value(def.output) - value(def.input);
  };
  const until = (ts, reload = false) => `<span data-until="${ts}"${reload ? ' data-reload' : ''}>${countdown(ts - Date.now())}</span>`;

  function helpHtml() {
    return `<details class="card pb-help" data-help ${ui.help ? 'open' : ''}>
      <summary>❓ Xưởng chạy thế nào?</summary>
      <ul>
        <li>Xưởng <b>chỉ chạy khi có bé đứng máy</b>. Bé nhà mình đứng máy không lương (nhận ca ở Trung tâm việc làm); cần thêm người thì đăng tin tuyển công nhân.</li>
        <li>Mỗi giờ làm <b>(công suất gốc + ${rules.perLevel} × cấp)</b> mẻ, thêm tới ${pct(rules.skillBoost, 0, false)} theo Sức mạnh và Khéo tay của bé giỏi nhất đang đứng máy.</li>
        <li><b>Đơn gia công thuê làm trước</b>, xong mới tới nguyên liệu trong kho của bạn. Thành phẩm vào thẳng kho Sàn.</li>
        <li>Tiền thuê đất trừ <b>mỗi đêm</b>. Ví không đủ ${unpaidLimit} đêm liền thì xưởng bị đóng và bạn mất ${evicted} điểm tín dụng.</li>
        <li>Muốn nguồn hàng đều đặn hoặc chỗ bán chắc chắn? Ký <b>hợp đồng cung ứng</b> với người trồng và người nấu.</li>
      </ul>
    </details>`;
  }

  function dutyHtml(f) {
    const now = Date.now();
    if (!f.duty.length) return '<p class="muted small">Chưa có bé nào đứng máy, xưởng đang nghỉ.</p>';
    return `<ul class="pb-list">${f.duty.map((d) => `
      <li><span><b>${esc(d.petName)}</b> <small class="muted">${d.own ? 'bé nhà mình' : `của ${esc(d.owner)}`}</small></span>
        <small class="countdown">${d.startsAt > now ? `vào ca sau ${until(d.startsAt, true)}` : `còn ${until(d.endsAt, true)}`}</small></li>`).join('')}</ul>`;
  }

  function queueHtml(f) {
    if (!f.queue.length) return '<p class="muted small">Chưa có đơn gia công nào.</p>';
    return `<ul class="pb-list">${f.queue.map((o) => `
      <li class="factory-progress">
        <span><b>${esc(o.user)}</b> <small class="muted">${o.done}/${o.batches} mẻ · ${fmt(o.fee)} 🪙/mẻ</small></span>
        <div class="bar xp"><i style="width:${Math.round((o.done / Math.max(1, o.batches)) * 100)}%"></i></div>
      </li>`).join('')}</ul>`;
  }

  function daysHtml(f) {
    if (!f.days.length) return '<p class="muted small">Chưa có số liệu. Cho bé đứng máy để xưởng bắt đầu chạy.</p>';
    return `<div class="factory-chart" data-chart="${f.id}"></div>
      <p class="legend-inline"><i style="background:#58b98d"></i> Thu gia công <i style="background:#ef8a7a"></i> Thuê đất + lương</p>
      <div class="table-wrap"><table class="factory-table">
        <thead><tr><th>Ngày</th><th class="num">Mẻ nhà</th><th class="num">Mẻ thuê</th><th class="num">Thu GC</th><th class="num">Thuê</th><th class="num">Lương</th></tr></thead>
        <tbody>${f.days.slice().reverse().map((d) => `<tr><td>${esc(String(d.day).slice(5))}</td>
          <td class="num">${fmt(d.batches)}</td><td class="num">${fmt(d.toll_batches)}</td><td class="num up">${fmt(d.toll_income)}</td>
          <td class="num">${fmt(d.rent)}</td><td class="num">${fmt(d.wages)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  function factoryCard(f) {
    const def = data.kinds[f.kind];
    const now = Date.now();
    const working = f.duty.some((d) => d.startsAt <= now && d.endsAt > now);
    const today = f.days.find((d) => d.day === todayKey()) ?? { batches: 0, toll_batches: 0, toll_income: 0 };
    const rate = perHour(f.kind, f.level);
    const post = f.jobPost;
    const [inC] = Object.keys(def.input);
    const [outC] = Object.keys(def.output);
    return `
      <section class="card factory-card">
        <header class="factory-head">
          <span class="factory-icon">${def.icon}</span>
          <div>
            <h3>${esc(def.name)} <span class="badge level">cấp ${f.level + 1}</span></h3>
            <small class="muted">${spec(def.input)} → ${spec(def.output)}</small>
          </div>
          <span class="badge ${working ? 'star' : ''}">${working ? '🟢 Đang chạy' : '⚪ Đang nghỉ'}</span>
        </header>
        ${f.unpaidDays ? `<p class="pb-warn">⚠️ Nợ tiền thuê đất ${f.unpaidDays} đêm. Nợ ${unpaidLimit} đêm liền xưởng sẽ bị đóng (−${evicted} điểm tín dụng) — nhớ để đủ ${fmt(f.rent)} 🪙 trong ví trước nửa đêm.</p>` : ''}
        <div class="cb-stats">
          <div><span class="muted">Công suất</span><b>${rate}–${fmt(Math.floor(rate * (1 + rules.skillBoost)))}</b><small class="muted">mẻ/giờ</small></div>
          <div><span class="muted">Kho đủ cho</span><b class="${f.canRun ? '' : 'down'}">${fmt(f.canRun)} mẻ</b><small class="muted">${com(inC).icon} ${fmtLots(have(inC))} lô</small></div>
          <div><span class="muted">Hôm nay</span><b>${fmt(today.batches + today.toll_batches)} mẻ</b><small class="muted">${com(outC).icon} kho ${fmtLots(have(outC))} lô</small></div>
          <div><span class="muted">Thuê đất</span><b>${fmt(f.rent)} 🪙</b><small class="muted">mỗi đêm</small></div>
        </div>
        ${f.canRun ? '' : `<p class="pb-note">Hết ${com(inC).icon} ${esc(com(inC).name)} trong kho: mua thêm ở Sàn hoặc ký hợp đồng để có hàng về mỗi đêm.</p>`}

        <div class="factory-block">
          <div class="row-between"><h4>🧑‍🏭 Đứng máy</h4><button class="btn small gold" data-go="jobs">Cho bé đứng máy</button></div>
          ${dutyHtml(f)}
        </div>

        <div class="factory-block">
          <div class="row-between">
            <div><h4>⬆️ Nâng cấp</h4><small class="muted">${f.nextUpgrade === null ? 'Xưởng đã ở cấp cao nhất.' : `Lên cấp ${f.level + 2}: +${rules.perLevel} mẻ/giờ`}</small></div>
            ${f.nextUpgrade === null ? '<span class="badge star">Tối đa</span>'
              : `<button class="btn small" data-fx-upgrade="${f.id}" ${ctx.me.user.coins < f.nextUpgrade ? 'disabled title="Chưa đủ xu"' : ''}>${fmt(f.nextUpgrade)} 🪙</button>`}
          </div>
        </div>

        <div class="factory-block">
          <h4>🤝 Nhận gia công thuê</h4>
          <form class="job-form" data-fx-toll="${f.id}">
            <label>Phí/mẻ <input name="fee" type="number" min="0" max="${rules.maxTollFee}" step="1" value="${f.tollFee}" required /></label>
            <label class="check"><input name="open" type="checkbox" ${f.tollOpen ? 'checked' : ''} /> Đang nhận</label>
            <button class="btn small">Lưu</button>
          </form>
          <small class="muted">Phí 0–${rules.maxTollFee} 🪙/mẻ. Khách gửi nguyên liệu tới, xưởng làm đơn của khách trước, xong mẻ nào nhận phí mẻ đó.</small>
          ${queueHtml(f)}
        </div>

        <div class="factory-block">
          <h4>📋 Tuyển công nhân</h4>
          <form class="job-form" data-fx-jobs="${f.id}">
            <label>Lương/giờ <input name="wage" type="number" min="${wageMin}" max="${wageMax}" step="1" value="${post?.wage ?? 15}" required /></label>
            <label>Số người <input name="slots" type="number" min="1" max="3" step="1" value="${post?.slots ?? 1}" required /></label>
            <label class="check"><input name="open" type="checkbox" ${post?.open ? 'checked' : ''} /> Đang tuyển</label>
            <button class="btn small">Lưu tin</button>
          </form>
          <small class="muted">Lương ${wageMin}–${wageMax} 🪙/giờ, trừ khỏi ví bạn ngay khi bé người khác vào ca.</small>
        </div>

        <div class="factory-block">
          <h4>📊 7 ngày gần nhất</h4>
          ${daysHtml(f)}
        </div>
        <button class="link-btn danger" data-fx-close="${f.id}" ${f.queue.length ? 'disabled title="Còn đơn gia công đang chờ"' : ''}>Đóng xưởng</button>
      </section>`;
  }

  function buildHtml() {
    const n = data.factories.length;
    if (n >= data.max) return '';
    const rent = Math.max(1, Math.round(rules.landRent * index()));
    const body = canBuild
      ? `<div class="factory-kinds">${Object.entries(data.kinds).map(([kind, def]) => {
        const m = margin(def);
        return `<article class="factory-kind">
          <span class="factory-icon">${def.icon}</span>
          <h4>${esc(def.name)}</h4>
          <p class="factory-recipe">${shortSpec(def.input)} → ${shortSpec(def.output)}<br><small class="muted">${spec(def.input)} thành ${spec(def.output)}</small></p>
          <ul class="factory-facts">
            <li><span>Công suất</span><b>${def.perHour} mẻ/giờ</b></li>
            <li><span>Thuê đất</span><b>${fmt(rent)} 🪙/đêm</b></li>
            <li><span>Lời gộp/mẻ</span><b class="${m >= 0 ? 'up' : 'down'}">≈ ${m >= 0 ? '+' : ''}${fmt(m)} 🪙</b></li>
            <li><span>Kho đủ cho</span><b>${fmt(maxBatches(def.input))} mẻ</b></li>
          </ul>
          <button class="btn primary" data-fx-build="${kind}" ${ctx.me.user.coins < def.build ? 'disabled title="Chưa đủ xu"' : ''}>Xây · ${fmt(def.build)} 🪙</button>
        </article>`;
      }).join('')}</div>
      <p class="muted small">Lời gộp tính theo giá gốc của hàng, chưa trừ thuê đất và lương; giá Sàn thực tế lên xuống mỗi 10 phút.</p>`
      : `<p class="locked-note">🔒 Có một bé đạt cấp ${unlocks.factory} là xây được xưởng. Trong lúc chờ, bạn vẫn gửi hàng nhờ xưởng người khác gia công được ở bên dưới.</p>`;
    return `<section class="card factory-build">
      <h3>🏗️ Xây xưởng mới <small class="muted">(${n}/${data.max})</small></h3>
      ${body}
    </section>`;
  }

  function orderPreview(o) {
    const def = data.kinds[o.kind];
    const n = Math.floor(Number(ui.batches)) || 0;
    const valid = n >= 1 && n <= 100;
    const lines = Object.entries(def.input).map(([c, lots]) => {
      const need = lots * n;
      const ok = have(c) >= need * lot;
      return `<li class="${ok ? '' : 'down'}"><span>${com(c).icon} Cần ${fmt(need)} lô ${esc(com(c).name)}</span><b>kho ${fmtLots(have(c))} lô</b></li>`;
    });
    const fee = o.fee * n;
    lines.push(`<li class="${ctx.me.user.coins >= fee ? '' : 'down'}"><span>🪙 Phí giữ trước ${n} × ${fmt(o.fee)}</span><b>${fmt(fee)} 🪙</b></li>`);
    lines.push(`<li><span>📦 Nhận về kho</span><b>${Object.entries(def.output).map(([c, lots]) => `${fmt(lots * n)} lô ${com(c).icon}`).join(' + ')}</b></li>`);
    const enough = valid && Object.entries(def.input).every(([c, lots]) => have(c) >= lots * n * lot) && ctx.me.user.coins >= fee;
    return { html: `${valid ? '' : '<p class="down small">Số mẻ từ 1 đến 100.</p>'}<ul class="pb-list">${lines.join('')}</ul>`, enough };
  }

  function offerHtml(o) {
    const def = data.kinds[o.kind];
    const open = ui.orderFor === o.id;
    const most = Math.min(100, maxBatches(def.input));
    const preview = open ? orderPreview(o) : null;
    return `<li class="factory-offer ${open ? 'open' : ''}">
      <div class="factory-offer-head">
        <span class="factory-icon small">${def.icon}</span>
        <div><b>${esc(o.name)}</b> <span class="badge">cấp ${o.level + 1}</span><br>
          <small class="muted">của ${esc(o.owner)} · ${shortSpec(def.input)} → ${shortSpec(def.output)}</small></div>
        <div class="factory-fee"><b>${fmt(o.fee)} 🪙</b><small class="muted">/mẻ</small></div>
        <button class="btn small ${open ? '' : 'mint'}" data-fx-pick="${o.id}">${open ? 'Đóng' : 'Gửi hàng'}</button>
      </div>
      ${open ? `<form class="factory-order" data-fx-order="${o.id}">
        <label>Số mẻ <input name="batches" type="number" min="1" max="100" step="1" value="${esc(ui.batches)}" required /></label>
        <div class="quick">
          ${[1, 5, 10].map((n) => `<button type="button" class="chip" data-fx-batches="${n}">${n} mẻ</button>`).join('')}
          ${most > 0 ? `<button type="button" class="chip" data-fx-batches="${most}">Hết hàng trong kho (${most})</button>` : ''}
        </div>
        <div class="factory-order-preview">${preview.html}</div>
        <button class="btn mint" ${preview.enough ? '' : 'disabled'}>Gửi nguyên liệu</button>
      </form>` : ''}
    </li>`;
  }

  function tollHtml() {
    const mine = data.myTolls.length ? `<h4>Đơn của bạn</h4><ul class="pb-list">${data.myTolls.map((o) => {
      const def = data.kinds[o.kind] ?? { icon: '🏭' };
      return `<li class="factory-mytoll">
        <span class="factory-icon small">${def.icon}</span>
        <div><b>${esc(o.name)}</b> <small class="muted">của ${esc(o.owner)} · ${fmt(o.fee)} 🪙/mẻ</small>
          <div class="bar xp"><i style="width:${Math.round((o.done / Math.max(1, o.batches)) * 100)}%"></i></div>
          <small class="muted">${o.done}/${o.batches} mẻ xong${o.fee ? ` · còn giữ phí ${fmt((o.batches - o.done) * o.fee)} 🪙` : ''}</small></div>
        <button class="btn small" data-fx-cancel="${o.id}" data-left="${o.batches - o.done}">Hủy</button>
      </li>`;
    }).join('')}</ul>` : '';
    const offers = data.tollOffers.length
      ? `<ul class="pb-list factory-offers">${data.tollOffers.map(offerHtml).join('')}</ul>`
      : '<p class="muted">Hiện chưa có xưởng nào của người khác nhận gia công.</p>';
    return `<section class="card factory-toll">
      <h3>🔁 Gia công thuê</h3>
      <p class="muted small">Không có xưởng, hoặc xưởng mình bận? Gửi nguyên liệu nhờ xưởng người khác chế biến. Nguyên liệu rời kho ngay, phí giữ trước;
        xưởng làm xong mẻ nào thì thành phẩm về kho bạn mẻ đó. Hủy đơn thì nhận lại nguyên liệu và phí của phần chưa làm.</p>
      <p class="pb-note">📦 Nhớ chừa chỗ trống trong kho Sàn: kho đầy thì xưởng tạm dừng đơn của bạn, có chỗ trống mới làm tiếp.</p>
      ${mine}
      <h4>Xưởng đang nhận gia công</h4>
      ${offers}
    </section>`;
  }

  /** Ô thống kê nhỏ góc trên bên phải: tổng quan các xưởng của mình. */
  function statsHtml() {
    const now = Date.now();
    const mine = data.factories;
    const running = mine.filter((f) => f.duty.some((d) => d.startsAt <= now && d.endsAt > now)).length;
    const today = mine.reduce((sum, f) => {
      const d = f.days.find((x) => x.day === todayKey());
      return sum + (d ? d.batches + d.toll_batches : 0);
    }, 0);
    const rent = mine.reduce((sum, f) => sum + f.rent, 0);
    const queued = mine.reduce((sum, f) => sum + f.queue.reduce((n, o) => n + o.batches - o.done, 0), 0);
    return `<section class="card factory-stats">
      <h4>📊 Tổng quan</h4>
      <dl>
        <div><dt>Xưởng</dt><dd>${fmt(mine.length)}/${fmt(data.max)}</dd></div>
        <div><dt>Đang chạy</dt><dd class="${running ? 'up' : ''}">${fmt(running)}</dd></div>
        <div><dt>Mẻ hôm nay</dt><dd>${fmt(today)}</dd></div>
        <div><dt>Đơn thuê chờ</dt><dd>${fmt(queued)} mẻ</dd></div>
        <div><dt>Thuê đất/đêm</dt><dd>${fmt(rent)} 🪙</dd></div>
      </dl>
    </section>`;
  }

  /** Tồn kho: nguyên liệu và thành phẩm của các xưởng mình lên đầu, kèm số mẻ đủ chạy; sức chứa kho chung với Sàn. */
  function stockHtml() {
    const wh = data.warehouse;
    const used = wh.used + wh.reserved;
    const inputs = new Map();
    const outputs = new Set();
    for (const f of data.factories) {
      const def = data.kinds[f.kind];
      for (const [c, n] of Object.entries(def.input)) inputs.set(c, Math.max(inputs.get(c) ?? 0, n * lot));
      for (const c of Object.keys(def.output)) outputs.add(c);
    }
    const role = (c) => (inputs.has(c) ? 0 : outputs.has(c) ? 1 : 2);
    const held = Object.entries(data.goods).filter(([, q]) => q > 0);
    for (const c of [...inputs.keys(), ...outputs]) if (!held.some(([x]) => x === c)) held.push([c, 0]);
    held.sort((a, b) => role(a[0]) - role(b[0]) || b[1] - a[1]);
    const tag = (c) => (inputs.has(c) ? '<span class="badge">nguyên liệu</span>' : outputs.has(c) ? '<span class="badge star">thành phẩm</span>' : '');
    const enough = (c, q) => (inputs.has(c) ? `<small class="${q >= inputs.get(c) ? 'muted' : 'down'}">đủ ${fmt(Math.floor(q / inputs.get(c)))} mẻ</small>` : '');
    return `<section class="card factory-stock">
      <div class="row-between"><h4>📦 Tồn kho</h4><button class="btn small" data-go="market">Sàn</button></div>
      <div class="factory-wh">
        <span>Kho ${fmtLots(used)}/${fmtLots(wh.capacity)} lô${wh.reserved ? ` <small class="muted">(giữ chỗ ${fmtLots(wh.reserved)})</small>` : ''}</span>
        <div class="bar energy"><i style="width:${Math.min(100, (used / Math.max(1, wh.capacity)) * 100)}%"></i></div>
      </div>
      ${held.length ? `<ul class="factory-stock-list">${held.map(([c, q]) => `
        <li class="${q ? '' : 'empty-row'}">
          <span class="factory-stock-name">${com(c).icon} ${esc(com(c).name)} ${tag(c)}</span>
          <span class="factory-stock-qty"><b>${fmtLots(q)} lô</b>${enough(c, q)}</span>
        </li>`).join('')}</ul>` : '<p class="muted small">Kho đang trống. Mua nguyên liệu ở Sàn hoặc ký hợp đồng cung ứng.</p>'}
    </section>`;
  }

  function draw() {
    view.innerHTML = `
      ${helpHtml()}
      <div class="factory-layout">
        <div class="factory-main">${data.factories.map(factoryCard).join('') || (canBuild ? '<section class="card empty muted">Chưa có xưởng nào. Xây xưởng đầu tiên ở bên dưới.</section>' : '')}</div>
        <aside class="factory-side">${statsHtml()}${stockHtml()}</aside>
      </div>
      ${buildHtml()}
      ${tollHtml()}`;
    for (const f of data.factories) {
      const host = view.querySelector(`[data-chart="${f.id}"]`);
      if (host) barChart(host, f.days.map((d) => ({ income: d.toll_income, expense: d.rent + d.wages })), { height: 100 });
    }
  }

  async function load() {
    lastLoad = Date.now();
    const d = await api('/factory');
    if (!view.isConnected) return;
    data = d;
    if (ui.orderFor && !data.tollOffers.some((o) => o.id === ui.orderFor)) ui.orderFor = null;
    draw();
  }

  function updatePreview(form) {
    const o = data.tollOffers.find((x) => x.id === Number(form.dataset.fxOrder));
    if (!o) return;
    const p = orderPreview(o);
    form.querySelector('.factory-order-preview').innerHTML = p.html;
    form.querySelector('button:not([type="button"])').disabled = !p.enough;
  }

  page.addEventListener('toggle', (e) => {
    if (e.target.matches?.('[data-help]')) ui.help = e.target.open;
  }, true);

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !data) return;
    const d = btn.dataset;
    if (d.fxBuild) {
      const def = data.kinds[d.fxBuild];
      if (confirm(`Xây ${def.name} với giá ${fmt(def.build)} 🪙?\nTiền xây không được hoàn lại, mỗi đêm trừ tiền thuê đất.`)) ctx.act('/factory/build', { kind: d.fxBuild });
    } else if (d.fxUpgrade) {
      ctx.act(`/factory/${d.fxUpgrade}/upgrade`);
    } else if (d.fxClose) {
      const f = data.factories.find((x) => x.id === Number(d.fxClose));
      if (confirm(`Đóng ${data.kinds[f.kind].name}? Tiền xây và nâng cấp không được hoàn lại.`)) ctx.act(`/factory/${d.fxClose}/close`);
    } else if (d.fxPick) {
      const id = Number(d.fxPick);
      ui.orderFor = ui.orderFor === id ? null : id;
      draw();
      view.querySelector('.factory-order input')?.focus();
    } else if (d.fxBatches) {
      ui.batches = d.fxBatches;
      const form = btn.closest('form');
      form.querySelector('input[name="batches"]').value = ui.batches;
      updatePreview(form);
    } else if (d.fxCancel) {
      if (confirm(`Hủy đơn gia công? Bạn nhận lại nguyên liệu và phí của ${d.left} mẻ chưa làm.`)) ctx.act(`/factory/orders/${d.fxCancel}/cancel`);
    }
  });

  page.addEventListener('input', (e) => {
    const form = e.target.closest('[data-fx-order]');
    if (!form || e.target.name !== 'batches') return;
    ui.batches = e.target.value;
    updatePreview(form);
  });

  page.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = e.target;
    const form = new FormData(t);
    if (t.dataset.fxToll) {
      ctx.act(`/factory/${t.dataset.fxToll}/toll`, { fee: Number(form.get('fee')), open: form.get('open') === 'on' });
    } else if (t.dataset.fxJobs) {
      ctx.act(`/factory/${t.dataset.fxJobs}/jobs`, {
        wage: Number(form.get('wage')), slots: Number(form.get('slots')), open: form.get('open') === 'on',
      });
    } else if (t.dataset.fxOrder) {
      ctx.act(`/factory/${t.dataset.fxOrder}/order`, { batches: Number(form.get('batches')) }, {
        onResult: () => { ui.orderFor = null; },
      });
    }
  });

  load().then(() => {
    if (stopped || !view.isConnected) return;
    timer = setInterval(() => {
      for (const el of view.querySelectorAll('[data-until]')) {
        const left = Number(el.dataset.until) - Date.now();
        if (left <= 0 && el.hasAttribute('data-reload') && Date.now() - lastLoad > 15_000) {
          load().catch(() => {});
          return;
        }
        el.textContent = countdown(left);
      }
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
