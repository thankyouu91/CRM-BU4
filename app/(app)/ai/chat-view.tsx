"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, ClipboardCopy, Database, MessageSquarePlus, Presentation, RotateCcw, Save, Settings, Sparkles, Square, User } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";
import { DeckActions } from "@/components/deck/export-actions";
import { PeriodFilter, defaultPeriod, type PeriodState } from "@/components/reports/period-filter";
import { api, ApiError } from "@/lib/client";
import { parseEvents } from "@/lib/ai-stream";
import { parseDate, resolvePeriod } from "@/lib/period";
import { buildOutlineDeck, makeDeckMeta, parseOutline } from "@/lib/deck-model";
import {
  CHAT_AUDIENCES,
  CHAT_LENGTHS,
  CHAT_MAX_CHARS,
  CHAT_TEMPLATE_GROUPS,
  chatHistoryForApi,
  chatTemplatesFor,
  type ChatAudience,
  type ChatLength,
  type ChatTemplate,
  type ChatTemplateGroup,
} from "@/lib/ai-chat";
import { cn } from "@/lib/utils";
import type { BuiltInAi } from "./ai-view";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Assistant only: still arriving, finished, stopped by the person, or failed. */
  status?: "streaming" | "done" | "stopped" | "error";
  info?: string;
}

