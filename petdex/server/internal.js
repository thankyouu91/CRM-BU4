// API nội bộ cho WorkHub: đăng nhập một lần cho nhân viên, vào chơi bằng link khách, và bảng quản trị.
// Không bao giờ được mở ra ngoài: Worker chỉ chuyển /ta-tua/api và /ta-tua/ws vào Durable Object,
// còn /internal chỉ gọi được qua stub từ chính ứng dụng (máy chủ dev Node đòi khóa nội bộ).
import { economy } from './bank.js';
import * as store from './db.js';
import { digest, hashPassword, randomCode, verifyPassword } from './passwords.js';
import { adminChat, adminDeleteMessage, adminMail, muteUser } from './chat.js';
import { heavyStatus, setHeavyOpen } from './heavy-industry.js';
import { mergeDone, remergeIndustries, unmergeIndustries, unmergePlan } from './industry-merge.js';
import { createGear, createRandomGear, deleteGear, describeGear, gearConfig, getGear, listGear, setGearConfig, updateGear } from './gear.js';
import { ANNOUNCEMENT, announcementById, createAnnouncement, listAnnouncements, removeAnnouncement } from './announcements.js';
import { GIFT_CATEGORIES, createGiftCode, giftCodeById, giftRedemptions, giftView, listGiftCodes, revokeGiftCode } from './gifts.js';
import { AFFIXES, DEFAULT_GEAR_CONFIG, TIERS } from '../../public/ta-tua/game/js/shared/gear.js';
import { GameError, ITEMS, RULES, clamp } from './game.js';
import { KINDS, post, treasuryBalance } from './ledger.js';
import { parkUsers } from './playground.js';
import { Router } from './router.js';
import { SKILLS } from './rules/careers.js';
import { createPet } from './eggs.js';
import { adminClanView, resolveEvasion, setClanConfig, setPlotOverride } from './clans.js';
import { dayKey } from './clock.js';
import { macroToday, overrideMacro } from './macro.js';
import { commerceView } from './commerce.js';
import { adminArenaView, adminCancelWar } from './arena.js';
import { adminBotsView, setBotConfig } from './bots.js';
import { adminClanBankView, setClanBankFrozen } from './clan-bank.js';
import { refPrice } from './industry.js';
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
  for (let n = 2; store.findUserByName(candidate) || store.findUserByLogin(candidate); n++) {
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

/** Không tặng xu, thú cưng hay trang phục cho cư dân tự động: bot chỉ có những gì tự chơi được. */
function noGrantToBot(user) {
  if (user.is_bot) throw new GameError('Không tặng cho cư dân tự động.');
}

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
    savings: worth.parts.savings + worth.parts.deposits + worth.parts.clanBank,
    netWorth: worth.total,
    pets: pets.length,
    topLevel: pets.reduce((m, p) => Math.max(m, p.level), 0),
    credit: u.credit,
    banned: Boolean(u.banned),
    online: parkUsers.has(u.id),
    createdAt: u.created_at,
    lastSeenAt: u.last_seen_at,
    inviteId: u.invite_id,
    hasPassword: Boolean(u.pass_hash),
    crmUserId: u.crm_user_id,
    // Chỉ bảng quản trị thấy cờ này.
    isBot: Boolean(u.is_bot),
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

/** Quay lại với token trình duyệt đã giữ (khách mời hoặc tài khoản tên + mật khẩu): còn hợp lệ thì dùng tiếp. */
internalApi.post('/guest/resume', (req, res) => {
  const user = store.userForToken(req.body?.token);
  if (!user || user.banned) return res.json({ ok: false });
  res.json({ ok: true, ...accountOf(user) });
});

// ---- Tài khoản tên + mật khẩu (play.petfarm.online): tự đăng ký, lần sau đăng nhập thẳng ----
const accountOf = (u) => ({ userId: u.id, username: u.username, displayName: u.display_name ?? u.username, kind: u.kind, hasPassword: Boolean(u.pass_hash) });

function loginName(raw) {
  const name = String(raw ?? '').normalize('NFC').trim();
  if (!/^[\p{L}\p{N}_]{3,20}$/u.test(name)) throw new GameError('Tên đăng nhập 3–20 ký tự, chỉ gồm chữ, số và dấu _ (không dấu cách).');
  return name;
}

function newPassword(raw) {
  const password = String(raw ?? '');
  if (password.length < 6) throw new GameError('Mật khẩu cần ít nhất 6 ký tự.');
  if (password.length > 72) throw new GameError('Mật khẩu tối đa 72 ký tự.');
  return password;
}

/** Tên đã có người dùng (so cả "Đức" với "đức"), trừ chính người `exceptId`. */
const nameTaken = (username, exceptId = null) =>
  [store.findUserByName(username), store.findUserByLogin(username)].some((u) => u && u.id !== exceptId);

internalApi.post('/account/register', (req, res) => {
  const username = loginName(req.body?.username);
  const password = newPassword(req.body?.password);
  const result = store.transaction(() => {
    if (nameTaken(username)) throw new GameError('Tên này đã có người dùng, chọn tên khác nhé.');
    const id = store.createUser(username, hashPassword(password));
    store.setDisplayName(id, username);
    post({ userId: id, delta: RULES.startCoins, kind: 'opening', memo: 'Quà chào mừng' });
    return { token: store.issueToken(id), ...accountOf(store.getUser(id)) };
  });
  res.json(result);
});

internalApi.post('/account/login', (req, res) => {
  const user = store.findUserByLogin(req.body?.username);
  // Tên có từ trước nhưng chưa có mật khẩu: trang đăng nhập đưa ra cách tạo (không nói gì thêm về tài khoản).
  if (user && !user.pass_hash && !user.banned) {
    return res.status(409).json({ error: 'Tài khoản này chưa có mật khẩu.', reason: 'no_password' });
  }
  if (!user || !verifyPassword(String(req.body?.password ?? ''), user.pass_hash)) throw new GameError('Sai tên đăng nhập hoặc mật khẩu.');
  if (user.banned) throw new GameError('Tài khoản chơi của bạn đã bị quản trị viên khóa.');
  res.json({ token: store.issueToken(user.id), ...accountOf(user) });
});

/**
 * Người chơi cũ (vào bằng WorkHub hoặc link mời) đặt tên đăng nhập + mật khẩu lần đầu. Tài khoản đã
 * có mật khẩu thì phải nhập đúng mật khẩu hiện tại mới đổi được, và mọi phiên khác bị đăng xuất.
 */
internalApi.post('/account/credentials', (req, res) => {
  const token = req.body?.token;
  const user = store.userForToken(token);
  if (!user || user.banned) throw new GameError('Phiên chơi đã hết hạn, mở lại trang nhé.');
  if (user.pass_hash && !verifyPassword(String(req.body?.currentPassword ?? ''), user.pass_hash)) {
    throw new GameError('Mật khẩu hiện tại chưa đúng.');
  }
  const username = loginName(req.body?.username);
  const password = newPassword(req.body?.password);
  const result = store.transaction(() => {
    if (nameTaken(username, user.id)) throw new GameError('Tên này đã có người dùng, chọn tên khác nhé.');
    store.setCredentials(user.id, username, hashPassword(password));
    if (user.pass_hash) store.revokeOtherSessions(user.id, token);
    return accountOf(store.getUser(user.id));
  });
  res.json(result);
});

/**
 * Tạo mật khẩu cho tài khoản cũ chưa có mật khẩu, khi trình duyệt này vẫn giữ phiên chơi của chính
 * tài khoản đó (`tokens`: các token trình duyệt còn lưu). Biết tên thôi thì không đủ.
 */
internalApi.post('/account/claim', (req, res) => {
  const user = store.findUserByLogin(req.body?.username);
  const tokens = (Array.isArray(req.body?.tokens) ? req.body.tokens : []).filter((t) => typeof t === 'string').slice(0, 5);
  const owns = Boolean(user) && tokens.some((t) => store.userForToken(t)?.id === user.id);
  if (!owns || user.pass_hash || user.banned) {
    return res.status(409).json({ error: 'Trình duyệt này không xác nhận được tài khoản. Nhờ quản trị viên gửi link đặt mật khẩu cho bạn.', reason: 'no_proof' });
  }
  const password = newPassword(req.body?.password);
  const result = store.transaction(() => {
    store.setCredentials(user.id, user.username, hashPassword(password));
    return { token: store.issueToken(user.id), ...accountOf(store.getUser(user.id)) };
  });
  res.json(result);
});

// ---- Link đặt mật khẩu do quản trị viên tạo (dùng một lần, 24 giờ) ----
const PASSWORD_LINK_TTL = 24 * 3_600_000;

/** Link còn dùng được: tài khoản của nó (chưa bị khóa), hoặc null. */
function passwordLinkUser(code) {
  const link = typeof code === 'string' && /^[a-f0-9]{32}$/.test(code) ? store.livePasswordLink(digest(code)) : undefined;
  const user = link ? store.getUser(link.user_id) : null;
  return user && !user.banned ? { link, user } : null;
}

internalApi.get('/password-links/:code', (req, res) => {
  const found = passwordLinkUser(req.params.code);
  if (!found) return res.json({ valid: false });
  const { link, user } = found;
  res.json({ valid: true, username: user.username, displayName: user.display_name ?? user.username, hasPassword: Boolean(user.pass_hash), expiresAt: link.expires_at });
});

/** Mở link: đặt tên đăng nhập + mật khẩu, đăng nhập luôn; mọi phiên cũ của tài khoản bị đăng xuất. */
internalApi.post('/account/setup', (req, res) => {
  const found = passwordLinkUser(req.body?.code);
  if (!found) throw new GameError('Link đặt mật khẩu không còn hiệu lực. Nhờ quản trị viên tạo link mới.');
  const { user } = found;
  const username = loginName(req.body?.username);
  const password = newPassword(req.body?.password);
  const result = store.transaction(() => {
    if (nameTaken(username, user.id)) throw new GameError('Tên này đã có người dùng, chọn tên khác nhé.');
    if (!store.usePasswordLink(digest(req.body.code))) throw new GameError('Link đặt mật khẩu không còn hiệu lực. Nhờ quản trị viên tạo link mới.');
    store.setCredentials(user.id, username, hashPassword(password));
    store.revokeSessions(user.id);
    store.adminLog(user.display_name ?? user.username, 'password_set', user.id, { via: 'link' });
    return { token: store.issueToken(user.id), ...accountOf(store.getUser(user.id)) };
  });
  res.json(result);
});

// ---- Trang phục có cấp và mã quà (bảng quản lý) ----

/** Cấu hình quay đồ và tỷ lệ rớt trong mini-game. */
internalApi.get('/admin/gear-config', (_req, res) => {
  res.json({ config: gearConfig(), defaults: DEFAULT_GEAR_CONFIG, tiers: TIERS, affixes: AFFIXES });
});
internalApi.post('/admin/gear-config', (req, res) => {
  const actor = actorOf(req);
  const config = store.transaction(() => {
    const next = setGearConfig(req.body?.config ?? {});
    store.adminLog(actor, 'gear_config', null, next);
    return next;
  });
  res.json({ ok: true, config });
});

/** Tặng một món trang phục: món (hoặc ngẫu nhiên), cấp (hoặc quay), dòng chỉ số tự nhập (hoặc quay). */
internalApi.post('/admin/players/:id/gear', (req, res) => {
  const user = userOf(req);
  noGrantToBot(user);
  const itemId = req.body?.itemId && req.body.itemId !== 'random' ? String(req.body.itemId) : null;
  const tier = req.body?.tier && req.body.tier !== 'random' ? String(req.body.tier) : null;
  const affixes = req.body?.affixes && Object.keys(req.body.affixes).length ? req.body.affixes : null;
  if (affixes && !tier) throw new GameError('Tự nhập dòng chỉ số thì chọn luôn cấp.');
  const actor = actorOf(req);
  const gear = store.transaction(() => {
    const made = itemId ? createGear(user.id, itemId, { tier, affixes, source: 'admin' }) : createRandomGear(user.id, { tier, source: 'admin' });
    const view = describeGear(made);
    store.adminLog(actor, 'gear_grant', user.id, { gearId: made.id, item: view.name, tier: made.tier, affixes: made.affixes });
    return view;
  });
  bus.emit('pet:changed', user.id);
  res.json({ ok: true, gear });
});

/** Sửa cấp và dòng chỉ số một món của người chơi. */
internalApi.post('/admin/gear/:gearId', (req, res) => {
  const before = getGear(req.params.gearId);
  if (!before) throw new GameError('Không có món này.');
  const actor = actorOf(req);
  const gear = store.transaction(() => {
    const after = updateGear(before.id, { tier: String(req.body?.tier ?? ''), affixes: req.body?.affixes });
    store.adminLog(actor, 'gear_edit', before.owner_id, { gearId: before.id, item: before.item_id, from: { tier: before.tier, affixes: before.affixes }, to: { tier: after.tier, affixes: after.affixes } });
    return describeGear(after, { reveal: true });
  });
  bus.emit('pet:changed', before.owner_id);
  res.json({ ok: true, gear });
});

internalApi.post('/admin/gear/:gearId/delete', (req, res) => {
  const g = getGear(req.params.gearId);
  if (!g) throw new GameError('Không có món này.');
  if (g.listed) throw new GameError('Món này đang bày bán ở Chợ Phiên, chờ tin hết hạn hoặc người chơi gỡ tin.');
  const actor = actorOf(req);
  store.transaction(() => {
    deleteGear(g.id);
    store.adminLog(actor, 'gear_delete', g.owner_id, { gearId: g.id, item: g.item_id, tier: g.tier, affixes: g.affixes });
  });
  bus.emit('pet:changed', g.owner_id);
  res.json({ ok: true });
});

internalApi.get('/admin/gift-codes', (_req, res) => {
  res.json({
    codes: listGiftCodes(),
    // phần quà chọn được: vật phẩm thường (trang phục tặng theo cấp ở mục riêng)
    items: Object.values(ITEMS).filter((i) => i.type !== 'accessory').map((i) => ({ id: i.id, name: i.name, icon: i.icon ?? '', type: i.type, element: i.element ?? null })),
    wearables: Object.values(ITEMS).filter((i) => i.type === 'accessory').map((i) => ({ id: i.id, name: i.name, slot: i.slot, element: i.element ?? null })),
    categories: GIFT_CATEGORIES,
  });
});

/** Tạo mã quà. `count` > 1 tạo một loạt mã ngẫu nhiên cùng phần quà (ô mã để trống). */
internalApi.post('/admin/gift-codes', (req, res) => {
  const maxUses = req.body?.maxUses == null || req.body.maxUses === '' ? null : Number(req.body.maxUses);
  const expiresAt = req.body?.expiresAt == null || req.body.expiresAt === '' ? null : Number(req.body.expiresAt);
  const count = req.body?.count == null || req.body.count === '' ? 1 : Number(req.body.count);
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new GameError('Số mã mỗi lần tạo từ 1 đến 200.');
  if (count > 1 && req.body?.code) throw new GameError('Tạo nhiều mã một lúc thì để trống ô mã, hệ thống tự sinh.');
  const actor = actorOf(req);
  const codes = store.transaction(() => {
    const made = Array.from({ length: count }, () => createGiftCode({ code: req.body?.code || null, label: req.body?.label, rewards: req.body?.rewards, maxUses, expiresAt, createdBy: actor }));
    const first = made[0];
    store.adminLog(actor, 'gift_code', null, { ids: made.map((m) => m.id), codes: made.map((m) => m.code), label: first.label, rewards: first.rewardsText, maxUses, expiresAt });
    return made;
  });
  res.json({ ok: true, code: codes[0], codes });
});

internalApi.get('/admin/gift-codes/:id', (req, res) => {
  const row = giftCodeById(req.params.id);
  if (!row) throw new GameError('Không có mã này.');
  res.json({ code: giftView(row), redemptions: giftRedemptions(row.id) });
});

internalApi.post('/admin/gift-codes/:id/revoke', (req, res) => {
  const row = giftCodeById(req.params.id);
  if (!row) throw new GameError('Không có mã này.');
  const actor = actorOf(req);
  store.transaction(() => {
    if (revokeGiftCode(row.id)) store.adminLog(actor, 'gift_code_revoke', null, { id: row.id, code: row.code });
  });
  res.json({ ok: true });
});

// ---- Thông báo cho người chơi ----

internalApi.get('/admin/announcements', (_req, res) => res.json({ announcements: listAnnouncements(), rules: ANNOUNCEMENT }));

internalApi.post('/admin/announcements', (req, res) => {
  const actor = actorOf(req);
  const made = store.transaction(() => {
    const a = createAnnouncement({ title: req.body?.title, body: req.body?.body, days: Number(req.body?.days ?? ANNOUNCEMENT.defaultDays), popup: req.body?.popup !== false, createdBy: actor });
    store.adminLog(actor, 'announcement', null, { id: a.id, title: a.title, days: Math.round((a.endsAt - a.startsAt) / 86_400_000), popup: a.popup });
    return a;
  });
  res.json({ ok: true, announcement: made });
});

internalApi.post('/admin/announcements/:id/delete', (req, res) => {
  const a = announcementById(req.params.id);
  if (!a) throw new GameError('Không có thông báo này.');
  const actor = actorOf(req);
  store.transaction(() => {
    if (removeAnnouncement(a.id)) store.adminLog(actor, 'announcement_delete', null, { id: a.id, title: a.title });
  });
  res.json({ ok: true });
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
    gear: listGear(user.id, { includeListed: true, reveal: true }),
    wearables: Object.values(ITEMS).filter((i) => i.type === 'accessory').map((i) => ({ id: i.id, name: i.name, slot: i.slot, element: i.element })),
  });
});

