"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { calendarMonth, shiftMonth } from "@/lib/task-calendar";
import { zonedDay } from "@/lib/work-report";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const show = (day: string) => (day ? `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "…");

/** "YYYY-MM-DD" moved by whole days (calendar arithmetic, no time zone). */
export function addDaysTo(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Quick ranges, ending today in Vietnam time. */
export function rangePresets(today: string): { label: string; from: string; to: string }[] {
  return [
    { label: "7 ngày qua", from: addDaysTo(today, -6), to: today },
    { label: "30 ngày qua", from: addDaysTo(today, -29), to: today },
    { label: "Tháng này", from: `${today.slice(0, 7)}-01`, to: today },
    { label: "Tháng trước", from: `${shiftMonth(today.slice(0, 7), -1)}-01`, to: addDaysTo(`${today.slice(0, 7)}-01`, -1) },
    { label: "Từ đầu năm", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

/**
 * One calendar for a date range: the first click picks the start, the second the end
 * (in either order), with the range previewed under the pointer. Quick ranges and typed
 * dates are in the same panel. Values are "YYYY-MM-DD".
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  label = "Khoảng ngày",
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (from || zonedDay(new Date())).slice(0, 7));
  // First end picked, waiting for the second click.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // Open towards the left when there is no room on the right.
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = zonedDay(new Date());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setMonth((from || today).slice(0, 7));
      setAnchor(null);
      const left = ref.current?.getBoundingClientRect().left ?? 0;
      setAlignRight(left + (window.innerWidth >= 640 ? 480 : 304) > window.innerWidth - 16);
    }
    setOpen((o) => !o);
  };
  const pick = (day: string) => {
    if (!anchor) {
      setAnchor(day);
      return;
    }
    const [a, b] = anchor <= day ? [anchor, day] : [day, anchor];
    setAnchor(null);
    onChange({ from: a, to: b });
    setOpen(false);
  };

  // While picking, the range runs from the first click to the day under the pointer.
  const [lo, hi] = anchor ? [anchor, hover ?? anchor].sort() : [from, to];
  const grid = calendarMonth([], month, new Date());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}: ${show(from)} đến ${show(to)}`}
        className="flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden />
        {show(from)} <span className="text-muted-foreground">→</span> {show(to)}
      </button>

      {open && (
        <div role="dialog" aria-label="Chọn khoảng ngày" className={cn("absolute top-full z-40 mt-2 w-[19rem] rounded-xl border bg-card p-3 shadow-pop sm:w-[30rem]", alignRight ? "right-0" : "left-0")}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-wrap gap-1.5 sm:w-28 sm:flex-col">
              {rangePresets(today).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    onChange({ from: p.from, to: p.to });
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted",
                    p.from === from && p.to === to ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước" className="rounded-lg p-1 hover:bg-muted">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold" aria-live="polite">
                  Tháng {Number(month.slice(5))}/{month.slice(0, 4)}
                </span>
                <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau" className="rounded-lg p-1 hover:bg-muted">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="pb-1">{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHover(null)}>
                {grid.flat().map((d) => {
                  const inRange = !!lo && !!hi && d.day >= lo && d.day <= hi;
                  const edge = d.day === lo || d.day === hi;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => pick(d.day)}
                      onMouseEnter={() => setHover(d.day)}
                      onFocus={() => setHover(d.day)}
                      aria-pressed={inRange}
                      aria-label={`${show(d.day)}${d.today ? " (hôm nay)" : ""}`}
                      className={cn(
                        "h-8 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        !d.inMonth && "text-muted-foreground/40",
                        inRange && !edge && "bg-primary/15",
                        edge && "rounded-md bg-primary font-semibold text-primary-foreground",
                        !inRange && "rounded-md hover:bg-muted",
                        d.today && !edge && "font-bold text-primary",
                      )}
                    >
                      {Number(d.day.slice(8))}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{anchor ? "Chọn ngày kết thúc" : "Bấm ngày bắt đầu rồi ngày kết thúc"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <DateInput size="sm" value={from} onChange={(v) => onChange({ from: v, to })} aria-label="Từ ngày" />
            <span className="text-muted-foreground">→</span>
            <DateInput size="sm" value={to} onChange={(v) => onChange({ from, to: v })} aria-label="Đến ngày" />
          </div>
        </div>
      )}
    </div>
  );
}

