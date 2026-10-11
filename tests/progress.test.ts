import { expect, it } from "vitest";
import { workTaskOf } from "../lib/work-report";
import { effectiveProgress, indexChildren, projectProgress, progressIndex } from "../lib/task-progress";

it("indexes every node consistently, including cycles and completed parents", () => {
  const tree = Array.from({ length: 200 }, (_, i) => ({
    id: String(i), parentId: i ? String(Math.floor((i - 1) / 3)) : null,
    status: i % 7 === 0 ? "DONE" : "IN_PROGRESS", progress: i % 101,
  }));
  tree.push({ id: "cycle-a", parentId: "cycle-b", status: "IN_PROGRESS", progress: 20 });
  tree.push({ id: "cycle-b", parentId: "cycle-a", status: "IN_PROGRESS", progress: 80 });
  const children = indexChildren(tree);
  const values = progressIndex(tree);
  for (const task of tree) expect(values.get(task.id)).toBeCloseTo(effectiveProgress(task, children));
});

it("handles a deep tree without overflowing the call stack", () => {
  const tree = Array.from({ length: 20000 }, (_, i) => ({
    id: String(i), parentId: i ? String(i - 1) : null,
    status: "IN_PROGRESS", progress: i === 19999 ? 73 : 0,
  }));
  const values = progressIndex(tree);
  expect(values.size).toBe(tree.length);
  expect(values.get("0")).toBe(73);
});

it("uses the complete tree's computed progress in weekly reports", () => {
  const parent = {
    id: "a", title: "Parent", status: "IN_PROGRESS", priority: "MEDIUM", progress: 0,
    effectiveProgress: 100, startDate: null, dueDate: null, completedAt: null,
    createdAt: new Date(), project: { id: "p", name: "P", color: "#fff" }, parent: null,
    assignee: null, subtasks: [{ status: "IN_PROGRESS", progress: 0 }],
  };
  expect(workTaskOf(parent).progress).toBe(100);
});

it("computes nested and completed parents consistently", () => {
  const tree = [
    { id: "a", parentId: null, status: "IN_PROGRESS", progress: 0 },
    { id: "b", parentId: "a", status: "IN_PROGRESS", progress: 0 },
    { id: "c", parentId: "b", status: "DONE", progress: 100 },
  ];
  expect(effectiveProgress(tree[0], indexChildren(tree))).toBe(100);
  expect(projectProgress(tree)).toBe(100);
  expect(effectiveProgress({ ...tree[0], status: "DONE" }, new Map())).toBe(100);
});
