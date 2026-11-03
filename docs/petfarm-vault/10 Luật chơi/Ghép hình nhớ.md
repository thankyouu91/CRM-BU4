---
tags: [petfarm, luat-choi, mini-game]
aliases: [Memory, Lật thẻ]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/minigames.js, petdex/server/minigames.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Ghép hình nhớ

> [!summary]
> 🧩 **Ghép hình nhớ** (`memory`, 60 giây, 5 năng lượng): lật hai thẻ giống nhau trong bộ 16 thẻ (8 cặp), càng ít lượt càng giỏi. Cho xu theo số cặp và thưởng nếu xong gọn, cộng Thông minh. Không cho nguyên liệu.

## Con số
| Mục | Giá trị | Nguồn |
|---|---|---|
| Bộ thẻ | 8 hình: boba, fish, heart, star, leaf, berry, cake, moon; mỗi hình 2 thẻ, xáo theo hạt giống | `public/ta-tua/game/js/shared/minigames.js:74-85` |
| Xu | 3 / cặp | `public/ta-tua/game/js/shared/minigames.js:145` |
| Thưởng xong cả 8 cặp | +12 nếu ≤ 12 lượt; +6 nếu ≤ 16 lượt; 0 nếu hơn | `public/ta-tua/game/js/shared/minigames.js:141` |
| Xu tối đa một ván | 36 | |
| Điểm | cặp × 10 − max(0, lượt − 8) | `public/ta-tua/game/js/shared/minigames.js:144` |
| Thông minh thô | 0,4 + 0,1 × cặp (tối đa 1,2) | `public/ta-tua/game/js/shared/minigames.js:147` |

## Trường hợp đặc biệt
- Kiểm tra: cặp 0–8, lượt ≥ cặp ("Số lượt không khớp."), xong cả 8 cặp dưới 8 giây bị từ chối ("Lật thẻ nhanh hơn sức người.") (`public/ta-tua/game/js/shared/minigames.js:136-140`).
- Máy chủ không kiểm tra từng lượt lật, chỉ số lượt và số cặp người chơi gửi lên.
- Ba ván hoàn hảo (36 xu/ván) gần chạm giới hạn 100 xu/ngày ([[Mini-game]]).

## Liên quan
- [[Mini-game]] · [[Kỹ năng]] · [[Nghề Gia sư]] · [[Giao diện mini-game]]
