"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { TaskDrawer } from "@/components/tasks/lazy-task-drawer";
import { useApi } from "@/lib/client";
import { departmentGroups, type DepartmentReport, type DepartmentRow } from "@/lib/department-report";
import { shiftWorkPeriod, workPeriodFromKey, workPeriodOf, zonedText } from "@/lib/work-report";
import { cn } from "@/lib/utils";
import { ReportModeNav } from "./report-mode-nav";

export function DepartmentReportView({ initial, projects }: {
  initial: DepartmentReport;
  projects: { id: string; name: string }[];
}) {
  const [week, setWeek] = useState(initial.week);
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const query = new URLSearchParams({ week, ...(projectId ? { projectId } : {}) }).toString();
  const { data, loading, error, reload } = useApi<DepartmentReport>(`/api/reports/department?${query}`, { initial });
  // Never put the previous filter's rows or export under the newly selected week/project.
  const report = !loading && !error && data?.week === week && (data.projectId ?? "") === projectId ? data : null;
  const period = workPeriodFromKey("WEEK", week)!;
  const today = workPeriodOf("WEEK", new Date(data?.asOf ?? initial.asOf));
  const select = (nextWeek: string, nextProject = projectId) => {
    if (!workPeriodFromKey("WEEK", nextWeek)) return;
    setWeek(nextWeek); setProjectId(nextProject); setOpenTask(null);
    const sp = new URLSearchParams({ view: "department", week: nextWeek, ...(nextProject ? { projectId: nextProject } : {}) });
    window.history.replaceState(null, "", `/reports?${sp}`);
  };
  const exportReport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const { exportDepartmentReport } = await import("@/lib/export/department-report-xlsx");
      await exportDepartmentReport(report, projects.find(p => p.id === projectId)?.name ?? "Toàn bộ phạm vi được quyền xem");
    } catch { toast.error("Không thể xuất báo cáo. Vui lòng thử lại."); }
    finally { setExporting(false); }
  };

  return <div>
    <ReportModeNav projectId={projectId} />
    <PageHeader title="Báo cáo công việc phòng" description="Kết quả tuần trước, việc phải làm tuần này và kế hoạch tuần tới."
      actions={<><Button variant="outline" onClick={reload} disabled={loading} aria-label="Làm mới báo cáo"><RefreshCw className="h-4 w-4" /></Button>
        <Button onClick={exportReport} disabled={!report} loading={exporting}><Download className="h-4 w-4" /> Xuất Excel gửi sếp</Button></>} />

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Tuần báo cáo trước" onClick={() => select(shiftWorkPeriod(period, -1).key)}><ChevronLeft className="h-4 w-4" /></Button>
        <label className="text-xs text-muted-foreground">Tuần báo cáo
          <input aria-label="Chọn tuần báo cáo" type="week" value={week} onChange={e => select(e.target.value)} className="ml-2 h-9 rounded-lg border bg-card px-2 text-sm font-medium text-foreground" />
        </label>
        <Button variant="ghost" size="icon" aria-label="Tuần báo cáo tiếp theo" onClick={() => select(shiftWorkPeriod(period, 1).key)}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="secondary" size="sm" onClick={() => select(today.key)}>Tuần hiện tại</Button>
      </div>
      <select aria-label="Phạm vi dự án" value={projectId} onChange={e => select(week, e.target.value)} className="h-9 w-full rounded-lg border bg-card px-3 text-sm sm:max-w-xs">
        <option value="">Toàn bộ phạm vi được quyền xem</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>

    {error ? <div role="alert" className="rounded-xl border border-danger/30 p-6 text-sm"><p>{error}</p><Button className="mt-3" variant="outline" onClick={reload}>Thử lại</Button></div>
      : !report ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Đang tải báo cáo phòng…</div>
      : <>
        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          {report.sections.map((section, index) => <a key={section.id} href={`#report-${section.id}`} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{["Kết quả tuần trước", "Ưu tiên tuần này", "Kế hoạch tuần tới"][index]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{section.period.label}</p>
            <p className="mt-4 text-3xl font-bold tabular-nums">{[report.counts.previousDone, report.counts.currentOpen, report.counts.nextPlanned][index]} <span className="text-sm font-normal text-muted-foreground">{["việc đã xong", "việc cần xử lý", "việc theo kế hoạch"][index]}</span></p>
            <p className="mt-2 text-xs text-muted-foreground">{[
              `${report.counts.previousOutstanding} việc đến hạn tuần trước vẫn chưa xong`,
              `${report.counts.carryover} việc tồn từ trước · ${report.counts.currentDone} đã xong · ${report.counts.blocked} bị chặn`,
              "Theo deadline và ngày bắt đầu; chưa tính việc đã hoàn thành",
            ][index]}</p>
          </a>)}
        </div>
        <div className="mb-6 space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p>Cập nhật lúc {zonedText(report.asOf, "datetime")} · Thứ Hai – Chủ nhật · Giờ Việt Nam.</p>
          <p>Trạng thái và tiến độ là hiện tại. Kết quả xếp theo ngày hoàn thành, kế hoạch theo ngày bắt đầu và deadline; không phải bản chụp trạng thái quá khứ.</p>
          <p>Đếm công việc chi tiết; công việc tổng có việc con chỉ dùng làm ngữ cảnh, không cộng lặp. Các tuần là tương đối với tuần báo cáo đang chọn.</p>
        </div>
        <div className="space-y-7">
          {report.sections.map(section => <section id={`report-${section.id}`} aria-label={section.title} key={section.id} className="scroll-mt-6 overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-5 py-4"><h2 className="font-semibold">{section.title}</h2><p className="mt-1 text-xs text-muted-foreground">{section.period.label}</p></div>
            {section.buckets.every(b => b.rows.length === 0) ? <p className="p-6 text-sm text-muted-foreground">Chưa có công việc phù hợp trong tuần này.</p>
              : section.buckets.filter(b => b.rows.length).map(b => <div key={b.id} className="border-b last:border-0">
                <h3 className={cn("flex items-center gap-2 px-5 py-3 text-sm font-semibold", b.id === "carryover" || b.id === "outstanding" ? "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" : "bg-muted/40")}>
                  {b.label}<span className="rounded bg-card/70 px-2 py-0.5 text-xs tabular-nums">{b.rows.length}</span>
                </h3>
                <DepartmentTable rows={b.rows} label={`${section.title} · ${b.label}`} onOpen={setOpenTask} />
              </div>)}
          </section>)}
          <section aria-label="Công việc cần bổ sung lịch" className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4 text-amber-600" /> Chưa có deadline <span className="text-muted-foreground">{report.unscheduled.length}</span></h2>
              <p className="mt-1 text-xs text-muted-foreground">Cần chốt hạn hoàn thành để lên kế hoạch. Việc đang làm vẫn có thể xuất hiện ở tuần này.</p></div>
            {report.unscheduled.length ? <DepartmentTable rows={report.unscheduled.map(task => ({ task, updates: [] }))} label="Công việc chưa có deadline" onOpen={setOpenTask} />
              : <p className="p-5 text-sm text-muted-foreground">Mọi công việc chưa xong đã có deadline.</p>}
          </section>
          {report.missingCompletion.length > 0 && <details className="rounded-xl border bg-card">
            <summary className="cursor-pointer p-5 text-sm font-medium">{report.missingCompletion.length} việc đã xong cần kiểm tra ngày hoàn thành</summary>
            <p className="px-5 pb-4 text-xs text-muted-foreground">Thiếu ngày hoàn thành hoặc ngày nằm trong tương lai; chưa đưa vào kết quả của tuần nào.</p>
            <DepartmentTable rows={report.missingCompletion.map(task => ({ task, updates: [] }))} label="Công việc cần kiểm tra ngày hoàn thành" onOpen={setOpenTask} />
          </details>}
        </div>
      </>}
    <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={reload} />
  </div>;
}

