// Quầy trà sữa: mở quầy, thực đơn, bán hàng tính bù theo giờ, tiền thuê, tuyển nhân viên, báo cáo.
import { db, getUser, skillsOf, transaction } from './db.js';
import { economy, indexedPrice } from './bank.js';
import { dayKey, startOfDay } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { chargeTax, post } from './ledger.js';
import { removeGoods, stock } from './market.js';
import {
  BUSINESS, LOCATIONS, RECIPES, UPGRADES, appeal, customersPerHour, menuSlots, nextReputation, refPrice,
  staffCapacity, unitCost, upgradeCost,
} from './rules/business.js';
import { GUILD_UPGRADES } from './rules/town.js';
import { CREDIT } from './rules/production.js';
import { addCredit } from './credit.js';
import { isElement } from './elements.js';
import { ELEMENT_RULES } from '../../public/ta-tua/game/js/shared/pets.js';
import { track } from './quests.js';
import { effectsBetween, trafficBonus } from './town.js';

const q = {
  byOwner: db.prepare('SELECT * FROM businesses WHERE owner_id = ? AND closed_at IS NULL'),
  byId: db.prepare('SELECT * FROM businesses WHERE id = ?'),
  openAll: db.prepare('SELECT * FROM businesses WHERE closed_at IS NULL'),
  everOwned: db.prepare('SELECT id FROM businesses WHERE owner_id = ?'),
  insert: db.prepare(`
    INSERT INTO businesses (owner_id, name, location, menu, sim_at, opened_at) VALUES (?, ?, ?, ?, ?, ?)`),
  save: db.prepare(`
    UPDATE businesses SET reputation = ?, menu = ?, upgrades = ?, promo_until = ?, unpaid_days = ?, sim_at = ? WHERE id = ?`),
  close: db.prepare('UPDATE businesses SET closed_at = ? WHERE id = ?'),
  addDay: db.prepare(`
    INSERT INTO business_days (business_id, day, cups, customers, lost, revenue, cogs, rent, wages, tax)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (business_id, day) DO UPDATE SET cups = cups + excluded.cups, customers = customers + excluded.customers,
      lost = lost + excluded.lost, revenue = revenue + excluded.revenue, cogs = cogs + excluded.cogs,
      rent = rent + excluded.rent, wages = wages + excluded.wages, tax = tax + excluded.tax`),
  days: db.prepare('SELECT * FROM business_days WHERE business_id = ? AND day >= ? ORDER BY day'),
  duty: db.prepare(`
    SELECT s.*, p.name AS pet_name, p.traits AS pet_traits, p.species AS pet_species, u.username FROM shifts s JOIN pets p ON p.id = s.pet_id JOIN users u ON u.id = s.user_id
    WHERE s.business_id = ? AND s.starts_at < ? AND s.ends_at > ? ORDER BY s.ends_at`),
  post: db.prepare('SELECT * FROM job_posts WHERE business_id = ?'),
  savePost: db.prepare(`
    INSERT INTO job_posts (business_id, wage, slots, open) VALUES (?, ?, ?, ?)
    ON CONFLICT (business_id) DO UPDATE SET wage = excluded.wage, slots = excluded.slots, open = excluded.open`),
  openPosts: db.prepare(`
    SELECT b.id, b.name, b.location, b.reputation, b.owner_id, u.username, j.wage, j.slots,
      (SELECT COUNT(*) FROM shifts s WHERE s.business_id = b.id AND s.user_id != b.owner_id AND s.ends_at > ?) AS hired
    FROM job_posts j JOIN businesses b ON b.id = j.business_id JOIN users u ON u.id = b.owner_id
    WHERE j.open = 1 AND b.closed_at IS NULL AND b.owner_id != ? ORDER BY j.wage DESC`),
  guildUpgrades: db.prepare('SELECT g.upgrades FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.user_id = ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const parse = (row) => row && { ...row, menu: JSON.parse(row.menu), upgrades: JSON.parse(row.upgrades) };
const persist = (b) => q.save.run(b.reputation, JSON.stringify(b.menu), JSON.stringify(b.upgrades), b.promo_until, b.unpaid_days, b.sim_at, b.id);

function signBonus(userId) {
  const row = q.guildUpgrades.get(userId);
  return row ? (JSON.parse(row.upgrades).sign ?? 0) * GUILD_UPGRADES.sign.per : 0;
}

export const businessOf = (userId) => parse(q.byOwner.get(userId));

function mustOwn(userId) {
  const biz = businessOf(userId);
  if (!biz) throw new GameError('Bạn chưa có quầy nào.');
  return biz;
}

/** Làm tròn ngẫu nhiên để 2,4 ly/giờ thành 2 hoặc 3 ly mà bình quân vẫn đúng. */
const stochasticRound = (x, rand) => Math.floor(x) + (rand() < x - Math.floor(x) ? 1 : 0);

/**
 * Tính bù bán hàng của quầy từ sim_at tới `to`, theo từng giờ: chỉ bán khi có bé trực,
 * khách chia theo độ hấp dẫn giá của từng món, giới hạn bởi công suất và nguyên liệu trong kho của chủ.
 */
export function simulate(biz, to, rand = Math.random) {
  if (to <= biz.sim_at) return { cups: 0, revenue: 0 };
  const owner = biz.owner_id;
  const index = economy().priceIndex;
  const goods = stock(owner, to);
  const used = {};
  const shifts = q.duty.all(biz.id, to, biz.sim_at).map((s) => ({ ...s, craft: skillsOf(s.pet_id).craft ?? 0 }));
  const effects = effectsBetween(biz.sim_at, to);
  const sign = signBonus(owner);
  const counter = biz.upgrades.counter ?? 0;
  const items = biz.menu.map((m) => ({ ...m, ref: refPrice(m.recipe, index), cost: unitCost(m.recipe, index) }));
  for (const item of items) item.appeal = appeal(item.price, item.ref);
  const totalAppeal = items.reduce((s, i) => s + i.appeal, 0);
  const menuAppeal = items.length ? totalAppeal / items.length : 0;
  const priceRatio = items.length ? items.reduce((s, i) => s + i.price / i.ref, 0) / items.length : 1;
  const days = new Map();
  let cupsTotal = 0;

  for (let t = biz.sim_at; t < to;) {
    const end = Math.min(to, Math.floor(t / HOUR) * HOUR + HOUR);
    const onDuty = shifts.filter((s) => s.starts_at < end && s.ends_at > t);
    if (onDuty.length && items.length) {
      const overlap = (s) => (Math.min(end, s.ends_at) - Math.max(t, s.starts_at)) / HOUR;
      const covered = Math.max(...onDuty.map(overlap));
      let capacity = onDuty.reduce((sum, s) => sum + staffCapacity(s.craft, counter) * overlap(s), 0);
      const wanted = customersPerHour({
        location: biz.location,
        hourVN: new Date(t + 7 * HOUR).getUTCHours(),
        reputation: biz.reputation,
        decorLevel: biz.upgrades.decor ?? 0,
        promo: biz.promo_until > t,
        // Bé "Có duyên" đứng quầy thì kéo thêm 10% khách.
        bonus: trafficBonus(effects, biz.location, t) + sign + (onDuty.some((s) => s.pet_traits?.includes('charming')) ? 0.1 : 0)
          + (onDuty.some((s) => isElement(s.pet_species, 'thuy')) ? ELEMENT_RULES.perks.thuy.customers : 0),
        menuAppeal,
      }) * covered * (0.85 + rand() * 0.3);
      const day = dayKey(t);
      const d = days.get(day) ?? { cups: 0, customers: 0, lost: 0, revenue: 0, cogs: 0 };
      let served = 0;
      for (const item of items) {
        const inputs = Object.entries(RECIPES[item.recipe].inputs);
        const canMake = Math.min(...inputs.map(([c, n]) => Math.floor((goods[c] ?? 0) / n)));
        const cups = Math.max(0, Math.min(stochasticRound((wanted * item.appeal) / totalAppeal, rand), canMake, Math.floor(capacity + 0.5)));
        if (!cups) continue;
        for (const [c, n] of inputs) {
          goods[c] -= cups * n;
          used[c] = (used[c] ?? 0) + cups * n;
        }
        capacity -= cups;
        served += cups;
        d.cups += cups;
        d.revenue += cups * item.price;
        d.cogs += cups * item.cost;
      }
      d.customers += wanted;
      d.lost += Math.max(0, wanted - served);
      days.set(day, d);
      cupsTotal += served;
      biz.reputation = nextReputation(biz.reputation, { served, wanted, priceRatio });
    }
    t = end;
  }

  for (const [c, qty] of Object.entries(used)) if (qty > 0) removeGoods(owner, c, qty, to);
  let revenue = 0;
  for (const [day, d] of days) {
    const tax = Math.round(d.revenue * BUSINESS.revenueTax);
    q.addDay.run(biz.id, day, d.cups, Math.round(d.customers), Math.round(d.lost), d.revenue, Math.round(d.cogs), 0, 0, tax);
    if (d.revenue > 0) {
      post({ userId: owner, delta: d.revenue, kind: 'business_income', memo: `${biz.name}: ${d.cups} ly`, now: to });
      chargeTax(owner, Math.min(tax, d.revenue), `Thuế doanh thu ${biz.name}`, to);
    }
    revenue += d.revenue;
  }
  biz.sim_at = to;
  persist(biz);
  if (cupsTotal) track(owner, 'serve', cupsTotal, to);
  return { cups: cupsTotal, revenue };
}

/** Tính bù quầy của người chơi tới hiện tại (gọi trước khi xem hoặc thay đổi quầy). */
export function syncBusiness(userId, now = Date.now(), rand = Math.random) {
  return transaction(() => {
    const biz = businessOf(userId);
    return biz ? { biz, ...simulate(biz, now, rand) } : null;
  });
}

export function openBusiness(userId, { name, location }, now = Date.now()) {
  const loc = LOCATIONS[location];
  if (!loc) throw new GameError('Không có vị trí này.');
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length < 2 || clean.length > 24) throw new GameError('Tên quầy dài 2–24 ký tự.');
  return transaction(() => {
    if (businessOf(userId)) throw new GameError('Mỗi người chỉ mở một quầy.');
    const index = economy().priceIndex;
    const license = Math.round(loc.license * index);
    post({ userId, delta: -license, kind: 'license', memo: `${clean} · ${loc.name}`, now });
    const menu = [{ recipe: 'boba_milk_tea', price: refPrice('boba_milk_tea', index) }];
    q.insert.run(userId, clean, location, JSON.stringify(menu), now, now);
    return { message: `🎉 Khai trương "${clean}" ở ${loc.name}! Nhập nguyên liệu vào kho và cho bé trực quầy để bắt đầu bán.` };
  });
}

export function setMenu(userId, menu, now = Date.now()) {
  if (!Array.isArray(menu)) throw new GameError('Thực đơn không hợp lệ.');
  return transaction(() => {
    const biz = mustOwn(userId);
    simulate(biz, now);
    if (menu.length > menuSlots(biz.upgrades)) throw new GameError(`Thực đơn hiện có tối đa ${menuSlots(biz.upgrades)} món.`);
    const index = economy().priceIndex;
    const seen = new Set();
    biz.menu = menu.map((m) => {
      if (!RECIPES[m?.recipe]) throw new GameError('Có món không hợp lệ.');
      if (seen.has(m.recipe)) throw new GameError('Mỗi món chỉ có một lần trong thực đơn.');
      seen.add(m.recipe);
      const price = Number(m.price);
      const max = refPrice(m.recipe, index) * 3;
      if (!Number.isInteger(price) || price < 1 || price > max) throw new GameError(`Giá ${RECIPES[m.recipe].name} phải từ 1 đến ${max} xu.`);
      return { recipe: m.recipe, price };
    });
    persist(biz);
    return { message: 'Đã cập nhật thực đơn.' };
  });
}

export function buyUpgrade(userId, key, now = Date.now()) {
  if (!UPGRADES[key]) throw new GameError('Không có nâng cấp này.');
  return transaction(() => {
    const biz = mustOwn(userId);
    simulate(biz, now);
    const level = biz.upgrades[key] ?? 0;
    const cost = upgradeCost(key, level);
    if (cost === null) throw new GameError('Đã nâng cấp tối đa.');
    post({ userId, delta: -indexedPrice(cost), kind: 'biz_upgrade', memo: `${UPGRADES[key].name} cấp ${level + 1}`, now });
    biz.upgrades[key] = level + 1;
    persist(biz);
    return { message: `${UPGRADES[key].name} lên cấp ${level + 1}.` };
  });
}

export function promote(userId, now = Date.now()) {
  return transaction(() => {
    const biz = mustOwn(userId);
    simulate(biz, now);
    const cost = indexedPrice(LOCATIONS[biz.location].promo);
    post({ userId, delta: -cost, kind: 'marketing', memo: biz.name, now });
    biz.promo_until = Math.max(now, biz.promo_until) + BUSINESS.promoHours * HOUR;
    persist(biz);
    return { message: `📣 Quảng cáo chạy thêm ${BUSINESS.promoHours} giờ: khách đông hơn ${BUSINESS.promoBoost * 100}%.` };
  });
}

export function setJobPost(userId, { wage, slots, open }, now = Date.now()) {
  if (!Number.isInteger(wage) || wage < BUSINESS.wageMin || wage > BUSINESS.wageMax) {
    throw new GameError(`Lương mỗi giờ từ ${BUSINESS.wageMin} đến ${BUSINESS.wageMax} xu.`);
  }
  if (!Number.isInteger(slots) || slots < 1 || slots > BUSINESS.maxStaffSlots) throw new GameError(`Tuyển 1–${BUSINESS.maxStaffSlots} người.`);
  return transaction(() => {
    const biz = mustOwn(userId);
    q.savePost.run(biz.id, wage, slots, open ? 1 : 0);
    return { message: open ? `Đã đăng tin tuyển ${slots} người, ${wage} 🪙/giờ.` : 'Đã đóng tin tuyển dụng.' };
  });
}

export function closeBusiness(userId, now = Date.now()) {
  return transaction(() => {
    const biz = mustOwn(userId);
    simulate(biz, now);
    q.close.run(now, biz.id);
    q.savePost.run(biz.id, BUSINESS.wageMin, 1, 0);
    return { message: `Đã đóng cửa "${biz.name}". Giấy phép không được hoàn lại.` };
  });
}

/** Tin tuyển dụng đang mở ở quầy của người khác, còn chỗ trống. */
export function openJobs(userId, now = Date.now()) {
  return q.openPosts.all(now, userId)
    .filter((p) => p.hired < p.slots)
    .map((p) => ({ businessId: p.id, name: p.name, location: p.location, owner: p.username, wage: p.wage, free: p.slots - p.hired, reputation: p.reputation }));
}

/** Dùng bởi Trung tâm việc làm khi một bé nhận ca ở quầy. Trả về { wage, ownShift, business }. */
export function shiftTerms(userId, businessId, now = Date.now()) {
  const biz = parse(q.byId.get(businessId));
  if (!biz || biz.closed_at) throw new GameError('Quầy này đã đóng cửa.');
  if (biz.owner_id === userId) return { wage: 0, ownShift: true, business: biz };
  const job = q.post.get(biz.id);
  const free = openJobs(userId, now).find((p) => p.businessId === biz.id);
  if (!job?.open || !free) throw new GameError('Quầy này không còn tuyển người.');
  return { wage: job.wage, ownShift: false, business: biz };
}

/** Ghi tiền lương đã trả vào báo cáo của quầy. */
export const recordWages = (businessId, amount, now) => q.addDay.run(businessId, dayKey(now), 0, 0, 0, 0, 0, 0, amount, 0);

export function businessView(userId, now = Date.now()) {
  const synced = syncBusiness(userId, now);
  if (!synced) return { business: null, locations: LOCATIONS };
  const biz = synced.biz;
  const index = economy().priceIndex;
  const goods = stock(biz.owner_id, now);
  const today = dayKey(now);
  const from = dayKey(now - 6 * DAY);
  const days = q.days.all(biz.id, from);
  const duty = q.duty.all(biz.id, now + 365 * DAY, now).map((s) => ({
    petName: s.pet_name, owner: s.username, own: s.user_id === userId, startsAt: s.starts_at, endsAt: s.ends_at, wage: s.wage,
  }));
  return {
    business: {
      id: biz.id,
      name: biz.name,
      location: biz.location,
      reputation: biz.reputation,
      promoUntil: biz.promo_until,
      unpaidDays: biz.unpaid_days,
      slots: menuSlots(biz.upgrades),
      upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => {
        const level = biz.upgrades[k] ?? 0;
        const cost = upgradeCost(k, level);
        return [k, { level, max: UPGRADES[k].costs.length, next: cost === null ? null : indexedPrice(cost) }];
      })),
      menu: biz.menu.map((m) => {
        const inputs = RECIPES[m.recipe].inputs;
        return {
          ...m,
          ref: refPrice(m.recipe, index),
          cost: Math.round(unitCost(m.recipe, index) * 10) / 10,
          stock: Math.min(...Object.entries(inputs).map(([c, n]) => Math.floor((goods[c] ?? 0) / n))),
        };
      }),
      rent: indexedPrice(LOCATIONS[biz.location].rent),
      promoCost: indexedPrice(LOCATIONS[biz.location].promo),
      openNow: duty.some((d) => d.startsAt <= now),
      duty,
      jobPost: q.post.get(biz.id) ?? null,
      today: days.find((d) => d.day === today) ?? null,
      days: days.map((d) => ({ ...d, profit: d.revenue - d.cogs - d.rent - d.wages - d.tax })),
    },
    recipes: Object.fromEntries(Object.entries(RECIPES).map(([id, r]) => [id, { ...r, ref: refPrice(id, index), cost: Math.round(unitCost(id, index) * 10) / 10 }])),
    goods,
    locations: LOCATIONS,
  };
}

