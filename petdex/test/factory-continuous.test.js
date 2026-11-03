// Kiểm thử xưởng chạy liên tục (tự nối ca) và ca đêm trên DB tạm: nối ca lười lúc đọc, lý do dừng, ca đêm vắt qua nửa đêm.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR, tick } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const jobs = await import('../server/jobs.js');
const market = await import('../server/market.js');
const factory = await import('../server/factory.js');
const { NIGHT_SHIFT, batchesPerHour } = await import('../server/rules/production.js');
const { ENERGY_PER_HOUR } = await import('../server/rules/careers.js');

const T0 = Date.parse('2026-11-02T03:00:00Z'); // 10 giờ sáng thứ Hai, giờ Việt Nam (nửa đêm = T0 + 14 giờ)
const MIDNIGHT = T0 + 14 * HOUR;
const always = (v) => () => v;
const FLOOR = always(0.999); // làm tròn ngẫu nhiên luôn xuống: số mẻ mỗi giờ = phần nguyên
const stockAt = (id, c, t) => market.stock(id, t)[c] ?? 0;
const shiftsOf = (petId) => store.db.prepare('SELECT * FROM shifts WHERE pet_id = ? ORDER BY starts_at, id').all(petId);
const dayRow = (factoryId, day) => store.db.prepare('SELECT * FROM factory_days WHERE factory_id = ? AND day = ?').get(factoryId, day);
// Kỹ năng 20/20: nhà máy đường cấp 1 chạy 6 × 1,06 = 6,36 mẻ/giờ → 6 mẻ mỗi giờ trọn; ca đêm 85% → 5 mẻ.
const DAY_RATE = Math.floor(batchesPerHour('sugar_mill', 0, 20, 20));
const NIGHT_RATE = Math.floor(batchesPerHour('sugar_mill', 0, 20, 20) * NIGHT_SHIFT.speed);

let n = 0;
/** Người chơi mới có một bé trưởng thành và một nhà máy đường (1 lô mía → 1 lô đường mỗi mẻ). */
function newOwner(stockBatches) {
  n += 1;
  const id = store.createUser(`fx${n}`, 'x', T0 - 10 * DAY);
  post({ userId: id, delta: 20_000, kind: 'opening', now: T0 });
  const petId = store.insertPet(id, `Bé ${n}`, 'test_pet', T0 - 45 * DAY);
  store.savePet({ ...store.getPet(petId), level: 8, updated_at: T0 });
  for (const skill of ['strength', 'agility', 'intellect', 'charm', 'craft']) store.setSkill(petId, skill, 20);
  store.setActivePet(id, petId);
  factory.buildFactory(id, 'sugar_mill', T0);
  const factoryId = factory.factoryView(id, T0).factories[0].id;
  if (stockBatches) market.addGoods(id, 'cane', stockBatches * 10, T0, { cost: 1 });
  return { id, petId, factoryId };
}

/** Chăm bé đầy đủ ở thời điểm `t`. */
function refresh(petId, t, extra = {}) {
  store.savePet({ ...store.getPet(petId), fullness: 90, energy: 100, happiness: 80, hygiene: 90, health: 90, sick: null, busy_from: null, busy_until: null, updated_at: t, ...extra });
}

migrate(T0);
runDue(T0);

