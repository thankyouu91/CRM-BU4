/**
 * Demo data for local development: users, 4 projects with categories, a task
 * tree with subtasks, progress reports and notes. All dates are relative to
 * "now" so every day/month/quarter/year report filter has data to show.
 *
 * Safety: refuses to run when users already exist unless SEED_FORCE=1, in which
 * case ALL existing data is deleted first. Never run with SEED_FORCE on production.
 */
import { PrismaClient, type Prisma, type Priority, type TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildSections, shiftWorkPeriod, takeSnapshot, workPeriodOf, type WorkNotes, type WorkPeriod } from "../lib/work-report";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);
const daysFromNow = (n: number) => new Date(now + n * DAY);

// Deterministic PRNG so the demo looks the same on every seed.
let seed = 20261009;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const USERS = {
  an: { email: "admin@crm.local", name: "Nguyễn Văn An", role: "ADMIN", jobTitle: "Giám đốc vận hành", color: "#6366f1" },
  binh: { email: "binh.tran@crm.local", name: "Trần Thị Bình", role: "MANAGER", jobTitle: "Trưởng phòng Marketing", color: "#ec4899" },
  cuong: { email: "cuong.le@crm.local", name: "Lê Minh Cường", role: "MANAGER", jobTitle: "Trưởng phòng Kỹ thuật", color: "#3b82f6" },
  // Nhân viên được quản lý cấp thêm quyền tạo dự án.
  dung: { email: "dung.pham@crm.local", name: "Phạm Thu Dung", role: "MEMBER", jobTitle: "UI/UX Designer", color: "#a855f7", permissions: ["PROJECT_CREATE"] },
  em: { email: "em.hoang@crm.local", name: "Hoàng Văn Em", role: "MEMBER", jobTitle: "Frontend Developer", color: "#22c55e" },
  giang: { email: "giang.vu@crm.local", name: "Vũ Hương Giang", role: "MEMBER", jobTitle: "Content Marketing", color: "#f59e0b" },
  hai: { email: "hai.do@crm.local", name: "Đỗ Quang Hải", role: "LEAD", jobTitle: "Trưởng nhóm Backend", color: "#14b8a6" },
  lan: { email: "lan.bui@crm.local", name: "Bùi Ngọc Lan", role: "MEMBER", jobTitle: "Sales Executive", color: "#f97316" },
} as const;
type UserKey = keyof typeof USERS;

// ---------------------------------------------------------------------------
// Task tree DSL
//   c: created N days ago · d: due in N days (negative = past) · done: completed N days ago
// ---------------------------------------------------------------------------
interface T {
  t: string;
  who?: UserKey;
  st: TaskStatus;
  p?: number;
  pr?: Priority;
  c: number;
  d?: number;
  done?: number;
  desc?: string;
  subs?: T[];
}

interface P {
  name: string;
  desc: string;
  owner: UserKey;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  color: string;
  start: number;
  due: number;
  members: UserKey[];
  categories: { name: string; color: string; tasks: T[] }[];
  notes: { who: UserKey; type: "NOTE" | "FEEDBACK"; c: number; text: string }[];
}

