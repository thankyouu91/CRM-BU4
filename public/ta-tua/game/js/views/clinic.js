// Phòng khám: sức khỏe và sạch sẽ của các bé, khám tổng quát / chữa bệnh, bảo hiểm sức khỏe.
import { api } from '../api.js';
import { esc, fmt, viewHead } from '../ui.js';

const PLAN_ICONS = { basic: '🩹', full: '🛡️' };
const DIRTY_BELOW = 20;

export function renderClinic(root, ctx) {
  root.innerHTML = `<div class="clinic-page">
    ${viewHead('🩺 Phòng khám', 'Khám tổng quát, chữa bệnh cho bé và mua bảo hiểm để đỡ lo viện phí.')}
    <div class="clinic-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.clinic-page');
  const view = page.querySelector('.clinic-view');
  const { care } = ctx.catalog;
  const health = care.health;
  const clinicRules = care.clinic;

  function meter(kind, label, value, low) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    return `
      <div class="meter">
        <div class="meter-head"><span>${label}</span><span>${v}/100</span></div>
        <div class="bar ${kind} ${low ? 'low' : ''}"><i style="width:${v}%"></i></div>
      </div>`;
  }

  function petCard(p, c) {
    const treatment = p.sick ? c.treatments[p.sick.id] : null;
    const bill = treatment?.bill ?? c.checkup;
    const covered = Math.max(0, bill.total - bill.paid);
    const lowHealth = p.health < health.sickBelow;
    const dirty = p.hygiene < DIRTY_BELOW;
    const fullHealth = !p.sick && p.health >= 100;
    const poor = ctx.me.user.coins < bill.paid;
    const busy = Boolean(p.busyUntil);
    const gain = p.sick ? clinicRules.treatHealth : clinicRules.checkupHealth;

    const notes = [];
    if (p.sick) notes.push(`<p class="blocked">${esc(p.sick.icon)} Bé ốm không đi làm, đi học, chơi mini-game hay vào bếp được, và không tự khỏi. Chữa sớm cho bé nhé!</p>`);
    else if (lowHealth) notes.push(`<p class="blocked">❤️ Sức khỏe dưới ${health.sickBelow}: bé dễ ốm, nhất là qua đêm. Nên khám tổng quát.</p>`);
    if (dirty) notes.push(`<p class="blocked">🫧 Bé đang lấm lem. Tắm cho bé đi, bẩn lâu Sức khỏe sẽ giảm.</p>`);

    return `
      <article class="card clinic-pet ${p.sick ? 'is-sick' : ''}">
        <header class="clinic-pet-head">
          <div>
            <h3>${esc(p.name)}</h3>
            <small class="muted">Lv ${p.level}${p.sick ? '' : ` · ${esc(p.mood?.label ?? '')}`}${busy ? ' · đang bận' : ''}</small>
          </div>
          ${p.sick
            ? `<span class="badge clinic-sick">${esc(p.sick.icon)} ${esc(p.sick.name)}</span>`
            : `<span class="badge star">💚 Khỏe</span>`}
        </header>
        ${meter('health', '❤️ Sức khỏe', p.health, lowHealth)}
        ${meter('hygiene', '🫧 Sạch sẽ', p.hygiene, dirty)}
        ${notes.join('')}
        <div class="clinic-bill">
          <div class="row-between"><span>${p.sick ? `Chữa ${esc((treatment?.name ?? p.sick.name).toLowerCase())}` : 'Khám tổng quát'}</span><b>${fmt(bill.total)} 🪙</b></div>
          ${covered ? `<div class="row-between up"><span>🛡️ Bảo hiểm trả</span><b>−${fmt(covered)} 🪙</b></div>` : ''}
          <div class="row-between clinic-pay"><span>Bạn trả</span><b>${fmt(bill.paid)} 🪙</b></div>
        </div>
        <div class="clinic-actions">
          <button class="btn ${p.sick ? 'pink' : 'mint'}" data-visit="${Number(p.id)}" ${fullHealth || poor ? 'disabled' : ''}>
            🩺 ${p.sick ? 'Chữa bệnh' : 'Khám tổng quát'} · +${gain} ❤️</button>
          <button class="btn small" data-bath="${Number(p.id)}" ${busy || p.hygiene >= 100 ? 'disabled' : ''}>🛁 Tắm miễn phí</button>
        </div>
        ${fullHealth ? '<p class="muted small">Sức khỏe đang đầy, chưa cần khám đâu.</p>' : ''}
        ${!fullHealth && poor ? '<p class="muted small down">Không đủ xu trả viện phí.</p>' : ''}
      </article>`;
  }

  function planCard(id, p, c) {
    const current = c.plan?.id === id;
    const example = c.treatments.stomach ?? Object.values(c.treatments)[0];
    const since = current && c.plan.since ? new Date(c.plan.since).toLocaleDateString('vi-VN') : '';
    return `
      <article class="clinic-plan ${current ? 'is-current' : ''}">
        <div class="clinic-plan-head">
          <span class="clinic-plan-icon">${PLAN_ICONS[id] ?? '🛡️'}</span>
          <h4>${esc(p.name)}</h4>
        </div>
        <div class="clinic-plan-price"><b>${fmt(p.premium)}</b> 🪙/ngày</div>
        <p>Trả <b>${Math.round(p.cover * 100)}%</b> viện phí khám và chữa bệnh.</p>
        ${example ? `<p class="muted small">Ví dụ chữa ${esc(example.name.toLowerCase())}: ${fmt(example.bill.total)} 🪙 → bạn chỉ trả ${fmt(Math.round(example.bill.total * (1 - p.cover)))} 🪙.</p>` : ''}
        ${current
          ? `<span class="badge star">✅ Đang dùng${since ? ` từ ${since}` : ''}</span>
             <button class="link-btn danger" data-cancel-plan>Hủy bảo hiểm</button>`
          : `<button class="btn ${id === 'full' ? 'gold' : 'mint'}" data-plan="${esc(id)}">${c.plan ? 'Chuyển sang gói này' : 'Đăng ký'}</button>`}
      </article>`;
  }

  function draw(c) {
    const pets = ctx.me.pets;
    const sick = pets.filter((p) => p.sick).length;
    view.innerHTML = `
      <div class="clinic-grid">
        <section class="clinic-pets wide">
          <div class="row-between">
            <h3>🐾 Các bé nhà mình</h3>
            ${sick ? `<span class="badge clinic-sick">🤒 ${sick} bé đang ốm</span>` : ''}
          </div>
          ${pets.length
            ? `<div class="clinic-pet-grid">${pets.map((p) => petCard(p, c)).join('')}</div>`
            : `<section class="card empty"><b>🐾</b><p class="muted">Chưa có bé nào để khám.</p>
               <button class="btn primary" data-go="home">🏠 Về nhà</button></section>`}
        </section>
        <section class="card clinic-box clinic-insurance">
          <h3>🛡️ Bảo hiểm sức khỏe</h3>
          <p class="muted small">${c.plan
            ? 'Bảo hiểm trả một phần viện phí cho mọi bé trong nhà.'
            : 'Chưa có bảo hiểm: mỗi lần khám hay chữa bệnh bạn trả đủ 100%.'}
            Phí trừ lúc nửa đêm mỗi ngày; ví không đủ xu thì gói tự hủy.</p>
          <div class="clinic-plans">${Object.entries(c.plans).map(([id, p]) => planCard(id, p, c)).join('')}</div>
        </section>
        <section class="card clinic-box clinic-tips">
          <h3>💡 Mẹo giữ bé khỏe</h3>
          <ul>
            <li>🛁 Tắm ở nhà miễn phí (bé bận ${health.bathMinutes} phút). Sạch sẽ giảm ${Math.abs(health.hygienePerHour)}/giờ, dưới ${DIRTY_BELOW} là bẩn.</li>
            <li>🍙 Cho bé ăn đều đặn. Đói hoặc bẩn thì Sức khỏe giảm dần; no và sạch thì tự hồi.</li>
            <li>❤️ Sức khỏe dưới ${health.sickBelow} là bé dễ ốm, nhất là qua đêm.</li>
            <li>🤒 Bé ốm không tự khỏi, phải đưa tới đây chữa (+${clinicRules.treatHealth} Sức khỏe). Khám tổng quát cho bé khỏe được +${clinicRules.checkupHealth}.</li>
          </ul>
        </section>
      </div>`;
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    if (d.visit) ctx.act('/clinic/visit', { petId: Number(d.visit) });
    else if (d.bath) ctx.act(`/pets/${Number(d.bath)}/bath`);
    else if (d.plan) ctx.act('/clinic/insurance', { plan: d.plan });
    else if (d.cancelPlan !== undefined) {
      if (confirm('Hủy bảo hiểm? Lần sau bé ốm bạn sẽ phải trả đủ viện phí.')) ctx.act('/clinic/insurance', { plan: null });
    }
  });

  api('/clinic').then((c) => view.isConnected && draw(c)).catch(ctx.fail);
}
