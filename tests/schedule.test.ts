import { describe, expect, it } from "vitest";
import { AT_RISK_TOLERANCE, ON_TRACK_TOLERANCE, daysLeftLabel, scheduleOf, workloadOf } from "@/lib/schedule";

const DAY = 86_400_000;
const T0 = new Date("2026-01-01T00:00:00Z").getTime();
const day = (n: number) => new Date(T0 + n * DAY);

describe("scheduleOf", () => {
  it("is NO_DEADLINE without a due date, DONE when finished", () => {
    expect(scheduleOf({ start: day(0), due: null, actual: 40, now: day(5) })).toEqual({
      status: "NO_DEADLINE",
      planned: null,
      achievement: null,
      variance: null,
      daysLeft: null,
    });
    expect(scheduleOf({ start: day(0), due: undefined, actual: 100, now: day(5) }).status).toBe("DONE");
  });

  it("is DONE when finished, even after the deadline", () => {
    expect(scheduleOf({ start: day(0), due: day(10), actual: 100, now: day(12) })).toEqual({
      status: "DONE",
      planned: 100,
      achievement: 100,
      variance: 0,
      daysLeft: -2,
    });
  });

  it("is not DONE at 100% when explicitly not finished (awaiting approval)", () => {
    const s = scheduleOf({ start: day(0), due: day(10), actual: 100, finished: false, now: day(5) });
    expect(s.status).toBe("ON_TRACK");
    expect(s.planned).toBe(50);
  });

  it("clamps actual into 0-100", () => {
    expect(scheduleOf({ start: day(0), due: day(10), actual: 150, now: day(5) }).status).toBe("DONE");
    const s = scheduleOf({ start: day(0), due: day(10), actual: -20, now: day(5) });
    expect(s.variance).toBe(-50);
    expect(s.achievement).toBe(0);
  });

  it("plans linearly between start and due", () => {
    const s = scheduleOf({ start: day(0), due: day(100), actual: 50, now: day(50) });
    expect(s).toEqual({ status: "ON_TRACK", planned: 50, achievement: 100, variance: 0, daysLeft: 50 });
  });

  describe("tolerance boundaries (planned = 50)", () => {
    const at = (actual: number) => scheduleOf({ start: day(0), due: day(100), actual, now: day(50) });

    it.each([
      [50 + 10, "ON_TRACK"],
      [50 - ON_TRACK_TOLERANCE, "ON_TRACK"],
      [50 - ON_TRACK_TOLERANCE - 1, "AT_RISK"],
      [50 - AT_RISK_TOLERANCE, "AT_RISK"],
      [50 - AT_RISK_TOLERANCE - 1, "BEHIND"],
      [0, "BEHIND"],
    ])("actual %d -> %s", (actual, status) => {
      expect(at(actual).status).toBe(status);
      expect(at(actual).variance).toBe(actual - 50);
    });
  });

  it("is OVERDUE only once the deadline has passed", () => {
    const atDue = scheduleOf({ start: day(0), due: day(10), actual: 95, now: day(10) });
    expect(atDue.status).toBe("ON_TRACK");
    expect(atDue.planned).toBe(100);
    expect(atDue.daysLeft).toBe(0);

    const late = scheduleOf({ start: day(0), due: day(10), actual: 95, now: new Date(day(10).getTime() + 1) });
    expect(late.status).toBe("OVERDUE");
    expect(late.planned).toBe(100);
  });

  it("plans nothing before the start, so achievement is unknown", () => {
    const s = scheduleOf({ start: day(10), due: day(20), actual: 0, now: day(5) });
    expect(s).toEqual({ status: "ON_TRACK", planned: 0, achievement: null, variance: 0, daysLeft: 15 });
  });

  it("falls back to fallbackStart, then to the due date", () => {
    expect(scheduleOf({ start: null, fallbackStart: day(0), due: day(10), actual: 0, now: day(5) }).planned).toBe(50);
    expect(scheduleOf({ start: null, due: day(10), actual: 0, now: day(5) }).planned).toBe(0);
  });

  it("plans nothing when start is not before due", () => {
    expect(scheduleOf({ start: day(20), due: day(10), actual: 0, now: day(5) }).planned).toBe(0);
  });

  it("caps achievement at 999", () => {
    const s = scheduleOf({ start: day(0), due: day(100), actual: 50, now: day(1) });
    expect(s.planned).toBe(1);
    expect(s.achievement).toBe(999);
  });

  it("rounds daysLeft up to whole days", () => {
    expect(scheduleOf({ start: day(0), due: day(10), actual: 0, now: day(8.5) }).daysLeft).toBe(2);
    expect(scheduleOf({ start: day(0), due: day(10), actual: 0, now: day(12.5) }).daysLeft).toBe(-2);
  });

  it("accepts ISO strings", () => {
    const s = scheduleOf({ start: day(0).toISOString(), due: day(100).toISOString(), actual: 50, now: day(50) });
    expect(s.planned).toBe(50);
  });
});

describe("daysLeftLabel", () => {
  it.each([
    [null, "Chưa có hạn"],
    [5, "còn 5 ngày"],
    [1, "còn 1 ngày"],
    [0, "đến hạn hôm nay"],
    [-2, "trễ 2 ngày"],
  ])("%s -> %s", (n, label) => {
    expect(daysLeftLabel(n)).toBe(label);
  });
});

describe("workloadOf", () => {
  const now = day(10);

  it("is empty for no tasks", () => {
    expect(workloadOf([], now)).toEqual({ total: 0, done: 0, remaining: 0, inProgress: 0, notStarted: 0, blocked: 0, overdue: 0 });
  });

  it("buckets by status and counts unfinished overdue tasks", () => {
    const w = workloadOf(
      [
        { status: "DONE", dueDate: day(1) }, // done, past due: not overdue
        { status: "IN_PROGRESS", dueDate: day(5) }, // overdue
        { status: "REVIEW", dueDate: day(20) },
        { status: "BLOCKED", dueDate: null },
        { status: "TODO", dueDate: day(10) }, // due exactly now: not overdue
        { status: "TODO", dueDate: day(9).toISOString() }, // overdue
        { status: "SOMETHING_ELSE", dueDate: undefined as unknown as null },
      ],
      now,
    );
    expect(w).toEqual({ total: 7, done: 1, remaining: 6, inProgress: 2, notStarted: 3, blocked: 1, overdue: 2 });
    expect(w.remaining).toBe(w.inProgress + w.notStarted + w.blocked);
  });
});
