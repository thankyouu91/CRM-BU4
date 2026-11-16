"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ClipboardPlus, Loader2, SendHorizontal, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";
import { CHAT_MAX, chatParts, chatPlain, mentionToken, pendingRef, taskToken, withRefs } from "@/lib/chat";
import type { ChatMessageView, ChatPage, ChatTaskView } from "@/lib/chat-queries";
import { foldSearch, SEARCH_MIN, type SearchResults } from "@/lib/search";
import { cn, formatDate } from "@/lib/utils";
import { AssignModal, type Assigned } from "./assign-modal";
import { MessageContent } from "./message-content";

export interface ChatPerson {
  id: string;
  name: string;
  avatarColor: string;
  jobTitle: string | null;
}

// shortcut: polls every 5 s while the page is visible (no push), fine for one company channel;
// move to a Durable Object WebSocket if many people keep it open all day.
const POLL_MS = 5000;
/** Messages from one person this close together are drawn as one block. */
const GROUP_MS = 5 * 60_000;

// Business time zone on server and browser alike (formatDate), so the page hydrates as rendered.
const timeOf = (iso: string) => formatDate(iso, { hour: "2-digit", minute: "2-digit" });
const dayOf = (iso: string) => formatDate(iso);

function dayLabel(iso: string): string {
  const day = dayOf(iso);
  if (day === dayOf(new Date().toISOString())) return "Hôm nay";
  if (day === dayOf(new Date(Date.now() - 86_400_000).toISOString())) return "Hôm qua";
  return formatDate(iso);
}

type Suggestion = { kind: "user"; id: string; label: string; sub: string | null; color?: string } | { kind: "task"; id: string; label: string; sub: string };

