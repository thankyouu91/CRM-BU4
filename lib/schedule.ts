// Progress against deadline (shared by server and UI; no server-only imports).
//
// planned = share of the scheduled time already elapsed (start -> due), i.e. the
// completion you would expect today if work progressed evenly. Comparing it with
// actual completion tells whether an item is on schedule.

const DAY = 86_400_000;

export type ScheduleStatus = "DONE" | "ON_TRACK" | "AT_RISK" | "BEHIND" | "OVERDUE" | "NO_DEADLINE";

export interface Schedule {
  status: ScheduleStatus;
  /** Expected completion today if work progressed evenly; null without a deadline. */
  planned: number | null;
  /** actual / planned as a %, capped at 999; null when nothing was planned yet. */
  achievement: number | null;
  /** actual - planned, in percentage points. */
  variance: number | null;
  /** Whole days until the deadline (negative = days late); null without a deadline. */
  daysLeft: number | null;
}

/** Points behind plan still counted as on track / at risk. */
export const ON_TRACK_TOLERANCE = 10;
export const AT_RISK_TOLERANCE = 25;

export const SCHEDULE_STATUS: Record<ScheduleStatus, { label: string; color: string; bg: string }> = {
  DONE: { label: "Hoàn thành", color: "#1baf7a", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  ON_TRACK: { label: "Đúng tiến độ", color: "#2a78d6", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  AT_RISK: { label: "Có rủi ro", color: "#eda100", bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  BEHIND: { label: "Chậm tiến độ", color: "#eb6834", bg: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  OVERDUE: { label: "Trễ hạn", color: "#d03b3b", bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  NO_DEADLINE: { label: "Chưa có hạn", color: "#94a3b8", bg: "bg-muted text-muted-foreground" },
};

type Dateish = Date | string | null | undefined;
const ms = (d: Dateish) => (d == null ? null : new Date(d).getTime());

/**
 * @param start  scheduled start (falls back to `fallbackStart`, e.g. creation time)
 * @param due    deadline
 * @param actual current completion 0-100
 * @param finished whether every piece of work is closed; 100% progress still
 *                 awaiting approval is not finished (defaults to actual >= 100)
 */
export function scheduleOf(input: {
  start: Dateish;
  fallbackStart?: Dateish;
  due: Dateish;
  actual: number;
  finished?: boolean;
  now?: Date;
}): Schedule {
  const now = (input.now ?? new Date()).getTime();
  const due = ms(input.due);
  const actual = Math.max(0, Math.min(100, input.actual));
  const finished = input.finished ?? actual >= 100;
  if (due === null) {
    return { status: finished ? "DONE" : "NO_DEADLINE", planned: null, achievement: null, variance: null, daysLeft: null };
  }
  const daysLeft = Math.ceil((due - now) / DAY);
  if (finished) return { status: "DONE", planned: 100, achievement: 100, variance: 0, daysLeft };

  const start = ms(input.start) ?? ms(input.fallbackStart) ?? due;
  let planned: number;
  if (now >= due) planned = 100;
  else if (now <= start || due <= start) planned = 0;
  else planned = Math.round(((now - start) / (due - start)) * 100);

  const variance = actual - planned;
  const achievement = planned > 0 ? Math.min(999, Math.round((actual / planned) * 100)) : null;
  const status: ScheduleStatus =
    now > due ? "OVERDUE" : variance >= -ON_TRACK_TOLERANCE ? "ON_TRACK" : variance >= -AT_RISK_TOLERANCE ? "AT_RISK" : "BEHIND";
  return { status, planned, achievement, variance, daysLeft };
}

/** "còn 5 ngày" / "hôm nay" / "trễ 2 ngày". */
export function daysLeftLabel(daysLeft: number | null): string {
  if (daysLeft === null) return "Chưa có hạn";
  if (daysLeft > 0) return `còn ${daysLeft} ngày`;
  if (daysLeft === 0) return "đến hạn hôm nay";
  return `trễ ${-daysLeft} ngày`;
}

/** Work volume of a set of tasks: what is finished and what still has to be done. */
export interface Workload {
  total: number;
  done: number;
  /** Everything not finished = notStarted + inProgress + blocked (overdue is a subset). */
  remaining: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
  /** Unfinished and past their due date. */
  overdue: number;
}

export function workloadOf(tasks: { status: string; dueDate: Dateish }[], now: Date = new Date()): Workload {
  const w: Workload = { total: tasks.length, done: 0, remaining: 0, inProgress: 0, notStarted: 0, blocked: 0, overdue: 0 };
  const t0 = now.getTime();
  for (const t of tasks) {
    if (t.status === "DONE") {
      w.done += 1;
      continue;
    }
    w.remaining += 1;
    if (t.status === "IN_PROGRESS" || t.status === "REVIEW") w.inProgress += 1;
    else if (t.status === "BLOCKED") w.blocked += 1;
    else w.notStarted += 1;
    const due = ms(t.dueDate);
    if (due !== null && due < t0) w.overdue += 1;
  }
  return w;
}
