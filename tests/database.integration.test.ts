import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Pool } from "pg";
import type { CurrentUser } from "../lib/session";

// CI provisions an empty PostgreSQL database. Never use a production database here.
describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL transactions", () => {
  let db: PrismaClient;
  const userId = `test-${randomUUID()}`;
  let projectId: string;
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
      throw new Error("Integration tests require a local database whose name ends in _test");
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    await db.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "Integration", passwordHash: "test-only" } });
    projectId = (await db.project.create({ data: { name: "Integration", ownerId: userId } })).id;
  });
  afterAll(async () => {
    if (!db) return;
    await db.contract.deleteMany({ where: { createdById: userId } });
    await db.projectTemplate.deleteMany({ where: { createdById: userId } });
    await db.project.deleteMany({ where: { ownerId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
    await (globalThis as unknown as { fileStoragePool?: Pool }).fileStoragePool?.end();
  });

  it("rolls back a progress report when its task snapshot is stale", async () => {
    const { updateTaskSafely } = await import("../lib/task-service");
    const task = await db.task.create({ data: { title: "Concurrency", projectId, createdById: userId, status: "IN_PROGRESS", progress: 20 } });
    await db.task.update({ where: { id: task.id }, data: { progress: 80 } });
    await expect(db.$transaction(async (tx) => {
      await tx.taskReport.create({ data: { taskId: task.id, authorId: userId, content: "Stale", progress: 40 } });
      await updateTaskSafely(tx, task, { progress: 40 });
    })).rejects.toThrow("Công việc đã được cập nhật");
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).progress).toBe(80);
    expect(await db.taskReport.count({ where: { taskId: task.id } })).toBe(0);
  });

  it("aggregates filtered task statistics and exposes task rights on PostgreSQL", async () => {
    const { listTasks } = await import("../lib/queries");
    const title = `performance-${randomUUID()}`;
    await db.task.createMany({ data: [
      { title, projectId, createdById: userId, assigneeId: userId, status: "TODO", dueDate: new Date(Date.now() - 86400000) },
      { title, projectId, createdById: userId, assigneeId: userId, status: "IN_PROGRESS" },
      { title, projectId, createdById: userId, assigneeId: userId, status: "DONE", completedAt: new Date() },
    ] });
    const user = { id: userId, role: "MEMBER", permissions: [] } as unknown as CurrentUser;
    const result = await listTasks(user, { q: title });
    expect(result).toMatchObject({ total: 3, nextCursor: null, stats: { open: 2, active: 1, overdue: 1, doneWeek: 1 } });
    expect(result.tasks.every((task) => task.canReport)).toBe(true);
    expect(result.tasks[0].project).not.toHaveProperty("members");
    expect((await listTasks(user, { q: title, status: "DONE" })).stats).toEqual({ open: 0, active: 0, overdue: 0, doneWeek: 1, done: 1 });
    // A quick filter narrows the list, not the summary numbers above it.
    const overdue = await listTasks(user, { q: title, issue: "overdue" });
    expect(overdue).toMatchObject({ total: 1, stats: { open: 2, active: 1, overdue: 1, doneWeek: 1, done: 1 } });
  });

  it("filters deadline boundaries and full status totals before paginating on PostgreSQL", async () => {
    const { listTasks } = await import("../lib/queries");
    const { taskDeadlinePeriods } = await import("../lib/task-deadlines");
    const { start, end } = taskDeadlinePeriods(new Date())["next-month"];
    const title = `deadline-${randomUUID()}`;
    const common = { title, projectId, createdById: userId, assigneeId: userId };
    await db.task.createMany({ data: [
      ...Array.from({ length: 101 }, () => ({ ...common, status: "IN_PROGRESS" as const, dueDate: new Date(start.getTime() + 86400000) })),
      { ...common, status: "DONE", dueDate: start, completedAt: new Date("2020-01-01T00:00:00Z") },
      { ...common, status: "TODO", dueDate: end },
      { ...common, dueDate: new Date(start.getTime() - 1) },
      { ...common, dueDate: new Date(end.getTime() + 1) },
      { ...common, dueDate: null },
      { ...common, assigneeId: null, dueDate: start },
    ] });
    const user = { id: userId, role: "MEMBER", permissions: [] } as unknown as CurrentUser;
    const filter = { q: title, deadline: "next-month" };
    const first = await listTasks(user, filter);
    expect(first).toMatchObject({ total: 103, stats: { open: 102, active: 101, overdue: 0, doneWeek: 0 } });
    expect(first.tasks).toHaveLength(100);
    expect(first.tasks[0].status).toBe("DONE"); // Deadline, not completion date, selects the period.
    const second = await listTasks(user, { ...filter, cursor: first.nextCursor });
    expect(second).toMatchObject({ total: 103, nextCursor: null, stats: first.stats });
    expect(second.tasks).toHaveLength(3);
    const tasks = [...first.tasks, ...second.tasks];
    expect(new Set(tasks.map((task) => task.id)).size).toBe(103);
    expect(tasks.at(-1)?.dueDate).toEqual(end);
    expect(tasks.every((task) => task.dueDate && task.dueDate >= start && task.dueDate <= end)).toBe(true);
    expect((await listTasks(user, { ...filter, scope: "all" })).total).toBe(104);
  });

  it("scopes department reports to visible projects and counts leaf tasks once", async () => {
    const { departmentReport } = await import("../lib/department-report-queries");
    const { workPeriodOf } = await import("../lib/work-report");
    const outsider = `test-${randomUUID()}`;
    const parent = await db.task.create({ data: { title: "Summary", projectId, createdById: userId, dueDate: new Date() } });
    const leaf = await db.task.create({ data: { title: "Leaf", parentId: parent.id, projectId, createdById: userId, dueDate: new Date() } });
    await db.user.create({ data: { id: outsider, email: `${outsider}@example.test`, name: "Other", passwordHash: "test-only" } });
    try {
      const hidden = await db.project.create({ data: { name: "Hidden", ownerId: outsider } });
      const secret = await db.task.create({ data: { title: "Private", projectId: hidden.id, createdById: outsider, assigneeId: userId, dueDate: new Date() } });
      const viewer = { id: userId, role: "MEMBER", permissions: [] } as unknown as CurrentUser;
      const report = await departmentReport(viewer, workPeriodOf("WEEK"), null);
      const ids = report.sections.flatMap(s => s.buckets.flatMap(b => b.rows.map(r => r.task.id)));
      expect(ids).toContain(leaf.id);
      expect(ids).not.toContain(parent.id);
      expect(ids).not.toContain(secret.id);
      expect((await departmentReport(viewer, workPeriodOf("WEEK"), hidden.id)).counts.currentOpen).toBe(0);
      // A visible project with no task yet is listed, never one the viewer cannot see.
      const empty = await db.project.create({ data: { name: "Empty", ownerId: userId, status: "COMPLETED" } });
      const later = await db.project.create({ data: { name: "Later", ownerId: userId } });
      const far = await db.task.create({ data: { title: "Far", projectId: later.id, createdById: userId, startDate: new Date(Date.now() + 60 * 86400000), dueDate: new Date(Date.now() + 70 * 86400000) } });
      await db.project.create({ data: { name: "Hidden empty", ownerId: outsider } });
      const listed = (await departmentReport(viewer, workPeriodOf("WEEK"), null)).projectsWithoutWork;
      expect(listed.map(p => p.id)).toEqual(expect.arrayContaining([empty.id, later.id]));
      expect(listed.map(p => p.id)).not.toContain(projectId);
      expect(listed.map(p => p.name)).not.toContain("Hidden empty");
      expect(listed.find(p => p.id === empty.id)).toMatchObject({ taskCount: 0, next: null, status: "COMPLETED", owner: "Integration" });
      expect(listed.find(p => p.id === later.id)).toMatchObject({ taskCount: 1, next: { id: far.id, title: "Far" } });
    } finally {
      await db.project.deleteMany({ where: { ownerId: outsider } });
      await db.user.delete({ where: { id: outsider } });
    }
  });

  it("saves a real project as a template and creates a project from it with shifted dates", async () => {
    const { snapshotFromProject, createProjectFromTemplate, listTemplates } = await import("../lib/project-template-service");
    const vn = (day: string, time = "00:00:00") => new Date(`${day}T${time}+07:00`);
    const source = await db.project.create({ data: { name: "Khảo thí tiếng Anh ACB", ownerId: userId, color: "#0ea5e9", startDate: vn("2026-10-05") } });
    const main = await db.category.create({ data: { projectId: source.id, name: "Tổ chức thi", order: 0, startDate: vn("2026-10-05"), dueDate: vn("2026-10-09", "23:59:59") } });
    const sub = await db.category.create({ data: { projectId: source.id, name: "Coi thi", parentId: main.id, order: 0, dueDate: vn("2026-10-08", "23:59:59") } });
    const parent = await db.task.create({ data: { projectId: source.id, categoryId: main.id, title: "Soạn đề", priority: "HIGH", createdById: userId, assigneeId: userId, status: "DONE", progress: 100, completedAt: new Date(), startDate: vn("2026-10-05"), dueDate: vn("2026-10-06", "23:59:59") } });
    await db.task.create({ data: { projectId: source.id, categoryId: sub.id, parentId: parent.id, title: "In đề", createdById: userId, assigneeId: userId, status: "IN_PROGRESS", progress: 40, dueDate: vn("2026-10-07", "23:59:59") } });

    const snap = await snapshotFromProject(source.id);
    const template = await db.projectTemplate.create({ data: { name: "Mẫu khảo thí", data: snap!.data, createdById: userId } });
    expect((await listTemplates({ id: userId, role: "MEMBER" })).find((t) => t.id === template.id)).toMatchObject({ categories: 2, tasks: 2, canDelete: true, createdBy: { id: userId, name: "Integration" } });

    const { project } = await createProjectFromTemplate({ id: userId }, template, { name: "Khảo thí ACB đợt 2", startDate: "2026-11-02" });
    const made = await db.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { members: true, categories: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] }, tasks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    expect(made).toMatchObject({ ownerId: userId, status: "PLANNING", color: "#0ea5e9", startDate: vn("2026-11-02"), dueDate: vn("2026-11-06", "23:59:59") });
    expect(made.members).toEqual([expect.objectContaining({ userId, role: "MANAGER" })]);
    const [newMain, newSub] = [made.categories.find((c) => !c.parentId)!, made.categories.find((c) => c.parentId)!];
    expect(newSub).toMatchObject({ name: "Coi thi", parentId: newMain.id, startDate: null, dueDate: vn("2026-11-05", "23:59:59") });
    expect(made.tasks.map((t) => t.title)).toEqual(["Soạn đề", "In đề"]);
    const [newParent, child] = made.tasks;
    expect(newParent).toMatchObject({ categoryId: newMain.id, priority: "HIGH", startDate: vn("2026-11-02"), dueDate: vn("2026-11-03", "23:59:59") });
    expect(child).toMatchObject({ parentId: newParent.id, categoryId: newSub.id, dueDate: vn("2026-11-04", "23:59:59") });
    for (const t of made.tasks) expect(t).toMatchObject({ status: "TODO", progress: 0, assigneeId: null, completedAt: null, createdById: userId });
    // The source project is untouched.
    expect(await db.task.count({ where: { projectId: source.id, status: "DONE" } })).toBe(1);
  });

  it("quick search ignores accents and wildcards and never returns a project the viewer cannot see", async () => {
    const { quickSearch } = await import("../lib/search-queries");
    const tag = randomUUID().slice(0, 8);
    const outsider = `test-${randomUUID()}`;
    const retired = `test-${randomUUID()}`;
    await db.user.createMany({ data: [
      { id: outsider, email: `${outsider}@example.test`, name: "Other", jobTitle: `Kế toán ${tag}`, passwordHash: "test-only" },
      { id: retired, email: `${retired}@example.test`, name: "Retired", jobTitle: `Kế toán ${tag}`, passwordHash: "test-only", active: false },
    ] });
    try {
      const own = await db.project.create({ data: { name: `Báo cáo ${tag}`, ownerId: userId } });
      const shared = await db.project.create({ data: { name: `ĐÀO TẠO ${tag}`, ownerId: outsider, members: { create: { userId, role: "VIEWER" } } } });
      const hidden = await db.project.create({ data: { name: `Báo cáo ${tag} bí mật`, ownerId: outsider } });
      const task = await db.task.create({ data: { title: `Lập báo cáo ${tag} quý`, projectId: shared.id, createdById: outsider, assigneeId: outsider, dueDate: new Date() } });
      const secret = await db.task.create({ data: { title: `Báo cáo ${tag} riêng`, projectId: hidden.id, createdById: outsider } });
      const contract = await db.contract.create({ data: { code: `HĐ-${tag}`, name: "Đào tạo", value: 0, performedAt: new Date(), createdById: userId } });
      const viewer = { id: userId, role: "MEMBER", permissions: [] } as unknown as CurrentUser;
      const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

      const found = await quickSearch(viewer, `bao cao ${tag}`);
      expect(ids(found.projects)).toEqual([own.id]);
      expect(found.tasks).toEqual([expect.objectContaining({ id: task.id, assignee: "Other", status: "TODO", project: { id: shared.id, name: shared.name, color: shared.color } })]);
      expect(found.tasks[0].dueDate).toBeInstanceOf(Date);
      expect(found).not.toHaveProperty("contracts");
      expect(ids((await quickSearch(viewer, `dao tao ${tag}`)).projects)).toEqual([shared.id]); // membership, uppercase, accents
      expect((await quickSearch(viewer, `ke toan ${tag}`)).people).toEqual([{ id: outsider, name: "Other", jobTitle: `Kế toán ${tag}`, email: `${outsider}@example.test`, avatarColor: "#6366f1" }]);

      const all = { ...viewer, permissions: ["PROJECT_VIEW_ALL", "FINANCE_MANAGE"] } as CurrentUser;
      const everything = await quickSearch(all, `BÁO CÁO ${tag}`);
      expect(ids(everything.projects).sort()).toEqual([own.id, hidden.id].sort());
      expect(ids(everything.tasks).sort()).toEqual([task.id, secret.id].sort());
      expect(ids((await quickSearch(all, `hd-${tag}`)).contracts!)).toEqual([contract.id]);

      // LIKE wildcards and backslashes in the term match literally.
      const literal = await Promise.all([`Tỷ lệ 50% ${tag}`, `Tỷ lệ 500 ${tag}`, `a_b ${tag}`, `axb ${tag}`, `C:\\dir ${tag}`].map((name) => db.project.create({ data: { name, ownerId: userId } })));
      expect(ids((await quickSearch(viewer, `50% ${tag}`)).projects)).toEqual([literal[0].id]);
      expect(ids((await quickSearch(viewer, `a_b ${tag}`)).projects)).toEqual([literal[2].id]);
      expect(ids((await quickSearch(viewer, `c:\\dir ${tag}`)).projects)).toEqual([literal[4].id]);

      // Start and word-start matches come first, then the most recently updated.
      const rank = randomUUID().slice(0, 8).replace(/^\d/, "r");
      const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
      const start = await db.project.create({ data: { name: `${rank} alpha`, ownerId: userId, updatedAt: at(30) } });
      const word = await db.project.create({ data: { name: `beta ${rank}`, ownerId: userId, updatedAt: at(20) } });
      const inner = await db.project.create({ data: { name: `gamma${rank}`, ownerId: userId, updatedAt: at(10) } });
      expect(ids((await quickSearch(viewer, rank)).projects)).toEqual([word.id, start.id, inner.id]);
    } finally {
      await db.project.deleteMany({ where: { ownerId: outsider } });
      await db.user.deleteMany({ where: { id: { in: [outsider, retired] } } });
    }
  });

  it("serializes two real uploads at the contract file limit", async () => {
    const { storeContractFiles } = await import("../lib/contract-file-service");
    const contract = await db.contract.create({ data: { name: "Upload race", value: 0, performedAt: new Date(), createdById: userId } });
    await db.contractFile.createMany({ data: Array.from({ length: 19 }, (_, i) => ({ contractId: contract.id, name: `existing-${i}.pdf`, size: 0, uploadedById: userId })) });
    const item = { name: "new.pdf", bytes: new TextEncoder().encode("%PDF-1.4\nhello") };
    const results = await Promise.allSettled([
      storeContractFiles(contract.id, userId, [item]), storeContractFiles(contract.id, userId, [item]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.contractFile.count({ where: { contractId: contract.id } })).toBe(20);
    expect(await db.contractFileBlob.count({ where: { file: { contractId: contract.id } } })).toBe(1);
  });
});
