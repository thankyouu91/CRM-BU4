import type { NextRequest } from "next/server";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { resolveWorkPeriod } from "@/lib/work-report";
import { saveWorkNotes, workReportView } from "@/lib/work-report-queries";
import { workReportNotesSchema } from "@/lib/validations";

/**
 * ?period=week|month&key=2026-W41|2026-10&userId=… (default: me).
 * A report is visible to its author, admins and higher levels (canViewWorkReport).
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const period = resolveWorkPeriod(sp.get("period"), sp.get("key"));
  if (!period) return badRequest("Kỳ báo cáo không hợp lệ");

  const view = await workReportView(me, sp.get("userId") || me.id, period);
  if (view === null) return notFound("Không tìm thấy người dùng");
  if (view === "forbidden") return forbidden("Bạn không có quyền xem báo cáo của người này");
  return ok(view);
}

/** Save my notes for a period (draft; a sent report stays sent until sent again). */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const { period: type, key, ...notes } = workReportNotesSchema.parse(await req.json());
    const period = resolveWorkPeriod(type, key);
    if (!period) return badRequest("Kỳ báo cáo không hợp lệ");
    return ok({ report: await saveWorkNotes(me, period, notes) });
  });
}
