---
tags: [petfarm, luat-choi, tin-tuc]
aliases: [Báo, Tin tức, News]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/news.js, petdex/server/routes-economy.js, petdex/server/lifecycle.js, petdex/server/market.js, petdex/server/bank.js, petdex/server/business.js, petdex/server/factory.js, petdex/server/clans.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Báo Trân Châu

> [!summary]
> 📰 Báo Trân Châu là bảng tin chung của phố: tin thị trường (dự báo giá từng mặt hàng tăng/giảm) và thông báo "chính thức" (Ngân hàng Trung ương, quầy/xưởng đóng cửa, bé về với sao trời, gia tộc, đất đai, kinh tế vĩ mô). Người chơi đọc để đón sóng giá trên Sàn và biết chuyện trong phố.

## Cách hoạt động
- API `GET /news`: tối đa 40 tin tạo trong **3 ngày** qua và đã tới giờ đăng (`starts_at ≤ now`), mới nhất trước; mỗi tin `{commodity, headline, up, at}` (`petdex/server/routes-economy.js:126-135`).
- Màn: tiêu đề "📰 Báo Trân Châu · Số ra <thứ, ngày>" (`public/ta-tua/game/js/views/news.js:5-7`). Tin có mặt hàng hiện biểu tượng hàng, "dự báo tăng giá ▲ / giảm giá ▼" và nút "Xem Sàn"; tin không có mặt hàng hiện 🏛️ như tin chính thức. Báo trống: "Thị trấn hôm nay yên ả, chưa có tin gì." (`public/ta-tua/game/js/views/news.js:12-30`).

## Con số: nguồn tin
| Loại tin | Ví dụ tiêu đề | Thời gian hiện | Nguồn |
|---|---|---|---|
| Tin thị trường ngẫu nhiên | (tin của từng mặt hàng, làm giá lệch) | theo hiệu lực của tin | `petdex/server/market.js:336-338` |
| Bé về với sao trời | "🌠 <tên> của <chủ> đã về với sao trời sau N tuần" | 2 ngày | `petdex/server/lifecycle.js:93` |
| Ngân hàng Trung ương | thông báo họp tuần | | `petdex/server/bank.js:162` |
| Quầy đóng cửa vì nợ thuê | "Quầy "<tên>" đóng cửa vì nợ tiền thuê 3 ngày" | 2 ngày | `petdex/server/business.js:341` |
| Xưởng đóng cửa | "<xưởng> của <chủ> đóng cửa vì nợ tiền thuê đất" | 2 ngày | `petdex/server/factory.js:313` |
| Gia tộc ra mắt / thâu tóm ngành | "🏯 Gia tộc … ra mắt", "Gia tộc … thâu tóm ngành …" | 2 ngày | `petdex/server/clans.js:291,391` |
| Quỹ đất sắp cạn | "🏘️ Quỹ đất chỉ còn N lô, giá đất tăng mạnh" | 1 ngày | `petdex/server/clans.js:448` |
| Kinh tế vĩ mô, thời tiết | "<thời tiết>: thị trường lo thiếu hàng / dư hàng" | theo hiệu lực | `petdex/server/macro.js:82-88` |
| Đề xuất Tòa thị chính (trợ giá) | tin làm giá | 3 ngày | `petdex/server/town.js:21` |

Tin thị trường và tác động giá thuộc phần [[Tin tức thị trường]] (agent B).

## Trường hợp đặc biệt
- Tin "báo trước" (bắt đầu sau 30 phút) chưa hiện cho tới giờ `starts_at`.
- Báo là chung cho mọi người, không có tin riêng tư.

## Liên quan
- [[Tin tức thị trường]] · [[Sàn Nguyên Liệu]] · [[Ngân hàng Trung ương]] · [[Vòng đời và Đồi Sao]] · [[Clan]] · [[Kinh tế vĩ mô]] · [[Màn Báo]]
