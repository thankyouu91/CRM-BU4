---
tags: [petfarm, luat-choi, trang-phuc]
aliases: [Affix, Dòng chỉ số, Thu nhập ca làm, Thu nhập giao dịch, May mắn, Chỉ số trang phục]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/gear.js, petdex/server/gear.js, petdex/server/elements.js, petdex/server/game.js, petdex/server/minigames.js, petdex/server/farm.js, petdex/server/routes.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Dòng chỉ số trang phục

> [!summary]
> Mỗi bản [[Trang phục]] mang 1–4 dòng "+%" thuộc 4 loại: 💼 Thu nhập ca làm, 📈 Chỉ số, 🏮 Thu nhập giao dịch, 🍀 May mắn. Các dòng của đồ đang đeo cộng dồn cho bé nhưng **có giảm dần**: mỗi loại tính đủ tới 25%, phần vượt chỉ tính một nửa, tổng không quá 60%. Luật này có từ commit `152cd2e` để bé đeo 5 món không bỏ xa bé đeo 3 món.

## Con số
| Loại | Mã | Mô tả trong game | Áp dụng thật | Ai dùng | Nguồn |
|---|---|---|---|---|---|
| 💼 Thu nhập ca làm | `income` | Lương các ca làm nghề tăng thêm. | +% vào `elementPay` của ca nghề | bé đi làm | `public/ta-tua/game/js/shared/gear.js:20`, `petdex/server/elements.js:33` |
| 📈 Chỉ số | `stats` | Kỹ năng lên nhanh hơn; đồ ăn, đồ chăm sóc, chơi đùa và tắm hồi chỉ số nhiều hơn. | × (1 + %/100) vào hệ số kỹ năng; phần cộng của đồ ăn, chăm sóc, chơi, tắm | bé đó | `public/ta-tua/game/js/shared/gear.js:21`, `petdex/server/elements.js:12`, `petdex/server/game.js:254-258` |
| 🏮 Thu nhập giao dịch | `trade` | Thưởng thêm khi bán ở Chợ Phiên, trên Sàn nguyên liệu và bán món cho quán ăn. | thêm floor(tiền bán × %/100) xu, ghi sổ loại `gear_trade` | [[Thú chính]] | `public/ta-tua/game/js/shared/gear.js:22`, `petdex/server/gear.js:218-223` |
| 🍀 May mắn | `luck` | Nấu dễ ra món ngon, mini-game dễ rớt vật liệu và trang phục, mua đồ dễ ra cấp cao. | nhân tỉ lệ rớt mini-game; đẩy cấp khi quay đồ; chia số ngẫu nhiên khi nấu | bé chơi (mini-game), [[Thú chính]] (mua hộp, nấu) | `public/ta-tua/game/js/shared/gear.js:23`, `petdex/server/minigames.js:66-77`, `petdex/server/routes.js:297`, `petdex/server/farm.js:210-211` |

| Hằng số | Giá trị | Nguồn |
|---|---|---|
| `STACKING.softCap` | 25% | `public/ta-tua/game/js/shared/gear.js:34` |
| `STACKING.overRate` | 0,5 | như trên |
| `STACKING.totalCap` | 60% | như trên |
| `BONUS_CAP` (một dòng) | 100% | `public/ta-tua/game/js/shared/gear.js:27` |

## Công thức
```
thô    = tổng các dòng cùng loại trên đồ đang đeo
thực   = min(60, thô ≤ 25 ? thô : 25 + (thô − 25) × 0,5)    (làm tròn 0,1)
```
(`effectiveBonus`, `sumBonus`, `public/ta-tua/game/js/shared/gear.js:37-42,153-160`.)

| Thô | 10 | 25 | 30 | 40 | 50 | 60 | 80 | ≥ 95 |
|---|---|---|---|---|---|---|---|---|
| Thực nhận | 10 | 25 | 27,5 | 32,5 | 37,5 | 42,5 | 52,5 | 60 |

Mô phỏng 20.000 lần trong `docs/pet-town-gear-balance.md` (dòng Thu nhập ca làm, trung bình): đồ Siêu thị 3/4/5 món ≈ 4,7 / 6,2 / 7,8%; toàn Đỏ 35 / 42,5 / 50%; "Đỏ chọn lọc" 5 món giảm từ 93,1% xuống 58,8%. Hệ số lương tối đa sau chỉnh ≈ 1 + 0,59 + 0,10 + 0,08 = 1,77×.

## Trường hợp đặc biệt
- Mỗi loại tối đa một dòng trên một món (`rollAffixes` lấy không lặp, `public/ta-tua/game/js/shared/gear.js:119-131`).
- "Chỉ số" chỉ tăng phần **cộng**; phần trừ (chơi đùa −15 NL) giữ nguyên.
- Thưởng giao dịch có thể ra % lẻ (ví dụ "+32.5% trang phục"), số xu làm tròn xuống.
- Bé đeo đồ May mắn nhưng không phải [[Thú chính]] chỉ hưởng May mắn khi chính bé chơi mini-game; mini-game luôn dùng thú chính, nên thực tế May mắn chỉ có ích trên thú chính.

> [!warning] Lệch tài liệu
> `README.md:174` (README gốc) còn ghi "mỗi loại tối đa 100%", luật trước commit `152cd2e`.

## Liên quan
- [[Trang phục]] · [[Cấp trang phục]] · [[Bộ đồ ngũ hành]] · [[Việc làm]] · [[Mini-game]] · [[Bếp]] · [[Chợ Phiên]] · [[Sàn Nguyên Liệu]]
