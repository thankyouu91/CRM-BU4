---
tags: [petfarm, may-chu, module, vong-doi]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/lifecycle.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module lifecycle

> [!summary]
> `petdex/server/lifecycle.js` (132 dòng): vòng đời thú cưng: theo dõi sức khỏe trung bình cả đời, tiễn bé hết tuổi thọ về Đồi Sao lúc nửa đêm, kỷ vật cho bé kế tiếp, ô tưởng niệm và phí mở lại. Luật: [[Vòng đời và Đồi Sao]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `slotsOf(userId)` | `lifecycle.js:50-54` | `{ max: 4, used = bé + trứng đang ấp + ô khóa, free, locked, reopenCost = indexedPrice(LIFE.reopenCost) }` |
| `takeHeirloom(userId, now)` | `lifecycle.js:57-62` | Kỷ vật cũ nhất chưa dùng -> `{ skill, amount: LIFE.heirloom, from }` |
| `settleLifeDay(day)` | `lifecycle.js:100-112` | Mỗi bé: `tick` tới nửa đêm, cập nhật `health_avg` (trung bình cộng dồn) và `health_days`; hết tuổi thọ và không đang bận thì `passAway(row, end - 1)` |
| `reopenSlot(userId, now)` | `lifecycle.js:115-123` | Trừ phí (sổ `slot_reopen`), `locked_slots - 1` |
| `memorialsView(userId, scope)` | `lifecycle.js:125-128` | 30 bia của mình hoặc 40 bia toàn phố |
| `recentMemorials(userId, now)` | `lifecycle.js:131` | Bé mất trong 3 ngày (cho màn Nhà báo tin) |

## `passAway(row, at)` (nội bộ, dòng 65-94)
1. Trả nốt lương các ca chưa nhận (sổ `salary`), đánh dấu ca đã nhận.
2. Lập bia `memorials` (kỹ năng làm tròn, đồ đeo, tính cách, kỷ vật = sở trường loài hoặc kỹ năng cao nhất).
3. `DELETE FROM pets` (cascade kỹ năng, nghề, ca làm, đồ đeo).
4. Đổi bé chính nếu cần; `bus.emit('pet:changed')`.
5. Bé cuối cùng và không có trứng: tặng trứng `thuong` cùng hành, nở sau `LIFE.memorialEggDays` ngày, không khóa ô. Ngược lại `locked_slots + 1`.
6. Đăng tin "đã về với sao trời sau N tuần" 2 ngày.

## Bảng
`pets`, `shifts`, `pet_skills`, `pet_wear`, `memorials`, `users.locked_slots`, `eggs`, `news`, `ledger`.

## Ai gọi
`scheduler.closeDay` (`settleLifeDay`), `routes.js` (`slotsOf`, `reopenSlot`, `memorialsView`), `eggs.js`, `internal.js`, `service.snapshot`.

## Lưu ý
- Trang phục (`gear`) đang đeo **không** bị xóa khi bé mất: chỉ `pet_wear` bị cascade, món về tủ đồ.
- Bé đang dở ca được hoãn sang đêm sau (`!isBusy(row, end)`).

## Liên quan
- [[Vòng đời và Đồi Sao]] · [[Module eggs]] · [[Quyết toán nửa đêm]]
