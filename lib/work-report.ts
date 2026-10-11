// Weekly / monthly work reports ("Báo cáo công việc tuần / tháng"): report
// periods, the three sections built live from a person's tasks, and the snapshot
// frozen when the report is sent. Pure (no server-only imports): shared by the
// API (lib/work-report-queries.ts), the seed and the UI.

import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfISOWeek,
  endOfMonth,
  getISOWeek,
  getISOWeekYear,
  getISOWeeksInYear,
  setISOWeek,
  startOfISOWeek,
  startOfMonth,
} from "date-fns";
import { APP_TIMEZONE } from "./period";
import { TASK_STATUS } from "./constants";

// ----------------------------------------------------------------------------
// Periods
// ----------------------------------------------------------------------------

export const WORK_PERIODS = ["WEEK", "MONTH"] as const;
export type WorkPeriodType = (typeof WORK_PERIODS)[number];

export interface WorkPeriod {
  type: WorkPeriodType;
  /** "2026-W41" (ISO week) or "2026-10". */
  key: string;
  /** First instant: Monday (or the 1st) at 00:00 in APP_TIMEZONE. */
  start: Date;
  /** Last instant: Sunday (or the last day) at 23:59:59.999 in APP_TIMEZONE. */
  end: Date;
  /** "Tuần 41 · 05/10 – 11/10/2026" or "Tháng 10/2026". */
  label: string;
  /** "Tuần 41" or "Tháng 10". */
  short: string;
}

