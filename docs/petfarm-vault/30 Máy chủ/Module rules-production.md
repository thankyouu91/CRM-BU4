---
tags: [petfarm, may-chu, module, luat, san-xuat]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/production.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module rules-production

> [!summary]
> `petdex/server/rules/production.js` (210 dòng): luật thuần "giai đoạn 2": sức khỏe và bệnh, phòng khám, bảo hiểm, tính cách, trường học, vườn, bếp, xưởng, hợp đồng, Chợ Phiên, điểm tín dụng và khoản vay. Được `game.js` import (nên không được import ngược `game.js`).

## Exports theo nhóm
| Nhóm | Tên | Dòng | Diễn giải |
|---|---|---|---|
| Sức khỏe | `HEALTH`, `ILLNESSES`, `healthDelta`, `sickChance` | `rules/production.js:9-22`, `55-62` | [[Ốm và Phòng khám]], [[Chỉ số của bé]] |
| Phòng khám, bảo hiểm | `CLINIC`, `INSURANCE` | `rules/production.js:24-28` | [[Bảo hiểm sức khỏe]] |
| Tính cách | `TRAITS`, `rollTraits`, `has`, `payFactor` | `rules/production.js:30-49` | [[Tính cách]] |
| Trường | `SCHOOL`, `CLASSES` | `rules/production.js:66-73` | [[Trường học]] |
| Vườn | `CROPS`, `GARDEN`, `harvestYield` | `rules/production.js:78-101` | [[Vườn]] |
| Bếp | `DISHES` (3 món ẩn), `QUALITY`, `KITCHEN`, `rollQuality`, `sameInputs`, `dishValue` | `rules/production.js:106-136` | [[Bếp]] |
| Xưởng | `FACTORIES`, `FACTORY`, `batchesPerHour` | `rules/production.js:141-152` | [[Khu công nghiệp]] |
| Hợp đồng | `CONTRACTS`, `contractDayValue`, `contractEscrows`, `shortfallPenalty` | `rules/production.js:162-174` | [[Hợp đồng cung ứng]] |
| Chợ Phiên | `BAZAAR` | `rules/production.js:178` | [[Chợ Phiên]] |
| Tín dụng | `CREDIT`, `TIERS`, `LOANS`, `tierOf`, `clampCredit`, `loanRate`, `loanLimit`, `installment` | `rules/production.js:182-210` | [[Điểm tín dụng]], [[Tín dụng và vay]] |

## Hằng số tham chiếu nhanh
| Hằng | Giá trị | Dòng |
|---|---|---|
| `HEALTH` | `hygienePerHour` -5, `lossPerHour` 1, `regenPerHour` 1, `sickChancePerHour` 0,03, `sickBelow` 40, `bathMinutes` 15 | 9-17 |
| `SCHOOL` | 30 phút, 15 năng lượng, 3 buổi/môn/ngày, +2-4 điểm | 66 |
| `KITCHEN` | 5 năng lượng, hạn 3 ngày, NPC mua 60%, `valueMarkup` 1,8 | 120 |
| `FACTORY` | thuê đất 50, nâng cấp [2000, 4000, 8000], +3 mẻ/cấp, kỹ năng +30%, phí gia công tối đa 100 | 147 |
| `CONTRACTS` | 3-14 ngày, 20 lô/ngày, giá 50-200% Sàn, ký quỹ bán 20%, phạt thiếu 10%, phá 10%, đề xuất 48 giờ, mở tối đa 5 | 162-164 |
| `BAZAAR` | phí đăng 1%, phí bán 5%, giá 50-300%, 48 giờ, tài khoản 3 ngày, 10 tin | 178 |
| `CREDIT` | 500 khởi điểm, 300-850, đúng hạn +5, tất toán +30, trễ -20, vỡ nợ -100, giao hợp đồng +3, phá -30, bị đóng cửa -40 | 182 |
| `LOANS` | kỳ hạn [3, 7, 14], phí giải ngân 2%, phí trễ 1%, vỡ nợ sau 7 kỳ, thu nợ 30%, cấm 14 ngày, tài khoản 3 ngày | 189 |

## Ai dùng
`game.js`, `care`, `farm`, `factory`, `contracts`, `bazaar`, `credit`, `business`, `eggs`, `jobs`, `migrate`, `routes.js`.

## Lưu ý
Tự định nghĩa `clamp` (dòng 5) để tránh vòng import với `game.js`.

## Liên quan
- [[Module game]] · [[Module care]] · [[Module farm]] · [[Module factory]] · [[Module credit]]
