---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, tea_leaf]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍃 Lá trà tươi, tea_leaf]
---
# Lá trà tươi

> [!summary]
> 🍃 **Lá trà tươi** (mã `tea_leaf`) là hàng **thô** trên [[Sàn Nguyên Liệu]], giá gốc **12 xu/lô** (10 phần), biến động 12%/ngày, hư sau **2 ngày**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | thô (`raw`) | `petdex/server/rules/market.js:8` |
| Giá gốc | 12 xu/lô (1,2 xu/phần) | `petdex/server/rules/market.js:8` |
| Biến động ngày (`vol`) | 0,12 | `petdex/server/rules/market.js:8` |
| Hạn dùng | 2 ngày kể từ lúc nhập kho | `petdex/server/rules/market.js:8,111` |
| Độ sâu thanh khoản NPC | 200 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 3 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `12 × chỉ số giá × drift (0,8–1,25) × tin` | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Mưa lớn ở đồi chè, lá trà khan hiếm" | `petdex/server/rules/market.js:42` |
| Tin giảm giá | "Đồi chè trúng mùa, lá trà dồi dào" | `petdex/server/rules/market.js:42` |

## Có từ đâu
- Trồng ở [[Vườn]]: 🍃 Chè, 6 giờ, hạt giống 8 xu (× [[Chỉ số giá]]), sản lượng 10–20 phần (`petdex/server/rules/production.js:79`).
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].
- Vật liệu rớt ngẫu nhiên sau mỗi ván [[Mini-game]] (chỉ hàng thô, tỷ lệ và số lô do quản trị viên đặt, tăng theo May mắn) (`petdex/server/minigames.js:16,63-76`).

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Bếp]] ([[Món ẩn]]) | 🍲 Canh cá lá trà: 1 phần/món | `petdex/server/rules/production.js:112` |
| [[Xưởng sấy trà]] (đầu vào) | 2 lô/mẻ | `petdex/server/rules/production.js:142` |
| [[Hội]]: [[Dự án Quán trà miễn phí]] | 40 lô | `petdex/server/rules/town.js:95` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Trà (lá trà, trà khô)]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Thời tiết: [[Thời tiết Thời tiết thuận lợi]] (-6% giá trong ngày), [[Thời tiết Mưa lớn nhiều ngày]] (+10% giá trong ngày), [[Thời tiết Rét đậm]] (+6% giá trong ngày) (`public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:81-83`).

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
