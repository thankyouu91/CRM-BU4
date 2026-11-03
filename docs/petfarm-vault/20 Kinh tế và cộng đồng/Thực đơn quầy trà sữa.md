---
tags: [petfarm, kinh-te, quay-tra-sua, thuc-don]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/business.js, petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [Menu quầy, Công thức quầy]
---
# Thực đơn quầy trà sữa

> [!summary]
> 6 món [[Quầy trà sữa]] có thể bán, mỗi ly dùng một số **phần** nguyên liệu (1 lô = 10 phần) từ [[Kho Sàn]] của chủ quầy. Giá tham chiếu = chi phí nguyên liệu theo giá gốc × [[Chỉ số giá]] × 2,3. Chủ quầy đặt giá 1 xu đến 3 lần giá tham chiếu; giá rẻ hút khách, giá đắt làm giảm uy tín.

## Bảng món (chỉ số giá = 1)

| Món | Mã | Nguyên liệu mỗi ly | Chi phí/ly | Giá tham chiếu | Giá tối đa | Nguồn |
|---|---|---|---|---|---|---|
| 🧋 Trà sữa trân châu | `boba_milk_tea` | trà khô, sữa tươi, trân châu, đường nâu × 1 | 9,5 | 22 | 66 | `petdex/server/rules/business.js:13` |
| 🥤 Trà sữa truyền thống | `milk_tea` | trà khô, sữa tươi, đường nâu × 1 | 8,0 | 18 | 54 | `petdex/server/rules/business.js:14` |
| 🥛 Sữa tươi trân châu đường đen | `brown_sugar_milk` | sữa tươi, trân châu, đường nâu × 1 | 6,0 | 14 | 42 | `petdex/server/rules/business.js:15` |
| 🍓 Trà dâu | `strawberry_tea` | trà khô, dâu tây, đường nâu × 1 | 9,0 | 21 | 63 | `petdex/server/rules/business.js:16` |
| 🍹 Sinh tố dâu sữa | `strawberry_smoothie` | dâu tây × 2, sữa tươi × 1 | 11,0 | 25 | 75 | `petdex/server/rules/business.js:17` |
| 🍼 Trà sữa sữa đặc | `condensed_tea` | trà khô, sữa đặc, trân châu, đường nâu × 1 | 10,5 | 24 | 72 | `petdex/server/rules/business.js:18` |

Công thức: `unitCost = Σ base × index × phần / 10`, `refPrice = round(unitCost × 2,3)` (`petdex/server/rules/business.js:28,40-46`). Giá tối đa = `refPrice × 3` (`petdex/server/business.js:193-194`).

## Số món trong thực đơn
- Ban đầu 2 ô (`baseMenuSlots`), mỗi cấp "Thêm món" +1, tối đa 6 (`petdex/server/rules/business.js:23,30,77`).
- Mở quầy chỉ có sẵn Trà sữa trân châu; chủ quầy tự thêm món thứ 2 (`petdex/server/business.js:174`).
- Đổi thực đơn: `POST /business/menu { menu: [{recipe, price}] }`, tính bù bán hàng trước khi đổi (`petdex/server/business.js:180-200`).

## Độ hấp dẫn theo giá

| Giá bán / tham chiếu | Hấp dẫn `(ref/price)^1,5` | Ảnh hưởng uy tín mỗi giờ |
|---|---|---|
| 0,5 | 2,83 | +0,004 nếu bán được |
| 0,8 | 1,40 | +0,004 |
| 1,0 | 1,00 | +0,004 |
| 1,1 | 0,87 | +0,004 |
| 1,3 | 0,67 | 0 |
| 1,5 | 0,54 | −0,02 |
| 2,0 | 0,35 | −0,07 |
| 3,0 | 0,19 | −0,17 |

Hấp dẫn bình quân của cả thực đơn nhân vào lượng khách, trần 1,5 (`petdex/server/rules/business.js:56,62-66`); tỉ lệ giá dùng cho uy tín là **trung bình** tỉ lệ giá các món (`petdex/server/business.js:89-90`). Xem [[Uy tín quầy]].

> [!tip]
> Hạ giá chỉ tăng khách tới trần 1,5 (giá khoảng 0,76 × tham chiếu). Rẻ hơn nữa không thêm khách mà chỉ mất lời.

## Liên quan
- [[Quầy trà sữa]] · [[Uy tín quầy]] · [[Mặt hàng nguyên liệu]] · [[Bếp]] (món nhà nấu khác thực đơn quầy) · [[MOC Kinh tế và cộng đồng]]
