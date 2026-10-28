"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, Timer, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { KpiTile } from "@/components/kpi";
import { ProjectProgressCard } from "@/components/dashboard/project-progress-card";
import { RecentReportsCard, UpcomingCard } from "@/components/dashboard/activity-cards";
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
import { cn, formatDate } from "@/lib/utils";

type Period = "day" | "month" | "quarter" | "year";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Hôm nay" },
  { value: "month", label: "Tháng này" },
  { value: "quarter", label: "Quý này" },
  { value: "year", label: "Năm nay" },
];

export function DashboardView({ initial }: { initial: Summary }) {
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

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description={`Hoạt động ${data.period.label.toLowerCase()}`}
        actions={
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Segmented value={period} onChange={setPeriod} options={PERIODS} />
          </div>
        }
      />

      <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Card className="col-span-2 px-4 py-3.5 xl:col-span-1">
            <p className="text-xs font-medium text-muted-foreground">Tiến độ tổng thể</p>
            <p className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums">{k.overallProgress}%</p>
            <ProgressBar value={k.overallProgress} height={4} className="mt-2.5" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {k.totalProjects} dự án, {k.activeProjects} đang chạy
            </p>
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Xu hướng công việc"
            description="Công việc tạo mới, hoàn thành và dự án mới theo thời gian"
            legend={<Legend items={trendLegend(theme)} />}
            chart={<TrendChart data={data.trend} />}
            table={
              <DataTable
                columns={[
                  { key: "label", label: "Thời điểm" },
                  { key: "created", label: "Tạo mới", align: "right" },
                  { key: "completed", label: "Hoàn thành", align: "right" },
                  { key: "projects", label: "Dự án mới", align: "right" },
                ]}
                rows={data.trend}
              />
            }
          />
          <ChartCard
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ProjectProgressCard projects={data.projects} />

          <ChartCard
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <UpcomingCard upcoming={data.upcoming} />
          <RecentReportsCard reports={data.recentReports} />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Dữ liệu cập nhật lúc {formatDate(new Date(), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
