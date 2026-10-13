import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A fake database: the routes run their real permission checks, snapshot and instantiate.
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  audit: vi.fn(),
  db: {
    project: { findUnique: vi.fn(), create: vi.fn() },
    projectTemplate: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    category: { createMany: vi.fn() },
    task: { createMany: vi.fn() },
    user: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("../lib/session", () => ({ getCurrentUser: mock.auth }));
vi.mock("../lib/audit", () => ({ audit: mock.audit }));
vi.mock("../lib/prisma", () => ({ prisma: mock.db }));
import { GET as list, POST as save } from "../app/api/project-templates/route";
import { DELETE as remove } from "../app/api/project-templates/[id]/route";
import { POST as fromTemplate } from "../app/api/projects/from-template/route";

const db = mock.db;
const lead = { id: "me", name: "Trưởng nhóm", role: "LEAD", permissions: ["PROJECT_CREATE"] };
const member = { id: "m", name: "Nhân viên", role: "MEMBER", permissions: [] };
const admin = { id: "a", name: "Quản trị", role: "ADMIN", permissions: [] };
const post = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const vn = (day: string, time = "00:00:00") => new Date(`${day}T${time}+07:00`);

// The project row as both selects read it (access check and snapshot).
const sourceProject = (extra: Record<string, unknown> = {}) => ({
  ownerId: "me",
  members: [],
  name: "Khảo thí tiếng Anh ACB",
  color: "#0ea5e9",
  startDate: vn("2026-10-05"),
  createdAt: vn("2026-09-01"),
  categories: [
    { id: "cat-main", name: "Tổ chức thi", color: "#6366f1", parentId: null, order: 0, startDate: vn("2026-10-05"), dueDate: vn("2026-10-09", "23:59:59") },
    { id: "cat-sub", name: "Coi thi", color: "#22c55e", parentId: "cat-main", order: 0, startDate: null, dueDate: vn("2026-10-08", "23:59:59") },
  ],
  tasks: [
    { id: "task-1", title: "Soạn đề", description: "3 mã đề", priority: "HIGH", categoryId: "cat-main", parentId: null, startDate: vn("2026-10-05"), dueDate: vn("2026-10-06", "23:59:59") },
    { id: "task-2", title: "In đề", description: null, priority: "MEDIUM", categoryId: "cat-sub", parentId: "task-1", startDate: null, dueDate: vn("2026-10-07", "23:59:59") },
  ],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue(lead);
  db.project.findUnique.mockResolvedValue(sourceProject());
  db.projectTemplate.create.mockImplementation(async ({ data }: { data: { name: string; description: string | null } }) => ({ id: "tpl1", name: data.name, description: data.description, updatedAt: new Date() }));
  db.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id })));
  db.project.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, members: undefined }));
  db.category.createMany.mockResolvedValue({ count: 0 });
  db.task.createMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
});

describe("GET /api/project-templates", () => {
  it("lists templates with counts and delete rights for people who can create projects only", async () => {
    mock.auth.mockResolvedValueOnce(null);
    expect((await list()).status).toBe(401);
    mock.auth.mockResolvedValueOnce(member);
    expect((await list()).status).toBe(403);
    expect(db.$queryRaw).not.toHaveBeenCalled();

    db.$queryRaw.mockResolvedValue([
      { id: "t1", name: "Mine", description: null, createdById: "me", createdByName: "Trưởng nhóm", updatedAt: new Date("2026-10-12T00:00:00Z"), categories: 2, tasks: 5 },
      { id: "t2", name: "Theirs", description: "x", createdById: "other", createdByName: "Người khác", updatedAt: new Date("2026-10-11T00:00:00Z"), categories: 1, tasks: 1 },
      { id: "t3", name: "Orphan", description: null, createdById: null, createdByName: null, updatedAt: new Date("2026-10-10T00:00:00Z"), categories: 0, tasks: 0 },
    ]);
    const { templates } = await (await list()).json();
    expect(templates.map((t: { canDelete: boolean }) => t.canDelete)).toEqual([true, false, false]);
    expect(templates[0]).toMatchObject({ id: "t1", categories: 2, tasks: 5, createdBy: { id: "me", name: "Trưởng nhóm" } });
    expect(templates[2].createdBy).toBeNull();
    mock.auth.mockResolvedValueOnce(admin);
    expect((await (await list()).json()).templates.every((t: { canDelete: boolean }) => t.canDelete)).toBe(true);
  });
});

