import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { projectVisibilityWhere } from "./rbac";
import type { CurrentUser } from "./session";
import { shiftWorkPeriod, type WorkPeriod } from "./work-report";
import { buildDepartmentReport } from "./department-report";

export async function departmentReport(viewer: CurrentUser, period: WorkPeriod, projectId: string | null, now = new Date()) {
  const previous = shiftWorkPeriod(period, -1);
  const next = shiftWorkPeriod(period, 1);
  const activityRange = { gte: previous.start, lte: new Date(Math.min(period.end.getTime(), now.getTime())) };
  // Intersect a requested project with visibility, never replace the permission predicate.
  const projectScope = { AND: [projectVisibilityWhere(viewer), { status: { not: "CANCELLED" as const } }, ...(projectId ? [{ id: projectId }] : [])] };
  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      relationLoadStrategy: "join",
      where: {
        project: projectScope,
        subtasks: { none: {} }, // Count the actual work once; parent titles remain context.
        OR: [
          { status: { not: "DONE" }, OR: [{ dueDate: { lte: next.end } }, { dueDate: null }, { startDate: { lte: next.end } }, { status: { in: ["IN_PROGRESS", "REVIEW", "BLOCKED"] } }] },
          { completedAt: activityRange },
          { dueDate: { gte: previous.start, lte: previous.end }, status: "DONE" },
          { status: "DONE", completedAt: null },
          { reports: { some: { createdAt: activityRange } } },
        ],
      },
      select: {
        id: true, title: true, description: true, status: true, priority: true, progress: true,
        startDate: true, dueDate: true, completedAt: true, createdAt: true,
        project: { select: { id: true, name: true, color: true, status: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
        parent: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true } },
        reports: { where: { createdAt: activityRange }, orderBy: { createdAt: "asc" }, select: {
          id: true, content: true, progress: true, createdAt: true, author: { select: { name: true } },
        } },
      } satisfies Prisma.TaskSelect,
    }),
    // Every project in scope, so one with no row above (a new one, often) is still listed.
    prisma.project.findMany({
      relationLoadStrategy: "join", // One LATERAL ... LIMIT 1 per project, not every open task.
      where: projectScope,
      select: {
        id: true, name: true, color: true, status: true, createdAt: true,
        owner: { select: { name: true } },
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: { not: "DONE" }, subtasks: { none: {} } },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { startDate: { sort: "asc", nulls: "last" } }],
          take: 1,
          select: { id: true, title: true, startDate: true, dueDate: true },
        },
      } satisfies Prisma.ProjectSelect,
    }),
  ]);
  return buildDepartmentReport(tasks, period, projectId, now, projects);
}
