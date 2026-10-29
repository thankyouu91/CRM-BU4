// Backend node:sqlite (Node.js >= 22.13): máy chủ dev, test và mô phỏng. File hoặc ':memory:'.
// Các module Node được nạp bằng chuỗi tính toán để trình đóng gói của Workers không kéo chúng
// thành import tĩnh (workerd không có node:sqlite; module này không bao giờ chạy ở đó).
const load = (name) => import(/* @vite-ignore */ `node:${name}`);

/** `target`: đường dẫn file, URL file: (đổi bằng fileURLToPath, vì `.pathname` hỏng trên Windows) hoặc ':memory:'. */
export async function openNodeSqlite(target) {
  const [{ DatabaseSync }, { mkdirSync }, path, { fileURLToPath }] = await Promise.all([load('sqlite'), load('fs'), load('path'), load('url')]);
  const file = target instanceof URL ? fileURLToPath(target) : target;
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const native = new DatabaseSync(file);
  native.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) {
      s = native.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  let depth = 0;
  return {
    kind: 'node-sqlite',
    get: (sql, params) => stmt(sql).get(...params),
    all: (sql, params) => stmt(sql).all(...params),
    run(sql, params) {
      const r = stmt(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
    exec(sql) {
      native.exec(sql);
      cache.clear();
    },
    transaction(fn) {
      if (depth > 0) return fn();
      native.exec('BEGIN IMMEDIATE');
      depth += 1;
      try {
        const result = fn();
        native.exec('COMMIT');
        return result;
      } catch (err) {
        native.exec('ROLLBACK');
        throw err;
      } finally {
        depth -= 1;
      }
    },
    close: () => native.close(),
  };
}
