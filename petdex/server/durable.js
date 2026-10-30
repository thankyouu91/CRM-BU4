// Durable Object chạy toàn bộ máy chủ game trên Cloudflare: SQLite của object làm cơ sở dữ liệu, alarm
// mỗi phút thay bộ lập lịch, WebSocket thuần cho công viên. Chỉ có một object tên "park" (worker.ts),
// nên trạng thái mức module (bus, hub) là của riêng nó.
//   /api/*        API game (Worker chuyển từ /ta-tua/api/*)
//   /ws           công viên (Worker chuyển từ /ta-tua/ws)
//   /internal/*   API nội bộ, chỉ gọi được qua stub từ ứng dụng WorkHub (lib/petdex.ts)
import { DurableObject } from 'cloudflare:workers';
import { ensureSchema } from './db.js';
import { bindWebSocket, createHub } from './hub.js';
import { internalApi } from './internal.js';
import { migrate } from './migrate.js';
import { attachPlayground } from './playground.js';
import { handleFetch } from './router.js';
import { api } from './routes.js';
import { runDue } from './scheduler.js';
import { runBots } from './bots.js';
import { setBackend } from './sql/backend.js';
import { openDurableSql } from './sql/durable-sql.js';

const TICK_MS = 60_000;

let hub = null;

export class PetdexPark extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    setBackend(openDurableSql(ctx.storage));
    ensureSchema();
    migrate();
    this.tick();
    if (!hub) {
      hub = createHub();
      attachPlayground(hub);
    }
    this.hub = hub;
    ctx.blockConcurrencyWhile(async () => {
      if ((await ctx.storage.getAlarm()) == null) await ctx.storage.setAlarm(Date.now() + TICK_MS);
    });
  }

  tick() {
    try {
      runDue();
    } catch (err) {
      console.error('Lỗi bộ lập lịch Petdex:', err);
    }
  }

  async alarm() {
    this.tick();
    // Cư dân tự động: một nhóm nhỏ bot mỗi nhịp, qua đúng router của game (không WebSocket, không gọi HTTP).
    try {
      await runBots(api);
    } catch (err) {
      console.error('Lỗi nhịp bot Petdex:', err);
    }
    await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip');
    if (url.pathname === '/ws') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Cần WebSocket.', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      bindWebSocket(this.hub, server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handleFetch(api, request, { prefix: '/api', ip });
    if (url.pathname.startsWith('/internal/')) return handleFetch(internalApi, request, { prefix: '/internal', ip });
    return Response.json({ error: 'Không tìm thấy.' }, { status: 404 });
  }
}
