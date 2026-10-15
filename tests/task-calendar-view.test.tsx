// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TaskCalendar } from "../components/tasks/task-calendar";
import { clearApiCache } from "../lib/client";

afterEach(() => { cleanup(); clearApiCache(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const tasks = [
  { id: "d", title: "Chấm bài A1", status: "DONE", progress: 100, startDate: null, dueDate: null, completedAt: "2026-10-05T03:00:00Z", project: { id: "p", name: "English File", color: "#123456" } },
  { id: "r", title: "Nộp đề án", status: "IN_PROGRESS", progress: 40, startDate: "2026-10-12T17:00:00Z", dueDate: "2026-10-16T16:59:59Z", completedAt: null, project: { id: "q", name: "Vietravel", color: "#654321" } },
];

it("shows dots per day, lists a day's tasks with project and progress, and opens one", async () => {
  vi.useFakeTimers({ now: new Date("2026-10-14T05:00:00Z"), toFake: ["Date"] });
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ month: new URL(url, "http://x").searchParams.get("month"), asOf: "2026-10-14T05:00:00Z", tasks, truncated: false }) }));
  vi.stubGlobal("fetch", fetch);
  const open = vi.fn();
  render(<TaskCalendar scope="mine" onOpenTask={open} />);
  expect(screen.getByText("Tháng 10/2026")).toBeTruthy();
  expect(fetch.mock.calls[0][0]).toContain("month=2026-10&scope=mine");
  const done = await screen.findByRole("button", { name: "Ngày 5/10: 1 hoàn thành" });
  // Work in progress has no dot: only its deadline shows.
  expect(screen.getByRole("button", { name: "Ngày 14/10: không có công việc" })).toBeTruthy();
  expect(screen.queryByText("Đang làm")).toBeNull();
  expect(screen.getByRole("button", { name: "Ngày 16/10: 1 deadline" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ngày 20/10: không có công việc" })).toBeTruthy();
  const cell = done.closest("[role=gridcell]") as HTMLElement;
  expect(within(cell).getByText("English File")).toBeTruthy();
  expect(within(cell).getByText("100%")).toBeTruthy();
  fireEvent.click(within(cell).getByText("Chấm bài A1"));
  expect(open).toHaveBeenCalledWith("d");

  fireEvent.click(screen.getByRole("button", { name: "Tháng sau" }));
  expect(screen.getByText("Tháng 11/2026")).toBeTruthy();
  await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain("month=2026-11"));
  fireEvent.click(screen.getByRole("button", { name: "Tháng này" }));
  expect(screen.getByText("Tháng 10/2026")).toBeTruthy();
});
