import { prisma } from "./prisma";
import type { CurrentUser } from "./session";

export function isAdmin(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "ADMIN";
}

export function isManagerOrAbove(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

/**
 * Whether a user can access a project: admins always; otherwise owner or member.
 */
export async function canAccessProject(user: CurrentUser, projectId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    select: { id: true },
  });
  return !!project;
}

/** Whether a user can modify project structure (edit project, add categories/members). */
export async function canManageProject(user: CurrentUser, projectId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project) return false;
  return project.ownerId === user.id && isManagerOrAbove(user);
}

/**
 * Task-level permissions:
 *  - manage: full edit/delete (project managers and the task's creator)
 *  - report: submit progress reports and update status/progress (assignee or manager)
 */
export async function taskPermissions(
  user: CurrentUser,
  task: { projectId: string; assigneeId: string | null; createdById: string },
) {
  const isProjectManager = await canManageProject(user, task.projectId);
  const manage = isProjectManager || task.createdById === user.id;
  const report = manage || task.assigneeId === user.id;
  return { manage, report, isProjectManager };
}

/** Visibility filter for Prisma `where` on projects, by role. */
export function projectVisibilityWhere(user: CurrentUser) {
  if (isAdmin(user)) return {};
  return {
    OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
  };
}
