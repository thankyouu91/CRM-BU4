import { prisma } from "./prisma";
import { effectiveProgress, indexChildren } from "./task-progress";

/** Load minimal tree nodes, including descendants assigned to other people. */
export async function withTaskProgress<T extends { id: string; projectId: string }>(tasks: T[]): Promise<(T & { effectiveProgress: number })[]> {
  if (!tasks.length) return [];
  const nodes = await prisma.task.findMany({
    where: { projectId: { in: [...new Set(tasks.map((t) => t.projectId))] } },
    select: { id: true, parentId: true, status: true, progress: true },
  });
  const byId = new Map(nodes.map((t) => [t.id, t]));
  const children = indexChildren(nodes);
  return tasks.map((t) => ({ ...t, effectiveProgress: byId.has(t.id) ? Math.round(effectiveProgress(byId.get(t.id)!, children)) : 0 }));
}
