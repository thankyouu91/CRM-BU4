import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { isManagerOrAbove } from "@/lib/rbac";
import { listProjects } from "@/lib/queries";
import { createProjectSchema } from "@/lib/validations";

export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();
  return ok({ projects: await listProjects(me) });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!isManagerOrAbove(me)) return forbidden("Chỉ quản lý mới được tạo dự án");

    const data = createProjectSchema.parse(await req.json());
    const memberIds = Array.from(new Set([me.id, ...(data.memberIds ?? [])]));

    const project = await prisma.project.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        status: data.status,
        color: data.color ?? "#6366f1",
        startDate: data.startDate,
        dueDate: data.dueDate,
        ownerId: me.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });
    return created({ project });
  });
}
