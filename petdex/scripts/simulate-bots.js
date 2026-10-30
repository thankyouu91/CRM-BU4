// Mô phỏng cư dân tự động: N bot (mặc định 1000) chơi qua đúng router của game trong vài ngày giả lập, trên DB tạm trong RAM.
// Báo lượng xu toàn server (ví, tiết kiệm, tiền gửi, lệnh Sàn, quỹ gia tộc) mỗi ngày và mức tăng quy ra tuần,
// để so với mục tiêu 10%/tuần ±3 điểm của Ngân hàng Trung ương.
// Chạy: node petdex/scripts/simulate-bots.js --bots 1000 --days 3 [--step 1] [--supply <lượng xu hiện tại của server>]
process.env.PETDEX_DB = ':memory:';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const BOTS = Number(args.bots ?? 1000);
const DAYS = Number(args.days ?? 3);
const STEP_MIN = Number(args.step ?? 1); // phút giả lập mỗi nhịp (thật là 1 phút)

// Đồng hồ giả lập: route của game đọc Date.now(), nên chỉnh luôn Date.now cho cả tiến trình mô phỏng.
const START = Date.parse('2026-11-02T00:00:00Z'); // 7h sáng giờ Việt Nam
let clock = START;
Date.now = () => clock;

const store = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { runDue } = await import('../server/scheduler.js');
const { api } = await import('../server/routes.js');
const bots = await import('../server/bots.js');
const { dayKey } = await import('../server/clock.js');

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
const rand = seeded(2026);

const supply = () => store.db.prepare(`
  SELECT (SELECT COALESCE(SUM(coins), 0) FROM users)
       + (SELECT COALESCE(SUM(savings), 0) FROM bank_accounts)
       + (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE closed_at IS NULL)
       + (SELECT COALESCE(SUM(locked), 0) FROM orders WHERE status = 'open')
       + (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE id != 'treasury') AS total`).get().total;

