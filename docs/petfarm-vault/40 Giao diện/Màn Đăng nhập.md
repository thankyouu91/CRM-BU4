---
tags: [petfarm, giao-dien, man-hinh, dang-nhap]
loai: giao-dien
trang-thai: dang-chay
nguon: [public/ta-tua/game/index.html, public/ta-tua/game/js/app.js, public/ta-tua/game/js/api.js]
cap-nhat: 2026-10-30
commit: e03a0db
---

# Màn Đăng nhập

> [!summary]
> `#auth-screen` trong `index.html`: thẻ giữa màn có bé loài đầu tiên của catalog vẫy tay, logo "Petdex Park" và form tên + mật khẩu với 2 nút Đăng nhập / Tạo tài khoản. Khi game chạy trong khung WorkHub (`embedded`), form bị ẩn và chỉ còn lời hướng dẫn mở lại Pet Town hoặc link mời. Người chơi thật hầu như chỉ thấy bản nhúng; form là cho chế độ chạy độc lập.

## Hiển thị

| Phần | Nội dung | Nguồn |
|---|---|---|
| Hình bé | `createPetFigure(catalog.species[0], 0.7)`, chạy `wave` | `public/ta-tua/game/js/app.js:155-161` |
| Logo | "Petdex **Park**" | `public/ta-tua/game/index.html:24` |
| Lời chào | "Nuôi thú cưng, sắm đồ xinh và ra công viên chơi cùng mọi người." | `index.html:25` |
| Bản nhúng | "Phiên chơi đã hết hoặc chưa đăng nhập. Mở lại mục **Pet Town** trong WorkHub, hoặc mở lại link mời của bạn." | `index.html:26`, `app.js:153-154` |
| Form | ô "Tên người chơi" (3–20 ký tự), "Mật khẩu" (≥ 4 ký tự), nút "Đăng nhập" (`value="login"`), "Tạo tài khoản" (`value="register"`), dòng lỗi `#auth-error` | `index.html:27-35` |

## Luồng

1. `boot()`: `GET /catalog`; lỗi thì thay cả trang bằng "Không kết nối được máy chủ: …". Có token thì `GET /me`; lỗi 401 thì xóa token. Không có phiên thì `showAuth()` (`app.js:129-145`).
2. Gửi form: `POST /auth/login` hoặc `POST /auth/register` với `{username, password}`; nút được bấm xác định qua `e.submitter.value`. Thành công: lưu token, vào app; nếu là đăng ký thì toast "Chào {tên}! Bạn có n 🪙 để bắt đầu." Lỗi: in thông báo của máy chủ vào `#auth-error` (`app.js:182-197`).

> [!warning] Lệch tài liệu
> Form trong game cho mật khẩu tối thiểu 4 ký tự (`index.html:29`, khớp `petdex/server/routes.js:108`) trong khi menu tài khoản và WorkHub đòi ít nhất 6 (`app.js:1092`, `app.js:1153`). Trên máy chủ hiện tại `openSignup: false` (`petdex/server/settings.js:4`), nên **cả hai nút** chỉ nhận lỗi: "Máy chủ này đăng nhập qua WorkHub, không tự tạo tài khoản." và "Máy chủ này đăng nhập qua WorkHub." (`petdex/server/routes.js:103-104`, `routes.js:118-119`). Đăng nhập bằng tên + mật khẩu thật diễn ra ở trang bọc server1 ([[Khung nhúng WorkHub]]). Xem [[Tài khoản người chơi]] và [[API người chơi]].

## Liên quan
- [[App shell]], [[Khung nhúng WorkHub]], [[Trang chơi server1]], [[Tài khoản người chơi]], [[Phiên chơi và token]]
