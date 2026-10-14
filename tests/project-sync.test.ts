import { expect, it } from "vitest";
import { nextProjectStatus } from "../lib/project-sync";
import { checkProjectDates } from "../lib/project-create";
import { checkTaskDates } from "../lib/task-rules";

const c = (total: number, open: number, started: number) => ({ total, open, started });

it("starts a planned project when work begins", () => {
  expect(nextProjectStatus("PLANNING", c(3, 3, 0))).toBeNull();
  expect(nextProjectStatus("PLANNING", c(3, 3, 1))).toBe("ACTIVE");
});

it("completes a project when every task is done, and reopens it when work is open again", () => {
  expect(nextProjectStatus("ACTIVE", c(4, 0, 4))).toBe("COMPLETED");
  expect(nextProjectStatus("PLANNING", c(2, 0, 2))).toBe("COMPLETED");
  expect(nextProjectStatus("COMPLETED", c(4, 0, 4))).toBeNull();
  expect(nextProjectStatus("COMPLETED", c(5, 1, 4))).toBe("ACTIVE");
});

it("leaves projects without tasks, on hold or cancelled alone", () => {
  expect(nextProjectStatus("ACTIVE", c(0, 0, 0))).toBeNull();
  expect(nextProjectStatus("COMPLETED", c(0, 0, 0))).toBeNull(); // e.g. imported from a finished contract
  expect(nextProjectStatus("ON_HOLD", c(3, 0, 3))).toBeNull();
  expect(nextProjectStatus("CANCELLED", c(3, 2, 1))).toBeNull();
});

it("refuses an end before the start", () => {
  const d = (s: string) => new Date(s);
  expect(() => checkProjectDates(d("2026-08-25"), d("2026-01-09"))).toThrow("Hạn hoàn thành của dự án không được trước ngày bắt đầu");
  expect(() => checkProjectDates(d("2026-08-25"), null)).not.toThrow();
  expect(() => checkTaskDates(d("2026-10-10"), d("2026-10-09"))).toThrow("Hạn chót không được trước ngày bắt đầu");
  expect(() => checkTaskDates(d("2026-10-10"), d("2026-10-10"))).not.toThrow();
});
