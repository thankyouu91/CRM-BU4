// One change (assignee, deadline, start date, status or priority) applied to many
// tasks at once, with the same rights and rules as editing them one by one
// (app/api/tasks/[id]/route.ts): tasks the person may not change are skipped,
// each with the reason.

import type { Prisma, Task } from "@prisma/client";
import { accessFrom, taskRights } from "./rbac";
import { assignability, resolveTaskState } from "./task-rules";
import type { CurrentUser } from "./session";
import type { BulkTaskPatch } from "./validations";

export type BulkTaskRow = Pick<Task, "id" | "title" | "projectId" | "assigneeId" | "createdById" | "status" | "progress" | "completedAt" | "updatedAt" | "startDate" | "dueDate" | "priority"> & {
  project: { name: string; ownerId: string; members: { userId: string; role: "MANAGER" | "MEMBER" | "VIEWER" }[] };
};

export interface BulkSkip {
  id: string;
  title: string | null;
  reason: string;
}

export interface BulkPlan {
  apply: { task: BulkTaskRow; data: Prisma.TaskUncheckedUpdateManyInput }[];
  skipped: BulkSkip[];
  /** Already as asked: nothing to write. */
  unchanged: number;
  /** Projects the person joins to take tasks in them (they manage them without being members). */
  join: string[];
}

const time = (d: Date | null | undefined) => (d ? d.getTime() : null);

/** Which of the requested tasks change and how; never writes. */
export function planBulk(me: CurrentUser, ids: string[], rows: BulkTaskRow[], patch: BulkTaskPatch, assigneeName?: string | null): BulkPlan {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const needsManage = patch.assigneeId !== undefined || patch.priority !== undefined || patch.startDate !== undefined || patch.dueDate !== undefined;
  const plan: BulkPlan = { apply: [], skipped: [], unchanged: 0, join: [] };
  const join = new Set<string>();
  for (const id of new Set(ids)) {
    const task = byId.get(id);
    const member = task?.project.members.find((m) => m.userId === me.id);
    const access = task ? accessFrom(me, task.project.ownerId, member?.role ?? null) : null;
    // A task in a project the person cannot see is reported like a missing one.
    if (!task || !access?.view) {
      plan.skipped.push({ id, title: null, reason: "Không tìm thấy công việc" });
      continue;
    }
    const rights = taskRights(me, access, task);
    const skip = (reason: string) => plan.skipped.push({ id, title: task.title, reason });
    if (!rights.report) {
      skip("Bạn không có quyền sửa công việc này");
      continue;
    }
    if (needsManage && !rights.manage) {
      skip("Chỉ người quản lý công việc mới đổi được người phụ trách, ưu tiên hoặc ngày");
      continue;
    }
    let joins = false;
    if (patch.assigneeId) {
      const memberIds = new Set([task.project.ownerId, ...task.project.members.filter((m) => m.role !== "VIEWER").map((m) => m.userId)]);
      const assign = assignability(memberIds, patch.assigneeId, me, access.contribute);
      if (!assign) {
        skip(`${assigneeName ?? "Người được chọn"} không phải thành viên dự án “${task.project.name}”`);
        continue;
      }
      joins = assign === "join";
    }
    const start = patch.startDate !== undefined ? patch.startDate : task.startDate;
    const due = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
    if (start && due && start.getTime() > due.getTime()) {
      skip("Ngày bắt đầu sau deadline");
      continue;
    }
    const data: Prisma.TaskUncheckedUpdateManyInput = {
      ...(patch.assigneeId !== undefined && patch.assigneeId !== task.assigneeId ? { assigneeId: patch.assigneeId } : {}),
      ...(patch.priority !== undefined && patch.priority !== task.priority ? { priority: patch.priority } : {}),
      ...(patch.startDate !== undefined && time(patch.startDate) !== time(task.startDate) ? { startDate: patch.startDate } : {}),
      ...(patch.dueDate !== undefined && time(patch.dueDate) !== time(task.dueDate) ? { dueDate: patch.dueDate } : {}),
      ...(patch.status !== undefined && patch.status !== task.status ? resolveTaskState(task, { status: patch.status }) : {}),
    };
    if (!Object.keys(data).length) {
      plan.unchanged++;
      continue;
    }
    plan.apply.push({ task, data });
    if (joins && data.assigneeId) join.add(task.projectId);
  }
  plan.join = [...join];
  return plan;
}
