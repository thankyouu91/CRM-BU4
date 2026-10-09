import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { canAccessProject } from "@/lib/rbac";
import { contractDto, toDbAmounts } from "@/lib/contracts";
import { updateContractSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
    if (!(await prisma.contract.findUnique({ where: { id: params.id }, select: { id: true } }))) {
      return notFound("Không tìm thấy hợp đồng");
    }

    const d = updateContractSchema.parse(await req.json());
    if (d.projectId && !(await canAccessProject(me, d.projectId))) {
      return badRequest("Dự án liên kết không hợp lệ", { projectId: "Dự án không hợp lệ" });
    }
    // undefined leaves a field unchanged; null or "" clears optional text.
    const text = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    const contract = await prisma.contract.update({
      where: { id: params.id },
      data: {
        code: text(d.code),
        name: d.name?.trim(),
        partner: text(d.partner),
        performedAt: d.performedAt,
        status: d.status,
        expectedMargin: d.expectedMargin === undefined ? undefined : d.expectedMargin,
        note: text(d.note),
        projectId: d.projectId === undefined ? undefined : d.projectId || null,
        ...toDbAmounts(d),
      },
      include: { project: { select: { id: true, name: true, color: true } } },
    });
    return ok({ contract: contractDto(contract) });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
  const existing = await prisma.contract.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return notFound("Không tìm thấy hợp đồng");
  await prisma.contract.delete({ where: { id: params.id } });
  return ok({ ok: true });
}
