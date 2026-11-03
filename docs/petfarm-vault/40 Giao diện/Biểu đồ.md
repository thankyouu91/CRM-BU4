---
tags: [petfarm, giao-dien, render, bieu-do]
loai: ma-nguon
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/charts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Biểu đồ

> [!summary]
> `charts.js` (145 dòng) là bộ biểu đồ tự viết, không dùng thư viện: vẽ trên canvas ở **nửa độ phân giải** (`PIX = 2`) rồi phóng to sắc nét để hợp phong cách pixel, còn nhãn min/max là `<span class="chart-label">` HTML để chữ luôn rõ. Có 4 loại: đường có tô nền, nến, cột đôi thu/chi, sparkline.

## Bảng màu `COLORS`

| Khóa | Màu | Dùng cho |
|---|---|---|
| `up` | `#3fae7a` | đường đi lên, nến tăng |
| `down` | `#e0606f` | đường đi xuống, nến giảm |
| `line` | `#c8915f` | |
| `fill` | `rgba(200,145,95,0.18)` | |
| `grid` | `rgba(74,51,38,0.10)` | 3 vạch ngang |
| `income` | `#58b98d` | cột thu |
| `expense` | `#ef8a7a` | cột chi |
| `gold` | `#e7b53c` | |
| `blue` | `#58b9d6` | |

Nguồn `public/ta-tua/game/js/charts.js:4-14`. Một số màn truyền màu riêng (lãi suất cơ bản ở [[Màn Ngân hàng]] dùng `#58b9d6`).

## Hàm

| Hàm | Đầu vào | Cách vẽ | Nguồn |
|---|---|---|---|
| `setup(host, height)` (nội bộ) | | thêm lớp `chart`, tạo/tái dùng canvas `round(clientWidth/2) × round(height/2)`, xóa nhãn cũ | `charts.js:16-34` |
| `lineChart(host, values, {height=160, format, color})` | mảng số, tối thiểu 2 | lưới 3 vạch; tô nền dưới đường bằng màu nét + alpha `2e`; nét `pixelLine`; chấm 3×3 ở điểm cuối; màu mặc định xanh nếu điểm cuối ≥ điểm đầu, đỏ nếu không; nhãn max (trên phải), min (dưới phải) | `charts.js:65-92` |
| `candleChart(host, candles, {height=180, format})` | `[{open, high, low, close}]` | bấc 1 px, thân rộng `floor(slot) − 1` | `charts.js:94-113` |
| `barChart(host, rows, {height=150})` | `[{income, expense}]` | hai cột cạnh nhau mỗi ngày, nhãn giá trị lớn nhất góc trên trái | `charts.js:115-134` |
| `sparkline(host, values, {height=28})` | mảng số | chỉ nét, không lưới, không nhãn | `charts.js:136-145` |

## Nơi dùng

| Màn | Biểu đồ |
|---|---|
| [[Màn Sàn]] | `sparkline` mỗi hàng; `lineChart` 24 giờ hoặc `candleChart` 7 ngày, cao 170 |
| [[Màn Ngân hàng]] | 2 `lineChart` 110 px: chỉ số giá, lãi suất cơ bản |
| [[Màn Ví]] | `lineChart` tài sản ròng, `barChart` thu chi |
| [[Màn Quầy trà sữa]] | `barChart` doanh thu/chi phí 7 ngày |
| [[Màn Khu công nghiệp]] | `barChart` thu gia công/thuê + lương mỗi xưởng |
| [[Màn Clan]] (tab Vĩ mô) | không dùng `charts.js`: SVG `polyline` tự dựng cho chỉ số giá đất 14 ngày |

> [!info] Vẽ một lần
> Biểu đồ đo `host.clientWidth` lúc vẽ và không tự vẽ lại khi đổi cỡ cửa sổ; chỉ vẽ lại khi màn vẽ lại.

## Liên quan
- [[Vẽ pixel]], [[Phong cách và CSS]], [[Kiến trúc giao diện game]]
