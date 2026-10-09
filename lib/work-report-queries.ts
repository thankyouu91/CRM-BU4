import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { canViewAllProjects } from "./rbac";
import { projectSchedule } from "./stats";
import { canReviewWorkReport, canViewWorkReport, roleLevel } from "./permissions";
import {
  buildSections,
  entryDiffers,
  mergeRows,
  notesOf,
  periodJson,
  projectDiffers,
  readSnapshot,
  sameNotes,
  shiftWorkPeriod,
  takeSnapshot,
  taskDiffers,
  totalsOf,
  workTaskOf,
  type ProjectBrief,
  type TeamMemberReport,
  type TeamWorkReports,
  type WorkAuthor,
  type WorkNotes,
  type WorkPeriod,
  type WorkProject,
  type WorkReportData,
  type WorkReportRecord,
  type WorkSections,
  type WorkTask,
} from "./work-report";
import type { CurrentUser } from "./session";

// Server side of the weekly / monthly work reports: one batch of queries loads
// everything for any number of authors (the boss overview reads the whole team
// with the same five queries as a single report).

const authorSelect = { id: true, name: true, role: true, jobTitle: true, avatarColor: true } as const;
type AuthorRow = WorkAuthor;

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  progress: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  assigneeId: true,
  createdById: true,
  project: { select: { id: true, name: true, color: true, ownerId: true } },
  parent: { select: { id: true, title: true } },
  assignee: { select: { id: true, name: true } },
  subtasks: { select: { status: true, progress: true } },
} satisfies Prisma.TaskSelect;
type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

const recordInclude = { reviewedBy: { select: { id: true, name: true } } } satisfies Prisma.WorkReportInclude;
type RecordRow = Prisma.WorkReportGetPayload<{ include: typeof recordInclude }>;

function recordJson(r: RecordRow): WorkReportRecord {
  const notes = notesOf(r);
  const snapshot = readSnapshot(r.snapshot);
  return {
    id: r.id,
    status: r.status,
    notes,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewNote: r.reviewNote,
    reviewedBy: r.reviewedBy,
    editedSinceSubmit: r.status === "SUBMITTED" && !!snapshot && !sameNotes(snapshot.notes, notes),
    reviewStale: !!r.reviewedAt && !!r.submittedAt && r.reviewedAt < r.submittedAt,
  };
}

interface Loaded {
  tasks: TaskRow[];
  entries: Awaited<ReturnType<typeof loadEntries>>;
  records: RecordRow[];
  projects: Awaited<ReturnType<typeof loadProjects>>;
  /** Projects the viewer can open; null = every project. */
  viewerProjects: Set<string> | null;
  planProjects: ProjectBrief[];
}

function loadEntries(ids: string[], period: WorkPeriod) {
  const prev = shiftWorkPeriod(period, -1);
  return prisma.taskReport.findMany({
    where: { authorId: { in: ids }, createdAt: { gte: prev.start, lte: prev.end } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authorId: true,
      content: true,
      progress: true,
      hoursSpent: true,
      createdAt: true,
      task: { select: { id: true, title: true, project: { select: { id: true, name: true, color: true, ownerId: true } } } },
    },
  });
}

function loadProjects(ids: string[]) {
  return prisma.project.findMany({
    where: { status: { not: "CANCELLED" }, OR: [{ ownerId: { in: ids } }, { members: { some: { userId: { in: ids }, role: "MANAGER" } } }] },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      status: true,
      startDate: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      members: { where: { userId: { in: ids }, role: "MANAGER" }, select: { userId: true } },
      tasks: { select: { id: true, parentId: true, status: true, progress: true, dueDate: true } },
    },
  });
}

/**
 * Everything the reports of `authors` on `period` need. `detail` adds the projects
 * section, the viewer's openable projects and (for their own report) plan projects;
 * the overview counts skip them.
 */
