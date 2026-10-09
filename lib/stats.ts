import {
  addDays,
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfHour,
  endOfMonth,
  endOfWeek,
  format,
} from "date-fns";
import { prisma } from "./prisma";
import { projectVisibilityWhere } from "./rbac";
import { scheduleOf, workloadOf, type Schedule, type Workload } from "./schedule";
import { hasPermission } from "./permissions";
import { contractTotals, type ContractTotals } from "./finance";
import { contractDto } from "./contracts";
import type { DateRange, PeriodType } from "./period";
import type { CurrentUser } from "./session";

// ----------------------------------------------------------------------------
// Progress
// ----------------------------------------------------------------------------

export interface ProgressNode {
  id: string;
  parentId: string | null;
  status: string;
  progress: number;
}

/**
 * Effective progress of a task: DONE counts as 100; a task with subtasks takes
 * the average of its subtasks (recursively); otherwise its own progress field.
 */
export function effectiveProgress(
  task: ProgressNode,
  childrenOf: Map<string, ProgressNode[]>,
  seen: Set<string> = new Set(),
): number {
  if (task.status === "DONE") return 100;
  if (seen.has(task.id)) return task.progress; // guard against bad cyclic data
  seen.add(task.id);
  const children = childrenOf.get(task.id);
  if (!children || children.length === 0) return task.progress;
  const sum = children.reduce((acc, c) => acc + effectiveProgress(c, childrenOf, seen), 0);
  return sum / children.length;
}

export function indexChildren<T extends ProgressNode>(tasks: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = map.get(t.parentId) ?? [];
    list.push(t);
    map.set(t.parentId, list);
  }
  return map;
}

/** Project completion % = average effective progress of its top-level tasks. */
export function projectProgress(tasks: ProgressNode[]): number {
  const childrenOf = indexChildren(tasks);
  const roots = tasks.filter((t) => !t.parentId);
  if (roots.length === 0) return 0;
  const sum = roots.reduce((acc, t) => acc + effectiveProgress(t, childrenOf), 0);
  return Math.round(sum / roots.length);
}

/**
 * Completion % of an arbitrary subset of tasks (e.g. one category): tasks whose
 * parent is outside the subset count as top-level.
 */
export function subsetProgress(tasks: ProgressNode[]): number {
  const ids = new Set(tasks.map((t) => t.id));
  const childrenOf = indexChildren(tasks);
  const roots = tasks.filter((t) => !t.parentId || !ids.has(t.parentId));
  if (roots.length === 0) return 0;
  const sum = roots.reduce((acc, t) => acc + effectiveProgress(t, childrenOf), 0);
  return Math.round(sum / roots.length);
}

/**
 * Progress, workload and deadline status for each category. A main category
 * covers its own tasks plus those of its sub-categories; categories without
 * their own start date use the main category's, then the project's.
 */
export function categorySchedules<
  C extends { id: string; parentId: string | null; startDate: Date | null; dueDate: Date | null; createdAt: Date },
>(
  categories: C[],
  tasks: (ProgressNode & { categoryId: string | null; dueDate: Date | null })[],
  projectStart: Date | null,
  now: Date = new Date(),
) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const childIds = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parentId && byId.has(c.parentId)) childIds.set(c.parentId, [...(childIds.get(c.parentId) ?? []), c.id]);
  }
  return categories.map((c) => {
    const scope = new Set([c.id, ...(childIds.get(c.id) ?? [])]);
    const ct = tasks.filter((t) => t.categoryId && scope.has(t.categoryId));
    const progress = subsetProgress(ct);
    const workload = workloadOf(ct, now);
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return {
      ...c,
      // An orphaned parent link (shouldn't happen) shows as a main category.
      parentId: parent ? c.parentId : null,
      progress,
      taskCount: ct.length,
      workload,
      schedule: scheduleOf({
        start: c.startDate ?? parent?.startDate ?? projectStart,
        fallbackStart: c.createdAt,
        due: c.dueDate,
        actual: progress,
        finished: workload.total > 0 && workload.remaining === 0,
        now,
      }),
    };
  });
}

/** Deadline status of a whole project. */
export function projectSchedule(
  project: { startDate: Date | null; dueDate: Date | null; createdAt: Date },
  tasks: (ProgressNode & { dueDate: Date | null })[],
  now: Date = new Date(),
) {
  const progress = projectProgress(tasks);
  const workload = workloadOf(tasks, now);
  const schedule = scheduleOf({
    start: project.startDate,
    fallbackStart: project.createdAt,
    due: project.dueDate,
    actual: progress,
    finished: workload.total > 0 && workload.remaining === 0,
    now,
  });
  return { progress, workload, schedule };
}

// ----------------------------------------------------------------------------
// Time buckets for trend charts
// ----------------------------------------------------------------------------

