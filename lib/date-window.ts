// Warn (never block) when a task's dates fall outside its project's or category's.
// Pure: shared by the task create form and the task drawer.

import { zonedDay } from "./work-report";

export interface DateWindow {
  /** "dự án" or "hạng mục". */
  kind: string;
  name: string;
  startDate: string | null | undefined;
  dueDate: string | null | undefined;
}

const day = (v: string | null | undefined) => (!v ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : zonedDay(v));
const show = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * One line per window the task leaves, compared by calendar day in Vietnam time, e.g.
 * `Hạn chót sau hạn của dự án “A” (16/10/2026)`. Task dates may be "YYYY-MM-DD" or ISO.
 */
export function outsideWindows(start: string | null | undefined, due: string | null | undefined, windows: DateWindow[]): string[] {
  const s = day(start);
  const d = day(due);
  const out: string[] = [];
  for (const w of windows) {
    const ws = day(w.startDate);
    const wd = day(w.dueDate);
    if (s && ws && s < ws) out.push(`Ngày bắt đầu trước ngày bắt đầu của ${w.kind} “${w.name}” (${show(ws)})`);
    if (d && wd && d > wd) out.push(`Hạn chót sau hạn của ${w.kind} “${w.name}” (${show(wd)})`);
    else if (!d && s && wd && s > wd) out.push(`Ngày bắt đầu sau hạn của ${w.kind} “${w.name}” (${show(wd)})`);
  }
  return out;
}
