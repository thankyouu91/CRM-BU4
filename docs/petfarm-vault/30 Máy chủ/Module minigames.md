---
tags: [petfarm, may-chu, module, mini-game]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/minigames.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module minigames

> [!summary]
> `petdex/server/minigames.js` (127 dòng): server cấp **phiên chơi có hạt giống**, chấm kết quả bằng luật dùng chung (`judge` trong `public/ta-tua/game/js/shared/minigames.js`) và áp giới hạn thưởng ngày. Nhờ vậy client không tự khai điểm được. Luật trò chơi: [[Mini-game]], [[Câu cá]], [[Hứng trân châu]], [[Ghép hình nhớ]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `gamesView(userId, now)` | `minigames.js:35-41` | `{ caps: DAILY_CAPS, used: { coins, fish, pearl, plays } }` |
| `startGame(userId, game, now)` | `minigames.js:43-58` | Cần bé chính khỏe, đủ năng lượng `GAMES[game].energy` (trừ ngay qua `mutatePet`); tạo phiên id 18 hex, `seed` ngẫu nhiên; xóa phiên cũ hơn 2 ngày |
| `rollDrops(userId, pet, now, rand)` | `minigames.js:64-82` | Rớt nguyên liệu thô (tỉ lệ `materialChance`, số lô `materialQty`) và trang phục (`gearDropChance`), cả hai nhân `1 + luck/100` |
| `finishGame(userId, sessionId, result, now)` | `minigames.js:84-127` | Xem dưới |

## `finishGame`
1. Phiên của mình, đánh dấu `finished_at` có điều kiện (chống nộp hai lần: "Ván này đã kết thúc rồi.").
2. `elapsed = min(thời gian thật, duration + 10 giây)`; `judge(game, seed, elapsed, result)`; sai thì ném `verdict.reason`.
3. Kẹp xu và phần `fish`/`pearl` theo phần còn lại của `DAILY_CAPS` trong ngày; xu sổ `minigame`; hàng vào kho Sàn (`addGoods`, nhận tới khi kho đầy).
4. Ghi `minigame_days`, `growSkill` theo `verdict.skill`, +3 XP, `rollDrops`, nhiệm vụ `minigame`.

## Bảng
`minigame_sessions`, `minigame_days`, `lots`, `gear`, `pet_skills`, `ledger`.

## Ai gọi
`routes-economy.js:48-58`.

## Lưu ý
- Năng lượng bị trừ ở `startGame`, kể cả khi người chơi bỏ ván.
- Cấu hình tỉ lệ rớt nằm trong `gear_config` (quản trị chỉnh).

## Liên quan
- [[Mini-game]] · [[Giao diện mini-game]] · [[Module gear]] · [[Module market]]
