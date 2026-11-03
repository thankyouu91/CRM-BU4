---
tags: [petfarm, may-chu, module, du-lieu]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/db.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module db

> [!summary]
> `petdex/server/db.js` (875 dòng) chứa **lược đồ** (`ensureSchema`, 69 bảng) và kho truy cập dữ liệu lõi: người chơi, phiên, thú, đồ đeo, kỹ năng, túi đồ, `meta`, cùng phần WorkHub (tài khoản liên kết, khách mời, link mật khẩu, nhật ký quản trị). Các hệ thống khác tự `db.prepare` câu lệnh riêng trong module của mình.

## Exports: lược đồ và hạ tầng
| Tên | Dòng | Việc |
|---|---|---|
| `db`, `transaction` | `db.js:5` | Re-export từ [[Module sql-backend]] |
| `loginKey(name)` | `db.js:14` | NFC, trim, `toLowerCase()` (gộp cả chữ có dấu: "Đức" = "đức") |
| `ensureSchema()` | `db.js:16-653` | Tạo bảng/cột/index; xem [[Lược đồ cơ sở dữ liệu]] |
| (tự mở DB) | `db.js:762-767` | Ngoài Workers: `openNodeSqlite(PETDEX_DB ?? petdex/data/petdex.db)` + `ensureSchema()` bằng top-level await |

## Exports: dữ liệu lõi
| Tên | Dòng | Việc |
|---|---|---|
| `getMeta(key)`, `setMeta(key, value)` | `db.js:707-708` | Bảng `meta` (giá trị ép chuỗi) |
| `getUser`, `allUsers`, `findUserByName`, `createUser(username, passHash, now)` | `db.js:710-714` | `createUser` tạo ví **0 xu**; nơi gọi tự ghi xu khởi điểm vào sổ cái |
| `setActivePet`, `setDaily`, `setWarehouse`, `setAdvanced` | `db.js:715-718` | Cập nhật cột `users` |
| `createSession`, `userForToken`, `deleteSession` | `db.js:720-722` | Bảng `sessions`; `userForToken` trả `undefined` với token rỗng/không phải chuỗi |
| `wearOf(petId)` | `db.js:726` | `{ slot: item_id }` |
| `gearBonusOf(petId)` | `db.js:728` | Tổng % `{ income, stats, trade, luck }` của trang phục đang đeo (`sumBonus` của `shared/gear.js`) |
| `setWear(petId, slot, itemId, gearId)` | `db.js:731-735` | Không `slot`: tháo hết; `itemId` null: tháo khe |
| `unequipItem(ownerId, itemId)` | `db.js:736` | Tháo một mã món khỏi mọi bé của chủ |
| `getPet`, `listPets`, `allPets` | `db.js:737-739` | Kèm `traits` đã parse, `wear`, `bonus` (`withTraits`, dòng 729) |
| `setTraits`, `insertPet`, `savePet`, `setBornAt` | `db.js:740-748` | `savePet` ghi 13 cột chỉ số/bận/bệnh |
| `leaderboard(limit = 20)` | `db.js:749` | Sắp `level DESC, xp DESC, born_at ASC` |
| `skillsOf`, `setSkill` | `db.js:751-752` | `pet_skills` |
| `inventory`, `addItem`, `takeItem(userId, itemId, qty = 1)` | `db.js:754-758` | `takeItem` ném "Bạn không có đủ món này." |

## Exports: WorkHub
| Tên | Dòng | Việc |
|---|---|---|
| `issueToken(userId)` | `db.js:811-815` | Token 24 byte ngẫu nhiên (48 hex) |
| `userByCrm`, `residentUsers(limit)`, `recentToken(userId, maxAgeMs = 7 ngày)` | `db.js:816-820` | `residentUsers`: người chưa bị khóa có bé chính, hoạt động gần nhất trước |
| `createLinkedUser(username, { kind, crmUserId, displayName, inviteId })` | `db.js:821-822` | Tạo user `pass_hash = ''` |
| `setDisplayName`, `setCredentials`, `findUserByLogin`, `revokeOtherSessions` | `db.js:823-829` | `findUserByLogin` ưu tiên tài khoản có mật khẩu khi trùng khóa |
| `setBanned(userId, banned)`, `revokeSessions` | `db.js:830-834` | Khóa thì xóa mọi phiên |
| `touchSeen(userId, now)` | `db.js:836` | Ghi tối đa mỗi 5 phút |
| `searchUsers(q, kind)`, `usersOverview(now)` | `db.js:837-845` | Cho bảng quản trị |
| `createInvite`, `inviteByCode`, `inviteById`, `listInvites`, `useInvite`, `revokeInvite` | `db.js:847-856` | Mã mời 9 byte (18 hex) |
| `createPasswordLink(userId, codeHash, { createdBy, ttlMs })`, `livePasswordLink`, `usePasswordLink` | `db.js:862-873` | Link mới vô hiệu link cũ chưa dùng |
| `adminLog(actor, action, userId, details)`, `adminLogs(limit)` | `db.js:874-875` | `details` lưu JSON |

## Ai gọi
Hầu như mọi module (34 file import `db.js`).

## Lưu ý
- Comment JSDoc của `ensureSchema` bị đặt lệch phía trên `loginKey` (`db.js:9-14`).
- `addColumn` được định nghĩa **bên trong** `ensureSchema` (thụt lề lệch, `db.js:444-448`).
- Câu lệnh nhóm `w` (dòng 770-806) được khai báo sau đoạn tự mở DB nhưng vẫn ổn vì chỉ biên dịch khi chạy.
- `getPet`/`listPets` gọi thêm 2 truy vấn mỗi bé (`wear`, `bonus`): đừng gọi trong vòng lặp lớn khi có thể dùng câu SQL thô (như `lifecycle.js:12`).

## Liên quan
- [[Lược đồ cơ sở dữ liệu]] · [[Lớp SQL]] · [[Migration]] · [[API nội bộ]]
