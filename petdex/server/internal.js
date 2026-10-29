// API nội bộ cho WorkHub: đăng nhập một lần cho nhân viên, vào chơi bằng link khách, và bảng quản trị.
// Không bao giờ được mở ra ngoài: Worker chỉ chuyển /ta-tua/api và /ta-tua/ws vào Durable Object,
// còn /internal chỉ gọi được qua stub từ chính ứng dụng (máy chủ dev Node đòi khóa nội bộ).
import { economy } from './bank.js';
import * as store from './db.js';
import { GameError, RULES, clamp } from './game.js';
import { KINDS, post, treasuryBalance } from './ledger.js';
import { parkUsers } from './playground.js';
import { Router } from './router.js';
import { SKILLS } from './rules/careers.js';
import { createPet } from './eggs.js';
import { slotsOf } from './lifecycle.js';
import { bus, snapshot } from './service.js';
import { getSpecies, listSpecies } from './species.js';
import { ledgerPage, netWorth, richList } from './wallet.js';

export const internalApi = Router();

const NAME_MAX = 20;

/** Tên hiển thị tự do; tên đăng nhập trong game phải khớp luật của game (chữ, số, _; 3–20 ký tự) và duy nhất. */
export function usernameFrom(name) {
  let base = String(name ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]/gu, '')
    .slice(0, NAME_MAX);
  if (base.length < 3) base = `${base}_${'bé'}`.slice(0, NAME_MAX);
  let candidate = base;
  for (let n = 2; store.findUserByName(candidate); n++) {
    const suffix = `_${n}`;
    candidate = base.slice(0, NAME_MAX - suffix.length) + suffix;
  }
  return candidate;
}

function cleanName(raw, { clip = false } = {}) {
  let name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  // Tên từ WorkHub đã được kiểm tra ở đó; chỉ cắt cho vừa thay vì từ chối.
  if (clip) name = [...name].slice(0, 40).join('').trim();
  if (name.length < 2 || name.length > 40) throw new GameError('Tên dài 2–40 ký tự.');
  return name;
}

const actorOf = (req) => String(req.body?.actor ?? req.get('x-actor') ?? 'WorkHub').slice(0, 80);

function userOf(req) {
  const id = Number(req.params.id);
  const user = Number.isInteger(id) ? store.getUser(id) : null;
  if (!user) throw new GameError('Không có người chơi này.');
  return user;
}

export function inviteUsable(invite, now = Date.now()) {
  return Boolean(invite) && !invite.revoked_at && (!invite.expires_at || invite.expires_at > now) && (invite.max_uses == null || invite.uses < invite.max_uses);
}

function playerRow(u, now = Date.now()) {
  const pets = store.listPets(u.id);
  const worth = netWorth(u.id, now);
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name ?? u.username,
    kind: u.kind,
    coins: u.coins,
    savings: worth.parts.savings + worth.parts.deposits,
    netWorth: worth.total,
    pets: pets.length,
    topLevel: pets.reduce((m, p) => Math.max(m, p.level), 0),
    credit: u.credit,
    banned: Boolean(u.banned),
    online: parkUsers.has(u.id),
    createdAt: u.created_at,
    lastSeenAt: u.last_seen_at,
    inviteId: u.invite_id,
    crmUserId: u.crm_user_id,
  };
}

internalApi.get('/health', (_req, res) => res.json({ ok: true, now: Date.now() }));

