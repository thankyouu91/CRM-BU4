// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MyTasksView } from "../app/(app)/tasks/tasks-view";
import { clearApiCache } from "../lib/client";
import type { DeadlineFilter } from "../lib/task-deadlines";

vi.mock("../components/tasks/lazy-task-drawer", () => ({ TaskDrawer: () => null }));
afterEach(() => { cleanup(); clearApiCache(); vi.unstubAllGlobals(); });

function page(deadline: DeadlineFilter = "all", nextCursor: string | null = null) {
  return {
    deadline, asOf: "2026-10-11T05:00:00.000Z", total: 205, nextCursor,
    stats: { open: 123, active: 56, overdue: 3, doneWeek: 7 },
    tasks: [{
      id: `task-${deadline}`, canReport: false, title: `Công việc ${deadline}`, status: "TODO", priority: "MEDIUM", progress: 0,
      dueDate: deadline === "next-month" ? "2026-11-01T10:00:00Z" : "2026-10-12T10:00:00Z", completedAt: null,
      project: { id: "p", name: "Dự án", color: "#123456" }, category: null, assignee: null, parent: null,
      _count: { subtasks: 0, reports: 0 },
    }],
  };
}

it("resets pagination for each deadline and shows full-period counts without another initial fetch", async () => {
  const fetch = vi.fn(async (url: string) => {
    const params = new URL(url, "http://localhost").searchParams;
    return { ok: true, json: async () => page(params.get("deadline") as DeadlineFilter) };
  });
  vi.stubGlobal("fetch", fetch);
  render(<MyTasksView canSeeAll initial={page("all", "page-2")} />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText("05/10 – 11/10/2026")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(screen.getByText(/Trang 2/)).toBeTruthy());
  expect(fetch.mock.calls.at(-1)?.[0]).toContain("cursor=page-2");

  for (const [value, label] of [["this-week", "Tuần này"], ["next-week", "Tuần tới"], ["next-month", "Tháng tới"]]) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
    await screen.findByText(`Công việc ${value}`);
    expect(fetch.mock.calls.at(-1)?.[0]).toContain(`deadline=${value}`);
    expect(fetch.mock.calls.at(-1)?.[0]).not.toContain("cursor=");
    expect(screen.getByText(/Trang 1 · 205 kết quả/)).toBeTruthy();
    expect(screen.getByText("82")).toBeTruthy(); // 205 - 123, not the one loaded row or doneWeek.
    expect(screen.queryByText("Hoàn thành 7 ngày qua")).toBeNull();
  }
});

it("preserves the selected deadline when changing scope or searching", async () => {
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => page(new URL(url, "http://localhost").searchParams.get("deadline") as DeadlineFilter) }));
  vi.stubGlobal("fetch", fetch);
  render(<MyTasksView canSeeAll initial={page()} />);
  fireEvent.click(screen.getByRole("button", { name: /Tuần tới/ }));
  await screen.findByText("Công việc next-week");
  fireEvent.click(screen.getByRole("tab", { name: "Tất cả dự án" }));
  await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain("scope=all"));
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm công việc" }), { target: { value: "báo cáo" } });
  await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain(encodeURIComponent("báo cáo")));
  expect(fetch.mock.calls.at(-1)?.[0]).toContain("deadline=next-week");
  expect(fetch.mock.calls.at(-1)?.[0]).toContain("scope=all");
});

it("hides the old period while loading and provides a way back from an empty period", async () => {
  let resolve: (response: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => { resolve = done; })));
  render(<MyTasksView canSeeAll={false} initial={page()} />);
  fireEvent.click(screen.getByRole("button", { name: /Tháng tới/ }));
  expect(screen.queryByText("Công việc all")).toBeNull();
  expect(screen.queryByText("123")).toBeNull();
  expect(screen.getByText("Đang tải công việc…")).toBeTruthy();
  await act(async () => resolve({ ok: true, json: async () => ({ ...page("next-month"), tasks: [], total: 0, stats: { open: 0, active: 0, overdue: 0, doneWeek: 0 } }) }));
  expect(screen.getByText("Không có công việc đến hạn trong kỳ này")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xem tất cả công việc" }));
  await screen.findByText("Công việc all");
  expect(screen.getByRole("button", { name: /Tất cả Gồm cả/ }).getAttribute("aria-pressed")).toBe("true");
});
