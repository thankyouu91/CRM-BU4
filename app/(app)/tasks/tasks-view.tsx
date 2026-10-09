"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CheckCircle2, ChevronRight, Clock, GitBranch, ListChecks, Loader2, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { KpiTile } from "@/components/kpi";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { api, ApiError, useApi } from "@/lib/client";
import { cn, formatShortDate } from "@/lib/utils";

interface Row {
  id: string;
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

type Bucket = "overdue" | "today" | "week" | "later" | "none" | "done";
const BUCKETS: { key: Bucket; label: string; icon: React.ComponentType<{ className?: string }>; tone?: string }[] = [
  { key: "overdue", label: "Quá hạn", icon: TriangleAlert, tone: "text-danger" },
  { key: "today", label: "Hôm nay", icon: CalendarClock },
  { key: "week", label: "7 ngày tới", icon: Clock },
  { key: "later", label: "Sắp tới", icon: CalendarClock },
  { key: "none", label: "Không có hạn chót", icon: ListChecks },
  { key: "done", label: "Đã hoàn thành", icon: CheckCircle2 },
];

function bucketOf(t: Row): Bucket {
  if (t.status === "DONE") return "done";
  if (!t.dueDate) return "none";
  const due = new Date(t.dueDate);
  const now = new Date();
  if (due < now) return "overdue";
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  if (due <= endToday) return "today";
  if (due.getTime() - now.getTime() <= 7 * 86_400_000) return "week";
  return "later";
}

export function MyTasksView({ canSeeAll, initial }: { canSeeAll: boolean; initial?: { tasks: Row[] } }) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [q, setQ] = useState("");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<Bucket>>(new Set(["done"]));
  const { data, loading, reload } = useApi<{ tasks: Row[] }>(`/api/tasks?scope=${scope}`, { initial });

  const tasks = useMemo(
    () => (data?.tasks ?? []).filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase())),
    [data, q],
  );
  const grouped = useMemo(() => {
    const g = new Map<Bucket, Row[]>();
    for (const t of tasks) {
      const b = bucketOf(t);
      g.set(b, [...(g.get(b) ?? []), t]);
    }
    const done = g.get("done");
    done?.sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime());
    return g;
  }, [tasks]);

  const all = data?.tasks ?? [];
  const weekAgo = Date.now() - 7 * 86_400_000;
  const stats = {
    open: all.filter((t) => t.status !== "DONE").length,
    active: all.filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW").length,
    overdue: all.filter((t) => bucketOf(t) === "overdue").length,
    doneWeek: all.filter((t) => t.status === "DONE" && t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length,
  };

  const toggle = async (t: Row) => {
    try {
      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { status: t.status === "DONE" ? "IN_PROGRESS" : "DONE" } });
      if (t.status !== "DONE") toast.success("Đã hoàn thành công việc");
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    }
  };

  const flip = (b: Bucket) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });

  return (
    <div>
      <PageHeader
        title="Công việc của tôi"
        description="Tất cả công việc bạn phụ trách, sắp xếp theo mức độ khẩn cấp."
        actions={
          canSeeAll && (
            <Segmented
              layoutId="task-scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: "mine", label: "Tôi phụ trách" },
                { value: "all", label: "Tất cả dự án" },
              ]}
            />
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Chưa hoàn thành" value={stats.open} icon={ListChecks} />
        <KpiTile label="Đang thực hiện" value={stats.active} sub="Gồm cả chờ duyệt" icon={Clock} />
        <KpiTile label="Quá hạn" value={stats.overdue} icon={TriangleAlert} tone={stats.overdue ? "critical" : "default"} sub={stats.overdue ? "Ưu tiên xử lý ngay" : "Không có việc trễ"} />
        <KpiTile label="Hoàn thành 7 ngày qua" value={stats.doneWeek} icon={CheckCircle2} />
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm công việc…"
          className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={ListChecks} title={q ? "Không tìm thấy công việc" : "Bạn chưa được giao công việc nào"} description="Công việc được giao cho bạn sẽ xuất hiện tại đây." />
        </div>
      ) : (
        <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
          {BUCKETS.filter((b) => grouped.get(b.key)?.length).map((b) => {
            const rows = grouped.get(b.key)!;
            const isCollapsed = collapsed.has(b.key);
            const Icon = b.icon;
            return (
              <section key={b.key} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <button onClick={() => flip(b.key)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/40">
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                  <Icon className={cn("h-4 w-4", b.tone ?? "text-muted-foreground")} />
                  <span className={cn("font-semibold", b.tone)}>{b.label}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{rows.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.ul initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      {rows.map((t) => (
                        <li
                          key={t.id}
                          onClick={() => setOpenTask(t.id)}
                          className="flex cursor-pointer items-center gap-3 border-t px-4 py-3 hover:bg-muted/40"
                        >
                          <StatusToggle status={t.status} onToggle={() => toggle(t)} />
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
                          </div>
                          <div className="hidden items-center gap-3 md:flex">
                            <TaskStatusBadge status={t.status} />
                            {t.priority !== "MEDIUM" && <PriorityBadge priority={t.priority} />}
                            <div className="w-28">
                              <ProgressBar value={t.status === "DONE" ? 100 : t.progress} height={6} showLabel />
                            </div>
                          </div>
                          <span className={cn("w-12 text-right text-xs tabular-nums", b.key === "overdue" ? "font-semibold text-danger" : "text-muted-foreground")}>
                            {t.dueDate ? formatShortDate(t.dueDate) : "—"}
                          </span>
                          {scope === "all" && (t.assignee ? <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size="xs" /> : <span className="h-6 w-6" />)}
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

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={reload} />
    </div>
  );
}
