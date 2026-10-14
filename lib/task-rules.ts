import { clampProgress } from "./utils";
import { InputError } from "./errors";

/** A task cannot be due before it starts (either date may be missing). */
export function checkTaskDates(startDate: Date | null | undefined, dueDate: Date | null | undefined) {
  if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) throw new InputError("Hạn chót không được trước ngày bắt đầu");
}

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
  // Metadata-only edits must not write a snapshot of state read earlier.
  if (patch.status === undefined && patch.progress === undefined) return {};
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

/**
 * Whether work in a project can be given to this person: the owner or a member who is
 * not a viewer ("member"); or the person acting, when they may contribute without being
 * in the project (org-wide project managers): they join it on taking the work ("join").
 */
export function assignability(memberIds: Set<string>, assigneeId: string, actor: { id: string }, actorCanContribute: boolean): "member" | "join" | null {
  if (memberIds.has(assigneeId)) return "member";
  if (assigneeId === actor.id && actorCanContribute) return "join";
  return null;
}
