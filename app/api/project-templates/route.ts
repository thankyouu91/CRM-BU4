import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, created, forbidden, handle, notFound, ok, unauthorized } from "@/lib/api";
import { canCreateProject, projectAccess } from "@/lib/rbac";
import { listTemplates, snapshotFromProject } from "@/lib/project-template-service";
import { templateCounts } from "@/lib/project-templates";
import { createTemplateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

const NO_CREATE = "Bạn chưa được cấp quyền tạo dự án nên chưa dùng được mẫu dự án.";

/** Templates for “Tạo từ mẫu”: only people who can create projects use them. */
export async function GET() {
  const me = await auth();
  if (!me) return unauthorized();
  if (!canCreateProject(me)) return forbidden(NO_CREATE);
  return ok({ templates: await listTemplates(me) });
}

/** Save a project's structure as a template (needs to manage that project and to create projects). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!canCreateProject(me)) return forbidden(NO_CREATE);

    const input = createTemplateSchema.parse(await req.json());
    const access = await projectAccess(me, input.projectId);
    if (!access.view) return notFound("Không tìm thấy dự án");
    if (!access.manage) return forbidden("Chỉ quản lý dự án mới lưu được dự án làm mẫu");
    const source = await snapshotFromProject(input.projectId);
    if (!source) return notFound("Không tìm thấy dự án");

    const template = await prisma.projectTemplate.create({
      data: { name: input.name, description: input.description || null, data: source.data, createdById: me.id },
      select: { id: true, name: true, description: true, updatedAt: true },
    });
    const counts = templateCounts(source.data);
    await audit(
      { id: me.id, name: me.name },
      {
        action: "project_template.create",
        entityType: "project_template",
        entityId: template.id,
        summary: `Lưu dự án “${source.name}” làm mẫu “${template.name}”`,
        details: { projectId: input.projectId, ...counts },
      },
    );
    return created({ template: { ...template, ...counts, createdBy: { id: me.id, name: me.name }, canDelete: true } });
  });
}
