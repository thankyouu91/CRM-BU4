---
tags: [petfarm, kinh-te, toa-thi-chinh, de-xuat, tax_cut]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [✂️ Giảm thuế, tax_cut]
---
# Đề xuất Giảm thuế

> [!summary]
> ✂️ **Giảm thuế** (`tax_cut`): một trong 6 đề xuất chi [[Ngân sách thị trấn]] mà [[Tòa thị chính]] có thể bốc ra cho người chơi bỏ phiếu mỗi tuần. Giá **1.500 xu**. [[Thuế thu nhập]] giảm 2 điểm % ở mọi bậc trong 1 tuần (bậc 0% vẫn 0%).

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Chi phí từ ngân sách | 1.500 xu (không nhân chỉ số giá) | `petdex/server/rules/town.js:24` |
| Loại hiệu ứng (`town_effects.kind`) | `tax_cut` | `petdex/server/rules/town.js:24` |
| Đối tượng | mọi người/mọi quầy | `petdex/server/rules/town.js:24` |
| Giá trị | +2% | `petdex/server/rules/town.js:24` |
| Thời gian | 7 ngày kể từ nửa đêm Chủ nhật đóng phiên | `petdex/server/town.js:96-104,107-127` |

## Cách áp dụng
- `taxCut(from)` đọc hiệu ứng tại đầu ngày, `incomeTax(taxable, cut)` trừ `cut` khỏi mọi thuế suất, không xuống dưới 0 (`petdex/server/town.js:57,133`, `petdex/server/rules/town.js:7-15`).
- Chỉ áp dụng nếu ngân sách đủ tiền lúc đóng phiên; nếu không, đề xuất thắng phiếu được ghi `unfunded` và có tin "… thắng phiếu nhưng ngân sách chưa đủ … xu" (`petdex/server/town.js:113-124`).

## Liên quan
- [[Tòa thị chính]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
