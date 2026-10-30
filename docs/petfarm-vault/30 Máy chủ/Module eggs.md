---
tags: [petfarm, may-chu, module, trung]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/eggs.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module eggs

> [!summary]
> `petdex/server/eggs.js` (80 dòng): tạo bé mới (dùng chung cho nhận nuôi, nở trứng, quản trị tặng thú) và vòng đời trứng ngũ hành: ấp (bốc loài ngay lúc ấp) và nở. Luật trứng ở [[Trứng ngũ hành]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `createPet(userId, name, speciesId, now, rand)` | `eggs.js:20-33` | `rollTraits`, `insertPet`, kỹ năng khởi đầu theo loài (`statsOfSpecies().skills`) hoặc ngẫu nhiên với loài lạ; `charming` +5 Duyên dáng; nhận **kỷ vật** (`takeHeirloom`) cộng vào kỹ năng; đặt làm bé chính nếu chưa có. Trả `{ petId, traits, traitText, heirloom }` |
| `eggsView(userId, now)` | `eggs.js:36-44` | Trứng đang ấp `{ id, element, startedAt, hatchAt, ready }` |
| `incubate(userId, itemId, now, rand)` | `eggs.js:47-58` | Phải là `type: 'egg'`, còn ô (`slotsOf().free`), lấy trứng khỏi túi, `rollEggSpecies(element)`, `hatch_at = now + EGG.hours` |
| `heirloomText(h)` | `eggs.js:60` | Câu thông báo kỷ vật |
| `hatch(userId, eggId, name, now, rand)` | `eggs.js:64-80` | Đủ giờ, chưa quá `RULES.maxPets` bé; `createPet` rồi đánh dấu `hatched_at`, `pet_id` có điều kiện (chống nở hai lần) |

## Bảng
`eggs`; qua `db`: `pets`, `pet_skills`, `users.active_pet_id`, `inventory`; qua `lifecycle`: `memorials.heirloom_used_at`.

## Ai gọi
`routes.js` (`/pets`, `/eggs/*`), `internal.js` (tặng thú), `service.snapshot` (`eggsView`).

## Lưu ý
- Trứng đang ấp chiếm ô nuôi; nhưng `hatch` chỉ kiểm số **bé** (`listPets`) so với `maxPets`, không kiểm ô tưởng niệm.
- Trứng tặng khi bé cuối mất được `lifecycle.passAway` chèn thẳng vào bảng `eggs` (không qua `incubate`).

## Liên quan
- [[Module lifecycle]] · [[Trứng ngũ hành]] · [[Tính cách]] · [[Vòng đời và Đồi Sao]]