export interface Bucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

export function buildBuckets(range: DateRange, type: PeriodType): Bucket[] {
  const interval = { start: range.from, end: range.to };
  const clamp = (d: Date) => (d > range.to ? range.to : d);
  const floor = (d: Date) => (d < range.from ? range.from : d);

  let granularity: "hour" | "day" | "week" | "month";
  if (type === "day") granularity = "hour";
  else if (type === "month") granularity = "day";
  else if (type === "quarter") granularity = "week";
  else if (type === "year") granularity = "month";
  else {
    const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
    granularity = days <= 31 ? "day" : days <= 186 ? "week" : "month";
  }

  switch (granularity) {
    case "hour":
      return eachHourOfInterval(interval).map((d) => ({
        key: d.toISOString(),
        label: format(d, "HH'h'"),
        start: d,
        end: clamp(endOfHour(d)),
      }));
    case "day":
      return eachDayOfInterval(interval).map((d) => ({
        key: d.toISOString(),
        label: format(d, "dd/MM"),
        start: d,
        end: clamp(endOfDay(d)),
      }));
    case "week":
      return eachWeekOfInterval(interval, { weekStartsOn: 1 }).map((d) => {
        const start = floor(d);
        return {
          key: start.toISOString(),
          label: `Tuần ${format(start, "dd/MM")}`,
          start,
          end: clamp(endOfWeek(d, { weekStartsOn: 1 })),
        };
      });
    case "month":
      return eachMonthOfInterval(interval).map((d) => {
        const start = floor(d);
        return {
          key: start.toISOString(),
          label: `T${d.getMonth() + 1}/${format(d, "yy")}`,
          start,
          end: clamp(endOfMonth(d)),
        };
      });
  }
}

function bucketIndex(buckets: Bucket[], t: Date): number {
  const ms = t.getTime();
  for (let i = 0; i < buckets.length; i++) {
    if (ms >= buckets[i].start.getTime() && ms <= buckets[i].end.getTime()) return i;
  }
  return -1;
}

// ----------------------------------------------------------------------------
// Summary report
// ----------------------------------------------------------------------------

export interface SummaryProject {
  id: string;
  name: string;
  color: string;
  status: string;
  progress: number;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  members: number;
  ownerName: string;
  startDate: string | null;
  dueDate: string | null;
  schedule: Schedule;
  workload: Workload;
}

/** Money of the contracts in a report, overall and per project, next to the project's progress. */
export interface SummaryFinance {
  /** "project": every contract of the selected project; "period": contracts implemented in the period. */
  scope: "project" | "period";
  totals: ContractTotals;
  byProject: {
    /** null for contracts not linked to a project */
    id: string | null;
    name: string;
    color: string;
    progress: number | null;
    scheduleStatus: string | null;
    totals: ContractTotals;
  }[];
}

/** One line of the "progress against deadline" table: a project, category or sub-category. */
export interface ScheduleRow {
  id: string;
  name: string;
  color: string;
  /** 0 = project, 1 = main category, 2 = sub-category */
  level: 0 | 1 | 2;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  schedule: Schedule;
  workload: Workload;
}

export interface SummaryPerson {
  userId: string;
  name: string;
  avatarColor: string;
  jobTitle: string | null;
  /** In-scope tasks assigned = done + inProgress + overdue + remaining (disjoint buckets). */
  assigned: number;
  done: number;
  /** IN_PROGRESS/REVIEW and not overdue. */
  inProgress: number;
  /** Unfinished and past due. */
  overdue: number;
  /** Everything else: not started, blocked, or finished outside the period. */
  remaining: number;
  reports: number;
  hours: number;
}

export interface Summary {
  period: { type: PeriodType; label: string; from: string; to: string };
  kpis: {
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
    overallProgress: number;
    reportsCount: number;
    hoursLogged: number;
  };
  statusDistribution: { status: string; count: number }[];
  priorityDistribution: { priority: string; count: number }[];
  trend: { label: string; created: number; completed: number; reports: number; hours: number }[];
  projects: SummaryProject[];
  /** Projects; for a single-project report, followed by its categories and sub-categories. */
  schedule: ScheduleRow[];
  /** Current work volume across the scope: done vs still to do. */
  workload: Workload;
  /** Present only for holders of "Hợp đồng & chi phí". */
  finance?: SummaryFinance;
  people: SummaryPerson[];
  recentReports: {
    id: string;
    content: string;
    progress: number;
    hoursSpent: number;
    createdAt: string;
    reviewedAt: string | null;
    authorName: string;
    authorColor: string;
    taskTitle: string;
    projectName: string;
  }[];
  upcoming: {
    id: string;
    title: string;
    dueDate: string;
    projectName: string;
    assigneeName: string | null;
    priority: string;
  }[];
}

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/**
 * Build the aggregated report for a user's visible projects over a date range.
 *
 * Scope rules:
 *  - A task is "in scope" when it existed during the period and was not already
 *    finished before it began: createdAt <= to AND (completedAt is null OR completedAt >= from).
 *  - "Done" counts tasks completed inside the period.
 *  - "Overdue" counts in-scope, unfinished tasks whose due date has passed.
 *  - Project progress is period-independent (current completion state).
 */
