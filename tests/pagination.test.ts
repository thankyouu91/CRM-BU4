import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CurrentUser } from "../lib/session";
const db = vi.hoisted(() => ({ task: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() }, taskReport: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock("../lib/prisma", () => ({ prisma: db }));
import { listTasks, inboxReports } from "../lib/queries";
const me = { id: "u", role: "MEMBER", permissions: [] } as unknown as CurrentUser;
afterEach(() => vi.useRealTimers());
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
  expect(db.task.count).toHaveBeenCalledTimes(5);
  expect(result.tasks[0].canReport).toBe(false);
  expect(result.tasks[0].project).not.toHaveProperty("members");
});
it("exposes older inbox reports and applies the cursor", async () => {
  const result = await inboxReports(me, "sent", "all", "r99");
  expect(result).toMatchObject({ nextCursor: "r99", total: 250 });
  expect(result.reports).toHaveLength(100);
  expect(db.taskReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "r99" }, skip: 1, where: { authorId: "u" } }));
});

it.each([
  ["this-week", "2026-10-04T17:00:00.000Z", "2026-10-11T16:59:59.999Z"],
  ["next-week", "2026-10-11T17:00:00.000Z", "2026-10-18T16:59:59.999Z"],
  ["next-month", "2026-10-31T17:00:00.000Z", "2026-11-30T16:59:59.999Z"],
])("filters %s on the server before pagination and applies the same scope to all statistics", async (deadline, start, end) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00+07:00"));
  const result = await listTasks(me, { deadline, q: "  Báo cáo  ", projectId: "p", cursor: "t99" });
  const where = db.task.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({ assigneeId: "u", projectId: "p", title: { contains: "Báo cáo", mode: "insensitive" }, dueDate: { gte: new Date(start), lte: new Date(end) } });
  expect(where.project).toBeTruthy(); // Visibility constraints remain in place.
  expect(db.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "t99" }, skip: 1, take: 101 }));
  expect(db.task.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where }));
  expect(db.task.count).toHaveBeenCalledTimes(5);
  for (const [args] of db.task.count.mock.calls) expect(args.where.AND[0]).toEqual(where);
  expect(result).toMatchObject({ deadline, asOf: "2026-10-11T05:00:00.000Z", total: 601, stats: { open: 401 } });
});

it("keeps undated tasks available in all and retains visibility when changing assignment scope", async () => {
  const result = await listTasks(me, { scope: "all", deadline: "unknown" });
  const where = db.task.findMany.mock.calls[0][0].where;
  expect(where).not.toHaveProperty("dueDate");
  expect(where).not.toHaveProperty("assigneeId");
  expect(where.project).toBeTruthy();
  expect(result.deadline).toBe("all");
});

it("adds a quick filter on top of every other filter, and counts each quick filter without it", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00+07:00"));
  db.task.count.mockResolvedValueOnce(9).mockResolvedValueOnce(1).mockResolvedValueOnce(4).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
  const result = await listTasks(me, { scope: "all", issue: "unassigned", projectId: "p" });
  const where = db.task.findMany.mock.calls[0][0].where;
  expect(where.AND[0]).toMatchObject({ projectId: "p" });
  expect(where.AND[0].project).toBeTruthy();
  expect(where.AND[1]).toEqual({ status: { not: "DONE" }, assigneeId: null });
  // The three quick-filter counts ignore the chosen quick filter, so each chip shows its own total.
  const bases = db.task.count.mock.calls.slice(2).map(([args]) => args.where.AND);
  expect(bases.map((and) => and[0])).toEqual([where.AND[0], where.AND[0], where.AND[0]]);
  expect(bases[1][1]).toEqual({ status: { not: "DONE" }, dueDate: null });
  expect(result).toMatchObject({ issue: "unassigned", issues: { unassigned: 4, nodue: 3, overdue: 2 } });
  expect((await listTasks(me, { issue: "bogus" })).issue).toBeNull();
});
