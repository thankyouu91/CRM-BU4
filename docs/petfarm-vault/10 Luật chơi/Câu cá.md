---
tags: [petfarm, luat-choi, mini-game]
aliases: [Hồ câu, Fishing]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/shared/minigames.js, petdex/server/minigames.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Câu cá

> [!summary]
> 🎣 **Câu cá** (`fishing`, 40 giây, 5 năng lượng): phao chạy qua lại trên thanh, bấm khi phao nằm trong vùng xanh để giật cần. Mỗi lần quăng gặp một con cá đã định sẵn theo hạt giống; cá hiếm có vùng xanh hẹp hơn và phao chạy nhanh hơn. Cho xu, phần cá vào kho Sàn và Nhanh nhẹn.

## Con số
| Cá | Mã | Phần cá | Xu | Vùng xanh (tỉ lệ thanh) | Tốc độ phao (lượt/giây) | Tỉ lệ gặp | Nguồn |
|---|---|---|---|---|---|---|---|
| Cá rô | `ro` | 1 | 1 | 0,26 | 0,9 | 46% | `public/ta-tua/game/js/shared/minigames.js:28` |
| Cá chép | `chep` | 2 | 1 | 0,20 | 1,2 | 30% | `public/ta-tua/game/js/shared/minigames.js:29` |
| Cá hồi | `hoi` | 3 | 2 | 0,15 | 1,5 | 15% | `public/ta-tua/game/js/shared/minigames.js:30` |
| Cá vàng | `vang` | 2 | 15 | 0,12 | 1,8 | 7% | `public/ta-tua/game/js/shared/minigames.js:31` |
| Cá mặt trăng | `trang` | 4 | 40 | 0,08 | 2,2 | 2% | `public/ta-tua/game/js/shared/minigames.js:32` |

Kỳ vọng mỗi lần quăng **nếu bắt được hết**: 2,91 xu và 1,73 phần cá.

## Công thức
```
thứ tự cá = fishSequence(seed): 60 con, bốc theo trọng số 46/30/15/7/2
số lần quăng hợp lệ ≤ floor(thời gian thật / 1,2) + 1   (MIN_CAST_SECONDS = 1,2)
caught[i] = true/false cho lần quăng i
xu = Σ coins cá bắt được;  phần cá = Σ portions;  điểm = số con;  Nhanh nhẹn thô = 0,25 × số con
```
(`public/ta-tua/game/js/shared/minigames.js:35-45,98-113`.)

Tối đa khoảng 42 lần quăng trong một ván (thời gian thật bị chặn ở 40 + 10 giây).

## Trường hợp đặc biệt
- Gửi quá nhiều lần quăng so với thời gian: "Quăng cần nhanh hơn sức người."; quá 60 lần: "Quá nhiều lần quăng." (`public/ta-tua/game/js/shared/minigames.js:101-103`).
- Giới hạn ngày: 100 xu (chung 3 trò), 10 phần cá ([[Mini-game]]). Một con Cá mặt trăng đã là 40 xu.
- Phần cá vào kho dưới mặt hàng 🐟 Cá tươi của [[Sàn Nguyên Liệu]] (hạn dùng 2 ngày), dùng ở [[Bếp]] hoặc bán.

## Liên quan
- [[Mini-game]] · [[Kỹ năng]] · [[Kho Sàn]] · [[Giao diện mini-game]]
