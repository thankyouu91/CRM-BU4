import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { createCustomerSchema } from "@/lib/customers";
import { customerDto, customerInclude, customerList } from "@/lib/customer-queries";
import { audit } from "@/lib/audit";

// Khách hàng: everyone signed in reads the list; adding and changing needs "Quản lý khách hàng".

export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();
  return ok({ customers: await customerList() });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "CUSTOMER_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Quản lý khách hàng”");
    const d = createCustomerSchema.parse(await req.json());
    const customer = await prisma.customer.create({ data: { ...d, createdById: me.id }, include: customerInclude });
    await audit(
      { id: me.id, name: me.name },
      { action: "customer.create", entityType: "customer", entityId: customer.id, summary: `Thêm khách hàng “${customer.name}”`, details: d },
    );
    return created({ customer: customerDto(customer) });
  });
}
