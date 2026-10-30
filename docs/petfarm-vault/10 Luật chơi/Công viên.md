---
tags: [petfarm, luat-choi, xa-hoi, cong-vien]
aliases: [Park, Sân chơi, Vuốt ve, Cư dân công viên]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/playground.js, petdex/server/game.js, petdex/server/db.js, public/ta-tua/game/js/park.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Công viên

> [!summary]
> 🌳 Công viên là không gian chung thời gian thực: người chơi dắt [[Thú chính]] ra đi lại, chat, làm biểu cảm, vuốt ve và tặng quà cho bé khác. Bé của người chơi không online vẫn có mặt như **cư dân** (vắng chủ) đứng ở chỗ riêng, vẫn được vuốt ve, tặng quà. Vuốt ve cho cả hai bé Vui vẻ và XP, người chủ động thêm 3 xu.

## Con số
| Luật | Giá trị | Nguồn |
|---|---|---|
| Kích thước bãi | 1000 × 600, đi lại trong x 50–950, y 318–585 | `petdex/server/playground.js:6` |
| Vuốt ve | cả hai bé +6 Vui vẻ, +5 XP; người vuốt +3 xu | `petdex/server/game.js:283-285`, `petdex/server/playground.js:208-210` |
| Chờ giữa hai lần vuốt cùng một cặp bé | 30 giây (theo chiều: bé A vuốt bé B) | `petdex/server/playground.js:9,198-202` |
| Chat | tối đa 120 ký tự, cách nhau ≥ 1 giây | `petdex/server/playground.js:10,180-188` |
| Biểu cảm | vẫy (`wave`), nhảy (`jump`), xoay (`spin`) | `petdex/server/playground.js:12,190-193` |
| Tặng quà | đồ ăn hoặc đồ chăm sóc, cách nhau ≥ 2 giây, không giới hạn số lượng | `petdex/server/playground.js:11,226-241` |
| Cư dân vắng chủ | tối đa 50 người, ưu tiên mới hoạt động gần đây | `petdex/server/playground.js:37`, `petdex/server/db.js:772-773` |

## Cách hoạt động
- Vào: sự kiện `pg:join`; cần có Thú chính còn sống: "Hãy nhận nuôi và chọn một thú cưng chính trước khi ra công viên." (`petdex/server/playground.js:138-141`). Mỗi người chỉ một bé: mở tab mới thì tab cũ bị đẩy ra (`pg:kicked`, 143-150).
- Cư dân: mọi người chơi không bị khóa có Thú chính đều xuất hiện ở chỗ đứng cố định tính từ mã người chơi (`homeSpot`, `petdex/server/playground.js:42-61`). Rời công viên thì bé ở lại thành cư dân (`leave`, 86-96).
- Vuốt ve (`pg:cuddle`): "💖 <bé mình> và <bé kia> thân nhau hơn rồi! +3 🪙"; chủ bé kia (nếu online) thấy "💖 <tên> vừa vuốt ve <bé> của bạn!" (`petdex/server/playground.js:195-224`). Bấm vào bé mình: "Đó là bé của bạn mà."; vuốt quá nhanh: "Đợi N giây nữa rồi vuốt ve <bé> tiếp nhé."
- Tặng quà (`pg:gift`): "🎁 Đã tặng <món> cho <tên>" / "🎁 <tên> tặng bạn <món>!"; quá nhanh: "Tặng quà chậm thôi nào!"
- Khi bé thay đổi ở nơi khác (ăn, đổi đồ, lên cấp), thẻ trên công viên tự cập nhật qua sự kiện `pet:changed` (`petdex/server/playground.js:78-84`).
- Giao thức chi tiết: [[Giao thức công viên]]; vẽ: [[Vẽ công viên]].

## Trường hợp đặc biệt
- Vuốt ve cư dân vắng chủ vẫn cộng Vui vẻ, XP cho bé của họ (có thể làm bé đó lên cấp khi chủ offline).
- Xu vuốt ve (+3) không có giới hạn ngày; giới hạn duy nhất là 30 giây mỗi cặp. Có nhiều bé trong công viên thì vuốt lần lượt từng bé.
- Vuốt ve cộng nhiệm vụ "Vuốt ve một bé ở công viên" cho người chủ động.
- Bé mất thì người chơi vẫn ở lại tới khi rời công viên (`refresh`, `petdex/server/playground.js:70-76`).

## Liên quan
- [[Thú chính]] · [[Bạn bè]] · [[Chỉ số của bé]] · [[Nhiệm vụ ngày]] · [[Giao thức công viên]] · [[Vẽ công viên]] · [[Hub WebSocket]] · [[Module playground]]
