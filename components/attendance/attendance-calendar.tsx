"use client";

import { MessageSquareText } from "lucide-react";
import { LEAVE_KINDS, SESSION_LABEL, WEEKDAY_SHORT, type DayCell, type LeaveKind, type Session, type SessionCell } from "@/lib/attendance";
import { cn } from "@/lib/utils";

/** Colour of each kind of session, shared by the calendar, the legend and the summary. */
export const KIND_TONE: Record<LeaveKind, string> = {
  ANNUAL: "bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/40",
  SICK: "bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/40",
  PERSONAL: "bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/40",
  UNPAID: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/40",
  BUSINESS: "bg-teal-100 text-teal-800 ring-teal-300 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-500/40",
};
const WORK_TONE = "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
const PLANNED_TONE = "bg-card text-muted-foreground ring-border border-dashed";
const HOLIDAY_TONE = "bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/40";

function sessionText(c: SessionCell): { short: string; long: string } {
  if (c.state === "marked") return { short: LEAVE_KINDS[c.kind!].code, long: LEAVE_KINDS[c.kind!].short };
  if (c.state === "holiday") return { short: "L", long: "Nghỉ lễ" };
  return { short: "X", long: "Đi làm" };
}

function SessionButton({ day, cell, editable, onPick }: { day: DayCell; cell: SessionCell; editable: boolean; onPick: (day: string, session: Session) => void }) {
  const t = sessionText(cell);
  const tone = cell.state === "marked" ? KIND_TONE[cell.kind!] : cell.state === "holiday" ? HOLIDAY_TONE : cell.state === "planned" ? PLANNED_TONE : WORK_TONE;
  const label = `${SESSION_LABEL[cell.session]} ${Number(day.day.slice(8))}/${Number(day.day.slice(5, 7))}: ${cell.state === "marked" ? LEAVE_KINDS[cell.kind!].label : t.long}${cell.note ? ` · ${cell.note}` : ""}`;
  const clickable = editable && cell.state !== "holiday";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onPick(day.day, cell.session)}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium ring-1 ring-inset transition-shadow",
        tone,
        clickable ? "cursor-pointer hover:shadow-sm hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : "cursor-default",
      )}
    >
      <span className="hidden shrink-0 opacity-60 sm:inline">{cell.session === "AM" ? "S" : "C"}</span>
      <span className="sm:hidden">{t.short}</span>
      <span className="hidden truncate sm:inline">{t.long}</span>
      {cell.note && <MessageSquareText className="ml-auto hidden h-3 w-3 shrink-0 sm:block" aria-hidden />}
    </button>
  );
}

/**
 * The month, Monday first; each working day split into morning and afternoon (Saturday:
 * morning). Worked is the default; a coloured session is a leave or a business trip.
 */
export function AttendanceCalendar({
  days,
  today,
  canEditDay,
  onPick,
}: {
  days: DayCell[];
  today: string;
  canEditDay: (day: string) => boolean;
  onPick: (day: string, session: Session) => void;
}) {
  const lead = (days[0]?.weekday ?? 1) - 1;
  return (
    <div role="grid" aria-label="Lịch chấm công" className="overflow-hidden">
      <div role="row" className="grid grid-cols-7 gap-1 pb-1.5">
        {WEEKDAY_SHORT.slice(1).map((w) => (
          <div key={w} role="columnheader" className={cn("text-center text-[11px] font-semibold uppercase text-muted-foreground", w === "CN" && "text-muted-foreground/60")}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((d) => {
          const working = d.sessions.filter((s) => s.state !== "off");
          const editable = canEditDay(d.day);
          return (
            <div
              key={d.day}
              role="gridcell"
              className={cn(
                "min-w-0 rounded-lg border p-1 sm:p-1.5",
                d.weekday === 7 ? "bg-muted/40" : "bg-card",
                d.day === today && "border-primary ring-1 ring-primary/40",
              )}
            >
              <div className="mb-1 flex min-w-0 items-baseline gap-1">
                <span className={cn("text-xs font-semibold tabular-nums", d.day === today ? "text-primary" : d.weekday === 7 ? "text-muted-foreground" : "")}>{Number(d.day.slice(8))}</span>
                {d.holiday && <span className="hidden truncate text-[10px] font-medium text-orange-700 dark:text-orange-300 sm:inline" title={d.holiday}>{d.holiday}</span>}
              </div>
              {d.weekday === 7 ? (
                <p className="py-2 text-center text-[10px] text-muted-foreground sm:py-3">Nghỉ</p>
              ) : (
                <div className="space-y-1">
                  {working.map((s) => (
                    <SessionButton key={s.session} day={d} cell={s} editable={editable} onPick={onPick} />
                  ))}
                  {working.length === 1 && <p className="flex h-7 items-center justify-center text-[10px] text-muted-foreground">Nghỉ chiều</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AttendanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
      <span className={cn("rounded px-1.5 py-0.5 ring-1 ring-inset", WORK_TONE)}>X Đi làm</span>
      {(Object.keys(LEAVE_KINDS) as LeaveKind[]).map((k) => (
        <span key={k} className={cn("rounded px-1.5 py-0.5 ring-1 ring-inset", KIND_TONE[k])}>
          {LEAVE_KINDS[k].code} {LEAVE_KINDS[k].short}
        </span>
      ))}
      <span className={cn("rounded px-1.5 py-0.5 ring-1 ring-inset", HOLIDAY_TONE)}>L Lễ</span>
      <span className={cn("rounded border border-dashed px-1.5 py-0.5")}>Ngày chưa tới</span>
    </div>
  );
}
