import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { projectSchedule } from "./stats";
import { contractDto, type ContractProject } from "./contracts";

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
