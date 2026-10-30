// Khu công nghiệp: xây xưởng chế biến, bé đứng máy theo ca, gia công thuê cho người khác, tiền thuê đất mỗi đêm.
import { db, getUser, skillsOf, transaction } from './db.js';
import { indexedPrice } from './bank.js';
import { dayKey, startOfDay } from './clock.js';
import { DAY, GameError, HOUR } from './game.js';
import { post } from './ledger.js';
import { addGoods, capacityOf, freeSpace, removeGoods, stock } from './market.js';
import { LOT } from './rules/market.js';
import { CREDIT, FACTORIES, FACTORY, batchesPerHour } from './rules/production.js';
import { BUSINESS } from './rules/business.js';
import { addCredit } from './credit.js';
import { isElement } from './elements.js';
import { ELEMENT_RULES } from '../../public/ta-tua/game/js/shared/pets.js';

const MAX_FACTORIES = 2;

const q = {
  mine: db.prepare('SELECT * FROM factories WHERE owner_id = ? AND closed_at IS NULL ORDER BY id'),
  byId: db.prepare('SELECT * FROM factories WHERE id = ?'),
  openAll: db.prepare('SELECT * FROM factories WHERE closed_at IS NULL'),
  insert: db.prepare('INSERT INTO factories (owner_id, kind, sim_at, built_at) VALUES (?, ?, ?, ?)'),
  save: db.prepare('UPDATE factories SET level = ?, toll_fee = ?, toll_open = ?, unpaid_days = ?, sim_at = ? WHERE id = ?'),
  close: db.prepare('UPDATE factories SET closed_at = ? WHERE id = ?'),
  addDay: db.prepare(`
    INSERT INTO factory_days (factory_id, day, batches, toll_batches, toll_income, rent, wages) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (factory_id, day) DO UPDATE SET batches = batches + excluded.batches, toll_batches = toll_batches + excluded.toll_batches,
      toll_income = toll_income + excluded.toll_income, rent = rent + excluded.rent, wages = wages + excluded.wages`),
  days: db.prepare('SELECT * FROM factory_days WHERE factory_id = ? AND day >= ? ORDER BY day'),
  duty: db.prepare(`
    SELECT s.*, p.name AS pet_name, p.species AS pet_species, u.username FROM shifts s JOIN pets p ON p.id = s.pet_id JOIN users u ON u.id = s.user_id
    WHERE s.factory_id = ? AND s.starts_at < ? AND s.ends_at > ? ORDER BY s.ends_at`),
  post: db.prepare('SELECT * FROM factory_jobs WHERE factory_id = ?'),
  savePost: db.prepare(`
    INSERT INTO factory_jobs (factory_id, wage, slots, open) VALUES (?, ?, ?, ?)
    ON CONFLICT (factory_id) DO UPDATE SET wage = excluded.wage, slots = excluded.slots, open = excluded.open`),
  openPosts: db.prepare(`
    SELECT f.id, f.kind, f.owner_id, u.username, j.wage, j.slots,
      (SELECT COUNT(*) FROM shifts s WHERE s.factory_id = f.id AND s.user_id != f.owner_id AND s.ends_at > ?) AS hired
    FROM factory_jobs j JOIN factories f ON f.id = j.factory_id JOIN users u ON u.id = f.owner_id
    WHERE j.open = 1 AND f.closed_at IS NULL AND f.owner_id != ? ORDER BY j.wage DESC`),
  tollFactories: db.prepare(`
    SELECT f.*, u.username FROM factories f JOIN users u ON u.id = f.owner_id
    WHERE f.toll_open = 1 AND f.closed_at IS NULL AND f.owner_id != ? ORDER BY f.toll_fee`),
  tollQueue: db.prepare("SELECT * FROM toll_orders WHERE factory_id = ? AND status = 'open' ORDER BY id"),
  myTolls: db.prepare("SELECT t.*, f.kind, u.username FROM toll_orders t JOIN factories f ON f.id = t.factory_id JOIN users u ON u.id = f.owner_id WHERE t.user_id = ? AND t.status = 'open'"),
  toll: db.prepare('SELECT * FROM toll_orders WHERE id = ?'),
  insertToll: db.prepare("INSERT INTO toll_orders (factory_id, user_id, batches, fee, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)"),
  saveToll: db.prepare('UPDATE toll_orders SET done = ?, status = ? WHERE id = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const tollAccount = (id) => `toll:${id}`;
const persist = (f) => q.save.run(f.level, f.toll_fee, f.toll_open, f.unpaid_days, f.sim_at, f.id);
const stochasticRound = (x, rand) => Math.floor(x) + (rand() < x - Math.floor(x) ? 1 : 0);
const lotsOf = (spec, n = 1) => Object.entries(spec).map(([c, lots]) => [c, lots * LOT * n]);

function mustOwn(userId, factoryId) {
  const f = q.byId.get(factoryId);
  if (!f || f.owner_id !== userId || f.closed_at) throw new GameError('Không tìm thấy xưởng của bạn.');
  return f;
}

/**
 * Chạy bù xưởng tới `to`: chỉ chạy khi có bé đứng máy. Mỗi giờ làm được số mẻ theo cấp và kỹ năng;
 * đơn gia công thuê được làm trước (nguyên liệu đã gửi sẵn), sau đó tới nguyên liệu trong kho của chủ.
 */
export function simulateFactory(f, to, rand = Math.random) {
  if (to <= f.sim_at) return 0;
  const def = FACTORIES[f.kind];
  const shifts = q.duty.all(f.id, to, f.sim_at).map((s) => {
    const sk = skillsOf(s.pet_id);
    return { ...s, strength: sk.strength ?? 0, craft: sk.craft ?? 0 };
  });
  const queue = q.tollQueue.all(f.id);
  const goods = stock(f.owner_id, to);
  const ownMax = Math.min(...lotsOf(def.input).map(([c, need]) => Math.floor((goods[c] ?? 0) / need)));
  let ownLeft = ownMax;
  let ownDone = 0;
  const days = new Map();
  for (let t = f.sim_at; t < to;) {
    const end = Math.min(to, Math.floor(t / HOUR) * HOUR + HOUR);
    const onDuty = shifts.filter((s) => s.starts_at < end && s.ends_at > t);
    if (onDuty.length) {
      const covered = Math.max(...onDuty.map((s) => (Math.min(end, s.ends_at) - Math.max(t, s.starts_at)) / HOUR));
      const best = onDuty.reduce((a, s) => ((s.strength + s.craft) > (a.strength + a.craft) ? s : a));
      // Bé hành Kim đứng máy: xưởng chạy thêm 10% mẻ.
      const kim = isElement(best.pet_species, 'kim') ? 1 + ELEMENT_RULES.perks.kim.factory : 1;
      let batches = stochasticRound(batchesPerHour(f.kind, f.level, best.strength, best.craft) * covered * kim, rand);
      const d = days.get(dayKey(t)) ?? { batches: 0, toll: 0, income: 0 };
      for (const order of queue) {
        if (!batches) break;
        const n = Math.min(batches, order.batches - order.done);
        if (n <= 0) continue;
        order.done += n;
        batches -= n;
        d.toll += n;
        d.income += n * order.fee;
        order.dirty = true;
      }
      const own = Math.min(batches, ownLeft);
      ownLeft -= own;
      ownDone += own;
      d.batches += own;
      days.set(dayKey(t), d);
    }
    t = end;
  }

  // Hàng thành phẩm của đơn gia công về kho người đặt, phí gia công chuyển cho chủ xưởng.
  // Kho người đặt đầy thì các mẻ không chứa được coi như chưa làm: nguyên liệu và phí vẫn nằm trong đơn.
  const perBatch = lotsOf(def.output).reduce((s, [, qty]) => s + qty, 0);
  for (const order of queue.filter((o) => o.dirty)) {
    const before = q.toll.get(order.id).done;
    const newly = Math.min(order.done - before, Math.floor(Math.max(0, freeSpace(order.user_id)) / perBatch));
    order.done = before + newly;
    if (newly <= 0) continue;
    for (const [c, qty] of lotsOf(def.output, newly)) addGoods(order.user_id, c, qty, to);
    const fee = newly * order.fee;
    if (fee > 0) {
      post({ account: tollAccount(order.id), delta: -fee, kind: 'escrow_release', memo: def.name, now: to });
      post({ userId: f.owner_id, delta: fee, kind: 'toll_income', memo: `${def.name}: ${newly} mẻ`, now: to });
    }
    q.saveToll.run(order.done, order.done >= order.batches ? 'done' : 'open', order.id);
  }
  // Mẻ của chủ: lấy nguyên liệu trong kho, thành phẩm mang giá vốn của nguyên liệu.
  if (ownDone > 0) {
    let basis = 0;
    for (const [c, qty] of lotsOf(def.input, ownDone)) basis += removeGoods(f.owner_id, c, qty, to).cost * qty;
    const outputs = lotsOf(def.output, ownDone);
    const outQty = outputs.reduce((s, [, qty]) => s + qty, 0);
    for (const [c, qty] of outputs) addGoods(f.owner_id, c, qty, to, { allowPartial: true, cost: basis / outQty });
  }
  for (const [day, d] of days) q.addDay.run(f.id, day, d.batches, d.toll, d.income, 0, 0);
  f.sim_at = to;
  persist(f);
  return ownDone;
}

export function syncFactories(userId, now = Date.now(), rand = Math.random) {
  transaction(() => {
    for (const f of q.mine.all(userId)) simulateFactory(f, now, rand);
  });
}

export function buildFactory(userId, kind, now = Date.now()) {
  const def = FACTORIES[kind];
  if (!def) throw new GameError('Không có loại xưởng này.');
  return transaction(() => {
    if (q.mine.all(userId).length >= MAX_FACTORIES) throw new GameError(`Mỗi người có tối đa ${MAX_FACTORIES} xưởng.`);
    post({ userId, delta: -indexedPrice(def.build), kind: 'factory_build', memo: def.name, now });
    q.insert.run(userId, kind, now, now);
    return { message: `🏭 Đã xây ${def.name}! Cho bé đứng máy và để nguyên liệu trong kho là xưởng chạy.` };
  });
}

export function upgradeFactory(userId, factoryId, now = Date.now()) {
  return transaction(() => {
    const f = mustOwn(userId, factoryId);
    simulateFactory(f, now);
    const cost = FACTORY.upgradeCosts[f.level];
    if (cost === undefined) throw new GameError('Xưởng đã nâng cấp tối đa.');
    post({ userId, delta: -indexedPrice(cost), kind: 'factory_upgrade', memo: `${FACTORIES[f.kind].name} lên cấp ${f.level + 2}`, now });
    f.level += 1;
    persist(f);
    return { message: `Xưởng lên cấp ${f.level + 1}: +${FACTORY.perLevel} mẻ mỗi giờ.` };
  });
}

export function setToll(userId, factoryId, { fee, open }, now = Date.now()) {
  if (!Number.isInteger(fee) || fee < 0 || fee > FACTORY.maxTollFee) throw new GameError(`Phí gia công từ 0 đến ${FACTORY.maxTollFee} xu mỗi mẻ.`);
  return transaction(() => {
    const f = mustOwn(userId, factoryId);
    simulateFactory(f, now);
    Object.assign(f, { toll_fee: fee, toll_open: open ? 1 : 0 });
    persist(f);
    return { message: open ? `Đã nhận gia công thuê: ${fee} 🪙/mẻ.` : 'Đã ngừng nhận gia công.' };
  });
}

export function setFactoryJobs(userId, factoryId, { wage, slots, open }) {
  if (!Number.isInteger(wage) || wage < BUSINESS.wageMin || wage > BUSINESS.wageMax) throw new GameError(`Lương mỗi giờ từ ${BUSINESS.wageMin} đến ${BUSINESS.wageMax} xu.`);
  if (!Number.isInteger(slots) || slots < 1 || slots > 3) throw new GameError('Tuyển 1–3 người.');
  return transaction(() => {
    const f = mustOwn(userId, factoryId);
    q.savePost.run(f.id, wage, slots, open ? 1 : 0);
    return { message: open ? `Đã đăng tin tuyển công nhân ${wage} 🪙/giờ.` : 'Đã đóng tin tuyển công nhân.' };
  });
}

/** Gửi nguyên liệu nhờ xưởng người khác chế biến: nguyên liệu rời kho ngay, phí giữ trước, xong mẻ nào trả mẻ đó. */
export function orderToll(userId, factoryId, batches, now = Date.now()) {
  if (!Number.isInteger(batches) || batches < 1 || batches > 100) throw new GameError('Số mẻ từ 1 đến 100.');
  return transaction(() => {
    const f = q.byId.get(factoryId);
    if (!f || f.closed_at || !f.toll_open) throw new GameError('Xưởng này không nhận gia công.');
    if (f.owner_id === userId) throw new GameError('Xưởng của mình thì cứ để nguyên liệu trong kho là được.');
    const def = FACTORIES[f.kind];
    for (const [c, qty] of lotsOf(def.input, batches)) removeGoods(userId, c, qty, now);
    const id = Number(q.insertToll.run(f.id, userId, batches, f.toll_fee, now).lastInsertRowid);
    const fee = f.toll_fee * batches;
    if (fee > 0) {
      post({ userId, delta: -fee, kind: 'toll_fee', memo: `${def.name}: ${batches} mẻ`, now });
      post({ account: tollAccount(id), delta: fee, kind: 'toll_fee', memo: getUser(userId).username, now });
    }
    return { message: `Đã gửi ${batches} mẻ cho ${def.name} của ${getUser(f.owner_id).username}.` };
  });
}

export function cancelToll(userId, orderId, now = Date.now()) {
  return transaction(() => {
    const o = q.toll.get(orderId);
    if (!o || o.user_id !== userId || o.status !== 'open') throw new GameError('Không tìm thấy đơn gia công.');
    const f = q.byId.get(o.factory_id);
    simulateFactory(f, now);
    const fresh = q.toll.get(orderId);
    const left = fresh.batches - fresh.done;
    for (const [c, qty] of lotsOf(FACTORIES[f.kind].input, left)) addGoods(userId, c, qty, now, { allowPartial: true });
    const refund = q.account.get(tollAccount(o.id))?.balance ?? 0;
    if (refund > 0) {
      post({ account: tollAccount(o.id), delta: -refund, kind: 'escrow_release', now });
      post({ userId, delta: refund, kind: 'toll_fee', memo: 'Hoàn phí đơn gia công đã hủy', now });
    }
    q.saveToll.run(fresh.done, 'cancelled', o.id);
    return { message: `Đã hủy đơn, nhận lại nguyên liệu của ${left} mẻ chưa làm.` };
  });
}

export function closeFactory(userId, factoryId, now = Date.now()) {
  return transaction(() => {
    const f = mustOwn(userId, factoryId);
    simulateFactory(f, now);
    if (q.tollQueue.all(f.id).length) throw new GameError('Còn đơn gia công đang chờ, làm xong hoặc đợi khách hủy đã.');
    q.close.run(now, f.id);
    q.savePost.run(f.id, BUSINESS.wageMin, 1, 0);
    return { message: `Đã đóng ${FACTORIES[f.kind].name}.` };
  });
}

export function openFactoryJobs(userId, now = Date.now()) {
  return q.openPosts.all(now, userId).filter((p) => p.hired < p.slots).map((p) => ({
    factoryId: p.id, kind: p.kind, name: FACTORIES[p.kind].name, owner: p.username, wage: p.wage, free: p.slots - p.hired,
  }));
}

/** Dùng bởi Trung tâm việc làm khi bé nhận ca đứng máy. */
export function factoryShiftTerms(userId, factoryId, now = Date.now()) {
  const f = q.byId.get(factoryId);
  if (!f || f.closed_at) throw new GameError('Xưởng này đã đóng cửa.');
  const name = FACTORIES[f.kind].name;
  if (f.owner_id === userId) return { wage: 0, ownShift: true, factory: f, name };
  const job = q.post.get(f.id);
  if (!job?.open || !openFactoryJobs(userId, now).some((p) => p.factoryId === f.id)) throw new GameError('Xưởng này không còn tuyển người.');
  return { wage: job.wage, ownShift: false, factory: f, name };
}

export const recordFactoryWages = (factoryId, amount, now) => q.addDay.run(factoryId, dayKey(now), 0, 0, 0, 0, amount);

export function factoryView(userId, now = Date.now()) {
  syncFactories(userId, now);
  // Chạy bù cả các xưởng đang gia công cho mình, để tiến độ đơn hàng không đứng yên chờ chủ xưởng mở màn.
  transaction(() => {
    for (const id of new Set(q.myTolls.all(userId).map((o) => o.factory_id))) simulateFactory(q.byId.get(id), now);
  });
  const goods = stock(userId, now);
  const from = dayKey(now - 6 * DAY);
  return {
    factories: q.mine.all(userId).map((f) => {
      const def = FACTORIES[f.kind];
      const canRun = Math.min(...lotsOf(def.input).map(([c, need]) => Math.floor((goods[c] ?? 0) / need)));
      return {
        id: f.id,
        kind: f.kind,
        level: f.level,
        nextUpgrade: FACTORY.upgradeCosts[f.level] === undefined ? null : indexedPrice(FACTORY.upgradeCosts[f.level]),
        tollFee: f.toll_fee,
        tollOpen: Boolean(f.toll_open),
        unpaidDays: f.unpaid_days,
        rent: indexedPrice(FACTORY.landRent),
        canRun,
        duty: q.duty.all(f.id, now + 365 * DAY, now).map((s) => ({ petName: s.pet_name, owner: s.username, own: s.user_id === userId, startsAt: s.starts_at, endsAt: s.ends_at })),
        queue: q.tollQueue.all(f.id).map((o) => ({ id: o.id, batches: o.batches, done: o.done, fee: o.fee, user: getUser(o.user_id)?.username })),
        jobPost: q.post.get(f.id) ?? null,
        days: q.days.all(f.id, from),
      };
    }),
    tollOffers: q.tollFactories.all(userId).map((f) => ({ id: f.id, kind: f.kind, name: FACTORIES[f.kind].name, owner: f.username, fee: f.toll_fee, level: f.level })),
    myTolls: q.myTolls.all(userId).map((o) => ({ id: o.id, kind: o.kind, name: FACTORIES[o.kind].name, owner: o.username, batches: o.batches, done: o.done, fee: o.fee })),
    kinds: Object.fromEntries(Object.entries(FACTORIES).map(([k, d]) => [k, { ...d, build: indexedPrice(d.build) }])),
    goods,
    // Kho hàng hóa (chung với Sàn): sức chứa, đang có và phần giữ chỗ cho lệnh mua đang chờ, cùng đơn vị với `goods`.
    warehouse: (() => {
      const capacity = capacityOf(getUser(userId));
      const used = Object.values(goods).reduce((sum, n) => sum + n, 0);
      return { capacity, used, reserved: Math.max(0, capacity - freeSpace(userId) - used) };
    })(),
    max: MAX_FACTORIES,
  };
}

/** Nửa đêm: chạy bù tới cuối ngày, thu tiền thuê đất; nợ 3 đêm liền thì xưởng đóng cửa. */
export function settleFactoryDay(day, rand = Math.random) {
  const end = startOfDay(day) + DAY;
  transaction(() => {
    for (const f of q.openAll.all()) {
      simulateFactory(f, end, rand);
      const rent = indexedPrice(FACTORY.landRent);
      if (getUser(f.owner_id).coins >= rent) {
        post({ userId: f.owner_id, delta: -rent, kind: 'rent', memo: FACTORIES[f.kind].name, now: end - 1 });
        q.addDay.run(f.id, day, 0, 0, 0, rent, 0);
        f.unpaid_days = 0;
      } else {
        f.unpaid_days += 1;
      }
      persist(f);
      if (f.unpaid_days >= BUSINESS.unpaidLimit && !q.tollQueue.all(f.id).length) {
        q.close.run(end, f.id);
        addCredit(f.owner_id, CREDIT.evicted, `${FACTORIES[f.kind].name} bị đóng vì nợ tiền thuê đất`, end - 1);
        q.insertNews.run(`${FACTORIES[f.kind].name} của ${getUser(f.owner_id).username} đóng cửa vì nợ tiền thuê đất`, end, end, end + 2 * DAY);
      }
    }
  });
}
