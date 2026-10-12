import { describe, expect, it } from "vitest";
import { buildDepartmentReport, type DepartmentProjectSource, type DepartmentTaskSource } from "../lib/department-report";
import { workPeriodFromKey } from "../lib/work-report";

const period = workPeriodFromKey("WEEK", "2026-W42")!;
const now = new Date("2026-10-14T05:00:00Z");
const task = (id: string, patch: Partial<DepartmentTaskSource> = {}): DepartmentTaskSource => ({
  id, title: id, description: null, status: "TODO", priority: "MEDIUM", progress: 0,
  startDate: null, dueDate: null, completedAt: null, createdAt: "2026-09-01T00:00:00Z",
  project: { id: "p", name: "Dự án", color: "#000", status: "ACTIVE" },
  category: null, parent: null, assignee: null, reports: [], ...patch,
});
const build = (...tasks: DepartmentTaskSource[]) => buildDepartmentReport(tasks, period, null, now);
const ids = (report: ReturnType<typeof build>, section: string, bucket: string) => report.sections.find(s => s.id === section)!.buckets.find(b => b.id === bucket)!.rows.map(r => r.task.id);

describe("department weekly report", () => {
  it("uses Monday-Sunday business weeks, including the Vietnam midnight boundary", () => {
    const r = build(task("sunday", { dueDate: "2026-10-11T16:59:59.999Z" }), task("monday", { dueDate: "2026-10-11T17:00:00Z" }));
    expect(ids(r, "previous", "outstanding")).toEqual(["sunday"]);
    expect(ids(r, "current", "carryover")).toEqual(["sunday"]);
    expect(ids(r, "current", "due")).toEqual(["monday"]);
    expect(r.sections.map(s => s.period.key)).toEqual(["2026-W41", "2026-W42", "2026-W43"]);
  });

  it("places results by completion date, not deadline or creation date", () => {
    const r = build(
      task("done", { status: "DONE", dueDate: "2026-12-01T00:00:00Z", completedAt: "2026-10-08T00:00:00Z" }),
      task("late", { status: "DONE", dueDate: "2026-10-08T00:00:00Z", completedAt: "2026-10-13T00:00:00Z" }),
      task("unknown", { status: "DONE" }),
    );
    expect(ids(r, "previous", "completed")).toEqual(["done"]);
    expect(ids(r, "previous", "completedLater")).toEqual(["late"]);
    expect(ids(r, "current", "completed")).toEqual(["late"]);
    expect(ids(r, "current", "carryover")).toEqual([]);
    expect(r.missingCompletion.map(t => t.id)).toEqual(["unknown"]);
  });

  it("keeps unfinished overdue work, blocked work and unassigned work visible", () => {
    const r = build(task("old", { dueDate: "2026-08-01T00:00:00Z", status: "BLOCKED" }), task("due", { dueDate: "2026-10-15T00:00:00Z" }));
    expect(ids(r, "current", "carryover")).toEqual(["old"]);
    expect(r.counts).toMatchObject({ currentOpen: 2, carryover: 1, blocked: 1, nextPlanned: 0 });
    expect(r.sections[1].buckets[0].rows[0].task.assignee).toBeNull();
  });

  it("separates next-week deadlines, starts and ongoing multi-week work without assuming missed deadlines", () => {
    const r = build(
      task("next-due", { status: "IN_PROGRESS", dueDate: "2026-10-22T00:00:00Z" }),
      task("next-start", { startDate: "2026-10-20T00:00:00Z", dueDate: "2026-11-20T00:00:00Z" }),
      task("long", { startDate: "2026-10-01T00:00:00Z", dueDate: "2026-11-20T00:00:00Z" }),
      task("this-due", { status: "IN_PROGRESS", dueDate: "2026-10-15T00:00:00Z" }),
      task("far", { startDate: "2026-12-01T00:00:00Z", dueDate: "2026-12-15T00:00:00Z" }),
    );
    expect(ids(r, "next", "due")).toEqual(["next-due"]);
    expect(ids(r, "next", "starting")).toEqual(["next-start"]);
    expect(ids(r, "next", "continuing")).toEqual(["long"]);
    const next = r.sections[2].buckets.flatMap(b => b.rows.map(x => x.task.id));
    expect(next).not.toContain("this-due");
    expect(new Set(next).size).toBe(next.length);
  });

  it("does not invent a next-week plan for undated tasks", () => {
    const r = build(task("todo"), task("active", { status: "IN_PROGRESS" }));
    expect(r.unscheduled.map(t => t.id)).toEqual(["active", "todo"]);
    expect(ids(r, "current", "active")).toEqual(["active"]);
    expect(r.counts.nextPlanned).toBe(0);
  });

  it("preserves detailed weekly updates and category hierarchy, without future entries", () => {
    const r = build(task("work", {
      status: "IN_PROGRESS", category: { name: "Khảo sát", parent: { name: "Chuẩn bị" } },
      reports: [
        { id: "a", content: "Đã khảo sát 3 đơn vị", createdAt: "2026-10-08T00:00:00Z", progress: 30, author: { name: "An" } },
        { id: "b", content: "Đang tổng hợp", createdAt: "2026-10-13T00:00:00Z", progress: 60, author: { name: "An" } },
        { id: "c", content: "Future", createdAt: "2026-10-17T00:00:00Z", progress: 100, author: { name: "An" } },
      ],
    }));
    expect(r.sections[0].buckets.find(b => b.id === "activity")!.rows[0].updates.map(e => e.id)).toEqual(["a"]);
    const current = r.sections[1].buckets.find(b => b.id === "active")!.rows[0];
    expect(current.updates.map(e => e.id)).toEqual(["b"]);
    expect(current.task.category).toBe("Chuẩn bị / Khảo sát");
  });

  it("does not silently count cancelled projects or treat 100% awaiting approval as done", () => {
    const r = build(task("cancelled", { project: { id: "p", name: "P", color: "#000", status: "CANCELLED" }, dueDate: "2026-10-15T00:00:00Z" }), task("review", { status: "REVIEW", progress: 100, dueDate: "2026-10-15T00:00:00Z" }));
    expect(ids(r, "current", "due")).toEqual(["review"]);
    expect(ids(r, "current", "completed")).toEqual([]);
  });

  it("lists projects with no row in the three weeks, so a new empty project is not missed", () => {
    const project = (id: string, patch: Partial<DepartmentProjectSource> = {}): DepartmentProjectSource => ({
      id, name: id, color: "#000", status: "ACTIVE", createdAt: "2026-10-12T03:30:00Z", owner: { name: "Long" }, _count: { tasks: 0 }, tasks: [], ...patch,
    });
    const far = { id: "far", title: "Nghiệm thu", startDate: "2026-12-01T00:00:00Z", dueDate: "2026-12-15T00:00:00Z" };
    const r = buildDepartmentReport([task("due", { dueDate: "2026-10-15T00:00:00Z" })], period, null, now, [
      project("p"), // has a row above
      project("Mới tạo bởi AI", { status: "COMPLETED" }),
      project("Việc ở xa", { _count: { tasks: 1 }, tasks: [far] }),
      project("Đã xong hết", { _count: { tasks: 4 } }),
      project("Đã huỷ", { status: "CANCELLED" }),
      project("Tạo sau hôm nay", { createdAt: "2026-10-15T00:00:00Z" }),
    ]);
    expect(r.projectsWithoutWork.map(p => p.id)).toEqual(["Mới tạo bởi AI", "Việc ở xa"]);
    expect(r.projectsWithoutWork[0]).toMatchObject({ status: "COMPLETED", owner: "Long", taskCount: 0, next: null, createdAt: "2026-10-12T03:30:00.000Z" });
    expect(r.projectsWithoutWork[1].next).toEqual({ ...far, startDate: "2026-12-01T00:00:00.000Z", dueDate: "2026-12-15T00:00:00.000Z" });
    // A past week does not list a project created after it; a project filter keeps only that project.
    expect(buildDepartmentReport([], workPeriodFromKey("WEEK", "2026-W40")!, null, now, [project("x")]).projectsWithoutWork).toEqual([]);
    expect(buildDepartmentReport([], period, "y", now, [project("x"), project("y")]).projectsWithoutWork.map(p => p.id)).toEqual(["y"]);
  });

  it("handles ISO year changes and never uses now to redefine a selected report week", () => {
    const p = workPeriodFromKey("WEEK", "2026-W01")!;
    const r = buildDepartmentReport([], p, null, now);
    expect(r.sections.map(s => s.period.key)).toEqual(["2025-W52", "2026-W01", "2026-W02"]);
  });
});
