---
tags: [petfarm, giao-dien, man-hinh, bao]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/news.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Báo Trân Châu

> [!summary]
> Tờ báo của thị trấn (`#news`, tòa 📰): danh sách tin thị trường và thông báo chính thức (của Ngân hàng Trung ương, Tòa thị chính). Màn chỉ đọc, file nhỏ nhất trong `views/` (30 dòng). Nội dung tin do máy chủ tạo, xem [[Báo Trân Châu]] và [[Tin tức thị trường]].

## Hiển thị

| Phần | Nội dung | Nguồn |
|---|---|---|
| Đầu màn | "📰 Báo Trân Châu", "Số ra {thứ, ngày/tháng/năm}" theo giờ máy người chơi (`toLocaleDateString('vi-VN', {weekday:'long'…})`) | `public/ta-tua/game/js/views/news.js:5-7` |
| Đang tải | "Đang tải…" | `news.js:8` |
| Rỗng | "🗞️ Thị trấn hôm nay yên ả, chưa có tin gì." | `news.js:14-16` |
| Tin mặt hàng | icon mặt hàng, tiêu đề đậm, "{tên} · dự báo tăng giá ▲ / giảm giá ▼ · {n phút trước}", nút "Xem Sàn" → [[Màn Sàn]] | `news.js:18-27` |
| Tin chính thức | không có `commodity`: icon 🏛️, lớp `official` (nền khác), không có nút | `news.js:19-22` |

API: `GET /news` một lần khi mở màn (`news.js:12`). Thời gian tương đối dùng `ago()` ("vừa xong", "n phút trước", "n giờ trước", "n ngày trước": `public/ta-tua/game/js/ui.js:92-98`). Không có làm mới định kỳ.

> [!tip]
> Khác với khung "📰 Tin thị trường" trong [[Màn Sàn]], tờ báo không hiện tin sớm cho bé Thông minh; tin sớm chỉ có ở `GET /market` (`petdex/server/market.js:383-393`).

## Liên quan
- [[Báo Trân Châu]], [[Tin tức thị trường]], [[Ngân hàng Trung ương]]
- [[Màn Sàn]], [[Màn Phố]]
