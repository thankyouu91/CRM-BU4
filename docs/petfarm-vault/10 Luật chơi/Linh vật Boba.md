---
tags: [petfarm, luat-choi, loai]
aliases: [Boba, Linh vật]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, petdex/server/species.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Linh vật Boba

> [!summary]
> **Boba** là bé rái cá ôm cốc trà sữa, linh vật của Phố Trân Châu. Boba vẽ bằng bộ khung như 50 loài nhưng không nằm trong bộ sưu tập ngũ hành, luôn đứng đầu màn nhận nuôi và nhận nuôi trực tiếp được.

## Con số
| Thuộc tính | Giá trị | Nguồn |
|---|---|---|
| Mã | `boba` (giữ mã cũ để bé Boba đang nuôi tự đổi sang hình mới) | `public/ta-tua/game/js/shared/pets.js:214-218` |
| Hành | 💧 Thủy | `public/ta-tua/game/js/shared/pets.js:218` |
| Độ hiếm | ★ Thường | như trên |
| Dáng khung | `biped`, tai `round`, đuôi `flat`, mặt `muzzle`, nét riêng `cup` (cốc trà sữa) | như trên |
| Sở trường | 🖐️ Khéo tay | như trên |
| Ăn / Sức | 1 / 1 | như trên |
| Kỹ năng khởi đầu | 9 / 9 / 10 / 11 / 12 (tổng 51) | tính bằng `speciesStats` |
| Tuổi thọ nền | 90 tuần | `public/ta-tua/game/js/shared/pets.js:134-137` |
| Mô tả | "Bé rái cá nhâm nhi trà sữa, linh vật của Phố Trân Châu." | `public/ta-tua/game/js/shared/pets.js:220` |

## Cách hoạt động
- `MASCOTS` (`public/ta-tua/game/js/shared/pets.js:216-222`), cờ `mascot: true`; `listSpecies` đưa Boba lên đầu với `adoptable: true` (`petdex/server/species.js:30-32`).
- Boba **không** nở từ trứng: `rollEggSpecies` chỉ bốc trong `SPECIES` (`public/ta-tua/game/js/shared/pets.js:349`).
- Nếu người chơi cài ảnh Petdex có mã `boba`, bản vẽ bằng bộ khung được ưu tiên (`petdex/server/species.js:12`).
- Thẻ loài ở màn nhận nuôi hiện chip "🧋 Linh vật" (`public/ta-tua/game/js/app.js:774`).

## Liên quan
- [[Loài và độ hiếm]] · [[Danh mục loài]] · [[Ngũ hành]] · [[Bộ khung thú]]
