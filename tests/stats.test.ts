import { describe, expect, it, vi } from "vitest";

// lib/stats.ts also holds getSummary, which queries the database; the pure
// functions tested here never touch the client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  buildBuckets,
  categorySchedules,
  effectiveProgress,
  indexChildren,
  projectProgress,
  projectSchedule,
  subsetProgress,
  type ProgressNode,
} from "@/lib/stats";

const DAY = 86_400_000;
const T0 = new Date("2026-03-01T00:00:00Z").getTime();
const day = (n: number) => new Date(T0 + n * DAY);

const node = (id: string, parentId: string | null, status: string, progress: number): ProgressNode => ({
  id,
  parentId,
  status,
  progress,
});

describe("effectiveProgress", () => {
  it("counts DONE as 100 whatever its progress field says", () => {
    expect(effectiveProgress(node("a", null, "DONE", 10), new Map())).toBe(100);
  });

  it("uses the task's own progress without subtasks", () => {
    expect(effectiveProgress(node("a", null, "IN_PROGRESS", 35), new Map())).toBe(35);
  });

  it("averages subtasks recursively, ignoring the parent's own field", () => {
    const tasks = [
      node("p", null, "IN_PROGRESS", 0),
      node("c1", "p", "DONE", 0), // 100
      node("c2", "p", "TODO", 90), // has children -> 20
      node("g1", "c2", "TODO", 0),
      node("g2", "c2", "IN_PROGRESS", 40),
    ];
    const childrenOf = indexChildren(tasks);
    expect(effectiveProgress(tasks[0], childrenOf)).toBe(60);
  });

  it("does not loop forever on cyclic parent links", () => {
    const a = node("a", "b", "TODO", 30);
    const b = node("b", "a", "TODO", 70);
    const childrenOf = indexChildren([a, b]);
    expect(effectiveProgress(a, childrenOf)).toBe(30);
  });
});

describe("projectProgress", () => {
  it("is 0 without top-level tasks", () => {
    expect(projectProgress([])).toBe(0);
  });

  it("averages top-level tasks and rounds", () => {
    expect(
      projectProgress([
        node("a", null, "DONE", 0),
        node("b", null, "TODO", 0),
        node("c", null, "IN_PROGRESS", 50),
        node("c1", "c", "TODO", 0), // c -> average of c1 = 0
      ]),
    ).toBe(33);
  });
});

describe("subsetProgress", () => {
  it("is 0 for an empty subset", () => {
    expect(subsetProgress([])).toBe(0);
  });

  it("treats tasks whose parent is outside the subset as top-level", () => {
    // projectProgress would ignore these (they have a parent), subsetProgress must not.
    const tasks = [node("x", "outside", "TODO", 20), node("y", "outside", "DONE", 0)];
    expect(projectProgress(tasks)).toBe(0);
    expect(subsetProgress(tasks)).toBe(60);
  });

  it("does not double-count a child whose parent is in the subset", () => {
    const tasks = [node("p", null, "TODO", 0), node("c", "p", "IN_PROGRESS", 50)];
    expect(subsetProgress(tasks)).toBe(50);
  });
});

describe("categorySchedules", () => {
  const categories = [
    { id: "A", parentId: null, startDate: day(0), dueDate: day(10), createdAt: day(0) },
    { id: "B", parentId: "A", startDate: null, dueDate: day(10), createdAt: day(4) },
    { id: "C", parentId: "missing", startDate: null, dueDate: day(12), createdAt: day(4) },
    { id: "D", parentId: null, startDate: day(0), dueDate: day(10), createdAt: day(0) },
  ];
  const t = (id: string, categoryId: string | null, status: string, progress: number, dueDate: Date | null = null) => ({
    ...node(id, null, status, progress),
    categoryId,
    dueDate,
  });
  const tasks = [
    t("t1", "A", "TODO", 50, day(3)), // overdue at day 5
    t("t2", "B", "IN_PROGRESS", 20),
    t("t3", "C", "TODO", 0),
    t("t4", "D", "DONE", 100),
    t("t5", null, "TODO", 0),
  ];
  const now = day(5);
  const result = categorySchedules(categories, tasks, day(2), now);
  const byId = Object.fromEntries(result.map((c) => [c.id, c]));

  it("covers a main category's own tasks plus its sub-categories'", () => {
    expect(byId.A.taskCount).toBe(2);
    expect(byId.A.progress).toBe(35);
    expect(byId.A.workload).toMatchObject({ total: 2, remaining: 2, overdue: 1, inProgress: 1, notStarted: 1 });
    expect(byId.B.taskCount).toBe(1);
    expect(byId.B.progress).toBe(20);
  });

  it("uses the main category's start for a sub-category without one", () => {
    // start day 0 (from A), due day 10, now day 5 -> planned 50; createdAt day 4 is not used.
    expect(byId.B.schedule.planned).toBe(50);
    expect(byId.B.schedule.status).toBe("BEHIND");
  });

  it("shows an orphaned sub-category as a main one, starting at the project start", () => {
    expect(byId.C.parentId).toBeNull();
    // start day 2 (project), due day 12, now day 5 -> 30
    expect(byId.C.schedule.planned).toBe(30);
  });

  it("marks a category DONE when all its tasks are done", () => {
    expect(byId.D.schedule.status).toBe("DONE");
    expect(byId.D.progress).toBe(100);
  });

  it("keeps the input order and fields", () => {
    expect(result.map((c) => c.id)).toEqual(["A", "B", "C", "D"]);
    expect(byId.B.parentId).toBe("A");
    expect(byId.B.createdAt).toEqual(day(4));
  });
});

