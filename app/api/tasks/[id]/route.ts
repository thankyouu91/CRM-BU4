import { updateTaskSafely } from "@/lib/task-service";
import { syncProjectStatus } from "@/lib/project-sync";
import { withTaskProgress } from "@/lib/task-progress-queries";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { accessFrom, loadTaskForUser, taskRights } from "@/lib/rbac";
import { projectMemberIds, withWorkspace } from "@/lib/queries";
import { assignability, checkTaskDates, resolveTaskState } from "@/lib/task-rules";
import { updateTaskSchema } from "@/lib/validations";
import { audit, changedFields } from "@/lib/audit";
import { assignmentNotices, notify } from "@/lib/notifications";
import { joinProject, logJoin } from "@/lib/project-members";

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
  // Someone who manages the project without being in it can still take the task (and joins).
  const inProject = task.project.owner.id === me.id || task.project.members.some((m) => m.user.id === me.id && m.role !== "VIEWER");
  const self = access.contribute && !inProject ? { id: me.id, name: me.name, avatarColor: me.avatarColor, jobTitle: me.jobTitle } : null;
  return ok({ task: { ...enriched, subtasks }, permissions: { ...taskRights(me, access, task), self } });
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
    const { task, perms, access } = loaded;
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
    const assign = data.assigneeId ? assignability(memberIds!, data.assigneeId, me, access.contribute) : null;
    if (data.assigneeId && !assign) {
      return badRequest("Người phụ trách phải là thành viên dự án (không phải người chỉ xem)", { assigneeId: "Không phải thành viên dự án" });
    }

    checkTaskDates(data.startDate === undefined ? task.startDate : data.startDate, data.dueDate === undefined ? task.dueDate : data.dueDate);
    const state = resolveTaskState(task, { status: data.status, progress: data.progress });

    const updated = await prisma.$transaction(async (tx) => {
      // Taking the task yourself in a project you manage without being in it: you join it.
      if (assign === "join") await joinProject(tx, task.projectId, me.id);
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
    if (assign === "join") await logJoin(me, task.projectId);
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
    if (updated.assigneeId && updated.assigneeId !== task.assigneeId && updated.assigneeId !== me.id) {
      const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { name: true } });
      await notify(me, assignmentNotices([{ ...updated, projectName: project?.name ?? "" }]));
    }
    if (updated.status !== task.status) await syncProjectStatus({ id: me.id, name: me.name }, [task.projectId]);
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
  await syncProjectStatus({ id: me.id, name: me.name }, [loaded.task.projectId]);
  return ok(await withWorkspace(req, me, loaded.task.projectId, { ok: true }));
}
