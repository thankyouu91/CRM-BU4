"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Meters use one hue: bar length already encodes the value, so coloring by
// value would double-encode it. Pass `color` only for entity identity.

export function ProgressBar({
  value,
  color,
  className,
  height = 8,
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
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", !color && "bg-primary")}
          style={color ? { background: color } : undefined}
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={color ? undefined : "stroke-primary"}
          stroke={color}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label ?? <span className="text-sm font-bold">{v}%</span>}
      </div>
    </div>
  );
}
