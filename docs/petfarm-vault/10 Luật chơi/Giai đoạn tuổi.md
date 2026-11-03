---
tags: [petfarm, luat-choi, tuoi]
aliases: [Tuổi, Sơ sinh, Nhí nhố, Thiếu niên, Thanh niên, Trưởng thành, Lão làng, Life stages]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, petdex/server/game.js, petdex/server/jobs.js, petdex/server/care.js, petdex/server/service.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Giai đoạn tuổi

> [!summary]
> **1 ngày thật = 1 tuần tuổi.** Bé đi qua 6 giai đoạn như đời người: Sơ sinh, Nhí nhố, Thiếu niên, Thanh niên, Trưởng thành, Lão làng. Mỗi giai đoạn có dáng vẽ riêng và hệ số luật riêng: giờ làm tối đa, % lương, % XP, độ dễ ốm, tốc độ học, sức ăn. Trưởng thành là mốc trung tính; Lão làng là giai đoạn cuối trước khi bé về [[Vòng đời và Đồi Sao|Đồi Sao]].

## Con số
| Giai đoạn | Mã | Từ tuần (= ngày thật) | Giờ làm tối đa/ngày | Lương (`work`) | XP | Ốm | Học (`school`) | Tụt No (`spend`) | Khác | Nguồn |
|---|---|---|---|---|---|---|---|---|---|---|
| Sơ sinh | `baby` | 0 | 2 | 50% | ×1,5 | ×2 | không đi học | ×0,8 | | `public/ta-tua/game/js/shared/pets.js:79-84` |
| Nhí nhố | `kid` | 2 | 2 | 60% | ×1,25 | ×1,4 | ×1,3 | ×0,9 | | `public/ta-tua/game/js/shared/pets.js:85-90` |
| Thiếu niên | `teen` | 8 | 4 | 85% | ×1,1 | ×1 | ×1,15 | ×1,1 | Vui vẻ tụt ×1,3 | `public/ta-tua/game/js/shared/pets.js:91-96` |
| Thanh niên | `young` | 21 | 8 | 100% | ×1 | ×0,9 | ×1 | ×1,3 | | `public/ta-tua/game/js/shared/pets.js:97-102` |
| Trưởng thành | `adult` | 40 | 8 | 100% + thâm niên | ×1 | ×0,8 | ×1 | ×1 | | `public/ta-tua/game/js/shared/pets.js:103-109` |
| Lão làng | `elder` | 70 | 4 | 100% + thâm niên | ×0,7 | ×2 | ×0,7 | ×1 | Năng lượng hồi ×0,8 | `public/ta-tua/game/js/shared/pets.js:110-115` |

Máy chủ giữ thêm bảng `STAGES` (mốc theo ngày tuổi 0/14/56/147/280/490 và `scale` cho loài khách mời) khớp với `LIFE_STAGES` (`petdex/server/game.js:24-31`).

### Dáng vẽ (`look`)
| Giai đoạn | scale | đầu | thân | chân | mắt |
|---|---|---|---|---|---|
| Sơ sinh | 0,62 | 1,06 | 0,72 | 0,5 | 1,25 |
| Nhí nhố | 0,74 | 1,02 | 0,82 | 0,7 | 1,15 |
| Thiếu niên | 0,86 | 0,98 | 0,92 | 0,9 | 1,05 |
| Thanh niên | 0,95 | 0,95 | 1 | 1 | 1 |
| Trưởng thành | 1 | 0,92 | 1,14 | 1 | 0,95 |
| Lão làng | 0,97 | 0,94 | 1,1 | 0,8 | 0,85 (+ nét già) |

(`public/ta-tua/game/js/shared/pets.js:81-112`.)

## Công thức
```
ngày tuổi = floor( (now − born_at) × 7 / 86 400 000 )
tuần tuổi = floor(ngày tuổi / 7)            (= số ngày thật đã nuôi)
thâm niên = min(30%, floor(giờ đã làm nghề đó / 10) × 1%)   (chỉ Trưởng thành, Lão làng)
lương ca = gốc × … × work × (1 + thâm niên)
```
(`petdex/server/game.js:220-225`, `public/ta-tua/game/js/shared/pets.js:126-131`, `petdex/server/jobs.js:149`.)

## Nơi áp dụng
| Hệ số | Áp dụng | Nguồn |
|---|---|---|
| `maxHours` | giới hạn giờ ca trong ngày | `petdex/server/jobs.js:104-113` |
| `work`, `seniority` | lương ca nghề | `petdex/server/jobs.js:149-150` |
| `xp` | mọi XP qua `mutatePet` | `petdex/server/service.js:70` |
| `sickness` | bốc ốm theo giờ và nửa đêm | `petdex/server/game.js:190-191`, `petdex/server/care.js:97` |
| `school` | điểm học | `petdex/server/care.js:135`; Sơ sinh bị chặn ở `petdex/server/care.js:124` |
| `spend`, `moodDrop`, `energyRegen` | `tick` | `petdex/server/game.js:163-179` |

Màn Nhà hiện "🎂 <tuổi> · <giai đoạn> · còn N ngày nữa thành <giai đoạn kế>" và ghi chú `note` của giai đoạn (`public/ta-tua/game/js/app.js:406-413,492-493,519`).

> [!warning] Lệch tài liệu
> Ghi chú Thanh niên trong game nói "đồ ăn và đồ chơi hao nhanh hơn 30%" (`public/ta-tua/game/js/shared/pets.js:101`), nhưng code chỉ dùng `spend` để nhân tốc độ tụt No bụng (`petdex/server/game.js:164`); đồ chơi không hao. README (`petdex/README.md:54`) viết "thanh niên ăn nhiều", đúng nghĩa này.

## Trường hợp đặc biệt
- Bé Sơ sinh vẫn đi làm được từ cấp 1 (`MIN_STAGE = 'baby'`, `petdex/server/rules/careers.js:35`) nhưng chỉ 2 giờ/ngày, lương 50%.
- Bé Sơ sinh đi học báo "… còn bé quá, 2 tuần tuổi mới đi học được." (`petdex/server/care.js:124`).
- Lão làng: XP ×0,7, ốm ×2, chỉ làm 4 giờ, nhưng lương thâm niên vẫn giữ.
- Giờ làm tối đa tính theo ngày bắt đầu ca (`shifts.day`), không theo giờ thực làm trong ngày.

## Liên quan
- [[Vòng đời và Đồi Sao]] · [[Việc làm]] · [[Trường học]] · [[Chỉ số của bé]] · [[Ốm và Phòng khám]] · [[Dáng theo cấp]] · [[Bộ khung thú]]
