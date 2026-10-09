// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useNotesDraft } from "../components/work-report/use-notes-draft";
import type { WorkReportData } from "../lib/work-report";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/client", () => ({ api, ApiError: class extends Error {} }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(() => { cleanup(); vi.useRealTimers(); api.mockReset(); });

it("keeps unsaved notes dirty while submission may still fail and saves on leaving", async () => {
  vi.useFakeTimers();
  api.mockResolvedValue({});
  const data = { period: { type: "WEEK", key: "2026-W41" }, report: null } as WorkReportData;
  const { result, unmount } = renderHook(() => useNotesDraft(data, vi.fn()));
  act(() => result.current.change("doneNote", "Unsaved work"));
  await act(async () => { await result.current.take(); });
  expect(result.current.state).toBe("dirty");
  unmount();
  expect(api).toHaveBeenCalledWith("/api/work-reports", expect.objectContaining({
    body: expect.objectContaining({ doneNote: "Unsaved work" }), keepalive: true,
  }));
});

it("acknowledges only the submitted revision, leaving newer typing unsaved", async () => {
  vi.useFakeTimers();
  const data = { period: { type: "WEEK", key: "2026-W41" }, report: null } as WorkReportData;
  const { result } = renderHook(() => useNotesDraft(data, vi.fn()));
  act(() => result.current.change("doneNote", "First"));
  let sent = result.current.notes;
  await act(async () => { sent = await result.current.take(); });
  act(() => result.current.change("doneNote", "Newer"));
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(api).not.toHaveBeenCalled();
  act(() => result.current.acknowledge(sent));
  expect(result.current.state).toBe("dirty");
  api.mockResolvedValue({ report: {} });
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(api).toHaveBeenCalledWith("/api/work-reports", expect.objectContaining({ body: expect.objectContaining({ doneNote: "Newer" }) }));
  expect(result.current.state).toBe("saved");
});

it("keeps failed submissions retryable and clears the draft only after success", async () => {
  vi.useFakeTimers();
  const data = { period: { type: "WEEK", key: "2026-W41" }, report: null } as WorkReportData;
  const { result, unmount } = renderHook(() => useNotesDraft(data, vi.fn()));
  act(() => result.current.change("issues", "Need help"));
  await act(async () => { await result.current.take(); });
  act(() => result.current.failed());
  expect(result.current.state).toBe("error");
  let sent = result.current.notes;
  await act(async () => { sent = await result.current.take(); });
  expect(sent.issues).toBe("Need help");
  act(() => result.current.acknowledge(sent));
  expect(result.current.state).toBe("saved");
  unmount();
  expect(api).not.toHaveBeenCalled();
});
