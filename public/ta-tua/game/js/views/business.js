// Quầy trà sữa: khai trương, thực đơn và giá, nguyên liệu, nhân sự, quảng cáo, nâng cấp, báo cáo.
import { api } from '../api.js';
import { barChart } from '../charts.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';

let draftMenu = null;
let setupLocation = 'alley';

export function renderBusiness(root, ctx) {
  root.innerHTML = `<div class="biz-page">
    ${viewHead('🧋 Quầy trà sữa', 'Nhập nguyên liệu vào kho, đặt giá, cho bé trực quầy. Doanh thu được tính cả khi bạn offline.')}
    <div class="biz-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.biz-page');
  const view = page.querySelector('.biz-view');
  const { business: rules, commodities } = ctx.catalog;
  const need = ctx.catalog.unlocks.business;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Chưa đủ cấp mở quầy</h2>
      <p class="muted">Có một bé đạt cấp ${need} là xin được giấy phép kinh doanh.</p></section>`;
    return;
  }
  let data = null;
  let timer = 0;

  function drawSetup() {
    const index = ctx.me.economy.priceIndex;
    view.innerHTML = `
      <section class="card biz-setup">
        <h3>Chọn vị trí mở quầy</h3>
        <div class="loc-grid">
          ${Object.entries(rules.locations).map(([id, l]) => `
            <button class="loc ${id === setupLocation ? 'current' : ''}" data-loc="${id}">
              <span class="loc-icon">${l.icon}</span><b>${l.name}</b>
              <span>Giấy phép <b>${fmt(l.license * index)} 🪙</b></span>
              <span>Thuê ${fmt(l.rent * index)} 🪙/ngày</span>
              <span>Khách qua ~${l.traffic}/giờ</span>
            </button>`).join('')}
        </div>
        <form class="money-form" data-open>
          <input name="name" maxlength="24" minlength="2" required placeholder="Tên quầy, ví dụ: Trà Sữa Rái Cá" />
          <button class="btn primary">Khai trương</button>
        </form>
        <p class="muted small">Quầy dùng nguyên liệu trong kho của bạn (mua ở Sàn) và chỉ bán khi có bé trực. Nợ tiền thuê ${rules.rules.unpaidLimit} đêm liền thì quầy đóng cửa.</p>
      </section>`;
  }

  function menuRows(b) {
    const menu = draftMenu ?? b.menu.map((m) => ({ recipe: m.recipe, price: m.price }));
    return menu.map((m, i) => {
      const r = data.recipes[m.recipe];
      const stock = Math.min(...Object.entries(r.inputs).map(([c, n]) => Math.floor((data.goods[c] ?? 0) / n)));
      const margin = m.price - r.cost;
      return `
        <div class="menu-row">
          <select data-menu-recipe="${i}">
            ${Object.entries(data.recipes).map(([id, x]) => `<option value="${id}" ${id === m.recipe ? 'selected' : ''}>${x.icon} ${x.name}</option>`).join('')}
          </select>
          <input type="number" min="1" step="1" value="${m.price}" data-menu-price="${i}" aria-label="Giá bán" />
          <small class="muted">tham chiếu ${r.ref} · vốn ${r.cost.toLocaleString('vi-VN')} · <span class="${margin > 0 ? 'up' : 'down'}">lời ${margin.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</span></small>
          <small class="${stock < 5 ? 'down' : 'muted'}">đủ cho ${stock} ly</small>
          ${menu.length > 1 ? `<button class="link-btn" data-menu-remove="${i}">Bỏ</button>` : ''}
        </div>`;
    }).join('') + (menu.length < b.slots
      ? `<button class="btn small" data-menu-add>＋ Thêm món (${menu.length}/${b.slots})</button>` : '');
  }

  function drawShop() {
    const b = data.business;
    const today = b.today ?? { cups: 0, revenue: 0, customers: 0, lost: 0 };
    const usedInputs = new Set(b.menu.flatMap((m) => Object.keys(data.recipes[m.recipe].inputs)));
    const pets = ctx.me.pets;
    const promoLeft = b.promoUntil - Date.now();
    view.innerHTML = `
      <section class="card biz-hero">
        <div>
          <h3>${esc(b.name)}</h3>
          <p class="muted">${rules.locations[b.location].icon} ${rules.locations[b.location].name} · thuê ${fmt(b.rent)} 🪙/ngày
            ${b.unpaidDays ? ` · <b class="down">nợ tiền thuê ${b.unpaidDays} đêm</b>` : ''}</p>
        </div>
        <span class="badge ${b.openNow ? 'star' : ''}">${b.openNow ? '🟢 Đang bán' : '⚪ Chưa có bé trực'}</span>
        <div class="cb-stats">
          <div><span class="muted">Hôm nay</span><b>${today.cups} ly</b></div>
          <div><span class="muted">Doanh thu</span><b class="up">+${fmt(today.revenue)}</b></div>
          <div><span class="muted">Khách bỏ đi</span><b>${today.lost}</b></div>
          <div><span class="muted">Uy tín</span><b>${'★'.repeat(Math.round(b.reputation * 2 + 0.01))}<small> ${b.reputation.toFixed(2)}</small></b></div>
        </div>
      </section>

      <section class="card biz-box">
        <h3>📋 Thực đơn</h3>
        <div class="menu-list">${menuRows(b)}</div>
        <div class="row"><button class="btn primary small" data-menu-save ${draftMenu ? '' : 'disabled'}>Lưu thực đơn</button>
          ${draftMenu ? '<button class="btn small" data-menu-reset>Hủy thay đổi</button>' : ''}</div>
        <p class="muted small">Giá thấp hơn tham chiếu thì đông khách, cao quá 30% thì mất uy tín.</p>
      </section>

      <section class="card biz-box">
        <h3>🏚️ Nguyên liệu trong kho</h3>
        <ul class="stock-list">${[...usedInputs].map((c) => `
          <li><span>${commodities[c].icon} ${commodities[c].name}</span><b class="${(data.goods[c] ?? 0) < 10 ? 'down' : ''}">${data.goods[c] ?? 0} phần</b></li>`).join('')}</ul>
        <button class="btn small" data-go="market">📈 Mua thêm ở Sàn</button>
      </section>

      <section class="card biz-box">
        <h3>👩‍🍳 Trực quầy</h3>
        ${b.duty.length ? `<ul class="duty-list">${b.duty.map((d) => `
          <li data-ends="${d.endsAt}"><b>${esc(d.petName)}</b> <small class="muted">${d.own ? 'bé nhà mình' : `của ${esc(d.owner)} · ${d.wage} 🪙/giờ`}</small>
            <span class="countdown">${d.startsAt > Date.now() ? 'sắp vào' : countdown(d.endsAt - Date.now())}</span></li>`).join('')}</ul>`
          : '<p class="muted">Chưa có ai trực. Quầy chỉ bán khi có bé đứng quầy.</p>'}
        <div class="duty-pets">${pets.map((p) => {
          const blocked = p.busyUntil ? 'đang bận' : p.age.stage === 'baby' ? 'còn bé' : '';
          return `<div class="duty-pet"><b>${esc(p.name)}</b>${blocked ? `<small class="muted">${blocked}</small>` : [1, 2, 4].map((h) => `
            <button class="btn small" data-duty="${p.id}:${h}">${h} giờ</button>`).join('')}</div>`;
        }).join('')}</div>
        <form class="job-form" data-jobs>
          <b>Tuyển người làm thuê</b>
          <label>Lương/giờ <input name="wage" type="number" min="${rules.rules.wageMin}" max="${rules.rules.wageMax}" value="${b.jobPost?.wage ?? 15}" /></label>
          <label>Số người <input name="slots" type="number" min="1" max="${rules.rules.maxStaffSlots}" value="${b.jobPost?.slots ?? 1}" /></label>
          <label class="check"><input name="open" type="checkbox" ${b.jobPost?.open ? 'checked' : ''} /> Đang tuyển</label>
          <button class="btn small">Lưu tin tuyển</button>
        </form>
        <p class="muted small">Lương được trừ khỏi ví bạn ngay khi bé người khác vào ca.</p>
      </section>

      <section class="card biz-box">
        <h3>📣 Quảng cáo & nâng cấp</h3>
        <div class="upgrade-row">
          <div><b>Chiến dịch quảng cáo</b><br><small class="muted">+${rules.rules.promoBoost * 100}% khách trong ${rules.rules.promoHours} giờ${promoLeft > 0 ? ` · còn ${countdown(promoLeft)}` : ''}</small></div>
          <button class="btn small gold" data-promo>${fmt(b.promoCost)} 🪙</button>
        </div>
        ${Object.entries(b.upgrades).map(([k, u]) => `
          <div class="upgrade-row">
            <div><b>${rules.upgrades[k].name}</b> <span class="badge">cấp ${u.level}/${u.max}</span><br><small class="muted">${rules.upgrades[k].desc}</small></div>
            ${u.next === null ? '<span class="badge star">Tối đa</span>' : `<button class="btn small" data-upgrade="${k}">${fmt(u.next)} 🪙</button>`}
          </div>`).join('')}
      </section>

      <section class="card biz-box wide">
        <h3>📊 7 ngày gần nhất</h3>
        ${b.days.length ? `<div id="biz-chart"></div>
          <p class="legend-inline"><i style="background:#58b98d"></i> Doanh thu <i style="background:#ef8a7a"></i> Chi phí (vốn, thuê, lương, thuế)</p>
          <div class="table-wrap"><table><thead><tr><th>Ngày</th><th class="num">Ly</th><th class="num">Doanh thu</th><th class="num">Vốn</th><th class="num">Thuê</th><th class="num">Lương</th><th class="num">Thuế</th><th class="num">Lãi</th></tr></thead>
          <tbody>${b.days.slice().reverse().map((d) => `<tr><td>${d.day.slice(5)}</td><td class="num">${d.cups}</td><td class="num">${fmt(d.revenue)}</td>
            <td class="num">${fmt(d.cogs)}</td><td class="num">${fmt(d.rent)}</td><td class="num">${fmt(d.wages)}</td><td class="num">${fmt(d.tax)}</td>
            <td class="num ${d.profit >= 0 ? 'up' : 'down'}">${fmt(d.profit)}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">Chưa có số liệu. Cho bé trực quầy để bắt đầu bán.</p>'}
        <button class="link-btn danger" data-close-biz>Đóng cửa quầy</button>
      </section>`;
    if (b.days.length) {
      barChart(view.querySelector('#biz-chart'), b.days.map((d) => ({ income: d.revenue, expense: d.cogs + d.rent + d.wages + d.tax })), { height: 120 });
    }
  }

  function draw() {
    if (!data.business) drawSetup();
    else drawShop();
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    const menu = () => (draftMenu ??= data.business.menu.map((m) => ({ recipe: m.recipe, price: m.price })));
    if (d.loc) {
      setupLocation = d.loc;
      drawSetup();
    } else if (d.menuAdd !== undefined) {
      const used = new Set(menu().map((m) => m.recipe));
      const next = Object.keys(data.recipes).find((r) => !used.has(r));
      if (next) menu().push({ recipe: next, price: data.recipes[next].ref });
      drawShop();
    } else if (d.menuRemove) {
      menu().splice(Number(d.menuRemove), 1);
      drawShop();
    } else if (d.menuReset !== undefined) {
      draftMenu = null;
      drawShop();
    } else if (d.menuSave !== undefined) {
      const body = { menu: draftMenu };
      draftMenu = null;
      ctx.act('/business/menu', body);
    } else if (d.duty) {
      const [petId, hours] = d.duty.split(':').map(Number);
      ctx.act('/jobs/start', { petId, hours, businessId: data.business.id });
    } else if (d.promo !== undefined) {
      ctx.act('/business/promote');
    } else if (d.upgrade) {
      ctx.act('/business/upgrade', { key: d.upgrade });
    } else if (d.closeBiz !== undefined) {
      if (confirm('Đóng cửa quầy? Giấy phép sẽ không được hoàn lại.')) ctx.act('/business/close');
    }
  });

  page.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.menuRecipe !== undefined) {
      draftMenu ??= data.business.menu.map((m) => ({ recipe: m.recipe, price: m.price }));
      const row = draftMenu[Number(t.dataset.menuRecipe)];
      row.recipe = t.value;
      row.price = data.recipes[t.value].ref;
      drawShop();
    } else if (t.dataset.menuPrice !== undefined) {
      draftMenu ??= data.business.menu.map((m) => ({ recipe: m.recipe, price: m.price }));
      draftMenu[Number(t.dataset.menuPrice)].price = Number(t.value);
      drawShop();
    }
  });

  page.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    if (e.target.matches('[data-open]')) ctx.act('/business/open', { name: form.get('name'), location: setupLocation });
    else if (e.target.matches('[data-jobs]')) {
      ctx.act('/business/jobs', { wage: Number(form.get('wage')), slots: Number(form.get('slots')), open: form.get('open') === 'on' });
    }
  });

  api('/business').then((d) => {
    if (!view.isConnected) return;
    data = d;
    draw();
    timer = setInterval(() => {
      for (const li of view.querySelectorAll('.duty-list li')) {
        const left = Number(li.dataset.ends) - Date.now();
        if (left <= 0) return ctx.refresh();
        li.querySelector('.countdown').textContent = countdown(left);
      }
    }, 1000);
  }).catch(ctx.fail);
  return () => clearInterval(timer);
}
