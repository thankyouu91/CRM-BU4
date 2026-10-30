# 🧋 Petdex Park

Ứng dụng nuôi thú cưng nhiều người chơi. Linh vật là **Boba**, bé rái cá ôm cốc trà sữa (lấy cảm hứng từ bé Boba của [Petdex](https://petdex.dev)), cùng 50 loài ngũ hành, tất cả vẽ bằng code. Người chơi sống ở **Phố Trân Châu**: nuôi bé, đi làm, chơi mini-game, buôn bán nguyên liệu trên Sàn, gửi tiết kiệm và gặp nhau ở công viên.

Thiết kế đầy đủ và lộ trình: [docs/thiet-ke-mo-rong.md](docs/thiet-ke-mo-rong.md). Hiện đã xong **giai đoạn 1A, 1B và 2**. Mô tả API của giai đoạn 2: [docs/api-giai-doan-2.md](docs/api-giai-doan-2.md).

## Chạy thử

```bash
npm install
npm start
```

Mở http://localhost:3000, tạo tài khoản và nhận nuôi bé đầu tiên (miễn phí).

- `npm run dev`: tự khởi động lại server khi sửa code.
- `npm test`: test luật chơi, test tích hợp kinh tế (DB tạm trong RAM) và một bản mô phỏng rút gọn.
- `npm run simulate -- --bots 60 --days 30`: mô phỏng nền kinh tế với bot (gồm bot mở quầy và bot chủ xưởng), in ra tài sản, lương, lợi nhuận quầy và xưởng, số lượt khám bệnh, lạm phát, quyết định của Ngân hàng Trung ương.
- `npm run demo`: server thử nghiệm ở cổng 3001 với DB riêng `data/demo.db`.
  - Có sẵn một tài khoản bé cấp 8 nhiều xu (đã bật Tài chính nâng cao, có bé thứ hai đang ốm, vườn đã gieo hạt), và một người bạn đã mở quầy, lập Hội, xây xưởng sấy, gửi đề xuất hợp đồng và bày hàng ở Chợ Phiên.
  - Thử quầy, Hội, Tòa thị chính, vườn, bếp, xưởng, hợp đồng, Chợ Phiên, vay được ngay mà không phải cày cấp.
  - Tên đăng nhập và mật khẩu xem trong `scripts/demo-server.js`.
- **Biến môi trường:**
  - `PORT`: cổng chạy server.
  - `PETDEX_DB`: file dữ liệu (mặc định `data/petdex.db`).
  - `ADVANCED_FINANCE=off`: tắt hẳn chế độ Tài chính nâng cao.

## Hình ảnh

Phòng, công viên và bản đồ phố được vẽ bằng code theo phong cách pixel art cùng độ thô với sprite Petdex, không dùng ảnh ngoài:

- Có lớp chuyển động riêng: mây, nước, bướm, xe chạy trên phố, đèn đêm…
- Cảnh đổi theo giờ máy người chơi. Xem thử bằng cách thêm `?time=night` (hoặc `dawn`, `day`, `dusk`) vào URL.
- Hiệu ứng hạt pixel (`public/js/fx.js`) cho mọi hành động.
- **Pet ngũ hành:** 50 loài vẽ bằng một bộ khung chung, dáng đổi theo 6 giai đoạn tuổi. Cứ 10 cấp bé đổi dáng một lần (lớn người, vạch màu hành, vằn hông, vòng linh khí, đốm sáng; cấp 50 ánh vàng). Đồ đeo 5 khe (đầu, mặt, cổ, lưng, bùa) gắn vào điểm neo nên đi theo người ở mọi khung hình; dưới cấp 30 đeo 3 món, từ cấp 30 đeo 4, bé Huyền thoại thêm 1. Đồ trong Siêu thị vẽ pixel cùng phong cách. Xưởng tạo hình: `/pet-lab.html`. Thiết kế ở [docs/thiet-ke-pet-ngu-hanh.md](docs/thiet-ke-pet-ngu-hanh.md).

## Thêm loài thú

```bash
npx petdex@latest install <tên-bé>
npm run import-pets
```

Script chép các bé trong `~/.petdex/pets` và `~/.codex/pets` vào `public/pets/`. Mỗi thư mục ở đó thành một loài **khách mời** trong màn nhận nuôi, hiện bằng ảnh vẽ sẵn của Petdex (đồ đeo dò điểm neo trên ảnh). Loài nào trùng mã với loài vẽ bằng bộ khung, như `boba`, thì dùng bản vẽ bằng bộ khung, không dùng ảnh.

## Luật chơi (giai đoạn 1A–2)

| Hệ thống | Cách hoạt động |
| --- | --- |
| Chỉ số | No bụng −8/giờ (−12 khi đi làm), vui vẻ −4/giờ (gấp đôi khi đói hoặc ốm), năng lượng +12/giờ khi nghỉ, −10/giờ khi đi làm, sạch sẽ −5/giờ (tắm ở nhà miễn phí) |
| Sức khỏe | +1/giờ khi no và sạch, −1/giờ khi đói hoặc bẩn. Dưới 40 thì dễ ốm; bé ốm không đi làm, đi học, chơi mini-game, vào bếp được cho tới khi đi khám. Phòng khám: khám 60, chữa 120–200 xu; bảo hiểm 8 hoặc 20 xu/ngày trả 50% hoặc 90% viện phí |
| Ngũ hành | 50 loài chia Kim, Mộc, Thủy, Hỏa, Thổ; mỗi loài có kỹ năng khởi đầu và tốc độ lên kỹ năng riêng, mỗi hành hao/hồi chỉ số một kiểu và có lợi thế làm ăn riêng. Đồ đeo hợp mệnh làm kỹ năng lên nhanh hơn, đủ bộ 4 khe cùng hành +5% lương; đồ ăn hợp mệnh +20% XP; mỗi ngày một hành vượng (+10% XP và lương). Loài hiếm nở từ trứng ngũ hành (ấp 24 giờ) |
| Tính cách | Mỗi bé 1–2 nét khi nhận nuôi: Tham ăn, Chăm chỉ (+10% lương), Ham chơi, Ngủ nướng, Có duyên (+khách ở quầy), Mọt sách (học +25%) |
| Tuổi | 1 ngày thật = 1 tuần tuổi. Sơ sinh (đi làm nhẹ 2 giờ/ngày, lương 50%, từ cấp 1) → Nhí nhố (2 tuần) → Thiếu niên (8) → Thanh niên (21) → Trưởng thành (40) → Lão làng (70); mỗi giai đoạn một dáng vẽ và luật riêng: sơ sinh dễ ốm, nhí nhố làm 2 giờ lương 60%, thiếu niên 4 giờ lương 85% và mau buồn, thanh niên ăn nhiều, trưởng thành có lương thâm niên, lão làng hay ốm và làm 4 giờ |
| Bé tự lớn | Mỗi đêm (quyết toán ngày) mọi bé còn sống được cộng 12% số XP cần để lên cấp hiện tại, tối thiểu 20 XP, kể cả khi chủ không vào game; bé yếu (sức khỏe dưới 40) được một nửa. Đủ XP thì lên cấp và nhận xu thưởng lên cấp như thường (`DAILY_XP` trong `shared/pets.js`) |
| Phí chăm nuôi | Mỗi đêm mỗi bé tốn (6 + 4 × cấp) × chỉ số giá xu, cả ngày không quá 25% thu nhập hôm đó của chủ (tối thiểu 6 xu/bé), chỉ tính người chơi có vào game trong 3 ngày; ví không đủ thì trừ phần đang có. Nguồn hút xu chính cùng thuế (`UPKEEP` trong `shared/pets.js`, `settleUpkeepDay` trong `lifecycle.js`) |
| Vòng đời | Tuổi thọ khoảng 90–130 tuần (chăm tốt thì sống lâu hơn), còn 7 tuần thì báo trước. Bé mất thì lên Đồi Sao, để lại kỷ vật (+5 kỹ năng sở trường) cho bé sau; ô nuôi thành ô tưởng niệm, mở lại tốn 3.000 xu. Bé cuối cùng mất thì được một trứng miễn phí, nở sau 3 ngày |
| Kỹ năng | Sức mạnh, Nhanh nhẹn, Thông minh, Duyên dáng, Khéo tay (0–100). Tăng khi làm nghề và chơi mini-game, càng cao càng chậm |
| Việc làm | 5 nghề × 5 bậc. Ca 1/2/4 giờ thật, tối đa 8 giờ/ngày, bé bận suốt ca. Lương = lương bậc × (0,8 + kỹ năng/200) × giờ. Lên bậc cần 16/60/150/300 giờ và kỹ năng 20/40/60/80 |
| Mini-game | Câu cá, hứng trân châu, ghép hình. 5 năng lượng/ván. Server kiểm tra kết quả bằng luật chung (`public/js/shared/minigames.js`). Thưởng tối đa 100 xu, 1 lô cá, 2 lô trân châu mỗi ngày |
| Sàn Nguyên Liệu | 12 mặt hàng (thô và chế biến), giá chạy mỗi 10 phút. Giá = **55% luật game** (tin tức; pha ẩn Ổn định / Tăng nóng / Lao dốc / Hỗn loạn đổi bất chợt; sốt/sập giá đột ngột 12–30%, khoảng 0,4 lần/ngày mỗi hàng thô; độ trôi dài hạn 0,6–1,7 lần) + **45% lực mua bán của người chơi** (áp lực phai dần, bán rã 6 giờ). NPC mua bán ±1%, phí 1,5%. Giá sàn 0,25 lần giá gốc, hàng tươi 0,4 lần (không giữ chờ giá lên được). Hạn mức NPC: mỗi người 40 lô mỗi mặt hàng, mỗi chiều, mỗi ngày, và **hạn mức chung của cả thị trấn** 300 lô hoặc 15 lô × số người giao dịch với NPC trong 7 ngày (lấy số lớn hơn; hàng chế biến gấp 3), hết thì chỉ còn khớp với lệnh người chơi khác: tạo tài khoản phụ không gom thêm được bao nhiêu. Lệnh giới hạn chờ tới nửa đêm. Bán ra là trừ kho ngay (lệnh bán chờ giữ hàng, hủy thì trả lại). Hàng tươi (trái cây, cá, thịt, sữa…) theo hạn dùng: nửa đầu Tươi, tới 80% Kém tươi (NPC trả 80%), sau đó Sắp hư (55%), hết hạn thì hư. Có giá vốn bình quân, lãi/lỗ tạm tính từng mặt hàng, sổ lời lãi (đã chốt hôm nay, 7 ngày, tỷ lệ lần bán có lãi). Mở ở cấp 2 |
| Ngân hàng | Tiết kiệm có lãi tính theo giờ, cộng mỗi nửa đêm; gửi kỳ hạn 3/7/14 ngày. Mở ở cấp 3 |
| Vay ngang hàng (P2P) | Người vay đăng yêu cầu (số tiền tới gấp đôi hạn mức hạng, kỳ hạn 3/7/14 ngày, lãi 0,2–3%/ngày), người cho vay rót đủ một lần, tiền đi thẳng giữa hai ví. Ngân hàng làm trung gian, giữ 10–20% tiền lãi theo hạng tín dụng người vay (Kim cương 10%, Đồng 20%). Đáo hạn tự thu từ ví rồi tiết kiệm; thiếu thì trễ hạn (phí 1%/ngày, −20 điểm), trễ 7 ngày là vỡ nợ (−100 điểm, cấm vay 14 ngày, mỗi đêm giữ 30% số dư ví trả dần). Đang trễ hạn thì không vay thêm được. Màn `🤝 Vay ngang hàng & Hụi` (`petdex/server/p2p.js`) |
| Hụi | Hụi bỏ thăm cho người chơi (100–20.000 xu/kỳ, 3–10 người) và hụi lớn giữa các gia tộc (5.000–500.000 xu/kỳ, 3–8 gia tộc, góp bằng quỹ, tộc trưởng thao tác). Mỗi nửa đêm một kỳ: mọi thành viên góp, người bỏ thăm cao nhất hốt (quỹ trừ tiền thăm, tiền thăm chia cho người cùng góp; tối đa 30% quỹ), không ai bỏ thăm thì kỳ đầu chủ hụi hốt rồi theo thứ tự vào dây. Tới kỳ không đủ tiền góp là bị loại, không hoàn số đã góp; người chơi bị trừ tín dụng (nặng hơn nếu đã hốt) và cấm chơi hụi 14 ngày (`petdex/server/hui.js`) |
| Ngân hàng Trung ương | Họp mỗi Chủ nhật: xu tăng nhanh hơn 10%/tuần thì giá siêu thị tăng (0,6 × phần vượt, tối đa +15%/tuần) và lãi tiết kiệm giảm; xu co lại thì ngược lại (tối đa −3%/tuần) |
| Ví | Sổ cái ghi mọi đồng xu. Có tài sản ròng, báo cáo thu chi, sao kê, xếp hạng tài sản |
| Công viên | Đi lại, chat, vẫy/nhảy/xoay, vuốt ve bé khác (cả hai cùng vui), tặng đồ ăn |
| Quầy trà sữa (cấp 4) | Ba vị trí: Hẻm, Mặt phố, Trung tâm. Có 6 món, dùng nguyên liệu trong kho của chủ. Chỉ bán khi có bé trực (bé nhà mình, hoặc thuê bé người khác với lương giữ trước). Khách tính theo giờ cao điểm, giá so với giá tham chiếu, uy tín, trang trí, quảng cáo. Thuế doanh thu 3%; tiền thuê trừ mỗi đêm, nợ 3 đêm thì đóng cửa |
| Thuế & Tòa thị chính | Thuế thu nhập lũy tiến 0/8/12/18% trên lương, tiền mini-game, lãi, lợi nhuận quầy, phí gia công và lãi đã chốt khi bán hàng (theo giá vốn từng lô), ngưỡng 150 xu/ngày. Một nửa thuế và phí vào ngân sách thị trấn. Mỗi tuần bỏ phiếu chọn 1 trong 3 đề xuất chi tiêu (từ cấp 3) |
| Bạn bè & Hội | Kết bạn, thăm nhà, thả tim (bé của bạn vui hơn), tặng quà 5 món/ngày. Hội tối đa 20 người: quỹ chung, nâng cấp Văn phòng (+lương) và Biển hiệu (+khách quầy), dự án tuần góp nguyên liệu |
| Trường học (cấp 2) | Lớp 30 phút, 30–50 xu và 15 năng lượng, +2 đến +4 kỹ năng, mỗi môn 3 buổi/ngày |
| Vườn (cấp 2) | 4 ô (mua thêm tới 9): chè, dâu, mía, sắn; thu hoạch vào kho Sàn. Bạn bè tưới hộ +20% sản lượng, người tưới +2 xu. Sâu ăn mất 30% nếu không bắt |
| Bếp (cấp 3) | Nấu món từ nguyên liệu trong kho, 3 mức chất lượng theo Khéo tay, 3 món ẩn tự ghép mà khám phá. Món để 3 ngày; cho bé ăn, bán quán, hoặc bán ở Chợ Phiên |
| Khu công nghiệp (cấp 6) | 4 loại xưởng biến hàng thô thành hàng chế biến, chỉ chạy khi có bé đứng máy (bé nhà mình hoặc công nhân thuê). Nhận gia công thuê lấy phí mỗi mẻ. Thuê đất mỗi đêm, nợ 3 đêm thì đóng cửa |
| Hợp đồng cung ứng (cấp 6) | Giao Q lô mỗi đêm với giá chốt trong 3–14 ngày, hai bên ký quỹ. Giao thiếu thì bồi thường; phá hợp đồng thì bồi thường 10% phần còn lại và −30 điểm tín dụng |
| Chợ Phiên (cấp 4) | Người chơi bày bán đồ siêu thị và món tự nấu, giá 50–300% giá tham chiếu, phí đăng 1%, phí bán 5%, tin còn 48 giờ |
| Tín dụng & vay | Điểm tín dụng 300–850 cho mọi người, lên khi giữ lời hứa. Chế độ Tài chính nâng cao (cấp 8): vay trả góp 3/7/14 ngày theo hạn mức hạng, tự trừ mỗi tối; trễ 7 kỳ là nợ xấu |
| Gia tộc & Nhà Đất (cấp 4) | Lập gia tộc (3.000 xu), góp quỹ theo định mức tuần, gia tộc lên cấp 1–10 (thêm người, thêm lô, +2% sản lượng mỗi cấp). Thâu tóm tối đa 3 trong 11 ngành: ngành đầu trả bồi thường thị trường 20.000–50.000 xu, ngành thứ hai, ba trả gấp 10 lần. Bản đồ 200 lô (giá 100.000–2.000.000 xu, % tăng giá và % sản xuất tối đa 18%) có 7 địa hình và 4 khí hậu, mỗi ngành hợp đất khác nhau; giá lô trống tăng mạnh khi quỹ đất cạn. Công trình tự lắp từ 200 mẫu (tối đa 20 mảnh, đổi màu từng mảnh). Doanh thu mỗi đêm vào quỹ, thuế doanh nghiệp 35% (+5 điểm mỗi ngành thêm), cuối tháng hoàn 15%. Gia tộc tự khai doanh thu; khai thiếu được ghi vào hồ sơ Sở thuế ở bảng quản trị. Kinh tế vĩ mô mỗi ngày: chu kỳ, thời tiết, cầu từng ngành, chỉ số giá đất; tác động lên lô đất, giá trên Sàn và khách quầy |
| Quản trị gia tộc | Tab `👑 Quản trị` chỉ tộc trưởng đương nhiệm thấy: quỹ, tiền gửi, doanh thu/thuế 7 ngày, ngành đang nắm và tác động lên Sàn. **Phế truất**: thành viên ở gia tộc đủ 24 giờ mở phiếu (gia tộc từ 3 người), đề cử người thay; quá nửa thành viên (trừ tộc trưởng) thuận trong 48 giờ thì tộc trưởng thành thành viên thường và **không bao giờ** được giữ chức lại ở gia tộc đó (kể cả rời đi rồi quay lại); thất bại thì 3 ngày sau mới mở lại. **Tiền gửi gia tộc**: tộc trưởng gửi kỳ hạn 3/7/14 ngày từ quỹ (lãi cơ bản + phụ phí kỳ hạn + 0,05%/ngày ưu đãi), rút gấp trước hạn mất lãi và phạt 5% gốc; quỹ không đủ trả phí duy trì hoặc thuế thì hệ thống tự rút gấp (phạt 3%) (`petdex/server/clan-gov.js`) |
| Trò chuyện & hộp thư | Tab `💬 Chat`: **kênh chung** (cả thị trấn, tài khoản mới chờ 1 giờ mới được nói, giữ 7 ngày), **kênh gia tộc** (chỉ thành viên) và **tin nhắn riêng** (tìm theo tên đăng nhập); tin dài tối đa 300 ký tự, mỗi người cách nhau 2,5 giây; màn đang mở hỏi tin mới 4 giây một lần. Chặn một người thì không nhận tin riêng, thư, và tin của họ ở các kênh bị ẩn. Nút `📬`: **hộp thư**, người chơi gửi thư cho nhau (30 giây một lá, 20 lá/ngày, không kèm xu), Ban quản lý gửi thư cho một người hoặc mọi người, có thể kèm xu nhận một lần (sổ cái loại `mail`). Chấm đỏ: tin gia tộc, tin riêng, thư chưa đọc. Quản trị (bảng quản lý → Thư & trò chuyện): gửi thư, xoá tin, cấm chat theo giờ (`petdex/server/chat.js`) |
| Ngành gia tộc (26 ngành) | 11 ngành dịch vụ, 11 ngành sản xuất, 4 ngành chiến lược. Các ngành na ná nhau đã gộp: Khai khoáng & dầu khí, Nông nghiệp & chăn nuôi (khai thác nhiều nhóm tài nguyên của lô); Hàng tiêu dùng (thực phẩm chế biến, dệt may, đồ gỗ), Điện tử & vi mạch, Luyện kim (thép, nhôm), Hóa dầu (lọc dầu, hóa chất), Phương tiện vận tải (ô tô, tàu hỏa, đóng tàu, máy bay): mỗi lô chọn một **dây chuyền** (như chọn loại nhà máy điện), công thức từng dây chuyền giữ nguyên. Dữ liệu cũ tự chuyển khi khởi động (bước `industries_merge_v1`): lô giữ đúng dây chuyền đang chạy, gia tộc nắm hai ngành cũ nay là một được hoàn tiền thâu tóm ngành thừa; cầu vĩ mô của ngành gộp lấy trung bình ngành cũ. **Quay lại bản cũ**: trên bản mới, bảng quản lý → Gia tộc → *Gỡ gộp* (hoặc `POST /internal/admin/industries/unmerge` với `{"confirm":"UNMERGE"}`, xem trước bằng `GET …/industries/status`) đưa lô và ngành về id cũ theo dây chuyền đang chạy, khôi phục ngành bị xoá, thu lại tiền hoàn (tối đa bằng quỹ) và đặt cờ giữ để bản mới không tự gộp lại; rồi deploy bản cũ ngay. Quay về bản mới: deploy rồi bấm *Gộp lại* (`POST …/industries/merge`) (`petdex/server/industry-merge.js`) |
| Ngành gia tộc → Sàn | Mỗi ngành gia tộc nắm tác động lên Sàn Nguyên Liệu theo độ mạnh (0,15 mỗi gia tộc nắm + 1/8 mỗi lô có công trình hoàn chỉnh, tối đa 1): ngành làm ra hàng thì cung tăng, giá trung bình giảm tới 15% (trà, bò sữa, mía, sắn, trái cây, thủy sản, nông nghiệp, chăn nuôi...); ngành dùng hàng thì cầu tăng tới 12% (trà sữa, nhà hàng, giải trí, công nghiệp nuôi công nhân); điện, dầu khí, lọc dầu hạ chi phí hàng chế biến; giao vận, đường sắt, máy móc làm giá bớt biến động. Ngành chưa gia tộc nào nắm thì hàng chạy theo thị trường bình thường (`public/ta-tua/game/js/shared/industry-market.js`) |
| Nhiệm vụ ngày | 3 nhiệm vụ theo những gì người chơi làm được, làm đủ thì mở rương. Quà ngày tăng theo chuỗi đăng nhập (60 → 120 xu). Trợ cấp tân thủ 30 xu/ngày trong 7 ngày đầu |

## Cấu trúc

```
server/
  game.js            luật thú cưng (chỉ số, tuổi, cấp, vật phẩm)
  rules/             luật thuần của nghề nghiệp, Sàn, ngân hàng — có test
  ledger.js          sổ cái: nơi duy nhất được thay đổi xu
  jobs.js market.js bank.js minigames.js wallet.js   các hệ thống kinh tế
  business.js town.js social.js quests.js            quầy, thuế & ngân sách, bạn bè & Hội, nhiệm vụ
  clans.js macro.js  gia tộc, đất, thuế doanh nghiệp, Sở thuế; kinh tế vĩ mô (luật chung ở public/ta-tua/game/js/shared/clan.js)
  care.js farm.js factory.js contracts.js bazaar.js credit.js   chăm sóc & trường, vườn & bếp, xưởng, hợp đồng, Chợ Phiên, tín dụng
  scheduler.js       nhịp giá 10 phút, quyết toán nửa đêm (giờ Việt Nam), chạy bù khi server từng tắt
  migrate.js         chuyển dữ liệu cũ (mỗi bước chạy một lần)
  routes.js routes-economy.js routes-community.js routes-production.js   REST API /api/*
  playground.js      công viên thời gian thực qua Socket.IO
public/js/
  app.js             khung ứng dụng, Nhà, Siêu thị, Túi đồ, Bảng vàng
  views/             Bản đồ, Việc làm, Khu vui chơi, Sàn, Ngân hàng, Ví, Báo, Quầy, Tòa thị chính, Bạn bè & Hội,
                     Vườn, Bếp, Trường học, Phòng khám, Khu công nghiệp, Hợp đồng, Chợ Phiên, Tín dụng
  townmap.js scenes.js pixel.js fx.js charts.js   đồ họa pixel
  games/             ba mini-game
  shared/minigames.js   luật mini-game dùng chung cho trình duyệt và server
scripts/simulate-economy.js   mô phỏng kinh tế bằng bot
```

Server giữ toàn bộ logic tiền và chỉ số, client chỉ hiển thị, nên người chơi không sửa được xu từ trình duyệt.
