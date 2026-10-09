"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, FileText, Link2, Loader2, Sparkles, Timer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { KpiTile } from "@/components/kpi";
import { ChartCard, DataTable, HoursChart, Legend, StatusDonut, TrendChart, statusLegend, trendLegend } from "@/components/charts/charts";
import { DeckActions } from "@/components/deck/export-actions";
import { SlideScaler, SlideView } from "@/components/deck/slides";
import { DECK_THEMES } from "@/components/deck/theme";
import { PeriodFilter, defaultPeriod, periodQuery, type PeriodState } from "@/components/reports/period-filter";
import { useApi } from "@/lib/client";
import { useChartTheme } from "@/lib/chart-theme";
import { buildReportDeck, makeDeckMeta, slideTitle } from "@/lib/deck-model";
import type { Summary } from "@/lib/stats";
import { cn, formatDate, timeAgo } from "@/lib/utils";

export function ReportsView({
  projects,
  initialProjectId,
  userName,
}: {
  projects: { id: string; name: string; color: string }[];
  initialProjectId: string;
  userName: string;
}) {
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod("month"));
  const [projectId, setProjectId] = useState(initialProjectId);
  const [presentingAt, setPresentingAt] = useState<number | null>(null);
  const theme = useChartTheme();

  const query = periodQuery(period, projectId);
  const customIncomplete = period.type === "custom" && (!period.from || !period.to);
  const { data, loading } = useApi<Summary>(customIncomplete ? null : `/api/reports/summary?${query}`);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? null;
  const deck = useMemo(
    () => (data ? buildReportDeck(data, makeDeckMeta(data.period.label, projectName, userName)) : null),
    [data, projectName, userName],
  );

  const copyPresentLink = async () => {
    const url = `${window.location.origin}/present?${query}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết trình chiếu", { description: "Thành viên đã đăng nhập có thể mở để xem trực tuyến." });
    } catch {
      toast.message(url);
    }
  };

  const k = data?.kpis;

  return (
    <div>
      <PageHeader
        title="Trung tâm báo cáo"
        description="Lọc số liệu theo ngày, tháng, quý, năm — xuất PDF, PowerPoint hoặc trình chiếu trực tuyến."
        actions={<DeckActions deck={deck} disabled={loading} presentingAt={presentingAt} onPresentingChange={setPresentingAt} />}
      />

      {/* One filter row scopes everything below */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <PeriodFilter value={period} onChange={setPeriod} label={data?.period.label ?? "…"} />
        <div className="flex flex-wrap items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 max-w-[260px] rounded-lg border bg-card px-2 text-sm"
            aria-label="Phạm vi dự án"
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={copyPresentLink} disabled={customIncomplete}>
            <Link2 className="h-4 w-4" /> Link trình chiếu
          </Button>
          <Link href={`/ai?${query}`}>
            <Button variant="ghost" size="sm">
              <Sparkles className="h-4 w-4" /> Viết báo cáo với AI
            </Button>
          </Link>
        </div>
      </div>

      {customIncomplete ? (
        <div className="rounded-2xl border border-dashed bg-card py-16 text-center text-sm text-muted-foreground">Chọn ngày bắt đầu và kết thúc để xem báo cáo.</div>
      ) : !data || !k || !deck ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          {/* Deck preview */}
          <Card>
            <CardHeader
              title="Bản trình chiếu tự động"
              description={`${deck.slides.length} slide được tạo từ số liệu ${data.period.label.toLowerCase()} · bấm vào slide để trình chiếu từ đó`}
            />
            <CardBody>
              <div className="scrollbar-thin -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                {deck.slides.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setPresentingAt(i)}
                    className="group shrink-0 overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-pop focus-visible:ring-2"
                  >
                    <SlideScaler width={256}>
                      <SlideView slide={s} meta={deck.meta} theme={DECK_THEMES.dark} index={i} total={deck.slides.length} />
                    </SlideScaler>
                    <p className="w-64 truncate px-3 py-2 text-xs text-muted-foreground group-hover:text-foreground">
                      {i + 1}. {slideTitle(s, deck.meta)}
                    </p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label="Tiến độ tổng thể" value={`${k.overallProgress}%`} sub={`${k.totalProjects} dự án · ${k.activeProjects} đang chạy`} icon={CheckCircle2} />
            <KpiTile label="Hoàn thành trong kỳ" value={`${k.doneTasks}/${k.totalTasks}`} sub={`Tỷ lệ ${k.completionRate}%`} icon={CheckCircle2} />
            <KpiTile label="Quá hạn" value={k.overdueTasks} icon={TriangleAlert} tone={k.overdueTasks ? "critical" : "default"} sub={`${k.inProgressTasks} việc đang thực hiện`} />
            <KpiTile label="Giờ công" value={k.hoursLogged} sub={`${k.reportsCount} báo cáo tiến độ`} icon={Timer} />
          </div>

          {/* Charts */}
          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              id="r-trend"
              className="xl:col-span-2"
              title="Công việc tạo mới & hoàn thành"
              description={data.period.label}
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
              id="r-status"
              title="Trạng thái công việc"
              description="Công việc trong kỳ"
              chart={
                <div className="flex flex-col items-center gap-4">
                  <StatusDonut data={data.statusDistribution} size={180} />
                  <ul className="w-full space-y-1.5">
                    {statusLegend(data.statusDistribution, theme).map((s) => (
                      <li key={s.label} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                        <span className="flex-1 text-muted-foreground">{s.label}</span>
                        <span className="font-semibold tabular-nums">{s.count}</span>
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
                  ]}
                  rows={statusLegend(data.statusDistribution, theme)}
                />
              }
            />
          </div>

          <ChartCard
            id="r-hours"
            title="Giờ công được ghi nhận"
            description="Tổng giờ trong các báo cáo tiến độ theo thời gian"
            chart={<HoursChart data={data.trend} height={200} />}
            table={
              <DataTable
                columns={[
                  { key: "label", label: "Thời điểm" },
                  { key: "reports", label: "Số báo cáo", align: "right" },
                  { key: "hours", label: "Giờ công", align: "right" },
                ]}
                rows={data.trend}
              />
            }
          />

          {/* Projects table */}
          <Card>
            <CardHeader title="Chi tiết theo dự án" description="Tiến độ hiện tại và tình trạng công việc" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Dự án</th>
                    <th className="px-3 py-2.5 text-left font-medium">Trạng thái</th>
                    <th className="w-56 px-3 py-2.5 text-left font-medium">Tiến độ</th>
                    <th className="px-3 py-2.5 text-right font-medium">Hoàn thành</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quá hạn</th>
                    <th className="px-3 py-2.5 text-right font-medium">Thành viên</th>
                    <th className="px-5 py-2.5 text-right font-medium">Hạn chót</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Link href={`/projects/${p.id}`} className="flex items-center gap-2.5 font-medium hover:text-primary">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                          {p.name}
                        </Link>
                        <p className="ml-5 text-xs text-muted-foreground">{p.ownerName}</p>
                      </td>
                      <td className="px-3 py-3">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-3">
                        <ProgressBar value={p.progress} height={6} showLabel />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {p.doneTasks}/{p.totalTasks}
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", p.overdueTasks && "font-semibold text-danger")}>{p.overdueTasks}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.members}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{p.dueDate ? formatDate(p.dueDate) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* People table */}
          <Card>
            <CardHeader title="Hiệu suất nhân sự" description="Công việc được giao trong kỳ, báo cáo đã gửi và giờ công" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-y bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Nhân sự</th>
                    <th className="px-3 py-2.5 text-right font-medium">Được giao</th>
                    <th className="px-3 py-2.5 text-right font-medium">Hoàn thành</th>
                    <th className="px-3 py-2.5 text-right font-medium">Đang làm</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quá hạn</th>
                    <th className="px-3 py-2.5 text-right font-medium">Báo cáo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Giờ công</th>
                    <th className="w-44 px-5 py-2.5 text-left font-medium">Tỷ lệ hoàn thành</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.userId} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} color={p.avatarColor} />
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.jobTitle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.assigned}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.done}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.inProgress}</td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", p.overdue && "font-semibold text-danger")}>{p.overdue}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.reports}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.hours}</td>
                      <td className="px-5 py-3">
                        <ProgressBar value={p.assigned ? (p.done / p.assigned) * 100 : 0} height={6} showLabel />
                      </td>
                    </tr>
                  ))}
                  {data.people.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Không có dữ liệu nhân sự trong kỳ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent reports */}
          <Card>
            <CardHeader
              title="Báo cáo tiến độ trong kỳ"
              description="Từ người thực hiện gửi về quản lý"
              action={
                <Link href="/inbox" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Hộp báo cáo <ExternalLink className="h-3 w-3" />
                </Link>
              }
            />
            <CardBody>
              {data.recentReports.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" /> Chưa có báo cáo trong kỳ.
                </p>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {data.recentReports.map((r) => (
                    <li key={r.id} className="flex gap-3 rounded-xl border p-4">
                      <Avatar name={r.authorName} color={r.authorColor} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-semibold">{r.authorName}</span>
                          <span className="text-muted-foreground"> · {r.taskTitle}</span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.content}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{r.progress}%</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {r.hoursSpent} giờ
                          </span>
                          <span>{timeAgo(r.createdAt)}</span>
                          {r.reviewedAt ? <span className="text-success">Đã xem</span> : <span className="font-medium text-warning">Chờ xem xét</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
