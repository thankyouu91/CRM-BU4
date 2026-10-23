import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";
import { effectivePermissions } from "../lib/permissions";
import { scheduledSessions, shiftMonth } from "../lib/attendance";
import { zonedDay } from "../lib/work-report";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// Timesheets and direct managers against a real PostgreSQL.
describe.skipIf(!process.env.TEST_DATABASE_URL)("attendance on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { hr: `ahr-${run}`, boss: `aboss-${run}`, an: `aan-${run}`, peer: `apeer-${run}` };
  const roles: Record<keyof typeof ids, string> = { hr: "MANAGER", boss: "LEAD", an: "MEMBER", peer: "MEMBER" };
  const names: Record<keyof typeof ids, string> = { hr: "Nhân sự", boss: "Trưởng nhóm", an: "An", peer: "Bạn cùng nhóm" };
  const as = (key: keyof typeof ids): CurrentUser => ({
    id: ids[key], email: `${ids[key]}@example.test`, name: names[key], role: roles[key], permissions: effectivePermissions(roles[key]),
    jobTitle: null, avatarColor: "#000", mustChangePassword: false,
  }) as CurrentUser;

  const today = zonedDay(new Date());
  const month = today.slice(0, 7);
  const lastMonth = shiftMonth(month, -1);
  // The first weekday of a month, and that week's Monday and Sunday (all inside the month).
  const firstWeekday = (m: string) => [...Array(7)].map((_, i) => `${m}-0${i + 1}`).find((d) => scheduledSessions(d).length === 2)!;
  const sunday = [...Array(7)].map((_, i) => `${month}-${String(i + 8).padStart(2, "0")}`).find((d) => scheduledSessions(d).length === 0)!;
  const monday = `${month}-${String(Number(sunday.slice(8)) - 6).padStart(2, "0")}`;
  const saturday = `${month}-${String(Number(sunday.slice(8)) - 1).padStart(2, "0")}`;

  const routes = async () => ({
    view: (await import("../app/api/attendance/route")).GET,
    marks: (await import("../app/api/attendance/marks/route")).POST,
    team: (await import("../app/api/attendance/team/route")).GET,
    balance: (await import("../app/api/attendance/balance/route")).PUT,
    holidays: await import("../app/api/attendance/holidays/route"),
    user: (await import("../app/api/users/[id]/route")).PATCH,
  });
  const json = (url: string, method: string, body?: object) => new NextRequest(`http://local${url}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  const mark = async (who: keyof typeof ids, body: object) => {
    session.user = as(who);
    const res = await (await routes()).marks(json("/api/attendance/marks", "POST", body));
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const key of ["hr", "boss", "peer", "an"] as const) {
      await db.user.create({ data: { id: ids[key], email: `${ids[key]}@example.test`, name: names[key], passwordHash: "test-only", role: roles[key] as never, managerId: key === "an" ? ids.boss : null } });
    }
  });

  afterAll(async () => {
    if (!db) return;
    await db.holiday.deleteMany({ where: { name: { contains: run } } });
    await db.notification.deleteMany({ where: { userId: { in: Object.values(ids) } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.updateMany({ where: { id: { in: Object.values(ids) } }, data: { managerId: null } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("lets people mark their own leave this month, tells their direct manager, and closes past months to them", async () => {
    const day = firstWeekday(month);
    const own = await mark("an", { userId: ids.an, from: day, sessions: ["AM"], kind: "ANNUAL", note: "Đi khám" });
    expect(own.status).toBe(200);
    expect(own.body.changed).toBe(1);
    const am = own.body.view.attendance.days.find((d: { day: string }) => d.day === day).sessions[0];
    expect(am).toMatchObject({ state: "marked", kind: "ANNUAL", note: "Đi khám" });
    expect(own.body.view.balance).toMatchObject({ entitlement: 12, used: 0.5, remaining: 11.5 });
    const notice = await db.notification.findFirst({ where: { userId: ids.boss, type: "attendance.leave" } });
    expect(notice?.title).toContain("An xin nghỉ phép năm sáng");
    expect(notice?.link).toBe(`/attendance?user=${ids.an}&month=${month}`);
    expect(await db.auditLog.count({ where: { actorId: ids.an, action: "attendance.mark" } })).toBe(1);

    expect((await mark("an", { userId: ids.an, from: firstWeekday(lastMonth), kind: "SICK" })).status).toBe(403);
    expect((await mark("an", { userId: ids.an, from: sunday, kind: "ANNUAL" })).body.error).toMatch(/Chủ nhật/);
    expect((await mark("an", { userId: ids.an, from: saturday, sessions: ["PM"], kind: "ANNUAL" })).body.error).toMatch(/Chiều thứ 7/);
    // Back to worked.
    expect((await mark("an", { userId: ids.an, from: day, sessions: ["AM"], kind: null })).body.view.balance.used).toBe(0);
  });

  it("lets the direct manager see and correct any day, and keeps everyone else out", async () => {
    const past = firstWeekday(lastMonth);
    const fixed = await mark("boss", { userId: ids.an, from: past, kind: "SICK", note: "Ốm" });
    expect(fixed.status).toBe(200);
    expect(await db.attendanceMark.count({ where: { userId: ids.an, day: past } })).toBe(2);
    // The manager marking it is not a request: no notice to themselves.
    expect(await db.notification.count({ where: { userId: ids.boss, title: { contains: "ốm" } } })).toBe(0);

    const { view } = await routes();
    session.user = as("peer");
    expect((await view(json(`/api/attendance?user=${ids.an}&month=${month}`, "GET"))).status).toBe(403);
    expect((await mark("peer", { userId: ids.an, from: firstWeekday(month), kind: "UNPAID" })).status).toBe(404);
    session.user = as("boss");
    const seen = await (await view(json(`/api/attendance?user=${ids.an}&month=${month}`, "GET"))).json();
    expect(seen.person).toMatchObject({ name: "An", managerName: "Trưởng nhóm" });
    expect(seen.rights).toMatchObject({ editFrom: "", canEditBalance: false });
  });

  it("marks every working session of a range, skipping Sunday and Saturday afternoon", async () => {
    const res = await mark("hr", { userId: ids.an, from: monday, to: sunday, kind: "BUSINESS", note: "Đi Đà Nẵng" });
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(11);
    const rows = await db.attendanceMark.findMany({ where: { userId: ids.an, day: { gte: monday, lte: sunday } } });
    expect(rows.every((r) => r.kind === "BUSINESS")).toBe(true);
    expect(rows.some((r) => r.day === saturday && r.session === "PM")).toBe(false);
    await mark("hr", { userId: ids.an, from: monday, to: sunday, kind: null });
    expect(await db.attendanceMark.count({ where: { userId: ids.an, day: { gte: monday, lte: sunday } } })).toBe(0);
  });

  it("keeps the annual leave numbers with HR and works out what is left from the calendar", async () => {
    const { balance, view, team } = await routes();
    const put = (who: keyof typeof ids, body: object) => {
      session.user = as(who);
      return balance(json("/api/attendance/balance", "PUT", body));
    };
    const year = Number(month.slice(0, 4));
    expect((await put("an", { userId: ids.an, year, entitlement: 30, carriedOver: 0 })).status).toBe(403);
    expect((await put("boss", { userId: ids.an, year, entitlement: 30, carriedOver: 0 })).status).toBe(403);
    expect((await put("hr", { userId: ids.an, year, entitlement: 12.3, carriedOver: 0 })).status).toBe(400);
    expect((await put("hr", { userId: ids.an, year, entitlement: 14, carriedOver: 2.5, note: "Thâm niên" })).status).toBe(200);
    await mark("an", { userId: ids.an, from: firstWeekday(month), kind: "ANNUAL" });
    session.user = as("an");
    const mine = await (await view(json(`/api/attendance?month=${month}`, "GET"))).json();
    expect(mine.balance).toMatchObject({ entitlement: 14, carriedOver: 2.5, used: 1, remaining: 15.5, note: "Thâm niên" });
    expect(mine.rights.editFrom).toBe(`${month}-01`);
    expect(await db.auditLog.count({ where: { actorId: ids.hr, action: "leave_balance.update" } })).toBe(1);

    session.user = as("hr");
    const sheet = await (await team(json(`/api/attendance/team?month=${month}`, "GET"))).json();
    const an = sheet.people.find((p: { person: { id: string } }) => p.person.id === ids.an);
    expect(an.attendance.totals.leave.ANNUAL).toBe(1);
    expect(an.notes).toHaveLength(2);
    session.user = as("peer");
    const peerSheet = await (await team(json(`/api/attendance/team?month=${month}`, "GET"))).json();
    expect(peerSheet.people.map((p: { person: { id: string } }) => p.person.id)).toEqual([ids.peer]);
  });

  it("takes holidays out of the working days; only HR sets them", async () => {
    const { holidays } = await routes();
    const day = firstWeekday(shiftMonth(month, 1));
    session.user = as("an");
    expect((await holidays.POST(json("/api/attendance/holidays", "POST", { day, name: `Lễ ${run}` }))).status).toBe(403);
    session.user = as("hr");
    expect((await holidays.POST(json("/api/attendance/holidays", "POST", { day, name: `Lễ ${run}` }))).status).toBe(200);
    expect((await mark("hr", { userId: ids.an, from: day, kind: "ANNUAL" })).body.error).toMatch(/nghỉ lễ/);
    expect((await holidays.DELETE(json(`/api/attendance/holidays?day=${day}`, "DELETE"))).status).toBe(200);
    expect(await db.auditLog.count({ where: { actorId: ids.hr, action: { in: ["holiday.create", "holiday.delete"] } } })).toBe(2);
  });

  it("sets a direct manager on a staff profile, never oneself and never in a loop", async () => {
    const { user } = await routes();
    const patch = (who: keyof typeof ids, id: string, body: object) => {
      session.user = as(who);
      return user(json(`/api/users/${id}`, "PATCH", body), { params: Promise.resolve({ id }) });
    };
    expect((await patch("hr", ids.boss, { managerId: ids.boss })).status).toBe(400);
    const loop = await patch("hr", ids.boss, { managerId: ids.an });
    expect(loop.status).toBe(400);
    expect((await loop.json()).error).toMatch(/đang do Trưởng nhóm quản lý/);
    expect((await patch("hr", ids.peer, { managerId: ids.boss })).status).toBe(200);
    expect((await db.user.findUnique({ where: { id: ids.peer } }))?.managerId).toBe(ids.boss);
    const log = await db.auditLog.findFirst({ where: { actorId: ids.hr, action: "user.manager_change" } });
    expect(log?.summary).toBe("Đổi quản lý trực tiếp của Bạn cùng nhóm: chưa có → Trưởng nhóm");
    // A member cannot change their own manager.
    expect((await patch("peer", ids.peer, { managerId: null })).status).toBe(403);
    expect((await patch("hr", ids.peer, { managerId: null })).status).toBe(200);
  });
});
