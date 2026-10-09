"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  GitBranch,
  Loader2,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm";
import { StatusToggle } from "./status-toggle";
import { categoryOptions, projectPeople, type TaskDetail, type TaskPermissions, type TaskReportItem } from "./types";
import { api, ApiError, sendPlain, type SendChange } from "@/lib/client";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { fromInputDate, isOverdue, toInputDate } from "@/lib/dates";
import { cn, formatShortDate, formatDateTime, timeAgo } from "@/lib/utils";

interface Props {
  taskId: string | null;
  onClose: () => void;
  /** Called after any successful mutation so the parent view can refresh. */
  onChanged?: () => void;
  /** Sends changes; a screen that refreshes itself from the answer (the project workspace) passes its own. */
  send?: SendChange;
}

export function TaskDrawer({ taskId, onClose, onChanged, send }: Props) {
  // Internal navigation lets the drawer walk into subtasks and back up to parents.
  const [currentId, setCurrentId] = useState<string | null>(taskId);
  useEffect(() => setCurrentId(taskId), [taskId]);

  return (
    <Drawer open={!!taskId} onClose={onClose}>
      {currentId && (
        <TaskPanel key={currentId} id={currentId} onNavigate={setCurrentId} onClose={onClose} onChanged={onChanged} send={send ?? sendPlain} />
      )}
    </Drawer>
  );
}

