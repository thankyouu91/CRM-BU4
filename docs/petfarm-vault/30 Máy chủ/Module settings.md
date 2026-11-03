---
tags: [petfarm, may-chu, module, cau-hinh]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/settings.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module settings

> [!summary]
> `petdex/server/settings.js` (13 dòng): cài đặt do vỏ máy chủ đặt lúc khởi động, thay cho biến môi trường (Workers không có `process.env`).

## Exports
| Tên | Dòng | Mặc định | Ý nghĩa |
|---|---|---|---|
| `settings.openSignup` | `settings.js:4` | `false` | Cho `/auth/register`, `/auth/login` gốc. WorkHub tắt: người chơi vào bằng SSO, link khách hoặc tài khoản `play.petfarm.online` qua [[API nội bộ]] |
| `settings.advancedFinance` | `settings.js:6` | `true` | Cho phép bật Tài chính nâng cao và vay |
| `settings.guestPets` | `settings.js:8` | `[]` | Loài khách mời `{ id, displayName, description, spritesheet }` |
| `configure(overrides)` | `settings.js:11-13` | | `Object.assign` vào `settings` |

## Ai đọc
`routes.js` (`/catalog`, đăng ký), `routes-economy.js:140` (`/settings`), `routes-production.js:151` (`/credit/borrow`), `species.js:10` (loài khách mời). Ai ghi: chỉ `index.js:40-44`.

## Lưu ý
Production (Durable Object) không gọi `configure`, nên luôn là mặc định: đăng ký gốc tắt, tài chính nâng cao bật, không có loài khách mời (`species.js:5-7` cũng nói rõ trên Cloudflare không có hệ thống file).

## Liên quan
- [[Module index]] · [[Module species]] · [[Tín dụng và vay]]
