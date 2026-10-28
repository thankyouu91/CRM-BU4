"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { useApi } from "@/lib/client";
import { calendarMonth, monthOf, shiftMonth, type CalendarDay, type CalendarResponse } from "@/lib/task-calendar";
import { cn } from "@/lib/utils";


// Glowing dots: the glow is a coloured shadow, so it reads on the light and the dark theme.
const KINDS = [
  { key: "done", label: "Hoàn thành", color: "#22e07a" },
  { key: "due", label: "Deadline", color: "#ff3b5c" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 4px 1px ${color}, 0 0 10px 2px ${color}66` }}
    />
  );
}

/** What a day holds, for the popover and for screen readers. */
function daySummary(d: CalendarDay): string {
  return KINDS.map((k) => (d[k.key].length ? `${d[k.key].length} ${k.label.toLowerCase()}` : "")).filter(Boolean).join(", ");
}

function DayPopover({ d, onOpenTask, alignRight, above }: { d: CalendarDay; onOpenTask: (id: string) => void; alignRight: boolean; above: boolean }) {
  const [, m, day] = d.day.split("-");
  return (
    // The padding bridges the gap to the cell, so the pointer can move into the list.
    <div
      className={cn(
        "invisible absolute z-30 w-72 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
        above ? "bottom-full pb-1.5" : "top-full pt-1.5",
        alignRight ? "right-0" : "left-0",
      )}
    >
      <div className="max-h-80 overflow-y-auto rounded-xl border bg-card p-3 text-left shadow-pop">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Ngày {day}/{m}</p>
        <div className="space-y-3">
          {KINDS.map((k) =>
            d[k.key].length ? (
              <div key={k.key}>
                <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
                  <Dot color={k.color} size={6} /> {k.label} <span className="text-muted-foreground">{d[k.key].length}</span>
                </p>
                <ul className="space-y-1.5">
                  {d[k.key].map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(t.id)}
                        className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.project.color }} />
                          <span className="truncate">{t.project.name}</span>
                        </span>
                        <span className="mt-1 block">
                          <ProgressBar value={t.status === "DONE" ? 100 : t.progress} height={5} showLabel />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Month calendar of one's tasks: a green dot on the day a task was finished, a red one
 * on a deadline. Pointing at (or tabbing to) a day
 * lists its tasks with project and progress; choosing one opens it.
 */
export function TaskCalendar({
  scope,
  projectId,
  refreshKey,
  initial,
  onOpenTask,
}: {
  scope: "mine" | "all";
  projectId?: string;
  refreshKey?: unknown;
  /** The month the server rendered with the page: shown at once instead of a second request. */
  initial?: CalendarResponse;
  onOpenTask: (id: string) => void;
}) {
  const [month, setMonth] = useState<string | null>(null);
  const shown = month ?? monthOf(new Date());
  const url = `/api/tasks/calendar?month=${shown}&scope=${scope}${projectId ? `&projectId=${projectId}` : ""}${refreshKey ? `&v=${String(refreshKey)}` : ""}`;
  const { data, loading, error, reload } = useApi<CalendarResponse>(url, { initial: initial?.month === shown ? initial : undefined });
  const current = data?.month === shown ? data : null;
  const grid = useMemo(() => calendarMonth(current?.tasks ?? [], shown, new Date(current?.asOf ?? Date.now())), [current, shown]);
  const [y, m] = shown.split("-");
  const thisMonth = monthOf(new Date());

  return (
    <section aria-label="Lịch công việc" className="mb-5 rounded-2xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold" aria-live="polite">Tháng {Number(m)}/{y}</h2>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Đang tải" />}
        <div className="ml-auto flex items-center gap-1">
          {shown !== thisMonth && (
            <button type="button" onClick={() => setMonth(null)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10">
              Tháng này
            </button>
          )}
          <button type="button" onClick={() => setMonth(shiftMonth(shown, -1))} aria-label="Tháng trước" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setMonth(shiftMonth(shown, 1))} aria-label="Tháng sau" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={`Công việc tháng ${Number(m)}/${y}`} className={cn("transition-opacity", loading && !current && "opacity-60")}>
        <div role="row" className="grid grid-cols-7 gap-1 pb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} role="columnheader" className="text-center text-[11px] font-semibold uppercase text-muted-foreground">
              {w}
            </div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={week[0].day} role="row" className="grid grid-cols-7 gap-1">
            {week.map((d, di) => {
              const kinds = KINDS.filter((k) => d[k.key as Kind].length);
              const summary = daySummary(d);
              const dayNumber = Number(d.day.slice(8));
              return (
                <div key={d.day} role="gridcell" className="group relative">
                  <button
                    type="button"
                    aria-label={`Ngày ${dayNumber}/${Number(d.day.slice(5, 7))}${summary ? `: ${summary}` : ": không có công việc"}`}
                    className={cn(
                      "flex h-12 w-full flex-col items-center justify-center gap-1.5 rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14",
                      d.inMonth ? "text-foreground" : "text-muted-foreground/40",
                      kinds.length ? "hover:bg-muted" : "cursor-default",
                      d.today && "bg-primary/10 font-bold text-primary",
                    )}
                  >
                    <span>{dayNumber}</span>
                    <span className="flex h-2 items-center gap-1">
                      {kinds.map((k) => (
                        <Dot key={k.key} color={k.color} size={d.inMonth ? 7 : 5} />
                      ))}
                    </span>
                  </button>
                  {kinds.length > 0 && <DayPopover d={d} onOpenTask={onOpenTask} alignRight={di >= 4} above={wi >= grid.length - 2 && grid.length > 4} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {KINDS.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5">
            <Dot color={k.color} size={7} /> {k.label}
          </span>
        ))}
        <span className="ml-auto">Rê chuột vào ngày để xem công việc · Giờ Việt Nam</span>
      </div>
      {current?.truncated && <p className="mt-2 text-xs text-warning">Tháng này có rất nhiều công việc; lịch chỉ hiện 500 việc đầu tiên.</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          Không tải được lịch. <button className="font-medium underline" onClick={reload}>Thử lại</button>
        </p>
      )}
    </section>
  );
}
