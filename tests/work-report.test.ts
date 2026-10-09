import { describe, expect, it } from "vitest";
import {
  emptyNotes,
  parseWorkPeriodType,
  readSnapshot,
  resolveWorkPeriod,
  sameNotes,
  shiftWorkPeriod,
  takeSnapshot,
  workPeriodFromKey,
  workPeriodOf,
} from "@/lib/work-report";

// Vietnam is UTC+7 with no daylight saving.
const utc = (iso: string) => new Date(iso);

describe("workPeriodOf (week)", () => {
  it("returns the ISO week in Vietnam time", () => {
    const p = workPeriodOf("WEEK", utc("2026-10-08T03:00:00Z"));
    expect(p).toEqual({
      type: "WEEK",
      key: "2026-W41",
      start: utc("2026-10-04T17:00:00.000Z"), // Mon 05/10 00:00 +07
      end: utc("2026-10-11T16:59:59.999Z"), // Sun 11/10 23:59:59.999 +07
      label: "Tuần 41 · 05/10 – 11/10/2026",
      short: "Tuần 41",
    });
  });

  it("returns plain Dates", () => {
    const p = workPeriodOf("WEEK", utc("2026-10-08T03:00:00Z"));
    expect(p.start.constructor).toBe(Date);
    expect(p.end.constructor).toBe(Date);
  });

  it("keeps Sunday late night in the same week (UTC already says Sunday afternoon)", () => {
    expect(workPeriodOf("WEEK", utc("2026-10-11T16:59:59.999Z")).key).toBe("2026-W41");
    expect(workPeriodOf("WEEK", utc("2026-10-11T16:30:00Z")).key).toBe("2026-W41");
  });

  it("moves to the next week at Monday 00:00 Vietnam time, while UTC is still Sunday", () => {
    const p = workPeriodOf("WEEK", utc("2026-10-11T17:00:00Z"));
    expect(p.key).toBe("2026-W42");
    expect(p.start).toEqual(utc("2026-10-11T17:00:00.000Z"));
  });

  it("uses the ISO week-year across New Year, with the year on both ends of the label", () => {
    const p = workPeriodOf("WEEK", utc("2027-01-02T05:00:00Z"));
    expect(p.key).toBe("2026-W53");
    expect(p.label).toBe("Tuần 53 · 28/12/2026 – 03/01/2027");
    expect(p.start).toEqual(utc("2026-12-27T17:00:00.000Z"));
    expect(p.end).toEqual(utc("2027-01-03T16:59:59.999Z"));
  });
});

describe("workPeriodOf (month)", () => {
  it("returns the calendar month in Vietnam time", () => {
    expect(workPeriodOf("MONTH", utc("2026-10-15T00:00:00Z"))).toEqual({
      type: "MONTH",
      key: "2026-10",
      start: utc("2026-09-30T17:00:00.000Z"),
      end: utc("2026-10-31T16:59:59.999Z"),
      label: "Tháng 10/2026",
      short: "Tháng 10",
    });
  });

  it("switches at midnight on the 1st Vietnam time, not UTC", () => {
    expect(workPeriodOf("MONTH", utc("2026-10-31T16:59:59.999Z")).key).toBe("2026-10");
    expect(workPeriodOf("MONTH", utc("2026-10-31T17:00:00Z")).key).toBe("2026-11");
    // 1 Oct 05:00 Vietnam is still 30 Sep in UTC.
    expect(workPeriodOf("MONTH", utc("2026-09-30T22:00:00Z")).key).toBe("2026-10");
  });

  it("handles year end and February", () => {
    const dec = workPeriodOf("MONTH", utc("2026-12-31T16:59:59.999Z"));
    expect(dec.key).toBe("2026-12");
    expect(dec.end).toEqual(utc("2026-12-31T16:59:59.999Z"));
    expect(workPeriodOf("MONTH", utc("2026-12-31T17:00:00Z")).key).toBe("2027-01");
    expect(workPeriodOf("MONTH", utc("2028-02-15T00:00:00Z")).end).toEqual(utc("2028-02-29T16:59:59.999Z"));
  });
});

describe("workPeriodFromKey", () => {
  it("round-trips week and month keys", () => {
    for (const instant of ["2026-01-01T00:00:00Z", "2026-10-11T16:30:00Z", "2027-01-02T05:00:00Z", "2030-06-30T12:00:00Z"]) {
      const w = workPeriodOf("WEEK", utc(instant));
      expect(workPeriodFromKey("WEEK", w.key)).toEqual(w);
      const m = workPeriodOf("MONTH", utc(instant));
      expect(workPeriodFromKey("MONTH", m.key)).toEqual(m);
    }
  });

  it("accepts week 53 only in years that have it", () => {
    expect(workPeriodFromKey("WEEK", "2026-W53")?.key).toBe("2026-W53");
    expect(workPeriodFromKey("WEEK", "2025-W53")).toBeNull();
  });

  it("maps week 1 to the week containing 4 January", () => {
    const p = workPeriodFromKey("WEEK", "2027-W01")!;
    expect(p.start).toEqual(utc("2027-01-03T17:00:00.000Z")); // Mon 04/01/2027 +07
  });

  it.each([
    ["WEEK", "2026-W00"],
    ["WEEK", "2026-W54"],
    ["WEEK", "2026-W1"],
    ["WEEK", "2026-41"],
    ["WEEK", "1999-W10"],
    ["WEEK", "2101-W10"],
    ["WEEK", " 2026-W41"],
    ["MONTH", "2026-00"],
    ["MONTH", "2026-13"],
    ["MONTH", "2026-1"],
    ["MONTH", "2026-W41"],
    ["MONTH", "1999-12"],
    ["MONTH", ""],
  ] as const)("%s %j is invalid", (type, key) => {
    expect(workPeriodFromKey(type, key)).toBeNull();
  });
});

