import type { NextRequest } from "next/server";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { reviewWorkReport } from "@/lib/work-report-queries";
import { reviewWorkReportSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveWorkPeriod } from "@/lib/work-report";

type Ctx = { params: Promise<{ id: string }> };

/** Someone above the author marks a sent report as seen ("Đã xem"), with an optional note. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const data = reviewWorkReportSchema.parse(await req.json());
    const result = await reviewWorkReport(me, params.id, data.reviewNote ?? null);
    if (result === "not-found") return notFound("Không tìm thấy báo cáo");
    if (result === "forbidden") return forbidden("Chỉ cấp trên của người báo cáo mới được đánh dấu đã xem");
    if (result === "draft") return badRequest("Báo cáo chưa được gửi");
    const reviewed = await prisma.workReport.findUnique({
      where: { id: result.id },
      select: { period: true, periodStart: true, user: { select: { name: true } } },
    });
    const label = reviewed && resolveWorkPeriod(reviewed.period, null, reviewed.periodStart)?.label;
    await audit(
      { id: me.id, name: me.name },
      {
        action: "work_report.review",
        entityType: "work_report",
        entityId: result.id,
        summary: `Đã xem báo cáo ${label ?? ""} của ${reviewed?.user.name ?? "nhân viên"}`.replace(/\s+/g, " "),
        details: { reviewNote: result.reviewNote },
      },
    );
    return ok({ report: result });
  });
}
