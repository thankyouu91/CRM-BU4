// "Công việc của đội tuần này" on the dashboard (managers and above): for each person whose
// weekly report the viewer may read, the state of that report, the week's numbers and the
// deadlines coming up on their open tasks.

import { prisma } from "./prisma";
import { roleLevel, ROLE_LEVEL } from "./permissions";
import { projectVisibilityWhere } from "./rbac";
import type { CurrentUser } from "./session";
import { periodJson, workPeriodOf, type TeamMemberReport, type WorkPeriodJson } from "./work-report";
import { teamWorkReports } from "./work-report-queries";

/** The team overview and assigning work from it: Quản lý and above. */
export const seesTeamOverview = (user: { role: string }) => roleLevel(user.role) >= ROLE_LEVEL.MANAGER;

export interface TeamDeadline {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  progress: number;
  projectId: string;
  projectName: string;
}

export interface TeamOverviewRow extends TeamMemberReport {
  /** Open tasks past their deadline. */
  overdue: number;
  /** Open tasks due this week (today included, overdue not). */
  dueThisWeek: number;
  /** The nearest deadlines of their open tasks, overdue first. */
  deadlines: TeamDeadline[];
}

export interface TeamOverview {
  period: WorkPeriodJson;
  asOf: string;
  rows: TeamOverviewRow[];
}

const DEADLINES_SHOWN = 3;

export async function teamOverview(viewer: CurrentUser, now = new Date()): Promise<TeamOverview> {
  const period = workPeriodOf("WEEK", now);
  const team = await teamWorkReports(viewer, period);
  const ids = team.members.map((m) => m.author.id);
  // Open work in live projects, as the bell and "Việc của tôi" count it.
  const tasks = ids.length
    ? await prisma.task.findMany({
        where: {
          assigneeId: { in: ids },
          status: { not: "DONE" },
          dueDate: { not: null },
          project: { AND: [projectVisibilityWhere(viewer), { status: { notIn: ["CANCELLED", "COMPLETED"] } }] },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        select: { id: true, title: true, dueDate: true, status: true, progress: true, assigneeId: true, projectId: true, project: { select: { name: true } } },
      })
    : [];
  return {
    period: periodJson(period),
    asOf: now.toISOString(),
    rows: team.members.map((m) => {
      const mine = tasks.filter((t) => t.assigneeId === m.author.id);
      return {
        ...m,
        overdue: mine.filter((t) => t.dueDate! < now).length,
        dueThisWeek: mine.filter((t) => t.dueDate! >= now && t.dueDate! <= period.end).length,
        deadlines: mine.slice(0, DEADLINES_SHOWN).map((t) => ({
          id: t.id, title: t.title, dueDate: t.dueDate!.toISOString(), status: t.status, progress: t.progress, projectId: t.projectId, projectName: t.project.name,
        })),
      };
    }),
  };
}
