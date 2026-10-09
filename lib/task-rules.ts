import { clampProgress } from "./utils";

type Status = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

interface Current {
  status: Status;
  progress: number;
  completedAt: Date | null;
}

interface Patch {
  status?: Status;
  progress?: number;
}

/**
 * Reconcile status, progress and completedAt for a task update:
 *  - Moving to DONE sets progress 100 and stamps completedAt.
 *  - Leaving DONE clears completedAt.
 *  - Reporting progress on a TODO task (without an explicit status) starts it.
 */
export function resolveTaskState(current: Current, patch: Patch) {
  let status = patch.status ?? current.status;
  let progress = patch.progress !== undefined ? clampProgress(patch.progress) : current.progress;

  if (patch.status === undefined && status === "TODO" && progress > 0) status = "IN_PROGRESS";

  let completedAt = current.completedAt;
  if (status === "DONE") {
    progress = 100;
    if (current.status !== "DONE" || !completedAt) completedAt = new Date();
  } else {
    completedAt = null;
  }

  return { status, progress, completedAt };
}
