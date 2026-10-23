import { describe, expect, it } from "vitest";
import {
  annualLeaveUsed,
  buildAttendanceMonth,
  dayCode,
  formatDays,
  isDay,
  leaveBalance,
  markableReason,
  monthDays,
  ownEditFrom,
  scheduledSessions,
  shiftMonth,
  weekdayOf,
} from "../lib/attendance";

const cell = (m: ReturnType<typeof buildAttendanceMonth>, day: string) => m.days.find((d) => d.day === day)!;

describe("attendance rules", () => {
  it("works Monday to Friday morning and afternoon, Saturday morning only", () => {
    // 19/10/2026 is a Monday.
    expect(["2026-10-19", "2026-10-24", "2026-10-25"].map(weekdayOf)).toEqual([1, 6, 7]);
    expect(scheduledSessions("2026-10-23")).toEqual(["AM", "PM"]);
    expect(scheduledSessions("2026-10-24")).toEqual(["AM"]);
    expect(scheduledSessions("2026-10-25")).toEqual([]);
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(isDay("2026-02-30")).toBe(false);
  });

  it("counts every scheduled session as worked unless marked, and leaves later days planned", () => {
    // October 2026: 22 weekdays and 5 Saturdays = 22 + 2.5 = 24.5 working days.
    const m = buildAttendanceMonth({
      month: "2026-10",
      today: "2026-10-23",
      holidays: [],
      marks: [
        { day: "2026-10-05", session: "AM", kind: "ANNUAL", note: "Đi khám" },
        { day: "2026-10-05", session: "PM", kind: "ANNUAL" },
        { day: "2026-10-06", session: "PM", kind: "SICK", note: "Sốt" },
        { day: "2026-10-10", session: "AM", kind: "BUSINESS" },
        { day: "2026-10-28", session: "AM", kind: "UNPAID" },
      ],
    });
    expect(m.totals.standard).toBe(24.5);
    // Up to 23/10: 17 weekdays + 3 Saturdays = 18.5 days, minus 1.5 days off (5/10, chiều 6/10).
    expect(m.totals.worked).toBe(17);
    expect(m.totals.leave).toEqual({ ANNUAL: 1, SICK: 0.5, PERSONAL: 0, UNPAID: 0.5, BUSINESS: 0.5 });
    expect(m.totals.paid).toBe(18);
    expect(dayCode(cell(m, "2026-10-05"))).toBe("P");
    expect(dayCode(cell(m, "2026-10-06"))).toBe("X/Ô");
    expect(dayCode(cell(m, "2026-10-10"))).toBe("CT");
    expect(dayCode(cell(m, "2026-10-11"))).toBe("");
    expect(dayCode(cell(m, "2026-10-27"))).toBe(""); // later: nothing to say yet
    expect(dayCode(cell(m, "2026-10-28"))).toBe("KL/·");
    expect(cell(m, "2026-10-06").sessions[1]).toMatchObject({ state: "marked", kind: "SICK", note: "Sốt" });
  });

  it("takes holidays out of the working days and pays them", () => {
    const m = buildAttendanceMonth({ month: "2026-09", today: "2026-09-30", holidays: [{ day: "2026-09-02", name: "Quốc khánh" }], marks: [] });
    expect(dayCode(cell(m, "2026-09-02"))).toBe("L");
    expect(cell(m, "2026-09-02").holiday).toBe("Quốc khánh");
    expect(dayCode(cell(m, "2026-09-05"))).toBe("X"); // Saturday morning
    // September 2026: 22 weekdays + 4 Saturdays = 24 days; the 2nd (Wednesday) is a holiday.
    expect(m.totals.standard).toBe(23);
    expect(m.totals.holidays).toBe(1);
    expect(m.totals.paid).toBe(24);
  });

  it("keeps the annual leave balance from the numbers set and the calendar", () => {
    const marks = [
      { day: "2026-03-02", session: "AM", kind: "ANNUAL" },
      { day: "2026-03-02", session: "PM", kind: "ANNUAL" },
      { day: "2026-03-07", session: "AM", kind: "ANNUAL" },
      { day: "2026-03-08", session: "AM", kind: "ANNUAL" }, // Sunday: ignored
      { day: "2026-04-30", session: "AM", kind: "ANNUAL" }, // holiday: ignored
      { day: "2026-11-02", session: "AM", kind: "SICK" },
      { day: "2026-11-03", session: "AM", kind: "ANNUAL" },
    ];
    const holidays = [{ day: "2026-04-30", name: "Giải phóng miền Nam" }];
    expect(annualLeaveUsed(marks, holidays)).toBe(2);
    expect(annualLeaveUsed(marks, holidays, "2026-10-31")).toBe(1.5);
    expect(leaveBalance(2026, null, 1.5)).toMatchObject({ entitlement: 12, carriedOver: 0, used: 1.5, remaining: 10.5 });
    expect(leaveBalance(2026, { entitlement: 14, carriedOver: 2.5 }, 3)).toMatchObject({ remaining: 13.5 });
    expect(formatDays(10.5)).toBe("10,5");
  });

  it("only takes marks on working sessions, and closes past months to their owner", () => {
    expect(markableReason("2026-10-25", "AM", [])).toMatch(/Chủ nhật/);
    expect(markableReason("2026-10-24", "PM", [])).toMatch(/Chiều thứ 7/);
    expect(markableReason("2026-09-02", "AM", [{ day: "2026-09-02", name: "Quốc khánh" }])).toMatch(/Quốc khánh/);
    expect(markableReason("2026-10-24", "AM", [])).toBeNull();
    expect(ownEditFrom("2026-10-23")).toBe("2026-10-01");
  });
});
