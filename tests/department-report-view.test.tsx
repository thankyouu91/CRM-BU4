// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DepartmentReportView } from "../components/reports/department-report-view";
import { buildDepartmentReport } from "../lib/department-report";
import { departmentWorkbook } from "../lib/export/department-report-xlsx";
import { workPeriodFromKey } from "../lib/work-report";
import { clearApiCache } from "../lib/client";

vi.mock("../components/tasks/lazy-task-drawer", () => ({ TaskDrawer: () => null }));
afterEach(() => { cleanup(); clearApiCache(); vi.unstubAllGlobals(); });
const fixture = (week = "2026-W42", projectId: string | null = null) => buildDepartmentReport([{
  id: "t", title: "=Nội dung từ file", description: "Chi tiết công việc", status: "TODO", priority: "HIGH", progress: 0,
  createdAt: "2026-10-01T00:00:00Z", startDate: null, dueDate: "2026-10-15T00:00:00Z", completedAt: null,
  project: { id: "p", name: "Dự án", color: "#000", status: "ACTIVE" }, parent: null, category: null, assignee: null, reports: [],
}], workPeriodFromKey("WEEK", week)!, projectId, new Date("2026-10-14T05:00:00Z"));

it("renders all three weeks and suppresses stale rows and exports while changing scope", async () => {
  let resolve: (r: unknown) => void;
  const fetch = vi.fn((url: string) => { expect(url).toContain("/api/reports/department"); return new Promise(r => { resolve = r; }); });
  vi.stubGlobal("fetch", fetch);
  render(<DepartmentReportView initial={fixture()} projects={[{ id: "p", name: "Dự án" }]} />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Tuần trước · Kết quả & tồn đọng" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Tuần này · Việc phải làm" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Tuần tới · Kế hoạch thực hiện" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Phạm vi dự án" }), { target: { value: "p" } });
  expect(screen.queryByText("=Nội dung từ file")).toBeNull();
  expect((screen.getByRole("button", { name: "Xuất Excel gửi sếp" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => fixture("2026-W42", "p") }));
  expect(fetch.mock.calls[0][0]).toContain("projectId=p");
  expect(screen.getByText("=Nội dung từ file")).toBeTruthy();
});

it("exports every section with explicit text cells and matching scope", () => {
  const sheets = departmentWorkbook(fixture(), "Dự án được chọn");
  expect(sheets.map(s => s.sheet)).toEqual(["Tuần trước", "Tuần này", "Tuần tới", "Chưa có deadline", "Kiểm tra ngày hoàn thành"]);
  expect(sheets[1].data[1][0].value).toContain("Dự án được chọn");
  const title = sheets[1].data.flat().find(c => c.value === "=Nội dung từ file")!;
  expect(title.type).toBe(String);
  expect(sheets[1].data.flat().some(c => c.value === "Chưa phân công")).toBe(true);
});
