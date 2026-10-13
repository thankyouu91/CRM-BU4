import { describe, expect, it } from "vitest";
import {
  instantiateTemplate,
  MAX_TEMPLATE_CATEGORIES,
  MAX_TEMPLATE_TASKS,
  parseTemplateData,
  snapshotProject,
  templateAnchor,
  templateDataSchema,
  type TemplateData,
  type TemplateSource,
} from "../lib/project-templates";

// 05/10/2026 00:00 in Vietnam is 04/10 17:00 UTC; 23:59:59 is 16:59:59 UTC the same day.
const vn = (day: string, time = "00:00:00") => new Date(`${day}T${time}+07:00`);
const cat = (id: string, extra: Partial<TemplateSource["categories"][number]> = {}) => ({
  id, name: id, color: "#64748b", parentId: null, order: 0, startDate: null, dueDate: null, ...extra,
});
const task = (id: string, extra: Partial<TemplateSource["tasks"][number]> = {}) => ({
  id, title: id, description: null, priority: "MEDIUM" as const, categoryId: null, parentId: null, startDate: null, dueDate: null, ...extra,
});
const source = (extra: Partial<TemplateSource> = {}): TemplateSource => ({
  color: "#0ea5e9", startDate: vn("2026-10-05"), createdAt: vn("2026-09-01", "09:00:00"), categories: [], tasks: [], ...extra,
});
let n = 0;
const ids = () => `id${++n}`;

describe("snapshot", () => {
  it("counts days in Vietnam time, not UTC, on both sides of midnight", () => {
    const data = snapshotProject(source({
      tasks: [
        // 16:59:59 UTC on 05/10 is still 05/10 in Vietnam; 17:00 UTC is already 06/10.
        task("same", { startDate: vn("2026-10-05", "00:00:00"), dueDate: new Date("2026-10-05T16:59:59Z") }),
        task("next", { startDate: new Date("2026-10-05T17:00:00Z"), dueDate: vn("2026-10-07", "23:59:59") }),
        task("before", { startDate: new Date("2026-10-04T16:59:59Z") }),
      ],
    }));
    expect(data.tasks.map((t) => [t.startOffset, t.dueOffset])).toEqual([[0, 0], [1, 2], [-1, null]]);
  });

  it("anchors on the project start, else the earliest item date, else the creation day", () => {
    expect(templateAnchor(source())).toEqual(vn("2026-10-05"));
    const undated = source({ startDate: null, categories: [cat("c", { dueDate: vn("2026-10-20", "23:59:59") })], tasks: [task("t", { startDate: vn("2026-10-12", "08:00:00") })] });
    expect(templateAnchor(undated)).toEqual(vn("2026-10-12", "08:00:00"));
    expect(snapshotProject(undated).categories[0].dueOffset).toBe(8);
    expect(templateAnchor(source({ startDate: null }))).toEqual(vn("2026-09-01", "09:00:00"));
  });

  it("replaces ids with refs for sub-categories, categories and subtasks, and keeps no people or progress", () => {
    const data = snapshotProject(source({
      categories: [cat("main", { order: 0 }), cat("sub", { parentId: "main", order: 1, color: "#22c55e" })],
      tasks: [
        { ...task("parent", { categoryId: "main", priority: "HIGH", description: "Soạn đề" }), assigneeId: "u1", status: "DONE", progress: 100 } as TemplateSource["tasks"][number],
        task("child", { categoryId: "sub", parentId: "parent" }),
      ],
    }));
    expect(data.categories).toEqual([
      { ref: "c1", name: "main", color: "#64748b", parentRef: null, order: 0, startOffset: null, dueOffset: null },
      { ref: "c2", name: "sub", color: "#22c55e", parentRef: "c1", order: 1, startOffset: null, dueOffset: null },
    ]);
    expect(data.tasks).toEqual([
      { ref: "t1", title: "parent", description: "Soạn đề", priority: "HIGH", categoryRef: "c1", parentRef: null, startOffset: null, dueOffset: null },
      { ref: "t2", title: "child", description: null, priority: "MEDIUM", categoryRef: "c2", parentRef: "t1", startOffset: null, dueOffset: null },
    ]);
    expect(data).toMatchObject({ version: 1, color: "#0ea5e9" });
    expect(JSON.stringify(data)).not.toMatch(/assignee|status|progress|u1/);
  });

  it("rejects projects past the limits with a clear message", () => {
    const many = (k: number, make: (id: string) => unknown) => Array.from({ length: k }, (_, i) => make(`x${i}`));
    expect(() => snapshotProject(source({ categories: many(MAX_TEMPLATE_CATEGORIES + 1, cat) as TemplateSource["categories"] })))
      .toThrow("Dự án có 101 hạng mục, vượt giới hạn 100 hạng mục của một mẫu.");
    expect(() => snapshotProject(source({ tasks: many(MAX_TEMPLATE_TASKS + 1, task) as TemplateSource["tasks"] })))
      .toThrow("Dự án có 501 công việc, vượt giới hạn 500 công việc của một mẫu.");
    expect(snapshotProject(source({ tasks: many(MAX_TEMPLATE_TASKS, task) as TemplateSource["tasks"] })).tasks).toHaveLength(500);
  });
});