// ---- Đăng nhập một lần cho tài khoản WorkHub ----
internalApi.post('/sso', (req, res) => {
  const crmUserId = String(req.body?.crmUserId ?? '').trim();
  if (!crmUserId) throw new GameError('Thiếu mã người dùng.');
  const name = cleanName(req.body?.name, { clip: true });
  const result = store.transaction(() => {
    let user = store.userByCrm(crmUserId);
    if (!user) {
      const id = store.createLinkedUser(usernameFrom(name), { kind: 'member', crmUserId, displayName: name });
      post({ userId: id, delta: RULES.startCoins, kind: 'opening', memo: 'Quà chào mừng' });
      user = store.getUser(id);
    } else if (user.display_name !== name) {
      store.setDisplayName(user.id, name);
    }
    if (user.banned) throw new GameError('Tài khoản chơi của bạn đã bị quản trị viên khóa.');
    return { token: store.recentToken(user.id) ?? store.issueToken(user.id), userId: user.id, username: user.username, created: !user.last_seen_at };
  });
  res.json(result);
});

// ---- Khách mời: link có mã, chỉ cần điền tên ----
internalApi.get('/invites/:code', (req, res) => {
  const invite = store.inviteByCode(req.params.code);
  res.json({ valid: inviteUsable(invite), label: invite?.label ?? null });
});

internalApi.post('/guest', (req, res) => {
  const invite = store.inviteByCode(req.body?.code);
  if (!inviteUsable(invite)) throw new GameError('Link mời này không còn hiệu lực.');
  const name = cleanName(req.body?.name);
  const result = store.transaction(() => {
    const id = store.createLinkedUser(usernameFrom(name), { kind: 'guest', displayName: name, inviteId: invite.id });
    post({ userId: id, delta: RULES.startCoins, kind: 'opening', memo: 'Quà chào mừng' });
    store.useInvite(invite.id);
    return { token: store.issueToken(id), userId: id, username: store.getUser(id).username };
  });
  res.json(result);
});

/** Khách quay lại với token cũ: còn hợp lệ thì dùng tiếp, không thì điền tên lại. */
internalApi.post('/guest/resume', (req, res) => {
  const user = store.userForToken(req.body?.token);
  if (!user || user.banned || user.kind !== 'guest') return res.json({ ok: false });
  res.json({ ok: true, username: user.username, displayName: user.display_name });
});

// ---- Bảng quản trị ----
internalApi.get('/admin/overview', (_req, res) => {
  const now = Date.now();
  const overview = store.usersOverview(now);
  const names = new Map(store.allUsers().map((u) => [u.id, u.display_name ?? u.username]));
  res.json({
    ...overview,
    treasury: treasuryBalance(),
    economy: economy(),
    online: parkUsers.size,
    rich: richList(10, now).map((r) => ({ ...r, displayName: names.get(r.userId) ?? r.username })),
    kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.label])),
  });
});

internalApi.get('/admin/players', (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 40);
  const kind = ['member', 'guest', 'player'].includes(req.query.kind) ? req.query.kind : '';
  res.json({ players: store.searchUsers(q, kind).map((u) => playerRow(u)) });
});

internalApi.get('/admin/players/:id', (req, res) => {
  const user = userOf(req);
  const snap = snapshot(user.id);
  res.json({
    player: playerRow(user),
    pets: snap.pets,
    inventory: snap.inventory,
    netWorth: netWorth(user.id),
    ledger: ledgerPage(user.id, { limit: 30 }),
    invite: user.invite_id ? store.inviteById(user.invite_id) : null,
    skills: SKILLS,
    maxLevel: RULES.maxLevel ?? 100,
    slots: slotsOf(user.id),
    // Số trừ được ngay: ví + tài khoản tiết kiệm (không gồm tiền gửi kỳ hạn).
    spendable: { wallet: user.coins, savings: savingsOf(user.id) },
    // Mọi loài, kể cả loài hiếm chỉ nở từ trứng: quản trị viên tặng được bất kỳ loài nào.
    species: listSpecies().map((s) => ({ id: s.id, name: s.name, element: s.element, rarity: s.rarity })),
  });
});