function DepartmentTable({ rows, label, onOpen }: { rows: DepartmentRow[]; label: string; onOpen: (id: string) => void }) {
  return <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
    <table className="w-full min-w-[800px] text-sm">
      <caption className="sr-only">{label}</caption>
      <thead className="border-b text-left text-xs text-muted-foreground"><tr>
        <th scope="col" className="w-[48%] px-5 py-2.5 font-medium">Hạng mục / Công việc & kết quả</th>
        <th scope="col" className="px-3 py-2.5 font-medium">Phụ trách</th>
        <th scope="col" className="px-3 py-2.5 font-medium">Tình trạng hiện tại</th>
        <th scope="col" className="px-3 py-2.5 text-right font-medium">Tiến độ</th>
        <th scope="col" className="px-5 py-2.5 font-medium">Deadline</th>
      </tr></thead>
      <tbody>{departmentGroups(rows).map(group => <Fragment key={JSON.stringify([group.project.id, group.category])}>
        <tr className="border-b bg-muted/20"><th colSpan={5} scope="colgroup" className="px-5 py-2 text-left text-xs font-medium">
          <Link href={`/projects/${group.project.id}`} className="hover:text-primary">{group.project.name}</Link><span className="mx-2 text-muted-foreground">/</span>{group.category}
        </th></tr>
        {group.rows.map(({ task: t, updates }) => <tr key={t.id} className="border-b align-top last:border-0 hover:bg-muted/20">
          <td className="px-5 py-3">
            {t.parentTitle && <p className="mb-1 text-[11px] text-muted-foreground">Thuộc: {t.parentTitle}</p>}
            <button onClick={() => onOpen(t.id)} className="text-left font-medium hover:text-primary hover:underline">{t.title}</button>
            {t.projectStatus === "ON_HOLD" && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Dự án đang tạm dừng</p>}
            {t.description && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Nội dung công việc</summary><p className="mt-1 whitespace-pre-wrap break-words">{t.description}</p></details>}
            {updates.length > 0 && <details className="mt-2 text-xs" open><summary className="cursor-pointer font-medium text-muted-foreground">Cập nhật trong tuần ({updates.length})</summary>
              <ul className="mt-2 space-y-2 border-l-2 pl-3">{updates.map(update => <li key={update.id}>
                <p className="text-[11px] text-muted-foreground">{zonedText(update.createdAt, "datetime")} · {update.author} · {update.progress}%</p>
                <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{update.content}</p>
              </li>)}</ul>
            </details>}
          </td>
          <td className="px-3 py-3 text-xs">{t.assignee?.name ?? <span className="text-amber-700 dark:text-amber-300">Chưa phân công</span>}</td>
          <td className="space-y-2 px-3 py-3"><TaskStatusBadge status={t.status} />
            {(t.priority === "HIGH" || t.priority === "URGENT") && <div><PriorityBadge priority={t.priority} /></div>}
            {t.status === "DONE" && t.completedAt && <p className="text-[11px] text-muted-foreground">Xong {zonedText(t.completedAt)}</p>}
          </td>
          <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums">{t.progress}%</td>
          <td className="px-5 py-3 text-xs tabular-nums"><p className={cn(t.overdue && "font-semibold text-danger")}>{t.dueDate ? zonedText(t.dueDate) : "Chưa có hạn"}</p>
            {t.overdue && <p className="mt-1 text-[11px] text-danger">Quá hạn</p>}
            {t.startDate && <p className="mt-1 text-[11px] text-muted-foreground">Bắt đầu {zonedText(t.startDate)}</p>}
          </td>
        </tr>)}
      </Fragment>)}</tbody>
    </table>
  </div>;
}
