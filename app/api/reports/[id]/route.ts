import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { accessFrom, accessSelect } from "@/lib/rbac";
import { withWorkspace } from "@/lib/queries";
import { resolveTaskState } from "@/lib/task-rules";
import { reviewReportSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

/** Manager reviews a report: acknowledge with an optional note, optionally approve the task. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();

    const report = await prisma.taskReport.findUnique({
      where: { id: params.id },
      include: { task: { include: { project: { select: accessSelect(me.id) } } } },
    });
    if (!report) return notFound("Không tìm thấy báo cáo");
    const { project } = report.task;
    if (!accessFrom(me, project.ownerId, project.members[0]?.role ?? null).manage) {
      return forbidden("Chỉ quản lý dự án mới được duyệt báo cáo");
    }

    const data = reviewReportSchema.parse(await req.json());

    await prisma.$transaction(async (tx) => {
      await tx.taskReport.update({
        where: { id: report.id },
        data: { reviewerId: me.id, reviewedAt: new Date(), reviewNote: data.reviewNote?.trim() || null },
      });
      if (data.approveTask) {
        await tx.task.update({
          where: { id: report.taskId },
          data: resolveTaskState(report.task, { status: "DONE" }),
        });
      }
    });
    return ok(await withWorkspace(req, me, report.task.projectId, { ok: true }));
  });
}
