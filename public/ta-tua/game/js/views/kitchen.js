// Bếp: nấu món theo công thức, thử ghép nguyên liệu tìm món ẩn, tủ món đã nấu (cho bé ăn, bán cho quán, rao Chợ Phiên).
import { api } from '../api.js';
import { closeModal, countdown, esc, fmt, modalOpen, openModal, viewHead } from '../ui.js';
import { sceneHdr } from '../scenes-hdr.js';

const EFFECTS = {
  fullness: { icon: '🍙', name: 'No bụng' },
  happiness: { icon: '💖', name: 'Vui vẻ' },
  energy: { icon: '⚡', name: 'Năng lượng' },
  health: { icon: '❤️', name: 'Sức khỏe' },
  hygiene: { icon: '🫧', name: 'Sạch sẽ' },
};
const MIX_MAX = 9; // mỗi nguyên liệu thử tối đa 9 phần
const SOON_MS = 6 * 3600_000; // món sắp hư: còn dưới 6 giờ

let mix = {}; // nguyên liệu đang ghép thử: { commodity: phần }
let lastAuto = 0;

export function renderKitchen(root, ctx) {
  root.innerHTML = `<div class="kitchen-page">
    ${viewHead('🍳 Bếp', 'Nấu nguyên liệu trong kho thành món ngon cho bé ăn hoặc đem bán. Ghép thử để tìm món ẩn!')}
    ${sceneHdr('kitchen')}
    <div class="kitchen-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.kitchen-page');
  const view = page.querySelector('.kitchen-view');
  const need = ctx.catalog.unlocks.kitchen;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Bếp chưa mở</h2>
      <p class="muted">Có một bé đạt cấp ${need} là được vào bếp nấu nướng.</p></section>`;
    return;
  }

  const { commodities, kitchen: rules, skills } = ctx.catalog;
  let data = null;
  let timer = 0;

  const multText = (m) => `×${m.toLocaleString('vi-VN')}`;
  const commodityLabel = (id) => {
    const c = commodities[id];
    return c ? `${esc(c.icon)} ${esc(c.name)}` : esc(id);
  };
  const effectText = (effect = {}, mult = 1) => Object.entries(effect)
    .map(([k, v]) => `<span title="${esc(EFFECTS[k]?.name ?? k)}">${EFFECTS[k]?.icon ?? '✨'} +${Math.round(v * mult)}</span>`)
    .join(' ');
  /** Món đã nấu chỉ có mã công thức; tên và biểu tượng lấy từ công thức đã biết hoặc catalog. */
  const dishDef = (recipe) => data.recipes[recipe] ?? rules.dishes[recipe] ?? { name: 'Món bí ẩn', icon: '🍽️', effect: {} };

  /** Bé chính có nấu được không: trả về lý do nếu không. */
  function chefBlock() {
    const chef = ctx.activePet();
    if (!chef) return 'Cần một bé vào bếp.';
    if (chef.sick) return `${esc(chef.sick.icon)} ${esc(chef.name)} đang ${esc(chef.sick.name.toLowerCase())}, đưa bé đi khám rồi hẵng vào bếp.`;
    if (chef.energy < rules.energy) return `😴 ${esc(chef.name)} cần ${rules.energy} ⚡ để nấu (đang có ${chef.energy}), cho bé nghỉ chút đã.`;
    return '';
  }

  function chefBox() {
    const chef = ctx.activePet();
    if (!chef) {
      return `<section class="card kitchen-box kitchen-chef wide">
        <p>Chưa có bé nào làm đầu bếp.</p><div class="row"><button class="btn small primary" data-go="home">🏠 Nhận nuôi một bé</button></div></section>`;
    }
    const craft = Math.floor(chef.skills?.craft ?? 0);
    const block = chefBlock();
    const [plain, good, great] = rules.quality;
    return `
      <section class="card kitchen-box kitchen-chef wide">
        <div class="kitchen-chef-head">
          <span class="kitchen-hat">👩‍🍳</span>
          <div>
            <b>Đầu bếp hôm nay: ${esc(chef.name)}</b> <span class="badge level">Lv ${chef.level}</span>
            <br><small class="muted">⚡ ${chef.energy}/100 · ${esc(skills.craft.icon)} ${esc(skills.craft.name)} ${craft}</small>
          </div>
          <button class="btn small" data-go="home">Đổi bé chính</button>
        </div>
        <p class="muted small">Mỗi lần nấu, bé chính vào bếp và tốn ${rules.energy} ⚡.
          ${esc(skills.craft.name)} càng cao càng dễ ra món ${esc(good.name)} (${multText(good.mult)}) hay ${esc(great.name)} (${multText(great.mult)}) thay vì ${esc(plain.name)}.
          Học thêm ở <button class="link-btn" data-go="school">Trường học</button>.</p>
        ${block ? `<p class="blocked">${block}${chef.sick ? ' <button class="link-btn" data-go="clinic">Tới phòng khám</button>' : ''}</p>` : ''}
      </section>`;
  }

  function recipeCard(id, r, canCook) {
    const ok = r.canMake > 0;
    return `
      <article class="card kitchen-recipe ${ok ? '' : 'is-short'}">
        <header>
          <span class="kitchen-icon">${esc(r.icon)}</span>
          <div>
            <h4>${esc(r.name)}</h4>
            ${r.hidden ? '<span class="badge star">✨ Món bí mật</span>' : ''}
          </div>
        </header>
        <ul class="kitchen-inputs">${Object.entries(r.inputs).map(([c, n]) => {
          const have = data.goods[c] ?? 0;
          return `<li class="${have >= n ? '' : 'down'}"><span>${commodityLabel(c)}</span><b>${have}/${n}</b></li>`;
        }).join('')}</ul>
        <p class="kitchen-effect">${effectText(r.effect)}</p>
        <p class="muted small">Giá tham chiếu ~${fmt(r.value)} 🪙 (loại ${esc(rules.quality[0].name)})</p>
        <div class="row-between">
          <small class="${ok ? 'up' : 'muted'}">${ok ? `Đủ nấu ${r.canMake} lần` : 'Thiếu nguyên liệu'}</small>
          <button class="btn small primary" data-cook="${esc(id)}" ${ok && canCook ? '' : 'disabled'}>🍳 Nấu</button>
        </div>
      </article>`;
  }

  function labPanel() {
    const canCook = !chefBlock();
    const owned = Object.keys(commodities).filter((c) => (data.goods[c] ?? 0) > 0);
    for (const c of Object.keys(mix)) {
      const have = data.goods[c] ?? 0;
      if (have <= 0 || !(mix[c] > 0)) delete mix[c];
      else mix[c] = Math.min(mix[c], have, MIX_MAX);
    }
    const total = Object.values(mix).reduce((s, n) => s + n, 0);
    return `
      <h3>🧪 Thử công thức</h3>
      <p class="muted small">${data.hiddenLeft
        ? `Còn <b>${data.hiddenLeft}</b> món ẩn chưa khám phá. Ghép thử nguyên liệu trong kho, trúng công thức là học được món mới!`
        : 'Bạn đã khám phá hết các món ẩn rồi, giỏi quá!'}
        Ghép sai thì <b>không mất nguyên liệu</b>, cứ thử thoải mái.</p>
      ${owned.length ? `<ul class="kitchen-mix">${owned.map((c) => {
        const have = data.goods[c];
        const n = mix[c] ?? 0;
        const name = esc(commodities[c].name);
        return `
          <li class="${n ? 'is-on' : ''}">
            <span>${commodityLabel(c)} <small class="muted">kho ${have}</small></span>
            <span class="kitchen-step">
              <button class="btn small" data-mix="${esc(c)}" data-step="-1" ${n > 0 ? '' : 'disabled'} aria-label="Bớt ${name}">−</button>
              <b>${n}</b>
              <button class="btn small" data-mix="${esc(c)}" data-step="1" ${n < Math.min(have, MIX_MAX) ? '' : 'disabled'} aria-label="Thêm ${name}">＋</button>
            </span>
          </li>`;
      }).join('')}</ul>`
        : `<p class="muted">Kho đang trống. Thu hoạch ở Vườn hoặc mua ở Sàn rồi quay lại nhé.</p>
           <div class="row"><button class="btn small" data-go="garden">🌱 Ra vườn</button><button class="btn small" data-go="market">📈 Tới Sàn</button></div>`}
      ${owned.length ? `
        <div class="row">
          <button class="btn pink" data-mix-cook ${total && canCook ? '' : 'disabled'}>🧪 Nấu thử${total ? ` (${total} phần)` : ''}</button>
          ${total ? '<button class="btn small" data-mix-clear>Làm lại</button>' : ''}
        </div>` : ''}`;
  }

  function dishRow(d) {
    const def = dishDef(d.recipe);
    const mult = rules.quality[d.quality]?.mult ?? 1;
    const left = d.expiresAt - Date.now();
    return `
      <li class="kitchen-dish q${Number(d.quality)} ${left < SOON_MS ? 'is-soon' : ''}" data-expires="${Number(d.expiresAt)}">
        <span class="kitchen-icon small">${esc(def.icon)}</span>
        <div class="kitchen-dish-main">
          <div><b>${esc(def.name)}</b> <span class="badge kitchen-q q${Number(d.quality)}">${esc(d.qualityName)}</span></div>
          <small class="kitchen-effect">${effectText(def.effect, mult)}</small>
          <small class="muted">⏳ Hư sau <span class="kitchen-left">${countdown(left)}</span> · tham chiếu ${fmt(d.value)} 🪙</small>
        </div>
        <div class="kitchen-dish-actions">
          <button class="btn small mint" data-eat="${Number(d.id)}">🍽️ Cho bé ăn</button>
          <button class="btn small gold" data-sell="${Number(d.id)}">💰 Bán cho quán · ${fmt(d.npcPrice)} 🪙</button>
        </div>
      </li>`;
  }

  function draw() {
    const canCook = !chefBlock();
    const recipes = Object.entries(data.recipes);
    view.innerHTML = `
      <div class="kitchen-grid">
        ${chefBox()}
        <section class="kitchen-recipes wide">
          <div class="row-between">
            <h3>📒 Công thức đã biết</h3>
            <button class="btn small" data-go="market">📈 Mua nguyên liệu ở Sàn</button>
          </div>
          <p class="muted small">Nguyên liệu tính bằng phần (có/cần), lấy từ kho của bạn ở Sàn.</p>
          <div class="kitchen-recipe-grid">${recipes.map(([id, r]) => recipeCard(id, r, canCook)).join('')}</div>
        </section>
        <section class="card kitchen-box kitchen-lab">${labPanel()}</section>
        <section class="card kitchen-box kitchen-shelf">
          <h3>🍱 Tủ món đã nấu <small class="muted">${data.dishes.length}</small></h3>
          ${data.dishes.length
            ? `<ul class="kitchen-dishes">${data.dishes.map(dishRow).join('')}</ul>`
            : '<p class="muted">Tủ đang trống. Nấu món đầu tiên cho bé nhé!</p>'}
          <p class="muted small">Món nấu để được ${rules.shelfDays} ngày rồi hư. Quán ăn đầu phố mua lại bằng ${Math.round(rules.npcRate * 100)}% giá tham chiếu.</p>
          <div class="kitchen-bazaar">
            <span class="small">Muốn bán được giá hơn? Bày món ở Chợ Phiên cho người chơi khác mua.</span>
            <button class="btn small" data-go="bazaar">🏮 Tới Chợ Phiên</button>
          </div>
        </section>
      </div>`;
  }

  function redrawLab() {
    const lab = view.querySelector('.kitchen-lab');
    if (lab) lab.innerHTML = labPanel();
  }

  function feed(dishId) {
    const pets = ctx.me.pets;
    const dish = data.dishes.find((d) => d.id === dishId);
    if (!pets.length || !dish) return;
    if (pets.length === 1) return ctx.act(`/kitchen/dishes/${dishId}/eat`, { petId: pets[0].id });
    const def = dishDef(dish.recipe);
    const active = ctx.activePet();
    const ordered = [active, ...pets.filter((p) => p.id !== active?.id)].filter(Boolean);
    openModal({
      title: `Cho bé nào ăn ${def.name}?`,
      html: `
        <div class="pick-list">${ordered.map((p) => `
          <button class="pick ${p.id === active?.id ? 'current' : ''}" data-pick="${Number(p.id)}">
            <b>${p.id === active?.id ? '⭐' : '🐾'}</b>
            <span>${esc(p.name)} · Lv ${p.level}${p.id === active?.id ? ' · bé chính' : ''}
              <small>🍙 ${p.fullness} · 💖 ${p.happiness} · ⚡ ${p.energy}${p.fullness >= 97 && def.effect?.fullness ? ' · no căng bụng rồi' : ''}</small>
            </span>
            <span></span>
          </button>`).join('')}</div>
        <p class="muted small">Hiệu quả: ${effectText(def.effect, rules.quality[dish.quality]?.mult ?? 1)}</p>`,
      onPick: (petId) => {
        closeModal();
        ctx.act(`/kitchen/dishes/${dishId}/eat`, { petId: Number(petId) });
      },
    });
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || !data) return;
    const d = btn.dataset;
    if (d.cook) {
      ctx.act('/kitchen/cook', { recipe: d.cook });
    } else if (d.mix) {
      const c = d.mix;
      mix[c] = Math.max(0, Math.min((mix[c] ?? 0) + Number(d.step), data.goods[c] ?? 0, MIX_MAX));
      redrawLab();
    } else if (d.mixClear !== undefined) {
      mix = {};
      redrawLab();
    } else if (d.mixCook !== undefined) {
      const inputs = Object.fromEntries(Object.entries(mix).filter(([, n]) => n > 0));
      if (!Object.keys(inputs).length) return;
      ctx.act('/kitchen/cook', { inputs }, { onResult: () => { mix = {}; } });
    } else if (d.eat) {
      feed(Number(d.eat));
    } else if (d.sell) {
      ctx.act(`/kitchen/dishes/${Number(d.sell)}/sell`);
    }
  });

  async function load() {
    const k = await api('/kitchen');
    if (!view.isConnected) return;
    data = k;
    draw();
  }

  /** Đồng hồ hạn dùng của món; món hư thì tải lại tủ. */
  function tick() {
    if (!view.isConnected) return clearInterval(timer);
    let spoiled = false;
    for (const li of view.querySelectorAll('.kitchen-dish[data-expires]')) {
      const left = Number(li.dataset.expires) - Date.now();
      if (left <= 0) spoiled = true;
      li.classList.toggle('is-soon', left < SOON_MS);
      const label = li.querySelector('.kitchen-left');
      if (label) label.textContent = countdown(left);
    }
    if (spoiled && !modalOpen() && Date.now() - lastAuto > 15_000) {
      lastAuto = Date.now();
      load().catch(() => {});
    }
  }

  load().then(() => {
    if (view.isConnected) timer = setInterval(tick, 1000);
  }).catch(ctx.fail);
  return () => clearInterval(timer);
}
