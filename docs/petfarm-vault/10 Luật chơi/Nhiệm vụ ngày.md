---
tags: [petfarm, luat-choi, nhiem-vu]
aliases: [Nhiệm vụ hôm nay, Quests, Rương nhiệm vụ]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/rules/town.js, petdex/server/quests.js, petdex/server/routes-community.js, public/ta-tua/game/js/views/map.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Nhiệm vụ ngày

> [!summary]
> Mỗi ngày người chơi có **3 nhiệm vụ** chọn ngẫu nhiên từ một danh sách 14 việc, lọc theo cấp và hoàn cảnh (có bạn, có Hội, có quầy). Mỗi nhiệm vụ xong được xu và **+10 XP** cho [[Thú chính]]; xong cả 3 thì mở "🎁 Rương nhiệm vụ" **+50 xu**. Bảng "📜 Nhiệm vụ hôm nay" nằm ở màn Phố.

## Con số
| Mã | Nhiệm vụ | Mục tiêu | Thưởng xu | Điều kiện xuất hiện | Sự kiện đếm (`track`) | Nguồn |
|---|---|---|---|---|---|---|
| `feed` | Cho bé ăn 3 lần | 3 | 25 | | cho ăn đồ ăn (`routes.js:221`), ăn món tự nấu (`farm.js:243`) | `petdex/server/rules/town.js:48` |
| `play` | Chơi với bé 2 lần | 2 | 20 | | Chơi đùa (`routes.js:243`) | `petdex/server/rules/town.js:49` |
| `minigame` | Chơi 2 ván mini-game | 2 | 30 | | xong ván (`minigames.js:111`) | `petdex/server/rules/town.js:50` |
| `shift` | Nhận lương 1 ca làm | 1 | 35 | | nhận lương mọi loại ca (`jobs.js:166`) | `petdex/server/rules/town.js:51` |
| `trade` | Giao dịch 1 lần trên Sàn | 1 | 30 | cấp 2 | đặt lệnh Sàn (`routes-economy.js:78`) | `petdex/server/rules/town.js:52` |
| `save` | Gửi tiền vào ngân hàng | 1 | 25 | cấp 3 | gửi tiết kiệm hoặc kỳ hạn (`routes-economy.js:97,104`) | `petdex/server/rules/town.js:53` |
| `cuddle` | Vuốt ve một bé ở công viên | 1 | 25 | | vuốt ve (`playground.js:209`) | `petdex/server/rules/town.js:54` |
| `friend` | Thả tim nhà một người bạn | 1 | 25 | có bạn | thả tim (`social.js:145`), tưới vườn bạn (`farm.js:106`) | `petdex/server/rules/town.js:55` |
| `donate` | Góp quỹ Hội | 1 | 30 | đang ở Hội | góp quỹ (`social.js:269`) | `petdex/server/rules/town.js:56` |
| `serve` | Quầy bán được 20 ly | 20 | 40 | có quầy đang mở | số ly quầy bán (`business.js:152`) | `petdex/server/rules/town.js:57` |
| `bath` | Tắm cho bé 1 lần | 1 | 20 | | tắm ở nhà (`care.js:27`) | `petdex/server/rules/town.js:58` |
| `school` | Cho bé đi học 1 buổi | 1 | 30 | cấp 2 | vào lớp (`care.js:132`) | `petdex/server/rules/town.js:59` |
| `harvest` | Thu hoạch 1 ô vườn | 1 | 30 | cấp 2 | thu hoạch (`farm.js:138`) | `petdex/server/rules/town.js:60` |
| `cook` | Nấu 1 món trong Bếp | 1 | 30 | cấp 3 | nấu (`farm.js:221`) | `petdex/server/rules/town.js:61` |

(Đường dẫn trong cột "Sự kiện" tính từ `petdex/server/`.)

| Hằng số | Giá trị | Nguồn |
|---|---|---|
| Số nhiệm vụ/ngày | 3 | `petdex/server/rules/town.js:64` |
| Rương | +50 xu | `petdex/server/rules/town.js:65` |
| XP mỗi nhiệm vụ | +10 cho Thú chính (× vận khí × tuổi) | `petdex/server/rules/town.js:66`, `petdex/server/quests.js:83-87` |

## Cách hoạt động
- Lần đầu trong ngày có việc gọi tới nhiệm vụ, `ensure` chọn 3 nhiệm vụ: lọc theo `level` (cấp bé cao nhất) và `needs` (`friend`, `guild`, `business`), xáo bằng hạt giống cố định theo người chơi và ngày, lấy 3 cái đầu (`petdex/server/quests.js:21-38`, `petdex/server/rules/town.js:69-78`).
- Các hệ thống báo tiến độ qua `track(userId, event, amount)`; lỗi ở đây không bao giờ làm hỏng hành động gốc (`petdex/server/quests.js:41-49`).
- Nhận thưởng: `POST /quests/:slot/claim`; rương là `slot = -1` (`petdex/server/routes-community.js:79-84`, `petdex/server/quests.js:63-90`). Xu ghi sổ loại `quest`.
- Lời báo: "Xong nhiệm vụ "<tên>": +N 🪙 · +10 XP"; "Mở rương nhiệm vụ: +50 🪙"; lỗi "Nhiệm vụ chưa xong.", "Nhiệm vụ này đã nhận thưởng.", "Hoàn thành cả 3 nhiệm vụ để mở rương.", "Rương hôm nay đã mở rồi." (`petdex/server/quests.js:69-88`).
- Giao diện: thanh tiến độ, "N/M · +X 🪙", nút "Nhận"; hàng rương "🎁 Rương nhiệm vụ · Xong cả 3 nhiệm vụ · +50 🪙", nút "Mở" (`public/ta-tua/game/js/views/map.js:74-95`). Bảng chỉ hiện khi đã có bé (`public/ta-tua/game/js/views/map.js:100`).

## Con số: thưởng tối đa mỗi ngày
3 nhiệm vụ (65–105 xu tùy bộ) + rương 50 = 115–155 xu và 30 XP gốc.

## Trường hợp đặc biệt
- Bộ nhiệm vụ chốt lúc tạo trong ngày: lên cấp 2 giữa ngày không làm xuất hiện nhiệm vụ cấp 2 cho tới hôm sau.
- Tiến độ chỉ cộng cho nhiệm vụ đang có trong ngày và chưa nhận; làm thừa không lưu sang hôm sau.
- Phải **nhận** cả 3 nhiệm vụ (không chỉ hoàn thành) mới mở được rương.
- Chưa có Thú chính thì vẫn nhận xu, chỉ không có XP.
- "Thả tim nhà một người bạn" cũng hoàn thành khi tưới vườn cho bạn.

## Liên quan
- [[Quà ngày]] · [[Cấp độ và XP]] · [[Thú chính]] · [[Bản đồ Phố Trân Châu]] · [[Màn Phố]] · [[Module quests]]
