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

/**
 * Access from data already loaded: the project's owner and the user's membership
 * role (null when not a member). Lets a handler that reads the project anyway
 * skip a separate access query.
 */
export function accessFrom(
  user: Pick<CurrentUser, "id" | "role" | "permissions">,
  ownerId: string,
  memberRole: ProjectRoleKey | null,
): ProjectAccess {
  const role: ProjectRoleKey | null = ownerId === user.id ? "MANAGER" : memberRole;
  const manage = role === "MANAGER" || canManageAllProjects(user);
  const contribute = manage || role === "MEMBER";
  const view = contribute || role === "VIEWER" || canViewAllProjects(user);
  return { view, contribute, manage, role };
}

/** Prisma `select` for the fields accessFrom needs. */
export const accessSelect = (userId: string) =>
  ({ ownerId: true, members: { where: { userId }, select: { role: true } } }) as const;

/** What a user may do in one project: their project role combined with org-wide permissions. */
export async function projectAccess(user: CurrentUser, projectId: string): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: accessSelect(user.id) });
  if (!project) return NO_ACCESS;
  return accessFrom(user, project.ownerId, project.members[0]?.role ?? null);
}

export async function canAccessProject(user: CurrentUser, projectId: string): Promise<boolean> {
  return (await projectAccess(user, projectId)).view;
}

export async function canManageProject(user: CurrentUser, projectId: string): Promise<boolean> {
  return (await projectAccess(user, projectId)).manage;
}

/**
 * Task-level rights:
 *  - manage: full edit/delete (project managers, and contributors on tasks they created)
 *  - report: submit progress reports and update status/progress (the assignee, or managers)
 */
export function taskRights(user: Pick<CurrentUser, "id">, access: ProjectAccess, task: { assigneeId: string | null; createdById: string }) {
  const manage = access.manage || (access.contribute && task.createdById === user.id);
  const report = manage || (access.contribute && task.assigneeId === user.id);
  return { manage, report, isProjectManager: access.manage };
}

/**
 * A task with the caller's project access and task rights, in one query.
 * Null when the task doesn't exist or the caller can't see its project.
 */
export async function loadTaskForUser(user: CurrentUser, taskId: string) {
  const row = await prisma.task.findUnique({ where: { id: taskId }, include: { project: { select: accessSelect(user.id) } } });
  if (!row) return null;
  const { project, ...task } = row;
  const access = accessFrom(user, project.ownerId, project.members[0]?.role ?? null);
  if (!access.view) return null;
  return { task, access, perms: taskRights(user, access, task) };
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
