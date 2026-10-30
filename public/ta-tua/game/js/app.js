import { api, embedded, session } from './api.js';
import { io } from './socket.js';

// park.js gọi window.io như với socket.io; đây là bản WebSocket thuần của game.
window.io = io;

// WorkHub đưa token phiên chơi vào #token=... (không qua query để không lọt vào log); đọc xong thì xóa khỏi URL.
{
  const hashParams = new URLSearchParams(location.hash.slice(1));
  if (hashParams.has('token')) {
    session.token = hashParams.get('token');
    // #who=member: phiên do tài khoản WorkHub quản lý (đăng xuất ở WorkHub, không ở đây).
    try {
      sessionStorage.setItem('petdex.who', hashParams.get('who') ?? 'player');
    } catch {
      // không lưu được: coi như người chơi thường
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
}
const isMemberSession = () => {
  try {
    return sessionStorage.getItem('petdex.who') === 'member';
  } catch {
    return false;
  }
};
import { burst, floatText, flyTo } from './fx.js';
import { mountPark } from './park.js';
import { mountRoomScene } from './scenes.js';
import { createPetFigure } from './sprite.js';
import { itemIcon } from './itemart.js';
import {
  DAILY_XP, EGG, EGG_ODDS, ELEMENTS, ELEMENT_RULES, LEVEL_FORMS, LIFE, LIFE_STAGES, RARITIES, RELATIONS, SLOTS, WEAR_RULES, foodBonus, formIndex,
  UPKEEP, dailyXp, relation, setOf, upkeepOf, wearBonus,
} from './shared/pets.js';
import { AFFIXES, AFFIX_ORDER, QUICK_SELL, SHOP_TIERS, STACKING, TIERS, TIER_ORDER, affixPool, affixText } from './shared/gear.js';
import { ESSENTIALS, ESSENTIAL_CATS } from './shared/industry.js';
import {
  $, MOOD_ICONS, STAT_ICONS, STAT_LABELS, TYPE_LABELS,
  ageText, busyOf, clock, closeModal, countdown, effectText, esc, fmt, formatWait, modalOpen, openModal, toast, viewHead,
} from './ui.js';
import { renderBank } from './views/bank.js';
import { renderBazaar } from './views/bazaar.js';
import { renderBusiness } from './views/business.js';
import { renderChat } from './views/chat.js';
import { renderClans } from './views/clans.js';
import { renderArena } from './views/arena.js';
import { renderClinic } from './views/clinic.js';
import { renderCommunity } from './views/community.js';
import { renderContracts } from './views/contracts.js';
import { renderCredit } from './views/credit.js';
import { renderFinance } from './views/finance.js';
import { renderClanBank } from './views/clan-bank.js';
import { renderShares } from './views/shares.js';
import { durabilityChip, forgeButtons, forgeConfirmText, renderForge, renderMaterials } from './views/forge.js';
import { renderFactory } from './views/factory.js';
import { renderGarden } from './views/garden.js';
import { renderKitchen } from './views/kitchen.js';
import { renderSchool } from './views/school.js';
import { renderTownhall } from './views/townhall.js';
import { renderGames } from './views/games.js';
import { renderJobs } from './views/jobs.js';
import { renderMap } from './views/map.js';
import { renderMail } from './views/mail.js';
import { renderMarket } from './views/market.js';
import { renderAnnouncement, renderNews } from './views/news.js';
import { renderWallet as renderWalletView } from './views/wallet.js';

const state = {
  catalog: null, // { items, species, rules, stages, careers, commodities, ... }
  me: null, // { user, pets, inventory, economy, badges }
  view: 'map',
  petId: null, // bé đang xem ở Nhà / Túi đồ
  shopFilter: 'all',
  adopting: false,
  adoptSpecies: null,
};

const VIEW_NAMES = [
  'map', 'home', 'shop', 'bag', 'park', 'ranks', 'jobs', 'games', 'bank', 'market', 'wallet', 'news', 'business', 'townhall', 'community',
  'garden', 'kitchen', 'school', 'clinic', 'factory', 'contracts', 'bazaar', 'credit', 'clans', 'finance', 'chat', 'mail',
  'forge', 'materials', 'arena', 'clanbank', 'shares',
];
const TYPE_ORDER = ['food', 'care', 'toy', 'accessory', 'egg'];
const IDLE_BY_MOOD = { great: 'idle', ok: 'idle', hungry: 'wait', tired: 'think', sad: 'sad', sick: 'sad', dirty: 'wait' };

let teardown = null; // dọn sprite/socket của màn đang hiển thị
let homeStage = null; // căn phòng + thú cưng đang hiện ở màn Nhà, để chạy hiệu ứng
let authFigure = null;
let renderSeq = 0;
let busy = false;

const items = () => state.catalog.items;
const speciesOf = (id) => state.catalog.species.find((s) => s.id === id) ?? state.catalog.species[0];
const wornIds = (pet) => Object.values(pet?.wear ?? {}).filter(Boolean);
const isWorn = (pet, itemId) => wornIds(pet).includes(itemId);
/** Giai đoạn tuổi từ số tuần (bảng vàng chỉ gửi số tuần). */
const stageOfWeeks = (weeks) => state.catalog.stages.findLast((s) => weeks * 7 >= s.minDays)?.key ?? 'young';
const figureOf = (pet, base) => createPetFigure(speciesOf(pet.species), base, pet.wear, { stage: pet.age.stage, ageScale: pet.age.scale, level: pet.level });
const qtyOf = (itemId) => state.me.inventory[itemId] ?? 0;
const isConsumable = (item) => item.type === 'food' || item.type === 'care';
const ownedOfType = (type) => Object.values(items()).filter((i) => i.type === type && qtyOf(i.id) > 0);
/** Trang phục (bản có cấp) người chơi đang có, không gồm món đang bày bán. */
const myGear = () => state.me.gear ?? [];
const tierChip = (tier) => (TIERS[tier] ? `<span class="tier-chip tier-${tier}">${TIERS[tier].name}</span>` : '');

/** Dáng trưởng thành theo cấp (cứ 10 cấp đổi một lần), kèm gợi ý dáng kế tiếp. */
function formBadge(pet) {
  const i = formIndex(pet.level);
  const next = LEVEL_FORMS[i + 1];
  const tip = `${LEVEL_FORMS[i].note}${next ? ` Lên Lv ${next.from}: ${next.name}.` : ''}`;
  return `<span class="badge form-badge form-${i}" title="${esc(tip)}">✨ ${esc(LEVEL_FORMS[i].name)}</span>`;
}

/** Số món bé đang đeo / được đeo, và luật mở thêm khe. */
function wearCountLine(pet) {
  const limit = pet.wearLimit ?? WEAR_RULES.base;
  const legend = speciesOf(pet.species).rarity === 'huyenthoai';
  const more = pet.level < WEAR_RULES.grownLevel ? ` Lên Lv ${WEAR_RULES.grownLevel} đeo thêm 1 món.` : '';
  return `<p class="outfit-now">Đang đeo <b>${wornIds(pet).length}/${limit}</b> món, mỗi khe một món.${more}${legend ? ' Bé Huyền thoại được đeo thêm 1 món.' : ''}</p>`;
}
const gearLines = (g) => AFFIX_ORDER.filter((a) => g.affixes?.[a]).map((a) => affixText(a, g.affixes[a])).join(' · ');
const petName = (id) => state.me.pets.find((p) => p.id === id)?.name ?? 'bé khác';
const bestLevel = () => Math.max(0, ...state.me.pets.map((p) => p.level));
const idleAnim = (pet) => IDLE_BY_MOOD[pet?.mood.key] ?? 'idle';
/**
 * Giá siêu thị hiện tại = giá gốc × chỉ số giá của Ngân hàng Trung ương; đồ ăn / đồ chăm sóc NPC nhân thêm hệ số theo
 * mức tự chủ của nhóm, hàng gia tộc theo giá tham chiếu hôm nay của Thực phẩm chế biến / Thuốc và hạng chất lượng.
 */
function priceOf(item) {
  const ess = state.me?.essentials?.[item.type];
  if (item.clanMade && ess) return ess.prices[item.quality ?? 0];
  const base = item.price * (state.me?.economy.priceIndex ?? 1);
  return Math.max(1, Math.round(ess ? Math.round(base) * ess.npcPriceFactor : base));
}
const activePet = () => state.me.pets.find((p) => p.id === state.me.user.activePetId) ?? state.me.pets[0] ?? null;

function currentPet() {
  const { pets, user } = state.me;
  return pets.find((p) => p.id === state.petId) ?? pets.find((p) => p.id === user.activePetId) ?? pets[0];
}

// ---------------------------------------------------------------- khởi động

async function boot() {
  try {
    state.catalog = await api('/catalog');
  } catch (err) {
    document.body.innerHTML = `<p class="empty">Không kết nối được máy chủ: ${esc(err.message)}</p>`;
    return;
  }
  if (session.token) {
    try {
      state.me = await api('/me');
      return showApp();
    } catch (err) {
      if (err.status === 401) session.token = null;
    }
  }
  showAuth();
}

function showAuth() {
  teardown?.();
  teardown = null;
  $('#app').hidden = true;
  $('#auth-screen').hidden = false;
  // Nhúng trong WorkHub: không có đăng nhập bằng mật khẩu, chỉ báo cách vào lại.
  $('#auth-form').hidden = embedded;
  $('#auth-embedded').hidden = !embedded;
  authFigure?.destroy();
  const species = state.catalog.species[0];
  if (species) {
    authFigure = createPetFigure(species, 0.7);
    authFigure.sprite.play('wave');
    $('#auth-pet').replaceChildren(authFigure.el);
  }
}

function showApp() {
  authFigure?.destroy();
  authFigure = null;
  $('#auth-screen').hidden = true;
  $('#app').hidden = false;
  const fromHash = location.hash.slice(1);
  state.view = VIEW_NAMES.includes(fromHash) ? fromHash : 'map';
  render();
  showNewAnnouncement();
}

const SEEN_KEY = 'petdex.seenAnnouncement';
const seenAnnouncement = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};

/** Thông báo mới của ban quản lý bật lên một lần (máy này nhớ thông báo nào đã xem); đọc lại ở Báo Trân Châu. */
async function showNewAnnouncement() {
  let notes;
  try {
    notes = await api('/announcements');
  } catch {
    return;
  }
  const seen = seenAnnouncement();
  const next = notes.find((a) => a.popup && a.id > seen);
  if (!next || modalOpen()) return;
  try {
    localStorage.setItem(SEEN_KEY, String(Math.max(...notes.map((a) => a.id))));
  } catch {
    // không lưu được thì lần sau bật lại, không sao
  }
  openModal({
    title: `📣 ${next.title}`,
    html: `<div class="announcement-body modal-scroll">${renderAnnouncement(next.body)}</div>
      <div class="row end"><button class="btn small" data-go-news>Xem ở Báo Trân Châu</button><button class="btn primary" data-close>Đã xem</button></div>`,
  });
  document.querySelector('[data-go-news]')?.addEventListener('click', () => {
    closeModal();
    go('news');
  });
}

async function logout() {
  if (session.token) api('/auth/logout', {}).catch(() => {});
  session.token = null;
  state.me = null;
  closeModal();
  showAuth();
}

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = e.submitter?.value === 'register' ? 'register' : 'login';
  const body = Object.fromEntries(new FormData(e.currentTarget));
  $('#auth-error').textContent = '';
  try {
    const { token, ...me } = await api(`/auth/${mode}`, body);
    session.token = token;
    state.me = me;
    state.petId = null;
    showApp();
    if (mode === 'register') toast(`Chào ${me.user.username}! Bạn có ${me.user.coins} 🪙 để bắt đầu.`);
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
});

