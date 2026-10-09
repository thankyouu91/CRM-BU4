import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canManageAllProjects, canManageProject, projectAccess } from "@/lib/rbac";
import { resolveMemberRoles } from "@/lib/project-members";
import { getProjectDetail, workspaceFor } from "@/lib/queries";
import { updateProjectSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  // Session and project load together; access is derived from the loaded members.
  const [me, project] = await Promise.all([auth(), getProjectDetail(params.id)]);
  if (!me) return unauthorized();
  const workspace = workspaceFor(me, project);
  if (!workspace) return notFound("Không tìm thấy dự án");
  return ok(workspace);
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

      if (data.members || data.memberIds) {
        const current = await tx.projectMember.findMany({ where: { projectId: params.id }, select: { userId: true, role: true } });
        const roles = await resolveMemberRoles(existing.ownerId, data, new Map(current.map((m) => [m.userId, m.role])));
        await tx.projectMember.deleteMany({ where: { projectId: params.id, userId: { notIn: [...roles.keys()] } } });
        for (const [userId, role] of roles) {
          await tx.projectMember.upsert({
            where: { projectId_userId: { projectId: params.id, userId } },
            create: { projectId: params.id, userId, role },
            update: { role },
          });
        }
      }
    });

    return ok({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { ownerId: true } });
  if (!project || !(await projectAccess(me, params.id)).view) return notFound("Không tìm thấy dự án");
  if (project.ownerId !== me.id && !canManageAllProjects(me)) {
    return forbidden("Chỉ chủ dự án hoặc người có quyền quản lý mọi dự án mới được xoá dự án");
  }
  await prisma.project.delete({ where: { id: params.id } });
  return ok({ ok: true });
}
