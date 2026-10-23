// Chấm công (timekeeping): the rules, no database. Everyone works every scheduled
// session (Monday to Friday morning and afternoon, Saturday morning) unless a session
// is marked otherwise; only those marks are stored (AttendanceMark). Days are
// "YYYY-MM-DD" in APP_TIMEZONE, so the arithmetic below needs no time zone.
// Shared by the API, the attendance page, the Excel export and the tests.

export const SESSIONS = ["AM", "PM"] as const;
export type Session = (typeof SESSIONS)[number];
export const SESSION_LABEL: Record<Session, string> = { AM: "Sáng", PM: "Chiều" };

export const WORK_SCHEDULE_TEXT = "Thứ 2 – thứ 6: sáng và chiều · Thứ 7: buổi sáng (8:00 – 12:00) · Chủ nhật nghỉ";

/**
 * What a session can be marked as. code: the symbol on the timesheet (X = đi làm,
 * L = lễ). worked: counts as a session worked; paid: counts toward paid sessions;
 * annual: uses annual leave.
 */
export const LEAVE_KINDS = {
  ANNUAL: { label: "Nghỉ phép năm", short: "Phép năm", code: "P", worked: false, paid: true, annual: true },
  SICK: { label: "Nghỉ ốm", short: "Ốm", code: "Ô", worked: false, paid: false, annual: false },
  PERSONAL: { label: "Việc riêng có lương (cưới, tang…)", short: "Việc riêng", code: "R", worked: false, paid: true, annual: false },
  UNPAID: { label: "Nghỉ không lương", short: "Không lương", code: "KL", worked: false, paid: false, annual: false },
  BUSINESS: { label: "Công tác / làm việc bên ngoài", short: "Công tác", code: "CT", worked: true, paid: true, annual: false },
} as const;
export type LeaveKind = keyof typeof LEAVE_KINDS;
export const LEAVE_KIND_KEYS = Object.keys(LEAVE_KINDS) as LeaveKind[];
export const isLeaveKind = (v: unknown): v is LeaveKind => typeof v === "string" && v in LEAVE_KINDS;

/** Annual leave a person gets when nobody has set another number (Bộ luật Lao động, Điều 113). */
export const DEFAULT_ANNUAL_DAYS = 12;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

