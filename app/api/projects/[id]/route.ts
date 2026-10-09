import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canManageAllProjects, canManageProject, projectAccess } from "@/lib/rbac";
import { resolveMemberRoles } from "@/lib/project-members";
import { getProjectDetail, workspaceFor } from "@/lib/queries";
import { updateProjectSchema } from "@/lib/validations";
import { PROJECT_ROLE_INFO } from "@/lib/permissions";
import { audit, changedFields } from "@/lib/audit";

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
    const existing = await prisma.project.findUnique({
      where: { id: params.id },
      select: { ownerId: true, name: true, description: true, status: true, color: true, startDate: true, dueDate: true },
    });
    if (!existing) return notFound("Không tìm thấy dự án");

    const { updated, memberDiff } = await prisma.$transaction(async (tx) => {
      const row = await tx.project.update({
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

      let memberDiff: { before: Map<string, string>; after: Map<string, string> } | null = null;
      if (data.members || data.memberIds) {
        const current = await tx.projectMember.findMany({ where: { projectId: params.id }, select: { userId: true, role: true } });
        const roles = await resolveMemberRoles(existing.ownerId, data, new Map(current.map((m) => [m.userId, m.role])));
        memberDiff = { before: new Map(current.map((m) => [m.userId, m.role])), after: roles };
        await tx.projectMember.deleteMany({ where: { projectId: params.id, userId: { notIn: [...roles.keys()] } } });
        for (const [userId, role] of roles) {
          await tx.projectMember.upsert({
            where: { projectId_userId: { projectId: params.id, userId } },
            create: { projectId: params.id, userId, role },
            update: { role },
          });
        }
      }
      return { updated: row, memberDiff };
    });

    const actor = { id: me.id, name: me.name };
    const changes = changedFields(existing, updated, ["name", "description", "status", "color", "startDate", "dueDate"]);
    if (Object.keys(changes).length) {
      await audit(actor, {
        action: "project.update",
        entityType: "project",
        entityId: params.id,
        summary: `Sửa dự án “${updated.name}”`,
        details: changes as Prisma.InputJsonValue,
      });
    }
    if (memberDiff) {
      const { before, after } = memberDiff;
      const added = [...after.keys()].filter((id) => !before.has(id));
      const removed = [...before.keys()].filter((id) => !after.has(id));
      const roleChanged = [...after.keys()].filter((id) => before.has(id) && before.get(id) !== after.get(id));
      if (added.length || removed.length || roleChanged.length) {
        const people = await prisma.user.findMany({
          where: { id: { in: [...added, ...removed, ...roleChanged] } },
          select: { id: true, name: true },
        });
        const name = (id: string) => people.find((u) => u.id === id)?.name ?? id;
        const roleLabel = (r?: string) => PROJECT_ROLE_INFO[r as keyof typeof PROJECT_ROLE_INFO]?.label ?? r ?? null;
        await audit(actor, {
          action: "project.members_change",
          entityType: "project",
          entityId: params.id,
          summary: `Đổi thành viên dự án “${updated.name}”`,
          details: {
            added: added.map((id) => ({ name: name(id), role: roleLabel(after.get(id)) })),
            removed: removed.map((id) => ({ name: name(id), role: roleLabel(before.get(id)) })),
            roleChanged: roleChanged.map((id) => ({ name: name(id), from: roleLabel(before.get(id)), to: roleLabel(after.get(id)) })),
          },
        });
      }
    }

    return ok({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { ownerId: true, name: true, status: true },
  });
  if (!project || !(await projectAccess(me, params.id)).view) return notFound("Không tìm thấy dự án");
  if (project.ownerId !== me.id && !canManageAllProjects(me)) {
    return forbidden("Chỉ chủ dự án hoặc người có quyền quản lý mọi dự án mới được xoá dự án");
  }
  await prisma.project.delete({ where: { id: params.id } });
  await audit(
    { id: me.id, name: me.name },
    {
      action: "project.delete",
      entityType: "project",
      entityId: params.id,
      summary: `Xoá dự án “${project.name}”`,
      details: { name: project.name, status: project.status },
    },
  );
  return ok({ ok: true });
}
