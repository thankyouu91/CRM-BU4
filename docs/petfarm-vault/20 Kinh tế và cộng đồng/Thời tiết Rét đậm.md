---
tags: [petfarm, kinh-te, kinh-te-vi-mo, thoi-tiet, cold]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🥶 Rét đậm, thời tiết cold]
---
# Thời tiết Rét đậm

> [!summary]
> 🥶 Kiểu thời tiết `cold` của [[Kinh tế vĩ mô]], bốc ngẫu nhiên mỗi ngày với trọng số 0,7 (khoảng 7% số ngày). Nhân doanh thu các lô đất theo địa hình và khí hậu, và đăng tin đẩy giá một số hàng trên Sàn trong cả ngày.

## Tác động lên lô đất
| Đối tượng | Điều chỉnh |
|---|---|
| Địa hình ⛰️ Đồi núi | -15% |
| Địa hình 🌲 Rừng | -8% |
| Khí hậu 🌬️ Lộng gió | -6% |

Hệ số thời tiết của một lô = `max(0,3; 1 + điều chỉnh địa hình + điều chỉnh khí hậu)` (`public/ta-tua/game/js/shared/clan.js:566-569`).

## Tác động lên giá Sàn
| Mặt hàng | Tin trong ngày |
|---|---|
| [[Dâu tây]] | +10% |
| [[Lá trà tươi]] | +6% |

Tin có tiêu đề "🥶 Rét đậm: thị trường lo thiếu hàng/dư hàng", hiệu lực từ 0h tới 24h của ngày (`petdex/server/macro.js:80-83`).

Nguồn: `public/ta-tua/game/js/shared/clan.js:562`. Quản trị viên có thể ép thời tiết (xem [[Quản trị Clan]]).

## Liên quan
- [[Kinh tế vĩ mô]] · [[Bản đồ đất]] · [[Tin tức thị trường]] · [[MOC Kinh tế và cộng đồng]]
