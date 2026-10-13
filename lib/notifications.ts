// In-app notifications (the bell in the top bar).
//
// Stored: things that happened to you (a task given to you, a report reviewed).
// Live: what needs attention now (your overdue and due-soon tasks, the weekly
// report not sent yet), computed on each read so they are never stale.

import type { Prisma } from "@prisma/client";
import { TZDate } from "@date-fns/tz";
import { addDays, endOfDay } from "date-fns";
import { prisma } from "./prisma";
import { APP_TIMEZONE } from "./period";
import { canViewWorkReport } from "./permissions";
import type { CurrentUser } from "./session";
import { shiftWorkPeriod, workPeriodOf, type WorkPeriod } from "./work-report";

export const NOTIFICATION_TYPES = ["task.assigned", "task_report.reviewed", "work_report.reviewed", "project.member_added"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationAlert {
  id: "overdue" | "due-soon" | "work-report" | "team-reports";
  tone: "critical" | "warning" | "info";
  title: string;
  body: string | null;
  link: string;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
  alerts: NotificationAlert[];
  asOf: string;
}

/** Shown in the bell; the daily maintenance job removes old ones (lib/maintenance.ts). */
export const NOTIFICATION_LIMIT = 30;
/** More tasks than this given at once to one person become a single notice. */
const GROUP_ABOVE = 3;

/**
 * Write notices for others; people are never notified of their own actions. A failure
 * here is logged and never undoes the change that caused it.
 */
export async function notify(actor: { id: string; name: string }, notices: NewNotification[], db: Prisma.TransactionClient = prisma): Promise<void> {
  const rows = notices.filter((n) => n.userId !== actor.id);
  if (!rows.length) return;
  try {
    await db.notification.createMany({
      data: rows.map((n) => ({ userId: n.userId, type: n.type, title: n.title.slice(0, 300), body: n.body?.slice(0, 500) ?? null, link: n.link ?? null, actorName: actor.name })),
    });
  } catch (err) {
    console.error("[notify]", err);
  }
}

export const taskLink = (projectId: string, taskId: string) => `/projects/${projectId}?task=${taskId}`;

/** Notices for tasks given to people: one per task, or one per person for a large batch. */
export function assignmentNotices(tasks: { id: string; title: string; projectId: string; projectName: string; assigneeId: string | null }[]): NewNotification[] {
  const byPerson = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    byPerson.set(t.assigneeId, [...(byPerson.get(t.assigneeId) ?? []), t]);
  }
  const out: NewNotification[] = [];
  for (const [userId, list] of byPerson) {
    if (list.length > GROUP_ABOVE) {
      const projects = [...new Set(list.map((t) => t.projectName))];
      out.push({
        userId, type: "task.assigned", title: `Bạn được giao ${list.length} công việc`,
        body: projects.length === 1 ? `Dự án ${projects[0]}` : `Trong ${projects.length} dự án: ${projects.slice(0, 3).join(", ")}${projects.length > 3 ? "…" : ""}`,
        link: "/tasks",
      });
    } else {
      for (const t of list) out.push({ userId, type: "task.assigned", title: `Bạn được giao “${t.title}”`, body: `Dự án ${t.projectName}`, link: taskLink(t.projectId, t.id) });
    }
  }
  return out;
}

/** Hour and weekday (1 = Monday … 7 = Sunday) of an instant in the business time zone. */
export function zonedClock(at: Date): { weekday: number; hour: number } {
  const z = new TZDate(at.getTime(), APP_TIMEZONE);
  return { weekday: z.getDay() || 7, hour: z.getHours() };
}

/**
 * The weekly report that should be sent by now, if any: this week's from Friday 15:00,
 * last week's on Monday and Tuesday (business time). Other days: none.
 */
export function dueWeeklyReport(now: Date): WorkPeriod | null {
  const { weekday, hour } = zonedClock(now);
  const week = workPeriodOf("WEEK", now);
  if (weekday >= 6 || (weekday === 5 && hour >= 15)) return week;
  if (weekday <= 2) return shiftWorkPeriod(week, -1);
  return null;
}

/** Everyone except administrators writes a weekly report (no one is above them). */
export const writesWeeklyReport = (user: { role: string }) => user.role !== "ADMIN";

