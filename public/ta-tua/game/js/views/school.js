// Trường học: chọn bé, xem năng lượng và kỹ năng, vào lớp 30 phút để tăng kỹ năng.
import { api } from '../api.js';
import { countdown, esc, fmt, viewHead } from '../ui.js';

let selectedPet = null;
let flash = null; // { petId, skill, gain, at }: điểm vừa học được, hiện nổi trên thẻ lớp
let lastAuto = 0;

/** Kỹ năng giúp được gì ngoài các nghề trong Trung tâm việc làm. */
const EXTRA_USES = {
  craft: 'nấu món ngon ở Bếp, đứng máy xưởng',
  strength: 'đứng máy xưởng',
};

const skillText = (v) => (Math.floor(v * 10 + 1e-6) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export function renderSchool(root, ctx) {
  root.innerHTML = `<div class="school-page">
    ${viewHead('🏫 Trường học', 'Cho bé đi học để lên kỹ năng: làm việc giỏi hơn, lương cao hơn, nấu ăn khéo hơn.')}
    <div class="school-view"><div class="empty muted">Đang tải…</div></div></div>`;
  const page = root.querySelector('.school-page');
  const view = page.querySelector('.school-view');
  const need = ctx.catalog.unlocks.school;
  if (ctx.bestLevel() < need) {
    view.innerHTML = `<section class="card empty"><b>🔒</b><h2>Trường chưa nhận học sinh</h2>
      <p class="muted">Có một bé đạt cấp ${need} là trường mở cửa cho cả nhà.</p></section>`;
    return;
  }
  const pets = ctx.me.pets;
  if (!pets.length) {
    view.innerHTML = `<section class="card empty"><b>🐾</b><h2>Chưa có học sinh</h2>
      <p class="muted">Nhận nuôi một bé rồi đưa bé tới trường nhé.</p>
      <button class="btn primary" data-go="home">🏠 Về nhà</button></section>`;
    return;
  }

  const pet = pets.find((p) => p.id === selectedPet) ?? ctx.activePet() ?? pets[0];
  selectedPet = pet.id;
  const { skills, careers, care } = ctx.catalog;
  const traits = care?.traits ?? {};
  const bookworm = (pet.traits ?? []).includes('bookworm');
  let timer = 0;

  function petChips() {
    const activeId = ctx.me.user.activePetId;
    return `<nav class="switcher school-switcher">${pets.map((p) => {
      const state = p.sick ? esc(p.sick.icon) : p.busyUntil ? '⏳' : '';
      return `<button class="btn small ${p.id === pet.id ? 'current' : ''}" data-school-pet="${Number(p.id)}">
        ${p.id === activeId ? '⭐ ' : ''}${esc(p.name)} · Lv ${p.level}${state ? ` ${state}` : ''}</button>`;
    }).join('')}</nav>`;
  }

  /** Lý do cả trường không nhận bé lúc này (ốm, đang bận, thiếu năng lượng). */
  function blockAll(rules) {
    if (pet.sick) {
      return `${esc(pet.sick.icon)} ${esc(pet.name)} đang ${esc(pet.sick.name.toLowerCase())}, khỏi bệnh mới đi học được.
        <button class="link-btn" data-go="clinic">Tới phòng khám</button>`;
    }
    const busyLeft = pet.busyUntil ? pet.busyUntil - Date.now() : 0;
    if (busyLeft > 0) {
      return `⏳ ${esc(pet.name)} đang bận, rảnh sau <span class="school-busy" data-until="${Number(pet.busyUntil)}">${countdown(busyLeft)}</span>.`;
    }
    if (pet.energy < rules.energy) return `😴 ${esc(pet.name)} cần ${rules.energy} ⚡ để học (đang có ${pet.energy}). Cho bé nghỉ hoặc ăn gì đó đã.`;
    return '';
  }

  function petBox(rules, block) {
    const energyPct = Math.max(0, Math.min(100, pet.energy));
    const traitChips = (pet.traits ?? []).filter((t) => traits[t]).map((t) => `
      <span class="chip school-trait ${t === 'bookworm' ? 'is-bookworm' : ''}" title="${esc(traits[t].desc)}">${esc(traits[t].icon)} ${esc(traits[t].name)}</span>`).join('');
    return `
      <section class="card school-box school-pet">
        <div class="school-pet-head">
          <h3>${esc(pet.name)}</h3>
          <span class="badge level">Lv ${pet.level}</span>
          <span class="badge">${esc(pet.age.label)}</span>
          ${pet.sick ? `<span class="badge school-sick">${esc(pet.sick.icon)} ${esc(pet.sick.name)}</span>` : ''}
        </div>
        <div class="meter">
          <div class="meter-head"><span>⚡ Năng lượng</span><span>${pet.energy}/100</span></div>
          <div class="bar energy ${energyPct < 25 ? 'low' : ''}"><i style="width:${energyPct}%"></i></div>
        </div>
        ${traitChips ? `<div class="school-traits">${traitChips}</div>` : ''}
        ${bookworm ? `<p class="school-bookworm">📚 ${esc(pet.name)} là <b>${esc(traits.bookworm?.name ?? 'Mọt sách')}</b>: mỗi buổi học được thêm 25% điểm!</p>` : ''}
        <ul class="school-skills">${Object.entries(skills).map(([id, s]) => {
          const v = pet.skills?.[id] ?? 0;
          return `
            <li class="${flash && flash.skill === id ? 'is-flash' : ''}">
              <span>${esc(s.icon)} ${esc(s.name)}</span>
              <div class="bar xp"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>
              <b>${skillText(v)}</b>
            </li>`;
        }).join('')}</ul>
        ${block ? `<p class="blocked">${block}</p>` : ''}
        <p class="muted small">Mỗi buổi ${rules.minutes} phút, tốn ${rules.energy} ⚡ và học phí, bé được thêm XP. Mỗi môn học tối đa ${rules.perSkillPerDay} buổi/ngày; qua nửa đêm lại học tiếp.</p>
      </section>`;
  }

  function usesOf(skillId) {
    const jobs = Object.values(careers ?? {}).filter((c) => c.skill === skillId).map((c) => `${esc(c.icon)} ${esc(c.name)}`);
    if (EXTRA_USES[skillId]) jobs.push(EXTRA_USES[skillId]);
    return jobs.join(', ');
  }

  function classCard(id, c, rules, block) {
    const value = pet.skills?.[id] ?? 0;
    const maxed = value >= 100;
    const full = c.taken >= c.max;
    const poor = ctx.me.user.coins < c.cost;
    let reason = '';
    if (!block) reason = maxed ? 'Kỹ năng này đã tối đa' : full ? `Hôm nay học đủ ${c.max} buổi rồi` : poor ? 'Không đủ xu đóng học phí' : '';
    const skill = skills[id];
    const [lo, hi] = rules.gain;
    const mult = bookworm ? 1.25 : 1;
    const here = flash && flash.skill === id;
    const uses = usesOf(id);
    return `
      <article class="card school-class ${here ? 'is-flash' : ''} ${full ? 'is-full' : ''}">
        ${here ? `<span class="school-pop">+${skillText(Number(flash.gain) || 0)} điểm</span>` : ''}
        <header>
          <span class="school-icon">${esc(c.icon)}</span>
          <div>
            <h4>${esc(c.name)}</h4>
            ${skill ? `<small class="muted">${esc(skill.icon)} ${esc(skill.name)}</small>` : ''}
          </div>
        </header>
        <div class="school-now">
          <span class="muted small">Hiện tại</span>
          <b>${skillText(value)}</b><span class="muted small">/100</span>
        </div>
        <div class="bar xp"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>
        <div class="school-dots" title="Đã học ${c.taken}/${c.max} buổi hôm nay">
          ${Array.from({ length: c.max }, (_, i) => `<i class="${i < c.taken ? 'on' : ''}"></i>`).join('')}
          <small class="muted">${c.taken}/${c.max} buổi hôm nay</small>
        </div>
        <p class="muted small">+${skillText(lo * mult)}–${skillText(hi * mult)} điểm mỗi buổi${bookworm ? ' (đã tính Mọt sách)' : ''}, điểm càng cao lên càng chậm.</p>
        ${uses ? `<p class="small school-uses">Giúp: ${uses}</p>` : ''}
        <button class="btn primary" data-class="${esc(id)}" ${block || reason ? 'disabled' : ''}>📚 Vào học · ${fmt(c.cost)} 🪙</button>
        ${reason ? `<p class="blocked">${reason}</p>` : ''}
      </article>`;
  }

  function draw(s) {
    const block = blockAll(s.rules);
    if (flash && (flash.petId !== pet.id || Date.now() - flash.at > 5000)) flash = null;
    view.innerHTML = `
      ${petChips()}
      <div class="school-grid">
        ${petBox(s.rules, block)}
        <section class="school-classes">
          <h3>📚 Thời khóa biểu hôm nay</h3>
          <div class="school-class-grid">${Object.entries(s.classes).map(([id, c]) => classCard(id, c, s.rules, block)).join('')}</div>
        </section>
      </div>`;
    flash = null;
  }

  page.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    if (d.schoolPet) {
      selectedPet = Number(d.schoolPet);
      if (selectedPet !== pet.id) ctx.refresh();
    } else if (d.class) {
      const petId = pet.id;
      ctx.act('/school/class', { petId, skill: d.class }, {
        onResult: (r) => {
          if (r.skill) flash = { petId, skill: r.skill.id, gain: r.skill.gain, at: Date.now() };
        },
      });
    }
  });

  /** Hết giờ bận thì tải lại trạng thái bé để mở lại các lớp. */
  function tick() {
    if (!view.isConnected) return clearInterval(timer);
    const el = view.querySelector('.school-busy');
    if (!el) return;
    const left = Number(el.dataset.until) - Date.now();
    if (left > 0) {
      el.textContent = countdown(left);
      return;
    }
    if (Date.now() - lastAuto < 15_000) return;
    lastAuto = Date.now();
    clearInterval(timer);
    Promise.resolve(ctx.refreshMe?.())
      .then(() => view.isConnected && ctx.refresh())
      .catch(ctx.fail);
  }

  api(`/school?petId=${pet.id}`).then((s) => {
    if (!view.isConnected) return;
    draw(s);
    timer = setInterval(tick, 1000);
  }).catch(ctx.fail);
  return () => clearInterval(timer);
}
