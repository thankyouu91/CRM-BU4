"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, FileSpreadsheet, Loader2, Plus, Search, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PeriodFilter, defaultPeriod, periodQuery, type PeriodState } from "@/components/reports/period-filter";
import { api, ApiError, useApi } from "@/lib/client";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUSES,
  PAYMENT_STATUS,
  RATINGS,
  contractMetrics,
  contractTotals,
  formatVnd,
  parseVnd,
  type ContractStatusKey,
  type ContractTotals,
} from "@/lib/finance";
import type { ContractDto } from "@/lib/contracts";
import { parseContractPaste, type ParsedRow } from "@/lib/contract-import";
import { cn } from "@/lib/utils";

type ProjectOption = { id: string; name: string; color: string };
interface ListResponse {
  period: { label: string; from: string; to: string } | null;
  contracts: ContractDto[];
  totals: ContractTotals;
}

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthOf = (iso: string) => {
  const d = new Date(iso);
  return `Tháng ${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
};
const ratingBg = (label: string | null) => RATINGS.find((r) => r.label === label)?.bg ?? "bg-muted text-muted-foreground";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Whole-đồng amount with Vietnamese digit grouping while typing. */
function MoneyInput({ value, onChange, placeholder = "0" }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Input
        inputMode="numeric"
        value={value === null ? "" : value.toLocaleString("vi-VN")}
        placeholder={placeholder}
        onChange={(e) => {
          const n = parseVnd(e.target.value);
          onChange(n === null ? null : Math.max(0, n));
        }}
        className="pr-8 text-right tabular-nums"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

interface FormState {
  code: string;
  name: string;
  partner: string;
  value: number | null;
  performedAt: string;
  status: ContractStatusKey;
  trainingCost: number | null;
  examCost: number | null;
  otherCost: number | null;
  expectedMargin: string;
  collected: number | null;
  projectId: string;
  note: string;
}

function emptyForm(date: string): FormState {
  return {
    code: "",
    name: "",
    partner: "",
    value: null,
    performedAt: date,
    status: "IN_PROGRESS",
    trainingCost: null,
    examCost: null,
    otherCost: null,
    expectedMargin: "",
    collected: null,
    projectId: "",
    note: "",
  };
}

function fromContract(c: ContractDto): FormState {
  return {
    code: c.code ?? "",
    name: c.name,
    partner: c.partner ?? "",
    value: c.value,
    performedAt: toDateInput(c.performedAt),
    status: c.status as ContractStatusKey,
    trainingCost: c.trainingCost || null,
    examCost: c.examCost || null,
    otherCost: c.otherCost || null,
    expectedMargin: c.expectedMargin === null ? "" : String(c.expectedMargin),
    collected: c.collected || null,
    projectId: c.projectId ?? "",
    note: c.note ?? "",
  };
}

function ContractModal({
  open,
  contract,
  defaultDate,
  projects,
  onClose,
  onSaved,
  onDelete,
}: {
  open: boolean;
  contract: ContractDto | null;
  defaultDate: string;
  projects: ProjectOption[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (c: ContractDto) => void;
}) {
  const [v, setV] = useState<FormState>(() => emptyForm(defaultDate));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setV(contract ? fromContract(contract) : emptyForm(defaultDate));
      setErrors({});
    }
  }, [open, contract, defaultDate]);

  const margin = v.expectedMargin.trim() === "" ? null : Number(v.expectedMargin.replace(",", "."));
  const m = contractMetrics({
    value: v.value ?? 0,
    trainingCost: v.trainingCost ?? 0,
    examCost: v.examCost ?? 0,
    otherCost: v.otherCost ?? 0,
    expectedMargin: margin !== null && Number.isFinite(margin) ? margin : null,
    collected: v.collected ?? 0,
  });

  const submit = async () => {
    setBusy(true);
    setErrors({});
    const body = {
      code: v.code || null,
      name: v.name,
      partner: v.partner || null,
      value: v.value ?? 0,
      performedAt: v.performedAt,
      status: v.status,
      trainingCost: v.trainingCost ?? 0,
      examCost: v.examCost ?? 0,
      otherCost: v.otherCost ?? 0,
      expectedMargin: margin !== null && Number.isFinite(margin) ? margin : null,
      collected: v.collected ?? 0,
      projectId: v.projectId || null,
      note: v.note || null,
    };
    try {
      if (contract) await api(`/api/contracts/${contract.id}`, { method: "PATCH", body });
      else await api("/api/contracts", { method: "POST", body });
      toast.success(contract ? "Đã cập nhật hợp đồng" : "Đã thêm hợp đồng");
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields ?? {});
      toast.error(e instanceof ApiError ? e.message : "Không thể lưu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={contract ? "Sửa hợp đồng" : "Thêm hợp đồng"}
      description="Nhập giá trị, chi phí và số đã thu — lợi nhuận, tỷ suất và công nợ được tính tự động."
      footer={
        <>
          {contract && (
            <Button variant="ghost" className="mr-auto text-danger hover:bg-danger/10 hover:text-danger" onClick={() => onDelete(contract)}>
              <Trash2 className="h-4 w-4" /> Xoá
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy} disabled={!v.name.trim() || v.value === null}>
            {contract ? "Lưu thay đổi" : "Thêm hợp đồng"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên hợp đồng / dự án" error={errors.name}>
              <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="VD: Cung cấp tài khoản luyện thi" autoFocus />
            </Field>
            <Field label="Mã hợp đồng">
              <Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="VD: 248/HĐMB/IES-CDIMEX" />
            </Field>
            <Field label="Đối tác / khách hàng">
              <Input value={v.partner} onChange={(e) => setV({ ...v, partner: e.target.value })} placeholder="Tên đơn vị" />
            </Field>
            <Field label="Giá trị hợp đồng" error={errors.value}>
              <MoneyInput value={v.value} onChange={(value) => setV({ ...v, value })} />
            </Field>
            <Field label="Ngày thực hiện" error={errors.performedAt} hint="Báo cáo lọc theo tháng/quý/năm của ngày này.">
              <Input type="date" value={v.performedAt} onChange={(e) => setV({ ...v, performedAt: e.target.value })} />
            </Field>
            <Field label="Tiến độ thực hiện">
              <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ContractStatusKey })}>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTRACT_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">Chi phí</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chi phí đào tạo">
                <MoneyInput value={v.trainingCost} onChange={(trainingCost) => setV({ ...v, trainingCost })} />
              </Field>
              <Field label="Chi phí khảo thí">
                <MoneyInput value={v.examCost} onChange={(examCost) => setV({ ...v, examCost })} />
              </Field>
              <Field label="Chi phí khác">
                <MoneyInput value={v.otherCost} onChange={(otherCost) => setV({ ...v, otherCost })} />
              </Field>
              <Field label="Tỷ suất LN dự kiến (%)" hint="Chỉ dùng để ước tính khi chưa nhập chi phí.">
                <Input inputMode="decimal" value={v.expectedMargin} onChange={(e) => setV({ ...v, expectedMargin: e.target.value })} placeholder="VD: 30" />
              </Field>
              <Field label="Đã thanh toán (đã thu)">
                <MoneyInput value={v.collected} onChange={(collected) => setV({ ...v, collected })} />
              </Field>
              <Field label="Dự án liên kết" error={errors.projectId}>
                <Select value={v.projectId} onChange={(e) => setV({ ...v, projectId: e.target.value })}>
                  <option value="">— Không liên kết —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>
          <Field label="Ghi chú">
            <Textarea value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} rows={2} />
          </Field>
        </div>

        {/* Live result */}
        <aside className="h-fit space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kết quả tính tự động</p>
          <Row label="Tổng chi phí" value={formatVnd(m.totalCost)} sub={v.value ? `${m.costRatio}% giá trị HĐ` : undefined} />
          <Row
            label={m.basis === "estimate" ? "Lợi nhuận gộp (ước tính)" : "Lợi nhuận gộp"}
            value={m.profit === null ? "Chưa có chi phí" : formatVnd(m.profit)}
            tone={m.profit !== null && m.profit < 0 ? "danger" : "success"}
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tỷ suất LN</span>
            <span className="flex items-center gap-2 font-semibold tabular-nums">
              {m.margin === null ? "—" : `${m.margin}%`}
              {m.rating && <Badge className={ratingBg(m.rating)}>{m.rating}</Badge>}
            </span>
          </div>
          <div className="border-t pt-3" />
          <Row label="Còn phải thu" value={formatVnd(m.receivable)} tone={m.receivable > 0 ? "danger" : undefined} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trạng thái TT</span>
            <Badge className={PAYMENT_STATUS[m.paymentStatus].bg}>{PAYMENT_STATUS[m.paymentStatus].label}</Badge>
          </div>
          {m.basis === null && (v.value ?? 0) > 0 && (
            <p className="rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">Nhập chi phí hoặc tỷ suất LN dự kiến để tính lợi nhuận.</p>
          )}
        </aside>
      </div>
    </Modal>
  );
}

function Row({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-semibold tabular-nums", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</span>
      </div>
      {sub && <p className="text-right text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paste from Excel
// ---------------------------------------------------------------------------

function ImportModal({ open, defaultDate, onClose, onImported }: { open: boolean; defaultDate: string; onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  const rows: ParsedRow[] = useMemo(() => (text.trim() ? parseContractPaste(text, Number(defaultDate.slice(0, 4)), defaultDate) : []), [text, defaultDate]);
  const valid = rows.filter((r) => r.data);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api<{ count: number }>("/api/contracts/import", { method: "POST", body: { rows: valid.map((r) => r.data) } });
      toast.success(`Đã nhập ${res.count} hợp đồng`);
      onImported();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể nhập dữ liệu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Dán dữ liệu từ Excel"
      description="Trong Excel, chọn các dòng hợp đồng (có thể kèm dòng tiêu đề) → Ctrl+C → dán vào ô dưới. Lợi nhuận, công nợ và trạng thái thanh toán được tính lại."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy} disabled={valid.length === 0}>
            Nhập {valid.length > 0 ? `${valid.length} hợp đồng` : ""}
          </Button>
        </>
      }
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"STT\tMã HĐ\tTên hợp đồng\tĐối tác\tGiá trị HĐ\tNgày thực hiện\tCP đào tạo\tCP khảo thí\t…"}
        className="font-mono text-xs"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Thứ tự cột theo mẫu báo cáo cũ: STT · Mã HĐ · Tên · Đối tác · Giá trị HĐ · Ngày/Tháng thực hiện · CP đào tạo · CP khảo thí · (Tổng giá trị · LN gộp) · Tỷ suất LN · (Đánh giá) ·
        Đã thanh toán · (Còn phải thu) · Tiến độ · (Trạng thái TT). Cột trong ngoặc được tính lại tự động.
      </p>
      {rows.length > 0 && (
        <div className="mt-4 max-h-72 overflow-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Dòng</th>
                <th className="px-3 py-2 text-left font-medium">Tên hợp đồng</th>
                <th className="px-3 py-2 text-right font-medium">Giá trị</th>
                <th className="px-3 py-2 text-left font-medium">Tháng</th>
                <th className="px-3 py-2 text-right font-medium">Chi phí</th>
                <th className="px-3 py-2 text-right font-medium">Đã thu</th>
                <th className="px-3 py-2 text-left font-medium">Ghi nhận</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} className={cn("border-t", !r.data && "bg-danger/5")}>
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                  <td className="max-w-[220px] truncate px-3 py-1.5">{r.data?.name ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.data ? formatVnd(r.data.value, false) : "—"}</td>
                  <td className="px-3 py-1.5">{r.data ? monthOf(r.data.performedAt) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.data ? formatVnd(r.data.trainingCost + r.data.examCost + r.data.otherCost, false) : "—"}
                    {r.data?.expectedMargin != null && <span className="block text-[10px] text-muted-foreground">ước tính LN {r.data.expectedMargin}%</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.data ? formatVnd(r.data.collected, false) : "—"}</td>
                  <td className="px-3 py-1.5">
                    {r.errors.map((e) => (
                      <span key={e} className="block text-danger">
                        {e}
                      </span>
                    ))}
                    {r.warnings.map((w) => (
                      <span key={w} className="block text-warning">
                        {w}
                      </span>
                    ))}
                    {r.data && r.errors.length + r.warnings.length === 0 && <span className="text-success">Hợp lệ</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Summary cards (the four blocks of the original sheet)
// ---------------------------------------------------------------------------

function SummaryCards({ t }: { t: ContractTotals }) {
  const cards = [
    {
      label: "Tổng giá trị hợp đồng",
      value: formatVnd(t.value),
      sub: `Tổng số: ${t.count} hợp đồng`,
      accent: "border-t-blue-600",
      ink: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Tổng chi phí thực hiện",
      value: formatVnd(t.totalCost),
      sub: `Tỷ lệ CP: ${t.costRatio}% · đào tạo ${formatVnd(t.trainingCost, false)} · khảo thí ${formatVnd(t.examCost, false)}${t.otherCost ? ` · khác ${formatVnd(t.otherCost, false)}` : ""}`,
      accent: "border-t-orange-500",
      ink: "text-orange-700 dark:text-orange-300",
    },
    {
      label: "Lợi nhuận gộp dự kiến",
      value: formatVnd(t.profit),
      sub: `Tỷ suất LN TB: ${t.margin}%${t.estimated ? ` · ${t.estimated} HĐ ước tính` : ""}`,
      accent: "border-t-emerald-600",
      ink: t.profit < 0 ? "text-danger" : "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Số dư còn phải thu",
      value: formatVnd(t.receivable),
      sub: `Đã thu: ${formatVnd(t.collected)}`,
      accent: "border-t-violet-600",
      ink: "text-violet-700 dark:text-violet-300",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={cn("rounded-2xl border border-t-4 bg-card p-5 shadow-card", c.accent)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight", c.ink)}>{c.value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const GROUPS = [
  { label: "Thông tin hợp đồng", span: 4, cls: "bg-blue-600 text-white" },
  { label: "Lịch trình", span: 1, cls: "bg-sky-600 text-white" },
  { label: "Chi phí chi tiết", span: 4, cls: "bg-orange-600 text-white" },
  { label: "Lợi nhuận & hiệu quả", span: 3, cls: "bg-emerald-600 text-white" },
  { label: "Dòng tiền & trạng thái", span: 4, cls: "bg-violet-600 text-white" },
];

export function ContractsView({ projects }: { projects: ProjectOption[] }) {
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod("month"));
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ContractStatusKey>("");
  const [editing, setEditing] = useState<ContractDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<ContractDto | null>(null);
  const [exporting, setExporting] = useState(false);

  const customIncomplete = period.type === "custom" && (!period.from || !period.to);
  const url = all ? "/api/contracts?all=1" : customIncomplete ? null : `/api/contracts?${periodQuery(period)}`;
  const { data, loading, reload } = useApi<ListResponse>(url);

  // New contracts default into the period being viewed.
  const defaultDate = useMemo(() => {
    if (data?.period) {
      const now = new Date();
      const from = new Date(data.period.from);
      const to = new Date(data.period.to);
      return toDateInput((now >= from && now <= to ? now : from).toISOString());
    }
    return toDateInput(new Date().toISOString());
  }, [data?.period]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.contracts ?? []).filter(
      (c) => (!status || c.status === status) && (!term || `${c.code ?? ""} ${c.name} ${c.partner ?? ""}`.toLowerCase().includes(term)),
    );
  }, [data, q, status]);
  const filtered = rows.length !== (data?.contracts.length ?? 0);
  // Totals follow the visible rows so search/filters update the summary too.
  const totals = useMemo(() => {
    if (!data) return null;
    if (!filtered) return data.totals;
    return contractTotals(rows);
  }, [data, rows, filtered]);
  const periodLabel = all ? "Tất cả thời gian" : (data?.period?.label ?? "…");

  const exportXlsx = async () => {
    if (!totals) return;
    setExporting(true);
    try {
      const { exportContractsXlsx } = await import("@/lib/export/contracts-xlsx");
      const slug = periodLabel
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      await exportContractsXlsx(rows, totals, periodLabel, `hop-dong-chi-phi-${slug}.xlsx`);
    } catch {
      toast.error("Không thể xuất file Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hợp đồng & chi phí"
        description="Theo dõi giá trị hợp đồng, chi phí đào tạo – khảo thí, lợi nhuận gộp và công nợ."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              <ClipboardPaste className="h-4 w-4" /> Dán từ Excel
            </Button>
            <Button variant="outline" onClick={exportXlsx} loading={exporting} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Thêm hợp đồng
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {!all && <PeriodFilter value={period} onChange={setPeriod} label={data?.period?.label ?? "…"} />}
          <label className="flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border bg-card px-3 text-xs">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-[rgb(var(--primary))]" />
            Tất cả thời gian
          </label>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "" | ContractStatusKey)} className="sm:w-44">
            <option value="">Mọi tiến độ</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS[s].label}
              </option>
            ))}
          </Select>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã, tên, đối tác…"
              className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!data && loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Chọn đủ ngày bắt đầu và kết thúc.</p>
      ) : (
        <div className="space-y-6">
          {totals && <SummaryCards t={totals} />}

          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="font-semibold">Báo cáo tổng hợp theo dõi hợp đồng & chi phí · {periodLabel}</h2>
                <p className="text-xs text-muted-foreground">
                  Bấm vào một dòng để sửa. Lợi nhuận in nghiêng là ước tính theo tỷ suất dự kiến (chưa nhập chi phí).
                </p>
              </div>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={filtered ? "Không có hợp đồng phù hợp bộ lọc" : "Chưa có hợp đồng trong kỳ này"}
                description="Thêm hợp đồng mới hoặc dán dữ liệu từ file Excel đang dùng."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Thêm hợp đồng
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1480px] text-[13px]">
                  <thead className="text-[11px]">
                    <tr>
                      {GROUPS.map((g) => (
                        <th key={g.label} colSpan={g.span} className={cn("border-x border-white/20 px-3 py-2 text-center font-semibold uppercase tracking-wide", g.cls)}>
                          {g.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b bg-muted/60 text-muted-foreground">
                      {[
                        ["STT", "w-10 text-center"],
                        ["Hợp đồng / mã HĐ", "text-left"],
                        ["Đối tác / khách hàng", "text-left"],
                        ["Giá trị HĐ", "text-right"],
                        ["Ngày TH", "text-center"],
                        ["CP đào tạo", "text-right"],
                        ["CP khảo thí", "text-right"],
                        ["CP khác", "text-right"],
                        ["Tổng chi phí", "text-right"],
                        ["Lợi nhuận gộp", "text-right"],
                        ["Tỷ suất LN", "text-right"],
                        ["Đánh giá", "text-center"],
                        ["Đã thanh toán", "text-right"],
                        ["Còn phải thu", "text-right"],
                        ["Tiến độ", "text-center"],
                        ["Trạng thái TT", "text-center"],
                      ].map(([label, cls]) => (
                        <th key={label} className={cn("whitespace-nowrap px-3 py-2.5 font-medium", cls)}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c, i) => {
                      const m = c.metrics;
                      return (
                        <tr key={c.id} onClick={() => setEditing(c)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40">
                          <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{i + 1}</td>
                          <td className="max-w-[300px] px-3 py-2.5">
                            <p className="truncate font-medium" title={c.name}>
                              {c.name}
                            </p>
                            <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground" title={c.code ?? ""}>
                              {c.code || "Chưa có mã"}
                              {c.project && (
                                <>
                                  <span>·</span>
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.project.color }} /> {c.project.name}
                                </>
                              )}
                            </p>
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground" title={c.partner ?? ""}>
                            {c.partner || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{formatVnd(c.value, false)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs">{monthOf(c.performedAt)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatVnd(c.trainingCost, false)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatVnd(c.examCost, false)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatVnd(c.otherCost, false)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{formatVnd(m.totalCost, false)}</td>
                          <td
                            className={cn(
                              "whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums",
                              m.profit === null ? "text-muted-foreground" : m.profit < 0 ? "text-danger" : "text-success",
                              m.basis === "estimate" && "italic",
                            )}
                            title={m.basis === "estimate" ? "Ước tính theo tỷ suất LN dự kiến (chưa nhập chi phí)" : undefined}
                          >
                            {m.profit === null ? "—" : formatVnd(m.profit, false)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{m.margin === null ? "—" : `${m.margin}%`}</td>
                          <td className="px-3 py-2.5 text-center">{m.rating ? <Badge className={ratingBg(m.rating)}>{m.rating}</Badge> : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatVnd(c.collected, false)}</td>
                          <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums", m.receivable > 0 && "text-danger")}>
                            {formatVnd(m.receivable, false)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge className={CONTRACT_STATUS[c.status as ContractStatusKey]?.bg}>{CONTRACT_STATUS[c.status as ContractStatusKey]?.label ?? c.status}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge className={PAYMENT_STATUS[m.paymentStatus].bg}>{PAYMENT_STATUS[m.paymentStatus].label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {totals && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/60 font-semibold">
                        <td colSpan={3} className="px-3 py-3 text-center uppercase tracking-wide">
                          Tổng cộng ({totals.count})
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(totals.value, false)}</td>
                        <td />
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(totals.trainingCost, false)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(totals.examCost, false)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(totals.otherCost, false)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(totals.totalCost, false)}</td>
                        <td className={cn("whitespace-nowrap px-3 py-3 text-right tabular-nums", totals.profit < 0 ? "text-danger" : "text-success")}>
                          {formatVnd(totals.profit, false)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{totals.margin}%</td>
                        <td />
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(totals.collected, false)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-danger">{formatVnd(totals.receivable, false)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <b className="text-foreground/80">Cách tính:</b> Lợi nhuận gộp = Giá trị HĐ − (CP đào tạo + CP khảo thí + CP khác) · Tỷ suất LN = Lợi nhuận ÷ Giá trị HĐ · Còn phải thu = Giá trị HĐ −
            Đã thanh toán · Đánh giá: ≥ 30% Tốt, 15–30% Khá, 0–15% Thấp, &lt; 0 Lỗ · Trạng thái TT tự động: chưa thu → Chưa thanh toán, thu một phần → Đã tạm ứng, thu đủ → Đã hoàn tất.
          </p>
        </div>
      )}

      <ContractModal
        open={creating || !!editing}
        contract={editing}
        defaultDate={defaultDate}
        projects={projects}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={reload}
        onDelete={(c) => setDeleting(c)}
      />
      <ImportModal open={importing} defaultDate={defaultDate} onClose={() => setImporting(false)} onImported={reload} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Xoá hợp đồng?"
        confirmLabel="Xoá hợp đồng"
        message={
          <>
            Hợp đồng <b className="text-foreground">{deleting?.name}</b> và số liệu chi phí, thanh toán của nó sẽ bị xoá vĩnh viễn.
          </>
        }
        onConfirm={async () => {
          try {
            await api(`/api/contracts/${deleting!.id}`, { method: "DELETE" });
            toast.success("Đã xoá hợp đồng");
            setEditing(null);
            await reload();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Không thể xoá");
          }
        }}
      />
    </div>
  );
}
