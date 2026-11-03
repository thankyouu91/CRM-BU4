---
tags: [petfarm, luat-choi, qua-ngay]
aliases: [Nhận quà ngày, Chuỗi đăng nhập, Daily, Streak]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/routes.js, petdex/server/rules/town.js, petdex/server/town.js, petdex/server/clock.js, petdex/server/service.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Quà ngày

> [!summary]
> Mỗi ngày (giờ Việt Nam) người chơi bấm nút "🎁 Nhận quà ngày" trên thanh trên để nhận xu. Nhận liên tiếp thì **chuỗi** tăng và quà tăng từ 60 lên tối đa 120 xu ở ngày thứ 7; lỡ một ngày thì chuỗi về 1. Bấm quà ngày cũng là lúc trả [[Trợ cấp tân thủ]] cho tài khoản mới.

## Công thức
```
streak = (ngày nhận trước == hôm qua) ? streak + 1 : 1
quà    = 60 + 10 × (min(max(streak, 1), 7) − 1)
```
(`petdex/server/routes.js:151-168`, `petdex/server/rules/town.js:81`.)

## Con số
| Chuỗi | 1 | 2 | 3 | 4 | 5 | 6 | ≥ 7 |
|---|---|---|---|---|---|---|---|
| Xu | 60 | 70 | 80 | 90 | 100 | 110 | 120 |

Tuần đầu đều đặn: 60 + 70 + … + 120 = 630 xu, cộng trợ cấp tân thủ 7 × 30 = 210 (nếu ngân sách thị trấn còn tiền).

## Cách hoạt động
- "Ngày" = `dayKey` theo UTC+7, qua ngày lúc 00:00 giờ Việt Nam (`petdex/server/clock.js:4-12`).
- Nhận rồi: "Hôm nay bạn nhận quà rồi, mai quay lại nhé." (`petdex/server/routes.js:156`).
- Lời báo: "🎁 Quà ngày (chuỗi N ngày): +X 🪙 · trợ cấp tân thủ +Y 🪙" (`petdex/server/routes.js:164`). Ghi sổ loại `daily`, ghi chú "Chuỗi N ngày".
- `snapshot.user.dailyReadyAt` = 00:00 ngày mai nếu hôm nay đã nhận, 0 nếu chưa (`petdex/server/service.js:31`).
- Nút trên thanh trên: "🎁 Nhận quà ngày · 🔥N" khi nhận được, "⏳ Quà sau <thời gian>" khi chờ; chú thích "Chuỗi đăng nhập N ngày. Nhận liên tiếp mỗi ngày để quà tăng dần tới 120 xu." (`public/ta-tua/game/js/app.js:270-277`). Ô Nhà trên bản đồ có huy hiệu "Có quà ngày!" (`public/ta-tua/game/js/views/map.js:48`).
- Chuỗi cũng hiện ở bảng nhiệm vụ: "🔥 Chuỗi đăng nhập N ngày" (`public/ta-tua/game/js/views/map.js:78`).

## Trường hợp đặc biệt
- Chuỗi tính theo **ngày nhận quà**, không theo việc mở game; mở game mà quên bấm vẫn đứt chuỗi.
- `RULES.dailyReward = 60` và `dailyCooldownMs = 20 giờ` trong `petdex/server/game.js:16-17` là hằng số cũ, không còn được dùng.
- Quà ngày không cần có bé.

## Liên quan
- [[Trợ cấp tân thủ]] · [[Nhiệm vụ ngày]] · [[Đồng hồ và ngày giờ game]] · [[Thanh điều hướng và menu tài khoản]] · [[Dòng xu trong game]]
