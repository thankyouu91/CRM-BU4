---
tags: [petfarm, luat-choi, ban-do]
aliases: [Phố Trân Châu, Bản đồ phố, Màn Phố, Town map]
loai: luat
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/map.js, public/ta-tua/game/js/townmap.js, petdex/server/routes-economy.js, petdex/server/clans.js, petdex/server/service.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Bản đồ Phố Trân Châu

> [!summary]
> Màn chính của game là bản đồ pixel **Phố Trân Châu** với 18 tòa nhà xếp hai hàng, mỗi tòa mở một màn. Tòa chưa đủ cấp hiện mờ với chữ "Mở khi có bé cấp N". Trên bản đồ còn có dải [[Hành vượng|vận khí hôm nay]], bảng [[Nhiệm vụ ngày]] và huy hiệu nhắc việc (lương sẵn sàng, kỳ hạn đến hạn, có quà ngày).

## Con số
| Hàng · ô | Tòa nhà | Màn mở | Cấp mở (theo `catalog.unlocks`) | Ghi chú |
|---|---|---|---|---|
| 0 · 0 | 🏠 Nhà | Nhà | 1 | huy hiệu "Có quà ngày!" ([[Chăm sóc ở nhà]]) |
| 0 · 1 | 🏪 Siêu thị | Siêu thị | 1 | [[Siêu thị]] |
| 0 · 2 | 💼 Việc làm | Việc làm | 1 | huy hiệu "Lương sẵn sàng!" ([[Việc làm]]) |
| 0 · 3 | 🏦 Ngân hàng | Ngân hàng | 3 (`bank`) | huy hiệu "Kỳ hạn đến hạn!" ([[Ngân hàng Trân Châu]]) |
| 0 · 4 | 📈 Sàn Nguyên Liệu | Sàn | 1 (đặt lệnh cần cấp 2) | [[Sàn Nguyên Liệu]] |
| 0 · 5 | 📰 Báo Trân Châu | Báo | 1 | [[Báo Trân Châu]] |
| 0 · 6 | 🏛️ Tòa thị chính | Tòa thị chính | 3 (`townhall`) | [[Tòa thị chính]] |
| 0 · 7 | 🏫 Trường học | Trường học | 2 (`school`) | [[Trường học]] |
| 0 · 8 | 🩺 Phòng khám | Phòng khám | 1 | [[Ốm và Phòng khám]] |
| 1 · 0 | 🌳 Công viên | Công viên | 1 | [[Công viên]] |
| 1 · 1 | 🎮 Khu vui chơi | Mini-game | 1 | [[Mini-game]] |
| 1 · 2 | 🍳 Bếp | Bếp | 3 (`kitchen`) | [[Bếp]] |
| 1 · 3 | 🌱 Vườn | Vườn | 2 (`garden`) | [[Vườn]] |
| 1 · 4 | 🛒 Chợ Phiên | Chợ Phiên | 4 (`bazaar`) | [[Chợ Phiên]] |
| 1 · 5 | 🧋 Quầy trà sữa | Quầy | 4 (`business`) | [[Quầy trà sữa]] |
| 1 · 6 | 🏭 Khu công nghiệp | Xưởng | 2 (`market`; xây xưởng cấp 6) | [[Khu công nghiệp]] |
| 1 · 7 | 🏘️ Gia tộc & Nhà Đất | Gia tộc | 4 mặc định (`clan`, quản trị chỉnh 1–30) | [[Clan]], [[Bản đồ đất]] |
| 1 · 8 | 🏆 Bảng vàng | Xếp hạng | 1 | [[Bảng vàng]] |

Nguồn: `PLACES`, `public/ta-tua/game/js/views/map.js:7-27`; cấp từ `UNLOCKS` (`petdex/server/routes-economy.js:18-20`) và `clanConfig().unlockLevel` (`petdex/server/clans.js:20,61`). Ô Ngân hàng khóa tới cấp 3 trên bản đồ, dù máy chủ chỉ khóa thao tác gửi tiền (`petdex/server/routes-economy.js:93,102`).

## Cách hoạt động
- `placesFor` tính từng ô: `unlocked = cấp bé cao nhất ≥ unlocks[place.level]`, chữ khóa "Mở khi có bé cấp N", huy hiệu theo `me.badges` (`public/ta-tua/game/js/views/map.js:38-55`; `badges` từ `petdex/server/service.js:47-50`).
- Lời chào: "Chào <tên>! <bé> đang đợi bạn. Chạm vào một tòa nhà để vào." hoặc "Chào mừng tới phố! Ghé Nhà để nhận nuôi bé đầu tiên." (`public/ta-tua/game/js/views/map.js:63-65`).
- Danh sách nút dự phòng hiện ngay, bản đồ pixel (`townmap.js`) nạp sau rồi thay vào (`public/ta-tua/game/js/views/map.js:108-120`). Vẽ chi tiết: [[Vẽ bản đồ phố]].
- Màn Gia tộc có tiêu đề "🏯 Gia tộc & Sở Nhà Đất" (`public/ta-tua/game/js/views/clans.js:42`).

> [!warning] Lệch tài liệu
> Fact sheet cũ ghi ô "Sở Nhà Đất (sắp mở)". Code hiện tại đã thay bằng "Gia tộc & Nhà Đất" mở theo `unlocks.clan` (`public/ta-tua/game/js/views/map.js:25`). Chợ Phiên trên bản đồ dùng biểu tượng 🛒, còn tiêu đề màn và README dùng 🏮 (`public/ta-tua/game/js/views/bazaar.js:18`).

## Liên quan
- [[Mở khóa theo cấp]] · [[Hành vượng]] · [[Nhiệm vụ ngày]] · [[Màn Phố]] · [[Vẽ bản đồ phố]] · [[Clan]] · [[Bản đồ đất]]