/** Quyết toán cuối ngày: tính bù tới nửa đêm, thu tiền thuê; nợ 3 đêm liền thì đóng cửa. */
export function settleBusinessDay(day, rand = Math.random) {
  const end = startOfDay(day) + DAY;
  transaction(() => {
    for (const row of q.openAll.all()) {
      const biz = parse(row);
      simulate(biz, end, rand);
      const rent = indexedPrice(LOCATIONS[biz.location].rent);
      const owner = getUser(biz.owner_id);
      if (owner.coins >= rent) {
        post({ userId: biz.owner_id, delta: -rent, kind: 'rent', memo: biz.name, now: end - 1 });
        q.addDay.run(biz.id, day, 0, 0, 0, 0, 0, rent, 0, 0);
        biz.unpaid_days = 0;
      } else {
        biz.unpaid_days += 1;
      }
      persist(biz);
      if (biz.unpaid_days >= BUSINESS.unpaidLimit) {
        q.close.run(end, biz.id);
        addCredit(biz.owner_id, CREDIT.evicted, `Quầy "${biz.name}" bị đóng vì nợ tiền thuê`, end - 1);
        q.insertNews.run(`Quầy "${biz.name}" đóng cửa vì nợ tiền thuê ${BUSINESS.unpaidLimit} ngày`, end, end, end + 2 * DAY);
      }
    }
  });
}
