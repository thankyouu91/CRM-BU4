"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MountOnOpen } from "@/components/ui/mount-on-open";
import { ActivityTimeline, UnscheduledProjects, type CalendarProject } from "@/components/projects/activity-timeline";
import type { Directory, ProjectListItemData } from "@/components/projects/types";
import { calendarPeriod, calendarSelection, moveCalendar, projectTiming, timelineSpan, type CalendarView } from "@/lib/project-calendar";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS } from "@/lib/constants";

const ProjectFormModal = dynamic(() => import("@/components/projects/project-form").then((m) => m.ProjectFormModal), {
  loading: () => <p role="status" className="fixed bottom-4 right-4 rounded-lg border bg-card px-4 py-2 shadow-pop">Đang mở biểu mẫu…</p>,
});
const VIEWS: { value: CalendarView; label: string }[] = [{ value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }];

export function ProjectsView({ initial, directory, canCreate, canFinance, initialView, initialAnchor, now }: {
  initial: ProjectListItemData[];
  directory: Directory;
  canCreate: boolean;
  canFinance: boolean;
  initialView: CalendarView;
  initialAnchor: string;
  now: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const period = useMemo(() => calendarPeriod(view, anchor), [view, anchor]);

  const { entries, unscheduled, outside, dueCount, nearest } = useMemo(() => {
    const entries: CalendarProject[] = [];
    const unscheduled: ProjectListItemData[] = [];
    let outside = 0;
    let dueCount = 0;
    let nearest: { distance: number; anchor: string } | null = null;
    const query = q.trim().toLocaleLowerCase("vi");
    for (const project of initial) {
      if ((filter !== "all" && project.status !== filter) || (query && !project.name.toLocaleLowerCase("vi").includes(query))) continue;
      const timing = projectTiming(project);
      if (!timing) { unscheduled.push(project); continue; }
      const span = timelineSpan(timing, period);
      if (!span) {
        outside++;
        const instant = timing.start >= period.until.getTime() ? timing.start : timing.end - 1;
        const distance = Math.abs(instant - period.from.getTime());
        if (!nearest || distance < nearest.distance) nearest = { distance, anchor: new Date(instant).toISOString() };
        continue;
      }
      entries.push({ project, timing, span });
      if (timing.end > period.from.getTime() && timing.end <= period.until.getTime()) dueCount++;
    }
    entries.sort((a, b) => a.timing.start - b.timing.start || a.timing.end - b.timing.end || a.project.name.localeCompare(b.project.name, "vi") || a.project.id.localeCompare(b.project.id));
    return { entries, unscheduled, outside, dueCount, nearest };
  }, [initial, period, q, filter]);

  const selectPeriod = (nextView: CalendarView, nextAnchor: string) => {
    setView(nextView);
    setAnchor(nextAnchor);
    const url = new URL(window.location.href);
    url.searchParams.set("calendar", nextView);
    url.searchParams.set("month", calendarPeriod("month", nextAnchor).key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return <div className="space-y-5">
    <PageHeader title="Lịch hoạt động dự án" description="Theo dõi thời gian triển khai và tiến độ theo tháng, quý, năm."
      actions={canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Tạo dự án</Button>} />

    <section className="overflow-hidden rounded-xl border bg-card shadow-card" aria-label="Lịch hoạt động">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="hidden rounded-lg bg-primary/10 p-2 text-primary sm:inline-flex"><CalendarDays className="h-5 w-5" /></span>
          <div><p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lịch triển khai</p><h2 aria-live="polite" className="mt-0.5 text-lg font-semibold tracking-tight">{period.label}</h2></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Chế độ lịch">
            {VIEWS.map((option) => <button type="button" key={option.value} aria-pressed={view === option.value} onClick={() => selectPeriod(option.value, anchor)}
              className={cn("rounded-md px-4 py-1.5 text-xs font-medium", view === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{option.label}</button>)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Kỳ trước" onClick={() => selectPeriod(view, moveCalendar(view, anchor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => selectPeriod(view, now)}>Hôm nay</Button>
          <Button variant="outline" size="icon" aria-label="Kỳ tiếp theo" onClick={() => selectPeriod(view, moveCalendar(view, anchor, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <input type="month" aria-label="Chọn tháng" min="1900-01" max="2200-12" value={calendarPeriod("month", anchor).key}
          onChange={(event) => { if (event.target.validity.valid && event.target.value) selectPeriod(view, calendarSelection(view, event.target.value, now).anchor); }}
          className="h-9 min-w-0 rounded-lg border bg-card px-2 text-xs" />
        <div className="hidden h-5 border-l xl:block" />
        <label className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Tìm dự án</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm dự án…" className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-xs" />
        </label>
        <select aria-label="Lọc trạng thái dự án" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 rounded-lg border bg-card px-3 text-xs sm:ml-auto">
          <option value="all">Tất cả trạng thái</option>{Object.entries(PROJECT_STATUS).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-5 py-3 text-xs text-muted-foreground" aria-live="polite">
        <span><strong className="font-semibold tabular-nums text-foreground">{entries.length}</strong> dự án trong kỳ</span>
        <span><strong className="font-semibold tabular-nums text-foreground">{dueCount}</strong> đến hạn trong kỳ</span>
        {outside > 0 && <span className="ml-auto">{outside} dự án ngoài kỳ này</span>}
      </div>
      {entries.length ? <ActivityTimeline entries={entries} period={period} view={view} now={now} /> : <EmptyState icon={CalendarDays}
        title={q || filter !== "all" ? "Không có dự án phù hợp trong kỳ" : "Chưa có hoạt động trong kỳ này"}
        description={unscheduled.length ? "Các dự án chưa có lịch nằm bên dưới. Bổ sung ngày trong chi tiết dự án để đưa lên lịch." : "Chọn kỳ khác để xem lịch triển khai, hoặc tạo dự án mới."}
        action={nearest && <Button variant="outline" size="sm" onClick={() => selectPeriod(view, nearest.anchor)}>Xem kỳ có dự án gần nhất</Button>} />}
    </section>
    <UnscheduledProjects projects={unscheduled} />
    <MountOnOpen open={creating}><ProjectFormModal open={creating} onClose={() => setCreating(false)} directory={directory}
      finance={canFinance ? { contracts: [] } : undefined} onSaved={(id) => router.push(`/projects/${id}`)} /></MountOnOpen>
  </div>;
}
