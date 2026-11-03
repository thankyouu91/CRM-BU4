---
tags: [petfarm, may-chu, module, xa-hoi]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/social.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module social

> [!summary]
> `petdex/server/social.js` (317 dòng): cộng đồng: bạn bè (kết bạn, thăm nhà, thả tim, tặng quà) và Hội (quỹ, nâng cấp, dự án tuần). Luật: [[Bạn bè]], [[Hội]].

## Exports: bạn bè
| Tên | Dòng | Việc |
|---|---|---|
| `friendsView(userId, now)` | `social.js:70-85` | Bạn (kèm thẻ bé, `inPark`, đã thả tim hôm nay), lời mời đến/đi, lượt tặng còn lại, số tim |
| `requestFriend(userId, username, now)` | `social.js:87-99` | Theo tên; tối đa 100 bạn; nếu bên kia đã mời mình thì tự chấp nhận |
| `acceptFriend(userId, fromId, now)` | `social.js:101-108` | Ghi `accepted` hai chiều |
| `removeFriend(userId, otherId)` | `social.js:110-115` | Xóa cả hai chiều |
| `visit(userId, friendId)` | `social.js:118-132` | Chỉ bạn bè; các bé kèm kỹ năng, tim, Hội |
| `likeFriend(userId, friendId, now)` | `social.js:135-148` | Mỗi ngày một lần mỗi bạn; bé chính của bạn +5 vui; nhiệm vụ `friend` |
| `giftFriend(userId, friendId, itemId, now)` | `social.js:150-162` | Đồ ăn/chăm sóc, tối đa 5 món/ngày |

## Exports: Hội
| Tên | Dòng | Việc |
|---|---|---|
| `guildView(userId, now)` | `social.js:181-215` | 30 Hội theo danh vọng; Hội của mình: quỹ, thành viên, nâng cấp, dự án tuần |
| `createGuild(userId, { name, emblem }, now)` | `social.js:217-233` | Tên 3-20 ký tự, biểu tượng trong danh sách, trừ `GUILD.createCost` (sổ `guild_create`) |
| `joinGuild`, `leaveGuild` | `social.js:235-261` | Tối đa `GUILD.maxMembers`; trưởng rời thì người góp nhiều nhất lên thay; Hội trống thì giải tán, quỹ **bị hủy** |
| `donate(userId, amount, now)` | `social.js:263-272` | Ví -> `guild:<id>`; nhiệm vụ `donate` |
| `upgradeGuild(userId, key, now)` | `social.js:274-288` | Chỉ trưởng Hội; trừ quỹ (sổ `guild_upgrade`) |
| `contribute(userId, commodity, qty, now)` | `social.js:291-317` | Góp hàng từ kho cho dự án tuần; đủ thì +danh vọng và mỗi thành viên nhận thưởng **từ ngân sách thị trấn** (dừng khi ngân sách cạn) |

Hằng: `MAX_FRIENDS = 100`, `GIFTS_PER_DAY = 5`, `LIKE_HAPPINESS = 5` (dòng 14-16). Dự án tuần chọn theo `(guildId + số của weekKey) % số dự án` (dòng 169-173).

## Bảng
`friends`, `friend_likes`, `gifts_sent`, `guilds`, `guild_members`, `guild_projects`, `accounts` (`guild:<id>`, `treasury`), `inventory`, `lots`, `ledger`.

## Ai gọi
`routes-community.js`. `parkUsers` đọc từ [[Module playground]].

## Lưu ý
- Hội (`guilds`) và Gia tộc (`clans`) là hai hệ thống riêng biệt ([[Module clans]]).
- Trùng tên Hội phát hiện bằng bắt lỗi UNIQUE khi INSERT (dòng 225-229).

## Liên quan
- [[Bạn bè]] · [[Hội]] · [[Module rules-town]] · [[Module quests]]
