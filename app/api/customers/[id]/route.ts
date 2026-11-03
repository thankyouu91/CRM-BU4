import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { updateCustomerSchema } from "@/lib/customers";
import { customerDto, customerIncludeFor } from "@/lib/customer-queries";
import { audit, changedFields } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
const refuse = () => forbidden("Bạn chưa được cấp quyền “Quản lý khách hàng”");

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "CUSTOMER_MANAGE")) return refuse();
    const before = await prisma.customer.findUnique({ where: { id } });
    if (!before) return notFound("Không tìm thấy khách hàng");
    const d = updateCustomerSchema.parse(await req.json());
    const customer = await prisma.customer.update({ where: { id }, data: d, include: customerIncludeFor(me) });
    const changes = changedFields(before, customer, ["name", "taxCode", "industry", "address", "phone", "email", "website", "note"]);
    if (Object.keys(changes).length) {
      await audit(
        { id: me.id, name: me.name },
        { action: "customer.update", entityType: "customer", entityId: id, summary: `Sửa khách hàng “${customer.name}”`, details: changes as Prisma.InputJsonValue },
      );
    }
    return ok({ customer: customerDto(customer) });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "CUSTOMER_MANAGE")) return refuse();
    const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { contacts: true } } } });
    if (!existing) return notFound("Không tìm thấy khách hàng");
    // Its people go with it (cascade).
    await prisma.customer.delete({ where: { id } });
    await audit(
      { id: me.id, name: me.name },
      {
        action: "customer.delete",
        entityType: "customer",
        entityId: id,
        summary: `Xoá khách hàng “${existing.name}”`,
        details: { name: existing.name, contacts: existing._count.contacts },
      },
    );
    return ok({ ok: true });
  });
}
