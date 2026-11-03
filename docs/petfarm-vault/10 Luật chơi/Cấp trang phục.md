---
tags: [petfarm, luat-choi, trang-phuc]
aliases: [Tier, Xanh lam, Xanh lục, Vàng, Đỏ, Cấp đồ]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/gear.js, petdex/server/gear.js, petdex/server/minigames.js, petdex/server/gifts.js, petdex/server/routes.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Cấp trang phục

> [!summary]
> Mỗi bản [[Trang phục]] có một cấp: **Xanh lam → Xanh lục → Vàng → Đỏ**, lần lượt 1, 2, 3, 4 [[Dòng chỉ số trang phục|dòng chỉ số]] với biên độ tăng dần. Cấp được quay ngẫu nhiên khi món sinh ra; May mắn làm cấp cao dễ ra hơn. Siêu thị chỉ bán ra Xanh lam/Xanh lục; Vàng và Đỏ chỉ có từ mini-game, mã quà hoặc mua lại ở Chợ Phiên.

## Con số
| Cấp | Mã | Màu | Số dòng | Tỉ lệ quay mặc định | Biên độ mỗi dòng | Hệ số giá tham chiếu Chợ Phiên | Nguồn |
|---|---|---|---|---|---|---|---|
| Xanh lam | `blue` | `#4f8fd6` | 1 | 60% | 2–5% | ×1 | `public/ta-tua/game/js/shared/gear.js:8,15,53,56` |
| Xanh lục | `green` | `#3fa860` | 2 | 28% | 4–8% | ×2 | `public/ta-tua/game/js/shared/gear.js:9,15,53,57` |
| Vàng | `gold` | `#e0a21c` | 3 | 10% | 7–12% | ×4 | `public/ta-tua/game/js/shared/gear.js:10,15,53,58` |
| Đỏ | `red` | `#e2493b` | 4 | 2% | 10–20% | ×8 | `public/ta-tua/game/js/shared/gear.js:11,15,53,59` |

Quản trị viên chỉnh tỉ lệ, biên độ và tỉ lệ rớt trên bảng quản lý (`setGearConfig`, `petdex/server/gear.js:42-52`; kiểm tra ở `normalizeGearConfig`, `public/ta-tua/game/js/shared/gear.js:72-103`): tỉ lệ 0–100, biên độ 0–100%, phải có ít nhất một cấp > 0. Xem [[Quản trị trang phục và mã quà]].

## Công thức
```
boost = 1 + May mắn% / 100
trọng số cấp i (0 = lam … 3 = đỏ) = odds[i] × boost^i
```
(`rollTier`, `public/ta-tua/game/js/shared/gear.js:106-116`.) Sau khi có cấp, `rollAffixes` xáo 4 loại chỉ số, lấy đủ số dòng của cấp, mỗi dòng một số nguyên đều trong biên độ (`public/ta-tua/game/js/shared/gear.js:119-131`).

| May mắn | Lam | Lục | Vàng | Đỏ |
|---|---|---|---|---|
| 0% | 60,0% | 28,0% | 10,0% | 2,0% |
| 10% | 56,8% | 29,2% | 11,5% | 2,5% |
| 25% | 52,4% | 30,6% | 13,6% | 3,4% |
| 42,5% | 47,6% | 31,7% | 16,1% | 4,6% |
| 60% (trần) | 43,3% | 32,3% | 18,5% | 5,9% |

(Tính bằng chính `rollTier`; May mắn hiệu dụng tối đa 60% do [[Dòng chỉ số trang phục|cộng dồn có giảm dần]].)

## Nguồn ra đồ và cấp
| Nguồn | Cấp có thể ra | May mắn dùng | Nguồn |
|---|---|---|---|
| [[Hộp kín Siêu thị]] | Lam, Lục | May mắn của [[Thú chính]] + `gradeLuck(minLevel)` | `petdex/server/routes.js:297`, `public/ta-tua/game/js/shared/gear.js:143-150` |
| [[Mini-game]] (3%/ván) | cả 4 cấp, món ngẫu nhiên trong 55 | May mắn của bé chơi | `petdex/server/minigames.js:77-80`, `petdex/server/gear.js:82-85` |
| [[Mã quà]] | cấp chọn sẵn hoặc "cấp ngẫu nhiên" (quay theo tỉ lệ, không May mắn) | 0 | `petdex/server/gifts.js:172` |
| [[Chợ Phiên]] | bản người chơi khác bán | | [[Chợ Phiên]] |

## Trường hợp đặc biệt
- Đồ có trước khi có hệ thống cấp được chuyển thành Xanh lam một dòng ngẫu nhiên (`README.md:174`).
- Quản trị viên nhập tay dòng chỉ số thì mỗi dòng tối đa 100% (`BONUS_CAP`, `public/ta-tua/game/js/shared/gear.js:27,166-176`).
- Cấp không đổi sau khi tạo; không có ghép, nâng cấp hay phân rã đồ.

## Liên quan
- [[Trang phục]] · [[Dòng chỉ số trang phục]] · [[Hộp kín Siêu thị]] · [[Mini-game]] · [[Mã quà]] · [[Chợ Phiên]] · [[Module gear]]
