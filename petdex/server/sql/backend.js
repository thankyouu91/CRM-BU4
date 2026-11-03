// Lớp truy cập SQLite dùng chung cho mọi module của game. Các module gọi `db.prepare(sql)` ở mức
// module rồi `.get/.all/.run` khi cần, như node:sqlite; câu lệnh chỉ được biên dịch khi chạy lần đầu,
// nên import được trước khi mở cơ sở dữ liệu. Backend thật được cắm vào bằng `setBackend`:
// node-sqlite.js (Node.js: máy chủ dev, test, mô phỏng) hoặc durable-sql.js (Cloudflare Durable Object).

let backend = null;

export function setBackend(next) {
  backend = next;
}

export function hasBackend() {
  return backend !== null;
}

function current() {
  if (!backend) throw new Error('Chưa mở cơ sở dữ liệu của Petdex (gọi setBackend trước).');
  return backend;
}

class Statement {
  constructor(sql) {
    this.sql = sql;
  }
  get(...params) {
    return current().get(this.sql, params);
  }
  all(...params) {
    return current().all(this.sql, params);
  }
  /** Trả về { changes, lastInsertRowid } như node:sqlite. */
  run(...params) {
    return current().run(this.sql, params);
  }
}

export const db = {
  prepare: (sql) => new Statement(sql),
  exec: (sql) => current().exec(sql),
};

/** Chạy fn trong một transaction; gọi lồng nhau thì dùng chung transaction ngoài cùng. */
export function transaction(fn) {
  return current().transaction(fn);
}

/** Tách một đoạn SQL nhiều câu lệnh thành từng câu (lược đồ không có dấu ; trong chuỗi). */
export function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/^\s*--[^\n]*\n/gm, '').trim())
    .filter(Boolean);
}
