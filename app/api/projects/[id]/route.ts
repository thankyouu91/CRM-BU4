import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject, canManageProject } from "@/lib/rbac";
import { getProjectDetail } from "@/lib/queries";
import { updateProjectSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!(await canAccessProject(me, params.id))) return notFound("Không tìm thấy dự án");

  const project = await getProjectDetail(params.id);
  if (!project) return notFound("Không tìm thấy dự án");
  return ok({ project, canManage: await canManageProject(me, params.id) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!(await canManageProject(me, params.id))) return forbidden();

    const data = updateProjectSchema.parse(await req.json());
    const existing = await prisma.project.findUnique({ where: { id: params.id }, select: { ownerId: true } });
    if (!existing) return notFound("Không tìm thấy dự án");

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: params.id },
        data: {
          name: data.name?.trim(),
          description: data.description === undefined ? undefined : data.description?.trim() || null,
          status: data.status,
          color: data.color,
          startDate: data.startDate,
          dueDate: data.dueDate,
        },
      });

      if (data.memberIds) {
        // Owner is always a member.
        const ids = Array.from(new Set([existing.ownerId, ...data.memberIds]));
        await tx.projectMember.deleteMany({ where: { projectId: params.id, userId: { notIn: ids } } });
        await tx.projectMember.createMany({
          data: ids.map((userId) => ({ projectId: params.id, userId })),
          skipDuplicates: true,
        });
      }
    });

    return ok({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!(await canManageProject(me, params.id))) return forbidden();
  await prisma.project.delete({ where: { id: params.id } });
  return ok({ ok: true });
}
