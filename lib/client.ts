"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

/** JSON fetch wrapper: throws ApiError with the server's Vietnamese message. */
export async function api<T = unknown>(url: string, init?: ApiInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/login")) {
    // Session expired: a full page load drops all client state (no router outside components).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    const fields = (data.fields ?? data.details) as Record<string, string> | undefined;
    throw new ApiError(data.error ?? "Đã có lỗi xảy ra", res.status, fields);
  }
  return data as T;
}

/** How a task should look right after a change, before the server answers. */
export interface ChangeHint {
  taskId: string;
  fields: Record<string, unknown>;
}

/**
 * Sends a change (POST/PATCH/DELETE). Components take one so the screen that
 * owns the data decides how to refresh: the project workspace patches its view
 * at once and takes the refreshed project from the same response.
 */
export type SendChange = <R = unknown>(url: string, init: ApiInit, hint?: ChangeHint) => Promise<R>;

/** A plain request; the caller refreshes its own view afterwards. */
export const sendPlain: SendChange = (url, init) => api(url, init);

/**
 * True while rendering with `deps` other than the last render's, and on the first render:
 * the condition of an effect with these dependencies, known during render. Adjust state to
 * changed props under it instead of in an effect, so the stale state never shows
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 */
export function useChanged(deps: readonly unknown[]): boolean {
  const [prev, setPrev] = useState<readonly unknown[] | null>(null);
  const changed = prev === null || deps.length !== prev.length || deps.some((d, i) => !Object.is(d, prev[i]));
  if (changed) setPrev(deps);
  return changed;
}

const noSubscription = () => () => {};

/**
 * A value only the browser has (storage, the user agent, the page's classes): `server` on the
 * server and while hydrating, then `read()`, read again on each render without subscribing.
 * Pass a function defined outside the component: React checks a new one again after each commit.
 */
export function useBrowserValue<T>(read: () => T, server: T): T {
  return useSyncExternalStore(noSubscription, read, () => server);
}

const always = () => true;

/** False on the server and while hydrating, true after that (and at once when mounted later). */
export function useHydrated(): boolean {
  return useBrowserValue(always, false);
}

/** Keep typing immediate while postponing expensive server-side searches. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

// Last response per URL, so returning to a view shows its data at once while a
// fresh copy loads in the background (stale-while-revalidate). Bounded; lost on reload.
const responseCache = new Map<string, unknown>();
const CACHE_LIMIT = 60;

/** Forget every remembered response (sign-in/sign-out), so one person's data never shows for another. */
export function clearApiCache() {
  responseCache.clear();
}

function remember(url: string, data: unknown) {
  responseCache.delete(url);
  responseCache.set(url, data);
  if (responseCache.size > CACHE_LIMIT) responseCache.delete(responseCache.keys().next().value!);
}

// Back/forward navigation restores pages from the router cache with the props
// they had then, so data the server sent with such a page may be old.
let lastHistoryNavigation = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastHistoryNavigation = Date.now();
  });
}
const restoredFromHistory = () => Date.now() - lastHistoryNavigation < 2000;

/**
 * Data-fetching hook with loading/error state and manual reload.
 *
 * `initial` is data the server already rendered for the first URL: it is shown
 * immediately and not fetched again (except after back/forward navigation).
 * A URL seen before shows its last response while it revalidates.
 */
export function useApi<T>(url: string | null, opts?: { initial?: T }) {
  const hasInitial = opts?.initial !== undefined && url !== null;
  const [data, setDataState] = useState<T | null>(() => {
    if (hasInitial) {
      remember(url, opts!.initial);
      return opts!.initial!;
    }
    return url && responseCache.has(url) ? (responseCache.get(url) as T) : null;
  });
  const [error, setError] = useState<string | null>(null);
  // The URL whose server-sent data is still fresh: no fetch needed until the URL changes.
  const [freshUrl, setFreshUrl] = useState(() => (hasInitial && !restoredFromHistory() ? url : null));
  const [loading, setLoading] = useState(!!url && url !== freshUrl);
  const seq = useRef(0);
  const request = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    ++seq.current;
    request.current?.abort();
  }, []);

  // A new URL shows its remembered response at once and loads (the effect below fetches it).
  const [shownUrl, setShownUrl] = useState(url);
  if (url !== shownUrl) {
    setShownUrl(url);
    setFreshUrl(null);
    setLoading(!!url);
    if (url && responseCache.has(url)) setDataState(responseCache.get(url) as T);
  }

  // Promise callbacks, not await: the compiler lint counts state set after an await, in a
  // function an effect calls, as set synchronously by the effect.
  const fetchLatest = useCallback(() => {
    if (!url) return Promise.resolve();
    const id = ++seq.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return api<T>(url, { signal: controller.signal })
      .then(
        (result) => {
          if (id !== seq.current || controller.signal.aborted) return;
          remember(url, result);
          setDataState(result);
          setError(null);
        },
        (e) => {
          if (id === seq.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
        },
      )
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [url]);

  const load = useCallback(() => {
    if (!url) return Promise.resolve();
    setLoading(true);
    // Cached data stays on screen; only an empty view shows the loading state.
    if (responseCache.has(url)) setDataState(responseCache.get(url) as T);
    return fetchLatest();
  }, [url, fetchLatest]);

  useEffect(() => {
    if (url && url !== freshUrl) void fetchLatest();
    return cancel;
  }, [fetchLatest, url, freshUrl, cancel]);

  /** Replace the data locally (optimistic updates, or a mutation's response). */
  const setData = useCallback(
    (next: T | null | ((prev: T | null) => T | null)) => {
      setDataState((prev) => {
        const value = typeof next === "function" ? (next as (p: T | null) => T | null)(prev) : next;
        if (url && value !== null) remember(url, value);
        return value;
      });
    },
    [url],
  );

  return { data, error, loading, reload: load, setData };
}
