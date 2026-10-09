import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canManageProject } from "@/lib/rbac";
import { updateCategorySchema } from "@/lib/validations";

type Ctx = { params: { id: string } };

async function load(id: string) {
  return prisma.category.findUnique({ where: { id }, select: { id: true, projectId: true } });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const category = await load(params.id);
    if (!category) return notFound("Không tìm thấy hạng mục");
    if (!(await canManageProject(me, category.projectId))) return forbidden();

    const data = updateCategorySchema.parse(await req.json());
    const updated = await prisma.category.update({
      where: { id: params.id },
      data: { name: data.name?.trim(), color: data.color, order: data.order },
    });
    return ok({ category: updated });
  });
}

/** Deleting a category keeps its tasks; they become uncategorised (onDelete: SetNull). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const me = await auth();
  if (!me) return unauthorized();
  const category = await load(params.id);
  if (!category) return notFound("Không tìm thấy hạng mục");
  if (!(await canManageProject(me, category.projectId))) return forbidden();
  await prisma.category.delete({ where: { id: params.id } });
  return ok({ ok: true });
}
