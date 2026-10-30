// Cư dân tự động (bot): tài khoản do server tạo, chơi như người chơi bình thường qua đúng các route của game
// (router chạy trong tiến trình, không WebSocket, không gọi HTTP), nên mọi luật đều áp dụng: hạn mức, phí, thuế, Đấu trường.
// Mỗi nhịp bộ lập lịch chỉ xử lý một nhóm nhỏ bot đã tới lượt (`budget` hành động), theo giờ thức/ngủ và nhịp nghỉ như người.
// Cờ users.is_bot chỉ dùng nội bộ và ở bảng quản trị; không bao giờ nằm trong API của người chơi.
import { randomBytes } from 'node:crypto';
import { adminLog, createSession, createUser, db, getMeta, setMeta, transaction } from './db.js';
import { dayKey } from './clock.js';
import { GameError, HOUR, RULES } from './game.js';
import { post } from './ledger.js';
import { buildResponse } from './router.js';

export const BOT_RULES = {
  /** Trần số bot; quản trị viên đặt mục tiêu trong khoảng này. */
  max: 500,
  /** Mỗi nhịp tạo thêm tối đa chừng này bot, để số bot tăng dần tới mục tiêu. */
  rampPerTick: 5,
  /** Mỗi nhịp tối đa chừng này hành động của bot. */
  budget: 25,
  /** Khoảng nghỉ giữa hai lần bot "mở game" (phút), nhân hệ số siêng năng của từng bot. */
  gapMinutes: [25, 110],
  /** Gia tộc của bot không quá tỉ lệ này trên tổng số gia tộc. */
  clanShare: 0.4,
  /** Một gia tộc bot thách đấu gia tộc người thật tối đa 1 lần mỗi 7 ngày. */
  realChallengeDays: 7,
  /** Kênh chung: mỗi bot tối đa 1 câu mỗi ngày, cả server tối đa chừng này câu của bot mỗi giờ. */
  chatPerHour: 12,
  chatChance: 0.08,
};

const DEFAULT_CONFIG = { enabled: false, target: 0 };
const MINUTE_MS = 60_000;

