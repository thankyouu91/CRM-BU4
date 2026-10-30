---
tags: [petfarm, luat-choi, cham-soc]
aliases: [Cho ăn, Chơi đùa, Tắm, Màn Nhà hành động]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/game.js, petdex/server/routes.js, petdex/server/care.js, petdex/server/service.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Chăm sóc ở nhà

> [!summary]
> Ở màn Nhà người chơi có các nút 🍽️ Cho ăn, 🎾 Chơi đùa, 🛁 Tắm, 💊 Chăm sóc, 🎀 Trang phục, 💼 Đi làm, ⭐ Chọn thú chính / 🌳 Ra công viên, 🩺 Phòng khám. Đây là vòng lặp chăm sóc cơ bản: giữ [[Chỉ số của bé]] trên ngưỡng, kiếm XP và vài xu. Mọi hành động đi qua `mutatePet` nên đều được tính lại chỉ số, có thể đổ bệnh, cộng XP và lên cấp.

## Cách hoạt động
Các nút hành động: `public/ta-tua/game/js/app.js:532-545`.

| Nút | API | Điều kiện | Hiệu quả | XP | Xu | Nguồn |
|---|---|---|---|---|---|---|
| 🍽️ Cho ăn | `POST /pets/:id/use` | có món trong túi; No bụng < 97 | theo món ([[Đồ ăn và đồ chăm sóc]]) | món × hợp mệnh × Tham ăn | 0 | `petdex/server/routes.js:211-229`, `petdex/server/game.js:260-266` |
| 💊 Chăm sóc | `POST /pets/:id/use` | có món chăm sóc | theo món | món × hợp mệnh | 0 | như trên |
| 🎾 Chơi đùa | `POST /pets/:id/play` | không bận; NL ≥ 15; No ≥ 10; đồ chơi phải có trong túi | NL −15, No −5, Sạch −5, Vui +12 (+ đồ chơi) × 1,5 nếu Ham chơi | 10 + đồ chơi | +4 | `petdex/server/routes.js:231-251`, `petdex/server/game.js:268-280` |
| 🛁 Tắm | `POST /pets/:id/bath` | không bận | Sạch +100, Vui +5; bé bận 15 phút | 2 | 0 | `petdex/server/routes-production.js:28`, `petdex/server/care.js:25-29`, `petdex/server/game.js:196-203` |
| ⭐ Chọn thú chính | `POST /pets/:id/active` | bé của mình | đổi [[Thú chính]] | 0 | 0 | `petdex/server/routes.js:204-209` |

Sau mỗi hành động, XP được nhân hệ số [[Hành vượng]] (×1,1) và hệ số tuổi ([[Giai đoạn tuổi]]) rồi làm tròn (`petdex/server/service.js:70-71`). Thưởng lên cấp ghi sổ riêng loại `level` ([[Cấp độ và XP]]).

## Công thức
```
XP cho ăn = round( xp_món × (Tham ăn và là đồ ăn ? 1,3 : 1) × (1 + 0,2 nếu hợp mệnh) )
XP cuối   = round( XP × (hành vượng ? 1,1 : 1) × stage.xp )
Vui khi chơi = round( (12 + toy.happiness) × (Ham chơi ? 1,5 : 1) × (1 + %Chỉ số/100) )
```
(`petdex/server/game.js:264,274-276`, `petdex/server/service.js:70`.) "Hợp mệnh" = món cùng hành hoặc tương sinh với hành của bé ([[Hợp mệnh và kỵ mệnh]]); áp cho cả đồ ăn lẫn đồ chăm sóc vì cả hai đều có hành.

## Trường hợp đặc biệt
- **Cho ăn và dùng đồ chăm sóc không kiểm tra bé đang bận**: có thể cho bé ăn khi bé đang đi làm (`useItem` không gọi `isBusy`, `petdex/server/game.js:260-266`).
- Đồ chăm sóc vẫn dùng được khi No bụng ≥ 97 (chỉ đồ ăn bị chặn).
- Tắm ở nhà miễn phí và khác món 🛁 Tắm bong bóng (35 xu) ở [[Siêu thị]]. Trong 15 phút tắm, chỉ số tính như rảnh, bé vẫn hiện ở nhà (`public/ta-tua/game/js/app.js:553`).
- Chơi đùa luôn +4 xu, không giới hạn số lần/ngày; giới hạn thực tế là năng lượng (−15 mỗi lần, hồi +12/giờ).
- Lỗi người chơi thấy: "… no căng bụng rồi!", "… mệt quá, để bé nghỉ chút đã.", "… đói quá, không chơi nổi.", "… đang đi làm, xong rồi chơi nhé." (`petdex/server/game.js:262,270-272`).
- Mỗi lần cho ăn đồ ăn (không phải đồ chăm sóc) cộng tiến độ nhiệm vụ `feed`; chơi đùa cộng `play`; tắm cộng `bath` ([[Nhiệm vụ ngày]]).

## Mã nguồn
- `petdex/server/game.js`: `useItem` (260), `play` (268), `bathe` (196).
- `petdex/server/service.js`: `mutatePet` (65-81).
- `petdex/server/care.js`: `bath` (25).

## Liên quan
- [[Chỉ số của bé]] · [[Đồ ăn và đồ chăm sóc]] · [[Trang phục]] · [[Việc làm]] · [[Ốm và Phòng khám]]
- [[Màn Nhà]] · [[Module game]] · [[Module service]] · [[Module care]]
