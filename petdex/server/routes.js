// node:crypto qua namespace: trên Workers scrypt có thể thiếu, chỉ được lỗi khi gọi, không lỗi lúc nạp module.
import { hashPassword, verifyPassword } from './passwords.js';
import { settings } from './settings.js';
import { Router } from './router.js';
import { DAILY_CAPS, GAMES } from '../../public/ta-tua/game/js/shared/minigames.js';
import { indexedPrice } from './bank.js';
import { dayKey, nextDay } from './clock.js';
import * as store from './db.js';
import { GameError, ITEMS, RULES, STAGES, ageInfo, isConsumable, play, useItem } from './game.js';
import { auth, reply } from './http.js';
import { KINDS, post } from './ledger.js';
import { BANK } from './rules/bank.js';
import { CAREERS, MAX_HOURS_PER_DAY, PROMOTION, RANK_TITLES, SHIFT_HOURS, SKILLS } from './rules/careers.js';
import { COMMODITIES, LOT, MARKET } from './rules/market.js';
import { BUSINESS, LOCATIONS, RECIPES, UPGRADES } from './rules/business.js';
import {
  BRACKETS, GUILD, GUILD_EMBLEMS, GUILD_PROJECTS, GUILD_UPGRADES, PROPOSALS, QUESTS, QUEST_CHEST, dailyReward,
} from './rules/town.js';
import {
  BAZAAR, CLASSES, CLINIC, CONTRACTS, CREDIT, CROPS, DISHES, FACTORIES, FACTORY, GARDEN, HEALTH, ILLNESSES, INSURANCE,
  KITCHEN, LOANS, QUALITY, SCHOOL, TIERS, TRAITS,
} from './rules/production.js';
import { communityApi } from './routes-community.js';
import { UNLOCKS, economyApi } from './routes-economy.js';
import { productionApi } from './routes-production.js';
import { clanApi } from './routes-clans.js';
import { clanConfig } from './clans.js';
import { createPet, hatch, heirloomText, incubate } from './eggs.js';
import { memorialsView, reopenSlot, slotsOf } from './lifecycle.js';
import { track } from './quests.js';
import { payStipend } from './town.js';
import { bus, mutatePet, ownedPet, snapshot } from './service.js';
import { getSpecies, listSpecies } from './species.js';
import { richList } from './wallet.js';
import { createGear, equipGear, gearConfig, openGear, quickSellGear, userBonus } from './gear.js';
import { redeemGiftCode } from './gifts.js';
import { TIERS as GEAR_TIERS, gradeLuck } from '../../public/ta-tua/game/js/shared/gear.js';
import { SLOTS } from '../../public/ta-tua/game/js/shared/pets.js';

export const api = Router();

function cleanPetName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 16) throw new GameError('Tên thú cưng dài 1–16 ký tự.');
  return name;
}

function findItem(itemId) {
  const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
  if (!item) throw new GameError('Không có món này trong cửa hàng.');
  return item;
}

function requireOwned(userId, item) {
  if (!store.inventory(userId)[item.id]) throw new GameError(`Bạn chưa có ${item.icon} ${item.name}.`);
}

function issueSession(res, userId) {
  const token = store.issueToken(userId);
  res.json({ token, ...snapshot(userId) });
}

// ---- Công khai ----

