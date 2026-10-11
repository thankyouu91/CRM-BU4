// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import type { ProjectListItemData } from "../components/projects/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
import { ProjectsView } from "../app/(app)/projects/projects-view";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
const fixture = (id: string, startDate: string | null, dueDate: string | null, status = "ACTIVE") => ({
  id, name: id, startDate, dueDate, status, progress: 35, color: "#4f46e5", owner: { name: "Nguyễn An" },
  doneTasks: 3, totalTasks: 10, members: [],
}) as unknown as ProjectListItemData;
const initial = [fixture("Dự án xuyên quý", "2026-09-10", "2026-11-20"), fixture("Đào tạo tháng 12", "2026-12-01", "2026-12-10", "PLANNING"), fixture("Chưa định ngày", null, null)];
const show = () => render(<ProjectsView initial={initial} directory={[]} canCreate={false} canFinance={false} initialView="month" initialAnchor="2026-10-01" now="2026-10-11T00:00:00Z" />);

it("switches month, quarter and year while keeping unscheduled projects accessible", () => {
  show();
  expect(screen.getByRole("heading", { name: "Tháng 10/2026" })).toBeTruthy();
  expect(screen.queryAllByRole("link", { name: /Đào tạo tháng 12/ })).toHaveLength(0);
  expect(screen.getByText("Chưa định ngày")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Quý" }));
  expect(screen.getByRole("heading", { name: "Quý 4/2026" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: /Đào tạo tháng 12/ }).length).toBeGreaterThan(0);
  expect(window.location.search).toContain("calendar=quarter");
  fireEvent.click(screen.getByRole("button", { name: "Năm" }));
  expect(screen.getByRole("heading", { name: "Năm 2026" })).toBeTruthy();
  expect(window.location.search).toContain("month=2026-10");
  expect((screen.getByLabelText("Chọn tháng") as HTMLInputElement).value).toBe("2026-10");
  expect(screen.queryByRole("button", { name: "Tạo dự án" })).toBeNull();
});

it("navigates periods and applies search/status to the calendar and unscheduled rows", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Kỳ tiếp theo" }));
  expect(screen.getByRole("heading", { name: "Tháng 11/2026" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hôm nay" }));
  expect(screen.getByRole("heading", { name: "Tháng 10/2026" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Tìm dự án"), { target: { value: "tháng 12" } });
  expect(screen.queryByText("Chưa định ngày")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Xem kỳ có dự án gần nhất" }));
  expect(screen.getByRole("heading", { name: "Tháng 12/2026" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Lọc trạng thái dự án"), { target: { value: "COMPLETED" } });
  expect(screen.getByText("Không có dự án phù hợp trong kỳ")).toBeTruthy();
});
