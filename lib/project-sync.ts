// Keep a project's status in step with its tasks. Called after every task write
// (create, edit, progress report, review, bulk change, delete); the routes the AI
// assistant uses are the same, so its changes are covered too.

import { prisma } from "./prisma";
import { audit, type AuditActor } from "./audit";
import { PROJECT_STATUS } from "./constants";

type ProjectStatus = keyof typeof PROJECT_STATUS;

export interface TaskCounts {
  total: number;
  /** Not DONE. */
  open: number;
  /** IN_PROGRESS, REVIEW or DONE: work has begun. */
  started: number;
}

/**
 * The status a project should move to after its tasks changed, or null to leave it:
 *  - Planning, and work has begun → in progress.
 *  - Every task done (at least one) → completed.
 *  - Completed, but a task is open again (added or reopened) → in progress.
 * On hold and cancelled are decisions people make; they are never changed here.
 */
export function nextProjectStatus(status: ProjectStatus, c: TaskCounts): ProjectStatus | null {
  if (status === "ON_HOLD" || status === "CANCELLED") return null;
  if (c.total > 0 && c.open === 0) return status === "COMPLETED" ? null : "COMPLETED";
  if (status === "COMPLETED" && c.open > 0) return "ACTIVE";
  if (status === "PLANNING" && c.started > 0) return "ACTIVE";
  return null;
}

const REASON: Record<string, string> = {
  ACTIVE: "công việc đã bắt đầu hoặc còn việc chưa xong",
  COMPLETED: "mọi công việc đã hoàn thành",
};

export async function taskCounts(projectId: string): Promise<TaskCounts> {
  const rows = await prisma.task.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } });
  const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  return { total, open: total - n("DONE"), started: n("IN_PROGRESS") + n("REVIEW") + n("DONE") };
}

/** Apply nextProjectStatus to each project and log what changed. Never throws. */
export async function syncProjectStatus(actor: AuditActor, projectIds: Iterable<string>): Promise<void> {
  for (const projectId of new Set(projectIds)) {
    try {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, status: true } });
      if (!project) continue;
      const next = nextProjectStatus(project.status, await taskCounts(projectId));
      if (!next) continue;
      // Only if nobody changed the status meanwhile.
      const { count } = await prisma.project.updateMany({ where: { id: projectId, status: project.status }, data: { status: next } });
      if (!count) continue;
      await audit(actor, {
        action: "project.update",
        entityType: "project",
        entityId: projectId,
        summary: `Tự động chuyển dự án “${project.name}” sang “${PROJECT_STATUS[next].label}” vì ${REASON[next]}`,
        details: { status: { from: project.status, to: next }, auto: true },
      });
    } catch (err) {
      console.error("[project-sync] could not sync", projectId, err);
    }
  }
}
