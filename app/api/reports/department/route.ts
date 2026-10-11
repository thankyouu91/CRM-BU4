import type { NextRequest } from "next/server";
import { auth, badRequest, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject } from "@/lib/rbac";
import { workPeriodFromKey, workPeriodOf } from "@/lib/work-report";
import { departmentReport } from "@/lib/department-report-queries";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const now = new Date();
    const key = req.nextUrl.searchParams.get("week");
    const week = key ? workPeriodFromKey("WEEK", key) : workPeriodOf("WEEK", now);
    if (!week) return badRequest("Tuần báo cáo không hợp lệ");
    const projectId = req.nextUrl.searchParams.get("projectId") || null;
    if (projectId && !(await canAccessProject(me, projectId))) return notFound("Không tìm thấy dự án");
    return ok(await departmentReport(me, week, projectId, now), { headers: { "Cache-Control": "private, no-store" } });
  });
}
