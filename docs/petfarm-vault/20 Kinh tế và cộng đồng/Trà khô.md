---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, dried_tea]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍂 Trà khô, dried_tea]
---
# Trà khô

> [!summary]
> 🍂 **Trà khô** (mã `dried_tea`) là hàng **chế biến** trên [[Sàn Nguyên Liệu]], giá gốc **35 xu/lô** (10 phần), biến động 6%/ngày, **không hư**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | chế biến (`processed`) | `petdex/server/rules/market.js:14` |
| Giá gốc | 35 xu/lô (3,5 xu/phần) | `petdex/server/rules/market.js:14` |
| Biến động ngày (`vol`) | 0,06 | `petdex/server/rules/market.js:14` |
| Hạn dùng | không hư | `petdex/server/rules/market.js:14,111` |
| Độ sâu thanh khoản NPC | 600 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 8,75 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `35 × (giá hiện tại đầu vào ÷ giá gốc đầu vào) × tin`, đầu vào: 2 lô [[Lá trà tươi]] (gốc 24) | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Lò sấy trà quá tải" | `petdex/server/rules/market.js:48` |
| Tin giảm giá | "Xưởng sấy trà mới khai trương" | `petdex/server/rules/market.js:48` |

## Có từ đâu
- Chế biến ở [[Xưởng sấy trà]] từ 2 lô [[Lá trà tươi]].
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Quầy trà sữa]] | 🧋 Trà sữa trân châu: 1 phần/ly | `petdex/server/rules/business.js:13` |
| [[Quầy trà sữa]] | 🥤 Trà sữa truyền thống: 1 phần/ly | `petdex/server/rules/business.js:14` |
| [[Quầy trà sữa]] | 🍓 Trà dâu: 1 phần/ly | `petdex/server/rules/business.js:16` |
| [[Quầy trà sữa]] | 🍼 Trà sữa sữa đặc: 1 phần/ly | `petdex/server/rules/business.js:18` |
| [[Bếp]] | 🧋 Trà sữa nhà làm: 1 phần/món | `petdex/server/rules/production.js:107` |
| [[Bếp]] ([[Món ẩn]]) | 🍮 Thạch trà: 2 phần/món | `petdex/server/rules/production.js:111` |
| [[Xưởng sấy trà]] (thành phẩm) | 1 lô/mẻ | `petdex/server/rules/production.js:142` |
| [[Hội]]: [[Dự án Dãy đèn lồng công viên]] | 20 lô | `petdex/server/rules/town.js:93` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Trà (lá trà, trà khô)]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Không kiểu thời tiết nào đẩy giá mặt hàng này.

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
