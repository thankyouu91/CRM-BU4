import { PRIORITY, PROJECT_STATUS, TASK_STATUS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SCHEDULE_STATUS, type ScheduleStatus } from "@/lib/schedule";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = TASK_STATUS[status as keyof typeof TASK_STATUS];
  if (!s) return null;
  return (
    <Badge className={cn(s.bg, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Badge>
  );
}

export function ProjectStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = PROJECT_STATUS[status as keyof typeof PROJECT_STATUS];
  if (!s) return null;
  return <Badge className={cn(s.bg, className)}>{s.label}</Badge>;
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const p = PRIORITY[priority as keyof typeof PRIORITY];
  if (!p) return null;
  return <Badge className={cn(p.bg, className)}>{p.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const cls =
    role === "ADMIN"
      ? "bg-primary/10 text-primary"
      : role === "MANAGER"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : role === "LEAD"
          ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          : "bg-muted text-muted-foreground";
  return <Badge className={cls}>{ROLE_LABELS[role] ?? role}</Badge>;
}

export function ScheduleBadge({ status, className }: { status: string; className?: string }) {
  const s = SCHEDULE_STATUS[status as ScheduleStatus];
  if (!s) return null;
  return (
    <Badge className={cn(s.bg, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Badge>
  );
}
