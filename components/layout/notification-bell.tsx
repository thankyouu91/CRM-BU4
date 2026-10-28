"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarCheck, CheckCheck, ClipboardList, Info, TriangleAlert, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import type { NotificationAlert, NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { zonedText } from "@/lib/work-report";
import { useLiveFeed } from "./live-feed";

/** "vừa xong", "5 phút trước", "3 giờ trước", "hôm qua", or the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86_400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 2 * 86_400) return "hôm qua";
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} ngày trước`;
  return zonedText(iso, "short");
}

const ALERT_ICON = { critical: TriangleAlert, warning: ClipboardList, info: Info } as const;
const ALERT_TONE = {
  critical: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  info: "bg-primary/10 text-primary",
} as const;

export function NotificationBell() {
  // The feed is shared with the sidebar and kept fresh by LiveFeedProvider.
  const { feed, setFeed, refresh: load } = useLiveFeed();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    setFeed((f) => f && {
      ...f,
      items: f.items.map((n) => ("all" in body || body.ids.includes(n.id) ? { ...n, read: true } : n)),
      unread: "all" in body ? 0 : Math.max(0, f.unread - f.items.filter((n) => !n.read && body.ids.includes(n.id)).length),
    });
    try {
      const { unread } = await api<{ unread: number }>("/api/notifications/read", { method: "POST", body });
      setFeed((f) => f && { ...f, unread });
    } catch {
      void load(true);
    }
  };

  const go = (link: string | null, item?: NotificationItem) => {
    if (item && !item.read) void markRead({ ids: [item.id] });
    setOpen(false);
    if (link) router.push(link);
  };

  const alerts = feed?.alerts ?? [];
  const count = (feed?.unread ?? 0) + alerts.length;
  const shown = count > 99 ? "99+" : String(count);

  return (
    <div ref={ref} className="relative">
      <button
        ref={button}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load(true);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? `Thông báo, ${shown} mục cần xem` : "Thông báo"}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span aria-hidden className="absolute right-1 top-1 min-w-[16px] rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {shown}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Thông báo"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            // Phones: the bell is not at the screen edge, so the panel spans the screen instead.
            className="fixed inset-x-3 top-16 z-30 overflow-hidden rounded-xl border bg-card shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <p className="flex-1 text-sm font-semibold">Thông báo</p>
              {!!feed?.unread && (
                <button onClick={() => markRead({ all: true })} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <CheckCheck className="h-3.5 w-3.5" /> Đánh dấu đã đọc
                </button>
              )}
            </div>
            <div className="max-h-[min(70vh,520px)] overflow-y-auto">
              {!feed ? (
                <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
              ) : (
                <>
                  {alerts.length > 0 && (
                    <section aria-label="Cần chú ý" className="border-b p-2">
                      <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Cần chú ý</p>
                      <ul>
                        {alerts.map((a) => (
                          <AlertRow key={a.id} alert={a} onOpen={() => go(a.link)} />
                        ))}
                      </ul>
                    </section>
                  )}
                  {feed.items.length ? (
                    <ul aria-label="Thông báo gần đây" className="p-2">
                      {feed.items.map((n) => (
                        <li key={n.id}>
                          <button onClick={() => go(n.link, n)} className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted">
                            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                              {n.type === "task.assigned" || n.type === "project.member_added" ? (
                                <UserPlus className="h-3.5 w-3.5" />
                              ) : n.type === "attendance.leave" ? (
                                <CalendarCheck className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCheck className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block break-words text-sm", !n.read && "font-semibold")}>{n.title}</span>
                              {n.body && <span className="mt-0.5 line-clamp-2 block break-words text-xs text-muted-foreground">{n.body}</span>}
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {n.actorName ? `${n.actorName} · ` : ""}
                                {timeAgo(n.createdAt, new Date(feed.asOf).getTime())}
                              </span>
                            </span>
                            {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !alerts.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlertRow({ alert, onOpen }: { alert: NotificationAlert; onOpen: () => void }) {
  const Icon = ALERT_ICON[alert.tone];
  return (
    <li>
      <button onClick={onOpen} className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted">
        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", ALERT_TONE[alert.tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium">{alert.title}</span>
          {alert.body && <span className="mt-0.5 line-clamp-2 block break-words text-xs text-muted-foreground">{alert.body}</span>}
        </span>
      </button>
    </li>
  );
}
