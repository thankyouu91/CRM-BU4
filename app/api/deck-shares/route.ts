import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth, badRequest, created, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { createShare, listShares } from "@/lib/report-share";
import { canShareReports, DEFAULT_SHARE_DAYS, sharePath, SHARE_DAYS, type ShareDays } from "@/lib/report-share-rules";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");
const schema = z.object({
  period: z.enum(["day", "month", "quarter", "year", "custom"]),
  date: z.string().max(40).nullish(),
  from: day.nullish(),
  to: day.nullish(),
  projectId: z.string().min(1).max(100).nullish(),
  label: z.string().max(120, "Tên tối đa 120 ký tự").nullish(),
  days: z
    .number()
    .refine((d): d is ShareDays => (SHARE_DAYS as readonly number[]).includes(d), "Thời hạn không hợp lệ")
    .default(DEFAULT_SHARE_DAYS),
  includeFinance: z.boolean().default(false),
});

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/** GET /api/deck-shares: the caller's public presentation links (every link for administrators). */
export async function GET() {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    return ok({ shares: await listShares(me), canShare: canShareReports(me) }, NO_STORE);
  });
}

/** POST /api/deck-shares: a public link to the presentation of one report period. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!canShareReports(me)) return forbidden("Chỉ trưởng nhóm trở lên mới tạo được link công khai");
    const data = schema.parse(await req.json());
    if (data.period === "custom" && (!data.from || !data.to || data.from > data.to)) return badRequest("Chọn đủ ngày bắt đầu và ngày kết thúc của kỳ tuỳ chọn");
    if (data.projectId && !(await canAccessProject(me, data.projectId))) return notFound("Không tìm thấy dự án");
    if (data.includeFinance && !hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn không có quyền chia sẻ số liệu hợp đồng và lợi nhuận");
    const { token, share } = await createShare(me, { ...data, days: data.days as ShareDays });
    // The token is shown once, here; only its hash is stored.
    return created({ path: sharePath(token), share });
  });
}
