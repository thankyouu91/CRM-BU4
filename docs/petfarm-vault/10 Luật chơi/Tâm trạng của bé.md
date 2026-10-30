---
tags: [petfarm, luat-choi, chi-so]
aliases: [Tâm trạng, Mood]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/game.js, public/ta-tua/game/js/ui.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tâm trạng của bé

> [!summary]
> Tâm trạng là nhãn tóm tắt suy ra từ [[Chỉ số của bé]], hiện trong bong bóng ở màn Nhà và quyết định hoạt cảnh đứng yên của bé. Nó không có tác dụng luật chơi riêng, nhưng là cách nhanh nhất để thấy bé cần gì.

## Cách hoạt động
Hàm `mood(pet)` xét lần lượt, gặp điều kiện đầu tiên thì dừng (`petdex/server/game.js:241-249`):

| Thứ tự | Điều kiện | Nhãn | Biểu tượng UI | Nguồn |
|---|---|---|---|---|
| 1 | Đang ốm | tên bệnh (Cảm lạnh / Đau bụng) | 🤒 | `petdex/server/game.js:242` |
| 2 | No bụng < 20 | Đói meo | 😋 | `petdex/server/game.js:243` |
| 3 | Sạch sẽ < 20 | Lấm lem | 🫧 | `petdex/server/game.js:244` |
| 4 | Năng lượng < 15 | Buồn ngủ | 😴 | `petdex/server/game.js:245` |
| 5 | Vui vẻ < 25 | Buồn thiu | 🥺 | `petdex/server/game.js:246` |
| 6 | TB(No, Vui, NL) ≥ 70 | Vui phơi phới | 🥰 | `petdex/server/game.js:247-248` |
| 7 | còn lại | Bình thường | 🙂 | `petdex/server/game.js:248` |

Biểu tượng: `MOOD_ICONS` ở `public/ta-tua/game/js/ui.js:9`.

## Trường hợp đặc biệt
- Sạch sẽ và Sức khỏe không tính vào trung bình của "Vui phơi phới".
- Khi bé đang bận, bong bóng hiện việc đang làm thay cho tâm trạng (`public/ta-tua/game/js/app.js:504-508`).

## Liên quan
- [[Chỉ số của bé]] · [[Chăm sóc ở nhà]] · [[Cảnh nhà và thời gian trong ngày]] · [[Màn Nhà]]
