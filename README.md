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

## Triển khai lên Cloudflare

Kiến trúc: **Cloudflare Workers** chạy app (qua OpenNext) → **Hyperdrive** (gom kết nối, TLS) → **Supabase PostgreSQL** (Singapore). Địa chỉ: **https://crm.bu4cdimex.workers.dev** (Worker `crm`, subdomain tài khoản `bu4cdimex`).

> **Cần gói Workers Paid.** Gói Free giới hạn 10 ms CPU mỗi request, còn băm mật khẩu an toàn (bcrypt) cần khoảng 300 ms.

Database Supabase `crm-bu4` đã có schema, đã khoá Data API công khai (`prisma/supabase-hardening.sql`) và có role riêng `crm_app` chỉ đọc/ghi dữ liệu (`prisma/supabase-app-role.sql`).

### Cách 1 — Script tự động (khuyến nghị)

1. Tạo API token: Cloudflare → *My Profile → API Tokens → Create Token* → mẫu **Edit Cloudflare Workers**, thêm quyền **Account › Hyperdrive › Edit** → tạo.
2. Tạo mật khẩu cho role `crm_app` mà mật khẩu gốc không xuất hiện ở đâu ngoài file tạm:
   ```bash
   node scripts/gen-db-credential.mjs /tmp/crm-db-pass   # in ra SCRAM verifier
   ```
   Chạy `ALTER ROLE crm_app WITH LOGIN PASSWORD '<verifier>';` trong Supabase SQL Editor.
3. Deploy (tự đăng ký subdomain, tạo Hyperdrive tắt cache, tạo `JWT_SECRET`, build và deploy):
   ```bash
   export CLOUDFLARE_API_TOKEN=...   # token ở bước 1
   HYPERDRIVE_ORIGIN_URL="postgres://crm_app:$(cat /tmp/crm-db-pass)@db.djxiylyilhwycscnjnkq.supabase.co:5432/postgres" \
     bash scripts/deploy-cloudflare.sh && rm /tmp/crm-db-pass
   ```
   Nếu Hyperdrive không kết nối được host direct (IPv6), dùng Session pooler của Supabase: host `aws-1-ap-southeast-1.pooler.supabase.com` (hoặc `aws-0-…`), cổng `5432`, user `crm_app.djxiylyilhwycscnjnkq`.
4. Commit `wrangler.jsonc` (đã được điền ID Hyperdrive). Các lần sau chỉ cần `bash scripts/deploy-cloudflare.sh` — script bỏ qua các bước đã làm và giữ nguyên `JWT_SECRET`.

### Cách 2 — Workers Builds (tự deploy mỗi lần push)

Sau khi đã có Hyperdrive và ID trong `wrangler.jsonc` (cách 1, hoặc tạo trên dashboard *Storage & Databases → Hyperdrive* với **Caching tắt**): *Workers & Pages → Create → Import a repository* → `thankyouu91/CRM-BU4`, project name `crm`, build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`. Thêm secret `JWT_SECRET` (≥ 32 ký tự ngẫu nhiên) trong *Settings → Variables and Secrets* nếu chưa có.

### Vận hành

- **Đổi schema:** `npx prisma migrate dev` trên máy → commit → `DATABASE_URL="<connection string của postgres>" npx prisma migrate deploy`. Bảng mới cần `ENABLE ROW LEVEL SECURITY` và policy cho `crm_app`.
- **Chạy thử runtime Cloudflare trên máy khi đã bật Hyperdrive:** đặt biến môi trường `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` trỏ tới Postgres local trước `npm run preview`.
- **Supabase gói Free** tự tạm dừng project sau 7 ngày không hoạt động; bật lại trong Supabase Dashboard nếu cần.

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
