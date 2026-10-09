import { prisma } from "./prisma";
import { hasPermission, type ProjectRoleKey } from "./permissions";
import type { CurrentUser } from "./session";

export function isAdmin(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "ADMIN";
}

export function canCreateProject(user: Pick<CurrentUser, "role" | "permissions">): boolean {
  return hasPermission(user, "PROJECT_CREATE");
}

export function canManageAllProjects(user: Pick<CurrentUser, "role" | "permissions">): boolean {
  return hasPermission(user, "PROJECT_MANAGE_ALL");
}

export function canViewAllProjects(user: Pick<CurrentUser, "role" | "permissions">): boolean {
  return hasPermission(user, "PROJECT_VIEW_ALL") || canManageAllProjects(user);
}

export interface ProjectAccess {
  /** Open the project, read everything, post notes/feedback. */
  view: boolean;
  /** Create tasks, be assigned work, report on own tasks. */
  contribute: boolean;
  /** Edit the project, categories, members and any task; review reports. */
  manage: boolean;
  /** The user's role inside the project (the owner counts as MANAGER), or null. */
  role: ProjectRoleKey | null;
}

const NO_ACCESS: ProjectAccess = { view: false, contribute: false, manage: false, role: null };

/** What a user may do in one project: their project role combined with org-wide permissions. */
export async function projectAccess(user: CurrentUser, projectId: string): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { userId: user.id }, select: { role: true } } },
  });
  if (!project) return NO_ACCESS;
  const role: ProjectRoleKey | null = project.ownerId === user.id ? "MANAGER" : (project.members[0]?.role ?? null);
  const manage = role === "MANAGER" || canManageAllProjects(user);
  const contribute = manage || role === "MEMBER";
  const view = contribute || role === "VIEWER" || canViewAllProjects(user);
  return { view, contribute, manage, role };
}

export async function canAccessProject(user: CurrentUser, projectId: string): Promise<boolean> {
  return (await projectAccess(user, projectId)).view;
}

export async function canManageProject(user: CurrentUser, projectId: string): Promise<boolean> {
  return (await projectAccess(user, projectId)).manage;
}

/**
 * Task-level permissions:
 *  - manage: full edit/delete (project managers, and contributors on tasks they created)
 *  - report: submit progress reports and update status/progress (the assignee, or managers)
 */
export async function taskPermissions(
  user: CurrentUser,
  task: { projectId: string; assigneeId: string | null; createdById: string },
) {
  const access = await projectAccess(user, task.projectId);
  const manage = access.manage || (access.contribute && task.createdById === user.id);
  const report = manage || (access.contribute && task.assigneeId === user.id);
  return { manage, report, isProjectManager: access.manage };
}

/** Prisma `where` for the projects a user can see. */
export function projectVisibilityWhere(user: CurrentUser) {
  if (canViewAllProjects(user)) return {};
  return {
    OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
  };
}

/** Prisma `where` for the projects a user manages (whose reports they review). */
export function managedProjectsWhere(user: CurrentUser) {
  if (canManageAllProjects(user)) return {};
  return {
    OR: [{ ownerId: user.id }, { members: { some: { userId: user.id, role: "MANAGER" as const } } }],
  };
}

/** Whether the user manages at least one project (shows the manager views). */
export async function managesAnyProject(user: CurrentUser): Promise<boolean> {
  if (canManageAllProjects(user)) return true;
  return (await prisma.project.count({ where: managedProjectsWhere(user), take: 1 })) > 0;
}
