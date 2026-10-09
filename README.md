# WorkHub — Quản lý công việc, báo cáo & trình chiếu

Dashboard quản lý dự án và công việc cho doanh nghiệp: giao việc theo hạng mục, task con và người phụ trách (PIC), báo cáo tiến độ gửi về quản lý, biểu đồ theo dõi, xuất PDF/PowerPoint, trình chiếu trực tuyến và trợ lý AI tạo báo cáo cùng Claude.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma 6 + PostgreSQL · Recharts · Framer Motion · triển khai trên Cloudflare Workers (OpenNext) + Supabase.

## Tính năng

| # | Yêu cầu | Đã có |
|---|---|---|
| 1 | Task, hạng mục, task con, PIC, báo cáo người thực hiện → quản lý | Dự án → hạng mục → task → task con (nhiều cấp); giao PIC; xem dạng danh sách hoặc Kanban kéo-thả; người phụ trách gửi báo cáo (nội dung, % tiến độ, giờ làm); báo cáo vào **Hộp báo cáo** của quản lý để xem, nhận xét, **duyệt hoàn thành** |
| 2 | Xuất PDF / trình chiếu như PPTX với hiệu ứng mượt | Bộ slide tự động từ số liệu; trình chiếu toàn màn hình với 4 hiệu ứng (trượt, mờ dần, phóng to, lật 3D), tự chạy, xem tổng quan, phím tắt; xuất **PDF** và **PowerPoint gốc, chỉnh sửa được** (biểu đồ PowerPoint thật, có hiệu ứng chuyển slide); link trình chiếu online `/present` |
| 3 | Lọc theo ngày – tháng – quý – năm | Bộ lọc Ngày / Tháng / Quý / Năm / Tuỳ chọn, chuyển kỳ trước/sau; ranh giới kỳ tính theo múi giờ doanh nghiệp (`APP_TIMEZONE`) |
| 4 | UI/UX thân thiện, chuyên nghiệp | Giao diện sáng/tối, responsive, tiếng Việt; bảng màu biểu đồ đã kiểm tra cho người mù màu; mỗi biểu đồ có chế độ xem bảng |
| 5 | Đăng nhập, tạo tài khoản, đổi mật khẩu, bảo mật | Xem mục [Bảo mật](#bảo-mật) |
| 6 | Ghi chú / phản hồi cho từng dự án | Tab “Ghi chú & phản hồi” trong mỗi dự án |
| 7 | Theo dõi dự án với biểu đồ, % hoàn thành | Dashboard KPI, vòng tiến độ, xu hướng, phân bổ trạng thái, khối lượng theo nhân sự; tab “Tiến độ” có timeline (Gantt) và % theo hạng mục |
| 8 | AI hỗ trợ báo cáo, tích hợp Claude không qua API | Trang **Trợ lý AI**: đóng gói số liệu thật thành prompt → mở Claude.ai điền sẵn / sao chép / tải file cho Claude Code → dán kết quả lại để xem trước, lưu ghi chú dự án, hoặc biến dàn ý thành slide để trình chiếu & xuất file. Không cần API key, không tốn phí API |

**Vai trò:** Quản trị viên (toàn quyền, quản lý tài khoản) · Quản lý (tạo dự án, giao việc, duyệt báo cáo) · Nhân viên (thực hiện việc được giao, gửi báo cáo). Phân quyền được kiểm tra ở phía server cho mọi API.

## Chạy trên máy (local)

Yêu cầu: Node.js 20+ và PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # sửa DATABASE_URL và JWT_SECRET (openssl rand -hex 32)
npx prisma migrate deploy     # tạo bảng
npm run db:seed               # (tuỳ chọn) dữ liệu mẫu
npm run dev                   # http://localhost:3000
```

Tài khoản mẫu sau khi seed (chỉ dùng cho local): `admin@crm.local` / `Admin@1234`, quản lý `cuong.le@crm.local` / `Demo@1234`, nhân viên `hai.do@crm.local` / `Demo@1234`.

Seed từ chối chạy nếu database đã có người dùng; `SEED_FORCE=1 npm run db:seed` sẽ **xoá toàn bộ dữ liệu** rồi tạo lại — không bao giờ dùng trên production.

Tạo quản trị viên đầu tiên cho database trống (không có dữ liệu mẫu):

```bash
npm run admin:create -- admin "Quản trị viên" "MatKhauTam123"   # đăng nhập bằng email hoặc tên đăng nhập
```

Chạy thử đúng runtime của Cloudflare trên máy: `cp .dev.vars.example .dev.vars` rồi `npm run preview`.

## Triển khai lên Cloudflare (Workers Builds)

Kiến trúc: **Cloudflare Workers** chạy app (qua OpenNext) → **Hyperdrive** (gom kết nối, mã hoá TLS) → **Supabase PostgreSQL** (Singapore).

> **Cần gói Workers Paid (5 USD/tháng).** Gói Free giới hạn 10 ms CPU mỗi request, trong khi băm mật khẩu an toàn (bcrypt) cần khoảng 300 ms — đăng nhập sẽ lỗi trên gói Free. Gói Paid cũng nâng giới hạn dung lượng Worker từ 3 MB lên 10 MB (bản build hiện tại ≈ 2,9 MB nén).

Database Supabase `crm-bu4` đã được tạo sẵn, đã chạy migration, khoá Data API công khai và có tài khoản quản trị. Các bước còn lại thực hiện trên dashboard:

1. **Lấy chuỗi kết nối Supabase.** Supabase Dashboard → project `crm-bu4` → *Project Settings → Database* → **Reset database password** (lưu lại mật khẩu). Bấm **Connect** → chọn **Direct connection** → sao chép URI và thay `[YOUR-PASSWORD]`.
2. **Tạo Hyperdrive.** Cloudflare Dashboard → *Storage & Databases → Hyperdrive* → **Create configuration**: tên `crm-bu4-db`, dán chuỗi kết nối ở bước 1, và **tắt Caching** (bắt buộc — nếu bật, dữ liệu vừa tạo có thể không hiện trong tối đa 60 giây). Sao chép **ID** của Hyperdrive.
3. **Khai báo Hyperdrive trong code.** Trong `wrangler.jsonc`, bỏ comment dòng `"hyperdrive"` và điền ID (thêm dấu phẩy sau mảng `ratelimits`), rồi commit & push.
4. **Kết nối GitHub.** *Workers & Pages → Create → Import a repository* → chọn `thankyouu91/CRM-BU4`:
   - Project name: `crm-bu4` (phải trùng `name` trong `wrangler.jsonc`)
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Production branch: nhánh chứa code này
5. **Thêm secret.** Worker `crm-bu4` → *Settings → Variables and Secrets* → thêm **Secret** `JWT_SECRET` = chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -hex 32` hoặc trình quản lý mật khẩu). `APP_TIMEZONE` đã có sẵn trong `wrangler.jsonc`.
   *Không dùng Hyperdrive?* Thêm secret `DATABASE_URL` = chuỗi **Transaction pooler** của Supabase thay cho bước 2–3.
6. **Deploy lại** (*Deployments → Retry*, hoặc push một commit). App chạy tại `https://crm-bu4.<subdomain>.workers.dev`.

Từ đó mỗi lần push lên production branch, Cloudflare tự build và deploy; các nhánh khác có URL xem trước riêng.

**Thay đổi schema sau này:** `npx prisma migrate dev` trên máy → commit → chạy `DATABASE_URL="<direct connection>" npx prisma migrate deploy` lên Supabase. Bảng mới cần `ENABLE ROW LEVEL SECURITY` (xem `prisma/supabase-hardening.sql`).

**Lưu ý gói Free của Supabase:** project tự tạm dừng sau 7 ngày không có hoạt động; mở lại trong Supabase Dashboard nếu bị dừng.

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
