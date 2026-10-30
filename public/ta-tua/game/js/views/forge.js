// Lò rèn (sửa đồ hỏng sau đấu trường, nâng cấp) và Tiệm vật liệu (hàng thô giá cao để rèn).
import { api } from '../api.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';
import { AFFIXES, AFFIX_ORDER, TIERS, affixText, nextTier } from '../shared/gear.js';
import { itemIcon } from '../itemart.js';

const tierChip = (tier) => (TIERS[tier] ? `<span class="tier-chip tier-${tier}">${TIERS[tier].name}</span>` : '');

/** Nhãn độ bền: hỏng, hoặc đang ở lò kèm thời gian còn lại. Rỗng khi món đang dùng được. */
export function durabilityChip(g, now = Date.now()) {
  if (g.broken) return '<span class="dura-chip broken" title="Hỏng sau trận đấu trường: không cộng chỉ số tới khi sửa ở Lò rèn">🔧 Hỏng</span>';
  if (g.repairUntil && g.repairUntil > now) {
    return `<span class="dura-chip repairing" title="Đang sửa ở Lò rèn, chưa cộng chỉ số">⏳ Đang sửa · còn ${countdown(g.repairUntil - now)}</span>`;
  }
  return '';
}

const lotsText = (n) => `${fmt(n)} lô vật liệu`;

/** Lời xác nhận trước khi sửa / nâng cấp: tỉ lệ, giá và điều xảy ra khi thất bại. `forge` là kết quả GET /forge. */
export function forgeConfirmText(kind, g, item, forge) {
  const r = forge.rules;
  if (kind === 'repair') {
    const c = r.repair[g.tier];
    return `Sửa ${item.name} (${TIERS[g.tier].name})?\n\n`
      + `Tỉ lệ thành công: ${r.repairChance}%\nGiá: ${fmt(c.coins)} xu và ${lotsText(c.lots)} (bạn có ${fmt(forge.materialLots)} lô)\n\n`
      + `Thành công: món ở lò ${r.repairHours} giờ rồi mới cộng chỉ số lại.\nThất bại: mất xu và vật liệu, món vẫn hỏng.`;
  }
  const to = nextTier(g.tier);
  const c = r.upgrade[g.tier];
  return `Nâng ${item.name} từ ${TIERS[g.tier].name} lên ${TIERS[to].name}?\n\n`
    + `Tỉ lệ thành công: ${r.upgradeChance[g.tier]}%\nGiá: ${fmt(c.coins)} xu và ${lotsText(c.lots)} (bạn có ${fmt(forge.materialLots)} lô)\n\n`
    + `Thành công: giữ các dòng cũ (nâng theo cấp mới) và thêm 1 dòng.\nThất bại: mất xu và vật liệu, món giữ nguyên.`;
}

/** Nút sửa / nâng cấp cho một món (đã mở hộp). `forge` có thể chưa tải: khi đó không ghi tỉ lệ trên nút. */
export function forgeButtons(g, forge, now = Date.now()) {
  if (g.sealed || g.listed) return '';
  if (g.broken) {
    const chance = forge ? ` ${forge.rules.repairChance}%` : '';
    return `<button class="btn small gold" data-forge-repair="${g.id}">🔨 Sửa${chance}</button>`;
  }
  if (g.repairUntil && g.repairUntil > now) return '';
  if (!nextTier(g.tier)) return '';
  const chance = forge ? ` ${forge.rules.upgradeChance[g.tier]}%` : '';
  return `<button class="btn small" data-forge-upgrade="${g.id}">⬆️ Nâng cấp${chance}</button>`;
}

function forgeCard(g, ctx, forge, now) {
  const item = ctx.catalog.items[g.itemId] ?? { name: g.name, icon: '🎀' };
  const r = forge.rules;
  const to = nextTier(g.tier);
  let cost = '';
  if (g.broken) cost = `Sửa: ${fmt(r.repair[g.tier].coins)} 🪙 + ${fmt(r.repair[g.tier].lots)} lô · ${r.repairChance}%`;
  else if (to && !(g.repairUntil > now)) cost = `Lên ${TIERS[to].name}: ${fmt(r.upgrade[g.tier].coins)} 🪙 + ${fmt(r.upgrade[g.tier].lots)} lô · ${r.upgradeChance[g.tier]}%`;
  else if (!to) cost = 'Cấp cao nhất';
  return `
    <article class="card item-card gear-card tier-${esc(g.tier)}">
      <div class="icon">${itemIcon(item)}</div>
      <h3>${esc(item.name)} ${tierChip(g.tier)}</h3>
      ${durabilityChip(g, now)}
      <ul class="gear-lines ${g.usable === false ? 'off' : ''}">${AFFIX_ORDER.filter((a) => g.affixes?.[a]).map((a) => `<li title="${esc(AFFIXES[a].desc)}">${affixText(a, g.affixes[a])}</li>`).join('')}</ul>
      <p class="muted small forge-cost">${esc(cost)}</p>
      <div class="foot">${forgeButtons(g, forge, now)}</div>
    </article>`;
}

