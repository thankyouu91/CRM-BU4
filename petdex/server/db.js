import { GameError } from './game.js';
import { sumBonus } from '../../public/ta-tua/game/js/shared/gear.js';
import { db, hasBackend, setBackend, transaction } from './sql/backend.js';

export { db, transaction };

const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

/**
 * Tạo bảng còn thiếu và thêm cột cho bảng cũ. Gọi sau khi cắm backend (Node: tự chạy ở cuối file;
 * Durable Object: trong constructor). Chạy lại bao nhiêu lần cũng được.
 */
/** Khóa so tên đăng nhập: NFC, viết thường (cả chữ có dấu). */
export const loginKey = (name) => String(name ?? '').normalize('NFC').trim().toLowerCase();

export function ensureSchema() {
  db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash     TEXT NOT NULL,
    coins         INTEGER NOT NULL,
    active_pet_id INTEGER,
    last_daily_at INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    species    TEXT NOT NULL,
    born_at    INTEGER NOT NULL,
    level      INTEGER NOT NULL DEFAULT 1,
    xp         INTEGER NOT NULL DEFAULT 0,
    fullness   REAL NOT NULL DEFAULT 70,
    happiness  REAL NOT NULL DEFAULT 80,
    energy     REAL NOT NULL DEFAULT 100,
    accessory  TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS pets_owner ON pets(owner_id);
  CREATE INDEX IF NOT EXISTS pets_rank ON pets(level DESC, xp DESC);

  CREATE TABLE IF NOT EXISTS inventory (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    qty     INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  -- Sổ cái: mọi thay đổi xu. account: 'wallet' | 'savings' (của user_id) hoặc tài khoản chung như 'treasury'.
  CREATE TABLE IF NOT EXISTS ledger (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER,
    account       TEXT NOT NULL,
    delta         INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    kind          TEXT NOT NULL,
    memo          TEXT,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id, id);
  CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0);

  CREATE TABLE IF NOT EXISTS pet_skills (
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    skill  TEXT NOT NULL,
    value  REAL NOT NULL,
    PRIMARY KEY (pet_id, skill)
  );

  CREATE TABLE IF NOT EXISTS careers (
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    career TEXT NOT NULL,
    rank   INTEGER NOT NULL DEFAULT 1,
    hours  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (pet_id, career)
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pet_id     INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    career     TEXT NOT NULL,
    rank       INTEGER NOT NULL,
    hours      INTEGER NOT NULL,
    pay        INTEGER NOT NULL,
    day        TEXT NOT NULL,
    starts_at  INTEGER NOT NULL,
    ends_at    INTEGER NOT NULL,
    claimed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS shifts_user ON shifts(user_id, claimed_at);

  CREATE TABLE IF NOT EXISTS commodity_state (
    commodity  TEXT PRIMARY KEY,
    price      REAL NOT NULL,
    drift      REAL NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS commodity_prices (
    commodity TEXT NOT NULL,
    at        INTEGER NOT NULL,
    price     REAL NOT NULL,
    PRIMARY KEY (commodity, at)
  );
  -- Thông báo của ban quản lý (bảng quản lý đăng): ghim đầu Báo Trân Châu và bật lên một lần cho mỗi người chơi.
  CREATE TABLE IF NOT EXISTS announcements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    popup      INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    starts_at  INTEGER NOT NULL,
    ends_at    INTEGER NOT NULL,
    removed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS news (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    commodity  TEXT,
    headline   TEXT NOT NULL,
    effect     REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    starts_at  INTEGER NOT NULL,
    ends_at    INTEGER NOT NULL
  );

  -- Kho nguyên liệu theo từng lần nhập (đơn vị: phần) để tính hư hỏng.
  CREATE TABLE IF NOT EXISTS lots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commodity   TEXT NOT NULL,
    qty         INTEGER NOT NULL,
    acquired_at INTEGER NOT NULL,
    expires_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS lots_user ON lots(user_id, commodity);

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commodity        TEXT NOT NULL,
    side             TEXT NOT NULL,
    qty              INTEGER NOT NULL,
    filled           INTEGER NOT NULL DEFAULT 0,
    limit_price      REAL NOT NULL,
    locked           INTEGER NOT NULL DEFAULT 0,
    goods_expires_at INTEGER,
    status           TEXT NOT NULL,
    day              TEXT NOT NULL,
    created_at       INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_book ON orders(commodity, status, side);

  CREATE TABLE IF NOT EXISTS npc_flow (
    user_id   INTEGER NOT NULL,
    day       TEXT NOT NULL,
    commodity TEXT NOT NULL,
    bought    INTEGER NOT NULL DEFAULT 0,
    sold      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day, commodity)
  );

  CREATE TABLE IF NOT EXISTS bank_accounts (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    savings    INTEGER NOT NULL DEFAULT 0,
    accrued    REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS deposits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     INTEGER NOT NULL,
    rate       REAL NOT NULL,
    term_days  INTEGER NOT NULL,
    opened_at  INTEGER NOT NULL,
    matures_at INTEGER NOT NULL,
    closed_at  INTEGER,
    payout     INTEGER
  );
  CREATE TABLE IF NOT EXISTS central_bank (
    week             TEXT PRIMARY KEY,
    money_per_player REAL NOT NULL,
    growth           REAL NOT NULL,
    price_index      REAL NOT NULL,
    base_rate        REAL NOT NULL,
    players          INTEGER NOT NULL,
    at               INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS minigame_sessions (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pet_id      INTEGER NOT NULL,
    game        TEXT NOT NULL,
    seed        INTEGER NOT NULL,
    started_at  INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS minigame_days (
    user_id INTEGER NOT NULL,
    day     TEXT NOT NULL,
    coins   INTEGER NOT NULL DEFAULT 0,
    fish    INTEGER NOT NULL DEFAULT 0,
    pearl   INTEGER NOT NULL DEFAULT 0,
    plays   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS networth (
    user_id INTEGER NOT NULL,
    day     TEXT NOT NULL,
    total   INTEGER NOT NULL,
    detail  TEXT NOT NULL,
    PRIMARY KEY (user_id, day)
  );

  -- Quầy trà sữa: mỗi người một quầy, dùng nguyên liệu trong kho của chủ.
  CREATE TABLE IF NOT EXISTS businesses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    location    TEXT NOT NULL,
    reputation  REAL NOT NULL DEFAULT 1,
    menu        TEXT NOT NULL DEFAULT '[]',
    upgrades    TEXT NOT NULL DEFAULT '{}',
    promo_until INTEGER NOT NULL DEFAULT 0,
    unpaid_days INTEGER NOT NULL DEFAULT 0,
    sim_at      INTEGER NOT NULL,
    opened_at   INTEGER NOT NULL,
    closed_at   INTEGER
  );
  CREATE TABLE IF NOT EXISTS business_days (
    business_id INTEGER NOT NULL,
    day         TEXT NOT NULL,
    cups        INTEGER NOT NULL DEFAULT 0,
    customers   INTEGER NOT NULL DEFAULT 0,
    lost        INTEGER NOT NULL DEFAULT 0,
    revenue     INTEGER NOT NULL DEFAULT 0,
    cogs        INTEGER NOT NULL DEFAULT 0,
    rent        INTEGER NOT NULL DEFAULT 0,
    wages       INTEGER NOT NULL DEFAULT 0,
    tax         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (business_id, day)
  );
  CREATE TABLE IF NOT EXISTS job_posts (
    business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    wage        INTEGER NOT NULL,
    slots       INTEGER NOT NULL,
    open        INTEGER NOT NULL DEFAULT 1
  );

  -- Thị trấn: hiệu ứng đang chạy, đề xuất và phiếu bầu theo tuần.
  CREATE TABLE IF NOT EXISTS town_effects (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    kind      TEXT NOT NULL,
    target    TEXT,
    value     REAL NOT NULL,
    label     TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS proposals (
    week     TEXT NOT NULL,
    option   TEXT NOT NULL,
    votes    INTEGER NOT NULL DEFAULT 0,
    status   TEXT NOT NULL DEFAULT 'open',
    PRIMARY KEY (week, option)
  );
  CREATE TABLE IF NOT EXISTS votes (
    week    TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    option  TEXT NOT NULL,
    PRIMARY KEY (week, user_id)
  );
  CREATE TABLE IF NOT EXISTS tax_days (
    user_id   INTEGER NOT NULL,
    day       TEXT NOT NULL,
    taxable   INTEGER NOT NULL,
    tax       INTEGER NOT NULL,
    paid      INTEGER NOT NULL,
    breakdown TEXT NOT NULL,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS friends (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status    TEXT NOT NULL,
    since     INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  );
  CREATE TABLE IF NOT EXISTS friend_likes (
    user_id   INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    day       TEXT NOT NULL,
    PRIMARY KEY (user_id, friend_id, day)
  );
  CREATE TABLE IF NOT EXISTS gifts_sent (
    user_id INTEGER NOT NULL,
    day     TEXT NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS guilds (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    emblem     TEXT NOT NULL,
    leader_id  INTEGER NOT NULL,
    upgrades   TEXT NOT NULL DEFAULT '{}',
    prestige   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS guild_members (
    user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    guild_id  INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    donated   INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS guild_projects (
    guild_id  INTEGER NOT NULL,
    week      TEXT NOT NULL,
    project   TEXT NOT NULL,
    progress  TEXT NOT NULL DEFAULT '{}',
    done_at   INTEGER,
    PRIMARY KEY (guild_id, week)
  );

  -- Giai đoạn 2: sức khỏe, trường học, vườn, bếp, xưởng, hợp đồng, Chợ Phiên, vay.
  CREATE TABLE IF NOT EXISTS insurance (user_id INTEGER PRIMARY KEY, plan TEXT NOT NULL, since INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS school_log (
    pet_id INTEGER NOT NULL, day TEXT NOT NULL, skill TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (pet_id, day, skill)
  );
  CREATE TABLE IF NOT EXISTS garden_plots (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idx        INTEGER NOT NULL,
    crop       TEXT,
    planted_at INTEGER,
    ready_at   INTEGER,
    watered    TEXT NOT NULL DEFAULT '[]',
    pests_at   INTEGER,
    pests_cleared INTEGER NOT NULL DEFAULT 0,
    seed_cost  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, idx)
  );
  CREATE TABLE IF NOT EXISTS garden_help (user_id INTEGER NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day));
  CREATE TABLE IF NOT EXISTS recipes_known (user_id INTEGER NOT NULL, recipe TEXT NOT NULL, PRIMARY KEY (user_id, recipe));
  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe TEXT NOT NULL, quality INTEGER NOT NULL, made_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS factories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 0,
    toll_fee    INTEGER NOT NULL DEFAULT 0,
    toll_open   INTEGER NOT NULL DEFAULT 0,
    unpaid_days INTEGER NOT NULL DEFAULT 0,
    sim_at      INTEGER NOT NULL,
    built_at    INTEGER NOT NULL,
    closed_at   INTEGER
  );
  CREATE TABLE IF NOT EXISTS factory_days (
    factory_id INTEGER NOT NULL, day TEXT NOT NULL, batches INTEGER NOT NULL DEFAULT 0, toll_batches INTEGER NOT NULL DEFAULT 0,
    toll_income INTEGER NOT NULL DEFAULT 0, rent INTEGER NOT NULL DEFAULT 0, wages INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (factory_id, day)
  );
  CREATE TABLE IF NOT EXISTS factory_jobs (
    factory_id INTEGER PRIMARY KEY REFERENCES factories(id) ON DELETE CASCADE,
    wage INTEGER NOT NULL, slots INTEGER NOT NULL, open INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS toll_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, factory_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    batches INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, fee INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, buyer_id INTEGER NOT NULL, proposer_id INTEGER NOT NULL,
    commodity TEXT NOT NULL, qty INTEGER NOT NULL, price REAL NOT NULL, days INTEGER NOT NULL, days_left INTEGER NOT NULL,
    buyer_escrow INTEGER NOT NULL DEFAULT 0, seller_escrow INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
    created_at INTEGER NOT NULL, accepted_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
    quality INTEGER NOT NULL DEFAULT 0, made_at INTEGER, price INTEGER NOT NULL, ref_price INTEGER NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, buyer_id INTEGER, sold_at INTEGER, status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    principal INTEGER NOT NULL, remaining INTEGER NOT NULL, rate REAL NOT NULL, term_days INTEGER NOT NULL,
    opened_at INTEGER NOT NULL, due_at INTEGER NOT NULL, late_days INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS credit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS eggs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    element    TEXT NOT NULL,
    species    TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    hatch_at   INTEGER NOT NULL,
    hatched_at INTEGER,
    pet_id     INTEGER
  );
  CREATE TABLE IF NOT EXISTS memorials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    species         TEXT NOT NULL,
    element         TEXT,
    rarity          TEXT NOT NULL,
    level           INTEGER NOT NULL,
    weeks           INTEGER NOT NULL,
    born_at         INTEGER NOT NULL,
    died_at         INTEGER NOT NULL,
    wear            TEXT NOT NULL DEFAULT '{}',
    skills          TEXT NOT NULL DEFAULT '{}',
    traits          TEXT NOT NULL DEFAULT '[]',
    heirloom_skill  TEXT,
    heirloom_used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS pet_wear (
    pet_id  INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    slot    TEXT NOT NULL,
    item_id TEXT NOT NULL,
    PRIMARY KEY (pet_id, slot)
  );
  CREATE TABLE IF NOT EXISTS gains (user_id INTEGER NOT NULL, day TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day));

  CREATE TABLE IF NOT EXISTS quests (
    user_id    INTEGER NOT NULL,
    day        TEXT NOT NULL,
    slot       INTEGER NOT NULL,
    quest      TEXT NOT NULL,
    progress   INTEGER NOT NULL DEFAULT 0,
    claimed_at INTEGER,
    PRIMARY KEY (user_id, day, slot)
  );
`);

/** Thêm cột cho bảng cũ nếu chưa có (SQLite không có ADD COLUMN IF NOT EXISTS). */
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('pets', 'busy_from', 'INTEGER');
addColumn('pets', 'busy_until', 'INTEGER');
addColumn('pets', 'busy_kind', 'TEXT'); // bé bận việc gì: 'work' | 'school' | 'bath' (trống = ca làm cũ)
addColumn('pet_wear', 'gear_id', 'INTEGER'); // bản trang phục đang đeo (bảng gear)
// Sàn: giá theo luật game (chưa tính lực mua bán của người chơi), áp lực mua bán, pha thị trường ẩn.
addColumn('commodity_state', 'rule_price', 'REAL');
addColumn('commodity_state', 'pressure', 'REAL NOT NULL DEFAULT 0');
addColumn('commodity_state', 'regime', "TEXT NOT NULL DEFAULT 'calm'");
db.exec('UPDATE commodity_state SET rule_price = price WHERE rule_price IS NULL');
addColumn('news', 'flash', 'INTEGER NOT NULL DEFAULT 0'); // 1 = tin sốt/sập giá: giá đã nhảy, không tính vào giá trung bình
db.exec(`
  -- Sổ giao dịch trên Sàn: mỗi lần khớp (mua hoặc bán) một dòng; bán thì có giá vốn và lãi/lỗ đã chốt.
  CREATE TABLE IF NOT EXISTS market_trades (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    commodity  TEXT NOT NULL,
    side       TEXT NOT NULL,
    qty        INTEGER NOT NULL,
    price      REAL NOT NULL,
    amount     INTEGER NOT NULL,
    fee        INTEGER NOT NULL DEFAULT 0,
    cost       REAL NOT NULL DEFAULT 0,
    pnl        REAL,
    at         INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS market_trades_user ON market_trades(user_id, at DESC);
`);
addColumn('users', 'warehouse', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'advanced', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'streak', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'daily_day', 'TEXT');
addColumn('users', 'tax_due', 'INTEGER NOT NULL DEFAULT 0');
addColumn('shifts', 'business_id', 'INTEGER');
addColumn('shifts', 'wage', 'INTEGER NOT NULL DEFAULT 0');
addColumn('shifts', 'factory_id', 'INTEGER');
addColumn('pets', 'hygiene', 'REAL NOT NULL DEFAULT 80');
addColumn('pets', 'health', 'REAL NOT NULL DEFAULT 90');
addColumn('pets', 'sick', 'TEXT');
addColumn('pets', 'traits', "TEXT NOT NULL DEFAULT '[]'");
addColumn('lots', 'cost', 'REAL NOT NULL DEFAULT 0');
addColumn('orders', 'goods_cost', 'REAL NOT NULL DEFAULT 0');
addColumn('users', 'credit', 'INTEGER NOT NULL DEFAULT 500');
addColumn('users', 'loan_ban_until', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'plots', 'INTEGER NOT NULL DEFAULT 4');
addColumn('contracts', 'delivered', 'INTEGER NOT NULL DEFAULT 0');
addColumn('contracts', 'broken_by', 'INTEGER');
addColumn('contracts', 'last_day', 'TEXT');
addColumn('contracts', 'ended_at', 'INTEGER');
addColumn('loans', 'fees', 'INTEGER NOT NULL DEFAULT 0');
addColumn('loans', 'paid_days', 'INTEGER NOT NULL DEFAULT 0');
addColumn('pets', 'health_avg', 'REAL NOT NULL DEFAULT 80');
addColumn('pets', 'health_days', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'locked_slots', 'INTEGER NOT NULL DEFAULT 0');

  // ---- WorkHub (Pet Town): tài khoản liên kết, khách mời và nhật ký quản trị ----
  addColumn('users', 'kind', "TEXT NOT NULL DEFAULT 'player'"); // 'member' (nhân viên WorkHub) | 'guest' (khách mời) | 'player' (đăng ký trực tiếp)
  addColumn('users', 'crm_user_id', 'TEXT');
  addColumn('users', 'display_name', 'TEXT');
  addColumn('users', 'banned', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'invite_id', 'INTEGER');
  addColumn('users', 'last_seen_at', 'INTEGER NOT NULL DEFAULT 0');
  // Khóa đăng nhập: tên đã chuẩn hóa NFC và viết thường đủ cả chữ có dấu (COLLATE NOCASE chỉ gộp A–Z).
  addColumn('users', 'login_key', 'TEXT');
  const unkeyed = db.prepare('SELECT id, username FROM users WHERE login_key IS NULL').all();
  const setKey = db.prepare('UPDATE users SET login_key = ? WHERE id = ?');
  for (const u of unkeyed) setKey.run(loginKey(u.username), u.id);
  db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_crm ON users(crm_user_id) WHERE crm_user_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS users_login_key ON users(login_key);
  CREATE TABLE IF NOT EXISTS guest_invites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    max_uses   INTEGER,
    uses       INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS admin_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    user_id    INTEGER,
    details    TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS admin_log_time ON admin_log(id DESC);
  -- Trang phục người chơi sở hữu: mỗi món một bản, có cấp và các dòng chỉ số (JSON { income, stats, trade, luck }).
  -- listed = 1 khi đang bày bán ở Chợ Phiên (không đeo được, không ai khác thấy trong tủ đồ).
  CREATE TABLE IF NOT EXISTS gear (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id    TEXT NOT NULL,
    tier       TEXT NOT NULL,
    affixes    TEXT NOT NULL DEFAULT '{}',
    source     TEXT NOT NULL,
    listed     INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS gear_owner ON gear(owner_id);
  -- Đấu giá trang phục ở Chợ Phiên: món nằm ở gear (listed = 1) tới khi phiên đóng; giá đang dẫn bị giữ khỏi ví người trả.
  CREATE TABLE IF NOT EXISTS auctions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gear_id     INTEGER NOT NULL,
    start_price INTEGER NOT NULL,
    ref_price   INTEGER NOT NULL,
    top_bid     INTEGER,
    top_bidder  INTEGER,
    bids        INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    ends_at     INTEGER NOT NULL,
    closed_at   INTEGER,
    status      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auctions_open ON auctions(status, ends_at);
  -- Mã quà: quản trị viên tạo, người chơi nhập trong game. rewards = JSON { coins, items: { mã món: số lượng }, gear: [{ itemId, tier }] }.
  CREATE TABLE IF NOT EXISTS gift_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    label      TEXT NOT NULL,
    rewards    TEXT NOT NULL,
    max_uses   INTEGER,
    uses       INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS gift_redemptions (
    code_id    INTEGER NOT NULL REFERENCES gift_codes(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (code_id, user_id)
  );
  -- Link đặt mật khẩu do quản trị viên tạo: dùng một lần, có hạn; chỉ lưu mã đã băm.
  CREATE TABLE IF NOT EXISTS password_links (
    code_hash  TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER
  );
  CREATE INDEX IF NOT EXISTS password_links_user ON password_links(user_id);
  `);
  // Sau khi đã có bảng gear: hộp mua ở Siêu thị chưa mở thì chưa lộ dòng chỉ số.
  addColumn('gear', 'sealed', 'INTEGER NOT NULL DEFAULT 0');

  // ---- Gia tộc & Sở Nhà Đất (clans.js, macro.js) ----
  db.exec(`
  CREATE TABLE IF NOT EXISTS clans (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    emblem        TEXT NOT NULL,
    color         TEXT NOT NULL,
    leader_id     INTEGER NOT NULL,
    xp            INTEGER NOT NULL DEFAULT 0,
    declare_ratio REAL NOT NULL DEFAULT 1, -- phần doanh thu gia tộc tự khai báo để tính thuế
    created_at    INTEGER NOT NULL,
    dissolved_at  INTEGER
  );
  CREATE TABLE IF NOT EXISTS clan_members (
    user_id   INTEGER PRIMARY KEY,
    clan_id   INTEGER NOT NULL,
    role      TEXT NOT NULL DEFAULT 'member', -- 'leader' | 'elder' | 'member'
    donated   INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS clan_members_clan ON clan_members(clan_id);
  CREATE TABLE IF NOT EXISTS clan_donations (
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    week    TEXT NOT NULL,
    amount  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (clan_id, user_id, week)
  );
  CREATE TABLE IF NOT EXISTS clan_industries (
    clan_id    INTEGER NOT NULL,
    industry   TEXT NOT NULL,
    fee        INTEGER NOT NULL,
    entered_at INTEGER NOT NULL,
    PRIMARY KEY (clan_id, industry)
  );
  -- 200 lô đất cố định (bản đồ sinh theo hạt giống trong js/shared/clan.js); clan_id trống = còn trong quỹ đất.
  CREATE TABLE IF NOT EXISTS land_plots (
    id             INTEGER PRIMARY KEY,
    clan_id        INTEGER,
    industry       TEXT,
    bought_at      INTEGER,
    bought_price   INTEGER,
    index_at_buy   REAL,
    design         TEXT NOT NULL DEFAULT '[]',
    design_spent   INTEGER NOT NULL DEFAULT 0,
    price_override INTEGER
  );
  CREATE INDEX IF NOT EXISTS land_plots_clan ON land_plots(clan_id);
  CREATE TABLE IF NOT EXISTS clan_days (
    clan_id  INTEGER NOT NULL,
    day      TEXT NOT NULL,
    revenue  INTEGER NOT NULL DEFAULT 0,
    declared INTEGER NOT NULL DEFAULT 0,
    rate     REAL NOT NULL DEFAULT 0,
    tax      INTEGER NOT NULL DEFAULT 0,
    upkeep   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (clan_id, day)
  );
  CREATE TABLE IF NOT EXISTS clan_tax_refunds (
    clan_id    INTEGER NOT NULL,
    month      TEXT NOT NULL,
    taxed      INTEGER NOT NULL,
    refund     INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (clan_id, month)
  );
  -- Hồ sơ trốn thuế: chỉ Sở thuế (bảng quản trị) thấy, gia tộc không được báo.
  CREATE TABLE IF NOT EXISTS tax_evasion (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id     INTEGER NOT NULL,
    day         TEXT NOT NULL,
    revenue     INTEGER NOT NULL,
    declared    INTEGER NOT NULL,
    rate        REAL NOT NULL,
    evaded      INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open', -- 'open' | 'collected' | 'dismissed'
    collected   INTEGER NOT NULL DEFAULT 0,
    resolved_by TEXT,
    resolved_at INTEGER,
    created_at  INTEGER NOT NULL,
    UNIQUE (clan_id, day)
  );
  -- Chuỗi sản xuất (industry.js): kho hàng của gia tộc, sàn công nghiệp chung, giao dịch, nhật ký sản xuất mỗi đêm.
  CREATE TABLE IF NOT EXISTS clan_goods (
    clan_id INTEGER NOT NULL,
    good    TEXT NOT NULL,
    qty     INTEGER NOT NULL DEFAULT 0,
    keep    INTEGER, -- 1 giữ trong kho, 0 tự bán cho NPC mỗi đêm, NULL theo mặc định (giữ nếu là nguyên liệu của gia tộc)
    PRIMARY KEY (clan_id, good)
  );
  CREATE TABLE IF NOT EXISTS goods_listings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id    INTEGER NOT NULL,
    good       TEXT NOT NULL,
    qty        INTEGER NOT NULL,
    price      INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    closed_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS goods_listings_open ON goods_listings(closed_at, good);
  CREATE TABLE IF NOT EXISTS clan_trades (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id  INTEGER NOT NULL,
    buyer_id   INTEGER, -- NULL: bán cho NPC
    good       TEXT NOT NULL,
    qty        INTEGER NOT NULL,
    price      INTEGER NOT NULL,
    income     INTEGER NOT NULL, -- tiền người bán thực nhận (sau phí)
    day        TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS clan_trades_seller ON clan_trades(seller_id, day);
  CREATE TABLE IF NOT EXISTS clan_production (
    clan_id  INTEGER NOT NULL,
    day      TEXT NOT NULL,
    good     TEXT NOT NULL,
    produced INTEGER NOT NULL DEFAULT 0,
    used     INTEGER NOT NULL DEFAULT 0,
    sold     INTEGER NOT NULL DEFAULT 0,
    revenue  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (clan_id, day, good)
  );
  -- Hạ tầng chiến lược (strategic.js): cấp hạ tầng của gia tộc chủ, pet đứng máy, phí hạ tầng thu được.
  CREATE TABLE IF NOT EXISTS clan_infra (
    clan_id  INTEGER NOT NULL,
    industry TEXT NOT NULL,
    level    INTEGER NOT NULL DEFAULT 1,
    since    INTEGER NOT NULL,
    PRIMARY KEY (clan_id, industry)
  );
  CREATE TABLE IF NOT EXISTS clan_operators (
    plot_id INTEGER PRIMARY KEY,
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    pet_id  INTEGER NOT NULL UNIQUE,
    since   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS infra_fees (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_clan_id INTEGER NOT NULL,
    industry      TEXT NOT NULL,
    payer_user_id INTEGER,
    payer_clan_id INTEGER,
    amount        INTEGER NOT NULL,
    day           TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS infra_fees_owner ON infra_fees(owner_clan_id, day);
  -- Vòng đời vật phẩm thiết yếu (essentials.js): chỉ số tự chủ theo ngày của từng nhóm, lượng mỗi người mua.
  CREATE TABLE IF NOT EXISTS essentials_days (
    day       TEXT PRIMARY KEY,
    d         REAL NOT NULL DEFAULT 0,
    demand    INTEGER NOT NULL DEFAULT 0,
    supplied  INTEGER NOT NULL DEFAULT 0,
    npc_sold  INTEGER NOT NULL DEFAULT 0,
    meal_sold INTEGER NOT NULL DEFAULT 0
  );
  -- Đồ chăm sóc: cùng cột với essentials_days (meal_sold = số bộ chăm sóc gia tộc bán ra).
  CREATE TABLE IF NOT EXISTS essentials_care_days (
    day       TEXT PRIMARY KEY,
    d         REAL NOT NULL DEFAULT 0,
    demand    INTEGER NOT NULL DEFAULT 0,
    supplied  INTEGER NOT NULL DEFAULT 0,
    npc_sold  INTEGER NOT NULL DEFAULT 0,
    meal_sold INTEGER NOT NULL DEFAULT 0
  );
  -- Thuế chống độc quyền trên sàn công nghiệp (commerce.js, M6).
  CREATE TABLE IF NOT EXISTS antitrust_taxes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id    INTEGER NOT NULL,
    good       TEXT NOT NULL,
    qty        INTEGER NOT NULL,
    tax        INTEGER NOT NULL,
    share      REAL NOT NULL,
    day        TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS clan_trades_good ON clan_trades(good, day);
  -- Sổ chào giá cho Siêu thị: mỗi gia tộc một lệnh mỗi nhóm (qty còn lại, giá = ratio × giá tham chiếu).
  CREATE TABLE IF NOT EXISTS essentials_asks (
    clan_id    INTEGER NOT NULL,
    cat        TEXT NOT NULL,
    qty        INTEGER NOT NULL,
    ratio      REAL NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (clan_id, cat)
  );
  CREATE TABLE IF NOT EXISTS essentials_buys (
    user_id INTEGER NOT NULL,
    day     TEXT NOT NULL,
    npc     INTEGER NOT NULL DEFAULT 0,
    meal    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );
  CREATE TABLE IF NOT EXISTS macro_days (
    day        TEXT PRIMARY KEY,
    phase      TEXT NOT NULL,
    weather    TEXT NOT NULL,
    land_index REAL NOT NULL,
    gdp        REAL NOT NULL,
    demand     TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `);
  addColumn('land_plots', 'variant', 'TEXT'); // loại nhà máy điện của lô (ngành Năng lượng)
  // Lượng đồ chăm sóc NPC / bộ chăm sóc gia tộc mỗi người mua trong ngày (essentials.js).
  addColumn('essentials_buys', 'care_npc', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('essentials_buys', 'care_clan', 'INTEGER NOT NULL DEFAULT 0');

  // ---- Quản trị gia tộc (clan-gov.js), vay ngang hàng (p2p.js), hụi (hui.js) ----
  db.exec(`
  -- Bỏ phiếu trong gia tộc: hiện có 'depose' (phế truất tộc trưởng, đưa người được đề cử lên thay).
  CREATE TABLE IF NOT EXISTS clan_votes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id      INTEGER NOT NULL,
    kind         TEXT NOT NULL,
    target_id    INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    started_by   INTEGER NOT NULL,
    started_at   INTEGER NOT NULL,
    ends_at      INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open', -- 'open' | 'passed' | 'failed' | 'cancelled'
    closed_at    INTEGER
  );
  CREATE INDEX IF NOT EXISTS clan_votes_clan ON clan_votes(clan_id, status);
  CREATE TABLE IF NOT EXISTS clan_ballots (
    vote_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    yes     INTEGER NOT NULL,
    at      INTEGER NOT NULL,
    PRIMARY KEY (vote_id, user_id)
  );
  -- Người đã bị phế truất: không bao giờ được làm tộc trưởng hay trưởng lão của gia tộc đó nữa.
  CREATE TABLE IF NOT EXISTS clan_deposed (
    clan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    at      INTEGER NOT NULL,
    PRIMARY KEY (clan_id, user_id)
  );
  -- Tiền gửi kỳ hạn của quỹ gia tộc (tiền nằm ở tài khoản clandep:<id> trong sổ cái).
  CREATE TABLE IF NOT EXISTS clan_deposits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id    INTEGER NOT NULL,
    amount     INTEGER NOT NULL,
    rate       REAL NOT NULL,
    term_days  INTEGER NOT NULL,
    opened_at  INTEGER NOT NULL,
    matures_at INTEGER NOT NULL,
    closed_at  INTEGER,
    payout     INTEGER,
    penalty    INTEGER NOT NULL DEFAULT 0,
    close_kind TEXT -- 'matured' | 'early' | 'emergency'
  );
  CREATE INDEX IF NOT EXISTS clan_deposits_clan ON clan_deposits(clan_id, closed_at);
  -- Vay ngang hàng: người vay đăng yêu cầu, người cho vay rót vốn, ngân hàng làm trung gian ăn một phần lãi.
  CREATE TABLE IF NOT EXISTS p2p_loans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    borrower_id INTEGER NOT NULL,
    lender_id   INTEGER,
    amount      INTEGER NOT NULL,
    rate        REAL NOT NULL,
    term_days   INTEGER NOT NULL,
    bank_cut    REAL NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open', -- 'open' | 'funded' | 'late' | 'defaulted' | 'repaid' | 'cancelled' | 'expired'
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    funded_at   INTEGER,
    due_at      INTEGER,
    owed        INTEGER NOT NULL DEFAULT 0,
    paid        INTEGER NOT NULL DEFAULT 0,
    late_days   INTEGER NOT NULL DEFAULT 0,
    closed_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS p2p_status ON p2p_loans(status);
  -- Hụi: mỗi kỳ ai cũng góp, một người hốt (người bỏ thăm cao nhất, hoặc theo thứ tự); bỏ kỳ là bị loại, không hoàn tiền.
  CREATE TABLE IF NOT EXISTS hui_groups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    scope         TEXT NOT NULL, -- 'player' (thành viên là người chơi) | 'clan' (thành viên là gia tộc, góp bằng quỹ)
    owner_id      INTEGER NOT NULL, -- người chơi hoặc gia tộc làm chủ hụi
    amount        INTEGER NOT NULL, -- tiền góp mỗi kỳ
    size          INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open', -- 'open' | 'running' | 'done' | 'cancelled'
    round         INTEGER NOT NULL DEFAULT 0,
    next_round_at INTEGER,
    created_at    INTEGER NOT NULL,
    closed_at     INTEGER
  );
  CREATE TABLE IF NOT EXISTS hui_members (
    group_id   INTEGER NOT NULL,
    member_id  INTEGER NOT NULL,
    joined_at  INTEGER NOT NULL,
    status     TEXT NOT NULL DEFAULT 'active', -- 'active' | 'out'
    received   INTEGER, -- kỳ đã hốt hụi
    paid       INTEGER NOT NULL DEFAULT 0,
    got        INTEGER NOT NULL DEFAULT 0,
    out_at     INTEGER,
    PRIMARY KEY (group_id, member_id)
  );
  CREATE TABLE IF NOT EXISTS hui_bids (
    group_id  INTEGER NOT NULL,
    round     INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    bid       INTEGER NOT NULL,
    at        INTEGER NOT NULL,
    PRIMARY KEY (group_id, round, member_id)
  );
  CREATE TABLE IF NOT EXISTS hui_rounds (
    group_id  INTEGER NOT NULL,
    round     INTEGER NOT NULL,
    winner_id INTEGER,
    pot       INTEGER NOT NULL,
    bid       INTEGER NOT NULL DEFAULT 0,
    payers    INTEGER NOT NULL,
    dropped   INTEGER NOT NULL DEFAULT 0,
    at        INTEGER NOT NULL,
    PRIMARY KEY (group_id, round)
  );
  `);
  addColumn('users', 'hui_ban_until', 'INTEGER NOT NULL DEFAULT 0');
  db.exec(`
  -- Nhật ký gộp ngành (industry-merge.js): đủ để gỡ gộp về đúng như cũ.
  -- kind: 'plot' (lô đổi ngành), 'industry_renamed' (ngành đã thâu tóm đổi id), 'industry_dropped' (dòng trùng bị xoá, fee đã hoàn).
  -- at: lúc ghi với 'plot'; với dòng ngành là entered_at gốc của dòng đó.
  CREATE TABLE IF NOT EXISTS industry_merge_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT NOT NULL,
    clan_id      INTEGER,
    plot_id      INTEGER,
    old_industry TEXT NOT NULL,
    new_industry TEXT NOT NULL,
    line         TEXT,
    fee          INTEGER NOT NULL DEFAULT 0,
    at           INTEGER NOT NULL
  );

  -- Trò chuyện: channel 'world' (kênh chung), 'clan:<id>' (kênh gia tộc), 'pm:<id nhỏ>:<id lớn>' (tin nhắn riêng).
  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel    TEXT NOT NULL,
    user_id    INTEGER NOT NULL,
    text       TEXT NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chat_messages_channel ON chat_messages(channel, id);
  CREATE TABLE IF NOT EXISTS chat_reads (
    user_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    last_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, channel)
  );
  CREATE TABLE IF NOT EXISTS chat_pm (
    channel  TEXT NOT NULL,
    user_id  INTEGER NOT NULL,
    other_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, channel)
  );
  CREATE TABLE IF NOT EXISTS chat_blocks (
    user_id    INTEGER NOT NULL,
    blocked_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, blocked_id)
  );

  -- Hộp thư: from_user NULL là thư hệ thống / quản trị; coins là quà đính kèm, nhận một lần (claimed_at).
  CREATE TABLE IF NOT EXISTS mail (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    to_user    INTEGER NOT NULL,
    from_user  INTEGER,
    from_name  TEXT,
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL,
    coins      INTEGER NOT NULL DEFAULT 0,
    read_at    INTEGER,
    claimed_at INTEGER,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mail_to ON mail(to_user, id);
  `);
  addColumn('users', 'chat_muted_until', 'INTEGER NOT NULL DEFAULT 0');
}

const q = {
  getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
  setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'),

  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  insertUser: db.prepare('INSERT INTO users (username, pass_hash, coins, created_at, login_key) VALUES (?, ?, 0, ?, ?)'),
  setActivePet: db.prepare('UPDATE users SET active_pet_id = ? WHERE id = ?'),
  setDaily: db.prepare('UPDATE users SET last_daily_at = ?, daily_day = ?, streak = ? WHERE id = ?'),
  setWarehouse: db.prepare('UPDATE users SET warehouse = ? WHERE id = ?'),
  setAdvanced: db.prepare('UPDATE users SET advanced = ? WHERE id = ?'),
  allUsers: db.prepare('SELECT * FROM users ORDER BY id'),

  insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'),
  userForToken: db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),

  petById: db.prepare('SELECT * FROM pets WHERE id = ?'),
  petsByOwner: db.prepare('SELECT * FROM pets WHERE owner_id = ? ORDER BY id'),
  allPets: db.prepare('SELECT * FROM pets'),
  insertPet: db.prepare('INSERT INTO pets (owner_id, name, species, born_at, updated_at) VALUES (?, ?, ?, ?, ?)'),
  savePet: db.prepare(`
    UPDATE pets SET level = ?, xp = ?, fullness = ?, happiness = ?, energy = ?, accessory = ?, updated_at = ?,
      busy_from = ?, busy_until = ?, busy_kind = ?, hygiene = ?, health = ?, sick = ?
    WHERE id = ?`),
  setTraits: db.prepare('UPDATE pets SET traits = ? WHERE id = ?'),
  wearOf: db.prepare('SELECT slot, item_id FROM pet_wear WHERE pet_id = ?'),
  setWear: db.prepare(`
    INSERT INTO pet_wear (pet_id, slot, item_id, gear_id) VALUES (?, ?, ?, ?)
    ON CONFLICT (pet_id, slot) DO UPDATE SET item_id = excluded.item_id, gear_id = excluded.gear_id`),
  petGear: db.prepare('SELECT g.affixes FROM pet_wear w JOIN gear g ON g.id = w.gear_id WHERE w.pet_id = ?'),
  clearWear: db.prepare('DELETE FROM pet_wear WHERE pet_id = ? AND slot = ?'),
  clearAllWear: db.prepare('DELETE FROM pet_wear WHERE pet_id = ?'),
  unequipItem: db.prepare('DELETE FROM pet_wear WHERE item_id = ? AND pet_id IN (SELECT id FROM pets WHERE owner_id = ?)'),
  setBornAt: db.prepare('UPDATE pets SET born_at = ? WHERE id = ?'),
  leaderboard: db.prepare(`
    SELECT p.*, u.username FROM pets p JOIN users u ON u.id = p.owner_id
    ORDER BY p.level DESC, p.xp DESC, p.born_at ASC LIMIT ?`),

  skills: db.prepare('SELECT skill, value FROM pet_skills WHERE pet_id = ?'),
  setSkill: db.prepare(`
    INSERT INTO pet_skills (pet_id, skill, value) VALUES (?, ?, ?)
    ON CONFLICT (pet_id, skill) DO UPDATE SET value = excluded.value`),

  inventory: db.prepare('SELECT item_id, qty FROM inventory WHERE user_id = ? AND qty > 0'),
  addItem: db.prepare(`
    INSERT INTO inventory (user_id, item_id, qty) VALUES (?, ?, ?)
    ON CONFLICT (user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`),
  takeItem: db.prepare('UPDATE inventory SET qty = qty - ? WHERE user_id = ? AND item_id = ? AND qty >= ?'),
};


export const getMeta = (key) => q.getMeta.get(key)?.value;
export const setMeta = (key, value) => q.setMeta.run(key, String(value));

export const getUser = (id) => q.userById.get(id);
export const allUsers = () => q.allUsers.all();
export const findUserByName = (username) => q.userByName.get(username);
/** Tạo người chơi với ví rỗng; xu khởi điểm được ghi vào sổ cái bởi nơi gọi. */
export const createUser = (username, passHash, now = Date.now()) => Number(q.insertUser.run(username, passHash, now, loginKey(username)).lastInsertRowid);
export const setActivePet = (userId, petId) => q.setActivePet.run(petId, userId);
export const setDaily = (userId, at, day, streak) => q.setDaily.run(at, day, streak, userId);
export const setWarehouse = (userId, level) => q.setWarehouse.run(level, userId);
export const setAdvanced = (userId, on) => q.setAdvanced.run(on ? 1 : 0, userId);

export const createSession = (token, userId) => q.insertSession.run(token, userId, Date.now());
export const userForToken = (token) => (typeof token === 'string' && token ? q.userForToken.get(token) : undefined);
export const deleteSession = (token) => q.deleteSession.run(token);

/** Đọc bé kèm `traits` đã giải mã thành mảng. */
/** Đồ bé đang đeo: { head, face, neck, back } → mã món. */
export const wearOf = (petId) => Object.fromEntries(q.wearOf.all(petId).map((r) => [r.slot, r.item_id]));
/** Tổng % các dòng chỉ số của trang phục bé đang đeo: { income, stats, trade, luck }. */
export const gearBonusOf = (petId) => sumBonus(q.petGear.all(petId).map((r) => JSON.parse(r.affixes)));
const withTraits = (row) => row && { ...row, traits: JSON.parse(row.traits ?? '[]'), wear: wearOf(row.id), bonus: gearBonusOf(row.id) };
/** Đeo `itemId` (bản trang phục `gearId`) vào `slot` (null là tháo); không có `slot` thì tháo hết. */
export function setWear(petId, slot, itemId, gearId = null) {
  if (!slot) q.clearAllWear.run(petId);
  else if (itemId) q.setWear.run(petId, slot, itemId, gearId);
  else q.clearWear.run(petId, slot);
}
export const unequipItem = (ownerId, itemId) => q.unequipItem.run(itemId, ownerId);
export const getPet = (id) => withTraits(q.petById.get(id));
export const listPets = (ownerId) => q.petsByOwner.all(ownerId).map(withTraits);
export const allPets = () => q.allPets.all().map(withTraits);
export const setTraits = (petId, traits) => q.setTraits.run(JSON.stringify(traits), petId);
export const insertPet = (ownerId, name, species, now) =>
  Number(q.insertPet.run(ownerId, name, species, now, now).lastInsertRowid);
export const savePet = (pet) =>
  q.savePet.run(
    pet.level, pet.xp, pet.fullness, pet.happiness, pet.energy, pet.accessory ?? null, pet.updated_at,
    pet.busy_from ?? null, pet.busy_until ?? null, pet.busy_kind ?? null, pet.hygiene ?? 80, pet.health ?? 90, pet.sick ?? null, pet.id,
  );
export const setBornAt = (petId, bornAt) => q.setBornAt.run(bornAt, petId);
export const leaderboard = (limit = 20) => q.leaderboard.all(limit);

export const skillsOf = (petId) => Object.fromEntries(q.skills.all(petId).map((r) => [r.skill, r.value]));
export const setSkill = (petId, skill, value) => q.setSkill.run(petId, skill, value);

export const inventory = (userId) => Object.fromEntries(q.inventory.all(userId).map((r) => [r.item_id, r.qty]));
export const addItem = (userId, itemId, qty) => q.addItem.run(userId, itemId, qty);
export function takeItem(userId, itemId, qty = 1) {
  if (q.takeItem.run(qty, userId, itemId, qty).changes === 0) throw new GameError('Bạn không có đủ món này.');
}

// Node.js (máy chủ dev, test, mô phỏng): mở file SQLite ngay khi import, như trước. Trên Cloudflare
// Workers, Durable Object cắm backend của nó rồi gọi ensureSchema().
if (!isWorkers && !hasBackend()) {
  const { openNodeSqlite } = await import('./sql/node-sqlite.js');
  const file = process.env.PETDEX_DB ?? new URL('../data/petdex.db', import.meta.url).pathname;
  setBackend(await openNodeSqlite(file));
  ensureSchema();
}

// ---- WorkHub (Pet Town): phiên, tài khoản liên kết, khách mời, nhật ký quản trị ----
const w = {
  userByCrm: db.prepare('SELECT * FROM users WHERE crm_user_id = ?'),
  residents: db.prepare(`SELECT u.id, u.username, u.display_name, u.active_pet_id FROM users u JOIN pets p ON p.id = u.active_pet_id
    WHERE u.banned = 0 ORDER BY u.last_seen_at DESC, u.id DESC LIMIT ?`),
  recentSession: db.prepare('SELECT token FROM sessions WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1'),
  insertLinked: db.prepare("INSERT INTO users (username, pass_hash, coins, created_at, kind, crm_user_id, display_name, invite_id, login_key) VALUES (?, '', 0, ?, ?, ?, ?, ?, ?)"),
  setDisplayName: db.prepare('UPDATE users SET display_name = ? WHERE id = ?'),
  setCredentials: db.prepare('UPDATE users SET username = ?, pass_hash = ?, login_key = ? WHERE id = ?'),
  userByLogin: db.prepare("SELECT * FROM users WHERE login_key = ? ORDER BY (pass_hash <> '') DESC, id LIMIT 1"),
  deleteOtherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?'),
  setBanned: db.prepare('UPDATE users SET banned = ? WHERE id = ?'),
  deleteSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  touchSeen: db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ? AND last_seen_at < ?'),
  usersLike: db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM pets p WHERE p.owner_id = u.id) AS pet_count,
    (SELECT MAX(level) FROM pets p WHERE p.owner_id = u.id) AS top_level,
    (SELECT savings FROM bank_accounts b WHERE b.user_id = u.id) AS savings
    FROM users u WHERE (? = '' OR u.username LIKE ? OR u.display_name LIKE ?) AND (? = '' OR u.kind = ?) ORDER BY u.last_seen_at DESC, u.id DESC LIMIT 200`),
  countByKind: db.prepare('SELECT kind, COUNT(*) AS n, SUM(coins) AS coins, SUM(CASE WHEN banned THEN 1 ELSE 0 END) AS banned FROM users GROUP BY kind'),
  activeSince: db.prepare('SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?'),
  totalSavings: db.prepare('SELECT COALESCE(SUM(savings), 0) AS n FROM bank_accounts'),
  petCount: db.prepare('SELECT COUNT(*) AS n FROM pets'),
  ledgerByKind: db.prepare('SELECT kind, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS inflow, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS outflow, COUNT(*) AS n FROM ledger WHERE created_at >= ? AND user_id IS NOT NULL GROUP BY kind ORDER BY n DESC'),

  insertInvite: db.prepare('INSERT INTO guest_invites (code, label, max_uses, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  inviteByCode: db.prepare('SELECT * FROM guest_invites WHERE code = ?'),
  inviteById: db.prepare('SELECT * FROM guest_invites WHERE id = ?'),
  invites: db.prepare('SELECT i.*, (SELECT COUNT(*) FROM users u WHERE u.invite_id = i.id) AS guests FROM guest_invites i ORDER BY i.id DESC'),
  useInvite: db.prepare('UPDATE guest_invites SET uses = uses + 1 WHERE id = ?'),
  revokeInvite: db.prepare('UPDATE guest_invites SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'),

  insertLog: db.prepare('INSERT INTO admin_log (actor, action, user_id, details, created_at) VALUES (?, ?, ?, ?, ?)'),
  insertPasswordLink: db.prepare('INSERT INTO password_links (code_hash, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'),
  retirePasswordLinks: db.prepare('UPDATE password_links SET used_at = ? WHERE user_id = ? AND used_at IS NULL'),
  passwordLink: db.prepare('SELECT * FROM password_links WHERE code_hash = ?'),
  usePasswordLink: db.prepare('UPDATE password_links SET used_at = ? WHERE code_hash = ? AND used_at IS NULL'),
  logs: db.prepare('SELECT l.*, u.username, u.display_name FROM admin_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT ?'),
};

const hex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Mở phiên mới cho người chơi, trả về token. */
export function issueToken(userId) {
  const token = hex(24);
  createSession(token, userId);
  return token;
}
export const userByCrm = (crmUserId) => w.userByCrm.get(crmUserId);
/** Người chơi chưa bị khóa và còn bé sống (bé chính), mới hoạt động gần đây trước. */
export const residentUsers = (limit) => w.residents.all(limit);
/** Token của phiên mở gần đây (trong `maxAgeMs`), để mỗi lần mở trang không tạo phiên mới. */
export const recentToken = (userId, maxAgeMs = 7 * 86_400_000) => w.recentSession.get(userId, Date.now() - maxAgeMs)?.token;
export const createLinkedUser = (username, { kind, crmUserId = null, displayName = null, inviteId = null }, now = Date.now()) =>
  Number(w.insertLinked.run(username, now, kind, crmUserId, displayName, inviteId, loginKey(username)).lastInsertRowid);
export const setDisplayName = (userId, name) => w.setDisplayName.run(name, userId);
/** Tên đăng nhập + mật khẩu (đã băm) để vào thẳng trang chơi. */
export const setCredentials = (userId, username, passHash) => w.setCredentials.run(username, passHash, loginKey(username), userId);
/** Người chơi theo tên đăng nhập, không phân biệt hoa thường kể cả chữ có dấu ("Đức" = "đức"). */
export const findUserByLogin = (name) => w.userByLogin.get(loginKey(name));
/** Đăng xuất mọi nơi khác, giữ phiên đang dùng. */
export const revokeOtherSessions = (userId, keepToken) => w.deleteOtherSessions.run(userId, keepToken);
export const setBanned = (userId, banned) => {
  w.setBanned.run(banned ? 1 : 0, userId);
  if (banned) w.deleteSessions.run(userId);
};
export const revokeSessions = (userId) => w.deleteSessions.run(userId);
/** Ghi mốc hoạt động, nhiều nhất một lần mỗi 5 phút để không ghi đĩa mỗi request. */
export const touchSeen = (userId, now = Date.now()) => w.touchSeen.run(now, userId, now - 5 * 60_000);
export const searchUsers = (q = '', kind = '') => w.usersLike.all(q, `%${q}%`, `%${q}%`, kind, kind);
export const usersOverview = (now = Date.now()) => ({
  byKind: w.countByKind.all(),
  activeToday: w.activeSince.get(now - 86_400_000).n,
  activeWeek: w.activeSince.get(now - 7 * 86_400_000).n,
  savings: w.totalSavings.get().n,
  pets: w.petCount.get().n,
  ledger7d: w.ledgerByKind.all(now - 7 * 86_400_000),
});

export const createInvite = ({ label, maxUses = null, expiresAt = null, createdBy }, now = Date.now()) => {
  const code = hex(9);
  const id = Number(w.insertInvite.run(code, label, maxUses, expiresAt, createdBy, now).lastInsertRowid);
  return w.inviteById.get(id);
};
export const inviteByCode = (code) => (typeof code === 'string' && code ? w.inviteByCode.get(code) : undefined);
export const inviteById = (id) => w.inviteById.get(id);
export const listInvites = () => w.invites.all();
export const useInvite = (id) => w.useInvite.run(id);
export const revokeInvite = (id, now = Date.now()) => w.revokeInvite.run(now, id).changes > 0;

/**
 * Link đặt mật khẩu mới cho người chơi (các link cũ chưa dùng của người đó hết hiệu lực).
 * `codeHash` là mã đã băm: mã gốc chỉ trả về cho quản trị viên một lần.
 */
export function createPasswordLink(userId, codeHash, { createdBy, ttlMs }, now = Date.now()) {
  w.retirePasswordLinks.run(now, userId);
  w.insertPasswordLink.run(codeHash, userId, createdBy, now, now + ttlMs);
  return now + ttlMs;
}
/** Link còn dùng được (chưa dùng, chưa hết hạn), hoặc undefined. */
export function livePasswordLink(codeHash, now = Date.now()) {
  const link = w.passwordLink.get(codeHash);
  return link && !link.used_at && link.expires_at > now ? link : undefined;
}
/** Đánh dấu đã dùng; false nếu đã có người dùng trước. */
export const usePasswordLink = (codeHash, now = Date.now()) => w.usePasswordLink.run(now, codeHash).changes > 0;
export const adminLog = (actor, action, userId, details) => w.insertLog.run(actor, action, userId ?? null, details == null ? null : JSON.stringify(details), Date.now());
export const adminLogs = (limit = 50) => w.logs.all(limit).map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