const PROJECTS: P[] = [
  {
    name: "Ra mắt website thương hiệu mới",
    desc: "Thiết kế lại và phát triển website thương hiệu kèm cửa hàng trực tuyến, tích hợp thanh toán nội địa.",
    owner: "cuong",
    status: "ACTIVE",
    color: "#3b82f6",
    start: 150,
    due: 30,
    members: ["cuong", "dung", "em", "hai", "lan"],
    categories: [
      {
        name: "Thiết kế UI/UX",
        color: "#a855f7",
        tasks: [
          {
            t: "Nghiên cứu người dùng & persona", who: "dung", st: "DONE", c: 148, d: -120, done: 125, pr: "HIGH",
            subs: [
              { t: "Phỏng vấn 10 khách hàng mục tiêu", who: "dung", st: "DONE", c: 148, d: -135, done: 136 },
              { t: "Tổng hợp insight & xây dựng persona", who: "dung", st: "DONE", c: 140, d: -125, done: 126 },
            ],
          },
          { t: "Wireframe toàn bộ trang", who: "dung", st: "DONE", c: 125, d: -95, done: 98 },
          {
            t: "Thiết kế Design System", who: "dung", st: "DONE", c: 100, d: -70, done: 72,
            subs: [
              { t: "Bảng màu & typography", who: "dung", st: "DONE", c: 100, d: -88, done: 90 },
              { t: "Thư viện component", who: "dung", st: "DONE", c: 95, d: -72, done: 73 },
            ],
          },
          { t: "Thiết kế giao diện mobile", who: "dung", st: "REVIEW", p: 100, c: 40, d: -2, pr: "HIGH" },
        ],
      },
      {
        name: "Phát triển Frontend",
        color: "#22c55e",
        tasks: [
          { t: "Dựng khung dự án Next.js", who: "em", st: "DONE", c: 90, d: -80, done: 84 },
          { t: "Trang chủ & landing page", who: "em", st: "DONE", c: 80, d: -50, done: 55, pr: "HIGH" },
          {
            t: "Trang sản phẩm & danh mục", who: "hai", st: "IN_PROGRESS", p: 70, c: 50, d: 7, pr: "HIGH",
            subs: [
              { t: "Bộ lọc & tìm kiếm sản phẩm", who: "hai", st: "DONE", c: 50, d: -4, done: 6 },
              { t: "Trang chi tiết sản phẩm", who: "hai", st: "IN_PROGRESS", p: 60, c: 45, d: 5 },
              { t: "Tối ưu hình ảnh & lazy-load", who: "em", st: "TODO", c: 30, d: 12, pr: "LOW" },
            ],
          },
          { t: "Responsive & accessibility", who: "em", st: "TODO", c: 20, d: 20 },
        ],
      },
      {
        name: "Backend & API",
        color: "#14b8a6",
        tasks: [
          { t: "Thiết kế cơ sở dữ liệu", who: "hai", st: "DONE", c: 95, d: -75, done: 78, pr: "HIGH" },
          {
            t: "API giỏ hàng & thanh toán", who: "hai", st: "IN_PROGRESS", p: 45, c: 40, d: -3, pr: "URGENT",
            subs: [
              { t: "Tích hợp cổng VNPay", who: "hai", st: "IN_PROGRESS", p: 50, c: 38, d: -3, pr: "URGENT" },
              { t: "Tích hợp ví MoMo", who: "hai", st: "TODO", c: 38, d: 6, pr: "HIGH" },
            ],
          },
          {
            t: "Tích hợp CMS quản lý nội dung", who: "em", st: "BLOCKED", p: 30, c: 35, d: 4,
            desc: "Đang chờ phòng Marketing chốt cấu trúc nội dung.",
          },
        ],
      },
      {
        name: "Kiểm thử & Triển khai",
        color: "#f59e0b",
        tasks: [
          { t: "Viết test E2E các luồng chính", who: "em", st: "TODO", c: 15, d: 18 },
          { t: "Cấu hình CI/CD & hosting", who: "hai", st: "TODO", c: 10, d: 25 },
          { t: "UAT với phòng kinh doanh", who: "lan", st: "TODO", c: 5, d: 28 },
        ],
      },
    ],
    notes: [
      { who: "cuong", type: "NOTE", c: 120, text: "Chốt phạm vi giai đoạn 1: website thương hiệu + cửa hàng, chưa làm app mobile." },
      { who: "an", type: "FEEDBACK", c: 70, text: "Design System rất tốt. Đề nghị bổ sung chế độ tối (dark mode) cho trang tài khoản khách hàng." },
      { who: "lan", type: "FEEDBACK", c: 12, text: "Khách hàng thử nghiệm phản hồi bộ lọc sản phẩm dễ dùng, nhưng cần thêm lọc theo khoảng giá." },
      { who: "cuong", type: "NOTE", c: 3, text: "Thanh toán VNPay trễ hạn do chờ cấp tài khoản sandbox. Đã liên hệ đối tác, dự kiến xong trong tuần." },
    ],
  },
  {
    name: "Chiến dịch Marketing Q4",
    desc: "Chiến dịch tích hợp đa kênh cho mùa mua sắm cuối năm: nội dung, quảng cáo số và sự kiện ra mắt.",
    owner: "binh",
    status: "ACTIVE",
    color: "#ec4899",
    start: 60,
    due: 60,
    members: ["binh", "giang", "dung", "lan"],
    categories: [
      {
        name: "Nghiên cứu thị trường",
        color: "#6366f1",
        tasks: [
          { t: "Khảo sát đối thủ cạnh tranh", who: "giang", st: "DONE", c: 58, d: -40, done: 42 },
          { t: "Phân tích insight khách hàng mục tiêu", who: "giang", st: "DONE", c: 50, d: -30, done: 33, pr: "HIGH" },
        ],
      },
      {
        name: "Sản xuất nội dung",
        color: "#ec4899",
        tasks: [
          { t: "Kế hoạch nội dung 3 tháng", who: "giang", st: "DONE", c: 40, d: -25, done: 27 },
          {
            t: "Bộ ảnh & video chiến dịch", who: "dung", st: "IN_PROGRESS", p: 55, c: 30, d: 10, pr: "HIGH",
            subs: [
              { t: "Chụp ảnh sản phẩm", who: "dung", st: "DONE", c: 30, d: -2, done: 3 },
              { t: "Dựng video TVC 30 giây", who: "dung", st: "IN_PROGRESS", p: 40, c: 25, d: 8, pr: "HIGH" },
              { t: "Thiết kế banner đa kênh", who: "dung", st: "TODO", c: 20, d: 14 },
            ],
          },
          { t: "Viết 20 bài blog chuẩn SEO", who: "giang", st: "IN_PROGRESS", p: 35, c: 25, d: 30 },
        ],
      },
      {
        name: "Quảng cáo số",
        color: "#3b82f6",
        tasks: [
          { t: "Thiết lập chiến dịch Facebook Ads", who: "lan", st: "IN_PROGRESS", p: 60, c: 20, d: 3, pr: "HIGH" },
          { t: "Chiến dịch Google Ads", who: "lan", st: "TODO", c: 15, d: 14 },
          { t: "Báo cáo hiệu quả quảng cáo tuần", who: "lan", st: "REVIEW", p: 100, c: 14, d: -1 },
        ],
      },
      {
        name: "Sự kiện",
        color: "#f97316",
        tasks: [
          {
            t: "Tổ chức workshop ra mắt sản phẩm", who: "binh", st: "IN_PROGRESS", p: 15, c: 10, d: 35, pr: "URGENT",
            subs: [
              { t: "Chọn & đặt địa điểm", who: "lan", st: "IN_PROGRESS", p: 30, c: 10, d: 9 },
              { t: "Gửi thư mời đối tác", who: "giang", st: "TODO", c: 8, d: 20 },
            ],
          },
        ],
      },
    ],
    notes: [
      { who: "binh", type: "NOTE", c: 55, text: "Ngân sách quảng cáo số đã được duyệt: 450 triệu đồng cho cả quý." },
      { who: "an", type: "FEEDBACK", c: 26, text: "Kế hoạch nội dung bám sát insight. Ưu tiên video ngắn cho TikTok và Reels." },
      { who: "giang", type: "NOTE", c: 6, text: "Đã có 7/20 bài blog, đang chờ duyệt từ khoá đợt 2." },
    ],
  },
  {
    name: "Triển khai CRM nội bộ",
    desc: "Xây dựng và đưa vào vận hành hệ thống quản lý quan hệ khách hàng cho phòng kinh doanh.",
    owner: "cuong",
    status: "COMPLETED",
    color: "#22c55e",
    start: 300,
    due: -100,
    members: ["cuong", "hai", "em", "lan"],
    categories: [
      {
        name: "Phân tích yêu cầu",
        color: "#6366f1",
        tasks: [
          { t: "Thu thập yêu cầu các phòng ban", who: "lan", st: "DONE", c: 298, d: -282, done: 280 },
          { t: "Đặc tả chức năng & luồng nghiệp vụ", who: "hai", st: "DONE", c: 280, d: -260, done: 262 },
        ],
      },
      {
        name: "Phát triển",
        color: "#22c55e",
        tasks: [
          { t: "Module quản lý khách hàng", who: "hai", st: "DONE", c: 260, d: -205, done: 200, pr: "HIGH" },
          { t: "Module báo cáo doanh số", who: "em", st: "DONE", c: 240, d: -175, done: 170 },
          { t: "Phân quyền người dùng", who: "hai", st: "DONE", c: 220, d: -160, done: 162 },
        ],
      },
      {
        name: "Đào tạo & bàn giao",
        color: "#f59e0b",
        tasks: [
          { t: "Đào tạo nhân viên sử dụng", who: "lan", st: "DONE", c: 150, d: -115, done: 116 },
          { t: "Bàn giao & nghiệm thu", who: "cuong", st: "DONE", c: 120, d: -100, done: 102, pr: "HIGH" },
        ],
      },
    ],
    notes: [
      { who: "an", type: "FEEDBACK", c: 100, text: "Dự án hoàn thành đúng hạn. Phòng kinh doanh đánh giá hệ thống giúp giảm 30% thời gian nhập liệu." },
    ],
  },
  {
    name: "Mở rộng kênh bán hàng miền Trung",
    desc: "Khảo sát và thiết lập mạng lưới nhà phân phối tại Đà Nẵng, Huế và Quảng Nam.",
    owner: "binh",
    status: "PLANNING",
    color: "#f59e0b",
    start: 20,
    due: 120,
    members: ["binh", "lan", "giang"],
    categories: [
      {
        name: "Khảo sát",
        color: "#14b8a6",
        tasks: [
          { t: "Khảo sát thị trường Đà Nẵng", who: "lan", st: "IN_PROGRESS", p: 40, c: 18, d: 10 },
          { t: "Khảo sát thị trường Huế", who: "lan", st: "TODO", c: 15, d: 25 },
        ],
      },
      {
        name: "Đối tác",
        color: "#ef4444",
        tasks: [
          { t: "Tìm kiếm nhà phân phối tiềm năng", who: "binh", st: "TODO", c: 12, d: 40, pr: "HIGH" },
          { t: "Soạn hợp đồng phân phối mẫu", who: "binh", st: "TODO", c: 8, d: 45 },
        ],
      },
    ],
    notes: [{ who: "binh", type: "NOTE", c: 15, text: "Ưu tiên Đà Nẵng trước, Huế và Quảng Nam làm ở giai đoạn 2." }],
  },
];