test('chạy liên tục: tự nối ca cùng độ dài lúc đọc, dừng khi hết nguyên liệu và ghi lý do', () => {
  const a = newOwner(10); // đủ 10 mẻ
  factory.setFactoryAuto(a.id, a.factoryId, true, T0);
  refresh(a.petId, T0);
  jobs.startShift(a.id, { petId: a.petId, hours: 1, factoryId: a.factoryId }, T0);

  // Không ai online 5 tiếng; lần đọc đầu tiên nối ca bù tới hiện tại.
  factory.syncFactories(a.id, T0 + 5 * HOUR, FLOOR);
  const shifts = shiftsOf(a.petId);
  assert.equal(shifts.length, 2, 'ca 1 giờ được nối thêm một ca 1 giờ');
  assert.equal(shifts[1].starts_at, T0 + HOUR, 'ca kế bắt đầu đúng lúc ca trước kết thúc');
  assert.equal(shifts[1].hours, 1);
  assert.equal(shifts[0].chain, 'next');
  assert.equal(shifts[1].chain, 'stock', 'mẻ thứ 6 + 4 hết sạch mía: dừng vì hết nguyên liệu');
  assert.equal(stockAt(a.id, 'cane', T0 + 5 * HOUR), 0);
  assert.equal(stockAt(a.id, 'sugar', T0 + 5 * HOUR), 100);
  assert.equal(store.getPet(a.petId).busy_until, T0 + 2 * HOUR);

  const view = factory.factoryView(a.id, T0 + 5 * HOUR).factories[0];
  assert.equal(view.autoRun, true);
  assert.equal(view.stop.reason, 'hết nguyên liệu');
  assert.equal(view.canRun, 0);
});

test('chạy liên tục: dừng khi bé hết giờ làm trong ngày, ca nối vẫn tính vào giờ làm', () => {
  const b = newOwner(100);
  factory.setFactoryAuto(b.id, b.factoryId, true, T0);
  refresh(b.petId, T0);
  jobs.startShift(b.id, { petId: b.petId, hours: 2, factoryId: b.factoryId }, T0);
  // Đọc giữa chừng: ca kế được đoán trước là sẽ nối.
  factory.syncFactories(b.id, T0 + HOUR, FLOOR);
  const mid = factory.factoryView(b.id, T0 + HOUR).factories[0];
  assert.equal(mid.duty[0].next.at, T0 + 2 * HOUR);
  assert.equal(mid.duty[0].next.stop, null);

  factory.syncFactories(b.id, T0 + 12 * HOUR, FLOOR);
  const shifts = shiftsOf(b.petId);
  assert.equal(shifts.length, 4, '4 ca × 2 giờ = 8 giờ, trần của bé trưởng thành');
  assert.deepEqual(shifts.map((s) => s.chain), ['next', 'next', 'next', 'hours']);
  assert.equal(jobs.jobsView(b.id, T0 + 12 * HOUR).pets[0].hoursToday, 8);
  assert.equal(dayRow(b.factoryId, '2026-11-02').batches, 8 * DAY_RATE, 'hai ca nối nhau không mất phút nào');
  assert.equal(factory.factoryView(b.id, T0 + 12 * HOUR).factories[0].stop.reason, 'hết giờ làm');
});

test('chạy liên tục: dừng khi bé mệt hoặc ốm; tắt rồi bật lại không nối bù ca đã xong', () => {
  const c = newOwner(100);
  factory.setFactoryAuto(c.id, c.factoryId, true, T0);
  // Năng lượng 15: xong ca 1 giờ còn 5, không đủ 10 cho ca kế.
  refresh(c.petId, T0, { energy: 15 });
  jobs.startShift(c.id, { petId: c.petId, hours: 1, factoryId: c.factoryId }, T0);
  factory.syncFactories(c.id, T0 + 2 * HOUR, FLOOR);
  assert.deepEqual(shiftsOf(c.petId).map((s) => s.chain), ['tired']);
  assert.equal(factory.factoryView(c.id, T0 + 2 * HOUR).factories[0].stop.reason, 'bé mệt/ốm');

  // Bé ốm giữa ca: hết ca không nối.
  refresh(c.petId, T0 + 2 * HOUR);
  jobs.startShift(c.id, { petId: c.petId, hours: 1, factoryId: c.factoryId }, T0 + 2 * HOUR);
  store.savePet({ ...store.getPet(c.petId), sick: 'cold' });
  factory.syncFactories(c.id, T0 + 4 * HOUR, FLOOR);
  assert.equal(shiftsOf(c.petId).at(-1).chain, 'tired');

  // Tắt chạy liên tục: ca xong lúc tắt không nối; bật lại thì ca đó cũng không được nối bù.
  factory.setFactoryAuto(c.id, c.factoryId, false, T0 + 4 * HOUR);
  refresh(c.petId, T0 + 4 * HOUR);
  jobs.startShift(c.id, { petId: c.petId, hours: 1, factoryId: c.factoryId }, T0 + 4 * HOUR);
  factory.syncFactories(c.id, T0 + 6 * HOUR, FLOOR);
  factory.setFactoryAuto(c.id, c.factoryId, true, T0 + 6 * HOUR);
  factory.syncFactories(c.id, T0 + 7 * HOUR, FLOOR);
  assert.equal(shiftsOf(c.petId).length, 3);
  assert.equal(shiftsOf(c.petId).at(-1).chain, 'off');
});