export const isMonth = (value: unknown): value is string => typeof value === "string" && MONTH.test(value);

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** The sessions the schedule has on a day, holidays aside. */
export function scheduledSessions(day: string): Session[] {
  const w = weekdayOf(day);
  if (w === 7) return [];
  if (w === 6) return ["AM"];
  return ["AM", "PM"];
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

export const monthOfDay = (day: string) => day.slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

export const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

export interface MarkInput {
  day: string;
  session: Session | string;
  kind: LeaveKind | string;
  note?: string | null;
}

export interface HolidayInput {
  day: string;
  name: string;
}

export type SessionState =
  /** Not a working session: Sunday, Saturday afternoon. */
  | "off"
  | "holiday"
  /** Worked (the default), today or earlier. */
  | "work"
  /** Later in the month: worked unless marked otherwise. */
  | "planned"
  | "marked";

export interface SessionCell {
  session: Session;
  state: SessionState;
  kind: LeaveKind | null;
  note: string | null;
}

export interface DayCell {
  day: string;
  weekday: number;
  holiday: string | null;
  sessions: SessionCell[];
}

/** Days (in halves) of each kind of session in a month. */
export interface MonthTotals {
  /** Công chuẩn: working sessions of the month, holidays excluded. */
  standard: number;
  /** Đi làm: worked sessions up to today, plus business trips. */
  worked: number;
  holidays: number;
  leave: Record<LeaveKind, number>;
  /** Công hưởng lương: worked + paid leave + holidays. */
  paid: number;
}

export interface AttendanceMonth {
  month: string;
  days: DayCell[];
  totals: MonthTotals;
}

const half = (sessions: number) => sessions / 2;

/** The month of one person. Days after today are "planned": not counted as worked yet. */
export function buildAttendanceMonth(opts: { month: string; marks: MarkInput[]; holidays: HolidayInput[]; today: string }): AttendanceMonth {
  const holidays = new Map(opts.holidays.map((h) => [h.day, h.name]));
  const marks = new Map(opts.marks.filter((m) => isLeaveKind(m.kind)).map((m) => [`${m.day}|${m.session}`, m]));
  const count = { standard: 0, worked: 0, holidays: 0 };
  const leave = Object.fromEntries(LEAVE_KIND_KEYS.map((k) => [k, 0])) as Record<LeaveKind, number>;

  const days = monthDays(opts.month).map((day): DayCell => {
    const holiday = holidays.get(day) ?? null;
    const scheduled = scheduledSessions(day);
    const sessions = SESSIONS.map((session): SessionCell => {
      if (!scheduled.includes(session)) return { session, state: "off", kind: null, note: null };
      if (holiday) {
        count.holidays++;
        return { session, state: "holiday", kind: null, note: null };
      }
      count.standard++;
      const mark = marks.get(`${day}|${session}`);
      if (mark) {
        const kind = mark.kind as LeaveKind;
        leave[kind]++;
        if (LEAVE_KINDS[kind].worked) count.worked++;
        return { session, state: "marked", kind, note: mark.note ?? null };
      }
      if (day > opts.today) return { session, state: "planned", kind: null, note: null };
      count.worked++;
      return { session, state: "work", kind: null, note: null };
    });
    return { day, weekday: weekdayOf(day), holiday, sessions };
  });

  const paidLeave = LEAVE_KIND_KEYS.filter((k) => LEAVE_KINDS[k].paid && !LEAVE_KINDS[k].worked).reduce((s, k) => s + leave[k], 0);
  return {
    month: opts.month,
    days,
    totals: {
      standard: half(count.standard),
      worked: half(count.worked),
      holidays: half(count.holidays),
      leave: Object.fromEntries(LEAVE_KIND_KEYS.map((k) => [k, half(leave[k])])) as Record<LeaveKind, number>,
      paid: half(count.worked + paidLeave + count.holidays),
    },
  };
}

/** Annual leave used: marked sessions on working days, holidays aside, in days. */
export function annualLeaveUsed(marks: MarkInput[], holidays: HolidayInput[], through?: string): number {
  const off = new Set(holidays.map((h) => h.day));
  const sessions = marks.filter(
    (m) => m.kind === "ANNUAL" && !off.has(m.day) && (scheduledSessions(m.day) as string[]).includes(m.session) && (!through || m.day <= through),
  ).length;
  return half(sessions);
}

export interface LeaveBalanceView {
  year: number;
  /** Được hưởng trong năm (set by a manager). */
  entitlement: number;
  /** Tồn năm trước chuyển sang (set by a manager). */
  carriedOver: number;
  /** Đã nghỉ / đã đăng ký: from the calendar. */
  used: number;
  /** Còn lại: entitlement + carried over − used. */
  remaining: number;
  note: string | null;
}

export function leaveBalance(year: number, row: { entitlement: number; carriedOver: number; note?: string | null } | null, used: number): LeaveBalanceView {
  const entitlement = row?.entitlement ?? DEFAULT_ANNUAL_DAYS;
  const carriedOver = row?.carriedOver ?? 0;
  return { year, entitlement, carriedOver, used, remaining: Math.round((entitlement + carriedOver - used) * 10) / 10, note: row?.note ?? null };
}

/** Days are whole or half: 1, 1.5, 0.5. */
export const formatDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/** The symbol of a session on the timesheet; empty when there is nothing to say yet. */
export function sessionCode(c: SessionCell): string {
  switch (c.state) {
    case "work":
      return "X";
    case "holiday":
      return "L";
    case "marked":
      return LEAVE_KINDS[c.kind!].code;
    default:
      return "";
  }
}

/** One timesheet cell per day: "X", "P", or "X/P" when the morning and afternoon differ. */
export function dayCode(d: DayCell): string {
  const codes = d.sessions.filter((s) => s.state !== "off").map(sessionCode);
  if (!codes.length) return "";
  if (codes.length === 1 || codes[0] === codes[1]) return codes[0];
  return `${codes[0] || "·"}/${codes[1] || "·"}`;
}

/**
 * Whether a session can be marked: a scheduled session on a day that is not a holiday.
 * Returns the reason when it cannot.
 */
export function markableReason(day: string, session: string, holidays: HolidayInput[]): string | null {
  if (!isDay(day)) return "Ngày không hợp lệ";
  if (!(SESSIONS as readonly string[]).includes(session)) return "Buổi không hợp lệ";
  if (!(scheduledSessions(day) as string[]).includes(session)) return weekdayOf(day) === 7 ? "Chủ nhật không phải ngày làm việc" : "Chiều thứ 7 không phải buổi làm việc";
  const h = holidays.find((x) => x.day === day);
  if (h) return `Ngày ${h.name} là ngày nghỉ lễ`;
  return null;
}

/**
 * People change their own marks from the first day of the current month on; earlier
 * months are closed for them (a manager can still correct them).
 */
export const ownEditFrom = (today: string) => `${monthOfDay(today)}-01`;