describe("template data", () => {
  const base: TemplateData = { version: 1, categories: [], tasks: [] };
  const t = (ref: string, parentRef: string | null = null, categoryRef: string | null = null) =>
    ({ ref, title: ref, description: null, priority: "LOW" as const, categoryRef, parentRef, startOffset: null, dueOffset: null });
  const c = (ref: string, parentRef: string | null = null) => ({ ref, name: ref, color: "#000", parentRef, order: 0, startOffset: null, dueOffset: null });

  it("refuses unknown versions, broken refs, cycles and a third category level", () => {
    expect(() => parseTemplateData({ ...base, version: 2 })).toThrow("phiên bản không còn hỗ trợ");
    expect(() => parseTemplateData(null)).toThrow("phiên bản");
    expect(() => parseTemplateData({ ...base, tasks: [t("a", "missing")] })).toThrow("công việc cha không hợp lệ");
    expect(() => parseTemplateData({ ...base, tasks: [t("a", "b"), t("b", "a")] })).toThrow("công việc cha không hợp lệ");
    expect(() => parseTemplateData({ ...base, tasks: [t("a", null, "nope")] })).toThrow("hạng mục không có trong mẫu");
    expect(() => parseTemplateData({ ...base, categories: [c("a"), c("b", "a"), c("c", "b")] })).toThrow("hạng mục lớn không hợp lệ");
    expect(() => parseTemplateData({ ...base, tasks: [t("a"), t("a")] })).toThrow("Mã công việc bị trùng");
    expect(parseTemplateData({ ...base, categories: [c("a"), c("b", "a")], tasks: [t("x", null, "b"), t("y", "x")] }).tasks).toHaveLength(2);
  });

  it("caps stored templates at 100 categories and 500 tasks", () => {
    const tooMany = templateDataSchema.safeParse({ ...base, tasks: Array.from({ length: 501 }, (_, i) => t(`t${i}`)) });
    expect(tooMany.success).toBe(false);
    expect(tooMany.error?.issues[0].message).toBe("Một mẫu chứa tối đa 500 công việc");
    expect(templateDataSchema.safeParse({ ...base, categories: Array.from({ length: 101 }, (_, i) => c(`c${i}`)) }).success).toBe(false);
  });
});

