"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, FileSpreadsheet, Loader2, Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PeriodFilter, defaultPeriod, periodQuery, type PeriodState } from "@/components/reports/period-filter";
import { api, ApiError, useApi } from "@/lib/client";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUSES,
  PAYMENT_STATUS,
  contractTotals,
  formatVnd,
  type ContractStatusKey,
  type ContractTotals,
} from "@/lib/finance";
import type { ContractDto } from "@/lib/contracts";
import { parseContractPaste, type ParsedRow } from "@/lib/contract-import";
import { ContractModal, monthOf, ratingBg, toDateInput, type ProjectOption } from "@/components/contracts/contract-form";
import { SummaryCards } from "@/components/contracts/summary-cards";
import { cn } from "@/lib/utils";

interface ListResponse {
  period: { label: string; from: string; to: string } | null;
  contracts: ContractDto[];
  totals: ContractTotals;
}

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
  // "" = all, "none" = not linked to a project, otherwise a project id.
  const [projectFilter, setProjectFilter] = useState("");
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
      (c) =>
        (!status || c.status === status) &&
        (!projectFilter || (projectFilter === "none" ? !c.projectId : c.projectId === projectFilter)) &&
        (!term || `${c.code ?? ""} ${c.name} ${c.partner ?? ""}`.toLowerCase().includes(term)),
    );
  }, [data, q, status, projectFilter]);
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
          <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="sm:w-52">
            <option value="">Mọi dự án</option>
            <option value="none">Chưa gắn dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
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
                                  {c.project.progress !== undefined && (
                                    <span className="font-medium text-foreground/80" title="Tiến độ công việc của dự án">
                                      · {c.project.progress}%
                                    </span>
                                  )}
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
