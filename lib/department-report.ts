import { periodJson, shiftWorkPeriod, workTaskOf, type ReportTaskSource, type WorkPeriod, type WorkPeriodJson, type WorkTask } from "./work-report";

export interface DepartmentTaskSource extends ReportTaskSource {
  description: string | null;
  project: ReportTaskSource["project"] & { status: string };
  category: { name: string; parent: { name: string } | null } | null;
  reports: { id: string; content: string; createdAt: Date | string; progress: number; author: { name: string } }[];
}
export interface DepartmentTask extends WorkTask {
  description: string | null;
  category: string;
  projectStatus: string;
}
export interface DepartmentUpdate {
  id: string; content: string; createdAt: string; progress: number; author: string;
}
export interface DepartmentRow { task: DepartmentTask; updates: DepartmentUpdate[] }
export interface DepartmentBucket { id: string; label: string; rows: DepartmentRow[] }
export interface DepartmentSection {
  id: "previous" | "current" | "next";
  title: string;
  period: WorkPeriodJson;
  buckets: DepartmentBucket[];
}
export interface DepartmentReport {
  asOf: string;
  week: string;
  projectId: string | null;
  sections: DepartmentSection[];
  unscheduled: DepartmentTask[];
  missingCompletion: DepartmentTask[];
  counts: { previousDone: number; previousOutstanding: number; currentOpen: number; currentDone: number; carryover: number; nextPlanned: number; blocked: number };
}

const active = new Set(["IN_PROGRESS", "REVIEW", "BLOCKED"]);
const inPeriod = (value: Date | string | null, p: WorkPeriod) => value !== null && new Date(value) >= p.start && new Date(value) <= p.end;
const compareTasks = (a: DepartmentTask, b: DepartmentTask) =>
  (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity) || a.title.localeCompare(b.title, "vi");