/** A period as the API sends it. */
export type WorkPeriodJson = Omit<WorkPeriod, "start" | "end"> & { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");
const dm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const inZone = (d: Date | number) => new TZDate(typeof d === "number" ? d : d.getTime(), APP_TIMEZONE);
// Plain Dates outside this module: TZDate#toISOString carries the zone offset.
const plain = (d: Date) => new Date(d.getTime());

function weekOf(anchor: TZDate): WorkPeriod {
  const start = startOfISOWeek(anchor);
  const end = endOfISOWeek(anchor);
  const week = getISOWeek(anchor);
  const from = start.getFullYear() === end.getFullYear() ? dm(start) : `${dm(start)}/${start.getFullYear()}`;
  return {
    type: "WEEK",
    key: `${getISOWeekYear(anchor)}-W${pad(week)}`,
    start: plain(start),
    end: plain(end),
    label: `Tuần ${week} · ${from} – ${dm(end)}/${end.getFullYear()}`,
    short: `Tuần ${week}`,
  };
}

function monthOf(anchor: TZDate): WorkPeriod {
  const month = anchor.getMonth() + 1;
  const year = anchor.getFullYear();
  return {
    type: "MONTH",
    key: `${year}-${pad(month)}`,
    start: plain(startOfMonth(anchor)),
    end: plain(endOfMonth(anchor)),
    label: `Tháng ${month}/${year}`,
    short: `Tháng ${month}`,
  };
}

/** The week or month (in APP_TIMEZONE) that contains an instant. */
export function workPeriodOf(type: WorkPeriodType, instant: Date = new Date()): WorkPeriod {
  const anchor = inZone(instant);
  return type === "WEEK" ? weekOf(anchor) : monthOf(anchor);
}

/** A period from its key; null when the key is malformed or out of range. */
export function workPeriodFromKey(type: WorkPeriodType, key: string): WorkPeriod | null {
  if (type === "WEEK") {
    const m = /^(\d{4})-W(\d{2})$/.exec(key);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (year < 2000 || year > 2100) return null;
    // 4 January is always in ISO week 1; noon keeps clear of day boundaries.
    const jan4 = new TZDate(year, 0, 4, 12, 0, 0, APP_TIMEZONE);
    if (week < 1 || week > getISOWeeksInYear(jan4)) return null;
    return weekOf(setISOWeek(jan4, week));
  }
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return monthOf(new TZDate(year, month - 1, 15, 12, 0, 0, APP_TIMEZONE));
}

/** The period `step` weeks/months before (negative) or after. */
export function shiftWorkPeriod(p: WorkPeriod, step: number): WorkPeriod {
  // From mid-period, so the step never lands on a boundary.
  const start = inZone(p.start);
  const anchor = p.type === "WEEK" ? addWeeks(addDays(start, 3), step) : addMonths(addDays(start, 14), step);
  return workPeriodOf(p.type, anchor);
}

export function parseWorkPeriodType(value: string | null | undefined): WorkPeriodType | null {
  const v = value?.toUpperCase();
  return v === "WEEK" || v === "MONTH" ? v : null;
}

/** `?period=week|month&key=…` → period. No key = the current one (week by default); null when invalid. */
export function resolveWorkPeriod(type?: string | null, key?: string | null, now: Date = new Date()): WorkPeriod | null {
  const t = type ? parseWorkPeriodType(type) : "WEEK";
  if (!t) return null;
  return key ? workPeriodFromKey(t, key) : workPeriodOf(t, now);
}

export const periodJson = (p: WorkPeriod): WorkPeriodJson => ({ ...p, start: p.start.toISOString(), end: p.end.toISOString() });

/** URL query for a period: `period=week&key=2026-W41`. */
export const periodQuery = (p: { type: WorkPeriodType; key: string }) => `period=${p.type.toLowerCase()}&key=${p.key}`;

/** Section headings relative to the report's period. */
export function sectionTitles(type: WorkPeriodType) {
  return type === "WEEK"
    ? { last: "Tuần trước đã làm", current: "Tuần này đang làm", next: "Tuần tới kế hoạch", unit: "tuần" }
    : { last: "Tháng trước đã làm", current: "Tháng này đang làm", next: "Tháng tới kế hoạch", unit: "tháng" };
}

/**
 * "05/10/2026", "05/10" or "08:30 05/10/2026" in APP_TIMEZONE: report dates read the
 * same in every browser and in the server render.
 */
export function zonedText(value: Date | string | null | undefined, kind: "date" | "short" | "datetime" = "date"): string {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "";
  const d = inZone(t);
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (kind === "short") return day;
  const full = `${day}/${d.getFullYear()}`;
  return kind === "date" ? full : `${pad(d.getHours())}:${pad(d.getMinutes())} ${full}`;
}

/** "yyyy-mm-dd" of an instant in APP_TIMEZONE (for date inputs). */
export function zonedDay(value: Date | string): string {
  const d = inZone(new Date(value));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Start (00:00) or end (23:59:59.999) of a "yyyy-mm-dd" day in APP_TIMEZONE, as ISO; null when invalid. */
export function zonedDayEdge(day: string, edge: "start" | "end"): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d =
    edge === "start"
      ? new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, APP_TIMEZONE)
      : new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, APP_TIMEZONE);
  if (Number.isNaN(d.getTime())) return null;
  if (edge === "end") d.setMilliseconds(999);
  return plain(d).toISOString();
}

// ----------------------------------------------------------------------------
// Sections
// ----------------------------------------------------------------------------

type Dateish = Date | string | null;

/** A task as the builder needs it: a Prisma row (lib/work-report-queries.ts) or plain data. */
export interface ReportTaskSource {
  /** Computed from the complete project tree by the server. */
  effectiveProgress?: number;
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  startDate: Dateish;
  dueDate: Dateish;
  completedAt: Dateish;
  createdAt: Date | string;
  project: { id: string; name: string; color: string };
  parent: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
  subtasks?: { status: string; progress: number }[];
}

/** A progress report (TaskReport) the person submitted. */
export interface ReportEntrySource {
  id: string;
  content: string;
  progress: number;
  hoursSpent: number;
  createdAt: Date | string;
  task: { id: string; title: string; project: { id: string; name: string; color: string } };
}

export interface ProjectBrief {
  id: string;
  name: string;
  color: string;
}

/** One task line of a section, as shown (and as frozen in the snapshot). */
export interface WorkTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  /** DONE = 100; a task with subtasks shows their average (like the task drawer). */
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  /** Unfinished and past its due date (at build time). */
  overdue: boolean;
  project: ProjectBrief;
  parentTitle: string | null;
  assignee: { id: string; name: string } | null;
}

export interface WorkEntry {
  id: string;
  content: string;
  progress: number;
  hoursSpent: number;
  createdAt: string;
  task: { id: string; title: string };
  project: ProjectBrief;
}

