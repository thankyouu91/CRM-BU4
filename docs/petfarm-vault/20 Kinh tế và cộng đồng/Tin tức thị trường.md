---
tags: [petfarm, kinh-te, san-nguyen-lieu, tin-tuc]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/market.js, petdex/server/rules/market.js, petdex/server/macro.js, petdex/server/town.js, petdex/server/bank.js, petdex/server/routes-economy.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [News, Tin Sàn]
---
# Tin tức thị trường

> [!summary]
> Bảng `news` vừa là bản tin vừa là **cơ chế giá**: mỗi tin gắn mặt hàng có `effect` nhân vào giá trung bình của mặt hàng đó trong khoảng `starts_at`–`ends_at`. Tin đến từ 4 nguồn: tin ngẫu nhiên của Sàn, thời tiết và cú sốc ngành của [[Kinh tế vĩ mô]], đề xuất trợ giá của [[Tòa thị chính]], và các tin chung (Ngân hàng Trung ương, gia tộc, quầy đóng cửa) không tác động giá. Người chơi đọc ở [[Màn Sàn]] và [[Báo Trân Châu]].

## Các nguồn tin

| Nguồn | Mặt hàng | `effect` | Hiệu lực | Nguồn code |
|---|---|---|---|---|
| Tin ngẫu nhiên Sàn | 1 trong 10 | ±20–40% (50/50 lên/xuống) | bắt đầu sau 30 phút, kéo dài 6–24 giờ | `petdex/server/rules/market.js:114-126`, `petdex/server/market.js:336-339` |
| Thời tiết trong ngày | theo bảng `WEATHER.news` | −6% đến +20% | 0h–24h ngày đó | `public/ta-tua/game/js/shared/clan.js:556-563`, `petdex/server/macro.js:80-83` |
| Cú sốc cầu ngành | hàng của ngành | một nửa cú sốc (±5–10%) | 0h–24h | `petdex/server/macro.js:58-63,84-89` |
| Đề xuất "Trợ giá sữa tươi" | sữa tươi | −15% | 3 ngày | `petdex/server/town.js:100-102` |
| Ngân hàng Trung ương họp | không | 0 | 7 ngày | `petdex/server/bank.js:161-165` |
| Kết quả bỏ phiếu | không | 0 | 7 ngày | `petdex/server/town.js:121-123` |
| Gia tộc ra mắt / thâu tóm ngành / quỹ đất còn ≤ 20 lô | không | 0 | 1–2 ngày | `petdex/server/clans.js:291,391,448` |
| Quầy, xưởng đóng cửa vì nợ thuê | không | 0 | 2 ngày | `petdex/server/business.js:341`, `petdex/server/factory.js:313` |

## Công thức
- Xác suất có tin mới mỗi nhịp cho mỗi mặt hàng = `0,8 × 10 phút / 1 ngày` ≈ 0,56% (`petdex/server/market.js:336`).
- Hệ số tin = `Π (1 + effect)` của các tin đang hiệu lực (`petdex/server/market.js:340`); nhiều tin cùng lúc thì nhân dồn.
- Giá không nhảy ngay theo tin mà bị kéo dần với θ = 0,35/ngày về giá trung bình mới (xem [[Sàn Nguyên Liệu]]).

## Ai thấy tin khi nào
- Màn Sàn: 12 tin gắn mặt hàng mới nhất trong 2 ngày, đã bắt đầu; người có bé Thông minh ≥ 60 thấy cả tin **chưa bắt đầu** (đánh dấu `early`), tức sớm 30 phút (`petdex/server/market.js:355-387`).
- `GET /news`: 40 tin (mọi loại) tạo trong 3 ngày và đã bắt đầu (`petdex/server/routes-economy.js:126-133`).

## Tiêu đề tin ngẫu nhiên
Xem cặp "tăng/giảm" trong ghi chú từng mặt hàng ([[Mặt hàng nguyên liệu]]), nguồn `petdex/server/rules/market.js:41-52`.

## Liên quan
- [[Sàn Nguyên Liệu]] · [[Kinh tế vĩ mô]] · [[Tòa thị chính]] · [[Báo Trân Châu]] · [[Module market]] · [[MOC Kinh tế và cộng đồng]]
