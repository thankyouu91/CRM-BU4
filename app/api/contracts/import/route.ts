import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { toDbAmounts } from "@/lib/contracts";
import { importContractsSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

/** Bulk create from rows pasted out of Excel (parsed and previewed on the client). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");

    const { rows } = importContractsSchema.parse(await req.json());
    const result = await prisma.contract.createMany({
      data: rows.map((d) => ({
        code: d.code?.trim() || null,
        name: d.name.trim(),
        partner: d.partner?.trim() || null,
        performedAt: d.performedAt,
        status: d.status,
        expectedMargin: d.expectedMargin ?? null,
        note: d.note?.trim() || null,
        // Imported rows are not linked to projects.
        projectId: null,
        createdById: me.id,
        ...toDbAmounts(d),
        value: BigInt(d.value),
      })),
    });
    await audit(
      { id: me.id, name: me.name },
      {
        action: "contract.import",
        entityType: "contract",
        summary: `Nhập ${result.count} hợp đồng từ Excel`,
        // Import only creates rows; nothing is matched against existing contracts.
        details: { rows: rows.length, created: result.count, updated: 0, skipped: rows.length - result.count },
      },
    );
    return created({ count: result.count });
  });
}
