---
tags: [petfarm, kinh-te, hoi, cong-dong]
loai: he-thong
trang-thai: dang-chay
nguon: [petdex/server/social.js, petdex/server/rules/town.js, petdex/server/routes-community.js, petdex/server/jobs.js, petdex/server/business.js]
cap-nhat: 2026-10-30
commit: e03a0db
aliases: [👥 Hội, Guild]
---
# Hội

> [!summary]
> Nhóm tối đa 20 người chơi (lập ở cấp 3, giá 2.000 xu) có quỹ chung, 2 nâng cấp cho cả nhóm (Văn phòng: +3% lương ca làm/cấp; Biển hiệu: +5% khách quầy/cấp) và **dự án tuần** góp nguyên liệu lấy danh vọng và thưởng xu từ ngân sách. Hội nhỏ và thân thiện hơn [[Clan|gia tộc]]: không có đất, không có thuế. Một người có thể vừa ở Hội vừa ở gia tộc.

## Con số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Lập Hội | cấp 3, 2.000 xu (hủy hẳn, không vào ngân sách) | `petdex/server/rules/town.js:85`, `petdex/server/routes-community.js:64-67`, `petdex/server/social.js:223` |
| Tên | 3–20 ký tự, không trùng | `petdex/server/social.js:217-229` |
| Biểu tượng | 1 trong 10: 🧋 🐟 🌸 ⭐ 🍀 🦦 🔥 🌙 🎀 🍓 | `petdex/server/rules/town.js:86` |
| Thành viên tối đa | 20 | `petdex/server/rules/town.js:85` |
| Gia nhập | không khóa cấp, không cần duyệt | `petdex/server/social.js:235-244` |

## Nâng cấp (`GUILD_UPGRADES`, `petdex/server/rules/town.js:87-90`)

| Nâng cấp | Hiệu quả mỗi cấp | Cấp 1 / 2 / 3 | Áp vào |
|---|---|---|---|
| 🏢 Văn phòng Hội (`office`) | +3% lương ca làm nghề của mọi thành viên | 3.000 / 8.000 / 20.000 | `petdex/server/jobs.js:88-91,150` |
| 🪧 Biển hiệu Hội (`sign`) | +5% khách cho quầy trà sữa của thành viên | 2.500 / 7.000 / 18.000 | `petdex/server/business.js:56-59,108` |

Chỉ trưởng Hội được dùng quỹ; quỹ thiếu: "Quỹ Hội cần X 🪙." Tiền nâng cấp rời quỹ và bị hủy (`guild_upgrade`) (`petdex/server/social.js:274-288`). Văn phòng không áp cho lương làm thuê ở quầy/xưởng (giá do chủ đặt).

## Quỹ
- Mọi thành viên góp bất kỳ số nguyên dương (`guild_donation`, tài khoản `guild:<id>`), ghi tổng đã góp; tính nhiệm vụ "Góp quỹ Hội" (`petdex/server/social.js:263-272`).
- Quỹ Hội nằm trong lượng xu của [[Ngân hàng Trung ương]] nhưng không trong tài sản ròng của ai.

## Dự án tuần (`GUILD_PROJECTS`, `petdex/server/rules/town.js:92-97`)

| Dự án | Cần (lô) | Danh vọng | Thưởng/thành viên |
|---|---|---|---|
| 🏮 [[Dự án Dãy đèn lồng công viên]] | 20 trà khô + 20 đường nâu | +100 | 40 |
| ⛲ [[Dự án Sửa đài phun nước]] | 30 củ sắn + 30 mía | +100 | 40 |
| 🍵 [[Dự án Quán trà miễn phí]] | 40 lá trà tươi + 15 sữa tươi | +120 | 50 |
| 🐟 [[Dự án Tiệc cá cuối tuần]] | 10 cá tươi + 15 đường nâu | +120 | 50 |

- Mỗi Hội mỗi tuần (khóa tuần thứ Hai) được giao một dự án cố định theo `(id Hội + số tuần) mod 4` (`petdex/server/social.js:169-173`).
- `POST /guild/contribute { commodity, qty }` (qty tính bằng **phần**): lấy hàng từ kho, chỉ nhận tới đủ phần còn thiếu (`petdex/server/social.js:291-306`).
- Đủ tất cả nguyên liệu: Hội + danh vọng, mỗi thành viên nhận thưởng từ [[Ngân sách thị trấn]] (dừng nếu ngân sách cạn), thông báo "… hoàn thành! Hội +N danh vọng, mỗi thành viên +M 🪙." (`petdex/server/social.js:308-315`).
- Danh vọng chỉ để xếp hạng danh sách Hội (30 Hội, theo danh vọng giảm dần) (`petdex/server/social.js:37-39`).

## Rời Hội và giải tán
- Rời Hội: nếu là trưởng Hội, người **góp nhiều nhất** (rồi vào sớm nhất) lên thay; Hội không còn ai thì giải tán và **quỹ bị hủy** (`petdex/server/social.js:246-261`).

## Lỗi người chơi thấy
"Tên Hội dài 3–20 ký tự.", "Hãy chọn một biểu tượng.", "Bạn đang ở một Hội khác.", "Tên Hội này đã có người dùng.", "Rời Hội hiện tại trước đã.", "Hội đã đủ thành viên.", "Bạn chưa ở Hội nào.", "Chỉ trưởng Hội được dùng quỹ.", "Dự án tuần này đã xong rồi.", "Dự án không cần mặt hàng này.", "Đã đủ X rồi." (`petdex/server/social.js:175-306`).

## Liên quan
- [[Bạn bè]] · [[Clan]] · [[Việc làm]] · [[Quầy trà sữa]] · [[Ngân sách thị trấn]] · [[Nhiệm vụ ngày]] · [[Module social]] · [[MOC Kinh tế và cộng đồng]]
