---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, pearl]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [⚫ Trân châu, pearl]
---
# Trân châu (nguyên liệu)

> [!summary]
> ⚫ **Trân châu** (mã `pearl`) là hàng **chế biến** trên [[Sàn Nguyên Liệu]], giá gốc **15 xu/lô** (10 phần), biến động 6%/ngày, hư sau **5 ngày**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | chế biến (`processed`) | `petdex/server/rules/market.js:15` |
| Giá gốc | 15 xu/lô (1,5 xu/phần) | `petdex/server/rules/market.js:15` |
| Biến động ngày (`vol`) | 0,06 | `petdex/server/rules/market.js:15` |
| Hạn dùng | 5 ngày kể từ lúc nhập kho | `petdex/server/rules/market.js:15,111` |
| Độ sâu thanh khoản NPC | 600 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 3,75 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `15 × (giá hiện tại đầu vào ÷ giá gốc đầu vào) × tin`, đầu vào: 1 lô [[Củ sắn]] (gốc 8) | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Trà sữa trân châu thành trào lưu mới" | `petdex/server/rules/market.js:49` |
| Tin giảm giá | "Kho trân châu tồn quá nhiều" | `petdex/server/rules/market.js:49` |

## Có từ đâu
- [[Hứng trân châu]] trong [[Mini-game]]: tối đa 20 phần trân châu/ngày (`public/ta-tua/game/js/shared/minigames.js:11`, `petdex/server/minigames.js:98-104`).
- Chế biến ở [[Xưởng bột trân châu]] từ 1 lô [[Củ sắn]].
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Quầy trà sữa]] | 🧋 Trà sữa trân châu: 1 phần/ly | `petdex/server/rules/business.js:13` |
| [[Quầy trà sữa]] | 🥛 Sữa tươi trân châu đường đen: 1 phần/ly | `petdex/server/rules/business.js:15` |
| [[Quầy trà sữa]] | 🍼 Trà sữa sữa đặc: 1 phần/ly | `petdex/server/rules/business.js:18` |
| [[Bếp]] | 🧋 Trà sữa nhà làm: 1 phần/món | `petdex/server/rules/production.js:107` |
| [[Bếp]] | 🍰 Bánh dâu: 1 phần/món | `petdex/server/rules/production.js:110` |
| [[Xưởng bột trân châu]] (thành phẩm) | 1 lô/mẻ | `petdex/server/rules/production.js:143` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Sắn & trân châu]], [[Ngành Chuỗi trà sữa]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Không kiểu thời tiết nào đẩy giá mặt hàng này.

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
