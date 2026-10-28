import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "critical";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4 shrink-0", tone === "critical" ? "text-danger" : "text-muted-foreground")} />
      </div>
      <p className={cn("mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums", tone === "critical" && "text-danger")}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
