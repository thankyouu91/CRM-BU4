---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, strawberry]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍓 Dâu tây, strawberry]
---
# Dâu tây

> [!summary]
> 🍓 **Dâu tây** (mã `strawberry`) là hàng **thô** trên [[Sàn Nguyên Liệu]], giá gốc **40 xu/lô** (10 phần), biến động 15%/ngày, hư sau **3 ngày**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | thô (`raw`) | `petdex/server/rules/market.js:12` |
| Giá gốc | 40 xu/lô (4 xu/phần) | `petdex/server/rules/market.js:12` |
| Biến động ngày (`vol`) | 0,15 | `petdex/server/rules/market.js:12` |
| Hạn dùng | 3 ngày kể từ lúc nhập kho | `petdex/server/rules/market.js:12,111` |
| Độ sâu thanh khoản NPC | 200 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 10 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `40 × chỉ số giá × drift (0,8–1,25) × tin` | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Sương muối làm dập dâu" | `petdex/server/rules/market.js:46` |
| Tin giảm giá | "Dâu chín rộ khắp các vườn" | `petdex/server/rules/market.js:46` |

## Có từ đâu
- Trồng ở [[Vườn]]: 🍓 Dâu tây, 4 giờ, hạt giống 20 xu (× [[Chỉ số giá]]), sản lượng 10–12 phần (`petdex/server/rules/production.js:80`).
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].
- Vật liệu rớt ngẫu nhiên sau mỗi ván [[Mini-game]] (chỉ hàng thô, tỷ lệ và số lô do quản trị viên đặt, tăng theo May mắn) (`petdex/server/minigames.js:16,63-76`).

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Quầy trà sữa]] | 🍓 Trà dâu: 1 phần/ly | `petdex/server/rules/business.js:16` |
| [[Quầy trà sữa]] | 🍹 Sinh tố dâu sữa: 2 phần/ly | `petdex/server/rules/business.js:17` |
| [[Bếp]] | 🍹 Sinh tố dâu: 2 phần/món | `petdex/server/rules/production.js:108` |
| [[Bếp]] | 🍰 Bánh dâu: 2 phần/món | `petdex/server/rules/production.js:110` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Dâu tây & trái cây]], [[Ngành Ẩm thực & nhà hàng]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Thời tiết: [[Thời tiết Thời tiết thuận lợi]] (-6% giá trong ngày), [[Thời tiết Mưa lớn nhiều ngày]] (+12% giá trong ngày), [[Thời tiết Rét đậm]] (+10% giá trong ngày) (`public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:81-83`).

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