interface ChatSettings {
  includeData: boolean;
  projectId: string;
  period: PeriodState;
  length: ChatLength;
  audience: ChatAudience;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** Per browser tab: the conversation survives reloads but not closing the tab (shared computers). */
function storageKey(userId: string) {
  return `workhub.ai-chat.v1.${userId}`;
}

function loadSaved(userId: string): { messages: ChatMessage[]; settings: Partial<ChatSettings> } | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as { messages?: ChatMessage[]; settings?: Partial<ChatSettings> };
    const messages = (v.messages ?? []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
    // A reply that was still arriving when the page closed is kept as stopped.
    return { messages: messages.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" } : m)), settings: v.settings ?? {} };
  } catch {
    return null;
  }
}

export function ChatView({
  userId,
  userName,
  projects,
  builtIn,
  canFinance,
  initialProjectId,
}: {
  userId: string;
  userName: string;
  projects: { id: string; name: string; color: string }[];
  builtIn: BuiltInAi;
  canFinance: boolean;
  initialProjectId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(() => ({
    includeData: true,
    projectId: initialProjectId,
    period: defaultPeriod("month"),
    length: "balanced",
    audience: "general",
  }));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(builtIn.ready ? builtIn.remaining : 0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [slidesFor, setSlidesFor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const templates = useMemo(() => chatTemplatesFor(canFinance), [canFinance]);
  const groups = useMemo(() => {
    const by = new Map<ChatTemplateGroup, ChatTemplate[]>();
    for (const t of templates) by.set(t.group, [...(by.get(t.group) ?? []), t]);
    return [...by.entries()];
  }, [templates]);

  const projectName = projects.find((p) => p.id === settings.projectId)?.name ?? null;
  const periodLabel = useMemo(() => {
    const p = settings.period;
    if (p.type === "custom" && (!p.from || !p.to)) return "Chọn khoảng ngày";
    return resolvePeriod(p.type, parseDate(p.anchor), { from: p.from ? parseDate(p.from) : null, to: p.to ? parseDate(p.to) : null }).label;
  }, [settings.period]);

  // Restore this tab's conversation once, then keep it saved.
  useEffect(() => {
    const saved = loadSaved(userId);
    if (saved) {
      setMessages(saved.messages);
      setSettings((s) => ({
        ...s,
        ...saved.settings,
        period: saved.settings.period ?? s.period,
        projectId: saved.settings.projectId !== undefined && projects.some((p) => p.id === saved.settings.projectId) ? saved.settings.projectId : s.projectId,
      }));
    }
    setLoaded(true);
  }, [userId, projects]);
  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(storageKey(userId), JSON.stringify({ messages: messages.slice(-60), settings }));
    } catch {
      // Storage full or blocked: the chat still works, it just won't survive a reload.
    }
  }, [messages, settings, loaded, userId]);

  // Follow the answer as it arrives, unless the person scrolled up to read.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const set = (patch: Partial<ChatSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const applyTemplate = (t: ChatTemplate) => {
    setInput(t.prompt);
    set({ ...(t.length ? { length: t.length } : {}), ...(t.audience ? { audience: t.audience } : {}), includeData: true });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(t.prompt.length, t.prompt.length);
    });
  };

  const ask = useCallback(
    async (question: string, base: ChatMessage[]) => {
      if (!builtIn.ready || busy) return;
      const text = question.trim();
      if (!text) return;
      if (settings.includeData && settings.period.type === "custom" && (!settings.period.from || !settings.period.to)) {
        toast.error("Hãy chọn đủ ngày bắt đầu và kết thúc cho kỳ tùy chọn");
        return;
      }
      const userMsg: ChatMessage = { id: newId(), role: "user", content: text.slice(0, CHAT_MAX_CHARS) };
      const reply: ChatMessage = { id: newId(), role: "assistant", content: "", status: "streaming" };
      const history = chatHistoryForApi(base);
      setMessages([...base, userMsg, reply]);
      setInput("");
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const update = (patch: Partial<ChatMessage>) => setMessages((all) => all.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)));
      let answer = "";
      try {
        const p = settings.period;
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: userMsg.content }],
            options: {
              includeData: settings.includeData,
              projectId: settings.projectId || null,
              period: p.type,
              date: p.anchor,
              ...(p.type === "custom" ? { from: p.from, to: p.to } : {}),
              length: settings.length,
              audience: settings.audience,
            },
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Không gọi được trợ lý AI");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseEvents(buffer);
          buffer = rest;
          for (const e of events) {
            if (e.t === "text") {
              answer += e.v;
              update({ content: answer });
            } else if (e.t === "done") {
              setRemaining(e.remaining);
              update({ status: "done", info: e.truncated ? "Câu trả lời bị cắt vì quá dài" : undefined });
            } else if (e.t === "refused") {
              update({ status: "error", content: e.message });
            } else if (e.t === "error") {
              throw new Error(e.message);
            }
          }
        }
        setMessages((all) => all.map((m) => (m.id === reply.id && m.status === "streaming" ? { ...m, status: "done" } : m)));
      } catch (e) {
        if (controller.signal.aborted) update({ status: "stopped" });
        else update({ status: "error", content: answer || (e instanceof Error ? e.message : "Không gọi được trợ lý AI") });
      } finally {
        abortRef.current = null;
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [builtIn.ready, busy, settings],
  );

  const send = () => void ask(input, messages);
  const stop = () => abortRef.current?.abort();
  const regenerate = () => {
    // Ask the last question again, without its previous answer.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.findIndex((m) => m.id === lastUser.id);
    void ask(lastUser.content, messages.slice(0, idx));
  };
  const newChat = () => {
    if (busy) stop();
    setMessages([]);
    setSlidesFor(null);
    setInput("");
  };

  const copy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 2000);
    } catch {
      toast.error("Trình duyệt chặn sao chép — hãy bôi đen và sao chép thủ công");
    }
  };

  const saveAsNote = async (m: ChatMessage) => {
    if (!settings.projectId) return;
    try {
      await api(`/api/projects/${settings.projectId}/notes`, { method: "POST", body: { type: "NOTE", content: m.content.trim() } });
      toast.success(`Đã lưu vào ghi chú dự án “${projectName}”`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể lưu");
    }
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const tooLong = input.length > CHAT_MAX_CHARS;

  const options = (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            checked={settings.includeData}
            onChange={(e) => set({ includeData: e.target.checked })}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Database className="h-3.5 w-3.5 text-primary" /> Kèm số liệu hệ thống
            </span>
            <span className="block text-xs text-muted-foreground">Tiến độ, công việc, nhân sự{canFinance ? ", hợp đồng" : ""} theo quyền xem của bạn.</span>
          </span>
        </label>
      </div>
      <div className={cn("space-y-3", !settings.includeData && "pointer-events-none opacity-50")} aria-disabled={!settings.includeData}>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Phạm vi</p>
          <Select value={settings.projectId} onChange={(e) => set({ projectId: e.target.value })} aria-label="Phạm vi dự án">
            <option value="">Toàn bộ dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Kỳ số liệu</p>
          <PeriodFilter value={settings.period} onChange={(period) => set({ period })} label={periodLabel} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Độ dài</p>
          <Select value={settings.length} onChange={(e) => set({ length: e.target.value as ChatLength })} aria-label="Độ dài câu trả lời">
            {(Object.keys(CHAT_LENGTHS) as ChatLength[]).map((k) => (
              <option key={k} value={k}>
                {CHAT_LENGTHS[k].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Người đọc</p>
          <Select value={settings.audience} onChange={(e) => set({ audience: e.target.value as ChatAudience })} aria-label="Đối tượng đọc">
            {(Object.keys(CHAT_AUDIENCES) as ChatAudience[]).map((k) => (
              <option key={k} value={k}>
                {CHAT_AUDIENCES[k].label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );

  const templateList = (compact: boolean) => (
    <div className="space-y-3">
      {groups.map(([group, items]) => (
        <div key={group}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CHAT_TEMPLATE_GROUPS[group]}</p>
          <div className={cn("flex flex-wrap gap-1.5", !compact && "sm:grid sm:grid-cols-2")}>
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                disabled={busy}
                title={t.prompt}
                className="rounded-lg border bg-card px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        {options}
        <Card className="hidden p-4 lg:block">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Prompt mẫu
          </p>
          {templateList(true)}
        </Card>
      </aside>

      <Card className="flex h-[calc(100dvh-14rem)] min-h-[520px] flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {builtIn.ready ? (
              <>
                {builtIn.modelLabel} · còn {remaining}/{builtIn.limit} lượt hôm nay
                {settings.includeData ? ` · ${projectName ?? "Toàn bộ dự án"} · ${periodLabel}` : " · không kèm số liệu"}
              </>
            ) : (
              "Trợ lý AI tích hợp chưa được bật"
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={newChat} disabled={!messages.length && !input}>
            <MessageSquarePlus className="h-3.5 w-3.5" /> Cuộc trò chuyện mới
          </Button>
        </div>

        <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
          {!builtIn.ready && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium">Chưa bật trợ lý AI tích hợp (Claude API).</p>
              <p className="mt-1 text-muted-foreground">
                {builtIn.canEnable ? "Bạn là quản trị viên: thêm API key Anthropic để bật chat." : "Hãy nhờ quản trị viên bật trong Cài đặt."} Trong lúc đó, tab “Sao chép prompt” vẫn dùng được với Claude.ai.
              </p>
              {builtIn.canEnable && (
                <Link href="/settings" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <Settings className="h-4 w-4" /> Mở Cài đặt → Trợ lý AI
                </Link>
              )}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-6">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold">Hỏi trợ lý AI về dự án của bạn</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hỏi tự do hoặc chọn một prompt mẫu. Với “Kèm số liệu hệ thống”, Claude trả lời từ số liệu thật theo phạm vi và kỳ đã chọn.
                </p>
              </div>
              <div className="lg:hidden">{templateList(false)}</div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end gap-2">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">{m.content}</div>
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                  </span>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 max-w-[92%] flex-1">
                    <div className={cn("rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm", m.status === "error" && "border-danger/40 bg-danger/5")}>
                      {m.content ? (
                        m.status === "error" && !m.content.includes("\n") ? <p className="text-danger">{m.content}</p> : <Markdown text={m.content} />
                      ) : m.status !== "streaming" ? (
                        <p className="text-muted-foreground">Đã dừng trước khi Claude trả lời.</p>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                          <span className="ml-2 text-xs">Claude đang đọc số liệu…</span>
                        </span>
                      )}
                    </div>
                    {m.status !== "streaming" && m.content && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {m.status === "stopped" && <span className="mr-1">Đã dừng.</span>}
                        {m.info && <span className="mr-1">{m.info}.</span>}
                        <button type="button" onClick={() => copy(m)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground">
                          {copiedId === m.id ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} Sao chép
                        </button>
                        {m.id === lastAssistantId && (
                          <button type="button" onClick={regenerate} disabled={busy || !builtIn.ready} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground disabled:opacity-50">
                            <RotateCcw className="h-3.5 w-3.5" /> Tạo lại
                          </button>
                        )}
                        {settings.projectId && m.status !== "error" && (
                          <button type="button" onClick={() => saveAsNote(m)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground">
                            <Save className="h-3.5 w-3.5" /> Lưu vào ghi chú dự án
                          </button>
                        )}
                        {parseOutline(m.content).length >= 2 && (
                          <button
                            type="button"
                            onClick={() => setSlidesFor((id) => (id === m.id ? null : m.id))}
                            className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground", slidesFor === m.id && "bg-muted text-foreground")}
                          >
                            <Presentation className="h-3.5 w-3.5" /> Trình chiếu / xuất file
                          </button>
                        )}
                      </div>
                    )}
                    {slidesFor === m.id && (
                      <div className="mt-2 rounded-xl border bg-muted/30 p-3">
                        <DeckActions deck={buildOutlineDeck(parseOutline(m.content), makeDeckMeta(periodLabel, projectName, userName, "Báo cáo từ trợ lý AI"))} />
                      </div>
                    )}
                  </div>
                </div>
              ),
            )
          )}
        </div>

        <div className="border-t p-3">
          <div className={cn("flex items-end gap-2 rounded-xl border bg-card p-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20", tooLong && "border-danger")}>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (!busy && !tooLong) send();
                }
              }}
              rows={2}
              disabled={!builtIn.ready}
              placeholder={builtIn.ready ? "Hỏi về tiến độ, rủi ro, nhân sự… (Enter để gửi, Shift + Enter xuống dòng)" : "Trợ lý AI chưa được bật"}
              className="max-h-48 min-h-[44px] resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus:border-transparent focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Câu hỏi cho trợ lý AI"
            />
            {busy ? (
              <Button variant="outline" size="icon" onClick={stop} aria-label="Dừng">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={send} disabled={!builtIn.ready || !input.trim() || tooLong || remaining <= 0} aria-label="Gửi">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className={cn("mt-1.5 px-1 text-[11px] text-muted-foreground", tooLong && "text-danger")}>
            {tooLong
              ? `Câu hỏi quá dài (${input.length.toLocaleString("vi-VN")}/${CHAT_MAX_CHARS.toLocaleString("vi-VN")} ký tự).`
              : builtIn.ready && remaining <= 0
                ? "Bạn đã dùng hết lượt AI hôm nay."
                : "AI có thể nhầm lẫn: hãy kiểm tra số liệu quan trọng trước khi gửi đi."}
          </p>
        </div>
      </Card>
    </div>
  );
}
