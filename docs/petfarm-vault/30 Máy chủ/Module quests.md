---
tags: [petfarm, may-chu, module, nhiem-vu]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/quests.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module quests

> [!summary]
> `petdex/server/quests.js` (90 dòng): nhiệm vụ ngày. Mỗi người mỗi ngày 3 nhiệm vụ bốc theo hạt giống cố định (userId + ngày), các hệ thống khác báo tiến độ qua `track()`; xong cả 3 thì mở rương. Luật: [[Nhiệm vụ ngày]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `track(userId, event, amount = 1, now)` | `quests.js:41-49` | Tạo nhiệm vụ của ngày nếu chưa có rồi `progress += amount` cho nhiệm vụ trùng `event` chưa nhận. **Nuốt mọi lỗi** (chỉ log) để không làm hỏng hành động gốc |
| `questsView(userId, now)` | `quests.js:51-61` | `{ day, quests[], chest: { reward, ready, claimed }, streak }` |
| `claimQuest(userId, slot, now)` | `quests.js:63-90` | `slot = -1`: mở rương (cần đủ 3, sổ `quest`); khác: nhận thưởng xu + `QUEST_XP` cho bé chính qua `mutatePet` |

Nội bộ: `CHEST_SLOT = -1` (dòng 9), `seedFor(userId, day)` LCG (dòng 21-27), `ensure(userId, day)` lọc theo cấp cao nhất và việc đã có (bạn bè, Hội, quầy) (dòng 29-38).

## Các `event` được báo
| Event | Nơi báo |
|---|---|
| `feed` | `routes.js:221`, `farm.eatDish` |
| `play` | `routes.js:243` |
| `minigame` | `minigames.js:111` |
| `shift` | `jobs.js:166` |
| `trade` | `routes-economy.js:78` |
| `save` | `routes-economy.js:97`, `104` |
| `cuddle` | `playground.js:209` |
| `friend` | `social.likeFriend`, `farm.water` |
| `donate` | `social.donate` |
| `serve` (số ly) | `business.simulate` |
| `bath`, `school`, `harvest`, `cook` | `care.js`, `farm.js` |

## Bảng
`quests`; đọc `friends`, `guild_members`, `businesses`, `pets`.

## Lưu ý
- Tiến độ không kẹp ở DB (có thể vượt `goal`), chỉ kẹp khi hiển thị.
- Rương ghi dòng `slot = -1` bằng `INSERT OR IGNORE` khi mở.

## Liên quan
- [[Nhiệm vụ ngày]] · [[Module rules-town]] · [[Module service]]
