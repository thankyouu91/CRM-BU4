---
tags: [petfarm, may-chu, module, bao-mat]
loai: ma-nguon
trang-thai: dang-chay
nguon: [petdex/server/passwords.js]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Module passwords

> [!summary]
> `petdex/server/passwords.js` (17 dòng): băm mật khẩu scrypt có muối, băm mã một lần sha256, sinh mã ngẫu nhiên. Dùng `node:crypto` qua namespace import để Workers (cờ `nodejs_compat`) chỉ lỗi khi gọi chứ không lỗi lúc nạp module (`routes.js:1`).

## Exports
| Tên | Dòng | Việc |
|---|---|---|
| `hashPassword(password, salt?)` | `passwords.js:4-6` | Muối 16 byte hex; trả `salt:hex(scrypt(password, salt, 32))` |
| `digest(code)` | `passwords.js:9` | sha256 hex của mã link đặt mật khẩu |
| `randomCode()` | `passwords.js:10` | 16 byte ngẫu nhiên -> 32 hex |
| `verifyPassword(password, stored)` | `passwords.js:13-17` | `timingSafeEqual`; chuỗi rỗng (tài khoản chưa có mật khẩu) luôn sai |

## Ai gọi
`routes.js` (đăng ký/đăng nhập gốc), `internal.js` (tài khoản `play.petfarm.online`, link đặt mật khẩu).

## Lưu ý
- `pass_hash` dạng `salt:hash`; `users.pass_hash` NOT NULL nên tài khoản liên kết lưu `''` (`db.js:775`).
- Không có tham số chi phí scrypt riêng (mặc định của Node).

## Liên quan
- [[API nội bộ]] · [[Link đặt mật khẩu]] · [[Tài khoản người chơi]]
