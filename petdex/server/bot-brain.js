// Bộ não của cư dân tự động (bot): từ trạng thái vừa đọc (GET /me) liệt kê các việc đang làm được và có ích, chấm điểm
// (nhu cầu của bé trước, rồi tới tính cách: buôn bán, giao du, đánh trận, siêng năng, sản xuất, chăm bé) và chọn một việc
// theo trọng số. Mỗi lượt chỉ một việc ghi dữ liệu (POST thành công), đọc thêm tối đa 2 lần (GET) để quyết định cụ thể.
// Bot chỉ dùng đúng các route của người chơi; mọi luật (hạn mức NPC, biên giá, phí, cấp mở khu) do route kiểm tra.
import { dayKey } from './clock.js';
import { stageAt } from '../../public/ta-tua/game/js/shared/pets.js';
import { PIECES } from '../../public/ta-tua/game/js/shared/clan.js';

export const BRAIN = {
  /** Số lần đọc (GET) tối đa mỗi lượt, tính cả /me. */
  maxReads: 3,
  /** Số lần thử ghi (POST) tối đa mỗi lượt; chỉ một lần được thành công. */
  maxTries: 2,
  /** Ngưỡng nhu cầu của bé (cộng thêm theo tính cách chăm bé). */
  hungry: 50,
  dirty: 35,
  /** Dưới các mức này là "việc cần làm ngay" (chọn trước mọi việc khác): bé đói lả, bẩn, buồn thiu. */
  starving: 25,
  filthy: 20,
  gloomy: 15,
  /** Sắp hết phiên chơi (phút): cho bé ăn no trước khi thoát game để bé không đói qua đêm. */
  wrapUpMinutes: 15,
  /** Mỗi người chơi trung bình góp quỹ gia tộc tối đa chừng này xu một lần. */
  donateMax: 300,
  /** Dưới mức giao du này bot chơi một mình, không vào gia tộc (khoảng 15 tới 20% cư dân). */
  loner: 0.18,
  /** Lệnh Sàn nhỏ: số lô tối đa mỗi lệnh mua bán thường (người buôn nhiều hơn chút). */
  tradeLots: [1, 5],
  /** Phần hạn mức chung còn lại của thị trấn dưới mức này thì không bán thêm cho NPC (tránh đè giá). */
  townFloor: 0.25,
};

