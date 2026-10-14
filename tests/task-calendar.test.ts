import { expect, it } from "vitest";
import { calendarMonth, monthRange, parseMonth, shiftMonth, type CalendarTask } from "../lib/task-calendar";

const task = (patch: Partial<CalendarTask>): CalendarTask => ({
  id: patch.id ?? "t", title: "Việc", status: "TODO", progress: 0, startDate: null, dueDate: null, completedAt: null,
  project: { id: "p", name: "Dự án", color: "#2a78d6" }, ...patch,
});
// 14/10/2026 12:00 in Vietnam.
const now = new Date("2026-10-14T05:00:00Z");
const cell = (grid: ReturnType<typeof calendarMonth>, day: string) => grid.flat().find((d) => d.day === day)!;
const ids = (list: CalendarTask[]) => list.map((t) => t.id);

it("lays out Monday-first weeks covering the month", () => {
  const grid = calendarMonth([], "2026-10", now);
  expect(grid[0][0].day).toBe("2026-09-28"); // 1/10/2026 is a Thursday
  expect(grid.at(-1)!.at(-1)!.day).toBe("2026-11-01");
  expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(31);
  expect(cell(grid, "2026-10-14").today).toBe(true);
});

it("puts done on the completion day in Vietnam time, deadlines in red", () => {
  const grid = calendarMonth([
    // 23:30 UTC on the 9th is the 10th in Vietnam.
    task({ id: "done", status: "DONE", completedAt: "2026-10-09T23:30:00Z", dueDate: "2026-10-20T16:59:59Z" }),
    task({ id: "todo", status: "TODO", dueDate: "2026-10-20T16:59:59Z" }),
  ], "2026-10", now);
  expect(ids(cell(grid, "2026-10-10").done)).toEqual(["done"]);
  expect(ids(cell(grid, "2026-10-20").due)).toEqual(["todo"]); // a finished task is not a deadline any more
  expect(cell(grid, "2026-10-20").active).toEqual([]); // not started: no orange
});

it("marks work in progress orange from its start to the day before the deadline", () => {
  const grid = calendarMonth([task({ id: "a", status: "IN_PROGRESS", startDate: "2026-10-12T17:00:00Z", dueDate: "2026-10-16T16:59:59Z" })], "2026-10", now);
  expect(grid.flat().filter((d) => d.active.length).map((d) => d.day)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
  expect(ids(cell(grid, "2026-10-16").due)).toEqual(["a"]);
});

it("keeps overdue work in progress orange up to today, and work without dates on today", () => {
  const grid = calendarMonth([
    task({ id: "late", status: "REVIEW", startDate: "2026-10-10T17:00:00Z", dueDate: "2026-10-12T16:59:59Z" }),
    task({ id: "open", status: "IN_PROGRESS" }),
  ], "2026-10", now);
  expect(grid.flat().filter((d) => d.active.some((t) => t.id === "late")).map((d) => d.day)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]);
  expect(grid.flat().filter((d) => d.active.some((t) => t.id === "open")).map((d) => d.day)).toEqual(["2026-10-14"]);
});

it("parses and moves months, with Vietnam-time bounds", () => {
  expect(parseMonth("2026-13")).toBeNull();
  expect(parseMonth("2025-12")).toBe("2025-12");
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  const r = monthRange("2026-10");
  expect(r.start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  expect(r.end.toISOString()).toBe("2026-10-31T16:59:59.999Z");
});
