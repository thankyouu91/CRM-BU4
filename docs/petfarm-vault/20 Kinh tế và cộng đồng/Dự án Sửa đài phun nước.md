---
tags: [petfarm, kinh-te, hoi, du-an-tuan, fountain]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/social.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [⛲ Sửa đài phun nước, fountain]
---
# Dự án Sửa đài phun nước

> [!summary]
> ⛲ **Sửa đài phun nước** (`fountain`): một trong 4 dự án tuần của [[Hội]]. Thành viên góp đủ **30 lô [[Củ sắn]]** và **30 lô [[Mía]]** từ [[Kho Sàn]] thì Hội được **+100 danh vọng** và mỗi thành viên nhận **40 xu** từ [[Ngân sách thị trấn]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Nguyên liệu cần | 30 lô Củ sắn, 30 lô Mía | `petdex/server/rules/town.js:94` |
| Giá trị nguyên liệu theo giá gốc | khoảng 480 xu | `petdex/server/rules/market.js:7-18` |
| Danh vọng | +100 | `petdex/server/rules/town.js:94` |
| Thưởng mỗi thành viên | 40 xu (tối đa 800 xu cho Hội 20 người) | `petdex/server/rules/town.js:94`, `petdex/server/social.js:308-315` |

## Ghi chú
- Dự án của tuần được chọn cố định theo `(id Hội + số tuần YYYYMMDD) mod 4` (`petdex/server/social.js:169-173`), nên các Hội khác nhau có thể làm dự án khác nhau trong cùng tuần.
- Thưởng trả lần lượt từng thành viên (theo số đã góp giảm dần); ngân sách cạn giữa chừng thì người sau không nhận (`petdex/server/social.js:309-314`).

## Liên quan
- [[Hội]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
