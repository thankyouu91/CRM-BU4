---
tags: [petfarm, may-chu, module, sqlite]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/sql/backend.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module sql-backend

> [!summary]
> `petdex/server/sql/backend.js` (53 dòng): mặt tiền SQL dùng chung. Module game gọi `db.prepare(sql)` ở mức module; câu lệnh chỉ chạy khi `.get/.all/.run` và chuyển cho backend đang cắm. Bức tranh ở [[Lớp SQL]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `setBackend(next)` | `backend.js:8-10` | Cắm backend (`node-sqlite` hoặc `durable-sql`) |
| `hasBackend()` | `backend.js:12-14` | `db.js` dùng để quyết định có tự mở `node:sqlite` không |
| `db` | `backend.js:37-40` | `{ prepare: sql => new Statement(sql), exec: sql => backend.exec(sql) }` |
| `transaction(fn)` | `backend.js:43-45` | Ủy quyền cho backend (lồng nhau dùng chung) |
| `splitStatements(sql)` | `backend.js:48-53` | Tách theo `;` cuối dòng, bỏ dòng `--` |

Lớp nội bộ `Statement` (dòng 21-35): `get(...params)`, `all(...params)`, `run(...params)` -> `{ changes, lastInsertRowid }`.

## Hợp đồng backend
Một backend phải có `get(sql, params)`, `all(sql, params)`, `run(sql, params)`, `exec(sql)`, `transaction(fn)` và nên có `kind`.

## Ai dùng
`db.js` (re-export `db`, `transaction`), `durable.js` (`setBackend`), `durable-sql.js` (`splitStatements`).

## Liên quan
- [[Lớp SQL]] · [[Module sql-durable-sql]] · [[Module sql-node-sqlite]] · [[Module db]]
