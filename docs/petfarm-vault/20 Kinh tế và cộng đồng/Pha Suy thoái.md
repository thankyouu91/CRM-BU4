---
tags: [petfarm, kinh-te, kinh-te-vi-mo, pha, recession]
loai: du-lieu
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/clan.js, petdex/server/macro.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [🌧️ Suy thoái, pha recession]
---
# Pha Suy thoái

> [!summary]
> 🌧️ Pha `recession` của chu kỳ [[Kinh tế vĩ mô]]. Doanh thu đất gia tộc ×0,85, giá đất trôi -0,8%/ngày, khách quầy trà sữa -10%, chỉ số "Tăng trưởng (năm)" hiển thị quanh -3%.

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Hệ số doanh thu lô đất (`factor`) | ×0,85 | `public/ta-tua/game/js/shared/clan.js:542`, `petdex/server/clans.js:233` |
| Trôi chỉ số giá đất (`land`) | -0,8%/ngày (trừ phần lãi cơ bản cao hơn 0,3%, cộng nhiễu) | `public/ta-tua/game/js/shared/clan.js:542`, `petdex/server/macro.js:67-68` |
| Khách quầy trà sữa (`traffic`) | -10%, ghi thành hiệu ứng thị trấn trong ngày | `public/ta-tua/game/js/shared/clan.js:542`, `petdex/server/macro.js:90-91` |
| GDP (`gdp`, chỉ để hiển thị "Tăng trưởng (năm)", không tác động luật chơi) | -3% ± nhiễu chuẩn 0,5 điểm % | `petdex/server/macro.js:22,69`, `public/ta-tua/game/js/views/clans.js:579` |
| Chuyển pha mỗi ngày | [[Pha Phục hồi]] 12%/ngày; ở lại 88% | `public/ta-tua/game/js/shared/clan.js:545-550` |
| Thời gian trung bình | khoảng 8 ngày | (suy từ xác suất chuyển) |

## Liên quan
- [[Kinh tế vĩ mô]] · [[Pha Phục hồi]] · [[Pha Tăng trưởng nóng]] · [[Pha Đỉnh chu kỳ]] · [[MOC Kinh tế và cộng đồng]]
