import type { NextRequest } from "next/server";
import { auth, ok, unauthorized } from "@/lib/api";
import { monthOf, parseMonth } from "@/lib/task-calendar";
import { calendarTasks } from "@/lib/task-calendar-queries";

/**
 * GET /api/tasks/calendar?month=2026-10&scope=mine|all[&projectId=]
 * The tasks behind the month calendar of "Công việc của tôi" (lib/task-calendar-queries.ts).
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const month = parseMonth(sp.get("month")) ?? monthOf(now);
  return ok(await calendarTasks(me, { month, scope: sp.get("scope") === "all" ? "all" : "mine", projectId: sp.get("projectId") }, now));
}
