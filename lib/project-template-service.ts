// Project templates: database side (server only). The JSON shape, snapshot and date
// math are in lib/project-templates.ts.

import { prisma } from "./prisma";
import { isAdmin } from "./rbac";
import type { CurrentUser } from "./session";
import { newProjectData } from "./project-create";
import { instantiateTemplate, parseTemplateData, snapshotProject, templateCounts } from "./project-templates";

/**
 * A new row id in the same shape as Prisma's cuid() (time + randomness), made here so
 * the categories and tasks of a new project, parents and children alike, go in one
 * insert each instead of one round trip per row.
 */
export function newId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  return `c${Date.now().toString(36)}${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => chars[b % 36]).join("")}`;
}

/** A project as template data, or null when the project does not exist. Throws InputError past the limits. */
export async function snapshotFromProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      color: true,
      startDate: true,
      createdAt: true,
      // Same order as the workspace, so the new project lists items the same way.
      categories: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true, name: true, color: true, parentId: true, order: true, startDate: true, dueDate: true },
      },
      tasks: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, title: true, description: true, priority: true, categoryId: true, parentId: true, startDate: true, dueDate: true },
      },
    },
  });
  return project && { name: project.name, data: snapshotProject(project) };
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  categories: number;
  tasks: number;
  createdBy: { id: string; name: string } | null;
  updatedAt: Date;
  /** The creator and administrators may delete a template. */
  canDelete: boolean;
}

/** Every template, newest first, with item counts read in SQL (the JSON itself is not loaded). */
export async function listTemplates(me: Pick<CurrentUser, "id" | "role">): Promise<TemplateListItem[]> {
  const rows = await prisma.$queryRaw<
    { id: string; name: string; description: string | null; createdById: string | null; createdByName: string | null; updatedAt: Date; categories: number; tasks: number }[]
  >`
    SELECT t."id", t."name", t."description", t."createdById", u."name" AS "createdByName", t."updatedAt",
      CASE WHEN jsonb_typeof(t."data"->'categories') = 'array' THEN jsonb_array_length(t."data"->'categories') ELSE 0 END AS "categories",
      CASE WHEN jsonb_typeof(t."data"->'tasks') = 'array' THEN jsonb_array_length(t."data"->'tasks') ELSE 0 END AS "tasks"
    FROM "ProjectTemplate" t
    LEFT JOIN "User" u ON u."id" = t."createdById"
    ORDER BY t."updatedAt" DESC, t."id" ASC`;
  return rows.map(({ createdById, createdByName, ...t }) => ({
    ...t,
    categories: Number(t.categories),
    tasks: Number(t.tasks),
    updatedAt: new Date(t.updatedAt),
    createdBy: createdById ? { id: createdById, name: createdByName ?? "" } : null,
    canDelete: (!!createdById && createdById === me.id) || isAdmin(me),
  }));
}

/**
 * A new project from a template, owned by `owner` (a project manager, like any project
 * they create), with every category and task in one transaction. Dates move so the
 * template's anchor day becomes `input.startDate`; tasks start as TODO, 0%, unassigned.
 */
export async function createProjectFromTemplate(
  owner: Pick<CurrentUser, "id">,
  template: { data: unknown },
  input: { name: string; description?: string | null; startDate: string },
) {
  const data = parseTemplateData(template.data);
  const projectId = newId();
  const plan = instantiateTemplate(data, { startDay: input.startDate, projectId, createdById: owner.id, newId });
  const { data: row, roles } = await newProjectData(owner.id, {
    name: input.name,
    description: input.description,
    status: "PLANNING",
    color: plan.color,
    startDate: plan.startDate,
    dueDate: plan.dueDate,
  });
  // Category and task ids are known up front, so this is three inserts whatever the size.
  const [project] = await prisma.$transaction([
    prisma.project.create({ data: { ...row, id: projectId } }),
    prisma.category.createMany({ data: plan.categories }),
    prisma.task.createMany({ data: plan.tasks }),
  ]);
  return { project, members: roles.size, ...templateCounts(data) };
}
