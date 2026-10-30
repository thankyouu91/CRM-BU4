// Hạ tầng chiến lược và ngành nhà nước: Trị thủy, Năng lượng gió, Ngân hàng nhà nước, Thuế vụ.
// Gia tộc chủ xây hạ tầng (cấp 1–4) tạo buff +10–40% cho toàn server; người chơi và gia tộc hưởng buff trả phí
// hạ tầng = 20% phần tăng thêm cho gia tộc chủ, hết tiền trả thì không được buff. Năng lượng gió cộng thêm cho
// thành viên gia tộc chủ và cho pet huyền thoại đứng máy. Thuế vụ đi truy thu các gia tộc khai thiếu.
// Luật và số liệu ở public/ta-tua/game/js/shared/industry.js (STRATEGIC_*).
import { db, getPet, getUser, transaction } from './db.js';
import { dayKey } from './clock.js';
import { GameError } from './game.js';
import { post } from './ledger.js';
import { STRATEGIC_INDUSTRIES, STRATEGIC_RULES, combinedBuff } from '../../public/ta-tua/game/js/shared/industry.js';
import { PLOTS, designComplete } from '../../public/ta-tua/game/js/shared/clan.js';
import { speciesOrGuest } from '../../public/ta-tua/game/js/shared/pets.js';

