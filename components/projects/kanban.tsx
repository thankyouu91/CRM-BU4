"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, GitBranch, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ApiError, type SendChange } from "@/lib/client";
import { TASK_STATUS } from "@/lib/constants";
import { isOverdue } from "@/lib/dates";
import { cn, formatShortDate } from "@/lib/utils";
import { useTaskTree, type TaskFilters } from "./task-list";
import type { ProjectCategory, ProjectTask } from "./types";

const COLUMNS = Object.keys(TASK_STATUS) as (keyof typeof TASK_STATUS)[];

export function Kanban({
  tasks: source,
  categories,
  filters,
  meId,
  canManage,
  canContribute,
  onOpen,
  send,
}: {
  tasks: ProjectTask[];
  categories: ProjectCategory[];
  filters: TaskFilters;
  meId: string;
  canManage: boolean;
  canContribute: boolean;
  onOpen: (id: string) => void;
  send: SendChange;
}) {
  // Local copy so a drop moves the card instantly; the change's answer brings the server state.
  const [tasks, setTasks] = useState(source);
  useEffect(() => setTasks(source), [source]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const { visible } = useTaskTree(tasks, { ...filters, hideDone: false }, meId);
  const canMove = (t: ProjectTask) => canManage || (canContribute && (t.assigneeId === meId || t.createdById === meId));
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  const categoryOf = new Map(categories.map((c) => [c.id, c]));

  const drop = async (status: string) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    setOver(null);
    if (!task || task.status === status) return;
    if (!canMove(task)) {
      toast.error("Bạn không có quyền cập nhật công việc này");
      return;
    }
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await send(`/api/tasks/${task.id}`, { method: "PATCH", body: { status } }, { taskId: task.id, fields: { status } });
      toast.success(`Đã chuyển sang “${TASK_STATUS[status as keyof typeof TASK_STATUS].label}”`);
    } catch (e) {
      setTasks(prev);
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    }
  };

  return (
    <div className="scrollbar-thin -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
      {COLUMNS.map((status) => {
        const meta = TASK_STATUS[status];
        const cards = tasks.filter((t) => t.status === status && visible.has(t.id) && (!filters.mine || t.assigneeId === meId));
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={() => drop(status)}
            className={cn(
              "flex w-[290px] shrink-0 flex-col rounded-2xl border bg-muted/40 transition-colors",
              over === status && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
              <h3 className="text-sm font-semibold">{meta.label}</h3>
              <span className="ml-auto rounded-md bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{cards.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 px-3 pb-3">
              {cards.map((t) => {
                const overdue = isOverdue(t.dueDate, t.status);
                const cat = t.categoryId ? categoryOf.get(t.categoryId) : undefined;
                return (
                  <motion.div
                    layout
                    key={t.id}
                    draggable={canMove(t)}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "cursor-pointer rounded-xl border bg-card p-3 shadow-card transition hover:border-primary/40",
                      canMove(t) && "active:cursor-grabbing",
                      dragId === t.id && "opacity-50",
                    )}
                  >
                    {t.parentId && (
                      <p className="mb-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <GitBranch className="h-3 w-3 shrink-0" /> {titleOf.get(t.parentId)}
                      </p>
                    )}
                    <p className="text-sm font-medium leading-snug">{t.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {cat && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      )}
                      {t.priority !== "MEDIUM" && <PriorityBadge priority={t.priority} />}
                    </div>
                    {t.effectiveProgress > 0 && t.status !== "DONE" && <ProgressBar value={t.effectiveProgress} height={5} className="mt-3" showLabel />}
                    <div className="mt-3 flex items-center justify-between">
                      <span className={cn("flex items-center gap-1 text-[11px]", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                        {overdue ? <TriangleAlert className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
                        {t.dueDate ? formatShortDate(t.dueDate) : "Không hạn"}
                      </span>
                      {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size="xs" />}
                    </div>
                  </motion.div>
                );
              })}
              {cards.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed py-6 text-xs text-muted-foreground">
                  Kéo thả công việc vào đây
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
