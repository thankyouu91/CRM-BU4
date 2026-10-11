"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Copy, ExternalLink, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Task { id: string; title: string; status: string }
interface Selection<T> { task: T; x: number; y: number; trigger: HTMLElement }

/** One menu per view; rows only supply a target, avoiding per-row portals/listeners. */
export function useTaskMenu<T extends Task>({ onOpen, onToggle, canToggle }: {
  onOpen: (id: string) => void;
  onToggle?: (task: T) => void;
  canToggle?: (task: T) => boolean;
}) {
  const [selection, setSelection] = useState<Selection<T> | null>(null);
  const close = useCallback(() => setSelection(null), []);
  const open = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, task: T) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = "clientX" in event && (event.clientX !== 0 || event.clientY !== 0);
    setSelection({ task, trigger: event.currentTarget, x: pointer ? event.clientX : rect.left, y: pointer ? event.clientY : rect.bottom });
  };
  return {
    bind: (task: T) => ({
      onContextMenu: (event: MouseEvent<HTMLElement>) => open(event, task),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) open(event, task);
        else if (event.key === "Enter" && event.target === event.currentTarget) onOpen(task.id);
      },
    }),
    button: (task: T) => (
      <button type="button" aria-label={`Tuỳ chọn: ${task.title}`} aria-haspopup="menu" aria-expanded={selection?.task.id === task.id}
        onClick={(event) => open(event, task)} onKeyDown={(event) => event.stopPropagation()}
        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    ),
    menu: selection && (
      <TaskMenu key={selection.task.id} selection={selection} onClose={close} onOpen={onOpen}
        onToggle={onToggle && canToggle?.(selection.task) ? () => onToggle(selection.task) : undefined} />
    ),
  };
}

function TaskMenu({ selection, onClose, onOpen, onToggle }: {
  selection: Selection<Task>; onClose: () => void; onOpen: (id: string) => void; onToggle?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { task, x, y, trigger } = selection;
  useLayoutEffect(() => {
    const menu = ref.current!;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    menu.querySelector<HTMLButtonElement>("button")?.focus();
  }, [x, y]);
  useEffect(() => {
    const dismiss = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const resize = () => onClose();
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", resize);
    };
  }, [onClose]);
  const finish = (action?: () => void) => {
    onClose();
    if (trigger.isConnected) trigger.focus();
    action?.();
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); finish(); return; }
    const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % buttons.length
      : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length
        : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null;
    if (next !== null) { event.preventDefault(); buttons[next].focus(); }
  };
  const style = "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none";
  const StatusIcon = task.status === "DONE" ? RotateCcw : CheckCircle2;
  return createPortal(
    <div ref={ref} role="menu" aria-label={`Thao tác: ${task.title}`} onKeyDown={keyDown} onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[70] w-64 max-w-[calc(100vw-16px)] rounded-xl border bg-card p-1 shadow-pop" style={{ left: x, top: y }}>
      <p className="truncate border-b px-3 py-2 text-xs font-medium text-muted-foreground">{task.title}</p>
      <button role="menuitem" className={style} onClick={() => finish(() => onOpen(task.id))}><ExternalLink className="h-4 w-4" />Mở chi tiết</button>
      {onToggle && <button role="menuitem" className={style} onClick={() => finish(onToggle)}><StatusIcon className="h-4 w-4" />{task.status === "DONE" ? "Mở lại công việc" : "Đánh dấu hoàn thành"}</button>}
      <button role="menuitem" className={style} onClick={() => finish(() => {
        void Promise.resolve().then(() => navigator.clipboard.writeText(task.title))
          .then(() => toast.success("Đã sao chép tên công việc"), () => toast.error("Không thể sao chép. Hãy kiểm tra quyền clipboard."));
      })}><Copy className="h-4 w-4" />Sao chép tên</button>
    </div>, document.body,
  );
}
