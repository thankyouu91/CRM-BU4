// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RecentReportsCard, UpcomingCard, daysUntil } from "../components/dashboard/activity-cards";
import type { Summary } from "../lib/stats";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
const NOW = new Date("2026-10-28T03:00:00Z");

const task = (i: number, inDays: number, patch: Partial<Summary["upcoming"][number]> = {}) => ({
  id: `t${i}`, title: `Việc ${i}`, dueDate: new Date(NOW.getTime() + inDays * 86_400_000).toISOString(), projectName: "Dự án A", assigneeName: "Long", priority: "MEDIUM", ...patch,
});
const report = (i: number, patch: Partial<Summary["recentReports"][number]> = {}) => ({
  id: `r${i}`, content: `nội dung ${i}`, progress: 50, hoursSpent: 0, createdAt: NOW.toISOString(), reviewedAt: NOW.toISOString(),
  authorName: "Võ Trần Long", authorColor: "#123456", taskTitle: `Công việc ${i}`, projectName: "Dự án A", ...patch,
});

it("lists deadlines on one line each, with the closest ones in their own tab", () => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  render(<UpcomingCard upcoming={[task(1, 1), task(2, 2, { priority: "URGENT" }), ...Array.from({ length: 6 }, (_, i) => task(10 + i, 5 + i))]} />);
  expect(screen.getByRole("tab", { name: /14 ngày tới/ }).textContent).toBe("14 ngày tới8");
  expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(6);
  expect(screen.getByRole("button", { name: /Xem thêm 2 công việc/ })).toBeTruthy();
  expect(screen.getByText("Ưu tiên khẩn cấp")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /Trong 3 ngày/ }));
  expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem").map((li) => li.querySelector("p")!.textContent)).toEqual(["Việc 1", "Việc 2"]);
  expect(daysUntil(task(9, 2).dueDate, NOW.getTime())).toBe(2);
});

it("lists reports compactly, hides zero hours and has a tab for those not reviewed", () => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  render(<RecentReportsCard reports={[report(1, { reviewedAt: null, hoursSpent: 2 }), report(2), report(3)]} />);
  const rows = within(screen.getByRole("tabpanel")).getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(within(rows[0]).getByText(/2 giờ/)).toBeTruthy();
  expect(within(rows[1]).queryByText(/0 giờ/)).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /Chờ xem xét/ }));
  expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull();
});

it("shows empty states", () => {
  render(<><UpcomingCard upcoming={[]} /><RecentReportsCard reports={[]} /></>);
  expect(screen.getByText("Không có hạn chót gần")).toBeTruthy();
  expect(screen.getByText("Chưa có báo cáo trong kỳ")).toBeTruthy();
  expect(screen.queryAllByRole("tab")).toHaveLength(0);
});
