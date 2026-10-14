import { describe, expect, it } from "vitest";
import { assignability, resolveTaskState } from "../lib/task-rules";
import { joinHint, personLabel, projectPeople } from "../components/tasks/types";

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

describe("who work can be given to", () => {
  const members = new Set(["owner", "an"]);
  it("allows the project's people, and the person acting when they may contribute without being in it", () => {
    expect(assignability(members, "an", { id: "admin" }, true)).toBe("member");
    expect(assignability(members, "admin", { id: "admin" }, true)).toBe("join");
    // Someone else outside the project, or yourself without the right to contribute: no.
    expect(assignability(members, "binh", { id: "admin" }, true)).toBeNull();
    expect(assignability(members, "viewer", { id: "viewer" }, false)).toBeNull();
  });
});

describe("assignee pickers", () => {
  const user = (id: string, jobTitle: string | null = null) => ({ id, name: id.toUpperCase(), avatarColor: "#000", jobTitle });
  const project = { owner: user("owner"), members: [{ role: "MEMBER", user: user("an", "Kỹ sư") }, { role: "VIEWER", user: user("viewer") }] } as Parameters<typeof projectPeople>[0];
  it("offers yourself, marked as joining, when you manage the project without being in it", () => {
    const people = projectPeople(project, user("admin", "Giám đốc"));
    expect(people.map(personLabel)).toEqual(["OWNER", "AN · Kỹ sư", "ADMIN (bạn)"]);
    expect(joinHint(people, "admin")).toBe("Bạn sẽ được thêm vào dự án với vai trò thành viên.");
    expect(joinHint(people, "an")).toBeUndefined();
    // Already in the list (the owner): offered once, as usual.
    expect(projectPeople(project, user("owner")).map(personLabel)).toEqual(["OWNER", "AN · Kỹ sư"]);
    expect(projectPeople(project, null)).toHaveLength(2);
  });
});
