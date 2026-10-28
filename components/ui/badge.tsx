import { PRIORITY, PROJECT_STATUS, TASK_STATUS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SCHEDULE_STATUS, type ScheduleStatus } from "@/lib/schedule";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

// A status reads from its dot; the label stays neutral, so a list of rows is not a wall of colors.
const STATUS_CHIP = "border bg-card text-foreground/80";

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = TASK_STATUS[status as keyof typeof TASK_STATUS];
  if (!s) return null;
  return (
    <Badge className={cn(STATUS_CHIP, className)}>
      <Dot color={s.color} />
      {s.label}
    </Badge>
  );
}

export function ProjectStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = PROJECT_STATUS[status as keyof typeof PROJECT_STATUS];
  if (!s) return null;
  return (
    <Badge className={cn(STATUS_CHIP, className)}>
      <Dot color={s.color} />
      {s.label}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const p = PRIORITY[priority as keyof typeof PRIORITY];
  if (!p) return null;
  return <Badge className={cn(p.bg, className)}>{p.label}</Badge>;
}

/** Roles are not a status: one neutral style, the label tells them apart. */
export function RoleBadge({ role }: { role: string }) {
  return <Badge className="bg-muted text-foreground/80">{ROLE_LABELS[role] ?? role}</Badge>;
}

export function ScheduleBadge({ status, className }: { status: string; className?: string }) {
  const s = SCHEDULE_STATUS[status as ScheduleStatus];
  if (!s) return null;
  return (
    <Badge className={cn(STATUS_CHIP, className)}>
      <Dot color={s.color} />
      {s.label}
    </Badge>
  );
}
