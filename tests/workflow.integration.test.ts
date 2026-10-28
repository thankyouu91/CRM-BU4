import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// Bulk edits, notifications and the AI day counter against a real PostgreSQL.
describe.skipIf(!process.env.TEST_DATABASE_URL)("bulk edits, notifications and AI uses on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { lead: `lead-${run}`, an: `an-${run}`, outsider: `out-${run}`, admin: `admin-${run}` };
  const as = (id: string, role = "MEMBER"): CurrentUser => ({ id, email: `${id}@example.test`, name: id === ids.lead ? "Trưởng nhóm" : id === ids.an ? "An" : id === ids.admin ? "Quản trị" : "Ngoài", role, permissions: [], jobTitle: null, avatarColor: "#000", mustChangePassword: false });
  let projectId: string;
  let other: string;
  let tasks: string[];

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const [key, id] of Object.entries(ids)) await db.user.create({ data: { id, email: `${id}@example.test`, name: key === "lead" ? "Trưởng nhóm" : key === "an" ? "An" : key === "admin" ? "Quản trị" : "Ngoài", passwordHash: "test-only", role: key === "lead" ? "LEAD" : key === "admin" ? "ADMIN" : "MEMBER" } });
    projectId = (await db.project.create({ data: { name: "Dự án hàng loạt", ownerId: ids.lead, members: { create: [{ userId: ids.an, role: "MEMBER" }] } } })).id;
    other = (await db.project.create({ data: { name: "Dự án khác", ownerId: ids.outsider } })).id;
    tasks = [];
    for (const title of ["Một", "Hai", "Ba"]) tasks.push((await db.task.create({ data: { title, projectId, createdById: ids.lead } })).id);
    tasks.push((await db.task.create({ data: { title: "Không thấy", projectId: other, createdById: ids.outsider } })).id);
  });

  afterAll(async () => {
    if (!db) return;
    await db.project.deleteMany({ where: { id: { in: [projectId, other] } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("gives many tasks to a member at once, skips what the person may not change, logs and notifies", async () => {
    const { POST } = await import("../app/api/tasks/bulk/route");
    session.user = as(ids.lead, "LEAD");
    const due = "2026-10-20T16:59:59.999Z";
    const res = await POST(new NextRequest("http://local/api/tasks/bulk", { method: "POST", body: JSON.stringify({ ids: tasks, patch: { assigneeId: ids.an } }) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ updated: 3, unchanged: 0 });
    expect(body.skipped).toEqual([{ id: tasks[3], title: null, reason: "Không tìm thấy công việc" }]);
    expect(await db.task.count({ where: { id: { in: tasks.slice(0, 3) }, assigneeId: ids.an } })).toBe(3);
    expect(await db.task.findUnique({ where: { id: tasks[3] }, select: { assigneeId: true } })).toEqual({ assigneeId: null });
    expect(await db.auditLog.count({ where: { actorId: ids.lead, action: "task.update", entityId: { in: tasks } } })).toBe(3);
    const notices = await db.notification.findMany({ where: { userId: ids.an } });
    expect(notices.map((n) => n.title).sort()).toEqual(["Bạn được giao “Ba”", "Bạn được giao “Hai”", "Bạn được giao “Một”"]);
    expect(notices[0]).toMatchObject({ type: "task.assigned", actorName: "Trưởng nhóm" });

    // The assignee may complete them, not move their deadline.
    session.user = as(ids.an);
    const done = await (await POST(new NextRequest("http://local/api/tasks/bulk", { method: "POST", body: JSON.stringify({ ids: tasks.slice(0, 2), patch: { status: "DONE" } }) }))).json();
    expect(done.updated).toBe(2);
    expect(await db.task.count({ where: { id: { in: tasks.slice(0, 2) }, status: "DONE", progress: 100, completedAt: { not: null } } })).toBe(2);
    const moved = await (await POST(new NextRequest("http://local/api/tasks/bulk", { method: "POST", body: JSON.stringify({ ids: [tasks[2]], patch: { dueDate: due } }) }))).json();
    expect(moved.updated).toBe(0);
    expect(moved.skipped[0].reason).toMatch(/Chỉ người quản lý/);
  });

  it("shows notices and live alerts in the bell, only to their owner, and marks them read", async () => {
    await db.task.update({ where: { id: tasks[2] }, data: { dueDate: new Date(Date.now() - 86_400_000) } });
    const feedRoute = await import("../app/api/notifications/route");
    const readRoute = await import("../app/api/notifications/read/route");
    session.user = as(ids.an);
    const feed = await (await feedRoute.GET()).json();
    expect(feed.unread).toBe(3);
    expect(feed.items).toHaveLength(3);
    expect(feed.alerts.find((a: { id: string }) => a.id === "overdue")).toMatchObject({ title: "1 việc của bạn đã quá hạn", body: "“Ba”" });
    // Someone else's ids are ignored.
    session.user = as(ids.outsider);
    await readRoute.POST(new NextRequest("http://local/api/notifications/read", { method: "POST", body: JSON.stringify({ ids: [feed.items[0].id] }) }));
    expect(await db.notification.count({ where: { userId: ids.an, readAt: null } })).toBe(3);
    session.user = as(ids.an);
    const one = await (await readRoute.POST(new NextRequest("http://local/api/notifications/read", { method: "POST", body: JSON.stringify({ ids: [feed.items[0].id] }) }))).json();
    expect(one.unread).toBe(2);
    const all = await (await readRoute.POST(new NextRequest("http://local/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) }))).json();
    expect(all.unread).toBe(0);
    // The sidebar's inbox count travels with the feed: the lead manages the project, An does not.
    await db.taskReport.create({ data: { taskId: tasks[0], authorId: ids.an, content: "Xong một nửa", progress: 50 } });
    session.user = as(ids.lead, "LEAD");
    expect(await (await feedRoute.GET()).json()).toMatchObject({ pendingReports: 1 });
    session.user = as(ids.an);
    expect(await (await feedRoute.GET()).json()).toMatchObject({ pendingReports: 0 });
  });

  it("lets an administrator outside a project take its work, joining it, and nobody else", async () => {
    const create = (await import("../app/api/tasks/route")).POST;
    const update = (await import("../app/api/tasks/[id]/route")).PATCH;
    const post = (body: object) => create(new NextRequest("http://local/api/tasks", { method: "POST", body: JSON.stringify(body) }));

    // A member of the project still cannot give work to someone outside it.
    session.user = as(ids.an);
    expect((await post({ projectId, title: "Cho người ngoài", assigneeId: ids.outsider })).status).toBe(400);

    session.user = as(ids.admin, "ADMIN");
    expect((await post({ projectId: other, title: "Cho người ngoài", assigneeId: ids.an })).status).toBe(400);
    const res = await post({ projectId: other, title: "Tôi tự làm", assigneeId: ids.admin });
    expect(res.status).toBe(201);
    const { task } = await res.json();
    expect(task).toMatchObject({ assigneeId: ids.admin, createdById: ids.admin });
    expect(await db.projectMember.findUnique({ where: { projectId_userId: { projectId: other, userId: ids.admin } }, select: { role: true } })).toEqual({ role: "MEMBER" });
    const joined = await db.auditLog.findMany({ where: { actorId: ids.admin, action: "project.members_change", entityId: other } });
    expect(joined).toHaveLength(1);
    expect(joined[0]).toMatchObject({ summary: "Tham gia dự án “Dự án khác” để nhận việc", details: { reason: "self-assign" } });
    // Nobody is notified of giving work to themselves.
    expect(await db.notification.count({ where: { userId: ids.admin } })).toBe(0);

    // Taking an existing task as a viewer of the project makes the administrator a member too.
    await db.projectMember.update({ where: { projectId_userId: { projectId: other, userId: ids.admin } }, data: { role: "VIEWER" } });
    const patch = await update(new NextRequest(`http://local/api/tasks/${tasks[3]}`, { method: "PATCH", body: JSON.stringify({ assigneeId: ids.admin }) }), { params: Promise.resolve({ id: tasks[3] }) });
    expect(patch.status).toBe(200);
    expect(await db.task.findUnique({ where: { id: tasks[3] }, select: { assigneeId: true } })).toEqual({ assigneeId: ids.admin });
    expect(await db.projectMember.findUnique({ where: { projectId_userId: { projectId: other, userId: ids.admin } }, select: { role: true } })).toEqual({ role: "MEMBER" });
  });

  it("never lets requests sent together pass the daily AI limit", async () => {
    const { reserveAiUse, releaseAiUse } = await import("../lib/ai-settings");
    const results = await Promise.all(Array.from({ length: 8 }, () => reserveAiUse(ids.lead, 3)));
    expect(results.filter((r) => r !== null).sort()).toEqual([0, 1, 2]);
    expect(results.filter((r) => r === null)).toHaveLength(5);
    await releaseAiUse(ids.lead);
    expect(await reserveAiUse(ids.lead, 3)).toBe(2);
    expect(await reserveAiUse(ids.lead, 3)).toBeNull();
  });

  it("knows who still owes the weekly report due now", async () => {
    const { weeklyReportOwed } = await import("../lib/notifications");
    const friday = new Date("2026-10-16T09:00:00Z"); // 16:00 in Vietnam
    const owed = await weeklyReportOwed(as(ids.an), friday);
    expect(owed?.key).toBe("2026-W42");
    await db.workReport.create({ data: { userId: ids.an, period: "WEEK", periodStart: owed!.start, status: "SUBMITTED", submittedAt: friday } });
    expect(await weeklyReportOwed(as(ids.an), friday)).toBeNull();
    expect(await weeklyReportOwed(as(ids.an, "ADMIN"), friday)).toBeNull();
    expect(await weeklyReportOwed(as(ids.an), new Date("2026-10-14T03:00:00Z"))).toBeNull(); // Wednesday
  });
});
