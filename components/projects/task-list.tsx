"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FileText, GitBranch, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { api, ApiError } from "@/lib/client";
import { isOverdue } from "@/lib/dates";
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

function QuickAdd({ projectId, categoryId, onAdded }: { projectId: string; categoryId: string | null; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api("/api/tasks", { method: "POST", body: { projectId, categoryId, title } });
      setTitle("");
      onAdded();
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

function CategoryMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tuỳ chọn hạng mục">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border bg-card p-1 shadow-pop">
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
  onReload,
  onEditCategory,
  onDeleteCategory,
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
  onReload: () => void;
  onEditCategory: (c: ProjectCategory) => void;
  onDeleteCategory: (c: ProjectCategory) => void;
}) {
  const { childrenOf, visible } = useTaskTree(tasks, filters, meId);
  const roots = tasks.filter((t) => !t.parentId && visible.has(t.id));

  const ctx: RowCtx = {
    childrenOf,
    visible,
    onOpen,
    canReport: (t) => canManage || (canContribute && (t.assigneeId === meId || t.createdById === meId)),
    onToggle: async (t) => {
      try {
        await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { status: t.status === "DONE" ? "IN_PROGRESS" : "DONE" } });
        onReload();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật");
      }
    },
  };

  const groups: { category: ProjectCategory | null; tasks: ProjectTask[] }[] = [
    ...categories.map((c) => ({ category: c, tasks: roots.filter((t) => t.categoryId === c.id) })),
    { category: null, tasks: roots.filter((t) => !t.categoryId || !categories.some((c) => c.id === t.categoryId)) },
  ];

  const shown = groups.filter((g) => g.category || g.tasks.length > 0);
  if (shown.length === 0) {
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

  return (
    <div className="space-y-4">
      {shown.map((g) => (
          <section key={g.category?.id ?? "none"} className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <header className="flex items-center gap-3 px-4 py-3">
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: g.category?.color ?? "#94a3b8" }} />
              <h3 className="font-semibold">{g.category?.name ?? "Chưa phân loại"}</h3>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {g.category?.taskCount ?? g.tasks.length} việc
              </span>
              <div className="flex-1" />
              {g.category && (
                <div className="hidden w-40 sm:block">
                  <ProgressBar value={g.category.progress} height={6} showLabel />
                </div>
              )}
              {g.category && canManage && (
                <CategoryMenu onEdit={() => onEditCategory(g.category!)} onDelete={() => onDeleteCategory(g.category!)} />
              )}
            </header>
            {g.tasks.map((t) => (
              <TaskRow key={t.id} task={t} depth={0} ctx={ctx} />
            ))}
            {g.tasks.length === 0 && (
              <p className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
                {filters.mine || filters.hideDone ? "Không có công việc phù hợp bộ lọc." : "Chưa có công việc trong hạng mục này."}
              </p>
            )}
            {canContribute && <QuickAdd projectId={projectId} categoryId={g.category?.id ?? null} onAdded={onReload} />}
          </section>
        ))}
    </div>
  );
}