describe("projectSchedule", () => {
  const project = { startDate: day(0), dueDate: day(10), createdAt: day(-5) };

  it("is not finished without tasks", () => {
    const s = projectSchedule(project, [], day(5));
    expect(s.progress).toBe(0);
    expect(s.workload.total).toBe(0);
    expect(s.schedule.status).toBe("BEHIND");
    expect(s.schedule.planned).toBe(50);
  });

  it("is DONE once every task is done", () => {
    const s = projectSchedule(
      project,
      [
        { ...node("a", null, "DONE", 0), dueDate: null },
        { ...node("b", null, "DONE", 0), dueDate: null },
      ],
      day(20),
    );
    expect(s.progress).toBe(100);
    expect(s.schedule.status).toBe("DONE");
  });

  it("falls back to createdAt without a start date", () => {
    const s = projectSchedule({ startDate: null, dueDate: day(5), createdAt: day(-5) }, [{ ...node("a", null, "TODO", 50), dueDate: null }], day(0));
    expect(s.schedule.planned).toBe(50);
    expect(s.schedule.status).toBe("ON_TRACK");
  });
});

describe("buildBuckets", () => {
  // TZ is pinned to Asia/Ho_Chi_Minh, so local Date constructors are Vietnam time.
  const range = (from: Date, to: Date) => ({ from, to, label: "x" });

  it("splits a day into hours", () => {
    const b = buildBuckets(range(new Date(2026, 9, 9), new Date(2026, 9, 9, 23, 59, 59, 999)), "day");
    expect(b).toHaveLength(24);
    expect(b[0].label).toBe("00h");
    expect(b[23].label).toBe("23h");
    expect(b[0].end).toEqual(new Date(2026, 9, 9, 0, 59, 59, 999));
    expect(b[23].end).toEqual(new Date(2026, 9, 9, 23, 59, 59, 999));
  });

  it("splits a month into days", () => {
    const b = buildBuckets(range(new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59, 59, 999)), "month");
    expect(b).toHaveLength(31);
    expect(b[0].label).toBe("01/10");
    expect(b[30].label).toBe("31/10");
    expect(b[0].key).toBe(new Date(2026, 9, 1).toISOString());
  });

  it("splits a quarter into Monday weeks clamped to the range", () => {
    const from = new Date(2026, 9, 1); // Thursday
    const to = new Date(2026, 11, 31, 23, 59, 59, 999);
    const b = buildBuckets(range(from, to), "quarter");
    expect(b).toHaveLength(14);
    expect(b[0].start).toEqual(from);
    expect(b[0].label).toBe("Tuần 01/10");
    expect(b[0].end).toEqual(new Date(2026, 9, 4, 23, 59, 59, 999));
    expect(b[1].start).toEqual(new Date(2026, 9, 5));
    expect(b[13].end).toEqual(to);
  });

  it("splits a year into months", () => {
    const b = buildBuckets(range(new Date(2026, 0, 1), new Date(2026, 11, 31, 23, 59, 59, 999)), "year");
    expect(b.map((x) => x.label)).toEqual(["T1/26", "T2/26", "T3/26", "T4/26", "T5/26", "T6/26", "T7/26", "T8/26", "T9/26", "T10/26", "T11/26", "T12/26"]);
    expect(b[1].end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
  });

  it("picks the custom granularity from the range length", () => {
    const from = new Date(2026, 0, 1);
    expect(buildBuckets(range(from, new Date(2026, 0, 10)), "custom")).toHaveLength(10);
    expect(buildBuckets(range(from, new Date(2026, 1, 1)), "custom")[0].label).toBe("01/01"); // 31 days -> days
    expect(buildBuckets(range(from, new Date(2026, 2, 1)), "custom")[0].label).toMatch(/^Tuần /);
    expect(buildBuckets(range(from, new Date(2026, 11, 31)), "custom")[0].label).toBe("T1/26");
  });

  it("produces contiguous, non-overlapping buckets", () => {
    const b = buildBuckets(range(new Date(2026, 9, 1), new Date(2026, 11, 31, 23, 59, 59, 999)), "quarter");
    for (let i = 1; i < b.length; i++) expect(b[i].start.getTime()).toBe(b[i - 1].end.getTime() + 1);
  });
});
