import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// Public presentation links against a real PostgreSQL: who may create them, what the
// page behind a link shows, and every way a link stops working.
describe.skipIf(!process.env.TEST_DATABASE_URL)("public presentation links on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { lead: `slead-${run}`, member: `smember-${run}`, admin: `sadmin-${run}`, other: `sother-${run}` };
  const roles: Record<keyof typeof ids, string> = { lead: "LEAD", member: "MEMBER", admin: "ADMIN", other: "LEAD" };
  const as = (key: keyof typeof ids): CurrentUser => ({
    id: ids[key], email: `${ids[key]}@example.test`, name: `Người ${key}`, role: roles[key],
    permissions: roles[key] === "ADMIN" ? ["PROJECT_CREATE", "PROJECT_VIEW_ALL", "PROJECT_MANAGE_ALL", "USER_MANAGE", "FINANCE_MANAGE"] : [],
    jobTitle: null, avatarColor: "#000", mustChangePassword: false,
  }) as CurrentUser;
  let projectId: string;
  let otherProject: string;
  const tokens: string[] = [];

  const post = async (body: object) => {
    const { POST } = await import("../app/api/deck-shares/route");
    return POST(new NextRequest("http://local/api/deck-shares", { method: "POST", body: JSON.stringify(body) }));
  };
  const tokenOf = async (res: Response) => {
    const { path } = await res.json();
    const token = String(path).replace("/share/", "");
    tokens.push(token);
    return token;
  };
  const now = new Date().toISOString();

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      await db.user.create({ data: { id: ids[key], email: `${ids[key]}@example.test`, name: `Người ${key}`, passwordHash: "test-only", role: roles[key] as never } });
    }
    projectId = (await db.project.create({ data: { name: `Dự án chia sẻ ${run}`, ownerId: ids.lead, status: "ACTIVE", members: { create: [{ userId: ids.member, role: "MEMBER" }] } } })).id;
    otherProject = (await db.project.create({ data: { name: `Dự án kín ${run}`, ownerId: ids.other } })).id;
    await db.task.create({ data: { title: `Việc công khai ${run}`, projectId, assigneeId: ids.member, createdById: ids.lead, status: "IN_PROGRESS", dueDate: new Date(Date.now() + 3 * 86_400_000) } });
    await db.task.create({ data: { title: `Việc kín ${run}`, projectId: otherProject, createdById: ids.other } });
    await db.contract.create({ data: { name: `HĐ ${run}`, value: 500_000_000n, performedAt: new Date(), createdById: ids.admin, projectId } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.contract.deleteMany({ where: { createdById: ids.admin } });
    await db.project.deleteMany({ where: { id: { in: [projectId, otherProject] } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("lets team leads create a link for a report they can see, storing only its hash", async () => {
    session.user = as("member");
    expect((await post({ period: "month", date: now, projectId })).status).toBe(403);
    session.user = as("other");
    expect((await post({ period: "month", date: now, projectId })).status).toBe(404); // not their project
    session.user = as("lead");
    expect((await post({ period: "month", date: now, projectId, includeFinance: true })).status).toBe(403); // no finance rights
    expect((await post({ period: "custom", from: "2026-10-20", to: "2026-10-01" })).status).toBe(400);

    const res = await post({ period: "month", date: now, projectId, label: "Gửi đối tác", days: 7 });
    expect(res.status).toBe(201);
    const token = await tokenOf(res);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await db.deckShare.findMany({ where: { createdById: ids.lead } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
    const log = await db.auditLog.findFirst({ where: { actorId: ids.lead, action: "deck_share.create" } });
    expect(log?.summary).toContain("Gửi đối tác");
    expect(JSON.stringify(log?.details)).not.toContain(token);
  });

  it("shows the deck to anyone holding the link, within what its creator can see, and counts views", async () => {
    const { loadSharedDeck } = await import("../lib/report-share");
    session.user = null;
    const deck = await loadSharedDeck(tokens[0]);
    expect(deck).not.toBeNull();
    expect(deck!.projectName).toBe(`Dự án chia sẻ ${run}`);
    expect(deck!.creatorName).toBe("Người lead");
    expect(deck!.summary.projects.map((p) => p.name)).toEqual([`Dự án chia sẻ ${run}`]);
    expect(deck!.summary.finance).toBeUndefined();
    expect(deck!.week.sections).toHaveLength(3);
    await loadSharedDeck(tokens[0]);
    expect((await db.deckShare.findFirst({ where: { createdById: ids.lead } }))?.viewCount).toBe(2);
    expect(await loadSharedDeck("A".repeat(43))).toBeNull();
    expect(await loadSharedDeck("not-a-token")).toBeNull();
  });

  it("leaves contract figures out unless the creator includes them", async () => {
    const { loadSharedDeck } = await import("../lib/report-share");
    session.user = as("admin");
    const without = await tokenOf(await post({ period: "month", date: now, projectId }));
    const withFinance = await tokenOf(await post({ period: "month", date: now, projectId, includeFinance: true }));
    expect((await loadSharedDeck(without))!.summary.finance).toBeUndefined();
    const finance = (await loadSharedDeck(withFinance))!.summary.finance;
    expect(finance?.totals.count).toBe(1);
    expect(Number(finance?.totals.value)).toBe(500_000_000);
  });

  it("lists links for their creator (all of them for administrators) and stops a revoked one at once", async () => {
    const { GET } = await import("../app/api/deck-shares/route");
    const { DELETE } = await import("../app/api/deck-shares/[id]/route");
    const { loadSharedDeck } = await import("../lib/report-share");
    session.user = as("lead");
    const mine = await (await GET()).json();
    expect(mine.canShare).toBe(true);
    expect(mine.shares).toHaveLength(1);
    expect(mine.shares[0]).toMatchObject({ label: "Gửi đối tác", status: "active", viewCount: 2, projectName: `Dự án chia sẻ ${run}` });
    session.user = as("admin");
    expect((await (await GET()).json()).shares.filter((s: { createdBy: string }) => s.createdBy.startsWith("Người")).length).toBeGreaterThanOrEqual(3);

    const id = mine.shares[0].id;
    const del = (who: keyof typeof ids) => {
      session.user = as(who);
      return DELETE(new NextRequest(`http://local/api/deck-shares/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });
    };
    expect((await del("other")).status).toBe(404);
    expect(await loadSharedDeck(tokens[0])).not.toBeNull();
    const res = await del("lead");
    expect(res.status).toBe(200);
    expect((await res.json()).share.status).toBe("revoked");
    expect(await loadSharedDeck(tokens[0])).toBeNull();
    expect(await db.auditLog.count({ where: { actorId: ids.lead, action: "deck_share.revoke", entityId: id } })).toBe(1);
  });

  it("stops working when it expires, when its creator is deactivated, or with its project", async () => {
    const { loadSharedDeck } = await import("../lib/report-share");
    session.user = as("lead");
    const token = await tokenOf(await post({ period: "month", date: now, projectId, days: 1 }));
    expect(await loadSharedDeck(token)).not.toBeNull();
    expect(await loadSharedDeck(token, new Date(Date.now() + 2 * 86_400_000))).toBeNull();

    await db.user.update({ where: { id: ids.lead }, data: { active: false } });
    expect(await loadSharedDeck(token)).toBeNull();
    await db.user.update({ where: { id: ids.lead }, data: { active: true } });
    expect(await loadSharedDeck(token)).not.toBeNull();

    await db.task.deleteMany({ where: { projectId } });
    await db.project.delete({ where: { id: projectId } });
    expect(await db.deckShare.count({ where: { projectId } })).toBe(0);
    expect(await loadSharedDeck(token)).toBeNull();
  });
});
