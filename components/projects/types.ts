import type { CategoryBrief, TaskBase, UserBrief } from "@/components/tasks/types";
import type { ProjectRoleKey } from "@/lib/permissions";
import type { Schedule, Workload } from "@/lib/schedule";

/** A project member with their role in the project. */
export type ProjectMemberBrief = UserBrief & { projectRole: ProjectRoleKey };

export interface ProjectCategory extends CategoryBrief {
  order: number;
  /** Main category id for a sub-category; null for a main category. */
  parentId: string | null;
  startDate: string | null;
  dueDate: string | null;
  /** Includes the tasks of its sub-categories for a main category. */
  progress: number;
  taskCount: number;
  workload: Workload;
  schedule: Schedule;
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
  members: ProjectMemberBrief[];
  categories: ProjectCategory[];
  tasks: ProjectTask[];
  progress: number;
  workload: Workload;
  schedule: Schedule;
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
  members: ProjectMemberBrief[];
  progress: number;
  schedule: Schedule;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  updatedAt: string;
  _count: { notes: number; categories: number };
}

export type Directory = (UserBrief & { role: string })[];