/** A live report, never a reconstruction of historical status. Only leaf tasks enter this builder. */
export function buildDepartmentReport(sources: DepartmentTaskSource[], period: WorkPeriod, projectId: string | null, now = new Date()): DepartmentReport {
  const previous = shiftWorkPeriod(period, -1);
  const next = shiftWorkPeriod(period, 1);
  const bucket = (id: string, label: string): DepartmentBucket => ({ id, label, rows: [] });
  const sections: DepartmentSection[] = [
    { id: "previous", title: "Tuần trước · Kết quả & tồn đọng", period: periodJson(previous), buckets: [
      bucket("completed", "Đã hoàn thành trong tuần"), bucket("outstanding", "Đến hạn tuần trước · Hiện vẫn chưa xong"),
      bucket("completedLater", "Đến hạn tuần trước · Đã hoàn thành sau tuần"), bucket("activity", "Cập nhật công việc trong tuần"),
    ] },
    { id: "current", title: "Tuần này · Việc phải làm", period: periodJson(period), buckets: [
      bucket("carryover", "Tồn từ các tuần trước · Cần xử lý"), bucket("due", "Phải hoàn thành theo deadline tuần này"),
      bucket("active", "Đang triển khai / Bắt đầu trong tuần"), bucket("completed", "Đã hoàn thành trong tuần"),
    ] },
    { id: "next", title: "Tuần tới · Kế hoạch thực hiện", period: periodJson(next), buckets: [
      bucket("due", "Phải hoàn thành theo deadline tuần tới"), bucket("starting", "Dự kiến bắt đầu trong tuần tới"),
      bucket("continuing", "Tiếp tục theo lịch triển khai"),
    ] },
  ];
  const unscheduled: DepartmentTask[] = [];
  const missingCompletion: DepartmentTask[] = [];
  const add = (sectionIndex: number, bucketId: string, task: DepartmentTask, source: DepartmentTaskSource) => {
    const range = [previous, period, next][sectionIndex];
    const updates = source.reports.filter(r => inPeriod(r.createdAt, range) && new Date(r.createdAt) <= now)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(r => ({ id: r.id, content: r.content, progress: r.progress, author: r.author.name, createdAt: new Date(r.createdAt).toISOString() }));
    sections[sectionIndex].buckets.find(b => b.id === bucketId)!.rows.push({ task, updates });
  };

  for (const source of sources) {
    if (source.project.status === "CANCELLED" || (projectId && source.project.id !== projectId) || new Date(source.createdAt) > now) continue;
    const task: DepartmentTask = {
      ...workTaskOf(source, now), description: source.description, projectStatus: source.project.status,
      category: source.category ? [source.category.parent?.name, source.category.name].filter(Boolean).join(" / ") : "Chưa phân hạng mục",
    };
    const done = task.status === "DONE";
    const completed = task.completedAt && new Date(task.completedAt) <= now ? task.completedAt : null;
    const existed = (p: WorkPeriod) => new Date(source.createdAt) <= p.end;
    const startedBy = (p: WorkPeriod) => task.startDate !== null && new Date(task.startDate) <= p.end;
    const updatesIn = (p: WorkPeriod) => source.reports.some(r => inPeriod(r.createdAt, p) && new Date(r.createdAt) <= now);

    if (!done && !task.dueDate) unscheduled.push(task);
    if (done && !completed) missingCompletion.push(task);

    if (existed(previous)) {
      if (done && inPeriod(completed, previous)) add(0, "completed", task, source);
      else if (!done && inPeriod(task.dueDate, previous)) add(0, "outstanding", task, source);
      else if (done && completed && new Date(completed) > previous.end && inPeriod(task.dueDate, previous)) add(0, "completedLater", task, source);
      else if (updatesIn(previous)) add(0, "activity", task, source);
    }
    if (existed(period)) {
      if (done && inPeriod(completed, period)) add(1, "completed", task, source);
      else if (!done) {
        if (task.dueDate && new Date(task.dueDate) < period.start) add(1, "carryover", task, source);
        else if (inPeriod(task.dueDate, period)) add(1, "due", task, source);
        else if (startedBy(period) || (!task.startDate && active.has(task.status)) || updatesIn(period)) add(1, "active", task, source);
      }
    }
    // A missed current deadline is not automatically a commitment to work next week.
    // Continuing work requires an actual date range, not an invented future plan.
    if (!done && existed(next)) {
      if (inPeriod(task.dueDate, next)) add(2, "due", task, source);
      else if (inPeriod(task.startDate, next)) add(2, "starting", task, source);
      else if (startedBy(next) && task.dueDate && new Date(task.dueDate) > next.end) add(2, "continuing", task, source);
    }
  }
  for (const section of sections) for (const b of section.buckets) b.rows.sort((a, b) => compareTasks(a.task, b.task));
  unscheduled.sort(compareTasks);
  missingCompletion.sort(compareTasks);
  const count = (index: number, id: string) => sections[index].buckets.find(b => b.id === id)!.rows.length;
  return {
    asOf: now.toISOString(), week: period.key, projectId, sections, unscheduled, missingCompletion,
    counts: {
      previousDone: count(0, "completed"), previousOutstanding: count(0, "outstanding"),
      currentOpen: sections[1].buckets.filter(b => b.id !== "completed").reduce((n, b) => n + b.rows.length, 0),
      currentDone: count(1, "completed"), carryover: count(1, "carryover"),
      nextPlanned: sections[2].buckets.reduce((n, b) => n + b.rows.length, 0),
      blocked: sections[1].buckets.flatMap(b => b.rows).filter(r => r.task.status === "BLOCKED").length,
    },
  };
}

/** Shared ordering for the screen and exported file. Stable project IDs prevent name collisions. */
export function departmentGroups(rows: DepartmentRow[]) {
  const groups = new Map<string, { project: WorkTask["project"]; category: string; rows: DepartmentRow[] }>();
  for (const row of rows) {
    const key = JSON.stringify([row.task.project.id, row.task.category]);
    if (!groups.has(key)) groups.set(key, { project: row.task.project, category: row.task.category, rows: [] });
    groups.get(key)!.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.project.name.localeCompare(b.project.name, "vi") || a.category.localeCompare(b.category, "vi"));
}
