"use client";

import Link from "next/link";
import { ExternalLink, FileWarning, Paperclip } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ScheduleBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { SummaryCards } from "@/components/contracts/summary-cards";
import { RATINGS, formatVnd } from "@/lib/finance";
import type { SummaryFinance } from "@/lib/stats";
import { cn } from "@/lib/utils";

const ratingBg = (margin: number) => RATINGS.find((r) => margin >= r.min)!.bg;

/** Contracts money in the report, per project, next to each project's work progress. */
export function FinanceSection({ finance, periodLabel }: { finance: SummaryFinance; periodLabel: string }) {
  const scopeNote =
    finance.scope === "project" ? "Toàn bộ hợp đồng của dự án (không giới hạn theo kỳ)" : `Hợp đồng có ngày thực hiện trong ${periodLabel.toLowerCase()}`;
  const missing = new Set(finance.missingFiles.map((p) => p.id));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Tài chính hợp đồng</h2>
          <p className="text-xs text-muted-foreground">{scopeNote} · cùng số liệu với trang Hợp đồng & chi phí</p>
        </div>
        <Link href="/contracts" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Mở Hợp đồng & chi phí <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <SummaryCards t={finance.totals} />
      {finance.missingFiles.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <FileWarning className="h-4 w-4 shrink-0" /> Dự án đã hoàn thành còn thiếu hồ sơ hợp đồng (PDF)
          </p>
          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">Tính trên mọi hợp đồng của dự án, không giới hạn theo kỳ. Bấm vào dự án để tải file lên.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {finance.missingFiles.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}?tab=finance`}
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-card px-3 py-1.5 text-xs hover:border-amber-400 dark:border-amber-500/30"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular-nums text-amber-700 dark:text-amber-300">
                    thiếu {p.missing}/{p.contracts} HĐ
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {finance.byProject.length > 0 && (
        <Card>
          <CardHeader title="Tiến độ & tài chính theo dự án" description="So sánh tiến độ công việc với giá trị, chi phí, lợi nhuận và công nợ của từng dự án" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Dự án</th>
                  <th className="w-40 px-3 py-2.5 text-left font-medium">Tiến độ công việc</th>
                  <th className="px-3 py-2.5 text-right font-medium">Số HĐ</th>
                  <th className="px-3 py-2.5 text-right font-medium">Giá trị HĐ</th>
                  <th className="px-3 py-2.5 text-right font-medium">Chi phí</th>
                  <th className="px-3 py-2.5 text-right font-medium">Lợi nhuận gộp</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tỷ suất</th>
                  <th className="px-3 py-2.5 text-right font-medium">Đã thu</th>
                  <th className="px-3 py-2.5 text-right font-medium">Còn phải thu</th>
                  <th className="px-5 py-2.5 text-center font-medium" title="Số hợp đồng đã có file PDF / tổng số hợp đồng">
                    Hồ sơ PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {finance.byProject.map((p) => {
                  const t = p.totals;
                  return (
                    <tr key={p.id ?? "none"} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        {p.id ? (
                          <Link href={`/projects/${p.id}?tab=finance`} className="flex items-center gap-2 font-medium hover:text-primary">
                            <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: p.color }} />
                            {p.name}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2.5 w-2.5 shrink-0 rounded bg-slate-400" />
                            {p.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {p.progress === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <>
                            <ProgressBar value={p.progress} height={6} showLabel />
                            {p.scheduleStatus && <ScheduleBadge status={p.scheduleStatus} className="mt-1" />}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{t.count}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{formatVnd(t.value, false)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                        {formatVnd(t.totalCost, false)}
                        {t.totalCost > 0 && <span className="block text-[11px] text-muted-foreground">{t.costRatio}% giá trị</span>}
                      </td>
                      <td className={cn("whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums", t.profit < 0 ? "text-danger" : "text-success")}>
                        {formatVnd(t.profit, false)}
                        {t.estimated > 0 && <span className="block text-[11px] font-normal italic text-muted-foreground">{t.estimated} HĐ ước tính</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <Badge className={ratingBg(t.margin)}>{t.margin}%</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVnd(t.collected, false)}</td>
                      <td className={cn("whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums", t.receivable > 0 && "text-danger")}>
                        {formatVnd(t.receivable, false)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                            p.withFiles === t.count
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : missing.has(p.id ?? "")
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Paperclip className="h-3 w-3" />
                          {p.withFiles}/{t.count}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
