"use client";

import { PlanBar } from "@/components/ui/progress";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScheduleBadge } from "@/components/ui/badge";
import { TASK_STATUS } from "@/lib/constants";
import { daysLeftLabel, type Schedule, type Workload } from "@/lib/schedule";
import { cn, formatShortDate } from "@/lib/utils";

export interface DeadlineRow {
  id: string;
  name: string;
  color: string;
  level: 0 | 1 | 2;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  schedule: Schedule;
  workload: Workload;
}

/** Progress against deadline: actual vs planned-to-date, achievement, done vs to do, status. */
export function DeadlineTable({ rows, firstColumn = "Hạng mục" }: { rows: DeadlineRow[]; firstColumn?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-2.5 text-left font-medium">{firstColumn}</th>
            <th className="px-3 py-2.5 text-left font-medium">Thời hạn</th>
            <th className="w-44 px-3 py-2.5 text-left font-medium">Thực tế / kế hoạch</th>
            <th className="px-3 py-2.5 text-right font-medium" title="Thực tế chia cho kế hoạch đến hôm nay">
              Đạt KH
            </th>
            <th className="px-3 py-2.5 text-right font-medium">Đã làm / cần làm</th>
            <th className="px-5 py-2.5 text-left font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn("border-b last:border-0", r.level === 0 && rows.some((x) => x.level > 0) && "bg-muted/30")}>
              <td className="px-5 py-3">
                <span className={cn("flex items-center gap-2", r.level === 2 && "pl-5", r.level < 2 ? "font-medium" : "text-[13px]")}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: r.color }} />
                  {r.level === 2 && <span className="-ml-1 text-muted-foreground">└</span>}
                  <span className="truncate">{r.name}</span>
                </span>
              </td>
              <td className="px-3 py-3 text-xs">
                {r.dueDate || r.startDate ? (
                  <>
                    <span className="tabular-nums">
                      {formatShortDate(r.startDate) || "…"} → {formatShortDate(r.dueDate) || "…"}
                    </span>
                    {r.dueDate && r.schedule.status !== "DONE" && (
                      <span className={cn("block", (r.schedule.daysLeft ?? 0) < 0 ? "font-medium text-danger" : "text-muted-foreground")}>
                        {daysLeftLabel(r.schedule.daysLeft)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">Chưa đặt</span>
                )}
              </td>
              <td className="px-3 py-3">
                <PlanBar actual={r.progress} planned={r.schedule.planned} height={6} showLabel />
                <p className="mt-0.5 text-[11px] text-muted-foreground">{r.schedule.planned === null ? "Chưa có kế hoạch" : `Kế hoạch: ${r.schedule.planned}%`}</p>
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{r.schedule.achievement === null ? "—" : `${r.schedule.achievement}%`}</td>
              <td className="px-3 py-3 text-right tabular-nums">
                <span className="font-semibold text-success">{r.workload.done}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-semibold">{r.workload.remaining}</span>
                {r.workload.overdue > 0 && <span className="block text-[11px] text-danger">{r.workload.overdue} quá hạn</span>}
              </td>
              <td className="px-5 py-3">
                <ScheduleBadge status={r.schedule.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Done vs still to do, split by state, for the whole project. */
export function WorkloadCard({ workload: w }: { workload: Workload }) {
  const parts = [
    { key: "done", label: "Đã hoàn thành", value: w.done, color: TASK_STATUS.DONE.color },
    { key: "inProgress", label: "Đang làm / chờ duyệt", value: w.inProgress, color: TASK_STATUS.IN_PROGRESS.color },
    { key: "notStarted", label: "Chưa bắt đầu", value: w.notStarted, color: TASK_STATUS.TODO.color },
    { key: "blocked", label: "Bị chặn", value: w.blocked, color: TASK_STATUS.BLOCKED.color },
  ];
  const pct = (v: number) => (w.total ? Math.round((v / w.total) * 100) : 0);
  return (
    <Card>
      <CardHeader title="Khối lượng công việc" description="Tổng số công việc & task con đã làm và còn cần làm" />
      <CardBody>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Tổng khối lượng</p>
            <p className="text-2xl font-bold tabular-nums">{w.total}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Đã làm</p>
            <p className="text-2xl font-bold tabular-nums text-success">
              {w.done} <span className="text-sm font-medium text-muted-foreground">({pct(w.done)}%)</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cần làm</p>
            <p className="text-2xl font-bold tabular-nums">
              {w.remaining} <span className="text-sm font-medium text-muted-foreground">({pct(w.remaining)}%)</span>
            </p>
            {w.overdue > 0 && <p className="text-xs font-medium text-danger">trong đó {w.overdue} quá hạn</p>}
          </div>
        </div>
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${pct(p.value)}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
            ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.label}</span>
              <span className="font-semibold tabular-nums">{p.value}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