test('chạy liên tục: nối ca qua nửa đêm khi đóng sổ, ngày mới thì giờ làm tính lại', () => {
  const d = newOwner(100);
  factory.setFactoryAuto(d.id, d.factoryId, true, T0);
  refresh(d.petId, T0 + 12 * HOUR); // 22:00
  jobs.startShift(d.id, { petId: d.petId, hours: 2, factoryId: d.factoryId }, T0 + 12 * HOUR);
  // 00:00 trùng lúc ca hết: đóng sổ nối ca mới cho ngày thứ Ba, không ai cần online.
  runDue(MIDNIGHT + 30_000, FLOOR);
  const shifts = shiftsOf(d.petId);
  assert.equal(shifts.length, 2);
  assert.equal(shifts[1].starts_at, MIDNIGHT);
  assert.equal(shifts[1].day, '2026-11-03', 'ca sau nửa đêm tính vào giờ làm của ngày mới');
  assert.equal(dayRow(d.factoryId, '2026-11-02').batches, 2 * DAY_RATE);
  assert.ok(dayRow(d.factoryId, '2026-11-02').rent > 0, 'thu thuê đất đêm thứ Hai');
});

test('ca đêm: chỉ 20:00–02:00, mỗi bé một ca mỗi đêm, chỉ bé nhà chủ ở xưởng của mình', () => {
  const f = newOwner(100);
  const other = newOwner(0);
  const evening = T0 + 10.5 * HOUR; // 20:30 thứ Hai
  refresh(f.petId, T0 + 4 * HOUR);
  assert.throws(() => jobs.startShift(f.id, { petId: f.petId, factoryId: f.factoryId, night: true }, T0 + 4 * HOUR), /20:00/);
  refresh(other.petId, evening);
  factory.setFactoryJobs(f.id, f.factoryId, { wage: 10, slots: 1, open: true });
  assert.throws(() => jobs.startShift(other.id, { petId: other.petId, factoryId: f.factoryId, night: true }, evening), /bé nhà mình/);

  // Bé đã làm đủ 8 giờ ban ngày vẫn vào ca đêm được.
  store.db.prepare("INSERT INTO shifts (user_id, pet_id, career, rank, hours, pay, day, starts_at, ends_at) VALUES (?, ?, 'porter', 1, 8, 0, '2026-11-02', ?, ?)")
    .run(f.id, f.petId, T0 - HOUR, T0 + 7 * HOUR);
  refresh(f.petId, evening);
  assert.equal(factory.factoryView(f.id, evening).night.pets[0].ok, true);
  jobs.startShift(f.id, { petId: f.petId, factoryId: f.factoryId, night: true }, evening);

  // 01:30 cùng đêm, bé đã rảnh (giả lập): vẫn không được ca đêm thứ hai.
  const late = MIDNIGHT + 1.5 * HOUR;
  refresh(f.petId, late);
  assert.throws(() => jobs.startShift(f.id, { petId: f.petId, factoryId: f.factoryId, night: true }, late), /mỗi đêm một ca/);
  const nv = factory.factoryView(f.id, late).night;
  assert.equal(nv.open, true);
  assert.equal(nv.pets[0].ok, false);
  // 02:00 là hết khung; đêm sau thì được.
  assert.throws(() => jobs.startShift(f.id, { petId: f.petId, factoryId: f.factoryId, night: true }, MIDNIGHT + 2 * HOUR), /20:00/);
  refresh(f.petId, evening + DAY);
  jobs.startShift(f.id, { petId: f.petId, factoryId: f.factoryId, night: true }, evening + DAY);
  assert.equal(shiftsOf(f.petId).filter((s) => s.night).length, 2);
});

