import { describe, expect, it } from "vitest";
import { planBulk, type BulkTaskRow } from "../lib/task-bulk";
import type { CurrentUser } from "../lib/session";

const me = (patch: Partial<CurrentUser> = {}): CurrentUser => ({ id: "me", email: "", name: "Me", role: "MEMBER", permissions: [], jobTitle: null, avatarColor: "#000", mustChangePassword: false, ...patch });
const row = (id: string, patch: Partial<BulkTaskRow> = {}): BulkTaskRow => ({
  id, title: id, projectId: "p", assigneeId: null, createdById: "boss", status: "TODO", progress: 0, completedAt: null, updatedAt: new Date("2026-10-01"),
  startDate: null, dueDate: null, priority: "MEDIUM",
  project: { name: "Dự án A", ownerId: "boss", members: [{ userId: "me", role: "MANAGER" }, { userId: "an", role: "MEMBER" }, { userId: "viewer", role: "VIEWER" }] },
  ...patch,
});

describe("bulk task changes", () => {
  it("assigns tasks only to project members and skips the rest with a reason", () => {
    const outsider = row("other", { project: { name: "Dự án B", ownerId: "boss", members: [{ userId: "me", role: "MANAGER" }] } });
    const plan = planBulk(me(), ["a", "b", "other"], [row("a"), row("b", { assigneeId: "an" }), outsider], { assigneeId: "an" }, "An");
    expect(plan.apply.map((x) => [x.task.id, x.data])).toEqual([["a", { assigneeId: "an" }]]);
    expect(plan.unchanged).toBe(1);
    expect(plan.skipped).toEqual([{ id: "other", title: "other", reason: "An không phải thành viên dự án “Dự án B”" }]);
    // Viewers are not given work; the owner can be.
    expect(planBulk(me(), ["a"], [row("a")], { assigneeId: "viewer" }).skipped).toHaveLength(1);
    expect(planBulk(me(), ["a"], [row("a")], { assigneeId: "boss" }).apply).toHaveLength(1);
  });

  it("applies the per-task rights of editing one task", () => {
    const member = { project: { name: "P", ownerId: "boss", members: [{ userId: "me", role: "MEMBER" as const }] } };
    const mineToReport = row("assigned", { ...member, assigneeId: "me" });
    const someoneElse = row("other", { ...member, assigneeId: "an" });
    // An assignee may move status, not the deadline.
    expect(planBulk(me(), ["assigned", "other"], [mineToReport, someoneElse], { status: "IN_PROGRESS" }).apply.map((x) => x.task.id)).toEqual(["assigned"]);
    const due = planBulk(me(), ["assigned"], [mineToReport], { dueDate: new Date("2026-10-20T16:59:59.999Z") });
    expect(due.skipped[0].reason).toMatch(/Chỉ người quản lý/);
    // A project the person cannot see looks like a missing task: no title leaks.
    const hidden = row("hidden", { project: { name: "Bí mật", ownerId: "boss", members: [] } });
    expect(planBulk(me(), ["hidden", "gone"], [hidden], { priority: "HIGH" }).skipped).toEqual([
      { id: "hidden", title: null, reason: "Không tìm thấy công việc" },
      { id: "gone", title: null, reason: "Không tìm thấy công việc" },
    ]);
    // Org-wide project managers may change any visible task.
    expect(planBulk(me({ role: "MANAGER", permissions: ["PROJECT_MANAGE_ALL", "PROJECT_VIEW_ALL"] as CurrentUser["permissions"] }), ["hidden"], [hidden], { priority: "HIGH" }).apply).toHaveLength(1);
  });

  it("completes tasks like a single edit and keeps start before deadline", () => {
    const plan = planBulk(me(), ["a"], [row("a", { progress: 40, status: "IN_PROGRESS" })], { status: "DONE" });
    expect(plan.apply[0].data).toMatchObject({ status: "DONE", progress: 100 });
    expect(plan.apply[0].data.completedAt).toBeInstanceOf(Date);
    const late = planBulk(me(), ["a"], [row("a", { startDate: new Date("2026-11-01") })], { dueDate: new Date("2026-10-20") });
    expect(late.skipped[0].reason).toBe("Ngày bắt đầu sau deadline");
    expect(planBulk(me(), ["a", "a"], [row("a")], { dueDate: null }).unchanged).toBe(1);
  });
});
