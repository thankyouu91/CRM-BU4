import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, eachDayOfInterval, eachMonthOfInterval, startOfDay } from "date-fns";
import { APP_TIMEZONE, parseDate, resolvePeriod } from "./period";

export type CalendarView = "month" | "quarter" | "year";
export interface ProjectTiming { start: number; end: number; kind: "range" | "deadline" | "open" }
const zoned = (date: Date) => new TZDate(date, APP_TIMEZONE);

export function calendarSelection(view: string | undefined, month: string | undefined, now: string) {
  const validView: CalendarView = view === "quarter" || view === "year" ? view : "month";
  const validMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900 && Number(month.slice(0, 4)) <= 2200;
  return { view: validView, anchor: validMonth ? `${month}-01` : now };
}

export function calendarPeriod(view: CalendarView, anchor: string) {
  const range = resolvePeriod(view, parseDate(anchor));
  const until = addDays(startOfDay(range.to), 1);
  const duration = until.getTime() - range.from.getTime();
  const dates = view === "month" ? eachDayOfInterval({ start: range.from, end: range.to }) : eachMonthOfInterval({ start: range.from, end: range.to });
  const columns = dates.map((date) => {
    const end = view === "month" ? addDays(date, 1) : addMonths(date, 1);
    return {
      key: date.toISOString(), label: view === "month" ? String(date.getDate()) : `Tháng ${date.getMonth() + 1}`,
      detail: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()],
      weekend: view === "month" && (date.getDay() === 0 || date.getDay() === 6),
      left: (date.getTime() - range.from.getTime()) / duration * 100,
      width: (end.getTime() - date.getTime()) / duration * 100,
    };
  });
  return { ...range, until, duration, columns, key: `${range.from.getFullYear()}-${String(range.from.getMonth() + 1).padStart(2, "0")}` };
}
export type CalendarPeriod = ReturnType<typeof calendarPeriod>;

export function moveCalendar(view: CalendarView, anchor: string, direction: number): string {
  const period = calendarPeriod(view, anchor);
  return addMonths(period.from, direction * (view === "year" ? 12 : view === "quarter" ? 3 : 1)).toISOString();
}

/** Only supplied business dates determine scheduling; createdAt is never invented as a start. */
export function projectTiming(project: { startDate: string | null; dueDate: string | null }): ProjectTiming | null {
  const day = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : startOfDay(zoned(parseDate(value))).getTime();
  };
  const start = day(project.startDate);
  const due = day(project.dueDate);
  if ((project.startDate && start === null) || (project.dueDate && due === null)) return null;
  if (start === null && due === null) return null;
  if (start !== null && due !== null && due < start) return null;
  return {
    start: start ?? due!,
    end: due === null ? Infinity : addDays(zoned(new Date(due)), 1).getTime(),
    kind: start === null ? "deadline" : due === null ? "open" : "range",
  };
}

export function timelineSpan(timing: ProjectTiming, period: CalendarPeriod) {
  const from = period.from.getTime();
  const until = period.until.getTime();
  if (timing.start >= until || timing.end <= from) return null;
  const left = (Math.max(timing.start, from) - from) / period.duration * 100;
  const right = (Math.min(timing.end, until) - from) / period.duration * 100;
  return { left, width: right - left, continuesBefore: timing.start < from, continuesAfter: timing.end > until };
}

export function calendarDate(value: string, short = false): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", ...(short ? {} : { year: "numeric" }) }).format(new Date(value));
}

export function calendarToday(now: string, period: CalendarPeriod): number | null {
  const day = startOfDay(zoned(new Date(now)));
  const middle = (day.getTime() + addDays(day, 1).getTime()) / 2;
  return middle >= period.from.getTime() && middle < period.until.getTime() ? (middle - period.from.getTime()) / period.duration * 100 : null;
}