function TaskPanel({
  id,
  onNavigate,
  onClose,
  onChanged,
  send,
}: {
  id: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onChanged?: () => void;
  send: SendChange;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [perms, setPerms] = useState<TaskPermissions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    try {
      const res = await api<{ task: TaskDetail; permissions: TaskPermissions }>(`/api/tasks/${id}`);
      setTask(res.task);
      setPerms(res.permissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được công việc");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = async (fields: Record<string, unknown>) => {
    if (!task) return;
    const prev = task;
    setTask({ ...task, ...fields } as TaskDetail); // optimistic
    try {
      const res = await send<{ task: Partial<TaskDetail> }>(`/api/tasks/${id}`, { method: "PATCH", body: fields }, { taskId: id, fields });
      // Plain fields come back with the answer; a new assignee or category needs the full task again.
      if ("assigneeId" in fields || "categoryId" in fields) await load();
      else setTask((t) => (t ? { ...t, ...res.task } : t));
      onChanged?.();
    } catch (e) {
      setTask(prev);
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    }
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert className="h-8 w-8 text-danger" />
        <p className="text-sm">{error}</p>
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </div>
    );
  }
  if (!task || !perms) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const people = projectPeople(task.project);
  const hasSubtasks = task.subtasks.length > 0;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <>
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <nav className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            {task.parent && (
              <button
                onClick={() => onNavigate(task.parent!.id)}
                className="mr-1 rounded p-0.5 hover:bg-muted hover:text-foreground"
                aria-label="Về công việc cha"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: task.project.color }} />
              {task.project.name}
            </span>
            {task.category && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {task.category.parent ? `${task.category.parent.name} › ` : ""}
                  {task.category.name}
                </span>
              </>
            )}
            {task.parent && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <button onClick={() => onNavigate(task.parent!.id)} className="truncate hover:text-foreground hover:underline">
                  {task.parent.title}
                </button>
              </>
            )}
          </nav>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <div className="pt-1.5">
            <StatusToggle
              status={task.status}
              size={22}
              disabled={!perms.report}
              onToggle={() => patch({ status: task.status === "DONE" ? "IN_PROGRESS" : "DONE" })}
            />
          </div>
          <EditableTitle value={task.title} editable={perms.manage} onSave={(title) => patch({ title })} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-[34px]">
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {overdue && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
              <TriangleAlert className="h-3.5 w-3.5" /> Quá hạn
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="scrollbar-thin flex-1 space-y-7 overflow-y-auto px-6 py-5">
        {/* Properties */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Trạng thái">
            <Select value={task.status} disabled={!perms.report} onChange={(e) => patch({ status: e.target.value })}>
              {Object.entries(TASK_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mức ưu tiên">
            <Select value={task.priority} disabled={!perms.manage} onChange={(e) => patch({ priority: e.target.value })}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Người phụ trách (PIC)">
            <Select
              value={task.assigneeId ?? ""}
              disabled={!perms.manage}
              onChange={(e) => patch({ assigneeId: e.target.value || null })}
            >
              <option value="">— Chưa giao —</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hạng mục">
            <Select
              value={task.categoryId ?? ""}
              disabled={!perms.manage}
              onChange={(e) => patch({ categoryId: e.target.value || null })}
            >
              <option value="">— Chưa phân loại —</option>
              {categoryOptions(task.project.categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày bắt đầu">
            <Input
              type="date"
              value={toInputDate(task.startDate)}
              disabled={!perms.manage}
              onChange={(e) => patch({ startDate: fromInputDate(e.target.value, "start") })}
            />
          </Field>
          <Field label="Hạn chót">
            <Input
              type="date"
              value={toInputDate(task.dueDate)}
              disabled={!perms.manage}
              onChange={(e) => patch({ dueDate: fromInputDate(e.target.value, "end") })}
              className={cn(overdue && "border-danger/50 text-danger")}
            />
          </Field>
        </section>

        <ProgressField task={task} disabled={!perms.report || hasSubtasks} onCommit={(progress) => patch({ progress })} />

        <DescriptionField value={task.description} editable={perms.report} onSave={(description) => patch({ description })} />

        <Subtasks task={task} people={people} send={send} onNavigate={onNavigate} onChanged={async () => { await load(); onChanged?.(); }} />

        <Reports task={task} perms={perms} send={send} onChanged={async () => { await load(); onChanged?.(); }} />

        <p className="border-t pt-4 text-xs text-muted-foreground">
          Tạo bởi {task.createdBy.name} · {formatDateTime(task.createdAt)}
          {task.completedAt && <> · Hoàn thành {formatDateTime(task.completedAt)}</>}
        </p>
      </div>

      {perms.manage && (
        <div className="flex justify-between border-t px-6 py-3">
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Xoá công việc
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xoá công việc?"
        danger
        confirmLabel="Xoá"
        message={
          <>
            Công việc <b className="text-foreground">{task.title}</b>
            {hasSubtasks && <> cùng {task.subtasks.length} task con</>} và toàn bộ báo cáo sẽ bị xoá vĩnh viễn.
          </>
        }
        onConfirm={async () => {
          try {
            await send(`/api/tasks/${task.id}`, { method: "DELETE" });
            toast.success("Đã xoá công việc");
            onChanged?.();
            if (task.parent) onNavigate(task.parent.id);
            else onClose();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Không thể xoá");
          }
        }}
      />
    </>
  );
}

function EditableTitle({ value, editable, onSave }: { value: string; editable: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editable) return <h2 className="text-lg font-semibold leading-snug">{value}</h2>;
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };
  return (
    <textarea
      value={draft}
      rows={1}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="w-full resize-none rounded-md bg-transparent text-lg font-semibold leading-snug outline-none ring-primary/20 focus:bg-muted/50 focus:ring-2"
      aria-label="Tiêu đề công việc"
    />
  );
}

function ProgressField({
  task,
  disabled,
  onCommit,
}: {
  task: TaskDetail;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const computed = useMemo(() => {
    if (!task.subtasks.length) return null;
    const sum = task.subtasks.reduce((a, s) => a + (s.status === "DONE" ? 100 : s.progress), 0);
    return Math.round(sum / task.subtasks.length);
  }, [task.subtasks]);
  const shown = task.status === "DONE" ? 100 : (computed ?? task.progress);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-foreground/80">Tiến độ</h3>
        <span className="text-sm font-bold">{draft}%</span>
      </div>
      {disabled ? (
        <>
          <ProgressBar value={shown} />
          {computed !== null && (
            <p className="mt-1.5 text-xs text-muted-foreground">Tính tự động từ {task.subtasks.length} task con.</p>
          )}
        </>
      ) : (
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={() => draft !== shown && onCommit(draft)}
          onKeyUp={() => draft !== shown && onCommit(draft)}
          className="w-full accent-[rgb(var(--primary))]"
          aria-label="Tiến độ (%)"
        />
      )}
    </section>
  );
}

function DescriptionField({
  value,
  editable,
  onSave,
}: {
  value: string | null;
  editable: boolean;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium text-foreground/80">Mô tả</h3>
      {editable ? (
        <Textarea
          value={draft}
          placeholder="Thêm mô tả, yêu cầu hoặc tiêu chí hoàn thành…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== (value ?? "") && onSave(draft.trim() || null)}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value || "Không có mô tả."}</p>
      )}
    </section>
  );
}

function Subtasks({
  task,
  people,
  send,
  onNavigate,
  onChanged,
}: {
  task: TaskDetail;
  people: ReturnType<typeof projectPeople>;
  send: SendChange;
  onNavigate: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [busy, setBusy] = useState(false);
  const done = task.subtasks.filter((s) => s.status === "DONE").length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await send("/api/tasks", {
        method: "POST",
        body: { projectId: task.projectId, parentId: task.id, title, assigneeId: assigneeId || null },
      });
      setTitle("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể thêm task con");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, status: string) => {
    const next = status === "DONE" ? "IN_PROGRESS" : "DONE";
    try {
      await send(`/api/tasks/${id}`, { method: "PATCH", body: { status: next } }, { taskId: id, fields: { status: next } });
      await onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật");
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
          <GitBranch className="h-3.5 w-3.5" /> Task con
        </h3>
        {task.subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{task.subtasks.length} hoàn thành
          </span>
        )}
      </div>
      <ul className="divide-y rounded-xl border">
        {task.subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
            <StatusToggle status={s.status} size={18} onToggle={() => toggle(s.id, s.status)} />
            <button
              onClick={() => onNavigate(s.id)}
              className={cn("min-w-0 flex-1 truncate text-left text-sm hover:text-primary", s.status === "DONE" && "text-muted-foreground line-through")}
            >
              {s.title}
            </button>
            {s._count.subtasks > 0 && <span className="text-[11px] text-muted-foreground">{s._count.subtasks} con</span>}
            {s.dueDate && (
              <span className={cn("text-[11px]", isOverdue(s.dueDate, s.status) ? "text-danger" : "text-muted-foreground")}>
                {formatShortDate(s.dueDate)}
              </span>
            )}
            {s.assignee ? <Avatar name={s.assignee.name} color={s.assignee.avatarColor} size="xs" /> : <span className="h-6 w-6" />}
          </li>
        ))}
        <li className="px-3 py-2">
          <form onSubmit={add} className="flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thêm task con và nhấn Enter…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="max-w-[140px] rounded-md border bg-card px-2 py-1 text-xs"
              aria-label="Người phụ trách task con"
            >
              <option value="">Chưa giao</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </form>
        </li>
      </ul>
    </section>
  );
}

function Reports({
  task,
  perms,
  send,
  onChanged,
}: {
  task: TaskDetail;
  perms: TaskPermissions;
  send: SendChange;
  onChanged: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [progress, setProgress] = useState(task.status === "DONE" ? 100 : task.progress);
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const totalHours = task.reports.reduce((a, r) => a + r.hoursSpent, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    try {
      await send(`/api/tasks/${task.id}/reports`, {
        method: "POST",
        body: { content, progress, hoursSpent: Number(hours) || 0 },
      });
      toast.success(progress >= 100 ? "Đã gửi báo cáo — công việc chuyển sang Chờ duyệt" : "Đã gửi báo cáo cho quản lý");
      setContent("");
      setHours("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể gửi báo cáo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-foreground/80">Báo cáo tiến độ</h3>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {Math.round(totalHours * 10) / 10} giờ đã ghi
        </span>
      </div>

      {perms.report && (
        <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl border bg-muted/30 p-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Đã làm được gì, vướng mắc gì, bước tiếp theo…"
            className="min-h-[72px] bg-card"
            required
          />
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px] flex-1">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Tiến độ sau báo cáo</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-[rgb(var(--primary))]"
                aria-label="Tiến độ sau báo cáo"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`hours-${task.id}`}>
                Giờ làm
              </label>
              <Input
                id={`hours-${task.id}`}
                type="number"
                min={0}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="h-9 bg-card"
              />
            </div>
            <Button type="submit" size="sm" loading={busy} className="h-9">
              <Send className="h-3.5 w-3.5" /> Gửi quản lý
            </Button>
          </div>
        </form>
      )}

      {task.reports.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Chưa có báo cáo nào.</p>
      ) : (
        <ol className="relative space-y-5 border-l pl-6">
          <AnimatePresence initial={false}>
            {task.reports.map((r) => (
              <ReportItem key={r.id} report={r} canReview={perms.isProjectManager} taskDone={task.status === "DONE"} send={send} onChanged={onChanged} />
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

function ReportItem({
  report: r,
  canReview,
  taskDone,
  send,
  onChanged,
}: {
  report: TaskReportItem;
  canReview: boolean;
  taskDone: boolean;
  send: SendChange;
  onChanged: () => Promise<void>;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const review = async (approveTask: boolean) => {
    setBusy(true);
    try {
      await send(`/api/reports/${r.id}`, { method: "PATCH", body: { reviewNote: note || null, approveTask } });
      toast.success(approveTask ? "Đã duyệt hoàn thành công việc" : "Đã đánh dấu đã xem");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative">
      <span className="absolute -left-[37px] top-0">
        <Avatar name={r.author.name} color={r.author.avatarColor} size="xs" />
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold">{r.author.name}</span>
        <span className="text-muted-foreground" title={formatDateTime(r.createdAt)}>
          {timeAgo(r.createdAt)}
        </span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{r.progress}%</span>
        {r.hoursSpent > 0 && <span className="text-muted-foreground">{r.hoursSpent} giờ</span>}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm">{r.content}</p>

      {r.reviewedAt ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs text-success">
          <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            {r.reviewer?.name ?? "Quản lý"} đã xem · {timeAgo(r.reviewedAt)}
            {r.reviewNote && <span className="text-foreground/80"> — “{r.reviewNote}”</span>}
          </span>
        </div>
      ) : canReview ? (
        <div className="mt-2 space-y-2">
          {noteOpen && (
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhận xét cho người thực hiện (tuỳ chọn)" className="h-9" />
          )}
          <div className="flex flex-wrap gap-2">
            {!noteOpen && (
              <Button size="sm" variant="ghost" onClick={() => setNoteOpen(true)}>
                Thêm nhận xét
              </Button>
            )}
            <Button size="sm" variant="outline" loading={busy} onClick={() => review(false)}>
              <Eye className="h-3.5 w-3.5" /> Đã xem
            </Button>
            {!taskDone && r.progress >= 100 && (
              <Button size="sm" loading={busy} onClick={() => review(true)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt hoàn thành
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <CalendarDays className="h-3.5 w-3.5" /> Chờ quản lý xem xét
        </p>
      )}
    </motion.li>
  );
}