/** Màn Lò rèn: đồ hỏng lên đầu, rồi đồ đang sửa, rồi đồ nâng cấp được. */
export function renderForge(root, ctx) {
  root.innerHTML = `<div class="forge-page">
    ${viewHead('⚒️ Lò rèn', 'Sửa trang phục hỏng sau trận đấu trường, hoặc thử vận may nâng cấp lên cấp cao hơn.')}
    <div class="forge-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const view = root.querySelector('.forge-view');
  api('/forge').then((forge) => {
    if (!view.isConnected) return;
    const now = Date.now();
    const r = forge.rules;
    const gear = (ctx.me.gear ?? []).filter((g) => !g.sealed && !g.listed);
    const rank = (g) => (g.broken ? 0 : g.repairUntil > now ? 1 : 2);
    const order = Object.keys(TIERS);
    gear.sort((a, b) => rank(a) - rank(b) || order.indexOf(b.tier) - order.indexOf(a.tier) || b.id - a.id);
    const broken = gear.filter((g) => g.broken).length;
    view.innerHTML = `
      <section class="card forge-rules">
        <p>🔨 <b>Sửa:</b> ${r.repairChance}% thành công, xong thì món ở lò ${r.repairHours} giờ. Thất bại mất xu và vật liệu, món vẫn hỏng.</p>
        <p>⬆️ <b>Nâng cấp:</b> ${Object.entries(r.upgradeChance).map(([t, c]) => `${TIERS[t].name} → ${TIERS[nextTier(t)].name} ${c}%`).join(' · ')}. Thất bại mất xu và vật liệu, món giữ nguyên.</p>
        <p class="muted small">Vật liệu là hàng thô bất kỳ trong kho (rớt từ mini-game, mua trên Sàn hoặc ở Tiệm vật liệu). Bạn đang có <b>${fmt(forge.materialLots)} lô</b>.
          <button class="btn small" data-go="materials">🧺 Tiệm vật liệu</button></p>
      </section>
      ${broken ? `<p class="blocked">🔧 ${broken} món đang hỏng, không cộng chỉ số cho bé.</p>` : ''}
      ${gear.length
        ? `<div class="item-grid">${gear.map((g) => forgeCard(g, ctx, forge, now)).join('')}</div>`
        : '<div class="empty muted">Chưa có trang phục nào (hộp chưa mở thì mở ở Túi đồ trước).</div>'}`;
  }).catch(ctx.fail);
}

/** Tiệm vật liệu: bán hàng thô gấp nhiều lần giá Sàn, về thẳng kho. */
export function renderMaterials(root, ctx) {
  root.innerHTML = `<div class="forge-page">
    ${viewHead('🧺 Tiệm vật liệu', 'Thiếu vật liệu rèn? Tiệm bán sẵn hàng thô, giá cao hơn Sàn nhiều lần.')}
    <div class="forge-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const view = root.querySelector('.forge-view');
  const draw = () => api('/forge').then((forge) => {
    if (!view.isConnected) return;
    view.innerHTML = `
      <p class="muted small">Giá gấp ${String(forge.rules.shopMarkup).replace('.', ',')} lần giá Sàn hiện tại, mỗi lô 10 phần. Bạn đang có <b>${fmt(forge.materialLots)} lô</b> vật liệu.
        <button class="btn small" data-go="forge">⚒️ Lò rèn</button></p>
      <div class="item-grid">${forge.materials.map((m) => `
        <article class="card item-card">
          <div class="icon">${esc(m.icon)}</div>
          <h3>${esc(m.name)}</h3>
          <p class="price">${fmt(m.price)} 🪙 <small class="muted">/ lô</small></p>
          <div class="foot">
            <button class="btn small" data-mat="${esc(m.commodity)}" data-lots="1">Mua 1 lô</button>
            <button class="btn small mint" data-mat="${esc(m.commodity)}" data-lots="5">Mua 5 lô · ${fmt(m.price * 5)} 🪙</button>
          </div>
        </article>`).join('')}</div>`;
  }).catch(ctx.fail);
  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mat]');
    if (!btn) return;
    btn.disabled = true;
    ctx.act('/forge/materials', { commodity: btn.dataset.mat, lots: Number(btn.dataset.lots) });
  });
  draw();
}
