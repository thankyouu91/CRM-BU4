// Xưởng tạo hình: xem 50 loài pet ngũ hành, 6 giai đoạn tuổi, thử đồ đeo theo khe và xem số liệu từng loài.
import { RIG_ANIMS, RIG_H, RIG_VIEWS, RIG_W, animFrames, drawFrame } from './rig.js';
import {
  ELEMENTS, LEVEL_FORMS, LIFE_STAGES, MASCOTS, RARITIES, RELATIONS, SKILL_IDS, SLOTS, SPECIES, SPECIES_BY_ID, WEARABLES, relation, speciesStats,
  wearLimit,
} from './shared/pets.js';
import { esc } from './ui.js';
import { setFavicon, startIcons } from './icons/index.js';

const SKILLS = {
  strength: { name: 'Sức mạnh', icon: '💪' },
  agility: { name: 'Nhanh nhẹn', icon: '🏃' },
  intellect: { name: 'Thông minh', icon: '🧠' },
  charm: { name: 'Duyên dáng', icon: '✨' },
  craft: { name: 'Khéo tay', icon: '🖐️' },
};
const ANIM_LABELS = { idle: '😊 Đứng chơi', walk: '🏃 Đi bộ', wave: '👋 Vẫy tay', jump: '🦘 Nhảy', sad: '😢 Buồn', think: '🤔 Ngó nghiêng', busy: '💼 Làm việc', spin: '🌀 Xoay' };
/** Bốn hướng nhìn của Rig 2.0 (W là E lật ngang). */
const VIEW_LABELS = { S: '↓ Trước (S)', E: '→ Phải (E)', N: '↑ Sau (N)', W: '← Trái (W)' };

const state = {
  element: 'all',
  stage: 'young',
  selected: 'meo_bac',
  anim: 'idle',
  wear: { head: 'nonla', face: null, neck: 'scarf', back: null, charm: null },
  level: 1, // dáng theo cấp (LEVEL_FORMS)
  anchors: false,
  view: 'S', // hướng nhìn: S, E, N, W
  dressAll: true,
  rarity: 'all', // độ hiếm tối thiểu: all, hiem, quy, huyenthoai
};

// Mở thẳng một cách xem qua địa chỉ, ví dụ /pet-lab.html?rarity=hiem&stage=adult&wear=0
const params = new URLSearchParams(location.search);
if (RARITIES[params.get('rarity')]) state.rarity = params.get('rarity');
if (LIFE_STAGES.some((s) => s.key === params.get('stage'))) state.stage = params.get('stage');
if (Number(params.get('level')) >= 1) state.level = Math.floor(Number(params.get('level')));
if (SPECIES_BY_ID[params.get('species')]) state.selected = params.get('species');
if (RIG_VIEWS.includes(params.get('view'))) state.view = params.get('view');
if (RIG_ANIMS[params.get('anim')]) state.anim = params.get('anim');
if (params.get('anchors') === '1') state.anchors = true;
if (params.get('wear') === '0') {
  state.wear = { head: null, face: null, neck: null, back: null, charm: null };
  state.dressAll = false;
}
const minStars = () => (state.rarity === 'all' ? 0 : RARITIES[state.rarity].stars);
if (params.get('rarity') && !params.get('species')) state.selected = SPECIES.find((s) => s.rarity === 'huyenthoai')?.id ?? state.selected;

const $ = (s) => document.querySelector(s);
const wearKey = (w) => Object.values(w).map((v) => v ?? '-').join(',');

// ---------------------------------------------------------------- hoạt ảnh

const frameCache = new Map();
function framesFor(id, stage, anim, wear) {
  const key = `${id}|${stage}|${anim}|${wearKey(wear)}|${state.anchors}|${state.level}|${state.view}`;
  if (!frameCache.has(key)) frameCache.set(key, animFrames(id, stage, anim, wear, { anchors: state.anchors, level: state.level, view: state.view }));
  return frameCache.get(key);
}

const players = new Set();
function play(canvas, frames, fps, scale) {
  canvas.width = RIG_W * scale;
  canvas.height = RIG_H * scale;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const player = { canvas, g, frames, fps, scale, start: performance.now() + Math.random() * 400, shown: -1 };
  players.add(player);
  return player;
}

