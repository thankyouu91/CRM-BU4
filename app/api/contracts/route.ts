import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { canAccessProject } from "@/lib/rbac";
import { contractDto, toDbAmounts } from "@/lib/contracts";
import { contractList } from "@/lib/contract-queries";
import { createContractSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

const projectBrief = { select: { id: true, name: true, color: true, status: true } } as const;

/** GET /api/contracts: see contractList for the query parameters. */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
  return ok(await contractList(req.nextUrl.searchParams));
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");

    const d = createContractSchema.parse(await req.json());
    if (d.projectId && !(await canAccessProject(me, d.projectId))) {
      return badRequest("Dự án liên kết không hợp lệ", { projectId: "Dự án không hợp lệ" });
    }
    const contract = await prisma.contract.create({
      data: {
        code: d.code?.trim() || null,
        name: d.name.trim(),
        partner: d.partner?.trim() || null,
        performedAt: d.performedAt,
        status: d.status,
        expectedMargin: d.expectedMargin ?? null,
        note: d.note?.trim() || null,
        projectId: d.projectId || null,
        createdById: me.id,
        ...toDbAmounts(d),
        value: BigInt(d.value),
      },
      include: { project: projectBrief },
    });
    await audit(
      { id: me.id, name: me.name },
      {
        action: "contract.create",
        entityType: "contract",
        entityId: contract.id,
        summary: `Tạo hợp đồng “${contract.code ?? contract.name}”`,
        details: { code: contract.code, name: contract.name, partner: contract.partner, value: Number(contract.value) },
      },
    );
    return created({ contract: contractDto(contract) });
  });
}
