// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { AppShell } from "../components/layout/app-shell";
import { api } from "../lib/client";
import { onDataChanged, SETTLE_MS, signalDataChanged } from "../lib/live-signal";
import type { CurrentUser } from "../lib/session";
import type { NotificationFeed } from "../lib/notifications";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const user = { id: "u", email: "u@example.test", name: "Long", role: "MEMBER", permissions: [], jobTitle: null, avatarColor: "#2a78d6", mustChangePassword: false } as unknown as CurrentUser;
const feed = (patch: Partial<NotificationFeed> = {}): NotificationFeed => ({ items: [], unread: 0, alerts: [], pendingReports: 0, reportOwed: null, asOf: new Date().toISOString(), ...patch });
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("live signal", () => {
  it("refreshes once after a burst of writes", () => {
    vi.useFakeTimers();
    const heard = vi.fn();
    const stop = onDataChanged(heard);
    signalDataChanged();
    signalDataChanged();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    signalDataChanged();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    signalDataChanged();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("is raised by successful writes only, not by reads, failures or the feed itself", async () => {
    vi.useFakeTimers();
    const heard = vi.fn();
    const stop = onDataChanged(heard);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("fail") ? { ok: false, status: 400, json: async () => ({ error: "x" }) } : ok({}))));
    await api("/api/tasks");
    await api("/api/notifications/read", { method: "POST", body: { all: true } });
    await api("/api/auth/logout", { method: "POST" });
    await expect(api("/api/tasks/fail", { method: "PATCH", body: {} })).rejects.toThrow();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(heard).not.toHaveBeenCalled();
    await api("/api/tasks/t1/reports", { method: "POST", body: {} });
    vi.advanceTimersByTime(SETTLE_MS);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("live feed in the shell", () => {
  it("shows the server's counts at once, then follows a write without a page reload", async () => {
    const fetch = vi.fn(async () => ok(feed({ pendingReports: 4, reportOwed: null })));
    vi.stubGlobal("fetch", fetch);
    render(<AppShell user={user} feed={feed({ pendingReports: 3, reportOwed: "tuần 44" })}><p /></AppShell>);
    const nav = screen.getAllByRole("navigation", { name: "Điều hướng chính" })[0];
    expect(within(nav).getByRole("link", { name: /^Hộp báo cáo/ }).textContent).toContain("3");
    expect(within(nav).getByRole("link", { name: /^Công việc của tôi/ }).querySelector("[title]")?.getAttribute("title")).toBe("chưa gửi báo cáo tuần 44");
    // The page came with the feed: no request on load.
    expect(fetch).not.toHaveBeenCalled();
    // Someone saves something (a review, a weekly report…): one refresh, and the sidebar follows.
    await act(async () => {
      signalDataChanged();
      await new Promise((r) => setTimeout(r, SETTLE_MS + 50));
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual(expect.arrayContaining(["/api/notifications"]));
    expect(within(nav).getByRole("link", { name: /^Hộp báo cáo/ }).textContent).toContain("4");
    expect(within(nav).getByRole("link", { name: /^Công việc của tôi/ }).querySelector("[title]")).toBeNull();
  });
});
