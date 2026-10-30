---
tags: [petfarm, kinh-te, toa-thi-chinh, bo-phieu]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/town.js, petdex/server/rules/town.js, petdex/server/routes-community.js, petdex/server/scheduler.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🏛️ Tòa thị chính, Town hall]
---
# Tòa thị chính

> [!summary]
> Nơi người chơi thấy [[Ngân sách thị trấn]], [[Thuế thu nhập]] của mình 7 ngày gần nhất, các hiệu ứng thị trấn đang chạy, và **bỏ phiếu** mỗi tuần chọn 1 trong 3 đề xuất chi tiêu (bốc ngẫu nhiên từ 6). Đề xuất thắng được chi từ ngân sách lúc nửa đêm Chủ nhật nếu đủ tiền, rồi tạo hiệu ứng (thêm khách quầy, giảm thuế, trợ giá sữa, tăng trợ cấp tân thủ).

## Cách hoạt động
- **Tuần** tính theo giờ Việt Nam, khóa tuần = ngày thứ Hai (`weekKey`, `petdex/server/town.js:42-45`). Phiên đóng lúc `startOfDay(thứ Hai) + 7 ngày` (nửa đêm Chủ nhật) (`petdex/server/town.js:160`).
- Mỗi tuần `ensureProposals` bốc 3 trong 6 đề xuất bằng xáo trộn Fisher–Yates (`petdex/server/rules/town.js:30-37`, `petdex/server/town.js:75-78`).
- **Bỏ phiếu**: cần một bé cấp 3 (`UNLOCKS.townhall`), mỗi người 1 phiếu/tuần, đổi được sang đề xuất khác (phiếu cũ bị trừ). Lỗi: "Đề xuất này không có trong phiên bầu tuần này.", "Bạn đã bầu cho đề xuất này rồi." (`petdex/server/routes-community.js:44-47`, `petdex/server/town.js:80-93`).
- **Đóng phiên** (`closeWeek`, gọi trong `closeDay` của Chủ nhật): đề xuất nhiều phiếu nhất thắng, hòa thì chọn cái **rẻ hơn**, không ai bầu thì không làm gì (`petdex/server/rules/town.js:40-44`). Đủ ngân sách thì chi `town_spend` và áp hiệu ứng từ thời điểm đóng; ghi `funded`/`unfunded`, các đề xuất khác `lost`, đăng tin 7 ngày; mở phiên tuần mới (`petdex/server/town.js:107-127`, `petdex/server/scheduler.js:43-46`).

## 6 đề xuất

| Đề xuất | Giá | Hiệu ứng | Thời gian | Nguồn |
|---|---|---|---|---|
| 🌉 [[Đề xuất Xây cầu Phố–Hẻm]] | 3.000 | +15% khách quầy ở Hẻm nhỏ | 14 ngày | `petdex/server/rules/town.js:22` |
| 🎪 [[Đề xuất Lễ hội ẩm thực]] | 2.000 | +30% khách mọi quầy | 3 ngày | `petdex/server/rules/town.js:23` |
| ✂️ [[Đề xuất Giảm thuế]] | 1.500 | −2 điểm % mọi bậc thuế thu nhập | 7 ngày | `petdex/server/rules/town.js:24` |
| 🥛 [[Đề xuất Trợ giá sữa tươi]] | 1.500 | tin −15% giá sữa tươi | 3 ngày | `petdex/server/rules/town.js:25` |
| 📣 [[Đề xuất Quảng bá phố]] | 2.500 | +10% khách mọi quầy | 7 ngày | `petdex/server/rules/town.js:26` |
| 🐣 [[Đề xuất Quỹ chào tân thủ]] | 1.000 | trợ cấp tân thủ 50 xu/ngày | 7 ngày | `petdex/server/rules/town.js:27` |

## Màn hình (`townView`, `petdex/server/town.js:152-170`)
Ngân sách và dòng tiền 7 ngày, tuần hiện tại và giờ đóng, 3 đề xuất kèm số phiếu, phiếu của mình, hiệu ứng đang chạy (kể cả hiệu ứng khách từ [[Kinh tế vĩ mô]]), 6 kết quả gần nhất, mức giảm thuế, 7 ngày thuế của mình, nợ thuế, trợ cấp tân thủ.

> [!warning] Lệch tài liệu
> `petdex/docs/thiet-ke-mo-rong.md:55` ghi Tòa thị chính mở ở **cấp 5**; code mở bỏ phiếu ở **cấp 3** (`petdex/server/routes-economy.js:19`). README (`petdex/README.md:65`) đúng là cấp 3.

## Trường hợp đặc biệt
- Hiệu ứng `traffic` của đề xuất cộng dồn với hiệu ứng pha kinh tế; `tax_cut` cộng dồn nếu có nhiều (thực tế mỗi tuần chỉ một đề xuất thắng, nhưng Giảm thuế 7 ngày có thể chồng sang tuần sau nếu thắng hai tuần liền).
- Người chưa đủ cấp vẫn xem được màn (`GET /town` không khóa cấp).

## Liên quan
- [[Ngân sách thị trấn]] · [[Thuế thu nhập]] · [[Quầy trà sữa]] · [[Module town]] · [[Module rules-town]] · [[MOC Kinh tế và cộng đồng]]
