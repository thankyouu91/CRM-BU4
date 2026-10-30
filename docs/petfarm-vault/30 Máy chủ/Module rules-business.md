---
tags: [petfarm, may-chu, module, luat, quay-tra-sua]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module rules-business

> [!summary]
> `petdex/server/rules/business.js` (78 dòng): luật thuần của quầy trà sữa: vị trí, công thức, nâng cấp, giá tham chiếu, giờ cao điểm, độ hấp dẫn giá, công suất, lượng khách, uy tín. Diễn giải: [[Quầy trà sữa]].

## Exports
| Tên | Dòng | Nội dung |
|---|---|---|
| `LOCATIONS` | `rules/business.js:5-9` | `alley`, `street`, `center`: giấy phép, tiền thuê/đêm, lượng người qua, giá quảng cáo |
| `RECIPES` | `rules/business.js:12-19` | 6 đồ uống, nguyên liệu tính bằng **phần** mỗi ly |
| `UPGRADES` | `rules/business.js:21-25` | `counter` (+4 ly/giờ), `menu` (+1 món), `decor` (+10% khách) với bảng giá |
| `BUSINESS` | `rules/business.js:27-38` | `markup` 2,3, `conversion` 0,3, `baseMenuSlots` 2, `revenueTax` 0,03, `promoHours` 6, `promoBoost` 0,5, `unpaidLimit` 3, `wageMin` 8, `wageMax` 80, `maxStaffSlots` 3 |
| `unitCost(recipeId, index)` | `rules/business.js:41-44` | Giá gốc nguyên liệu × chỉ số giá / 10 mỗi phần |
| `refPrice(recipeId, index)` | `rules/business.js:46` | `round(unitCost × markup)` |
| `peakFactor(hourVN)` | `rules/business.js:49-53` | 1,5 lúc 11-13 giờ và 17-21 giờ; 0,3 từ 23 giờ tới 6 giờ; còn lại 1 |
| `appeal(price, ref)` | `rules/business.js:56` | `min(3, (ref / price) ^ 1,5)` |
| `staffCapacity(craft, counterLevel)` | `rules/business.js:59` | `7 + craft/10 + 4 × counterLevel` ly/giờ |
| `customersPerHour({...})` | `rules/business.js:62-66` | traffic × cao điểm × uy tín × trang trí × quảng cáo × (1 + bonus) × conversion × `min(1,5; menuAppeal)` |
| `nextReputation(rep, { served, wanted, priceRatio })` | `rules/business.js:69-75` | Thiếu hàng hoặc giá > 130% tham chiếu thì giảm, bán đủ giá <= 110% thì +0,004; kẹp 0,5-1,5 |
| `menuSlots(upgrades)`, `upgradeCost(key, level)` | `rules/business.js:77-78` | |

## Ai dùng
`business.js`, `factory.js` (`BUSINESS.wageMin/Max`, `unpaidLimit`), `routes.js` (`/catalog`), test `community-rules.test.js`.

## Liên quan
- [[Module business]] · [[Module rules-market]] (giá gốc nguyên liệu)
