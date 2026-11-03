---
tags: [petfarm, giao-dien, render, pixel-art, canvas]
loai: ma-nguon
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/pixel.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Vẽ pixel

> [!summary]
> `pixel.js` là thư viện vẽ nền tảng của mọi hình trong game: tạo canvas độ phân giải thấp, bút `Pen` vẽ điểm/hình chữ nhật/elip/hình tròn/dải màu có dither Bayer, viền 1 px, vẽ hình từ bản đồ ký tự, tô bóng khối tròn và kho hình hạt hiệu ứng dùng chung. Canvas luôn tắt làm mịn và được phóng to bằng CSS `image-rendering: pixelated`, nên mọi thứ có nét "pixel cổ điển" thống nhất.

## API

| Xuất | Chữ ký | Việc | Nguồn |
|---|---|---|---|
| `OUTLINE` | `'#2e1d14'` | màu viền nâu đậm dùng chung cho thú, đồ, icon | `public/ta-tua/game/js/pixel.js:3` |
| `makeCanvas(w, h)` | → `[canvas, ctx]` | làm tròn kích thước, tối thiểu 1, `imageSmoothingEnabled = false` | `pixel.js:5-12` |
| `seeded(seed)` | → `() => số 0..1` | mulberry32, để cảnh vẽ ra giống nhau mỗi lần | `pixel.js:14-25` |
| `bayer(x, y)` | → ngưỡng (0,1) | ma trận Bayer 4×4 | `pixel.js:27-28` |
| `class Pen(g)` | `rect`, `px`, `ellipse`, `disc`, `vGradient(x,y,w,h,colors)`, `ditherFill(x,y,w,h,color,density,inside)` | dải màu dọc có ranh giới dither; tô theo mật độ dither trong vùng | `pixel.js:30-83` |
| `outline(src, color)` | → canvas mới | thêm viền 1 px quanh điểm không trong suốt | `pixel.js:85-102` |
| `bitmap(rows, palette, outlineColor)` | → canvas | mỗi ký tự là một màu, ký tự khác là trống, tùy chọn viền | `pixel.js:104-115` |
| `shadeBlob(c, cx, cy, r, {light, mid, dark})` | → canvas | đổi điểm màu `mid` sang sáng/tối theo hướng sáng trên-trái, ranh giới dither | `pixel.js:117-142` |
| `hexToRgb(hex)` | → `[r, g, b]` | | `pixel.js:144-147` |
| `art(name)` | → `{canvas, url, w, h}` hoặc `null` | lấy hình dựng sẵn từ kho `ART`, lưu đệm `toDataURL` | `pixel.js:277-286` |

## Kho hình `ART`

Hạt hiệu ứng: `heart`, `sparkle`, `twinkle`, `coin`, `zzz`, `bubble`, `dust`, `crumb`, `drop`, `note`, `shadow` (bóng elip mờ dưới chân). Phụ kiện cũ: `acc:bow`, `acc:flower`, `acc:glasses`, `acc:tophat`, `acc:crown` (`pixel.js:149-275`). Các hạt này được [[Hiệu ứng hạt]] bắn ra; phụ kiện thật hiện nay vẽ ở [[Bộ khung thú]].

## Ai dùng

| Mô-đun | Dùng gì |
|---|---|
| [[Bộ khung thú]] (`rig.js`) | `Pen`, `outline`, `shadeBlob`, `bitmap` để vẽ thú và đồ đeo |
| [[Cảnh nhà và thời gian trong ngày]] (`scenes.js`), [[Vẽ bản đồ phố]] (`townmap.js`), [[Vẽ công viên]] (`park.js`) | nền, nhà, cây, vật trang trí |
| [[Vẽ bản đồ đất]] (`landpixel.js`) | `Pen`, `bayer`, `hexToRgb`, `seeded`, `shadeBlob` |
| [[Giao diện mini-game]] | toàn bộ, cá và hồ câu vẽ thuật toán |
| [[Hình vật phẩm]] (`itemart.js`) | `bitmap` với `OUTLINE` |
| [[Hiệu ứng hạt]] (`fx.js`) | `art()` |

## Liên quan
- [[Kiến trúc giao diện game]], [[Phong cách và CSS]], [[Biểu đồ]] (cũng vẽ nửa độ phân giải)
