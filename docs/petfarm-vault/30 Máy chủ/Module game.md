---
tags: [petfarm, may-chu, module, thu-cung, luat]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/game.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module game

> [!summary]
> `petdex/server/game.js` (326 dòng): **luật thú cưng thuần** (không đụng DB/HTTP): hằng thời gian, danh mục vật phẩm `ITEMS`, lớp lỗi `GameError`, mô phỏng chỉ số theo thời gian (`tick`), hành động chăm/chơi, lên cấp, tuổi và mô tả bé gửi client. Số liệu luật thuộc [[Chỉ số của bé]], [[Cấp độ và XP]], [[Giai đoạn tuổi]], [[Siêu thị]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `HOUR`, `DAY`, `PET_DAY_MS` | `game.js:7-10` | Hằng thời gian ([[Đồng hồ và ngày giờ game]]) |
| `RULES` | `game.js:12-18` | `startCoins` 150, `adoptCost` 200, `maxPets` 4, `dailyReward` 60, `dailyCooldownMs` 20 giờ (hai mục cuối không còn được dùng: quà ngày theo `dailyReward(streak)` của `rules/town.js`) |
| `STAGES` | `game.js:24-31` | 6 giai đoạn theo ngày tuổi (0, 14, 56, 147, 280, 490), `scale` cho ảnh khách mời |
| `ITEMS` | `game.js:132` | `CATALOG` (dòng 40-114) + `id`: đồ ăn, chăm sóc, đồ chơi, trang phục (`wearables()`, tên/khe/hành lấy từ `shared/pets.js`), trứng (`eggs()`) |
| `isConsumable(item)` | `game.js:135` | `food` hoặc `care` |
| `GameError` | `game.js:138` | Lỗi người chơi ([[Lỗi và thông báo lỗi]]) |
| `clamp(v, lo = 0, hi = 100)` | `game.js:140` | |
| `busyKind(pet, now)` | `game.js:143` | `work`/`school`/`bath` hoặc null |
| `tick(pet, now)` | `game.js:156-184` | Tính chỉ số hiện tại từ `updated_at`: no bụng, vui, năng lượng, sạch sẽ, sức khỏe; tách giờ bận (ca làm, lớp học hao sức, tắm thì như rảnh) |
| `rollSickness(pet, hours, rand)` | `game.js:187-193` | Sức khỏe dưới ngưỡng lâu thì có thể ốm `cold`/`stomach` |
| `bathe(pet, now)` | `game.js:196-203` | Tắm miễn phí, bận 15 phút, +2 XP |
| `requireHealthy(pet, what)` | `game.js:205-207` | Chặn hành động khi ốm |
| `isBusy`, `applyEffect`, `xpToNext(level) = 80 + (level - 1) * 40`, `levelReward(level) = 20 + level * 10` | `game.js:209-218` | |
| `ageInfo`, `stageRules`, `lifeOf`, `stageIndex` | `game.js:220-239` | Tuổi, luật giai đoạn (`LIFE_STAGES` trong `shared/pets.js`), tuổi thọ còn lại |
| `mood(pet)` | `game.js:241-249` | `sick`, `hungry` (<20), `dirty` (<20), `tired` (<15), `sad` (<25), `great`/`ok` |
| `boostEffect(pet, effect)` | `game.js:254-258` | % "Chỉ số" của trang phục làm phần cộng mạnh hơn |
| `useItem(pet, item)`, `play(pet, toy)`, `cuddle(pet)` | `game.js:260-285` | Hành động trả `{ pet, xp, coins }` |
| `settle({ pet, xp, coins })` | `game.js:288-299` | Lên nhiều cấp một lúc, cộng `levelReward` mỗi cấp, trả `levelsGained` |
| `describePet(row, now)` | `game.js:301-326` | Bản mô tả gửi client (gồm `age`, `mood`, `busyUntil`, `busyKind`, `life`) |

## Ai dùng
Gần như mọi module (37 file import); `db.js` dùng `GameError`; `clock.js` dùng `DAY`, `HOUR`.

## Lưu ý
> [!warning] Vòng import
> `game.js` import `rules/production.js` -> `rules/market.js` -> `game.js` (`DAY`). Chạy được vì `DAY` chỉ được đọc khi gọi hàm, không lúc nạp module. Đừng dùng hằng của `game.js` ở mức module trong `rules/market.js` hay `rules/production.js` (`rules/production.js:4` đã tự định nghĩa `clamp` vì lý do này).

- Mọi hàm hành động là thuần: lưu DB và ghi sổ do [[Module service]] (`mutatePet`) đảm nhận.
- `tick` trả `updated_at: max(pet.updated_at, now)`, nên gọi với `now` cũ hơn không làm lùi thời gian.

## Liên quan
- [[Module service]] · [[Module rules-production]] · [[Chỉ số của bé]] · [[Chăm sóc ở nhà]] · [[Đồ ăn và đồ chăm sóc]] · [[Giai đoạn tuổi]]
