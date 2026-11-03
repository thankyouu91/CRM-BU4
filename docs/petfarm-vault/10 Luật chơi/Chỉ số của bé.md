---
tags: [petfarm, luat-choi, chi-so]
aliases: [Chỉ số, No bụng, Vui vẻ, Năng lượng, Sạch sẽ, Sức khỏe]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/game.js, petdex/server/rules/production.js, public/ta-tua/game/js/shared/pets.js, public/ta-tua/game/js/ui.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Chỉ số của bé

> [!summary]
> Mỗi bé có 5 chỉ số thang 0–100: 🍙 No bụng, 💖 Vui vẻ, ⚡ Năng lượng, 🫧 Sạch sẽ, ❤️ Sức khỏe. Máy chủ không chạy đồng hồ cho từng bé mà tính lại chỉ số theo thời gian đã trôi mỗi khi bé được đọc hoặc thay đổi (hàm `tick`). Hiểu cách hao/hồi giúp canh giờ cho ăn, tắm, cho đi làm để bé không [[Ốm và Phòng khám|ốm]] và sống lâu ([[Vòng đời và Đồi Sao]]).

## Cách hoạt động
- Tên và biểu tượng trên giao diện: `STAT_LABELS`, `STAT_ICONS` ở `public/ta-tua/game/js/ui.js:6-7`.
- Mỗi lần đọc bé (`describePet`) hoặc làm một hành động (`mutatePet`), máy chủ gọi `tick(pet, now)` với số giờ kể từ `updated_at` (`petdex/server/game.js:156-184`, `petdex/server/service.js:65-81`).
- Thời gian được chia làm **giờ rảnh** và **giờ bận** (đi làm, đi học). Tắm (`busy_kind = 'bath'`) tính như giờ rảnh (`petdex/server/game.js:147-150`).
- Mọi chỉ số bị kẹp trong 0–100 (`clamp`, `petdex/server/game.js:140`).
- Bé mới nhận nuôi: giá trị mặc định khi thiếu là Sạch sẽ 80, Sức khỏe 90 (`petdex/server/game.js:169-170`).

## Con số
| Chỉ số | Khi rảnh (mỗi giờ) | Khi bận (mỗi giờ) | Nhân hệ số | Nguồn |
|---|---|---|---|---|
| 🍙 No bụng | −8 | −12 | × hệ số ăn của loài (`appetite` × hành), × `spend` giai đoạn tuổi, × 1,2 nếu [[Tính cách Tham ăn]] | `petdex/server/game.js:34-35,164-165` |
| 💖 Vui vẻ | −4 | −4 | × hệ số hành (Thủy 0,85), × `moodDrop` (Thiếu niên 1,3); tụt thêm một lần trong giờ đói và thêm một lần nữa suốt lúc ốm | `petdex/server/game.js:34,178` |
| ⚡ Năng lượng | +12 | −10 | phần hồi × `energyRegen` loài (`stamina` × Hỏa 1,2) × 1,2 nếu [[Tính cách Ngủ nướng]] × giai đoạn (Lão làng 0,8); phần tụt khi bận không nhân | `petdex/server/game.js:34-35,174,179` |
| 🫧 Sạch sẽ | −5 | −5 | × hệ số hành (Kim 0,85) | `petdex/server/rules/production.js:10`, `petdex/server/game.js:171,180` |
| ❤️ Sức khỏe | +1 khi no và sạch, không ốm | như rảnh | phần hồi × `healthRegen` (Mộc 1,3); phần tụt −1/giờ khi đói hoặc bẩn | `petdex/server/rules/production.js:12-13,55-59`, `petdex/server/game.js:181` |

| Ngưỡng | Giá trị | Nguồn |
|---|---|---|
| Đói | No bụng < 20 (`HUNGRY_AT`) | `petdex/server/game.js:36` |
| Bẩn | Sạch sẽ < 20 (`DIRTY_AT`) | `petdex/server/game.js:37` |
| Dễ ốm | Sức khỏe < 40 | `petdex/server/rules/production.js:15` |
| Không cho ăn được nữa | No bụng ≥ 97 | `petdex/server/game.js:262` |
| Không chơi đùa được | Năng lượng < 15 hoặc No bụng < 10 | `petdex/server/game.js:271-272` |
| Không nhận ca làm | No bụng < 15, Năng lượng < 10 × số giờ ca | `petdex/server/rules/careers.js:68-69` |

