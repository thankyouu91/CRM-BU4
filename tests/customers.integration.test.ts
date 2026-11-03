import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";
import { effectivePermissions } from "../lib/permissions";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// Khách hàng against a real PostgreSQL: who may change what, cascades and the action log.
describe.skipIf(!process.env.TEST_DATABASE_URL)("customers on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { boss: `cboss-${run}`, sales: `csales-${run}`, staff: `cstaff-${run}` };
  const roles = { boss: "MANAGER", sales: "MEMBER", staff: "MEMBER" } as const;
  const grants: Record<keyof typeof ids, string[]> = { boss: [], sales: ["CUSTOMER_MANAGE"], staff: [] };
  const as = (key: keyof typeof ids): CurrentUser =>
    ({ id: ids[key], email: `${ids[key]}@example.test`, name: key, role: roles[key], permissions: effectivePermissions(roles[key], grants[key]), jobTitle: null, avatarColor: "#000", mustChangePassword: false }) as CurrentUser;

  const req = (url: string, method: string, body?: object) => new NextRequest(`http://local${url}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const routes = async () => ({
    list: await import("../app/api/customers/route"),
    one: await import("../app/api/customers/[id]/route"),
    contacts: await import("../app/api/customers/[id]/contacts/route"),
    contact: await import("../app/api/customer-contacts/[id]/route"),
  });
  const call = async (who: keyof typeof ids, fn: () => Promise<Response>) => {
    session.user = as(who);
    const res = await fn();
    return { status: res.status, body: await res.json() };
  };
  const name = `Công ty Thử ${run}`;

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      await db.user.create({ data: { id: ids[key], email: `${ids[key]}@example.test`, name: key, passwordHash: "test-only", role: roles[key], permissions: grants[key] as never } });
    }
  });

  afterAll(async () => {
    if (!db) return;
    await db.customer.deleteMany({ where: { name: { contains: run } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("lets people with the permission add a company and its people, and everyone read them", async () => {
    const r = await routes();
    const refused = await call("staff", () => r.list.POST(req("/api/customers", "POST", { name })));
    expect(refused.status).toBe(403);

    const made = await call("sales", () => r.list.POST(req("/api/customers", "POST", { name, taxCode: "0101010101", email: "" })));
    expect(made.status).toBe(201);
    expect(made.body.customer).toMatchObject({ name, taxCode: "0101010101", email: null, contacts: [] });
    const id = made.body.customer.id as string;

    const bad = await call("sales", () => r.contacts.POST(req(`/api/customers/${id}/contacts`, "POST", { level: "CEO", name: "Lan" }), params(id)));
    expect(bad.status).toBe(400);
    const director = await call("boss", () => r.contacts.POST(req(`/api/customers/${id}/contacts`, "POST", { level: "DIRECTOR", name: "Nguyễn Văn A", title: "Tổng giám đốc", phone: "0901 000 111" }), params(id)));
    expect(director.status).toBe(201);
    await call("sales", () => r.contacts.POST(req(`/api/customers/${id}/contacts`, "POST", { level: "STAFF", name: "Lê Thị B", department: "Nhân sự" }), params(id)));

    const list = await call("staff", () => r.list.GET());
    const mine = list.body.customers.find((c: { id: string }) => c.id === id);
    expect(mine.contacts.map((c: { name: string; level: string }) => `${c.level}:${c.name}`).sort()).toEqual(["DIRECTOR:Nguyễn Văn A", "STAFF:Lê Thị B"]);

    // Moving a person to another position and clearing a field.
    const moved = await call("sales", () => r.contact.PATCH(req("/x", "PATCH", { level: "DEPUTY", phone: "" }), params(director.body.contact.id)));
    expect(moved.body.contact).toMatchObject({ level: "DEPUTY", phone: null, title: "Tổng giám đốc" });
    expect((await call("staff", () => r.contact.DELETE(req("/x", "DELETE"), params(director.body.contact.id)))).status).toBe(403);

    const renamed = await call("sales", () => r.one.PATCH(req("/x", "PATCH", { industry: "Giáo dục" }), params(id)));
    expect(renamed.body.customer).toMatchObject({ name, industry: "Giáo dục" });

    // Deleting the company takes its people with it.
    expect((await call("sales", () => r.one.DELETE(req("/x", "DELETE"), params(id)))).status).toBe(200);
    expect(await db.customerContact.count({ where: { customerId: id } })).toBe(0);
    expect((await call("sales", () => r.one.PATCH(req("/x", "PATCH", { industry: "X" }), params(id)))).status).toBe(404);

    const actions = (await db.auditLog.findMany({ where: { actorId: { in: Object.values(ids) }, entityType: "customer" }, select: { action: true } })).map((a) => a.action).sort();
    expect(actions).toEqual(["customer.create", "customer.delete", "customer.update", "customer_contact.create", "customer_contact.create", "customer_contact.update"]);
  });
});
