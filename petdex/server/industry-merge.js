// Gộp ngành (41 → 26) và gỡ gộp để quay lại bản cũ.
//
// Gộp chạy một lần lúc khởi động (bước industries_merge_v1 trong migrate.js) và ghi lại mọi thứ đã đổi vào
// industry_merge_log. Gỡ gộp chỉ chạy khi quản trị viên yêu cầu (bảng quản lý → Gia tộc), NGAY TRƯỚC KHI deploy lại
// bản cũ: lô và ngành đã thâu tóm về id cũ, ngành bị xoá được khôi phục, tiền đã hoàn bị thu lại (trong phạm vi quỹ),
// và đặt cờ giữ để bản mới đang chạy không tự gộp lại khi khởi động lại. "Gộp lại" bỏ cờ giữ và gộp ngay.
import { adminLog, db, getMeta, setMeta, transaction } from './db.js';
import { DAY } from './game.js';
import { post } from './ledger.js';
import { MERGED_INTO, PRODUCTION_INDUSTRIES, depositsOf, extractKindOf, lineOf } from '../../public/ta-tua/game/js/shared/industry.js';
import { PLOTS } from '../../public/ta-tua/game/js/shared/clan.js';

const FLAG = 'migrated_industries_merge_v1';
const HOLD = 'industries_merge_hold';
const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));
const MERGED_IDS = [...new Set(Object.values(MERGED_INTO).map((m) => m.industry))];
const clanAccount = (id) => `clan:${id}`;
// Tên các ngành cũ (trước khi gộp) để đọc bút toán "Thâu tóm ngành <tên>" khi nhật ký trống.
const OLD_BY_NAME = {
  'Khai khoáng': 'mining', 'Dầu khí': 'oil_gas', 'Nông nghiệp': 'agriculture', 'Chăn nuôi': 'livestock',
  'Chế biến thực phẩm': 'food_processing', 'Dệt may': 'textiles', 'Đồ gỗ nội thất': 'furniture',
  'Điện tử, máy tính': 'electronics', 'Vi mạch': 'semiconductors', 'Luyện thép': 'steel', 'Luyện nhôm': 'aluminium',
  'Lọc dầu': 'refinery', 'Hóa chất': 'chemicals', 'Ô tô': 'autos', 'Tàu hỏa': 'trains', 'Đóng tàu': 'shipbuilding', 'Hàng không': 'aerospace',
};
const REFUND_MEMO = /^Hoàn tiền thâu tóm (\S+) \(gộp ngành\)$/;

