import * as store from './db.js';
import { GameError, ITEMS, clamp, cuddle, describePet, isConsumable, levelReward } from './game.js';
import { track } from './quests.js';
import { bus, mutatePet } from './service.js';

export const WORLD = { width: 1000, height: 600, minX: 50, maxX: 950, minY: 318, maxY: 585 };

const ROOM = 'park';
const CUDDLE_COOLDOWN_MS = 30_000;
const GIFT_GAP_MS = 2_000;
const EMOTES = new Set(['wave', 'jump', 'spin']);

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

/** Cư dân hiện trong công viên kể cả khi chủ không online, nhiều nhất bấy nhiêu người (mới hoạt động trước). */
export const MAX_RESIDENTS = 50;
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

export function attachPlayground(io) {
  const players = new Map(); // socket.id -> người chơi đang ở công viên
  const lastCuddle = new Map(); // "petA>petB" -> thời điểm

  const playerOfUser = (userId) => [...players.values()].find((p) => p.userId === userId);

  /** Đọc lại thú cưng chính của người chơi và báo cho cả công viên. */
  function refresh(player) {
    const user = store.getUser(player.userId);
    const row = user?.active_pet_id && store.getPet(user.active_pet_id);
    if (!row) return; // bé mất: giữ người chơi tới khi rời công viên
    player.pet = petCard(row);
    io.to(ROOM).emit('pg:player', view(player));
  }

  bus.on('pet:changed', (userId) => {
    const player = playerOfUser(userId);
    if (player) return refresh(player);
    const resident = residentOf(userId);
    if (resident) io.to(ROOM).emit('pg:player', { ...view(resident), quiet: true });
    else io.to(ROOM).emit('pg:left', { id: residentId(userId), quiet: true });
  });

  function leave(socketId) {
    const player = players.get(socketId);
    if (!players.delete(socketId)) return;
    if (!playerOfUser(player.userId)) parkUsers.delete(player.userId);
    io.to(ROOM).emit('pg:left', { id: socketId });
    // Về nhà nhưng bé vẫn ở lại công viên như một cư dân.
    if (!playerOfUser(player.userId)) {
      const resident = residentOf(player.userId);
      if (resident) io.to(ROOM).emit('pg:player', { ...view(resident), quiet: true });
    }
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

    /** Bé được bấm vào: người đang online, hoặc cư dân (chủ đang vắng). */
    const other = (targetId) => {
      const online = players.get(targetId);
      if (online) {
        if (online.id === socket.id) throw new GameError('Đó là bé của bạn mà.');
        return online;
      }
      const m = /^r(\d+)$/.exec(String(targetId ?? ''));
      const userId = m && Number(m[1]);
      const live = userId && playerOfUser(userId);
      if (live) return live;
      const resident = userId && userId !== socket.data.userId && residentOf(userId);
      if (!resident) throw new GameError('Bé này vừa rời công viên.');
      return resident;
    };

    on('pg:join', () => {
      const user = store.getUser(socket.data.userId);
      const row = user.active_pet_id && store.getPet(user.active_pet_id);
      if (!row) throw new GameError('Hãy nhận nuôi và chọn một thú cưng chính trước khi ra công viên.');

      // Mỗi người chỉ dắt một bé vào công viên: tab cũ nhường chỗ cho tab mới.
      const previous = playerOfUser(user.id);
      if (previous && previous.id !== socket.id) {
        leave(previous.id);
        const old = io.sockets.sockets.get(previous.id);
        old?.emit('pg:kicked');
        old?.disconnect(true);
      }

      const player = players.get(socket.id) ?? {
        id: socket.id,
        userId: user.id,
        username: nameOf(user),
        x: randomIn(WORLD.minX + 100, WORLD.maxX - 100),
        y: randomIn(WORLD.minY + 60, WORLD.maxY - 20),
        lastGift: 0,
      };
      player.pet = petCard(row);
      const isNew = !players.has(socket.id);
      players.set(socket.id, player);
      parkUsers.add(user.id);
      socket.join(ROOM);
      const online = new Set([...players.values()].map((p) => p.userId));
      const residents = store.residentUsers(MAX_RESIDENTS).filter((u) => !online.has(u.id)).map((u) => residentOf(u.id)).filter(Boolean);
      socket.emit('pg:state', { selfId: socket.id, world: WORLD, players: [...players.values()].map(view).concat(residents) });
      if (isNew) socket.to(ROOM).emit('pg:joined', view(player)); // client bỏ thẻ cư dân cùng userId
    });

    on('pg:move', ({ x, y }) => {
      const me = self();
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      me.x = Math.round(clamp(x, WORLD.minX, WORLD.maxX));
      me.y = Math.round(clamp(y, WORLD.minY, WORLD.maxY));
      io.to(ROOM).emit('pg:moved', { id: me.id, x: me.x, y: me.y });
    });

    on('pg:emote', ({ kind }) => {
      const me = self();
      if (EMOTES.has(kind)) io.to(ROOM).emit('pg:emote', { id: me.id, kind });
    });

    on('pg:cuddle', ({ targetId }) => {
      const me = self();
      const target = other(targetId);
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
      io.to(ROOM).emit('pg:fx', { from: me.id, to: target.id, kind: 'cuddle' });
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
      const target = other(targetId);
      const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
      if (!item || !isConsumable(item)) throw new GameError('Chỉ tặng được đồ ăn hoặc đồ chăm sóc.');
      const now = Date.now();
      if (now - me.lastGift < GIFT_GAP_MS) throw new GameError('Tặng quà chậm thôi nào!');
      store.transaction(() => {
        store.takeItem(me.userId, item.id, 1);
        store.addItem(target.userId, item.id, 1);
      });
      me.lastGift = now;
      io.to(ROOM).emit('pg:fx', { from: me.id, to: target.id, kind: 'gift', icon: item.icon });
      io.to(me.id).emit('me:changed', { notice: `🎁 Đã tặng ${item.icon} ${item.name} cho ${target.username}` });
      io.to(target.id).emit('me:changed', { notice: `🎁 ${me.username} tặng bạn ${item.icon} ${item.name}!` });
    });

    socket.on('disconnect', () => leave(socket.id));
  });
}
