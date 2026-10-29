import { GameError } from './game.js';
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
  `);
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
      busy_from = ?, busy_until = ?, hygiene = ?, health = ?, sick = ?
    WHERE id = ?`),
  setTraits: db.prepare('UPDATE pets SET traits = ? WHERE id = ?'),
  wearOf: db.prepare('SELECT slot, item_id FROM pet_wear WHERE pet_id = ?'),
  setWear: db.prepare(`
    INSERT INTO pet_wear (pet_id, slot, item_id) VALUES (?, ?, ?)
    ON CONFLICT (pet_id, slot) DO UPDATE SET item_id = excluded.item_id`),
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
const withTraits = (row) => row && { ...row, traits: JSON.parse(row.traits ?? '[]'), wear: wearOf(row.id) };
/** Đeo `itemId` vào `slot` (null là tháo); không có `slot` thì tháo hết. */
export function setWear(petId, slot, itemId) {
  if (!slot) q.clearAllWear.run(petId);
  else if (itemId) q.setWear.run(petId, slot, itemId);
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
    pet.busy_from ?? null, pet.busy_until ?? null, pet.hygiene ?? 80, pet.health ?? 90, pet.sick ?? null, pet.id,
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
  const file = process.env.PETDEX_DB ?? new URL('../data/petdex.db', import.meta.url);
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

export const adminLog = (actor, action, userId, details) => w.insertLog.run(actor, action, userId ?? null, details == null ? null : JSON.stringify(details), Date.now());
export const adminLogs = (limit = 50) => w.logs.all(limit).map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