const NAMES = ['Mây', 'Gió', 'Sen', 'Trúc', 'Mai', 'Lúa', 'Sóng', 'Đá', 'Rồng', 'Phượng', 'Cốm', 'Bơ', 'Na', 'Mít'];
const pickOne = (list, rand) => list[Math.floor(rand() * list.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (x) => Math.round(x * 10) / 10;

/** Số giả ngẫu nhiên từ 0 tới 1 cố định theo người chơi: bù các nét tính cách mới cho bot tạo trước bản này (không ghi lại DB). */
function hash01(n, salt) {
  let x = (Math.imul(Number(n) || 0, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Tính cách đầy đủ: siêng (zeal), giao du, buôn bán, đánh trận, sản xuất (producer), chăm bé (carer). */
export function traitsOf(persona = {}, userId = 0) {
  return {
    zeal: 1, social: 0.5, trader: 0.5, fighter: 0.5, ...persona,
    producer: persona.producer ?? hash01(userId, 1),
    carer: persona.carer ?? hash01(userId, 2),
  };
}

/**
 * Bối cảnh một lượt: trạng thái người chơi, bé chính, cấp mở khu, tiền dự phòng. `call` là botCall của bot;
 * `get`/`post` đếm số lần đọc và ghi để giữ đúng ngân sách mỗi lượt.
 */
export function makeContext({ me, catalog, persona, state, now, rand, call, helpers = {}, userId, sessionEnd = null }) {
  const pet = me.pets.find((p) => p.id === me.user.activePetId) ?? me.pets[0];
  const level = Math.max(0, ...me.pets.map((p) => p.level));
  const idx = me.economy?.priceIndex ?? 1;
  const ctx = {
    me, catalog, state, now, rand, helpers, pet, level, idx,
    day: dayKey(now),
    userId: userId ?? me.user.id,
    persona: traitsOf(persona, userId ?? me.user.id),
    coins: me.user.coins,
    inv: me.inventory ?? {},
    wrapUp: Boolean(sessionEnd && sessionEnd - now < BRAIN.wrapUpMinutes * 60_000),
    reads: 1, // GET /me đã đọc
    tries: 0,
    wrote: false,
  };
  ctx.unlocked = (area) => level >= (catalog.unlocks?.[area] ?? 99);
  ctx.price = (base) => Math.max(1, Math.round(base * idx));
  // Tiền giữ lại cho đồ ăn, phí chăm nuôi và tiền thuê quầy/xưởng mấy ngày tới.
  const rent = (state.biz ? 2 * ctx.price(catalog.business?.locations?.[state.biz.loc ?? 'alley']?.rent ?? 40) : 0)
    + (state.factory ? 2 * ctx.price(catalog.factory?.landRent ?? 50) : 0);
  ctx.reserve = ctx.price(80 + 12 * level) + rent;
  ctx.spare = ctx.coins - ctx.reserve;
  ctx.goal = goalOf(ctx);
  // Tiền tiêu vặt (đồ chơi, học thêm, món sang, đầu cơ): chừa phần lớn khoản đang để dành.
  ctx.fun = ctx.spare - ctx.goal * 0.6;
  ctx.get = async (path) => {
    if (ctx.reads >= BRAIN.maxReads) return null;
    ctx.reads += 1;
    const r = await call('GET', path);
    return r.ok ? r.body : null;
  };
  ctx.post = async (path, body = {}) => {
    if (ctx.wrote || ctx.tries >= BRAIN.maxTries) return null;
    ctx.tries += 1;
    const r = await call('POST', path, body);
    if (!r.ok) return null;
    ctx.wrote = true;
    return r.body ?? {};
  };
  return ctx;
}

/**
 * Khoản đang để dành (xu): món lớn kế tiếp bot muốn khi sắp đủ cấp: giấy phép quầy trà sữa (kèm vốn nhập hàng),
 * lập gia tộc (người rất thích giao du), xây xưởng. 0 nếu không để dành gì.
 */
export function goalOf(ctx) {
  const { persona: p, state, catalog, level } = ctx;
  const near = (area) => level >= (catalog.unlocks?.[area] ?? 99) - 1;
  const goals = [];
  if (!state.biz && (p.producer > 0.45 || p.trader > 0.75) && near('business')) {
    goals.push(ctx.price(catalog.business?.locations?.alley?.license ?? 1500) * 1.2 + 300);
  }
  if (!state.clan && p.social > 0.75 && near('clan') && (ctx.helpers.clanShareOk?.() ?? false)) goals.push(3200);
  if (!state.factory && p.producer > 0.6 && near('factory')) goals.push(ctx.price(3000) + 1500);
  return goals.length ? Math.min(...goals) : 0;
}

// ---------------------------------------------------------------- bé

const isBusy = (pet) => Boolean(pet?.busyUntil);
const maxHoursOf = (pet) => stageAt(pet.age?.weeks ?? 0)?.rules?.maxHours ?? 8;
const today = (rec, day) => (rec?.d === day ? rec : { d: day, n: 0 });

function foodValue(item, pet) {
  const full = Math.min(100 - pet.fullness, item.effect?.fullness ?? 0);
  const joy = Math.min(100 - pet.happiness, item.effect?.happiness ?? 0);
  return full + (item.xp ?? 0) * 2 + joy * 0.3;
}

/** Món ăn tốt nhất đang có trong túi (kể cả đồ uống quầy trà sữa, suất ăn gia tộc). */
export function bestInventoryFood(ctx) {
  const items = ctx.catalog.items ?? {};
  let best = null;
  for (const [id, n] of Object.entries(ctx.inv)) {
    const item = items[id];
    if (!n || !item || item.type !== 'food') continue;
    const v = foodValue(item, ctx.pet);
    if (!best || v > best.v) best = { item, v };
  }
  return best?.item ?? null;
}

/** Đồ ăn Siêu thị bán được cho mình lúc này: giá NPC đã nhân hệ số thiết yếu (trong hạn mức), hàng gia tộc còn kho. */
export function shopFoods(ctx) {
  const ess = ctx.me.essentials?.food;
  const out = [];
  for (const item of Object.values(ctx.catalog.items ?? {})) {
    if (item.type !== 'food' || item.teaShop) continue;
    if (item.minLevel && ctx.level < item.minLevel) continue;
    if (item.clanMade) {
      const qi = item.quality ?? 0;
      const stock = ess?.stock?.[qi] ?? 0;
      const price = ess?.prices?.[qi];
      if (stock >= 2 && price) out.push({ item, price, max: Math.min(3, stock) });
    } else {
      const left = ess?.npcLeft ?? 20;
      if (left < 1) continue;
      out.push({ item, price: Math.max(1, Math.round(ctx.price(item.price) * (ess?.npcPriceFactor ?? 1))), max: Math.min(3, left) });
    }
  }
  return out;
}

/**
 * Chọn món nên mua: giá trị (no, XP, vui) trên giá. Siêu thị giới hạn số suất NPC mỗi ngày nên món no lâu được ưu tiên;
 * người dư dả chịu chi món ngon hơn, người kẹt tiền chọn món rẻ. Trả về { item, price, qty } hoặc null nếu không đủ tiền.
 */
export function chooseFood(ctx, options) {
  const wealth = clamp(ctx.fun / 800, 0, 1);
  const budget = Math.max(0, ctx.spare > 0 ? ctx.spare : ctx.coins);
  let best = null;
  for (const o of options) {
    if (o.price > budget) continue;
    const score = foodValue(o.item, ctx.pet) / o.price ** (0.6 - 0.3 * wealth);
    if (!best || score > best.score) best = { ...o, score };
  }
  if (!best) return null;
  const want = ctx.spare > best.price * 6 ? 3 : ctx.spare > best.price * 3 ? 2 : 1;
  return { item: best.item, price: best.price, qty: Math.max(1, Math.min(want, best.max ?? 3, Math.floor(budget / best.price))) };
}

async function feed(ctx) {
  const pet = ctx.pet;
  const have = bestInventoryFood(ctx);
  if (have) return (await ctx.post(`/pets/${pet.id}/use`, { itemId: have.id })) ? 'feed' : null;
  // Hết đồ ăn: ghé quầy trà sữa của người chơi (đồ uống gấp đôi trà sữa Siêu thị), Siêu thị (còn hạn mức NPC),
  // hoặc vào bếp nấu món nhà làm (rẻ, no lâu) khi Siêu thị hết hạn mức.
  const npcOut = (ctx.me.essentials?.food?.npcLeft ?? 1) < 1;
  const boba = ctx.catalog.items?.boba;
  if (boba && ctx.coins > 30 && ctx.rand() < (npcOut ? 0.8 : 0.3 + ctx.persona.social * 0.3)) {
    const done = await buyTea(ctx, ctx.price(boba.price) * 2.6);
    if (done) return done;
  }
  const pick = chooseFood(ctx, shopFoods(ctx));
  if (pick && (!npcOut || pick.item.clanMade) && !(ctx.unlocked('kitchen') && ctx.rand() < 0.25 * ctx.persona.producer)) {
    return (await ctx.post('/shop/buy', { itemId: pick.item.id, qty: pick.qty })) ? 'buy_food' : null;
  }
  if (ctx.unlocked('kitchen')) {
    const done = await kitchen(ctx, { hungry: true });
    if (done || ctx.wrote) return done;
  }
  if (!pick || (npcOut && !pick.item.clanMade)) return null;
  return (await ctx.post('/shop/buy', { itemId: pick.item.id, qty: pick.qty })) ? 'buy_food' : null;
}

/** Mua đồ uống ở quầy trà sữa đang có bé trực (không mua ở quầy nhà mình), giá không quá `maxPrice` một ly. */
export async function buyTea(ctx, maxPrice) {
  const view = await ctx.get('/business/stalls');
  if (!view?.left) return null;
  let best = null;
  for (const s of view.stalls ?? []) {
    if (s.own) continue;
    for (const m of s.menu ?? []) {
      if (m.stock < 1 || m.price > maxPrice) continue;
      if (!best || m.price < best.price) best = { stall: s, ...m };
    }
  }
  if (!best) return null;
  const budget = Math.max(0, ctx.spare > 0 ? ctx.spare : ctx.coins - 20);
  const qty = Math.min(view.left, best.stock, view.rules?.maxPerOrder ?? 5, 1 + Math.floor(ctx.rand() * 2) + (ctx.spare > 600 ? 1 : 0), Math.floor(budget / best.price));
  if (qty < 1) return null;
  return (await ctx.post(`/business/${best.stall.id}/buy`, { recipe: best.recipe, qty })) ? 'buy_tea' : null;
}

/** Đồ chơi tốt nhất đang có (dùng khi chơi với bé). */
function bestToy(ctx) {
  const items = ctx.catalog.items ?? {};
  return Object.keys(ctx.inv).filter((id) => ctx.inv[id] > 0 && items[id]?.type === 'toy')
    .sort((a, b) => (items[b].play?.xp ?? 0) - (items[a].play?.xp ?? 0))[0] ?? null;
}

/** Đồ chơi nên mua tiếp: món đầu tiên chưa có, đủ cấp, giá dưới một phần ba tiền dư. */
function nextToy(ctx) {
  const items = ctx.catalog.items ?? {};
  return ['ball', 'yarn', 'kite'].map((id) => items[id]).find((t) => t && !ctx.inv[t.id] && (!t.minLevel || ctx.level >= t.minLevel)
    && ctx.fun >= ctx.price(t.price) * 3) ?? null;
}

/** Nghề hợp với bé nhất: theo kỹ năng cao nhất (giữ nghề cũ để còn thăng bậc). */
function careerFor(ctx) {
  const careers = ctx.catalog.careers ?? {};
  if (ctx.state.career && careers[ctx.state.career]) return ctx.state.career;
  const skills = ctx.pet.skills ?? {};
  const ranked = Object.entries(careers).sort((a, b) => (skills[b[1].skill] ?? 0) - (skills[a[1].skill] ?? 0));
  return (ctx.rand() < 0.8 ? ranked[0] : pickOne(ranked, ctx.rand))?.[0] ?? null;
}

/** Số giờ ca nên nhận: dài nhất mà năng lượng và giới hạn giờ trong ngày cho phép (bé siêng làm dài hơn). */
export function shiftHours(ctx) {
  const pet = ctx.pet;
  const done = today(ctx.state.work, ctx.day).n;
  const left = maxHoursOf(pet) - done;
  const options = (ctx.persona.zeal > 1.05 ? [4, 2, 1] : ctx.rand() < 0.5 ? [2, 4, 1] : [4, 2, 1]);
  return options.find((h) => h <= left && pet.energy >= 10 * h + 5) ?? 0;
}

async function work(ctx) {
  const { pet, state } = ctx;
  const hours = shiftHours(ctx);
  if (!hours) return null;
  const record = () => {
    const w = today(state.work, ctx.day);
    state.work = { d: ctx.day, n: w.n + hours };
  };
  // Có quầy/xưởng riêng thì thường cho bé trực ở đó; thỉnh thoảng xem tin tuyển dụng của người khác.
  if (state.biz?.id && (state.biz.stock ?? 0) > 5 && ctx.rand() < 0.4 + ctx.persona.producer * 0.4) {
    if (await ctx.post('/jobs/start', { petId: pet.id, hours, businessId: state.biz.id })) return record(), 'stall_duty';
  }
  if (state.factory?.id && (state.factory.canRun ?? 0) > 0 && ctx.rand() < 0.5 + ctx.persona.producer * 0.4) {
    if (await ctx.post('/jobs/start', { petId: pet.id, hours, factoryId: state.factory.id })) return record(), 'factory_shift';
  }
  const career = careerFor(ctx);
  if (ctx.rand() < 0.15 + ctx.persona.social * 0.15) {
    const jobs = await ctx.get('/jobs');
    const pay = (ctx.catalog.careers?.[career]?.pay?.[0] ?? 14) * 1.1;
    const shop = (jobs?.jobs ?? []).filter((j) => j.free > 0 && j.wage >= pay).sort((a, b) => b.wage - a.wage)[0];
    if (shop && await ctx.post('/jobs/start', { petId: pet.id, hours, businessId: shop.businessId })) return record(), 'hired_shift';
    const plant = (jobs?.factoryJobs ?? []).filter((j) => j.free > 0 && j.wage >= pay).sort((a, b) => b.wage - a.wage)[0];
    if (plant && await ctx.post('/jobs/start', { petId: pet.id, hours, factoryId: plant.factoryId })) return record(), 'hired_shift';
  }
  if (!career || ctx.wrote || ctx.tries >= BRAIN.maxTries) return null;
  if (await ctx.post('/jobs/start', { petId: pet.id, career, hours })) {
    state.career = career;
    record();
    return 'shift';
  }
  // Có thể đã hết giờ làm hôm nay: lượt sau không thử nữa.
  state.work = { d: ctx.day, n: 99 };
  return null;
}

const bathe = async (ctx) => ((await ctx.post(`/pets/${ctx.pet.id}/bath`)) ? 'bath' : null);

async function play(ctx) {
  const toyId = bestToy(ctx);
  return (await ctx.post(`/pets/${ctx.pet.id}/play`, toyId ? { toyId } : {})) ? 'play' : null;
}

async function claimShift(ctx) {
  const jobs = await ctx.get('/jobs');
  const ready = (jobs?.shifts ?? []).find((s) => s.ready);
  if (!ready) return null;
  return (await ctx.post(`/jobs/${ready.id}/claim`)) ? 'claim_shift' : null;
}

async function miniGame(ctx) {
  const game = ctx.rand() < 0.6 ? 'fishing' : 'memory';
  const r = await ctx.post(`/games/${game}/start`);
  if (!r?.session?.id) return null;
  const g = today(ctx.state.mg, ctx.day);
  ctx.state.mg = { d: ctx.day, n: g.n + 1 };
  ctx.state.game = { id: r.session.id, game };
  return 'game_start';
}

/** Kết thúc ván dở với kết quả trung bình như người chơi bình thường. */
export async function finishGame(ctx) {
  const g = typeof ctx.state.game === 'string' ? { id: ctx.state.game, game: 'fishing' } : ctx.state.game;
  delete ctx.state.game;
  const rand = ctx.rand;
  const result = g.game === 'memory'
    ? (() => {
      const pairs = 5 + Math.floor(rand() * 4);
      return { pairs, moves: pairs * 2 + Math.floor(rand() * 8) };
    })()
    : { caught: Array.from({ length: 3 + Math.floor(rand() * 6) }, () => rand() < 0.5) };
  return (await ctx.post('/games/finish', { sessionId: g.id, result })) ? 'game_finish' : null;
}

async function school(ctx) {
  const careers = ctx.catalog.careers ?? {};
  const skill = ctx.persona.producer > 0.6 && ctx.rand() < 0.5 ? 'craft' : careers[ctx.state.career]?.skill ?? pickOne(Object.keys(ctx.catalog.school?.classes ?? { craft: 1 }), ctx.rand);
  const r = await ctx.post('/school/class', { petId: ctx.pet.id, skill });
  const s = today(ctx.state.sch, ctx.day);
  ctx.state.sch = { d: ctx.day, n: r ? s.n + 1 : 9 };
  return r ? 'school' : null;
}

async function quests(ctx) {
  const view = await ctx.get('/quests');
  ctx.state.q = { d: ctx.day, at: ctx.now, done: false };
  if (!view) return null;
  const ready = (view.quests ?? []).find((x) => !x.claimed && x.progress >= x.goal);
  if (ready) return (await ctx.post(`/quests/${ready.slot}/claim`)) ? 'quest' : null;
  if (view.chest?.ready && !view.chest.claimed) {
    if (await ctx.post('/quests/-1/claim')) {
      ctx.state.q.done = true;
      return 'quest_chest';
    }
  }
  if (view.chest?.claimed) ctx.state.q.done = true;
  return null;
}

async function bank(ctx) {
  const { state } = ctx;
  if (ctx.coins < ctx.reserve * 0.4 && (state.saved ?? 0) > 0) {
    const amount = Math.max(1, Math.min(state.saved, ctx.reserve));
    const r = await ctx.post('/bank/savings', { action: 'withdraw', amount });
    state.saved = r ? state.saved - amount : 0;
    return r ? 'bank_withdraw' : null;
  }
  // Khoản để dành cho quầy/xưởng: đủ rồi thì rút ra; gửi tiết kiệm phần dư trên khoản đó.
  if (ctx.goal && ctx.coins < ctx.goal + ctx.reserve && ctx.coins + (state.saved ?? 0) >= ctx.goal + ctx.reserve) {
    const amount = Math.min(state.saved, ctx.goal + ctx.reserve - ctx.coins + 50);
    const r = await ctx.post('/bank/savings', { action: 'withdraw', amount });
    state.saved = r ? state.saved - amount : 0;
    return r ? 'bank_withdraw' : null;
  }
  const amount = Math.floor((ctx.coins - 2 * ctx.reserve - ctx.goal) * (0.3 + ctx.rand() * 0.3));
  if (amount < 50) return null;
  if (!(await ctx.post('/bank/savings', { action: 'deposit', amount }))) return null;
  state.saved = (state.saved ?? 0) + amount;
  return 'bank';
}

// ---------------------------------------------------------------- Ngân hàng gia tộc

/**
 * Bot là người gửi nhỏ ở ngân hàng gia tộc: so lãi với tiết kiệm NPC, chỉ gửi nơi uy tín cao; ngân hàng mất uy tín thì
 * người cẩn thận rút sớm (nên hàng chờ rút có thể xảy ra thật). Tộc trưởng bot của gia tộc nắm Ngân hàng nhà nước mở
 * ngân hàng khi quỹ dư và đặt lãi 1,5 tới 2,5 lần lãi tiết kiệm. Trả về { path, body, action } hoặc null.
 */
export function clanBankMove(ctx, view) {
  const { rand, persona: p, state } = ctx;
  if (!view) return null;
  const rules = view.rules ?? {};
  const banks = new Map((view.banks ?? []).map((b) => [b.clanId, b]));
  const live = (view.deposits ?? []).filter((d) => d.status === 'open');
  state.cbank = live.length;
  const scared = live.find((d) => !d.matured && (banks.get(d.bankId)?.reputation ?? 100) < 60 && !banks.get(d.bankId)?.frozen);
  if (scared && rand() < 0.7 - p.trader * 0.3) return { path: `/clan-bank/deposits/${scared.id}/withdraw`, action: 'cbank_withdraw' };
  const mine = view.clan;
  if (mine?.leader && mine.holder) {
    const minCapital = rules.minCapital ?? 50_000;
    if (mine.bank?.status !== 'open') {
      if (mine.fund >= minCapital * 3 && rand() < 0.5) return { path: '/clan-bank/open', body: { capital: Math.floor(mine.fund * 0.4) }, action: 'cbank_open' };
    } else if ((mine.bank.rates?.[7] ?? 0) <= view.baseRate * 1.01) {
      const k = 1.5 + p.trader;
      const rates = Object.fromEntries((rules.terms ?? [7, 14, 30]).map((t, i) => [t, Math.min(view.maxDepositRate, view.baseRate * (k + i * 0.25))]));
      return { path: '/clan-bank/terms', body: { rates, loanRate: Math.min(view.loanRange[1], view.baseRate * (k + 1.5)), lendingOpen: true }, action: 'cbank_terms' };
    }
  }
  const amount = Math.floor((ctx.coins - 2 * ctx.reserve - ctx.goal) * (0.2 + rand() * 0.2));
  if (amount < (rules.minDeposit ?? 100)) return null;
  const term = rand() < 0.7 ? 7 : 14;
  const best = [...banks.values()]
    .filter((b) => b.accepting && b.reputation >= 70)
    .map((b) => ({ b, rate: b.rates.find((r) => r.days === term)?.rate ?? 0 }))
    .filter((x) => x.rate > view.baseRate * 1.2)
    .sort((x, y) => y.rate - x.rate)[0];
  if (!best || rand() > 0.3 + p.trader * 0.5) return null;
  return { path: `/clan-bank/${best.b.clanId}/deposit`, body: { amount: Math.min(amount, 5_000), term }, action: 'cbank_deposit' };
}

async function clanBank(ctx) {
  const move = clanBankMove(ctx, await ctx.get('/clan-bank'));
  return move && (await ctx.post(move.path, move.body ?? {})) ? move.action : null;
}

// ---------------------------------------------------------------- cổ phiếu gia tộc

/**
 * Bot là nhà đầu tư nhỏ: mua 1–3 cổ phần IPO hay cổ phiếu đang rẻ so với giá trị sổ sách, chốt lời khi giá lên 12%,
 * cắt lỗ khi giá xuống 20% (người buôn kiên nhẫn hơn). Nhớ giá vốn trong state.sh. Trả về { path, body, action } hoặc null.
 */
export function sharesMove(ctx, view) {
  const { rand, persona: p, state } = ctx;
  if (!view) return null;
  state.sh = state.sh ?? {};
  const held = new Map((view.holdings ?? []).map((h) => [h.clanId, h]));
  for (const id of Object.keys(state.sh)) if (!held.has(Number(id))) delete state.sh[id];
  for (const l of view.listings ?? []) {
    const h = held.get(l.clanId);
    if (!h || l.status !== 'listed' || h.qty - h.pledged < 1) continue;
    const cost = state.sh[l.clanId] ?? l.price;
    const up = l.price >= cost * (1.12 + p.trader * 0.1);
    const down = l.price <= cost * (0.8 - p.trader * 0.1);
    if ((up || down) && rand() < 0.6) return { path: `/shares/${l.clanId}/sell`, body: { qty: Math.min(h.qty - h.pledged, 1 + Math.floor(rand() * 2)) }, action: 'share_sell' };
  }
  const budget = ctx.coins - 3 * ctx.reserve - ctx.goal;
  const cap = view.rules?.playerCap ?? 100;
  const picks = (view.listings ?? []).filter((l) => (held.get(l.clanId)?.qty ?? 0) < Math.min(cap, 6) && (l.status === 'subscribing' ? l.ipo.price <= l.book * 1.1 && l.ipo.sold < l.ipo.shares : l.price <= l.book * (1 + p.trader * 0.3)));
  if (!picks.length || rand() > 0.25 + p.trader * 0.5) return null;
  const l = picks[Math.floor(rand() * picks.length)];
  const unit = l.status === 'subscribing' ? l.ipo.price : l.quote.buy1 * (1 + (view.rules?.fee ?? 0.01));
  const qty = Math.min(1 + Math.floor(rand() * 3), Math.floor(budget / Math.max(1, unit)));
  if (qty < 1) return null;
  state.sh[l.clanId] = Math.round(((state.sh[l.clanId] ?? unit) + unit) / 2);
  return l.status === 'subscribing'
    ? { path: `/shares/${l.clanId}/subscribe`, body: { qty }, action: 'share_ipo' }
    : { path: `/shares/${l.clanId}/buy`, body: { qty }, action: 'share_buy' };
}

async function shares(ctx) {
  const move = sharesMove(ctx, await ctx.get('/shares'));
  return move && (await ctx.post(move.path, move.body ?? {})) ? move.action : null;
}

// ---------------------------------------------------------------- trái phiếu

/** Bot mua vài trái phiếu đang mở bán có lãi từ 1,5 lần lãi suất cơ bản, giữ tới đáo hạn. Trả về { path, body, action } hoặc null. */
export function bondsMove(ctx, view) {
  const { rand, persona: p } = ctx;
  if (!view) return null;
  const held = new Map((view.holdings ?? []).map((h) => [h.issueId, h.qty]));
  const budget = ctx.coins - 3 * ctx.reserve - ctx.goal;
  const open = (view.issues ?? []).filter((i) => i.open && i.status === 'subscribing' && i.coupon >= view.baseRate * 1.5 && (held.get(i.id) ?? 0) < Math.min(i.cap, 10) && i.sold < i.qty);
  if (!open.length || rand() > 0.3 + (1 - p.trader) * 0.3) return null;
  const i = open[Math.floor(rand() * open.length)];
  const qty = Math.min(1 + Math.floor(rand() * 5), Math.floor(budget / i.face), i.cap - (held.get(i.id) ?? 0), i.qty - i.sold);
  return qty >= 1 ? { path: `/bonds/${i.id}/subscribe`, body: { qty }, action: 'bond_buy' } : null;
}

async function bondsStep(ctx) {
  const move = bondsMove(ctx, await ctx.get('/bonds'));
  return move && (await ctx.post(move.path, move.body ?? {})) ? move.action : null;
}

/** Trang phục: mở hộp kín, đeo món còn trống khe. Trả về { path, body, action } hoặc null. */
function gearMove(ctx) {
  const pet = ctx.pet;
  const items = ctx.catalog.items ?? {};
  const sealed = (ctx.me.gear ?? []).find((g) => g.sealed && !g.listed);
  if (sealed) return { path: `/gear/${sealed.id}/open`, action: 'gear_open' };
  const worn = pet.gear ?? {};
  if (Object.keys(worn).length >= (pet.wearLimit ?? 3)) return null;
  const free = (ctx.me.gear ?? []).find((g) => !g.sealed && !g.wornBy && !g.listed && !g.broken && items[g.itemId]?.slot && !worn[items[g.itemId].slot]);
  return free ? { path: `/pets/${pet.id}/equip`, body: { gearId: free.id }, action: 'gear_equip' } : null;
}

async function gear(ctx) {
  const move = gearMove(ctx);
  return move && (await ctx.post(move.path, move.body ?? {})) ? move.action : null;
}

// ---------------------------------------------------------------- Sàn Nguyên Liệu

/** Hàng bot giữ lại để dùng (nguyên liệu quầy trà sữa, đầu vào xưởng), không đem bán. */
function keepSet(ctx) {
  const keep = new Set();
  const recipes = ctx.catalog.business?.recipes ?? {};
  for (const r of ctx.state.biz?.menu ?? []) for (const c of Object.keys(recipes[r]?.inputs ?? {})) keep.add(c);
  const kind = ctx.catalog.factory?.kinds?.[ctx.state.factory?.kind];
  for (const c of Object.keys(kind?.input ?? {})) keep.add(c);
  // Có bếp: giữ cá (câu được ở mini-game) để nướng cho bé.
  if (ctx.unlocked('kitchen')) keep.add('fish');
  return keep;
}

/** Giá tham chiếu một lô: giá gốc × chỉ số giá. */
const refOf = (ctx, id) => (ctx.catalog.commodities?.[id]?.base ?? 1) * ctx.idx;

/**
 * Quyết định một lệnh trên Sàn từ màn hình /market: bán hàng đang lời / sắp hỏng / tự làm ra khi giá không thấp,
 * mua món đang rẻ hơn giá tham chiếu. Khối lượng nhỏ, trong hạn mức NPC, chừa phần hạn mức chung của thị trấn;
 * lệnh giới hạn đặt trong biên giá cho phép. Trả về thân lệnh POST /market/order hoặc null.
 */
export function marketOrder(ctx, view) {
  const { rand, persona } = ctx;
  const band = ctx.catalog.market?.band ?? 0.15;
  const lot = ctx.catalog.market?.lot ?? 10;
  const keep = keepSet(ctx);
  const prices = Object.fromEntries((view.commodities ?? []).map((c) => [c.id, c]));
  const [lo, hi] = BRAIN.tradeLots;
  const lots = lo + Math.floor(persona.trader * (hi - lo + 0.99));
  const limitOf = (c, side) => {
    // Lệnh giới hạn: gần giá hiện tại, luôn trong biên ±band (chừa 1 điểm % cho giá nhích trong lúc chờ).
    const k = side === 'buy' ? 1 - 0.01 - rand() * 0.03 : 1 + 0.01 + rand() * 0.04;
    return round1(clamp(c.price * k, c.price * (1 - band + 0.01), c.price * (1 + band - 0.01)));
  };
  const useLimit = () => rand() < 0.15 + persona.trader * 0.25;
  const townOk = (c, side) => c.town?.[side] && c.town[side].left > c.town[side].total * BRAIN.townFloor;

  const sells = [];
  for (const [id, h] of Object.entries(view.holdings ?? {})) {
    const c = prices[id];
    if (!c || h.qty < 1 || keep.has(id) || !townOk(c, 'sell') || (c.npcLeft?.sell ?? 0) < 1) continue;
    const ratio = c.price / refOf(ctx, id);
    const aging = (h.lots ?? []).some((l) => (l.factor ?? 1) < 0.97);
    const gain = h.avgCost > 0 ? (c.bid ?? c.price) / h.avgCost : 1.5; // hàng tự trồng/làm ra: giá vốn thấp
    if (ratio < 1.03 && !aging && gain < 1.05) continue;
    sells.push({ id, c, h, score: (ratio - 1) + (gain - 1) + (aging ? 0.6 : 0) });
  }
  sells.sort((a, b) => b.score - a.score);
  const sell = sells[0];
  if (sell && (rand() < 0.7 || !persona.trader)) {
    // Hàng tự làm ra (vườn, xưởng) bán nhiều hơn chút, nhưng không quá 10% hạn mức chung còn lại.
    const own = sell.h.avgCost <= refOf(ctx, sell.id) * 0.6;
    const cap = (own ? 25 : lots) * lot;
    const qty = Math.min(sell.h.qty, sell.c.npcLeft.sell, cap, Math.max(lot, Math.floor((sell.c.town?.sell?.left ?? cap) * 0.1)));
    if (qty >= 1) {
      return useLimit() && !own
        ? { commodity: sell.id, side: 'sell', qty, type: 'limit', limit: limitOf(sell.c, 'sell') }
        : { commodity: sell.id, side: 'sell', qty, type: 'market' };
    }
  }
  if (ctx.fun < 60) return null;
  const cheap = Object.values(prices)
    .filter((c) => (c.npcLeft?.buy ?? 0) >= lot && townOk(c, 'buy'))
    .map((c) => ({ c, ratio: c.price / refOf(ctx, c.id) }))
    .filter((x) => x.ratio < 1 - (1 - persona.trader) * 0.04)
    .sort((a, b) => a.ratio - b.ratio);
  const buy = cheap[Math.floor(rand() * Math.min(2, cheap.length))];
  if (!buy) return null;
  const budget = ctx.fun * (0.15 + persona.trader * 0.2);
  const perPart = ((buy.c.ask ?? buy.c.price) / lot) * 1.02;
  const qty = Math.min(lots * lot, buy.c.npcLeft.buy, Math.floor(budget / perPart));
  if (qty < lot / 2) return null;
  return useLimit()
    ? { commodity: buy.c.id, side: 'buy', qty, type: 'limit', limit: limitOf(buy.c, 'buy') }
    : { commodity: buy.c.id, side: 'buy', qty, type: 'market' };
}

async function market(ctx) {
  const view = await ctx.get('/market');
  if (!view) return null;
  const order = marketOrder(ctx, view);
  if (!order) return null;
  return (await ctx.post('/market/order', order)) ? `market_${order.side}` : null;
}

// ---------------------------------------------------------------- Quầy trà sữa

/** Vị trí quầy mở được: chỗ đông khách nhất mà tiền giấy phép chỉ chiếm phần nhỏ số tiền dư. */
export function stallLocation(ctx) {
  const locs = ctx.catalog.business?.locations ?? {};
  const order = ['center', 'street', 'alley'].filter((k) => locs[k]);
  return order.find((k) => ctx.spare >= ctx.price(locs[k].license) * (k === 'alley' ? 1.2 : 2) + 300) ?? null;
}

async function openStall(ctx) {
  const loc = stallLocation(ctx);
  if (!loc) return null;
  const name = `${pickOne(['Quầy', 'Trà sữa', 'Tiệm', 'Góc'], ctx.rand)} ${pickOne(NAMES, ctx.rand)}`;
  if (!(await ctx.post('/business/open', { name, location: loc }))) return null;
  ctx.state.biz = { id: null, loc, stock: 0, menu: ['boba_milk_tea'] };
  return 'stall_open';
}

/** Thực đơn mới nếu cần: đủ món theo số ô, giá quanh giá tham chiếu. Trả về mảng thực đơn hoặc null nếu giữ nguyên. */
export function stallMenu(b, recipes, rand) {
  const menu = b.menu.map((m) => ({ recipe: m.recipe, price: m.price, ref: m.ref }));
  let changed = false;
  if (menu.length < b.slots) {
    const have = new Set(menu.map((m) => m.recipe));
    const inputs = new Set(menu.flatMap((m) => Object.keys(recipes[m.recipe]?.inputs ?? {})));
    const add = Object.entries(recipes).filter(([id]) => !have.has(id))
      .map(([id, r]) => ({ id, r, overlap: Object.keys(r.inputs).filter((c) => inputs.has(c)).length / Object.keys(r.inputs).length, margin: r.ref - r.cost }))
      .sort((a, b) => b.overlap - a.overlap || b.margin - a.margin)[0];
    if (add) {
      menu.push({ recipe: add.id, price: add.r.ref, ref: add.r.ref });
      changed = true;
    }
  }
  for (const m of menu) {
    const ref = recipes[m.recipe]?.ref ?? m.ref;
    if (!ref) continue;
    if (Math.abs(m.price / ref - 1) > 0.18) {
      m.price = Math.max(1, Math.round(ref * (0.95 + rand() * 0.15)));
      changed = true;
    }
  }
  return changed ? menu.map(({ recipe, price }) => ({ recipe, price })) : null;
}

async function stall(ctx) {
  if (!ctx.state.biz) return openStall(ctx);
  const view = await ctx.get('/business');
  const b = view?.business;
  if (!b?.menu) {
    ctx.state.biz = null;
    return null;
  }
  const stock = b.menu.length ? Math.min(...b.menu.map((m) => m.stock ?? 0)) : 0;
  ctx.state.biz = { id: b.id, loc: b.location, stock, menu: b.menu.map((m) => m.recipe) };
  const pet = ctx.pet;
  const hours = shiftHours(ctx);
  // 1. Quầy chưa có ai trực mà còn nguyên liệu: cho bé ra trực.
  if (!b.openNow && stock >= 6 && hours && !isBusy(pet) && !pet.sick && pet.fullness >= 25) {
    if (await ctx.post('/jobs/start', { petId: pet.id, hours, businessId: b.id })) {
      const w = today(ctx.state.work, ctx.day);
      ctx.state.work = { d: ctx.day, n: w.n + hours };
      return 'stall_duty';
    }
  }
  // 2. Nguyên liệu sắp hết: nhập món thiếu nhất (đủ khoảng 40 ly) trên Sàn.
  if (stock < 20 && ctx.spare > 0) {
    const need = {};
    for (const m of b.menu) for (const [c, n] of Object.entries(view.recipes?.[m.recipe]?.inputs ?? {})) need[c] = (need[c] ?? 0) + n * 40 / b.menu.length;
    const goods = view.goods ?? {};
    const short = Object.entries(need).map(([c, n]) => ({ c, qty: Math.ceil(n - (goods[c] ?? 0)) })).filter((x) => x.qty > 0)
      .sort((a, b) => b.qty - a.qty)[0];
    if (short) {
      const perPart = (refOf(ctx, short.c) / (ctx.catalog.market?.lot ?? 10)) * 1.1;
      const qty = Math.min(short.qty, Math.floor(ctx.spare / perPart), 400);
      if (qty >= 5 && await ctx.post('/market/order', { commodity: short.c, side: 'buy', qty, type: 'market' })) return 'stall_restock';
    }
  }
  // 3. Thực đơn: đủ món, giá quanh giá tham chiếu.
  const menu = stallMenu(b, view.recipes ?? {}, ctx.rand);
  if (menu && await ctx.post('/business/menu', { menu })) {
    ctx.state.biz.menu = menu.map((m) => m.recipe);
    return 'stall_menu';
  }
  // 4. Quầy có lời, dư tiền: đôi khi đăng tin tuyển một bé làm thuê, hoặc thêm ô thực đơn.
  const profit = (b.days ?? []).reduce((s, d) => s + d.profit, 0);
  if (profit > 150 && ctx.spare > 800 && !b.jobPost?.open && ctx.rand() < 0.2) {
    if (await ctx.post('/business/jobs', { wage: 10 + Math.floor(ctx.rand() * 6), slots: 1, open: true })) return 'stall_hire';
  }
  if (profit > 300 && b.upgrades?.menu?.next && ctx.spare > b.upgrades.menu.next * 3 && ctx.rand() < 0.15) {
    if (await ctx.post('/business/upgrade', { key: 'menu' })) return 'stall_upgrade';
  }
  return null;
}

// ---------------------------------------------------------------- vườn, bếp, xưởng

/** Cây nên trồng: đầu vào của xưởng/quầy nhà mình nếu có, không thì cây lời nhất theo giá tham chiếu mỗi giờ. */
function cropFor(ctx, crops) {
  const want = new Set([...keepSet(ctx)]);
  const own = Object.entries(crops).find(([, c]) => want.has(c.commodity));
  if (own && ctx.rand() < 0.7) return own[0];
  const lot = ctx.catalog.market?.lot ?? 10;
  const ranked = Object.entries(crops).map(([id, c]) => {
    const mid = (c.yield[0] + c.yield[1]) / 2;
    return { id, v: (mid / lot * refOf(ctx, c.commodity) - c.seed) / c.hours };
  }).sort((a, b) => b.v - a.v);
  return (ctx.rand() < 0.7 ? ranked[0] : pickOne(ranked, ctx.rand))?.id ?? null;
}

async function garden(ctx) {
  const view = await ctx.get('/garden');
  if (!view?.plots) return null;
  const plots = view.plots;
  const growing = plots.filter((p) => p.crop && !p.ready).map((p) => p.readyAt);
  const empty = plots.filter((p) => !p.crop).length;
  ctx.state.garden = { readyAt: empty || plots.some((p) => p.ready || p.pests) ? ctx.now : Math.min(...growing, ctx.now + 6 * 3_600_000), at: ctx.now };
  const pests = plots.find((p) => p.pests);
  if (pests) return (await ctx.post('/garden/pests', { plot: pests.idx })) ? 'garden_pests' : null;
  const ready = plots.find((p) => p.ready);
  if (ready) return (await ctx.post('/garden/harvest', { plot: ready.idx })) ? 'garden_harvest' : null;
  const free = plots.find((p) => !p.crop);
  if (free) {
    const crop = cropFor(ctx, view.crops ?? {});
    if (crop && (view.crops[crop]?.seed ?? 0) <= Math.max(0, ctx.spare)) {
      return (await ctx.post('/garden/plant', { plot: free.idx, crop })) ? 'garden_plant' : null;
    }
  }
  if (view.nextPlotCost && ctx.spare > ctx.price(view.nextPlotCost) * 4 && ctx.persona.producer > 0.5 && ctx.rand() < 0.1) {
    return (await ctx.post('/garden/expand')) ? 'garden_expand' : null;
  }
  return null;
}

/** Giá trị một món nhà nấu với bé lúc này (no, vui) trên chi phí nguyên liệu còn phải mua (giá tham chiếu). */
function dishWorth(ctx, recipe, goods) {
  const lot = ctx.catalog.market?.lot ?? 10;
  const missing = Object.entries(recipe.inputs).reduce((s, [c, n]) => s + Math.max(0, n - (goods[c] ?? 0)) * refOf(ctx, c) / lot, 0);
  const gain = Math.min(100 - ctx.pet.fullness, recipe.effect?.fullness ?? 0) + (recipe.effect?.happiness ?? 0) * 0.3;
  return gain / (1 + missing);
}

/**
 * Bếp: ăn món nhà nấu khi bé đói, nấu món đủ nguyên liệu, bán món sắp hỏng, hoặc mua trên Sàn nguyên liệu còn thiếu
 * cho món đáng nấu nhất (đủ vài suất). `hungry`: đang tìm đồ ăn cho bé (chỉ ăn, nấu hoặc mua nguyên liệu).
 */
async function kitchen(ctx, { hungry = false } = {}) {
  const view = await ctx.get('/kitchen');
  if (!view) return null;
  const pet = ctx.pet;
  const dishes = view.dishes ?? [];
  const goods = view.goods ?? {};
  const dish = dishes.filter((d) => (d.effect?.fullness ?? 0) > 0).sort((a, b) => a.expiresAt - b.expiresAt)[0];
  if (dish && pet.fullness < 80) return (await ctx.post(`/kitchen/dishes/${dish.id}/eat`, { petId: pet.id })) ? 'eat_dish' : null;
  const recipes = Object.entries(view.recipes ?? {}).map(([id, r]) => ({ id, r, worth: dishWorth(ctx, r, goods) })).sort((a, b) => b.worth - a.worth);
  const ready = recipes.find((x) => x.r.canMake > 0);
  if (ready && !isBusy(pet) && !pet.sick && pet.energy >= 10 && dishes.length < 4) {
    return (await ctx.post('/kitchen/cook', { recipe: ready.id })) ? 'cook' : null;
  }
  if (!hungry) {
    const old = dishes.find((d) => d.expiresAt - ctx.now < 12 * 3_600_000);
    if (old && pet.fullness >= 80) return (await ctx.post(`/kitchen/dishes/${old.id}/sell`)) ? 'dish_sell' : null;
  }
  // Mua nguyên liệu còn thiếu cho món đáng nấu nhất, đủ khoảng 4 suất (Sàn bán theo phần, 1 lô = 10 phần).
  const best = recipes[0];
  if (!ready && best && ctx.spare > 40 && ctx.unlocked('market') && (hungry || ctx.rand() < 0.3 + ctx.persona.producer * 0.3)) {
    const miss = Object.entries(best.r.inputs).find(([c, n]) => (goods[c] ?? 0) < n);
    if (miss) {
      const qty = Math.max(miss[1], miss[1] * 4 - (goods[miss[0]] ?? 0));
      if (await ctx.post('/market/order', { commodity: miss[0], side: 'buy', qty, type: 'market' })) return 'kitchen_shop';
    }
  }
  return null;
}

/** Loại xưởng nên xây: xưởng sấy trà khi đủ vốn, không thì xưởng 3.000 xu; ưu tiên đầu vào mình tự trồng. */
export function factoryKind(ctx) {
  const kinds = ctx.catalog.factory?.kinds ?? {};
  const affordable = Object.entries(kinds).filter(([, k]) => ctx.spare >= ctx.price(k.build) + 1500);
  if (!affordable.length) return null;
  const grown = new Set(Object.values(ctx.catalog.garden?.crops ?? {}).map((c) => c.commodity));
  affordable.sort((a, b) => (Object.keys(b[1].input).some((c) => grown.has(c)) - Object.keys(a[1].input).some((c) => grown.has(c))) || b[1].build - a[1].build);
  return (ctx.rand() < 0.7 ? affordable[0] : pickOne(affordable, ctx.rand))[0];
}

async function factory(ctx) {
  if (!ctx.state.factory) {
    const kind = factoryKind(ctx);
    if (!kind || !(await ctx.post('/factory/build', { kind }))) return null;
    ctx.state.factory = { id: null, kind, canRun: 0 };
    return 'factory_build';
  }
  const view = await ctx.get('/factory');
  const f = view?.factories?.[0];
  if (!f) {
    ctx.state.factory = null;
    return null;
  }
  ctx.state.factory = { id: f.id, kind: f.kind, canRun: f.canRun };
  const def = view.kinds?.[f.kind];
  const pet = ctx.pet;
  const hours = shiftHours(ctx);
  const onDuty = (f.duty ?? []).some((d) => d.startsAt <= ctx.now);
  // 1. Có nguyên liệu mà máy đang nghỉ: cho bé đứng máy.
  if (f.canRun >= 4 && !onDuty && hours && !isBusy(pet) && !pet.sick && pet.fullness >= 25) {
    if (await ctx.post('/jobs/start', { petId: pet.id, hours, factoryId: f.id })) {
      const w = today(ctx.state.work, ctx.day);
      ctx.state.work = { d: ctx.day, n: w.n + hours };
      return 'factory_shift';
    }
  }
  if (!def) return null;
  const goods = view.goods ?? {};
  const [inC, inLots] = Object.entries(def.input)[0];
  const [outC] = Object.entries(def.output)[0];
  const lot = ctx.catalog.market?.lot ?? 10;
  // 2. Bán thành phẩm (giữ lại phần quầy nhà mình cần), hoặc 3. mua đầu vào khi còn lời: cần giá Sàn hiện tại.
  const keep = new Set((ctx.state.biz?.menu ?? []).flatMap((r) => Object.keys(ctx.catalog.business?.recipes?.[r]?.inputs ?? {})));
  const out = keep.has(outC) ? Math.max(0, (goods[outC] ?? 0) - 60) : goods[outC] ?? 0;
  if (out < lot && f.canRun >= 8) return null;
  const mv = await ctx.get('/market');
  const price = (id) => mv?.commodities?.find((c) => c.id === id);
  if (out >= lot) {
    const c = price(outC);
    if (c && c.price >= refOf(ctx, outC) * 0.88 && c.npcLeft?.sell > 0) {
      const qty = Math.min(out, c.npcLeft.sell, 25 * lot, Math.max(lot, Math.floor((c.town?.sell?.left ?? 250) * 0.1)));
      if (await ctx.post('/market/order', { commodity: outC, side: 'sell', qty, type: 'market' })) return 'factory_sell';
    }
  }
  const cin = price(inC);
  const cout = price(outC);
  if (cin && cout && ctx.spare > 200) {
    const margin = cout.bid * 0.985 - (cin.ask * 1.015) * inLots;
    if (margin > 1) {
      const batches = Math.round((def.perHour + f.level * 3) * 4);
      const want = batches * inLots * lot - (goods[inC] ?? 0);
      const qty = Math.min(want, cin.npcLeft?.buy ?? 0, Math.floor(ctx.spare * 0.6 / (cin.ask / lot * 1.02)));
      if (qty >= lot && await ctx.post('/market/order', { commodity: inC, side: 'buy', qty, type: 'market' })) return 'factory_supply';
    }
  }
  return null;
}

// ---------------------------------------------------------------- Chợ Phiên

/** Chọn một việc ở Chợ Phiên: mua món ăn/đồ uống đáng giá khi bé cần, hoặc bày bán món dư với giá quanh giá tham chiếu. */
export function bazaarMove(ctx, view) {
  const { rand, pet } = ctx;
  const items = ctx.catalog.items ?? {};
  const band = ctx.catalog.bazaar?.band ?? [0.5, 3];
  const fair = (ref, lo, hi) => clamp(Math.round(ref * (lo + rand() * (hi - lo))), Math.max(1, Math.ceil(ref * band[0])), Math.floor(ref * band[1]));
  // Mua: món ăn (đồ siêu thị, đồ uống quầy, món nhà nấu) không đắt hơn giá tham chiếu bao nhiêu, khi bé chưa no.
  if (pet.fullness < 85 && ctx.spare > 30) {
    const food = (view.listings ?? []).filter((l) => !l.mine && l.price <= Math.max(1, ctx.spare * 0.3)
      && l.price <= l.refPrice * 1.1 && (l.type === 'dish' || (l.kind === 'item' && items[l.ref]?.type === 'food')))
      .sort((a, b) => a.price / a.refPrice - b.price / b.refPrice)[0];
    if (food) return { path: `/bazaar/${food.id}/buy`, body: {}, action: 'bazaar_buy' };
  }
  // Mua trang phục rẻ hơn hẳn giá tham chiếu khi dư dả (thỉnh thoảng).
  if (ctx.fun > 1500 && rand() < 0.2) {
    const deal = (view.listings ?? []).filter((l) => !l.mine && l.kind === 'gear' && l.price <= l.refPrice * 0.8 && l.price * 4 <= ctx.fun)[0];
    if (deal) return { path: `/bazaar/${deal.id}/buy`, body: {}, action: 'bazaar_buy' };
  }
  if (!view.canSell || (view.open ?? 0) >= 3) return null;
  const sellable = view.sellable ?? {};
  // Bán: món nhà nấu dư (bé đang no), đồ ăn tích quá nhiều, trang phục trùng khe đã đeo.
  const dish = (sellable.dishes ?? [])[0];
  if (dish && (pet.fullness >= 70 || (sellable.dishes ?? []).length > 2)) {
    return { path: '/bazaar/list', body: { kind: 'dish', ref: String(dish.ref), price: fair(dish.refPrice, 0.95, 1.25) }, action: 'bazaar_list' };
  }
  const extra = (sellable.items ?? []).find((i) => i.qty > 4 && items[i.ref]?.type === 'food');
  if (extra) return { path: '/bazaar/list', body: { kind: 'item', ref: extra.ref, price: fair(extra.refPrice, 0.9, 1.15) }, action: 'bazaar_list' };
  const worn = new Set(Object.keys(pet.gear ?? {}));
  const spareGear = (sellable.gear ?? []).find((g) => !g.wornBy && !g.listed && !g.sealed && items[g.itemId]?.slot && worn.has(items[g.itemId].slot));
  if (spareGear && spareGear.refPrice > 0 && rand() < 0.5) {
    return { path: '/bazaar/list', body: { kind: 'gear', ref: String(spareGear.id), price: fair(spareGear.refPrice, 0.9, 1.3) }, action: 'bazaar_list' };
  }
  return null;
}

async function bazaar(ctx) {
  const view = await ctx.get('/bazaar');
  if (!view) return null;
  const move = bazaarMove(ctx, view);
  if (!move) return null;
  return (await ctx.post(move.path, move.body)) ? move.action : null;
}

// ---------------------------------------------------------------- gia tộc

/** Gia tộc nên xin vào: còn chỗ, cấp gần với sức của mình, đông vừa phải (người giao du thích chỗ đông). */
export function clanToJoin(ctx, clans) {
  const want = 1 + Math.floor(ctx.level / 10);
  const open = clans.filter((c) => c.members < (c.maxMembers ?? 30));
  if (!open.length) return null;
  const scored = open.map((c) => ({
    c,
    score: Math.min(6, (c.maxMembers ?? 30) - c.members) * 0.5 + 6 - Math.abs((c.level ?? 1) - want) * 3 + ctx.persona.social * Math.min(10, c.members) * 0.3 + ctx.rand() * 2,
  })).sort((a, b) => b.score - a.score);
  return scored[0].c;
}

/** Mảnh công trình rẻ nhất để dựng một công trình tối thiểu (móng nền + 2 mảnh) cho lô đất của gia tộc. */
export function starterDesign() {
  const base = PIECES.filter((p) => p.family === 'base').sort((a, b) => a.cost - b.cost)[0];
  const rest = PIECES.filter((p) => p.family !== 'base').sort((a, b) => a.cost - b.cost).slice(0, 2);
  if (!base || rest.length < 2) return null;
  const parts = [base, ...rest];
  let x = 0;
  return parts.map((p) => {
    const piece = { piece: p.id, x, y: 20 - p.h, color: '#8b5e3c', flip: false };
    x += p.w;
    return piece;
  }).filter((p) => p.x + PIECES.find((q) => q.id === p.piece).w <= 24);
}

async function clanStep(ctx) {
  const { rand, persona, state, helpers, now } = ctx;
  const view = await ctx.get('/clans');
  if (!view) return null;
  const clan = view.clan;
  state.clanLook = now;
  if (!clan) {
    state.clan = null;
    const target = clanToJoin(ctx, view.clans ?? []);
    if (target && rand() < 0.85) {
      if (await ctx.post(`/clans/${target.id}/join`)) {
        state.clan = { id: target.id, role: 'member' };
        return 'clan_join';
      }
    }
    // Không còn gia tộc nào có chỗ: người giao du, đủ tiền thì lập gia tộc mới (gia tộc bot không quá clanShare).
    const cost = view.config?.createCost ?? 3000;
    if ((!target || persona.social > 0.7) && ctx.spare >= cost + 200 && (helpers.clanShareOk?.() ?? false) && rand() < 0.3 + persona.social * 0.4) {
      const name = `${pickOne(['Nhà', 'Họ', 'Hội', 'Bang', 'Phố'], rand)} ${pickOne(NAMES, rand)} ${pickOne(['Vàng', 'Xanh', 'Đỏ', 'Bạc', 'Ngọc', 'Hồng'], rand)}`;
      const emblems = view.config?.emblems ?? ['🏯'];
      if (await ctx.post('/clans/create', { name, emblem: pickOne(emblems, rand), color: pickOne(['#aa5533', '#2266aa', '#338844', '#884499', '#cc8800'], rand) })) {
        state.clan = { id: null, role: 'leader' };
        return 'clan_create';
      }
    }
    return null;
  }
  state.clan = { id: clan.id, role: clan.role };
  const meRow = (clan.members ?? []).find((m) => m.id === ctx.userId);
  // Góp quỹ: đủ định mức tuần (vừa phải), khi có tiền dư.
  const week = meRow?.week ?? 0;
  const quota = clan.quota ?? 300;
  if (week < quota && ctx.spare > 80 && rand() < 0.5 + persona.social * 0.4) {
    const amount = Math.floor(Math.min(quota - week, BRAIN.donateMax, ctx.spare * (0.15 + persona.social * 0.2)));
    if (amount >= 10 && await ctx.post('/clans/donate', { amount })) return 'clan_donate';
  }
  const leader = clan.role === 'leader';
  if (!leader && clan.role !== 'elder') return null;
  const treasury = clan.treasury ?? 0;
  // Tộc trưởng phong trưởng lão cho người góp nhiều nhất khi gia tộc đã đông.
  if (leader && (clan.members ?? []).length >= 5 && !(clan.members ?? []).some((m) => m.role === 'elder') && rand() < 0.3) {
    const top = (clan.members ?? []).filter((m) => m.role === 'member' && !m.deposed).sort((a, b) => b.donated - a.donated)[0];
    if (top && await ctx.post('/clans/role', { userId: top.id, role: 'elder' })) return 'clan_promote';
  }
  // Ngành: thâu tóm ngành rẻ nhất khi quỹ dư nhiều (gấp 1,5 phí).
  const owned = (clan.industries ?? []).map((i) => i.id);
  state.bankHolder = leader && owned.includes('state_bank');
  if (leader && owned.length < (clan.perks?.maxIndustries ?? 1) && (clan.level ?? 1) >= (clan.nextIndustryLevel ?? 1)) {
    const cheapest = Object.entries(clan.nextFees ?? {}).filter(([id]) => !owned.includes(id)).sort((a, b) => a[1] - b[1])[0];
    if (cheapest && treasury >= cheapest[1] * 1.5 && await ctx.post('/clans/industries', { industry: cheapest[0] })) return 'clan_industry';
  }
  // Lô đất: chọn ngành cho lô chưa có ngành, dựng công trình tối thiểu cho lô chưa chạy.
  const idle = (clan.plots ?? []).find((p) => !p.industry && owned.length);
  if (idle && await ctx.post(`/land/${idle.id}/industry`, { industry: pickOne(owned, rand) })) return 'land_industry';
  const unbuilt = (clan.plots ?? []).find((p) => p.industry && !p.operating && p.pieces < 3);
  if (unbuilt) {
    const design = starterDesign();
    if (design && await ctx.post(`/land/${unbuilt.id}/design`, { design })) return 'land_design';
  }
  // Bị thách đấu: chọn khung giờ đầu tiên còn hạn; thách đấu khi thích đánh (luật Đấu trường, gia tộc người thật 1 lần/7 ngày).
  if (rand() < 0.5) {
    const arena = await ctx.get('/arena');
    const pending = arena?.clan?.wars?.find((w) => w.status === 'proposed' && w.defender.id === clan.id);
    const slot = (pending?.slots ?? []).find((s) => s > now);
    if (slot && await ctx.post(`/arena/${pending.id}/confirm`, { at: slot })) return 'arena_confirm';
    if (arena?.clan && leader && persona.fighter > 0.6 && rand() < 0.15) {
      const busy = (arena.clan.wars ?? []).some((w) => w.status === 'proposed' || w.status === 'scheduled');
      const targets = (arena.clan.targets ?? []).filter((t) => t.kind === 'plot' && !helpers.clanRecent?.(state, t.clanId, now));
      if (!busy && targets.length) {
        const t = pickOne(targets, rand);
        const days = arena.days ?? [];
        const at = { day: days[1 + Math.floor(rand() * Math.min(4, days.length - 1))] ?? days[0], hour: rand() < 0.5 ? 19 : 20 };
        if (await ctx.post('/arena/challenge', { defenderId: t.clanId, kind: t.kind, ref: t.ref, slots: [at] })) {
          if (!helpers.clanIsBot?.(t.clanId)) state.realChallengeAt = now;
          return 'arena_challenge';
        }
      }
    }
    return null;
  }
  // Mua đất khi quỹ dư gấp đôi giá lô rẻ còn trống (và gia tộc đã có ngành để chạy).
  if (owned.length && (clan.plots ?? []).length < (clan.perks?.maxPlots ?? 1) && treasury >= 200_000) {
    const land = await ctx.get('/land');
    const free = (land?.plots ?? []).filter((p) => !p.owner && p.price && p.price * 2 <= treasury).sort((a, b) => a.price - b.price);
    if (free.length && await ctx.post(`/land/${free[Math.floor(rand() * Math.min(5, free.length))].id}/buy`)) return 'land_buy';
  }
  return null;
}

// ---------------------------------------------------------------- chấm điểm và chọn việc

/**
 * Các việc làm được lúc này, mỗi việc { key, score, need, run }. `need`: việc cần làm ngay (bé đói, ốm, bẩn,
 * quà ngày, lương chờ nhận); `run(ctx)` làm việc đó, trả về tên việc đã làm hoặc null.
 */
export function candidates(ctx) {
  const { pet, persona: p, state, now, day, me } = ctx;
  const out = [];
  const add = (key, score, run, need = false) => {
    if (score > 0) out.push({ key, score, run, need });
  };
  const busy = isBusy(pet);
  const sick = Boolean(pet.sick);
  const hour = new Date(now + 7 * 3_600_000).getUTCHours();

  // Việc cần làm ngay: quà ngày, lương chờ nhận, bé ốm, đói lả, bẩn, buồn thiu (sắp thoát game thì cho ăn no trước).
  if (!me.user.dailyReadyAt) add('daily', 100, async (c) => ((await c.post('/daily')) ? 'daily' : null), true);
  if (me.badges?.jobs > 0) add('claim_shift', 90, claimShift, true);
  if (sick) {
    const bill = ctx.price(ctx.catalog.care?.illnesses?.[pet.sick.id]?.treat ?? 150);
    if (ctx.coins >= bill) add('clinic', 95, async (c) => ((await c.post('/clinic/visit', { petId: pet.id })) ? 'clinic' : null), true);
  } else if (pet.health < 40 && ctx.fun > ctx.price(ctx.catalog.care?.clinic?.checkup ?? 60) * 2 && p.carer > 0.4) {
    add('checkup', 20 + p.carer * 20, async (c) => ((await c.post('/clinic/visit', { petId: pet.id })) ? 'clinic' : null));
  }
  const hungry = BRAIN.hungry + p.carer * 15;
  const starving = pet.fullness < BRAIN.starving || (ctx.wrapUp && pet.fullness < 70);
  if (starving) add('feed', 80 + (BRAIN.starving - pet.fullness), feed, true);
  else if (pet.fullness < hungry) add('feed', 30 + (hungry - pet.fullness) * 0.8 + p.carer * 10, feed);
  else if (pet.fullness < 80 && bestInventoryFood(ctx)) add('snack', 8 + p.carer * 8, feed);
  const dirty = BRAIN.dirty + p.carer * 10;
  const hygiene = pet.hygiene ?? 80;
  if (!busy && hygiene < BRAIN.filthy) add('bath', 75, bathe, true);
  else if (!busy && hygiene < dirty) add('bath', 20 + (dirty - hygiene) + p.carer * 10, bathe);
  if (!busy && !sick && pet.energy >= 20 && pet.fullness >= 15) {
    const gloomy = pet.happiness < BRAIN.gloomy;
    add('play', gloomy ? 70 : 20 + p.carer * 10 + (pet.happiness < 50 ? 12 : 0), play, gloomy);
  }
  // Tiền cạn: rút bớt tiết kiệm.
  if (ctx.unlocked('bank') && ctx.coins < ctx.reserve * 0.4 && (state.saved ?? 0) > 0) add('bank_withdraw', 62, bank, true);

  // Phát triển bé: đi làm, mini-game, trường học, nhiệm vụ ngày, đồ chơi, trang phục.
  const free = !busy && !sick && pet.fullness >= 25;
  if (free && shiftHours(ctx)) add('work', 30 + p.zeal * 15 + (ctx.spare < 0 ? 20 : 0), work);
  const games = today(state.mg, day).n;
  if (!sick && pet.energy >= 10 && games < 2 + Math.round(p.zeal * 2)) add('minigame', 16 + (1 - p.trader) * 6, miniGame);
  const classes = today(state.sch, day).n;
  if (free && ctx.unlocked('school') && pet.energy >= 30 && classes < Math.round(p.zeal) && ctx.fun > ctx.price(50) * 3) {
    add('school', 8 + p.zeal * 8 + (ctx.level < 6 ? 4 : 0), school);
  }
  if (state.q?.d !== day || (!state.q.done && now - state.q.at > 3 * 3_600_000)) add('quests', 18 + p.zeal * 8 + (hour >= 18 ? 10 : 0), quests);
  const toy = nextToy(ctx);
  if (toy) add('toy', 10 + p.carer * 12, async (c) => ((await c.post('/shop/buy', { itemId: toy.id, qty: 1 })) ? 'buy_toy' : null));
  if (gearMove(ctx)) add('gear', 8 + p.carer * 6, gear);

  // Kinh tế: Sàn, ngân hàng, quầy trà sữa, vườn, bếp, xưởng, Chợ Phiên.
  if (ctx.unlocked('market')) add('market', 10 + p.trader * 40, market);
  if (ctx.unlocked('bank') && ctx.coins > 3 * ctx.reserve + 200 + ctx.goal) add('bank', 8 + p.zeal * 6, bank);
  // Ngân hàng gia tộc: người gửi nhỏ so lãi với NPC; đang có khoản gửi thì thỉnh thoảng xem lại uy tín ngân hàng.
  if (ctx.unlocked('bank') && (ctx.coins > 3 * ctx.reserve + 400 + ctx.goal || state.cbank || state.bankHolder)) add('clan_bank', 4 + p.trader * 8 + (state.cbank ? 3 : 0) + (state.bankHolder ? 6 : 0), clanBank);
  if (ctx.unlocked('bank') && (ctx.coins > 3 * ctx.reserve + 600 + ctx.goal || Object.keys(state.sh ?? {}).length)) add('shares', 3 + p.trader * 8 + (Object.keys(state.sh ?? {}).length ? 3 : 0), shares);
  if (ctx.unlocked('bank') && ctx.coins > 3 * ctx.reserve + 500 + ctx.goal) add('bonds', 2 + (1 - p.trader) * 6, bondsStep);
  if (ctx.unlocked('bank') && ctx.goal && ctx.coins < ctx.goal + ctx.reserve && ctx.coins + (state.saved ?? 0) >= ctx.goal + ctx.reserve) add('bank_goal', 40, bank);
  if (ctx.unlocked('business')) {
    if (state.biz) add('stall', 16 + p.producer * 22 + (hour >= 10 && hour < 20 ? 6 : 0), stall);
    else if ((p.producer > 0.45 || p.trader > 0.75) && stallLocation(ctx)) add('stall_open', 8 + p.producer * 20, stall);
  }
  if (ctx.unlocked('garden')) {
    const due = !state.garden || state.garden.readyAt <= now;
    add('garden', due ? 10 + p.producer * 22 : 2, garden);
  }
  if (ctx.unlocked('kitchen')) add('kitchen', 4 + p.producer * 8 + (pet.fullness < 70 ? 6 : 0), kitchen);
  if (ctx.unlocked('factory')) {
    if (state.factory) add('factory', 14 + p.producer * 20, factory);
    else if (p.producer > 0.6 && factoryKind(ctx)) add('factory_build', 6 + p.producer * 12, factory);
  }
  if (ctx.unlocked('bazaar')) add('bazaar', 6 + p.trader * 10 + p.producer * 6 + (pet.fullness < 60 ? 6 : 0), bazaar);

  // Gia tộc: chưa có thì hay tìm (giờ tối đông người), đã có thì thỉnh thoảng góp quỹ, quản lý.
  // Người ít giao du (social < BRAIN.loner) thích chơi một mình, không tìm gia tộc.
  if (ctx.unlocked('clan')) {
    const looked = state.clanLook && now - state.clanLook < 2 * 3_600_000;
    if (!state.clan) {
      if (p.social >= BRAIN.loner) add('clan', looked ? 4 : 30 + p.social * 35, clanStep);
    } else add('clan', 5 + p.social * 8 + (state.clan.role !== 'member' ? 8 + p.fighter * 4 : 0), clanStep);
  }
  // Kênh chung: hiếm, câu soạn sẵn (giới hạn mỗi bot mỗi ngày và cả server mỗi giờ nằm ở bots.js).
  if (ctx.helpers.chat && ctx.rand() < (ctx.helpers.chatChance ?? 0.08) * (0.5 + p.social)) add('chat', 6, async (c) => c.helpers.chat(c));
  add('browse', 4, async () => null);
  return out;
}

/** Chọn một việc: có việc cần làm ngay thì chọn trong số đó, không thì theo trọng số điểm. */
export function pickWeighted(list, rand) {
  const needs = list.filter((c) => c.need);
  const pool = needs.length ? needs : list;
  const total = pool.reduce((s, c) => s + c.score, 0);
  let r = rand() * total;
  for (const c of pool) {
    r -= c.score;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}

/**
 * Một lượt suy nghĩ: chọn việc, làm thử; việc đầu không thành (thiếu điều kiện, hết hàng...) mà chưa ghi gì
 * thì thử một việc khác không cần đọc thêm. Trả về tên việc đã làm, 'browse' nếu chỉ xem.
 */
export async function think(ctx) {
  if (ctx.state.game) return finishGame(ctx);
  const list = candidates(ctx);
  const first = pickWeighted(list, ctx.rand);
  if (!first) return 'browse';
  const done = await first.run(ctx);
  if (done || ctx.wrote) return done ?? 'browse';
  const cheap = new Set(['feed', 'bath', 'play', 'work', 'minigame', 'school', 'toy', 'snack', 'daily', 'gear']);
  const rest = list.filter((c) => c !== first && cheap.has(c.key));
  if (!rest.length) return 'browse';
  return (await pickWeighted(rest, ctx.rand).run(ctx)) ?? 'browse';
}
