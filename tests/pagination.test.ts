import { beforeEach, expect, it, vi } from "vitest";
import type { CurrentUser } from "../lib/session";
const db = vi.hoisted(() => ({ task: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() }, taskReport: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock("../lib/prisma", () => ({ prisma: db }));
import { listTasks, inboxReports } from "../lib/queries";
const me = { id: "u", role: "MEMBER", permissions: [] } as unknown as CurrentUser;
beforeEach(() => {
  vi.clearAllMocks();
  db.task.findMany.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ id: `t${i}`, createdById: "other", assigneeId: "u", project: { id: "p", ownerId: "other", members: [{ role: "VIEWER" }] } })));
  db.task.groupBy.mockResolvedValue([{ status: "IN_PROGRESS", _count: { _all: 401 } }, { status: "DONE", _count: { _all: 200 } }]);
  db.task.count.mockResolvedValue(601);
  db.taskReport.findMany.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ id: `r${i}` })));
  db.taskReport.count.mockResolvedValue(250);
});
it("exposes continuation and full totals rather than silently truncating tasks", async () => {
  const result = await listTasks(me, {});
  expect(result).toMatchObject({ nextCursor: "t99", total: 601, stats: { open: 401, active: 401 } });
  expect(result.tasks).toHaveLength(100);
  expect(db.task.count).toHaveBeenCalledTimes(2);
  expect(result.tasks[0].canReport).toBe(false);
  expect(result.tasks[0].project).not.toHaveProperty("members");
});
it("exposes older inbox reports and applies the cursor", async () => {
  const result = await inboxReports(me, "sent", "all", "r99");
  expect(result).toMatchObject({ nextCursor: "r99", total: 250 });
  expect(result.reports).toHaveLength(100);
  expect(db.taskReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "r99" }, skip: 1, where: { authorId: "u" } }));
});
