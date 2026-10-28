// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProjectProgressCard, VISIBLE_ROWS } from "../components/dashboard/project-progress-card";
import { firstTab, groupProjects, needsAttention } from "../lib/project-groups";
import type { Summary } from "../lib/stats";

afterEach(cleanup);
type P = Summary["projects"][number];
const project = (i: number, patch: Partial<P> = {}): P => ({
  id: `p${i}`, name: `Dự án ${i}`, color: "#123456", status: "ACTIVE", progress: 50, totalTasks: 4, doneTasks: 2, overdueTasks: 0,
  members: 1, ownerName: "Long", startDate: null, dueDate: null, ...patch,
  schedule: { status: "ON_TRACK", ...(patch.schedule ?? {}) } as P["schedule"], workload: {} as P["workload"],
});

it("groups projects: open, needing attention, completed, all", () => {
  const list = [
    project(1),
    project(2, { overdueTasks: 2 }),
    project(3, { status: "PLANNING", schedule: { status: "BEHIND" } as P["schedule"] }),
    project(4, { status: "COMPLETED", schedule: { status: "DONE" } as P["schedule"] }),
    project(5, { status: "CANCELLED", overdueTasks: 3 }),
  ];
  const g = groupProjects(list);
  expect(g.active.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  expect(g.attention.map((p) => p.id)).toEqual(["p2", "p3"]); // a cancelled project never needs attention
  expect(g.done.map((p) => p.id)).toEqual(["p4"]);
  expect(g.all).toHaveLength(5);
  expect(needsAttention(project(9, { status: "COMPLETED", overdueTasks: 1 }))).toBe(false);
  expect(firstTab(groupProjects([project(4, { status: "COMPLETED" })]))).toBe("all");
});

it("shows a few one-line rows per tab and the rest behind Xem thêm", () => {
  const list = [
    ...Array.from({ length: 9 }, (_, i) => project(i + 1)),
    project(20, { overdueTasks: 3 }),
    project(30, { status: "COMPLETED" }),
  ];
  render(<ProjectProgressCard projects={list} />);
  const tab = (name: RegExp) => screen.getByRole("tab", { name });
  expect(tab(/Đang làm/).getAttribute("aria-selected")).toBe("true");
  expect(tab(/Đang làm/).textContent).toBe("Đang làm10");
  expect(tab(/Cần chú ý/).textContent).toBe("Cần chú ý1");
  const panel = () => screen.getByRole("tabpanel");
  expect(within(panel()).getAllByRole("link")).toHaveLength(VISIBLE_ROWS);
  fireEvent.click(screen.getByRole("button", { name: /Xem thêm 4 dự án/ }));
  expect(within(panel()).getAllByRole("link")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: /Thu gọn/ }));
  expect(within(panel()).getAllByRole("link")).toHaveLength(VISIBLE_ROWS);

  fireEvent.click(tab(/Cần chú ý/));
  const row = within(panel()).getByRole("link");
  expect(row.getAttribute("href")).toBe("/projects/p20");
  expect(within(row).getByText("công việc quá hạn", { exact: false })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull();

  fireEvent.click(tab(/Hoàn thành/));
  expect(within(panel()).getByRole("link").getAttribute("href")).toBe("/projects/p30");
});

it("says so when a tab is empty", () => {
  render(<ProjectProgressCard projects={[project(1)]} />);
  fireEvent.click(screen.getByRole("tab", { name: /Cần chú ý/ }));
  expect(screen.getByText("Không có dự án nào trễ hay có việc quá hạn.")).toBeTruthy();
});

it("says a project has no tasks yet instead of showing 0%", () => {
  render(<ProjectProgressCard projects={[project(1, { totalTasks: 0, doneTasks: 0, progress: 0 })]} />);
  const row = within(screen.getByRole("tabpanel")).getByRole("link");
  expect(within(row).getByText("Chưa có công việc")).toBeTruthy();
  expect(within(row).queryByText("0%")).toBeNull();
});
