import { beforeEach, expect, it, vi } from "vitest";
import type { CurrentUser } from "../lib/session";
const db = vi.hoisted(() => ({ task: { findMany: vi.fn(), count: vi.fn() }, taskReport: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock("../lib/prisma", () => ({ prisma: db }));
import { listTasks, inboxReports } from "../lib/queries";
const me = { id: "u", role: "MEMBER", permissions: [] } as unknown as CurrentUser;
beforeEach(() => {
  db.task.findMany.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ id: `t${i}` })));
  db.task.count.mockResolvedValue(601);
  db.taskReport.findMany.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ id: `r${i}` })));
  db.taskReport.count.mockResolvedValue(250);
});
it("exposes continuation and full totals rather than silently truncating tasks", async () => {
  const result = await listTasks(me, {});
  expect(result).toMatchObject({ nextCursor: "t99", total: 601, stats: { open: 601 } });
  expect(result.tasks).toHaveLength(100);
});
it("exposes older inbox reports and applies the cursor", async () => {
  const result = await inboxReports(me, "sent", "all", "r99");
  expect(result).toMatchObject({ nextCursor: "r99", total: 250 });
  expect(result.reports).toHaveLength(100);
  expect(db.taskReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "r99" }, skip: 1, where: { authorId: "u" } }));
});
