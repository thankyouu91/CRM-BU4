// Bộ định tuyến nhỏ cùng API với express.Router, đủ cho các route của game, chạy được cả trên Node.js
// lẫn Cloudflare Workers (không phụ thuộc node:http). Hỗ trợ: get/post/use, tham số `:id`, mẫu bắt tất cả
// `/{*rest}`, middleware với next(), router lồng nhau (use(router)) và error handler 4 tham số.

const CATCH_ALL = /\{\*\w+\}/;

function compile(path, prefix) {
  if (path === '/' || path === '') return { regex: /^/, keys: [] };
  const keys = [];
  const source = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (CATCH_ALL.test(segment)) return '(.*)';
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^/${source}${prefix ? '(?=/|$)' : '/?$'}`), keys };
}

function match(layer, req) {
  const found = layer.regex.exec(req.path);
  if (!found) return null;
  const params = {};
  layer.keys.forEach((key, i) => {
    params[key] = decodeURIComponent(found[i + 1]);
  });
  return params;
}

export function Router() {
  const layers = [];
  const add = (method, path, handlers) => {
    layers.push({ method, ...compile(path, method === null), handlers });
    return router;
  };
  const router = {
    get: (path, ...handlers) => add('GET', path, handlers),
    post: (path, ...handlers) => add('POST', path, handlers),
    use(pathOrHandler, ...rest) {
      const path = typeof pathOrHandler === 'string' ? pathOrHandler : '/';
      const handlers = typeof pathOrHandler === 'string' ? rest : [pathOrHandler, ...rest];
      return add(null, path, handlers.map((h) => (h && typeof h.handle === 'function' ? h.handle : h)));
    },
    /**
     * Chạy request qua các layer theo thứ tự. Trả về khi đã có phản hồi hoặc hết layer; lỗi không
     * có handler nào bắt thì ném ra ngoài. `handle` có thể gắn làm middleware của router cha.
     */
    async handle(req, res, done) {
      let error = null;
      for (const layer of layers) {
        if (res.finished) return;
        if (layer.method && layer.method !== req.method) continue;
        const params = match(layer, req);
        if (!params) continue;
        const savedParams = req.params;
        req.params = { ...savedParams, ...params };
        for (const handler of layer.handlers) {
          if (res.finished) break;
          const isErrorHandler = handler.length === 4;
          if (error ? !isErrorHandler : isErrorHandler) continue;
          let nextCalled = false;
          let nextError = null;
          const next = (err) => {
            nextCalled = true;
            if (err) nextError = err;
          };
          try {
            if (error) {
              const pending = error;
              error = null;
              await handler(pending, req, res, next);
            } else {
              await handler(req, res, next);
            }
          } catch (err) {
            error = err;
            continue;
          }
          if (nextError) error = nextError;
          // Handler không gọi next() và không trả lời (ví dụ router con không khớp): coi như đi tiếp.
          if (!nextCalled && !res.finished && handler.length < 3 && !error) continue;
          if (!nextCalled && !error) break;
        }
        req.params = savedParams;
      }
      if (error) {
        if (done) return done(error);
        throw error;
      }
      if (done && !res.finished) done();
    },
  };
  return router;
}

const BODY_LIMIT = 16 * 1024;

/** Request đơn giản cho router, dựng từ Fetch API Request (Workers) hoặc từ node:http (xem node-server.js). */
export async function buildRequest({ method, url, headers, text, ip = null, prefix = '' }) {
  const parsed = new URL(url, 'http://petdex.local');
  let path = parsed.pathname;
  if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length) || '/';
  const get = (name) => headers.get(String(name).toLowerCase()) ?? undefined;
  const req = { method: method.toUpperCase(), url: parsed.pathname + parsed.search, path, query: Object.fromEntries(parsed.searchParams), params: {}, body: undefined, get, ip };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const raw = await text();
    if (raw.length > BODY_LIMIT) throw Object.assign(new Error('Dữ liệu gửi lên quá lớn.'), { status: 413 });
    if (raw) {
      if (!/application\/json/i.test(get('content-type') ?? '')) throw Object.assign(new Error('Chỉ nhận JSON.'), { type: 'entity.parse.failed' });
      try {
        req.body = JSON.parse(raw);
      } catch {
        throw Object.assign(new Error('JSON không hợp lệ.'), { type: 'entity.parse.failed' });
      }
    }
  }
  return req;
}

/** Response gom lại thành { status, headers, body } khi handler gọi json()/send()/end(). */
export function buildResponse() {
  let resolve;
  const done = new Promise((r) => {
    resolve = r;
  });
  const headers = new Map();
  const res = {
    statusCode: 200,
    finished: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    set(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
      return res;
    },
    json(value) {
      headers.set('content-type', 'application/json; charset=utf-8');
      return res.send(JSON.stringify(value));
    },
    send(body = '') {
      if (res.finished) return res;
      res.finished = true;
      if (!headers.has('content-type')) headers.set('content-type', 'text/plain; charset=utf-8');
      resolve({ status: res.statusCode, headers, body: typeof body === 'string' ? body : String(body) });
      return res;
    },
    end: () => res.send(''),
  };
  return { res, done };
}

/** Chạy một Fetch API Request qua router (Durable Object). `prefix` bị cắt khỏi đường dẫn, ví dụ '/api'. */
export async function handleFetch(router, request, { prefix = '', ip = null } = {}) {
  const { res, done } = buildResponse();
  let req;
  try {
    req = await buildRequest({ method: request.method, url: request.url, headers: request.headers, text: () => request.text(), ip, prefix });
  } catch (err) {
    return Response.json({ error: err.message }, { status: err.status ?? 400 });
  }
  await Promise.race([router.handle(req, res), done]);
  if (!res.finished) res.status(404).json({ error: 'Không tìm thấy.' });
  const out = await done;
  return new Response(out.body, { status: out.status, headers: Object.fromEntries(out.headers) });
}
