---
tags: [petfarm, giao-dien, man-hinh, bang-vang, doi-sao]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Bảng vàng

> [!summary]
> Màn xếp hạng (`#ranks`, tòa 🏆 Bảng vàng ở hàng dưới bản đồ) có 3 tab: cấp độ, tài sản ròng ("Forbes Phố Trân Châu") và Đồi Sao (tưởng niệm các bé đã mất). Đây là màn bất đồng bộ duy nhất trong `app.js`: vẽ khung trước, gọi API rồi mới đổ danh sách, có chống ghi đè khi người chơi đã chuyển màn.

## Tab và API

| Tab (`data-ranks`) | Tiêu đề | Phụ đề | API | Hàng |
|---|---|---|---|---|
| `level` (mặc định) | 🏆 Bảng vàng | "20 bé cấp cao nhất cả phố." | `GET /leaderboard` | 🥇🥈🥉 rồi số; avatar bé; "của {chủ} · n tuần tuổi"; "Lv n" |
| `networth` | 🏆 Bảng vàng | "\"Forbes Phố Trân Châu\": 20 người có tài sản ròng lớn nhất." | `GET /leaderboard?by=networth` | huy chương, tên người, "💎 {tổng} 🪙" (không avatar) |
| `stars` | 🌠 Đồi Sao | "Nơi các bé đã về với sao trời được nhớ mãi." | `GET /memorials?scope=all` | 🕯️, avatar dáng già, "{loài} của {chủ} · sống n tuần · về với sao trời {ngày}", "Lv n" |

Nguồn: `public/ta-tua/game/js/app.js:944-1013`. Hàng của chính mình có lớp `me` (tô nổi).

## Chi tiết hiển thị

- Avatar: `createPetFigure(species, 0.3, wear, {stage, ageScale: 1, level})`. Bảng vàng chỉ gửi số tuần nên client suy giai đoạn tuổi bằng `stageOfWeeks(weeks)` (giai đoạn cuối cùng có `minDays <= weeks*7`) (`app.js:90`, `app.js:1008`). Đồi Sao luôn vẽ dáng `elder` (`app.js:980`).
- Chống race: lưu `seq = renderSeq` trước khi gọi API, bỏ kết quả nếu `renderSeq` đã đổi (`app.js:945`, `app.js:964`).
- Rỗng: "Chưa có bé nào. Hãy là người đầu tiên!", "Chưa có ai.", "Đồi Sao còn trống. Mong các bé sống thật lâu." Lỗi API in thẳng thông báo vào thẻ.
- Vào thẳng tab Đồi Sao từ thẻ tưởng niệm ở [[Màn Nhà]]: nút có `data-go="ranks" data-ranks-go="stars"`; trình click toàn cục gán `state.ranksBy` trước khi `go()` (`app.js:1200-1201`).

## Liên quan
- [[Bảng vàng]], [[Vòng đời và Đồi Sao]], [[Ví và tài sản ròng]]
- [[Màn Phố]], [[Màn Nhà]], [[Sprite và bảng hình]], [[App shell]]
