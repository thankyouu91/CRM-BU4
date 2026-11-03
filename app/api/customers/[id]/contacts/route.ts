import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, notFound, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { CONTACT_LEVEL_INFO, createContactSchema } from "@/lib/customers";
import { contactDto } from "@/lib/customer-queries";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/customers/:id/contacts: add a person at one of the company's positions. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "CUSTOMER_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Quản lý khách hàng”");
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!customer) return notFound("Không tìm thấy khách hàng");
    const d = createContactSchema.parse(await req.json());
    const contact = await prisma.customerContact.create({ data: { ...d, customerId: id } });
    // The parent's "updated" time follows its people.
    await prisma.customer.update({ where: { id }, data: { updatedAt: new Date() } });
    await audit(
      { id: me.id, name: me.name },
      {
        action: "customer_contact.create",
        entityType: "customer",
        entityId: id,
        summary: `Thêm ${CONTACT_LEVEL_INFO[d.level].label.toLowerCase()} “${contact.name}” cho “${customer.name}”`,
        details: d,
      },
    );
    return created({ contact: contactDto(contact) });
  });
}
