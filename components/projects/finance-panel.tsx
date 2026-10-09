"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, ExternalLink, FileWarning, Loader2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge, ScheduleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { ContractModal, monthOf, ratingBg, toDateInput } from "@/components/contracts/contract-form";
import { ContractFilesModal, FileCountButton, UploadPdfButton } from "@/components/contracts/contract-files";
import { SummaryCards } from "@/components/contracts/summary-cards";
import { api, ApiError } from "@/lib/client";
import { CONTRACT_STATUS, PAYMENT_STATUS, formatVnd, type ContractStatusKey, type ContractTotals } from "@/lib/finance";
import type { ContractDto } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import type { ProjectDetailData } from "./types";

export interface ProjectContracts {
  contracts: ContractDto[];
  totals: ContractTotals;
}

/** New contracts from a project start dated at the project's start (or today). */
export function projectContractDefaults(project: Pick<ProjectDetailData, "name" | "startDate" | "status">) {
  return {
    name: project.name,
    performedAt: toDateInput(project.startDate ?? new Date().toISOString()),
    status: (project.status === "COMPLETED" ? "COMPLETED" : project.status === "PLANNING" ? "PLANNED" : "IN_PROGRESS") as ContractStatusKey,
  };
}

/**
 * The project's contracts, costs and collections — the same records as the
 * "Hợp đồng & chi phí" page — next to the project's work progress.
 */