test('ca đêm: 8 giờ vắt qua nửa đêm, 85% tốc độ, hao sức ×1,5, chia mẻ theo ngày và thuê đất mỗi đêm', () => {
  const e = newOwner(100);
  factory.setFactoryAuto(e.id, e.factoryId, true, T0); // ca đêm không tự nối dù bật chạy liên tục
  const midnight = MIDNIGHT + DAY; // 00:00 thứ Tư (thứ Hai đã đóng sổ ở bài trước)
  const start = midnight - 2 * HOUR; // 22:00 thứ Ba
  refresh(e.petId, start, { energy: 90 });
  assert.throws(() => jobs.startShift(e.id, { petId: e.petId, factoryId: e.factoryId, night: true }, start), /100 năng lượng/);
  refresh(e.petId, start);
  const coins = store.getUser(e.id).coins;
  jobs.startShift(e.id, { petId: e.petId, factoryId: e.factoryId, night: true }, start);
  assert.equal(store.getUser(e.id).coins, coins, 'không lương');
  const night = shiftsOf(e.petId)[0];
  assert.equal(night.hours, NIGHT_SHIFT.hours);
  assert.equal(night.ends_at, start + 8 * HOUR);
  assert.equal(night.night, '2026-11-03');
  assert.equal(store.getPet(e.petId).busy_kind, 'night');
  assert.equal(jobs.jobsView(e.id, start).pets[0].hoursToday, 0, 'không tính vào giờ làm trong ngày');
  factory.syncFactories(e.id, start + HOUR, FLOOR);
  const view = factory.factoryView(e.id, start + HOUR).factories[0];
  assert.equal(view.duty[0].night, true);
  assert.equal(view.duty[0].next, null);

  // Hao sức gấp rưỡi: 6 giờ trong ca mất 6 × 15 = 90 năng lượng (ca thường mất 60).
  const pet = tick(store.getPet(e.petId), start + 6 * HOUR);
  assert.equal(Math.round(pet.energy), 100 - 6 * ENERGY_PER_HOUR * NIGHT_SHIFT.energy);

  // Đóng sổ thứ Ba lúc không ai online: mẻ 22:00–24:00 vào thứ Ba, chạy 85% tốc độ.
  runDue(midnight + 30_000, FLOOR);
  const tue = dayRow(e.factoryId, '2026-11-03');
  assert.equal(NIGHT_RATE, 5);
  assert.equal(tue.batches, 2 * NIGHT_RATE);
  const rent = store.db.prepare("SELECT delta FROM ledger WHERE user_id = ? AND kind = 'rent' ORDER BY id DESC").get(e.id);
  assert.equal(tue.rent, -rent.delta);

  // Sáng thứ Tư: phần 00:00–06:00 vào thứ Tư, ca không tự nối, bé cạn sức.
  const morning = midnight + 7 * HOUR;
  factory.syncFactories(e.id, morning, FLOOR);
  assert.equal(dayRow(e.factoryId, '2026-11-04').batches, 6 * NIGHT_RATE);
  assert.equal(stockAt(e.id, 'sugar', morning), 8 * NIGHT_RATE * 10);
  assert.equal(shiftsOf(e.petId).length, 1);
  assert.equal(Math.round(tick(store.getPet(e.petId), morning - HOUR).energy), 0);
  runDue(midnight + DAY + 30_000, FLOOR);
  assert.ok(dayRow(e.factoryId, '2026-11-04').rent > 0, 'thu thuê đất đêm thứ Tư');

  // Nhận ca: không lương, vẫn lên kinh nghiệm.
  const done = jobs.jobsView(e.id, morning).shifts.find((s) => s.night);
  assert.ok(done.ready);
  assert.match(jobs.claimShift(e.id, done.id, morning).message, /ca đêm/);
});
