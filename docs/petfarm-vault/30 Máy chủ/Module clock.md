---
tags: [petfarm, may-chu, module, thoi-gian]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/clock.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module clock

> [!summary]
> `petdex/server/clock.js` (15 dòng): bốn hàm đổi giữa mốc ms và khóa ngày theo giờ Việt Nam. Toàn bộ quy ước thời gian ở [[Đồng hồ và ngày giờ game]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `dayKey(ts)` | `clock.js:7` | ms -> `'YYYY-MM-DD'` giờ VN |
| `startOfDay(key)` | `clock.js:10` | khóa -> ms lúc 00:00 giờ VN |
| `nextDay(key)` | `clock.js:12` | khóa ngày hôm sau |
| `weekday(key)` | `clock.js:15` | 0 = Chủ nhật ... 6 = thứ Bảy |

Phụ thuộc `DAY`, `HOUR` từ `game.js` (`clock.js:2`).

## Ai gọi
21 module, gồm `scheduler`, `market`, `town`, `clans`, `business`, `factory`, `jobs`, `quests`, `service`, `wallet`... (xem đồ thị ở [[Kiến trúc máy chủ]]).

## Lưu ý
- So sánh chuỗi khóa ngày bằng `<` là đúng thứ tự thời gian (định dạng ISO), được dùng ở `scheduler.js:73` và các câu SQL `day < ?`.
- `weekKey` (thứ Hai của tuần) nằm ở `town.js:42`, không ở đây.

## Liên quan
- [[Đồng hồ và ngày giờ game]] · [[Module scheduler]] · [[Module town]]
