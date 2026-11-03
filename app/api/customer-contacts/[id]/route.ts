import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { updateContactSchema } from "@/lib/customers";
import { contactDto } from "@/lib/customer-queries";
import { audit, changedFields } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
const refuse = () => forbidden("Bạn chưa được cấp quyền “Quản lý khách hàng”");

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "CUSTOMER_MANAGE")) return refuse();
    const before = await prisma.customerContact.findUnique({ where: { id }, include: { customer: { select: { name: true } } } });
    if (!before) return notFound("Không tìm thấy người liên hệ");
    const d = updateContactSchema.parse(await req.json());
    const contact = await prisma.customerContact.update({ where: { id }, data: d });
    await prisma.customer.update({ where: { id: before.customerId }, data: { updatedAt: new Date() } });
    const changes = changedFields(before, contact, ["level", "name", "title", "department", "phone", "email", "birthday", "note"]);
    if (Object.keys(changes).length) {
      await audit(
        { id: me.id, name: me.name },
        {
          action: "customer_contact.update",
          entityType: "customer",
          entityId: before.customerId,
          summary: `Sửa người liên hệ “${contact.name}” của “${before.customer.name}”`,
          details: changes as Prisma.InputJsonValue,
        },
      );
    }
    return ok({ contact: contactDto(contact) });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "CUSTOMER_MANAGE")) return refuse();
    const existing = await prisma.customerContact.findUnique({ where: { id }, include: { customer: { select: { name: true } } } });
    if (!existing) return notFound("Không tìm thấy người liên hệ");
    await prisma.customerContact.delete({ where: { id } });
    await prisma.customer.update({ where: { id: existing.customerId }, data: { updatedAt: new Date() } });
    await audit(
      { id: me.id, name: me.name },
      {
        action: "customer_contact.delete",
        entityType: "customer",
        entityId: existing.customerId,
        summary: `Xoá người liên hệ “${existing.name}” của “${existing.customer.name}”`,
        details: { name: existing.name, level: existing.level, title: existing.title },
      },
    );
    return ok({ ok: true });
  });
}
