import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { projectAccess } from "@/lib/rbac";
import { listTasks, projectMemberIds, withWorkspace } from "@/lib/queries";
import { assignability, checkTaskDates, resolveTaskState } from "@/lib/task-rules";
import { createTaskSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { assignmentNotices, notify } from "@/lib/notifications";
import { joinSelf } from "@/lib/project-members";
import { syncProjectStatus } from "@/lib/project-sync";

export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const tasks = await listTasks(me, { scope: sp.get("scope"), status: sp.get("status"), projectId: sp.get("projectId"), q: sp.get("q"), cursor: sp.get("cursor"), deadline: sp.get("deadline"), issue: sp.get("issue") });
  return ok(tasks);
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const data = createTaskSchema.parse(await req.json());
    // The checks don't depend on each other, so they run together.
    const [access, parent, memberIds] = await Promise.all([
      projectAccess(me, data.projectId),
      data.parentId ? prisma.task.findUnique({ where: { id: data.parentId }, select: { projectId: true, categoryId: true } }) : null,
      data.assigneeId ? projectMemberIds(data.projectId) : null,
    ]);
    if (!access.view) return notFound("Không tìm thấy dự án");
    if (!access.contribute) return forbidden("Bạn chỉ có quyền xem dự án này");

    let categoryId = data.categoryId || null;
    if (data.parentId) {
      if (!parent || parent.projectId !== data.projectId) return badRequest("Task cha không hợp lệ");
      // Subtasks inherit the parent's category unless one is chosen explicitly.
      categoryId ??= parent.categoryId;
    }
    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { projectId: true } });
      if (!category || category.projectId !== data.projectId) return badRequest("Hạng mục không hợp lệ");
    }
    const assign = data.assigneeId ? assignability(memberIds!, data.assigneeId, me, access.contribute) : null;
    if (data.assigneeId && !assign) {
      return badRequest("Người phụ trách phải là thành viên dự án (không phải người chỉ xem)", { assigneeId: "Không phải thành viên dự án" });
    }

    checkTaskDates(data.startDate, data.dueDate);
    const state = resolveTaskState(
      { status: "TODO", progress: 0, completedAt: null },
      { status: data.status, progress: data.progress },
    );

    // Taking the work yourself in a project you manage without being in it: you join it.
    if (assign === "join") await joinSelf(me, data.projectId);
    const [task] = await Promise.all([
      prisma.task.create({
        data: {
          title: data.title.trim(),
          description: data.description?.trim() || null,
          projectId: data.projectId,
          categoryId,
          parentId: data.parentId || null,
          assigneeId: data.assigneeId || null,
          priority: data.priority,
          startDate: data.startDate ?? null,
          dueDate: data.dueDate ?? null,
          createdById: me.id,
          ...state,
        },
      }),
      // Touch the project so "recently updated" ordering reflects task activity.
      prisma.project.update({ where: { id: data.projectId }, data: { updatedAt: new Date() } }),
    ]);
    await audit(
      { id: me.id, name: me.name },
      {
        action: "task.create",
        entityType: "task",
        entityId: task.id,
        summary: `Tạo công việc “${task.title}”`,
        details: { projectId: task.projectId, parentId: task.parentId, assigneeId: task.assigneeId, status: task.status },
      },
    );
    if (task.assigneeId && task.assigneeId !== me.id) {
      const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { name: true } });
      await notify(me, assignmentNotices([{ ...task, projectName: project?.name ?? "" }]));
    }
    await syncProjectStatus({ id: me.id, name: me.name }, [task.projectId]);
    return created(await withWorkspace(req, me, data.projectId, { task }));
  });
}
