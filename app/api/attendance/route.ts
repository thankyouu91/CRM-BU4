import type { NextRequest } from "next/server";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { attendanceView } from "@/lib/attendance-queries";
import { isMonth } from "@/lib/attendance";
import { zonedDay } from "@/lib/work-report";

/** GET /api/attendance?month=YYYY-MM&user=<id>: one person's month (yourself by default). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const sp = req.nextUrl.searchParams;
    const month = isMonth(sp.get("month")) ? sp.get("month")! : zonedDay(new Date()).slice(0, 7);
    const view = await attendanceView(me, sp.get("user") || me.id, month);
    if (!view) return notFound("Không tìm thấy nhân sự");
    if (view === "forbidden") return forbidden("Bạn không xem được chấm công của người này");
    return ok(view, { headers: { "Cache-Control": "private, no-store" } });
  });
}
