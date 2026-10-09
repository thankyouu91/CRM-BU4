import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, forbidden, handle, unauthorized } from "@/lib/api";
import { checkCategory } from "@/lib/category-rules";
import { canManageProject } from "@/lib/rbac";
import { createCategorySchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!(await canManageProject(me, params.id))) return forbidden();

    const data = createCategorySchema.parse(await req.json());
    const parentId = data.parentId || null;
    const startDate = data.startDate ?? null;
    const dueDate = data.dueDate ?? null;
    const invalid = await checkCategory({ projectId: params.id, parentId, startDate, dueDate });
    if (invalid) return badRequest(invalid.message, { [invalid.field]: invalid.message });

    const max = await prisma.category.aggregate({ where: { projectId: params.id, parentId }, _max: { order: true } });
    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        color: data.color ?? "#64748b",
        order: data.order ?? (max._max.order ?? -1) + 1,
        projectId: params.id,
        parentId,
        startDate,
        dueDate,
      },
    });
    return created({ category });
  });
}
