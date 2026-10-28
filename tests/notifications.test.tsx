// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { assignmentNotices, dueWeeklyReport, zonedClock } from "../lib/notifications";
import { NotificationBell, timeAgo } from "../components/layout/notification-bell";
import { LiveFeedProvider } from "../components/layout/live-feed";
import { bulkMessage } from "../components/tasks/bulk-bar";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockClear(); });

describe("notification rules", () => {
  it("notifies per task, and once per person for a large batch", () => {
    const t = (id: string, assigneeId: string | null, projectName = "Dự án A") => ({ id, title: `Việc ${id}`, projectId: "p", projectName, assigneeId });
    const few = assignmentNotices([t("1", "an"), t("2", "an"), t("3", null)]);
    expect(few.map((n) => [n.userId, n.title, n.link])).toEqual([["an", "Bạn được giao “Việc 1”", "/projects/p?task=1"], ["an", "Bạn được giao “Việc 2”", "/projects/p?task=2"]]);
    const many = assignmentNotices([t("1", "an"), t("2", "an", "Dự án B"), t("3", "an"), t("4", "an"), t("5", "binh")]);
    expect(many).toHaveLength(2);
    expect(many[0]).toMatchObject({ userId: "an", title: "Bạn được giao 4 công việc", body: "Trong 2 dự án: Dự án A, Dự án B", link: "/tasks" });
  });

  it("asks for this week's report from Friday 15:00 and last week's on Monday and Tuesday (Vietnam time)", () => {
    const at = (iso: string) => dueWeeklyReport(new Date(iso))?.key ?? null;
    expect(zonedClock(new Date("2026-10-16T08:00:00Z"))).toEqual({ weekday: 5, hour: 15 });
    expect(at("2026-10-16T07:59:59Z")).toBeNull(); // Fri 14:59
    expect(at("2026-10-16T08:00:00Z")).toBe("2026-W42"); // Fri 15:00
    expect(at("2026-10-18T16:59:00Z")).toBe("2026-W42"); // Sun 23:59
    expect(at("2026-10-18T17:00:00Z")).toBe("2026-W42"); // Mon 00:00: last week
    expect(at("2026-10-20T16:59:00Z")).toBe("2026-W42"); // Tue 23:59
    expect(at("2026-10-20T17:00:00Z")).toBeNull(); // Wed
  });

  it("formats time and bulk results in Vietnamese", () => {
    const now = Date.parse("2026-10-13T10:00:00Z");
    expect(timeAgo("2026-10-13T09:59:30Z", now)).toBe("vừa xong");
    expect(timeAgo("2026-10-13T09:15:00Z", now)).toBe("45 phút trước");
    expect(timeAgo("2026-10-12T09:00:00Z", now)).toBe("hôm qua");
    expect(timeAgo("2026-10-01T09:00:00Z", now)).toBe("01/10");
    expect(bulkMessage({ updated: 3, unchanged: 1, skipped: [{ id: "a", title: "A", reason: "X" }, { id: "b", title: "B", reason: "X" }] })).toEqual({ ok: "Đã sửa 3 công việc · 1 việc đã đúng sẵn", skipped: "Bỏ qua 2: X (2)" });
  });
});

describe("notification bell", () => {
  const feed = {
    unread: 1,
    pendingReports: 0,
    reportOwed: null,
    asOf: "2026-10-13T10:00:00.000Z",
    alerts: [{ id: "overdue", tone: "critical", title: "2 việc của bạn đã quá hạn", body: "“A”, “B”", link: "/tasks?issue=overdue" }],
    items: [
      { id: "n1", type: "task.assigned", title: "Bạn được giao “C”", body: "Dự án A", link: "/projects/p?task=c", actorName: "Long", read: false, createdAt: "2026-10-13T09:50:00.000Z" },
      { id: "n2", type: "work_report.reviewed", title: "Long đã xem báo cáo tuần 41 của bạn", body: null, link: null, actorName: "Long", read: true, createdAt: "2026-10-10T09:50:00.000Z" },
    ],
  };

  it("counts unread notices and alerts, opens a notice and marks it read", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, status: 200, json: async () => (url.endsWith("/read") ? { unread: 0, sent: JSON.parse(String(init?.body)) } : feed) }));
    vi.stubGlobal("fetch", fetch);
    await act(async () => { render(<LiveFeedProvider initial={null}><NotificationBell /></LiveFeedProvider>); });
    const bell = screen.getByRole("button", { name: "Thông báo, 2 mục cần xem" });
    await act(async () => { fireEvent.click(bell); });
    const panel = screen.getByRole("dialog", { name: "Thông báo" });
    expect(panel.textContent).toContain("Cần chú ý");
    expect(panel.textContent).toContain("2 việc của bạn đã quá hạn");
    expect(panel.textContent).toContain("Long · 10 phút trước");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Bạn được giao “C”/ })); });
    expect(push).toHaveBeenCalledWith("/projects/p?task=c");
    const read = fetch.mock.calls.find(([url]) => url === "/api/notifications/read")!;
    expect(JSON.parse(String(read[1]!.body))).toEqual({ ids: ["n1"] });
    expect(screen.getByRole("button", { name: "Thông báo, 1 mục cần xem" })).toBeTruthy();
  });

  it("marks everything read and closes with Escape", async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(async (url) => ({ ok: true, status: 200, json: async () => (url.endsWith("/read") ? { unread: 0 } : { ...feed, alerts: [] }) }));
    vi.stubGlobal("fetch", fetch);
    await act(async () => { render(<LiveFeedProvider initial={null}><NotificationBell /></LiveFeedProvider>); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Thông báo, 1 mục cần xem" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Đánh dấu đã đọc/ })); });
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) => url === "/api/notifications/read")![1]!.body))).toEqual({ all: true });
    expect(screen.getByRole("button", { name: "Thông báo" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Thông báo" }).getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Thông báo" })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Thông báo" }));
  });
});
