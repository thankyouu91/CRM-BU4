import { describe, expect, it } from "vitest";
import { calendarPeriod, calendarSelection, moveCalendar, projectTiming, timelineSpan } from "../lib/project-calendar";

describe("project activity calendar", () => {
  it("uses business dates at month boundaries and includes leap days", () => {
    const period = calendarPeriod("month", "2024-02-15T12:00:00Z");
    expect(period.columns).toHaveLength(29);
    expect(period.from.toISOString()).toContain("2024-02-01T00:00:00");
    const boundary = calendarPeriod("month", "2026-09-30T18:00:00Z");
    expect(boundary.label).toBe("Tháng 10/2026");
  });

  it("moves from the beginning of each period without skipping short months", () => {
    const next = moveCalendar("month", "2026-01-31T12:00:00Z", 1);
    expect(calendarPeriod("month", next).label).toBe("Tháng 2/2026");
    expect(calendarPeriod("quarter", moveCalendar("quarter", "2026-11-01T00:00:00Z", 1)).label).toBe("Quý 1/2027");
    expect(calendarPeriod("year", "2026-01-01T00:00:00Z").columns).toHaveLength(12);
    expect(calendarPeriod("quarter", "2026-11-01T00:00:00Z").columns).toHaveLength(3);
  });

  it("clips cross-period projects and includes the entire due day", () => {
    const period = calendarPeriod("month", "2026-10-11T00:00:00Z");
    const span = timelineSpan(projectTiming({ startDate: "2026-09-15", dueDate: "2026-11-01" })!, period)!;
    expect(span).toMatchObject({ left: 0, width: 100, continuesBefore: true, continuesAfter: true });
    expect(timelineSpan(projectTiming({ startDate: "2026-10-31", dueDate: "2026-10-31" })!, period)?.width).toBeCloseTo(100 / 31);
    expect(timelineSpan(projectTiming({ startDate: "2026-11-01", dueDate: "2026-11-05" })!, period)).toBeNull();
  });

  it("keeps undated/invalid projects separate and handles partial dates explicitly", () => {
    expect(projectTiming({ startDate: null, dueDate: null })).toBeNull();
    expect(projectTiming({ startDate: "bad", dueDate: null })).toBeNull();
    expect(projectTiming({ startDate: "2026-12-01", dueDate: "2026-10-01" })).toBeNull();
    expect(projectTiming({ startDate: null, dueDate: "2026-10-20" })?.kind).toBe("deadline");
    const ongoing = projectTiming({ startDate: "2026-10-01", dueDate: null })!;
    expect(ongoing.kind).toBe("open");
    expect(timelineSpan(ongoing, calendarPeriod("year", "2027-01-01"))?.width).toBe(100);
  });

  it("validates URL selection instead of normalizing impossible dates", () => {
    const now = "2026-10-11T00:00:00Z";
    expect(calendarSelection("quarter", "2026-07", now)).toEqual({ view: "quarter", anchor: "2026-07-01" });
    expect(calendarSelection("bad", "2026-99", now)).toEqual({ view: "month", anchor: now });
  });
});
