---
tags: [petfarm, kinh-te, kinh-te-vi-mo, thoi-tiet, monsoon]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌧️ Mưa lớn nhiều ngày, thời tiết monsoon]
---
# Thời tiết Mưa lớn nhiều ngày

> [!summary]
> 🌧️ Kiểu thời tiết `monsoon` của [[Kinh tế vĩ mô]], bốc ngẫu nhiên mỗi ngày với trọng số 1 (khoảng 11% số ngày). Nhân doanh thu các lô đất theo địa hình và khí hậu, và đăng tin đẩy giá một số hàng trên Sàn trong cả ngày.

## Tác động lên lô đất
| Đối tượng | Điều chỉnh |
|---|---|
| Địa hình 🌊 Trên biển | -15% |
| Địa hình 🏖️ Ven biển | -8% |
| Khí hậu 🌧️ Mưa ẩm | -12% |
| Khí hậu ☀️ Nhiều nắng | +4% |

Hệ số thời tiết của một lô = `max(0,3; 1 + điều chỉnh địa hình + điều chỉnh khí hậu)` (`public/ta-tua/game/js/shared/clan.js:566-569`).

## Tác động lên giá Sàn
| Mặt hàng | Tin trong ngày |
|---|---|
| [[Lá trà tươi]] | +10% |
| [[Dâu tây]] | +12% |

Tin có tiêu đề "🌧️ Mưa lớn nhiều ngày: thị trường lo thiếu hàng/dư hàng", hiệu lực từ 0h tới 24h của ngày (`petdex/server/macro.js:80-83`).

Nguồn: `public/ta-tua/game/js/shared/clan.js:560`. Quản trị viên có thể ép thời tiết (xem [[Quản trị Clan]]).

## Liên quan
- [[Kinh tế vĩ mô]] · [[Bản đồ đất]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
