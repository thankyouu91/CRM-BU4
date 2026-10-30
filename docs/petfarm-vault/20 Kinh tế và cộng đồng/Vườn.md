---
tags: [petfarm, kinh-te, vuon, san-xuat]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/farm.js, petdex/server/rules/production.js, petdex/server/routes-production.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌱 Vườn, Garden]
---
# Vườn

> [!summary]
> Nguồn nguyên liệu thô tự làm (cấp 2): gieo chè, dâu, mía hoặc sắn trên 4–9 ô đất, chờ vài giờ rồi thu hoạch thẳng vào [[Kho Sàn]]. Chỉ **bạn bè** tưới hộ được (+20% vụ đó, người tưới +2 xu), sâu có thể xuất hiện và ăn 30% nếu không bắt. Bé chính hành Mộc thêm 15% sản lượng.

## Cây trồng (`CROPS`, `petdex/server/rules/production.js:78-83`)

| Cây | Ra | Thời gian | Hạt giống (× chỉ số giá) | Sản lượng (phần) | Giá trị theo giá gốc |
|---|---|---|---|---|---|
| 🍃 Chè | [[Lá trà tươi]] | 6 giờ | 8 | 10–20 | 12–24 xu |
| 🍓 Dâu tây | [[Dâu tây]] | 4 giờ | 20 | 10–12 | 40–48 xu |
| 🎋 Mía | [[Mía]] | 8 giờ | 10 | 20–30 | 16–24 xu |
| 🥔 Sắn | [[Củ sắn]] | 6 giờ | 8 | 18–22 | 14–18 xu |

## Con số (`GARDEN`, `petdex/server/rules/production.js:84-93`)
| Thông số | Giá trị |
|---|---|
| Ô ban đầu | 4 |
| Mở thêm ô 5, 6, 7, 8, 9 | 300, 800, 2.000, 5.000, 9.000 xu (× chỉ số giá) |
| Tưới hộ | +20% sản lượng vụ đó (một hay nhiều người tưới như nhau) |
| Người tưới nhận | +2 xu (`garden_help`), +5 XP cho bé chính, tối đa 10 ô/ngày |
| Sâu | 25% vụ có sâu, xuất hiện ngẫu nhiên giữa lúc gieo và lúc chín |
| Không bắt sâu | −30% sản lượng |
| Bé chính hành Mộc | +15% (`public/ta-tua/game/js/shared/pets.js:294`) |

## Công thức (`harvestYield`, `petdex/server/rules/production.js:95-101`; `harvest`, `petdex/server/farm.js:120-145`)
```
q = lo + floor(rand × (hi − lo + 1))
nếu được tưới: q × 1,2;  nếu còn sâu: q × 0,7
q = max(1, round(q));  bé chính Mộc: max(1, round(q × 1,15))
```
Thành phẩm vào kho với giá vốn = tiền hạt / số phần (dùng để tính lãi chốt khi bán), nhận tới khi kho đầy (`allowPartial`) (`petdex/server/farm.js:135`).

## Trường hợp đặc biệt và lỗi
- Tự tưới vườn nhà: "Tự tưới vườn nhà không được thưởng, nhờ bạn bè tưới nhé."; không phải bạn: "Chỉ tưới được vườn của bạn bè."; ô đã chín hoặc trống: "Ô này không cần tưới."; quá 10 ô: "Mỗi ngày tưới giúp tối đa 10 ô." (`petdex/server/farm.js:91-109`).
- Xem vườn người khác chỉ khi là bạn bè (`petdex/server/farm.js:59-62`).
- Sâu chỉ bắt được sau khi đã xuất hiện; bắt sâu không tốn gì (`petdex/server/farm.js:111-118`).
- Kho đầy lúc thu hoạch: "Thu được X phần … nhưng kho chỉ còn chỗ cho Y phần." (phần thừa mất) (`petdex/server/farm.js:140-142`).
- Tưới hộ tính nhiệm vụ "Thả tim nhà một người bạn" (`track('friend')`) (`petdex/server/farm.js:106`); thu hoạch tính nhiệm vụ "Thu hoạch 1 ô vườn".
- Chỉ gieo cần cấp 2; thu hoạch, bắt sâu, mở ô không khóa cấp (`petdex/server/routes-production.js:52-65`).

## Liên quan
- [[Bạn bè]] · [[Kho Sàn]] · [[Mặt hàng nguyên liệu]] · [[Ngũ hành]] · [[Khu công nghiệp]] · [[Module farm]] · [[MOC Kinh tế và cộng đồng]]
