---
tags: [petfarm, kinh-te, kinh-te-vi-mo, pha, recovery]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌱 Phục hồi, pha recovery]
---
# Pha Phục hồi

> [!summary]
> 🌱 Pha `recovery` của chu kỳ [[Kinh tế vĩ mô]]. Doanh thu đất gia tộc ×1, giá đất trôi +0,2%/ngày, khách quầy trà sữa không đổi, chỉ số "Tăng trưởng (năm)" hiển thị quanh +2,5%.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Hệ số doanh thu lô đất (`factor`) | ×1 | `public/ta-tua/game/js/shared/clan.js:539`, `petdex/server/clans.js:233` |
| Trôi chỉ số giá đất (`land`) | +0,2%/ngày (trừ phần lãi cơ bản cao hơn 0,3%, cộng nhiễu) | `public/ta-tua/game/js/shared/clan.js:539`, `petdex/server/macro.js:67-68` |
| Khách quầy trà sữa (`traffic`) | 0 (không ghi hiệu ứng) | `public/ta-tua/game/js/shared/clan.js:539`, `petdex/server/macro.js:90-91` |
| GDP (`gdp`, chỉ để hiển thị "Tăng trưởng (năm)", không tác động luật chơi) | +2,5% ± nhiễu chuẩn 0,5 điểm % | `petdex/server/macro.js:22,69`, `public/ta-tua/game/js/views/clans.js:579` |
| Chuyển pha mỗi ngày | [[Pha Tăng trưởng nóng]] 12%/ngày; ở lại 88% | `public/ta-tua/game/js/shared/clan.js:545-550` |
| Thời gian trung bình | khoảng 8 ngày | (suy từ xác suất chuyển) |

## Liên quan
- [[Kinh tế vĩ mô]] · [[Pha Tăng trưởng nóng]] · [[Pha Đỉnh chu kỳ]] · [[Pha Suy thoái]] · [[MOC Kinh tế và cộng đồng]]
