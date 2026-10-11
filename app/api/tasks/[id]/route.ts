import { updateTaskSafely } from "@/lib/task-service";
import { withTaskProgress } from "@/lib/task-progress-queries";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { accessFrom, loadTaskForUser, taskRights } from "@/lib/rbac";
import { projectMemberIds, withWorkspace } from "@/lib/queries";
import { resolveTaskState } from "@/lib/task-rules";
import { updateTaskSchema } from "@/lib/validations";
import { audit, changedFields } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const userBrief = { select: { id: true, name: true, avatarColor: true, jobTitle: true } } as const;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  // Session and task load together; access comes from the project members loaded with the task.
  const [me, task] = await Promise.all([auth(), loadTaskDetail(params.id)]);
  if (!me) return unauthorized();
  if (!task) return notFound("Không tìm thấy công việc");

  const membership = task.project.members.find((m) => m.user.id === me.id);
  const access = accessFrom(me, task.project.owner.id, membership?.role ?? null);
  if (!access.view) return notFound("Không tìm thấy công việc");
  const [enriched, ...subtasks] = await withTaskProgress([task, ...task.subtasks]);
  return ok({ task: { ...enriched, subtasks }, permissions: taskRights(me, access, task) });
}

function loadTaskDetail(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      // Members + categories let the drawer offer PIC/category pickers without extra requests.
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          owner: userBrief,
          members: { select: { role: true, user: userBrief } },
          categories: { select: { id: true, name: true, color: true, parentId: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        },
      },
      category: { select: { id: true, name: true, color: true, parent: { select: { name: true } } } },
      parent: { select: { id: true, title: true } },
      assignee: userBrief,
      createdBy: userBrief,
      subtasks: {
        orderBy: { createdAt: "asc" },
        include: { assignee: userBrief, _count: { select: { subtasks: true } } },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        include: { author: userBrief, reviewer: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const loaded = await loadTaskForUser(me, params.id);
    if (!loaded) return notFound("Không tìm thấy công việc");
    const { task, perms } = loaded;
    if (!perms.report) return forbidden();

    const data = updateTaskSchema.parse(await req.json());

    // Assignees (without manage rights) may only move status/progress and add notes.
    if (!perms.manage) {
      const restricted = ["title", "categoryId", "assigneeId", "priority", "startDate", "dueDate"] as const;
      if (restricted.some((k) => data[k] !== undefined)) {
        return forbidden("Người thực hiện chỉ được cập nhật trạng thái, tiến độ và mô tả");
      }
    }

    const [category, memberIds] = await Promise.all([
      data.categoryId ? prisma.category.findUnique({ where: { id: data.categoryId }, select: { projectId: true } }) : null,
      data.assigneeId ? projectMemberIds(task.projectId) : null,
    ]);
    if (data.categoryId && (!category || category.projectId !== task.projectId)) return badRequest("Hạng mục không hợp lệ");
    if (data.assigneeId && !memberIds?.has(data.assigneeId)) {
      return badRequest("Người phụ trách phải là thành viên dự án (không phải người chỉ xem)", { assigneeId: "Không phải thành viên dự án" });
    }

    const state = resolveTaskState(task, { status: data.status, progress: data.progress });

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await updateTaskSafely(tx, task, {
          title: data.title?.trim(),
          description: data.description === undefined ? undefined : data.description?.trim() || null,
          categoryId: data.categoryId === undefined ? undefined : data.categoryId || null,
          assigneeId: data.assigneeId === undefined ? undefined : data.assigneeId || null,
          priority: data.priority,
          startDate: data.startDate,
          dueDate: data.dueDate,
          ...state,
      });
      await tx.project.update({ where: { id: task.projectId }, data: { updatedAt: new Date() } });
      return updated;
    });
    const changes = changedFields(task, updated, [
      "title",
      "description",
      "status",
      "progress",
      "priority",
      "categoryId",
      "assigneeId",
      "startDate",
      "dueDate",
      "completedAt",
    ]);
    if (Object.keys(changes).length) {
      await audit(
        { id: me.id, name: me.name },
        {
          action: "task.update",
          entityType: "task",
          entityId: task.id,
          summary: `Sửa công việc “${updated.title}”`,
          details: changes as Prisma.InputJsonValue,
        },
      );
    }
    return ok(await withWorkspace(req, me, task.projectId, { task: updated }));
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const loaded = await loadTaskForUser(me, params.id);
  if (!loaded) return notFound("Không tìm thấy công việc");
  if (!loaded.perms.manage) return forbidden();

  // Subtasks and reports cascade with the task.
  await prisma.task.delete({ where: { id: loaded.task.id } });
  await audit(
    { id: me.id, name: me.name },
    {
      action: "task.delete",
      entityType: "task",
      entityId: loaded.task.id,
      summary: `Xoá công việc “${loaded.task.title}”`,
      details: { title: loaded.task.title, projectId: loaded.task.projectId, status: loaded.task.status },
    },
  );
  return ok(await withWorkspace(req, me, loaded.task.projectId, { ok: true }));
}
