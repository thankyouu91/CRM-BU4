import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { canAccessProject } from "@/lib/rbac";
import { parseDate, parsePeriodType, resolvePeriod } from "@/lib/period";
import { contractDto, summarizeContracts, toDbAmounts } from "@/lib/contracts";
import { createContractSchema } from "@/lib/validations";

const projectBrief = { select: { id: true, name: true, color: true } } as const;

/**
 * GET /api/contracts?period=day|month|quarter|year|custom&date=&from=&to=&all=1
 * Contracts whose implementation date falls in the period (all=1: every contract),
 * with derived profit/receivable metrics and totals.
 */
export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");

  const sp = req.nextUrl.searchParams;
  const all = sp.get("all") === "1";
  const type = parsePeriodType(sp.get("period"));
  const range = resolvePeriod(type, parseDate(sp.get("date")), {
    from: sp.get("from") ? parseDate(sp.get("from")) : null,
    to: sp.get("to") ? parseDate(sp.get("to")) : null,
  });

  const rows = await prisma.contract.findMany({
    where: all ? {} : { performedAt: { gte: range.from, lte: range.to } },
    orderBy: [{ performedAt: "asc" }, { createdAt: "asc" }],
    include: { project: projectBrief },
  });
  const contracts = rows.map(contractDto);
  return ok({
    period: all ? null : { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
    contracts,
    totals: summarizeContracts(contracts),
  });
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
    return created({ contract: contractDto(contract) });
  });
}
