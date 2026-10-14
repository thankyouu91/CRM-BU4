// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DateInput, currentYear, joinDate } from "../components/ui/date-input";

afterEach(cleanup);

function Harness({ initial = "", onChange }: { initial?: string; onChange: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateInput
      aria-label="Hạn chót"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

const day = () => screen.getByLabelText("Hạn chót: ngày") as HTMLInputElement;
const month = () => screen.getByLabelText("Hạn chót: tháng") as HTMLInputElement;
const year = () => screen.getByLabelText("Hạn chót: năm") as HTMLInputElement;

it("joins only real calendar dates", () => {
  expect(joinDate({ d: "5", m: "3", y: "2026" })).toBe("2026-03-05");
  expect(joinDate({ d: "31", m: "02", y: "2026" })).toBeNull();
  expect(joinDate({ d: "12", m: "13", y: "2026" })).toBeNull();
  expect(joinDate({ d: "12", m: "10", y: "202" })).toBeNull();
});

it("uses the year in Vietnam, not UTC", () => {
  // 31/12/2025 17:30 UTC is already 01/01/2026 in Vietnam.
  expect(currentYear(new Date("2025-12-31T17:30:00Z"))).toBe(2026);
});

it("shows day/month/year and fills in the current year", () => {
  vi.useFakeTimers({ now: new Date("2026-10-14T05:00:00Z"), toFake: ["Date"] });
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  fireEvent.change(day(), { target: { value: "20" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(month(), { target: { value: "11" } });
  expect(year().value).toBe("2026");
  expect(onChange).toHaveBeenLastCalledWith("2026-11-20");
  vi.useRealTimers();
});

it("lets the year be changed, e.g. to 2025", () => {
  const onChange = vi.fn();
  render(<Harness initial="2026-03-15" onChange={onChange} />);
  expect([day().value, month().value, year().value]).toEqual(["15", "03", "2026"]);
  fireEvent.change(year(), { target: { value: "202" } });
  expect(onChange).not.toHaveBeenCalled(); // incomplete year: nothing saved yet
  fireEvent.change(year(), { target: { value: "2025" } });
  expect(onChange).toHaveBeenLastCalledWith("2025-03-15");
});

it("clears to an empty value", () => {
  const onChange = vi.fn();
  render(<Harness initial="2025-06-01" onChange={onChange} />);
  fireEvent.change(day(), { target: { value: "" } });
  fireEvent.change(month(), { target: { value: "" } });
  fireEvent.change(year(), { target: { value: "" } });
  expect(onChange).toHaveBeenLastCalledWith("");
});

it("keeps a two-digit day when focus moves on to the month", () => {
  render(<Harness onChange={vi.fn()} />);
  fireEvent.change(day(), { target: { value: "2" } });
  fireEvent.change(day(), { target: { value: "20" } });
  fireEvent.blur(day()); // fires with the handlers of the render before "20"
  expect(day().value).toBe("20");
});