api.get('/catalog', (_req, res) => {
  // Giá món ở đây là giá gốc; client nhân với chỉ số giá trong /me để luôn khớp với giá server thu.
  res.json({
    items: ITEMS,
    species: listSpecies(),
    rules: RULES,
    gear: { tiers: GEAR_TIERS, odds: gearConfig().odds },
    unlocks: { ...UNLOCKS, clan: clanConfig().unlockLevel },
    stages: STAGES,
    skills: SKILLS,
    careers: CAREERS,
    jobs: { shiftHours: SHIFT_HOURS, maxHoursPerDay: MAX_HOURS_PER_DAY, promotion: PROMOTION, rankTitles: RANK_TITLES },
    commodities: COMMODITIES,
    market: {
      lot: LOT, fee: MARKET.fee, spread: MARKET.spread, band: MARKET.band, npcDailyLots: MARKET.npcDailyLots, townBaseLots: MARKET.townBaseLots, townLotsPerTrader: MARKET.townLotsPerTrader, warehouse: MARKET.warehouse,
      liquidity: MARKET.liquidity, processedDepth: MARKET.processedDepth, playerWeight: MARKET.playerWeight,
    },
    games: GAMES,
    gameCaps: DAILY_CAPS,
    bank: { termPremium: BANK.termPremium, savingsCap: BANK.savingsCap, minDeposit: BANK.minDeposit },
    kinds: KINDS,
    advancedFinance: settings.advancedFinance,
    business: { locations: LOCATIONS, recipes: RECIPES, upgrades: UPGRADES, rules: BUSINESS },
    town: { proposals: PROPOSALS, brackets: BRACKETS.map(([cap, rate]) => [cap === Infinity ? null : cap, rate]) },
    quests: { list: QUESTS, chest: QUEST_CHEST },
    guild: { ...GUILD, emblems: GUILD_EMBLEMS, upgrades: GUILD_UPGRADES, projects: GUILD_PROJECTS },
    care: { health: HEALTH, illnesses: ILLNESSES, clinic: CLINIC, insurance: INSURANCE, traits: TRAITS },
    school: { ...SCHOOL, classes: CLASSES },
    garden: { ...GARDEN, crops: CROPS },
    // Món ẩn không gửi xuống: người chơi phải tự khám phá trong Bếp.
    kitchen: { ...KITCHEN, quality: QUALITY, dishes: Object.fromEntries(Object.entries(DISHES).filter(([, d]) => !d.hidden)) },
    factory: { ...FACTORY, kinds: FACTORIES },
    contracts: CONTRACTS,
    bazaar: BAZAAR,
    credit: { ...CREDIT, tiers: TIERS, loans: LOANS },
  });
});

api.post('/auth/register', (req, res) => {
  if (!settings.openSignup) throw new GameError('Máy chủ này đăng nhập qua WorkHub, không tự tạo tài khoản.');
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  if (!/^[\p{L}\p{N}_]{3,20}$/u.test(username)) throw new GameError('Tên người chơi 3–20 ký tự, chỉ gồm chữ, số và dấu _.');
  if (password.length < 4) throw new GameError('Mật khẩu cần ít nhất 4 ký tự.');
  if (store.findUserByName(username)) throw new GameError('Tên này đã có người dùng.');
  const userId = store.transaction(() => {
    const id = store.createUser(username, hashPassword(password));
    post({ userId: id, delta: RULES.startCoins, kind: 'opening', memo: 'Quà chào mừng' });
    return id;
  });
  issueSession(res, userId);
});

api.post('/auth/login', (req, res) => {
  if (!settings.openSignup) throw new GameError('Máy chủ này đăng nhập qua WorkHub.');
  const user = store.findUserByName(String(req.body?.username ?? '').trim());
  if (!user || !verifyPassword(String(req.body?.password ?? ''), user.pass_hash)) {
    throw new GameError('Sai tên hoặc mật khẩu.');
  }
  issueSession(res, user.id);
});

api.get('/leaderboard', (req, res) => {
  if (req.query.by === 'networth') return res.json(richList(20));
  const now = Date.now();
  res.json(store.leaderboard(20).map((p) => ({
    id: p.id,
    name: p.name,
    species: p.species,
    level: p.level,
    xp: p.xp,
    wear: store.wearOf(p.id),
    owner: p.username,
    weeks: ageInfo(p.born_at, now).weeks,
  })));
});

// ---- Cần đăng nhập ----

api.post('/auth/logout', auth, (req, res) => {
  store.deleteSession(req.token);
  res.json({ ok: true });
});

api.get('/me', auth, (req, res) => res.json(snapshot(req.user.id)));

api.post('/daily', auth, (req, res) => {
  const now = Date.now();
  const result = store.transaction(() => {
    const user = store.getUser(req.user.id);
    const today = dayKey(now);
    if (user.daily_day === today) throw new GameError('Hôm nay bạn nhận quà rồi, mai quay lại nhé.');
    // Nhận liên tiếp mỗi ngày (giờ Việt Nam) thì chuỗi tăng, lỡ một ngày thì về 1.
    const streak = user.daily_day && nextDay(user.daily_day) === today ? user.streak + 1 : 1;
    const reward = dailyReward(streak);
    store.setDaily(user.id, now, today, streak);
    post({ userId: user.id, delta: reward, kind: 'daily', memo: `Chuỗi ${streak} ngày`, now });
    const stipend = payStipend(user.id, now);
    return {
      message: `🎁 Quà ngày (chuỗi ${streak} ngày): +${reward} 🪙${stipend ? ` · trợ cấp tân thủ +${stipend} 🪙` : ''}`,
    };
  });
  reply(res, req.user.id, result);
});