export async function getSummary(
  user: CurrentUser,
  range: DateRange,
  type: PeriodType,
  projectId?: string | null,
): Promise<Summary> {
  const now = new Date();
  const projectWhere = {
    ...projectVisibilityWhere(user),
    ...(projectId ? { id: projectId } : {}),
  };

  // One parallel wave: tasks, reports and categories filter through the project
  // relation instead of waiting for the project ids.
  const canFinance = hasPermission(user, "FINANCE_MANAGE");
  const [projects, tasks, reports, categories, contractRows] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
        owner: { select: { name: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.task.findMany({
      where: { project: projectWhere },
      select: {
        id: true,
        title: true,
        parentId: true,
        projectId: true,
        categoryId: true,
        status: true,
        priority: true,
        progress: true,
        dueDate: true,
        createdAt: true,
        completedAt: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true, avatarColor: true, jobTitle: true } },
      },
    }),
    prisma.taskReport.findMany({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        task: { project: projectWhere },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        progress: true,
        hoursSpent: true,
        createdAt: true,
        reviewedAt: true,
        authorId: true,
        author: { select: { id: true, name: true, avatarColor: true, jobTitle: true } },
        task: { select: { title: true, project: { select: { name: true } } } },
      },
    }),
    // Category breakdown only for a single-project report.
    projectId
      ? prisma.category.findMany({
          where: { project: projectWhere },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, color: true, parentId: true, startDate: true, dueDate: true, createdAt: true },
        })
      : Promise.resolve([]),
    // Contracts & costs (same records and formulas as the contracts page).
    canFinance
      ? prisma.contract.findMany({
          where: projectId ? { projectId } : { performedAt: { gte: range.from, lte: range.to } },
          orderBy: { performedAt: "asc" },
          include: { project: { select: { id: true, name: true, color: true } } },
        })
      : Promise.resolve([]),
  ]);
  const projectIds = projects.map((p) => p.id);

  const inScope = tasks.filter(
    (t) => t.createdAt <= range.to && (!t.completedAt || t.completedAt >= range.from),
  );
  const isOverdue = (t: (typeof tasks)[number]) =>
    t.status !== "DONE" && !!t.dueDate && t.dueDate < now;
  const doneInPeriod = (t: (typeof tasks)[number]) =>
    t.status === "DONE" && !!t.completedAt && t.completedAt >= range.from && t.completedAt <= range.to;

  // --- Projects ---
  const tasksByProject = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  const summaryProjects: SummaryProject[] = projects.map((p) => {
    const pts = tasksByProject.get(p.id) ?? [];
    const { progress, schedule, workload } = projectSchedule(p, pts, now);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      progress,
      schedule,
      workload,
      totalTasks: pts.length,
      doneTasks: pts.filter((t) => t.status === "DONE").length,
      overdueTasks: pts.filter(isOverdue).length,
      members: p._count.members,
      ownerName: p.owner.name,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    };
  });

  // --- Progress against deadline ---
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const scheduleRows: ScheduleRow[] = summaryProjects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    level: 0,
    startDate: p.startDate,
    dueDate: p.dueDate,
    progress: p.progress,
    schedule: p.schedule,
    workload: p.workload,
  }));
  if (categories.length) {
    const cats = categorySchedules(categories, tasksByProject.get(projectIds[0]) ?? [], projects[0].startDate, now);
    for (const m of cats.filter((c) => !c.parentId)) {
      for (const c of [m, ...cats.filter((x) => x.parentId === m.id)]) {
        scheduleRows.push({
          id: c.id,
          name: c.name,
          color: c.color,
          level: c.parentId ? 2 : 1,
          startDate: iso(c.startDate),
          dueDate: iso(c.dueDate),
          progress: c.progress,
          schedule: c.schedule,
          workload: c.workload,
        });
      }
    }
  }

  // --- People ---
  const people = new Map<string, SummaryPerson>();
  const personOf = (u: { id: string; name: string; avatarColor: string; jobTitle: string | null }) => {
    let p = people.get(u.id);
    if (!p) {
      p = {
        userId: u.id,
        name: u.name,
        avatarColor: u.avatarColor,
        jobTitle: u.jobTitle,
        assigned: 0,
        done: 0,
        inProgress: 0,
        overdue: 0,
        remaining: 0,
        reports: 0,
        hours: 0,
      };
      people.set(u.id, p);
    }
    return p;
  };
  for (const t of inScope) {
    if (!t.assignee) continue;
    const p = personOf(t.assignee);
    p.assigned += 1;
    if (doneInPeriod(t)) p.done += 1;
    else if (isOverdue(t)) p.overdue += 1;
    else if (t.status === "IN_PROGRESS" || t.status === "REVIEW") p.inProgress += 1;
    else p.remaining += 1;
  }
  for (const r of reports) {
    const p = personOf(r.author);
    p.reports += 1;
    p.hours += r.hoursSpent;
  }

  // --- Trend --- (stop at "now": never plot zeros for time that hasn't happened)
  const buckets = buildBuckets(range, type).filter((b) => b.start <= now);
  const trend = buckets.map((b) => ({ label: b.label, created: 0, completed: 0, reports: 0, hours: 0 }));
  for (const t of tasks) {
    const ci = bucketIndex(buckets, t.createdAt);
    if (ci >= 0) trend[ci].created += 1;
    if (t.completedAt && t.status === "DONE") {
      const di = bucketIndex(buckets, t.completedAt);
      if (di >= 0) trend[di].completed += 1;
    }
  }
  for (const r of reports) {
    const ri = bucketIndex(buckets, r.createdAt);
    if (ri >= 0) {
      trend[ri].reports += 1;
      trend[ri].hours += r.hoursSpent;
    }
  }

  // --- KPIs ---
  const doneTasks = inScope.filter(doneInPeriod).length;
  const hoursLogged = reports.reduce((a, r) => a + r.hoursSpent, 0);
  const overallProgress =
    summaryProjects.length === 0
      ? 0
      : Math.round(summaryProjects.reduce((a, p) => a + p.progress, 0) / summaryProjects.length);

  const upcomingLimit = addDays(now, 14);
  const upcoming = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate >= now && t.dueDate <= upcomingLimit)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      projectName: projects.find((p) => p.id === t.projectId)?.name ?? "",
      assigneeName: t.assignee?.name ?? null,
      priority: t.priority,
    }));

  // --- Contracts & costs (same records and formulas as the contracts page) ---
  let finance: SummaryFinance | undefined;
  // A project-scoped report only reaches here for a project the user can see (checked by the caller).
  if (canFinance && (!projectId || projectIds.length)) {
    const rows = contractRows.map(contractDto);
    const groups = new Map<string, typeof rows>();
    for (const r of rows) groups.set(r.projectId ?? "", [...(groups.get(r.projectId ?? "") ?? []), r]);
    const summaryOf = new Map(summaryProjects.map((p) => [p.id, p]));
    finance = {
      scope: projectId ? "project" : "period",
      totals: contractTotals(rows),
      byProject: [...groups.entries()]
        .map(([id, list]) => {
          const p = summaryOf.get(id);
          return {
            id: id || null,
            name: id ? (list[0].project?.name ?? "Dự án") : "Chưa gắn dự án",
            color: id ? (list[0].project?.color ?? "#94a3b8") : "#94a3b8",
            progress: p ? p.progress : null,
            scheduleStatus: p ? p.schedule.status : null,
            totals: contractTotals(list),
          };
        })
        .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.totals.value - a.totals.value)),
    };
  }

  return {
    period: { type, label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
    finance,
    kpis: {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status === "ACTIVE").length,
      totalTasks: inScope.length,
      doneTasks,
      inProgressTasks: inScope.filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW").length,
      overdueTasks: inScope.filter(isOverdue).length,
      completionRate: inScope.length === 0 ? 0 : Math.round((doneTasks / inScope.length) * 100),
      overallProgress,
      reportsCount: reports.length,
      hoursLogged: Math.round(hoursLogged * 10) / 10,
    },
    statusDistribution: TASK_STATUSES.map((s) => ({
      status: s,
      count: inScope.filter((t) => t.status === s).length,
    })),
    priorityDistribution: PRIORITIES.map((p) => ({
      priority: p,
      count: inScope.filter((t) => t.priority === p).length,
    })),
    trend: trend.map((b) => ({ ...b, hours: Math.round(b.hours * 10) / 10 })),
    projects: summaryProjects,
    schedule: scheduleRows,
    workload: workloadOf(tasks, now),
    people: Array.from(people.values())
      .map((p) => ({ ...p, hours: Math.round(p.hours * 10) / 10 }))
      .sort((a, b) => b.done - a.done || b.hours - a.hours),
    recentReports: reports.slice(0, 10).map((r) => ({
      id: r.id,
      content: r.content,
      progress: r.progress,
      hoursSpent: r.hoursSpent,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      authorName: r.author.name,
      authorColor: r.author.avatarColor,
      taskTitle: r.task.title,
      projectName: r.task.project.name,
    })),
    upcoming,
  };
}