// ---------------------------------------------------------------- điều hướng & vẽ

function go(view, filter) {
  state.adopting = false;
  if (filter) state.shopFilter = filter;
  if (location.hash !== `#${view}`) location.hash = view;
  else render();
}

window.addEventListener('hashchange', () => {
  const view = location.hash.slice(1);
  if (!state.me || !VIEW_NAMES.includes(view)) return;
  state.view = view;
  state.adopting = false;
  render();
});

function render() {
  teardown?.();
  teardown = null;
  homeStage = null;
  renderSeq += 1;
  closeModal();
  for (const tab of document.querySelectorAll('#tabs button')) tab.classList.toggle('active', tab.dataset.view === state.view);
  renderWallet();
  const views = {
    map: renderMap, home: renderHome, shop: renderShop, bag: renderBag, park: renderPark, ranks: renderRanks,
    jobs: renderJobs, games: renderGames, bank: renderBank, market: renderMarket, wallet: renderWalletView, news: renderNews,
    business: renderBusiness, townhall: renderTownhall, community: renderCommunity,
    garden: renderGarden, kitchen: renderKitchen, school: renderSchool, clinic: renderClinic,
    factory: renderFactory, contracts: renderContracts, bazaar: renderBazaar, credit: renderCredit, clans: renderClans,
    finance: renderFinance, chat: renderChat, mail: renderMail,
    forge: renderForge, materials: renderMaterials, arena: renderArena, clanbank: renderClanBank, shares: renderShares,
  };
  const out = views[state.view]($('#view'), ctx);
  if (typeof out === 'function') teardown = out;
}

/** Những gì các màn trong views/ được dùng từ app. */
const ctx = {
  get catalog() {
    return state.catalog;
  },
  get me() {
    return state.me;
  },
  act: (path, body, opts) => act(path, body, opts),
  go: (view) => go(view),
  refresh: () => render(),
  refreshMe: async () => {
    state.me = await api('/me');
    renderWallet();
  },
  /** Cập nhật trạng thái từ phản hồi có `result` mà không vẽ lại màn (dùng khi đang mở lớp phủ). */
  applyResult(res) {
    const { result, ...me } = res;
    state.me = me;
    renderWallet();
    celebrate(result?.levelUps, result?.petName);
  },
  fail(err) {
    if (err?.status === 401) return logout();
    toast(err?.message ?? 'Có lỗi xảy ra.', 'error');
  },
  toast,
  bestLevel: () => bestLevel(),
  activePet: () => activePet(),
};

function renderWallet() {
  const { user } = state.me;
  $('#coin-count').textContent = `🪙 ${user.coins.toLocaleString('vi-VN')}`;
  $('#username').textContent = user.username;
  const wait = user.dailyReadyAt - Date.now();
  const daily = $('#daily-btn');
  daily.disabled = wait > 0;
  daily.classList.toggle('ready', wait <= 0);
  daily.innerHTML = wait > 0
    ? `⏳ <span class="label">Quà sau ${formatWait(wait)}</span>`
    : `🎁 <span class="label">Nhận quà ngày${user.streak ? ` · 🔥${user.streak}` : ''}</span>`;
  daily.title = `Chuỗi đăng nhập ${user.streak} ngày. Nhận liên tiếp mỗi ngày để quà tăng dần tới 120 xu.`;
  // Chấm đỏ: tin gia tộc + tin nhắn riêng chưa đọc ở tab Trò chuyện, thư chưa đọc / quà chưa nhận ở Hộp thư.
  const b = state.me.badges ?? {};
  setDot($('#tabs [data-view="chat"]'), (b.clan ?? 0) + (b.pm ?? 0));
  setDot($('#mail-btn'), b.mail ?? 0);
}

function setDot(el, n) {
  if (!el) return;
  let dot = el.querySelector('.nav-dot');
  if (!n) return dot?.remove();
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'nav-dot';
    el.append(dot);
  }
  dot.textContent = n > 99 ? '99+' : String(n);
}

/** Tải lại trạng thái (chỉ số tụt dần theo thời gian, quà từ người khác...) mà không làm phiền người đang thao tác. */
async function refreshMe() {
  if (!state.me) return;
  try {
    state.me = await api('/me');
  } catch (err) {
    if (err.status === 401) logout();
    return;
  }
  const busyScreen = modalOpen() || $('#adopt-form') || document.activeElement?.matches('input, select');
  if (['home', 'bag', 'shop'].includes(state.view) && !busyScreen) render();
  else renderWallet();
}

setInterval(() => document.visibilityState === 'visible' && refreshMe(), 30_000);

/**
 * Gọi một hành động, cập nhật trạng thái, thông báo rồi diễn hiệu ứng `fx(stage, result)` ở màn Nhà.
 * `onResult(result)` cho các màn khác thêm thông báo riêng.
 */
async function act(path, body = {}, { fx, onDone, onResult } = {}) {
  if (busy) return;
  busy = true;
  try {
    const { result, ...me } = await api(path, body);
    state.me = me;
    onDone?.(me);
    if (state.view === 'park') renderWallet();
    else render();
    if (result?.message) toast(result.message);
    onResult?.(result ?? {});
    if (homeStage && fx) {
      homeStage.room.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      fx(homeStage, result ?? {});
    }
    celebrate(result?.levelUps, result?.petName);
  } catch (err) {
    if (err.status === 401) return logout();
    toast(err.message, 'error');
  } finally {
    busy = false;
  }
}

function celebrate(levelUps = [], petName = 'Bé') {
  for (const { level, reward } of levelUps) toast(`🎉 ${petName} lên cấp ${level}! Thưởng ${reward} 🪙`, 'level');
  if (!levelUps.length || !homeStage) return;
  const stage = homeStage;
  setTimeout(() => {
    const head = stage.at(0.85);
    stage.react('jump');
    burst(stage.room, head.x, head.y, { icon: 'sparkle', count: 14, spread: 260, rise: 150, life: 1400 });
    floatText(stage.room, head.x, head.y - 30, 'LÊN CẤP!', { color: '#ffd75e', size: 30, rise: 70 });
  }, 900);
}

// ---------------------------------------------------------------- hiệu ứng ở màn Nhà

function showGain(stage, gain = {}) {
  const head = stage.at(0.8);
  if (gain.xp) floatText(stage.room, head.x + 70, head.y, `+${gain.xp} XP`, { color: '#ffe27a', delay: 150 });
  if (gain.coins) floatText(stage.room, head.x - 70, head.y + 10, `+${gain.coins} 🪙`, { color: '#fff3c4', delay: 350 });
}

/** Món đồ bay từ cửa sổ vào miệng bé, rồi bung hạt theo loại đồ. */
async function useItemFx(stage, item, result) {
  const mouth = stage.at(0.5);
  const from = { x: stage.room.clientWidth - 90, y: stage.room.clientHeight * 0.3 };
  await flyTo(stage.room, from, mouth, item.icon, { size: 46 });
  if (item.type === 'food') {
    stage.react('jump');
    burst(stage.room, mouth.x, mouth.y, { icon: 'crumb', count: 7, fall: true, rise: 50, spread: 80, life: 700, stagger: 15 });
    burst(stage.room, mouth.x, mouth.y - 40, { icon: 'heart', count: 4, spread: 90 });
  } else if (item.id === 'bath') {
    stage.react('spin');
    burst(stage.room, mouth.x, mouth.y, { icon: 'bubble', count: 10, spread: 180, rise: 140, life: 1600, stagger: 70 });
  } else {
    stage.react('jump');
    burst(stage.room, mouth.x, mouth.y - 20, { icon: 'sparkle', count: 8, spread: 160, rise: 90 });
  }
  showGain(stage, result.gain);
}

async function playFx(stage, toy, result) {
  stage.react('spin');
  const feet = stage.at(0.05);
  if (toy) {
    const left = { x: feet.x - 110, y: feet.y - 10 };
    const right = { x: feet.x + 110, y: feet.y - 10 };
    await flyTo(stage.room, left, right, toy.icon, { size: 38, arc: 150, duration: 700, spin: 540 });
    await flyTo(stage.room, right, { x: feet.x - 40, y: feet.y }, toy.icon, { size: 38, arc: 80, duration: 450, spin: 360 });
  }
  burst(stage.room, feet.x, stage.at(0.6).y, { icon: 'twinkle', count: 8, spread: 200, rise: 90 });
  burst(stage.room, feet.x, feet.y, { icon: 'dust', count: 4, spread: 90, rise: 14, life: 600, stagger: 0 });
  showGain(stage, result.gain);
}

