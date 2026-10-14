import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { auditMany, changedFields } from "@/lib/audit";
import { assignmentNotices, notify } from "@/lib/notifications";
import { planBulk } from "@/lib/task-bulk";
import { joinProject } from "@/lib/project-members";
import { updateTaskSafely } from "@/lib/task-service";
import { bulkTaskSchema } from "@/lib/validations";

const FIELDS = ["status", "progress", "priority", "assigneeId", "startDate", "dueDate", "completedAt"] as const;

/**
 * POST /api/tasks/bulk { ids, patch: { assigneeId?, dueDate?, startDate?, status?, priority? } }
 * Applies one change to many tasks in one transaction, with the per-task rights of
 * PATCH /api/tasks/[id]. Answers how many changed and which were skipped, and why.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const { ids, patch } = bulkTaskSchema.parse(await req.json());

    const [rows, assignee] = await Promise.all([
      prisma.task.findMany({
        where: { id: { in: ids } },
        include: { project: { select: { name: true, ownerId: true, members: { select: { userId: true, role: true } } } } },
      }),
      patch.assigneeId ? prisma.user.findUnique({ where: { id: patch.assigneeId }, select: { name: true, active: true } }) : null,
    ]);
    if (patch.assigneeId && !assignee?.active) return ok({ updated: 0, unchanged: 0, skipped: ids.map((id) => ({ id, title: null, reason: "Không tìm thấy người phụ trách" })) });

    const plan = planBulk(me, ids, rows, patch, assignee?.name);
    const updated = plan.apply.length
      ? await prisma.$transaction(
          async (tx) => {
            // Taking tasks yourself in projects you manage without being in them: you join them.
            for (const projectId of plan.join) await joinProject(tx, projectId, me.id);
            const out = [];
            for (const { task, data } of plan.apply) out.push({ before: task, after: await updateTaskSafely(tx, task, data) });
            await tx.project.updateMany({ where: { id: { in: [...new Set(plan.apply.map((a) => a.task.projectId))] } }, data: { updatedAt: new Date() } });
            return out;
          },
          { timeout: 30_000 },
        )
      : [];

    await auditMany(
      { id: me.id, name: me.name },
      plan.join.map((projectId) => ({
        action: "project.members_change" as const,
        entityType: "project",
        entityId: projectId,
        summary: `Tham gia dự án “${rows.find((r) => r.projectId === projectId)?.project.name ?? ""}” để nhận việc`,
        details: { added: [{ name: me.name, role: "Thành viên" }], reason: "self-assign" } as Prisma.InputJsonValue,
      })),
    );
    await auditMany(
      { id: me.id, name: me.name },
      updated.map(({ before, after }) => ({
        action: "task.update" as const,
        entityType: "task",
        entityId: after.id,
        summary: `Sửa công việc “${after.title}” (sửa hàng loạt)`,
        details: { ...changedFields(before, after, FIELDS), bulk: updated.length } as Prisma.InputJsonValue,
      })),
    );
    const given = updated.filter(({ before, after }) => after.assigneeId && after.assigneeId !== before.assigneeId);
    await notify(me, assignmentNotices(given.map(({ before, after }) => ({ ...after, projectName: before.project.name }))));

    return ok({ updated: updated.length, unchanged: plan.unchanged, skipped: plan.skipped }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
