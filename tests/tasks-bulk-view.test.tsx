// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MyTasksView } from "../app/(app)/tasks/tasks-view";
import { clearApiCache } from "../lib/client";

vi.mock("../components/tasks/lazy-task-drawer", () => ({ TaskDrawer: () => null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
afterEach(() => { cleanup(); clearApiCache(); vi.unstubAllGlobals(); toast.success.mockClear(); });

const task = (id: string, canReport = true) => ({
  id, canReport, title: `Việc ${id}`, status: "TODO", priority: "MEDIUM", progress: 0, dueDate: null, completedAt: null,
  project: { id: "p", name: "Dự án", color: "#123456" }, category: null, assignee: null, parent: null, _count: { subtasks: 0, reports: 0 },
});
type Issue = "unassigned" | "nodue" | "overdue";
const page = (issue: Issue | null = null) => ({
  deadline: "all" as const, issue, asOf: "2026-10-13T05:00:00.000Z", total: 3, nextCursor: null,
  stats: { open: 3, active: 0, overdue: 0, doneWeek: 0 }, issues: { unassigned: 3, nodue: 3, overdue: 0 },
  tasks: [task("a"), task("b"), task("c", false)],
});

function server(bulk = { updated: 2, unchanged: 0, skipped: [] as { id: string; title: string; reason: string }[] }) {
  const calls: { url: string; body?: unknown }[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url === "/api/users") return { ok: true, json: async () => ({ users: [{ id: "an", name: "Trần An", jobTitle: "Điều phối", active: true }, { id: "off", name: "Nghỉ", jobTitle: null, active: false }] }) };
    if (url === "/api/tasks/bulk") return { ok: true, json: async () => bulk };
    return { ok: true, json: async () => page(new URL(url, "http://localhost").searchParams.get("issue") as Issue | null) };
  });
  vi.stubGlobal("fetch", fetch);
  return calls;
}

it("selects tasks the person may change and gives them to someone in one step", async () => {
  const calls = server({ updated: 2, unchanged: 0, skipped: [{ id: "x", title: "X", reason: "Không phải thành viên" }] });
  render(<MyTasksView canSeeAll initial={page()} initialFilter={{ scope: "all", issue: null }} projects={[{ id: "p", name: "Dự án" }]} />);
  expect(screen.queryByRole("region", { name: "Sửa hàng loạt" })).toBeNull();
  expect((screen.getByRole("checkbox", { name: "Chọn “Việc c”" }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /Chọn tất cả 2 việc/ }));
  const bar = screen.getByRole("region", { name: "Sửa hàng loạt" });
  expect(bar.textContent).toContain("Đã chọn 2");
  const giveTo = within(bar).getByRole("combobox", { name: "Giao cho" }) as HTMLSelectElement;
  await waitFor(() => expect(giveTo.disabled).toBe(false));
  expect([...giveTo.options].map((o) => o.textContent)).toEqual(["Giao cho…", "Trần An · Điều phối", "Bỏ người phụ trách"]);
  await act(async () => { fireEvent.change(giveTo, { target: { value: "an" } }); });
  const bulk = calls.find((c) => c.url === "/api/tasks/bulk")!;
  expect(bulk.body).toEqual({ ids: ["a", "b"], patch: { assigneeId: "an" } });
  expect(toast.success).toHaveBeenCalledWith("Giao cho Trần An: Đã sửa 2 công việc", expect.objectContaining({ description: "Bỏ qua 1: Không phải thành viên (1)" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sửa hàng loạt" })).toBeNull());
});

it("sets a deadline at the end of the chosen day (Vietnam time)", async () => {
  const calls = server();
  render(<MyTasksView canSeeAll initial={page()} initialFilter={{ scope: "all", issue: null }} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn “Việc a”" }));
  fireEvent.change(screen.getByLabelText("Deadline mới"), { target: { value: "2026-10-20" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Đặt deadline" })); });
  expect(calls.find((c) => c.url === "/api/tasks/bulk")!.body).toEqual({ ids: ["a"], patch: { dueDate: "2026-10-20T16:59:59.999Z" } });
});

it("filters by what needs fixing, keeps it in the address bar and shows each count", async () => {
  const calls = server();
  window.history.replaceState(null, "", "/tasks");
  render(<MyTasksView canSeeAll initial={page()} initialFilter={{ scope: "mine", issue: null }} />);
  const chips = screen.getByRole("group", { name: "Lọc nhanh việc cần bổ sung" });
  // Unassigned work is never "mine": that chip only shows across projects.
  expect(within(chips).queryByRole("button", { name: /Chưa giao người/ })).toBeNull();
  await act(async () => { fireEvent.click(within(chips).getByRole("button", { name: /Chưa có deadline/ })); });
  await waitFor(() => expect(calls.at(-1)!.url).toContain("issue=nodue"));
  expect(window.location.search).toBe("?issue=nodue");
  expect(within(chips).getByRole("button", { name: /Chưa có deadline/ }).getAttribute("aria-pressed")).toBe("true");
  await act(async () => { fireEvent.click(within(chips).getByRole("button", { name: /Chưa có deadline/ })); });
  expect(window.location.search).toBe("");
});
