---
tags: [petfarm, kinh-te, toa-thi-chinh, de-xuat, bridge]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌉 Xây cầu Phố–Hẻm, bridge]
---
# Đề xuất Xây cầu Phố–Hẻm

> [!summary]
> 🌉 **Xây cầu Phố–Hẻm** (`bridge`): một trong 6 đề xuất chi [[Ngân sách thị trấn]] mà [[Tòa thị chính]] có thể bốc ra cho người chơi bỏ phiếu mỗi tuần. Giá **3.000 xu**. +15% khách cho các quầy ở [[Quầy ở Hẻm nhỏ|Hẻm nhỏ]] trong 2 tuần.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Chi phí từ ngân sách | 3.000 xu (không nhân chỉ số giá) | `petdex/server/rules/town.js:22` |
| Loại hiệu ứng (`town_effects.kind`) | `traffic` | `petdex/server/rules/town.js:22` |
| Đối tượng | `alley` | `petdex/server/rules/town.js:22` |
| Giá trị | +15% | `petdex/server/rules/town.js:22` |
| Thời gian | 14 ngày kể từ nửa đêm Chủ nhật đóng phiên | `petdex/server/town.js:96-104,107-127` |

## Cách áp dụng
- `trafficBonus` cộng giá trị vào `bonus` trong công thức khách/giờ của mọi quầy hợp `target` (`petdex/server/town.js:51-55`, `petdex/server/business.js:108`). Cộng dồn với hiệu ứng pha kinh tế của [[Kinh tế vĩ mô]] (cũng là `traffic`).
- Chỉ áp dụng nếu ngân sách đủ tiền lúc đóng phiên; nếu không, đề xuất thắng phiếu được ghi `unfunded` và có tin "… thắng phiếu nhưng ngân sách chưa đủ … xu" (`petdex/server/town.js:113-124`).

## Liên quan
- [[Tòa thị chính]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
