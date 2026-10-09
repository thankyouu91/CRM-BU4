import type { CategoryBrief, TaskBase, UserBrief } from "@/components/tasks/types";

export interface ProjectCategory extends CategoryBrief {
  order: number;
  progress: number;
  taskCount: number;
}

export interface ProjectTask extends TaskBase {
  assignee: UserBrief | null;
  createdBy: { id: string; name: string };
  effectiveProgress: number;
  subtaskCount: number;
  _count: { reports: number };
}

export interface ProjectDetailData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  ownerId: string;
  owner: UserBrief;
  members: UserBrief[];
  categories: ProjectCategory[];
  tasks: ProjectTask[];
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItemData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  ownerId: string;
  owner: UserBrief;
  members: UserBrief[];
  progress: number;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  updatedAt: string;
  _count: { notes: number; categories: number };
}

export type Directory = (UserBrief & { role: string })[];
