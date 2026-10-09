import type { NextRequest } from "next/server";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { reviewWorkReport } from "@/lib/work-report-queries";
import { reviewWorkReportSchema } from "@/lib/validations";

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
    return ok({ report: result });
  });
}
