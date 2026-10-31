// Gia tộc & Sở Nhà Đất: lập/gia nhập gia tộc, góp quỹ, thâu tóm ngành, bản đồ 200 lô đất có địa hình và khí hậu,
// xem trước sản lượng theo môi trường, lắp ghép công trình từ 200 mẫu (tối đa 20 mảnh), thuế doanh nghiệp và bản tin vĩ mô.
import { api } from '../api.js';
import { esc, fmt, pct, viewHead } from '../ui.js';
import { bindMiniMap, bindPlotTips, landMapSvg, miniMapHtml, scrollToPlot } from '../landmap.js';
import { BIZ_IDLE, bizLegend, industriesInUse, myClanStrip, plotBusiness, plotTipHtml } from '../landbiz.js';
import {
  CLIMATES, DESIGN, INDUSTRIES, INDUSTRY_ORDER, LAND, PALETTE, PHASES, PIECES, PIECE_FAMILIES, PLOTS, WEATHER, ZONES,
  designBonus, designComplete, designCost, designSvg, envFactor, pieceById, pieceSvg,
} from '../shared/clan.js';
import {
  ESSENTIALS, ESSENTIAL_CATS, GOODS, GOOD_ORDER, PRODUCTION_INDUSTRIES, SECTORS, STRATEGIC_INDUSTRIES, STRATEGIC_RULES, extractKindOf, lineOf, variantInfo, variantsFor,
} from '../shared/industry.js';
import { industryMarketText } from '../shared/industry-market.js';
import { hasAtlasIcon, itemIcon } from '../itemart.js';

/** Tên mặt hàng trên Sàn (lấy từ catalog khi mở màn). */
let COMMODITY_NAMES = {};

const TABS = [
  { key: 'clan', label: '🏯 Gia tộc' },
  { key: 'admin', label: '👑 Quản trị', needManage: true },
  { key: 'map', label: '🗺️ Bản đồ đất' },
  { key: 'build', label: '🏗️ Xây dựng', needClan: true },
  { key: 'prod', label: '🏭 Sản xuất & Kho', needClan: true },
  { key: 'market', label: '🏪 Sàn công nghiệp' },
  { key: 'tax', label: '🧾 Thuế', needClan: true },
  { key: 'macro', label: '📊 Vĩ mô' },
];
const ROLE = { leader: '👑 Tộc trưởng', elder: '🎖️ Trưởng lão', member: 'Thành viên' };
const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));

/** Trạng thái giữ qua các lần vẽ lại (mỗi hành động thành công thì app vẽ lại cả màn). */
const ui = {
  tab: 'clan', plotId: null, industry: 'tea', heat: 'zone', stripOpen: false,
  emblem: null, color: '#c0392b',
  build: { plotId: null, design: null, family: 'base', piece: null, layer: null, color: '#e85d5d' },
};

/** Ngành đang mở (bỏ các ngành tạm đóng, ví dụ công nghiệp nặng). */
const openIds = (cfg) => INDUSTRY_ORDER.filter((id) => !cfg?.closedIndustries?.includes(id));
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

/** Icon 16-bit 32 điểm (1x) của hàng `g` (atlas assets/items, itemart.js); hàng chưa có hình thì emoji như cũ. */
const goodIcon = (g) => itemIcon({ id: g, icon: GOODS[g].icon }, 3, 1);
/** Icon và tên hàng cạnh nhau (ô bảng, ô giá, mỏ của lô): có icon 16-bit thì không chêm emoji cũ của chính hàng đó. */
const goodCell = (g, extra = '') => `<span class="good-cell">${goodIcon(g)}<span>${esc(GOODS[g].name)}${extra}</span></span>`;

/**
 * Chip hàng và số lượng. `art`: vẽ icon 16-bit 32 điểm (chuỗi ngành, khung xem trước của lô, nơi có chỗ);
 * mặc định giữ emoji (bộ icon js/icons vẽ lại thành pixel 16 điểm) cho dòng công thức dày đặc trong thẻ ngành hẹp.
 * Icon 16-bit ẩn với trình đọc màn hình nên chip đó đọc bằng aria-label.
 */
const goodChip = (g, n, art = false) => {
  const name = esc(GOODS[g].name);
  const count = n != null ? `<b>${fmt(n)}</b>` : '';
  if (art && hasAtlasIcon(g)) return `<span class="good-chip art" title="${name}" role="img" aria-label="${name}${n != null ? ` ${fmt(n)}` : ''}">${goodIcon(g)}${count}</span>`;
  return `<span class="good-chip" title="${name}">${GOODS[g].icon}${count}</span>`;
};
const chips = (map, art = false) => Object.entries(map).map(([g, n]) => goodChip(g, Math.round(n * 10) / 10, art)).join('');
/** Mũi tên và thành phẩm của một công thức, gói chung một khối không ngắt dòng: dòng công thức dài (cột chuỗi ngành
 *  hẹp, ngành nặng 4-5 nguyên liệu) xuống dòng thì cả "→ thành phẩm" sang dòng mới, không để mũi tên treo cuối dòng trên. */
const recipeOut = (outHtml) => `<span class="recipe-out">→ ${outHtml}</span>`;
/** Emoji của dây chuyền (hay nhà máy điện) đứng cạnh icon 16-bit của thành phẩm: dây chuyền lấy chính emoji cũ của thành
 *  phẩm (🥫 Thực phẩm chế biến, 🔗 Luyện thép), nên thành phẩm có icon 16-bit thì bỏ emoji, để một hàng không ra hai hình. */
const lineGlyph = (l) => (Object.keys(l.recipe?.out ?? l.out ?? {}).some((g) => GOODS[g]?.icon === l.icon && hasAtlasIcon(g)) ? '' : `${l.icon} `);

/**
 * Một dòng tóm tắt ngành sản xuất: khai thác gì, hoặc công thức một mẻ. `art`: icon 16-bit (chuỗi ngành, cột rộng);
 * thẻ ngành ở tab Gia tộc chỉ rộng ~160 điểm, mỏ có tới 15 hàng, nên giữ emoji nhỏ để thẻ không cao gấp ba.
 */
function recipeLine(id, art = false) {
  const st = STRATEGIC_INDUSTRIES[id];
  if (st) return `<small class="recipe">${id === 'tax_office' ? 'Hoa hồng 10–40%' : 'Buff toàn server +10–40%'}: ${esc(st.effect)} · tối đa ${st.maxClans} gia tộc</small>`;
  const ind = PRODUCTION_INDUSTRIES[id];
  if (!ind) return '';
  if (ind.extracts) {
    const goods = GOOD_ORDER.filter((g) => ind.extracts.includes(extractKindOf(g)));
    return `<small class="recipe">Khai thác ${goods.map((g) => (art ? goodChip(g, null, true) : GOODS[g].icon)).join('')}</small>`;
  }
  if (id === 'power') return `<small class="recipe">${Object.values(ind.plants).map((pl) => pl.icon).join('')} ${recipeOut(art ? goodChip('power', null, true) : '⚡')}</small>`;
  // Nhà máy gộp: mỗi dây chuyền một dòng (.recipe-line rộng 100%; <br> không ngắt dòng trong .recipe vì là flex),
  // mỗi lô chọn một dây chuyền. Đường emoji giữ emoji của dây chuyền, đường icon 16-bit bỏ nếu trùng thành phẩm (lineGlyph).
  if (ind.lines) {
    return `<small class="recipe">${Object.values(ind.lines).map((l) => `<span class="recipe-line"><span class="recipe-name">${art ? lineGlyph(l) : `${l.icon} `}${esc(l.name)}:</span> ${chips(l.recipe.in, art)} ${recipeOut(chips(l.recipe.out, art))}</span>`).join('')}</small>`;
  }
  return `<small class="recipe">${chips(ind.recipe.in, art)} ${recipeOut(chips(ind.recipe.out, art))}</small>`;
}

