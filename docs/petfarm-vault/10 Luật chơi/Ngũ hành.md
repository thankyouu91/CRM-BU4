---
tags: [petfarm, luat-choi, ngu-hanh]
aliases: [Hành, Kim, Mộc, Thủy, Hỏa, Thổ, Elements]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, petdex/server/elements.js, petdex/server/factory.js, petdex/server/farm.js, petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Ngũ hành

> [!summary]
> Mỗi loài thuộc một trong năm hành: 🪙 Kim, 🌿 Mộc, 💧 Thủy, 🔥 Hỏa, ⛰️ Thổ. Hành quyết định kỹ năng nào lên nhanh, chỉ số nào hao/hồi khác thường, một lợi thế khi làm ăn, và quan hệ [[Hợp mệnh và kỵ mệnh]] với đồ ăn, trang phục. Mỗi ngày một hành "vượng" ([[Hành vượng]]). Toàn bộ dữ liệu nằm ở `ELEMENTS` và `ELEMENT_RULES` trong `public/ta-tua/game/js/shared/pets.js`, dùng chung cho máy chủ và trình duyệt.

## Con số
| Hành | Kỹ năng lên nhanh (`skills`) | Chỉ số (`stats`) | Lợi thế (`perk`) | Tính khí | Nguồn |
|---|---|---|---|---|---|
| 🪙 Kim | Khéo tay ×1,3, Sức mạnh ×1,15 | Sạch sẽ tụt ×0,85 | Đứng máy: xưởng +10% mẻ; vào bếp như có thêm +15 Khéo tay | Cứng cỏi, gọn gàng, ít bẩn | `public/ta-tua/game/js/shared/pets.js:11-17,293` |
| 🌿 Mộc | Thông minh ×1,3, Duyên dáng ×1,1 | Sức khỏe hồi ×1,3 | Bé chính hành Mộc: vườn thu hoạch +15% | Hiền, ham học, tự hồi sức khỏe nhanh | `public/ta-tua/game/js/shared/pets.js:18-24,294` |
| 💧 Thủy | Duyên dáng ×1,3, Nhanh nhẹn ×1,15 | Vui vẻ tụt ×0,85 | Có bé Thủy trực quầy: +5% khách | Mềm mỏng, vui lâu, khéo giao tiếp | `public/ta-tua/game/js/shared/pets.js:25-31,295` |
| 🔥 Hỏa | Sức mạnh ×1,3, Nhanh nhẹn ×1,1 | Năng lượng hồi ×1,2, No bụng tụt ×1,1 | Nghề dùng Sức mạnh ([[Nghề Bốc vác]]) +5% lương | Sôi nổi, hồi sức nhanh nhưng mau đói | `public/ta-tua/game/js/shared/pets.js:32-38,296` |
| ⛰️ Thổ | Khéo tay ×1,15, Sức mạnh ×1,15 | No bụng tụt ×0,85, ốm ×0,6 | Bền bỉ: tuổi thọ +8 tuần | Điềm đạm, ăn ít, khỏe mạnh | `public/ta-tua/game/js/shared/pets.js:39-45,297`, `:135` |

Màu hành (`color`): Kim `#b8c2cc`, Mộc `#6dbb5a`, Thủy `#4f8fd6`, Hỏa `#f0663c`, Thổ `#c99a4b` (`public/ta-tua/game/js/shared/pets.js:12-40`).

### Hằng số `ELEMENT_RULES` (`public/ta-tua/game/js/shared/pets.js:286-299`)
| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| `fortune` | 0,1 | [[Hành vượng]]: +10% XP và lương |
| `sets` | {3: 0,03, 4: 0,05, 5: 0,08} | [[Bộ đồ ngũ hành]]: % lương theo số món cùng hành |
| `wearCap` | 0,3 | Hợp mệnh của cả bộ đồ cộng tối đa +30% tốc độ kỹ năng |
| `food` | 0,2 | Ăn món hợp mệnh: +20% XP |
| `perks` | xem bảng trên | Lợi thế làm ăn |

## Nơi áp dụng lợi thế
| Lợi thế | Áp dụng | Nguồn |
|---|---|---|
| Kim xưởng +10% | bé Kim đứng máy | `petdex/server/factory.js:87-88` |
| Kim nấu +15 Khéo tay | bé chính Kim vào [[Bếp]] | `petdex/server/farm.js:208` |
| Mộc vườn +15% | bé chính hành Mộc lúc thu hoạch [[Vườn]] | `petdex/server/farm.js:126-134` |
| Thủy quầy +5% | có bé Thủy trực [[Quầy trà sữa]] | `petdex/server/business.js:109` |
| Hỏa Sức mạnh +5% | ca nghề có `skill = strength` | `petdex/server/elements.js:34` |
| Thổ tuổi thọ +8 | `lifespanWeeks` | `public/ta-tua/game/js/shared/pets.js:135` |

## Cách hoạt động
- Hành gắn với loài, không đổi được: `elementOfSpecies(id)` (`public/ta-tua/game/js/shared/pets.js:233`). Loài khách mời chưa gán hành thì `null`, không hưởng cũng không chịu ngũ hành.
- Hệ số chỉ số của loài = hệ số riêng (`appetite`, `stamina`) × hệ số hành ([[Danh mục loài]]).
- Tốc độ lên kỹ năng = `growth[skill]` (hành + 0,1 nếu là sở trường) × hợp mệnh bộ đồ × % "Chỉ số" ([[Kỹ năng]]).

## Liên quan
- [[Hành vượng]] · [[Hợp mệnh và kỵ mệnh]] · [[Loài và độ hiếm]] · [[Danh mục loài]] · [[Trứng ngũ hành]] · [[Bộ đồ ngũ hành]]
- [[Thiết kế pet ngũ hành]] · [[Module elements]]