describe("POST /api/project-templates", () => {
  const body = { projectId: "p1", name: "Mẫu khảo thí", description: "Ba đợt" };

  it("requires the right to create projects and to manage the source project", async () => {
    mock.auth.mockResolvedValueOnce(member);
    expect((await save(post("/api/project-templates", body))).status).toBe(403);
    db.project.findUnique.mockResolvedValueOnce(null);
    expect((await save(post("/api/project-templates", body))).status).toBe(404);
    // A plain member of someone else's project.
    db.project.findUnique.mockResolvedValueOnce(sourceProject({ ownerId: "boss", members: [{ role: "MEMBER" }] }));
    const res = await save(post("/api/project-templates", body));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("quản lý dự án");
    expect((await save(post("/api/project-templates", { ...body, name: "x" }))).status).toBe(400);
    expect(db.projectTemplate.create).not.toHaveBeenCalled();
  });

  it("saves the structure without people or progress and records the action", async () => {
    const res = await save(post("/api/project-templates", body));
    expect(res.status).toBe(201);
    expect((await res.json()).template).toMatchObject({ id: "tpl1", name: "Mẫu khảo thí", categories: 2, tasks: 2, canDelete: true });
    const { data } = db.projectTemplate.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Mẫu khảo thí", description: "Ba đợt", createdById: "me" });
    expect(data.data.categories[1]).toMatchObject({ ref: "c2", parentRef: "c1", startOffset: null, dueOffset: 3 });
    expect(data.data.tasks[1]).toMatchObject({ ref: "t2", parentRef: "t1", categoryRef: "c2", dueOffset: 2 });
    expect(JSON.stringify(data.data)).not.toMatch(/task-1|cat-main|assignee|status|progress/);
    expect(mock.audit.mock.calls[0][1]).toMatchObject({ action: "project_template.create", entityId: "tpl1", details: { projectId: "p1", categories: 2, tasks: 2 } });
  });

  it("refuses a project past the template limits with a Vietnamese message", async () => {
    const tasks = Array.from({ length: 501 }, (_, i) => ({ id: `t${i}`, title: `Việc ${i}`, description: null, priority: "LOW", categoryId: null, parentId: null, startDate: null, dueDate: null }));
    db.project.findUnique.mockResolvedValue(sourceProject({ tasks }));
    const res = await save(post("/api/project-templates", body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Dự án có 501 công việc, vượt giới hạn 500 công việc của một mẫu.");
    expect(db.projectTemplate.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/project-templates/[id]", () => {
  it("lets the creator or an administrator delete, nobody else", async () => {
    const del = () => remove(new NextRequest("http://localhost/api/project-templates/tpl1", { method: "DELETE" }), ctx("tpl1"));
    db.projectTemplate.findUnique.mockResolvedValueOnce(null);
    expect((await del()).status).toBe(404);
    db.projectTemplate.findUnique.mockResolvedValue({ name: "Mẫu", createdById: "other" });
    expect((await del()).status).toBe(403);
    expect(db.projectTemplate.delete).not.toHaveBeenCalled();
    mock.auth.mockResolvedValueOnce(admin);
    expect((await del()).status).toBe(200);
    db.projectTemplate.findUnique.mockResolvedValue({ name: "Mẫu", createdById: "me" });
    expect((await del()).status).toBe(200);
    expect(db.projectTemplate.delete).toHaveBeenCalledTimes(2);
    expect(mock.audit.mock.calls.map((c) => c[1].action)).toEqual(["project_template.delete", "project_template.delete"]);
  });
});

describe("POST /api/projects/from-template", () => {
  const data = {
    version: 1,
    color: "#f97316",
    categories: [
      { ref: "c1", name: "Tổ chức thi", color: "#6366f1", parentRef: null, order: 0, startOffset: 0, dueOffset: 4 },
      { ref: "c2", name: "Coi thi", color: "#22c55e", parentRef: "c1", order: 0, startOffset: null, dueOffset: 3 },
    ],
    tasks: [
      { ref: "t1", title: "Soạn đề", description: "3 mã đề", priority: "HIGH", categoryRef: "c1", parentRef: null, startOffset: 0, dueOffset: 1 },
      { ref: "t2", title: "In đề", description: null, priority: "MEDIUM", categoryRef: "c2", parentRef: "t1", startOffset: null, dueOffset: 6 },
    ],
  };
  const body = { templateId: "tpl1", name: "Khảo thí ACB đợt 2", startDate: "2026-10-20" };
  const create = (b: unknown = body) => fromTemplate(post("/api/projects/from-template", b));

  it("checks the right to create projects, the input and the template", async () => {
    mock.auth.mockResolvedValueOnce(member);
    expect((await create()).status).toBe(403);
    expect((await create({ ...body, startDate: "20/10/2026" })).status).toBe(400);
    expect((await create({ ...body, startDate: "2026-02-30" })).status).toBe(400);
    db.projectTemplate.findUnique.mockResolvedValueOnce(null);
    expect((await create()).status).toBe(404);
    db.projectTemplate.findUnique.mockResolvedValueOnce({ id: "tpl1", name: "Hỏng", data: { version: 7 } });
    const broken = await create();
    expect(broken.status).toBe(400);
    expect((await broken.json()).error).toContain("phiên bản");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("creates the project, its categories and tasks in one transaction with dates moved to the new start", async () => {
    db.projectTemplate.findUnique.mockResolvedValue({ id: "tpl1", name: "Mẫu khảo thí", data });
    const res = await create();
    expect(res.status).toBe(201);
    const { project } = await res.json();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction.mock.calls[0][0]).toHaveLength(3);

    // Same project as POST /api/projects: the caller owns it and is its only manager.
    const row = db.project.create.mock.calls[0][0].data;
    expect(row).toMatchObject({ name: "Khảo thí ACB đợt 2", ownerId: "me", status: "PLANNING", color: "#f97316", members: { create: [{ userId: "me", role: "MANAGER" }] } });
    expect(row.startDate.toISOString()).toBe("2026-10-19T17:00:00.000Z");
    expect(row.dueDate.toISOString()).toBe("2026-10-26T16:59:59.000Z"); // t2: +6 days, 23:59:59 in Vietnam
    expect(project.id).toBe(row.id);

    const cats = db.category.createMany.mock.calls[0][0].data;
    expect(cats.map((c: { name: string }) => c.name)).toEqual(["Tổ chức thi", "Coi thi"]);
    expect(cats[1].parentId).toBe(cats[0].id);
    expect(cats.every((c: { projectId: string }) => c.projectId === row.id)).toBe(true);
    const tasks = db.task.createMany.mock.calls[0][0].data;
    expect(tasks[1]).toMatchObject({ title: "In đề", parentId: tasks[0].id, categoryId: cats[1].id, status: "TODO", progress: 0, assigneeId: null, createdById: "me" });
    expect(tasks[0].dueDate.toISOString()).toBe("2026-10-21T16:59:59.000Z");

    expect(mock.audit.mock.calls[0][1]).toMatchObject({
      action: "project.create",
      entityId: row.id,
      details: { templateId: "tpl1", categories: 2, tasks: 2 },
    });
  });
});
