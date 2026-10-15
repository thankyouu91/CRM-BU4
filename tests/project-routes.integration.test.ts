import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";

const me = { current: null as CurrentUser | null };
vi.mock("../lib/session", () => ({ getCurrentUser: async () => me.current }));

// CI provisions an empty PostgreSQL database. Never use a production database here.
describe.skipIf(!process.env.TEST_DATABASE_URL)("project and task routes on PostgreSQL", { timeout: 30_000 }, () => {
  let db: PrismaClient;
  const userId = `test-${randomUUID()}`;
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
      throw new Error("Integration tests require a local database whose name ends in _test");
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    await db.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "Routes", passwordHash: "test-only" } });
    me.current = { id: userId, email: `${userId}@example.test`, name: "Routes", role: "MEMBER", permissions: [], jobTitle: null, avatarColor: "#123456", mustChangePassword: false } as unknown as CurrentUser;
  });
  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { actorId: userId } });
    await db.project.deleteMany({ where: { ownerId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  const patch = async (path: string, id: string, body: unknown) => {
    const { PATCH } = await import(`../app/api/${path}/[id]/route`);
    const req = new Request(`http://localhost/api/${path}/${id}`, { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    Object.defineProperty(req, "nextUrl", { value: new URL(req.url) });
    const res: Response = await PATCH(req, { params: Promise.resolve({ id }) });
    return { status: res.status, body: await res.json() };
  };

  it("still saves a project whose old dates are the wrong way round, unless the dates are edited", async () => {
    const p = await db.project.create({ data: { name: "Ngày lệch", ownerId: userId, startDate: new Date("2026-08-25"), dueDate: new Date("2026-01-09") } });
    expect((await patch("projects", p.id, { name: "Đổi tên" })).status).toBe(200);
    const bad = await patch("projects", p.id, { dueDate: "2026-02-01T00:00:00Z" });
    expect(bad).toMatchObject({ status: 400, body: { error: "Hạn hoàn thành của dự án không được trước ngày bắt đầu" } });
    expect((await patch("projects", p.id, { dueDate: "2026-12-31T00:00:00Z" })).status).toBe(200);
  });

  it("refuses to close a project by hand while tasks are open, and follows its tasks instead", async () => {
    const p = await db.project.create({ data: { name: "Đóng tay", ownerId: userId, status: "ACTIVE" } });
    const t = await db.task.create({ data: { title: "Việc", projectId: p.id, createdById: userId, assigneeId: userId, status: "IN_PROGRESS" } });
    const res = await patch("projects", p.id, { status: "COMPLETED" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("còn 1 công việc chưa hoàn thành");
    expect((await patch("tasks", t.id, { status: "DONE" })).status).toBe(200);
    expect((await db.project.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("COMPLETED");
  });
});
