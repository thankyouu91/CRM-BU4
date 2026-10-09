import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { checkCategory } from "@/lib/category-rules";
import { canManageProject } from "@/lib/rbac";
import { updateCategorySchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  return prisma.category.findUnique({
    where: { id },
    select: { id: true, projectId: true, parentId: true, startDate: true, dueDate: true },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const category = await load(params.id);
    if (!category) return notFound("Không tìm thấy hạng mục");
    if (!(await canManageProject(me, category.projectId))) return forbidden();

    const data = updateCategorySchema.parse(await req.json());
    // undefined keeps the stored value; null clears it.
    const next = {
      parentId: data.parentId === undefined ? category.parentId : data.parentId || null,
      startDate: data.startDate === undefined ? category.startDate : data.startDate,
      dueDate: data.dueDate === undefined ? category.dueDate : data.dueDate,
    };
    const invalid = await checkCategory({ projectId: category.projectId, id: category.id, ...next });
    if (invalid) return badRequest(invalid.message, { [invalid.field]: invalid.message });

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: { name: data.name?.trim(), color: data.color, order: data.order, ...next },
    });
    return ok({ category: updated });
  });
}

/**
 * Deleting a category keeps its tasks; they become uncategorised (onDelete: SetNull).
 * Its sub-categories are deleted with it, and their tasks are kept the same way.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const category = await load(params.id);
  if (!category) return notFound("Không tìm thấy hạng mục");
  if (!(await canManageProject(me, category.projectId))) return forbidden();
  await prisma.category.delete({ where: { id: params.id } });
  return ok({ ok: true });
}
