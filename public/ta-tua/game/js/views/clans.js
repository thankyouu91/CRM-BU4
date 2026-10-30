// Gia tộc & Sở Nhà Đất: lập/gia nhập gia tộc, góp quỹ, thâu tóm ngành, bản đồ 200 lô đất có địa hình và khí hậu,
// xem trước sản lượng theo môi trường, lắp ghép công trình từ 200 mẫu (tối đa 20 mảnh), thuế doanh nghiệp và bản tin vĩ mô.
import { api } from '../api.js';
import { esc, fmt, pct, viewHead } from '../ui.js';
import {
  CLIMATES, DESIGN, INDUSTRIES, INDUSTRY_ORDER, LAND, PALETTE, PHASES, PIECES, PIECE_FAMILIES, PLOTS, WEATHER, ZONES,
  designBonus, designComplete, designCost, designSvg, envFactor, pieceById, pieceSvg, riverRow,
} from '../shared/clan.js';

const TABS = [
  { key: 'clan', label: '🏯 Gia tộc' },
  { key: 'map', label: '🗺️ Bản đồ đất' },
  { key: 'build', label: '🏗️ Xây dựng', needClan: true },
  { key: 'tax', label: '🧾 Thuế', needClan: true },
  { key: 'macro', label: '📊 Vĩ mô' },
];
const ROLE = { leader: '👑 Tộc trưởng', elder: '🎖️ Trưởng lão', member: 'Thành viên' };
const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));

/** Trạng thái giữ qua các lần vẽ lại (mỗi hành động thành công thì app vẽ lại cả màn). */
const ui = {
  tab: 'clan', plotId: null, industry: 'tea', heat: 'zone',
  emblem: null, color: '#c0392b',
  build: { plotId: null, design: null, family: 'base', piece: null, layer: null, color: '#e85d5d' },
};

const pctInt = (v) => `${Math.round(v * 100)}%`;
const signed = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const money = (n) => `${fmt(n)} 🪙`;

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * Math.min(1, Math.max(0, t)))));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const heatColor = (t) => (t < 0.5 ? lerpColor('#e8665a', '#f4d35e', t * 2) : lerpColor('#f4d35e', '#5fbf77', (t - 0.5) * 2));

