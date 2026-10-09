"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { DeadlineTable, WorkloadCard, type DeadlineRow } from "@/components/reports/deadline";
import { StatusDonut, statusLegend } from "@/components/charts/charts";
import { useChartTheme } from "@/lib/chart-theme";
import { isOverdue } from "@/lib/dates";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectDetailData } from "./types";

const DAY = 86_400_000;

function Timeline({ project }: { project: ProjectDetailData }) {
  const { rows, bands, start, span, months, todayPct } = useMemo(() => {
    const roots = project.tasks.filter((t) => !t.parentId);
    const times: number[] = [Date.now()];
    if (project.startDate) times.push(new Date(project.startDate).getTime());
    if (project.dueDate) times.push(new Date(project.dueDate).getTime());
    for (const t of roots) {
      times.push(new Date(t.startDate ?? t.createdAt).getTime());
      if (t.dueDate) times.push(new Date(t.dueDate).getTime());
    }
    for (const c of project.categories) {
      if (c.startDate) times.push(new Date(c.startDate).getTime());
      if (c.dueDate) times.push(new Date(c.dueDate).getTime());
    }
    const start = Math.min(...times) - 3 * DAY;
    const end = Math.max(...times) + 3 * DAY;
    const span = end - start;

    const months: { label: string; pct: number }[] = [];
    const m = new Date(start);
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    m.setMonth(m.getMonth() + 1);
    while (m.getTime() < end) {
      months.push({ label: `Th${m.getMonth() + 1}/${String(m.getFullYear()).slice(2)}`, pct: ((m.getTime() - start) / span) * 100 });
      m.setMonth(m.getMonth() + 1);
    }

    const order = new Map(project.categories.map((c, i) => [c.id, i]));
    const rows = [...roots].sort(
      (a, b) =>
        (order.get(a.categoryId ?? "") ?? 999) - (order.get(b.categoryId ?? "") ?? 999) ||
        new Date(a.startDate ?? a.createdAt).getTime() - new Date(b.startDate ?? b.createdAt).getTime(),
    );
    // Category bands (main, then its sub-categories) above the tasks.
    const mains = project.categories.filter((c) => !c.parentId);
    const bands = mains
      .flatMap((m) => [m, ...project.categories.filter((c) => c.parentId === m.id)])
      .filter((c) => c.startDate || c.dueDate);
    return { rows, bands, start, span, months, todayPct: ((Date.now() - start) / span) * 100 };
  }, [project]);

  const catColor = new Map(project.categories.map((c) => [c.id, c.color]));

  if (rows.length === 0 && bands.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có công việc để hiển thị tiến trình.</p>;

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="flex border-b pb-2 text-[11px] text-muted-foreground">
          <div className="w-60 shrink-0 pl-1">Công việc</div>
          <div className="relative h-4 flex-1">
            {months.map((mo) => (
              <span key={mo.label} className="absolute -translate-x-1/2" style={{ left: `${mo.pct}%` }}>
                {mo.label}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          {/* Month gridlines + today marker, drawn behind the rows */}
          <div className="pointer-events-none absolute inset-y-0 left-60 right-0">
            {months.map((mo) => (
              <span key={mo.label} className="absolute inset-y-0 w-px bg-border" style={{ left: `${mo.pct}%` }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 bg-danger/70" style={{ left: `${todayPct}%` }}>
              <span className="absolute left-1 top-0 whitespace-nowrap rounded bg-danger px-1 text-[10px] font-semibold text-white">Hôm nay</span>
            </span>
          </div>
          {bands.map((c, i) => {
            const s = new Date(c.startDate ?? c.dueDate!).getTime();
            const e = new Date(c.dueDate ?? c.startDate!).getTime();
            const left = ((s - start) / span) * 100;
            const width = Math.max(((Math.max(e, s + DAY) - s) / span) * 100, 0.8);
            const late = c.schedule.status === "OVERDUE";
            return (
              <div key={c.id} className="flex items-center border-b border-border/60 bg-muted/30 py-1.5">
                <div className={cn("flex w-60 shrink-0 items-center gap-2 pr-3", c.parentId && "pl-4")}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                  <span className={cn("truncate text-xs", c.parentId ? "font-medium" : "font-semibold")}>
                    {c.parentId ? "└ " : ""}
                    {c.name}
                  </span>
                </div>
                <div className="relative h-5 flex-1">
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0.6 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.4 }}
                    title={`${c.name}\n${formatDate(c.startDate) || "…"} → ${formatDate(c.dueDate) || "…"} · ${c.progress}%`}
                    className={cn("absolute inset-y-0.5 origin-left overflow-hidden rounded", late && "ring-2 ring-danger")}
                    style={{ left: `${left}%`, width: `${width}%`, background: `${c.color}26`, border: `1px solid ${c.color}` }}
                  >
                    <div className="h-full" style={{ width: `${c.progress}%`, background: `${c.color}99` }} />
                  </motion.div>
                </div>
              </div>
            );
          })}
          {rows.map((t, i) => {
            const s = new Date(t.startDate ?? t.createdAt).getTime();
            const e = t.dueDate ? new Date(t.dueDate).getTime() : s + DAY;
            const left = ((s - start) / span) * 100;
            const width = Math.max(((Math.max(e, s + DAY) - s) / span) * 100, 0.8);
            const color = (t.categoryId && catColor.get(t.categoryId)) || "#94a3b8";
            const overdue = isOverdue(t.dueDate, t.status);
            return (
              <div key={t.id} className="flex items-center border-b border-border/60 py-2 last:border-0">
                <div className="flex w-60 shrink-0 items-center gap-2 pr-3">
                  {t.assignee ? <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size="xs" /> : <span className="h-6 w-6" />}
                  <span className={cn("truncate text-xs", t.status === "DONE" && "text-muted-foreground")}>{t.title}</span>
                </div>
                <div className="relative h-6 flex-1">
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0.6 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.4 }}
                    title={`${t.title}\n${formatDate(t.startDate ?? t.createdAt)} → ${t.dueDate ? formatDate(t.dueDate) : "chưa có hạn"} · ${t.effectiveProgress}%`}
                    className={cn("absolute inset-y-0.5 origin-left overflow-hidden rounded-md", overdue && "ring-2 ring-danger")}
                    style={{ left: `${left}%`, width: `${width}%`, background: `${color}33` }}
                  >
                    <div className="h-full rounded-md" style={{ width: `${t.effectiveProgress}%`, background: color }} />
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>Phần đậm = tiến độ đã hoàn thành · màu theo hạng mục · dải có viền = thời hạn hạng mục</span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-sm ring-2 ring-danger" /> Quá hạn
          </span>
        </p>
      </div>
    </div>
  );
}

export function ProgressPanel({ project }: { project: ProjectDetailData }) {
  const theme = useChartTheme();
  const statusData = useMemo(
    () =>
      ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"].map((s) => ({
        status: s,
        count: project.tasks.filter((t) => t.status === s).length,
      })),
    [project.tasks],
  );
  const overdue = project.tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
  const deadlineRows: DeadlineRow[] = useMemo(() => {
    const mains = project.categories.filter((c) => !c.parentId);
    return [
      { ...project, name: "Toàn dự án", level: 0 as const },
      ...mains.flatMap((m) => [
        { ...m, level: 1 as const },
        ...project.categories.filter((c) => c.parentId === m.id).map((c) => ({ ...c, level: 2 as const })),
      ]),
    ];
  }, [project]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Tiến độ theo deadline"
          description="Thực tế so với kế hoạch đến hôm nay (vạch đứng) của dự án, từng hạng mục và hạng mục con"
        />
        <DeadlineTable rows={deadlineRows} />
        {overdue > 0 && (
          <p className="mx-5 mb-5 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
            <TriangleAlert className="h-4 w-4" /> {overdue} công việc đang quá hạn cần được xử lý.
          </p>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <WorkloadCard workload={project.workload} />
        <Card>
          <CardHeader title="Trạng thái công việc" description="Toàn bộ công việc & task con" />
          <CardBody className="flex flex-col items-center gap-4">
            <StatusDonut data={statusData} size={180} />
            <ul className="w-full space-y-1.5">
              {statusLegend(statusData, theme).map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="flex-1 text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Tiến trình dự án (Timeline)" description="Thời gian thực hiện và tiến độ từng công việc chính" />
        <CardBody>
          <Timeline project={project} />
        </CardBody>
      </Card>
    </div>
  );
}
