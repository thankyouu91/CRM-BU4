import { describe, expect, it } from "vitest";
import { resolveTaskState } from "../lib/task-rules";

describe("task state writes", () => {
  const current = { status: "IN_PROGRESS" as const, progress: 20, completedAt: null };
  it("does not overwrite concurrent progress when only metadata changes", () => {
    const persisted = { ...current, progress: 80 };
    Object.assign(persisted, resolveTaskState(current, {}));
    expect(persisted.progress).toBe(80);
  });
  it("completes and reopens consistently", () => {
    const done = resolveTaskState(current, { status: "DONE" });
    expect(done).toMatchObject({ status: "DONE", progress: 100, completedAt: expect.any(Date) });
    expect(resolveTaskState({ ...current, status: "DONE", completedAt: new Date() }, { status: "IN_PROGRESS" }).completedAt).toBeNull();
  });
});
