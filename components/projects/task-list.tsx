"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronRight, FileText, FolderPlus, GitBranch, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, ScheduleBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { PlanBar, ProgressBar } from "@/components/ui/progress";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { ApiError, type SendChange } from "@/lib/client";
import { isOverdue } from "@/lib/dates";
import { daysLeftLabel } from "@/lib/schedule";
import { cn, formatShortDate } from "@/lib/utils";
import type { ProjectCategory, ProjectTask } from "./types";

export interface TaskFilters {
  mine: boolean;
  hideDone: boolean;
}

/** Indexes children by parent and decides visibility (a parent stays visible if any descendant matches). */
export function useTaskTree(tasks: ProjectTask[], filters: TaskFilters, meId: string) {
  return useMemo(() => {
    const childrenOf = new Map<string, ProjectTask[]>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const list = childrenOf.get(t.parentId) ?? [];
      list.push(t);
      childrenOf.set(t.parentId, list);
    }
    const matches = (t: ProjectTask) =>
      (!filters.mine || t.assigneeId === meId) && (!filters.hideDone || t.status !== "DONE");
    const visible = new Set<string>();
    const walk = (t: ProjectTask): boolean => {
      const kids = (childrenOf.get(t.id) ?? []).map(walk).some(Boolean);
      const v = matches(t) || kids;
      if (v) visible.add(t.id);
      return v;
    };
    tasks.filter((t) => !t.parentId).forEach(walk);
    return { childrenOf, visible };
  }, [tasks, filters, meId]);
}

interface RowCtx {
  childrenOf: Map<string, ProjectTask[]>;
  visible: Set<string>;
  canReport: (t: ProjectTask) => boolean;
  onOpen: (id: string) => void;
  onToggle: (t: ProjectTask) => void;
}