const q = {
  bots: db.prepare('SELECT b.*, u.username, u.display_name, u.coins, u.created_at AS joined FROM bots b JOIN users u ON u.id = b.user_id ORDER BY b.user_id'),
  count: db.prepare('SELECT COUNT(*) AS n FROM bots'),
  due: db.prepare('SELECT * FROM bots WHERE next_at <= ? ORDER BY next_at LIMIT ?'),
  insert: db.prepare('INSERT INTO bots (user_id, token, persona, next_at, created_at) VALUES (?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE bots SET next_at = ?, state = ?, last_action = ?, last_at = ?, actions = actions + 1 WHERE user_id = ?'),
  markBot: db.prepare('UPDATE users SET is_bot = 1, display_name = ? WHERE id = ?'),
  nameTaken: db.prepare('SELECT 1 FROM users WHERE login_key = ?'),
  clanCounts: db.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM users u WHERE u.id = c.leader_id AND u.is_bot = 1) THEN 1 ELSE 0 END), 0) AS bot
    FROM clans c WHERE c.dissolved_at IS NULL`),
  isBot: db.prepare('SELECT is_bot FROM users WHERE id = ?'),
  chatsHour: db.prepare('SELECT COUNT(*) AS n FROM bots WHERE last_chat_at > ?'),
  setChat: db.prepare('UPDATE bots SET last_chat_at = ?, chat_day = ? WHERE user_id = ?'),
};

// ---------------------------------------------------------------- cấu hình

export function botConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(getMeta('bots_config') ?? '{}') };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Quản trị viên bật/tắt và đặt số bot mục tiêu (0–500). Tắt thì nhịp sau mọi bot dừng. */
export function setBotConfig({ enabled, target }, actor = 'Quản trị viên') {
  const cur = botConfig();
  const next = {
    enabled: enabled == null ? cur.enabled : Boolean(enabled),
    target: target == null ? cur.target : Math.max(0, Math.min(BOT_RULES.max, Math.round(Number(target) || 0))),
  };
  setMeta('bots_config', JSON.stringify(next));
  adminLog(actor, 'bots_config', null, next);
  return next;
}

export const isBot = (userId) => Boolean(q.isBot.get(userId)?.is_bot);

// ---------------------------------------------------------------- tên kiểu Việt Nam

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const MIDDLE = ['Văn', 'Thị', 'Minh', 'Ngọc', 'Thanh', 'Hoàng', 'Gia', 'Bảo', 'Thu', 'Đức', 'Hữu', 'Khánh', 'Quốc', 'Thùy', 'Phương', ''];
const GIVEN = ['An', 'Anh', 'Bình', 'Châu', 'Chi', 'Dũng', 'Duy', 'Giang', 'Hà', 'Hải', 'Hân', 'Hiếu', 'Hoa', 'Hùng', 'Huy', 'Khoa', 'Lam', 'Linh',
  'Long', 'Mai', 'Minh', 'My', 'Nam', 'Ngân', 'Nhi', 'Phong', 'Phúc', 'Quân', 'Quỳnh', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Trí', 'Trung', 'Tú', 'Uyên', 'Vy', 'Yến'];
const NICK = ['', '_', 'x', 'z'];
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Họ tên hiển thị và tên đăng nhập (chữ thường không dấu, có thể kèm số) như người thật hay đặt. */
export function makeName(rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const family = pick(FAMILY);
  const middle = pick(MIDDLE);
  const given = pick(GIVEN);
  const display = [family, middle, given].filter(Boolean).join(' ');
  const styles = [
    () => `${strip(given)}${strip(middle)}${Math.floor(rand() * 90 + 10)}`,
    () => `${strip(given)}${pick(NICK)}${strip(family)}`,
    () => `${strip(family)}${strip(given)}${2000 + Math.floor(rand() * 12)}`,
    () => `${strip(given)}_${Math.floor(rand() * 999)}`,
    () => `be${strip(given)}${Math.floor(rand() * 9)}`,
  ];
  const username = pick(styles)().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  return { display, username: username.length >= 3 ? username : `${username}${Math.floor(rand() * 900 + 100)}` };
}

// ---------------------------------------------------------------- tạo bot

/** Tạo một bot: tài khoản thường (không mật khẩu, không qua link mời), xu khởi đầu như người mới, cờ is_bot nội bộ. */
export function createBot(now = Date.now(), rand = Math.random) {
  return transaction(() => {
    let name = makeName(rand);
    for (let i = 0; i < 8 && q.nameTaken.get(name.username); i += 1) name = makeName(rand);
    if (q.nameTaken.get(name.username)) name = { ...name, username: `${name.username.slice(0, 14)}${Math.floor(rand() * 99999)}` };
    const id = createUser(name.username, '', now);
    q.markBot.run(name.display, id);
    post({ userId: id, delta: RULES.startCoins, kind: 'opening', memo: 'Quà chào mừng', now });
    const token = randomBytes(24).toString('hex');
    createSession(token, id);
    const persona = {
      wake: 6 + Math.floor(rand() * 4), // 6–9h
      sleep: 21 + Math.floor(rand() * 3), // 21–23h
      zeal: 0.6 + rand() * 0.8, // siêng năng
      social: rand(),
      trader: rand(),
      fighter: rand(),
    };
    // Lần đầu vào game sau vài phút đến vài giờ, như người mới tải game.
    q.insert.run(id, token, JSON.stringify(persona), now + Math.floor(rand() * 3 * HOUR) + 5 * MINUTE_MS, now);
    return id;
  });
}

// ---------------------------------------------------------------- gọi route như người chơi

/** Gọi một route của game cho bot qua router trong tiến trình. Trả về { ok, status, body }. */
export async function botCall(api, token, method, path, body) {
  const [pathname, search = ''] = path.split('?');
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const req = {
    method, url: path, path: pathname, query: Object.fromEntries(new URLSearchParams(search)), params: {}, body, ip: null,
    get: (name) => headers[String(name).toLowerCase()],
  };
  const { res, done } = buildResponse();
  await Promise.race([api.handle(req, res), done]);
  if (!res.finished) res.status(404).json({ error: 'Không tìm thấy.' });
  const out = await done;
  let parsed = null;
  try {
    parsed = JSON.parse(out.body);
  } catch {
    parsed = null;
  }
  return { ok: out.status < 400, status: out.status, body: parsed };
}

// ---------------------------------------------------------------- hành vi

const CHAT_LINES = [
  'Chào cả nhà, hôm nay mọi người chơi gì thế?', 'Bé nhà mình vừa lên cấp, vui ghê 😆', 'Giá cá trên Sàn hôm nay ổn đấy',
  'Có ai đi câu cá không, mình câu mãi chưa được con to', 'Trà sữa trân châu là chân ái 🧋', 'Chúc mọi người buổi tối vui vẻ nha',
  'Gia tộc mình đang tuyển thêm người, ai rảnh vào chơi cùng nhé', 'Hôm nay trời đẹp, dắt bé đi công viên thôi',
  'Mình mới mua được món trang phục xinh lắm', 'Ai biết cách lên cấp nhanh chỉ mình với', 'Đi làm ca sáng về mệt quá 😴',
  'Siêu thị hôm nay có suất ăn gia tộc ngon lắm', 'Tối nay có trận ở Đấu trường không mọi người?', 'Cố gắng tiết kiệm mua đất thôi 💪',
];

const pickOne = (list, rand) => list[Math.floor(rand() * list.length)];
const vnHour = (now) => new Date(now + 7 * HOUR).getUTCHours();

function awake(persona, now) {
  const h = vnHour(now);
  return h >= persona.wake && h < persona.sleep;
}

/** Lần "mở game" tiếp theo: khoảng nghỉ ngẫu nhiên, hoặc sáng hôm sau nếu đã tới giờ ngủ. */
function nextVisit(persona, now, rand) {
  const [lo, hi] = BOT_RULES.gapMinutes;
  let at = now + Math.round((lo + rand() * (hi - lo)) * MINUTE_MS / persona.zeal);
  if (!awake(persona, at)) {
    const vnNow = new Date(at + 7 * HOUR);
    const wakeDay = vnHour(at) >= persona.sleep ? new Date(vnNow.getTime() + 24 * HOUR) : vnNow;
    const d = wakeDay.toISOString().slice(0, 10);
    at = Date.parse(`${d}T00:00:00Z`) - 7 * HOUR + persona.wake * HOUR + Math.floor(rand() * 90) * MINUTE_MS;
  }
  return at;
}

/**
 * Một lượt "mở game" của bot: xem trạng thái rồi làm 1 việc như người chơi trung bình. Lỗi luật chơi (GameError)
 * thì bỏ qua. Trả về tên việc đã làm (hoặc null).
 */
async function visit(api, bot, persona, state, now, rand) {
  const call = (method, path, body) => botCall(api, bot.token, method, path, body);
  const me = (await call('GET', '/me')).body;
  if (!me?.user) return null;
  const catalog = await catalogOf(api);

  // Bé đầu tiên.
  if (!me.pets.length) {
    const species = pickOne(catalog.species.filter((s) => s.adoptable), rand);
    if (!species) return null;
    const r = await call('POST', '/pets', { name: pickOne(['Mochi', 'Bông', 'Mít', 'Na', 'Bơ', 'Kem', 'Sữa', 'Cún', 'Mèo Ú', 'Bắp', 'Su Su', 'Tôm'], rand), species: species.id });
    return r.ok ? 'adopt' : null;
  }
  const pet = me.pets.find((p) => p.id === me.user.activePetId) ?? me.pets[0];

  // Ván câu cá đang dở: kết thúc với kết quả trung bình.
  if (state.game) {
    const g = state.game;
    delete state.game;
    const casts = 3 + Math.floor(rand() * 6);
    const caught = Array.from({ length: casts }, () => rand() < 0.5);
    const r = await call('POST', '/games/finish', { sessionId: g, result: { caught } });
    return r.ok ? 'game_finish' : null;
  }

  // Quà ngày.
  if (!me.user.dailyReadyAt) {
    const r = await call('POST', '/daily', {});
    if (r.ok) return 'daily';
  }

  // Đói thì mua đồ ăn rồi cho ăn.
  const fullness = pet.stats?.fullness ?? pet.fullness ?? 100;
  if (fullness < 55) {
    const foods = ['onigiri', 'fish', 'boba', 'clan_meal'];
    const have = foods.find((f) => (me.inventory?.[f] ?? 0) > 0);
    if (have) {
      const r = await call('POST', `/pets/${pet.id}/use`, { itemId: have });
      if (r.ok) return 'feed';
    } else {
      const r = await call('POST', '/shop/buy', { itemId: pickOne(foods.slice(0, 3), rand), qty: 1 + Math.floor(rand() * 3) });
      if (r.ok) return 'buy_food';
    }
  }

  // Ca làm đã xong thì nhận lương.
  if (me.badges?.jobs) {
    const jobs = (await call('GET', '/jobs')).body;
    const done = (jobs?.shifts ?? jobs?.active ?? []).find?.((s) => s.ready || s.endsAt <= now);
    if (done) {
      const r = await call('POST', `/jobs/${done.id}/claim`, {});
      if (r.ok) return 'claim_shift';
    }
  }

  const roll = rand();
  // Đi làm (việc chính của người chơi trung bình).
  if (roll < 0.3) {
    const careers = Object.keys(catalog.careers ?? {});
    for (const career of [state.career, ...careers.sort(() => rand() - 0.5).slice(0, 3)].filter(Boolean)) {
      const r = await call('POST', '/jobs/start', { petId: pet.id, career, hours: 1 + Math.floor(rand() * 3) });
      if (r.ok) {
        state.career = career;
        return 'shift';
      }
    }
  }
  // Mini-game câu cá.
  if (roll < 0.45) {
    const r = await call('POST', '/games/fishing/start', {});
    if (r.ok && r.body?.session?.id) {
      state.game = r.body.session.id;
      return 'game_start';
    }
  }
  // Chơi với bé, tắm cho bé.
  if (roll < 0.55) {
    const r = await call('POST', `/pets/${pet.id}/play`, {});
    if (r.ok) return 'play';
  }
  if (roll < 0.6) {
    const r = await call('POST', `/pets/${pet.id}/bath`, {});
    if (r.ok) return 'bath';
  }
  // Sàn: lệnh nhỏ theo thị trường.
  if (roll < 0.66 + persona.trader * 0.05) {
    const commodity = pickOne(Object.keys(catalog.commodities ?? {}), rand);
    const r = await call('POST', '/market/order', { commodity, side: rand() < 0.6 ? 'buy' : 'sell', qty: 1 + Math.floor(rand() * 3), type: 'market' });
    if (r.ok) return 'market';
  }
  // Ngân hàng: gửi một phần nhỏ khi có dư.
  if (roll < 0.72 && me.user.coins > 1500) {
    const r = await call('POST', '/bank/savings', { action: 'deposit', amount: Math.floor(me.user.coins * (0.1 + rand() * 0.2)) });
    if (r.ok) return 'bank';
  }
  // Gia tộc, đất, Đấu trường.
  if (roll < 0.86) {
    const done = await clanStep(call, me, persona, state, now, rand);
    if (done) return done;
  }
  // Kênh chung: hiếm, câu soạn sẵn.
  if (roll < 0.9 && rand() < BOT_RULES.chatChance * (0.5 + persona.social)) {
    const done = await chatStep(call, bot, now, rand);
    if (done) return done;
  }
  return 'browse';
}

/** Việc gia tộc: vào/lập gia tộc, góp quỹ, mua đất, chọn giờ khi bị thách, thách đấu (theo luật Đấu trường). */
async function clanStep(call, me, persona, state, now, rand) {
  const view = (await call('GET', '/clans')).body;
  if (!view) return null;
  const clan = view.clan;
  if (!clan) {
    const open = (view.clans ?? []).filter((c) => (c.members ?? 0) < 30);
    if (open.length && rand() < 0.8) {
      const target = pickOne(open, rand);
      const r = await call('POST', `/clans/${target.id}/join`, {});
      if (r.ok) return 'clan_join';
    }
    const counts = q.clanCounts.get();
    if (counts.bot < BOT_RULES.clanShare * Math.max(1, counts.total + 1) && rand() < 0.3) {
      const r = await call('POST', '/clans/create', {
        name: `${pickOne(['Nhà', 'Họ', 'Hội', 'Bang', 'Phố'], rand)} ${pickOne(['Mây', 'Gió', 'Sen', 'Trúc', 'Mai', 'Lúa', 'Sóng', 'Đá', 'Rồng', 'Phượng'], rand)} ${pickOne(['Vàng', 'Xanh', 'Đỏ', 'Bạc', 'Ngọc', 'Hồng'], rand)}`,
        emblem: pickOne(['🏯', '🐉', '🌾', '🌸', '⚓', '🐯', '💎'], rand), color: pickOne(['#aa5533', '#2266aa', '#338844', '#884499', '#cc8800'], rand),
      });
      if (r.ok) return 'clan_create';
    }
    return null;
  }
  // Góp quỹ một ít mỗi tuần.
  if (rand() < 0.4 && me.user.coins > 800) {
    const r = await call('POST', '/clans/donate', { amount: Math.floor(me.user.coins * (0.05 + rand() * 0.1)) });
    if (r.ok) return 'clan_donate';
  }
  const manage = clan.role === 'leader' || clan.role === 'elder';
  if (!manage) return null;
  // Bị thách đấu: chọn khung đầu tiên còn hạn.
  const arena = (await call('GET', '/arena')).body;
  const pending = arena?.clan?.wars?.find((w) => w.status === 'proposed' && w.defender.id === clan.id);
  if (pending) {
    const slot = pending.slots.find((s) => s > now);
    if (slot) {
      const r = await call('POST', `/arena/${pending.id}/confirm`, { at: slot });
      if (r.ok) return 'arena_confirm';
    }
  }
  // Mua đất khi quỹ dư (chọn lô rẻ còn trống).
  if (rand() < 0.3) {
    const land = (await call('GET', '/land')).body;
    const free = (land?.plots ?? []).filter((p) => !p.owner && p.price && p.price < (clan.treasury ?? 0) * 0.5).sort((a, b) => a.price - b.price);
    if (free.length) {
      const r = await call('POST', `/land/${free[Math.floor(rand() * Math.min(5, free.length))].id}/buy`, {});
      if (r.ok) return 'land_buy';
    }
  }
  // Thách đấu: hiếm, gia tộc thích đánh; gia tộc người thật chỉ 1 lần mỗi 7 ngày.
  if (arena?.clan && persona.fighter > 0.6 && rand() < 0.15 && clan.role === 'leader') {
    const busy = arena.clan.wars.some((w) => w.status === 'proposed' || w.status === 'scheduled');
    const targets = arena.clan.targets.filter((t) => t.kind === 'plot' && (!botClanRecent(state, t.clanId, now)));
    if (!busy && targets.length) {
      const t = pickOne(targets, rand);
      const days = arena.days;
      const slot = { day: days[1 + Math.floor(rand() * Math.min(4, days.length - 1))] ?? days[0], hour: rand() < 0.5 ? 19 : 20 };
      const r = await call('POST', '/arena/challenge', { defenderId: t.clanId, kind: t.kind, ref: t.ref, slots: [slot] });
      if (r.ok) {
        if (!clanIsBot(t.clanId)) state.realChallengeAt = now;
        return 'arena_challenge';
      }
    }
  }
  return null;
}

const clanLeaderBot = db.prepare('SELECT u.is_bot FROM clans c JOIN users u ON u.id = c.leader_id WHERE c.id = ?');
const clanIsBot = (clanId) => Boolean(clanLeaderBot.get(clanId)?.is_bot);
/** Đã thách đấu một gia tộc người thật trong 7 ngày qua thì không thách gia tộc người thật nữa. */
export const botClanRecent = (state, clanId, now) => Boolean(!clanIsBot(clanId) && state.realChallengeAt && now - state.realChallengeAt < BOT_RULES.realChallengeDays * 24 * HOUR);

async function chatStep(call, bot, now, rand) {
  const day = dayKey(now);
  if (bot.chat_day === day) return null;
  if (q.chatsHour.get(now - HOUR).n >= BOT_RULES.chatPerHour) return null;
  const r = await call('POST', '/chat/world', { text: pickOne(CHAT_LINES, rand) });
  if (!r.ok) return null;
  q.setChat.run(now, day, bot.user_id);
  return 'chat';
}

let catalogCache = null;
async function catalogOf(api) {
  if (!catalogCache) catalogCache = (await botCall(api, '', 'GET', '/catalog')).body ?? { species: [], careers: {}, commodities: {} };
  return catalogCache;
}

// ---------------------------------------------------------------- nhịp

/**
 * Một nhịp của bot (gọi từ bộ lập lịch mỗi phút). Tắt thì không làm gì. Tạo thêm bot từ từ tới mục tiêu, rồi cho
 * tối đa `budget` bot đã tới lượt "mở game" một lần. Trả về { created, actions }.
 */
export async function runBots(api, now = Date.now(), rand = Math.random, { budget = BOT_RULES.budget } = {}) {
  const cfg = botConfig();
  if (!cfg.enabled) return { created: 0, actions: 0, skipped: 0 };
  let created = 0;
  const have = q.count.get().n;
  const want = Math.min(cfg.target, BOT_RULES.max);
  for (let i = have; i < want && created < BOT_RULES.rampPerTick; i += 1) {
    createBot(now, rand);
    created += 1;
  }
  let actions = 0;
  let skipped = 0;
  for (const bot of q.due.all(now, budget)) {
    const persona = JSON.parse(bot.persona);
    const state = bot.state ? JSON.parse(bot.state) : {};
    let action = null;
    if (awake(persona, now)) {
      try {
        action = await visit(api, bot, persona, state, now, rand);
      } catch (err) {
        // Không bao giờ để một bot làm hỏng cả nhịp.
        if (!(err instanceof GameError)) console.error('Bot lỗi:', bot.user_id, err?.message);
        skipped += 1;
      }
      actions += 1;
    }
    q.update.run(nextVisit(persona, now, rand), JSON.stringify(state), action, now, bot.user_id);
  }
  return { created, actions, skipped };
}

// ---------------------------------------------------------------- quản trị

export function adminBotsView() {
  const rows = q.bots.all();
  const stats = db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(is_bot), 0) AS bots FROM users').get();
  return {
    config: botConfig(),
    rules: BOT_RULES,
    count: rows.length,
    players: { total: stats.total, bots: stats.bots, real: stats.total - stats.bots },
    bots: rows.map((b) => ({
      userId: b.user_id, username: b.username, displayName: b.display_name, coins: b.coins, joinedAt: b.joined,
      lastAction: b.last_action, lastAt: b.last_at, nextAt: b.next_at, actions: b.actions,
      level: db.prepare('SELECT MAX(level) AS l FROM pets WHERE owner_id = ?').get(b.user_id).l ?? 0,
    })),
  };
}
