import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { canCreateProject } from "@/lib/rbac";
import { listProjects } from "@/lib/queries";
import { resolveMemberRoles } from "@/lib/project-members";
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
    if (!canCreateProject(me)) {
      return forbidden("Bạn chưa được cấp quyền tạo dự án. Hãy nhờ quản lý cấp quyền “Tạo dự án”.");
    }

    const data = createProjectSchema.parse(await req.json());
    const roles = await resolveMemberRoles(me.id, data);

    const project = await prisma.project.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        status: data.status,
        color: data.color ?? "#6366f1",
        startDate: data.startDate,
        dueDate: data.dueDate,
        ownerId: me.id,
        members: { create: [...roles].map(([userId, role]) => ({ userId, role })) },
      },
    });
    return created({ project });
  });
}
