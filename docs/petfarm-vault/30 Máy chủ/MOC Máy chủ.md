---
tags: [petfarm, may-chu, moc]
loai: moc
trang-thai: dang-chay
nguon: [petdex/server]
cap-nhat: 2026-10-30
commit: e03a0db
---
# MOC Máy chủ

> [!summary]
> Bản đồ nội dung của thư mục **30 Máy chủ**: kiến trúc, hạ tầng chạy, dữ liệu, hợp đồng API và từng file trong `petdex/server/` (54 file, khoảng 9.650 dòng). Bắt đầu từ [[Kiến trúc máy chủ]], rồi tra từng module khi cần sửa mã. Luật chơi nằm ở [[MOC Luật chơi]] và [[MOC Kinh tế và cộng đồng]].

## Bắt đầu ở đây
- [[Kiến trúc máy chủ]]: bức tranh trình duyệt -> Worker -> Durable Object -> router/hub -> dịch vụ -> SQL; Node và Workers chạy chung mã.
- [[Durable Object PetdexPark]]: vòng đời object `park`, alarm, định tuyến `/api`, `/internal`, `/ws`.
- [[Đồng hồ và ngày giờ game]]: khóa ngày/tuần giờ Việt Nam, 1 ngày thật = 1 tuần tuổi.

## Hạ tầng chạy
- [[Router]]: router kiểu Express tự viết, thứ tự layer, bẫy `auth` chạy nhiều lần.
- [[Hub WebSocket]]: socket.io giả lập trên WebSocket thuần.
- [[Lớp SQL]]: `db.prepare` đồng bộ, backend `node:sqlite` hoặc `ctx.storage.sql`.
- [[Nhịp mỗi phút]]: `runDue`, nhịp giá Sàn 10 phút, chạy bù.
- [[Quyết toán nửa đêm]]: 13 + 2 bước đóng sổ ngày theo thứ tự cố định.

## Dữ liệu
- [[Lược đồ cơ sở dữ liệu]]: 69 bảng theo miền, sơ đồ quan hệ, câu lệnh đáng chú ý.
- [[Migration]]: lược đồ tự bổ sung, 8 bước dữ liệu một lần, migration lớp DO.

## Hợp đồng giao tiếp
- [[API người chơi]]: 116 route HTTP, xác thực, chặn cấp, body, phản hồi.
- [[API nội bộ]]: 38 route cho WorkHub (SSO, khách, mật khẩu, quản trị, gia tộc).
- [[Giao thức công viên]]: 7 tin lên, 13 tin xuống qua WebSocket.
- [[Lỗi và thông báo lỗi]]: `GameError`, ánh xạ mã HTTP, thông báo hay gặp.

## Kiểm thử
- [[Kiểm thử petdex]]: 10 file `node:test`, 6 file Vitest, mô phỏng bot, CI.

## Module: vỏ và hạ tầng
- [[Module index]]: điểm vào Node (`npm run petdex:dev`).
- [[Module durable]]: lớp `PetdexPark` cho Cloudflare.
- [[Module router]]: `Router`, `handleFetch`.
- [[Module hub]]: `createHub`, `bindWebSocket`.
- [[Module http]]: `auth`, `reply`, `intField`.
- [[Module events]]: `bus` sự kiện `pet:changed`.
- [[Module settings]]: `openSignup`, `advancedFinance`, `guestPets`.
- [[Module clock]]: `dayKey`, `startOfDay`, `nextDay`, `weekday`.
- [[Module passwords]]: scrypt, sha256, mã ngẫu nhiên.
- [[Module scheduler]]: `runDue`, `closeDay`.
- [[Module sql-backend]]: mặt tiền SQL.
- [[Module sql-durable-sql]]: backend Durable Object.
- [[Module sql-node-sqlite]]: backend Node.
- [[Module db]]: lược đồ và truy cập dữ liệu lõi.
- [[Module migrate]]: các bước chuyển dữ liệu.

## Module: API
- [[Module routes]]: router gốc, thú, Siêu thị, catalog.
- [[Module routes-economy]]: việc làm, Sàn, ngân hàng, ví; `UNLOCKS`.
- [[Module routes-community]]: quầy, thị trấn, bạn bè, Hội, nhiệm vụ.
- [[Module routes-production]]: chăm sóc, trường, vườn, bếp, xưởng, hợp đồng, Chợ Phiên, vay.
- [[Module routes-clans]]: gia tộc, đất, vĩ mô.
- [[Module internal]]: API nội bộ WorkHub.
- [[Module playground]]: công viên thời gian thực.

## Module: thú cưng
- [[Module game]]: luật thú thuần, `ITEMS`, `GameError`, `tick`.
- [[Module service]]: `snapshot`, `mutatePet`.
- [[Module elements]]: hệ số ngũ hành.
- [[Module species]]: danh sách loài.
- [[Module eggs]]: tạo bé, ấp và nở trứng.
- [[Module lifecycle]]: Đồi Sao, ô tưởng niệm.
- [[Module care]]: tắm, phòng khám, bảo hiểm, trường.
- [[Module gear]]: trang phục có cấp.
- [[Module gifts]]: mã quà.
- [[Module quests]]: nhiệm vụ ngày.
- [[Module minigames]]: phiên chơi có hạt giống.

## Module: kinh tế
- [[Module ledger]]: sổ cái, `KINDS`, `post`.
- [[Module wallet]]: tài sản ròng, báo cáo.
- [[Module bank]]: tiết kiệm, kỳ hạn, Ngân hàng Trung ương.
- [[Module credit]]: điểm tín dụng, vay.
- [[Module market]]: Sàn, kho, lệnh.
- [[Module jobs]]: ca làm.
- [[Module business]]: quầy trà sữa.
- [[Module factory]]: xưởng, gia công.
- [[Module farm]]: vườn, bếp.
- [[Module contracts]]: hợp đồng cung ứng.
- [[Module bazaar]]: Chợ Phiên.
- [[Module town]]: Tòa thị chính, thuế thu nhập.
- [[Module social]]: bạn bè, Hội.
- [[Module clans]]: gia tộc, đất, thuế doanh nghiệp.
- [[Module macro]]: kinh tế vĩ mô.

## Module: luật thuần (`rules/`)
- [[Module rules-bank]] · [[Module rules-careers]] · [[Module rules-business]] · [[Module rules-town]] · [[Module rules-market]] · [[Module rules-production]]

## Tất cả ghi chú trong thư mục

```dataview
TABLE loai, trang-thai FROM "30 Máy chủ" WHERE file.name != this.file.name SORT file.name
```

## Liên quan
- [[Trang chủ]] · [[Bản đồ hệ thống]] · [[MOC Vận hành]] · [[MOC Giao diện]] · [[MOC Thiết kế]]
