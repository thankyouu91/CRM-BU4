---
tags: [petfarm, may-chu, module, lap-lich]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/scheduler.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module scheduler

> [!summary]
> `petdex/server/scheduler.js` (92 dòng): bộ lập lịch toàn cục. `runDue(now)` chạy bù nhịp giá Sàn 10 phút và quyết toán từng ngày chưa đóng; `closeDay(day)` gọi 13 (Chủ nhật: 15) hàm quyết toán theo thứ tự cố định. Chi tiết ở [[Nhịp mỗi phút]] và [[Quyết toán nửa đêm]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `closeDay(day, rand = Math.random)` | `scheduler.js:28-47` | Đóng sổ một ngày |
| `runDue(now = Date.now(), rand)` | `scheduler.js:50-80` | Trả `{ ticks, days }` |
| `startScheduler()` | `scheduler.js:82-92` | Node: chạy ngay rồi `setInterval(30_000)`; trả handle interval |

Hằng: `MAX_CATCH_UP = 3 * DAY` (dòng 20).

## Bảng chạm tới
Trực tiếp chỉ `meta` (`market_tick`, `settled_day`); gián tiếp mọi bảng của các hàm quyết toán.

## Phụ thuộc
`bank` (`centralBankWeek`, `settleBankDay`), `business`, `clans`, `bazaar`, `care`, `contracts`, `credit`, `factory`, `lifecycle`, `town` (`closeWeek`, `settleTaxes`, `weekKey`), `clock`, `db`, `market` (`expireOrders`, `initMarket`, `marketTick`, `pruneHistory`), `rules/market` (`MARKET`), `wallet` (`snapshotNetWorth`) (`scheduler.js:3-18`).

## Ai gọi
`durable.js:42` (`runDue` trong `tick`), `index.js:46` (`startScheduler`), test.

## Lưu ý
- Hàm nhận `rand` để test tái lập; `runDue` truyền `rand` xuống `marketTick` và `closeDay`.
- Xem cảnh báo về transaction và chạy lại ngày ở [[Quyết toán nửa đêm]].

## Liên quan
- [[Nhịp mỗi phút]] · [[Quyết toán nửa đêm]] · [[Đồng hồ và ngày giờ game]]