describe("instantiate", () => {
  const data: TemplateData = {
    version: 1,
    color: "#f97316",
    categories: [
      // A sub-category listed before its main category still goes in after it.
      { ref: "c2", name: "Coi thi", color: "#22c55e", parentRef: "c1", order: 0, startOffset: 3, dueOffset: 3 },
      { ref: "c1", name: "Tổ chức thi", color: "#6366f1", parentRef: null, order: 1, startOffset: 0, dueOffset: 5 },
    ],
    tasks: [
      { ref: "t2", title: "In đề", description: "200 bộ", priority: "URGENT", categoryRef: "c2", parentRef: "t1", startOffset: 2, dueOffset: 3 },
      { ref: "t1", title: "Chuẩn bị đề", description: null, priority: "HIGH", categoryRef: "c1", parentRef: null, startOffset: -2, dueOffset: 9 },
      { ref: "t3", title: "Tổng kết", description: null, priority: "LOW", categoryRef: null, parentRef: null, startOffset: null, dueOffset: null },
    ],
  };
  const plan = () => instantiateTemplate(data, { startDay: "2026-10-20", projectId: "p1", createdById: "me", newId: ids, now: new Date("2026-10-13T00:00:00Z") });

  it("moves dates to the new start: 00:00 for starts, 23:59:59 for due dates, Vietnam time", () => {
    const p = plan();
    expect(p.startDate.toISOString()).toBe("2026-10-19T17:00:00.000Z");
    // Latest due among the items: t1 at +9 days.
    expect(p.dueDate?.toISOString()).toBe("2026-10-29T16:59:59.000Z");
    expect(p.color).toBe("#f97316");
    const main = p.categories.find((c) => c.name === "Tổ chức thi")!;
    expect([main.startDate, main.dueDate].map((d) => (d as Date).toISOString())).toEqual(["2026-10-19T17:00:00.000Z", "2026-10-25T16:59:59.000Z"]);
    const first = p.tasks.find((t) => t.title === "Chuẩn bị đề")!;
    expect((first.startDate as Date).toISOString()).toBe("2026-10-17T17:00:00.000Z"); // 18/10, two days before the start
    expect(p.tasks.find((t) => t.title === "Tổng kết")).toMatchObject({ startDate: null, dueDate: null });
    // Month and year boundaries.
    const late = instantiateTemplate(data, { startDay: "2026-12-30", projectId: "p", createdById: "me", newId: ids });
    expect(late.dueDate?.toISOString()).toBe("2027-01-08T16:59:59.000Z");
  });

  it("links parents and children by the new ids, parents first, with fresh work state", () => {
    const p = plan();
    expect(p.categories.map((c) => c.name)).toEqual(["Tổ chức thi", "Coi thi"]);
    expect(p.categories[1].parentId).toBe(p.categories[0].id);
    expect(p.tasks.map((t) => t.title)).toEqual(["Chuẩn bị đề", "In đề", "Tổng kết"]);
    const [parent, child] = p.tasks;
    expect(child.parentId).toBe(parent.id);
    expect(child.categoryId).toBe(p.categories[1].id);
    expect(parent.categoryId).toBe(p.categories[0].id);
    for (const t of p.tasks) expect(t).toMatchObject({ projectId: "p1", status: "TODO", progress: 0, assigneeId: null, createdById: "me" });
    expect(new Set([...p.categories, ...p.tasks].map((x) => x.id)).size).toBe(5);
    // createdAt follows the template's order, so the new project lists tasks the same way.
    expect((child.createdAt as Date).getTime()).toBeLessThan((parent.createdAt as Date).getTime());
  });

  it("round-trips: a snapshot created again on its own start day lands on the same days", () => {
    const original = source({
      categories: [cat("m", { startDate: vn("2026-10-05"), dueDate: vn("2026-10-09", "23:59:59") })],
      tasks: [task("a", { categoryId: "m", startDate: vn("2026-10-06"), dueDate: vn("2026-10-08", "23:59:59") })],
    });
    const again = instantiateTemplate(snapshotProject(original), { startDay: "2026-10-05", projectId: "p", createdById: "me", newId: ids });
    expect(again.categories[0]).toMatchObject({ startDate: vn("2026-10-05"), dueDate: vn("2026-10-09", "23:59:59") });
    expect(again.tasks[0]).toMatchObject({ startDate: vn("2026-10-06"), dueDate: vn("2026-10-08", "23:59:59") });
  });

  it("does not depend on the server's own time zone (a Worker runs in UTC)", () => {
    const before = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Los_Angeles"]) {
        process.env.TZ = tz;
        expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(-420);
        const snap = snapshotProject(source({ tasks: [task("t", { startDate: new Date("2026-10-05T17:00:00Z"), dueDate: new Date("2026-10-05T16:59:59Z") })] }));
        expect([snap.tasks[0].startOffset, snap.tasks[0].dueOffset]).toEqual([1, 0]);
        expect(plan().startDate.toISOString()).toBe("2026-10-19T17:00:00.000Z");
        expect(plan().dueDate?.toISOString()).toBe("2026-10-29T16:59:59.000Z");
      }
    } finally {
      process.env.TZ = before;
    }
  });

  it("rejects a start day that is not a real date", () => {
    expect(() => instantiateTemplate(data, { startDay: "2026-02-30", projectId: "p", createdById: "me", newId: ids })).toThrow("Ngày bắt đầu không hợp lệ");
    expect(() => instantiateTemplate(data, { startDay: "20/10/2026", projectId: "p", createdById: "me", newId: ids })).toThrow("Ngày bắt đầu không hợp lệ");
  });
});
