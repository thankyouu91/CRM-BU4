---
tags: [petfarm, giao-dien, man-hinh, ban-do, nhiem-vu]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/map.js, public/ta-tua/game/js/townmap.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Phố

> [!summary]
> Trang chủ của game (`#map`, tab 🗺️ Phố, mặc định khi mở app): lời chào, băng rôn [[Hành vượng]] hôm nay, bảng "📜 Nhiệm vụ hôm nay" và bản đồ pixel [[Bản đồ Phố Trân Châu]] với 18 tòa nhà dẫn tới mọi màn khác. Bản đồ nạp lười (`import('../townmap.js')`); trong lúc chờ, màn hiện một danh sách nút dự phòng. Mã ở `views/map.js`, phần vẽ ở [[Vẽ bản đồ phố]].

## Bố cục

| Vùng | Nội dung | Nguồn |
|---|---|---|
| Lời chào | "Phố Trân Châu", "Chào {user}! {bé chính} đang đợi bạn. Chạm vào một tòa nhà để vào." (chưa có bé: "Chào mừng tới phố! Ghé Nhà để nhận nuôi bé đầu tiên.") | `public/ta-tua/game/js/views/map.js:57-65` |
| Băng rôn vận khí | "{icon} Vận khí hôm nay: hành X vượng. Bé hành X được +{fortune×100}% kinh nghiệm và +…% lương ca làm." (viền màu hành) | `map.js:30-36` |
| Bảng nhiệm vụ | ẩn cho tới khi `GET /quests` trả về; chỉ gọi khi đã có bé | `map.js:69`, `map.js:100` |
| Bản đồ | `.map-host`: nút dự phòng rồi thay bằng `mountTownMap(host, {places, onSelect})` | `map.js:101-125` |

## Bảng nhiệm vụ

- Đầu bảng: "📜 Nhiệm vụ hôm nay" và "🔥 Chuỗi đăng nhập n ngày".
- Mỗi nhiệm vụ: chữ mô tả, thanh tiến độ `progress/goal`, "+thưởng 🪙", nút "Nhận" (vàng, khóa khi chưa đủ) hoặc "✓" khi đã nhận.
- Dòng cuối "🎁 Rương nhiệm vụ · Xong cả 3 nhiệm vụ · +{chest.reward} 🪙", nút "Mở" (`data-quest="-1"`).
- Bấm gửi `POST /quests/:slot/claim` (slot −1 là rương) qua `ctx.act`, nên màn được vẽ lại và toast thông báo.

Nguồn: `map.js:74-99`. Luật nhiệm vụ: [[Nhiệm vụ ngày]].

## Danh sách tòa nhà (`PLACES`)

| id | Tên | Hàng · ô | Mở màn | Khóa theo `catalog.unlocks` |
|---|---|---|---|---|
| home | 🏠 Nhà | 0·0 | [[Màn Nhà]] | |
| shop | 🏪 Siêu thị | 0·1 | [[Màn Siêu thị]] | |
| jobs | 💼 Việc làm | 0·2 | [[Màn Việc làm]] | |
| bank | 🏦 Ngân hàng | 0·3 | [[Màn Ngân hàng]] | `bank` = 3 |
| market | 📈 Sàn Nguyên Liệu | 0·4 | [[Màn Sàn]] | không khóa ở bản đồ (màn tự khóa giao dịch tới `market` = 2) |
| news | 📰 Báo Trân Châu | 0·5 | [[Màn Báo Trân Châu]] | |
| townhall | 🏛️ Tòa thị chính | 0·6 | [[Màn Tòa thị chính]] | `townhall` = 3 |
| school | 🏫 Trường học | 0·7 | [[Màn Trường học]] | `school` = 2 |
| clinic | 🩺 Phòng khám | 0·8 | [[Màn Phòng khám]] | |
| park | 🌳 Công viên | 1·0 | [[Màn Công viên]] | |
| arcade | 🎮 Khu vui chơi | 1·1 | [[Màn Khu vui chơi]] | |
| kitchen | 🍳 Bếp | 1·2 | [[Màn Bếp]] | `kitchen` = 3 |
| garden | 🌱 Vườn | 1·3 | [[Màn Vườn]] | `garden` = 2 |
| bazaar | 🛒 Chợ Phiên | 1·4 | [[Màn Chợ Phiên]] | `bazaar` = 4 |
| boba | 🧋 Quầy trà sữa | 1·5 | [[Màn Quầy trà sữa]] | `business` = 4 |
| factory | 🏭 Khu công nghiệp | 1·6 | [[Màn Khu công nghiệp]] | `market` = 2 (xây xưởng tự khóa tới 6 bên trong) |
| realestate | 🏘️ Gia tộc & Nhà Đất | 1·7 | [[Màn Clan]] | `clan` = `clanConfig().unlockLevel` (mặc định 4) |
| arena | 🏆 Bảng vàng | 1·8 | [[Màn Bảng vàng]] | |

Nguồn: `map.js:7-27`; số cấp ở `petdex/server/routes-economy.js:18-20` và `petdex/server/routes.js:72`, `petdex/server/clans.js:20`. Bảng tổng: [[Mở khóa theo cấp]].

> [!info] Sàn không có khóa ở bản đồ
> Tòa Sàn Nguyên Liệu không có trường `level` nên luôn bấm được; bên trong [[Màn Sàn]] chỉ ẩn form đặt lệnh khi chưa đủ cấp. Comment ở `map.js:23` giải thích Khu công nghiệp dùng khóa `market` vì gia công thuê dùng được từ cấp 2.

## Huy hiệu trên tòa nhà

| Tòa | Huy hiệu | Điều kiện | Nguồn |
|---|---|---|---|
| Việc làm | "Lương sẵn sàng!" | `me.badges.jobs` | `map.js:46` |
| Ngân hàng | "Kỳ hạn đến hạn!" | `me.badges.bank` | `map.js:47` |
| Nhà | "Có quà ngày!" | `user.dailyReadyAt <= now` | `map.js:41`, `map.js:48` |

Tòa bị khóa có `lockText` "Mở khi có bé cấp n" (hoặc chuỗi `soon` cho khu sắp mở; hiện không tòa nào dùng `soon`). Ở danh sách dự phòng, huy hiệu hiện dạng " ❗" và tòa khóa là nút `disabled` có tooltip.

## Vòng đời

`renderMap` trả hàm dọn `alive = false; map?.destroy()` để bản đồ không gắn vào DOM cũ khi người chơi rời màn trước lúc `townmap.js` nạp xong (`map.js:117-129`). Nạp lỗi thì giữ danh sách nút và ghi `console.warn`.

## Liên quan
- [[Vẽ bản đồ phố]], [[Bản đồ Phố Trân Châu]], [[Nhiệm vụ ngày]], [[Hành vượng]], [[Mở khóa theo cấp]]
- [[Kiến trúc giao diện game]], [[App shell]]
