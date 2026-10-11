"use client";
import { useMemo } from "react";
import { taskTree, type TaskFilters } from "@/lib/task-tree";
import type { ProjectTask } from "./types";
export type { TaskFilters } from "@/lib/task-tree";

export function useTaskTree(tasks: ProjectTask[], { mine, hideDone }: TaskFilters, meId: string) {
  return useMemo(() => taskTree(tasks, { mine, hideDone }, meId), [tasks, mine, hideDone, meId]);
}