internalApi.post('/admin/players/:id/pets', (req, res) => {
  const user = userOf(req);
  const species = getSpecies(String(req.body?.species ?? ''));
  if (!species) throw new GameError('Không có loài này.');
  const name = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim() || species.name;
  if (name.length > 16) throw new GameError('Tên thú cưng dài 1–16 ký tự.');
  const actor = actorOf(req);
  const pet = store.transaction(() => {
    if (slotsOf(user.id).free <= 0) throw new GameError(`Người chơi đã hết ô nuôi (tối đa ${RULES.maxPets}, tính cả trứng đang ấp và ô tưởng niệm).`);
    const { petId } = createPet(user.id, name, species.id);
    store.adminLog(actor, 'pet_grant', user.id, { petId, petName: name, species: species.id, speciesName: species.name, rarity: species.rarity });
    return { id: petId, name, species: species.id };
  });
  bus.emit('pet:changed', user.id);
  res.json({ ok: true, pet });
});

const savingsOf = (userId) => Number(store.db.prepare('SELECT savings FROM bank_accounts WHERE user_id = ?').get(userId)?.savings ?? 0);
const vnd = (n) => n.toLocaleString('vi-VN');

/**
 * Cộng hoặc trừ xu. Trừ thì lấy ví trước, thiếu thì lấy tiếp từ tài khoản tiết kiệm (không đụng tiền gửi
 * kỳ hạn). Không đủ cả hai thì báo số tối đa trừ được; gửi `clamp: true` để trừ hết số đang có.
 */
internalApi.post('/admin/players/:id/coins', (req, res) => {
  const user = userOf(req);
  const delta = Number(req.body?.delta);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000_000) throw new GameError('Số xu phải là số nguyên khác 0.');
  const memo = String(req.body?.memo ?? '').trim().slice(0, 120) || (delta > 0 ? 'Quản trị viên cộng xu' : 'Quản trị viên trừ xu');
  const actor = actorOf(req);
  const clamp = Boolean(req.body?.clamp);
  const result = store.transaction(() => {
    const note = `${memo} (${actor})`;
    if (delta > 0) {
      const coins = post({ userId: user.id, delta, kind: 'admin', memo: note });
      store.adminLog(actor, 'coins', user.id, { delta, memo, balance: coins });
      return { coins, savings: savingsOf(user.id), delta, fromWallet: delta, fromSavings: 0 };
    }
    const wallet = store.getUser(user.id).coins;
    const savings = savingsOf(user.id);
    const available = wallet + savings;
    let want = -delta;
    if (want > available) {
      if (!clamp || available <= 0) {
        throw new GameError(`Không đủ xu: ví có ${vnd(wallet)}${savings ? `, tiết kiệm ${vnd(savings)}` : ''} xu, tối đa trừ được ${vnd(available)} xu.`);
      }
      want = available;
    }
    const fromWallet = Math.min(wallet, want);
    const fromSavings = want - fromWallet;
    if (fromWallet) post({ userId: user.id, delta: -fromWallet, kind: 'admin', memo: note });
    if (fromSavings) post({ userId: user.id, account: 'savings', delta: -fromSavings, kind: 'admin', memo: note });
    const coins = store.getUser(user.id).coins;
    store.adminLog(actor, 'coins', user.id, { delta: -want, requested: delta, memo, balance: coins, fromSavings });
    return { coins, savings: savingsOf(user.id), delta: -want, fromWallet, fromSavings };
  });
  res.json({ ok: true, ...result });
});

const PET_STATS = ['fullness', 'happiness', 'energy', 'hygiene', 'health'];

