import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject, projectVisibilityWhere } from "@/lib/rbac";
import { projectMemberIds } from "@/lib/queries";
import { resolveTaskState } from "@/lib/task-rules";
import { createTaskSchema } from "@/lib/validations";

const STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"] as const;

export async function GET(req: NextRequest) {
  const me = await auth();
  if (!me) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "mine";
  const status = sp.get("status");
  const projectId = sp.get("projectId");
  const q = sp.get("q")?.trim();

  const tasks = await prisma.task.findMany({
    where: {
      project: projectVisibilityWhere(me),
      ...(scope === "mine" ? { assigneeId: me.id } : {}),
      ...(status && (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : {}),
      ...(projectId ? { projectId } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    include: {
      project: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
      parent: { select: { id: true, title: true } },
      _count: { select: { subtasks: true, reports: true } },
    },
  });
  return ok({ tasks });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const data = createTaskSchema.parse(await req.json());
    if (!(await canAccessProject(me, data.projectId))) return notFound("Không tìm thấy dự án");

    let categoryId = data.categoryId || null;
    if (data.parentId) {
      const parent = await prisma.task.findUnique({
        where: { id: data.parentId },
        select: { projectId: true, categoryId: true },
      });
      if (!parent || parent.projectId !== data.projectId) return badRequest("Task cha không hợp lệ");
      // Subtasks inherit the parent's category unless one is chosen explicitly.
      categoryId ??= parent.categoryId;
    }
    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { projectId: true } });
      if (!category || category.projectId !== data.projectId) return badRequest("Hạng mục không hợp lệ");
    }
    if (data.assigneeId && !(await projectMemberIds(data.projectId)).has(data.assigneeId)) {
      return badRequest("Người phụ trách phải là thành viên dự án", { assigneeId: "Không phải thành viên dự án" });
    }

    const state = resolveTaskState(
      { status: "TODO", progress: 0, completedAt: null },
      { status: data.status, progress: data.progress },
    );

    const task = await prisma.task.create({
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
    });
    // Touch the project so "recently updated" ordering reflects task activity.
    await prisma.project.update({ where: { id: data.projectId }, data: { updatedAt: new Date() } });
    return created({ task });
  });
}
