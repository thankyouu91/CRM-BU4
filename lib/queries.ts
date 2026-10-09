import { prisma } from "./prisma";
import { accessFrom, canManageAllProjects, managedProjectsWhere, projectVisibilityWhere } from "./rbac";
import { categorySchedules, effectiveProgress, indexChildren, projectSchedule } from "./stats";
import type { CurrentUser } from "./session";

const userBrief = { select: { id: true, name: true, avatarColor: true, jobTitle: true } } as const;

/** Project list with computed progress, for the projects grid and pickers. */
export async function listProjects(user: CurrentUser) {
  const projects = await prisma.project.findMany({
    where: projectVisibilityWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: userBrief,
      members: { include: { user: userBrief } },
      tasks: { select: { id: true, parentId: true, status: true, progress: true, dueDate: true } },
      _count: { select: { notes: true, categories: true } },
    },
  });
  const now = new Date();
  return projects.map(({ tasks, members, ...p }) => {
    const { progress, schedule } = projectSchedule(p, tasks, now);
    return {
      ...p,
      members: members.map((m) => ({ ...m.user, projectRole: m.role })),
      progress,
      schedule,
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t) => t.status === "DONE").length,
      overdueTasks: tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < now).length,
    };
  });
}

/** Full project workspace payload: categories, task tree, members, progress. */
export async function getProjectDetail(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: userBrief,
      members: { include: { user: userBrief } },
      // id breaks ties between rows created in the same instant, so the order is stable.
      categories: { orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
      tasks: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          assignee: userBrief,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { reports: true } },
        },
      },
    },
  });
  if (!project) return null;

  const childrenOf = indexChildren(project.tasks);
  const tasks = project.tasks.map((t) => ({
    ...t,
    effectiveProgress: Math.round(effectiveProgress(t, childrenOf)),
    subtaskCount: childrenOf.get(t.id)?.length ?? 0,
  }));

  const now = new Date();
  const categories = categorySchedules(project.categories, project.tasks, project.startDate, now);
  const { progress, workload, schedule } = projectSchedule(project, project.tasks, now);
  const { members, ...rest } = project;
  return {
    ...rest,
    members: members.map((m) => ({ ...m.user, projectRole: m.role })),
    categories,
    tasks,
    progress,
    workload,
    schedule,
  };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;

/**
 * The project workspace payload (GET /api/projects/[id]): the project plus the
 * caller's rights, derived from the loaded members instead of another query.
 * Null when the caller can't see the project.
 */
export function workspaceFor(user: CurrentUser, project: ProjectDetail | null) {
  if (!project) return null;
  const access = accessFrom(user, project.ownerId, project.members.find((m) => m.id === user.id)?.projectRole ?? null);
  if (!access.view) return null;
  return {
    project,
    canManage: access.manage,
    canContribute: access.contribute,
    // Deleting stays with the owner and org-wide project managers.
    canDelete: project.ownerId === user.id || canManageAllProjects(user),
    projectRole: access.role,
  };
}

export type ProjectWorkspace = NonNullable<ReturnType<typeof workspaceFor>>;

export async function loadWorkspace(user: CurrentUser, projectId: string) {
  return workspaceFor(user, await getProjectDetail(projectId));
}

/**
 * Mutations called with ?include=workspace answer with the refreshed workspace,
 * so the project screen updates from the same response instead of a second request.
 */
export async function withWorkspace<T extends object>(req: { nextUrl: URL }, user: CurrentUser, projectId: string, body: T) {
  if (req.nextUrl.searchParams.get("include") !== "workspace") return body;
  return { ...body, workspace: await loadWorkspace(user, projectId) };
}
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"] as const;

/** Tasks across visible projects (GET /api/tasks and the "Công việc của tôi" page). */
export async function listTasks(
  user: CurrentUser,
  { scope, status, projectId, q }: { scope?: string | null; status?: string | null; projectId?: string | null; q?: string | null },
) {
  const query = q?.trim();
  return prisma.task.findMany({
    where: {
      project: projectVisibilityWhere(user),
      ...((scope ?? "mine") === "mine" ? { assigneeId: user.id } : {}),
      ...(status && (TASK_STATUSES as readonly string[]).includes(status) ? { status: status as (typeof TASK_STATUSES)[number] } : {}),
      ...(projectId ? { projectId } : {}),
      ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    include: {
      project: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
      parent: { select: { id: true, title: true } },
      _count: { select: { subtasks: true, reports: true } },
    },
  });
}

/**
 * Reports inbox (GET /api/reports/inbox and the inbox page).
 * box=received: reports on projects the user manages (org-wide project managers: all) — the manager inbox.
 * box=sent:     reports the user has submitted, with their review status.
 * status=pending|reviewed|all filters by review state.
 */
export async function inboxReports(user: CurrentUser, boxParam?: string | null, statusParam?: string | null) {
  const box = boxParam === "sent" ? "sent" : "received";
  const status = statusParam ?? "all";
  const scope = box === "sent" ? { authorId: user.id } : { task: { project: managedProjectsWhere(user) } };
  const reviewFilter = status === "pending" ? { reviewedAt: null } : status === "reviewed" ? { reviewedAt: { not: null } } : {};

  const [reports, pendingCount] = await Promise.all([
    prisma.taskReport.findMany({
      where: { ...scope, ...reviewFilter },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        author: { select: { id: true, name: true, avatarColor: true, jobTitle: true } },
        reviewer: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
            project: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    box === "received" ? prisma.taskReport.count({ where: { ...scope, reviewedAt: null } }) : Promise.resolve(0),
  ]);
  return { reports, pendingCount };
}

/** IDs of the users who can be given work in a project (owner + members who aren't viewers). */
export async function projectMemberIds(projectId: string): Promise<Set<string>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { role: { not: "VIEWER" } }, select: { userId: true } } },
  });
  if (!project) return new Set();
  return new Set([project.ownerId, ...project.members.map((m) => m.userId)]);
}
