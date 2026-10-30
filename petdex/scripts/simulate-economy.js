// Mô phỏng nền kinh tế: nhiều bot chơi theo vài kiểu trong nhiều ngày, chạy đúng code server trên DB tạm trong RAM.
// Chạy: npm run simulate -- --bots 60 --days 30
import { pathToFileURL } from 'node:url';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, HOUR, ITEMS, applyEffect, play, tick, useItem } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { runDue } = await import('../server/scheduler.js');
const jobs = await import('../server/jobs.js');
const market = await import('../server/market.js');
const bank = await import('../server/bank.js');
const games = await import('../server/minigames.js');
const wallet = await import('../server/wallet.js');
const { mutatePet } = await import('../server/service.js');
const { fishSequence, pearlSchedule } = await import('../../public/ta-tua/game/js/shared/minigames.js');
const { initialSkills } = await import('../server/rules/careers.js');
const { SPECIES, statsOfSpecies } = await import('../../public/ta-tua/game/js/shared/pets.js');
/** Bot nuôi xoay vòng 25 loài Thường (đủ 5 hành), hoặc loài trung tính để so sánh khi không có ngũ hành. */
const COMMONS = SPECIES.filter((s) => s.rarity === 'thuong').map((s) => s.id);
const { COMMODITIES } = await import('../server/rules/market.js');
const business = await import('../server/business.js');
const { dayKey, nextDay } = await import('../server/clock.js');
const { dailyReward } = await import('../server/rules/town.js');
const { payStipend } = await import('../server/town.js');
const care = await import('../server/care.js');
const farm = await import('../server/farm.js');
const factory = await import('../server/factory.js');
const { FACTORIES } = await import('../server/rules/production.js');

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.parse('2026-11-02T00:00:00Z'); // 7 giờ sáng thứ Hai giờ Việt Nam
const START_COINS = 150;
// Chủ xưởng ít hơn các kiểu khác (khoảng 1/9), giống một thị trấn thật: xưởng cần vốn lớn và cấp cao.
const KINDS_OF_BOT = ['casual', 'diligent', 'speculator', 'merchant', 'casual', 'diligent', 'speculator', 'merchant', 'producer'];
const SHOP_INPUTS = ['dried_tea', 'milk', 'pearl', 'sugar'];
const CAREER_LIST = ['barista', 'courier', 'porter', 'tutor', 'singer'];

/** Bỏ qua lỗi do luật chơi (thiếu xu, bé mệt...) giống người chơi thật gặp rồi thôi. */
function attempt(fn) {
  try {
    return fn();
  } catch (err) {
    if (err.constructor?.name === 'GameError') return null;
    throw err;
  }
}

export function simulate(opts = {}) {
  // Game rules also call Math.random (mini-game drops, sickness...): seed it too while the run lasts,
  // so the same seed always gives the same economy.
  const real = Math.random;
  Math.random = seeded((opts.seed ?? 1) + 7919);
  try {
    return run(opts);
  } finally {
    Math.random = real;
  }
}

const reseedGame = store.db.prepare('UPDATE minigame_sessions SET seed = ? WHERE id = ?');

