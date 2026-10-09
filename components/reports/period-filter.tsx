"use client";

import { addDays, addMonths, addYears } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Segmented } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export type ReportPeriod = "day" | "month" | "quarter" | "year" | "custom";

export interface PeriodState {
  type: ReportPeriod;
  /** Anchor instant inside the period (kept at mid-period/noon to avoid boundary drift). */
  anchor: string;
  from: string; // yyyy-mm-dd, custom only
  to: string;
}

export function defaultPeriod(type: ReportPeriod = "month"): PeriodState {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return { type, anchor: now.toISOString(), from: "", to: "" };
}

export function shiftPeriod(p: PeriodState, step: number): PeriodState {
  const a = new Date(p.anchor);
  let next: Date;
  if (p.type === "day") next = addDays(a, step);
  else if (p.type === "year") next = addYears(a, step);
  else {
    a.setDate(15); // mid-month so month arithmetic never skips a short month
    next = addMonths(a, p.type === "quarter" ? step * 3 : step);
  }
  return { ...p, anchor: next.toISOString() };
}

/** Query string understood by /api/reports/summary (and /present, /ai). */
export function periodQuery(p: PeriodState, projectId?: string): string {
  const sp = new URLSearchParams({ period: p.type, date: p.anchor });
  if (p.type === "custom") {
    if (p.from) sp.set("from", p.from);
    if (p.to) sp.set("to", p.to);
  }
  if (projectId) sp.set("projectId", projectId);
  return sp.toString();
}

export function PeriodFilter({
  value,
  onChange,
  label,
  className,
}: {
  value: PeriodState;
  onChange: (p: PeriodState) => void;
  label: string;
  className?: string;
}) {
  const isCurrent = (() => {
    if (value.type === "custom") return true;
    const a = new Date(value.anchor);
    const n = new Date();
    if (value.type === "day") return a.toDateString() === n.toDateString();
    if (value.type === "month") return a.getMonth() === n.getMonth() && a.getFullYear() === n.getFullYear();
    if (value.type === "quarter") return Math.floor(a.getMonth() / 3) === Math.floor(n.getMonth() / 3) && a.getFullYear() === n.getFullYear();
    return a.getFullYear() === n.getFullYear();
  })();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Segmented
        layoutId="report-period"
        value={value.type}
        onChange={(type) => onChange({ ...defaultPeriod(type), from: value.from, to: value.to })}
        options={[
          { value: "day", label: "Ngày" },
          { value: "month", label: "Tháng" },
          { value: "quarter", label: "Quý" },
          { value: "year", label: "Năm" },
          { value: "custom", label: "Tuỳ chọn" },
        ]}
      />
      {value.type === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="h-9 rounded-lg border bg-card px-2 text-sm"
            aria-label="Từ ngày"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="h-9 rounded-lg border bg-card px-2 text-sm"
            aria-label="Đến ngày"
          />
        </div>
      ) : (
        <div className="flex items-center rounded-lg border bg-card">
          <button onClick={() => onChange(shiftPeriod(value, -1))} className="rounded-l-lg p-2 hover:bg-muted" aria-label="Kỳ trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[132px] px-2 text-center text-sm font-semibold">{label}</span>
          <button onClick={() => onChange(shiftPeriod(value, 1))} className="rounded-r-lg p-2 hover:bg-muted" aria-label="Kỳ sau">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {!isCurrent && (
        <button onClick={() => onChange(defaultPeriod(value.type))} className="text-xs font-medium text-primary hover:underline">
          Về kỳ hiện tại
        </button>
      )}
    </div>
  );
}
