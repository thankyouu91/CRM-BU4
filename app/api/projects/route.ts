import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, ok, unauthorized } from "@/lib/api";
import { canCreateProject } from "@/lib/rbac";
import { listProjects } from "@/lib/queries";
import { newProjectData } from "@/lib/project-create";
import { createProjectSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

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

    const { data, roles } = await newProjectData(me.id, createProjectSchema.parse(await req.json()));
    const project = await prisma.project.create({ data });
    await audit(
      { id: me.id, name: me.name },
      {
        action: "project.create",
        entityType: "project",
        entityId: project.id,
        summary: `Tạo dự án “${project.name}”`,
        details: { status: project.status, members: roles.size },
      },
    );
    await notify(me, [...roles.keys()].map((userId) => ({
      userId, type: "project.member_added" as const, title: `Bạn được thêm vào dự án “${project.name}”`, body: null, link: `/projects/${project.id}`,
    })));
    return created({ project });
  });
}
