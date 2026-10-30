---
tags: [petfarm, thiet-ke, lich-su, changelog]
loai: thiet-ke
trang-thai: dang-chay
nguon: [git log -- petdex public/ta-tua app/petfarm app/wiki, git log -- middleware.ts lib/petdex.ts lib/petdex-public.ts app/(app)/ta-tua app/api/ta-tua components/tatua lib/wiki]
cap-nhat: 2026-10-30
commit: e03a0db
---
# Lịch sử phiên bản

> [!summary]
> Nhật ký thay đổi của Pet Town / Petfarm trong repo WorkHub, dựng từ `git log` (chỉ đọc) trên các thư mục `petdex`, `public/ta-tua`, `app/petfarm`, `app/wiki` cùng các file tích hợp WorkHub. Mỗi dòng một thay đổi đáng kể, kèm SHA ngắn. Lịch sử của game **trước** khi vào WorkHub (giai đoạn 1A đến 2.5 ở repo Petdex gốc) không có trong repo này; xem [[Lộ trình phát triển]].

> [!info] Giới hạn nguồn
> Bản clone là shallow (72 commit, từ 2026-10-14). Commit game sớm nhất là `89e7f07` (2026-10-29). Commit merge chỉ ghi khi mang nội dung riêng.

## 2026-10-30
| SHA | Thay đổi |
|---|---|
| `e03a0db` | Merge bản đồ đất pixel-art (`claude/clan-map`) |
| `978d792` | Bản đồ đất: lớp nền vẽ pixel-art trên canvas nửa độ phân giải rồi phóng to, cùng phong cách bản đồ phố (đường, ruộng, núi tuyết, nhà mái màu, cây, bãi biển, sóng, sông, vòng xuyến); lớp SVG ô đất ở trên; thiếu canvas (test Node) thì dùng nền vector |
| `0dfbe3e`, `124e307` | Bản đồ đất kiểu bản đồ thành phố phẳng: 200 lô là khối nhà trên lưới cong nhẹ, phố trắng, đường cam có vòng xuyến, sông có cầu ra biển, đồng bằng, núi, rừng, cát, biển; lô của gia tộc tô màu gia tộc kèm huy hiệu; màu ở `MAP_PALETTE` |
| `dbe6784` | Merge gia tộc và đất; xung đột duy nhất ở `db.js` (giữ cột `sealed` của trang phục, thêm bảng gia tộc sau đó) |
| `05840b3` | **Gia tộc, bản đồ 200 lô, trình dựng công trình, thuế doanh nghiệp, kinh tế vĩ mô.** Gia tộc cấp 1–10, góp quỹ theo định mức tuần, chiếm tối đa 3/11 ngành (ngành đầu bồi thường 20.000–50.000 xu, ngành 2 và 3 gấp 10 và +5 điểm thuế). Đất 100.000–2.000.000 xu, 7 địa hình, 4 khí hậu. Công trình ghép từ 200 mảnh (20 họ × 10), tối đa 20 mảnh. Thuế 35% trên doanh thu khai báo, hoàn 15% cuối tháng; khai thiếu bị ghi hồ sơ cho Sở thuế. Vĩ mô mỗi ngày (pha, thời tiết, cầu, chỉ số đất). Tab *Gia tộc & Đất* trên bảng quản lý. Ô "Sở Nhà Đất (Sắp mở)" thành "Gia tộc & Nhà Đất" |
| `6b46b76` | Wiki: mô tả cộng dồn trang phục mới, bộ 3/4/5 món, cột Bùa |
| `152cd2e` | **Cân bằng trang phục cho 3–5 món đeo**: cộng dồn giảm dần (đủ 25%, phần vượt 50%, trần 60%, trước là cộng thẳng tới 100%); bộ ngũ hành tính trên 5 khe (3 món +3%, 4 +5%, 5 +8%); hợp mệnh cả bộ trần +30%; món xịn mở ở cấp 10–40; 9 món mới (kính bảo hộ, khăn đóng, áo tơi lá, sáo trúc, hoa sen, mặt nạ vàng, quạt lông phượng, trống đồng, áo choàng tinh tú); `petdex/scripts/gear-balance-sim.mjs`, `docs/pet-town-gear-balance.md` |
| `63bf2c8` | Merge wiki; smoke test kiểm tên miền wiki và `www` chuyển về tên miền trần |
| `f1f04ba` | **Wiki người chơi** cho `wiki.petfarm.online`: 23 bài, 5 nhóm; bảng đọc từ luật của game; ảnh thật |
| `5fd3deb` | **Trang giới thiệu chuyển sang `petfarm.online`**, `www` chuyển 308 về đó; bố cục ba tên miền theo chủ dự án |
| `5cfbd34` | **Dáng theo cấp** (đổi dáng mỗi 10 cấp, Mầm non → Thần thái ở cấp 50); giới hạn đeo 3 món dưới cấp 30, 4 món từ cấp 30, Huyền thoại +1 (tối đa 5); khe Bùa; 24 món mới; đồ mua ở Siêu thị là **hộp kín** 1–2 dòng (Xanh lam/Xanh lục) |
| `1d7b54f` | Wiki (WIP): định tuyến `wiki.petfarm.online` và khung trang |
| `3bc910e` | **Mã quà linh hoạt**: phần *Luôn nhận* và *Cho chọn 1 trong* 2–6 món; món cố định, ngẫu nhiên theo nhóm, hoặc hợp mệnh bé chính; mã cũ vẫn chạy |

