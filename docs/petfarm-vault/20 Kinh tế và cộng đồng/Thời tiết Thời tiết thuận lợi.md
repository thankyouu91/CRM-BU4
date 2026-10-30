---
tags: [petfarm, kinh-te, kinh-te-vi-mo, thoi-tiet, perfect]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌈 Thời tiết thuận lợi, thời tiết perfect]
---
# Thời tiết Thời tiết thuận lợi

> [!summary]
> 🌈 Kiểu thời tiết `perfect` của [[Kinh tế vĩ mô]], bốc ngẫu nhiên mỗi ngày với trọng số 1,2 (khoảng 13% số ngày). Nhân doanh thu các lô đất theo địa hình và khí hậu, và đăng tin đẩy giá một số hàng trên Sàn trong cả ngày.

## Tác động lên lô đất
| Đối tượng | Điều chỉnh |
|---|---|
| Địa hình 🌾 Đồng bằng | +8% |
| Địa hình ⛰️ Đồi núi | +8% |
| Địa hình 🏞️ Ven sông | +8% |
| Địa hình 🏖️ Ven biển | +5% |

Hệ số thời tiết của một lô = `max(0,3; 1 + điều chỉnh địa hình + điều chỉnh khí hậu)` (`public/ta-tua/game/js/shared/clan.js:566-569`).

## Tác động lên giá Sàn
| Mặt hàng | Tin trong ngày |
|---|---|
| [[Lá trà tươi]] | -6% |
| [[Dâu tây]] | -6% |

Tin có tiêu đề "🌈 Thời tiết thuận lợi: thị trường lo thiếu hàng/dư hàng", hiệu lực từ 0h tới 24h của ngày (`petdex/server/macro.js:80-83`).

Nguồn: `public/ta-tua/game/js/shared/clan.js:558`. Quản trị viên có thể ép thời tiết (xem [[Quản trị Clan]]).

## Liên quan
- [[Kinh tế vĩ mô]] · [[Bản đồ đất]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
