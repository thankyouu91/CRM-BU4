---
tags: [petfarm, may-chu, module, sqlite, node]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/sql/node-sqlite.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module sql-node-sqlite

> [!summary]
> `petdex/server/sql/node-sqlite.js` (50 dòng): backend `node:sqlite` (`DatabaseSync`, Node >= 22.13) cho máy chủ dev, test và mô phỏng. Hỗ trợ file hoặc `':memory:'`.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `openNodeSqlite(file)` | `node-sqlite.js:6-50` | `async`; tạo thư mục chứa file nếu cần, mở DB, bật `journal_mode = WAL` và `foreign_keys = ON`, trả backend `kind: 'node-sqlite'` có thêm `close()` |

Chi tiết: cache câu lệnh theo chuỗi SQL (`node-sqlite.js:11-19`), `exec` xóa cache (dòng 29-32), `transaction` bằng `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` với bộ đếm độ sâu (dòng 33-47).

## Ai dùng
`db.js:763-765` khi không chạy trên Workers và chưa có backend; file mặc định `petdex/data/petdex.db` hoặc `process.env.PETDEX_DB`.

## Lưu ý
Nạp `node:sqlite`, `node:fs`, `node:path` bằng `import()` với chuỗi tính toán và `/* @vite-ignore */` (dòng 4) để bundler của Workers không biến chúng thành import tĩnh.

## Liên quan
- [[Lớp SQL]] · [[Module sql-backend]] · [[Module db]] · [[Kiểm thử petdex]]
