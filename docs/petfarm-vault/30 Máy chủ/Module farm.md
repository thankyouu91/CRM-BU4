---
tags: [petfarm, may-chu, module, vuon, bep]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/farm.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module farm

> [!summary]
> `petdex/server/farm.js` (268 dòng): Vườn (gieo, tưới hộ bạn bè, bắt sâu, thu hoạch vào kho Sàn, mở rộng) và Bếp (nấu theo công thức hoặc ghép nguyên liệu để khám phá món ẩn, ăn, bán cho NPC). Luật: [[Vườn]], [[Bếp]].

## Exports: vườn
| Tên | Dòng | Việc |
|---|---|---|
| `gardenView(userId, ownerId, now)` | `farm.js:59-72` | Vườn mình hoặc của bạn bè (người lạ bị chặn); ô, giá mở thêm ô, hạt giống, lượt tưới hộ còn lại |
| `plant(userId, idx, crop, now, rand)` | `farm.js:74-88` | Trừ hạt giống theo chỉ số giá (sổ `seeds`); xác suất có sâu, thời điểm sâu ngẫu nhiên trong vụ |
| `water(userId, ownerId, idx, now)` | `farm.js:91-109` | Chỉ vườn bạn, mỗi ô một lần mỗi người, giới hạn lượt/ngày; người tưới được xu (sổ `garden_help`) và XP bé chính, nhiệm vụ `friend` |
| `catchPests(userId, idx, now)` | `farm.js:111-118` | |
| `harvest(userId, idx, now, rand)` | `farm.js:120-145` | `harvestYield` (tưới +, sâu -), bé chính hành Mộc +15%; vào kho với giá vốn = tiền hạt / số phần; nhiệm vụ `harvest` |
| `expandGarden(userId, now)` | `farm.js:147-156` | Sổ `garden_expand` |

## Exports: bếp
| Tên | Dòng | Việc |
|---|---|---|
| `kitchenView(userId, now)` | `farm.js:167-184` | Xóa món hư; công thức (ẩn chỉ hiện khi đã biết), số có thể nấu, món đang có |
| `cook(userId, { recipe, inputs }, now, rand)` | `farm.js:190-228` | Ghép `inputs` đúng một công thức thì khám phá; ghép sai báo gợi ý **trước khi** lấy nguyên liệu; chất lượng `rollQuality(craft + 15 nếu bé Kim, rand / (1 + luck/100))`; bé chính tốn năng lượng, +4 XP; nhiệm vụ `cook` |
| `eatDish(userId, dishId, petId, now)` | `farm.js:231-246` | Hiệu quả × hệ số chất lượng, XP theo hợp mệnh; nhiệm vụ `feed` |
| `sellDishToNpc(userId, dishId, now)` | `farm.js:248-258` | `dishValue × npcRate` (sổ `kitchen_sale`) + `tradeBonus` |
| `takeDish(userId, dishId, now)`, `giveDish(userId, recipe, quality, madeAt, now)` | `farm.js:261-268` | Cho Chợ Phiên |

## Bảng
`garden_plots`, `garden_help`, `friends`, `users.plots`, `recipes_known`, `dishes`, `lots`, `pet_skills`, `ledger`.

## Ai gọi
`routes-production.js`, `bazaar.js` (`takeDish`, `giveDish`).

## Lưu ý
- `cook` lấy nguyên liệu và ghi món **trước** khi `mutatePet` kiểm năng lượng/bận; lỗi ở đó rollback nhờ transaction ngoài.
- `kitchenView` xóa món hư (ghi DB) dù là GET.

## Liên quan
- [[Vườn]] · [[Bếp]] · [[Module rules-production]] · [[Module market]] · [[Module bazaar]]