export interface WorkSections {
  /** Previous period: tasks completed then, and the progress reports sent then. */
  last: { tasks: WorkTask[]; entries: WorkEntry[] };
  /** This period: open work active in it, then tasks completed in it. */
  current: WorkTask[];
  /** Next period: unfinished tasks starting or due in it. */
  next: WorkTask[];
}

const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "REVIEW", "BLOCKED"]);
const ms = (d: Dateish | undefined) => (d == null ? null : new Date(d).getTime());
const iso = (d: Dateish | undefined) => (d == null ? null : new Date(d).toISOString());
const within = (d: Dateish, p: WorkPeriod) => {
  const v = ms(d);
  return v !== null && v >= p.start.getTime() && v <= p.end.getTime();
};

export function workTaskOf(t: ReportTaskSource, now: Date = new Date()): WorkTask {
  const subs = t.subtasks ?? [];
  const progress =
    t.status === "DONE"
      ? 100
      : t.effectiveProgress !== undefined
        ? t.effectiveProgress
        : subs.length
        ? Math.round(subs.reduce((a, s) => a + (s.status === "DONE" ? 100 : s.progress), 0) / subs.length)
        : t.progress;
  const due = ms(t.dueDate);
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    progress,
    startDate: iso(t.startDate),
    dueDate: iso(t.dueDate),
    completedAt: iso(t.completedAt),
    overdue: t.status !== "DONE" && due !== null && due < now.getTime(),
    project: { id: t.project.id, name: t.project.name, color: t.project.color },
    parentTitle: t.parent?.title ?? null,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
  };
}

const byTime = (pick: (t: WorkTask) => string | null) => (a: WorkTask, b: WorkTask) =>
  (ms(pick(a)) ?? Infinity) - (ms(pick(b)) ?? Infinity) || a.title.localeCompare(b.title, "vi");

/**
 * The three sections for a report on `period`, from the author's tasks (assigned
 * to or created by them) and their progress reports. Live: rebuilt on every read.
 *  - last:    completed in the previous period + progress reports sent in it
 *  - current: unfinished and active in the period (in progress, in review, blocked,
 *             started in it, or due by its end — overdue work carries over), plus
 *             tasks completed in it; work created (or scheduled to start) after a
 *             finished period is left out of it
 *  - next:    unfinished, starting or due in the next period
 */
export function buildSections(tasks: ReportTaskSource[], entries: ReportEntrySource[], period: WorkPeriod, now: Date = new Date()): WorkSections {
  const prev = shiftWorkPeriod(period, -1);
  const next = shiftWorkPeriod(period, 1);
  const end = period.end.getTime();
  // Until the period is over, today's status speaks for it (work started ahead of schedule counts).
  const running = now.getTime() <= end;
  const lastDone: WorkTask[] = [];
  const open: WorkTask[] = [];
  const doneNow: WorkTask[] = [];
  const plan: WorkTask[] = [];

  for (const source of tasks) {
    const task = workTaskOf(source, now);
    if (source.status === "DONE") {
      if (within(source.completedAt, prev)) lastDone.push(task);
      if (within(source.completedAt, period)) doneNow.push(task);
      continue;
    }
    const start = ms(source.startDate);
    const due = ms(source.dueDate);
    const working = ACTIVE_STATUSES.has(source.status);
    const existed = (ms(source.createdAt) ?? 0) <= end && (start === null || start <= end || (running && working));
    const active = working || (due !== null && due <= end) || within(source.startDate, period);
    if (existed && active) open.push(task);
    if (within(source.startDate, next) || within(source.dueDate, next)) plan.push(task);
  }

  open.sort((a, b) => Number(b.overdue) - Number(a.overdue) || byTime((t) => t.dueDate)(a, b));
  return {
    last: {
      tasks: lastDone.sort(byTime((t) => t.completedAt)),
      entries: entries
        .filter((e) => within(e.createdAt, prev))
        .map((e) => ({
          id: e.id,
          content: e.content,
          progress: e.progress,
          hoursSpent: e.hoursSpent,
          createdAt: iso(e.createdAt)!,
          task: { id: e.task.id, title: e.task.title },
          project: { id: e.task.project.id, name: e.task.project.name, color: e.task.project.color },
        }))
        .sort((a, b) => ms(a.createdAt)! - ms(b.createdAt)!),
    },
    current: [...open, ...doneNow.sort(byTime((t) => t.completedAt))],
    next: plan.sort(byTime((t) => t.startDate ?? t.dueDate)),
  };
}