const REPORT_TEXT = {
  start: [
    "Đã nhận việc, rà soát yêu cầu và lên kế hoạch thực hiện.",
    "Bắt đầu triển khai, đã chuẩn bị tài liệu và công cụ cần thiết.",
    "Hoàn tất phân tích ban đầu, xác định các đầu việc chính.",
  ],
  mid: [
    "Đã hoàn thành phần lớn hạng mục chính, đang xử lý các chi tiết còn lại.",
    "Tiến độ đúng kế hoạch. Đã trao đổi với các bên liên quan để thống nhất phương án.",
    "Hoàn thành bản nháp, đang chỉnh sửa theo góp ý.",
    "Gặp một số vướng mắc nhỏ về dữ liệu đầu vào, đã xử lý xong.",
  ],
  done: [
    "Đã hoàn thành toàn bộ đầu việc, gửi quản lý nghiệm thu.",
    "Hoàn tất và bàn giao kết quả, đính kèm tài liệu hướng dẫn.",
  ],
  blocked: ["Đang bị chặn do chờ phản hồi từ bộ phận liên quan, đã báo quản lý để hỗ trợ."],
};
const REVIEW_NOTES = ["Đã xem, tốt.", "Tiếp tục phát huy.", "Ok, lưu ý bám sát deadline.", null, null];

