// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "../components/layout/app-shell";
import type { CurrentUser } from "../lib/session";

vi.mock("next/navigation", () => ({ usePathname: () => "/reports", useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const user = (patch: Partial<CurrentUser> = {}): CurrentUser => ({
  id: "u", email: "u@example.test", name: "Long", role: "MEMBER", permissions: [], jobTitle: null, avatarColor: "#2a78d6", mustChangePassword: false, ...patch,
});
const nav = () => screen.getAllByRole("navigation", { name: "Điều hướng chính" })[0];

beforeEach(() => { document.cookie = "sidebar=; max-age=0; path=/"; });
afterEach(cleanup);

it("groups the menu and marks the current page", () => {
  render(<AppShell user={user({ permissions: ["FINANCE_MANAGE"] })} pendingReports={3}><p>Nội dung</p></AppShell>);
  const groups = within(nav()).getAllByRole("group").map(g => [g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby")!)!.textContent, within(g).getAllByRole("link").map(a => a.textContent)]);
  expect(groups).toEqual([
    ["Làm việc", ["Tổng quan", "Dự án", "Công việc của tôi", "Trợ lý AI"]],
    ["Báo cáo", ["Hộp báo cáo3", "Trung tâm báo cáo"]],
    ["Quản lý", ["Hợp đồng & chi phí", "Nhân sự"]],
  ]);
  expect(within(nav()).getByRole("link", { name: "Cài đặt" })).toBeTruthy();
  expect(within(nav()).getByRole("link", { name: "Trung tâm báo cáo" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav()).getByRole("link", { name: "Dự án" }).getAttribute("aria-current")).toBeNull();
});

it("hides menu items the person has no permission for", () => {
  render(<AppShell user={user()} pendingReports={0}><p /></AppShell>);
  expect(within(nav()).queryByRole("link", { name: "Hợp đồng & chi phí" })).toBeNull();
  expect(within(nav()).getByRole("link", { name: "Nhân sự" })).toBeTruthy();
});

it("collapses to an icon bar, keeps names for screen readers and remembers the choice", () => {
  render(<AppShell user={user()} pendingReports={120}><p /></AppShell>);
  const sidebar = document.getElementById("app-sidebar")!;
  expect(sidebar.className).toContain("w-64");
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }));
  expect(sidebar.className).toContain("w-[72px]");
  expect(document.cookie).toContain("sidebar=collapsed");
  const toggle = screen.getByRole("button", { name: "Mở rộng thanh bên" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  // Labels stay as accessible names; the count is read with the inbox link.
  expect(within(nav()).getByRole("link", { name: "Trung tâm báo cáo" })).toBeTruthy();
  expect(within(nav()).getByRole("link", { name: "Hộp báo cáo, 99+ chưa duyệt" })).toBeTruthy();
  fireEvent.click(toggle);
  expect(sidebar.className).toContain("w-64");
  expect(document.cookie).toContain("sidebar=expanded");
});

it("starts collapsed when the cookie says so", () => {
  render(<AppShell user={user()} pendingReports={0} initialCollapsed><p /></AppShell>);
  expect(document.getElementById("app-sidebar")!.className).toContain("w-[72px]");
  expect(screen.getByRole("button", { name: "Mở rộng thanh bên" })).toBeTruthy();
});
