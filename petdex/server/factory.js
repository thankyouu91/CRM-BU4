// Khu công nghiệp: xây xưởng chế biến, bé đứng máy theo ca, gia công thuê cho người khác, tiền thuê đất mỗi đêm.
import { db, getPet, getUser, listPets, savePet, skillsOf, transaction } from './db.js';
import { indexedPrice } from './bank.js';
import { dayKey, nightKey, nightOpensAt, startOfDay } from './clock.js';
import { DAY, GameError, HOUR, ageInfo, busyKind, rollSickness, stageRules, tick } from './game.js';
import { post } from './ledger.js';
import { addGoods, capacityOf, freeSpace, removeGoods, stock } from './market.js';
import { LOT } from './rules/market.js';
import { CHAIN_STOPS, CREDIT, FACTORIES, FACTORY, NIGHT_SHIFT, batchesPerHour } from './rules/production.js';
import { shiftProblem } from './rules/careers.js';
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
  save: db.prepare('UPDATE factories SET level = ?, toll_fee = ?, toll_open = ?, unpaid_days = ?, sim_at = ?, auto_run = ? WHERE id = ?'),
  autoMine: db.prepare('SELECT * FROM factories WHERE owner_id = ? AND auto_run = 1 AND closed_at IS NULL ORDER BY id'),
  // Ca của bé nhà chủ đã hết giờ mà chưa xét nối ca (ca đêm không tự nối).
  chainDue: db.prepare(`
    SELECT * FROM shifts WHERE factory_id = ? AND user_id = ? AND night IS NULL AND chain IS NULL AND ends_at <= ?
    ORDER BY ends_at, id LIMIT 1`),
  setChain: db.prepare('UPDATE shifts SET chain = ? WHERE id = ?'),
  skipChains: db.prepare("UPDATE shifts SET chain = 'off' WHERE factory_id = ? AND user_id = ? AND chain IS NULL AND ends_at <= ?"),
  lastStop: db.prepare(`
    SELECT s.chain, s.ends_at, p.name FROM shifts s JOIN pets p ON p.id = s.pet_id
    WHERE s.factory_id = ? AND s.user_id = ? AND s.chain IS NOT NULL AND s.chain NOT IN ('next', 'off') AND s.ends_at > ? ORDER BY s.ends_at DESC, s.id DESC LIMIT 1`),
  hoursOn: db.prepare('SELECT COALESCE(SUM(hours), 0) AS h FROM shifts WHERE pet_id = ? AND day = ? AND night IS NULL'),
  nightDone: db.prepare('SELECT 1 FROM shifts WHERE pet_id = ? AND night = ? LIMIT 1'),
  insertShift: db.prepare(`
    INSERT INTO shifts (user_id, pet_id, career, rank, hours, pay, day, starts_at, ends_at, business_id, wage, factory_id, night)
    VALUES (?, ?, 'factory', 1, ?, 0, ?, ?, ?, NULL, 0, ?, NULL)`),
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
const persist = (f) => q.save.run(f.level, f.toll_fee, f.toll_open, f.unpaid_days, f.sim_at, f.auto_run ?? 0, f.id);
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
  // Tốc độ của từng ca: theo cấp xưởng và kỹ năng bé; bé hành Kim chạy thêm 10% mẻ, ca đêm chạy 85% tốc độ.
  const shifts = q.duty.all(f.id, to, f.sim_at).map((s) => {
    const sk = skillsOf(s.pet_id);
    const kim = isElement(s.pet_species, 'kim') ? 1 + ELEMENT_RULES.perks.kim.factory : 1;
    const rate = batchesPerHour(f.kind, f.level, sk.strength ?? 0, sk.craft ?? 0) * kim * (s.night ? NIGHT_SHIFT.speed : 1);
    return { ...s, rate };
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
      // Chia giờ này theo mốc vào/ra ca: mỗi đoạn chạy theo ca nhanh nhất đang đứng máy, nên hai ca nối nhau giữa giờ không mất phút nào.
      const marks = onDuty.flatMap((s) => [s.starts_at, s.ends_at]).filter((x) => x > t && x < end);
      const cuts = [...new Set([t, end, ...marks])].sort((a, b) => a - b);
      let work = 0;
      for (let i = 0; i + 1 < cuts.length; i += 1) {
        const on = onDuty.filter((s) => s.starts_at < cuts[i + 1] && s.ends_at > cuts[i]);
        if (on.length) work += Math.max(...on.map((s) => s.rate)) * ((cuts[i + 1] - cuts[i]) / HOUR);
      }
      let batches = stochasticRound(work, rand);
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

/** Số mẻ còn làm được tại `t`: nguyên liệu trong kho chủ cộng phần đơn gia công chưa làm. */
function batchesLeft(f, t) {
  const goods = stock(f.owner_id, t);
  const own = Math.min(...lotsOf(FACTORIES[f.kind].input).map(([c, need]) => Math.floor((goods[c] ?? 0) / need)));
  return own + q.tollQueue.all(f.id).reduce((n, o) => n + o.batches - o.done, 0);
}

/** Mã lỗi nhận ca → lý do dừng chạy liên tục. */
const STOP_OF = { hours: 'hours', busy: 'busy', sick: 'tired', energy: 'tired', hungry: 'tired', stage: 'tired' };

/**
 * Xét nối ca cho một ca đã hết giờ của bé nhà chủ: bé còn giờ làm trong ngày, không mệt/ốm/đói (đúng các kiểm tra
 * như lúc nhận ca bằng tay) và kho còn đủ ít nhất một mẻ thì vào ca mới cùng độ dài, ngay lúc ca cũ kết thúc.
 * Không thì ghi lý do dừng vào ca cũ (`shifts.chain`).
 */
function chainShift(f, s, rand) {
  const stop = (code) => q.setChain.run(code, s.id);
  const row = getPet(s.pet_id);
  if (f.closed_at) return stop('closed');
  if (!row || row.owner_id !== f.owner_id) return stop('busy');
  // Bé đã được lưu sau lúc hết ca (việc khác chạm vào bé) thì ca kế bắt đầu từ lúc đó, để không tính chồng giờ.
  const at = Math.max(s.ends_at, row.updated_at);
  const pet = rollSickness(tick(row, at), Math.max(0, at - row.updated_at) / HOUR, rand);
  const problem = shiftProblem({
    pet,
    stage: ageInfo(pet.born_at, at).stage,
    careerId: 'factory',
    hours: s.hours,
    hoursToday: q.hoursOn.get(pet.id, dayKey(at)).h,
    busy: busyKind(pet, at),
    maxHours: stageRules(pet.born_at, at).maxHours ?? 8,
  });
  const reason = problem ? STOP_OF[problem.code] ?? 'tired' : batchesLeft(f, at) < 1 ? 'stock' : null;
  if (reason) {
    if (reason !== 'busy') savePet(pet);
    return stop(reason);
  }
  const ends = at + s.hours * HOUR;
  q.insertShift.run(f.owner_id, pet.id, s.hours, dayKey(at), at, ends, f.id);
  savePet({ ...pet, busy_from: at, busy_until: ends, busy_kind: 'work' });
  return stop('next');
}

/**
 * Chạy bù xưởng tới `to`, xét nối ca dọc đường: lần lượt từng ca của bé nhà chủ đã hết giờ, chạy bù tới đúng lúc
 * ca đó kết thúc rồi mới xem kho và sức bé, nên ca nối qua đêm vẫn đúng dù không ai online. Không hẹn giờ gì cả.
 */
export function advanceFactory(f, to, rand = Math.random) {
  if (f.auto_run && !f.closed_at) {
    for (let s = q.chainDue.get(f.id, f.owner_id, to); s; s = q.chainDue.get(f.id, f.owner_id, to)) {
      if (s.ends_at > f.sim_at) simulateFactory(f, s.ends_at, rand);
      chainShift(f, s, rand);
    }
  }
  return simulateFactory(f, to, rand);
}

/** Gọi đầu mỗi lượt đọc của người chơi: nối các ca đã hết giờ ở xưởng đang bật chạy liên tục. Rẻ khi chưa có ca nào tới hạn. */
export function resolveFactoryChains(userId, now = Date.now(), rand = Math.random) {
  for (const f of q.autoMine.all(userId)) {
    if (q.chainDue.get(f.id, f.owner_id, now)) transaction(() => advanceFactory(q.byId.get(f.id), now, rand));
  }
}

export function syncFactories(userId, now = Date.now(), rand = Math.random) {
  transaction(() => {
    for (const f of q.mine.all(userId)) advanceFactory(f, now, rand);
  });
}

/** Bật/tắt "Chạy liên tục". Lúc bật, các ca đã xong trước đó không được nối bù. */
export function setFactoryAuto(userId, factoryId, on, now = Date.now()) {
  return transaction(() => {
    const f = mustOwn(userId, factoryId);
    advanceFactory(f, now);
    if (on && !f.auto_run) q.skipChains.run(f.id, f.owner_id, now);
    f.auto_run = on ? 1 : 0;
    persist(f);
    return { message: on ? 'Đã bật chạy liên tục: ca của bé nhà mình xong sẽ tự vào ca kế.' : 'Đã tắt chạy liên tục.' };
  });
}

const clockText = (h) => `${String(h).padStart(2, '0')}:00`;

/** Lý do bé chưa vào ca đêm được lúc `now` (ngoài khung giờ, đã làm đêm nay, mệt, ốm...), hoặc null. `pet` đã tick tới `now`. */
export function nightProblem(pet, now) {
  const key = nightKey(now, NIGHT_SHIFT.from, NIGHT_SHIFT.until);
  if (!key) return { code: 'window', message: `Ca đêm nhận từ ${clockText(NIGHT_SHIFT.from)} tới trước ${clockText(NIGHT_SHIFT.until)}.` };
  if (q.nightDone.get(pet.id, key)) return { code: 'done', message: `${pet.name} đã làm ca đêm đêm nay rồi, mỗi đêm một ca thôi.` };
  return shiftProblem({
    pet, stage: ageInfo(pet.born_at, now).stage, careerId: 'factory', hours: NIGHT_SHIFT.hours, hoursToday: 0, busy: busyKind(pet, now), night: true,
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
    advanceFactory(f, now);
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
    advanceFactory(f, now);
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
    advanceFactory(f, now);
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
    advanceFactory(f, now);
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

/**
 * Đoán ca kế của một ca đang chạy ở xưởng bật chạy liên tục: tới lúc hết ca bé có còn giờ làm, còn sức không,
 * và kho có còn hàng sau khi máy chạy hết ca này không (ước lượng theo tốc độ trung bình). Trả về mã dừng hoặc null.
 */
function chainForecast(f, s, now) {
  const row = getPet(s.pet_id);
  if (!row) return 'busy';
  const at = Math.max(s.ends_at, row.updated_at);
  const pet = tick(row, at);
  const problem = shiftProblem({
    pet,
    stage: ageInfo(pet.born_at, at).stage,
    careerId: 'factory',
    hours: s.hours,
    hoursToday: q.hoursOn.get(pet.id, dayKey(at)).h,
    busy: busyKind(pet, at),
    maxHours: stageRules(pet.born_at, at).maxHours ?? 8,
  });
  if (problem) return STOP_OF[problem.code] ?? 'tired';
  const sk = skillsOf(s.pet_id);
  const ahead = batchesPerHour(f.kind, f.level, sk.strength ?? 0, sk.craft ?? 0) * (Math.max(0, s.ends_at - Math.max(now, s.starts_at)) / HOUR);
  return batchesLeft(f, now) - ahead < 1 ? 'stock' : null;
}

/** Bé nhà mình có vào ca đêm được lúc này không (khung giờ, mỗi đêm một ca, sức, ốm, đói). */
function nightView(userId, now) {
  const key = nightKey(now, NIGHT_SHIFT.from, NIGHT_SHIFT.until);
  const opensAt = nightOpensAt(now, NIGHT_SHIFT.from, NIGHT_SHIFT.until);
  return {
    open: Boolean(key),
    opensAt: key ? opensAt : opensAt > now ? opensAt : opensAt + DAY,
    closesAt: (key ? startOfDay(key) : startOfDay(dayKey(now))) + (24 + NIGHT_SHIFT.until) * HOUR,
    hours: NIGHT_SHIFT.hours,
    speed: NIGHT_SHIFT.speed,
    energyFactor: NIGHT_SHIFT.energy,
    pets: listPets(userId).map((row) => {
      const pet = tick(row, now);
      const problem = nightProblem(pet, now);
      return { id: pet.id, name: pet.name, energy: Math.round(pet.energy), ok: !problem, why: problem?.message ?? null };
    }),
  };
}

export function factoryView(userId, now = Date.now()) {
  syncFactories(userId, now);
  // Chạy bù cả các xưởng đang gia công cho mình, để tiến độ đơn hàng không đứng yên chờ chủ xưởng mở màn.
  transaction(() => {
    for (const id of new Set(q.myTolls.all(userId).map((o) => o.factory_id))) advanceFactory(q.byId.get(id), now);
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
        autoRun: Boolean(f.auto_run),
        duty: q.duty.all(f.id, now + 365 * DAY, now).map((s) => {
          const own = s.user_id === userId;
          const chains = Boolean(f.auto_run) && own && !s.night;
          const stop = chains ? chainForecast(f, s, now) : null;
          return {
            petName: s.pet_name, owner: s.username, own, startsAt: s.starts_at, endsAt: s.ends_at, hours: s.hours, night: Boolean(s.night),
            // Ca kế (chạy liên tục): tự vào lúc `at`, hoặc đoán trước sẽ dừng vì `stop`.
            next: chains ? { at: s.ends_at, hours: s.hours, stop: stop ? CHAIN_STOPS[stop] : null } : null,
          };
        }),
        // Lần dừng chạy liên tục gần nhất, chỉ hiện khi không còn ca nào của bé nhà mình ở xưởng.
        stop: (() => {
          if (!f.auto_run || q.duty.all(f.id, now + 365 * DAY, now).some((s) => s.user_id === userId)) return null;
          const last = q.lastStop.get(f.id, userId, now - DAY);
          return last ? { reason: CHAIN_STOPS[last.chain] ?? last.chain, petName: last.name, at: last.ends_at } : null;
        })(),
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
    night: nightView(userId, now),
  };
}

/**
 * Nửa đêm: chạy bù (kèm nối ca) tới đúng 00:00, thu tiền thuê đất; nợ 3 đêm liền thì xưởng đóng cửa.
 * Ca vắt qua nửa đêm chỉ được tính tới 00:00 ở đây: mẻ trước nửa đêm vào ngày cũ, phần sau vào ngày mới ở lần chạy bù kế tiếp.
 * Chạy trước phần chăm sóc và vòng đời trong `closeDay`, nên bé được nối ca xong rồi mới bị tick tới nửa đêm.
 */
export function settleFactoryDay(day, rand = Math.random) {
  const end = startOfDay(day) + DAY;
  transaction(() => {
    for (const f of q.openAll.all()) {
      advanceFactory(f, end, rand);
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
