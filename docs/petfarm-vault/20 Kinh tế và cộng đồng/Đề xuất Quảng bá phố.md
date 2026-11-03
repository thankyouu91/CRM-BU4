---
tags: [petfarm, kinh-te, toa-thi-chinh, de-xuat, promote_town]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [📣 Quảng bá phố, promote_town]
---
# Đề xuất Quảng bá phố

> [!summary]
> 📣 **Quảng bá phố** (`promote_town`): một trong 6 đề xuất chi [[Ngân sách thị trấn]] mà [[Tòa thị chính]] có thể bốc ra cho người chơi bỏ phiếu mỗi tuần. Giá **2.500 xu**. +10% khách cho mọi quầy trong 1 tuần.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Chi phí từ ngân sách | 2.500 xu (không nhân chỉ số giá) | `petdex/server/rules/town.js:26` |
| Loại hiệu ứng (`town_effects.kind`) | `traffic` | `petdex/server/rules/town.js:26` |
| Đối tượng | mọi người/mọi quầy | `petdex/server/rules/town.js:26` |
| Giá trị | +10% | `petdex/server/rules/town.js:26` |
| Thời gian | 7 ngày kể từ nửa đêm Chủ nhật đóng phiên | `petdex/server/town.js:96-104,107-127` |

## Cách áp dụng
- `trafficBonus` cộng giá trị vào `bonus` trong công thức khách/giờ của mọi quầy hợp `target` (`petdex/server/town.js:51-55`, `petdex/server/business.js:108`). Cộng dồn với hiệu ứng pha kinh tế của [[Kinh tế vĩ mô]] (cũng là `traffic`).
- Chỉ áp dụng nếu ngân sách đủ tiền lúc đóng phiên; nếu không, đề xuất thắng phiếu được ghi `unfunded` và có tin "… thắng phiếu nhưng ngân sách chưa đủ … xu" (`petdex/server/town.js:113-124`).

## Liên quan
- [[Tòa thị chính]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
