"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Globe, Link2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { api, ApiError, useApi } from "@/lib/client";
import { DEFAULT_SHARE_DAYS, SHARE_DAYS, SHARE_STATUS_LABEL, type ShareDays } from "@/lib/report-share-rules";
import type { ShareListItem } from "@/lib/report-share";
import { zonedText } from "@/lib/work-report";
import { cn } from "@/lib/utils";
import { periodQuery, type PeriodState } from "./period-filter";

const DAYS_LABEL: Record<ShareDays, string> = { 1: "1 ngày", 7: "7 ngày", 30: "30 ngày", 90: "90 ngày" };

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.message(value);
    }
  };
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
      <Button type="button" variant="outline" onClick={copy} aria-label={`Sao chép ${label.toLowerCase()}`}>
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? "Đã chép" : "Sao chép"}
      </Button>
    </div>
  );
}

/**
 * Share the presentation of the report on screen: the internal link (needs a login),
 * or a public link for people outside, with an expiry, that can be revoked.
 */
export function ShareDialog({
  open,
  onClose,
  period,
  projectId,
  periodLabel,
  projectName,
  financeAvailable,
}: {
  open: boolean;
  onClose: () => void;
  period: PeriodState;
  projectId: string;
  periodLabel: string;
  projectName: string | null;
  /** The report on screen has contract figures the person may share. */
  financeAvailable: boolean;
}) {
  const list = useApi<{ shares: ShareListItem[]; canShare: boolean }>(open ? "/api/deck-shares" : null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<ShareDays>(DEFAULT_SHARE_DAYS);
  const [includeFinance, setIncludeFinance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const internalUrl = `${origin}/present?${periodQuery(period, projectId)}`;
  const scope = `${periodLabel}${projectName ? ` · ${projectName}` : ""}`;

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ path: string }>("/api/deck-shares", {
        method: "POST",
        body: {
          period: period.type,
          date: period.anchor,
          from: period.type === "custom" ? period.from || null : null,
          to: period.type === "custom" ? period.to || null : null,
          projectId: projectId || null,
          label: label.trim() || null,
          days,
          includeFinance: financeAvailable && includeFinance,
        },
      });
      setCreatedUrl(`${origin}${r.path}`);
      void list.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không tạo được link");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api(`/api/deck-shares/${id}`, { method: "DELETE" });
      toast.success("Đã thu hồi link. Người có link sẽ không mở được nữa.");
      void list.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thu hồi được link");
    } finally {
      setRevoking(null);
    }
  };

  const close = () => {
    setCreatedUrl(null);
    onClose();
  };

  const canShare = list.data?.canShare ?? false;
  const shares = list.data?.shares ?? [];
  // Administrators see everyone's links: then say whose each one is.
  const manyCreators = new Set(shares.map((s) => s.createdBy)).size > 1;

  return (
    <Modal open={open} onClose={close} title="Chia sẻ trình chiếu" description={`Bản trình chiếu báo cáo ${scope}`} size="lg">
      <div className="space-y-6">
        <section aria-labelledby="share-internal">
          <h3 id="share-internal" className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Trong công ty
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">Người đã đăng nhập mở để xem, theo quyền của chính họ.</p>
          <CopyField value={internalUrl} label="Link nội bộ" />
        </section>

        <section aria-labelledby="share-public" className="rounded-xl border p-4">
          <h3 id="share-public" className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-muted-foreground" aria-hidden /> Người ngoài, không cần đăng nhập
          </h3>
          {!list.data ? (
            <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải…
            </p>
          ) : !canShare ? (
            <p className="text-xs text-muted-foreground">Chỉ trưởng nhóm trở lên mới tạo được link công khai. Bạn vẫn gửi được link nội bộ ở trên.</p>
          ) : createdUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Đã tạo link. Hãy sao chép ngay: link chỉ hiện một lần, hệ thống không lưu lại.</p>
              <CopyField value={createdUrl} label="Link công khai" />
              <div className="flex flex-wrap gap-2">
                <a href={createdUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Mở thử như người ngoài
                </a>
                <button type="button" onClick={() => setCreatedUrl(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                  Tạo link khác
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Ai có link đều xem được cả bản trình chiếu: tiến độ, danh sách công việc, người phụ trách, giờ công và trích báo cáo, cho tới khi link hết hạn hoặc bạn thu hồi.
                  Số liệu cập nhật theo lúc mở, trong phạm vi bạn được xem.
                </span>
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <Field label="Tên link (để bạn nhận ra)">
                  <Input value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder={`VD: Gửi đối tác · ${scope}`} />
                </Field>
                <Field label="Hết hạn sau">
                  <Select value={days} onChange={(e) => setDays(Number(e.target.value) as ShareDays)}>
                    {SHARE_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {DAYS_LABEL[d]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {financeAvailable && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={includeFinance} onChange={(e) => setIncludeFinance(e.target.checked)} />
                  <span>
                    Kèm hợp đồng, doanh thu và lợi nhuận
                    <span className="block text-xs text-muted-foreground">Mặc định không kèm: người ngoài chỉ thấy phần công việc.</span>
                  </span>
                </label>
              )}
              <Button onClick={create} loading={busy} disabled={busy}>
                <Globe className="h-4 w-4" /> Tạo link công khai
              </Button>
            </div>
          )}
        </section>

        {canShare && (
          <section aria-labelledby="share-list">
            <h3 id="share-list" className="mb-2 text-sm font-semibold">
              Link công khai đã tạo
            </h3>
            {shares.length ? (
              <ul className="divide-y rounded-xl border">
                {shares.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.label ?? s.periodLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[s.label ? s.periodLabel : null, s.projectName ?? "Toàn bộ dự án", s.includeFinance ? "kèm tài chính" : null, manyCreators ? `bởi ${s.createdBy}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{s.viewCount} lượt xem</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        s.status === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.status === "active" ? `Hết hạn ${zonedText(s.expiresAt)}` : SHARE_STATUS_LABEL[s.status]}
                    </span>
                    {s.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(s.id)} loading={revoking === s.id} disabled={!!revoking}>
                        Thu hồi
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Chưa có link nào.</p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