## 2026-10-29
| SHA | Thay đổi |
|---|---|
| `8c49f6f` | Sửa test mã quà chập chờn (món ngẫu nhiên đôi khi cũng là vương miện); code vốn đúng |
| `02923b5` | **Trang giới thiệu Petfarm** (lúc đầu ở `www.petfarm.online`): hero đồng cỏ động, một ngày ở phố, 4 cấp trang phục đọc từ `DEFAULT_GEAR_CONFIG`, con số, cách vào phố, hỏi đáp |
| `e392aad` | **Trang phục có cấp** (Xanh lam, Xanh lục, Vàng, Đỏ; 1–4 dòng: thu nhập ca làm, chỉ số, thu nhập giao dịch, may mắn); nguồn cửa hàng, rớt mini-game, mã quà; đồ cũ thành Xanh lam một dòng; menu tài khoản trong game (nhập mã quà, đặt mật khẩu, đăng xuất); bảng quản lý thêm tỷ lệ cấp, biên độ, tỷ lệ rớt, tặng/sửa/xóa đồ, mã quà |
| `7fee43c` | **Mật khẩu cho tài khoản cũ**: đăng nhập tên chưa có mật khẩu báo "Tài khoản này chưa có mật khẩu."; *Tạo mật khẩu* chỉ khi trình duyệt còn giữ phiên; quản trị viên tạo **link đặt mật khẩu** 24 giờ, chỉ lưu băm; mô tả xem trước "Petfarm, có làm mới có ăn." |
| `81d152d` | Tắm không còn bị coi là đi làm: cột `pets.busy_kind` (`work`, `school`, `bath`); tắm tính là thời gian rảnh |
| `5df0602` | **Tài khoản tên + mật khẩu** trên `play.petfarm.online/server1` (scrypt trong Durable Object, `users.login_key` so không phân biệt hoa thường kể cả chữ có dấu); nhắc người chơi cũ thêm mật khẩu; giới hạn tần suất; xem trước link "Pet Town · Petfarm Server 1"; nền đồng cỏ động ở trang đăng nhập; sửa lỗi spritesheet rò viền |
| `4dde796` | **Đổi tên game thành "Pet Town"** ở mọi chỗ người chơi và admin thấy; route vẫn `/ta-tua`, mã audit giữ nguyên |
| `444bef7` | **Tên miền game `play.petfarm.online`** (`/server1`, `/invitation/<mã>`, link cũ `/ta-tua/khach` tự chuyển); **làm việc từ cấp 1** (bé sơ sinh làm nhẹ 2 giờ/ngày, lương 50%); trừ xu lấy ví rồi tiết kiệm, có *Trừ hết N xu* |
| `fdc824d` | Mọi người chơi còn bé sống đều "ở" công viên (tối đa 50 cư dân, đánh dấu "vắng"); vẫn vuốt ve, tặng quà được |
| `87e99e1` | Quản trị viên **tặng bé bất kỳ loài nào** (kể cả Huyền thoại), chiếm một ô nuôi |
| `89e7f07` | **"Tà tưa": game Petdex Park vào WorkHub.** Một Durable Object SQLite (`PetdexPark`, binding `PETDEX`, migration `petdex-v1`), alarm mỗi phút, WebSocket thuần; `worker.ts` chuyển `/ta-tua/api`, `/ta-tua/ws`; nhân viên đăng nhập một lần; link mời cho khách; bảng quản lý (cộng/trừ xu, sửa chỉ số bé, đổi tên, khóa, link mời, nhật ký); router nhỏ thay Express, hub thay socket.io, lớp SQL cắm được; 72 test của game chạy trong CI |

## Cách thêm dòng mới
1. Chạy `git log --format='%h %ad %s%n%b' --date=short -- petdex public/ta-tua app/petfarm app/wiki` (chỉ đọc).
2. Thêm một dòng dưới ngày tương ứng; thay đổi luật thì tạo thêm ghi chú từ mẫu `Mẫu nhật ký thay đổi luật` và cập nhật ghi chú luật. Xem [[Quy ước vault]].

## Liên quan
- [[Lộ trình phát triển]]
- [[Quyết định thiết kế]]
- [[MOC Thiết kế]]
