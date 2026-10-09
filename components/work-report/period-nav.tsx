"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Segmented } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { sectionTitles, shiftWorkPeriod, workPeriodFromKey, workPeriodOf, type WorkPeriodType } from "@/lib/work-report";

export interface PeriodRef {
  type: WorkPeriodType;
  key: string;
}

/** Keep `period`/`key` in the address bar without a server round trip (router.replace would render the page again). */
export function replacePeriodInUrl(p: PeriodRef) {
  const sp = new URLSearchParams(window.location.search);
  sp.set("period", p.type.toLowerCase());
  sp.set("key", p.key);
  window.history.replaceState(null, "", `?${sp.toString()}`);
}

/** Week / month switch with previous / next navigation. */
export function WorkPeriodNav({
  value,
  onChange,
  label,
  className,
}: {
  value: PeriodRef;
  onChange: (p: PeriodRef) => void;
  /** The server's label for the period, when loaded. */
  label?: string;
  className?: string;
}) {
  const period = workPeriodFromKey(value.type, value.key) ?? workPeriodOf(value.type);
  const today = workPeriodOf(value.type);
  const unit = sectionTitles(value.type).unit;
  const go = (step: number) => {
    const p = shiftWorkPeriod(period, step);
    onChange({ type: p.type, key: p.key });
  };
  const switchType = (type: WorkPeriodType) => {
    if (type === value.type) return;
    // Stay around the same dates: today when looking at the current period.
    const anchor = period.key === today.key ? new Date() : new Date(period.start.getTime() + 3 * 86_400_000);
    onChange({ type, key: workPeriodOf(type, anchor).key });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Segmented
        layoutId="work-period-type"
        value={value.type}
        onChange={switchType}
        options={[
          { value: "WEEK", label: "Tuần" },
          { value: "MONTH", label: "Tháng" },
        ]}
      />
      <div className="flex items-center rounded-lg border bg-card">
        <button onClick={() => go(-1)} className="rounded-l-lg p-2 hover:bg-muted" aria-label={`${unit} trước`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[13rem] px-2 text-center text-sm font-semibold tabular-nums">{label ?? period.label}</span>
        <button onClick={() => go(1)} className="rounded-r-lg p-2 hover:bg-muted" aria-label={`${unit} sau`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {period.key !== today.key && (
        <button onClick={() => onChange({ type: value.type, key: today.key })} className="text-xs font-medium text-primary hover:underline">
          Về {unit} hiện tại
        </button>
      )}
    </div>
  );
}
