---
tags: [petfarm, may-chu, module, durable-object]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/durable.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module durable

> [!summary]
> `petdex/server/durable.js` (68 dòng) định nghĩa lớp `PetdexPark extends DurableObject`, vỏ Cloudflare của máy chủ game. Chi tiết vòng đời và định tuyến ở [[Durable Object PetdexPark]]; note này là thẻ tra cứu nhanh.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `PetdexPark` | `durable.js:23` | Lớp DO: `constructor(ctx, env)` (dòng 24-38), `tick()` (40-46), `alarm()` (48-51), `fetch(request)` (53-67) |

Hằng số: `TICK_MS = 60_000` (dòng 19). Biến mức module `hub` (dòng 21) giữ một hub cho mỗi isolate.

## Phụ thuộc
`cloudflare:workers` (`DurableObject`), `db.ensureSchema`, `hub.{bindWebSocket, createHub}`, `internal.internalApi`, `migrate.migrate`, `playground.attachPlayground`, `router.handleFetch`, `routes.api`, `scheduler.runDue`, `sql/backend.setBackend`, `sql/durable-sql.openDurableSql` (`durable.js:7-17`).

## Ai dùng
`worker.ts:13` re-export để Wrangler tìm thấy lớp; binding `PETDEX` ở `wrangler.jsonc:55-58`.

## Lưu ý
- Constructor gọi `runDue()` đồng bộ trước khi trả lời request đầu tiên.
- Module import `cloudflare:workers`, nên **không** import được trong Node/test; test dùng `index.js` hoặc gọi thẳng các module.

## Liên quan
- [[Durable Object PetdexPark]] · [[Worker và wrangler]] · [[Module index]] · [[Nhịp mỗi phút]]
