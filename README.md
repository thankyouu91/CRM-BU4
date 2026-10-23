# WorkHub — Quản lý công việc, báo cáo & trình chiếu

Dashboard quản lý dự án và công việc cho doanh nghiệp: giao việc theo hạng mục, task con và người phụ trách (PIC), báo cáo tiến độ gửi về quản lý, biểu đồ theo dõi, xuất PDF/PowerPoint, trình chiếu trực tuyến và trợ lý AI tạo báo cáo cùng Claude.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma 6 + PostgreSQL · Recharts · Framer Motion · triển khai trên Cloudflare Workers (OpenNext) + Supabase.

## Tính năng

| # | Yêu cầu | Đã có |
|---|---|---|
| 1 | Task, hạng mục, task con, PIC, báo cáo người thực hiện → quản lý | Dự án → hạng mục lớn → hạng mục con → task → task con (nhiều cấp); mỗi hạng mục lớn/con có ngày bắt đầu và hạn hoàn thành riêng; giao PIC; xem dạng danh sách hoặc Kanban kéo-thả; người phụ trách gửi báo cáo (nội dung, % tiến độ, giờ làm); báo cáo vào **Hộp báo cáo** của quản lý để xem, nhận xét, **duyệt hoàn thành** |
| 2 | Xuất PDF / trình chiếu như PPTX với hiệu ứng mượt | Bộ slide tự động từ số liệu; trình chiếu toàn màn hình với 4 hiệu ứng (trượt, mờ dần, phóng to, lật 3D), tự chạy, xem tổng quan, phím tắt; xuất **PDF** và **PowerPoint gốc, chỉnh sửa được** (biểu đồ PowerPoint thật, có hiệu ứng chuyển slide); link trình chiếu online `/present` |
| 3 | Lọc theo ngày – tháng – quý – năm | Bộ lọc Ngày / Tháng / Quý / Năm / Tuỳ chọn, chuyển kỳ trước/sau; ranh giới kỳ tính theo múi giờ doanh nghiệp (`APP_TIMEZONE`) |
| 4 | UI/UX thân thiện, chuyên nghiệp | Giao diện sáng/tối, responsive, tiếng Việt; bảng màu biểu đồ đã kiểm tra cho người mù màu; mỗi biểu đồ có chế độ xem bảng |
| 5 | Đăng nhập, tạo tài khoản, đổi mật khẩu, bảo mật | Xem mục [Phân quyền](#phân-quyền) và [Bảo mật](#bảo-mật) |
| 6 | Ghi chú / phản hồi cho từng dự án | Tab “Ghi chú & phản hồi” trong mỗi dự án |
| 7 | Theo dõi dự án với biểu đồ, % hoàn thành | Dashboard KPI, vòng tiến độ, xu hướng, phân bổ trạng thái, khối lượng theo nhân sự; tab “Tiến độ” có bảng **tiến độ theo deadline** (thực tế so với kế hoạch đến hôm nay, % đạt kế hoạch, trạng thái Đúng tiến độ / Có rủi ro / Chậm / Trễ hạn), **khối lượng đã làm / cần làm** và timeline (Gantt) gồm cả thời hạn hạng mục; các số liệu này có trong Trung tâm báo cáo, slide trình chiếu, PDF/PowerPoint và prompt AI |
| 9 | Báo cáo hợp đồng & chi phí (thay file Excel) | Trang **Hợp đồng & chi phí**: giá trị HĐ, chi phí đào tạo / khảo thí / khác, lợi nhuận gộp, tỷ suất LN, đánh giá, đã thu, còn phải thu, trạng thái thanh toán — tính tự động; lọc theo tháng/quý/năm, dòng tổng, 4 ô tổng hợp như mẫu Excel; **dán dữ liệu từ Excel** để nhập nhanh và **xuất Excel** đúng bố cục mẫu; **lưu file PDF hợp đồng** để lưu trữ và báo cáo (nhắc riêng cho dự án đã hoàn thành) |
| 8 | AI hỗ trợ báo cáo | Trang **Trợ lý AI**: tab **Trò chuyện** để chat với Claude (prompt mẫu, chọn phạm vi, kỳ, độ dài, người đọc) khi đã có Claude API key; tab **Sao chép prompt** đóng gói số liệu thật thành báo cáo. **Viết bằng AI** ngay trên trang khi quản trị viên đã nhập Claude API key (xem [Trợ lý AI tích hợp](#trợ-lý-ai-tích-hợp-claude-api)); hoặc mở Claude.ai điền sẵn / sao chép / tải file cho Claude Code rồi dán kết quả lại. Kết quả xem trước được, lưu thành ghi chú dự án, hoặc biến dàn ý thành slide để trình chiếu & xuất file |
| 10 | Báo cáo tuần trước đã làm, tuần này / tuần tới (hoặc tháng) làm gì, gửi sếp | Tab **Báo cáo tuần / tháng** trong *Công việc của tôi*: ba mục lấy trực tiếp từ công việc và dự án của bạn, ghi chú tự lưu, gửi cấp trên, xuất Excel và in / lưu PDF; cấp trên xem cả đội trong *Hộp báo cáo*. Xem [Báo cáo công việc tuần / tháng](#báo-cáo-công-việc-tuần--tháng) |
| 11 | Chấm công sáng / chiều, xin nghỉ, xuất Excel theo tháng, tồn phép năm | Trang **Chấm công**: mặc định đi làm đủ buổi (thứ 2 đến thứ 6 sáng và chiều, thứ 7 buổi sáng), bấm vào buổi bận để ghi nghỉ và lý do; bảng công tháng của đội, **xuất Excel** theo mẫu bảng chấm công; phép năm được hưởng và tồn năm trước sửa được, số đã nghỉ và còn lại tự tính từ lịch. Xem [Chấm công & nghỉ phép](#chấm-công--nghỉ-phép) |

### Phân quyền

**Cấp bậc** (mỗi cấp có sẵn một nhóm quyền):

| Cấp | Tạo dự án | Xem mọi dự án | Quản lý mọi dự án | Quản lý nhân viên | Hợp đồng & chi phí |
|---|:-:|:-:|:-:|:-:|:-:|
| 4 · Quản trị viên | ✓ | ✓ | ✓ | ✓ (mọi tài khoản) | ✓ |
| 3 · Quản lý | ✓ | ✓ | ✓ | ✓ (cấp dưới) | ✓ |
| 2 · Trưởng nhóm | ✓ | | | | |
| 1 · Nhân viên | | | | | |

**Cấp thêm quyền:** người có quyền *Quản lý nhân viên* vào trang **Nhân sự** → biểu tượng khiên để đổi cấp bậc và cấp thêm quyền cho người **ở cấp thấp hơn**, chỉ trong phạm vi quyền mình đang có (ví dụ: quản lý cấp quyền *Tạo dự án* cho một nhân viên). Quyền mới có hiệu lực ngay, không cần đăng nhập lại; đổi cấp bậc thì người đó phải đăng nhập lại.

**Vai trò trong từng dự án:** *Quản lý dự án* (sửa dự án, hạng mục, thành viên, mọi công việc; duyệt báo cáo) · *Thành viên* (tạo công việc, cập nhật và báo cáo việc mình phụ trách) · *Chỉ xem* (xem và gửi ghi chú/phản hồi). Người tạo dự án là chủ dự án và luôn là quản lý dự án; chỉ chủ dự án hoặc người có quyền *Quản lý mọi dự án* mới xoá được dự án.

**Quản lý trực tiếp:** trong hồ sơ nhân sự (trang **Nhân sự** → tạo mới hoặc sửa) chọn *Quản lý trực tiếp* của từng người. Người này nhận thông báo khi nhân sự xin nghỉ, xem và sửa chấm công của họ (kể cả tháng đã qua). Không chọn chính mình được, và không tạo được vòng quản lý (A quản lý B thì B không thể quản lý A, trực tiếp hay qua người khác). Mỗi lần đổi được ghi nhật ký.

Mọi quyền được kiểm tra ở phía server cho từng API (`lib/permissions.ts`, `lib/rbac.ts`).

### Hợp đồng & chi phí

Chỉ người có quyền **Hợp đồng & chi phí** thấy mục này (quản lý có thể cấp cho nhân viên kế toán ở trang Nhân sự). Cách tính (`lib/finance.ts`):

- **Lợi nhuận gộp** = Giá trị HĐ − (CP đào tạo + CP khảo thí + CP khác); **Tỷ suất LN** = Lợi nhuận ÷ Giá trị HĐ. Hợp đồng chưa nhập chi phí được **ước tính** theo *Tỷ suất LN dự kiến* (hiển thị chữ nghiêng); không có cả hai thì để trống.
- **Đánh giá**: ≥ 30% Tốt · 15–30% Khá · 0–15% Thấp · < 0 Lỗ.
- **Còn phải thu** = Giá trị HĐ − Đã thanh toán; **Trạng thái TT** tự động: chưa thu → *Chưa thanh toán*, thu một phần → *Đã tạm ứng*, thu đủ → *Đã hoàn tất*.
- Ô tổng hợp: *Tỷ lệ CP* tính trên các HĐ đã nhập chi phí; *Tỷ suất LN TB* tính trên các HĐ có lợi nhuận (thực tế hoặc ước tính).
- **Dán từ Excel**: chọn các dòng trong file cũ (có thể kèm dòng tiêu đề) → Ctrl+C → dán; các cột tính toán (Tổng giá trị, LN gộp, Đánh giá, Còn phải thu, Trạng thái TT) được tính lại.
- **Liên kết với dự án — một nguồn số liệu duy nhất:** mỗi hợp đồng gắn với tối đa một dự án. Nhập số hợp đồng, giá trị, chi phí, đã thu ngay trong form *Tạo/Sửa dự án* hoặc tab **Hợp đồng & chi phí** của dự án — đó chính là bản ghi hợp đồng, nên trang Hợp đồng & chi phí, Trung tâm báo cáo (mục *Tài chính hợp đồng*, bảng *Tiến độ & tài chính theo dự án*), slide trình chiếu, PDF/PowerPoint và prompt AI luôn cùng một số liệu và cùng công thức. Xoá dự án không xoá hợp đồng; hợp đồng chuyển sang nhóm *Chưa gắn dự án*.
- Trung tâm báo cáo: khi chọn một dự án, mục tài chính tính **toàn bộ hợp đồng của dự án**; khi xem tất cả dự án, tính các hợp đồng có ngày thực hiện trong kỳ đang lọc.

#### Hồ sơ hợp đồng (PDF)

- Mỗi hợp đồng lưu được tối đa **20 file PDF**, mỗi file ≤ **25 MB** (bản ký, phụ lục, biên bản nghiệm thu): mở form hợp đồng → mục *Hồ sơ hợp đồng (PDF)* → kéo thả hoặc chọn file; hợp đồng đang tạo mới thì file được tải lên ngay sau khi lưu. Chỉ nhận file PDF thật (kiểm tra nội dung `%PDF-`, không chỉ đuôi file). Bấm tên file để xem trong tab mới, hoặc tải về / xoá.
- **Dự án đã hoàn thành:** tab *Hợp đồng & chi phí* của dự án liệt kê các hợp đồng chưa có PDF, mỗi dòng có nút *Tải PDF lên*.
- Trang Hợp đồng & chi phí: cột **File HĐ** (bấm để xem / tải file lên) và bộ lọc *Dự án xong, chưa có PDF*, *Chưa có file PDF*, *Đã có file PDF*; file Excel xuất ra có cột *File HĐ* (“Có (n)” / “Chưa”), dán lại vào trang vẫn nhập được.
- Trung tâm báo cáo: cột *Hồ sơ PDF* (số HĐ đã có file / tổng số HĐ) theo từng dự án và danh sách dự án đã hoàn thành còn thiếu PDF (tính trên mọi hợp đồng của dự án, không theo kỳ); prompt AI cũng có số liệu này.
- Quyền giống dữ liệu hợp đồng: chỉ người có quyền *Hợp đồng & chi phí*. Xoá hợp đồng thì xoá luôn file của nó; xoá dự án vẫn giữ hợp đồng và file.
- **Lưu trữ:** file nằm trên **Cloudflare R2** (bucket `crm-contract-files`, binding `CONTRACT_FILES`, đọc/ghi qua `lib/file-storage.ts`), tổng tối đa **9 GB** (R2 miễn phí 10 GB). Khi tài khoản chưa bật R2, file được lưu trong Postgres (bảng `ContractFileBlob`, tối đa **300 MB** để không làm đầy Supabase Free); file cũ trong Postgres được chuyển sang R2 ở lần mở đầu tiên sau khi bật R2.

### Tiến độ theo deadline

*Kế hoạch đến hôm nay* = phần thời gian đã trôi qua giữa ngày bắt đầu và hạn hoàn thành (giả định công việc tiến triển đều). So sánh với tiến độ thực tế: chậm không quá 10 điểm là **Đúng tiến độ**, 10–25 điểm là **Có rủi ro**, hơn 25 điểm là **Chậm tiến độ**, qua hạn mà chưa xong là **Trễ hạn**. *Đạt KH* = thực tế ÷ kế hoạch. Hạng mục lớn tính cả công việc của các hạng mục con; hạng mục chưa có ngày bắt đầu dùng ngày bắt đầu của hạng mục lớn hoặc của dự án (`lib/schedule.ts`).

### Mẫu dự án

Cho các dự án lặp lại cùng một khung (ví dụ *Khảo thí tiếng Anh ACB*, *Đào tạo PCCC cho UEH*): lưu một dự án làm mẫu rồi tạo dự án mới từ mẫu, ngày được tính lại theo ngày bắt đầu mới.

- **Lưu làm mẫu:** mở dự án → **Lưu làm mẫu** (hiện với người quản lý dự án đó **và** có quyền *Tạo dự án*), đặt tên và mô tả. Mẫu giữ hạng mục lớn / con (tên, màu, thứ tự), công việc và task con (tiêu đề, mô tả, mức ưu tiên, hạng mục) cùng ngày bắt đầu / hạn hoàn thành, lưu dưới dạng **số ngày** so với ngày gốc: ngày bắt đầu dự án, nếu trống thì ngày sớm nhất của hạng mục / công việc, nếu vẫn trống thì ngày tạo dự án. **Không** lưu người phụ trách, trạng thái, tiến độ, báo cáo, ghi chú hay hợp đồng. Tối đa 100 hạng mục và 500 công việc mỗi mẫu.
- **Tạo từ mẫu:** trang *Dự án* → **Tạo từ mẫu**, chọn mẫu (kèm số hạng mục, công việc), nhập tên dự án và ngày bắt đầu; ô xem trước ghi “12 hạng mục, 48 công việc; ngày tính lại từ 20/10/2026”. Dự án mới thuộc về người tạo (là quản lý dự án, như khi tạo dự án thường), bắt đầu từ ngày đã chọn, hạn hoàn thành là hạn muộn nhất trong các hạng mục / công việc; mọi công việc ở trạng thái *Cần làm*, 0%, chưa giao ai. Dự án, hạng mục và công việc được tạo trong một transaction.
- **Ngày** tính theo lịch của `APP_TIMEZONE`: ngày bắt đầu là 00:00, hạn hoàn thành là 23:59:59 giờ Việt Nam, nên một hạn “23:59 ngày 05/10” không bị lệch sang ngày khác khi server chạy giờ UTC.
- **Quản lý mẫu:** danh sách mẫu nằm trong hộp thoại *Tạo từ mẫu*; người tạo mẫu hoặc quản trị viên xoá được mẫu (xoá mẫu không ảnh hưởng dự án đã tạo). Nhật ký thao tác ghi `project_template.create`, `project_template.delete` và `project.create` (kèm id mẫu, số hạng mục, công việc).
- Mã nguồn: `lib/project-templates.ts` (dữ liệu mẫu có phiên bản, chụp và dựng lại, không cần database), `lib/project-template-service.ts`, `app/api/project-templates`, `app/api/projects/from-template`; bảng `ProjectTemplate`.

### Báo cáo công việc phòng (Trung tâm báo cáo)

Màn hình mặc định của *Trung tâm báo cáo*: tuần trước (kết quả, tồn đọng), tuần này (việc phải làm) và tuần tới (kế hoạch), tính theo **công việc** trong mọi dự án bạn được xem (`lib/department-report.ts`). Xuất Excel gửi sếp có đủ các mục.

- **Dự án chưa có việc trong 3 tuần:** dự án mới tạo chưa có công việc (ví dụ dự án do Trợ lý AI tạo), hoặc dự án mà việc còn lại bắt đầu và đến hạn sau tuần tới, được liệt kê riêng kèm trạng thái, quản lý và việc tiếp theo, để không dự án nào bị sót. Thêm công việc có deadline thì dự án chuyển vào các tuần tương ứng. Dự án đã xong hết việc hoặc đã huỷ không liệt kê.

### Sửa hàng loạt và lọc nhanh

*Công việc của tôi* → danh sách: các nút **Chưa giao người** (khi xem *Tất cả dự án*), **Chưa có deadline**, **Quá hạn** lọc việc chưa xong cần bổ sung, kèm số lượng; lọc thêm theo dự án. Đường dẫn giữ bộ lọc (`/tasks?issue=overdue`), nên thông báo có thể mở thẳng vào đó.

- Tích chọn từng việc hoặc cả nhóm, rồi trên thanh **Sửa hàng loạt**: giao cho một người, đặt deadline (cuối ngày theo giờ Việt Nam), đổi trạng thái hoặc ưu tiên cho tất cả trong một bước (`POST /api/tasks/bulk`, tối đa 200 việc).
- Quyền như khi sửa từng việc (`lib/task-bulk.ts`): người được giao chỉ đổi được trạng thái; người phụ trách mới phải là thành viên của dự án. Việc không sửa được được bỏ qua và báo lý do; mỗi việc đã sửa có một dòng nhật ký.

### Thông báo

Chuông trên thanh trên cùng (`components/layout/notification-bell.tsx`, `lib/notifications.ts`):

- **Thông báo lưu lại:** được giao công việc (giao nhiều việc một lúc thì gộp thành một thông báo), được thêm vào dự án, báo cáo tiến độ được duyệt, báo cáo tuần/tháng được cấp trên xem (kèm nhận xét), nhân sự mình quản lý trực tiếp xin nghỉ. Không ai nhận thông báo về thao tác của chính mình. Bấm để mở đúng công việc, dự án hoặc báo cáo; *Đánh dấu đã đọc* cho tất cả. Thông báo cũ hơn 90 ngày được xoá trong tác vụ hằng đêm.
- **Cần chú ý** (tính lại mỗi lần mở, không lưu): việc của bạn đã quá hạn, việc đến hạn hôm nay hoặc ngày mai, báo cáo tuần chưa gửi; cấp trên thấy số người chưa gửi báo cáo tuần.
- Chuông tự cập nhật khi chuyển trang, khi quay lại tab và vài phút một lần.

### Nhắc báo cáo tuần

Từ **15:00 thứ Sáu** đến hết Chủ nhật nhắc báo cáo của tuần đang chạy; thứ Hai và thứ Ba nhắc báo cáo tuần trước nếu chưa gửi (giờ Việt Nam). Nhắc ở chuông và bằng chấm vàng cạnh *Công việc của tôi* trên thanh bên. Mọi cấp trừ quản trị viên viết báo cáo tuần; quyền xem báo cáo của người khác giữ nguyên như dưới đây.

### Trình chiếu báo cáo

*Trung tâm báo cáo → Thống kê & trình chiếu* (và liên kết `/present`) dựng bộ slide từ số liệu kỳ đang lọc; cùng nội dung khi trình chiếu, xuất PDF hay PowerPoint (`lib/deck-model.ts`).

- **Tiến độ hoàn thành từng dự án:** có đủ mọi dự án. Dòng đầu tóm tắt số dự án, số đã xong toàn bộ việc, số có việc quá hạn, số chưa có công việc. Tới 6 dự án mỗi dự án một hàng lớn; nhiều hơn thì gọn thành hai cột, tối đa 14 dự án mỗi slide (nhiều hơn chia đều sang slide sau). Dự án đang thực hiện xếp trước, đã hoàn thành xếp cuối; tên dài được rút gọn.
- **Báo cáo tuần:** ba slide *Tuần trước · Đã làm*, *Tuần này · Đang làm*, *Tuần tới · Sẽ làm*, cùng số liệu với Báo cáo công việc phòng, nhóm theo dự án, mỗi việc có người phụ trách và nhãn (xong ngày, hạn, % đang làm, tồn, bị chặn). Tuần được chọn là tuần hiện tại, hoặc tuần cuối của kỳ nếu kỳ đã qua. Tuần nhiều việc chia thành nhiều slide (tối đa 3 mỗi phần, phần còn lại ghi số việc và chỉ sang báo cáo đầy đủ).
- **Chia sẻ ra ngoài (link công khai):** nút **Chia sẻ trình chiếu** cho link nội bộ `/present` (cần đăng nhập) và, với trưởng nhóm trở lên, link công khai `/share/<mã>` để người ngoài xem không cần tài khoản. Chọn thời hạn 1, 7, 30 hoặc 90 ngày; mặc định không kèm hợp đồng, doanh thu, lợi nhuận (chỉ người có quyền tài chính bật được). Số liệu tính lúc mở, theo quyền của người tạo. Link ngừng hoạt động khi hết hạn, bị thu hồi, người tạo bị khoá hoặc dự án bị xoá; mọi trường hợp đều hiện cùng một trang "Liên kết không còn hiệu lực". Chỉ lưu mã băm SHA-256, nên link chỉ hiện một lần lúc tạo. Trang công khai gửi `noindex` và `no-referrer`; tạo và thu hồi được ghi nhật ký (`lib/report-share.ts`, bảng `DeckShare`).

### Báo cáo công việc tuần / tháng

*Công việc của tôi* → tab **Báo cáo tuần / tháng**, chọn **Tuần** (thứ Hai 00:00 → Chủ nhật 23:59, số tuần ISO, ví dụ “Tuần 41 · 05/10 – 11/10/2026”) hoặc **Tháng**, chuyển kỳ trước / sau. Ranh giới kỳ tính theo `APP_TIMEZONE` (`lib/work-report.ts`).

- **Luôn đồng bộ với công việc:** các mục được tính lại mỗi lần mở từ những công việc bạn phụ trách **hoặc** đã tạo, và báo cáo tiến độ bạn đã gửi:
  - *Tuần trước đã làm*: việc hoàn thành trong tuần trước + các báo cáo tiến độ đã gửi (nội dung, %, giờ làm), nhóm theo dự án;
  - *Tuần này đang làm*: việc đang làm / chờ duyệt / bị chặn, bắt đầu hoặc đến hạn trong tuần (việc quá hạn chưa xong được chuyển sang và đánh dấu đỏ), cùng việc đã xong trong tuần;
  - *Tuần tới kế hoạch*: việc chưa xong bắt đầu hoặc đến hạn tuần tới. Nút **Thêm việc vào kế hoạch** tạo một công việc thật trong dự án (giao cho bạn, ngày trong tuần tới), nên nó xuất hiện cả trong dự án lẫn báo cáo;
  - *Dự án của tôi*: dự án bạn làm chủ hoặc là quản lý dự án, với % hoàn thành và trạng thái so với deadline.
  Bấm vào một công việc để mở chi tiết; sửa ở đó thì báo cáo cập nhật ngay.
- **Ghi chú** cho từng mục và **Khó khăn / đề xuất**: tự lưu nháp sau khi ngừng gõ (hoặc bấm *Lưu nháp*).
- **Gửi báo cáo** chụp lại danh sách lúc gửi. Sau đó báo cáo vẫn hiện số liệu hiện tại, dòng nào đổi ghi rõ “lúc báo cáo Đang làm · 40% → hiện tại Hoàn thành · 100%”, kèm việc mới phát sinh hoặc đã bị xoá. Sửa rồi **Gửi lại** để cập nhật bản gửi.
- **Ai xem được:** chính người viết, quản trị viên, và người có cấp bậc **cao hơn** (quản lý xem trưởng nhóm và nhân viên, trưởng nhóm xem nhân viên); cùng cấp hoặc cấp dưới không xem được (`canViewWorkReport` trong `lib/permissions.ts`). Chỉ người viết sửa và gửi; cấp trên đánh dấu **Đã xem** kèm nhận xét, hiện ngay trên báo cáo của người viết.
- **Cấp trên:** *Hộp báo cáo* → tab **Báo cáo tuần / tháng** liệt kê mọi nhân sự cấp dưới với trạng thái (Đã gửi + thời gian, Nháp, Chưa có, Đã xem), mở từng người để đọc và nhận xét; **Xuất Excel tổng hợp** gồm bảng tổng hợp, chi tiết công việc và báo cáo tiến độ của cả đội.
- **Xuất:** Excel cho từng báo cáo và **In / Lưu PDF** (bản in ẩn menu, nút bấm, luôn nền sáng).
- Dữ liệu mẫu: Bùi Ngọc Lan đã gửi báo cáo tuần trước (có dòng thay đổi so với lúc gửi), Phạm Thu Dung đã gửi tuần này (Trần Thị Bình đã xem), Hoàng Văn Em đang soạn nháp tuần này.

### Chấm công & nghỉ phép

Thanh bên → **Chấm công** (`/attendance`). Lịch làm việc: thứ 2 đến thứ 6 hai buổi sáng và chiều, thứ 7 buổi sáng (8:00 – 12:00), Chủ nhật nghỉ. Ngày tính theo `APP_TIMEZONE` (`lib/attendance.ts`).

- **Mặc định đi làm:** không cần bấm gì cho những buổi đi làm bình thường. Chỉ những buổi khác thường mới được lưu (bảng `AttendanceMark`).
- **Ghi nghỉ:** bấm vào một buổi trên lịch, chọn *Buổi sáng*, *Buổi chiều*, *Cả ngày* hoặc *Nhiều ngày*, chọn loại và ghi lý do (VD: "Đưa con đi khám"). *Đi làm bình thường* xoá ghi nhận. Nhiều ngày thì bỏ qua Chủ nhật, chiều thứ 7 và ngày lễ.

  | Loại | Ký hiệu | Tính công | Trừ phép năm |
  |---|:-:|---|:-:|
  | Nghỉ phép năm | P | Hưởng lương | ✓ |
  | Nghỉ ốm | Ô | Không do công ty trả | |
  | Nghỉ việc riêng có lương | R | Hưởng lương | |
  | Nghỉ không lương | KL | Không lương | |
  | Đi công tác | CT | Tính là đi làm | |

  Trên bảng công: X là đi làm, L là nghỉ lễ, buổi sáng và chiều khác nhau ghi dạng `X/P`.
- **Ai sửa được:** mỗi người tự ghi cho mình từ đầu tháng hiện tại trở đi; tháng đã qua chỉ quản lý trực tiếp hoặc người có quyền *Quản lý nhân viên* (với cấp thấp hơn) sửa. Khi nhân sự tự ghi nghỉ, quản lý trực tiếp nhận thông báo trên chuông. Không có bước duyệt: ghi là có hiệu lực, quản lý sửa lại nếu cần.
- **Ai xem được:** chính người đó, quản lý trực tiếp, và cấp trên theo cùng quy tắc với báo cáo tuần (`lib/attendance-access.ts`).
- **Tổng công tháng:** công chuẩn (không tính ngày lễ), đi làm (tháng hiện tại tính đến hôm nay), từng loại nghỉ, nghỉ lễ, công hưởng lương. Mỗi buổi là nửa ngày công.
- **Phép năm:** *Còn lại = được hưởng + tồn năm trước − đã nghỉ phép năm từ đầu năm đến hết tháng đang xem.* Mặc định được hưởng 12 ngày (Điều 113 Bộ luật Lao động). Người có quyền *Quản lý nhân viên* bấm **Sửa số** để đổi số được hưởng, tồn năm trước (theo nửa ngày, kèm ghi chú như "+1 ngày thâm niên"); số đã nghỉ và còn lại luôn tự tính lại từ lịch (bảng `LeaveBalance`). Còn lại âm hiện màu đỏ.
- **Bảng công tháng** (tab thứ hai, khi bạn xem được nhiều người): tổng công từng người và phép còn lại; bấm tên để mở lịch người đó. **Xuất Excel** gồm trang *Bảng chấm công* (từng ngày trong tháng, Chủ nhật và ngày lễ tô màu, các cột tổng và phép năm) và trang *Chi tiết nghỉ* (ngày, buổi, loại, lý do) (`lib/export/attendance-xlsx.ts`).
- **Ngày nghỉ lễ:** người có quyền *Quản lý nhân viên* nhập ở nút **Ngày nghỉ lễ** trong bảng công tháng (bảng `Holiday`). Ngày lễ không tính là ngày làm, ghi L và vẫn tính vào công hưởng lương.

### Tìm kiếm nhanh (Ctrl+K)

Bấm **Ctrl K** (⌘ K trên Mac) ở bất kỳ trang nào, kể cả khi đang gõ trong một ô nhập, hoặc nút **Tìm kiếm…** trên thanh đầu trang (trên điện thoại là biểu tượng kính lúp).

- **Tìm gì:** dự án, công việc (theo tên), hợp đồng (mã, tên, đối tác; chỉ người có quyền *Hợp đồng & chi phí*) và nhân sự đang hoạt động (tên, chức danh); mỗi nhóm tối đa 6 kết quả, khớp ở đầu tên hoặc đầu một từ xếp trước, sau đó tới mục mới cập nhật. Dự án và công việc theo đúng quyền xem dự án. Chưa gõ gì thì hiện lối tắt tới các trang; gõ vào thì các trang khớp nằm ở nhóm *Trang*.
- **Không cần gõ dấu:** “bao cao” ra “Báo cáo”, “dao tao” ra “Đào tạo”, chữ hoa hay thường đều được. Database so khớp bằng `translate()` của Postgres với bảng chữ có dấu trong `lib/search.ts` (không cần extension `unaccent`); `%`, `_`, `\` trong từ khoá được hiểu theo nghĩa đen.
- **Bàn phím:** ↑ ↓ chọn, Home / End về đầu / cuối, Enter mở, Esc đóng. Công việc mở trang dự án kèm chi tiết công việc (`/projects/<id>?task=<id>`); hợp đồng và nhân sự mở trang tương ứng, lọc sẵn theo mã hợp đồng / tên (`?q=`).
- Mã nguồn: `app/api/search` (2–100 ký tự), `lib/search-queries.ts`, `components/layout/command-palette.tsx`.

### Trợ lý AI tích hợp (Claude API)

Quản trị viên vào *Cài đặt → Trợ lý AI (Claude API)* (`/settings#ai`) để mọi người bấm **Viết bằng AI** trên trang *Trợ lý AI*: báo cáo được viết và hiện dần ngay trên trang, không phải sao chép sang Claude.ai.

- **API key:** tạo trong [Claude Console → API Keys](https://platform.claude.com/settings/keys) (nên tạo key riêng cho WorkHub và đặt hạn mức chi tiêu trong Console), dán vào ô *API key* rồi bấm **Kiểm tra & lưu**. Key được kiểm tra với Anthropic trước khi lưu (không tốn token), nên key gõ sai không thay được key đang chạy. Tài khoản Claude.ai (Pro, Max, Team) không dùng được ở đây: Anthropic chỉ cho ứng dụng bên ngoài gọi Claude bằng API key của Console.
- **Lưu trữ:** key được mã hoá AES-256-GCM trước khi ghi vào bảng `AppSetting` (`lib/secret-box.ts`), khoá mã hoá sinh từ secret `SETTINGS_SECRET` của Worker (không có thì dùng `JWT_SECRET`). Key không bao giờ được gửi lại trình duyệt, không vào nhật ký thao tác hay bản sao lưu ở dạng đọc được; giao diện chỉ hiện 4 ký tự cuối. Đổi secret đó thì key cũ không đọc được nữa và trang Cài đặt nhắc nhập lại.
- **Tuỳ chọn:** bật / tắt, model (Opus 5.5 mặc định, Sonnet 5.5, Haiku 5.5, kèm giá niêm yết), số lượt mỗi người mỗi ngày (mặc định 30, theo giờ Việt Nam). Thẻ cài đặt hiện số báo cáo, số người dùng, token và chi phí ước tính 30 ngày qua; số tiền thực tế xem trong Console.
- **Số liệu gửi cho Claude** giống hệt prompt sao chép (`lib/ai-prompt.ts`) và theo đúng quyền của người bấm: ai chỉ xem được dự án của mình thì Claude chỉ nhận số liệu dự án đó. Tên công việc và nội dung báo cáo của nhân sự được đánh dấu là dữ liệu, không phải chỉ dẫn.
- **Nhật ký:** mỗi lần viết ghi `ai.generate` (loại báo cáo, kỳ, model, số token), mỗi câu trả lời chat ghi `ai.chat`. Mỗi lần viết, chat hoặc trích xuất file dùng một lượt trong ngày: lượt được giữ chỗ trước khi gọi Claude (bảng `AiQuota`, cập nhật nguyên tử), nên gửi nhiều yêu cầu cùng lúc cũng không vượt giới hạn; yêu cầu lỗi trước khi Claude trả lời được trả lại lượt. Mỗi lần đổi cài đặt ghi `settings.ai_update` (chỉ có 4 ký tự cuối của key).
- Mã nguồn: `app/api/settings/ai` (cài đặt, chỉ quản trị viên), `app/api/ai/report` (viết báo cáo) và `app/api/ai/chat` (chat), cùng trả về dạng stream NDJSON qua `lib/ai-run.ts` / `lib/ai-stream.ts`; `lib/ai-settings.ts`, `lib/ai-models.ts`, `lib/ai-chat.ts`.

#### Trò chuyện (chat)

Tab **Trò chuyện** trên trang *Trợ lý AI* (`/ai`) là khung chat nhiều lượt với Claude:

- **Tuỳ chọn:** *Kèm số liệu hệ thống* (bật thì Claude nhận số liệu của phạm vi và kỳ đã chọn, đúng quyền xem của người hỏi, kể cả hợp đồng khi có quyền *Hợp đồng & chi phí*), *Phạm vi* (toàn bộ hoặc một dự án), *Kỳ số liệu*, *Độ dài* (ngắn gọn / vừa phải / chi tiết) và *Người đọc* (chung, ban lãnh đạo, nội bộ nhóm, khách hàng: với khách hàng Claude được dặn không nêu chi phí, lợi nhuận, công nợ).
- **Prompt mẫu** theo nhóm Báo cáo, Phân tích, Kế hoạch, Soạn thảo, Tài chính (nhóm Tài chính chỉ hiện với người có quyền): bấm để điền sẵn câu hỏi và chọn độ dài, người đọc phù hợp; sửa thêm rồi gửi. Danh sách ở `lib/ai-chat.ts`.
- **Mỗi câu trả lời:** sao chép, tạo lại (câu cuối), lưu vào ghi chú dự án (khi đang chọn một dự án), và *Trình chiếu / xuất file* khi câu trả lời là dàn ý slide (`## Slide 1: …`). Bấm **Dừng** để ngừng giữa chừng (lượt đó vẫn được tính).
- **Lịch sử** giữ trong tab trình duyệt (sessionStorage): tải lại trang vẫn còn, đóng tab là mất, không lưu trên máy chủ. Tối đa 40 tin nhắn gần nhất được gửi kèm, mỗi tin tối đa 8.000 ký tự.
- **Chi phí:** khối số liệu và phần hội thoại đã có được cache (prompt caching), nên các câu hỏi tiếp theo trong cùng phạm vi và kỳ rẻ hơn câu đầu.
- **Trợ lý tạo và cập nhật dữ liệu:** trong chat, người dùng có thể yêu cầu “tạo dự án…, thêm hạng mục…, giao việc cho…, cập nhật trạng thái…, nhập các hợp đồng trong file…”. Claude tra cứu bằng công cụ chỉ đọc (dự án, chi tiết dự án, người dùng, hợp đồng; theo đúng quyền xem của người hỏi) rồi **đề xuất** thay đổi: tạo/sửa dự án, hạng mục, công việc, hợp đồng, thêm ghi chú (không có xoá). Đề xuất hiện thành thẻ **Đề xuất thay đổi** với từng trường mới hoặc “cũ → mới”; **không có gì được ghi cho tới khi người dùng bấm Áp dụng** (chọn từng mục; bỏ chọn một mục cha thì các mục con dùng nó cũng bỏ theo).
  - *Áp dụng* gọi đúng các API mà màn hình dùng (`app/api/ai/actions` → `app/api/projects`, `tasks`, `contracts`…), nên quyền, kiểm tra dữ liệu và nhật ký thao tác y như khi người dùng tự làm; mỗi dòng nhật ký ghi thêm “· qua Trợ lý AI”. Các mục chạy theo thứ tự; mục sau dùng được id của mục vừa tạo (`ref`); mục lỗi không hoàn tác các mục trước và được báo riêng.
  - Câu hỏi tiếp theo nhận kèm kết quả áp dụng (id mới) hoặc ghi chú “chưa áp dụng”. Mỗi câu trả lời dùng tối đa 8 bước công cụ và 100 đề xuất (đủ cho cả một kế hoạch dự án); khi áp dụng, trình duyệt gửi theo từng đợt 25 mục, mang theo các `ref` đã tạo. Áp dụng không tính vào lượt AI. Mã nguồn: `lib/ai-agent.ts` (công cụ, kiểm tra, xem trước), `lib/ai-actions.ts`, `lib/ai-run.ts` (vòng lặp công cụ), `components/ai/actions-card.tsx`.
- **File đính kèm** (PDF, ảnh, Excel, Word, CSV/TXT; 3 file, 4 MB/file): Excel, Word, CSV/TXT được chuyển thành văn bản (`lib/ai-file-content.ts`), mỗi file tối đa khoảng 200.000 ký tự và 300.000 ký tự cho cả lượt gửi. Excel chỉ liệt kê ô có dữ liệu, mỗi hàng một dòng (`Hàng 12: B=…`). File lớn hơn **không bị từ chối**: mỗi sheet giữ các hàng đầu và 3 hàng cuối (thường là dòng tổng cộng), tài liệu dài giữ phần đầu; Claude được báo phần nào bị lược bớt và câu trả lời hiện ghi chú màu vàng cho người dùng. *Trích xuất để nhập liệu* gọi tool `prepare_intake`: Haiku 5.5 được ép gọi tool, Opus 5.5 và Sonnet 5.5 không cho ép (lỗi 400) nên được yêu cầu trong prompt và hỏi lại một lần nếu trả lời bằng văn bản.

## Chạy trên máy (local)

Yêu cầu: Node.js 20+ và PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # sửa DATABASE_URL và JWT_SECRET (openssl rand -hex 32)
npx prisma migrate deploy     # tạo bảng
npm run db:seed               # (tuỳ chọn) dữ liệu mẫu
npm run dev                   # http://localhost:3000
```

Tài khoản mẫu sau khi seed (chỉ dùng cho local): `admin@crm.local` / `Admin@1234`, quản lý `cuong.le@crm.local`, trưởng nhóm `hai.do@crm.local`, nhân viên được cấp quyền tạo dự án `dung.pham@crm.local`, nhân viên `em.hoang@crm.local` (mật khẩu `Demo@1234`).

Seed từ chối chạy nếu database đã có người dùng; `SEED_FORCE=1 npm run db:seed` sẽ **xoá toàn bộ dữ liệu** rồi tạo lại — không bao giờ dùng trên production.

Tạo quản trị viên đầu tiên cho database trống (không có dữ liệu mẫu):

```bash
npm run admin:create -- admin "Quản trị viên" "MatKhauTam123"   # đăng nhập bằng email hoặc tên đăng nhập
```

Chạy thử đúng runtime của Cloudflare trên máy: `cp .dev.vars.example .dev.vars` rồi `npm run preview`.

## Triển khai lên Cloudflare

**Build production trên Linux.** Nếu thao tác từ Windows, dùng artifact Linux đã qua kiểm tra runtime trên CI; không build lại OpenNext trên Windows. Xem [quy trình phát hành](docs/production-release.md).

Kiến trúc: **Cloudflare Workers** chạy app (qua OpenNext) → **Hyperdrive** (gom kết nối, TLS) → **Supabase PostgreSQL** (Singapore).

**Đang chạy tại: https://crm.votranlong91.workers.dev** (Worker `crm`, subdomain tài khoản `votranlong91`). Muốn đổi thành `crm.bu4cdimex.workers.dev`: Cloudflare → *Workers & Pages* → **Change** cạnh *Your subdomain* → nhập `bu4cdimex`. Không cần deploy lại; API của Cloudflare không cho đổi subdomain đã có (lỗi 10036) nên việc này làm trên dashboard.

> **Cần gói Workers Paid.** Gói Free giới hạn 10 ms CPU mỗi request, còn băm mật khẩu an toàn (bcrypt) cần khoảng 300 ms.

Database Supabase `crm-bu4` đã có schema, đã khoá Data API công khai (`prisma/supabase-hardening.sql`) và có role riêng `crm_app` chỉ đọc/ghi dữ liệu (`prisma/supabase-app-role.sql`). Hyperdrive `crm-db` (tắt cache) kết nối tới database bằng role `crm_app`; ID của nó đã nằm trong `wrangler.jsonc`.

### Cách 1 — Script tự động (khuyến nghị)

1. Tạo API token: Cloudflare → *My Profile → API Tokens → Create Token* → mẫu **Edit Cloudflare Workers**, thêm quyền **Account › Hyperdrive › Edit** → tạo.
2. Tạo mật khẩu cho role `crm_app` mà mật khẩu gốc không xuất hiện ở đâu ngoài file tạm:
   ```bash
   node scripts/gen-db-credential.mjs /tmp/crm-db-pass   # in ra SCRAM verifier
   ```
   Chạy `ALTER ROLE crm_app WITH LOGIN PASSWORD '<verifier>';` trong Supabase SQL Editor.
3. Deploy (đăng ký subdomain nếu tài khoản chưa có, tạo Hyperdrive tắt cache, tạo `JWT_SECRET`, build và deploy):
   ```bash
   export CLOUDFLARE_API_TOKEN=...   # token ở bước 1
   HYPERDRIVE_ORIGIN_URL="postgres://crm_app:$(cat /tmp/crm-db-pass)@db.djxiylyilhwycscnjnkq.supabase.co:5432/postgres" \
     bash scripts/deploy-cloudflare.sh && rm /tmp/crm-db-pass
   ```
   Nếu Hyperdrive không kết nối được host direct (IPv6), dùng Session pooler của Supabase: host `aws-1-ap-southeast-1.pooler.supabase.com` (hoặc `aws-0-…`), cổng `5432`, user `crm_app.djxiylyilhwycscnjnkq`.
4. Commit `wrangler.jsonc` nếu ID Hyperdrive thay đổi. Các lần sau chỉ cần `CLOUDFLARE_API_TOKEN=... bash scripts/deploy-cloudflare.sh` (hoặc `npm run deploy` khi đã `wrangler login`): script bỏ qua các bước đã làm và giữ nguyên `JWT_SECRET`.

### Cách 2 — Workers Builds (tự deploy mỗi lần push)

Sau khi đã có Hyperdrive và ID trong `wrangler.jsonc` (cách 1, hoặc tạo trên dashboard *Storage & Databases → Hyperdrive* với **Caching tắt**): *Workers & Pages → Create → Import a repository* → `thankyouu91/CRM-BU4`, project name `crm`, build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`. Thêm secret `JWT_SECRET` (≥ 32 ký tự ngẫu nhiên) trong *Settings → Variables and Secrets* nếu chưa có.

### Vận hành

- **Đổi schema:** `npx prisma migrate dev` trên máy → commit → `DATABASE_URL="<connection string của postgres>" npx prisma migrate deploy`. Bảng mới cần `ENABLE ROW LEVEL SECURITY` và policy cho `crm_app`.
- **Chạy thử runtime Cloudflare trên máy:** `npm run preview` dùng `localConnectionString` của binding Hyperdrive (Postgres local theo `.env.example`); muốn trỏ chỗ khác thì đặt `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.
- **Supabase gói Free** tự tạm dừng project sau 7 ngày không hoạt động; bật lại trong Supabase Dashboard nếu cần.

### Sao lưu & khôi phục

- **Tự động mỗi ngày lúc 2:00 (giờ Việt Nam)**: cron của Worker (`worker.ts` → `lib/maintenance.ts`) xuất mọi bảng ra JSON nén vào bucket R2 `crm-backups`: `daily/YYYY-MM-DD.json.gz` (giữ 30 bản) và `monthly/YYYY-MM.json.gz` vào ngày 1 (giữ 12 bản). File PDF hợp đồng không nằm trong bản sao lưu vì đã ở R2. Cần bật R2; nếu chưa, bước sao lưu được bỏ qua (xem log của Worker).
- **Xem và tải:** quản trị viên vào *Cài đặt → Sao lưu dữ liệu*. Mỗi lần tải được ghi vào nhật ký thao tác.
- **Khôi phục** vào một database trống:
  1. `DATABASE_URL="<database mới>" npx prisma migrate deploy`
  2. `DATABASE_URL="<database mới>" node scripts/restore-backup.mjs daily-2026-10-09.json.gz` (chạy trong một transaction; từ chối nếu bảng đã có dữ liệu)
  3. Trên Supabase, chạy lại `prisma/supabase-hardening.sql` và cấp quyền cho `crm_app`.
- Bản sao lưu đọc mọi bảng từ cùng một thời điểm (transaction REPEATABLE READ), nên dữ liệu ghi trong lúc sao lưu không làm file thiếu dòng cha.
- **Đã kiểm thử khôi phục:** `tests/backup-restore.integration.test.ts` (chạy trong CI) sao lưu database kiểm thử như tác vụ hằng ngày, khôi phục bằng `scripts/restore-backup.mjs` vào một database mới và so từng bảng (cả task cha/con, số tiền lớn, JSON); chạy lại lần hai phải bị từ chối.
- Cùng tác vụ hằng ngày xoá nhật ký thao tác cũ hơn 365 ngày, thông báo cũ hơn 90 ngày và bộ đếm lượt AI của các ngày đã qua.

### Nhật ký thao tác

- Mọi thao tác thay đổi dữ liệu quan trọng được ghi vào bảng `AuditLog`: đăng nhập (kể cả thất bại), đổi mật khẩu, tài khoản & phân quyền, dự án, hạng mục, công việc, báo cáo, hợp đồng, file hợp đồng, báo cáo tuần/tháng, chấm công, phép năm, ngày nghỉ lễ, quản lý trực tiếp, tải bản sao lưu. Mỗi dòng có người thực hiện, thời gian, IP, mô tả và chi tiết trường thay đổi (không bao giờ có mật khẩu).
- Chỉ **quản trị viên** xem được: *Cài đặt → Nhật ký thao tác* (`/settings/audit-log`), lọc theo nhóm, thao tác, người, ngày và nội dung.
- Ghi log từ API bằng `audit(...)` trong `lib/audit.ts`; danh sách thao tác ở `lib/audit-actions.ts`. Vai trò `crm_app` chỉ có quyền đọc, thêm và xoá (theo hạn lưu trữ) trên bảng này, không sửa được dòng nào.

### Kiểm thử & CI

- `npm test` chạy unit test (Vitest, thư mục `tests/`) cho phân quyền, tài chính, tiến độ, báo cáo tuần/tháng, file hợp đồng và sao lưu.
- GitHub Actions (`.github/workflows/ci.yml`) chạy trên mỗi push và pull request: lint, kiểm tra kiểu, unit test, `npm audit` cho thư viện production, build OpenNext và đóng gói Worker (dry run).
- Thư viện có lỗ hổng được ép lên bản đã vá bằng `overrides` trong `package.json` (`postcss`, `image-size`, `deepmerge-ts`, và `glob` của `@node-minify/core` mà OpenNext dùng lúc build). Còn lại vài cảnh báo trong công cụ build (tailwind 3, eslint-config-next): chỉ chạy lúc build trên mã của dự án, không có trên trang thật.

### Hiệu năng

- **Worker chạy cạnh database:** `placement` trong `wrangler.jsonc` đặt Worker ở `aws:ap-southeast-1` (Singapore, cùng vùng Supabase), mỗi truy vấn chỉ còn vài ms. Đổi vùng Supabase thì đổi luôn giá trị này.
- **Ít truy vấn:** Prisma bật `relationJoins`, nên `include` lồng nhau thành một câu SQL; quyền truy cập dự án được tính từ dữ liệu đã tải (`accessFrom`, `loadTaskForUser`), không truy vấn thêm.
- **Trang gửi kèm dữ liệu:** các trang dự án, công việc, hộp báo cáo, báo cáo và hợp đồng tải dữ liệu trên server và truyền cho view (`useApi(url, { initial })`), không cần request thứ hai. Dữ liệu từng xem được nhớ theo URL và làm mới ngầm.
- **Thao tác tức thì:** thay đổi công việc trong dự án đi qua `send` (`components/projects/use-workspace.ts`): màn hình cập nhật ngay, request gửi kèm `?include=workspace` và nhận lại toàn bộ dự án đã cập nhật trong cùng câu trả lời; lỗi thì hoàn tác.
- **Đo số truy vấn trên máy:** chạy `PRISMA_QUERY_LOG=1 npm run dev` để in mọi truy vấn.

## Bảo mật

- Mật khẩu băm bằng bcrypt (cost 12); chính sách tối thiểu 8 ký tự, có chữ hoa, chữ thường, chữ số.
- Phiên đăng nhập bằng JWT ký HS256 trong cookie `httpOnly`, `SameSite=Lax`, `Secure` trên production; hết hạn sau 7 ngày.
- Tài khoản mới hoặc bị đặt lại mật khẩu **bắt buộc đổi mật khẩu** ở lần đăng nhập đầu.
- Đổi mật khẩu, đổi email/tên đăng nhập, đổi vai trò hoặc vô hiệu hoá tài khoản sẽ **thu hồi mọi phiên đăng nhập** của người đó.
- Chống dò mật khẩu: Workers Rate Limiting (5 lần/phút theo tài khoản + IP, 30 lần/phút theo IP); thời gian phản hồi không làm lộ email nào tồn tại.
- Chặn CSRF bằng kiểm tra `Origin` cho mọi request thay đổi dữ liệu; header bảo mật (`Content-Security-Policy`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- **CSP** (`next.config.mjs`): chỉ tải script, style, ảnh, font và kết nối từ chính trang; cấm plugin, nhúng trang vào iframe và gửi form ra ngoài. Next.js cần script nội tuyến nên cho phép `'unsafe-inline'`, nhưng không nguồn ngoài nào được tải.
- **Nhật ký thao tác** cho quản trị viên (xem *Vận hành*).
- **Claude API key** mã hoá AES-256-GCM trong database, chỉ quản trị viên đổi được, không bao giờ trả về trình duyệt (xem [Trợ lý AI tích hợp](#trợ-lý-ai-tích-hợp-claude-api)).
- Không cho quản trị viên tự hạ quyền/vô hiệu hoá chính mình; hệ thống luôn còn ít nhất một quản trị viên.
- Supabase: bật RLS và thu hồi quyền của `anon`/`authenticated`, nên Data API công khai không đọc/ghi được bảng nào.

## Cấu trúc thư mục

```
app/(app)/        Các trang sau đăng nhập: dashboard, projects, tasks, attendance, inbox, reports, ai, team, settings
app/api/          API (auth, users, projects, categories, tasks, reports, notes)
app/present/      Trang trình chiếu online (cần đăng nhập)
app/share/        Trang trình chiếu qua link công khai (không cần đăng nhập)
components/       UI, biểu đồ, bộ slide (deck/), task drawer, dự án
lib/              prisma, phiên đăng nhập, phân quyền, thống kê theo kỳ, deck model, xuất PDF/PPTX, prompt AI
prisma/           schema, migrations, seed, tạo admin, SQL bảo mật Supabase
tests/            Unit test (Vitest)
worker.ts         Điểm vào Worker: ứng dụng OpenNext + cron sao lưu hằng ngày
wrangler.jsonc    Cấu hình Cloudflare Worker
scripts/          Deploy Cloudflare, tạo mật khẩu database (SCRAM), khôi phục bản sao lưu
```

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev (Node.js) |
| `npm run build` / `npm start` | Build & chạy production trên Node.js |
| `npm run preview` | Build cho Cloudflare và chạy thử bằng runtime `workerd` trên máy |
| `npm run deploy` | Build & deploy bằng Wrangler (cần đăng nhập Cloudflare) |
| `npm run typecheck` / `npm run lint` | Kiểm tra TypeScript / ESLint (ESLint CLI, cấu hình `eslint.config.mjs`) |
| `npm test` | Unit test (Vitest) |
| `npm run db:seed` / `npm run admin:create` | Dữ liệu mẫu / tạo quản trị viên |
