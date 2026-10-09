"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [loading, setLoading] = useState(!!url && !hasInitial && !responseCache.has(url));
  const seq = useRef(0);
  // The URL whose server-sent data is still fresh: no fetch needed until the URL changes.
  const freshUrl = useRef(hasInitial && !restoredFromHistory() ? url : null);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    // Cached data stays on screen; only an empty view shows the loading state.
    if (responseCache.has(url)) setDataState(responseCache.get(url) as T);
    try {
      const result = await api<T>(url);
      remember(url, result);
      if (id === seq.current) {
        setDataState(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (url !== null && url === freshUrl.current) return;
    freshUrl.current = null;
    void load();
  }, [load, url]);

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