function loop(now) {
  for (const pl of players) {
    if (!pl.canvas.isConnected) {
      players.delete(pl);
      continue;
    }
    const i = Math.floor(((now - pl.start) / 1000) * pl.fps) % pl.frames.length;
    if (i === pl.shown) continue;
    pl.shown = i;
    pl.g.clearRect(0, 0, pl.canvas.width, pl.canvas.height);
    pl.g.drawImage(pl.frames[(i + pl.frames.length) % pl.frames.length], 0, 0, pl.canvas.width, pl.canvas.height);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- bộ lọc

function drawFilters() {
  $('#element-filter').innerHTML = [['all', 'Tất cả', '🐾'], ...Object.entries(ELEMENTS).map(([k, e]) => [k, e.name, e.icon])]
    .map(([k, name, icon]) => `<button class="chip ${state.element === k ? 'on' : ''}" data-element="${k}"
      ${k !== 'all' ? `style="--el:${ELEMENTS[k].color}"` : ''}>${icon} ${name}</button>`).join('');
  $('#rarity-filter').innerHTML = [['all', 'Mọi độ hiếm'], ['hiem', '★★ Hiếm trở lên'], ['quy', '★★★ Quý trở lên'], ['huyenthoai', '★★★★ Huyền thoại']]
    .map(([k, label]) => `<button class="chip ${state.rarity === k ? 'on' : ''}" data-rarity="${k}">${label}</button>`).join('');
  $('#stage-filter').innerHTML = LIFE_STAGES.map((s) => `
    <button class="chip ${state.stage === s.key ? 'on' : ''}" data-stage="${s.key}">${s.name}<small>${s.fromWeek}+ tuần</small></button>`).join('');
  $('#view-filter').innerHTML = RIG_VIEWS.map((v) => `
    <button class="chip ${state.view === v ? 'on' : ''}" data-view="${v}">${VIEW_LABELS[v]}</button>`).join('');
}

// ---------------------------------------------------------------- bộ sưu tập

function stars(rarity) {
  const r = RARITIES[rarity];
  return `<span class="stars" style="color:${r.color}" title="${r.name}">${'★'.repeat(r.stars)}</span>`;
}

function drawGallery() {
  const list = [...MASCOTS, ...SPECIES]
    .filter((s) => state.element === 'all' || s.element === state.element)
    .filter((s) => RARITIES[s.rarity].stars >= minStars());
  const gallery = $('#gallery');
  gallery.innerHTML = '';
  const groups = state.element === 'all' ? Object.keys(ELEMENTS) : [state.element];
  for (const el of groups) {
    const e = ELEMENTS[el];
    const sec = document.createElement('section');
    sec.className = 'lab-group';
    sec.style.setProperty('--el', e.color);
    sec.innerHTML = `<h2>${e.icon} Hành ${e.name} <small class="muted">${esc(e.temper)}</small></h2><div class="lab-grid"></div>`;
    const grid = sec.querySelector('.lab-grid');
    for (const sp of list.filter((s) => s.element === el)) {
      const card = document.createElement('button');
      card.className = `lab-card ${sp.id === state.selected ? 'current' : ''}`;
      card.dataset.species = sp.id;
      card.innerHTML = `<canvas></canvas><b>${esc(sp.name)}</b><span>${stars(sp.rarity)} ${SKILLS[sp.fav].icon}</span>`;
      grid.append(card);
      const wear = state.dressAll ? state.wear : {};
      play(card.querySelector('canvas'), framesFor(sp.id, state.stage, 'idle', wear), RIG_ANIMS.idle.fps, 3);
    }
    gallery.append(sec);
  }
}

// ---------------------------------------------------------------- chi tiết

function relationsOf(el) {
  const mother = Object.keys(ELEMENTS).find((k) => ELEMENTS[k].feeds === el);
  const beatenBy = Object.keys(ELEMENTS).find((k) => ELEMENTS[k].beats === el);
  const tag = (k) => `${ELEMENTS[k].icon} ${ELEMENTS[k].name}`;
  return `
    <li>🤱 Được <b>${tag(mother)}</b> nuôi dưỡng (tương sinh): đồ, món ăn, bạn chơi hành ${ELEMENTS[mother].name} hợp mệnh nhất.</li>
    <li>🌱 Nuôi dưỡng <b>${tag(ELEMENTS[el].feeds)}</b>: chơi với bé hành này thì bé kia vui hơn.</li>
    <li>⚔️ Khắc <b>${tag(ELEMENTS[el].beats)}</b> · bị <b>${tag(beatenBy)}</b> khắc: đồ hành ${ELEMENTS[beatenBy].name} là kỵ mệnh.</li>`;
}

function outfitBonus(sp) {
  const items = Object.values(state.wear).filter(Boolean);
  const sum = items.reduce((s, id) => s + RELATIONS[relation(WEARABLES[id].element, sp.element)].bonus, 0);
  if (!items.length) return '<p class="muted small">Chưa đeo gì.</p>';
  const pct = Math.round(sum * 100);
  return `<p class="outfit-sum ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">Bộ đồ đang mặc: <b>${pct > 0 ? '+' : ''}${pct}%</b> tốc độ lên kỹ năng
    ${pct > 0 ? '· hợp mệnh' : pct < 0 ? '· có món kỵ mệnh' : ''}</p>`;
}

function drawDetail() {
  const sp = SPECIES_BY_ID[state.selected];
  const el = ELEMENTS[sp.element];
  const st = speciesStats(sp);
  const stage = LIFE_STAGES.find((s) => s.key === state.stage);
  const detail = $('#detail');
  detail.style.setProperty('--el', el.color);
  const pct = (v) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  const statRow = (label, v, goodLow = false) => {
    if (v === 1) return '';
    const good = goodLow ? v < 1 : v > 1;
    return `<li>${label} <b class="${good ? 'up' : 'down'}">${pct(v)}</b></li>`;
  };
  detail.innerHTML = `
    <header class="lab-detail-head">
      <div>
        <h2>${esc(sp.name)}</h2>
        <p><span class="el-badge">${el.icon} ${el.name}</span> ${stars(sp.rarity)} <small class="muted">${RARITIES[sp.rarity].name}</small></p>
      </div>
      <small class="muted">${stage.name}</small>
    </header>
    <div class="stage-box"><canvas id="big"></canvas></div>
    <div class="chip-row anims">${Object.keys(RIG_ANIMS).map((a) => `
      <button class="chip ${state.anim === a ? 'on' : ''}" data-anim="${a}">${ANIM_LABELS[a]}</button>`).join('')}</div>

    <h3>👗 Thử đồ</h3>
    ${Object.entries(SLOTS).map(([slot, s]) => `
      <div class="wear-row"><span class="wear-slot">${s.icon} ${s.name}</span>
        <button class="chip ${!state.wear[slot] ? 'on' : ''}" data-wear="${slot}:">Không</button>
        ${Object.entries(WEARABLES).filter(([, w]) => w.slot === slot).map(([id, w]) => {
          const rel = relation(w.element, sp.element);
          const tag = RELATIONS[rel].bonus > 0 ? 'good' : RELATIONS[rel].bonus < 0 ? 'bad' : '';
          return `<button class="chip ${state.wear[slot] === id ? 'on' : ''} ${tag}" data-wear="${slot}:${id}"
            title="${RELATIONS[rel].label}">${ELEMENTS[w.element].icon} ${esc(w.name)}${tag ? `<small>${RELATIONS[rel].short}</small>` : ''}</button>`;
        }).join('')}
      </div>`).join('')}
    <p class="muted small">Lv ${state.level}: bé ${RARITIES[sp.rarity].name.toLowerCase()} này đeo được <b>${wearLimit(state.level, sp.rarity)} món</b> cùng lúc
      (dưới Lv 30 đeo 3, từ Lv 30 đeo 4, Huyền thoại thêm 1).</p>
    ${outfitBonus(sp)}

    <h3>📈 Dáng theo cấp</h3>
    <div class="life-strip">${LEVEL_FORMS.map((f) => `
      <button class="life-step ${f.from === state.level ? 'on' : ''}" data-level="${f.from}"><canvas data-form="${f.from}"></canvas><small>Lv ${f.from}+ · ${esc(f.name)}</small></button>`).join('')}</div>

    <h3>🌱 Vòng đời</h3>
    <div class="life-strip">${LIFE_STAGES.map((s) => `
      <button class="life-step ${s.key === state.stage ? 'on' : ''}" data-stage="${s.key}"><canvas data-life="${s.key}"></canvas><small>${s.name}</small></button>`).join('')}</div>
    <p class="stage-note"><b>${stage.name} (${stage.fromWeek}+ tuần):</b> ${esc(stage.note)}</p>
    <p class="muted small">Tuổi thọ của loài này khoảng <b>${st.lifespan} tuần</b> (chăm tốt sống lâu hơn tới 20 tuần).</p>

    <h3>📊 Số liệu loài</h3>
    <div class="skill-bars">${SKILL_IDS.map((k) => `
      <div class="skill-bar"><span>${SKILLS[k].icon} ${SKILLS[k].name}</span>
        <i><b style="width:${(st.skills[k] / 30) * 100}%"></b></i><em>${st.skills[k]}</em>
        <small class="${st.growth[k] > 1 ? 'up' : ''}">×${st.growth[k].toFixed(2)}</small></div>`).join('')}</div>
    <ul class="stat-list">
      ${statRow('🍙 Hao no bụng', st.fullness, true)}
      ${statRow('⚡ Hồi năng lượng', st.energyRegen)}
      ${statRow('💖 Hao vui vẻ', st.happiness, true)}
      ${statRow('🫧 Hao sạch sẽ', st.hygiene, true)}
      ${statRow('🤒 Khả năng ốm', st.sickness, true)}
      ${statRow('❤️ Hồi sức khỏe', st.healthRegen)}
      <li>🏅 Sở trường: <b>${SKILLS[sp.fav].icon} ${SKILLS[sp.fav].name}</b></li>
      <li>💼 ${esc(el.perk)}</li>
    </ul>
    <h3>☯️ Tương sinh, tương khắc</h3>
    <ul class="stat-list">${relationsOf(sp.element)}</ul>`;

  play(detail.querySelector('#big'), framesFor(sp.id, state.stage, state.anim, state.wear), RIG_ANIMS[state.anim].fps, 5);
  for (const c of detail.querySelectorAll('[data-life]')) {
    const frame = drawFrame(sp, c.dataset.life, {}, state.wear, 0, { anchors: state.anchors, level: state.level, view: state.view });
    c.width = frame.width * 2;
    c.height = frame.height * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(frame, 0, 0, c.width, c.height);
  }
  for (const c of detail.querySelectorAll('[data-form]')) {
    const frame = drawFrame(sp, state.stage, {}, state.wear, 0, { level: Number(c.dataset.form), view: state.view });
    c.width = frame.width * 2;
    c.height = frame.height * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(frame, 0, 0, c.width, c.height);
  }
}

function render() {
  drawFilters();
  drawGallery();
  drawDetail();
}

// ---------------------------------------------------------------- sự kiện

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.rarity) {
    state.rarity = d.rarity;
    drawFilters();
    drawGallery();
  } else if (d.element) {
    state.element = d.element;
    drawFilters();
    drawGallery();
  } else if (d.level) {
    state.level = Number(d.level);
    render();
  } else if (d.stage) {
    state.stage = d.stage;
    render();
  } else if (d.view) {
    state.view = d.view;
    render();
  } else if (d.species) {
    state.selected = d.species;
    for (const c of document.querySelectorAll('.lab-card')) c.classList.toggle('current', c === b);
    drawDetail();
  } else if (d.anim) {
    state.anim = d.anim;
    drawDetail();
  } else if (d.wear !== undefined) {
    const [slot, id] = d.wear.split(':');
    state.wear = { ...state.wear, [slot]: id || null };
    drawDetail();
    if (state.dressAll) drawGallery();
  }
});

$('#show-anchors').addEventListener('change', (e) => {
  state.anchors = e.target.checked;
  render();
});
$('#dress-all').addEventListener('change', (e) => {
  state.dressAll = e.target.checked;
  drawGallery();
});

$('#dress-all').checked = state.dressAll;
$('#show-anchors').checked = state.anchors;
render();
startIcons();
setFavicon('🐾');
