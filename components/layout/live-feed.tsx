"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/client";
import { onDataChanged } from "@/lib/live-signal";
import type { NotificationFeed } from "@/lib/notifications";

/** Refresh at most this often on navigation; also on focus, after a write and every few minutes while visible. */
export const FRESH_MS = 20_000;
export const POLL_MS = 120_000;

interface LiveFeed {
  feed: NotificationFeed | null;
  setFeed: React.Dispatch<React.SetStateAction<NotificationFeed | null>>;
  /** Fetch the feed again; `force` skips the FRESH_MS throttle. */
  refresh: (force?: boolean) => Promise<void>;
}

const LiveFeedContext = createContext<LiveFeed | null>(null);

/**
 * One source for what changes while someone works: the bell's notices and alerts,
 * the inbox count and the weekly report dot. The server sends the first copy with
 * the page; it is fetched again on navigation, on focus, after the person saves
 * something (lib/live-signal.ts) and on a slow poll, so the sidebar and the bell
 * always agree and never wait for a full reload.
 */
export function LiveFeedProvider({ initial, children }: { initial: NotificationFeed | null; children: React.ReactNode }) {
  const [feed, setFeed] = useState(initial);
  const loadedAt = useRef(initial ? Date.now() : 0);
  const pathname = usePathname();

  // A server render of the layout (router.refresh) brings a newer copy.
  useEffect(() => {
    if (!initial) return;
    setFeed((current) => (current && current.asOf >= initial.asOf ? current : initial));
  }, [initial]);

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - loadedAt.current < FRESH_MS) return;
    loadedAt.current = Date.now();
    try {
      setFeed(await api<NotificationFeed>("/api/notifications"));
    } catch {
      loadedAt.current = 0; // try again on the next occasion
    }
  }, []);

  useEffect(() => void refresh(), [refresh, pathname]);
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const onFocus = () => visible() && refresh();
    const timer = setInterval(() => visible() && refresh(true), POLL_MS);
    const stop = onDataChanged(() => void refresh(true));
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      stop();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return <LiveFeedContext.Provider value={{ feed, setFeed, refresh }}>{children}</LiveFeedContext.Provider>;
}

export function useLiveFeed(): LiveFeed {
  const live = useContext(LiveFeedContext);
  if (!live) throw new Error("useLiveFeed needs a LiveFeedProvider (AppShell provides one)");
  return live;
}