function TaskRow({ task, depth, ctx }: { task: ProjectTask; depth: number; ctx: RowCtx }) {
  const [open, setOpen] = useState(depth === 0);
  const kids = (ctx.childrenOf.get(task.id) ?? []).filter((k) => ctx.visible.has(k.id));
  const doneKids = (ctx.childrenOf.get(task.id) ?? []).filter((k) => k.status === "DONE").length;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => ctx.onOpen(task.id)}
        onKeyDown={(e) => e.key === "Enter" && ctx.onOpen(task.id)}
        className="group flex cursor-pointer items-center gap-3 border-t px-4 py-2.5 transition-colors hover:bg-muted/40"
        style={{ paddingLeft: 16 + depth * 28 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className={cn("rounded p-0.5 text-muted-foreground hover:bg-muted", !kids.length && "invisible")}
          aria-label={open ? "Thu gọn task con" : "Mở rộng task con"}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </button>
        <StatusToggle status={task.status} disabled={!ctx.canReport(task)} onToggle={() => ctx.onToggle(task)} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", task.status === "DONE" && "text-muted-foreground line-through", depth === 0 && "font-medium")}>
            {task.title}
          </p>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground sm:hidden">
            {task.dueDate && <span className={cn(overdue && "text-danger")}>{formatShortDate(task.dueDate)}</span>}
            <span>{task.effectiveProgress}%</span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Task con hoàn thành">
              <GitBranch className="h-3.5 w-3.5" /> {doneKids}/{task.subtaskCount}
            </span>
          )}
          {task._count.reports > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Số báo cáo">
              <FileText className="h-3.5 w-3.5" /> {task._count.reports}
            </span>
          )}
          {task.priority !== "MEDIUM" && <PriorityBadge priority={task.priority} />}
          <span className={cn("flex w-[72px] items-center justify-end gap-1 text-xs tabular-nums", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
            {overdue && <TriangleAlert className="h-3 w-3" />}
            {task.dueDate ? formatShortDate(task.dueDate) : "—"}
          </span>
          <div className="w-24">
            <ProgressBar value={task.effectiveProgress} height={6} showLabel />
          </div>
        </div>
        {task.assignee ? (
          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground" title="Chưa có người phụ trách">
            ?
          </span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && kids.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {kids.map((k) => (
              <TaskRow key={k.id} task={k} depth={depth + 1} ctx={ctx} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QuickAdd({ projectId, categoryId, send }: { projectId: string; categoryId: string | null; send: SendChange }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await send("/api/tasks", { method: "POST", body: { projectId, categoryId, title } });
      setTitle("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể thêm công việc");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-3 border-t px-4 py-2.5 pl-[52px]">
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thêm công việc và nhấn Enter…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </form>
  );
}

function CategoryMenu({ onEdit, onDelete, onAddSub }: { onEdit: () => void; onDelete: () => void; onAddSub?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tuỳ chọn hạng mục">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border bg-card p-1 shadow-pop">
          {onAddSub && (
            <button onClick={() => { setOpen(false); onAddSub(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
              <FolderPlus className="h-3.5 w-3.5" /> Thêm hạng mục con
            </button>
          )}
          <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Sửa hạng mục
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-danger hover:bg-danger/10">
            <Trash2 className="h-3.5 w-3.5" /> Xoá hạng mục
          </button>
        </div>
      )}
    </div>
  );
}

export function TaskList({
  projectId,
  categories,
  tasks,
  filters,
  meId,
  canManage,
  canContribute,
  onOpen,
  send,
  onEditCategory,
  onDeleteCategory,
  onAddSubCategory,
}: {
  projectId: string;
  categories: ProjectCategory[];
  tasks: ProjectTask[];
  filters: TaskFilters;
  meId: string;
  canManage: boolean;
  /** False for view-only members: no quick add, no status changes. */
  canContribute: boolean;
  onOpen: (id: string) => void;
  send: SendChange;
  onEditCategory: (c: ProjectCategory) => void;
  onDeleteCategory: (c: ProjectCategory) => void;
  onAddSubCategory: (parent: ProjectCategory) => void;
}) {
  const { childrenOf, visible } = useTaskTree(tasks, filters, meId);
  const roots = tasks.filter((t) => !t.parentId && visible.has(t.id));

  const ctx: RowCtx = {
    childrenOf,
    visible,
    onOpen,
    canReport: (t) => canManage || (canContribute && (t.assigneeId === meId || t.createdById === meId)),
    onToggle: async (t) => {
      const status = t.status === "DONE" ? "IN_PROGRESS" : "DONE";
      try {
        await send(`/api/tasks/${t.id}`, { method: "PATCH", body: { status } }, { taskId: t.id, fields: { status } });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật");
      }
    },
  };

  const known = new Set(categories.map((c) => c.id));
  const mains = categories.filter((c) => !c.parentId || !known.has(c.parentId));
  const subsOf = (id: string) => categories.filter((c) => c.parentId === id);
  const rootsIn = (id: string) => roots.filter((t) => t.categoryId === id);
  const uncategorized = roots.filter((t) => !t.categoryId || !known.has(t.categoryId));
  const filtering = filters.mine || filters.hideDone;

  if (mains.length === 0 && uncategorized.length === 0) {
    return (
      <div className="rounded-2xl border bg-card shadow-card">
        <EmptyState
          icon={ListChecks}
          title="Chưa có công việc nào"
          description={canContribute ? "Bấm “Thêm công việc” để bắt đầu, hoặc tạo hạng mục để nhóm công việc." : "Công việc của dự án sẽ hiển thị ở đây."}
        />
      </div>
    );
  }

  const menu = (c: ProjectCategory, main: boolean) =>
    canManage && (
      <CategoryMenu onEdit={() => onEditCategory(c)} onDelete={() => onDeleteCategory(c)} onAddSub={main ? () => onAddSubCategory(c) : undefined} />
    );
  const rows = (list: ProjectTask[]) => list.map((t) => <TaskRow key={t.id} task={t} depth={0} ctx={ctx} />);
  const quickAdd = (categoryId: string | null) =>
    canContribute && <QuickAdd projectId={projectId} categoryId={categoryId} send={send} />;

  return (
    <div className="space-y-4">
      {mains.map((c) => {
        const subs = subsOf(c.id);
        const own = rootsIn(c.id);
        return (
          <section key={c.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <CategoryHeader category={c} main menu={menu(c, true)} />
            {rows(own)}
            {own.length === 0 && subs.length === 0 && (
              <p className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
                {filtering ? "Không có công việc phù hợp bộ lọc." : "Chưa có công việc trong hạng mục này."}
              </p>
            )}
            {quickAdd(c.id)}
            {subs.map((sc) => {
              const list = rootsIn(sc.id);
              return (
                <div key={sc.id} className="border-t bg-muted/20">
                  <CategoryHeader category={sc} main={false} menu={menu(sc, false)} />
                  {rows(list)}
                  {list.length === 0 && (
                    <p className="border-t px-4 py-3 pl-10 text-xs text-muted-foreground">
                      {filtering ? "Không có công việc phù hợp bộ lọc." : "Chưa có công việc trong hạng mục con này."}
                    </p>
                  )}
                  {quickAdd(sc.id)}
                </div>
              );
            })}
          </section>
        );
      })}
      {uncategorized.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <header className="flex items-center gap-3 px-4 py-3">
            <span className="h-3 w-3 shrink-0 rounded bg-slate-400" />
            <h3 className="font-semibold">Chưa phân loại</h3>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{uncategorized.length} việc</span>
          </header>
          {rows(uncategorized)}
          {quickAdd(null)}
        </section>
      )}
    </div>
  );
}

/** Category heading: name, deadline, schedule status and progress against plan. */
function CategoryHeader({ category: c, main, menu }: { category: ProjectCategory; main: boolean; menu: React.ReactNode }) {
  const hasDates = !!(c.startDate || c.dueDate);
  return (
    <header className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", !main && "pl-10")}>
      <span className={cn("shrink-0 rounded", main ? "h-3 w-3" : "h-2.5 w-2.5")} style={{ background: c.color }} />
      <h3 className={cn("min-w-0 truncate", main ? "font-semibold" : "text-sm font-medium")}>
        {!main && <span className="mr-1 text-muted-foreground">└</span>}
        {c.name}
      </h3>
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{c.taskCount} việc</span>
      {hasDates ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatShortDate(c.startDate) || "…"} → {formatShortDate(c.dueDate) || "…"}
          {c.dueDate && c.schedule.status !== "DONE" && (
            <span className={cn("font-medium", (c.schedule.daysLeft ?? 0) < 0 ? "text-danger" : "text-foreground")}>· {daysLeftLabel(c.schedule.daysLeft)}</span>
          )}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/80">Chưa đặt thời hạn</span>
      )}
      {c.dueDate && <ScheduleBadge status={c.schedule.status} />}
      <div className="flex-1" />
      <div className="w-full sm:w-48">
        {c.schedule.planned !== null ? (
          <div title={`Thực tế ${c.progress}% · kế hoạch đến hôm nay ${c.schedule.planned}%`}>
            <PlanBar actual={c.progress} planned={c.schedule.planned} height={6} showLabel />
          </div>
        ) : (
          <ProgressBar value={c.progress} height={6} showLabel />
        )}
      </div>
      {menu}
    </header>
  );
}
