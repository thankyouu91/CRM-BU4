import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, ok, unauthorized } from "@/lib/api";
import { projectVisibilityWhere } from "@/lib/rbac";
import { monthOf, monthRange, parseMonth } from "@/lib/task-calendar";

/** Tasks that touch a calendar month at most; the month view shows a few per day. */
const LIMIT = 500;

/**
 * GET /api/tasks/calendar?month=2026-10&scope=mine|all[&projectId=]
 * The tasks behind the month calendar of "Công việc của tôi": finished in the month,
 * due in it, or in progress during it. Grid days from the next and previous months are
 * covered too (a week either side), so the edges of the grid are not empty.
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const month = parseMonth(sp.get("month")) ?? monthOf(now);
  const range = monthRange(month);
  const from = new Date(range.start.getTime() - 7 * 86_400_000);
  const to = new Date(range.end.getTime() + 7 * 86_400_000);
  const projectId = sp.get("projectId");
  const rows = await prisma.task.findMany({
    where: {
      project: projectVisibilityWhere(me),
      ...(sp.get("scope") === "all" ? {} : { assigneeId: me.id }),
      ...(projectId ? { projectId } : {}),
      OR: [
        { status: "DONE", completedAt: { gte: from, lte: to } },
        { status: { not: "DONE" }, dueDate: { gte: from, lte: to } },
        {
          status: { in: ["IN_PROGRESS", "REVIEW"] },
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: to } }] },
            { OR: [{ dueDate: null }, { dueDate: { gte: from } }] },
          ],
        },
      ],
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    take: LIMIT + 1,
    select: {
      id: true, title: true, status: true, progress: true, startDate: true, dueDate: true, completedAt: true,
      project: { select: { id: true, name: true, color: true } },
    },
  });
  return ok({ month, asOf: now.toISOString(), tasks: rows.slice(0, LIMIT), truncated: rows.length > LIMIT });
}
