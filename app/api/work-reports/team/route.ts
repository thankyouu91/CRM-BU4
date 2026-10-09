import type { NextRequest } from "next/server";
import { auth, badRequest, forbidden, ok, unauthorized } from "@/lib/api";
import { seesTeamWorkReports } from "@/lib/permissions";
import { resolveWorkPeriod } from "@/lib/work-report";
import { teamWorkReports } from "@/lib/work-report-queries";

/**
 * Boss overview: everyone whose reports I may read, with the state of their report
 * on ?period=week|month&key=…; &detail=1 adds each full report (overview export).
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  if (!seesTeamWorkReports(me.role)) return forbidden("Chỉ cấp trên mới xem được báo cáo của người khác");
  const sp = req.nextUrl.searchParams;
  const period = resolveWorkPeriod(sp.get("period"), sp.get("key"));
  if (!period) return badRequest("Kỳ báo cáo không hợp lệ");
  return ok(await teamWorkReports(me, period, sp.get("detail") === "1"));
}
