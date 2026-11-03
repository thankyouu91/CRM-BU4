---
tags: [petfarm, luat-choi, thu-chinh]
aliases: [Bé chính, Thú cưng chính, Active pet, Chọn thú chính]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/routes.js, petdex/server/eggs.js, petdex/server/lifecycle.js, petdex/server/gear.js, petdex/server/minigames.js, petdex/server/quests.js, petdex/server/playground.js, petdex/server/social.js, petdex/server/gifts.js, petdex/server/farm.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Thú chính

> [!summary]
> Mỗi người chơi có đúng một **thú chính** (⭐) trong số các bé đang nuôi. Thú chính là "gương mặt" của người chơi: ra [[Công viên]], chơi [[Mini-game]], nhận XP nhiệm vụ, nhận tim của bạn bè, và các chỉ số trang phục của nó được dùng cho việc chung của cả nhà (mua hộp, giao dịch, nấu ăn, quà hợp mệnh). Chọn đúng thú chính giúp tận dụng đồ May mắn, Thu nhập giao dịch và hành của bé.

## Cách hoạt động
- Bé đầu tiên tự thành thú chính (`petdex/server/eggs.js:30`). Đổi: nút "⭐ Chọn thú chính · Để dắt ra công viên" ở màn Nhà → `POST /pets/:id/active`: "<tên> giờ là thú cưng chính, sẽ cùng bạn ra công viên." (`petdex/server/routes.js:204-209`, `public/ta-tua/game/js/app.js:542`).
- Thú chính mất thì bé còn lại đầu tiên được chọn thay (`petdex/server/lifecycle.js:82`).

## Thú chính được dùng ở đâu
| Hệ thống | Dùng gì của thú chính | Nguồn |
|---|---|---|
| [[Công viên]] | bé được dắt ra, và cư dân khi vắng chủ | `petdex/server/playground.js:55-61,138-141` |
| [[Mini-game]] | trừ năng lượng, cộng kỹ năng, XP, May mắn rớt đồ | `petdex/server/minigames.js:46-52,109-110` |
| [[Nhiệm vụ ngày]] | nhận +10 XP mỗi nhiệm vụ | `petdex/server/quests.js:83-87` |
| [[Bạn bè]] thả tim | +5 Vui vẻ | `petdex/server/social.js:141-143` |
| [[Hộp kín Siêu thị]] | % May mắn | `petdex/server/routes.js:297`, `petdex/server/gear.js:209-212` |
| Thu nhập giao dịch (Sàn, Chợ Phiên, bán món) | % Thu nhập giao dịch | `petdex/server/gear.js:218-223` |
| [[Mã quà]] hợp mệnh | hành | `petdex/server/gifts.js:143-147` |
| [[Bếp]] | bé nấu, Khéo tay, May mắn, Kim +15 | `petdex/server/farm.js:205-216` |
| [[Vườn]] | hành Mộc +15% thu hoạch | `petdex/server/farm.js:126-134` |
| Thẻ bạn bè, thăm nhà | thẻ bé hiển thị | `petdex/server/social.js:60-66` |

## Trường hợp đặc biệt
- Bé đeo đồ May mắn/giao dịch nhưng không phải thú chính thì gần như không có ích cho việc chung; nên chuyển đồ sang thú chính hoặc đổi thú chính.
- Bảo hiểm, quà ngày, nhận nuôi không phụ thuộc thú chính.
- Thú chính đang đi làm vẫn chơi mini-game được (máy chủ không kiểm tra bận ở mini-game).

## Liên quan
- [[Công viên]] · [[Mini-game]] · [[Trang phục]] · [[Dòng chỉ số trang phục]] · [[Mã quà]] · [[Chăm sóc ở nhà]]
