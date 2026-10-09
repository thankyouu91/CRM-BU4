"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
      {finance.byProject.length > 0 && (
        <Card>
          <CardHeader title="Tiến độ & tài chính theo dự án" description="So sánh tiến độ công việc với giá trị, chi phí, lợi nhuận và công nợ của từng dự án" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
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
                  <th className="px-5 py-2.5 text-right font-medium">Còn phải thu</th>
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
                      <td className={cn("whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums", t.receivable > 0 && "text-danger")}>
                        {formatVnd(t.receivable, false)}
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
