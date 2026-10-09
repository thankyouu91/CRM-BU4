import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject, taskPermissions } from "@/lib/rbac";
import { projectMemberIds } from "@/lib/queries";
import { resolveTaskState } from "@/lib/task-rules";
import { updateTaskSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

const userBrief = { select: { id: true, name: true, avatarColor: true, jobTitle: true } } as const;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      // Members + categories let the drawer offer PIC/category pickers without extra requests.
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          owner: userBrief,
          members: { select: { role: true, user: userBrief } },
          categories: { select: { id: true, name: true, color: true }, orderBy: { order: "asc" } },
        },
      },
      category: { select: { id: true, name: true, color: true } },
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
  if (!task || !(await canAccessProject(me, task.projectId))) return notFound("Không tìm thấy công việc");

  const perms = await taskPermissions(me, task);
  return ok({ task, permissions: perms });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task || !(await canAccessProject(me, task.projectId))) return notFound("Không tìm thấy công việc");

    const perms = await taskPermissions(me, task);
    if (!perms.report) return forbidden();

    const data = updateTaskSchema.parse(await req.json());

    // Assignees (without manage rights) may only move status/progress and add notes.
    if (!perms.manage) {
      const restricted = ["title", "categoryId", "assigneeId", "priority", "startDate", "dueDate"] as const;
      if (restricted.some((k) => data[k] !== undefined)) {
        return forbidden("Người thực hiện chỉ được cập nhật trạng thái, tiến độ và mô tả");
      }
    }

    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { projectId: true } });
      if (!category || category.projectId !== task.projectId) return badRequest("Hạng mục không hợp lệ");
    }
    if (data.assigneeId && !(await projectMemberIds(task.projectId)).has(data.assigneeId)) {
      return badRequest("Người phụ trách phải là thành viên dự án (không phải người chỉ xem)", { assigneeId: "Không phải thành viên dự án" });
    }

    const state = resolveTaskState(task, { status: data.status, progress: data.progress });

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        title: data.title?.trim(),
        description: data.description === undefined ? undefined : data.description?.trim() || null,
        categoryId: data.categoryId === undefined ? undefined : data.categoryId || null,
        assigneeId: data.assigneeId === undefined ? undefined : data.assigneeId || null,
        priority: data.priority,
        startDate: data.startDate,
        dueDate: data.dueDate,
        ...state,
      },
    });
    await prisma.project.update({ where: { id: task.projectId }, data: { updatedAt: new Date() } });
    return ok({ task: updated });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || !(await canAccessProject(me, task.projectId))) return notFound("Không tìm thấy công việc");
  if (!(await taskPermissions(me, task)).manage) return forbidden();

  // Subtasks and reports cascade with the task.
  await prisma.task.delete({ where: { id: task.id } });
  return ok({ ok: true });
}
