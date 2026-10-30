---
tags: [petfarm, may-chu, module, http]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/http.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module http

> [!summary]
> `petdex/server/http.js` (29 dòng): ba tiện ích dùng chung cho mọi router người chơi: middleware xác thực, hàm trả lời "snapshot + kết quả" và hàm đọc số nguyên có kiểm tra.

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `auth(req, res, next)` | `http.js:6-15` | Lấy token sau `Bearer`, `store.userForToken`; 401 nếu không có, 403 nếu `banned`; `touchSeen`; gắn `req.user`, `req.token` |
| `reply(res, userId, result = {})` | `http.js:18-22` | `res.json({ ...snapshot(userId), result: { ...rest, levelUps } })` với `levelUps = levelsGained.map(level => ({ level, reward: levelReward(level) }))`; bỏ `pet` khỏi kết quả |
| `intField(value, label, { min = 1, max })` | `http.js:25-29` | `Number(value)` phải là số nguyên trong khoảng, nếu không ném `GameError('<label> không hợp lệ.')` |

## Bảng dữ liệu
Gián tiếp: `sessions`, `users` (qua `db.userForToken`, `db.touchSeen`).

## Ai gọi
`routes.js`, `routes-economy.js`, `routes-community.js`, `routes-production.js`, `routes-clans.js`.

## Lưu ý
- `reply` gọi `snapshot()` **sau** khi hành động xong (ngoài transaction), nên snapshot luôn phản ánh trạng thái mới.
- `intField` mặc định `min = 1`: muốn nhận 0 phải truyền `{ min: 0 }` (như `plotOf` ở `routes-production.js:50`).

## Liên quan
- [[Module service]] · [[Router]] · [[API người chơi]] · [[Phiên chơi và token]]
