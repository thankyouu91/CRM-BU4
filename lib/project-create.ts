import type { Prisma } from "@prisma/client";
import { resolveMemberRoles } from "./project-members";
import type { CreateProjectInput } from "./validations";

/**
 * The row for a new project owned by `ownerId`, with its member list (the owner is
 * always a project manager). Shared by POST /api/projects and projects made from a
 * template, so both create the same way.
 */
export async function newProjectData(
  ownerId: string,
  input: Pick<CreateProjectInput, "name" | "description" | "status" | "color" | "startDate" | "dueDate" | "members" | "memberIds">,
) {
  const roles = await resolveMemberRoles(ownerId, input);
  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    color: input.color ?? "#6366f1",
    startDate: input.startDate,
    dueDate: input.dueDate,
    ownerId,
    members: { create: [...roles].map(([userId, role]) => ({ userId, role })) },
  } satisfies Prisma.ProjectUncheckedCreateInput;
  return { data, roles };
}