/** 2 tài nguyên nhiều nhất của lô, để hiện trên bản đồ (chữ <text> trong SVG cỡ 9-13 điểm, nên giữ emoji). */
const topDeposits = (deposits) => Object.entries(deposits ?? {}).sort((a, b) => GOODS[b[0]].base * b[1] - GOODS[a[0]].base * a[1]).slice(0, 2).map(([g]) => GOODS[g].icon).join('');

function productionBox(pv) {
  const pr = pv.production;
  const ind = INDUSTRIES[pv.industry];
  let body;
  if (pr.kind === 'extract') {
    body = Object.keys(pr.out).length ? `<p class="good-row">Khai thác mỗi đêm: ${chips(pr.out, true)}</p>` : `<p class="warn">Lô này không có tài nguyên cho ngành ${esc(ind.name)}.</p>`;
  } else if (pr.kind === 'power' && !pr.batches) {
    body = '<p class="warn">Chưa chọn loại nhà máy điện phù hợp với lô.</p>';
  } else {
    const line = pr.line && variantInfo(pv.industry, pr.line);
    body = `${line ? `<p>Dây chuyền: <b>${lineGlyph(line)}${esc(line.name)}</b>${pr.lines?.length > 1 ? ' <small class="muted">(đổi ở ô Dây chuyền của lô)</small>' : ''}</p>` : ''}
      <p>Tối đa ${fmt(pr.batches)} mẻ/đêm</p><p class="good-row">Cần: ${chips(pr.in, true) || 'không cần nguyên liệu'}</p><p class="good-row">Làm ra: ${chips(pr.out, true)}</p>`;
  }
  return `<div class="prod-preview">
      <p class="muted small">Hệ số sản xuất của lô (tốc độ, đất, khí hậu, thời tiết, chu kỳ, cấp, công trình): <b>×${pr.factor.toFixed(2)}</b></p>
      ${body}
      <p class="preview-total">Giá trị bán NPC ≈ <b>${money(pr.value)}</b>/đêm${pr.cost ? ` · nguyên liệu ≈ ${money(pr.cost)}` : ''} · lãi sau thuế ${pctInt(pv.taxRate)}: <b>${money(pv.afterTax)}</b></p>
      <p class="muted small">Hàng làm ra vào kho gia tộc. Hàng không giữ được tự bán cho NPC mỗi đêm; hoặc đăng bán trên Sàn công nghiệp.</p>
    </div>`;
}

/** Ngành này tác động gì lên Sàn Nguyên Liệu khi có gia tộc nắm và lô đất đang chạy. */
function marketLine(id) {
  const text = industryMarketText(id, COMMODITY_NAMES);
  return text ? `<small class="industry-market">📈 Sàn: ${esc(text)}</small>` : '';
}

