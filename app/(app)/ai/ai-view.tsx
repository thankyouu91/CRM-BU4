"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, Download, ExternalLink, FileText, Loader2, Presentation, Save, Settings, Sparkles, Square, Terminal, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Markdown } from "@/components/markdown";
import { DeckActions } from "@/components/deck/export-actions";
import { PeriodFilter, defaultPeriod, periodQuery, type PeriodState, type ReportPeriod } from "@/components/reports/period-filter";
import { AI_PROMPT_KINDS, buildReportPrompt, type AIPromptKind } from "@/lib/ai-prompt";
import { api, ApiError, useApi } from "@/lib/client";
import { parseEvents } from "@/lib/ai-stream";
import { buildOutlineDeck, makeDeckMeta, parseOutline } from "@/lib/deck-model";
import { fileSlug, saveBlob } from "@/lib/export/save";
import type { Summary } from "@/lib/stats";
import { cn } from "@/lib/utils";

const CLAUDE_URL = "https://claude.ai/new";
const MAX_URL_PROMPT = 6000; // keep prefilled links well under URL length limits

function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

/** The built-in AI (server-side Claude API), when an admin has set it up. */
export type BuiltInAi = { ready: true; modelLabel: string; limit: number; remaining: number } | { ready: false; canEnable: boolean };