// ----------------------------------------------------------------------------
// Projects, notes, snapshot
// ----------------------------------------------------------------------------

/** A project the author owns or manages, with its progress and deadline status. */
export interface WorkProject extends ProjectBrief {
  status: string;
  role: "OWNER" | "MANAGER";
  progress: number;
  /** Planned completion by now (lib/schedule.ts), null without a deadline. */
  planned: number | null;
  scheduleStatus: string;
  daysLeft: number | null;
  dueDate: string | null;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
}

export interface WorkNotes {
  /** Previous period: results. */
  doneNote: string | null;
  /** This period: notes. */
  doingNote: string | null;
  /** Next period: plan. */
  planNote: string | null;
  /** Difficulties and requests. */
  issues: string | null;
}

export const NOTE_FIELDS = ["doneNote", "doingNote", "planNote", "issues"] as const;
export const emptyNotes = (): WorkNotes => ({ doneNote: null, doingNote: null, planNote: null, issues: null });
export const notesOf = (r: Partial<Record<keyof WorkNotes, string | null>> | null | undefined): WorkNotes => ({
  doneNote: r?.doneNote ?? null,
  doingNote: r?.doingNote ?? null,
  planNote: r?.planNote ?? null,
  issues: r?.issues ?? null,
});
export const sameNotes = (a: WorkNotes, b: WorkNotes) => NOTE_FIELDS.every((k) => (a[k] ?? "") === (b[k] ?? ""));

/** What the report said when it was sent (WorkReport.snapshot). */
export interface WorkSnapshot {
  version: 1;
  takenAt: string;
  notes: WorkNotes;
  sections: WorkSections;
  projects: WorkProject[];
}

export function takeSnapshot(sections: WorkSections, projects: WorkProject[], notes: WorkNotes, now: Date = new Date()): WorkSnapshot {
  return { version: 1, takenAt: now.toISOString(), notes, sections, projects };
}

export function readSnapshot(value: unknown): WorkSnapshot | null {
  const s = value as WorkSnapshot | null;
  return s && s.version === 1 && s.sections ? s : null;
}

// ----------------------------------------------------------------------------
// Reported vs now
// ----------------------------------------------------------------------------

/**
 * One line of a section with what was reported and what is true now:
 *  - live:    no snapshot yet (draft)
 *  - same / changed: in the snapshot and still in this section
 *  - added:   in the section now, not when the report was sent
 *  - left:    sent in this section, now elsewhere (e.g. finished); `live` = its state now
 *  - gone:    sent, but the task no longer exists
 */
export type RowState = "live" | "same" | "changed" | "added" | "left" | "gone";

export interface WorkRow<T> {
  id: string;
  live: T | null;
  reported: T | null;
  state: RowState;
}

export function mergeRows<T extends { id: string }>(
  live: T[],
  reported: T[] | null,
  differs: (was: T, now: T) => boolean,
  lookup?: Map<string, T>,
): WorkRow<T>[] {
  if (!reported) return live.map((t) => ({ id: t.id, live: t, reported: null, state: "live" }));
  const now = new Map(live.map((t) => [t.id, t]));
  const rows: WorkRow<T>[] = reported.map((r) => {
    const current = now.get(r.id);
    if (current) return { id: r.id, live: current, reported: r, state: differs(r, current) ? "changed" : "same" };
    const elsewhere = lookup?.get(r.id);
    return elsewhere ? { id: r.id, live: elsewhere, reported: r, state: "left" } : { id: r.id, live: null, reported: r, state: "gone" };
  });
  const sent = new Set(reported.map((r) => r.id));
  for (const t of live) if (!sent.has(t.id)) rows.push({ id: t.id, live: t, reported: null, state: "added" });
  return rows;
}

