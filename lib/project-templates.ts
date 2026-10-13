// Project templates ("Mẫu dự án"): a project's structure saved as versioned JSON
// (ProjectTemplate.data) and turned back into rows for a new project. Pure (no
// server-only imports), so the snapshot and the date math are unit-tested without
// a database; lib/project-template-service.ts does the reads and writes.
//
// Dates are kept as whole days from an anchor day: the project's start date, else
// the earliest category/task date, else the day the project was created. Days are
// calendar days in APP_TIMEZONE, so a start entered as 00:00 in Vietnam (17:00 UTC
// the day before) stays on its day. A new project puts start dates at 00:00 and
// due dates at 23:59:59 of the shifted day, like the date inputs do.
//
// Only the structure is copied: no assignees, statuses, progress, reports, notes
// or contracts.

import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { APP_TIMEZONE } from "./period";
import { InputError } from "./errors";

export const TEMPLATE_VERSION = 1;
export const MAX_TEMPLATE_CATEGORIES = 100;
export const MAX_TEMPLATE_TASKS = 500;

const DAY = 86_400_000;
const offset = z.number().int().min(-100_000).max(100_000).nullable();
const ref = z.string().min(1).max(40);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const categorySchema = z.object({
  ref,
  name: z.string().min(1),
  color: z.string().max(100),
  parentRef: ref.nullable(),
  order: z.number().int(),
  startOffset: offset,
  dueOffset: offset,
});

const taskSchema = z.object({
  ref,
  title: z.string().min(1),
  description: z.string().nullable(),
  priority,
  categoryRef: ref.nullable(),
  parentRef: ref.nullable(),
  startOffset: offset,
  dueOffset: offset,
});

export const templateDataSchema = z
  .object({
    version: z.literal(TEMPLATE_VERSION),
    color: z.string().max(100).optional(),
    categories: z.array(categorySchema).max(MAX_TEMPLATE_CATEGORIES, `Một mẫu chứa tối đa ${MAX_TEMPLATE_CATEGORIES} hạng mục`),
    tasks: z.array(taskSchema).max(MAX_TEMPLATE_TASKS, `Một mẫu chứa tối đa ${MAX_TEMPLATE_TASKS} công việc`),
  })
  .superRefine((data, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const cats = new Map(data.categories.map((c) => [c.ref, c]));
    const tasks = new Map(data.tasks.map((t) => [t.ref, t]));
    if (cats.size !== data.categories.length) issue("Mã hạng mục bị trùng");
    if (tasks.size !== data.tasks.length) issue("Mã công việc bị trùng");
    // Two levels of categories, like the app (lib/category-rules.ts).
    for (const c of data.categories) {
      if (c.parentRef === null) continue;
      const parent = cats.get(c.parentRef);
      if (!parent || parent.ref === c.ref || parent.parentRef !== null) issue(`Hạng mục “${c.name}” có hạng mục lớn không hợp lệ`);
    }
    for (const t of data.tasks) {
      if (t.categoryRef !== null && !cats.has(t.categoryRef)) issue(`Công việc “${t.title}” thuộc hạng mục không có trong mẫu`);
      // Walk up the parents: each must exist and the chain must end (no cycle).
      const seen = new Set([t.ref]);
      for (let p = t.parentRef; p !== null; p = tasks.get(p)!.parentRef) {
        if (!tasks.has(p) || seen.has(p)) {
          issue(`Công việc “${t.title}” có công việc cha không hợp lệ`);
          break;
        }
        seen.add(p);
      }
    }
  });

export type TemplateData = z.infer<typeof templateDataSchema>;
export type TemplateCategory = TemplateData["categories"][number];
export type TemplateTask = TemplateData["tasks"][number];

/** Stored template JSON → TemplateData; a clear error for an unknown version or damaged data. */
export function parseTemplateData(value: unknown): TemplateData {
  const parsed = templateDataSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const version = (value as { version?: unknown } | null)?.version;
  if (version !== TEMPLATE_VERSION) throw new InputError("Mẫu dự án thuộc phiên bản không còn hỗ trợ. Hãy lưu lại mẫu từ một dự án.");
  throw new InputError(`Dữ liệu mẫu dự án không hợp lệ: ${parsed.error.issues[0]?.message ?? "lỗi không rõ"}`);
}