const q = {
  holders: db.prepare(`
    SELECT c.id, c.name, c.emblem, c.color, COALESCE(i.level, 1) AS level FROM clan_industries ci
    JOIN clans c ON c.id = ci.clan_id AND c.dissolved_at IS NULL
    LEFT JOIN clan_infra i ON i.clan_id = c.id AND i.industry = ci.industry
    WHERE ci.industry = ? ORDER BY c.id`),
  operatingPlots: db.prepare('SELECT * FROM land_plots WHERE clan_id = ? AND industry = ?'),
  infra: db.prepare('SELECT * FROM clan_infra WHERE clan_id = ? AND industry = ?'),
  setInfra: db.prepare(`
    INSERT INTO clan_infra (clan_id, industry, level, since) VALUES (?, ?, ?, ?)
    ON CONFLICT (clan_id, industry) DO UPDATE SET level = excluded.level`),
  member: db.prepare('SELECT * FROM clan_members WHERE user_id = ?'),
  clan: db.prepare('SELECT * FROM clans WHERE id = ?'),
  clanIndustries: db.prepare('SELECT industry FROM clan_industries WHERE clan_id = ?'),
  operators: db.prepare('SELECT o.*, u.username FROM clan_operators o JOIN users u ON u.id = o.user_id WHERE o.clan_id = ?'),
  operatorOfPet: db.prepare('SELECT * FROM clan_operators WHERE pet_id = ?'),
  setOperator: db.prepare('INSERT OR REPLACE INTO clan_operators (plot_id, clan_id, user_id, pet_id, since) VALUES (?, ?, ?, ?, ?)'),
  removeOperator: db.prepare('DELETE FROM clan_operators WHERE plot_id = ?'),
  insertFee: db.prepare('INSERT INTO infra_fees (owner_clan_id, industry, payer_user_id, payer_clan_id, amount, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  feeIncome: db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM infra_fees WHERE owner_clan_id = ? AND day >= ?'),
  plot: db.prepare('SELECT * FROM land_plots WHERE id = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
};

const PLOT_BY_ID = new Map(PLOTS.map((p) => [p.id, p]));
const clanAccount = (id) => `clan:${id}`;
const clanBalance = (id) => q.account.get(clanAccount(id))?.balance ?? 0;
const levelBuff = (level) => STRATEGIC_RULES.levels[Math.min(STRATEGIC_RULES.levels.length, Math.max(1, level)) - 1].buff;

/** Gia tộc chủ đang vận hành ngành (có ít nhất một lô làm ngành này với công trình hoàn chỉnh). */
export function operatingOwners(industry) {
  return q.holders.all(industry).filter((c) => q.operatingPlots.all(c.id, industry).some((r) => designComplete(JSON.parse(r.design))))
    .map((c) => ({ ...c, buff: levelBuff(c.level) }));
}

/** Buff chung toàn server của một ngành chiến lược và phần chia phí cho từng gia tộc chủ. */
export function globalBuff(industry) {
  const owners = operatingOwners(industry);
  const sum = owners.reduce((s, o) => s + o.buff, 0);
  return { buff: Math.round(combinedBuff(owners.map((o) => o.buff)) * 1000) / 1000, owners: owners.map((o) => ({ ...o, share: sum ? o.buff / sum : 0 })) };
}

/** Thưởng của pet huyền thoại đứng máy ở trang trại gió của gia tộc (lấy pet tốt nhất). */
export function operatorBonus(clanId) {
  let best = 0;
  for (const o of q.operators.all(clanId)) {
    const plot = q.plot.get(o.plot_id);
    const pet = getPet(o.pet_id);
    if (!plot || plot.clan_id !== clanId || plot.industry !== 'wind_farm' || !pet || pet.owner_id !== o.user_id) continue;
    if (q.member.get(o.user_id)?.clan_id !== clanId) continue;
    const sp = speciesOrGuest(pet.species);
    if (sp.rarity !== 'huyenthoai') continue;
    best = Math.max(best, STRATEGIC_RULES.operatorBonus[sp.element] ?? 0);
  }
  return best;
}

const ownsIndustry = (clanId, industry) => Boolean(clanId) && operatingOwners(industry).some((o) => o.id === clanId);

/**
 * Buff một người chơi / gia tộc được hưởng: `paid` là phần chung (phải trả phí), `free` là phần riêng của gia tộc chủ
 * (thành viên +10% và pet đứng máy, chỉ với Năng lượng gió). Gia tộc chủ không trả phí cho chính mình.
 */
export function buffFor(industry, { userId = null, clanId = null } = {}) {
  const { buff } = globalBuff(industry);
  const myClan = clanId ?? (userId ? q.member.get(userId)?.clan_id : null);
  const owner = ownsIndustry(myClan, industry);
  let free = 0;
  if (owner && industry === 'wind_farm') free = STRATEGIC_RULES.ownerMemberBonus + operatorBonus(myClan);
  return { paid: owner ? 0 : buff, free: owner ? buff + free : 0, total: buff + free, owner };
}

/**
 * Thu phí hạ tầng `feeOn` × 20% từ người chơi (ví) hoặc gia tộc (quỹ), chia cho các gia tộc chủ theo phần đóng góp buff.
 * Trả về số phí đã thu, hoặc null nếu người trả không đủ tiền (khi đó nơi gọi không áp buff).
 */
export function chargeInfraFee(industry, feeOn, { userId = null, clanId = null, account = 'wallet', now = Date.now(), memo = '' } = {}) {
  const fee = Math.round(Math.max(0, feeOn) * STRATEGIC_RULES.fee);
  if (fee <= 0) return 0;
  const have = clanId ? clanBalance(clanId) : account === 'savings' ? db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?').get(userId)?.savings ?? 0 : getUser(userId).coins;
  if (have < fee) return null;
  const { owners } = globalBuff(industry);
  if (!owners.length) return 0;
  const name = STRATEGIC_INDUSTRIES[industry].name;
  if (clanId) post({ account: clanAccount(clanId), delta: -fee, kind: 'infra_fee', memo: `${name}${memo ? `: ${memo}` : ''}`, now });
  else post({ userId, account, delta: -fee, kind: 'infra_fee', memo: `${name}${memo ? `: ${memo}` : ''}`, now });
  let left = fee;
  owners.forEach((o, i) => {
    const part = i === owners.length - 1 ? left : Math.floor(fee * o.share);
    left -= part;
    if (part <= 0) return;
    post({ account: clanAccount(o.id), delta: part, kind: 'infra_fee', memo: `Phí ${name}`, now });
    q.insertFee.run(o.id, industry, userId, clanId, part, dayKey(now), now);
  });
  return fee;
}

// ---------------------------------------------------------------- móc vào các hệ thống có sẵn

/** Năng lượng gió: thưởng thu nhập mua bán cá nhân (Sàn Nguyên Liệu, Chợ Phiên). Phí trừ từ chính phần thưởng. */
export function windTradeBonus(userId, amount, memo, now = Date.now()) {
  if (!userId || amount <= 0) return 0;
  const b = buffFor('wind_farm', { userId });
  if (b.total <= 0) return 0;
  const bonus = Math.floor(amount * b.total);
  if (bonus <= 0) return 0;
  post({ userId, delta: bonus, kind: 'infra_bonus', memo: `Năng lượng gió +${Math.round(b.total * 100)}%: ${memo}`, now });
  if (b.paid > 0) chargeInfraFee('wind_farm', amount * b.paid, { userId, now, memo });
  return bonus;
}

/** Ngân hàng nhà nước: thưởng lãi tiết kiệm/kỳ hạn. Phí trừ từ chính phần thưởng (cùng tài khoản nhận lãi). */
export function bankInterestBonus(userId, interest, { account = 'wallet', memo = 'Lãi', now = Date.now() } = {}) {
  if (!userId || interest <= 0) return 0;
  const b = buffFor('state_bank', { userId });
  const bonus = Math.floor(interest * b.total);
  if (bonus <= 0) return 0;
  // Thu phí trước: không đủ tiền trả phí thì không có phần lãi thêm (trước đây cộng lãi rồi mới thu, thu hụt vẫn giữ lãi).
  if (b.paid > 0 && chargeInfraFee('state_bank', interest * b.paid, { userId, account, now, memo }) === null) return 0;
  post({ userId, account, delta: bonus, kind: 'infra_bonus', memo: `Ngân hàng nhà nước +${Math.round(b.total * 100)}%: ${memo}`, now });
  return bonus;
}

/**
 * Trị thủy cho vụ thu hoạch vườn: trả về số phần thêm và phí đã thu. Người chơi không đủ tiền trả phí thì không có phần thêm.
 * `unitValue`: giá một phần nông sản theo giá Sàn hiện tại.
 */
export function irrigationHarvest(userId, qty, unitValue, now = Date.now()) {
  const b = buffFor('irrigation', { userId });
  if (b.total <= 0) return { extra: 0, fee: 0 };
  const extra = Math.round(qty * b.total);
  if (extra <= 0) return { extra: 0, fee: 0 };
  if (b.paid > 0) {
    const fee = chargeInfraFee('irrigation', Math.round(qty * b.paid) * unitValue, { userId, now, memo: 'thu hoạch vườn' });
    if (fee === null) return { extra: 0, fee: 0, unpaid: true };
    return { extra, fee };
  }
  return { extra, fee: 0 };
}

// ---------------------------------------------------------------- thao tác của gia tộc chủ

function mustClan(userId, roles) {
  const m = q.member.get(userId);
  const clan = m && q.clan.get(m.clan_id);
  if (!clan || clan.dissolved_at) throw new GameError('Bạn chưa ở gia tộc nào.');
  if (roles && !roles.includes(m.role)) throw new GameError('Chỉ tộc trưởng mới được làm việc này.');
  return { clan, member: m };
}

export function strategicOf(clanId) {
  return q.clanIndustries.all(clanId).map((r) => r.industry).find((i) => STRATEGIC_INDUSTRIES[i]) ?? null;
}

/** Nâng cấp hạ tầng (tối đa cấp 4), trả bằng quỹ gia tộc. */
export function upgradeInfra(userId, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustClan(userId, ['leader']);
    const industry = strategicOf(clan.id);
    if (!industry) throw new GameError('Gia tộc chưa nắm ngành chiến lược nào.');
    const level = q.infra.get(clan.id, industry)?.level ?? 1;
    const next = STRATEGIC_RULES.levels[level];
    if (!next) throw new GameError('Hạ tầng đã ở cấp cao nhất.');
    if (clanBalance(clan.id) < next.cost) throw new GameError(`Quỹ gia tộc không đủ ${next.cost.toLocaleString('vi-VN')} xu.`);
    post({ account: clanAccount(clan.id), delta: -next.cost, kind: 'clan_build', memo: `Nâng ${STRATEGIC_INDUSTRIES[industry].name} lên cấp ${level + 1}`, now });
    q.setInfra.run(clan.id, industry, level + 1, now);
    return { message: `${STRATEGIC_INDUSTRIES[industry].icon} ${STRATEGIC_INDUSTRIES[industry].name} lên cấp ${level + 1}: buff +${Math.round(next.buff * 100)}%.` };
  });
}

