import { expect, it } from "vitest";
import { outsideWindows } from "../lib/date-window";

const project = { kind: "dự án", name: "Workshop", startDate: "2026-08-18T17:00:00Z", dueDate: "2026-10-16T16:59:59Z" };

it("warns when a task leaves its project's dates, by Vietnam day", () => {
  expect(outsideWindows("2026-08-19", "2026-10-16", [project])).toEqual([]);
  expect(outsideWindows("2026-08-19", "2026-10-20", [project])).toEqual(["Hạn chót sau hạn của dự án “Workshop” (16/10/2026)"]);
  expect(outsideWindows("2026-08-10", null, [project])).toEqual(["Ngày bắt đầu trước ngày bắt đầu của dự án “Workshop” (19/08/2026)"]);
  // ISO task dates: 16:59:59Z on the 16th is still the 16th in Vietnam.
  expect(outsideWindows(null, "2026-10-16T16:59:59Z", [project])).toEqual([]);
});

it("checks the category too, and says nothing without dates", () => {
  const cat = { kind: "hạng mục", name: "Hậu cần", startDate: null, dueDate: "2026-10-01T16:59:59Z" };
  expect(outsideWindows(null, "2026-10-05", [project, cat])).toEqual(["Hạn chót sau hạn của hạng mục “Hậu cần” (01/10/2026)"]);
  expect(outsideWindows(null, null, [project, cat])).toEqual([]);
  expect(outsideWindows("2026-10-10", "2026-10-12", [{ kind: "dự án", name: "X", startDate: null, dueDate: null }])).toEqual([]);
});
