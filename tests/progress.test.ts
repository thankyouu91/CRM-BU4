import { expect, it } from "vitest";
import { workTaskOf } from "../lib/work-report";
import { effectiveProgress, indexChildren, projectProgress } from "../lib/task-progress";

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
