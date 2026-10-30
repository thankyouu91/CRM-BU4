---
tags: [petfarm, kinh-te, kinh-te-vi-mo, thoi-tiet, storm]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌀 Bão biển, thời tiết storm]
---
# Thời tiết Bão biển

> [!summary]
> 🌀 Kiểu thời tiết `storm` của [[Kinh tế vĩ mô]], bốc ngẫu nhiên mỗi ngày với trọng số 0,6 (khoảng 6% số ngày). Nhân doanh thu các lô đất theo địa hình và khí hậu, và đăng tin đẩy giá một số hàng trên Sàn trong cả ngày.

## Tác động lên lô đất
| Đối tượng | Điều chỉnh |
|---|---|
| Địa hình 🌊 Trên biển | -40% |
| Địa hình 🏖️ Ven biển | -20% |
| Địa hình 🏞️ Ven sông | -8% |
| Khí hậu 🌬️ Lộng gió | -10% |

Hệ số thời tiết của một lô = `max(0,3; 1 + điều chỉnh địa hình + điều chỉnh khí hậu)` (`public/ta-tua/game/js/shared/clan.js:566-569`).

## Tác động lên giá Sàn
| Mặt hàng | Tin trong ngày |
|---|---|
| [[Cá tươi]] | +20% |

Tin có tiêu đề "🌀 Bão biển: thị trường lo thiếu hàng/dư hàng", hiệu lực từ 0h tới 24h của ngày (`petdex/server/macro.js:80-83`).

Nguồn: `public/ta-tua/game/js/shared/clan.js:561`. Quản trị viên có thể ép thời tiết (xem [[Quản trị Clan]]).

## Liên quan
- [[Kinh tế vĩ mô]] · [[Bản đồ đất]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