function sparkleFx(anim, icon = 'sparkle') {
  return (stage) => {
    stage.react(anim);
    const head = stage.at(0.8);
    burst(stage.room, head.x, head.y, { icon, count: 7, spread: 160, rise: 80 });
  };
}

/** Thỉnh thoảng bé tự thể hiện tâm trạng: ngáp ngủ, rơi nước mắt, lấp lánh khi vui. */
function moodTick(stage, pet) {
  const head = stage.at(0.82);
  if (pet.mood.key === 'tired') burst(stage.room, head.x + 40, head.y, { icon: 'zzz', count: 1, spread: 30, rise: 60, life: 2000 });
  else if (pet.mood.key === 'sad') burst(stage.room, head.x - 18, stage.at(0.62).y, { icon: 'drop', count: 1, spread: 6, rise: 40, fall: true, life: 900 });
  else if (pet.mood.key === 'great' && Math.random() < 0.5) burst(stage.room, head.x, head.y, { icon: 'twinkle', count: 2, spread: 150, rise: 40, life: 1200 });
}

// ---------------------------------------------------------------- Nhà

function meter(kind, label, value, max) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const low = kind !== 'xp' && pct < 25 ? 'low' : '';
  return `
    <div class="meter">
      <div class="meter-head"><span>${label}</span><span>${value}/${max}</span></div>
      <div class="bar ${kind} ${low}"><i style="width:${pct}%"></i></div>
    </div>`;
}

/** Giai đoạn đời của bé đang có luật gì, và lời báo khi bé đã rất già. */
function lifeNotes(pet) {
  const stage = LIFE_STAGES.find((s) => s.key === pet.age.stage);
  const warn = pet.life?.warn
    ? `<p class="life-warn">🌙 ${esc(pet.name)} đã rất già, còn khoảng ${pet.life.left} ngày thật nữa là về với sao trời.
        Dành thời gian chơi với bé, mặc bộ đồ đẹp nhất, dắt bé ra công viên nhé.</p>`
    : '';
  return `${stage ? `<p class="stage-note">${esc(stage.note)}</p>` : ''}${warn}`;
}

/** Tin bé vừa về với sao trời (trong 3 ngày qua). */
function memorialNotice() {
  const [m] = state.me.memorials ?? [];
  if (!m) return '';
  const skill = state.catalog.skills[m.heirloom];
  return `<section class="card memorial-note">🌠 <b>${esc(m.name)}</b> đã về với sao trời sau ${m.weeks} tuần, lên tới cấp ${m.level}.
    ${skill ? `Bé để lại kỷ vật: bé nuôi kế tiếp được +${LIFE.heirloom} ${skill.icon} ${skill.name}.` : ''}
    <button class="btn small" data-go="ranks" data-ranks-go="stars">Thăm Đồi Sao</button></section>`;
}

/** Dòng hành, độ hiếm và vận khí của bé ở màn Nhà. */
function elementLine(pet) {
  const el = ELEMENTS[pet.element];
  if (!el) return '';
  const sp = speciesOf(pet.species);
  const r = RARITIES[sp.rarity] ?? RARITIES.thuong;
  const lucky = pet.element === state.me.fortune;
  return `<p class="element-line" style="--el:${el.color}">
    <span class="el-chip" title="${esc(`${el.temper}. ${el.perk}.`)}">${el.icon} ${el.name}</span>
    <span class="stars" style="color:${r.color}" title="${r.name}">${'★'.repeat(r.stars)}</span>
    <small class="muted">${esc(sp.name)}${sp.mascot ? ' · linh vật' : sp.guest ? ' · khách mời' : ''}</small>
    ${lucky ? `<span class="badge fortune">🌟 Hôm nay hành ${el.name} vượng: +${ELEMENT_RULES.fortune * 100}% XP và lương</span>` : ''}
  </p>`;
}

/** Tổng % trang phục bé đang đeo cộng lại (mỗi loại tối đa 100%). */
function gearBonusLine(pet) {
  const b = pet.bonus ?? {};
  const parts = AFFIX_ORDER.filter((a) => b[a]).map((a) => `<span class="gear-bonus" title="${esc(AFFIXES[a].desc)}">${affixText(a, b[a])}</span>`);
  return parts.length ? `<p class="gear-bonus-line">${parts.join('')}</p>` : '';
}

/** Hiệu quả bộ đồ đang mặc: tốc độ lên kỹ năng theo hợp mệnh, và thưởng lương khi đủ bộ cùng hành. */
function outfitSummary(pet) {
  const el = ELEMENTS[pet.element];
  if (!el) return wearCountLine(pet);
  const pct = Math.round(wearBonus(pet.wear, pet.element) * 100);
  const set = setOf(pet.wear);
  const sets = Object.entries(ELEMENT_RULES.sets).map(([n, k]) => `${n} món +${k * 100}%`).join(', ');
  return `${wearCountLine(pet)}
    <p class="muted small">Đồ hành nuôi dưỡng bé ${el.icon} ${el.name} (tương sinh) +10% tốc độ lên kỹ năng,
      cùng hành +5%, đồ kỵ mệnh −5% (cả bộ tối đa +${ELEMENT_RULES.wearCap * 100}%). Mặc nhiều món cùng một hành thì thêm lương: ${sets}.</p>
    <p class="outfit-now">Đang mặc: <b class="${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${pct > 0 ? '+' : ''}${pct}%</b> tốc độ lên kỹ năng${set ? ` · ✨ bộ ${set.count} món hành ${ELEMENTS[set.element].name}: +${Math.round(set.pay * 100)}% lương` : ''}</p>
    <p class="muted small">Trang phục có cấp ${TIER_ORDER.map((t) => tierChip(t)).join(' → ')}, lần lượt 1–4 dòng chỉ số; các dòng của đồ đang đeo cộng dồn cho bé:
      mỗi loại tính đủ tới ${STACKING.softCap}%, phần vượt tính một nửa, tối đa ${STACKING.totalCap}%.
      Đồ mua ở Siêu thị là hộp kín 1–2 dòng, mở ra mới biết dòng nào.</p>
    ${gearBonusLine(pet)}`;
}

function petSwitcher(current, { withAdopt }) {
  const { pets, user } = state.me;
  const { rules } = state.catalog;
  const chips = pets.map((p) => `
    <button class="btn small ${p.id === current.id ? 'current' : ''}" data-pet="${p.id}">
      ${p.id === user.activePetId ? '⭐ ' : ''}${esc(p.name)} · Lv ${p.level}
    </button>`);
  const { eggs, slots } = state.me;
  if (withAdopt && slots.free > 0) {
    chips.push(`<button class="btn small" data-act="adopt">➕ Nhận nuôi thêm · ${rules.adoptCost} 🪙</button>`);
  }
  if (withAdopt && slots.locked) {
    chips.push(`<button class="btn small" data-act="reopen" title="Ô của bé đã về với sao trời">🕯️ Ô tưởng niệm · mở lại ${fmt(slots.reopenCost)} 🪙</button>`);
  }
  if (withAdopt && eggs.length) {
    const ready = eggs.filter((e) => e.ready).length;
    chips.push(`<button class="btn small ${ready ? 'gold' : ''}" data-act="adopt">${ready ? `🐣 ${ready} trứng nở rồi!` : `🥚 ${eggs.length} trứng đang ấp`}</button>`);
  }
  return `<nav class="switcher">${chips.join('')}</nav>`;
}