api.post('/pets', auth, (req, res) => {
  const name = cleanPetName(req.body?.name);
  const species = getSpecies(req.body?.species);
  if (!species) throw new GameError('Loài thú này chưa được cài vào công viên.');
  if (!species.adoptable) throw new GameError(`${species.name} là loài hiếm, chưa nhận nuôi trực tiếp được.`);
  const { traitText, heirloom } = store.transaction(() => {
    const owned = store.listPets(req.user.id).length;
    // Trứng đang ấp và ô tưởng niệm cũng giữ chỗ.
    if (slotsOf(req.user.id).free <= 0) throw new GameError(`Đã hết ô nuôi (tối đa ${RULES.maxPets}, tính cả trứng đang ấp và ô tưởng niệm).`);
    if (owned > 0) post({ userId: req.user.id, delta: -RULES.adoptCost, kind: 'adopt', memo: name });
    return createPet(req.user.id, name, species.id);
  });
  bus.emit('pet:changed', req.user.id);
  reply(res, req.user.id, { message: `Chào mừng ${name} về nhà! 🏡 Tính cách: ${traitText}.${heirloomText(heirloom)}` });
});

// ---- Đồi Sao & ô tưởng niệm ----

api.get('/memorials', auth, (req, res) => res.json(memorialsView(req.user.id, req.query.scope === 'all' ? 'all' : 'mine')));

api.post('/slots/reopen', auth, (req, res) => reply(res, req.user.id, reopenSlot(req.user.id)));

// ---- Trứng ngũ hành ----

api.post('/eggs/incubate', auth, (req, res) => {
  reply(res, req.user.id, incubate(req.user.id, String(req.body?.itemId ?? '')));
});

api.post('/eggs/:id/hatch', auth, (req, res) => {
  const result = hatch(req.user.id, Number(req.params.id), cleanPetName(req.body?.name));
  bus.emit('pet:changed', req.user.id);
  reply(res, req.user.id, result);
});

api.post('/pets/:id/active', auth, (req, res) => {
  const pet = ownedPet(req.user.id, req.params.id);
  store.setActivePet(req.user.id, pet.id);
  bus.emit('pet:changed', req.user.id);
  reply(res, req.user.id, { message: `${pet.name} giờ là thú cưng chính, sẽ cùng bạn ra công viên.` });
});

api.post('/pets/:id/use', auth, (req, res) => {
  const item = findItem(req.body?.itemId);
  let petName;
  const outcome = store.transaction(() => {
    store.takeItem(req.user.id, item.id, 1);
    return mutatePet(req.user.id, req.params.id, (pet) => {
      petName = pet.name;
      return useItem(pet, item);
    });
  });
  if (item.type === 'food') track(req.user.id, 'feed');
  const verb = item.type === 'food' ? 'măm măm' : 'dùng';
  reply(res, req.user.id, {
    ...outcome,
    petName,
    gain: { xp: outcome.xp },
    message: `${petName} ${verb} ${item.icon} ${item.name}. +${outcome.xp} XP`,
  });
});

api.post('/pets/:id/play', auth, (req, res) => {
  let toy = null;
  if (req.body?.toyId) {
    toy = findItem(req.body.toyId);
    if (toy.type !== 'toy') throw new GameError('Đó không phải đồ chơi.');
    requireOwned(req.user.id, toy);
  }
  let petName;
  const outcome = mutatePet(req.user.id, req.params.id, (pet) => {
    petName = pet.name;
    return play(pet, toy);
  });
  track(req.user.id, 'play');
  const how = toy ? `chơi ${toy.icon} ${toy.name}` : 'chạy nhảy tưng bừng';
  reply(res, req.user.id, {
    ...outcome,
    petName,
    gain: { xp: outcome.xp, coins: 4 },
    message: `${petName} ${how}! +${outcome.xp} XP · +4 🪙`,
  });
});

