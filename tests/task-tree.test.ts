import { expect, it } from "vitest";
import { groupBy, taskTree } from "../lib/task-tree";

it("retains ancestors of matching descendants and server order", () => {
  const tasks = [
    { id: "p", parentId: null, assigneeId: "other", status: "DONE" },
    { id: "a", parentId: "p", assigneeId: "me", status: "TODO" },
    { id: "b", parentId: "p", assigneeId: "me", status: "DONE" },
    { id: "orphan", parentId: "missing", assigneeId: "me", status: "TODO" },
  ];
  const result = taskTree(tasks, { mine: true, hideDone: true }, "me");
  expect([...result.visible]).toEqual(["a", "p", "orphan"]);
  expect(result.roots.map((t) => t.id)).toEqual(["p", "orphan"]);
  expect(result.childrenOf.get("p")?.map((t) => t.id)).toEqual(["a", "b"]);
});

it("handles deep trees and cyclic input without recursion or infinite loops", () => {
  const tasks = Array.from({ length: 20000 }, (_, i) => ({ id: String(i), parentId: i ? String(i - 1) : null, assigneeId: "me", status: "TODO" }));
  expect(taskTree(tasks, { mine: true, hideDone: false }, "me").visible.size).toBe(20000);
  tasks[0].parentId = "19999";
  expect(taskTree(tasks, { mine: true, hideDone: false }, "me").visible.size).toBe(20000);
});

it("groups in one pass without changing source order", () => {
  const tasks = [{ id: 1, status: "DONE" }, { id: 2, status: "TODO" }, { id: 3, status: "DONE" }];
  expect(groupBy(tasks, (t) => t.status).get("DONE")?.map((t) => t.id)).toEqual([1, 3]);
  expect(tasks.map((t) => t.id)).toEqual([1, 2, 3]);
});
