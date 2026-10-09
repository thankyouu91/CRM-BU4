# WorkHub — Quản lý công việc, báo cáo & trình chiếu

Dashboard quản lý dự án và công việc cho doanh nghiệp: giao việc theo hạng mục, task con và người phụ trách (PIC), báo cáo tiến độ gửi về quản lý, biểu đồ theo dõi, xuất PDF/PowerPoint, trình chiếu trực tuyến và trợ lý AI tạo báo cáo cùng Claude.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma 6 + PostgreSQL · Recharts · Framer Motion · triển khai trên Cloudflare Workers (OpenNext) + Supabase.

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
| 9 | Báo cáo hợp đồng & chi phí (thay file Excel) | Trang **Hợp đồng & chi phí**: giá trị HĐ, chi phí đào tạo / khảo thí / khác, lợi nhuận gộp, tỷ suất LN, đánh giá, đã thu, còn phải thu, trạng thái thanh toán — tính tự động; lọc theo tháng/quý/năm, dòng tổng, 4 ô tổng hợp như mẫu Excel; **dán dữ liệu từ Excel** để nhập nhanh và **xuất Excel** đúng bố cục mẫu |
| 8 | AI hỗ trợ báo cáo, tích hợp Claude không qua API | Trang **Trợ lý AI**: đóng gói số liệu thật thành prompt → mở Claude.ai điền sẵn / sao chép / tải file cho Claude Code → dán kết quả lại để xem trước, lưu ghi chú dự án, hoặc biến dàn ý thành slide để trình chiếu & xuất file. Không cần API key, không tốn phí API |
| 10 | Báo cáo tuần trước đã làm, tuần này / tuần tới (hoặc tháng) làm gì, gửi sếp | Tab **Báo cáo tuần / tháng** trong *Công việc của tôi*: ba mục lấy trực tiếp từ công việc và dự án của bạn, ghi chú tự lưu, gửi cấp trên, xuất Excel và in / lưu PDF; cấp trên xem cả đội trong *Hộp báo cáo*. Xem [Báo cáo công việc tuần / tháng](#báo-cáo-công-việc-tuần--tháng) |

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

### Tiến độ theo deadline

*Kế hoạch đến hôm nay* = phần thời gian đã trôi qua giữa ngày bắt đầu và hạn hoàn thành (giả định công việc tiến triển đều). So sánh với tiến độ thực tế: chậm không quá 10 điểm là **Đúng tiến độ**, 10–25 điểm là **Có rủi ro**, hơn 25 điểm là **Chậm tiến độ**, qua hạn mà chưa xong là **Trễ hạn**. *Đạt KH* = thực tế ÷ kế hoạch. Hạng mục lớn tính cả công việc của các hạng mục con; hạng mục chưa có ngày bắt đầu dùng ngày bắt đầu của hạng mục lớn hoặc của dự án (`lib/schedule.ts`).

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
- Chặn CSRF bằng kiểm tra `Origin` cho mọi request thay đổi dữ liệu; header bảo mật (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- Không cho quản trị viên tự hạ quyền/vô hiệu hoá chính mình; hệ thống luôn còn ít nhất một quản trị viên.
- Supabase: bật RLS và thu hồi quyền của `anon`/`authenticated`, nên Data API công khai không đọc/ghi được bảng nào.

## Cấu trúc thư mục

```
app/(app)/        Các trang sau đăng nhập: dashboard, projects, tasks, inbox, reports, ai, team, settings
app/api/          API (auth, users, projects, categories, tasks, reports, notes)
app/present/      Trang trình chiếu online
components/       UI, biểu đồ, bộ slide (deck/), task drawer, dự án
lib/              prisma, phiên đăng nhập, phân quyền, thống kê theo kỳ, deck model, xuất PDF/PPTX, prompt AI
prisma/           schema, migrations, seed, tạo admin, SQL bảo mật Supabase
wrangler.jsonc    Cấu hình Cloudflare Worker
scripts/          Deploy Cloudflare, tạo mật khẩu database (SCRAM)
```

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev (Node.js) |
| `npm run build` / `npm start` | Build & chạy production trên Node.js |
| `npm run preview` | Build cho Cloudflare và chạy thử bằng runtime `workerd` trên máy |
| `npm run deploy` | Build & deploy bằng Wrangler (cần đăng nhập Cloudflare) |
| `npm run typecheck` / `npm run lint` | Kiểm tra TypeScript / ESLint |
| `npm run db:seed` / `npm run admin:create` | Dữ liệu mẫu / tạo quản trị viên |
