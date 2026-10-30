---
tags: [petfarm, kinh-te, san-nguyen-lieu, mat-hang, fish]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/market.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🐟 Cá tươi, fish]
---
# Cá tươi

> [!summary]
> 🐟 **Cá tươi** (mã `fish`) là hàng **thô** trên [[Sàn Nguyên Liệu]], giá gốc **60 xu/lô** (10 phần), biến động 12%/ngày, hư sau **2 ngày**. Thuộc nhóm [[Mặt hàng nguyên liệu]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Loại | thô (`raw`) | `petdex/server/rules/market.js:13` |
| Giá gốc | 60 xu/lô (6 xu/phần) | `petdex/server/rules/market.js:13` |
| Biến động ngày (`vol`) | 0,12 | `petdex/server/rules/market.js:13` |
| Hạn dùng | 2 ngày kể từ lúc nhập kho | `petdex/server/rules/market.js:13,111` |
| Độ sâu thanh khoản NPC | 200 lô làm giá dịch 100% | `petdex/server/rules/market.js:25-26,102` |
| Giá sàn | 15 xu/lô (25% giá gốc) | `petdex/server/rules/market.js:83` |
| Giá trung bình | `60 × chỉ số giá × drift (0,8–1,25) × tin` | `petdex/server/rules/market.js:66-76` |
| Tin tăng giá | "Biển động, thuyền không ra khơi" | `petdex/server/rules/market.js:47` |
| Tin giảm giá | "Mùa cá về, lưới đầy ắp" | `petdex/server/rules/market.js:47` |

## Có từ đâu
- [[Câu cá]] trong [[Mini-game]]: tối đa 10 phần cá/ngày (`public/ta-tua/game/js/shared/minigames.js:11`, `petdex/server/minigames.js:98-104`).
- Mua trên [[Sàn Nguyên Liệu]] (NPC hoặc lệnh chờ của người khác) hoặc nhận qua [[Hợp đồng cung ứng]].
- Vật liệu rớt ngẫu nhiên sau mỗi ván [[Mini-game]] (chỉ hàng thô, tỷ lệ và số lô do quản trị viên đặt, tăng theo May mắn) (`petdex/server/minigames.js:16,63-76`).

## Dùng vào đâu
| Nơi | Lượng | Nguồn |
|---|---|---|
| [[Bếp]] | 🐟 Cá nướng: 2 phần/món | `petdex/server/rules/production.js:109` |
| [[Bếp]] ([[Món ẩn]]) | 🍲 Canh cá lá trà: 1 phần/món | `petdex/server/rules/production.js:112` |
| [[Hội]]: [[Dự án Tiệc cá cuối tuần]] | 10 lô | `petdex/server/rules/town.js:96` |

## Tác động vĩ mô
- Cú sốc cầu của [[Ngành Thủy hải sản]], [[Ngành Ẩm thực & nhà hàng]] đăng tin đẩy giá mặt hàng này một nửa độ lớn cú sốc trong ngày (`petdex/server/macro.js:84-89`). Xem [[Kinh tế vĩ mô]].
- Thời tiết: [[Thời tiết Bão biển]] (+20% giá trong ngày) (`public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:81-83`).

## Liên quan
- [[Mặt hàng nguyên liệu]] · [[Sàn Nguyên Liệu]] · [[Kho Sàn]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
