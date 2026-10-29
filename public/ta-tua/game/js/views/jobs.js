// Trung tâm việc làm: chọn bé, chọn nghề và số giờ; theo dõi ca đang làm, nhận lương.
import { api } from '../api.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';
import { seniorityBonus } from '../shared/pets.js';

let selectedPet = null;

export function renderJobs(root, ctx) {
  root.innerHTML = `${viewHead('💼 Trung tâm việc làm', 'Ca làm tốn thời gian thật. Bé đi làm cả khi bạn tắt app, xong ca quay lại nhận lương.')}
    <div class="jobs-view"><div class="empty muted">Đang tải…</div></div>`;
  const view = root.querySelector('.jobs-view');
  let timer = 0;
  let data = null;

  const { careers, skills, jobs: rules } = ctx.catalog;
  const petName = (id) => data.pets.find((p) => p.id === id)?.name ?? 'Bé';

  function shiftRow(s) {
    const career = s.career === 'factory' ? { icon: '🏭', name: `Đứng máy ở ${s.businessName}` }
      : s.businessName ? { icon: '🧋', name: `Trực ${s.businessName}` } : careers[s.career];
    const now = Date.now();
    const done = Math.min(1, (now - s.startsAt) / (s.endsAt - s.startsAt));
    return `
      <div class="shift-row ${s.ready ? 'ready' : ''}" data-start="${s.startsAt}" data-ends="${s.endsAt}">
        <span class="shift-icon">${career.icon}</span>
        <div class="shift-main">
          <b>${esc(petName(s.petId))} · ${career.name}</b>
          <small>${s.hours} giờ · ${fmt(s.pay)} 🪙${career.tips ? ' + tiền boa' : ''}</small>
          <div class="bar xp"><i style="width:${Math.round(done * 100)}%"></i></div>
        </div>
        ${s.ready
          ? `<button class="btn gold small" data-claim="${s.id}">Nhận lương</button>`
          : `<span class="countdown">${countdown(s.endsAt - now)}</span>`}
      </div>`;
  }

  function careerCard(id, career, pet) {
    const state = pet.careers[id] ?? { rank: 1, hours: 0 };
    const skill = pet.skills[career.skill] ?? 0;
    // Lương theo tuổi (nhí nhố 60%, thiếu niên 85%) và thâm niên từ Trưởng thành (+1% mỗi 10 giờ ở nghề, tối đa 30%).
    const senior = pet.seniority ? seniorityBonus(state.hours) : 0;
    const perHour = Math.round(career.pay[state.rank - 1] * (0.8 + skill / 200) * pet.workFactor * (1 + senior));
    const next = rules.promotion[state.rank - 1];
    const hoursLeft = pet.maxHours - pet.hoursToday;
    let blocked = '';
    if (pet.stage === 'baby') blocked = 'Bé cần tròn 2 tuần tuổi';
    else if (pet.busyUntil) blocked = 'Bé đang làm ca khác';
    else if (pet.sick) blocked = 'Bé đang ốm, đưa đi Phòng khám trước đã';
    else if (hoursLeft <= 0) blocked = `Hôm nay làm đủ ${pet.maxHours} giờ rồi`;
    else if (pet.fullness < 15) blocked = 'Bé đói quá, cho ăn rồi hẵng đi làm';
    const progress = next
      ? `<div class="promo">
          <span>Lên <b>${rules.rankTitles[state.rank]}</b></span>
          <span>⏱ ${state.hours}/${next.hours} giờ</span>
          <span>${skills[career.skill].icon} ${Math.floor(skill)}/${next.skill}</span>
        </div>`
      : '<div class="promo"><span>🏅 Đã là Bậc thầy</span></div>';
    return `
      <article class="card career-card">
        <header>
          <span class="career-icon">${career.icon}</span>
          <div>
            <h3>${career.name}</h3>
            <span class="badge level">${rules.rankTitles[state.rank - 1]} · bậc ${state.rank}</span>
          </div>
        </header>
        <p class="muted">${career.desc}</p>
        <p class="pay-line"><b>${fmt(perHour)} 🪙/giờ</b> <small class="muted">· theo ${skills[career.skill].icon} ${skills[career.skill].name} ${Math.floor(skill)}${senior ? ` · thâm niên +${Math.round(senior * 100)}%` : ''}</small></p>
        ${progress}
        <div class="shift-buttons">
          ${rules.shiftHours.map((h) => {
            const disabled = blocked || h > hoursLeft || pet.energy < h * 10;
            return `<button class="btn small ${h === 4 ? 'primary' : ''}" data-shift="${id}:${h}" ${disabled ? 'disabled' : ''}>
              ${h} giờ · ${fmt(perHour * h)} 🪙</button>`;
          }).join('')}
        </div>
        ${blocked ? `<p class="blocked">${blocked}</p>` : ''}
      </article>`;
  }

  /** Trực quầy của mình và các tin tuyển người làm thuê ở quầy người khác. */
  function shopJobs(pet) {
    const blocked = pet.stage === 'baby' || pet.busyUntil || pet.sick || pet.hoursToday >= pet.maxHours || pet.fullness < 15;
    const hoursLeft = pet.maxHours - pet.hoursToday;
    const buttons = (businessId, wage) => rules.shiftHours.map((h) => `
      <button class="btn small" data-shop-shift="${businessId}:${h}" ${blocked || h > hoursLeft || pet.energy < h * 10 ? 'disabled' : ''}>
        ${h} giờ${wage ? ` · ${fmt(wage * h)} 🪙` : ''}</button>`).join('');
    const own = data.myBusiness
      ? `<div class="job-row"><div><b>🧋 Trực quầy "${esc(data.myBusiness.name)}"</b><br><small class="muted">Không lương: bé đứng quầy thì quầy mới bán được hàng, lời về ví bạn.</small></div>
          <div class="shift-buttons">${buttons(data.myBusiness.id, 0)}</div></div>` : '';
    const hire = data.jobs.length
      ? data.jobs.map((j) => `
          <div class="job-row"><div><b>${esc(j.name)}</b> <small class="muted">của ${esc(j.owner)} · ${ctx.catalog.business.locations[j.location].name} · còn ${j.free} chỗ</small>
            <br><small><b>${fmt(j.wage)} 🪙/giờ</b> · lên Khéo tay</small></div>
            <div class="shift-buttons">${buttons(j.businessId, j.wage)}</div></div>`).join('')
      : '<p class="muted small">Chưa có quầy nào đang tuyển người.</p>';
    return `<section class="card shifts"><h3>🤝 Việc ở quầy trà sữa</h3>${own}${hire}</section>`;
  }

  /** Đứng máy ở xưởng của mình (không lương) và các xưởng người khác đang tuyển công nhân. */
  function factoryJobs(pet) {
    if (!data.myFactories.length && !data.factoryJobs.length) return '';
    const blocked = pet.stage === 'baby' || pet.busyUntil || pet.sick || pet.hoursToday >= pet.maxHours || pet.fullness < 15;
    const hoursLeft = pet.maxHours - pet.hoursToday;
    const buttons = (factoryId, wage) => rules.shiftHours.map((h) => `
      <button class="btn small" data-factory-shift="${factoryId}:${h}" ${blocked || h > hoursLeft || pet.energy < h * 10 ? 'disabled' : ''}>
        ${h} giờ${wage ? ` · ${fmt(wage * h)} 🪙` : ''}</button>`).join('');
    const own = data.myFactories.map((f) => `
      <div class="job-row"><div><b>🏭 Đứng máy ở ${esc(f.name)}</b><br><small class="muted">Không lương: có bé đứng máy thì xưởng mới chạy. Lên 💪 Sức mạnh.</small></div>
        <div class="shift-buttons">${buttons(f.id, 0)}</div></div>`).join('');
    const hire = data.factoryJobs.map((j) => `
      <div class="job-row"><div><b>${esc(j.name)}</b> <small class="muted">của ${esc(j.owner)} · còn ${j.free} chỗ</small>
        <br><small><b>${fmt(j.wage)} 🪙/giờ</b> · lên 💪 Sức mạnh</small></div>
        <div class="shift-buttons">${buttons(j.factoryId, j.wage)}</div></div>`).join('');
    return `<section class="card shifts"><h3>🏭 Việc ở Khu công nghiệp</h3>${own}${hire}</section>`;
  }

  function draw() {
    const { pets, shifts } = data;
    if (!pets.length) {
      view.innerHTML = '<section class="card empty"><b>🐣</b><p>Nhận nuôi một bé trước đã.</p><button class="btn primary" data-go="home">Về nhà</button></section>';
      return;
    }
    const pet = pets.find((p) => p.id === selectedPet) ?? pets.find((p) => p.id === ctx.me.user.activePetId) ?? pets[0];
    selectedPet = pet.id;
    view.innerHTML = `
      ${shifts.length ? `<section class="card shifts"><h3>📋 Ca làm</h3>${shifts.map(shiftRow).join('')}</section>` : ''}
      <nav class="switcher">
        ${pets.map((p) => `<button class="btn small ${p.id === pet.id ? 'current' : ''}" data-job-pet="${p.id}">
          ${p.busyUntil ? '💼 ' : ''}${esc(p.name)}</button>`).join('')}
      </nav>
      <section class="card work-status">
        <div><span class="muted">Năng lượng</span><b>⚡ ${pet.energy}</b></div>
        <div><span class="muted">No bụng</span><b class="${pet.fullness < 15 ? 'down' : ''}">🍙 ${pet.fullness}</b></div>
        <div><span class="muted">Đã làm hôm nay</span><b>⏱ ${pet.hoursToday}/${pet.maxHours} giờ</b></div>
        ${pet.workFactor < 1 ? `<div><span class="muted">Theo tuổi</span><b>💼 lương ${Math.round(pet.workFactor * 100)}%</b></div>` : ''}
        <div class="skills-mini">
          ${Object.entries(skills).map(([id, s]) => `
            <span title="${s.name}">${s.icon}<i class="bar xp"><i style="width:${pet.skills[id] ?? 0}%"></i></i><small>${Math.floor(pet.skills[id] ?? 0)}</small></span>`).join('')}
        </div>
      </section>
      <div class="career-grid">${Object.entries(careers).map(([id, c]) => careerCard(id, c, pet)).join('')}</div>
      ${shopJobs(pet)}
      ${factoryJobs(pet)}
      ${data.officeBonus ? `<p class="muted small">🏯 Văn phòng Hội đang cộng thêm ${Math.round(data.officeBonus * 100)}% lương ca làm.</p>` : ''}`;
  }

  function tickClock() {
    let finished = false;
    for (const row of view.querySelectorAll('.shift-row:not(.ready)')) {
      const ends = Number(row.dataset.ends);
      const start = Number(row.dataset.start);
      const left = ends - Date.now();
      row.querySelector('.countdown').textContent = countdown(left);
      row.querySelector('.bar i').style.width = `${Math.min(100, ((Date.now() - start) / (ends - start)) * 100)}%`;
      if (left <= 0) finished = true;
    }
    if (finished) ctx.refresh();
  }

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.jobPet) {
      selectedPet = Number(btn.dataset.jobPet);
      draw();
    } else if (btn.dataset.shift) {
      const [career, hours] = btn.dataset.shift.split(':');
      ctx.act('/jobs/start', { petId: selectedPet, career, hours: Number(hours) });
    } else if (btn.dataset.shopShift) {
      const [businessId, hours] = btn.dataset.shopShift.split(':').map(Number);
      ctx.act('/jobs/start', { petId: selectedPet, businessId, hours });
    } else if (btn.dataset.factoryShift) {
      const [factoryId, hours] = btn.dataset.factoryShift.split(':').map(Number);
      ctx.act('/jobs/start', { petId: selectedPet, factoryId, hours });
    } else if (btn.dataset.claim) {
      ctx.act(`/jobs/${btn.dataset.claim}/claim`, {}, {
        onResult: (r) => {
          if (r.skill?.gain) ctx.toast(`${skills[r.skill.id].icon} ${skills[r.skill.id].name} +${r.skill.gain}`);
          if (r.promoted) ctx.toast(`🏅 Thăng chức: ${r.promoted.title} nghề ${r.promoted.career}!`, 'level');
        },
      });
    }
  });

  api('/jobs').then((res) => {
    if (!view.isConnected) return;
    data = res;
    draw();
    timer = setInterval(tickClock, 1000);
  }).catch(ctx.fail);

  return () => clearInterval(timer);
}