function renderHome(root) {
  if (!state.me.pets.length || state.adopting) return renderAdopt(root);
  const pet = currentPet();
  state.petId = pet.id;
  const isActive = pet.id === state.me.user.activePetId;
  const busy = busyOf(pet);
  const busyLeft = busy ? pet.busyUntil - Date.now() : 0;
  const nextStage = state.catalog.stages.find((s) => s.minDays > pet.age.days);
  const growNote = nextStage ? ` · còn ${Math.ceil((nextStage.minDays - pet.age.days) / 7)} ngày nữa thành ${nextStage.label}` : '';
  const countOf = (type) => ownedOfType(type).reduce((n, i) => n + qtyOf(i.id), 0);
  const { skills } = state.catalog;

  root.innerHTML = `
    ${petSwitcher(pet, { withAdopt: true })}
    ${memorialNotice()}
    <div class="home">
      <section class="card room-card mood-${pet.mood.key}">
        <div class="room" id="room">
          <div class="figure-slot" id="figure-slot" title="Chạm để chào ${esc(pet.name)}"></div>
          ${busy?.away
            ? `<div class="away-note pixel-box">${busy.icon} ${esc(pet.name)} ${busy.text}<br><small>${busy.until} ${clock(pet.busyUntil)} · còn ${countdown(busyLeft)}</small></div>`
            : busy
              ? `<div class="mood-bubble">${busy.icon} ${busy.text[0].toUpperCase()}${busy.text.slice(1)} · còn ${countdown(busyLeft)}</div>`
              : `<div class="mood-bubble">${MOOD_ICONS[pet.mood.key]} ${pet.mood.label}</div>`}
        </div>
      </section>
      <section class="card pet-info">
        <div class="pet-title">
          <h2>${esc(pet.name)}</h2>
          <span class="badge level">Lv ${pet.level}</span>
          ${formBadge(pet)}
          ${isActive ? '<span class="badge star">⭐ Thú chính</span>' : ''}
        </div>
        ${elementLine(pet)}
        <p class="age-line">🎂 ${ageText(pet.age.days)} · ${pet.age.label}${growNote}</p>
        ${lifeNotes(pet)}
        ${meter('xp', '⭐ Kinh nghiệm', pet.xp, pet.xpNext)}
        <p class="muted small daily-xp" title="Bé yếu (sức khỏe dưới ${DAILY_XP.weakBelow}) chỉ được một nửa.">🌙 Mỗi đêm bé tự lớn thêm <b>+${dailyXp(pet.xpNext, pet.health)} XP</b>, kể cả khi bạn không vào game.
          Phí chăm nuôi khoảng <b>${upkeepOf(pet.level, state.me.economy.priceIndex)} xu/ngày</b> (không quá ${UPKEEP.incomeShare * 100}% thu nhập trong ngày của bạn).</p>
        ${pet.sick ? `<div class="sick-note">${pet.sick.icon} ${esc(pet.name)} đang bị <b>${esc(pet.sick.name.toLowerCase())}</b>: chưa đi làm, đi học hay chơi mini-game được.
          <button class="btn small pink" data-go="clinic">🩺 Đưa đi khám</button></div>` : ''}
        ${['fullness', 'happiness', 'energy', 'hygiene', 'health'].map((s) => meter(s, `${STAT_ICONS[s]} ${STAT_LABELS[s]}`, pet[s], 100)).join('')}
        ${pet.traits.length ? `<div class="trait-row">${pet.traits.map((t) => state.catalog.care.traits[t]).filter(Boolean)
          .map((t) => `<span class="trait-chip" title="${esc(t.desc)}">${t.icon} ${esc(t.name)}</span>`).join('')}</div>` : ''}
        <div class="skills-row">
          ${Object.entries(skills).map(([id, s]) => `
            <span class="skill-chip" title="${s.name}">${s.icon}<b>${Math.floor(pet.skills?.[id] ?? 0)}</b></span>`).join('')}
        </div>
        <div class="actions">
          <button class="btn primary" data-act="feed"><b>🍽️</b>Cho ăn<small>${countOf('food')} món trong túi</small></button>
          <button class="btn pink" data-act="play" ${busyLeft > 0 ? 'disabled' : ''}><b>🎾</b>Chơi đùa<small>${busy ? `Bé ${busy.text}` : '−15 ⚡ · +4 🪙'}</small></button>
          <button class="btn gold" data-go="jobs">
            <b>💼</b>Đi làm<small>${busy ? `${busy.away ? 'Về' : 'Rảnh'} sau ${countdown(busyLeft)}` : 'Chọn nghề, nhận ca'}</small>
          </button>
          <button class="btn mint" data-act="bath" ${busyLeft > 0 ? 'disabled' : ''}><b>🛁</b>Tắm<small>${busy ? `Bé ${busy.text}` : `Miễn phí · 🫧 ${pet.hygiene}`}</small></button>
          <button class="btn" data-act="care"><b>💊</b>Chăm sóc<small>${countOf('care')} món trong túi</small></button>
          <button class="btn" data-act="dress"><b>🎀</b>Trang phục<small>${wornIds(pet).length ? `Đang đeo ${wornIds(pet).length}/4 món` : 'Chưa đeo gì'}</small></button>
          ${isActive
            ? '<button class="btn" data-go="park"><b>🌳</b>Ra công viên<small>Gặp bạn mới</small></button>'
            : '<button class="btn" data-act="activate"><b>⭐</b>Chọn thú chính<small>Để dắt ra công viên</small></button>'}
          <button class="btn ${pet.sick ? 'pink' : ''}" data-go="clinic"><b>🩺</b>Phòng khám<small>${pet.sick ? 'Bé đang ốm!' : `❤️ ${pet.health}`}</small></button>
        </div>
      </section>
    </div>`;

  const room = $('#room');
  const slot = $('#figure-slot');
  const figure = figureOf(pet, 1.25);
  figure.sprite.play(idleAnim(pet));
  slot.append(figure.el);
  slot.hidden = Boolean(busy?.away); // đi làm, đi học thì vắng nhà; tắm thì vẫn ở nhà

  const stage = {
    room,
    figure,
    feet: { x: 0, y: 0 },
    /** Điểm trên thân bé: 0 là chân, 1 là đỉnh khung hình. */
    at(frac) {
      return { x: this.feet.x - 4, y: this.feet.y - figure.height * frac };
    },
    react(anim) {
      figure.sprite.play(anim, { once: true, then: idleAnim(pet) });
    },
  };
  const unmountRoom = mountRoomScene(room, {
    onLayout: ({ x, y }) => {
      stage.feet = { x, y };
      slot.style.left = `${x}px`;
      slot.style.top = `${y}px`;
    },
  });
  const moodTimer = setInterval(() => moodTick(stage, pet), 2600);
  homeStage = stage;
  teardown = () => {
    clearInterval(moodTimer);
    unmountRoom();
    figure.destroy();
  };
}

const pickRow = (item, side, { current = false } = {}) => `
  <button class="pick ${current ? 'current' : ''}" data-pick="${item.id}">
    <b>${itemIcon(item, 3)}</b>
    <span>${esc(item.name)}<small>${esc(effectText(item))}</small></span>
    <span class="badge">${side}</span>
  </button>`;

const emptyPick = (type) => `
  <div class="empty">
    <b>🫙</b>
    <p>Túi chưa có ${TYPE_LABELS[type].toLowerCase()} nào.</p>
    <button class="btn primary" data-pick="shop:${type}">Ghé cửa hàng</button>
  </div>`;

function pickConsumable(type, title) {
  const pet = currentPet();
  const list = ownedOfType(type);
  openModal({
    title: `${title} cho ${pet.name}`,
    html: list.length
      ? `<div class="pick-list">${list.map((i) => pickRow(i, `×${qtyOf(i.id)}${foodBonus(i.element, pet.element) ? ` · 🌟 +${ELEMENT_RULES.food * 100}% XP` : ''}`)).join('')}</div>`
      : emptyPick(type),
    onPick: (id) => {
      if (id.startsWith('shop:')) return go('shop', id.slice(5));
      act(`/pets/${pet.id}/use`, { itemId: id }, { fx: (stage, result) => useItemFx(stage, items()[id], result) });
    },
  });
}

const ACTIONS = {
  feed: () => pickConsumable('food', 'Cho ăn'),
  care: () => pickConsumable('care', 'Chăm sóc'),
  bath: () => act(`/pets/${currentPet().id}/bath`, {}, { fx: sparkleFx('jump', 'sparkle') }),
  activate: () => act(`/pets/${currentPet().id}/active`, {}, { fx: sparkleFx('wave', 'heart') }),
  adopt: () => {
    state.adopting = true;
    render();
  },
  reopen: () => {
    const { reopenCost } = state.me.slots;
    if (confirm(`Mở lại ô tưởng niệm với giá ${fmt(reopenCost)} xu để nuôi thêm bé mới?`)) act('/slots/reopen');
  },
  'cancel-adopt': () => {
    state.adopting = false;
    render();
  },
  play: () => {
    const pet = currentPet();
    const toys = ownedOfType('toy');
    if (!toys.length) return act(`/pets/${pet.id}/play`, {}, { fx: (stage, result) => playFx(stage, null, result) });
    openModal({
      title: `Chơi với ${pet.name}`,
      html: `<div class="pick-list">
        <button class="pick" data-pick="none"><b>🤸</b><span>Chơi tay không<small>💖 +12  ⭐ +10 XP</small></span><span class="badge">Miễn phí</span></button>
        ${toys.map((t) => pickRow(t, 'Của bạn')).join('')}
      </div>`,
      onPick: (id) => {
        const toy = id === 'none' ? null : items()[id];
        act(`/pets/${pet.id}/play`, toy ? { toyId: id } : {}, { fx: (stage, result) => playFx(stage, toy, result) });
      },
    });
  },
  dress: () => {
    const pet = currentPet();
    const list = myGear();
    const tierRank = (t) => TIER_ORDER.indexOf(t);
    // Tủ đồ theo 5 khe (đầu, mặt, cổ, lưng, bùa), mỗi khe một món; số món đeo cùng lúc tùy cấp và độ hiếm của bé.
    // Mỗi món là một bản có cấp riêng; hộp mua ở Siêu thị phải mở ra mới đeo được.
    const slotRows = Object.entries(SLOTS).map(([slot, s]) => {
      const mine = list.filter((g) => g.slot === slot).sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || b.id - a.id);
      const worn = pet.gear?.[slot];
      const remove = pet.wear?.[slot]
        ? `<button class="pick" data-pick="slot:${slot}"><b>🚫</b><span>Tháo ${esc(items()[pet.wear[slot]]?.name ?? '')}<small>Để trống khe ${s.name.toLowerCase()}</small></span><span class="badge">Tháo</span></button>`
        : '';
      const rows = mine.map((g) => {
        const item = items()[g.itemId];
        if (g.sealed) {
          return `
          <button class="pick" data-pick="open:${g.id}">
            <b>🎁</b>
            <span>${esc(item.name)} <span class="tier-chip">Hộp chưa mở</span><small>Mở hộp để xem 1–2 dòng chỉ số</small></span>
            <span class="badge">Mở hộp</span>
          </button>`;
        }
        const rel = RELATIONS[relation(item.element, pet.element)];
        const tag = rel.bonus ? ` · ${rel.short}` : '';
        const here = worn?.gearId === g.id;
        const elsewhere = g.wornBy && g.wornBy !== pet.id ? ` · đang đeo cho ${esc(petName(g.wornBy))}` : '';
        return `
          <button class="pick ${here ? 'current' : ''}" data-pick="gear:${g.id}">
            <b>${itemIcon(item, 3)}</b>
            <span>${esc(item.name)} ${tierChip(g.tier)} ${durabilityChip(g)}<small>${esc(gearLines(g))}${elsewhere}${g.usable === false ? ' · chưa cộng chỉ số, sửa ở Lò rèn' : ''}</small></span>
            <span class="badge">${here ? 'Đang đeo' : `${ELEMENTS[item.element].icon} Đeo${tag}`}</span>
          </button>`;
      }).join('');
      return `<h4 class="slot-head">${s.icon} ${s.name}</h4>${remove}${rows || '<p class="muted small">Chưa có món nào cho khe này.</p>'}`;
    }).join('');
    openModal({
      title: `Trang phục cho ${pet.name}`,
      html: list.length
        ? `${outfitSummary(pet)}
           ${speciesOf(pet.species).guest ? '<p class="muted small">Bé khách mời Petdex ôm đồ trước ngực nên đồ ở cổ nằm khuất phía sau.</p>' : ''}
           <div class="pick-list">${slotRows}</div>`
        : emptyPick('accessory'),
      onPick: (id) => {
        if (id.startsWith('shop:')) return go('shop', id.slice(5));
        if (id.startsWith('open:')) return act(`/gear/${id.slice(5)}/open`, {}, { fx: sparkleFx('jump', 'sparkle') });
        const body = id.startsWith('slot:') ? { slot: id.slice(5) } : { gearId: Number(id.slice(5)) };
        act(`/pets/${pet.id}/equip`, body, { fx: sparkleFx('spin') });
      },
    });
  },
};

