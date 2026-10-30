// Gia tộc và Sở Nhà Đất: lập gia tộc, góp quỹ theo tuần, cấp gia tộc, thâu tóm tối đa 3 ngành (trả tiền bồi thường
// thị trường), mua 200 lô đất có địa hình và khí hậu riêng, lắp ghép công trình từ 200 mẫu (tối đa 20 mảnh),
// doanh thu mỗi đêm theo đất, ngành và kinh tế vĩ mô, thuế doanh nghiệp 35% (+5 điểm mỗi ngành thêm) và hoàn 15% mỗi tháng.
// Gia tộc tự khai phần doanh thu chịu thuế; phần khai thiếu được ghi vào hồ sơ của Sở thuế mà gia tộc không biết.
import { adminLog, db, getMeta, getUser, setMeta, transaction } from './db.js';
import { dayKey, nextDay, startOfDay, weekday } from './clock.js';
import { DAY, GameError } from './game.js';
import { post, treasuryBalance } from './ledger.js';
import { macroFor, rollNextDay } from './macro.js';
import { weekKey } from './town.js';
import { expireListings, plotDeposits, productionPreview, runProduction, setPlotVariant, tradeIncome } from './industry.js';
import { STRATEGIC_INDUSTRIES, STRATEGIC_RULES, plantsFor, strategicPlaceOk } from '../../public/ta-tua/game/js/shared/industry.js';
import { buffFor, chargeInfraFee, operatingOwners, strategicOf } from './strategic.js';
import {
  CLAN_EMBLEMS, CLAN_LEVELS, INDUSTRIES, INDUSTRY_ORDER, LAND, PHASES, PLOTS, WEATHER, cleanDesign, clanLevelOf, clanPerks,
  competitionFactor, designBonus, designComplete, designCost, envFactor, isProduction, isStrategic, scarcityFactor, weatherFactor,
} from '../../public/ta-tua/game/js/shared/clan.js';

// ---------------------------------------------------------------- cấu hình (quản trị viên chỉnh được)

export const DEFAULT_CLAN_CONFIG = {
  createCost: 3_000,
  unlockLevel: 4,
  /** Cấp gia tộc cần để thâu tóm ngành thứ 1, 2, 3. */
  industryLevels: [1, 3, 5],
  /** Ngành thứ 2 và 3 phải trả gấp bao nhiêu lần mức bồi thường gốc của ngành đó. */
  expandMultiplier: 10,
  baseTax: 0.35,
  extraTaxPerIndustry: 0.05,
  refundRate: 0.15,
  donationQuotaPerLevel: 300,
  upkeepPerLevel: 80,
  upkeepPerPlot: 200,
  /** Tiền bồi thường thị trường khi thâu tóm từng ngành (20.000–50.000 tùy mô hình). */
  comp: Object.fromEntries(INDUSTRY_ORDER.map((id) => [id, INDUSTRIES[id].comp])),
  land: {
    /** 'auto': giá chạy theo độ khan hiếm và chỉ số vĩ mô; 'manual': giá gốc × hệ số, không tự chạy. */
    mode: 'auto',
    minPrice: LAND.minPrice,
    maxPrice: LAND.maxPrice,
    scarcityK: 2,
    multiplier: 1,
    /** Doanh thu một ngày của một lô = giá gốc × tỉ lệ này × các hệ số. */
    yieldRate: 0.006,
    resaleRate: 0.85,
    maxAppreciation: 3,
    /** Phần tiền mua đất vào ngân sách thị trấn (phần còn lại bị hủy khỏi nền kinh tế). */
    treasuryShare: 0.2,
  },
  /** Quản trị viên ép pha kinh tế hoặc thời tiết cho các ngày tới (null = tự chạy). */
  macro: { phase: null, weather: null },
};

const num = (v, lo, hi, fallback) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : fallback);
const int = (v, lo, hi, fallback) => Math.round(num(v, lo, hi, fallback));

export function normalizeClanConfig(input = {}) {
  const d = DEFAULT_CLAN_CONFIG;
  const land = input.land ?? {};
  const minPrice = int(land.minPrice, 1_000, 100_000_000, d.land.minPrice);
  const levels = Array.isArray(input.industryLevels) ? input.industryLevels : d.industryLevels;
  return {
    createCost: int(input.createCost, 0, 10_000_000, d.createCost),
    unlockLevel: int(input.unlockLevel, 1, 30, d.unlockLevel),
    industryLevels: [0, 1, 2].map((i) => int(levels[i], 1, 10, d.industryLevels[i])).map((v, i, a) => (i ? Math.max(v, a[i - 1]) : v)),
    expandMultiplier: num(input.expandMultiplier, 1, 100, d.expandMultiplier),
    baseTax: num(input.baseTax, 0, 0.9, d.baseTax),
    extraTaxPerIndustry: num(input.extraTaxPerIndustry, 0, 0.3, d.extraTaxPerIndustry),
    refundRate: num(input.refundRate, 0, 1, d.refundRate),
    donationQuotaPerLevel: int(input.donationQuotaPerLevel, 0, 1_000_000, d.donationQuotaPerLevel),
    upkeepPerLevel: int(input.upkeepPerLevel, 0, 1_000_000, d.upkeepPerLevel),
    upkeepPerPlot: int(input.upkeepPerPlot, 0, 1_000_000, d.upkeepPerPlot),
    comp: Object.fromEntries(INDUSTRY_ORDER.map((id) => [id, int(input.comp?.[id], 0, 100_000_000, d.comp[id])])),
    land: {
      mode: land.mode === 'manual' ? 'manual' : 'auto',
      minPrice,
      maxPrice: Math.max(minPrice, int(land.maxPrice, 1_000, 1_000_000_000, d.land.maxPrice)),
      scarcityK: num(land.scarcityK, 0, 10, d.land.scarcityK),
      multiplier: num(land.multiplier, 0.1, 10, d.land.multiplier),
      yieldRate: num(land.yieldRate, 0, 0.1, d.land.yieldRate),
      resaleRate: num(land.resaleRate, 0, 1, d.land.resaleRate),
      maxAppreciation: num(land.maxAppreciation, 1, 20, d.land.maxAppreciation),
      treasuryShare: num(land.treasuryShare, 0, 1, d.land.treasuryShare),
    },
    macro: {
      phase: PHASES[input.macro?.phase] ? input.macro.phase : null,
      weather: WEATHER[input.macro?.weather] ? input.macro.weather : null,
    },
  };
}

