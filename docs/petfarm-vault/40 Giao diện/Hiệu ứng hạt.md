---
tags: [petfarm, giao-dien, render, hieu-ung]
loai: ma-nguon
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/fx.js, public/ta-tua/game/js/pixel.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Hiệu ứng hạt

> [!summary]
> `fx.js` (74 dòng) cung cấp 3 hiệu ứng chạy bằng Web Animations API, không dùng canvas: `burst` bắn các hạt pixel (tim, sao, xu, bọt...), `floatText` cho chữ nổi lên rồi mờ ("+6 XP", "LÊN CẤP!"), `flyTo` cho một vật bay theo vòng cung và trả về Promise khi tới nơi. Mọi phần tử tự xóa khi hoạt ảnh kết thúc.

## API

| Hàm | Tham số mặc định | Cách chạy | Nguồn |
|---|---|---|---|
| `burst(layer, x, y, opts)` | `icon='heart', count=6, spread=70, rise=70, life=1100, px=4, fall=false, stagger=45` | mỗi hạt là `<img class="fx-px">` lấy từ `art(icon)`, rộng `w × px`; 4 khung: phóng 0,3 → 1,1 → 1 → 0,8 kèm lắc ngang ±12 px; bay lên (`-rise × 0,6..1,2`) hoặc rơi xuống khi `fall`; thời gian `life × 0,8..1,2`, trễ `i × stagger` | `public/ta-tua/game/js/fx.js:10-33` |
| `floatText(layer, x, y, text, opts)` | `color='#fff6d8', size=18, rise=46, delay=0` | `<span class="fx-text">`, 1300 ms ease-out | `fx.js:36-51` |
| `flyTo(layer, from, to, html, opts)` | `arc=90, duration=650, size=40, spin=260` | `<div class="fx-fly">`, 17 khung theo parabol `y − arc × 4t(1−t)`, xoay `t × spin`, thu nhỏ tới 0,65 | `fx.js:54-74` |

`layer` phải là phần tử `position: relative/absolute`; ở [[Màn Nhà]] là `#room`, ở mini-game là `.mg-fx`. Tên hạt hợp lệ là khóa trong kho `ART` của [[Vẽ pixel]] (`heart`, `sparkle`, `twinkle`, `coin`, `zzz`, `bubble`, `dust`, `crumb`, `drop`, `note`); tên lạ thì `burst` không làm gì.

## Nơi dùng

| Tình huống | Hiệu ứng | Nguồn |
|---|---|---|
| Cho ăn | món bay từ cửa sổ vào miệng, 7 vụn bánh rơi, 4 tim | `public/ta-tua/game/js/app.js:345-361` |
| Tắm bằng đồ chăm sóc `bath` | 10 bọt bay cao | `app.js:353-355` |
| Chơi với đồ chơi | đồ chơi bay qua lại 2 lần, lấp lánh và bụi | `app.js:363-375` |
| Lên cấp | 14 lấp lánh + "LÊN CẤP!" vàng `#ffd75e` cỡ 30 | `app.js:324-334` |
| Nhận XP/xu | "+n XP" vàng `#ffe27a`, "+n 🪙" | `app.js:338-342` |
| Quà ngày | 12 đồng xu rơi từ trần | `app.js:1047-1053` |
| Tâm trạng | zzz, giọt nước mắt, lấp lánh | `app.js:386-391` |
| Mini-game | "Hụt rồi!", "Cá chạy mất!", "Đúng rồi!", "Tuyệt vời!", bọt, giọt nước, lấp lánh cá hiếm | `public/ta-tua/game/js/games/fishing.js:225-252`, `games/memory.js:200-215` |
| Công viên | tim khi vuốt ve và các hiệu ứng gặp gỡ | [[Vẽ công viên]] |

Kiểu `.fx-px`, `.fx-text`, `.fx-fly` (vị trí tuyệt đối, `image-rendering: pixelated`, chữ có viền) ở `css/style.css` ([[Phong cách và CSS]]).

## Liên quan
- [[Vẽ pixel]], [[Màn Nhà]], [[Giao diện mini-game]], [[Vẽ công viên]]
