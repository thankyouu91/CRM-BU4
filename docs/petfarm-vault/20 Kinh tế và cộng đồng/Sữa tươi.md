---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, milk]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥛 Sữa tươi, milk]
---
# Sữa tươi

> [!summary]
> 🥛 **Sữa tươi** (mã `milk`) là hàng **thô** trên [[Sàn Nguyên Liệu]], giá gốc **30 xu/lô** (10 phần), biến động 10%/ngày, hư sau **3 ngày**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | thô (`raw`) | `petdex/server/rules/market.js:9` |
| Giá gốc | 30 xu/lô (3 xu/phần) | `petdex/server/rules/market.js:9` |
| Biến động ngày (`vol`) | 0,1 | `petdex/server/rules/market.js:9` |
| Hạn dùng | 3 ngày kể từ lúc nhập kho | `petdex/server/rules/market.js:9,111` |
| Độ sâu thanh khoản NPC | 200 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 7,5 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `30 × chỉ số giá × drift (0,8–1,25) × tin` | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Đàn bò nghỉ sữa, sữa tươi giảm sản lượng" | `petdex/server/rules/market.js:43` |
| Tin giảm giá | "Trang trại mở rộng đàn bò, sữa về nhiều" | `petdex/server/rules/market.js:43` |

## Có từ đâu
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].
- Vật liệu rớt ngẫu nhiên sau mỗi ván [[Mini-game]] (chỉ hàng thô, tỷ lệ và số lô do quản trị viên đặt, tăng theo May mắn) (`petdex/server/minigames.js:16,63-76`).

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Quầy trà sữa]] | 🧋 Trà sữa trân châu: 1 phần/ly | `petdex/server/rules/business.js:13` |
| [[Quầy trà sữa]] | 🥤 Trà sữa truyền thống: 1 phần/ly | `petdex/server/rules/business.js:14` |
| [[Quầy trà sữa]] | 🥛 Sữa tươi trân châu đường đen: 1 phần/ly | `petdex/server/rules/business.js:15` |
| [[Quầy trà sữa]] | 🍹 Sinh tố dâu sữa: 1 phần/ly | `petdex/server/rules/business.js:17` |
| [[Bếp]] | 🧋 Trà sữa nhà làm: 1 phần/món | `petdex/server/rules/production.js:107` |
| [[Bếp]] | 🍹 Sinh tố dâu: 1 phần/món | `petdex/server/rules/production.js:108` |
| [[Bếp]] | 🍰 Bánh dâu: 1 phần/món | `petdex/server/rules/production.js:110` |
| [[Lò sữa đặc]] (đầu vào) | 1 lô/mẻ | `petdex/server/rules/production.js:145` |
| [[Hội]]: [[Dự án Quán trà miễn phí]] | 15 lô | `petdex/server/rules/town.js:95` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Bò sữa & sữa đặc]], [[Ngành Chuỗi trà sữa]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Thời tiết: [[Thời tiết Nắng nóng kéo dài]] (+8% giá trong ngày) (`public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:81-83`).
- Đề xuất [[Đề xuất Trợ giá sữa tươi]] của [[Tòa thị chính]] đăng tin −15% trong 3 ngày (`petdex/server/rules/town.js:25`, `petdex/server/town.js:96-104`).

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
