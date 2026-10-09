import { TZDate } from "@date-fns/tz";
import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";

export type PeriodType = "day" | "month" | "quarter" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

/**
 * Business timezone for period boundaries ("Tháng 10" = 1 Oct 00:00 → 31 Oct 23:59
 * in this zone), independent of the server's own timezone.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Ho_Chi_Minh";

const inZone = (d: Date) => new TZDate(d, APP_TIMEZONE);
const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * Resolve a period (day/month/quarter/year) plus an anchor instant into a
 * concrete [from, to] range with a Vietnamese label. "custom" uses from/to.
 * Returned dates are TZDate (a Date subclass) so later date-fns calls stay in-zone.
 */
export function resolvePeriod(
  type: PeriodType,
  anchorInstant: Date = new Date(),
  custom?: { from?: Date | null; to?: Date | null },
): DateRange {
  const anchor = inZone(anchorInstant);
  switch (type) {
    case "day":
      return { from: startOfDay(anchor), to: endOfDay(anchor), label: `Ngày ${dmy(anchor)}` };
    case "month":
      return {
        from: startOfMonth(anchor),
        to: endOfMonth(anchor),
        label: `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}`,
      };
    case "quarter":
      return {
        from: startOfQuarter(anchor),
        to: endOfQuarter(anchor),
        label: `Quý ${Math.floor(anchor.getMonth() / 3) + 1}/${anchor.getFullYear()}`,
      };
    case "year":
      return { from: startOfYear(anchor), to: endOfYear(anchor), label: `Năm ${anchor.getFullYear()}` };
    case "custom": {
      let a = custom?.from ? inZone(custom.from) : startOfMonth(anchor);
      let b = custom?.to ? inZone(custom.to) : endOfMonth(anchor);
      if (a > b) [a, b] = [b, a];
      const from = startOfDay(a);
      const to = endOfDay(b);
      return { from, to, label: `${dmy(from)} - ${dmy(to)}` };
    }
    default:
      return resolvePeriod("month", anchorInstant);
  }
}

export function parsePeriodType(value: string | null | undefined): PeriodType {
  if (value === "day" || value === "month" || value === "quarter" || value === "year" || value === "custom") {
    return value;
  }
  return "month";
}

/**
 * Parse a query-string date. "yyyy-mm-dd" is a calendar date in APP_TIMEZONE;
 * anything else is parsed as an ISO instant. Falls back to now().
 */
export function parseDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, APP_TIMEZONE);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
