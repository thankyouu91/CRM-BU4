---
tags: [petfarm, luat-choi, xep-hang]
aliases: [Xếp hạng, Leaderboard, Tài sản ròng xếp hạng, Forbes Phố Trân Châu]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/routes.js, petdex/server/db.js, petdex/server/wallet.js, petdex/server/lifecycle.js, public/ta-tua/game/js/app.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Bảng vàng

> [!summary]
> 🏆 Bảng vàng (ô cuối hàng 2 trên bản đồ) có 3 tab: **⭐ Cấp độ** (20 bé cấp cao nhất cả phố), **💎 Tài sản ròng** ("Forbes Phố Trân Châu": 20 người giàu nhất) và **🌠 Đồi Sao** (40 bé đã về với sao trời gần nhất). Đây là nơi khoe tiến độ và tưởng niệm.

## Con số
| Tab | API | Xếp theo | Số dòng | Hiện | Nguồn |
|---|---|---|---|---|---|
| ⭐ Cấp độ | `GET /leaderboard` | cấp giảm dần, rồi XP giảm dần, rồi bé sinh trước | 20 | tên bé, loài, cấp, đồ đeo, chủ, tuần tuổi | `petdex/server/routes.js:127-140`, `petdex/server/db.js:690-692` |
| 💎 Tài sản ròng | `GET /leaderboard?by=networth` | tài sản ròng giảm dần | 20 | tên người chơi, tổng xu | `petdex/server/routes.js:128`, `petdex/server/wallet.js:94-99` |
| 🌠 Đồi Sao | `GET /memorials?scope=all` | ngày mất mới nhất | 40 | tên, loài, chủ, sống N tuần, ngày mất, cấp, hình dáng Lão làng với đồ đeo lúc mất | `petdex/server/routes.js:188`, `petdex/server/lifecycle.js:28` |

Giao diện: `renderRanks` (`public/ta-tua/game/js/app.js:944-1000`); huy chương 🥇🥈🥉 cho ba hạng đầu, dòng của chính mình được tô (`me`). Phụ đề: "20 bé cấp cao nhất cả phố.", "\"Forbes Phố Trân Châu\": 20 người có tài sản ròng lớn nhất.", "Nơi các bé đã về với sao trời được nhớ mãi." (`public/ta-tua/game/js/app.js:948`).

## Trường hợp đặc biệt
- Bảng cấp độ xếp **bé**, không xếp người: một người có thể chiếm nhiều dòng.
- Bảng cấp độ và tài sản ròng không cần đăng nhập ở máy chủ (`/leaderboard` nằm trước `auth`), Đồi Sao thì cần.
- Cách tính tài sản ròng (ví, tiết kiệm, hàng trong kho, xưởng, đất...) thuộc [[Ví và tài sản ròng]] (agent B).
- Đồi Sao trống: "Đồi Sao còn trống. Mong các bé sống thật lâu."

## Liên quan
- [[Cấp độ và XP]] · [[Vòng đời và Đồi Sao]] · [[Ví và tài sản ròng]] · [[Bản đồ Phố Trân Châu]] · [[Màn Bảng vàng]]