export const templateCounts = (data: Pick<TemplateData, "categories" | "tasks">) => ({ categories: data.categories.length, tasks: data.tasks.length });

// ----------------------------------------------------------------------------
// Calendar days in APP_TIMEZONE
// ----------------------------------------------------------------------------

/** Day number (days since 1970-01-01) of the calendar day an instant falls on in APP_TIMEZONE. */
export function zonedDayNumber(at: Date | string): number {
  const d = new TZDate(new Date(at).getTime(), APP_TIMEZONE);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
}

/** "yyyy-mm-dd" → day number; null when it is not a real calendar day. */
export function dayNumber(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t / DAY : null;
}

/** 00:00:00 or 23:59:59 of a day number in APP_TIMEZONE, as a plain Date. */
export function dayEdge(n: number, edge: "start" | "end"): Date {
  const u = new Date(n * DAY);
  const [y, m, d] = [u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()];
  const at = edge === "end" ? new TZDate(y, m, d, 23, 59, 59, APP_TIMEZONE) : new TZDate(y, m, d, 0, 0, 0, APP_TIMEZONE);
  return new Date(at.getTime());
}

/** "dd/mm/yyyy" of a "yyyy-mm-dd" day, for previews. */
export const showDay = (day: string) => day.split("-").reverse().join("/");

// ----------------------------------------------------------------------------
// Snapshot: project → template data
// ----------------------------------------------------------------------------

type Dateish = Date | string | null;

/** What the snapshot reads from a project (Prisma rows or plain data). Rows in display order. */
export interface TemplateSource {
  color: string;
  startDate: Dateish;
  createdAt: Date | string;
  categories: { id: string; name: string; color: string; parentId: string | null; order: number; startDate: Dateish; dueDate: Dateish }[];
  tasks: { id: string; title: string; description: string | null; priority: TemplateTask["priority"]; categoryId: string | null; parentId: string | null; startDate: Dateish; dueDate: Dateish }[];
}

/** The day offsets count from: project start, else the earliest item date, else creation. */
export function templateAnchor(project: TemplateSource): Date {
  if (project.startDate) return new Date(project.startDate);
  const dates = [...project.categories, ...project.tasks].flatMap((x) => [x.startDate, x.dueDate]).filter((d): d is Date | string => !!d);
  if (dates.length) return new Date(Math.min(...dates.map((d) => new Date(d).getTime())));
  return new Date(project.createdAt);
}

/** A project's categories and tasks as template data (refs instead of ids, dates as day offsets). */
export function snapshotProject(project: TemplateSource): TemplateData {
  if (project.categories.length > MAX_TEMPLATE_CATEGORIES) {
    throw new InputError(`Dự án có ${project.categories.length} hạng mục, vượt giới hạn ${MAX_TEMPLATE_CATEGORIES} hạng mục của một mẫu.`);
  }
  if (project.tasks.length > MAX_TEMPLATE_TASKS) {
    throw new InputError(`Dự án có ${project.tasks.length} công việc, vượt giới hạn ${MAX_TEMPLATE_TASKS} công việc của một mẫu.`);
  }
  const anchor = zonedDayNumber(templateAnchor(project));
  const off = (d: Dateish) => (d ? zonedDayNumber(d) - anchor : null);
  const catRef = new Map(project.categories.map((c, i) => [c.id, `c${i + 1}`]));
  const taskRef = new Map(project.tasks.map((t, i) => [t.id, `t${i + 1}`]));
  const ref = (map: Map<string, string>, id: string | null) => (id ? (map.get(id) ?? null) : null);
  return templateDataSchema.parse({
    version: TEMPLATE_VERSION,
    color: project.color || undefined,
    categories: project.categories.map((c) => ({
      ref: catRef.get(c.id)!,
      name: c.name,
      color: c.color,
      parentRef: ref(catRef, c.parentId),
      order: c.order,
      startOffset: off(c.startDate),
      dueOffset: off(c.dueDate),
    })),
    tasks: project.tasks.map((t) => ({
      ref: taskRef.get(t.id)!,
      title: t.title,
      description: t.description,
      priority: t.priority,
      categoryRef: ref(catRef, t.categoryId),
      parentRef: ref(taskRef, t.parentId),
      startOffset: off(t.startDate),
      dueOffset: off(t.dueDate),
    })),
  });
}