/** Đeo đồ theo khe: `{ gearId }` đeo bản trang phục đó vào khe của nó; `{ slot }` tháo khe đó; không gửi gì thì tháo hết. */
api.post('/pets/:id/equip', auth, (req, res) => {
  const pet = ownedPet(req.user.id, req.params.id);
  if (req.body?.gearId != null) {
    const { gear, item } = store.transaction(() => equipGear(req.user.id, pet, Number(req.body.gearId)));
    bus.emit('pet:changed', req.user.id);
    return reply(res, req.user.id, { petName: pet.name, message: `${pet.name} đeo ${item.icon} ${item.name} (${gear.tierName}), xinh quá!` });
  }
  const slot = req.body?.slot ? String(req.body.slot) : null;
  if (slot && !SLOTS[slot]) throw new GameError('Không có khe đồ này.');
  store.setWear(pet.id, slot, null);
  bus.emit('pet:changed', req.user.id);
  reply(res, req.user.id, { petName: pet.name, message: slot ? `${pet.name} đã tháo đồ.` : `${pet.name} đã tháo hết đồ.` });
});

/** Bán nhanh một món trang phục cho Siêu thị: thu 10–40% giá trị tùy dòng chỉ số, món mất hẳn. */
api.post('/gear/:id/quick-sell', auth, (req, res) => {
  const result = store.transaction(() => quickSellGear(req.user.id, Number(req.params.id)));
  bus.emit('pet:changed', req.user.id);
  reply(res, req.user.id, result);
});

/** Mở hộp trang phục mua ở Siêu thị: lộ 1–2 dòng chỉ số. */
api.post('/gear/:id/open', auth, (req, res) => {
  const gear = store.transaction(() => openGear(req.user.id, Number(req.params.id)));
  bus.emit('pet:changed', req.user.id);
  const item = ITEMS[gear.itemId];
  reply(res, req.user.id, {
    opened: gear,
    message: `Mở hộp ${item.icon} ${item.name}: cấp ${gear.tierName} · ${gear.lines.join(' · ')}`,
  });
});

/** Nhập mã quà (ô trong menu tên người chơi). */
api.post('/gifts/redeem', auth, (req, res) => {
  const result = redeemGiftCode(req.user.id, req.body?.code, req.body?.choice ?? null);
  bus.emit('pet:changed', req.user.id);
  reply(res, req.user.id, result);
});

api.post('/shop/buy', auth, (req, res) => {
  const item = findItem(req.body?.itemId);
  const qty = Number(req.body?.qty ?? 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new GameError('Số lượng không hợp lệ.');
  // Trang phục: mỗi lần mua là một hộp kín, trong có 1–2 dòng chỉ số ngẫu nhiên (May mắn của bé chính, và món yêu cầu cấp cao, giúp ra 2 dòng).
  if (item.type === 'accessory') {
    if (qty !== 1) throw new GameError('Trang phục mua từng món một.');
    const bestLevel = Math.max(0, ...store.listPets(req.user.id).map((p) => p.level));
    if (item.minLevel && bestLevel < item.minLevel) throw new GameError(`Cần một bé đạt cấp ${item.minLevel} để mua món này.`);
    const gear = store.transaction(() => {
      post({ userId: req.user.id, delta: -indexedPrice(item.price), kind: 'shop', memo: item.name });
      return createGear(req.user.id, item.id, { source: 'shop', shop: true, luck: userBonus(req.user.id).luck + gradeLuck(item.minLevel) });
    });
    return reply(res, req.user.id, {
      gear: gear.id,
      message: `Đã mua hộp ${item.icon} ${item.name} 🎁 Mở hộp trong Túi đồ để xem các dòng chỉ số.`,
    });
  }
  store.transaction(() => {
    const owned = store.inventory(req.user.id)[item.id] ?? 0;
    if (!isConsumable(item) && (owned > 0 || qty > 1)) throw new GameError(`Bạn đã có ${item.name} rồi, món này dùng mãi mãi.`);
    const bestLevel = Math.max(0, ...store.listPets(req.user.id).map((p) => p.level));
    if (item.minLevel && bestLevel < item.minLevel) throw new GameError(`Cần một bé đạt cấp ${item.minLevel} để mua món này.`);
    post({ userId: req.user.id, delta: -indexedPrice(item.price) * qty, kind: 'shop', memo: `${qty} × ${item.name}` });
    store.addItem(req.user.id, item.id, qty);
  });
  reply(res, req.user.id, { message: `Đã mua ${qty > 1 ? `${qty} × ` : ''}${item.icon} ${item.name}` });
});

api.use(economyApi);
api.use(communityApi);
api.use(productionApi);
api.use(clanApi);

api.use('/{*rest}', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));

api.use((err, _req, res, _next) => {
  if (err instanceof GameError) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' });
  console.error(err);
  res.status(500).json({ error: 'Máy chủ gặp sự cố, thử lại sau nhé.' });
});
