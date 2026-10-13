import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, notFound, unauthorized } from "@/lib/api";
import { canCreateProject } from "@/lib/rbac";
import { createProjectFromTemplate } from "@/lib/project-template-service";
import { projectFromTemplateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

/** Create a project from a template: the same project as POST /api/projects, plus its categories and tasks. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!canCreateProject(me)) {
      return forbidden("Bạn chưa được cấp quyền tạo dự án. Hãy nhờ quản lý cấp quyền “Tạo dự án”.");
    }

    const input = projectFromTemplateSchema.parse(await req.json());
    const template = await prisma.projectTemplate.findUnique({ where: { id: input.templateId }, select: { id: true, name: true, data: true } });
    if (!template) return notFound("Không tìm thấy mẫu dự án");

    const { project, categories, tasks } = await createProjectFromTemplate(me, template, input);
    await audit(
      { id: me.id, name: me.name },
      {
        action: "project.create",
        entityType: "project",
        entityId: project.id,
        summary: `Tạo dự án “${project.name}” từ mẫu “${template.name}”`,
        details: { templateId: template.id, categories, tasks },
      },
    );
    return created({ project });
  });
}
