"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssignModal } from "@/components/chat/assign-modal";
import { useApi } from "@/lib/client";
import { taskLink } from "@/lib/constants";
import type { TeamOverview, TeamOverviewRow } from "@/lib/team-overview";
import { cn, formatShortDate } from "@/lib/utils";

function ReportState({ row }: { row: TeamOverviewRow }) {
  const href = `/inbox/work/${row.author.id}`;
  if (row.state === "SUBMITTED") return <Link href={href} className="font-medium text-success hover:underline">Đã gửi</Link>;
  if (row.state === "DRAFT") return <Link href={href} className="text-muted-foreground hover:underline">Nháp</Link>;
  return <Link href={href} className="text-muted-foreground/70 hover:underline">Chưa có</Link>;
}

/**
 * Công việc của đội tuần này (Quản lý and above): each person's weekly report, the week's
 * numbers, their nearest deadlines, and "Giao việc" to give them new work.
 */
export function TeamWeekCard() {
  const { data, loading, reload } = useApi<TeamOverview>("/api/dashboard/team");
  const [assignTo, setAssignTo] = useState<{ id: string; name: string } | null>(null);
  const now = data ? new Date(data.asOf).getTime() : 0;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Công việc của đội tuần này</h2>
          <p className="text-xs text-muted-foreground">{data ? `${data.period.label} · báo cáo tuần, việc đang làm và hạn chót của từng người` : "Đang tải…"}</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải" />}
        <Link href="/inbox?tab=weekly" className="text-xs font-medium text-primary hover:underline">
          Xem báo cáo tuần
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Nhân sự</th>
              <th className="px-2 py-2.5 text-left font-medium">Báo cáo tuần</th>
              <th className="px-2 py-2.5 text-right font-medium">Xong tuần này</th>
              <th className="px-2 py-2.5 text-right font-medium">Đang làm</th>
              <th className="px-2 py-2.5 text-right font-medium">Hạn trong tuần</th>
              <th className="px-2 py-2.5 text-right font-medium">Quá hạn</th>
              <th className="px-3 py-2.5 text-left font-medium">Hạn chót gần nhất</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.author.id} className="border-b align-top last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.author.name} color={r.author.avatarColor} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium">{r.author.name}</span>
                      {r.author.jobTitle && <span className="block truncate text-xs text-muted-foreground">{r.author.jobTitle}</span>}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2.5"><ReportState row={r} /></td>
                <td className="px-2 py-2.5 text-right tabular-nums">{r.totals.currentDone}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{r.totals.currentOpen}</td>
                <td className={cn("px-2 py-2.5 text-right tabular-nums", r.dueThisWeek > 0 && "font-semibold text-warning")}>{r.dueThisWeek}</td>
                <td className={cn("px-2 py-2.5 text-right tabular-nums", r.overdue > 0 ? "font-semibold text-danger" : "text-muted-foreground/60")}>{r.overdue}</td>
                <td className="px-3 py-2">
                  {r.deadlines.length ? (
                    <ul className="space-y-1">
                      {r.deadlines.map((d) => {
                        const late = new Date(d.dueDate).getTime() < now;
                        return (
                          <li key={d.id} className="flex min-w-0 items-baseline gap-2 text-xs">
                            <span className={cn("w-11 shrink-0 tabular-nums", late ? "font-semibold text-danger" : "text-muted-foreground")}>{formatShortDate(d.dueDate)}</span>
                            <Link href={taskLink(d.projectId, d.id)} className="min-w-0 truncate hover:underline" title={`${d.title} · ${d.projectName} · ${d.progress}%`}>
                              {d.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">Không có hạn sắp tới</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setAssignTo({ id: r.author.id, name: r.author.name })}>
                    <ClipboardPlus className="h-3.5 w-3.5" /> Giao việc
                  </Button>
                </td>
              </tr>
            ))}
            {data && !data.rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Chưa có nhân sự nào thuộc quyền quản lý của bạn.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AssignModal
        open={!!assignTo}
        onClose={() => setAssignTo(null)}
        assignTo={assignTo ?? undefined}
        onAssigned={(a) => {
          toast.success(`Đã giao “${a.task.title}” cho ${assignTo?.name ?? "nhân sự"}`);
          void reload();
        }}
      />
    </Card>
  );
}