// ---------------------------------------------------------------- Nhận nuôi

/** Trứng ngũ hành: trứng trong túi đem ấp, trứng đang ấp đếm giờ, trứng nở thì đặt tên. */
function eggPanel() {
  const { eggs } = state.me;
  const bag = Object.values(items()).filter((i) => i.type === 'egg' && qtyOf(i.id) > 0);
  const full = state.me.pets.length + eggs.length >= state.catalog.rules.maxPets;
  const odds = Object.entries(EGG_ODDS).map(([k, p]) => `${p * 100}% ${RARITIES[k].name}`).join(', ');
  const cards = [
    ...bag.map((i) => `
      <div class="egg-card" style="--el:${ELEMENTS[i.element].color}">${itemIcon(i, 4)}
        <b>${esc(i.name)}</b><small>trong túi · ×${qtyOf(i.id)}</small>
        <button class="btn small gold" data-incubate="${i.id}" ${full ? 'disabled' : ''}>Ấp trứng</button>
      </div>`),
    ...eggs.map((e) => {
      const item = items()[`egg_${e.element}`];
      return `
      <div class="egg-card ${e.ready ? 'ready' : ''}" style="--el:${ELEMENTS[e.element].color}">${itemIcon(item, 4)}
        <b>${esc(item.name)}</b>
        ${e.ready
          ? `<form class="egg-hatch" data-egg="${e.id}"><input name="name" maxlength="16" required placeholder="Tên bé" />
              <button class="btn small primary">🐣 Cho nở</button></form>`
          : `<small>nở sau ${countdown(e.hatchAt - Date.now())}</small>`}
      </div>`;
    }),
  ];
  return `
    <section class="egg-panel">
      <h3>🥚 Trứng ngũ hành</h3>
      <p class="muted small">Mua ở Siêu thị (cần bé cấp ${EGG.minLevel}), ấp ${EGG.hours} giờ thì nở ra một bé của hành đó: ${odds}.
        Loài hiếm chỉ có từ trứng. Trứng đang ấp giữ một ô nuôi.</p>
      ${cards.length ? `<div class="egg-list">${cards.join('')}</div>`
        : '<p class="muted small">Chưa có quả trứng nào. <button class="btn small" data-go="shop" data-filter="egg">Mua trứng</button></p>'}
    </section>`;
}

function renderAdopt(root) {
  const { rules } = state.catalog;
  const all = state.catalog.species.filter((s) => s.adoptable);
  const filter = state.adoptElement ?? 'all';
  const species = all.filter((s) => filter === 'all' || s.element === filter);
  const first = state.me.pets.length === 0;
  if (!species.some((s) => s.id === state.adoptSpecies)) state.adoptSpecies = species[0]?.id ?? null;

  if (!species.length) {
    root.innerHTML = `
      <section class="card empty">
        <b>🥚</b>
        <h2>Công viên chưa có loài thú nào</h2>
        <p class="muted">Cài một bé bằng <code>npx petdex@latest install boba</code> rồi chạy <code>npm run import-pets</code>.</p>
      </section>`;
    return;
  }

  root.innerHTML = `
    <section class="card adopt">
      <div class="view-head">
        <div>
          <h2>${first ? 'Chào mừng tới Pet Farm!' : 'Nhận nuôi thêm một bé'}</h2>
          <p class="muted">${first ? 'Chọn một bé để bắt đầu. Bé đầu tiên miễn phí 💝' : `Phí nhận nuôi ${rules.adoptCost} 🪙 · mỗi người tối đa ${rules.maxPets} bé`}</p>
        </div>
        ${first ? '' : '<button class="btn" data-act="cancel-adopt">← Quay lại</button>'}
      </div>
      ${first ? '' : eggPanel()}
      ${state.me.slots.free > 0 ? '' : `<p class="life-warn">Đã hết ô nuôi (tối đa ${rules.maxPets}, tính cả trứng đang ấp${state.me.slots.locked ? ' và ô tưởng niệm' : ''}).
        ${state.me.slots.locked ? `<button class="btn small" data-act="reopen">🕯️ Mở lại ô tưởng niệm · ${fmt(state.me.slots.reopenCost)} 🪙</button>` : ''}</p>`}
      <div class="filters adopt-elements">
        ${[['all', '🐾 Tất cả'], ...Object.entries(ELEMENTS).map(([k, e]) => [k, `${e.icon} ${e.name}`])].map(([k, label]) => `
          <button class="btn small ${filter === k ? 'current' : ''}" data-adopt-el="${k}">${label}</button>`).join('')}
      </div>
      <p class="muted small">Mỗi hành lớn lên một kiểu: ${filter === 'all' ? 'chọn một hành để xem đặc điểm.' : esc(`${ELEMENTS[filter].temper}. ${ELEMENTS[filter].perk}.`)}
        ${first ? 'Loài hiếm chỉ nở từ trứng ngũ hành, mua ở Siêu thị khi bé lên cấp 3.' : 'Loài hiếm chỉ nở từ trứng ngũ hành ở trên.'}</p>
      <div class="species-grid">
        ${species.map((s) => `
          <button class="species-card ${s.id === state.adoptSpecies ? 'selected' : ''}" data-species="${esc(s.id)}" style="--el:${ELEMENTS[s.element].color}">
            <div class="slot"></div>
            <h3>${esc(s.name)}</h3>
            <p><span class="el-chip">${ELEMENTS[s.element].icon} ${ELEMENTS[s.element].name}</span>${s.mascot ? ' <span class="el-chip guest">🧋 Linh vật</span>' : s.guest ? ' <span class="el-chip guest">Khách mời Petdex</span>' : ''}</p>
            <p>${esc(s.description)}</p>
          </button>`).join('')}
      </div>
      <form class="adopt-form" id="adopt-form">
        <input name="name" maxlength="16" required placeholder="Đặt tên cho bé, ví dụ: ${esc(speciesOf(state.adoptSpecies).name)}" />
        <button class="btn primary">${first ? 'Nhận nuôi 🏡' : `Nhận nuôi · ${rules.adoptCost} 🪙`}</button>
      </form>
    </section>`;

  const figures = species.map((s, i) => {
    // Nhận nuôi là nhận một bé sơ sinh, nên vẽ dáng sơ sinh.
    const figure = createPetFigure(s, s.rig ? 0.8 : 0.62, {}, { stage: 'baby', ageScale: 1 });
    root.querySelectorAll('.species-card .slot')[i].append(figure.el);
    return figure;
  });
  teardown = () => figures.forEach((f) => f.destroy());
}

// ---------------------------------------------------------------- Cửa hàng

/** Tỷ lệ hộp phụ kiện ở Siêu thị ra 1 dòng (Xanh lam) hay 2 dòng (Xanh lục), ví dụ "1 dòng 68% · 2 dòng 32%". */
function tierOdds() {
  const odds = state.catalog.gear?.odds ?? {};
  const total = SHOP_TIERS.reduce((s, t) => s + (odds[t] ?? 0), 0) || 1;
  return SHOP_TIERS.map((t) => `${TIERS[t].lines} dòng ${Math.round(((odds[t] ?? 0) / total) * 1000) / 10}%`).join(' · ');
}

