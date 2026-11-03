---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, sugar]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🟤 Đường nâu, sugar]
---
# Đường nâu

> [!summary]
> 🟤 **Đường nâu** (mã `sugar`) là hàng **chế biến** trên [[Sàn Nguyên Liệu]], giá gốc **15 xu/lô** (10 phần), biến động 5%/ngày, **không hư**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | chế biến (`processed`) | `petdex/server/rules/market.js:16` |
| Giá gốc | 15 xu/lô (1,5 xu/phần) | `petdex/server/rules/market.js:16` |
| Biến động ngày (`vol`) | 0,05 | `petdex/server/rules/market.js:16` |
| Hạn dùng | không hư | `petdex/server/rules/market.js:16,111` |
| Độ sâu thanh khoản NPC | 600 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 3,75 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `15 × (giá hiện tại đầu vào ÷ giá gốc đầu vào) × tin`, đầu vào: 1 lô [[Mía]] (gốc 8) | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Giá điện tăng, nhà máy đường giảm công suất" | `petdex/server/rules/market.js:50` |
| Tin giảm giá | "Nhà máy đường chạy hết công suất" | `petdex/server/rules/market.js:50` |

## Có từ đâu
- Chế biến ở [[Nhà máy đường]] từ 1 lô [[Mía]].
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Quầy trà sữa]] | 🧋 Trà sữa trân châu: 1 phần/ly | `petdex/server/rules/business.js:13` |
| [[Quầy trà sữa]] | 🥤 Trà sữa truyền thống: 1 phần/ly | `petdex/server/rules/business.js:14` |
| [[Quầy trà sữa]] | 🥛 Sữa tươi trân châu đường đen: 1 phần/ly | `petdex/server/rules/business.js:15` |
| [[Quầy trà sữa]] | 🍓 Trà dâu: 1 phần/ly | `petdex/server/rules/business.js:16` |
| [[Quầy trà sữa]] | 🍼 Trà sữa sữa đặc: 1 phần/ly | `petdex/server/rules/business.js:18` |
| [[Bếp]] | 🧋 Trà sữa nhà làm: 1 phần/món | `petdex/server/rules/production.js:107` |
| [[Bếp]] | 🐟 Cá nướng: 1 phần/món | `petdex/server/rules/production.js:109` |
| [[Bếp]] | 🍰 Bánh dâu: 2 phần/món | `petdex/server/rules/production.js:110` |
| [[Bếp]] ([[Món ẩn]]) | 🍮 Thạch trà: 1 phần/món | `petdex/server/rules/production.js:111` |
| [[Bếp]] ([[Món ẩn]]) | 🥮 Bánh sắn nướng: 1 phần/món | `petdex/server/rules/production.js:113` |
| [[Nhà máy đường]] (thành phẩm) | 1 lô/mẻ | `petdex/server/rules/production.js:144` |
| [[Hội]]: [[Dự án Dãy đèn lồng công viên]] | 20 lô | `petdex/server/rules/town.js:93` |
| [[Hội]]: [[Dự án Tiệc cá cuối tuần]] | 15 lô | `petdex/server/rules/town.js:96` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Mía đường]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Không kiểu thời tiết nào đẩy giá mặt hàng này.

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
