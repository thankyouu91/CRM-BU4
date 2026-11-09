import { describe, expect, it } from "vitest";
import {
  annualLeaveUsed,
  buildAttendanceMonth,
  dayCode,
  dayKind,
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
  it("works Monday to Friday morning and afternoon; Saturday and Sunday are off", () => {
    // 19/10/2026 is a Monday.
    expect(["2026-10-19", "2026-10-24", "2026-10-25"].map(weekdayOf)).toEqual([1, 6, 7]);
    expect(scheduledSessions("2026-10-23")).toEqual(["AM", "PM"]);
    expect(scheduledSessions("2026-10-24")).toEqual([]);
    expect(scheduledSessions("2026-10-25")).toEqual([]);
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(isDay("2026-02-30")).toBe(false);
  });

  // The company sample (TNS chấm công 06/2026): June 2026 has 22 weekdays.
  const day = (d: number) => `2026-06-${String(d).padStart(2, "0")}`;
  const full = (d: number, kind: string) => [{ day: day(d), session: "AM", kind }, { day: day(d), session: "PM", kind }];
  const june = (...marks: { day: string; session: string; kind: string }[][]) =>
    buildAttendanceMonth({ month: "2026-06", today: "2026-06-30", holidays: [], marks: marks.flat() });

  it("counts ngày công and ngày cơm like the company timesheet", () => {
    expect(june().totals).toMatchObject({ standard: 22, worked: 22, meals: 22 });
    // Tô Sanya Minh Kha: CT on 8 and 9 → 22 công, 20 cơm.
    expect(june(full(8, "BUSINESS"), full(9, "BUSINESS")).totals).toMatchObject({ worked: 22, meals: 20 });
    // Võ Trần Long: X on 1, 12, 26 and CT on 8, 9 → 19 công, 17 cơm.
    const long = june(full(1, "ANNUAL"), full(12, "ANNUAL"), full(26, "ANNUAL"), full(8, "BUSINESS"), full(9, "BUSINESS"));
    expect(long.totals).toMatchObject({ worked: 19, meals: 17 });
    expect(long.totals.leave).toMatchObject({ ANNUAL: 3, BUSINESS: 2 });
    // Phan Như Quỳnh: X on 2 and 26 → 20 công, 20 cơm.
    expect(june(full(2, "ANNUAL"), full(26, "ANNUAL")).totals).toMatchObject({ worked: 20, meals: 20 });
  });

  it("writes the company symbols: blank worked, X a day, - half a day, # ? lates counted in times", () => {
    const m = june(
      full(1, "UNPAID"),
      [{ day: day(2), session: "PM", kind: "ANNUAL" }],
      [{ day: day(3), session: "AM", kind: "LATE_OK" }, { day: day(4), session: "AM", kind: "LATE" }],
      [{ day: day(5), session: "AM", kind: "ANNUAL" }, { day: day(5), session: "PM", kind: "BUSINESS" }],
      full(10, "ONLINE"),
    );
    expect(dayCode(cell(m, day(1)))).toBe("X");
    expect(dayCode(cell(m, day(2)))).toBe("-");
    expect(dayCode(cell(m, day(3)))).toBe("#");
    expect(dayCode(cell(m, day(4)))).toBe("?");
    expect(dayCode(cell(m, day(5)))).toBe("-/CT");
    expect(dayCode(cell(m, day(10)))).toBe("ONL");
    expect(dayCode(cell(m, day(11)))).toBe("");
    expect(dayCode(cell(m, day(6)))).toBe(""); // Saturday
    expect(dayKind(cell(m, day(1)))).toBe("UNPAID");
    // 22 − 1 (X) − 0,5 (-) − 0,5 (- sáng 5/6) = 20; cơm also loses CT chiều 5/6 and ONL 10/6.
    expect(m.totals).toMatchObject({ worked: 20, meals: 18.5 });
    expect(m.totals.leave).toMatchObject({ UNPAID: 1, ANNUAL: 1, LATE_OK: 1, LATE: 1, ONLINE: 1 });
    // Có phép is paid, không phép is not: 20 + 1 = 21.
    expect(m.totals.paid).toBe(21);
  });

  it("leaves later days planned and keeps holidays out of the working days", () => {
    const later = buildAttendanceMonth({ month: "2026-06", today: "2026-06-10", holidays: [], marks: [{ day: day(12), session: "AM", kind: "ANNUAL" }] });
    expect(later.totals).toMatchObject({ standard: 22, worked: 8, meals: 8 });
    expect(dayCode(cell(later, day(11)))).toBe("");
    expect(dayCode(cell(later, day(12)))).toBe("-");
    const m = buildAttendanceMonth({ month: "2026-09", today: "2026-09-30", holidays: [{ day: "2026-09-02", name: "Quốc khánh" }], marks: [] });
    expect(dayCode(cell(m, "2026-09-02"))).toBe("L");
    expect(cell(m, "2026-09-02").holiday).toBe("Quốc khánh");
    // September 2026: 22 weekdays; the 2nd (Wednesday) is a holiday.
    expect(m.totals).toMatchObject({ standard: 21, worked: 21, holidays: 1, paid: 22 });
  });

  it("keeps the annual leave balance from the numbers set and the calendar", () => {
    const marks = [
      { day: "2026-03-02", session: "AM", kind: "ANNUAL" },
      { day: "2026-03-02", session: "PM", kind: "ANNUAL" },
      { day: "2026-03-07", session: "AM", kind: "ANNUAL" }, // Saturday: ignored
      { day: "2026-03-08", session: "AM", kind: "ANNUAL" }, // Sunday: ignored
      { day: "2026-04-30", session: "AM", kind: "ANNUAL" }, // holiday: ignored
      { day: "2026-11-02", session: "AM", kind: "SICK" },
      { day: "2026-11-03", session: "AM", kind: "ANNUAL" },
    ];
    const holidays = [{ day: "2026-04-30", name: "Giải phóng miền Nam" }];
    expect(annualLeaveUsed(marks, holidays)).toBe(1.5);
    expect(annualLeaveUsed(marks, holidays, "2026-10-31")).toBe(1);
    expect(leaveBalance(2026, null, 1.5)).toMatchObject({ entitlement: 12, carriedOver: 0, used: 1.5, remaining: 10.5 });
    expect(leaveBalance(2026, { entitlement: 14, carriedOver: 2.5 }, 3)).toMatchObject({ remaining: 13.5 });
    expect(formatDays(10.5)).toBe("10,5");
  });

  it("only takes marks on working sessions, and closes past months to their owner", () => {
    expect(markableReason("2026-10-25", "AM", [])).toMatch(/Chủ nhật/);
    expect(markableReason("2026-10-24", "AM", [])).toMatch(/Thứ 7/);
    expect(markableReason("2026-09-02", "AM", [{ day: "2026-09-02", name: "Quốc khánh" }])).toMatch(/Quốc khánh/);
    expect(markableReason("2026-10-23", "AM", [])).toBeNull();
    expect(ownEditFrom("2026-10-23")).toBe("2026-10-01");
  });
});
