---
tags: [petfarm, tong-quan, viec-can-lam]
loai: moc
trang-thai: dang-chay
nguon: []
cap-nhat: 2026-10-30
commit: e03a0db
---
# Việc cần xem lại

> [!summary]
> Những điều lạ, lỗi tiềm ẩn và chỗ tài liệu lệch code phát hiện khi dựng vault (đối chiếu code ở commit `e03a0db`). Đây là danh sách để đội phát triển cân nhắc, chưa có gì được sửa. Mỗi dòng trỏ tới ghi chú có chi tiết và dòng code.

## Rủi ro vận hành
- [ ] **Dữ liệu game không được sao lưu.** Sao lưu hằng ngày chỉ chép Postgres của WorkHub; dữ liệu game nằm trong SQLite của Durable Object. Theo `docs/production-release.md`, production chưa gắn R2 nên cả bản sao lưu Postgres cũng đang bị bỏ qua. Xem [[Sao lưu dữ liệu]].
- [ ] **Quyết toán nửa đêm không bọc chung một giao dịch.** Lỗi giữa chừng thì lần sau chạy lại cả ngày, có thể thu tiền thuê hoặc cộng lãi hai lần. Xem [[Quyết toán nửa đêm]], [[Module scheduler]].
- [ ] **`/internal` trong Durable Object không tự kiểm tra khóa.** An toàn chỉ nhờ `worker.ts` không chuyển đường này ra ngoài. Xem [[API nội bộ]], [[Worker và wrangler]].
- [ ] `docs/production-release.md` chưa có bước kiểm tra Pet Town sau deploy. Xem [[Quy trình deploy]].

## Luật chơi chạy khác ý đồ
- [ ] Mini-game, cho ăn và Phòng khám không kiểm tra bé đang bận (đi làm, đi học). Xem [[Mini-game]], [[Chăm sóc ở nhà]].
- [ ] Không mua được trứng nếu trong túi đã có một quả cùng hành. Xem [[Trứng ngũ hành]].
- [ ] Trứng tưởng niệm (khi bé cuối cùng mất) chỉ hiện sau khi nhận nuôi bé mới. Xem [[Vòng đời và Đồi Sao]].
- [ ] Bảo hiểm có hiệu lực ngay, không có thời gian chờ. Xem [[Bảo hiểm sức khỏe]].
- [ ] Phần cá, trân châu rớt khi kho đầy vẫn bị tính vào hạn mức ngày. Xem [[Mini-game]], [[Kho Sàn]].
- [ ] Cấp tối thiểu của phụ kiện chỉ chặn lúc mua, không chặn lúc đeo. Xem [[Trang phục]].
- [ ] Lãi tiết kiệm ghi lúc 0 giờ nên bị tính thuế vào ngày hôm sau. Xem [[Thuế thu nhập]], [[Ngân hàng Trân Châu]].
- [ ] Nâng cấp kho Sàn không nhân chỉ số giá; `gdp` của kinh tế vĩ mô chỉ để hiển thị. Xem [[Kho Sàn]], [[Kinh tế vĩ mô]].

## Giao diện ghi sai số
- [ ] Nút "Trang phục" ở Nhà luôn ghi "x/4 món", giới hạn thật là 3, 4 hoặc 5. Xem [[Màn Nhà]].
- [ ] Dòng "còn n ngày nữa" thật ra hiển thị số tuần. Xem [[Màn Nhà]].
- [ ] Màn kết quả mini-game luôn ghi "+3 XP" cố định. Xem [[Giao diện mini-game]].
- [ ] Màn Ví vẫn ghi khoản vay "sẽ mở dần" dù đã có vay. Xem [[Màn Ví]].
- [ ] Form đăng ký trong game vẫn hiện nhưng máy chủ tắt (`openSignup: false`), và cho mật khẩu 4 ký tự trong khi menu tài khoản đòi 6. Xem [[Màn Đăng nhập]], [[Tài khoản người chơi]].
- [ ] Màn nhận nuôi và đăng xuất còn chữ "Petdex Park"; biểu tượng Chợ Phiên khác nhau giữa bản đồ (🛒) và màn hình (🏮). Xem [[Màn Nhận nuôi]], [[Màn Chợ Phiên]].
- [ ] Pet Lab ghi 4 điểm neo, thực tế có 5 khe. Xem [[Xưởng tạo hình Pet Lab]].
- [ ] Biến CSS `--sky-deep` được dùng nhưng chưa định nghĩa. Xem [[Phong cách và CSS]].

## Mã nguồn
- [ ] `auth` chạy tới 3 lần mỗi yêu cầu; đường dẫn lạ không có token trả 401 thay vì 404. Xem [[Router]].
- [ ] Vòng import `game.js` → `rules/production.js` → `rules/market.js` → `game.js`. Xem [[Module game]].
- [ ] Bảng `central_bank` lưu tuần theo ngày Chủ nhật, các bảng tuần khác theo thứ Hai. Xem [[Lược đồ cơ sở dữ liệu]].

## Tài liệu cũ
- [ ] `petdex/README.md`: lệnh chạy (`npm start`, cổng 3000, `scripts/demo-server.js`) không còn đúng trong repo này; dùng `npm run petdex:dev` và `npm run test:petdex`. Mục cấu trúc còn nhắc Socket.IO. Xem [[Kiểm thử petdex]], [[Kiến trúc máy chủ]].
- [ ] `petdex/README.md`: bộ đồ "đủ 4 khe +5%" (code: 3/4/5 món), tuổi thọ 90–130 (code: 80–130), thiếu rớt đồ mini-game, thiếu luật Chợ Phiên. Xem [[Bộ đồ ngũ hành]], [[Vòng đời và Đồi Sao]], [[Chợ Phiên]].
- [ ] README gốc: "46 món" phụ kiện (code: 55), thiếu thẻ *Gia tộc & Đất* và bộ lọc *Tự đăng ký* của bảng quản lý. Xem [[Trang phục]], [[Bảng quản lý Pet Town]].
- [ ] `petdex/docs/thiet-ke-mo-rong.md`: cấp mở Tòa thị chính, Khu công nghiệp, Sở Nhà Đất khác code; đấu giá và cho thuê đất chưa làm. Xem [[Tài liệu thiết kế mở rộng]], [[Mở khóa theo cấp]].
- [ ] `petdex/docs/api-giai-doan-2.md` thiếu API gia tộc, đất, vĩ mô, mã quà, trang phục. Xem [[Tài liệu API giai đoạn 2]], [[API người chơi]].
- [ ] Wiki người chơi chưa có bài về Gia tộc, đất, thuế doanh nghiệp, kinh tế vĩ mô. Xem [[Wiki người chơi]].

> [!tip] Tìm tất cả chỗ lệch
> Tìm cụm `Lệch tài liệu` trong vault để xem từng chỗ kèm dòng code.

## Liên quan
- [[Trang chủ]]
- [[Lịch sử phiên bản]]
