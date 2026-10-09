"use client";

import { Check, CircleDashed, CircleDot, Eye, OctagonX } from "lucide-react";
import { TASK_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Round status button: click to mark done (or re-open). Icon varies per state, not just color. */
export function StatusToggle({
  status,
  onToggle,
  disabled,
  size = 20,
}: {
  status: string;
  onToggle?: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const s = TASK_STATUS[status as keyof typeof TASK_STATUS];
  const done = status === "DONE";
  const Icon = done ? Check : status === "IN_PROGRESS" ? CircleDot : status === "REVIEW" ? Eye : status === "BLOCKED" ? OctagonX : CircleDashed;
  return (
    <button
      type="button"
      disabled={disabled || !onToggle}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      title={done ? "Mở lại công việc" : `${s?.label ?? status} · bấm để đánh dấu hoàn thành`}
      aria-label={done ? "Mở lại công việc" : "Đánh dấu hoàn thành"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-transform",
        !disabled && onToggle && "hover:scale-110",
        done ? "text-white" : "border-2",
      )}
      style={{
        width: size,
        height: size,
        background: done ? s?.color : undefined,
        borderColor: done ? undefined : s?.color,
        color: done ? undefined : s?.color,
      }}
    >
      <Icon style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={done ? 3 : 2.5} />
    </button>
  );
}
