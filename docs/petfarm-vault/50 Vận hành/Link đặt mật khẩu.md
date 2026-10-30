---
tags: [petfarm, van-hanh, mat-khau]
loai: van-hanh
trang-thai: dang-chay
nguon: [app/password/[code]/page.tsx, components/tatua/password-setup.tsx, petdex/server/internal.js, petdex/server/db.js, petdex/server/passwords.js, app/(app)/ta-tua/quan-ly/board.tsx, app/api/ta-tua/admin/[...path]/route.ts]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Link đặt mật khẩu

> [!summary]
> Khi một người chơi cũ (vào bằng WorkHub hoặc link mời) chưa có mật khẩu và trình duyệt của họ không còn phiên để tự chứng minh, hoặc khi ai đó quên mật khẩu, quản trị viên tạo một **link dùng một lần, sống 24 giờ** `play.petfarm.online/password/<mã>`. Mở link, người chơi chọn tên đăng nhập và mật khẩu, mọi phiên cũ bị đăng xuất và họ vào chơi luôn. Máy chủ chỉ lưu **băm SHA-256** của mã.

## Luồng

```mermaid
sequenceDiagram
  participant A as Quản trị viên
  participant API as /api/ta-tua/admin/players/:id/password-link
  participant G as DO /internal
  participant P as Người chơi
  A->>API: POST {playerName}
  API->>G: /internal/admin/players/:id/password-link (+actor)
  G->>G: code = 16 byte hex; lưu sha256(code), hết hạn sau 24h; link cũ chưa dùng hết hiệu lực
  G-->>A: {code, expiresAt}
  A->>A: board ghép passwordUrl(code), nút Chép
  A-->>P: gửi link (ngoài hệ thống)
  P->>G: (server) GET /internal/password-links/:code
  G-->>P: valid, username, displayName, hasPassword, expiresAt
  P->>API: POST /api/ta-tua/account {action: setup, code, username, password}
  API->>G: /internal/account/setup
  G->>G: đánh dấu đã dùng, đặt mật khẩu, xóa mọi phiên, ghi admin_log password_set
  G-->>P: token mới
```

## Con số
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Thời hạn | 24 giờ (`PASSWORD_LINK_TTL = 24 * 3_600_000`) | `petdex/server/internal.js:224` |
| Mã | 32 ký tự hex (`randomBytes(16)`) | `petdex/server/passwords.js:10` |
| Lưu trữ | `sha256(code)` trong bảng `password_links` | `petdex/server/passwords.js:9`, `petdex/server/db.js:548` |
| Dùng được | chưa dùng, chưa hết hạn, tài khoản không bị khóa | `petdex/server/db.js:868-871`, `petdex/server/internal.js:227-231` |
| Tạo link mới | các link cũ chưa dùng của người đó bị "nghỉ hưu" | `petdex/server/db.js:862-866` |
| Tên đăng nhập | 3–20 ký tự, chỉ chữ, số, `_` (Unicode, không dấu cách) | `petdex/server/internal.js:141-145` |
| Mật khẩu | 6–72 ký tự | `petdex/server/internal.js:147-152` |
| Băm mật khẩu | scrypt, muối 16 byte, khóa 32 byte, so bằng `timingSafeEqual` | `petdex/server/passwords.js:4-17` |
| Giới hạn tần suất | 20/phút/IP và 5/phút cho mỗi `tatua-setup:<ip>` | `app/api/ta-tua/account/route.ts:34-43` |

## Thông báo
| Thông báo | Khi nào | Nguồn |
|---|---|---|
| "Tài khoản này đang bị khóa, mở khóa trước đã." | admin tạo link cho người bị khóa | `petdex/server/internal.js:530` |
| "Link đặt mật khẩu không còn hiệu lực. Nhờ quản trị viên tạo link mới." | mã sai, hết hạn, đã dùng (kể cả hai người bấm cùng lúc) | `petdex/server/internal.js:243`, `petdex/server/internal.js:249` |
| "Tên này đã có người dùng, chọn tên khác nhé." | trùng tên (so cả "Đức" với "đức") | `petdex/server/internal.js:248` |
| trang hiện "…đã dùng rồi hoặc đã hết hạn" | mở link không hợp lệ | `scripts/smoke-worker.mjs:199-200` |

## Bảo mật
- Mã gốc **chỉ** nằm trong phản hồi cho quản trị viên một lần. Nhật ký của game ghi `{expiresAt}`; nhật ký WorkHub ghi "Tạo link đặt mật khẩu cho … (dùng một lần, 24 giờ)", không có mã (`petdex/server/internal.js:533-536`, `app/api/ta-tua/admin/[...path]/route.ts:36-37`).
- Board nhắc: "Chỉ gửi cho đúng người chơi. … link không được lưu lại ở đâu khác." (`app/(app)/ta-tua/quan-ly/board.tsx:542`).
- Trang `/password/<mã>` chỉ hỏi game khi mã đúng dạng `^[a-f0-9]{32}$` (`app/password/[code]/page.tsx:13`).
- Đặt mật khẩu qua link gọi `revokeSessions`: mọi thiết bị cũ bị đăng xuất (`petdex/server/internal.js:251`).

## Trên board
Thẻ *Mật khẩu đăng nhập* trong ngăn người chơi ghi "Đã có mật khẩu." hoặc "Chưa có mật khẩu.", nút *Tạo link đặt mật khẩu* hoặc *Tạo link đặt lại mật khẩu* (`app/(app)/ta-tua/quan-ly/board.tsx:506-557`). Xem [[Bảng quản lý Pet Town]].

## Liên quan
- [[Tài khoản người chơi]]
- [[Phiên chơi và token]]
- [[Nhật ký quản trị]]
- [[Giới hạn tần suất]]
- [[MOC Vận hành]]