export async function simulateBots({ bots: n = BOTS, days = DAYS, step = STEP_MIN, onlineMin = null, onlineMax = null, log = console.log } = {}) {
  migrate(clock);
  runDue(clock, rand);
  // Mặc định số bot online cùng lúc theo cùng tỉ lệ với 1000 bot ↔ 50–100 online.
  bots.setBotConfig({ enabled: true, target: n, onlineMin: onlineMin ?? Math.round(n * 0.05), onlineMax: onlineMax ?? Math.round(n * 0.1) }, 'mô phỏng');
  // Tạo đủ bot trước (tăng dần 5 bot mỗi nhịp như thật, nhưng không tính giờ).
  while (store.db.prepare('SELECT COUNT(*) AS n FROM bots').get().n < n) await bots.runBots(api, clock, rand, { budget: 0 });
  const base = supply();
  const rows = [];
  let actions = 0;
  let prev = base;
  const ticks = [];
  for (let d = 1; d <= days; d += 1) {
    const end = clock + 24 * 3_600_000;
    for (; clock < end; clock += step * 60_000) {
      runDue(clock, rand);
      const t = await bots.runBots(api, clock, rand);
      actions += t.actions;
      ticks.push(t);
    }
    const s = supply();
    const day = (s - prev) / prev;
    rows.push({ day: dayKey(clock - 1), supply: s, perBot: Math.round(s / n), dayGrowth: day, weekly: (1 + day) ** 7 - 1, actions });
    log(`Ngày ${d}: lượng xu ${s.toLocaleString('vi-VN')} (${(day * 100).toFixed(2)}%/ngày, quy ra ${(((1 + day) ** 7 - 1) * 100).toFixed(1)}%/tuần), ${actions} lượt bot`);
    prev = s;
    actions = 0;
  }
  const total = (prev - base) / base;
  const weekly = (1 + total) ** (7 / days) - 1;
  const levels = store.db.prepare('SELECT AVG(level) AS avg, MAX(level) AS max FROM pets p JOIN users u ON u.id = p.owner_id WHERE u.is_bot = 1').get();
  const acts = store.db.prepare('SELECT last_action AS a, COUNT(*) AS n FROM bots GROUP BY last_action ORDER BY n DESC').all();
  // Bot bắt đầu từ xu khởi đầu nên % tăng của riêng ví bot rất cao (như người mới). Điều cần đo là lượng xu bot tạo thêm
  // so với lượng xu của cả server: tối đa 3 điểm %/tuần thì nằm trong biên mục tiêu.
  const injectedWeek = ((prev - base) / days) * 7;
  const perBotDay = (prev - base) / days / n;
  log(`Bot tạo thêm ${Math.round(injectedWeek).toLocaleString('vi-VN')} xu/tuần (${perBotDay.toFixed(1)} xu mỗi bot mỗi ngày).`);
  log(`Để bot đẩy mức tăng lượng xu thêm tối đa 3 điểm %/tuần, server cần lượng xu từ ${Math.round(injectedWeek / 0.03).toLocaleString('vi-VN')} trở lên${args.supply ? `; với lượng xu ${Number(args.supply).toLocaleString('vi-VN')}, bot đẩy thêm ${((injectedWeek / Number(args.supply)) * 100).toFixed(2)} điểm %/tuần` : ''}.`);
  log(`Riêng ví bot: ${(total * 100).toFixed(2)}% sau ${days} ngày (bot mới bắt đầu từ xu khởi đầu).`);
  const ms = ticks.map((t) => t.ms ?? 0).sort((a, b) => a - b);
  const online = ticks.map((t) => t.online);
  const evening = ticks.filter((_, i) => { const h = new Date(START + i * step * 60_000 + 7 * 3_600_000).getUTCHours(); return h >= 19 && h < 22; }).map((t) => t.online);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  log(`Online cùng lúc: trung bình ${avg(online).toFixed(0)}, buổi tối ${avg(evening).toFixed(0)}, thấp nhất ${Math.min(...online)}, cao nhất ${Math.max(...online)}.`);
  log(`Thời gian mỗi nhịp: trung vị ${ms[Math.floor(ms.length / 2)]} ms, p95 ${ms[Math.floor(ms.length * 0.95)]} ms, cao nhất ${ms[ms.length - 1]} ms; dừng vì hết thời gian ${ticks.filter((t) => t.stopped === 'time').length} nhịp.`);
  log(`Cấp bé của bot: trung bình ${levels.avg?.toFixed(1)}, cao nhất ${levels.max}. Việc gần nhất: ${acts.map((r) => `${r.a ?? '—'} ${r.n}`).join(', ')}`);
  const lv = store.db.prepare('SELECT COALESCE(MAX(p.level), 0) AS l FROM bots b LEFT JOIN pets p ON p.owner_id = b.user_id GROUP BY b.user_id ORDER BY l').all().map((r) => r.l);
  const inClan = store.db.prepare('SELECT COUNT(*) AS n FROM bots b JOIN clan_members m ON m.user_id = b.user_id').get().n;
  const count = (sql) => store.db.prepare(sql).get().n;
  log(`Cấp bé: trung vị ${lv[Math.floor(lv.length / 2)] ?? 0}, p90 ${lv[Math.floor(lv.length * 0.9)] ?? 0}; ${Math.round((inClan / n) * 100)}% bot ở gia tộc; `
    + `${count('SELECT COUNT(*) AS n FROM businesses WHERE closed_at IS NULL')} quầy, ${count('SELECT COUNT(*) AS n FROM factories WHERE closed_at IS NULL')} xưởng, `
    + `${count('SELECT COUNT(DISTINCT user_id) AS n FROM garden_plots WHERE crop IS NOT NULL')} vườn đang trồng; ${(count('SELECT COUNT(*) AS n FROM market_trades t JOIN bots b ON b.user_id = t.user_id') / n / days).toFixed(2)} lệnh Sàn khớp mỗi bot mỗi ngày.`);
  return { base, rows, total, weekly, injectedWeek, perBotDay, ticks };
}

if (import.meta.url === `file://${process.argv[1]}`) await simulateBots();