internalApi.post('/admin/players/:id/pets', (req, res) => {
  const user = userOf(req);
  noGrantToBot(user);
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
  noGrantToBot(user);
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

/** Link đặt (hoặc đặt lại) mật khẩu cho người chơi: mã chỉ trả về ở đây, nhật ký không ghi mã. */
internalApi.post('/admin/players/:id/password-link', (req, res) => {
  const user = userOf(req);
  if (user.banned) throw new GameError('Tài khoản này đang bị khóa, mở khóa trước đã.');
  const actor = actorOf(req);
  const code = randomCode();
  const expiresAt = store.transaction(() => {
    const until = store.createPasswordLink(user.id, digest(code), { createdBy: actor, ttlMs: PASSWORD_LINK_TTL });
    store.adminLog(actor, 'password_link', user.id, { expiresAt: until });
    return until;
  });
  res.json({ code, expiresAt });
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

// ---- Gia tộc, Sở Nhà Đất, vĩ mô và Sở thuế ----

internalApi.get('/admin/clans', (_req, res) => res.json(adminClanView()));

// ---- Cư dân tự động: số bot mục tiêu, bật/tắt toàn bộ (tắt thì nhịp sau dừng hết) ----
internalApi.get('/admin/bots', (_req, res) => res.json(adminBotsView()));
internalApi.post('/admin/bots/config', (req, res) => {
  const b = req.body ?? {};
  setBotConfig({ enabled: b.enabled, target: b.target, onlineMin: b.onlineMin, onlineMax: b.onlineMax }, actorOf(req));
  res.json(adminBotsView());
});

// ---- Ngân hàng gia tộc: vốn, tiền gửi, khoản vay, vỡ nợ; phong tỏa khẩn cấp một ngân hàng hoặc toàn bộ ----
internalApi.get('/admin/clan-bank', (_req, res) => res.json(adminClanBankView()));
internalApi.post('/admin/clan-bank/freeze', (req, res) => {
  const b = req.body ?? {};
  const clanId = b.clanId == null ? null : Number(b.clanId);
  const out = setClanBankFrozen(Number.isInteger(clanId) ? clanId : null, Boolean(b.frozen));
  store.adminLog(actorOf(req), 'cbank_freeze', null, { clanId, frozen: Boolean(b.frozen) });
  res.json({ ...adminClanBankView(), result: out });
});

// ---- Đấu trường gia tộc: xem và hủy trận chưa đánh ----
internalApi.get('/admin/arena', (_req, res) => res.json(adminArenaView()));
internalApi.post('/admin/arena/:warId/cancel', (req, res) => res.json(adminCancelWar(req.params.warId, actorOf(req), String(req.body?.reason ?? '').slice(0, 200))));

// ---- Sở Công Thương: HHI, thị phần, lệch giá trên sàn công nghiệp, hàng thiết yếu, thuế chống độc quyền, cờ liên kết ----
internalApi.get('/admin/commerce', (_req, res) => {
  const macro = macroToday();
  res.json(commerceView((good) => refPrice(good, macro)));
});

// ---- Gộp / gỡ gộp ngành (chuẩn bị quay lại bản cũ, xem industry-merge.js) ----
internalApi.get('/admin/industries/status', (_req, res) => res.json(unmergePlan()));
internalApi.post('/admin/industries/unmerge', (req, res) => {
  if (!mergeDone()) throw new GameError('Các ngành đang không ở trạng thái gộp.');
  if (req.body?.confirm !== 'UNMERGE') throw new GameError('Gõ đúng UNMERGE để xác nhận gỡ gộp ngành.');
  res.json(unmergeIndustries(actorOf(req)));
});
internalApi.post('/admin/industries/merge', (req, res) => res.json(remergeIndustries(actorOf(req))));
internalApi.get('/admin/industries/heavy', (_req, res) => res.json(heavyStatus()));
internalApi.post('/admin/industries/heavy', (req, res) => res.json(setHeavyOpen(Boolean(req.body?.open), actorOf(req))));

// ---- Trò chuyện và hộp thư ----
internalApi.get('/admin/chat', (req, res) => res.json({ messages: adminChat({ channel: String(req.query?.channel ?? ''), limit: req.query?.limit }) }));
internalApi.post('/admin/chat/:id/delete', (req, res) => res.json(adminDeleteMessage(actorOf(req), req.params.id)));
internalApi.post('/admin/players/:id/mute', (req, res) => res.json(muteUser(actorOf(req), userOf(req).id, req.body?.hours)));
internalApi.post('/admin/mail', (req, res) => {
  const to = req.body?.to === 'all' ? 'all' : Number(req.body?.to);
  res.json(adminMail(actorOf(req), { to, subject: req.body?.subject, body: req.body?.body, coins: req.body?.coins }));
});

internalApi.post('/admin/clans/config', (req, res) => {
  const config = setClanConfig(req.body?.config ?? {});
  store.adminLog(actorOf(req), 'clan_config', null, { config });
  res.json(adminClanView());
});

internalApi.post('/admin/clans/plots/:plotId', (req, res) => {
  const price = setPlotOverride(req.params.plotId, req.body?.price ?? null);
  store.adminLog(actorOf(req), 'land_price', null, { plotId: Number(req.params.plotId), price });
  res.json(adminClanView());
});

/** Ép pha kinh tế / thời tiết cho các ngày tới; `today: true` thì áp luôn cho hôm nay. */
internalApi.post('/admin/clans/macro', (req, res) => {
  const b = req.body ?? {};
  const macro = { phase: b.phase || null, weather: b.weather || null };
  setClanConfig({ macro });
  if (b.today) overrideMacro(dayKey(Date.now()), { phase: macro.phase, weather: macro.weather, landIndex: b.landIndex == null ? undefined : Number(b.landIndex) });
  store.adminLog(actorOf(req), 'macro', null, { ...macro, today: Boolean(b.today), landIndex: b.landIndex ?? null });
  res.json(adminClanView());
});

internalApi.post('/admin/clans/evasion/:evasionId/:action', (req, res) => {
  const action = req.params.action === 'dismiss' ? 'dismiss' : req.params.action === 'collect' ? 'collect' : null;
  if (!action) throw new GameError('Thao tác không hợp lệ.');
  const result = resolveEvasion(req.params.evasionId, action, { penalty: req.body?.penalty, actor: actorOf(req) });
  store.adminLog(actorOf(req), action === 'collect' ? 'tax_collect' : 'tax_dismiss', null, { evasionId: Number(req.params.evasionId), ...result });
  res.json(adminClanView());
});

internalApi.use('/{*rest}', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));

internalApi.use((err, _req, res, _next) => {
  if (err instanceof GameError) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Máy chủ game gặp sự cố.' });
});
