---
tags: [petfarm, luat-choi, qua-ngay, tan-thu]
aliases: [Trợ cấp, Stipend, Quỹ chào tân thủ]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/town.js, petdex/server/routes.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Trợ cấp tân thủ

> [!summary]
> Trong 7 ngày đầu kể từ lúc tạo tài khoản, mỗi lần bấm [[Quà ngày]] người chơi nhận thêm **30 xu** trợ cấp, lấy từ [[Ngân sách thị trấn]]. Nếu tuần đó Tòa thị chính chọn đề xuất "🐣 Quỹ chào tân thủ", trợ cấp lên 50 xu/ngày.

## Con số
| Mục | Giá trị | Nguồn |
|---|---|---|
| Mức cơ bản | 30 xu/ngày | `petdex/server/rules/town.js:17` |
| Thời hạn | 7 × 24 giờ kể từ `created_at` | `petdex/server/rules/town.js:17`, `petdex/server/town.js:67` |
| Đề xuất "Quỹ chào tân thủ" | 1.000 xu ngân sách, trợ cấp 50 xu/ngày trong 7 ngày | `petdex/server/rules/town.js:27` |

## Công thức
```
nếu now − created_at < 7 ngày:
  mức = max(30, các hiệu ứng "stipend" đang chạy)
  trả = min(mức, số dư ngân sách thị trấn)
```
(`stipendAmount`, `payStipend`, `petdex/server/town.js:59-73`.) Ghi sổ hai dòng loại `stipend`: trừ tài khoản `treasury`, cộng người chơi.

## Trường hợp đặc biệt
- Chỉ trả khi **bấm Quà ngày**; ngày nào quên bấm thì mất trợ cấp ngày đó.
- Ngân sách cạn thì trả ít hơn hoặc không trả; lời báo quà ngày khi đó không có phần "trợ cấp tân thủ".
- Bảy ngày tính theo giờ thật từ lúc tạo, không theo ngày lịch: tài khoản tạo lúc 23:00 có thể nhận trợ cấp 8 lần lịch khác nhau nếu bấm ngay lúc tạo và mỗi ngày sau đó trước 23:00 ngày thứ 7.

> [!warning] Lệch tài liệu
> `petdex/README.md:74` ghi "Trợ cấp tân thủ 30 xu/ngày trong 7 ngày đầu" nhưng không nói chỉ trả khi bấm Quà ngày và phụ thuộc ngân sách thị trấn.

## Liên quan
- [[Quà ngày]] · [[Ngân sách thị trấn]] · [[Tòa thị chính]] · [[Tài khoản người chơi]]
