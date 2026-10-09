import type { NextRequest } from "next/server";
import { auth, badRequest, handle, ok, unauthorized } from "@/lib/api";
import { resolveWorkPeriod } from "@/lib/work-report";
import { submitWorkReport } from "@/lib/work-report-queries";
import { workReportNotesSchema } from "@/lib/validations";

/** Send my report on a period (again): saves the notes and freezes the task lists as they are now. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const { period: type, key, ...notes } = workReportNotesSchema.parse(await req.json());
    const period = resolveWorkPeriod(type, key);
    if (!period) return badRequest("Kỳ báo cáo không hợp lệ");
    if (period.start.getTime() > Date.now()) return badRequest("Chưa đến kỳ này, chỉ có thể lưu nháp kế hoạch");
    return ok(await submitWorkReport(me, period, notes));
  });
}
