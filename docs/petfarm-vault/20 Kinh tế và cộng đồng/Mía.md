---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, cane]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🎋 Mía, cane]
---
# Mía

> [!summary]
> 🎋 **Mía** (mã `cane`) là hàng **thô** trên [[Sàn Nguyên Liệu]], giá gốc **8 xu/lô** (10 phần), biến động 8%/ngày, **không hư**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | thô (`raw`) | `petdex/server/rules/market.js:11` |
| Giá gốc | 8 xu/lô (0,8 xu/phần) | `petdex/server/rules/market.js:11` |
| Biến động ngày (`vol`) | 0,08 | `petdex/server/rules/market.js:11` |
| Hạn dùng | không hư | `petdex/server/rules/market.js:11,111` |
| Độ sâu thanh khoản NPC | 200 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 2 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `8 × chỉ số giá × drift (0,8–1,25) × tin` | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Nắng hạn làm mía còi cọc" | `petdex/server/rules/market.js:45` |
| Tin giảm giá | "Mía ngọt trúng lớn khắp vùng" | `petdex/server/rules/market.js:45` |

## Có từ đâu
- Trồng ở [[Vườn]]: 🎋 Mía, 8 giờ, hạt giống 10 xu (× [[Chỉ số giá]]), sản lượng 20–30 phần (`petdex/server/rules/production.js:81`).
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].
- Vật liệu rớt ngẫu nhiên sau mỗi ván [[Mini-game]] (chỉ hàng thô, tỷ lệ và số lô do quản trị viên đặt, tăng theo May mắn) (`petdex/server/minigames.js:16,63-76`).

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Nhà máy đường]] (đầu vào) | 1 lô/mẻ | `petdex/server/rules/production.js:144` |
| [[Hội]]: [[Dự án Sửa đài phun nước]] | 30 lô | `petdex/server/rules/town.js:94` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Mía đường]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Thời tiết: [[Thời tiết Nắng nóng kéo dài]] (+10% giá trong ngày) (`public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:81-83`).

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
