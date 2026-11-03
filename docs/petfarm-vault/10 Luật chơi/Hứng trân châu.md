---
tags: [petfarm, luat-choi, mini-game]
aliases: [Pearls, Hứng trân châu]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/minigames.js, petdex/server/minigames.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Hứng trân châu

> [!summary]
> 🧋 **Hứng trân châu** (`pearls`, 30 giây, 5 năng lượng): di cốc hứng trân châu rơi từ trên xuống, né đá lạnh. Trân châu vàng được nhiều điểm. Cho xu theo điểm, phần trân châu vào kho Sàn và Nhanh nhẹn.

## Con số
| Vật rơi | Điểm | Tỉ lệ xuất hiện | Nguồn |
|---|---|---|---|
| ⚫ Trân châu (`pearl`) | +1 | phần còn lại (≈ 78% đầu ván, ≈ 66% cuối ván) | `public/ta-tua/game/js/shared/minigames.js:50,65` |
| 🟡 Trân châu vàng (`gold`) | +5 | 6% | `public/ta-tua/game/js/shared/minigames.js:51,65` |
| 🧊 Đá lạnh (`ice`) | −3 | 16% đầu ván → 28% cuối ván | `public/ta-tua/game/js/shared/minigames.js:52,65` |

## Công thức
```
lịch rơi (pearlSchedule): bắt đầu t = 0,6 s, tới 29 s
  loại: roll < 0,06 → vàng; roll < 0,22 + 0,12·tiến độ → đá; còn lại → trân châu
  vị trí x = 0,06 + U(0, 0,88);  tốc độ = 0,38 + 0,35·tiến độ + U(0, 0,12)
  khoảng cách = 0,55 − 0,3·tiến độ + U(0, 0,25)  (càng về cuối càng dày và nhanh)
điểm = Σ điểm vật hứng được
xu   = max(0, round(điểm × 0,5))
phần trân châu = floor(số trân châu thường / 4)
Nhanh nhẹn thô = 0,15 × min(max(điểm, 0), 30) / 3    (tối đa 1,5)
```
(`public/ta-tua/game/js/shared/minigames.js:59-70,115-134`.)

## Trường hợp đặc biệt
- Client gửi danh sách chỉ số vật hứng được; mỗi vật một lần, vật chưa kịp rơi (t > thời gian thật + 0,5 s) bị từ chối: "Hứng được vật chưa kịp rơi." (`public/ta-tua/game/js/shared/minigames.js:120-124`).
- Trân châu vàng không tính vào phần trân châu, chỉ cộng điểm.
- Giới hạn ngày: 20 phần trân châu (2 lô) và 100 xu chung ([[Mini-game]]). Trân châu vào kho dưới ⚫ Trân châu (hạn 5 ngày).

## Liên quan
- [[Mini-game]] · [[Kỹ năng]] · [[Kho Sàn]] · [[Giao diện mini-game]]
