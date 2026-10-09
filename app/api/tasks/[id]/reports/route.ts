import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, notFound, unauthorized } from "@/lib/api";
import { loadTaskForUser } from "@/lib/rbac";
import { withWorkspace } from "@/lib/queries";
import { resolveTaskState } from "@/lib/task-rules";
import { createReportSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The person in charge submits a progress report. The task's progress follows
 * the report; reaching 100% moves the task to REVIEW so the project manager
 * can approve it from their inbox.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const loaded = await loadTaskForUser(me, params.id);
    if (!loaded) return notFound("Không tìm thấy công việc");
    const { task } = loaded;
    if (!loaded.perms.report) {
      return forbidden("Chỉ người phụ trách hoặc quản lý mới được gửi báo cáo cho công việc này");
    }

    const data = createReportSchema.parse(await req.json());

    const nextStatus =
      data.progress >= 100 && task.status !== "DONE" ? "REVIEW" : undefined;
    const state = resolveTaskState(task, { progress: data.progress, status: nextStatus });

    const [report] = await prisma.$transaction([
      prisma.taskReport.create({
        data: {
          taskId: task.id,
          authorId: me.id,
          content: data.content.trim(),
          progress: data.progress,
          hoursSpent: data.hoursSpent,
        },
        include: { author: { select: { id: true, name: true, avatarColor: true, jobTitle: true } } },
      }),
      prisma.task.update({ where: { id: task.id }, data: state }),
      prisma.project.update({ where: { id: task.projectId }, data: { updatedAt: new Date() } }),
    ]);
    await audit(
      { id: me.id, name: me.name },
      {
        action: "task_report.create",
        entityType: "task_report",
        entityId: report.id,
        summary: `Gửi báo cáo công việc “${task.title}” (${report.progress}%)`,
        details: { taskId: task.id, progress: report.progress, hoursSpent: report.hoursSpent },
      },
    );
    return created(await withWorkspace(req, me, task.projectId, { report }));
  });
}