/** Trao đổi chung: one channel for the whole company, with @mentions, #task tags and "Giao việc". */
export function ChatView({ initial, me, isAdmin, people, focusId }: { initial: ChatPage; me: ChatPerson; isAdmin: boolean; people: ChatPerson[]; focusId: string | null }) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initial.messages);
  const [tasks, setTasks] = useState<Record<string, ChatTaskView>>(initial.tasks);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [assign, setAssign] = useState<{ text: string; mentioned: { id: string; name: string }[]; author: string; fromDraft: boolean } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = useRef(initial.messages.at(-1)?.id ?? null);
  /** Bumped once a draft handed to "Giao việc" has been given: the composer clears it. */
  const [sentDraft, setSentDraft] = useState(0);

  const merge = useCallback((page: ChatPage, where: "end" | "start") => {
    setTasks((t) => ({ ...t, ...page.tasks }));
    setMessages((cur) => {
      const known = new Set(cur.map((m) => m.id));
      const fresh = page.messages.filter((m) => !known.has(m.id));
      return where === "end" ? [...cur, ...fresh] : [...fresh, ...cur];
    });
  }, []);

  useEffect(() => {
    lastId.current = messages.at(-1)?.id ?? null;
  }, [messages]);

  const poll = useCallback(async () => {
    try {
      const page = await api<ChatPage>(`/api/chat${lastId.current ? `?after=${lastId.current}` : ""}`);
      if (page.messages.length) merge(page, "end");
    } catch {
      // A missed poll is retried on the next tick.
    }
  }, [merge]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void poll();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll]);

  // Keep the newest message in view, unless the reader scrolled up to read older ones.
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // A link from the bell (?m=<id>): show that message.
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`m-${focusId}`);
    if (!el) return;
    stick.current = false;
    el.scrollIntoView({ block: "center" });
  }, [focusId]);

  const loadOlder = async () => {
    const first = messages[0];
    if (!first) return;
    setLoadingOlder(true);
    const el = list.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    try {
      const page = await api<ChatPage>(`/api/chat?before=${first.id}`);
      stick.current = false;
      merge(page, "start");
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tải được tin cũ");
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (content: string) => {
    const { message } = await api<{ message: ChatMessageView }>("/api/chat", { method: "POST", body: { content } });
    stick.current = true;
    setMessages((cur) => (cur.some((m) => m.id === message.id) ? cur : [...cur, message]));
    void poll(); // picks up the cards of tagged tasks
  };

  const withdraw = async (m: ChatMessageView) => {
    try {
      await api(`/api/chat/${m.id}`, { method: "DELETE" });
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, deleted: true, content: "" } : x)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thu hồi được");
    }
  };

  const assigned = async (a: Assigned, draft: string | null) => {
    const due = a.dueDate ? ` · hạn ${a.dueDate.split("-").reverse().join("/")}` : "";
    const line = a.assignee ? `➜ Đã giao ${taskToken(a.task)} cho ${mentionToken(a.assignee)}${due}` : `➜ Đã tạo việc ${taskToken(a.task)} (chưa có người phụ trách)${due}`;
    try {
      await send(draft ? `${draft}\n${line}` : line);
      toast.success("Đã giao việc");
    } catch (e) {
      toast.error(e instanceof ApiError ? `Đã tạo công việc, nhưng chưa báo được vào kênh: ${e.message}` : "Đã tạo công việc, nhưng chưa báo được vào kênh");
    }
  };

  // The draft held while the "Giao việc" dialog for it is open.
  const pendingDraft = useRef<string | null>(null);

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-card">
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-3 py-3 sm:px-5"
        role="log"
        aria-label="Tin nhắn Trao đổi chung"
        aria-live="polite"
      >
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <Button size="sm" variant="outline" onClick={loadOlder} loading={loadingOlder}>
              Xem tin cũ hơn
            </Button>
          </div>
        )}
        {!messages.length && <p className="py-16 text-center text-sm text-muted-foreground">Chưa có tin nhắn nào. Gõ @ để nhắc một người, # để gắn một công việc.</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
          const grouped = !newDay && prev.author.id === m.author.id && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_MS;
          const mine = m.author.id === me.id;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  {dayLabel(m.createdAt)}
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                id={`m-${m.id}`}
                className={cn("group relative flex gap-3 rounded-lg px-2 hover:bg-muted/50", grouped ? "py-0.5" : "mt-2 py-1", m.id === focusId && "bg-amber-50 dark:bg-amber-500/10")}
              >
                <div className="w-8 shrink-0">{!grouped && <Avatar name={m.author.name} color={m.author.avatarColor} size="sm" />}</div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <p className="text-xs">
                      <span className="font-semibold text-foreground">{m.author.name}</span>
                      {m.author.jobTitle && <span className="text-muted-foreground"> · {m.author.jobTitle}</span>}
                      <time className="ml-2 text-muted-foreground" dateTime={m.createdAt}>
                        {timeOf(m.createdAt)}
                      </time>
                    </p>
                  )}
                  {m.deleted ? (
                    <p className="text-sm italic text-muted-foreground">Tin nhắn đã được thu hồi</p>
                  ) : (
                    <MessageContent content={m.content} tasks={tasks} meId={me.id} />
                  )}
                </div>
                {!m.deleted && (
                  <MessageActions
                    canWithdraw={mine || isAdmin}
                    onAssign={() => {
                      pendingDraft.current = null;
                      setAssign({
                        text: chatPlain(m.content),
                        mentioned: chatParts(m.content).flatMap((p) => (p.kind === "mention" ? [{ id: p.id, name: p.name }] : [])),
                        author: m.author.name,
                        fromDraft: false,
                      });
                    }}
                    onWithdraw={() => withdraw(m)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Composer
        people={people}
        meId={me.id}
        clearKey={sentDraft}
        onSend={send}
        onAssign={(content, plain, mentioned) => {
          pendingDraft.current = content;
          setAssign({ text: plain, mentioned, author: me.name, fromDraft: true });
        }}
      />
      <AssignModal
        open={!!assign}
        onClose={() => setAssign(null)}
        text={assign?.text ?? ""}
        mentioned={assign?.mentioned ?? EMPTY}
        author={assign?.author ?? ""}
        onAssigned={(a) => {
          const draft = assign?.fromDraft ? pendingDraft.current : null;
          pendingDraft.current = null;
          if (assign?.fromDraft) setSentDraft((n) => n + 1);
          void assigned(a, draft);
        }}
      />
    </div>
  );
}

const EMPTY: { id: string; name: string }[] = [];

function MessageActions({ canWithdraw, onAssign, onWithdraw }: { canWithdraw: boolean; onAssign: () => void; onWithdraw: () => void }) {
  return (
    <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm group-focus-within:flex group-hover:flex">
      <button type="button" onClick={onAssign} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted" title="Tạo công việc từ tin nhắn này">
        <ClipboardPlus className="h-3.5 w-3.5" /> Giao việc
      </button>
      {canWithdraw && (
        <button type="button" onClick={onWithdraw} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-danger hover:bg-muted" title="Thu hồi tin nhắn">
          <Undo2 className="h-3.5 w-3.5" /> Thu hồi
        </button>
      )}
    </div>
  );
}

/** The message box: Enter sends, Shift+Enter breaks the line, @ and # open suggestions. */
function Composer({
  people,
  meId,
  clearKey,
  onSend,
  onAssign,
}: {
  people: ChatPerson[];
  meId: string;
  clearKey: number;
  onSend: (content: string) => Promise<void>;
  onAssign: (content: string, plain: string, mentioned: { id: string; name: string }[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [taskHits, setTaskHits] = useState<Suggestion[]>([]);
  const picked = useRef<{ users: { id: string; name: string }[]; tasks: { id: string; title: string }[] }>({ users: [], tasks: [] });
  const box = useRef<HTMLTextAreaElement>(null);

  // Escape closes the list for the "@…" being typed, until another one starts.
  const [dismissed, setDismissed] = useState<number | null>(null);
  const typed = pendingRef(draft.slice(0, caret));
  const ref = typed && typed.start !== dismissed ? typed : null;
  const suggestions: Suggestion[] = useMemo(() => {
    if (!ref) return [];
    if (ref.sign === "#") return taskHits;
    const q = foldSearch(ref.query);
    return people
      .filter((p) => p.id !== meId && (!q || foldSearch(p.name).split(" ").some((w) => w.startsWith(q)) || foldSearch(p.name).startsWith(q)))
      .slice(0, 8)
      .map((p) => ({ kind: "user" as const, id: p.id, label: p.name, sub: p.jobTitle, color: p.avatarColor }));
  }, [ref, people, meId, taskHits]);

  // Task suggestions come from the quick search (what this person may see).
  const taskQuery = ref?.sign === "#" ? ref.query : null;
  useEffect(() => {
    if (taskQuery === null || taskQuery.length < SEARCH_MIN) {
      setTaskHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<SearchResults>(`/api/search?q=${encodeURIComponent(taskQuery)}`, { signal: controller.signal })
        .then((r) => setTaskHits(r.tasks.map((t) => ({ kind: "task", id: t.id, label: t.title, sub: `${t.project.name}${t.assignee ? ` · ${t.assignee}` : ""}` }))))
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [taskQuery]);

  useEffect(() => setActive(0), [ref?.sign, ref?.query]);

  // A draft handed to "Giao việc" is cleared once the work is given.
  useEffect(() => {
    if (!clearKey) return;
    setDraft("");
    picked.current = { users: [], tasks: [] };
  }, [clearKey]);

  const choose = (s: Suggestion) => {
    if (!ref) return;
    const label = s.label.replace(/[[\]\n]/g, " ").trim();
    const insert = `${ref.sign}${label} `;
    const next = draft.slice(0, ref.start) + insert + draft.slice(caret);
    if (s.kind === "user") picked.current.users.push({ id: s.id, name: label });
    else picked.current.tasks.push({ id: s.id, title: label });
    const at = ref.start + insert.length;
    nextCaret.current = at;
    setDraft(next);
    setCaret(at);
  };
  // Put the caret after the inserted name in the same paint, before the next key lands.
  const nextCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (nextCaret.current === null || !box.current) return;
    box.current.focus();
    box.current.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  }, [draft]);

  const content = () => withRefs(draft.trim(), picked.current);

  const submit = async () => {
    const text = content();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setDraft("");
      picked.current = { users: [], tasks: [] };
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không gửi được tin nhắn");
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  };

  const assign = () => {
    const text = content();
    onAssign(text, chatPlain(text), chatParts(text).flatMap((p) => (p.kind === "mention" ? [{ id: p.id, name: p.name }] : [])));
  };

  const open = suggestions.length > 0;
  return (
    <div className="relative border-t p-2 sm:p-3">
      {open && (
        <ul id="chat-suggestions" role="listbox" aria-label={ref?.sign === "@" ? "Chọn người" : "Chọn công việc"} className="absolute bottom-full left-2 right-2 mb-1 max-h-64 overflow-y-auto rounded-xl border bg-card p-1 shadow-lg sm:left-3 sm:right-auto sm:w-96">
          {suggestions.map((s, i) => (
            <li key={`${s.kind}-${s.id}`} id={`chat-suggestion-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === active && "bg-muted")}
              >
                {s.kind === "user" ? <Avatar name={s.label} color={s.color} size="sm" /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">#</span>}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.label}</span>
                  {s.sub && <span className="block truncate text-xs text-muted-foreground">{s.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={box}
          value={draft}
          maxLength={CHAT_MAX}
          rows={Math.min(6, Math.max(1, draft.split("\n").length))}
          placeholder="Nhắn cho mọi người… Gõ @ để nhắc người, # để gắn công việc"
          aria-label="Tin nhắn"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="chat-suggestions"
          aria-activedescendant={open ? `chat-suggestion-${active}` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setCaret(e.target.selectionStart);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setActive((a) => (a + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
              return;
            }
            if (open && (e.key === "Enter" || e.key === "Tab")) {
              e.preventDefault();
              choose(suggestions[active]);
              return;
            }
            if (open && e.key === "Escape") {
              e.preventDefault();
              setDismissed(ref!.start);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          className="min-h-[40px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button variant="outline" onClick={assign} disabled={!draft.trim() || busy} title="Tạo công việc từ nội dung đang soạn rồi gửi vào kênh">
          <ClipboardPlus className="h-4 w-4" /> <span className="hidden sm:inline">Giao việc</span>
        </Button>
        <Button onClick={submit} disabled={!draft.trim() || busy} aria-label="Gửi">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
