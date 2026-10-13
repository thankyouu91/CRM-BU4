"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartColumn,
  CornerDownLeft,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Search,
  Settings,
  Sparkles,
  TriangleAlert,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { CurrentUser } from "@/lib/session";
import { api, useDebouncedValue } from "@/lib/client";
import { PROJECT_STATUS, TASK_STATUS, type ProjectStatusKey, type TaskStatusKey } from "@/lib/constants";
import { CONTRACT_STATUS, type ContractStatusKey } from "@/lib/finance";
import { hasPermission } from "@/lib/permissions";
import { matchPages, matchRange, parseSearchQuery, type SearchResults } from "@/lib/search";
import { cn, formatDate } from "@/lib/utils";

const PAGE_ICONS: Record<string, typeof Search> = {
  "/dashboard": LayoutDashboard,
  "/projects": FolderKanban,
  "/tasks": ListChecks,
  "/ai": Sparkles,
  "/inbox": Inbox,
  "/reports": ChartColumn,
  "/contracts": Wallet,
  "/team": Users,
  "/settings": Settings,
};

interface Item {
  key: string;
  /** Position in the whole list (option id, arrow keys). */
  index: number;
  href: string;
  title: string;
  detail?: string;
  lead: React.ReactNode;
}
interface Group {
  key: string;
  label: string;
  items: Item[];
  /** Highlight titles against this text (the query the items answer). */
  query: string;
}

const dot = (color: string, round = false) => <span aria-hidden className={cn("h-2.5 w-2.5", round ? "rounded-full" : "rounded-[3px]")} style={{ background: color }} />;
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

type Draft = Omit<Group, "items"> & { items: Omit<Item, "index">[] };

function resultGroups(data: SearchResults, query: string): Draft[] {
  return [
    {
      key: "projects",
      label: "Dự án",
      query,
      items: data.projects.map((p) => ({
        key: `p:${p.id}`,
        href: `/projects/${p.id}`,
        title: p.name,
        detail: PROJECT_STATUS[p.status as ProjectStatusKey]?.label,
        lead: dot(p.color),
      })),
    },
    {
      key: "tasks",
      label: "Công việc",
      query,
      items: data.tasks.map((t) => ({
        key: `t:${t.id}`,
        href: `/projects/${t.project.id}?task=${t.id}`,
        title: t.title,
        detail: join(t.project.name, TASK_STATUS[t.status as TaskStatusKey]?.label, t.dueDate && `Hạn ${formatDate(t.dueDate)}`, t.assignee),
        lead: dot(TASK_STATUS[t.status as TaskStatusKey]?.color ?? "#94a3b8", true),
      })),
    },
    {
      key: "contracts",
      label: "Hợp đồng",
      query,
      items: (data.contracts ?? []).map((c) => ({
        key: `c:${c.id}`,
        href: `/contracts?q=${encodeURIComponent(c.code || c.name)}`,
        title: c.name,
        detail: join(c.code, c.partner, CONTRACT_STATUS[c.status as ContractStatusKey]?.label),
        lead: <Wallet aria-hidden className="h-4 w-4 text-muted-foreground" />,
      })),
    },
    {
      key: "people",
      label: "Nhân sự",
      query,
      items: data.people.map((u) => ({
        key: `u:${u.id}`,
        href: `/team?q=${encodeURIComponent(u.name)}`,
        title: u.name,
        detail: join(u.jobTitle, u.email),
        lead: <Avatar name={u.name} color={u.avatarColor} size="xs" className="ring-0" />,
      })),
    },
  ];
}

