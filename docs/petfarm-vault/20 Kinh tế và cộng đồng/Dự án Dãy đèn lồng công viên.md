---
tags: [petfarm, kinh-te, hoi, du-an-tuan, lanterns]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/social.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🏮 Dãy đèn lồng công viên, lanterns]
---
# Dự án Dãy đèn lồng công viên

> [!summary]
> 🏮 **Dãy đèn lồng công viên** (`lanterns`): một trong 4 dự án tuần của [[Hội]]. Thành viên góp đủ **20 lô [[Trà khô]]** và **20 lô [[Đường nâu]]** từ [[Kho Sàn]] thì Hội được **+100 danh vọng** và mỗi thành viên nhận **40 xu** từ [[Ngân sách thị trấn]].

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Nguyên liệu cần | 20 lô Trà khô, 20 lô Đường nâu | `petdex/server/rules/town.js:93` |
| Giá trị nguyên liệu theo giá gốc | khoảng 1.000 xu | `petdex/server/rules/market.js:7-18` |
| Danh vọng | +100 | `petdex/server/rules/town.js:93` |
| Thưởng mỗi thành viên | 40 xu (tối đa 800 xu cho Hội 20 người) | `petdex/server/rules/town.js:93`, `petdex/server/social.js:308-315` |

## Ghi chú
- Dự án của tuần được chọn cố định theo `(id Hội + số tuần YYYYMMDD) mod 4` (`petdex/server/social.js:169-173`), nên các Hội khác nhau có thể làm dự án khác nhau trong cùng tuần.
- Thưởng trả lần lượt từng thành viên (theo số đã góp giảm dần); ngân sách cạn giữa chừng thì người sau không nhận (`petdex/server/social.js:309-314`).

## Liên quan
- [[Hội]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
