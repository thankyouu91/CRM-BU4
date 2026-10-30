---
tags: [petfarm, giao-dien, man-hinh, ban-be, hoi]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/js/views/community.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Bạn bè

> [!summary]
> Tab 👥 Bạn bè (`#community`): màn "👥 Bạn bè & Hội" có 2 tab con. Tab 🤝 Bạn bè để gửi/nhận lời mời, thăm nhà (hộp thoại có hình các bé), thả tim và tặng đồ ăn/đồ chăm sóc. Tab 🏯 Hội để lập hoặc gia nhập [[Hội]], góp quỹ, nâng cấp (chỉ trưởng Hội), góp nguyên liệu cho dự án tuần. Mã ở `views/community.js`; luật ở [[Bạn bè]] và [[Hội]].

## Tab Bạn bè

| Khối | Nội dung | Nút / API | Nguồn |
|---|---|---|---|
| ➕ Kết bạn | ô "Tên người chơi" (3–20 ký tự) | "Gửi lời mời" → `POST /friends/request {username}` | `public/ta-tua/game/js/views/community.js:41-46`, `community.js:218` |
| Lời mời đến | tên người mời | "Đồng ý" → `POST /friends/:id/accept`; "Từ chối" → `POST /friends/:id/remove` | `community.js:47-49`, `community.js:197-198` |
| Đang chờ đồng ý | lời mời mình gửi | "Hủy" → `POST /friends/:id/remove` | `community.js:50-51` |
| Thống kê | "Nhà bạn được n tim (m hôm nay). Hôm nay còn tặng được k món." | | `community.js:52` |
| 🤝 Bạn bè (n) | thẻ bạn: hình bé chính (cỡ 0,38), tên, "🌳 ở công viên", "{bé} · Lv · tâm trạng" hoặc "Chưa nuôi bé nào" | "🏠 Thăm", "💖 Thả tim" / "💖 Đã thả", "🎁" (khóa khi hết lượt tặng), "✕" xóa bạn | `community.js:54-73` |
| Rỗng | "Chưa có bạn nào. Gặp người chơi khác ở công viên rồi kết bạn nhé!" | | `community.js:70` |

### Hộp thoại thăm nhà

`GET /friends/:id/visit` rồi `openModal` "Nhà của {tên}": "Hội X · 💖 n tim", mỗi bé một hình cỡ 0,6 kèm "Lv · {ageText} · tâm trạng · việc đang bận", ⭐ cho bé chính, nút "💖 Thả tim nhà này" / "💖 Hôm nay đã thả tim" (`POST /friends/:id/like`) (`community.js:76-95`). Hình bé được gắn sau khi hộp thoại mở, tìm qua `document.querySelector('.modal')`.

### Hộp thoại tặng quà

Liệt kê đồ ăn và đồ chăm sóc trong túi (icon emoji, không dùng pixel art), bấm một món gửi `POST /friends/:id/gift {itemId}`; túi rỗng: "Túi chưa có đồ ăn hay đồ chăm sóc để tặng." (`community.js:97-107`).

## Tab Hội

### Chưa có Hội

| Khối | Nội dung | Nguồn |
|---|---|---|
| 🏯 Lập Hội mới | lưới biểu tượng (`g.emblems`, chọn một), ô "Tên Hội" 3–20 ký tự, nút "Lập Hội · {createCost} 🪙" → `POST /guild/create {name, emblem}`; khóa khi chưa có bé cấp `unlocks.guild` (= 3): "🔒 Cần một bé cấp n để lập Hội. Gia nhập Hội có sẵn thì không cần." | `community.js:113-126`, `community.js:219` |
| 🏆 Các Hội trong phố | hạng, biểu tượng, tên, "n/max thành viên · danh vọng", nút "Gia nhập" (khóa khi đầy) → `POST /guild/:id/join`; rỗng: "Chưa có Hội nào. Hãy là người đầu tiên!" | `community.js:127-134`, `community.js:206` |

### Đã ở trong Hội

| Khối | Nội dung | Nút / API | Nguồn |
|---|---|---|---|
| Đầu Hội | biểu tượng lớn, tên, "Trưởng Hội · danh vọng · n/max thành viên" | "Rời Hội" (`confirm('Rời Hội?')`) → `POST /guild/leave` | `community.js:142-146`, `community.js:207` |
| 💰 Quỹ Hội | số dư, ô số xu, "Bạn đã góp n 🪙. Chỉ trưởng Hội được dùng quỹ để nâng cấp."; mỗi nâng cấp: tên, "cấp a/b", mô tả, nút giá (chỉ bật cho trưởng Hội khi quỹ đủ) hoặc "Tối đa" | "Góp quỹ" → `POST /guild/donate {amount}`; nâng cấp → `POST /guild/upgrade {key}` | `community.js:147-159`, `community.js:208`, `community.js:220` |
| Dự án tuần | "{icon} Dự án tuần: tên", "✓ Đã hoàn thành tuần này!" hoặc "Góp đủ nguyên liệu từ kho để hoàn thành."; thanh từng mặt hàng `have/needs` lô | "Góp 1 lô" / "Góp 5 lô" → `POST /guild/contribute {commodity, qty: 10|50}` (đơn vị phần) | `community.js:160-170`, `community.js:209-212` |
| 👥 Thành viên | tên, 🌳 nếu ở công viên, "góp n 🪙" | | `community.js:171-175` |

Tab đang chọn và biểu tượng Hội lưu ở biến module (`tab`, `emblem`), đổi tab thì `ctx.refresh()` (`community.js:6-7`, `community.js:193-196`). Hàm dọn hủy mọi hình bé và đóng hộp thoại (`community.js:224-227`).

> [!info] Clan khác Hội
> Hội (guild) nằm ở màn này. [[Clan]] (Gia tộc) và đất đai là hệ khác, ở [[Màn Clan]].

## Liên quan
- [[Bạn bè]], [[Hội]], [[Công viên]], [[Nhiệm vụ ngày]] (thả tim, góp quỹ Hội)
- [[Màn Công viên]], [[Màn Clan]], [[Màn Việc làm]] (thưởng Văn phòng Hội), [[Sprite và bảng hình]]
