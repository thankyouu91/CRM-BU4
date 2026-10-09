export type UserBrief = { id: string; name: string; avatarColor: string; jobTitle?: string | null };
export type CategoryBrief = { id: string; name: string; color: string };

export interface TaskBase {
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
    members: { user: UserBrief }[];
    categories: CategoryBrief[];
  };
  category: CategoryBrief | null;
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
}

/** Owner + members, de-duplicated — the people a task can be assigned to. */
export function projectPeople(project: TaskDetail["project"]): UserBrief[] {
  const map = new Map<string, UserBrief>();
  map.set(project.owner.id, project.owner);
  for (const m of project.members) map.set(m.user.id, m.user);
  return Array.from(map.values());
}
