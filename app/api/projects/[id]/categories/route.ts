import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, unauthorized } from "@/lib/api";
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
    const max = await prisma.category.aggregate({ where: { projectId: params.id }, _max: { order: true } });
    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        color: data.color ?? "#64748b",
        order: data.order ?? (max._max.order ?? -1) + 1,
        projectId: params.id,
      },
    });
    return created({ category });
  });
}
