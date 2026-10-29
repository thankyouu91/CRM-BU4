// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "../components/layout/app-shell";
import type { CurrentUser } from "../lib/session";
import type { NotificationFeed } from "../lib/notifications";

vi.mock("next/navigation", () => ({ usePathname: () => "/reports", useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const user = (patch: Partial<CurrentUser> = {}): CurrentUser => ({
  id: "u", email: "u@example.test", name: "Long", role: "MEMBER", permissions: [], jobTitle: null, avatarColor: "#2a78d6", mustChangePassword: false, ...patch,
});
const feed = (patch: Partial<NotificationFeed> = {}): NotificationFeed => ({ items: [], unread: 0, alerts: [], pendingReports: 0, reportOwed: null, asOf: new Date().toISOString(), ...patch });
const nav = () => screen.getAllByRole("navigation", { name: "Điều hướng chính" })[0];

beforeEach(() => { document.cookie = "sidebar=; max-age=0; path=/"; });
afterEach(cleanup);

it("groups the menu and marks the current page", () => {
  render(<AppShell user={user({ permissions: ["FINANCE_MANAGE"] })} feed={feed({ pendingReports: 3 })}><p>Nội dung</p></AppShell>);
  const groups = within(nav()).getAllByRole("group").map(g => [g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby")!)!.textContent, within(g).getAllByRole("link").map(a => a.textContent)]);
  expect(groups).toEqual([
    ["Làm việc", ["Tổng quan", "Dự án", "Công việc của tôi", "Chấm công", "Trợ lý AI"]],
    ["Báo cáo", ["Hộp báo cáo3", "Trung tâm báo cáo"]],
    ["Quản lý", ["Hợp đồng & chi phí", "Nhân sự"]],
  ]);
  expect(within(nav()).getByRole("link", { name: "Cài đặt" })).toBeTruthy();
  expect(within(nav()).getByRole("link", { name: "Trung tâm báo cáo" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav()).getByRole("link", { name: "Dự án" }).getAttribute("aria-current")).toBeNull();
});

it("hides menu items the person has no permission for", () => {
  render(<AppShell user={user()} feed={feed({ pendingReports: 0 })}><p /></AppShell>);
  expect(within(nav()).queryByRole("link", { name: "Hợp đồng & chi phí" })).toBeNull();
  expect(within(nav()).getByRole("link", { name: "Nhân sự" })).toBeTruthy();
});

it("puts Pet Town at the bottom for everyone, its management board for administrators only", () => {
  render(<AppShell user={user()} feed={feed()}><p /></AppShell>);
  expect(within(nav()).getByRole("link", { name: "Pet Town" }).getAttribute("href")).toBe("/ta-tua");
  expect(within(nav()).queryByRole("link", { name: "Quản lý Pet Town" })).toBeNull();
  cleanup();
  render(<AppShell user={user({ role: "ADMIN" })} feed={feed()}><p /></AppShell>);
  expect(within(nav()).getByRole("link", { name: "Quản lý Pet Town" }).getAttribute("href")).toBe("/ta-tua/quan-ly");
});

it("collapses to an icon bar, keeps names for screen readers and remembers the choice", () => {
  render(<AppShell user={user()} feed={feed({ pendingReports: 120 })}><p /></AppShell>);
  const sidebar = document.getElementById("app-sidebar")!;
  expect(sidebar.className).toContain("w-60");
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }));
  expect(sidebar.className).toContain("w-14");
  expect(document.cookie).toContain("sidebar=collapsed");
  const toggle = screen.getByRole("button", { name: "Mở rộng thanh bên" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  // Labels stay as accessible names; the count is read with the inbox link.
  expect(within(nav()).getByRole("link", { name: "Trung tâm báo cáo" })).toBeTruthy();
  expect(within(nav()).getByRole("link", { name: "Hộp báo cáo, 99+ chưa duyệt" })).toBeTruthy();
  fireEvent.click(toggle);
  expect(sidebar.className).toContain("w-60");
  expect(document.cookie).toContain("sidebar=expanded");
});

it("starts collapsed when the cookie says so", () => {
  render(<AppShell user={user()} feed={feed({ pendingReports: 0 })} initialCollapsed><p /></AppShell>);
  expect(document.getElementById("app-sidebar")!.className).toContain("w-14");
  expect(screen.getByRole("button", { name: "Mở rộng thanh bên" })).toBeTruthy();
});

it("opens over the page while the pointer is on the collapsed bar, then folds back", () => {
  vi.useFakeTimers();
  render(<AppShell user={user()} feed={feed({ pendingReports: 0 })} initialCollapsed><p /></AppShell>);
  const sidebar = document.getElementById("app-sidebar")!;
  const content = sidebar.parentElement!.lastElementChild as HTMLElement;
  fireEvent.mouseEnter(sidebar);
  act(() => vi.advanceTimersByTime(150));
  expect(sidebar.className).toContain("w-60");
  expect(within(nav()).getByText("Trung tâm báo cáo").className).not.toContain("sr-only");
  expect(content.className).toContain("lg:pl-14"); // the page does not move
  expect(document.cookie).not.toContain("sidebar=expanded"); // a peek is not a choice
  fireEvent.mouseLeave(sidebar);
  act(() => vi.advanceTimersByTime(250));
  expect(sidebar.className).toContain("w-14");
  vi.useRealTimers();
});

it("does not peek when the bar is already open", () => {
  vi.useFakeTimers();
  render(<AppShell user={user()} feed={feed({ pendingReports: 0 })}><p /></AppShell>);
  const sidebar = document.getElementById("app-sidebar")!;
  fireEvent.mouseEnter(sidebar);
  act(() => vi.advanceTimersByTime(150));
  expect(sidebar.className).not.toContain("shadow-pop");
  vi.useRealTimers();
});

it("keeps a collapsed item's hidden name out of the layout, so the icon stays centred", () => {
  render(<AppShell user={user()} feed={feed({ pendingReports: 2, reportOwed: "tuần 44" })} initialCollapsed><p /></AppShell>);
  for (const name of ["Tổng quan", /^Công việc của tôi/, /^Hộp báo cáo/]) {
    const link = within(nav()).getByRole("link", { name });
    expect(link.className).toContain("justify-center");
    // The visually hidden name must be sr-only alone: "relative" or "flex-1" with it would put it back in the row.
    const label = [...link.querySelectorAll("span")].find((s) => s.className.includes("sr-only"))!;
    expect(label.className).toBe("sr-only");
    for (const s of link.querySelectorAll("span[aria-hidden]")) expect(s.className).not.toMatch(/\brelative\b.*\babsolute\b|\babsolute\b.*\brelative\b/);
  }
});