/** A one-page PDF with a few lines of text, accents dropped (demo contract scan). */
function samplePdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const ascii = (l: string) =>
    l
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^\x20-\x7e]|[()\\]/g, "");
  const text = lines.map((l, i) => `BT /F1 ${i ? 12 : 18} Tf 72 ${760 - i * 28} Td (${ascii(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0 && process.env.SEED_FORCE !== "1") {
    console.log(`Database already has ${existing} users — skipping seed. Re-run with SEED_FORCE=1 to wipe and reseed.`);
    return;
  }
  if (existing > 0) {
    console.log("SEED_FORCE=1: deleting existing data…");
    await prisma.$transaction([
      prisma.appSetting.deleteMany(),
      prisma.workReport.deleteMany(),
      prisma.contract.deleteMany(),
      prisma.taskReport.deleteMany(),
      prisma.note.deleteMany(),
      prisma.task.deleteMany(),
      prisma.category.deleteMany(),
      prisma.projectMember.deleteMany(),
      prisma.project.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  }

  const adminHash = await bcrypt.hash("Admin@1234", 12);
  const demoHash = await bcrypt.hash("Demo@1234", 12);

  const ids = {} as Record<UserKey, string>;
  for (const [key, u] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        permissions: "permissions" in u ? [...u.permissions] : [],
        jobTitle: u.jobTitle,
        avatarColor: u.color,
        passwordHash: key === "an" ? adminHash : demoHash,
        createdAt: daysAgo(320),
        lastLoginAt: daysAgo(Math.floor(rand() * 5)),
      },
    });
    ids[key] = user.id;
  }

  let taskCount = 0;
  let reportCount = 0;

  for (const p of PROJECTS) {
    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: p.desc,
        status: p.status,
        color: p.color,
        startDate: daysAgo(p.start),
        dueDate: p.due >= 0 ? daysFromNow(p.due) : daysAgo(-p.due),
        ownerId: ids[p.owner],
        createdAt: daysAgo(p.start),
        members: {
          create: Array.from(new Set([p.owner, ...p.members])).map((m) => ({
            userId: ids[m],
            role: m === p.owner ? ("MANAGER" as const) : ("MEMBER" as const),
          })),
        },
      },
    });

    const createTask = async (t: T, categoryId: string, parentId: string | null) => {
      const createdAt = daysAgo(t.c);
      const completedAt = t.st === "DONE" && t.done !== undefined ? daysAgo(t.done) : null;
      const task = await prisma.task.create({
        data: {
          title: t.t,
          description: t.desc ?? null,
          status: t.st,
          priority: t.pr ?? "MEDIUM",
          progress: t.st === "DONE" ? 100 : (t.p ?? 0),
          startDate: createdAt,
          dueDate: t.d === undefined ? null : t.d >= 0 ? daysFromNow(t.d) : daysAgo(-t.d),
          completedAt,
          createdAt,
          projectId: project.id,
          categoryId,
          parentId,
          assigneeId: t.who ? ids[t.who] : null,
          createdById: ids[p.owner],
        },
      });
      taskCount++;

      if (t.subs?.length) {
        for (const s of t.subs) await createTask(s, categoryId, task.id);
        return;
      }

      // Progress reports for leaf tasks that have started.
      if (t.st === "TODO" || !t.who) return;
      const end = completedAt ? completedAt.getTime() : now - DAY / 2;
      const startMs = createdAt.getTime() + DAY / 2;
      const n = t.st === "DONE" ? 2 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
      const finalProgress = t.st === "DONE" ? 100 : (t.p ?? 0);

      for (let i = 1; i <= n; i++) {
        const at = new Date(startMs + ((end - startMs) * i) / n);
        const progress = Math.round((finalProgress * i) / n);
        const last = i === n;
        const content =
          last && t.st === "BLOCKED"
            ? pick(REPORT_TEXT.blocked)
            : last && progress >= 100
              ? pick(REPORT_TEXT.done)
              : i === 1
                ? pick(REPORT_TEXT.start)
                : pick(REPORT_TEXT.mid);
        // Older reports have been reviewed; the most recent ones wait in the manager inbox.
        const reviewed = now - at.getTime() > 3 * DAY && rand() < 0.8;
        await prisma.taskReport.create({
          data: {
            taskId: task.id,
            authorId: ids[t.who],
            content,
            progress,
            hoursSpent: 1 + Math.round(rand() * 14) / 2,
            createdAt: at,
            ...(reviewed
              ? {
                  reviewerId: ids[p.owner],
                  reviewedAt: new Date(Math.min(at.getTime() + DAY * (0.3 + rand()), now)),
                  reviewNote: pick(REVIEW_NOTES),
                }
              : {}),
          },
        });
        reportCount++;
      }
    };

    // Category deadlines span their tasks (+2 days slack). Larger categories get a
    // sub-category for their final tasks, with its own deadline.
    const span = (ts: T[]) => {
      const all = ts.flatMap((t) => [t, ...(t.subs ?? [])]);
      const start = Math.max(...all.map((t) => t.c));
      // t.d = due in days from now (negative = past); the category ends with its latest task.
      const dues = all.filter((t) => t.d !== undefined).map((t) => t.d!);
      return {
        startDate: daysAgo(start),
        dueDate: dues.length ? daysFromNow(Math.max(...dues) + 2) : null,
      };
    };
    for (const [order, c] of p.categories.entries()) {
      const split = c.tasks.length >= 4 ? Math.ceil(c.tasks.length / 2) : c.tasks.length;
      const own = c.tasks.slice(0, split);
      const rest = c.tasks.slice(split);
      const category = await prisma.category.create({
        data: { name: c.name, color: c.color, order, projectId: project.id, createdAt: daysAgo(p.start), ...span(c.tasks) },
      });
      for (const t of own) await createTask(t, category.id, null);
      if (rest.length) {
        const sub = await prisma.category.create({
          data: { name: "Hoàn thiện & bàn giao", color: c.color, order: 0, projectId: project.id, parentId: category.id, createdAt: daysAgo(p.start), ...span(rest) },
        });
        for (const t of rest) await createTask(t, sub.id, null);
      }
    }

    for (const n of p.notes) {
      await prisma.note.create({
        data: { projectId: project.id, authorId: ids[n.who], type: n.type, content: n.text, createdAt: daysAgo(n.c) },
      });
    }
  }

  // Contracts & costs (fictional sample data). m = months ago of implementation.
  // The first project is the completed one: one of its two contracts has its
  // signed PDF archived (pdf), the other not yet.
  const firstProject = await prisma.project.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const monthsAgo = (m: number) => {
    const d = new Date(now);
    d.setDate(10);
    d.setMonth(d.getMonth() - m);
    return d;
  };
  const CONTRACTS = [
    { code: "015/HĐKT-2026/ABC", name: "Đào tạo kỹ năng giao tiếp tiếng Anh cho nhân viên", partner: "Công ty TNHH Minh Phát", value: 186_000_000, m: 0, status: "IN_PROGRESS", training: 98_000_000, exam: 0, margin: null, collected: 90_000_000, project: true },
    { code: "021/HĐMB-2026/XYZ", name: "Cung cấp tài khoản luyện thi trực tuyến", partner: "Trường THPT Nguyễn Trãi", value: 64_500_000, m: 0, status: "COMPLETED", training: 0, exam: 0, margin: 35, collected: 64_500_000 },
    { code: "009/HĐDV-2026/HTC", name: "Tổ chức khảo thí năng lực ngoại ngữ đầu vào", partner: "Đại học Kỹ thuật Hưng Thịnh", value: 420_000_000, m: 0, status: "TESTING", training: 0, exam: 268_000_000, margin: null, collected: 210_000_000 },
    { code: "030/HĐKT-2026/SV", name: "Khoá luyện thi chứng chỉ quốc tế cho sinh viên", partner: "Đại học Sao Việt", value: 1_120_000_000, m: 0, status: "IN_PROGRESS", training: 0, exam: 0, margin: 28, collected: 0 },
    { code: "011/HĐKT-2026/LP", name: "Đánh giá năng lực tiếng Anh đội ngũ lãnh đạo", partner: "Tập đoàn Lam Phương", value: 245_000_000, m: 1, status: "COMPLETED", training: 120_000_000, exam: 85_000_000, margin: null, collected: 245_000_000, project: true, pdf: true },
    { code: "007/HĐMB-2026/AN", name: "Gói học liệu số cho trung tâm ngoại ngữ", partner: "Trung tâm Anh ngữ An Nhiên", value: 38_000_000, m: 1, status: "COMPLETED", training: 41_500_000, exam: 0, margin: null, collected: 38_000_000 },
    { code: "002/HĐDV-2026/BT", name: "Khảo thí xếp lớp đầu năm học", partner: "Trường quốc tế Bình Tâm", value: 96_000_000, m: 2, status: "COMPLETED", training: 0, exam: 52_000_000, margin: null, collected: 96_000_000 },
  ] as const;
  for (const c of CONTRACTS) {
    const contract = await prisma.contract.create({
      data: {
        code: c.code,
        name: c.name,
        partner: c.partner,
        value: BigInt(c.value),
        performedAt: monthsAgo(c.m),
        status: c.status,
        trainingCost: BigInt(c.training),
        examCost: BigInt(c.exam),
        expectedMargin: c.margin,
        collected: BigInt(c.collected),
        projectId: "project" in c && firstProject ? firstProject.id : null,
        createdById: ids.an,
      },
    });
    if ("pdf" in c) {
      const bytes = samplePdf([`HOP DONG ${c.code}`, c.name, "Ban scan mau - du lieu demo"]);
      await prisma.contractFile.create({
        data: {
          contractId: contract.id,
          name: `HĐ ${c.code.replace(/\//g, "-")} (bản ký).pdf`,
          size: bytes.length,
          uploadedById: ids.cuong,
          blob: { create: { data: bytes } },
        },
      });
    }
  }

  // Weekly work reports: lan.bui sent last week's, dung.pham sent this week's (seen
  // by binh.tran), em.hoang is still drafting this week's.
  const thisWeek = workPeriodOf("WEEK", new Date(now));
  const lastWeek = shiftWorkPeriod(thisWeek, -1);
  const H = 3_600_000;
  await workReport(ids.lan, lastWeek, new Date(thisWeek.start.getTime() - 38 * H), {
    doneNote: "Hoàn tất báo cáo hiệu quả quảng cáo tuần trước: CTR trung bình 2,1%, chi phí mỗi khách hàng tiềm năng giảm 12%.",
    doingNote: "Tối ưu nhóm quảng cáo Facebook cho độ tuổi 25–34; khảo sát 12 điểm bán tại Đà Nẵng.",
    planNote: "Chốt địa điểm workshop ra mắt, chuẩn bị nội dung chiến dịch Google Ads.",
    issues: "Đề xuất bổ sung 20 triệu ngân sách quảng cáo cho tuần cao điểm.",
  });
  const dungSent = new Date(Math.min(now, Math.max(now - 2 * H, thisWeek.start.getTime() + 60_000)));
  const dungReport = await workReport(ids.dung, thisWeek, dungSent, {
    doneNote: "Hoàn thành bộ ảnh sản phẩm; giao diện mobile đã gửi duyệt.",
    doingNote: "Dựng video TVC 30 giây, bản dựng thô đã xong phần mở đầu.",
    planNote: "Hoàn thiện TVC và bắt đầu thiết kế banner đa kênh.",
    issues: null,
  });
  await prisma.workReport.update({
    where: { id: dungReport.id },
    data: {
      reviewedById: ids.binh,
      reviewedAt: new Date(Math.min(now, dungSent.getTime() + H / 2)),
      reviewNote: "Tốt, ưu tiên chốt TVC trước thứ Năm.",
    },
  });
  await workReport(ids.em, thisWeek, null, {
    doneNote: null,
    doingNote: "Đang chờ phòng Marketing chốt cấu trúc nội dung để tiếp tục tích hợp CMS.",
    planNote: "Tối ưu hình ảnh & lazy-load; viết test E2E cho luồng thanh toán.",
    issues: "Tích hợp CMS bị chặn: cần phòng Marketing chốt cấu trúc nội dung trước thứ Hai.",
  });

  console.log(
    `Seeded ${Object.keys(USERS).length} users, ${PROJECTS.length} projects, ${taskCount} tasks, ${reportCount} reports, 3 work reports.`,
  );
  console.log("Sign in: admin@crm.local / Admin@1234  ·  other demo accounts use Demo@1234");
}

