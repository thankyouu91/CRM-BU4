---
tags: [petfarm, luat-choi, tai-khoan]
aliases: [Tài khoản, Đăng ký, Đăng nhập, Tạo tài khoản, Nhận nuôi, Quà chào mừng]
loai: luat
trang-thai: dang-chay
nguon: [petdex/server/internal.js, petdex/server/routes.js, petdex/server/game.js, petdex/server/settings.js, petdex/server/eggs.js, petdex/server/lifecycle.js, public/ta-tua/game/js/app.js, README.md]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Tài khoản người chơi

> [!summary]
> Người chơi vào Pet Town bằng một trong ba cách: tự tạo tài khoản **tên + mật khẩu** ở `https://play.petfarm.online/server1`, đăng nhập một lần bằng tài khoản **WorkHub** (nhân viên), hoặc mở **link mời** và chỉ điền tên (khách). Mọi tài khoản mới nhận **150 xu** quà chào mừng. Sau đó người chơi nhận nuôi bé đầu tiên miễn phí; mỗi người tối đa 4 ô nuôi.

## Cách tạo tài khoản
| Cách | Loại (`kind`) | API (nội bộ, gọi qua WorkHub) | Ràng buộc tên | Mật khẩu | Nguồn |
|---|---|---|---|---|---|
| Tự đăng ký ở `/server1` | (tự đăng ký) | `POST /account/register` | tên đăng nhập 3–20 ký tự chữ, số, `_`, không dấu cách; không trùng (so cả hoa thường "Đức"/"đức") | 6–72 ký tự | `petdex/server/internal.js:141-169` |
| WorkHub SSO | `member` | `POST /sso` | tên hiển thị = họ tên WorkHub (cắt còn 40 ký tự); tên đăng nhập tự sinh | không cần | `petdex/server/internal.js:93-110` |
| Link mời | `guest` | `POST /guest` | điền tên 2–40 ký tự; tên đăng nhập tự sinh, thêm `_2`, `_3` nếu trùng | không cần | `petdex/server/internal.js:30-50,118-129` |

- Quà chào mừng: `RULES.startCoins = 150`, ghi sổ loại `opening`, "Quà chào mừng" (`petdex/server/game.js:13`, `petdex/server/internal.js:100,124,165`).
- Link mời có thể giới hạn lượt, hạn dùng, bị thu hồi ("Link mời này không còn hiệu lực."); xem [[Link mời]].
- Luồng cũ `POST /auth/register` và `/auth/login` (mật khẩu ≥ 4) bị tắt trên máy chủ thật vì `settings.openSignup = false`: "Máy chủ này đăng nhập qua WorkHub, không tự tạo tài khoản." (`petdex/server/settings.js:4`, `petdex/server/routes.js:103-125`).

## Đăng nhập và mật khẩu
| Việc | Luật | Lời báo | Nguồn |
|---|---|---|---|
| Đăng nhập | tên + mật khẩu | "Sai tên đăng nhập hoặc mật khẩu." | `petdex/server/internal.js:171-181` |
| Tên cũ chưa có mật khẩu | trả 409 `no_password`, trang đăng nhập đưa nút tạo mật khẩu | "Tài khoản này chưa có mật khẩu." | `petdex/server/internal.js:173-176` |
| Tạo mật khẩu cho tài khoản cũ | chỉ khi trình duyệt còn giữ token của chính tài khoản đó (tối đa 5 token gửi lên) | "Trình duyệt này không xác nhận được tài khoản. Nhờ quản trị viên gửi link đặt mật khẩu cho bạn." | `petdex/server/internal.js:208-221` |
| Đặt/đổi tên đăng nhập + mật khẩu khi đang chơi | đã có mật khẩu thì phải nhập đúng mật khẩu hiện tại; đổi xong các phiên khác bị đăng xuất | "Mật khẩu hiện tại chưa đúng." | `petdex/server/internal.js:186-204` |
| Link đặt mật khẩu do quản trị viên tạo | `play.petfarm.online/password/<mã>`, dùng 1 lần, 24 giờ; mọi phiên cũ bị đăng xuất | "Link đặt mật khẩu không còn hiệu lực. Nhờ quản trị viên tạo link mới." | `petdex/server/internal.js:224-256` |
| Bị khóa | | "Tài khoản chơi của bạn đã bị quản trị viên khóa." | `petdex/server/internal.js:105,180` |

Chi tiết phiên và token: [[Phiên chơi và token]], [[Link đặt mật khẩu]], [[Đăng nhập một lần WorkHub]], [[Giới hạn tần suất]].

## Menu tài khoản (bấm 👤 tên ở góc trên)
- **🎁 Nhập mã quà** ([[Mã quà]]).
- **🔑 Đặt mật khẩu / Đổi mật khẩu**: mật khẩu mới ít nhất 6 ký tự, nhập lại để xác nhận; "Đổi xong, các máy khác đang đăng nhập sẽ bị đăng xuất." (`public/ta-tua/game/js/app.js:1086-1097`).
- **🚪 Đăng xuất**; người chơi bằng tài khoản WorkHub thấy "Bạn đang chơi bằng tài khoản WorkHub: đăng xuất ở WorkHub." (`public/ta-tua/game/js/app.js:1098-1101`).

## Nhận nuôi và ô nuôi
| Luật | Giá trị | Nguồn |
|---|---|---|
| Bé đầu tiên | miễn phí ("Bé đầu tiên miễn phí 💝") | `petdex/server/routes.js:176-179`, `public/ta-tua/game/js/app.js:756` |
| Bé thứ 2 trở đi | 200 xu (không nhân chỉ số giá), ghi sổ loại `adopt` | `petdex/server/game.js:14`, `petdex/server/routes.js:179` |
| Ô nuôi tối đa | 4, tính cả trứng đang ấp và ô tưởng niệm | `petdex/server/game.js:15`, `petdex/server/lifecycle.js:50-54` |
| Loài nhận nuôi trực tiếp | loài Thường và Boba (và loài khách mời) | `petdex/server/species.js:29-40` |
| Tên bé | 1–16 ký tự (gộp khoảng trắng) | `petdex/server/routes.js:42-46` |
| Bé mới | 1–2 tính cách, kỹ năng theo loài, kỷ vật nếu có, thành Thú chính nếu chưa có | `petdex/server/eggs.js:20-33` |

Lời chào: "Chào mừng <tên> về nhà! 🏡 Tính cách: …" (`petdex/server/routes.js:183`). Bé nhận nuôi luôn bắt đầu ở tuổi Sơ sinh, cấp 1.

> [!warning] Lệch tài liệu
> `petdex/README.md:14` ("Mở http://localhost:3000, tạo tài khoản…") mô tả luồng chạy máy dev, không phải cách người chơi vào game thật. Màn nhận nuôi vẫn ghi "Chào mừng tới Petdex Park!" (tên cũ) và hộp xác nhận đăng xuất cũ "Đăng xuất khỏi Petdex Park?" (`public/ta-tua/game/js/app.js:755,1059`), trong khi tên game hiện là Pet Town.

## Liên quan
- [[Quà ngày]] · [[Trợ cấp tân thủ]] · [[Loài và độ hiếm]] · [[Thú chính]] · [[Mã quà]] · [[Trang chơi server1]] · [[API nội bộ]] · [[Module internal]]