/** Thành viên cho một bé của mình đứng máy ở trang trại gió của gia tộc (mỗi lô một bé). */
export function assignOperator(userId, plotId, petId, now = Date.now()) {
  return transaction(() => {
    const { clan } = mustClan(userId);
    const plot = q.plot.get(Number(plotId));
    if (!plot || plot.clan_id !== clan.id || plot.industry !== 'wind_farm') throw new GameError('Lô này không phải trang trại gió của gia tộc.');
    const pet = getPet(Number(petId));
    if (!pet || pet.owner_id !== userId) throw new GameError('Không tìm thấy bé này.');
    const other = q.operatorOfPet.get(pet.id);
    if (other && other.plot_id !== plot.id) q.removeOperator.run(other.plot_id);
    q.setOperator.run(plot.id, clan.id, userId, pet.id, now);
    const sp = speciesOrGuest(pet.species);
    const bonus = sp.rarity === 'huyenthoai' ? STRATEGIC_RULES.operatorBonus[sp.element] ?? 0 : 0;
    return { message: bonus ? `${pet.name} (huyền thoại) đứng máy: Năng lượng gió của gia tộc thêm +${Math.round(bonus * 100)}%.` : `${pet.name} đứng máy. Chỉ bé huyền thoại mới cộng thêm buff.` };
  });
}