export function FinancePanel({ project, data, onChanged }: { project: ProjectDetailData; data: ProjectContracts | null; onChanged: () => void }) {
  const [editing, setEditing] = useState<ContractDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ContractDto | null>(null);
  const [filesOf, setFilesOf] = useState<ContractDto | null>(null);

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const t = data.totals;
  const collectedPct = t.value ? Math.round((t.collected / t.value) * 1000) / 10 : 0;
  const locked = { id: project.id, name: project.name, color: project.color };
  // A completed project's contracts should all have their signed PDF archived.
  const completed = project.status === "COMPLETED";
  const missingFiles = data.contracts.filter((c) => c.fileCount === 0);

  return (
    <div className="space-y-6">
      {/* Work progress and money side by side */}
      <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card md:grid-cols-3">
        <div>
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            Tiến độ công việc <ScheduleBadge status={project.schedule.status} />
          </p>
          <ProgressBar value={project.progress} className="mt-2" showLabel />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Chi phí đã ghi nhận / giá trị HĐ</p>
          <ProgressBar value={Math.min(100, t.costRatio)} color={t.costRatio > 100 ? "#d03b3b" : "#eb6834"} className="mt-2" showLabel />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Đã thu / giá trị HĐ</p>
          <ProgressBar value={collectedPct} color="#1baf7a" className="mt-2" showLabel />
        </div>
        <p className="text-[11px] text-muted-foreground md:col-span-3">
          Số liệu dùng chung với trang Hợp đồng & chi phí và Trung tâm báo cáo — sửa ở đây là cập nhật ở mọi nơi.
        </p>
      </div>

      {data.contracts.length > 0 && <SummaryCards t={t} />}

      {completed &&
        data.contracts.length > 0 &&
        (missingFiles.length > 0 ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-start gap-3">
              <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">Dự án đã hoàn thành — lưu hồ sơ hợp đồng (PDF)</h3>
                <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
                  Còn {missingFiles.length}/{data.contracts.length} hợp đồng chưa có file PDF. Tải bản hợp đồng đã ký lên để lưu trữ và hiện trong báo cáo.
                </p>
                <ul className="mt-3 divide-y divide-amber-200 rounded-xl border border-amber-200 bg-card dark:divide-amber-500/20 dark:border-amber-500/20">
                  {missingFiles.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.code || "Chưa có mã"} · {formatVnd(c.value)}
                        </p>
                      </div>
                      <UploadPdfButton contractId={c.id} onUploaded={onChanged} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CircleCheck className="h-4 w-4 shrink-0" /> Đã lưu file PDF cho cả {data.contracts.length} hợp đồng của dự án đã hoàn thành.
          </p>
        ))}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="font-semibold">Hợp đồng của dự án ({data.contracts.length})</h3>
            <p className="text-xs text-muted-foreground">Bấm vào một dòng để sửa giá trị, chi phí hoặc số đã thu.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/contracts">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" /> Trang Hợp đồng & chi phí
              </Button>
            </Link>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Thêm hợp đồng
            </Button>
          </div>
        </div>
        {data.contracts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Dự án chưa có hợp đồng"
            description="Thêm hợp đồng để theo dõi giá trị, chi phí, lợi nhuận và công nợ của dự án này."
            className="border-t"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-[13px]">
              <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Hợp đồng / mã HĐ</th>
                  <th className="px-3 py-2.5 text-center font-medium">File HĐ</th>
                  <th className="px-3 py-2.5 text-center font-medium">Ngày TH</th>
                  <th className="px-3 py-2.5 text-right font-medium">Giá trị HĐ</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tổng chi phí</th>
                  <th className="px-3 py-2.5 text-right font-medium">Lợi nhuận gộp</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tỷ suất</th>
                  <th className="px-3 py-2.5 text-right font-medium">Đã thu</th>
                  <th className="px-3 py-2.5 text-right font-medium">Còn phải thu</th>
                  <th className="px-3 py-2.5 text-center font-medium">Tiến độ HĐ</th>
                  <th className="px-5 py-2.5 text-center font-medium">Trạng thái TT</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.map((c) => {
                  const m = c.metrics;
                  return (
                    <tr key={c.id} onClick={() => setEditing(c)} className="cursor-pointer border-b last:border-0 hover:bg-muted/40">
                      <td className="max-w-[300px] px-5 py-2.5">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.code || "Chưa có mã"}
                          {c.partner ? ` · ${c.partner}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <FileCountButton count={c.fileCount} warn={completed} onClick={() => setFilesOf(c)} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs">{monthOf(c.performedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{formatVnd(c.value, false)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatVnd(m.totalCost, false)}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums",
                          m.profit === null ? "text-muted-foreground" : m.profit < 0 ? "text-danger" : "text-success",
                          m.basis === "estimate" && "italic",
                        )}
                      >
                        {m.profit === null ? "—" : formatVnd(m.profit, false)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {m.margin === null ? "—" : <Badge className={ratingBg(m.rating)}>{m.margin}%</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatVnd(c.collected, false)}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums", m.receivable > 0 && "text-danger")}>
                        {formatVnd(m.receivable, false)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge className={CONTRACT_STATUS[c.status as ContractStatusKey]?.bg}>{CONTRACT_STATUS[c.status as ContractStatusKey]?.label}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <Badge className={PAYMENT_STATUS[m.paymentStatus].bg}>{PAYMENT_STATUS[m.paymentStatus].label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContractModal
        open={creating || !!editing}
        contract={editing}
        defaultDate={projectContractDefaults(project).performedAt}
        defaults={projectContractDefaults(project)}
        projects={[locked]}
        lockedProject={editing && editing.projectId !== project.id ? undefined : locked}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={onChanged}
        onDelete={setDeleting}
      />
      <ContractFilesModal contract={filesOf} onClose={() => setFilesOf(null)} onChanged={onChanged} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Xoá hợp đồng?"
        confirmLabel="Xoá hợp đồng"
        message={
          <>
            Hợp đồng <b className="text-foreground">{deleting?.name}</b> cùng số liệu chi phí, thanh toán
            {deleting?.fileCount ? ` và ${deleting.fileCount} file PDF` : ""} của nó sẽ bị xoá ở mọi nơi.
          </>
        }
        onConfirm={async () => {
          try {
            await api(`/api/contracts/${deleting!.id}`, { method: "DELETE" });
            toast.success("Đã xoá hợp đồng");
            setEditing(null);
            onChanged();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Không thể xoá");
          }
        }}
      />
    </div>
  );
}
