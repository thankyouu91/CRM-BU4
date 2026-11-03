import * as store from './db.js';
import { GameError, ITEMS, clamp, cuddle, describePet, isConsumable, levelReward } from './game.js';
import { track } from './quests.js';
import { bus, mutatePet } from './service.js';

/** Thế giới rộng gấp đôi khung nhìn: client có camera đi theo bé của mình và cuộn ngang. */
export const WORLD = { width: 2000, height: 600, minX: 50, maxX: 1950, minY: 318, maxY: 585 };

/**
 * Công viên chia thành nhiều kênh (Kênh 1, 2, ...), mỗi kênh một phòng phát sóng riêng.
 * ROOM_CAP: số người chơi đang online tối đa mỗi kênh; MAX_ROOMS: trần số kênh (60 × 40 = 2400 chỗ).
 */
export const ROOM_CAP = 60;
export const MAX_ROOMS = 40;
/** Cư dân (bé của người đang vắng) mỗi kênh. */
export const RESIDENTS_PER_ROOM = 20;
/** Mỗi client gửi vị trí dồn dập thì máy chủ chỉ phát lại nhiều nhất một lần mỗi bấy nhiêu mili giây (lấy vị trí mới nhất). */
export const MOVE_GAP_MS = 100;

const CUDDLE_COOLDOWN_MS = 30_000;
const GIFT_GAP_MS = 2_000;
const EMOTE_GAP_MS = 400;
const SWITCH_GAP_MS = 2_000;
const ROOMS_GAP_MS = 1_000;
/** Danh sách cư dân được xếp lại theo chu kỳ này (hoặc khi có kênh mới mở). */
const RESIDENT_REFRESH_MS = 60_000;
const EMOTES = new Set(['wave', 'jump', 'spin']);

const roomKey = (n) => `park:${n}`;
const randomIn = (lo, hi) => Math.round(lo + Math.random() * (hi - lo));

/** Ai đang ở công viên (userId), để danh sách bạn bè hiện trạng thái. */
export const parkUsers = new Set();

function petCard(row) {
  const pet = describePet(row);
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    level: pet.level,
    wear: pet.wear,
    element: pet.element,
    stage: pet.age.stage,
    scale: pet.age.scale,
    mood: pet.mood.key,
  };
}

const view = (p) => ({ id: p.id, userId: p.userId, username: p.username, x: p.x, y: p.y, pet: p.pet, offline: Boolean(p.offline) });

const residentId = (userId) => `r${userId}`;
const nameOf = (user) => user.display_name || user.username;

/** Chỗ đứng cố định theo người chơi, để mọi người cùng thấy cư dân ở một chỗ khi vào công viên. */
function homeSpot(userId) {
  // mulberry32: mã người chơi liên tiếp vẫn cho chỗ đứng trải đều khắp bãi cỏ
  let a = (userId * 0x9e3779b9) | 0;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { x: Math.round(WORLD.minX + 40 + r() * (WORLD.maxX - WORLD.minX - 80)), y: Math.round(WORLD.minY + 20 + r() * (WORLD.maxY - WORLD.minY - 30)) };
}

/** Thẻ cư dân của một người chơi (đang vắng), hoặc null nếu không còn bé sống hay đã bị khóa. */
function residentOf(userId) {
  const user = store.getUser(userId);
  if (!user || user.banned || !user.active_pet_id) return null;
  const row = store.getPet(user.active_pet_id);
  if (!row) return null;
  return { id: residentId(user.id), userId: user.id, username: nameOf(user), ...homeSpot(user.id), pet: petCard(row), offline: true };
}

const q = {
  friends: store.db.prepare("SELECT friend_id AS id FROM friends WHERE user_id = ? AND status = 'accepted'"),
  clanMates: store.db.prepare('SELECT b.user_id AS id FROM clan_members a JOIN clan_members b ON b.clan_id = a.clan_id WHERE a.user_id = ? AND b.user_id <> a.user_id'),
};

/** Bạn bè và người cùng gia tộc: ưu tiên xếp chung kênh. */
function companionsOf(userId) {
  return new Set([...q.friends.all(userId), ...q.clanMates.all(userId)].map((r) => r.id));
}

