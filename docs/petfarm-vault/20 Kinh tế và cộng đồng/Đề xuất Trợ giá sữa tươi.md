---
tags: [petfarm, kinh-te, toa-thi-chinh, de-xuat, milk_subsidy]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥛 Trợ giá sữa tươi, milk_subsidy]
---
# Đề xuất Trợ giá sữa tươi

> [!summary]
> 🥛 **Trợ giá sữa tươi** (`milk_subsidy`): một trong 6 đề xuất chi [[Ngân sách thị trấn]] mà [[Tòa thị chính]] có thể bốc ra cho người chơi bỏ phiếu mỗi tuần. Giá **1.500 xu**. Đăng một tin hiệu lực −15% lên giá trung bình của [[Sữa tươi]] trên Sàn trong 3 ngày.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Chi phí từ ngân sách | 1.500 xu (không nhân chỉ số giá) | `petdex/server/rules/town.js:25` |
| Loại hiệu ứng (`town_effects.kind`) | `news` | `petdex/server/rules/town.js:25` |
| Đối tượng | `milk` | `petdex/server/rules/town.js:25` |
| Giá trị | -15% | `petdex/server/rules/town.js:25` |
| Thời gian | 3 ngày kể từ nửa đêm Chủ nhật đóng phiên | `petdex/server/town.js:96-104,107-127` |

## Cách áp dụng
- `applyEffect` chèn một dòng `news` có `effect = −0,15` cho `milk`, nhân vào giá trung bình ở mọi nhịp trong 3 ngày; tin có tiêu đề "Tòa thị chính trợ giá: trợ giá sữa tươi" (`petdex/server/town.js:100-102`, `petdex/server/market.js:340`).
- Chỉ áp dụng nếu ngân sách đủ tiền lúc đóng phiên; nếu không, đề xuất thắng phiếu được ghi `unfunded` và có tin "… thắng phiếu nhưng ngân sách chưa đủ … xu" (`petdex/server/town.js:113-124`).

## Liên quan
- [[Tòa thị chính]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
