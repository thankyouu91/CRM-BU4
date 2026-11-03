---
tags: [petfarm, may-chu, module, node]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/index.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module index

> [!summary]
> `petdex/server/index.js` (120 dòng) là điểm vào **Node.js** cho phát triển và chạy độc lập: cùng router, hub và bộ lập lịch như [[Durable Object PetdexPark]], nhưng trên `node:http` và gói `ws`. Đường dẫn giống production để client không phải đổi gì. Không export gì; chạy bằng `npm run petdex:dev`.

## Khởi động (theo thứ tự)
| Bước | Dòng | Ghi chú |
|---|---|---|
| Import `db.js` gián tiếp | `index.js:13-20` | `db.js` tự mở `node:sqlite` và `ensureSchema()` khi import (`db.js:762-767`) |
| `configure({...})` | `index.js:40-44` | `openSignup` = `PETDEX_OPEN_SIGNUP === '1'`; `advancedFinance` = `ADVANCED_FINANCE !== 'off'`; `guestPets` = quét `public/ta-tua/game/pets/*/pet.json` (`scanGuestPets`, dòng 28-38) |
| `migrate()` | `index.js:45` | [[Migration]] |
| `startScheduler()` | `index.js:46` | `runDue` ngay rồi mỗi 30 giây ([[Nhịp mỗi phút]]) |
| `createHub()` + `attachPlayground(hub)` | `index.js:48-49` | [[Hub WebSocket]] |
| `server.listen(PORT)` | `index.js:118-120` | `PORT` mặc định 3200 |

## Định tuyến HTTP (`index.js:85-109`)
| Đường dẫn | Xử lý |
|---|---|
| `/`, `/ta-tua`, `/ta-tua/game` | 302 về `/ta-tua/game/index.html` |
| `/ta-tua/game/*` | `serveStatic`: file trong `public/ta-tua/game`, chặn thoát thư mục (`file.startsWith(PUBLIC_DIR)`), `cache-control: no-cache`, MIME theo bảng dòng 25 |
| `/ta-tua/api`, `/ta-tua/api/*` | `toFetchRequest` -> `handleFetch(api, ..., { prefix: '/ta-tua/api', ip })` |
| `/internal/*` | Kiểm header `x-petdex-internal` = `INTERNAL_KEY` (403 nếu sai hoặc production không đặt khóa) rồi `handleFetch(internalApi, ..., { prefix: '/internal' })` |
| khác | 404 text |
| WS upgrade `/ta-tua/ws` | `wss.handleUpgrade` -> `bindWebSocket(hub, ws)`; đường khác bị `socket.destroy()` (`index.js:111-116`) |

Biến môi trường (`index.js:7`): `PORT`, `PETDEX_DB`, `PETDEX_INTERNAL_KEY` (ngoài production có khóa mặc định cho dev), `PETDEX_OPEN_SIGNUP=1`, `ADVANCED_FINANCE=off`.

## Lưu ý
- `toFetchRequest` chỉ chép header dạng chuỗi (`index.js:57`), bỏ header mảng như `set-cookie`.
- `INTERNAL_KEY` null trong production nếu không đặt biến: mọi `/internal` bị 403 (`index.js:23`, `97`).
- Đây là nơi duy nhất gọi `configure()`; trên Workers dùng mặc định của [[Module settings]].

## Liên quan
- [[Kiến trúc máy chủ]] · [[Module durable]] · [[Module router]] · [[Module hub]] · [[Module scheduler]] · [[Kiểm thử petdex]]
