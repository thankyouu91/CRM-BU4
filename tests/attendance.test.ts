import { describe, expect, it } from "vitest";
import {
  annualLeaveUsed,
  buildAttendanceMonth,
  dayCode,
  dayKind,
  formatDays,
  isDay,
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

  // The company sample (TNS chấm công 06/2026), Saturday mornings added: June 2026 has
  // 22 weekdays and 4 Saturdays = 24 days.
  const day = (d: number) => `2026-06-${String(d).padStart(2, "0")}`;
  const full = (d: number, kind: string) => [{ day: day(d), session: "AM", kind }, { day: day(d), session: "PM", kind }];
  const june = (...marks: { day: string; session: string; kind: string }[][]) =>
    buildAttendanceMonth({ month: "2026-06", today: "2026-06-30", holidays: [], marks: marks.flat() });

  it("counts ngày công and ngày cơm like the company timesheet", () => {
    expect(june().totals).toMatchObject({ standard: 24, worked: 24, meals: 24 });
    // Tô Sanya Minh Kha: CT on 8 and 9 → 24 công, 22 cơm (sample without Saturdays: 22, 20).
    expect(june(full(8, "BUSINESS"), full(9, "BUSINESS")).totals).toMatchObject({ worked: 24, meals: 22 });
    // Võ Trần Long: X on 1, 12, 26 and CT on 8, 9 → 21 công, 19 cơm (sample: 19, 17).
    const long = june(full(1, "ANNUAL"), full(12, "ANNUAL"), full(26, "ANNUAL"), full(8, "BUSINESS"), full(9, "BUSINESS"));
    expect(long.totals).toMatchObject({ worked: 21, meals: 19 });
    expect(long.totals.leave).toMatchObject({ ANNUAL: 3, BUSINESS: 2 });
    // Phan Như Quỳnh: X on 2 and 26 → 22 công, 22 cơm (sample: 20, 20).
    expect(june(full(2, "ANNUAL"), full(26, "ANNUAL")).totals).toMatchObject({ worked: 22, meals: 22 });
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
    expect(dayCode(cell(m, day(6)))).toBe(""); // Saturday morning, worked
    expect(dayCode(cell(m, day(7)))).toBe(""); // Sunday
    expect(dayKind(cell(m, day(1)))).toBe("UNPAID");
    // 24 − 1 (X) − 0,5 (-) − 0,5 (- sáng 5/6) = 22; cơm also loses CT chiều 5/6 and ONL 10/6.
    expect(m.totals).toMatchObject({ worked: 22, meals: 20.5 });
    expect(m.totals.leave).toMatchObject({ UNPAID: 1, ANNUAL: 1, LATE_OK: 1, LATE: 1, ONLINE: 1 });
    // Có phép is paid, không phép is not: 22 + 1 = 23.
    expect(m.totals.paid).toBe(23);
  });

  it("counts work, meals and pay up to today only, lates once a day, and tells apart kinds sharing a symbol", () => {
    const at = (today: string, ...marks: { day: string; session: string; kind: string }[][]) =>
      buildAttendanceMonth({ month: "2026-06", today, holidays: [{ day: day(19), name: "Lễ" }], marks: marks.flat() });
    // Through 10/6: 8 weekdays + sáng thứ 7 6/6 = 8,5. A trip, a customer visit, a leave and a holiday after today add nothing yet.
    const ahead = at(day(10), full(15, "BUSINESS"), full(16, "CUSTOMER"), full(17, "ANNUAL"));
    expect(ahead.totals).toMatchObject({ worked: 8.5, meals: 8.5, paid: 8.5, holidays: 1 });
    expect(ahead.totals.leave).toMatchObject({ BUSINESS: 1, CUSTOMER: 1, ANNUAL: 1 });
    // Once the month is over they count: 23 − 1 (X 17/6) = 22 công, 21 cơm (CT), 22 + 1 (X) + 1 (lễ) hưởng lương.
    expect(at(day(30), full(15, "BUSINESS"), full(16, "CUSTOMER"), full(17, "ANNUAL")).totals).toMatchObject({ worked: 22, meals: 21, paid: 24 });

    const m = at(day(30), full(1, "LATE"), [{ day: day(2), session: "AM", kind: "LATE" }], [
      { day: day(3), session: "AM", kind: "ANNUAL" }, { day: day(3), session: "PM", kind: "UNPAID" },
      { day: day(4), session: "AM", kind: "CUSTOMER" }, { day: day(4), session: "PM", kind: "UNPAID" },
    ]);
    expect(m.totals.leave.LATE).toBe(2); // cả ngày 1/6 is one late, not two
    expect(dayCode(cell(m, day(3)))).toBe("-/-"); // not one blue X
    expect(dayCode(cell(m, day(4)))).toBe("KH/-");
    expect(dayKind(cell(m, day(4)))).toBe("UNPAID"); // the leave colours the cell
    const halves = at(day(30), [{ day: day(8), session: "PM", kind: "BUSINESS" }, { day: day(9), session: "AM", kind: "SICK" }, { day: day(10), session: "AM", kind: "LATE_OK" }]);
    expect([8, 9, 10].map((d) => dayCode(cell(halves, day(d))))).toEqual(["½CT", "½C", "#"]);
  });

  it("counts only the days between a person's start and last day", () => {
    // Joined Wednesday 10/6, left Friday 19/6: 8 weekdays + sáng thứ 7 13/6 = 8,5 công chuẩn.
    const m = buildAttendanceMonth({
      month: "2026-06", today: "2026-06-30", holidays: [], employment: { startDay: day(10), endDay: day(19) },
      marks: [...full(5, "ANNUAL"), ...full(12, "ANNUAL"), ...full(22, "UNPAID")],
    });
    expect(m.totals).toMatchObject({ standard: 8.5, worked: 7.5, paid: 8.5 });
    expect(m.totals.leave).toMatchObject({ ANNUAL: 1, UNPAID: 0 }); // 5/6 and 22/6 are outside
    expect(cell(m, day(9)).employed).toBe(false);
    expect(dayCode(cell(m, day(5)))).toBe("");
    expect(annualLeaveUsed([...full(5, "ANNUAL"), ...full(12, "ANNUAL")], [], undefined, { startDay: day(10) })).toBe(1);
    expect(markableReason(day(9), "AM", [], { startDay: day(10) })).toMatch(/Trước ngày vào làm 10\/06\/2026/);
    expect(markableReason(day(22), "AM", [], { endDay: day(19) })).toMatch(/Sau ngày nghỉ việc 19\/06\/2026/);
  });

  it("leaves later days planned and keeps holidays out of the working days", () => {
    const later = buildAttendanceMonth({ month: "2026-06", today: "2026-06-10", holidays: [], marks: [{ day: day(12), session: "AM", kind: "ANNUAL" }] });
    expect(later.totals).toMatchObject({ standard: 24, worked: 8.5, meals: 8.5 });
    expect(dayCode(cell(later, day(11)))).toBe("");
    expect(dayCode(cell(later, day(12)))).toBe("-");
    const m = buildAttendanceMonth({ month: "2026-09", today: "2026-09-30", holidays: [{ day: "2026-09-02", name: "Quốc khánh" }], marks: [] });
    expect(dayCode(cell(m, "2026-09-02"))).toBe("L");
    expect(cell(m, "2026-09-02").holiday).toBe("Quốc khánh");
    // September 2026: 22 weekdays + 4 Saturdays = 24 days; the 2nd (Wednesday) is a holiday.
    expect(m.totals).toMatchObject({ standard: 23, worked: 23, holidays: 1, paid: 24 });
  });

  it("counts annual leave taken on working sessions only", () => {
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

describe("who exports the month's timesheet", async () => {
  const { canExportTimesheet } = await import("../lib/attendance-access");
  const { effectivePermissions } = await import("../lib/permissions");
  const as = (role: string, granted: string[] = []) => ({ id: role, role, permissions: effectivePermissions(role, granted) });
  it("is managers and above, and whoever manages accounts", () => {
    expect(["ADMIN", "MANAGER", "LEAD", "MEMBER"].map((r) => canExportTimesheet(as(r)))).toEqual([true, true, false, false]);
    expect(canExportTimesheet(as("LEAD", ["USER_MANAGE"]))).toBe(true);
    expect(canExportTimesheet(as("MEMBER", ["PROJECT_CREATE"]))).toBe(false);
  });
});

describe("leave ledger: one day a month, overspending is deducted from pay", async () => {
  const { officialFrom, leaveLedger } = await import("../lib/attendance");
  const off = (d: string) => [{ day: d, session: "AM", kind: "ANNUAL" }, { day: d, session: "PM", kind: "ANNUAL" }];
  const at = (month: string, marks: { day: string; session: string; kind: string }[] = [], employment: { startDay?: string | null } | null = null, adjustments?: Map<number, { amount: number; note: string | null }>) =>
    leaveLedger({ month, marks, holidays: [], employment, adjustments });

  it("ends probation two months after the start day, on the same day of the month", () => {
    expect(officialFrom("2026-07-10")).toBe("2026-09-10");
    expect(officialFrom("2026-11-15")).toBe("2027-01-15");
    expect(officialFrom("2026-12-31")).toBe("2027-02-28"); // no 31/02
    expect(officialFrom("2027-12-31")).toBe("2028-02-29");
  });

  it("adds a day each month from the start of the ledger and carries what is left, over year ends too", () => {
    expect(at("2026-10")).toMatchObject({ opening: 0, earned: 0, remaining: 0 }); // before the ledger
    expect(at("2026-11")).toMatchObject({ opening: 0, earned: 1, used: 0, remaining: 1, negative: 0 });
    expect(at("2027-02")).toMatchObject({ opening: 3, earned: 1, remaining: 4 });
    expect(at("2027-02", [...off("2026-12-03")]).remaining).toBe(3); // one day in December: 1+1−1+1+1
  });

  it("reports a month that ends below zero as nghỉ âm, and starts the next month again from one day", () => {
    const marks = [...off("2026-11-03"), ...off("2026-11-04"), ...off("2026-11-05")]; // 3 days with 1 day earned
    expect(at("2026-11", marks)).toMatchObject({ opening: 0, earned: 1, used: 3, remaining: -2, negative: 2 });
    expect(at("2026-12", marks)).toMatchObject({ opening: 0, earned: 1, used: 0, remaining: 1, negative: 0 });
    // Half days count as halves.
    expect(at("2026-11", [{ day: "2026-11-03", session: "AM", kind: "ANNUAL" }])).toMatchObject({ used: 0.5, remaining: 0.5 });
  });

  it("gives nothing on probation: leave then is that month's nghỉ âm", () => {
    const kimmy = { startDay: "2026-11-15" }; // probation to 14/01/2027
    expect(at("2026-11", [], kimmy)).toMatchObject({ earned: 0, remaining: 0, officialFrom: "2027-01-15" });
    expect(at("2026-12", [...off("2026-12-10")], kimmy)).toMatchObject({ earned: 0, used: 1, remaining: -1, negative: 1 });
    // January: probation ends on the 15th, so the month earns its day; February adds another.
    expect(at("2027-01", [...off("2026-12-10")], kimmy)).toMatchObject({ opening: 0, earned: 1, remaining: 1, officialFrom: "2027-01-15" });
    expect(at("2027-02", [...off("2026-12-10")], kimmy)).toMatchObject({ opening: 1, earned: 1, remaining: 2, officialFrom: null });
    // Someone who joins later starts their ledger in their own month.
    expect(at("2027-03", [], { startDay: "2027-03-02" })).toMatchObject({ earned: 0, remaining: 0 });
  });

  it("adds HR's adjustment in the year's first month of the ledger", () => {
    const adj = new Map([[2026, { amount: 4, note: "Phép tồn trước khi dùng sổ" }], [2027, { amount: -1, note: null }]]);
    expect(at("2026-11", [], null, adj)).toMatchObject({ opening: 0, earned: 1, adjustment: 4, remaining: 5, yearAdjustment: 4, note: "Phép tồn trước khi dùng sổ" });
    expect(at("2026-12", [], null, adj)).toMatchObject({ opening: 5, adjustment: 0, remaining: 6 });
    expect(at("2027-01", [], null, adj)).toMatchObject({ opening: 6, adjustment: -1, remaining: 6, yearAdjustment: -1 });
  });
});
