// Hub thời gian thực cùng API với phần socket.io mà playground.js dùng (io.use, io.on('connection'),
// io.to(room).emit, socket.on/emit/join/to/disconnect, io.sockets.sockets), chạy trên WebSocket thuần.
// Khung tin là JSON `[event, payload]`. Kết nối mở xong phải gửi ['auth', { token }] trước; hub trả
// ['connect', { id }] hoặc ['connect_error', { message }] rồi đóng. Transport (Node `ws` hoặc
// WebSocketPair của Durable Object) chỉ cần { send(text), close() } và gọi lại message/closed.

let counter = 0;
const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createHub() {
  const sockets = new Map(); // id -> socket
  const rooms = new Map(); // room -> Set(id)
  const middlewares = [];
  const connectionHandlers = [];

  const sendTo = (id, event, payload) => {
    const s = sockets.get(id);
    if (!s) return;
    try {
      s.transport.send(JSON.stringify([event, payload ?? null]));
    } catch {
      // đường truyền vừa đứt: disconnect sẽ dọn
    }
  };
  const idsOf = (target) => (rooms.has(target) ? [...rooms.get(target)] : sockets.has(target) ? [target] : []);
  const emitTo = (ids, event, payload, except) => {
    for (const id of ids) if (id !== except) sendTo(id, event, payload);
  };

  function makeSocket(transport, auth) {
    const handlers = new Map();
    const socket = {
      id: newId(),
      data: {},
      handshake: { auth },
      transport,
      connected: true,
      on(event, fn) {
        if (!handlers.has(event)) handlers.set(event, []);
        handlers.get(event).push(fn);
        return socket;
      },
      emit: (event, payload) => sendTo(socket.id, event, payload),
      join(room) {
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(socket.id);
      },
      to: (room) => ({ emit: (event, payload) => emitTo(idsOf(room), event, payload, socket.id) }),
      disconnect(close = true) {
        if (!socket.connected) return;
        hub.closed(socket);
        if (close) {
          try {
            transport.close();
          } catch {
            // đã đóng
          }
        }
      },
      _dispatch(event, payload) {
        for (const fn of handlers.get(event) ?? []) fn(payload);
      },
    };
    return socket;
  }

  const hub = {
    use: (fn) => middlewares.push(fn),
    on(event, fn) {
      if (event === 'connection') connectionHandlers.push(fn);
    },
    to: (target) => ({ emit: (event, payload) => emitTo(idsOf(target), event, payload) }),
    sockets: { sockets },

    /** Transport nhận được khung đầu tiên ['auth', auth]: chạy middleware rồi mở kết nối. Trả socket hoặc null. */
    connect(transport, auth) {
      const socket = makeSocket(transport, auth ?? {});
      let failed = null;
      for (const mw of middlewares) {
        let called = false;
        mw(socket, (err) => {
          called = true;
          if (err) failed = err;
        });
        if (!called || failed) break;
      }
      if (failed) {
        try {
          transport.send(JSON.stringify(['connect_error', { message: failed.message }]));
          transport.close();
        } catch {
          // bỏ qua
        }
        return null;
      }
      sockets.set(socket.id, socket);
      for (const fn of connectionHandlers) fn(socket);
      sendTo(socket.id, 'connect', { id: socket.id });
      return socket;
    },

    /** Một khung tin từ client đã kết nối. */
    message(socket, text) {
      if (!socket?.connected) return;
      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        return;
      }
      if (!Array.isArray(frame) || typeof frame[0] !== 'string') return;
      socket._dispatch(frame[0], frame[1]);
    },

    /** Đường truyền đóng (hoặc server chủ động ngắt). */
    closed(socket) {
      if (!socket?.connected) return;
      socket.connected = false;
      sockets.delete(socket.id);
      for (const set of rooms.values()) set.delete(socket.id);
      socket._dispatch('disconnect', 'transport close');
    },

    /** Đọc khung ['auth', auth] đầu tiên; trả auth hoặc null nếu không phải. */
    parseAuth(text) {
      try {
        const frame = JSON.parse(text);
        return Array.isArray(frame) && frame[0] === 'auth' ? frame[1] ?? {} : null;
      } catch {
        return null;
      }
    },
  };
  return hub;
}

/**
 * Gắn một WebSocket (Workers hoặc `ws`) vào hub: khung đầu tiên là auth, các khung sau là sự kiện.
 * `ws` cần addEventListener('message'|'close'|'error'), send(), close().
 */
export function bindWebSocket(hub, ws) {
  let socket = null;
  const transport = { send: (text) => ws.send(text), close: () => ws.close(1000, 'bye') };
  ws.addEventListener('message', (ev) => {
    const text = typeof ev.data === 'string' ? ev.data : '';
    if (socket) return hub.message(socket, text);
    const auth = hub.parseAuth(text);
    if (!auth) return transport.close();
    socket = hub.connect(transport, auth);
  });
  const end = () => {
    if (socket) hub.closed(socket);
    socket = null;
  };
  ws.addEventListener('close', end);
  ws.addEventListener('error', end);
}
