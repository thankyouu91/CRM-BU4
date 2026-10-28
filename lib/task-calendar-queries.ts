// The tasks behind the month calendar of "Công việc của tôi", shared by the page
// (sent with the first render) and GET /api/tasks/calendar (other months, refreshes).

import { prisma } from "./prisma";
import { projectVisibilityWhere } from "./rbac";
import { monthRange, type CalendarResponse } from "./task-calendar";
import type { CurrentUser } from "./session";

/** Tasks that touch a calendar month at most; the month view shows a few per day. */
const LIMIT = 500;

/**
 * Finished in the month or due in it. Grid days from the next and previous months are
 * covered too (a week either side), so the edges of the grid are not empty.
 */
export async function calendarTasks(
  user: CurrentUser,
  { month, scope, projectId }: { month: string; scope: "mine" | "all"; projectId?: string | null },
  now = new Date(),
): Promise<CalendarResponse> {
  const range = monthRange(month);
  const from = new Date(range.start.getTime() - 7 * 86_400_000);
  const to = new Date(range.end.getTime() + 7 * 86_400_000);
  const rows = await prisma.task.findMany({
    where: {
      project: projectVisibilityWhere(user),
      ...(scope === "all" ? {} : { assigneeId: user.id }),
      ...(projectId ? { projectId } : {}),
      OR: [
        { status: "DONE", completedAt: { gte: from, lte: to } },
        { status: { not: "DONE" }, dueDate: { gte: from, lte: to } },
      ],
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    take: LIMIT + 1,
    select: {
      id: true, title: true, status: true, progress: true, startDate: true, dueDate: true, completedAt: true,
      project: { select: { id: true, name: true, color: true } },
    },
  });
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    month,
    asOf: now.toISOString(),
    tasks: rows.slice(0, LIMIT).map((t) => ({ ...t, startDate: iso(t.startDate), dueDate: iso(t.dueDate), completedAt: iso(t.completedAt) })),
    truncated: rows.length > LIMIT,
  };
}
