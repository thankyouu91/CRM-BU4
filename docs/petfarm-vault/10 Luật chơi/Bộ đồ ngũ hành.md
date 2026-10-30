---
tags: [petfarm, luat-choi, trang-phuc, ngu-hanh]
aliases: [Bộ đồ cùng hành, Set bonus, Đủ bộ]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/pets.js, petdex/server/elements.js, public/ta-tua/game/js/rig.js, public/ta-tua/game/js/app.js, docs/pet-town-gear-balance.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Bộ đồ ngũ hành

> [!summary]
> Đeo từ 3 món [[Trang phục]] **cùng một hành** (bất kể hành của bé) thì được thưởng lương ca nghề: 3 món +3%, 4 món +5%, 5 món +8%, và bé có hiệu ứng sao lấp lánh màu hành. Từ commit `152cd2e`, bộ được tính trên cả 5 khe kể cả Bùa, để bé dưới cấp 30 (chỉ đeo 3 món) cũng có mục tiêu gom bộ.

## Con số
| Số món cùng hành | Thưởng lương | Nguồn |
|---|---|---|
| 3 | +3% | `public/ta-tua/game/js/shared/pets.js:289` |
| 4 | +5% | như trên |
| 5 | +8% | như trên |

| Bé | Bộ lớn nhất đạt được |
|---|---|
| Dưới cấp 30 | 3 món |
| Từ cấp 30 | 4 món |
| Huyền thoại dưới cấp 30 | 4 món |
| Huyền thoại từ cấp 30 | 5 món |

### Cấp mua sớm nhất để gom bộ (chỉ bằng đồ Siêu thị)
| Hành | Bộ 3 | Bộ 4 | Bộ 5 |
|---|---|---|---|
| Kim | 3 (Mặt, Cổ, Bùa) | 10 (+Cánh thiên thần) | 20 (+Vương miện) |
| Mộc | 2 (Đầu, Bùa, Cổ) | 3 (+Mặt) | 6 (+Cánh bướm) |
| Thủy | 2 (Đầu, Bùa, Cổ) | 3 (+Mặt) | 6 (+Áo choàng sóng) |
| Hỏa | 1 (Nơ hồng, Khăn quàng đỏ, Đèn lồng) | 3 (+Mặt) | 20 (+Cánh rồng) |
| Thổ | 3 (Mũ rơm, Nơ cổ nâu, Kính gọng gỗ/Ba lô) | 3 | 5 (+Hồ lô) |

(Suy ra từ [[Danh mục trang phục]]; cấp mua xét theo bé cao nhất trong nhà, còn số món đeo xét theo cấp của bé đeo.)

## Công thức
```
đếm số món theo hành trên 5 khe; lấy hành nhiều món nhất (n)
n ≥ 3  →  pay = sets[min(5, n)]
hệ số lương ca nghề elementPay += pay
```
(`setOf`, `public/ta-tua/game/js/shared/pets.js:318-326`; `elementPay`, `petdex/server/elements.js:29-36`.) `fullSetOf` trả hành của bộ để vẽ hiệu ứng (`public/ta-tua/game/js/shared/pets.js:329`, `public/ta-tua/game/js/rig.js:1021`).

## Trường hợp đặc biệt
- Bộ đồ **không** cần hợp mệnh với bé: bé Kim đeo 3 món Hỏa (kỵ mệnh) vẫn +3% lương, nhưng tốc độ kỹ năng −15% ([[Hợp mệnh và kỵ mệnh]]).
- Chỉ áp cho 5 nghề ở [[Việc làm]]; ca trực quầy, đứng máy không hưởng.
- Màn Nhà hiện "✨ bộ N món hành X: +Y% lương" khi có bộ (`public/ta-tua/game/js/app.js:448-462`).
- Trước `152cd2e`: chỉ "đủ 4 khe Đầu/Mặt/Cổ/Lưng cùng hành" mới +5%, khe Bùa không tính, và bé dưới cấp 30 không bao giờ đạt được (`docs/pet-town-gear-balance.md`, mục 2, vấn đề 5).

> [!warning] Lệch tài liệu
> `petdex/README.md:49` vẫn ghi "đủ bộ 4 khe cùng hành +5% lương". Code và wiki người chơi (`lib/wiki/articles.ts:399`) đã theo luật 3/4/5 món.

## Liên quan
- [[Trang phục]] · [[Danh mục trang phục]] · [[Ngũ hành]] · [[Hợp mệnh và kỵ mệnh]] · [[Việc làm]] · [[Dòng chỉ số trang phục]]
