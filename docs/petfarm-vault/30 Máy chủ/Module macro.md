---
tags: [petfarm, may-chu, module, vi-mo]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module macro

> [!summary]
> `petdex/server/macro.js` (127 dòng): kinh tế vĩ mô của thị trấn. Mỗi ngày một bản ghi `macro_days`: pha chu kỳ kinh tế, thời tiết, cầu từng ngành, chỉ số giá đất, GDP. Trạng thái ngày sau suy ra từ ngày trước; ghi kèm tin tức (giá Sàn) và hiệu ứng thị trấn (lượng khách quầy). Luật: [[Kinh tế vĩ mô]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `rollMacro(prev, { rand, baseRate, force })` | `macro.js:40-71` | Hàm thuần: pha theo ma trận chuyển `PHASE_NEXT` (hoặc ép); thời tiết bốc theo trọng số (hoặc ép); cầu ngành hồi về 1 (`0,85`) + nhiễu, 4% có cú sốc ±10-20%, kẹp 0,7-1,35; chỉ số đất trôi theo pha trừ phần lãi suất trên mức trung tính 0,003, kẹp 0,6-1,8; GDP theo pha. Trả thêm `shocks` |
| `macroFor(day, { rand, force, now })` | `macro.js:95-102` | Đã có thì đọc; chưa có thì cuộn từ ngày gần nhất trước đó (hoặc `INITIAL`) và `write` |
| `overrideMacro(day, patch, now)` | `macro.js:105-116` | Quản trị ghi đè pha, thời tiết, chỉ số đất của một ngày |
| `macroToday(now)` | `macro.js:118` | |
| `macroHistory(day, n = 14)` | `macro.js:121` | Cũ tới mới |
| `rollNextDay(day, { rand, force })` | `macro.js:124-127` | Tạo sẵn ngày hôm sau (gọi cuối `settleClansDay`) |

`write(day, state, now)` nội bộ (dòng 76-92): tin thời tiết theo mặt hàng (`effect` theo `WEATHER.news`), tin sốc cầu (`effect = shock / 2` cho hàng của ngành), hiệu ứng `traffic` theo pha.

## Bảng
`macro_days`, `news`, `town_effects`; đọc `central_bank` (qua `economy()`).

## Ai gọi
`clans.js` (`macroFor`, `rollNextDay`), `routes-clans.js` (`/macro`), `internal.js` (`overrideMacro`).

## Lưu ý
- `macroFor` có tác dụng phụ ghi DB khi ngày chưa có (kể cả từ GET `/macro`, `/land`).
- Ghi đè bằng `overrideMacro` không đăng lại tin/hiệu ứng của ngày.
- Lỗ hổng ngày: nếu nhiều ngày không có bản ghi, ngày mới cuộn từ bản ghi gần nhất trước nó (không lấp các ngày giữa).

## Liên quan
- [[Kinh tế vĩ mô]] · [[Module clans]] · [[Tin tức thị trường]] · [[Module town]]