export const taskDiffers = (a: WorkTask, b: WorkTask) => a.status !== b.status || a.progress !== b.progress || a.dueDate !== b.dueDate;
export const projectDiffers = (a: WorkProject, b: WorkProject) => a.progress !== b.progress || a.scheduleStatus !== b.scheduleStatus;
export const entryDiffers = () => false;

/** The row's item: today's state when it still exists, otherwise what was reported. */
export const rowItem = <T,>(row: WorkRow<T>): T => (row.live ?? row.reported)!;

export function statusLabel(status: string): string {
  return TASK_STATUS[status as keyof typeof TASK_STATUS]?.label ?? status;
}

/** "Đang làm · 40%". */
export const taskStateLabel = (t: Pick<WorkTask, "status" | "progress">) => `${statusLabel(t.status)} · ${t.progress}%`;

/** Rows grouped by project (alphabetical), keeping the row order inside each group. */
export function groupByProject<T extends { project: ProjectBrief }>(rows: WorkRow<T>[]): { project: ProjectBrief; rows: WorkRow<T>[] }[] {
  const groups = new Map<string, { project: ProjectBrief; rows: WorkRow<T>[] }>();
  for (const row of rows) {
    const project = rowItem(row).project;
    const g = groups.get(project.id) ?? { project, rows: [] };
    g.rows.push(row);
    groups.set(project.id, g);
  }
  return Array.from(groups.values()).sort((a, b) => a.project.name.localeCompare(b.project.name, "vi"));
}

// ----------------------------------------------------------------------------
// API payloads
// ----------------------------------------------------------------------------

export interface WorkAuthor {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarColor: string;
  role: string;
}

export interface WorkReportRecord {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  notes: WorkNotes;
  submittedAt: string | null;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewedBy: { id: string; name: string } | null;
  /** Sent, then the notes were edited without sending again. */
  editedSinceSubmit: boolean;
  /** Reviewed before the latest sending. */
  reviewStale: boolean;
}

export interface WorkTotals {
  lastDone: number;
  entries: number;
  hours: number;
  currentOpen: number;
  currentDone: number;
  overdue: number;
  next: number;
}

export function totalsOf(s: WorkSections): WorkTotals {
  return {
    lastDone: s.last.tasks.length,
    entries: s.last.entries.length,
    hours: Math.round(s.last.entries.reduce((a, e) => a + e.hoursSpent, 0) * 10) / 10,
    currentOpen: s.current.filter((t) => t.status !== "DONE").length,
    currentDone: s.current.filter((t) => t.status === "DONE").length,
    overdue: s.current.filter((t) => t.overdue).length,
    next: s.next.length,
  };
}

/** GET /api/work-reports: one person's report on one period. */
export interface WorkReportData {
  period: WorkPeriodJson;
  prev: WorkPeriodJson;
  next: WorkPeriodJson;
  author: WorkAuthor;
  report: WorkReportRecord | null;
  /** When the snapshot was taken (the last sending), null for drafts. */
  snapshotAt: string | null;
  sections: {
    last: { tasks: WorkRow<WorkTask>[]; entries: WorkRow<WorkEntry>[] };
    current: WorkRow<WorkTask>[];
    next: WorkRow<WorkTask>[];
  };
  projects: WorkRow<WorkProject>[];
  /** Counts from the live sections. */
  totals: WorkTotals;
  canEdit: boolean;
  canReview: boolean;
  /** Tasks (task drawer) and projects the viewer may open; others show without a link. */
  openable: string[];
  /** For the author: projects where they can add plan items for themselves. */
  planProjects: ProjectBrief[];
}

export type WorkReportState = "NONE" | "DRAFT" | "SUBMITTED";

/** One row of the boss overview (GET /api/work-reports/team). */
export interface TeamMemberReport {
  author: WorkAuthor;
  state: WorkReportState;
  report: WorkReportRecord | null;
  totals: WorkTotals;
  /** The full report, with ?detail=1 (overview export). */
  view?: WorkReportData;
}

export interface TeamWorkReports {
  period: WorkPeriodJson;
  prev: WorkPeriodJson;
  next: WorkPeriodJson;
  members: TeamMemberReport[];
}
