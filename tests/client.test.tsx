// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { clearApiCache, useApi, useDebouncedValue } from "../lib/client";
afterEach(() => { cleanup(); clearApiCache(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("sends only the settled search while typing rapidly", () => {
  vi.useFakeTimers();
  const fetch = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetch);
  const { rerender } = renderHook(({ text }) => {
    const query = useDebouncedValue(text);
    return useApi(query === text ? `/search?q=${query}` : null, { initial: [] });
  }, { initialProps: { text: "" } });
  rerender({ text: "b" });
  act(() => vi.advanceTimersByTime(100));
  rerender({ text: "ba" });
  act(() => vi.advanceTimersByTime(100));
  rerender({ text: "bao" });
  expect(fetch).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(300));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/search?q=bao", expect.anything());
});

it("aborts obsolete requests and ignores their responses even if transport completes", async () => {
  const requests: { signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((resolve) => {
    requests.push({ signal: init.signal, resolve });
  })));
  const { result, rerender, unmount } = renderHook(({ url }) => useApi(url), { initialProps: { url: "/first" as string | null } });
  rerender({ url: "/second" });
  expect(requests[0].signal.aborted).toBe(true);
  await act(async () => requests[1].resolve({ ok: true, json: async () => "fresh" }));
  await act(async () => requests[0].resolve({ ok: true, json: async () => "stale" }));
  expect(result.current.data).toBe("fresh");
  act(() => { void result.current.reload(); });
  rerender({ url: null });
  expect(requests[2].signal.aborted).toBe(true);
  expect(result.current.loading).toBe(false);
  unmount();
});

it("marks a cached page busy until its fresh response arrives", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  const cached = renderHook(() => useApi("/page-b", { initial: { nextCursor: "old" } }));
  cached.unmount();
  const { result, rerender } = renderHook(({ url }) => useApi(url, { initial: { nextCursor: "first" } }), { initialProps: { url: "/page-a" } });
  rerender({ url: "/page-b" });
  expect(result.current.loading).toBe(true);
});