/** Whether this person still owes the weekly report due now (for the sidebar badge). */
export async function weeklyReportOwed(user: Pick<CurrentUser, "id" | "role">, now = new Date()): Promise<WorkPeriod | null> {
  const period = writesWeeklyReport(user) ? dueWeeklyReport(now) : null;
  if (!period) return null;
  const sent = await prisma.workReport.count({ where: { userId: user.id, period: "WEEK", periodStart: period.start, status: "SUBMITTED" } });
  return sent ? null : period;
}

/** End of tomorrow in the business time zone. */
const endOfTomorrow = (now: Date) => new Date(endOfDay(addDays(new TZDate(now.getTime(), APP_TIMEZONE), 1)).getTime());

const plural = (n: number, word: string) => `${n} ${word}`;

/** What needs this person's attention now. */
export async function liveAlerts(user: CurrentUser, now = new Date()): Promise<NotificationAlert[]> {
  const mine = { assigneeId: user.id, status: { not: "DONE" as const }, project: { status: { notIn: ["CANCELLED" as const, "COMPLETED" as const] } } };
  const reportPeriod = dueWeeklyReport(now);
  const soon = { gte: now, lte: endOfTomorrow(now) };
  const [overdue, overdueCount, dueSoon, dueSoonCount, owed, team] = await Promise.all([
    prisma.task.findMany({ where: { ...mine, dueDate: { lt: now } }, orderBy: { dueDate: "asc" }, take: 2, select: { title: true } }),
    prisma.task.count({ where: { ...mine, dueDate: { lt: now } } }),
    prisma.task.findMany({ where: { ...mine, dueDate: soon }, orderBy: { dueDate: "asc" }, take: 2, select: { title: true } }),
    prisma.task.count({ where: { ...mine, dueDate: soon } }),
    weeklyReportOwed(user, now),
    reportPeriod && user.role !== "MEMBER" ? unsentTeamReports(user, reportPeriod) : Promise.resolve(0),
  ]);
  const alerts: NotificationAlert[] = [];
  const titles = (top: { title: string }[], count: number) => `${top.map((t) => `“${t.title}”`).join(", ")}${count > top.length ? ` và ${count - top.length} việc khác` : ""}`;
  if (overdueCount) alerts.push({ id: "overdue", tone: "critical", title: `${plural(overdueCount, "việc")} của bạn đã quá hạn`, body: titles(overdue, overdueCount), link: "/tasks?issue=overdue" });
  if (dueSoonCount) alerts.push({ id: "due-soon", tone: "warning", title: `${plural(dueSoonCount, "việc")} đến hạn hôm nay hoặc ngày mai`, body: titles(dueSoon, dueSoonCount), link: "/tasks" });
  if (owed) alerts.push({ id: "work-report", tone: "warning", title: `Bạn chưa gửi báo cáo ${owed.short.toLowerCase()}`, body: owed.label, link: `/tasks?tab=report&period=week&key=${owed.key}` });
  if (team && reportPeriod) alerts.push({ id: "team-reports", tone: "info", title: `${plural(team, "người")} chưa gửi báo cáo ${reportPeriod.short.toLowerCase()}`, body: "Xem ở Hộp báo cáo → Báo cáo tuần / tháng", link: `/inbox?tab=weekly&period=week&key=${reportPeriod.key}` });
  return alerts;
}

/** People this supervisor reads reports of who have not sent the given week's yet. */
async function unsentTeamReports(viewer: CurrentUser, period: WorkPeriod): Promise<number> {
  const users = await prisma.user.findMany({
    where: { active: true, id: { not: viewer.id }, role: { not: "ADMIN" } },
    select: { id: true, role: true, workReports: { where: { period: "WEEK", periodStart: period.start, status: "SUBMITTED" }, select: { id: true } } },
  });
  return users.filter((u) => canViewWorkReport(viewer, u) && !u.workReports.length).length;
}

export async function notificationFeed(user: CurrentUser, now = new Date()): Promise<NotificationFeed> {
  const [rows, unread, alerts] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: NOTIFICATION_LIMIT }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    liveAlerts(user, now),
  ]);
  return {
    items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, actorName: n.actorName, read: !!n.readAt, createdAt: n.createdAt.toISOString() })),
    unread,
    alerts,
    asOf: now.toISOString(),
  };
}

/** Mark some (or all) of this person's notices as read; returns what is still unread. */
export async function markRead(userId: string, ids: string[] | "all"): Promise<number> {
  await prisma.notification.updateMany({ where: { userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) }, data: { readAt: new Date() } });
  return prisma.notification.count({ where: { userId, readAt: null } });
}
