import { prisma } from "./prisma";
import { projectVisibilityWhere } from "./rbac";
import { effectiveProgress, indexChildren, projectProgress } from "./stats";
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
  return projects.map(({ tasks, members, ...p }) => ({
    ...p,
    members: members.map((m) => ({ ...m.user, projectRole: m.role })),
    progress: projectProgress(tasks),
    totalTasks: tasks.length,
    doneTasks: tasks.filter((t) => t.status === "DONE").length,
    overdueTasks: tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < now).length,
  }));
}

/** Full project workspace payload: categories, task tree, members, progress. */
export async function getProjectDetail(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: userBrief,
      members: { include: { user: userBrief } },
      categories: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      tasks: {
        orderBy: [{ createdAt: "asc" }],
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

  const categories = project.categories.map((c) => {
    const ct = project.tasks.filter((t) => t.categoryId === c.id);
    return { ...c, progress: projectProgress(ct), taskCount: ct.length };
  });

  const { members, ...rest } = project;
  return {
    ...rest,
    members: members.map((m) => ({ ...m.user, projectRole: m.role })),
    categories,
    tasks,
    progress: projectProgress(project.tasks),
  };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

/** IDs of the users who can be given work in a project (owner + members who aren't viewers). */
export async function projectMemberIds(projectId: string): Promise<Set<string>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { role: { not: "VIEWER" } }, select: { userId: true } } },
  });
  if (!project) return new Set();
  return new Set([project.ownerId, ...project.members.map((m) => m.userId)]);
}
