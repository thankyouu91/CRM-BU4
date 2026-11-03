// Backend SQLite của Cloudflare Durable Object (ctx.storage.sql): API đồng bộ, cùng ngữ nghĩa với node:sqlite.
import { splitStatements } from './backend.js';

export function openDurableSql(storage) {
  const sql = storage.sql;
  let depth = 0;
  const rows = (query, params) => sql.exec(query, ...params).toArray();
  return {
    kind: 'durable-sql',
    get: (query, params) => rows(query, params)[0],
    all: rows,
    run(query, params) {
      rows(query, params);
      const [{ changes, id }] = sql.exec('SELECT changes() AS changes, last_insert_rowid() AS id').toArray();
      return { changes: Number(changes), lastInsertRowid: Number(id) };
    },
    exec(query) {
      for (const statement of splitStatements(query)) {
        if (/^PRAGMA\s+journal_mode/i.test(statement)) continue; // Durable Object tự quản lý nhật ký
        sql.exec(statement);
      }
    },
    transaction(fn) {
      if (depth > 0) return fn();
      depth += 1;
      try {
        return storage.transactionSync(fn);
      } finally {
        depth -= 1;
      }
    },
  };
}