let cached = null;
export function clanConfig() {
  if (!cached) {
    try {
      const raw = getMeta('clan_config');
      cached = normalizeClanConfig(raw ? JSON.parse(raw) : DEFAULT_CLAN_CONFIG);
    } catch {
      cached = normalizeClanConfig(DEFAULT_CLAN_CONFIG);
    }
  }
  return cached;
}
export function setClanConfig(input) {
  const next = normalizeClanConfig({ ...clanConfig(), ...input, land: { ...clanConfig().land, ...input?.land }, macro: { ...clanConfig().macro, ...input?.macro } });
  setMeta('clan_config', JSON.stringify(next));
  cached = next;
  return next;
}

// ---------------------------------------------------------------- truy vấn

const q = {
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  clanByName: db.prepare('SELECT id FROM clans WHERE name = ?'),
  active: db.prepare('SELECT * FROM clans WHERE dissolved_at IS NULL ORDER BY xp DESC, id'),
  insertClan: db.prepare('INSERT INTO clans (name, emblem, color, leader_id, created_at) VALUES (?, ?, ?, ?, ?)'),
  setLeader: db.prepare('UPDATE clans SET leader_id = ? WHERE id = ?'),
  addXp: db.prepare('UPDATE clans SET xp = MAX(0, xp + ?) WHERE id = ?'),
  setDeclare: db.prepare('UPDATE clans SET declare_ratio = ? WHERE id = ?'),
  dissolve: db.prepare("UPDATE clans SET dissolved_at = ?, name = name || ' #' || id WHERE id = ?"),

  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  members: db.prepare(`
    SELECT m.*, u.username, COALESCE(d.amount, 0) AS week_amount FROM clan_members m JOIN users u ON u.id = m.user_id
    LEFT JOIN clan_donations d ON d.clan_id = m.clan_id AND d.user_id = m.user_id AND d.week = ?
    WHERE m.clan_id = ? ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'elder' THEN 1 ELSE 2 END, m.donated DESC, m.joined_at`),
  memberCount: db.prepare('SELECT COUNT(*) AS n FROM clan_members WHERE clan_id = ?'),
  addMember: db.prepare('INSERT INTO clan_members (user_id, clan_id, role, joined_at) VALUES (?, ?, ?, ?)'),
  removeMember: db.prepare('DELETE FROM clan_members WHERE user_id = ?'),
  setRole: db.prepare('UPDATE clan_members SET role = ? WHERE user_id = ?'),
  addDonated: db.prepare('UPDATE clan_members SET donated = donated + ? WHERE user_id = ?'),
  addWeekDonation: db.prepare(`
    INSERT INTO clan_donations (clan_id, user_id, week, amount) VALUES (?, ?, ?, ?)
    ON CONFLICT (clan_id, user_id, week) DO UPDATE SET amount = amount + excluded.amount`),
  successor: db.prepare(`
    SELECT user_id FROM clan_members WHERE clan_id = ? AND user_id != ?
    ORDER BY CASE role WHEN 'elder' THEN 0 ELSE 1 END, donated DESC, joined_at LIMIT 1`),

  industries: db.prepare('SELECT * FROM clan_industries WHERE clan_id = ? ORDER BY entered_at'),
  addIndustry: db.prepare('INSERT INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, ?, ?, ?)'),
  industryCounts: db.prepare(`
    SELECT i.industry, COUNT(*) AS n FROM clan_industries i JOIN clans c ON c.id = i.clan_id
    WHERE c.dissolved_at IS NULL GROUP BY i.industry`),
  dropIndustries: db.prepare('DELETE FROM clan_industries WHERE clan_id = ?'),

  ensurePlot: db.prepare('INSERT OR IGNORE INTO land_plots (id) VALUES (?)'),
  plots: db.prepare('SELECT * FROM land_plots ORDER BY id'),
  plot: db.prepare('SELECT * FROM land_plots WHERE id = ?'),
  clanPlots: db.prepare('SELECT * FROM land_plots WHERE clan_id = ? ORDER BY id'),
  soldCount: db.prepare('SELECT COUNT(*) AS n FROM land_plots WHERE clan_id IS NOT NULL'),
  buyPlot: db.prepare('UPDATE land_plots SET clan_id = ?, industry = NULL, bought_at = ?, bought_price = ?, index_at_buy = ?, design = \'[]\', design_spent = 0 WHERE id = ? AND clan_id IS NULL'),
  releasePlot: db.prepare("UPDATE land_plots SET clan_id = NULL, industry = NULL, bought_at = NULL, bought_price = NULL, index_at_buy = NULL, design = '[]', design_spent = 0 WHERE id = ?"),
  releaseClanPlots: db.prepare("UPDATE land_plots SET clan_id = NULL, industry = NULL, bought_at = NULL, bought_price = NULL, index_at_buy = NULL, design = '[]', design_spent = 0 WHERE clan_id = ?"),
  setPlotIndustry: db.prepare('UPDATE land_plots SET industry = ? WHERE id = ?'),
  setDesign: db.prepare('UPDATE land_plots SET design = ?, design_spent = ? WHERE id = ?'),
  setOverride: db.prepare('UPDATE land_plots SET price_override = ? WHERE id = ?'),

  addDay: db.prepare(`
    INSERT INTO clan_days (clan_id, day, revenue, declared, rate, tax, upkeep) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (clan_id, day) DO UPDATE SET revenue = excluded.revenue, declared = excluded.declared, rate = excluded.rate,
      tax = excluded.tax, upkeep = excluded.upkeep`),
  days: db.prepare('SELECT * FROM clan_days WHERE clan_id = ? ORDER BY day DESC LIMIT ?'),
  monthTax: db.prepare('SELECT COALESCE(SUM(tax), 0) AS tax FROM clan_days WHERE clan_id = ? AND day LIKE ?'),
  refunds: db.prepare('SELECT * FROM clan_tax_refunds WHERE clan_id = ? ORDER BY month DESC LIMIT 6'),
  insertRefund: db.prepare('INSERT OR IGNORE INTO clan_tax_refunds (clan_id, month, taxed, refund, created_at) VALUES (?, ?, ?, ?, ?)'),

  insertEvasion: db.prepare(`
    INSERT OR REPLACE INTO tax_evasion (clan_id, day, revenue, declared, rate, evaded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  evasions: db.prepare(`
    SELECT e.*, c.name AS clan_name, c.emblem FROM tax_evasion e JOIN clans c ON c.id = e.clan_id
    ORDER BY CASE e.status WHEN 'open' THEN 0 ELSE 1 END, e.day DESC, e.id DESC LIMIT ?`),
  evasion: db.prepare('SELECT * FROM tax_evasion WHERE id = ?'),
  resolveEvasion: db.prepare('UPDATE tax_evasion SET status = ?, collected = ?, resolved_by = ?, resolved_at = ? WHERE id = ?'),

  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  insertNews: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const clanAccount = (id) => `clan:${id}`;
export const clanBalance = (id) => q.account.get(clanAccount(id))?.balance ?? 0;

let plotsReady = false;
function ensurePlots() {
  if (plotsReady) return;
  for (const p of PLOTS) q.ensurePlot.run(p.id);
  plotsReady = true;
}

function clanSpend(clanId, amount, kind, memo, now) {
  if (amount <= 0) return;
  if (clanBalance(clanId) < amount) throw new GameError(`Quỹ gia tộc không đủ: cần ${fmt(amount)} xu, quỹ còn ${fmt(clanBalance(clanId))} xu.`);
  post({ account: clanAccount(clanId), delta: -amount, kind, memo, now });
}

const toTreasury = (amount, kind, memo, now) => amount > 0 && post({ account: 'treasury', delta: Math.floor(amount), kind, memo, now });

// ---------------------------------------------------------------- tính toán

const levelOf = (clan) => clanLevelOf(clan.xp);
export const taxRate = (industryCount, cfg = clanConfig()) => Math.round((cfg.baseTax + cfg.extraTaxPerIndustry * Math.max(0, industryCount - 1)) * 10000) / 10000;

/** Giá gốc của lô theo khoảng giá quản trị viên đặt (bản đồ sinh sẵn trong khoảng 100.000–2.000.000). */
export function scaledBase(plot, cfg = clanConfig()) {
  const t = (plot.basePrice - LAND.minPrice) / (LAND.maxPrice - LAND.minPrice);
  return cfg.land.minPrice + (cfg.land.maxPrice - cfg.land.minPrice) * t;
}

/** Giá bán của Sở Nhà Đất cho một lô còn trống. */
export function listingPrice(plot, row, { soldRatio, landIndex }, cfg = clanConfig()) {
  if (row?.price_override) return row.price_override;
  const base = scaledBase(plot, cfg) * cfg.land.multiplier;
  const price = cfg.land.mode === 'manual' ? base : base * scarcityFactor(soldRatio, cfg.land.scarcityK) * landIndex;
  return Math.round(price / 1000) * 1000;
}

/** Giá trị hiện tại của lô đã mua: tăng theo % tăng trưởng mỗi tháng của lô (có trần) và theo chỉ số giá đất. */
export function plotValue(plot, row, landIndex, now, cfg = clanConfig()) {
  const months = Math.max(0, now - row.bought_at) / (30 * DAY);
  const growth = Math.min(cfg.land.maxAppreciation, (1 + plot.growth) ** months);
  const market = cfg.land.mode === 'manual' ? 1 : landIndex / (row.index_at_buy || 1);
  return Math.round(row.bought_price * growth * market);
}

/** Doanh thu một ngày của một lô với ngành `industry`, kèm từng hệ số để hiển thị. */
export function plotRevenue(plot, { industry, design = [], level = 1, macro, clansInIndustry = 1 }, cfg = clanConfig()) {
  const factors = {
    base: Math.round(scaledBase(plot, cfg) * cfg.land.yieldRate),
    prod: 1 + plot.prod,
    env: envFactor(industry, plot.zone, plot.climate),
    zone: INDUSTRIES[industry]?.zones[plot.zone] ?? 0,
    climate: INDUSTRIES[industry]?.climates[plot.climate] ?? 0,
    weather: weatherFactor(macro.weather, plot.zone, plot.climate),
    phase: PHASES[macro.phase]?.factor ?? 1,
    demand: macro.demand?.[industry] ?? 1,
    competition: competitionFactor(clansInIndustry),
    level: 1 + clanPerks(level).prodBonus,
    building: 1 + designBonus(design),
  };
  const operating = Boolean(INDUSTRIES[industry]) && designComplete(design);
  const gross = Math.round(factors.base * factors.prod * factors.env * factors.weather * factors.phase * factors.demand * factors.competition * factors.level * factors.building);
  return { factors, operating, gross, revenue: operating ? gross : 0 };
}

function industryCounts() {
  return Object.fromEntries(q.industryCounts.all().map((r) => [r.industry, r.n]));
}

function landStats(now = Date.now()) {
  ensurePlots();
  const sold = q.soldCount.get().n;
  const macro = macroFor(dayKey(now), { now, force: clanConfig().macro });
  return { sold, free: LAND.count - sold, soldRatio: sold / LAND.count, landIndex: macro.landIndex, macro };
}

/** Phí thâu tóm ngành tiếp theo: ngành đầu trả mức gốc, từ ngành thứ hai trả gấp `expandMultiplier`. */
export const entryFee = (industry, owned, cfg = clanConfig()) => Math.round((cfg.comp[industry] ?? 0) * (owned > 0 && !isStrategic(industry) ? cfg.expandMultiplier : 1));

// ---------------------------------------------------------------- gia tộc

function mustClanOf(userId) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  return { clan, member: m };
}

function mustRole(userId, roles, what) {
  const ctx = mustClanOf(userId);
  if (!roles.includes(ctx.member.role)) throw new GameError(`Chỉ ${roles.includes('elder') ? 'tộc trưởng hoặc trưởng lão' : 'tộc trưởng'} mới được ${what}.`);
  return ctx;
}

function cleanClanName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if ([...name].length < 3 || [...name].length > 24) throw new GameError('Tên gia tộc dài 3–24 ký tự.');
  return name;
}

export function createClan(userId, { name, emblem, color }, now = Date.now()) {
  return transaction(() => {
    if (q.member.get(userId)) throw new GameError('Bạn đã ở một gia tộc rồi, rời gia tộc cũ trước đã.');
    const clean = cleanClanName(name);
    if (q.clanByName.get(clean)) throw new GameError('Tên gia tộc này đã có người dùng.');
    const icon = CLAN_EMBLEMS.includes(emblem) ? emblem : CLAN_EMBLEMS[0];
    const hue = /^#[0-9a-f]{6}$/i.test(color ?? '') ? color.toLowerCase() : '#c0392b';
    const cost = clanConfig().createCost;
    post({ userId, delta: -cost, kind: 'clan_create', memo: clean, now });
    toTreasury(cost / 2, 'clan_create', clean, now);
    const id = Number(q.insertClan.run(clean, icon, hue, userId, now).lastInsertRowid);
    q.addMember.run(userId, id, 'leader', now);
    q.insertNews.run(`🏯 Gia tộc ${icon} ${clean} ra mắt`, now, now, now + 2 * DAY);
    return { message: `${icon} Đã lập gia tộc ${clean}!` };
  });
}

export function joinClan(userId, clanId, now = Date.now()) {
  return transaction(() => {
    if (q.member.get(userId)) throw new GameError('Bạn đã ở một gia tộc rồi.');
    const clan = q.clan.get(clanId);
    if (!clan || clan.dissolved_at) throw new GameError('Không tìm thấy gia tộc này.');
    if (q.memberCount.get(clanId).n >= clanPerks(levelOf(clan)).maxMembers) throw new GameError('Gia tộc đã đủ người, chờ gia tộc lên cấp nhé.');
    q.addMember.run(userId, clanId, 'member', now);
    return { message: `Chào mừng bạn về ${clan.emblem} ${clan.name}!` };
  });
}

function dissolveClan(clan, now) {
  q.releaseClanPlots.run(clan.id);
  q.dropIndustries.run(clan.id);
  const left = clanBalance(clan.id);
  if (left > 0) {
    post({ account: clanAccount(clan.id), delta: -left, kind: 'clan_upkeep', memo: 'Giải tán: quỹ còn lại về ngân sách', now });
    toTreasury(left, 'clan_upkeep', `Quỹ gia tộc ${clan.name} giải tán`, now);
  }
  q.dissolve.run(now, clan.id);
}

export function leaveClan(userId, now = Date.now()) {
  return transaction(() => {
    const { clan, member } = mustClanOf(userId);
    q.removeMember.run(userId);
    if (member.role === 'leader') {
      const next = q.successor.get(clan.id, userId);
      if (!next) {
        dissolveClan(clan, now);
        return { message: `Bạn là người cuối cùng: gia tộc ${clan.name} đã giải tán, đất trả về Sở Nhà Đất.` };
      }
      q.setRole.run('leader', next.user_id);
      q.setLeader.run(next.user_id, clan.id);
    }
    return { message: `Đã rời gia tộc ${clan.name}.` };
  });
}

export function kickMember(userId, targetId, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustRole(userId, ['leader'], 'mời thành viên ra khỏi gia tộc');
    const target = q.member.get(targetId);
    if (!target || target.clan_id !== clan.id) throw new GameError('Người này không ở gia tộc của bạn.');
    if (targetId === userId) throw new GameError('Muốn rời thì bấm "Rời gia tộc".');
    q.removeMember.run(targetId);
    return { message: `Đã mời ${getUser(targetId)?.username ?? 'thành viên'} rời gia tộc.`, at: now };
  });
}

export function setMemberRole(userId, targetId, role) {
  return transaction(() => {
    const { clan } = mustRole(userId, ['leader'], 'phân vai');
    const target = q.member.get(targetId);
    if (!target || target.clan_id !== clan.id || targetId === userId) throw new GameError('Không phân vai được cho người này.');
    if (role === 'leader') {
      q.setRole.run('elder', userId);
      q.setRole.run('leader', targetId);
      q.setLeader.run(targetId, clan.id);
      return { message: `Đã nhường chức tộc trưởng cho ${getUser(targetId).username}.` };
    }
    if (role !== 'elder' && role !== 'member') throw new GameError('Vai không hợp lệ.');
    q.setRole.run(role, targetId);
    return { message: `${getUser(targetId).username} giờ là ${role === 'elder' ? 'trưởng lão' : 'thành viên'}.` };
  });
}

export function donateClan(userId, amount, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustClanOf(userId);
    if (!Number.isInteger(amount) || amount < 10) throw new GameError('Góp tối thiểu 10 xu.');
    post({ userId, delta: -amount, kind: 'clan_donation', memo: clan.name, now });
    post({ account: clanAccount(clan.id), delta: amount, kind: 'clan_donation', memo: getUser(userId).username, now });
    q.addDonated.run(amount, userId);
    q.addWeekDonation.run(clan.id, userId, weekKey(dayKey(now)), amount);
    q.addXp.run(Math.floor(amount / 10), clan.id);
    return { message: `💰 Đã góp ${fmt(amount)} xu vào quỹ ${clan.name}.` };
  });
}

export function enterIndustry(userId, industry, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustRole(userId, ['leader'], 'thâu tóm ngành');
    const cfg = clanConfig();
    if (!INDUSTRIES[industry]) throw new GameError('Không có ngành này.');
    const owned = q.industries.all(clan.id);
    if (owned.some((i) => i.industry === industry)) throw new GameError('Gia tộc đã nắm ngành này rồi.');
    if (owned.length >= 3) throw new GameError('Mỗi gia tộc thâu tóm tối đa 3 ngành.');
    if (isStrategic(industry)) {
      if (owned.some((i) => isStrategic(i.industry))) throw new GameError('Mỗi gia tộc chỉ nắm được 1 ngành chiến lược (Trị thủy, Năng lượng gió, Ngân hàng nhà nước, Thuế vụ).');
      const holders = (industryCounts()[industry] ?? 0);
      if (holders >= STRATEGIC_INDUSTRIES[industry].maxClans) throw new GameError(`${INDUSTRIES[industry].name} đã đủ ${STRATEGIC_INDUSTRIES[industry].maxClans} gia tộc nắm giữ.`);
    }
    const need = cfg.industryLevels[owned.length];
    if (levelOf(clan) < need) throw new GameError(`Thâu tóm ngành thứ ${owned.length + 1} cần gia tộc đạt cấp ${need}.`);
    const fee = entryFee(industry, owned.length, cfg);
    const ind = INDUSTRIES[industry];
    clanSpend(clan.id, fee, 'clan_comp', `Thâu tóm ngành ${ind.name}`, now);
    toTreasury(fee / 2, 'clan_comp', `${clan.name} bồi thường thị trường ngành ${ind.name}`, now);
    q.addIndustry.run(clan.id, industry, fee, now);
    q.insertNews.run(`${ind.icon} Gia tộc ${clan.name} thâu tóm ngành ${ind.name}, bồi thường thị trường ${fmt(fee)} xu`, now, now, now + 2 * DAY);
    const rate = taxRate(owned.length + 1, cfg);
    return { message: `${ind.icon} Đã thâu tóm ngành ${ind.name}. Thuế doanh nghiệp của gia tộc giờ là ${Math.round(rate * 100)}%.` };
  });
}

/** Tỉ lệ doanh thu gia tộc tự khai báo để tính thuế (0–100%). */
export function setDeclareRatio(userId, ratio) {
  return transaction(() => {
    const { clan } = mustRole(userId, ['leader'], 'khai báo thuế');
    const r = Number(ratio);
    if (!Number.isFinite(r) || r < 0 || r > 1) throw new GameError('Tỉ lệ khai báo phải từ 0 đến 100%.');
    q.setDeclare.run(Math.round(r * 100) / 100, clan.id);
    return { message: `Đã cập nhật tờ khai: khai báo ${Math.round(r * 100)}% doanh thu.` };
  });
}

/** Chia cổ tức từ quỹ cho mọi thành viên, chia đều. */
export function payDividend(userId, amount, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustRole(userId, ['leader'], 'chia cổ tức');
    const members = q.members.all(weekKey(dayKey(now)), clan.id);
    if (!Number.isInteger(amount) || amount < members.length) throw new GameError('Số tiền chia không hợp lệ.');
    const each = Math.floor(amount / members.length);
    clanSpend(clan.id, each * members.length, 'clan_dividend', `Chia cổ tức ${members.length} người`, now);
    for (const m of members) post({ userId: m.user_id, delta: each, kind: 'clan_dividend', memo: clan.name, now });
    return { message: `🎉 Đã chia ${fmt(each)} xu cho mỗi thành viên (${members.length} người).` };
  });
}

// ---------------------------------------------------------------- đất & công trình

function ownPlot(userId, plotId, roles, what) {
  const ctx = mustRole(userId, roles, what);
  ensurePlots();
  const row = q.plot.get(Number(plotId));
  const plot = PLOT_BY_ID.get(Number(plotId));
  if (!row || !plot) throw new GameError('Không có lô đất này.');
  if (row.clan_id !== ctx.clan.id) throw new GameError('Lô này không thuộc gia tộc của bạn.');
  return { ...ctx, row, plot };
}

export function buyPlot(userId, plotId, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustRole(userId, ['leader', 'elder'], 'mua đất');
    ensurePlots();
    const plot = PLOT_BY_ID.get(Number(plotId));
    const row = plot && q.plot.get(plot.id);
    if (!row) throw new GameError('Không có lô đất này.');
    if (row.clan_id) throw new GameError('Lô này đã có chủ.');
    const max = clanPerks(levelOf(clan)).maxPlots;
    if (q.clanPlots.all(clan.id).length >= max) throw new GameError(`Gia tộc cấp ${levelOf(clan)} giữ tối đa ${max} lô. Lên cấp để mua thêm.`);
    const stats = landStats(now);
    const price = listingPrice(plot, row, stats);
    clanSpend(clan.id, price, 'clan_land', `Mua lô ${plot.code}`, now);
    toTreasury(price * clanConfig().land.treasuryShare, 'clan_land', `Bán lô ${plot.code} cho ${clan.name}`, now);
    q.buyPlot.run(clan.id, now, price, stats.landIndex, plot.id);
    if (stats.free - 1 <= 20) q.insertNews.run(`🏘️ Quỹ đất chỉ còn ${stats.free - 1} lô, giá đất tăng mạnh`, now, now, now + DAY);
    return { message: `🏘️ Gia tộc đã mua lô ${plot.code} giá ${fmt(price)} xu.` };
  });
}

export function sellPlot(userId, plotId, now = Date.now()) {
  return transaction(() => {
    const { clan, row, plot } = ownPlot(userId, plotId, ['leader'], 'bán đất');
    const value = plotValue(plot, row, landStats(now).landIndex, now);
    const pay = Math.round(value * clanConfig().land.resaleRate);
    q.releasePlot.run(plot.id);
    post({ account: clanAccount(clan.id), delta: pay, kind: 'clan_land', memo: `Bán lại lô ${plot.code}`, now });
    return { message: `Đã bán lại lô ${plot.code} cho Sở Nhà Đất, nhận ${fmt(pay)} xu.` };
  });
}

export function setPlotIndustry(userId, plotId, industry) {
  return transaction(() => {
    const { clan, plot } = ownPlot(userId, plotId, ['leader', 'elder'], 'chọn ngành cho lô đất');
    if (!q.industries.all(clan.id).some((i) => i.industry === industry)) throw new GameError('Gia tộc chưa thâu tóm ngành này.');
    if (isStrategic(industry) && !strategicPlaceOk(industry, plot)) throw new GameError(`Lô ${plot.code} không dựng được hạ tầng ${INDUSTRIES[industry].name}.`);
    q.setPlotIndustry.run(industry, plot.id);
    if (industry === 'power') setPlotVariant(plot.id, plantsFor(plot)[0]);
    return { message: `Lô ${plot.code} giờ làm ngành ${INDUSTRIES[industry].icon} ${INDUSTRIES[industry].name}.` };
  });
}

/** Chọn loại nhà máy điện cho một lô làm ngành Năng lượng. */
export function choosePlant(userId, plotId, plant) {
  return transaction(() => {
    const { row, plot } = ownPlot(userId, plotId, ['leader', 'elder'], 'chọn loại nhà máy điện');
    if (row.industry !== 'power') throw new GameError(`Lô ${plot.code} chưa làm ngành Năng lượng.`);
    return setPlotVariant(plot.id, plant);
  });
}

/** Lưu thiết kế công trình: chỉ trả phần giá vượt quá số đã chi cho lô này trước đó. */
export function saveDesign(userId, plotId, input, now = Date.now()) {
  return transaction(() => {
    const { clan, row, plot } = ownPlot(userId, plotId, ['leader', 'elder'], 'xây công trình');
    let design;
    try {
      design = cleanDesign(input);
    } catch (err) {
      throw new GameError(err.message);
    }
    const cost = designCost(design);
    const extra = Math.max(0, cost - row.design_spent);
    clanSpend(clan.id, extra, 'clan_build', `Công trình lô ${plot.code}`, now);
    q.setDesign.run(JSON.stringify(design), Math.max(row.design_spent, cost), plot.id);
    const ready = designComplete(design);
    return { message: `🏗️ Đã lưu công trình lô ${plot.code}${extra ? ` (chi ${fmt(extra)} xu)` : ''}.${ready ? '' : ' Cần ít nhất 3 mảnh, có móng nền thì lô mới hoạt động.'}` };
  });
}

// ---------------------------------------------------------------- màn hình

function clanCard(c) {
  return { id: c.id, name: c.name, emblem: c.emblem, color: c.color, level: levelOf(c) };
}

export function clanView(userId, now = Date.now()) {
  const cfg = clanConfig();
  const counts = industryCounts();
  const today = dayKey(now);
  const week = weekKey(today);
  const stats = landStats(now);
  const list = q.active.all().slice(0, 40).map((c) => ({
    ...clanCard(c),
    members: q.memberCount.get(c.id).n,
    maxMembers: clanPerks(levelOf(c)).maxMembers,
    plots: q.clanPlots.all(c.id).length,
    industries: q.industries.all(c.id).map((i) => i.industry),
  }));
  const config = {
    createCost: cfg.createCost, unlockLevel: cfg.unlockLevel, industryLevels: cfg.industryLevels, expandMultiplier: cfg.expandMultiplier,
    baseTax: cfg.baseTax, extraTaxPerIndustry: cfg.extraTaxPerIndustry, refundRate: cfg.refundRate, comp: cfg.comp,
    donationQuotaPerLevel: cfg.donationQuotaPerLevel, levels: CLAN_LEVELS, emblems: CLAN_EMBLEMS, industryClans: counts,
  };
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) return { clan: null, clans: list, config, macro: stats.macro };

  const level = levelOf(clan);
  const industries = q.industries.all(clan.id);
  const plots = q.clanPlots.all(clan.id).map((row) => {
    const plot = PLOT_BY_ID.get(row.id);
    const design = JSON.parse(row.design);
    const prod = row.industry && isStrategic(row.industry) ? { value: 0 } : row.industry && isProduction(row.industry) ? productionPreview(plot, { industry: row.industry, variant: row.variant, design, level, macro: stats.macro }) : null;
    const rev = row.industry && !prod ? plotRevenue(plot, { industry: row.industry, design, level, macro: stats.macro, clansInIndustry: counts[row.industry] ?? 1 }) : prod && { operating: designComplete(design), revenue: designComplete(design) ? prod.value : 0 };
    return {
      id: plot.id, code: plot.code, zone: plot.zone, climate: plot.climate, industry: row.industry, variant: row.variant, pieces: design.length,
      operating: Boolean(rev?.operating), estimate: rev?.revenue ?? 0, boughtPrice: row.bought_price,
      value: plotValue(plot, row, stats.landIndex, now),
    };
  });
  const quota = cfg.donationQuotaPerLevel * level;
  const month = today.slice(0, 7);
  return {
    clan: {
      ...clanCard(clan),
      xp: clan.xp,
      xpNext: CLAN_LEVELS[level] ?? null,
      xpFloor: CLAN_LEVELS[level - 1],
      perks: clanPerks(level),
      role: m.role,
      treasury: clanBalance(clan.id),
      declareRatio: clan.declare_ratio,
      taxRate: taxRate(industries.length, cfg),
      industries: industries.map((i) => ({ id: i.industry, fee: i.fee, enteredAt: i.entered_at })),
      nextFees: Object.fromEntries(INDUSTRY_ORDER.map((id) => [id, entryFee(id, industries.length, cfg)])),
      nextIndustryLevel: cfg.industryLevels[industries.length] ?? null,
      members: q.members.all(week, clan.id).map((x) => ({ id: x.user_id, username: x.username, role: x.role, donated: x.donated, week: x.week_amount })),
      quota,
      plots,
      days: q.days.all(clan.id, 14).map((d) => ({ day: d.day, revenue: d.revenue, declared: d.declared, rate: d.rate, tax: d.tax, upkeep: d.upkeep })),
      monthTax: q.monthTax.get(clan.id, `${month}-%`).tax,
      refunds: q.refunds.all(clan.id),
      upkeep: cfg.upkeepPerLevel * level + cfg.upkeepPerPlot * plots.length,
    },
    clans: list,
    config,
    macro: stats.macro,
  };
}

/** Bản đồ 200 lô: giá, chủ, ngành, công trình. */
export function landView(userId, now = Date.now()) {
  const cfg = clanConfig();
  const stats = landStats(now);
  const owners = new Map(q.active.all().map((c) => [c.id, clanCard(c)]));
  const myClan = q.member.get(userId);
  const rows = new Map(q.plots.all().map((r) => [r.id, r]));
  return {
    plots: PLOTS.map((p) => {
      const row = rows.get(p.id);
      const owner = row?.clan_id ? owners.get(row.clan_id) ?? null : null;
      return {
        id: p.id,
        price: owner ? null : listingPrice(p, row, stats, cfg),
        value: owner ? plotValue(p, row, stats.landIndex, now, cfg) : null,
        owner,
        industry: row?.industry ?? null,
        variant: row?.variant ?? null,
        deposits: plotDeposits(p.id),
        design: owner ? JSON.parse(row.design) : [],
        mine: Boolean(owner && myClan && owner.id === myClan.clan_id),
        spent: owner && myClan && owner.id === myClan.clan_id ? row.design_spent : null,
      };
    }),
    stats: {
      sold: stats.sold, free: stats.free, scarcity: scarcityFactor(stats.soldRatio, cfg.land.scarcityK), landIndex: stats.landIndex,
      mode: cfg.land.mode, resaleRate: cfg.land.resaleRate, minPrice: cfg.land.minPrice, maxPrice: cfg.land.maxPrice,
    },
    macro: stats.macro,
    myClanId: myClan?.clan_id ?? null,
    myRole: myClan?.role ?? null,
  };
}

/** Xem trước một lô với một ngành: từng hệ số môi trường, thời tiết, vĩ mô và doanh thu ước tính sau thuế. */
export function plotPreview(userId, plotId, industry, now = Date.now()) {
  const plot = PLOT_BY_ID.get(Number(plotId));
  if (!plot) throw new GameError('Không có lô đất này.');
  if (!INDUSTRIES[industry]) throw new GameError('Không có ngành này.');
  const cfg = clanConfig();
  const stats = landStats(now);
  const counts = industryCounts();
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  const level = clan ? levelOf(clan) : 1;
  const owned = clan ? q.industries.all(clan.id) : [];
  const has = owned.some((i) => i.industry === industry);
  const row = q.plot.get(plot.id);
  const design = row?.clan_id && clan && row.clan_id === clan.id ? JSON.parse(row.design) : [];
  const clansInIndustry = (counts[industry] ?? 0) + (has ? 0 : 1);
  const rate = taxRate(Math.max(1, owned.length + (has ? 0 : 1)), cfg);
  if (isProduction(industry)) {
    const variant = row?.industry === 'power' && industry === 'power' ? row.variant : plantsFor(plot)[0];
    const prod = productionPreview(plot, { industry, variant, design, level, macro: stats.macro });
    const margin = Math.max(0, prod.value - prod.cost);
    return { plotId: plot.id, industry, production: prod, variant, revenue: prod.value, afterTax: Math.round(margin * (1 - rate)), taxRate: rate, clansInIndustry };
  }
  // Doanh thu khi lô đã có công trình hoàn chỉnh (thưởng công trình tính theo thiết kế hiện có, nếu có).
  const rev = plotRevenue(plot, { industry, design, level, macro: stats.macro, clansInIndustry });
  return {
    plotId: plot.id,
    industry,
    factors: rev.factors,
    revenue: rev.gross,
    afterTax: Math.round(rev.gross * (1 - rate)),
    taxRate: rate,
    clansInIndustry,
  };
}

// ---------------------------------------------------------------- quyết toán mỗi đêm

/** Doanh thu, thuế, phí duy trì của mọi gia tộc cho ngày `day`; hoàn thuế cuối tháng; định mức góp quỹ cuối tuần; vĩ mô ngày mai. */
export function settleClansDay(day, rand = Math.random) {
  const cfg = clanConfig();
  const end = startOfDay(day) + DAY;
  const at = end - 1;
  transaction(() => {
    ensurePlots();
    const macro = macroFor(day, { rand, force: cfg.macro, now: startOfDay(day) });
    const counts = industryCounts();
    const sundayWeek = weekday(day) === 0 ? weekKey(day) : null;
    const monthEnd = nextDay(day).endsWith('-01');
    for (const clan of q.active.all()) {
      const level = levelOf(clan);
      const nInd = q.industries.all(clan.id).length;
      const plots = q.clanPlots.all(clan.id);
      let service = 0;
      for (const row of plots) {
        if (!row.industry || isProduction(row.industry)) continue;
        const r = plotRevenue(PLOT_BY_ID.get(row.id), { industry: row.industry, design: JSON.parse(row.design), level, macro, clansInIndustry: counts[row.industry] ?? 1 }, cfg);
        service += r.revenue;
      }
      // Ngành sản xuất: hàng làm ra vào kho, phần bán cho NPC vào quỹ ngay trong runProduction;
      // tiền bán trên sàn chung trong ngày đã vào quỹ lúc giao dịch. Cả ba đều tính thuế.
      // Hạ tầng chiến lược: buff được áp khi quỹ đủ trả phí ước tính (20% phần tăng thêm), không đủ thì dừng buff.
      const irr = buffFor('irrigation', { clanId: clan.id });
      const wind = buffFor('wind_farm', { clanId: clan.id });
      const estimate = (pred) => plots.filter((r) => pred(r.industry)).reduce((s, r) => s + (productionPreview(PLOT_BY_ID.get(r.id), { industry: r.industry, variant: r.variant, design: JSON.parse(r.design), level, macro })?.value ?? 0), 0);
      const irrOk = irr.total > 0 && clanBalance(clan.id) >= estimate((i) => ['agriculture', 'livestock', 'forestry'].includes(i)) * irr.paid * STRATEGIC_RULES.fee;
      const windOk = wind.total > 0 && clanBalance(clan.id) >= estimate((i) => isProduction(i) && !isStrategic(i)) * wind.paid * STRATEGIC_RULES.fee;
      const { revenue: sold, extra } = runProduction(clan, plots, { day, macro, at, rand, buffs: { irrigation: irrOk ? irr.total : 0, wind: windOk ? wind.total : 0 } });
      if (irrOk && irr.paid > 0) chargeInfraFee('irrigation', extra.irrigation * (irr.paid / irr.total), { clanId: clan.id, now: at, memo: 'sản lượng nông lâm' });
      if (windOk && wind.paid > 0) chargeInfraFee('wind_farm', extra.wind * (wind.paid / wind.total), { clanId: clan.id, now: at, memo: 'số mẻ nhà máy' });
      const traded = tradeIncome(clan.id, day);
      // Năng lượng gió: thêm xu trên tiền bán hàng (NPC và sàn) của gia tộc.
      let windCoins = 0;
      if (windOk && sold + traded > 0) {
        windCoins = Math.floor((sold + traded) * wind.total);
        post({ account: clanAccount(clan.id), delta: windCoins, kind: 'clan_revenue', memo: `Năng lượng gió +${Math.round(wind.total * 100)}% ${day}`, now: at });
        if (wind.paid > 0) chargeInfraFee('wind_farm', (sold + traded) * wind.paid, { clanId: clan.id, now: at, memo: 'thu nhập bán hàng' });
      }
      const revenue = service + sold + traded + windCoins;
      const rate = taxRate(Math.max(1, nInd), cfg);
      const declared = Math.round(revenue * clan.declare_ratio);
      const tax = Math.round(declared * rate);
      if (revenue > 0) {
        if (service > 0) post({ account: clanAccount(clan.id), delta: service, kind: 'clan_revenue', memo: day, now: at });
        if (tax > 0) {
          post({ account: clanAccount(clan.id), delta: -tax, kind: 'corp_tax', memo: day, now: at });
          toTreasury(tax / 2, 'corp_tax', `Thuế doanh nghiệp ${clan.name} ${day}`, at);
        }
        const evaded = Math.round((revenue - declared) * rate);
        if (evaded > 0) {
          q.insertEvasion.run(clan.id, day, revenue, declared, rate, evaded, end);
          adminLog('Sở thuế', 'tax_evasion', null, { clanId: clan.id, clan: clan.name, day, revenue, declared, evaded });
        }
        q.addXp.run(Math.floor((revenue - tax) / 100), clan.id);
      }
      let upkeep = cfg.upkeepPerLevel * level + cfg.upkeepPerPlot * plots.length;
      if (upkeep > 0 && clanBalance(clan.id) >= upkeep) {
        post({ account: clanAccount(clan.id), delta: -upkeep, kind: 'clan_upkeep', memo: day, now: at });
        toTreasury(upkeep / 2, 'clan_upkeep', clan.name, at);
      } else if (upkeep > 0) {
        // Quỹ không đủ phí duy trì: gia tộc mất kinh nghiệm thay vì nợ.
        q.addXp.run(-Math.ceil(upkeep / 10), clan.id);
        upkeep = 0;
      }
      q.addDay.run(clan.id, day, revenue, declared, rate, tax, upkeep);

      if (sundayWeek) {
        const quota = cfg.donationQuotaPerLevel * level;
        const short = q.members.all(sundayWeek, clan.id).reduce((s, x) => s + Math.max(0, quota - x.week_amount), 0);
        if (short > 0) q.addXp.run(-Math.ceil(short / 10), clan.id);
      }
      if (monthEnd) {
        const month = day.slice(0, 7);
        const taxed = q.monthTax.get(clan.id, `${month}-%`).tax;
        const refund = Math.min(Math.floor(taxed * cfg.refundRate), Math.max(0, treasuryBalance()));
        if (q.insertRefund.run(clan.id, month, taxed, refund, end).changes && refund > 0) {
          post({ account: 'treasury', delta: -refund, kind: 'corp_tax_refund', memo: `${clan.name} ${month}`, now: at });
          post({ account: clanAccount(clan.id), delta: refund, kind: 'corp_tax_refund', memo: month, now: at });
        }
      }
    }
    expireListings(end);
    rollNextDay(day, { rand, force: cfg.macro });
  });
}

// ---------------------------------------------------------------- Sở thuế & quản trị

export function adminClanView(now = Date.now()) {
  const cfg = clanConfig();
  const stats = landStats(now);
  const counts = industryCounts();
  const rows = new Map(q.plots.all().map((r) => [r.id, r]));
  const clans = q.active.all().map((c) => {
    const plots = q.clanPlots.all(c.id);
    const days = q.days.all(c.id, 30);
    return {
      ...clanCard(c),
      xp: c.xp,
      leader: getUser(c.leader_id)?.username ?? null,
      members: q.memberCount.get(c.id).n,
      treasury: clanBalance(c.id),
      industries: q.industries.all(c.id).map((i) => i.industry),
      plots: plots.length,
      landValue: plots.reduce((s, r) => s + plotValue(PLOT_BY_ID.get(r.id), r, stats.landIndex, now, cfg), 0),
      declareRatio: c.declare_ratio,
      revenue30: days.reduce((s, d) => s + d.revenue, 0),
      tax30: days.reduce((s, d) => s + d.tax, 0),
    };
  });
  const owners = new Map(clans.map((c) => [c.id, c.name]));
  return {
    config: cfg,
    defaults: DEFAULT_CLAN_CONFIG,
    stats: { sold: stats.sold, free: stats.free, scarcity: scarcityFactor(stats.soldRatio, cfg.land.scarcityK), landIndex: stats.landIndex, industryClans: counts },
    macro: stats.macro,
    clans,
    plots: PLOTS.map((p) => {
      const row = rows.get(p.id);
      return {
        id: p.id, code: p.code, zone: p.zone, climate: p.climate, growth: p.growth, prod: p.prod,
        base: Math.round(scaledBase(p, cfg)),
        price: row?.clan_id ? null : listingPrice(p, row, stats, cfg),
        override: row?.price_override ?? null,
        owner: row?.clan_id ? owners.get(row.clan_id) ?? null : null,
        industry: row?.industry ?? null,
      };
    }),
    evasions: q.evasions.all(100),
    treasury: treasuryBalance(),
  };
}

export function setPlotOverride(plotId, price) {
  ensurePlots();
  if (!PLOT_BY_ID.has(Number(plotId))) throw new GameError('Không có lô đất này.');
  const value = price == null || price === '' ? null : Number(price);
  if (value != null && (!Number.isInteger(value) || value < 1_000 || value > 1_000_000_000)) throw new GameError('Giá phải là số nguyên từ 1.000 xu.');
  q.setOverride.run(value, Number(plotId));
  return value;
}

/** Sở thuế xử lý hồ sơ: truy thu phần thuế trốn cộng tiền phạt (lấy tới hết quỹ), hoặc bỏ qua. */
// ---------------------------------------------------------------- Thuế vụ (ngành nhà nước của gia tộc)

/** Gia tộc nắm Thuế vụ (đang vận hành) và mức hoa hồng theo cấp hạ tầng; null nếu người này không thuộc gia tộc đó. */
function taxOfficeOf(userId) {
  const m = q.member.get(userId);
  if (!m || strategicOf(m.clan_id) !== 'tax_office') return null;
  const owner = operatingOwners('tax_office').find((o) => o.id === m.clan_id);
  return owner ? { clanId: m.clan_id, role: m.role, rate: STRATEGIC_RULES.levels[owner.level - 1].buff } : null;
}

/** Hồ sơ khai thiếu của các gia tộc khác, chỉ gia tộc Thuế vụ thấy. */
export function taxOfficeCases(userId) {
  const office = taxOfficeOf(userId);
  if (!office) return null;
  return {
    rate: office.rate,
    penalty: STRATEGIC_RULES.collectPenalty,
    cases: q.evasions.all(100).filter((e) => e.status === 'open' && e.clan_id !== office.clanId)
      .map((e) => ({ id: e.id, clan: e.clan_name, emblem: e.emblem, day: e.day, revenue: e.revenue, declared: e.declared, evaded: e.evaded })),
  };
}

/** Thuế vụ đi truy thu một hồ sơ: thu phần thuế trốn + phạt từ quỹ gia tộc trốn thuế, hưởng hoa hồng, còn lại vào ngân sách. */
export function collectAsTaxOffice(userId, id, now = Date.now()) {
  return transaction(() => {
    const office = taxOfficeOf(userId);
    if (!office) throw new GameError('Chỉ gia tộc nắm Thuế vụ (đang vận hành) mới đi truy thu được.');
    if (office.role !== 'leader' && office.role !== 'elder') throw new GameError('Chỉ tộc trưởng hoặc trưởng lão mới đi truy thu.');
    const row = q.evasion.get(Number(id));
    if (!row || row.status !== 'open') throw new GameError('Hồ sơ không còn mở.');
    if (row.clan_id === office.clanId) throw new GameError('Không tự truy thu chính gia tộc mình.');
    const clan = q.clan.get(office.clanId);
    const due = Math.round(row.evaded * (1 + STRATEGIC_RULES.collectPenalty));
    const collected = Math.min(due, Math.max(0, clanBalance(row.clan_id)));
    const commission = Math.round(collected * office.rate);
    if (collected > 0) {
      post({ account: clanAccount(row.clan_id), delta: -collected, kind: 'corp_tax_collect', memo: `Thuế vụ truy thu ngày ${row.day}`, now });
      if (commission > 0) post({ account: clanAccount(office.clanId), delta: commission, kind: 'tax_commission', memo: `Hoa hồng truy thu hồ sơ #${row.id}`, now });
      if (collected - commission > 0) post({ account: 'treasury', delta: collected - commission, kind: 'corp_tax_collect', memo: `Thuế vụ ${clan.name} truy thu gia tộc #${row.clan_id}`, now });
    }
    q.resolveEvasion.run('collected', collected, `Thuế vụ: ${clan.name}`, now, row.id);
    adminLog(`Thuế vụ: ${clan.name}`, 'tax_collect', null, { evasionId: row.id, collected, commission });
    return { message: `🧾 Truy thu ${collected.toLocaleString('vi-VN')} xu, gia tộc hưởng hoa hồng ${commission.toLocaleString('vi-VN')} xu.` };
  });
}

export function resolveEvasion(id, action, { penalty = 0.5, actor = 'Quản trị viên' } = {}, now = Date.now()) {
  return transaction(() => {
    const row = q.evasion.get(Number(id));
    if (!row) throw new GameError('Không có hồ sơ này.');
    if (row.status !== 'open') throw new GameError('Hồ sơ đã xử lý rồi.');
    if (action === 'dismiss') {
      q.resolveEvasion.run('dismissed', 0, actor, now, row.id);
      return { collected: 0 };
    }
    const due = Math.round(row.evaded * (1 + Math.min(5, Math.max(0, Number(penalty) || 0))));
    const collected = Math.min(due, Math.max(0, clanBalance(row.clan_id)));
    if (collected > 0) {
      post({ account: clanAccount(row.clan_id), delta: -collected, kind: 'corp_tax_collect', memo: `Truy thu thuế ngày ${row.day}`, now });
      post({ account: 'treasury', delta: collected, kind: 'corp_tax_collect', memo: `Truy thu gia tộc #${row.clan_id} ngày ${row.day}`, now });
    }
    q.resolveEvasion.run('collected', collected, actor, now, row.id);
    return { collected, due };
  });
}
