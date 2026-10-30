---
tags: [petfarm, luat-choi, xa-hoi]
aliases: [Kết bạn, Thăm nhà, Thả tim, Tặng quà bạn, Friends]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/social.js, petdex/server/routes-community.js, petdex/server/farm.js, public/ta-tua/game/js/views/community.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Bạn bè

> [!summary]
> Người chơi kết bạn theo tên để thăm nhà, thả tim (bé chính của bạn vui hơn) và tặng đồ ăn, đồ chăm sóc. Bạn bè còn là điều kiện để tưới hộ [[Vườn]] và để nhiệm vụ "Thả tim nhà một người bạn" xuất hiện. Màn "👥 Bạn bè & Hội" gộp bạn bè và [[Hội]].

## Con số
| Luật | Giá trị | Nguồn |
|---|---|---|
| Bạn tối đa | 100 | `petdex/server/social.js:14,93` |
| Thả tim | 1 lần / bạn / ngày; [[Thú chính]] của bạn ấy +5 Vui vẻ | `petdex/server/social.js:16,135-148` |
| Tặng quà | chỉ đồ ăn hoặc đồ chăm sóc; 5 món / ngày (tổng, mọi bạn) | `petdex/server/social.js:15,150-161` |
| Thăm nhà | chỉ nhà bạn bè; xem các bé (cấp, đồ đeo, tâm trạng, tuổi, đang bận, kỹ năng), tổng tim, Hội | `petdex/server/social.js:118-133` |

## Cách hoạt động
- **Kết bạn**: `POST /friends/request {username}` gửi lời mời; nếu người kia đã mời mình thì tự thành bạn ngay; `POST /friends/:id/accept` đồng ý; quan hệ lưu hai chiều (`petdex/server/social.js:87-108`). `POST /friends/:id/remove` xóa cả hai chiều (110-115).
- **Danh sách**: mỗi bạn kèm thẻ bé chính, đang ở công viên không (`inPark`), đã thả tim hôm nay chưa; số quà còn tặng được; số tim mình nhận hôm nay và tổng (`friendsView`, `petdex/server/social.js:70-85`).
- **Thả tim**: `POST /friends/:id/like` → "💖 Đã thả tim nhà <tên>, bé chính của bạn ấy vui hơn." Cộng nhiệm vụ `friend`.
- **Tặng quà**: `POST /friends/:id/gift {itemId}` → món chuyển từ túi mình sang túi bạn: "🎁 Đã tặng <món> cho <tên>."
- Routes: `petdex/server/routes-community.js:51-59`.
- Màn: "👥 Bạn bè & Hội · Kết bạn để thăm nhà, thả tim, tặng quà. Vào Hội để góp quỹ, nâng cấp và cùng làm dự án tuần." (`public/ta-tua/game/js/views/community.js:11`).

## Lời báo lỗi
"Không tìm thấy người chơi này." · "Không thể tự kết bạn với chính mình." · "Bạn và <tên> đã là bạn rồi." · "Tối đa 100 bạn." · "Đã gửi lời mời rồi, chờ bạn ấy đồng ý nhé." · "Chỉ thăm được nhà bạn bè." · "Hôm nay bạn đã thả tim nhà này rồi." · "Chỉ tặng được đồ ăn hoặc đồ chăm sóc." · "Mỗi ngày tặng tối đa 5 món." (`petdex/server/social.js:87-161`).

## Trường hợp đặc biệt
- Tặng quà ở [[Công viên]] **không** tính vào giới hạn 5 món/ngày và không cần là bạn.
- Thả tim cộng Vui vẻ cho bé chính của bạn kể cả khi bạn ấy offline; không cho người thả xu hay XP.
- Giới hạn 100 bạn chỉ kiểm tra phía người gửi lời mời.
- Tưới hộ vườn bạn: chỉ bạn bè, +20% vụ đó cho chủ vườn, người tưới +2 xu, +5 XP (xem [[Vườn]], agent B).

## Liên quan
- [[Công viên]] · [[Hội]] · [[Vườn]] · [[Thú chính]] · [[Nhiệm vụ ngày]] · [[Màn Bạn bè và Hội]] · [[Module social]]