describe("shiftWorkPeriod", () => {
  it("steps weeks, across the year boundary", () => {
    const w41 = workPeriodFromKey("WEEK", "2026-W41")!;
    expect(shiftWorkPeriod(w41, -1).key).toBe("2026-W40");
    expect(shiftWorkPeriod(w41, 1).key).toBe("2026-W42");
    expect(shiftWorkPeriod(w41, 0)).toEqual(w41);
    expect(shiftWorkPeriod(workPeriodFromKey("WEEK", "2026-W53")!, 1).key).toBe("2027-W01");
    expect(shiftWorkPeriod(workPeriodFromKey("WEEK", "2027-W01")!, -1).key).toBe("2026-W53");
  });

  it("steps months, across the year boundary and short months", () => {
    const jan = workPeriodFromKey("MONTH", "2026-01")!;
    expect(shiftWorkPeriod(jan, -1).key).toBe("2025-12");
    expect(shiftWorkPeriod(jan, 1).key).toBe("2026-02");
    expect(shiftWorkPeriod(workPeriodFromKey("MONTH", "2026-03")!, -1).key).toBe("2026-02");
    expect(shiftWorkPeriod(jan, 12).key).toBe("2027-01");
  });

  it("makes consecutive periods adjacent", () => {
    const w = workPeriodFromKey("WEEK", "2026-W41")!;
    expect(shiftWorkPeriod(w, 1).start.getTime()).toBe(w.end.getTime() + 1);
    const m = workPeriodFromKey("MONTH", "2026-10")!;
    expect(shiftWorkPeriod(m, 1).start.getTime()).toBe(m.end.getTime() + 1);
  });
});

describe("parseWorkPeriodType", () => {
  it.each([
    ["WEEK", "WEEK"],
    ["week", "WEEK"],
    ["Month", "MONTH"],
    ["day", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("%j -> %j", (value, expected) => {
    expect(parseWorkPeriodType(value)).toBe(expected);
  });
});

describe("resolveWorkPeriod", () => {
  const now = utc("2026-10-08T03:00:00Z");

  it("defaults to the current week", () => {
    expect(resolveWorkPeriod(null, null, now)?.key).toBe("2026-W41");
    expect(resolveWorkPeriod(undefined, undefined, now)?.key).toBe("2026-W41");
    expect(resolveWorkPeriod("", "", now)?.key).toBe("2026-W41");
  });

  it("uses the current month for type month without a key", () => {
    expect(resolveWorkPeriod("month", null, now)?.key).toBe("2026-10");
  });

  it("resolves an explicit key", () => {
    expect(resolveWorkPeriod("week", "2026-W01", now)?.key).toBe("2026-W01");
    expect(resolveWorkPeriod("MONTH", "2025-02", now)?.key).toBe("2025-02");
  });

  it("is null for an invalid type or key", () => {
    expect(resolveWorkPeriod("year", null, now)).toBeNull();
    expect(resolveWorkPeriod("week", "2026-10", now)).toBeNull();
    expect(resolveWorkPeriod("month", "2026-W41", now)).toBeNull();
  });
});

describe("sameNotes", () => {
  it("treats null and empty text as the same", () => {
    expect(sameNotes(emptyNotes(), { doneNote: "", doingNote: "", planNote: "", issues: "" })).toBe(true);
  });

  it("detects a change in any field", () => {
    const base = { doneNote: "a", doingNote: "b", planNote: "c", issues: null };
    expect(sameNotes(base, { ...base })).toBe(true);
    expect(sameNotes(base, { ...base, issues: "x" })).toBe(false);
    expect(sameNotes(base, { ...base, planNote: "c " })).toBe(false);
    expect(sameNotes(base, { ...base, doneNote: null })).toBe(false);
  });
});

describe("readSnapshot", () => {
  const sections = { last: { tasks: [], entries: [] }, current: [], next: [] };

  it("returns a valid snapshot as is", () => {
    const snap = takeSnapshot(sections, [], emptyNotes(), utc("2026-10-08T03:00:00Z"));
    expect(snap.takenAt).toBe("2026-10-08T03:00:00.000Z");
    expect(readSnapshot(snap)).toBe(snap);
    expect(readSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["zero", 0],
    ["empty text", ""],
    ["another version", { version: 2, sections }],
    ["version as text", { version: "1", sections }],
    ["no sections", { version: 1 }],
    ["null sections", { version: 1, sections: null }],
    ["empty object", {}],
    ["array", []],
    ["text", "snapshot"],
    ["number", 42],
    ["true", true],
  ])("rejects %s", (_name, value) => {
    expect(readSnapshot(value)).toBeNull();
  });
});