function renderShop(root) {
  const filter = state.shopFilter;
  const coins = state.me.user.coins;
  const level = bestLevel();
  const list = Object.values(items())
    .filter((i) => filter === 'all' || i.type === filter)
    // Đồ uống quầy trà sữa chỉ bán ở quầy của người chơi.
    .filter((i) => !i.teaShop)
    // Hàng gia tộc hạng Ngon / Tuyệt hảo chỉ hiện khi Siêu thị còn hàng.
    .filter((i) => !i.clanMade || !i.quality || (state.me.essentials?.[i.type]?.stock[i.quality] ?? 0) > 0)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.price - b.price);

  const ess = state.me.essentials;
  const catOf = (item) => (ess && ess[item.type]?.stage ? ess[item.type] : null);
  const clanStock = (item) => catOf(item)?.stock[item.quality ?? 0] ?? 0;
  // Hàng gia tộc giới hạn theo kho Siêu thị; đồ NPC theo hạn mức hôm nay của nhóm (null = tài khoản mới, không giới hạn).
  const essCan = (item, n) => {
    const c = catOf(item);
    if (!c) return true;
    if (item.clanMade) return clanStock(item) >= n;
    return c.npcLeft == null || c.npcLeft >= n;
  };
  const buyArea = (item) => {
    const owned = qtyOf(item.id);
    if (item.minLevel && level < item.minLevel) return `<span class="badge">🔒 Cần Lv ${item.minLevel}</span>`;
    if (item.type === 'accessory') {
      return `<div class="row"><button class="btn small primary" data-buy="${item.id}" data-qty="1" ${coins < priceOf(item) ? 'disabled' : ''}>🎁 Mua hộp</button></div>`;
    }
    if (!isConsumable(item) && owned) return '<span class="badge star">✓ Đã có</span>';
    const can = (n) => coins >= priceOf(item) * n && essCan(item, n);
    const bulk = isConsumable(item)
      ? `<button class="btn small" data-buy="${item.id}" data-qty="5" ${can(5) ? '' : 'disabled'}>×5</button>`
      : '';
    return `<div class="row">${bulk}<button class="btn small primary" data-buy="${item.id}" data-qty="1" ${can(1) ? '' : 'disabled'}>Mua</button></div>`;
  };

  const index = state.me.economy.priceIndex;
  const indexNote = Math.abs(index - 1) > 0.001
    ? ` Giá đang ${index > 1 ? 'cao' : 'thấp'} hơn gốc ${Math.abs(Math.round((index - 1) * 100))}% theo chỉ số giá của Ngân hàng Trung ương.`
    : '';
  const essLine = (cat) => {
    const c = ess[cat];
    const meta = ESSENTIALS.cats[cat];
    const npc = ess.newbie
      ? 'Tài khoản mới: đồ NPC chưa giới hạn, đủ XP, giá gốc'
      : `NPC còn ${c.npcLeft} món hôm nay${c.stage.key === 'pioneer' ? ' (Khai hoang: hạn mức nới gấp đôi)' : ''} · XP ${Math.round(c.npcXpFactor * 100)}% · giá ×${c.npcPriceFactor.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const stock = ESSENTIALS.qualities.map((q, i) => `${q.name} ${fmt(c.stock[i])}`).join(' · ');
    return `
      <div class="essentials-line">
        <strong>${c.stage.icon} ${meta.label} ${Math.round(c.d * 100)}% · ${esc(c.stage.name)}</strong>
        <span class="muted small">${npc}. ${meta.icon} Kho hàng gia tộc (${meta.unit}): ${stock}.</span>
      </div>`;
  };
  const essBanner = ess ? `
    <div class="card essentials-banner">
      ${ESSENTIAL_CATS.map(essLine).join('')}
      <span class="muted small">Hàng gia tộc do các gia tộc Chế biến thực phẩm / Dược phẩm bán cho Siêu thị, luôn đủ XP. Hạng Ngon ×1,2, Tuyệt hảo ×1,5 hiệu ứng và XP.</span>
    </div>` : '';
  const shopCard = (item) => {
    const owned = qtyOf(item.id);
    const locked = item.minLevel && level < item.minLevel;
    return `
      <article class="card item-card ${locked ? 'locked' : ''}">
        ${owned && isConsumable(item) ? `<span class="badge owned">Có ${owned}</span>` : ''}
        <div class="icon">${itemIcon(item)}</div>
        <span class="type-tag">${TYPE_LABELS[item.type]}${item.slot ? ` · ${SLOTS[item.slot].name}` : ''}${item.element ? ` · ${ELEMENTS[item.element].icon} ${ELEMENTS[item.element].name}` : ''}</span>
        <h3>${esc(item.name)}</h3>
        <p title="${esc(item.desc ?? '')}">${esc(item.desc ?? '')}</p>
        <p class="effects">${esc(effectText(item))}</p>
        ${item.type === 'accessory' ? poolLine(affixPool(item.slot, item.element), 'Mở hộp ra 1–2 dòng trong số') : ''}
        ${item.type === 'accessory' && myGear().some((g) => g.itemId === item.id) ? `<p class="muted small">Đang có ${myGear().filter((g) => g.itemId === item.id).length} món</p>` : ''}
        ${item.clanMade ? `<p class="muted small">Kho Siêu thị: ${fmt(clanStock(item))} ${ESSENTIALS.cats[item.type].unit}</p>` : ''}
        <div class="foot"><span class="price">${priceOf(item)} 🪙</span>${buyArea(item)}</div>
      </article>`;
  };
  root.innerHTML = `
    ${viewHead('🏪 Siêu thị', `Đồ ăn và đồ chăm sóc dùng là hết. Đồ chơi mua một lần, dùng mãi. Phụ kiện mỗi lần mua là một hộp kín có 1–2 dòng +% ngẫu nhiên (${tierOdds()}), mở trong Túi đồ mới biết là dòng nào; May mắn của bé chính giúp ra 2 dòng.${indexNote}`)}
    ${essBanner}
    <div class="filters">
      ${['all', ...TYPE_ORDER].map((t) => `
        <button class="btn small ${t === filter ? 'current' : ''}" data-filter="${t}">${t === 'all' ? 'Tất cả' : TYPE_LABELS[t]}</button>`).join('')}
    </div>
    ${shopSections(list, shopCard)}`;
}

// ---------------------------------------------------------------- Túi đồ

/** Các loại chỉ số một món có thể ra (biết trước khi mua), không lộ cấp hay %. */
function poolLine(pool, lead) {
  const chips = (pool ?? []).map((a) => `<span class="gear-bonus" title="${esc(AFFIXES[a].desc)}">${AFFIXES[a].icon} ${esc(AFFIXES[a].name)}</span>`).join('');
  return `<p class="gear-pool muted small">${lead}: ${chips}<br>Cấp và % chỉ biết khi mở hộp.</p>`;
}

/**
 * Nhóm phụ kiện theo khe đeo (mỗi bé đeo một món mỗi khe), dùng chung cho Siêu thị và tủ trang phục:
 * tiêu đề có số món, hàng nút nhảy nhanh tới từng nhóm.
 */
const GEAR_GROUPS = {
  head: { title: 'Đội đầu', icon: '🎩', hint: 'mũ, nơ, vương miện, hào quang' },
  face: { title: 'Đeo mặt', icon: '👓', hint: 'kính, mặt nạ' },
  neck: { title: 'Đeo cổ', icon: '🧣', hint: 'khăn, vòng, cà vạt, huy chương' },
  back: { title: 'Cánh & áo choàng', icon: '🦋', hint: 'cánh, áo choàng, ba lô' },
  charm: { title: 'Cầm tay & bùa', icon: '🏮', hint: 'đèn lồng, quạt, sáo, bùa may' },
};

/** `list` chia theo khe (`slotOf`), mỗi nhóm một tiêu đề và một lưới thẻ (`card`); `scope` để đặt id cho nút nhảy. */
function gearGroups(list, scope, slotOf, card) {
  const groups = Object.keys(SLOTS).map((slot) => [slot, list.filter((x) => slotOf(x) === slot)]).filter(([, xs]) => xs.length);
  if (!groups.length) return '';
  const jump = groups.length > 1
    ? `<div class="gear-jump">${groups.map(([slot, xs]) => `<button class="chip" data-gear-jump="${scope}-${slot}">${GEAR_GROUPS[slot].icon} ${GEAR_GROUPS[slot].title} <small>${xs.length}</small></button>`).join('')}</div>`
    : '';
  return `${jump}${groups.map(([slot, xs]) => `
    <section class="gear-group" id="gear-${scope}-${slot}">
      <h4 class="gear-group-title">${GEAR_GROUPS[slot].icon} ${GEAR_GROUPS[slot].title} <small class="muted">${xs.length} món · ${GEAR_GROUPS[slot].hint}</small></h4>
      <div class="item-grid">${xs.map(card).join('')}</div>
    </section>`).join('')}`;
}

/** Danh sách Siêu thị: hàng thường một lưới, phụ kiện chia nhóm theo khe (trong nhóm xếp theo cấp mở rồi giá). */
function shopSections(list, card) {
  const plain = list.filter((i) => i.type !== 'accessory');
  const gear = list.filter((i) => i.type === 'accessory').sort((a, b) => (a.minLevel ?? 1) - (b.minLevel ?? 1) || a.price - b.price);
  return `${plain.length ? `<div class="item-grid">${plain.map(card).join('')}</div>` : ''}
    ${gear.length ? `${plain.length ? '<h3 class="section-title">🎀 Phụ kiện</h3>' : ''}${gearGroups(gear, 'shop', (i) => i.slot, card)}` : ''}`;
}

/** Tủ trang phục trong Túi đồ: mỗi món một thẻ có cấp, dòng chỉ số và nút đeo/tháo cho bé đang chọn. */
function gearShelf(pet) {
  const list = [...myGear()].sort((a, b) => Number(b.sealed) - Number(a.sealed) || TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier) || b.id - a.id);
  if (!list.length) return '';
  const quickSellButton = (g) => (g.quickSell
    ? `<button class="btn small" data-quick-sell="${g.id}" title="Bán ngay cho Siêu thị: thu ${QUICK_SELL.min * 100}–${QUICK_SELL.max * 100}% giá trị tùy dòng chỉ số. Muốn giá cao hơn thì bày ở Chợ Phiên hoặc đấu giá.">💰 Bán nhanh ${fmt(g.quickSell)} 🪙</button>`
    : '');
  const button = (g) => {
    if (g.sealed) return `<button class="btn small gold" data-open-gear="${g.id}">🎁 Mở hộp</button>`;
    if (!pet) return '';
    if (pet.gear?.[g.slot]?.gearId === g.id) return `<button class="btn small" data-unequip-slot="${g.slot}">Tháo ra</button>`;
    return `<button class="btn small mint" data-equip-gear="${g.id}">Đeo cho ${esc(pet.name)}</button>`;
  };
  const gearCard = (g) => {
    const item = items()[g.itemId];
    if (g.sealed) {
      return `
      <article class="card item-card gear-card sealed">
        <div class="icon">🎁</div>
        <span class="type-tag">${SLOTS[g.slot].name} · ${ELEMENTS[item.element].icon} ${ELEMENTS[item.element].name}</span>
        <h3>${esc(item.name)} <span class="tier-chip">Hộp chưa mở</span></h3>
        ${poolLine(g.pool, 'Bên trong có 1–2 dòng trong số')}
        <div class="foot">${button(g)}${quickSellButton(g)}</div>
      </article>`;
    }
    return `
      <article class="card item-card gear-card tier-${g.tier}">
        ${g.wornBy ? `<span class="badge star owned" title="Đang đeo · ${esc(petName(g.wornBy))}">Đang đeo · ${esc(petName(g.wornBy))}</span>` : ''}
        <div class="icon">${itemIcon(item)}</div>
        <span class="type-tag">${SLOTS[g.slot].name} · ${ELEMENTS[item.element].icon} ${ELEMENTS[item.element].name}</span>
        <h3>${esc(item.name)} ${tierChip(g.tier)}</h3>
        ${durabilityChip(g)}
        <ul class="gear-lines ${g.usable === false ? 'off' : ''}">${AFFIX_ORDER.filter((a) => g.affixes[a]).map((a) => `<li title="${esc(AFFIXES[a].desc)}">${affixText(a, g.affixes[a])}</li>`).join('')}</ul>
        <div class="foot">${button(g)}${forgeButtons(g, state.forge)}${quickSellButton(g)}</div>
      </article>`;
  };
  return `
    <h3 class="section-title">🎀 Trang phục <small class="muted">${list.length} món${pet ? ` · ${esc(pet.name)} đeo ${wornIds(pet).length}/${pet.wearLimit ?? WEAR_RULES.base} món` : ''}</small></h3>
    ${gearGroups(list, 'bag', (g) => g.slot, gearCard)}
    ${Object.values(items()).some((i) => qtyOf(i.id) > 0 && i.type !== 'accessory') ? '<h3 class="section-title">🧺 Đồ dùng</h3>' : ''}`;
}

function renderBag(root) {
  const pet = state.me.pets.length ? currentPet() : null;
  // Tỉ lệ sửa / nâng cấp ghi trên nút: tải một lần (quản trị viên chỉnh được), có rồi thì vẽ lại cho hiện tỉ lệ.
  if (!state.forge && myGear().some((g) => !g.sealed)) {
    api('/forge').then((f) => {
      state.forge = f;
      if (state.view === 'bag' && root.isConnected) render();
    }).catch(() => {});
  }
  const owned = Object.values(items())
    .filter((i) => qtyOf(i.id) > 0 && i.type !== 'accessory')
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.price - b.price);

  const useButton = (item) => {
    if (!pet) return '';
    const name = esc(pet.name);
    if (isConsumable(item)) return `<button class="btn small primary" data-use="${item.id}">Cho ${name} dùng</button>`;
    if (item.type === 'toy') return `<button class="btn small pink" data-toy="${item.id}">Chơi cùng ${name}</button>`;
    if (item.type === 'egg') return `<button class="btn small gold" data-incubate="${item.id}">Ấp trứng</button>`;
    return isWorn(pet, item.id)
      ? `<button class="btn small" data-equip="" data-slot="${item.slot}">Tháo ra</button>`
      : `<button class="btn small mint" data-equip="${item.id}">Đeo cho ${name}</button>`;
  };

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>🎒 Túi đồ</h2>
        <p class="muted">${pet ? `Đang dùng đồ cho <b>${esc(pet.name)}</b>. Đổi bé ở bên dưới.` : 'Nhận nuôi một bé để dùng đồ nhé.'}</p>
      </div>
      <button class="btn" data-go="shop">🛍️ Mua thêm</button>
    </div>
    ${pet ? petSwitcher(pet, { withAdopt: false }) : ''}
    ${gearShelf(pet)}
    ${owned.length || myGear().length ? `
      <div class="item-grid">
        ${owned.map((item) => `
          <article class="card item-card">
            ${isConsumable(item) ? `<span class="badge owned">×${qtyOf(item.id)}</span>` : ''}
            ${pet && isWorn(pet, item.id) ? '<span class="badge star owned">Đang đeo</span>' : ''}
            <div class="icon">${itemIcon(item)}</div>
            <span class="type-tag">${TYPE_LABELS[item.type]}${item.slot ? ` · ${SLOTS[item.slot].name}` : ''}</span>
            <h3>${esc(item.name)}</h3>
            <p class="effects">${esc(effectText(item))}</p>
            <div class="foot">${useButton(item)}</div>
          </article>`).join('')}
      </div>`
    : `
      <section class="card empty">
        <b>🎒</b>
        <h2>Túi đồ trống trơn</h2>
        <p class="muted">Ghé cửa hàng mua đồ ăn, đồ chơi và phụ kiện cho bé.</p>
        <button class="btn primary" data-go="shop">Tới cửa hàng</button>
      </section>`}`;
}