## Công thức
Gọi `h` là số giờ đã trôi, `b` số giờ bận, `f = h − b`.

```
hunger      = (Tham ăn ? 1,2 : 1) × st.fullness × stage.spend
mấtNo       = (8·f + 12·b) × hunger
giờTớiĐói   = max(0, (No − 20) / (mấtNo / h))
giờĐói      = max(0, h − giờTớiĐói)
Vui mới     = Vui − 4 × st.happiness × stage.moodDrop × (h + giờĐói + (ốm ? h : 0))
NL mới      = NL + 12 × regen × f − 10 × b        (regen = Ngủ nướng 1,2 × st.energyRegen × stage.energyRegen)
Sạch mới    = Sạch − 5 × st.hygiene × h
giờTớiBẩn   = (Sạch − 20) / (5 × st.hygiene)
xấu         = max(0, h − min(giờTớiĐói, giờTớiBẩn))
tốt         = min(h − xấu, ốm ? 0 : min(giờTớiĐói, giờTớiBẩn))
SứcKhỏe mới = SứcKhỏe + 1 × st.healthRegen × tốt − 1 × xấu
```
(`petdex/server/game.js:156-184`, `petdex/server/rules/production.js:55-59`.) Hệ số `st` lấy từ `statsOfSpecies` (`public/ta-tua/game/js/shared/pets.js:246-264`), xem [[Danh mục loài]].

> [!example] Ví dụ: Boba (mọi hệ số = 1), No 80, Sạch 80, Sức khỏe 70, bỏ nhà 10 giờ rảnh
> - No bụng: −80 → 0 (đói sau 7,5 giờ, đói 2,5 giờ).
> - Vui vẻ: −4 × (10 + 2,5) = −50.
> - Năng lượng: +120 → kẹp 100.
> - Sạch sẽ: −50 → 30 (bẩn sau 12 giờ, chưa tới).
> - Sức khỏe: hồi 7,5 giờ đầu (+7,5), tụt 2,5 giờ đói (−2,5) → 75.

## Trường hợp đặc biệt
- Đói và ốm cùng lúc: Vui vẻ tụt gấp ba (`h + giờĐói + h`).
- Bé ốm không tự hồi Sức khỏe (`goodFor = 0`), nhưng vẫn tụt khi đói hoặc bẩn (`petdex/server/game.js:173`).
- Phần cộng từ đồ ăn, đồ chăm sóc, chơi đùa, tắm được nhân thêm % dòng "📈 Chỉ số" của [[Trang phục]] (`boostEffect`, `petdex/server/game.js:254-258`); phần trừ giữ nguyên.
- Thả tim nhà bạn cộng thẳng +5 Vui vẻ cho [[Thú chính]] của bạn ấy, không qua `boostEffect` (`petdex/server/social.js:16,141-143`).
- Sức khỏe cuối mỗi ngày được ghi vào trung bình cả đời, quyết định tuổi thọ ([[Vòng đời và Đồi Sao]]).

## Mã nguồn
- `petdex/server/game.js`: `tick` (156), `applyEffect` (211), `boostEffect` (254), `mood` (241), `describePet` (301).
- `petdex/server/rules/production.js`: `HEALTH` (9-17), `healthDelta` (55-59).
- `public/ta-tua/game/js/shared/pets.js`: `ELEMENTS[*].stats` (10-46), `LIFE_STAGES[*].rules` (78-116), `speciesStats` (246-264).

## Liên quan
- [[Tâm trạng của bé]] · [[Chăm sóc ở nhà]] · [[Đồ ăn và đồ chăm sóc]] · [[Ốm và Phòng khám]]
- [[Ngũ hành]] · [[Giai đoạn tuổi]] · [[Tính cách]] · [[Danh mục loài]]
- [[Module game]] · [[MOC Luật chơi]]