internalApi.post('/admin/players/:id/pets/:petId', (req, res) => {
  const user = userOf(req);
  const pet = store.getPet(Number(req.params.petId));
  if (!pet || pet.owner_id !== user.id) throw new GameError('Bé này không thuộc người chơi.');
  const body = req.body ?? {};
  const changes = {};
  for (const key of PET_STATS) {
    if (body[key] === undefined) continue;
    const v = Number(body[key]);
    if (!Number.isFinite(v)) throw new GameError(`Chỉ số ${key} không hợp lệ.`);
    changes[key] = clamp(v, 0, 100);
  }
  if (body.level !== undefined) {
    const level = Number(body.level);
    if (!Number.isInteger(level) || level < 1 || level > (RULES.maxLevel ?? 100)) throw new GameError('Cấp không hợp lệ.');
    changes.level = level;
  }
  if (body.xp !== undefined) {
    const xp = Number(body.xp);
    if (!Number.isInteger(xp) || xp < 0) throw new GameError('XP không hợp lệ.');
    changes.xp = xp;
  }
  if (body.sick === null) changes.sick = null;
  const skills = {};
  for (const [skill, raw] of Object.entries(body.skills ?? {})) {
    if (!SKILLS[skill]) throw new GameError('Không có kỹ năng này.');
    const v = Number(raw);
    if (!Number.isFinite(v)) throw new GameError('Kỹ năng không hợp lệ.');
    skills[skill] = Math.round(clamp(v, 0, 100) * 10) / 10;
  }
  if (!Object.keys(changes).length && !Object.keys(skills).length) throw new GameError('Không có gì để sửa.');
  const actor = actorOf(req);
  store.transaction(() => {
    if (Object.keys(changes).length) store.savePet({ ...pet, ...changes, updated_at: Date.now() });
    for (const [skill, value] of Object.entries(skills)) store.setSkill(pet.id, skill, value);
    store.adminLog(actor, 'pet', user.id, { petId: pet.id, petName: pet.name, changes, skills });
  });
  bus.emit('pet:changed', user.id);
  res.json({ ok: true });
});

internalApi.post('/admin/players/:id/status', (req, res) => {
  const user = userOf(req);
  const banned = Boolean(req.body?.banned);
  store.transaction(() => {
    store.setBanned(user.id, banned);
    store.adminLog(actorOf(req), banned ? 'ban' : 'unban', user.id, null);
  });
  res.json({ ok: true, banned });
});

internalApi.post('/admin/players/:id/name', (req, res) => {
  const user = userOf(req);
  const name = cleanName(req.body?.displayName);
  store.transaction(() => {
    store.setDisplayName(user.id, name);
    store.adminLog(actorOf(req), 'rename', user.id, { from: user.display_name, to: name });
  });
  res.json({ ok: true });
});

internalApi.get('/admin/invites', (_req, res) => res.json({ invites: store.listInvites().map((i) => ({ ...i, usable: inviteUsable(i) })) }));

internalApi.post('/admin/invites', (req, res) => {
  const label = String(req.body?.label ?? '').trim().slice(0, 60) || 'Khách mời';
  const maxUses = req.body?.maxUses == null || req.body.maxUses === '' ? null : Number(req.body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000)) throw new GameError('Số lượt dùng không hợp lệ.');
  const expiresAt = req.body?.expiresAt == null || req.body.expiresAt === '' ? null : Number(req.body.expiresAt);
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) throw new GameError('Hạn dùng phải ở tương lai.');
  const actor = actorOf(req);
  const invite = store.transaction(() => {
    const created = store.createInvite({ label, maxUses, expiresAt, createdBy: actor });
    store.adminLog(actor, 'invite', null, { id: created.id, label, maxUses, expiresAt });
    return created;
  });
  res.json({ invite: { ...invite, usable: true, guests: 0 } });
});

internalApi.post('/admin/invites/:id/revoke', (req, res) => {
  const id = Number(req.params.id);
  const done = store.transaction(() => {
    const ok = store.revokeInvite(id);
    if (ok) store.adminLog(actorOf(req), 'invite_revoke', null, { id });
    return ok;
  });
  if (!done) throw new GameError('Link này đã thu hồi hoặc không tồn tại.');
  res.json({ ok: true });
});

internalApi.get('/admin/log', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json({ log: store.adminLogs(limit) });
});

internalApi.use('/{*rest}', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));

internalApi.use((err, _req, res, _next) => {
  if (err instanceof GameError) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Máy chủ game gặp sự cố.' });
});
