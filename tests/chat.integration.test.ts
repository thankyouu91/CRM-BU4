import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";
import { effectivePermissions } from "../lib/permissions";
import { mentionToken, taskToken } from "../lib/chat";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// Trao đổi chung against a real PostgreSQL: mentions notify, task tags follow project visibility.
describe.skipIf(!process.env.TEST_DATABASE_URL)("company chat on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { lead: `chlead-${run}`, binh: `chbinh-${run}`, out: `chout-${run}`, admin: `chadmin-${run}`, gone: `chgone-${run}` };
  const roles = { lead: "LEAD", binh: "MEMBER", out: "MEMBER", admin: "ADMIN", gone: "MEMBER" } as const;
  const as = (key: keyof typeof ids): CurrentUser =>
    ({ id: ids[key], email: `${ids[key]}@example.test`, name: `Người ${key}`, role: roles[key], permissions: effectivePermissions(roles[key]), jobTitle: null, avatarColor: "#000", mustChangePassword: false }) as CurrentUser;
  const req = (url: string, method: string, body?: object) => new NextRequest(`http://local${url}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  const routes = async () => ({ list: await import("../app/api/chat/route"), one: await import("../app/api/chat/[id]/route") });
  const call = async (who: keyof typeof ids, fn: () => Promise<Response>) => {
    session.user = as(who);
    const res = await fn();
    return { status: res.status, body: await res.json() };
  };
  const post = async (who: keyof typeof ids, content: string) => call(who, async () => (await routes()).list.POST(req("/api/chat", "POST", { content })));
  const read = async (who: keyof typeof ids, query = "") => call(who, async () => (await routes()).list.GET(req(`/api/chat${query}`, "GET")));
  const project = `chproj-${run}`;
  const task = { id: `chtask-${run}`, title: `Báo giá ${run}` };
  const fresh = { id: `chfresh-${run}`, title: `Việc mới ${run}` };

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      await db.user.create({ data: { id: ids[key], email: `${ids[key]}@example.test`, name: `Người ${key}`, passwordHash: "test-only", role: roles[key], active: key !== "gone" } });
    }
    await db.project.create({ data: { id: project, name: `Dự án chat ${run}`, ownerId: ids.lead, members: { create: [{ userId: ids.binh, role: "MEMBER" }] } } });
    await db.task.create({ data: { id: task.id, title: task.title, projectId: project, createdById: ids.lead, createdAt: new Date(Date.now() - 3_600_000) } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.chatMessage.deleteMany({ where: { authorId: { in: Object.values(ids) } } });
    await db.project.deleteMany({ where: { id: project } });
    await db.notification.deleteMany({ where: { userId: { in: Object.values(ids) } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("notifies the people mentioned and shows a tagged task only to those who see its project", async () => {
    const sent = await post("lead", `${mentionToken({ id: ids.binh, name: "Bình" })} xem giúp ${taskToken(task)} nhé, cc ${mentionToken({ id: ids.gone, name: "Đã nghỉ" })}`);
    expect(sent.status).toBe(201);
    // A closed account is not mentioned: it stays as text.
    expect(sent.body.message.content).toContain("cc @Đã nghỉ");
    const notice = await db.notification.findFirst({ where: { userId: ids.binh, type: "chat.mention" } });
    expect(notice).toMatchObject({ title: "Người lead nhắc bạn trong Trao đổi chung", link: `/chat?m=${sent.body.message.id}` });
    expect(notice?.body).toContain(`@Bình xem giúp #${task.title}`);
    expect(await db.notification.count({ where: { userId: ids.gone } })).toBe(0);

    const mine = await read("binh");
    expect(mine.body.messages.at(-1).id).toBe(sent.body.message.id);
    expect(mine.body.tasks[task.id]).toMatchObject({ title: task.title, projectId: project, status: "TODO" });
    const outsider = await read("out");
    expect(outsider.body.messages.some((m: { id: string }) => m.id === sent.body.message.id)).toBe(true);
    expect(outsider.body.tasks[task.id]).toBeUndefined();

    // Someone outside the project cannot tag its task: the tag becomes plain text.
    const outPost = await post("out", `Còn ${taskToken(task)} thì sao?`);
    expect(outPost.body.message.content).toBe(`Còn #${task.title} thì sao?`);
    expect((await db.chatMessage.findUnique({ where: { id: outPost.body.message.id } }))?.taskIds).toEqual([]);

    // Polling picks up only what came after.
    const after = await read("binh", `?after=${sent.body.message.id}`);
    expect(after.body.messages.map((m: { id: string }) => m.id)).toEqual([outPost.body.message.id]);
    expect((await read("binh", "?after=nope")).status).toBe(404);
  });

  it("does not notify twice someone who was just given the tagged task", async () => {
    await db.task.create({ data: { id: fresh.id, title: fresh.title, projectId: project, createdById: ids.lead, assigneeId: ids.binh } });
    const before = await db.notification.count({ where: { userId: ids.binh, type: "chat.mention" } });
    await post("lead", `➜ Đã giao ${taskToken(fresh)} cho ${mentionToken({ id: ids.binh, name: "Bình" })}`);
    expect(await db.notification.count({ where: { userId: ids.binh, type: "chat.mention" } })).toBe(before);
  });

  it("lets authors withdraw their messages and an administrator any, with a log entry", async () => {
    const { one } = await routes();
    const msg = (await post("binh", "Tin cần thu hồi")).body.message;
    const del = (who: keyof typeof ids, id: string) => call(who, () => one.DELETE(req(`/api/chat/${id}`, "DELETE"), { params: Promise.resolve({ id }) }));
    expect((await del("out", msg.id)).status).toBe(403);
    expect((await del("admin", msg.id)).status).toBe(200);
    expect(await db.auditLog.count({ where: { actorId: ids.admin, action: "chat.delete", entityId: msg.id } })).toBe(1);
    expect((await del("binh", msg.id)).status).toBe(404); // already withdrawn
    const shown = (await read("out")).body.messages.find((m: { id: string }) => m.id === msg.id);
    expect(shown).toMatchObject({ deleted: true, content: "" });

    const own = (await post("binh", "Gõ nhầm")).body.message;
    expect((await del("binh", own.id)).status).toBe(200);
    expect(await db.auditLog.count({ where: { actorId: ids.binh, action: "chat.delete" } })).toBe(0);
    expect((await post("binh", "   ")).status).toBe(400);
  });
});