// A weekly report; with `sentAt` it is sent then, freezing the task lists as they
// were at that time (state rebuilt from the progress reports filed by then).
async function workReport(userId: string, period: WorkPeriod, sentAt: Date | null, notes: WorkNotes) {
  const base = { userId, period: period.type, periodStart: period.start, ...notes };
  if (!sentAt) {
    const at = new Date(now - 2 * 3_600_000);
    return prisma.workReport.create({ data: { ...base, createdAt: at, updatedAt: at } });
  }
  const history = { status: true, progress: true, completedAt: true, reports: { select: { progress: true, createdAt: true } } } as const;
  const [tasks, entries] = await Promise.all([
    prisma.task.findMany({
      where: { OR: [{ assigneeId: userId }, { createdById: userId }], createdAt: { lte: sentAt } },
      select: {
        id: true,
        title: true,
        priority: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
        ...history,
        project: { select: { id: true, name: true, color: true } },
        parent: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true } },
        subtasks: { select: history },
      },
    }),
    prisma.taskReport.findMany({
      where: { authorId: userId, createdAt: { lte: sentAt } },
      select: {
        id: true,
        content: true,
        progress: true,
        hoursSpent: true,
        createdAt: true,
        task: { select: { id: true, title: true, project: { select: { id: true, name: true, color: true } } } },
      },
    }),
  ]);
  const asOf = <X extends Prisma.TaskGetPayload<{ select: typeof history }>>(t: X) => {
    const done = !!t.completedAt && t.completedAt <= sentAt;
    const filed = t.reports.filter((r) => r.createdAt <= sentAt).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const progress = done ? 100 : filed.length ? filed[filed.length - 1].progress : t.reports.length ? 0 : t.progress;
    const later = t.status === "DONE" || t.status === "REVIEW";
    const status: TaskStatus = done ? "DONE" : later ? (progress >= 100 ? "REVIEW" : progress > 0 ? "IN_PROGRESS" : "TODO") : t.status;
    return { ...t, status, progress, completedAt: done ? t.completedAt : null };
  };
  const then = tasks.map((t) => ({ ...asOf(t), subtasks: t.subtasks.map(asOf) }));
  const snapshot = takeSnapshot(buildSections(then, entries, period, sentAt), [], notes, sentAt);
  return prisma.workReport.create({
    data: {
      ...base,
      status: "SUBMITTED",
      submittedAt: sentAt,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      createdAt: new Date(sentAt.getTime() - 3_600_000),
      updatedAt: sentAt,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
