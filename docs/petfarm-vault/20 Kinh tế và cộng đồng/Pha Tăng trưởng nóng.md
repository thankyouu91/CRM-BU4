---
tags: [petfarm, kinh-te, kinh-te-vi-mo, pha, boom]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🚀 Tăng trưởng nóng, pha boom]
---
# Pha Tăng trưởng nóng

> [!summary]
> 🚀 Pha `boom` của chu kỳ [[Kinh tế vĩ mô]]. Doanh thu đất gia tộc ×1,12, giá đất trôi +0,8%/ngày, khách quầy trà sữa +10%, chỉ số "Tăng trưởng (năm)" hiển thị quanh +7%.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Hệ số doanh thu lô đất (`factor`) | ×1,12 | `public/ta-tua/game/js/shared/clan.js:540`, `petdex/server/clans.js:233` |
| Trôi chỉ số giá đất (`land`) | +0,8%/ngày (trừ phần lãi cơ bản cao hơn 0,3%, cộng nhiễu) | `public/ta-tua/game/js/shared/clan.js:540`, `petdex/server/macro.js:67-68` |
| Khách quầy trà sữa (`traffic`) | +10%, ghi thành hiệu ứng thị trấn trong ngày | `public/ta-tua/game/js/shared/clan.js:540`, `petdex/server/macro.js:90-91` |
| GDP (`gdp`, chỉ để hiển thị "Tăng trưởng (năm)", không tác động luật chơi) | +7% ± nhiễu chuẩn 0,5 điểm % | `petdex/server/macro.js:22,69`, `public/ta-tua/game/js/views/clans.js:579` |
| Chuyển pha mỗi ngày | [[Pha Đỉnh chu kỳ]] 10%/ngày; ở lại 90% | `public/ta-tua/game/js/shared/clan.js:545-550` |
| Thời gian trung bình | khoảng 10 ngày | (suy từ xác suất chuyển) |

## Liên quan
- [[Kinh tế vĩ mô]] · [[Pha Phục hồi]] · [[Pha Đỉnh chu kỳ]] · [[Pha Suy thoái]] · [[MOC Kinh tế và cộng đồng]]
