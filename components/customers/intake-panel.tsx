"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Link2, Loader2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { api, ApiError, useApi } from "@/lib/client";
import { CONTACT_LEVEL_INFO, type CustomerDto } from "@/lib/customers";
import { INTAKE_DAYS, INTAKE_STATUS, type IntakeAiReview } from "@/lib/customer-intake";
import type { IntakeLinkView, IntakeSubmissionView } from "@/lib/customer-intake-queries";
import { SHARE_STATUS_LABEL } from "@/lib/report-share-rules";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const failure = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const VERDICT: Record<IntakeAiReview["verdict"], { label: string; tone: string }> = {
  ok: { label: "Hợp lý", tone: "text-success" },
  check: { label: "Cần xem lại", tone: "text-warning" },
  suspicious: { label: "Đáng ngờ", tone: "text-danger" },
};

/**
 * Form thông tin doanh nghiệp (Quản lý khách hàng): public links companies fill in, and the
 * answers waiting here until someone adds them, merges them into a listed company, or turns them down.
 */
export function IntakePanel({
  open,
  onClose,
  customers,
  onCustomer,
  onDecided,
}: {
  open: boolean;
  onClose: () => void;
  customers: CustomerDto[];
  onCustomer: (c: CustomerDto) => void;
  onDecided: () => void;
}) {
  const [tab, setTab] = useState<"queue" | "links">("queue");
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Form thông tin doanh nghiệp" description="Gửi link cho doanh nghiệp tự điền; thông tin chỉ vào danh sách khi bạn duyệt.">
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "queue" as const, label: "Chờ duyệt" },
          { value: "links" as const, label: "Link form" },
        ]}
      />
      {tab === "queue" ? <Queue customers={customers} onCustomer={onCustomer} onDecided={onDecided} /> : <Links />}
    </Modal>
  );
}

