// Kết nối công viên bằng WebSocket thuần, cùng API con mà park.js dùng của socket.io:
// io({ auth }) → { on, emit, disconnect, removeAllListeners }; sự kiện connect, connect_error, disconnect.
// Khung tin JSON [event, payload]; khung đầu tiên gửi đi là ['auth', auth]. Tự nối lại khi rớt mạng.
import { wsUrl } from './api.js';

export function io({ auth = {} } = {}) {
  const handlers = new Map();
  let ws = null;
  let closedByUser = false;
  let attempt = 0;
  let timer = 0;

  const fire = (event, payload) => {
    for (const fn of handlers.get(event) ?? []) fn(payload);
  };

  function open() {
    ws = new WebSocket(wsUrl());
    ws.onopen = () => ws.send(JSON.stringify(['auth', auth]));
    ws.onmessage = (ev) => {
      let frame;
      try {
        frame = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!Array.isArray(frame)) return;
      const [event, payload] = frame;
      if (event === 'connect') attempt = 0;
      if (event === 'connect_error') return fire('connect_error', new Error(payload?.message ?? 'Không kết nối được.'));
      fire(event, payload);
    };
    ws.onclose = () => {
      ws = null;
      if (closedByUser) return fire('disconnect', 'io client disconnect');
      fire('disconnect', 'transport close');
      timer = setTimeout(open, Math.min(10_000, 500 * 2 ** attempt++));
    };
    ws.onerror = () => {};
  }

  const socket = {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
      return socket;
    },
    emit(event, payload) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify([event, payload ?? null]));
      return socket;
    },
    disconnect() {
      closedByUser = true;
      clearTimeout(timer);
      ws?.close(1000, 'bye');
    },
    removeAllListeners() {
      handlers.clear();
    },
  };
  open();
  return socket;
}