const q = {
  log: db.prepare('INSERT INTO industry_merge_log (kind, clan_id, plot_id, old_industry, new_industry, line, fee, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  logs: db.prepare('SELECT * FROM industry_merge_log ORDER BY id'),
  clearLog: db.prepare('DELETE FROM industry_merge_log'),
  plots: db.prepare('SELECT id, clan_id, industry, variant FROM land_plots WHERE industry IS NOT NULL'),
  setPlot: db.prepare('UPDATE land_plots SET industry = ?, variant = ? WHERE id = ?'),
  industries: db.prepare('SELECT * FROM clan_industries ORDER BY clan_id, entered_at'),
  drop: db.prepare('DELETE FROM clan_industries WHERE clan_id = ? AND industry = ?'),
  rename: db.prepare('UPDATE clan_industries SET industry = ? WHERE clan_id = ? AND industry = ?'),
  insert: db.prepare('INSERT OR IGNORE INTO clan_industries (clan_id, industry, fee, entered_at) VALUES (?, ?, ?, ?)'),
  balance: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  refunds: db.prepare("SELECT account, delta, memo, created_at FROM ledger WHERE kind = 'clan_comp' AND account LIKE 'clan:%' AND delta > 0 AND memo LIKE 'Hoàn tiền thâu tóm % (gộp ngành)' AND created_at >= ? ORDER BY id"),
  bought: db.prepare("SELECT memo FROM ledger WHERE account = ? AND kind = 'clan_comp' AND delta = ? AND created_at = ? AND memo LIKE 'Thâu tóm ngành %' ORDER BY id DESC LIMIT 1"),
  news: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

export const mergeHeld = () => Boolean(getMeta(HOLD));
export const mergeDone = () => Boolean(getMeta(FLAG));

/**
 * Gộp: lô sang ngành mới đúng dây chuyền; ngành đã thâu tóm đổi id, dòng trùng bị xoá và hoàn tiền thâu tóm.
 * Ghi lại từng thay đổi vào industry_merge_log để gỡ gộp được. Gọi trong transaction.
 */
export function mergeIndustries(now) {
  // Lô làm "Điện tử, máy tính" cũ (giữ id electronics) chạy dây chuyền máy tính.
  for (const row of q.plots.all()) {
    if (row.industry === 'electronics' && row.variant == null) {
      q.setPlot.run('electronics', 'electronics', row.id);
      q.log.run('plot', row.clan_id, row.id, 'electronics', 'electronics', 'electronics', 0, now);
      continue;
    }
    const to = MERGED_INTO[row.industry];
    if (!to) continue;
    q.setPlot.run(to.industry, to.line, row.id);
    q.log.run('plot', row.clan_id, row.id, row.industry, to.industry, to.line, 0, now);
  }
  const kept = new Map(); // clan → các ngành mới đã có
  for (const r of q.industries.all()) {
    const target = MERGED_INTO[r.industry]?.industry ?? r.industry;
    const have = kept.get(r.clan_id) ?? new Set();
    if (have.has(target)) {
      q.drop.run(r.clan_id, r.industry);
      if (r.fee > 0) post({ account: clanAccount(r.clan_id), delta: r.fee, kind: 'clan_comp', memo: `Hoàn tiền thâu tóm ${r.industry} (gộp ngành)`, now });
      q.log.run('industry_dropped', r.clan_id, null, r.industry, target, null, r.fee, r.entered_at);
    } else {
      if (target !== r.industry) {
        q.rename.run(target, r.clan_id, r.industry);
        q.log.run('industry_renamed', r.clan_id, null, r.industry, target, null, 0, r.entered_at);
      }
      have.add(target);
    }
    kept.set(r.clan_id, have);
  }
  q.news.run('🏭 Sở Kế hoạch gộp các ngành na ná nhau: 41 ngành còn 26. Đất và nhà máy giữ nguyên dây chuyền; gia tộc nắm ngành trùng được hoàn tiền thâu tóm.', now, now, now + 3 * DAY);
}

/** Ngành cũ của một lô đang làm ngành gộp `industry` (dây chuyền `variant`), khi nhật ký không có lô đó. */
function oldIdForPlot(plotId, industry, variant) {
  if (PRODUCTION_INDUSTRIES[industry]?.lines) return lineOf(industry, variant); // id dây chuyền = id ngành cũ
  const plot = PLOT_BY_ID.get(plotId);
  const kinds = new Set(Object.keys(plot ? depositsOf(plot) : {}).map(extractKindOf));
  if (industry === 'mining') return kinds.has('mineral') || !kinds.has('oilgas') ? 'mining' : 'oil_gas';
  if (industry === 'agriculture') return kinds.has('crop') || !kinds.has('livestock') ? 'agriculture' : 'livestock';
  return industry;
}

/** Ngành cũ mà gia tộc đã thâu tóm, đọc từ bút toán trả phí thâu tóm (cùng số tiền, cùng thời điểm). */
function boughtAs(r) {
  const memo = r.fee > 0 ? q.bought.get(clanAccount(r.clan_id), -r.fee, r.entered_at)?.memo : null;
  const old = memo && OLD_BY_NAME[memo.slice('Thâu tóm ngành '.length)];
  return old && (MERGED_INTO[old]?.industry ?? old) === r.industry ? old : undefined;
}

/** Ngành cũ mặc định khi gia tộc nắm ngành gộp mà không lô nào và nhật ký không cho biết. */
const defaultOldId = (industry) => (PRODUCTION_INDUSTRIES[industry]?.lines ? Object.keys(PRODUCTION_INDUSTRIES[industry].lines)[0] : industry);

/** Số kiểm tra sau khi gộp: còn lô/ngành mang id cũ không, lô nhà máy gộp nào chưa có dây chuyền, đã hoàn bao nhiêu. */
function mergeChecks() {
  const old = Object.keys(MERGED_INTO);
  const marks = old.map(() => '?').join(',');
  const lined = Object.keys(PRODUCTION_INDUSTRIES).filter((id) => PRODUCTION_INDUSTRIES[id].lines);
  const refunds = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(delta), 0) total FROM ledger WHERE kind = 'clan_comp' AND delta > 0 AND memo LIKE 'Hoàn tiền thâu tóm % (gộp ngành)'").get();
  return {
    flagAt: Number(getMeta(FLAG)) || null,
    oldIdPlots: db.prepare(`SELECT COUNT(*) n FROM land_plots WHERE industry IN (${marks})`).get(...old).n,
    oldIdIndustries: db.prepare(`SELECT COUNT(*) n FROM clan_industries WHERE industry IN (${marks})`).get(...old).n,
    nullLinePlots: db.prepare(`SELECT COUNT(*) n FROM land_plots WHERE variant IS NULL AND industry IN (${lined.map(() => '?').join(',')})`).get(...lined).n,
    refunds: { count: refunds.n, total: refunds.total },
  };
}

/**
 * Kế hoạch gỡ gộp (chỉ đọc): lô nào về ngành nào, ngành đã thâu tóm đổi/khôi phục ra sao, thu lại bao nhiêu tiền hoàn.
 */
export function unmergePlan() {
  const logs = q.logs.all();
  const plotLog = new Map(logs.filter((l) => l.kind === 'plot').map((l) => [l.plot_id, l.old_industry]));
  const plots = q.plots.all()
    .filter((r) => MERGED_IDS.includes(r.industry) || r.industry === 'electronics')
    .map((r) => ({
      id: r.id, clanId: r.clan_id, from: r.industry, line: r.variant,
      // Nhà máy gộp: theo dây chuyền ĐANG chạy (tộc trưởng có thể đã đổi sau khi gộp); ngành khai thác gộp: theo nhật ký, không có thì theo mỏ.
      to: PRODUCTION_INDUSTRIES[r.industry]?.lines ? lineOf(r.industry, r.variant) : plotLog.get(r.id) ?? oldIdForPlot(r.id, r.industry, r.variant),
    }));

  // Mỗi gia tộc cần những ngành cũ nào: theo lô của nó, theo dòng đã đổi tên trong nhật ký, và các dòng đã bị xoá.
  const renamedLog = new Map(logs.filter((l) => l.kind === 'industry_renamed').map((l) => [`${l.clan_id}:${l.new_industry}`, l]));
  const industries = [];
  for (const r of q.industries.all()) {
    if (!MERGED_IDS.includes(r.industry) && r.industry !== 'electronics') continue;
    const fromPlots = plots.filter((p) => p.clanId === r.clan_id && p.from === r.industry).map((p) => p.to);
    const logged = renamedLog.get(`${r.clan_id}:${r.industry}`)?.old_industry ?? (logs.length ? undefined : boughtAs(r));
    const needs = [...new Set([logged ?? null, ...fromPlots].filter(Boolean))];
    if (!needs.length) needs.push(defaultOldId(r.industry));
    // Lô cũ thuộc ngành giữ id (mining, agriculture, electronics) nhưng dòng vẫn mang id đó thì không cần đổi tên.
    const [first, ...rest] = needs.includes(r.industry) ? [r.industry, ...needs.filter((x) => x !== r.industry)] : needs;
    industries.push({ clanId: r.clan_id, from: r.industry, rename: first, add: rest, fee: r.fee, enteredAt: r.entered_at });
  }
  // Bản 656b1e2 gộp mà chưa ghi nhật ký: dựng lại các ngành bị xoá từ bút toán hoàn tiền của lần gộp đó
  // (ngành trùng thâu tóm miễn phí không có bút toán nên không khôi phục được).
  const restore = logs.length || !mergeDone()
    ? logs.filter((l) => l.kind === 'industry_dropped').map((l) => ({ clanId: l.clan_id, industry: l.old_industry, fee: l.fee, enteredAt: l.at }))
    : q.refunds.all(Number(getMeta(FLAG)) || 0).map((r) => ({ clanId: Number(r.account.slice(5)), industry: r.memo.match(REFUND_MEMO)?.[1], fee: r.delta, enteredAt: r.created_at }))
      .filter((r) => MERGED_INTO[r.industry]);
  const clawback = restore.filter((r) => r.fee > 0).map((r) => {
    const fund = q.balance.get(clanAccount(r.clanId))?.balance ?? 0;
    return { clanId: r.clanId, industry: r.industry, refunded: r.fee, take: Math.min(r.fee, Math.max(0, fund)) };
  });
  return { done: mergeDone(), held: mergeHeld(), logged: logs.length, fromLedger: !logs.length && mergeDone(), checks: mergeChecks(), plots, industries, restore, clawback };
}

/**
 * Gỡ gộp: áp kế hoạch trên, thu lại tiền hoàn (tối đa bằng số dư quỹ, phần thiếu bỏ qua và ghi vào kết quả),
 * xóa nhật ký, bỏ cờ đã gộp và đặt cờ giữ. Chạy NGAY TRƯỚC KHI deploy lại bản cũ.
 */
export function unmergeIndustries(actor = 'Quản trị viên', now = Date.now()) {
  return transaction(() => {
    const plan = unmergePlan();
    // Thu lại tiền hoàn theo số dư lúc này (quỹ có thể đã tiêu bớt): lấy được bao nhiêu thì lấy.
    const taken = [];
    for (const c of plan.clawback) {
      const fund = q.balance.get(clanAccount(c.clanId))?.balance ?? 0;
      const take = Math.min(c.refunded, Math.max(0, fund));
      if (take > 0) post({ account: clanAccount(c.clanId), delta: -take, kind: 'clan_comp', memo: `Thu lại tiền hoàn ${c.industry} (gỡ gộp ngành)`, now });
      taken.push({ ...c, take, short: c.refunded - take });
    }
    for (const p of plan.plots) q.setPlot.run(p.to, null, p.id);
    for (const r of plan.industries) {
      if (r.rename !== r.from) q.rename.run(r.rename, r.clanId, r.from);
      for (const extra of r.add) q.insert.run(r.clanId, extra, 0, r.enteredAt);
    }
    for (const r of plan.restore) q.insert.run(r.clanId, r.industry, r.fee, r.enteredAt);
    q.clearLog.run();
    db.prepare('DELETE FROM meta WHERE key = ?').run(FLAG);
    setMeta(HOLD, now);
    adminLog(actor, 'industries_unmerge', null, { plots: plan.plots.length, industries: plan.industries.length, restored: plan.restore.length, clawback: taken });
    q.news.run('🏭 Sở Kế hoạch tạm tách lại các ngành đã gộp.', now, now, now + DAY);
    return { ...plan, clawback: taken, done: false, held: true };
  });
}

/** Gộp lại sau khi đã gỡ: bỏ cờ giữ và gộp ngay (bản mới đang chạy). */
export function remergeIndustries(actor = 'Quản trị viên', now = Date.now()) {
  return transaction(() => {
    if (mergeDone()) return { done: true, held: false, message: 'Các ngành đang ở trạng thái đã gộp.' };
    db.prepare('DELETE FROM meta WHERE key = ?').run(HOLD);
    mergeIndustries(now);
    setMeta(FLAG, now);
    adminLog(actor, 'industries_merge', null, { logged: q.logs.all().length });
    return { done: true, held: false, message: 'Đã gộp lại các ngành.' };
  });
}