export function renderClans(root, ctx) {
  root.innerHTML = `<div class="clan-page">
    ${viewHead('🏯 Gia tộc & Sở Nhà Đất', 'Lập gia tộc, góp quỹ, thâu tóm tối đa 3 ngành, mua đất và tự lắp ghép công trình.')}
    <nav class="clan-tabs"></nav>
    <div class="clan-body"><div class="empty muted">Đang tải…</div></div></div>`;
  const tabsEl = root.querySelector('.clan-tabs');
  const body = root.querySelector('.clan-body');
  let data = null;
  let land = null;
  let alive = true;

  const act = (path, payload = {}) => ctx.act(path, payload);

  function drawTabs() {
    const inClan = Boolean(data?.clan);
    tabsEl.innerHTML = TABS.filter((t) => !t.needClan || inClan)
      .map((t) => `<button class="btn small ${ui.tab === t.key ? 'current' : ''}" data-tab="${t.key}">${t.label}</button>`).join('');
  }

  function draw() {
    if (!alive || !data) return;
    if (!data.clan && (ui.tab === 'build' || ui.tab === 'tax')) ui.tab = 'clan';
    drawTabs();
    ({ clan: drawClan, map: drawMap, build: drawBuild, tax: drawTax, macro: drawMacro })[ui.tab]();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    ui.tab = btn.dataset.tab;
    draw();
  });

  Promise.all([api('/clans'), api('/land')]).then(([c, l]) => {
    data = c;
    land = l;
    draw();
  }).catch(ctx.fail);

  // ================================================================ gia tộc

  function drawClan() {
    if (!data.clan) return drawNoClan();
    const c = data.clan;
    const cfg = data.config;
    const xpSpan = c.xpNext ? (c.xp - c.xpFloor) / (c.xpNext - c.xpFloor) : 1;
    const leader = c.role === 'leader';
    const owned = new Set(c.industries.map((i) => i.id));
    const myWeek = c.members.find((m) => m.id === ctx.me.user.id)?.week ?? 0;
    body.innerHTML = `
      <div class="clan-grid">
        <section class="card clan-hero" style="--clan:${esc(c.color)}">
          <div class="clan-emblem">${esc(c.emblem)}</div>
          <div>
            <h3>${esc(c.name)} <span class="badge level">Cấp ${c.level}</span></h3>
            <p class="muted">${ROLE[c.role]} · ${c.members.length}/${c.perks.maxMembers} người · ${c.plots.length}/${c.perks.maxPlots} lô đất · thuế ${pctInt(c.taxRate)}</p>
            <div class="bar xp" title="${fmt(c.xp)} XP"><i style="width:${Math.round(xpSpan * 100)}%;background:var(--clan)"></i></div>
            <small class="muted">${c.xpNext ? `${fmt(c.xp)} / ${fmt(c.xpNext)} XP để lên cấp ${c.level + 1}` : 'Đã đạt cấp tối đa'} · sản lượng +${pctInt(c.perks.prodBonus)}</small>
          </div>
          <div class="clan-treasury"><small class="muted">Quỹ gia tộc</small><b>${money(c.treasury)}</b>
            <small class="muted">Phí duy trì ${money(c.upkeep)}/đêm</small></div>
        </section>

        <section class="card clan-box">
          <h3>💰 Góp quỹ tuần này</h3>
          <p class="muted small">Định mức mỗi thành viên: <b>${money(c.quota)}</b>/tuần (theo cấp gia tộc). Thiếu định mức thì gia tộc bị trừ kinh nghiệm vào cuối tuần. Cứ 10 xu góp được 1 XP.</p>
          <div class="bar"><i style="width:${Math.min(100, (myWeek / Math.max(1, c.quota)) * 100)}%;background:var(--gold)"></i></div>
          <small class="muted">Bạn đã góp ${money(myWeek)} tuần này</small>
          <form class="row" data-form="donate">
            <input name="amount" type="number" min="10" step="10" value="${Math.max(10, c.quota - myWeek)}" />
            <button class="btn gold">Góp quỹ</button>
          </form>
          ${leader ? `<form class="row" data-form="dividend">
            <input name="amount" type="number" min="1" placeholder="Tổng tiền chia" />
            <button class="btn mint">Chia cổ tức đều</button>
          </form>` : ''}
        </section>

        <section class="card clan-box">
          <h3>👥 Thành viên</h3>
          <ul class="clan-members">${c.members.map((m) => `
            <li class="${m.week >= c.quota ? '' : 'short'}">
              <span><b>${esc(m.username)}</b><small class="muted">${ROLE[m.role]} · góp tổng ${money(m.donated)}</small></span>
              <small class="${m.week >= c.quota ? 'ok' : 'warn'}">${fmt(m.week)}/${fmt(c.quota)}</small>
              ${leader && m.id !== ctx.me.user.id ? `<span class="row">
                <select data-role="${m.id}">
                  <option value="member" ${m.role === 'member' ? 'selected' : ''}>Thành viên</option>
                  <option value="elder" ${m.role === 'elder' ? 'selected' : ''}>Trưởng lão</option>
                  <option value="leader">Nhường tộc trưởng</option>
                </select>
                <button class="link-btn danger" data-kick="${m.id}">Mời ra</button></span>` : ''}
            </li>`).join('')}</ul>
          <button class="link-btn danger" data-leave>Rời gia tộc</button>
        </section>

        <section class="card clan-box wide">
          <h3>🏭 Thâu tóm ngành nghề (${c.industries.length}/3)</h3>
          <p class="muted small">Ngành đầu tiên trả <b>tiền bồi thường thị trường</b> 20.000–50.000 xu tùy mô hình. Mở rộng sang ngành thứ hai, thứ ba phải trả
            <b>gấp ${cfg.expandMultiplier} lần</b> mức gốc và thuế doanh nghiệp tăng ${pctInt(cfg.extraTaxPerIndustry)} mỗi ngành.
            ${c.nextIndustryLevel ? `Ngành tiếp theo cần gia tộc cấp ${c.nextIndustryLevel}.` : ''}</p>
          <div class="industry-grid">${INDUSTRY_ORDER.map((id) => {
            const ind = INDUSTRIES[id];
            const mine = owned.has(id);
            const rivals = (cfg.industryClans[id] ?? 0) - (mine ? 1 : 0);
            const fee = c.nextFees[id];
            const can = leader && !mine && c.industries.length < 3 && c.nextIndustryLevel && c.level >= c.nextIndustryLevel;
            return `<div class="industry ${mine ? 'held' : ''}">
              <span class="industry-icon">${ind.icon}</span>
              <b>${esc(ind.name)}</b>
              <small class="muted">${rivals ? `${rivals} gia tộc ${mine ? 'khác cùng ' : ''}đang nắm` : mine ? 'Chỉ gia tộc bạn nắm' : 'Chưa ai nắm'}</small>
              ${mine ? '<span class="badge star">Đã thâu tóm</span>'
                : `<button class="btn small ${can ? 'primary' : ''}" data-industry="${id}" ${can ? '' : 'disabled'}>Thâu tóm · ${money(fee)}</button>`}
            </div>`;
          }).join('')}</div>
        </section>

        <section class="card clan-box wide">
          <h3>🏘️ Đất của gia tộc</h3>
          ${c.plots.length ? `<table class="clan-table"><thead><tr><th>Lô</th><th>Địa hình</th><th>Ngành</th><th>Công trình</th><th class="num">Giá mua</th><th class="num">Giá trị</th><th class="num">Doanh thu/ngày</th><th></th></tr></thead>
            <tbody>${c.plots.map((p) => `<tr>
              <td><b>${p.code}</b></td>
              <td>${ZONES[p.zone].icon} ${ZONES[p.zone].name} · ${CLIMATES[p.climate].icon}</td>
              <td>${p.industry ? `${INDUSTRIES[p.industry].icon} ${esc(INDUSTRIES[p.industry].name)}` : '<span class="warn">Chưa chọn</span>'}</td>
              <td>${p.operating ? `✅ ${p.pieces} mảnh` : `<span class="warn">${p.pieces ? `${p.pieces} mảnh, chưa đủ` : 'Chưa xây'}</span>`}</td>
              <td class="num">${fmt(p.boughtPrice)}</td>
              <td class="num">${fmt(p.value)}</td>
              <td class="num">${p.operating ? fmt(p.estimate) : '–'}</td>
              <td><button class="btn small" data-open-plot="${p.id}">Xem</button></td>
            </tr>`).join('')}</tbody></table>`
            : '<p class="muted">Gia tộc chưa có lô đất nào. Mở <b>Bản đồ đất</b> để chọn lô hợp với ngành của mình.</p>'}
        </section>
      </div>`;
  }

  function drawNoClan() {
    const cfg = data.config;
    if (!ui.emblem) ui.emblem = cfg.emblems[0];
    const level = ctx.bestLevel();
    const locked = level < cfg.unlockLevel;
    body.innerHTML = `
      <div class="clan-grid">
        <section class="card clan-box wide clan-intro">
          <h3>Gia tộc là gì?</h3>
          <ul>
            <li>Một nhóm người chơi góp quỹ chung, lên cấp cùng nhau (cấp càng cao càng nhiều người, nhiều đất, sản lượng cao hơn).</li>
            <li>Thâu tóm tối đa <b>3 ngành nghề</b>. Ngành đầu trả tiền bồi thường thị trường 20.000–50.000 xu; ngành thứ hai, ba trả gấp ${cfg.expandMultiplier} lần.</li>
            <li>Mua đất trên bản đồ 200 lô (giá ${money(land?.stats.minPrice ?? LAND.minPrice)} – ${money(land?.stats.maxPrice ?? LAND.maxPrice)}, đất càng hiếm càng đắt), tự lắp ghép công trình rồi thu doanh thu mỗi đêm.</li>
            <li>Thuế doanh nghiệp ${pctInt(cfg.baseTax)} (+${pctInt(cfg.extraTaxPerIndustry)} mỗi ngành thêm). Cuối mỗi tháng được hoàn ${pctInt(cfg.refundRate)} tổng thuế đã đóng.</li>
          </ul>
        </section>
        <section class="card clan-box">
          <h3>✨ Lập gia tộc</h3>
          ${locked ? `<p class="warn">Cần một bé đạt cấp ${cfg.unlockLevel} để lập hoặc gia nhập gia tộc.</p>` : ''}
          <form class="clan-create" data-form="create">
            <input name="name" placeholder="Tên gia tộc (3–24 ký tự)" maxlength="24" required />
            <div class="emblem-row">${cfg.emblems.map((e) => `<button type="button" class="emblem ${e === ui.emblem ? 'current' : ''}" data-emblem="${e}">${e}</button>`).join('')}</div>
            <label class="row">Màu gia tộc <input type="color" name="color" value="${ui.color}" /></label>
            <button class="btn primary" ${locked ? 'disabled' : ''}>Lập gia tộc · ${money(cfg.createCost)}</button>
          </form>
        </section>
        <section class="card clan-box">
          <h3>🏯 Các gia tộc</h3>
          ${data.clans.length ? `<ul class="clan-list">${data.clans.map((x) => `
            <li style="--clan:${esc(x.color)}">
              <span class="clan-dot">${esc(x.emblem)}</span>
              <span><b>${esc(x.name)}</b> <small class="muted">Cấp ${x.level} · ${x.members}/${x.maxMembers} người · ${x.plots} lô</small>
                <small>${x.industries.map((i) => INDUSTRIES[i]?.icon ?? '').join(' ')}</small></span>
              <button class="btn small" data-join="${x.id}" ${locked || x.members >= x.maxMembers ? 'disabled' : ''}>Gia nhập</button>
            </li>`).join('')}</ul>` : '<p class="muted">Chưa có gia tộc nào. Hãy là người đầu tiên!</p>'}
        </section>
      </div>`;
  }

  // ================================================================ bản đồ đất

  const TW = 48;
  const TH = 40;
  const PAD = 6;

  function terrainDeco(p) {
    switch (p.zone) {
      case 'sea': return '<path d="M6 14 q5 -5 10 0 t10 0 t10 0 M10 28 q5 -5 10 0 t10 0" fill="none" stroke="#ffffffaa" stroke-width="2"/>';
      case 'coast': return '<path d="M0 34 q6 -4 12 0 t12 0 t12 0 t12 0 V40 H0Z" fill="#7cc3e8aa"/><circle cx="12" cy="12" r="2" fill="#e8c76b"/>';
      case 'hill': return '<path d="M4 34 L16 14 L28 34Z M20 34 L32 10 L44 34Z" fill="#8fae62"/><path d="M29 15 L32 10 L35 15Z" fill="#ffffffcc"/>';
      case 'forest': return '<path d="M8 32 L14 14 L20 32Z M20 34 L27 12 L34 34Z M32 31 L38 16 L44 31Z" fill="#4f8a4f"/>';
      case 'urban': return '<rect x="6" y="18" width="9" height="16" fill="#a9998a"/><rect x="18" y="10" width="10" height="24" fill="#b8a898"/><rect x="31" y="20" width="10" height="14" fill="#9d8d7e"/>';
      case 'river': return '<rect x="0" y="16" width="48" height="10" fill="#7cc3e8"/><path d="M6 21 h6 M22 20 h6 M36 22 h6" stroke="#ffffffaa" stroke-width="1.5"/>';
      default: return '<path d="M8 30 v-6 M14 32 v-7 M20 29 v-6 M28 31 v-7 M34 30 v-6 M40 32 v-7" stroke="#b4c46a" stroke-width="2"/>';
    }
  }

  function plotFill(p, info, range) {
    switch (ui.heat) {
      case 'climate': return { sunny: '#f7d774', rainy: '#8fb8de', temperate: '#b9dba0', windy: '#c9c4e8' }[p.climate];
      case 'price': {
        const v = info.price ?? info.value;
        return heatColor(1 - (v - range.min) / Math.max(1, range.max - range.min));
      }
      case 'growth': return heatColor(p.growth / LAND.maxGrowth);
      case 'fit': return heatColor((envFactor(ui.industry, p.zone, p.climate) - 0.4) / 1.0);
      default: return ZONES[p.zone].color;
    }
  }

  function mapSvg() {
    const infos = new Map(land.plots.map((x) => [x.id, x]));
    const values = land.plots.map((x) => x.price ?? x.value);
    const range = { min: Math.min(...values), max: Math.max(...values) };
    const W = LAND.cols * TW + PAD * 2;
    const H = LAND.rows * TH + PAD * 2;
    // Sông: nối tâm các ô ven sông rồi đổ ra biển.
    const river = Array.from({ length: 14 }, (_, c) => `${PAD + c * TW + TW / 2},${PAD + riverRow(c) * TH + TH / 2}`).join(' ');
    const tiles = PLOTS.map((p) => {
      const info = infos.get(p.id);
      const x = PAD + p.col * TW;
      const y = PAD + p.row * TH;
      const sel = ui.plotId === p.id;
      const owner = info.owner;
      const building = owner && info.design.length
        ? designSvg(info.design).replace('<svg ', '<svg x="3" y="2" width="42" height="35" ')
        : owner ? `<text x="24" y="27" text-anchor="middle" font-size="16">${esc(owner.emblem)}</text>` : '';
      const climate = ui.heat === 'climate' ? `<text x="44" y="37" text-anchor="end" font-size="11">${CLIMATES[p.climate].icon}</text>` : '';
      return `<g class="plot ${owner ? 'taken' : 'free'} ${info.mine ? 'mine' : ''} ${sel ? 'sel' : ''}" data-plot="${p.id}" transform="translate(${x} ${y})">
        <rect class="tile" width="${TW}" height="${TH}" fill="${plotFill(p, info, range)}"/>
        ${ui.heat === 'zone' ? terrainDeco(p) : ''}
        ${owner ? `<rect class="own" x="1.5" y="1.5" width="${TW - 3}" height="${TH - 3}" fill="#ffffff55" stroke="${esc(owner.color)}" stroke-width="3"/>` : ''}
        ${building}${climate}
        <text class="code" x="3" y="9">${p.code}</text>
        ${sel ? `<rect x="0.5" y="0.5" width="${TW - 1}" height="${TH - 1}" fill="none" stroke="#2b2d33" stroke-width="2" stroke-dasharray="4 2"/>` : ''}
      </g>`;
    }).join('');
    return `<svg class="land-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bản đồ 200 lô đất">
      <rect width="${W}" height="${H}" rx="10" fill="#e9dcc6"/>
      ${tiles}
      ${ui.heat === 'zone' ? `<polyline points="${river}" fill="none" stroke="#5aa9d6" stroke-width="4" stroke-linejoin="round" opacity=".55" pointer-events="none"/>` : ''}
    </svg>`;
  }

  function legend() {
    if (ui.heat === 'zone') return Object.values(ZONES).map((z) => `<span><i style="background:${z.color}"></i>${z.icon} ${z.name}</span>`).join('');
    if (ui.heat === 'climate') return Object.entries(CLIMATES).map(([k, c]) => `<span><i style="background:${{ sunny: '#f7d774', rainy: '#8fb8de', temperate: '#b9dba0', windy: '#c9c4e8' }[k]}"></i>${c.icon} ${c.name}</span>`).join('');
    const label = { price: ['Đắt', 'Rẻ'], growth: ['Tăng chậm', 'Tăng nhanh'], fit: ['Không hợp', 'Rất hợp'] }[ui.heat];
    return `<span>${label[0]}</span><span class="heat-scale"></span><span>${label[1]}</span>`;
  }

  function drawMap() {
    const s = land.stats;
    const m = land.macro;
    body.innerHTML = `
      <div class="land-layout">
        <section class="card land-main">
          <div class="land-stats">
            <span>🏘️ Còn <b>${s.free}</b>/${LAND.count} lô</span>
            <span>📈 Hệ số khan hiếm <b>×${s.scarcity.toFixed(2)}</b></span>
            <span>🏦 Chỉ số giá đất <b>${s.landIndex.toFixed(3)}</b></span>
            <span>${PHASES[m.phase].icon} ${PHASES[m.phase].name}</span>
            <span>${WEATHER[m.weather].icon} ${WEATHER[m.weather].name}</span>
          </div>
          <div class="land-tools">
            <label>Tô màu theo
              <select data-heat>
                ${[['zone', 'Địa hình'], ['climate', 'Khí hậu'], ['price', 'Giá đất'], ['growth', '% tăng giá'], ['fit', 'Độ hợp ngành']].map(([k, n]) => `<option value="${k}" ${ui.heat === k ? 'selected' : ''}>${n}</option>`).join('')}
              </select></label>
            <label ${ui.heat === 'fit' ? '' : 'hidden'}>Ngành
              <select data-fit>${INDUSTRY_ORDER.map((id) => `<option value="${id}" ${ui.industry === id ? 'selected' : ''}>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}</option>`).join('')}</select></label>
          </div>
          <div class="land-scroll">${mapSvg()}</div>
          <div class="land-legend">${legend()}</div>
        </section>
        <aside class="card land-panel">${plotPanel()}</aside>
      </div>`;
    if (ui.plotId) loadPreview();
  }

  function plotPanel() {
    if (!ui.plotId) {
      return `<h3>Chọn một lô đất</h3>
        <p class="muted">Chạm vào ô trên bản đồ để xem địa hình, khí hậu, giá, % tăng giá, tốc độ sản xuất và doanh thu ước tính theo từng ngành.</p>
        <p class="muted small">Đất đắt ở trung tâm, ven biển, ven sông có % tăng giá và tốc độ sản xuất cao hơn (tối đa 18%).
          Khi quỹ đất cạn, giá các lô còn lại tăng rất mạnh.</p>`;
    }
    const p = PLOT_BY_ID.get(ui.plotId);
    const info = land.plots.find((x) => x.id === p.id);
    const clan = data.clan;
    const canManage = clan && info.mine && (clan.role === 'leader' || clan.role === 'elder');
    const canBuy = clan && !info.owner && (clan.role === 'leader' || clan.role === 'elder');
    const myIndustries = clan ? clan.industries.map((i) => i.id) : [];
    if (info.mine && info.industry) ui.industry = info.industry;
    return `
      <div class="plot-head"><h3>Lô ${p.code}</h3>
        ${info.owner ? `<span class="owner-tag" style="--clan:${esc(info.owner.color)}">${esc(info.owner.emblem)} ${esc(info.owner.name)}</span>` : '<span class="badge star">Còn trống</span>'}</div>
      <div class="plot-env">
        <span>${ZONES[p.zone].icon} <b>${ZONES[p.zone].name}</b><small class="muted">${ZONES[p.zone].desc}</small></span>
        <span>${CLIMATES[p.climate].icon} <b>${CLIMATES[p.climate].name}</b></span>
      </div>
      <dl class="plot-facts">
        <dt>${info.owner ? 'Giá trị hiện tại' : 'Giá bán'}</dt><dd>${money(info.owner ? info.value : info.price)}</dd>
        <dt>Tăng giá mỗi tháng</dt><dd>+${pct(p.growth, 1, false)}</dd>
        <dt>Tốc độ sản xuất</dt><dd>+${pct(p.prod, 1, false)}</dd>
        ${info.industry ? `<dt>Ngành</dt><dd>${INDUSTRIES[info.industry].icon} ${esc(INDUSTRIES[info.industry].name)}</dd>` : ''}
      </dl>
      ${info.owner && info.design.length ? `<div class="plot-building">${designSvg(info.design, { background: '#f7efe1' })}</div>` : ''}
      <label class="plot-industry">Xem trước với ngành
        <select data-preview-industry>${INDUSTRY_ORDER.map((id) => `<option value="${id}" ${ui.industry === id ? 'selected' : ''}>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}${myIndustries.includes(id) ? ' ✓' : ''}</option>`).join('')}</select></label>
      <div class="plot-preview muted">Đang tính…</div>
      <div class="plot-actions">
        ${canBuy ? `<button class="btn primary" data-buy="${p.id}">Mua lô bằng quỹ · ${money(info.price)}</button>` : ''}
        ${canManage && myIndustries.includes(ui.industry) && info.industry !== ui.industry ? `<button class="btn mint" data-set-industry="${p.id}">Làm ngành này trên lô</button>` : ''}
        ${canManage ? `<button class="btn" data-build="${p.id}">🏗️ Lắp ghép công trình</button>` : ''}
        ${info.mine && clan.role === 'leader' ? `<button class="link-btn danger" data-sell="${p.id}">Bán lại cho Sở Nhà Đất (${pctInt(land.stats.resaleRate)} giá trị)</button>` : ''}
        ${!clan ? '<p class="muted small">Vào một gia tộc để mua đất.</p>' : ''}
      </div>`;
  }

  let previewSeq = 0;
  function loadPreview() {
    const box = body.querySelector('.plot-preview');
    if (!box) return;
    const seq = ++previewSeq;
    api(`/land/${ui.plotId}/preview?industry=${ui.industry}`).then((pv) => {
      if (!alive || seq !== previewSeq || !box.isConnected) return;
      const f = pv.factors;
      const row = (label, v) => `<li><span>${label}</span><b class="${v > 1.0001 ? 'up' : v < 0.9999 ? 'down' : ''}">${v === 1 ? '±0%' : signed(v - 1)}</b></li>`;
      box.classList.remove('muted');
      box.innerHTML = `
        <ul class="factor-list">
          <li><span>Sản lượng gốc của lô</span><b>${money(f.base)}/ngày</b></li>
          ${row('Tốc độ sản xuất của lô', f.prod)}
          <li><span>${ZONES[PLOT_BY_ID.get(ui.plotId).zone].icon} Địa hình với ngành</span><b class="${f.zone > 0 ? 'up' : f.zone < 0 ? 'down' : ''}">${signed(f.zone)}</b></li>
          <li><span>${CLIMATES[PLOT_BY_ID.get(ui.plotId).climate].icon} Khí hậu với ngành</span><b class="${f.climate > 0 ? 'up' : f.climate < 0 ? 'down' : ''}">${signed(f.climate)}</b></li>
          ${row(`${WEATHER[land.macro.weather].icon} Thời tiết hôm nay`, f.weather)}
          ${row(`${PHASES[land.macro.phase].icon} Chu kỳ kinh tế`, f.phase)}
          ${row('Cầu của ngành', f.demand)}
          ${row(`Cạnh tranh (${pv.clansInIndustry} gia tộc)`, f.competition)}
          ${row('Cấp gia tộc', f.level)}
          ${row('Công trình', f.building)}
        </ul>
        <p class="preview-total">≈ <b>${money(pv.revenue)}</b>/ngày · sau thuế ${pctInt(pv.taxRate)}: <b>${money(pv.afterTax)}</b></p>`;
    }).catch((err) => {
      if (box.isConnected) box.textContent = err.message;
    });
  }

  // ================================================================ xây dựng

  function myPlots() {
    return land.plots.filter((p) => p.mine);
  }

  function loadDraft(plotId) {
    const info = land.plots.find((p) => p.id === plotId);
    ui.build.plotId = plotId;
    ui.build.design = info ? info.design.map((x) => ({ ...x })) : [];
    ui.build.layer = null;
  }

  const PRESETS = {
    'Nhà phố': [
      { piece: 'base-3', x: 8, y: 19, color: '#8b5e3c' }, { piece: 'wall_brick-6', x: 9, y: 15, color: '#f29c4b' },
      { piece: 'door-3', x: 11, y: 16, color: '#8b5e3c' }, { piece: 'window_sq-2', x: 9, y: 16, color: '#ffffff' },
      { piece: 'window_sq-2', x: 13, y: 16, color: '#ffffff' }, { piece: 'roof_gable-5', x: 8, y: 11, color: '#e85d5d' },
      { piece: 'tree-3', x: 4, y: 16, color: '#8cc56b' },
    ],
    'Nhà máy': [
      { piece: 'base-5', x: 4, y: 19, color: '#4a4e57' }, { piece: 'wall_brick-9', x: 4, y: 13, color: '#9aa3ad' },
      { piece: 'wall_glass-5', x: 12, y: 15, color: '#4a4e57' }, { piece: 'chimney-8', x: 6, y: 7, color: '#e85d5d' },
      { piece: 'chimney-5', x: 9, y: 9, color: '#e85d5d' }, { piece: 'silo-4', x: 17, y: 14, color: '#f5efe0' },
      { piece: 'roof_flat-3', x: 4, y: 12, color: '#4a4e57' }, { piece: 'sign-2', x: 12, y: 13, color: '#f2cf4b' },
    ],
    'Tháp văn phòng': [
      { piece: 'base-7', x: 8, y: 18, color: '#4a4e57' }, { piece: 'wall_glass-10', x: 10, y: 6, color: '#4b8ff2' },
      { piece: 'wall_glass-9', x: 9, y: 12, color: '#4b8ff2' }, { piece: 'door-5', x: 11, y: 16, color: '#2b2d33' },
      { piece: 'mast-2', x: 11, y: 2, color: '#e85d5d' }, { piece: 'sign-5', x: 9, y: 11, color: '#f2cf4b' },
    ],
  };

  function canvasSvg() {
    const W = DESIGN.cols * DESIGN.cell;
    const H = DESIGN.rows * DESIGN.cell;
    let grid = '';
    for (let x = DESIGN.cell; x < W; x += DESIGN.cell) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
    for (let y = DESIGN.cell; y < H; y += DESIGN.cell) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    const parts = ui.build.design.map((p, i) => {
      const piece = pieceById(p.piece);
      const x = p.x * DESIGN.cell;
      const y = p.y * DESIGN.cell;
      const tf = p.flip ? `translate(${x + piece.w * DESIGN.cell} ${y}) scale(-1 1)` : `translate(${x} ${y})`;
      const sel = ui.build.layer === i ? `<rect x="${x - 1}" y="${y - 1}" width="${piece.w * DESIGN.cell + 2}" height="${piece.h * DESIGN.cell + 2}" fill="none" stroke="#2b2d33" stroke-dasharray="3 2" pointer-events="none"/>` : '';
      return `<g class="layer" data-layer="${i}"><g transform="${tf}">${pieceSvg(piece, p.color)}</g><rect x="${x}" y="${y}" width="${piece.w * DESIGN.cell}" height="${piece.h * DESIGN.cell}" fill="transparent"/></g>${sel}`;
    }).join('');
    return `<svg class="build-svg" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="#eaf6fb"/><rect y="${H - 10}" width="${W}" height="10" fill="#cfe6b0"/>
      <g class="grid" stroke="#00000010" stroke-width=".6">${grid}</g>${parts}</svg>`;
  }

  function drawBuild() {
    const plots = myPlots();
    if (!plots.length) {
      body.innerHTML = '<section class="card clan-box"><h3>🏗️ Xưởng lắp ghép</h3><p class="muted">Gia tộc cần mua ít nhất một lô đất trước khi xây công trình.</p></section>';
      return;
    }
    if (!ui.build.plotId || !plots.some((p) => p.id === ui.build.plotId)) loadDraft(plots[0].id);
    else if (!ui.build.design) loadDraft(ui.build.plotId);
    const b = ui.build;
    const info = plots.find((p) => p.id === b.plotId);
    const canEdit = data.clan.role === 'leader' || data.clan.role === 'elder';
    const cost = designCost(b.design);
    const extra = Math.max(0, cost - (info.spent ?? 0));
    const familyPieces = PIECES.filter((p) => p.family === b.family);
    const layer = b.layer != null ? b.design[b.layer] : null;
    body.innerHTML = `
      <div class="build-layout">
        <section class="card build-palette">
          <label>Lô <select data-build-plot>${plots.map((p) => `<option value="${p.id}" ${p.id === b.plotId ? 'selected' : ''}>${PLOT_BY_ID.get(p.id).code}${p.industry ? ` · ${INDUSTRIES[p.industry].icon}` : ''}</option>`).join('')}</select></label>
          <div class="family-chips">${PIECE_FAMILIES.map((f) => `<button class="chip ${f.key === b.family ? 'current' : ''}" data-family="${f.key}" title="${esc(f.name)}">${f.icon}<span>${esc(f.name)}</span></button>`).join('')}</div>
          <div class="piece-grid">${familyPieces.map((p) => `
            <button class="piece ${b.piece === p.id ? 'current' : ''}" data-piece="${p.id}" title="${esc(p.name)} · ${p.w}×${p.h} ô · ${fmt(p.cost)} xu">
              <svg viewBox="-2 -2 ${p.w * DESIGN.cell + 4} ${p.h * DESIGN.cell + 4}">${pieceSvg(p, b.color)}</svg>
              <small>${esc(p.name.replace(`${p.familyName} `, ''))} · ${p.w}×${p.h}</small><small class="muted">${fmt(p.cost)}</small>
            </button>`).join('')}</div>
          <small class="muted">Bộ mẫu có ${PIECES.length} mảnh (${PIECE_FAMILIES.length} họ × 10 kiểu). Chọn một mảnh rồi chạm vào khung để đặt.</small>
        </section>
        <section class="card build-stage">
          <div class="row-between"><b>Lô ${PLOT_BY_ID.get(b.plotId).code} · ${b.design.length}/${DESIGN.maxPieces} mảnh</b>
            <span class="${designComplete(b.design) ? 'ok' : 'warn'}">${designComplete(b.design) ? `✅ Đủ điều kiện vận hành · +${pctInt(designBonus(b.design))} sản lượng` : '⚠️ Cần ≥ 3 mảnh và có móng nền'}</span></div>
          ${canvasSvg()}
          <div class="color-row">${PALETTE.map((c) => `<button class="swatch ${c === (layer?.color ?? b.color) ? 'current' : ''}" style="background:${c}" data-color="${c}" aria-label="Màu ${c}"></button>`).join('')}
            <input type="color" data-color-input value="${layer?.color ?? b.color}" title="Màu tùy chọn" /></div>
          <div class="row">
            ${Object.keys(PRESETS).map((name) => `<button class="btn small" data-preset="${esc(name)}">Mẫu: ${esc(name)}</button>`).join('')}
            <button class="btn small" data-reset>Hoàn tác</button>
            <button class="btn small" data-clear>Xóa hết</button>
          </div>
          <div class="row-between build-save">
            <span>Tổng giá mảnh ${money(cost)} · đã chi cho lô ${money(info.spent ?? 0)} · <b>cần thêm ${money(extra)}</b></span>
            <button class="btn primary" data-save ${canEdit ? '' : 'disabled'}>Lưu công trình</button>
          </div>
        </section>
        <section class="card build-layers">
          <h3>Các mảnh (lớp sau đè lớp trước)</h3>
          ${b.design.length ? `<ol>${b.design.map((p, i) => {
            const piece = pieceById(p.piece);
            return `<li class="${b.layer === i ? 'current' : ''}" data-pick-layer="${i}">
              <span class="swatch small" style="background:${p.color}"></span>
              <span>${esc(piece.name)}<small class="muted"> (${p.x},${p.y})</small></span>
              <span class="layer-tools">
                <button class="link-btn" data-move="${i}:-1" title="Đưa ra sau">▲</button>
                <button class="link-btn" data-move="${i}:1" title="Đưa lên trước">▼</button>
                <button class="link-btn" data-flip="${i}" title="Lật ngang">⇋</button>
                <button class="link-btn danger" data-remove="${i}" title="Bỏ mảnh">✕</button>
              </span></li>`;
          }).join('')}</ol>` : '<p class="muted">Chưa có mảnh nào. Bắt đầu với một móng nền nhé.</p>'}
          <p class="muted small">Kéo mảnh trên khung để di chuyển. Chi phí chỉ tính phần vượt quá số đã chi cho lô này.</p>
        </section>
      </div>`;
  }

  function redrawCanvas() {
    const stage = body.querySelector('.build-svg');
    if (!stage) return drawBuild();
    stage.outerHTML = canvasSvg();
  }

  function cellAt(svg, e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.floor(p.x / DESIGN.cell), y: Math.floor(p.y / DESIGN.cell) };
  }
  const fit = (piece, x, y) => ({
    x: Math.max(0, Math.min(DESIGN.cols - piece.w, x)),
    y: Math.max(0, Math.min(DESIGN.rows - piece.h, y)),
  });

  let drag = null;
  body.addEventListener('pointerdown', (e) => {
    const svg = e.target.closest('.build-svg');
    if (!svg) return;
    const b = ui.build;
    const cell = cellAt(svg, e);
    const layerEl = e.target.closest('[data-layer]');
    if (layerEl && !b.piece) {
      const i = Number(layerEl.dataset.layer);
      b.layer = i;
      const p = b.design[i];
      drag = { i, dx: cell.x - p.x, dy: cell.y - p.y, svg };
      svg.setPointerCapture?.(e.pointerId);
      drawBuild();
      return;
    }
    if (b.piece) {
      if (b.design.length >= DESIGN.maxPieces) return ctx.toast(`Tối đa ${DESIGN.maxPieces} mảnh mỗi công trình.`, 'error');
      const piece = pieceById(b.piece);
      b.design.push({ piece: piece.id, ...fit(piece, cell.x, cell.y), color: b.color, flip: false });
      b.layer = b.design.length - 1;
      b.piece = null;
      drawBuild();
    }
  });
  body.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const svg = body.querySelector('.build-svg');
    if (!svg) return;
    const cell = cellAt(svg, e);
    const p = ui.build.design[drag.i];
    const next = fit(pieceById(p.piece), cell.x - drag.dx, cell.y - drag.dy);
    if (next.x !== p.x || next.y !== p.y) {
      Object.assign(p, next);
      redrawCanvas();
    }
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    drawBuild();
  };
  body.addEventListener('pointerup', endDrag);
  body.addEventListener('pointercancel', endDrag);

  // ================================================================ thuế

  function drawTax() {
    const c = data.clan;
    const cfg = data.config;
    const leader = c.role === 'leader';
    body.innerHTML = `
      <div class="clan-grid">
        <section class="card clan-box">
          <h3>🧾 Thuế doanh nghiệp</h3>
          <p>Thuế suất hiện tại: <b class="big">${pctInt(c.taxRate)}</b></p>
          <p class="muted small">${pctInt(cfg.baseTax)} cho gia tộc một ngành, mỗi ngành mở rộng thêm ${pctInt(cfg.extraTaxPerIndustry)}. Thuế tính trên doanh thu khai báo, trừ thẳng vào quỹ mỗi đêm.</p>
          <p>Thuế đã đóng tháng này: <b>${money(c.monthTax)}</b></p>
          <p>Dự kiến hoàn cuối tháng (${pctInt(cfg.refundRate)}): <b class="up">${money(Math.floor(c.monthTax * cfg.refundRate))}</b></p>
        </section>
        <section class="card clan-box">
          <h3>📝 Tờ khai doanh thu</h3>
          <p class="muted small">Tỷ lệ doanh thu gia tộc khai báo với Sở thuế mỗi đêm. Gia tộc tự chịu trách nhiệm về tờ khai của mình.</p>
          <form data-form="declare" class="declare-form">
            <input type="range" name="ratio" min="0" max="100" step="5" value="${Math.round(c.declareRatio * 100)}" ${leader ? '' : 'disabled'} />
            <output>${Math.round(c.declareRatio * 100)}%</output>
            ${leader ? '<button class="btn small">Nộp tờ khai</button>' : '<small class="muted">Chỉ tộc trưởng nộp tờ khai.</small>'}
          </form>
        </section>
        <section class="card clan-box wide">
          <h3>📒 Sổ thuế 14 ngày</h3>
          ${c.days.length ? `<table class="clan-table"><thead><tr><th>Ngày</th><th class="num">Doanh thu</th><th class="num">Khai báo</th><th class="num">Thuế suất</th><th class="num">Thuế</th><th class="num">Phí duy trì</th></tr></thead>
            <tbody>${c.days.map((d) => `<tr><td>${d.day.slice(8)}/${d.day.slice(5, 7)}</td><td class="num">${fmt(d.revenue)}</td><td class="num">${fmt(d.declared)}</td>
              <td class="num">${pctInt(d.rate)}</td><td class="num">${fmt(d.tax)}</td><td class="num">${fmt(d.upkeep)}</td></tr>`).join('')}</tbody></table>`
            : '<p class="muted">Chưa có ngày nào được quyết toán.</p>'}
          ${c.refunds.length ? `<h4>Hoàn thuế</h4><ul class="refund-list">${c.refunds.map((r) => `<li>Tháng ${r.month.slice(5)}/${r.month.slice(0, 4)}: đã đóng ${money(r.taxed)} → hoàn <b>${money(r.refund)}</b></li>`).join('')}</ul>` : ''}
        </section>
      </div>`;
  }

  // ================================================================ vĩ mô

  function drawMacro() {
    body.innerHTML = '<div class="empty muted">Đang tải bản tin vĩ mô…</div>';
    api('/macro').then(({ today, history }) => {
      if (!alive || ui.tab !== 'macro') return;
      const ph = PHASES[today.phase];
      const w = WEATHER[today.weather];
      const xs = history.map((_, i) => (history.length > 1 ? (i / (history.length - 1)) * 300 : 150));
      const vals = history.map((h) => h.landIndex);
      const lo = Math.min(...vals) - 0.01;
      const hi = Math.max(...vals) + 0.01;
      const line = history.map((h, i) => `${xs[i].toFixed(1)},${(80 - ((h.landIndex - lo) / (hi - lo)) * 70).toFixed(1)}`).join(' ');
      const strip = history.map((h, i) => `<rect x="${xs[i] - 300 / Math.max(1, history.length) / 2}" y="84" width="${300 / Math.max(1, history.length)}" height="8" fill="${{ recovery: '#8cc56b', boom: '#f29c4b', peak: '#f2cf4b', recession: '#8fb8de' }[h.phase]}"><title>${h.day}: ${PHASES[h.phase].name}</title></rect>`).join('');
      body.innerHTML = `
        <div class="clan-grid">
          <section class="card clan-box macro-card"><span class="macro-big">${ph.icon}</span>
            <div><small class="muted">Chu kỳ kinh tế</small><h3>${ph.name}</h3>
            <p class="muted small">Sản lượng các lô ${signed(ph.factor - 1)} · khách quầy trà sữa ${signed(ph.traffic)} · giá đất ${ph.land >= 0 ? 'có xu hướng tăng' : 'có xu hướng giảm'}.</p>
            <p>Tăng trưởng (năm): <b class="${today.gdp >= 0 ? 'up' : 'down'}">${pct(today.gdp)}</b></p></div></section>
          <section class="card clan-box macro-card"><span class="macro-big">${w.icon}</span>
            <div><small class="muted">Thời tiết hôm nay</small><h3>${w.name}</h3>
            <p class="muted small">${Object.entries(w.zones).map(([z, v]) => `${ZONES[z].icon} ${ZONES[z].name} ${signed(v)}`).concat(Object.entries(w.climates).map(([k, v]) => `${CLIMATES[k].icon} ${CLIMATES[k].name} ${signed(v)}`)).join(' · ') || 'Không ảnh hưởng sản lượng.'}</p></div></section>
          <section class="card clan-box wide">
            <h3>🏦 Chỉ số giá đất 14 ngày: ${today.landIndex.toFixed(3)}</h3>
            <svg class="macro-chart" viewBox="-6 0 312 96"><polyline points="${line}" fill="none" stroke="#9b6238" stroke-width="2.5"/>${strip}</svg>
            <div class="land-legend"><span><i style="background:#8cc56b"></i>Phục hồi</span><span><i style="background:#f29c4b"></i>Tăng trưởng nóng</span><span><i style="background:#f2cf4b"></i>Đỉnh</span><span><i style="background:#8fb8de"></i>Suy thoái</span></div>
          </section>
          <section class="card clan-box wide">
            <h3>📦 Cầu từng ngành hôm nay</h3>
            <div class="demand-list">${INDUSTRY_ORDER.map((id) => {
              const d = today.demand[id] ?? 1;
              return `<div class="demand"><span>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}</span>
                <div class="bar"><i style="width:${Math.round(((d - 0.7) / 0.65) * 100)}%;background:${d >= 1 ? 'var(--mint-deep)' : 'var(--pink-deep)'}"></i></div>
                <b class="${d > 1 ? 'up' : d < 1 ? 'down' : ''}">${signed(d - 1)}</b></div>`;
            }).join('')}</div>
            <p class="muted small">Cú sốc cầu và thời tiết cũng đăng lên Báo và đẩy giá hàng trên Sàn Nguyên Liệu.</p>
          </section>
        </div>`;
    }).catch(ctx.fail);
  }

  // ================================================================ sự kiện

  body.addEventListener('click', (e) => {
    const t = e.target;
    const on = (sel) => t.closest(sel);
    let el;
    if ((el = on('[data-emblem]'))) {
      ui.emblem = el.dataset.emblem;
      body.querySelectorAll('[data-emblem]').forEach((b) => b.classList.toggle('current', b === el));
    } else if ((el = on('[data-join]'))) act(`/clans/${el.dataset.join}/join`);
    else if ((el = on('[data-leave]'))) {
      const last = data.clan.members.length === 1;
      if (confirm(last ? 'Bạn là người cuối cùng: rời đi sẽ giải tán gia tộc, đất trả về Sở Nhà Đất và quỹ còn lại về ngân sách. Tiếp tục?' : 'Rời gia tộc?')) act('/clans/leave');
    } else if ((el = on('[data-kick]'))) {
      if (confirm('Mời thành viên này rời gia tộc?')) act('/clans/kick', { userId: Number(el.dataset.kick) });
    } else if ((el = on('[data-industry]'))) {
      const ind = INDUSTRIES[el.dataset.industry];
      if (confirm(`Thâu tóm ngành ${ind.name}? Quỹ gia tộc trả ${fmt(data.clan.nextFees[el.dataset.industry])} xu tiền bồi thường thị trường.`)) act('/clans/industries', { industry: el.dataset.industry });
    } else if ((el = on('[data-open-plot]'))) {
      ui.plotId = Number(el.dataset.openPlot);
      ui.tab = 'map';
      draw();
    } else if ((el = on('[data-plot]'))) {
      ui.plotId = Number(el.dataset.plot);
      drawMap();
    } else if ((el = on('[data-buy]'))) {
      const p = PLOT_BY_ID.get(Number(el.dataset.buy));
      if (confirm(`Mua lô ${p.code} bằng quỹ gia tộc?`)) act(`/land/${p.id}/buy`);
    } else if ((el = on('[data-sell]'))) {
      if (confirm('Bán lại lô này cho Sở Nhà Đất? Công trình trên lô sẽ bị dỡ bỏ.')) act(`/land/${el.dataset.sell}/sell`);
    } else if ((el = on('[data-set-industry]'))) act(`/land/${el.dataset.setIndustry}/industry`, { industry: ui.industry });
    else if ((el = on('[data-build]'))) {
      loadDraft(Number(el.dataset.build));
      ui.tab = 'build';
      draw();
    } else if ((el = on('[data-family]'))) {
      ui.build.family = el.dataset.family;
      drawBuild();
    } else if ((el = on('[data-piece]'))) {
      ui.build.piece = ui.build.piece === el.dataset.piece ? null : el.dataset.piece;
      ui.build.layer = null;
      drawBuild();
    } else if ((el = on('[data-color]'))) {
      setColor(el.dataset.color);
    } else if ((el = on('[data-pick-layer]')) && !on('button')) {
      ui.build.layer = Number(el.dataset.pickLayer);
      ui.build.piece = null;
      drawBuild();
    } else if ((el = on('[data-move]'))) {
      const [i, d] = el.dataset.move.split(':').map(Number);
      const arr = ui.build.design;
      const j = i + d;
      if (j >= 0 && j < arr.length) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        ui.build.layer = j;
        drawBuild();
      }
    } else if ((el = on('[data-flip]'))) {
      const p = ui.build.design[Number(el.dataset.flip)];
      p.flip = !p.flip;
      drawBuild();
    } else if ((el = on('[data-remove]'))) {
      ui.build.design.splice(Number(el.dataset.remove), 1);
      ui.build.layer = null;
      drawBuild();
    } else if ((el = on('[data-preset]'))) {
      ui.build.design = PRESETS[el.dataset.preset].map((x) => ({ ...x, flip: false }));
      ui.build.layer = null;
      drawBuild();
    } else if (on('[data-reset]')) {
      loadDraft(ui.build.plotId);
      drawBuild();
    } else if (on('[data-clear]')) {
      ui.build.design = [];
      ui.build.layer = null;
      drawBuild();
    } else if (on('[data-save]')) {
      const design = ui.build.design;
      act(`/land/${ui.build.plotId}/design`, { design });
    }
  });

  function setColor(color) {
    const b = ui.build;
    b.color = color;
    if (b.layer != null && b.design[b.layer]) b.design[b.layer].color = color;
    drawBuild();
  }

  body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-heat]')) {
      ui.heat = t.value;
      drawMap();
    } else if (t.matches('[data-fit]')) {
      ui.industry = t.value;
      drawMap();
    } else if (t.matches('[data-preview-industry]')) {
      ui.industry = t.value;
      body.querySelector('.land-panel').innerHTML = plotPanel();
      loadPreview();
    } else if (t.matches('[data-build-plot]')) {
      loadDraft(Number(t.value));
      drawBuild();
    } else if (t.matches('[data-color-input]')) setColor(t.value.toLowerCase());
    else if (t.matches('[data-role]')) {
      const role = t.value;
      if (role === 'leader' && !confirm('Nhường chức tộc trưởng? Bạn sẽ thành trưởng lão.')) return draw();
      act('/clans/role', { userId: Number(t.dataset.role), role });
    } else if (t.matches('input[name="color"]')) ui.color = t.value;
  });

  body.addEventListener('input', (e) => {
    if (e.target.matches('.declare-form input[type="range"]')) e.target.nextElementSibling.textContent = `${e.target.value}%`;
  });

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = Object.fromEntries(new FormData(form));
    switch (form.dataset.form) {
      case 'create': return act('/clans/create', { name: fd.name, emblem: ui.emblem, color: fd.color });
      case 'donate': return act('/clans/donate', { amount: Number(fd.amount) });
      case 'dividend': return act('/clans/dividend', { amount: Number(fd.amount) });
      case 'declare': return act('/clans/declare', { ratio: Number(fd.ratio) / 100 });
      default: return undefined;
    }
  });

  return () => {
    alive = false;
  };
}
