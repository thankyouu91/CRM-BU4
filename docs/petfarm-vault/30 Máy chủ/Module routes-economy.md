---
tags: [petfarm, may-chu, module, api]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/routes-economy.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module routes-economy

> [!summary]
> `petdex/server/routes-economy.js` (147 dòng): API việc làm, mini-game, Sàn, ngân hàng, ví, tin tức, cài đặt. Đồng thời là nơi định nghĩa **bảng mở khóa theo cấp** `UNLOCKS` và hàm `requireLevel` mà các router khác dùng lại.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `economyApi` | `routes-economy.js:14-15` | Router, `use(auth)` cho mọi route |
| `UNLOCKS` | `routes-economy.js:18-20` | `{ market: 2, school: 2, garden: 2, bank: 3, townhall: 3, guild: 3, kitchen: 3, business: 4, bazaar: 4, factory: 6, contracts: 6, advanced: 8 }` |
| `requireLevel(userId, level, place)` | `routes-economy.js:22-25` | Cấp cao nhất trong các bé phải >= `level` |

## Route (19)
Bảng đầy đủ ở [[API người chơi]] mục "Kinh tế". Chặn cấp: `/market/order` (2), `/bank/savings` và `/bank/deposits` (3), `/settings` bật nâng cao (8).

## Câu lệnh riêng
`newsQuery` (dòng 126): tin `created_at >= now - 3 ngày` và `starts_at <= now`, 40 tin, dùng cho `/news`.

## Nhiệm vụ được báo
`trade` (đặt lệnh Sàn, dòng 78), `save` (gửi tiết kiệm/kỳ hạn, dòng 97, 104).

## Lưu ý
- `UNLOCKS` cũng gửi xuống client trong `/catalog` (`routes.js:72`) kèm `clan: clanConfig().unlockLevel`.
- Các route xem (`GET /market`, `/bank`) không chặn cấp; chỉ hành động mới chặn.

## Liên quan
- [[Mở khóa theo cấp]] · [[Module jobs]] · [[Module market]] · [[Module bank]] · [[Module minigames]] · [[Module wallet]] · [[API người chơi]]
