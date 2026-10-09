"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Download, ExternalLink, FileText, Loader2, Presentation, Save, Sparkles, Terminal } from "lucide-react";
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

export function AiView({
  projects,
  userName,
  initial,
}: {
  projects: { id: string; name: string; color: string }[];
  userName: string;
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
        description="Đóng gói số liệu thật của dashboard thành yêu cầu chuẩn để Claude viết báo cáo — không cần Claude API, không phát sinh chi phí API."
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

          <Step n={2} title="Gửi sang Claude" desc="Mở Claude.ai với prompt điền sẵn, hoặc tải file để dùng với Claude Code.">
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
              <Button onClick={openClaude} disabled={!prompt}>
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

        <Step n={3} title="Dán kết quả từ Claude" desc="Xem trước, lưu vào ghi chú dự án, hoặc biến dàn ý thành slide để trình chiếu & xuất file.">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Dán câu trả lời của Claude vào đây…"
            className="min-h-[200px] font-mono text-xs"
          />
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