async function load(viewer: CurrentUser, authors: AuthorRow[], period: WorkPeriod, detail: boolean): Promise<Loaded> {
  const ids = authors.map((a) => a.id);
  const prev = shiftWorkPeriod(period, -1);
  const own = detail && ids.includes(viewer.id);
  const seesAll = canViewAllProjects(viewer);
  const [tasks, entries, records, projects, memberships, planProjects] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [{ assigneeId: { in: ids } }, { createdById: { in: ids } }],
        // Unfinished work, or finished recently enough to fall in one of the sections.
        AND: [{ OR: [{ status: { not: "DONE" } }, { completedAt: { gte: prev.start } }] }],
      },
      select: taskSelect,
    }),
    loadEntries(ids, period),
    prisma.workReport.findMany({ where: { userId: { in: ids }, period: period.type, periodStart: period.start }, include: recordInclude }),
    detail ? loadProjects(ids) : Promise.resolve([]),
    detail && !seesAll ? prisma.projectMember.findMany({ where: { userId: viewer.id }, select: { projectId: true } }) : Promise.resolve([]),
    // Plan items are assigned to the author, so only projects they can be given work in.
    own
      ? prisma.project.findMany({
          where: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            OR: [{ ownerId: viewer.id }, { members: { some: { userId: viewer.id, role: { in: ["MANAGER", "MEMBER"] } } } }],
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    tasks,
    entries,
    records,
    projects,
    viewerProjects: seesAll ? null : new Set(memberships.map((m) => m.projectId)),
    planProjects,
  };
}

interface Live {
  sections: WorkSections;
  projects: WorkProject[];
}

function liveFor(author: AuthorRow, loaded: Loaded, period: WorkPeriod, now: Date): Live {
  const tasks = loaded.tasks.filter((t) => t.assigneeId === author.id || t.createdById === author.id);
  const entries = loaded.entries.filter((e) => e.authorId === author.id);
  const sections = buildSections(tasks, entries, period, now);
  const recent = shiftWorkPeriod(period, -1).start;
  const projects = loaded.projects
    .filter((p) => p.ownerId === author.id || p.members.some((m) => m.userId === author.id))
    // Finished projects only while the report still covers their last activity.
    .filter((p) => p.status !== "COMPLETED" || p.updatedAt >= recent)
    .map((p): WorkProject => {
      const { progress, workload, schedule } = projectSchedule(p, p.tasks, now);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        status: p.status,
        role: p.ownerId === author.id ? "OWNER" : "MANAGER",
        progress,
        planned: schedule.planned,
        scheduleStatus: schedule.status,
        daysLeft: schedule.daysLeft,
        dueDate: p.dueDate?.toISOString() ?? null,
        totalTasks: workload.total,
        doneTasks: workload.done,
        overdueTasks: workload.overdue,
      };
    });
  return { sections, projects };
}

const snapshotTaskIds = (s: WorkSections) => [...s.last.tasks, ...s.current, ...s.next].map((t) => t.id);

/** Today's state of snapshot tasks that are no longer among the loaded ones (reassigned, finished long ago…). */
async function lookupMissing(loaded: Loaded): Promise<TaskRow[]> {
  const known = new Set(loaded.tasks.map((t) => t.id));
  const missing = new Set<string>();
  for (const r of loaded.records) {
    const snap = readSnapshot(r.snapshot);
    if (snap) for (const id of snapshotTaskIds(snap.sections)) if (!known.has(id)) missing.add(id);
  }
  if (!missing.size) return [];
  return prisma.task.findMany({ where: { id: { in: Array.from(missing) } }, select: taskSelect });
}

