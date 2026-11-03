---
tags: [petfarm, kinh-te, kinh-te-vi-mo, pha, peak]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [⛰️ Đỉnh chu kỳ, pha peak]
---
# Pha Đỉnh chu kỳ

> [!summary]
> ⛰️ Pha `peak` của chu kỳ [[Kinh tế vĩ mô]]. Doanh thu đất gia tộc ×1,05, giá đất trôi +0,3%/ngày, khách quầy trà sữa +5%, chỉ số "Tăng trưởng (năm)" hiển thị quanh +4%.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Hệ số doanh thu lô đất (`factor`) | ×1,05 | `public/ta-tua/game/js/shared/clan.js:541`, `petdex/server/clans.js:233` |
| Trôi chỉ số giá đất (`land`) | +0,3%/ngày (trừ phần lãi cơ bản cao hơn 0,3%, cộng nhiễu) | `public/ta-tua/game/js/shared/clan.js:541`, `petdex/server/macro.js:67-68` |
| Khách quầy trà sữa (`traffic`) | +5%, ghi thành hiệu ứng thị trấn trong ngày | `public/ta-tua/game/js/shared/clan.js:541`, `petdex/server/macro.js:90-91` |
| GDP (`gdp`, chỉ để hiển thị "Tăng trưởng (năm)", không tác động luật chơi) | +4% ± nhiễu chuẩn 0,5 điểm % | `petdex/server/macro.js:22,69`, `public/ta-tua/game/js/views/clans.js:579` |
| Chuyển pha mỗi ngày | [[Pha Suy thoái]] 14%/ngày, [[Pha Tăng trưởng nóng]] 4%/ngày; ở lại 82% | `public/ta-tua/game/js/shared/clan.js:545-550` |
| Thời gian trung bình | khoảng 6 ngày | (suy từ xác suất chuyển) |

## Liên quan
- [[Kinh tế vĩ mô]] · [[Pha Phục hồi]] · [[Pha Tăng trưởng nóng]] · [[Pha Suy thoái]] · [[MOC Kinh tế và cộng đồng]]
