---
tags: [petfarm, kinh-te, hoi, du-an-tuan, tea_stall]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/social.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🍵 Quán trà miễn phí cho người qua đường, tea_stall]
---
# Dự án Quán trà miễn phí

> [!summary]
> 🍵 **Quán trà miễn phí cho người qua đường** (`tea_stall`): một trong 4 dự án tuần của [[Hội]]. Thành viên góp đủ **40 lô [[Lá trà tươi]]** và **15 lô [[Sữa tươi]]** từ [[Kho Sàn]] thì Hội được **+120 danh vọng** và mỗi thành viên nhận **50 xu** từ [[Ngân sách thị trấn]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Nguyên liệu cần | 40 lô Lá trà tươi, 15 lô Sữa tươi | `petdex/server/rules/town.js:95` |
| Giá trị nguyên liệu theo giá gốc | khoảng 930 xu | `petdex/server/rules/market.js:7-18` |
| Danh vọng | +120 | `petdex/server/rules/town.js:95` |
| Thưởng mỗi thành viên | 50 xu (tối đa 1000 xu cho Hội 20 người) | `petdex/server/rules/town.js:95`, `petdex/server/social.js:308-315` |

## Ghi chú
- Dự án của tuần được chọn cố định theo `(id Hội + số tuần YYYYMMDD) mod 4` (`petdex/server/social.js:169-173`), nên các Hội khác nhau có thể làm dự án khác nhau trong cùng tuần.
- Thưởng trả lần lượt từng thành viên (theo số đã góp giảm dần); ngân sách cạn giữa chừng thì người sau không nhận (`petdex/server/social.js:309-314`).

## Liên quan
- [[Hội]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
