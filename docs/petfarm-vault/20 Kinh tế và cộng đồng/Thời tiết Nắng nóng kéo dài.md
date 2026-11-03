---
tags: [petfarm, kinh-te, kinh-te-vi-mo, thoi-tiet, heatwave]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🔥 Nắng nóng kéo dài, thời tiết heatwave]
---
# Thời tiết Nắng nóng kéo dài

> [!summary]
> 🔥 Kiểu thời tiết `heatwave` của [[Kinh tế vĩ mô]], bốc ngẫu nhiên mỗi ngày với trọng số 1 (khoảng 11% số ngày). Nhân doanh thu các lô đất theo địa hình và khí hậu, và đăng tin đẩy giá một số hàng trên Sàn trong cả ngày.

## Tác động lên lô đất
| Đối tượng | Điều chỉnh |
|---|---|
| Địa hình 🌾 Đồng bằng | -6% |
| Khí hậu ☀️ Nhiều nắng | -15% |
| Khí hậu 🌧️ Mưa ẩm | +5% |

Hệ số thời tiết của một lô = `max(0,3; 1 + điều chỉnh địa hình + điều chỉnh khí hậu)` (`public/ta-tua/game/js/shared/clan.js:566-569`).

## Tác động lên giá Sàn
| Mặt hàng | Tin trong ngày |
|---|---|
| [[Mía]] | +10% |
| [[Sữa tươi]] | +8% |

Tin có tiêu đề "🔥 Nắng nóng kéo dài: thị trường lo thiếu hàng/dư hàng", hiệu lực từ 0h tới 24h của ngày (`petdex/server/macro.js:80-83`).

Nguồn: `public/ta-tua/game/js/shared/clan.js:559`. Quản trị viên có thể ép thời tiết (xem [[Quản trị Clan]]).

## Liên quan
- [[Kinh tế vĩ mô]] · [[Bản đồ đất]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
