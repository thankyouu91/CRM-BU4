"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, PlugZap, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, useApi } from "@/lib/client";
import { AI_MODELS, DEFAULT_AI_DAILY_LIMIT, MAX_AI_DAILY_LIMIT, aiModelInfo, looksLikeAnthropicKey, type AiModelId } from "@/lib/ai-models";
import type { AiSettingsView, AiUsage } from "@/lib/ai-settings";
import { formatDateTime } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";

type Data = { settings: AiSettingsView; usage: AiUsage };

const usd = (n: number) => (n < 0.01 && n > 0 ? "< 0,01 USD" : `${n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} USD`);

/**
 * Admin settings: the Claude API key for the built-in AI ("Viết bằng AI" on the AI page),
 * the model, a per-person daily limit and an on/off switch. The key is checked with
 * Anthropic before it is saved and is never shown again, only its last 4 characters.
 */
export function AiSettingsCard() {
  const { data, error, loading, setData } = useApi<Data>("/api/settings/ai");
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [model, setModel] = useState<AiModelId>("claude-opus-5-5");
  const [limit, setLimit] = useState(String(DEFAULT_AI_DAILY_LIMIT));
  const [busy, setBusy] = useState<"key" | "settings" | "toggle" | "test" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const s = data?.settings;
  useEffect(() => {
    if (!s) return;
    setModel(s.model);
    setLimit(String(s.dailyLimit));
  }, [s]);

  const save = async (patch: Record<string, unknown>, what: NonNullable<typeof busy>, done: string) => {
    setBusy(what);
    try {
      const res = await api<{ settings: AiSettingsView }>("/api/settings/ai", { method: "PUT", body: patch });
      setData((d) => (d ? { ...d, settings: res.settings } : d));
      toast.success(done);
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Không lưu được";
      if (what === "key") setKeyError(message);
      else toast.error(message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!looksLikeAnthropicKey(key)) {
      setKeyError("API key phải bắt đầu bằng “sk-ant-” và không có khoảng trắng");
      return;
    }
    setKeyError(null);
    // The first key also switches the AI on; replacing a key keeps the current switch.
    const ok = await save({ apiKey: key, model, ...(s?.key ? {} : { enabled: true }) }, "key", "Đã kiểm tra và lưu API key");
    if (ok) setKeyInput("");
  };

  const limitNumber = Number(limit);
  const limitValid = Number.isInteger(limitNumber) && limitNumber >= 1 && limitNumber <= MAX_AI_DAILY_LIMIT;
  const settingsDirty = !!s && (model !== s.model || (limitValid && limitNumber !== s.dailyLimit));

  const test = async () => {
    setBusy("test");
    try {
      await api("/api/settings/ai/test", { method: "POST" });
      toast.success("Kết nối Claude API hoạt động bình thường");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không kiểm tra được kết nối");
    } finally {
      setBusy(null);
    }
  };

  const status = !s
    ? null
    : !s.key
      ? { label: "Chưa có API key", tone: "bg-muted text-muted-foreground" }
      : !s.key.readable
        ? { label: "Cần nhập lại key", tone: "bg-danger/10 text-danger" }
        : s.enabled
          ? { label: "Đang bật", tone: "bg-success/10 text-success" }
          : { label: "Đang tắt", tone: "bg-warning/10 text-warning" };

  return (
    <Card id="ai" className="scroll-mt-24">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Trợ lý AI (Claude API)
          </span>
        }
        description="Nhập API key của Anthropic để mọi người bấm “Viết bằng AI” ngay trên trang Trợ lý AI. Key được mã hoá trước khi lưu và không bao giờ hiển thị lại. Chỉ quản trị viên thấy mục này."
        action={status && <Badge className={status.tone}>{status.label}</Badge>}
      />
      <CardBody className="space-y-6">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : loading || !s || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <>
            {/* Key */}
            <div className="space-y-3">
              {s.key && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <code className="font-mono text-xs">{s.key.hint}</code>
                  <span className="text-xs text-muted-foreground">
                    Lưu bởi {s.key.setBy || "—"}
                    {s.key.setAt ? ` · ${formatDateTime(s.key.setAt)}` : ""}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={test} loading={busy === "test"} disabled={!s.key.readable}>
                      <PlugZap className="h-3.5 w-3.5" /> Kiểm tra kết nối
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmRemove(true)}>
                      <Trash2 className="h-3.5 w-3.5" /> Xoá key
                    </Button>
                  </div>
                  {!s.key.readable && (
                    <p className="flex w-full items-start gap-1.5 text-xs text-danger">
                      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> Không đọc được key đã lưu vì khoá bí mật của máy chủ đã đổi. Hãy nhập lại key bên dưới.
                    </p>
                  )}
                </div>
              )}
              <Field
                label={s.key ? "Thay API key" : "API key"}
                htmlFor="ai-key"
                error={keyError ?? undefined}
                hint={
                  <>
                    Tạo key tại{" "}
                    <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      Claude Console → API Keys
                    </a>
                    . Nên tạo key riêng cho WorkHub và đặt hạn mức chi tiêu trong Console. Key được kiểm tra với Anthropic trước khi lưu.
                  </>
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="sk-ant-api03-…"
                    value={keyInput}
                    onChange={(e) => {
                      setKeyInput(e.target.value);
                      setKeyError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && keyInput.trim() && saveKey()}
                    className="font-mono"
                  />
                  <Button onClick={saveKey} loading={busy === "key"} disabled={!keyInput.trim()} className="shrink-0">
                    <CheckCircle2 className="h-4 w-4" /> Kiểm tra & lưu
                  </Button>
                </div>
              </Field>
            </div>

            {/* Switch, model, limit */}
            <div className="space-y-4 border-t pt-5">
              <label className={`flex items-start gap-2.5 text-sm ${!s.key?.readable ? "opacity-50" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={s.enabled}
                  disabled={!s.key?.readable || busy === "toggle"}
                  onChange={(e) => save({ enabled: e.target.checked }, "toggle", e.target.checked ? "Đã bật trợ lý AI" : "Đã tắt trợ lý AI")}
                  className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
                />
                <span>
                  Bật “Viết bằng AI” cho mọi người
                  <span className="block text-xs text-muted-foreground">Tắt để tạm ngừng mà vẫn giữ key. Cách sao chép prompt sang Claude.ai luôn dùng được.</span>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Field label="Model" htmlFor="ai-model" hint={`${aiModelInfo(model).note} · ${aiModelInfo(model).inputPerMTok} / ${aiModelInfo(model).outputPerMTok} USD mỗi triệu token vào / ra`}>
                  <Select id="ai-model" value={model} onChange={(e) => setModel(e.target.value as AiModelId)}>
                    {AI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Lượt / người / ngày" htmlFor="ai-limit" error={limitValid ? undefined : `Từ 1 đến ${MAX_AI_DAILY_LIMIT}`}>
                  <Input id="ai-limit" type="number" min={1} max={MAX_AI_DAILY_LIMIT} value={limit} onChange={(e) => setLimit(e.target.value)} />
                </Field>
              </div>
            </div>
            {settingsDirty && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModel(s.model);
                    setLimit(String(s.dailyLimit));
                  }}
                >
                  Huỷ
                </Button>
                <Button size="sm" loading={busy === "settings"} disabled={!limitValid} onClick={() => save({ model, dailyLimit: limitNumber }, "settings", "Đã lưu cài đặt AI")}>
                  Lưu thay đổi
                </Button>
              </div>
            )}

            {/* Usage */}
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">{data.usage.days} ngày qua</p>
              <p className="mt-1">
                <b>{data.usage.reports.toLocaleString("vi-VN")}</b> lượt dùng (báo cáo &amp; chat) · <b>{data.usage.people}</b> người dùng ·{" "}
                {(data.usage.inputTokens + data.usage.outputTokens).toLocaleString("vi-VN")} token · ước tính <b>{usd(data.usage.costUsd)}</b>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Ước tính theo bảng giá niêm yết. Số tiền thực tế xem trong Claude Console.</p>
            </div>
          </>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        danger
        title="Xoá API key?"
        confirmLabel="Xoá key"
        message="Trợ lý AI tích hợp sẽ tắt cho mọi người. Cách sao chép prompt sang Claude.ai vẫn dùng được. Key trên Anthropic không bị thu hồi: nếu không dùng nữa, hãy xoá nó trong Claude Console."
        onConfirm={async () => {
          await save({ apiKey: null }, "key", "Đã xoá API key");
          setConfirmRemove(false);
        }}
      />
    </Card>
  );
}
