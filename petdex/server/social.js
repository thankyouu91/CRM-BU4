// Cộng đồng: bạn bè (kết bạn, thăm nhà, thả tim, tặng quà) và Hội (quỹ, nâng cấp, dự án tuần).
import { addItem, db, findUserByName, getUser, listPets, skillsOf, takeItem, transaction } from './db.js';
import { dayKey } from './clock.js';
import { sendMail } from './chat.js';
import { GameError, ITEMS, applyEffect, describePet, isConsumable } from './game.js';
import { post, treasuryBalance } from './ledger.js';
import { removeGoods } from './market.js';
import { parkUsers } from './playground.js';
import { track } from './quests.js';
import { COMMODITIES, LOT } from './rules/market.js';
import { GUILD, GUILD_EMBLEMS, GUILD_PROJECTS, GUILD_UPGRADES } from './rules/town.js';
import { mutatePet } from './service.js';
import { weekKey } from './town.js';

const MAX_FRIENDS = 100;
const GIFTS_PER_DAY = 5;
const LIKE_HAPPINESS = 5;

const q = {
  link: db.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?'),
  insertLink: db.prepare('INSERT OR REPLACE INTO friends (user_id, friend_id, status, since) VALUES (?, ?, ?, ?)'),
  deleteLink: db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'),
  accepted: db.prepare("SELECT f.friend_id AS id, u.username FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'accepted' ORDER BY u.username"),
  incoming: db.prepare("SELECT f.user_id AS id, u.username FROM friends f JOIN users u ON u.id = f.user_id WHERE f.friend_id = ? AND f.status = 'pending'"),
  outgoing: db.prepare("SELECT f.friend_id AS id, u.username FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'pending'"),
  countFriends: db.prepare("SELECT COUNT(*) AS n FROM friends WHERE user_id = ? AND status = 'accepted'"),
  liked: db.prepare('SELECT 1 FROM friend_likes WHERE user_id = ? AND friend_id = ? AND day = ?'),
  like: db.prepare('INSERT INTO friend_likes (user_id, friend_id, day) VALUES (?, ?, ?)'),
  likesToday: db.prepare('SELECT COUNT(*) AS n FROM friend_likes WHERE friend_id = ? AND day = ?'),
  likesTotal: db.prepare('SELECT COUNT(*) AS n FROM friend_likes WHERE friend_id = ?'),
  gifts: db.prepare('SELECT count FROM gifts_sent WHERE user_id = ? AND day = ?'),
  addGift: db.prepare(`
    INSERT INTO gifts_sent (user_id, day, count) VALUES (?, ?, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1`),

  guild: db.prepare('SELECT * FROM guilds WHERE id = ?'),
  guildOf: db.prepare('SELECT g.*, m.donated FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.user_id = ?'),
  guilds: db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = g.id) AS members
    FROM guilds g ORDER BY g.prestige DESC, g.created_at LIMIT 30`),
  members: db.prepare(`
    SELECT m.user_id, m.donated, m.joined_at, u.username FROM guild_members m JOIN users u ON u.id = m.user_id
    WHERE m.guild_id = ? ORDER BY m.donated DESC, m.joined_at`),
  memberCount: db.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?'),
  insertGuild: db.prepare('INSERT INTO guilds (name, emblem, leader_id, created_at) VALUES (?, ?, ?, ?)'),
  addMember: db.prepare('INSERT INTO guild_members (user_id, guild_id, joined_at) VALUES (?, ?, ?)'),
  removeMember: db.prepare('DELETE FROM guild_members WHERE user_id = ?'),
  addDonated: db.prepare('UPDATE guild_members SET donated = donated + ? WHERE user_id = ?'),
  setLeader: db.prepare('UPDATE guilds SET leader_id = ? WHERE id = ?'),
  setUpgrades: db.prepare('UPDATE guilds SET upgrades = ? WHERE id = ?'),
  addPrestige: db.prepare('UPDATE guilds SET prestige = prestige + ? WHERE id = ?'),
  deleteGuild: db.prepare('DELETE FROM guilds WHERE id = ?'),
  account: db.prepare('SELECT balance FROM accounts WHERE id = ?'),
  project: db.prepare('SELECT * FROM guild_projects WHERE guild_id = ? AND week = ?'),
  insertProject: db.prepare('INSERT OR IGNORE INTO guild_projects (guild_id, week, project) VALUES (?, ?, ?)'),
  saveProject: db.prepare('UPDATE guild_projects SET progress = ?, done_at = ? WHERE guild_id = ? AND week = ?'),
};

const isFriend = (a, b) => q.link.get(a, b)?.status === 'accepted';

function petCard(userId) {
  const user = getUser(userId);
  const row = listPets(userId).find((p) => p.id === user.active_pet_id) ?? listPets(userId)[0];
  if (!row) return null;
  const pet = describePet(row);
  return { name: pet.name, species: pet.species, level: pet.level, wear: pet.wear, mood: pet.mood, stage: pet.age.stage, scale: pet.age.scale };
}

// ---------------------------------------------------------------- bạn bè

export function friendsView(userId, now = Date.now()) {
  const day = dayKey(now);
  return {
    friends: q.accepted.all(userId).map((f) => ({
      id: f.id,
      username: f.username,
      pet: petCard(f.id),
      inPark: parkUsers.has(f.id),
      likedToday: Boolean(q.liked.get(userId, f.id, day)),
    })),
    incoming: q.incoming.all(userId),
    outgoing: q.outgoing.all(userId),
    giftsLeft: GIFTS_PER_DAY - (q.gifts.get(userId, day)?.count ?? 0),
    myLikes: { today: q.likesToday.get(userId, day).n, total: q.likesTotal.get(userId).n },
  };
}

export function requestFriend(userId, username, now = Date.now()) {
  return transaction(() => {
    const other = findUserByName(String(username ?? '').trim());
    if (!other) throw new GameError('Không tìm thấy người chơi này.');
    if (other.id === userId) throw new GameError('Không thể tự kết bạn với chính mình.');
    if (isFriend(userId, other.id)) throw new GameError(`Bạn và ${other.username} đã là bạn rồi.`);
    if (q.countFriends.get(userId).n >= MAX_FRIENDS) throw new GameError(`Tối đa ${MAX_FRIENDS} bạn.`);
    if (q.link.get(other.id, userId)?.status === 'pending') return acceptFriend(userId, other.id, now);
    if (q.link.get(userId, other.id)) throw new GameError('Đã gửi lời mời rồi, chờ bạn ấy đồng ý nhé.');
    q.insertLink.run(userId, other.id, 'pending', now);
    return { message: `Đã gửi lời mời kết bạn tới ${other.username}.` };
  });
}

export function acceptFriend(userId, fromId, now = Date.now()) {
  return transaction(() => {
    if (q.link.get(fromId, userId)?.status !== 'pending') throw new GameError('Không có lời mời này.');
    q.insertLink.run(fromId, userId, 'accepted', now);
    q.insertLink.run(userId, fromId, 'accepted', now);
    return { message: `Bạn và ${getUser(fromId).username} đã là bạn! 🤝` };
  });
}

export function removeFriend(userId, otherId) {
  return transaction(() => {
    q.deleteLink.run(userId, otherId, otherId, userId);
    return { message: 'Đã xóa khỏi danh sách.' };
  });
}

/** Thăm nhà bạn: xem các bé, số tim; chỉ bạn bè mới thăm được. */
export function visit(userId, friendId) {
  if (!isFriend(userId, friendId)) throw new GameError('Chỉ thăm được nhà bạn bè.');
  const friend = getUser(friendId);
  return {
    username: friend.username,
    pets: listPets(friendId).map((p) => {
      const d = describePet(p);
      return { id: d.id, name: d.name, species: d.species, level: d.level, wear: d.wear, mood: d.mood, age: d.age, busyUntil: d.busyUntil, busyKind: d.busyKind, skills: skillsOf(d.id) };
    }),
    activePetId: friend.active_pet_id,
    likes: q.likesTotal.get(friendId).n,
    likedToday: Boolean(q.liked.get(userId, friendId, dayKey(Date.now()))),
    guild: q.guildOf.get(friendId)?.name ?? null,
  };
}

/** Thả tim nhà bạn: mỗi ngày một lần với mỗi bạn, bé chính của bạn ấy vui thêm. */
export function likeFriend(userId, friendId, now = Date.now()) {
  return transaction(() => {
    if (!isFriend(userId, friendId)) throw new GameError('Chỉ thả tim được nhà bạn bè.');
    const day = dayKey(now);
    if (q.liked.get(userId, friendId, day)) throw new GameError('Hôm nay bạn đã thả tim nhà này rồi.');
    q.like.run(userId, friendId, day);
    const friend = getUser(friendId);
    if (friend.active_pet_id) {
      mutatePet(friendId, friend.active_pet_id, (pet) => ({ pet: applyEffect(pet, { happiness: LIKE_HAPPINESS }) }), { now });
    }
    track(userId, 'friend', 1, now);
    return { message: `💖 Đã thả tim nhà ${friend.username}, bé chính của bạn ấy vui hơn.` };
  });
}

export function giftFriend(userId, friendId, itemId, now = Date.now()) {
  return transaction(() => {
    if (!isFriend(userId, friendId)) throw new GameError('Chỉ tặng quà được cho bạn bè.');
    const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
    if (!item || !isConsumable(item)) throw new GameError('Chỉ tặng được đồ ăn hoặc đồ chăm sóc.');
    const day = dayKey(now);
    if ((q.gifts.get(userId, day)?.count ?? 0) >= GIFTS_PER_DAY) throw new GameError(`Mỗi ngày tặng tối đa ${GIFTS_PER_DAY} món.`);
    takeItem(userId, item.id, 1);
    addItem(friendId, item.id, 1);
    q.addGift.run(userId, day);
    return { message: `🎁 Đã tặng ${item.icon} ${item.name} cho ${getUser(friendId).username}.` };
  });
}

// ---------------------------------------------------------------- Hội

const guildAccount = (id) => `guild:${id}`;
const treasuryOf = (id) => q.account.get(guildAccount(id))?.balance ?? 0;

function projectFor(guildId, week) {
  q.insertProject.run(guildId, week, Object.keys(GUILD_PROJECTS)[(guildId + Number(week.replaceAll('-', ''))) % Object.keys(GUILD_PROJECTS).length]);
  const row = q.project.get(guildId, week);
  return { ...row, progress: JSON.parse(row.progress) };
}

function mustMember(userId) {
  const g = q.guildOf.get(userId);
  if (!g) throw new GameError('Bạn chưa ở Hội nào.');
  return { ...g, upgrades: JSON.parse(g.upgrades) };
}

export function guildView(userId, now = Date.now()) {
  const mine = q.guildOf.get(userId);
  const list = q.guilds.all().map((g) => ({ id: g.id, name: g.name, emblem: g.emblem, prestige: g.prestige, members: g.members, max: GUILD.maxMembers }));
  if (!mine) return { guild: null, guilds: list, emblems: GUILD_EMBLEMS, createCost: GUILD.createCost };
  const upgrades = JSON.parse(mine.upgrades);
  const week = weekKey(dayKey(now));
  const project = transaction(() => projectFor(mine.id, week));
  const def = GUILD_PROJECTS[project.project];
  return {
    guild: {
      id: mine.id,
      name: mine.name,
      emblem: mine.emblem,
      prestige: mine.prestige,
      leader: mine.leader_id === userId,
      leaderName: getUser(mine.leader_id)?.username,
      treasury: treasuryOf(mine.id),
      myDonated: mine.donated,
      members: q.members.all(mine.id).map((m) => ({ id: m.user_id, username: m.username, donated: m.donated, inPark: parkUsers.has(m.user_id) })),
      upgrades: Object.fromEntries(Object.entries(GUILD_UPGRADES).map(([k, u]) => {
        const level = upgrades[k] ?? 0;
        return [k, { ...u, level, next: u.costs[level] ?? null }];
      })),
      project: {
        ...def,
        id: project.project,
        week,
        done: Boolean(project.done_at),
        progress: Object.fromEntries(Object.keys(def.needs).map((c) => [c, (project.progress[c] ?? 0) / LOT])),
      },
    },
    guilds: list,
    emblems: GUILD_EMBLEMS,
  };
}

export function createGuild(userId, { name, emblem }, now = Date.now()) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length < 3 || clean.length > 20) throw new GameError('Tên Hội dài 3–20 ký tự.');
  if (!GUILD_EMBLEMS.includes(emblem)) throw new GameError('Hãy chọn một biểu tượng.');
  return transaction(() => {
    if (q.guildOf.get(userId)) throw new GameError('Bạn đang ở một Hội khác.');
    post({ userId, delta: -GUILD.createCost, kind: 'guild_create', memo: clean, now });
    let id;
    try {
      id = Number(q.insertGuild.run(clean, emblem, userId, now).lastInsertRowid);
    } catch {
      throw new GameError('Tên Hội này đã có người dùng.');
    }
    q.addMember.run(userId, id, now);
    return { message: `${emblem} Hội "${clean}" ra đời! Mời bạn bè cùng tham gia nhé.` };
  });
}

export function joinGuild(userId, guildId, now = Date.now()) {
  return transaction(() => {
    if (q.guildOf.get(userId)) throw new GameError('Rời Hội hiện tại trước đã.');
    const g = q.guild.get(guildId);
    if (!g) throw new GameError('Không tìm thấy Hội.');
    if (q.memberCount.get(guildId).n >= GUILD.maxMembers) throw new GameError('Hội đã đủ thành viên.');
    q.addMember.run(userId, guildId, now);
    return { message: `Đã gia nhập ${g.emblem} ${g.name}.` };
  });
}

/** Rời Hội; trưởng Hội rời thì người góp nhiều nhất lên thay; Hội trống thì giải tán, quỹ bị hủy. */
export function leaveGuild(userId, now = Date.now()) {
  return transaction(() => {
    const g = mustMember(userId);
    q.removeMember.run(userId);
    const rest = q.members.all(g.id);
    if (!rest.length) {
      const left = treasuryOf(g.id);
      if (left > 0) post({ account: guildAccount(g.id), delta: -left, kind: 'guild_upgrade', memo: 'Giải tán Hội', now });
      q.deleteGuild.run(g.id);
      return { message: `Hội "${g.name}" đã giải tán.` };
    }
    if (g.leader_id === userId) q.setLeader.run(rest[0].user_id, g.id);
    return { message: `Đã rời Hội "${g.name}".` };
  });
}

export function donate(userId, amount, now = Date.now()) {
  return transaction(() => {
    const g = mustMember(userId);
    post({ userId, delta: -amount, kind: 'guild_donation', memo: g.name, now });
    post({ account: guildAccount(g.id), delta: amount, kind: 'guild_donation', memo: getUser(userId).username, now });
    q.addDonated.run(amount, userId);
    track(userId, 'donate', 1, now);
    return { message: `Đã góp ${amount} 🪙 vào quỹ ${g.emblem} ${g.name}.` };
  });
}

export function upgradeGuild(userId, key, now = Date.now()) {
  const def = GUILD_UPGRADES[key];
  if (!def) throw new GameError('Không có nâng cấp này.');
  return transaction(() => {
    const g = mustMember(userId);
    if (g.leader_id !== userId) throw new GameError('Chỉ trưởng Hội được dùng quỹ.');
    const level = g.upgrades[key] ?? 0;
    const cost = def.costs[level];
    if (cost === undefined) throw new GameError('Đã nâng cấp tối đa.');
    if (treasuryOf(g.id) < cost) throw new GameError(`Quỹ Hội cần ${cost} 🪙.`);
    post({ account: guildAccount(g.id), delta: -cost, kind: 'guild_upgrade', memo: `${def.name} cấp ${level + 1}`, now });
    q.setUpgrades.run(JSON.stringify({ ...g.upgrades, [key]: level + 1 }), g.id);
    return { message: `${def.name} lên cấp ${level + 1}!` };
  });
}

/** Góp nguyên liệu từ kho cho dự án tuần; đủ thì Hội có danh vọng, mọi thành viên nhận thưởng từ ngân sách thị trấn. */
export function contribute(userId, commodity, qty, now = Date.now()) {
  return transaction(() => {
    const g = mustMember(userId);
    const week = weekKey(dayKey(now));
    const project = projectFor(g.id, week);
    const def = GUILD_PROJECTS[project.project];
    if (project.done_at) throw new GameError('Dự án tuần này đã xong rồi.');
    if (!def.needs[commodity]) throw new GameError('Dự án không cần mặt hàng này.');
    const missing = def.needs[commodity] * LOT - (project.progress[commodity] ?? 0);
    const give = Math.min(qty, missing);
    if (give <= 0) throw new GameError(`Đã đủ ${COMMODITIES[commodity].name} rồi.`);
    removeGoods(userId, commodity, give, now);
    project.progress[commodity] = (project.progress[commodity] ?? 0) + give;
    const done = Object.entries(def.needs).every(([c, lots]) => (project.progress[c] ?? 0) >= lots * LOT);
    q.saveProject.run(JSON.stringify(project.progress), done ? now : null, g.id, week);
    if (!done) return { message: `Đã góp ${give / LOT} lô ${COMMODITIES[commodity].name} cho "${def.name}".` };

    q.addPrestige.run(def.prestige, g.id);
    const members = q.members.all(g.id);
    let paid = 0;
    for (const m of members) {
      if (treasuryBalance() < def.reward) break;
      post({ account: 'treasury', delta: -def.reward, kind: 'guild_reward', memo: `${g.name}: ${def.name}`, now });
      post({ userId: m.user_id, delta: def.reward, kind: 'guild_reward', memo: def.name, now });
      if (m.user_id !== userId) sendMail({ to: m.user_id, fromName: g.name, subject: `${def.icon} Dự án "${def.name}" hoàn thành`, body: `Hội vừa xong dự án tuần. Bạn được thưởng ${def.reward} xu từ ngân sách thị trấn.`, now });
      paid += 1;
    }
    const reward = paid === members.length
      ? `mỗi thành viên +${def.reward} 🪙`
      : paid ? `${paid}/${members.length} thành viên được +${def.reward} 🪙 (ngân sách thị trấn đã cạn)` : 'ngân sách thị trấn đã cạn nên chưa ai được thưởng xu';
    return { message: `${def.icon} "${def.name}" hoàn thành! Hội +${def.prestige} danh vọng, ${reward}.` };
  });
}
