// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateRangePicker, addDaysTo, rangePresets } from "../components/ui/date-range-picker";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("builds quick ranges ending today", () => {
  const p = Object.fromEntries(rangePresets("2026-03-14").map((r) => [r.label, [r.from, r.to]]));
  expect(p["7 ngày qua"]).toEqual(["2026-03-08", "2026-03-14"]);
  expect(p["Tháng này"]).toEqual(["2026-03-01", "2026-03-14"]);
  expect(p["Tháng trước"]).toEqual(["2026-02-01", "2026-02-28"]);
  expect(p["Từ đầu năm"]).toEqual(["2026-01-01", "2026-03-14"]);
  expect(addDaysTo("2026-01-01", -1)).toBe("2025-12-31");
});

it("picks a range with two clicks in either order", () => {
  vi.useFakeTimers({ now: new Date("2026-10-14T05:00:00Z"), toFake: ["Date"] });
  const onChange = vi.fn();
  render(<DateRangePicker from="" to="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Khoảng ngày: … đến …" }));
  expect(screen.getByText("Tháng 10/2026")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "20/10/2026" }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "05/10/2026" }));
  expect(onChange).toHaveBeenCalledWith({ from: "2026-10-05", to: "2026-10-20" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("applies a quick range and closes on Escape", () => {
  vi.useFakeTimers({ now: new Date("2026-10-14T05:00:00Z"), toFake: ["Date"] });
  const onChange = vi.fn();
  render(<DateRangePicker from="2026-10-01" to="2026-10-14" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Khoảng ngày: 01/10/2026 đến 14/10/2026" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Khoảng ngày/ }));
  fireEvent.click(screen.getByRole("button", { name: "30 ngày qua" }));
  expect(onChange).toHaveBeenCalledWith({ from: "2026-09-15", to: "2026-10-14" });
});
