import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, notFound, ok, unauthorized } from "@/lib/api";
import { canManageProject } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Authors can delete their own notes; project managers can delete any. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  const note = await prisma.note.findUnique({
    where: { id: params.id },
    include: { project: { select: { name: true } }, author: { select: { name: true } } },
  });
  if (!note) return notFound();
  if (note.authorId !== me.id && !(await canManageProject(me, note.projectId))) return forbidden();
  await prisma.note.delete({ where: { id: params.id } });
  await audit(
    { id: me.id, name: me.name },
    {
      action: "note.delete",
      entityType: "note",
      entityId: note.id,
      summary: `Xoá ghi chú của ${note.author.name} trong dự án “${note.project.name}”`,
      details: { projectId: note.projectId, type: note.type, author: note.author.name, content: note.content.slice(0, 300) },
    },
  );
  return ok({ ok: true });
}