function run({ bots = 60, days = 30, seed = 1, elements = true } = {}) {
  const rand = seeded(seed);
  const players = [];
  for (let i = 0; i < bots; i++) {
    const kind = KINDS_OF_BOT[i % KINDS_OF_BOT.length];
    const id = store.createUser(`bot${i}`, 'x', START);
    post({ userId: id, delta: START_COINS, kind: 'opening', now: START });
    const species = elements ? COMMONS[i % COMMONS.length] : 'test_pet';
    // Bé 30 tuần (Thanh niên), sang Trưởng thành ở ngày thứ 10: làm đủ 8 giờ như người chơi đã nuôi lâu.
    const petId = store.insertPet(id, `Bé ${i}`, species, START - 30 * DAY);
    store.savePet({ ...store.getPet(petId), updated_at: START });
    const skills = elements ? statsOfSpecies(species).skills : initialSkills(rand);
    for (const [skill, value] of Object.entries(skills)) store.setSkill(petId, skill, value);
    store.setActivePet(id, petId);
    players.push({ id, petId, kind, career: CAREER_LIST[i % CAREER_LIST.length] });
  }
  runDue(START, rand);

  const totals = { salary: 0, minigame: 0, food: 0, fees: 0 };
  const sumKind = store.db.prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE kind = ? AND created_at >= ? AND created_at < ?');

  function feed(p, now) {
    for (let k = 0; k < 6; k++) {
      const pet = tick(store.getPet(p.petId), now);
      if (pet.fullness >= 70) return;
      const ok = attempt(() => store.transaction(() => {
        post({ userId: p.id, delta: -bank.indexedPrice(ITEMS.fish.price), kind: 'shop', memo: 'Cá tươi', now });
        mutatePet(p.id, p.petId, (pt) => useItem(pt, ITEMS.fish), { now });
        return true;
      }));
      if (!ok) return;
    }
  }

  function minigame(p, now) {
    const game = ['fishing', 'pearls', 'memory'][Math.floor(rand() * 3)];
    const session = attempt(() => games.startGame(p.id, game, now));
    if (!session) return;
    // The server draws a session seed from node:crypto; replace it with one from this run's generator.
    session.seed = Math.floor(rand() * 2 ** 31);
    reseedGame.run(session.seed, session.id);
    let result;
    if (game === 'fishing') result = { caught: fishSequence(session.seed).slice(0, 20).map(() => rand() < 0.6) };
    else if (game === 'pearls') {
      result = { caught: pearlSchedule(session.seed).map((d, i) => [d, i]).filter(([d]) => d.t < 28 && rand() < 0.55).map(([, i]) => i) };
    } else result = { moves: 10 + Math.floor(rand() * 10), pairs: 8 };
    attempt(() => games.finishGame(p.id, session.id, result, now + (session.duration - 2) * 1000));
  }

  function work(p, now) {
    for (const s of jobs.jobsView(p.id, now).shifts) if (s.ready) attempt(() => jobs.claimShift(p.id, s.id, now, rand));
    attempt(() => jobs.startShift(p.id, { petId: p.petId, career: p.career, hours: 4 }, now));
  }

  function speculate(p, now) {
    const ids = Object.keys(COMMODITIES);
    const held = market.marketView(p.id, now).holdings;
    for (const [id, h] of Object.entries(held)) {
      if (rand() < 0.5) attempt(() => market.placeOrder(p.id, { commodity: id, side: 'sell', qty: h.qty, type: 'market' }, now));
    }
    const id = ids[Math.floor(rand() * ids.length)];
    attempt(() => market.placeOrder(p.id, { commodity: id, side: 'buy', qty: 50 + Math.floor(rand() * 150), type: 'market' }, now));
  }

  /** Tắm khi bẩn, ốm thì đưa đi khám (người chơi thật cũng phải làm vậy mới đi làm được). */
  function nurse(p, now) {
    const pet = tick(store.getPet(p.petId), now);
    if (pet.sick) attempt(() => care.visitClinic(p.id, p.petId, now));
    if (pet.hygiene < 40) attempt(() => care.bath(p.id, p.petId, now));
  }

  /**
   * Chủ xưởng: trồng chè kín vườn; đủ tiền thì xây xưởng sấy. Sáng và trưa cho bé đứng máy 4 giờ với lá trà
   * nhà trồng cộng phần mua thêm trên Sàn (khi còn lời); buổi sáng bán trà khô làm ra hôm trước.
   */
  function produce(p, now, idx) {
    const garden = farm.gardenView(p.id, p.id, now);
    garden.plots.forEach((plot, i) => {
      if (plot.pests) attempt(() => farm.catchPests(p.id, i, now));
      if (plot.ready) attempt(() => farm.harvest(p.id, i, now, rand));
      if (!plot.crop || plot.ready) attempt(() => farm.plant(p.id, i, 'tea', now, rand));
    });
    let own = factory.factoryView(p.id, now).factories[0];
    if (!own && store.getUser(p.id).coins >= bank.indexedPrice(FACTORIES.dryer.build) + 500) {
      attempt(() => factory.buildFactory(p.id, 'dryer', now));
      own = factory.factoryView(p.id, now).factories[0];
    }
    if (!own) return false;
    const dried = market.stock(p.id, now).dried_tea ?? 0;
    if (idx === 0 && dried > 0) attempt(() => market.placeOrder(p.id, { commodity: 'dried_tea', side: 'sell', qty: dried, type: 'market' }, now));
    if (idx === 2) return false;
    const tea = market.stock(p.id, now).tea_leaf ?? 0;
    const need = 500 - tea; // đủ khoảng 25 mẻ, gần hết công suất ca 4 giờ
    const prices = market.currentPrices();
    const profitable = prices.dried_tea * 0.98 > 2 * prices.tea_leaf * 1.03 + 2; // chỉ mua thêm khi còn lời sau phí
    if (need > 0 && profitable) attempt(() => market.placeOrder(p.id, { commodity: 'tea_leaf', side: 'buy', qty: need, type: 'market' }, now));
    for (const s of jobs.jobsView(p.id, now).shifts) if (s.ready) attempt(() => jobs.claimShift(p.id, s.id, now, rand));
    return Boolean(attempt(() => jobs.startShift(p.id, { petId: p.petId, hours: 4, factoryId: own.id }, now)));
  }

  /** Chủ quầy: đủ tiền thì mở quầy ở Hẻm; nhập nguyên liệu cho khoảng 40 ly rồi cho bé trực quầy buổi trưa. */
  function runShop(p, now, idx) {
    let biz = business.businessOf(p.id);
    if (!biz && store.getUser(p.id).coins >= 2300) {
      attempt(() => business.openBusiness(p.id, { name: `Quầy ${p.id}`, location: 'alley' }, now));
      biz = business.businessOf(p.id);
      if (biz) p.openedAt = now;
    }
    if (!biz || idx !== 1) return false;
    const have = market.stock(p.id, now);
    for (const c of SHOP_INPUTS) {
      const need = 40 - (have[c] ?? 0);
      if (need > 0) attempt(() => market.placeOrder(p.id, { commodity: c, side: 'buy', qty: need, type: 'market' }, now));
    }
    for (const s of jobs.jobsView(p.id, now).shifts) if (s.ready) attempt(() => jobs.claimShift(p.id, s.id, now, rand));
    return Boolean(attempt(() => jobs.startShift(p.id, { petId: p.petId, hours: 4, businessId: biz.id }, now)));
  }

  function session(p, now, { daily = false, idx = 0 } = {}) {
    if (daily) {
      attempt(() => store.transaction(() => {
        const u = store.getUser(p.id);
        const today = dayKey(now);
        if (u.daily_day === today) return;
        const streak = u.daily_day && nextDay(u.daily_day) === today ? u.streak + 1 : 1;
        store.setDaily(p.id, now, today, streak);
        post({ userId: p.id, delta: dailyReward(streak), kind: 'daily', now });
        payStipend(p.id, now);
      }));
    }
    feed(p, now);
    nurse(p, now);
    const ownShift = (p.kind === 'merchant' && runShop(p, now, idx)) || (p.kind === 'producer' && produce(p, now, idx));
    if (!ownShift) work(p, now);
    attempt(() => mutatePet(p.id, p.petId, (pet) => play(pet, null), { now }));
    minigame(p, now);
    if (p.kind !== 'casual') minigame(p, now);
    if (p.kind === 'speculator') speculate(p, now);
    if (p.kind === 'diligent') {
      const spare = store.getUser(p.id).coins - 400;
      if (spare > 50) attempt(() => bank.moveSavings(p.id, 'deposit', spare, now));
    }
  }

  const daily = [];
  for (let d = 0; d < days; d++) {
    const dayStart = START + d * DAY;
    const plan = [1 * HOUR, 5 * HOUR, 11 * HOUR]; // 8h, 12h, 18h giờ Việt Nam
    plan.forEach((offset, idx) => {
      const now = dayStart + offset;
      runDue(now, rand);
      for (const p of players) {
        if (p.kind === 'casual' && idx !== 0) continue;
        session(p, now, { daily: idx === 0, idx });
      }
    });
    const end = dayStart + DAY;
    runDue(end, rand);
    const dayRange = [dayStart, end];
    totals.salary += sumKind.get('salary', ...dayRange).s;
    totals.minigame += sumKind.get('minigame', ...dayRange).s;
    totals.food -= sumKind.get('shop', ...dayRange).s;
    totals.fees -= sumKind.get('fee', ...dayRange).s;
    const worth = players.map((p) => ({ kind: p.kind, total: wallet.netWorth(p.id, end).total }));
    const avg = (kind) => {
      const list = worth.filter((w) => !kind || w.kind === kind);
      return list.reduce((s, w) => s + w.total, 0) / Math.max(1, list.length);
    };
    daily.push({
      day: d + 1, avg: avg(), casual: avg('casual'), diligent: avg('diligent'), speculator: avg('speculator'), merchant: avg('merchant'), producer: avg('producer'),
      ...bank.economy(),
    });
  }

  // Lợi nhuận quầy: doanh thu − giá vốn − thuê − lương − thuế doanh thu, bình quân mỗi ngày mở cửa.
  const shops = store.db.prepare(`
    SELECT b.id, b.opened_at, b.closed_at, b.reputation, COUNT(d.day) AS days, COALESCE(SUM(d.revenue - d.cogs - d.rent - d.wages - d.tax), 0) AS profit,
      COALESCE(SUM(d.cups), 0) AS cups FROM businesses b LEFT JOIN business_days d ON d.business_id = b.id GROUP BY b.id`).all();
  const shopStats = shops.length ? {
    count: shops.length,
    closed: shops.filter((s) => s.closed_at).length,
    profitPerDay: Math.round(shops.reduce((s, b) => s + b.profit / Math.max(1, b.days), 0) / shops.length),
    cupsPerDay: Math.round(shops.reduce((s, b) => s + b.cups / Math.max(1, b.days), 0) / shops.length),
    reputation: Math.round((shops.reduce((s, b) => s + b.reputation, 0) / shops.length) * 100) / 100,
  } : null;
  if (shopStats) shopStats.paybackDays = shopStats.profitPerDay > 0 ? Math.round(1500 / shopStats.profitPerDay) : null;
  // Xưởng: số mẻ, phí thuê đất và lời gộp ước tính theo giá Sàn lúc cuối mô phỏng.
  const plants = store.db.prepare(`
    SELECT f.id, f.closed_at, COUNT(d.day) AS days, COALESCE(SUM(d.batches), 0) AS batches, COALESCE(SUM(d.rent), 0) AS rent
    FROM factories f LEFT JOIN factory_days d ON d.factory_id = f.id GROUP BY f.id`).all();
  const endPrices = market.currentPrices();
  const margin = endPrices.dried_tea - 2 * endPrices.tea_leaf;
  const factoryStats = plants.length ? {
    count: plants.length,
    closed: plants.filter((f) => f.closed_at).length,
    batchesPerDay: Math.round(plants.reduce((s, f) => s + f.batches / Math.max(1, f.days), 0) / plants.length),
    marginPerBatch: Math.round(margin),
    grossPerDay: Math.round(plants.reduce((s, f) => s + (f.batches * margin - f.rent) / Math.max(1, f.days), 0) / plants.length),
  } : null;
  const clinicVisits = store.db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind = 'clinic'").get().n;
  const taxPaid = -store.db.prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE kind = 'tax' AND user_id IS NOT NULL").get().s;

  const audit = store.db.prepare(`
    SELECT u.id, u.coins, COALESCE((SELECT SUM(delta) FROM ledger l WHERE l.user_id = u.id AND l.account = 'wallet'), 0) AS ledger
    FROM users u`).all().filter((r) => r.coins !== r.ledger);
  const negative = store.db.prepare('SELECT COUNT(*) AS n FROM users WHERE coins < 0').get().n;
  const prices = market.currentPrices();
  const priceDrift = Object.fromEntries(Object.entries(prices).map(([id, p]) => [id, p / COMMODITIES[id].base]));
  const perBotDay = (v) => Math.round(v / bots / days);
  return {
    daily,
    weeks: store.db.prepare('SELECT * FROM central_bank ORDER BY week').all(),
    perBotDay: { salary: perBotDay(totals.salary), minigame: perBotDay(totals.minigame), food: perBotDay(totals.food), fees: perBotDay(totals.fees), tax: perBotDay(taxPaid) },
    shops: shopStats,
    factories: factoryStats,
    clinicVisits,
    priceDrift,
    auditMismatches: audit.length,
    negativeBalances: negative,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? Number(process.argv[i + 1]) : fallback;
  };
  const started = Date.now();
  const r = simulate({ bots: arg('bots', 60), days: arg('days', 30), seed: arg('seed', 1), elements: !process.argv.includes('--no-elements') });
  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
  console.log(`\nMô phỏng ${arg('bots', 60)} bot × ${arg('days', 30)} ngày (${((Date.now() - started) / 1000).toFixed(1)} giây)\n`);
  console.log('Ngày | TS ròng TB | Thỉnh thoảng | Chăm chỉ | Đầu cơ | Chủ quầy | Chủ xưởng | Chỉ số giá | Lãi cơ bản');
  for (const d of r.daily.filter((x) => x.day % 3 === 0 || x.day === 1)) {
    console.log(`${String(d.day).padStart(4)} | ${fmt(d.avg).padStart(10)} | ${fmt(d.casual).padStart(12)} | ${fmt(d.diligent).padStart(8)} | ${fmt(d.speculator).padStart(6)} | ${fmt(d.merchant).padStart(8)} | ${fmt(d.producer).padStart(9)} | ${d.priceIndex.toFixed(3).padStart(10)} | ${(d.baseRate * 100).toFixed(2)}%`);
  }
  console.log('\nQuầy trà sữa:', r.shops);
  console.log('Xưởng sấy trà:', r.factories, '· lượt khám bệnh:', r.clinicVisits);
  console.log('\nNgân hàng Trung ương:');
  for (const w of r.weeks) console.log(`  ${w.week}: tăng ${(w.growth * 100).toFixed(1)}%/tuần, chỉ số ${w.price_index.toFixed(3)}, lãi ${(w.base_rate * 100).toFixed(2)}%/ngày`);
  console.log('\nMỗi bot mỗi ngày:', r.perBotDay);
  console.log('Giá hiện tại / giá gốc:', Object.fromEntries(Object.entries(r.priceDrift).map(([k, v]) => [k, v.toFixed(2)])));
  console.log(`Đối soát sổ cái: ${r.auditMismatches} lệch · số dư âm: ${r.negativeBalances}`);
}
