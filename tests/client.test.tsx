// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { clearApiCache, useApi } from "../lib/client";
afterEach(() => { cleanup(); clearApiCache(); vi.unstubAllGlobals(); });

it("marks a cached page busy until its fresh response arrives", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  const cached = renderHook(() => useApi("/page-b", { initial: { nextCursor: "old" } }));
  cached.unmount();
  const { result, rerender } = renderHook(({ url }) => useApi(url, { initial: { nextCursor: "first" } }), { initialProps: { url: "/page-a" } });
  rerender({ url: "/page-b" });
  expect(result.current.loading).toBe(true);
});
