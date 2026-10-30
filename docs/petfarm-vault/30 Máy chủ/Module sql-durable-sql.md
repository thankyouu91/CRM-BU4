---
tags: [petfarm, may-chu, module, sqlite, durable-object]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/sql/durable-sql.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module sql-durable-sql

> [!summary]
> `petdex/server/sql/durable-sql.js` (33 dòng): backend SQLite của Durable Object, bọc `ctx.storage.sql` (API đồng bộ) cho khớp ngữ nghĩa `node:sqlite`.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `openDurableSql(storage)` | `durable-sql.js:4-33` | Trả backend `kind: 'durable-sql'` |

| Phương thức | Dòng | Cách làm |
|---|---|---|
| `get`, `all` | `durable-sql.js:7`, `10-11` | `sql.exec(query, ...params).toArray()` |
| `run` | `durable-sql.js:12-16` | Chạy, rồi `SELECT changes() AS changes, last_insert_rowid() AS id` |
| `exec` | `durable-sql.js:17-22` | Tách nhiều câu bằng `splitStatements`; bỏ `PRAGMA journal_mode` (DO tự quản nhật ký) |
| `transaction` | `durable-sql.js:23-31` | `storage.transactionSync(fn)`; `depth > 0` thì gọi thẳng `fn()` |

## Ai dùng
Chỉ `durable.js:26`.

## Lưu ý
- `run` tốn thêm một truy vấn để lấy `changes`; nhiều chỗ dựa vào `changes === 0` để phát hiện thao tác thất bại (ví dụ `ledger.js:117`, `gifts.js:258`).
- Không có cache câu lệnh (DO tự xử lý).

## Liên quan
- [[Lớp SQL]] · [[Module sql-backend]] · [[Durable Object PetdexPark]]
