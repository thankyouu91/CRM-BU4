---
tags: [petfarm, luat-choi, tien-trinh]
aliases: [Cấp độ, XP, Kinh nghiệm, Lên cấp]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/game.js, petdex/server/service.js, petdex/server/elements.js, public/ta-tua/game/js/shared/pets.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Cấp độ và XP

> [!summary]
> Mỗi bé có cấp riêng (bắt đầu cấp 1) và thanh ⭐ Kinh nghiệm. XP cần để lên cấp tăng tuyến tính 40 mỗi cấp, mỗi lần lên cấp được thưởng xu. Cấp của **bé cao cấp nhất** trong nhà mở khóa các khu trong phố ([[Mở khóa theo cấp]]); cấp của từng bé quyết định số món [[Trang phục]] đeo được và [[Dáng theo cấp]]. Không có trần cấp trong code.

## Công thức
```
XP cần để từ cấp L lên L+1 = 80 + (L − 1) × 40
Thưởng xu khi đạt cấp L     = 20 + L × 10
XP thực nhận                = round( XP gốc × (hành vượng ? 1,1 : 1) × stage.xp )
```
(`petdex/server/game.js:217-218`, `petdex/server/service.js:70-71`, `petdex/server/elements.js:26`.) Hệ số tuổi `stage.xp`: Sơ sinh 1,5, Nhí nhố 1,25, Thiếu niên 1,1, Thanh niên 1, Trưởng thành 1, Lão làng 0,7 (`public/ta-tua/game/js/shared/pets.js:82-113`). Tổng XP cộng dồn tới cấp N là `40·N² − 40·N`... cụ thể: `Σ_{L=1}^{N−1} (40 + 40L) = 20·(N−1)·(N+2)`.

`settle` xử lý lên nhiều cấp một lúc và cộng dồn thưởng (`petdex/server/game.js:288-299`); thưởng ghi sổ loại `level` với ghi chú "<tên> lên cấp N" (`petdex/server/service.js:73-76`).

## Con số
| Lên cấp | XP cần | XP cộng dồn | Thưởng xu (cấp mới) |
|---|---|---|---|
| 1→2 | 80 | 80 | 40 |
| 2→3 | 120 | 200 | 50 |
| 3→4 | 160 | 360 | 60 |
| 4→5 | 200 | 560 | 70 |
| 5→6 | 240 | 800 | 80 |
| 6→7 | 280 | 1.080 | 90 |
| 7→8 | 320 | 1.400 | 100 |
| 8→9 | 360 | 1.760 | 110 |
| 9→10 | 400 | 2.160 | 120 |
| 10→11 | 440 | 2.600 | 130 |
| 15→16 | 640 | 5.400 | 180 |
| 20→21 | 840 | 9.200 | 230 |
| 30→31 | 1.240 | 19.800 | 330 |
| 40→41 | 1.640 | 34.400 | 430 |
| 49→50 | 2.000 | 50.960 | 520 |

(Tính bằng `xpToNext`/`levelReward` của `petdex/server/game.js:217-218`.)

## Nguồn XP
| Hành động | XP gốc | Nguồn |
|---|---|---|
| Cho ăn | 6–30 theo món ([[Đồ ăn và đồ chăm sóc]]) | `petdex/server/game.js:41-49,264` |
| Chơi đùa | 10 + đồ chơi (4/6/10) | `petdex/server/game.js:277` |
| Tắm ở nhà | 2 | `petdex/server/game.js:200` |
| Khám / chữa | 2 | `petdex/server/care.js:59` |
| Nhận lương ca làm (mọi loại ca) | 4 / giờ | `petdex/server/rules/careers.js:24`, `petdex/server/jobs.js:181,199,215` |
| Đi học | 5 / buổi | `petdex/server/care.js:140` |
| Mini-game | 3 / ván | `petdex/server/minigames.js:109` |
| Nhiệm vụ ngày | 10 / nhiệm vụ (cho [[Thú chính]]) | `petdex/server/rules/town.js:66` |
| Được hoặc đi vuốt ve ở công viên | 5 | `petdex/server/game.js:283-285` |
| Nấu ăn, ăn món tự nấu, tưới vườn bạn | xem [[Bếp]], [[Vườn]] | `petdex/server/farm.js` |

## Trường hợp đặc biệt
- Bé Sơ sinh nhận XP ×1,5 nên lên cấp nhanh nhất ở những ngày đầu; Lão làng chỉ ×0,7.
- XP từ món ăn hợp mệnh và [[Tính cách Tham ăn]] nhân trước, rồi mới nhân vận khí và tuổi.
- Khi bé mất, cấp được lưu ở [[Vòng đời và Đồi Sao|Đồi Sao]], không chuyển sang bé mới.
- [[Bảng vàng]] xếp 20 bé theo cấp, rồi XP, rồi bé lớn tuổi hơn đứng trước.

## Liên quan
- [[Mở khóa theo cấp]] · [[Dáng theo cấp]] · [[Trang phục]] · [[Hành vượng]] · [[Giai đoạn tuổi]] · [[Module game]]
