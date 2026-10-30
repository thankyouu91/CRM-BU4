---
tags: [petfarm, may-chu, thoi-gian]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/clock.js, petdex/server/game.js, petdex/server/town.js, petdex/server/business.js, petdex/server/scheduler.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Đồng hồ và ngày giờ game

> [!summary]
> Mọi mốc "ngày", "tuần", "tháng" của nền kinh tế được tính theo **giờ Việt Nam (UTC+7)** bằng chuỗi khóa ngày dạng `'2026-10-29'`, không phụ thuộc múi giờ của máy chủ. Thời gian lưu trong DB luôn là mili-giây Unix (UTC). Thú cưng có đồng hồ tuổi riêng: 1 ngày thật = 1 tuần tuổi.

## Hằng số và hàm

| Tên | Định nghĩa | Nguồn |
|---|---|---|
| `HOUR` | 3.600.000 ms | `petdex/server/game.js:7` |
| `DAY` | `24 * HOUR` | `petdex/server/game.js:8` |
| `PET_DAY_MS` | `DAY / 7`: một "ngày tuổi" của bé dài 1/7 ngày thật | `petdex/server/game.js:10` |
| `OFFSET` | `7 * HOUR` | `petdex/server/clock.js:4` |
| `dayKey(ts)` | `new Date(ts + OFFSET).toISOString().slice(0, 10)` | `petdex/server/clock.js:7` |
| `startOfDay(key)` | `Date.parse(key + 'T00:00:00Z') - OFFSET` = 00:00 giờ VN | `petdex/server/clock.js:10` |
| `nextDay(key)` | `dayKey(startOfDay(key) + DAY + HOUR)`: cộng thêm 1 giờ cho an toàn | `petdex/server/clock.js:12` |
| `weekday(key)` | Thứ trong tuần của khóa ngày, 0 = Chủ nhật | `petdex/server/clock.js:15` |
| `weekKey(day)` | Khóa tuần = **thứ Hai** của tuần chứa `day` | `petdex/server/town.js:42-45` |
| `ageInfo(bornAt, now)` | `days = floor((now - bornAt) * 7 / DAY)`, `weeks = floor(days / 7)` (nhân trước chia sau để tránh sai số) | `petdex/server/game.js:220-225` |
| Giờ cao điểm quầy | `new Date(t + 7 * HOUR).getUTCHours()` | `petdex/server/business.js:103` |

## Ai dùng khóa nào

| Khóa | Bảng/cột | Ghi bởi |
|---|---|---|
| Ngày (`dayKey`) | `shifts.day`, `orders.day`, `npc_flow.day`, `minigame_days.day`, `networth.day`, `business_days.day`, `factory_days.day`, `tax_days.day`, `quests.day`, `school_log.day`, `garden_help.day`, `friend_likes.day`, `gifts_sent.day`, `gains.day`, `clan_days.day`, `macro_days.day`, `users.daily_day`, `meta.settled_day` | nhiều module |
| Tuần thứ Hai (`weekKey`) | `proposals.week`, `votes.week`, `guild_projects.week`, `clan_donations.week` | `town.js`, `social.js`, `clans.js` |
| Tuần "Chủ nhật" | `central_bank.week` | `scheduler.js:44` truyền thẳng khóa ngày Chủ nhật vào `centralBankWeek(day, end)` |
| Tháng `YYYY-MM` | `clan_tax_refunds.month`, `clan_days.day LIKE 'YYYY-MM-%'` | `clans.js:552`, `680-681` |

> [!warning] Hai kiểu khóa tuần
> `central_bank.week` lưu ngày **Chủ nhật** đóng tuần (`scheduler.js:43-44`), còn mọi bảng tuần khác lưu ngày **thứ Hai** mở tuần (`town.js:42-45`). Đừng join hai nhóm này theo cột `week`.

## Trường hợp đặc biệt
- Ngày bắt đầu lúc 00:00 giờ VN = 17:00 UTC hôm trước. Quyết toán ngày D chạy ở lần `runDue()` đầu tiên sau 00:00 ngày D+1 (trễ tối đa 60 giây trên Durable Object, 30 giây trên Node). Xem [[Quyết toán nửa đêm]].
- Các bút toán quyết toán thường ghi `now: end - 1` (23:59:59.999 của ngày D) để nằm trong ngày D khi báo cáo theo `dayKey` (ví dụ `business.js:331`, `care.js:90`, `clans.js:630`).
- Vitest đặt `TZ: "Asia/Ho_Chi_Minh"` (`vitest.config.ts:7`), nhưng mã server không dựa vào TZ của tiến trình.
- Tuổi thú cưng không theo ngày VN mà theo mili-giây trôi qua từ `born_at`. Xem [[Giai đoạn tuổi]], [[Vòng đời và Đồi Sao]].

## Liên quan
- [[Module clock]] · [[Module game]] · [[Module town]]
- [[Nhịp mỗi phút]] · [[Quyết toán nửa đêm]]
