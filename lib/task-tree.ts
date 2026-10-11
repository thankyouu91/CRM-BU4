export interface TaskFilters { mine: boolean; hideDone: boolean }
interface TreeNode { id: string; parentId: string | null; assigneeId: string | null; status: string }

/** Preserve input order; matching descendants retain ancestors without recursion. */
export function taskTree<T extends TreeNode>(tasks: T[], filters: TaskFilters, meId: string) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const task of tasks) {
    if (!task.parentId || !byId.has(task.parentId)) roots.push(task);
    else {
      const children = childrenOf.get(task.parentId) ?? [];
      children.push(task);
      childrenOf.set(task.parentId, children);
    }
  }
  const visible = new Set<string>();
  for (const task of tasks) {
    if ((filters.mine && task.assigneeId !== meId) || (filters.hideDone && task.status === "DONE")) continue;
    let current: T | undefined = task;
    while (current && !visible.has(current.id)) {
      visible.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return { childrenOf, visible, roots: roots.filter((task) => visible.has(task.id)) };
}

/** Linear grouping, retaining stable server order without repeated array copies. */
export function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
