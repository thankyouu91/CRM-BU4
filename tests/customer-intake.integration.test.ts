import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "../lib/session";
import { effectivePermissions } from "../lib/permissions";

const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => session.user }));

// Form thông tin doanh nghiệp, Loại/Size khách hàng and Checklist cá nhân against a real PostgreSQL.
describe.skipIf(!process.env.TEST_DATABASE_URL)("customer form, kind and checklist on PostgreSQL", () => {
  let db: PrismaClient;
  const run = randomUUID().slice(0, 8);
  const ids = { sales: `isales-${run}`, staff: `istaff-${run}`, money: `imoney-${run}` };
  const grants: Record<keyof typeof ids, string[]> = { sales: ["CUSTOMER_MANAGE"], staff: [], money: ["FINANCE_MANAGE"] };
  const as = (key: keyof typeof ids): CurrentUser =>
    ({ id: ids[key], email: `${ids[key]}@example.test`, name: key, role: "MEMBER", permissions: effectivePermissions("MEMBER", grants[key]), jobTitle: null, avatarColor: "#000", mustChangePassword: false }) as CurrentUser;
  const req = (url: string, method: string, body?: object) =>
    new NextRequest(`http://local${url}`, { method, headers: { "cf-connecting-ip": `10.0.0.${Math.floor(Math.random() * 250)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const call = async (who: keyof typeof ids | null, fn: () => Promise<Response>) => {
    session.user = who ? as(who) : null;
    const res = await fn();
    return { status: res.status, body: await res.json() };
  };
  const p = <T extends string>(key: T, value: string) => ({ params: Promise.resolve({ [key]: value } as Record<T, string>) });

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Integration tests require a local database whose name ends in _test");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = (await import("../lib/prisma")).prisma;
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      await db.user.create({ data: { id: ids[key], email: `${ids[key]}@example.test`, name: key, passwordHash: "test-only", role: "MEMBER", permissions: grants[key] as never } });
    }
  });

  afterAll(async () => {
    if (!db) return;
    await db.contract.deleteMany({ where: { name: { contains: run } } });
    await db.project.deleteMany({ where: { name: { contains: run } } });
    await db.customer.deleteMany({ where: { name: { contains: run } } });
    await db.customerIntakeLink.deleteMany({ where: { createdById: { in: Object.values(ids) } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("takes a company's answer through a link, then adds, merges or turns it down once", async () => {
    const links = await import("../app/api/customer-intake/links/route");
    const link = await import("../app/api/customer-intake/links/[id]/route");
    const form = await import("../app/api/form/[token]/route");
    const subs = await import("../app/api/customer-intake/submissions/route");
    const decide = await import("../app/api/customer-intake/submissions/[id]/route");

    expect((await call("staff", () => links.POST(req("/x", "POST", { label: "Hội thảo", days: 30 })))).status).toBe(403);
    const made = await call("sales", () => links.POST(req("/x", "POST", { label: "Hội thảo", days: 30 })));
    expect(made.status).toBe(201);
    const token = made.body.path.split("/").pop() as string;

    const answer = (name: string, extra: object = {}) =>
      call(null, () => form.POST(req("/x", "POST", { name, taxCode: "0312345678", address: "Q1, TP.HCM", contacts: [{ level: "DIRECTOR", name: "Nguyễn Văn A", phone: "0901234567" }], ...extra }), p("token", token)));
    expect((await answer(`Công ty TNHH Mới ${run}`)).status).toBe(200);
    expect((await answer(`Công ty Bot ${run}`, { website2: "spam" })).status).toBe(200); // honeypot: kept nowhere
    expect((await answer(`Công ty Sai ${run}`, { contacts: [{ level: "BOSS", name: "x" }] })).status).toBe(400);
    expect((await call(null, () => form.POST(req("/x", "POST", { name: "x" }), p("token", "nope")))).status).toBe(410);

    const listed = await call("sales", () => subs.GET());
    const mine = (listed.body.submissions as { id: string; data: { name: string }; status: string; checks: { message: string }[] }[]).filter((s) => s.data.name.includes(run));
    expect(mine.map((s) => s.data.name)).toEqual([`Công ty TNHH Mới ${run}`]);
    expect(mine[0].checks).toEqual([]);

    // Approve: a customer with its director; a second decision is refused.
    const ok = await call("sales", () => decide.POST(req("/x", "POST", { action: "approve" }), p("id", mine[0].id)));
    expect(ok.status).toBe(200);
    expect(ok.body.customer).toMatchObject({ name: `Công ty TNHH Mới ${run}`, kind: "NEW", contacts: [{ name: "Nguyễn Văn A", level: "DIRECTOR" }] });
    expect((await call("sales", () => decide.POST(req("/x", "POST", { action: "reject" }), p("id", mine[0].id)))).status).toBe(409);

    // The same company again: flagged as a duplicate, merged without overwriting staff's data.
    await db.customer.update({ where: { id: ok.body.customer.id }, data: { phone: "028 1111 1111" } });
    await answer(`Cty Mới ${run}`, { phone: "0999999999", website: "moi.vn", contacts: [{ level: "DIRECTOR", name: "Nguyễn Văn A" }, { level: "STAFF", name: "Trần B" }] });
    const again = (await call("sales", () => subs.GET())).body.submissions.find((s: { data: { name: string } }) => s.data.name === `Cty Mới ${run}`);
    expect(again.duplicates.map((d: { id: string }) => d.id)).toEqual([ok.body.customer.id]);
    const merged = await call("sales", () => decide.POST(req("/x", "POST", { action: "merge", customerId: ok.body.customer.id }), p("id", again.id)));
    expect(merged.body.customer).toMatchObject({ phone: "028 1111 1111", website: "moi.vn" });
    expect(merged.body.customer.contacts.map((c: { name: string }) => c.name).sort()).toEqual(["Nguyễn Văn A", "Trần B"]);

    // A revoked link takes nothing more.
    expect((await call("sales", () => link.DELETE(req("/x", "DELETE"), p("id", made.body.id)))).status).toBe(200);
    expect((await answer(`Công ty Muộn ${run}`)).status).toBe(410);
    // Each answer tells everyone with "Quản lý khách hàng" whether it is a new or a listed company.
    const { submitIntake } = await import("../lib/customer-intake-queries");
    const fresh = await call("sales", () => links.POST(req("/x", "POST", { label: "Báo tin", days: 0 })));
    // days 0: a link without an end date.
    expect((await db.customerIntakeLink.findUniqueOrThrow({ where: { id: fresh.body.id } })).expiresAt.getUTCFullYear()).toBe(9999);
    const sent = await submitIntake(fresh.body.path.split("/").pop(), { name: `Cty Mới ${run}`, taxCode: null, industry: null, address: null, phone: null, email: null, website: null, note: null, contacts: [] });
    await sent!.followUp;
    const notes = await db.notification.findMany({ where: { type: "customer.intake", userId: { in: Object.values(ids) } }, select: { userId: true, title: true, link: true } });
    expect(notes).toContainEqual({ userId: ids.sales, title: `Khách cũ “Công ty TNHH Mới ${run}” gửi thông tin: cập nhật liên hệ`, link: "/customers?intake=1" });
    expect(notes.filter((n) => n.userId !== ids.sales)).toEqual([]);

    const actions = await db.auditLog.findMany({ where: { actorId: ids.sales, action: { startsWith: "customer_intake." } }, select: { action: true } });
    expect(actions.map((a) => a.action).sort()).toEqual(["customer_intake.approve", "customer_intake.link_create", "customer_intake.link_create", "customer_intake.link_revoke", "customer_intake.merge"]);
  });

  it("works out kind and size from every project and contract, amounts only for finance", async () => {
    const { customerList } = await import("../lib/customer-queries");
    const one = await import("../app/api/customers/[id]/route");
    const c = await db.customer.create({ data: { name: `Công ty Size ${run}`, createdById: ids.sales } });
    const find = async (who: keyof typeof ids) => (await customerList(as(who))).find((x) => x.id === c.id)!;
    expect(await find("staff")).toMatchObject({ kind: "NEW", size: null, contractValue: null });

    const planned = await db.project.create({ data: { name: `Dự định ${run}`, ownerId: ids.sales, customerId: c.id } });
    expect((await find("staff")).kind).toBe("LEAD");
    await db.contract.create({ data: { name: `HĐ ${run}`, value: 600_000_000n, performedAt: new Date(), projectId: planned.id, createdById: ids.sales } });
    // staff cannot see the project, yet the company is still Đã làm / Lớn; the amount stays hidden.
    expect(await find("staff")).toMatchObject({ kind: "DONE", size: "LARGE", contractValue: null, projects: [] });
    expect((await find("money")).contractValue).toBe(600_000_000);

    const manual = await call("sales", () => one.PATCH(req("/x", "PATCH", { kind: "LEAD" }), p("id", c.id)));
    expect(manual.body.customer).toMatchObject({ kind: "LEAD", kindAuto: "DONE", kindManual: true });
    const back = await call("sales", () => one.PATCH(req("/x", "PATCH", { kind: null }), p("id", c.id)));
    expect(back.body.customer).toMatchObject({ kind: "DONE", kindManual: false });
  });

  it("keeps a checklist private, carries open items to the next day and shows past days as they were", async () => {
    const { addChecklistItem, checklistOf, updateChecklistItem } = await import("../lib/checklist");
    const items = await import("../app/api/checklist/[id]/route");
    const mon = new Date("2026-11-23T03:00:00Z");
    const tue = new Date("2026-11-24T03:00:00Z");
    const a = await addChecklistItem(ids.staff, "  Gọi khách  ", mon);
    const b = await addChecklistItem(ids.staff, "Gửi báo giá", mon);
    expect(a.text).toBe("Gọi khách");
    await updateChecklistItem(ids.staff, b.id, { done: true }, mon);

    // Tuesday: only the open item came along; Monday still shows both, with b done that day.
    expect((await checklistOf(ids.staff, undefined, tue)).items.map((i) => i.text)).toEqual(["Gọi khách"]);
    await updateChecklistItem(ids.staff, a.id, { done: true }, tue);
    const monday = await checklistOf(ids.staff, "2026-11-23", tue);
    expect(monday.items.map((i) => [i.text, i.doneDay])).toEqual([["Gọi khách", null], ["Gửi báo giá", "2026-11-23"]]);

    expect((await call("sales", () => items.PATCH(req("/x", "PATCH", { done: false }), p("id", a.id)))).status).toBe(404);
    expect((await call("sales", () => items.DELETE(req("/x", "DELETE"), p("id", a.id)))).status).toBe(404);
    expect((await call("staff", () => items.DELETE(req("/x", "DELETE"), p("id", a.id)))).status).toBe(200);
  });
});
