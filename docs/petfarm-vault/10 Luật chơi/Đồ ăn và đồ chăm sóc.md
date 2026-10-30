---
tags: [petfarm, luat-choi, cham-soc, sieu-thi]
aliases: [Đồ ăn, Đồ chăm sóc, Đồ chơi, Thức ăn]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/game.js, petdex/server/routes.js, public/ta-tua/game/js/shared/pets.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Đồ ăn và đồ chăm sóc

> [!summary]
> Đồ ăn và đồ chăm sóc mua ở [[Siêu thị]] là đồ dùng một lần: cộng vào [[Chỉ số của bé]] và cho XP. Đồ chơi mua một lần dùng mãi, làm mỗi lần Chơi đùa vui hơn và nhiều XP hơn. Chọn món **hợp mệnh** với bé được thêm 20% XP. Món tự nấu ở [[Bếp]] là nguồn thức ăn khác (agent B).

## Con số: hiệu quả và hiệu suất
| Món | Hành | Giá | Hiệu quả | XP | XP/xu | No/xu | Bé hợp mệnh (+20% XP) | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 🧋 Trà sữa trân châu | Mộc | 12 | No +20, Vui +6 | 6 | 0,50 | 1,67 | Mộc, Hỏa | `petdex/server/game.js:41` |
| 🐟 Cá tươi | Thủy | 18 | No +32 | 8 | 0,44 | 1,78 | Thủy, Mộc | `petdex/server/game.js:42` |
| 🍙 Cơm nắm | Thổ | 25 | No +45, NL +5 | 10 | 0,40 | 1,80 | Thổ, Kim | `petdex/server/game.js:43` |
| 🍣 Khay sushi | Thủy | 45 | No +60, Vui +12 | 18 | 0,40 | 1,33 | Thủy, Mộc | `petdex/server/game.js:44` |
| 🍰 Bánh kem dâu | Hỏa | 70 | No +30, Vui +35 | 30 | 0,43 | 0,43 | Hỏa, Thổ | `petdex/server/game.js:45` |
| 🧃 Nước tăng lực | Kim | 30 | NL +40 | 4 | 0,13 | | Kim, Thủy | `petdex/server/game.js:47` |
| 🛁 Tắm bong bóng | Thủy | 35 | Vui +25, NL +10, Sạch +60 | 8 | 0,23 | | Thủy, Mộc | `petdex/server/game.js:48` |
| 💊 Vitamin tổng hợp | Kim | 55 | No +15, Vui +15, NL +25, Sức khỏe +15 | 12 | 0,22 | | Kim, Thủy | `petdex/server/game.js:49` |

"Bé hợp mệnh" = bé cùng hành với món, hoặc bé mà hành của món sinh ra ([[Hợp mệnh và kỵ mệnh]]). Giá gốc, nhân [[Chỉ số giá]].

| Đồ chơi | Giá | Thêm mỗi lần chơi | Cấp | Nguồn |
|---|---|---|---|---|
| ⚽ Bóng nảy | 60 | Vui +8, +4 XP | 1 | `petdex/server/game.js:51` |
| 🧶 Cuộn len | 90 | Vui +12, +6 XP | 2 | `petdex/server/game.js:52` |
| 🪁 Diều giấy | 180 | Vui +18, +10 XP | 6 | `petdex/server/game.js:53` |

Chơi tay không: Vui +12, 10 XP, 4 xu ([[Chăm sóc ở nhà]]). Diều giấy gấp đôi XP mỗi lần chơi (20).

## Công thức
```
hiệu quả thật (phần cộng) = round( giá trị × (1 + %Chỉ số trang phục / 100) ), kẹp 0–100
XP = round( xp × (Tham ăn và là đồ ăn ? 1,3 : 1) × (1 + 0,2 nếu hợp mệnh) ) × vận khí × tuổi
```
(`petdex/server/game.js:254-266`, `petdex/server/service.js:70`.)

## Trường hợp đặc biệt
- Đồ ăn bị chặn khi No bụng ≥ 97: "<tên> no căng bụng rồi!"; đồ chăm sóc thì không.
- Có thể dùng khi bé đang bận (đi làm, đi học).
- Vitamin là món duy nhất ở Siêu thị cộng thẳng Sức khỏe (+15), rẻ hơn khám tổng quát (60 xu, +15) nhưng cần cấp 4 và không chữa bệnh.
- Tắm bong bóng (35 xu) kém tắm ở nhà miễn phí về độ sạch (+60 so với +100) nhưng không làm bé bận 15 phút và có thêm Vui, NL.
- Chỉ đồ ăn và đồ chăm sóc mới tặng được cho bạn (5 món/ngày) và ở công viên ([[Bạn bè]], [[Công viên]]).
- Cho ăn đồ ăn cộng nhiệm vụ "Cho bé ăn 3 lần"; đồ chăm sóc không cộng (`petdex/server/routes.js:221`).

## Liên quan
- [[Siêu thị]] · [[Chăm sóc ở nhà]] · [[Chỉ số của bé]] · [[Hợp mệnh và kỵ mệnh]] · [[Tính cách Tham ăn]] · [[Bếp]]
