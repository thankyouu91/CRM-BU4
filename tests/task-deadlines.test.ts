import { describe, expect, it } from "vitest";
import { parseDeadlineFilter, taskDeadlineBucket, taskDeadlinePeriods } from "../lib/task-deadlines";

const now = new Date("2026-10-11T12:00:00+07:00");
const range = (period: { start: Date; end: Date }) => [period.start.toISOString(), period.end.toISOString()];

describe("deadline calendar periods", () => {
  it("uses full Monday–Sunday weeks and the next calendar month in Vietnam", () => {
    const periods = taskDeadlinePeriods(now);
    expect(range(periods["this-week"])).toEqual(["2026-10-04T17:00:00.000Z", "2026-10-11T16:59:59.999Z"]);
    expect(range(periods["next-week"])).toEqual(["2026-10-11T17:00:00.000Z", "2026-10-18T16:59:59.999Z"]);
    expect(range(periods["next-month"])).toEqual(["2026-10-31T17:00:00.000Z", "2026-11-30T16:59:59.999Z"]);
  });

  it("changes the week at Vietnam midnight even when UTC is still Sunday", () => {
    const before = taskDeadlinePeriods(new Date("2026-10-11T16:59:59.999Z"));
    const after = taskDeadlinePeriods(new Date("2026-10-11T17:00:00.000Z"));
    expect(after["this-week"].start).toEqual(before["next-week"].start);
  });

  it("handles year rollover and leap-year February without skipping a month", () => {
    expect(range(taskDeadlinePeriods(new Date("2026-12-31T12:00:00+07:00"))["next-month"]))
      .toEqual(["2026-12-31T17:00:00.000Z", "2027-01-31T16:59:59.999Z"]);
    expect(range(taskDeadlinePeriods(new Date("2028-01-31T12:00:00+07:00"))["next-month"]))
      .toEqual(["2028-01-31T17:00:00.000Z", "2028-02-29T16:59:59.999Z"]);
  });

  it("falls back to all deadlines for absent or unrecognized filters", () => {
    expect(parseDeadlineFilter()).toBe("all");
    expect(parseDeadlineFilter("rolling-week")).toBe("all");
    expect(parseDeadlineFilter("next-month")).toBe("next-month");
  });
});

it("groups deadline status in business time and keeps future periods out of rolling-week buckets", () => {
  const task = (dueDate: string | null, status = "TODO") => ({ dueDate, status });
  expect(taskDeadlineBucket(task("2026-10-10T16:59:59Z"), now)).toBe("overdue");
  expect(taskDeadlineBucket(task("2026-10-11T16:59:59.999Z"), now)).toBe("today");
  expect(taskDeadlineBucket(task("2026-10-11T17:00:00Z"), now)).toBe("week");
  expect(taskDeadlineBucket(task("2026-10-11T17:00:00Z"), now, "next-week")).toBe("later");
  expect(taskDeadlineBucket(task(null), now)).toBe("none");
  expect(taskDeadlineBucket(task("invalid"), now)).toBe("none");
  expect(taskDeadlineBucket(task("2026-10-01T00:00:00Z", "DONE"), now)).toBe("done");
});
