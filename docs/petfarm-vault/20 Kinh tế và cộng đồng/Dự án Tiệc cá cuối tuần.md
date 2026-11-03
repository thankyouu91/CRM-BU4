---
tags: [petfarm, kinh-te, hoi, du-an-tuan, fish_feast]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/social.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🐟 Tiệc cá cuối tuần, fish_feast]
---
# Dự án Tiệc cá cuối tuần

> [!summary]
> 🐟 **Tiệc cá cuối tuần** (`fish_feast`): một trong 4 dự án tuần của [[Hội]]. Thành viên góp đủ **10 lô [[Cá tươi]]** và **15 lô [[Đường nâu]]** từ [[Kho Sàn]] thì Hội được **+120 danh vọng** và mỗi thành viên nhận **50 xu** từ [[Ngân sách thị trấn]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Nguyên liệu cần | 10 lô Cá tươi, 15 lô Đường nâu | `petdex/server/rules/town.js:96` |
| Giá trị nguyên liệu theo giá gốc | khoảng 825 xu | `petdex/server/rules/market.js:7-18` |
| Danh vọng | +120 | `petdex/server/rules/town.js:96` |
| Thưởng mỗi thành viên | 50 xu (tối đa 1000 xu cho Hội 20 người) | `petdex/server/rules/town.js:96`, `petdex/server/social.js:308-315` |

## Ghi chú
- Dự án của tuần được chọn cố định theo `(id Hội + số tuần YYYYMMDD) mod 4` (`petdex/server/social.js:169-173`), nên các Hội khác nhau có thể làm dự án khác nhau trong cùng tuần.
- Thưởng trả lần lượt từng thành viên (theo số đã góp giảm dần); ngân sách cạn giữa chừng thì người sau không nhận (`petdex/server/social.js:309-314`).

## Liên quan
- [[Hội]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