export function removeOperator(userId, plotId) {
  return transaction(() => {
    const { clan, member } = mustClan(userId);
    const op = q.operators.all(clan.id).find((o) => o.plot_id === Number(plotId));
    if (!op) throw new GameError('Lô này chưa có bé đứng máy.');
    if (op.user_id !== userId && member.role !== 'leader') throw new GameError('Chỉ chủ bé hoặc tộc trưởng mới cho bé nghỉ.');
    q.removeOperator.run(op.plot_id);
    return { message: 'Bé đã nghỉ đứng máy.' };
  });
}

/** Toàn cảnh hạ tầng chiến lược cho màn hình gia tộc. */
export function strategicView(userId, now = Date.now()) {
  const m = q.member.get(userId);
  const clanId = m?.clan_id ?? null;
  const week = dayKey(now - 6 * 86_400_000);
  const industries = Object.fromEntries(Object.keys(STRATEGIC_INDUSTRIES).map((id) => {
    const g = globalBuff(id);
    const b = buffFor(id, { userId });
    return [id, {
      buff: g.buff,
      owners: g.owners.map((o) => ({ id: o.id, name: o.name, emblem: o.emblem, color: o.color, level: o.level })),
      holders: q.holders.all(id).length,
      mine: b,
    }];
  }));
  const industry = clanId ? strategicOf(clanId) : null;
  let mine = null;
  if (industry) {
    const level = q.infra.get(clanId, industry)?.level ?? 1;
    mine = {
      industry,
      level,
      next: STRATEGIC_RULES.levels[level] ?? null,
      operating: ownsIndustry(clanId, industry),
      feeWeek: q.feeIncome.get(clanId, week).total,
      operators: industry === 'wind_farm' ? q.operators.all(clanId).map((o) => {
        const pet = getPet(o.pet_id);
        const sp = pet ? speciesOrGuest(pet.species) : null;
        return { plotId: o.plot_id, code: PLOT_BY_ID.get(o.plot_id)?.code, userId: o.user_id, username: o.username, petId: o.pet_id, petName: pet?.name, legendary: sp?.rarity === 'huyenthoai', element: sp?.element };
      }) : [],
      operatorBonus: industry === 'wind_farm' ? operatorBonus(clanId) : 0,
    };
  }
  return { industries, mine, rules: STRATEGIC_RULES };
}
