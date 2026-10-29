// Máy chủ Node.js cho phát triển và chạy độc lập: cùng router, hub và lịch nền như Durable Object,
// trên node:http với gói `ws`. Đường dẫn giống production để client không phải đổi gì:
//   /ta-tua/game/*   file tĩnh của game (public/ta-tua/game)
//   /ta-tua/api/*    API game
//   /ta-tua/ws       công viên (WebSocket)
//   /internal/*      API nội bộ cho WorkHub, cần header x-petdex-internal = PETDEX_INTERNAL_KEY
// Biến môi trường: PORT (3200), PETDEX_DB, PETDEX_INTERNAL_KEY ('dev' ngoài production), PETDEX_OPEN_SIGNUP=1, ADVANCED_FINANCE=off.
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { bindWebSocket, createHub } from './hub.js';
import { internalApi } from './internal.js';
import { migrate } from './migrate.js';
import { attachPlayground } from './playground.js';
import { handleFetch } from './router.js';
import { api } from './routes.js';
import { startScheduler } from './scheduler.js';
import { configure } from './settings.js';

const PORT = Number(process.env.PORT) || 3200;
const INTERNAL_KEY = process.env.PETDEX_INTERNAL_KEY ?? (process.env.NODE_ENV === 'production' ? null : 'dev');
const PUBLIC_DIR = path.resolve(import.meta.dirname, '..', '..', 'public', 'ta-tua', 'game');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };

/** Loài khách mời cài bằng `npx petdex install`, chép vào public/ta-tua/game/pets/<mã>/ (pet.json + spritesheet). */
function scanGuestPets(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => {
    try {
      const meta = JSON.parse(readFileSync(path.join(dir, e.name, 'pet.json'), 'utf8'));
      return [{ id: e.name, displayName: meta.displayName, description: meta.description, spritesheet: meta.spritesheetPath }];
    } catch {
      return [];
    }
  });
}

configure({
  openSignup: process.env.PETDEX_OPEN_SIGNUP === '1',
  advancedFinance: process.env.ADVANCED_FINANCE !== 'off',
  guestPets: scanGuestPets(path.join(PUBLIC_DIR, 'pets')),
});
migrate();
startScheduler();

const hub = createHub();
attachPlayground(hub);

async function toFetchRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
}

async function sendFetchResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/ta-tua\/game\/?/, '')) || 'index.html';
  const file = path.resolve(PUBLIC_DIR, rel.endsWith('/') ? `${rel}index.html` : rel);
  if (!file.startsWith(PUBLIC_DIR)) return notFound(res);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    notFound(res);
  }
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Không tìm thấy.');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/ta-tua' || url.pathname === '/ta-tua/game') {
      res.writeHead(302, { location: '/ta-tua/game/index.html' });
      return res.end();
    }
    if (url.pathname.startsWith('/ta-tua/game/')) return await serveStatic(res, url.pathname);
    if (url.pathname.startsWith('/ta-tua/api/') || url.pathname === '/ta-tua/api') {
      return await sendFetchResponse(res, await handleFetch(api, await toFetchRequest(req), { prefix: '/ta-tua/api', ip: req.socket.remoteAddress }));
    }
    if (url.pathname.startsWith('/internal/')) {
      if (!INTERNAL_KEY || req.headers['x-petdex-internal'] !== INTERNAL_KEY) {
        res.writeHead(403, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Chỉ WorkHub mới gọi được.' }));
      }
      return await sendFetchResponse(res, await handleFetch(internalApi, await toFetchRequest(req), { prefix: '/internal', ip: req.socket.remoteAddress }));
    }
    notFound(res);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Máy chủ gặp sự cố, thử lại sau nhé.' }));
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ta-tua/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => bindWebSocket(hub, ws));
});

server.listen(PORT, () => {
  console.log(`🧋 Petdex Park (Tà tưa) đang chạy: http://localhost:${PORT}/ta-tua/game/index.html`);
});
