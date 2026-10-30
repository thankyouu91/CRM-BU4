---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, condensed]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍼 Sữa đặc, condensed]
---
# Sữa đặc

> [!summary]
> 🍼 **Sữa đặc** (mã `condensed`) là hàng **chế biến** trên [[Sàn Nguyên Liệu]], giá gốc **40 xu/lô** (10 phần), biến động 6%/ngày, hư sau **7 ngày**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | chế biến (`processed`) | `petdex/server/rules/market.js:17` |
| Giá gốc | 40 xu/lô (4 xu/phần) | `petdex/server/rules/market.js:17` |
| Biến động ngày (`vol`) | 0,06 | `petdex/server/rules/market.js:17` |
| Hạn dùng | 7 ngày kể từ lúc nhập kho | `petdex/server/rules/market.js:17,111` |
| Độ sâu thanh khoản NPC | 600 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 10 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `40 × (giá hiện tại đầu vào ÷ giá gốc đầu vào) × tin`, đầu vào: 1 lô [[Sữa tươi]] (gốc 30) | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Thiếu hộp thiếc, sữa đặc khó đóng gói" | `petdex/server/rules/market.js:51` |
| Tin giảm giá | "Lò sữa đặc tăng ca" | `petdex/server/rules/market.js:51` |

## Có từ đâu
- Chế biến ở [[Lò sữa đặc]] từ 1 lô [[Sữa tươi]].
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Quầy trà sữa]] | 🍼 Trà sữa sữa đặc: 1 phần/ly | `petdex/server/rules/business.js:18` |
| [[Bếp]] ([[Món ẩn]]) | 🥮 Bánh sắn nướng: 1 phần/món | `petdex/server/rules/production.js:113` |
| [[Lò sữa đặc]] (thành phẩm) | 1 lô/mẻ | `petdex/server/rules/production.js:145` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Bò sữa & sữa đặc]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Không kiểu thời tiết nào đẩy giá mặt hàng này.

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
