---
tags: [petfarm, may-chu, module, ma-qua]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/gifts.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module gifts

> [!summary]
> `petdex/server/gifts.js` (278 dòng): mã quà. Quản trị viên tạo mã với phần quà (xu, vật phẩm, trang phục, có thể kèm một "lượt chọn" 2-6 món); người chơi nhập mã trong game. Mỗi món quà có thể cố định, ngẫu nhiên trong nhóm, hoặc hợp mệnh bé chính. Luật người chơi: [[Mã quà]].

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `CODE_RULE` | `gifts.js:29` | `/^[A-Z0-9_-]{4,32}$/` |
| `GIFT_CATEGORIES` | `gifts.js:35-41` | `food`, `care`, `toy` (không có hành), `egg`, `any` |
| `randomGiftCode()` | `gifts.js:45-48` | `XXXX-XXXX` từ bảng chữ bỏ I, O, 0, 1 |
| `cleanRewards(input)` | `gifts.js:104-113` | Chuẩn hóa `{ coins, entries, choice }`: xu 0-1.000.000, tối đa 12 món luôn nhận, lượt chọn 0 hoặc 2-6 món, tối đa 10 trang phục, phải có ít nhất một phần quà |
| `normalizeRewards(stored)` | `gifts.js:116` | Đọc cả định dạng cũ `{ items, gear }` (`fromLegacy`, dòng 94-101) |
| `entryText(e)`, `rewardsText(stored)` | `gifts.js:121-140` | Mô tả cho người xem |
| `createGiftCode({ code, label, rewards, maxUses, expiresAt, createdBy }, now)` | `gifts.js:177-189` | Mã tự đặt viết hoa; mã ngẫu nhiên trùng thì quay lại tối đa 5 lần |
| `giftView`, `listGiftCodes`, `giftCodeById`, `giftRedemptions`, `revokeGiftCode` | `gifts.js:191-214` | Cho bảng quản trị |
| `redeemGiftCode(userId, rawCode, choice, now, rand)` | `gifts.js:229-278` | Xem dưới |

## Luồng nhập mã
1. `throttle`: tối đa 10 lần nhập mỗi phút mỗi người (Map trong RAM, dòng 217-223).
2. Kiểm mã: tồn tại, chưa thu hồi, chưa hết hạn, người này chưa nhận, còn lượt.
3. Có lượt chọn mà chưa chọn: trả `{ needsChoice, options }`, **chưa** tính lượt.
4. Trừ lượt nguyên tử (`uses < max_uses`), ghi `gift_redemptions`, trao quà: xu (sổ `gift_code`), vật phẩm (`addItem`), trang phục (`createGear` `source: 'gift'`).

## Bảng
`gift_codes`, `gift_redemptions`, `users` (đọc), `inventory`, `gear`, `ledger`.

## Ai gọi
`routes.js:280-284` (`/gifts/redeem`), `internal.js` (quản trị mã).

## Lưu ý
`node:crypto.randomInt` để sinh mã (dòng 6); bộ đếm chống dò mất khi object khởi động lại.

## Liên quan
- [[Mã quà]] · [[Quản trị trang phục và mã quà]] · [[Module gear]] · [[API nội bộ]]