// ---------------------------------------------------------------- Xếp hạng

async function renderRanks(root) {
  const seq = renderSeq;
  const byWorth = state.ranksBy === 'networth';
  const stars = state.ranksBy === 'stars';
  const subtitle = stars ? 'Nơi các bé đã về với sao trời được nhớ mãi.' : byWorth ? '"Forbes Phố Trân Châu": 20 người có tài sản ròng lớn nhất.' : '20 bé cấp cao nhất cả phố.';
  root.innerHTML = `
    ${viewHead(stars ? '🌠 Đồi Sao' : '🏆 Bảng vàng', subtitle)}
    <div class="filters">
      <button class="btn small ${byWorth || stars ? '' : 'current'}" data-ranks="level">⭐ Cấp độ</button>
      <button class="btn small ${byWorth ? 'current' : ''}" data-ranks="networth">💎 Tài sản ròng</button>
      <button class="btn small ${stars ? 'current' : ''}" data-ranks="stars">🌠 Đồi Sao</button>
    </div>
    <section class="card ranks" id="rank-list"><div class="empty muted">Đang tải…</div></section>`;
  let rows;
  try {
    rows = await api(stars ? '/memorials?scope=all' : byWorth ? '/leaderboard?by=networth' : '/leaderboard');
  } catch (err) {
    if (seq === renderSeq) $('#rank-list').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    return;
  }
  if (seq !== renderSeq) return; // người chơi đã chuyển màn khác

  const medals = ['🥇', '🥈', '🥉'];
  const list = $('#rank-list');
  if (stars) {
    list.innerHTML = rows.length
      ? rows.map((m) => `
        <div class="rank-row memorial ${m.owner === state.me.user.username ? 'me' : ''}">
          <span class="rank-no">🕯️</span>
          <div class="rank-avatar"></div>
          <div><h3>${esc(m.name)}</h3><p>${esc(speciesOf(m.species).name)} của ${esc(m.owner)} · sống ${m.weeks} tuần · về với sao trời ${new Date(m.diedAt).toLocaleDateString('vi-VN')}</p></div>
          <span class="badge level rank-level">Lv ${m.level}</span>
        </div>`).join('')
      : '<div class="empty muted">Đồi Sao còn trống. Mong các bé sống thật lâu.</div>';
    const avatars = list.querySelectorAll('.rank-avatar');
    const figures = rows.map((m, i) => {
      const figure = createPetFigure(speciesOf(m.species), 0.3, m.wear, { stage: 'elder', ageScale: 1, level: m.level });
      avatars[i].append(figure.el);
      return figure;
    });
    teardown = () => figures.forEach((f) => f.destroy());
    return;
  }
  if (byWorth) {
    list.innerHTML = rows.map((r, i) => `
      <div class="rank-row worth ${r.username === state.me.user.username ? 'me' : ''}">
        <span class="rank-no">${medals[i] ?? i + 1}</span>
        <div><h3>${esc(r.username)}</h3></div>
        <span class="badge level rank-level">💎 ${fmt(r.total)} 🪙</span>
      </div>`).join('') || '<div class="empty muted">Chưa có ai.</div>';
    return;
  }
  list.innerHTML = rows.length
    ? rows.map((r, i) => `
        <div class="rank-row ${r.owner === state.me.user.username ? 'me' : ''}">
          <span class="rank-no">${medals[i] ?? i + 1}</span>
          <div class="rank-avatar"></div>
          <div><h3>${esc(r.name)}</h3><p>của ${esc(r.owner)} · ${r.weeks} tuần tuổi</p></div>
          <span class="badge level rank-level">Lv ${r.level}</span>
        </div>`).join('')
    : '<div class="empty muted">Chưa có bé nào. Hãy là người đầu tiên!</div>';

  const avatars = list.querySelectorAll('.rank-avatar');
  const figures = rows.map((r, i) => {
    const figure = createPetFigure(speciesOf(r.species), 0.3, r.wear, { stage: stageOfWeeks(r.weeks), ageScale: 1, level: r.level });
    avatars[i].append(figure.el);
    return figure;
  });
  teardown = () => figures.forEach((f) => f.destroy());
}

// ---------------------------------------------------------------- Công viên

function renderPark(root) {
  if (!state.me.pets.length) {
    root.innerHTML = `
      <section class="card empty">
        <b>🌳</b>
        <h2>Công viên đang chờ bạn</h2>
        <p class="muted">Nhận nuôi một bé trước rồi dắt bé ra đây chơi nhé.</p>
        <button class="btn primary" data-go="home">Nhận nuôi ngay</button>
      </section>`;
    return;
  }
  teardown = mountPark(root, {
    token: session.token,
    catalog: state.catalog,
    me: () => state.me,
    onMeChanged: async ({ notice, levelUps, petName } = {}) => {
      await refreshMe();
      if (notice) toast(notice);
      celebrate(levelUps, petName);
    },
  });
}

// ---------------------------------------------------------------- sự kiện chung

$('#tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('button[data-view]');
  if (tab) go(tab.dataset.view);
});

$('#daily-btn').addEventListener('click', () =>
  act('/daily', {}, {
    fx: (stage) => {
      stage.react('jump');
      burst(stage.room, stage.room.clientWidth / 2, 20, { icon: 'coin', count: 12, fall: true, rise: 260, spread: 360, life: 1400, stagger: 60 });
    },
  }));

$('#coin-count').addEventListener('click', () => go('wallet'));
$('#mail-btn').addEventListener('click', () => go('mail'));

$('#logout-btn').addEventListener('click', () => {
  if (!embedded) {
    if (confirm('Đăng xuất khỏi Pet Farm?')) logout();
    return;
  }
  openAccountMenu();
});
if (embedded) $('#logout-btn').title = 'Tài khoản: nhập mã quà, đổi mật khẩu, đăng xuất';