function assemble(
  viewer: CurrentUser,
  author: AuthorRow,
  period: WorkPeriod,
  live: Live,
  record: RecordRow | null,
  loaded: Loaded,
  extra: TaskRow[],
  now: Date,
): WorkReportData {
  const snapshot = record?.status === "SUBMITTED" ? readSnapshot(record.snapshot) : null;
  const lookup = new Map<string, WorkTask>();
  const owners = new Map<string, { projectId: string; ownerId: string }>();
  for (const t of [...loaded.tasks, ...extra]) {
    lookup.set(t.id, workTaskOf(t, now));
    owners.set(t.id, { projectId: t.project.id, ownerId: t.project.ownerId });
  }
  for (const e of loaded.entries) owners.set(e.task.id, { projectId: e.task.project.id, ownerId: e.task.project.ownerId });

  const s = live.sections;
  const sections: WorkReportData["sections"] = {
    last: {
      tasks: mergeRows(s.last.tasks, snapshot?.sections.last.tasks ?? null, taskDiffers, lookup),
      entries: mergeRows(s.last.entries, snapshot?.sections.last.entries ?? null, entryDiffers),
    },
    current: mergeRows(s.current, snapshot?.sections.current ?? null, taskDiffers, lookup),
    next: mergeRows(s.next, snapshot?.sections.next ?? null, taskDiffers, lookup),
  };

  const canOpen = (taskId: string) => {
    const o = owners.get(taskId);
    if (!o) return false;
    return !loaded.viewerProjects || o.ownerId === viewer.id || loaded.viewerProjects.has(o.projectId);
  };
  const shown = [
    ...sections.last.tasks,
    ...sections.current,
    ...sections.next,
    ...sections.last.entries.map((r) => ({ id: (r.live ?? r.reported)!.task.id, live: r.live })),
  ];
  const openable = Array.from(new Set(shown.filter((r) => r.live && canOpen(r.id)).map((r) => r.id)));
  // Project links: the author's own projects, when the viewer can open them too.
  for (const p of loaded.projects) {
    if (live.projects.some((lp) => lp.id === p.id) && (!loaded.viewerProjects || p.ownerId === viewer.id || loaded.viewerProjects.has(p.id))) {
      openable.push(p.id);
    }
  }

  return {
    period: periodJson(period),
    prev: periodJson(shiftWorkPeriod(period, -1)),
    next: periodJson(shiftWorkPeriod(period, 1)),
    author: { id: author.id, name: author.name, jobTitle: author.jobTitle, avatarColor: author.avatarColor, role: author.role },
    report: record ? recordJson(record) : null,
    snapshotAt: snapshot?.takenAt ?? null,
    sections,
    projects: mergeRows(live.projects, snapshot?.projects ?? null, projectDiffers),
    totals: totalsOf(s),
    canEdit: viewer.id === author.id,
    canReview: canReviewWorkReport(viewer, author),
    openable,
    planProjects: viewer.id === author.id ? loaded.planProjects : [],
  };
}

async function views(viewer: CurrentUser, authors: AuthorRow[], period: WorkPeriod, now = new Date()): Promise<WorkReportData[]> {
  if (!authors.length) return [];
  const loaded = await load(viewer, authors, period, true);
  const extra = await lookupMissing(loaded);
  return authors.map((a) =>
    assemble(viewer, a, period, liveFor(a, loaded, period, now), loaded.records.find((r) => r.userId === a.id) ?? null, loaded, extra, now),
  );
}

const asAuthor = (u: CurrentUser): AuthorRow => ({ id: u.id, name: u.name, role: u.role, jobTitle: u.jobTitle, avatarColor: u.avatarColor });

/** One person's report as `viewer` may see it; "forbidden" outside the visibility rule, null for an unknown person. */
export async function workReportView(viewer: CurrentUser, authorId: string, period: WorkPeriod): Promise<WorkReportData | "forbidden" | null> {
  const author = authorId === viewer.id ? asAuthor(viewer) : await prisma.user.findUnique({ where: { id: authorId }, select: authorSelect });
  if (!author) return null;
  if (!canViewWorkReport(viewer, author)) return "forbidden";
  return (await views(viewer, [author], period))[0];
}

/**
 * Everyone whose reports the viewer may read (active accounts, higher levels
 * first) with the state of their report on `period`. `detail` adds each full report.
 */
