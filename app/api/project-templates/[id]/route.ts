import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, notFound, ok, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** The person who saved a template, or an administrator, may delete it. Projects made from it stay. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const template = await prisma.projectTemplate.findUnique({ where: { id: params.id }, select: { name: true, createdById: true } });
  if (!template) return notFound("Không tìm thấy mẫu dự án");
  if (template.createdById !== me.id && !isAdmin(me)) return forbidden("Chỉ người tạo mẫu hoặc quản trị viên mới xoá được mẫu này");

  await prisma.projectTemplate.delete({ where: { id: params.id } });
  await audit(
    { id: me.id, name: me.name },
    {
      action: "project_template.delete",
      entityType: "project_template",
      entityId: params.id,
      summary: `Xoá mẫu dự án “${template.name}”`,
      details: { name: template.name },
    },
  );
  return ok({ ok: true });
}
