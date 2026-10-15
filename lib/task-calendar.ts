// Month calendar of "Công việc của tôi": which days get a green (done) or red (deadline)
// dot. Pure, so the API route, the page and tests share it.

import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE } from "./period";
import { zonedDay } from "./work-report";

export interface CalendarTask {
  id: string;
  title: string;
  status: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  project: { id: string; name: string; color: string };
}

export interface CalendarDay {
  /** "YYYY-MM-DD" in Vietnam time. */
  day: string;
  inMonth: boolean;
  today: boolean;
  /** Finished on this day. */
  done: CalendarTask[];
  /** Not finished and due on this day. */
  due: CalendarTask[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10" if valid, else null. */
export function parseMonth(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && year <= 2200 ? value : null;
}

export const monthOf = (instant: Date | string) => zonedDay(instant).slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** First and last instant of the month in Vietnam time. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new TZDate(y, m - 1, 1, APP_TIMEZONE);
  const next = new TZDate(y, m, 1, APP_TIMEZONE);
  return { start: new Date(start.getTime()), end: new Date(next.getTime() - 1) };
}

/**
 * The weeks (Monday first) covering the month, each day with the tasks finished on it
 * and the unfinished tasks due on it. Work in progress has no dot of its own: it spans
 * every day until its deadline and would cover the whole month.
 */
export function calendarMonth(tasks: CalendarTask[], month: string, now: Date): CalendarDay[][] {
  const [y, m] = month.split("-").map(Number);
  const today = zonedDay(now);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // days shown from the previous month
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - lead);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);

  const byDay = new Map<string, CalendarDay>();
  const grid: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart);
      d.setUTCDate(gridStart.getUTCDate() + w * 7 + i);
      const day = d.toISOString().slice(0, 10);
      const cell: CalendarDay = { day, inMonth: day.startsWith(month), today: day === today, done: [], due: [] };
      byDay.set(day, cell);
      row.push(cell);
    }
    grid.push(row);
  }

  for (const task of tasks) {
    if (task.status === "DONE") {
      if (task.completedAt) byDay.get(zonedDay(task.completedAt))?.done.push(task);
    } else if (task.dueDate) {
      byDay.get(zonedDay(task.dueDate))?.due.push(task);
    }
  }
  return grid;
}
