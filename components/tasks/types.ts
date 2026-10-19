export type UserBrief = { id: string; name: string; avatarColor: string; jobTitle?: string | null; /** Not in the project yet: joins it when given the work. */ joins?: boolean };
export type CategoryBrief = { id: string; name: string; color: string; parentId?: string | null; startDate?: string | null; dueDate?: string | null };

/** Category picker options: each main category followed by its sub-categories, indented. */
export function categoryOptions(categories: CategoryBrief[]): { id: string; label: string }[] {
  const ids = new Set(categories.map((c) => c.id));
  const mains = categories.filter((c) => !c.parentId || !ids.has(c.parentId));
  return mains.flatMap((m) => [
    { id: m.id, label: m.name },
    ...categories.filter((c) => c.parentId === m.id).map((c) => ({ id: c.id, label: `\u00a0\u00a0\u00a0└ ${c.name}` })),
  ]);
}

export interface TaskBase {
  effectiveProgress?: number;
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  projectId: string;
  categoryId: string | null;
  parentId: string | null;
  assigneeId: string | null;
  createdById: string;
}

export interface TaskReportItem {
  id: string;
  content: string;
  progress: number;
  hoursSpent: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  author: UserBrief;
  reviewer: { id: string; name: string } | null;
}

export interface TaskDetail extends TaskBase {
  project: {
    id: string;
    name: string;
    color: string;
    owner: UserBrief;
    members: { role: string; user: UserBrief }[];
    categories: CategoryBrief[];
    startDate?: string | null;
    dueDate?: string | null;
  };
  category: (CategoryBrief & { parent?: { name: string } | null }) | null;
  parent: { id: string; title: string } | null;
  assignee: UserBrief | null;
  createdBy: UserBrief;
  subtasks: (TaskBase & { assignee: UserBrief | null; _count: { subtasks: number } })[];
  reports: TaskReportItem[];
}

export interface TaskPermissions {
  manage: boolean;
  report: boolean;
  isProjectManager: boolean;
  /** The person, when they manage the project without being in it: they can still take the task. */
  self?: UserBrief | null;
}

/**
 * Owner + members who aren't view-only, de-duplicated — the people a task can be assigned
 * to — plus the person themselves when they manage the project without being in it.
 */
export function projectPeople(project: TaskDetail["project"], self?: UserBrief | null): UserBrief[] {
  const map = new Map<string, UserBrief>();
  map.set(project.owner.id, project.owner);
  for (const m of project.members) if (m.role !== "VIEWER") map.set(m.user.id, m.user);
  if (self && !map.has(self.id)) map.set(self.id, { ...self, joins: true });
  return Array.from(map.values());
}

/** Option text in assignee pickers. */
export const personLabel = (u: UserBrief) => `${u.name}${u.joins ? " (bạn)" : u.jobTitle ? ` · ${u.jobTitle}` : ""}`;

/** Shown under an assignee picker when the chosen person is you, not in the project yet. */
export const joinHint = (people: UserBrief[], id: string | null | undefined) =>
  id && people.some((u) => u.id === id && u.joins) ? "Bạn sẽ được thêm vào dự án với vai trò thành viên." : undefined;
