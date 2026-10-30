// Tạm đóng công nghiệp nặng (Luyện kim, Hóa dầu, Điện tử & vi mạch, Máy móc, Phương tiện vận tải).
//
// Đóng: gia tộc đang nắm được hoàn phí thâu tóm vào quỹ, ngành bị gỡ khỏi gia tộc, lô đang làm ngành đó về trạng thái
// chưa chọn ngành (giữ công trình để chọn ngành khác), tộc trưởng nhận thư báo. Lô không chạy, không thâu tóm mới được.
// Mở lại (quản trị viên): bỏ cờ đóng, ai muốn làm thì thâu tóm lại như thường. Đóng lại lần nữa thì hoàn phí như trên.
import { adminLog, db, getMeta, setMeta, transaction } from './db.js';
import { sendMail } from './chat.js';
import { DAY } from './game.js';
import { post } from './ledger.js';
import { HEAVY_INDUSTRIES, PRODUCTION_INDUSTRIES } from '../../public/ta-tua/game/js/shared/industry.js';

const OPEN = 'heavy_industry_open';
const marks = HEAVY_INDUSTRIES.map(() => '?').join(',');
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

const q = {
  held: db.prepare(`SELECT ci.*, c.name AS clan_name FROM clan_industries ci JOIN clans c ON c.id = ci.clan_id WHERE ci.industry IN (${marks})`),
  drop: db.prepare('DELETE FROM clan_industries WHERE clan_id = ? AND industry = ?'),
  plots: db.prepare(`SELECT id, clan_id, industry FROM land_plots WHERE industry IN (${marks})`),
  clearPlot: db.prepare('UPDATE land_plots SET industry = NULL, variant = NULL WHERE id = ?'),
  leader: db.prepare("SELECT user_id FROM clan_members WHERE clan_id = ? AND role = 'leader'"),
  news: db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)'),
};

export const heavyOpen = () => getMeta(OPEN) === '1';
/** Ngành `id` đang tạm đóng (không thâu tóm, không chạy). */
export const industryClosed = (id) => !heavyOpen() && HEAVY_INDUSTRIES.includes(id);

/** Xem trước khi đóng: gia tộc nào nắm ngành nặng, bao nhiêu lô, hoàn bao nhiêu. */
export function heavyStatus() {
  const held = q.held.all(...HEAVY_INDUSTRIES);
  return {
    open: heavyOpen(),
    industries: HEAVY_INDUSTRIES.map((id) => ({ id, name: PRODUCTION_INDUSTRIES[id].name, icon: PRODUCTION_INDUSTRIES[id].icon })),
    holders: held.map((r) => ({ clanId: r.clan_id, clan: r.clan_name, industry: r.industry, fee: r.fee })),
    plots: q.plots.all(...HEAVY_INDUSTRIES).length,
    refund: held.reduce((s, r) => s + (r.fee ?? 0), 0),
  };
}

/** Đóng: hoàn phí, gỡ ngành, trả lô về chưa chọn ngành, báo tộc trưởng. Gọi trong transaction. */
export function closeHeavyIndustries(now = Date.now()) {
  const byClan = new Map();
  for (const r of q.held.all(...HEAVY_INDUSTRIES)) {
    if (r.fee > 0) post({ account: `clan:${r.clan_id}`, delta: r.fee, kind: 'clan_comp', memo: `Hoàn phí thâu tóm ${PRODUCTION_INDUSTRIES[r.industry].name} (tạm đóng công nghiệp nặng)`, now });
    q.drop.run(r.clan_id, r.industry);
    const e = byClan.get(r.clan_id) ?? { names: [], refund: 0, plots: 0 };
    e.names.push(PRODUCTION_INDUSTRIES[r.industry].name);
    e.refund += r.fee ?? 0;
    byClan.set(r.clan_id, e);
  }
  const plots = q.plots.all(...HEAVY_INDUSTRIES);
  for (const p of plots) {
    q.clearPlot.run(p.id);
    if (byClan.has(p.clan_id)) byClan.get(p.clan_id).plots += 1;
  }
  for (const [clanId, e] of byClan) {
    const to = q.leader.get(clanId)?.user_id;
    if (!to) continue;
    sendMail({
      to,
      fromName: 'Sở Kế hoạch',
      subject: 'Công nghiệp nặng tạm đóng',
      body: `Thị trấn tạm đóng các ngành công nghiệp nặng. Gia tộc được hoàn ${fmt(e.refund)} xu phí thâu tóm (${e.names.join(', ')}) vào quỹ.`
        + (e.plots ? `\n${e.plots} lô đất về trạng thái chưa chọn ngành, công trình vẫn giữ: hãy chọn ngành khác cho lô.` : ''),
      now,
    });
  }
  q.news.run('🏭 Sở Kế hoạch tạm đóng công nghiệp nặng (luyện kim, hóa dầu, điện tử, máy móc, phương tiện). Gia tộc đang nắm được hoàn phí thâu tóm.', now, now, now + 3 * DAY);
  return { clans: byClan.size, refund: [...byClan.values()].reduce((s, e) => s + e.refund, 0), plots: plots.length };
}

/** Quản trị viên mở lại hoặc đóng lại công nghiệp nặng. */
export function setHeavyOpen(open, actor = 'Quản trị viên', now = Date.now()) {
  return transaction(() => {
    if (open) {
      setMeta(OPEN, '1');
      q.news.run('🏭 Sở Kế hoạch mở lại công nghiệp nặng: gia tộc có thể thâu tóm luyện kim, hóa dầu, điện tử, máy móc, phương tiện.', now, now, now + 3 * DAY);
      adminLog(actor, 'heavy_industry_open', null, {});
      return { ...heavyStatus(), message: 'Đã mở lại công nghiệp nặng.' };
    }
    db.prepare('DELETE FROM meta WHERE key = ?').run(OPEN);
    const res = closeHeavyIndustries(now);
    adminLog(actor, 'heavy_industry_close', null, res);
    return { ...heavyStatus(), message: `Đã đóng công nghiệp nặng: hoàn ${fmt(res.refund)} xu cho ${res.clans} gia tộc, ${res.plots} lô về chưa chọn ngành.` };
  });
}