// ----------------------------------------------------------------------------
// Instantiate: template data → rows of a new project
// ----------------------------------------------------------------------------

/** Parents before children (stable otherwise), so rows can be inserted in this order. */
function parentsFirst<T extends { ref: string; parentRef: string | null }>(items: T[]): T[] {
  const byRef = new Map(items.map((x) => [x.ref, x]));
  const out: T[] = [];
  const placed = new Set<string>();
  const place = (x: T) => {
    if (placed.has(x.ref)) return;
    placed.add(x.ref);
    const parent = x.parentRef ? byRef.get(x.parentRef) : undefined;
    if (parent) place(parent);
    out.push(x);
  };
  items.forEach(place);
  return out;
}

export interface TemplatePlan {
  /** Day the new project starts, 00:00 in APP_TIMEZONE. */
  startDate: Date;
  /** Latest due date among the new categories and tasks; null when none has one. */
  dueDate: Date | null;
  color: string | undefined;
  /** Insert in this order (parents first). */
  categories: Prisma.CategoryCreateManyInput[];
  tasks: Prisma.TaskCreateManyInput[];
}

/**
 * Rows for a new project from template data, with dates moved to start on `startDay`
 * ("yyyy-mm-dd" in APP_TIMEZONE). Ids come from `newId` so parents and children go in
 * one insert each; createdAt follows the template order so lists keep it.
 */
export function instantiateTemplate(
  data: TemplateData,
  opts: { startDay: string; projectId: string; createdById: string; newId: () => string; now?: Date },
): TemplatePlan {
  const start = dayNumber(opts.startDay);
  if (start === null) throw new InputError("Ngày bắt đầu không hợp lệ");
  const at = (offset: number | null, edge: "start" | "end") => (offset === null ? null : dayEdge(start + offset, edge));
  const created = (opts.now ?? new Date()).getTime();
  const catIds = new Map(data.categories.map((c) => [c.ref, opts.newId()]));
  const taskIds = new Map(data.tasks.map((t) => [t.ref, opts.newId()]));
  const index = new Map(data.tasks.map((t, i) => [t.ref, i]));
  const catIndex = new Map(data.categories.map((c, i) => [c.ref, i]));

  const categories = parentsFirst(data.categories).map((c): Prisma.CategoryCreateManyInput => ({
    id: catIds.get(c.ref)!,
    projectId: opts.projectId,
    parentId: c.parentRef ? catIds.get(c.parentRef)! : null,
    name: c.name,
    color: c.color,
    order: c.order,
    startDate: at(c.startOffset, "start"),
    dueDate: at(c.dueOffset, "end"),
    createdAt: new Date(created + catIndex.get(c.ref)!),
  }));
  const tasks = parentsFirst(data.tasks).map((t): Prisma.TaskCreateManyInput => ({
    id: taskIds.get(t.ref)!,
    projectId: opts.projectId,
    parentId: t.parentRef ? taskIds.get(t.parentRef)! : null,
    categoryId: t.categoryRef ? catIds.get(t.categoryRef)! : null,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: "TODO",
    progress: 0,
    assigneeId: null,
    createdById: opts.createdById,
    startDate: at(t.startOffset, "start"),
    dueDate: at(t.dueOffset, "end"),
    createdAt: new Date(created + index.get(t.ref)!),
  }));

  const dues = [...data.categories, ...data.tasks].map((x) => x.dueOffset).filter((o): o is number => o !== null);
  return {
    startDate: dayEdge(start, "start"),
    dueDate: dues.length ? dayEdge(start + Math.max(...dues), "end") : null,
    color: data.color,
    categories,
    tasks,
  };
}
