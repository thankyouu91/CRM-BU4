"use client";

import { Pagination } from "@/components/ui/pagination";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CalendarX, CheckCircle2, ChevronRight, Clock, GitBranch, ListChecks, Loader2, Search, TriangleAlert, UserX } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { KpiTile } from "@/components/kpi";
import { useTaskMenu } from "@/components/tasks/task-menu";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { TaskDrawer } from "@/components/tasks/lazy-task-drawer";
import { BulkBar } from "@/components/tasks/bulk-bar";
import { TaskCalendar } from "@/components/tasks/task-calendar";
import { api, ApiError, useApi, useDebouncedValue } from "@/lib/client";
import { groupBy } from "@/lib/task-tree";
import { DEADLINE_FILTERS, taskDeadlineBucket, taskDeadlinePeriods, type DeadlineBucket, type DeadlineFilter } from "@/lib/task-deadlines";
import { zonedText } from "@/lib/work-report";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  canReport: boolean;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  project: { id: string; name: string; color: string };
  category: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string; avatarColor: string } | null;
  parent: { id: string; title: string } | null;
  _count: { subtasks: number; reports: number };
}

type Issue = "unassigned" | "nodue" | "overdue";
interface TaskPage {
  tasks: Row[]; total: number; nextCursor: string | null;
  stats: { open: number; active: number; overdue: number; doneWeek: number; done?: number };
  issues?: Record<Issue, number>; issue?: Issue | null;
  deadline: DeadlineFilter; asOf: string;
}

const ISSUES: { key: Issue; label: string; icon: React.ComponentType<{ className?: string }>; allOnly?: boolean }[] = [
  { key: "unassigned", label: "Chưa giao người", icon: UserX, allOnly: true },
  { key: "nodue", label: "Chưa có deadline", icon: CalendarX },
  { key: "overdue", label: "Quá hạn", icon: TriangleAlert },
];

type Bucket = DeadlineBucket;
const BUCKETS: { key: Bucket; label: string; icon: React.ComponentType<{ className?: string }>; tone?: string }[] = [
  { key: "overdue", label: "Quá hạn", icon: TriangleAlert, tone: "text-danger" },
  { key: "today", label: "Hôm nay", icon: CalendarClock },
  { key: "week", label: "7 ngày tới", icon: Clock },
  { key: "later", label: "Sắp tới", icon: CalendarClock },
  { key: "none", label: "Không có hạn chót", icon: ListChecks },
  { key: "done", label: "Đã hoàn thành", icon: CheckCircle2 },
];

