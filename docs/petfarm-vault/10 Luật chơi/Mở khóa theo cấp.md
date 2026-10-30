---
tags: [petfarm, luat-choi, tien-trinh, mo-khoa]
aliases: [Bảng mở khóa, Unlock, UNLOCKS]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/routes-economy.js, petdex/server/routes-production.js, petdex/server/routes-community.js, petdex/server/routes-clans.js, petdex/server/clans.js, petdex/server/routes.js, public/ta-tua/game/js/views/map.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Mở khóa theo cấp

> [!summary]
> Các khu trong [[Bản đồ Phố Trân Châu]] mở dần theo **cấp của bé cao cấp nhất** trong nhà (không phải [[Thú chính]]). Bảng `UNLOCKS` ở máy chủ là nguồn sự thật; bản đồ và màn hình chỉ làm mờ nút theo cùng bảng. Ngoài khu phố, từng món ở [[Siêu thị]] và [[Trang phục]] còn có cấp yêu cầu riêng, và cấp từng bé quyết định số món đeo được.

## Cách hoạt động
- `UNLOCKS` (`petdex/server/routes-economy.js:18-20`) và `requireLevel(userId, level, place)` lấy `max(level)` của mọi bé còn sống; thiếu cấp thì báo "<Khu> mở khi có một bé đạt cấp N." (`petdex/server/routes-economy.js:22-25`).
- Cấp mở gia tộc lấy từ cấu hình gia tộc `clanConfig().unlockLevel` (mặc định 4, quản trị viên chỉnh 1–30) và được gửi kèm `catalog.unlocks.clan` (`petdex/server/clans.js:20,61`, `petdex/server/routes.js:72`).
- Bản đồ dùng `catalog.unlocks[place.level]` để khóa ô, chữ hiện "Mở khi có bé cấp N" (`public/ta-tua/game/js/views/map.js:38-55`).
- Kiểm tra chỉ đặt ở thao tác ghi (đặt lệnh, gửi tiền, mua...). Các API xem (GET) thường không khóa.

## Con số
| Cấp | Mở | Kiểm tra ở | Nguồn |
|---|---|---|---|
| 1 | Nhà, [[Siêu thị]], [[Việc làm]] (cả bé Sơ sinh), [[Mini-game|Khu vui chơi]], [[Ốm và Phòng khám|Phòng khám]], [[Công viên]], [[Bạn bè]], vào [[Hội]] có sẵn, [[Báo Trân Châu]], [[Bảng vàng]] | không khóa | `public/ta-tua/game/js/views/map.js:8-26`, `petdex/server/rules/careers.js:34-35` |
| 2 | Đặt lệnh [[Sàn Nguyên Liệu]] (`market`) | `POST /market/order` | `petdex/server/routes-economy.js:69` |
| 2 | Gửi đơn gia công ở [[Khu công nghiệp]] (dùng `UNLOCKS.market`) | `POST /factory/:id/order` | `petdex/server/routes-production.js:104` |
| 2 | [[Trường học]] (`school`) | `POST /school/class` | `petdex/server/routes-production.js:44` |
| 2 | [[Vườn]] (`garden`) | `POST /garden/plant` | `petdex/server/routes-production.js:57` |
| 3 | [[Ngân hàng Trân Châu]] (`bank`) | tiết kiệm, gửi kỳ hạn | `petdex/server/routes-economy.js:93,102` |
| 3 | [[Tòa thị chính]] bỏ phiếu (`townhall`) | `POST /town/vote` | `petdex/server/routes-community.js:45` |
| 3 | Lập [[Hội]] (`guild`) | `POST /guild/create` | `petdex/server/routes-community.js:65` |
| 3 | [[Bếp]] (`kitchen`) | nấu | `petdex/server/routes-production.js:71` |
| 3 | Mua [[Trứng ngũ hành]] | `EGG.minLevel` | `public/ta-tua/game/js/shared/pets.js:336`, `petdex/server/routes.js:307-308` |
| 4 | [[Quầy trà sữa]] (`business`) | `POST /business/open` | `petdex/server/routes-community.js:26` |
| 4 | [[Chợ Phiên]] (`bazaar`) | đăng bán, mua | `petdex/server/routes-production.js:138,142` |
| 4 (mặc định) | Gia tộc & Nhà Đất: lập/gia nhập [[Clan]], [[Bản đồ đất]] | `clanConfig().unlockLevel` | `petdex/server/routes-clans.js:18-26`, `petdex/server/clans.js:20` |
| 6 | Xây xưởng [[Khu công nghiệp]] (`factory`) | `POST /factory/build` | `petdex/server/routes-production.js:90` |
| 6 | [[Hợp đồng cung ứng]] (`contracts`) | đề xuất, chấp nhận | `petdex/server/routes-production.js:117,128` |
| 8 | Tài chính nâng cao: [[Tín dụng và vay]] (`advanced`) | bật trong cài đặt | `petdex/server/routes-economy.js:141` |

### Mốc theo cấp của từng bé (không phải cả nhà)
| Cấp bé | Điều gì thay đổi | Nguồn |
|---|---|---|
| 10, 20, 30, 40, 50 | Đổi [[Dáng theo cấp]] | `public/ta-tua/game/js/shared/pets.js:382-389` |
| 30 | Đeo được 4 món trang phục thay vì 3 | `public/ta-tua/game/js/shared/pets.js:372-376` |

### Món Siêu thị có cấp yêu cầu
Kiểm tra theo bé cao cấp nhất, báo "Cần một bé đạt cấp N để mua món này." (`petdex/server/routes.js:293-294,307-308`). Đồ ăn: Khay sushi 3, Bánh kem dâu 5; chăm sóc: Vitamin 4; đồ chơi: Cuộn len 2, Diều giấy 6; trứng 3; trang phục 1–40 (xem [[Danh mục trang phục]]).

> [!warning] Lệch tài liệu
> - Bản đồ ghi ô **Sàn Nguyên Liệu** không có cấp (vào xem được từ cấp 1), nhưng đặt lệnh cần cấp 2 (`public/ta-tua/game/js/views/map.js:12`, `petdex/server/routes-economy.js:69`).
> - Ô **Khu công nghiệp** trên bản đồ khóa theo `market` (cấp 2) để gửi gia công, còn xây xưởng tự khóa tới cấp 6 (`public/ta-tua/game/js/views/map.js:23-24`).
> - Fact sheet cũ ghi "Sở Nhà Đất: Sắp mở"; nay ô đó là **Gia tộc & Nhà Đất**, mở theo `unlocks.clan` (`public/ta-tua/game/js/views/map.js:25`).
> - Ô Ngân hàng trên bản đồ khóa tới cấp 3 dù trang xem ngân hàng không khóa ở máy chủ.

## Liên quan
- [[Cấp độ và XP]] · [[Bản đồ Phố Trân Châu]] · [[Siêu thị]] · [[Trang phục]] · [[Clan]] · [[Bản đồ đất]] · [[Module routes-economy]]
