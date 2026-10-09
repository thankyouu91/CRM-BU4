import { describe, expect, it } from "vitest";
import { DAILY_KEEP, MONTHLY_KEEP, expiredKeys, localDay } from "@/lib/maintenance";

describe("localDay", () => {
  it("names the backup by the Vietnam calendar day", () => {
    // The cron fires at 19:00 UTC, which is 02:00 the next day in Vietnam.
    expect(localDay(new Date("2026-10-09T19:00:00Z"))).toBe("2026-10-10");
    expect(localDay(new Date("2026-10-09T16:59:59Z"))).toBe("2026-10-09");
    expect(localDay(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-01");
  });
  it("honours another time zone", () => {
    expect(localDay(new Date("2026-10-09T19:00:00Z"), "UTC")).toBe("2026-10-09");
  });
});

describe("expiredKeys", () => {
  const days = Array.from({ length: 35 }, (_, i) => `daily/2026-09-${String(i + 1).padStart(2, "0")}.json.gz`);

  it("keeps the newest N keys and returns the rest", () => {
    const old = expiredKeys(days, 30);
    expect(old).toHaveLength(5);
    expect(old).toContain("daily/2026-09-01.json.gz");
    expect(old).not.toContain("daily/2026-09-35.json.gz");
  });
  it("does not depend on input order", () => {
    expect(new Set(expiredKeys([...days].reverse(), 30))).toEqual(new Set(expiredKeys(days, 30)));
  });
  it("deletes nothing when there are no more than N keys", () => {
    expect(expiredKeys(days.slice(0, 3), 30)).toEqual([]);
    expect(expiredKeys([], 30)).toEqual([]);
  });
  it("keeps a month of dailies and a year of monthlies", () => {
    expect(DAILY_KEEP).toBe(30);
    expect(MONTHLY_KEEP).toBe(12);
  });
});