export function MyTasksView({
  canSeeAll,
  initial,
  initialFilter,
  projects = [],
  tabs,
}: {
  canSeeAll: boolean;
  initial?: TaskPage;
  initialFilter?: { scope: "mine" | "all"; issue: Issue | null };
  projects?: { id: string; name: string }[];
  tabs?: React.ReactNode;
}) {
  const [scope, setScope] = useState<"mine" | "all">(initialFilter?.scope ?? "mine");
  const [issue, setIssue] = useState<Issue | null>(initialFilter?.issue ?? null);
  const [projectId, setProjectId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState<DeadlineFilter>("all");
  const [q, setQ] = useState("");
  const query = useDebouncedValue(q);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<Bucket>>(new Set(["done"]));
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const filters = `${issue ? `&issue=${issue}` : ""}${projectId ? `&projectId=${projectId}` : ""}`;
  const { data: response, loading, error, reload } = useApi<TaskPage>(q === query ? `/api/tasks?scope=${scope}&q=${encodeURIComponent(query)}&deadline=${deadline}${filters}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}` : null, { initial });
  // Do not display the previous period's tasks or statistics under the new label.
  const data = response?.deadline === deadline && (response.issue ?? null) === issue ? response : null;
  const busy = loading || q !== query;
  const now = useMemo(() => new Date(response?.asOf ?? Date.now()), [response?.asOf]);
  const periods = useMemo(() => taskDeadlinePeriods(now), [now]);
  const period = deadline === "all" ? null : periods[deadline];
  const restart = () => { setCursors([null]); setSelected(new Set()); };
  const selectDeadline = (value: DeadlineFilter) => { setDeadline(value); restart(); };
  const selectIssue = (value: Issue | null) => {
    setIssue(value);
    // Unassigned work is never "mine": look across projects.
    if (value === "unassigned") setScope("all");
    restart();
    const sp = new URLSearchParams(window.location.search);
    if (value) sp.set("issue", value);
    else sp.delete("issue");
    window.history.replaceState(null, "", sp.size ? `?${sp}` : window.location.pathname);
  };
  const flipSelected = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const grouped = useMemo(() => {
    const g = groupBy(tasks, (task) => taskDeadlineBucket(task, now, deadline));
    const done = g.get("done");
    done?.sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime());
    return g;
  }, [tasks, now, deadline]);

  const stats = data?.stats ?? { open: 0, active: 0, overdue: 0, doneWeek: 0 };

  const toggle = async (t: Row) => {
    try {
      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { status: t.status === "DONE" ? "IN_PROGRESS" : "DONE" } });
      if (t.status !== "DONE") toast.success("Đã hoàn thành công việc");
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    }
  };

  const taskMenu = useTaskMenu({ onOpen: setOpenTask, onToggle: toggle, canToggle: (task: Row) => task.canReport });

  const flip = (b: Bucket) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });

  return (
    <div>
      {taskMenu.menu}
      <PageHeader
        title="Công việc của tôi"
        description="Theo dõi trạng thái công việc và chủ động kế hoạch theo deadline."
        actions={
          canSeeAll && (
            <Segmented
              layoutId="task-scope"
              value={scope}
              onChange={(value) => { setScope(value); if (value === "mine" && issue === "unassigned") setIssue(null); restart(); }}
              options={[
                { value: "mine", label: "Tôi phụ trách" },
                { value: "all", label: "Tất cả dự án" },
              ]}
            />
          )
        }
      />
      {tabs}

      <TaskCalendar scope={scope} projectId={scope === "all" ? projectId : undefined} refreshKey={response?.asOf} onOpenTask={setOpenTask} />

      <div aria-busy={busy} className={cn("mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4", busy && "opacity-60")}>
        <KpiTile label="Chưa hoàn thành" value={data ? stats.open : "—"} icon={ListChecks} />
        <KpiTile label="Đang thực hiện" value={data ? stats.active : "—"} sub="Gồm cả chờ duyệt" icon={Clock} />
        <KpiTile label="Quá hạn" value={data ? stats.overdue : "—"} icon={TriangleAlert} tone={stats.overdue ? "critical" : "default"} sub={data ? stats.overdue ? "Ưu tiên xử lý ngay" : "Không có việc trễ" : undefined} />
        <KpiTile label={period ? "Đã hoàn thành" : "Hoàn thành 7 ngày qua"} value={data ? period ? (stats.done ?? data.total - stats.open) : stats.doneWeek : "—"} sub={period ? "Deadline thuộc kỳ đang chọn" : undefined} icon={CheckCircle2} />
      </div>

      <div role="group" aria-label="Lọc danh sách theo deadline" className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Deadline
        </span>
        {DEADLINE_FILTERS.map((option) => {
          const window = option.value === "all" ? null : periods[option.value];
          return (
            <button
              key={option.value}
              aria-pressed={deadline === option.value}
              onClick={() => selectDeadline(option.value)}
              title={window ? `${zonedText(window.start, "short")} – ${zonedText(window.end)} · theo giờ Việt Nam` : "Gồm cả việc chưa có hạn"}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", deadline === option.value ? "border-primary/40 bg-primary/10 text-primary" : "bg-card hover:bg-muted")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {!data && !error ? "Đang tải công việc…" : data ? `${period ? `${period.label} · ` : ""}${data.total} công việc${period ? " đến hạn trong kỳ" : ""}` : "Không thể tải công việc trong kỳ này."}
      </p>
      <div role="group" aria-label="Lọc nhanh việc cần bổ sung" className="mb-3 flex flex-wrap items-center gap-2">
        {ISSUES.filter((i) => !i.allOnly || scope === "all").map((i) => {
          const n = response?.issues?.[i.key];
          const Icon = i.icon;
          const on = issue === i.key;
          return (
            <button
              key={i.key}
              aria-pressed={on}
              onClick={() => selectIssue(on ? null : i.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                on ? "border-primary/40 bg-primary/10 text-primary" : "bg-card hover:bg-muted",
                !on && !!n && i.key === "overdue" && "border-danger/30 text-danger",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {i.label}
              {n !== undefined && <span className="rounded-full bg-muted px-1.5 tabular-nums text-muted-foreground">{n}</span>}
            </button>
          );
        })}
        {scope === "all" && projects.length > 0 && (
          <select
            aria-label="Lọc theo dự án"
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); restart(); }}
            className="h-8 max-w-full rounded-full border bg-card px-3 text-xs sm:max-w-xs"
          >
            <option value="">Mọi dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); restart(); }}
          placeholder="Tìm công việc…"
          aria-label="Tìm công việc"
          className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {!data ? (
        <div className="flex justify-center py-20">
          {error ? <button className="text-sm font-medium text-primary hover:underline" onClick={reload}>Thử lại</button> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={ListChecks}
            title={issue ? "Không còn việc nào trong mục này" : q ? "Không tìm thấy công việc" : period ? "Không có công việc đến hạn trong kỳ này" : "Bạn chưa được giao công việc nào"}
            description={
              issue
                ? { unassigned: "Mọi công việc chưa xong đều đã có người phụ trách.", nodue: "Mọi công việc chưa xong đều đã có deadline.", overdue: "Không có công việc nào trễ hạn." }[issue]
                : period ? "Chọn kỳ khác hoặc xem tất cả để tìm công việc có deadline khác và việc chưa có hạn chót." : "Công việc được giao cho bạn sẽ xuất hiện tại đây."
            }
            action={
              issue ? <button className="text-sm font-medium text-primary hover:underline" onClick={() => selectIssue(null)}>Bỏ lọc</button>
                : period && <button className="text-sm font-medium text-primary hover:underline" onClick={() => selectDeadline("all")}>Xem tất cả công việc</button>
            }
          />
        </div>
      ) : (
        <div className={cn("space-y-4 transition-opacity", busy && "opacity-60")}>
          {BUCKETS.filter((b) => grouped.get(b.key)?.length).map((b) => {
            const rows = grouped.get(b.key)!;
            const isCollapsed = collapsed.has(b.key);
            const Icon = b.icon;
            const pickable = rows.filter((t) => t.canReport).map((t) => t.id);
            const allPicked = pickable.length > 0 && pickable.every((id) => selected.has(id));
            return (
              <section key={b.key} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <div className="flex items-center">
                {pickable.length > 0 && (
                  <input
                    type="checkbox"
                    className="ml-4 h-4 w-4 shrink-0 accent-[rgb(var(--primary))]"
                    checked={allPicked}
                    onChange={() => flipSelected(pickable, !allPicked)}
                    aria-label={`Chọn tất cả ${pickable.length} việc trong nhóm ${b.label}`}
                  />
                )}
                <button onClick={() => flip(b.key)} aria-expanded={!isCollapsed} className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/40">
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                  <Icon className={cn("h-4 w-4", b.tone ?? "text-muted-foreground")} />
                  <span className={cn("font-semibold", b.tone)}>{b.key === "later" && period ? "Sắp đến hạn" : b.label}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{rows.length}</span>
                </button>
                </div>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.ul initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      {rows.map((t) => (
                        <li
                          key={t.id}
                          tabIndex={0}
                          {...taskMenu.bind(t)}
                          onClick={() => setOpenTask(t.id)}
                          className={cn("flex cursor-pointer items-center gap-3 border-t px-4 py-3 hover:bg-muted/40", selected.has(t.id) && "bg-primary/[0.04]")}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-[rgb(var(--primary))] disabled:opacity-30"
                            checked={selected.has(t.id)}
                            disabled={!t.canReport}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => flipSelected([t.id], e.target.checked)}
                            aria-label={`Chọn “${t.title}”`}
                            title={t.canReport ? undefined : "Bạn không có quyền sửa việc này"}
                          />
                          <StatusToggle status={t.status} disabled={!t.canReport} onToggle={() => toggle(t)} />
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm font-medium", t.status === "DONE" && "text-muted-foreground line-through")}>{t.title}</p>
                            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.project.color }} />
                              <span className="truncate">{t.project.name}</span>
                              {t.category && <span className="hidden truncate sm:inline">· {t.category.name}</span>}
                              {t.parent && (
                                <span className="hidden items-center gap-1 truncate md:flex">
                                  · <GitBranch className="h-3 w-3" /> {t.parent.title}
                                </span>
                              )}
                            </p>
                            <div className="mt-1 md:hidden"><TaskStatusBadge status={t.status} /></div>
                          </div>
                          <div className="hidden items-center gap-3 md:flex">
                            <TaskStatusBadge status={t.status} />
                            {t.priority !== "MEDIUM" && <PriorityBadge priority={t.priority} />}
                            <div className="w-28">
                              <ProgressBar value={t.status === "DONE" ? 100 : t.progress} height={6} showLabel />
                            </div>
                          </div>
                          <span className={cn("w-12 text-right text-xs tabular-nums", b.key === "overdue" ? "font-semibold text-danger" : "text-muted-foreground")}>
                            {t.dueDate ? zonedText(t.dueDate, "short") : "—"}
                          </span>
                          {scope === "all" && (t.assignee ? <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size="xs" /> : <span title="Chưa giao người" className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground"><UserX className="h-3 w-3" /></span>)}
                          {taskMenu.button(t)}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      )}

      {selected.size > 0 && <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} onDone={() => { setSelected(new Set()); void reload(); }} />}
      {error && <p role="alert" className="my-3 text-danger">{error}</p>}
      <Pagination total={data?.total ?? 0} page={cursors.length} busy={busy} hasNext={!!data?.nextCursor} onPrevious={() => setCursors((s) => s.slice(0, -1))} onNext={() => { if (data?.nextCursor) setCursors((s) => [...s, data.nextCursor]); }} />
      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={reload} />
    </div>
  );
}
