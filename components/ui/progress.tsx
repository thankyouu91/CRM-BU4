"use client";

import { cn } from "@/lib/utils";

// Meters use one hue: bar length already encodes the value, so coloring by
// value would double-encode it. Pass `color` only for entity identity.
// They draw at their value (no grow-in on load) and ease only when it changes.

export function ProgressBar({
  value,
  color,
  className,
  height = 6,
  showLabel,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative w-full overflow-hidden rounded-full bg-muted"
        style={{ height }}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", !color && "bg-primary")}
          style={{ width: `${v}%`, background: color }}
        />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">{v}%</span>}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  color,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: React.ReactNode;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${v}% hoàn thành`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("transition-[stroke-dashoffset] duration-300", !color && "stroke-primary")}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label ?? <span className="text-sm font-semibold tabular-nums">{v}%</span>}
      </div>
    </div>
  );
}

/**
 * Actual completion with a tick at the planned completion for today, so a bar
 * that stops short of its tick is behind schedule.
 */
export function PlanBar({
  actual,
  planned,
  height = 6,
  className,
  showLabel,
}: {
  actual: number;
  planned: number | null;
  height?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const a = Math.max(0, Math.min(100, Math.round(actual)));
  const p = planned === null ? null : Math.max(0, Math.min(100, Math.round(planned)));
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative w-full" style={{ height }}>
        <div
          className="absolute inset-0 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={a}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={p === null ? `Hoàn thành ${a}%` : `Hoàn thành ${a}%, kế hoạch ${p}%`}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300" style={{ width: `${a}%` }} />
        </div>
        {p !== null && (
          <span
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-card"
            style={{ left: `${p}%` }}
            title={`Kế hoạch đến hôm nay: ${p}%`}
          />
        )}
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">{a}%</span>}
    </div>
  );
}