export function attachPlayground(io) {
  const players = new Map(); // socket.id -> người chơi đang ở công viên
  const byUser = new Map(); // userId -> người chơi (mỗi người một bé)
  const members = new Map(); // số kênh -> Set(socket.id)
  const residentRoom = new Map(); // userId -> kênh đang có cư dân này
  const lastCuddle = new Map(); // "petA>petB" -> thời điểm
  let residentsAt = 0;
  let residentsFor = 0;

  const playerOfUser = (userId) => byUser.get(userId);
  const countIn = (room) => members.get(room)?.size ?? 0;
  const highestRoom = () => Math.max(0, ...[...members].filter(([, set]) => set.size).map(([n]) => n));
  const toRoom = (room) => io.to(roomKey(room));

  /** Các kênh để chọn: mọi kênh đang có người, thêm một kênh trống kế tiếp. */
  function roomList() {
    const last = Math.min(MAX_ROOMS, highestRoom() + 1);
    return Array.from({ length: last }, (_, i) => ({ n: i + 1, count: countIn(i + 1) }));
  }

  /** Chọn kênh khi vào: kênh muốn (nếu còn chỗ), rồi kênh có nhiều bạn bè/đồng đội nhất, rồi kênh số nhỏ nhất còn chỗ. */
  function pickRoom(userId, wanted) {
    if (Number.isInteger(wanted) && wanted >= 1 && wanted <= MAX_ROOMS && countIn(wanted) < ROOM_CAP) return wanted;
    let best = 0;
    let bestScore = 0;
    const score = new Map();
    for (const id of companionsOf(userId)) {
      const friend = byUser.get(id);
      if (!friend || countIn(friend.room) >= ROOM_CAP) continue;
      const n = (score.get(friend.room) ?? 0) + 1;
      score.set(friend.room, n);
      if (n > bestScore || (n === bestScore && friend.room < best)) [best, bestScore] = [friend.room, n];
    }
    if (best) return best;
    for (let n = 1; n <= MAX_ROOMS; n++) if (countIn(n) < ROOM_CAP) return n;
    throw new GameError('Công viên đã kín chỗ ở mọi kênh, bạn quay lại sau ít phút nhé.');
  }

  /**
   * Xếp cư dân cho các kênh đang mở: lấy những người vắng mặt hoạt động gần nhất, giữ chỗ cũ của ai vẫn còn trong danh sách,
   * rồi lấp kênh nào chưa đủ RESIDENTS_PER_ROOM. Ai bị bỏ khỏi kênh hay mới được thêm thì báo cho kênh đó
   * (trừ `joiner`, người sắp nhận trọn trạng thái kênh). Chỉ xếp lại khi hết chu kỳ, có kênh mới mở, hoặc kênh
   * `joinRoom` còn thiếu cư dân; lúc đông người, mọi kênh đã đủ nên phần lớn lượt vào không phải đọc cơ sở dữ liệu.
   */
  function arrangeResidents(joiner, joinRoom, now = Date.now()) {
    const tell = (room) => (joiner ? joiner.to(roomKey(room)) : toRoom(room));
    const open = Math.max(1, highestRoom());
    let have = 0;
    for (const r of residentRoom.values()) if (r === joinRoom) have++;
    if (now - residentsAt < RESIDENT_REFRESH_MS && open <= residentsFor && have >= RESIDENTS_PER_ROOM) return;
    residentsAt = now;
    residentsFor = open;
    const wanted = open * RESIDENTS_PER_ROOM;
    const pool = store.residentUsers(wanted + byUser.size).filter((u) => !byUser.has(u.id)).slice(0, wanted).map((u) => u.id);
    const keep = new Set(pool);
    const perRoom = new Map();
    const next = new Map();
    for (const [userId, room] of residentRoom) {
      const n = perRoom.get(room) ?? 0;
      if (keep.has(userId) && room <= open && n < RESIDENTS_PER_ROOM) {
        next.set(userId, room);
        perRoom.set(room, n + 1);
      } else {
        tell(room).emit('pg:left', { id: residentId(userId), quiet: true });
      }
    }
    let room = 1;
    for (const userId of pool) {
      if (next.has(userId)) continue;
      let tries = 0;
      while ((perRoom.get(room) ?? 0) >= RESIDENTS_PER_ROOM && tries++ < open) room = (room % open) + 1;
      if ((perRoom.get(room) ?? 0) >= RESIDENTS_PER_ROOM) break;
      next.set(userId, room);
      perRoom.set(room, (perRoom.get(room) ?? 0) + 1);
      if (countIn(room)) {
        const resident = residentOf(userId);
        if (resident) tell(room).emit('pg:player', { ...view(resident), quiet: true });
      }
      room = (room % open) + 1; // chia vòng: kênh nào cũng có người mới hoạt động
    }
    residentRoom.clear();
    for (const [userId, r] of next) residentRoom.set(userId, r);
  }

  const residentsIn = (room) =>
    [...residentRoom].filter(([, r]) => r === room).map(([userId]) => residentOf(userId)).filter(Boolean);

  /** Đọc lại thú cưng chính của người chơi và báo cho kênh của họ. */
  function refresh(player) {
    const user = store.getUser(player.userId);
    const row = user?.active_pet_id && store.getPet(user.active_pet_id);
    if (!row) return; // bé mất: giữ người chơi tới khi rời công viên
    player.pet = petCard(row);
    toRoom(player.room).emit('pg:player', view(player));
  }

  bus.on('pet:changed', (userId) => {
    const player = playerOfUser(userId);
    if (player) return refresh(player);
    // Người vắng mặt chỉ được báo cho kênh đang có cư dân của họ (bot hoạt động liên tục không làm ồn mọi kênh).
    const room = residentRoom.get(userId);
    if (!room) return;
    const resident = residentOf(userId);
    if (resident) toRoom(room).emit('pg:player', { ...view(resident), quiet: true });
    else {
      residentRoom.delete(userId);
      toRoom(room).emit('pg:left', { id: residentId(userId), quiet: true });
    }
  });

  /** Rời kênh hiện tại (đổi kênh hoặc về nhà). */
  function leaveRoom(player) {
    clearTimeout(player.moveTimer);
    player.moveTimer = null;
    members.get(player.room)?.delete(player.id);
    io.sockets.sockets.get(player.id)?.leave(roomKey(player.room));
    toRoom(player.room).emit('pg:left', { id: player.id });
  }

  function enterRoom(socket, player, room) {
    player.room = room;
    player.x = randomIn(WORLD.minX + 100, WORLD.maxX - 100);
    player.y = randomIn(WORLD.minY + 60, WORLD.maxY - 20);
    if (!members.has(room)) members.set(room, new Set());
    members.get(room).add(socket.id);
    socket.join(roomKey(room));
    arrangeResidents(socket, room);
    // Bé của chính mình đang làm cư dân ở kênh khác thì rút về.
    const wasResident = residentRoom.get(player.userId);
    if (wasResident) {
      residentRoom.delete(player.userId);
      if (wasResident !== room) toRoom(wasResident).emit('pg:left', { id: residentId(player.userId), quiet: true });
    }
    const here = [...members.get(room)].map((id) => view(players.get(id)));
    socket.emit('pg:state', { selfId: socket.id, world: WORLD, room, cap: ROOM_CAP, rooms: roomList(), players: here.concat(residentsIn(room)) });
    socket.to(roomKey(room)).emit('pg:joined', view(player)); // client bỏ thẻ cư dân cùng userId
  }

  function leave(socketId) {
    const player = players.get(socketId);
    if (!players.delete(socketId)) return;
    if (byUser.get(player.userId) === player) byUser.delete(player.userId);
    if (!playerOfUser(player.userId)) parkUsers.delete(player.userId);
    leaveRoom(player);
    // Về nhà nhưng bé vẫn ở lại kênh vừa chơi như một cư dân.
    if (!playerOfUser(player.userId) && countIn(player.room)) {
      const resident = residentOf(player.userId);
      if (resident) {
        residentRoom.set(player.userId, player.room);
        toRoom(player.room).emit('pg:player', { ...view(resident), quiet: true });
      }
    }
  }

  function broadcastMove(socket, me) {
    me.lastMove = Date.now();
    socket.to(roomKey(me.room)).emit('pg:moved', { id: me.id, x: me.x, y: me.y });
  }

  io.use((socket, next) => {
    const user = store.userForToken(socket.handshake.auth?.token);
    if (!user || user.banned) return next(new Error('Bạn cần đăng nhập.'));
    socket.data.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    const on = (event, handler) =>
      socket.on(event, (payload) => {
        try {
          handler(payload && typeof payload === 'object' ? payload : {});
        } catch (err) {
          if (!(err instanceof GameError)) console.error(err);
          socket.emit('pg:error', { message: err instanceof GameError ? err.message : 'Có lỗi xảy ra.' });
        }
      });

    const self = () => {
      const player = players.get(socket.id);
      if (!player) throw new GameError('Bạn chưa vào công viên.');
      return player;
    };

    /** Bé được bấm vào: người đang online cùng kênh, hoặc cư dân (chủ đang vắng). */
    const other = (targetId, me) => {
      const online = players.get(targetId);
      if (online) {
        if (online.id === socket.id) throw new GameError('Đó là bé của bạn mà.');
        if (online.room !== me.room) throw new GameError('Bé này đang ở kênh khác.');
        return online;
      }
      const m = /^r(\d+)$/.exec(String(targetId ?? ''));
      const userId = m && Number(m[1]);
      const live = userId && playerOfUser(userId);
      if (live) {
        if (live.room !== me.room) throw new GameError('Bé này đang ở kênh khác.');
        return live;
      }
      // Bé vắng mặt chỉ tương tác được khi đang là cư dân của đúng kênh này.
      const resident = userId && userId !== socket.data.userId && residentRoom.get(userId) === me.room && residentOf(userId);
      if (!resident) throw new GameError('Bé này vừa rời công viên.');
      return resident;
    };

    on('pg:join', ({ room }) => {
      const user = store.getUser(socket.data.userId);
      const row = user.active_pet_id && store.getPet(user.active_pet_id);
      if (!row) throw new GameError('Hãy nhận nuôi và chọn một thú cưng chính trước khi ra công viên.');

      const current = players.get(socket.id);
      if (current) {
        // Vào lại từ cùng kết nối: chỉ gửi lại trạng thái kênh đang đứng.
        current.pet = petCard(row);
        const here = [...members.get(current.room)].map((id) => view(players.get(id)));
        socket.emit('pg:state', { selfId: socket.id, world: WORLD, room: current.room, cap: ROOM_CAP, rooms: roomList(), players: here.concat(residentsIn(current.room)) });
        return;
      }

      // Mỗi người chỉ dắt một bé vào công viên: tab cũ nhường chỗ cho tab mới (và tab mới về kênh cũ nếu không chọn kênh).
      const previous = playerOfUser(user.id);
      const previousRoom = previous?.room;
      if (previous) {
        leave(previous.id);
        const old = io.sockets.sockets.get(previous.id);
        old?.emit('pg:kicked');
        old?.disconnect(true);
      }

      const player = { id: socket.id, userId: user.id, username: nameOf(user), x: 0, y: 0, lastGift: 0, lastMove: 0, lastEmote: 0, lastSwitch: 0, lastRooms: 0, moveTimer: null };
      player.pet = petCard(row);
      const target = pickRoom(user.id, Number.isInteger(room) ? room : previousRoom);
      players.set(socket.id, player);
      byUser.set(user.id, player);
      parkUsers.add(user.id);
      enterRoom(socket, player, target);
    });

    on('pg:room', ({ room }) => {
      const me = self();
      if (!Number.isInteger(room) || room < 1 || room > MAX_ROOMS) throw new GameError('Không có kênh này.');
      if (room === me.room) return;
      if (countIn(room) >= ROOM_CAP) throw new GameError(`Kênh ${room} đã đủ ${ROOM_CAP} người, chọn kênh khác nhé.`);
      const now = Date.now();
      if (now - me.lastSwitch < SWITCH_GAP_MS) throw new GameError('Đổi kênh chậm thôi nào!');
      me.lastSwitch = now;
      leaveRoom(me);
      enterRoom(socket, me, room);
    });

    on('pg:rooms', () => {
      const me = self();
      const now = Date.now();
      if (now - me.lastRooms < ROOMS_GAP_MS) return;
      me.lastRooms = now;
      socket.emit('pg:rooms', { room: me.room, cap: ROOM_CAP, rooms: roomList() });
    });

    on('pg:move', ({ x, y }) => {
      const me = self();
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      me.x = Math.round(clamp(x, WORLD.minX, WORLD.maxX));
      me.y = Math.round(clamp(y, WORLD.minY, WORLD.maxY));
      // Gửi dồn dập: giữ vị trí mới nhất và phát một lần khi hết khoảng chờ.
      const wait = me.lastMove + MOVE_GAP_MS - Date.now();
      if (wait <= 0) return broadcastMove(socket, me);
      if (!me.moveTimer) {
        me.moveTimer = setTimeout(() => {
          me.moveTimer = null;
          if (players.get(socket.id) === me) broadcastMove(socket, me);
        }, wait);
      }
    });

    on('pg:emote', ({ kind }) => {
      const me = self();
      const now = Date.now();
      if (!EMOTES.has(kind) || now - me.lastEmote < EMOTE_GAP_MS) return;
      me.lastEmote = now;
      toRoom(me.room).emit('pg:emote', { id: me.id, kind });
    });

    on('pg:cuddle', ({ targetId }) => {
      const me = self();
      const target = other(targetId, me);
      const key = `${me.pet.id}>${target.pet.id}`;
      const now = Date.now();
      const wait = (lastCuddle.get(key) ?? 0) + CUDDLE_COOLDOWN_MS - now;
      if (wait > 0) throw new GameError(`Đợi ${Math.ceil(wait / 1000)} giây nữa rồi vuốt ve ${target.pet.name} tiếp nhé.`);
      lastCuddle.set(key, now);
      if (lastCuddle.size > 5_000) {
        for (const [k, at] of lastCuddle) if (now - at > CUDDLE_COOLDOWN_MS) lastCuddle.delete(k);
      }

      // Cả hai bé cùng vui; người chủ động được thêm ít xu làm quen.
      const mine = mutatePet(me.userId, me.pet.id, (pet) => ({ ...cuddle(pet), coins: 3 }), { kind: 'cuddle' });
      track(me.userId, 'cuddle');
      const theirs = mutatePet(target.userId, target.pet.id, cuddle);

      const levelUps = (outcome) => outcome.levelsGained.map((level) => ({ level, reward: levelReward(level) }));
      toRoom(me.room).emit('pg:fx', { from: me.id, to: target.id, kind: 'cuddle' });
      io.to(me.id).emit('me:changed', {
        notice: `💖 ${me.pet.name} và ${target.pet.name} thân nhau hơn rồi! +3 🪙`,
        levelUps: levelUps(mine),
        petName: me.pet.name,
      });
      io.to(target.id).emit('me:changed', {
        notice: `💖 ${me.username} vừa vuốt ve ${target.pet.name} của bạn!`,
        levelUps: levelUps(theirs),
        petName: target.pet.name,
      });
    });

    on('pg:gift', ({ targetId, itemId }) => {
      const me = self();
      const target = other(targetId, me);
      const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
      if (!item || !isConsumable(item)) throw new GameError('Chỉ tặng được đồ ăn hoặc đồ chăm sóc.');
      const now = Date.now();
      if (now - me.lastGift < GIFT_GAP_MS) throw new GameError('Tặng quà chậm thôi nào!');
      store.transaction(() => {
        store.takeItem(me.userId, item.id, 1);
        store.addItem(target.userId, item.id, 1);
      });
      me.lastGift = now;
      toRoom(me.room).emit('pg:fx', { from: me.id, to: target.id, kind: 'gift', icon: item.icon });
      io.to(me.id).emit('me:changed', { notice: `🎁 Đã tặng ${item.icon} ${item.name} cho ${target.username}` });
      io.to(target.id).emit('me:changed', { notice: `🎁 ${me.username} tặng bạn ${item.icon} ${item.name}!` });
    });

    socket.on('disconnect', () => leave(socket.id));
  });

  /** Số người mỗi kênh (cho bảng quản trị hay kiểm thử). */
  return { rooms: roomList, roomOf: (userId) => byUser.get(userId)?.room ?? null, residentRooms: () => new Map(residentRoom) };
}
