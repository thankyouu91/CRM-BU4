import { describe, expect, it } from "vitest";
import { lunarToSolar, statutoryHolidays } from "@/lib/vn-holidays";

describe("Vietnamese public holidays", () => {
  it("finds Tết and Giỗ Tổ on the lunar calendar", () => {
    expect([2021, 2022, 2023, 2024, 2025, 2026, 2027].map((y) => lunarToSolar(1, 1, y))).toEqual(["2021-02-12", "2022-02-01", "2023-01-22", "2024-02-10", "2025-01-29", "2026-02-17", "2027-02-06"]);
    // Vietnam's calendar is on UTC+7: in 2007 and 2030 Tết falls a day before China's Spring Festival.
    expect([2007, 2030].map((y) => lunarToSolar(1, 1, y))).toEqual(["2007-02-17", "2030-02-02"]);
    expect([2024, 2025, 2026].map((y) => lunarToSolar(10, 3, y))).toEqual(["2024-04-18", "2025-04-07", "2026-04-26"]);
    // 2023 had a leap 2nd month: 10/3 comes after it.
    expect(lunarToSolar(10, 3, 2023)).toBe("2023-04-29");
  });

  it("lists the 11 days of the law with a nghỉ bù for each Sunday", () => {
    const y2026 = statutoryHolidays(2026);
    expect(y2026.map((h) => h.day)).toEqual([
      "2026-01-01",
      "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20",
      "2026-04-26", "2026-04-27", // Giỗ Tổ on a Sunday → Monday off
      "2026-04-30", "2026-05-01",
      "2026-09-02", "2026-09-03",
    ]);
    expect(y2026.find((h) => h.day === "2026-04-27")?.name).toBe("Nghỉ bù Giỗ Tổ Hùng Vương (10/3 Âm lịch)");
    // 2025: 2/9 on a Tuesday takes Monday 1/9; Tết 28/1 – 1/2/2025.
    const y2025 = statutoryHolidays(2025).map((h) => h.day);
    expect(y2025).toEqual(expect.arrayContaining(["2025-01-28", "2025-02-01", "2025-09-01", "2025-09-02"]));
    expect(y2025).not.toContain("2025-09-03");
  });
});
