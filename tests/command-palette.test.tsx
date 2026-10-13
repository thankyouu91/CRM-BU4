// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "../components/layout/command-palette";
import type { CurrentUser } from "../lib/session";
import type { SearchResults } from "../lib/search";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push: nav.push }) }));

const user = (patch: Partial<CurrentUser> = {}): CurrentUser => ({
  id: "u", email: "u@example.test", name: "Long", role: "MEMBER", permissions: [], jobTitle: null, avatarColor: "#2a78d6", mustChangePassword: false, ...patch,
});
const RESULTS: SearchResults = {
  projects: [{ id: "p1", name: "Báo cáo tuần", status: "ACTIVE", color: "#2a78d6" }],
  tasks: [{ id: "t1", title: "Lập BÁO CÁO quý", status: "IN_PROGRESS", dueDate: "2026-10-20T03:00:00.000Z", project: { id: "p1", name: "Báo cáo tuần", color: "#2a78d6" }, assignee: "Lan" }],
  people: [],
};
const reply = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => data });
const combobox = () => screen.getByRole("combobox");
const options = () => screen.getAllByRole("option");
const labels = () => options().map((o) => o.querySelector(".font-medium")!.textContent);
const selected = () => options().findIndex((o) => o.getAttribute("aria-selected") === "true");
const type = (value: string) => fireEvent.change(combobox(), { target: { value } });
const key = (k: string) => fireEvent.keyDown(combobox(), { key: k });
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); nav.push.mockReset(); });

it("opens with Ctrl+K or Cmd+K from anywhere, lists page shortcuts and gives focus back on Esc", () => {
  render(<><input aria-label="Ghi chú" /><CommandPalette user={user()} /></>);
  const trigger = screen.getByRole("button", { name: "Tìm kiếm" });
  expect(trigger.textContent).toContain("Ctrl K");
  const note = screen.getByRole("textbox", { name: "Ghi chú" });
  note.focus();
  fireEvent.keyDown(note, { key: "k", ctrlKey: true });
  const dialog = screen.getByRole("dialog", { name: "Tìm kiếm nhanh" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(document.activeElement).toBe(combobox());
  expect(combobox().getAttribute("aria-expanded")).toBe("true");
  expect(combobox().getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
  expect(labels()).toEqual(["Tổng quan", "Dự án", "Công việc của tôi", "Trợ lý AI", "Hộp báo cáo", "Trung tâm báo cáo", "Nhân sự", "Cài đặt"]);
  expect(combobox().getAttribute("aria-activedescendant")).toBe(options()[0].id);
  const drawerEscape = vi.fn(); // a drawer or dialog underneath listens on the document
  document.addEventListener("keydown", drawerEscape);
  key("Escape");
  document.removeEventListener("keydown", drawerEscape);
  expect(drawerEscape).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(note);

  fireEvent.click(trigger);
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.keyDown(document, { key: "k", metaKey: true }); // the shortcut again closes it
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.keyDown(document, { key: "K", metaKey: true });
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("debounces the search, aborts the stale request and opens a result with the keyboard", async () => {
  const signals: AbortSignal[] = [];
  const fetch = vi.fn((url: string, init: RequestInit) => {
    signals.push(init.signal!);
    return url.endsWith("q=bao") ? new Promise(() => {}) : reply(RESULTS);
  });
  vi.stubGlobal("fetch", fetch);
  render(<CommandPalette user={user()} />);
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });

  type("b");
  await wait(500);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText(/Nhập ít nhất 2 ký tự/)).toBeTruthy();
  type("ba");
  await wait(100);
  type("bao");
  await wait(199);
  expect(fetch).not.toHaveBeenCalled();
  await wait(1);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/search?q=bao"]);
  expect(screen.getAllByText("Đang tìm…").length).toBeGreaterThan(0);

  type("bao cao");
  expect(signals[0].aborted).toBe(true);
  await wait(200);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/search?q=bao", "/api/search?q=bao%20cao"]);
  // Matching pages first, then projects and tasks; the matched words are marked whatever their accents.
  expect(labels()).toEqual(["Hộp báo cáo", "Trung tâm báo cáo", "Công việc của tôi", "Báo cáo tuần", "Lập BÁO CÁO quý"]);
  expect(Array.from(document.querySelectorAll("mark"), (m) => m.textContent)).toEqual(["báo cáo", "báo cáo", "Báo cáo", "BÁO CÁO"]);
  expect(options()[4].textContent).toContain("Báo cáo tuần · Đang làm · Hạn 20/10/2026 · Lan");
  expect(screen.getByRole("status").textContent).toBe("5 kết quả cho “bao cao”");

  expect(selected()).toBe(0);
  key("ArrowDown");
  expect(selected()).toBe(1);
  key("End");
  expect(selected()).toBe(4);
  expect(combobox().getAttribute("aria-activedescendant")).toBe(options()[4].id);
  key("ArrowDown");
  expect(selected()).toBe(0);
  key("ArrowUp");
  key("Home");
  expect(selected()).toBe(0);
  fireEvent.mouseMove(options()[3]);
  expect(selected()).toBe(3);
  key("ArrowDown");
  key("Enter");
  expect(nav.push).toHaveBeenCalledWith("/projects/p1?task=t1");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("shows contracts only to finance users, and the empty and error states", async () => {
  const fetch = vi.fn((url: string) => url.includes("q=xyz")
    ? reply({ projects: [], tasks: [], contracts: [], people: [] })
    : url.includes("q=hop")
      ? reply({ projects: [], tasks: [], contracts: [{ id: "c1", code: "015/HĐ", name: "Đào tạo", partner: "Minh Phát", status: "IN_PROGRESS" }], people: [] })
      : Promise.reject(new TypeError("offline")));
  vi.stubGlobal("fetch", fetch);
  render(<CommandPalette user={user({ permissions: ["FINANCE_MANAGE"] })} />);
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  expect(labels()).toContain("Hợp đồng & chi phí");
  expect(combobox().getAttribute("placeholder")).toBe("Tìm dự án, công việc, hợp đồng, nhân sự…");

  type("xyz");
  await wait(200);
  expect(screen.getAllByText("Không tìm thấy kết quả cho “xyz”")).toHaveLength(2); // shown and announced
  expect(combobox().getAttribute("aria-expanded")).toBe("false");

  type("hop dong");
  await wait(200);
  expect(labels()).toEqual(["Hợp đồng & chi phí", "Đào tạo"]);
  expect(options()[1].textContent).toContain("015/HĐ · Minh Phát · Đang triển khai");
  fireEvent.click(options()[1]);
  expect(nav.push).toHaveBeenCalledWith("/contracts?q=015%2FH%C4%90");

  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  type("mang");
  await wait(200);
  expect(screen.getByText("Không thể tìm kiếm lúc này.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await wait(0);
  expect(fetch).toHaveBeenCalledTimes(4);
});
