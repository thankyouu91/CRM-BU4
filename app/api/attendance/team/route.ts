import type { NextRequest } from "next/server";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { teamAttendance } from "@/lib/attendance-queries";
import { isMonth } from "@/lib/attendance";
import { zonedDay } from "@/lib/work-report";

/** GET /api/attendance/team?month=YYYY-MM: the timesheet of everyone the caller may see. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const month = req.nextUrl.searchParams.get("month");
    return ok(await teamAttendance(me, isMonth(month) ? month : zonedDay(new Date()).slice(0, 7)), { headers: { "Cache-Control": "private, no-store" } });
  });
}
