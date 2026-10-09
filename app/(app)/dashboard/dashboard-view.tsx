"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Clock, FileText, Loader2, Timer, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { KpiTile } from "@/components/kpi";
import {
  ChartCard,
  DataTable,
  Legend,
  StatusDonut,
  TrendChart,
  WorkloadChart,
  statusLegend,
  trendLegend,
  workloadLegend,
} from "@/components/charts/charts";
import { api } from "@/lib/client";
import { useChartTheme } from "@/lib/chart-theme";
import type { Summary } from "@/lib/stats";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type Period = "day" | "month" | "quarter" | "year";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Hôm nay" },
  { value: "month", label: "Tháng này" },
  { value: "quarter", label: "Quý này" },
  { value: "year", label: "Năm nay" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export function DashboardView({ initial, userName }: { initial: Summary; userName: string }) {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const theme = useChartTheme();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<Summary>(`/api/reports/summary?period=${period}`)
      .then((s) => !cancelled && setData(s))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period]);

  const k = data.kpis;
  const firstName = userName.trim().split(/\s+/).pop();

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={`Tổng quan hoạt động · ${data.period.label}`}
        actions={
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Segmented layoutId="dash-period" value={period} onChange={setPeriod} options={PERIODS} />
          </div>
        }
      />

      <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="flex items-center gap-5 p-5 sm:col-span-2 xl:col-span-1 xl:flex-col xl:items-start xl:gap-3">
            <ProgressRing value={k.overallProgress} size={84} stroke={8} label={<span className="text-lg font-bold">{k.overallProgress}%</span>} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tiến độ tổng thể</p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{k.totalProjects}</span> dự án ·{" "}
                <span className="font-semibold">{k.activeProjects}</span> đang chạy
              </p>
            </div>
          </Card>
          <KpiTile
            label="Hoàn thành trong kỳ"
            value={k.doneTasks}
            sub={`${k.completionRate}% trong ${k.totalTasks} công việc`}
            icon={CheckCircle2}
          />
          <KpiTile label="Đang thực hiện" value={k.inProgressTasks} sub="Gồm cả chờ duyệt" icon={Clock} />
          <KpiTile
            label="Quá hạn"
            value={k.overdueTasks}
            sub={k.overdueTasks ? "Cần ưu tiên xử lý" : "Không có việc trễ hạn"}
            icon={TriangleAlert}
            tone={k.overdueTasks ? "critical" : "default"}
          />
          <KpiTile label="Giờ công đã ghi" value={k.hoursLogged} sub={`${k.reportsCount} báo cáo tiến độ`} icon={Timer} />
        </div>

        {/* Trend + status */}
        <div className="grid gap-6 xl:grid-cols-3">
          <ChartCard
            id="trend"
            className="xl:col-span-2"
            title="Xu hướng công việc"
            description="Số công việc tạo mới và hoàn thành theo thời gian"
            legend={<Legend items={trendLegend(theme)} />}
            chart={<TrendChart data={data.trend} />}
            table={
              <DataTable
                columns={[
                  { key: "label", label: "Thời điểm" },
                  { key: "created", label: "Tạo mới", align: "right" },
                  { key: "completed", label: "Hoàn thành", align: "right" },
                ]}
                rows={data.trend}
              />
            }
          />
          <ChartCard
            id="status"
            title="Phân bổ trạng thái"
            description="Công việc trong kỳ theo trạng thái"
            chart={
              <div className="flex flex-col items-center gap-5 pt-2">
                <StatusDonut data={data.statusDistribution} />
                <ul className="w-full space-y-2">
                  {statusLegend(data.statusDistribution, theme).map((s) => (
                    <li key={s.label} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      <span className="flex-1 text-muted-foreground">{s.label}</span>
                      <span className="font-semibold tabular-nums">{s.count}</span>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{s.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            }
            table={
              <DataTable
                columns={[
                  { key: "label", label: "Trạng thái" },
                  { key: "count", label: "Số lượng", align: "right" },
                  { key: "pct", label: "Tỷ lệ", align: "right" },
                ]}
                rows={statusLegend(data.statusDistribution, theme).map((s) => ({ ...s, pct: `${s.pct}%` }))}
              />
            }
          />
        </div>

        {/* Projects + workload */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Tiến độ dự án"
              description="Tỷ lệ hoàn thành hiện tại của từng dự án"
              action={
                <Link href="/projects" className="text-xs font-medium text-primary hover:underline">
                  Xem tất cả
                </Link>
              }
            />
            <CardBody className="space-y-5">
              {data.projects.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dự án nào.</p>
              )}
              {data.projects.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/projects/${p.id}`} className="group block">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                        <span className="truncate text-sm font-medium group-hover:text-primary">{p.name}</span>
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      <span className="text-sm font-semibold">{p.progress}%</span>
                    </div>
                    <ProgressBar value={p.progress} />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {p.doneTasks}/{p.totalTasks} công việc hoàn thành
                      {p.overdueTasks > 0 && (
                        <span className="text-danger">
                          {" "}
                          · <TriangleAlert className="inline h-3 w-3" /> {p.overdueTasks} quá hạn
                        </span>
                      )}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </CardBody>
          </Card>

          <ChartCard
            id="workload"
            title="Khối lượng theo nhân sự"
            description="Công việc được giao trong kỳ, theo tình trạng"
            legend={<Legend items={workloadLegend(theme)} />}
            chart={
              data.people.length ? (
                <WorkloadChart data={data.people} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu.</p>
              )
            }
            table={
              <DataTable
                columns={[
                  { key: "name", label: "Nhân sự" },
                  { key: "done", label: "Hoàn thành", align: "right" },
                  { key: "inProgress", label: "Đang làm", align: "right" },
                  { key: "overdue", label: "Quá hạn", align: "right" },
                  { key: "remaining", label: "Còn lại", align: "right" },
                  { key: "hours", label: "Giờ công", align: "right" },
                ]}
                rows={data.people}
              />
            }
          />
        </div>

        {/* Deadlines + reports */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Hạn chót sắp tới" description="Công việc chưa xong đến hạn trong 14 ngày" />
            <CardBody className="pt-3">
              {data.upcoming.length === 0 ? (
                <EmptyState icon={CalendarClock} title="Không có hạn chót gần" className="py-8" />
              ) : (
                <ul className="divide-y">
                  {data.upcoming.map((t) => {
                    const d = daysLeft(t.dueDate);
                    return (
                      <li key={t.id} className="flex items-center gap-3 py-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none",
                            d <= 2 ? "bg-danger/10 text-danger" : "bg-muted text-foreground",
                          )}
                        >
                          <span className="text-base font-bold">{new Date(t.dueDate).getDate()}</span>
                          <span className="mt-0.5 text-[10px]">Th{new Date(t.dueDate).getMonth() + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.projectName}
                            {t.assigneeName && ` · ${t.assigneeName}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <PriorityBadge priority={t.priority} />
                          <span className="text-[11px] text-muted-foreground">
                            {d <= 0 ? "Hôm nay" : `Còn ${d} ngày`}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Báo cáo tiến độ gần đây"
              description="Báo cáo từ người thực hiện trong kỳ"
              action={
                <Link href="/inbox" className="text-xs font-medium text-primary hover:underline">
                  Hộp báo cáo
                </Link>
              }
            />
            <CardBody className="pt-3">
              {data.recentReports.length === 0 ? (
                <EmptyState icon={FileText} title="Chưa có báo cáo trong kỳ" className="py-8" />
              ) : (
                <ul className="space-y-4">
                  {data.recentReports.slice(0, 6).map((r) => (
                    <li key={r.id} className="flex gap-3">
                      <Avatar name={r.authorName} size="sm" color={r.authorColor} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{r.authorName}</span>
                          <span className="text-muted-foreground"> · {r.taskTitle}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.content}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{r.progress}%</span>
                          <span>{r.hoursSpent} giờ</span>
                          <span>{timeAgo(r.createdAt)}</span>
                          {!r.reviewedAt && <span className="font-medium text-warning">Chờ xem xét</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Dữ liệu cập nhật lúc {formatDate(new Date(), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
