export interface ProgressNode {
  id: string;
  parentId: string | null;
  status: string;
  progress: number;
}

/**
 * Effective progress of a task: DONE counts as 100; a task with subtasks takes
 * the average of its subtasks (recursively); otherwise its own progress field.
 */
export function effectiveProgress(
  task: ProgressNode,
  childrenOf: Map<string, ProgressNode[]>,
  seen: Set<string> = new Set(),
): number {
  if (task.status === "DONE") return 100;
  if (seen.has(task.id)) return task.progress; // guard against bad cyclic data
  seen.add(task.id);
  const children = childrenOf.get(task.id);
  if (!children || children.length === 0) return task.progress;
  const sum = children.reduce((acc, c) => acc + effectiveProgress(c, childrenOf, seen), 0);
  return sum / children.length;
}

export function indexChildren<T extends ProgressNode>(tasks: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = map.get(t.parentId) ?? [];
    list.push(t);
    map.set(t.parentId, list);
  }
  return map;
}

/** Project completion % = average effective progress of its top-level tasks. */
export function projectProgress(tasks: ProgressNode[]): number {
  const childrenOf = indexChildren(tasks);
  const roots = tasks.filter((t) => !t.parentId);
  if (roots.length === 0) return 0;
  const sum = roots.reduce((acc, t) => acc + effectiveProgress(t, childrenOf), 0);
  return Math.round(sum / roots.length);
}

/**
 * Completion % of an arbitrary subset of tasks (e.g. one category): tasks whose
 * parent is outside the subset count as top-level.
 */
export function subsetProgress(tasks: ProgressNode[]): number {
  const ids = new Set(tasks.map((t) => t.id));
  const childrenOf = indexChildren(tasks);
  const roots = tasks.filter((t) => !t.parentId || !ids.has(t.parentId));
  if (roots.length === 0) return 0;
  const sum = roots.reduce((acc, t) => acc + effectiveProgress(t, childrenOf), 0);
  return Math.round(sum / roots.length);
}
