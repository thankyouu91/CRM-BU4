import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { projectSchedule } from "./stats";
import { contractDto, summarizeContracts, type ContractProject } from "./contracts";
import { parseDate, parsePeriodType, resolvePeriod } from "./period";

/**
 * Contracts as API rows. Linked projects carry their live completion and
 * deadline status, so money and progress are always read from the same place.
 */
export async function loadContracts(where: Prisma.ContractWhereInput) {
  const rows = await prisma.contract.findMany({
    where,
    orderBy: [{ performedAt: "asc" }, { createdAt: "asc" }],
    include: { project: { select: { id: true, name: true, color: true, startDate: true, dueDate: true, createdAt: true } } },
  });
  const projectIds = [...new Set(rows.flatMap((r) => (r.projectId ? [r.projectId] : [])))];
  const tasks = projectIds.length
    ? await prisma.task.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, parentId: true, projectId: true, status: true, progress: true, dueDate: true },
      })
    : [];
  const now = new Date();
  const progressOf = new Map<string, Pick<ContractProject, "progress" | "scheduleStatus">>();
  for (const r of rows) {
    if (!r.project || progressOf.has(r.project.id)) continue;
    const s = projectSchedule(r.project, tasks.filter((t) => t.projectId === r.project!.id), now);
    progressOf.set(r.project.id, { progress: s.progress, scheduleStatus: s.schedule.status });
  }
  return rows.map(({ project, ...c }) =>
    contractDto({
      ...c,
      project: project ? { id: project.id, name: project.name, color: project.color, ...progressOf.get(project.id) } : null,
    }),
  );
}

/**
 * GET /api/contracts?period=day|month|quarter|year|custom&date=&from=&to=&all=1&projectId=
 * Contracts whose implementation date falls in the period (all=1: every contract;
 * projectId: every contract of that project), with derived metrics and totals.
 */
export async function contractList(sp: URLSearchParams) {
  const projectId = sp.get("projectId");
  const all = sp.get("all") === "1" || !!projectId;
  const type = parsePeriodType(sp.get("period"));
  const range = resolvePeriod(type, parseDate(sp.get("date")), {
    from: sp.get("from") ? parseDate(sp.get("from")) : null,
    to: sp.get("to") ? parseDate(sp.get("to")) : null,
  });

  const contracts = await loadContracts(
    projectId ? { projectId } : all ? {} : { performedAt: { gte: range.from, lte: range.to } },
  );
  return {
    period: all ? null : { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
    contracts,
    totals: summarizeContracts(contracts),
  };
}
