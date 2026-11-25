import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";
import { effectivePermissions } from "../lib/permissions";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// The dashboard's team week and giving out work from it, against a real PostgreSQL.
describe.skipIf(!process.env.TEST_DATABASE_URL)("team overview on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { boss: `toboss-${run}`, lead: `tolead-${run}`, binh: `tobinh-${run}`, out: `toout-${run}` };
  const roles = { boss: "MANAGER", lead: "LEAD", binh: "MEMBER", out: "MEMBER" } as const;
  const as = (key: keyof typeof ids): CurrentUser =>
    ({ id: ids[key], email: `${ids[key]}@example.test`, name: `Người ${key}`, role: roles[key], permissions: effectivePermissions(roles[key]), jobTitle: null, avatarColor: "#000", mustChangePassword: false }) as CurrentUser;
  const req = (url: string, method: string, body?: object) => new NextRequest(`http://local${url}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  const call = async (who: keyof typeof ids, fn: () => Promise<Response>) => {
    session.user = as(who);
    const res = await fn();
    return { status: res.status, body: await res.json() };
  };
  const project = `toproj-${run}`;
  const day = 86_400_000;

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      await db.user.create({ data: { id: ids[key], email: `${ids[key]}@example.test`, name: `Người ${key}`, passwordHash: "test-only", role: roles[key] } });
    }
    // The lead owns the project; Bình works in it; "out" does not.
    await db.project.create({ data: { id: project, name: `Dự án đội ${run}`, ownerId: ids.lead, members: { create: [{ userId: ids.binh, role: "MEMBER" }] } } });
    const now = Date.now();
    await db.task.createMany({
      data: [
        { title: `Trễ ${run}`, projectId: project, createdById: ids.lead, assigneeId: ids.binh, status: "IN_PROGRESS", dueDate: new Date(now - 2 * day) },
        { title: `Sắp tới ${run}`, projectId: project, createdById: ids.lead, assigneeId: ids.binh, status: "TODO", dueDate: new Date(now + 30 * day) },
        { title: `Xong ${run}`, projectId: project, createdById: ids.lead, assigneeId: ids.binh, status: "DONE", dueDate: new Date(now - day), completedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.project.deleteMany({ where: { id: project } });
    await db.notification.deleteMany({ where: { userId: { in: Object.values(ids) } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("shows managers each person's week with their deadlines, and nobody below", async () => {
    const { GET } = await import("../app/api/dashboard/team/route");
    expect((await call("lead", () => GET())).status).toBe(403);
    expect((await call("binh", () => GET())).status).toBe(403);
    const seen = await call("boss", () => GET());
    expect(seen.status).toBe(200);
    const binh = seen.body.rows.find((r: { author: { id: string } }) => r.author.id === ids.binh);
    expect(binh).toMatchObject({ overdue: 1, state: "NONE" });
    expect(binh.deadlines.map((d: { title: string }) => d.title)).toEqual([`Trễ ${run}`, `Sắp tới ${run}`]); // overdue first, done work left out
    expect(seen.body.rows.some((r: { author: { id: string } }) => r.author.id === ids.boss)).toBe(false);
  });

  it("lets a project manager bring someone into the project when giving them work, and nobody else", async () => {
    const { POST } = await import("../app/api/tasks/route");
    const give = (who: keyof typeof ids, body: object) => call(who, () => POST(req("/api/tasks", "POST", { projectId: project, title: `Việc mới ${run}`, assigneeId: ids.out, ...body })));
    // Without asking, or without managing the project: refused.
    expect((await give("boss", {})).status).toBe(400);
    expect((await give("binh", { addAssignee: true })).status).toBe(400); // works in the project, does not manage it
    expect(await db.projectMember.count({ where: { projectId: project, userId: ids.out } })).toBe(0);
    // The manager (org-wide) asks: the person joins as a member, gets the task and the notice.
    const ok = await give("boss", { addAssignee: true });
    expect(ok.status).toBe(201);
    expect(ok.body.task.assigneeId).toBe(ids.out);
    expect((await db.projectMember.findUnique({ where: { projectId_userId: { projectId: project, userId: ids.out } } }))?.role).toBe("MEMBER");
    expect(await db.notification.count({ where: { userId: ids.out, type: "task.assigned" } })).toBe(1);
    expect(await db.auditLog.count({ where: { actorId: ids.boss, action: "project.members_change", entityId: project } })).toBe(1);
  });
});