export async function teamWorkReports(viewer: CurrentUser, period: WorkPeriod, detail = false): Promise<TeamWorkReports> {
  const users = await prisma.user.findMany({ where: { active: true, id: { not: viewer.id } }, orderBy: { name: "asc" }, select: authorSelect });
  const team = users
    .filter((u) => canViewWorkReport(viewer, u))
    .sort((a, b) => roleLevel(b.role) - roleLevel(a.role) || a.name.localeCompare(b.name, "vi"));

  let members: TeamMemberReport[];
  if (detail) {
    members = (await views(viewer, team, period)).map((view) => ({
      author: view.author,
      state: view.report?.status ?? "NONE",
      report: view.report,
      totals: view.totals,
      view,
    }));
  } else {
    const now = new Date();
    const loaded = team.length ? await load(viewer, team, period, false) : null;
    members = team.map((a) => {
      const record = loaded?.records.find((r) => r.userId === a.id) ?? null;
      return {
        author: a,
        state: record?.status ?? "NONE",
        report: record ? recordJson(record) : null,
        totals: loaded ? totalsOf(liveFor(a, loaded, period, now).sections) : totalsOf({ last: { tasks: [], entries: [] }, current: [], next: [] }),
      };
    });
  }
  return { period: periodJson(period), prev: periodJson(shiftWorkPeriod(period, -1)), next: periodJson(shiftWorkPeriod(period, 1)), members };
}

const periodWhere = (userId: string, period: WorkPeriod) => ({
  userId_period_periodStart: { userId, period: period.type, periodStart: period.start },
});

/** Save the author's notes (creates the draft on first save; a sent report stays sent). */
export async function saveWorkNotes(me: CurrentUser, period: WorkPeriod, notes: Partial<WorkNotes>): Promise<WorkReportRecord> {
  const record = await prisma.workReport.upsert({
    where: periodWhere(me.id, period),
    create: { userId: me.id, period: period.type, periodStart: period.start, ...notes },
    update: notes,
    include: recordInclude,
  });
  return recordJson(record);
}

/**
 * Send (or send again): saves the notes, freezes the sections, projects and notes
 * as they are now, and stamps submittedAt. The answer is the report as now shown.
 */
export async function submitWorkReport(me: CurrentUser, period: WorkPeriod, notes: Partial<WorkNotes>): Promise<WorkReportData> {
  const now = new Date();
  const author = asAuthor(me);
  const loaded = await load(me, [author], period, true);
  const live = liveFor(author, loaded, period, now);
  const existing = loaded.records[0];
  const merged = { ...notesOf(existing), ...notes };
  const snapshot = takeSnapshot(live.sections, live.projects, merged, now);
  const data = { ...merged, status: "SUBMITTED" as const, submittedAt: now, snapshot: snapshot as unknown as Prisma.InputJsonValue };
  const record = await prisma.workReport.upsert({
    where: periodWhere(me.id, period),
    create: { userId: me.id, period: period.type, periodStart: period.start, ...data },
    update: data,
    include: recordInclude,
  });
  return assemble(me, author, period, live, record, loaded, [], now);
}

/** A person above the author marks a sent report as seen, with an optional note. */
export async function reviewWorkReport(viewer: CurrentUser, id: string, reviewNote: string | null) {
  const report = await prisma.workReport.findUnique({
    where: { id },
    select: { id: true, status: true, user: { select: { id: true, role: true } } },
  });
  if (!report || !canViewWorkReport(viewer, report.user)) return "not-found" as const;
  if (!canReviewWorkReport(viewer, report.user)) return "forbidden" as const;
  if (report.status !== "SUBMITTED") return "draft" as const;
  const record = await prisma.workReport.update({
    where: { id },
    data: { reviewedById: viewer.id, reviewedAt: new Date(), reviewNote: reviewNote?.trim() || null },
    include: recordInclude,
  });
  return recordJson(record);
}
