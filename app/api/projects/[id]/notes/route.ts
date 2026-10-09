import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canAccessProject } from "@/lib/rbac";
import { createNoteSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!(await canAccessProject(me, params.id))) return notFound("Không tìm thấy dự án");

  const type = req.nextUrl.searchParams.get("type");
  const notes = await prisma.note.findMany({
    where: { projectId: params.id, ...(type === "NOTE" || type === "FEEDBACK" ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, avatarColor: true, role: true } } },
  });
  return ok({ notes });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!(await canAccessProject(me, params.id))) return notFound("Không tìm thấy dự án");

    const data = createNoteSchema.parse(await req.json());
    const note = await prisma.note.create({
      data: { projectId: params.id, authorId: me.id, type: data.type, content: data.content.trim() },
      include: { author: { select: { id: true, name: true, avatarColor: true, role: true } } },
    });
    return created({ note });
  });
}
