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

/** Compute a whole forest bottom-up in O(n), without recursion on valid trees. */
export function progressIndex(tasks: ProgressNode[], children = indexChildren(tasks)): Map<string, number> {
  const values = new Map<string, number>();
  const remaining = new Map<string, number>();
  const sums = new Map<string, number>();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ready: ProgressNode[] = [];
  for (const task of tasks) {
    const count = task.status === "DONE" ? 0 : (children.get(task.id)?.length ?? 0);
    remaining.set(task.id, count);
    if (!count) ready.push(task);
  }
  for (let i = 0; i < ready.length; i++) {
    const task = ready[i];
    const count = children.get(task.id)?.length ?? 0;
    const value = task.status === "DONE" ? 100 : count ? sums.get(task.id)! / count : task.progress;
    values.set(task.id, value);
    const parent = task.parentId ? byId.get(task.parentId) : undefined;
    if (!parent || parent.status === "DONE") continue;
    sums.set(parent.id, (sums.get(parent.id) ?? 0) + value);
    const pending = remaining.get(parent.id)! - 1;
    remaining.set(parent.id, pending);
    if (!pending) ready.push(parent);
  }
  // Preserve the established fallback for malformed cycles rather than caching
  // a path-dependent value for another node in the cycle.
  for (const task of tasks) {
    if (!values.has(task.id)) values.set(task.id, effectiveProgress(task, children));
  }
  return values;
}

/** Project completion % = average effective progress of its top-level tasks. */
export function projectProgress(tasks: ProgressNode[]): number {
  return rootProgress(tasks, false);
}

/**
 * Completion % of an arbitrary subset of tasks (e.g. one category): tasks whose
 * parent is outside the subset count as top-level.
 */
export function subsetProgress(tasks: ProgressNode[]): number {
  return rootProgress(tasks, true);
}

function rootProgress(tasks: ProgressNode[], includeOrphans: boolean): number {
  const ids = new Set(tasks.map((t) => t.id));
  const roots = tasks.filter((t) => !t.parentId || (includeOrphans && !ids.has(t.parentId)));
  if (roots.length === 0) return 0;
  const progress = progressIndex(tasks);
  const sum = roots.reduce((acc, t) => acc + progress.get(t.id)!, 0);
  return Math.round(sum / roots.length);
}