/** The title with the part matching the query (accents ignored) marked. */
function Highlight({ text, query }: { text: string; query: string }) {
  const range = query ? matchRange(text, query) : null;
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-primary/15 text-foreground">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

const kbd = "rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium leading-none text-muted-foreground";

/**
 * Quick search (Ctrl/Cmd+K from any page, or the header button): projects, tasks,
 * contracts and people from GET /api/search, plus page shortcuts filtered here.
 * Combobox + listbox: focus stays in the input, arrows move the active option.
 */
export function CommandPalette({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<{ q: string; data: SearchResults } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [retry, setRetry] = useState(0);
  const [mac, setMac] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const listId = useId();

  const term = parseSearchQuery(text);
  const debounced = useDebouncedValue(term, 200);
  const finance = hasPermission(user, "FINANCE_MANAGE");

  const show = useCallback((from?: HTMLElement | null) => {
    returnTo.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setText("");
    setResults(null);
    setActive(0);
    setOpen(true);
  }, []);
  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (!restoreFocus) return;
    // Back to where the palette was opened from (a text field for Ctrl+K), else the header button.
    const back = returnTo.current;
    (back && back !== document.body && back.isConnected ? back : triggerRef.current)?.focus();
  }, []);

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.userAgent)), []);
  useEffect(() => setOpen(false), [pathname]);

  // Ctrl/Cmd+K anywhere, also while typing in a field; again to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key?.toLowerCase() !== "k" && e.code !== "KeyK")) return;
      e.preventDefault();
      if (open) close();
      else show();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Esc closes the palette only: caught before the document listeners of a drawer or dialog underneath.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEscape, true);
    };
  }, [open, close]);

  // One request per settled query; typing on aborts the one in flight.
  useEffect(() => {
    if (!open || !debounced || debounced !== term) {
      setState("idle");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    api<SearchResults>(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then((data) => {
        setResults({ q: debounced, data });
        setActive(0);
        setState("idle");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResults(null);
        setState("error");
      });
    return () => controller.abort();
  }, [open, debounced, term, retry]);

  const pending = !!term && (debounced !== term || state === "loading");
  const typed = text.trim().replace(/\s+/g, " ");
  // Page shortcuts first (instant, so the list does not jump when results arrive), then the results.
  const { groups, items } = useMemo(() => {
    const pages = matchPages(user, typed).map((p) => {
      const Icon = PAGE_ICONS[p.href] ?? Search;
      return { key: `page:${p.href}`, href: p.href, title: p.label, lead: <Icon aria-hidden className="h-4 w-4 text-muted-foreground" /> };
    });
    const drafts: Draft[] = [{ key: "pages", label: "Trang", items: pages, query: typed }, ...(term && results ? resultGroups(results.data, results.q) : [])];
    let index = 0;
    const groups: Group[] = drafts.filter((g) => g.items.length).map((g) => ({ ...g, items: g.items.map((item) => ({ ...item, index: index++ })) }));
    return { groups, items: groups.flatMap((g) => g.items) };
  }, [user, typed, term, results]);
  const activeIndex = items.length ? Math.min(active, items.length - 1) : -1;
  const optionId = (i: number) => `${listId}-o${i}`;
  const activeId = activeIndex >= 0 ? optionId(activeIndex) : undefined;
  const answered = !!term && results?.q === term && !pending && state !== "error";

  useEffect(() => {
    if (open && activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeId]);

  const go = (item: Item) => {
    close(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // typing Vietnamese with an IME
    const n = items.length;
    const move = (i: number) => {
      e.preventDefault();
      if (n) setActive(i);
    };
    if (e.key === "ArrowDown") move((activeIndex + 1) % n);
    else if (e.key === "ArrowUp") move((activeIndex - 1 + n) % n);
    else if (e.key === "Home" && n) move(0);
    else if (e.key === "End" && n) move(n - 1);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) go(items[activeIndex]);
    }
  };

  // aria-modal: Tab cycles inside the palette.
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("input, button:not([disabled])"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const shortcut = mac ? "⌘ K" : "Ctrl K";
  const what = finance ? "dự án, công việc, hợp đồng, nhân sự" : "dự án, công việc, nhân sự";
  const status = pending
    ? "Đang tìm…"
    : state === "error"
      ? "Không thể tìm kiếm lúc này"
      : answered
        ? items.length
          ? `${items.length} kết quả cho “${term}”`
          : `Không tìm thấy kết quả cho “${term}”`
        : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => show(triggerRef.current)}
        aria-label="Tìm kiếm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Control+K Meta+K"
        title={`Tìm kiếm (${shortcut})`}
        className="flex items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-56 sm:border sm:bg-card sm:px-3 sm:py-0 sm:text-sm sm:hover:bg-card sm:hover:text-foreground lg:w-64"
      >
        <Search aria-hidden className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" />
        <span className="hidden flex-1 text-left sm:block">Tìm kiếm…</span>
        <kbd className={cn(kbd, "hidden sm:inline-block")}>{shortcut}</kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-start justify-center sm:px-4 sm:pt-[12vh]">
            <div aria-hidden className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => close()} />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Tìm kiếm nhanh"
              onKeyDown={trapTab}
              className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-b-2xl border-b bg-card shadow-pop motion-safe:animate-fade-in sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl sm:border"
            >
              <div className="flex items-center gap-3 border-b px-4">
                <Search aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setActive(0);
                    setState("idle");
                  }}
                  onKeyDown={onKeyDown}
                  role="combobox"
                  aria-label={`Tìm ${what} hoặc trang`}
                  aria-expanded={items.length > 0}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeId}
                  placeholder={`Tìm ${what}…`}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                />
                {pending && <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />}
                <button type="button" onClick={() => close()} aria-label="Đóng" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X aria-hidden className="h-4 w-4 sm:hidden" />
                  <kbd className={cn(kbd, "hidden sm:inline-block")}>Esc</kbd>
                </button>
              </div>

              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
                <div role="listbox" id={listId} aria-label="Kết quả tìm kiếm">
                  {groups.map((g) => (
                    <div key={g.key} role="presentation" className="pb-1">
                      <div id={`${listId}-${g.key}`} aria-hidden className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.label}
                      </div>
                      <div role="group" aria-labelledby={`${listId}-${g.key}`}>
                        {g.items.map((item) => {
                          const selected = item.index === activeIndex;
                          return (
                            <div
                              key={item.key}
                              id={optionId(item.index)}
                              role="option"
                              aria-selected={selected}
                              // Mouse movement only: the list scrolling under a still pointer keeps the keyboard choice.
                              onMouseMove={() => !selected && setActive(item.index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => go(item)}
                              className={cn("mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm", selected && "bg-muted")}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center">{item.lead}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  <Highlight text={item.title} query={g.query} />
                                </span>
                                {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                              </span>
                              {selected && <CornerDownLeft aria-hidden className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {!term && typed && <p className="px-4 py-3 text-xs text-muted-foreground">Nhập ít nhất 2 ký tự để tìm {what}.</p>}
                {pending && !results && (
                  <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Đang tìm…
                  </p>
                )}
                {term && state === "error" && (
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                    <TriangleAlert aria-hidden className="h-4 w-4 shrink-0 text-danger" />
                    <span className="flex-1">Không thể tìm kiếm lúc này.</span>
                    <button type="button" onClick={() => setRetry((n) => n + 1)} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                      Thử lại
                    </button>
                  </div>
                )}
                {answered && !items.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Không tìm thấy kết quả cho “{term}”</p>}
              </div>

              <div className="hidden items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground sm:flex">
                <span className="flex items-center gap-1">
                  <kbd className={kbd}>↑</kbd>
                  <kbd className={kbd}>↓</kbd> chọn
                </span>
                <span className="flex items-center gap-1">
                  <kbd className={kbd}>Enter</kbd> mở
                </span>
                <span className="flex items-center gap-1">
                  <kbd className={kbd}>Esc</kbd> đóng
                </span>
              </div>
              <p role="status" className="sr-only">
                {status}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