function Queue({ customers, onCustomer, onDecided }: { customers: CustomerDto[]; onCustomer: (c: CustomerDto) => void; onDecided: () => void }) {
  const { data, setData, loading } = useApi<{ submissions: IntakeSubmissionView[] }>("/api/customer-intake/submissions");
  const pending = data?.submissions.filter((s) => s.status === "PENDING") ?? [];
  const decided = data?.submissions.filter((s) => s.status !== "PENDING") ?? [];
  const put = (s: IntakeSubmissionView) => setData((d) => (d ? { submissions: d.submissions.map((x) => (x.id === s.id ? s : x)) } : d));

  if (!data) return <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" aria-label="Đang tải" />;
  return (
    <div className="space-y-4">
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải" />}
      {pending.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Không có thông tin nào chờ duyệt.</p>}
      {pending.map((s) => (
        <SubmissionCard
          key={s.id}
          s={s}
          customers={customers}
          onChange={(next) => {
            put(next);
            if (next.status !== "PENDING") onDecided();
          }}
          onCustomer={onCustomer}
        />
      ))}
      {decided.length > 0 && (
        <details className="rounded-lg border px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Đã xử lý gần đây ({decided.length})</summary>
          <ul className="mt-2 divide-y">
            {decided.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                <span className="font-medium">{s.data.name}</span>
                <span className="text-xs text-muted-foreground">
                  {INTAKE_STATUS[s.status]} · {s.reviewedBy ?? "—"} · {formatDateTime(s.reviewedAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SubmissionCard({ s, customers, onChange, onCustomer }: { s: IntakeSubmissionView; customers: CustomerDto[]; onChange: (s: IntakeSubmissionView) => void; onCustomer: (c: CustomerDto) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [mergeId, setMergeId] = useState("");
  const d = s.data;
  const dup = s.duplicates[0];
  const rows = [
    ["Mã số thuế", d.taxCode],
    ["Lĩnh vực", d.industry],
    ["Điện thoại", d.phone],
    ["Email", d.email],
    ["Website", d.website],
    ["Địa chỉ", d.address],
  ].filter(([, v]) => v);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
    } finally {
      setBusy(null);
    }
  };
  const askAi = () =>
    run("ai", async () => {
      try {
        const { review } = await api<{ review: IntakeAiReview }>(`/api/customer-intake/submissions/${s.id}/ai`, { method: "POST" });
        onChange({ ...s, aiReview: review });
      } catch (e) {
        toast.error(failure(e, "AI chưa kiểm tra được"));
      }
    });
  const decide = (body: { action: "approve" } | { action: "merge"; customerId: string } | { action: "reject" }, done: string) =>
    run(body.action, async () => {
      try {
        const res = await api<{ customer: CustomerDto | null }>(`/api/customer-intake/submissions/${s.id}`, { method: "POST", body });
        if (res.customer) onCustomer(res.customer);
        onChange({ ...s, status: body.action === "approve" ? "APPROVED" : body.action === "merge" ? "MERGED" : "REJECTED" });
        toast.success(done);
      } catch (e) {
        toast.error(failure(e, "Không lưu được, thử lại sau"));
      }
    });

  return (
    <article className="rounded-xl border">
      <header className="flex flex-wrap items-baseline gap-x-2 border-b px-4 py-3">
        <h3 className="font-semibold">{d.name}</h3>
        {dup ? (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Khách cũ: {dup.name}</span>
        ) : (
          <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">Khách mới</span>
        )}
        <span className="text-xs text-muted-foreground">
          qua “{s.linkLabel}” · {formatDateTime(s.createdAt)}
        </span>
      </header>
      <div className="space-y-3 px-4 py-3 text-sm">
        {rows.length > 0 && (
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {d.note && <p className="whitespace-pre-line text-foreground/80">{d.note}</p>}
        {d.contacts.length > 0 && (
          <ul className="space-y-1">
            {d.contacts.map((c, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium text-sm">{c.name}</span> · {CONTACT_LEVEL_INFO[c.level].label}
                {c.title && ` · ${c.title}`}
                {[c.phone, c.email].filter(Boolean).length > 0 && <span className="text-muted-foreground"> · {[c.phone, c.email].filter(Boolean).join(" · ")}</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Kiểm tra tự động</p>
          {s.checks.length ? (
            <ul className="space-y-0.5">
              {s.checks.map((c, i) => (
                <li key={i} className={cn("flex items-start gap-1.5 text-xs", c.level === "error" ? "text-danger" : "text-warning")}>
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {c.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <Check className="h-3 w-3" aria-hidden /> Đủ thông tin, đúng định dạng, không trùng
            </p>
          )}
        </div>

        <div className="rounded-lg border border-dashed px-3 py-2">
          <div className="flex items-center gap-2">
            <p className="mr-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI kiểm tra
            </p>
            <Button size="sm" variant="ghost" onClick={askAi} disabled={!!busy}>
              {busy === "ai" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {s.aiReview ? "Kiểm tra lại" : "Kiểm tra"}
            </Button>
          </div>
          {s.aiReview ? (
            <div className="mt-1 text-xs">
              <p>
                <span className={cn("font-semibold", VERDICT[s.aiReview.verdict].tone)}>{VERDICT[s.aiReview.verdict].label}</span> · {s.aiReview.summary}
              </p>
              {s.aiReview.issues.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground/80">
                  {s.aiReview.issues.map((i, k) => (
                    <li key={k}>{i.message}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-muted-foreground">AI chỉ xét tính hợp lý, không tra cứu cơ quan thuế · {formatDateTime(s.aiReview.at)}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Chưa có kết quả (AI tự kiểm tra khi khách gửi; nếu AI chưa bật hoặc hết lượt, bấm “Kiểm tra”).</p>
          )}
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        {/* The suggested step first: a listed company gets the new people, a new one is added. */}
        {dup && (
          <Button size="sm" onClick={() => decide({ action: "merge", customerId: dup.id }, `Đã cập nhật liên hệ cho “${dup.name}”`)} disabled={!!busy}>
            {busy === "merge" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cập nhật vào “{dup.name}”
          </Button>
        )}
        <Button size="sm" variant={dup ? "outline" : "primary"} onClick={() => decide({ action: "approve" }, `Đã thêm “${d.name}” vào Khách hàng`)} disabled={!!busy}>
          {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {dup ? "Vẫn thêm mới" : "Thêm khách mới"}
        </Button>
        <span className="flex items-center gap-1.5">
          <Select value={mergeId} onChange={(e) => setMergeId(e.target.value)} aria-label="Gộp vào khách hàng" className="h-8 max-w-[14rem] text-xs">
            <option value="">{dup ? "Gộp vào khách khác…" : "Gộp vào khách hàng…"}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" disabled={!mergeId || !!busy} onClick={() => decide({ action: "merge", customerId: mergeId }, "Đã gộp thông tin")}>
            {busy === "merge" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Gộp
          </Button>
        </span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => decide({ action: "reject" }, "Đã từ chối")} disabled={!!busy}>
          <X className="h-3.5 w-3.5" /> Từ chối
        </Button>
      </footer>
    </article>
  );
}

function Links() {
  const { data, reload } = useApi<{ links: IntakeLinkView[] }>("/api/customer-intake/links");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      const { path } = await api<{ path: string }>("/api/customer-intake/links", { method: "POST", body: { label, days } });
      setMade(`${window.location.origin}${path}`);
      setLabel("");
      void reload();
    } catch (e) {
      toast.error(failure(e, "Không tạo được link"));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (l: IntakeLinkView) => {
    try {
      await api(`/api/customer-intake/links/${l.id}`, { method: "DELETE" });
      void reload();
    } catch (e) {
      toast.error(failure(e, "Không thu hồi được"));
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép link");
    } catch {
      toast.error("Không sao chép được, hãy chọn và sao chép tay");
    }
  };

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) void create();
        }}
      >
        <Field label="Tên link (chỉ nội bộ thấy)">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="VD: Gửi khách hội thảo tháng 11" />
        </Field>
        <Field label="Thời hạn">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {INTAKE_DAYS.map((d) => (
              <option key={d} value={d}>
                {d} ngày
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={!label.trim() || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Tạo link
        </Button>
      </form>
      {made && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          <p className="mb-1.5 text-xs text-muted-foreground">Link mới (chỉ hiện một lần, hãy sao chép ngay):</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={made} onFocus={(e) => e.target.select()} aria-label="Link form" className="font-mono text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={() => copy(made)}>
              <Copy className="h-3.5 w-3.5" /> Sao chép
            </Button>
          </div>
        </div>
      )}
      <ul className="divide-y rounded-lg border">
        {data?.links.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="font-medium">{l.label}</span>
            <span className={cn("text-xs", l.status === "active" ? "text-success" : "text-muted-foreground")}>{SHARE_STATUS_LABEL[l.status]}</span>
            <span className="text-xs text-muted-foreground">
              {l.submissions} lượt gửi · hạn {formatDate(l.expiresAt)} · {l.createdBy}
            </span>
            {l.status === "active" && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => revoke(l)}>
                Thu hồi
              </Button>
            )}
          </li>
        ))}
        {data && !data.links.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có link nào.</li>}
      </ul>
    </div>
  );
}
