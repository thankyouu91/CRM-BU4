---
tags: [petfarm, may-chu, module, api, workhub]
loai: api
trang-thai: dang-chay
nguon: [petdex/server/internal.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module internal

> [!summary]
> `petdex/server/internal.js` (614 dòng): router `internalApi` cho WorkHub với 38 route (SSO, khách mời, tài khoản tên + mật khẩu, link đặt mật khẩu, quản trị người chơi, trang phục, mã quà, link mời, nhật ký, gia tộc). Danh mục đầy đủ ở [[API nội bộ]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `internalApi` | `internal.js:24` | Router phục vụ ở `/internal` |
| `usernameFrom(name)` | `internal.js:29-43` | Sinh tên đăng nhập hợp lệ, duy nhất từ tên hiển thị |
| `inviteUsable(invite, now)` | `internal.js:62-64` | Link mời còn dùng được |

## Hàm nội bộ
`cleanName(raw, { clip })` 2-40 ký tự (dòng 45-51); `actorOf(req)` (dòng 53); `userOf(req)` (dòng 55-60); `playerRow(u)` (dòng 66-88); `accountOf(u)` (dòng 139); `loginName` 3-20 ký tự chữ/số/_ (dòng 141-145); `newPassword` 6-72 ký tự (dòng 147-152); `nameTaken(username, exceptId)` (dòng 155-156); `passwordLinkUser(code)` (dòng 227-231); `savingsOf(userId)` (dòng 422); `vnd(n)` (dòng 423). Hằng: `NAME_MAX = 20`, `PASSWORD_LINK_TTL = 24 giờ` (dòng 224), `PET_STATS` (dòng 464).

## Bảng chạm tới
Qua `db.js`: `users`, `sessions`, `guest_invites`, `password_links`, `admin_log`, `pets`, `pet_skills`; trực tiếp `bank_accounts` (dòng 422); qua module khác: `ledger`, `gear`, `gift_codes`, `clans`, `land_plots`, `macro_days`, `tax_evasion`.

## Sự kiện
`bus.emit('pet:changed', userId)` sau tặng/sửa/xóa trang phục và tặng/sửa thú. Đọc `parkUsers` để báo online.

## Lưu ý
- Mật khẩu tối thiểu ở đây là 6 ký tự, còn đăng ký gốc (`routes.js:108`) chỉ cần 4.
- Trừ xu của quản trị ghi hai dòng sổ (`wallet` rồi `savings`) với cùng ghi chú `memo (actor)` (dòng 455-456).
- `RULES.maxLevel` không tồn tại trong `game.js`, nên giới hạn cấp khi sửa thú là mặc định `100` (dòng 394, 480).
- Nhóm route gia tộc gọi `adminLog` ngoài transaction của thao tác.

## Liên quan
- [[API nội bộ]] · [[Module db]] · [[Module gifts]] · [[Module gear]] · [[Module clans]] · [[Bảng quản lý Pet Town]]