/**
 * Menu tên người chơi (bản nhúng trong WorkHub / play.petfarm.online): nhập mã quà, đặt hoặc đổi mật khẩu,
 * đăng xuất. Mật khẩu đổi qua API tài khoản của WorkHub (cùng tên miền với khung game).
 */
function openAccountMenu() {
  const u = state.me.user;
  const member = isMemberSession();
  openModal({
    title: `👤 ${u.username}`,
    html: `<div class="account-menu">
      <section>
        <h4>🎁 Nhập mã quà</h4>
        <form class="row" data-form="gift">
          <input name="code" placeholder="Ví dụ: ABCD-EFGH" maxlength="32" autocomplete="off" required aria-label="Mã quà" />
          <button class="btn primary" type="submit">Nhận quà</button>
        </form>
        <p class="msg" data-msg="gift" role="status"></p>
        <div class="gift-choice" data-gift-choice hidden></div>
      </section>
      <section>
        <h4>🔑 ${u.hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}</h4>
        <p class="note">${u.hasPassword
          ? `Đăng nhập bằng tên <b>${esc(u.username)}</b>. Đổi xong, các máy khác đang đăng nhập sẽ bị đăng xuất.`
          : `Đặt mật khẩu để lần sau vào thẳng trang chơi bằng tên <b>${esc(u.username)}</b>.`}</p>
        <form data-form="password" class="account-fields">
          ${u.hasPassword ? '<input name="current" type="password" placeholder="Mật khẩu hiện tại" autocomplete="current-password" required aria-label="Mật khẩu hiện tại" />' : ''}
          <input name="password" type="password" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" minlength="6" maxlength="72" autocomplete="new-password" required aria-label="Mật khẩu mới" />
          <input name="confirm" type="password" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password" required aria-label="Nhập lại mật khẩu mới" />
          <button class="btn" type="submit">Lưu mật khẩu</button>
        </form>
        <p class="msg" data-msg="password" role="status"></p>
      </section>
      <section>
        ${member
          ? '<p class="note">Bạn đang chơi bằng tài khoản WorkHub: đăng xuất ở WorkHub.</p>'
          : '<button class="btn" type="button" data-account="logout">🚪 Đăng xuất</button>'}
      </section>
    </div>`,
  });
  const box = document.querySelector('.account-menu');
  const say = (key, text, ok) => {
    const el = box.querySelector(`[data-msg="${key}"]`);
    el.textContent = text;
    el.className = `msg ${ok ? 'ok' : 'error'}`;
  };
  const giftForm = box.querySelector('[data-form="gift"]');
  const choiceBox = box.querySelector('[data-gift-choice]');
  /** Nhập mã (và món đã chọn, với mã cho tự chọn quà). Mã có lượt chọn trả về các món để chọn trước. */
  const redeem = async (code, choice = null) => {
    const buttons = [giftForm.querySelector('button'), ...choiceBox.querySelectorAll('button')];
    for (const b of buttons) b.disabled = true;
    try {
      const { result, ...me } = await api('/gifts/redeem', choice === null ? { code } : { code, choice });
      state.me = me;
      if (result?.needsChoice) {
        say('gift', result.message, true);
        choiceBox.innerHTML = `
          ${result.always ? `<p class="note">Luôn nhận: ${esc(result.always)}. Chọn thêm 1 món:</p>` : '<p class="note">Chọn 1 món:</p>'}
          <div class="gift-options">${result.options.map((o) => `<button class="btn" type="button" data-gift-option="${o.index}">${esc(o.text)}</button>`).join('')}</div>`;
        choiceBox.hidden = false;
        choiceBox.dataset.code = code;
        return;
      }
      choiceBox.hidden = true;
      choiceBox.innerHTML = '';
      say('gift', result?.message ?? 'Đã nhận quà!', true);
      toast(result?.message ?? 'Đã nhận quà!');
      giftForm.elements.code.value = '';
      renderWallet();
    } catch (err) {
      say('gift', err.message, false);
    } finally {
      for (const b of buttons) b.disabled = false;
    }
  };
  giftForm.addEventListener('submit', (e) => {
    e.preventDefault();
    choiceBox.hidden = true;
    redeem(giftForm.elements.code.value.trim());
  });
  choiceBox.addEventListener('click', (e) => {
    const option = e.target.closest('[data-gift-option]');
    if (option) redeem(choiceBox.dataset.code, Number(option.dataset.giftOption));
  });
  box.querySelector('[data-form="password"]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget.elements;
    if (f.password.value.length < 6) return say('password', 'Mật khẩu cần ít nhất 6 ký tự.', false);
    if (f.password.value !== f.confirm.value) return say('password', 'Hai lần nhập mật khẩu chưa khớp.', false);
    const btn = e.currentTarget.querySelector('button');
    btn.disabled = true;
    try {
      const res = await fetch(`${location.origin}/api/ta-tua/account`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'credentials', token: session.token, username: u.username, password: f.password.value, currentPassword: f.current?.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Không lưu được, thử lại nhé.');
      state.me.user.hasPassword = true;
      for (const input of [f.current, f.password, f.confirm]) if (input) input.value = '';
      say('password', `Đã lưu. Lần sau đăng nhập bằng tên ${u.username} và mật khẩu mới.`, true);
    } catch (err) {
      say('password', err.message, false);
    } finally {
      btn.disabled = false;
    }
  });
  box.querySelector('[data-account="logout"]')?.addEventListener('click', () => {
    if (!confirm('Đăng xuất khỏi Pet Town?')) return;
    closeModal();
    // Trang chơi bên ngoài (play.petfarm.online) lo đăng xuất: hủy phiên ở máy chủ và quên token trên trình duyệt.
    if (window.parent !== window) window.parent.postMessage({ type: 'petdex:logout' }, location.origin);
    else logout();
  });
}

$('#view').addEventListener('click', (e) => {
  if (e.target.closest('#figure-slot') && homeStage) {
    const head = homeStage.at(0.85);
    homeStage.react('wave');
    burst(homeStage.room, head.x, head.y, { icon: 'heart', count: 2, spread: 60, rise: 60 });
    return;
  }
  const el = e.target.closest('button');
  if (!el || el.disabled) return;
  const d = el.dataset;
  const pet = state.me.pets.length ? currentPet() : null;

  if (d.act) return ACTIONS[d.act]?.();
  if (d.pet) {
    state.petId = Number(d.pet);
    return render();
  }
  if (d.ranksGo) state.ranksBy = d.ranksGo;
  if (d.gearJump) return document.getElementById(`gear-${d.gearJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (d.go) return go(d.go, d.filter);
  if (d.filter) {
    state.shopFilter = d.filter;
    return render();
  }
  if (d.incubate) return act('/eggs/incubate', { itemId: d.incubate });
  if (d.adoptEl) {
    state.adoptElement = d.adoptEl;
    return render();
  }
  if (d.ranks) {
    state.ranksBy = d.ranks;
    return render();
  }
  if (d.buy) return act('/shop/buy', { itemId: d.buy, qty: Number(d.qty) });
  if (d.openGear) return act(`/gear/${d.openGear}/open`, {}, { fx: sparkleFx('jump', 'sparkle') });
  if (d.forgeRepair || d.forgeUpgrade) {
    const kind = d.forgeRepair ? 'repair' : 'upgrade';
    const id = Number(d.forgeRepair ?? d.forgeUpgrade);
    const g = myGear().find((x) => x.id === id);
    if (!g) return;
    return api('/forge').then((forge) => {
      state.forge = forge;
      if (!confirm(forgeConfirmText(kind, g, items()[g.itemId], forge))) return;
      return act(`/gear/${id}/${kind}`, {}, { fx: sparkleFx('jump', 'sparkle') });
    }).catch((err) => toast(err.message, 'error'));
  }
  if (d.quickSell) {
    const g = myGear().find((x) => x.id === Number(d.quickSell));
    if (!g) return;
    const name = items()[g.itemId]?.name ?? 'món này';
    const worn = g.wornBy ? ` ${petName(g.wornBy)} đang đeo món này, bán sẽ tháo ra.` : '';
    if (!confirm(`Bán nhanh ${name}${g.sealed ? ' (hộp chưa mở)' : ` (${TIERS[g.tier].name})`} cho Siêu thị lấy ${fmt(g.quickSell)} 🪙? Món sẽ mất hẳn.${worn}`)) return;
    return act(`/gear/${d.quickSell}/quick-sell`);
  }
  if (d.species) {
    state.adoptSpecies = d.species;
    for (const card of document.querySelectorAll('.species-card')) card.classList.toggle('selected', card === el);
    return;
  }
  if (!pet) return;
  if (d.use) return act(`/pets/${pet.id}/use`, { itemId: d.use });
  if (d.toy) return act(`/pets/${pet.id}/play`, { toyId: d.toy });
  if (d.equipGear) return act(`/pets/${pet.id}/equip`, { gearId: Number(d.equipGear) });
  if (d.unequipSlot) return act(`/pets/${pet.id}/equip`, { slot: d.unequipSlot });
});

$('#view').addEventListener('submit', (e) => {
  const egg = e.target.closest('.egg-hatch');
  if (egg) {
    e.preventDefault();
    act(`/eggs/${egg.dataset.egg}/hatch`, { name: new FormData(egg).get('name') }, {
      fx: sparkleFx('jump', 'sparkle'),
      onDone: (me) => {
        state.adopting = false;
        state.petId = me.pets.at(-1)?.id ?? null;
      },
    });
    return;
  }
  if (e.target.id !== 'adopt-form') return;
  e.preventDefault();
  const name = new FormData(e.target).get('name');
  act('/pets', { name, species: state.adoptSpecies }, {
    fx: sparkleFx('wave', 'heart'),
    onDone: (me) => {
      state.adopting = false;
      state.petId = me.pets.at(-1)?.id ?? null;
    },
  });
});

boot();
