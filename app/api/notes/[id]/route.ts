import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, notFound, ok, unauthorized } from "@/lib/api";
import { canManageProject } from "@/lib/rbac";

type Ctx = { params: { id: string } };

/** Authors can delete their own notes; project managers can delete any. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const me = await auth();
  if (!me) return unauthorized();
  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note) return notFound();
  if (note.authorId !== me.id && !(await canManageProject(me, note.projectId))) return forbidden();
  await prisma.note.delete({ where: { id: params.id } });
  return ok({ ok: true });
}
