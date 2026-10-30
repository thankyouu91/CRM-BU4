---
tags: [petfarm, kinh-te, toa-thi-chinh, de-xuat, newbie_fund]
loai: du-lieu
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/town.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🐣 Quỹ chào tân thủ, newbie_fund]
---
# Đề xuất Quỹ chào tân thủ

> [!summary]
> 🐣 **Quỹ chào tân thủ** (`newbie_fund`): một trong 6 đề xuất chi [[Ngân sách thị trấn]] mà [[Tòa thị chính]] có thể bốc ra cho người chơi bỏ phiếu mỗi tuần. Giá **1.000 xu**. Trợ cấp tân thủ tăng từ 30 lên 50 xu/ngày trong 1 tuần (vẫn chỉ cho tài khoản dưới 7 ngày tuổi, vẫn trả từ ngân sách).

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Chi phí từ ngân sách | 1.000 xu (không nhân chỉ số giá) | `petdex/server/rules/town.js:27` |
| Loại hiệu ứng (`town_effects.kind`) | `stipend` | `petdex/server/rules/town.js:27` |
| Đối tượng | mọi người/mọi quầy | `petdex/server/rules/town.js:27` |
| Giá trị | 50 xu/ngày | `petdex/server/rules/town.js:27` |
| Thời gian | 7 ngày kể từ nửa đêm Chủ nhật đóng phiên | `petdex/server/town.js:96-104,107-127` |

## Cách áp dụng
- `stipendAmount` lấy max(30, các hiệu ứng `stipend` đang chạy) (`petdex/server/town.js:59-62`); trả khi người chơi mới bấm [[Quà ngày]].
- Chỉ áp dụng nếu ngân sách đủ tiền lúc đóng phiên; nếu không, đề xuất thắng phiếu được ghi `unfunded` và có tin "… thắng phiếu nhưng ngân sách chưa đủ … xu" (`petdex/server/town.js:113-124`).

## Liên quan
- [[Tòa thị chính]] · [[Ngân sách thị trấn]] · [[MOC Kinh tế và cộng đồng]]