export function AiView({
  projects,
  userName,
  builtIn,
  initial,
}: {
  projects: { id: string; name: string; color: string }[];
  userName: string;
  builtIn: BuiltInAi;
  initial: { type: ReportPeriod; anchor: string; from: string; to: string; projectId: string };
}) {
  const [kind, setKind] = useState<AIPromptKind>("executive-summary");
  const [period, setPeriod] = useState<PeriodState>(() => ({
    ...defaultPeriod(initial.type),
    ...(initial.anchor ? { anchor: initial.anchor } : {}),
    from: initial.from,
    to: initial.to,
  }));
  const [projectId, setProjectId] = useState(initial.projectId);
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  // Built-in generation: "waiting" until the first words arrive, then "writing".
  const [gen, setGen] = useState<"idle" | "waiting" | "writing">("idle");
  const [genInfo, setGenInfo] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(builtIn.ready ? builtIn.remaining : 0);
  const abortRef = useRef<AbortController | null>(null);

  const customIncomplete = period.type === "custom" && (!period.from || !period.to);
  const { data, loading } = useApi<Summary>(customIncomplete ? null : `/api/reports/summary?${periodQuery(period, projectId)}`);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? null;
  const scopeLabel = projectName ? `Dự án “${projectName}”` : "Toàn bộ dự án";
  const prompt = useMemo(() => (data ? buildReportPrompt(kind, data, scopeLabel) : ""), [data, kind, scopeLabel]);

  const outline = useMemo(() => parseOutline(answer), [answer]);
  const deck = useMemo(() => {
    if (outline.length < 2 || !data) return null;
    const kindLabel = AI_PROMPT_KINDS.find((k) => k.value === kind)?.label ?? "Báo cáo";
    return buildOutlineDeck(outline, makeDeckMeta(data.period.label, projectName, userName, `${kindLabel}${projectName ? ` · ${projectName}` : ""}`));
  }, [outline, data, projectName, userName, kind]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Đã sao chép prompt");
      return true;
    } catch {
      toast.error("Trình duyệt chặn sao chép — hãy bôi đen và sao chép thủ công");
      return false;
    }
  };

  const openClaude = async () => {
    await copy();
    const url = prompt.length <= MAX_URL_PROMPT ? `${CLAUDE_URL}?q=${encodeURIComponent(prompt)}` : CLAUDE_URL;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.message("Đã mở Claude", { description: "Prompt đã được sao chép — nếu ô chat trống, hãy dán (Ctrl/Cmd + V)." });
  };

  const generate = async () => {
    if (!builtIn.ready || gen !== "idle") return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGen("waiting");
    setGenInfo(null);
    setAnswer("");
    let text = "";
    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, period: period.type, date: period.anchor, from: period.from, to: period.to, projectId: projectId || null }),
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
            text += e.v;
            setAnswer(text);
            setGen("writing");
          } else if (e.t === "done") {
            setRemaining(e.remaining);
            setGenInfo(`${builtIn.modelLabel} · ${(e.inputTokens + e.outputTokens).toLocaleString("vi-VN")} token${e.truncated ? " · bài bị cắt do quá dài" : ""}`);
            toast.success("Claude đã viết xong báo cáo");
          } else if (e.t === "refused") {
            setAnswer("");
            toast.error(e.message);
          } else if (e.t === "error") {
            throw new Error(e.message);
          }
        }
      }
    } catch (e) {
      if (controller.signal.aborted) toast.message("Đã dừng viết");
      else toast.error(e instanceof Error ? e.message : "Không gọi được trợ lý AI");
    } finally {
      abortRef.current = null;
      setGen("idle");
    }
  };

  const fileBase = fileSlug(`${AI_PROMPT_KINDS.find((k) => k.value === kind)?.label ?? "bao-cao"} ${data?.period.label ?? ""}`);

  const downloadForClaudeCode = () => {
    if (!data) return;
    const body = `${prompt}\n\n---\nDỮ LIỆU GỐC (JSON) — chỉ dùng để tra cứu, không bịa thêm:\n\n\`\`\`json\n${JSON.stringify(
      { period: data.period, kpis: data.kpis, projects: data.projects, people: data.people, upcoming: data.upcoming },
      null,
      2,
    )}\n\`\`\`\n`;
    saveBlob(new Blob([body], { type: "text/markdown;charset=utf-8" }), `${fileBase}-prompt.md`);
  };

  const saveAsNote = async () => {
    if (!projectId || !answer.trim()) return;
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/notes`, { method: "POST", body: { type: "NOTE", content: answer.trim() } });
      toast.success("Đã lưu vào ghi chú dự án");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể lưu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Trợ lý AI báo cáo"
        description={
          builtIn.ready
            ? "Claude viết báo cáo ngay trên trang từ số liệu thật của hệ thống, theo đúng quyền xem của bạn. Vẫn có thể sao chép prompt sang Claude.ai hoặc Claude Code."
            : "Đóng gói số liệu thật của dashboard thành yêu cầu chuẩn để Claude viết báo cáo — không cần Claude API, không phát sinh chi phí API."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Step n={1} title="Chọn loại báo cáo & phạm vi" desc="Số liệu được lấy trực tiếp từ hệ thống theo kỳ đã chọn.">
            <div className="grid gap-3 sm:grid-cols-2">
              {AI_PROMPT_KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "rounded-xl border p-3.5 text-left transition",
                    kind === k.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {k.value === "slide-deck" ? <Presentation className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                    {k.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{k.desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              <PeriodFilter value={period} onChange={setPeriod} label={data?.period.label ?? "…"} />
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-9 w-full max-w-sm rounded-lg border bg-card px-2 text-sm"
                aria-label="Phạm vi dự án"
              >
                <option value="">Tất cả dự án</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </Step>

          <Step
            n={2}
            title={builtIn.ready ? "Viết bằng AI" : "Gửi sang Claude"}
            desc={
              builtIn.ready
                ? "Claude viết ngay trên trang từ đúng số liệu bên dưới. Hoặc mở Claude.ai, tải file cho Claude Code."
                : "Mở Claude.ai với prompt điền sẵn, hoặc tải file để dùng với Claude Code."
            }
          >
            {builtIn.ready ? (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                {gen === "idle" ? (
                  <Button onClick={generate} disabled={!prompt || remaining <= 0}>
                    <Wand2 className="h-4 w-4" /> Viết bằng AI
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                    <Square className="h-3.5 w-3.5" /> Dừng
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {gen === "waiting" ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claude đang đọc số liệu…
                    </span>
                  ) : gen === "writing" ? (
                    "Claude đang viết…"
                  ) : (
                    <>
                      {builtIn.modelLabel} · còn <b className="text-foreground">{remaining}</b>/{builtIn.limit} lượt hôm nay
                    </>
                  )}
                </p>
              </div>
            ) : (
              builtIn.canEnable && (
                <p className="mb-4 flex items-center gap-1.5 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                  <Settings className="h-3.5 w-3.5" /> Muốn Claude viết ngay trên trang?
                  <Link href="/settings#ai" className="font-medium text-primary hover:underline">
                    Nhập Claude API key trong Cài đặt
                  </Link>
                </p>
              )
            )}
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/60">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <pre className="scrollbar-thin max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                {customIncomplete ? "Chọn ngày bắt đầu và kết thúc…" : prompt || "Đang tải số liệu…"}
              </pre>
              <p className="mt-2 text-right text-[11px] text-muted-foreground">{prompt.length.toLocaleString("vi-VN")} ký tự</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={builtIn.ready ? "outline" : "primary"} onClick={openClaude} disabled={!prompt}>
                <Sparkles className="h-4 w-4" /> Mở Claude.ai <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </Button>
              <Button variant="outline" onClick={copy} disabled={!prompt}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <ClipboardCopy className="h-4 w-4" />} Sao chép prompt
              </Button>
              <Button variant="outline" onClick={downloadForClaudeCode} disabled={!prompt}>
                <Download className="h-4 w-4" /> Tải cho Claude Code
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Terminal className="h-3.5 w-3.5" /> Dùng với Claude Code
              </p>
              <p className="mt-1">Tải file rồi chạy trong thư mục chứa file:</p>
              <code className="mt-1.5 block overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground">
                claude -p &quot;$(cat {fileBase}-prompt.md)&quot;
              </code>
            </div>
          </Step>
        </div>

        <Step
          n={3}
          title={builtIn.ready ? "Kết quả" : "Dán kết quả từ Claude"}
          desc="Xem trước, lưu vào ghi chú dự án, hoặc biến dàn ý thành slide để trình chiếu & xuất file."
        >
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={builtIn.ready ? "Bấm “Viết bằng AI”, hoặc dán câu trả lời của Claude vào đây…" : "Dán câu trả lời của Claude vào đây…"}
            readOnly={gen !== "idle"}
            className="min-h-[200px] font-mono text-xs"
          />
          {genInfo && gen === "idle" && <p className="mt-2 text-right text-[11px] text-muted-foreground">{genInfo}</p>}
          {answer.trim() && (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {deck ? (
                    <span className="font-medium text-success">Nhận diện {outline.length} slide — sẵn sàng trình chiếu</span>
                  ) : (
                    "Mẹo: dùng loại “Dàn ý trình chiếu” để Claude trả về định dạng slide."
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {projectId && (
                    <Button size="sm" variant="outline" onClick={saveAsNote} loading={saving}>
                      <Save className="h-3.5 w-3.5" /> Lưu vào ghi chú dự án
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveBlob(new Blob([answer], { type: "text/markdown;charset=utf-8" }), `${fileBase}.md`)}
                  >
                    <Download className="h-3.5 w-3.5" /> Tải .md
                  </Button>
                </div>
              </div>
              {deck && (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <DeckActions deck={deck} />
                </div>
              )}
              <div className="scrollbar-thin mt-4 max-h-[520px] overflow-y-auto rounded-xl border p-5">
                <Markdown text={answer} />
              </div>
            </>
          )}
        </Step>
      </div>
    </div>
  );
}