export function renderClans(root, ctx) {
  COMMODITY_NAMES = Object.fromEntries(Object.entries(ctx.catalog.commodities ?? {}).map(([id, c]) => [id, c.name]));
  root.innerHTML = `<div class="clan-page">
    ${viewHead('🏯 Gia tộc & Sở Nhà Đất', 'Lập gia tộc, góp quỹ, thâu tóm tối đa 3 ngành, mua đất và tự lắp ghép công trình.', '<button class="btn" data-go="arena">⚔️ Đấu trường</button> <button class="btn" data-go="clanbank">🏦 Ngân hàng gia tộc</button> <button class="btn" data-go="shares">📈 Cổ phiếu</button>')}
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
    const canManage = Boolean(data?.clan?.gov?.canManage);
    tabsEl.innerHTML = TABS.filter((t) => (!t.needClan || inClan) && (!t.needManage || canManage))
      .map((t) => `<button class="btn small ${ui.tab === t.key ? 'current' : ''}" data-tab="${t.key}">${t.label}</button>`).join('');
  }

  function draw() {
    if (!alive || !data) return;
    if (!data.clan && ['build', 'tax', 'prod'].includes(ui.tab)) ui.tab = 'clan';
    // Bảng quản trị chỉ dành cho tộc trưởng đương nhiệm; bị phế truất là mất quyền vào.
    if (ui.tab === 'admin' && !data.clan?.gov?.canManage) ui.tab = 'clan';
    drawTabs();
    ({ clan: drawClan, admin: drawAdmin, map: drawMap, build: drawBuild, prod: drawProduction, market: drawMarket, tax: drawTax, macro: drawMacro })[ui.tab]();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    ui.tab = btn.dataset.tab;
    draw();
  });

  let strat = null;
  Promise.all([api('/clans'), api('/land'), api('/clans/strategic')]).then(([c, l, st]) => {
    data = c;
    land = l;
    strat = st;
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

        ${voteBox(c)}

        <section class="card clan-box">
          <h3>👥 Thành viên</h3>
          <ul class="clan-members">${c.members.map((m) => `
            <li class="${m.week >= c.quota ? '' : 'short'}">
              <span><b>${esc(m.username)}</b><small class="muted">${ROLE[m.role]}${m.deposed ? ' · ⚖️ đã bị phế truất' : ''} · góp tổng ${money(m.donated)} · ⚔️ chiến lực ${fmt(m.power ?? 0)}</small></span>
              <small class="${m.week >= c.quota ? 'ok' : 'warn'}">${fmt(m.week)}/${fmt(c.quota)}</small>
              ${leader && m.id !== ctx.me.user.id ? `<span class="row">
                <select data-role="${m.id}">
                  <option value="member" ${m.role === 'member' ? 'selected' : ''}>Thành viên</option>
                  ${m.deposed ? '' : `<option value="elder" ${m.role === 'elder' ? 'selected' : ''}>Trưởng lão</option>
                  <option value="leader">Nhường tộc trưởng</option>`}
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
          ${cfg.closedIndustries?.length ? `<p class="muted small">🏭 Công nghiệp nặng (${cfg.closedIndustries.map((id) => INDUSTRIES[id]?.name).join(', ')}) đang tạm đóng.</p>` : ''}
          ${Object.entries(SECTORS).filter(([sector]) => openIds(cfg).some((id) => INDUSTRIES[id].sector === sector)).map(([sector, sec]) => `<h4 class="sector-head">${sec.icon} ${sec.name}</h4>
          <div class="industry-grid">${openIds(cfg).filter((id) => INDUSTRIES[id].sector === sector).map((id) => {
            const ind = INDUSTRIES[id];
            const mine = owned.has(id);
            const rivals = (cfg.industryClans[id] ?? 0) - (mine ? 1 : 0);
            const fee = c.nextFees[id];
            const can = leader && !mine && c.industries.length < 3 && c.nextIndustryLevel && c.level >= c.nextIndustryLevel;
            return `<div class="industry ${mine ? 'held' : ''}">
              <span class="industry-icon">${ind.icon}</span>
              <b>${esc(ind.name)}</b>
              ${recipeLine(id)}
              ${marketLine(id)}
              <small class="muted">${rivals ? `${rivals} gia tộc ${mine ? 'khác cùng ' : ''}đang nắm` : mine ? 'Chỉ gia tộc bạn nắm' : 'Chưa ai nắm'}</small>
              ${mine ? '<span class="badge star">Đã thâu tóm</span>'
                : `<button class="btn small ${can ? 'primary' : ''}" data-industry="${id}" ${can ? '' : 'disabled'}>Thâu tóm · ${money(fee)}</button>`}
            </div>`;
          }).join('')}</div>`).join('')}
        </section>

        ${strategicSection()}
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

  /** Bỏ phiếu phế truất tộc trưởng: xem phiếu đang mở, bỏ phiếu, hoặc mở phiếu mới (đề cử người thay). */
  function voteBox(c) {
    const g = c.gov;
    const me = ctx.me.user.id;
    const v = g.vote;
    const deposedNote = g.iAmDeposed ? '<p class="warn small">Bạn từng bị thành viên phế truất ở gia tộc này: không thể giữ chức tộc trưởng hay trưởng lão, không vào được bảng quản trị.</p>' : '';
    if (v) {
      return `<section class="card clan-box vote-box">
        <h3>⚖️ Bỏ phiếu phế truất tộc trưởng</h3>
        <p><b>${esc(v.startedBy)}</b> đề nghị phế truất <b>${esc(v.target)}</b>, đưa <b>${esc(v.candidate)}</b> lên thay.</p>
        <div class="bar"><i style="width:${Math.min(100, (v.yes / Math.max(1, v.need)) * 100)}%;background:var(--pink)"></i></div>
        <small class="muted">Thuận ${v.yes} · chống ${v.no} · cần ${v.need}/${v.eligible} phiếu thuận · đóng lúc ${new Date(v.endsAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</small>
        ${v.canVote ? `<div class="row">
          <button class="btn small pink ${v.mine === 1 ? 'current' : ''}" data-ballot="${v.id}" data-yes="1">👍 Thuận</button>
          <button class="btn small ${v.mine === 0 ? 'current' : ''}" data-ballot="${v.id}" data-yes="0">👎 Chống</button>
          ${v.mine === null ? '' : `<small class="muted">Bạn đã bỏ phiếu ${v.mine ? 'thuận' : 'chống'} (đổi được tới khi phiếu đóng)</small>`}</div>`
          : '<p class="muted small">Bạn là người bị đề nghị phế truất, không bỏ phiếu.</p>'}
        ${deposedNote}
      </section>`;
    }
    const candidates = c.members.filter((m) => m.role !== 'leader' && !m.deposed);
    const cooling = g.cooldownUntil && g.cooldownUntil > Date.now();
    const canStart = c.role !== 'leader' && c.members.length >= g.rules.minMembers && !cooling && candidates.length;
    const last = g.history[0];
    return `<section class="card clan-box vote-box">
      <h3>⚖️ Phế truất tộc trưởng</h3>
      <p class="muted small">Thành viên ở gia tộc đủ ${g.rules.joinedHours} giờ được mở phiếu và đề cử người thay. Phiếu mở ${g.rules.voteHours} giờ,
        thông qua khi quá nửa thành viên (trừ tộc trưởng) thuận. Tộc trưởng bị phế truất thành thành viên thường và <b>không bao giờ</b> được giữ chức lại trong gia tộc này.</p>
      ${last ? `<p class="small">Lần gần nhất: ${last.status === 'passed' ? `✅ ${esc(last.target)} bị phế truất, ${esc(last.candidate)} lên thay` : last.status === 'failed' ? `❌ phiếu phế truất ${esc(last.target)} không thành` : 'phiếu bị hủy'}</p>` : ''}
      ${cooling ? `<p class="muted small">Phải chờ tới ${new Date(g.cooldownUntil).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} mới mở phiếu mới.</p>` : ''}
      ${canStart ? `<form class="row" data-form="depose">
        <select name="candidate">${candidates.map((m) => `<option value="${m.id}">${esc(m.username)}${m.id === me ? ' (bạn)' : ''}</option>`).join('')}</select>
        <button class="btn small pink">Mở phiếu phế truất</button>
      </form>` : c.role === 'leader' ? '' : c.members.length < g.rules.minMembers ? `<p class="muted small">Cần ít nhất ${g.rules.minMembers} người mới bỏ phiếu được.</p>` : ''}
      ${deposedNote}
    </section>`;
  }

  // ================================================================ bảng quản trị của tộc trưởng

  function drawAdmin() {
    const c = data.clan;
    const g = c.gov;
    const bank = g.bank;
    const days = c.days.slice(0, 7);
    const sum = (k) => days.reduce((s, d) => s + (d[k] ?? 0), 0);
    const dt = (ts) => new Date(ts).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const KIND = { matured: 'Đúng hạn', early: 'Rút gấp', emergency: 'Tự rút gấp (quỹ cạn)' };
    body.innerHTML = `
      <div class="clan-grid">
        <section class="card clan-box wide">
          <h3>👑 Bảng quản trị · ${esc(c.emblem)} ${esc(c.name)}</h3>
          <div class="admin-kpis">
            <div><small class="muted">Quỹ tiền mặt</small><b>${money(c.treasury)}</b></div>
            <div><small class="muted">Gửi ngân hàng</small><b>${money(bank.total)}</b></div>
            <div><small class="muted">Phí duy trì/đêm</small><b>${money(c.upkeep)}</b></div>
            <div><small class="muted">Doanh thu 7 ngày</small><b>${money(sum('revenue'))}</b></div>
            <div><small class="muted">Thuế 7 ngày</small><b>${money(sum('tax'))}</b></div>
            <div><small class="muted">Thành viên</small><b>${c.members.length}/${c.perks.maxMembers}</b></div>
          </div>
          ${c.treasury < c.upkeep * 3 ? `<p class="warn small">⚠️ Quỹ tiền mặt chỉ đủ dưới 3 đêm phí duy trì. Nếu quỹ cạn, hệ thống tự rút gấp tiền gửi (phạt ${pctInt(bank.rules.emergencyPenalty)} gốc).</p>` : ''}
          ${g.vote ? `<p class="warn">⚖️ Đang có phiếu phế truất bạn: thuận ${g.vote.yes}/${g.vote.need} cần thiết. Thông qua thì bạn mất quyền vào bảng này.</p>` : ''}
        </section>

        <section class="card clan-box">
          <h3>🏦 Gửi kỳ hạn từ quỹ</h3>
          <p class="muted small">Lãi/ngày = lãi cơ bản + phụ phí kỳ hạn + ưu đãi gia tộc. Rút trước hạn mất lãi, phạt ${pctInt(bank.rules.earlyPenalty)} gốc;
            quỹ không đủ trả phí duy trì hoặc thuế thì hệ thống tự rút gấp (phạt ${pctInt(bank.rules.emergencyPenalty)}).</p>
          <form class="row" data-form="deposit">
            <input name="amount" type="number" min="${bank.rules.minDeposit}" step="100" placeholder="Tối thiểu ${fmt(bank.rules.minDeposit)}" required />
            <select name="term">${bank.terms.map((t) => `<option value="${t.days}">${t.days} ngày · ${pct(t.rate, 2, false)}/ngày</option>`).join('')}</select>
            <button class="btn gold">Gửi</button>
          </form>
          ${bank.deposits.length ? `<ul class="clan-deposits">${bank.deposits.map((d) => `<li>
            <span><b>${money(d.amount)}</b> · ${d.termDays} ngày · ${pct(d.rate, 2, false)}/ngày<br>
              <small class="muted">Đáo hạn ${dt(d.maturesAt)} · lãi ${money(d.interest)}</small></span>
            <button class="btn small ${d.maturesAt <= Date.now() ? 'mint' : ''}" data-withdraw="${d.id}" data-penalty="${d.maturesAt <= Date.now() ? 0 : d.earlyPenalty}">
              ${d.maturesAt <= Date.now() ? 'Tất toán' : `Rút gấp · phạt ${money(d.earlyPenalty)}`}</button>
          </li>`).join('')}</ul>` : '<p class="muted">Chưa có khoản gửi nào.</p>'}
          ${bank.closed.length ? `<small class="muted">Đã tất toán: ${bank.closed.map((d) => `#${d.id} ${KIND[d.kind] ?? ''} ${money(d.payout)}${d.penalty ? ` (phạt ${money(d.penalty)})` : ''}`).join(' · ')}</small>` : ''}
        </section>

        <section class="card clan-box">
          <h3>📈 Ngành đang nắm và tác động lên Sàn</h3>
          ${c.industries.length ? `<ul class="clan-impact">${c.industries.map((i) => `<li>${INDUSTRIES[i.id].icon} <b>${esc(INDUSTRIES[i.id].name)}</b><br>${marketLine(i.id) || '<small class="muted">Không tác động trực tiếp lên Sàn Nguyên Liệu.</small>'}</li>`).join('')}</ul>
            <p class="muted small">Càng nhiều lô đất của ngành có công trình hoàn chỉnh, tác động càng mạnh (một gia tộc đạt tối đa khi có 7 lô; nhiều gia tộc cùng nắm thì ít lô hơn). Ngành chưa gia tộc nào nắm thì hàng chạy bình thường.</p>`
            : '<p class="muted">Gia tộc chưa thâu tóm ngành nào.</p>'}
        </section>

        <section class="card clan-box">
          <h3>⚖️ Phế truất & chức vụ</h3>
          ${g.deposed.length ? `<p class="small">Đã bị phế truất (không được giữ chức): ${g.deposed.map((d) => `<b>${esc(d.username)}</b>`).join(', ')}</p>` : '<p class="muted small">Chưa ai bị phế truất.</p>'}
          ${g.history.length ? `<ul class="small">${g.history.map((h) => `<li>${h.status === 'passed' ? '✅' : h.status === 'failed' ? '❌' : '➖'} Phiếu phế truất ${esc(h.target)} (đề cử ${esc(h.candidate)}) · ${dt(h.closedAt)}</li>`).join('')}</ul>` : ''}
          <p class="muted small">Phân vai, mời ra và chia cổ tức ở tab Gia tộc.</p>
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


  // ================================================================ hạ tầng chiến lược

  function strategicSection() {
    if (!strat) return '';
    const leader = data.clan?.role === 'leader';
    const manage = data.clan && (data.clan.role === 'leader' || data.clan.role === 'elder');
    const rows = Object.entries(strat.industries).map(([id, x]) => `<tr>
      <td>${STRATEGIC_INDUSTRIES[id].icon} <b>${esc(STRATEGIC_INDUSTRIES[id].name)}</b><br><small class="muted">${esc(STRATEGIC_INDUSTRIES[id].effect)}</small></td>
      <td class="num"><b class="${x.buff ? 'up' : ''}">+${pctInt(x.buff)}</b></td>
      <td>${x.owners.length ? x.owners.map((o) => `<span class="owner-tag" style="--clan:${esc(o.color)}">${esc(o.emblem)} ${esc(o.name)} · cấp ${o.level}</span>`).join(' ') : '<span class="muted">Chưa ai vận hành</span>'}</td>
      <td class="num">${x.mine.total ? `+${pctInt(x.mine.total)}${x.mine.paid ? ` <small class="muted">(trả phí ${pctInt(STRATEGIC_RULES.fee)} phần tăng)</small>` : ' <small class="ok">miễn phí</small>'}` : '–'}</td>
    </tr>`).join('');
    const m = strat.mine;
    let mineBox = '';
    if (m) {
      const def = STRATEGIC_INDUSTRIES[m.industry];
      const pets = (ctx.me.pets ?? []).map((pet) => {
        const sp = ctx.catalog.species.find((x) => x.id === pet.species);
        return `<option value="${pet.id}">${esc(pet.name)}${sp?.rarity === 'huyenthoai' ? ' ⭐ huyền thoại' : ''}</option>`;
      }).join('');
      const windPlots = (data.clan.plots ?? []).filter((p) => p.industry === 'wind_farm');
      mineBox = `<div class="infra-mine">
        <h4>${def.icon} Gia tộc đang nắm ${esc(def.name)} · cấp ${m.level}${m.operating ? '' : ' <span class="warn">(chưa vận hành: cần một lô làm ngành này với công trình hoàn chỉnh)</span>'}</h4>
        <p>${m.industry === 'tax_office' ? 'Hoa hồng truy thu' : 'Buff tạo ra'}: <b>+${pctInt(STRATEGIC_RULES.levels[m.level - 1].buff)}</b>
          ${m.next ? ` · cấp ${m.level + 1}: +${pctInt(m.next.buff)} (${money(m.next.cost)})` : ' · đã tối đa'}
          · phí hạ tầng thu 7 ngày: <b>${money(m.feeWeek)}</b></p>
        ${leader && m.next ? `<button class="btn primary small" data-infra-upgrade>Nâng cấp hạ tầng · ${money(m.next.cost)}</button>` : ''}
        ${m.industry === 'wind_farm' ? `
          <p class="muted small">Thành viên gia tộc được thêm +${pctInt(STRATEGIC_RULES.ownerMemberBonus)} và không trả phí. Pet huyền thoại đứng máy: Kim +30%, Hỏa +25%, Mộc +20%, Thủy +15%, Thổ +10%.
            Hiện cộng thêm: <b>+${pctInt(m.operatorBonus)}</b></p>
          ${m.operators.length ? `<ul class="refund-list">${m.operators.map((o) => `<li>Lô ${esc(o.code)}: ${esc(o.petName ?? '?')} của ${esc(o.username)}${o.legendary ? ' ⭐' : ''}
            <button class="link-btn danger" data-op-remove="${o.plotId}">Cho nghỉ</button></li>`).join('')}</ul>` : ''}
          ${windPlots.length && pets ? `<form class="row" data-form="operator">
            <select name="plotId">${windPlots.map((p) => `<option value="${p.id}">Lô ${p.code}</option>`).join('')}</select>
            <select name="petId">${pets}</select>
            <button class="btn small">Cho bé đứng máy</button></form>` : ''}` : ''}
        ${m.industry === 'tax_office' && strat.taxOffice ? `
          <p class="muted small">Hồ sơ khai thiếu của các gia tộc khác. Truy thu = thuế trốn + phạt ${pctInt(strat.taxOffice.penalty)}, gia tộc hưởng hoa hồng ${pctInt(strat.taxOffice.rate)}, còn lại vào ngân sách.</p>
          ${strat.taxOffice.cases.length ? `<table class="clan-table"><thead><tr><th>Gia tộc</th><th>Ngày</th><th class="num">Doanh thu</th><th class="num">Khai báo</th><th class="num">Thuế trốn</th><th></th></tr></thead><tbody>
            ${strat.taxOffice.cases.map((c) => `<tr><td>${esc(c.emblem)} ${esc(c.clan)}</td><td>${c.day}</td><td class="num">${fmt(c.revenue)}</td><td class="num">${fmt(c.declared)}</td><td class="num warn">${fmt(c.evaded)}</td>
              <td>${manage ? `<button class="btn small" data-tax-collect="${c.id}">Truy thu</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Chưa có hồ sơ nào.</p>'}` : ''}
      </div>`;
    }
    return `<section class="card clan-box wide">
      <h3>🏛️ Hạ tầng chiến lược & ngành nhà nước</h3>
      <p class="muted small">Buff áp cho toàn bộ thị trấn. Người chơi và gia tộc hưởng buff trả phí hạ tầng ${pctInt(STRATEGIC_RULES.fee)} phần tăng thêm cho gia tộc chủ; không đủ tiền trả phí thì không được buff.
        Mỗi gia tộc chỉ nắm 1 ngành chiến lược. Gia tộc chủ nâng cấp hạ tầng để tăng buff từ +10% lên +40%.</p>
      <table class="clan-table"><thead><tr><th>Ngành</th><th class="num">Buff toàn server</th><th>Gia tộc chủ</th><th class="num">Bạn được hưởng</th></tr></thead><tbody>${rows}</tbody></table>
      ${mineBox}
    </section>`;
  }

  // ================================================================ bản đồ đất

  function heatFill(range) {
    switch (ui.heat) {
      case 'climate': return (p) => ({ sunny: '#f7d774', rainy: '#8fb8de', temperate: '#b9dba0', windy: '#c9c4e8' }[p.climate]);
      case 'price': return (p) => {
        const info = land.plots[p.id - 1];
        const v = info.price ?? info.value;
        return heatColor(1 - (v - range.min) / Math.max(1, range.max - range.min));
      };
      case 'growth': return (p) => heatColor(p.growth / LAND.maxGrowth);
      case 'fit': return (p) => heatColor((envFactor(ui.industry, p.zone, p.climate) - 0.4) / 1.0);
      case 'business': {
        // Lô có chủ tô theo ngành, lô chưa chọn ngành màu be, lô trống màu kem nhạt.
        const colors = new Map(industriesInUse(land.plots).map((u) => [u.id, u.color]));
        return (p) => {
          const info = land.plots[p.id - 1];
          return info.owner ? colors.get(info.industry) ?? BIZ_IDLE : '#f6efe4';
        };
      }
      default: return () => null;
    }
  }

  let business = new Map();
  /** Trạng thái kinh doanh của mọi lô có chủ; lô của gia tộc mình dùng ước tính mỗi đêm của máy chủ (/clans). */
  function businessMap() {
    const mine = new Map((data?.clan?.plots ?? []).map((x) => [x.id, x]));
    const upkeep = mine.size ? data.clan.upkeep / mine.size : 0;
    const closed = data?.config?.closedIndustries ?? [];
    return new Map(land.plots.filter((x) => x.owner).map((x) => [x.id, plotBusiness(x, { est: x.mine ? mine.get(x.id) ?? null : null, upkeep, closed })]));
  }

  function mapSvg() {
    const values = land.plots.map((x) => x.price ?? x.value);
    const range = { min: Math.min(...values), max: Math.max(...values) };
    // Giá thay đổi theo dữ liệu nên chế độ "giá" lấy cả khoảng giá vào khóa bộ nhớ đệm.
    const key = ui.heat === 'fit' ? `fit:${ui.industry}` : ui.heat === 'price' ? `price:${values.join(',')}` : ui.heat === 'resource' ? 'zone'
      : ui.heat === 'business' ? `business:${land.plots.map((x) => (x.owner ? x.industry ?? '-' : '')).join(',')}` : ui.heat;
    // Huy hiệu kinh doanh hiện ở chế độ địa hình và chế độ theo ngành (các chế độ khác giữ lớp phủ màu gia tộc).
    const showBiz = ui.heat === 'zone' || ui.heat === 'business';
    return landMapSvg({
      key,
      fillFor: heatFill(range),
      infos: new Map(land.plots.map((x) => [x.id, x])),
      selected: ui.plotId,
      showClimate: ui.heat === 'climate',
      resources: ui.heat === 'resource' ? new Map(land.plots.map((x) => [x.id, topDeposits(x.deposits)])) : null,
      business: showBiz ? business : null,
      tint: ui.heat !== 'business',
    });
  }

  function legend() {
    if (ui.heat === 'resource') return '<span>Biểu tượng trên mỗi ô là mỏ hoặc tài nguyên chính của lô (khai thác bằng ngành Khai khoáng, Dầu khí, Lâm nghiệp, Nông nghiệp, Chăn nuôi).</span>';
    if (ui.heat === 'business') return bizLegend(land.plots);
    if (ui.heat === 'zone') return Object.values(ZONES).map((z) => `<span><i style="background:${z.color}"></i>${z.icon} ${z.name}</span>`).join('');
    if (ui.heat === 'climate') return Object.entries(CLIMATES).map(([k, c]) => `<span><i style="background:${{ sunny: '#f7d774', rainy: '#8fb8de', temperate: '#b9dba0', windy: '#c9c4e8' }[k]}"></i>${c.icon} ${c.name}</span>`).join('');
    const label = { price: ['Đắt', 'Rẻ'], growth: ['Tăng chậm', 'Tăng nhanh'], fit: ['Không hợp', 'Rất hợp'] }[ui.heat];
    return `<span>${label[0]}</span><span class="heat-scale"></span><span>${label[1]}</span>`;
  }

  function drawMap() {
    const s = land.stats;
    const m = land.macro;
    business = businessMap();
    const mine = data.clan ? land.plots.filter((x) => x.mine).map((info) => ({ plot: PLOT_BY_ID.get(info.id), info, biz: business.get(info.id) })) : [];
    body.innerHTML = `
      <div class="land-layout">
        <section class="card land-main">
          ${myClanStrip(data.clan, mine, ui.plotId, ui.stripOpen)}
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
                ${[['zone', 'Địa hình'], ['business', 'Ngành đang kinh doanh'], ['resource', 'Tài nguyên & mỏ'], ['climate', 'Khí hậu'], ['price', 'Giá đất'], ['growth', '% tăng giá'], ['fit', 'Độ hợp ngành']].map(([k, n]) => `<option value="${k}" ${ui.heat === k ? 'selected' : ''}>${n}</option>`).join('')}
              </select></label>
            <label ${ui.heat === 'fit' ? '' : 'hidden'}>Ngành
              <select data-fit>${openIds(data?.config).map((id) => `<option value="${id}" ${ui.industry === id ? 'selected' : ''}>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}</option>`).join('')}</select></label>
          </div>
          <div class="land-wrap"><div class="land-scroll">${mapSvg()}</div>${miniMapHtml()}</div>
          <div class="land-legend">${legend()}</div>
        </section>
        <aside class="card land-panel">${plotPanel()}</aside>
      </div>`;
    bindMiniMap(body.querySelector('.land-wrap'));
    bindPlotTips(body.querySelector('.land-wrap'), (id) => {
      const p = PLOT_BY_ID.get(id);
      return plotTipHtml(p, land.plots[id - 1], business.get(id), { zoneName: ZONES[p.zone].name, money });
    });
    if (ui.plotId) loadPreview();
  }

  /** Dòng "Đang làm gì" ở đầu khung bên của lô có chủ (cảnh báo đỏ khi sản lượng 0). */
  function bizStatus(info) {
    const biz = business.get(info.id);
    if (!biz) return '';
    const ind = INDUSTRIES[info.industry];
    return `<p class="biz-status st-${biz.state}" role="status"><b>${ind ? `${ind.icon} ${esc(ind.name)}` : '💤 Chưa chọn ngành'}</b>
      ${biz.reason ? `<span>${biz.state === 'zero' ? '⚠️ ' : ''}${esc(biz.reason)}</span>` : ''}</p>`;
  }

  /** Chọn một lô: đổi viền chọn, nút trong dải "Gia tộc của tôi" và khung bên, không vẽ lại bản đồ. */
  function selectPlot(id) {
    ui.plotId = id;
    body.querySelectorAll('.land-svg .plot.sel').forEach((g) => g.classList.remove('sel'));
    const el = body.querySelector(`.land-svg .plot[data-plot="${id}"]`);
    if (el) {
      el.classList.add('sel');
      el.parentNode.append(el);
    }
    body.querySelectorAll('[data-pick-plot]').forEach((b) => b.classList.toggle('current', Number(b.dataset.pickPlot) === id));
    body.querySelector('.land-panel').innerHTML = plotPanel();
    loadPreview();
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
      ${bizStatus(info)}
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
      <div class="plot-deposits"><small class="muted">Tài nguyên mỗi đêm</small>
        ${Object.keys(info.deposits).length ? Object.entries(info.deposits).map(([g, n]) => `<span title="${esc(GOODS[g].name)}">${goodCell(g, ` <b>${n}</b>`)}</span>`).join('') : '<span class="muted">Không có mỏ (nhà máy ở đây chạy nhanh hơn)</span>'}</div>
      ${info.mine && info.industry && variantsFor(info.industry, p).length ? `<label class="plot-industry">${info.industry === 'power' ? 'Loại nhà máy điện' : 'Dây chuyền của nhà máy'}
        <select data-plant="${p.id}" ${canManage ? '' : 'disabled'}>${variantsFor(info.industry, p).map((k) => {
          const v = variantInfo(info.industry, k);
          const cur = info.industry === 'power' ? info.variant : lineOf(info.industry, info.variant);
          return `<option value="${k}" ${cur === k ? 'selected' : ''}>${v.icon} ${esc(v.name)}</option>`;
        }).join('')}</select></label>` : ''}
      ${info.owner && info.design.length ? `<div class="plot-building">${designSvg(info.design, { background: '#f7efe1' })}</div>` : ''}
      <label class="plot-industry">Xem trước với ngành
        <select data-preview-industry>${openIds(data?.config).map((id) => `<option value="${id}" ${ui.industry === id ? 'selected' : ''}>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}${myIndustries.includes(id) ? ' ✓' : ''}</option>`).join('')}</select></label>
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
      box.classList.remove('muted');
      if (pv.production) {
        box.innerHTML = productionBox(pv);
        return;
      }
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

  // ================================================================ sản xuất, kho, sàn

  let ind = null;
  const loadIndustry = (then) => api('/industry').then((d) => {
    ind = d;
    if (alive) then();
  }).catch(ctx.fail);

  function chainDiagram() {
    const col = (sector) => openIds(data?.config).filter((id) => INDUSTRIES[id].sector === sector).map((id) => `
      <div class="chain-node ${data.clan?.industries.some((i) => i.id === id) ? 'held' : ''}"><b>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}</b>${recipeLine(id, true)}</div>`).join('');
    return `<div class="chain">
      ${['raw', 'energy', 'heavy', 'light'].map((sec) => `<div class="chain-col"><h4>${SECTORS[sec].icon} ${SECTORS[sec].name}</h4>${col(sec)}</div>`).join('<div class="chain-arrow">➜</div>')}
    </div>`;
  }

  /** Sổ chào giá cho Siêu thị: lệnh của gia tộc và các mức giá đang chờ khớp (giá thấp khớp trước). */
  function shopBookBox(manage) {
    if (!ind.shopBook) return '';
    const lo = Math.round(ESSENTIALS.askMin * 100);
    const hi = Math.round(ESSENTIALS.askMax * 100);
    const cat = (c) => {
      const b = ind.shopBook[c];
      const meta = ESSENTIALS.cats[c];
      const g = GOODS[b.good];
      const book = b.book.length
        ? `<table class="clan-table"><thead><tr><th class="num">Giá chào</th><th class="num">Xu/đv</th><th class="num">Số lượng</th><th class="num">Lệnh</th></tr></thead><tbody>
          ${b.book.map((l) => `<tr class="${l.mine ? 'held' : ''}"><td class="num">${l.pct}%</td><td class="num">${fmt(Math.round((b.ref * l.pct) / 100))}</td><td class="num">${fmt(l.qty)}</td><td class="num">${l.orders}${l.mine ? ' · của mình' : ''}</td></tr>`).join('')}
        </tbody></table>`
        : '<p class="muted small">Chưa có lệnh nào.</p>';
      return `
        <div class="shop-book">
          <h4>${goodIcon(b.good)} ${esc(g.name)} → ${itemIcon({ id: meta.item, icon: meta.icon }, 3, 1)} ${esc(meta.name)} <small class="muted">giá tham chiếu ${fmt(b.ref)} · trong kho ${fmt(b.have)}</small></h4>
          ${b.ask ? `<p>Lệnh của gia tộc: <b>${fmt(b.ask.qty)}</b> đv ở <b>${b.ask.pct}%</b> (${fmt(Math.round((b.ref * b.ask.pct) / 100))} xu/đv).</p>` : ''}
          ${manage ? `<form class="row trade-form" data-form="shop-ask" data-cat="${c}">
            <label>Số lượng <input name="qty" type="number" min="0" value="${b.ask?.qty ?? (b.have || 10)}" title="Số đơn vị chào bán tối đa (0 = hủy lệnh)" /></label>
            <label>Giá <input name="pct" type="number" min="${lo}" max="${hi}" step="1" value="${b.ask?.pct ?? hi}" title="Giá chào, % giá tham chiếu" />%</label>
            <button class="btn small mint">${b.ask ? 'Sửa lệnh' : 'Chào bán'}</button>
            ${b.ask ? '<button class="btn small" name="do" value="cancel">Hủy</button>' : ''}
          </form>` : ''}
          ${book}
        </div>`;
    };
    return `
      <section class="card clan-box wide">
        <h3>🏪 Sổ chào giá cho Siêu thị</h3>
        <p class="muted small">Chào bán hàng trong kho cho Siêu thị ở ${lo}–${hi}% giá tham chiếu. Lúc nửa đêm Siêu thị khớp từ giá thấp lên; cùng giá thì hàng chất lượng cao hơn, rồi lệnh đặt trước được mua trước. Sau sổ chào Siêu thị mới mua hàng vừa làm ra theo giá 100%. Mỗi gia tộc vẫn bán tối đa ${pctInt(ESSENTIALS.perClanShare)} lượng thu mua của một đêm. Đặt lệnh thì mặt hàng được giữ trong kho; tiền bán tính thuế như giao dịch trên sàn.</p>
        <div class="shop-books">${ESSENTIAL_CATS.map(cat).join('')}</div>
      </section>`;
  }

  function drawProduction() {
    if (!ind) return loadIndustry(drawProduction);
    const manage = ind.clan && (ind.clan.role === 'leader' || ind.clan.role === 'elder');
    const goods = ind.goods.filter((g) => g.good !== 'power');
    body.innerHTML = `
      <div class="clan-grid">
        <section class="card clan-box wide">
          <div class="row-between"><h3>📦 Kho gia tộc</h3><span class="muted">${fmt(ind.used)}/${fmt(ind.capacity)} đơn vị · quỹ ${money(ind.clan.treasury)}</span></div>
          <div class="bar"><i style="width:${Math.min(100, (ind.used / ind.capacity) * 100)}%;background:var(--tea)"></i></div>
          ${goods.length ? `<table class="clan-table"><thead><tr><th>Hàng</th><th class="num">Tồn</th><th class="num">Giá NPC mua</th><th>Mỗi đêm</th><th>Bán / đăng sàn</th></tr></thead><tbody>
            ${goods.map((g) => `<tr>
              <td>${goodCell(g.good, g.input ? ' <small class="muted">(nguyên liệu)</small>' : '')}</td>
              <td class="num">${fmt(g.qty)}</td>
              <td class="num">${fmt(ind.prices[g.good].npc)}</td>
              <td><label class="check"><input type="checkbox" data-keep="${g.good}" ${g.keep ? 'checked' : ''} ${manage ? '' : 'disabled'}/> Giữ trong kho</label></td>
              <td>${manage && g.qty ? `<form class="row trade-form" data-form="goods" data-good="${g.good}">
                <input name="qty" type="number" min="1" max="${g.qty}" value="${g.qty}" />
                <input name="price" type="number" min="1" value="${ind.prices[g.good].ref}" title="Giá đăng sàn mỗi đơn vị" />
                <button class="btn small" name="do" value="sell">Bán NPC</button>
                <button class="btn small mint" name="do" value="list">Đăng sàn</button></form>` : ''}</td>
            </tr>`).join('')}</tbody></table>` : '<p class="muted">Kho trống. Lô làm ngành khai thác hoặc nhà máy sẽ đưa hàng vào đây mỗi đêm.</p>'}
          <p class="muted small">Mặc định gia tộc giữ những hàng là nguyên liệu cho nhà máy của mình; hàng khác và điện thừa tự bán cho NPC lúc nửa đêm theo giá vĩ mô. Tiền bán hàng tính vào doanh thu chịu thuế.</p>
        </section>
        ${shopBookBox(manage)}
        <section class="card clan-box">
          <h3>🚢 Nhập khẩu nguyên liệu</h3>
          <p class="muted small">Mua từ NPC với giá gấp ${pctInt(ind.rules.importMarkup)} giá tham chiếu, khi gia tộc không tự khai thác được hoặc sàn không có.</p>
          <form class="row" data-form="import">
            <select name="good">${GOOD_ORDER.filter((g) => g !== 'power').map((g) => `<option value="${g}">${GOODS[g].icon} ${esc(GOODS[g].name)} · ${fmt(ind.prices[g].import)}</option>`).join('')}</select>
            <input name="qty" type="number" min="1" value="10" />
            <button class="btn gold" ${manage ? '' : 'disabled'}>Nhập</button>
          </form>
        </section>
        <section class="card clan-box">
          <h3>🌙 Sản xuất đêm qua ${ind.production ? `(${ind.production.day.slice(8)}/${ind.production.day.slice(5, 7)})` : ''}</h3>
          ${ind.production?.rows.length ? `<table class="clan-table"><thead><tr><th>Hàng</th><th class="num">Làm ra</th><th class="num">Dùng</th><th class="num">Bán NPC</th><th class="num">Tiền</th></tr></thead><tbody>
            ${ind.production.rows.map((r) => `<tr><td>${goodCell(r.good)}</td><td class="num">${fmt(r.produced)}</td><td class="num">${fmt(r.used)}</td><td class="num">${fmt(r.sold)}</td><td class="num">${fmt(r.revenue)}</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">Chưa có đêm sản xuất nào.</p>'}
          ${ind.trades.length ? `<h4>Giao dịch gần đây</h4><ul class="refund-list trade-list">${ind.trades.map((t) => `<li>${t.side === 'sell' ? '📤 Bán' : '📥 Mua'} ${fmt(t.qty)} ${goodCell(t.good)} ${t.side === 'sell' ? 'cho' : 'của'} ${esc(t.other)} · ${fmt(t.price)}/đv</li>`).join('')}</ul>` : ''}
        </section>
        <section class="card clan-box wide">
          <h3>🔗 Chuỗi ngành</h3>
          <p class="muted small">Khai thác và nông nghiệp làm ra nguyên liệu, nhà máy điện cấp điện, công nghiệp nặng luyện thành vật liệu và máy móc, công nghiệp nhẹ làm hàng tiêu dùng. Ngành gia tộc đang nắm được tô sáng.</p>
          ${chainDiagram()}
        </section>
      </div>`;
  }

  /** Ô mua một tin đăng, giới hạn theo hạn mức mua gom 24 giờ của gia tộc (Sở Công Thương). */
  function buyForm(l) {
    const left = ind.buyLeft?.[l.good] ?? l.qty;
    const max = Math.min(l.qty, left);
    if (max <= 0) return '<span class="muted small">Đã đủ hạn mức mua 24 giờ</span>';
    return `<form class="row trade-form" data-form="buy" data-listing="${l.id}"><input name="qty" type="number" min="1" max="${max}" value="${max}" title="Còn được mua ${fmt(left)} đv mặt hàng này trong 24 giờ" /><button class="btn small primary">Mua</button></form>`;
  }

  function drawMarket() {
    if (!ind) return loadIndustry(drawMarket);
    const manage = ind.clan && (ind.clan.role === 'leader' || ind.clan.role === 'elder');
    const byGood = GOOD_ORDER.filter((g) => ind.listings.some((l) => l.good === g));
    body.innerHTML = `
      <div class="clan-grid">
        <section class="card clan-box wide">
          <h3>🏪 Sàn công nghiệp</h3>
          <p class="muted small">Gia tộc đăng bán hàng trong kho với giá ${pctInt(ind.rules.band[0])}–${pctInt(ind.rules.band[1])} giá tham chiếu; gia tộc khác mua về kho để làm nguyên liệu.
            Phí sàn ${pctInt(ind.rules.fee)} do người bán trả. Tin đăng hết hạn sau ${ind.rules.listingDays} ngày, hàng tự về kho.</p>
          <p class="muted small">🏛️ Sở Công Thương: trong 24 giờ mỗi gia tộc mua tối đa ${pctInt(ind.rules.buyCapShare)} số hàng đang niêm yết của một mặt hàng (luôn được ít nhất ${fmt(ind.rules.buyCapMin)} đv).
            Gia tộc bán quá ${pctInt(ind.rules.antitrustShare)} khối lượng một mặt hàng trên sàn trong ${ind.rules.windowDays} ngày thì phần vượt chịu thêm thuế chống độc quyền ${pctInt(ind.rules.antitrustRate)}.</p>
          ${byGood.length ? `<table class="clan-table"><thead><tr><th>Hàng</th><th>Gia tộc bán</th><th class="num">Còn</th><th class="num">Giá/đv</th><th class="num">Tham chiếu</th><th></th></tr></thead><tbody>
            ${byGood.flatMap((g) => ind.listings.filter((l) => l.good === g).map((l) => `<tr>
              <td>${goodCell(g)}</td>
              <td><span class="owner-tag" style="--clan:${esc(l.clan.color)}">${esc(l.clan.emblem)} ${esc(l.clan.name)}</span></td>
              <td class="num">${fmt(l.qty)}</td>
              <td class="num">${fmt(l.price)}</td>
              <td class="num muted">${fmt(ind.prices[g].ref)}</td>
              <td>${l.mine ? (manage ? `<button class="link-btn danger" data-cancel-listing="${l.id}">Gỡ tin</button>` : '')
                : manage ? buyForm(l) : ''}</td>
            </tr>`)).join('')}</tbody></table>` : '<p class="muted">Chưa có tin đăng nào. Đăng hàng từ tab Sản xuất & Kho.</p>'}
          ${!ind.clan ? '<p class="muted small">Vào một gia tộc để mua bán trên sàn.</p>' : ''}
        </section>
        <section class="card clan-box wide">
          <h3>📈 Giá tham chiếu hôm nay</h3>
          <div class="price-grid">${GOOD_ORDER.map((g) => `<span>${goodCell(g)} <b>${fmt(ind.prices[g].ref)}</b></span>`).join('')}</div>
          <p class="muted small">Giá = giá gốc × cầu của ngành làm ra hàng đó × chu kỳ kinh tế (xem tab Vĩ mô).</p>
        </section>
      </div>`;
  }

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
            ${Object.entries(SECTORS).map(([sector, sec]) => {
              const ids = openIds(data.config).filter((id) => INDUSTRIES[id].sector === sector);
              if (!ids.length) return '';
              const held = ids.filter((id) => data.config.industryClans?.[id]).length;
              // Khối dịch vụ (gần Sàn Nguyên Liệu nhất) mở sẵn; các khối khác gập lại cho gọn.
              return `<details class="demand-sector" ${sector === 'service' ? 'open' : ''}>
                <summary>${sec.icon} ${esc(sec.name)} <small class="muted">${ids.length} ngành${held ? ` · ${held} ngành có gia tộc nắm` : ''}</small></summary>
                <div class="demand-list">${ids.map((id) => {
                  const d = today.demand[id] ?? 1;
                  const clans = data.config.industryClans?.[id] ?? 0;
                  return `<div class="demand"><span>${INDUSTRIES[id].icon} ${esc(INDUSTRIES[id].name)}${clans ? ` <small class="badge" title="${clans} gia tộc đang nắm">🏯${clans}</small>` : ''}</span>
                    <div class="bar"><i style="width:${Math.round(((d - 0.7) / 0.65) * 100)}%;background:${d >= 1 ? 'var(--mint-deep)' : 'var(--pink-deep)'}"></i></div>
                    <b class="${d > 1 ? 'up' : d < 1 ? 'down' : ''}">${signed(d - 1)}</b></div>`;
                }).join('')}</div></details>`;
            }).join('')}
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
    if ((el = on('[data-cancel-listing]'))) act(`/industry/listings/${el.dataset.cancelListing}/cancel`);
    else if (on('[data-infra-upgrade]')) act('/clans/strategic/upgrade');
    else if ((el = on('[data-op-remove]'))) act('/clans/strategic/operator/remove', { plotId: Number(el.dataset.opRemove) });
    else if ((el = on('[data-tax-collect]'))) {
      if (confirm('Truy thu hồ sơ này? Tiền lấy từ quỹ gia tộc trốn thuế.')) act(`/clans/tax-office/${el.dataset.taxCollect}/collect`);
    } else if ((el = on('[data-ballot]'))) act(`/clans/votes/${el.dataset.ballot}`, { yes: el.dataset.yes === '1' });
    else if ((el = on('[data-withdraw]'))) {
      const penalty = Number(el.dataset.penalty);
      if (!penalty || confirm(`Rút gấp trước hạn: mất lãi và bị phạt ${fmt(penalty)} xu. Tiếp tục?`)) act(`/clans/deposits/${el.dataset.withdraw}/withdraw`);
    } else if ((el = on('[data-emblem]'))) {
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
    } else if ((el = on('[data-strip-toggle]'))) {
      // Điện thoại: mở/thu dải "Gia tộc của tôi", giữ lựa chọn qua các lần vẽ lại bản đồ.
      ui.stripOpen = !ui.stripOpen;
      el.closest('.biz-strip').classList.toggle('collapsed', !ui.stripOpen);
      el.setAttribute('aria-expanded', String(ui.stripOpen));
      el.querySelector('span').textContent = ui.stripOpen ? 'Thu gọn' : 'Xem các lô';
    } else if ((el = on('[data-pick-plot]'))) {
      // Nút lô trong dải "Gia tộc của tôi": chọn lô như chạm trên bản đồ, cuộn bản đồ tới lô đó (điện thoại).
      selectPlot(Number(el.dataset.pickPlot));
      scrollToPlot(body.querySelector('.land-wrap'), Number(el.dataset.pickPlot));
    } else if ((el = on('[data-plot]'))) {
      // Chỉ đổi lô đang chọn và khung bên, không vẽ lại bản đồ.
      selectPlot(Number(el.dataset.plot));
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
    } else if (t.matches('[data-plant]')) {
      act(`/land/${t.dataset.plant}/plant`, { plant: t.value });
    } else if (t.matches('[data-keep]')) {
      act('/industry/keep', { good: t.dataset.keep, keep: t.checked });
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
      case 'deposit': return act('/clans/deposits', { amount: Number(fd.amount), term: Number(fd.term) });
      case 'depose':
        if (!confirm('Mở phiếu phế truất tộc trưởng? Mọi thành viên sẽ thấy và bỏ phiếu.')) return undefined;
        return act('/clans/depose', { candidateId: Number(fd.candidate) });
      case 'declare': return act('/clans/declare', { ratio: Number(fd.ratio) / 100 });
      case 'import': return act('/industry/import', { good: fd.good, qty: Number(fd.qty) });
      case 'shop-ask': return act('/industry/shop-ask', { cat: form.dataset.cat, qty: e.submitter?.value === 'cancel' ? 0 : Number(fd.qty), pct: Number(fd.pct) });
      case 'operator': return act('/clans/strategic/operator', { plotId: Number(fd.plotId), petId: Number(fd.petId) });
      case 'buy': return act(`/industry/listings/${form.dataset.listing}/buy`, { qty: Number(fd.qty) });
      case 'goods': {
        const mode = e.submitter?.value === 'list' ? 'list' : 'sell';
        const good = form.dataset.good;
        return mode === 'list' ? act('/industry/list', { good, qty: Number(fd.qty), price: Number(fd.price) }) : act('/industry/sell', { good, qty: Number(fd.qty) });
      }
      default: return undefined;
    }
  });

  return () => {
    alive = false;
  };
}
