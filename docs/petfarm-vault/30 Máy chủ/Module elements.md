---
tags: [petfarm, may-chu, module, ngu-hanh]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/elements.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module elements

> [!summary]
> `petdex/server/elements.js` (39 dòng): áp **ngũ hành** vào luật máy chủ: hệ số lên kỹ năng, XP và lương theo loài, bộ đồ đang mặc, vận khí ngày và trang phục. Luật gốc (`ELEMENT_RULES`, `fortuneOf`, `setOf`, `wearBonus`) ở `public/ta-tua/game/js/shared/pets.js`. Ý nghĩa luật: [[Ngũ hành]], [[Hành vượng]], [[Hợp mệnh và kỵ mệnh]], [[Bộ đồ ngũ hành]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `isFortunate(pet, now)` | `elements.js:8` | Hành của loài = hành vượng hôm nay (`fortuneOf(dayKey(now))`) |
| `skillFactor(pet, skill)` | `elements.js:11-14` | `growth[skill]` của loài × `max(0,5; 1 + wearBonus)` × (1 + % "Chỉ số" trang phục) |
| `growSkill(petId, skill, raw)` | `elements.js:17-23` | Đọc bé, `gainSkill(before, raw × skillFactor)`, ghi `pet_skills`; trả `{ before, after }` |
| `xpFactor(pet, now)` | `elements.js:26` | `1 + ELEMENT_RULES.fortune` nếu hành vượng |
| `elementPay(pet, now, careerSkill)` | `elements.js:29-36` | Cộng: hành vượng, `setOf(wear).pay`, % "Thu nhập ca làm", bé Hỏa làm nghề Sức mạnh |
| `isElement(speciesId, element)` | `elements.js:39` | |

## Ai gọi
`service.mutatePet` (XP), `jobs` (lương, kỹ năng), `care` (lớp học), `minigames` (kỹ năng), `farm` (Mộc thu hoạch, Kim nấu), `factory` (Kim đứng máy), `business` (Thủy trực quầy).

## Bảng
`pet_skills` (qua `setSkill`).

## Liên quan
- [[Module service]] · [[Module jobs]] · [[Module rules-careers]] · [[Kỹ năng]]
