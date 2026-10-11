import { TZDate } from "@date-fns/tz";
import { endOfDay } from "date-fns";
import { APP_TIMEZONE } from "./period";
import { shiftWorkPeriod, workPeriodOf } from "./work-report";

export const DEADLINE_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "this-week", label: "Tuần này" },
  { value: "next-week", label: "Tuần tới" },
  { value: "next-month", label: "Tháng tới" },
] as const;
export type DeadlineFilter = (typeof DEADLINE_FILTERS)[number]["value"];

export function parseDeadlineFilter(value?: string | null): DeadlineFilter {
  return DEADLINE_FILTERS.find((option) => option.value === value)?.value ?? "all";
}

/** Calendar periods in the business timezone, shared with weekly work reports. */
export function taskDeadlinePeriods(now: Date) {
  const week = workPeriodOf("WEEK", now);
  return {
    "this-week": week,
    "next-week": shiftWorkPeriod(week, 1),
    "next-month": shiftWorkPeriod(workPeriodOf("MONTH", now), 1),
  };
}

export type DeadlineBucket = "overdue" | "today" | "week" | "later" | "none" | "done";

export function taskDeadlineBucket(
  task: { status: string; dueDate: string | null },
  now: Date,
  filter: DeadlineFilter = "all",
): DeadlineBucket {
  if (task.status === "DONE") return "done";
  if (!task.dueDate) return "none";
  const due = new Date(task.dueDate).getTime();
  if (!Number.isFinite(due)) return "none";
  if (due < now.getTime()) return "overdue";
  if (due <= endOfDay(new TZDate(now.getTime(), APP_TIMEZONE)).getTime()) return "today";
  if (filter === "all" && due - now.getTime() <= 7 * 86_400_000) return "week";
  return "later";
}
