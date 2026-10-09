import type { NextRequest } from "next/server";
import { auth, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject } from "@/lib/rbac";
import { parseDate, parsePeriodType, resolvePeriod } from "@/lib/period";
import { getSummary } from "@/lib/stats";

/**
 * GET /api/reports/summary?period=day|month|quarter|year|custom&date=ISO&from=ISO&to=ISO&projectId=
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const type = parsePeriodType(sp.get("period"));
  const range = resolvePeriod(type, parseDate(sp.get("date")), {
    from: sp.get("from") ? parseDate(sp.get("from")) : null,
    to: sp.get("to") ? parseDate(sp.get("to")) : null,
  });

  const projectId = sp.get("projectId") || null;
  if (projectId && !(await canAccessProject(me, projectId))) return notFound("Không tìm thấy dự án");

  return ok(await getSummary(me, range, type, projectId));
}
